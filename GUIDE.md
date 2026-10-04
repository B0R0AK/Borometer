# Borometer — was alles drinsteckt

Die Kurzfassung steht in der [README](README.de.md). Hier steht alles der Reihe
nach: jeder Reiter, jeder Knopf, und wo eine Zahl herkommt.

*[English version: GUIDE.en.md](GUIDE.en.md)*

---

## Inhalt

1. [Kämpfe hereinbekommen](#1-kämpfe-hereinbekommen)
2. [Die linke Leiste](#2-die-linke-leiste)
3. [Die Kopfzeile](#3-die-kopfzeile)
4. [Die Tabelle](#4-die-tabelle)
5. [Zeitverlauf](#5-zeitverlauf)
6. [Rotation](#6-rotation)
7. [Analyse](#7-analyse)
8. [Waffen](#8-waffen)
9. [Gruppe](#9-gruppe)
10. [Kämpfe vergleichen](#10-kämpfe-vergleichen)
11. [Verlauf](#11-verlauf)
12. [Log-Einrichtung](#12-log-einrichtung)
13. [Kompaktmodus](#13-kompaktmodus)
14. [Das ⋯-Menü](#14-das--menü)
15. [Tastatur](#15-tastatur)
16. [Was auf die Platte geschrieben wird](#16-was-auf-die-platte-geschrieben-wird)

---

## 1. Kämpfe hereinbekommen

**Live-Aufzeichnung.** Der Umschalter oben in der Kopfleiste: **Live aus**,
nach dem Klick **Live** (auf der Startseite **Live-Aufzeichnung starten**); ein
zweiter Klick beendet sie. Ab dem Klick schaut Borometer alle zwei
Sekunden nach einer neueren Datei im Log-Ordner. Ein Pull erscheint kurz nach
dem Kampf, nicht währenddessen — das Spiel schreibt das Log erst beim
Kampfende. **Von allein lädt Borometer nie etwas**, auch keinen Kampf, der
schon im Ordner liegt.

**Logs öffnen.** Dateien von Hand aussuchen. Im ⋯-Menü liegen die beiden
Sonderfälle: *Throne-Logs laden* für die Rohdateien des Spiels,
*Gruppen-Logs laden* für das, was jemand aus einer Gruppe gespeichert hat.

**Beispiel.** Im ⋯-Menü. Zwei erfundene Kämpfe, damit man die App ansehen
kann, ohne selbst gespielt zu haben — alle Bilder in der README zeigen genau
diese zwei.

**Im Browser** statt in der Exe: Log-Datei ins Fenster ziehen, oder **Live aus**
klicken und den Log-Ordner wählen (setzt Chrome oder Edge voraus).

---

## 2. Die linke Leiste

Die Liste aller Kämpfe des geladenen Logs, von oben nach unten in der
Reihenfolge des Abends.

**Blöcke.** Kämpfe, die zusammengehören, stehen unter einer Überschrift: ein
Dungeon-Lauf unter seinem Namen, ein Feldboss unter seinem. Die Überschrift
sagt, wie viele Kämpfe darin stecken, wie lange der Block insgesamt lief und
wie viel Schaden zusammenkam. Sie bleibt stehen, solange ihr Block läuft, und
wird von der nächsten abgelöst.

**Trash klappt weg.** In einem Dungeon stehen die Bosse einzeln, alles andere
zusammengefasst als ein Eintrag mit Anzahl. Ein Klick zeigt sie. An einem
Raid-Abend sind das vier sichtbare Zeilen statt achtzehn.

**Bearbeiten.** Macht aus der Liste eine mit Griffen: jede Zeile bekommt ein
✕, und ein Klick nimmt diesen Kampf heraus. *Zurück* holt alles wieder. Zwei
Regeln gelten:

- Ein Kampf, zu dem die Gruppe gemeldet hat, trägt einen Anhänger und bleibt
  stehen.
- In einem **Gruppen-Log** geht gar nichts heraus — dort gehören die Zahlen
  nicht dir allein.

Entfernt heißt *aus der Ansicht genommen*, nicht gelöscht. Die Log-Datei wird
nie angefasst.

**Leeren** nimmt alle Kämpfe aus der Ansicht. Neun Sekunden lang steht in der
Meldung ein *Rückgängig*.

**Gespeicherte Kämpfe.** Unten. *Kampf speichern* legt den gerade gezeigten
Kampf beiseite, damit er einen Neustart und ein neues Log überlebt — benannt
nach dem getragenen Build, damit sich zwei Builds nebeneinander lesen lassen.
Der Knopf *Vergleichen* nimmt die angehakten mit in Reiter 10.

**Filter und Kampfdatei.** Ganz unten. Schränkt ein, was in der Liste steht
(Kämpfe trennen, kurze ausblenden), und speichert oder lädt gespeicherte
Kämpfe als Datei.

---

## 3. Die Kopfzeile

Alles über den ausgewählten Kampf, in vier Lagen.

**Die große Zahl** ist Schaden pro Sekunde. Geteilt wird durch die Zeit, in
der du wirklich am Ziel warst — nicht durch die Spanne von erstem bis letztem
Treffer. Bei einem Boss mit Zwischenphase sind das zwei verschiedene Zahlen.

**Die Faktenzeile** darunter: wessen Zahlen das sind, die Spanne, die
gekämpfte Zeit (nur wenn sie eine andere ist), der Gesamtschaden und die
Uhrzeit. Die gekämpfte Zeit steht genau deshalb da: sie ist der Teiler der
großen Zahl, und ohne sie geht die Rechnung nicht auf.

**Die Lesezeile** sagt in einem Satz, was passiert ist. Vier Regeln, von oben
nach unten geprüft, der erste Treffer wird gedruckt:

| | Wann | Was dasteht |
|---|---|---|
| 1 | unter 20 Treffer im ganzen Kampf | „Nur 10 Treffer im ganzen Kampf — für eine Aussage über Anteile zu wenig." |
| 2 | mindestens 5 s lang kein Treffer am Ziel | „Die Zahl oben teilt durch 1m 46s — 1m 9s lang war am Ziel nichts zu treffen." |
| 3 | eine Fähigkeit über 50 % des Schadens, aus mindestens 10 Treffern | „Verfluchter Alptraum trug 77,8 % des Schadens — 649 Treffer, 65 % davon kritisch." |
| 4 | sonst | „Stärkste Fähigkeit: Manasphärenausbruch mit 28,7 % — der Rest verteilt sich auf 8 weitere." |

Die Trefferschwelle in Regel 3 ist der Punkt: 76 % aus drei Treffern ist
Zufall und kein Befund.

**Die Urteilszeile** ordnet die Zahl ein, wenn es etwas zum Einordnen gibt:
„Deine beste von 3 Kämpfen" oder „39 % schlechter als sonst". Sie sagt dabei,
woher sie das weiß — *an diesem Boss* meint alle Abende, die Borometer je
gesehen hat, *in diesem Log* nur den heutigen.

**Die Messwerte** als Streifen: dein Build, dann *im ganzen Kampf* und
dahinter Treffer, Kritisch / Stark, Ø Treffer und Größter Treffer. Die
Beschriftung steht dort, weil dieselben Wörter unten in der Tabelle je Zeile
stehen — oben gelten sie für den ganzen Kampf. Kam ein Schild vor, kommt ein
sechster dazu.

---

## 4. Die Tabelle

Darunter liegt dieselbe Sache fünfmal, je nachdem, wonach du ordnest:

| | Was eine Zeile ist |
|---|---|
| **Nach Fähigkeit** | ein Skill |
| **Nach Waffe** | eine deiner beiden Waffen (plus Passiv) |
| **Ziele** | ein Gegner |
| **Angreifer** | eine Person im Log |
| **Spieler** | ein Mitglied der laufenden Gruppe |

**Spalten:** Rang, Name, Schaden, DPS, Anteil, Treffer, Größter Treffer,
Kritisch, Stark. Ein Klick auf eine Überschrift sortiert danach; bei
Gleichstand entscheidet die Trefferzahl, damit eine 100-%-Quote aus zwei
Einsätzen nicht über einer aus zweihundert steht. Die Sortierung springt bei
jedem Kampfwechsel auf Schaden zurück.

Wird das Fenster schmal, fallen Spalten weg — die, nach der gerade sortiert
ist, bleibt immer stehen.

**Aufklappen.** Der Pfeil links an einer Zeile zeigt, woraus ihr Schaden
besteht: normal, kritisch, stark, kritisch stark. Jede Trefferart mit eigenem
Balken, eigenem Anteil und eigener Trefferzahl. Das `×2` daneben sagt, dass
diese Art im Schnitt doppelt so hart trifft wie ein normaler Treffer derselben
Fähigkeit. Zeilen, bei denen jeder Treffer gleich landete, klappen nicht auf —
da gibt es nichts zu zeigen.

**„Name (8 von 12)"** in der Kopfzeile der Tabelle sagt, wie viele Zeilen
gerade zu sehen sind und wie viele es gibt. Die Tabelle hat eine feste Höhe,
damit die Reiter darunter nicht springen, wenn jemand eine Zeile aufklappt.

---

## 5. Zeitverlauf

Wie sich der Schaden über die Kampfzeit verteilt.

- **Die Kurve** ist Gesamtschaden je Sekunde, geglättet. *1 s (roh)*, *3 s*
  oder *5 s* — je größer, desto ruhiger die Linie.
- **Die Spuren** darunter: eine je Fähigkeit, jede auf ihrer eigenen
  Grundlinie. Unter *Spurmaßstab* skaliert *Je Spur* jede für sich,
  *Gemeinsam* alle auf denselben — das erste zeigt den Rhythmus, das zweite
  die Größenordnung. Ein Klick auf einen Namen nimmt ihn aus der Kurve oben
  heraus.
- Das eingefasste Feld ist die **schwächste Stelle** des Kampfes.
- **Strg + Mausrad** zoomt, die Leiste darunter zieht den Ausschnitt, und über
  *Von / bis / Anwenden* lässt sich er auch eintippen. Mit der Tastatur geht
  es über die Knöpfe − / + und die Pfeiltasten.

---

## 6. Rotation

Ein Symbol je Einsatz, waagerecht in der Reihenfolge, in der du sie gedrückt
hast; darunter eine Spur je Fähigkeit. Der Balken hinter einem Einsatz ist die
Spanne, in der er noch getroffen hat — eine Marke ohne Balken traf einmal.

Der Text darüber sagt, wie viele Einsätze im Bild stehen und wie lang die
längste Pause zwischen zwei Einsätzen der stärksten Fähigkeit war. Lücken in
der Rotation sieht man hier schneller als in jeder Tabelle.

---

## 7. Analyse

Sätze statt Summen, in vier Abschnitten.

**Der Kampf in Zahlen** — die Kurve im Kleinen, dazu ein Satz über die
Verteilung: „Deine erste Hälfte lief mit 573.9k, dem 1,6-fachen der zweiten."

**Wohin ging der Schaden?** — die stärkste Fähigkeit mit ihrem Anteil, und was
ein einzelner Einsatz davon im Schnitt bringt, verglichen mit der
zweitstärksten.

**Wie war der Rhythmus?** — die Art deiner Skillung (stoßweise oder
gleichmäßig), die schwächsten drei Sekunden mit der Frage, was dort im
Cooldown war, und die Leerzeit: wie lange gar nichts gedrückt wurde.

**Wo standest du bei Auge von Ventius?** — nur wenn die Fähigkeit vorkam. Der
Pfeil, eine Sekunde später ein Nachbeben; jedes Nachbeben trifft bis zu
dreimal. Wie viele ein Ziel überhaupt hergibt, ist seine **Größe** — deshalb
steht die Obergrenze je Boss in einer Tabelle und ist nicht festgeschrieben.
Trash steht nicht darin: er ist tot, bevor sich die Frage stellt.

**Wie gut waren die Treffer?** — Krit-Rate und was sie am Schaden ausmacht,
Fehlschläge (das Log schreibt sie als Treffer ohne Schaden, deshalb zählen sie
in keiner anderen Zahl mit), starke Treffer und der größte Einzelschlag.

---

## 8. Waffen

Borometer liest dein Waffenpaar aus dem ausgewählten Kampf: welche Fähigkeit
zu welcher Waffe gehört, weiß es selbst. Stimmt es nicht, wählst du hier von
Hand — die Wahl gilt je Charakter und überlebt einen Neustart.

Darunter: der Schaden je Waffe mit Anteil, DPS, Treffern und Krit-Rate, wie
dein Build heißt, und ob jede Fähigkeit des Kampfes einer Waffe zugeordnet
werden konnte. Eine Zweitwaffe zählt ab **3 %** Anteil als solche.

---

## 9. Gruppe

Jeder schickt seinen neuesten Kampf, alle sehen eine gemeinsame, sortierte
Tafel mit Klasse und Rolle neben jedem Namen. Die Zeilen klappen zwei Ebenen
tief auf: erst die Fähigkeiten, dann ihre Trefferarten.

Drei Wege, im Reiter *Gruppe*:

1. **Ein Server im Clan läuft schon** — der häufigste Fall. Einmal die Adresse
   unter *Gruppen-Server* eintragen, speichern. Danach reicht der
   Vier-Zeichen-Code, den jemand herumgibt.
2. **Vom eigenen PC gehostet.** Charakternamen eintippen, *Gruppe hosten*. Du
   bekommst einen Code samt Adresse, etwa `AB7K@192.168.1.20:8732` — ohne 0,
   O, 1 und I, damit sich beim Vorlesen nichts verwechselt. Im selben Netz
   läuft das ohne Weiteres; übers Internet muss der Host erreichbar sein.
3. **Ein eigener kleiner Server.** Dann hängt die Gruppe nicht daran, dass ein
   bestimmter PC an bleibt. Liegt in [`BoroPartyServer/`](BoroPartyServer/).

Während des Hostens öffnet Borometer einen zweiten Port, der ausschließlich
Gruppenverkehr beantwortet. Logs und Einstellungen sind darüber nicht
erreichbar, jede Anfrage ohne den aktuellen Code wird abgewiesen, und *Gruppe
schließen* schließt den Port.

**Klickst du links einen Bosskampf an**, steht oben die ganze Gruppe dazu:
jeder mit seinem eigenen Kampf gegen diesen Boss. Zeitverlauf und Rotation der
anderen lassen sich ansehen — über beiden Bildern steht eine Reihe *Wessen*.

*Gruppen-Log speichern* legt alle Bosskämpfe des geladenen Logs ab, nicht nur
den Augenblick, in dem du gedrückt hast.

---

## 10. Kämpfe vergleichen

Hake zwei bis vier Kämpfe an — aus dem geladenen Log oder aus den
gespeicherten. Was dann kommt:

- **Wer gewinnt**, auf DPS, und wie weit die anderen zurückliegen.
- **Woher der Unterschied kommt.** Fähigkeit für Fähigkeit, wie viel DPS sie
  gegenüber dem Vergleichskampf mehr oder weniger gebracht hat. Meist tragen
  zwei oder drei fast alles davon.
- **Direktvergleich** der Kennzahlen: DPS, Schaden, Länge, Treffer, Krit-Rate,
  Krit-Anteil am Schaden, Stark-Rate, Durchschnittstreffer, größter Treffer,
  Leerzeit. Was mit der Länge wächst, ist als solches markiert.
- **Schaden pro Sekunde, Fähigkeit für Fähigkeit** und dasselbe je Waffe.

Sind die Kämpfe verschieden lang, sagt Borometer das und bietet an, **beide
auf den kürzeren zu kürzen**. Ohne das vergleicht man Summen, die nur deshalb
größer sind, weil länger gekämpft wurde — DPS und die Raten sind vergleichbar,
Schaden, Treffer und Leerzeit nicht.

---

## 11. Verlauf

Je Boss deine Leistung über alle Abende. Er füllt sich, während du spielst:
Borometer merkt sich, was es selbst gesehen hat. Nur Bosse — ein Übungsziel
steht gar nicht darin, denn dort ist jede Pause das Ende eines Versuchs und
keine Leistung. Deutsche und englische Schreibweisen desselben Gegners werden
zusammengeführt.

Aus diesem Verzeichnis kommt auch die Urteilszeile in der Kopfzeile.

---

## 12. Log-Einrichtung

Erscheint nur, wenn es etwas einzurichten gibt. Borometer erkennt die
Spaltenrollen an der Form der Daten — Zeit, Ereignistyp, Fähigkeit,
Fähigkeits-ID, Schaden, Krit-Kennzeichen, Stark-Kennzeichen, Trefferart,
Angreifer, Ziel. Stimmt eine nicht, stellst du sie hier um; die Zahlen werden
sofort neu gerechnet.

Dazu Trennzeichen (Komma, Tab, Semikolon, Pipe) und ob die erste Zeile
Spaltennamen trägt oder schon Daten. Oben steht, was erkannt wurde:
Kampflog-Version, Zeilenzahl, Spaltenzahl.

---

## 13. Kompaktmodus

Der Knopf *Kompakt* oben. Aus dem Fenster wird ein Streifen: Ablesewert,
Kopfzeile und Balken, sonst nichts. Gedacht für den zweiten Monitor oder über
das Spiel gelegt.

- **Durchsichtig** in ganzen Schritten von 0 bis 55 %.
- **Oben halten**, damit das Spiel ihn nicht verdeckt.
- **Durchklick** mit **Strg+Umschalt+D**: Klicks gehen durch das Overlay ins
  Spiel, nochmal drücken holt es zurück. Aus der Vollansicht macht das Kürzel
  das ganze Overlay auf einmal – kompakt, oben, durchklickbar.
- Fährt die Maus nicht darüber, verblasst die Bedienung und nur die Zahlen
  bleiben.
- Ein Wort sagt, ob aufgezeichnet wird — nicht nur ein Punkt.
- **Esc** führt zurück. Liegt etwas darüber (das ⋯-Menü, ein Dialog), schließt
  Esc erst das.

---

## 14. Das ⋯-Menü

- **Throne-Logs laden** / **Gruppen-Logs laden** — die beiden Sonderfälle zum
  Öffnen.
- **Beispiel** — die zwei erfundenen Kämpfe.
- **Thema**: Dunkel, Hell, TnL oder Auto (folgt Windows).
- **Größe**: die Oberfläche von 10 bis 200 %, und die Durchsichtigkeit.
- **Auf Englisch umschalten** — jede Beschriftung gibt es in beiden Sprachen.
- **Änderungsprotokoll** — was sich je Version geändert hat, in der App selbst.
- **Fehlerbericht schreiben** — siehe [README](README.de.md#wenn-etwas-nicht-stimmt).
- **Entwicklermodus** — blendet *CSV exportieren* und die Beispielgruppe ein.

---

## 15. Tastatur

| Wo | Taste | Was passiert |
|---|---|---|
| überall | **Strg + +** / **Strg + −** / **Strg + 0** | Oberfläche größer, kleiner, zurück auf 100 % |
| überall, auch im Spiel | **Strg+Umschalt+D** | Durchklick an und aus; aus der Vollansicht direkt ins Overlay |
| überall | **Esc** | schließt das Oberste — Menü, Dialog, Filter, Änderungsprotokoll; erst wenn nichts mehr darüber liegt, den Kompaktmodus |
| ganz am Anfang | **Tab** | ein Sprunglink führt an der Leiste vorbei direkt zum Kampf |
| linke Leiste | **↑ ↓** | durch die Kämpfe |
| | **Home / Ende** | erster, letzter |
| | **→** | zugeklappten Block öffnen, sonst eine Zeile weiter |
| | **←** | offenen Block schließen, sonst zur Überschrift darüber |
| | **ein Buchstabe** | springt zum nächsten Namen, der so anfängt — auch mitten im Namen |
| Tabelle | **↑ ↓** | durch die Zeilen, auch durch die aufgeklappten |
| | **→ ←** | Zeile auf- und zuklappen |
| Reiter | **← → ↑ ↓** | zum nächsten Reiter, umlaufend |
| | **Home / Ende** | erster, letzter |
| Zeitverlauf | **Strg + Mausrad** | zoomen; mit der Tastatur über die Knöpfe − / + und danach die Pfeiltasten |

---

## 16. Was auf die Platte geschrieben wird

| Wohin | Was |
|---|---|
| `%APPDATA%\Borometer\boro-config.json` | die Einstellungen |
| `Logs\` neben der Exe | was du selbst speicherst |
| `Party-Logs\` neben der Exe | gespeicherte Gruppen-Logs |
| `Bug-Reports\` neben der Exe | Fehlerberichte |

Die drei Ordner entstehen erst, wenn du zum ersten Mal so eine Datei
speicherst. „Neben der Exe“ gilt für die portablen Fassungen; bei der
installierten liegen sie unter `Dokumente\Borometer`. Dazu legt das Fenster
selbst (Chromium) seinen Speicher unter `%APPDATA%\Borometer\electron` ab. **In den Kampflog-Ordner des Spiels schreibt Borometer nie** —
`npm run audit:safety` prüft genau das, mechanisch, bei jeder Änderung.
