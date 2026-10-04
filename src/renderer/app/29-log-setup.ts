import { ROLES, state } from "./01-state";
import { factLine } from "./03-helpers";
import { buildEvents } from "./04-log-parsing";
import { segment } from "./05-fights";
import { t } from "./08-translation";
import { headerLabel, roleLabel } from "./14-questlog-weapons";
import { $, esc } from "./18-interface-basics";
import { refreshPlayers, renderAll } from "./32-history";
import type { ColumnRole } from "../types";

/* ---------- setup ---------- */
export function renderSetup(){
  const g = state.parsed; if(!g) return;
  const cols = state._cols || [];
  const rev: Record<number, ColumnRole> = {};
  for(const r in state.mapping) rev[state.mapping[r as ColumnRole]!] = r as ColumnRole;

  // Three measurements of the file, ruled apart the same way the readout's
  // meta line rules its own — one device for "a run of facts", wherever it
  // appears. The instruction that used to ride on the end of this chain now
  // sits in its own sentence under it.
  const verParts = [];
  if(state.logVersion) verParts.push(t("setup.verVersion", {ver: state.logVersion}));
  verParts.push(t("setup.verRows", {rows: g.rows.length.toLocaleString(state.lang==="de"?"de-DE":"en-US")}));
  verParts.push(t("setup.verCols", {cols: g.headers.length}));
  $("#verNote").innerHTML = factLine(verParts);
  $("#needDamage").hidden = state.mapping && state.mapping.damage != null;
  $("#needTime").hidden = state.mapping && state.mapping.time != null;
  $("#needSkill").hidden = state.mapping && state.mapping.skill != null;

  $("#mapRows").innerHTML = cols.map(c => {
    // a synthetic name is the position restated; the index column already says
    // it, so the row keeps the space for the values instead
    const named = c.name.charCodeAt(0) !== 0;
    const label = headerLabel(c.name);
    const vals = (c.samples && c.samples.length) ? c.samples : ["—"];
    return '<div class="maprow">'+
      '<div class="ix">'+(c.i + 1)+"</div>"+
      "<div>"+
        (named ? '<div class="hname">'+esc(label)+"</div>" : "")+
        '<div class="sample factline">'+factLine(vals)+"</div>"+
      "</div>"+
      // the only name this control had was the word next to it, which is gone
      // on a log that does not name its columns
      '<select data-col="'+c.i+'" aria-label="'+esc(label)+'">' + ROLES.map(r =>
        '<option value="'+r+'"'+((rev[c.i]||"ignore")===r?" selected":"")+">"+esc(roleLabel(r))+"</option>").join("") +
      "</select></div>";
  }).join("");
  $("#mapRows").querySelectorAll("select").forEach(sel => sel.onchange = () => {
    const col = +sel.dataset.col!, role = sel.value as ColumnRole | "ignore";
    for(const r in state.mapping) if(state.mapping[r as ColumnRole] === col) delete state.mapping[r as ColumnRole];
    if(role !== "ignore"){ delete state.mapping[role]; state.mapping[role] = col; }
    buildEvents(); refreshPlayers(); segment(); renderAll();
  });

  const many = state.eventTypes && state.eventTypes.length > 1;
  $("#evtCard").hidden = !many;
  if(many){
    $("#evtRows").innerHTML = state.eventTypes!.map(t =>
      '<label style="display:inline-flex;align-items:center;gap:6px;margin:0 15px 7px 0"><input type="checkbox" data-evt="'+
      esc(t)+'"'+(state.excludedEvents.has(t)?"":" checked")+">"+esc(t)+"</label>").join("");
    $("#evtRows").querySelectorAll("input").forEach(b => b.onchange = () => {
      if(b.checked) state.excludedEvents.delete(b.dataset.evt!); else state.excludedEvents.add(b.dataset.evt!);
      segment(); renderAll();
    });
  }

  // A synthetic header is its own position, which the mapping row above
  // numbers in its index column, so "Spalte 1 Zeit" said the same thing
  // twice. A log that names its columns keeps its name and gains the role.
  $("#preview").innerHTML = "<table><thead><tr>" +
    g.headers.map((hd,i) => {
      const role = rev[i] ? '<span class="prole">'+esc(roleLabel(rev[i]))+"</span>" : "";
      const named = !/^\u0000\d+$/.test(hd);
      return "<th>"+(named ? esc(headerLabel(hd))+(role?" "+role:"")
                            : (role || esc(headerLabel(hd))))+"</th>";
    }).join("") +
    "</tr></thead><tbody>" + g.rows.slice(0,8).map(r =>
      "<tr>"+r.map(c => "<td>"+esc(c)+"</td>").join("")+"</tr>").join("") + "</tbody></table>";
}
