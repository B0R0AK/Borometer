# Borometer: everything that is in it

The short version is in the [README](README.md). This is everything, in order:
every area, every button, and where a number comes from. Covers version 2.0.

*[Deutsche Fassung: GUIDE.md](GUIDE.md)*

---

## Contents

1. [Getting fights in](#1-getting-fights-in)
2. [The frame: toolbar, title bar, status bar](#2-the-frame-toolbar-title-bar-status-bar)
3. [The fight picker](#3-the-fight-picker)
4. [Fight](#4-fight)
5. [Rotation and timeline](#5-rotation-and-timeline)
6. [Analysis and workbench](#6-analysis-and-workbench)
7. [Compare](#7-compare)
8. [History](#8-history)
9. [Records](#9-records)
10. [Boss fight archive](#10-boss-fight-archive)
11. [Weeklies](#11-weeklies)
12. [Characters](#12-characters)
13. [Party](#13-party)
14. [Guild](#14-guild)
15. [Compact](#15-compact)
16. [Windows and windows of their own](#16-windows-and-windows-of-their-own)
17. [Settings](#17-settings)
18. [Developer mode: Weapons and Log setup](#18-developer-mode-weapons-and-log-setup)
19. [Keyboard](#19-keyboard)
20. [What gets written to disk](#20-what-gets-written-to-disk)

---

## 1. Getting fights in

**Live logging.** The switch in the title bar: **Live off**, after the click
**Live** (on the start page **Start live logging**); a second click stops it.
From that click on, Borometer looks every two seconds for a newer file in the
log folder. A pull shows up shortly after the fight, not during it, because the
game writes the log when the fight ends. **Borometer never loads anything on
its own**, not even a fight already sitting in the folder.

**The log folder** under `%LOCALAPPDATA%\TL\Saved\CombatLogs` is found
automatically. If Borometer cannot find it, the start page says so and offers
**Choose log folder**; after that it is remembered. You can change it under
Settings › Log folder.

**Open logs.** The button in the title bar opens a small menu with the two
kinds of file: *Load Throne logs* for the game's raw files, *Load party logs*
for what someone saved from a party. The start page offers the same as a drop
area ("Drag a log file here") and a list, *Recently opened*. With no log loaded
yet, a click on the fight picker in the middle of the title bar opens the
loading dialog. If a log is no longer in the folder, **Open log** in Records
falls back on the [archive](#10-boss-fight-archive).

**Sample.** The start page offers *View the sample fight*; under Settings ›
Developer the same thing is a *Load* button. Two fights, so you can look at the
app without having played. The pictures in the README show exactly these two.

**In the browser** instead of the exe: drag a log file into the window, or
click **Live off** and pick the log folder (needs Chrome or Edge). The archive,
the party and the windows of their own exist only in the app.

**Tour and notes.** On the first start Borometer asks whether you want the
tour: six short steps (log folder, Live, fight picker, Compact, Weeklies,
Report a bug). On your first visit to an area, one line says what it does. Both
can be repeated or switched off under Settings › Info.

---

## 2. The frame: toolbar, title bar, status bar

**The toolbar on the left** holds the areas, each with an icon and a bubble on
hover: *Fight*, *Rotation*, *Analysis*, *Compare*, *History*, *Party*, below
them *Weeklies*, *Guild*, *Records*, *Archive*, *Start* and *Settings*. With no
fight loaded, the areas that need a fight are locked. A dot on *Fight* counts
new fights you have not looked at yet. *Weapons* and *Log setup* appear only in
[developer mode](#18-developer-mode-weapons-and-log-setup).

**The title bar** carries, from left to right, the name with the version, in
the middle the [fight picker](#3-the-fight-picker) (with arrows to the previous
and next fight), then *Live*, *Open logs*, *Compact*, settings and the window
buttons. On Fight, Rotation, Analysis and Compare there is also the button
*Open in its own window* (see
[Windows and windows of their own](#16-windows-and-windows-of-their-own)).

**The status bar at the bottom** says whether Live is running, which file was
read last and how many fights were added today. It also says "Read only,
nothing in the game", the interface size (a click puts it back to 100 %),
**Report a bug** and, if the update notice is on and a new version exists, its
number.

**Report a bug** writes a JSON file into the `Bug-Reports` folder, with the
version, window size, how the log's columns were recognised, which skills and
hit kinds appeared and what went wrong last. The combat log is not in it, but
the path to your settings file is, and short samples from the columns that hold
names. Look inside before you attach the file to an issue.

---

## 3. The fight picker

The list of all fights in the loaded log, in the order of the evening. It opens
from the middle of the title bar or with **Ctrl+K**, closes with Esc and has a
search field for boss, place, time and DPS.

**Blocks.** Fights that belong together stand under one heading: a dungeon run
under its name, a field boss under its own. The heading says how many fights
are inside, how long the block ran in total and how much damage it added up to.

**Trash folds away.** In a dungeon the bosses stand on their own and everything
else is one entry with a count. One click shows them. On a raid evening that is
four visible rows instead of eighteen.

**Earlier days.** In the app, the head of the list has two arrows to the days
the log folder has files for. While an earlier day is open, Live pauses;
*Today* goes back.

**Edit** turns the list into one with handles: every row gets a ✕, and a click
takes that fight out. Two rules apply:

- A fight the party reported on carries a tag and stays.
- In a **party log** nothing can be taken out at all, because there the numbers
  are not yours alone.

Taken out means *out of the view*, not deleted. The log file is never touched.
**Clear** takes every fight out of the view; for nine seconds the notice
carries an *Undo*.

**Saved fights.** *Save fight* puts the fight you are looking at aside so it
survives a restart and a new log. *Saved* at the foot of the list opens them.
Tick two to four of them (or fights from the log) and *Compare* takes them into
[Compare](#7-compare).

**Filter and fight file.** At the foot of the list, the filter splits fights
and hides short ones: after how many seconds without damage a new fight begins,
and how short a fight may be before it is hidden. The same values are under
Settings › Log folder, together with the switch that joins the phases of a boss
that cannot be hit for a while. Through the filter you save the saved fights as
a file or load them again.

---

## 4. Fight

The *Fight* area shows the selected fight in layers.

**The head.** The big number is damage per second. It divides by the time you
were really on the target, not by the span from first to last hit. On a boss
with a phase in between, those are two different numbers. The fact line names
whose numbers these are, the span, the time fought (only when it is a different
one), the total damage and the clock time. The time fought is there because it
is the divisor of the big number; without it the arithmetic does not add up.

**The reading line** says in one sentence what happened. Four rules, checked
top to bottom, the first hit is printed:

| | When | What it says |
|---|---|---|
| 1 | fewer than 20 hits in the whole fight | "Only 10 hits in the whole fight, too few to say anything about shares." |
| 2 | at least 5 s with nothing on the target to hit | "The number above divides by 1m 46s, for 1m 9s there was nothing on the target to hit." |
| 3 | one skill over 50 % of the damage, from at least 10 hits | "Cursed Nightmare carried 77.8 % of the damage, 649 hits, 65 % of them critical." |
| 4 | otherwise | "Strongest skill: Manaball Eruption at 28.7 %, the rest spreads over 8 more." |

The hit floor in rule 3 is the point: 76 % out of three hits is chance, not a
finding.

**The verdict line** places the number when there is anything to place it
against: "Your best of 3 fights" or "39 % worse than usual". It says where it
knows that from: *on this boss* means every evening Borometer has ever seen,
*in this log* only today's.

**The glow ring.** The fight stands there as a ring. Each arc is a skill, as big
as its damage, the big number sits in the middle, and the outer edge shows how
the hit kinds are distributed (normal, critical, heavy, critical heavy, and
shield where there was one). A click on an arc opens that skill in the list. In
a party the ring shows the members; a click on one opens that member's ring,
and *Group* leads back. **Replay the fight** lets the skills race each other;
their bars grow with the damage up to that moment.

**The list beside the ring** sorts by damage, share or DPS (the *Sort* header
chooses). It is the fight's table. The switch above it changes what a row is:

| | What a row is |
|---|---|
| **By skill** | one skill |
| **Targets** | one enemy |
| **Attackers** | one person in the log (only if the log has several) |
| **Group** | one member of the running party (only with a party) |
| **By weapon** | one of your two weapons plus passive (developer mode only) |

Each row gives damage, DPS, share, hits, biggest hit and the rates for critical
and heavy. On a tie the hit count decides, so a 100 % rate out of two casts does
not sit above one out of two hundred.

**Expanding.** The arrow on a row shows what its damage is made of: normal,
critical, heavy, critical heavy. Each hit kind has its own bar, its own share
and its own hit count. The `×2` beside it says this kind hits on average twice
as hard as a normal hit of the same skill. Rows where every hit landed the same
do not expand, as there is nothing to show. The rates count direct hits only,
without over-time effects and passives.

**As image.** The button in the head turns the fight or the party board into a
PNG you can save or put on the clipboard. The picture is made on your machine;
nothing is uploaded.

---

## 5. Rotation and timeline

Both stand in the *Rotation* area on the same time axis, so a cast sits exactly
above its track.

**Your casts.** One symbol per cast, in the order you pressed them. Two views:
*Bar* with a time axis and *Sequence* without one, which wraps. The bar behind a
cast is the span in which it still hit; a mark without a bar hit once. The text
above says how many casts are in the picture and how long the longest pause was
between two casts of the strongest skill. Gaps in the rotation show up here
faster than in any table. Playback works once the fight is over.

**The timeline.** How the damage spreads over the fight time.

- The curve is total damage per second, smoothed: *1 s (raw)*, *3 s* or *5 s*;
  the larger, the calmer the line.
- The tracks below: one per skill, each on its own baseline. Under *Track
  scale*, *Per track* scales each by itself, *Shared* all to the same. The first
  shows the rhythm, the second the order of magnitude. A click on a name takes
  it out of the curve above.
- The framed box is the fight's **weakest stretch**. A mechanic recognised for
  the boss is hatched and does not count as a gap.

**Zoom.** **Ctrl + mouse wheel** zooms, the bar below drags the section, and
*From / to / Apply* lets you type it in. From the keyboard it works through the
− / + buttons and the arrow keys. Zoom and section apply to casts and timeline
together.

**On boss fights with a party** a row *Whose* stands above both pictures: the
other members can be looked at with their timeline and rotation.

---

## 6. Analysis and workbench

Sentences instead of totals, and a workbench below them.

**At the top** stands a verdict, next to it the key line: DPS, gaps, casts per
minute, who does the most damage, all against your best pull (or against the
second best when there is none). A pull counts as comparable when you played it
with the same weapon pair.

**The fight strip.** The fight runs as one strip across the whole width, with
one bay per skill, as large as its weight. The findings hang as flags above the
strip: every gap, the weakest stretch, the start, the strongest five seconds.
Press a flag and its sentence appears, and the bays that contributed nothing
there step back. Each cast is a stroke in one of four heat levels (normal,
heavy, critical, critical heavy), and your best pull runs along as a dashed
curve.

**The workbench.** Every skill has a bay and a row that says in one sentence
what stands out about it: a pause in its own rhythm, fewer casts than in the
best pull, or just count and rhythm. Legend and axis stand above. The rate for
critical and heavy counts direct hits only, and the page says how many that
was. Gaps above a minimum length are marked with their duration.

**More findings** below, as a list:

- **How was the rhythm?** The kind of your build (bursty or even), the weakest
  three seconds with the question of what was on cooldown there, and the idle
  time: how long nothing was pressed at all.
- **Where did the damage go?** The strongest skill with its share, and what a
  single cast of it brings on average, compared with the second strongest.
- **Eye of Ventius**, only if the skill appeared. The arrow, a second later an
  aftershock; each aftershock hits up to three times. How many a target gives
  at all is its **size**, which is why the cap per boss sits in a table and is
  not hard-coded. Trash is not in it: it is dead before the question arises.
  Your best cast per boss is also in [Records](#9-records).
- **How good were the hits?** Crit rate and what it makes up of the damage,
  misses (the log writes them as hits without damage, so they count in no other
  number), heavy hits and the biggest single blow.

The footer *What the log does not know* says what the numbers cannot prove, your
equipment for one: Borometer recognises your build only by weapons and skills.

---

## 7. Compare

**Against the best or the last pull.** At the top you switch between *Best pull*
and *Last pull* (the last pull is the previous fight on the same boss; with none
the button is locked and says why). Next to it stand two big numbers, a sentence
with the sum of the rows, and every skill with "only in this one" and "only in
the best" as a bar toward the middle, without red and green. Folded away below
are *Rotation side by side* and *Head to head and weapon by weapon*.

**Choosing other fights.** Tick two to four fights, from the loaded log or from
the saved ones, and start the comparison by hand. What then comes:

- **Who wins**, on DPS, and how far the others are behind.
- **Where the difference comes from.** Skill by skill, how much DPS each brought
  more or less than the comparison fight. Usually two or three carry almost all
  of it.
- **Head to head** of the figures: DPS, damage, length, hits, crit rate, crit
  share of damage, heavy rate, average hit, biggest hit, pauses. What grows with
  length is marked as such.
- **Damage per second, skill by skill**, and the same per weapon.

If the fights differ in length, Borometer says so and offers to **cut both to the
shorter one**. Without that you compare totals that are bigger only because the
fight was longer: DPS and the rates are comparable, damage, hits and pauses are
not.

---

## 8. History

Your performance per boss across all evenings. At the top is the chart over
time: the points of all fights, the median dashed, the best in gold. Points from
the loaded log are filled, earlier and saved ones hollow. The period (*Week*,
*Month*, *All*) sits in the header. Below it is the list of fights with day,
time, duration and DPS and the button *Open in Compare*; a row and a point pick
each other.

History fills as you play: Borometer remembers what it has seen itself. Bosses
only, because a practice target is not in it: there every pause is the end of
an attempt, not a performance. German and English spellings of the same enemy
are merged. The verdict line in the head comes from this directory too.

---

## 9. Records

Borometer reads your logs once and keeps an album: per boss your best DPS, your
strongest hit with the skill that landed it, and the day of your first fight.
Bosses you have not fought yet stand as empty outlines. The Eye of Ventius
record (your best cast per boss) is here too.

With [characters](#12-characters), a bar above the album counts the records as
*Total*, *Main*, *Twinks* and, where fights belong to no known character,
*Unknown*. **Open log** on a record fetches the fight, from the
[archive](#10-boss-fight-archive) if the log is gone. Under Settings › Log
folder, *Read records again* reads the 60 newest logs once more; nothing is
deleted by that.

---

## 10. Boss fight archive

Borometer keeps a copy of every boss fight it reads in the folder `archiv`
beside the settings, on your PC only. That includes field bosses, raid bosses,
dungeons, the Hall of Illusions and the practice dummy; not trash and not party
totals. If the game later deletes its logs, the copies stay. The first time, a
notice on the start page explains what the archive does, and nothing is taken
in before you confirm.

**The *Archive* area** lists every known boss as a card with best DPS and number
of fights, grouped like the records and searchable by German and English name.
A click opens the boss: the points of all its fights over time, the median, the
best marked, and below them the fights themselves, newest first. A fight opens
from the archive even if its log is gone.

**Settings › Archive.** *Keep boss fights* switches the archive off (switched
off, nothing new is added; what is there stays). *Open archive folder* shows the
folder, one file per fight. **Read old logs** takes the fights from the logs
still in the game's folder into the archive.

**Detaching and deleting.** Fights you no longer want can be detached, singly or
several at once, with *Undo*; they then vanish from the search. You can delete
them for good only from the list of detached fights: you type boss and date (for
several, their number), and beforehand Borometer puts the fight files and the
directory into the `sicherungen` folder and checks the copy. If it is
incomplete, nothing is deleted. Borometer never deletes the backup, active
fights stay undeletable, and it deletes nothing on its own.

---

## 11. Weeklies

One tab per character, up to six: the raid as a grid of wings and difficulties,
the secret dungeon, events, the dimension trial and the merchants, each with a
counter. A band shows where the week stands and when the next weekly reset
(Thursday, 10:00 German time) and the next daily reset come. **None of this is
read from the game; you tick it off yourself.** Per character you can hide
entries, rename them and add your own (*Customise*); *Show only what is open*
hides what is done.

A character you marked as [main](#12-characters) stands first and opens first.
Characters you no longer need are detached, not deleted, with *Undo*; under
*Detached* you bring them back or delete them for good after typing the name and
once Borometer has put a backup file into `sicherungen`.

**Reminders.** A Windows notice at the chosen time, on chosen weekdays, and if
you like only when something is still open. This works only while Borometer is
running (Settings › Windows: *Close to the notification area*, *Start with
Windows*); missed reminders are not made up. In the browser there is no Windows
notice.

The Weeklies also appear in the [compact window](#15-compact).

---

## 12. Characters

Settings › Characters holds the characters from the Weeklies. For each you
enter the **log name**, the attacker name exactly as the log writes it. You mark
one of them as **main**. Borometer then knows which character fought which
fight, and the [Records](#9-records) say who holds which. History remembers only
an identifier for the character, never the name. Without log names the records
stay as they were.

---

## 13. Party

Everyone sends their newest fight, everyone sees one shared, sorted board with
class and role beside each name, such as Oracle · Healer or Crusader · Tank.
Rows expand two levels deep: first the skills, then their hit kinds. In the
*Party* area you choose under *Where the party runs*:

1. **Own server.** If your clan already runs a server (the most common case),
   you enter its address once under Settings › Party and server in the field
   **Server address** and press **Save**. After that the four-character code
   that someone passes around is enough. An address with `https://` is
   encrypted; for one without, Borometer warns you.
2. **On this PC.** Type character names, *Start party*. You get a code with an
   address, such as `AB7K@192.168.1.20:8732`, without 0, O, 1 and I so nothing
   gets mixed up when read aloud. On the same network this works as is; over the
   internet the host has to be reachable. While hosting, Borometer opens a
   second port that answers party traffic only. Logs and settings cannot be
   reached through it, every request without the current code is rejected, and
   *Close the party* closes the port.
3. **Public server.** The guest server `https://guest.borometer.de` for anyone
   without a server. *Use this server* saves the address; only that click does
   so, before it Borometer asks nothing. If it gets too busy it can be switched
   off, and Borometer shows that nothing answers. That it always runs is not
   promised. A room is gone 30 minutes after the last member leaves, after 12
   hours at the latest. A party that matters belongs on a server of its own.

A **small server of your own** is in [`BoroPartyServer/`](BoroPartyServer/), so
the party does not depend on one particular PC staying on.

**If you click a boss fight in the fight picker**, the whole party appears with
it: everyone with their own fight against that boss. *Save party log* stores all
boss fights of the loaded log, not just the moment you pressed it.

---

## 14. Guild

For guild leaders. Four tabs:

- **Members**: the list with weapons and role.
- **Appointments**: recurring appointments with attendance per appointment
  (present, absent, excused).
- **Report**: rate and streak per member, without colours and without ranks.
- **Points**: off by default. Switched on, Borometer keeps an account per member
  made of active months, guild bosses and raids, standing in the guild, and
  extra points by hand. The *Rules* can be changed (every guild may count
  differently), your own kinds of points can be added, members can be set to
  *Inactive* (they then collect no months and are not in the list at the
  appointments), and points can be read from a table or copied as text.

As long as you set nothing else, the guild lives in `boro-gilde.json` on your PC
and nothing is sent.

**Guild online.** A guild leader can switch this on. The list then lives on a
server at an `https://` address the leader enters. Members join with a code or
link and see the list without being able to change it. The operator of that
server can read everything that lies there; setup says so before the guild is
created. Borometer sends only to the address the leader entered, never to one
from a link or a file.

**Detaching and deleting.** A guild nobody needs any more is detached, not
deleted: *Dissolve guild…* asks for the guild's name, members, appointments and
points stay in the file, and under *Detached guilds* you bring them back. From
the list of detached guilds, members and kinds you can delete for good after
typing the name and once Borometer has put a backup file into `sicherungen`.

---

## 15. Compact

The *Compact* button at the top. In the app it opens a window of its own, a flat
strip for the second monitor or laid over the game; the full view stays open
beside it. It is an ordinary Windows window above the game, not an overlay in
the game, and Borometer does not touch the game. It stays above Throne and
Liberty only if the game runs as a borderless window (in the game under
Settings › Graphics › Display mode).

- **Two tabs**, *Fight* and *Weeklies*, switch the view; **Ctrl+Shift+W** does
  it too.
- **Fight**: on the left the big DPS number, below it the comparison with the
  last pull, on the right boss, clock time and duration. An edge on the left
  stands full while Live runs. The skills show five rows and scroll with the
  mouse wheel; the button below opens the whole list, and the window grows with
  it. With a party, *Me* / *Group* switches whose numbers these are.
- **Weeklies**: the entries of your main (*Switch character* picks another), the
  reset, and a dot on the tab when a reminder is due. While click-through is on
  they are read-only.
- The window can be grabbed anywhere on the whole header. It cannot be dragged
  smaller than the bar and the first row.
- **See-through** in whole steps from 0 to 55 % (Settings › Overlay or the
  strip's menu). Not available on Linux.
- **Keep above the game**, so the game does not cover it.
- **Click-through** with **Ctrl+Shift+D**: clicks pass through the window into
  the game, pressing it again brings it back. From the full view the shortcut
  makes the whole overlay at once: compact, on top, click-through. If another
  program holds the shortcut, the menu says so.
- A word says whether recording is on, not just a dot.
- **Esc** leads back: the first press says that a second one opens the full
  view, and the second within two seconds does it. If something lies above (the
  menu, a dialog), Esc closes that first.

Which fights the strip shows, it decides itself from the log folder. A fight
from the archive, the sample or a dragged-in file appears only in the full view;
the strip says so in a word.

---

## 16. Windows and windows of their own

**The Windows menu.** Right-click, Shift+F10 or the menu key on a row of the
damage table opens a menu at the pointer, in the interface language. *Copy* puts
skill and value on the clipboard (Ctrl+C on the focused row does the same),
*Show in rotation* jumps to the rotation and highlights the skill.

**A window of its own.** In the head of Fight, Rotation, Analysis and Compare,
the button *Open in its own window* puts the area into a window, for the second
monitor for instance. There is at most one such window; it follows the full
view's fight, writes nothing and closes with it. The compact window and the
browser have neither menu nor button.

**Settings › Windows** (app only) has four switches:

- *Notify after every fight*: a Windows notice with the result when Borometer is
  not in front (off by default). With it *Only for a new best*, so it stays
  quiet unless the fight beats your best pull.
- *Close to the notification area*: closing hides the window, live logging goes
  on. You quit from the icon's menu.
- *Start with Windows*: opens minimised when you sign in (off by default).

Without a switch there are two more things: a jump list on the taskbar icon of
the installed version with the logs read last, and a progress bar on the taskbar
icon while a large log is loading.

---

## 17. Settings

Settings take effect at once. The sections are on the left:

- **Appearance**: the theme. There are **four**: *Dark*, *Light*, *TnL* (in the
  game's colours) and *Smoked glass*, which on Windows 11 lets what lies behind
  the window show through, blurred (elsewhere it stands on solid smoke grey).
  *Auto* is not a fifth theme, it takes Windows' setting (light or dark).
  Contrast is measured for all four.
- **Language**: German or English. Every label exists in both.
- **Size**: the interface from 10 to 200 %. Ctrl + plus, Ctrl + minus and
  Ctrl+0 do the same. The window of the full view has a fixed size: it can be
  neither dragged nor maximised, and the interface size does not change it.
  If you want to see more or less on the screen, set it here. Windows you tear
  off from an area can be dragged and maximised.
- **Overlay**: see-through, the shortcut for click-through, *Keep above the
  game* and *View the overlay*. App only.
- **Log folder**: the combat log folder, live logging, the rules for splitting
  fights (see [The fight picker](#3-the-fight-picker)), saving and loading the
  fight file and *Read records again*.
- **Archive**: see [Boss fight archive](#10-boss-fight-archive).
- **Characters**: see [Characters](#12-characters).
- **Party and server**: the party server's address, with *Save* and *Check
  now*. It is checked only on that click and after saving.
- **Developer**: developer mode, the example party, the sample fight, the
  changelog and the bug report.
- **Windows**: see [above](#16-windows-and-windows-of-their-own). App only.
- **Info**: version, the update notice (off by default; switched on it asks
  GitHub once per start for the newest version, GitHub sees your IP address and
  the time, nothing is downloaded or installed), *Show the tour* and *Notes on
  the areas*.

**Two typefaces.** Every window uses the same two: Anton for titles and numbers,
Source Sans 3 for text, names, paths and times. Both are under the SIL Open Font
License and built in; nothing is fetched from the internet. The licence texts
are in `licenses/`.

---

## 18. Developer mode: Weapons and Log setup

Settings › Developer › *Developer mode* shows tools for checking a log: the
*Weapons* and *Log setup* areas, the grouping *By weapon*, *Export CSV* and the
example party.

**Weapons.** Borometer reads your weapon pair from the selected fight: which
skill belongs to which weapon, it knows itself. If it is wrong, you choose by
hand here; the choice holds per character and survives a restart. Below it:
damage per weapon with share, DPS, hits and crit rate, what your build is
called, and whether every skill in the fight could be assigned to a weapon. A
second weapon counts as one from a **3 %** share.

**Log setup.** Borometer recognises the column roles by the shape of the data:
time, event type, skill, skill ID, damage, crit flag, heavy flag, hit kind,
attacker, target. If one is wrong, you switch it here; the numbers are
recalculated at once. Also the delimiter (comma, tab, semicolon, pipe) and
whether the first row carries column names. At the top it says what was
recognised: combat log version, row count, column count.

---

## 19. Keyboard

| Where | Key | What happens |
|---|---|---|
| everywhere | **Ctrl + +** / **Ctrl + −** / **Ctrl + 0** | interface bigger, smaller, back to 100 % |
| everywhere | **Ctrl+K** | opens the fight picker |
| everywhere | **Ctrl + ←** / **Ctrl + →** | previous, next fight |
| everywhere, also in the game | **Ctrl+Shift+D** | click-through on and off; from the full view straight into the overlay |
| compact window | **Ctrl+Shift+W** | switches between Fight and Weeklies |
| everywhere | **Esc** | closes the topmost thing: menu, dialog, filter, fight picker; in the compact window only after that, and there twice until the full view comes |
| very first | **Tab** | a skip link leads past the toolbar straight to the content |
| toolbar | **← → ↑ ↓** | to the next area, wrapping |
| | **Home / End** | first, last |
| fight picker | **↑ ↓** | through the fights |
| | **Home / End** | first, last |
| | **→** | open a folded block, otherwise one row on |
| | **←** | close an open block, otherwise to the heading above |
| | **Enter** | opens the fight |
| | **a letter** | jumps to the next name starting with it |
| list in Fight | **↑ ↓** | through the rows, expanded ones included |
| | **→ ←** | expand and fold a row |
| | **Shift+F10** / menu key | the row's Windows menu |
| | **Ctrl+C** | copy skill and value |
| Rotation, timeline | **Ctrl + mouse wheel** | zoom; from the keyboard through the − / + buttons and then the arrow keys |
| Weeklies | **arrow keys**, **space** | move between cells, tick |
| | **Shift + click** | counts ten |

---

## 20. What gets written to disk

| Where | What |
|---|---|
| `%APPDATA%\Borometer\boro-config.json` | the settings |
| `%APPDATA%\Borometer\boro-best.json` | the best pulls |
| `%APPDATA%\Borometer\boro-weeklies.json` | the Weeklies |
| `%APPDATA%\Borometer\boro-gilde.json` | the guild |
| `%APPDATA%\Borometer\boro-gilde-online.json` | Guild online, when it is switched on |
| `%APPDATA%\Borometer\archiv\` | the copies of boss fights |
| `%APPDATA%\Borometer\sicherungen\` | the backup before every permanent deletion |
| `Logs\` next to the exe | what you save yourself |
| `Party-Logs\` next to the exe | saved party logs |
| `Bug-Reports\` next to the exe | bug reports |

The last three folders are created only when you first save such a file. "Next
to the exe" applies to the portable builds; for the installed one they are under
`Documents\Borometer`. The window itself (Chromium) also keeps its storage under
`%APPDATA%\Borometer\electron`. **Borometer never writes into the game's combat
log folder.** `npm run audit:safety` checks exactly that, mechanically, on every
change.

Borometer deletes nothing on its own. Only what you detached yourself is removed
for good, only from the list of detached items, only after you type the name and
only once Borometer has put a backup into `sicherungen`. Active entries, history,
logs and best pulls stay undeletable.
