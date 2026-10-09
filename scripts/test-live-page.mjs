// Borometer - a damage meter for Throne and Liberty
// Copyright (C) 2026 B0R0AK
// SPDX-License-Identifier: GPL-3.0-or-later
//
// Live-Leistung (Spezifikation 26.09.2026, Abschnitt 7.3) an der gebauten
// Seite, vom gestellten Helfer ausgeliefert (page.route): die Antworten auf
// /api/state und /api/latest kommen aus den echten Funktionen von
// src/main/logs.ts auf einer echten Datei im Temp-Ordner, die hier waechst,
// ersetzt, gekuerzt und gewechselt wird. Testdaten: scripts/fixtures/live-auszug.txt.
//
// Run:  npm run test:live-page     (baut die Seite zuerst)

import * as esbuild from "esbuild";
import { appendFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
let failed = 0;
function assert(cond, name, detail) {
  if (cond) console.log("  ok    " + name);
  else { failed++; console.log("  FAIL  " + name + (detail === undefined ? "" : "  " + JSON.stringify(detail).slice(0, 400))); }
}
/* Warten auf einen Zustand statt fester Pausen (Issue #167). bisZu prueft
   eine Bedingung im Test (Zaehler des gestellten Helfers) alle 50 ms;
   bisSeite wartet auf eine in der Seite. Laeuft die Frist ab, steht eine
   FAIL-Zeile mit dem, worauf gewartet wurde, und es geht weiter - die
   Pruefungen danach sagen dann, was fehlt. */
const schlaf = (ms) => new Promise((r) => setTimeout(r, ms));
async function bisZu(bedingung, worauf, ms = 15000) {
  for (const ende = Date.now() + ms; Date.now() < ende; await schlaf(50)) if (bedingung()) return true;
  if (bedingung()) return true;
  assert(false, "Zeitablauf (" + ms + " ms) beim Warten auf: " + (typeof worauf === "function" ? worauf() : worauf));
  return false;
}
async function bisSeite(page, fn, arg, worauf, ms = 15000) {
  try { await page.waitForFunction(fn, arg, { timeout: ms }); return true; }
  catch (e) { assert(false, "Zeitablauf (" + ms + " ms) beim Warten auf: " + worauf, String(e).split("\n")[0]); return false; }
}
const built = await esbuild.build({ entryPoints: [join(root, "src/main/logs.ts")], bundle: true, format: "esm",
  platform: "node", write: false, logLevel: "silent" });
const logs = await import("data:text/javascript;base64," + Buffer.from(built.outputFiles[0].text).toString("base64"));

const AUSZUG = readFileSync(join(root, "scripts", "fixtures", "live-auszug.txt"), "utf8");
const ZEILEN = AUSZUG.split("\n").filter(Boolean);
const bis = (anteil) => ZEILEN.slice(0, Math.floor(ZEILEN.length * anteil)).join("\n") + "\n";
const stueck = (von, zu) => ZEILEN.slice(Math.floor(ZEILEN.length * von), Math.floor(ZEILEN.length * zu)).join("\n") + "\n";
// eine Zeile zur Zeit der letzten, die keinen Kampf aendert (Schaden 0) oder einen Treffer mehr bringt
const LETZTE = ZEILEN[ZEILEN.length - 1].split(",")[0];
const zeile = (dmg) => `${LETZTE},DamageDone,Fähigkeit – 1,1,${dmg},0,0,kNormalHit,Ich,Gegner 1\n`;
const html = readFileSync(join(root, "dist", "renderer", "index.html"), "utf8");
const browser = await chromium.launch(process.env.PARITY_CHROMIUM ? { executablePath: process.env.PARITY_CHROMIUM } : {});

/* Eine Seite am gestellten Helfer, Live eingeschaltet. ordner: wo die Logs
   liegen. Jede Anfrage an /api/latest landet in anfragen (die Zahl from, oder
   "ganz" ohne from); stoer(url) darf eine Antwort ersetzen ("abbrechen",
   {status, body}, {status, roh}: roh als Text statt JSON), sie verzoegern ({warte: ms}) oder null sagen. grenze:
   die Obergrenze einer Antwort statt 8 MB, damit ein langer Abend auch mit
   dem kleinen Auszug zu stellen ist. */
async function oeffne(ordner, grenze = 0) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
  const s = { page, fehler: [], anfragen: [], posts: [], logIndex: null, stoer: () => null, zustaende: 0, haengt: false, loslassen: null,
    verzoegert: 0, haengtGesendet: 0 };
  page.on("pageerror", (e) => s.fehler.push(String(e)));
  await page.addInitScript(() => { try { localStorage.clear(); localStorage.setItem("boroLang", "en"); } catch { /* blockiert */ } });
  /* __posts zaehlt, wie oft die Seite /api/config schreiben wollte: sind so
     viele beim Helfer angekommen (s.posts), ist nichts mehr unterwegs.
     Jede Anfrage an /api/state traegt im Kopf x-boro-gesendet den Zeitpunkt
     (performance.now der Seite), zu dem die Seite sie abschickt - dort
     beginnt auch ihre Frist (AbortSignal.timeout), nicht erst beim Helfer. */
  await page.addInitScript(() => {
    window.__posts = 0;
    const f = window.fetch;
    window.fetch = function (url, opt) {
      if (String(url).startsWith("/api/config") && opt?.method === "POST") window.__posts++;
      if (String(url).startsWith("/api/state")) {
        const headers = new Headers(opt?.headers);
        headers.set("x-boro-gesendet", String(performance.now()));
        return f.call(this, url, { ...opt, headers });
      }
      return f.apply(this, arguments);
    };
  });
  await page.route("http://boro.test/**", async (route) => {
    const req = route.request(), url = new URL(req.url()), path = url.pathname;
    const json = (status, body) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    if (path === "/api/state") {
      s.zustaende++;
      /* haengt: diese eine Anfrage bekommt keine Antwort, bis der Test sie
         loslaesst - wie ein Helfer, der sich aufgehaengt hat */
      if (s.haengt) {
        s.haengt = false;
        s.haengtGesendet = Number(req.headers()["x-boro-gesendet"]);
        await new Promise((r) => { s.loslassen = r; });
        return route.abort().catch(() => {});
      }
      const f = logs.newestLog(ordner);
      return json(200, { dir: ordner, file: f?.name ?? "", size: f?.size ?? 0, mtime: f?.mtime ?? 0 });
    }
    if (path === "/api/latest") {
      const f = logs.newestLog(ordner);
      const from = url.searchParams.has("from") ? url.searchParams.get("from") : null;
      s.anfragen.push(from === null ? "ganz" : Number(from));
      const anders = s.stoer(url);
      if (anders === "abbrechen") return route.abort();
      // warte: der Helfer laesst sich bewusst Zeit; verzoegert zaehlt, wenn die Antwort raus ist
      if (anders?.warte) { await new Promise((r) => setTimeout(r, anders.warte)); s.verzoegert++; }
      else if (anders?.roh !== undefined) return route.fulfill({ status: anders.status, contentType: "text/plain; charset=utf-8", body: anders.roh });
      else if (anders) return json(anders.status, anders.body);
      if (!f) return route.fulfill({ status: 404, body: "" });
      if (from === null) return route.fulfill({ status: 200, contentType: "text/plain; charset=utf-8", body: logs.readLog(f) });
      const a = logs.latestAnswer(f, url.searchParams.get("file"), from);
      if (grenze && a.status === 200) a.body = logs.readLogFrom(f, Number(from), grenze);
      return json(a.status, a.body);
    }
    if (path === "/api/config" && req.method() === "POST") {
      const sent = JSON.parse(req.postData() || "{}");
      s.posts.push(Object.keys(sent).join());
      if (sent.logIndex) s.logIndex = sent.logIndex;
      return json(200, { ok: true });
    }
    if (path === "/api/best" && req.method() === "GET") return json(200, { ok: true, best: {} });
    if (path.startsWith("/api/")) return json(200, { ok: true });
    return route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: html });
  });
  await page.goto("http://boro.test/index.html");
  // Seite fertig: body[data-bereit] statt #landStatus (Neugestaltung 28.09., Befund 2)
  await bisSeite(page, () => document.body.dataset.bereit === "ordner", undefined, "die Seite ist bereit (body[data-bereit=ordner])", 30000);
  await page.evaluate(() => document.querySelector("#btnWatch").click());
  return s;
}
/* Wartet, bis der Helfer n Anfragen an /api/latest mehr gesehen hat, und
   gibt diese Anfragen zurueck. */
