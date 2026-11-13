// Borometer - a damage meter for Throne and Liberty
// Copyright (C) 2026 B0R0AK
// SPDX-License-Identifier: GPL-3.0-or-later
//
// Der Pruefstand der neuen Analyse (src/renderer/pruefstand-core.ts, #414):
// Karten je Faehigkeit, Takt-Schaetzung, Checkliste, Opener. Gerechnet auf den
// reduzierten Kampfdaten (scripts/fixtures/analyse-kaempfe.json); die
// Erwartungen stammen aus den Proben des Entwurfs (entwurf-E/test-kern.mjs),
// dort wo die Entscheidungen vom 08.11.2026 sie nicht aendern.
//
// Run:  npm run test:pruefstand-core

import { bester, daten, decke, ende, eq, hatVentius, kampf, ladeKern, ok } from "./_analyse-test.mjs";

const p = await ladeKern("pruefstand-core", true);
const vc = await ladeKern("ventius-core");

const deckman = kampf("Ascended Deckman", true), vulcanus = kampf("Vulcanus", true), puppeV = kampf("Practice Dummy", true);
const quente = kampf("Quente, Executor of the Seal", false), pakilo = kampf("Ascended Pakilo Naru", false);
const warrior = kampf("Corrupted Ancient Warrior", false), radeth = kampf("Radeth", false);
const OHNE = daten.kaempfe.filter((k) => !hatVentius(k));
ok(deckman && vulcanus && puppeV && quente && pakilo && warrior && radeth, "die Beispielkaempfe sind da");

// ---- Faehigkeiten
const sv = p.skillsVon(vulcanus);
ok(sv.find((s) => s.name === "Mother Nature's Protest").tick, "Protest bleibt ein Tick");
ok(sv.find((s) => s.ventius), "Vulcanus traegt die Ventius-Faehigkeit");
for (const k of OHNE) ok(!p.skillsVon(k).some((s) => s.ventius || s.name === "Eye of Ventius"), "ohne Salven keine Ventius-Faehigkeit: " + k.hauptziel);
ok(Math.abs(sv.reduce((x, s) => x + s.anteil, 0) - 1) < 1e-9, "die Anteile ergeben 1");
eq(p.hitzeVon(0, 0, 0), 0, "Hitze ohne Treffer");
eq([p.hitzeVon(5, 0, 10), p.hitzeVon(0, 5, 10), p.hitzeVon(5, 5, 10), p.hitzeVon(4, 4, 10)], [2, 1, 3, 0], "Hitze ab der Haelfte der Treffer");

// ---- Takt-Schaetzung
eq(p.abklingSchaetzung([{ t: 0 }, { t: 1 }]), null, "zwei Einsaetze: kein Takt");
eq(p.abklingSchaetzung([{ t: 0 }, { t: 1 }, { t: 2 }, { t: 3 }, { t: 4 }]), null, "Spam hat keinen Takt");
const sechs = [0, 5, 10, 15, 20, 25].map((t) => ({ t }));
eq(p.abklingSchaetzung(sechs), 5, "gleichmaessige 5 s: Takt 5 s");
eq(p.trefferVoll([{ n: 4 }, { n: 4 }, { n: 4 }, { n: 9 }, { n: 2 }]), 4, "ein Ausreisser setzt kein Maximum");
eq(p.trefferVoll([{ n: 1 }, { n: 2 }]), null, "zu wenig Einsaetze: kein Maximum");

// ---- Karten ohne Ventius
const k = p.pruefstand(warrior, bester(warrior), 0, Infinity, decke(warrior));
ok(k.length >= 6, "mindestens sechs Karten", k.length);
const ca = k.find((c) => c.name === "Culling Arc");
ok(ca.cd >= 2 && ca.decke && ca.trefferMax === 4 && ca.trefferFehlen > 0, "Culling Arc: Takt, Decke 4, fehlende Treffer", { cd: ca.cd, decke: ca.decke, max: ca.trefferMax, f: ca.trefferFehlen });
ok(ca.auslastung > 0 && ca.auslastung <= 1 && ca.warte >= 0 && ca.bereit.length >= 1, "Auslastung, Wartezeit, Bereit-Stuecke");
ok(ca.best && ca.best.jeMinute > 0, "der beste Pull hat Einsaetze je Minute");
const sp = p.pruefstand(quente, null).find((c) => c.name === "Spiral Slash");
ok(sp && sp.kanal && !sp.decke && sp.trefferFehlen === 0, "ein Kanal ist kein Tick und hat keine Decke");
ok(p.pruefstand(warrior, null).some((c) => c.name === "Javelin Inferno" && c.kanal), "Javelin Inferno ist ein gedrueckter Kanal");
const dm = p.pruefstand(pakilo, bester(pakilo)).find((c) => c.name === "Detonation Mark");
ok(dm.mehrteilig && !dm.decke && dm.cd && !dm.vergleichbarJe, "mehrteilig: ohne Decke und ohne Vergleich je Einsatz");
ok(!k.some((c) => c.name === "Thunder Spirit" || c.name === "Deadly Viper"), "Ticks tauchen nicht auf");
eq(p.pruefstand(radeth, null).find((c) => c.name === "Slash").cd, null, "wenige Einsaetze: kein Takt");
const teil = p.pruefstand(warrior, bester(warrior), 0, 30);
ok(teil.find((c) => c.name === "Culling Arc").einsaetze < ca.einsaetze, "der Bereich filtert die Einsaetze");
ok(teil.find((c) => c.name === "Culling Arc").best.vergleichbar, "der beste Pull vergleicht, wo er noch lief");
for (const x of OHNE) ok(!p.pruefstand(x, bester(x), 0, Infinity, 5).some((c) => c.ventius), "ohne Ventius keine Ventius-Karte: " + x.hauptziel);

