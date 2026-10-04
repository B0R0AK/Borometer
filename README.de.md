# Borometer

Ein DPS-Meter für **Throne and Liberty**. Es liest die Kampflog-Datei, die das
Spiel selbst auf die Festplatte schreibt, und sonst nichts. Es greift nicht auf
den Spielprozess zu, braucht kein Konto, sendet keine Telemetrie und ruft von
sich aus nichts im Netz auf.

> **Fanprojekt.** Nicht verbunden mit NCSOFT oder Amazon Games (not affiliated with
> NCSOFT or Amazon Games), von ihnen weder unterstützt noch geprüft. Throne and Liberty
> ist eine Marke von NCSOFT. Borometer ist kostenlos, ohne Werbung und ohne Spenden
> (free, no ads, no donations). Spielbilder gehören ihrem Eigentümer und fallen nicht
> unter die GPL. Die Release-Downloads betten sie ein, der Quelltext enthält keine,
> und die Bildschirmfotos auf dieser Seite zeigen einen Release-Build.

[![build](https://github.com/B0R0AK/Borometer/actions/workflows/build.yml/badge.svg)](https://github.com/B0R0AK/Borometer/actions/workflows/build.yml)

**[Neueste Version herunterladen](https://github.com/B0R0AK/Borometer/releases/latest)**
als Installer oder als portable Exe, die ohne Installation überall läuft.

*[English version: README.md](README.md)*

[![Borometer, dunkles Thema](docs/bilder/kampf.png)](docs/bilder/kampf.png)

Der ausgewählte Kampf steht als Ring da, als Glutring. Jeder Bogen ist eine
Fähigkeit, so groß wie ihr Schaden, und in der Mitte steht die große Zahl. Über
dem Ring stehen die Fakten des Kampfs und **ein Satz, der ihn liest**: welche
Fähigkeit ihn getragen hat, ob das Ziel zwischendurch gar nicht zu treffen war,
oder dass es für eine Aussage zu wenige Treffer waren. Bekannte Bosse tragen ihr
Porträt neben dem Namen.

Rechts neben dem Ring stehen die Fähigkeiten nach Schaden sortiert, mit Anteil,
Treffern und den Quoten für kritisch und stark. Ein Klick auf einen Bogen klappt
diese Fähigkeit in der Liste mit ihren Trefferarten auf. In der Gruppe zeigt der Ring die Mitglieder.
**Kampf nachspielen** lässt die Fähigkeiten als Rennen gegeneinander laufen; ihre
Balken wachsen mit dem Schaden bis zu diesem Moment.

Die Kämpfe selbst stehen in der Kampfwahl in der Mitte der Titelleiste
(Strg + K), zu Dungeon-Läufen gruppiert und nach ihrem Boss benannt.

> Der [Feature-Guide](GUIDE.md) erklärt alles der Reihe nach: jeden Reiter, jeden
> Knopf, die Tastenkürzel und die Rechenwege dahinter.

*(Die Bildschirmfotos zeigen die App auf Englisch. Jede Beschriftung gibt es auch
auf Deutsch. Die Sprache stellst du im Menü „Mehr“ (···) oben in der Leiste um
oder unter Einstellungen › Sprache.)*

---

## Jede Zeile klappt auf

Ein Klick auf eine Fähigkeit zeigt, wie ihr Schaden zustande kam. Normal,
kritisch, stark und kritisch stark bekommen je einen eigenen Balken, ihre
Trefferzahl und ihren Schaden, darunter stehen Treffer gesamt, der größte
Treffer und der Schnitt je Treffer. In Kompakt zeigen die Trefferarten
zusätzlich ihren Anteil am Schaden der Fähigkeit, und die starken tragen ein
`×2`, weil ein starker Treffer doppelten Schaden anrichtet.

## Was der Kampf verrät

Die Analyse sagt in Sätzen, was in den Zahlen steht: wie stoßweise der Schaden
lief, wo die schwächsten drei Sekunden lagen, wie viel Leerzeit dazwischen
stand, wie viele Angriffe danebengingen, und bei Auge von Ventius, wie viele
deiner Salven so viele Nachbeben getragen haben wie deine beste. Wie viele
Nachbeben ein Ziel überhaupt hergibt, hängt an seiner Größe; deshalb steht die
Obergrenze je Boss in einer Tabelle, statt festgeschrieben zu sein.

[![Die Analyse mit ihren Befunden](docs/bilder/analyse.png)](docs/bilder/analyse.png)

## Wann du was eingesetzt hast

Ein Symbol je Einsatz, eine Spur je Fähigkeit. Lücken in der Rotation sieht man
hier schneller als in jeder Tabelle. Strg + Scrollen zoomt hinein, die Leiste
zieht den Ausschnitt, und mit der Tastatur geht es genauso.

[![Rotationsansicht](docs/bilder/rotation.png)](docs/bilder/rotation.png)

## Zwei Kämpfe nebeneinander

Hake zwei bis vier Kämpfe an, aus dem geladenen Log oder aus dem, was du
gespeichert hast. Borometer sagt, wer gewinnt und woher der Unterschied kommt
(meist tragen zwei oder drei Fähigkeiten fast alles davon), und stellt die
Kennzahlen direkt gegenüber. Sind die Kämpfe verschieden lang, sagt es das und
bietet an, beide auf den kürzeren zu kürzen. Ohne das vergleicht man Summen,
die nur deshalb größer sind, weil länger gekämpft wurde.

## Drei Themen

Dunkel, hell und ein drittes in den Farben des Spiels. Alle drei sind
durchgemessen: der schlechteste Kontrast auf einem Balken liegt bei 4,5:1.
Borometer übernimmt die Einstellung von Windows, oder du wählst sie fest.

[![Borometer, helles Thema](docs/bilder/meter-hell.png)](docs/bilder/meter-hell.png)

[![Borometer, TnL-Thema](docs/bilder/meter-tnl.png)](docs/bilder/meter-tnl.png)

## Weeklies

Ein Reiter je Charakter: der Raid als Raster aus Flügeln und Schwierigkeiten,
das Geheimdungeon, Events, die Dimensionsprüfung und die Händler, jeweils mit
Zähler. Ein Band zeigt, wo die Woche steht und wann der nächste Wochen- und
Tages-Reset kommt. Nichts davon wird aus dem Spiel gelesen; du hakst es selbst
ab.

[![Die Weeklies eines Charakters](docs/bilder/weeklies.png)](docs/bilder/weeklies.png)

## Rekorde

Borometer liest deine Logs einmal und führt ein Album: je Boss dein bester
DPS, dein stärkster Treffer mit der Fähigkeit, die ihn traf, und der Tag
deines ersten Kampfes. Bosse, gegen die du noch nicht gekämpft hast, stehen
als leere Umrisse da.

[![Das Album der Rekorde](docs/bilder/rekorde.png)](docs/bilder/rekorde.png)

## Kompakt

Für den zweiten Monitor oder über das Spiel gelegt: nur Ablesewert und Balken.
Das Fenster lässt sich durchsichtig stellen, in ganzen Schritten von 0 bis
55 %, und über allen anderen halten. **Esc** führt zurück.

---

## Loslegen

### 1. Kampflog im Spiel einschalten

    Einstellungen → Tastenkürzel → Ringmenü → "Kampfmesser" hinzufügen

Danach einmal im Ringmenü aktivieren. Ab dann schreibt das Spiel bei jedem
Kampfende eine Datei.

### 2. Borometer holen

**Fertig herunterladen.** Unter
[Releases](https://github.com/B0R0AK/Borometer/releases/latest) hängen an
jeder Version drei Dateien. Es ist dieselbe App, nur anders verpackt:

| Datei | Was es ist |
|---|---|
| `Borometer-Setup-<Version>.exe` | **Installer.** Legt Startmenü- und Desktop-Verknüpfung an, lässt sich über die Windows-Einstellungen wieder deinstallieren. Gespeicherte Kämpfe landen unter `Dokumente\Borometer`. |
| `Borometer-<Version>-portable.exe` | **Portabel, eine Datei.** Nichts installieren, einfach starten, auch vom USB-Stick. Gespeichertes landet neben der Exe. |
| `Borometer-<Version>-win-x64.zip` | **Portabel, als Ordner.** Wie oben, nur ausgepackt: entpacken, `Borometer.exe` starten. Siehe unten, warum es die gibt. |

Die Einstellungen teilen sich alle drei (siehe unten), du kannst also jederzeit
wechseln, auch von einer älteren Python-Fassung.

**Oder selbst bauen**, wenn du lieber dem Quelltext traust als einer fertigen
Datei:

1. [Node.js](https://nodejs.org/) ab Version 22 installieren.
2. Im Ordner des Quelltexts `npm ci` ausführen. Das holt Electron, TypeScript
   und die Build-Werkzeuge.
3. `npm run dist:win` baut alle drei Dateien nach `release\`. Nur ausprobieren
   ohne zu verpacken: `npm start`.

Ein eigener Build zeigt Borometers gezeichnete Marken, wo die Downloads
Spielbilder zeigen ([Aus dem Quelltext bauen](#aus-dem-quelltext-bauen)).

### 3. Starten

Den Log-Ordner unter `%LOCALAPPDATA%\TL\Saved\CombatLogs` findet Borometer von
selbst. Mit dem Beobachten fängt es aber erst an, wenn du oben auf
**Live aus** drückst (auf der Startseite: **Live-Aufzeichnung starten**). Dann
steht dort **Live**, und ein zweiter Klick beendet es. Von allein lädt es nie
etwas, auch keinen Kampf, der schon im Ordner liegt. Ab dem Klick schaut es
alle zwei Sekunden nach einer neueren Datei, ein Pull erscheint also kurz nach
dem Kampf: das Spiel schreibt das Log erst beim Kampfende, nicht währenddessen.

Findet Borometer den Ordner nicht von selbst, sagt es das auf der Startseite
und bietet **Ordner wählen** an. Einmal aussuchen, danach ist er gemerkt.

Ohne Exe geht es auch: `npm start` im Quelltext, oder die gebaute
`boro-meter.html` (hängt ebenfalls am Release) einfach im Browser öffnen. Dort
funktioniert alles bis auf das automatische Beobachten. Im Browser zieht man
die Log-Datei hinein oder klickt **Live aus** und wählt den Log-Ordner, was
Chrome oder Edge voraussetzt.

### Beim ersten Start

Windows zeigt einen SmartScreen-Hinweis, der Herausgeber sei unbekannt. Den
bekommt jedes unsignierte Programm, egal was es tut: **Weitere Informationen →
Trotzdem ausführen**.

Möglicherweise schlägt auch dein Virenscanner an, am ehesten bei der portablen
Einzeldatei. Sie entpackt sich bei jedem Start in einen temporären Ordner, und
diese Selbstentpackung lesen manche Scanner als verdächtig. Es ist ein
Fehlalarm, aber wenn es stört, nimm den Installer oder die Zip-Datei. Beide
entpacken beim Start nichts, und die Heuristiken springen darauf deutlich
seltener an. Ist dir eine fertige Datei trotzdem nicht geheuer, bau sie selbst
aus demselben Quelltext.

Meldet ein Scanner eine der Dateien, ist der richtige Weg eine
Fehlalarm-Meldung an den Hersteller (Microsofts Formular:
[microsoft.com/wdsi/filesubmission](https://www.microsoft.com/en-us/wdsi/filesubmission)),
nicht das Abschalten des Virenscanners.

---

## Gruppen-Board

Jeder schickt seinen neuesten Kampf, und alle sehen ein gemeinsames, sortiertes
Board mit Klasse und Rolle neben jedem Namen, etwa Orakel · Heiler oder
Kreuzritter · Tank. Die Zeilen lassen sich aufklappen. Alles dafür steht im
Reiter *Gruppe*.

**Wenn im Clan schon ein Server läuft**, was der häufigste Fall ist, trägst du
nur einmal seine Adresse ein: unter *Gruppen-Server* ins Feld **Server-Adresse**,
dann **Speichern**. Danach reicht der Vier-Zeichen-Code, den jemand herumgibt.
Bleibt das Feld leer, hostet Borometer stattdessen über deinen eigenen PC.

**Vom eigenen PC gehostet.** Charakternamen eintippen und **Gruppe hosten**
drücken. Du bekommst einen Code aus vier Zeichen samt Adresse, etwa
`AB7K@192.168.1.20:8732`. Der Code besteht aus Buchstaben und Ziffern, aber ohne
0, O, 1 und I, damit sich beim Vorlesen nichts verwechselt. Alle anderen tippen
ihren Namen ein, fügen die ganze Zeichenkette ein und drücken **Mit diesem Code
beitreten**. Für alle im selben Netz wie der Host läuft das ohne Weiteres. Übers
Internet muss der Host erreichbar sein, also entweder über einen
weitergeleiteten Port oder über etwas wie Tailscale, das euch auf ein virtuelles
Netz legt.

Während des Hostens öffnet Borometer einen zweiten Port, der ausschließlich
Gruppenverkehr beantwortet. Logs oder Einstellungen sind darüber nicht
erreichbar, und jede Anfrage ohne den aktuellen Code wird abgewiesen. Gruppe
schließen schließt den Port.

**Einen eigenen kleinen Server aufsetzen.** Dann hängt die Gruppe nicht mehr
daran, dass der PC eines bestimmten Spielers an und erreichbar bleibt. Der Server
liegt in [`BoroPartyServer/`](BoroPartyServer/): eine einzige Python-Datei
ohne Fremdpakete, dazu eine systemd-Unit und die Einrichtungsanleitung
[`SELF-HOSTING.md`](BoroPartyServer/SELF-HOSTING.md) (englisch). Er
behält nur, was die Borometer ihm schicken, und nur im Arbeitsspeicher: je
Spieler Charaktername und die zwei Waffen; zu seinem neuesten Kampf Ziel,
Startzeit und Dauer, Schaden, DPS, Treffer, die Werte für kritisch und stark
und den größten Treffer; dazu für bis zu zwölf Fähigkeiten ihre Namen mit
denselben Werten, aufgeteilt nach Trefferart, eine Schadenskurve je Sekunde und
die Zeiten ihrer Einsätze. Er liest nie ein Kampflog und redet mit nichts außer
den Borometern, die ihm etwas schicken.

---

## Was hier liegt

| Datei | Wofür |
|---|---|
| `src/renderer/` | die Oberfläche: `index.html`, `styles.css`, `types.ts`, `main.ts` und in `app/` das Seitenskript als nummerierte ES-Module (Parser, Meter, Diagramme, Vergleich, Gruppe) |
| `src/main/` | das Hauptprogramm in TypeScript: Fenster, Log-Ordner, Speichern, Gruppe |
| `scripts/build-renderer.mjs` | bündelt die Oberfläche mit esbuild zu einer einzigen HTML-Datei |
| `src/renderer/spielbilder.ts` | die Tabellen der Spielbilder, in diesem Quelltext leer; der Release-Build füllt sie |
| `scripts/safety-audit.mjs` | prüft mechanisch, dass die App nur liest ([was es prüft](#was-das-audit-prüft)) |
| `scripts/audit-negative.mjs` | bricht jede Regel des Audits absichtlich und prüft, dass das Audit es merkt |
| `electron-builder.yml` | wie Installer, portable Exe und Zip gepackt werden |
| `build/` | Programmsymbol, dazu Bilder und Texte des Installers (`installer.nsh`; die Bilder zeichnet `npm run installer-art`) |
| `CHANGELOG.de.txt` / `CHANGELOG.txt` | was sich je Version geändert hat |
| `BoroPartyServer/` | der optionale Gruppen-Server, mit [Anleitung zum Selbst-Hosten](BoroPartyServer/SELF-HOSTING.md) |
| `SECURITY.md` | wie man eine Sicherheitslücke vertraulich meldet |
| `CONTRIBUTING.md` | wie man helfen kann: nur über Issues |

Das Arbeits-Repository prüft zusätzlich mit einem Bildschirm-Paritätstest gegen
einen festen Bezug; der braucht den privaten Verlauf und gehört nicht zu diesem
Repository.

Die Einstellungen liegen unter `%APPDATA%\Borometer\boro-config.json`, für
Installer, portable Exe und Zip dieselbe Datei. Eine ältere Datei neben der Exe
wird beim ersten Start einmal übernommen, für ein Update genügt es also, die
neue Version zu starten.

Was Borometer selbst schreibt (`Logs`, `Party-Logs` und `Bug-Reports`),
entsteht erst, wenn du zum ersten Mal so eine Datei speicherst: bei der
installierten Fassung unter `Dokumente\Borometer`, bei den portablen neben der
Exe.

---

## Wenn etwas nicht stimmt

Links in der Leiste steht **Fehlerbericht schreiben**. Das legt eine
JSON-Datei im Ordner `Bug-Reports` an (neben der Exe, installiert unter
`Dokumente\Borometer`) mit Version, Fenstergröße, wie die Spalten des Logs
erkannt wurden, welche Skills und Trefferarten vorkamen und was zuletzt
schiefging.

Das Kampflog selbst ist nicht dabei. Wohl aber der Pfad zu deiner
Einstellungsdatei, also dein Windows-Benutzername, dazu der Dateiname des Logs
und kurze Proben aus seinen Spalten, in denen Charakter- und Gegnernamen
stehen. Es ist reiner Text; wirf einen Blick hinein, bevor du ihn weitergibst.

Die Datei an ein [Issue](https://github.com/B0R0AK/Borometer/issues) hängen,
und wenn möglich das Kampflog dazu, bei dem es passiert ist. Damit lässt sich
fast alles nachstellen.

---

## Systeme

**Windows 10 und 11 (64 Bit)** sind das Ziel und das, wofür gebaut wird.
Borometer bringt sein Fenster mit (Electron, also ein eigenes Chromium) und
braucht weder WebView2 noch einen installierten Browser.

**Windows 7, 8 und 8.1** werden nicht unterstützt: die Chromium-Version darin
läuft dort nicht mehr.

**Linux** läuft, auch unter Proton. `npm run dist:linux` baut ein AppImage, oder
du startest mit `npm start` direkt aus dem Quelltext. Borometer sucht die
Kampflogs sowohl am normalen Windows-Ort als auch in den Proton-Prefixes von
Steam. Die Durchsichtigkeit des Kompaktmodus gibt es unter Linux nicht.

**macOS** ist ungetestet, und Throne and Liberty läuft dort ohnehin nicht.

---

## Was es nicht tut

Borometer liest das ausführliche Kampflog, das Throne and Liberty schreibt,
wenn man die spieleigene Protokollierung einschaltet. Es schleust keinen Code
ein, liest keinen Spielspeicher, hängt sich nicht in den Renderer und schickt
dem Spiel keine Eingaben. Es wird nichts hochgeladen, es gibt kein Konto und
keine Telemetrie.

Ein einziges Tastenkürzel meldet Borometer bei Windows an: **Strg+Umschalt+D**
für den Durchklick. Windows sagt Borometer, wenn genau diese Kombination
gedrückt wird, und über keine andere Taste etwas. Borometer liest die Tastatur
nicht mit.

Netz gibt es nur, wenn du es einschaltest. Im Normalbetrieb lauscht der lokale
Helfer auf 127.0.0.1 und ruft nichts auf. Drei Dinge ändern das, jedes nur auf
dein Wort. Eine Gruppe: Hosten öffnet einen zweiten Port nach außen, Beitreten
schickt deine Zahlen an den Host oder euren Gruppen-Server. Was dabei geht, sind
die Werte, die auf dem Board stehen, nie eine Logdatei. Questlog, wenn du einen
Build-Plan per Klick abrufst. Und der Update-Hinweis, ab Werk aus: eingeschaltet
fragt er einmal je Start dieses Repository nach dem neuesten Release.

`npm run audit:safety` prüft diese Regeln mechanisch, an der Quelle, bei jeder
Änderung. [Was das Audit prüft](#was-das-audit-prüft) zählt sie auf.

Trotzdem kann dir niemand zusichern, dass ein Drittprogramm ohne Folgen
bleibt. Easy Anti-Cheat ist proprietär, und Amazon behält sich in seinen
Verhaltensregeln vor, nach eigenem Ermessen gegen nicht genehmigte Werkzeuge
vorzugehen. Eine Log-Datei zu lesen, die das Spiel selbst erzeugt, liegt weit
außerhalb dessen, wogegen Anti-Cheat dokumentiert vorgeht, aber null ist das
Risiko nicht. Benutz es für deine eigenen Zahlen.

---

## Was das Audit prüft

`npm run audit:safety` liest den Quelltext und lässt den Build scheitern, sobald
Borometer mehr könnte, als das Kampflog zu lesen. Unter seinen Regeln:

- nichts berührt das Spiel: kein Zugriff auf den Prozess, kein Lesen des Speichers,
  keine DLL, kein Hook, kein Overlay; den Ordner des Spiels liest es nur;
- die Seite hat kein Netz: sie spricht HTTP nur mit `127.0.0.1`, und jede Anfrage
  beginnt mit `/api/`;
- der Hauptprozess geht nur an drei Stellen nach außen, und nur, wenn du es willst:
  zu Questlog auf einen Klick und für den Update-Hinweis (ab Werk aus, eine Anfrage
  nach dem neuesten Release dieses Repositorys), beide an genau eine feste Adresse;
  und zum Gruppen-Server, dessen Adresse du selbst einträgst (für ihn prüft das
  Audit, dass kein Dateiinhalt hinausgeht und dass ihn nur POST-Routen erreichen);
- der Hauptprozess löscht keine Datei, Builds, Pläne, beste Pulls und Weeklies
  werden nur gelöst, nie entfernt; Dateien
  schreibt es nur dorthin, wo Borometer seine eigenen ablegt;
- der Quelltext enthält keine Spielbilder (sie kommen aus einem privaten Repository
  in den Release-Build, siehe „Aus dem Quelltext bauen“).

`npm run audit:negative` bricht jede Regel absichtlich in einer Arbeitskopie und
prüft, dass das Audit es merkt. Beides läuft bei jedem Push ([CI](.github/workflows/build.yml)).

## Einen Download prüfen

Jedes Release baut die CI dieses Repositorys aus dem getaggten Commit, mit einem
Herkunftsnachweis (Provenance-Attestation):

    gh attestation verify Borometer-Setup-1.9.0.exe --repo B0R0AK/Borometer

Windows SmartScreen kann beim ersten Start warnen: die Exe ist nicht signiert.

## Aus dem Quelltext bauen

    npm ci
    npm run dist:win

Das baut dieselbe App ohne Spielbilder: Skills, Bosse und Gegenstände zeigen
stattdessen Borometers eigene gezeichnete Marken. Die Release-Downloads betten die
Bilder aus einem privaten Repository ein (Amazons Content Usage Policy erlaubt sie in
der App, nicht als einzelne Dateien).

---

## Fanprojekt

Borometer ist ein Fanprojekt und kostenlos. Es ist weder von Amazon Games noch
von NCSOFT hergestellt, unterstützt oder geprüft, und es besteht keine Verbindung zu
ihnen. Throne and Liberty und alle Namen, Symbole und Bilder aus dem Spiel gehören
ihren Rechteinhabern.

Amazons Content Usage Policy erlaubt Spielinhalte in kostenlosen, nichtkommerziellen
Inhalten für die Spielgemeinschaft. Genau das soll Borometer sein, und so wird es
bleiben: keine Bezahlfassung, keine Werbung, keine Spenden für den Zugang.

## Lizenz

Borometer steht unter der **GNU General Public License, Version 3** oder einer
späteren Fassung. Der Text liegt in [`LICENSE`](LICENSE).

Das heißt: du darfst es benutzen, lesen, ändern und weitergeben. Wenn du eine
geänderte Fassung weitergibst, musst du den Quelltext dazu mitgeben, unter derselben
Lizenz. Bei diesem Programm ist das leicht: der Quelltext liegt vollständig in diesem
Repository, und die gebaute `boro-meter.html` trägt die ganze Oberfläche lesbar
in sich.

Was von anderen stammt und eigenen Bedingungen unterliegt, steht in
[`licenses/`](licenses/README.md): die Schriften unter der SIL Open Font License, die
Bibliotheken im gebauten Programm und, wichtig, die **Bilder aus dem Spiel, die
nicht von der GPL erfasst sind und es nicht sein können.**
