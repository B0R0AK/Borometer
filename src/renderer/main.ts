// Borometer - a damage meter for Throne and Liberty
// Copyright (C) 2026 B0R0AK
// SPDX-License-Identifier: GPL-3.0-or-later
//
// The page script's entry. Loading the parts only declares things; what a
// part does when the page starts - set a handler, fill in a default in state,
// paint for the first time - is in its setup(), and those run here, in the
// order of the parts' numbers. That order is behaviour: a later part's setup
// may rely on what an earlier one did, as it did when the script was one file.
// scripts/build-renderer.mjs checks that every setup is called, in order.

import { setup as setup01 } from "./app/01-state";
import { setup as setup08 } from "./app/08-translation";
import { setup as setup10 } from "./app/10-skill-names";
import { setup as setup14 } from "./app/14-questlog-weapons";
import { setup as setup15 } from "./app/15-weapons-and-ventius";
import { setup as setup18 } from "./app/18-interface-basics";
import { setup as setup19 } from "./app/19-grouping-and-party-fights";
import { setup as setup21 } from "./app/21-damage-table";
import { setup as setup23 } from "./app/23-kampfwahl";
import { setup as setup24 } from "./app/24-table-keyboard-and-timeline";
import { setup as setup27 } from "./app/27-weapons-tab";
import { setup as setup32 } from "./app/32-history";
import { setup as setup33 } from "./app/33-input";
import { setup as setup34 } from "./app/34-menus-drop-and-tabs";
import { setup as setup35 } from "./app/35-party-log-files";
import { setup as setup36 } from "./app/36-dialog";
import { setup as setup37 } from "./app/37-window-size-and-overlay";
import { setup as setup38 } from "./app/38-tooltips";
import { setup as setup39 } from "./app/39-themes";
import { setup as setup40 } from "./app/40-sample-fight";
import { setup as setup41 } from "./app/41-server-mode";
import { setup as setup42 } from "./app/42-party";
import { setup as setup43 } from "./app/43-more-menu-and-dev-mode";
import { setup as setup45 } from "./app/45-startup";
import { setup as setup46 } from "./app/46-best-pull";
import { setup as setup50 } from "./app/50-bild";
import { setup as setup54 } from "./app/54-deine-rotation";
import { setup as setup55 } from "./app/55-statusleiste";
import { setup as setup56 } from "./app/56-tafel";
import { setup as setup57 } from "./app/57-einstellungen";
import { setup as setup58 } from "./app/58-felder";
import { setup as setup59 } from "./app/59-weeklies";
import { setup as setup62 } from "./app/62-rekorde";
import { setup as setup63 } from "./app/63-rundgang";
import { setup as setup64 } from "./app/64-glutring";
import { setup as setup65 } from "./app/65-nachspielen";
import { setup as setup66 } from "./app/66-windows";
import { setup as setup67 } from "./app/67-weeklies-erinnerung";
import { setup as setup68 } from "./app/68-gilde";

setup01();
setup08();
setup10();
setup14();
setup15();
setup18();
setup19();
setup21();
setup23();
setup24();
setup27();
setup32();
setup33();
setup34();
setup35();
setup36();
setup37();
setup38();
setup39();
setup40();
setup41();
setup42();
setup43();
setup45();
setup46();
setup50();
setup54();
setup55();
setup56();
setup57();
setup58();
setup59();
setup62();
setup63();
setup64();
setup65();
setup66();
setup67();
setup68();
