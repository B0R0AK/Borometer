// Borometer - a damage meter for Throne and Liberty
// Copyright (C) 2026 B0R0AK
// SPDX-License-Identifier: GPL-3.0-or-later
//
// Die Punkte des Verlaufs (src/renderer/verlauf-core.ts), ohne Seite:
// esbuild buendelt die eine Datei - sie importiert nur Typen und mitte()
// aus build-core.ts -, Node fuehrt sie aus.
//
// Seit der Neugestaltung (28.09., Luecken 6.1 und 6.2) steht x auf dem
// Datum, nicht mehr in der Reihenfolge: zeitLagen() statt punktLagen().
// Die Proben fuer y, Radius, Median, Rand und den leeren Fall folgen dem
// Entwurf unveraendert streng; "gleiche Abstaende in der Reihenfolge" ist
// "Abstaende nach der Zeit" geworden. Dazu zuletztGeoeffnet() fuer Start
// (Luecken 1.8, Kern und Proben vom Branch claude/entwurf-angleichung).
//
// Run:  npm run test:verlauf-core

import * as esbuild from "esbuild";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { bilderModus, bilderPlugin } from "./bilder-weiche.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const bau = async (datei) => {
  const b = await esbuild.build({
    entryPoints: [join(root, "src", "renderer", datei)],
    bundle: true, format: "esm", platform: "neutral", write: false, logLevel: "silent", plugins: [bilderPlugin(root, bilderModus(root))],
  });
  return import("data:text/javascript;base64," + Buffer.from(b.outputFiles[0].text).toString("base64"));
};
const core = await bau("verlauf-core.ts");
const build = await bau("build-core.ts");

let failed = 0;
function ok(cond, name, detail) {
  if (cond) console.log("  ok    " + name);
  else { failed++; console.log("  FAIL  " + name + (detail === undefined ? "" : "\n        " + JSON.stringify(detail))); }
}
const nah = (a, b, e = 1e-9) => Math.abs(a - b) <= e;

const TAG = 86400000;
// die Uhr des Logs steht in den UTC-Feldern (wallTime, pullWhen)
const am = (tag, h = 21, m = 0, monat = 8) => Date.UTC(2026, monat, tag, h, m, 0);
const flaeche = { breite: 400, hoehe: 200, rand: 20 };
const k = (dps, dur, at) => ({ dps, dur, at });

// ---- der Tag eines Kampfs und die Spanne des Zeitraums (Luecken 6.1)
{
  ok(core.TAG_MS === TAG, "ein Tag hat 86 400 000 ms", core.TAG_MS);
  ok(core.tagVon(am(20, 21, 30)) === Date.UTC(2026, 8, 20) && core.tagVon(Date.UTC(2026, 8, 20)) === Date.UTC(2026, 8, 20) &&
     core.tagVon(am(20, 23, 59)) === Date.UTC(2026, 8, 20), "tagVon: Mitternacht auf der Uhr des Logs (UTC-Felder)",
     [core.tagVon(am(20, 21, 30)), Date.UTC(2026, 8, 20)]);
  const ats = [am(1), am(12), am(20, 22)];
  const w = core.zeitSpanne(ats, "woche"), m = core.zeitSpanne(ats, "monat"), a = core.zeitSpanne(ats, "alles");
  ok(w.bis === Date.UTC(2026, 8, 21) && w.von === Date.UTC(2026, 8, 14) && w.tage === 7,
    "Woche: sieben Tage bis zum Ende des Tages mit dem neuesten Kampf", w);
  ok(m.bis === Date.UTC(2026, 8, 21) && m.von === Date.UTC(2026, 7, 22) && m.tage === 30,
    "Monat: dreissig Tage bis zum Ende des Tages mit dem neuesten Kampf", m);
  ok(a.bis === Date.UTC(2026, 8, 21) && a.von === Date.UTC(2026, 8, 1) && a.tage === 20,
    "Alles: vom Tag des aeltesten bis zum Tag des neuesten Kampfs", a);
  ok(core.zeitSpanne([], "monat") === null, "ohne Kaempfe keine Spanne");
  const alle = ats.map((at, i) => k(100 + i, 60, at));
  ok(core.imZeitraum(alle, w).length === 1 && core.imZeitraum(alle, m).length === 3 && core.imZeitraum(alle, a).length === 3,
    "imZeitraum: nur die Kaempfe in der Spanne", [core.imZeitraum(alle, w).length, core.imZeitraum(alle, m).length]);
  // die Grenzen: der erste Augenblick von "von" zaehlt, "bis" nicht mehr
  const g = [k(1, 1, w.von), k(2, 1, w.von - 1), k(3, 1, w.bis - 1), k(4, 1, w.bis)];
  ok(JSON.stringify(core.imZeitraum(g, w).map((x) => x.dps)) === "[1,3]", "imZeitraum: von gehoert dazu, bis nicht", core.imZeitraum(g, w));
  // ein einziger Tag: Alles ist ein Tag lang
  const e = core.zeitSpanne([am(20, 20), am(20, 22)], "alles");
  ok(e.tage === 1 && e.von === Date.UTC(2026, 8, 20), "Alles an einem Tag: ein Tag", e);
}