// ---- Karten mit Ventius
const kv = p.pruefstand(vulcanus, bester(vulcanus), 0, Infinity, decke(vulcanus));
const vk = kv.find((c) => c.ventius);
ok(vk && vk.decke && vk.trefferMax === 10, "Ventius-Karte: Treffer gegen die Decke 10", vk && vk.trefferMax);
eq(vk.trefferFehlen, vc.ventiusAuswertung(vulcanus, decke(vulcanus)).gefehlt, "Fehlend kommt aus der Ventius-Auswertung");
eq([vk.cd, vk.warte, vk.moeglich, vk.auslastung], [null, 0, null, null], "an der Ventius-Karte kein Takt, keine Wartezeit, keine Auslastung");
ok(vk.salvenAbstand && vk.salvenAbstand.median > 0 && vk.salvenAbstand.p10 <= vk.salvenAbstand.median, "dafuer Abstand der Salven");
eq(kv.find((c) => c.name === "Blade Storm").trefferMax, 10, "Blade Storm voll bei 10");
// ein Bereich rechnet die Karte neu
const vteil = p.pruefstand(vulcanus, bester(vulcanus), 0, 60, decke(vulcanus)).find((c) => c.ventius);
ok(vteil.einsaetze < vk.einsaetze && vteil.einsaetze === vulcanus.ventius.salven.filter((s) => s[0] < 60).length, "Bereich zaehlt nur seine Salven");

// ---- Checkliste
const mit = p.checkliste(vulcanus, bester(vulcanus), decke(vulcanus)), ohne = p.checkliste(pakilo, bester(pakilo), 0);
ok(mit.some((z) => z.k === "ventDecke") && mit.some((z) => z.k === "ventTreffer"), "Ventius-Zeilen mit Ventius");
ok(!ohne.some((z) => /^vent/.test(z.k)), "keine Ventius-Zeilen ohne Ventius");
for (const z of [...mit, ...ohne]) ok(z.wert >= 0 && z.wert <= 1 && typeof z.satz.key === "string", "Prozent zwischen 0 und 1: " + z.k, z.wert);
ok(ohne.find((z) => z.k === "krit").neutral, "Kritisch ohne Wertung");
ok(ohne.some((z) => z.k === "best") && !p.checkliste(radeth, null, 0).some((z) => z.k === "best"), "bester Pull nur, wo es einen gibt");

// ---- Opener
const o = p.opener(pakilo, bester(pakilo), 15);
ok(o.hier.length > 3 && o.dort && o.dort.length > 3 && o.saetze.length >= 1, "Opener hier und dort");
ok(o.hier.every((e) => e.name !== "Mother Nature's Protest"), "Ticks stehen nicht im Opener");
eq(p.opener(quente, null).saetze[0].key, "analysis.e.op.ohne", "ohne zweiten Pull kein Vergleich");
ok(p.opener(vulcanus, bester(vulcanus)).hier.some((e) => e.sid === "boro:ventius"), "Ventius steht mit eigener ID im Opener");

// ---- jeder Schluessel steht in beiden Sprachen, und jede Funktion laeuft
const S = [];
for (const kk of daten.kaempfe) {
  const b = bester(kk), d = decke(kk);
  for (const z of p.checkliste(kk, b, d)) S.push(z.frage, z.satz, ...(z.vorbehalt ? [z.vorbehalt] : []));
  S.push(...p.opener(kk, b).saetze);
}
for (const s of S) {
  const key = typeof s === "string" ? s : s.key, vars = typeof s === "string" ? {} : s.vars;
  for (const sprache of ["de", "en"]) {
    const e = p.I18N[sprache][key];
    const text = typeof e === "function" ? e(vars) : e;
    ok(typeof text === "string" && text.length > 3 && !/undefined|NaN/.test(text), sprache + " " + key, text);
  }
}

ende();
