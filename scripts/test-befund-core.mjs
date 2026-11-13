// Borometer - a damage meter for Throne and Liberty
// Copyright (C) 2026 B0R0AK
// SPDX-License-Identifier: GPL-3.0-or-later
//
// Der Kopf-Befund der neuen Analyse (src/renderer/befund-core.ts, #414): die
// auffaelligste Beobachtung, regelbasiert und bei jeder Waffe; Ventius nur als
// groesster Posten, wo der Kampf Salven hat. Gerechnet auf den reduzierten
// Kampfdaten; die Rangfolge stammt aus den Proben des Entwurfs.
//
// Run:  npm run test:befund-core

import { bester, daten, decke, ende, eq, hatVentius, kampf, ladeKern, ok } from "./_analyse-test.mjs";

const b = await ladeKern("befund-core", true);
const p = await ladeKern("pruefstand-core");

const deckman = kampf("Ascended Deckman", true), vulcanus = kampf("Vulcanus", true), puppeV = kampf("Practice Dummy", true);
const quente = kampf("Quente, Executor of the Seal", false), pakilo = kampf("Ascended Pakilo Naru", false), puppeO = kampf("Practice Dummy", false);
const warrior = kampf("Corrupted Ancient Warrior", false), radeth = kampf("Radeth", false);

eq(b.BEFUND_SCHWELLE, 0.02, "die Schwelle ist 2 % des Kampfschadens");

// ---- die Schlagzeile je Kampf
const hd = b.kopfBefund(deckman, bester(deckman), decke(deckman));
eq([hd.art, hd.kand.art], ["kosten", "ventius"], "Deckman: die fehlenden Ventius-Treffer sind der groesste gemessene Posten");
const hv = b.kopfBefund(vulcanus, bester(vulcanus), decke(vulcanus));
eq(hv.kand.art, "ventius", "Vulcanus: Ventius");
const kandV = b.befundKandidaten(vulcanus, bester(vulcanus), decke(vulcanus));
ok(kandV.some((x) => x.weich), "es gibt einen weichen Kandidaten");
ok(kandV.find((x) => !x.weich).art === hv.kand.art && !hv.kand.weich, "den weichen traegt die Schlagzeile nicht, wo Gemessenes da ist");
const hp = b.kopfBefund(puppeV, bester(puppeV), decke(puppeV));
eq([hp.art, hp.vor.key], ["quelle", "analysis.e.kopf.vor.quelle"], "Puppe mit Ventius, alles an der Decke: Getragen von");
eq(b.kopfBefund(warrior, bester(warrior), decke(warrior)).kand.art, "leerlauf", "Dungeon-Gegner: Leerlauf");
eq(b.kopfBefund(radeth, null, decke(radeth)).kand.art, "leerlauf", "Radeth: Leerlauf");
eq(b.kopfBefund(quente, null, decke(quente)).kand.art, "leerlauf", "Quente: Leerlauf");
const hn = b.kopfBefund(pakilo, bester(pakilo), decke(pakilo));
ok(hn.art === "abstand" && hn.fenster && hn.fenster.bis - hn.fenster.von === 10, "Pakilo Naru: Abstand zum besten Pull mit dem 10-s-Fenster");
eq(b.kopfBefund(puppeO, null, 0).art, "quelle", "Puppe ohne Ventius: Getragen von");

// ---- Ventius nur, wo es Salven gibt
for (const k of daten.kaempfe.filter((x) => !hatVentius(x))) {
  const h = b.kopfBefund(k, bester(k), 5);
  ok(!JSON.stringify(h).includes("ventius") && !JSON.stringify(h).includes("Ventius"), "ohne Ventius kein Ventius im Kopf: " + k.hauptziel);
  ok(!b.befundKandidaten(k, bester(k), 5).some((x) => x.art === "ventius"), "ohne Ventius kein Ventius-Kandidat: " + k.hauptziel);
}