// ---- zwei Quellen, ein Verlauf: gelesene und gespeicherte Kaempfe
{
  const log = [{ at: am(20), dps: 100, q: "log" }, { at: am(18), dps: 80, q: "log" }];
  const gespeichert = [{ at: am(20), dps: 101, q: "best" }, { at: am(10), dps: 90, q: "best" }];
  const z = core.zusammenfuehren(log, gespeichert);
  ok(z.length === 3 && z.map((x) => x.at).join() === [am(10), am(18), am(20)].join(),
    "zusammenfuehren: derselbe Kampf (gleicher Beginn) nur einmal, nach der Zeit", z);
  ok(z.find((x) => x.at === am(20)).q === "log", "zusammenfuehren: die erste Quelle gewinnt", z);
  ok(core.zusammenfuehren().length === 0 && core.zusammenfuehren([], []).length === 0, "zusammenfuehren: nichts bleibt nichts");
}

// ---- x nach dem Datum (Luecken 6.2) - folgt Entwurf, frueher "gleiche Abstaende in der Reihenfolge"
{
  const s = core.zeitSpanne([am(14, 0, 0), am(20, 12)], "woche");   // 14.09. bis Ende 20.09., 7 Tage
  const K = [k(100, 60, am(14, 0, 0)), k(200, 60, am(15, 0, 0)), k(150, 60, am(15, 12, 0)), k(50, 60, am(18, 0, 0)), k(120, 60, am(20, 12))];
  const L = core.zeitLagen(K, flaeche, s, 8);
  const xs = L.punkte.map((p) => p.x);
  const innen = 360, proTag = innen / 7;
  ok(L.punkte.length === 5, "je Kampf ein Punkt", L.punkte.length);
  ok(nah(xs[0], 20), "der Beginn der Spanne liegt am linken Rand", xs);
  ok(nah(xs[1] - xs[0], proTag) && nah(xs[2] - xs[1], proTag / 2) && nah(xs[3] - xs[1], 3 * proTag),
    "Abstaende nach der Zeit: ein Tag, ein halber, drei Tage", xs);
  ok(nah(L.x(s.bis), 380) && nah(L.x(s.von), 20), "x: von am linken, bis am rechten Rand", [L.x(s.von), L.x(s.bis)]);
  // y wie bisher: 0 unten, mehr DPS weiter oben, linear
  ok(L.punkte.every((p) => p.y > 20 - 1e-9 && p.y <= 180 + 1e-9), "y innerhalb des Randes", L.punkte.map((p) => p.y));
  ok(L.punkte[1].y < L.punkte[2].y && L.punkte[2].y < L.punkte[0].y && L.punkte[0].y < L.punkte[3].y,
    "mehr DPS steht hoeher", L.punkte.map((p) => p.y));
  ok(nah(L.y(0), 180), "y(0) ist die Unterkante", L.y(0));
  ok(nah((180 - L.punkte[1].y) / (180 - L.punkte[3].y), 4), "y ab 0: doppelte DPS, doppelte Hoehe ueber dem Boden",
    L.punkte.map((p) => p.y));
  ok(L.max >= 200 && L.y(L.max) >= 20 - 1e-9, "die Achse reicht ueber den besten Wert und bleibt im Rand", L.max);
  ok(L.bester === 1, "bester = Index des hoechsten DPS", L.bester);
  ok(L.median === build.mitte([100, 200, 150, 50, 120]) && L.median === 120, "Median = mitte()", L.median);
  ok(nah(L.medianY, L.y(120)), "die Medianlinie auf der Hoehe des Medians", L.medianY);
  ok(L.striche[0] === 0 && L.striche[L.striche.length - 1] === L.max && L.striche.length >= 2,
    "Teilstriche von 0 bis zum Ende der Achse", L.striche);
  // runde Schritte: 1, 2, 2,5 oder 5 mal eine Zehnerpotenz, gleich weit (Luecken 6.3)
  const schritt = L.striche[1] - L.striche[0], p10 = 10 ** Math.floor(Math.log10(schritt));
  ok([1, 2, 2.5, 5].some((f) => nah(schritt / p10, f)) && L.striche.every((v, i) => nah(v, i * schritt, 1e-6)) &&
     L.striche.length >= 3 && L.striche.length <= 6 && L.max === 250,
     "y-Achse: drei bis sechs runde Werte in gleichen Schritten, das Ende knapp ueber dem besten plus 5 % (200 -> 250, nicht 300)", L.striche);
  // der Tag: Band vom Tagesanfang bis zum naechsten
  const b = L.band(am(15, 12));
  ok(nah(b.x0, 20 + proTag) && nah(b.x1, 20 + 2 * proTag), "band: der ganze Tag des Kampfs", b);
}

