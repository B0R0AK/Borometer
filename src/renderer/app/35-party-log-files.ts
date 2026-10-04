import { state } from "./01-state";
import { toast, toastFail } from "./03-helpers";
import { t, tt } from "./08-translation";
import { $, el } from "./18-interface-basics";
import { partyBossFights } from "./19-grouping-and-party-fights";
import { applyPartyLogSnapshot, summarisePartyLog, whenSaved } from "./34-menus-drop-and-tabs";
import { askPick, askText, openModal } from "./36-dialog";
import { SERVED } from "./41-server-mode";
import type { FolderListing, PartyView } from "../types";

/* Einmal geschrieben, von zwei Stellen gerufen: dem Eintrag im Logs-Menue
   oben und - solange es ihn gibt - dem Knopf im Gruppen-Reiter. */
export async function ladeGruppenLog(){
  if(!SERVED){ $("#partyLogInput").click(); return; }
  let listing: FolderListing;
  try{ listing = await (await fetch("/api/party-log/list")).json(); }
  catch(err){ toastFail(tt("party.helperNoAnswer")); return; }
  const files = listing.files || [];
  if(!files.length){
    await openModal({title:t("party.loadLogBtn"), msg:t("party.noneSaved",{folder:listing.folder}),
                     folder:"party"});
    return;
  }
  const pick = await askPick(t("party.loadLogBtn"), t("party.pickOne",{folder:listing.folder}),
    files.map(f => ({label:f.name, note:whenSaved(f.mtime), value:f.name})), "party");
  if(!pick) return;
  fetch("/api/party-log/load?name="+encodeURIComponent(pick))
    .then(r => r.json())
    .then(applyPartyLogSnapshot)
    .catch(() => toastFail(tt("party.notLogFile")));
}
export function download(blob: Blob, name: string){
  const a = el("a"); a.href = URL.createObjectURL(blob); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// what this part did at the top level, run where it stands in the order
export function setup(): void {
  /* ---------- party log save/load — same served-vs-not pattern as runs ---------- */
  $("#btnSavePartyLog").onclick = async () => {
    const p: Partial<PartyView> = state.party || {};
    // A loaded snapshot has no role - it is not a live connection - but it
    // does have a full board on screen and the head offers the save button
    // for it, so the role test alone refused what the interface promised.
    /* Gespeichert wird, was die Gruppe an Bossen gemeldet hat - alle Kaempfe
       des geladenen Logs, nicht der Augenblick. Gibt es die nicht, bleibt der
       alte Weg: das Board, wie es gerade dasteht. */
    const kaempfe = partyBossFights();
    if(!kaempfe.length && (!(p.role || p.frozen) || !(p.board||[]).length)){
      toastFail(tt("party.nothingToSave")); return;
    }
    const data = summarisePartyLog();
    if(!SERVED){
      download(new Blob([JSON.stringify(data, null, 1)], {type:"application/json"}),
        "party-"+(p.code||"log")+".json");
      return;
    }
    const stamp = new Date();
    const pad = (n: number) => String(n).padStart(2,"0");
    const suggested = "party "+(p.code||"")+" "+stamp.getFullYear()+"-"+pad(stamp.getMonth()+1)+"-"+pad(stamp.getDate());
    const name = await askText(t("party.saveLogBtn"), t("party.nameThisLog"), suggested);
    if(name === null || !name.trim()) return;
    fetch("/api/party-log/save", {method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({name:name.trim(), data})})
      .then(r => r.json())
      .then(d => {
        if(d.ok) toast(tt("party.logSavedTo",{name:d.name, folder:d.folder}), 6000);
        else toast(d.error || tt("party.logSaveFailed"));
      })
      .catch(() => toastFail(tt("party.helperNoAnswer")));
  };
  $("#partyLogInput").onchange = e => {
    const f = (e.target as HTMLInputElement).files![0]; if(!f) return;
    f.text().then(txt => applyPartyLogSnapshot(JSON.parse(txt)))
      .catch(() => toastFail(tt("party.notLogFile")));
  };
}