// ---- Kandidaten von der Seite (Inventur O1): Fenster nach einem Skill, schwaechste Stelle, Fehlschlaege rechnet die Seite (53, 16);
// der Kern nimmt sie, in Schaden gerechnet, wie die eigenen Kandidaten
const von = (art, anteil) => ({ art, wert: radeth.schaden * anteil, text: { key: "t." + art, vars: {} }, note: { key: "n." + art, vars: {} } });
const hf = b.kopfBefund(radeth, null, decke(radeth), [von("fenster", 5), von("stelle", 0.001)]);
ok(hf.art === "kosten" && hf.kand.art === "fenster" && hf.text.key === "t.fenster" && hf.note.key === "n.fenster" && hf.skill === null,
  "ein grosser Kandidat der Seite traegt die Schlagzeile, mit seinen Saetzen");
ok(b.befundKandidaten(radeth, null, decke(radeth), [von("fehl", 0.5)]).some((x) => x.art === "fehl"), "der Kandidat der Seite steht in der Liste");
const hk = b.kopfBefund(radeth, null, decke(radeth), [von("stelle", 0.0001)]);
ok(hk.kand?.art !== "stelle", "ein Kandidat der Seite unter der Schwelle traegt die Schlagzeile nicht");
eq(JSON.stringify(b.kopfBefund(radeth, null, decke(radeth))), JSON.stringify(b.kopfBefund(radeth, null, decke(radeth), [])), "ohne Kandidaten der Seite aendert sich nichts");

// ---- die Schwelle gilt: ein Posten unter 2 % traegt nie "Das kostet dich am meisten"
const klein = { ...radeth, schaden: radeth.schaden * 100 };
ok(b.kopfBefund(klein, null, 0).art !== "kosten", "ein kleiner Posten traegt die Schlagzeile nicht");

// ---- weitere Posten: hoechstens zwei, keiner doppelt, kein weicher neben einem gemessenen
for (const k of daten.kaempfe) {
  const h = b.kopfBefund(k, bester(k), decke(k));
  ok(h.weitere.length <= 2, "hoechstens zwei weitere: " + k.hauptziel, h.weitere.length);
  if (h.art === "kosten" && h.kand && !h.kand.weich) ok(h.weitere.every((x) => !x.weich && x !== h.kand), "weitere sind gemessen und neu: " + k.hauptziel);
}

// ---- Kennzahlen sind allgemein
for (const k of daten.kaempfe) {
  const z = p.kennzahlen(k, bester(k));
  eq(Object.keys(z).sort(), ["best", "dauerS", "dps", "einsaetze", "jeMinute", "krit", "leerlauf", "luecken", "schaden", "treffer", "waffen"], "Kennzahlen ohne Ventius-Feld: " + k.hauptziel);
  ok(z.jeMinute > 0 && z.krit >= 0 && z.krit <= 1, "Kennzahlen plausibel: " + k.hauptziel);
}
ok(p.kennzahlen(vulcanus, bester(vulcanus)).best.besser, "Vulcanus: der beste Pull ist besser");
eq(p.kennzahlen(quente, null).best, null, "ohne zweiten Pull kein Vergleich");

// ---- jeder Satz laeuft in beiden Sprachen, mit Zahl und ohne Warum
const WARUM = /\b(weil|deshalb|deswegen|because|therefore)\b|Position/i;
for (const k of daten.kaempfe) {
  const h = b.kopfBefund(k, bester(k), decke(k));
  const sae = [h.vor, h.text, h.note, ...(h.noteKand ? [h.noteKand] : []), ...h.weitere.flatMap((x) => [x.text, x.note])];
  for (const s of sae) for (const sprache of ["de", "en"]) {
    const e = b.I18N[sprache][s.key];
    const text = typeof e === "function" ? e(s.vars) : e;
    ok(typeof e !== "undefined" && typeof text === "string" && !/undefined|NaN|\[object/.test(text), sprache + " " + s.key + " (" + k.hauptziel + ")", text);
    ok(!WARUM.test(text), "kein Warum: " + s.key, text);
  }
  const kopf = (typeof b.I18N.de[h.text.key] === "function" ? b.I18N.de[h.text.key](h.text.vars) : b.I18N.de[h.text.key]);
  ok(/\d/.test(kopf), "Zahl in der Schlagzeile: " + k.hauptziel, kopf);
}

ende();
