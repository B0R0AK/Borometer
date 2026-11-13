// Borometer - a damage meter for Throne and Liberty
// Copyright (C) 2026 B0R0AK
// SPDX-License-Identifier: GPL-3.0-or-later
//
// Die Bereichsauswertung der neuen Analyse (src/renderer/bereich-core.ts, #414):
// Zahlen eines Bereichs, die Saetze "Was hier ablief / Gut hier / Besser
// moeglich" mit ihren Schwellen von beiden Seiten, Zielwechsel nur bei anderem
// Namen, die Marken. Gerechnet auf den reduzierten Kampfdaten und auf kleinen,
// gebauten Kaempfen. Entscheidungen vom 08.11.2026: Krit-Spanne 8 Punkte, hoechstens
// eine "gleichmaessig"-Zeile je Liste, "im geschaetzten Takt genutzt" entfaellt.
//
// Run:  npm run test:bereich-core

import { bester, daten, decke, ende, eq, hatVentius, kampf, ladeKern, ok } from "./_analyse-test.mjs";

const b = await ladeKern("bereich-core", true);
const vc = await ladeKern("ventius-core");

const vulcanus = kampf("Vulcanus", true), deckman = kampf("Ascended Deckman", true);
const pakilo = kampf("Ascended Pakilo Naru", false), warrior = kampf("Corrupted Ancient Warrior", false), radeth = kampf("Radeth", false);
const keys = (l) => l.map((x) => x.k);

// ---- Zahlen des Bereichs
const ganz = b.bereich(vulcanus, bester(vulcanus), decke(vulcanus), 0, Infinity);
ok(ganz.ganz && Math.abs(ganz.dps - vulcanus.dps) < 1500, "ganzer Kampf: die Rate ist die des Kampfs");
const teil = b.bereich(vulcanus, bester(vulcanus), decke(vulcanus), 20, 40);
eq(teil.dauer, 20, "Bereich von 20 bis 40 s");
ok(teil.bestDps !== null, "der beste Pull lief dort noch");
const spaet = b.bereich(vulcanus, bester(vulcanus), decke(vulcanus), 100, 120);
ok(spaet.bestDps === null && spaet.bestLiefKuerzer, "der kuerzere beste Pull war schon vorbei");
ok(teil.ventius && teil.ventius.gesamt === vulcanus.ventius.salven.filter((s) => s[0] >= 20 && s[0] < 40).length, "Ventius zaehlt nur die Salven des Bereichs");
ok(b.bereich(pakilo, null, 0, 0, Infinity).ventius === null, "ohne Ventius keine Ventius-Zahlen");

// ---- Sekunden, die nicht zaehlen (Ziel unverwundbar, erkannte Mechanik): keine Luecke, nicht im Median
{
  // 90 s: 20 s ruhig mit 100, dann 30 s Stille in der Phase, dann 40 s mit 100; die Phase ist ausgenommen
  const sek = [...Array(20).fill(100), ...Array(30).fill(0), ...Array(40).fill(100)];
  const aus = sek.map((_, i) => i >= 20 && i < 50);
  const basis = { hauptziel: "Test", dauerS: 90, schaden: 6000, dps: 66, schadenJeSekunde: sek, einsaetze: [], zielwechsel: [[0, "Test"]], ventius: null };
  const ohne = b.bereich(basis, null, 0, 0, Infinity);
  ok(ohne.luecken.length === 1, "ohne Ausnahme zaehlt die Stille als Luecke", ohne.luecken);
  const mit = b.bereich({ ...basis, nichtGezaehlt: aus }, null, 0, 0, Infinity);
  ok(mit.luecken.length === 0 && mit.leerlauf === 0, "die ausgenommene Strecke ist keine Luecke und kein Leerlauf", { luecken: mit.luecken, leerlauf: mit.leerlauf });
  ok(!b.ereignisse({ ...basis, nichtGezaehlt: aus }, 0).some((m) => m.k === "luecke"), "die ausgenommene Strecke traegt keine Marke Luecke");
  ok(b.ereignisse(basis, 0).some((m) => m.k === "luecke"), "ohne Ausnahme traegt die Stille die Marke Luecke");
  // eine echte Luecke ausserhalb der Phase bleibt eine
  const sek2 = [...Array(20).fill(100), ...Array(30).fill(0), ...Array(10).fill(100), ...Array(8).fill(0), ...Array(22).fill(100)];
  const aus2 = sek2.map((_, i) => i >= 20 && i < 50);
  const mit2 = b.bereich({ ...basis, schadenJeSekunde: sek2, nichtGezaehlt: aus2 }, null, 0, 0, Infinity);
  ok(mit2.luecken.length === 1 && mit2.luecken[0][0] === 60 && mit2.luecken[0][1] === 68, "eine echte Luecke ausserhalb der Phase bleibt", mit2.luecken);
}

