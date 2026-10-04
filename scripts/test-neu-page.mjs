// Borometer - a damage meter for Throne and Liberty
// Copyright (C) 2026 B0R0AK
// SPDX-License-Identifier: GPL-3.0-or-later
//
// Neugestaltung als Begleit-App (Spezifikation 28.09.2026,
// docs/superpowers/specs/2026-09-28-app-neugestaltung-design.md) an der
// gebauten Seite, vom gestellten Helfer ausgeliefert (page.route). Vorlage
// ist der Entwurf docs/entwurf/borometer-entwurf-app.html; die Nummern in
// den Namen der Proben sind die der Lueckenanalyse
// (docs/superpowers/specs/2026-09-28-app-neugestaltung-luecken.md).
//
// Abschnitt 1: Rahmen (Luecken 0 und 9.1) - Titelleiste mit Kampfwahl,
// Symbolleiste, Statusleiste, Weeklies, grosse Fenster.
// Abschnitt 2: Kampf (Luecken 2) - Kopf mit Faktenzeile und leiser
// Einordnung, Tafel mit 44-Punkt-Zeilen und Spur unter dem Namen, Umschalter
// Nach Faehigkeit / Ziele / Gruppe, Kurve mit runden Achsen, Zeitverlauf ab
// 1200 Punkt Hoehe offen, Urteil mit zwei Belegen, Skillkern-Symbole.
// Abschnitt 3: Rotation (Luecken 3) - Kopf mit Einsaetzen und "alle zeigen",
// Steuerzeile mit 1x 2x 4x, grosser Uhr und Jetzt, Zeitleiste ueber den ganzen
// Kampf (3 Bahnen, ab 1200 Punkt Hoehe 5) mit Stille-Marken in Zehnteln,
// Feld "Einsaetze" mit Auge und Takt, Kasten Automatisch, "Wessen Rotation".
// Abschnitt 4: Analyse (Luecken 4) - Urteil in der Form des Entwurfs mit der
// Leerzeit nach dem Median als einem Kandidaten, "Weitere Befunde" als Zeile
// darunter, Form des Kampfes als Saeulen je Sekunde mit Luecken, gestricheltem
// Median und der Definition als Satz, die drei Felder, der Ventius-Kasten mit
// "je Boss", der Fuss "Was das Log nicht weiss"; grosse Fenster nutzen die Hoehe.
// Abschnitt 5: Vergleich (Luecken 5) - Umschalter Bester Pull / Letzter Pull im Kopf
// (letzter gesperrt mit Grund), zwei grosse Zahlen, der Satz mit der Summe, alle Faehigkeiten
// mit "nur in diesem / nur im besten", neutral gegen den besten Pull (DECISION 5.6), Rot und
// Gruen nur bei "Kaempfe vergleichen" hinter "Andere Kaempfe waehlen" (DECISION 5.7, #42).
// Abschnitt 6: Verlauf (Luecken 6) - Zeitraum Woche | Monat | Alles im Kopf, Diagramm ueber das
// Datum mit allen gelesenen und gespeicherten Kaempfen des Bosses, runden y-Schritten, Median, bester in
// Gold und dem gewaehlten Tag als Band, die Einordnung (DECISION 2.4); die Liste "Kaempfe" mit hoechstens
// fuenf Zeilen, haftendem Kopf, Boss als Auswahlfeld, Spalte Build (6.7), "Im Vergleich oeffnen" (6.10).
// Abschnitt 7: Gruppe (Luecken 7) - Starten auf diesem PC oder dem eigenen Server, Beitreten mit dem Code
// und optionaler Server-Adresse, "Dein Charakter" ueber beiden (DECISION 7.4); ohne Gruppe nur der Satz, das
// Beispiel-Board nur im Entwicklermodus (7.9); laufend Mitglieder und das Board mit Code, Status, Entfernen
// mit Rueckgaengig, Gruppen-Log speichern und Schliessen im Kopf (7.10), aufklappbar je Mitglied mit zwoelf
// Faehigkeiten und ihren vier Trefferarten (Spezifikation 2, Korrektur), bunt nach #34.
// Abschnitt 8: Builds (Luecken 8) - entfiel mit Aufgabe 12; die bleibenden Proben stehen in Abschnitt 15.
// Abschnitt 9: Start und Weeklies (Luecken 1 und 9) - Start in zwei Spalten ueber die Hoehe verteilt (Marke mit
// Palatino nur auf "Throne and Liberty", Log-Ordner waehlen, Beispielkampf, Ablagefeld), "Zuletzt geoeffnet" aus dem
// Verzeichnis der gelesenen Dateien (jede Zeile ein Knopf seit Nachtraege N3), ohne Ordner die Einrichtung als leises Feld
// (DECISION 1.12); Weeklies mit Kopf, leer und ohne Skelettzeilen.
// Abschnitt 10: Einstellungen (Luecken 10) - eine rollende Seite mit Sprungleiste (Klick springt, beim Rollen
// leuchtet der Abschnitt mit), acht Abschnitte, Themen als Kacheln mit Auto, Bewegung verringern nur als Anzeige
// (DECISION 10.4), Overlay, Log-Ordner mit Filter und Kampfdatei, Gruppe und Server (Speichern nur hier), Entwickler
// mit Beispielen und Auszug aus dem Aenderungsprotokoll, Info mit Sicherheit (DECISION 10.12); kein neuer Schluessel.
// Abschnitt 11: Overlay im Kompakt (Luecken 11.2 bis 11.7, DECISION 11.1/11.4/11.6) - randloser Streifen mit Top 5,
// der Balken als Spur unter dem Namen, Kopf mit Bossbild, Dauer und Uhrzeit, DPS in 24 Punkt; Ich | Gruppe nur bei
// laufender Gruppe; die Bedienleiste nur mit Maus oder Fokus darauf; Pillen fuer 55 % Durchsicht und durchklickbar;
// ganze Tafel beim Vergroessern; bei 55 % Durchsicht lesbar, Zahlen deckend.
// Abschnitt 12: Querschnitt (Luecken 12) - drei Themen plus Auto, 560/760/1000 ohne waagerechtes Rollen in allen
// Bereichen, Titelleiste bei 560 und 760 einzeilig, Tab-Reihenfolge Symbolleiste -> Titelleiste -> Inhalt, Regionen und
// Namen fuer den Vorleser, im Englischen kein deutscher Text, sichtbarer Text mindestens 11 Punkt.
// Abschnitt 13: Zeitverlauf in der Rotation (Nachtrag 29.09., Aufgabe 10) - unter der Zeitleiste der Zeitverlauf
// (Spuren, Zoom, Von/bis) auf derselben Zeitachse, Zoom und Von/bis fuer beide, beim Abspielen ein Strich durch
// beides, im Kampf der Knopf "Zeitverlauf und Rotation".
// Abschnitt 14: Umschalter Leiste | Reihenfolge (Nachtrag 29.09., Aufgabe 11) - in der Steuerzeile als Radiogruppe,
// die Reihenfolge als umbrechende Reihe von 32-Punkt-Symbolen ohne Zeitachse, Auge und Abspielen wie in der Leiste,
// der Zeitverlauf bleibt darunter; die Wahl gilt fuer die Sitzung.
// Abschnitt 15: Builds als Links zu Questlog (Nachtrag 29.09., Aufgabe 12) - 15.0 die Proben bleibender Funktionen
// aus test-builds-page und test-steckbrief-page (Builderkennung je Kampf, Lesen vor Schreiben, Treffer je Kampf,
// Hinweis im Vergleich, Uebungspuppe, Verlauf im Beispiel, Deutsch und Kompakt); 15.1 bis 15.12 der Bereich: Feld
// "Questlog-Link einfuegen" mit Name und Speichern, je Link eine Karte (Waffen, Name, zuletzt gespielt, bis zu drei
// Bosse mit Median und Kampfzahl, In Questlog oeffnen, Loesen mit Rueckgaengig), die Karte des offenen Kampfs oben
// und golden umrandet, gleiche Waffen, im Kampf "Build in Questlog", gespeichert nur Link, Waffen und eigener Name,
// dazu aus test-plan-page Linkpruefung, Auswahl, Fehler und Neustart; Deutsch, drei Themen, Groessen.
// Abschnitt 16: breite Schrift (Aufgabe 13, CI unter Linux) - mit Verdana und Sperrung nachgebaut: der Fuss der
// Kampfwahl kuerzt die Hinweise und haelt die Knoepfe in der Zeile, die Namen im Vergleich bei 560 kuerzen mit title.
//
// Run:  npm run test:neu-page     (baut die Seite zuerst)

import * as esbuild from "esbuild";
import { createHash } from "node:crypto";
import { appendFileSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { bilderModus, bilderPlugin, gebauterModus, spielbilderText } from "./bilder-weiche.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
/* Ohne Spielbilder (BORO_BILDER=aus, der oeffentliche Quelltext) tragen Bosse
   und Puppe die eigene Marke (EIGENE_BOSSMARKE, boro:boss) und die Kerne die
   gezeichnete Marke; die Proben der Bilder pruefen dann sie an derselben Stelle. */
const BILDER = gebauterModus(root) === "voll";
const MARKE = "data:image/webp;base64," + /^const EIGENE_BOSSMARKE = "([^"]+)";$/m.exec(readFileSync(join(root, "src/renderer/app/12-boss-images.ts"), "utf8"))[1];
let failed = 0;
function assert(cond, name, detail) {
  if (cond) console.log("  ok    " + name);
  else { failed++; console.log("  FAIL  " + name + (detail === undefined ? "" : "  " + JSON.stringify(detail).slice(0, 500))); }
}
const html = readFileSync(join(root, "dist", "renderer", "index.html"), "utf8");
const browser = await chromium.launch(process.env.PARITY_CHROMIUM ? { executablePath: process.env.PARITY_CHROMIUM } : {});
const built = await esbuild.build({ entryPoints: [join(root, "src/main/logs.ts")], bundle: true, format: "esm",
  platform: "node", write: false, logLevel: "silent" });
const logs = await import("data:text/javascript;base64," + Buffer.from(built.outputFiles[0].text).toString("base64"));
const chrome = await esbuild.build({ entryPoints: [join(root, "src/main/chrome.ts")], bundle: true, format: "esm",
  platform: "node", write: false, logLevel: "silent" });
const chromeTs = await import("data:text/javascript;base64," + Buffer.from(chrome.outputFiles[0].text).toString("base64"));

/* Die eigenen Symbole, wie sie der Entwurf eingebettet traegt (BORO_DATA.rail).
   Die Seite muss dieselben Zeichnungen tragen, Element fuer Element. Aus dem
   Entwurf vom 28.09. (docs/entwurf/borometer-entwurf-app.html, geht nicht
   hinaus) einmal herausgeschrieben: die eigenen Zeichnungen, als Fixture. */
const RAIL = JSON.parse(readFileSync(join(root, "scripts/fixtures/entwurf-rail.json"), "utf8"));
/* Die zwei Kern-Symbole des Entwurfs sind Questlog-Grafik und gehen nicht
   hinaus; festgehalten ist nur der SHA-256 ihrer Base64-Daten (ohne Kopf). */
const KERNE_SHA = {
  "Blade Storm": "e5ee9b28fa53c1b24be7c7ed4d383c17c58d3302d7ee60c6b4d40c0a27c48c21",
  "Silver Reaper's Soul Harvest": "b43363fd9afcb763803a8319c6172a739e67a60048d2828c6a844d0656e00ce0",
};
const SYMBOL_VON = { timeline: "kampf", rotation: "rotation", analysis: "analyse", compare: "vergleich", history: "verlauf",
  party: "gruppe", builds: "builds", weeklies: "weeklies", rekorde: "rekorde", start: "start", settings: "einstellungen" };
/* Der Pokal der Rekorde steht nicht im Entwurf der Neugestaltung, sondern im freigegebenen Entwurf des
   Sammelalbums (Spezifikation Rekorde 2a, 02.10.2026, vorhaben/rekorde/album/bauen.cjs): dieselbe
   Zeichnung, Element fuer Element, gleich streng gefragt wie die anderen Symbole. */
RAIL.rekorde = '<svg viewBox="0 0 24 24"><path d="M7 3.6h10v5a5 5 0 0 1-10 0z"/><path d="M7 5.4H4.3c0 2.9 1.2 4.6 3.4 5.2M17 5.4h2.7c0 2.9-1.2 4.6-3.4 5.2"/>'
  + '<path d="M12 13.6v3.2"/><path d="M8.6 20.4h6.8l-.9-3.6H9.5z"/>'
  + '<path d="M12 5.5l.8 1.7 1.7.8-1.7.8-.8 1.7-.8-1.7-1.7-.8 1.7-.8z" fill="var(--acc, #E8A33D)" stroke="var(--acc, #E8A33D)" stroke-width="1"/></svg>';
// der Inhalt eines Symbols ohne Leerraum, zum Vergleich Element fuer Element
// (selbstschliessende Elemente wie im Entwurf, ausgeschrieben wie im DOM)
const innen = (svg) => svg.replace(/^<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "")
  .replace(/<(\w+)([^<>]*?)\s*\/>/g, "<$1$2></$1>").replace(/\s+/g, " ").replace(/> </g, "><").trim();

/* Ein Log in der Form, die das Spiel schreibt (wie test-rahmen-page.mjs).
   Nur Zielnamen und Zahlen, keine Spielernamen. */
const SKILLS = [["Detonation Mark", 953174691], ["Quick Fire", 964762401],
                ["Strafing", 945674044], ["Decisive Sniping", 964581976]];
const two = (n, w = 2) => String(n).padStart(w, "0");
const stamp = (ms) => {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}${two(d.getUTCMonth() + 1)}${two(d.getUTCDate())}-` +
         `${two(d.getUTCHours())}:${two(d.getUTCMinutes())}:${two(d.getUTCSeconds())}:${two(d.getUTCMilliseconds(), 3)}`;
};
function logText(pulls, kopf = true) {
  const lines = kopf ? ["CombatLogVersion,4"] : [];
  for (const p of pulls) {
    for (let k = 0; k * 500 < p.secs * 1000; k++) {
      const [skill, sid] = SKILLS[k % SKILLS.length];
      const dmg = Math.round(1000 * p.scale * (1 + (k % 5)));
      lines.push(`${stamp(p.start + k * 500)},DamageDone,${skill},${sid},${dmg},0,0,kNormalHit,Tester,${p.target}`);
    }
  }
  return lines.join("\n") + "\n";
}
const at = (h, m, s = 0) => Date.UTC(2026, 8, 20, h, m, s);   // So 20.09.2026
const PULLS = [
  { target: "Molting Grave Wolf", start: at(20, 0, 0), secs: 20, scale: 0.6 },
  { target: "Vulcanus", start: at(20, 0, 40), secs: 60, scale: 1.0 },
  { target: "Grave Bat", start: at(20, 2, 0), secs: 20, scale: 0.7 },
  { target: "Vulcanus", start: at(20, 30, 0), secs: 60, scale: 1.2 },
  { target: "Ash Crawler", start: at(20, 31, 20), secs: 20, scale: 0.8 },
  { target: "Frost Wolf", start: at(21, 30, 0), secs: 20, scale: 0.9 },
  { target: "Stone Beetle", start: at(21, 30, 40), secs: 20, scale: 1.0 },
];
const work = mkdtempSync(join(tmpdir(), "boro-neu-"));
const LOG = join(work, "TLCombatLog-20260920.txt");
writeFileSync(LOG, logText(PULLS));

/* Eine Seite am gestellten Helfer, wie in test-rahmen-page.mjs. app: ?win=1
   und nativeFrame, sonst ein Browser-Tab. ordner: ein echter Ordner, aus dem
   /api/state und /api/latest mit den Funktionen von src/main/logs.ts
   antworten (Live wie in test-live-page.mjs). */
async function oeffne({ app = false, lang = "en", config = {}, breite = 1280, hoehe = 860, ordner = null, gruppe = null, ruhig = false,
  partyServer = "", lager = null, kuerzel = false, ordnerAuf = { ok: true } } = {}) {
  const page = await browser.newPage({ viewport: { width: breite, height: hoehe }, ...(ruhig ? { reducedMotion: "reduce" } : {}) });
  /* party: die Handlungen der Gruppe (POST /api/party/...), wie sie beim Helfer ankaemen (Abschnitt 7).
     lager: Builds und Plaene wie boro-builds.json und boro-plans.json, der Abruf bei Questlog gestellt
     (Abschnitt 8); ohne lager antwortet der Helfer leer wie bisher. */
  /* ordnerAuf: was der Helfer auf POST /api/folder/open antwortet ("keine": die Anfrage bricht ab, der Helfer
     antwortet nicht); s.ordner die gesendeten Anfragen (Nachtraege N1) */
  const s = { page, fehler: [], posts: [], win: [], party: [], ordner: [] };
  page.on("pageerror", (e) => s.fehler.push(String(e)));
  await page.addInitScript((l) => { try { localStorage.clear(); localStorage.setItem("boroLang", l); } catch { /* blockiert */ } }, lang);
  await page.route("http://boro.test/**", async (route) => {
    const req = route.request(), url = new URL(req.url()), path = url.pathname;
    const json = (body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) }).catch(() => {});
    if (path === "/api/state") {
      if (!ordner) return json({ dir: "", file: "", nativeFrame: app, material: false, stayOnTop: false });
      const f = logs.newestLog(ordner);
      return json({ dir: ordner, file: f?.name ?? "", size: f?.size ?? 0, mtime: f?.mtime ?? 0, nativeFrame: app, material: false, stayOnTop: false });
    }
    if (path === "/api/latest" && ordner) {
      const f = logs.newestLog(ordner);
      if (!f) return route.fulfill({ status: 404, body: "" }).catch(() => {});
      const from = url.searchParams.has("from") ? url.searchParams.get("from") : null;
      if (from === null) return route.fulfill({ status: 200, contentType: "text/plain; charset=utf-8", body: logs.readLog(f) }).catch(() => {});
      const a = logs.latestAnswer(f, url.searchParams.get("file"), from);
      return json(a.body, a.status);
    }
    // gruppe: der Helfer meldet eine laufende Gruppe (wie /api/party/state im Hauptprozess)
    if (path === "/api/party/state" && gruppe) return json(gruppe);
    if (path === "/api/party/server" && req.method() === "GET") return json({ server: partyServer });
    if (path.startsWith("/api/party/") && req.method() === "POST") {
      s.party.push({ path, body: JSON.parse(req.postData() || "{}") });
      // nichts oeffnen und niemanden erreichen: der Helfer lehnt ab, entfernt aber, wenn er soll
      // der Gruppen-Server wird gespeichert, wie server.ts antwortet (Fixrunde 1, Befund 2)
      if (path === "/api/party/server") { const b = s.party[s.party.length - 1].body; return json({ ok: true, server: String(b.server || "").trim() }); }
      return json(path === "/api/party/kick" ? { ok: true } : { ok: false, error: "Testhelfer" });
    }
    /* lager.gesperrt: der Helfer kann boro-builds.json gerade nicht lesen (503, Abschnitt 15.0);
       lager.ereignisse: GET und POST in ihrer Reihenfolge */
    if (lager && path === "/api/builds") {
      if (req.method() === "GET") {
        lager.ereignisse?.push(lager.gesperrt ? "GET 503" : "GET 200");
        return lager.gesperrt ? json({ ok: false }, 503) : json({ ok: true, builds: lager.builds });
      }
      const b = JSON.parse(req.postData() || "{}"); lager.builds[b.id] = b.build; lager.ereignisse?.push("POST " + b.id); return json({ ok: true });
    }
    if (lager && path === "/api/plans") {
      // lager.plansWarte: der Helfer antwortet auf das Lesen erst spaet (Abschnitt 15, Fixrunde 1)
      if (req.method() === "GET") { if (lager.plansWarte) await lager.plansWarte; return json({ ok: true, plans: lager.plans }); }
      // lager.plansAblehnen: der Helfer nimmt den Eintrag nicht an (400, Abschnitt 15.8)
      const b = JSON.parse(req.postData() || "{}"); lager.planPosts?.push(b);
      if (lager.plansAblehnen) return json({ ok: false }, 400);
      lager.plans[b.id] = b.plan; return json({ ok: true });
    }
    if (lager && path === "/api/plan/fetch") return json(lager.abruf(JSON.parse(req.postData() || "{}")));
    if (path === "/api/folder/open" && req.method() === "POST") {
      s.ordner.push(req.postData() || "");
      return ordnerAuf === "keine" ? route.abort().catch(() => {}) : json(ordnerAuf);
    }
    /* folgt Spezifikation Rundgang 02.10.2026: ein erster Start der App zeigt den
       Rundgang. Diese Proben gelten der App danach; den Rundgang selbst prueft
       test-rundgang-page.mjs. Eine eigene config kann es ueberschreiben. */
    if (path === "/api/config" && req.method() === "GET") return json({ rundgangGesehen: true, ...config });
    if (path === "/api/config") { s.posts.push(JSON.parse(req.postData() || "{}")); return json({ ok: true }); }
    /* Durchklick wie window.ts: die Antwort nennt den neuen Stand (Abschnitt 11) */
    if (path === "/api/win") { const b = JSON.parse(req.postData() || "{}"); s.win.push(b); return json({ ok: true, max: false, w: b.do === "resize" ? b.w : 400, h: b.do === "resize" ? b.h : 28, on_top: b.do === "pin" ? !!b.on : false,
      ...(b.do === "clickthrough" ? { clickthrough: !!b.on } : {}) }); }
    /* kuerzel: nach der ersten Frage meldet der Helfer einen Druck auf Strg+Umschalt+D (events.ts, Abschnitt 11) */
    if (path === "/api/events") {
      if (kuerzel && url.searchParams.has("now")) return json({ ok: true, registered: true, counts: { hotkey: 0 } });
      await new Promise((r) => setTimeout(r, kuerzel ? 300 : 1000));
      return json({ ok: true, registered: true, counts: kuerzel ? { hotkey: 1 } : {} });
    }
    // die Weeklies wie die Route: immer mit data (Pruefung W3, K3)
    if (path === "/api/weeklies" && req.method() === "GET") return json({ ok: true, data: { v: 1, profile: [] } });
    if (path === "/api/builds" && req.method() === "GET") return json({ ok: true, builds: {} });
    if (path === "/api/best" && req.method() === "GET") return json({ ok: true, best: {} });
    if (path.startsWith("/api/")) return json({ ok: true });
    return route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: html }).catch(() => {});
  });
  await page.goto("http://boro.test/index.html" + (app ? "?win=1" : ""));
  // Seite fertig: body[data-bereit] (Befund 2)
  await page.waitForFunction((o) => document.body.dataset.bereit === (o ? "ordner" : "ohne"), !!ordner);
  await page.waitForTimeout(300);
  return s;
}
async function mitLog(s, datei = LOG) {
  await s.page.setInputFiles("#fileInput", datei);
  await s.page.waitForFunction(() => !document.querySelector("#app").hidden);
  await s.page.waitForTimeout(200);
}
async function beispiel(p) {
  await p.evaluate(() => document.querySelector("#btnSample").click());
  await p.waitForFunction(() => !document.querySelector("#app").hidden);
  await p.waitForTimeout(300);
}
/* Abschnitt 2: zwei Vulcanus-Pulls fuer das Urteil. Im ersten (20:00, der
   beste) trifft jede Faehigkeit gleich oft und gleich stark. Im zweiten
   (20:30) trifft Quick Fire nur halb so stark (Verlust je Treffer) und
   Strafing ein Viertel seltener (Verlust in Treffern je Minute) - Beleg 1 und
   Beleg 2 nennen so zwei verschiedene Faehigkeiten (DECISION 2.19). */
function belegLog() {
  const lines = ["CombatLogVersion,4"];
  const reihe = [["Quick Fire", 964762401], ["Strafing", 945674044], ["Detonation Mark", 953174691]];
  /* Zwei leisere Pulls davor (18:30, 19:00, alles 60 %), damit es einen
     Median gibt und der Kopf den Kampf einordnet (MIN_MEDIAN 3). */
  for (const [start, schwach, faktor] of [[at(18, 30, 0), false, 0.6], [at(19, 0, 0), false, 0.6],
                                          [at(20, 0, 0), false, 1], [at(20, 30, 0), true, 1]]) {
    for (let k = 0; k < 120; k++) {
      const [skill, sid] = reihe[k % 3];
      if (schwach && skill === "Strafing" && Math.floor(k / 3) % 4 === 3) continue;
      // etwas Streuung, sonst erkennt die App die Schadensspalte nicht (im Mittel 10000 bzw. 5000)
      const dmg = Math.round(faktor * (schwach && skill === "Quick Fire" ? 5000 : 10000) + 100 * ((k % 5) - 2));
      lines.push(`${stamp(start + k * 500)},DamageDone,${skill},${sid},${dmg},0,0,kNormalHit,Tester,Vulcanus`);
    }
  }
  return lines.join("\n") + "\n";
}
/* Abschnitt 3: ein Vulcanus-Pull fuer die Rotation. Bis 20 s Quick Fire alle
   2 s (je zwei Treffer, 11 Einsaetze) und Strafing alle 2 s ab 1 s (je einer,
   10 Einsaetze); der letzte gedrueckte Einsatz endet bei 20,1 s, der naechste
   beginnt bei 22,6 s - genau 2,5 s Stille. Danach dicht (alle 0,25 s)
   Detonation Mark und Decisive Sniping im Wechsel, 150 Einsaetze - dichter,
   als drei oder fuenf Bahnen fassen; sein letzter endet bei 59,85 s, und nach
   krummen 2,96 s Stille (auf Zehntel gerundet "3.0 s", abgeschnitten "2.9 s",
   Fixrunde 1) folgt ein letzter Decisive Sniping - 76 davon, 172 Einsaetze.
   Deadly Viper (Passiv) jede Sekunde. */
const DV_ROT = ["Deadly Viper", 940584840];
function rotLog(start = at(21, 0, 0)) {
  const rows = [];
  let k = 0;
  const zeile = (t, [n, id]) => rows.push([start + t, `,DamageDone,${n},${id},${1000 * (1 + (k++ % 5))},0,0,kNormalHit,Tester,Vulcanus`]);
  for (let t = 0; t <= 20000; t += 2000) { zeile(t, SKILLS[1]); zeile(t + 100, SKILLS[1]); }
  for (let t = 1000; t < 20000; t += 2000) zeile(t, SKILLS[2]);
  for (let i = 0, t = 22600; t < 60000; i++, t = 22600 + i * 250) zeile(t, i % 2 ? SKILLS[3] : SKILLS[0]);
  zeile(59850 + 2960, SKILLS[3]);
  for (let t = 250; t < 60000; t += 1000) zeile(t, DV_ROT);
  rows.sort((a, b) => a[0] - b[0]);
  return ["CombatLogVersion,4", ...rows.map(([t, r]) => stamp(t) + r)].join("\n") + "\n";
}
/* Abschnitt 4: ein Vulcanus-Pull fuer die Analyse, 0 bis 59,5 s. Quick Fire
   alle 0,5 s (3000 mit etwas Streuung; reihum kritisch, stark, beides,
   normal), dazu:
   - nichts von 1 bis 3 s - liegt in den ersten 3 s, also keine Luecke,
   - nichts von 20 bis 26 s und von 40 bis 42 s - zwei Luecken, 6 und 2 s,
   - bei 33 und 34 s je ein Treffer zu 10 - unter 2 % der gewoehnlichen
     Sekunde, also eine Luecke von 2 s, obwohl etwas traf (die alte Rechnung
     ueber Abstaende zwischen Treffern sah dort keine),
   - nichts von 56 bis 59,5 s - in den letzten 5 s, also keine Luecke;
   sechs lesbare Salven Auge von Ventius (Decisive Sniping), vier mit 3
   Nachbeben (je Treffer 2000), zwei mit 2 (je Treffer 1500), dazu bei 16 s
   eine unlesbare (eine Welle aus zwei Treffern); einmal Detonation Mark mit
   250000 (der groesste Treffer); zwei Fehlschlaege von Quick Fire. Nur
   Zahlen, keine Namen. */
const VEN_START = [7000, 13000, 27000, 37000, 45000, 51000], VEN_WELLEN = [3, 2, 3, 3, 2, 3];
function anaTreffer() {
  const tr = [];   // [ms, Faehigkeit, ID, Schaden, kritisch, stark]
  let k = 0;
  for (let t = 0; t < 56000; t += 500) {
    if ((t >= 1000 && t < 3000) || (t >= 20000 && t < 26000) || (t >= 40000 && t < 42000)) continue;
    if (t >= 33000 && t < 35000) { if (t % 1000 === 0) tr.push([t, "Quick Fire", 964762401, 10, 0, 0]); continue; }
    const a = k % 4;
    tr.push([t, "Quick Fire", 964762401, 3000 + 100 * ((k % 5) - 2), a === 0 || a === 2 ? 1 : 0, a === 1 || a === 2 ? 1 : 0]);
    k++;
  }
  tr.push([59500, "Quick Fire", 964762401, 3000, 0, 0]);
  VEN_START.forEach((s, i) => {
    const d = VEN_WELLEN[i] === 3 ? 2000 : 1500;
    tr.push([s, "Decisive Sniping", 964581976, d, 0, 0]);
    for (let w = 0; w < VEN_WELLEN[i]; w++) for (const x of [0, 5, 10]) tr.push([s + 1000 + 100 * w + x, "Decisive Sniping", 964581976, d, 0, 0]);
  });
  // Fixrunde 1 (Pruefung Befund 1): eine Salve, deren Form nicht lesbar ist
  tr.push([16000, "Decisive Sniping", 964581976, 2000, 0, 0], [17000, "Decisive Sniping", 964581976, 2000, 0, 0], [17005, "Decisive Sniping", 964581976, 2000, 0, 0]);
  tr.push([10250, "Detonation Mark", 953174691, 250000, 0, 0]);
  return tr.sort((a, b) => a[0] - b[0]);
}
function anaLog(start = at(21, 0, 0)) {
  const rows = anaTreffer().map(([t, n, id, d, kr, st]) => `${stamp(start + t)},DamageDone,${n},${id},${d},${kr},${st},kNormalHit,Tester,Vulcanus`);
  for (const t of [5250, 5750]) rows.push(`${stamp(start + t)},DamageDone,Quick Fire,964762401,0,0,0,kMiss,Tester,Vulcanus`);
  rows.sort();
  return ["CombatLogVersion,4", ...rows].join("\n") + "\n";
}
/* Was die Analyse zu anaLog() sagen muss, hier unabhaengig von der Seite
   gerechnet: Sekundenwerte, Median der Sekunden mit Treffern, Anteile. */
const ANA = (() => {
  const tr = anaTreffer(), T = 60, sek = new Array(T).fill(0);
  for (const [t, , , d] of tr) sek[Math.min(T - 1, Math.floor(t / 1000))] += d;
  const pos = sek.filter((v) => v > 0).sort((a, b) => a - b), n = pos.length;
  const med = n % 2 ? pos[(n - 1) / 2] : (pos[n / 2 - 1] + pos[n / 2]) / 2;
  const je = new Map();
  for (const [, name, , d] of tr) je.set(name, (je.get(name) || 0) + d);
  const gesamt = [...je.values()].reduce((a, b) => a + b, 0);
  const reihe = [...je.entries()].sort((a, b) => b[1] - a[1]);
  const art = (kr, st) => tr.filter((x) => !!x[4] === kr && !!x[5] === st).length;
  return { T, sek, med, max: Math.max(...sek), gesamt, reihe, hits: tr.length,
    krit: tr.filter((x) => x[4]).length, stark: tr.filter((x) => x[5]).length,
    arten: { normal: art(false, false), crit: art(true, false), heavy: art(false, true), critheavy: art(true, true) } };
})();
const kurz = (x) => x >= 1e6 ? (x / 1e6).toFixed(2) + "M" : (x / 1e3).toFixed(1) + "k";
const prozDe = (q, dp = 0) => (100 * q).toFixed(dp).replace(".", ",") + "\u00a0%";
/* Abschnitt 5: drei Vulcanus-Pulls fuer den Vergleich, je 60 s. A (20:00) ist der beste und hat als
   einziger Weak Point Shot, C (21:00, der gewaehlte) als einziger Storm Current. Je Sekunde:
   A  Quick Fire 12000, Strafing 4000, Detonation Mark 8000, Weak Point Shot 2667   = 26.7k
   B  Quick Fire 10000, Strafing 4000, Detonation Mark 6000                         = 20.0k
   C  Quick Fire 14000, Strafing 3000, Detonation Mark 3000, Storm Current 1333      = 21.3k
   C gegen den besten (A): 5.3k weniger; Quick Fire und Storm Current (nur in diesem) holen etwas
   herein, Weak Point Shot fehlt ganz (nur im besten). C gegen den letzten (B): 1.3k mehr.
   Etwas Streuung, sonst erkennt die App die Schadensspalte nicht. Nur Zahlen, keine Namen. */
const VGL_SK = { QF: ["Quick Fire", 964762401], ST: ["Strafing", 945674044], DM: ["Detonation Mark", 953174691],
  WP: ["Weak Point Shot", 953002120], SC: ["Storm Current", 940222003] };
function vglLog() {
  const rows = [];
  const pull = (start, teile) => {
    for (const [k, dmg, takt] of teile) {
      const [n, id] = VGL_SK[k];
      for (let t = 0, i = 0; t < 60000; t += takt, i++) rows.push([start + t, `,DamageDone,${n},${id},${dmg + 10 * ((i % 5) - 2)},0,0,kNormalHit,Tester,Vulcanus`]);
    }
  };
  pull(at(20, 0), [["QF", 6000, 500], ["ST", 4000, 1000], ["DM", 16000, 2000], ["WP", 8000, 3000]]);
  pull(at(20, 30), [["QF", 5000, 500], ["ST", 4000, 1000], ["DM", 12000, 2000]]);
  pull(at(21, 0), [["QF", 7000, 500], ["ST", 3000, 1000], ["DM", 6000, 2000], ["SC", 4000, 3000]]);
  rows.sort((a, b) => a[0] - b[0]);
  return ["CombatLogVersion,4", ...rows.map(([t, r]) => stamp(t) + r)].join("\n") + "\n";
}
/* Eine Zahl, wie fmt(x, 1e3) sie schreibt: "5.3k", "\u22125.3k", "+500", "26.7k". */
const vglZahl = (s) => {
  const m = /([+\-\u2212]?)(\d[\d.,]*)(k|M)?/.exec(s || "");
  if (!m) return NaN;
  const v = m[3] ? parseFloat(m[2]) * (m[3] === "k" ? 1e3 : 1e6) : parseInt(m[2].replace(/[.,]/g, ""), 10);
  return (m[1] === "-" || m[1] === "\u2212" ? -1 : 1) * v;
};
/* Rund heisst: 1, 2, 2,5 oder 5 mal eine Zehnerpotenz, in gleichen Schritten ab 0. */
function rundeSchritte(werte) {
  if (werte.length < 2 || werte[0] !== 0) return false;
  const schritt = werte[1] - werte[0], p = 10 ** Math.floor(Math.log10(schritt)), m = schritt / p;
  return [1, 2, 2.5, 5].some((x) => Math.abs(x - m) < 1e-9) &&
    werte.every((v, i) => Math.abs(v - i * schritt) < 1e-6 * schritt);
}
const r = (p, q) => p.evaluate((q) => { const e = document.querySelector(q); return e && e.getClientRects().length ? e.getBoundingClientRect().toJSON() : null; }, q);
const quer = (p) => p.evaluate(() => document.documentElement.scrollWidth > innerWidth);
const bereich = async (p, name) => { await p.click(`#bereiche [data-tab="${name}"]`); await p.waitForTimeout(200); };

try {
  // --- 0.1, 0.2, 0.3: Grundriss, Titelhoehe, Wortmarke und HIVE
  {
    const s = await oeffne({ app: true });
    const p = s.page;
    await mitLog(s);
    const g = await p.evaluate(() => {
      const r = (q) => { const e = document.querySelector(q); return e && e.getClientRects().length ? e.getBoundingClientRect().toJSON() : null; };
      const st = document.querySelector(".stage"), cs = getComputedStyle(st);
      const mark = document.querySelector(".mark");
      return { top: r("header.top"), chrome: getComputedStyle(document.documentElement).getPropertyValue("--chrome").trim(),
        leiste: r("#bereiche"), stage: r(".stage"), radius: cs.borderTopLeftRadius, sb: r("#statusleiste"),
        mark: mark.innerText.trim(), markBild: mark.querySelectorAll("img").length, markDisplay: getComputedStyle(mark).fontFamily,
        hive: r("#bereiche .hive img"), ersterKnopf: r('#bereiche .tab:not([hidden])'), hiveAlt: document.querySelector("#bereiche .hive img")?.alt,
        spalten: getComputedStyle(document.querySelector(".shell")).gridTemplateColumns.split(" ").length,
        innen: document.documentElement.clientWidth, hoch: innerHeight };
    });
    assert(g.top && Math.abs(g.top.height - 36) < 0.5 && g.chrome === "36px", "0.1/0.2 App: die Titelleiste ist 36 Punkt hoch", g);
    const chromeMeldung = s.win.filter((b) => b.do === "chrome");
    assert(chromeMeldung.length > 0 && chromeMeldung.every((b) => b.height === 36), "0.2 App: die Seite meldet 36 als Hoehe der Titelleiste", chromeMeldung);
    assert(chromeTs.CHROME_HEIGHT === 36 && chromeTs.overlayFor("dark").height === 36, "0.2 Hauptprozess: CHROME_HEIGHT 36, die Systemknoepfe ebenso", chromeTs.CHROME_HEIGHT);
    assert(g.leiste && Math.round(g.leiste.width) === 64, "0.1 Symbolleiste 64 Punkt breit", g.leiste);
    assert(g.stage && g.radius === "12px" && Math.abs(g.stage.left - g.leiste.right - 8) < 1 && Math.abs(g.innen - g.stage.right - 8) < 1,
      "0.1 der Inhalt ist eine Flaeche mit 12 Punkt Rundung und 8 Punkt Luft", g);
    assert(g.sb && Math.abs(g.sb.height - 26) < 0.5 && Math.abs(g.sb.bottom - g.hoch) < 1, "0.1 Statusleiste 26 Punkt am unteren Rand", g.sb);
    assert(g.mark === "BOROMETER" && g.markBild === 0 && /Archivo/.test(g.markDisplay), "0.3 Wortmarke: BOROMETER als Text links, ohne Bild", g);
    assert(g.hive && g.ersterKnopf && g.hive.bottom <= g.ersterKnopf.top && g.hiveAlt === "The Hive", "0.3 HIVE oben in der Symbolleiste", g);
    assert(g.spalten === 2, "keine Kampfliste links: neben der Symbolleiste steht nur der Inhalt", g.spalten);
    const liste = await p.evaluate(() => ({ imFeld: !!document.querySelector("#kampfwahl #fightList"),
      alt: document.querySelectorAll(".rail, .atrail, #fightsec, .railfoot").length }));
    assert(liste.imFeld && liste.alt === 0, "die Liste der Kaempfe lebt nur im Aufklappfeld der Kampfwahl", liste);
    // 0.15: Windows zeichnet die Knoepfe weiter, rechts bleibt ihre Reserve
    const rechts = await p.evaluate(() => getComputedStyle(document.querySelector("header.top")).paddingRight);
    assert(rechts === "138px", "0.15 titleBarOverlay bleibt: rechts die Reserve der Systemknoepfe", rechts);
    assert(!s.fehler.length, "Grundriss: keine Fehler auf der Seite", s.fehler);
    await p.close();
  }

  // --- 0.13, 0.14: rechts in der Titelleiste
  {
    const s = await oeffne({ app: true });
    const p = s.page;
    await mitLog(s);
    const z = await p.evaluate(() => {
      const sicht = (q) => { const e = document.querySelector(q); return !!e && e.getClientRects().length > 0; };
      return { live: sicht("#btnWatch"), open: sicht("#btnOpen"), overlay: sicht("#btnCompact"), pin: sicht("#btnPin"),
        einst: sicht("#btnEinst"), gruppe: sicht("#partyPill"), zahnradUnten: sicht('#bereiche [data-tab="settings"]') };
    });
    assert(z.live && z.open && z.overlay && z.pin, "0.13 rechts: Live, Logs oeffnen (Symbol), Overlay, Anheften", z);
    assert(!z.einst && z.zahnradUnten, "0.14 das Zahnrad nur unten in der Symbolleiste, nicht in der Titelleiste", z);
    assert(!z.gruppe, "0.14 ohne laufende Gruppe keine Gruppen-Pille in der Titelleiste", z);
    await p.close();
  }

  // --- 0.14 mit laufender Gruppe: die Gruppen-Pille steht in der Titelleiste, als Symbol
  // (Pruefung Befund 2; vorher test-rahmen 6.1 "Gruppe als Symbol, Name und title bleiben")
  for (const [breite, app] of [[1100, true], [1280, true], [560, false]]) {
    const s = await oeffne({ app, breite, gruppe: { role: "host", code: "QX7K", board: [], target: "", error: "" } });
    const p = s.page;
    await beispiel(p);
    await p.waitForFunction(() => { const b = document.querySelector("#partyPill"); return !!b && b.getClientRects().length > 0; }, null, { timeout: 8000 }).catch(() => {});
    const g = await p.evaluate(() => {
      const r = (q) => { const e = document.querySelector(q); return e && e.getClientRects().length ? e.getBoundingClientRect().toJSON() : null; };
      const b = document.querySelector("#partyPill"), text = document.querySelector("#partyPillText");
      const ueber = (a, c) => !!a && !!c && a.left < c.right - 0.5 && c.left < a.right - 0.5 && a.top < c.bottom - 0.5 && c.top < a.bottom - 0.5;
      const kw = r(".kwahl"), live = r("#btnWatch"), pille = r("#partyPill");
      return { sicht: !!pille, wort: text.getBoundingClientRect().width, name: b.getAttribute("aria-label") || b.textContent.trim(), title: b.title,
        an: b.classList.contains("on"), ueberLive: ueber(kw, live), ueberPille: ueber(kw, pille),
        quer: document.documentElement.scrollWidth > innerWidth };
    });
    assert(g.sicht && g.an && g.wort <= 1.1 && g.name === "Hosting QX7K" && g.title === g.name,
      `0.14 ${breite}: laufende Gruppe - die Pille steht da, nur als Symbol, Name und title nennen die Gruppe`, g);
    assert(!g.ueberLive && !g.ueberPille && !g.quer, `0.14 ${breite}: die Kampfwahl ueberdeckt weder Live noch die Gruppe, kein waagerechtes Rollen`, g);
    assert(!s.fehler.length, `0.14 ${breite}: keine Fehler auf der Seite`, s.fehler);
    await p.close();
  }

  // --- 0.4, 0.5: Kampfwahl-Pille, voriger und naechster Kampf
  {
    const s = await oeffne();
    const p = s.page;
    await mitLog(s);
    // Vulcanus 20:30 waehlen: ueber die Kampfwahl, wie ein Spieler
    await p.keyboard.press("Control+K");
    await p.keyboard.type("vulc");
    await p.keyboard.press("Enter");   // der erste Treffer: der neueste Pull
    await p.waitForTimeout(200);
    const pille = await p.evaluate(() => {
      const k = document.querySelector("#kwKnopf"), w = document.querySelector("#kwWas");
      const q = (x) => w.querySelector(x);
      const probe = document.createElement("i"); probe.style.color = "var(--gold-ink)"; document.body.append(probe);
      const gold = getComputedStyle(probe).color; probe.remove();
      return { name: q("b")?.textContent, meta: q(".kwmeta")?.textContent, dps: q(".kwdps")?.textContent,
        dpsFarbe: q(".kwdps") && getComputedStyle(q(".kwdps")).color, gold, kbd: q(".kwkbd")?.textContent,
        pfeil: !!k.querySelector(".kwpfeil svg"), breit: k.getBoundingClientRect().width, voll: k.scrollWidth <= k.clientWidth + 1,
        rund: getComputedStyle(k).borderTopLeftRadius, bild: !!q(".kwbild"), label: k.getAttribute("aria-label") };
    });
    assert(pille.name === "Vulcanus" && pille.meta === "20:30 \u00b7 1m 0s" && pille.bild,
      "0.4 Pille: Bossbild, Boss, Uhrzeit \u00b7 Dauer", pille);
    assert(pille.dps && pille.dpsFarbe === pille.gold && pille.kbd === "Ctrl K" && pille.pfeil, "0.4 DPS in Gold, Ctrl K, Pfeil", pille);
    assert(pille.breit < 400 && pille.voll && parseFloat(pille.rund) >= 14, "0.4 eine Pille, so breit wie ihr Inhalt", pille);
    assert(pille.label.includes("Vulcanus") && pille.label.includes("20:30:00"), "0.4 der Name nennt Boss und Uhrzeit", pille.label);
    const kopf = () => p.evaluate(() => ({ name: document.querySelector("#hName").textContent,
      zeit: (document.querySelector("#kwKnopf").getAttribute("aria-label").match(/\d\d:\d\d:\d\d/) || [""])[0],
      vor: document.querySelector("#kwVor").disabled, nach: document.querySelector("#kwNach").disabled,
      vorName: document.querySelector("#kwVor").getAttribute("aria-label"), nachName: document.querySelector("#kwNach").getAttribute("aria-label") }));
    let k = await kopf();
    assert(k.vorName === "Previous fight" && k.nachName === "Next fight" && !k.vor && !k.nach, "0.5 \u2039 und \u203a neben der Pille, mit Namen", k);
    await p.click("#kwVor");
    await p.waitForTimeout(150);
    k = await kopf();
    assert(k.zeit === "20:02:00" && await p.evaluate(() => document.querySelector("#kampfwahl").hidden),
      "0.5 \u2039: der Kampf davor, ohne das Feld zu oeffnen", k);
    await p.click("#kwNach");
    await p.waitForTimeout(150);
    assert((await kopf()).zeit === "20:30:00", "0.5 \u203a: wieder der naechste");
    // Strg+Pfeil, nicht aus einem Eingabefeld
    await p.evaluate(() => document.activeElement?.blur());
    await p.keyboard.press("Control+ArrowLeft");
    await p.waitForTimeout(150);
    assert((await kopf()).zeit === "20:02:00", "0.5 Strg+\u2190: voriger Kampf");
    await p.keyboard.press("Control+ArrowRight");
    await p.keyboard.press("Control+ArrowRight");
    await p.waitForTimeout(150);
    assert((await kopf()).zeit === "20:31:20", "0.5 Strg+\u2192: naechster Kampf");
    for (let n = 0; n < 8; n++) await p.keyboard.press("Control+ArrowLeft");
    await p.waitForTimeout(150);
    k = await kopf();
    assert(k.zeit === "20:00:00" && k.vor && !k.nach, "0.5 am aeltesten Kampf: \u2039 gesperrt", k);
    for (let n = 0; n < 8; n++) await p.keyboard.press("Control+ArrowRight");
    await p.waitForTimeout(150);
    k = await kopf();
    assert(k.zeit === "21:30:40" && !k.vor && k.nach, "0.5 am neuesten Kampf: \u203a gesperrt", k);
    assert(!s.fehler.length, "Pille: keine Fehler auf der Seite", s.fehler);
    await p.close();
  }

  // --- 0.6, 0.8 bis 0.12: das Aufklappfeld
  {
    const s = await oeffne();
    const p = s.page;
    await mitLog(s);
    await p.keyboard.press("Control+K");
    const f = await p.evaluate(() => {
      const r = (e) => e.getBoundingClientRect();
      const kopf = document.querySelector(".kwkopf"), suche = document.querySelector(".kwsuche");
      const heads = [...document.querySelectorAll("#fightList .blockhead")];
      const zeilen = [...document.querySelectorAll("#fightList .fight")].filter((f) => f.getClientRects().length);
      /* Rechts steht die DPS; an der angewaehlten Zeile steht dort das
         Zeichen zum Loesen, die DPS rueckt davor. */
      const zeile = zeilen.map((z) => { const kd = z.querySelector(".kd"), a = r(z), b = kd && r(kd);
        const fx = z.parentElement.querySelector(".fx"), x = fx && fx.getClientRects().length ? r(fx) : null;
        return { h: a.height, rechts: b ? (x ? (x.left >= b.right ? 0 : -1) : a.right - b.right) : -1, mitte: b ? Math.abs((b.top + b.bottom) / 2 - (a.top + a.bottom) / 2) : 99,
          meta: z.querySelector(".b")?.textContent || "", label: z.getAttribute("aria-label"), best: z.querySelectorAll(".best").length }; });
      return { tag: document.querySelector("#kwTag")?.textContent, zahl: document.querySelector("#fightCount").textContent,
        kopfOben: kopf && r(kopf).bottom <= r(suche).top + 1, live: document.querySelector("#kwLive")?.getAttribute("aria-pressed"),
        liveKnopf: document.querySelector("#btnWatch").getAttribute("aria-pressed"),
        haftend: heads.every((h) => getComputedStyle(h).position === "sticky"),
        gz: heads.map((h) => h.querySelector(".gz")?.textContent || ""), zeile };
    });
    assert(f.tag === "Sun 20.09." && f.zahl === "7 fights loaded" && f.kopfOben, "0.6 Kopf des Feldes: Tag und Zahl der Kaempfe, ueber der Suche", f);
    assert(f.live === f.liveKnopf && f.live === "false", "0.8 Live im Feld, gekoppelt mit der Titelleiste", f);
    /* Feinschliff 02.10. (Abschnitt 5): die beiden Laeufe an Vulcanus (20:00 und 20:30) stehen unter einem Kopf,
       der Kopf sagt Zahl und Zeitspanne statt "from 20:00 \u00b7 3 fights". Gezaehlt werden die Kaempfe am Boss des
       Kopfes (Fixrunde 1): zwei an Vulcanus; der Kopf ohne Boss (21:30) zaehlt seine beiden Kaempfe. */
    assert(f.haftend && JSON.stringify(f.gz) === JSON.stringify(["2 fights \u00b7 21:30", "2 fights \u00b7 20:00\u201320:31"]),
      "0.9 zwei Koepfe mit haftenden Koepfen: 2 fights \u00b7 21:30 und 2 fights \u00b7 20:00\u201320:31", f.gz);
    assert(f.zeile.length >= 4 && f.zeile.every((z) => z.h >= 38 && z.h <= 44 && z.rechts >= 0 && z.rechts < 16 && z.mitte < 3),
      "0.9 Zeile: hoechstens 44 Punkt, DPS rechts in der Mitte", f.zeile.filter((z) => !(z.h >= 38 && z.h <= 44 && z.rechts >= 0 && z.rechts < 16 && z.mitte < 3)));
    assert(f.zeile.every((z) => /^\d\d:\d\d \u00b7 /.test(z.meta) && !/\d\.\d+M|\dk$/.test(z.meta)),
      "0.9 Zeile: Uhrzeit \u00b7 Dauer, ohne die Schadenssumme", f.zeile.map((z) => z.meta));
    const beste = f.zeile.filter((z) => z.best);
    assert(beste.length === 1 && beste[0].label.includes("Vulcanus") && beste[0].label.includes("20:30:00") && beste[0].label.includes("best pull"),
      "0.11 Goldpunkt: der beste Kampf je Boss, auch fuer den Vorleser", f.zeile.map((z) => [z.label, z.best]));
    // Live im Feld schaltet wie der Knopf oben (ohne Helfer im Browser: der Ordnerwahl-Weg, hier nur die Kopplung)
    const vorher = await p.evaluate(() => { const b = document.querySelector("#btnWatch"); window.__alt = b.onclick;
      b.onclick = () => { window.__liveKlick = (window.__liveKlick || 0) + 1; }; return 0; });
    await p.click("#kwLive");
    assert(await p.evaluate(() => window.__liveKlick) === 1, "0.8 Live im Feld loest dieselbe Handlung aus wie der Knopf oben", vorher);
    await p.evaluate(() => { document.querySelector("#btnWatch").onclick = window.__alt; });
    if (await p.evaluate(() => !document.querySelector("#kampfwahl").hidden)) await p.keyboard.press("Escape");
    // Fuss: Tastenhinweise links, Knoepfe rechts (DECISION 0.12)
    await p.keyboard.press("Control+K");
    const fuss = await p.evaluate(() => {
      const r = (q) => document.querySelector(q).getBoundingClientRect();
      const t = document.querySelector(".kwfuss .kwtasten");
      return { tasten: t ? t.querySelectorAll("kbd").length : 0, text: t ? t.textContent : "", rechts: t ? r(".kwfuss .kwtasten").right : 9999,
        knoepfe: ["#kwLaeufe", "#filterBtn", "#btnEditFights", "#btnClearLog"].map((q) => ({ q, l: r(q).left, da: document.querySelector(q).getClientRects().length > 0 })) };
    });
    assert(fuss.tasten >= 4 && /Enter/.test(fuss.text), "0.12 Fuss: gezeichnete Tasten als Hinweise", fuss);
    assert(fuss.knoepfe.every((k) => k.da && k.l >= fuss.rechts), "0.12 Fuss: Gespeichert, Filter, Bearbeiten, Leeren rechts der Hinweise", fuss);
    // Pfeiltasten, Enter, Esc
    await p.keyboard.press("ArrowDown");
    const an = await p.evaluate(() => document.querySelector("#kwSuche").getAttribute("aria-activedescendant"));
    assert(!!an, "Pfeil ab waehlt einen Eintrag an", an);
    await p.keyboard.press("Escape");
    assert(await p.evaluate(() => document.querySelector("#kampfwahl").hidden && document.activeElement?.id === "kwKnopf"), "Esc schliesst, Fokus an der Pille");
    // Loesen mit Rueckgaengig (nie endgueltig loeschen)
    await p.keyboard.press("Control+K");
    const n0 = await p.evaluate(() => document.querySelectorAll("#fightList .fight").length);
    const reihe = p.locator("#fightList .fightrow").nth(1);
    await reihe.hover();
    await reihe.locator(".fx").click();
    await p.waitForTimeout(200);
    const n1 = await p.evaluate(() => ({ n: document.querySelectorAll("#fightList .fight").length, undo: document.querySelector("#toast.on .tact")?.textContent }));
    assert(n1.n === n0 - 1 && n1.undo === "Undo", "0.12 Loesen im Feld, mit Rueckgaengig", { n0, n1 });
    await p.click("#toast .tact");
    await p.waitForTimeout(200);
    assert(await p.evaluate(() => document.querySelectorAll("#fightList .fight").length) === n0, "0.12 Rueckgaengig: die Zeile ist wieder da");
    await p.keyboard.press("Escape");
    assert(!s.fehler.length, "Aufklappfeld: keine Fehler auf der Seite", s.fehler);
    await p.close();
  }
  {
    // Deutsch: Kopf, Laeufe, Fuss
    const s = await oeffne({ lang: "de" });
    const p = s.page;
    await mitLog(s);
    await p.keyboard.press("Control+K");
    const de = await p.evaluate(() => ({ tag: document.querySelector("#kwTag").textContent, zahl: document.querySelector("#fightCount").textContent,
      gz: [...document.querySelectorAll("#fightList .blockhead .gz")].map((g) => g.textContent),
      tasten: document.querySelector(".kwfuss .kwtasten").textContent, vor: document.querySelector("#kwVor").getAttribute("aria-label"),
      beste: document.querySelector("#fightList .fight:has(.best)")?.getAttribute("aria-label") || "" }));
    assert(de.tag === "So 20.09." && de.zahl === "7 K\u00e4mpfe geladen" && JSON.stringify(de.gz) === JSON.stringify(["2 K\u00e4mpfe \u00b7 21:30", "2 K\u00e4mpfe \u00b7 20:00\u201320:31"]),
      "Deutsch: So 20.09., 2 K\u00e4mpfe \u00b7 20:00\u201320:31", de);
    assert(/w\u00e4hlen/.test(de.tasten) && /\u00f6ffnen/.test(de.tasten) && de.vor === "Voriger Kampf" && de.beste.includes("bester Pull"),
      "Deutsch: Tastenhinweise, Voriger Kampf, bester Pull", de);
    await p.close();
  }

  // --- Feinschliff 02.10., Abschnitt 5: aufeinanderfolgende Pulls am selben Ort und Boss unter EINEM einzeiligen
  //     Kopf; die gewaehlte Zeile steht nie hinter dem klebenden Kopf (beim Oeffnen und mit den Pfeilen)
  {
    /* Sechs Wipes in der Frostatemhoehle (je eine Fledermaus, 40 s spaeter Vulcanus, alle 3 Minuten - jeder
       Pull ein eigener Lauf), danach Ramux. Nur Ziele und Zahlen. */
    const ABEND5 = join(work, "TLCombatLog-abend5.txt");
    const P5 = [];
    for (let i = 0; i < 6; i++) {
      P5.push({ target: "Grave Bat", start: at(19, 4 + 3 * i, 0), secs: 15, scale: 0.6 });
      P5.push({ target: "Vulcanus", start: at(19, 4 + 3 * i, 40), secs: 40 + 5 * i, scale: 1 + 0.05 * i });
    }
    P5.push({ target: "Ramux", start: at(20, 10, 0), secs: 40, scale: 1 });
    writeFileSync(ABEND5, logText(P5));
    /* Was die Kampfwahl zeigt: je Kopf Name, Ort, Zahl und die Zeilen darunter; dazu, ob die gewaehlte
       und die angewaehlte Zeile unter ihrem klebenden Kopf stehen. */
    const blick5 = (p) => p.evaluate(() => {
      const r = (e) => e.getBoundingClientRect();
      const liste = document.querySelector("#kwListe"), lr = r(liste);
      // ein Klappkopf ist selbst der Kopf: er muss nur in der Liste stehen
      const frei = (z) => { if (!z) return null; const g = z.closest(".blockhead") ? null : z.closest(".blockgroup"), k = g && g.querySelector(".blockhead");
        const a = r(z), kb = k ? r(k).bottom : lr.top; return { oben: a.top - Math.max(kb, lr.top), unten: lr.bottom - a.bottom }; };
      return {
        koepfe: [...document.querySelectorAll("#fightList .blockgroup")].map((g) => { const k = g.querySelector(".blockhead"), b = k.querySelector("b");
          const teile = [...k.children].filter((c) => c.getClientRects().length && c.textContent.trim());
          const mitte = teile.map((c) => (r(c).top + r(c).bottom) / 2);
          return { name: b.textContent, h: r(k).height, einzeilig: mitte.every((m) => Math.abs(m - mitte[0]) < 4),
            ort: (k.querySelector(".factline")?.textContent || "").replace(/\s+/g, " ").trim(), gz: k.querySelector(".gz")?.textContent || "",
            // Zahl und Spanne ganz sichtbar, die Faktenzeile endet mit einer Ellipse (Pruefung, Befund 5)
            gzGanz: (() => { const z = k.querySelector(".gz"); return !!z && z.scrollWidth <= z.clientWidth + 0.5 && r(z).right <= Math.min(r(k).right, lr.right) + 0.5; })(),
            ellipse: k.querySelector(".factline") ? getComputedStyle(k.querySelector(".factline")).textOverflow : "ellipsis",
            zeilen: [...g.querySelectorAll(".fight")].map((z) => (z.querySelector(".a b")?.textContent || "") + "@" + (z.querySelector(".b")?.textContent || "").slice(0, 5)),
            trash: [...g.querySelectorAll(".trashhead")].map((t) => t.querySelector(".n")?.textContent) }; }),
        on: frei(document.querySelector("#fightList .fight.on")),
        aktiv: frei(document.querySelector("#fightList .aktiv")),
        aktivId: document.querySelector("#kwSuche").getAttribute("aria-activedescendant") || "",
        quer: liste.scrollWidth > liste.clientWidth + 1,
      };
    });
    for (const lang of ["de", "en"]) {
      const s = await oeffne({ lang }); const p = s.page;
      await mitLog(s, ABEND5);
      await p.keyboard.press("Control+K");
      await p.waitForFunction(() => !document.querySelector("#kampfwahl").hidden && document.querySelectorAll("#fightList .fight").length > 0);
      let v = await blick5(p);
      const ort = lang === "de" ? "Frostatemhöhle" : "Frostbreath Cave";
      const frost = v.koepfe.filter((k) => k.name === ort);
      // Fixrunde 1: sechs Pulls am Boss sind sechs Kaempfe, die Fledermaeuse zaehlen in den Trashmobs
      const zahl = lang === "de" ? "6 Kämpfe · 19:04–19:20" : "6 fights · 19:04–19:20";
      assert(v.koepfe.length === 2 && frost.length === 1 && frost[0].gz === zahl && /★★★★ ?Dungeon/i.test(frost[0].ort),
        `5 (${lang}): sechs Pulls in der Frostatemhoehle unter einem Kopf: Ort, Sterne, Zahl und Zeitspanne`, v.koepfe.map((k) => [k.name, k.ort, k.gz]));
      assert(frost.length === 1 && frost[0].zeilen.filter((z) => z.startsWith("Vulcanus@")).length === 6 &&
        frost[0].zeilen.slice(0, 6).join() === ["19:19", "19:16", "19:13", "19:10", "19:07", "19:04"].map((u) => "Vulcanus@" + u).join() &&
        frost[0].trash.length === 1 && frost[0].trash[0] === "6",
        `5 (${lang}): darunter die Kampfzeilen wie bisher, neueste zuerst; die Trashmobs einmal fuer den ganzen Kopf`, frost[0]);
      assert(v.koepfe.every((k) => k.einzeilig && k.h <= 40), `5 (${lang}): jeder Kopf einzeilig, hoechstens 40 Punkt`, v.koepfe.map((k) => [k.name, k.h, k.einzeilig]));
      assert(!!v.on && v.on.oben >= -1 && v.on.unten >= -1, `5 (${lang}): beim Oeffnen steht die gewaehlte Zeile (Ramux) ganz unter ihrem klebenden Kopf`, v.on);
      /* ein aelterer Kampf gewaehlt, Feld neu geoeffnet: die Zeile rollt in den Blick, nicht hinter den Kopf.
         Flacher (640), damit die Liste rollen muss - die Liste rastet an Zeilen (scroll-snap), und eine Lage
         zwischen zwei Rasten nahm der Browser zurueck. */
      await p.keyboard.press("Escape");
      await p.setViewportSize({ width: 1280, height: 640 });
      await p.keyboard.press("Control+K");
      await p.waitForFunction(() => !document.querySelector("#kampfwahl").hidden);
      await p.evaluate(() => [...document.querySelectorAll("#fightList .fight")].find((z) => (z.querySelector(".b")?.textContent || "").startsWith("19:07"))?.click());
      await p.waitForFunction(() => document.querySelector("#kampfwahl").hidden);
      await p.keyboard.press("Control+K");
      await p.waitForFunction(() => !document.querySelector("#kampfwahl").hidden);
      await p.waitForTimeout(200);
      v = await blick5(p);
      assert(!!v.on && v.on.oben >= -1 && v.on.unten >= -1, `5 (${lang}): 19:07 gewaehlt und neu geoeffnet - die Zeile ganz im Blick, nicht hinter dem Kopf`, v.on);
      // Pfeile: jede angewaehlte Zeile steht unter ihrem Kopf; Enter waehlt, Esc schliesst
      let verdeckt = [];
      await p.keyboard.press("Home");
      for (let n = 0; n < 16; n++) {
        await p.keyboard.press("ArrowDown");
        const a = await blick5(p);
        if (!a.aktiv || a.aktiv.oben < -1 || a.aktiv.unten < -1) verdeckt.push([a.aktivId, a.aktiv]);
      }
      for (let n = 0; n < 16; n++) {
        await p.keyboard.press("ArrowUp");
        const a = await blick5(p);
        if (!a.aktiv || a.aktiv.oben < -1 || a.aktiv.unten < -1) verdeckt.push([a.aktivId, a.aktiv]);
      }
      assert(!verdeckt.length, `5 (${lang}): Pfeile auf und ab - keine angewaehlte Zeile hinter dem klebenden Kopf`, verdeckt);
      await p.keyboard.press("Escape");
      assert(await p.evaluate(() => document.querySelector("#kampfwahl").hidden && document.activeElement?.id === "kwKnopf"), `5 (${lang}): Esc schliesst, Fokus an der Pille`);
      // zugeklappt: der eine Kopf klappt alle sechs Pulls (bis auf den gewaehlten)
      await p.keyboard.press("Control+K");
      await p.evaluate((o) => [...document.querySelectorAll("#fightList .blockfold")].find((b) => b.textContent.includes(o))?.click(), ort);
      v = await blick5(p);
      const zu = v.koepfe.find((k) => k.name === ort);
      assert(!!zu && zu.zeilen.length === 1 && zu.zeilen[0] === "Vulcanus@19:07", `5 (${lang}): der Kopf klappt alle Pulls am Ort zu, die gewaehlte Zeile bleibt`, zu);
      await p.keyboard.press("Escape");
      assert(!s.fehler.length, `5 (${lang}): keine Fehler`, s.fehler);
      await p.close();
    }
    // 560 Punkt: einzeilig, kein Querrollen
    {
      const s = await oeffne({ lang: "de", breite: 560, hoehe: 860 }); const p = s.page;
      await mitLog(s, ABEND5);
      await p.keyboard.press("Control+K");
      await p.waitForFunction(() => !document.querySelector("#kampfwahl").hidden && document.querySelectorAll("#fightList .fight").length > 0);
      const v = await blick5(p);
      const quer = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth);
      assert(!quer && !v.quer && v.koepfe.every((k) => k.einzeilig && k.gzGanz && k.ellipse === "ellipsis") && !!v.on && v.on.oben >= -1,
        "5 (560): Koepfe einzeilig, Zahl und Spanne ganz sichtbar, Faktenzeile mit Ellipse, kein Querrollen, die gewaehlte Zeile frei", { quer, v });
      await p.close();
    }
  }

  // --- Kampfwahl am Koloss Vegamor (Fehler vom 29.09.): Namen ohne Steuerzeichen, alle Teile als Vegamor, mit Bild,
  //     und das ganze Ereignis 22:07 bis 22:20 als EIN Lauf (Entscheidung 01.10.)
  {
    /* Nach einem eigenen Log vom 29.09., 22:07 bis 22:20, auf Ziele, Zeiten und
       Zahlen reduziert, in derselben Folge und mit denselben Pausen (61 bis
       139 s; die drei Zeilen ohne Ziel um 22:11:40 fehlen hier, so liegt die
       laengste Pause frei). Zwei kurze Kaempfe am Anfang (Krieger und Mift,
       unter der Mindestdauer), die Klaue, die Krieger in den Pausen, Vegarion,
       Vegarus, Vegaorb und am Ende das Ziel, das das Spiel mit Steuerzeichen
       schreibt. Die Kampfwahl zeigte dort "^<s=Dialogue_Speech_Text>Vagamont^</s>",
       ohne Bild und ohne Vegamor, und das Ereignis in fuenf Laeufen. */
    const VEG = join(work, "TLCombatLog-vegamor.txt");
    writeFileSync(VEG, logText([
      { target: "Ego-less Great Tree Warrior", start: at(22, 7, 3), secs: 1, scale: 0.6 },
      { target: "Mift", start: at(22, 7, 14), secs: 0.5, scale: 0.3 },
      { target: "Vegamor's Claw", start: at(22, 7, 51), secs: 40, scale: 1.0 },
      { target: "Ego-less Great Tree Warrior", start: at(22, 9, 35), secs: 29, scale: 0.6 },
      { target: "Vegarion", start: at(22, 12, 23), secs: 20, scale: 1.1 },
      { target: "Ego-less Great Tree Warrior", start: at(22, 13, 10), secs: 21, scale: 0.6 },
      { target: "Vegarion", start: at(22, 14, 33), secs: 9, scale: 1.1 },
      { target: "Vegarus", start: at(22, 14, 51), secs: 6, scale: 1.0 },
      { target: "Ego-less Great Tree Warrior", start: at(22, 16, 13), secs: 13, scale: 0.6 },
      { target: "Vegaorb", start: at(22, 17, 6), secs: 25, scale: 1.2 },
      { target: "^<s=Dialogue_Speech_Text>Vagamont^</s>", start: at(22, 19, 11), secs: 11, scale: 1.3 },
    ]));
    for (const lang of ["en", "de"]) {
      const s = await oeffne({ lang });
      const p = s.page;
      await mitLog(s, VEG);
      await p.keyboard.press("Control+K");
      await p.waitForFunction(() => !document.querySelector("#kampfwahl").hidden && document.querySelectorAll("#fightList .fight").length > 0);
      const k = await p.evaluate(() => ({
        steuer: [document.querySelector("#kampfwahl").textContent, document.querySelector("#kwKnopf").textContent,
                 document.querySelector("#kwKnopf").getAttribute("aria-label"), ...[...document.querySelectorAll("#kampfwahl [title], #kampfwahl [aria-label]")]
                   .flatMap((e) => [e.getAttribute("title") || "", e.getAttribute("aria-label") || ""])].filter((x) => /\^<|Dialogue_Speech/.test(x || "")),
        knopf: document.querySelector("#kwKnopf").getAttribute("aria-label") || "",
        zahl: document.querySelector("#fightCount").textContent,
        koepfe: [...document.querySelectorAll("#fightList .blockhead b")].map((b) => b.textContent),
        kopfZeile: [...document.querySelectorAll("#fightList .blockhead")].map((h) => h.textContent.replace(/\s+/g, " ").trim()),
        zeilen: [...document.querySelectorAll("#fightList .fight")].map((z) => ({ name: z.querySelector(".a b")?.textContent || "",
          bild: !!z.querySelector("img.bic")?.getAttribute("src")?.startsWith("data:image/webp"), src: z.querySelector("img.bic")?.getAttribute("src") || "",
          meta: (z.querySelector(".b")?.textContent || "").trim(), dps: (z.querySelector(".kd")?.textContent || "").trim() })),
        pille: document.querySelector("#kwKnopf img")?.getAttribute("src") || "",
      }));
      const namen = k.zeilen.map((z) => z.name);
      assert(namen.length === 6, `Vegamor (${lang}): sechs Kaempfe am Koloss oben in der Liste`, { zahl: k.zahl, namen });
      /* Das Bild des Ganzen (Entscheidung 01.10.: das NPC-Bild des Geisterbaums) ist ein anderes als das der Kerne:
         Vegamor und die Klaue tragen es, Vegarus den Kern, Vegarion und Vegaorb ihre eigenen; die Pille zeigt es auch. */
      const src = Object.fromEntries(k.zeilen.map((z) => [z.name, z.src]));
      assert(BILDER ? src.Vegamor && src.Vegamor === src["Vegamor's Claw"] && src.Vegamor === k.pille
        && new Set([src.Vegamor, src.Vegarus, src.Vegarion, src.Vegaorb]).size === 4
        : k.zeilen.length === 6 && k.zeilen.every((z) => z.src === MARKE) && k.pille === MARKE,
        `Vegamor (${lang}): das Ganze und die Klaue mit dem Bild des Geisterbaums, die Kerne mit ihren` + (BILDER ? "" : " (ohne Spielbilder: Marke)"), Object.fromEntries(Object.entries(src).map(([n, s]) => [n, s.length + ":" + s.slice(-24)])));
      assert(k.steuer.length === 0, `Vegamor (${lang}): kein Steuerzeichen des Spiels in der Kampfwahl`, k.steuer);
      assert(namen[0] === "Vegamor" && k.knopf.includes("Vegamor") && !k.knopf.includes("Vagamont"),
        `Vegamor (${lang}): das Ziel "Vagamont" heisst Vegamor, auch in der Pille`, { namen, knopf: k.knopf });
      assert(k.zeilen.every((z) => z.bild) && JSON.stringify(namen) === JSON.stringify(["Vegamor", "Vegaorb", "Vegarus", "Vegarion", "Vegarion", "Vegamor's Claw"]),
        `Vegamor (${lang}): Vegamor, Vegaorb, Vegarus, zweimal Vegarion und die Klaue, jeder mit Bild`, k.zeilen);
      /* Entscheidung 01.10.: die Teile sind einzelne Kaempfe im gesamten Lauf, der Lauf fasst nur zusammen. Jede Zeile hat
         ihre eigene Uhrzeit, Dauer und DPS und laesst sich waehlen. */
      const zeiten = k.zeilen.map((z) => z.meta.slice(0, 5));
      assert(k.zeilen.every((z) => /^\d\d:\d\d \u00b7 \d+([.,]\d)?\ss$/.test(z.meta) && /\d/.test(z.dps)) && new Set(zeiten).size === 5,
        `Vegamor (${lang}): jeder Teil eine eigene Zeile mit Uhrzeit, Dauer und DPS`, k.zeilen.map((z) => [z.name, z.meta, z.dps]));
      await p.evaluate(() => [...document.querySelectorAll("#fightList .fight")].find((z) => /^Vegarion/.test(z.querySelector(".a b")?.textContent || "")
        && (z.querySelector(".b")?.textContent || "").startsWith("22:12"))?.click());
      await p.waitForFunction(() => /22:12:23/.test(document.querySelector("#kwKnopf")?.getAttribute("aria-label") || ""), null, { timeout: 4000 }).catch(() => {});
      const gewaehlt = await p.evaluate(() => ({ knopf: document.querySelector("#kwKnopf").getAttribute("aria-label"), kopf: document.querySelector("#hName")?.textContent.trim() }));
      assert(/Vegarion/.test(gewaehlt.knopf) && /22:12:23/.test(gewaehlt.knopf) && gewaehlt.kopf === "Vegarion",
        `Vegamor (${lang}): Vegarion um 22:12 laesst sich als eigener Kampf waehlen`, gewaehlt);
      if (await p.evaluate(() => document.querySelector("#kampfwahl").hidden)) {
        await p.keyboard.press("Control+K");
        await p.waitForFunction(() => !document.querySelector("#kampfwahl").hidden);
      }
      // Feinschliff 02.10. (Abschnitt 5): Zahl und Zeitspanne der gelisteten Kaempfe statt "ab 22:07 \u00b7 9 Kaempfe"
      // Fixrunde 1: die Kaempfe an den Teilen des Kolosses (sechs Zeilen), nicht die Krieger dazwischen
      const ab = lang === "de" ? /6 K\u00e4mpfe \u00b7 22:07\u201322:19/ : /6 fights \u00b7 22:07\u201322:19/;
      const kurz = lang === "de" ? /2 kurze nicht gelistet/ : /2 short ones not listed/;
      assert(k.koepfe.length === 1 && k.koepfe[0] === "Vegamor" && ab.test(k.kopfZeile[0]) && kurz.test(k.kopfZeile[0]),
        `Vegamor (${lang}): EIN Lauf Vegamor ab 22:07 mit neun Kaempfen, die zwei kurzen am Anfang gehoeren dazu`, k.kopfZeile);
      /* Die Krieger in den Pausen gehoeren zum Ereignis (sie halten es
         zusammen), sind aber nicht der Boss: Nebenkaempfe hinter dem
         Klappkopf desselben Laufs, ohne Bossbild. */
      await p.evaluate(() => document.querySelector("#fightList .trashhead").click());
      await p.waitForFunction(() => [...document.querySelectorAll("#fightList .fight")].some((z) => /Ego-less/.test(z.textContent)));
      const neben = await p.evaluate(() => [...document.querySelectorAll("#fightList .fight")].filter((z) => /Ego-less/.test(z.textContent))
        .map((z) => ({ name: z.querySelector(".a b")?.textContent, bild: !!z.querySelector("img.bic"),
          lauf: z.closest(".blockgroup")?.querySelector(".blockhead b")?.textContent })));
      assert(neben.length === 3 && neben.every((x) => x.name === "Ego-less Great Tree Warrior" && !x.bild && x.lauf === "Vegamor"),
        `Vegamor (${lang}): die drei Krieger in den Pausen stehen im Lauf Vegamor, ohne Bossbild`, neben);
      assert(!s.fehler.length, `Vegamor (${lang}): keine Fehler auf der Seite`, s.fehler);
      await p.close();
    }
  }

  // --- Grenzen des Koloss-Laufs (Pruefung 01.10., M3 und N1): 179/181 s, Feldboss, fremder Gegner, Nebengegner ohne Koloss
  {
    /* Fuenf Lagen, je eine Stunde auseinander, nur Ziele und Zahlen. "nach" ist die Stille ab dem letzten Treffer des
       vorigen Kampfs (logText trifft alle 0,5 s, der letzte Treffer eines 20-s-Kampfs liegt bei 19,5 s).
       A 20:00 Vegarion, 179 s Stille, Vegaorb: EIN Lauf (KOLOSS_GAP 180 s).
       B 21:00 Vegarion, 181 s Stille, Vegaorb: zwei Laeufe.
       C 22:00 Akman (Manticus, ein Feldboss), 90 s Stille, Akman: zwei Laeufe - die Regel gilt nur fuer den Koloss.
       D 23:00 Vagamont, 90 s Stille, ein fremder Gegner: der steht nicht im Lauf Vegamor.
       E 23:30 ein Krieger des Kolosses ohne Koloss in der Naehe, 30 s spaeter Akman: der Krieger gehoert zu Manticus,
         nicht zu Vegamor (N1: ein Nebengegner zaehlt nur neben seinem Koloss). */
    const nach = (start, secs, still) => start + (secs - 0.5) * 1000 + still * 1000;
    const L = [];
    const kampf = (target, start, secs = 20) => { L.push({ target, start, secs, scale: 1.0 }); return start; };
    let t0 = kampf("Vegarion", at(20, 0, 0)); kampf("Vegaorb", nach(t0, 20, 179));
    t0 = kampf("Vegarion", at(21, 0, 0)); kampf("Vegaorb", nach(t0, 20, 181));
    t0 = kampf("Akman", at(22, 0, 0)); kampf("Akman", nach(t0, 20, 90));
    t0 = kampf("Vagamont", at(23, 0, 0)); kampf("Stone Beetle", nach(t0, 20, 90));
    t0 = kampf("Ego-less Great Tree Warrior", at(23, 30, 0)); kampf("Akman", nach(t0, 20, 30));
    const GR = join(work, "TLCombatLog-grenzen.txt");
    writeFileSync(GR, logText(L));
    const s = await oeffne({ lang: "en" });
    const p = s.page;
    await mitLog(s, GR);
    await p.keyboard.press("Control+K");
    await p.waitForFunction(() => !document.querySelector("#kampfwahl").hidden && document.querySelectorAll("#fightList .fight").length > 0);
    // die Nebenkaempfe hinter den Klappkoepfen aufklappen, damit jede Zeile in ihrem Lauf steht
    for (let i = 0; i < 5; i++) {
      const zu = await p.evaluate(() => { const h = document.querySelector('#fightList .trashhead[aria-expanded="false"]'); if (h) h.click(); return !!h; });
      if (!zu) break;
    }
    /* Feinschliff 02.10. (Abschnitt 5): aufeinanderfolgende Laeufe am selben Ort und Boss stehen unter einem Kopf
       (.blockgroup); welcher Lauf eine Zeile ist, sagt data-lauf an ihrer Huelle. Die Proben unten gelten den
       Laeufen wie bisher, der Kopf ist der, unter dem der Lauf steht. */
    const laeufe = await p.evaluate(() => { const je = new Map();
      for (const r of document.querySelectorAll("#fightList .fightrow")) {
        const z = r.querySelector(".fight"), l = r.dataset.lauf || "";
        if (!je.has(l)) je.set(l, { lauf: l, kopf: r.closest(".blockgroup")?.querySelector(".blockhead b")?.textContent || "", kaempfe: [] });
        je.get(l).kaempfe.push((z.querySelector(".a b")?.textContent || "") + "@" + (z.querySelector(".b")?.textContent || "").slice(0, 5));
      }
      return [...je.values()]; });
    assert(laeufe.length >= 6 && laeufe.every((l) => /^\d+$/.test(l.lauf)), "M3: jede Zeile nennt ihren Lauf (data-lauf)", laeufe);
    const lauf = (wer, um) => laeufe.find((l) => l.kaempfe.includes(wer + "@" + um));
    const a1 = lauf("Vegarion", "20:00"), a2 = lauf("Vegaorb", "20:03");
    assert(!!a1 && a1 === a2 && a1.kopf === "Vegamor", "M3 A: 179 s Stille zwischen zwei Teilen - ein Lauf Vegamor", laeufe);
    const b1 = lauf("Vegarion", "21:00"), b2 = lauf("Vegaorb", "21:03");
    assert(!!b1 && !!b2 && b1 !== b2, "M3 B: 181 s Stille - zwei Laeufe", laeufe);
    const c1 = lauf("Akman", "22:00"), c2 = lauf("Akman", "22:01");
    assert(!!c1 && !!c2 && c1 !== c2 && c1.kopf === "Manticus" && c2.kopf === "Manticus", "M3 C: Manticus mit 90 s Stille - zwei Laeufe, die Koloss-Regel gilt nicht", laeufe);
    const ckoepfe = await p.evaluate(() => [...document.querySelectorAll("#fightList .blockgroup")].filter((g) => /Akman@22:0[01]/.test([...g.querySelectorAll(".fight")]
      .map((z) => (z.querySelector(".a b")?.textContent || "") + "@" + (z.querySelector(".b")?.textContent || "").slice(0, 5)).join())).length);
    assert(ckoepfe === 1, "M3 C (Feinschliff 5): die zwei Laeufe an Manticus stehen hintereinander unter einem Kopf", ckoepfe);
    const d1 = lauf("Vegamor", "23:00"), d2 = lauf("Stone Beetle", "23:01");
    assert(!!d1 && !!d2 && d1 !== d2 && d1.kopf === "Vegamor" && d2.kopf !== "Vegamor", "M3 D: ein fremder Gegner 90 s nach Vagamont steht nicht im Lauf Vegamor", laeufe);
    const e1 = lauf("Ego-less Great Tree Warrior", "23:30"), e2 = lauf("Akman", "23:30");
    assert(!!e1 && e1 === e2 && e1.kopf === "Manticus", "N1 E: ein Krieger des Kolosses ohne Koloss in der Naehe gehoert zum Boss danach (Manticus), nicht zu Vegamor", laeufe);
    assert(!s.fehler.length, "Grenzen des Koloss-Laufs: keine Fehler auf der Seite", s.fehler);
    await p.close();
  }

  // --- Uebungspuppe mit eigenem Symbol (Entscheidung 01.10.): Kampfwahl, Kampfkopf, Ziele, Kompakt, Namensnennung unter Info
  {
    const quelle = spielbilderText(root, bilderModus(root));
    const PUPPE = BILDER ? "data:image/webp;base64," + (/"fremd:target-practice":"([^"]+)"/.exec(quelle) || [])[1] : MARKE;
    const PL = join(work, "TLCombatLog-puppe.txt");
    writeFileSync(PL, logText([{ target: "Practice Dummy", start: at(20, 20, 0), secs: 62, scale: 1.0 },
      { target: "Practice Dummy", start: at(20, 40, 0), secs: 62, scale: 1.1 }]));
    for (const lang of ["en", "de"]) {
      const s = await oeffne({ lang });
      const p = s.page;
      await mitLog(s, PL);
      await p.keyboard.press("Control+K");
      await p.waitForFunction(() => !document.querySelector("#kampfwahl").hidden && document.querySelectorAll("#fightList .fight").length > 0);
      const kw = await p.evaluate(() => ({ zeilen: [...document.querySelectorAll("#fightList .fight img.bic")].map((i) => i.getAttribute("src")),
        n: document.querySelectorAll("#fightList .fight").length, pille: document.querySelector("#kwKnopf img")?.getAttribute("src") || "" }));
      await p.keyboard.press("Escape");
      const kopf = await p.evaluate(() => document.querySelector("#hName img.hbild")?.getAttribute("src") || "");
      /* Der Verlauf zeigt nur bekannte Bosse (verlaufBosse in 32-history.ts); die Puppe steht dort heute
         nicht, also gibt es dort kein Bild zu tauschen. Die Ziele-Tabelle des Kampfs zeigt es (bossMark). */
      await p.evaluate(() => document.querySelector('[data-g="target"]')?.click());
      await p.waitForFunction(() => document.querySelector('[data-g="target"]')?.getAttribute("aria-pressed") === "true");
      const ziele = await p.evaluate((marke) => [...document.querySelectorAll("img.sic")].map((i) => i.getAttribute("src"))
        .filter((x) => x && (marke ? x === marke : x.length > 3000)), BILDER ? "" : MARKE);
      await p.click("#btnCompact");
      await p.waitForFunction(() => document.body.classList.contains("compact"));
      const kompakt = await p.evaluate(() => { const i = document.querySelector("#hName img.hbild"); return { src: i?.getAttribute("src") || "", sicht: !!i && i.getClientRects().length > 0,
      }; });
      assert(PUPPE.length > 1000 && kw.n === 2 && kw.zeilen.length === 2 && kw.zeilen.every((x) => x === PUPPE) && kw.pille === PUPPE,
        `Uebungspuppe (${lang}): beide Kaempfe in der Kampfwahl und die Pille mit dem Symbol der Puppe` + (BILDER ? "" : " (ohne Spielbilder: Marke)"), { n: kw.n, zeilen: kw.zeilen.map((x) => x.length), pille: kw.pille.length });
      assert(kopf === PUPPE && ziele.includes(PUPPE) && kompakt.src === PUPPE && kompakt.sicht,
        `Uebungspuppe (${lang}): Kampfkopf, Ziele-Tabelle und Kompakt mit dem Symbol der Puppe` + (BILDER ? "" : " (ohne Spielbilder: Marke)"),
        { kopf: kopf.length, ziele: ziele.map((x) => x.length), kompakt: { sicht: kompakt.sicht, src: kompakt.src.length } });
      assert(!s.fehler.length, `Uebungspuppe (${lang}): keine Fehler auf der Seite`, s.fehler);
      await p.close();
    }
    // die Namensnennung (Flaticon License) unter Einstellungen > Info, in beiden Sprachen
    const s = await oeffne({ lang: "de" });
    await bereich(s.page, "settings");
    await s.page.waitForFunction(() => !document.querySelector("#einst").hidden);
    const nennung = await s.page.evaluate(() => document.querySelector("#eg-info #einstPuppe")?.textContent || "");
    assert(nennung.includes("Target practice icons created by juicy_fish - Flaticon") && nennung.includes("flaticon.com/free-icons/target-practice")
      && /\u00dcbungspuppe/.test(nennung) && /Flaticon License/.test(nennung),
      "Uebungspuppe: die Namensnennung steht unter Einstellungen > Info", nennung);
    await s.page.close();
  }

  // --- 0.16 bis 0.20: Symbolleiste
  {
    const s = await oeffne();
    const p = s.page;
    await beispiel(p);
    const l = await p.evaluate(() => {
      const k = [...document.querySelectorAll("#bereiche .tab")].filter((b) => !b.hidden);
      const frei = document.querySelector("#bereiche .bfrei").getBoundingClientRect();
      return { folge: k.map((b) => b.dataset.tab),
        unten: k.filter((b) => b.getBoundingClientRect().top >= frei.bottom - 0.5).map((b) => b.dataset.tab),
        svg: k.map((b) => { const v = b.querySelector("svg"), q = v.getBoundingClientRect();
          return { tab: b.dataset.tab, box: v.getAttribute("viewBox"), w: Math.round(q.width), h: Math.round(q.height), versteckt: v.getAttribute("aria-hidden"), inhalt: v.innerHTML }; }),
        knopf: k.map((b) => Math.round(b.getBoundingClientRect().width) + "x" + Math.round(b.getBoundingClientRect().height)) };
    });
    // folgt Spezifikation Rekorde 2a (02.10.2026): der Pokal unten nach den Weeklies, gleich streng
    assert(JSON.stringify(l.folge) === JSON.stringify(["timeline", "rotation", "analysis", "compare", "history", "party", "builds", "weeklies", "rekorde", "start", "settings"]),
      "0.17 Reihenfolge: Kampf bis Builds, unten Weeklies, Rekorde, Start, Einstellungen", l.folge);
    assert(JSON.stringify(l.unten) === JSON.stringify(["weeklies", "rekorde", "start", "settings"]), "0.17 Weeklies, Rekorde, Start und Einstellungen unten", l.unten);
    const falsch = l.svg.filter((v) => v.box !== "0 0 24 24" || v.w !== 22 || v.h !== 22 || v.versteckt !== "true"
      || innen(v.inhalt) !== innen(RAIL[SYMBOL_VON[v.tab]]));
    assert(!falsch.length, "0.16 die eigenen Symbole aus dem Entwurf, 22 Punkt, fuer den Vorleser verborgen", falsch.map((v) => v.tab));
    assert(l.knopf.every((x) => x === "44x44"), "0.16 Knoepfe 44 \u00d7 44", l.knopf);
    // Tooltip als Blase rechts, bei Zeigen und bei Fokus (0.19)
    await p.hover('#bereiche [data-tab="history"]');
    await p.waitForTimeout(300);
    const tip = await p.evaluate(() => { const b = document.querySelector('#bereiche [data-tab="history"]'), t = b.querySelector(".btip");
      return { text: t?.textContent, deck: t && getComputedStyle(t).opacity, links: t && t.getBoundingClientRect().left, knopf: b.getBoundingClientRect().right,
        versteckt: t?.getAttribute("aria-hidden"), name: b.textContent.replace(t?.textContent || "", "").trim() }; });
    assert(tip.text === "History" && tip.deck === "1" && tip.links > tip.knopf && tip.versteckt === "true" && tip.name === "History",
      "0.19 Zeigen: Blase rechts mit dem Namen, der Vorleser hoert ihn einmal", tip);
    await p.mouse.move(700, 500);
    await p.focus('#bereiche [data-tab="timeline"]');
    await p.keyboard.press("ArrowDown");
    await p.waitForTimeout(300);
    const tipF = await p.evaluate(() => { const t = document.querySelector('#bereiche [data-tab="rotation"] .btip'); return { deck: getComputedStyle(t).opacity, text: t.textContent }; });
    assert(tipF.deck === "1" && tipF.text === "Rotation", "0.19 Fokus: die Blase steht auch mit der Tastatur", tipF);
    // Auswahl: Glutflaeche und 3 x 16 Punkt Kante in --pick (0.20)
    for (const thema of ["dark", "light", "tnl"]) {
      await p.evaluate((t) => document.documentElement.setAttribute("data-theme", t), thema);
      await p.waitForTimeout(250);
      const a = await p.evaluate(() => {
        const probe = document.createElement("i"); probe.style.color = "var(--pick)"; document.body.append(probe);
        const pick = getComputedStyle(probe).color; probe.remove();
        const b = document.querySelector('#bereiche .tab[aria-current="page"]'), k = getComputedStyle(b, "::before");
        return { pick, kante: k.backgroundColor, w: k.width, h: k.height, grund: getComputedStyle(b).backgroundColor, grundBild: getComputedStyle(b).backgroundImage };
      });
      assert(a.kante === a.pick && a.w === "3px" && a.h === "16px" && (a.grund !== "rgba(0, 0, 0, 0)" || a.grundBild !== "none"),
        `0.20 ${thema}: gewaehlt mit Glutflaeche und 3 \u00d7 16 Kante in --pick`, a);
    }
    await p.evaluate(() => document.documentElement.setAttribute("data-theme", "dark"));
    assert(!s.fehler.length, "Symbolleiste: keine Fehler auf der Seite", s.fehler);
    await p.close();
  }
  {
    // 0.18 Entwicklermodus: Waffen und Log-Einrichtung nach Builds, ueber dem Abstand
    const s = await oeffne();
    const p = s.page;
    await beispiel(p);
    await p.click('#bereiche [data-tab="settings"]');
    await p.click('#einstNav button[data-gruppe="logs"]');
    await p.click("#eDev");
    await p.waitForTimeout(150);
    const folge = await p.evaluate(() => [...document.querySelectorAll("#bereiche .tab")].filter((b) => !b.hidden).map((b) => b.dataset.tab));
    assert(JSON.stringify(folge.slice(0, 8)) === JSON.stringify(["timeline", "rotation", "analysis", "compare", "history", "party", "builds", "weapons"]),
      "0.18 Entwicklermodus: Waffen nach Builds", folge);
    await p.close();
  }

  // --- Builds und Weeklies (9.1) als Bereiche
  {
    const s = await oeffne();
    const p = s.page;
    // Weeklies ohne Log
    await bereich(p, "weeklies");
    let w = await p.evaluate(() => { const x = document.querySelector("#weeklies"), h = x && x.querySelector("h2");
      return { da: !!x && !x.hidden, land: document.querySelector("#land").hidden, app: document.querySelector("#app").hidden, einst: document.querySelector("#einst").hidden,
        titel: h?.textContent, name: x && document.getElementById(x.getAttribute("aria-labelledby") || "")?.textContent, satz: x?.querySelector(".wbox .wksatz")?.textContent || "",
        symbol: x ? (x.querySelector(".wbox .wsym svg")?.innerHTML || "") : "", neu: document.querySelector("#wkNeu")?.textContent || "",
        aktuell: document.querySelector('#bereiche .tab[aria-current="page"]')?.dataset.tab }; });
    assert(w.da && w.land && w.app && w.einst && w.aktuell === "weeklies", "9.1 Weeklies: ein eigener Bereich, auch ohne Log", w);
    /* folgt Spezifikation Weeklies (29.09., Aufgabe W3): statt "kommt spaeter" die Liste; ohne Charakter
       (der Helfer antwortet leer) das leere Feld mit dem Symbol, dem Satz und "+ Character" */
    assert(w.titel === "Weeklies" && w.name === w.titel && /^No character yet\./.test(w.satz) && w.neu === "+ Character" && innen(w.symbol) === innen(RAIL.weeklies),
      "9.1 ohne Charakter leer und so gekennzeichnet, benannt nach seiner Ueberschrift", w);
    await bereich(p, "start");
    assert(await p.evaluate(() => document.querySelector("#weeklies").hidden && !document.querySelector("#land").hidden), "9.1 Start fuehrt wieder hinaus");
    await p.close();
    const d = await oeffne({ lang: "de" });
    await bereich(d.page, "weeklies");
    w = await d.page.evaluate(() => ({ titel: document.querySelector("#weeklies h2").textContent, tip: document.querySelector('[data-tab="weeklies"] .btip').textContent,
      satz: document.querySelector("#weeklies .wbox .wksatz")?.textContent || "" }));
    // folgt Spezifikation Weeklies (W3): der deutsche Satz des leeren Felds statt "kommt spaeter"
    assert(w.titel === "Weeklies" && w.tip === "Weeklies" && /^Noch kein Charakter\./.test(w.satz), "9.1 Deutsch: Weeklies, noch kein Charakter", w);
    // ein Kampf aus der Kampfwahl verlaesst Weeklies
    await beispiel(d.page);
    await bereich(d.page, "weeklies");
    await d.page.keyboard.press("Control+K");
    await d.page.keyboard.press("Enter");
    await d.page.waitForTimeout(200);
    assert(await d.page.evaluate(() => document.querySelector("#weeklies").hidden && !document.querySelector("#app").hidden), "9.1 ein Kampf aus der Kampfwahl verlaesst Weeklies");
    /* Builds: der Bereich zeigt die Builds - seit Aufgabe 7 eine eigene Flaeche (#p-builds, Luecken 8.1;
       folgt Entwurf, vorher der Abschnitt aus dem Verlauf), mit einem eigenen Log (das Beispiel legt keine Builds an) */
    await mitLog(d);
    await bereich(d.page, "builds");
    const b = await d.page.evaluate(() => ({ panel: document.querySelector(".panel.on")?.id, bau: document.querySelector("#bauBody").getClientRects().length > 0,
      verlauf: document.querySelector("#histWrap").getClientRects().length + document.querySelector("#histNote").getClientRects().length,
      aktuell: document.querySelector('#bereiche .tab[aria-current="page"]')?.dataset.tab }));
    assert(b.panel === "p-builds" && b.bau && b.verlauf === 0 && b.aktuell === "builds", "Builds: eigener Eintrag und eigene Flaeche, zeigt die Builds ohne den Verlauf", b);
    const ueb = await d.page.evaluate(() => document.querySelector("#p-builds > h2.vh")?.textContent);
    assert(ueb === "Builds", "Builds: die Ueberschrift der Flaeche heisst fuer den Vorleser Builds (Pruefung Befund 5)", ueb);
    await bereich(d.page, "history");
    /* Folgt Entwurf (Neugestaltung 28.09., Luecken 6): mit einem Verlauf steht statt des
       Einleitungssatzes das Diagramm (#histWrap); der Satz nur, solange er leer ist. */
    const h = await d.page.evaluate(() => ({ bau: document.querySelector("#bauBody").getClientRects().length > 0,
      verlauf: document.querySelector("#histWrap").getClientRects().length > 0 && !document.querySelector("#histNote").getClientRects().length,
      ueb: document.querySelector("#p-history > h2.vh")?.textContent }));
    // seit Aufgabe 7 ohne "Deine Builds" darunter (Luecken 8.1)
    assert(!h.bau && h.verlauf && h.ueb === "Verlauf", "Verlauf mit Diagramm, ohne Deine Builds, heisst Verlauf", h);
    assert(!d.fehler.length, "Weeklies und Builds: keine Fehler auf der Seite", d.fehler);
    await d.page.close();
  }

  // --- 0.23, 0.24: Statusleiste
  {
    const s = await oeffne({ lang: "de" });
    const p = s.page;
    await beispiel(p);
    const z = await p.evaluate(() => {
      const f = document.querySelector("#statusleiste");
      const sicht = (q) => { const e = f.querySelector(q); return !!e && e.getClientRects().length > 0; };
      // folgt der Wahl vom 01.10.: "Fehler melden" zwischen Datei und Groesse
      const reihe = ["#sbRolle", "#sbLive", ".sbnur", "#sbDatei", "#sbFehler", "#sbZoom", "#sbVer"].map((q) => f.querySelector(q)?.getBoundingClientRect().left ?? -1);
      return { h: f.getBoundingClientRect().height, rolle: document.querySelector("#sbRolle")?.textContent.trim(),
        waffen: f.querySelectorAll("#sbRolle .wic").length, live: f.querySelector("#sbLive")?.textContent.trim(),
        nur: f.querySelector(".sbnur").textContent, datei: document.querySelector("#sbDatei").textContent, zoom: sicht("#sbZoom"),
        anzahl: sicht("#sbAnzahl"), reihe };
    });
    assert(Math.abs(z.h - 26) < 0.5 && z.rolle === "Sp\u00e4her \u00b7 DPS" && z.waffen >= 2, "0.23 Statusleiste: Waffenpaar und Sp\u00e4her \u00b7 DPS", z);
    assert(z.live === "Live aus" && z.nur === "Nur gelesen \u2013 nichts im Spiel" && z.datei === "Beispielkampf" && z.zoom,
      "0.23/0.24 Live, Nur gelesen, Logdatei, Zoom bleibt", z);
    assert(!z.anzahl && z.reihe.every((x, i) => i === 0 || x > z.reihe[i - 1]), "0.24 die Anzahl steht im Kopf der Kampfwahl, nicht mehr unten; Reihenfolge wie im Entwurf", z);
    await p.close();
  }
  {
    // Live-Satz und Ungelesen-Pille (0.21, 0.23): ein neuer Kampf kommt, waehrend man woanders steht
    const ordner = mkdtempSync(join(tmpdir(), "boro-neu-live-"));
    const datei = join(ordner, "TLCombatLog-20260920.txt");
    writeFileSync(datei, logText(PULLS.slice(0, 2)));
    const s = await oeffne({ ordner, lang: "de" });
    const p = s.page;
    await p.evaluate(() => document.querySelector("#btnWatch").click());
    await p.waitForFunction(() => !document.querySelector("#app").hidden, null, { timeout: 10000 });
    await p.waitForTimeout(600);
    let z = await p.evaluate(() => ({ satz: document.querySelector("#sbLive").textContent.trim(), pille: document.querySelector('[data-tab="timeline"] .ungelesen')?.hidden,
      kw: document.querySelector("#kwLive")?.getAttribute("aria-pressed") }));
    assert(z.satz === "Live \u00b7 wartet auf den n\u00e4chsten Kampf" && z.pille === true && z.kw === "true",
      "0.23 Live laeuft: wartet auf den naechsten Kampf; keine Pille fuer das, was schon da war", z);
    await bereich(p, "history");
    appendFileSync(datei, logText([{ target: "Vulcanus", start: at(22, 0, 0), secs: 60, scale: 1.1 }], false));
    await p.waitForFunction(() => !document.querySelector('[data-tab="timeline"] .ungelesen').hidden, null, { timeout: 10000 }).catch(() => {});
    z = await p.evaluate(() => { const u = document.querySelector('[data-tab="timeline"] .ungelesen');
      return { pille: !u.hidden, text: u.textContent, satz: document.querySelector("#sbLive").textContent.trim(),
        name: document.querySelector('[data-tab="timeline"]').textContent }; });
    assert(z.pille && z.text.startsWith("1") && /1 neuer Kampf/.test(z.name), "0.21 neuer Kampf: \u201e1\u201c am Kampf-Symbol, fuer den Vorleser benannt", z);
    assert(/^Live \u00b7 Vulcanus gelesen, gerade eben$/.test(z.satz), "0.23 Live-Satz: Vulcanus gelesen, gerade eben", z);
    /* Pruefung 01.10. (M1): mit Live an lief die Leiste zwischen 640 und 880 Punkt ueber - der Satz und "Fehler melden"
       liessen keinen Platz, rechts wurde die Version abgeschnitten. Jetzt bei jeder Breite, mit Live an und aus: alles ganz
       in der Leiste, Live, Nur gelesen, Fehler melden, Groesse und Version ungekuerzt, die Datei mit mindestens 9 Zeichen Platz. */
    const leisteBei = (pg) => pg.evaluate(() => {
      const f = document.querySelector("#statusleiste"), fr = f.getBoundingClientRect();
      const teile = ["#sbRolle", "#sbLive", ".sbnur", "#sbDatei", "#sbFehler", "#sbZoom", "#sbVer"].map((q) => [q, document.querySelector(q)])
        .filter(([, e]) => e && e.getClientRects().length && e.getBoundingClientRect().width > 0);
      const raus = teile.filter(([, e]) => { const r = e.getBoundingClientRect(); return r.left < fr.left - 0.5 || r.right > fr.right + 0.5; }).map(([q]) => q);
      const gekuerzt = ["#sbLiveText", "#sbFehler", "#sbZoom", "#sbVer", ".sbnur"].map((q) => document.querySelector(q))
        .filter((e) => e && e.getClientRects().length && e.scrollWidth > e.clientWidth + 1).map((e) => e.id || e.className);
      const d = document.querySelector("#sbDatei"), neun = Math.floor(parseFloat(getComputedStyle(d).fontSize) * 0.55 * 9);
      return { b: innerWidth, h: Math.round(fr.height), raus, gekuerzt, datei: Math.round(d.getBoundingClientRect().width), neun,
        an: document.querySelector("#sbLive").classList.contains("on"), quer: document.documentElement.scrollWidth > innerWidth };
    });
    const ueber = async (pg, an) => {
      const falsch = [];
      for (const b of [641, 700, 760, 820, 880]) {
        await pg.setViewportSize({ width: b, height: 860 });
        await pg.waitForFunction((w) => innerWidth === w && document.documentElement.classList.contains("w-max-900"), b);
        const m = await leisteBei(pg);
        if (m.an !== an || m.raus.length || m.gekuerzt.length || m.datei < m.neun || m.h !== 26 || m.quer) falsch.push(m);
      }
      await pg.setViewportSize({ width: 1280, height: 860 });
      return falsch;
    };
    const liveAn = await ueber(p, true);
    assert(!liveAn.length, "M1 Live an, 641 bis 880 Punkt: nichts ragt aus der Leiste, nichts Festes gekuerzt, die Datei behaelt 9 Zeichen", liveAn);
    {
      const aus = await oeffne({ lang: "de" });
      await beispiel(aus.page);
      const f = await ueber(aus.page, false);
      assert(!f.length, "M1 Live aus, 641 bis 880 Punkt: ebenso", f);
      await aus.page.close();
    }
    // 0.22: die Pille ist geglitten
    const sig = await p.evaluate(() => ({ wechsel: document.querySelector("#kwWas").classList.contains("wechsel") }));
    assert(sig.wechsel, "0.22 neuer Kampf: die Pille gleitet (Klasse wechsel)", sig);
    await p.keyboard.press("Control+K");
    await p.keyboard.press("Enter");
    await p.waitForTimeout(200);
    assert(await p.evaluate(() => document.querySelector('[data-tab="timeline"] .ungelesen').hidden), "0.21 weg, sobald man einen Kampf waehlt");
    /* 0.22 im Bereich Kampf: die grosse Zahl zaehlt zu ihrem neuen Wert hoch
       (setHeroDps, 20-meter-head.ts) - mitgeschrieben wird jeder Text, den
       sie dabei traegt; am Ende steht der Wert des neuen Kampfes. */
    /* Neugestaltung 28.09., Nacharbeit: die Probe wartet auf Zustaende statt
       auf ein Zeitfenster. Vorher las sie "vor", waehrend die Zahl noch vom
       vorigen Schritt zaehlen konnte, und wartete fest 1200 ms - der neue
       Kampf kommt aber erst mit dem naechsten Live-Takt (bis zu 2 s). Jetzt:
       Ruhe abwarten (#hDps 400 ms unveraendert), "wechsel" entfernen, auf den
       neuen Kampf warten (eine Zeile mehr in der Kampfliste), wieder Ruhe. */
    const ruhe = async (pg) => {
      for (const ende = Date.now() + 10000; Date.now() < ende;) {
        const a = await pg.evaluate(() => document.querySelector("#hDps").textContent);
        await pg.waitForTimeout(400);
        if (a === await pg.evaluate(() => document.querySelector("#hDps").textContent)) return a;
      }
      return null;
    };
    const zaehlProbe = async (pg, start, secs, scale) => {
      const vorRuhig = await ruhe(pg);
      const vor = await pg.evaluate(() => {
        window.__werte = [];
        window.__kaempfe = document.querySelectorAll("#fightList .fight").length;
        document.querySelector("#kwWas").classList.remove("wechsel");
        new MutationObserver(() => window.__werte.push(document.querySelector("#hDps").textContent))
          .observe(document.querySelector("#hDps"), { childList: true, characterData: true, subtree: true });
        return { text: document.querySelector("#hDps").textContent, wechsel: document.querySelector("#kwWas").classList.contains("wechsel") };
      });
      appendFileSync(datei, logText([{ target: "Vulcanus", start, secs, scale }], false));
      const neu = await pg.waitForFunction(() => document.querySelectorAll("#fightList .fight").length === window.__kaempfe + 1,
        null, { timeout: 10000 }).then(() => true).catch(() => false);
      const endeRuhig = await ruhe(pg);
      return pg.evaluate(([v, r0, r1, n, w0]) => ({ vor: v, vorRuhig: r0 === v, neu: n, wechselVorher: w0,
        werte: [...new Set(window.__werte)], ende: document.querySelector("#hDps").textContent, endeRuhig: r1,
        wechsel: document.querySelector("#kwWas").classList.contains("wechsel") }), [vor.text, vorRuhig, endeRuhig, neu, vor.wechsel]);
    };
    const zaehl = await zaehlProbe(p, at(22, 30, 0), 60, 1.3);
    assert(zaehl.vorRuhig && zaehl.neu && !zaehl.wechselVorher && zaehl.ende !== zaehl.vor && zaehl.werte.length >= 3 &&
      zaehl.werte.at(-1) === zaehl.ende && zaehl.endeRuhig === zaehl.ende && zaehl.wechsel,
      "0.22 neuer Kampf: die grosse Zahl zaehlt hoch, die Pille gleitet", zaehl);
    assert(!s.fehler.length, "Live: keine Fehler auf der Seite", s.fehler);
    await p.close();
    // 0.22 bei weniger Bewegung: alles springt, kein Zwischenwert, keine Gleitklasse
    const r2 = await oeffne({ ordner, lang: "de", ruhig: true });
    await r2.page.evaluate(() => document.querySelector("#btnWatch").click());
    await r2.page.waitForFunction(() => !document.querySelector("#app").hidden, null, { timeout: 10000 });
    await r2.page.waitForTimeout(600);
    const ruhig = await zaehlProbe(r2.page, at(23, 0, 0), 60, 1.4);
    ruhig.satz = await r2.page.evaluate(() => document.querySelector("#sbLive").textContent.trim());
    assert(ruhig.vorRuhig && ruhig.neu && ruhig.endeRuhig === ruhig.ende && ruhig.ende !== ruhig.vor && ruhig.werte.length === 1 && !ruhig.wechsel && /Vulcanus gelesen/.test(ruhig.satz),
      "0.22 weniger Bewegung: die Zahl springt, nichts gleitet, der Satz steht", ruhig);
    // Befund 4: Live aus, dann wieder an - der Satz gehoert zur neuen Sitzung
    await r2.page.evaluate(() => document.querySelector("#btnWatch").click());
    await r2.page.waitForTimeout(300);
    await r2.page.evaluate(() => document.querySelector("#btnSample").click());
    await r2.page.waitForTimeout(400);
    await r2.page.evaluate(() => document.querySelector("#btnWatch").click());
    await r2.page.waitForFunction(() => document.querySelector("#sbLive").classList.contains("on"), null, { timeout: 10000 }).catch(() => {});
    await r2.page.waitForTimeout(600);
    const neuSatz = await r2.page.evaluate(() => document.querySelector("#sbLive").textContent.trim());
    assert(neuSatz === "Live \u00b7 wartet auf den n\u00e4chsten Kampf", "Live aus und wieder an: der Satz der alten Sitzung ist vergessen", neuSatz);
    assert(!r2.fehler.length, "weniger Bewegung: keine Fehler auf der Seite", r2.fehler);
    await r2.page.close();
    rmSync(ordner, { recursive: true, force: true });
  }

  // --- 0.25 und die Pruefgroessen: Inhalt hoechstens 1680, nirgends waagerechtes Rollen
  for (const [breite, hoehe] of [[1280, 860], [1920, 1080], [2000, 1480], [1000, 860], [760, 860], [560, 860]]) {
    const s = await oeffne({ app: breite >= 760, breite, hoehe });
    const p = s.page;
    const startQuer = await quer(p);
    await beispiel(p);
    const m = await p.evaluate(() => {
      const st = document.querySelector(".stage").getBoundingClientRect(), a = document.querySelector("#app").getBoundingClientRect();
      return { app: a.width, links: a.left - st.left, rechts: st.right - a.right, top: document.querySelector("header.top").getBoundingClientRect().height };
    });
    const kampfQuer = await quer(p);
    await p.keyboard.press("Control+K");
    const feld = await r(p, "#kampfwahl");
    const feldQuer = await quer(p);
    await p.keyboard.press("Escape");
    await bereich(p, "weeklies");
    const wQuer = await quer(p);
    assert(!startQuer && !kampfQuer && !feldQuer && !wQuer && feld.left >= 0 && feld.right <= breite,
      `${breite} \u00d7 ${hoehe}: kein waagerechtes Rollen (Start, Kampf, Kampfwahl, Weeklies)`, { startQuer, kampfQuer, feldQuer, wQuer, feld });
    assert(m.app <= 1680 + 0.5 && Math.abs(m.links - m.rechts) < 2, `${breite} \u00d7 ${hoehe}: der Inhalt hoechstens 1680 Punkt, mittig`, m);
    // seit Aufgabe 9 bei jeder Breite einzeilig (0.14, Pruefung M1)
    assert(Math.abs(m.top - 36) < 0.5, `${breite} \u00d7 ${hoehe}: Titelleiste in einer Zeile, 36 Punkt`, m.top);
    assert(!s.fehler.length, `${breite} \u00d7 ${hoehe}: keine Fehler auf der Seite`, s.fehler);
    await p.close();
  }

  // ===== Abschnitt 2: Kampf (Luecken 2) =====
  // --- 2.1, 2.2, 2.3, 2.4, 2.5, 2.6: der Kopf
  {
    const s = await oeffne({ app: true });
    const p = s.page;
    const datei = join(work, "TLCombatLog-20260920-beleg.txt");
    writeFileSync(datei, belegLog());
    await mitLog(s, datei);
    const k = await p.evaluate(() => {
      const r = (e) => e && e.getClientRects().length ? e.getBoundingClientRect().toJSON() : null;
      const q = (x) => document.querySelector(x);
      const fakten = [...document.querySelectorAll("#hMeta [data-f]")].filter((e) => e.getClientRects().length);
      const bild = q("#btnBild"), save = q("#btnSaveRun");
      return { name: q("#hName").textContent, fakten: fakten.map((e) => [e.dataset.f, e.textContent]), meta: q("#hMeta").innerText,
        chips: r(q("#chips")), einordnung: r(q("#einordnung")), hist: r(q("#hHist")), read: r(q("#hRead")),
        histGroesse: parseFloat(getComputedStyle(q("#hHist")).fontSize), readGroesse: parseFloat(getComputedStyle(q("#hRead")).fontSize),
        histText: q("#hHist").textContent, bestImKopf: !!q(".headwrap #btnBestPull"),
        save: r(save), saveSymbol: !!save?.querySelector("svg"), bild: r(bild), bildName: bild?.getAttribute("aria-label") || "",
        bildWort: [...(bild?.querySelectorAll(".blabel") || [])].filter((e) => e.getBoundingClientRect().width > 1).length, headmeta: r(q(".headmeta")),
        // name traegt schon den Text des Bosses (2.1); das Rechteck heisst nameBox
        nameBox: r(q("#hName")), imRing: !!q("#ringRechts #btnSaveRun") };
    });
    assert(/Vulcanus/.test(k.name), "2.1 der Kopf nennt den Boss", k.name);
    assert(JSON.stringify(k.fakten.map((f) => f[0])) === JSON.stringify(["ort", "zeit", "dauer", "schaden", "treffer"]),
      "2.2 Faktenzeile: Ort | Uhrzeit | Dauer | Schaden | Treffer", k.fakten);
    assert(k.fakten[0]?.[1] === "Frostbreath Cave" && k.fakten[1]?.[1] === "20:30" && /^110 hits$/.test(k.fakten[4]?.[1] || ""),
      "2.2 Faktenzeile beginnt mit dem Ort, Treffer am Ende", k.fakten);
    assert(!/Tester/.test(k.meta), "2.2 kein Spielername aus dem Log in der Faktenzeile", k.meta);
    assert(!k.chips, "2.3 keine Werteleiste im Kampf", k.chips);
    assert(!k.einordnung && k.hist && k.read && k.hist.top >= k.read.bottom - 1 && k.histGroesse < k.readGroesse,
      "2.4 Einordnung als leise Zeile unter dem Satz, keine Skala", k);
    assert(!k.bestImKopf, "2.5 kein Knopf „Gegen deinen besten Pull“ im Kopf", k.bestImKopf);
    // folgt Spezifikation Glutring 2: oben rechts im Ringfeld, unter Boss und Fakten
    assert(k.save && k.saveSymbol && k.imRing && k.nameBox && k.save.top >= k.nameBox.bottom - 1, "2.6 „Kampf speichern“ mit Symbol oben rechts", k);
    assert(k.bild && k.bildWort === 0 && k.bildName === "Share as image" && k.bild.width <= 40, "2.6 Teilen als leises Symbol mit Namen", k);
    assert(!s.fehler.length, "Kopf: keine Fehler", s.fehler);

    // --- 2.7, 2.8: Feldkopf und Zeilen
    const t = await p.evaluate(() => {
      const r = (e) => e && e.getClientRects().length ? e.getBoundingClientRect().toJSON() : null;
      const seg = [...document.querySelectorAll("#groupSeg button")].filter((b) => b.getClientRects().length);
      const zeilen = [...document.querySelectorAll("#bars .row:not(.sub)")];
      return { titel: document.querySelector("#tafelKopf h2")?.textContent, zahl: document.querySelector("#tafelZahl")?.textContent,
        segImKopf: !!document.querySelector("#tafelKopf #groupSeg"), seg: seg.map((b) => b.textContent),
        kopf: [...document.querySelectorAll("#bars .bhead [data-k]")].filter((e) => e.getClientRects().length).map((e) => e.dataset.k),
        zeilen: zeilen.map((z) => {
          const f = r(z.querySelector(".fill")), n = r(z.querySelector(".nmt")), nm = r(z.querySelector(".nm")), zr = r(z);
          return { hoch: zr.height, f, n, nm, unten: zr.bottom };
        }) };
    });
    assert(t.titel === "Damage" && t.zahl === "3 skills \u00b7 110 hits" && t.segImKopf, "2.7 Feldkopf: Schaden, Zahl der Faehigkeiten und Treffer, Umschalter rechts", t);
    assert(JSON.stringify(t.seg) === JSON.stringify(["By skill", "Targets"]), "2.7 Umschalter ohne Gruppe: Nach Faehigkeit / Ziele", t.seg);
    // folgt Spezifikation Glutring 4: der Kopf der Liste neben dem Ring
    assert(JSON.stringify(t.kopf) === JSON.stringify(["name", "dps", "share", "hits", "critRate", "heavyRate"]),
      "2.8 Kopf der Liste: Name, DPS, Anteil, Treffer, Kritisch, Stark", t.kopf);
    assert(t.zeilen.length === 3 && t.zeilen.every((z) => Math.abs(z.hoch - 44) < 0.5), "2.8 Zeilen fest 44 Punkt", t.zeilen.map((z) => z.hoch));
    assert(t.zeilen.every((z) => z.f && Math.abs(z.f.height - 4) < 0.5 && z.f.top >= z.n.bottom - 1 && z.f.bottom <= z.unten &&
      Math.abs(z.f.left - t.zeilen[0].f.left) < 0.5), "2.8 der Balken ist eine 4-Punkt-Spur unter Name und DPS, alle an derselben Kante", t.zeilen);

    // --- 2.14, 2.17-2.20: Kurve und Urteil gegen den besten Pull (20:00)
    const u = await p.evaluate(() => {
      const q = (x) => document.querySelector(x);
      const belege = [...document.querySelectorAll("#urteilFeld .ubeleg")].map((b) => ({ text: b.textContent, wert: b.querySelector(".uwert")?.textContent || "",
        name: b.querySelector(".ubname b")?.textContent, was: b.querySelector(".ubname small")?.textContent || "",
        symbol: !!b.querySelector(".sic"),
        farbe: b.querySelector(".ubahn i") ? getComputedStyle(b.querySelector(".ubahn i")).backgroundColor : "", strich: !!b.querySelector(".ubahn b") }));
      const titel = q("#urteilTitel");
      return { satz: q("#urteilFeld .usatz")?.textContent, belege, titelSicht: !!titel && titel.getBoundingClientRect().width > 2,
        region: q("#urteilFeld").getAttribute("aria-labelledby"),
        analyse: q("#urteilAnalyse")?.textContent, vergleichText: q("#btnBestPull")?.textContent,
        vergleichSicht: !!q("#urteilFeld #btnBestPull")?.getClientRects().length,
        leg: [...document.querySelectorAll("#kurveLeg .klg")].map((e) => e.textContent), achse: [...document.querySelectorAll("#kurveAchse .kyl")].map((e) => +e.dataset.v),
        bezug: q("#kurve").dataset.bezug, roh: q("#kurve").dataset.roh, ink: getComputedStyle(document.documentElement).getPropertyValue("--ink-soft") };
    });
    assert(/^.+ missing per second \u2013 mostly on Quick Fire\.$/.test(u.satz || ""), "2.17 Urteil: Schlagzeile nennt Quick Fire", u.satz);
    assert(u.belege.length === 2 && u.belege[0].name === "Quick Fire" && /per hit/.test(u.belege[0].was) &&
      u.belege[1].name === "Strafing" && /per minute/.test(u.belege[1].was), "2.18/2.19 zwei Belege: Quick Fire je Treffer, Strafing je Minute", u.belege);
    assert(u.belege.length === 2 && u.belege.every((b) => b.symbol && b.strich && b.farbe && !/rgba\(0, 0, 0, 0\)/.test(b.farbe)) &&
      u.belege[0].farbe !== u.belege[1].farbe, "2.17 Belege mit Symbol und Name, Balken in Reihenfarbe, Strich beim besten", u.belege);
    // 30 und 40 Treffer in 59,5 Sekunden gekaempfter Zeit
    assert(u.belege[1] && /^30\.\d instead of 40\.\d$/.test(u.belege[1].wert), "2.19 Beleg 2: 30 statt 40 Treffer je Minute", u.belege[1]);
    assert(!u.titelSicht && u.region === "urteilTitel", "2.17 Schlagzeile ohne sichtbare Ueberschrift, das Feld behaelt seinen Namen", u);
    assert(/^Full analysis ›$/.test(u.analyse || "") && u.vergleichSicht && /^In the comparison ›$/.test(u.vergleichText || ""),
      "2.5 im Urteil „Ganze Analyse ›“ und „Im Vergleich ›“", u);
    assert(JSON.stringify(u.leg) === JSON.stringify(["this pull", "best pull"]) && u.bezug === "1" && u.roh === "1",
      "2.14 Kurve: Linienlegende dieser/bester Pull, rohe Linie blass dazu", u);
    assert(u.achse.length >= 3 && rundeSchritte(u.achse), "2.14 y-Achse in runden Schritten ab 0", u.achse);
    await p.click("#btnBestPull");
    const tab = await p.evaluate(() => document.querySelector("#bereiche .tab[aria-current=page]")?.dataset.tab);
    assert(tab === "compare", "2.5 \u201eIm Vergleich \u203a\u201c oeffnet den Vergleich", tab);
    await p.click('#bereiche [data-tab="timeline"]'); await p.waitForTimeout(200);
    /* Pruefung 29.09., Befund 3: die neuen Texte der Tafel nicht unter 11 Punkt */
    const klein = await p.evaluate(() => ["#kurveLeg .klg", "#kurveAchse .kyl", "#urteilFeld .ubname small"]
      .flatMap((q) => [...document.querySelectorAll(q)].map((e) => [q, parseFloat(getComputedStyle(e).fontSize)])));
    assert(klein.length >= 5 && klein.every(([, g]) => g >= 11), "Legende, y-Achse und Belegmass mindestens 11 Punkt", klein);
    /* Befund 7: mit Bezug bei 1280 x 860 stehen beide Knoepfe des Urteils ueber der Statusleiste,
       und das Raster rollt nicht in sich (Nachpruefung 29.09.: vorher rollte #app, die Knoepfe
       standen nur scheinbar im Bild) - mindestens 8 Punkt ueber der Unterkante von #app */
    const kn = await p.evaluate(() => { const app = document.querySelector("#app");
      return { sb: document.querySelector("#statusleiste").getBoundingClientRect().top, appUnten: app.getBoundingClientRect().bottom,
        rollt: app.scrollHeight > app.clientHeight + 1,
        knoepfe: ["#urteilAnalyse", "#btnBestPull"].map((q) => document.querySelector(q).getBoundingClientRect().bottom) }; });
    assert(kn.knoepfe.every((b) => b <= kn.sb && b <= kn.appUnten - 8) && !kn.rollt,
      "1280 \u00d7 860 mit Bezug: \u201eGanze Analyse\u201c und \u201eIm Vergleich\u201c ueber der Statusleiste, #app rollt nicht", kn);
    await p.close();
  }
  // --- 2.18: Beleg 1 ist der groesste Verlust je Treffer, nicht der groesste DPS-Abstand
  /* Nachpruefung 29.09. (Punkt B): Quick Fire verliert nur Treffer (20 statt
     40, groesster DPS-Abstand - ihn nennt die Schlagzeile), Strafing nur
     Schaden je Treffer (8000 statt 10000). Beleg 1 nennt Strafing je Treffer
     (urteilZahlen().erst), Beleg 2 Quick Fire je Minute. */
  {
    const lines = ["CombatLogVersion,4"];
    const reihe = [["Quick Fire", 964762401], ["Strafing", 945674044], ["Detonation Mark", 953174691]];
    for (const [start, schwach] of [[at(20, 0, 0), false], [at(20, 30, 0), true]]) {
      for (let k = 0; k < 120; k++) {
        const [skill, sid] = reihe[k % 3];
        if (schwach && skill === "Quick Fire" && Math.floor(k / 3) % 2 === 1) continue;
        const dmg = (schwach && skill === "Strafing" ? 8000 : 10000) + 100 * ((k % 5) - 2);
        lines.push(`${stamp(start + k * 500)},DamageDone,${skill},${sid},${dmg},0,0,kNormalHit,Tester,Vulcanus`);
      }
    }
    const datei = join(work, "TLCombatLog-20260920-erst.txt");
    writeFileSync(datei, lines.join("\n") + "\n");
    const s = await oeffne({ app: true }); const p = s.page; await mitLog(s, datei);
    const u = await p.evaluate(() => ({ satz: document.querySelector("#urteilFeld .usatz")?.textContent || "",
      belege: [...document.querySelectorAll("#urteilFeld .ubeleg")].map((b) => [b.querySelector(".ubname b")?.textContent,
        b.querySelector(".ubname small")?.textContent, b.querySelector(".uwert")?.textContent]) }));
    assert(/mostly on Quick Fire\.$/.test(u.satz) && u.belege.length === 2 &&
      u.belege[0][0] === "Strafing" && /per hit/.test(u.belege[0][1] || "") && /^8\.0k instead of 10\.0k$/.test(u.belege[0][2] || "") &&
      u.belege[1][0] === "Quick Fire" && /per minute/.test(u.belege[1][1] || ""),
      "2.18 Schlagzeile am DPS-Abstand (Quick Fire), Beleg 1 der groesste Verlust je Treffer (Strafing), Beleg 2 je Minute", u);
    assert(!s.fehler.length, "2.18: keine Fehler", s.fehler);
    await p.close();
  }
  // --- 2.20: ohne Bezug der Satz der Analyse, kein Knopf zum Vergleich
  {
    const s = await oeffne({ app: true }); const p = s.page; await beispiel(p);
    const u = await p.evaluate(() => ({ uv: document.querySelector("#urteilFeld .uv")?.textContent || "",
      vergleich: !!document.querySelector("#btnBestPull")?.getClientRects().length, analyse: !!document.querySelector("#urteilAnalyse")?.getClientRects().length,
      leg: [...document.querySelectorAll("#kurveLeg .klg")].map((e) => e.textContent) }));
    assert(u.uv && !u.vergleich && u.analyse && JSON.stringify(u.leg) === JSON.stringify(["this pull"]), "2.20 ohne besten Pull: Satz der Analyse, nur „Ganze Analyse“", u);
    // folgt Spezifikation Glutring 4: die staerkste Faehigkeit offen, vier Trefferarten mit Zahl der Treffer und Schaden
    const a = await p.evaluate(() => {
      const erste = document.querySelector("#bars .row:not(.sub)");
      return { offen: erste.getAttribute("aria-expanded"),
        arten: [...document.querySelectorAll("#bars .row.catrow")].map((z) => [z.dataset.cat, z.querySelector('[data-k="hits"]')?.textContent || "",
          z.querySelector('[data-k="damage"]')?.textContent || ""]),
        subHoch: [...document.querySelectorAll("#bars .row.sub")].map((z) => z.getBoundingClientRect().height) };
    });
    assert(a.offen === "true" && JSON.stringify(a.arten.slice(0, 4).map((x) => x[0])) === JSON.stringify(["normal", "crit", "heavy", "critheavy"]) &&
      a.arten.every((x) => /^\d+ hits?$/.test(x[1]) && /\d/.test(x[2])), "2.9 die staerkste Faehigkeit offen, vier Trefferarten mit Zahl der Treffer und Schaden", a);
    assert(a.subHoch.every((h) => h <= 44), "2.9 auch Unterzeilen hoechstens 44 Punkt", a.subHoch);
    // --- 2.10: Skillkern-Symbol von questlog (Klingensturm im Beispielkampf)
    const kern = await p.evaluate(() => {
      const z = [...document.querySelectorAll("#bars .row[data-skill]")].find((x) => /Blade Storm|Klingensturm/.test(x.dataset.skill));
      const b = z?.querySelector(".cmark img"), g = z?.querySelector(".cmark svg");
      return { da: !!z, src: b?.getAttribute("src")?.slice(0, 23) || "", titel: z?.querySelector(".cmark")?.title || "", hoch: b ? b.getBoundingClientRect().height : 0,
        marke: !!g && g.getBoundingClientRect().width > 0 && getComputedStyle(g).display !== "none",
        markeHoch: z?.querySelector(".cmark")?.getBoundingClientRect().height || 0, steinHoch: g ? g.getBoundingClientRect().height : 0 };
    });
    assert(BILDER ? kern.da && kern.src === "data:image/webp;base64," && /Skill Core/.test(kern.titel) && Math.abs(kern.hoch - 18) < 0.5
      : kern.da && !kern.src && /Skill Core/.test(kern.titel) && kern.marke && Math.abs(kern.markeHoch - 18) < 0.5 && Math.abs(kern.steinHoch - 13) < 0.5,
      "2.10 Klingensturm traegt das Kern-Symbol (18 Punkt) mit dem Tooltip wie bisher" + (BILDER ? "" : " (ohne Spielbilder: die gezeichnete Marke, 18 Punkt, der Stein 13)"), kern);
    const eingebettet = new Set([...html.matchAll(/data:image\/webp;base64,([A-Za-z0-9+\/=]+)/g)].map((m) => createHash("sha256").update(m[1]).digest("hex")));
    assert(Object.keys(KERNE_SHA).length === 2 && (BILDER ? Object.values(KERNE_SHA).every((h) => eingebettet.has(h)) : Object.values(KERNE_SHA).every((h) => !eingebettet.has(h))),
      BILDER ? "2.10 beide Kern-Symbole des Entwurfs sind in der Seite eingebettet" : "2.10 ohne Spielbilder: kein Kern-Symbol in der Seite", Object.keys(KERNE_SHA));
    await p.close();
  }
  {
    const s = await oeffne({ app: true, breite: 1000 }); const p = s.page; await beispiel(p);
    const offen = await p.evaluate(() => document.querySelector("#bars .row:not(.sub)").getAttribute("aria-expanded"));
    // folgt Spezifikation Glutring 4 (E 4): die staerkste ist bei jeder Breite offen
    assert(offen === "true", "2.9 auch bei 1000 Punkt ist die staerkste Faehigkeit offen", offen);
    await p.close();
  }
  // --- 2.11, 2.12: Ziele und Gruppe (nur bei laufender Gruppe, Mitglieder mit ihren vier Trefferarten)
  {
    const arten = [["normal", 40000, 10], ["crit", 60000, 8], ["heavy", 30000, 4], ["critheavy", 90000, 6]];
    const faehigkeit = { name: "Quick Fire", sid: "964762401", damage: 220000, dps: 3667, hits: 28, crit: 14, heavy: 10, max: 16000,
      cats: arten.map(([k, d, h]) => ({ k, d, h, m: d / h })) };
    const mitglied = { name: "Mitglied Eins", waiting: false, damage: 220000, dps: 3667, hits: 28, crit: 14, heavy: 10, seconds: 60, max: 16000,
      skills: [faehigkeit], hasCurve: false, share: 1, onTarget: true, target: "Vulcanus", lang: "en", weapons: ["Crossbow", "Longbow"], ventius: false, age: 0 };
    const s = await oeffne({ app: true, gruppe: { role: "host", code: "QX7K", board: [mitglied], target: "Vulcanus", error: "" } });
    const p = s.page;
    await mitLog(s);
    await p.waitForFunction(() => !!document.querySelector("#segParty")?.getClientRects().length, null, { timeout: 8000 }).catch(() => {});
    const seg = await p.evaluate(() => [...document.querySelectorAll("#groupSeg button")].filter((b) => b.getClientRects().length).map((b) => b.textContent));
    assert(JSON.stringify(seg) === JSON.stringify(["By skill", "Targets", "Group"]), "2.12 bei laufender Gruppe: Nach Faehigkeit / Ziele / Gruppe", seg);
    await p.click('#groupSeg [data-g="target"]'); await p.waitForTimeout(150);
    const ziele = await p.evaluate(() => ({ zahl: document.querySelector("#tafelZahl")?.textContent,
      hoch: [...document.querySelectorAll("#bars .row:not(.sub)")].map((z) => z.getBoundingClientRect().height) }));
    assert(/^1 target \u00b7 \d+ hits$/.test(ziele.zahl || "") && ziele.hoch.length && ziele.hoch.every((h) => Math.abs(h - 44) < 0.5), "2.11 Ziele: eine Zeile je Ziel, gleicher Aufbau", ziele);
    await p.click("#segParty"); await p.waitForTimeout(200);
    // folgt Spezifikation Glutring 5: ein Klick auf das Mitglied oeffnet seinen Ring; seine Faehigkeit klappt die vier Trefferarten vom Board auf
    const zahlGruppe = await p.evaluate(() => document.querySelector("#tafelZahl")?.textContent);
    await p.evaluate(() => document.querySelector('#bars .row[data-member="Mitglied Eins"]')?.click()); await p.waitForTimeout(150);
    await p.evaluate(() => document.querySelector('#bars .row[data-open="Quick Fire"]')?.click()); await p.waitForTimeout(150);
    const g = await p.evaluate(() => ({ zahl: document.querySelector("#tafelZahl")?.textContent,
      arten: [...document.querySelectorAll("#bars .row.catrow")].map((z) => z.dataset.cat) }));
    assert(JSON.stringify(g.arten.slice().sort()) === JSON.stringify(["crit", "critheavy", "heavy", "normal"]),
      "2.12 im Ring des Mitglieds: seine Faehigkeit zeigt die vier Trefferarten vom Board", g);
    assert(/^1 member \u00b7 from the board$/.test(zahlGruppe || ""), "2.12 Feldkopf der Gruppe: Mitglieder ueber das Board", zahlGruppe);
    assert(!s.fehler.length, "Gruppe: keine Fehler", s.fehler);
    await p.close();
  }
  // --- 2.13: Nach Waffe nur im Entwicklermodus
  {
    const s = await oeffne({ app: true }); const p = s.page; await mitLog(s);
    const vor = await p.evaluate(() => !!document.querySelector("#segWeapon")?.getClientRects().length);
    await p.evaluate(() => document.querySelector("#eDev").click()); await p.waitForTimeout(150);
    const nach = await p.evaluate(() => [...document.querySelectorAll("#groupSeg button")].filter((b) => b.getClientRects().length).map((b) => b.textContent));
    assert(!vor && JSON.stringify(nach) === JSON.stringify(["By skill", "By weapon", "Targets"]), "2.13 Nach Waffe nur im Entwicklermodus", { vor, nach });
    await p.close();
  }
  // --- 2.14, 2.15, 2.21: Groessen - Liste 340 bis 400 Punkt neben dem Ringfeld, Band zu bei jeder Hoehe (folgt Spezifikation Glutring 2 und 7)
  for (const [breite, hoehe] of [[1280, 860], [1920, 1080], [2000, 1480], [1000, 860], [760, 860], [560, 860]]) {
    const s = await oeffne({ app: true, breite, hoehe }); const p = s.page; await beispiel(p);
    const m = await p.evaluate(() => {
      const r = (e) => e && e.getClientRects().length ? e.getBoundingClientRect().toJSON() : null;
      const sicht = (k) => { const e = document.querySelector(`#bars .row:not(.sub) [data-k="${k}"]`); return !!e && getComputedStyle(e).display !== "none"; };
      return { tafel: r(document.querySelector(".table")), kurveF: r(document.querySelector("#kurveFeld")), kurve: r(document.querySelector("#kurve")), ring: r(document.querySelector("#ringFeld")),
        auf: document.querySelector("#zeitAuf").getAttribute("aria-expanded"), knopf: r(document.querySelector("#zeitAuf")),
        linien: document.querySelector("#kurve").dataset.linien, quer: document.documentElement.scrollWidth > innerWidth,
        steuert: document.querySelector("#zeitAuf").getAttribute("aria-controls"),
        spuren: [document.querySelector("#spurenAuf")?.getAttribute("aria-controls"), document.querySelector("#spurenAuf")?.getAttribute("aria-expanded"),
          document.querySelector("#spurenAuf")?.textContent.trim(), !!document.querySelector("#spurenAuf")?.getClientRects().length],
        stapel: !!document.querySelector("#p-timeline").getClientRects().length || !!document.querySelector("#stack").getClientRects().length,
        rollt: document.scrollingElement.scrollHeight > innerHeight + 1 || document.querySelector("#app").scrollHeight > document.querySelector("#app").clientHeight + 1,
        reihen: [...document.querySelectorAll("#kurveReihen span")].map((e) => parseFloat(getComputedStyle(e).fontSize)),
        zeilen: [...document.querySelectorAll("#bars .row:not(.sub)")].map((z) => z.getBoundingClientRect().height),
        hits: sicht("hits"), heavy: sicht("heavyRate"), crit: sicht("critRate") };
    });
    const wo = `${breite} \u00d7 ${hoehe}`;
    assert(!m.quer, `2.21 ${wo}: kein waagerechtes Rollen`, m);
    assert(m.zeilen.length && m.zeilen.every((h) => h <= 44 + 0.5), `2.8 ${wo}: Zeilen hoechstens 44 Punkt, nichts gestreckt`, m.zeilen);
    if (breite >= 1280) {
      // folgt Spezifikation Glutring 7 (E 9): die Liste 340 bis 400 Punkt rechts neben dem Ringfeld
      const soll = Math.min(400, Math.max(340, 233 + breite * 0.0834));
      assert(m.tafel && m.ring && Math.abs(m.tafel.width - soll) <= 1.5 && m.tafel.left >= m.ring.right - 1, `2.21 ${wo}: die Liste ${Math.round(soll)} Punkt rechts neben dem Ringfeld`, m);
      assert(m.zeilen.every((h) => Math.abs(h - 44) < 0.5), `2.8 ${wo}: Zeilen 44 Punkt`, m.zeilen);
      // folgt Spezifikation Glutring 2: die Knoepfe stehen im Kopf des Bands, ueber der Kurve
      assert(m.knopf && m.kurve && m.kurveF && m.knopf.bottom <= m.kurve.top + 0.5 && m.knopf.top >= m.kurveF.top - 0.5, `2.15 ${wo}: „Zeitverlauf ausklappen“ im Kopf des Bands`, m);
      assert(m.steuert === "kurveFeld" && m.spuren[0] === null && m.spuren[1] === null && m.spuren[2] === "Timeline and rotation \u203a" && m.spuren[3] && !m.stapel,
        `2.16 ${wo}: der Knopf der Kurve steuert das Band, der gestapelte Zeitverlauf hat einen eigenen Knopf und steht nicht im Kampf`, m);
      // folgt Spezifikation Glutring 2 (E 10): das Band ist zu bei jeder Hoehe, auch bei 1480 Punkt
      assert(m.auf === "false" && Math.abs(m.kurve.height - 78) <= 1 && m.linien === "0" && !m.rollt, `2.14 ${wo}: das Band zu, die Kurve 78 Punkt, nichts rollt`, m);
    }
    /* folgt Spezifikation Glutring 4 und 7 (E 8): nebeneinander ab 900 Punkt, darunter gestapelt; die Liste hat bei
       jeder Breite alle sechs Spalten (aus Aufgabe 3) */
    if (breite === 1000) assert(m.ring && m.tafel.left >= m.ring.right - 1 && m.hits && m.heavy && m.crit, `2.21 ${wo}: nebeneinander (ab 900), die Liste mit allen Zellen`, m);
    if (breite === 760) assert(m.ring && m.ring.bottom <= m.tafel.top + 1 && m.tafel.bottom <= m.kurveF.top + 1 && m.hits && m.heavy && m.crit,
      `2.21 ${wo}: gestapelt Ringfeld, Liste, Band, die Liste mit allen Zellen`, m);
    assert(!s.fehler.length, `${wo}: keine Fehler`, s.fehler);
    await p.close();
  }
  // Zeitverlauf (folgt Spezifikation Glutring 2, E 10): zu bei jeder Hoehe; wer ihn selbst aufklappt, dem bleibt er offen
  {
    const s = await oeffne({ app: true, breite: 2000, hoehe: 1480 }); const p = s.page; await beispiel(p);
    const vor = await p.evaluate(() => document.querySelector("#zeitAuf").getAttribute("aria-expanded"));
    await p.click("#zeitAuf"); await p.waitForTimeout(150);
    const offen = await p.evaluate(() => ({ auf: document.querySelector("#zeitAuf").getAttribute("aria-expanded"),
      linien: document.querySelector("#kurve").dataset.linien, hoch: document.querySelector("#kurve").getBoundingClientRect().height,
      reihen: [...document.querySelectorAll("#kurveReihen span")].map((e) => parseFloat(getComputedStyle(e).fontSize)),
      rollt: document.scrollingElement.scrollHeight > innerHeight + 1 || document.querySelector("#app").scrollHeight > document.querySelector("#app").clientHeight + 1,
      stapel: !!document.querySelector("#p-timeline").getClientRects().length || !!document.querySelector("#stack").getClientRects().length }));
    /* aus der alten Probe 2.15 (Pruefung 29.09.): aufgeklappt erscheint nichts doppelt, nichts rollt, und die Legende
       der vier Linien hat mindestens 11 Punkt Schrift */
    assert(!offen.stapel && !offen.rollt && offen.reihen.length === 4 && offen.reihen.every((g) => g >= 11),
      "2.15 aufgeklappt: nichts doppelt, nichts rollt, Legende der vier Linien mindestens 11 Punkt", offen);
    await p.click('#bereiche [data-tab="analysis"]'); await p.waitForTimeout(150);
    await p.click('#bereiche [data-tab="timeline"]'); await p.waitForTimeout(150);
    const auf = await p.evaluate(() => document.querySelector("#zeitAuf").getAttribute("aria-expanded"));
    assert(vor === "false" && offen.auf === "true" && offen.linien === "4" && Math.abs(offen.hoch - 200) <= 1 && auf === "true",
      "2.15 zu bei 1480 Punkt Hoehe; selbst aufgeklappt (vier Linien, 200 Punkt) bleibt es ueber einen Bereichswechsel offen", { vor, offen, auf });
    // der gestapelte Zeitverlauf (Spuren, Zoom, Von/bis) nur auf eigenen Klick - folgt Aufgabe 10: im Bereich Rotation
    await p.click("#spurenAuf");
    await p.waitForFunction(() => document.querySelector('#bereiche [data-tab="rotation"]').getAttribute("aria-current") === "page" &&
      !!document.querySelector("#stackLanes")?.width, null, { timeout: 4000 }).catch(() => {});
    const st = await p.evaluate(() => ({ bereich: document.querySelector('#bereiche [data-tab="rotation"]').getAttribute("aria-current"),
      breite: document.querySelector("#stack").getBoundingClientRect().width, zoom: !!document.querySelector("#p-rotation .vfrom")?.getClientRects().length }));
    assert(st.bereich === "page" && st.breite > 300 && st.zoom, "2.16 eigener Knopf: fuehrt zu Spuren mit Zoom und Von/bis (im Bereich Rotation)", st);
    await p.close();
  }

  // ===== Abschnitt 3: Rotation (Luecken 3) =====
  const ROT_LOG = join(work, "TLCombatLog-20260920-rotation.txt");
  writeFileSync(ROT_LOG, rotLog());
  // Fixrunde 1: auf den Zustand warten, nicht auf eine feste Zeit
  const zuRotation = async (s, datei = ROT_LOG) => { await mitLog(s, datei); await bereich(s.page, "rotation");
    await s.page.waitForFunction(() => !!document.querySelector("#deineRot:not([hidden]) #drGed [role=row]")); };
  /* Was die Rotation zeigt: Kopf, Steuerzeile, Satz, Leiste, Kasten, Tabelle "Einsaetze". */
  const rotBlick = (p) => p.evaluate(() => {
    const q = (x) => document.querySelector(x);
    const r = (e) => e && e.getClientRects().length ? e.getBoundingClientRect().toJSON() : null;
    const sicht = (e) => !!e && e.getClientRects().length > 0 && getComputedStyle(e).display !== "none" && getComputedStyle(e).visibility !== "hidden";
    const tab = q("#drGed");
    const kopfzellen = tab ? [...tab.querySelectorAll('[role="columnheader"]')] : [];
    const zeilen = tab ? [...tab.querySelectorAll('.drzeile[role="row"]')] : [];
    const syms = [...document.querySelectorAll("#rotBar .drsym:not(.geht)")];
    return {
      kopf: q("#bereichKopf")?.innerText || "", kopfAlle: sicht(q("#bereichKopf #rotShowAll")),
      steuer: r(q("#drSteuer")), play: r(q("#drPlay")), jetzt: r(q("#drJetzt")), jetztIn: !!q("#drSteuer #drJetzt"),
      uhr: q("#drUhr")?.textContent || "", uhrGross: parseFloat(getComputedStyle(q("#drUhr")).fontSize),
      steuerText: q("#drSteuer")?.innerText || "",
      tempo: [...document.querySelectorAll("#drTempo button")].map((b) => [b.textContent.trim(), b.getAttribute("aria-pressed")]),
      lead: q("#deineRotLead")?.textContent || "",
      buehne: r(q("#deineRotScroll")), rollt: q("#deineRotScroll").scrollWidth > q("#deineRotScroll").clientWidth + 1,
      tops: [...new Set(syms.map((e) => parseFloat(e.style.top)))].length, symW: syms.filter((e) => !e.classList.contains("jetzt")).map((e) => Math.round(e.getBoundingClientRect().width)),
      syms: syms.map((e) => e.dataset.k), striche: document.querySelectorAll("#rotBar .drstrich").length,
      still: [...document.querySelectorAll("#rotBar .drstill")].map((e) => {
        const l = e.querySelector("span, b"), cs = l ? getComputedStyle(l) : null;
        return { text: e.textContent, w: e.getBoundingClientRect().width, label: l ? l.getBoundingClientRect().width : 0,
          groesse: cs ? parseFloat(cs.fontSize) : 0, sicht: !!l && sicht(l) && l.getBoundingClientRect().width > 0 && getComputedStyle(e).overflow !== "hidden" };
      }),
      kasten: r(q("#drAutoKasten")), tabelle: r(tab), rolle: tab?.getAttribute("role") || "",
      titel: q("#drGedTitel")?.textContent || "",
      spalten: kopfzellen.filter(sicht).map((e) => e.textContent.trim()),
      spaltenBreit: kopfzellen.filter(sicht).map((e) => e.getBoundingClientRect().width),
      zeilen: zeilen.map((z) => {
        const zellen = [...z.querySelectorAll(':scope > [role="cell"]')];
        /* Fixrunde 1, folgt Entwurf (src.js rotation, .auge): das Auge ist ein eigener kleiner Knopf mit
           aria-label, Symbol und Name stehen daneben als Text - gelesen wird darum aus der Zeile */
        const knopf = z.querySelector(".rotgz"), auge = knopf?.querySelector("svg"), sym = z.querySelector(".sic"), name = z.querySelector("em");
        const takt = z.querySelector(".drstriche"), kr = knopf ? knopf.getBoundingClientRect() : null;
        return { k: z.dataset.k, hoch: z.getBoundingClientRect().height, aus: z.classList.contains("aus"),
          werte: zellen.slice(2).filter(sicht).map((c) => c.textContent.trim()),
          striche: takt ? takt.querySelectorAll("i").length : -1, taktSicht: sicht(takt), taktOp: takt ? +getComputedStyle(takt).opacity : -1,
          nameOp: name ? +getComputedStyle(name).opacity : -1,
          augeVorSym: !!auge && !!sym && !!(auge.compareDocumentPosition(sym) & Node.DOCUMENT_POSITION_FOLLOWING),
          augeW: auge ? auge.getBoundingClientRect().width : 0, gedrueckt: knopf?.getAttribute("aria-pressed"),
          nurAuge: !!knopf && !knopf.querySelector(".sic, em") && !knopf.textContent.trim() && !!kr && kr.width <= 24 && kr.height <= 24,
          label: knopf?.getAttribute("aria-label") || "", name: name?.textContent || "" };
      }),
      wer: sicht(q("#rotWhoBar")), werText: q("#rotWhoBar")?.innerText || "", werTop: r(q("#rotWhoBar")),
      quer: document.documentElement.scrollWidth > innerWidth,
      /* Fixrunde 1 (Checkliste 4): jeder sichtbare Text in der Rotation und in ihrem Teil der Kopfzeile
         mindestens 11 Punkt; Texte nur fuer Vorleser (.vh) zaehlen nicht */
      klein: [...["#deineRot", "#bkRot"]].flatMap((w) => {
        const box = q(w); if (!box) return [];
        const raus = [], it = document.createTreeWalker(box, NodeFilter.SHOW_TEXT);
        for (let n; (n = it.nextNode()); ) {
          const e = n.parentElement;
          if (!n.textContent.trim() || !e || e.closest(".vh") || !e.getClientRects().length || !sicht(e)) continue;
          const g = parseFloat(getComputedStyle(e).fontSize);
          if (g < 11) raus.push(n.textContent.trim().slice(0, 20) + ":" + g);
        }
        return raus;
      }),
      steuerStill: !!q("#drSteuer")?.classList.contains("still"), steuerOp: q("#drSteuer") ? +getComputedStyle(q("#drSteuer")).opacity : -1,
      playAus: !!q("#drPlay")?.disabled, tempoAus: [...document.querySelectorAll("#drTempo button")].every((b) => b.disabled),
      jetztText: q("#drJetzt")?.textContent || "",
    };
  });
  // --- 3.1 bis 3.10 an einem erzeugten Kampf (Englisch, 1280 x 860)
  let ohneGruppeWer = null;
  {
    const s = await oeffne({ app: true });
    const p = s.page;
    await zuRotation(s);
    let b = await rotBlick(p);
    // 3.1: der Kopf nennt die Einsaetze, ohne Ausgeblendete kein "alle zeigen"
    assert(/\b172 casts\b/.test(b.kopf) && !b.kopfAlle, "3.1 der Kopf nennt die gedrueckten Einsaetze (172), ohne Ausgeblendete kein \u201eshow all\u201c", b.kopf);
    // 3.2: Steuerzeile - Abspielen, Tempo, grosse Uhr mit Gesamtdauer, Jetzt-Karte rechts in derselben Zeile
    assert(b.jetztIn && b.jetzt && b.play && Math.abs(b.jetzt.right - b.steuer.right) < 24 && b.jetzt.top < b.play.bottom && b.jetzt.bottom > b.play.top,
      "3.2 Jetzt steht rechts in der Steuerzeile, neben Abspielen", b);
    assert(/^0:00\.0$/.test(b.uhr) && b.uhrGross >= 24 && /\/ 1:02\.\d/.test(b.steuerText), "3.2 die Uhr gross mit Zehnteln, daneben die Dauer des Kampfs", { uhr: b.uhr, gross: b.uhrGross, text: b.steuerText });
    // 3.3: Tempo 1x 2x 4x (DECISION 3.3), 1x gewaehlt
    assert(JSON.stringify(b.tempo) === JSON.stringify([["1\u00d7", "true"], ["2\u00d7", "false"], ["4\u00d7", "false"]]), "3.3 Tempo 1\u00d7 2\u00d7 4\u00d7, 1\u00d7 gewaehlt", b.tempo);
    // 3.4: der Satz nennt die automatischen und sagt, was Stille ist
    assert(/without Deadly Viper, which deals damage on its own\./.test(b.lead) && /idle time: at least 2\u00a0s without a pressed cast/.test(b.lead),
      "3.4 der Satz nennt Deadly Viper und definiert die Stille (mindestens 2\u00a0s)", b.lead);
    // 3.5: der ganze Kampf auf der Breite, 32-Punkt-Symbole, drei Bahnen, der Rest als Strich, Stille mit Zehnteln
    /* Fixrunde 1: auf Zehntel gerundet wie secs1 (Entscheidung vom 29.09., an Claude
       uebertragen) - die krumme Stille von 2,96 s zeigt "3.0 s", abgeschnitten waere sie "2.9 s" */
    assert(!b.rollt && b.tops === 3 && b.symW.length && b.symW.every((w) => w === 32) && b.striche === 172 && b.syms.length < 172 &&
      JSON.stringify(b.still.map((x) => x.text)) === JSON.stringify(["2.5\u00a0s", "3.0\u00a0s"]) && b.still.every((x) => x.sicht),
      "3.5 ganzer Kampf ohne Rollen, 32-Punkt-Symbole in 3 Bahnen, der Rest als Strich, die Stille-Marken auf Zehntel gerundet: \u201e2.5\u00a0s\u201c, \u201e3.0\u00a0s\u201c",
      { rollt: b.rollt, tops: b.tops, striche: b.striche, syms: b.syms.length, still: b.still });
    assert(!b.klein.length, "Checkliste 4: jeder Text der Rotation mindestens 11 Punkt", b.klein);
    // 3.7: das Feld "Einsaetze" - Tabelle, Spalten, Zeilen hoechstens 44 Punkt, Takt die breite Spalte, Namen etwa 300 Punkt
    assert(b.rolle === "table" && b.titel === "Casts" && JSON.stringify(b.spalten) === JSON.stringify(["Skill", "Timing", "Casts", "per minute", "\u00d8 gap", "Hits per cast"]),
      "3.7 Tabelle \u201eCasts\u201c: Skill | Timing | Casts | per minute | \u00d8 gap | Hits per cast", { rolle: b.rolle, titel: b.titel, spalten: b.spalten });
    assert(b.zeilen.length === 4 && b.zeilen.every((z) => z.hoch <= 44 + 0.5) && b.spaltenBreit[1] === Math.max(...b.spaltenBreit) && b.spaltenBreit[0] >= 280 && b.spaltenBreit[0] <= 320,
      "3.7 vier Zeilen hoechstens 44 Punkt, Takt am breitesten, Namensspalte etwa 300 Punkt", { zeilen: b.zeilen.map((z) => z.hoch), breit: b.spaltenBreit });
    const qf = b.zeilen.find((z) => z.k === "Quick Fire"), st = b.zeilen.find((z) => z.k === "Strafing"), dm = b.zeilen.find((z) => z.k === "Detonation Mark");
    const jm = qf ? parseFloat(qf.werte[1]) : NaN;
    assert(!!qf && qf.werte[0] === "11" && jm > 10 && jm < 11.5 && qf.werte[2] === "2.0\u00a0s" && qf.werte[3] === "2.0" && qf.striche === 11 &&
      !!st && st.werte[0] === "10" && st.werte[2] === "2.0\u00a0s" && st.werte[3] === "1.0" && st.striche === 10 && !!dm && dm.werte[0] === "75" && dm.striche === 75,
      "3.7 je Faehigkeit Einsaetze, je Minute, \u00d8 Abstand, Treffer je Einsatz und ein Strich je Einsatz im Takt", { qf, st, dm });
    assert(b.zeilen.length === 4 && !b.zeilen.some((z) => z.k === "Deadly Viper"), "3.7 was automatisch ist, steht nicht in der Tabelle", b.zeilen.map((z) => z.k));
    // 3.8: das Auge vor dem Symbol blendet aus, die Zeile gedaempft, ihr Takt blass sichtbar; der Kopf sagt es
    assert(b.zeilen.length === 4 && b.zeilen.every((z) => z.augeVorSym && z.augeW > 0 && z.augeW <= 22 && z.gedrueckt === "true"), "3.8 ein kleines Auge vor dem Symbol, gedrueckt", b.zeilen);
    // Fixrunde 1, folgt Entwurf: nur das Auge ist der Knopf, mit Namen im aria-label; der Name ist Text
    assert(b.zeilen.every((z) => z.nurAuge && z.label === "Show " + z.name + " in the timeline"), "3.8 das Auge ist ein eigener kleiner Knopf mit Namen, der Name nur Text", b.zeilen);
    const nameKlick = await p.evaluate(() => { document.querySelector('#drGed .drzeile[data-k="Strafing"] em')?.click();
      return document.querySelector('#drGed .drzeile[data-k="Strafing"]')?.classList.contains("aus"); });
    assert(nameKlick === false, "3.8 ein Klick auf den Namen blendet nichts aus", nameKlick);
    await p.evaluate(() => document.querySelector('#drGed .rotgz[data-k="Strafing"]')?.click());
    await p.waitForFunction(() => document.querySelector('#drGed .drzeile[data-k="Strafing"]')?.classList.contains("aus"), null, { timeout: 3000 }).catch(() => {});
    b = await rotBlick(p);
    const aus = b.zeilen.find((z) => z.k === "Strafing");
    assert(!!aus && aus.aus && aus.gedrueckt === "false" && aus.nameOp < 0.6 && aus.taktSicht && aus.taktOp > 0.15 && aus.taktOp < 0.5 && !b.syms.includes("Strafing"),
      "3.8 ausgeblendet: Zeile gedaempft, Takt blass sichtbar, nicht in der Leiste", aus);
    assert(/1 hidden/.test(b.kopf) && b.kopfAlle, "3.8 im Kopf „1 hidden \u00b7 show all“", b.kopf);
    // Fixrunde 1 zu Aufgabe 5 (Pruefung Befund 5): "show all" ist ein leiser Knopf (.leise) - unterstrichen, ohne Rand und Platte
    const alleStil = await p.evaluate(() => { const k = getComputedStyle(document.querySelector("#rotShowAll"));
      return { linie: k.textDecorationLine, rand: k.borderTopWidth, grund: k.backgroundColor }; });
    assert(alleStil.linie === "underline" && alleStil.rand === "0px" && /rgba\(0, 0, 0, 0\)|transparent/.test(alleStil.grund),
      "3.8 „show all“ ist ein leiser Knopf: unterstrichen, ohne Rand, ohne Platte", alleStil);
    // 3.9: "Immer weglassen" im Kasten Automatisch (DECISION 3.9)
    const immer = await p.evaluate(() => [...document.querySelectorAll("#drAutoKasten [data-wahl]")].map((x) => x.getAttribute("aria-label")));
    assert(immer.includes("Always leave Strafing out"), "3.9 \u201eAlways leave out\u201c steht im Kasten Automatisch", immer);
    await p.evaluate(() => document.querySelector("#bereichKopf #rotShowAll")?.click());
    await p.waitForFunction(() => document.querySelector("#rotCtl")?.hidden, null, { timeout: 3000 }).catch(() => {});
    b = await rotBlick(p);
    assert(!b.zeilen.some((z) => z.aus) && b.syms.includes("Strafing") && !b.kopfAlle, "3.8 \u201eshow all\u201c im Kopf holt alle zurueck", b.kopf);
    // 3.10: der Kasten Automatisch als einklappbares Feld unter der Zeitleiste, ueber der Tabelle
    assert(b.kasten && b.buehne && b.tabelle && b.kasten.top >= b.buehne.bottom - 1 && b.kasten.bottom <= b.tabelle.top + 1,
      "3.10 der Kasten Automatisch unter der Zeitleiste, ueber den Einsaetzen", { kasten: b.kasten, buehne: b.buehne, tabelle: b.tabelle });
    // 3.12: ohne Gruppe keine Wahl "Wessen Rotation" (geprueft unten, zusammen mit der laufenden Gruppe)
    ohneGruppeWer = b.wer;
    // 3.5: ein Klick in die Leiste springt dorthin
    const bu = await r(p, "#deineRotScroll");
    await p.mouse.click(bu.left + bu.width / 2, bu.top + 20);
    await p.waitForFunction(() => document.querySelector("#drUhr").textContent !== "0:00.0", null, { timeout: 3000 }).catch(() => {});
    const uhrKlick = await p.evaluate(() => document.querySelector("#drUhr").textContent);
    const ms = ((m) => m ? (+m[1] * 60 + +m[2]) * 1000 + +m[3] * 100 : NaN)(/^(\d+):(\d\d)\.(\d)$/.exec(uhrKlick));
    assert(ms > 25000 && ms < 35000, "3.5 ein Klick in die Leiste springt an diese Stelle des Kampfs", uhrKlick);
    // Tastatur wie bisher: Pfeile gehen einen Einsatz, Leertaste spielt ab
    await p.focus("#deineRotScroll");
    await p.keyboard.press("Home"); await p.keyboard.press("ArrowRight");
    const schritt = await p.evaluate(() => document.querySelector("#drLive").textContent);
    await p.keyboard.press(" ");
    await p.waitForFunction(() => document.querySelector("#drPlay").getAttribute("aria-pressed") === "true", null, { timeout: 3000 }).catch(() => {});
    const laeuft = await p.evaluate(() => document.querySelector("#drPlay").getAttribute("aria-pressed"));
    await p.keyboard.press(" ");
    assert(/^2 of 172: /.test(schritt) && laeuft === "true" && !s.fehler.length, "Tastatur wie bisher: Pfeil einen Einsatz weiter, Leertaste spielt ab; keine Fehler", { schritt, laeuft, fehler: s.fehler });
    await p.close();
  }
  // --- 3.4, 3.5 Deutsch: Stille mit Komma, der Satz definiert sie
  {
    const s = await oeffne({ app: true, lang: "de", breite: 560 }); const p = s.page;
    await zuRotation(s);
    const b = await rotBlick(p);
    assert(JSON.stringify(b.still.map((x) => x.text)) === JSON.stringify(["2,5\u00a0s", "3,0\u00a0s"]) && b.still.every((x) => x.sicht) && /Stille: mindestens 2\u00a0s ohne gedr\u00fcckten Einsatz/.test(b.lead),
      "3.5 Deutsch, 560: \u201e2,5\u00a0s\u201c auch in einem schmalen Feld, der Satz definiert die Stille", { still: b.still, lead: b.lead });
    assert(/172 Eins\u00e4tze/.test(b.kopf) && b.titel === "Eins\u00e4tze" && JSON.stringify(b.tempo.map((x) => x[0])) === JSON.stringify(["1\u00d7", "2\u00d7", "4\u00d7"]),
      "3.1/3.3/3.7 Deutsch: Kopf, Feld \u201eEins\u00e4tze\u201c, Tempo", { kopf: b.kopf, titel: b.titel, tempo: b.tempo });
    await p.close();
  }
  // --- Groessen: 1280 x 860, 1920 x 1080, 2000 x 1480, dazu 1000, 760, 560
  const stilleGroesse = [];
  for (const [breite, hoehe] of [[1280, 860], [1920, 1080], [2000, 1480], [1000, 860], [760, 860], [560, 860]]) {
    const s = await oeffne({ app: true, breite, hoehe }); const p = s.page;
    await zuRotation(s);
    const b = await rotBlick(p);
    const wo = `${breite} \u00d7 ${hoehe}`;
    assert(b.zeilen.length === 4 && b.zeilen.every((z) => z.hoch <= 44 + 0.5) && new Set(b.zeilen.map((z) => Math.round(z.hoch))).size === 1,
      `3.7 ${wo}: Zeilen hoechstens 44 Punkt, alle gleich, nichts gestreckt`, b.zeilen.map((z) => z.hoch));
    assert(!b.quer && !b.rollt && b.tops === (hoehe >= 1200 ? 5 : 3) && JSON.stringify(b.still.map((x) => x.text)) === JSON.stringify(["2.5\u00a0s", "3.0\u00a0s"]) && b.still.every((x) => x.sicht) && !b.klein.length && !s.fehler.length,
      `3.5 ${wo}: kein waagerechtes Rollen, der ganze Kampf in ${hoehe >= 1200 ? 5 : 3} Bahnen, die Stille-Marken auf Zehntel gerundet, jeder Text mindestens 11 Punkt; keine Fehler`,
      { quer: b.quer, rollt: b.rollt, tops: b.tops, still: b.still, klein: b.klein, fehler: s.fehler });
    stilleGroesse.push(b.still[0]?.groesse);
    if (breite >= 1280) assert(b.spaltenBreit[0] >= 280 && b.spaltenBreit[0] <= 320 && b.spaltenBreit[1] === Math.max(...b.spaltenBreit),
      `3.7 ${wo}: Namen etwa 300 Punkt, Takt die breite Spalte`, b.spaltenBreit);
    if (breite === 760) assert(b.spalten.includes("Timing") && !b.spalten.includes("\u00d8 gap"), `3.7 ${wo}: Takt bleibt, \u00d8 Abstand faellt weg`, b.spalten);
    if (breite === 560) assert(!b.spalten.includes("Timing") && b.spalten.includes("Casts"), `3.7 ${wo}: ohne Takt, mit Einsaetzen`, b.spalten);
    await p.close();
  }
  assert(stilleGroesse.length === 6 && stilleGroesse.every((g) => g > 0 && g === stilleGroesse[0]), "3.5 die Stille-Marke ist bei jeder Breite gleich gross", stilleGroesse);
  // --- 3.12: "Wessen Rotation" nur bei laufender Gruppe; beim Mitglied nur geteilte Einsaetze, nichts Erfundenes
  {
    const kurve = { T: 60, t0: 0, lanes: [{ n: "Quick Fire", sid: "964762401", v: Array.from({ length: 60 }, () => 5000) }], total: Array.from({ length: 60 }, () => 5000) };
    const zeile = (name, extra) => ({ name, waiting: false, damage: 300000, dps: 5000, hits: 60, crit: 10, heavy: 5, seconds: 60, max: 9000,
      skills: [{ name: "Quick Fire", sid: "964762401", damage: 300000, dps: 5000, hits: 60, crit: 10, heavy: 5, max: 9000 }],
      hasCurve: true, curve: kurve, share: 1, onTarget: true, target: "Vulcanus", lang: "en", weapons: ["Crossbow", "Longbow"], ventius: false, age: 0, ...extra });
    // Mitglied Zwei teilt vier Einsaetze ([Beginn, Ende, Schaden, Treffer, Krit] in ms ab Kampfbeginn)
    const geteilt = [{ n: "Quick Fire", c: [[1000, 1100, 9000, 2, 0], [5000, 5100, 9000, 2, 0], [9000, 9100, 9000, 2, 0], [13000, 13100, 9000, 2, 0]] }];
    const s = await oeffne({ app: true, gruppe: { role: "host", code: "QX7K", board: [zeile("Mitglied Eins"), zeile("Mitglied Zwei", { casts: geteilt })], target: "Vulcanus", error: "" } });
    const p = s.page;
    await zuRotation(s);
    await p.waitForFunction(() => !document.querySelector("#rotWhoBar").hidden, null, { timeout: 8000 }).catch(() => {});
    let b = await rotBlick(p);
    const steuer = await r(p, "#drSteuer");
    assert(ohneGruppeWer === false && b.wer && /Whose rotation/.test(b.werText) && b.werTop && steuer && b.werTop.bottom <= steuer.top + 1,
      "3.12 nur bei laufender Gruppe: \u201eWhose rotation\u201c ueber der Steuerzeile, ohne Gruppe nicht", { ohneGruppeWer, wer: b.werText, werTop: b.werTop, steuer });
    await p.evaluate(() => [...document.querySelectorAll("#rotWho [data-wer]")].find((x) => x.dataset.wer === "Mitglied Eins")?.click());
    await p.waitForFunction(() => !!document.querySelector('#rotWho .wbtn.on[data-wer="Mitglied Eins"]') && /Mitglied Eins/.test(document.querySelector("#deineRotLead").textContent), null, { timeout: 5000 }).catch(() => {});
    b = await rotBlick(p);
    /* Fixrunde 1, folgt Entwurf (r11-rotation-mitglied, .rsteuer.still): die Steuerzeile bleibt gedimmt
       stehen, Abspielen und Tempo sind aus, "Jetzt" sagt "keine Einsaetze", die Uhr nennt die Dauer */
    assert(b.steuer && b.steuerStill && b.steuerOp < 0.7 && b.playAus && b.tempoAus && /no casts/.test(b.jetztText) &&
      /^0:00\.0$/.test(b.uhr) && /\/ 1:00\.0/.test(b.steuerText) && !b.klein.length,
      "3.12 Mitglied ohne geteilte Einsaetze: Steuerzeile gedimmt, Abspielen aus, Jetzt \u201eno casts\u201c", b);
    const leer = await p.evaluate(() => ({ band: document.querySelector("#rotBar")?.innerText || "", tab: document.querySelector("#drGed")?.innerText || "" }));
    assert(b.syms.length === 0 && b.striche === 0 && !b.kasten && /no shared casts/.test(leer.band) && /Mitglied Eins/.test(b.lead) && /Mitglied Eins/.test(leer.tab) && b.zeilen.length === 0,
      "3.12 Mitglied ohne geteilte Einsaetze: die Leiste bleibt leer, Satz und Tabelle sagen warum, kein Kasten Automatisch - nichts Erfundenes", { syms: b.syms.length, striche: b.striche, leer, lead: b.lead });
    await p.evaluate(() => [...document.querySelectorAll("#rotWho [data-wer]")].find((x) => x.dataset.wer === "Mitglied Zwei")?.click());
    await p.waitForFunction(() => !!document.querySelector('#rotWho .wbtn.on[data-wer="Mitglied Zwei"]') && !!document.querySelector("#bkRotZahl")?.textContent, null, { timeout: 5000 }).catch(() => {});
    b = await rotBlick(p);
    const zwei = b.zeilen.find((z) => z.k === "Quick Fire");
    assert(b.striche === 4 && !!zwei && zwei.werte[0] === "4" && zwei.striche === 4 && !s.fehler.length, "3.12 Mitglied mit geteilten Einsaetzen: genau diese vier; keine Fehler",
      { striche: b.striche, zwei, fehler: s.fehler });
    await p.close();
  }

  // ===== Abschnitt 4: Analyse (Luecken 4) =====
  const ANA_LOG = join(work, "TLCombatLog-20260920-analyse.txt");
  writeFileSync(ANA_LOG, anaLog());
  const zurAnalyse = async (s, datei = ANA_LOG) => {
    if (datei) await mitLog(s, datei); else await beispiel(s.page);
    await bereich(s.page, "analysis");
    await s.page.waitForFunction(() => !!document.querySelector("#analysisCall .uv") && document.querySelectorAll("#saeulen rect").length > 0, null, { timeout: 5000 }).catch(() => {});
  };
  /* Was die Analyse zeigt: Urteil, Weitere Befunde, Form, drei Felder, Ventius, Fuss. */
  const anaBlick = (p) => p.evaluate(() => {
    const q = (x) => document.querySelector(x);
    const r = (e) => e && e.getClientRects().length ? e.getBoundingClientRect().toJSON() : null;
    const txt = (x) => (q(x)?.textContent || "").trim();
    const sicht = (e) => !!e && e.getClientRects().length > 0 && getComputedStyle(e).display !== "none" && getComputedStyle(e).visibility !== "hidden";
    const klein = [];
    const it = document.createTreeWalker(q("#p-analysis"), NodeFilter.SHOW_TEXT);
    for (let n; (n = it.nextNode()); ) {
      const e = n.parentElement;
      if (!n.textContent.trim() || !e || e.closest(".vh") || !sicht(e)) continue;
      const g = parseFloat(getComputedStyle(e).fontSize);
      if (g < 11) klein.push(n.textContent.trim().slice(0, 24) + ":" + g);
    }
    const sa = q("#saeulen");
    return {
      kopf: q("#bereichKopf")?.innerText || "",
      urteil: { uv: txt("#analysisCall .uv"), un: txt("#analysisCall .un"), r: r(q("#analysisCall")), uk: !!q("#analysisCall .uk") },
      titel: document.querySelectorAll("#weitere [title]").length, weitereText: q("#weitere")?.innerText || "",
      weitere: { h: txt("#weitereTitel"), r: r(q("#weitere")),
        items: [...document.querySelectorAll("#weitere .find")].map((f) => ({ k: f.dataset.k, dt: (f.querySelector(".k")?.textContent || "").trim(),
          v: (f.querySelector(".v")?.textContent || "").trim(), n: (f.querySelector(".n")?.textContent || "").trim(), r: r(f) })) },
      form: { h: txt("#formTitel"), def: txt("#lueckeDef"), leg: txt("#verdict .vlegend"), r: r(q("#verdict")),
        balken: sa ? [...sa.querySelectorAll("rect")].map((x) => +x.getAttribute("height")) : [],
        svg: r(sa?.querySelector("svg")), sa: r(sa), label: sa?.getAttribute("aria-label") || "", rolle: sa?.getAttribute("role") || "",
        zonen: sa ? [...sa.querySelectorAll(".gapz")].map((z) => z.dataset.zeit) : [],
        med: sa?.querySelector(".med") ? parseFloat(sa.querySelector(".med").style.bottom) : -1,
        medStrich: sa?.querySelector(".med") ? getComputedStyle(sa.querySelector(".med")).borderTopStyle : "" },
      drei: [...document.querySelectorAll("#drei > section")].map((s) => ({ id: s.id, h: (s.querySelector("h3")?.textContent || "").trim(),
        ant: (s.querySelector(".ant")?.textContent || "").trim(), leise: [...s.querySelectorAll(".fein")].map((x) => x.textContent.trim()).join(" | "), r: r(s) })),
      stapel: [...document.querySelectorAll("#dWie .stapel i")].map((i) => ({ art: i.dataset.art, w: parseFloat(i.style.width) })),
      lg: [...document.querySelectorAll("#dWie .lg > span")].map((x) => x.textContent.trim()),
      vent: { h: txt(".vkasten h3"), vkw: txt(".vkasten .vkw"), r: r(q(".vkasten")),
        salven: [...document.querySelectorAll(".vkasten .salven i")].map((i) => i.classList.contains("best")),
        leer: document.querySelectorAll(".vkasten .salven i.leer").length, wort: txt(".vkasten .salvenwort"),
        vorbehalt: txt(".vkasten .kvorbehalt"),
        boss: [...document.querySelectorAll(".vkasten .vtabzeile")].map((z) => [(z.querySelector(".bn")?.textContent || "").trim(),
          (z.querySelector(".vpips b")?.textContent || "").trim(), (z.querySelector(".tr")?.textContent || "").trim()]),
        vkz: [...document.querySelectorAll(".vkasten .vkz > div")].map((d) => [...d.children].map((c) => c.textContent.trim())),
        tab: !!q(".vkasten .vtab") },
      fuss: { h: txt("#afuss h2"), li: [...document.querySelectorAll("#afuss li")].map((l) => l.textContent.trim()), r: r(q("#afuss")) },
      status: r(q("#statusleiste")), rollY: scrollY + (q("#app")?.scrollTop || 0) + (q(".stage")?.scrollTop || 0),
      klein, quer: document.documentElement.scrollWidth > innerWidth,
    };
  });
  // --- 4.1 bis 4.12 an einem erzeugten Kampf (Deutsch, 1280 x 860)
  {
    const s = await oeffne({ app: true, lang: "de" }); const p = s.page;
    await mitLog(s, ANA_LOG);
    // die Einsaetze zaehlt die Rotation; die Analyse muss dieselbe Zahl nennen
    await bereich(p, "rotation");
    await p.waitForFunction(() => /\d/.test(document.querySelector("#bkRotZahl")?.textContent || ""));
    const rotZahl = +(await p.evaluate(() => document.querySelector("#bkRotZahl").textContent)).replace(/\D/g, "");
    await bereich(p, "analysis");
    await p.waitForFunction(() => !!document.querySelector("#analysisCall .uv") && document.querySelectorAll("#saeulen rect").length > 0, null, { timeout: 5000 }).catch(() => {});
    const b = await anaBlick(p);
    // 4.1-4.3: der Kopf nennt Bereich und Kampf; die Leerzeit nach Median ist der teuerste Kandidat - Form des Entwurfs
    /* Fixrunde 1 (Pruefung Befund 4): die Analyse sagt "Luecke" (nach dem Median), der Zeitverlauf und der
       Vergleich "Pause" (ohne Treffer ueber 1,5 s) - vorher "10 Sekunden ohne Treffer" */
    assert(/Analyse/.test(b.kopf) && /Vulcanus/.test(b.kopf) && b.urteil.uv === "10 Sekunden in Lücken",
      "4.1/4.3 Kopf mit dem Kampf, Urteil: 10 Sekunden in Luecken (drei Luecken nach dem Median: 6 + 2 + 2 s)", { kopf: b.kopf, urteil: b.urteil });
    // Fixrunde 1 (Pruefung Befund 3 und 9): kein Kicker, der Satz beginnt die Erklaerung; in der Analyse mit der Linie in den Saeulen
    assert(!b.urteil.uk && b.urteil.un.startsWith("Das kostet dich am meisten: Gemessen an deiner gewöhnlichen Sekunde \u2013 dem Median der Sekunden mit Treffern, " +
      kurz(ANA.med) + ", wie die Linie in den Säulen \u2013 fehlen"),
      "4.2 Urteil in der Form des Entwurfs: „Das kostet dich am meisten:“ eroeffnet die Erklaerung, mit „wie die Linie in den Saeulen“", b.urteil);
    assert(b.urteil.un.includes("dem Median der Sekunden mit Treffern, " + kurz(ANA.med)) && b.urteil.un.includes("rund " + kurz(10 * ANA.med) + " Schaden") &&
      b.urteil.un.includes("Die längste Lücke liegt bei 0:20\u20130:26.") && b.urteil.un.endsWith("Ob der Boss da nicht zu treffen war, steht nicht im Log."),
      "4.3 Urteil: gemessen am Median, Kosten = Leerzeit mal Median, die laengste Luecke, was das Log nicht weiss", { un: b.urteil.un, med: kurz(ANA.med) });
    // 4.4: Weitere Befunde als Zeile unter dem Urteil
    const w = Object.fromEntries(b.weitere.items.map((x) => [x.k, x]));
    assert(b.weitere.h === "Weitere Befunde" && b.weitere.r && b.urteil.r && b.weitere.r.top >= b.urteil.r.bottom - 1 &&
      Math.abs(b.weitere.r.left - b.urteil.r.left) < 1 && Math.abs(b.weitere.r.width - b.urteil.r.width) < 1 && b.form.r && b.form.r.top >= b.weitere.r.bottom - 1,
      "4.4 Weitere Befunde: eine Zeile unter dem Urteil, ueber der Form, volle Breite", { w: b.weitere.r, u: b.urteil.r, f: b.form.r });
    assert(w.luecken?.dt === "Lücken ab 2\u00a0s" && w.luecken.v === "3" && w.luecken.n === "zusammen 10\u00a0s" &&
      w.groesster?.dt === "Größter Treffer" && w.groesster.v === "250.0k \u00b7 Detonierendes Mal" &&
      w.fehl?.dt === "Fehlschläge" && /^2 \u00b7 /.test(w.fehl.v) && w.jeMinute?.dt === "Einsätze je Minute" && /^\d+,\d$/.test(w.jeMinute.v) && !!w.skillung,
      "4.4/4.14 Weitere Befunde: Luecken ab 2 s (3, zusammen 10 s), groesster Treffer mit Faehigkeit (DECISION 2.3), Fehlschlaege, Einsaetze je Minute, Rhythmus verdichtet",
      b.weitere.items.map(({ r, ...x }) => x));
    /* Eine Luecke ist schon benannt: die schwaechste Stelle liegt nicht in einer Luecke nach dem Median und
       haelt ihre drei Sekunden Abstand (vorher lag sie bei 0:33-0:36, mitten in der Luecke 0:33-0:35) */
    const sek = (u) => { const [m, x] = u.split(":"); return +m * 60 + +x; };
    const stelle = /^(\d+:\d+)\u2013(\d+:\d+) /.exec(w.schwach?.v || "");
    assert(!!stelle && [[20, 26], [33, 35], [40, 42]].every(([a, e]) => sek(stelle[2]) <= a - 3 || sek(stelle[1]) >= e + 3),
      "4.14 die schwaechste Stelle liegt nicht in oder an einer Luecke nach dem Median", w.schwach);
    // Fixrunde 1 (Pruefung Befund 2): die Erklaersaetze stehen sichtbar unter dem Wert, nicht im title
    assert(b.titel === 0 && !!w.skillung?.n && !!w.schwach?.n && /Ein Fehlschlag steht im Log als Treffer ohne Schaden\./.test(w.fehl?.n || "") &&
      [w.skillung?.n, w.schwach?.n, w.fehl?.n].every((x) => b.weitereText.includes(x)),
      "4.4 Weitere Befunde: die Saetze zu Skillung, schwaechster Stelle und Fehlschlaegen sind sichtbar, kein title", { titel: b.titel, w });
    const eineZeile = b.weitere.items.filter((x) => ["luecken", "groesster", "fehl", "jeMinute"].includes(x.k));
    assert(eineZeile.length === 4 && eineZeile.every((x) => Math.abs(x.r.top - eineZeile[0].r.top) < 1),
      "4.4 1280: die vier Befunde des Entwurfs stehen nebeneinander in einer Zeile", eineZeile.map((x) => x.r.top));
    // 4.5: Form des Kampfes
    assert(b.form.h === "Form des Kampfes" && b.form.balken.length === ANA.T && Math.max(...b.form.balken) === 100 &&
      b.form.balken.every((h, i) => Math.abs(h - 100 * ANA.sek[i] / ANA.max) < 0.2),
      "4.5 Form: eine Saeule je Sekunde (60), Hoehe = Schaden der Sekunde am hoechsten gemessen", { n: b.form.balken.length, balken: b.form.balken.slice(0, 12) });
    assert(JSON.stringify(b.form.zonen) === JSON.stringify(["0:20\u20130:26", "0:33\u20130:35", "0:40\u20130:42"]),
      "4.3/4.5 Luecken nach dem Median: 20-26 und 40-42 s ohne Treffer, 33-35 s unter 2 % - nicht die ersten 3 und nicht die letzten 5 s", b.form.zonen);
    assert(Math.abs(b.form.med - 100 * ANA.med / ANA.max) < 0.2 && b.form.medStrich === "dashed" && b.form.leg.includes("Median der Sekunden mit Treffern (" + kurz(ANA.med) + ")"),
      "4.5 der Median gestrichelt auf seiner Hoehe, die Legende nennt ihn", { med: b.form.med, soll: 100 * ANA.med / ANA.max, strich: b.form.medStrich, leg: b.form.leg });
    assert(b.form.def === "Eine Lücke: mindestens 2\u00a0s, in denen weniger als 2\u00a0% einer gewöhnlichen Sekunde ankam; die ersten 3 und letzten 5\u00a0s zählen nicht.",
      "4.5 die Definition der Luecke steht als Satz dabei (gewuenscht)", b.form.def);
    assert(b.form.rolle === "img" && b.form.label.includes("0:20\u20130:26") && b.form.label.includes("3 Lücken"), "4.5 Vorleser: die Saeulen als Bild mit den Luecken", b.form.label);
    // 4.7 bis 4.9: die drei Felder
    const leer = { h: "", ant: "", leise: "", r: null };
    const [d1 = leer, d2 = leer, d3 = leer] = b.drei;
    const [erst, zweit] = ANA.reihe;
    assert(b.drei.length === 3 && d1.h === "Wer trägt?" && d2.h === "Wie triffst du?" && d3.h === "Hast du durchgedrückt?" &&
      b.drei.every((x) => Math.abs(x.r.top - d1.r.top) < 1) && b.drei.every((x) => x.r.top >= b.form.r.bottom - 1),
      "4.7-4.9 drei Felder nebeneinander unter der Form", b.drei.map((x) => [x.h, x.r?.top]));
    assert(d1.ant === "Schnellfeuer mit " + prozDe(erst[1] / ANA.gesamt, 1) + " des Schadens." && d1.leise.includes("Danach ") && d1.leise.includes(prozDe(zweit[1] / ANA.gesamt, 1)),
      "4.7 Wer traegt: die staerkste Faehigkeit mit ihrem Anteil, danach die zweite", { ant: d1.ant, leise: d1.leise });
    const N = ANA.hits;
    assert(d2.ant === prozDe(ANA.krit / N) + " kritisch, " + prozDe(ANA.stark / N) + " stark.", "4.8 Wie triffst du: Anteil kritisch und stark", d2.ant);
    assert(JSON.stringify(b.stapel.map((x) => x.art)) === JSON.stringify(["normal", "crit", "heavy", "critheavy"]) &&
      b.stapel.every((x) => Math.abs(x.w - 100 * ANA.arten[x.art] / N) < 0.2) &&
      JSON.stringify(b.lg) === JSON.stringify(["normal " + prozDe(ANA.arten.normal / N), "kritisch " + prozDe(ANA.arten.crit / N),
        "stark " + prozDe(ANA.arten.heavy / N), "kritisch stark " + prozDe(ANA.arten.critheavy / N)]),
      "4.8 die vier Trefferarten als geteilter Balken mit Legende", { stapel: b.stapel, lg: b.lg, soll: ANA.arten });
    const m3 = /^(\d+) Einsätze in .+\.$/.exec(d3.ant), m3b = /^Ohne die Lücken (\d+,\d) je Minute, mit ihnen (\d+,\d)\. Die Folge steht unter Rotation\.$/.exec(d3.leise);
    const zahl = (x) => +x.replace(",", ".");
    assert(!!m3 && +m3[1] === rotZahl && !!m3b && Math.abs(zahl(m3b[2]) - rotZahl / 59.5 * 60) < 0.06 && Math.abs(zahl(m3b[1]) - rotZahl / 49.5 * 60) < 0.06 &&
      w.jeMinute?.v === m3b[2], "4.9 Hast du durchgedrueckt: dieselben Einsaetze wie die Rotation, je Minute mit und ohne die 10 s Luecken",
      { ant: d3.ant, leise: d3.leise, rotZahl, jeMinute: w.jeMinute?.v });
    // 4.10/4.11: Ventius-Kasten
    /* Fixrunde 1 (Pruefung Befund 1): auch die unlesbare Salve steht als leere Saeule an ihrer Stelle (16 s),
       und "Salven" zaehlt genau die Saeulen */
    assert(b.vent.h === "Auge von Ventius" && b.vent.vkw === "4 von 6 lesbaren Salven auf Vulcanus mit 3 Nachbeben" &&
      JSON.stringify(b.vent.salven) === JSON.stringify([true, false, false, true, true, false, true]) && b.vent.leer === 1 &&
      b.vent.wort.endsWith("1 weitere Salve nicht lesbar"),
      "4.10 Ventius: Kopf, eine Saeule je Salve in Einsatzreihenfolge, die besten hervorgehoben, die unlesbare leer", b.vent);
    assert(JSON.stringify(b.vent.vkz) === JSON.stringify([["Treffer je Einsatz", "8,1"], ["Fehlende Treffer", "6", "bis zur besten Stelle in diesem Kampf"], ["Salven", "7", "57 Treffer"]]) &&
      +b.vent.vkz[2][1] === b.vent.salven.length,
      "4.10 Ventius: Treffer je Einsatz, fehlende Treffer, Salven - so viele wie Saeulen", b.vent.vkz);
    // Fixrunde 1 (Pruefung Befund 7): der Vorbehalt, auf den sich das Urteil beruft, und die Zeile je Boss
    assert(b.vent.vorbehalt.includes("die besten Salven 2.000, die schwächeren 1.500") && b.vent.vorbehalt.includes("die 6 fehlenden Treffer") &&
      JSON.stringify(b.vent.boss) === JSON.stringify([["Vulcanus", "3", "10"]]),
      "4.10/4.11 Ventius: der Vorbehalt nennt beide Trefferwerte und die fehlenden Treffer, je Boss Vulcanus mit 3 Nachbeben", b.vent);
    assert(b.vent.tab && b.vent.r && d1.r && b.vent.r.top >= d1.r.bottom - 1, "4.11 Ventius je Boss steht im Kasten, der Kasten unter den drei Feldern", b.vent);
    // 4.12: der Fuss
    assert(b.fuss.h === "Was das Log nicht weiß" && b.fuss.li.length === 4 && b.fuss.li[0] === "ob der Boss in einer Lücke unverwundbar war oder du laufen musstest" &&
      b.fuss.r && b.vent.r && b.fuss.r.top >= b.vent.r.bottom - 1, "4.12 Fuss: vier Punkte, ganz unten", b.fuss);
    assert(!b.quer && !b.klein.length && !s.fehler.length, "4 1280 x 860: kein waagerechtes Rollen, jeder Text mindestens 11 Punkt, keine Fehler", { quer: b.quer, klein: b.klein, fehler: s.fehler });
    // Englisch: dieselben Stellen
    await p.evaluate(() => document.querySelector("#btnLang")?.click());
    await p.waitForFunction(() => document.documentElement.lang === "en" && /in gaps/.test(document.querySelector("#analysisCall .uv")?.textContent || ""), null, { timeout: 4000 }).catch(() => {});
    const e = await anaBlick(p);
    assert(e.urteil.uv === "10 seconds in gaps" && e.urteil.un.startsWith("What cost you most: Measured against your ordinary second") &&
      e.titel === 0 && e.weitere.h === "Further findings" && e.form.h === "Shape of the fight" &&
      e.fuss.h === "What the log does not know" && e.drei.map((x) => x.h).join("|") === "Who carries it?|How do you hit?|Did you keep pressing?" &&
      e.form.def === "A gap: at least 2\u00a0s in which less than 2% of an ordinary second landed; the first 3 and last 5\u00a0s do not count.",
      "4 Englisch: Urteil, Weitere Befunde, Form mit Definition, drei Felder, Fuss", { uv: e.urteil.uv, h: e.weitere.h, form: e.form.h, def: e.form.def, drei: e.drei.map((x) => x.h), fuss: e.fuss.h });
    await p.close();
  }
  /* --- Fixrunde 1 (Pruefung Befund 6, Entscheidung vom 29.09. (an Claude uebertragen)): die schwaechste
     Stelle misst an derselben gewoehnlichen Sekunde wie die Leerzeit, dem Median der Sekunden mit Treffern. Ein Kampf
     von 60 s ohne Luecke: Quick Fire zweimal je Sekunde (3000), von 40 bis 43 s nur einmal je Sekunde mit 300 - keine
     Luecke (ueber 2 %), keine Pause (Abstand 1 s), aber die schwaechste Stelle, und sie kostet mehr als 2 %. */
  {
    const rows = [];
    for (let t = 0; t < 60000; t += 500) {
      const leise = t >= 40000 && t < 43000;
      if (leise && t % 1000) continue;
      rows.push(`${stamp(at(21, 30) + t)},DamageDone,Quick Fire,964762401,${leise ? 300 : 3000 + 100 * ((t / 500) % 5 - 2)},0,0,kNormalHit,Tester,Vulcanus`);
    }
    const f = join(work, "TLCombatLog-20260920-schwach.txt");
    writeFileSync(f, ["CombatLogVersion,4", ...rows].join("\n") + "\n");
    const s = await oeffne({ app: true, lang: "de" }); const p = s.page;
    await zurAnalyse(s, f);
    const b = await anaBlick(p);
    const med = (/\(([\d.]+[kM])\)/.exec(b.form.leg) || [])[1];
    assert(b.urteil.uv === "Die Stelle 0:40\u20130:43" && !!med && b.urteil.un.startsWith("Das kostet dich am meisten: Etwa ") &&
      b.urteil.un.endsWith("gemessen an deiner gewöhnlichen Sekunde \u2013 dem Median der Sekunden mit Treffern, " + med + "."),
      "4.2 die schwaechste Stelle misst am Median der Sekunden mit Treffern, wie die Leerzeit und die Linie der Form", { urteil: b.urteil, leg: b.form.leg });
    await p.close();
  }
  // --- Fixrunde 1 (Pruefung Befund 4): im Zeitverlauf heisst das Band "Pause" und sagt, was es misst
  {
    const s = await oeffne({ app: true, lang: "de" }); const p = s.page;
    await mitLog(s, ANA_LOG);
    // folgt Aufgabe 10: der Zeitverlauf steht im Bereich Rotation
    await bereich(p, "rotation");
    await p.waitForFunction(() => /Pause/.test(document.querySelector("#stackGut .bandkey")?.textContent || ""), null, { timeout: 4000 }).catch(() => {});
    const key = await p.evaluate(() => document.querySelector("#stackGut .bandkey")?.textContent || "");
    assert(key.includes("Pause: über 1,5\u00a0s ohne Treffer") && !key.includes("Lücke"),
      "4 Zeitverlauf: das Band heisst „Pause“ und sagt, was es misst (über 1,5 s ohne Treffer) - die Analyse sagt „Lücke“", key);
    await p.close();
  }
  // --- Groessen: 1280 x 860, 1920 x 1080, 2000 x 1480, dazu 1000, 760, 560 - am erzeugten Kampf und am Beispiel
  {
    const hoehen = {};
    for (const [breite, hoehe] of [[1280, 860], [1920, 1080], [2000, 1480], [1000, 860], [760, 860], [560, 860]]) {
      for (const datei of [ANA_LOG, null]) {
        const s = await oeffne({ app: true, lang: "de", breite, hoehe }); const p = s.page;
        await zurAnalyse(s, datei);
        const b = await anaBlick(p);
        const wo = `${breite} × ${hoehe}${datei ? "" : ", Beispiel"}`;
        if (datei) hoehen[breite + "x" + hoehe] = b.form.sa?.height;
        const nebeneinander = b.drei.length === 3 && b.drei.every((x) => Math.abs(x.r.top - b.drei[0].r.top) < 1);
        const untereinander = b.drei.length === 3 && b.drei.every((x, i) => !i || x.r.top >= b.drei[i - 1].r.bottom - 1);
        assert(!b.quer && !b.klein.length && !s.fehler.length && (breite >= 1000 ? nebeneinander : untereinander) &&
          b.weitere.r && b.urteil.r && b.weitere.r.top >= b.urteil.r.bottom - 1 && b.form.svg && b.form.sa && Math.abs(b.form.svg.width - b.form.sa.width) < 1,
          `4 ${wo}: kein waagerechtes Rollen, Text mindestens 11 Punkt, Befunde unter dem Urteil, Saeulen in voller Breite, drei Felder ${breite >= 1000 ? "nebeneinander" : "untereinander"}; keine Fehler`,
          { quer: b.quer, klein: b.klein, fehler: s.fehler, drei: b.drei.map((x) => x.r && [x.r.top, x.r.bottom]) });
        if (breite === 2000)
          assert(b.fuss.r && b.status && b.fuss.r.bottom <= b.status.top + 0.5 && b.rollY === 0,
            `4 ${wo}: „Was das Log nicht weiß“ ist ohne Rollen im Blick (gewuenscht)`, { fuss: b.fuss.r, status: b.status, rollY: b.rollY });
        await p.close();
      }
    }
    assert(hoehen["2000x1480"] > hoehen["1280x860"] + 40 && hoehen["1280x860"] >= 120,
      "4.5 grosse Fenster nutzen die Hoehe: die Saeulen wachsen mit dem Fenster", hoehen);
  }

  // ===== Abschnitt 5: Vergleich (Luecken 5) =====
  const VGL_LOG = join(work, "TLCombatLog-20260920-vergleich.txt");
  writeFileSync(VGL_LOG, vglLog());
  /* Was der Vergleich zeigt: Umschalter im Kopf, Grund, zwei Zahlen, Satz, je Faehigkeit eine Zeile. */
  const vglBlick = (p) => p.evaluate(() => {
    const q = (x) => document.querySelector(x);
    const r = (e) => e && e.getClientRects().length ? e.getBoundingClientRect().toJSON() : null;
    const sicht = (e) => !!e && e.getClientRects().length > 0 && getComputedStyle(e).visibility !== "hidden";
    const probe = document.createElement("i"); document.body.appendChild(probe);
    const farbe = (v) => { probe.style.color = ""; probe.style.color = v; return getComputedStyle(probe).color; };
    const tok = { pos: farbe("var(--pos)"), neg: farbe("var(--neg)"), gold: farbe("var(--gold-ink)") };
    probe.remove();
    const knopf = (id) => { const b = q(id); return b ? { sicht: sicht(b), text: b.textContent.trim(), gedrueckt: b.getAttribute("aria-pressed"),
      gesperrt: b.getAttribute("aria-disabled") === "true", grund: (document.getElementById(b.getAttribute("aria-describedby") || "")?.textContent || "").trim(),
      grundSicht: sicht(document.getElementById(b.getAttribute("aria-describedby") || "")), r: r(b) } : null; };
    const klein = [];
    for (const wurzel of [q("#p-compare"), q("#bereichKopf")]) {
      const it = document.createTreeWalker(wurzel, NodeFilter.SHOW_TEXT);
      for (let n; (n = it.nextNode()); ) {
        const e = n.parentElement;
        if (!n.textContent.trim() || !e || e.closest(".vh") || !sicht(e) || e.closest("details:not([open]) > :not(summary)")) continue;
        const g = parseFloat(getComputedStyle(e).fontSize);
        if (g < 11) klein.push(n.textContent.trim().slice(0, 24) + ":" + g);
      }
    }
    const zeilen = [...document.querySelectorAll("#cmpJe .vr")].map((z) => {
      const vl = z.querySelector(".vl"), vr = z.querySelector(".vrr"), vw = z.querySelector(".vw");
      const bl = vl?.querySelector("i"), br = vr?.querySelector("i");
      return { n: (z.querySelector(".vn .vnn")?.textContent || "").trim(), nur: (z.querySelector(".nurb")?.textContent || "").trim(),
        v: (vw?.textContent || "").trim(), rolle: z.getAttribute("role"), h: z.getBoundingClientRect().height,
        vl: r(vl), vr: r(vr), vw: r(vw), bl: r(bl), br: r(br),
        balkenFarbe: getComputedStyle(bl || br || z).backgroundColor, wertFarbe: vw ? getComputedStyle(vw).color : "",
        versteckt: vl?.getAttribute("aria-hidden") === "true" && vr?.getAttribute("aria-hidden") === "true" };
    });
    const gross = [...document.querySelectorAll("#cmpOut .vgross > div")].map((d) => ({ num: (d.querySelector(".num")?.textContent || "").trim(),
      lbl: (d.querySelector(".lbl")?.textContent || "").trim(), klein: (d.querySelector("small")?.textContent || "").trim(),
      sieger: d.classList.contains("sieger"), farbe: getComputedStyle(d.querySelector(".num") || d).color,
      gr: parseFloat(getComputedStyle(d.querySelector(".num") || d).fontSize), r: r(d) }));
    const rot = q("#cmpRot details");
    const fold = q("#cmpPick details.cmppickfold");
    return {
      best: knopf("#vglBest"), letzt: knopf("#vglLetzt"), gruppe: q("#vglWahl")?.getAttribute("role") || "",
      gruppeName: q("#vglWahl")?.getAttribute("aria-label") || "", imKopf: !!q("#bereichKopf #vglWahl"),
      gross, tok, lead: (q("#cmpLead")?.textContent || "").trim(), summe: (q("#cmpSumme")?.textContent || "").trim(),
      kopf: [...document.querySelectorAll("#cmpJe .vkopf span")].map((s) => s.textContent.trim()), liste: q("#cmpJe .vliste")?.getAttribute("role") || "",
      zeilen, rotZu: !!rot && !rot.open, rotTitel: (q("#cmpRot summary")?.textContent || "").trim(),
      pickZu: !!fold && !fold.open, pickTitel: (fold?.querySelector("summary")?.textContent || "").trim(),
      pillen: [...document.querySelectorAll("#cmpOut .delta.good, #cmpOut .delta.bad")].length, feld: !!q("#cmpOut .cmpfeld"),
      raster: q("#cmpRaster") ? { zu: !q("#cmpRaster").open, titel: (q("#cmpRaster > summary")?.textContent || "").trim(),
        kopf: [...document.querySelectorAll("#cmpRaster .cgrid")].map((g) => [...g.querySelectorAll(".czelle.kopf b")].map((b) => b.textContent).join("|")),
        nachRot: !!q("#cmpRot + #cmpRaster") } : null,
      klein, quer: document.documentElement.scrollWidth > innerWidth, breit: innerWidth,
      inhalt: r(q("#p-compare")),
    };
  });
  const zumVergleich = async (s) => {
    await mitLog(s, VGL_LOG);
    await bereich(s.page, "compare");
    await s.page.waitForFunction(() => !!document.querySelector("#cmpOut .vgross") && document.querySelectorAll("#cmpJe .vr").length > 0, null, { timeout: 5000 }).catch(() => {});
  };
  // --- 5.1 bis 5.6 gegen den besten Pull (Deutsch, 1280 x 860)
  {
    const s = await oeffne({ app: true, lang: "de" }); const p = s.page;
    await zumVergleich(s);
    let b = await vglBlick(p);
    // 5.1 Umschalter im Kopf: Bester Pull gedrueckt, Letzter Pull verfuegbar
    assert(b.imKopf && b.gruppe === "group" && b.gruppeName === "Vergleichen mit" && b.best?.sicht && b.letzt?.sicht &&
      b.best?.text === "Bester Pull" && b.letzt?.text === "Letzter Pull" && b.best?.gedrueckt === "true" && b.letzt?.gedrueckt === "false" && !b.letzt?.gesperrt,
      "5.1 Umschalter im Kopf: Bester Pull | Letzter Pull, der Vergleich oeffnet gegen den besten Pull", { best: b.best, letzt: b.letzt, gruppe: b.gruppe });
    // 5.3 zwei grosse Zahlen: dieser Kampf links, der beste rechts; der Sieger in Gold
    assert(b.gross.length === 2 && b.gross[0].lbl === "Dieser Kampf" && b.gross[1].lbl === "Bester Pull (20.09. 20:00)" &&
      /^21:00 \u00b7 /.test(b.gross[0].klein) && /Treffer$/.test(b.gross[0].klein) && /^20:00 \u00b7 /.test(b.gross[1].klein) &&
      b.gross.every((g) => g.gr >= 30) && b.gross[1].sieger && !b.gross[0].sieger && b.gross[1].farbe === b.tok.gold && b.gross[0].farbe !== b.tok.gold &&
      Math.abs(b.gross[0].r.top - b.gross[1].r.top) < 1 && b.gross[1].r.left > b.gross[0].r.left,
      "5.3 zwei grosse Zahlen nebeneinander (Dieser Kampf, Bester Pull), Fakten darunter, der Sieger in Gold", b.gross);
    // 5.5 alle Faehigkeiten, auch nur in diesem / nur im besten, nach Betrag
    const w = b.zeilen.map((z) => vglZahl(z.v));
    assert(b.zeilen.length === 5 && b.zeilen.filter((z) => z.nur === "nur in diesem").length === 1 && b.zeilen.filter((z) => z.nur === "nur im besten").length === 1 &&
      w.every((x, i) => !i || Math.abs(x) <= Math.abs(w[i - 1])) && b.liste === "table" && b.zeilen.every((z) => z.rolle === "row"),
      "5.5 alle fuenf Faehigkeiten, eine nur in diesem, eine nur im besten, nach dem Betrag des Unterschieds", b.zeilen.map((z) => [z.n, z.nur, z.v]));
    const nurDiesem = b.zeilen.find((z) => z.nur === "nur in diesem"), nurBest = b.zeilen.find((z) => z.nur === "nur im besten");
    assert(vglZahl(nurDiesem?.v) > 0 && vglZahl(nurBest?.v) < 0, "5.5 nur in diesem ist ein Plus, nur im besten ein Minus", [nurDiesem, nurBest]);
    assert(b.kopf.join("|") === "Fähigkeit \u00b7 Schaden pro Sekunde|weniger als im besten|Unterschied|mehr", "5.5 Kopf der Liste wie im Entwurf", b.kopf);
    // 5.4 der Satz: die Summe der Zeilen ist die Zahl oben
    const gapLead = (/\(([\d.]+k) DPS\)/.exec(b.lead) || [])[1];
    const summe = /^(.+) holt ([\d.]+k|\d+) davon wieder herein\. Die (\d+) Zeilen ergeben zusammen (\u2212[\d.]+k) \u2013 dieselbe Zahl wie oben\.$/.exec(b.summe);
    const plus = b.zeilen.filter((z) => vglZahl(z.v) > 0).sort((x, y) => vglZahl(y.v) - vglZahl(x.v))[0];
    const gapGross = vglZahl(b.gross[0]?.num) - vglZahl(b.gross[1]?.num);
    assert(b.lead.startsWith("Du liegst ") && b.lead.includes(" unter deinem besten Pull vom 20.09. an Vulcanus") && !!gapLead && !!summe &&
      summe[4] === "\u2212" + gapLead && +summe[3] === b.zeilen.length && summe[1] === plus?.n && summe[2] === plus?.v.replace(/^\+/, ""),
      "5.4 Satz: wer wieder hereinholt, und die N Zeilen ergeben dieselbe Zahl wie oben", { lead: b.lead, summe: b.summe, plus });
    assert(Math.abs(w.reduce((a, x) => a + x, 0) - vglZahl(summe?.[4])) <= 50 * b.zeilen.length && Math.abs(gapGross - vglZahl(summe?.[4])) <= 100 &&
      Math.abs(vglZahl(summe?.[4]) + 5333) <= 100,
      "5.4 die Zeilen addieren sich zur Zahl oben, und die zwei grossen Zahlen liegen so weit auseinander (5.3k)", { w, summe: summe?.[4], gapGross });
    // 5.6 neutral gegen den besten Pull: kein Rot, kein Gruen
    assert(b.zeilen.length === 5 && b.zeilen.every((z) => z.wertFarbe !== b.tok.pos && z.wertFarbe !== b.tok.neg && z.balkenFarbe !== b.tok.pos && z.balkenFarbe !== b.tok.neg &&
      z.balkenFarbe !== "rgba(0, 0, 0, 0)") && b.pillen === 0,
      "5.6 gegen den besten Pull neutral: Balken in der Farbe der Faehigkeit, Zahlen ohne Rot und Gruen", b.zeilen.map((z) => [z.n, z.balkenFarbe, z.wertFarbe]));
    // die Balken: weniger links, mehr rechts der Zahl, im Verhaeltnis, der laengste voll; fuer Vorleser verborgen
    const max = Math.max(...w.map(Math.abs)), lang = b.zeilen[w.findIndex((x) => Math.abs(x) === max)];
    const halb = lang?.vl?.width || 0;
    assert(b.zeilen.every((z, i) => z.versteckt && (w[i] < 0 ? !!z.bl && !z.br && Math.abs(z.bl.right - z.vl.right) <= 1 && z.vl.right <= z.vw.left + 0.5
        : !!z.br && !z.bl && Math.abs(z.br.left - z.vr.left) <= 1 && z.vr.left >= z.vw.right - 0.5)) &&
      !!lang && Math.abs((lang.bl || lang.br || {}).width - halb) <= 1 &&
      b.zeilen.length > 0 && b.zeilen.every((z, i) => Math.abs((z.bl || z.br || {}).width / halb - Math.abs(w[i]) / max) <= 0.04 + 2 / halb),
      "5.5 Balken zur Mitte: weniger links, mehr rechts der Zahl, im Verhaeltnis, der laengste in voller Breite", b.zeilen.map((z) => [z.v, z.bl?.width, z.br?.width, halb]));
    // 5.7 was der Entwurf nicht zeigt, bleibt dahinter: Rotation nebeneinander zugeklappt, Auswahl hinter "Andere Kämpfe wählen"
    assert(b.rotZu && b.rotTitel === "Rotation nebeneinander" && b.pickZu && b.pickTitel === "Andere Kämpfe wählen" && !b.feld,
      "5.7 Rotation nebeneinander zugeklappt, die Auswahl hinter „Andere Kämpfe wählen“, keine Rangliste", b);
    /* 5.7 (Pruefung 29.09., Befund 1): Direktvergleich und Waffe fuer Waffe bleiben beim Paar erreichbar -
       zugeklappt unter der Rotation, aufgeklappt mit den Namen des Paars und ohne Rot und Gruen */
    assert(!!b.raster && b.raster.zu && b.raster.nachRot && b.raster.titel === "Direktvergleich und Waffe für Waffe",
      "5.7 Direktvergleich und Waffe fuer Waffe zugeklappt unter der Rotation", b.raster);
    await p.click("#cmpRaster > summary", { timeout: 3000 }).catch(() => {});
    await p.waitForFunction(() => document.querySelector("#cmpRaster")?.open, null, { timeout: 3000 }).catch(() => {});
    b = await vglBlick(p);
    assert(!!b.raster && !b.raster.zu && b.raster.kopf.length >= 2 && b.raster.kopf.every((k) => k.startsWith("Bester Pull (20.09. 20:00)|Dieser Kampf")) && b.pillen === 0,
      "5.7 aufgeklappt: Direktvergleich und Faehigkeiten mit den Namen des Paars, keine roten oder gruenen Pillen", b.raster);
    // 5.2 letzter Pull: der vorige Kampf am selben Boss (B, 20:30)
    await p.click("#vglLetzt", { timeout: 3000 }).catch(() => {});
    await p.waitForFunction(() => document.querySelector("#vglLetzt")?.getAttribute("aria-pressed") === "true" && /letzten Pull/.test(document.querySelector("#cmpLead")?.textContent || ""), null, { timeout: 3000 }).catch(() => {});
    b = await vglBlick(p);
    assert(b.letzt?.gedrueckt === "true" && b.best?.gedrueckt === "false" && b.gross[1]?.lbl === "Letzter Pull (20:30)" && /^20:30 \u00b7 /.test(b.gross[1]?.klein || "") &&
      b.gross[0]?.sieger && !b.gross[1]?.sieger && b.lead.startsWith("Du liegst ") && b.lead.includes(" über deinem letzten Pull an Vulcanus (20:30)"),
      "5.2 Letzter Pull: der vorige Kampf am selben Boss, dieser Kampf ist hier der Sieger", { lead: b.lead, gross: b.gross, letzt: b.letzt });
    assert(b.zeilen.length === 4 && b.zeilen.filter((z) => z.nur === "nur in diesem").length === 1 && !b.zeilen.some((z) => /nur im/.test(z.nur)) &&
      b.kopf[1] === "weniger als im letzten" && /^Die 4 Zeilen ergeben zusammen \+[\d.]+k \u2013 dieselbe Zahl wie oben\.$/.test(b.summe.replace(/^.*?\. (?=Die )/, "")) &&
      b.zeilen.every((z) => z.wertFarbe !== b.tok.pos && z.wertFarbe !== b.tok.neg),
      "5.2 gegen den letzten Pull: vier Faehigkeiten, Kopf „weniger als im letzten“, die Summe stimmt, neutral", { zeilen: b.zeilen.map((z) => [z.n, z.nur, z.v]), kopf: b.kopf, summe: b.summe });
    // 5.2 gesperrt mit Grund: A (20:00) ist der erste Vulcanus-Kampf im Log
    await p.evaluate(() => document.querySelector('#fightList .fight[data-i="2"]')?.click());
    await p.waitForFunction(() => document.querySelector("#vglLetzt")?.getAttribute("aria-disabled") === "true", null, { timeout: 3000 }).catch(() => {});
    b = await vglBlick(p);
    assert(b.letzt?.gesperrt && b.letzt?.gedrueckt === "false" && b.letzt?.grundSicht && b.letzt?.grund === "Letzter Pull: vor 20:00 gab es in diesem Log keinen Kampf an Vulcanus." &&
      b.best?.gedrueckt === "true" && b.lead.startsWith("Das ist dein bester Pull an Vulcanus"),
      "5.2 ohne vorigen Kampf: Letzter Pull gesperrt, der Grund steht da und ist verknuepft, der Vergleich bleibt beim besten", { letzt: b.letzt, best: b.best, lead: b.lead });
    // der Klick laeuft synchron durch (renderCompare im Handler): danach darf sich nichts geaendert haben
    await p.click("#vglLetzt", { timeout: 3000 }).catch(() => {});
    b = await vglBlick(p);
    assert(b.best?.gedrueckt === "true" && b.letzt?.gedrueckt === "false", "5.2 ein Klick auf den gesperrten Knopf aendert nichts", { best: b.best, letzt: b.letzt });
    // 5.7 und #42: andere Kaempfe waehlen - Kaempfe vergleichen mit Rot und Gruen, der Umschalter bringt den Vergleich zurueck
    await p.evaluate(() => document.querySelector('#fightList .fight[data-i="0"]').click());
    await p.waitForFunction(() => /Du liegst/.test(document.querySelector("#cmpLead")?.textContent || ""), null, { timeout: 3000 }).catch(() => {});
    await p.click("#cmpPick summary", { timeout: 3000 }).catch(() => {});
    // alle Haken ab, dann von Hand: 21:00 zuerst (der Bezug), dann 20:30 - die Zeilen je Schritt frisch gesucht
    await p.evaluate(() => {
      const zeilen = () => [...document.querySelectorAll("#cmpPick .run")];
      for (let n = 0; n < 5; n++) zeilen().find((r) => r.querySelector("input").checked)?.querySelector("input").click();
      for (const uhr of ["21:00", "20:30"]) zeilen().find((r) => r.textContent.includes(uhr))?.querySelector("input").click();
    });
    await p.waitForFunction(() => !!document.querySelector("#cmpOut .cmpfeld"), null, { timeout: 3000 }).catch(() => {});
    b = await vglBlick(p);
    assert(b.best?.gedrueckt === "false" && b.letzt?.gedrueckt === "false" && b.feld && !b.gross.length && b.pillen > 0,
      "5.7/#42 von Hand gewaehlt: kein Knopf gedrueckt, Kaempfe vergleichen mit Rot und Gruen an den Zahlen", { best: b.best, letzt: b.letzt, feld: b.feld, pillen: b.pillen });
    await p.click("#vglBest", { timeout: 3000 }).catch(() => {});
    await p.waitForFunction(() => !!document.querySelector("#cmpOut .vgross"), null, { timeout: 3000 }).catch(() => {});
    b = await vglBlick(p);
    assert(b.best?.gedrueckt === "true" && b.gross.length === 2 && b.pillen === 0, "5.1 Bester Pull bringt den Vergleich zurueck", { best: b.best, gross: b.gross.length });
    assert(!s.fehler.length, "5 Vergleich: keine Fehler", s.fehler);
    await p.close();
  }
  // --- Englisch
  {
    const s = await oeffne({ app: true, lang: "en" }); const p = s.page;
    await zumVergleich(s);
    const b = await vglBlick(p);
    assert(b.best?.text === "Best pull" && b.letzt?.text === "Last pull" && b.gruppeName === "Compare with" && b.gross[0]?.lbl === "This fight" &&
      b.gross[1]?.lbl === "Best pull (20/09 20:00)" && b.kopf.join("|") === "Skill \u00b7 damage per second|less than in the best|Difference|more" &&
      /The 5 rows add up to \u2212[\d.]+k \u2013 the same figure as above\.$/.test(b.summe) && b.zeilen.some((z) => z.nur === "only in this one") &&
      b.zeilen.some((z) => z.nur === "only in the best") && b.rotTitel === "Rotation side by side" && b.pickTitel === "Choose other fights",
      "5 Englisch: Umschalter, Zahlen, Kopf, Satz, nur in diesem / nur im besten", { best: b.best, letzt: b.letzt, gross: b.gross, kopf: b.kopf, summe: b.summe });
    await p.close();
  }
  // --- Groessen: 1280 x 860, 1920 x 1080, 2000 x 1480, dazu 1000, 760, 560
  for (const [breite, hoehe] of [[1280, 860], [1920, 1080], [2000, 1480], [1000, 860], [760, 860], [560, 860]]) {
    const s = await oeffne({ app: true, lang: "de", breite, hoehe }); const p = s.page;
    await zumVergleich(s);
    const b = await vglBlick(p);
    const wo = `${breite} × ${hoehe}`;
    assert(!b.quer && !b.klein.length && !s.fehler.length && b.zeilen.length === 5 && b.zeilen.every((z) => z.h <= 44) &&
      b.gross.length === 2 && Math.abs(b.gross[0].r.top - b.gross[1].r.top) < 1 && b.best?.sicht && b.best?.r?.right <= breite && b.letzt?.r?.right <= breite &&
      (breite < 2000 || b.inhalt?.width <= 1681) && (hoehe >= 1200 ? !b.rotZu : b.rotZu),
      `5 ${wo}: kein waagerechtes Rollen, Text mindestens 11 Punkt, Zeilen hoechstens 44 Punkt, zwei Zahlen nebeneinander, Umschalter im Bild${breite >= 2000 ? ", Inhalt hoechstens 1680 breit" : ""}, Rotation nebeneinander ${hoehe >= 1200 ? "offen (grosse Fenster nutzen die Hoehe, Befund 10)" : "zugeklappt"}; keine Fehler`,
      { quer: b.quer, klein: b.klein, fehler: s.fehler, h: b.zeilen.map((z) => z.h), best: b.best?.r, inhalt: b.inhalt?.width, rotZu: b.rotZu });
    await p.close();
  }

  // ===== Abschnitt 6: Verlauf (Luecken 6) =====
  /* Das offene Log ist VGL_LOG (drei Vulcanus-Pulls am 20.09.). Frueher gelesen (logIndex): Vulcanus am
     22.07., 01.09., zweimal am 10.09. und am 16.09., Ramux zweimal am 01.09.; gespeichert (Kampf speichern):
     Vulcanus am 05.09. Nur Zahlen, keine Namen. Monat (22.08. bis 20.09.): 1 + 1 + 2 + 1 + 3 = 8 Kaempfe an
     Vulcanus, Woche (14. bis 20.09.): 4, Alles: 9. */
  const V6 = (tag, h, m, dps, dur = 60, monat = 8) => ({ name: "Vulcanus", dps, dmg: dps * dur, dur, at: Date.UTC(2026, monat, tag, h, m, 0) });
  const LOGINDEX6 = {
    "TLCombatLog-20260722.txt": { size: 1, fights: [V6(22, 20, 0, 9000, 60, 6)] },
    "TLCombatLog-20260901.txt": { size: 1, fights: [V6(1, 20, 0, 15000), { name: "Ramux", dps: 30000, dmg: 1800000, dur: 60, at: Date.UTC(2026, 8, 1, 21, 0) },
      { name: "Ramux", dps: 32000, dmg: 1920000, dur: 60, at: Date.UTC(2026, 8, 1, 21, 30) }] },
    "TLCombatLog-20260910.txt": { size: 1, fights: [V6(10, 20, 0, 18000, 90), V6(10, 20, 30, 12000, 40)] },
    "TLCombatLog-20260916.txt": { size: 1, fights: [V6(16, 21, 0, 22000, 120)] },
  };
  const LAUF6 = { id: "run1", name: "Vulcanus", tag: "Probe", note: "", when: Date.UTC(2026, 8, 5, 19, 0), noTime: false, seconds: 60,
    total: 720000, dps: 12000, hits: 100, critRate: 0.2, critDmgShare: 0.3, heavyRate: 0.1, avg: 7200, max: 20000, dead: 0, worstGap: 0,
    mainWeapon: "", offWeapon: "", windows: [], perSecond: [],
    skills: [{ name: "Quick Fire", damage: 720000, hits: 100, crit: 20, heavy: 10, max: 20000, dps: 12000, casts: 50, sid: "964762401", weapon: "" }] };
  const zumVerlauf = async (s) => {
    await mitLog(s, VGL_LOG);
    await bereich(s.page, "history");
    await s.page.waitForFunction(() => document.querySelectorAll("#histDetail tbody tr").length > 0 && !!document.querySelector("#histPlotFeld svg circle"), null, { timeout: 5000 }).catch(() => {});
  };
  /* Feinschliff 02.10. (Abschnitt 4): die Liste "Kaempfe" endet an einer Zeilenkante und reicht bis zur
     Unterkante der Flaeche - es passt keine weitere Zeile mehr darunter -, oder sie zeigt schon alle. Wird
     es zu flach, bleiben mindestens fuenf Zeilen (dann rollt die Seite, wie bisher). */
  const listeFuellt = (v) => {
    const r = v.liste.roll, th = v.liste.th?.h ?? 0, zh = Math.max(...v.liste.zeilen.map((z) => z.h));
    if (!r || !zh) return { ok: false };
    const n = (r.h - th) / zh, kante = Math.abs(n - Math.round(n)) * zh <= 2;
    const alle = r.sh <= r.h + 1, unten = r.r.bottom + scrollYVon(v);
    const fuenf = Math.round(n) >= Math.min(5, v.liste.zeilen.length);
    const bis = alle || unten + zh > v.unterkante - 1;
    return { ok: kante && fuenf && bis && unten <= Math.max(v.unterkante, r.r.top + th + 5 * zh) + 1, n, kante, alle, unten, unterkante: v.unterkante, bis };
  };
  const scrollYVon = (v) => v.scrollY || 0;
  /* Was der Verlauf zeigt: Zeitraum im Kopf, Diagramm, Liste. */
  const verlaufBlick = (p) => p.evaluate(() => {
    const q = (x) => document.querySelector(x);
    const r = (e) => e && e.getClientRects().length ? e.getBoundingClientRect().toJSON() : null;
    const sicht = (e) => !!e && e.getClientRects().length > 0 && getComputedStyle(e).visibility !== "hidden";
    const probe = document.createElement("i"); document.body.appendChild(probe);
    const farbe = (v) => { probe.style.color = ""; probe.style.color = v; return getComputedStyle(probe).color; };
    const tok = { gold: farbe("var(--gold-ink)"), text: farbe("var(--text)"), pick: farbe("var(--pick)") };
    probe.remove();
    const klein = [];
    for (const wurzel of [q("#p-history"), q("#bereichKopf")]) {
      const it = document.createTreeWalker(wurzel, NodeFilter.SHOW_TEXT);
      for (let n; (n = it.nextNode()); ) {
        const e = n.parentElement;
        if (!n.textContent.trim() || !e || e.closest(".vh") || !sicht(e)) continue;
        const g = parseFloat(getComputedStyle(e).fontSize);
        if (g < 11) klein.push(n.textContent.trim().slice(0, 24) + ":" + g);
      }
    }
    const svg = q("#histPlotFeld svg");
    const kreise = [...document.querySelectorAll("#histPlotFeld svg circle.hp")].map((c) => ({ k: c.dataset.k, at: +c.dataset.at, dps: +c.dataset.dps,
      cx: +c.getAttribute("cx"), cy: +c.getAttribute("cy"), log: c.classList.contains("hplog"), spitze: c.classList.contains("hpspitze"), cur: c.classList.contains("hpcur"),
      fill: getComputedStyle(c).fill, stroke: getComputedStyle(c).stroke }));
    const band = q("#histPlotFeld svg .hpband");
    const roll = q("#histDetail .histroll"), th = q("#histDetail thead th");
    const zeilen = [...document.querySelectorAll("#histDetail tbody tr")];
    const wahl = q("#histBoss");
    return {
      zeit: [...document.querySelectorAll("#verlaufZeit button")].map((b) => ({ z: b.dataset.z, text: b.textContent.trim(), an: b.getAttribute("aria-pressed") })),
      zeitGruppe: q("#verlaufZeit")?.getAttribute("role") || "", zeitName: q("#verlaufZeit")?.getAttribute("aria-label") || "",
      zeitSicht: sicht(q("#verlaufZeit")), imKopf: !!q("#bereichKopf #verlaufZeit"),
      kopf: (q("#histKopf")?.textContent || "").replace(/\s+/g, " ").trim(),
      leg: [...document.querySelectorAll("#histPlotFeld .vlg > span")].map((s) => s.textContent.trim()),
      rolle: svg?.getAttribute("role") || "", name: svg?.getAttribute("aria-label") || "", svg: r(svg), feld: r(q("#histPlotFeld")),
      kreise, tok,
      yTitel: (q("#histPlotFeld svg .hpytitel")?.textContent || "").trim(),
      yWerte: [...document.querySelectorAll("#histPlotFeld svg .hpgrid")].map((l) => +l.dataset.wert),
      xText: [...document.querySelectorAll("#histPlotFeld svg .hpx")].map((t) => ({ text: t.textContent, x: +t.getAttribute("x") })),
      med: q("#histPlotFeld svg .hpmed") ? { wert: +q("#histPlotFeld svg .hpmed").dataset.wert, dash: getComputedStyle(q("#histPlotFeld svg .hpmed")).strokeDasharray } : null,
      band: band ? { x0: +band.getAttribute("x"), x1: +band.getAttribute("x") + +band.getAttribute("width"), text: (q("#histPlotFeld svg .hpbandt")?.textContent || "").trim() } : null,
      ring: q("#histPlotFeld svg .hpring")?.dataset.k ?? null,
      einord: q("#histEinord") ? { rolle: q("#histEinord").getAttribute("role"), name: q("#histEinord").getAttribute("aria-label") || "",
        text: (q("#histEinord .etextzeile")?.textContent || "").trim(),
        marken: Object.fromEntries([...document.querySelectorAll("#histEinord .emarke")].map((m) => [m.dataset.marke, { lage: parseFloat(m.style.left), wert: +m.dataset.wert }])) } : null,
      liste: { titel: (q("#histDetail .fk h3")?.textContent || "").trim(), fz: (q("#histDetail .fk .fz")?.textContent || "").trim(),
        kopf: [...document.querySelectorAll("#histDetail thead th")].map((t) => t.textContent.trim()),
        zeilen: zeilen.map((z) => ({ k: z.dataset.k, zellen: [...z.cells].map((c) => c.textContent.trim()), h: z.getBoundingClientRect().height, best: z.classList.contains("best") })),
        roll: roll ? { h: roll.clientHeight, sh: roll.scrollHeight, ov: getComputedStyle(roll).overflowY, r: r(roll) } : null,
        th: th ? { pos: getComputedStyle(th).position, top: getComputedStyle(th).top, h: th.getBoundingClientRect().height } : null,
        fk: r(q("#histDetail .fk")) },
      boss: wahl ? { tag: wahl.tagName, label: (document.querySelector('label[for="histBoss"]')?.textContent || "").trim(), wert: wahl.value,
        optionen: [...wahl.options].map((o) => o.textContent.trim()), inKopf: !!wahl.closest("#histDetail .fk") } : null,
      imVergleich: q("#histCmp") ? { text: q("#histCmp").textContent.trim(), leise: q("#histCmp").classList.contains("leise"), inKopf: !!q("#histCmp").closest("#histDetail .fk") } : null,
      panelText: q("#p-history")?.innerText || "", hHist: (q("#hHist")?.textContent || "").trim(),
      achse: svg?.dataset.achse || "", scrollY, bandText: (q("#histPlotFeld svg .hpbandt")?.textContent || "").trim(),
      /* die Unterkante der Flaeche bei ungerollter Seite: ueber der Statusleiste, abzueglich der Luft
         und des unteren Innenabstands der Liste (#histDetail) */
      unterkante: (q(".statusleiste")?.getBoundingClientRect().top ?? innerHeight) + scrollY -
        (parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--flaeche-luft")) || 0) -
        (parseFloat(getComputedStyle(q("#histDetail")).paddingBottom) || 0),
      klein, quer: document.documentElement.scrollWidth > innerWidth,
    };
  });
  // --- 6.1 bis 6.10 (Deutsch, 1280 x 860)
  {
    const s = await oeffne({ app: true, lang: "de", config: { logIndex: LOGINDEX6, runs: [LAUF6] } }); const p = s.page;
    await zumVerlauf(s);
    let v = await verlaufBlick(p);
    // 6.1 Zeitraum im Kopf, Monat gewaehlt
    assert(v.imKopf && v.zeitSicht && v.zeitGruppe === "group" && v.zeitName === "Zeitraum" &&
      v.zeit.map((z) => z.text + ":" + z.an).join("|") === "Woche:false|Monat:true|Alles:false",
      "6.1 Zeitraum im Kopf: Woche | Monat | Alles, Monat gewaehlt", v.zeit);
    assert(v.kopf === "Vulcanus \u00b7 8 Kämpfe \u00b7 30 Tage bis 20.09." && v.kreise.length === 8 && v.liste.zeilen.length === 8 && !/Beispiel/.test(v.panelText),
      "6.1 Monat: acht Kaempfe an Vulcanus - gelesene und der gespeicherte, nichts erfunden (keine Beispielwerte)", { kopf: v.kopf, n: v.kreise.length, z: v.liste.zeilen.length });
    // 6.2 x nach dem Datum: gleiche Zeit, gleicher Weg
    const k0 = v.kreise[0] || { cx: 0, at: 0 }, kn = v.kreise[v.kreise.length - 1] || { cx: 0, at: 1 };
    const proMs = (kn.cx - k0.cx) / (kn.at - k0.at);
    assert(v.kreise.length === 8 && v.kreise.every((c, i) => !i || c.at > v.kreise[i - 1].at) && proMs > 0 &&
      v.kreise.every((c) => Math.abs(c.cx - k0.cx - (c.at - k0.at) * proMs) <= 0.5),
      "6.2 x nach dem Datum: jeder Kreis liegt im Verhaeltnis seiner Zeit", v.kreise.map((c) => [new Date(c.at).toISOString().slice(5, 16), c.cx]));
    const tagX = 86400000 * proMs;
    const xs = v.xText.map((t) => t.x), schritt = xs.length > 1 ? xs[1] - xs[0] : 0;
    assert(v.xText.length >= 3 && v.xText.length <= 8 && v.xText.every((t) => /^\d\d\.\d\d\.$/.test(t.text)) && v.xText[v.xText.length - 1].text === "20.09." &&
      xs.every((x, i) => !i || Math.abs(x - xs[i - 1] - schritt) <= 0.5) && [1, 2, 5, 7, 14].some((n) => Math.abs(schritt - n * tagX) <= 0.5),
      "6.2 Datumsachse: Tage in gleichen Schritten (1, 2, 5, 7 oder 14 Tage), der letzte ist der 20.09.", v.xText);
    assert(v.achse === "datum", "6.2 (Feinschliff 4) Kaempfe an fuenf Tagen: die Datumsachse", v.achse);
    // 6.2 der gewaehlte Tag als Band: der Tag des gewaehlten Kampfs (C, 20.09. 21:00)
    const wahlKreis = v.kreise.find((c) => c.k === v.ring);
    assert(!!v.band && !!wahlKreis && new Date(wahlKreis.at).getUTCDate() === 20 && v.band.x0 <= wahlKreis.cx && v.band.x1 >= wahlKreis.cx &&
      Math.abs(v.band.x1 - v.band.x0 - tagX) <= 0.5 && v.band.text === "20.09.",
      "6.2 der gewaehlte Tag ist hervorgehoben: ein Band ueber genau diesen Tag, mit Datum", { band: v.band, wahl: wahlKreis, tagX });
    // 6.3 y-Achse mit runden Werten und "DPS"
    assert(v.yTitel === "DPS" && rundeSchritte(v.yWerte) && v.yWerte.length >= 3 && v.yWerte.length <= 6,
      "6.3 y-Achse: DPS darueber, drei bis sechs runde Werte ab 0", { titel: v.yTitel, werte: v.yWerte });
    // Median gestrichelt, in der Legende mit Zahl; bester in Gold, einziger goldener Kreis
    const dps = v.kreise.map((c) => c.dps).sort((a, b) => a - b), h = dps.length >> 1;
    const median = dps.length % 2 ? dps[h] : (dps[h - 1] + dps[h]) / 2;
    const hoechster = v.kreise.reduce((a, c) => (c.dps > a.dps ? c : a), { dps: -1 });
    assert(!!v.med && Math.abs(v.med.wert - median) < 1e-6 && v.med.dash !== "none" && v.leg.some((l) => l.startsWith("Median ") && l.length > 7),
      "6 Median: gestrichelte Linie auf dem Median der Kaempfe im Zeitraum, in der Legende mit Zahl", { med: v.med, median, leg: v.leg });
    assert(hoechster.spitze && v.kreise.filter((c) => c.spitze).length === 1 && hoechster.fill === v.tok.gold &&
      v.kreise.filter((c) => !c.spitze).every((c) => c.fill !== v.tok.gold && c.stroke !== v.tok.gold) && v.leg.includes("bester"),
      "6 bester in Gold, sonst kein Gold", v.kreise.map((c) => [c.dps, c.spitze, c.fill]));
    // aus diesem Log gefuellt, fruehere hohl; die Legende sagt beides
    assert(v.kreise.filter((c) => c.log).length === 3 && v.kreise.filter((c) => c.log).every((c) => new Date(c.at).getUTCDate() === 20) &&
      v.kreise.filter((c) => !c.log && !c.spitze).every((c) => c.fill === "none") && v.kreise.filter((c) => c.log && !c.spitze).every((c) => c.fill === v.tok.text) &&
      v.leg.includes("aus diesem Log") && v.leg.includes("frühere Logs und gespeicherte Kämpfe"),
      "6 Kreise aus diesem Log gefuellt, fruehere und gespeicherte hohl, beides in der Legende", { kreise: v.kreise.map((c) => [c.at, c.log, c.fill]), leg: v.leg });
    assert(v.rolle === "img" && v.name.startsWith("Vulcanus") && v.name.includes("Median"), "6 das Diagramm hat Rolle und Namen", v.name);
    // 2.4 die Einordnung zieht in den Verlauf: Skala mit sonst, bester und diesem Kampf
    const e = v.einord;
    const lo = e ? Math.min(e.marken.sonst?.wert, e.marken.bester?.wert, e.marken.dieser?.wert) : 0, hi = e ? Math.max(e.marken.sonst?.wert, e.marken.bester?.wert, e.marken.dieser?.wert) : 0;
    const lage = (x) => { const a = lo - (hi - lo) / 4, b = hi + (hi - lo) / 6; return 100 * (x - a) / (b - a); };
    assert(!!e && e.rolle === "img" && /sonst/.test(e.name) && !!e.marken.sonst && !!e.marken.bester && !!e.marken.dieser &&
      ["sonst", "bester", "dieser"].every((m) => Math.abs(e.marken[m].lage - lage(e.marken[m].wert)) <= 0.05) && !!e.text && e.text === v.hHist + " \u00b7 über alle Tage",
      "2.4 Einordnung im Verlauf: der Satz (derselbe wie im Kampf) und die Skala (sonst, bester, dieser) nach einordnungSkala", { e, hHist: v.hHist });
    // 6.5 Boss als Auswahlfeld rechts ueber der Liste
    assert(!!v.boss && v.boss.tag === "SELECT" && v.boss.label === "Boss" && v.boss.inKopf && v.boss.optionen.join("|") === "Vulcanus|Ramux" && v.boss.wert.length > 0 &&
      v.boss.optionen[0] === "Vulcanus", "6.5 Boss als Auswahlfeld im Kopf der Liste, Vulcanus gewaehlt (der Boss des gewaehlten Kampfs)", v.boss);
    // 6.6 Liste: Kopf, neueste zuerst, hoechstens 5 Zeilen, rollt in sich, haftender Kopf
    assert(v.liste.titel === "Kämpfe" && v.liste.fz === "8 an Vulcanus \u00b7 neueste zuerst" && v.liste.kopf.join("|") === "Tag|Uhrzeit|Dauer|Build|DPS",
      "6.6/6.7 Liste „Kämpfe“: Tag, Uhrzeit, Dauer, Build, DPS", v.liste);
    const zeiten = v.liste.zeilen.map((z) => z.zellen[0].slice(-6) + z.zellen[1]);
    assert(!!v.liste.zeilen[7] && v.liste.zeilen[0].zellen[0].endsWith("20.09.") && v.liste.zeilen[0].zellen[1] === "21:00" && v.liste.zeilen[7].zellen[0].endsWith("01.09."),
      "6.6 neueste zuerst", zeiten);
    const zh = Math.max(...v.liste.zeilen.map((z) => z.h));
    /* Feinschliff 02.10. (Abschnitt 4): die Liste waechst mit der Fensterhoehe bis zur Unterkante der Flaeche
       statt bei fuenf Zeilen zu enden; sie endet an einer Zeilenkante. Bei 1280 x 860 passen sechs der acht. */
    assert(!!v.liste.roll && !!v.liste.th && v.liste.roll.ov === "auto" && listeFuellt(v).ok && v.liste.roll.h >= v.liste.th.h + 6 * zh - 2 &&
      v.liste.roll.sh > v.liste.roll.h && v.liste.th.pos === "sticky" && zh <= 44,
      "6.6 die Liste reicht bis zur Unterkante (sechs von acht im Blick, an einer Zeilenkante), der Rest rollt in sich, Zeilen hoechstens 44 Punkt, der Kopf haftet",
      { fuellt: listeFuellt(v), roll: v.liste.roll, th: v.liste.th, zh });
    await p.evaluate(() => { const x = document.querySelector("#histDetail .histroll"); if (x) x.scrollTop = x.scrollHeight; });
    await p.waitForFunction(() => document.querySelector("#histDetail .histroll")?.scrollTop > 0, null, { timeout: 3000 }).catch(() => {});
    const haft = await p.evaluate(() => ({ th: document.querySelector("#histDetail thead th")?.getBoundingClientRect().top ?? -99, roll: document.querySelector("#histDetail .histroll")?.getBoundingClientRect().top ?? 99 }));
    assert(Math.abs(haft.th - haft.roll) <= 1, "6.6 gerollt: der Kopf der Liste bleibt oben stehen", haft);
    // 6.7 Spalte Build: fruehere Kaempfe ohne Build tragen einen Strich
    assert(v.liste.zeilen.filter((z) => !z.zellen[0].endsWith("20.09.")).every((z) => z.zellen[3] === "\u2013"), "6.7 Spalte Build: ohne erkannten Build ein Strich",
      v.liste.zeilen.map((z) => z.zellen));
    // 6.10 "Im Vergleich öffnen" als leiser Knopf ueber der Liste
    assert(!!v.imVergleich && v.imVergleich.text === "Im Vergleich öffnen" && v.imVergleich.leise && v.imVergleich.inKopf,
      "6.10 „Im Vergleich öffnen“ als leiser Knopf im Kopf der Liste", v.imVergleich);
    // 6.1 Woche und Alles
    await p.click('#verlaufZeit [data-z="woche"]', { timeout: 3000 }).catch(() => {});
    await p.waitForFunction(() => document.querySelectorAll("#histPlotFeld svg circle.hp").length === 4, null, { timeout: 3000 }).catch(() => {});
    v = await verlaufBlick(p);
    // Pruefung 29.09., Befund 3: unter "Woche" sagt die Einordnung, dass sie ueber alle Tage rechnet
    assert(!!v.einord && v.einord.text.endsWith(" \u00b7 über alle Tage") && v.einord.name.includes("über alle Tage"),
      "2.4 Woche: die Einordnung sagt, dass ihre Skala ueber alle Tage rechnet", v.einord);
    assert(v.kopf === "Vulcanus \u00b7 4 Kämpfe \u00b7 7 Tage bis 20.09." && v.kreise.length === 4 && v.liste.zeilen.length === 4 &&
      v.zeit.find((z) => z.z === "woche")?.an === "true" && v.xText.length === 7,
      "6.1 Woche: vier Kaempfe, jeder Tag beschriftet", { kopf: v.kopf, n: v.kreise.length, x: v.xText.map((t) => t.text) });
    await p.click('#verlaufZeit [data-z="alles"]', { timeout: 3000 }).catch(() => {});
    await p.waitForFunction(() => document.querySelectorAll("#histPlotFeld svg circle.hp").length === 9, null, { timeout: 3000 }).catch(() => {});
    v = await verlaufBlick(p);
    assert(v.kopf === "Vulcanus \u00b7 9 Kämpfe \u00b7 seit 22.07." && v.kreise.length === 9 && v.xText.length <= 8,
      "6.1 Alles: neun Kaempfe seit dem 22.07.", { kopf: v.kopf, n: v.kreise.length });
    // 6.5 anderer Boss; der Fokus bleibt auf dem Auswahlfeld
    await p.focus("#histBoss", { timeout: 3000 }).catch(() => {});
    await p.selectOption("#histBoss", { label: "Ramux" }, { timeout: 3000 }).catch(() => {});
    await p.waitForFunction(() => /^Ramux/.test(document.querySelector("#histKopf")?.textContent.trim() || ""), null, { timeout: 3000 }).catch(() => {});
    v = await verlaufBlick(p);
    const fokus = await p.evaluate(() => document.activeElement?.id);
    assert(v.kopf.startsWith("Ramux \u00b7 2 Kämpfe") && v.kreise.length === 2 && fokus === "histBoss" && !v.einord,
      "6.5 Ramux gewaehlt: seine zwei Kaempfe, der Fokus bleibt im Auswahlfeld, keine Einordnung (der gewaehlte Kampf ist Vulcanus)", { kopf: v.kopf, fokus, einord: v.einord });
    // 6.10 der Knopf oeffnet den Vergleich
    await p.click("#histCmp", { timeout: 3000 }).catch(() => {});
    await p.waitForFunction(() => document.querySelector("#p-compare")?.classList.contains("on"), null, { timeout: 3000 }).catch(() => {});
    assert(await p.evaluate(() => document.querySelector("#p-compare").classList.contains("on")), "6.10 „Im Vergleich öffnen“ oeffnet den Vergleich");
    assert(!s.fehler.length, "6 Verlauf: keine Fehler", s.fehler);
    await p.close();
  }
  // --- Englisch
  {
    const s = await oeffne({ app: true, lang: "en", config: { logIndex: LOGINDEX6, runs: [LAUF6] } }); const p = s.page;
    await zumVerlauf(s);
    const v = await verlaufBlick(p);
    assert(v.zeit.map((z) => z.text).join("|") === "Week|Month|All" && v.zeitName === "Period" && v.kopf === "Vulcanus \u00b7 8 fights \u00b7 30 days to 20/09" &&
      v.liste.titel === "Fights" && v.liste.fz === "8 on Vulcanus \u00b7 newest first" && v.liste.kopf.join("|") === "Day|Time|Length|Build|DPS" &&
      v.boss?.label === "Boss" && v.imVergleich?.text === "Open in Compare" && v.leg.includes("from this log") && v.leg.includes("earlier logs and saved fights") &&
      v.xText[v.xText.length - 1]?.text === "20/09",
      "6 Englisch: Zeitraum, Kopf, Liste, Legende, Datumsachse", { zeit: v.zeit, kopf: v.kopf, liste: v.liste.kopf, leg: v.leg, x: v.xText.map((t) => t.text) });
    await p.close();
  }
  // --- Groessen: 1280 x 860, 1920 x 1080, 2000 x 1480, dazu 1000, 760, 560
  {
    const hoehe6 = {};
    for (const [breite, hoehe] of [[1280, 860], [1920, 1080], [2000, 1480], [1000, 860], [760, 860], [560, 860]]) {
      const s = await oeffne({ app: true, lang: "de", breite, hoehe, config: { logIndex: LOGINDEX6, runs: [LAUF6] } }); const p = s.page;
      await zumVerlauf(s);
      const v = await verlaufBlick(p);
      const wo = `${breite} × ${hoehe}`;
      hoehe6[breite + "x" + hoehe] = v.svg?.height;
      const zh = Math.max(...v.liste.zeilen.map((z) => z.h));
      assert(!v.quer && !v.klein.length && !s.fehler.length && v.kreise.length === 8 && zh <= 44 && !!v.liste.roll && !!v.liste.th && listeFuellt(v).ok &&
        !!v.svg && !!v.feld && v.svg.width >= v.feld.width - 48 && v.zeitSicht,
        `6 ${wo}: kein waagerechtes Rollen, Text mindestens 11 Punkt, Diagramm in voller Breite, die Liste bis zur Unterkante (mindestens fuenf Zeilen) zu je hoechstens 44 Punkt; keine Fehler`,
        { quer: v.quer, klein: v.klein, fehler: s.fehler, zh, fuellt: listeFuellt(v), roll: v.liste.roll, svg: v.svg?.width, feld: v.feld?.width });
      if (breite === 2000)
        assert(v.liste.roll.sh <= v.liste.roll.h + 1 && v.liste.zeilen.length === 8, `6 ${wo}: die Liste zeigt alle acht, ohne zu rollen`, v.liste.roll);
      if (breite === 2000)
        assert(!!v.liste.roll && !!v.liste.fk && !!v.feld && !!v.svg && v.liste.roll.r.width <= 1101 && v.liste.fk.width <= 1101 && v.feld.width > 1500 && v.svg.height >= 0.38 * hoehe && v.svg.height <= 0.46 * hoehe,
          `6 ${wo}: die Liste ein Block von hoechstens 1100 Punkt, das Diagramm breit und bis etwa 45 % der Hoehe`,
          { liste: v.liste.roll?.r?.width, fk: v.liste.fk?.width, feld: v.feld?.width, svg: v.svg?.height });
      if (breite === 1280)
        assert(!!v.svg && v.svg.height >= 230 && v.svg.height <= 0.42 * hoehe, `6 ${wo}: das Diagramm mindestens 230 Punkt hoch, hoechstens 42 % der Hoehe`, v.svg?.height);
      await p.close();
    }
    assert(hoehe6["2000x1480"] > hoehe6["1280x860"] + 150, "6.4 grosse Fenster nutzen die Hoehe: das Diagramm waechst mit dem Fenster", hoehe6);
  }
  // --- Feinschliff 02.10., Abschnitt 4: der Abend zuerst - sechs Pulls an einem Abend stehen nacheinander
  {
    const ABEND6 = join(work, "TLCombatLog-abend6.txt");
    writeFileSync(ABEND6, logText(Array.from({ length: 6 }, (_, i) => ({ target: "Vulcanus", start: at(19, 4 + 3 * i, 40), secs: 40 + 5 * i, scale: 1 + 0.05 * i }))));
    for (const [lang, breite, hoehe] of [["de", 1280, 860], ["en", 2000, 1480], ["de", 560, 860]]) {
      const s = await oeffne({ app: true, lang, breite, hoehe }); const p = s.page;
      await mitLog(s, ABEND6);
      await bereich(p, "history");
      await p.waitForFunction(() => document.querySelectorAll("#histPlotFeld svg circle.hp").length === 6, null, { timeout: 5000 }).catch(() => {});
      const v = await verlaufBlick(p);
      const wo = `${lang} ${breite} \u00d7 ${hoehe}`;
      const xs = v.kreise.map((c) => c.cx);
      assert(v.achse === "pull" && v.kreise.length === 6 && xs.every((x, i) => !i || x > xs[i - 1]) && !!v.svg && Math.max(...xs) - Math.min(...xs) >= 0.6 * v.svg.width,
        `4 ${wo}: ein Abend - die Pull-Achse, alle sechs Punkte ueber mindestens 60 % der Diagrammbreite`, { achse: v.achse, xs, breite: v.svg?.width });
      const gleich = xs.every((x, i) => i < 2 || Math.abs(x - xs[i - 1] - (xs[1] - xs[0])) <= 0.5);
      assert(gleich && v.xText.length >= 2 && v.xText.every((t) => /^\d\d:\d\d$/.test(t.text)) && v.xText[0].text === "19:04" &&
        (breite < 1000 || v.xText.map((t) => t.text).join() === "19:04,19:07,19:10,19:13,19:16,19:19"),
        `4 ${wo}: Pull 1 bis 6 in gleichen Abstaenden, beschriftet mit der Uhrzeit`, { xs, x: v.xText });
      const leg = lang === "de" ? "Pull für Pull \u00b7 ein Abend" : "pull by pull \u00b7 one evening";
      assert(v.leg.includes(leg) && v.name.includes(lang === "de" ? "Pull für Pull" : "pull by pull"),
        `4 ${wo}: Legende und Name des Diagramms sagen, dass x die Reihenfolge ist`, { leg: v.leg, name: v.name });
      assert(v.bandText === (lang === "de" ? "20.09." : "20/09") && !v.band, `4 ${wo}: der Tag des Abends steht ueber dem Diagramm, ohne Band ueber die ganze Flaeche`, { t: v.bandText, band: v.band });
      if (breite === 2000)
        assert(v.liste.zeilen.length === 6 && !!v.liste.roll && v.liste.roll.sh <= v.liste.roll.h + 1, `4 ${wo}: die Liste zeigt alle sechs`, v.liste.roll);
      assert(!v.quer && !v.klein.length && !s.fehler.length && listeFuellt(v).ok, `4 ${wo}: kein Querrollen, Text mindestens 11 Punkt, Liste bis zur Unterkante; keine Fehler`,
        { quer: v.quer, klein: v.klein, fehler: s.fehler, fuellt: listeFuellt(v) });
      await p.close();
    }
    /* Ein Abend ueber Mitternacht (Pruefung, Befund 4): die erste Marke des neuen Tages traegt das Datum dazu */
    const MITTERNACHT = join(work, "TLCombatLog-mitternacht.txt");
    writeFileSync(MITTERNACHT, logText([Date.UTC(2026, 8, 20, 23, 40), Date.UTC(2026, 8, 20, 23, 50), Date.UTC(2026, 8, 21, 0, 20)]
      .map((start, i) => ({ target: "Vulcanus", start, secs: 40, scale: 1 + 0.1 * i }))));
    for (const lang of ["de", "en"]) {
      const s = await oeffne({ app: true, lang }); const p = s.page;
      await mitLog(s, MITTERNACHT);
      await bereich(p, "history");
      await p.waitForFunction(() => document.querySelectorAll("#histPlotFeld svg circle.hp").length === 3, null, { timeout: 5000 }).catch(() => {});
      const v = await verlaufBlick(p);
      const erwartet = lang === "de" ? "23:40,23:50,21.09. 00:20" : "23:40,23:50,21/09 00:20";
      assert(v.achse === "pull" && v.xText.map((t) => t.text).join() === erwartet && !s.fehler.length,
        `4 (${lang}) ueber Mitternacht: Pull-Achse, die erste Marke des neuen Tages mit Datum`, { achse: v.achse, x: v.xText, fehler: s.fehler });
      await p.close();
    }
  }

  // ===== Abschnitt 7: Gruppe (Luecken 7) =====
  /* Eine laufende Gruppe, wie /api/party/state sie meldet: drei Mitglieder mit je zwoelf Faehigkeiten und
     ihren vier Trefferarten (cats, wie partyPayload sie schickt), dazu eines, das noch keinen Kampf gemeldet
     hat. Namen sind Platzhalter, keine Spielernamen; die Zahlen erfunden, aber in sich stimmig: die Arten
     einer Faehigkeit ergeben ihren Schaden. */
  const NAMEN7 = ["Quick Fire", "Detonation Mark", "Strafing", "Decisive Sniping", "Blade Storm", "Brutal Arrow", "Flash Arrow",
    "Agile Shot", "Arrow Vortex", "Weak Point Shot", "Storm Current", "Basic Shot"];
  const faehigkeiten7 = (skala) => NAMEN7.map((name, i) => {
    const hits = 40 - 2 * i, damage = Math.round(skala * (240000 - 17000 * i));
    // Fixrunde 1 (Befund 4): die Treffer je Art aus den Treffern der Faehigkeit, der Rest nie negativ
    const anteile = [0.3, 0.3, 0.2], hs = [Math.ceil(0.3 * hits), Math.ceil(0.25 * hits), Math.ceil(0.2 * hits)], arten = [];
    let rest = damage, hrest = hits;
    ["normal", "crit", "heavy"].forEach((k, j) => { const d = Math.round(damage * anteile[j]); arten.push({ k, d, h: hs[j], m: Math.round(d / hs[j] * 1.4) }); rest -= d; hrest -= hs[j]; });
    arten.push({ k: "critheavy", d: rest, h: hrest, m: Math.round(rest / hrest * 1.3) });
    return { name, sid: "", damage, dps: Math.round(damage / 60), hits, crit: arten[1].h + arten[3].h, heavy: arten[2].h + arten[3].h,
      max: Math.max(...arten.map((a) => a.m)), cats: arten };
  });
  const mitglied7 = (name, skala, weapons, age) => {
    const skills = faehigkeiten7(skala), damage = skills.reduce((a, k) => a + k.damage, 0);
    return { name, waiting: false, damage, dps: Math.round(damage / 60), hits: skills.reduce((a, k) => a + k.hits, 0), crit: 0.4, heavy: 0.3,
      seconds: 60, max: Math.max(...skills.map((k) => k.max)), skills, hasCurve: false, share: 0, onTarget: true, target: "Vulcanus",
      lang: "en", weapons, ventius: false, age };
  };
  const BOARD7 = [mitglied7("Mitglied Zwei", 0.8, ["Dagger", "Crossbow"], 11), mitglied7("Mitglied Eins", 1.0, ["Longbow", "Crossbow"], 4),
    mitglied7("Mitglied Drei", 1.25, ["Staff", "Dagger"], 6),
    { name: "Mitglied Vier", waiting: true, damage: 0, dps: 0, hits: 0, crit: 0, heavy: 0, seconds: 0, max: 0, skills: [], hasCurve: false,
      share: 0, onTarget: false, target: "", lang: "en", weapons: ["Sword and Shield", "Greatsword"], ventius: false, age: 9 }];
  const GRUPPE7 = { role: "host", code: "K7QX", name: "Mitglied Eins", address: "192.168.1.5:8733", join: "K7QX@192.168.1.5:8733",
    remote: false, board: BOARD7, target: "Vulcanus", error: "" };
  /* Was der Bereich Gruppe zeigt. */
  const gruppeBlick = (p) => p.evaluate(() => {
    const q = (x) => document.querySelector(x);
    const r = (e) => e && e.getClientRects().length ? e.getBoundingClientRect().toJSON() : null;
    const sicht = (e) => !!e && e.getClientRects().length > 0 && getComputedStyle(e).visibility !== "hidden";
    const probe = document.createElement("i"); document.body.appendChild(probe);
    const farbe = (v) => { probe.style.color = ""; probe.style.color = v; return getComputedStyle(probe).color; };
    const reihen = Array.from({ length: 12 }, (_, i) => farbe("var(--series-" + (i + 1) + ")"));
    probe.remove();
    const klein = [];
    for (const wurzel of [q("#p-party"), q("#bereichKopf")]) {
      const it = document.createTreeWalker(wurzel, NodeFilter.SHOW_TEXT);
      for (let n; (n = it.nextNode()); ) {
        const e = n.parentElement;
        if (!n.textContent.trim() || !e || e.closest(".vh") || !sicht(e)) continue;
        const g = parseFloat(getComputedStyle(e).fontSize);
        if (g < 11) klein.push(n.textContent.trim().slice(0, 24) + ":" + g);
      }
    }
    const zeilen = [...document.querySelectorAll("#pTafel .btr")].map((z) => ({ m: z.dataset.m, r: r(z), rang: z.querySelector(".brang")?.textContent.trim(),
      name: z.querySelector(".bwer b")?.textContent, klasse: z.querySelector(".bkl")?.textContent.trim(), dps: z.querySelector(".bd")?.textContent.trim(),
      auf: z.querySelector(".aufk")?.getAttribute("aria-expanded"), aufName: z.querySelector(".aufk")?.getAttribute("aria-label") || "",
      spur: z.querySelector(".gspur i") ? parseFloat(z.querySelector(".gspur i").style.width) : null,
      spurFarbe: z.querySelector(".gspur i") ? getComputedStyle(z.querySelector(".gspur i")).backgroundColor : null,
      spurUnter: !!z.querySelector(".gspur") && !!z.querySelector(".bwer b") && z.querySelector(".gspur").getBoundingClientRect().top >= z.querySelector(".bwer b").getBoundingClientRect().bottom - 1,
      marke: z.querySelector(".bwer > i") ? getComputedStyle(z.querySelector(".bwer > i")).backgroundColor : null,
      kick: z.querySelector("[data-kick]")?.getAttribute("aria-label") || null, geht: z.classList.contains("geht"),
      // Feinschliff 6: Initiale und Alter leise in der Zeile, Entfernen nur beim Zeigen oder Fokus
      initiale: z.querySelector(".bwer > i")?.textContent ?? null, alter: (z.querySelector(".bwer small")?.textContent || "").trim(),
      kickDeckung: z.querySelector("[data-kick]") ? getComputedStyle(z.querySelector("[data-kick]")).opacity : null }));
    /* Wer noch keinen Kampf gemeldet hat, steht seit Feinschliff 6 unter den Meldenden im Board (statt in einer zweiten Liste). */
    const warte = [...document.querySelectorAll("#pTafel .bwart")].map((z) => ({ m: z.dataset.m, r: r(z), rang: z.querySelector(".brang")?.textContent.trim(),
      name: z.querySelector(".bwer b")?.textContent, initiale: z.querySelector(".bwer > i")?.textContent ?? null,
      marke: z.querySelector(".bwer > i") ? getComputedStyle(z.querySelector(".bwer > i")).backgroundColor : null,
      alter: (z.querySelector(".bwer small")?.textContent || "").trim(), dps: z.querySelector(".bd")?.textContent.trim(),
      kick: z.querySelector("[data-kick]")?.getAttribute("aria-label") || null }));
    const skills = (m) => [...document.querySelectorAll('#pTafel .mskills[data-m="' + m + '"] .msk:not(.mskopf)')].map((z) => ({ k: z.dataset.k,
      name: z.querySelector(".nm")?.textContent, werte: [...z.querySelectorAll(".tv")].map((t) => t.textContent.trim()), r: r(z),
      auf: z.querySelector(".mskauf")?.getAttribute("aria-expanded") ?? null,
      arten: [...document.querySelectorAll('#pTafel .mskills[data-m="' + m + '"] .mcat[data-k="' + z.dataset.k + '"]')].map((c) => ({ cat: c.dataset.cat,
        label: c.querySelector(".nm")?.textContent, d: +c.dataset.d, h: +c.dataset.h })) }));
    const mitgl = [...document.querySelectorAll("#p-party .mitgl")].map((m) => ({ name: m.querySelector("b")?.textContent, sub: m.querySelector("small")?.textContent || "",
      initiale: m.querySelector(".av")?.textContent, farbe: m.querySelector(".av") ? getComputedStyle(m.querySelector(".av")).backgroundColor : null,
      punkt: m.querySelector(".av") ? getComputedStyle(m.querySelector(".av"), "::after").backgroundColor : null, r: r(m) }));
    const wo = [...document.querySelectorAll("#pWo [role=radio]")].map((b) => ({ wo: b.dataset.wo, text: b.textContent.trim(), an: b.getAttribute("aria-checked") }));
    const code = q("#pCode .code");
    return {
      ctx: (q("#bkCtx")?.textContent || "").trim(), ctxSicht: sicht(q("#bkCtx")), kampfSicht: sicht(q("#bkKampf")),
      wege: sicht(q("#pWege")), wegeAuf: q("#pWegeAuf") ? { sicht: sicht(q("#pWegeAuf")), offen: q("#pWegeAuf").open, r: r(q("#pWegeAuf")),
        titel: (q("#pWegeAuf > summary")?.textContent || "").trim(), wegeDrin: !!q("#pWegeAuf #pWege"),
        // im zugeklappten details: nicht zu sehen (checkVisibility sieht content-visibility, getClientRects nicht)
        wegeSicht: !!q("#pWege")?.checkVisibility() } : null, start: r(q("#pStart")), beitritt: r(q("#pBeitritt")), name: r(q("#pNameFeld")),
      startTitel: (q("#pStart h3")?.textContent || "").trim(), beitrittTitel: (q("#pBeitritt h3")?.textContent || "").trim(),
      woRolle: q("#pWo")?.getAttribute("role") || "", woName: q("#pWo")?.getAttribute("aria-label") || "", wo,
      server: sicht(q("#pServer")), serverWert: q("#pServer")?.value ?? null, hostNote: sicht(q("#pHostNote")) ? q("#pHostNote").textContent.trim() : "",
      host: q("#pHost") ? { text: q("#pHost").textContent.trim(), aus: q("#pHost").disabled } : null,
      joinFeld: q("#pJoin") ? { wert: q("#pJoin").value, max: q("#pJoin").maxLength, ph: q("#pJoin").placeholder, r: r(q("#pJoin")) } : null,
      join: q("#pJoinBtn") ? { text: q("#pJoinBtn").textContent.trim(), aus: q("#pJoinBtn").disabled } : null,
      joinHint: (q("#pJoinHint")?.textContent || "").trim(), joinSrv: sicht(q("#pJoinSrv")) ? q("#pJoinSrv").value : null,
      joinSrvLabel: (q('label[for="pJoinSrv"]')?.textContent || "").replace(/\s+/g, " ").trim(),
      ohne: sicht(q("#pOhne")) ? q("#pOhne").textContent.trim() : "",
      mitgl,
      board: sicht(q("#pBoard")), boardTitel: (q("#pBoard .fk h3")?.textContent || "").trim(), boardFz: (q("#pBoard .fk .fz")?.textContent || "").trim(),
      bsp: [...document.querySelectorAll("#p-party .bsp")].filter(sicht).map((b) => b.textContent.trim()),
      code: code ? { text: code.textContent, groesse: parseFloat(getComputedStyle(code).fontSize), name: code.getAttribute("aria-label") } : null,
      codeblock: r(q("#pBoard .codeblock")), tafel: r(q("#pTafel")), boardR: r(q("#pBoard")), tafelRolle: q("#pTafel")?.getAttribute("role") || "",
      kopfzeile: [...document.querySelectorAll("#pTafel .bth [role=columnheader]")].map((c) => c.textContent.trim()),
      status: (q("#pStatus")?.textContent || "").trim(), kopie: sicht(q("#pCopy")) ? q("#pCopy").textContent.trim() : "",
      speichern: sicht(q("#btnSavePartyLog")) ? q("#btnSavePartyLog").textContent.trim() : "", verlassen: sicht(q("#pLeave")) ? q("#pLeave").textContent.trim() : "",
      beitrittsZeile: (q("#pCode .joinline")?.textContent || "").replace(/\s+/g, " ").trim(),
      zeilen, warte, summe: q("#pTafel .bsum") ? [...q("#pTafel .bsum").children].map((c) => c.textContent.trim()) : null,
      skillsEins: skills("Mitglied Eins"), skillsDrei: skills("Mitglied Drei"),
      mskopf: [...document.querySelectorAll('#pTafel .mskills[data-m="Mitglied Eins"] .mskopf > span')].map((c) => c.textContent.trim()),
      msatz: (q('#pTafel .mskills[data-m="Mitglied Eins"] .msatz')?.textContent || "").replace(/\s+/g, " ").trim(),
      zuKampf: sicht(q('#pTafel .mskills[data-m="Mitglied Eins"] [data-zukampf]')),
      reihen, quer: document.documentElement.scrollWidth > innerWidth, klein,
    };
  });
  /* Warten, bis der Helfer die Handlung bekommen hat (ein Zustand, keine feste Zeit). */
  const bis = async (f, ms = 3000) => { const ende = Date.now() + ms; while (!f() && Date.now() < ende) await new Promise((r) => setTimeout(r, 25)); };
  const zurGruppe = async (s, mitLogDatei = true) => {
    if (mitLogDatei) await mitLog(s);
    await bereich(s.page, "party");
    await s.page.waitForFunction(() => !!document.querySelector("#p-party.on"), null, { timeout: 5000 }).catch(() => {});
  };

  // --- 7.1-7.4, 7.9: ohne Gruppe - die zwei Wege nebeneinander, "Dein Charakter" darueber, nur der Satz statt eines Boards
  {
    const s = await oeffne({ app: true });
    const p = s.page;
    await zurGruppe(s);
    let g = await gruppeBlick(p);
    assert(g.ctx === "No party yet" && g.ctxSicht && !g.kampfSicht, "7.1 Kopf: Party \u00b7 No party yet, ohne den Kampf", { ctx: g.ctx, kampf: g.kampfSicht });
    assert(g.wege && g.startTitel === "Start a party" && g.beitrittTitel === "Join a party" && g.start && g.beitritt &&
      Math.abs(g.start.top - g.beitritt.top) < 1 && g.start.right <= g.beitritt.left,
      "7.2/7.3 zwei Felder nebeneinander: Start a party | Join a party", { start: g.start, beitritt: g.beitritt });
    assert(g.name && g.name.bottom <= Math.min(g.start.top, g.beitritt.top) + 1 && Math.abs(g.name.left - g.start.left) < 1 &&
      Math.abs(g.name.right - g.beitritt.right) < 1, "7.4 \u201eYour character\u201c als Zeile ueber beiden Feldern, so breit wie beide", { name: g.name });
    assert(g.woRolle === "radiogroup" && g.woName === "Where the party runs" &&
      JSON.stringify(g.wo) === JSON.stringify([{ wo: "pc", text: "On this PC", an: "true" }, { wo: "server", text: "Own server", an: "false" }]) &&
      !g.server && /firewall/i.test(g.hostNote) && g.host?.text === "Start party",
      "7.2 Starten: On this PC | Own server, ohne Server der Satz zur Firewall, Knopf Start party", { wo: g.wo, server: g.server, note: g.hostNote, host: g.host });
    assert(!g.board && !g.mitgl.length && /start/i.test(g.ohne) && /code/i.test(g.ohne) && !g.bsp.length,
      "7.9 ohne Gruppe: kein Board, keine Mitglieder, kein Beispiel - nur der Satz, wie man eine startet", { ohne: g.ohne, board: g.board, bsp: g.bsp });
    // 7.2: Eigener Server - das Feld fuer die Adresse erscheint, der Fokus bleibt auf der Wahl
    await p.click('#pWo [data-wo="server"]');
    await p.waitForFunction(() => document.querySelector('#pWo [data-wo="server"]').getAttribute("aria-checked") === "true", null, { timeout: 3000 }).catch(() => {});
    g = await gruppeBlick(p);
    const fokus = await p.evaluate(() => document.activeElement?.dataset?.wo);
    assert(g.server && g.wo[1].an === "true" && g.wo[0].an === "false" && fokus === "server" && !/firewall/i.test(g.hostNote),
      "7.2 Own server: Adresse im Feld, der Fokus bleibt auf der Wahl, kein Satz zur Firewall", { server: g.server, fokus, note: g.hostNote });
    // Pfeiltasten wechseln wie in einer Radiogruppe
    await p.keyboard.press("ArrowLeft");
    await p.waitForFunction(() => document.querySelector('#pWo [data-wo="pc"]').getAttribute("aria-checked") === "true", null, { timeout: 3000 }).catch(() => {});
    const links = await p.evaluate(() => ({ an: document.querySelector('#pWo [data-wo="pc"]').getAttribute("aria-checked"), fokus: document.activeElement?.dataset?.wo,
      tab: [...document.querySelectorAll("#pWo [role=radio]")].map((b) => b.tabIndex) }));
    assert(links.an === "true" && links.fokus === "pc" && JSON.stringify(links.tab) === "[0,-1]", "7.2 Pfeiltaste nach links: On this PC, ein Tabstopp", links);
    // ohne Namen gesperrt (der Name aus dem Log steht vorab darin), mit Namen: Starten auf diesem PC geht an /api/party/host
    const vorab = await p.inputValue("#pName");
    await p.fill("#pName", "");
    g = await gruppeBlick(p);
    const sperre = await p.evaluate(() => ({ lock: document.querySelector("#pHostLock").textContent, beschrieben: document.querySelector("#pHost").getAttribute("aria-describedby") }));
    assert(vorab === "Tester" && g.host?.aus === true && g.join?.aus === true && sperre.lock === "Put your character name in first." && sperre.beschrieben.includes("pHostLock"),
      "7.4 der Charakter steht vorab aus dem Log; ohne ihn sind Starten und Beitreten gesperrt, der Grund steht am Knopf", { vorab, host: g.host, sperre });
    await p.fill("#pName", "Mitglied Eins");
    await p.click("#pHost");
    await bis(() => s.party.length >= 1);
    assert(s.party.length === 1 && s.party[0].path === "/api/party/host" && s.party[0].body.name === "Mitglied Eins",
      "7.2 Starten auf diesem PC: /api/party/host mit dem Charakter", s.party);
    // auf dem eigenen Server: /api/party/create mit der Adresse aus dem Feld
    await p.click('#pWo [data-wo="server"]');
    await p.waitForFunction(() => !!document.querySelector("#pServer")?.getClientRects().length, null, { timeout: 3000 }).catch(() => {});
    await p.fill("#pServer", "203.0.113.5:8732");
    await p.click("#pHost");
    await bis(() => s.party.length >= 2);
    assert(s.party.length === 2 && s.party[1].path === "/api/party/create" && s.party[1].body.server === "203.0.113.5:8732" && s.party[1].body.name === "Mitglied Eins",
      "7.2 Starten auf dem eigenen Server: /api/party/create mit der Adresse aus dem Feld", s.party);
    // 7.3: Beitreten - grosses Codefeld, gefiltert, gesperrt bis vier Zeichen, optionale Adresse
    g = await gruppeBlick(p);
    assert(g.joinFeld && g.joinFeld.max === 4 && g.joinFeld.ph === "\u00b7\u00b7\u00b7\u00b7" && g.joinFeld.r.height >= 40 && g.join?.text === "Join" && g.join.aus &&
      /0, O, 1 and I/.test(g.joinHint) && g.joinSrv === "" && g.joinSrvLabel === "Server address optional",
      "7.3 Beitreten: Codefeld fuer vier Zeichen, Knopf Join gesperrt, Hinweis auf 0, O, 1 und I, Server-Adresse optional", g);
    await p.click("#pJoin");
    await p.keyboard.type("k7q0x1");
    g = await gruppeBlick(p);
    assert(g.joinFeld.wert === "K7QX" && !g.join.aus && /K7QX/.test(g.joinHint), "7.3 der Code wird beim Tippen gefiltert (ohne 0 und 1, gross): K7QX, Join frei", g.joinFeld);
    await p.click("#pJoinBtn");
    await bis(() => s.party.length >= 3);
    assert(s.party.length === 3 && s.party[2].path === "/api/party/join" && s.party[2].body.join === "K7QX", "7.3 ohne Adresse: nur der Code", s.party[2]);
    await p.fill("#pJoinSrv", "203.0.113.5:8732");
    await p.click("#pJoinBtn");
    await bis(() => s.party.length >= 4);
    assert(s.party.length === 4 && s.party[3].body.join === "K7QX@203.0.113.5:8732", "7.3 mit Server-Adresse: Code@Adresse", s.party[3]);
    // eine ganze Beitrittsadresse vom Host, ins Codefeld eingefuegt, verteilt sich auf beide Felder
    await p.fill("#pJoinSrv", "");
    await p.evaluate(() => { const f = document.querySelector("#pJoin"); f.value = "XM4F@192.168.1.5:8733"; f.dispatchEvent(new Event("input", { bubbles: true })); });
    g = await gruppeBlick(p);
    assert(g.joinFeld.wert === "XM4F" && g.joinSrv === "192.168.1.5:8733", "7.3 eine Beitrittsadresse CODE@Adresse verteilt sich auf Code und Adresse", g);
    assert(!s.fehler.length, "7 ohne Gruppe: keine Fehler", s.fehler);
    await p.close();
  }

  // --- 7.2 mit eingetragenem Gruppen-Server: vorgewaehlt, die Adresse steht im Feld
  {
    const s = await oeffne({ app: true, partyServer: "203.0.113.9:8732" });
    await zurGruppe(s);
    await s.page.waitForFunction(() => document.querySelector('#pWo [data-wo="server"]')?.getAttribute("aria-checked") === "true", null, { timeout: 3000 }).catch(() => {});
    const g = await gruppeBlick(s.page);
    assert(g.wo[1]?.an === "true" && g.server && g.serverWert === "203.0.113.9:8732", "7.2 ein eingetragener Gruppen-Server ist vorgewaehlt und steht im Feld", { wo: g.wo, wert: g.serverWert });
    /* Fixrunde 1 (Befund 2) zog das Speichern des Gruppen-Servers hierher; seit Aufgabe 8 steht es wie im
       Entwurf (E:942) im Abschnitt Gruppe und Server der Einstellungen - die Proben dafuer, gleich streng, in
       Abschnitt 10 (10.9). Hier bleibt: das Feld traegt die gespeicherte Adresse, und Speichern gibt es nicht doppelt. */
    const p = s.page;
    const doppelt = await p.evaluate(() => ["#pServerSave", "#pServerStatus", "#pServerCheck", "#pServerOffen"].filter((x) => document.querySelector(x)));
    assert(!doppelt.length, "7.2 Speichern und Pruefen des Gruppen-Servers stehen nicht im Bereich Gruppe (nur in den Einstellungen, 10.9)", doppelt);
    await p.close();
  }

  // --- 7.5-7.8, 7.10: laufende Gruppe - Mitglieder, Board mit Code im Kopf, aufklappbare Mitglieder mit Trefferarten
  {
    const s = await oeffne({ app: true, gruppe: GRUPPE7 });
    const p = s.page;
    await zurGruppe(s);
    await p.waitForFunction(() => document.querySelectorAll("#pTafel .btr").length === 3, null, { timeout: 8000 }).catch(() => {});
    let g = await gruppeBlick(p);
    assert(g.ctx === "Party running \u00b7 K7QX" && !g.kampfSicht, "7.1 Kopf: Party running \u00b7 K7QX", g.ctx);
    assert(!g.wege && !g.ohne && g.board && !g.mitgl.length && g.wegeAuf && !g.wegeAuf.sicht,
      "7.10 laufende Gruppe: das Board statt der Wege zum Starten und Beitreten, kein Satz, keine zweite Mitgliederliste (Feinschliff 6)",
      { wege: g.wege, ohne: g.ohne, board: g.board, mitgl: g.mitgl.length, wegeAuf: g.wegeAuf });
    /* 7.5 (Feinschliff 6, 02.10.): die doppelte Mitgliederliste entfiel - was sie trug, steht in der Zeile des Boards:
       die Initiale in der Reihenfarbe (aus dem Teil, der die Namen unterscheidet: alle heissen "Mitglied ..."),
       das Alter leise, die Waffen in der Spalte Klasse; wer nichts gemeldet hat, steht unter den Meldenden und sagt es. */
    const ini = { "Mitglied Eins": "E", "Mitglied Zwei": "Z", "Mitglied Drei": "D", "Mitglied Vier": "V" };
    assert(g.zeilen.length === 3 && g.zeilen.every((z) => z.initiale === ini[z.m] && z.marke && z.marke !== "rgba(0, 0, 0, 0)") &&
      g.zeilen.find((z) => z.m === "Mitglied Eins")?.alter === "4\u00a0s ago" && g.zeilen.find((z) => z.m === "Mitglied Zwei")?.alter === "11\u00a0s ago" &&
      g.warte.length === 1 && g.warte[0].m === "Mitglied Vier" && g.warte[0].initiale === "V" && g.warte[0].alter === "no fights yet" &&
      g.warte[0].dps === "\u2013" && g.warte[0].rang === "" && g.warte[0].r.height <= 44.5 && g.reihen.includes(g.warte[0].marke) &&
      g.warte[0].r.top >= Math.max(...g.zeilen.map((z) => z.r.bottom)) - 1 && g.zeilen.find((z) => z.m === "Mitglied Eins")?.klasse.includes("Longbow/Crossbow"),
      "7.5 Mitglieder im Board: Initiale in der Reihenfarbe (unterscheidender Teil), vor N s leise in der Zeile, Waffen in Klasse; wer nichts gemeldet hat, steht darunter ohne Rang und sagt es",
      { zeilen: g.zeilen.map((z) => [z.m, z.initiale, z.alter]), warte: g.warte });
    // 7.6 Board: Kopf, Code gross, Tabelle # | Mitglied | Klasse | DPS, Spur unter dem Namen in der Reihenfarbe, Summe
    assert(g.board && g.boardTitel === "Board" && /^3 of 4 reporting \u00b7 Vulcanus \u00b7 as of \d\d:\d\d$/.test(g.boardFz), "7.6 Board: Kopf mit 3 of 4 reporting \u00b7 Vulcanus \u00b7 Stand", g.boardFz);
    assert(g.code && g.code.text === "K7QX" && g.code.groesse >= 40 && g.code.name === "Party code K 7 Q X" && g.codeblock && g.tafel && g.codeblock.right <= g.tafel.left + 1,
      "7.10 Kopf des Boards: der Code gross links, fuer den Vorleser buchstabiert", g.code);
    assert(g.status === "\u25cf 4 connected" && g.kopie === "Copy the join address" && g.speichern === "Save party log" && g.verlassen === "Close the party" &&
      g.beitrittsZeile.includes("K7QX@192.168.1.5:8733"),
      "7.10 Kopf des Boards: Status, Beitrittsadresse mit Kopieren, Gruppen-Log speichern, Schliessen", g);
    assert(g.tafelRolle === "table" && JSON.stringify(g.kopfzeile) === JSON.stringify(["#", "Member", "Class", "DPS"]) &&
      JSON.stringify(g.zeilen.map((z) => z.m)) === JSON.stringify(["Mitglied Drei", "Mitglied Eins", "Mitglied Zwei"]) &&
      JSON.stringify(g.zeilen.map((z) => z.rang)) === JSON.stringify(["1", "2", "3"]),
      "7.6 Tabelle # | Member | Class | DPS, nach DPS geordnet", { kopf: g.kopfzeile, zeilen: g.zeilen.map((z) => z.m) });
    const maxDps = BOARD7[2].dps;
    assert(g.zeilen.every((z) => z.r.height <= 44.5 && z.spurUnter && Math.abs(z.spur - 100 * BOARD7.find((b) => b.name === z.m).dps / maxDps) < 0.2) &&
      new Set(g.zeilen.map((z) => z.spurFarbe)).size === 3 && g.zeilen.every((z) => z.spurFarbe === z.marke && g.reihen.includes(z.spurFarbe)) &&
      g.zeilen.every((z) => !!z.initiale) && new Set([...g.zeilen.map((z) => z.marke), ...g.warte.map((w) => w.marke)]).size === 4,
      "7.6 Zeilen hoechstens 44 Punkt, Spur unter dem Namen im Verhaeltnis der DPS, bunt nach #34 (je Mitglied eine Reihenfarbe, dieselbe in Marke, Spur und Initiale)", g.zeilen);
    assert(g.zeilen.find((z) => z.m === "Mitglied Eins")?.klasse === "Scout \u00b7 Longbow/Crossbow" && g.zeilen.find((z) => z.m === "Mitglied Drei")?.dps === (BOARD7[2].dps / 1000).toFixed(1) + "k",
      "7.6 Klasse und Waffen, DPS als Kurzzahl", g.zeilen);
    const summe = BOARD7.reduce((a, b) => a + b.dps, 0);
    assert(g.summe && g.summe[1] === "Party" && g.summe[2] === "together, 3 members" && g.summe[3] === (summe / 1000).toFixed(1) + "k",
      "7.6 Summe: Party \u00b7 together, 3 members \u00b7 DPS", g.summe);
    // 7.7 das eigene Mitglied steht offen: zwoelf Faehigkeiten mit Schaden, DPS, Treffer, Kritisch, Stark, Groesster
    assert(g.zeilen.find((z) => z.m === "Mitglied Eins")?.auf === "true" && g.zeilen.filter((z) => z.m !== "Mitglied Eins").every((z) => z.auf === "false") &&
      g.zeilen.every((z) => z.aufName === "Skills of " + z.m), "7.7 das eigene Mitglied offen, die anderen zu, jeder Knopf benannt", g.zeilen.map((z) => [z.m, z.auf]));
    const q1 = BOARD7[1].skills[0];
    assert(g.skillsEins.length === 12 && JSON.stringify(g.mskopf) === JSON.stringify(["Skill", "Damage", "DPS", "Hits", "Critical", "Heavy", "Largest"]) &&
      g.skillsEins[0].name === "Quick Fire" && JSON.stringify(g.skillsEins[0].werte) ===
        JSON.stringify(["240.0k", "4.0k", "40", Math.round(100 * q1.crit / q1.hits) + "\u00a0%", Math.round(100 * q1.heavy / q1.hits) + "\u00a0%", (q1.max / 1000).toFixed(1) + "k"]) &&
      g.skillsEins.every((z) => z.r.height <= 44.5),
      "7.7 aufgeklappt: zwoelf Faehigkeiten mit Schaden, DPS, Treffer, Kritisch und Stark als Anteil, Groesster; Zeilen hoechstens 44 Punkt", { kopf: g.mskopf, erste: g.skillsEins[0] });
    // Fixrunde 1 (Befund 4): stimmige Testdaten - jede Faehigkeit zeigt Kritisch und Stark zwischen 0 und 100 %
    const anteilOk = (x) => /^\d+\u00a0%$/.test(x) && +x.replace(/\D/g, "") <= 100;
    assert(g.skillsEins.length === 12 && g.skillsEins.every((z) => anteilOk(z.werte[3]) && anteilOk(z.werte[4])) &&
      BOARD7.filter((m) => !m.waiting).every((m) => m.skills.every((k) => k.cats.every((c) => c.h > 0) && k.cats.reduce((a, c) => a + c.h, 0) === k.hits)),
      "7.7 alle zwoelf Faehigkeiten: Kritisch und Stark zwischen 0 und 100 %, die Arten ergeben die Treffer", g.skillsEins.map((z) => z.werte.slice(3, 5)));
    assert(g.zuKampf && !/only their own log/.test(g.msatz), "7.8 der Satz des Entwurfs (\u201esieht nur sein eigenes Log\u201c) entfaellt; beim eigenen Mitglied der Weg zu den Trefferarten im Kampf", g.msatz);
    // 7.8 die vier Trefferarten: eine Faehigkeit aufklappen
    assert(g.skillsEins.length === 12 && g.skillsEins.every((z) => z.auf === "false" && !z.arten.length), "7.8 Faehigkeiten zu, Trefferarten erst auf Klick", g.skillsEins.map((z) => z.auf));
    await p.click('#pTafel .mskills[data-m="Mitglied Eins"] .msk[data-k="Quick Fire"] .mskauf');
    await p.waitForFunction(() => document.querySelectorAll('#pTafel .mcat[data-k="Quick Fire"]').length > 0, null, { timeout: 3000 }).catch(() => {});
    g = await gruppeBlick(p);
    const qf = g.skillsEins.find((z) => z.k === "Quick Fire");
    const fokusArt = await p.evaluate(() => document.activeElement?.closest(".msk")?.dataset.k);
    assert(qf?.auf === "true" && JSON.stringify(qf.arten.map((a) => a.cat)) === JSON.stringify(["normal", "crit", "heavy", "critheavy"]) &&
      JSON.stringify(qf.arten.map((a) => a.label)) === JSON.stringify(["Normal", "Critical Hit", "Heavy Attack", "Critical Heavy Attack"]) &&
      qf.arten.reduce((a, x) => a + x.d, 0) === q1.damage && qf.arten.reduce((a, x) => a + x.h, 0) === q1.hits && fokusArt === "Quick Fire",
      "7.8 Quick Fire aufgeklappt: die vier Trefferarten vom Board, zusammen Schaden und Treffer der Faehigkeit; der Fokus bleibt", { qf, fokusArt });
    // ein anderes Mitglied aufklappen: der Fokus bleibt auf seinem Knopf
    await p.click('#pTafel .btr[data-m="Mitglied Drei"] .aufk');
    await p.waitForFunction(() => document.querySelectorAll('#pTafel .mskills[data-m="Mitglied Drei"] .msk:not(.mskopf)').length === 12, null, { timeout: 3000 }).catch(() => {});
    g = await gruppeBlick(p);
    const fokus = await p.evaluate(() => document.activeElement?.closest(".btr")?.dataset.m);
    assert(g.skillsDrei.length === 12 && g.zeilen.find((z) => z.m === "Mitglied Drei")?.auf === "true" && fokus === "Mitglied Drei",
      "7.7 ein anderes Mitglied aufklappen: zwoelf Faehigkeiten, der Fokus bleibt auf dem Knopf", { n: g.skillsDrei.length, fokus });
    // 7.10 Entfernen mit Rueckgaengig: im Board, nie am eigenen Namen
    assert(g.zeilen.filter((z) => z.kick).map((z) => z.m).sort().join() === "Mitglied Drei,Mitglied Zwei" &&
      g.zeilen.find((z) => z.m === "Mitglied Zwei").kick === "Remove Mitglied Zwei from the party",
      "7.10 Entfernen je Mitglied im Board, benannt, nicht am eigenen", g.zeilen.map((z) => [z.m, z.kick]));
    await p.click('#pTafel .btr[data-m="Mitglied Zwei"] [data-kick]');
    await p.waitForFunction(() => !!document.querySelector('#pTafel .btr[data-m="Mitglied Zwei"].geht'), null, { timeout: 3000 }).catch(() => {});
    const warte = await p.evaluate(() => ({ geht: !!document.querySelector('#pTafel .btr[data-m="Mitglied Zwei"].geht'),
      undo: document.activeElement?.textContent.trim(), toast: document.querySelector("#toast")?.textContent || "" }));
    assert(warte.geht && warte.undo === "Undo" && warte.toast.includes("Mitglied Zwei will be removed"), "7.10 Entfernen wartet: die Zeile geht, der Fokus auf Undo", warte);
    await p.keyboard.press("Enter");
    await p.waitForFunction(() => !document.querySelector('#pTafel .btr[data-m="Mitglied Zwei"].geht'), null, { timeout: 3000 }).catch(() => {});
    const zurueck = await p.evaluate(() => ({ geht: !!document.querySelector('#pTafel .btr.geht'), fokus: document.activeElement?.dataset?.kick || "" }));
    assert(!zurueck.geht && zurueck.fokus === "Mitglied Zwei" && !s.party.some((x) => x.path === "/api/party/kick"),
      "7.10 Undo: die Zeile bleibt, niemand wird entfernt, der Fokus zurueck auf ihrem Knopf", { zurueck, party: s.party });
    assert(g.board && !g.bsp.length, "7.9 eine echte Gruppe traegt keine Beispielmarke", g.bsp);
    assert(!s.fehler.length, "7 laufende Gruppe: keine Fehler", s.fehler);
    await p.close();
  }

  // --- 7.6 (Fixrunde 1, Befund 1): eine einzige Farbe je Mitglied, im Board und in der Gruppenansicht im Kampf.
  // Mitglied Zwei hat den meisten Schaden (das Board kommt danach geordnet), aber die wenigsten DPS (180 s):
  // die Reihenfolge nach Schaden und nach DPS ist verschieden, die Farbe darf es nicht sein.
  {
    const zwei = { ...mitglied7("Mitglied Zwei", 2.0, ["Dagger", "Crossbow"], 11), seconds: 180 };
    zwei.dps = Math.round(zwei.damage / 180);
    const board = [zwei, BOARD7[2], BOARD7[1]];
    const s = await oeffne({ app: true, gruppe: { ...GRUPPE7, board } });
    const p = s.page;
    await zurGruppe(s);
    await p.waitForFunction(() => document.querySelectorAll("#pTafel .btr").length === 3, null, { timeout: 8000 }).catch(() => {});
    const imBoard = await p.evaluate(() => Object.fromEntries([...document.querySelectorAll("#pTafel .btr")].map((z) =>
      [z.dataset.m, getComputedStyle(z.querySelector(".gspur i")).backgroundColor])));
    const reihe = await p.evaluate(() => [...document.querySelectorAll("#pTafel .btr")].map((z) => z.dataset.m));
    await bereich(p, "timeline");
    await p.waitForFunction(() => !!document.querySelector("#segParty")?.getClientRects().length, null, { timeout: 8000 }).catch(() => {});
    await p.click("#segParty");
    // folgt Spezifikation Glutring 5: die Mitglieder tragen data-member
    await p.waitForFunction(() => document.querySelectorAll("#bars .row[data-member]").length === 3, null, { timeout: 5000 }).catch(() => {});
    const imKampf = await p.evaluate(() => {
      const probe = document.createElement("i"); document.body.append(probe);
      const aus = Object.fromEntries([...document.querySelectorAll("#bars .row[data-member]")].map((z) => {
        probe.style.color = ""; probe.style.color = z.querySelector(".fill")?.style.getPropertyValue("--c") || "";
        return [z.dataset.member, getComputedStyle(probe).color]; }));
      probe.remove(); return aus;
    });
    assert(reihe[0] === "Mitglied Drei" && Object.keys(imKampf).length === 3 && Object.keys(imBoard).every((m) => imBoard[m] === imKampf[m]) &&
      new Set(Object.values(imBoard)).size === 3,
      "7.6/#34 eine Farbe je Mitglied: im Board (nach DPS) und in der Gruppenansicht im Kampf (nach Schaden) dieselbe", { reihe, imBoard, imKampf });
    assert(!s.fehler.length, "7.6 Farben: keine Fehler", s.fehler);
    await p.close();
  }

  // --- 7.9: das Beispiel-Board nur im Entwicklermodus, markiert; die Beispielgruppe entsteht aus dem Log
  // (anaLog: Quick Fire reihum kritisch, stark, beides, normal - also mit Trefferarten)
  const GRUPPE_LOG = join(work, "TLCombatLog-20260920-gruppe.txt");
  writeFileSync(GRUPPE_LOG, anaLog());
  {
    const s = await oeffne({ app: true });
    const p = s.page;
    await mitLog(s, GRUPPE_LOG);
    await bereich(p, "party");
    const ohneDevBoard = await p.evaluate(() => !!document.querySelector("#pBoard")?.getClientRects().length);
    await p.click('#bereiche [data-tab="settings"]');
    await p.click('#einstNav button[data-gruppe="logs"]');
    const ohneDev = await p.evaluate(() => !!document.querySelector("#eBeispiel")?.getClientRects().length);
    await p.click("#eDev");
    await p.waitForFunction(() => !!document.querySelector("#eBeispiel")?.getClientRects().length, null, { timeout: 3000 }).catch(() => {});
    await p.click("#eBeispiel");
    await bereich(p, "party");
    await p.waitForFunction(() => document.querySelectorAll("#pTafel .btr").length > 0, null, { timeout: 5000 }).catch(() => {});
    const g = await gruppeBlick(p);
    assert(!ohneDev && !ohneDevBoard && g.board && g.zeilen.length >= 1 && g.bsp.length === 1 && g.bsp.every((b) => b === "Example \u2013 names made up") &&
      g.ctx === "Example party" && !g.code,
      "7.9 im Entwicklermodus: das Beispiel-Board, als Beispiel markiert (im Kopf des Boards; die zweite Liste entfiel mit Feinschliff 6), ohne Code", { bsp: g.bsp, ctx: g.ctx, n: g.zeilen.length });
    const arten = await p.evaluate(() => {
      const b = document.querySelector("#pTafel .btr .aufk[aria-expanded=false]") || document.querySelector("#pTafel .btr .aufk");
      if (b.getAttribute("aria-expanded") === "false") b.click();
      document.querySelector("#pTafel .mskills button.mskauf")?.click();
      return document.querySelectorAll("#pTafel .mcat").length;
    });
    assert(arten >= 2, "7.8 auch im Beispiel: eine Faehigkeit zeigt ihre Trefferarten", arten);
    assert(!s.fehler.length, "7.9 Beispiel: keine Fehler", s.fehler);
    await p.close();
  }

  // --- 7 Deutsch
  {
    const s = await oeffne({ app: true, lang: "de", gruppe: GRUPPE7 });
    await zurGruppe(s);
    await s.page.waitForFunction(() => document.querySelectorAll("#pTafel .btr").length === 3, null, { timeout: 8000 }).catch(() => {});
    const g = await gruppeBlick(s.page);
    assert(g.ctx === "Gruppe l\u00e4uft \u00b7 K7QX" && g.boardTitel === "Board" && g.status === "\u25cf 4 verbunden" && /^3 von 4 dabei \u00b7 Vulcanus \u00b7 Stand \d\d:\d\d$/.test(g.boardFz) &&
      JSON.stringify(g.kopfzeile) === JSON.stringify(["#", "Mitglied", "Klasse", "DPS"]) &&
      JSON.stringify(g.mskopf) === JSON.stringify(["F\u00e4higkeit", "Schaden", "DPS", "Treffer", "Kritisch", "Stark", "Gr\u00f6\u00dfter"]) &&
      g.speichern === "Gruppen-Log speichern" && g.verlassen === "Gruppe schlie\u00dfen" && g.summe?.[2] === "zusammen, 3 Mitglieder" &&
      g.zeilen.find((z) => z.m === "Mitglied Eins")?.klasse === "Sp\u00e4her \u00b7 Langbogen/Armbrust",
      "7 Deutsch: Kopf, Board, Spalten, Knoepfe", g);
    await s.page.close();
    const o = await oeffne({ app: true, lang: "de" });
    await zurGruppe(o);
    const h = await gruppeBlick(o.page);
    assert(h.ctx === "Noch keine Gruppe" && h.startTitel === "Gruppe starten" && h.beitrittTitel === "Gruppe beitreten" &&
      JSON.stringify(h.wo.map((w) => w.text)) === JSON.stringify(["Auf diesem PC", "Eigener Server"]) && h.host?.text === "Gruppe starten" &&
      h.join?.text === "Beitreten" && h.joinSrvLabel === "Server-Adresse optional" && /Firewall/.test(h.hostNote),
      "7 Deutsch ohne Gruppe: Gruppe starten | Gruppe beitreten, Auf diesem PC | Eigener Server", h);
    await o.page.close();
  }

  // --- 7 Groessen: kein waagerechtes Rollen, Text mindestens 11 Punkt, nichts gestreckt
  for (const [breite, hoehe] of [[1280, 860], [1920, 1080], [2000, 1480], [1000, 860], [760, 860], [560, 860]]) {
    for (const mitGruppe of [false, true]) {
      const s = await oeffne({ app: breite >= 760, lang: "de", breite, hoehe, ...(mitGruppe ? { gruppe: GRUPPE7 } : {}) });
      await zurGruppe(s);
      if (mitGruppe) await s.page.waitForFunction(() => document.querySelectorAll("#pTafel .btr").length === 3, null, { timeout: 8000 }).catch(() => {});
      const g = await gruppeBlick(s.page);
      const wo = `${breite} \u00d7 ${hoehe}${mitGruppe ? " mit Gruppe" : ""}`;
      assert(!g.quer && !g.klein.length && !s.fehler.length && (mitGruppe ? g.board && g.zeilen.length === 3 : !!g.start && !!g.beitritt),
        `7 ${wo}: kein waagerechtes Rollen, Text mindestens 11 Punkt, keine Fehler`, { quer: g.quer, klein: g.klein, fehler: s.fehler });
      if (!mitGruppe) {
        const neben = breite >= 1000;
        assert(neben ? Math.abs(g.start.top - g.beitritt.top) < 1 : g.beitritt.top >= g.start.bottom - 1,
          `7 ${wo}: die zwei Wege ${neben ? "nebeneinander" : "untereinander"}`, { start: g.start, beitritt: g.beitritt });
        assert(g.start.width <= 900 && g.beitritt.width <= 900, `7 ${wo}: kein Feld breiter als 900 Punkt`, { start: g.start.width, beitritt: g.beitritt.width });
      } else {
        assert(g.zeilen.length === 3 && g.zeilen.every((z) => z.r.height <= 44.5) && g.skillsEins.every((z) => z.r.height <= 44.5) && g.tafel.width <= 1120,
          `7 ${wo}: Zeilen hoechstens 44 Punkt, das Board ein Block von hoechstens 1100 Punkt`, { tafel: g.tafel?.width, h: g.zeilen.map((z) => z.r.height) });
        if (breite <= 760) assert(g.tafel.top >= g.codeblock.bottom - 1, `7 ${wo}: der Code steht ueber der Tabelle`, { code: g.codeblock, tafel: g.tafel });
      }
      await s.page.close();
    }
  }

  // --- 7.11 Feinschliff 6 (Spezifikation 02.10.2026): mit Board steht das Board oben, Charakter und "Gruppe starten /
  // beitreten" zugeklappt darunter (per Tastatur); Status nach Lage; "Entfernen" nur beim Zeigen oder Fokus, nie in der
  // eigenen Zeile; die Beispielgruppe heisst in ihrer Sprache und traegt die Initialen A und B; die Meldung unten links
  // deckt die Summenzeile des Boards nicht ab.
  /* Deckt die Meldung (#toast, sichtbar) die Summenzeile, soweit diese im Fenster steht? */
  const summeFrei = (p) => p.evaluate(() => {
    const t = document.querySelector("#toast"), s = document.querySelector("#pTafel .bsum");
    const an = !!t && t.classList.contains("on") && parseFloat(getComputedStyle(t).opacity) > 0;
    if (!an || !s) return { an, summe: !!s, frei: true };
    const a = t.getBoundingClientRect(), b = s.getBoundingClientRect();
    const imFenster = b.bottom > 0 && b.top < innerHeight;
    const deckt = imFenster && a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
    return { an, summe: true, imFenster, frei: !deckt, toast: a.toJSON(), sum: b.toJSON() };
  });
  const kickSicht = (p, m) => p.evaluate((m) => { const k = document.querySelector('#pTafel [data-m="' + m + '"] [data-kick]'); return k ? getComputedStyle(k).opacity : null; }, m);
  for (const [lang, namen, wegeTitel] of [["en", ["Example A", "Example B"], "Start or join a party"],
                                          ["de", ["Beispiel A", "Beispiel B"], "Gruppe starten oder beitreten"]]) {
    for (const [breite, hoehe] of [[1280, 860], [560, 860], [2000, 1480]]) {
      const s = await oeffne({ app: breite >= 760, lang, breite, hoehe });
      const p = s.page;
      await zurGruppe(s);
      const ohne = await gruppeBlick(p);
      await p.evaluate(() => { const b = document.querySelector("#miFakeParty"); b.hidden = false; b.click(); });
      await p.waitForFunction(() => document.querySelectorAll("#pTafel .btr").length > 0, null, { timeout: 5000 }).catch(() => {});
      await p.waitForTimeout(250);
      const g = await gruppeBlick(p);
      const frei = await summeFrei(p);
      const wo = `${lang} ${breite} \u00d7 ${hoehe}`;
      assert(ohne.wege && ohne.wegeAuf && !ohne.wegeAuf.sicht && !ohne.wegeAuf.wegeDrin,
        `7.11 ${wo} ohne Board: die Wege stehen wie bisher oben, nichts zugeklappt`, ohne.wegeAuf);
      assert(g.board && g.wegeAuf?.sicht && g.wegeAuf.wegeDrin && !g.wegeAuf.offen && !g.wegeAuf.wegeSicht && g.wegeAuf.titel === wegeTitel &&
        g.boardR && g.wegeAuf.r && g.boardR.bottom <= g.wegeAuf.r.top + 1 && g.boardR.top < 160,
        `7.11 ${wo}: das Board oben, \u201e${wegeTitel}\u201c zugeklappt darunter`, { board: g.boardR, wegeAuf: g.wegeAuf });
      const zn = g.zeilen.map((z) => z.name).sort();   // angezeigt; data-m bleibt der Schluessel "Beispiel A"
      assert(JSON.stringify(zn) === JSON.stringify(namen.slice(0, zn.length)) && zn.length >= 2 &&
        g.zeilen.every((z) => z.initiale === z.m.slice(-1)) && new Set(g.zeilen.map((z) => z.initiale)).size === g.zeilen.length,
        `7.11 ${wo}: die Beispielgruppe heisst ${namen.join(", ")} und traegt die Initialen aus dem unterscheidenden Teil`, g.zeilen.map((z) => [z.m, z.initiale]));
      assert(frei.an && frei.summe && frei.frei, `7.11 ${wo}: die Meldung deckt die Summenzeile nicht ab`, frei);
      assert(!g.quer && !g.klein.length && !s.fehler.length, `7.11 ${wo}: kein waagerechtes Rollen, Text mindestens 11 Punkt, keine Fehler`,
        { quer: g.quer, klein: g.klein, fehler: s.fehler });
      if (breite === 1280) {
        // per Tastatur: der zugeklappte Abschnitt ist ein Knopf (summary), Enter klappt auf und zu
        await p.focus("#pWegeAuf > summary");
        await p.keyboard.press("Enter");
        await p.waitForTimeout(100);
        const auf = await p.evaluate(() => ({ offen: document.querySelector("#pWegeAuf").open, name: !!document.querySelector("#pName")?.checkVisibility(),
          fokus: document.activeElement === document.querySelector("#pWegeAuf > summary") }));
        await p.keyboard.press("Enter");
        await p.waitForTimeout(100);
        const zu = await p.evaluate(() => document.querySelector("#pWegeAuf").open);
        // ein neuer Abruf (renderParty) klappt nichts von selbst wieder zu
        await p.focus("#pWegeAuf > summary");
        await p.keyboard.press(" ");
        await p.waitForTimeout(3500);
        const bleibt = await p.evaluate(() => document.querySelector("#pWegeAuf").open);
        assert(auf.offen && auf.name && auf.fokus && !zu && bleibt, `7.11 ${wo}: per Tastatur auf- und zuklappen (Enter, Leertaste), der Charakter steht darin; es bleibt offen`, { auf, zu, bleibt });
        // ein zweiter Klick raeumt die Beispielgruppe weg: die Wege stehen wieder oben, offen
        await p.evaluate(() => document.querySelector("#miFakeParty").click());
        await p.waitForTimeout(200);
        const weg = await gruppeBlick(p);
        assert(weg.wege && !weg.board && weg.wegeAuf && !weg.wegeAuf.sicht && !weg.wegeAuf.wegeDrin && weg.start && weg.beitritt,
          `7.11 ${wo}: ohne Beispielgruppe stehen die Wege wieder oben`, weg.wegeAuf);
      }
      await p.close();
    }
  }
  // Status nach Lage: nie "wartet auf Beitritte", wenn schon jemand verbunden ist
  {
    const ichWarte = { ...BOARD7[1], waiting: true, damage: 0, dps: 0, hits: 0, skills: [] };
    for (const [lang, rolle, board, erwartet] of [
      ["en", "host", [BOARD7[1]], "\u25cf listening"],
      ["de", "host", [BOARD7[1]], "\u25cf wartet auf Beitritte"],
      ["en", "host", [ichWarte, BOARD7[3]], "\u25cf 2 connected \u00b7 waiting for numbers"],
      ["de", "host", [ichWarte, BOARD7[3]], "\u25cf 2 verbunden \u00b7 warte auf Zahlen"],
      ["en", "member", BOARD7, "\u25cf 4 connected"],
      ["de", "member", BOARD7, "\u25cf 4 verbunden"]]) {
      const s = await oeffne({ app: true, lang, gruppe: { ...GRUPPE7, role: rolle, board } });
      await zurGruppe(s);
      await s.page.waitForFunction(() => !!(document.querySelector("#pStatus")?.textContent || "").trim(), null, { timeout: 8000 }).catch(() => {});
      const status = await s.page.evaluate(() => document.querySelector("#pStatus").textContent.trim());
      assert(status === erwartet, `7.11 Status (${lang}, ${rolle}, ${board.length} im Raum): ${erwartet}`, status);
      await s.page.close();
    }
  }
  // Entfernen nur beim Zeigen oder Fokus, nie in der eigenen Zeile; per Tab erreichbar; die Meldung deckt die Summe nicht
  {
    const s = await oeffne({ app: true, gruppe: GRUPPE7 });
    const p = s.page;
    await zurGruppe(s);
    await p.waitForFunction(() => document.querySelectorAll("#pTafel .btr").length === 3, null, { timeout: 8000 }).catch(() => {});
    await p.mouse.move(2, 2);
    const g = await gruppeBlick(p);
    const ruhe = { eigene: g.zeilen.find((z) => z.m === "Mitglied Eins")?.kick, andere: g.zeilen.filter((z) => z.kick).map((z) => [z.m, z.kickDeckung]),
      warte: await kickSicht(p, "Mitglied Vier") };
    assert(ruhe.eigene === null && ruhe.andere.length === 2 && ruhe.andere.every(([, d]) => d === "0") && ruhe.warte === "0" && g.warte[0]?.kick === "Remove Mitglied Vier from the party",
      "7.11 in Ruhe kein \u201eRemove\u201c zu sehen, in der eigenen Zeile gar keins; wer wartet, ist im Board entfernbar", ruhe);
    await p.hover('#pTafel .btr[data-m="Mitglied Zwei"] .bkl');
    const zeigen = { zwei: await kickSicht(p, "Mitglied Zwei"), drei: await kickSicht(p, "Mitglied Drei") };
    await p.hover('#pTafel .bwart[data-m="Mitglied Vier"] .bkl');
    zeigen.vier = await kickSicht(p, "Mitglied Vier");
    assert(zeigen.zwei === "1" && zeigen.drei === "0" && zeigen.vier === "1", "7.11 beim Zeigen auf die Zeile erscheint ihr \u201eRemove\u201c, nur ihres", zeigen);
    await p.mouse.move(2, 2);
    await p.focus('#pTafel .btr[data-m="Mitglied Drei"] .aufk');
    await p.keyboard.press("Tab");
    const fokus = await p.evaluate(() => ({ kick: document.activeElement?.dataset?.kick || "", deckung: getComputedStyle(document.activeElement).opacity,
      name: document.activeElement?.getAttribute("aria-label") || "" }));
    assert(fokus.kick === "Mitglied Drei" && fokus.deckung === "1" && fokus.name === "Remove Mitglied Drei from the party",
      "7.11 per Tab vom Aufklappknopf zum benannten \u201eRemove\u201c, sichtbar mit dem Fokus", fokus);
    // ganz nach unten gerollt, dann eine Meldung mit Rueckgaengig (Entfernen): die Summenzeile bleibt frei
    await p.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await p.waitForTimeout(100);
    await p.hover('#pTafel .btr[data-m="Mitglied Zwei"] .bkl');
    await p.click('#pTafel .btr[data-m="Mitglied Zwei"] [data-kick]');
    await p.waitForTimeout(400);
    const frei = await summeFrei(p);
    assert(frei.an && frei.summe && frei.imFenster && frei.frei, "7.11 unten gerollt mit Meldung: die Summenzeile steht frei ueber der Meldung", frei);
    await p.keyboard.press("Enter");
    assert(!s.fehler.length, "7.11 Entfernen und Meldung: keine Fehler", s.fehler);
    await p.close();
  }

  // --- 7.11 Fixrunde 1 (Befund 1): ein Abruf, der nur das Alter aendert, ersetzt keine Zeile und keinen Knopf
  {
    const gr = { ...GRUPPE7, board: BOARD7.map((r) => ({ ...r })) };
    const s = await oeffne({ app: true, gruppe: gr });
    const p = s.page;
    await zurGruppe(s);
    await p.waitForFunction(() => document.querySelectorAll("#pTafel .btr").length === 3, null, { timeout: 8000 }).catch(() => {});
    await p.evaluate(() => { window.__zeilen = [...document.querySelectorAll("#pTafel .btr, #pTafel .bwart")];
      window.__kick = document.querySelector('#pTafel [data-kick="Mitglied Zwei"]'); });
    const vorher = await p.evaluate(() => document.querySelector('#pTafel .btr[data-m="Mitglied Eins"] .bwer small')?.textContent);
    gr.board[1].age = 7; gr.board[0].age = 14;   // Mitglied Eins, Mitglied Zwei - sonst bleibt alles gleich
    await p.waitForFunction(() => document.querySelector('#pTafel .btr[data-m="Mitglied Eins"] .bwer small')?.textContent === "7\u00a0s ago", null, { timeout: 8000 }).catch(() => {});
    const nachher = await p.evaluate(() => {
      const jetzt = [...document.querySelectorAll("#pTafel .btr, #pTafel .bwart")];
      return { alter: [...document.querySelectorAll("#pTafel .btr")].map((z) => z.querySelector(".bwer small")?.textContent || ""),
        gleich: jetzt.length === window.__zeilen.length && jetzt.every((z, i) => z === window.__zeilen[i]),
        kick: !!window.__kick?.isConnected && document.querySelector('#pTafel [data-kick="Mitglied Zwei"]') === window.__kick };
    });
    assert(vorher === "4\u00a0s ago" && nachher.gleich && nachher.kick && nachher.alter.includes("7\u00a0s ago") && nachher.alter.includes("14\u00a0s ago"),
      "7.11 neues Alter beim Abruf: nur der Text \u201evor N s\u201c wechselt, Zeilen und \u201eRemove\u201c bleiben dieselben Knoten", { vorher, nachher });
    assert(!s.fehler.length, "7.11 Alter: keine Fehler", s.fehler);
    await p.close();
  }
  // --- 7.11 Fixrunde 1 (Befund 6, 7): Host mit allen gemeldet ohne Zusatz; wer an einem anderen Ziel steht, zaehlt nicht
  {
    const woanders = { ...BOARD7[0], target: "Kronos", onTarget: false };
    for (const [lang, board, erwartet] of [
      ["en", BOARD7.slice(0, 3), "\u25cf 3 connected"],
      ["de", BOARD7.slice(0, 3), "\u25cf 3 verbunden"],
      ["en", [woanders, BOARD7[1], BOARD7[2], BOARD7[3]], "\u25cf 3 connected"]]) {
      const s = await oeffne({ app: true, lang, gruppe: { ...GRUPPE7, board } });
      await zurGruppe(s);
      await s.page.waitForFunction(() => !!(document.querySelector("#pStatus")?.textContent || "").trim(), null, { timeout: 8000 }).catch(() => {});
      const status = await s.page.evaluate(() => document.querySelector("#pStatus").textContent.trim());
      assert(status === erwartet, `7.11 Status (${lang}, Host, ${board.length} im Raum, ${board.filter((r) => r.onTarget === false).length} woanders): ${erwartet}`, status);
      await s.page.close();
    }
  }
  // --- 7.11 Fixrunde 1 (Befund 7): Beispiel mit offenen Wegen -> echte Gruppe -> Gruppe zu: die Wege stehen wieder oben, zugeklappt ist nichts
  {
    const gr = { role: null, code: "", join: "", address: "", board: [], target: "", error: "" };
    const s = await oeffne({ app: true, gruppe: gr });
    const p = s.page;
    await zurGruppe(s);
    await p.evaluate(() => { const b = document.querySelector("#miFakeParty"); b.hidden = false; b.click(); });
    await p.waitForFunction(() => document.querySelectorAll("#pTafel .btr").length > 0, null, { timeout: 5000 }).catch(() => {});
    await p.click("#pWegeAuf > summary");
    const bsp = await gruppeBlick(p);
    Object.assign(gr, GRUPPE7);
    await p.evaluate(() => document.querySelector("#miFakeParty").click());   // Beispiel weg, der naechste Abruf bringt die echte Gruppe
    await p.waitForFunction(() => document.querySelectorAll("#pTafel .btr").length === 3, null, { timeout: 8000 }).catch(() => {});
    const echt = await gruppeBlick(p);
    Object.assign(gr, { role: null, code: "", join: "", address: "", board: [], target: "" });
    await p.waitForFunction(() => !document.querySelector("#pBoard")?.getClientRects().length, null, { timeout: 8000 }).catch(() => {});
    const zu = await gruppeBlick(p);
    const platz = await p.evaluate(() => ({ vorSatz: document.querySelector("#pWege")?.nextElementSibling?.id || "", offen: document.querySelector("#pWegeAuf").open }));
    assert(bsp.wegeAuf?.offen && bsp.wegeAuf.wegeSicht && echt.board && echt.wegeAuf && !echt.wegeAuf.sicht && !echt.wegeAuf.wegeDrin && !echt.wege &&
      zu.wege && !zu.board && zu.wegeAuf && !zu.wegeAuf.sicht && !zu.wegeAuf.wegeDrin && platz.vorSatz === "pOhne" && !platz.offen && zu.start && zu.beitritt,
      "7.11 Beispiel (Wege offen) -> echte Gruppe (Wege weg) -> Gruppe zu: die Wege stehen wieder an ihrem Platz oben, nichts bleibt aufgeklappt",
      { bsp: bsp.wegeAuf, echt: echt.wegeAuf, zu: zu.wegeAuf, platz });
    assert(!s.fehler.length, "7.11 Wechsel Beispiel/Gruppe: keine Fehler", s.fehler);
    await p.close();
  }
  // --- 7.11 Fixrunde 1 (Befund 2): die Beispielnamen folgen einem Wechsel der Sprache (angezeigt, nicht beim Erzeugen uebersetzt)
  {
    const s = await oeffne({ app: true });
    const p = s.page;
    await zurGruppe(s);
    await p.evaluate(() => { const b = document.querySelector("#miFakeParty"); b.hidden = false; b.click(); });
    await p.waitForFunction(() => document.querySelectorAll("#pTafel .btr").length > 0, null, { timeout: 5000 }).catch(() => {});
    const en = (await gruppeBlick(p)).zeilen.map((z) => [z.name, z.initiale]);
    await p.click('#bereiche [data-tab="settings"]');
    await p.click('#eSprache button[data-lang="de"]');
    await bereich(p, "party");
    const de = (await gruppeBlick(p)).zeilen.map((z) => [z.name, z.initiale]);
    assert(JSON.stringify(en.map((z) => z[0]).sort()) === JSON.stringify(["Example A", "Example B"]) &&
      JSON.stringify(de.map((z) => z[0]).sort()) === JSON.stringify(["Beispiel A", "Beispiel B"]) &&
      [...en, ...de].every(([n, i]) => i === n.slice(-1)),
      "7.11 Beispielgruppe: Englisch Example A/B, nach dem Wechsel auf Deutsch Beispiel A/B, die Initialen A/B bleiben", { en, de });
    assert(!s.fehler.length, "7.11 Sprachwechsel: keine Fehler", s.fehler);
    await p.close();
  }

  // ===== Abschnitt 8: Builds (Luecken 8) =====
  /* Die Karte eines erkannten Builds mit Stufe, Erkannt an, Trefferquoten und Kaempfen je Boss, die Ausruestung
     aus dem Plan und "Planer oeffnen / Plan schliessen" entfielen mit Aufgabe 12 (Entscheidung 29.09.: Builds als
     Links zu Questlog). Was davon bleibt, prueft Abschnitt 15 an der neuen Oberflaeche, mindestens so streng:
     der eigene Bereich (15.1, dazu 0: Builds als Bereich, der Verlauf ohne Builds), Deutsch mit "Build", nie
     "Bau" (15.10), die Groessen ohne waagerechtes Rollen, Text mindestens 11 Punkt, nichts gestreckt und
     1280 x 860 ohne Rollen (15.12). */

  // ===== Abschnitt 9: Start und Weeklies (Luecken 1 und 9) =====
  /* Was Start zeigt: die zwei Spalten, ihre Teile, "Zuletzt geoeffnet" oder die Einrichtung (DECISION 1.12),
     dazu alles, was kleiner als 11 Punkt ist, und jeder Text in Palatino. */
  const startBlick = (p) => p.evaluate(() => {
    const q = (x) => document.querySelector(x);
    const r = (e) => e && e.getClientRects().length ? e.getBoundingClientRect().toJSON() : null;
    const sicht = (e) => !!e && e.getClientRects().length > 0 && getComputedStyle(e).visibility !== "hidden";
    const land = q("#land"), klein = [], palatino = [];
    if (land) {
      const it = document.createTreeWalker(land, NodeFilter.SHOW_TEXT);
      for (let n; (n = it.nextNode()); ) {
        const e = n.parentElement;
        if (!n.textContent.trim() || !e || e.closest(".vh") || !sicht(e)) continue;
        const cs = getComputedStyle(e);
        if (parseFloat(cs.fontSize) < 11) klein.push(n.textContent.trim().slice(0, 24) + ":" + cs.fontSize);
        if (/palatino/i.test(cs.fontFamily)) palatino.push(n.textContent.trim());
      }
    }
    const links = r(q("#land .startlinks")), rechts = r(q("#land .startrechts"));
    return {
      land: r(land), links, rechts, scroll: land ? land.scrollHeight - land.clientHeight : null,
      inhalt: links && rechts ? { oben: Math.min(links.top, rechts.top), unten: Math.max(links.bottom, rechts.bottom) } : null,
      marke: (q("#land .brandname")?.textContent || "").trim(), spiel: (q("#land .gamename")?.textContent || "").trim(),
      brand: (q("#land .brand")?.textContent || "").replace(/\s+/g, " ").trim(),
      unter: !!q("#land .gamename") && !!q("#land .brandname") && q("#land .gamename").getBoundingClientRect().top >= q("#land .brandname").getBoundingClientRect().bottom,
      satz: (q("#land .landsatz")?.textContent || "").trim(), satzBreite: r(q("#land .landsatz"))?.width ?? null,
      ordner: q("#btnPickFolder") ? { text: q("#btnPickFolder").textContent.trim(), heiss: q("#btnPickFolder").classList.contains("hot"),
        sicht: sicht(q("#btnPickFolder")), links: !!q("#btnPickFolder").closest(".startlinks") } : null,
      bsp: q("#btnSample2") ? { text: q("#btnSample2").textContent.trim(), sicht: sicht(q("#btnSample2")), links: !!q("#btnSample2").closest(".startlinks") } : null,
      hinweis: (q("#landHinweis")?.textContent || "").replace(/\s+/g, " ").trim(), pfad: q("#landHinweis code")?.textContent || "",
      privacy: (q("#land .privacy")?.textContent || "").replace(/\s+/g, " ").trim(),
      drop: q("#btnOpen2") ? { tag: q("#btnOpen2").tagName, text: q("#btnOpen2").textContent.replace(/\s+/g, " ").trim(),
        rechts: !!q("#btnOpen2").closest(".startrechts"), r: r(q("#btnOpen2")) } : null,
      setup: sicht(q("#landSetup")), schritte: [...document.querySelectorAll("#landSetup li")].filter(sicht).map((l) => l.textContent.replace(/\s+/g, " ").trim()),
      setupText: (q("#landSetup")?.textContent || "").replace(/\s+/g, " "), setupR: r(q("#landSetup")),
      zul: sicht(q("#landZuletzt")), zulTitel: (q("#landZuletzt h2")?.textContent || "").trim(),
      live: q("#btnWatch2") ? { text: q("#btnWatch2").textContent.trim(), imKopf: !!q("#btnWatch2").closest("#landZuletzt .zk"),
        sicht: sicht(q("#btnWatch2")), gedrueckt: q("#btnWatch2").getAttribute("aria-pressed") } : null,
      zeilen: [...document.querySelectorAll("#landZuletzt .zr:not(#landBspZeile)")].filter(sicht).map((z) => ({ datei: (z.querySelector(".zf")?.textContent || "").trim(),
        wann: (z.querySelector("small")?.textContent || "").trim(), n: (z.querySelector(".zn")?.textContent || "").trim(), tag: z.tagName, tab: z.tabIndex,
        rolle: z.getAttribute("role") || "", h: r(z)?.height ?? 0 })),
      leer: sicht(q("#landZuletztLeer")) ? q("#landZuletztLeer").textContent.replace(/\s+/g, " ").trim() : "",
      bspZeile: q("#landBspZeile") && sicht(q("#landBspZeile")) ? { tag: q("#landBspZeile").tagName, text: q("#landBspZeile").textContent.replace(/\s+/g, " ").trim(),
        h: r(q("#landBspZeile")).height } : null,
      alt: ["#landStatus", ".logbleed", ".landcards", "#land .cta", ".landdrop", "#btnCopyPath", "#landFolderNote"].filter((x) => q(x)),
      klein, palatino, quer: document.documentElement.scrollWidth > innerWidth,
    };
  });
  /* Das Verzeichnis der gelesenen Logdateien (logIndex), wie es der Helfer in /api/config meldet: vier Dateien,
     nur Zielnamen und Zahlen. Die neueste hat 13 Kaempfe von 21:12 bis 22:37 (der letzte 60 s ab 22:36). */
  const t9 = (d, h, m) => Date.UTC(2026, 8, d, h, m, 0);
  const kampf9 = (at, dur = 60) => ({ name: "Vulcanus", dps: 100000, dmg: 100000 * dur, dur, at });
  const INDEX9 = {
    "TLCombatLog-260910_200000.txt": { size: 1, fights: [kampf9(t9(10, 20, 0))] },
    "TLCombatLog-260926_211254.txt": { size: 1, fights: Array.from({ length: 13 }, (_, i) => kampf9(t9(26, 21, 12) + i * 7 * 60000)) },
    "TLCombatLog-260920_200000.txt": { size: 1, fights: [kampf9(t9(20, 20, 0), 30), kampf9(t9(20, 20, 30), 30)] },
    "TLCombatLog-260925_194402.txt": { size: 1, fights: [kampf9(t9(25, 19, 44), 45)] },
  };
  const mittig = (b) => b.inhalt && b.land ? Math.abs((b.inhalt.oben - b.land.top) - (b.land.bottom - b.inhalt.unten)) : null;

  // --- 1.1 bis 1.7, 1.12, 1.13: ohne Ordner - zwei Spalten, ueber die Hoehe verteilt, die Einrichtung als leises Feld
  {
    const s = await oeffne({ app: true, lang: "de" });
    const p = s.page;
    const b = await startBlick(p);
    assert(b.links && b.rechts && b.links.right <= b.rechts.left - 24 && b.links.top < b.rechts.bottom && b.rechts.top < b.links.bottom,
      "1.1 zwei Spalten nebeneinander", { links: b.links, rechts: b.rechts });
    assert(b.scroll <= 0 && mittig(b) !== null && mittig(b) <= 48,
      "1.1 ueber die Hoehe verteilt: so viel Luft unten wie oben (Vorgabe: „unten so viel Platz“), ohne Rollen", { mittig: mittig(b), scroll: b.scroll, land: b.land, inhalt: b.inhalt });
    assert(b.marke === "BOROMETER" && b.spiel === "Throne and Liberty" && b.brand === "BOROMETER Throne and Liberty" && b.unter &&
      JSON.stringify(b.palatino) === '["Throne and Liberty"]',
      "1.2 Marke BOROMETER, darunter „Throne and Liberty“ - Palatino nur dort", { marke: b.marke, spiel: b.spiel, brand: b.brand, unter: b.unter, palatino: b.palatino });
    assert(b.satz.startsWith("Borometer liest das Kampflog, das das Spiel nach jedem Kampf schreibt") && b.satzBreite <= 620,
      "1.3 der Satz des Entwurfs, hoechstens 620 Punkt breit", { satz: b.satz, breite: b.satzBreite });
    assert(b.ordner && b.ordner.text === "Log-Ordner wählen" && b.ordner.heiss && b.ordner.links && b.bsp && b.bsp.text === "Beispielkampf ansehen" && b.bsp.links,
      "1.4 links: „Log-Ordner wählen“ (heiss) und „Beispielkampf ansehen“", { ordner: b.ordner, bsp: b.bsp });
    assert(b.pfad === "%LOCALAPPDATA%\\TL\\Saved\\CombatLogs" && b.hinweis.length > 40, "1.5 Hinweis mit dem Pfad als Code", b.hinweis);
    assert(b.privacy.startsWith("Nur gelesen") && /nichts wird hochgeladen/.test(b.privacy), "1.6 die Nur-gelesen-Zeile", b.privacy);
    assert(b.drop && b.drop.tag === "BUTTON" && b.drop.rechts && /Logdatei hierher ziehen/.test(b.drop.text) && /Enter/.test(b.drop.text) && b.drop.r.height >= 240,
      "1.7 rechts das Ablagefeld: ein Knopf, „Logdatei hierher ziehen“, Enter waehlt eine Datei", b.drop);
    assert(b.setup && b.schritte.length === 4 && /nicht selbst finden/.test(b.setupText) && !b.zul,
      "1.12 ohne Ordner: die Einrichtung als leises Feld (vier Schritte, der Ordner fehlt), kein „Zuletzt geöffnet“", { setup: b.setup, schritte: b.schritte, zul: b.zul });
    assert(!b.alt.length && !b.klein.length && !b.quer, "1.13 keine Zierzeilen und keine alten Karten; Text mindestens 11 Punkt, kein waagerechtes Rollen",
      { alt: b.alt, klein: b.klein });
    /* Enter im Ablagefeld oeffnet die Dateiauswahl (Aufgabe 13, folgt der CI unter Linux, gleich streng): geprueft
       wird, was die App ausloest - ein Klick auf input[type=file] mit frischer Nutzeraktivierung, nur dann oeffnet
       der Browser die Auswahl. Das filechooser-Ereignis kam in der CI (Linux, headless) nicht an; der Lauscher
       steht darum schon vor dem Druck, und kommt es, muss es zu #fileInput gehoeren. */
    await p.evaluate(() => { window.__wahl = null;
      document.querySelector("#fileInput").addEventListener("click", (e) => { window.__wahl = { id: e.target.id, typ: e.target.type,
        aktiv: !!navigator.userActivation?.isActive }; }, { capture: true, once: true }); });
    let fc = null, fcFertig = () => {};
    const fcHoer = (c) => { fc = c; fcFertig(); };
    p.on("filechooser", fcHoer);
    const fcDa = new Promise((ok) => { fcFertig = ok; setTimeout(ok, 3000); });
    await p.focus("#btnOpen2");
    await p.keyboard.press("Enter");
    await p.waitForFunction(() => window.__wahl !== null, null, { timeout: 3000 }).catch(() => {});
    const klick = await p.evaluate(() => window.__wahl);
    if (!fc) await fcDa;
    p.off("filechooser", fcHoer);
    const wahl = fc ? await fc.element().evaluate((n) => n.id) : null;
    assert(klick?.id === "fileInput" && klick.typ === "file" && klick.aktiv && (fc === null || wahl === "fileInput") && !!b.drop?.rechts,
      "1.7 Enter im Ablagefeld (rechte Spalte) oeffnet die Dateiauswahl", { klick, wahl, drop: b.drop });
    // Log-Ordner waehlen: derselbe Weg wie bisher (der Dialog, dann POST /api/dir - test-window.mjs)
    await p.click("#btnPickFolder");
    const dlg = await p.waitForSelector("#modalInput", { state: "visible", timeout: 3000 }).then(() => true).catch(() => false);
    assert(dlg && !!b.ordner?.heiss && !!b.ordner?.links, "1.4 „Log-Ordner wählen“ (links, heiss) fragt nach dem Ordner", { dlg, ordner: b.ordner });
    await p.click("#modalCancel");
    await p.waitForFunction(() => !document.querySelector("#modalBg").classList.contains("on"), null, { timeout: 3000 }).catch(() => {});
    await p.click("#btnSample2");
    await p.waitForFunction(() => !document.querySelector("#app").hidden, null, { timeout: 4000 }).catch(() => {});
    const n = await p.evaluate(() => ({ app: !document.querySelector("#app").hidden, n: document.querySelectorAll("#fightList .fight").length }));
    assert(n.app && n.n === 2, "1.4 „Beispielkampf ansehen“ laedt die zwei Kaempfe", n);
    assert(!s.fehler.length, "Start ohne Ordner: keine Fehler", s.fehler);
    await p.close();
  }

  // --- 1.8, 1.9, 1.10, 1.11: mit Ordner - "Zuletzt geoeffnet" aus dem Verzeichnis; seit Nachtraege N3 oeffnet jede Zeile ihre Datei (test-tage-page.mjs)
  {
    const s = await oeffne({ app: true, lang: "de", ordner: work, config: { logIndex: INDEX9 } });
    const p = s.page;
    await p.waitForFunction(() => document.querySelectorAll("#landZuletzt .zr:not(#landBspZeile)").length > 0, null, { timeout: 3000 }).catch(() => {});
    const b = await startBlick(p);
    assert(!b.setup && b.zul && b.zulTitel === "Zuletzt geöffnet", "1.12 mit Ordner: statt der Einrichtung „Zuletzt geöffnet“", { setup: b.setup, zul: b.zul, titel: b.zulTitel });
    assert(JSON.stringify(b.zeilen.map((z) => z.datei)) === JSON.stringify(["TLCombatLog-260926_211254.txt", "TLCombatLog-260925_194402.txt", "TLCombatLog-260920_200000.txt"]),
      "1.8 die drei zuletzt gelesenen Dateien, die neueste zuerst", b.zeilen);
    assert(b.zeilen[0]?.wann === "26.09. \u00b7 21:12\u201322:37" && b.zeilen[0]?.n === "13 Kämpfe im Verlauf" && b.zeilen[2]?.n === "2 Kämpfe im Verlauf",
      "1.8 Tag, Zeitspanne bis zum Ende des letzten Kampfs und die Zahl aus dem Verzeichnis", b.zeilen);
    /* folgt Spezifikation Nachtraege N3 (30.09.): die Route gibt es jetzt, jede Zeile ist ein Knopf - gleich
       streng: drei Zeilen, Art, Tastatur, keine eigene Rolle, hoechstens 44 Punkt. Das Oeffnen prueft test-tage-page.mjs. */
    assert(b.zeilen.length === 3 && b.zeilen.every((z) => z.tag === "BUTTON" && z.tab >= 0 && !z.rolle && z.h <= 44),
      "1.9 jede Zeile ist ein Knopf, der ihre Datei oeffnet (Nachtraege N3), Zeilen hoechstens 44 Punkt", b.zeilen);
    assert(b.bspZeile && b.bspZeile.tag === "BUTTON" && /Beispielkampf/.test(b.bspZeile.text) && /Dragaryle und Ramux/.test(b.bspZeile.text) &&
      /2 Kämpfe/.test(b.bspZeile.text) && b.bspZeile.h <= 44, "1.10 der Beispielkampf als Zeile: eingebaut, Dragaryle und Ramux, 2 Kämpfe", b.bspZeile);
    assert(b.live && b.live.imKopf && b.live.sicht && b.live.text === "Live-Aufzeichnung starten" && b.live.gedrueckt === "false",
      "1.11 Live als leiser Knopf im Kopf der Liste", b.live);
    assert(b.links && b.rechts && b.scroll <= 0 && mittig(b) <= 48, "1.1 auch mit der Liste ueber die Hoehe verteilt", { mittig: mittig(b), scroll: b.scroll });
    await p.click("#btnWatch2");
    await p.waitForFunction(() => document.body.classList.contains("watching"), null, { timeout: 3000 }).catch(() => {});
    const an = await p.evaluate(() => ({ text: document.querySelector("#btnWatch2").textContent.trim(), p: document.querySelector("#btnWatch2").getAttribute("aria-pressed"),
      oben: document.querySelector("#btnWatch").getAttribute("aria-pressed") }));
    assert(an.text === "Live läuft" && an.p === "true" && an.oben === "true", "1.11 ein Klick startet Live wie der Knopf der Titelleiste: „Live läuft“", an);
    // Live liest den neuesten Kampf und zeigt ihn - Start ist dann verlassen; aus ueber die Titelleiste
    await p.evaluate(() => document.querySelector("#btnWatch").click());
    await p.waitForFunction(() => !document.body.classList.contains("watching"), null, { timeout: 3000 }).catch(() => {});
    assert(!s.fehler.length, "Start mit Ordner: keine Fehler", s.fehler);
    await p.close();
    // Englisch, und ein Ordner ohne gelesene Dateien: der Satz statt erfundener Zeilen
    const e = await oeffne({ app: true, ordner: work, config: { logIndex: INDEX9 } });
    await e.page.waitForFunction(() => document.querySelectorAll("#landZuletzt .zr:not(#landBspZeile)").length > 0, null, { timeout: 3000 }).catch(() => {});
    const be = await startBlick(e.page);
    assert(be.zulTitel === "Recently opened" && be.zeilen[0]?.n === "13 fights in history" && be.ordner?.text === "Choose log folder" && be.bsp?.text === "View the sample fight" &&
      be.satz.startsWith("Borometer reads the combat log"), "1.x Englisch: Recently opened, 13 fights in history, Choose log folder", { t: be.zulTitel, z: be.zeilen[0], o: be.ordner, b: be.bsp });
    await e.page.close();
    const l = await oeffne({ app: true, lang: "de", ordner: work });
    const bl = await startBlick(l.page);
    assert(bl.zul && !bl.zeilen.length && /Noch keine Datei gelesen/.test(bl.leer) && bl.bspZeile, "1.8 ohne gelesene Dateien: ein Satz, keine erfundenen Zeilen, der Beispielkampf bleibt",
      { leer: bl.leer, zeilen: bl.zeilen });
    await l.page.close();
  }

  // --- Fixrunde 1 (Pruefung Befund 6): Kontrast der Texte auf Start in drei Themen, mit und ohne Ordner, mindestens 4,5:1
  {
    const lum = (rgb) => { const [r, g, b] = rgb.slice(0, 3).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
    const kontrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
    for (const thema of ["dark", "light", "tnl"]) for (const mitOrdner of [false, true]) {
      const s = await oeffne({ app: true, lang: "de", config: Object.assign({ theme: thema }, mitOrdner ? { logIndex: INDEX9 } : {}), ...(mitOrdner ? { ordner: work } : {}) });
      const p = s.page;
      if (mitOrdner) await p.waitForFunction(() => document.querySelectorAll("#landZuletzt .zr:not(#landBspZeile)").length > 0, null, { timeout: 3000 }).catch(() => {});
      const saetze = await p.evaluate(() => {
        const rgba = (c) => { const m = c.match(/[\d.]+/g) || ["0", "0", "0", "0"]; return [+m[0], +m[1], +m[2], m[3] === undefined ? 1 : +m[3]]; };
        const misch = (o, u2) => [0, 1, 2].map((i) => o[i] * o[3] + u2[i] * (1 - o[3])).concat(1);
        const grund = (e) => { const sch = []; for (let x = e; x; x = x.parentElement) { const c = rgba(getComputedStyle(x).backgroundColor); if (c[3] > 0) sch.push(c); if (c[3] >= 1) break; }
          let g = [255, 255, 255, 1]; for (const c of sch.reverse()) g = misch(c, g); return g; };
        const out = [];
        const it = document.createTreeWalker(document.querySelector("#land"), NodeFilter.SHOW_TEXT);
        for (let n; (n = it.nextNode()); ) {
          const e = n.parentElement;
          if (!n.textContent.trim() || !e || e.closest(".vh,.btn.hot") || !e.getClientRects().length) continue;
          const g = grund(e); out.push({ text: n.textContent.trim().slice(0, 30), farbe: misch(rgba(getComputedStyle(e).color), g), grund: g });
        }
        return out;
      });
      const schwach = saetze.map((x) => ({ ...x, k: +kontrast(x.farbe, x.grund).toFixed(2) })).filter((x) => x.k < 4.5);
      assert(saetze.length >= 12 && !schwach.length, `1 Kontrast ${thema}${mitOrdner ? " mit Ordner" : ""}: jeder Text auf Start mindestens 4,5:1 (${saetze.length} geprueft)`, schwach);
      await p.close();
    }
  }

  /* --- 9.1: Weeklies ohne Charakter leer, ruhig und gekennzeichnet - Kopf wie im Entwurf, keine Skelettzeilen.
     Folgt Spezifikation Weeklies (29.09., Aufgabe W3): im Kopf statt "kommt spaeter" die Reset-Anzeige, im
     leeren Feld der Satz und "+ Charakter" (fuenf Texte statt vier); die Liste selbst prueft test-weeklies-page.mjs. */
  {
    const s = await oeffne({ lang: "de" });
    const p = s.page;
    await bereich(p, "weeklies");
    const w = await p.evaluate(() => {
      const q = (x) => document.querySelector(x);
      const r = (e) => e && e.getClientRects().length ? e.getBoundingClientRect().toJSON() : null;
      const x = q("#weeklies");
      return { kopf: (q("#weeklies .wkopf")?.textContent || "").replace(/\s+/g, " ").trim(), kopfR: r(q("#weeklies .wkopf")), w: r(x), box: r(q("#weeklies .wbox")),
        skelett: x ? x.querySelectorAll("ul,ol,li,table,[class*=skel],[class*=zeile],.zr,[role=list],[role=row]").length : -1,
        texte: x ? [...x.querySelectorAll("*")].filter((e) => [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())).map((e) => e.tagName + ":" + e.textContent.trim()) : [] };
    });
    assert(/^Weeklies Nächster Wochen-Reset: Do 10:00 \u00b7 in \d.* Täglicher Reset: 10:00 \u00b7 in \d.*$/.test(w.kopf) && w.kopfR && w.w && Math.abs(w.kopfR.top - w.w.top) < 1,
      "9.1 Kopf wie im Entwurf: „Weeklies“ und die Reset-Anzeige oben", { kopf: w.kopf, kopfR: w.kopfR });
    assert(w.skelett === 0 && JSON.stringify(w.texte.map((x) => x.split(":")[0])) === JSON.stringify(["H2", "SPAN", "SPAN", "P", "BUTTON"]),
      "9.1 ruhig: keine Skelettzeilen, nur Ueberschrift, Reset-Anzeige, Satz und „+ Charakter“", w.texte);
    const mitte = w.box && w.kopfR ? Math.abs((w.box.top + w.box.bottom) / 2 - (w.kopfR.bottom + w.w.bottom) / 2) : null;
    assert(mitte !== null && mitte <= 24, "9.1 das leere Feld steht in der Mitte der Flaeche unter dem Kopf", { mitte });
    assert(!s.fehler.length, "Weeklies: keine Fehler", s.fehler);
    await p.close();
  }

  // --- Groessen: Start ohne und mit Ordner, Weeklies - 1280 x 860, 1920 x 1080, 2000 x 1480, dazu 1000, 760, 560
  for (const [breite, hoehe] of [[1280, 860], [1920, 1080], [2000, 1480], [1000, 860], [760, 860], [560, 860]]) {
    for (const mitOrdner of [false, true]) {
      const s = await oeffne({ app: breite >= 760, lang: "de", breite, hoehe, ...(mitOrdner ? { ordner: work, config: { logIndex: INDEX9 } } : {}) });
      const p = s.page;
      if (mitOrdner) await p.waitForFunction(() => document.querySelectorAll("#landZuletzt .zr:not(#landBspZeile)").length > 0, null, { timeout: 3000 }).catch(() => {});
      const b = await startBlick(p);
      const wo = `${breite} × ${hoehe}${mitOrdner ? " mit Ordner" : ""}`;
      assert(!b.quer && !b.klein.length && !s.fehler.length, `1 ${wo}: kein waagerechtes Rollen, Text mindestens 11 Punkt, keine Fehler`, { klein: b.klein, fehler: s.fehler });
      const spalten = b.links && b.rechts ? (b.links.right <= b.rechts.left ? 2 : b.rechts.top >= b.links.bottom - 1 ? 1 : 0) : 0;
      assert(spalten === (breite >= 1000 ? 2 : 1), `1 ${wo}: ${breite >= 1000 ? "zwei Spalten" : "untereinander"}`, { links: b.links, rechts: b.rechts });
      if (b.scroll <= 0) assert(mittig(b) !== null && mittig(b) <= 48, `1 ${wo}: ueber die Hoehe verteilt`, { mittig: mittig(b) });
      if (breite === 2000) assert(b.inhalt && b.inhalt.unten - b.inhalt.oben >= 0.5 * b.land.height && b.drop.r.height >= 300,
        `1 ${wo}: der Inhalt nutzt die Hoehe (mindestens die Haelfte, Ablagefeld mindestens 300 Punkt; Fixrunde 1, Pruefung Befund 2)`, { inhalt: b.inhalt, land: b.land, drop: b.drop?.r });
      assert(b.satzBreite !== null && b.satzBreite <= 620, `1 ${wo}: nichts gestreckt, der Satz hoechstens 620 Punkt breit`, b.satzBreite);
      if (!mitOrdner) {
        await bereich(p, "weeklies");
        const w = await p.evaluate(() => ({ quer: document.documentElement.scrollWidth > innerWidth, doc: document.documentElement.scrollHeight - innerHeight,
          kopf: !!document.querySelector("#weeklies .wkopf")?.getClientRects().length }));
        assert(!w.quer && w.doc <= 0 && w.kopf, `9.1 ${wo}: Weeklies mit Kopf, ohne Rollen`, w);
      }
      await p.close();
    }
  }

  // ===== Abschnitt 10: Einstellungen (Luecken 10) =====
  const VERSION10 = JSON.parse(readFileSync(join(root, "package.json"), "utf8")).version.replace(/\.0$/, "");
  const clogMod = await esbuild.build({ stdin: { contents: 'export { BORO_CHANGELOG } from "./src/renderer/app/02-changelog";', resolveDir: root, loader: "ts" },
    bundle: true, format: "esm", platform: "node", write: false, logLevel: "silent", plugins: [bilderPlugin(root, bilderModus(root))] });
  const { BORO_CHANGELOG } = await import("data:text/javascript;base64," + Buffer.from(clogMod.outputFiles[0].text).toString("base64"));
  const ABSCHNITTE = ["darst", "sprache", "groesse", "overlay", "logs", "gruppe", "dev", "info"];
  const einstBlick = (p) => p.evaluate(() => {
    const q = (x) => document.querySelector(x);
    const r = (e) => e && e.getClientRects().length ? e.getBoundingClientRect().toJSON() : null;
    const sicht = (e) => !!e && e.getClientRects().length > 0 && getComputedStyle(e).visibility !== "hidden";
    const klein = [];
    const einst = q("#einst");
    if (einst) {
      const it = document.createTreeWalker(einst, NodeFilter.SHOW_TEXT);
      for (let n; (n = it.nextNode()); ) {
        const e = n.parentElement;
        if (!n.textContent.trim() || !e || e.closest(".vh,[aria-hidden=true]") || !sicht(e)) continue;
        const g = parseFloat(getComputedStyle(e).fontSize);
        if (g < 11) klein.push(n.textContent.trim().slice(0, 24) + ":" + g);
      }
    }
    return {
      abschnitte: [...document.querySelectorAll("#einst section.egruppe")].map((x) => ({ id: x.id, h: (x.querySelector("h3")?.textContent || "").trim(), sicht: sicht(x), r: r(x),
        hid: x.querySelector("h3")?.id, lab: x.getAttribute("aria-labelledby") })),
      nav: [...document.querySelectorAll("#einstNav button")].map((b) => ({ k: b.dataset.gruppe, text: b.textContent.trim(), svg: !!b.querySelector("svg"), an: b.getAttribute("aria-current") })),
      navR: r(q("#einstNav")), kopf: q("header.top").getBoundingClientRect().bottom, hoch: innerHeight,
      zeilen: [...document.querySelectorAll("#einst .ezeile")].filter(sicht).map((z) => Math.round(z.getBoundingClientRect().height)),
      fokus: document.activeElement?.id || "", klein, quer: document.documentElement.scrollWidth > innerWidth,
      aktuell: [...document.querySelectorAll("#einstNav button")].filter((b) => b.hasAttribute("aria-current")).map((b) => b.dataset.gruppe),
    };
  });
  const aktuell10 = (p) => p.evaluate(() => [...document.querySelectorAll("#einstNav button")].filter((b) => b.hasAttribute("aria-current")).map((b) => b.dataset.gruppe).join());
  const zuEinst = async (p) => { await bereich(p, "settings"); await p.waitForFunction(() => !document.querySelector("#einst").hidden, null, { timeout: 3000 }).catch(() => {}); };

  // --- 10.1, 10.2: eine rollende Seite mit Sprungleiste und acht Abschnitten, kompakt
  {
    const s = await oeffne({ app: true, lang: "de" });
    const p = s.page;
    await beispiel(p);
    await zuEinst(p);
    const e = await einstBlick(p);
    assert(JSON.stringify(e.abschnitte.map((x) => x.h)) === JSON.stringify(["Darstellung", "Sprache", "Größe", "Overlay", "Log-Ordner", "Gruppe und Server", "Entwickler", "Info"]) &&
      e.abschnitte.every((x, i) => x.id === "eg-" + ABSCHNITTE[i] && x.hid === "egh-" + ABSCHNITTE[i] && x.lab === x.hid),
      "10.2 acht Abschnitte in der Reihenfolge des Entwurfs, jeder eine Region mit seiner Ueberschrift", e.abschnitte.map((x) => x.id + ":" + x.h));
    assert(e.abschnitte.length === 8 && e.abschnitte.every((x) => x.sicht) && e.abschnitte.every((x, i) => i === 0 || x.r.top >= e.abschnitte[i - 1].r.bottom - 1),
      "10.1 eine rollende Seite: alle Abschnitte stehen untereinander, keiner ist verborgen", e.abschnitte.map((x) => x.r && Math.round(x.r.top)));
    assert(JSON.stringify(e.nav.map((x) => x.k)) === JSON.stringify(ABSCHNITTE) && e.nav.every((x, i) => x.text === e.abschnitte[i]?.h && x.svg),
      "10.1 Sprungleiste: ein Knopf mit Symbol je Abschnitt, gleiche Namen und Reihenfolge", e.nav);
    assert(e.nav.length === 8 && e.navR && e.abschnitte[0].r && e.navR.right <= e.abschnitte[0].r.left && JSON.stringify(e.aktuell) === '["darst"]',
      "10.1 die Leiste links, am Anfang leuchtet Darstellung", { nav: e.navR, aktuell: e.aktuell });
    const breit = Math.max(...e.abschnitte.map((x) => x.r.width));
    const hoch = [...e.zeilen].sort((a, b) => a - b)[Math.floor(e.zeilen.length / 2)];
    assert(breit <= 820 && hoch <= 56 && Math.max(...e.zeilen) <= 96,
      "10.2 kompakt: Abschnitte hoechstens 820 Punkt breit, Zeilen im Mittel hoechstens 56 Punkt hoch", { breit, hoch, zeilen: e.zeilen });
    // ein Klick springt: der Abschnitt steht unter der Titelleiste, der Fokus auf seiner Ueberschrift, er leuchtet
    const spruenge = [];
    for (const k of ["logs", "dev", "info", "sprache"]) {
      await p.click(`#einstNav button[data-gruppe="${k}"]`);
      await p.waitForFunction((k) => { const h = document.querySelector("#egh-" + k); if (!h) return false; const t = h.getBoundingClientRect().top;
        const w = window.__t10; window.__t10 = t; return w === t && document.activeElement === h; }, k, { timeout: 4000, polling: 120 }).catch(() => {});
      const j = await p.evaluate((k) => { const h = document.querySelector("#egh-" + k).getBoundingClientRect();
        return { oben: h.top, unten: h.bottom, kopf: document.querySelector("header.top").getBoundingClientRect().bottom, hoch: innerHeight, fokus: document.activeElement?.id }; }, k);
      const an = await aktuell10(p);
      spruenge.push({ k, gut: j.fokus === "egh-" + k && j.oben >= j.kopf - 0.5 && j.unten <= j.hoch && an === k, j, an });
    }
    assert(spruenge.every((x) => x.gut), "10.1 ein Klick in der Sprungleiste (Log-Ordner, Entwickler, Info, Sprache): der Abschnitt steht im Bild unter der Titelleiste, Fokus auf seiner Ueberschrift, nur er leuchtet", spruenge);
    /* Fixrunde 1 (Pruefung Befund 7): der Sprung per Tastatur - Enter auf dem Knopf, Fokus auf der Ueberschrift,
       der naechste Tab geht zum ersten Bedienelement des Abschnitts */
    await p.focus('#einstNav button[data-gruppe="gruppe"]');
    await p.keyboard.press("Enter");
    await p.waitForFunction(() => { const h = document.querySelector("#egh-gruppe"); if (!h || document.activeElement !== h) return false;
      const t = h.getBoundingClientRect().top, w = window.__t10k; window.__t10k = t; return w === t; }, null, { timeout: 4000, polling: 120 }).catch(() => {});
    const tj = await p.evaluate(() => { const h = document.querySelector("#egh-gruppe").getBoundingClientRect();
      return { fokus: document.activeElement?.id, oben: h.top, unten: h.bottom, kopf: document.querySelector("header.top").getBoundingClientRect().bottom, hoch: innerHeight }; });
    const tan = await aktuell10(p);
    await p.keyboard.press("Tab");
    const tnach = await p.evaluate(() => document.activeElement?.id);
    assert(tj.fokus === "egh-gruppe" && tj.oben >= tj.kopf - 0.5 && tj.unten <= tj.hoch && tan === "gruppe" && tnach === "eServer",
      "10.1 Tastatur: Enter auf „Gruppe und Server“ springt, Fokus auf der Ueberschrift, nur er leuchtet, Tab fuehrt ins Feld Gruppen-Server", { tj, tan, tnach });
    // beim Rollen leuchtet der Abschnitt mit, der oben steht
    await p.evaluate(() => { const h = document.querySelector("#egh-overlay"); window.scrollTo(0, h.getBoundingClientRect().top + scrollY - 60); });
    await p.waitForFunction(() => document.querySelector("#einstNav [aria-current]")?.dataset.gruppe === "overlay", null, { timeout: 3000 }).catch(() => {});
    let an = await aktuell10(p);
    assert(an === "overlay", "10.1 beim Rollen: Overlay oben, Overlay leuchtet", an);
    await p.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await p.waitForFunction(() => document.querySelector("#einstNav [aria-current]")?.dataset.gruppe === "info", null, { timeout: 3000 }).catch(() => {});
    an = await aktuell10(p);
    const navNoch = await p.evaluate(() => { const n = document.querySelector("#einstNav").getBoundingClientRect(); return n.top >= document.querySelector("header.top").getBoundingClientRect().bottom - 0.5 && n.bottom <= innerHeight; });
    assert(an === "info" && navNoch, "10.1 ganz unten leuchtet Info, die Sprungleiste haftet im Bild", { an, navNoch });
    await p.evaluate(() => window.scrollTo(0, 0));
    await p.waitForFunction(() => document.querySelector("#einstNav [aria-current]")?.dataset.gruppe === "darst", null, { timeout: 3000 }).catch(() => {});
    assert(await aktuell10(p) === "darst", "10.1 wieder oben: Darstellung leuchtet");
    assert(!s.fehler.length, "10.1/10.2: keine Fehler", s.fehler);
    await p.close();
  }

  // --- 10.3, 10.4: Darstellung mit Kacheln Dunkel/Hell/TnL/Auto; Bewegung verringern nur als Anzeige "folgt Windows"
  for (const ruhig of [false, true]) {
    const s = await oeffne({ app: true, lang: "de", ruhig });
    const p = s.page;
    await zuEinst(p);
    const d = await p.evaluate(() => {
      const g = document.querySelector("#eThema");
      const k = [...document.querySelectorAll("#eThema .thk")];
      return { rolle: g?.getAttribute("role"), name: g ? (g.getAttribute("aria-label") || document.getElementById(g.getAttribute("aria-labelledby") || "")?.textContent || "") : "",
        kacheln: k.map((b) => ({ th: b.dataset.theme, rolle: b.getAttribute("role"), an: b.getAttribute("aria-checked"), tab: b.tabIndex,
          name: (b.querySelector(".tn2")?.textContent || "").replace(/\s+/g, " ").trim(), vorschau: !!b.querySelector(".thv[aria-hidden=true]"),
          r: b.getBoundingClientRect().toJSON() })),
        bewegung: (document.querySelector("#eBewegung")?.textContent || "").trim(),
        bewegungBedien: document.querySelector("#eBewegung")?.closest(".ezeile")?.querySelectorAll("button,input,[role=switch]").length ?? -1,
        bewegungName: (document.querySelector("#eBewegung")?.closest(".ezeile")?.querySelector(".ezt b")?.textContent || "").trim() };
    });
    if (!ruhig) {
      assert(d.rolle === "radiogroup" && d.name === "Thema" && JSON.stringify(d.kacheln.map((x) => x.th)) === '["dark","light","tnl","auto"]' &&
        d.kacheln.every((x) => x.rolle === "radio" && x.vorschau) && JSON.stringify(d.kacheln.map((x) => x.name)) === '["Dunkel","Hell","TnL","Auto wie Windows"]',
        "10.3 Themen als vier Kacheln mit Vorschau: Dunkel, Hell, TnL, Auto (wie Windows)", d.kacheln);
      assert(d.kacheln.every((x) => Math.abs(x.r.top - d.kacheln[0].r.top) < 1 && x.r.width >= 120 && x.r.height >= 100) &&
        d.kacheln.filter((x) => x.an === "true").length === 1 && d.kacheln.find((x) => x.an === "true").th === "dark" && d.kacheln.filter((x) => x.tab === 0).length === 1,
        "10.3 in einer Reihe, gewaehlt ist Dunkel, ein Tabstopp", d.kacheln);
      await p.click('#eThema .thk[data-theme="auto"]', { timeout: 3000 }).catch(() => {});
      await p.waitForFunction(() => document.querySelector('#eThema [data-theme="auto"]')?.getAttribute("aria-checked") === "true", null, { timeout: 3000 }).catch(() => {});
      const auto = await p.evaluate(() => document.querySelector('#eThema .thk[data-theme="auto"]')?.getAttribute("aria-checked") ?? null);
      assert(auto === "true" && s.posts.some((b) => b.theme === "auto"), "10.3 die Kachel Auto waehlen: POST {theme:\"auto\"} wie bisher", { auto, posts: s.posts });
    }
    assert(d.bewegungName === "Bewegung verringern" && d.bewegung === (ruhig ? "folgt Windows: an" : "folgt Windows: aus") && d.bewegungBedien === 0,
      `10.4 Bewegung verringern nur als Anzeige „folgt Windows“ (${ruhig ? "Windows reduziert" : "Windows nicht reduziert"}), ohne Schalter`, d);
    assert(!s.fehler.length, "10.3/10.4: keine Fehler", s.fehler);
    await p.close();
  }

  // --- 10.5, 10.6, 10.12: Overlay mit Durchsicht, Durchklickbar (Kuerzel), Ueber dem Spiel halten, Overlay ansehen
  {
    const s = await oeffne({ app: true, lang: "de" });
    const p = s.page;
    await beispiel(p);
    await zuEinst(p);
    const o = await p.evaluate(() => {
      const g = document.querySelector("#eg-overlay"), q = (x) => document.querySelector(x);
      return { see: !!g?.querySelector("#eSee"), keys: [...(g?.querySelectorAll("kbd") || [])].map((k) => k.textContent),
        klick: (q("#eKuerzelSatz")?.closest(".ezeile")?.querySelector(".ezt b")?.textContent || "").trim(), satz: q("#eKuerzelSatz")?.textContent.trim(), note: q("#hotkeyNote").textContent.trim(),
        oben: q("#eOben") ? { rolle: q("#eOben").getAttribute("role"), an: q("#eOben").getAttribute("aria-checked"), name: q("#eOben").getAttribute("aria-labelledby") ? document.getElementById(q("#eOben").getAttribute("aria-labelledby"))?.textContent.trim() : "",
          imAbschnitt: !!q("#eOben").closest("#eg-overlay") } : null,
        pin: q("#btnPin").getAttribute("aria-pressed"), ansehen: q("#eOverlay") ? { text: q("#eOverlay").textContent.trim(), im: !!q("#eOverlay").closest("#eg-overlay") } : null };
    });
    assert(o.see && o.klick === "Durchklickbar" && o.satz === o.note && JSON.stringify(o.keys) === '["Strg","Umschalt","D"]',
      "10.5/10.12 Durchklickbar mit dem Kuerzel Strg+Umschalt+D und dem Satz von #hotkeyNote, im Abschnitt Overlay", o);
    assert(o.oben && o.oben.rolle === "switch" && o.oben.an === "false" && o.oben.name === "Über dem Spiel halten" && o.oben.imAbschnitt && o.pin === "false",
      "10.6 „Über dem Spiel halten“ als Schalter, aus wie der Knopf der Titelleiste", o.oben);
    await p.click("#eOben");
    await bis(() => s.win.some((b) => b.do === "pin"));
    await p.waitForFunction(() => document.querySelector("#eOben").getAttribute("aria-checked") === "true", null, { timeout: 3000 }).catch(() => {});
    const pin = await p.evaluate(() => ({ sw: document.querySelector("#eOben").getAttribute("aria-checked"), knopf: document.querySelector("#btnPin").getAttribute("aria-pressed") }));
    const pinPost = s.win.find((b) => b.do === "pin");
    assert(pinPost && pinPost.on === true && pinPost.remember === false && pin.sw === "true" && pin.knopf === "true",
      "10.6 der Schalter heftet an wie #btnPin (in der Vollansicht nur fuer die Sitzung), beide zeigen an", { pinPost, pin });
    assert(o.ansehen && o.ansehen.text === "Overlay ansehen" && o.ansehen.im, "10.12 „Overlay ansehen“ im Abschnitt Overlay", o.ansehen);
    await p.click("#eOverlay");
    await p.waitForFunction(() => document.body.classList.contains("compact"), null, { timeout: 3000 }).catch(() => {});
    assert(await p.evaluate(() => document.body.classList.contains("compact")), "10.12 „Overlay ansehen“ zeigt das Kompaktfenster");
    await p.evaluate(() => document.querySelector("#btnCompact").click());
    await p.waitForFunction(() => !document.body.classList.contains("compact") && !document.querySelector("#einst").hidden, null, { timeout: 3000 }).catch(() => {});
    assert(await p.evaluate(() => !document.querySelector("#einst").hidden), "10.12 zurueck aus dem Overlay: wieder die Einstellungen");
    assert(!s.fehler.length, "10.5/10.6: keine Fehler", s.fehler);
    await p.close();
  }

  // --- 10.7, 10.8, 10.12: Log-Ordner mit Pfad, Live-Aufzeichnung als Schalter, Filter und Kampfdatei; "Im Explorer zeigen"
  //     folgt der Spezifikation Nachtraege N1 (docs/superpowers/specs/2026-09-30-nachtraege-design.md): der Knopf
  //     steht neben "Ordner aendern", nur mit dem Helfer, und schickt genau {folder:"game"} - einen Schluessel, nie einen Pfad
  {
    const s = await oeffne({ app: true, lang: "de", ordner: work });
    const p = s.page;
    await zuEinst(p);
    const l = await p.evaluate(() => {
      const g = document.querySelector("#eg-logs"), q = (x) => document.querySelector(x);
      const in_ = (id) => !!g?.querySelector("#" + id);
      const sicht = (e) => !!e && e.getClientRects().length > 0;
      const ex = [...document.querySelectorAll("button")].filter((b) => /Explorer/.test(b.textContent));
      return { pfad: (q("#eOrdner")?.textContent || "").trim(), teile: ["eOrdner", "eOrdnerAendern", "eOrdnerExplorer", "eLive", "eGap", "eMin", "ePhasen", "eSpeichern", "eLaden"].filter((x) => !in_(x)),
        live: q("#eLive") ? { rolle: q("#eLive").getAttribute("role"), an: q("#eLive").getAttribute("aria-checked"),
          satz: (q("#eLive").closest(".ezeile")?.querySelector(".ezt span")?.textContent || "").trim() } : null,
        aendern: (q("#eOrdnerAendern")?.textContent || "").trim(),
        explorer: ex.length, exId: ex[0]?.id || "", exText: (ex[0]?.textContent || "").trim(), exSicht: sicht(ex[0]),
        exNeben: !!ex[0] && ex[0].parentElement === q("#eOrdnerAendern")?.parentElement && ex[0].previousElementSibling === q("#eOrdnerAendern") };
    });
    assert(l.pfad === work && !l.teile.length && l.aendern === "Ordner ändern" && l.explorer === 1
        && l.exId === "eOrdnerExplorer" && l.exText === "Im Explorer zeigen" && l.exSicht && l.exNeben,
      "10.12 Log-Ordner: Pfad, Ordner ändern, Live, Filter (trennen, Mindestdauer, Phasen) und Kampfdatei; „Im Explorer zeigen“ genau einmal, sichtbar, gleich neben „Ordner ändern“ (Nachträge N1)", l);
    /* {ok:true}: das Oeffnen bestaetigt sich selbst, die Seite sagt nichts (Pruefung N1, G2) - gewartet wird
       auf die Antwort und zwei Bilder danach, nicht auf eine feste Zeit */
    const vorher = await p.evaluate(() => document.querySelector("#toast").classList.contains("on"));
    const antwort = p.waitForResponse((r) => r.url().endsWith("/api/folder/open"), { timeout: 3000 }).catch(() => null);
    await p.click("#eOrdnerExplorer", { timeout: 3000 }).catch(() => {});
    const ok = await antwort;
    await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    const still = await p.evaluate(() => ({ on: document.querySelector("#toast").classList.contains("on"), text: document.querySelector("#toast").textContent.trim() }));
    assert(s.ordner.length === 1 && s.ordner[0] === '{"folder":"game"}',
      "N1 „Im Explorer zeigen“ schickt POST /api/folder/open mit genau {folder:\"game\"}, einmal", s.ordner);
    assert(ok && !vorher && !still.on, "N1 bei {ok:true} sagt die Seite nichts (kein Satz)", { antwort: !!ok, vorher, still });
    assert(l.live && l.live.rolle === "switch" && l.live.an === "false" && /Von allein startet sie nie/.test(l.live.satz), "10.8 Live-Aufzeichnung als Schalter: aus, von allein startet sie nie", l.live);
    await p.click("#eLive");
    await p.waitForFunction(() => document.body.classList.contains("watching"), null, { timeout: 3000 }).catch(() => {});
    const an = await p.evaluate(() => ({ sw: document.querySelector("#eLive").getAttribute("aria-checked"), knopf: document.querySelector("#btnWatch").getAttribute("aria-pressed") }));
    assert(an.sw === "true" && an.knopf === "true", "10.8 der Schalter startet Live wie der Knopf der Titelleiste, beide zeigen an", an);
    /* Live liest den neuesten Kampf und zeigt ihn - wie jede neue Datei verlaesst das die Einstellungen;
       aus ueber die Titelleiste, der Schalter folgt */
    await p.evaluate(() => document.querySelector("#btnWatch").click());
    await p.waitForFunction(() => !document.body.classList.contains("watching"), null, { timeout: 3000 }).catch(() => {});
    assert(await p.evaluate(() => document.querySelector("#eLive").getAttribute("aria-checked")) === "false", "10.8 und wieder aus: der Schalter folgt der Titelleiste");
    assert(!s.fehler.length, "10.7/10.8: keine Fehler", s.fehler);
    await p.close();
  }

  // --- N1: kann der Helfer den Log-Ordner nicht oeffnen ({ok:false}), sagt die Seite es ruhig (kein "bad"-Ton);
  //     im Browser ohne Helfer (file://) fehlt der Knopf wie "Ordner aendern" (Spezifikation Nachtraege N1)
  {
    const s = await oeffne({ app: true, lang: "de", ordner: work, ordnerAuf: { ok: false } });
    const p = s.page;
    await zuEinst(p);
    await p.click("#eOrdnerExplorer", { timeout: 3000 }).catch(() => {});
    await p.waitForFunction(() => document.querySelector("#toast").classList.contains("on"), null, { timeout: 3000 }).catch(() => {});
    const t = await p.evaluate(() => { const e = document.querySelector("#toast"); return { on: e.classList.contains("on"), ruhig: e.classList.contains("ruhig"), bad: e.classList.contains("bad"), text: e.textContent.trim() }; });
    assert(s.ordner.length === 1 && s.ordner[0] === '{"folder":"game"}' && t.on && t.ruhig && !t.bad
        && t.text === "Der Log-Ordner lässt sich gerade nicht öffnen. Ist er noch da? Sonst hilft „Ordner ändern“.",
      "N1 ohne Ordner beim Helfer: ein ruhiger Satz, kein Fehlerton", { t, ordner: s.ordner });
    assert(!s.fehler.length, "N1 Fehlerfall: keine Fehler", s.fehler);
    await p.close();

    /* keine Antwort vom Helfer: derselbe ruhige Satz (Pruefung N1, G2) */
    const k = await oeffne({ app: true, lang: "de", ordner: work, ordnerAuf: "keine" });
    await zuEinst(k.page);
    await k.page.click("#eOrdnerExplorer", { timeout: 3000 }).catch(() => {});
    await k.page.waitForFunction(() => document.querySelector("#toast").classList.contains("on"), null, { timeout: 3000 }).catch(() => {});
    const kt = await k.page.evaluate(() => { const e = document.querySelector("#toast"); return { on: e.classList.contains("on"), ruhig: e.classList.contains("ruhig"), bad: e.classList.contains("bad"), text: e.textContent.trim() }; });
    assert(k.ordner.length === 1 && kt.on && kt.ruhig && !kt.bad
        && kt.text === "Der Log-Ordner lässt sich gerade nicht öffnen. Ist er noch da? Sonst hilft „Ordner ändern“.",
      "N1 ohne Antwort des Helfers: derselbe ruhige Satz", { kt, ordner: k.ordner });
    assert(!k.fehler.length, "N1 ohne Antwort: keine Fehler", k.fehler);
    await k.page.close();

    /* "Ordner oeffnen" im Dateidialog schickt seinen Schluessel im selben Feld (which -> folder, Pruefung N1, G2):
       Kampfdatei laden ohne gespeicherte Datei zeigt den Dialog mit "Ordner oeffnen" fuer "logs" */
    const d = await oeffne({ app: true, lang: "de", ordner: work });
    await zuEinst(d.page);
    await d.page.click("#eLaden", { timeout: 3000 }).catch(() => {});
    await d.page.waitForFunction(() => document.querySelector("#modalBg").classList.contains("on")
      && (document.querySelector("#modalOk")?.textContent || "").trim() === "Ordner öffnen", null, { timeout: 3000 }).catch(() => {});
    const dk = await d.page.evaluate(() => (document.querySelector("#modalOk")?.textContent || "").trim());
    await d.page.click("#modalOk", { timeout: 3000 }).catch(() => {});
    for (let i = 0; i < 120 && !d.ordner.length; i++) await new Promise((r) => setTimeout(r, 25));
    assert(dk === "Ordner öffnen" && d.ordner.length === 1 && d.ordner[0] === '{"folder":"logs"}',
      "N1 „Ordner öffnen“ im Dialog der Kampfdatei schickt genau {folder:\"logs\"}", { dk, ordner: d.ordner });
    assert(!d.fehler.length, "N1 Dialog: keine Fehler", d.fehler);
    await d.page.close();

    const b = await browser.newPage({ viewport: { width: 1280, height: 860 } });
    const fehler = [];
    b.on("pageerror", (e) => fehler.push(String(e)));
    await b.addInitScript(() => { try { localStorage.clear(); localStorage.setItem("boroLang", "de"); } catch { /* blockiert */ } });
    await b.goto(pathToFileURL(join(root, "dist", "renderer", "index.html")).href);
    await b.waitForFunction(() => document.readyState === "complete" && !!document.querySelector('#bereiche [data-tab="settings"]'), null, { timeout: 5000 }).catch(() => {});
    await zuEinst(b);
    const f = await b.evaluate(() => {
      const sicht = (e) => !!e && e.getClientRects().length > 0;
      return { einst: sicht(document.querySelector("#eg-logs")), aendern: sicht(document.querySelector("#eOrdnerAendern")),
        explorer: [...document.querySelectorAll("button")].filter((x) => /Explorer/.test(x.textContent) && sicht(x)).length,
        da: !!document.querySelector("#eOrdnerExplorer") };
    });
    assert(f.einst && f.da && !f.aendern && f.explorer === 0, "N1 im Browser ohne Helfer fehlt „Im Explorer zeigen“ wie „Ordner ändern“", f);
    assert(!fehler.length, "N1 Browser: keine Fehler", fehler);
    await b.close();
  }

  // --- 10.9: Gruppe und Server - speichern und pruefen nur hier, nicht doppelt im Bereich Gruppe
  //     (aus 7.2 hierher gezogen, Pruefung Aufgabe 7 Befund 2; folgt Entwurf, E:942)
  {
    const s = await oeffne({ app: true, partyServer: "203.0.113.9:8732" });
    const p = s.page;
    await zuEinst(p);
    const stand = () => p.evaluate(() => ({ status: !!document.querySelector("#eServerStatus")?.getClientRects().length,
      offen: document.querySelector("#eServerOffen")?.getClientRects().length ? document.querySelector("#eServerOffen").textContent : "",
      knopf: document.querySelector("#eServerSave")?.getClientRects().length ? document.querySelector("#eServerSave").textContent.trim() : "",
      pruefen: document.querySelector("#eServerCheck")?.getClientRects().length ? document.querySelector("#eServerCheck").textContent.trim() : "",
      wert: document.querySelector("#eServer")?.value ?? null, label: (document.querySelector('label[for="eServer"]')?.textContent || "").trim(),
      im: !!document.querySelector("#eServer")?.closest("#eg-gruppe") }));
    await p.waitForFunction(() => document.querySelector("#eServer")?.value === "203.0.113.9:8732", null, { timeout: 3000 }).catch(() => {});
    /* Fixrunde 1 (Pruefung Befund 3): nichts laedt von allein - das Oeffnen der Einstellungen fragt den
       Gruppen-Server nicht an, der Status steht erst nach "Jetzt pruefen" */
    const ungefragt = await stand();
    assert(ungefragt.im && ungefragt.wert === "203.0.113.9:8732" && ungefragt.label === "Party server" && ungefragt.knopf === "Save" && ungefragt.pruefen === "Check now" &&
      !ungefragt.status && !s.party.some((x) => x.path === "/api/party/check"),
      "10.9 Gruppen-Server: die gespeicherte Adresse im Feld, Save und Check now daneben; das Oeffnen fragt nicht an (kein /api/party/check, kein Status)", { ungefragt, party: s.party });
    await p.click("#eServerCheck");
    await p.waitForFunction(() => !!document.querySelector("#eServerStatus")?.getClientRects().length, null, { timeout: 3000 }).catch(() => {});
    const vorher = await stand();
    assert(vorher.status && !vorher.offen && s.party.filter((x) => x.path === "/api/party/check").length === 1,
      "10.9 Check now: genau eine Anfrage, danach gilt der Status der gespeicherten Adresse", { vorher, party: s.party.map((x) => x.path) });
    // Sprachwechsel: das Ergebnis in der neuen Sprache, ohne neu zu fragen
    const statusEn = await p.evaluate(() => document.querySelector("#eServerStatusText").textContent);
    await p.click('#eSprache button[data-lang="de"]');
    await p.waitForFunction(() => document.documentElement.lang === "de" || document.querySelector("#einstTitel").textContent === "Einstellungen", null, { timeout: 3000 }).catch(() => {});
    await zuEinst(p);
    const statusDe = await p.evaluate(() => document.querySelector("#eServerStatusText").textContent);
    assert(statusDe && statusDe !== statusEn && s.party.filter((x) => x.path === "/api/party/check").length === 1,
      "10.9 Sprachwechsel und erneutes Oeffnen: der Status in der neuen Sprache, keine weitere Anfrage", { statusEn, statusDe, party: s.party.map((x) => x.path) });
    await p.click('#eSprache button[data-lang="en"]');
    await p.waitForFunction(() => document.querySelector("#einstTitel").textContent === "Settings", null, { timeout: 3000 }).catch(() => {});
    await p.fill("#eServer", "198.51.100.7:8732");
    const getippt = await stand();
    assert(!getippt.status && /Not saved yet/.test(getippt.offen), "10.9 eine andere Adresse im Feld: kein Status, sondern „noch nicht gespeichert“", getippt);
    await p.click("#eServerSave");
    await bis(() => s.party.some((x) => x.path === "/api/party/server"));
    await p.waitForFunction(() => !!document.querySelector("#eServerStatus")?.getClientRects().length, null, { timeout: 3000 }).catch(() => {});
    const gespeichert = await stand();
    const post = s.party.find((x) => x.path === "/api/party/server");
    assert(!!post && post.body.server === "198.51.100.7:8732" && !s.party.some((x) => x.path === "/api/party/create") && gespeichert.status && !gespeichert.offen,
      "10.9 Save: POST /api/party/server mit der Adresse aus dem Feld, ohne eine Gruppe zu starten; danach gilt der Status ihr", { post, gespeichert });
    const checks = s.party.filter((x) => x.path === "/api/party/check").length;
    await p.click("#eServerCheck");
    await bis(() => s.party.filter((x) => x.path === "/api/party/check").length > checks);
    assert(s.party.filter((x) => x.path === "/api/party/check").length === checks + 1, "10.9 Check now fragt den Helfer einmal (POST /api/party/check)", s.party.map((x) => x.path));
    // im Bereich Gruppe: das Feld zum Starten, aber kein zweites Speichern und kein Status - dafuer der Weg hierher
    await mitLog(s);
    await bereich(p, "party");
    await p.click('#pWo [data-wo="server"]');
    await p.waitForFunction(() => !!document.querySelector("#pServer")?.getClientRects().length, null, { timeout: 3000 }).catch(() => {});
    const g = await p.evaluate(() => ({ feld: document.querySelector("#pServer")?.value ?? null,
      doppelt: ["#pServerSave", "#pServerStatus", "#pServerCheck", "#pServerOffen"].filter((x) => document.querySelector(x)),
      weg: document.querySelector("#pZuEinst")?.getClientRects().length ? document.querySelector("#pZuEinst").textContent.trim() : "" }));
    assert(g.feld === "198.51.100.7:8732" && !g.doppelt.length && g.weg === "Save it in Settings ›",
      "10.9 Gruppe: das Feld traegt die gespeicherte Adresse, Speichern und Pruefen gibt es dort nicht noch einmal, ein Weg fuehrt in die Einstellungen", g);
    await p.click("#pZuEinst");
    await p.waitForFunction(() => document.activeElement?.id === "egh-gruppe", null, { timeout: 4000 }).catch(() => {});
    const dort = await p.evaluate(() => ({ einst: !document.querySelector("#einst").hidden, fokus: document.activeElement?.id,
      an: [...document.querySelectorAll("#einstNav button")].filter((b) => b.hasAttribute("aria-current")).map((b) => b.dataset.gruppe).join() }));
    assert(dort.einst && dort.fokus === "egh-gruppe" && dort.an === "gruppe", "10.9 der Weg springt zum Abschnitt Gruppe und Server", dort);
    assert(!s.fehler.length, "10.9: keine Fehler", s.fehler);
    await p.close();
  }

  // --- 10.10, 10.11, 10.12: Entwickler (Schalter, Beispiele, Fehlerbericht, Auszug aus dem Aenderungsprotokoll) und Info
  {
    const s = await oeffne({ app: true, lang: "de" });
    const p = s.page;
    await zuEinst(p);
    const d = await p.evaluate(() => {
      const g = document.querySelector("#eg-dev"), q = (x) => document.querySelector(x);
      const sicht = (e) => !!e && e.getClientRects().length > 0;
      return { knoepfe: [...(g?.querySelectorAll("button") || [])].filter(sicht).map((b) => b.id + ":" + b.textContent.replace(/\s+/g, " ").trim()),
        li: g ? g.querySelectorAll("li,ul,ol").length : -1, text: (g?.textContent || "").replace(/\s+/g, " "),
        info: (q("#eg-info")?.textContent || "").replace(/\s+/g, " ").trim(),
        sicher: [...(q("#eg-info")?.querySelectorAll("dl dt") || [])].map((x) => x.textContent.trim()),
        // folgt Spezifikation Rundgang 02.10.2026, 2: in Info dazu der Knopf "Rundgang zeigen"; die Sicherheit bleibt ohne
        infoBedien: [...(q("#eg-info")?.querySelectorAll("button,input,[role=switch]") ?? [])].map((e) => e.id),
        sicherBedien: q("#eg-info dl")?.querySelectorAll("button,input,[role=switch],a").length ?? -1 };
    });
    /* Fixrunde 1 (Pruefung Befund 1, Entscheidung): kein Auszug aus dem Protokoll auf der Seite, nur der Knopf
       zum bestehenden Dialog */
    const eintraege = [...BORO_CHANGELOG.de, ...BORO_CHANGELOG.en].slice(0, 6).flatMap((v) => v.notes);
    /* folgt der Wahl vom 01.10.: "Fehlerbericht erstellen" ist als "Fehler melden" in die Statusleiste gezogen;
       der Abschnitt nennt den Weg dorthin in seinem Satz - gleich streng: die Knoepfe genau, dazu der Satz */
    assert(JSON.stringify(d.knoepfe) === JSON.stringify(["eDev:Aus", "eBeispielkampf:Laden", "eClog:\u00c4nderungsprotokoll"])
      && /Fehlerbericht/.test(d.text) && /\u201eFehler melden\u201c unten rechts in der Statusleiste/.test(d.text),
      "10.10 Entwickler: Schalter, Beispielkampf, \u201e\u00c4nderungsprotokoll\u201c (Beispielgruppe erst im Entwicklermodus); der Fehlerbericht verweist auf die Statusleiste", d);
    assert(d.li === 0 && !eintraege.some((n) => d.text.includes(n.slice(0, 40))),
      "10.10 kein Auszug: keine Liste und kein Eintrag des Aenderungsprotokolls im Abschnitt Entwickler", { li: d.li, text: d.text.slice(0, 300) });
    await p.click("#eDev");
    await p.waitForFunction(() => !!document.querySelector("#eBeispiel")?.getClientRects().length, null, { timeout: 3000 }).catch(() => {});
    const mit = await p.evaluate(() => ({ bsp: !!document.querySelector("#eBeispiel")?.closest("#eg-dev") && document.querySelector("#eBeispiel").getClientRects().length > 0,
      waffe: !document.querySelector("#segWeapon").hidden }));
    assert(mit.bsp && mit.waffe && s.posts.some((b) => b.devMode === true), "10.12 im Entwicklermodus: die Beispielgruppe im Abschnitt Entwickler, „Nach Waffe“ da", mit);
    await p.click("#eDev");
    await p.click("#eClog");
    await p.waitForFunction(() => document.querySelector("#clogBg").classList.contains("on"), null, { timeout: 3000 }).catch(() => {});
    const cl = await p.evaluate(() => ({ an: document.querySelector("#clogBg").classList.contains("on"), wort: document.querySelector("#eClog")?.textContent.trim() }));
    assert(cl.an && cl.wort === "\u00c4nderungsprotokoll", "10.10 der Knopf \u201e\u00c4nderungsprotokoll\u201c oeffnet den bestehenden Dialog", cl);
    await p.keyboard.press("Escape");
    assert(d.info.includes("Borometer " + VERSION10) && /Fanprojekt/.test(d.info) && /Amazon Games/.test(d.info) && /NCSOFT/.test(d.info) && /nicht unter die GPL/.test(d.info) &&
      /Nur gelesen \u2013 nichts im Spiel/.test(d.info), "10.11 Info: Version, Fanprojekt, keine Verbindung zu Amazon Games oder NCSOFT, Symbole nicht unter der GPL, „Nur gelesen \u2013 nichts im Spiel“", d.info);
    /* folgt Spezifikation Update-Hinweis 2.4 (Entscheidung 02.10.): "Netz" als fuenfter Eintrag, und in Info der Schalter
       des Update-Hinweises; folgt Spezifikation Rundgang 02.10.2026, 2: dazu "Rundgang zeigen" - gleich streng:
       Liste und Bedienelemente genau, keines in der Sicherheit */
    assert(JSON.stringify(d.sicher) === '["Liest","Schreibt","Lokaler Server","Netz","Spiel"]' && JSON.stringify(d.infoBedien) === '["eUpdatePruefen","eRundgang"]'
      && d.sicherBedien === 0,
      "10.12 Sicherheit steht in Info, ohne Bedienelemente; in Info nur der Schalter des Update-Hinweises und „Rundgang zeigen“", d);
    assert(!s.fehler.length, "10.10/10.11: keine Fehler", s.fehler);
    await p.close();
  }

  // --- 10.12 im Browser-Tab am Helfer: Overlay sagt einen Satz statt toter Bedienelemente; die Gruppe geht dort
  //     (SERVED), also steht der Gruppen-Server da - ohne Helfer (file://) der Satz, siehe test-einst-page Nr. 8
  {
    const s = await oeffne({ lang: "de" });
    const p = s.page;
    await zuEinst(p);
    const b = await p.evaluate(() => {
      const sicht = (e) => !!e && e.getClientRects().length > 0;
      const teil = (id) => { const g = document.querySelector(id);
        return { bedien: g ? [...g.querySelectorAll("input,button,[role=switch],kbd")].filter(sicht).length : -1,
          satz: g ? [...g.querySelectorAll("p")].filter(sicht).map((x) => x.textContent.trim()).join(" ") : "" }; };
      return { overlay: teil("#eg-overlay"), gruppe: teil("#eg-gruppe") };
    });
    assert(b.overlay.bedien === 0 && /betrifft das Fenster der App/.test(b.overlay.satz) && b.gruppe.bedien === 3 && !/nur in der Borometer-App/.test(b.gruppe.satz),
      "10.12 Browser-Tab: Overlay ein Satz ohne Bedienelemente; Gruppe und Server mit Feld, Speichern und Pruefen", b);
    assert(!s.fehler.length, "10.12 Browser: keine Fehler", s.fehler);
    await p.close();
  }

  // --- kein neuer Speicherschluessel (Spezifikation 3): dieselben Schluessel in der Seite, keiner fuer die Einstellungen im Browser
  {
    const quelle = readFileSync(join(root, "src", "renderer", "app", "57-einstellungen.ts"), "utf8");
    const alle = readdirSync(join(root, "src", "renderer", "app")).filter((f) => f.endsWith(".ts"))
      .map((f) => readFileSync(join(root, "src", "renderer", "app", f), "utf8")).join("\n");
    const schluessel = [...new Set([...alle.matchAll(/persistPref\("([A-Za-z]+)"/g)].map((m) => m[1]))].sort();
    const lokal = [...alle.matchAll(/localStorage\.setItem\(/g)].length;
    /* folgt Spezifikation Update-Hinweis 2.4 (Entscheidung 02.10.): updatePruefen kommt dazu, und die Einstellungen schreiben
       genau ihn, an genau einer Stelle; folgt Spezifikation Rundgang 02.10.2026, 6: rundgangGesehen kommt dazu (aus 63,
       nicht aus den Einstellungen) - gleich streng: Liste genau, sonst nichts */
    const eigene = [...quelle.matchAll(/persistPref\(([^)]*)\)/g)].map((m) => m[1]);
    assert(JSON.stringify(schluessel) === JSON.stringify(["compactAlpha", "devMode", "ghost", "logIndex", "mergePhases", "minDur", "randlosGesehen", "rundgangGesehen", "skillNames",
      "splitAfter", "theme", "themeResolved", "uiZoom", "updatePruefen", "ventiusTop"]) && lokal === 2 && !/localStorage\./.test(quelle)
      && JSON.stringify(eigene) === JSON.stringify(['"updatePruefen", updateAn']),
      "kein neuer Speicherschluessel ausser updatePruefen und rundgangGesehen: dieselben 13, der Update-Hinweis und der Rundgang in /api/config, zwei in localStorage, die Einstellungen schreiben nur updatePruefen",
      { schluessel, lokal, eigene });
  }

  // --- Groessen: 1280 x 860, 1920 x 1080, 2000 x 1480, dazu 1000, 760, 560
  for (const [breite, hoehe] of [[1280, 860], [1920, 1080], [2000, 1480], [1000, 860], [760, 860], [560, 860]]) {
    const s = await oeffne({ app: breite >= 760, lang: "de", breite, hoehe });
    const p = s.page;
    await beispiel(p);
    await zuEinst(p);
    const e = await einstBlick(p);
    const wo = `${breite} × ${hoehe}`;
    assert(e.abschnitte.length === 8 && !e.quer && !e.klein.length && !s.fehler.length, `10 ${wo}: acht Abschnitte, kein waagerechtes Rollen, Text mindestens 11 Punkt, keine Fehler`, { n: e.abschnitte.length, klein: e.klein, fehler: s.fehler });
    const breit = Math.max(...e.abschnitte.map((x) => x.r?.width || 0));
    assert(e.abschnitte.length === 8 && breit <= 820 && e.abschnitte.every((x) => x.sicht), `10 ${wo}: alle Abschnitte da, hoechstens 820 Punkt breit`, breit);
    if (breite >= 1000) assert(e.nav.length === 8 && e.navR && e.navR.right <= e.abschnitte[0].r.left, `10 ${wo}: die Sprungleiste links`, e.navR);
    else assert(e.nav.length === 8 && e.navR && e.navR.bottom <= e.abschnitte[0].r.top + 0.5, `10 ${wo}: die Sprungleiste als Zeile ueber der Seite`, e.navR);
    await p.close();
  }

  // ===== Abschnitt 11: Overlay im Kompakt (Luecken 11.2 bis 11.7) =====
  /* Das Fenster so gross, wie es die Seite verlangt: applyWindowSize() misst zweimal (der zweite Wurf nach
     260 ms). Gewartet wird, bis kein neuer Wunsch mehr kommt, dann steht der Viewport auf dem letzten. */
  const fensterWie = async (s) => {
    let n = -1;
    for (const ende = Date.now() + 6000; Date.now() < ende;) {
      const jetzt = s.win.filter((b) => b.do === "resize").length;
      if (jetzt === n && jetzt > 0) break;
      n = jetzt;
      await s.page.waitForTimeout(450);
    }
    const w = s.win.filter((b) => b.do === "resize").at(-1);
    if (w) await s.page.setViewportSize({ width: w.w, height: w.h });
    await s.page.waitForFunction(() => document.body.classList.contains("compact") && !!document.querySelector("#bars .row"));
    /* die Seite hat die neue Groesse gesehen: resize kam an (die Liste schneidet dort auf ganze Zeilen,
       markiereRest in 16), und zwei Bilder sind gezeichnet */
    if (w) await s.page.waitForFunction(([bw, bh]) => innerWidth === bw && innerHeight === bh, [w.w, w.h]);
    await s.page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    return w;
  };
  const insKompakt = async (s) => {
    await s.page.evaluate(() => document.querySelector("#btnCompact").click());
    await s.page.waitForFunction(() => document.body.classList.contains("compact"));
    return fensterWie(s);
  };
  // die Zeilen des Streifens, ganz im Bild der Liste
  const streifen = (p) => p.evaluate((bilder) => {
    const r = (e) => e && e.getClientRects().length ? e.getBoundingClientRect().toJSON() : null;
    const sicht = (e) => !!e && e.getClientRects().length > 0 && getComputedStyle(e).visibility === "visible";
    const liste = document.querySelector("#bars").getBoundingClientRect();
    const zeilen = [...document.querySelectorAll("#bars .row:not(.sub)")];
    const ganz = zeilen.filter((z) => { const b = z.getBoundingClientRect(); return b.top >= liste.top - 0.5 && b.bottom <= Math.min(liste.bottom, innerHeight) + 0.5 && b.height > 0; });
    const kopf = document.querySelector("#bars .bhead"), kb = kopf && kopf.getBoundingClientRect();
    // angeschnitten: eine Zeile, die zum Teil im Bild steht (Pruefung M5)
    const unten = Math.min(liste.bottom, innerHeight);
    const halb = zeilen.filter((z) => { const b = z.getBoundingClientRect(); return b.height > 0 && b.top < unten - 0.5 && b.bottom > unten + 0.5; }).length;
    return { zahl: zeilen.length, ganz: ganz.length, halb, liste: liste.toJSON(),
      kopfSicht: !!kb && kb.width > 2 && kb.height > 2, spaltenKoepfe: kopf ? kopf.querySelectorAll('[role="columnheader"]').length : 0,
      zeilen: ganz.slice(0, 5).map((z) => {
        const q = (s) => z.querySelector(s);
        return { h: z.getBoundingClientRect().height, rang: sicht(q(".rank")), pfeil: sicht(q(".twist")), bild: r(q(bilder ? "img.sic" : ".sic.leer")), name: r(q(".nmt")),
          schaden: r(q('[data-k="damage"]')), fill: r(q(".fill")), aus: q(".fill")?.classList.contains("aus"),
          andere: ["dps", "share", "hits", "max", "critRate", "heavyRate"].filter((k) => sicht(q(`[data-k="${k}"]`))) };
      }) };
  }, BILDER);
  const kopfMass = (p) => p.evaluate(() => {
    const r = (q) => { const e = document.querySelector(q); return e && e.getClientRects().length ? e.getBoundingClientRect().toJSON() : null; };
    const sichtbar = [...document.querySelectorAll("#hMeta .f")].filter((f) => f.getClientRects().length && getComputedStyle(f).visibility === "visible")
      .sort((a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left);
    // der Text, wie er dasteht: mit dem Trenner, den das Stylesheet davor setzt
    const vor = (f) => { const c = getComputedStyle(f, "::before").content; return c && c !== "none" && c !== "normal" ? JSON.parse(c) : ""; };
    return { bild: r("#hName .hbild"), name: r("#hName .hnt"), meta: r("#hMeta"), dps: r("#hDps"), dpsFs: getComputedStyle(document.querySelector("#hDps")).fontSize,
      einheit: r("#hDpsKurz"), einheitText: document.querySelector("#hDpsKurz")?.textContent, fakten: sichtbar.map((f) => f.dataset.f),
      metaText: sichtbar.map((f, i) => (i ? vor(f) : "") + f.textContent).join("").replace(/\s+/g, " ").trim(), lese: r("#hCompact") };
  });
  const deckung = (p, q) => p.evaluate((q) => [...document.querySelectorAll(q)].map((e) => {
    let o = 1; for (let x = e; x; x = x.parentElement) o *= parseFloat(getComputedStyle(x).opacity); return Math.round(o * 100) / 100; }), q);
  /* Die Leiste nach DECISION 11.4 (Entscheidung vom 29.09. (an Claude uebertragen)): Vollansicht,
   Anheften, Durchklick und das ⋯-Feld; Minimieren und Schliessen stehen im eigenen Fenster daneben */
const BEDIENUNG = "#btnCompact, #btnPin, #btnDurch, #btnMore";

  // --- 11.2: randloser Streifen mit Top 5, der Balken als Spur unter dem Namen, Kopf wie im Entwurf
  for (const lang of ["de", "en"]) {
    const s = await oeffne({ app: true, lang, config: { randlosGesehen: true } });
    const p = s.page;
    await beispiel(p);
    const w = await insKompakt(s);
    const z = await streifen(p);
    // folgt Entwurf E:1017ff. (300 Punkt breit); die Leiste liegt ueber der oberen Zeile und verlangt keine Breite (Pruefung W1)
    assert(w && w.w >= 300 && w.w <= 320, `11.2 ${lang}: das Fenster ist ein schmaler Streifen (300 bis 320 Punkt)`, w);
    assert(z.zahl >= 12 && z.ganz === 5 && z.halb === 0, `11.2 ${lang}: Top 5 - genau fuenf ganze Zeilen im Streifen, keine angeschnittene sechste`, { zahl: z.zahl, ganz: z.ganz, halb: z.halb });
    assert(!z.kopfSicht && z.spaltenKoepfe >= 2, `11.2 ${lang}: kein sichtbarer Spaltenkopf, fuer den Vorleser bleiben die Spaltenkoepfe`, z);
    const zeilenGut = z.zeilen.every((x) => !x.rang && !x.pfeil && !x.andere.length && x.bild && Math.abs(x.bild.width - 16) < 0.6 && x.name && x.schaden &&
      x.h <= 32 && x.fill && Math.abs(x.fill.height - 3) < 0.6 && x.fill.top >= x.name.bottom - 1 && Math.abs(x.fill.left - x.name.left) <= 2 &&
      x.fill.right <= x.schaden.right + 1 && Math.abs((x.name.top + x.name.bottom) / 2 - (x.schaden.top + x.schaden.bottom) / 2) <= 4);
    assert(zeilenGut && z.zeilen[0].aus && Math.abs(z.zeilen[0].fill.right - z.zeilen[0].schaden.right) <= 1,
      `11.2 ${lang}: je Zeile Symbol, Name und Schaden, darunter die 3-Punkt-Spur ab dem Namen; Rang 1 laeuft bis an den Rand aus` + (BILDER ? "" : " (ohne Spielbilder: Platte statt Bild)"), z.zeilen);
    const k = await kopfMass(p);
    assert(k.bild && Math.abs(k.bild.width - 20) < 0.6 && k.name && k.bild.right <= k.name.left && k.meta && k.meta.top >= k.name.bottom - 1 &&
      Math.abs(k.meta.left - k.name.left) <= 1 && k.dps && k.dps.left >= k.name.right && Math.abs(parseFloat(k.dpsFs) - 24) < 0.6 &&
      k.einheit && k.einheitText === "DPS" && k.einheit.left >= k.dps.right - 1,
      `11.2 ${lang}: Kopf mit Bossbild, Boss und darunter Uhrzeit \u00b7 Dauer, rechts DPS in 24 Punkt`, k);
    // Uhrzeit vor der Dauer wie in der Faktenzeile (der Entwurf stellt die Dauer vorn, E:1024)
    assert(JSON.stringify(k.fakten) === JSON.stringify(["zeit", "dauer"]) && /^\d{1,2}:\d{2} \u00b7 \S+/.test(k.metaText),
      `11.2 ${lang}: unter dem Boss nur Uhrzeit \u00b7 Dauer`, { fakten: k.fakten, text: k.metaText });
    /* Der Kompakt rollt nie (html und body schneiden ab): gefragt wird, ob etwas ueber den rechten Rand ragt */
    const drueber = await p.evaluate(() => [...document.querySelectorAll(".top > *, .headwrap, .headwrap *, #bars, #bars .row:not(.sub) > *")]
      .filter((e) => e.getClientRects().length && getComputedStyle(e).position !== "absolute" && e.getBoundingClientRect().right > innerWidth + 0.5)
      .map((e) => e.id || e.className || e.tagName));
    assert(!(await quer(p)) && !drueber.length && !s.fehler.length, `11.2 ${lang}: nichts ragt ueber den Rand, kein waagerechtes Rollen, keine Fehler`, { drueber, fehler: s.fehler });
    await p.close();
  }
  /* 11.2 buendig ohne Symbol (Entscheidung 03.10.): ein Skill, den die App nicht kennt, traegt auch mit
     Spielbildern die Platte .sic.leer; im Kompakt steht sie wie das Bild ohne Rand, die Spur beginnt am Namen */
  {
    const OHNE = join(work, "TLCombatLog-ohnesymbol.txt");
    const zeilen = ["CombatLogVersion,4"];
    for (let k = 0; k < 80; k++) {
      const [skill, sid] = k % 2 ? ["Testschlag Ohne Symbol", 111111111] : ["Quick Fire", 964762401];
      zeilen.push(`${stamp(at(19, 0, 0) + k * 500)},DamageDone,${skill},${sid},${k % 2 ? 9000 : 3000},0,0,kNormalHit,Tester,Stone Beetle`);
    }
    writeFileSync(OHNE, zeilen.join("\n") + "\n");
    const s = await oeffne({ app: true, lang: "de", config: { randlosGesehen: true } });
    const p = s.page;
    await mitLog(s, OHNE);
    await insKompakt(s);
    const z = await p.evaluate(() => [...document.querySelectorAll("#bars .row:not(.sub)")].filter((x) => x.getClientRects().length).map((x) => {
      const r = (q) => { const e = x.querySelector(q); return e && e.getClientRects().length ? e.getBoundingClientRect().toJSON() : null; };
      return { skill: x.dataset.skill || x.querySelector(".nmt")?.textContent, leer: !!x.querySelector(".nm .sic.leer"), platte: r(".nm .sic"), name: r(".nmt"), fill: r(".fill") };
    }));
    const ohneSym = z.find((x) => /Testschlag/.test(x.skill || ""));
    assert(!!ohneSym && ohneSym.leer && ohneSym.platte && Math.abs(ohneSym.platte.width - 16) < 0.6 && ohneSym.name && ohneSym.fill
      && Math.abs(ohneSym.fill.left - ohneSym.name.left) <= 2 && ohneSym.platte.right <= ohneSym.name.left
      && z.every((x) => !x.name || !x.fill || Math.abs(x.fill.left - x.name.left) <= 2),
      "11.2 buendig ohne Symbol: die Platte eines Skills ohne Symbol steht im Kompakt wie das Bild, die Spur beginnt am Namen", z);
    assert(!s.fehler.length, "11.2 buendig ohne Symbol: keine Fehler", s.fehler);
    await p.close();
  }

  // --- 11.3: Ich / Gruppe nur bei laufender Gruppe
  {
    const s = await oeffne({ app: true, lang: "de", config: { randlosGesehen: true } });
    await beispiel(s.page);
    await insKompakt(s);
    const ohne = await s.page.evaluate(() => ({ umschalter: !!document.querySelector("#partySwitch").getClientRects().length,
      pille: !!document.querySelector("#partyPill").getClientRects().length }));
    assert(!ohne.umschalter && !ohne.pille, "11.3 ohne Gruppe: kein Umschalter Ich/Gruppe und keine Gruppen-Pille im Streifen", ohne);
    await s.page.close();
    const arten = [["normal", 40000, 10], ["crit", 60000, 8], ["heavy", 30000, 4], ["critheavy", 90000, 6]];
    const mitglied = (name, dps) => ({ name, waiting: false, damage: dps * 60, dps, hits: 28, crit: 14, heavy: 10, seconds: 60, max: 16000,
      skills: [{ name: "Quick Fire", sid: "964762401", damage: dps * 60, dps, hits: 28, crit: 14, heavy: 10, max: 16000,
        cats: arten.map(([k, d, h]) => ({ k, d, h, m: d / h })) }],
      hasCurve: false, share: 1, onTarget: true, target: "Vulcanus", lang: "en", weapons: ["Crossbow", "Longbow"], ventius: false, age: 0 });
    const g = await oeffne({ app: true, lang: "de", config: { randlosGesehen: true },
      gruppe: { role: "host", code: "QX7K", board: [mitglied("Mitglied Eins", 5000), mitglied("Mitglied Zwei", 3000)], target: "Vulcanus", error: "" } });
    const p = g.page;
    await mitLog(g);
    await p.waitForFunction(() => !!document.querySelector("#segParty")?.getClientRects().length, null, { timeout: 8000 }).catch(() => {});
    await insKompakt(g);
    const u = await p.evaluate(() => {
      const knoepfe = [...document.querySelectorAll("#partySwitch button")].filter((b) => b.getClientRects().length);
      return { sicht: !!document.querySelector("#partySwitch").getClientRects().length, texte: knoepfe.map((b) => b.textContent.trim()),
        name: document.querySelector("#partySwitch").getAttribute("aria-label"), gedrueckt: knoepfe.map((b) => b.getAttribute("aria-pressed")),
        links: document.querySelector("#partySwitch").getBoundingClientRect().left };
    });
    const ruhe = await deckung(p, "#partySwitch");
    assert(u.sicht && JSON.stringify(u.texte) === JSON.stringify(["Ich", "Gruppe"]) && u.name === "Wessen Zahlen" &&
      JSON.stringify(u.gedrueckt) === JSON.stringify(["true", "false"]) && u.links < 20 && ruhe[0] === 1,
      "11.3 laufende Gruppe: oben links Ich | Gruppe, auch ohne Maus voll zu sehen", { u, ruhe });
    await p.evaluate(() => document.querySelector("#pvParty").click());
    await p.waitForFunction(() => document.querySelector("#pvParty").getAttribute("aria-pressed") === "true");
    const gw = await fensterWie(g);
    // dieselbe Grenze wie ohne Gruppe (Pruefung M2), und die Leiste liegt beim Zeigen nicht auf Ich | Gruppe
    await p.mouse.move(gw.w / 2, gw.h / 2);
    await p.waitForFunction(() => getComputedStyle(document.querySelector("#btnCompact")).opacity === "1", null, { timeout: 3000 }).catch(() => {});
    const lage = await p.evaluate(() => {
      const sw = document.querySelector("#partySwitch").getBoundingClientRect();
      const leiste = [...document.querySelectorAll("#btnCompact, #btnPin, #btnDurch, #btnMore, .top .wbtns")].filter((e) => e.getClientRects().length)
        .map((e) => e.getBoundingClientRect());
      return { links: Math.min(...leiste.map((r) => r.left)), rechtsSw: sw.right, rechts: Math.max(...leiste.map((r) => r.right)) };
    });
    assert(gw && gw.w <= 320 && lage.links >= lage.rechtsSw + 2 && lage.rechts <= gw.w + 0.5,
      "11.3 mit Gruppe hoechstens 320 Punkt, die Leiste liegt rechts neben Ich | Gruppe und im Fenster", { gw, lage });
    const m = await p.evaluate(() => [...document.querySelectorAll("#bars .row:not(.sub)")].map((z) => z.querySelector(".nmt")?.textContent.trim()));
    assert(m.includes("Mitglied Eins") && m.includes("Mitglied Zwei"), "11.3 Gruppe: die Mitglieder als Zeilen", m);
    assert(!g.fehler.length, "11.3 keine Fehler", g.fehler);
    await p.close();
  }

  // --- 11.4: die Bedienleiste nur mit der Maus ueber dem Streifen (oder mit dem Fokus darin)
  {
    const s = await oeffne({ app: true, lang: "de", config: { randlosGesehen: true } });
    const p = s.page;
    await beispiel(p);
    const w = await insKompakt(s);
    // die Deckkraft, die gilt: die eigene mal die der Vorfahren (⋯ steht in .moremenu)
    const opak = (soll) => p.waitForFunction(([q, soll]) => [...document.querySelectorAll(q)].filter((e) => e.getClientRects().length)
      .every((e) => { let o = 1; for (let x = e; x; x = x.parentElement) o *= parseFloat(getComputedStyle(x).opacity); return o === soll; }),
      [BEDIENUNG, soll], { timeout: 3000 }).then(() => true).catch(() => false);
    /* in Ruhe heisst: die Maus steht nicht ueber dem Fenster und der Fokus nicht darin (Aufgabe 13 - in der CI
       stand die Maus schon ueber dem Streifen). Und die Leiste ist in Ruhe unsichtbar, nicht nur im ersten Bild:
       kein Uebergang laeuft mehr, der sie noch einblenden koennte (sonst gaelte auch ein Einblenden als Ruhe). */
    await p.mouse.move(-20, -20);
    await p.evaluate(() => document.activeElement?.blur());
    const ruhig = await p.waitForFunction((q) => !document.body.matches(":hover") && !document.querySelector(".top").matches(":focus-within") &&
      [...document.querySelectorAll(q)].filter((e) => e.getClientRects().length).every((e) => {
        let o = 1; for (let x = e; x; x = x.parentElement) { o *= parseFloat(getComputedStyle(x).opacity); if (x.getAnimations().length) return false; }
        return o === 0; }), BEDIENUNG, { timeout: 3000 }).then(() => true).catch(() => false);
    const anzahl = await p.evaluate((q) => [...document.querySelectorAll(q)].filter((e) => e.getClientRects().length).length, BEDIENUNG);
    await p.mouse.move(w.w / 2, w.h / 2);
    const maus = await opak(1);
    await p.mouse.move(-20, -20);
    const weg = await opak(0);
    await p.focus("#btnCompact");
    const fokus = await opak(1);
    assert(anzahl === 4 && ruhig && maus && weg && fokus,
      "11.4 Vollansicht, Anheften, Durchklick und ⋯: unsichtbar in Ruhe, da mit der Maus ueber dem Streifen und mit dem Fokus darin", { anzahl, ruhig, maus, weg, fokus });
    // Live steht in der Vollansicht, der Geist im ⋯-Feld; die Leiste liegt ueber der oberen Zeile und im Fenster
    const ort = await p.evaluate(() => {
      const top = document.querySelector(".top").getBoundingClientRect();
      // ⋯ steht in seinem .moremenu, das liegt
      const leiste = [...document.querySelectorAll("#btnCompact, #btnPin, #btnDurch, #btnMore, .top .wbtns")].filter((e) => e.getClientRects().length)
        .map((e) => e.closest(".moremenu") || e);
      const r = leiste.map((e) => e.getBoundingClientRect());
      const ueber = r.some((a, i) => r.some((b, j) => i < j && a.left < b.right - 0.5 && b.left < a.right - 0.5));
      return { live: !!document.querySelector("#btnWatch").getClientRects().length, geistImMenue: !!document.querySelector("#morePanel #btnGhost"),
        max: !!document.querySelector("#winMax")?.getClientRects().length, absolut: leiste.every((e) => getComputedStyle(e).position === "absolute"),
        inZeile: r.every((x) => x.top >= top.top - 0.5 && x.bottom <= top.bottom + 0.5), imFenster: r.every((x) => x.left >= 0 && x.right <= innerWidth + 0.5), ueber };
    });
    assert(!ort.live && ort.geistImMenue && !ort.max && ort.absolut && ort.inZeile && ort.imFenster && !ort.ueber,
      "11.4 ohne Live und Maximieren, der Geist im ⋯-Feld; die Leiste liegt in der oberen Zeile, im Fenster, ohne Ueberdeckung", ort);
    // der Knopf Durchklick tut, was das Kuerzel tut: oben halten und die Maus ins Spiel lassen
    await p.evaluate(() => document.querySelector("#btnDurch").click());
    await p.waitForFunction(() => document.body.classList.contains("through"), null, { timeout: 3000 }).catch(() => {});
    const durch = await p.evaluate(() => ({ through: document.body.classList.contains("through"), gedrueckt: document.querySelector("#btnDurch").getAttribute("aria-pressed"),
      titel: document.querySelector("#btnDurch").title }));
    assert(durch.through && durch.gedrueckt === "true" && s.win.some((b) => b.do === "clickthrough" && b.on === true) && s.win.some((b) => b.do === "pin" && b.on === true) &&
      /Strg\+Umschalt\+D/.test(durch.titel), "11.4 Durchklick: der Knopf schaltet wie Strg+Umschalt+D, oben und durchklickbar", { durch, win: s.win.filter((b) => b.do !== "resize") });
    const namen = await p.evaluate((q) => [...document.querySelectorAll(q)].map((e) => e.getAttribute("aria-label") || e.textContent.trim()), BEDIENUNG);
    assert(namen.every(Boolean), "11.4 jede Taste der Leiste hat einen Namen", namen);
    await p.close();
  }

  // --- 11.5: Zustaende als Pillen - 55 % Durchsicht (Auge) und durchklickbar (Schloss)
  {
    const s = await oeffne({ app: true, lang: "de", config: { randlosGesehen: true, compactAlpha: 0.45 } });
    const p = s.page;
    await beispiel(p);
    const voll = await p.evaluate(() => !!document.querySelector("#seePille")?.getClientRects().length);
    await insKompakt(s);
    const pille = await p.evaluate(() => { const e = document.querySelector("#seePille");
      return e && { sicht: !!e.getClientRects().length, text: e.textContent.trim(), name: e.getAttribute("aria-label") || e.title, auge: !!e.querySelector("svg") }; });
    assert(!voll && pille && pille.sicht && pille.text === "55\u00a0%" && pille.auge && /Durchsicht/.test(pille.name),
      "11.5 55 % Durchsicht: im Streifen eine Pille mit Auge und „55 %“, in der Vollansicht nicht", { voll, pille });
    await p.close();
    const n = await oeffne({ app: true, lang: "de", config: { randlosGesehen: true } });
    await beispiel(n.page);
    await insKompakt(n);
    assert(!(await n.page.evaluate(() => !!document.querySelector("#seePille")?.getClientRects().length)), "11.5 ohne Durchsicht keine Pille");
    await n.page.close();
    // ohne Kampf steht die Leiste immer: die Pille liegt dann auf keinem sichtbaren Knopf (Pruefung W4)
    const leer = await oeffne({ app: true, lang: "de", config: { randlosGesehen: true, compactAlpha: 0.45 } });
    await leer.page.evaluate(() => document.querySelector("#btnCompact").click());
    await leer.page.waitForFunction(() => document.body.classList.contains("compact") && document.body.classList.contains("noFight"));
    const lw = leer.win.filter((b) => b.do === "resize").at(-1);
    if (lw) await leer.page.setViewportSize({ width: lw.w, height: Math.max(lw.h, 28) });
    const deckt = await leer.page.evaluate(() => {
      const p = document.querySelector("#seePille"), pr = p.getClientRects().length ? p.getBoundingClientRect() : null;
      return { pille: !!pr, unter: pr ? [...document.querySelectorAll(".top button, .top .wbtns")].filter((b) => b.getClientRects().length).filter((b) => {
        const r = b.getBoundingClientRect(); return r.left < pr.right && pr.left < r.right && r.top < pr.bottom && pr.top < r.bottom; }).map((b) => b.id || b.className) : [] };
    });
    assert(!deckt.unter.length, "11.5 ohne Kampf bei 55 %: die Pille liegt auf keinem Knopf", deckt);
    await leer.page.close();
    // Strg+Umschalt+D aus der Vollansicht: kompakt, oben, durchklickbar - die Pille mit dem Schloss
    const d = await oeffne({ app: true, lang: "de", config: { randlosGesehen: true }, kuerzel: true });
    await beispiel(d.page);
    await d.page.waitForFunction(() => document.body.classList.contains("through"), null, { timeout: 8000 }).catch(() => {});
    const h = await d.page.evaluate(() => { const e = document.querySelector("#throughHint");
      return { through: document.body.classList.contains("through"), kompakt: document.body.classList.contains("compact"),
        sicht: !!e.getClientRects().length, text: e.textContent.trim(), titel: e.title, schloss: !!e.querySelector("svg"),
        kante: getComputedStyle(document.querySelector(".top")).boxShadow }; });
    // das Kuerzel steht sichtbar in der Pille: im Durchklick erreicht die Maus keinen title (Pruefung M3)
    assert(h.through && h.kompakt && h.sicht && h.text === "durchklickbar \u00b7 Strg+Umschalt+D" && h.schloss && h.kante === "none",
      "11.5 durchklickbar: eine Pille mit Schloss und dem Kuerzel, keine Amberkante mehr", h);
    await d.page.close();
  }

  // --- 11.6: ganze Tafel beim Vergroessern; die Lesezeile bleibt eine Zeile
  {
    const s = await oeffne({ app: true, lang: "de", config: { randlosGesehen: true } });
    const p = s.page;
    await beispiel(p);
    const w = await insKompakt(s);
    const lese = await kopfMass(p);
    await p.setViewportSize({ width: w.w, height: 720 });
    await p.waitForFunction(() => document.querySelector("#bars").getBoundingClientRect().height > 400, null, { timeout: 3000 }).catch(() => {});
    const z = await streifen(p);
    assert(z.ganz === z.zahl && z.zahl >= 12, "11.6 vergroessert: die ganze Tafel steht da", { ganz: z.ganz, zahl: z.zahl });
    assert(lese.lese && lese.lese.height <= 20, "11.6 die Lesezeile (#39) bleibt eine Zeile", lese.lese);
    await p.close();
  }

  // --- 11.2 (Pruefung W2): Top 5 nach Schaden, auch wenn die Vollansicht nach etwas anderem sortiert; die Wahl bleibt ihr
  {
    const s = await oeffne({ app: true, lang: "de", config: { randlosGesehen: true } });
    const p = s.page;
    await beispiel(p);
    await p.evaluate(() => document.querySelector('#bars .bhead [data-k="hits"]').click());
    await p.waitForFunction(() => document.querySelector("#bars .bhead .sorted")?.dataset.k === "hits");
    await insKompakt(s);
    const zahl = (t) => parseFloat(t) * ({ k: 1e3, M: 1e6, B: 1e9 }[t.trim().slice(-1)] || 1);
    const top = await p.evaluate(() => [...document.querySelectorAll("#bars .row:not(.sub)")].slice(0, 5).map((z) => ({
      t: z.querySelector('[data-k="damage"]').textContent.trim(), w: z.querySelector(".fill").getBoundingClientRect().width })));
    const d = top.map((x) => zahl(x.t));
    const fallend = d.every((v, i) => i === 0 || v <= d[i - 1]);
    const anteil = top.every((x, i) => Math.abs(x.w / top[0].w - d[i] / d[0]) < 0.02);
    await p.evaluate(() => document.querySelector("#btnCompact").click());
    await p.waitForFunction(() => !document.body.classList.contains("compact"));
    const zurueck = await p.evaluate(() => document.querySelector("#bars .bhead .sorted")?.dataset.k);
    assert(d.every((v) => v > 0) && fallend && anteil && zurueck === "hits",
      "11.2 nach Treffern sortiert: der Streifen zeigt Top 5 nach Schaden, die Spur folgt dem Schaden; die Vollansicht behaelt ihre Sortierung", { top, d, zurueck });
    await p.close();
  }

  // --- 11.7: bei 55 % Durchsicht lesbar, Zahlen deckend (Acrylic: die Toenung ist durchsichtig, nicht die Schrift)
  {
    /* der Grund unter dem Streifen: die graue Szene des Entwurfs (r11-overlay-55.png, neben dem Streifen gemessen)
       und eine helle Szene (Schnee, 235 Grau) - Text verlangt 4,5 : 1, die grosse Zahl (24 Punkt) 3 : 1 */
    const SZENEN = { grau: [132, 139, 144], hell: [235, 235, 235] };
    for (const theme of ["dark", "light", "tnl"]) {
      const s = await oeffne({ app: true, lang: "de", config: { randlosGesehen: true, compactAlpha: 0.45, theme } });
      const p = s.page;
      await beispiel(p);
      await p.evaluate(() => document.documentElement.classList.add("acrylic"));
      await insKompakt(s);
      for (const [wo, szene_] of Object.entries(SZENEN)) {
      const m = await p.evaluate(([szene]) => {
        const parse = (c) => { const x = c.match(/rgba?\(([^)]+)\)/); if (!x) return null; const v = x[1].split(/[ ,\/]+/).filter(Boolean).map(Number); return [v[0], v[1], v[2], v.length > 3 ? v[3] : 1]; };
        const ueber = (a, b) => [0, 1, 2].map((i) => a[i] * a[3] + b[i] * (1 - a[3])).concat(1);
        const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
        const k = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
        // display:contents malt keinen Grund (.table im Kompakt)
        const grund = (el) => { const kette = []; for (let e = el; e; e = e.parentElement) { if (getComputedStyle(e).display === "contents") continue;
          const c = parse(getComputedStyle(e).backgroundColor); if (c && c[3] > 0) kette.push(c); }
          let c = szene.concat(1); for (let i = kette.length - 1; i >= 0; i--) c = ueber(kette[i], c); return c; };
        // gemessen wird das Element, das den Text traegt (nicht sein Kasten)
        const was = { boss: "#hName .hnt", zeit: '#hMeta [data-f="zeit"] .wt', dauer: '#hMeta [data-f="dauer"]', dps: "#hDps", einheit: "#hDpsKurz", lese: "#hCompact > span",
          name: "#bars .row:not(.sub) .nmt", zahl: '#bars .row:not(.sub) [data-k="damage"]' };
        const out = {};
        for (const [n, q] of Object.entries(was)) {
          const e = document.querySelector(q); if (!e || !e.getClientRects().length) { out[n] = null; continue; }
          let o = 1; for (let x = e; x; x = x.parentElement) o *= parseFloat(getComputedStyle(x).opacity);
          const g = grund(e), f = parse(getComputedStyle(e).color);
          out[n] = { k: Math.round(k(ueber([f[0], f[1], f[2], f[3] * o], g), g) * 100) / 100, deckend: o === 1 && f[3] === 1, fs: parseFloat(getComputedStyle(e).fontSize) };
        }
        out.glas = getComputedStyle(document.documentElement).getPropertyValue("--glass-a").trim();
        return out;
      }, [szene_]);
      const teile = ["boss", "zeit", "dauer", "dps", "einheit", "lese", "name", "zahl"];
      const gut = teile.every((n) => m[n] && m[n].deckend && m[n].k >= (m[n].fs >= 24 ? 3 : 4.5));
      // Toenung am Anschlag .65 (Entscheidung vom 29.09. (an Claude uebertragen)), vorher .5
      assert(m.glas === "0.650" && gut, `11.7 ${theme}, ${wo}e Szene: bei 55 % Durchsicht (Toenung 0,65) alles deckend, Text mindestens 4,5 : 1, die Zahl 3 : 1`, m);
      }
      await p.close();
    }
  }

  // ===== Abschnitt 12: Querschnitt (Luecken 12) =====
  // seit Spezifikation Rekorde 2a auch die Rekorde: dieselben Proben fuer einen Bereich mehr
  const BEREICHE = ["timeline", "rotation", "analysis", "compare", "history", "party", "builds", "weeklies", "rekorde", "start", "settings"];
  const zu = async (p, b) => {
    await p.evaluate((b) => document.querySelector(`#bereiche [data-tab="${b}"]`).click(), b);
    await p.waitForFunction((b) => b === "settings" ? !document.querySelector("#einst").hidden : b === "start" ? !document.querySelector("#land").hidden
      : b === "weeklies" ? !document.querySelector("#weeklies").hidden : b === "rekorde" ? !document.querySelector("#rekorde").hidden : document.querySelector(`#bereiche [data-tab="${b}"]`).getAttribute("aria-current") === "page", b);
    // der Bereich gleitet herein (translateX): gemessen wird, wenn er steht
    await p.waitForFunction(() => document.getAnimations().every((a) => a.playState !== "running" || a.effect?.getComputedTiming().iterations === Infinity));
  };
  // --- 12.2, 12.3: in allen Bereichen kein waagerechtes Rollen, bei 560 (Browser und App), 760 und 1000
  /* Die Buehne schneidet waagerecht ab (.stage overflow-x:clip) und rollt darum nie: gefragt wird auch, ob etwas
     ueber ihren rechten Rand ragt, ohne dass ein eigener Rollbereich (overflow-x nicht visible) dazwischen steht. */
  const ragt = (p) => p.evaluate(() => {
    const st = document.querySelector("#stage").getBoundingClientRect(), aus = [];
    for (const e of document.querySelectorAll("#stage *")) {
      if (!e.getClientRects().length) continue;
      const r = e.getBoundingClientRect();
      if (r.width < 1 || r.right <= st.right + 0.5) continue;
      /* nur auto/scroll ist ein eigener Rollbereich; hidden/clip verschluckt, was darueber ragt (Pruefung M7) */
      let eigen = false;
      for (let x = e.parentElement; x && x.id !== "stage"; x = x.parentElement) {
        const o = getComputedStyle(x).overflowX;
        if (o === "auto" || o === "scroll") { eigen = true; break; }
        if ((o === "hidden" || o === "clip") && x.scrollWidth > x.clientWidth + 1 && r.right > x.getBoundingClientRect().right + 0.5) break;
      }
      if (!eigen) aus.push(e.id || (typeof e.className === "string" ? e.className : "") || e.tagName);
    }
    return aus.slice(0, 8);
  });
  for (const [breite, app] of [[560, false], [560, true], [760, true], [1000, true]]) {
    const s = await oeffne({ app, breite, lang: "de" });
    const p = s.page;
    await beispiel(p);
    const quer_ = [];
    for (const b of BEREICHE) { await zu(p, b); const x = await ragt(p); if (await quer(p) || x.length) quer_.push(b + ": " + x.join(", ")); }
    assert(!quer_.length && !s.fehler.length, `12.2 ${breite}${app ? " App" : ""}: in keinem der zehn Bereiche waagerechtes Rollen, nichts ragt ueber den Rand`, { quer_, fehler: s.fehler });
    await p.close();
  }
  // --- 12.3 (Nachpruefung Aufgabe 9): im schmalen Fenster steht die sortierte Spalte wieder da, auch wenn die Breite sie sonst ausblendet
  for (const [breite, spalten] of [[560, ["hits", "critRate", "heavyRate"]], [640, ["critRate", "heavyRate"]]]) {
    const s = await oeffne({ breite, lang: "de" });
    const p = s.page;
    await beispiel(p);
    const zu_ = [];
    for (const k of spalten) {
      await p.evaluate((k) => document.querySelector(`#bars .bhead [data-k="${k}"]`).click(), k);
      await p.waitForFunction((k) => document.querySelector("#bars .bhead .sorted")?.dataset.k === k, k);
      const z = await p.evaluate((k) => { const sicht = (e) => !!e && getComputedStyle(e).display !== "none" && e.getBoundingClientRect().width > 0;
        const zeilen = [...document.querySelectorAll("#bars .row:not(.sub)")];
        return { kopf: sicht(document.querySelector(`#bars .bhead [data-k="${k}"]`)), zellen: zeilen.filter((r) => sicht(r.querySelector(`[data-k="${k}"]`))).length, zeilen: zeilen.length }; }, k);
      if (!z.kopf || z.zellen !== z.zeilen) zu_.push({ k, ...z });
    }
    assert(!zu_.length && !(await quer(p)) && !s.fehler.length, `12.3 ${breite}: nach Treffer, Kritisch oder Stark sortiert steht die Spalte in Kopf und jeder Zeile`, zu_);
    await p.close();
  }

  // --- 0.14 (Ruling 28.09., Aufgabe 1): die Titelleiste bei 560 und 760 einzeilig wie im Entwurf
  for (const [breite, app] of [[560, false], [560, true], [760, true], [760, false]]) {
    const s = await oeffne({ app, breite, lang: "de" });
    const p = s.page;
    await beispiel(p);
    const t = await p.evaluate(() => {
      const r = (q) => { const e = document.querySelector(q); return e && e.getClientRects().length ? e.getBoundingClientRect().toJSON() : null; };
      return { hoch: r("header.top").height, pille: r("#kwKnopf"), live: r("#btnWatch"), quer: document.documentElement.scrollWidth > innerWidth,
        wo: { oeffnen: !!r("#btnOpen"), overlay: !!r("#btnCompact"), vor: !!r("#kwVor") } };
    });
    assert(Math.abs(t.hoch - 36) < 0.5 && t.pille && t.live && Math.abs(t.pille.top - t.live.top) < 8 && !t.quer,
      `0.14 ${breite}${app ? " App" : ""}: die Titelleiste in einer Zeile (36 Punkt), Kampfwahl und Live nebeneinander`, t);
    // Logs oeffnen (mit den Gruppen-Logs, die es nur dort gibt) und Overlay bleiben; nur ‹ › gehen unter 640 wie im Entwurf (Strg+Pfeil bleibt)
    assert(t.wo.oeffnen && t.wo.overlay && t.wo.vor === (breite > 640), `0.14 ${breite}${app ? " App" : ""}: Logs oeffnen und Overlay bleiben in der Leiste`, t.wo);
    await p.close();
  }
  // --- 12.4: Tab-Reihenfolge Symbolleiste -> Titelleiste -> Inhalt
  for (const lang of ["de", "en"]) {
    const s = await oeffne({ app: true, lang });
    const p = s.page;
    await beispiel(p);
    await p.evaluate(() => { document.activeElement?.blur(); });
    const folge = [];
    await p.keyboard.press("Tab");   // der Sprunglink
    const erst = await p.evaluate(() => document.activeElement.className);
    for (let i = 0; i < 16; i++) {
      await p.keyboard.press("Tab");
      folge.push(await p.evaluate(() => { const a = document.activeElement;
        return a.closest("#bereiche") ? "leiste" : a.closest("header.top") ? "titel" : a.closest("#stage") ? "inhalt" : a.closest("#statusleiste") ? "status" : "?"; }));
    }
    const erste = [...new Set(folge)];
    assert(erst === "skiplink" && JSON.stringify(erste.slice(0, 3)) === JSON.stringify(["leiste", "titel", "inhalt"]) &&
      folge.indexOf("inhalt") > folge.lastIndexOf("titel") && folge.indexOf("titel") > folge.lastIndexOf("leiste"),
      `12.4 ${lang}: Tab nach dem Sprunglink: Symbolleiste, dann Titelleiste, dann Inhalt`, folge);
    /* Im Kompakt: jeder Knoten, den Tab erreicht, ist zu sehen - mindestens 8 x 8 Punkt im Fenster und von
       keinem Vorfahren weggeschnitten (Pruefung W3: der Kopf der Tafel ist dort nur fuer den Vorleser). */
    await insKompakt(s);
    await p.evaluate(() => document.activeElement?.blur());
    const blind = [];
    for (let i = 0; i < 14; i++) {
      await p.keyboard.press("Tab");
      // der Sprunglink gleitet herein: gemessen wird, wenn er steht
      await p.waitForFunction(() => document.getAnimations().every((a) => a.playState !== "running" || a.effect?.getComputedTiming().iterations === Infinity));
      const f = await p.evaluate(() => {
        const a = document.activeElement;
        if (!a || a === document.body) return null;
        let r = a.getBoundingClientRect(), x0 = Math.max(r.left, 0), y0 = Math.max(r.top, 0), x1 = Math.min(r.right, innerWidth), y1 = Math.min(r.bottom, innerHeight);
        let clip = getComputedStyle(a).clipPath !== "none";
        for (let e = a.parentElement; e && e !== document.body; e = e.parentElement) {
          const cs = getComputedStyle(e);
          if (cs.display === "contents") continue;   // ohne eigenen Kasten schneidet nichts (.table im Kompakt)
          if (cs.clipPath !== "none") clip = true;
          if (cs.overflowX !== "visible" || cs.overflowY !== "visible") { const q = e.getBoundingClientRect();
            x0 = Math.max(x0, q.left); y0 = Math.max(y0, q.top); x1 = Math.min(x1, q.right); y1 = Math.min(y1, q.bottom); }
        }
        return { wer: a.id || a.dataset.k || a.className || a.tagName, w: Math.round(x1 - x0), h: Math.round(y1 - y0), clip };
      });
      if (f && (f.w < 8 || f.h < 8 || f.clip)) blind.push(f);
    }
    assert(!blind.length, `12.4 ${lang} Kompakt: jeder erreichbare Knoten ist zu sehen (kein unsichtbarer Tabstopp)`, blind);
    await p.close();
  }

  // --- 12.5 Vorleser und 12.6 Englisch: in jedem Bereich Regionen mit Namen, jede Taste benannt, im Englischen kein deutscher Text
  for (const lang of ["de", "en"]) {
    const s = await oeffne({ app: true, lang, config: { randlosGesehen: true } });
    const p = s.page;
    await beispiel(p);
    const regionen = await p.evaluate(() => ["#bereiche", "header.top", "#stage", "#statusleiste"].map((q) => document.querySelector(q)?.getAttribute("aria-label") || ""));
    const soll = lang === "de" ? ["Bereiche", "Titelleiste", "Inhalt", "Statusleiste"] : ["Areas", "Title bar", "Content", "Status bar"];
    assert(JSON.stringify(regionen) === JSON.stringify(soll), `12.5 ${lang}: Symbolleiste, Titelleiste, Inhalt und Statusleiste als Regionen mit Namen`, regionen);
    const ohneName = [], deutsch = [];
    for (const b of [...BEREICHE, "kompakt"]) {
      if (b === "kompakt") { await zu(p, "timeline"); await insKompakt(s); } else await zu(p, b);
      const x = await p.evaluate(() => {
        const sicht = (e) => e.getClientRects().length && getComputedStyle(e).visibility === "visible";
        const name = (e) => (e.getAttribute("aria-label") || (e.getAttribute("aria-labelledby") || "").split(" ").map((i) => document.getElementById(i)?.textContent || "").join("") ||
          e.textContent || e.title || (e.labels && e.labels[0]?.textContent) || e.getAttribute("placeholder") || "").trim();
        const tasten = [...document.querySelectorAll('button, input:not([type=hidden]), select, textarea, [role="button"], [role="switch"], [role="tab"], [role="checkbox"], [role="radio"], a[href]')]
          .filter(sicht).filter((e) => !name(e)).map((e) => e.id || e.className || e.tagName);
        // der sichtbare Text: Bereich, Titelleiste und Statusleiste; dazu Namen, title und Platzhalter (Pruefung M8)
        const text = [...document.querySelectorAll("header.top, #stage, #statusleiste, #bereiche")].map((e) => e.innerText).join("\n");
        const attr = [...document.querySelectorAll("header.top [aria-label], header.top [title], #stage [aria-label], #stage [title], #stage [placeholder], #statusleiste [title], #statusleiste [aria-label], #bereiche [aria-label]")]
          .filter(sicht).flatMap((e) => ["aria-label", "title", "placeholder"].map((a) => e.getAttribute(a)).filter(Boolean));
        return { tasten, text: text + "\n" + attr.join("\n") };
      });
      ohneName.push(...x.tasten.map((t) => b + ":" + t));
      if (lang === "en") {
        const treffer = x.text.split("\n").filter((z) => /[äöüÄÖÜß]|\b(und|oder|nicht|mit|für|der|die|das|den|dem|ein|eine|Kampf|Kaempfe|Schaden|Treffer|Gruppe|Einstellungen|Sekunde)\b/.test(z));
        deutsch.push(...treffer.map((z) => b + ": " + z.trim().slice(0, 80)));
      }
    }
    // das offene \u22ef-Feld im Kompakt und das Aufklappfeld der Kampfwahl, mit Text und Attributen
    const feldText = (q) => p.evaluate((q) => { const f = document.querySelector(q);
      return f.innerText + "\n" + [...f.querySelectorAll("[aria-label], [title], [placeholder]")].filter((e) => e.getClientRects().length)
        .flatMap((e) => ["aria-label", "title", "placeholder"].map((a) => e.getAttribute(a)).filter(Boolean)).join("\n"); }, q);
    await p.evaluate(() => document.querySelector("#btnMore").click());
    await p.waitForFunction(() => !document.querySelector("#morePanel").hidden);
    const menue = await feldText("#morePanel");
    await p.keyboard.press("Escape");
    await p.evaluate(() => document.querySelector("#btnCompact").click());
    await p.waitForFunction(() => !document.body.classList.contains("compact"));
    await p.keyboard.press("Control+K");
    await p.waitForFunction(() => !document.querySelector("#kampfwahl").hidden);
    const wahl = await feldText("#kampfwahl");
    await p.keyboard.press("Escape");
    if (lang === "en") for (const [wo, t] of [["\u22ef", menue], ["Kampfwahl", wahl]])
      deutsch.push(...t.split("\n").filter((z) => /[\u00e4\u00f6\u00fc\u00c4\u00d6\u00dc\u00df]|\b(und|oder|nicht|mit|f\u00fcr|der|die|das|den|dem|ein|eine|Kampf|Kaempfe|Schaden|Treffer|Gruppe|Einstellungen|Sekunde)\b/.test(z)).map((z) => wo + ": " + z.trim().slice(0, 80)));
    assert(!ohneName.length, `12.5 ${lang}: jede sichtbare Taste und jedes Feld in allen Bereichen und im Kompakt hat einen Namen`, ohneName);
    if (lang === "en") assert(!deutsch.length, "12.6 en: kein deutscher Text in den Bereichen, im Kompakt, im \u22ef-Feld und in der Kampfwahl, auch nicht in Namen, title und Platzhaltern", deutsch);
    await p.close();
  }

  // --- 12.1: drei Themen plus Auto, jedes Thema in jedem Bereich ohne Fehler, Text mindestens 11 Punkt, kein farbiger Schein
  /* Ersatz fuer die Detektor-Ausnahmen tiny-text und dark-glow (Pruefung W5): gemessen in allen Bereichen, in der
     Kampfwahl, im Kompakt (Pruefung M6) und im offenen \u22ef-Feld. Ein Schein ist ein box-/text-shadow ohne Versatz mit
     Unschaerfe in einem farbigen Ton; erlaubt nur, was DESIGN.md nennt (Glut-Regel): der heisse Knopf und seine
     gedrueckten Geschwister, die grosse Zahl, der Balken. */
  const pruefe = (p, q) => p.evaluate((q) => {
    const ERLAUBT = ".btn.hot, #btnPin[aria-pressed=true], #btnGhost[aria-pressed=true], .partybtn[aria-pressed=true], .big .v, .fill";
    const klein = [], schein = [];
    const teile = (v) => { const out = []; let d = 0, a = 0; for (let i = 0; i < v.length; i++) { if (v[i] === "(") d++; else if (v[i] === ")") d--; else if (v[i] === "," && !d) { out.push(v.slice(a, i)); a = i + 1; } } out.push(v.slice(a)); return out; };
    const farbig = (t) => { const m = t.match(/rgba?\(([^)]+)\)/); if (!m) return false; const v = m[1].split(/[ ,\/]+/).filter(Boolean).map(Number);
      return (v.length < 4 || v[3] > 0.05) && Math.max(v[0], v[1], v[2]) - Math.min(v[0], v[1], v[2]) > 40; };
    const glueht = (v) => v && v !== "none" && teile(v).some((t) => { if (/inset/.test(t) || !farbig(t)) return false;
      const n = t.replace(/rgba?\([^)]*\)/, "").trim().split(/\s+/).map(parseFloat); return n[0] === 0 && n[1] === 0 && (n[2] || 0) > 0; });
    for (const e of document.querySelectorAll(q)) {
      if (!e.getClientRects().length) continue;
      const cs = getComputedStyle(e);
      if (cs.visibility !== "visible" || e.closest(".vh, [hidden]")) continue;
      const fs = parseFloat(cs.fontSize);
      if ([...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) && fs > 0 && fs < 11) klein.push((e.id || e.className || e.tagName) + " " + cs.fontSize);
      if ((glueht(cs.boxShadow) || glueht(cs.textShadow)) && !e.matches(ERLAUBT)) schein.push(e.id || e.className || e.tagName);
    }
    return { klein, schein };
  }, q);
  for (const theme of ["dark", "light", "tnl", "auto"]) {
    const s = await oeffne({ app: true, lang: "en", config: { theme, randlosGesehen: true } });
    const p = s.page;
    await beispiel(p);
    const an = await p.evaluate(() => document.documentElement.dataset.theme);
    const system = await p.evaluate(() => matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
    const klein = [], schein = [];
    const sammle = (wo, r) => { klein.push(...r.klein.map((x) => wo + ":" + x)); schein.push(...r.schein.map((x) => wo + ":" + x)); };
    for (const b of BEREICHE) { await zu(p, b); sammle(b, await pruefe(p, "header.top *, #bereiche *, #stage *, #statusleiste *")); }
    await p.keyboard.press("Control+K");
    await p.waitForFunction(() => !document.querySelector("#kampfwahl").hidden);
    sammle("Kampfwahl", await pruefe(p, "#kampfwahl *"));
    await p.keyboard.press("Escape");
    await zu(p, "timeline");
    await insKompakt(s);
    sammle("Kompakt", await pruefe(p, "body *"));
    await p.evaluate(() => document.querySelector("#btnMore").click());
    await p.waitForFunction(() => !document.querySelector("#morePanel").hidden);
    sammle("\u22ef", await pruefe(p, "#morePanel *"));
    assert(an === (theme === "auto" ? system : theme) && !s.fehler.length, `12.1 Thema ${theme}: gilt, keine Fehler in den zehn Bereichen`, { an, fehler: s.fehler });
    assert(!klein.length, `12.1 Thema ${theme}: kein sichtbarer Text unter 11 Punkt (Bereiche, Kampfwahl, Kompakt, \u22ef-Feld)`, [...new Set(klein)].slice(0, 30));
    assert(!schein.length, `12.1 Thema ${theme}: kein farbiger Schein ausser dem, den die Glut-Regel nennt`, [...new Set(schein)].slice(0, 30));
    await p.close();
  }

  // --- Woerterbuch: jeder neue Text in beiden Sprachen
  {
    const b = await esbuild.build({ stdin: { contents: 'export { I18N } from "./src/renderer/app/07-dictionary";', resolveDir: root, loader: "ts" },
      bundle: true, format: "esm", platform: "node", write: false, logLevel: "silent", plugins: [bilderPlugin(root, bilderModus(root))] });
    const { I18N } = await import("data:text/javascript;base64," + Buffer.from(b.outputFiles[0].text).toString("base64"));
    const neu = ["kw.vor", "kw.nach", "kw.vorTitle", "kw.nachTitle", "kw.tag", "kw.spanne", "kw.bester", "kw.tasten", "kw.live", "kw.kbdStrg",
      "kw.tWaehlen", "kw.tOeffnen", "kw.tBlaettern", "tabs.builds", "tabs.weeklies",
      // Feinschliff 02.10. (Abschnitte 4 und 5)
      "verlauf.lgAbend", "verlauf.plotNamePull", "verlauf.plotNamePullFew",
      // folgt Spezifikation Weeklies (W3): "kommt spaeter" entfiel, statt dessen der Kopf mit der Reset-Anzeige und das leere Feld
      "weeklies.resetWoche", "weeklies.resetTag", "sb.warte", "sb.gelesen", "sb.geradeEben", "sb.vorMin", "sb.ungelesen",
      // Abschnitt 2
      "tafel.schaden", "tafel.zahlSkills", "tafel.zahlZiele", "tafel.zahlWaffen", "tafel.zahlGruppe", "tafel.legDieser", "tafel.legBester",
      "tafel.legZweit", "head.feldboss", "head.treffer",
      // Abschnitt 3
      "deinerot.stilleSatz", "deinerot.einsaetze", "deinerot.einsaetzeUnter", "deinerot.spFaehigkeit", "deinerot.spTakt",
      "deinerot.spEinsaetze", "deinerot.spJeMinute", "deinerot.spAbstand", "deinerot.spTreffer", "deinerot.kopfZahl", "deinerot.kopfAus",
      "deinerot.leerband", "deinerot.mitgliedLeer", "deinerot.mitgliedTabelle", "deinerot.ausHier", "deinerot.autoAusHier", "chart.whoseRot",
      // Abschnitt 13 (Aufgabe 10)
      "tafel.zurRotation", "deinerot.leisteTitel", "deinerot.leisteHint", "help.rotName",
      // Abschnitt 14 (Aufgabe 11)
      "deinerot.ansicht", "deinerot.leiste", "deinerot.reihe", "deinerot.reiheBuehne", "deinerot.reiheSatz",
      // Abschnitt 4
      "analysis.call.leer.value", "analysis.call.leer.note", "analysis.weitere", "analysis.wb.luecken", "analysis.wb.lueckenSumme",
      "analysis.wb.groesster", "analysis.wb.fehl", "analysis.wb.keine", "analysis.wb.jeMinute", "analysis.form", "analysis.lueckeDef",
      "analysis.legendBalken", "analysis.legendMedian", "analysis.saeulenLabel", "analysis.d1", "analysis.d1.ant", "analysis.d1.leise",
      "analysis.d2", "analysis.d2.ant", "analysis.art.normal", "analysis.art.crit", "analysis.art.heavy", "analysis.art.critheavy",
      "analysis.art.shield", "analysis.d3", "analysis.d3.ant", "analysis.d3.leise", "analysis.vent.jeEinsatz",
      "analysis.vent.fehlend", "analysis.vent.fehlendNote", "analysis.vent.salven", "analysis.vent.treffer", "analysis.fuss",
      "analysis.fuss.1", "analysis.fuss.2", "analysis.fuss.3", "analysis.fuss.4", "analysis.call.leer.noteForm",
      // Abschnitt 5
      "vgl.mit", "vgl.best", "vgl.letzt", "vgl.letztFehlt", "vgl.letztOhneUhr", "vgl.letztName", "vgl.treffer", "vgl.summe",
      "vgl.summeRest", "vgl.holt", "vgl.kostet", "vgl.kopfSkill", "vgl.kopfWenigerBest", "vgl.kopfWenigerLetzt", "vgl.kopfUnterschied",
      "vgl.kopfMehr", "vgl.nurDiesem", "vgl.nurBest", "vgl.nurLetzt", "vgl.liste", "vgl.leadBelow", "vgl.leadAbove", "vgl.leadTie", "vgl.letztAcc", "vgl.raster", "verlauf.einordAlle",
      // Abschnitt 6
      "verlauf.zeitraum", "verlauf.woche", "verlauf.monat", "verlauf.alles", "verlauf.kopf", "verlauf.bisWoche", "verlauf.bisMonat",
      "verlauf.seit", "verlauf.plotTitel", "verlauf.lgLog", "verlauf.lgFrueher", "verlauf.kaempfe", "verlauf.kaempfeZahl", "verlauf.boss",
      "verlauf.colTag", "verlauf.colUhr", "verlauf.colDauer", "verlauf.einordName", "verlauf.sonst",
      // Abschnitt 7
      "party.ctxOhne", "party.ctxLaeuft", "party.ctxBeispiel", "party.woName", "party.woPc", "party.woServer", "party.hinaus", "party.optional",
      "party.codeTipp", "party.codeBereit", "party.joinSrvMit", "party.joinSrvOhne", "party.serverFehlt", "party.ohne", "party.mitglieder",
      "party.verbunden", "party.vorSek", "party.board", "party.dabei", "party.stand", "party.bsp", "party.codeTitel", "party.colMitglied",
      "party.colKlasse", "party.colDps", "party.aufName", "party.summe", "party.zusammen", "party.msatz", "party.msatzLeer", "party.zuKampf",
      "party.sp.skill", "party.sp.dmg", "party.sp.dps", "party.sp.hits", "party.sp.crit", "party.sp.heavy", "party.sp.max", "party.artenName",
      // Abschnitt 8 (was davon bleibt)
      "bau.waffenUnd",
      // Abschnitt 15 (Aufgabe 12)
      "ql.ctx", "ql.ctxLeer", "ql.linkLabel", "ql.nameLabel", "ql.save", "ql.hint", "ql.busy", "ql.choose", "ql.chooseBtn", "ql.cancel",
      "ql.err.link", "ql.err.buildId", "ql.err.timeout", "ql.err.missing", "ql.err.shape", "ql.err.busy", "ql.err.full", "ql.zuletzt",
      "ql.kaempfe", "ql.leer", "ql.gleich", "ql.offen", "ql.open", "ql.los", "ql.geloest", "ql.noch", "ql.appOnly", "ql.ohneWaffen",
      "ql.kampfLink", "ql.kampfName",
      // Fixrunde 1 zu Aufgabe 12
      "ql.unbekannt", "ql.warte", "ql.openName", "ql.openFremd", "ql.openFremdName", "ql.losName", "ql.zurueck", "ql.zurueckName",
      "ql.zeigen", "ql.verbergen",
      // Fixrunde 1
      "party.serverSave", "party.serverSaved", "party.serverCleared", "party.serverOffen",
      // Abschnitt 9
      "land.satz", "land.dateiOeffnen", "land.sampleAnsehen", "land.hinweisApp", "land.hinweisBrowser", "land.dropTitel", "land.dropSatz",
      "land.zuletzt", "land.liveAn", "land.zeileZahl", "land.zuletztLeer", "land.bspName", "land.bspWas", "land.bspZahl", "weeklies.leer",
      // Abschnitt 10
      "einst.g.sprache", "einst.g.groesse", "einst.g.overlay", "einst.g.gruppe", "einst.g.dev", "einst.g.info", "einst.wieWindows",
      "einst.bewegung", "einst.bewegungSatz", "einst.bewegungWert", "einst.oben", "einst.overlayAnsehen", "einst.live", "einst.liveSatz",
      "einst.server", "einst.clogName", "einst.clogWas", "einst.infoSatz", "party.zuEinst",
      // Abschnitt 11
      "head.dpsKurz", "compact.throughKurz", "compact.seePille", "top.durchName", "top.durchTitle",
      // Feinschliff 6 (02.10.): Status nach Lage, der zugeklappte Abschnitt, die Beispielgruppe in ihrer Sprache
      "party.nVerbunden", "party.warteZahlen", "party.wegeAuf", "party.bspName"];
    // entfallen mit dem Bereich Gruppe (Luecken 7): die Hilfe zum Hosten, die Karte Gruppen-Server, die alte Aufstellung
    // "party.serverSave" ist zurueck: Speichern des Gruppen-Servers im Feld Starten (Fixrunde 1, Befund 2), in der Liste oben
    const weg = ["help.partyName", "help.port", "help.sent", "help.close", "help.net", "help.server", "party.serverTitle",
      "party.serverActive", "party.serverInactive", "party.showBoard", "party.grpWaiting", "party.grpAway", "party.grpHere", "party.hostViaServer",
      // entfallen mit dem Bereich Builds (Luecken 8.1): der Satz, der auf den Verlauf darueber zeigte
      "bau.allInHistory",
      // entfallen mit "Fehler melden" in der Statusleiste (Entscheidung 01.10.): der Knopf in den Einstellungen
      "einst.schreiben",
      // entfallen in Fixrunde 1 (Befund 3): der Einleitungssatz ueber den Karten
      "bau.note",
      // entfallen mit Aufgabe 12: die Karte des erkannten Builds, Umbenennen und Link, Stufe, Trefferquoten, der Planer
      "bau.ctx", "bau.ctxLeer", "bau.nameSatz", "bau.dtWaffen", "bau.dtStufe", "bau.dtWoher", "bau.dtQuoten", "bau.dtKaempfe",
      "bau.woher80", "bau.stufeOhne", "bau.stufePlan", "bau.planAuf", "bau.planZu", "bau.newLine", "bau.edit", "bau.few", "bau.dummy",
      "bau.title", "bau.empty", "bau.linkLabel", "bau.linkHint", "bau.seen", "plan.detach", "plan.importBtn", "plan.refetch", "plan.err.link",
      "st.head", "st.rates", "st.connect", "stat.all_accuracy",
      // entfallen mit Start und Einstellungen (Luecken 1, 10): Ordnerstand, Pfad kopieren, die alten Gruppen
      "land.title", "land.desc", "land.folderDefault", "land.folderFound", "land.folderMissing", "land.copyPath", "land.pathCopied",
      "land.pathCopyFail", "einst.g.fenst", "einst.g.sicher", "einst.g.ueber", "einst.ueberSatz", "einst.clogSatz", "einst.zeigen",
      "einst.clogZeigen", "einst.randlos", "einst.themaSatz",
      // entfallen in Fixrunde 1 (Pruefung Befund 1): der Auszug aus dem Aenderungsprotokoll
      "einst.clogTitel", "einst.clogGanz",
      // entfallen mit Aufgabe 10: der Knopf zum Aufklappen im Kampf, die eigene Hilfe und das "Wessen" des Zeitverlaufs
      "tafel.spurenAuf", "tafel.spurenZu", "help.stackName", "chart.whose",
      // entfallen mit der Liste der Weeklies (Spezifikation Weeklies, W3): der Platzhalter "kommt spaeter"
      "weeklies.titel", "weeklies.satz", "weeklies.kopf",
      // entfallen mit Feinschliff 6 (02.10.): der Status "verbunden" ohne Zahl (jetzt party.nVerbunden)
      "party.connected"];
    const noch = weg.filter((k) => k in I18N.en || k in I18N.de);
    assert(!noch.length, "7/8/9/10: entfallene Texte sind aus beiden Sprachen entfernt", noch);
    const fehlt = neu.filter((k) => !(k in I18N.en) || !(k in I18N.de));
    assert(!fehlt.length, "neue Texte in beiden Sprachen mit demselben Schluessel", fehlt);
    // und ganz allgemein: dieselben Schluessel in beiden Sprachen (Pruefung Befund 6)
    /* Fixrunde 1 zu Aufgabe 5 (Pruefung Befund 4): zwei Begriffe, zwei Woerter - "Luecke" (nach dem Median) in
       der Analyse, "Pause" (ohne Treffer ueber 1,5 s) im Zeitverlauf und im Vergleich, je mit ihrer Definition */
    const v = (l, k, x) => typeof I18N[l][k] === "function" ? I18N[l][k](x) : I18N[l][k];
    const begriffe = { keyDe: v("de", "timeline.keyGap"), keyEn: v("en", "timeline.keyGap"), cmpDe: v("de", "compare.idleTime"), cmpEn: v("en", "compare.idleTime"),
      tipDe: v("de", "timeline.gapTip", { s: "3,0\u00a0s", a: "0:10", b: "0:13" }), urDe: v("de", "analysis.call.leer.value", { n: 3 }), urEn: v("en", "analysis.call.leer.value", { n: 3 }) };
    assert(begriffe.keyDe === "Pause: über 1,5\u00a0s ohne Treffer" && begriffe.keyEn === "pause: over 1.5\u00a0s with no hit" &&
      begriffe.cmpDe === "Pausen (über 1,5\u00a0s ohne Treffer)" && begriffe.cmpEn === "Pauses (over 1.5\u00a0s with no hit)" &&
      begriffe.tipDe.startsWith("Pause: ") && begriffe.urDe === "3 Sekunden in Lücken" && begriffe.urEn === "3 seconds in gaps",
      "Begriffe: Pause im Zeitverlauf und Vergleich, Luecke in der Analyse, beide erklaert (DE/EN)", begriffe);
    const nurEn = Object.keys(I18N.en).filter((k) => !(k in I18N.de)), nurDe = Object.keys(I18N.de).filter((k) => !(k in I18N.en));
    assert(!nurEn.length && !nurDe.length, "EN und DE tragen dieselben Schluessel", { nurEn, nurDe });
  }
  // ===== Abschnitt 13: Zeitverlauf in der Rotation (Nachtrag 29.09., Aufgabe 10) =====
  /* Wunsch nach dem Test der App (29.09.): Spuren, Zoom und Von/bis sollen prominenter stehen, mit der Rotation
     kombiniert, und beim Abspielen soll ein Balken mitlaufen. Zugestimmt: im Bereich Rotation steht unter der
     Zeitleiste der Einsaetze der Zeitverlauf auf derselben Zeitachse, Zoom und Von/bis gelten fuer beide, beim
     Abspielen laeuft ein senkrechter Strich durch beides; im Kampf fuehrt ein deutlicher Knopf dorthin.
     Das Log: Quick Fire alle 2 s bis 4 s (je zwei Treffer, der letzte bei 4,1 s), Strafing dazwischen, dann
     nichts - auch kein Deadly Viper - bis 8,1 s: eine Stille in der Zeitleiste und genau dieselbe Pause ohne
     Treffer im Zeitverlauf (4,0 s). Danach dicht Detonation Mark und Decisive Sniping bis 44 s, mit einer zweiten
     Stille spaet im Kampf, 35,6 bis 40,1 s (Fixrunde 1: ein Fehler, der mit der Zeit waechst, zeigt sich dort). */
  const ZV_LOG = join(work, "TLCombatLog-20260920-zeitverlauf.txt");
  {
    const start = at(21, 40, 0), rows = [];
    let k = 0;
    const zeile = (t, [n, id]) => rows.push([start + t, `,DamageDone,${n},${id},${1000 * (1 + (k++ % 5))},0,0,kNormalHit,Tester,Vulcanus`]);
    for (let t = 0; t <= 4000; t += 2000) { zeile(t, SKILLS[1]); zeile(t + 100, SKILLS[1]); }
    for (let t = 1000; t < 4000; t += 2000) zeile(t, SKILLS[2]);
    for (let i = 0, t = 8100; t < 44000; i++, t = 8100 + i * 500) if (t < 35700 || t > 40000) zeile(t, i % 2 ? SKILLS[3] : SKILLS[0]);
    for (let t = 250; t < 44000; t += 1000) if ((t < 4100 || t > 8100) && (t < 35600 || t > 40100)) zeile(t, DV_ROT);
    rows.sort((a, b) => a[0] - b[0]);
    writeFileSync(ZV_LOG, ["CombatLogVersion,4", ...rows.map(([t, r]) => stamp(t) + r)].join("\n") + "\n");
  }
  /* Wo Zeitleiste und Zeitverlauf stehen, und ob sie auf derselben Achse liegen: die Stille der Zeitleiste
     (.drstill, ein Element) gegen die Kanten der Pause, die der Zeitverlauf in die Spuren malt (paintGaps,
     zwei Punkte breit in --gap-edge) - gemessen in der obersten Spur knapp unter ihrer Linie, wo keine Kurve
     hinreicht. Beide unabhaengig gezeichnet: liegen sie auf +-2 Punkt uebereinander, ist es dieselbe Achse. */
  const zvBlick = (p) => p.evaluate(() => {
    const q = (x) => document.querySelector(x);
    const r = (e) => e && e.getClientRects().length ? e.getBoundingClientRect().toJSON() : null;
    const sicht = (e) => !!e && e.getClientRects().length > 0 && getComputedStyle(e).display !== "none" && getComputedStyle(e).visibility !== "hidden";
    const lv = q("#stackLanes"), lr = r(lv);
    /* je Pause zwei Kanten: zusammenhaengende Laeufe von Spalten in --gap-edge, paarweise (links, rechts) */
    const kante = [];
    if (lv && lr && lv.width) {
      const f = lv.width / lr.width, y = Math.round(2 * f), d = lv.getContext("2d").getImageData(0, y, lv.width, 1).data, laeufe = [];
      for (let x = 0; x < lv.width; x++) {
        const i = 4 * x;
        if (!(d[i + 3] > 150 && d[i] > 150 && d[i] - d[i + 1] > 60)) continue;
        const l = laeufe[laeufe.length - 1];
        if (l && x - l[1] <= 1) l[1] = x; else laeufe.push([x, x]);
      }
      for (let j = 0; j + 1 < laeufe.length; j += 2) kante.push({ von: lr.left + laeufe[j][0] / f, bis: lr.left + (laeufe[j + 1][1] + 1) / f });
    }
    // die Stillen, soweit sie ueber der Leinwand des Zeitverlaufs liegen (mit Von/bis nur die im Fenster)
    const still = [...document.querySelectorAll("#rotBar .drstill")].map((e) => e.getBoundingClientRect().toJSON())
      .filter((b) => lr && b.left >= lr.left - 2 && b.right <= lr.right + 2);
    const buehne = q("#deineRotScroll"), zv = q("#stackScroll");
    const kopf = q("#rotBar .drabkopf"), skopf = q("#stackKopf");
    const mitte = (e) => { if (!sicht(e)) return null; const b = e.getBoundingClientRect(); return b.left + b.width / 2; };
    return {
      buehne: r(buehne), zv: r(zv), stack: r(q("#stack")), feld: r(q("#stackFeld")), kasten: r(q("#drAutoKasten")),
      imBlock: !!zv && !!zv.closest("#deineRot") && !!q(".viewbar .vfrom")?.closest("#deineRot"),
      zoomSicht: sicht(q("#deineRot .viewbar [data-act='in']")) && sicht(q("#deineRot .viewbar .vfrom")) && sicht(q("#deineRot .viewbar .vto")),
      spurenSicht: [...document.querySelectorAll("#stackGut .rotgz")].filter(sicht).length,
      spurenHoch: [...document.querySelectorAll("#stackGut .rotgz")].map((b) => b.getBoundingClientRect().height),
      level: q("#deineRot .vlevel")?.textContent || "", von: q("#deineRot .vfrom")?.value || "", bis: q("#deineRot .vto")?.value || "",
      scroll: [buehne?.scrollLeft ?? -1, zv?.scrollLeft ?? -1], weit: [buehne?.scrollWidth ?? -1, zv?.scrollWidth ?? -1], cw: [buehne?.clientWidth ?? -1, zv?.clientWidth ?? -1],
      flaecheW: parseFloat(q("#rotBar .drflaeche")?.style.width || "0"), still, kante,
      /* Fixrunde 1: eine Zeitachse fuer Leiste und Kurve - die unter der Kurve (#stack, data-achse); die Leiste
         hat keine eigene mehr, und nichts im Block traegt eine zweite */
      achse: (q("#stack")?.dataset.achse || "").split(" ").filter(Boolean),
      achsenLeiste: document.querySelectorAll("#deineRot .drachse, #rotBar .drachse").length,
      viewbar: r(q("#deineRot .viewbar")), statusleiste: r(q(".statusleiste")),
      kopfR: r(kopf),
      symsSicht: [...document.querySelectorAll("#rotBar .drsym:not(.geht)")].filter((e) => { const b = e.getBoundingClientRect(), k = buehne.getBoundingClientRect(); return b.right > k.left + 1 && b.left < k.right - 1; }).map((e) => +e.dataset.t),
      kopfX: mitte(kopf), skopfX: mitte(skopf), skopf: r(skopf), skopfFarbe: skopf ? getComputedStyle(skopf).backgroundColor : "",
      rotKopf: (() => { const s = document.createElement("i"); s.style.color = "var(--rot-kopf)"; document.body.append(s); const c = getComputedStyle(s).color; s.remove(); return c; })(),
      uhr: q("#drUhr")?.textContent || "", laeuft: q("#drPlay")?.getAttribute("aria-pressed"),
      quer: document.documentElement.scrollWidth > innerWidth,
    };
  });
  // jede Stille liegt ueber ihrer Pause im Zeitverlauf: linke und rechte Kante je auf +-2 Punkt (n: wie viele im Bild)
  const deckt = (z, n = 2) => z.still.length === n && z.kante.length === n &&
    z.still.every((st, i) => Math.abs(st.left - z.kante[i].von) <= 2 && Math.abs(st.right - z.kante[i].bis) <= 2);
  const zvDeckung = (z) => ({ still: z.still.map((s) => [s.left, s.right]), kante: z.kante });
  // --- 13.1 bis 13.5 an 1280 x 860, Englisch
  {
    const s = await oeffne({ app: true }); const p = s.page;
    await zuRotation(s, ZV_LOG);
    await p.waitForFunction(() => !!document.querySelector("#stackLanes")?.width, null, { timeout: 5000 }).catch(() => {});
    let z = await zvBlick(p);
    const b = await rotBlick(p);
    // 13.1: im Bereich Rotation, im Block, unter der Zeitleiste der Zeitverlauf mit Spuren, Zoom und Von/bis
    assert(z.imBlock && z.zoomSicht && z.spurenSicht >= 4 && z.buehne && z.zv && z.stack && z.stack.width > 300 &&
      z.zv.top >= z.buehne.bottom - 1 && z.zv.top - z.buehne.bottom <= 2 && z.kasten && z.kasten.top >= z.zv.bottom - 1,
      "13.1 unter der Zeitleiste, buendig, der Zeitverlauf mit Spuren, Zoom und Von/bis; darunter der Kasten Automatisch", z);
    // 13.1: dieselbe Spalte - Zeitleiste und Zeitverlauf gleich weit links und gleich breit
    assert(!!z.buehne && !!z.zv && Math.abs(z.buehne.left - z.zv.left) <= 2 && Math.abs(z.buehne.width - z.zv.width) <= 2 && !!z.stack && Math.abs(z.flaecheW - z.stack.width) <= 2,
      "13.1 Zeitleiste und Zeitverlauf in derselben Spalte, gleich breit gezeichnet", { buehne: z.buehne, zv: z.zv, flaeche: z.flaecheW, stack: z.stack });
    // 13.2: ein Einsatz und seine Spur untereinander - die Stille der Zeitleiste ueber der Pause der Spuren
    assert(deckt(z), "13.2 dieselbe Zeitachse: beide Stillen (4,0 und 4,5\u00a0s, frueh und spaet) liegen auf +-2 Punkt ueber ihren Pausen im Zeitverlauf", zvDeckung(z));
    // Fixrunde 1: eine Zeitachse (die unter der Kurve), Zoom und Von/bis ueber dem Raster und bei 1280 x 860 ganz im Bild
    assert(z.achsenLeiste === 0 && z.achse[0] === "0:00" && z.achse.length >= 5 && !!z.viewbar && !!z.statusleiste && z.viewbar.bottom <= z.buehne.top + 1 &&
      z.viewbar.bottom <= z.statusleiste.top,
      "13.1 eine Zeitachse fuer Leiste und Kurve; Zoom und Von/bis ueber der Zeitleiste, bei 1280 \u00d7 860 ganz ueber der Statusleiste",
      { achsenLeiste: z.achsenLeiste, achse: z.achse, viewbar: z.viewbar, buehne: z.buehne, statusleiste: z.statusleiste });
    // die Proben aus Abschnitt 3 gelten weiter: ganzer Kampf ohne Rollen, 32-Punkt-Symbole in 3 Bahnen, Text mindestens 11 Punkt
    assert(!b.rollt && b.tops === 3 && b.symW.length && b.symW.every((w) => w === 32) && !b.klein.length && !z.quer && b.zeilen.length && b.zeilen.every((h) => h.hoch <= 44 + 0.5) &&
      z.spurenHoch.length && z.spurenHoch.every((h) => h <= 44 + 0.5),
      "13.1 ohne Zoom der ganze Kampf ohne Rollen, 3 Bahnen, Zeilen und Spuren hoechstens 44 Punkt, jeder Text mindestens 11 Punkt, kein Querrollen",
      { rollt: b.rollt, tops: b.tops, klein: b.klein, quer: z.quer, spuren: z.spurenHoch });
    // 13.3: Zoom gilt fuer beide - gleich breit gezeichnet, gleich gerollt, die Achse deckt sich weiter
    await p.click("#deineRot .viewbar [data-act='in']").catch(() => {});
    await p.waitForFunction(() => /^1\.5/.test(document.querySelector("#deineRot .vlevel")?.textContent || ""), null, { timeout: 3000 }).catch(() => {});
    await p.click("#deineRot .viewbar [data-act='in']").catch(() => {});
    await p.waitForFunction(() => /^2\.3/.test(document.querySelector("#deineRot .vlevel")?.textContent || ""), null, { timeout: 3000 }).catch(() => {});
    z = await zvBlick(p);
    assert(/^2\.3/.test(z.level) && z.weit[1] > z.cw[1] * 2 && Math.abs(z.weit[0] - z.weit[1]) <= 2 && !!z.stack && Math.abs(z.flaecheW - z.stack.width) <= 2 && deckt(z),
      "13.3 Zoom 2.3\u00d7 gilt fuer Zeitleiste und Spuren: gleich breit, die Stille deckt die Pause", { level: z.level, weit: z.weit, cw: z.cw, ...zvDeckung(z) });
    // gerollt wird gemeinsam: der Zeitverlauf rollt, die Zeitleiste folgt; die Stille bleibt ueber der Pause
    await p.evaluate(() => { const b = document.querySelector("#stackScroll"); if (b) b.scrollLeft = b.scrollWidth * 0.3; });
    await p.waitForFunction(() => Math.abs(document.querySelector("#deineRotScroll").scrollLeft - document.querySelector("#stackScroll").scrollLeft) <= 1 &&
      document.querySelector("#stackScroll").scrollLeft > 0, null, { timeout: 3000 }).catch(() => {});
    z = await zvBlick(p);
    assert(z.scroll[1] > 0 && Math.abs(z.scroll[0] - z.scroll[1]) <= 1 && deckt(z), "13.3 gerollt: die Zeitleiste rollt mit dem Zeitverlauf, die Stille bleibt ueber der Pause",
      { scroll: z.scroll, ...zvDeckung(z) });
    // mit der Tastatur: Ende auf dem Zeitverlauf rollt beide ans Ende
    await p.focus("#stackScroll"); await p.keyboard.press("End");
    await p.waitForFunction(() => { const a = document.querySelector("#deineRotScroll"), b = document.querySelector("#stackScroll");
      return b.scrollLeft > 0 && b.scrollLeft >= b.scrollWidth - b.clientWidth - 1 && Math.abs(a.scrollLeft - b.scrollLeft) <= 1; }, null, { timeout: 3000 }).catch(() => {});
    z = await zvBlick(p);
    assert(z.scroll[1] > 0 && z.scroll[1] >= z.weit[1] - z.cw[1] - 1 && Math.abs(z.scroll[0] - z.scroll[1]) <= 1, "13.3 Tastatur: Ende auf dem Zeitverlauf rollt beide ans Ende",
      { scroll: z.scroll, weit: z.weit, cw: z.cw });
    // 13.4: Von/bis gilt fuer beide - 0:02 bis 0:12
    await p.click("#deineRot .viewbar [data-act='reset']").catch(() => {});
    await p.waitForFunction(() => /^1\.0/.test(document.querySelector("#deineRot .vlevel")?.textContent || ""), null, { timeout: 3000 }).catch(() => {});
    await p.fill("#deineRot .vfrom", "0:02").catch(() => {}); await p.fill("#deineRot .vto", "0:12").catch(() => {}); await p.press("#deineRot .vto", "Enter").catch(() => {});
    await p.waitForFunction(() => !(document.querySelector("#stack")?.dataset.achse || "0:00").startsWith("0:00") &&
      document.querySelector("#deineRot .vfrom")?.value === "0:02", null, { timeout: 3000 }).catch(() => {});
    z = await zvBlick(p);
    // die Achse beschriftet in ihrem Schritt (mindestens 64 Punkt breit) nur, was im Fenster liegt
    const sekunde = (u) => { const m = /^(\d+):(\d\d)$/.exec(u); return m ? +m[1] * 60 + +m[2] : NaN; };
    assert(z.von === "0:02" && z.bis === "0:12" && z.achse.length >= 3 && z.achse.every((u) => sekunde(u) >= 2 && sekunde(u) <= 12) && z.achse[z.achse.length - 1] === "0:12" &&
      z.symsSicht.length && z.symsSicht.every((t) => t >= 2000 && t <= 12000) && z.weit[0] <= z.cw[0] + 1 && deckt(z, 1),
      "13.4 Von/bis 0:02 bis 0:12 gilt fuer beide: die Zeitleiste zeigt nur diese Strecke, die Stille deckt die Pause",
      { von: z.von, bis: z.bis, achse: z.achse, syms: [Math.min(...z.symsSicht), Math.max(...z.symsSicht)], weit: z.weit, ...zvDeckung(z) });
    await p.click("#deineRot .viewbar [data-act='reset']").catch(() => {});
    await p.waitForFunction(() => (document.querySelector("#stack")?.dataset.achse || "").startsWith("0:00"), null, { timeout: 3000 }).catch(() => {});
    z = await zvBlick(p);
    assert(z.achse[0] === "0:00" && z.weit[0] <= z.cw[0] + 1 && deckt(z), "13.4 \u201eWhole fight\u201c: wieder der ganze Kampf in beiden", { achse: z.achse, weit: z.weit, ...zvDeckung(z) });
    // 13.5: beim Abspielen laeuft ein senkrechter Strich durch Zeitleiste und Spuren, an derselben Stelle
    await p.evaluate(() => { document.querySelector('#drTempo [data-tempo="4"]').click(); document.querySelector("#drPlay").click(); });
    await p.waitForFunction(() => document.querySelector("#drPlay").getAttribute("aria-pressed") === "true" && /^0:0[2-9]/.test(document.querySelector("#drUhr").textContent), null, { timeout: 5000 }).catch(() => {});
    const k1 = await zvBlick(p);
    await p.waitForFunction((u) => document.querySelector("#drUhr").textContent !== u, k1.uhr, { timeout: 3000 }).catch(() => {});
    const k2 = await zvBlick(p);
    await p.evaluate(() => { if (document.querySelector("#drPlay").getAttribute("aria-pressed") === "true") document.querySelector("#drPlay").click(); });
    assert(k1.laeuft === "true" && k1.kopfX != null && k1.skopfX != null && Math.abs(k1.kopfX - k1.skopfX) <= 2 && k2.skopfX != null && Math.abs(k2.kopfX - k2.skopfX) <= 2 && k2.skopfX > k1.skopfX,
      "13.5 beim Abspielen: der Strich laeuft durch Zeitleiste und Spuren, an derselben Stelle (+-2 Punkt)", { k1: [k1.kopfX, k1.skopfX, k1.uhr], k2: [k2.kopfX, k2.skopfX, k2.uhr] });
    assert(!!k1.skopf && !!k1.feld && Math.abs(k1.skopf.top - k1.feld.top) <= 2 && Math.abs(k1.skopf.bottom - k1.feld.bottom) <= 2 && Math.round(k1.skopf.width) === 2 && k1.skopfFarbe === k1.rotKopf,
      "13.5 der Strich im Zeitverlauf: 2 Punkt, --rot-kopf, von oben bis unten durch Kurve und Spuren", { skopf: k1.skopf, feld: k1.feld, farbe: k1.skopfFarbe, soll: k1.rotKopf });
    // Fixrunde 1: ohne Luecke - der Kopf der Leiste reicht bis an den Zeitverlauf, dort setzt der Strich an
    assert(!!k1.kopfR && !!k1.feld && !!k1.skopf && k1.kopfR.bottom >= k1.feld.top - 2 && Math.abs(k1.kopfR.left - k1.skopf.left) <= 2,
      "13.5 der Strich laeuft ohne Luecke von der Leiste in den Zeitverlauf", { kopf: k1.kopfR, feld: k1.feld, skopf: k1.skopf });
    // Tastatur wie bisher: Pos1, Pfeil einen Einsatz weiter - der Strich im Zeitverlauf steht mit auf dem Einsatz
    await p.focus("#deineRotScroll");
    await p.keyboard.press("Home"); await p.keyboard.press("ArrowRight"); await p.keyboard.press("ArrowRight");
    const schritt = await p.evaluate(() => document.querySelector("#drLive").textContent);
    z = await zvBlick(p);
    const sym = await p.evaluate(() => { const e = document.querySelector("#rotBar .drsym.jetzt"); if (!e) return null; const b = e.getBoundingClientRect(); return b.left + b.width / 2; });
    // spaet im Kampf (Ende): der Strich steht weiter unter dem Einsatz
    await p.keyboard.press("End");
    const zEnde = await zvBlick(p);
    const symEnde = await p.evaluate(() => { const e = document.querySelector("#rotBar .drsym.jetzt") || document.querySelector("#rotBar .drstrich.jetzt");
      if (!e) return null; const b = e.getBoundingClientRect(); return { x: b.left + b.width / 2 }; });
    assert(!!symEnde && zEnde.kopfX != null && zEnde.skopfX != null && Math.abs(symEnde.x - zEnde.kopfX) <= 2 && Math.abs(symEnde.x - zEnde.skopfX) <= 2,
      "13.5 der letzte Einsatz (Ende): Kopf und Strich im Zeitverlauf stehen darunter (+-2 Punkt)", { symEnde, kopf: zEnde.kopfX, skopf: zEnde.skopfX });
    await p.keyboard.press("Home");
    await p.keyboard.press(" ");
    await p.waitForFunction(() => document.querySelector("#drPlay").getAttribute("aria-pressed") === "true", null, { timeout: 3000 }).catch(() => {});
    const spielt = await p.evaluate(() => document.querySelector("#drPlay").getAttribute("aria-pressed"));
    await p.keyboard.press(" ");
    assert(/^3 of /.test(schritt) && sym != null && z.kopfX != null && z.skopfX != null && Math.abs(sym - z.kopfX) <= 2 && Math.abs(sym - z.skopfX) <= 2 && spielt === "true" && !s.fehler.length,
      "13.5 Tastatur wie bisher (Pos1, Pfeile, Leertaste); der Strich im Zeitverlauf steht unter dem aktuellen Einsatz; keine Fehler",
      { schritt, sym, kopf: z.kopfX, skopf: z.skopfX, spielt, fehler: s.fehler });
    await p.close();
  }
  // --- 13.6: im Kampf ein deutlicher Knopf "Zeitverlauf und Rotation" statt "Spuren, Zoom und Von/bis"
  for (const lang of ["en", "de"]) {
    const s = await oeffne({ app: true, lang }); const p = s.page;
    await mitLog(s, ZV_LOG);
    const k = await p.evaluate(() => {
      const b = document.querySelector("#spurenAuf"), cs = b ? getComputedStyle(b) : null;
      return b ? { text: b.textContent.trim(), sicht: !!b.getClientRects().length, exp: b.getAttribute("aria-expanded"), ctl: b.getAttribute("aria-controls"),
        imFeld: !!b.closest("#kurveFeld"), rand: parseFloat(cs.borderTopWidth), grund: cs.backgroundColor, bild: cs.backgroundImage, ring: cs.boxShadow, schrift: parseFloat(cs.fontSize),
        stapel: !!document.querySelector("#stack")?.getClientRects().length } : null;
    });
    const soll = lang === "de" ? "Zeitverlauf und Rotation \u203a" : "Timeline and rotation \u203a";
    // deutlich: ein Knopf mit Platte oder Ring (wie "Kampf speichern"), nicht der leise Textknopf daneben
    const platte = !!k && (k.rand >= 1 || !/rgba\(0, 0, 0, 0\)|transparent/.test(k.grund) || k.bild !== "none" || k.ring !== "none");
    assert(!!k && k.sicht && k.imFeld && k.text === soll && k.exp === null && k.ctl === null && platte && k.schrift >= 11 && !k.stapel,
      `13.6 ${lang}: im Kampf der deutliche Knopf \u201e${soll}\u201c (ein Weg, kein Aufklappen), der Zeitverlauf steht nicht im Kampf`, k);
    await p.focus("#spurenAuf"); await p.keyboard.press("Enter");
    await p.waitForFunction(() => document.querySelector('#bereiche [data-tab="rotation"]').getAttribute("aria-current") === "page" &&
      !!document.querySelector("#stackLanes")?.width, null, { timeout: 5000 }).catch(() => {});
    const dort = await p.evaluate(() => ({ bereich: document.querySelector('#bereiche [data-tab="rotation"]').getAttribute("aria-current"),
      fokus: document.activeElement?.id, stack: document.querySelector("#stack").getBoundingClientRect().width,
      zoom: !!document.querySelector("#p-rotation .vfrom")?.getClientRects().length, buehne: document.querySelector("#deineRotScroll").getBoundingClientRect().toJSON(), h: innerHeight }));
    assert(dort.bereich === "page" && dort.fokus === "deineRotScroll" && dort.stack > 300 && dort.zoom && dort.buehne.top >= 0 && dort.buehne.top < dort.h,
      `13.6 ${lang}: der Knopf fuehrt in den Bereich Rotation, der Fokus steht auf der Zeitleiste, Spuren mit Zoom und Von/bis sind da`, dort);
    assert(!s.fehler.length, `13.6 ${lang}: keine Fehler`, s.fehler);
    await p.close();
  }
  // --- 13.7: Groessen - dieselbe Achse, nichts gestreckt, 560 ohne Querrollen
  /* Fixrunde 1: auch schmaler als die Spalte je war - 560 bei 150 % Groesse und 520 Punkt Fenster; dort liegt jeder
     Einsatz weiter ueber seiner Spur, frueh und spaet im Kampf */
  for (const [breite, hoehe, groesse] of [[1280, 860], [1920, 1080], [2000, 1480], [1000, 860], [760, 860], [560, 860], [560, 860, 150], [520, 860]]) {
    const s = await oeffne({ app: true, breite, hoehe, config: groesse ? { uiZoom: groesse } : {} }); const p = s.page;
    await zuRotation(s, ZV_LOG);
    if (groesse) await p.waitForFunction((g) => document.documentElement.style.zoom === String(g / 100), groesse, { timeout: 3000 }).catch(() => {});
    await p.waitForFunction(() => !!document.querySelector("#stackLanes")?.width, null, { timeout: 5000 }).catch(() => {});
    const z = await zvBlick(p), b = await rotBlick(p);
    const wo = `${breite} \u00d7 ${hoehe}${groesse ? " bei " + groesse + " %" : ""}`;
    if (groesse) assert(await p.evaluate(() => document.documentElement.style.zoom) === String(groesse / 100), `13.7 ${wo}: die Groesse gilt`);
    /* die Bahnen: so viele, wie dieses duenne Log braucht, hoechstens drei (ab 1200 Punkt Hoehe fuenf); die feste Zahl prueft Abschnitt 3 */
    assert(!z.quer && !b.rollt && b.tops >= 1 && b.tops <= (hoehe >= 1200 ? 5 : 3) && !!z.buehne && !!z.zv && Math.abs(z.buehne.left - z.zv.left) <= 2 && Math.abs(z.buehne.width - z.zv.width) <= 2 &&
      z.zv.top >= z.buehne.bottom - 1 && z.zv.top - z.buehne.bottom <= 2 && deckt(z),
      `13.7 ${wo}: kein Querrollen, Zeitleiste und Zeitverlauf in einer Spalte uebereinander, die Stille ueber der Pause`,
      { quer: z.quer, rollt: b.rollt, tops: b.tops, buehne: z.buehne, zv: z.zv, ...zvDeckung(z) });
    // in Layoutpunkten: bei 150 % Groesse misst der Browser alles anderthalbfach
    const pt = (h) => h / ((groesse || 100) / 100);
    assert(b.zeilen.length && b.zeilen.every((x) => pt(x.hoch) <= 44 + 0.5) && z.spurenHoch.length && z.spurenHoch.every((h) => pt(h) <= 44 + 0.5) && !b.klein.length && !s.fehler.length,
      `13.7 ${wo}: Zeilen und Spuren hoechstens 44 Punkt, jeder Text mindestens 11 Punkt, keine Fehler`, { zeilen: b.zeilen.map((x) => x.hoch), spuren: z.spurenHoch, klein: b.klein, fehler: s.fehler });
    await p.close();
  }

  // ===== Abschnitt 14: Umschalter Leiste | Reihenfolge (Nachtrag 29.09., Aufgabe 11) =====
  /* Wunsch (29.09.): In der Rotation konnte man zwischen der Leiste und einer einfachen Reihenfolge umschalten,
     das haette er gerne wieder. Vorlage ist die entfallene Folge (6b72131, "Timeline | Sequence") ohne Durchgaenge
     und Massstab: die gedrueckten Einsaetze als Reihe von 32-Punkt-Symbolen in der Reihenfolge des Kampfes, ohne
     Zeitachse, umbrechend. Der Zeitverlauf bleibt darunter stehen (Entscheidung vom 29.09., an Claude
     uebertragen); beim Abspielen ist statt des Strichs der laufende Einsatz in der Reihe hervorgehoben. Das Log ist
     das aus Abschnitt 3 (172 gedrueckte Einsaetze, zwei Stillen, Deadly Viper automatisch). */
  const reiheBlick = (p) => p.evaluate(() => {
    const q = (x) => document.querySelector(x);
    const r = (e) => e && e.getClientRects().length ? e.getBoundingClientRect().toJSON() : null;
    const sicht = (e) => !!e && e.getClientRects().length > 0 && getComputedStyle(e).display !== "none" && getComputedStyle(e).visibility !== "hidden" &&
      e.getBoundingClientRect().height > 0;
    const gruppe = q("#drAnsicht"), radios = gruppe ? [...gruppe.querySelectorAll("[role=radio]")] : [];
    const box = q("#drFolge"), kacheln = [...document.querySelectorAll("#drReihe .drk")];
    const jetzt = [...document.querySelectorAll("#drReihe .drk.jetzt")];
    const probe = document.createElement("i"); probe.style.color = "var(--rot-kopf)"; document.body.append(probe);
    const rotKopf = getComputedStyle(probe).color; probe.remove();
    const br = box ? box.getBoundingClientRect() : null, jr = jetzt[0] ? jetzt[0].getBoundingClientRect() : null;
    return {
      gruppe: gruppe ? { rolle: gruppe.getAttribute("role"), name: gruppe.getAttribute("aria-label") || "", inSteuer: !!gruppe.closest("#drSteuer"), sicht: sicht(gruppe) } : null,
      radios: radios.map((b) => ({ text: b.textContent.trim(), an: b.getAttribute("aria-checked"), tab: b.tabIndex, schrift: parseFloat(getComputedStyle(b).fontSize) })),
      fokus: document.activeElement?.closest?.("#drAnsicht") ? document.activeElement.textContent.trim() : (document.activeElement?.id || ""),
      leiste: sicht(q("#deineRotScroll")), reihe: sicht(box), box: r(box),
      reiheName: box?.getAttribute("aria-label") || "", reiheTab: box ? box.tabIndex : -9, reiheRolle: box?.getAttribute("role") || "",
      kacheln: kacheln.map((k) => { const s = k.querySelector(".drksym"); const b = s ? s.getBoundingClientRect() : null;
        return { i: +k.dataset.i, k: k.dataset.k, t: +k.dataset.t, w: b ? Math.round(b.width) : 0, h: b ? Math.round(b.height) : 0, top: b ? Math.round(b.top) : 0, left: b ? b.left : 0 }; }),
      pausen: [...document.querySelectorAll("#drReihe .drpause")].map((x) => x.textContent.trim()),
      pausenVor: [...document.querySelectorAll("#drReihe .drpause")].map((x) => +x.dataset.vor),
      kinder: q("#drReihe")?.childElementCount ?? -1,
      striche: [...document.querySelectorAll("#rotBar .drstrich")].map((e) => ({ i: +e.dataset.i, k: e.dataset.k })).sort((a, b) => a.i - b.i),
      absolut: kacheln.some((k) => getComputedStyle(k).position === "absolute"),
      achse: box ? box.querySelectorAll("[class*=achse], [data-achse]").length : -1,
      jetzt: jetzt.map((k) => +k.dataset.i), jetztRing: jetzt[0] ? getComputedStyle(jetzt[0].querySelector(".drksym")).boxShadow : "", rotKopf,
      jetztIm: !!br && !!jr && jr.top >= br.top - 1 && jr.bottom <= br.bottom + 6,
      war: [...document.querySelectorAll("#drReihe .drk.war")].map((k) => +k.dataset.i),
      lead: q("#deineRotLead")?.textContent || "",
      pos: q("#drJetzt .drjpos")?.textContent || "", live: q("#drLive")?.textContent || "", uhr: q("#drUhr")?.textContent || "",
      laeuft: q("#drPlay")?.getAttribute("aria-pressed"),
      zv: r(q("#stackScroll")), zvSicht: sicht(q("#stackScroll")) && (q("#stackLanes")?.width || 0) > 0,
      skopfX: sicht(q("#stackKopf")) ? q("#stackKopf").getBoundingClientRect().left : null,
      rollt: box ? box.scrollWidth > box.clientWidth + 1 : false, karte: r(q("#deineRot")),
      quer: document.documentElement.scrollWidth > innerWidth,
      speicher: (() => { try { return Object.keys(localStorage).sort(); } catch { return []; } })(),
    };
  });
  const reiheWahl = (p, welche) => p.evaluate((w) => document.querySelectorAll("#drAnsicht [role=radio]")[w]?.click(), welche);
  // --- 14.1 bis 14.6 an 1280 x 860, Englisch
  {
    const s = await oeffne({ app: true }); const p = s.page;
    await zuRotation(s);
    let x = await reiheBlick(p);
    const speicherVorher = x.speicher, postsVorher = s.posts.length, leadLeiste = x.lead;
    // 14.1: der Umschalter steht in der Steuerzeile, als Radiogruppe mit einem Tabstopp; Leiste gewaehlt; die Reihe ist nicht gebaut
    assert(!!x.gruppe && x.gruppe.inSteuer && x.gruppe.sicht && x.gruppe.rolle === "radiogroup" && x.gruppe.name === "View" &&
      JSON.stringify(x.radios.map((r) => [r.text, r.an, r.tab])) === JSON.stringify([["Bar", "true", 0], ["Sequence", "false", -1]]) &&
      x.radios.every((r) => r.schrift >= 11) && x.leiste && !x.reihe && x.kinder <= 0,
      "14.1 Umschalter \u201eBar | Sequence\u201c in der Steuerzeile: Radiogruppe, ein Tabstopp, Leiste gewaehlt, die Reihe nicht gebaut",
      { gruppe: x.gruppe, radios: x.radios, leiste: x.leiste, reihe: x.reihe, kinder: x.kinder });
    // 14.2: Tastatur - Pfeil rechts waehlt die Reihenfolge und nimmt den Fokus mit, Pfeil links zurueck
    await p.focus("#drAnsicht [role=radio][aria-checked=true]").catch(() => {});
    await p.keyboard.press("ArrowRight");
    await p.waitForFunction(() => document.querySelector("#drAnsicht [role=radio][aria-checked=true]")?.textContent.trim() === "Sequence" &&
      document.querySelectorAll("#drReihe .drk").length > 0, null, { timeout: 3000 }).catch(() => {});
    x = await reiheBlick(p);
    assert(JSON.stringify(x.radios.map((r) => [r.an, r.tab])) === JSON.stringify([["false", -1], ["true", 0]]) && x.fokus === "Sequence" && x.reihe && !x.leiste &&
      x.reiheRolle === "group" && x.reiheName === "Your rotation, sequence" && x.reiheTab === 0,
      "14.2 Tastatur: Pfeil rechts waehlt \u201eSequence\u201c, der Fokus geht mit; die Reihe steht statt der Leiste, ein Tabstopp mit Namen",
      { radios: x.radios, fokus: x.fokus, reihe: x.reihe, leiste: x.leiste, name: x.reiheName, tab: x.reiheTab });
    // 14.3: die gedrueckten Einsaetze in der Reihenfolge des Kampfes - dieselben wie die Striche der Leiste, 32 Punkt, umbrechend, ohne Zeitachse
    const gleich = JSON.stringify(x.kacheln.map((k) => [k.i, k.k])) === JSON.stringify(x.striche.map((k) => [k.i, k.k]));
    const reihen = [...new Set(x.kacheln.map((k) => k.top))];
    const zeitlich = x.kacheln.every((k, j) => j === 0 || k.t >= x.kacheln[j - 1].t);
    // gleiche Abstaende in einer Zeile: keine Zeitachse (auf der Leiste stuende die dichte Strecke enger als der Anfang)
    const abstaende = x.kacheln.slice(1).map((k, j) => [k, x.kacheln[j]]).filter(([k, v]) => k.top === v.top && !x.jetzt.includes(k.i) && !x.jetzt.includes(v.i) && !x.pausenVor.includes(k.i))
      .map(([k, v]) => Math.round(k.left - v.left));
    assert(x.kacheln.length === 172 && gleich && zeitlich && !x.kacheln.some((k) => k.k === "Deadly Viper") &&
      x.kacheln.filter((k) => !x.jetzt.includes(k.i)).every((k) => k.w === 32 && k.h === 32) && reihen.length >= 3 && !x.absolut && x.achse === 0 &&
      new Set(abstaende).size === 1 && !x.rollt && !x.quer,
      "14.3 die Reihe: 172 gedrueckte Einsaetze wie in der Leiste, in der Reihenfolge des Kampfes, 32-Punkt-Symbole mit gleichem Abstand, umbrechend, ohne Zeitachse, ohne das Automatische",
      { n: x.kacheln.length, gleich, zeitlich, reihen: reihen.length, abstaende: [...new Set(abstaende)], absolut: x.absolut, achse: x.achse, rollt: x.rollt });
    assert(JSON.stringify(x.pausen) === JSON.stringify(["2.5\u00a0s", "3.0\u00a0s"]),
      "14.3 die Stille steht an ihrer Stelle in der Reihe, mit ihrer Dauer auf Zehntel (2.5 und 3.0\u00a0s)", x.pausen);
    /* Nachtrag der Pruefung: in der Reihenfolge ein eigener Satz - kein Band, keine Stille, sondern was die Reihe zeigt
       und dass Zeitachse, Zoom und Von/bis im Zeitverlauf darunter gelten; die Leiste behaelt ihren */
    assert(/^172 casts you pressed/.test(x.lead) && x.lead.endsWith(" The sequence shows one symbol per cast, evenly spaced; the time axis, zoom and from/to belong to the timeline below.") &&
      !/band|idle/i.test(x.lead) && /The fields in the band are idle time/.test(leadLeiste),
      "14.3 der Satz ueber der Reihe: was sie zeigt, Zeitachse, Zoom und Von/bis im Zeitverlauf darunter - kein Band, keine Stille; die Leiste behaelt ihren Satz",
      { reihe: x.lead, leiste: leadLeiste });
    // der Zeitverlauf bleibt darunter, buendig, in derselben Spalte
    assert(x.zvSicht && !!x.box && !!x.zv && x.zv.top >= x.box.bottom - 1 && x.zv.top - x.box.bottom <= 2 && Math.abs(x.zv.left - x.box.left) <= 2 && Math.abs(x.zv.width - x.box.width) <= 2,
      "14.3 der Zeitverlauf bleibt unter der Reihe stehen, buendig und in derselben Spalte", { box: x.box, zv: x.zv });
    // 14.4: das Auge nimmt eine Faehigkeit auch aus der Reihe - und holt sie zurueck
    await p.evaluate(() => document.querySelector('#drGed .rotgz[data-k="Strafing"]')?.click());
    await p.waitForFunction(() => document.querySelectorAll("#drReihe .drk").length === 162, null, { timeout: 3000 }).catch(() => {});
    let y = await reiheBlick(p);
    assert(y.kacheln.length === 162 && !y.kacheln.some((k) => k.k === "Strafing") && y.reihe,
      "14.4 das Auge blendet Strafing (10 Einsaetze) auch in der Reihe aus", { n: y.kacheln.length, strafing: y.kacheln.filter((k) => k.k === "Strafing").length });
    await p.evaluate(() => document.querySelector('#drGed .rotgz[data-k="Strafing"]')?.click());
    await p.waitForFunction(() => document.querySelectorAll("#drReihe .drk").length === 172, null, { timeout: 3000 }).catch(() => {});
    y = await reiheBlick(p);
    assert(y.kacheln.length === 172 && y.kacheln.filter((k) => k.k === "Strafing").length === 10, "14.4 und wieder eingeblendet: 172, Strafing zehnmal", y.kacheln.length);
    // 14.5: Abspielen hebt den laufenden Einsatz hervor - genau einer, Rahmen in --rot-kopf, er wandert; Vergangenes blasser; der Strich laeuft im Zeitverlauf weiter
    await p.evaluate(() => { document.querySelector('#drTempo [data-tempo="4"]').click(); document.querySelector("#drPlay").click(); });
    await p.waitForFunction(() => document.querySelector("#drPlay").getAttribute("aria-pressed") === "true" && /^0:0[3-9]/.test(document.querySelector("#drUhr").textContent), null, { timeout: 6000 }).catch(() => {});
    const a1 = await reiheBlick(p);
    await p.waitForFunction((i) => { const j = document.querySelector("#drReihe .drk.jetzt"); return !!j && +j.dataset.i > i; }, a1.jetzt[0] ?? 0, { timeout: 4000 }).catch(() => {});
    const a2 = await reiheBlick(p);
    await p.evaluate(() => { if (document.querySelector("#drPlay").getAttribute("aria-pressed") === "true") document.querySelector("#drPlay").click(); });
    const nr = (pos) => +(/^(\d+) of /.exec(pos) || [])[1];
    assert(a1.laeuft === "true" && a1.jetzt.length === 1 && a2.jetzt.length === 1 && a2.jetzt[0] > a1.jetzt[0] && a1.jetztRing.startsWith(a1.rotKopf) &&
      nr(a2.pos) === a2.jetzt[0] + 1 && a2.war.length === a2.jetzt[0] && a2.war.every((i) => i < a2.jetzt[0]),
      "14.5 beim Abspielen: genau ein Einsatz hervorgehoben (Rahmen in --rot-kopf), er wandert mit \u201eNow\u201c, was vorbei ist, steht blasser",
      { a1: [a1.jetzt, a1.pos, a1.uhr], a2: [a2.jetzt, a2.pos, a2.war.length], ring: a1.jetztRing, soll: a1.rotKopf });
    assert(a1.skopfX != null && a2.skopfX != null && a2.skopfX > a1.skopfX && !a1.leiste,
      "14.5 der Strich laeuft im Zeitverlauf darunter mit, die Leiste bleibt verborgen", { k1: a1.skopfX, k2: a2.skopfX });
    // Tastatur auf der Reihe wie auf der Leiste: Pos1, zwei Schritte, Ende (die Reihe rollt mit), Leertaste
    await p.focus("#drFolge").catch(() => {});
    await p.keyboard.press("Home"); await p.keyboard.press("ArrowRight"); await p.keyboard.press("ArrowRight");
    const t1 = await reiheBlick(p);
    await p.keyboard.press("End");
    const t2 = await reiheBlick(p);
    await p.keyboard.press("Home");
    await p.keyboard.press(" ");
    await p.waitForFunction(() => document.querySelector("#drPlay").getAttribute("aria-pressed") === "true", null, { timeout: 3000 }).catch(() => {});
    const t3 = await reiheBlick(p);
    await p.keyboard.press(" ");
    assert(t1.jetzt.join() === "2" && /^3 of 172: /.test(t1.live) && t2.jetzt.join() === "171" && t2.jetztIm && /^172 of 172: /.test(t2.live) && t3.laeuft === "true",
      "14.5 Tastatur auf der Reihe: Pos1, Pfeile, Ende (der letzte Einsatz steht im sichtbaren Teil), Leertaste spielt",
      { t1: [t1.jetzt, t1.live], t2: [t2.jetzt, t2.live, t2.jetztIm], t3: t3.laeuft });
    // ein Klick auf einen Einsatz der Reihe springt dorthin
    await p.evaluate(() => document.querySelectorAll("#drReihe .drk")[20]?.click());
    await p.waitForFunction(() => document.querySelector("#drReihe .drk.jetzt")?.dataset.i === "20", null, { timeout: 3000 }).catch(() => {});
    const k = await reiheBlick(p);
    assert(k.jetzt.join() === "20" && /^21 of 172/.test(k.pos), "14.5 ein Klick auf einen Einsatz der Reihe springt dorthin", { jetzt: k.jetzt, pos: k.pos });
    // 14.6: die Wahl gilt fuer die Sitzung - ueber einen Bereichswechsel hinweg, ohne neuen Speicherschluessel und ohne Einstellung beim Helfer
    await bereich(p, "timeline");
    await bereich(p, "rotation");
    await p.waitForFunction(() => document.querySelectorAll("#drReihe .drk").length === 172, null, { timeout: 3000 }).catch(() => {});
    const w = await reiheBlick(p);
    assert(w.reihe && !w.leiste && w.radios.map((r) => r.an).join() === "false,true" && JSON.stringify(w.speicher) === JSON.stringify(speicherVorher) && s.posts.length === postsVorher,
      "14.6 nach dem Bereichswechsel steht weiter die Reihenfolge; kein neuer Speicherschluessel, nichts an den Helfer",
      { reihe: w.reihe, radios: w.radios, speicher: [speicherVorher, w.speicher], posts: s.posts.slice(postsVorher) });
    // Pfeil links: zurueck zur Leiste, der Kopf steht beim selben Einsatz
    await p.focus("#drAnsicht [role=radio][aria-checked=true]").catch(() => {});
    await p.keyboard.press("ArrowLeft");
    await p.waitForFunction(() => document.querySelector("#drAnsicht [role=radio][aria-checked=true]")?.textContent.trim() === "Bar", null, { timeout: 3000 }).catch(() => {});
    const l = await reiheBlick(p);
    const leisteJetzt = await p.evaluate(() => document.querySelector("#rotBar .drsym.jetzt, #rotBar .drstrich.jetzt")?.dataset.i ?? null);
    assert(l.leiste && !l.reihe && l.fokus === "Bar" && leisteJetzt === "20" && !s.fehler.length,
      "14.6 Pfeil links: wieder die Leiste, der Kopf beim selben Einsatz; keine Fehler", { leiste: l.leiste, reihe: l.reihe, fokus: l.fokus, leisteJetzt, fehler: s.fehler });
    // neu geladen: wieder die Leiste (nur Sitzung)
    await p.reload();
    await p.waitForFunction(() => document.body.dataset.bereit, null, { timeout: 5000 }).catch(() => {});
    await zuRotation(s);
    const n = await reiheBlick(p);
    assert(n.leiste && !n.reihe && n.radios.map((r) => r.an).join() === "true,false", "14.6 nach dem Neuladen wieder die Leiste (die Wahl gilt nur fuer die Sitzung)", n.radios);
    await p.close();
  }
  // --- 14.7: Deutsch, und die Groessen - das eigene Fenster 2000 x 1480, 1920 x 1080, 1280 x 860, 1000, 760, 560: nichts rollt quer,
  //     Text mindestens 11 Punkt, Zeilen (Reihe, Spuren, Einsaetze) hoechstens 44 Punkt
  for (const [breite, hoehe, lang] of [[1280, 860, "de"], [2000, 1480, "en"], [1920, 1080, "en"], [1000, 860, "en"], [760, 860, "en"], [560, 860, "en"]]) {
    const s = await oeffne({ app: true, breite, hoehe, lang }); const p = s.page;
    await zuRotation(s);
    await reiheWahl(p, 1);
    await p.waitForFunction(() => document.querySelectorAll("#drReihe .drk").length === 172, null, { timeout: 3000 }).catch(() => {});
    await p.waitForFunction(() => !!document.querySelector("#stackLanes")?.width, null, { timeout: 5000 }).catch(() => {});
    const x = await reiheBlick(p), b = await rotBlick(p), z = await zvBlick(p);
    const wo = `${breite} \u00d7 ${hoehe} ${lang}`;
    // die Reihen der Reihe: Abstand von Oberkante zu Oberkante, ohne den hervorgehobenen Einsatz
    const oben = [...new Set(x.kacheln.filter((k) => !x.jetzt.includes(k.i)).map((k) => k.top))].sort((a, c) => a - c);
    const schritt = oben.slice(1).map((t, j) => t - oben[j]);
    assert(schritt.length >= 1 && schritt.every((h) => h <= 44) && b.zeilen.length && b.zeilen.every((r) => r.hoch <= 44 + 0.5) &&
      z.spurenHoch.length && z.spurenHoch.every((h) => h <= 44 + 0.5),
      `14.7 ${wo}: Zeilen hoechstens 44 Punkt - die Reihen der Reihe, die Spuren darunter, die Einsaetze`,
      { schritt: [...new Set(schritt)], zeilen: b.zeilen.map((r) => r.hoch), spuren: z.spurenHoch });
    if (lang === "de") assert(x.gruppe?.name === "Ansicht" && x.radios.map((r) => r.text).join("|") === "Leiste|Reihenfolge" && x.reiheName === "Deine Rotation, Reihenfolge" &&
      JSON.stringify(x.pausen) === JSON.stringify(["2,5\u00a0s", "3,0\u00a0s"]) &&
      x.lead.endsWith(" Die Reihenfolge zeigt ein Symbol je Einsatz in gleichem Abstand; Zeitachse, Zoom und Von/bis gelten im Zeitverlauf darunter.") && !/Band|Stille/.test(x.lead),
      "14.7 Deutsch: \u201eLeiste | Reihenfolge\u201c, die Reihe mit Namen, die Stille mit Komma, der eigene Satz ohne Band und Stille",
      { name: x.gruppe?.name, radios: x.radios.map((r) => r.text), reihe: x.reiheName, pausen: x.pausen, lead: x.lead });
    const drin = !!x.karte && x.kacheln.every((k) => k.left >= x.karte.left - 0.5 && k.left + 32 <= x.karte.right + 0.5);
    assert(x.reihe && x.kacheln.length === 172 && !x.quer && !x.rollt && drin && !b.klein.length && x.radios.every((r) => r.schrift >= 11) &&
      x.zvSicht && !!x.zv && !!x.box && x.zv.top >= x.box.bottom - 1 && x.zv.top - x.box.bottom <= 2 && !s.fehler.length,
      `14.7 ${wo}: die Reihe in der Karte, nichts rollt quer, jeder Text mindestens 11 Punkt, der Zeitverlauf darunter, keine Fehler`,
      { quer: x.quer, rollt: x.rollt, drin, klein: b.klein, box: x.box, zv: x.zv, fehler: s.fehler });
    await p.close();
  }
  // --- 14.8: beim Mitglied ohne geteilte Einsaetze ist der Umschalter aus wie das Tempo, und es steht die leere Leiste
  {
    const kurve = { T: 60, t0: 0, lanes: [{ n: "Quick Fire", sid: "964762401", v: Array.from({ length: 60 }, () => 5000) }], total: Array.from({ length: 60 }, () => 5000) };
    const zeile = (name, extra) => ({ name, waiting: false, damage: 300000, dps: 5000, hits: 60, crit: 10, heavy: 5, seconds: 60, max: 9000,
      skills: [{ name: "Quick Fire", sid: "964762401", damage: 300000, dps: 5000, hits: 60, crit: 10, heavy: 5, max: 9000 }],
      hasCurve: true, curve: kurve, share: 1, onTarget: true, target: "Vulcanus", lang: "en", weapons: ["Crossbow", "Longbow"], ventius: false, age: 0, ...extra });
    const geteilt = [{ n: "Quick Fire", c: [[1000, 1100, 9000, 2, 0], [5000, 5100, 9000, 2, 0], [9000, 9100, 9000, 2, 0], [13000, 13100, 9000, 2, 0]] }];
    const s = await oeffne({ app: true, gruppe: { role: "host", code: "QX7K", board: [zeile("Mitglied Eins"), zeile("Mitglied Zwei", { casts: geteilt })], target: "Vulcanus", error: "" } });
    const p = s.page;
    await zuRotation(s);
    await p.waitForFunction(() => !document.querySelector("#rotWhoBar").hidden, null, { timeout: 8000 }).catch(() => {});
    // die eigene Rotation in der Reihenfolge, dann das Mitglied ohne geteilte Einsaetze
    await reiheWahl(p, 1);
    await p.waitForFunction(() => document.querySelectorAll("#drReihe .drk").length > 0, null, { timeout: 3000 }).catch(() => {});
    await p.evaluate(() => [...document.querySelectorAll("#rotWho [data-wer]")].find((x) => x.dataset.wer === "Mitglied Eins")?.click());
    await p.waitForFunction(() => /Mitglied Eins/.test(document.querySelector("#deineRotLead").textContent), null, { timeout: 5000 }).catch(() => {});
    const aus = await p.evaluate(() => ({ radios: [...document.querySelectorAll("#drAnsicht [role=radio]")].map((b) => b.disabled),
      still: document.querySelector("#drSteuer").classList.contains("still"), reihe: !document.querySelector("#drFolge").hidden,
      band: document.querySelector("#rotBar")?.innerText || "" }));
    assert(aus.radios.length === 2 && aus.radios.every(Boolean) && aus.still && !aus.reihe && /no shared casts/.test(aus.band),
      "14.8 Mitglied ohne geteilte Einsaetze: der Umschalter ist aus wie das Tempo, statt der Reihe die leere Leiste mit ihrem Satz", aus);
    // ein Mitglied mit geteilten Einsaetzen: der Umschalter geht wieder, die gewaehlte Reihenfolge zeigt genau diese vier
    await p.evaluate(() => [...document.querySelectorAll("#rotWho [data-wer]")].find((x) => x.dataset.wer === "Mitglied Zwei")?.click());
    await p.waitForFunction(() => document.querySelectorAll("#drReihe .drk").length === 4, null, { timeout: 5000 }).catch(() => {});
    const an = await p.evaluate(() => ({ radios: [...document.querySelectorAll("#drAnsicht [role=radio]")].map((b) => b.disabled),
      reihe: !document.querySelector("#drFolge").hidden, n: document.querySelectorAll("#drReihe .drk").length }));
    assert(an.radios.every((d) => !d) && an.reihe && an.n === 4 && !s.fehler.length,
      "14.8 Mitglied mit geteilten Einsaetzen: der Umschalter geht wieder, die Reihenfolge zeigt genau die vier; keine Fehler", { an, fehler: s.fehler });
    await p.close();
  }
  // ===== Abschnitt 15: Builds als Links zu Questlog (Nachtrag 29.09., Aufgabe 12) =====
  /* 15.0: Proben bleibender Funktionen aus den Tests, die mit Aufgabe 12 entfallen (test-builds-page,
     test-steckbrief-page), hierher umgezogen (Spezifikation 3, "erst Proben umziehen"). Sie pruefen, was
     ohne die alte Oberflaeche bleibt: die Builderkennung je Kampf (Feld b im Verlaufsverzeichnis), Lesen
     vor Schreiben bei boro-builds.json, Treffer/kritisch/schwer/verfehlt je Kampf, den Hinweis im
     Vergleich, die Uebungspuppe im Verzeichnis und nicht im Verlauf, den Verlauf im Beispiel und in
     Deutsch, Kompakt ohne Bereiche. Gleich streng wie dort; wo dort die Karte eines Builds gefragt wurde,
     fragt die Probe hier das Verzeichnis und den Speicher (die Karte gibt es mit Aufgabe 12 nicht mehr). */
  /* Ein Build ist ein Muster aus Faehigkeiten mit Gewichten (aus test-builds-page.mjs): sechs mit Gewicht 4
     tragen 86 % des Schadens. A: Armbrust und Langbogen. A2: wie A, Blitzpfeil durch Pfeilwirbel ersetzt -
     fuenf von sechs gemeinsam, derselbe Build. B: Armbrust und Dolch - ein anderer. */
  const QF15 = ["Quick Fire", 964762401], DM15 = ["Detonation Mark", 953174691], BS15 = ["Blade Storm", 945408027];
  const ST15 = ["Strafing", 945674044], BR15 = ["Brutal Arrow", 945725019], FL15 = ["Flash Arrow", 945731619];
  const AV15 = ["Arrow Vortex", 945743775], AG15 = ["Agile Shot", 944723371];
  const FS15 = ["Fatal Stigma", 939780553], TS15 = ["Thunder Spirit", 940580872], VS15 = ["Vampiric Strike", 940620545];
  const LT15 = ["Lightning Throw", 940614453], MS15 = ["Mad Sword Dance", 940624689];
  const muster15 = (g) => g.flatMap(([sk, n]) => Array(n).fill(sk));
  const BAU_A = muster15([[QF15, 4], [DM15, 4], [BS15, 4], [ST15, 4], [BR15, 4], [FL15, 4], [AG15, 2], [AV15, 2]]);
  const BAU_A2 = muster15([[QF15, 4], [DM15, 4], [BS15, 4], [ST15, 4], [BR15, 4], [AV15, 4], [AG15, 2], [FL15, 2]]);
  const BAU_B = muster15([[QF15, 4], [DM15, 4], [BS15, 4], [FS15, 4], [TS15, 4], [VS15, 4], [LT15, 2], [MS15, 2]]);
  const tag15 = (d, h, m) => Date.UTC(2026, 8, d, h, m, 0);
  /* Alle 0,5 s ein Treffer, das Muster im Kreis, der Schaden in fuenf Stufen; mit n, miss, crit, heavy
     (aus test-steckbrief-page.mjs) stimmen die Zaehlungen genau: miss davon kMiss, crit kritisch, heavy schwer. */
  function pulls15(pulls) {
    const lines = ["CombatLogVersion,4"];
    for (const p of pulls) {
      const n = p.n ?? Math.ceil(p.secs * 2), miss = p.miss ?? 0, crit = p.crit ?? 0, heavy = p.heavy ?? 0;
      const fehl = new Set(Array.from({ length: miss }, (_, i) => Math.floor((i + 1) * n / (miss + 1))));
      let j = 0;
      for (let k = 0; k < n; k++) {
        const [skill, sid] = p.bau[k % p.bau.length];
        if (fehl.has(k)) { lines.push(`${stamp(p.start + k * 500)},DamageDone,${skill},${sid},0,0,0,kMiss,Tester,${p.target}`); continue; }
        const c = j < crit ? 1 : 0, h = n - miss - 1 - j < heavy ? 1 : 0;
        lines.push(`${stamp(p.start + k * 500)},DamageDone,${skill},${sid},${Math.round(1000 * (p.scale ?? 1) * (1 + (k % 5)))},${c},${h},kNormalHit,Tester,${p.target}`);
        j++;
      }
    }
    return lines.join("\n") + "\n";
  }
  const log15 = (name, pulls) => { const f = join(work, name); writeFileSync(f, pulls15(pulls)); return f; };
  const V15 = (bau, d, h, m, scale) => ({ target: "Vulcanus", bau, start: tag15(d, h, m), secs: 80, scale });
  const L15_A = log15("b15-a.txt", [V15(BAU_A, 17, 21, 0, 1.2)]);
  const L15_B = log15("b15-b.txt", [V15(BAU_B, 18, 21, 0, 1.0)]);
  const L15_A2 = log15("b15-a2.txt", [V15(BAU_A2, 19, 21, 0, 1.1), V15(BAU_A2, 19, 21, 10, 1.3), V15(BAU_A2, 19, 21, 20, 1.0)]);
  const L15_PUPPE = log15("b15-puppe.txt", [{ target: "Practice Dummy", bau: BAU_A, start: tag15(20, 20, 0), secs: 62, scale: 1.0 }]);
  // 600 + 400 Zeilen: 334 + 223 = 557 kritisch, 280 + 187 = 467 schwer, 2 + 1 = 3 verfehlt - von 1000
  const L15_ZAHLEN = log15("b15-zahlen.txt", [{ target: "Vulcanus", bau: BAU_A, start: tag15(17, 21, 0), n: 600, miss: 2, crit: 334, heavy: 280 },
                                              { target: "Vulcanus", bau: BAU_A, start: tag15(17, 21, 20), n: 400, miss: 1, crit: 223, heavy: 187 }]);
  /* Ein Log laden, das nicht das erste ist: warten, bis der Kopf das Ziel nennt und das Verzeichnis
     (POST /api/config mit logIndex) die Kaempfe dieses Logs traegt. */
  const index15 = (s) => { const x = s.posts.filter((b) => b.logIndex).pop(); return x ? x.logIndex : null; };
  const kaempfe15 = (s) => Object.values(index15(s) || {}).flatMap((f) => f.fights || []).sort((a, b) => a.at - b.at);
  const warte15 = async (p, bedingung, ms = 20000) => { for (const ende = Date.now() + ms; Date.now() < ende && !bedingung(); ) await p.waitForTimeout(100); return bedingung(); };
  const laden15 = async (s, datei, ziel, anzahl) => {
    await s.page.setInputFiles("#fileInput", datei);
    await s.page.waitForFunction((z) => !document.querySelector("#app").hidden && (document.querySelector("#hName")?.textContent || "").includes(z), ziel, { timeout: 20000 });
    if (anzahl) await warte15(s.page, () => kaempfe15(s).length >= anzahl);
  };

  // --- 15.0.1 (aus test-builds-page 7 und test-steckbrief-page 1): erst lesen, dann schreiben; je Kampf b und vier ganze Zahlen
  {
    const lager = { builds: {}, plans: {}, gesperrt: true, ereignisse: [], abruf: () => ({ ok: false, error: "timeout" }) };
    const s = await oeffne({ lager });
    const p = s.page;
    await laden15(s, L15_ZAHLEN, "Vulcanus", 2);
    await p.waitForTimeout(1500);   // ein Takt Zeit, in dem ein falscher POST kaeme - geprueft wird der Zustand danach
    assert(lager.ereignisse.length >= 1 && lager.ereignisse.every((e) => e === "GET 503"), "15.0.1 Lesen gescheitert (503): kein Build geschrieben", lager.ereignisse);
    assert(kaempfe15(s).length === 2 && kaempfe15(s).every((f) => !f.b), "15.0.1 Lesen gescheitert: das Verzeichnis traegt noch keinen Build", kaempfe15(s));
    lager.gesperrt = false;
    await warte15(p, () => lager.ereignisse.some((e) => e.startsWith("POST")) && kaempfe15(s).every((f) => f.b), 30000);
    const ersterOk = lager.ereignisse.indexOf("GET 200"), ersterPost = lager.ereignisse.findIndex((e) => e.startsWith("POST"));
    assert(ersterOk >= 0 && ersterPost > ersterOk, "15.0.1 erst nach einem gelungenen Lesen wird ein Build geschrieben", lager.ereignisse);
    const f = kaempfe15(s);
    assert(f.length === 2 && f.every((x) => /^[0-9a-z]{10}$/.test(x.b || "")) && f[0].b === f[1].b, "15.0.1 danach traegt jeder Kampf im Verzeichnis seinen Build (b), beide denselben", f);
    assert(lager.ereignisse.includes("POST " + f[0]?.b) && Object.keys(lager.builds).length === 1 && !!lager.builds[f[0]?.b],
      "15.0.1 geschrieben wird der Build, den das Verzeichnis nennt, genau einer", { e: lager.ereignisse, builds: Object.keys(lager.builds) });
    const zahlen = f.map((x) => [x.hits, x.crit, x.heavy, x.miss]);
    assert(JSON.stringify(zahlen) === "[[600,334,280,2],[400,223,187,1]]", "15.0.1 je Kampf Treffer, kritisch, schwer, verfehlt als ganze Zahlen", zahlen);
    assert(!s.fehler.length, "15.0.1 keine Fehler", s.fehler);
    await p.close();
  }

  // --- 15.0.2 (aus test-builds-page 1 bis 5): Waffenerkennung, der Hinweis im Vergleich, die Uebungspuppe
  {
    const lager = { builds: {}, plans: {}, ereignisse: [], abruf: () => ({ ok: false, error: "timeout" }) };
    const s = await oeffne({ lager });
    const p = s.page;
    await laden15(s, L15_A, "Vulcanus", 1);
    await laden15(s, L15_B, "Vulcanus", 2);
    // Build B ist schwaecher als der beste Pull aus Build A: der Vergleich sagt es
    await bereich(p, "compare");
    await p.waitForFunction(() => (document.querySelector("#cmpBest")?.textContent || "").includes("different build"), null, { timeout: 10000 }).catch(() => {});
    const hinweis = await p.evaluate(() => document.querySelector("#cmpBest")?.textContent || "");
    assert(hinweis.includes("Your best pull comes from a different build (Longbow/Crossbow 1)."), "15.0.2 der beste Pull stammt aus einem anderen Build: der Vergleich sagt es", hinweis);
    await laden15(s, L15_A2, "Vulcanus", 5);
    await warte15(p, () => kaempfe15(s).every((x) => x.b));
    const f = kaempfe15(s);
    const [a, b, ...a2] = f;
    assert(f.length === 5 && !!a.b && a2.every((x) => x.b === a.b) && !!b.b && b.b !== a.b,
      "15.0.2 A2 (fuenf von sechs gemeinsam) zaehlt zu Build A, B ist ein anderer Build", f.map((x) => x.b));
    // geschrieben wird gebuendelt, nach drei Sekunden (planeSchreiben in 47-builds.ts)
    await warte15(p, () => Object.keys(lager.builds).length >= 2, 10000);
    const paare = Object.values(lager.builds).map((x) => [...x.weapons].sort().join("+")).sort();
    assert(Object.keys(lager.builds).length === 2 && JSON.stringify(paare) === JSON.stringify(["Crossbow+Dagger", "Crossbow+Longbow"]),
      "15.0.2 zwei Builds gespeichert: Armbrust und Langbogen, Armbrust und Dolch", paare);
    // die Uebungspuppe: im Verzeichnis mit ihrer Laengenklasse und dem Build A, im Verlauf nicht
    await bereich(p, "history");
    const verlauf = () => p.evaluate(() => document.querySelector("#histNote").textContent + " | " +
      [...document.querySelectorAll("#histBoss option")].map((o) => o.textContent).join(",") + " | " +
      (document.querySelector("#histDetail tbody")?.textContent || ""));
    const vorher = await verlauf();
    await laden15(s, L15_PUPPE, "Practice Dummy", 6);
    await warte15(p, () => kaempfe15(s).some((x) => x.c === 60 && x.b));
    const puppe = kaempfe15(s).find((x) => x.c === 60);
    assert(!!puppe && puppe.b === a.b, "15.0.2 die Puppe steht im Verzeichnis beim Build A, mit ihrer Laenge (60 s)", puppe);
    await bereich(p, "history");
    const nachher = await verlauf();
    assert(!nachher.includes("Practice") && nachher === vorher, "15.0.2 der Verlauf zeigt die Puppe nicht und bleibt, wie er war", { vorher, nachher });
    assert(!s.fehler.length, "15.0.2 keine Fehler", s.fehler);
    await p.close();
  }

  // --- 15.0.3 (aus test-builds-page 0 und 6): der Verlauf im Beispiel, Deutsch, Kompakt
  {
    const s = await oeffne({});
    const p = s.page;
    await beispiel(p);
    const leiste = await p.evaluate(() => ({ verlauf: !!document.querySelector('#bereiche [data-tab="history"]')?.offsetParent,
      progress: !!document.querySelector('[data-tab="progress"]') || !!document.querySelector("#p-progress") }));
    assert(leiste.verlauf && !leiste.progress, "15.0.3 der Bereich Verlauf steht in der Leiste, einen Bereich Progress gibt es nicht", leiste);
    await bereich(p, "history");
    const txt = (q) => p.evaluate((x) => document.querySelector(x)?.textContent || "", q);
    assert((await txt("#bkHinweis")).includes("nobody's performance") && (await txt("#histNote")).includes("your builds from your first")
      && (await txt("#histAkt")).includes("Open logs"),
      "15.0.3 Beispiel: die Kopfzeile sagt warum, der Verlauf, ab wann ein Build erscheint, und traegt Open logs", [await txt("#bkHinweis"), await txt("#histNote")]);
    await p.evaluate(() => document.querySelector("#btnLang").click());
    await p.waitForFunction(() => (document.querySelector('[data-tab="history"] .vh')?.textContent || "").trim() === "Verlauf", null, { timeout: 5000 }).catch(() => {});
    assert((await txt('[data-tab="history"] .vh')).trim() === "Verlauf" && (await txt('[data-tab="history"] .btip')).trim() === "Verlauf",
      "15.0.3 Deutsch: der Bereich heisst Verlauf (Name und Blase)");
    await p.evaluate(() => document.querySelector("#btnCompact").click());
    await p.waitForFunction(() => document.body.classList.contains("compact"), null, { timeout: 5000 }).catch(() => {});
    assert(await p.evaluate(() => !document.querySelector('[data-tab="history"]')?.offsetParent && !document.querySelector("#bauBody")?.offsetParent),
      "15.0.3 Kompakt: kein Bereich Verlauf, keine Builds");
    await p.evaluate(() => document.querySelector("#btnCompact").click());
    assert(!s.fehler.length, "15.0.3 keine Fehler", s.fehler);
    await p.close();
  }

  /* 15.1 bis 15.12: der Bereich Builds nach Aufgabe 12 (Entscheidung 29.09., Variante C). Oben ein Feld
     "Questlog-Link einfuegen", dazu ein Name (optional) und "Speichern"; je Link eine Karte mit Waffensymbolen,
     Name, "Langbogen und Armbrust \u00b7 zuletzt gespielt 18.09.", "In Questlog oeffnen" und bis zu drei Bossen mit
     Median und Kampfzahl ueber dieselben Waffen aus dem Verzeichnis. Die Karte mit den Waffen des offenen
     Kampfs ist golden umrandet, steht oben und traegt "im offenen Kampf"; ohne Kaempfe ein Satz; gleiche
     Waffen bei zwei Karten: der Hinweis bei beiden und dieselben Zahlen; "Loesen" mit Rueckgaengig; im Kampf
     ein leiser Link "Build in Questlog \u203a". Gespeichert wird in boro-plans.json nur Link, Waffen und der
     eigene Name - Questlogs Buildname lebt nur in der Sitzung. Hier auch, was aus test-plan-page
     bleibt (Linkpruefung ohne Anfrage, Auswahl bei mehreren Builds, Fehler, nichts gespeichert, Neustart,
     Loesen und Rueckgaengig), gleich streng an der neuen Oberflaeche. */
  const Q15 = "https://questlog.gg/throne-and-liberty/";
  const CHAR15 = Q15 + "character-builder/TestChar";
  const OWNER15 = Q15 + "en/character-builder/TestChar?build-id=500441&buildId=8498235";
  const B15 = { bA: "aaaaaaaaaa", bB: "bbbbbbbbbb", bC: "cccccccccc" };
  const baue15 = () => ({
    [B15.bA]: { name: "", weapons: ["Longbow", "Crossbow"], core: ["x1", "x2", "x3", "x4"], first: 1 },
    [B15.bB]: { name: "", weapons: ["Dagger", "Crossbow"], core: ["y1", "y2", "y3", "y4"], first: 2 },
    // derselbe Waffensatz wie bA, ein anderer Build aus dem Log: seine Kaempfe zaehlen fuer dieselben Waffen mit
    [B15.bC]: { name: "", weapons: ["Crossbow", "Longbow"], core: ["z1", "z2", "z3", "z4"], first: 3 },
  });
  /* Das Verzeichnis: King Khanzaizin 19-mal (15 mit bA, 4 mit bC), Vulcanus 4-mal, Tevent 2-mal, Kowazan einmal
     mit Langbogen und Armbrust - drei Bosse zeigt die Karte, die meisten Kaempfe zuerst; Vulcanus 3-mal mit
     Dolch und Armbrust; eine Uebungspuppe (c) mit bA am 20.09. - sie ist kein Boss, aber gespielt. */
  const kk15 = [200, 205, 210, 215, 220, 222, 224, 225, 226, 226.5, 227, 228, 229, 230, 231, 233, 235, 236, 238].map((k) => k * 1000);
  const f15 = (name, b, dps, d, h, extra = {}) => ({ name, dps, dmg: dps * 60, dur: 60, at: tag15(d, h, 0), b, ...extra });
  const INDEX15 = { "TLCombatLog-20260915.txt": { size: 1, fights: [
    ...kk15.map((dps, i) => f15("King Khanzaizin", i < 15 ? B15.bA : B15.bC, dps, 15 + (i % 3), 20)),
    ...[180, 190, 200, 210].map((k) => f15("Vulcanus", B15.bA, k * 1000, 16, 21)),
    f15("Tevent", B15.bA, 150000, 16, 22), f15("Tevent", B15.bA, 160000, 18, 22),
    f15("Kowazan", B15.bA, 90000, 17, 23),
    ...[120, 130, 140].map((k) => f15("Vulcanus", B15.bB, k * 1000, 14, 21)),
    f15("Practice Dummy", B15.bA, 50000, 20, 19, { c: 60 }),
  ] } };
  /* boro-plans.json: ein alter Plan (vor Aufgabe 12, mit allem, was er damals trug), zwei neue Eintraege, einer
     mit denselben Waffen wie der alte, einer ohne Kaempfe, und ein geloester. */
  const pl15 = () => ({
    palt000001: { link: CHAR15 + "?buildId=11", at: tag15(10, 12, 0), name: "Raid", bau: B15.bA, weapons: ["Longbow", "Crossbow"],
      active: [{ id: "SkillSet_A", lvl: 20, traits: [] }], passive: [], mastery: [], gear: { main_hand: "item_a" }, keys: { SkillSet_A: "Quick Fire" },
      sheet: { slots: {}, sets: [], fmt: {} } },
    pneu000001: { link: Q15 + "skill-builder/SAA2YXzmmVK4?build-id=749549", at: tag15(12, 12, 0), name: "Burst", weapons: ["Dagger", "Crossbow"] },
    pneu000002: { link: Q15 + "weapon-mastery/SAA2YXzmmVK4?build-id=500441", at: tag15(13, 12, 0), name: "Zwilling", weapons: ["Crossbow", "Longbow"] },
    pneu000003: { link: Q15 + "skill-builder/SAA2YXzmmVK4?build-id=749550", at: tag15(11, 12, 0), name: "Heiler", weapons: ["Staff", "Wand and Tome"] },
    pneu000004: { link: Q15 + "skill-builder/SAA2YXzmmVK4?build-id=749551", at: tag15(9, 12, 0), name: "Weg", weapons: ["Spear", "Dagger"], geloest: tag15(14, 12, 0) },
  });
  // der gestellte Abruf: ein Charakter mit zwei Builds, Questlogs Namen "Raid"/"PvP"/"Borometer"
  const abrufe15 = [];
  const abruf15 = (b) => {
    abrufe15.push(b);
    if (b.link.startsWith(CHAR15) && !/buildId=/.test(b.link) && b.pick == null) return { ok: true, choose: [{ id: 11, name: "Raid" }, { id: 12, name: "PvP" }] };
    const id = b.pick ?? (Number((/buildId=(\d+)/.exec(b.link) || [])[1]) || 11);
    const waffen = id === 12 ? ["Dagger", "Staff"] : ["Longbow", "Crossbow"];
    return { ok: true, plan: { link: b.link, buildId: id, name: id === 12 ? "PvP" : id === 8498235 ? "Borometer" : "Raid", weapons: waffen,
      active: [{ id: "SkillSet_A", lvl: 20, traits: [] }], passive: [], mastery: [], gear: { main_hand: "item_a" } },
      names: { skills: { SkillSet_A: { name: "Questlog Skill", icon: "/x/S_A.S_A" } }, traits: {}, mastery: {}, gear: { item_a: "Questlog Bogen" }, sets: {}, stats: {}, perks: {} },
      gear: { equip: {}, items: {}, runes: {}, syn: [], fmt: {}, mast: {} }, requests: 3 };
  };
  const lager15 = (extra = {}) => ({ builds: baue15(), plans: pl15(), ereignisse: [], planPosts: [], abruf: abruf15, ...extra });
  const zuBuilds15 = async (s) => {
    await bereich(s.page, "builds");
    await s.page.waitForFunction(() => document.querySelectorAll("#bauBody .qlkarte").length > 0 || !!document.querySelector("#bauBody .qlnoch"), null, { timeout: 20000 }).catch(() => {});
  };
  /* Was der Bereich Builds zeigt. */
  const blick15 = (p) => p.evaluate(() => {
    const q = (x) => document.querySelector(x);
    const r = (e) => e && e.getClientRects().length ? e.getBoundingClientRect().toJSON() : null;
    const sicht = (e) => !!e && e.getClientRects().length > 0 && getComputedStyle(e).visibility !== "hidden";
    const lbl = (id) => (q(`label[for="${id}"]`)?.textContent || "").trim();
    const klein = [];
    for (const wurzel of [q("#p-builds"), q("#bereichKopf")].filter(Boolean)) {
      const it = document.createTreeWalker(wurzel, NodeFilter.SHOW_TEXT);
      for (let n; (n = it.nextNode()); ) {
        const e = n.parentElement;
        if (!n.textContent.trim() || !e || e.closest(".vh") || !sicht(e)) continue;
        const g = parseFloat(getComputedStyle(e).fontSize);
        if (g < 11) klein.push(n.textContent.trim().slice(0, 24) + ":" + g);
      }
    }
    const karte = (k) => {
      const cs = getComputedStyle(k), a = k.querySelector("a.qloffnen");
      return {
        id: k.id, name: (k.querySelector("h3")?.textContent || "").trim(), h3fokus: k.querySelector("h3")?.getAttribute("tabindex"),
        icons: k.querySelectorAll(".qlpaar .wic").length, paarName: k.querySelector(".qlpaar")?.getAttribute("aria-label") || "",
        paarRolle: k.querySelector(".qlpaar")?.getAttribute("role") || "",
        zeile: (k.querySelector(".qlzeile")?.textContent || "").replace(/\s+/g, " ").trim(),
        gleich: (k.querySelector(".qlgleich")?.textContent || "").trim(),
        bosse: [...k.querySelectorAll(".qlbosse li")].map((li) => li.textContent.replace(/\s+/g, " ").trim()),
        bossTag: k.querySelector(".qlbosse")?.tagName || "",
        leer: (k.querySelector(".qlleer")?.textContent || "").trim(),
        offen: k.classList.contains("offen"), schild: (k.querySelector(".qlschild")?.textContent || "").trim(),
        link: a ? { href: a.getAttribute("href"), target: a.target, rel: a.rel, text: a.textContent.trim(), title: a.title, name: a.getAttribute("aria-label") || "" } : null,
        los: (k.querySelector("[data-ql-los]")?.textContent || "").trim(), losName: k.querySelector("[data-ql-los]")?.getAttribute("aria-label") || "",
        zurueck: (k.querySelector("[data-ql-zurueck]")?.textContent || "").trim(), zurueckName: k.querySelector("[data-ql-zurueck]")?.getAttribute("aria-label") || "",
        rand: cs.borderTopColor, randBreite: parseFloat(cs.borderTopWidth), schatten: cs.boxShadow,
        pad: Math.min(parseFloat(cs.paddingTop), parseFloat(cs.paddingLeft)), box: r(k),
      };
    };
    // die Karten der Liste; geloeste (Fixrunde 1) stehen aufgeklappt darunter, getrennt gezaehlt
    const karten = [...document.querySelectorAll("#bauBody .qlkarte:not(.geloest)")].map(karte);
    const geloeste = [...document.querySelectorAll("#bauBody .qlkarte.geloest")].map(karte);
    const zeige = q("#bauBody [data-ql-zeige]");
    const gold = (() => { const pr = document.createElement("span"); pr.style.color = "var(--gold-ink)"; document.body.append(pr); const c = getComputedStyle(pr).color; pr.remove(); return c; })();
    return {
      panel: q(".panel.on")?.id || "", bauSicht: sicht(q("#bauBody")), titel: (q("#bauBody h2, #bauBody h3.vh, #qlTitel")?.textContent || "").trim(),
      form: !!q("#bauBody form#qlForm"), linkLabel: lbl("qlLink"), nameLabel: lbl("qlName"), linkTyp: q("#qlLink")?.type || "",
      speichern: (q("#qlForm button[type=submit]")?.textContent || "").trim(), status: (q("#qlStatus")?.textContent || "").trim(),
      hinweis: (q("#qlHinweis")?.textContent || "").trim(),
      alt: [".bkarte", ".planblock", ".stbrief", ".bauneu", ".bauform", ".bautab", ".baukenn", "[data-edit]", "[data-plan-toggle]", ".planimport"]
        .filter((x) => q("#p-builds " + x)),
      text: q("#p-builds")?.innerText || "", ctx: (q("#bkCtx")?.textContent || "").trim(),
      karten, geloeste, zeige: zeige ? { text: zeige.textContent.trim(), auf: zeige.getAttribute("aria-expanded") } : null,
      gold, geloest: (q("#bauBody .qlgeloest")?.textContent || "").replace(/\s+/g, " ").trim(),
      noch: (q("#bauBody .qlnoch")?.textContent || "").trim(),
      quer: document.documentElement.scrollWidth > innerWidth, klein, rollt: document.documentElement.scrollHeight - innerHeight,
    };
  });
  const kampfLink15 = (p) => p.evaluate(() => { const a = document.querySelector("#kampfQuestlog");
    return a ? { da: !a.hidden && a.getClientRects().length > 0, href: a.getAttribute("href"), target: a.target, rel: a.rel, text: a.textContent.trim(),
      name: a.getAttribute("aria-label") || "", imUrteil: !!a.closest("#urteilFeld .uknoepfe"), tag: a.tagName } : null; });
  const median15 = (xs) => { const s = [...xs].sort((a, b) => a - b), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

  // --- 15.1 bis 15.4: der Bereich, die Karten, ihre Zahlen, der leere und der doppelte Fall (Englisch)
  {
    const lager = lager15();
    const s = await oeffne({ app: true, lager, config: { logIndex: INDEX15 } });
    const p = s.page;
    await beispiel(p);
    await zuBuilds15(s);
    let b = await blick15(p);
    assert(b.panel === "p-builds" && b.bauSicht && b.form && b.linkLabel === "Paste a Questlog link" && b.nameLabel === "Name (optional)" &&
      b.speichern === "Save" && b.linkTyp === "url",
      "15.1 oben das Feld \u201ePaste a Questlog link\u201c mit Name (optional) und \u201eSave\u201c", { form: b.form, l: b.linkLabel, n: b.nameLabel, s: b.speichern });
    assert(!b.alt.length && !/Rename or link|New build|too few fights|Equipment|Level|Hit rates|Open planner|Close plan|Recognised by/.test(b.text),
      "15.1 entfallen: Steckbrief, Planer, Ausruestung, Stufen, Trefferquoten, \u201eNew build\u201c, \u201eRename or link\u201c, \u201etoo few fights\u201c", { alt: b.alt, text: b.text.slice(0, 300) });
    assert(b.ctx === "4 builds \u00b7 links to Questlog", "15.1 Kopfzeile: vier Builds, Links zu Questlog", b.ctx);
    const namen = b.karten.map((k) => k.name);
    assert(b.karten.length === 4 && !namen.includes("Weg") && ["Raid", "Burst", "Zwilling", "Heiler"].every((n) => namen.includes(n)),
      "15.2 je Eintrag eine Karte, auch der alte Plan; der geloeste steht nicht da", namen);
    const k = Object.fromEntries(b.karten.map((x) => [x.name, x]));
    const raid = k.Raid;
    assert(raid && raid.icons === 2 && raid.paarRolle === "img" && raid.paarName === "Longbow + Crossbow" && raid.zeile === "Longbow and Crossbow \u00b7 last played 20/09",
      "15.2 Karte: zwei Waffensymbole (fuer den Vorleser benannt), Name, \u201eLongbow and Crossbow \u00b7 last played 20/09\u201c (die Puppe zaehlt als gespielt)", raid);
    assert(raid && raid.link && raid.link.href === CHAR15 + "?buildId=11" && raid.link.target === "_blank" && raid.link.rel === "noopener noreferrer" &&
      raid.link.text === "Open in Questlog" && /browser/.test(raid.link.title) &&
      // Fixrunde 1 (Befund 10): fuer den Vorleser mit dem Namen der Karte
      raid.link.name === "Open \u201cRaid\u201d in Questlog" && raid.losName === "Detach \u201cRaid\u201d",
      "15.2 \u201eOpen in Questlog\u201c ist ein Link nach draussen (neues Fenster, ohne Opener), Borometer laedt ihn nie", raid?.link);
    const khz = median15(kk15), vul = median15([180, 190, 200, 210].map((x) => x * 1000));
    const fmt15 = (v) => (v / 1000).toFixed(1) + "k";   // fmt() in 03-helpers.ts: Kurzzahl mit Punkt, eine Stelle
    assert(raid && raid.bossTag === "UL" && JSON.stringify(raid.bosse) === JSON.stringify(["King Khanzaizin " + fmt15(khz) + " \u00b7 19 fights",
      "Vulcanus " + fmt15(vul) + " \u00b7 4 fights", "Tevent \u00b7 2 fights"]),
      "15.3 bis zu drei Bosse, die meisten Kaempfe zuerst: Median und Kampfzahl ueber dieselben Waffen (auch aus einem zweiten Build), unter drei Kaempfen ohne Median; die Puppe ist kein Boss",
      raid?.bosse);
    assert(fmt15(khz) === "226.5k", "15.3 der Median von King Khanzaizin ist 226.5k, wie in der Skizze", fmt15(khz));
    assert(k.Burst && JSON.stringify(k.Burst.bosse) === JSON.stringify(["Vulcanus 130.0k \u00b7 3 fights"]) && !k.Burst.gleich && !k.Burst.leer,
      "15.3 Dolch und Armbrust: ein Boss mit Median und Kampfzahl", k.Burst);
    assert(k.Heiler && !k.Heiler.bosse.length && k.Heiler.leer === "No fights with these weapons yet." && k.Heiler.zeile === "Staff and Wand and Tome",
      "15.3 ohne Kaempfe: der Satz statt der Bosse, kein \u201elast played\u201c", k.Heiler);
    assert(k.Raid?.gleich === "same weapons as \u201cZwilling\u201d" && k.Zwilling?.gleich === "same weapons as \u201cRaid\u201d" &&
      JSON.stringify(k.Raid.bosse) === JSON.stringify(k.Zwilling.bosse) && k.Raid.zeile === k.Zwilling.zeile.replace("Crossbow and Longbow", "Longbow and Crossbow"),
      "15.4 gleiche Waffen: bei beiden der Hinweis auf die andere, beide mit denselben Zahlen", { raid: k.Raid, zw: k.Zwilling });
    assert(b.karten.length === 4 && b.karten.every((x) => !x.offen && !x.schild), "15.5 ohne offenen Kampf mit diesen Waffen: keine Karte hervorgehoben", b.karten.map((x) => [x.name, x.offen]));
    assert(b.karten.length === 4 && b.karten.every((x) => x.los === "Detach" && x.h3fokus === "-1" && x.pad >= 8), "15.2 je Karte \u201eDetach\u201c; die Ueberschrift nimmt den Fokus; Innenabstand mindestens 8", b.karten.map((x) => [x.los, x.pad]));
    assert(!s.fehler.length, "15.1-15.4 keine Fehler", s.fehler);
    await p.close();
  }

  // --- 15.5 und 15.6: der offene Kampf - die Karte oben, golden umrandet, mit Schild; im Kampf der leise Link
  {
    const lager = lager15();
    const s = await oeffne({ app: true, lager, config: { logIndex: INDEX15 } });
    const p = s.page;
    await laden15(s, L15_A, "Vulcanus");
    const kl = await kampfLink15(p);
    assert(kl && kl.tag === "A" && kl.da && kl.imUrteil && kl.text === "Build in Questlog \u203a" && kl.href === pl15().pneu000002.link &&
      kl.target === "_blank" && kl.rel === "noopener noreferrer" && kl.name.includes("Zwilling"),
      "15.6 im Kampf: der leise Link \u201eBuild in Questlog \u203a\u201c neben den Knoepfen des Urteils, zur passenden Karte (die zuletzt gespeicherte), mit ihrem Namen fuer den Vorleser", kl);
    await zuBuilds15(s);
    const b = await blick15(p);
    const offen = b.karten.filter((x) => x.offen);
    assert(offen.length === 2 && b.karten[0].offen && b.karten[1].offen && offen.every((x) => x.schild === "in the open fight") &&
      b.karten.filter((x) => !x.offen).every((x) => !x.schild),
      "15.5 die Karten mit den Waffen des offenen Kampfs stehen oben und tragen \u201ein the open fight\u201c", b.karten.map((x) => [x.name, x.offen, x.schild]));
    assert(offen.length === 2 && offen.every((x) => x.rand === b.gold && x.randBreite >= 1) && b.karten.filter((x) => !x.offen).every((x) => x.rand !== b.gold) &&
      offen.every((x) => x.schatten === b.karten.find((y) => !y.offen)?.schatten),
      "15.5 golden umrandet (--gold-ink, im hellen Thema dunkler), die anderen nicht; kein Leuchten: derselbe Schatten wie die anderen Karten", { gold: b.gold, karten: b.karten.map((x) => [x.name, x.rand, x.schatten]) });
    assert(!s.fehler.length, "15.5/15.6 keine Fehler", s.fehler);
    await p.close();
    // ein offener Kampf ohne passende Karte: kein Link im Kampf, keine Karte hervorgehoben
    const nur = lager15({ plans: { pneu000003: pl15().pneu000003 } });
    const s2 = await oeffne({ app: true, lager: nur, config: { logIndex: INDEX15 } });
    await laden15(s2, L15_A, "Vulcanus");
    const kl2 = await kampfLink15(s2.page);
    await zuBuilds15(s2);
    const b2 = await blick15(s2.page);
    assert(kl2 && !kl2.da && b2.karten.length === 1 && !b2.karten[0].offen, "15.6 ohne passende Karte: kein Link im Kampf, nichts hervorgehoben", { kl2, k: b2.karten });
    await s2.page.close();
  }

  // --- 15.7: Einfuegen - Pruefung ohne Anfrage, Auswahl, nur Link, Waffen und eigener Name gespeichert
  {
    abrufe15.length = 0;
    const lager = lager15({ plans: {} });
    const s = await oeffne({ app: true, lager });
    const p = s.page;
    await beispiel(p);
    await zuBuilds15(s);
    let b = await blick15(p);
    assert(!b.karten.length && b.noch.startsWith("No links yet."), "15.7 ohne Eintraege: ein Satz, wie es geht, keine Karte", b.noch);
    const einfuegen = async (link, name = "") => {
      await p.fill("#qlLink", link);
      await p.fill("#qlName", name);
      await p.press("#qlLink", "Enter");
    };
    const status = async (text) => { await p.waitForFunction((t) => (document.querySelector("#qlStatus")?.textContent || "").includes(t), text, { timeout: 5000 }).catch(() => {}); return (await blick15(p)).status; };
    // seltsame Links, ein Builder-Link ohne Nummer und ein fremder Planer: die Seite sagt es sofort, keine Anfrage
    for (const [link, satz] of [["https://Questlog.gg/throne-and-liberty/character-builder/TestChar", "Only links from questlog.gg"],
      ["https://questlog.gg:443/throne-and-liberty/character-builder/TestChar", "Only links from questlog.gg"],
      [Q15 + "skill-builder/SAA2YXzmmVK4", "This link does not say which build"],
      ["https://maxroll.gg/tl/build/x", "Only links from questlog.gg"]]) {
      await einfuegen(link);
      const st = await status(satz);
      assert(st.startsWith(satz) && abrufe15.length === 0 && !Object.keys(lager.plans).length, "15.7 " + link.slice(8, 60) + ": der Satz, keine Anfrage, nichts gespeichert", { st, abrufe: abrufe15.length });
    }
    // ein Charakter mit zwei Builds: die Seite fragt, der zweite Abruf nennt die Wahl
    await einfuegen(CHAR15, "  Night  ");
    await p.waitForFunction(() => !!document.querySelector("#qlForm fieldset legend"), null, { timeout: 10000 }).catch(() => {});
    const legende = await p.evaluate(() => document.querySelector("#qlForm fieldset legend")?.textContent || "");
    assert(legende.includes("several builds") && abrufe15.length === 1 && abrufe15[0].pick == null && abrufe15[0].lang === "en" && abrufe15[0].link === CHAR15,
      "15.7 zwei Builds: die Seite fragt, welcher", { legende, abrufe: abrufe15 });
    await p.check('#qlForm input[type=radio][value="12"]');
    await p.click("#qlForm [data-ql-wahl]");
    await p.waitForFunction(() => [...document.querySelectorAll("#bauBody .qlkarte h3")].some((h) => h.textContent.trim() === "Night"), null, { timeout: 10000 }).catch(() => {});
    const ids = Object.keys(lager.plans), e = lager.plans[ids[0]];
    assert(abrufe15.length === 2 && abrufe15[1].pick === 12 && ids.length === 1 && /^p[0-9a-z]{9}$/.test(ids[0]),
      "15.7 Auswahl: zweiter Abruf mit pick 12, ein Eintrag unter seiner Kennung", { abrufe: abrufe15.slice(1), ids });
    assert(e && JSON.stringify(Object.keys(e).sort()) === JSON.stringify(["at", "link", "name", "weapons"]) && e.link === CHAR15 + "?buildId=12" &&
      e.name === "Night" && JSON.stringify(e.weapons) === JSON.stringify(["Dagger", "Staff"]) && Number.isFinite(e.at),
      "15.7 gespeichert: nur Link (mit dem gewaehlten Build), Waffen und der eigene Name", e);
    const roh = JSON.stringify(lager.plans);
    assert(!/PvP|Raid|Questlog Skill|Questlog Bogen|SkillSet|item_a|sheet|active/.test(roh), "15.7 kein Name und nichts sonst von Questlog in boro-plans.json", roh);
    b = await blick15(p);
    const fokus = await p.evaluate(() => document.activeElement?.tagName === "H3" && document.activeElement.textContent.trim());
    assert(b.karten.length === 1 && b.karten[0].name === "Night" && b.karten[0].zeile === "Dagger and Staff" && fokus === "Night" &&
      await p.evaluate(() => document.querySelector("#qlLink").value === "" && document.querySelector("#qlName").value === ""),
      "15.7 die neue Karte steht da, der Fokus auf ihrer Ueberschrift, das Feld ist leer", { k: b.karten, fokus });
    // ohne eigenen Namen: Questlogs Buildname nur fuer die Sitzung
    await einfuegen(OWNER15);
    await p.waitForFunction(() => document.querySelectorAll("#bauBody .qlkarte").length === 2, null, { timeout: 10000 }).catch(() => {});
    const owner = Object.entries(lager.plans).find(([, x]) => x.link === OWNER15);
    b = await blick15(p);
    assert(abrufe15.length === 3 && abrufe15[2].link === OWNER15 && abrufe15[2].pick == null && !!owner && owner[1].name === "" &&
      b.karten.some((x) => x.name === "Borometer") && !JSON.stringify(lager.plans).includes("Borometer"),
      "15.7 ohne eigenen Namen: die Karte zeigt Questlogs Namen dieser Sitzung, gespeichert wird er nicht; der Link geht, wie er ist", { abrufe: abrufe15.slice(2), owner, namen: b.karten.map((x) => x.name) });
    assert(!s.fehler.length, "15.7 keine Fehler", s.fehler);
    await p.close();
    // Neustart: dieselben Eintraege, Questlogs Name ist weg, die Karte heisst nach den Waffen
    const neu = await oeffne({ app: true, lager: { ...lager, plans: JSON.parse(JSON.stringify(lager.plans)) } });
    await beispiel(neu.page);
    await zuBuilds15(neu);
    const nb = await blick15(neu.page);
    assert(nb.karten.length === 2 && nb.karten.some((x) => x.name === "Night") && nb.karten.some((x) => x.name === "Longbow/Crossbow") &&
      !nb.karten.some((x) => [x.name, x.zeile, x.gleich, x.paarName].join(" ").includes("Borometer")), "15.7 nach dem Neustart: die Eintraege sind lesbar, Questlogs Name ist fort", nb.karten.map((x) => x.name));
    await neu.page.close();
  }

  // --- 15.8: Fehler - Zeitueberschreitung und eine abgelehnte Schreibung: ein Satz, nichts gespeichert, der Link bleibt im Feld
  {
    const lager = lager15({ plans: {}, abruf: () => ({ ok: false, error: "timeout" }) });
    const s = await oeffne({ app: true, lager });
    const p = s.page;
    await beispiel(p);
    await zuBuilds15(s);
    await p.fill("#qlLink", CHAR15 + "?buildId=11");
    await p.click("#qlForm button[type=submit]");
    await p.waitForFunction(() => (document.querySelector("#qlStatus")?.textContent || "").includes("did not answer"), null, { timeout: 10000 }).catch(() => {});
    let b = await blick15(p);
    assert(b.status === "Questlog did not answer." && !Object.keys(lager.plans).length && !b.karten.length &&
      await p.evaluate(() => document.querySelector("#qlLink").value.endsWith("?buildId=11")),
      "15.8 Zeitueberschreitung: der Satz, nichts gespeichert, der Link bleibt fuer einen neuen Versuch", b.status);
    lager.abruf = abruf15;
    lager.plansAblehnen = true;
    await p.click("#qlForm button[type=submit]");
    await p.waitForFunction(() => (document.querySelector("#qlStatus")?.textContent || "").includes("differently"), null, { timeout: 10000 }).catch(() => {});
    b = await blick15(p);
    assert(b.status === "Questlog sends the data differently than expected. Borometer needs an update." && !Object.keys(lager.plans).length && !b.karten.length,
      "15.8 abgelehnte Schreibung (400): der Satz, keine Karte, nichts gespeichert", b.status);
    assert(!s.fehler.length, "15.8 keine Fehler", s.fehler);
    await p.close();
  }

  // --- 15.9: Loesen und Rueckgaengig - nie endgueltig, der alte Plan behaelt alles, was er trug
  {
    const lager = lager15();
    const s = await oeffne({ app: true, lager, config: { logIndex: INDEX15 } });
    const p = s.page;
    await beispiel(p);
    await zuBuilds15(s);
    const vorher = JSON.parse(JSON.stringify(lager.plans.palt000001));
    await p.click("#ql-palt000001 [data-ql-los]");
    await p.waitForFunction(() => !document.querySelector("#ql-palt000001") && !!document.querySelector("#bauBody .qlgeloest"), null, { timeout: 5000 }).catch(() => {});
    let b = await blick15(p);
    const nach = lager.plans.palt000001;
    const fokus = await p.evaluate(() => document.activeElement?.hasAttribute("data-ql-undo"));
    assert(b.karten.length === 3 && !b.karten.some((x) => x.name === "Raid") && b.geloest === "\u201cRaid\u201d detached. It stays stored. Undo" && fokus,
      "15.9 Loesen: die Karte geht, ein Satz mit \u201eUndo\u201c (im Fokus)", { g: b.geloest, fokus });
    const { geloest, ...rest } = nach || {};
    assert(Number.isFinite(geloest) && JSON.stringify(rest) === JSON.stringify(vorher),
      "15.9 geloest heisst markiert, nicht geloescht: der Eintrag bleibt mit allem, was er trug", nach);
    const zw = b.karten.find((x) => x.name === "Zwilling");
    assert(zw && !zw.gleich, "15.9 der Hinweis \u201esame weapons\u201c faellt mit der geloesten Karte weg", zw);
    await p.click("#bauBody [data-ql-undo]");
    await p.waitForFunction(() => !!document.querySelector("#ql-palt000001"), null, { timeout: 5000 }).catch(() => {});
    b = await blick15(p);
    const fokus2 = await p.evaluate(() => document.activeElement === document.querySelector("#ql-palt000001 h3"));
    assert(b.karten.length === 4 && JSON.stringify(lager.plans.palt000001) === JSON.stringify(vorher) && !b.geloest && fokus2,
      "15.9 Rueckgaengig: die Karte ist zurueck, der Eintrag wie vorher, der Fokus auf ihrer Ueberschrift", { plan: lager.plans.palt000001, fokus2 });
    assert(!s.fehler.length, "15.9 keine Fehler", s.fehler);
    await p.close();
  }

  /* Fixrunde 1 zu Aufgabe 12 (Pruefung 29.09.; Entscheidungen dazu): geloeste Builds auch nach einem Neustart
     zurueckholen, Links aus boro-builds.json ohne Eintrag als Karte, Einfuegen fuehrt zusammen statt zu ersetzen
     und ist vor dem Lesen gesperrt, nie Questlogs Buildname als Name, das Feld verliert beim Neuzeichnen nichts
     (aus test-plan-page 5c), Esc in der Auswahl, Loesen bei abgelehnter Schreibung. */
  const pcB15 = await esbuild.build({ entryPoints: [join(root, "src/renderer/plan-core.ts")], bundle: true, format: "esm", platform: "neutral",
    write: false, logLevel: "silent", plugins: [bilderPlugin(root, bilderModus(root))] });
  const pc15 = await import("data:text/javascript;base64," + Buffer.from(pcB15.outputFiles[0].text).toString("base64"));
  const pid15 = (link, id) => pc15.planId(pc15.parseLink(link), id);

  // --- 15.9b: Loesen, Neustart, "Show detached builds (n)", Zurueckholen - der Eintrag wie vorher, ohne geloest
  {
    const lager = lager15();
    const vorher = JSON.parse(JSON.stringify(lager.plans.pneu000001));
    const s = await oeffne({ app: true, lager, config: { logIndex: INDEX15 } });
    await beispiel(s.page);
    await zuBuilds15(s);
    await s.page.click("#ql-pneu000001 [data-ql-los]");
    await warte15(s.page, () => lager.plans.pneu000001.geloest !== undefined, 5000);
    await s.page.close();
    const n = await oeffne({ app: true, lager, config: { logIndex: INDEX15 } });
    const p = n.page;
    await beispiel(p);
    await zuBuilds15(n);
    let b = await blick15(p);
    assert(b.zeige && b.zeige.text === "Show detached builds (2)" && b.zeige.auf === "false" && !b.geloeste.length && b.karten.length === 3,
      "15.9b nach dem Neustart: ein leiser Umschalter nennt die zwei geloesten Builds, zugeklappt", { zeige: b.zeige, n: b.karten.length });
    await p.click("#bauBody [data-ql-zeige]");
    await p.waitForFunction(() => document.querySelectorAll("#bauBody .qlkarte.geloest").length === 2, null, { timeout: 5000 }).catch(() => {});
    b = await blick15(p);
    const burst = b.geloeste.find((x) => x.name === "Burst");
    assert(b.zeige?.auf === "true" && b.zeige.text === "Hide detached builds" && !!burst && burst.zurueck === "Bring back" &&
      burst.zurueckName === "Bring back \u201cBurst\u201d" && !burst.los && b.geloeste.some((x) => x.name === "Weg"),
      "15.9b aufgeklappt: die geloesten Builds als Karten mit \u201eBring back\u201c (fuer den Vorleser mit Namen)", { zeige: b.zeige, g: b.geloeste });
    await p.click("#ql-pneu000001 [data-ql-zurueck]");
    await warte15(p, () => lager.plans.pneu000001.geloest === undefined, 5000);
    b = await blick15(p);
    const fokus = await p.evaluate(() => document.activeElement === document.querySelector("#ql-pneu000001 h3"));
    assert(JSON.stringify(lager.plans.pneu000001) === JSON.stringify(vorher) && b.karten.some((x) => x.name === "Burst") && b.geloeste.length === 1 && fokus,
      "15.9b Zurueckholen: boro-plans.json traegt den Eintrag wie vorher, ohne geloest; die Karte ist zurueck, der Fokus auf ihr", { plan: lager.plans.pneu000001, fokus });
    assert(!s.fehler.length && !n.fehler.length, "15.9b keine Fehler", [...s.fehler, ...n.fehler]);
    await p.close();
  }

  // --- 15.9c: Loesen, das der Helfer ablehnt (400): die Karte bleibt, Seite und Datei laufen nicht auseinander
  {
    const lager = lager15();
    const s = await oeffne({ app: true, lager, config: { logIndex: INDEX15 } });
    const p = s.page;
    await beispiel(p);
    await zuBuilds15(s);
    lager.plansAblehnen = true;
    await p.click("#ql-pneu000003 [data-ql-los]");
    await p.waitForFunction(() => !!document.querySelector("#ql-pneu000003:not(.geloest)") && (document.querySelector("#qlStatus")?.textContent || "").includes("differently"),
      null, { timeout: 5000 }).catch(() => {});
    const b = await blick15(p);
    assert(b.karten.some((x) => x.name === "Heiler") && lager.plans.pneu000003.geloest === undefined && !b.zeige?.text.includes("(2)") &&
      b.status.startsWith("Questlog sends the data differently"), "15.9c abgelehnt: die Karte steht wieder da, die Datei ist unveraendert, ein Satz sagt es", b.status);
    await p.close();
  }

  // --- 15.2b: Links aus boro-builds.json ohne Eintrag als Karte (Questlog, fremder Planer, ohne Waffen); loesen ueber den Build
  {
    const baue = { ...baue15(),
      dddddddddd: { name: "Alt", weapons: ["Spear", "Orb"], core: ["d1", "d2", "d3", "d4"], first: 4, link: Q15 + "character-builder/Other?buildId=5" },
      eeeeeeeeee: { name: "", weapons: ["Greatsword", "Dagger"], core: ["e1", "e2", "e3", "e4"], first: 5, link: "https://maxroll.gg/tl/build/x", rot: { "Quick Fire": 2 } },
      ffffffffff: { name: "Ohne", weapons: ["", ""], core: ["f1"], first: 6, link: "https://maxroll.gg/tl/build/y" } };
    // derselbe Link wie ein Eintrag: keine zweite Karte
    baue[B15.bA] = { ...baue[B15.bA], link: pl15().palt000001.link };
    const lager = lager15({ builds: baue });
    const s = await oeffne({ app: true, lager, config: { logIndex: INDEX15 } });
    const p = s.page;
    await beispiel(p);
    await zuBuilds15(s);
    await p.waitForFunction(() => document.querySelectorAll("#bauBody .qlkarte").length >= 7, null, { timeout: 8000 }).catch(() => {});
    const b = await blick15(p);
    const k = Object.fromEntries(b.karten.map((x) => [x.name, x]));
    assert(b.karten.length === 7 && b.ctx === "7 builds \u00b7 links to Questlog", "15.2b drei Links aus boro-builds.json als Karten, der Link, den ein Eintrag schon hat, nicht doppelt",
      b.karten.map((x) => x.name));
    assert(k.Alt && k.Alt.link.href === Q15 + "character-builder/Other?buildId=5" && k.Alt.link.target === "_blank" && k.Alt.link.rel === "noopener noreferrer" &&
      k.Alt.link.text === "Open in Questlog" && k.Alt.zeile === "Spear and Orb", "15.2b Build mit Questlog-Link: Name und Waffen aus dem Build, In Questlog oeffnen", k.Alt);
    const mx = k["Greatsword/Dagger 1"];
    assert(mx && mx.link.href === "https://maxroll.gg/tl/build/x" && mx.link.target === "_blank" && mx.link.rel === "noopener noreferrer" && mx.link.text === "Open link" &&
      mx.link.name === "Open the link of \u201cGreatsword/Dagger 1\u201d", "15.2b fremder Planer: neutral \u201eOpen link\u201c, Name nach Paar und Nummer", mx);
    assert(k.Ohne && k.Ohne.zeile === "Weapons unknown \u2013 paste the link again" && !k.Ohne.bosse.length && !k.Ohne.leer && k.Ohne.icons === 0,
      "15.2b ohne Waffen: \u201eWeapons unknown \u2013 paste the link again\u201c, keine Zahlen", k.Ohne);
    const vor = JSON.parse(JSON.stringify(lager.builds.eeeeeeeeee));
    await p.click("#ql-b-eeeeeeeeee [data-ql-los]");
    await warte15(p, () => lager.builds.eeeeeeeeee.geloest !== undefined, 8000);
    const { geloest, ...rest } = lager.builds.eeeeeeeeee;
    assert(Number.isFinite(geloest) && JSON.stringify(rest) === JSON.stringify(vor) && !(await blick15(p)).karten.some((x) => x.link?.href === "https://maxroll.gg/tl/build/x"),
      "15.2b Loesen am Build: markiert in boro-builds.json, alles andere (auch rot) bleibt, die Karte geht", lager.builds.eeeeeeeeee);
    await p.click("#bauBody [data-ql-undo]");
    await warte15(p, () => lager.builds.eeeeeeeeee.geloest === undefined, 8000);
    assert(JSON.stringify(lager.builds.eeeeeeeeee) === JSON.stringify(vor), "15.2b Rueckgaengig am Build: wie vorher", lager.builds.eeeeeeeeee);
    assert(!s.fehler.length, "15.2b keine Fehler", s.fehler);
    await p.close();
  }

  // --- 15.7b: Einfuegen vor dem Lesen gesperrt; derselbe Link fuehrt zusammen, nie Questlogs Buildname als Name
  {
    abrufe15.length = 0;
    const p11 = pid15(CHAR15, 11), p13 = pid15(CHAR15, 13);
    const altPlan = { link: CHAR15 + "?buildId=11", at: tag15(10, 12, 0), name: "Raid", bau: B15.bA, weapons: ["Longbow", "Crossbow"],
      active: [{ id: "SkillSet_A", lvl: 20, traits: [] }], passive: [], mastery: [], gear: { main_hand: "item_a" }, keys: { SkillSet_A: "Quick Fire" },
      sheet: { slots: {}, sets: [], fmt: {} } };
    // ein neuer Eintrag in fremder Form (ohne at, mit einem Feld, das die Seite nicht kennt): keine Karte, aber in der Datei
    const fremd = { link: CHAR15 + "?buildId=13", name: "Mein", weapons: ["Longbow", "Crossbow"], notiz: 7 };
    let los;
    const lager = lager15({ plans: { [p11]: altPlan, [p13]: fremd }, plansWarte: new Promise((r) => { los = r; }) });
    const s = await oeffne({ app: true, lager });
    const p = s.page;
    await beispiel(p);
    await bereich(p, "builds");
    await p.waitForSelector("#qlLink", { timeout: 10000 });
    await p.fill("#qlLink", CHAR15 + "?buildId=11");
    await p.press("#qlLink", "Enter");
    await p.waitForFunction(() => (document.querySelector("#qlStatus")?.textContent || "").includes("One moment"), null, { timeout: 5000 }).catch(() => {});
    const st = (await blick15(p)).status;
    assert(st === "One moment \u2013 Borometer is still reading your saved builds." && abrufe15.length === 0 && !lager.planPosts.length,
      "15.7b vor dem Lesen der Datei: ein Satz, kein Abruf, nichts geschrieben", { st, abrufe: abrufe15.length });
    los();
    await p.waitForFunction(() => document.querySelectorAll("#bauBody .qlkarte").length === 1 && !(document.querySelector("#qlStatus")?.textContent || ""), null, { timeout: 15000 }).catch(() => {});
    await p.press("#qlLink", "Enter");
    await warte15(p, () => lager.planPosts.length >= 1, 10000);
    const nach = lager.plans[p11];
    const { name: n1, ...rest1 } = nach || {}, { name: n0, ...rest0 } = altPlan;
    assert(n1 === "" && JSON.stringify(rest1) === JSON.stringify(rest0),
      "15.7b derselbe Link ohne eigenen Namen: alles bleibt (Steckbrief, Skills, Build), Questlogs alter Buildname wird nicht wieder geschrieben", nach);
    await p.fill("#qlLink", CHAR15 + "?buildId=13");
    await p.press("#qlLink", "Enter");
    await warte15(p, () => lager.planPosts.length >= 2, 10000);
    const f = lager.plans[p13];
    assert(f && f.name === "Mein" && f.notiz === 7 && Number.isFinite(f.at) && f.link === fremd.link && JSON.stringify(f.weapons) === JSON.stringify(fremd.weapons),
      "15.7b ein Eintrag in fremder Form: zusammengefuehrt, der eigene Name und das unbekannte Feld bleiben", f);
    await p.fill("#qlLink", CHAR15 + "?buildId=13");
    await p.fill("#qlName", "Neu");
    await p.press("#qlLink", "Enter");
    await warte15(p, () => lager.planPosts.length >= 3, 10000);
    assert(lager.plans[p13].name === "Neu" && lager.plans[p13].notiz === 7, "15.7b ein neuer eigener Name ersetzt den alten, sonst bleibt alles", lager.plans[p13]);
    assert(!s.fehler.length, "15.7b keine Fehler", s.fehler);
    await p.close();
  }

  // --- 15.7c (aus test-plan-page 5c, gleich streng): was im Feld steht, ueberlebt ein Neuzeichnen - neues Log, Fokus weg, Karten neu gebaut
  {
    const lager = lager15();
    const s = await oeffne({ app: true, lager, config: { logIndex: INDEX15 } });
    const p = s.page;
    await beispiel(p);
    await zuBuilds15(s);
    await p.fill("#qlLink", "abc");
    await p.fill("#qlName", "Tipp");
    await p.focus("#qlLink");
    await s.page.setInputFiles("#fileInput", L15_A);
    await p.waitForFunction(() => (document.querySelector("#hName")?.textContent || "").includes("Vulcanus"), null, { timeout: 10000 }).catch(() => {});
    await bereich(p, "builds");
    const w1 = await p.evaluate(() => [document.querySelector("#qlLink").value, document.querySelector("#qlName").value]);
    assert(JSON.stringify(w1) === JSON.stringify(["abc", "Tipp"]), "15.7c ein neues Log: Link und Name stehen noch im Feld", w1);
    await p.evaluate(() => document.activeElement?.blur());
    // etwas anderes aendert den Bereich (Loesen und Rueckgaengig): die Karten werden wirklich neu gebaut
    await p.evaluate(() => { window.__karteVorher = document.querySelector("#ql-pneu000003"); });
    await p.click("#ql-pneu000003 [data-ql-los]");
    await p.click("#bauBody [data-ql-undo]");
    await p.waitForFunction(() => !!document.querySelector("#ql-pneu000003"), null, { timeout: 5000 }).catch(() => {});
    const w2 = await p.evaluate(() => [document.querySelector("#qlLink").value, document.querySelector("#qlName").value,
      !!document.querySelector("#ql-pneu000003") && document.querySelector("#ql-pneu000003") !== window.__karteVorher]);
    assert(JSON.stringify(w2) === JSON.stringify(["abc", "Tipp", true]), "15.7c nach Fokusverlust und echtem Neubau der Karten: Link und Name stehen noch", w2);
    await p.close();
  }

  // --- 15.7d: Esc in der Auswahl schliesst sie, der Fokus geht ins Feld, kein Abruf
  {
    abrufe15.length = 0;
    const lager = lager15({ plans: {} });
    const s = await oeffne({ app: true, lager });
    const p = s.page;
    await beispiel(p);
    await zuBuilds15(s);
    await p.fill("#qlLink", CHAR15);
    await p.press("#qlLink", "Enter");
    await p.waitForFunction(() => !!document.querySelector("#qlForm fieldset legend"), null, { timeout: 10000 }).catch(() => {});
    const vor = abrufe15.length;
    await p.keyboard.press("Escape");
    await p.waitForFunction(() => !document.querySelector("#qlForm fieldset"), null, { timeout: 5000 }).catch(() => {});
    const e = await p.evaluate(() => ({ auswahl: !!document.querySelector("#qlForm fieldset"), fokus: document.activeElement?.id }));
    assert(vor === 1 && !e.auswahl && e.fokus === "qlLink" && abrufe15.length === 1 && !Object.keys(lager.plans).length,
      "15.7d Esc in der Auswahl: sie geht, der Fokus steht im Feld, kein weiterer Abruf, nichts gespeichert", { vor, e, abrufe: abrufe15.length });
    await p.close();
  }

  // --- 15.10: Deutsch - alle Worte, "Build", nie "Bau"
  {
    const lager = lager15();
    const s = await oeffne({ app: true, lang: "de", lager, config: { logIndex: INDEX15 } });
    const p = s.page;
    await laden15(s, L15_A, "Vulcanus");
    const kl = await kampfLink15(p);
    await zuBuilds15(s);
    const b = await blick15(p);
    const k = Object.fromEntries(b.karten.map((x) => [x.name, x]));
    assert(b.linkLabel === "Questlog-Link einfügen" && b.nameLabel === "Name (optional)" && b.speichern === "Speichern" && b.ctx === "4 Builds \u00b7 Links zu Questlog",
      "15.10 Deutsch: Feld, Name, Speichern, Kopfzeile", { l: b.linkLabel, n: b.nameLabel, s: b.speichern, ctx: b.ctx });
    assert(k.Raid?.zeile === "Langbogen und Armbrust \u00b7 zuletzt gespielt 20.09." && k.Raid.bosse[0] === "King Khanzaizin 226.5k \u00b7 19 Kämpfe" &&
      k.Raid.bosse[2] === "Tevent \u00b7 2 Kämpfe" && k.Raid.link?.text === "In Questlog öffnen" && k.Raid.los === "Lösen" &&
      k.Raid.schild === "im offenen Kampf" && k.Raid.gleich === "gleiche Waffen wie \u201eZwilling\u201c" && k.Heiler?.leer === "Noch keine Kämpfe mit diesen Waffen.",
      "15.10 Deutsch: Karte wie in der Skizze (Kurzzahl mit Punkt), Schild, Hinweis, leerer Satz", k.Raid);
    assert(kl && kl.text === "Build in Questlog \u203a" && !/\bBau(e|s|en)?\b/.test(b.text + b.ctx), "15.10 Deutsch: der Link im Kampf; Build, nie Bau", { kl, text: b.text.slice(0, 200) });
    await p.close();
  }

  // --- 15.11: drei Themen - der goldene Rand traegt, Text mindestens 11 Punkt
  for (const thema of ["dark", "light", "tnl"]) {
    const s = await oeffne({ app: true, lager: lager15(), config: { logIndex: INDEX15, theme: thema } });
    await laden15(s, L15_A, "Vulcanus");
    await zuBuilds15(s);
    const b = await blick15(s.page);
    const an = await s.page.evaluate(() => document.documentElement.dataset.theme);
    assert(an === thema && b.karten[0]?.offen && b.karten[0].rand === b.gold && b.gold !== "rgba(0, 0, 0, 0)" && !b.klein.length && !s.fehler.length,
      `15.11 Thema ${thema}: die Karte des offenen Kampfs golden umrandet, Text mindestens 11 Punkt`, { an, rand: b.karten[0]?.rand, gold: b.gold, klein: b.klein });
    await s.page.close();
  }

  // --- 15.12: Groessen - kein waagerechtes Rollen, nichts gestreckt, Text mindestens 11 Punkt; bei 1280 x 860 rollt Builds nicht
  for (const [breite, hoehe] of [[2000, 1480], [1920, 1080], [1280, 860], [1000, 860], [760, 860], [560, 860]]) {
    const s = await oeffne({ app: breite >= 760, lang: "de", breite, hoehe, lager: lager15(), config: { logIndex: INDEX15 } });
    await laden15(s, L15_A, "Vulcanus");
    await zuBuilds15(s);
    await s.page.evaluate(() => { document.activeElement?.blur(); window.scrollTo(0, 0); });
    const b = await blick15(s.page);
    const wo = `${breite} \u00d7 ${hoehe}`;
    assert(!b.quer && !b.klein.length && !s.fehler.length && b.karten.length === 4, `15.12 ${wo}: kein waagerechtes Rollen, Text mindestens 11 Punkt, vier Karten, keine Fehler`,
      { quer: b.quer, klein: b.klein, fehler: s.fehler });
    assert(b.karten.every((x) => x.box.width <= 561 && x.box.right <= breite), `15.12 ${wo}: nichts gestreckt - jede Karte hoechstens 560 Punkt breit`, b.karten.map((x) => Math.round(x.box.width)));
    if (breite === 1280) assert(b.rollt <= 0, "15.12 1280 \u00d7 860: Builds rollt nicht - Feld und vier Karten im Bild", b.rollt);
    await s.page.close();
  }

  // ===== Abschnitt 16: breite Schrift (Aufgabe 13, CI unter Linux) =====
  /* Die CI laeuft unter Linux mit dessen Standardschriften; die sind breiter als Palatino und Segoe unter
     Windows. Nachgebaut mit Verdana (unter Linux DejaVu Sans, dieselbe Breite) und etwas Sperrung: der Fuss
     der Kampfwahl kuerzt dann die Hinweise statt die Knoepfe darunter zu schieben, und die Namen in der
     Vergleichszeile bei 560 kuerzen mit "..." und tragen den vollen Namen im title. */
  const BREIT = "*,*::before,*::after{font-family:Verdana,'DejaVu Sans',sans-serif !important;letter-spacing:.04em !important}";
  // --- 16.1: der Fuss der Kampfwahl mit breiter Schrift, Deutsch und Englisch
  for (const lang of ["de", "en"]) {
    const s = await oeffne({ app: true, lang });
    const p = s.page;
    await mitLog(s);
    await p.addStyleTag({ content: BREIT });
    await p.keyboard.press("Control+K");
    await p.waitForFunction(() => !document.querySelector("#kampfwahl").hidden);
    const f = await p.evaluate(() => {
      const r = (e) => e.getBoundingClientRect().toJSON();
      const t = document.querySelector(".kwfuss .kwtasten"), tr = r(t);
      // ein Hinweis ist ganz zu sehen oder ganz weggeschnitten, nie halb
      const kt = [...t.querySelectorAll(".kt")].map((k) => { const b = r(k);
        const ganz = b.left >= tr.left - 0.5 && b.right <= tr.right + 0.5 && b.top >= tr.top - 0.5 && b.bottom <= tr.bottom + 0.5;
        const weg = b.left >= tr.right - 0.5 || b.top >= tr.bottom - 0.5;
        return { ganz, weg }; });
      const knoepfe = ["#kwLaeufe", "#filterBtn", "#btnEditFights", "#btnClearLog"].map((q) => { const e = document.querySelector(q);
        return { q, da: e.getClientRects().length > 0, ...r(e) }; });
      return { tasten: tr, kt, knoepfe, fuss: r(document.querySelector(".kwfuss")), feld: r(document.querySelector("#kampfwahl")) };
    });
    const zeile = f.knoepfe.every((k) => k.da && k.left >= f.tasten.right && k.top < f.tasten.bottom && k.bottom > f.tasten.top && k.right <= f.feld.right);
    assert(zeile && f.kt.every((k) => k.ganz || k.weg) && f.kt[0]?.ganz,
      `16.1 breite Schrift (${lang}): im Fuss der Kampfwahl stehen die Knoepfe in derselben Zeile rechts der Hinweise; ein Hinweis ist ganz da oder ganz weg, der erste bleibt`,
      { tasten: f.tasten, kt: f.kt, knoepfe: f.knoepfe.map((k) => ({ q: k.q, l: k.left, t: k.top, b: k.bottom })) });
    assert(!s.fehler.length, `16.1 breite Schrift (${lang}): keine Fehler`, s.fehler);
    await p.close();
  }
  // --- 16.2: der Vergleich bei 560 x 860 mit breiter Schrift: Zeilen hoechstens 44, Namen mit "..." und title
  {
    const s = await oeffne({ app: true, lang: "de", breite: 560, hoehe: 860 }); const p = s.page;
    await zumVergleich(s);
    await p.addStyleTag({ content: BREIT });
    await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    const v = await p.evaluate(() => [...document.querySelectorAll("#cmpJe .vr")].map((z) => {
      const n = z.querySelector(".vnn"), ic = z.querySelector(".vn .sic"), a = n.getBoundingClientRect(), b = ic?.getBoundingClientRect();
      return { h: z.getBoundingClientRect().height, text: n.textContent, title: n.title, gekuerzt: n.scrollWidth > n.clientWidth + 0.5,
        punkte: getComputedStyle(n).textOverflow === "ellipsis", nebenBild: !!b && Math.abs((a.top + a.bottom) / 2 - (b.top + b.bottom) / 2) < 4 && a.left >= b.right };
    }));
    const quer = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    assert(v.length === 5 && v.every((z) => z.h <= 44 && z.nebenBild && z.punkte && z.title === z.text) && v.some((z) => z.gekuerzt) && !quer,
      "16.2 breite Schrift, 560 × 860: jede Vergleichszeile hoechstens 44 Punkt, der Name neben dem Bild und mit „…“ gekuerzt, der volle Name im title; nichts rollt quer",
      { v, quer });
    assert(!s.fehler.length, "16.2 breite Schrift: keine Fehler", s.fehler);
    await p.close();
  }
} finally {
  await browser.close();
  rmSync(work, { recursive: true, force: true });
}

console.log();
if (failed) { console.log(`NEU PAGE FAILED - ${failed}`); process.exit(1); }
console.log("NEU PAGE PASSED");
