# Fremdes Material in Borometer

English: [README.en.md](README.en.md)

Borometer selbst steht unter der GPL v3; der Text liegt in [`../LICENSE`](../LICENSE).
Dieses Verzeichnis sammelt, was von anderen stammt und **eigenen** Bedingungen
unterliegt. Die Angaben sind aus den Dateien selbst gelesen, nicht abgeschrieben.

---

## Schriften: SIL Open Font License 1.1

Der Lizenztext liegt in [`OFL-1.1.txt`](OFL-1.1.txt). In `src/renderer/styles.css` (und damit in der gebauten `boro-meter.html`) sind fünf
Ausschnitte (U+0000 bis U+00FF) als WOFF2 eingebettet. Die Vermerke stehen so in der
Namenstabelle der eingebetteten Schnitte:

| Familie | Urhebervermerk |
|---|---|
| Archivo Black | Copyright 2017 The Archivo Black Project Authors (https://github.com/Omnibus-Type/ArchivoBlack) |
| IBM Plex Sans Condensed (Regular, Medium, SemiBold) | Copyright 2019 IBM Corp. All rights reserved. |
| IBM Plex Mono | Copyright 2017 IBM Corp. All rights reserved. |

Die OFL ist mit der GPL verträglich: die Schriften behalten ihre eigene Lizenz und
färben nicht auf das Programm ab. Weitergeben darf man sie, solange dieser
Lizenztext mitgeht. Deshalb liegt er hier.

---

## Bibliotheken im gebauten Programm

Nicht in diesem Verzeichnis, sondern erst beim Bauen dazugeholt. Der Vollständigkeit
halber, weil sie in der ausgelieferten `.exe` stecken:

| | Lizenz |
|---|---|
| Electron | MIT |
| Chromium | BSD und weitere; die vollständige Liste liegt dem gebauten Programm als `LICENSES.chromium.html` bei |
| Node.js | MIT |

---

## Spielgrafik: NICHT von der GPL erfasst

> **Achtung.** Die Release-Downloads (und die darin gebaute `boro-meter.html`) enthalten
> **Bilddateien aus Throne and Liberty**. Im öffentlichen Quelltext steht keine
> Spielgrafik; die Release-Downloads betten sie ein (Datei `assets/spielbilder.ts` im
> privaten Asset-Repo, beim Bauen eingesetzt). Ohne sie zeichnet die App eigene Marken.
>
> Was die Release-Downloads einbetten: 275 Fähigkeitssymbole aus dem Feed `getSkillSets` von questlog.gg (dazu „Fallende Blume“, WM_Common_SKILL_009, aus einem Bildschirmfoto von B0R0AK vom 01.10.2026),
> 34 Skillkern-Symbole von cdn.questlog.gg (28. und 30.09.2026) und 55 Gegnerbilder,
> 27 davon verkleinerte Bildschirmfotos (17 davon aus Bildschirmfotos von B0R0AK aus dem Spiel
> vom 03.10.2026, Kopf quadratisch ausgeschnitten, 96 × 96 WebP, zusammen 63,3 kB, rund 84 kB als Base64), eines (Vegamor als Ganzes, Bild `PT_NPC_M_Vagamont_Sprite` des NPC
> `FD_L13_AB_M_SpiritTree_Vagamont_001`) am 01.10.2026 von cdn.questlog.gg; zusammen mit den übrigen Symbolen
> rund 1,3 MB als Base64 (gezählt am 30.09.2026).
> Dazu seit dem 01.10.2026 für die Weeklies (ebenfalls in `assets/spielbilder.ts`;
> Neugestaltung „Wochenband“, später dazu Händler und Dimensionsprüfung):
> **19 Gegenstandssymbole** von cdn.questlog.gg
> (48 × 48 WebP, je mit ID und Pfad unter `throne-and-liberty/assets/` als Herkunft)
> und **4 Bossbilder** des Raids (Dragaryle, Zairos und Calanthia aus Bildschirmfotos
> von B0R0AK aus dem Spiel vom 01.10.2026, Radeth aus einem Bildschirmfoto von B0R0AK
> vom 02.10.2026, gezeigt in den Rekorden und im Meter), ausgeschnitten und verkleinert
> (96 × 96 WebP); zusammen 56,6 kB, rund 77 kB als Base64. Halle der Illusionen, Portal der
> Unendlichkeit, das Regionszertifikat und die Dungeons der Dimensionsprüfung tragen
> eigene gezeichnete Marken, kein Spielbild.
>
> **Diese Bilder gehören dem Rechteinhaber des Spiels und stehen nicht unter der
> GPL.** Die GPL dieses Projekts erfasst sie nicht und kann sie nicht erfassen:
> niemand kann Rechte weitergeben, die er nicht hat.

Amazons Content Usage Policy erlaubt, Spielinhalte für **kostenlose,
nichtkommerzielle** Inhalte der Spielgemeinschaft zu verwenden:
https://www.playthroneandliberty.com/en-us/forward-link?id=content-usage
Offen war, ob die Terms of Use, Abschnitt 4.2 c (keine Weitergabe von
Spielinhalten als eigenständige Dateien), die eingebetteten Tabellen oben treffen.

**Antwort von Amazon Games (02.10.2026)** auf die Anfrage von B0R0AK, die Skill-, Boss-
und Gegenstandssymbole in Borometer zu zeigen (zusammengefasst; Amazon betont,
dass das keine Rechts- oder Finanzberatung ist):

- Ein kostenloses, nichtkommerzielles Fan-Tool ist nach der Content Usage Policy
  grundsätzlich erlaubt, wenn es geschmackvoll bleibt, der Gemeinschaft nützt und
  die Spielinhalte nicht kommerziell nutzt. Kostenlose Fan-Webseiten und -Apps
  sind gedeckt.
- Es muss kostenlos bleiben: keine Bezahlinhalte, keine bezahlten Apps, keine
  anderen Einnahmen (ausgenommen begrenzte Werbung, Sponsoring oder Abos auf
  zugelassenen Plattformen wie Twitch oder YouTube).
- Es darf kein Mod und kein neues Spiel sein, keine Billigung durch Amazon
  andeuten, keine Gesetze oder Rechte Dritter verletzen und kein anstößiges
  Bildmaterial verwenden.
- Eine Combat-Log-App, die Skill-, Boss- und Gegenstandssymbole zeigt, erscheint
  mit der Policy vereinbar, solange sie erkennbar ein Fanprojekt bleibt und nicht
  anderweitig untersagt ist.

Die E-Mail liegt bei B0R0AK. **Was daraus für Borometer folgt:** kostenlos, ohne
Werbung und Spenden bleiben; überall „not affiliated with NCSOFT or Amazon Games“
stehen lassen; nichts ins Spiel eingreifen (kein Mod); die Bilder nur in der App
neben dem passenden Namen zeigen, verkleinert und sonst unverändert, nie als
einzelne Dateien anbieten und nie für Werbung nutzen. Falls sich die Lage ändert, kommt die App
weiter ohne die Bilder aus: `skillMark()` zeichnet an jeder Stelle, an der ein Bild
fehlt, eine eigene Marke.

Viele der Bilder stammen aus dem Feed oder vom CDN von questlog.gg. Die Bilder
gehören dem Rechteinhaber des Spiels, nicht Questlog. Von Questlog speichert
Borometer nur IDs, Stufen und Zahlen, dazu die Bilder oben; Namen von Questlog
speichert es nicht (Nutzungsbedingungen von Questlog, 3.4). Einzige Ausnahme: die
Namen der Ausrüstungsteile in einem gespeicherten Plan.

---

## Fremdsymbole: nicht Spielgrafik, nicht unter der GPL

| Symbol | Herkunft | Lizenz |
|---|---|---|
| Übungspuppe (`fremd:target-practice` in `assets/spielbilder.ts`) | „Target practice“ von juicy_fish auf Flaticon, Stil „Juicy Fish Outline“, https://www.flaticon.com/free-icon/target-practice_5773977; von B0R0AK bereitgestellt am 01.10.2026, auf 96 px als WebP verkleinert | [Flaticon License](https://www.flaticon.com/legal): frei für private und kommerzielle Nutzung, **Namensnennung Pflicht** |

Die Namensnennung, wie Flaticon sie verlangt:

> Target practice icons created by juicy_fish - Flaticon, https://www.flaticon.com/free-icons/target-practice

Sie steht auch neben dem Bild im Code und in der App unter Einstellungen › Info.
Die GPL dieses Projekts erfasst das Symbol nicht.
Die Flaticon License erlaubt nicht, das Symbol als einzelne Datei weiterzugeben. Es liegt darum wie die Spielgrafik im privaten Asset-Repo und steckt nur eingebettet in den Release-Downloads; der öffentliche Quelltext enthält es nicht. Borometer holt nichts beim Start.

---

## Bildschirmfotos unter `docs/bilder/`

Aufnahmen der eigenen Oberfläche, in denen Spielsymbole vorkommen. Das ist etwas
anderes, als die Bilddateien selbst auszuliefern, und für ein README üblich.