// ---- Zielwechsel nur bei anderem Namen
eq(b.zielwechsel({ zielwechsel: [[0, "A"], [10, "A"], [20, "B"], [30, "B"], [40, "A"]] }), [[0, "A"], [20, "B"], [40, "A"]], "gleicher Name ist kein Wechsel");
ok(b.zielwechsel(deckman).length === 1, "Deckman: nur ein Ziel, der gleichnamige Eintrag zaehlt nicht", b.zielwechsel(deckman));
const w = b.bereich(warrior, bester(warrior), 0, 0, Infinity);
ok(w.ziele.length >= 5, "der Dungeon-Gegner traegt Zielwechsel", w.ziele.length);
ok(b.saetze(w).besser.some((x) => x.k === "ziel"), "Zielwechsel stehen unter Besser moeglich");

// ---- die Schwellen, von beiden Seiten. Ein gebauter Kampf: 120 s, 10 000 je Sekunde, ein Einsatz je Sekunde
function bau(dps, opt = {}) {
  const sek = Array.from({ length: 120 }, (_, i) => (opt.loch && i >= opt.loch[0] && i < opt.loch[1] ? 0 : dps));
  const einsaetze = [];
  for (let t = 0; t < 120; t += 2) einsaetze.push([t, "100000001", "Knopf", dps * 2, 1, (t / 2) % 2 === 0 ? 1 : 0, 0]);
  return { hauptziel: "X", dauerS: 120, schaden: sek.reduce((x, y) => x + y, 0), dps: sek.reduce((x, y) => x + y, 0) / 120, schadenJeSekunde: sek, einsaetze, zielwechsel: [[0, "X"]], ventius: null, ...opt.rest };
}
const keine = (e) => ({ ...e });
{
  const k = bau(10000);
  // Bereich von 30 s mit 15 % mehr Rate (11,5k gegen Mittel 10,375k = +10,8 %): Sekunden 30..60 hoeher
  const mehr = { ...k, schadenJeSekunde: k.schadenJeSekunde.map((v, i) => (i >= 30 && i < 60 ? 11500 : v)) };
  mehr.schaden = mehr.schadenJeSekunde.reduce((x, y) => x + y, 0); mehr.dps = mehr.schaden / 120;
  const e1 = b.bereich(mehr, null, 0, 30, 60), s1 = b.saetze(e1);
  ok(e1.dps / e1.dpsKampf >= 1.1 && keys(s1.gut).includes("dps"), "Rate ab +10 % ueber dem Kampf steht unter Gut", e1.dps / e1.dpsKampf);
  const wenig = { ...k, schadenJeSekunde: k.schadenJeSekunde.map((v, i) => (i >= 30 && i < 60 ? 11300 : v)) };
  wenig.schaden = wenig.schadenJeSekunde.reduce((x, y) => x + y, 0); wenig.dps = wenig.schaden / 120;
  const e2 = b.bereich(wenig, null, 0, 30, 60);
  ok(e2.dps / e2.dpsKampf < 1.1 && !keys(b.saetze(e2).gut).includes("dps"), "knapp darunter (+9,4 %) steht es nicht", e2.dps / e2.dpsKampf);
  const schwach = { ...k, schadenJeSekunde: k.schadenJeSekunde.map((v, i) => (i >= 30 && i < 60 ? 8000 : v)) };
  schwach.schaden = schwach.schadenJeSekunde.reduce((x, y) => x + y, 0); schwach.dps = schwach.schaden / 120;
  ok(keys(b.saetze(b.bereich(schwach, null, 0, 30, 60)).besser).includes("dps"), "Rate unter 90 % steht unter Besser moeglich");
}
{
  // Leerlauf: eine Luecke von 6 s ab Sekunde 40 (2 s und laenger, unter 2 % des Medians)
  const l = bau(10000, { loch: [40, 46] });
  const e = b.bereich(l, null, 0, 0, Infinity), s = b.saetze(e);
  eq(e.luecken.length, 1, "eine Luecke gefunden");
  ok(keys(s.besser).includes("leer") && !keys(s.gut).includes("leer"), "viel Leerlauf (5 % der Zeit) steht nur unter Besser");
  const kurz = bau(10000, { loch: [40, 42] });
  const s2 = b.saetze(b.bereich(kurz, null, 0, 0, Infinity));
  ok(keys(s2.gut).includes("leer") && !keys(s2.besser).includes("leer"), "wenig Leerlauf (2 s, unter 3 %) steht nur unter Gut");
  const s3 = b.saetze(b.bereich(bau(10000), null, 0, 0, Infinity));
  eq(s3.gut.find((x) => x.k === "leer").satz.key, "analysis.e.bs.leer.kein", "keine Luecke: Kein Leerlauf");
}
{
  // gleichmaessige Kritquote: in jedem 30-s-Abschnitt gleich viele krit -> hier abwechselnd = 50 % ueberall
  const k = bau(10000);
  const e = b.bereich(k, null, 0, 0, Infinity);
  eq(e.abschnitte.length, 4, "vier volle Abschnitte zu 30 s");
  const s = b.saetze(e);
  const gleich = s.gut.filter((x) => /gleich$/.test(x.satz.key));
  eq(gleich.length <= 1, true, "hoechstens eine 'gleichmaessig'-Zeile je Liste");
  eq(gleich.map((x) => x.satz.key), ["analysis.e.bs.krit.gleich"], "bei beiden Moeglichkeiten bleibt die Kritquote");
  // Spanne 8 Punkte: 4 Abschnitte, Krit 40 % und 50 % ist 10 Punkte -> nicht gleichmaessig; 44 % und 50 % -> gleichmaessig
  const krit = (lo) => { const k2 = bau(10000); k2.einsaetze = k2.einsaetze.map((z, i) => { z = [...z]; const abschnitt = Math.floor(z[0] / 30), anteil = abschnitt === 0 ? lo : 0.5; z[4] = 20; z[5] = Math.round(20 * anteil); return z; }); return k2; };
  const dicht = (k2) => b.saetze(b.bereich(k2, null, 0, 0, Infinity)).gut.some((x) => x.satz.key === "analysis.e.bs.krit.gleich");
  ok(!dicht(krit(0.4)), "Spanne 10 Punkte: nicht gleichmaessig");
  ok(dicht(krit(0.44)), "Spanne 6 Punkte: gleichmaessig");
  ok(b.GUT.KRIT_SPANNE === 0.08, "die Spanne ist 8 Punkte (Entscheidung 08.11.2026)");
}
ok(!Object.keys(b.GUT).includes("AUSLASTUNG"), "'im geschaetzten Takt genutzt' entfaellt");

