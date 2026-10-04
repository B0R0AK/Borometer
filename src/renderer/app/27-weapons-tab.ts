import { state } from "./01-state";
import { factLine, fmt, toast, toastFail } from "./03-helpers";
import { t, tt } from "./08-translation";
import { weaponLabel, weaponMark } from "./09-weapon-icons";
import { skillMark } from "./11-skill-icons";
import { NO_SKILL, skillLabel, WEAPON_ALIAS_DE } from "./14-questlog-weapons";
import { EQUIPPABLE, WEAPONS } from "./15-weapons-and-ventius";
import { byWeapon, numN, pctOf, setWeapon, skillIds, weaponFor } from "./16-fight-analysis";
import { className, classNameFor, iPlayVentius, roleWithVentius } from "./17-class-names";
import { $, esc } from "./18-interface-basics";
import { renderBars } from "./21-damage-table";
import { askConfirm } from "./36-dialog";
import { KOMPAKT_FENSTER, SERVED } from "./41-server-mode";
import { AUTO_OFF_MIN, clearWeaponByHand, fightKey, setWeaponByHand } from "./42-party";
import type { Fight, SkillStats } from "../types";

/* ---------- weapons ---------- */
const WEAPON_ALIAS: Record<string, string> = {
  bow:"Longbow", longbow:"Longbow", lb:"Longbow",
  xbow:"Crossbow", crossbow:"Crossbow", cb:"Crossbow",
  gs:"Greatsword", greatsword:"Greatsword", great:"Greatsword",
  sns:"Sword and Shield", "sword and shield":"Sword and Shield", shield:"Sword and Shield", sword:"Sword and Shield",
  dagger:"Dagger", daggers:"Dagger", dg:"Dagger",
  staff:"Staff", stave:"Staff",
  wand:"Wand and Tome", "wand and tome":"Wand and Tome", tome:"Wand and Tome",
  spear:"Spear", polearm:"Spear",
  gauntlet:"Gauntlet", gauntlets:"Gauntlet", fist:"Gauntlet", fists:"Gauntlet",
  orb:"Orb",
  passive:"Passive", proc:"Passive", buff:"Passive", set:"Passive", collection:"Passive", trait:"Passive",
  none:"Unassigned", unassigned:"Unassigned", "-":"Unassigned"
};
function normWeapon(s: unknown){
  const k = String(s||"").trim().toLowerCase();
  if(WEAPON_ALIAS[k]) return WEAPON_ALIAS[k];
  if(WEAPON_ALIAS_DE[k]) return WEAPON_ALIAS_DE[k];
  return WEAPONS.find(w => w.toLowerCase() === k) || null;
}
/* Das Kompaktfenster (Nachtraege N4, Pruefung W3) ist eine zweite Seite mit
   eigenem Stand: schriebe es ganze Karten zurueck (runs, logIndex,
   ventiusTop, skillNames, Thema), gewaenne der letzte Schreiber, und was die
   Vollansicht inzwischen gemerkt hat, waere weg. Es schreibt darum nichts
   Gespeichertes - ausser randlosGesehen, damit "Verstanden" haelt. */
const KOMPAKT_DARF_MERKEN = ["randlosGesehen"];
export function persistConfig(){
  if(!SERVED || KOMPAKT_FENSTER) return;
  fetch("/api/config", {method:"POST", headers:{"Content-Type":"application/json"},
    body: JSON.stringify({weaponOf:state.weaponOf, weaponById:state.weaponById,
                          mainWeapon:state.mainWeapon||"", offWeapon:state.offWeapon||"",
                          weaponPick:state.weaponPick,
                          runs:state.runs})}).catch(() => {});
}
/* A preference on its own, kept apart from the weapon and run payload above so
   that saving where your fights get cut never rewrites your saved runs. */
export function persistPref(key: string, value: unknown){
  if(!SERVED || (KOMPAKT_FENSTER && !KOMPAKT_DARF_MERKEN.includes(key))) return;
  const body: Record<string, unknown> = {}; body[key] = value;
  fetch("/api/config", {method:"POST", headers:{"Content-Type":"application/json"},
    body: JSON.stringify(body)}).catch(() => {});
}
function afterAssign(){
  persistConfig();
  renderWeapons();
  if(state.group === "weapon") renderBars();
}

function renderAssignFold(offen: number, gesamt: number, anteil: number, seg: Fight){
  const d = $<HTMLDetailsElement>("#assignFold"); if(!d) return;
  const k = fightKey(seg);
  if(state.assignFight !== k){ state.assignFight = k; d.open = offen > 0; }
  const sum = $("#assignSum");
  sum.innerHTML = "<b>" + esc(String(offen || gesamt)) + "</b>" +
    esc(offen
        ? t("weapons.foldOpen", {n: offen, total: gesamt, pct: pctOf(anteil, 1)})
        : t("weapons.foldDone", {n: gesamt}));
  d.querySelector("summary")!.classList.toggle("warn", offen > 0);
  const act = $("#assignAct");
  const wort = () => { act.textContent = t(d.open ? "weapons.foldClose" : "weapons.foldChange"); };
  wort();
  d.ontoggle = wort;
}