// ---- Teilstriche der Datumsachse
{
  const woche = core.zeitSpanne([am(20)], "woche");
  const t7 = core.datumStriche(woche, 8);
  ok(t7.length === 7 && t7[6] === Date.UTC(2026, 8, 20) && t7.every((d, i) => !i || d - t7[i - 1] === TAG),
    "Woche, Platz fuer 8: jeder Tag, der letzte ist der Tag des neuesten Kampfs", t7);
  const monat = core.zeitSpanne([am(20)], "monat");
  const t30 = core.datumStriche(monat, 8);
  const sch = t30.length > 1 ? (t30[1] - t30[0]) / TAG : 0;
  ok(t30.length <= 8 && t30.length >= 4 && t30[t30.length - 1] === Date.UTC(2026, 8, 20) &&
     [1, 2, 5, 7, 14].includes(sch) && t30.every((d, i) => !i || d - t30[i - 1] === sch * TAG) &&
     t30.every((d) => d >= monat.von && d < monat.bis),
    "Monat, Platz fuer 8: gleiche Schritte aus 1, 2, 5, 7, 14 Tagen, hoechstens 8, rueckwaerts vom letzten Tag", { t30, sch });
  const eng = core.datumStriche(monat, 3);
  ok(eng.length <= 3 && eng.length >= 2 && eng[eng.length - 1] === Date.UTC(2026, 8, 20), "schmal: hoechstens so viele wie Platz", eng);
  const jahr = core.zeitSpanne([am(1, 20, 0, 0), am(20)], "alles");
  const tj = core.datumStriche(jahr, 6);
  ok(tj.length <= 6 && tj.length >= 2 && tj.every((d) => d % TAG === 0), "Alles ueber Monate: hoechstens 6 Tagesanfaenge", tj);
  ok(core.datumStriche(woche, 0).length === 1, "ohne Platz: nur der letzte Tag", core.datumStriche(woche, 0));
}

// ---- Radius nach der Dauer: r = 3 + min(4, sqrt(dauer/30) * 1.6)
{
  const s = core.zeitSpanne([am(20)], "woche");
  const L = core.zeitLagen([k(100, 0, am(17)), k(100, 30, am(18)), k(100, 120, am(19)), k(100, 3600, am(20))], flaeche, s, 7);
  const rs = L.punkte.map((p) => p.r);
  ok(nah(rs[0], 3) && nah(rs[1], 4.6) && nah(rs[2], 6.2) && nah(rs[3], 7), "Radius nach der Formel, hoechstens 7", rs);
  ok(nah(core.punktRadius(30), 4.6) && nah(core.punktRadius(-5), 3), "punktRadius allein, keine negative Dauer",
    [core.punktRadius(30), core.punktRadius(-5)]);
}