// ---- Ventius-Saetze nur mit Ventius
for (const k of daten.kaempfe) {
  const s = b.saetze(b.bereich(k, bester(k), decke(k), 0, Infinity));
  const mitV = [...s.gut, ...s.besser].some((x) => /\.vent\./.test(x.satz.key));
  if (!hatVentius(k)) ok(!mitV, "ohne Ventius kein Ventius-Satz: " + k.hauptziel);
}
{
  const v = daten.kaempfe.filter(hatVentius);
  ok(v.some((k) => { const s = b.saetze(b.bereich(k, bester(k), decke(k), 0, Infinity)); return [...s.gut, ...s.besser].some((x) => /\.vent\./.test(x.satz.key)); }), "mit Ventius mindestens ein Ventius-Satz");
}

// ---- Hoechstens fuenf, nie leer, ein neutraler Satz statt nichts
for (const k of daten.kaempfe) for (const [x, y] of [[0, Infinity], [60, 90]]) {
  const s = b.saetze(b.bereich(k, bester(k), decke(k), x, y));
  ok(s.gut.length >= 1 && s.gut.length <= 5 && s.besser.length <= 5, "Anzahl der Saetze: " + k.hauptziel + " " + x + "-" + y);
}
ok(b.saetze(b.bereich(radeth, null, 0, 0, Infinity)).gut.length >= 1, "Radeth hat einen Gut-Satz");