/* Was in den beiden Feldern steht und woher es kommt.

   Die Anteile kommen aus derselben Rechnung wie die Tabelle darunter, siehe
   weaponShares(). Die Zeile verschwindet nicht mehr, wenn ein Kampf nichts
   hergibt: der Handmodus ist klebrig und je Charakter gespeichert, und mit
   der Zeile verschwand auch der einzige Knopf, der ihn wieder aufhebt. */
function renderWeaponSource(list: ReturnType<typeof byWeapon>){
  const box = $("#wSource"); if(!box) return;
  const auto = state.autoRead;
  box.innerHTML = "";
  box.hidden = !auto && !state.weaponByHand;
  if(box.hidden) return;

  const farbe = (w: string) => { const e = list.find(x => x.name === w); return e ? e.color : "var(--dim)"; };
  const teile = auto ? auto.teile.filter((x, i) => i < 1 || (i < 2 && x.p >= AUTO_OFF_MIN)) : [];
  const split = teile.length
    ? "<span class='wsplit'>" + teile.map(x =>
        "<span><i class='wdot' style='background:"+esc(farbe(x.w))+"'></i>"+
        esc(weaponLabel(x.w))+" "+pctOf(x.p, 1)+"</span>").join("") + "</span>"
    : "";

  /* Zwei verschiedene Saetze, weil es zwei verschiedene Faelle sind. Vorher
     stand hier einer fuer beide, und bei Stab 98,4 gegen Grossschwert 1,6
     behauptete er, es habe nur eine Waffe gefeuert. */
  let rest = "";
  if(auto && !auto.off){
    const zweite = auto.teile[1];
    rest = "<span>" + esc(zweite
        ? t("weapons.offBelow", {w: weaponLabel(zweite.w), p: pctOf(zweite.p, 1),
                                 min: pctOf(AUTO_OFF_MIN, 0)})
        : t("weapons.oneOnly")) + "</span>";
  }

  if(state.weaponByHand){
    box.innerHTML = "<span class='wtag hand'>"+esc(t("weapons.byHand"))+"</span>"+
      (split ? "<span>"+esc(t("weapons.fightSays"))+"</span>"+split
             : "<span>"+esc(t("weapons.noReading"))+"</span>")+
      "<button type='button' class='btn' id='wAuto'>"+esc(t("weapons.readAgain"))+"</button>";
    $("#wAuto").onclick = clearWeaponByHand;
  } else {
    box.innerHTML = "<span class='wtag'>"+esc(t("weapons.fromFight"))+"</span>"+
      split + rest;
  }
}

