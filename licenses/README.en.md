# Third-party material in Borometer

Deutsch: [README.md](README.md)

Borometer itself is licensed under the GPL v3; the text is in [`../LICENSE`](../LICENSE).
This folder collects what comes from others and is under **its own** terms. The
details are read from the files themselves, not copied from elsewhere.

---

## Fonts: SIL Open Font License 1.1

The licence text is in [`OFL-1.1.txt`](OFL-1.1.txt). `src/renderer/styles.css` (and with it the built `boro-meter.html`) embeds five
subsets (U+0000 to U+00FF) as WOFF2. The notices read like this in the name table of
the embedded faces:

| Family | Copyright notice |
|---|---|
| Archivo Black | Copyright 2017 The Archivo Black Project Authors (https://github.com/Omnibus-Type/ArchivoBlack) |
| IBM Plex Sans Condensed (Regular, Medium, SemiBold) | Copyright 2019 IBM Corp. All rights reserved. |
| IBM Plex Mono | Copyright 2017 IBM Corp. All rights reserved. |

The OFL is compatible with the GPL: the fonts keep their own licence and do not
rub off on the program. They may be passed on as long as this licence text goes
with them, which is why it is here.

---

## Libraries in the built program

Not in this folder; they are fetched only when building. Listed for completeness,
because they are inside the shipped `.exe`:

| | Licence |
|---|---|
| Electron | MIT |
| Chromium | BSD and others; the full list comes with the built program as `LICENSES.chromium.html` |
| Node.js | MIT |

---

## Game images: NOT covered by the GPL

> **Note.** Release builds embed game icons; the source does not. The release
> downloads (and the `boro-meter.html` built into them) contain **image files from
> Throne and Liberty**. They come from the file `assets/spielbilder.ts` in the private
> asset repository and are put in when building. Without it the app draws its own
> marks.
>
> What the release downloads embed: 275 skill icons from questlog.gg's `getSkillSets`
> feed (plus "Falling Flower", WM_Common_SKILL_009, from a screenshot by B0R0AK of
> 01.10.2026), 34 skill core icons from cdn.questlog.gg (28 and 30.09.2026) and 38
> enemy images, ten of them reduced screenshots, one (Vegamor as a whole, image
> `PT_NPC_M_Vagamont_Sprite` of the NPC `FD_L13_AB_M_SpiritTree_Vagamont_001`) from
> cdn.questlog.gg on 01.10.2026; together with the other icons about 1.3 MB as
> Base64 (counted on 30.09.2026).
> In addition, since 01.10.2026, for the weeklies (also in `assets/spielbilder.ts`;
> "Wochenband" redesign, later with merchants and the dimensional trial):
> **19 item icons** from cdn.questlog.gg
> (48 × 48 WebP, each with its id and path under `throne-and-liberty/assets/` as origin)
> and **4 boss images** of the raid (Dragaryle, Zairos and Calanthia from screenshots
> by B0R0AK from the game of 01.10.2026, Radeth from a screenshot by B0R0AK of
> 02.10.2026, shown in the records), cut out and reduced (96 × 96 WebP); together
> 56.6 kB, about 77 kB as Base64. The Hall of Illusions, the Infinity Portal, the
> region certificate and the dungeons of the dimensional trial carry drawn marks of
> their own, no game image.
>
> **These images belong to the rights holder of the game and are not under the
> GPL.** This project's GPL does not and cannot cover them: nobody can pass on
> rights they do not have.

Amazon's Content Usage Policy allows game content to be used for **free,
non-commercial** content for the game community:
https://www.playthroneandliberty.com/en-us/forward-link?id=content-usage
The open question was whether the Terms of Use, section 4.2 c (no distribution of
game content as standalone files), apply to the embedded tables above.

**Answer from Amazon Games (02.10.2026)** to B0R0AK's request to show the skill,
boss and item icons in Borometer (summarised; Amazon stresses that this is not legal
or financial advice):

- A free, non-commercial fan tool is in principle allowed under the Content Usage
  Policy if it stays tasteful, benefits the community and does not use the game
  content commercially. Free fan websites and apps are covered.
- It must stay free: no paid content, no paid apps, no other revenue (except
  limited advertising, sponsorship or subscriptions on approved platforms such as
  Twitch or YouTube).
- It must not be a mod or a new game, must not imply endorsement by Amazon, must
  not break laws or third-party rights and must not use offensive imagery.
- A combat log app that shows skill, boss and item icons appears consistent with
  the policy as long as it stays recognisably a fan project and is not otherwise
  prohibited.

B0R0AK keeps the e-mail. **What follows for Borometer:** stay free, without ads and
donations; keep "not affiliated with NCSOFT or Amazon Games" everywhere; never
reach into the game (no mod); show the images only in the app beside the matching
name, reduced and otherwise unchanged, never offer them as separate files and never
use them for advertising. Should the situation change, the app still works without the images: `skillMark()`
draws a mark of its own wherever an image is missing.

Many of the images come from questlog.gg's feed or CDN. The images belong to the
rights holder of the game, not to Questlog. From Questlog, Borometer stores only
ids, levels and numbers, plus the images above; it does not store names from
Questlog (Questlog's terms of use, 3.4). The one exception: the names of the gear
pieces in a saved plan.

---

## Third-party icons: not game images, not under the GPL

| Icon | Origin | Licence |
|---|---|---|
| Practice dummy (`fremd:target-practice` in `assets/spielbilder.ts`) | "Target practice" by juicy_fish on Flaticon, style "Juicy Fish Outline", https://www.flaticon.com/free-icon/target-practice_5773977; provided by B0R0AK on 01.10.2026, reduced to 96 px as WebP | [Flaticon License](https://www.flaticon.com/legal): free for personal and commercial use, **attribution required** |

The attribution, as Flaticon asks for it:

> Target practice icons created by juicy_fish - Flaticon, https://www.flaticon.com/free-icons/target-practice

It also stands beside the image in the code and in the app under Settings › Info.
This project's GPL does not cover the icon.
The Flaticon License does not allow passing the icon on as a separate file. So, like
the game images, it lives in the private asset repository and is only embedded in
the release downloads; the public source does not contain it. Borometer fetches
nothing at start.

---

## Screenshots in `docs/bilder/`

Pictures of Borometer's own interface in which game icons appear. That is something
other than shipping the image files themselves, and usual for a README.
