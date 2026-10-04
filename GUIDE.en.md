# Borometer — everything that is in it

The short version is in the [README](README.md). This is everything, in
order: every tab, every button, and where a number comes from.

*[Deutsche Fassung: GUIDE.md](GUIDE.md)*

---

## Contents

1. [Getting fights in](#1-getting-fights-in)
2. [The left rail](#2-the-left-rail)
3. [The head](#3-the-head)
4. [The table](#4-the-table)
5. [Timeline](#5-timeline)
6. [Rotation](#6-rotation)
7. [Analysis](#7-analysis)
8. [Weapons](#8-weapons)
9. [Party](#9-party)
10. [Compare fights](#10-compare-fights)
11. [History](#11-history)
12. [Log setup](#12-log-setup)
13. [Compact](#13-compact)
14. [The ⋯ menu](#14-the--menu)
15. [Keyboard](#15-keyboard)
16. [What gets written to disk](#16-what-gets-written-to-disk)

---

## 1. Getting fights in

**Live logging.** The switch in the top bar: **Live off**, after the click
**Live** (on the start page **Start live logging**); a second click stops it.
From that click on, Borometer looks every two seconds for a newer file in the log folder. A pull shows up shortly
after the fight, not during it — the game writes the log when the fight ends.
**Borometer never loads anything on its own**, not even a fight already
sitting in the folder.

**Open logs.** Pick files by hand. The ⋯ menu holds the two special cases:
*Load Throne logs* for the game's own files, *Load party logs* for what
somebody saved out of a party.

**Sample.** In the ⋯ menu. Two made-up fights so you can look at the app
without having played — every screenshot in the README shows exactly these
two.

**In a browser** instead of the exe: drag the log file into the window, or
click **Live off** and pick the log folder (needs Chrome or Edge).

---

## 2. The left rail

Every fight in the loaded log, top to bottom in the order of the evening.

**Blocks.** Fights that belong together stand under one heading: a dungeon run
under its name, a field boss under its. The heading says how many fights are
in it, how long the block ran altogether and how much damage came out. It
stays on screen while its block scrolls past, and the next one takes over.

**Trash folds away.** In a dungeon the bosses stand on their own and
everything else is one entry with a count. One click shows them. On a raid
evening that is four visible rows instead of eighteen.

**Edit.** Turns the list into one with handles: every row gets a ✕, and a
click takes that fight out. *Back* puts everything back. Two rules apply:

- A fight the party reported on carries a tag and stays.
- In a **party log** nothing can be taken out at all — there the numbers are
  not yours alone.

Taken out means *out of the view*, not deleted. The log file is never touched.

**Clear** takes every fight out of the view. For nine seconds the notice
carries an *Undo*.

**Saved fights.** At the bottom. *Save fight* puts the fight you are looking
at aside so it survives a restart and a new log — named after the build you
were wearing, so two builds can be read side by side. The *Compare* button
takes the ticked ones into tab 10.

**Filter and fight file.** Right at the bottom. Narrows down what is in the
list (split fights, hide short ones), and saves or loads saved fights as a
file.

---

## 3. The head

Everything about the selected fight, in four layers.

**The big number** is damage per second. It divides by the time you were
really on the target — not by the span from first to last hit. On a boss with
a phase in between, those are two different numbers.

**The fact line** below it: whose numbers these are, the span, the time fought
(only when it is a different one), the total damage and the clock time. The
time fought stands there for exactly one reason: it is the divisor of the big
number, and without it the arithmetic does not add up.

**The reading line** says in one sentence what happened. Four rules, checked
top to bottom, the first hit is printed:

| | When | What it says |
|---|---|---|
| 1 | fewer than 20 hits in the whole fight | "Only 10 hits in the whole fight — too few to say anything about shares." |
| 2 | at least 5 s with nothing on the target to hit | "The number above divides by 1m 46s — for 1m 9s there was nothing on the target to hit." |
| 3 | one skill over 50 % of the damage, from at least 10 hits | "Cursed Nightmare carried 77.8 % of the damage — 649 hits, 65 % of them critical." |
| 4 | otherwise | "Strongest skill: Manaball Eruption at 28.7 % — the rest spreads over 8 more." |

The hit floor in rule 3 is the point: 76 % out of three hits is chance, not a
finding.

**The verdict line** places the number when there is anything to place it
against: "Your best of 3 fights" or "39 % worse than usual". It says where it
knows that from — *on this boss* means every evening Borometer has ever seen,
*in this log* only today's.

**The figures** as a strip: your build, then *for the whole fight* and behind
it Hits, Crit / Heavy, Average and Biggest Hit. That caption is there because
the same words appear per row in the table below — up here they are about the
whole fight. If a shield came up, a sixth one joins them.

---

## 4. The table

Below that, the same thing five ways, depending on what you group by:

| | What a row is |
|---|---|
| **By skill** | one skill |
| **By weapon** | one of your two weapons (plus Passive) |
| **Targets** | one enemy |
| **Attackers** | one person in the log |
| **Players** | one member of the running party |

**Columns:** rank, name, damage, DPS, share, hits, biggest hit, crit, heavy. A
click on a heading sorts by it; on a tie the hit count decides, so a 100 %
rate out of two casts does not sit above one out of two hundred. The sort
falls back to damage whenever you switch fights.

When the window gets narrow, columns drop out — the one you are sorting by
always stays.

**Opening a row.** The arrow on the left shows what a row's damage is made of:
normal, critical, heavy, critical heavy. Each hit type with its own bar, its
own share and its own hit count. The `×2` beside it says this type lands about
twice as hard as a normal hit of the same skill. Rows where every hit landed
the same way do not open — there is nothing to show.

**"Name (8 of 12)"** in the table's own header says how many rows are visible
and how many there are. The table has a fixed height so the tabs below it do
not jump when somebody opens a row.

---

## 5. Timeline

How the damage spreads over the length of the fight.

- **The curve** is total damage per second, smoothed. *1 s (raw)*, *3 s* or
  *5 s* — the larger, the calmer the line.
- **The traces** below: one per skill, each on its own baseline. Under *Lane
  scale*, *Per lane* scales each for itself, *Shared* puts them all on one
  scale — the first shows the rhythm, the second the order of magnitude. A
  click on a name takes it out of the curve above.
- The boxed field is the **weakest stretch** of the fight.
- **Ctrl + wheel** zooms, the bar below drags the window, and *From / to /
  Apply* lets you type it. From the keyboard, use the − / + buttons and then
  the arrow keys.

---

## 6. Rotation

One icon per cast, laid out left to right in the order you pressed them, with
one trace per skill below. The bar behind a cast is the span in which it was
still hitting — a mark without a bar hit once.

The text above says how many casts are in the picture and how long the longest
pause between two casts of the strongest skill was. Gaps in the rotation show
up here faster than in any table.

---

## 7. Analysis

Sentences instead of sums, in four parts.

**The fight in numbers** — the curve in miniature, plus a sentence about the
spread: "Your first half ran at 573.9k, 1.6 times the second."

**Where did the damage go?** — the strongest skill with its share, and what a
single cast of it brings on average, against the second strongest.

**What was the rhythm?** — the shape of your build (bursty or even), the
weakest three seconds with the question of what was on cooldown there, and the
idle time: how long nothing was pressed at all.

**Where did you stand on Eye of Ventius?** — only when the skill came up. The
arrow, an aftershock a second later; each aftershock hits up to three times.
How many a target gives at all is its **size** — which is why the ceiling
stands per boss in a table instead of being fixed. Trash is not in it: it is
dead before the question comes up.

**How good were the hits?** — crit rate and what it is worth in damage, misses
(the log writes them as hits without damage, so they count in no other number
here), heavy hits and the biggest single blow.

---

## 8. Weapons

Borometer reads your weapon pair out of the selected fight: which skill
belongs to which weapon it knows by itself. If that is wrong, pick by hand
here — the choice is per character and survives a restart.

Below that: damage per weapon with share, DPS, hits and crit rate, what your
build is called, and whether every skill in the fight could be assigned to a
weapon. An off-hand counts as one from **3 %** share upwards.

---

## 9. Party

Everyone sends their newest fight, everyone sees one shared, sorted board with
class and role beside each name. Rows open two levels deep: first the skills,
then their hit types.

Three ways, in the *Party* tab:

1. **A server is already running in the clan** — the common case. Enter its
   address once under *Party server*, save. After that the four-character code
   somebody passes around is enough.
2. **Hosted from your own PC.** Type your character name, *Host party*. You
   get a code and address, like `AB7K@192.168.1.20:8732` — no 0, O, 1 or I, so
   nothing is misheard when read out. On the same network this just works;
   over the internet the host has to be reachable.
3. **Your own small server.** Then the party does not depend on one particular
   PC staying on. It is in [`BoroPartyServer/`](BoroPartyServer/).

While hosting, Borometer opens a second port that answers party traffic and
nothing else. Logs and settings are not reachable through it, every request
without the current code is refused, and *Close party* closes the port.

**Click a boss fight on the left** and the whole party for it stands at the
top: each with their own fight against that boss. You can look at the timeline
and rotation of the others — a row *Whose* stands above both charts.

*Save party log* writes every boss fight of the loaded log, not just the
moment you pressed it.

---

## 10. Compare fights

Tick two to four fights — from the loaded log or from the saved ones. What
comes out:

- **Who wins**, on DPS, and how far behind the others land.
- **Where the difference comes from.** Skill by skill, how much DPS it brought
  more or less than in the other fight. Usually two or three carry nearly all
  of it.
- **Head to head** on the figures: DPS, damage, length, hits, crit rate, crit
  share of damage, heavy rate, average hit, biggest hit, idle time. Whatever
  grows with length is marked as such.
- **Damage per second, skill by skill**, and the same per weapon.

If the fights are different lengths, Borometer says so and offers to **cut
both to the shorter one**. Without that you are comparing totals that are only
bigger because the fight ran longer — DPS and the rates are comparable,
damage, hits and idle time are not.

---

## 11. History

Your performance per boss across every evening. It fills up while you play:
Borometer remembers what it saw itself. Bosses only — a practice dummy is not
in it at all, because there every pause is the end of an attempt and not a
performance. German and English spellings of the same enemy are merged.

The verdict line in the head comes out of this directory.

---

## 12. Log setup

Only appears when there is something to set up. Borometer works out the column
roles from the shape of the data — time, event type, skill, skill id, damage,
crit flag, heavy flag, hit type, attacker, target. If one is wrong, change it
here; every number is recalculated at once.

Plus the delimiter (comma, tab, semicolon, pipe) and whether the first line
carries column names or data already. At the top stands what was detected:
combat log version, line count, column count.

---

## 13. Compact

The *Compact* button at the top. The window becomes a strip: readout, head and
bars, nothing else. Meant for a second monitor, or laid over the game.

- **See-through** in whole steps from 0 to 55 %.
- **Keep on top**, so the game does not cover it.
- **Click-through** with **Ctrl+Shift+D**: clicks go through the overlay to the
  game, press again to take it back. From the full view the shortcut makes the
  whole overlay at once – compact, on top, click-through.
- With the mouse away, the controls fade and only the numbers stay.
- A word says whether logging is on — not only a dot.
- **Esc** takes you back. If something is over it (the ⋯ menu, a dialog), Esc
  closes that first.

---

## 14. The ⋯ menu

- **Load Throne logs** / **Load party logs** — the two special cases for
  opening.
- **Sample** — the two made-up fights.
- **Theme**: Dark, Light, TnL or Auto (follows Windows).
- **Size**: the interface from 10 to 200 %, and the see-through setting.
- **Switch to German** — every label exists in both languages.
- **Changelog** — what changed per version, inside the app itself.
- **Write bug report** — see the
  [README](README.md#when-something-is-wrong).
- **Developer mode** — brings up *Export CSV* and the sample party.

---

## 15. Keyboard

| Where | Key | What happens |
|---|---|---|
| anywhere | **Ctrl + +** / **Ctrl + −** / **Ctrl + 0** | interface bigger, smaller, back to 100 % |
| anywhere, in the game too | **Ctrl+Shift+D** | click-through on and off; from the full view straight into the overlay |
| anywhere | **Esc** | closes the topmost thing — menu, dialog, filter, changelog; only when nothing is over it, compact |
| right at the start | **Tab** | a skip link leads past the rail straight to the fight |
| left rail | **↑ ↓** | through the fights |
| | **Home / End** | first, last |
| | **→** | open a folded block, otherwise one row on |
| | **←** | close an open block, otherwise to the heading above |
| | **a letter** | jumps to the next name starting with it — mid-name too |
| table | **↑ ↓** | through the rows, opened ones included |
| | **→ ←** | open and close a row |
| tabs | **← → ↑ ↓** | to the next tab, wrapping round |
| | **Home / End** | first, last |
| timeline | **Ctrl + wheel** | zoom; from the keyboard use the − / + buttons and then the arrow keys |

---

## 16. What gets written to disk

| Where | What |
|---|---|
| `%APPDATA%\Borometer\boro-config.json` | the settings |
| `Logs\` beside the exe | what you save yourself |
| `Party-Logs\` beside the exe | saved party logs |
| `Bug-Reports\` beside the exe | bug reports |

The three folders only appear once you save such a file for the first time.
"Beside the exe" is for the portable versions; the installed one keeps them
under `Documents\Borometer`. The window itself (Chromium) keeps its storage in
`%APPDATA%\Borometer\electron`.
**Borometer never writes into the game's combat log folder** —
`npm run audit:safety` checks exactly that, mechanically, on every change.