export function renderWeapons(){
  const seg = state.encounters[state.sel]; if(!seg) return;
  const ids = skillIds(seg);
  const pickable = EQUIPPABLE;

  // Die zwei Waffen, die du traegst - gelesen aus dem Kampf, aenderbar von
  // Hand. Beides landet in denselben zwei Feldern, damit es nur einen Ort
  // gibt, an dem das Paar steht.
  ([["#wMain","main"],["#wOff","off"]] as const).forEach(([sel,welche]) => {
    const node = $<HTMLSelectElement>(sel);
    const wert = welche === "main" ? state.mainWeapon : state.offWeapon;
    node.innerHTML = '<option value="">'+esc(t("weapons.chooseOne"))+'</option>' +
      pickable.map(w => '<option value="'+esc(w)+'"'+(wert===w?" selected":"")+">"+esc(weaponLabel(w))+"</option>").join("");
    node.classList.toggle("autoset", !state.weaponByHand && !!wert);
    node.onchange = () => setWeaponByHand(welche, node.value);
  });

  const list = byWeapon(seg), total = seg.stats.total || 1;
  renderWeaponSource(list);
  // Only what is left to do. It used to also report how much is marked
  // Passive - which the table below states as its own row, and stated at a
  // different rounding: "0 % sind als Passiv markiert" over a "Passiv 0.3%"
  // row, two lines that look like they disagree.
  const un = list.find(w => w.name === "Unassigned");
  // Diese eine Prozentzahl ging an numN vorbei: toFixed schreibt immer einen
  // Punkt, und so stand im deutschen Fenster "Fuer 12.3 % des Schadens ist
  // noch keine Waffe gesetzt" ueber einer Anteil-Spalte, die "12,3 %" zeigt.
  $("#wUnassigned").textContent = un
    ? t("weapons.noWeaponSet", {pct:numN(100*un.damage/total, 1)}) + ". " +
      t("weapons.assignComplete")
    : t("weapons.allAssigned");

  // the class name reads off the declared main/second weapon, not off
  // whichever weapons happened to log damage in this one fight — a
  // support build's off-hand might barely show up in a DPS log even
  // though it's genuinely equipped
  const cls = (state.mainWeapon && state.offWeapon)
    ? classNameFor([state.mainWeapon, state.offWeapon]) : null;
  $("#wClass").hidden = !cls;
  // your own row does not wait for a report: the log in front of you says it
  const wRole = cls ? roleWithVentius(cls, iPlayVentius()) : "";
  if(cls) $("#wClass").innerHTML = '<span>'+esc(t("weapons.classIs"))+'</span><b>'+
    esc(className(cls))+"</b>"+
    // what the build is for, in the game's own three words
    /* Mit "Rolle:" davor. Allein stand "DPS" klein unter oder neben dem
       grossen Klassennamen und las sich wie die Einheit einer Zahl. */
    '<i class="classrole"'+(wRole !== cls.role
      ? ' title="'+esc(t("weapons.roleVentius"))+'"' : "")+">"+
    esc(t("weapons.roleIs", {role: t("weapons.role."+wRole)}))+"</i>";

  $("#wpnTable").innerHTML =
    "<table><thead><tr><th>"+t("weapons.colWeapon")+"</th><th>"+t("weapons.colDamage")+"</th>"+
      "<th class='wshare'>"+t("weapons.colShare")+"</th><th>"+t("weapons.colDps")+"</th><th>"+t("weapons.colHits")+"</th><th>"+
      t("weapons.colCrit")+"</th><th>"+t("weapons.colSkills")+"</th></tr></thead><tbody>" +
    // byWeapon() hands every weapon a colour from SERIES and this table used
    // to show none of it, while the skill list two sections below marks each
    // skill with exactly such a tick. Same fact, same page, two treatments.
    // The share gets the house device for a share — the small track the
    // target split already uses — because a 63/37 split is the one thing
    // here you should be able to read without doing the arithmetic.
    list.map(w => {
      const share = 100*w.damage/total;
      return "<tr><td>"+weaponMark(w.name)+
        "<span class='wdot' style='background:"+esc(w.color)+"'></span>"+
        esc(weaponLabel(w.name))+"</td><td>"+fmt(w.damage)+"</td>"+
        "<td class='wshare'>"+pctOf(share, 1)+"<span class='wbar'><i style='width:"+
          share.toFixed(1)+"%;background:"+esc(w.color)+"'></i></span></td>"+
        "<td>"+fmt(w.dps)+"</td><td>"+w.hits+"</td><td>"+pctOf(w.hits?100*w.crit/w.hits:0)+"</td>"+
        "<td>"+w.skills+"</td></tr>";
    }).join("") + "</tbody></table>";

  // three fixed slots — main weapon, second weapon, passive — always in the same columns
  const slots = [state.mainWeapon || "", state.offWeapon || "", "Passive"];
  // With no weapons picked, two of the three buttons on every row are empty
  // spans. Saying so is the difference between an empty state and a broken
  // one; the Passive sentence lives here too, beside the button it explains.
  /* Gefragt ist, ob die Knoepfe unten etwas taugen - und dafuer reicht EINE
     Waffe. Die Bedingung stand auf "beide Felder gefuellt" und sagte dann
     "Aus diesem Kampf wurde keine Waffe gelesen" unter einem Merker, der
     gerade eine Waffe samt Prozentzahl genannt hatte. */
  $("#assignDesc").textContent =
    (slots[0] ? t("weapons.skillsDesc") : t("weapons.pickFirst")) +
    " " + t("weapons.passiveIs");

  /* Ohne Waffe heisst: weder von Hand gesetzt noch aus der Tabelle bekannt.
     Genau die Zeilen, fuer die diese Karte ueberhaupt da ist. */
  const ohneWaffe = (k: SkillStats) => weaponFor(k.name, [...(ids.get(k.name) || [])][0]) === "Unassigned";
  const offen = seg.stats.skills.filter(ohneWaffe);
  const fertig = seg.stats.skills.filter(k => !ohneWaffe(k));
  const offenDmg = offen.reduce((a, k) => a + k.damage, 0);
  renderAssignFold(offen.length, seg.stats.skills.length, 100 * offenDmg / total, seg);

  const zeile = (k: SkillStats) => {
    const idList = [...(ids.get(k.name) || [])];
    const cur = weaponFor(k.name, idList[0]);
    return '<div class="assign'+(cur === "Unassigned" && offen.length && fertig.length
             ? " offen" : "")+'" data-skill="'+esc(k.name)+'">'+
      // the same .wdot the weapon table uses one card above: one geometry
      // for one meaning, instead of 3x12 r2 here and 3x13 r1 there
      '<div>'+skillMark(k.name, idList[0], esc(k.color), false)+
        esc(skillLabel(k.name, idList[0]))+
        // the house device for a run of facts, not the middle dot the rest
        // of the app has a helper against
        ' <span class="factline muted">'+factLine([fmt(k.damage),
          idList.length ? t("weapons.idSuffix",{id:idList[0]}) : null])+"</span></div>" +
      slots.map(w => w
        ? '<button class="wbtn'+(cur===w?" on":"")+(w==="Passive"?" wbtn-passive":"")+
          '" data-w="'+esc(w)+'">'+weaponMark(w)+esc(weaponLabel(w))+"</button>"
        : "<span></span>").join("") +
      '<select data-role="any">' + WEAPONS.map(w =>
        '<option value="'+esc(w)+'"'+(cur===w?" selected":"")+">"+esc(weaponLabel(w))+"</option>").join("") + "</select></div>";
  };
  /* Die offenen Zeilen zuerst, darunter die uebrigen - innerhalb beider
     Gruppen bleibt die Reihenfolge, die die Liste sonst haette. Die
     Ueberschriften stehen nur da, wo es wirklich zwei Gruppen gibt. */
  const gruppe = (n: string) => '<div class="assigngroup"><span>'+esc(t(n))+"</span><i></i></div>";
  $("#assign").innerHTML = (offen.length && fertig.length)
    ? gruppe("weapons.groupNone") + offen.map(zeile).join("") +
      gruppe("weapons.groupSet") + fertig.map(zeile).join("")
    : seg.stats.skills.map(zeile).join("");

  $("#assign").querySelectorAll<HTMLElement>(".assign").forEach(row => {
    const name = row.dataset.skill!;   // every .assign row names its skill
    // the unnamed row is every skill at once; writing its choice against
    // each id would persist one weapon for the whole fight
    const idList = name === NO_SKILL ? [] : [...(ids.get(name) || [])];
    row.querySelectorAll<HTMLElement>(".wbtn").forEach(b => b.onclick = () => {
      setWeapon(name, idList, b.classList.contains("on") ? "Unassigned" : b.dataset.w!);
      afterAssign();
    });
    row.querySelector("select")!.onchange = e => { setWeapon(name, idList, (e.target as HTMLInputElement).value); afterAssign(); };
  });
}