async function anfragen(s, n = 1) {
  const ziel = s.anfragen.length + n;
  await bisZu(() => s.anfragen.length >= ziel, () => n + " Anfrage(n) an /api/latest, gekommen: " + JSON.stringify(s.anfragen.slice(ziel - n)));
  return s.anfragen.slice(ziel - n);
}
/* Wartet, bis ein neuer Takt /api/state fragt: dann ist der vorige fertig,
   mit allen seinen Anfragen und dem Laden (ein Takt nach dem anderen -
   pollServer fragt nicht, solange fragtGerade steht). */
async function nachTakt(s) {
  const n = s.zustaende;
  await bisZu(() => s.zustaende > n, () => "den naechsten Takt (/api/state Nr. " + (n + 1) + ")");
}
/* n Anfragen mehr, und der Takt der letzten ist fertig: die Seite steht. */
async function takte(s, n = 1) {
  const neu = await anfragen(s, n);
  await nachTakt(s);
  return neu;
}
// die Kampfliste, wie sie dasteht: Blockkoepfe, Trash-Gruppen, Zeilen. Sie steht
// in der Kampfwahl (Instrumententafel 3.2); die wird dafuer geoeffnet und, wenn
// sie zu war, wieder geschlossen - innerText liest nur, was gezeichnet ist.
const liste = (s) => s.page.evaluate(() => {
  const zu = document.querySelector("#kampfwahl").hidden;
  if (zu) document.querySelector("#kwKnopf").click();
  const z = document.querySelector("#fightList").innerText.split("\n").filter(Boolean);
  if (zu) document.querySelector("#kwKnopf").click();
  return z;
});
const kaempfe = (s) => Object.values(s.logIndex || {}).flatMap((f) => f.fights || []);