// ---- Median erst ab MIN_MEDIAN
{
  const n = build.MIN_MEDIAN;
  const s = core.zeitSpanne([am(20)], "monat");
  const reihe = (m, f) => Array.from({ length: m }, (_, i) => k(f(i), 60, am(10 + i)));
  const unter = core.zeitLagen(reihe(n - 1, (i) => 100 + i), flaeche, s, 8);
  ok(unter.median === null && unter.medianY === null, `unter ${n} Kaempfen kein Median`, unter.median);
  const ab = core.zeitLagen(reihe(n, (i) => 100 + 10 * i), flaeche, s, 8);
  ok(ab.median === build.mitte(Array.from({ length: n }, (_, i) => 100 + 10 * i)), `ab ${n} Kaempfen der Median`, ab.median);
  const vier = core.zeitLagen([k(10, 1, am(10)), k(40, 1, am(11)), k(20, 1, am(12)), k(30, 1, am(13))], flaeche, s, 8);
  ok(vier.median === 25, "vier Kaempfe: Mittel der beiden mittleren", vier.median);
}

// ---- ein Kampf allein: er ist der beste, kein Median (Pruefung 29.09., Befund 2; vorher bei punktLagen)
{
  const s = core.zeitSpanne([am(20)], "woche");
  const L = core.zeitLagen([k(500, 60, am(20))], flaeche, s, 7);
  ok(L.punkte.length === 1 && L.bester === 0 && L.median === null && L.medianY === null && L.punkte[0].x > 20 && L.punkte[0].x < 380,
    "ein Kampf: er ist der beste, kein Median, er liegt in der Spanne", L);
}

// ---- das Ende der y-Achse knapp ueber dem besten (Pruefung 29.09., Befund 4): 212k -> 0 bis 250k in 50k
{
  const s = core.zeitSpanne([am(20)], "woche");
  const L = core.zeitLagen([k(212000, 60, am(19)), k(150000, 60, am(20))], flaeche, s, 7);
  ok(L.max === 250000 && L.striche.join() === "0,50000,100000,150000,200000,250000", "212k: die Achse endet bei 250k, Schritte zu 50k", L.striche);
}

// ---- gleiche DPS ueberall: eine waagerechte Reihe, der erste ist der beste
{
  const s = core.zeitSpanne([am(20)], "woche");
  const L = core.zeitLagen([k(300, 60, am(17)), k(300, 10, am(18)), k(300, 200, am(19)), k(300, 60, am(20))], flaeche, s, 7);
  const ys = L.punkte.map((p) => p.y);
  ok(ys.every((y) => nah(y, ys[0])) && ys[0] < 180, "gleiche DPS: eine waagerechte Reihe ueber dem Boden", ys);
  ok(L.bester === 0, "gleiche DPS: bester ist der erste", L.bester);
  ok(nah(L.medianY, ys[0]), "gleiche DPS: der Median liegt auf der Reihe", L.medianY);
}

// ---- Rand je Seite
{
  const s = core.zeitSpanne([am(20)], "woche");
  const L = core.zeitLagen([k(100, 60, s.von), k(200, 60, s.bis)], { breite: 300, hoehe: 150, rand: { links: 40, rechts: 10, oben: 12, unten: 24 } }, s, 7);
  ok(nah(L.punkte[0].x, 40) && nah(L.punkte[1].x, 290), "Rand links und rechts", L.punkte.map((p) => p.x));
  ok(nah(L.y(0), 126), "Rand unten", L.y(0));
}

// ---- ohne Kaempfe und ohne Schaden: nichts bricht
{
  const s = core.zeitSpanne([am(20)], "woche");
  const L = core.zeitLagen([], flaeche, s, 7);
  ok(L.punkte.length === 0 && L.bester === -1 && L.median === null, "ohne Kaempfe: keine Punkte", L);
  const N = core.zeitLagen([k(0, 10, am(19)), k(0, 10, am(20))], flaeche, s, 7);
  ok(N.punkte.every((p) => Number.isFinite(p.y) && nah(p.y, 180)), "null DPS: die Punkte liegen am Boden", N.punkte);
}

