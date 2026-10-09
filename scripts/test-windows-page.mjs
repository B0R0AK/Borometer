// Borometer - a damage meter for Throne and Liberty
// Copyright (C) 2026 B0R0AK
// SPDX-License-Identifier: GPL-3.0-or-later
//
// Windows-Einbindung (Spezifikation 04.10.2026) an der gebauten Seite, vom
// gestellten Helfer ausgeliefert (page.route): die Meldung nach dem Kampf
// (3.1, 3.2), der Startauftrag aus der Sprungliste (5.1), die Ereignisse
// pin und start, die Sprache fuer den Hauptprozess (8) und "Zuletzt
// gelesen" (POST /api/gelesen). Teil 2 (Nr. 8): der Abschnitt "Windows" der
// Einstellungen (9, 3.4).
//
// Die Meldung laeuft durch den echten Weg der Seite: Live mit einem echten
// Auszug (scripts/fixtures/live-auszug.txt, nur Zahlen und "Gegner N"), der
// gestellte Helfer liefert /api/state und /api/latest?from= Byte fuer Byte,
// und die Wanduhr der Seite steht unter page.clock - "Trennen nach" laeuft
// so in Sekunden statt in echter Zeit ab. Nichts an der Seite ist ersetzt.
//
// Run:  npm run test:windows-page     (baut die Seite zuerst)

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
let failed = 0;
function assert(cond, name, detail) {
  if (cond) console.log("  ok    " + name);
  else { failed++; console.log("  FAIL  " + name + (detail === undefined ? "" : "  " + JSON.stringify(detail).slice(0, 400))); }
}
const html = readFileSync(join(root, "dist", "renderer", "index.html"), "utf8");
const browser = await chromium.launch(process.env.PARITY_CHROMIUM ? { executablePath: process.env.PARITY_CHROMIUM } : {});
const schlafe = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------- das Log ----------
   Der Auszug ohne die sieben Zeilen um 20:58 (unter der Mindestdauer, kein
   Kampf): so ist der neueste Kampf der Seite der um 20:37, und sein Ende ist
   das Ende der Datei. */
const ZEILEN = readFileSync(join(root, "scripts", "fixtures", "live-auszug.txt"), "utf8").split("\n").filter(Boolean)
  .filter((z) => !z.startsWith("20260925-20:58"));
const zeit = (z) => { const m = /^(\d{4})(\d\d)(\d\d)-(\d\d):(\d\d):(\d\d):(\d{3}),/.exec(z);
  return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6], +m[7]); };
const two = (n, w = 2) => String(n).padStart(w, "0");
const stempel = (ms) => { const d = new Date(ms);
  return `${d.getUTCFullYear()}${two(d.getUTCMonth() + 1)}${two(d.getUTCDate())}-` +
    `${two(d.getUTCHours())}:${two(d.getUTCMinutes())}:${two(d.getUTCSeconds())}:${two(d.getUTCMilliseconds(), 3)}`; };
const umstempeln = (z, ms) => stempel(ms) + z.slice(z.indexOf(","));
const ENDE = zeit(ZEILEN.at(-1));
const LOG = ZEILEN.join("\n") + "\n";
/* Die letzten 20 Zeilen noch einmal, so verschoben, dass die erste 1 s nach
   dem Ende der Datei steht (Abstaende wie im Auszug): derselbe Kampf waechst. */
const LETZTE = ZEILEN.slice(-20);
const VERSATZ = ENDE - zeit(LETZTE[0]) + 1000;
const WEITER = LETZTE.map((z) => umstempeln(z, zeit(z) + VERSATZ)).join("\n") + "\n";
const WEITER_ENDE = ENDE + VERSATZ + (zeit(LETZTE.at(-1)) - zeit(LETZTE[0]));
/* Ein eigener Kampf ab ab (ms Logzeit) an ziel: 5 s lang, alle 200 ms ein
   Treffer. Je Kampf ein anderes Ziel: "Phasen verbinden" (ab Werk an)
   haengt Pulls an dasselbe Ziel sonst zusammen. */
const kampf = (ab, ziel) => Array.from({ length: 25 }, (_, k) =>
  `${stempel(ab + k * 200)},DamageDone,Fähigkeit – 945710601,945710601,${5000 + k},1,1,kMaxDamageByCriticalDecision,Ich,${ziel}`).join("\n") + "\n";

const LOGNAME = "TLCombatLog-20260925.txt";
const ALT = "TLCombatLog-20260920.txt";   // ein frueheres Log fuer den Auftrag "log"

/* Eine Seite am gestellten Helfer. app: ?win=1 und nativeFrame (das eigene
   Fenster der App), kompakt: dazu &kompakt=1 (das Kompaktfenster), sonst ein
   Browser-Tab. uhr: page.clock vor dem Laden. Mitgeschrieben: POST
   /api/config in s.posts, /api/win in s.win, POST /api/folder/open in
   s.ordner, POST /api/gelesen in s.gelesen, /api/latest in s.latest (from),
   GET /api/log in s.logs. Zum Stellen: s.text (das wachsende Log), s.start
   (start in /api/state), s.counts (die Zaehler von /api/events). */