const work = mkdtempSync(join(tmpdir(), "boro-live-page-"));
try {
  // 1 · Wachstum ueber mehrere Takte: erst ganz (from=0), dann nur das Ende
  const ordner = join(work, "a"), datei = join(ordner, "TLCombatLog-20260925.txt");
  mkdirSync(ordner);
  writeFileSync(datei, bis(0.7));
  const s = await oeffne(ordner);
  const erst = await takte(s);
  assert(erst[0] === 0, "der erste Takt laedt ganz, mit from=0", s.anfragen);
  await bisSeite(s.page, () => document.querySelectorAll("#fightList .fight").length > 0, undefined, "Kaempfe in der Liste (Wachstum)");
  const stand1 = Buffer.byteLength(bis(0.7));
  appendFileSync(datei, stueck(0.7, 0.8));
  const zweit = await takte(s);
  assert(zweit[0] === stand1, "der naechste Takt fragt ab dem Byte hinter der letzten ganzen Zeile", { zweit, stand1 });
  // eine halbe Zeile bleibt liegen, bis sie fertig ist
  const halb = stueck(0.8, 0.9);
  appendFileSync(datei, halb.slice(0, -20));
  await takte(s);
  appendFileSync(datei, halb.slice(-20));
  await takte(s);
  appendFileSync(datei, stueck(0.9, 1.01));
  await takte(s);
  assert(!s.anfragen.includes("ganz") && s.anfragen.filter((a) => a === 0).length === 1,
    "waehrend die Datei waechst: nie die ganze Datei ohne from, genau einmal from=0", s.anfragen);

  // dasselbe Log am Stueck: dieselbe Kampfliste, dasselbe Verlaufsverzeichnis
  const ordner2 = join(work, "b");
  mkdirSync(ordner2);
  writeFileSync(join(ordner2, "TLCombatLog-20260925.txt"), AUSZUG);
  const g = await oeffne(ordner2);
  await takte(g);
  await bisSeite(g.page, () => document.querySelectorAll("#fightList .fight").length > 0, undefined, "Kaempfe in der Liste (am Stueck)");
  const [a, b] = [await liste(s), await liste(g)];
  assert(a.length >= 6 && JSON.stringify(a) === JSON.stringify(b), "Stueck fuer Stueck: dieselbe Kampfliste wie am Stueck", { a, b });
  /* Das Verzeichnis nach dem Ende von Live: waehrend Live haengt, was der
     laufende Kampf traegt (sein Paar aus den Skills bis dahin), an der
     Reihenfolge der Takte. Beim Beenden rechnet histRecord alle Kaempfe neu,
     auf beiden Seiten. */
  /* histRecord laeuft im Klick und schreibt das Verzeichnis nur, wenn es sich
     aendert; gewartet wird, bis jeder Post der Seite beim Helfer ist */
  for (const x of [s, g]) {
    const gewollt = await x.page.evaluate(() => { document.querySelector("#btnWatch").click(); return window.__posts; });
    await bisZu(() => x.posts.length >= gewollt, () => "alle " + gewollt + " Posts an /api/config nach dem Beenden, angekommen: " + x.posts.length);
  }
  const [ka, kb] = [kaempfe(s), kaempfe(g)];
  assert(ka.length === 2 && JSON.stringify(ka) === JSON.stringify(kb), "Stueck fuer Stueck: dasselbe Verlaufsverzeichnis wie am Stueck",
    ka.map((f, i) => Object.keys(f).filter((k) => JSON.stringify(f[k]) !== JSON.stringify(kb[i]?.[k])).map((k) => [k, f[k], kb[i]?.[k]])));
  await g.page.close();
  await s.page.evaluate(() => document.querySelector("#btnWatch").click());
  assert((await takte(s))[0] === 0, "Live wieder an: der erste Takt laedt ganz");

  /* 1a · eine kleine Datei, die waechst: solange sie unter der Grenze von
     stable liegt, laedt jeder Takt ganz - und zwar mit parseGrid, nicht ueber
     den alten Anhaenge-Weg in loadText, der stable und die Zeilenbreiten nie
     neu zaehlt. Sonst bliebe es beim ganzen Laden, und tailRechnen pruefte
     gegen veraltete Breiten. */
  const ordner3 = join(work, "c"), datei3 = join(ordner3, "TLCombatLog-20260925.txt");
  mkdirSync(ordner3);
  writeFileSync(datei3, stueck(0, 0.2));
  const k = await oeffne(ordner3);
  await takte(k);
  await bisSeite(k.page, () => document.querySelectorAll("#fightList .fight").length > 0, undefined, "Kaempfe in der Liste (kleine Datei)");
  appendFileSync(datei3, stueck(0.2, 0.6));
  const klein = await takte(k, 2);
  await nachTakt(k);
  const bisKlein = k.anfragen.length;
  appendFileSync(datei3, stueck(0.6, 1.01));
  const gross = await takte(k);
  await nachTakt(k);
  const danachK = k.anfragen.slice(bisKlein);
  assert(klein[0] > 0 && klein[1] === 0 && gross[0] > klein[0] && danachK.length >= 1 && danachK.every((x) => x > 0),
    "kleine Datei: ganz, bis sie gross genug ist, dann nur das Ende", k.anfragen);
  assert(JSON.stringify(await liste(k)) === JSON.stringify(a), "und danach dieselbe Kampfliste wie am Stueck");
  assert(!k.fehler.length, "keine Fehler in der Seite (kleine Datei)", k.fehler);
  await k.page.close();

  // 2 · ein Abend ueber der Obergrenze einer Antwort: erst der Anfang, der Rest im naechsten Takt
  const c = await oeffne(ordner2, 100000);
  await takte(c, 2);
  // zwei ganze Takte mehr, in denen nichts gefragt werden darf
  await nachTakt(c);
  await nachTakt(c);
  // 188 KB bei 100 KB je Antwort: zwei Antworten, dann ist alles gelesen und es wird nicht mehr gefragt
  assert(c.anfragen.length === 2 && c.anfragen[0] === 0 && c.anfragen[1] > 90000 && c.anfragen[1] <= 100000,
    "ueber der Grenze: der erste Takt bis zur letzten Zeile davor, der naechste ab dort, dann nichts mehr", c.anfragen);
  assert(JSON.stringify(await liste(c)) === JSON.stringify(a), "und danach steht dieselbe Kampfliste da wie am Stueck");
  await c.page.close();

  // 3 · ein Takt, der nichts aendert: keine neue Kampfliste, kein Schreiben der Einstellungen
  await s.page.evaluate(() => {
    window.__liste = 0;
    new MutationObserver((m) => { window.__liste += m.length; })
      .observe(document.querySelector("#fightList"), { childList: true, subtree: true, attributes: true, characterData: true });
  });
  const postsVorher = s.posts.length;
  appendFileSync(datei, zeile(0));
  const leer = await takte(s);
  assert(typeof leer[0] === "number" && leer[0] > 0, "der Takt fragte das neue Ende", leer);
  assert(await s.page.evaluate(() => window.__liste) === 0, "ein Takt ohne Aenderung baut die Kampfliste nicht neu",
    await s.page.evaluate(() => window.__liste));
  assert(s.posts.length === postsVorher, "und schickt das Verlaufsverzeichnis nicht", s.posts.slice(postsVorher));

  // 4 · Ueberlappung: eine Antwort braucht laenger als ein Takt - kein zweiter Takt fragt dazwischen
  appendFileSync(datei, zeile(771));
  s.stoer = () => ({ warte: 5000 });
  const verzoegertVor = s.verzoegert;
  const langsam = await anfragen(s);
  const waehrend = s.anfragen.length;
  // bis die langsame Antwort ganz draussen ist: fuenf Sekunden, mehr als zwei Takte
  await bisZu(() => s.verzoegert > verzoegertVor, "die um 5 s verzoegerte Antwort");
  s.stoer = () => null;
  assert(s.anfragen.length === waehrend, "solange eine Antwort aussteht, fragt kein zweiter Takt", s.anfragen.slice(-3));
  appendFileSync(datei, zeile(772));
  const danach = await takte(s);
  assert(danach[0] > langsam[0], "danach geht es ab dem neuen Stand weiter", { langsam, danach });

  // 5 · abgebrochene Antwort: der Stand bleibt, der naechste Takt holt dasselbe Ende
  appendFileSync(datei, zeile(777));
  s.stoer = (url) => (url.searchParams.get("from") !== "0" ? "abbrechen" : null);
  const ab = await takte(s);
  assert(await s.page.evaluate(() => document.querySelector("#btnWatch").classList.contains("err")),
    "Antwort bricht ab: die Live-Anzeige sagt \"gestoert\"");
  s.stoer = () => null;
  const nach = await takte(s);
  assert(nach[0] === ab[0], "der naechste Takt fragt ab demselben Byte", { ab, nach });
  assert(await s.page.evaluate(() => document.querySelector("#btnWatch").classList.contains("on")), "und die Anzeige ist wieder an");

  /* 5a · /api/state antwortet nicht: nach zehn Sekunden "gestoert", und der
     naechste Takt fragt wieder - sonst hielte der haengende Takt die Sperre
     (fragtGerade) fuer immer, auch ueber Beenden und Starten hinweg. */
  /* Wann "gestoert" erscheint, haelt ein Beobachter in der Seite fest - auf
     derselben Uhr wie der Zeitpunkt des Absendens, ohne die Wartezeit des
     Tests oder die Last auf dem Rechner. */
  await s.page.evaluate(() => {
    const knopf = document.querySelector("#btnWatch");
    window.__gestoertSeit = 0;
    new MutationObserver((_, beob) => {
      if (!knopf.classList.contains("err")) return;
      window.__gestoertSeit = performance.now();
      beob.disconnect();
    }).observe(knopf, { attributes: true, attributeFilter: ["class"] });
  });
  s.haengt = true;
  await bisZu(() => !!s.loslassen, "die haengende Anfrage an /api/state", 5000);
  const vorHaengen = s.anfragen.length;
  await bisSeite(s.page, () => document.querySelector("#btnWatch").classList.contains("err"), undefined,
    "\"gestoert\" an der Live-Anzeige, nachdem /api/state haengt", 20000);
  /* gemessen in der Seite, vom Absenden der haengenden Anfrage bis "gestoert";
     die Frist entsteht unmittelbar vor dem Absenden, 50 ms Spiel fuer die Uhr */
  const gestoertNach = await s.page.evaluate(() => window.__gestoertSeit) - s.haengtGesendet;
  assert(Number.isFinite(gestoertNach) && s.haengtGesendet > 0 && gestoertNach >= 9950,
    "\"gestoert\" erst nach der Frist von zehn Sekunden", gestoertNach);
  assert(s.loslassen && await s.page.evaluate(() => document.querySelector("#btnWatch").classList.contains("err")),
    "/api/state haengt: nach zehn Sekunden sagt die Live-Anzeige \"gestoert\"");
  appendFileSync(datei, zeile(783));
  const nachHaengen = await takte(s);
  s.loslassen?.();
  assert(s.anfragen.length > vorHaengen && nachHaengen[0] > 0, "danach fragt der naechste Takt wieder, ab dem Stand", nachHaengen);
  assert(await s.page.evaluate(() => document.querySelector("#btnWatch").classList.contains("on")), "und die Anzeige ist wieder an (nach dem Haengen)");

  // 6 · from passt nicht zum Stand (der Helfer antwortet fuer ein anderes Byte): im selben Takt ganz
  appendFileSync(datei, zeile(778));
  s.stoer = (url) => { const f = url.searchParams.get("from");
    return f !== "0" ? { status: 200, body: { file: url.searchParams.get("file"), from: Number(f) + 1, to: Number(f) + 1,
      size: Number(f) + 1, head: "", text: "" } } : null; };
  const wider = await takte(s, 2);
  s.stoer = () => null;
  assert(wider[0] > 0 && wider[1] === 0, "eine Antwort, die nicht zum Stand passt: im selben Takt ganz (from=0)", wider);

  // 7 · 409 vom Helfer: im selben Takt ganz
  appendFileSync(datei, zeile(779));
  s.stoer = (url) => (url.searchParams.get("from") !== "0" ? { status: 409, body: { ok: false } } : null);
  const k409 = await takte(s, 2);
  s.stoer = () => null;
  assert(k409[0] > 0 && k409[1] === 0, "409: im selben Takt ganz (from=0)", k409);

  /* 7a · der Helfer antwortet mit Text statt JSON (500, wenn readLogFrom
     wirft, oder eine kaputte 200): nichts anhaengen, im selben Takt ganz */
  appendFileSync(datei, zeile(780));
  s.stoer = (url) => (url.searchParams.get("from") !== "0" ? { status: 500, roh: "Error: ENOENT" } : null);
  const k500 = await takte(s, 2);
  s.stoer = () => null;
  assert(k500[0] > 0 && k500[1] === 0, "500 als Text: im selben Takt ganz (from=0)", k500);
  appendFileSync(datei, zeile(781));
  s.stoer = (url) => (url.searchParams.get("from") !== "0" ? { status: 200, roh: "kein JSON" } : null);
  const kRoh = await takte(s, 2);
  s.stoer = () => null;
  assert(kRoh[0] > 0 && kRoh[1] === 0, "200 ohne JSON: im selben Takt ganz (from=0)", kRoh);
  appendFileSync(datei, zeile(782));
  const nachRoh = await takte(s);
  assert(nachRoh[0] > kRoh[0], "und danach wieder nur das Ende", { kRoh, nachRoh });

  // 8 · ersetzt: derselbe Name, laenger als der Stand, aber ein anderer Anfang (eine Stunde spaeter)
  const spaeter = (z) => z.replace(/^(\d{8}-)20:/, "$121:");
  writeFileSync(datei, ZEILEN.map((z, i) => (i ? spaeter(z) : z)).join("\n") + "\n" + ZEILEN.slice(1, 200).map(spaeter).join("\n") + "\n");
  const ersetzt = await takte(s, 2);
  assert(ersetzt[0] > 0 && ersetzt[1] === 0, "Datei unter demselben Namen ersetzt: im selben Takt ganz (from=0)", ersetzt);
  // die Zeile zeigt seit der Neugestaltung 28.09. (0.9) "21:24 · 38.0 s"; die ganze Uhrzeit steht in ihrem Namen.
  // folgt #152: eine Pull-Zeile (Boss unter "Ort · Boss") nennt erst die Dauer, dann die Uhrzeit: "38.0 s · 21:24"
  const namen = await s.page.evaluate(() => [...document.querySelectorAll("#fightList .fight")].map((f) => f.getAttribute("aria-label")));
  assert((await liste(s)).some((z) => /^(\d+m \d+|\d+\.\d)[  ]s · 21:24$/.test(z)) && namen.some((n) => n.includes("21:24:05")), "und die Liste zeigt die neue Datei", { liste: await liste(s), namen });

  // 9 · gekuerzt (dieselbe Datei, kuerzer als der Stand): ganz
  writeFileSync(datei, bis(0.75));
  const kurz = await takte(s);
  assert(kurz[0] === 0, "Datei gekuerzt: ganz laden (from=0)", kurz);
  const nachKurz = await liste(s);

  // 10 · das Beispiel geoeffnet, waehrend Live laeuft: der naechste Takt laedt die Live-Datei ganz, er haengt nichts an das Beispiel
  // das Beispiel laedt im Klick selbst (sample, synchron); danach steht seine Kampfliste
  await s.page.evaluate(() => document.querySelector("#btnSample").click());
  await bisSeite(s.page, () => !!document.querySelector("#fightList .fight"), undefined, "die Kaempfe des Beispiels in der Liste");
  appendFileSync(datei, stueck(0.75, 0.8));
  const nachBeispiel = await takte(s);
  assert(nachBeispiel[0] === 0, "nach dem Beispiel: die Live-Datei ganz (from=0)", nachBeispiel);

  // 11 · Thema und Sprache wechseln, waehrend Live laeuft: die Liste spricht die neue Sprache, aeltere Kaempfe tragen die neuen Farben
  await s.page.evaluate(() => { document.querySelector('#themeRow button[data-theme="light"]').click(); document.querySelector("#btnLang").click(); });
  appendFileSync(datei, stueck(0.8, 0.85));
  await takte(s);
  await s.page.evaluate(() => [...document.querySelectorAll("#fightList .fight")].pop().click());
  await bisSeite(s.page, () => [...document.querySelectorAll("#fightList .fight")].pop()?.getAttribute("aria-selected") === "true" &&
    !!document.querySelector("#bars .fill"), undefined, "der aelteste Kampf gewaehlt und seine Balken gezeichnet");
  const farbe = await s.page.evaluate(() => ({
    balken: document.querySelector("#bars .fill")?.style.getPropertyValue("--c"),
    thema: getComputedStyle(document.documentElement).getPropertyValue("--series-1").trim() }));
  assert(farbe.balken === farbe.thema && farbe.thema !== "", "ein aelterer Kampf nach dem Themenwechsel: die Farbe des neuen Themas", farbe);
  assert((await s.page.evaluate(() => [...document.querySelectorAll("#fightList .fight")].map((b) => b.getAttribute("aria-label")).join(" | "))).includes("Schaden"),
    "die Kampfliste spricht nach dem Sprachwechsel Deutsch");

  // 12 · eine neue Datei (neuer Name): ganz, mit ihrem Namen
  writeFileSync(join(ordner, "TLCombatLog-20260926.txt"), stueck(0, 0.5));
  const neuDatei = await takte(s);
  assert(neuDatei[0] === 0, "Datei gewechselt: ganz laden (from=0)", neuDatei);
  assert(JSON.stringify(await liste(s)) !== JSON.stringify(nachKurz) &&
    (await s.page.evaluate(() => document.querySelector("#liveText").textContent)).includes("TLCombatLog-20260926.txt"),
    "und die Seite zeigt die neue Datei");

  // 13 · Live-Anzeige: der Rahmen steht, der Punkt atmet dreimal und steht dann
  const anzeige = await s.page.evaluate(() => ({
    rahmen: getComputedStyle(document.body, "::after").animationName,
    punkt: getComputedStyle(document.querySelector("#btnWatch .ldot")).animationName,
    mal: getComputedStyle(document.querySelector("#btnWatch .ldot")).animationIterationCount,
  }));
  assert(anzeige.rahmen === "none", "der Rahmen um das Fenster hat keine Animation", anzeige);
  assert(anzeige.punkt === "breathe" && anzeige.mal === "3", "der Live-Punkt atmet dreimal und steht dann", anzeige);
  await s.page.emulateMedia({ reducedMotion: "reduce" });
  const ruhig = await s.page.evaluate(() => getComputedStyle(document.querySelector("#btnWatch .ldot")).animationName);
  assert(ruhig === "none", "bei reduzierter Bewegung: gar nicht", ruhig);

  /* 14 · Start waehrend Live (Instrumententafel 3.3): ein Takt an derselben
     Datei laesst Start stehen - angehaengt wie ganz geladen -, eine neue
     Datei und ein Kampf aus der Kampfwahl fuehren zurueck in den Bereich */
  const bereich = () => s.page.evaluate(() => ({ land: !document.querySelector("#land").hidden,
    aktuell: document.querySelector("#bereiche .tab[aria-current='page']")?.dataset.tab }));
  const neueste = join(ordner, "TLCombatLog-20260926.txt");
  await s.page.evaluate(() => document.querySelector('#bereiche [data-tab="start"]').click());
  appendFileSync(neueste, stueck(0.5, 0.55));
  const startEnde = await takte(s);
  assert(startEnde[0] > 0, "Start: der Takt holt nur das Ende", startEnde);
  assert(JSON.stringify(await bereich()) === '{"land":true,"aktuell":"start"}', "Start bleibt, wenn Live anhaengt", await bereich());
  appendFileSync(neueste, stueck(0.55, 0.6));
  s.stoer = (url) => (url.searchParams.get("from") !== "0" ? { status: 409, body: { ok: false } } : null);
  const startGanz = await takte(s, 2);
  s.stoer = () => null;
  assert(startGanz[1] === 0 && JSON.stringify(await bereich()) === '{"land":true,"aktuell":"start"}',
    "Start bleibt, wenn Live dieselbe Datei ganz laedt", { startGanz, b: await bereich() });
  await s.page.evaluate(() => document.querySelector("#fightList .fight").click());
  await bisSeite(s.page, () => document.querySelector("#fightList .fight")?.getAttribute("aria-selected") === "true", undefined,
    "der Kampf aus der Kampfwahl ist gewaehlt");
  assert(JSON.stringify(await bereich()) === '{"land":false,"aktuell":"timeline"}', "ein Kampf aus der Kampfwahl verlaesst Start", await bereich());
  await s.page.evaluate(() => document.querySelector('#bereiche [data-tab="start"]').click());
  writeFileSync(join(ordner, "TLCombatLog-20260927.txt"), stueck(0, 0.4));
  const startNeu = await takte(s);
  assert(startNeu[0] === 0 && JSON.stringify(await bereich()) === '{"land":false,"aktuell":"timeline"}',
    "eine neue Datei aus Live verlaesst Start", { startNeu, b: await bereich() });

  assert(!s.fehler.length, "keine Fehler in der Seite", s.fehler);
  await s.page.close();

  /* 15 · ein Puppenabend, der unter demselben Namen waechst (Issue #65):
     erst wenige Zeilen, dann mehr, zuletzt 740 - ueber loadText, wie beim
     Beobachten eines Ordners im Browser (sweep) oder wenn man dieselbe Datei
     noch einmal oeffnet. Der Anhaenge-Weg behielt die Zuordnung aus den
     ersten Zeilen fuer den ganzen Abend. Nur Zeiten, IDs und Zahlen: "Claw"
     unter fuenf IDs, der Schaden eng zwischen 864 und 1209. Am Ende muss
     dieselbe Kampfliste dastehen wie nach dem Oeffnen der ganzen Datei. */
  const IDS = [940710828, 940842037, 940907488, 940973120, 941169852];
  const zwei = (n, w = 2) => String(n).padStart(w, "0");
  const puppe = Array.from({ length: 740 }, (_, k) => {
    const d = new Date(Date.UTC(2026, 8, 28, 23, 13, 22) + k * 56);
    return `20260928-${zwei(d.getUTCHours())}:${zwei(d.getUTCMinutes())}:${zwei(d.getUTCSeconds())}:${zwei(d.getUTCMilliseconds(), 3)}` +
      `,DamageDone,Claw,${IDS[(k * 3) % 5]},${864 + (k * 37) % 346},${k % 4 ? 0 : 1},${k % 9 ? 0 : 1},kNormalHit,Spieler A,Practice Dummy`;
  });
  const PNAME = "TLCombatLog-puppe.txt";
  const echt = (puppe.reduce((a, z) => a + Number(z.split(",")[4]), 0) / 1000).toFixed(1) + "k damage";
  const puppenSeite = async () => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
    const fehler = [];
    page.on("pageerror", (e) => fehler.push(String(e)));
    await page.addInitScript(() => { try { localStorage.clear(); localStorage.setItem("boroLang", "en"); } catch { /* blockiert */ } });
    /* Gelesen ist eine Datei, wenn readFiles sie geladen hat: f.text() loest
       auf, loadText laeuft in den Mikroaufgaben danach - der Zaehler steigt
       erst in der Aufgabe dahinter. */
    await page.addInitScript(() => {
      window.__gelesen = 0;
      const text = Blob.prototype.text;
      Blob.prototype.text = function () {
        return text.call(this).then((t) => { setTimeout(() => { window.__gelesen++; }, 0); return t; });
      };
    });
    await page.route("http://boro.test/**", (route) => new URL(route.request().url()).pathname.startsWith("/api/")
      ? route.fulfill({ status: 200, contentType: "application/json", body: '{"ok":true}' })
      : route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: html }));
    await page.goto("http://boro.test/index.html");
    await bisSeite(page, () => !!document.body.dataset.bereit, undefined, "die Seite ist bereit (Puppenabend)", 30000);
    return { page, fehler };
  };
  const oeffnen = async (page, text) => {
    const vor = await page.evaluate(() => window.__gelesen);
    await page.setInputFiles("#fileInput", { name: PNAME, mimeType: "text/plain", buffer: Buffer.from(text, "utf8") });
    await bisSeite(page, (n) => window.__gelesen > n, vor, "die geoeffnete Datei ist gelesen (Puppenabend)");
  };
  const puppenListe = (page) => page.evaluate(() => [...document.querySelectorAll("#fightList .fight")].map((f) => f.getAttribute("aria-label")));
  for (const kopf of ["CombatLogVersion,4\n", ""]) {
    const wie = kopf ? "mit Versionszeile" : "ohne Versionszeile";
    const am = await puppenSeite();
    await oeffnen(am.page, kopf + puppe.join("\n") + "\n");
    const amStueck = await puppenListe(am.page);
    await am.page.close();
    for (const start of [3, 10]) {
      const w = await puppenSeite();
      for (const n of [start, 40, 200, 500, 740]) await oeffnen(w.page, kopf + puppe.slice(0, n).join("\n") + "\n");
      const gewachsen = await puppenListe(w.page);
      assert(amStueck.length === 1 && amStueck[0].endsWith(", " + echt) && JSON.stringify(gewachsen) === JSON.stringify(amStueck),
        `Puppenabend ${wie}, von ${start} auf 740 Zeilen gewachsen: dieselbe Kampfliste wie die ganze Datei, mit dem echten Schaden (${echt})`, { gewachsen, amStueck });
      assert(!w.fehler.length, `keine Fehler in der Seite (Puppenabend ${wie}, ab ${start})`, w.fehler);
      await w.page.close();
    }
  }
  /* 7 · #153: ein neuer Kampf im Live reisst einen nicht aus dem gelesenen.
     Ein eigenes kleines Log (nur Zielnamen und Zahlen): drei Pulls an
     Vulcanus, 60 s Ruhe dazwischen. */
  {
    const two = (n, w = 2) => String(n).padStart(w, "0");
    const stamp = (ms) => { const d = new Date(ms);
      return `${d.getUTCFullYear()}${two(d.getUTCMonth() + 1)}${two(d.getUTCDate())}-${two(d.getUTCHours())}:${two(d.getUTCMinutes())}:${two(d.getUTCSeconds())}:${two(d.getUTCMilliseconds(), 3)}`; };
    const pull = (start, secs) => Array.from({ length: secs * 2 }, (_, k) =>
      `${stamp(start + k * 500)},DamageDone,Quick Fire,964762401,${1000 + (k % 5) * 100},0,0,kNormalHit,Ich,Vulcanus`).join("\n") + "\n";
    const at = (h, m) => Date.UTC(2026, 8, 20, h, m, 0);
    const o7 = join(work, "g"), d7 = join(o7, "TLCombatLog-20260920.txt");
    mkdirSync(o7);
    writeFileSync(d7, "CombatLogVersion,4\n" + pull(at(20, 0), 60) + pull(at(20, 10), 60));
    const v = await oeffne(o7);
    await takte(v);
    await bisSeite(v.page, () => document.querySelectorAll("#fightList .fight").length === 2, undefined, "zwei Pulls in der Liste (#153)");
    // die Ansage setzt erst das naechste Bild (leeren, dann setzen): zwei Bilder abwarten
    const stand = () => v.page.evaluate(async () => { await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); return { knopf: document.querySelector("#kwKnopf").getAttribute("aria-label"),
      pille: !document.querySelector("#ungelesen").hidden, ansage: document.querySelector("#kwNeu").textContent }; });
    // den aelteren Pull waehlen (20:00), dann kommt ein dritter
    await v.page.evaluate(() => { document.querySelector("#kwKnopf").click(); });
    await v.page.evaluate(() => [...document.querySelectorAll("#fightList .fight")].find((f) => f.getAttribute("aria-label").includes("20:00"))?.click());
    appendFileSync(d7, pull(at(20, 20), 60));
    await takte(v);
    await bisSeite(v.page, () => document.querySelectorAll("#fightList .fight").length === 3, undefined, "der dritte Pull ist da (#153)");
    let z = await stand();
    assert(z.knopf.includes("20:00") && z.pille && /New fight: Vulcanus/.test(z.ansage),
      "#153 aelteren Pull gewaehlt, ein neuer kommt: die Auswahl bleibt, die Pille zaehlt, der Vorleser hoert den neuen Kampf", z);
    // den neuesten waehlen: der naechste Pull nimmt die Auswahl mit, ohne Ansage
    await v.page.evaluate(() => { document.querySelector("#kwKnopf").click(); });
    await v.page.evaluate(() => [...document.querySelectorAll("#fightList .fight")].find((f) => f.getAttribute("aria-label").includes("20:20"))?.click());
    await v.page.evaluate(() => { document.querySelector("#kwNeu").textContent = ""; });
    appendFileSync(d7, pull(at(20, 30), 60));
    await takte(v);
    await bisSeite(v.page, () => document.querySelectorAll("#fightList .fight").length === 4, undefined, "der vierte Pull ist da (#153)");
    z = await stand();
    assert(z.knopf.includes("20:30") && z.ansage === "", "#153 neuesten gewaehlt: die Auswahl springt mit, keine Ansage", z);
    // Kampfwahl offen, Anwahl auf dem gewaehlten (neuesten): beide springen zusammen
    await v.page.evaluate(() => { document.querySelector("#kwKnopf").click(); });
    appendFileSync(d7, pull(at(20, 40), 60));
    await takte(v);
    await bisSeite(v.page, () => document.querySelectorAll("#fightList .fight").length === 5, undefined, "der fuenfte Pull ist da (#153)");
    const zus = await v.page.evaluate(() => ({ aktiv: document.querySelector("#kwSuche").getAttribute("aria-activedescendant"),
      on: document.querySelector("#fightList .fight.on")?.id }));
    assert(zus.aktiv && zus.aktiv === zus.on, "#153 offene Kampfwahl: Anwahl und Auswahl springen zusammen", zus);
    /* #153 Abschlussdurchsicht: ein aelterer Kampf gewaehlt, die Anwahl mit
       den Pfeilen woanders, die Liste so gerollt, dass der gewaehlte nicht
       im Blick ist - ein neuer Kampf rollt die offene Liste nicht zu ihm
       zurueck, und die Anwahl bleibt, wo sie war. Zehn Pulls mehr, damit
       die Liste rollt. */
    appendFileSync(d7, Array.from({ length: 10 }, (_, k) => pull(at(21, k * 5), 60)).join(""));
    await takte(v);
    await bisSeite(v.page, () => document.querySelectorAll("#fightList .fight").length === 15, undefined, "fuenfzehn Pulls in der Liste (#153)");
    await v.page.evaluate(() => [...document.querySelectorAll("#fightList .fight")].find((f) => f.getAttribute("aria-label").includes("20:10"))?.click());
    await v.page.evaluate(() => { if (document.querySelector("#kwKnopf").getAttribute("aria-expanded") !== "true") document.querySelector("#kwKnopf").click(); });
    await bisSeite(v.page, () => document.querySelector("#kwKnopf").getAttribute("aria-expanded") === "true", undefined, "die Kampfwahl ist offen (#153)");
    await v.page.focus("#kwSuche");
    for (let k = 0; k < 10; k++) await v.page.keyboard.press("ArrowUp");
    const vorher = await v.page.evaluate(() => {
      const l = document.querySelector("#kwListe"), s = document.querySelector("#kwSuche");
      const aktiv = document.getElementById(s.getAttribute("aria-activedescendant"));
      l.scrollTop = 0;
      const lr = l.getBoundingClientRect(), on = document.querySelector("#fightList .fight.on").getBoundingClientRect();
      return { aktiv: s.getAttribute("aria-activedescendant"), on: document.querySelector("#fightList .fight.on").id,
        knopf: document.querySelector("#kwKnopf").getAttribute("aria-label"), scrollTop: l.scrollTop,
        rollt: l.scrollHeight > l.clientHeight + 1, onWeg: on.top >= lr.bottom || on.bottom <= lr.top, aktivDa: !!aktiv };
    });
    assert(vorher.knopf.includes("20:10") && vorher.aktiv !== vorher.on && vorher.aktivDa && vorher.rollt && vorher.onWeg,
      "#153 Vorbereitung: 20:10 gewaehlt, Anwahl woanders, die Liste rollt, der gewaehlte ist nicht im Blick", vorher);
    appendFileSync(d7, pull(at(22, 0), 60));
    await takte(v);
    await bisSeite(v.page, () => document.querySelectorAll("#fightList .fight").length === 16, undefined, "der sechzehnte Pull ist da (#153)");
    const nachher = await v.page.evaluate(async () => {
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      return { aktiv: document.querySelector("#kwSuche").getAttribute("aria-activedescendant"),
        scrollTop: document.querySelector("#kwListe").scrollTop, knopf: document.querySelector("#kwKnopf").getAttribute("aria-label"),
        offen: document.querySelector("#kwKnopf").getAttribute("aria-expanded") === "true" };
    });
    assert(nachher.offen && nachher.knopf.includes("20:10") && nachher.scrollTop === vorher.scrollTop && nachher.aktiv === vorher.aktiv,
      "#153 neuer Kampf bei offener Liste und aelterer Auswahl: die Liste rollt nicht zum gewaehlten, die Anwahl bleibt", { vorher, nachher });
    assert(!v.fehler.length, "#153 keine Fehler in der Seite", v.fehler);
    await v.page.close();
  }
} finally {
  await browser.close();
  rmSync(work, { recursive: true, force: true });
}
console.log();
if (failed) { console.log(`LIVE PAGE FAILED - ${failed}`); process.exit(1); }
console.log("LIVE PAGE PASSED");