// ---- der Abend zuerst (Feinschliff 02.10., Abschnitt 4): an hoechstens zwei aufeinanderfolgenden
// Kalendertagen stehen die Pulls nacheinander (x = Pull 1 bis n, Beschriftung Uhrzeit), sonst die Datumsachse
{
  const abend = [am(20, 19, 4), am(20, 19, 7), am(20, 19, 10), am(20, 19, 13), am(20, 19, 16), am(20, 19, 20)];
  ok(core.abendAchse(abend) === true, "abendAchse: sechs Pulls an einem Abend", abend);
  ok(core.abendAchse([am(20, 23, 40), am(21, 0, 20)]) === true, "abendAchse: ein Abend ueber Mitternacht (zwei Tage hintereinander)");
  ok(core.abendAchse([am(16), am(20)]) === false, "abendAchse: zwei Tage mit Luecke dazwischen sind kein Abend");
  ok(core.abendAchse([am(14), am(15), am(16), am(18), am(20)]) === false, "abendAchse: fuenf Tage - Datumsachse");
  ok(core.abendAchse([am(20)]) === true && core.abendAchse([]) === false, "abendAchse: ein Kampf ja, keiner nein");

  const K = abend.map((at, i) => k(100 + 10 * i, 60 + i, at));
  const s = core.zeitSpanne(abend, "monat");
  const L = core.pullLagen(K, flaeche, 8);
  const xs = L.punkte.map((p) => p.x);
  const innen = 360;
  ok(L.art === "pull" && L.punkte.length === 6, "pullLagen: je Pull ein Punkt, art pull", L.art);
  ok(xs.every((x, i) => !i || nah(x - xs[i - 1], innen / 6)) && nah(xs[0], 20 + innen / 12),
    "pullLagen: gleiche Abstaende in der Reihenfolge, je Pull ein Feld, der Punkt in seiner Mitte", xs);
  ok(xs[5] - xs[0] >= 0.6 * 400, "pullLagen: sechs Pulls ueber mindestens 60 % der Breite", xs);
  ok(L.bester === 5 && L.median === build.mitte(K.map((x) => x.dps)) && nah(L.y(0), 180) && L.max >= 150,
    "pullLagen: y, bester und Median wie auf der Datumsachse", L);
  ok(L.marken.length === 6 && L.marken.every((m, i) => m.at === abend[i] && nah(m.x, xs[i])),
    "pullLagen: Platz fuer 8 - jeder Pull beschriftet, an seinem Punkt, mit seiner Zeit", L.marken);
  const eng = core.pullLagen(K, flaeche, 3);
  ok(eng.marken.length <= 3 && eng.marken.length >= 2 && eng.marken[0].at === abend[0] &&
     eng.marken.every((m, i) => !i || m.x - eng.marken[i - 1].x > 0),
    "pullLagen: schmal - hoechstens so viele Beschriftungen wie Platz, ab Pull 1 in gleichen Schritten", eng.marken);
  const b = L.band(abend[2]);
  ok(nah(b.x0, 20) && nah(b.x1, 380), "pullLagen: der gewaehlte Tag als Band ueber seine Pulls", b);
  const zwei = core.pullLagen([k(1, 60, am(20, 23, 40)), k(2, 60, am(20, 23, 50)), k(3, 60, am(21, 0, 20))], flaeche, 8);
  const b2 = zwei.band(am(21, 0, 20));
  ok(nah(b2.x0, 20 + 2 * 120) && nah(b2.x1, 380), "pullLagen: ueber Mitternacht deckt das Band nur die Pulls des neuen Tags", b2);
  const D = core.zeitLagen(K, flaeche, s, 8);
  ok(D.art === "datum" && D.marken.length === D.tage.length && D.marken.every((m, i) => m.at === D.tage[i] && nah(m.x, D.x(D.tage[i] + TAG / 2))),
    "zeitLagen: art datum, die Marken sind die Tage in der Mitte ihres Tages", D.marken);
  const leer = core.pullLagen([], flaeche, 8);
  ok(leer.punkte.length === 0 && leer.marken.length === 0 && leer.bester === -1, "pullLagen: ohne Kaempfe nichts", leer);
  const einer = core.pullLagen([k(5, 10, am(20))], flaeche, 8);
  ok(nah(einer.punkte[0].x, 200), "pullLagen: ein Pull steht in der Mitte", einer.punkte);
}