// ---- Ventius gegen die Salven des besten Pulls (#414)
{
  const salve = (t, nb) => [t, nb, 1 + 3 * Math.max(nb, 0), 1000, 1, 1, [1, ...Array(Math.max(nb, 0)).fill(3)]];
  const mitSalven = (nbs, dauer = 100) => ({ ...bau(10000), dauerS: dauer, ventius: { salven: nbs.map((nb, i) => salve(5 + i * 10, nb)) } });
  const hier = mitSalven([3, 3, 3, 3, 3, 3, 3, 2]);        // sieben lesbare an der Decke, die letzte (2) ist Kampfende
  const dort = mitSalven([3, 3, 2, 1, 3, 3, 3, 3]);        // acht lesbare, sechs an der Decke
  const e1 = b.bereich(hier, dort, 0, 0, Infinity);
  ok(e1.ventiusBest && e1.ventius, "mit Salven auf beiden Seiten gibt es den Vergleich");
  eq([e1.ventius.anDecke, e1.ventius.lesbar, e1.ventiusBest.anDecke, e1.ventiusBest.lesbar], [7, 7, 6, 8], "hier 7 von 7, im besten Pull 6 von 8, dieselbe Decke");
  const k1 = keys(b.saetze(e1).gut);
  ok(b.saetze(e1).gut.some((x) => x.satz.key === "analysis.e.bs.vent.vsGut") && !b.saetze(e1).besser.some((x) => /vent\.vs/.test(x.satz.key)), "hier mindestens so gut: unter Gut hier", k1);
  const e2 = b.bereich(dort, hier, 0, 0, Infinity);
  ok(b.saetze(e2).besser.some((x) => x.satz.key === "analysis.e.bs.vent.vsBesser"), "im besten Pull mehr an der Decke: unter Besser moeglich");
  // ohne Salven im besten Pull (ein aelterer Pull) oder bei kuerzerem Pull: kein Vergleich, kein Satz
  const e3 = b.bereich(hier, bau(10000), 0, 0, Infinity);
  ok(e3.ventiusBest === null && ![...b.saetze(e3).gut, ...b.saetze(e3).besser].some((x) => /vent\.vs/.test(x.satz.key)), "ein bester Pull ohne Salven: kein Vergleich");
  ok(b.bereich(hier, mitSalven([3, 3, 3], 50), 0, 0, Infinity).ventiusBest === null, "ein kuerzerer bester Pull: kein Vergleich");
  // unter drei lesbaren Salven auf einer Seite sagt der Vergleich nichts
  const wenig = b.saetze(b.bereich(hier, mitSalven([3, 3]), 0, 0, Infinity));
  ok(![...wenig.gut, ...wenig.besser].some((x) => /vent\.vs/.test(x.satz.key)), "unter drei Salven im besten Pull: kein Satz");
  for (const s of [{ key: "analysis.e.bs.vent.vsGut", vars: { anHier: 7, lesbarHier: 7, anDort: 6, lesbarDort: 8, nb: false } }, { key: "analysis.e.bs.vent.vsBesser", vars: { anHier: 6, lesbarHier: 8, anDort: 7, lesbarDort: 7, nb: true } }])
    for (const sp of ["de", "en"]) { const t = b.I18N[sp][s.key](s.vars); ok(/\d/.test(t) && !/undefined|NaN/.test(t), sp + " " + s.key, t); }
}

// ---- Marken
const ev = b.ereignisse(warrior, 0);
ok(ev.some((e) => e.k === "spitze") && ev.some((e) => e.k === "einsatz") && ev.some((e) => e.k === "luecke"), "Marken: Spitze, Einsatz, Luecke");
ok(ev.filter((e) => e.k === "ziel").length >= 5, "Marken: Zielwechsel");
const ev2 = b.ereignisse(vulcanus, decke(vulcanus));
const va = vc.ventiusAuswertung(vulcanus, decke(vulcanus));
eq(ev2.filter((e) => e.k === "unter").length, va.salven.filter((s) => s.status === "unter").length, "Marken: Salven unter der Decke");
eq(ev2.filter((e) => e.k === "unlesbar").length, va.unlesbar, "Marken: unlesbare Salven");
ok(!b.ereignisse(pakilo, 0).some((e) => e.k === "unter" || e.k === "unlesbar"), "ohne Ventius keine Salven-Marken");
ok(ev2.every((e, i, l) => !i || l[i - 1].von <= e.von), "Marken nach Zeit geordnet");

// ---- Abstand zum besten Pull
const f = b.abstandFenster(pakilo, bester(pakilo));
ok(f && f.mehr > 0 && f.von >= 0, "Abstandsfenster");
eq(b.abstandFenster(pakilo, null), null, "ohne besten Pull kein Fenster");

// ---- jeder Satz laeuft in beiden Sprachen, ohne Luecken und ohne ein Warum
const WARUM = /\b(weil|deshalb|deswegen|wegen|because|due to|therefore)\b|Position/i;
const alle = [];
for (const k of daten.kaempfe) for (const [x, y] of [[0, Infinity], [20, 50], [60, 90], [100, 125]]) {
  const e = b.bereich(k, bester(k), decke(k), x, y), s = b.saetze(e);
  alle.push(s.kopf, ...s.gut.map((o) => o.satz), ...s.besser.map((o) => o.satz));
}
for (const k of daten.kaempfe) for (const m of b.ereignisse(k, decke(k))) alle.push(m.satz);
const gesehen = new Set();
for (const s of alle) for (const sprache of ["de", "en"]) {
  const e = b.I18N[sprache][s.key];
  const text = typeof e === "function" ? e(s.vars) : e;
  gesehen.add(s.key);
  ok(typeof text === "string" && text.length > 3 && !/undefined|NaN|\[object/.test(text), sprache + " " + s.key, text);
  if (/\.(vent|krit|dps|best|leer|takt|ziel|spitze|bereit|ruhig)/.test(s.key) && !/\.vent\.(unter)$/.test(s.key) && !/leer\.viel|ziel\.wechsel|krit\.(ueber|unter|ueberBest)$/.test(s.key)) ok(!WARUM.test(text), "kein Warum: " + s.key, text);
}
ok(gesehen.size >= 20, "viele verschiedene Saetze kamen vor", gesehen.size);

ende();