async function oeffne({ app = true, kompakt = false, lang = "en", uhr = false, start = null, config = {}, grenze = 0, breite = 1280, hoehe = 860 } = {}) {
  const page = await browser.newPage({ viewport: { width: breite, height: hoehe } });
  const s = { page, fehler: [], posts: [], win: [], ordner: [], gelesen: [], latest: [], logs: [],
    text: Buffer.from(LOG), start, counts: { pin: 0, start: 0 }, config };
  page.on("pageerror", (e) => s.fehler.push(String(e)));
  await page.addInitScript((l) => { try { localStorage.clear(); localStorage.setItem("boroLang", l); } catch { /* blockiert */ } }, lang);
  if (uhr) await page.clock.install();
  await page.route("http://boro.test/**", async (route) => {
    const req = route.request(), url = new URL(req.url()), path = url.pathname;
    const json = (body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) }).catch(() => {});
    const gesendet = () => JSON.parse(req.postData() || "{}");
    if (path === "/api/state") return json({ dir: "C:\\Logs", file: LOGNAME, size: s.text.length, mtime: s.text.length,
      nativeFrame: app, material: false, stayOnTop: false, start: s.start });
    if (path === "/api/latest") {
      // wie logs.ts latestAnswer: ab dem Byte from bis zum Ende, nur ganze Zeilen (hier endet jedes Stueck mit \n)
      const from = Number(url.searchParams.get("from"));
      s.latest.push(from);
      if (url.searchParams.get("file") !== LOGNAME || !(from >= 0) || from > s.text.length) return json({ ok: false }, 409);
      /* grenze: hoechstens so viele Bytes je Antwort, bis zur letzten ganzen
         Zeile - wie die 8-MB-Grenze von logs.ts, nur klein */
      let to = s.text.length;
      if (grenze && to - from > grenze) to = s.text.lastIndexOf(10, from + grenze - 1) + 1;
      return json({ file: LOGNAME, from, to, size: s.text.length,
        head: s.text.toString("utf8").split("\n").slice(0, 2).join("\n"), text: s.text.subarray(from, to).toString("utf8") });
    }
    if (path === "/api/logs") return json({ ok: true, files: [{ name: ALT, mtime: Date.UTC(2026, 8, 20, 20) / 1000, size: Buffer.byteLength(LOG) },
      { name: LOGNAME, mtime: Date.UTC(2026, 8, 25, 21) / 1000, size: s.text.length }] });
    if (path === "/api/log") {
      const name = url.searchParams.get("name"), from = Number(url.searchParams.get("from") || 0);
      s.logs.push(name);
      if (name !== ALT) return json({ ok: false }, 404);
      const b = Buffer.from(LOG);
      return json({ file: ALT, from, to: b.length, size: b.length, text: b.subarray(from).toString("utf8") });
    }
    if (path === "/api/config" && req.method() === "GET") return json(s.config);
    if (path === "/api/config") { s.posts.push(gesendet()); return json({ ok: true }); }
    if (path === "/api/folder/open") { s.ordner.push(gesendet()); return json({ ok: true }); }
    if (path === "/api/gelesen") { s.gelesen.push(gesendet()); return json({ ok: true }); }
    if (path === "/api/win") {
      const b = gesendet(); s.win.push(b);
      // wie start.ts: quittiert ist der Auftrag weg
      if (b.do === "starterledigt" && s.start && b.nr === s.start.nr) s.start = null;
      // wie window.ts: der Autostart antwortet mit dem Stand, den Windows nun hat
      if (b.do === "autostart") return json({ ok: true, autostart: b.an === true });
      return json({ ok: true, max: false, w: 400, h: 28, on_top: b.do === "pin" ? !!b.on : true, gezeigt: false });
    }
    if (path === "/api/events") {
      // wie events.ts: zuerst der Stand, danach wartet die Anfrage ein wenig
      if (!url.searchParams.has("now")) await schlafe(250);
      return json({ ok: true, registered: true, counts: { ...s.counts } });
    }
    if (path === "/api/best" && req.method() === "GET") return json({ ok: true, best: {} });
    if (path.startsWith("/api/")) return json({ ok: true });
    return route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: html }).catch(() => {});
  });
  await page.goto("http://boro.test/index.html" + (app ? "?win=1" + (kompakt ? "&kompakt=1" : "") : ""));
  await bisWahr(s, () => document.body.dataset.bereit === "ordner", "Seite fertig");
  return s;
}
/* Wartet in echter Zeit, bis fn in der Seite wahr ist (nicht waitForFunction:
   unter page.clock ruehrt sich dessen Takt nicht). Mit Uhr laeuft sie in
   kleinen Schritten mit, damit Takte der Seite kommen. */
async function bisWahr(s, fn, was, arg, uhr = false) {
  for (const ende = Date.now() + 20000; Date.now() < ende; ) {
    if (await s.page.evaluate(fn, arg)) return true;
    if (uhr) await s.page.clock.runFor(100);
    await schlafe(50);
  }
  throw new Error("Zeit abgelaufen: " + was);
}
async function bisNode(cond, was) {
  for (const ende = Date.now() + 20000; Date.now() < ende; ) { if (cond()) return true; await schlafe(50); }
  throw new Error("Zeit abgelaufen: " + was);
}
/* Die Wanduhr der Seite um ms vorstellen, in Sekundenschritten, und dazwischen
   echte Zeit fuer die Antworten des Helfers lassen. */