// what this part did at the top level, run where it stands in the order
export function setup(): void {
  /* Die Zeile, die die dritte Karte zusammenfasst - und, wenn nichts offen
     ist, die ganze Karte IST.

     Aufgeklappt wird beim Wechsel des Kampfes entschieden und danach nicht
     mehr: klappt jemand von Hand zu, bleibt es zu, bis er einen anderen Kampf
     waehlt. Der Livelauf baut die Liste zweimal die Sekunde neu, und eine
     Karte, die sich dabei von selbst wieder aufklappt, waere unbedienbar. */
  state.assignFight = "";
  $("#wImport").onclick = () => {
    const text = $<HTMLTextAreaElement>("#wPaste").value;
    let done = 0, missed = [];
    text.split(/\r?\n/).forEach(line => {
      if(!line.trim()) return;
      const m = line.split(/\s*[=,\t|]\s*/);
      if(m.length < 2) { missed.push(line.trim()); return; }
      const key = m[0]!.trim(), weapon = normWeapon(m[m.length-1]);
      if(!key || !weapon){ missed.push(line.trim()); return; }
      if(/^\d{6,}$/.test(key)){
        if(weapon === "Unassigned") delete state.weaponById[key]; else state.weaponById[key] = weapon;
      } else setWeapon(key, [], weapon);
      done++;
    });
    afterAssign();
    const nicht = missed.length;
    toast(() => t("weapons.linesApplied",{n:done}) + (nicht ? t("weapons.notUnderstood",{n:nicht}) : "."));
  };
  $("#wCopy").onclick = () => {
    const lines = Object.keys(state.weaponOf).map(n => n+" = "+state.weaponOf[n])
      .concat(Object.keys(state.weaponById).map(i => i+" = "+state.weaponById[i]));
    if(!lines.length){ toastFail(tt("weapons.nothingAssigned")); return; }
    $<HTMLTextAreaElement>("#wPaste").value = lines.join("\n");
    $<HTMLTextAreaElement>("#wPaste").select();
    try{ document.execCommand("copy"); toast(tt("weapons.copiedShown")); }
    catch(err){ toastFail(tt("weapons.copyManually")); }
  };
  $("#wClear").onclick = async () => {
    const ok = await askConfirm(t("weapons.clear"), t("weapons.clearConfirm"));
    if(!ok) return;
    state.weaponOf = {}; state.weaponById = {};
    afterAssign(); toast(tt("weapons.cleared"));
  };
}