// ---- "Zuletzt geoeffnet" auf Start (Luecken 1.8, Kern vom Branch claude/entwurf-angleichung samt Proben):
// neueste Datei zuerst, Tag, Zeitspanne vom ersten Kampf bis zum Ende des letzten, Zahl der Bosskaempfe
{
  const at = (d, h, m) => Date.UTC(2026, 8, d, h, m, 0);
  const Z = core.zuletztGeoeffnet({
    "a.txt": { fights: [{ at: at(20, 20, 0), dur: 60 }, { at: at(20, 21, 0), dur: 90 }] },
    "b.txt": { fights: [{ at: at(25, 19, 44), dur: 30 }] },
    "c.txt": { fights: [] },
    "d.txt": { fights: [{ at: at(18, 8, 5), dur: 10 }] },
    "e.txt": { fights: [{ at: at(10, 8, 5), dur: 10 }] },
  });
  ok(Z.length === 3 && Z.map((z) => z.datei).join() === "b.txt,a.txt,d.txt", "zuletzt: drei, die neueste zuerst, eine leere faellt weg", Z);
  ok(Z[1].tag === "20.09." && Z[1].von === "20:00" && Z[1].bis === "21:01" && Z[1].n === 2, "zuletzt: Tag, von, bis (Ende des letzten Kampfs), Zahl", Z[1]);
  const O = core.zuletztGeoeffnet({ "x.txt": { fights: [{ at: 3600000 * 21, dur: 5 }] } });
  ok(O.length === 1 && O[0].tag === "" && O[0].von === "21:00", "zuletzt: Zeit ohne Datum, kein Tag", O);
  ok(core.zuletztGeoeffnet({}).length === 0 && core.zuletztGeoeffnet(undefined).length === 0, "zuletzt: leer, keine Zeilen");
  // Rekorde (Spezifikation 3): eine Datei, die nur nachgelesen und nie geoeffnet wurde (nach), steht nicht unter "Zuletzt geoeffnet"
  const R = core.zuletztGeoeffnet({
    "auf.txt": { fights: [{ at: at(20, 20, 0), dur: 60 }] },
    "nach.txt": { nach: true, bytes: 900, fights: [{ at: at(26, 20, 0), dur: 60 }] },
  });
  ok(R.map((z) => z.datei).join() === "auf.txt", "zuletzt: eine nur nachgelesene Datei faellt weg", R);
}

// ---- Fruehere Tage in der Kampfwahl (Nachtraege N3): die Logdateien des Ordners nach dem Tag ihrer
// Aenderungszeit in Europe/Berlin, der neueste Tag zuerst, im Tag die aelteste Datei zuerst
{
  const sek = (mo, d, h, mi) => Math.floor(Date.UTC(2026, mo, d, h, mi) / 1000);
  const T = core.logTage([
    { name: "c2.txt", size: 5, mtime: sek(8, 26, 19, 0) },    // 26.09. 21:00 in Berlin
    { name: "c1.txt", size: 5, mtime: sek(8, 25, 22, 30) },   // 26.09. 00:30 in Berlin, nach UTC noch der 25.
    { name: "b2.txt", size: 5, mtime: sek(8, 25, 21, 30) },   // 25.09. 23:30 in Berlin
    { name: "b1.txt", size: 5, mtime: sek(8, 25, 8, 0) },
    { name: "w.txt", size: 5, mtime: sek(0, 14, 23, 30) },    // Winterzeit: 15.01. 00:30 in Berlin
    { name: "", size: 5, mtime: sek(8, 20, 8, 0) },
    { name: "kaputt.txt", size: 5, mtime: NaN },
  ]);
  ok(T.map((t) => t.tag).join() === "2026-09-26,2026-09-25,2026-01-15",
    "tage: nach dem Tag in Europe/Berlin (Sommer- und Winterzeit), der neueste zuerst; ohne Namen oder Zeit faellt eine Datei weg", T);
  ok(T[0]?.dateien.map((d) => d.name).join() === "c1.txt,c2.txt" && T[1]?.dateien.map((d) => d.name).join() === "b1.txt,b2.txt",
    "tage: im Tag die aelteste Datei zuerst, 00:30 in Berlin gehoert zum neuen Tag", T);
  ok(JSON.stringify(core.tagTeile("2026-09-26")) === JSON.stringify({ w: 6, d: "26.09." }) && core.tagTeile("kein Tag") === null,
    "tage: Wochentag und Datum eines Tages fuer die Kopfzeile", core.tagTeile("2026-09-26"));
  ok(core.berlinTag(Date.UTC(2026, 8, 25, 22, 30)) === "2026-09-26" && core.berlinTag(Date.UTC(2026, 8, 25, 21, 59)) === "2026-09-25",
    "tage: berlinTag rechnet die Mitternacht in Berlin");
  ok(core.logTage([]).length === 0 && core.logTage(undefined).length === 0, "tage: leer, keine Tage");
}

console.log(failed ? `\n${failed} FAILED` : "\nall ok");
process.exit(failed ? 1 : 0);
