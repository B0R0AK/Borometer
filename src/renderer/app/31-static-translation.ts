import { state } from "./01-state";
import { t } from "./08-translation";
import { markiereRest } from "./16-fight-analysis";
import { $ } from "./18-interface-basics";
import { renderAll } from "./32-history";
import { syncPanelHeadings } from "./34-menus-drop-and-tabs";
import { retranslateToast } from "./03-helpers";
import { setPinButton, syncGhostButton, syncThroughTexts, syncZoomRow } from "./37-window-size-and-overlay";
import { serverStatusNachfuehren, syncPartyPill } from "./42-party";
import { renderChangelog } from "./43-more-menu-and-dev-mode";
import { syncLiveBtn } from "./45-startup";
import { einstNachfuehren } from "./57-einstellungen";

/* ---------- static markup translation ---------- */
export function applyStaticI18n(){
  document.documentElement.lang = state.lang;
  /* Zuletzt im Aufruf, nicht hier: syncPanelHeadings liest die Beschriftung
     der Reiterknoepfe ab, und die setzt diese Funktion erst weiter unten. */
  document.querySelectorAll<HTMLElement>("[data-i18n]").forEach(el => { el.textContent = t(el.dataset.i18n!); });
  document.querySelectorAll<HTMLElement>("[data-i18n-html]").forEach(el => { el.innerHTML = t(el.dataset.i18nHtml!); });
  document.querySelectorAll<HTMLInputElement>("[data-i18n-ph]").forEach(el => { el.placeholder = t(el.dataset.i18nPh!); });
  document.querySelectorAll<HTMLElement>("[data-i18n-title]").forEach(el => { el.title = t(el.dataset.i18nTitle!); });
  // for anything whose only name is an aria-label - among them the window
  // buttons, the size pair, both chart zoom pairs, the chart time range,
  // whose "From" and "to" are loose words in the strip rather than real
  // labels, and the two canvases, which are role="img" and carry no text
  document.querySelectorAll<HTMLElement>("[data-i18n-aria-label]").forEach(el => { el.setAttribute("aria-label", t(el.dataset.i18nAriaLabel!)); });
  /* Der Umschalter "Live": Zustandswort, title und der Satz der
     Live-Region. Der Satz stand hier vorher als "laeuft"/"aus" neu - und
     verlor dabei den Dateinamen, bis die naechste Abfrage ihn zurueckbrachte. */
  syncLiveBtn();
  /* Anheften und Geist tragen ihren title nicht mehr als data-i18n-title:
     der hing am Aus-Zustand und stand nach jedem Sprachwechsel falsch,
     solange einer von beiden an war. */
  setPinButton($("#btnPin").getAttribute("aria-pressed") === "true");
  syncGhostButton();
  $("#btnCompact").textContent = document.body.classList.contains("compact") ? t("top.fullView") : t("top.compact");
  markiereRest();
  const langBtn = $("#btnLang");
  if(langBtn){ langBtn.textContent = t("top.langLabel",{code:state.lang === "de" ? "EN" : "DE"}); langBtn.title = t("top.langToggleTitle"); }
  // the size row's label carries data-i18n, but its two tooltips are set from
  // code and have to be re-stated by hand when the language changes
  syncZoomRow();
  syncThroughTexts();
  // Same reason for the party server status in the settings: it is written
  // at the moment of each check, so after a language switch it kept the old
  // wording. serverStatusNachfuehren() re-states the last result, it does not ask again.
  serverStatusNachfuehren();
  syncPanelHeadings();
}
export function setLang(l: string){
  if(l !== "de" && l !== "en") return;
  state.lang = l;
  try{ localStorage.setItem("boroLang", l); }catch(err){}
  applyStaticI18n();
  renderAll();
  syncPartyPill();
  if($("#clogBg").classList.contains("on")) renderChangelog();
  // die Meldung unten, falls sie noch steht - sie blieb sonst in der alten Sprache
  retranslateToast();
  // das Segment der Einstellungen zeigt die neue Sprache
  einstNachfuehren();
}