async function laufe(s, ms) {
  for (let t = 0; t < ms; t += 1000) {
    await s.page.clock.runFor(Math.min(1000, ms - t));
    await schlafe(60);
  }
  await schlafe(150);
}
const meldungen = (s) => s.win.filter((b) => b.do === "kampf");
/* Live einschalten und warten, bis der erste Takt die Datei ganz gelesen hat. */
async function liveAn(s) {
  await s.page.evaluate(() => document.querySelector("#btnWatch").click());
  await bisNode(() => s.latest.includes(0), "das erste ganze Laden");
  await laufe(s, 2000);
}
/* Ein Stueck an das Log haengen und warten, bis ein Takt es ab dem alten Ende geholt hat. */
async function anhaengen(s, text) {
  const alt = s.text.length;
  s.text = Buffer.concat([s.text, Buffer.from(text)]);
  for (const ende = Date.now() + 20000; Date.now() < ende && !s.latest.includes(alt); ) await laufe(s, 1000);
  return s.latest.includes(alt);
}

try {
  // --- 1.-2. Live im eigenen Fenster: der Stand beim Einschalten wird nicht gemeldet,
  //           ein gewachsener Kampf genau einmal, wenn er "Trennen nach" lang nicht waechst
  {
    const s = await oeffne({ uhr: true });
    await liveAn(s);
    assert(s.gelesen.length === 1 && s.gelesen[0].name === LOGNAME,
      "Zuletzt gelesen: Live meldet das ganz gelesene Log einmal mit POST /api/gelesen {name}", s.gelesen);
    await laufe(s, 60000);
    assert(meldungen(s).length === 0, "der Stand beim Einschalten von Live wird nicht gemeldet (60 s)", meldungen(s));
    const gap = Number(await s.page.evaluate(() => document.querySelector("#inGap").value));
    assert(gap === 8, "Trennen nach steht ab Werk auf 8 s", gap);
    assert(await anhaengen(s, WEITER), "das angehaengte Stueck kommt ueber /api/latest?from= an", s.latest);
    assert(meldungen(s).length === 0, "solange der Kampf waechst, keine Meldung", meldungen(s));
    await laufe(s, gap * 1000 + 3000);
    const m = meldungen(s);
    assert(m.length === 1, "nach Trennen nach ohne Wachstum genau eine Meldung", m);
    assert(m[0] && /^.+ · \d+(\.\d)?k$/.test(m[0].titel), "titel: Ziel · DPS in der Kurzform der Seite", m[0]);
    assert(m[0] && typeof m[0].satz === "string" && m[0].satz.length <= 240 && typeof m[0].best === "boolean",
      "satz ist Text (hoechstens 240 Zeichen), best ein Wahrheitswert", m[0]);
    assert(m[0] && m[0].win === "main" && Object.keys(m[0]).sort().join() === "best,do,satz,titel,win",
      "die Meldung nennt das grosse Fenster und nichts sonst", m[0]);
    assert(m[0] && (m[0].satz === "" || /\.$/.test(m[0].satz)) && !/ %/.test(m[0].satz),
      "satz endet mit Punkt, vor % steht kein normales Leerzeichen", m[0]?.satz);
    await laufe(s, 60000);
    assert(meldungen(s).length === 1, "nach weiteren 60 s weiterhin genau eine", meldungen(s));
    assert(s.gelesen.length === 1, "das Anhaengen meldet das Log nicht noch einmal als gelesen", s.gelesen);

    // ein neuer Kampf B; beginnt C, bevor B "Trennen nach" lang still war, ist B beendet
    assert(await anhaengen(s, kampf(WEITER_ENDE + 60000, "Gegner 7")), "Kampf B kommt an");
    await laufe(s, 2000);
    assert(meldungen(s).length === 1, "B waechst noch: keine Meldung", meldungen(s));
    assert(await anhaengen(s, kampf(WEITER_ENDE + 120000, "Gegner 8")), "Kampf C kommt an");
    await laufe(s, 1000);
    assert(meldungen(s).length === 2 && /^Gegner 7 · /.test(meldungen(s)[1].titel),
      "beginnt ein neuerer Kampf vor Ablauf der Frist, wird der vorige gemeldet", meldungen(s));
    await laufe(s, gap * 1000 + 3000);
    assert(meldungen(s).length === 3 && /^Gegner 8 · /.test(meldungen(s)[2].titel), "C nach Trennen nach: die dritte Meldung, jede genau einmal", meldungen(s));
    assert(!s.fehler.length, "keine Fehler in der Seite (Live, Meldung)", s.fehler);
    await s.page.close();
  }

  /* --- 2a. (Spezifikation Bester Pull 5.4, #143) der neueste Kampf unter Live ist ein neuer bester Pull:
     die Meldung sagt es und traegt best. Fuer sein eigenes Urteil zaehlt der Kampf mit, obwohl er unter
     Live der neueste ist. Danach ein schwaecherer: kein "Your best", best falsch. Ein Boss (Vulcanus),
     je Pull 80 s, alle 500 ms ein Treffer, 10 min Abstand; nur Zahlen. */
  {
    const VTAG = Date.UTC(2026, 8, 25, 20, 0, 0);
    const pull = (ab, dmg) => Array.from({ length: 160 }, (_, k) =>
      `${stempel(ab + k * 500)},DamageDone,Quick Fire,964762401,${dmg + (k % 5)},0,0,kNormalHit,Ich,Vulcanus`).join("\n") + "\n";
    const s = await oeffne({ uhr: true });
    s.text = Buffer.from("CombatLogVersion,4\n" + pull(VTAG, 5000) + pull(VTAG + 600000, 6000));
    await liveAn(s);
    await laufe(s, 20000);
    assert(meldungen(s).length === 0, "2a der Stand beim Einschalten wird nicht gemeldet", meldungen(s));
    assert(await anhaengen(s, pull(VTAG + 1200000, 9000)), "2a der dritte Pull (der staerkste) kommt an");
    await laufe(s, 8000 + 3000);
    let m = meldungen(s);
    assert(m.length === 1 && /^Vulcanus · /.test(m[0].titel) && m[0].satz.startsWith("Your best at this target") && m[0].best === true,
      "2a der neueste Kampf unter Live ist der neue beste Pull: „Your best at this target“ und best", m);
    assert(await anhaengen(s, pull(VTAG + 1800000, 5500)), "2a ein vierter, schwaecherer Pull kommt an");
    await laufe(s, 8000 + 3000);
    m = meldungen(s);
    assert(m.length === 2 && !m[1].satz.startsWith("Your best") && m[1].best === false && /below usual|better than usual|like usual/.test(m[1].satz),
      "2a ein schwaecherer Kampf danach: kein „Your best“, best falsch, der Satz gegen den Median", m);
    assert(!s.fehler.length, "2a keine Fehler", s.fehler);
    await s.page.close();
  }

  // --- 2b. der neueste Kampf wird waehrend Live entfernt: der aeltere, nie gewachsene wird nicht gemeldet
  {
    const s = await oeffne({ uhr: true });
    await liveAn(s);
    assert(await anhaengen(s, kampf(ENDE + 60000, "Gegner 7")), "Entfernen: Kampf A kommt an");
    await laufe(s, 2000);
    const weg = await s.page.evaluate(() => {
      const b = document.querySelector('#fightList [data-x="0"]');
      if (b) b.click();
      return !!b;
    });
    assert(weg, "der neueste Kampf (A) laesst sich entfernen");
    await laufe(s, 8000 + 3000);
    await laufe(s, 30000);
    assert(meldungen(s).length === 0, "nach dem Entfernen wird der aeltere Kampf nicht gemeldet (er wuchs nicht waehrend Live)", meldungen(s));
    assert(!s.fehler.length, "keine Fehler in der Seite (Entfernen)", s.fehler);
    await s.page.close();
  }

  // (grenze 80000: das erste Stueck braucht 600 Zeilen, sonst gilt der Schnitt nicht als fest und es wird ganz geladen)
  // --- 2c. ein Log groesser als eine Antwort: Zuletzt gelesen erst, wenn Live es bis zum Ende gelesen hat, und einmal
  {
    const s = await oeffne({ uhr: true, grenze: 80000 });
    await s.page.evaluate(() => document.querySelector("#btnWatch").click());
    await bisNode(() => s.latest.includes(0), "das erste Stueck");
    await laufe(s, 1000);
    assert(Buffer.byteLength(LOG) > 80000 * 2 && s.gelesen.length === 0, "nach dem ersten Stueck noch nicht als gelesen gemeldet", s.gelesen);
    for (let i = 0; i < 40 && !s.gelesen.length; i++) await laufe(s, 2000);
    assert(s.gelesen.length === 1 && s.gelesen[0].name === LOGNAME && s.latest.filter((f) => f > 0).length >= 2,
      "Zuletzt gelesen, sobald Live das Ende erreicht hat (mehrere Stuecke)", { gelesen: s.gelesen, latest: s.latest });
    await laufe(s, 10000);
    assert(s.gelesen.length === 1, "und nur einmal", s.gelesen);
    await s.page.close();
  }

  // --- 3. dieselbe Seite als Kompaktfenster: keine Meldung
  {
    const s = await oeffne({ uhr: true, kompakt: true });
    await liveAn(s);
    assert(await anhaengen(s, WEITER), "Kompaktfenster: Live liest das angehaengte Stueck");
    await laufe(s, 8000 + 3000);
    await laufe(s, 30000);
    assert(meldungen(s).length === 0, "aus dem Kompaktfenster keine Meldung", meldungen(s));
    assert(s.gelesen.length === 0, "das Kompaktfenster meldet nichts als gelesen", s.gelesen);
    assert(!s.fehler.length, "keine Fehler in der Seite (Kompaktfenster)", s.fehler);
    await s.page.close();
  }

  // --- 4. im Browser-Tab: keine Meldung
  {
    const s = await oeffne({ uhr: true, app: false });
    await liveAn(s);
    assert(await anhaengen(s, WEITER), "Browser-Tab: Live liest das angehaengte Stueck");
    await laufe(s, 8000 + 3000);
    await laufe(s, 30000);
    assert(meldungen(s).length === 0 && !s.win.length, "im Browser-Tab keine Meldung, kein /api/win", s.win);
    assert(!s.fehler.length, "keine Fehler in der Seite (Browser-Tab)", s.fehler);
    await s.page.close();
  }

  // --- 4b. ohne Live (ein Beispiel ist kein Mitlesen): keine Meldung
  {
    const s = await oeffne({ uhr: true });
    await s.page.evaluate(() => document.querySelector("#btnSample2").click());
    await laufe(s, 60000);
    assert(meldungen(s).length === 0, "ohne Live keine Meldung (Beispielkampf, 60 s)", meldungen(s));
    await s.page.close();
  }

  // --- 5. der Startauftrag: handeln, quittieren, nach dem Neuladen nichts doppelt
  {
    const s = await oeffne({ start: { nr: 7, kompakt: false, live: false, logordner: true, log: "" } });
    await bisNode(() => s.win.some((b) => b.do === "starterledigt"), "Auftrag 7 quittiert");
    await schlafe(300);
    assert(s.ordner.length === 1 && s.ordner[0].folder === "game" && Object.keys(s.ordner[0]).join() === "folder",
      "logordner: POST /api/folder/open {folder: \"game\"}", s.ordner);
    const erl = s.win.filter((b) => b.do === "starterledigt");
    assert(erl.length === 1 && erl[0].nr === 7, "quittiert mit POST /api/win {do: \"starterledigt\", nr: 7}", erl);
    assert(s.start === null, "der gestellte Helfer hat den Auftrag geloescht wie start.ts");
    await s.page.reload();
    await bisWahr(s, () => document.body.dataset.bereit === "ordner", "Seite fertig nach dem Neuladen");
    await schlafe(1500);
    assert(s.ordner.length === 1 && s.win.filter((b) => b.do === "starterledigt").length === 1,
      "nach dem Neuladen mit start: null nichts davon noch einmal", { ordner: s.ordner, win: s.win });

    // --- 6. Ereignisse: pin klickt #btnPin, start holt den naechsten Auftrag
    const pinVor = s.win.filter((b) => b.do === "pin").length;
    s.counts.pin++;
    await bisNode(() => s.win.filter((b) => b.do === "pin").length > pinVor, "pin aus dem Infobereich");
    const pin = s.win.filter((b) => b.do === "pin").at(-1);
    assert(pin.on === true && pin.remember === false && pin.win === "main",
      "Ereignis pin: der Weg von #btnPin (POST /api/win {do: \"pin\", on: true})", pin);
    // der Knopf folgt der Antwort von /api/win: darauf warten, nicht nur auf die Anfrage
    const gedrueckt = await bisWahr(s, () => document.querySelector("#btnPin").getAttribute("aria-pressed") === "true", "Knopf angeheftet").catch(() => false);
    assert(gedrueckt, "der Knopf zeigt angeheftet");
    s.start = { nr: 8, kompakt: false, live: false, logordner: false, log: ALT };
    s.counts.start++;
    await bisNode(() => s.win.some((b) => b.do === "starterledigt" && b.nr === 8), "Auftrag 8 quittiert");
    assert(s.logs.includes(ALT), "log: das Log wird ueber GET /api/log?name= geladen wie ein frueherer Tag", s.logs);
    assert(s.gelesen.some((g) => g.name === ALT) && s.gelesen.every((g) => Object.keys(g).join() === "name"),
      "Zuletzt gelesen: das ganz geladene fruehere Log wird mit POST /api/gelesen {name} gemeldet", s.gelesen);
    assert(s.ordner.length === 1, "Auftrag 8 oeffnet keinen Ordner", s.ordner);
    const titel = await s.page.evaluate(() => document.querySelector("#kwKnopf")?.textContent || "");
    const datei = await s.page.evaluate(() => document.querySelector("#sbDatei")?.textContent || "");
    assert(titel.includes("·") && datei.includes(ALT), "das fruehere Log ist geladen (Kampfwahl nennt einen Kampf, die Statusleiste die Datei)", { titel, datei });
    // "Kompakt oeffnen" oeffnet nur: ein zweiter Auftrag schliesst Kompakt nicht wieder
    for (const nr of [9, 10]) {
      s.start = { nr, kompakt: true, live: false, logordner: false, log: "" };
      s.counts.start++;
      await bisNode(() => s.win.some((b) => b.do === "starterledigt" && b.nr === nr), "Auftrag " + nr + " quittiert");
      await schlafe(300);
      assert(await s.page.evaluate(() => document.body.classList.contains("compact")), "Auftrag " + nr + " kompakt: Kompakt ist offen");
    }
    assert(!s.fehler.length, "keine Fehler in der Seite (Auftrag, Ereignisse)", s.fehler);
    await s.page.close();
  }

  // --- 7. die Sprache fuer den Hauptprozess: beim Start und bei jedem Wechsel
  {
    const s = await oeffne({ lang: "de" });
    await bisNode(() => s.posts.some((b) => b.lang === "de"), "lang de beim Start");
    assert(s.posts.filter((b) => "lang" in b).every((b) => Object.keys(b).join() === "lang"), "lang geht allein ueber /api/config", s.posts);
    await s.page.evaluate(() => document.querySelector("#btnLang").click());
    await bisNode(() => s.posts.some((b) => b.lang === "en"), "lang en nach dem Wechsel");
    assert(s.posts.filter((b) => "lang" in b).map((b) => b.lang).join() === "de,en", "erst de, nach dem Wechsel en", s.posts);
    await s.page.close();
    const k = await oeffne({ lang: "de", kompakt: true });
    await schlafe(1500);
    assert(!k.posts.some((b) => "lang" in b), "das Kompaktfenster schreibt die Sprache nicht", k.posts);
    await k.page.close();
    // die gespeicherte Sprache stimmt schon: beim Start nichts, nach dem Wechsel die neue
    const g = await oeffne({ lang: "de", config: { lang: "de" } });
    await schlafe(1500);
    assert(!g.posts.some((b) => "lang" in b), "stimmt die gespeicherte Sprache, schreibt die Seite sie beim Start nicht", g.posts);
    await g.page.evaluate(() => document.querySelector("#btnLang").click());
    await bisNode(() => g.posts.some((b) => b.lang === "en"), "lang en nach dem Wechsel");
    assert(g.posts.filter((b) => "lang" in b).length === 1, "nach dem Wechsel genau einmal", g.posts);
    await g.page.close();
  }
  // --- 8. der Abschnitt "Windows" in den Einstellungen (Spezifikation Windows-Einbindung 9, 3.4)
  const WIN = (w = {}, mehr = {}) => ({ windows: { da: true, autostartDa: true, autostart: false, ...w }, ...mehr });
  const zuEinst = async (s) => {
    await s.page.click('#bereiche [data-tab="settings"]');
    await bisWahr(s, () => !document.querySelector("#einst").hidden, "Einstellungen offen");
  };
  const blick = (s) => s.page.evaluate(() => {
    const q = (x) => document.querySelector(x);
    const sicht = (e) => !!e && e.getClientRects().length > 0;
    const sw = (id) => { const b = q(id); return b && { an: b.getAttribute("aria-checked"), aus: b.getAttribute("aria-disabled"), wort: b.querySelector(".esw-w")?.textContent }; };
    return { abschnitt: sicht(q("#eg-win")), nav: sicht(q("#einstNavWin")), navText: (q("#einstNavWin")?.textContent || "").trim(),
      h: (q("#egh-win")?.textContent || "").trim(), auto: sicht(q("#eWinAutoZeile")),
      melden: sw("#eWinMelden"), nurBest: sw("#eWinNurBest"), tray: sw("#eWinTray"), autoSw: sw("#eWinAuto") };
  });
  const gepostet = (s, k) => s.posts.filter((b) => k in b);
  const winSichtbar = (s) => bisWahr(s, () => (document.querySelector("#eg-win")?.getClientRects().length || 0) > 0, "Abschnitt Windows sichtbar").catch(() => false);
  {
    // 8.1 verborgen: im Browser-Tab, im eigenen Fenster ohne windows, mit windows.da false
    for (const [wo, opt] of [["Browser-Tab", { app: false }], ["eigenes Fenster ohne windows", {}],
      ["windows.da false", { config: WIN({ da: false }) }], ["Browser-Tab mit windows", { app: false, config: WIN() }]]) {
      const s = await oeffne(opt);
      await zuEinst(s);
      await schlafe(300);
      const b = await blick(s);
      const navNichtDa = await s.page.evaluate(() => [...document.querySelectorAll("#einstNav button")]
        .filter((x) => x.getClientRects().length > 0).every((x) => x.dataset.gruppe !== "win"));
      assert(!b.abschnitt && !b.nav && navNichtDa, `8.1 ${wo}: Abschnitt Windows und sein Eintrag in der Sprungleiste verborgen`, b);
      assert(!s.fehler.length, `8.1 ${wo}: keine Fehler`, s.fehler);
      await s.page.close();
    }
  }
  {
    // 8.1 sichtbar, 8.2 abhaengig, 8.3 Infobereich, 8.4 Autostart
    const s = await oeffne({ config: WIN() });
    await zuEinst(s);
    await winSichtbar(s);
    let b = await blick(s);
    assert(b.abschnitt && b.nav && b.navText === "Windows" && b.h === "Windows" && b.auto,
      "8.1 mit windows.da: Abschnitt „Windows“ sichtbar, Eintrag in der Sprungleiste, Autostart-Zeile da", b);
    const reihe = await s.page.evaluate(() => [...document.querySelectorAll("#einstNav button")].map((x) => x.dataset.gruppe).join());
    assert(/,dev,win,info$/.test(reihe), "8.1 der Eintrag steht vor Info", reihe);
    assert(b.melden?.an === "false" && b.nurBest?.an === "false" && b.tray?.an === "false" && b.autoSw?.an === "false"
      && b.melden.wort === "Off", "8.1 ab Werk alle vier aus", b);
    assert(b.nurBest?.aus === "true", "8.2 Nur bei neuem Bestwert: aria-disabled, solange Melden aus ist", b.nurBest);
    await s.page.click("#eWinNurBest").catch(() => {});
    await schlafe(200);
    b = await blick(s);
    assert(b.nurBest?.an === "false" && !gepostet(s, "meldenNurBest").length, "8.2 der Klick auf den gesperrten Schalter tut nichts", { b: b.nurBest, posts: s.posts });
    await s.page.click("#eWinMelden").catch(() => {});
    await bisNode(() => gepostet(s, "meldenKampf").length, "meldenKampf gepostet").catch(() => {});
    b = await blick(s);
    assert(JSON.stringify(gepostet(s, "meldenKampf")) === '[{"meldenKampf":true}]' && b.melden?.an === "true" && b.melden.wort === "On",
      "8.2 Melden an: POST /api/config {meldenKampf: true}, der Schalter zeigt an", { posts: s.posts, b: b.melden });
    assert(b.nurBest?.aus === "false", "8.2 mit Melden an ist Nur bei neuem Bestwert bedienbar", b.nurBest);
    await s.page.click("#eWinNurBest").catch(() => {});
    await bisNode(() => gepostet(s, "meldenNurBest").length, "meldenNurBest gepostet").catch(() => {});
    b = await blick(s);
    assert(JSON.stringify(gepostet(s, "meldenNurBest")) === '[{"meldenNurBest":true}]' && b.nurBest?.an === "true",
      "8.2 Nur bei neuem Bestwert: POST /api/config {meldenNurBest: true}", { posts: s.posts, b: b.nurBest });
    await s.page.click("#eWinMelden").catch(() => {});
    await bisNode(() => gepostet(s, "meldenKampf").length === 2, "meldenKampf aus").catch(() => {});
    b = await blick(s);
    assert(gepostet(s, "meldenKampf")[1]?.meldenKampf === false && b.nurBest?.aus === "true",
      "8.2 Melden wieder aus: {meldenKampf: false}, Nur bei neuem Bestwert wieder gesperrt", { posts: s.posts, b: b.nurBest });
    await s.page.click("#eWinTray").catch(() => {});
    await bisNode(() => gepostet(s, "trayBeimSchliessen").length, "tray gepostet").catch(() => {});
    assert(JSON.stringify(gepostet(s, "trayBeimSchliessen")) === '[{"trayBeimSchliessen":true}]' && (await blick(s)).tray?.an === "true",
      "8.3 Beim Schliessen in den Infobereich: POST /api/config {trayBeimSchliessen: true}", s.posts);
    await s.page.click("#eWinAuto").catch(() => {});
    await bisNode(() => s.win.some((x) => x.do === "autostart"), "autostart gesendet").catch(() => {});
    await bisWahr(s, () => document.querySelector("#eWinAuto")?.getAttribute("aria-checked") === "true", "Autostart an").catch(() => {});
    const auto = s.win.filter((x) => x.do === "autostart");
    assert(auto.length === 1 && auto[0].an === true && (await blick(s)).autoSw?.an === "true" && !gepostet(s, "autostart").length,
      "8.4 Mit Windows starten: POST /api/win {do: \"autostart\", an: true}, der Schalter folgt der Antwort, nichts in /api/config", { auto, posts: s.posts });
    assert(s.posts.every((x) => Object.keys(x).length === 1),
      "8.2-8.4 jeder Schalter schreibt genau einen Schluessel", s.posts);

    // 8.5 Tastatur und Vorleser
    await s.page.focus("#egh-win").catch(() => {});
    const wege = [];
    for (let i = 0; i < 4; i++) { await s.page.keyboard.press("Tab"); wege.push(await s.page.evaluate(() => document.activeElement?.id)); }
    assert(wege.join() === "eWinMelden,eWinNurBest,eWinTray,eWinAuto", "8.5 Tab erreicht die vier Schalter in ihrer Reihenfolge (auch den gesperrten)", wege);
    await s.page.focus("#eWinTray").catch(() => {});
    await s.page.keyboard.press("Space");
    await bisNode(() => gepostet(s, "trayBeimSchliessen").length === 2, "tray per Leertaste").catch(() => {});
    await s.page.keyboard.press("Enter");
    await bisNode(() => gepostet(s, "trayBeimSchliessen").length === 3, "tray per Enter").catch(() => {});
    assert(gepostet(s, "trayBeimSchliessen").map((x) => x.trayBeimSchliessen).join() === "true,false,true",
      "8.5 Leertaste und Enter schalten wie der Klick", s.posts);
    await s.page.focus("#eWinNurBest").catch(() => {});
    await s.page.keyboard.press("Space");
    await schlafe(200);
    assert(gepostet(s, "meldenNurBest").length <= 1, "8.5 die Leertaste auf dem gesperrten Schalter tut nichts", s.posts);
    const namen = await s.page.evaluate(() => ["eWinMelden", "eWinNurBest", "eWinTray", "eWinAuto"].map((id) => {
      const b = document.getElementById(id);
      if (!b) return { id, da: false };
      const ids = (b.getAttribute("aria-labelledby") || "").split(/\s+/).filter(Boolean);
      return { id, rolle: b.getAttribute("role"), typ: b.getAttribute("type"), ids,
        da: ids.length > 0 && ids.every((x) => (document.getElementById(x)?.textContent || "").trim()) };
    }));
    assert(namen.every((n) => n.rolle === "switch" && n.typ === "button" && n.da), "8.5 jeder Schalter role=switch, Name ueber aria-labelledby", namen);
    for (const [name, id] of [["Notify after every fight", "eWinMelden"], ["Only for a new best", "eWinNurBest"],
      ["Close to the notification area", "eWinTray"], ["Start with Windows", "eWinAuto"]]) {
      const n = await s.page.getByRole("switch", { name, exact: true }).evaluateAll((els) => els.map((e) => e.id));
      assert(n.length === 1 && n[0] === id, `8.5 der Vorleser findet den Schalter „${name}“`, n);
    }
    // die Sprungleiste: der Eintrag springt zum Abschnitt
    await s.page.evaluate(() => window.scrollTo(0, 0));
    await s.page.click("#einstNavWin").catch(() => {});
    await bisWahr(s, () => document.activeElement?.id === "egh-win", "Sprung nach Windows").catch(() => {});
    assert(await s.page.evaluate(() => document.activeElement?.id === "egh-win" && document.querySelector("#einstNavWin")?.getAttribute("aria-current") === "true"),
      "8.1 der Eintrag in der Sprungleiste springt zum Abschnitt, Fokus auf der Ueberschrift, er leuchtet");
    assert(!s.fehler.length, "8.1-8.5 keine Fehler", s.fehler);
    await s.page.close();
  }
  {
    // 8.4 ohne Autostart (autostartDa false): die Zeile verborgen; der gespeicherte Stand steht in den Schaltern
    const s = await oeffne({ lang: "de", config: WIN({ autostartDa: false }, { meldenKampf: true, meldenNurBest: true, trayBeimSchliessen: true }) });
    await zuEinst(s);
    await winSichtbar(s);
    const b = await blick(s);
    assert(b.abschnitt && !b.auto, "8.4 autostartDa false: die Zeile „Mit Windows starten“ ist verborgen", b);
    assert(b.melden?.an === "true" && b.nurBest?.an === "true" && b.nurBest.aus === "false" && b.tray?.an === "true" && b.melden.wort === "An",
      "8.1 der Stand aus /api/config steht in den Schaltern", b);
    const de = await s.page.evaluate(() => ["eWinMeldenName", "eWinNurBestName", "eWinTrayName", "eWinAutoName"].map((id) => document.getElementById(id)?.textContent.trim()));
    assert(de.join("|") === "Nach jedem Kampf melden|Nur bei neuem Bestwert|Beim Schließen in den Infobereich|Mit Windows starten",
      "8.1 die Namen auf Deutsch", de);
    assert(!s.fehler.length, "8.4 keine Fehler", s.fehler);
    await s.page.close();
  }
  // 8.6 alle vier Themen (glas seit Rauchglas #55) bei 560 Punkt: kein waagerechtes Rollen, keine neue Schrift, eingerueckt
  for (const theme of ["dark", "light", "tnl", "glas"]) {
    const s = await oeffne({ config: WIN({}, { theme }), breite: 560, hoehe: 860 });
    await zuEinst(s);
    await winSichtbar(s);
    const m = await s.page.evaluate(() => {
      const g = document.querySelector("#eg-win");
      if (!g) return null;
      g.scrollIntoView();
      const r = (q) => document.querySelector(q)?.getBoundingClientRect() || { left: 0 };
      const schriften = (e) => [e, ...e.querySelectorAll("*")].map((x) => getComputedStyle(x).fontFamily);
      // keine neue Schrift: nur Familien, die die anderen Abschnitte der Einstellungen schon tragen
      const da = new Set([...document.querySelectorAll("#einst section.egruppe:not(#eg-win)")].flatMap(schriften));
      return { thema: document.documentElement.dataset.theme, sw: document.documentElement.scrollWidth, sicht: g.getClientRects().length > 0,
        fremd: [...new Set(schriften(g))].filter((f) => !da.has(f)),
        einMelden: r("#eWinMeldenName").left, einNurBest: r("#eWinNurBestName").left,
        rechts: Math.max(...[...g.querySelectorAll(".esw")].map((e) => e.getBoundingClientRect().right)) };
    });
    assert(m && m.thema === theme && m.sicht && m.sw <= 560 && m.rechts <= 560, `8.6 ${theme} bei 560 Punkt: sichtbar, kein waagerechtes Rollen`, m);
    assert(m && !m.fremd.length, `8.6 ${theme}: keine neue Schrift (nur die der anderen Abschnitte)`, m?.fremd);
    assert(m && m.einNurBest > m.einMelden + 8, `8.6 ${theme}: Nur bei neuem Bestwert steht eingerueckt unter Melden`, m);
    assert(!s.fehler.length, `8.6 ${theme}: keine Fehler`, s.fehler);
    await s.page.close();
  }
} catch (err) {
  failed++;
  console.log("  FAIL  " + (err && err.stack || err));
} finally {
  await browser.close();
}

console.log(failed ? `\n${failed} FAILED` : "\nall passed");
process.exit(failed ? 1 : 0);
