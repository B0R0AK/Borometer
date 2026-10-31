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
async function oeffne({ app = true, kompakt = false, teil = null, lang = "en", uhr = false, start = null, config = {}, grenze = 0, breite = 1280, hoehe = 860,
  vollStand = null, mica = false, logVerzug = 0, logExtra = "" } = {}) {
  const page = await browser.newPage({ viewport: { width: breite, height: hoehe } });
  const s = { page, fehler: [], posts: [], schreib: [], win: [], ordner: [], gelesen: [], latest: [], logs: [],
    text: Buffer.from(LOG), start, counts: { pin: 0, start: 0 }, config, vollStand };
  page.on("pageerror", (e) => s.fehler.push(String(e)));
  await page.addInitScript((l) => { try { localStorage.clear(); localStorage.setItem("boroLang", l); } catch { /* blockiert */ } }, lang);
  if (uhr) await page.clock.install();
  await page.route("http://boro.test/**", async (route) => {
    const req = route.request(), url = new URL(req.url()), path = url.pathname;
    const json = (body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) }).catch(() => {});
    const gesendet = () => JSON.parse(req.postData() || "{}");
    // jede schreibende Anfrage ausser /api/win, mit Pfad (fuer "das abgerissene Fenster schreibt nichts")
    if (req.method() !== "GET" && path !== "/api/win") s.schreib.push(path);
    if (path === "/api/state") return json({ dir: "C:\\Logs", file: LOGNAME, size: s.text.length, mtime: s.text.length,
      nativeFrame: app, material: false, stayOnTop: false, start: s.start, kompakt: s.vollStand, mica });
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
      if (logVerzug) await schlafe(logVerzug);
      if (name !== ALT) return json({ ok: false }, 404);
      const b = Buffer.from(LOG + logExtra);
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
  await page.goto("http://boro.test/index.html" + (app ? "?win=1" + (kompakt ? "&kompakt=1" : "") + (teil ? "&teil=" + teil : "") : ""));
  await bisWahr(s, () => document.body.dataset.bereit === "ordner", "Seite fertig");
  return s;
}
/* Wartet in echter Zeit, bis fn in der Seite wahr ist (nicht waitForFunction:
   unter page.clock ruehrt sich dessen Takt nicht). Mit Uhr laeuft sie in
   kleinen Schritten mit, damit Takte der Seite kommen. */
