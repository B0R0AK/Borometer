import { t } from "./08-translation";
import { esc } from "./18-interface-basics";
import { switchTab } from "./34-menus-drop-and-tabs";
import { SERVED } from "./41-server-mode";
import { charakterAnlegen, charakterHaken, charakterLogSetzen, charakterMainSetzen, charakterNichtIgnorieren, weekliesCharakterListe, weekliesIgnoriert, weekliesLage, type CharaktereZeile } from "./59-weeklies";

/* ---------- Charaktere in den Einstellungen (Spezifikation Twinks 8) ----------
   Eine Liste: die aktiven Charaktere der Weeklies, hier mit Logname und Main.
   Die Namen bleiben auf diesem Computer (nur boro-weeklies.json, nie in
   Export, Fehlerbericht, Gruppe oder Gilde). Gespeichert wird ueber
   59-weeklies.ts; dieser Teil zeichnet und gibt Handlungen weiter. Loesen und
   Zurueckholen bleiben in den Weeklies, dort liegt deren Rueckgaengig. Dieser
   Teil fragt nichts selbst an (Audit). */

/* Der Wechsel des Mains mit Rueckgaengig: der vorige Main (oder keiner), nur in der Sitzung. */
let rueck: {war: string | null} | null = null;
let satz = "";

const ring = (name: string, main: boolean) => '<span class="charring' + (main ? " main" : "") + '" aria-hidden="true"><b>' +
  esc([...name][0]?.toUpperCase() ?? "?") + "</b></span>";

function zeile(c: CharaktereZeile): string {
  const id = "chLog-" + c.id;
  return '<li class="charzeile' + (c.main ? " main" : "") + '" data-id="' + esc(c.id) + '">' + ring(c.name, c.main) +
    '<div class="charname"><b>' + esc(c.name) + "</b>" + (c.main ? ' <span class="charmain">' + esc(t("ch.main")) + "</span>" : "") + "</div>" +
    '<div class="charlog"><label for="' + esc(id) + '">' + esc(t("ch.logName")) + '</label><input type="text" id="' + esc(id) + '" class="chlog" data-id="' + esc(c.id) +
    '" maxlength="24" autocomplete="off" spellcheck="false" value="' + esc(c.log) + '" aria-describedby="chLogHinweis"></div>' +
    '<label class="charwahl"><input type="radio" name="chMain" value="' + esc(c.id) + '"' + (c.main ? " checked" : "") +
    ' aria-label="' + esc(t("ch.mainWahl", {name: c.name})) + '"><span aria-hidden="true">' + esc(t("ch.main")) + "</span></label></li>";
}

function inhalt(): string {
  const lage = weekliesLage();
  if(!SERVED || lage === "nurApp") return '<p class="chleer">' + esc(t("ch.nurApp")) + "</p>";
  if(lage === "laden") return '<p class="chleer">' + esc(t("weeklies.laden")) + "</p>";
  const liste = weekliesCharakterListe();
  if(!liste) return '<p class="chleer">' + esc(t("ch.gesperrt")) + "</p>";
  return '<p class="chhinweis" id="chLogHinweis">' + esc(t("ch.logHinweis")) + " " + esc(t("ch.nachlesen")) + "</p>" +
    (liste.length ? '<ul class="charliste" role="list">' + liste.map(zeile).join("") + "</ul>" : '<p class="chleer">' + esc(t("ch.leer")) + "</p>") +
    (rueck ? '<p class="chrueck"><button type="button" class="btn sm" id="chRueck">' + esc(t("ch.rueckgaengig")) + "</button></p>" : "") +
    '<form id="chNeu" class="chneu" novalidate><h4>' + esc(t("ch.neu")) + "</h4>" +
    '<label for="chNeuName">' + esc(t("ch.neuName")) + '</label><input type="text" id="chNeuName" maxlength="24" autocomplete="off" spellcheck="false">' +
    '<label for="chNeuLog">' + esc(t("ch.neuLog")) + '</label><input type="text" id="chNeuLog" maxlength="24" autocomplete="off" spellcheck="false">' +
    '<button type="submit" class="btn sm" id="chNeuKnopf">' + esc(t("ch.neuKnopf")) + "</button></form>" +
    '<p class="chhinweis">' + esc(t("ch.loesen")) + ' <button type="button" class="btn sm" id="chWeeklies">' + esc(t("ch.weeklies")) + "</button></p>" + ignoriert();
}

/* Die ignorierten Namen (Spezifikation Twinks 6): "Ignorieren" im Hinweis der Rekorde merkt einen Namen,
   hier wird er geloest ("Nicht mehr ignorieren"); er bleibt in der Datei, ein neues Ignorieren holt ihn zurueck. */
function ignoriert(): string {
  const liste = weekliesIgnoriert();
  if(!liste || !liste.length) return "";
  return '<h4 id="chIgnT">' + esc(t("ch.ign")) + '</h4><p class="chhinweis">' + esc(t("ch.ignSatz")) + '</p><ul class="chign" role="list" aria-labelledby="chIgnT">' +
    liste.map((n, i) => '<li><span>' + esc(n) + '</span><button type="button" class="btn sm leise" id="chIgn-' + i + '" data-ign="' + esc(n) + '" aria-label="' +
      esc(t("ch.ignLosVh", {name: n})) + '">' + esc(t("ch.ignLos")) + "</button></li>").join("") + "</ul>";
}
function nichtMehrIgnorieren(name: string){
  charakterNichtIgnorieren(name);
  sagen(t("ch.ignLosOk", {name}));
  renderCharaktere();
  // der Knopf ist weg: der Fokus geht auf den naechsten der Liste, sonst auf den Weg in die Weeklies
  (document.querySelector<HTMLElement>("#chInhalt [data-ign]") ?? document.getElementById("chWeeklies"))?.focus();
}

