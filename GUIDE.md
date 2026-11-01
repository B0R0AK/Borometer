# Borometer: was alles drinsteckt

Die Kurzfassung steht in der [README](README.de.md). Hier steht alles der Reihe
nach: jeder Bereich, jeder Knopf, und wo eine Zahl herkommt. Stand: Version 2.0.

*[English version: GUIDE.en.md](GUIDE.en.md)*

---

## Inhalt

1. [Kämpfe hereinbekommen](#1-kämpfe-hereinbekommen)
2. [Der Rahmen: Symbolleiste, Titelleiste, Statusleiste](#2-der-rahmen-symbolleiste-titelleiste-statusleiste)
3. [Die Kampfwahl](#3-die-kampfwahl)
4. [Kampf](#4-kampf)
5. [Rotation und Zeitverlauf](#5-rotation-und-zeitverlauf)
6. [Analyse und Werkbank](#6-analyse-und-werkbank)
7. [Vergleich](#7-vergleich)
8. [Verlauf](#8-verlauf)
9. [Rekorde](#9-rekorde)
10. [Archiv der Bosskämpfe](#10-archiv-der-bosskämpfe)
11. [Weeklies](#11-weeklies)
12. [Charaktere](#12-charaktere)
13. [Gruppe](#13-gruppe)
14. [Gilde](#14-gilde)
15. [Kompakt](#15-kompakt)
16. [Windows und eigene Fenster](#16-windows-und-eigene-fenster)
17. [Einstellungen](#17-einstellungen)
18. [Entwicklermodus: Waffen und Log-Einrichtung](#18-entwicklermodus-waffen-und-log-einrichtung)
19. [Tastatur](#19-tastatur)
20. [Was auf die Platte geschrieben wird](#20-was-auf-die-platte-geschrieben-wird)

---

## 1. Kämpfe hereinbekommen

**Live-Aufzeichnung.** Der Umschalter oben in der Titelleiste: **Live aus**,
nach dem Klick **Live** (auf der Startseite **Live-Aufzeichnung starten**); ein
zweiter Klick beendet sie. Ab dem Klick schaut Borometer alle zwei Sekunden
nach einer neueren Datei im Log-Ordner. Ein Pull erscheint kurz nach dem
Kampf, nicht währenddessen, weil das Spiel das Log erst beim Kampfende
schreibt. **Von allein lädt Borometer nie etwas**, auch keinen Kampf, der schon
im Ordner liegt.

**Den Log-Ordner** unter `%LOCALAPPDATA%\TL\Saved\CombatLogs` findet Borometer
von selbst. Findet es ihn nicht, sagt die Startseite das und bietet **Ordner
wählen** an; danach ist er gemerkt. Ändern lässt er sich unter Einstellungen ›
Log-Ordner.

**Log öffnen.** Der Knopf in der Titelleiste öffnet ein kleines Menü mit den
zwei Sorten Datei: *Throne-Logs laden* für die Rohdateien des Spiels,
*Gruppen-Logs laden* für das, was jemand aus einer Gruppe gespeichert hat. Auf
der Startseite steht dieselbe Wahl als Ablagefläche („Log hierher ziehen“) und
als Liste *Zuletzt geöffnet*. Ist noch kein Log geladen, öffnet ein Klick auf
die Kampfwahl in der Mitte der Titelleiste den Dialog zum Laden. Liegt ein Log
nicht mehr im Ordner, fällt **Log öffnen** in den Rekorden auf das
[Archiv](#10-archiv-der-bosskämpfe) zurück.

**Beispiel.** Die Startseite bietet *Beispielkampf ansehen*; unter Einstellungen
› Entwickler gibt es dasselbe als *Laden*. Zwei Kämpfe, damit man die App
ansehen kann, ohne selbst gespielt zu haben. Die Bilder in der README zeigen
genau diese zwei.

**Im Browser** statt in der Exe: Log-Datei ins Fenster ziehen, oder **Live aus**
klicken und den Log-Ordner wählen (setzt Chrome oder Edge voraus). Archiv,
Gruppe und die eigenen Fenster gibt es nur in der App.

**Rundgang und Hinweise.** Beim ersten Start fragt Borometer, ob du den
Rundgang sehen willst: sechs kurze Schritte (Log-Ordner, Live, Kampfwahl,
Kompakt, Weeklies, Fehler melden). Außerdem steht beim ersten Besuch eines
Bereichs eine Zeile da, was er tut. Beides lässt sich unter Einstellungen ›
Info wiederholen oder abschalten.

---

## 2. Der Rahmen: Symbolleiste, Titelleiste, Statusleiste

**Die Symbolleiste links** hält die Bereiche, jeweils mit Symbol und einer
Blase beim Zeigen: *Kampf*, *Rotation*, *Analyse*, *Vergleich*, *Verlauf*,
*Gruppe*, darunter *Weeklies*, *Gilde*, *Rekorde*, *Archiv*, *Start* und
*Einstellungen*. Ohne geladenen Kampf sind die Bereiche gesperrt, die einen
Kampf brauchen. Ein Punkt am Reiter *Kampf* zählt neue Kämpfe, die du noch
nicht angesehen hast. *Waffen* und *Log-Einrichtung* erscheinen nur im
[Entwicklermodus](#18-entwicklermodus-waffen-und-log-einrichtung).

**Die Titelleiste** trägt von links nach rechts den Namen mit der Version, in
der Mitte die [Kampfwahl](#3-die-kampfwahl) (mit Pfeilen zum vorigen und
nächsten Kampf), dann *Live*, *Log öffnen*, *Kompakt*, die Einstellungen und
die Fensterknöpfe. Auf Kampf, Rotation, Analyse und Vergleich steht
zusätzlich der Knopf *In eigenem Fenster* (siehe
[Windows und eigene Fenster](#16-windows-und-eigene-fenster)).

**Die Statusleiste unten** sagt, ob Live läuft, welche Datei zuletzt gelesen
wurde und wie viele Kämpfe heute dazukamen. Dazu steht dort „Nur gelesen:
nichts im Spiel“, die Größe der Oberfläche (ein Klick setzt sie auf 100 %
zurück), **Fehler melden** und, wenn der Update-Hinweis an ist und es eine neue
Version gibt, deren Nummer.

**Fehler melden** legt eine JSON-Datei im Ordner `Bug-Reports` an, mit Version,
Fenstergröße, wie die Spalten des Logs erkannt wurden, welche Fähigkeiten und
Trefferarten vorkamen und was zuletzt schiefging. Das Kampflog ist nicht dabei,
wohl aber der Pfad zur Einstellungsdatei und kurze Proben aus den Spalten, in
denen Namen stehen. Schau hinein, bevor du die Datei an ein Issue hängst.

---

## 3. Die Kampfwahl

Die Liste aller Kämpfe des geladenen Logs, in der Reihenfolge des Abends. Sie
öffnet sich aus der Mitte der Titelleiste oder mit **Strg+K**, schließt mit Esc
und hat ein Suchfeld für Boss, Ort, Uhrzeit und DPS.

**Blöcke.** Kämpfe, die zusammengehören, stehen unter einer Überschrift: ein
Dungeon-Lauf unter seinem Namen, ein Feldboss unter seinem. Die Überschrift
sagt, wie viele Kämpfe darin stecken, wie lange der Block insgesamt lief und
wie viel Schaden zusammenkam.

**Trash klappt weg.** In einem Dungeon stehen die Bosse einzeln, alles andere
zusammengefasst als ein Eintrag mit Anzahl. Ein Klick zeigt sie. An einem
Raid-Abend sind das vier sichtbare Zeilen statt achtzehn.

**Frühere Tage.** In der App stehen im Kopf der Liste zwei Pfeile zu den Tagen,
für die der Log-Ordner Dateien hat. Solange ein früherer Tag offen ist,
pausiert Live; *Heute* geht zurück.

**Bearbeiten** macht aus der Liste eine mit Griffen: jede Zeile bekommt ein ✕,
und ein Klick nimmt diesen Kampf heraus. Zwei Regeln gelten:

- Ein Kampf, zu dem die Gruppe gemeldet hat, trägt einen Anhänger und bleibt
  stehen.
- In einem **Gruppen-Log** geht gar nichts heraus, denn dort gehören die Zahlen
  nicht dir allein.

Entfernt heißt *aus der Ansicht genommen*, nicht gelöscht. Die Log-Datei wird
nie angefasst. **Leeren** nimmt alle Kämpfe aus der Ansicht; neun Sekunden lang
steht in der Meldung ein *Rückgängig*.

**Gespeicherte Kämpfe.** *Kampf speichern* legt den gerade gezeigten Kampf
beiseite, damit er einen Neustart und ein neues Log überlebt. *Gespeichert* am
Fuß der Liste klappt sie auf. Wer zwei bis vier davon (oder Kämpfe aus dem Log)
ankreuzt, nimmt sie mit *Vergleichen* in den [Vergleich](#7-vergleich) mit.

**Filter und Kampfdatei.** Am Fuß der Liste trennt der Filter Kämpfe und
blendet kurze aus: nach wie vielen Sekunden ohne Schaden ein neuer Kampf
beginnt und wie kurz ein Kampf höchstens sein darf, um ausgeblendet zu werden.
Dieselben Werte stehen unter Einstellungen › Log-Ordner, dort auch der
Schalter, der die Phasen eines Bosses verbindet, der zwischendurch nicht zu
treffen ist. Über den Filter speicherst du die gespeicherten Kämpfe als Datei
oder lädst sie wieder.

---

## 4. Kampf

Der Bereich *Kampf* zeigt den ausgewählten Kampf in vier Lagen.

**Die Kopfzeile.** Die große Zahl ist Schaden pro Sekunde. Geteilt wird durch
die Zeit, in der du wirklich am Ziel warst, nicht durch die Spanne von erstem
bis letztem Treffer. Bei einem Boss mit Zwischenphase sind das zwei
verschiedene Zahlen. Die Faktenzeile nennt, wessen Zahlen das sind, die Spanne,
die gekämpfte Zeit (nur wenn sie eine andere ist), den Gesamtschaden und die
Uhrzeit. Die gekämpfte Zeit steht dort, weil sie der Teiler der großen Zahl
ist; ohne sie geht die Rechnung nicht auf.

**Die Lesezeile** sagt in einem Satz, was passiert ist. Vier Regeln, von oben
nach unten geprüft, der erste Treffer wird gedruckt:

| | Wann | Was dasteht |
|---|---|---|
| 1 | unter 20 Treffer im ganzen Kampf | „Nur 10 Treffer im ganzen Kampf, für eine Aussage über Anteile zu wenig.“ |
| 2 | mindestens 5 s lang kein Treffer am Ziel | „Die Zahl oben teilt durch 1m 46s, 1m 9s lang war am Ziel nichts zu treffen.“ |
| 3 | eine Fähigkeit über 50 % des Schadens, aus mindestens 10 Treffern | „Verfluchter Alptraum trug 77,8 % des Schadens, 649 Treffer, 65 % davon kritisch.“ |
| 4 | sonst | „Stärkste Fähigkeit: Manasphärenausbruch mit 28,7 %, der Rest verteilt sich auf 8 weitere.“ |

Die Trefferschwelle in Regel 3 ist der Punkt: 76 % aus drei Treffern ist
Zufall und kein Befund.

**Die Urteilszeile** ordnet die Zahl ein, wenn es etwas zum Einordnen gibt:
„Deine beste von 3 Kämpfen“ oder „39 % schlechter als sonst“. Sie sagt dabei,
woher sie das weiß: *an diesem Boss* meint alle Abende, die Borometer je
gesehen hat, *in diesem Log* nur den heutigen.

**Der Glutring.** Der Kampf steht als Ring da. Jeder Bogen ist eine Fähigkeit,
so groß wie ihr Schaden, in der Mitte steht die große Zahl, und der Außenrand
zeigt, wie sich die Trefferarten verteilen (normal, kritisch, stark, kritisch
stark, bei Schild auch Schild). Ein Klick auf einen Bogen klappt die Fähigkeit
in der Liste auf. In einer Gruppe zeigt der Ring die Mitglieder, ein Klick auf
eines öffnet dessen Ring, und *Gruppe* führt zurück. **Kampf nachspielen** lässt
die Fähigkeiten als Rennen gegeneinander laufen; ihre Balken wachsen mit dem
Schaden bis zu diesem Moment.

**Die Liste neben dem Ring** ordnet nach Schaden, Anteil oder DPS (der Kopf
*Ordnen* wählt es). Sie ist die Tabelle des Kampfs. Der Umschalter über ihr
wechselt, was eine Zeile ist:

| | Was eine Zeile ist |
|---|---|
| **Nach Fähigkeit** | ein Skill |
| **Ziele** | ein Gegner |
| **Angreifer** | eine Person im Log (nur wenn das Log mehrere hat) |
| **Gruppe** | ein Mitglied der laufenden Gruppe (nur mit Gruppe) |
| **Nach Waffe** | eine deiner beiden Waffen plus Passiv (nur im Entwicklermodus) |

Jede Zeile nennt Schaden, DPS, Anteil, Treffer, größten Treffer und die Quoten
für kritisch und stark. Bei Gleichstand entscheidet die Trefferzahl, damit eine
100-%-Quote aus zwei Einsätzen nicht über einer aus zweihundert steht.

**Aufklappen.** Der Pfeil an einer Zeile zeigt, woraus ihr Schaden besteht:
normal, kritisch, stark, kritisch stark. Jede Trefferart hat einen eigenen
Balken, einen eigenen Anteil und eine eigene Trefferzahl. Das `×2` daneben
sagt, dass diese Art im Schnitt doppelt so hart trifft wie ein normaler
Treffer derselben Fähigkeit. Zeilen, bei denen jeder Treffer gleich landete,
klappen nicht auf, denn da gibt es nichts zu zeigen. Die Quoten zählen nur
direkte Treffer, ohne Laufzeit und Passiv.

**Als Bild.** Der Knopf im Kopf macht aus dem Kampf oder der Gruppentafel ein
PNG, das du speichern oder in die Zwischenablage legen kannst. Das Bild entsteht
auf dem Rechner, hochgeladen wird nichts.

---

## 5. Rotation und Zeitverlauf

Beides steht im Bereich *Rotation* auf derselben Zeitachse, ein Einsatz also
genau über seiner Spur.

**Deine Einsätze.** Ein Symbol je Einsatz, in der Reihenfolge, in der du sie
gedrückt hast. Zwei Ansichten: *Leiste* mit Zeitachse und *Reihe* ohne, die
umbricht. Der Balken hinter einem Einsatz ist die Spanne, in der er noch
getroffen hat; eine Marke ohne Balken traf einmal. Der Text darüber sagt, wie
viele Einsätze im Bild stehen und wie lang die längste Pause zwischen zwei
Einsätzen der stärksten Fähigkeit war. Lücken in der Rotation sieht man hier
schneller als in jeder Tabelle. Abspielen geht, sobald der Kampf vorbei ist.

**Der Zeitverlauf.** Wie sich der Schaden über die Kampfzeit verteilt.

- Die Kurve ist Gesamtschaden je Sekunde, geglättet: *1 s (roh)*, *3 s* oder
  *5 s*, je größer, desto ruhiger die Linie.
- Die Spuren darunter: eine je Fähigkeit, jede auf ihrer eigenen Grundlinie.
  Unter *Spurmaßstab* skaliert *Je Spur* jede für sich, *Gemeinsam* alle auf
  denselben. Das erste zeigt den Rhythmus, das zweite die Größenordnung. Ein
  Klick auf einen Namen nimmt ihn aus der Kurve oben heraus.
- Das eingefasste Feld ist die **schwächste Stelle** des Kampfes. Eine erkannte
  Mechanik des Bosses ist schraffiert und zählt nicht als Lücke.

**Zoom.** **Strg + Mausrad** zoomt, die Leiste darunter zieht den Ausschnitt,
und über *Von / bis / Anwenden* lässt er sich auch eintippen. Mit der Tastatur
geht es über die Knöpfe − / + und die Pfeiltasten. Zoom und Ausschnitt gelten
für Einsätze und Zeitverlauf zugleich.

**Bei Bosskämpfen mit Gruppe** steht über beiden Bildern eine Reihe *Wessen*:
die anderen Mitglieder lassen sich mit ihrem Zeitverlauf und ihrer Rotation
ansehen.

---

## 6. Analyse und Werkbank

Sätze statt Summen, darunter eine Werkbank.

**Oben** steht ein Urteil, daneben die Kennzeile: DPS, Lücken, Einsätze je
Minute, wer den meisten Schaden macht, und das alles gegen deinen besten Pull
(ohne den: gegen den zweitbesten). Ein Pull zählt als derselbe, wenn du ihn mit
demselben Waffenpaar gespielt hast.

**Der Kampfstreifen.** Der Kampf läuft als ein Streifen über die ganze Breite,
mit einem Fach je Fähigkeit, so groß wie ihr Gewicht. Die Befunde hängen als
Fahnen über dem Streifen: jede Lücke, die schwächste Stelle, der Start, die
stärksten fünf Sekunden. Drückst du eine Fahne, erscheint ihr Satz, und die
Fächer, die dort nichts beigetragen haben, treten zurück. Jeder Einsatz ist ein
Strich in einer von vier Hitzestufen (normal, stark, kritisch, kritisch
stark), und dein bester Pull läuft als gestrichelte Kurve mit.

**Die Werkbank.** Jede Fähigkeit hat ein Fach und eine Zeile, die in einem Satz
sagt, was an ihr auffällt: eine Pause im eigenen Takt, weniger Einsätze als im
besten Pull, oder nur Zahl und Takt. Legende und Achse stehen darüber. Die
Quote für kritisch und stark zählt nur direkte Treffer, und die Seite nennt,
wie viele das waren. Lücken ab einer Mindestlänge sind mit ihrer Dauer
markiert.

**Weitere Befunde** darunter, als Liste:

- **Wie war der Rhythmus?** Die Art deiner Skillung (stoßweise oder
  gleichmäßig), die schwächsten drei Sekunden mit der Frage, was dort im
  Cooldown war, und die Leerzeit: wie lange gar nichts gedrückt wurde.
- **Wohin ging der Schaden?** Die stärkste Fähigkeit mit ihrem Anteil, und was
  ein einzelner Einsatz davon im Schnitt bringt, verglichen mit der
  zweitstärksten.
- **Auge von Ventius**, nur wenn die Fähigkeit vorkam. Der Pfeil, eine Sekunde
  später ein Nachbeben; jedes Nachbeben trifft bis zu dreimal. Wie viele ein
  Ziel überhaupt hergibt, ist seine **Größe**, deshalb steht die Obergrenze je
  Boss in einer Tabelle und ist nicht festgeschrieben. Trash steht nicht darin:
  er ist tot, bevor sich die Frage stellt. Dein bester Einsatz je Boss steht
  auch in den [Rekorden](#9-rekorde).
- **Wie gut waren die Treffer?** Krit-Rate und was sie am Schaden ausmacht,
  Fehlschläge (das Log schreibt sie als Treffer ohne Schaden, deshalb zählen sie
  in keiner anderen Zahl mit), starke Treffer und der größte Einzelschlag.

Der Fuß *Was das Log nicht weiß* sagt, was die Zahlen nicht belegen können,
etwa deine Ausrüstung: den Build erkennt Borometer nur an Waffen und
Fähigkeiten.

---

## 7. Vergleich

**Gegen den besten oder den letzten Pull.** Oben schaltest du zwischen
*Bester Pull* und *Letzter Pull* um (der letzte Pull ist der vorige Kampf am
selben Boss; gibt es keinen, ist der Knopf gesperrt und sagt warum). Daneben
stehen zwei große Zahlen, ein Satz mit der Summe der Zeilen, und jede
Fähigkeit mit „nur in diesem“ und „nur im besten“ als Balken zur Mitte, ohne
Rot und Grün. Darunter liegen zugeklappt *Rotation nebeneinander* und
*Direktvergleich und Waffe für Waffe*.

**Andere Kämpfe wählen.** Hake zwei bis vier Kämpfe an, aus dem geladenen Log
oder aus den gespeicherten, und starte den Vergleich von Hand. Was dann kommt:

- **Wer gewinnt**, auf DPS, und wie weit die anderen zurückliegen.
- **Woher der Unterschied kommt.** Fähigkeit für Fähigkeit, wie viel DPS sie
  gegenüber dem Vergleichskampf mehr oder weniger gebracht hat. Meist tragen
  zwei oder drei fast alles davon.
- **Direktvergleich** der Kennzahlen: DPS, Schaden, Länge, Treffer, Krit-Rate,
  Krit-Anteil am Schaden, Stark-Rate, Durchschnittstreffer, größter Treffer,
  Pausen. Was mit der Länge wächst, ist als solches markiert.
- **Schaden pro Sekunde, Fähigkeit für Fähigkeit** und dasselbe je Waffe.

Sind die Kämpfe verschieden lang, sagt Borometer das und bietet an, **beide auf
den kürzeren zu kürzen**. Ohne das vergleicht man Summen, die nur deshalb
größer sind, weil länger gekämpft wurde: DPS und die Raten sind vergleichbar,
Schaden, Treffer und Pausen nicht.

---

## 8. Verlauf

Je Boss deine Leistung über alle Abende. Oben steht das Diagramm über die Zeit:
die Punkte aller Kämpfe, der Median gestrichelt, der beste in Gold. Punkte aus
dem geladenen Log sind gefüllt, frühere und gespeicherte hohl. Der Zeitraum
(*Woche*, *Monat*, *Alles*) steht in der Kopfzeile. Darunter liegt die Liste
der Kämpfe mit Tag, Uhrzeit, Dauer und DPS und der Knopf *Im Vergleich öffnen*;
Zeile und Punkt wählen sich gegenseitig.

Der Verlauf füllt sich, während du spielst: Borometer merkt sich, was es selbst
gesehen hat. Nur Bosse, denn ein Übungsziel steht gar nicht darin: dort ist
jede Pause das Ende eines Versuchs und keine Leistung. Deutsche und englische
Schreibweisen desselben Gegners werden zusammengeführt. Aus diesem
Verzeichnis kommt auch die Urteilszeile in der Kopfzeile.

---

## 9. Rekorde

Borometer liest deine Logs einmal und führt ein Album: je Boss dein bester DPS,
dein stärkster Treffer mit der Fähigkeit, die ihn traf, und der Tag deines
ersten Kampfes. Bosse, gegen die du noch nicht gekämpft hast, stehen als leere
Umrisse da. Der Auge-von-Ventius-Rekord (dein bester Einsatz je Boss) steht
ebenfalls hier.

Mit [Charakteren](#12-charaktere) zählt eine Leiste über dem Album die Rekorde
als *Gesamt*, *Main*, *Twinks* und, wo Kämpfe keinem bekannten Charakter
gehören, *Unbekannt*. **Log öffnen** an einem Rekord holt den Kampf, auch aus
dem [Archiv](#10-archiv-der-bosskämpfe), wenn das Log nicht mehr da ist. Unter
Einstellungen › Log-Ordner liest *Rekorde neu einlesen* die 60 neuesten Logs
noch einmal; gelöscht wird dabei nichts.

---

## 10. Archiv der Bosskämpfe

Borometer legt von jedem Bosskampf, den es liest, eine Kopie im Ordner `archiv`
neben den Einstellungen ab, nur auf deinem PC. Dazu zählen Feldbosse,
Raidbosse, Dungeons, die Halle der Illusionen und die Übungspuppe; Trash und
Gruppensummen nicht. Löscht das Spiel später seine Logs, bleiben die Kopien.
Beim ersten Mal erklärt ein Hinweis auf der Startseite, was das Archiv tut, und
vor deiner Bestätigung wird nichts aufgenommen.

**Der Bereich *Archiv*** listet jeden bekannten Boss als Karte mit bestem DPS
und Zahl der Kämpfe, gegliedert wie die Rekorde und durchsuchbar nach deutschem
und englischem Namen. Ein Klick öffnet den Boss: die Punkte aller seiner Kämpfe
über die Zeit, den Median, den besten markiert, und darunter die Kämpfe selbst,
neueste zuerst. Ein Kampf öffnet sich aus dem Archiv, auch wenn sein Log nicht
mehr da ist.

**Einstellungen › Archiv.** *Bosskämpfe aufheben* schaltet das Archiv aus
(ausgeschaltet kommt nichts Neues dazu, was schon liegt, bleibt). *Archivordner
öffnen* zeigt den Ordner, eine Datei je Kampf. **Alte Logs einlesen** nimmt die
Kämpfe aus den Logs, die noch im Ordner des Spiels liegen, ins Archiv auf.

**Lösen und löschen.** Kämpfe, die du nicht mehr willst, lassen sich lösen,
einzeln oder mehrere, mit *Rückgängig*; sie verschwinden dann aus der Suche.
Endgültig löschen kannst du sie nur aus der Liste der gelösten Kämpfe: Du
tippst Boss und Datum ein (bei mehreren deren Anzahl), und Borometer legt
vorher die Kampfdateien samt Verzeichnis im Ordner `sicherungen` ab und prüft
die Kopie. Ist sie unvollständig, wird nichts gelöscht. Die Sicherung löscht
Borometer nie, aktive Kämpfe bleiben unlöschbar, und von sich aus löscht es
nichts.

---

## 11. Weeklies

Ein Reiter je Charakter, bis zu sechs: der Raid als Raster aus Flügeln und
Schwierigkeiten, das Geheimdungeon, Events, die Dimensionsprüfung und die
Händler, jeweils mit Zähler. Ein Band zeigt, wo die Woche steht und wann der
nächste Wochen-Reset (Donnerstag, 10:00 deutscher Zeit) und der nächste
tägliche Reset kommen. **Nichts davon wird aus dem Spiel gelesen; du hakst es
selbst ab.** Pro Charakter lassen sich Punkte ausblenden, umbenennen und eigene
anlegen (*Anpassen*); *Nur Offenes zeigen* blendet Erledigtes aus.

Ein Charakter, den du als [Main](#12-charaktere) markiert hast, steht vorn und
öffnet zuerst. Nicht mehr gebrauchte Charaktere werden gelöst, nicht gelöscht,
mit *Rückgängig*; unter *Gelöste* holst du sie zurück oder löschst sie endgültig,
nachdem du den Namen getippt hast und Borometer eine Sicherungsdatei in
`sicherungen` angelegt hat.

**Erinnerungen.** Eine Windows-Meldung zur gewählten Zeit, an gewählten
Wochentagen, auf Wunsch nur wenn noch etwas offen ist. Das geht nur, solange
Borometer läuft (Einstellungen › Windows: *Beim Schließen in den Infobereich*,
*Mit Windows starten*); verpasste Erinnerungen werden nicht nachgeholt. Im
Browser gibt es keine Windows-Meldung.

Die Weeklies stehen auch im [Kompaktfenster](#15-kompakt).

---

## 12. Charaktere

Einstellungen › Charaktere führt die Charaktere aus den Weeklies. Zu jedem
trägst du den **Lognamen** ein, den Angreifernamen genau so, wie das Log ihn
schreibt. Einen davon markierst du als **Main**. Borometer weiß dann, welcher
Charakter welchen Kampf bestritten hat, und die [Rekorde](#9-rekorde) sagen,
wer welchen hält. Der Verlauf merkt sich nur eine Kennung des Charakters, nie
den Namen. Ohne Lognamen bleiben die Rekorde, wie sie waren.

---

## 13. Gruppe

Jeder schickt seinen neuesten Kampf, alle sehen eine gemeinsame, sortierte
Tafel mit Klasse und Rolle neben jedem Namen, etwa Orakel · Heiler oder
Kreuzritter · Tank. Die Zeilen klappen zwei Ebenen tief auf: erst die
Fähigkeiten, dann ihre Trefferarten. Im Reiter *Gruppe* wählst du unter *Wo die
Gruppe läuft*:

1. **Eigener Server.** Läuft im Clan schon ein Server (der häufigste Fall),
   trägst du seine Adresse einmal unter Einstellungen › Gruppe und Server ins
   Feld **Server-Adresse** ein und drückst **Speichern**. Danach reicht der
   Vier-Zeichen-Code, den jemand herumgibt. Eine Adresse mit `https://` ist
   verschlüsselt; bei einer ohne warnt Borometer.
2. **Auf diesem PC.** Charakternamen eintippen, *Gruppe starten*. Du bekommst
   einen Code samt Adresse, etwa `AB7K@192.168.1.20:8732`, ohne 0, O, 1 und I,
   damit sich beim Vorlesen nichts verwechselt. Im selben Netz läuft das ohne
   Weiteres; übers Internet muss der Host erreichbar sein. Während des Hostens
   öffnet Borometer einen zweiten Port, der ausschließlich Gruppenverkehr
   beantwortet. Logs und Einstellungen sind darüber nicht erreichbar, jede
   Anfrage ohne den aktuellen Code wird abgewiesen, und *Gruppe schließen*
   schließt den Port.
3. **Öffentlicher Server.** Der Gästeserver `https://guest.borometer.de` für
   alle, die keinen Server haben. *Diesen Server verwenden* speichert die
   Adresse; erst dieser Klick tut das, davor fragt Borometer nichts an. Ist
   zu viel los, kann er abgeschaltet sein, und Borometer zeigt, dass nichts
   antwortet. Dass er immer läuft, ist nicht zugesagt. Ein Raum ist 30
   Minuten nach dem Weggang des letzten Mitglieds weg, spätestens nach 12
   Stunden. Eine Gruppe, auf die es ankommt, gehört auf einen eigenen Server.

Ein **eigener kleiner Server** liegt in [`BoroPartyServer/`](BoroPartyServer/),
damit die Gruppe nicht daran hängt, dass ein bestimmter PC an bleibt.

**Klickst du in der Kampfwahl einen Bosskampf an**, steht dazu die ganze Gruppe
da: jeder mit seinem eigenen Kampf gegen diesen Boss. *Gruppen-Log speichern*
legt alle Bosskämpfe des geladenen Logs ab, nicht nur den Augenblick, in dem du
gedrückt hast.

---

## 14. Gilde

Für Gildenleitungen. Vier Reiter:

- **Mitglieder**: die Liste mit Waffen und Rolle.
- **Termine**: Termine, die sich wiederholen, mit Anwesenheit je Termin (da,
  nicht da, entschuldigt).
- **Auswertung**: Quote und Serie je Mitglied, ohne Farben und ohne Ränge.
- **Punkte**: ab Werk aus. Eingeschaltet führt Borometer je Mitglied ein Konto
  aus aktiven Monaten, Gildenbossen und Raids, Ansehen in der Gilde und
  Zusatzpunkten von Hand. Die *Regeln* lassen sich ändern (jede Gilde darf
  anders rechnen), eigene Arten von Punkten lassen sich anlegen, Mitglieder
  lassen sich auf *Inaktiv* setzen (sie sammeln dann keine Monate und stehen
  bei den Terminen nicht in der Liste), und die Punkte lassen sich aus einer
  Tabelle einlesen oder als Text kopieren.

Solange du nichts anderes einstellst, liegt die Gilde in `boro-gilde.json` auf
deinem PC, und nichts wird gesendet.

**Gilde online.** Eine Gildenleitung kann das einschalten. Die Liste liegt dann
auf einem Server unter einer `https://`-Adresse, die die Leitung selbst
einträgt. Mitglieder treten mit Code oder Link bei und sehen die Liste, ohne
sie ändern zu können. Der Betreiber dieses Servers kann alles lesen, was dort
liegt; das sagt die Einrichtung, bevor die Gilde angelegt wird. Borometer sendet
nur an die Adresse, die die Leitung selbst eingetragen hat, nie an eine aus
einem Link oder einer Datei.

**Lösen und löschen.** Eine Gilde, die niemand mehr braucht, wird gelöst, nicht
gelöscht: *Gilde lösen…* verlangt den Namen der Gilde, Mitglieder, Termine und
Punkte bleiben in der Datei, und unter *Gelöste Gilden* holst du sie zurück. Aus
der Liste der gelösten Gilden, Mitglieder und Arten kannst du endgültig löschen,
nachdem du den Namen getippt hast und Borometer eine Sicherungsdatei in
`sicherungen` angelegt hat.

---

## 15. Kompakt

Der Knopf *Kompakt* oben. In der App öffnet er ein eigenes Fenster, einen
flachen Streifen für den zweiten Monitor oder über das Spiel gelegt; die
Vollansicht bleibt daneben stehen. Es ist ein normales Windows-Fenster über dem
Spiel, kein Overlay im Spiel, und Borometer fasst das Spiel nicht an. Es bleibt
nur über Throne and Liberty, wenn das Spiel im randlosen Fenster läuft (im Spiel
unter Einstellungen › Grafik › Anzeigemodus).

- **Zwei Reiter**, *Kampf* und *Weeklies*, wechseln die Ansicht; auch
  **Strg+Umschalt+W** tut das.
- **Kampf**: links die große DPS-Zahl, darunter der Vergleich zum letzten Pull,
  rechts Boss, Uhrzeit und Dauer. Eine Kante links steht voll, solange Live
  läuft. Die Fähigkeiten zeigen fünf Zeilen und rollen mit dem Mausrad; der
  Knopf darunter öffnet die ganze Liste, und das Fenster wächst mit. Mit
  einer Gruppe schaltet *Ich* / *Gruppe* um, wessen Zahlen es sind.
- **Weeklies**: die Punkte deines Mains (mit *Charakter wechseln* ein anderer),
  der Reset und ein Punkt am Reiter, wenn eine Erinnerung fällig ist. Im
  Durchklick sind sie nur zu lesen.
- Anfassen lässt sich das Fenster an der ganzen Kopfzeile. Kleiner als die
  Leiste und die erste Zeile lässt es sich nicht ziehen.
- **Durchsichtig** in ganzen Schritten von 0 bis 55 % (Einstellungen › Overlay
  oder das Menü des Streifens). Unter Linux gibt es das nicht.
- **Über dem Spiel halten**, damit das Spiel ihn nicht verdeckt.
- **Durchklick** mit **Strg+Umschalt+D**: Klicks gehen durch das Fenster ins
  Spiel, nochmal drücken holt es zurück. Aus der Vollansicht macht das Kürzel
  das ganze Overlay auf einmal: kompakt, oben, durchklickbar. Ist das Kürzel
  von einem anderen Programm belegt, steht das im Menü.
- Ein Wort sagt, ob aufgezeichnet wird, nicht nur ein Punkt.
- **Esc** führt zurück: das erste sagt, dass ein zweites die Vollansicht
  öffnet, das zweite innerhalb von zwei Sekunden tut es. Liegt etwas darüber
  (das Menü, ein Dialog), schließt Esc erst das.

Welche Kämpfe der Streifen zeigt, entscheidet er selbst aus dem Log-Ordner. Ein
Kampf aus dem Archiv, dem Beispiel oder einer hineingezogenen Datei steht nur in
der Vollansicht; der Streifen sagt das in einem Wort.

---

## 16. Windows und eigene Fenster

**Das Windows-Menü.** Rechtsklick, Umschalt+F10 oder die Menütaste auf einer
Zeile der Schadenstafel öffnet ein Menü am Mauszeiger, in der Sprache der
Oberfläche. *Kopieren* legt Fähigkeit und Wert in die Zwischenablage (Strg+C
auf der fokussierten Zeile tut dasselbe), *In Rotation zeigen* springt in die
Rotation und hebt die Fähigkeit hervor.

**Eigenes Fenster.** Im Kopf von Kampf, Rotation, Analyse und Vergleich legt
der Knopf *In eigenem Fenster* den Bereich in ein Fenster, zum Beispiel für den
zweiten Monitor. Es gibt höchstens ein solches Fenster; es folgt dem Kampf der
Vollansicht, schreibt nichts und schließt mit ihr. Im Kompaktfenster und im
Browser gibt es weder Menü noch Knopf.

**Einstellungen › Windows** (nur in der App) hat vier Schalter:

- *Nach jedem Kampf melden*: eine Windows-Meldung mit dem Ergebnis, wenn
  Borometer nicht vorn ist (ab Werk aus). Dazu *Nur bei neuem Bestwert*, damit
  sie schweigt, außer der Kampf schlägt deinen besten Pull.
- *Beim Schließen in den Infobereich*: Schließen verbirgt das Fenster, die
  Live-Aufzeichnung läuft weiter. Beenden geht über das Menü des Symbols.
- *Mit Windows starten*: öffnet minimiert, wenn du dich anmeldest (ab Werk aus).

Ohne Schalter kommen zwei Dinge dazu: eine Sprungliste am Taskleistensymbol der
installierten Fassung mit den zuletzt gelesenen Logs, und ein Fortschrittsbalken
im Taskleistensymbol, solange ein großes Log geladen wird.

---

## 17. Einstellungen

Einstellungen wirken sofort. Links stehen die Abschnitte:

- **Darstellung**: das Thema. Es gibt **vier**: *Dunkel*, *Hell*, *TnL* (in den
  Farben des Spiels) und *Rauchglas*, das unter Windows 11 verwischt
  durchscheinen lässt, was hinter dem Fenster liegt (anderswo steht es auf
  deckendem Rauchgrau). *Auto* ist kein fünftes Thema, es übernimmt die
  Einstellung von Windows (hell oder dunkel). Der Kontrast ist bei allen vier
  durchgemessen.
- **Sprache**: Deutsch oder Englisch. Jede Beschriftung gibt es in beiden.
- **Größe**: die Oberfläche von 10 bis 200 %. Strg + Plus, Strg + Minus und
  Strg+0 tun dasselbe. Das Fenster der Vollansicht lässt sich weder ziehen
  noch maximieren. Seine Größe richtet sich allein nach dieser Einstellung: Es
  wächst und schrumpft mit, höchstens so groß wie der Bildschirm (ohne
  Taskleiste). Wer mehr oder weniger auf dem Bildschirm sehen will, stellt sie
  hier. Fenster, die du aus einem Bereich abreißt, lassen sich ziehen und
  maximieren.
- **Overlay**: Durchsicht, das Kürzel für den Durchklick, *Über dem Spiel halten* und
  *Overlay ansehen*. Nur in der App.
- **Log-Ordner**: der Kampflog-Ordner, Live-Aufzeichnung, die Regeln für das
  Trennen der Kämpfe (siehe [Die Kampfwahl](#3-die-kampfwahl)), das Speichern
  und Laden der Kampfdatei und *Rekorde neu einlesen*.
- **Archiv**: siehe [Archiv der Bosskämpfe](#10-archiv-der-bosskämpfe).
- **Charaktere**: siehe [Charaktere](#12-charaktere).
- **Gruppe und Server**: die Adresse des Gruppen-Servers, mit *Speichern* und
  *Jetzt prüfen*. Geprüft wird nur auf diesen Klick und nach dem Speichern.
- **Entwickler**: der Entwicklermodus, die Beispielgruppe, der Beispielkampf,
  das Änderungsprotokoll und der Fehlerbericht.
- **Windows**: siehe [oben](#16-windows-und-eigene-fenster). Nur in der App.
- **Info**: Version, der Update-Hinweis (ab Werk aus; eingeschaltet fragt er
  einmal je Start bei GitHub nach der neuesten Version, GitHub sieht dabei
  deine IP-Adresse und die Uhrzeit, geladen oder installiert wird nichts),
  *Rundgang zeigen* und *Hinweise zu den Bereichen*.

**Zwei Schriften.** Alle Fenster nutzen dieselben: Anton für Titel und Zahlen,
Source Sans 3 für Text, Namen, Pfade und Zeiten. Beide stehen unter der SIL
Open Font License und sind eingebaut; es wird nichts aus dem Internet
nachgeladen. Die Lizenztexte liegen in `licenses/`.

---

## 18. Entwicklermodus: Waffen und Log-Einrichtung

Einstellungen › Entwickler › *Entwicklermodus* blendet Werkzeuge ein, mit denen
man ein Log prüft: die Reiter *Waffen* und *Log-Einrichtung*, die Gruppierung
*Nach Waffe*, *CSV exportieren* und die Beispielgruppe.

**Waffen.** Borometer liest dein Waffenpaar aus dem ausgewählten Kampf: welche
Fähigkeit zu welcher Waffe gehört, weiß es selbst. Stimmt es nicht, wählst du
hier von Hand; die Wahl gilt je Charakter und überlebt einen Neustart. Darunter
stehen der Schaden je Waffe mit Anteil, DPS, Treffern und Krit-Rate, wie dein
Build heißt, und ob jede Fähigkeit des Kampfes einer Waffe zugeordnet werden
konnte. Eine Zweitwaffe zählt ab **3 %** Anteil als solche.

**Log-Einrichtung.** Borometer erkennt die Spaltenrollen an der Form der Daten:
Zeit, Ereignistyp, Fähigkeit, Fähigkeits-ID, Schaden, Krit-Kennzeichen,
Stark-Kennzeichen, Trefferart, Angreifer, Ziel. Stimmt eine nicht, stellst du
sie hier um; die Zahlen werden sofort neu gerechnet. Dazu kommen das
Trennzeichen (Komma, Tab, Semikolon, Pipe) und ob die erste Zeile Spaltennamen
trägt. Oben steht, was erkannt wurde: Kampflog-Version, Zeilenzahl,
Spaltenzahl.

---

## 19. Tastatur

| Wo | Taste | Was passiert |
|---|---|---|
| überall | **Strg + +** / **Strg + −** / **Strg + 0** | Oberfläche größer, kleiner, zurück auf 100 % |
| überall | **Strg+K** | öffnet die Kampfwahl |
| überall | **Strg + ←** / **Strg + →** | voriger, nächster Kampf |
| überall, auch im Spiel | **Strg+Umschalt+D** | Durchklick an und aus; aus der Vollansicht direkt ins Overlay |
| Kompaktfenster | **Strg+Umschalt+W** | wechselt zwischen Kampf und Weeklies |
| überall | **Esc** | schließt das Oberste: Menü, Dialog, Filter, Kampfwahl; im Kompaktfenster erst danach, und dort zweimal, bis die Vollansicht kommt |
| ganz am Anfang | **Tab** | ein Sprunglink führt an der Leiste vorbei direkt zum Inhalt |
| Symbolleiste | **← → ↑ ↓** | zum nächsten Bereich, umlaufend |
| | **Home / Ende** | erster, letzter |
| Kampfwahl | **↑ ↓** | durch die Kämpfe |
| | **Home / Ende** | erster, letzter |
| | **→** | zugeklappten Block öffnen, sonst eine Zeile weiter |
| | **←** | offenen Block schließen, sonst zur Überschrift darüber |
| | **Enter** | öffnet den Kampf |
| | **ein Buchstabe** | springt zum nächsten Namen, der so anfängt |
| Liste im Kampf | **↑ ↓** | durch die Zeilen, auch durch die aufgeklappten |
| | **→ ←** | Zeile auf- und zuklappen |
| | **Umschalt+F10** / Menütaste | Windows-Menü der Zeile |
| | **Strg+C** | Fähigkeit und Wert kopieren |
| Rotation, Zeitverlauf | **Strg + Mausrad** | zoomen; mit der Tastatur über die Knöpfe − / + und danach die Pfeiltasten |
| Weeklies | **Pfeiltasten**, **Leertaste** | Feld wechseln, abhaken |
| | **Umschalt + Klick** | zählt zehn |

---

## 20. Was auf die Platte geschrieben wird

| Wohin | Was |
|---|---|
| `%APPDATA%\Borometer\boro-config.json` | die Einstellungen |
| `%APPDATA%\Borometer\boro-best.json` | die besten Pulls |
| `%APPDATA%\Borometer\boro-weeklies.json` | die Weeklies |
| `%APPDATA%\Borometer\boro-gilde.json` | die Gilde |
| `%APPDATA%\Borometer\boro-gilde-online.json` | die Gilde online, wenn sie eingeschaltet ist |
| `%APPDATA%\Borometer\archiv\` | die Kopien der Bosskämpfe |
| `%APPDATA%\Borometer\sicherungen\` | die Sicherung vor jedem endgültigen Löschen |
| `Logs\` neben der Exe | was du selbst speicherst |
| `Party-Logs\` neben der Exe | gespeicherte Gruppen-Logs |
| `Bug-Reports\` neben der Exe | Fehlerberichte |

Die drei letzten Ordner entstehen erst, wenn du zum ersten Mal so eine Datei
speicherst. „Neben der Exe“ gilt für die portablen Fassungen; bei der
installierten liegen sie unter `Dokumente\Borometer`. Dazu legt das Fenster
selbst (Chromium) seinen Speicher unter `%APPDATA%\Borometer\electron` ab.
**In den Kampflog-Ordner des Spiels schreibt Borometer nie.**
`npm run audit:safety` prüft genau das, mechanisch, bei jeder Änderung.

Borometer löscht von sich aus nichts. Endgültig weg geht nur, was du selbst
vorher gelöst hast, nur aus der Liste der Gelösten, nur nach dem Eintippen des
Namens und nur, nachdem Borometer eine Sicherung in `sicherungen` angelegt hat.
Aktive Einträge, Verlauf, Logs und beste Pulls bleiben unlöschbar.
