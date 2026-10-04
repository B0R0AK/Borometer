/* ============================================================
   i18n — language layer. Internal data (weapon keys, hit
   categories, skill/target/player names from the log) always
   stays in English/whatever the log used; only display text
   is translated here.
   ============================================================ */

import { state } from "./01-state";
import { I18N } from "./07-dictionary";
import type { I18nVars } from "../types";

export function t(key: string, vars?: I18nVars): string {
  const entry = (I18N[state.lang] && I18N[state.lang][key] !== undefined) ? I18N[state.lang][key] : I18N.en[key];
  if(entry === undefined) return key;
  if(typeof entry === "function") return entry(vars||{});
  if(vars) return entry.replace(/\{(\w+)\}/g, (_,k) => vars[k] !== undefined ? String(vars[k]) : "");
  return entry;
}

/* Eine Uebersetzung auf Abruf. toast() bekam bisher den fertigen Satz, und
   nach einem Sprachwechsel stand die Meldung unten weiter in der alten
   Sprache ("2 Kaempfe aus dem Beispiel gelesen." ueber einer englischen
   Seite). tt() haelt Schluessel und Werte fest und uebersetzt erst, wenn der
   Satz gezeichnet wird - beim Zeigen und noch einmal beim Sprachwechsel.
   Die Werte werden JETZT ausgewertet, nicht spaeter: "{n} Kaempfe" soll die
   Zahl von damals nennen, nicht die von nach dem naechsten Laden. Ein Wert,
   der selbst ein tt() ist ("aus dem Beispiel"), wird mit uebersetzt. */
export type Lazy = () => string;
export function tt(key: string, vars?: I18nVars): Lazy {
  return () => {
    if(!vars) return t(key);
    const v: I18nVars = {};
    for(const k in vars) v[k] = typeof vars[k] === "function" ? vars[k]() : vars[k];
    return t(key, v);
  };
}

// what this part did at the top level, run where it stands in the order
export function setup(): void {
  state.lang = (function(){
    try{ const v = localStorage.getItem("boroLang"); if(v==="de"||v==="en") return v; }catch(err){}
    return /^de/i.test(navigator.language||"") ? "de" : "en";
  })();
}