async function bisWahr(s, fn, was, arg, uhr = false) {
  for (const ende = performance.now() + 20000; performance.now() < ende; ) {
    if (await s.page.evaluate(fn, arg)) return true;
    if (uhr) await s.page.clock.runFor(100);
    await schlafe(50);
  }
  throw new Error("Zeit abgelaufen: " + was);
}
async function bisNode(cond, was) {
  for (const ende = performance.now() + 20000; performance.now() < ende; ) { if (cond()) return true; await schlafe(50); }
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
  for (const ende = performance.now() + 20000; performance.now() < ende && !s.latest.includes(alt); ) await laufe(s, 1000);
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

  // --- Tafelmenue (Windows Teil 2): Rechtsklick, Umschalt+F10, Kopieren, In Rotation zeigen
  console.log("Tafelmenue (Teil 2)");
  /* Wartet auf Zustand (nicht auf Zeit): bis ein POST an /api/win, den pred
     erkennt, angekommen ist; Frist ueber performance.now() (#338). */
  const warteAufPost = async (s, pred, was) => {
    for (const ende = performance.now() + 20000; performance.now() < ende; ) {
      if (s.win.some(pred)) return true;
      await schlafe(25);
    }
    throw new Error("Zeit abgelaufen: " + was);
  };
  /* Live einschalten (liest den Auszug ganz); die Tafel steht, sobald der Bereich
     Kampf frei ist und eine Zeile hat. */
  const ladeKampf = async (s) => {
    await s.page.evaluate(() => document.querySelector("#btnWatch").click());
    await bisNode(() => s.latest.includes(0), "das erste ganze Laden");
    await bisWahr(s, () => !document.querySelector('[data-tab="timeline"]').disabled, "Kampf geladen");
    await s.page.evaluate(() => { document.querySelector('[data-tab="timeline"]').click(); });
    await bisWahr(s, () => !!document.querySelector("#bars .row"), "Tafel mit Zeilen");
  };
  {
    const s = await oeffne({ app: true, lang: "de" });
    await ladeKampf(s);
    await s.page.locator("#bars .row").first().click({ button: "right" });
    await warteAufPost(s, (b) => b.do === "menue", "menue gesendet");
    assert(s.win.some((b) => b.do === "menue" && b.art === "zeile" && !("label" in b)), "Rechtsklick auf die Zeile sendet menue/zeile ohne Text", s.win);
    const vorher = await s.page.evaluate(() => document.querySelector(".tab.on")?.dataset.tab);
    // die Wahl "In Rotation zeigen" kommt als Zaehler zurueck
    s.counts.menuerotation = 1;
    await bisWahr(s, () => document.querySelector(".tab.on")?.dataset.tab === "rotation", "Rotation offen");
    assert(vorher !== "rotation", "vorher nicht in Rotation", vorher);
    // die Faehigkeit einer Zeile mit Einsaetzen bleibt hervorgehoben, auch ohne Zeigen; ohne Einsaetze dimmt nichts
    let n = 1, getroffen = false;
    for (let i = 0; i < 8 && !getroffen; i++) {
      await s.page.evaluate(() => document.querySelector('[data-tab="timeline"]').click());
      await bisWahr(s, () => !!document.querySelector("#bars .row"), "Tafel mit Zeilen");
      // zwei Anfragen binnen 400 ms sind eine: die Uhr der Seite abwarten
      const frei = await s.page.evaluate(() => performance.now() + 450);
      await bisWahr(s, (t) => performance.now() > t, "Menue-Abstand", frei);
      const m = s.win.length;
      await s.page.locator("#bars .row").nth(i).click({ button: "right" });
      await bisNode(() => s.win.length > m, "menue gesendet (Zeile " + i + ")");
      s.counts.menuerotation = ++n;
      await bisWahr(s, () => document.querySelector(".tab.on")?.dataset.tab === "rotation", "Rotation offen");
      const z = await s.page.evaluate(() => ({ hebt: document.querySelector("#rotBar")?.classList.contains("hebt"), an: document.querySelectorAll("#rotBar .an").length }));
      assert(z.hebt === (z.an > 0), "hebt nur, wenn die Faehigkeit Einsaetze hat", z);
      getroffen = z.an > 0;
    }
    assert(getroffen, "mindestens eine Zeile hebt ihre Faehigkeit in der Rotation hervor");
    // der naechste Klick loest es
    await s.page.evaluate(() => document.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true })));
    await bisWahr(s, () => !document.querySelector("#rotBar")?.classList.contains("hebt"), "Hervorhebung nach Klick geloest");
    await s.page.close();
  }
  {
    // Kopieren: Faehigkeit und Wert der Zeile landen in der Zwischenablage
    const s = await oeffne({ app: true, lang: "de" });
    /* http://boro.test ist kein sicherer Ursprung, dort gibt es navigator.clipboard
       nicht (in der App ist es 127.0.0.1): ein Stand-in nimmt den Text entgegen. */
    await s.page.addInitScript(() => {
      Object.defineProperty(navigator, "clipboard", { configurable: true, value: {
        writeText: (t) => { window.__kopiert = String(t); return Promise.resolve(); } } });
    });
    await s.page.reload();
    await bisWahr(s, () => document.body.dataset.bereit === "ordner", "Seite fertig nach dem Neuladen");
    await ladeKampf(s);
    await s.page.locator("#bars .row").first().click({ button: "right" });
    await warteAufPost(s, (b) => b.do === "menue", "menue gesendet");
    s.counts.menuekopieren = 1;
    await bisWahr(s, () => typeof window.__kopiert === "string", "Zwischenablage gefuellt");
    const text = await s.page.evaluate(() => window.__kopiert);
    assert(/\d/.test(text) && !/<|>/.test(text), "Kopiert: Faehigkeit und Wert als einfacher Text", text);
    await s.page.close();
  }
  {
    // Umschalt+F10 an der fokussierten Zeile oeffnet dasselbe Menue
    const s = await oeffne({ app: true });
    await ladeKampf(s);
    await s.page.locator("#bars .row").first().focus();
    await s.page.keyboard.press("Shift+F10");
    await warteAufPost(s, (b) => b.do === "menue", "menue gesendet");
    assert(s.win.some((b) => b.do === "menue"), "Umschalt+F10 sendet menue", s.win);
    // F5: kommt dazu Chromiums eigenes contextmenu-Ereignis der Tastatur, bleibt es bei einem Aufruf
    await s.page.evaluate(() => document.querySelector("#bars .row").dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true })));
    await s.page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    const n = s.win.filter((b) => b.do === "menue").length;
    assert(n === 1, "Umschalt+F10 plus contextmenu: genau ein menue-Aufruf", n);
    await s.page.close();
  }
  {
    // F4: im Kompakt im selben Fenster zeigt der Rechtsklick auf eine Zeile kein Menue
    const s = await oeffne({ app: true });
    await ladeKampf(s);
    await s.page.evaluate(() => {
      document.body.classList.add("compact");
      document.querySelector("#bars .row").dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true }));
    });
    await s.page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    assert(!s.win.some((b) => b.do === "menue"), "im Kompakt kein menue-Aufruf", s.win);
    await s.page.close();
  }
  {
    // F1: Strg+C an der fokussierten Zeile kopiert wie "Kopieren" - nur ohne markierten Text
    const s = await oeffne({ app: true, lang: "de" });
    await s.page.addInitScript(() => {
      Object.defineProperty(navigator, "clipboard", { configurable: true, value: {
        writeText: (t) => { window.__kopiert = String(t); return Promise.resolve(); } } });
    });
    await s.page.reload();
    await bisWahr(s, () => document.body.dataset.bereit === "ordner", "Seite fertig nach dem Neuladen");
    await ladeKampf(s);
    await s.page.locator("#bars .row").first().focus();
    // mit Markierung: Strg+C bleibt dem Browser
    await s.page.evaluate(() => {
      /* der Koerper erlaubt kein Markieren (user-select:none); code ist ausgenommen (styles.css) */
      const n = document.createElement("code"); n.textContent = "markiert"; document.body.appendChild(n);
      const r = document.createRange(); r.selectNodeContents(n);
      const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r);
    });
    await s.page.keyboard.press("Control+C");
    await s.page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    assert(await s.page.evaluate(() => window.__kopiert) === undefined, "Strg+C mit markiertem Text wird nicht abgefangen");
    // ohne Markierung: die Zeile wird kopiert
    await s.page.evaluate(() => getSelection().removeAllRanges());
    await s.page.keyboard.press("Control+C");
    await bisWahr(s, () => typeof window.__kopiert === "string", "Strg+C kopiert die Zeile");
    const text = await s.page.evaluate(() => window.__kopiert);
    assert(/\d/.test(text) && !/<|>/.test(text), "Strg+C: Faehigkeit und Wert als einfacher Text", text);
    await s.page.close();
  }
  {
    // F3: scheitert das Kopieren (Zwischenablage lehnt ab, Textfeld-Befehl gibt false), sagt es der Toast
    const s = await oeffne({ app: true, lang: "de" });
    await s.page.addInitScript(() => {
      Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: () => Promise.reject(new Error("nein")) } });
      document.execCommand = () => false;
    });
    await s.page.reload();
    await bisWahr(s, () => document.body.dataset.bereit === "ordner", "Seite fertig nach dem Neuladen");
    await ladeKampf(s);
    await s.page.locator("#bars .row").first().click({ button: "right" });
    await warteAufPost(s, (b) => b.do === "menue", "menue gesendet");
    s.counts.menuekopieren = 1;
    await bisWahr(s, () => document.getElementById("toast").textContent === "Kopieren hat nicht geklappt", "Toast zum Scheitern");
    await s.page.close();
  }
  {
    // Browser ohne App und Kompaktfenster: kein Aufruf, kein Menue
    for (const opt of [{ app: false }, { app: true, kompakt: true }]) {
      const s = await oeffne(opt);
      await s.page.locator("body").click({ button: "right" });
      // nichts zu erwarten: zwei gezeichnete Bilder abwarten, dann steht fest, dass kein Aufruf folgt
      await s.page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
      assert(!s.win.some((b) => b.do === "menue"), "kein menue-Aufruf (" + JSON.stringify(opt) + ")", s.win);
      await s.page.close();
    }
  }

  // --- Abreissen (Windows Teil 2): ein Bereich in ein eigenes Fenster
  console.log("Abreissen (Teil 2)");
  /* Der Stand, den die Vollansicht fuer eine Datei meldet (Name und Start des
     gewaehlten Kampfs), aus dem ersten Fall unten - mit dem Namen ALT, den der
     gestellte Helfer ueber /api/log ausliefert (derselbe Auszug). */
  let vollDatei = null;
  {
    const s = await oeffne({ app: true, lang: "de" });
    // auf Start (ohne Bereich) kein Knopf
    const aufStart = await s.page.evaluate(() => document.querySelector("#btnAbreissen")?.hidden);
    assert(aufStart === true, "auf Start kein Knopf zum Abreissen", aufStart);
    await ladeKampf(s);
    await s.page.evaluate(() => { document.querySelector('[data-tab="analysis"]').click(); });
    await bisWahr(s, () => document.querySelector(".tab.on")?.dataset.tab === "analysis", "Analyse offen");
    const name = await s.page.evaluate(() => document.querySelector("#btnAbreissen").getAttribute("aria-label"));
    assert(name === "In eigenem Fenster", "der Knopf heisst fuer den Vorleser \"In eigenem Fenster\"", name);
    await s.page.locator("#btnAbreissen").click();
    await warteAufPost(s, (b) => b.do === "abreissen", "abreissen gesendet");
    assert(s.win.some((b) => b.do === "abreissen" && b.teil === "analyse" && b.win === "main"), "Knopf sendet abreissen/analyse", s.win);
    const iStand = s.win.findIndex((b) => b.do === "stand"), iAb = s.win.findIndex((b) => b.do === "abreissen");
    assert(iStand >= 0 && iStand < iAb, "vor dem Abreissen geht der Stand der Vollansicht hinaus", s.win);
    // die Vollansicht zeigt etwas anderes (Live aus: jetzt die Datei): der Stand geht wieder hinaus, das Fenster folgt
    const vorher = s.win.filter((b) => b.do === "stand").length;
    await s.page.evaluate(() => { document.querySelector("#btnWatch").click(); });
    await bisNode(() => s.win.filter((b) => b.do === "stand").length > vorher, "Stand nach dem Ende von Live");
    assert(s.win.filter((b) => b.do === "stand").at(-1).grund === "datei", "der neue Stand nennt die Datei", s.win.filter((b) => b.do === "stand"));
    const gemeldet = s.win.filter((b) => b.do === "stand").at(-1);
    assert(Number.isSafeInteger(gemeldet.kampf), "der Stand nennt den Start des gewaehlten Kampfs", gemeldet);
    vollDatei = { grund: "datei", datei: ALT, kampf: gemeldet.kampf };
    /* Gegenprobe zu "das abgerissene Fenster schreibt nichts": die Vollansicht schreibt fuer dasselbe Log
       einen besten Pull (46, 3 s nach dem Ende von Live) - die Pruefung unten ist also nicht leer. */
    await bisNode(() => s.schreib.includes("/api/best"), "Vollansicht schreibt den besten Pull");
    assert(s.schreib.includes("/api/best"), "Gegenprobe: die Vollansicht schreibt fuer dieses Log /api/best", s.schreib);
    // die Einstellungen sind kein Bereich zum Abreissen
    await s.page.evaluate(() => { document.querySelector('[data-tab="settings"]').click(); });
    await bisWahr(s, () => document.querySelector("#btnAbreissen").hidden === true, "kein Knopf in den Einstellungen");
    await s.page.close();
  }
  {
    // Kompakt im selben Fenster (ohne Kompaktfenster): der Streifen hat keinen Knopf zum Abreissen
    const s = await oeffne({ app: true });
    await ladeKampf(s);
    await s.page.evaluate(() => { document.querySelector('[data-tab="analysis"]').click(); });
    await bisWahr(s, () => !document.querySelector("#btnAbreissen").hidden, "Knopf in der Analyse");
    await s.page.evaluate(() => { document.querySelector("#btnCompact").click(); });
    await bisWahr(s, () => document.body.classList.contains("compact"), "Kompakt im selben Fenster");
    const z = await s.page.evaluate(() => document.querySelector("#btnAbreissen").getClientRects().length);
    assert(z === 0, "im Kompakt kein Knopf zum Abreissen", z);
    await s.page.close();
  }
  {
    // im Browser-Tab gibt es den Knopf nicht
    const s = await oeffne({ app: false });
    await ladeKampf(s).catch(() => {});
    const z = await s.page.evaluate(() => document.querySelector("#btnAbreissen")?.hidden);
    assert(z === true, "im Browser-Tab kein Knopf zum Abreissen", z);
    await s.page.close();
  }
  for (const breite of [1280, 560]) {
    // die Seite im Abriss-Fenster: nur dieser Bereich, ohne Bereichsleiste, schreibt nichts
    const s = await oeffne({ app: true, teil: "analyse", lang: "de", breite, vollStand: vollDatei });
    await bisWahr(s, () => !!document.querySelector("#app:not([hidden])"), "Abriss-Seite zeigt den Kampf");
    const z = await s.page.evaluate(() => ({
      teil: document.body.dataset.abriss,
      bereich: document.querySelector(".tab.on")?.dataset.tab,
      leiste: getComputedStyle(document.querySelector("#bereiche")).display,
      knopf: getComputedStyle(document.querySelector("#btnAbreissen")).display,
      live: getComputedStyle(document.querySelector("#btnWatch")).display,
      einst: getComputedStyle(document.querySelector("#btnEinst")).display,
      start: !document.querySelector("#land") || document.querySelector("#land").hidden,
      breit: document.documentElement.scrollWidth <= window.innerWidth,
      name: (() => { const n = document.querySelector("#abrissName");
        return n ? { text: n.textContent.trim(), sichtbar: n.getClientRects().length > 0, imKopf: !!n.closest("header.top"),
          rechts: n.getBoundingClientRect().right <= window.innerWidth } : null; })(),
    }));
    assert(z.teil === "analyse" && z.bereich === "analysis", "Abriss-Seite zeigt Analyse (" + breite + ")", z);
    assert(z.name && z.name.text === "Analyse" && z.name.sichtbar && z.name.imKopf && z.name.rechts,
      "der Kopf nennt den Bereich als Text (" + breite + ")", z.name);
    assert(z.leiste === "none" && z.knopf === "none", "Abriss-Seite ohne Bereichsleiste und ohne Knopf (" + breite + ")", z);
    assert(z.live === "none" && z.einst === "none", "Abriss-Seite ohne Live und Einstellungen im Kopf (" + breite + ")", z);
    assert(z.start, "Abriss-Seite ohne Startseite (" + breite + ")", z);
    assert(z.breit, "kein waagerechtes Rollen (" + breite + ")", z);
    /* Die Wege der Analyse in andere Bereiche (Rotation: .inrot, Rekorde: .wbrk) fuehren im Fenster
       nirgends hin: sie sind nicht zu sehen und nicht zu erreichen (keine Box). */
    await bisWahr(s, () => !!document.querySelector("#p-analysis .inrot"), "Analyse mit Weg in die Rotation");
    const wege = await s.page.evaluate(() => [...document.querySelectorAll("#p-analysis :is(.inrot, .wbrk), #histCmp")]
      .map((b) => ({ k: b.className || b.id, boxen: b.getClientRects().length })));
    assert(wege.length > 0 && wege.every((w) => w.boxen === 0), "Analyse: kein Weg in einen anderen Bereich zu sehen (" + breite + ")", wege);
    // die Seite hat einen Augenblick gelebt: zwei gezeichnete Bilder, dann ist entschieden, was sie gesendet hat
    await s.page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    assert(s.win.every((b) => b.win === "abriss" && (b.do === "chrome" || b.do === "close")), "Abriss-Seite sendet nur close/chrome mit win=abriss", s.win);
    assert(s.posts.length === 0 && s.schreib.length === 0, "Abriss-Seite schreibt nichts", s.schreib);
    assert(!s.fehler.length, "keine Fehler in der Seite", s.fehler);
    await s.page.close();
  }
  for (const teil of ["kampf", "rotation", "analyse", "vergleich"]) {
    /* Das Fenster hat seine Standardgroesse (900 x 640): jeder Bereich beginnt oben, mit seinem Kopf - die Seite ist nicht
       gerollt, und was in der Vollansicht oben steht (bei der Rotation der Satz und die Zoomleiste), ist zu sehen. */
    const s = await oeffne({ app: true, teil, lang: "en", breite: 900, hoehe: 640, vollStand: vollDatei });
    await bisWahr(s, (q) => !!document.querySelector(q), "Bereich gezeichnet",
      { kampf: "#bars .row", rotation: "#rotBar > *", analyse: "#p-analysis .inrot", vergleich: "#p-compare *" }[teil]);
    const z = await s.page.evaluate(() => {
      const im = (q) => { const e = document.querySelector(q); if (!e) return null; const r = e.getBoundingClientRect();
        return e.getClientRects().length > 0 && r.top >= 0 && r.bottom <= innerHeight; };
      return { rollt: scrollY, name: im("#abrissName"), satz: im("#deineRotLead"), zoom: im('#p-rotation [data-act="apply"]') };
    });
    assert(z.rollt === 0 && z.name === true, "Abriss " + teil + " 900 x 640: beginnt oben, der Kopf nennt den Bereich", z);
    if (teil === "rotation") assert(z.satz === true && z.zoom === true, "Abriss Rotation 900 x 640: Satz und Zoomleiste stehen im Bild", z);
    await s.page.close();
  }
  {
    /* Ein anderer Kampf der Vollansicht: das Fenster beginnt oben (es hat keine Bereichsleiste, die zurueckfuehrte),
       auch wenn es vorher gerollt war. Der zweite Kampf kommt ans Ende des Logs; die Antwort des Helfers kommt spaet. */
    const zweiter = ENDE + 120000;
    const s = await oeffne({ app: true, teil: "rotation", lang: "en", breite: 900, hoehe: 640, vollStand: vollDatei, logExtra: kampf(zweiter, "Gegner Z"), logVerzug: 400 });
    await bisWahr(s, () => !!document.querySelector("#rotBar > *"), "Rotation gezeichnet");
    await s.page.evaluate(() => scrollTo(0, 40));
    const gerollt = await s.page.evaluate(() => scrollY);
    s.vollStand = { grund: "datei", datei: ALT, kampf: zweiter }; s.counts.kompaktstand = 1;
    await bisWahr(s, () => scrollY === 0, "anderer Kampf: oben");
    assert(gerollt > 0, "Gegenprobe: das Fenster war gerollt", gerollt);
    await s.page.close();
  }
  for (const theme of ["dark", "light", "tnl", "glas"]) {
    /* Die vier Themen bei 560 Punkt; im Rauchglas liegt das Fenster auf Acrylic (window.ts,
       materialSetzen wie die Vollansicht): die Seite zeichnet denselben Glasgrund (html.mica). */
    const s = await oeffne({ app: true, teil: "vergleich", breite: 560, config: { theme }, mica: theme === "glas", vollStand: vollDatei });
    await bisWahr(s, (th) => document.documentElement.dataset.theme === th && !document.querySelector("#app").hidden, "Thema und Kampf", theme);
    const z = await s.page.evaluate(() => ({
      breit: document.documentElement.scrollWidth <= window.innerWidth,
      mica: document.documentElement.classList.contains("mica"),
      grund: getComputedStyle(document.body).backgroundColor,
      html: getComputedStyle(document.documentElement).backgroundColor,
    }));
    assert(z.breit, "Abriss-Seite " + theme + " bei 560: kein waagerechtes Rollen", z);
    const nameV = await s.page.evaluate(() => document.querySelector("#abrissName").textContent.trim());
    assert(nameV === "Compare", "der Kopf nennt den Bereich (en, " + theme + ")", nameV);
    if (theme === "glas") assert(z.mica && z.html === "rgba(0, 0, 0, 0)" && /0\.35\)$/.test(z.grund), "Abriss-Seite glas: der Glasgrund wie in der Vollansicht", z);
    else assert(!z.mica, "Abriss-Seite " + theme + ": kein Glasgrund", z);
    assert(s.posts.length === 0 && !s.schreib.length, "Abriss-Seite " + theme + ": schreibt nichts, auch das Thema nicht", s.schreib);
    await s.page.close();
  }
  {
    // unbekannter teil faellt auf die Vollansicht zurueck
    const s = await oeffne({ app: true, teil: "einstellungen" });
    const z = await s.page.evaluate(() => document.body.dataset.abriss ?? null);
    assert(z === null, "unbekannter teil: keine Abriss-Seite", z);
    await s.page.close();
  }
  {
    // sie folgt dem Kampf der Vollansicht (Datei und Start aus /api/state, Bytes ueber /api/log)
    const s = await oeffne({ app: true, teil: "kampf", lang: "de", vollStand: vollDatei, uhr: true });
    await bisWahr(s, () => document.body.dataset.abriss === "kampf", "Abriss-Seite steht", undefined, true);
    await bisWahr(s, () => !!document.querySelector("#bars .row"), "folgt: Tafel mit Zeilen", undefined, true);
    assert(s.logs.includes(ALT), "folgt: holt die Datei der Vollansicht ueber /api/log", s.logs);
    // Kampf speichern gehoert der Vollansicht: hier nicht zu sehen
    const knoepfe = await s.page.evaluate(() => ["#btnSaveRun", "#bkSpeichern"].map((q) => document.querySelector(q).getClientRects().length));
    assert(knoepfe.every((n) => n === 0), "kein Kampf speichern im abgerissenen Fenster", knoepfe);
    const nameK = await s.page.evaluate(() => document.querySelector("#abrissName").textContent.trim());
    assert(nameK === "Kampf", "der Kopf nennt den Bereich (de): Kampf", nameK);
    // die Wege der Tafel in andere Bereiche (Analyse, Rotation, Vergleich) sind im Fenster nicht zu sehen
    const wegeK = await s.page.evaluate(() => ["#urteilAnalyse", "#spurenAuf", "#btnBestPull"]
      .map((q) => ({ q, boxen: document.querySelector(q)?.getClientRects().length ?? -1 })));
    assert(wegeK.every((w) => w.boxen === 0), "Kampf: kein Weg in einen anderen Bereich zu sehen", wegeK);
    // und wirkt nicht, wenn er doch ausgeloest wird (switchTab, 34): der Bereich bleibt
    await s.page.evaluate(() => { document.querySelector("#urteilAnalyse").click(); });
    await s.page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    const tab = await s.page.evaluate(() => document.querySelector(".tab.on")?.dataset.tab);
    assert(tab === "timeline", "ein Weg in einen anderen Bereich laesst das Fenster im Bereich Kampf", tab);
    /* Der beste Pull schreibt 3 s nach dem Laden (46, planeSchreiben): die Uhr der
       Seite laeuft darueber hinweg; eine Anfrage danach ist erst beantwortet, wenn
       jede davor beim Helfer war. */
    await s.page.clock.runFor(5000);
    await s.page.evaluate(() => fetch("/api/state").then((r) => r.json()));
    assert(s.schreib.length === 0, "folgt: keine schreibende Anfrage, auch nicht an /api/best", s.schreib);
    // die Vollansicht ist jetzt ohne Kampf: das Fenster sagt es (Ereignis kompaktstand)
    s.vollStand = { grund: "leer", datei: "", kampf: null };
    s.counts.kompaktstand = 1;
    await bisWahr(s, () => { const l = document.querySelector("#abrissLeer"); return !!l && !l.hidden; }, "folgt: leerer Zustand", undefined, true);
    const satz = await s.page.evaluate(() => document.querySelector("#abrissLeer").textContent.trim());
    assert(satz === "Noch kein Kampf in der Vollansicht.", "der leere Zustand sagt es", satz);
    assert(s.posts.length === 0, "auch beim Folgen keine Config", s.posts);
    await s.page.close();
  }
  {
    // Live in der Vollansicht: das Fenster liest dieselbe Datei mit (/api/latest), schreibt aber nichts
    const s = await oeffne({ app: true, teil: "rotation", lang: "de", vollStand: { grund: "live", datei: "", kampf: null } });
    await bisNode(() => s.latest.includes(0), "Live: das Fenster liest die Datei der Vollansicht");
    await bisWahr(s, () => !document.querySelector("#app").hidden, "Live: der Kampf steht");
    const tab = await s.page.evaluate(() => document.querySelector(".tab.on")?.dataset.tab);
    assert(tab === "rotation", "Live: bleibt im Bereich Rotation", tab);
    const nameR = await s.page.evaluate(() => document.querySelector("#abrissName").textContent.trim());
    assert(nameR === "Rotation", "der Kopf nennt den Bereich (de): Rotation", nameR);
    assert(s.posts.length === 0 && !s.schreib.length && !s.gelesen.length && !s.win.some((b) => b.do === "kampf"),
      "Live: nichts geschrieben, kein Zuletzt gelesen, keine Meldung", { schreib: s.schreib, gelesen: s.gelesen, win: s.win });
    await s.page.close();
  }

  // --- Folgefixes zum abgerissenen Fenster (#347, #350, #351, #352)
  console.log("Abreissen: Folgefixes");
  for (const [grund, wort, satzDe] of [["beispiel", "sample", "Beispielkampf"], ["archiv", "archive", "Archiv"]]) {
    // #352: zeigt die Vollansicht ein Beispiel oder einen Archivkampf, sagt der Leertext das und nicht "kein Kampf"
    const s = await oeffne({ app: true, teil: "kampf", lang: "en", vollStand: { grund, datei: "", kampf: null } });
    await bisWahr(s, () => { const l = document.querySelector("#abrissLeer"); return !!l && !l.hidden; }, "Leertext steht (" + grund + ")");
    const satz = await s.page.evaluate(() => document.querySelector("#abrissLeer").textContent.trim());
    assert(satz.toLowerCase().includes(wort) && !/no fight/i.test(satz), "#352 en: der Leertext nennt " + grund, satz);
    await s.page.close();
    const d = await oeffne({ app: true, teil: "kampf", lang: "de", vollStand: { grund, datei: "", kampf: null } });
    await bisWahr(d, () => { const l = document.querySelector("#abrissLeer"); return !!l && !l.hidden; }, "Leertext steht de (" + grund + ")");
    const satzD = await d.page.evaluate(() => document.querySelector("#abrissLeer").textContent.trim());
    assert(satzD.includes(satzDe) && !/Noch kein Kampf/.test(satzD), "#352 de: der Leertext nennt " + grund, satzD);
    await d.page.close();
  }
  {
    // #351: Strg+K, Strg+Pfeile und das Ablegen von Dateien gelten im abgerissenen Fenster nicht
    const s = await oeffne({ app: true, teil: "kampf", lang: "en", vollStand: vollDatei });
    await bisWahr(s, () => !!document.querySelector("#bars .row"), "Fenster zeigt den Kampf");
    const z = await s.page.evaluate(() => {
      const taste = (key) => { const e = new KeyboardEvent("keydown", { key, ctrlKey: true, bubbles: true, cancelable: true });
        document.body.dispatchEvent(e); return e.defaultPrevented; };
      const ablage = () => { const dt = new DataTransfer(); dt.items.add(new File(["x"], "a.txt"));
        const ein = new DragEvent("dragenter", { dataTransfer: dt, bubbles: true, cancelable: true }); window.dispatchEvent(ein);
        const an = document.querySelector("#dropOverlay").classList.contains("on");
        const ab = new DragEvent("drop", { dataTransfer: dt, bubbles: true, cancelable: true }); window.dispatchEvent(ab);
        return { overlay: an, abgefangen: ab.defaultPrevented }; };
      // erst die Pfeile: ein offenes Suchfeld (Strg+K) laesst sie nicht wechseln
      return { links: taste("ArrowLeft"), rechts: taste("ArrowRight"), k: taste("k"),
        wahlOffen: !document.querySelector("#kampfwahl").hidden, ablage: ablage() };
    });
    assert(z.k === false && !z.wahlOffen, "#351: Strg+K tut im Fenster nichts", z);
    assert(z.links === false && z.rechts === false, "#351: Strg+Pfeile wechseln den Kampf nicht", z);
    assert(z.ablage.overlay === false && z.ablage.abgefangen === true, "#351: Ablegen zeigt keine Ablage, die Datei wird nicht geoeffnet (aber abgefangen)", z.ablage);
    await s.page.close();
    // Gegenprobe: in der Vollansicht gilt alles
    const v = await oeffne({ app: true, lang: "en" });
    await ladeKampf(v);
    const g = await v.page.evaluate(() => {
      const e = new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true, cancelable: true });
      document.body.dispatchEvent(e);
      const dt = new DataTransfer(); dt.items.add(new File(["x"], "a.txt"));
      window.dispatchEvent(new DragEvent("dragenter", { dataTransfer: dt, bubbles: true, cancelable: true }));
      return { k: e.defaultPrevented, overlay: document.querySelector("#dropOverlay").classList.contains("on") };
    });
    assert(g.k === true && g.overlay === true, "Gegenprobe: in der Vollansicht gelten Strg+K und die Ablage", g);
    await v.page.close();
  }
  {
    // #347: Live in der Vollansicht - das abgerissene Fenster liest mit, zeigt aber die Meldung "Live-Aufzeichnung" nicht
    const s = await oeffne({ app: true, teil: "rotation", lang: "en", vollStand: { grund: "live", datei: "", kampf: null } });
    await bisWahr(s, () => document.body.classList.contains("watching"), "Live im Fenster");
    const an = await s.page.evaluate(() => document.querySelector("#watchPop").classList.contains("on"));
    assert(an === false, "#347: keine Live-Meldung im abgerissenen Fenster", an);
    await s.page.close();
    // Gegenprobe: in der Vollansicht erscheint sie
    const v = await oeffne({ app: true, lang: "en" });
    await v.page.evaluate(() => document.querySelector("#btnWatch").click());
    await bisWahr(v, () => document.querySelector("#watchPop").classList.contains("on"), "Gegenprobe: Meldung in der Vollansicht");
    await v.page.close();
  }
  {
    // #350: das Thema der Vollansicht erreicht ein offenes abgerissenes Fenster (Ereignis kompaktstand, dann /api/config)
    const s = await oeffne({ app: true, teil: "kampf", lang: "en", config: { theme: "dark" }, vollStand: vollDatei });
    await bisWahr(s, (th) => document.documentElement.dataset.theme === th, "Fenster im Thema dunkel", "dark");
    s.config = { theme: "light" };
    s.counts.kompaktstand = 1;
    await bisWahr(s, (th) => document.documentElement.dataset.theme === th, "#350: das Fenster folgt dem Thema der Vollansicht", "light");
    assert(s.posts.length === 0 && !s.schreib.length, "#350: das Fenster schreibt dabei nichts", s.schreib);
    await s.page.close();
    // und die Vollansicht schickt nach einem Themenwechsel den Stand, solange ein Fenster offen sein kann
    const v = await oeffne({ app: true, lang: "en", config: { theme: "dark" } });
    await ladeKampf(v);
    await v.page.evaluate(() => { document.querySelector('[data-tab="analysis"]').click(); });
    await bisWahr(v, () => !document.querySelector("#btnAbreissen").hidden, "Knopf in der Analyse");
    await v.page.locator("#btnAbreissen").click();
    await warteAufPost(v, (b) => b.do === "abreissen", "abreissen gesendet");
    const vorher = v.win.filter((b) => b.do === "stand").length;
    await v.page.evaluate(() => { document.querySelector('#themeRow button[data-theme="light"]').click(); });
    await bisNode(() => v.win.filter((b) => b.do === "stand").length > vorher, "#350: Stand nach dem Themenwechsel");
    assert(v.posts.some((p) => p.theme === "light"), "Themenwechsel wird gespeichert", v.posts);
    await v.page.close();
  }
} catch (err) {
  failed++;
  console.log("  FAIL  " + (err && err.stack || err));
} finally {
  await browser.close();
}

console.log(failed ? `\n${failed} FAILED` : "\nall passed");
process.exit(failed ? 1 : 0);