/** Den Abschnitt zeichnen: aus renderEinst (57, auch nach dem Sprachwechsel) und nach jeder Aenderung der Weeklies (charakterHaken). */
export function renderCharaktere(): void {
  const box = document.getElementById("chInhalt");
  if(!box) return;
  const h = inhalt();
  if(box.dataset.marke !== h){
    // was in den Feldern zum Hinzufuegen und im Feld mit dem Fokus steht, bleibt stehen
    const werte = new Map<string, string>();
    box.querySelectorAll<HTMLInputElement>("#chNeuName,#chNeuLog").forEach(x => werte.set(x.id, x.value));
    const aktiv = document.activeElement instanceof HTMLElement && box.contains(document.activeElement) ? document.activeElement : null;
    if(aktiv instanceof HTMLInputElement && aktiv.type === "text") werte.set(aktiv.id, aktiv.value);
    box.innerHTML = h; box.dataset.marke = h;
    werte.forEach((v, id) => { const x = box.querySelector<HTMLInputElement>("#" + CSS.escape(id)); if(x) x.value = v; });
    if(aktiv?.id) box.querySelector<HTMLElement>("#" + CSS.escape(aktiv.id))?.focus();
  }
  const s = document.getElementById("chSatz");
  if(s && s.textContent !== satz) s.textContent = satz;
}

function sagen(text: string){ satz = text; const s = document.getElementById("chSatz"); if(s) s.textContent = text; }
const nameVon = (id: string) => weekliesCharakterListe()?.find(c => c.id === id)?.name ?? "";

function logAendern(inp: HTMLInputElement){
  const id = inp.dataset.id ?? "";
  const r = charakterLogSetzen(id, inp.value);
  /* angesagt wird, was gespeichert ist: der Logname so bereinigt wie in 59 (ohne Steuer- und Formatzeichen,
     getrimmt) - ein Feld nur aus solchen Zeichen nimmt den Lognamen weg */
  const gespeichert = weekliesCharakterListe()?.find(c => c.id === id)?.log ?? "";
  if(r === "ok") sagen(t(gespeichert ? "ch.logAngesagt" : "ch.logWeg", {name: nameVon(id)}));
  else if(r === "doppelt") sagen(t("ch.doppelt"));
  else if(r === "leer") sagen(t("ch.logBad"));
}

function mainWaehlen(id: string){
  const alt = weekliesCharakterListe()?.find(c => c.main)?.id ?? null;
  if(alt === id) return;
  charakterMainSetzen(id);
  rueck = {war: alt};
  sagen(t("ch.mainJetzt", {name: nameVon(id)}));
  renderCharaktere();
  // der Fokus bleibt im Abschnitt: auf dem Rueckgaengig, das eben erschienen ist
  document.querySelector<HTMLElement>("#chRueck")?.focus();
}

function mainZurueck(){
  if(!rueck) return;
  const war = rueck.war;
  rueck = null;
  charakterMainSetzen(war);
  sagen(war ? t("ch.mainJetzt", {name: nameVon(war)}) : t("ch.mainWeg"));
  renderCharaktere();
  // das Rueckgaengig ist weg: der Fokus geht auf die Wahl des Mains (die gewaehlte, sonst die erste)
  const box = document.getElementById("chInhalt");
  (box?.querySelector<HTMLElement>('input[name="chMain"]:checked') ?? box?.querySelector<HTMLElement>('input[name="chMain"]'))?.focus();
}

function neuAnlegen(){
  const n = document.getElementById("chNeuName") as HTMLInputElement | null, l = document.getElementById("chNeuLog") as HTMLInputElement | null;
  if(!n || !l) return;
  const name = n.value.trim();
  const r = charakterAnlegen(n.value, l.value);
  if(r === "ok"){
    // das Anlegen hat neu gezeichnet und dabei die Felder uebernommen: jetzt die neuen leeren
    const nn = document.getElementById("chNeuName") as HTMLInputElement | null, nl = document.getElementById("chNeuLog") as HTMLInputElement | null;
    if(nn) nn.value = "";
    if(nl) nl.value = "";
    sagen(t("ch.neuAngesagt", {name}));
    nn?.focus();
  }
  else if(r !== "nichts") sagen(t(r === "name" ? "ch.nameBad" : r === "log" ? "ch.logBad" : r === "doppelt" ? "ch.doppelt" : r === "sechs" ? "ch.sechs" : "ch.alleVoll"));
}

// what this part did at the top level, run where it stands in the order
export function setup(): void {
  const box = document.getElementById("chInhalt");
  if(!box) return;
  box.addEventListener("change", e => {
    const x = e.target as HTMLInputElement;
    if(x.matches('input[name="chMain"]')) mainWaehlen(x.value);
    else if(x.classList.contains("chlog")) logAendern(x);
  });
  box.addEventListener("click", e => {
    const b = (e.target as Element).closest<HTMLElement>("button");
    if(!b) return;
    if(b.id === "chWeeklies") switchTab("weeklies");
    else if(b.id === "chRueck") mainZurueck();
    else if(b.dataset.ign !== undefined) nichtMehrIgnorieren(b.dataset.ign);
  });
  box.addEventListener("submit", e => { e.preventDefault(); neuAnlegen(); });
  charakterHaken.geaendert = renderCharaktere;
  renderCharaktere();
}
