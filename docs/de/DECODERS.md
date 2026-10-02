# PhantomSDR-Plus — Benutzerhandbuch der Decoder

Dieses Handbuch behandelt alle in PhantomSDR-Plus integrierten Decoder. Alle Decoder werden auf dieselbe, nachfolgend beschriebene Weise aktiviert; danach folgen die Einrichtungsanweisungen für jeden einzelnen Decoder.

---

## Inhaltsverzeichnis

1. [Einen Decoder starten](#1-einen-decoder-starten)
2. [FT8](#2-ft8)
3. [FT4-FT2](#3-ft4-ft2)
4. [JS8](#4-js8)
5. [CW — Morsetelegrafie](#5-cw--morsetelegrafie)
6. [QRSS Grabber](#6-qrss-grabber)
7. [WSPR](#7-wspr)
8. [HF-FAX / WEFAX](#8-hf-fax--wefax)
9. [NAVTEX](#9-navtex)
10. [FSK / RTTY — einschließlich PSK31 und Olivia](#10-fsk--rtty--einschließlich-psk31-und-olivia)
11. [SSTV](#11-sstv)
12. [Allgemeine Tipps](#12-allgemeine-tipps)

---

## 1. Einen Decoder starten

Alle Decoder erreichen Sie über den Abschnitt **Decoder Options** unterhalb der Bedienelemente des Audiospektrogramms im Hauptfenster.

**Schritte:**

1. Klicken Sie auf die Schaltfläche **Decoder: OFF**, um sie auf **Decoder: ON** umzuschalten (sie wird blau, wenn sie aktiv ist).
2. Öffnen Sie das Auswahlmenü, das rechts neben der Schaltfläche erscheint, und wählen Sie den gewünschten Decoder.
3. Das Bedienfeld des gewählten Decoders erscheint unterhalb der Bedienelemente — folgen Sie den decoderspezifischen Anweisungen im entsprechenden Abschnitt dieses Handbuchs.
4. Um die Dekodierung zu beenden, wählen Sie **— Select decoder —** aus dem Menü, oder klicken Sie auf **Decoder: ON**, um wieder auf OFF zu schalten.

### Decoder-Tasten mit einem Druck

Das Dropdown-Menü ist nicht der einzige Weg. Das Hauptpanel enthält eine Tastenreihe **Decoders** — direkt unter **Wheel Tuning Steps** — mit einer Taste je Decoder:

| Taste | Decoder | Taste | Decoder |
|---|---|---|---|
| **FT8** | FT8 | **SSTV** | SSTV |
| **FT4** | FT4 | **NAVTEX** | NAVTEX |
| **FT2** | FT2 | **RTTY** | FSK / RTTY |
| **CW** | CW | | |
| **WSPR** | WSPR | **FAX** | HF FAX / WEFAX |

Ein Tastendruck erledigt den ganzen Ablauf: Er wählt den Decoder aus, schaltet den Decoder ON und holt sein Fenster in den sichtbaren Bereich. Die Taste leuchtet blau, solange ihr Decoder läuft. **Ein erneuter Druck auf dieselbe Taste schaltet den Decoder ab** — sein Fenster schließt sich mit.

**RADEL** und **RADEU** fehlen in dieser Reihe absichtlich. Sie sind Digital-Voice-Betriebsarten und keine Text-Decoder, deshalb haben sie ein eigenes Tastenpaar neben der Überschrift **Modes selector** sowie in den Popup-Fenstern **Modes** und **Bands**. Diese verhalten sich genau gleich — drücken zum Starten, erneut drücken zum Stoppen. Siehe das [RADE-Handbuch](RADE_README.md).

Die Tasten, das Dropdown-Menü und die ON/OFF-Taste steuern denselben Zustand — was Sie auch benutzen, das Übrige folgt.

> Es kann immer nur ein Decoder aktiv sein. Der Wechsel zu einem anderen Decoder beendet den vorherigen automatisch.
>
> Der **QRSS-Grabber** gehört nicht zu diesem Auswahlmenü — er hat einen eigenen Bereich **QRSS** und kann gleichzeitig mit einem Decoder laufen.

**Die Dekodierung läuft im Hintergrund.** SSTV, HF-FAX, NAVTEX, FSK/RTTY und CW laufen jeweils in einem eigenen Web-Worker-Thread, sodass die Dekodierarbeit nie mit der Audiowiedergabe oder dem Wasserfall konkurriert. Das Starten oder Beenden eines Decoders unterbricht den Ton nicht, und die Oberfläche bleibt reaktionsschnell, während ein Bild oder eine Seite empfangen wird. Alle Decoder erhalten Rohaudio, das *vor* AGC, Rauschminderung und Stummschaltung abgegriffen wird — den Empfänger stummzuschalten oder diese Einstellungen nach Gehör zu verändern, wirkt sich also nicht auf die Dekodierung aus.

**Ein laufender Decoder besitzt Betriebsart und Durchlassbereich.** Normalerweise folgt die Betriebsart dem Bandplan in `bands-config.js`: Fährt die Abstimmung in einen als LSB oder AM gekennzeichneten Abschnitt, schaltet der Empfänger um. Solange ein Decoder läuft, geschieht das nicht mehr. Der Decoder hält die Betriebsart, die er braucht (USB bei den meisten, eine eigene bei RADE), und den Durchlassbereich, den er braucht — PSK31 etwa ±100 Hz, Olivia seine volle Bandbreite, RTTY seinen Shift — und beides überlebt ein Umstimmen, auch den Sprung auf ein anderes Band. Ohne das würde FT8 auf 40 m den Empfänger auf LSB umschalten, sobald die Abstimmung bewegt wird, und die schmalen Decoder-Durchlassbereiche würden wieder auf das volle SSB-Filter aufgehen.

Die bandeigene Betriebsart kehrt in dem Moment zurück, in dem Sie den Decoder abschalten. Von Hand können Sie die Betriebsart jederzeit überstimmen: Die Mode-Schaltflächen sind eine bewusste Entscheidung und setzen sich immer durch. Der CW-Decoder ist die Ausnahme von alldem — er dekodiert in der Betriebsart, in der Sie gerade hören, und übernimmt den Empfänger nie.


### Decoder ID — die Betriebsart automatisch erkennen

Über den Decoder-Tasten liegt das Feld **Decoder ID**. Es beantwortet die Frage *„Was höre ich da eigentlich?"*, wenn Sie auf ein digitales Signal stoßen, das Sie nicht einordnen können, und bietet anschließend den passenden Decoder mit einem Klick an.

Es ist **standardmäßig ausgeschaltet** und kostet im ausgeschalteten Zustand nichts. Drücken Sie **On** und lassen Sie das Signal eingestellt. Etwa eine halbe Minute lang zeigt es *Listening…* mit einem Fortschrittsbalken — die Zeitmessungen müssen zwei vollständige FT8-Zyklen sehen, bevor sie aussagekräftig sind — und benennt dann die Betriebsart:

```
Decoder ID [On]   NAVTEX / SITOR-B  99% 📻   170 Hz shift · 100.00 Bd · 43 dB S/N   [ Use NAVTEX ]
```

* Die **Betriebsart** und ein **Vertrauenswert**. Grün über 75 %, gelb über 50 %, orange darunter — eine orange Antwort ist ein Hinweis, kein Urteil.
* **Was tatsächlich gemessen wurde**: belegte Bandbreite, Tonabstand, Symbolrate, Burst-Länge, das passende UTC-Raster, Signal-Rausch-Abstand. Das ist die Beweisgrundlage hinter dem Urteil, damit Sie selbst urteilen können.
* **Use <Betriebsart>** startet den richtigen Decoder, genau so, als hätten Sie dessen Taste gedrückt — und richtet dabei den Empfänger auf diese Betriebsart ein. Bei den Betriebsarten im FSK-Panel wird zusätzlich die richtige Variante gewählt — RTTY, Wetter-RTTY, PSK31 oder Olivia.
* Die nächstplatzierten Kandidaten stehen nach **or**. Ein Klick probiert stattdessen diesen aus — eine falsche erste Antwort kostet Sie also nichts.
* **📻** bedeutet, dass die eingestellte Frequenz eine bekannte Anruffrequenz für diese Betriebsart ist und dass dies in die Bewertung eingeflossen ist.

Es schaltet Ihren Decoder niemals selbst um. Es schlägt immer nur vor. Und sobald Sie einen Decoder starten — über die Tastenreihe, über die Auswahlliste oder über die Schaltfläche **Use** der Decoder ID — schaltet sich die Decoder ID selbst ab: ihre Aufgabe war es, einen auszuwählen, und der Decoder braucht nun dasselbe Audiosignal.

**Es richtet den Empfänger auf die Betriebsart ein.** Eine Betriebsart zu wählen heißt, sie auch arbeiten zu wollen, also folgt der Empfänger: Die Abstimmfrequenz rückt in die Mitte des Wasserfalls und die Ansicht wird rund 100 kHz breit, das Seitenband wird das, auf dem diese Betriebsart gearbeitet wird, und der Durchlassbereich verengt sich auf das Fenster, in dem diese Betriebsart lebt — das gesamte 3-kHz-Teilband für FT8, FT4, FT2 und JS8, 1350–1650 Hz für WSPR, 250–750 Hz für NAVTEX, 800–2700 Hz für HF-FAX, 900–2600 Hz für SSTV und ±250 Hz beiderseits der Abstimmfrequenz für CW, wobei zusätzlich auf CW umgeschaltet wird. Ein schmaler Durchlassbereich hält die Nachbarsignale aus dem Decoder heraus — genau das, was Sie von Hand getan hätten. Zwei Ausnahmen: SSTV behält das Seitenband, das es selbst gewählt hat — auf 80 und 40 m üblicherweise LSB, wo ein erzwungenes USB die Tonzuordnung umkehren würde — und die FSK-Betriebsarten behalten das Fenster, das ihr eigenes Panel aus Shift oder Bandbreite der Variante ableitet und das enger ist als jeder feste Wert. Ein Druck auf **Use** beim bereits laufenden Decoder schaltet ihn weiterhin ab; der Empfänger bleibt dann genau so, wie er war.

**Die langsamen Betriebsarten brauchen länger.** WSPR liegt auf einem Zwei-Minuten-Raster und SSTV-Bilder laufen ein bis zwei Minuten, deshalb werden diese beiden später benannt als die übrigen — geben Sie ihnen drei bis vier Minuten auf der Frequenz. HF-FAX und SSTV werden außerdem nur erkannt, wenn sie wie üblich abgestimmt sind — das Bildband liegt dann bei etwa 1500 bis 2300 Hz im NF-Bereich, dort, wo es auch ihre Decoder erwarten. Ein Frequenzwechsel startet die Messung von vorn, denn alles bisher Gesammelte beschreibt die gerade verlassene Frequenz.

**Was es erkennt:** FT8, FT4, JS8, WSPR, CW, NAVTEX/SITOR-B, RTTY mit 45,45 Bd, Wetter-RTTY (DWD), PSK31, Olivia, HF-FAX, SSTV und DSC. In dieser Version gibt es keinen DSC-Decoder, daher wird DSC benannt und mit *no decoder* gekennzeichnet.

**Recentre & retry.** Wo das Signal im NF-Durchlassbereich liegt, spielt zwischen etwa 400 Hz und 2700 Hz keine Rolle. Außerhalb dieses Bereichs verschlechtert sich die Messung, und eine gelbe Schaltfläche **Recentre & retry** erscheint. Ein Druck darauf verschiebt die Abstimmung so, dass das Signal in der Mitte des Durchlassbereichs liegt, und startet eine neue Messung. Das ist ein einzelner berechneter Schritt, keine Suche.

**Drei ehrliche Grenzen:**

* **FT8, JS8 und FT2 sind dasselbe Signal.** Dieselbe 8-FSK-Modulation, derselbe Tonabstand, und JS8 verwendet bei Normal-Geschwindigkeit den 15-Sekunden-Takt von FT8. Am Signal selbst lassen sie sich nicht unterscheiden. An der Frequenz schon: auf einer FT8-Anruffrequenz meldet es FT8, auf einer JS8-Frequenz JS8, und überall sonst meldet es ehrlich die Familie — *FT8 / JS8 / FT2*. Starten Sie einen der beiden Decoder und sehen Sie, welcher Text liefert.
* **Es schweigt lieber, als zu raten.** Unterhalb von etwa 10 dB Signal-Rausch-Abstand meldet es *Nothing above the noise* oder *Not recognised*, statt eine Betriebsart zu benennen, die es nicht wirklich erkennen kann. Das ist Absicht: eine selbstbewusst falsche Antwort ist schlimmer als gar keine.
* **Ein schwankendes Signal wird anders gelesen.** WSPR sendet 110 Sekunden ohne Unterbrechung, also länger als ein gewöhnlicher QSB-Einbruch dauert. Ein tiefer Schwund zerschneidet die Aussendung deshalb in Stücke, und ihr Zwei-Minuten-Takt lässt sich daraus nicht mehr ablesen. Er wird dann auf einem anderen Weg zurückgewonnen: Der gesamte Beobachtungszeitraum wird gegen das Zwei-Minuten-Raster geprüft statt gegen einzelne Aussendungen. In der Messzeile steht dann *120 s grid (through fading)*. Das ist ein schwächerer Beleg als eine vollständig gehörte Aussendung, deshalb ist die angezeigte Sicherheit bewusst geringer. Ein Schwund, der das Signal ganz im Rauschen versinken lässt, ist gar nicht mehr zu retten. Olivia ist strenger als die übrigen: Sie wird erst benannt, wenn ihre Symbolrate gemessen ist, und verstummt daher früher.

---

## 2. FT8

**Worum es geht:** FT8 ist eine weit verbreitete digitale Schwachsignal-Betriebsart, die Funkamateure weltweit nutzen. Aussendungen dauern genau 15 Sekunden, und das Protokoll kann Signale bis 20–25 dB unter dem Rauschteppich aufnehmen. Es ist die am häufigsten genutzte Betriebsart für Weitverbindungen (DX).

### Empfohlene Frequenzen (USB)

| Band | Frequenz |
|------|----------|
| 160 m | 1.840 MHz |
| 80 m  | 3.573 MHz |
| 40 m  | 7.074 MHz |
| 30 m  | 10.136 MHz |
| 20 m  | 14.074 MHz |
| 17 m  | 18.100 MHz |
| 15 m  | 21.074 MHz |
| 12 m  | 24.915 MHz |
| 10 m  | 28.074 MHz |

### Einrichtung

1. Stimmen Sie auf eine der oben genannten FT8-Frequenzen ab und stellen Sie die Betriebsart auf **USB**.
2. Aktivieren Sie den Decoder und wählen Sie **FT8** aus dem Menü. Oder drücken Sie einfach die Taste **FT8**.
3. Das Bedienfeld **FT8 Messages** erscheint automatisch darunter.

### Die Ausgabe lesen

Die Meldungsliste zeigt dekodierte Aussendungen, sobald sie eintreffen. Jeder 15-Sekunden-Zyklus liefert einen neuen Schwung Meldungen. Das Feld **Farthest** (oben rechts im Bedienfeld) zeigt die größte in der laufenden Sitzung dekodierte Entfernung in Kilometern.

Typisches Meldungsformat: `CQ DX AA1BB FN31` — ein CQ-Ruf des Rufzeichens AA1BB aus dem Planquadrat FN31.

> **Tipp:** FT8 ist eng zeitsynchronisiert. Ihr Browser nutzt die Uhr Ihres Rechners; weicht die Systemzeit um mehr als ein paar Sekunden ab, schlägt die Dekodierung fehl. Halten Sie Ihre Systemzeit per NTP synchron.

---

## 3. FT4-FT2

**Worum es geht:** FT4 ist eine schnellere Variante von FT8, gedacht für Contest-Betrieb. Jeder Sendezyklus dauert 7,5 Sekunden (die Hälfte von FT8), wodurch die Betriebsart doppelt so schnell ist, aber ein etwas stärkeres Signal benötigt. FT2 ist eine noch schnellere Variante von FT8. Es handelt sich um eine ultraschnelle 77-Bit-Betriebsart mit TR-Perioden von 3,75 Sekunden (= die Hälfte von FT4) — noch experimentell.

### Empfohlene Frequenzen (USB)

| Band | Frequenz FT4|
|------|-----------|
| 80 m  | 3.575 MHz |
| 40 m  | 7.047 MHz |
| 30 m  | 10.140 MHz |
| 20 m  | 14.080 MHz |
| 15 m  | 21.140 MHz |
| 10 m  | 28.180 MHz |

| Band | Frequenz FT2|
|------|-----------|
|160 m | 1.843 bis 1.846 |
|80 m   | 3.578 bis 3.581 |
|60 m   | 5.360 (regionale Vorschriften beachten) |
|40 m   | 7.052 bis 7.062 |
|30 m   | 10.144 |
|20 m   | 14.084 |
|17 m   | 18.108 |
|15 m   | 21.144 |
|12 m   | 24.923 |
|10 m   | 28.184 |

### Einrichtung

1. Stimmen Sie auf eine FT4-Frequenz ab und stellen Sie die Betriebsart auf **USB**.
2. Aktivieren Sie den Decoder und wählen Sie **FT4** oder **FT2** aus dem Menü. Oder drücken Sie einfach die Taste **FT4** / **FT2**.
3. Das Bedienfeld **FT4 Messages** bzw. **FT2 Messages** erscheint darunter, im Aufbau identisch mit dem FT8-Bedienfeld.

> **Hinweis:** FT4 und FT8 verwenden unterschiedliche Spektralformate und sind nicht austauschbar. Achten Sie darauf, dass Sie auf einer FT4-Frequenz stehen, wenn Sie diesen Decoder nutzen.

---

## 4. JS8

**Was es ist:** JS8 (der Modus von JS8Call) nimmt die Schwachsignal-Engine von FT8 und macht daraus einen Tastatur-zu-Tastatur-Gesprächsmodus. Während FT8 feste Nachrichten mit 13 Zeichen sendet, überträgt JS8 freien Text in kleinen Portionen und fügt aufeinanderfolgende Aussendungen wieder zu ganzen Sätzen zusammen — alles über etwa zwölf Zeichen kommt also über mehrere 15-Sekunden-Zyklen an. Die Empfindlichkeit entspricht etwa der von FT8, sodass er dort funktioniert, wo Sprache und CW nicht mehr durchkommen.

### Empfohlene Frequenzen (USB)

| Band | Frequenz |
|------|----------|
| 160m | 1.842 MHz |
| 80m  | 3.578 MHz |
| 40m  | 7.078 MHz |
| 30m  | 10.130 MHz |
| 20m  | 14.078 MHz |
| 17m  | 18.104 MHz |
| 15m  | 21.078 MHz |
| 12m  | 24.922 MHz |
| 10m  | 28.078 MHz |

### Geschwindigkeiten

JS8 kennt fünf Geschwindigkeiten. Alle Stationen eines Gesprächs müssen dieselbe verwenden. **Normal** ist die Anruf-Geschwindigkeit und trägt fast den gesamten Verkehr — dort beginnen.

| Geschwindigkeit | Zyklus | Bandbreite | Wofür |
|-----------------|--------|------------|-------|
| Slow   | 30 s | 25 Hz  | Sehr schwache Wege; am empfindlichsten |
| Normal | 15 s | 50 Hz  | Die übliche Anruf-Geschwindigkeit |
| Fast   | 10 s | 80 Hz  | Schnellerer Austausch, braucht stärkeres Signal |
| Turbo  | 6 s  | 160 Hz | Starke lokale Signale |
| Ultra  | 4 s  | 250 Hz | Experimentell, kaum auf dem Band zu sehen |

### Einrichtung

1. Auf eine JS8-Frequenz abstimmen und **USB** einstellen.
2. Decoder einschalten und **JS8** aus der Liste wählen, oder einfach die Taste **JS8** drücken.
3. Das Fenster **JS8 Decoder** erscheint darunter. **Speed** auf *Normal* stehen lassen, sofern die gesuchte Station nicht nachweislich eine andere benutzt.

### Die Ausgabe lesen

Das Fenster hat zwei Listen.

**Noch eintreffende Nachrichten** stehen oben in Grün mit blinkendem Cursor. Eine JS8-Nachricht kann vier Zyklen dauern — bei Normal eine volle Minute — hier sieht man den Satz entstehen. Es ist kein Fehler, wenn das eine Weile so bleibt.

**Fertige Nachrichten** füllen die Hauptliste, je eine Zeile:

| Spalte | Bedeutung |
|--------|-----------|
| Mode | Immer `JS8` |
| Hz | NF-Frequenz des Signals im Durchlassbereich |
| dB | Signal-Rausch-Abstand in 2500 Hz Bezugsbandbreite |
| Message | Der dekodierte Text; **Rufzeichen erscheinen grün** |

Typische Nachrichten:

* `SV1BTL KM17: HB` — ein Heartbeat: die Station meldet, dass sie auf dem Band ist, mit ihrem Locator.
* `KN4CRD: K0OG SNR -05` — eine gerichtete Nachricht: KN4CRD teilt K0OG mit, dass er ihn mit −5 dB hört.
* `MP 100W 8M/BALUN JN58KH AUGSBURG, MARTIN` — freier Text, hier eine Stationsbeschreibung über vier Zyklen.

Eine **blass und kursiv** dargestellte Zeile ist abgelaufen, bevor ihr letzter Rahmen ankam. Der Text ist echt, kann aber abgeschnitten sein.

### Sync offset

Der Regler **Sync offset** bestimmt, wie lange nach der UTC-Zyklusgrenze die Aufzeichnung beginnt, und gleicht damit die Laufzeit der Audiokette aus. **Auto** aktiviert lassen: der Decoder misst das Timing der empfangenen Signale und stellt sich selbst nach.

### Spektrum-Markierungen

Der kleine Spektrumstreifen im Fenster zeichnet für jedes im letzten Zyklus dekodierte Signal eine gelbe senkrechte Linie, sodass sich die Hz-Spalte direkt am Display ablesen lässt.

### Die eigenen Spots sehen

Wenn der Empfänger JS8-Spots an PSK Reporter meldet (siehe den Reiter Spot Reporting im Admin-Panel), öffnet die Schaltfläche **📡 JS8 map** im Feld **Note:** die Karte von PSK Reporter, gefiltert auf das Rufzeichen dieses Empfängers und den Modus JS8 — genau wie **📡 FT8 map** und **📡 FT4 map** für jene Modi.

> **Tipp:** JS8 ist viel ruhiger als FT8. An einem Nachmittag kann eine Aussendung alle paar Minuten normal sein, ebenso längere Pausen ganz ohne Betrieb. Geben Sie ihm fünf bis zehn Minuten, bevor Sie einen Fehler vermuten. 20m (14.078) und 40m (7.078) sind die üblichen Anlaufstellen.

> **Tipp:** Wie FT8 ist JS8 streng zeitsynchron und nutzt die Uhr Ihres Rechners. Weicht die Systemzeit um mehr als ein bis zwei Sekunden ab, wird nichts dekodiert. Halten Sie sie per NTP synchron.

---

## 5. CW — Morsetelegrafie

**Worum es geht:** Der CW-Decoder horcht auf Morsesignale (Continuous Wave) und wandelt sie in Echtzeit in Text um. Er verfolgt die Signalfrequenz automatisch und passt sich der Gebegeschwindigkeit des Operators an.

### Empfohlene Frequenzen

CW ist auf allen Amateurbändern aktiv, typischerweise im unteren Teil jedes Bandes. Übliche Stellen:

| Band | Segment |
|------|---------|
| 40 m  | 7.000–7.040 MHz |
| 20 m  | 14.000–14.070 MHz |
| 15 m  | 21.000–21.080 MHz |

### Einrichtung

1. Stimmen Sie auf ein CW-Signal ab und verwenden Sie je nach Situation die Demodulationsart **CW** oder **CW-L**.
2. Aktivieren Sie den Decoder und wählen Sie **CW** aus dem Menü. Oder drücken Sie einfach die Taste **CW**.
3. Das Bedienfeld **CW Decoder** erscheint darunter.

### Die Ausgabe lesen

- Die Kopfzeile des Bedienfelds zeigt die erkannte Signalfrequenz in Hz (z. B. `≈ 700 Hz`) und die geschätzte Gebegeschwindigkeit in Wörtern pro Minute (z. B. `· 22 WPM`).
- Wird kein Signal erkannt, zeigt die Kopfzeile **scanning…**
- Der dekodierte Text läuft in bernsteinfarbener Festbreitenschrift durch. Der blinkende Cursor (▋) markiert die Stelle, an der gerade geschrieben wird.
- Klicken Sie auf **Clear**, um den Ausgabepuffer zu löschen.

> **Tipps:**
> - Zentrieren Sie Ihren Durchlassbereich auf den CW-Ton. Der Decoder arbeitet am besten, wenn das CW-Signal etwa zwischen 400 und 900 Hz im Audiospektrum liegt.
> - Sehr schnelles oder sehr langsames Geben sowie stark handgetastetes (unregelmäßiges) Morsen können die Genauigkeit verringern.
> - Der Decoder liefert die besten Ergebnisse bei einem einzelnen sauberen Signal. Starkes QRM benachbarter Signale auf demselben Band kann ihn verwirren.

---

## 6. QRSS Grabber

**Was es ist:** QRSS ist CW, das so langsam gegeben wird, dass ein einzelner Punkt Sekunden statt Millisekunden dauert. Bei dieser Geschwindigkeit belegt das Signal nur einen Bruchteil eines Hertz, sodass eine entsprechend schmale Analyse die Spur noch 20–30 dB *unter* dem Rauschpegel sichtbar macht. Mit dem Ohr ist dabei nichts zu holen — QRSS wird **angeschaut**, nicht angehört. Der Grabber rechnet eine eigene, sehr lange FFT über das Empfängeraudio und zeichnet die klassische Grabber-Darstellung: Frequenz auf der senkrechten Achse, Zeit von links nach rechts laufend, die neueste Spalte immer am rechten Rand.

Das meiste, was Sie sehen werden, stammt von MEPT-Baken (Manned Experimental Propagation Transmitter) — Sender kleinster Leistung, oft ein paar hundert Milliwatt an einem Draht, die sich fortlaufend in sehr langsamem Morse oder in FSK-Mustern identifizieren.

### Wo man suchen muss

QRSS-Baken leben in schmalen Fenstern von 100–200 Hz nahe dem unteren Bandende. Sie müssen sie nicht auswendig kennen: Der Grabber hat eine Liste **Band** mit den unten aufgeführten Fenstern, und eine Auswahl stimmt darauf ab und richtet den Empfänger dafür ein (siehe *Den Grabber öffnen*).

| Band | Fenstermitte | Hinweis |
|------|---------------|------|
| 30m | 10.140,00 kHz | Das Haupt-QRSS-Fenster — mit Abstand das belebteste, Tag und Nacht |
| 40m | 7.039,90 kHz |  |
| 40m | 7.000,85 kHz | Knights-Fenster, 7.000,8–7.000,9 kHz |
| 20m | 14.096,90 kHz |  |
| 80m | 3.569,90 kHz |  |
| 80m | 3.568,60 kHz | Älteres Fenster |
| 80m | 3.500,85 kHz | Knights-Fenster, 3.500,8–3.500,9 kHz |
| 160m | 1.837,90 kHz |  |
| 160m | 1.843,30 kHz | Älteres Fenster |
| 630m | 476,10 kHz |  |
| 2200m | 137,70 kHz | LF-QRSS / DFCW |
| 60m | 5.288,55 kHz |  |
| 17m | 18.105,90 kHz |  |
| 15m | 21.095,90 kHz |  |
| 12m | 24.925,90 kHz |  |
| 10m | 28.125,70 kHz |  |
| 10m | 28.000,85 kHz | Älteres Fenster |
| 10m | 28.322,00 kHz | Alternative |
| 6m | 50.294,30 kHz |  |

Mehrere Bänder erscheinen doppelt, weil tatsächlich zwei Konventionen in Gebrauch sind. Die moderneren Fenster liegen 200 Hz unterhalb der WSPR-Frequenz des jeweiligen Bandes; die älteren *Knights*-Fenster liegen ganz woanders, auf 40 und 80 m deutlich tiefer. Ist ein Band auf dem einen still, versuchen Sie das andere.

Das sind Konventionen, keine Vorschriften, und einige sind regional — besonders die Werte für 10 m schwanken. Nehmen Sie die Liste als Ausgangspunkt und richten Sie sich nach der örtlichen Praxis.

### Den Grabber öffnen

Der QRSS-Grabber steht **nicht** im Decoder-Auswahlmenü. Er hat einen eigenen Bereich **QRSS**, neben den Bedienelementen für Spektrogramm und Decoder.

1. **🐌 Show** anklicken. Die Grabber-Fläche erscheint, und die Bedienelemente klappen neben der Schaltfläche auf.
2. Ein Fenster aus der Liste **Band** wählen und **Tune** drücken. Das erledigt alles, was die Betriebsart braucht, in einem Schritt: Es stimmt auf das Fenster ab, schaltet den Empfänger auf **CW** und setzt einen Durchlassbereich, der gerade breit genug für den beobachteten Ausschnitt ist. Die Anzeige zeigt danach die echte QRSS-Frequenz, und die Spuren landen auf der Mittellinie der Darstellung.
3. **Speed** auf die Punktlänge der Bake einstellen.
4. **Centre** und **Span** wirken wie bisher; eine Änderung formt den Durchlassbereich mit, sodass Anzeige und Empfänger im Gleichschritt bleiben.
5. **🐌 Hide** anklicken, um zu beenden. Die normale Betriebsart des Bandes kehrt zurück.

Von Hand geht es weiterhin auch — in **USB** etwa 1 kHz unterhalb des Fensters abstimmen, damit die Spuren bei rund 800 Hz Audio landen. Die Liste **Band** erspart Ihnen nur die Rechnerei.

Solange ein Fenster aus der Liste abgestimmt ist, hält der Grabber den Empfänger so fest wie ein Decoder: CW und sein Durchlassbereich überleben ein Umstimmen, und das Fenster folgt der Abstimmung, sodass die Spur beim Absuchen des Bandes auf der Mittellinie bleibt. Er gibt den Empfänger frei, sobald Sie den Grabber ausblenden, eine Mode-Schaltfläche drücken oder einen Decoder starten.

### Geschwindigkeiten

| Einstellung | Punktlänge | Auflösung | Analysefenster | Neue Spalte alle |
|-------------|-----------|-----------|----------------|------------------|
| QRSS 3  | 3 s  | 0,73 Hz | 1,4 s  | 0,7 s  |
| QRSS 6  | 6 s  | 0,37 Hz | 2,7 s  | 1,4 s  |
| QRSS 10 | 10 s | 0,18 Hz | 5,5 s  | 2,7 s  |
| QRSS 30 | 30 s | 0,09 Hz | 10,9 s | 5,5 s  |
| QRSS 60 | 60 s | 0,05 Hz | 21,8 s | 10,9 s |

Eine Einstellung, die schneller ist als die Bake, verschenkt Empfindlichkeit — die Spur wird dünn und verrauscht. Eine langsamere Einstellung verschmiert aufeinanderfolgende Punkte und Striche zu einem einzigen Balken. Das Panel startet mit **QRSS 6**, ein sinnvoller Ausgangspunkt bei einem unbekannten Signal: empfindlicher als QRSS 3, dabei schneller in der Anzeige und toleranter gegenüber Drift als QRSS 10. Sobald die Form der Tastung erkennbar ist, wechseln Sie auf die Geschwindigkeit, die die Bake tatsächlich sendet — jede Stufe schneller kostet 3 dB Empfindlichkeit.

### Bedienelemente

| Bedienelement | Wirkung |
|---------------|---------|
| **Band** | Die oben aufgeführten QRSS-Fenster. **Tune** stimmt auf das gewählte ab, in CW mit passendem Durchlassbereich. |
| **Speed** | Legt die Transformationslänge fest — den Kompromiss zwischen Frequenz- und Zeitauflösung (Tabelle oben). |
| **Centre** | Audiofrequenz in der Mitte der Anzeige, 100–3000 Hz. |
| **Span** | Höhe des dargestellten Ausschnitts: 20, 50, 100 oder 200 Hz, beim Start 100 Hz — die Breite eines QRSS-Subbands. Ein schmalerer Ausschnitt verteilt jede Spur auf mehr Pixel. Bei breiteren Ausschnitten fallen mehr Bins in das Panel, als es Pixelzeilen hat; jede Zeile zeigt dann das stärkste von ihr überdeckte Bin, sodass sich nichts zwischen den Zeilen verstecken kann. |
| **Gain** | −10 bis +40 dB. Verschiebt die Farbskala gegenüber dem gemessenen Rauschpegel; erhöhen, um schwache Spuren aufzuhellen. |
| **Color** | Rainbow, Green oder Grayscale. |
| **Clear** | Löscht die Fläche und setzt die Rauschreferenz zurück. |

### Die Anzeige lesen

Die Frequenzmarken laufen am linken Rand, die höchste Frequenz oben. Unter der Fläche zeigt eine Statuszeile die gewählte Geschwindigkeit, die tatsächlich verwendete Auflösung (z. B. `0.183 Hz/bin · 5.5 s window`) und die Spaltenrate (z. B. `2.7 s/column`).

Die Farbskala bezieht sich auf das **aktuelle** Rauschen, das laufend aus den leeren Teilen jeder Spalte gemessen wird, nicht auf einen absoluten Pegel. Änderungen an Lautstärke, AGC, Antenne oder Band erfordern daher keine neue Gain-Einstellung — die Anzeige hält den Kontrast gegenüber dem jeweiligen Bandrauschen konstant. Wie bei den Decodern wird das Audio vor AGC, Rauschunterdrückung und Stummschaltung abgegriffen; Sie können den Empfänger also stummschalten und trotzdem weiter zusehen.

Was die Formen bedeuten:

- Ein **konstanter Träger** zeichnet eine gerade waagerechte Linie.
- **Langsames Morsen** zeichnet diese Linie als Kette kurzer und langer Abschnitte — Punkte und Striche, von links nach rechts zu lesen.
- **Gebogene oder wandernde Spuren** stammen von einem nicht stabilisierten Bakenoszillator beim Aufwärmen oder Abkühlen. Das ist normal, und oft ist gerade diese Driftsignatur das, woran ein regelmäßiger Grabber-Beobachter eine Station wiedererkennt.
- **Senkrechte Streifen** über den ganzen Ausschnitt sind Atmosphärics oder lokale Störimpulse, kein Signal.

> **Tipps:**
> - Geduld. Bei QRSS 30 dauert eine einzelne Spalte 5,5 Sekunden, ein vollständiges Rufzeichen braucht also zehn Minuten oder mehr, um über den Schirm zu wandern. Einfach laufen lassen.
> - Beim Abstimmen über die Liste **Band** ist der Durchlassbereich um das Fenster bereits eingeengt. Wer von Hand abstimmt, macht es selbst: Das ändert nichts an dem, was die Transformation auflöst, hält aber starke Nachbarn davon ab, die AGC des Empfängers zu bedienen.
> - Der Grabber ist von den Decodern unabhängig — Sie können ihn laufen lassen, während ein Decoder an etwas anderem arbeitet.
> - Ein breiter Span bei langsamer Geschwindigkeit ist die aufwendigste Kombination; die gesamte Transformation läuft im Browser, auf einer bescheidenen Maschine also besser 50 Hz Span wählen.

---

## 7. WSPR

**Worum es geht:** WSPR (Weak Signal Propagation Reporter, ausgesprochen „whisper") ist eine Bakenbetriebsart für extrem schwache Signale, die KW-Ausbreitungswege weltweit kartiert. Jede Aussendung dauert etwa 110 Sekunden und passt in einen 200 Hz breiten Kanal. Der Decoder wartet auf einen vollständigen, an UTC ausgerichteten 2-Minuten-Zeitschlitz, bevor er dekodiert.

### Empfohlene Frequenzen (USB, Anzeigefrequenz)

| Band | Anzeigefrequenz |
|------|-----------------|
| 160 m | 1.836.600 MHz |
| 80 m  | 3.568.600 MHz |
| 40 m  | 7.038.600 MHz |
| 30 m  | 10.138.700 MHz |
| 20 m  | 14.095.600 MHz |
| 17 m  | 18.104.600 MHz |
| 15 m  | 21.094.600 MHz |

### Einrichtung

1. Stimmen Sie auf eine der oben genannten WSPR-Anzeigefrequenzen ab und stellen Sie die Betriebsart auf **USB**.
2. Das WSPR-Signal belegt den Audiobereich 1400–1600 Hz. Die Auswahl von **WSPR** erledigt den Rest: Der Empfänger schaltet auf USB und der Durchlassbereich verengt sich auf 1350–1650 Hz, was den gesamten Suchbereich des Decoders abdeckt. Weitere Anpassungen sind nicht nötig.
3. Aktivieren Sie den Decoder und wählen Sie **WSPR** aus dem Menü. Oder drücken Sie einfach die Taste **WSPR**.
4. Das Bedienfeld **WSPR-2 Decoder** erscheint darunter.

### Die Ausgabe lesen

Das Bedienfeld zeigt einen Fortschrittsbalken für den aktuellen 2-Minuten-Zeitschlitz:

- **Cyanfarbener Balken füllt sich** — Signaldaten werden gesammelt (0–116 s im Zeitschlitz).
- **Bernsteinfarbener Balken pulsiert** — Dekodierung läuft (letzte ~4 s des Zeitschlitzes).
- **Leerer Balken** — Warten auf die nächste gerade UTC-Minute.

Jeder erfolgreich dekodierte Spot erscheint in einer Tabelle mit folgenden Spalten:

| Spalte | Bedeutung |
|--------|-----------|
| UTC | Zeit des Spots (gerade Minute) |
| Callsign | Die Station, die gesendet hat |
| Grid | Maidenhead-Locator des Senders |
| Power | Sendeleistung in dBm |
| Freq | Genaue Audiofrequenz (Hz) innerhalb des WSPR-Durchlassbereichs |
| SNR | Signal-Rausch-Verhältnis in dB |

Klicken Sie auf **Clear**, um die Spot-Liste zu löschen.

> **Tipp:** Die WSPR-Dekodierung erfordert eine sehr genaue Systemzeit (innerhalb ±1 Sekunde zu UTC). Der erste Zeitschlitz nach dem Aktivieren des Decoders beginnt mit der nächsten geraden UTC-Minute — eine kurze Wartezeit ist normal.

---

## 8. HF-FAX / WEFAX

**Worum es geht:** HF-Radiofax (auch WEFAX genannt) wird von Küstenwachen und Wetterdiensten weltweit genutzt, um Wetterkarten, Seegangskarten und Bodenanalysen über Kurzwelle auszustrahlen. Der Decoder setzt das Bild Zeile für Zeile zusammen, während es empfangen wird.

### Einrichtung

1. Aktivieren Sie den Decoder und wählen Sie **HF FAX / WEFAX** aus dem Menü. Oder drücken Sie einfach die Taste **FAX**.
2. Das Bedienfeld **HF FAX / WEFAX Receiver** erscheint darunter.
3. **Wählen Sie eine Station** im Auswahlmenü Station. Über 20 Stationen stehen zur Verfügung und decken Europa, Asien, Ozeanien und Amerika ab (z. B. DDH3/DDK3 Deutschland, SVJ4/GR Griechenland, JMH Japan, NMG USA New Orleans).
4. Sendet die Station auf mehreren Frequenzen, wählen Sie die gewünschte im Untermenü **Frequency**.
5. Klicken Sie auf **▶ Tune**, um den Wasserfall automatisch auf diese Station abzustimmen.
6. Die Betriebsart wird automatisch auf **USB** gesetzt.

### Sendeplan

Ist eine Station gewählt, erscheint eine Countdown-Tabelle **Next Transmissions** mit den nächsten 4 geplanten Aussendungen in UTC und einem laufenden Countdown:

- Normal (grau/grün) — die Aussendung steht bevor.
- **Bernstein ⚡** — die Aussendung beginnt in weniger als 3 Minuten; jetzt den Decoder scharfschalten.
- **Rot ●** — die Aussendung beginnt in weniger als 30 Sekunden; der Empfang steht unmittelbar bevor.

### Parameter

Die meisten Stationen verwenden die Standardvorgaben (mit ★ markiert). Ändern Sie sie nur, wenn Sie wissen, dass die Station abweichende Einstellungen nutzt.

| Parameter | Vorgabe | Beschreibung |
|-----------|---------|--------------|
| LPM | 120 ★ | Zeilen pro Minute — die Trommeldrehzahl |
| IOC | 576 ★ | Kooperationsindex — bestimmt die Pixel pro Zeile |
| Shift | 800 Hz ★ | Frequenzhub zwischen Schwarz- und Weißton |

### Bedienelemente

- **⇔ Auto-align** — standardmäßig aktiviert. Synchronisiert automatisch auf das Phasensignal zu Beginn jedes Bildes. Deaktivieren Sie es nur, wenn Sie bei einem nachweislich guten Signal Ausrichtungsprobleme haben.
- **⇅ Invert** — vertauscht Schwarz und Weiß. Verwenden Sie es, wenn das Bild als Negativ erscheint (weiße Flächen dort, wo Schwarz sein sollte).
- **↺ Refresh** — löscht die Zeichenfläche und setzt den Decoder zurück. Nutzen Sie es zwischen zwei Aussendungen oder wenn das Bild reißt oder verläuft.
- **⤓ Save PNG** — speichert die aktuelle Zeichenfläche als PNG-Datei auf Ihrem Rechner.

### Statusanzeigen

Unter dem Bild zeigen zwei Tonanzeigen:

- **300 Hz phasing** — leuchtet cyan, wenn der Phasenton am Bildanfang erkannt wird.
- **450 Hz stop** — leuchtet rot, wenn der Stoppton am Bildende erkannt wird.

> **Hinweis:** Das Bild läuft nach oben — die zuletzt empfangene Zeile erscheint immer unten auf der Zeichenfläche. Steht **[PHASING]** in der Kopfzeile, hat der Decoder auf einen neuen Bildanfang eingerastet.

---

## 9. NAVTEX

**Worum es geht:** NAVTEX ist das internationale seefunkgestützte Aussendungssystem für küstennahe Sicherheitsinformationen — Navigationswarnungen, Wettervorhersagen sowie Such- und Rettungsmeldungen. Es verwendet 100-Baud-FSK (SITOR-B mit FEC) und wird weltweit auf eigenen Kanälen empfangen.

### Verfügbare Kanäle

| Kanal | Frequenz | Verwendung |
|-------|----------|------------|
| International | 518 kHz | Englischsprachig, international |
| National | 490 kHz | Aussendungen in der Landessprache |
| KW (×5) | 4209.5 / 6314 / 8416.5 / 12579 / 16806.5 kHz | KW-NAVTEX mit großer Reichweite |

### Einrichtung

1. Aktivieren Sie den Decoder und wählen Sie **NAVTEX** aus dem Menü. Oder drücken Sie einfach die Taste **NAVTEX**. Der Empfänger schaltet automatisch auf **USB**.
2. Das Bedienfeld **NAVTEX Receiver** erscheint.
3. Wählen Sie den gewünschten Kanal im Menü **Station** (z. B. `International — 518 kHz`).
4. Klicken Sie auf **⇒ Tune & Set IF**, um den Wasserfall automatisch abzustimmen und den Durchlassbereich auf das richtige Audiofenster einzuengen. Die Betriebsart wird automatisch auf **USB** gesetzt. Die Anzeigefrequenz liegt 500 Hz unter der Kanalmitte, sodass das NAVTEX-Signal bei 500 Hz im Audio erscheint.

### Sendeplan

Die Plantabelle listet alle bekannten Stationen des gewählten Kanals mit:

- ihrem ITU-Kennbuchstaben und der Landesflagge
- der nächsten Sendezeit in UTC
- einem laufenden Countdown bis zur nächsten Aussendung
- **Bernstein ⚡** bei unter 2 Minuten / **Rot ●** bei unter 30 Sekunden — jetzt den Decoder scharfschalten

### Die Ausgabe lesen

Der dekodierte Text erscheint in blaugrüner Festbreitenschrift. Die Meldungsgrenzen sind klar markiert:

```
━━ ZCZC MA12 ━━
... message content ...
━━ NNNN ━━
```

`ZCZC` markiert den Anfang einer Meldung. Die drei folgenden Zeichen kennzeichnen Station (`M`), Thema (`A` = Navigationswarnungen) und laufende Nummer (`12`). `NNNN` markiert das Ende.

Klicken Sie auf **Clear**, um den Meldungspuffer zu löschen.

> **Hinweis:** NAVTEX arbeitet auf MF- und LF-Frequenzen (518/490 kHz). Die Empfangsreichweite beträgt typischerweise 200–400 Seemeilen vom Sender. Die KW-Kanäle (4–17 MHz) bieten eine deutlich größere Reichweite.

---

## 10. FSK / RTTY — einschließlich PSK31 und Olivia

**Worum es geht:** Ein universeller Decoder für schmalbandige Textbetriebsarten mit fünf Varianten, die über ein einziges Auswahlmenü erreichbar sind. Drei davon sind echtes FSK (Frequency-Shift Keying): maritimes FSK (SITOR), Wetter-RTTY und Amateur-RTTY. Die anderen beiden sind überhaupt kein FSK, teilen sich aber dasselbe Fenster: **PSK31**, eine Phasenumtastung, und **Olivia**, ein Mehrton-FSK mit Vorwärtsfehlerkorrektur. Jede Variante bringt eine auf ihre Standardparameter abgestimmte Voreinstellung mit.

### Varianten und Voreinstellungen

| Variante | Mitte | Shift | Baud | Rahmen | Kodierung |
|----------|-------|-------|------|--------|-----------|
| Maritimes FSK / SITOR | 500 Hz | 170 Hz | 100 | 7N1 | CCIR-476 |
| Wetter-RTTY | 1000 Hz | 450 Hz | 50 | 5N1.5 | ITA2 |
| Amateur-RTTY | 1000 Hz | 170 Hz | 45.45 | 5N1.5 | ITA2 |
| PSK31 (BPSK) | 1000 Hz | — | 31.25 | — | Varicode |
| Olivia (MFSK) | 1000 Hz | — | siehe Mode | — | 7 Bit + FEC |

Das Bedienfeld passt sich der gewählten Variante an. **Shift**, **Baud**, **Framing**, **Encoding**, **Invert mark / space** und **Auto shift detect** werden bei PSK31 und Olivia ausgeblendet, da keine der beiden Betriebsarten ein Mark/Space-Tonpaar oder eine UART-artige Rahmung besitzt. Stattdessen wird **Center audio** zu einem frei beschreibbaren Zahlenfeld (der Träger kann überall im Durchlassbereich liegen), und Olivia erhält zusätzlich einen **Mode**-Wähler und einen **Squelch**-Regler.

### Einrichtung

1. Aktivieren Sie den Decoder und wählen Sie **FSK / RTTY** aus dem Menü. Oder drücken Sie einfach die Schaltfläche **RTTY**.
2. Das Decoder-Bedienfeld erscheint. Sein Titel richtet sich nach der Variante — *FSK / RTTY Decoder*, *PSK31 Decoder* oder *Olivia Decoder*.
3. Wählen Sie die **Variant**. Die Parameter werden automatisch aktualisiert.
4. Stellen Sie bei Olivia den **Mode** (Töne / Bandbreite) passend zur Aussendung ein — siehe die Olivia-Hinweise weiter unten.
5. Wählen Sie im Menü **Known frequency** eine gebräuchliche Frequenz für die gewählte Variante und klicken Sie dann auf **Tune**, um dorthin zu springen.
6. Feinabstimmen, bis der dekodierte Text stabil und lesbar wird.

### Bekannte Frequenzen nach Variante

**Maritimes FSK / SITOR**
- 518,0 kHz — internationales NAVTEX
- 490,0 kHz — nationales NAVTEX
- 4209,5 / 6314,0 / 8416,5 / 12579,0 / 16806,5 / 22376,0 kHz — HF-SITOR

**Wetter-RTTY**
- 4583,0 / 7646,0 / 10100,8 / 11039,0 / 14467,3 kHz — DWD (Deutscher Wetterdienst)

**Amateur-RTTY**
- 3590 kHz (80 m), 7043 kHz (40 m), 10143 kHz (30 m), 14083 kHz (20 m), 21083 kHz (15 m), 28083 kHz (10 m)

**PSK31**
- 3580,15 kHz (80 m), 7040,15 kHz (40 m), 10142,15 kHz (30 m), 14070,15 kHz (20 m), 18100,15 kHz (17 m), 21080,15 kHz (15 m), 24920,15 kHz (12 m), 28120,15 kHz (10 m)

**Olivia**
- 3577,75 kHz (80 m), 7073,75 kHz (40 m), 10142,25 kHz (30 m), 14075,5 kHz (20 m), 18103,75 kHz (17 m), 21075,75 kHz (15 m), 24921,75 kHz (12 m), 28123,75 kHz (10 m)

### Parameter

| Parameter | Gilt für | Beschreibung |
|-----------|----------|--------------|
| Center audio (Hz) | alle | Die Audiofrequenz der Mitte zwischen Mark und Space; bei PSK31 der Träger, bei Olivia die Mitte des Tonblocks. Ein Auswahlmenü bei den FSK-Varianten, ein freies Eingabefeld bei PSK31 und Olivia |
| Shift (Hz) | nur FSK | Frequenzunterschied zwischen Mark- und Space-Ton |
| Baud | nur FSK | Symbolrate |
| Framing | nur FSK | Datenbits, Parität, Stoppbits (z. B. 7N1 = 7 Daten, keine Parität, 1 Stopp) |
| Encoding | nur FSK | Zeichensatz (CCIR-476, ITA2/Baudot oder ASCII) |
| Invert mark / space | nur FSK | Vertauscht Mark- und Space-Ton |
| Auto shift detect | nur FSK | Versucht, den Shift automatisch aus dem eingehenden Signal zu messen |
| Mode (Töne / Hz) | nur Olivia | Anzahl der Töne und Bandbreite — muss exakt zur Aussendung passen |
| Squelch (FEC S/N) | nur Olivia | Wie stark die Übereinstimmung der Fehlerkorrektur sein muss, bevor Text ausgegeben wird |

### Signalmesswerte

Die Statuszeile zeigt Live-Messwerte, und die Felder wechseln mit der Variante:

| Variante | Angezeigte Felder |
|----------|-------------------|
| FSK-Varianten | **Mark / Space** (gemessene Tonfrequenzen), **SNR**, **Lock**, **Timing** |
| PSK31 | **Carrier** (Hz, nach automatischer Frequenzkorrektur), **IMD** (dB), **S/N**, **Lock**, **Timing** |
| Olivia | **Centre** (Hz), **Mode**, **S/N**, **FEC** (%), **Sync** |

`Timing`/`Sync` zeigt `LOCKED`/`SYNCED`, sobald der Decoder dem Signal folgt, und `SEARCH`, solange er noch sucht.

### Weitere Bedienelemente

- **⇒ Set IF Band-Pass** — verengt den Durchlassbereich des Empfängers so, dass er das Signal eng umschließt. Die Breite richtet sich nach der Variante: Mark/Space plus Rand bei FSK, etwa ±100 Hz bei PSK31 und die volle Tonblockbreite plus Rand bei Olivia.
- **⟳ Auto-tune Center** — automatische Suche nach dem Signal. Bei den FSK-Varianten sucht sie ein ausgewogenes Tonpaar, bei PSK31 findet sie den Träger, bei Olivia den stärksten Block der gewählten Bandbreite.

### Hinweise zu PSK31

PSK31 ist die verbreitetste Tastatur-zu-Tastatur-Betriebsart auf Kurzwelle. Sie ist nur 62 Hz breit, sodass mehrere Verbindungen innerhalb weniger hundert Hertz um die übliche Sammelfrequenz nebeneinander liegen; das Abstimmen besteht darin, im Wasserfall eine Spur aus der Gruppe herauszugreifen.

- Der Decoder korrigiert seinen Abstimmfehler über etwa **±25 Hz** selbst, Sie müssen also nur in die Nähe kommen. **Carrier** in der Messwertzeile zeigt, wo er sich tatsächlich eingependelt hat.
- **IMD** misst die Senderqualität, nicht den Empfang: ein sauberes Signal liegt bei etwa −20 dB oder besser. Ein schlechter Wert bedeutet, dass die Gegenstation übersteuert, nicht dass Sie falsch abgestimmt sind.
- Der Text erscheint Zeichen für Zeichen ohne Fehlerkorrektur; ein schwaches Signal führt daher zu vereinzelten falschen Buchstaben, statt ganz abzubrechen.

### Hinweise zu Olivia

Olivia tauscht Geschwindigkeit gegen Robustheit. Es ist deutlich langsamer als PSK31, dekodiert aber Signale, die mit dem Ohr nicht mehr hörbar sind — daher seine Beliebtheit für schwache Signale und große Entfernungen.

- **Die Mode-Einstellung muss exakt zur Aussendung passen.** Eine falsche Kombination aus Tönen und Bandbreite dekodiert überhaupt nichts — keinen verstümmelten Text, sondern Stille. Das Bedienfeld startet mit **8 / 250**, der schmalen Konfiguration, die auf den Anruffrequenzen mitläuft; **16 / 500** und **32 / 1000** sind die beiden anderen gebräuchlichen, und **16 / 1000** wird ebenfalls angeboten.
- Olivia sendet keine Präambel, der Decoder muss die Synchronisierung daher suchen. **Rechnen Sie nach dem Abstimmen mit einigen Sekunden**, bevor Text erscheint. Das Feld **Sync** zeigt bis zum Einrasten `SEARCH`.
- Die Fehlerkorrektur arbeitet blockweise, der Text trifft daher **schubweise statt gleichmäßig** ein, mit einer Verzögerung von mehreren Blöcken zwischen Aussendung und Anzeige.
- **Squelch (FEC S/N)** legt fest, wie sicher sich die Fehlerkorrektur sein muss, bevor sie ausgibt. Die Voreinstellung 4,0 hält Rauschen fern; 3,0 ist die Untergrenze, unterhalb derer zufälliges Rauschen vereinzelt Zeichen ausgibt. Ein gutes Signal erreicht 8–9 auf der **FEC**-Anzeige, es bleibt also reichlich Spielraum, den Squelch auf einem belegten Band anzuheben.

> **Hinweis zur Betriebsart:** Der Decoder übernimmt die Kontrolle über Demodulationsart und ZF-Durchlassbereich, solange er aktiv ist. Beides wird beim Abschalten automatisch wiederhergestellt. Alle fünf Varianten verwenden **USB**.
>
> **Hinweis zur Polarität (nur FSK-Varianten):** Bei Wetter-RTTY muss meist **Invert mark / space** aktiviert werden. Bei maritimem FSK (SITOR/NAVTEX-Art) und Amateur-RTTY lassen Sie es deaktiviert — Amateur-RTTY sendet Mark als die höhere Hochfrequenz, und USB behält sie als den höheren Audioton bei, was genau dem deaktivierten Fall entspricht. Ist der dekodierte Text verstümmelt, sollten Sie zuerst dieses Kästchen umschalten. Bei PSK31 und Olivia ist es ausgeblendet, da sie kein Mark/Space-Paar besitzen.
>
> **Hinweis zu Buchstaben/Ziffern (nur FSK-Varianten):** Baudot führt Buchstaben und Ziffern in zwei getrennten Zuständen, und Rauschen kann den Decoder in den falschen kippen — wodurch nicht nur das gestörte, sondern jedes folgende Zeichen verstümmelt wird. Der Decoder kehrt deshalb bei jedem Leerzeichen zu Buchstaben zurück; das ist übliche Praxis und repariert eine verfälschte Umschaltung innerhalb von ein bis zwei Wörtern statt einer ganzen Zeile. Der Preis: Zifferngruppen, die durch Leerzeichen getrennt sind, erfordern, dass die Gegenstelle die Ziffernumschaltung nach jedem Leerzeichen wiederholt — was Sender normalerweise tun.

---

## 11. SSTV

**Worum es geht:** Slow-Scan-Television überträgt Standbilder über einen gewöhnlichen SSB-Sprechfunkkanal, Zeile für Zeile, als frequenzmodulierten Ton zwischen 1500 Hz (Schwarz) und 2300 Hz (Weiß). Ein vollständiges Bild dauert je nach Betriebsart zwischen 36 Sekunden und 4½ Minuten.

### Empfohlene Frequenzen (USB)

| Band | Frequenz | Betriebsart | Anmerkungen |
|------|----------|-------------|-------------|
| 20 m | 14.230 MHz | USB | Die wichtigste internationale SSTV-Anruffrequenz — mit Abstand die aktivste |
| 20 m | 14.233 MHz | USB | Ausweichfrequenz, wenn 14.230 belegt ist |
| 15 m | 21.340 MHz | USB | |
| 10 m | 28.680 MHz | USB | Aktiv bei Bandöffnungen |
| 40 m | 7.171 MHz | LSB | |
| 80 m | 3.845 MHz | LSB | Regional, abends |

**Das Seitenband wird für Sie gewählt.** Beim Start des Decoders wird **LSB unterhalb 10 MHz** und **USB oberhalb** gewählt, entsprechend der üblichen Amateurfunkpraxis. Auf dem falschen Seitenband ist die Tonzuordnung invertiert, und das Bild lässt sich nicht dekodieren. Treffen Sie auf eine Station, die sich nicht an die Konvention hält, wechseln Sie das Seitenband einfach von Hand — der Decoder läuft weiter, löscht das Bild und beginnt mit der neuen Einstellung von vorn.

### Einrichtung

1. Aktivieren Sie den Decoder und wählen Sie **SSTV** aus dem Menü. Oder drücken Sie einfach die Taste **SSTV**. Der Empfänger wechselt das Seitenband automatisch — USB über 10 MHz, LSB darunter.
2. Stimmen Sie so ab, dass die Bildtöne in der Mitte des Durchlassbereichs liegen. Ein richtig abgestimmtes Signal hat seine Synchronimpulse bei 1200 Hz und den Bildinhalt zwischen 1500 und 2300 Hz.
3. Belassen Sie **Mode** auf **Auto**, sofern Sie nicht bereits wissen, was gesendet wird. Das Bild baut sich Zeile für Zeile auf.

### Betriebsarten

| Einstellung | Bild | Dauer |
|-------------|------|-------|
| **Auto** | automatisch erkannt | — |
| Martin M1 / M2 | 320×256 Farbe | 114 s / 58 s |
| Scottie S1 / S2 | 320×256 Farbe | 110 s / 71 s |
| Scottie DX | 320×256 Farbe | 269 s |
| Robot 36 / 72 | 320×240 Farbe | 36 s / 72 s |

**Auto** arbeitet auf zwei Wegen: Es liest den **VIS-Kopf** — den digitalen Betriebsartencode, der in den ersten 300 ms einer Aussendung gesendet wird — und bestimmt, falls der Kopf verpasst wurde (Sie sind zu spät eingestiegen oder er ging im QSB verloren), die Betriebsart stattdessen aus dem Timing der Synchronimpulse. Die Wahl einer bestimmten Betriebsart erzwingt diese, aber der Decoder prüft dennoch die Synchronisation, bevor er etwas zeichnet — eine falsche Wahl liefert also kein Bild statt Rauschen.

### Die Ausgabe lesen

Die Statuszeile unter den Bedienelementen zeigt, was der Decoder gerade tut:

| Status | Bedeutung |
|--------|-----------|
| `Waiting for VIS / AUTO lock` | Horcht; noch nichts erkannt |
| `Martin M1? verifying sync…` | Ein Kandidat wurde gefunden und wird anhand der nächsten Zeilen bestätigt |
| `Martin M1 lock (VIS)` | Eingerastet über den VIS-Kopf |
| `Martin M1 lock (AUTO)` | Eingerastet über das Synchron-Timing |
| `Martin M1 lock (MANUAL)` | Über die Schaltfläche **⏺ Force** gestartet |
| `Candidate rejected (no sync)` | Der Kandidat wurde nicht bestätigt — bei Rauschen normal |
| `— sync lost, resetting` | Das Signal verschwand mitten im Bild |
| `Frame complete` | Das vollständige Bild wurde empfangen |

Die erkannte Betriebsart erscheint außerdem grün neben dem Titel **SSTV**, und der Zeilenzähler zeigt den Fortschritt.

### Bedienelemente

| Schaltfläche | Aktion |
|--------------|--------|
| **▶ Start** | Schaltet den Decoder scharf. Er zeichnet nicht von selbst ein Bild — ein Einrasten muss weiterhin über den VIS-Kopf oder die Synchronerkennung erfolgen. |
| **■ Stop** | Beendet die Dekodierung. |
| **↺ Reset** | Löscht die Zeichenfläche und schaltet an Ort und Stelle wieder scharf. Zwischen zwei Bildern oder nach dem Nachstimmen zu verwenden. |
| **⏺ Force** | Beginnt **sofort** in der im Menü gewählten Betriebsart zu zeichnen und überspringt VIS- und Synchronerkennung vollständig. Nur verfügbar, wenn Mode nicht auf **Auto** steht. |
| **💾 Save** | Speichert das aktuelle Bild als PNG. |

**Wann Force zu verwenden ist.** Wenn Sie im Wasserfall ein Bild sehen, der Decoder aber nicht darauf einrastet — eine ungewöhnliche Betriebsart, ein für die Detektoren zu schwaches oder zu verzerrtes Signal oder ein verpasster Kopf —, wählen Sie die Betriebsart von Hand und drücken Sie **⏺ Force**. Das Bild wird im Moment des Klicks verankert, und die Betriebsartenmarkierung zeigt `MANUAL`, sodass Sie es von einem VIS- oder AUTO-Einrasten unterscheiden können. Der Decoder rastet dennoch auf einen echten Synchronimpuls ein, wenn er einen findet — ein etwas zu früher oder zu später Klick wird also korrigiert.

Da Force sämtliche Sicherheitsprüfungen überspringt, malt es bereitwillig Rauschen, wenn Sie es auf einem leeren Kanal drücken, und es stoppt nicht von allein — drücken Sie **■ Stop** oder **↺ Reset**.

### Anmerkungen

- **Rauschen startet den Decoder nicht.** Statische Entladungen, Funkenstörungen und Netzbrumm reichten früher aus, um eine Dekodierung auszulösen. Jede Erkennungsstufe prüft nun, dass der Ton wirklich ein Ton ist, und bestätigt den Kandidaten anhand der folgenden Zeilen, bevor ein einziger Bildpunkt gezeichnet wird. Erwarten Sie, dass der Decoder auf einem leeren Band still bleibt.
- **Das Bild verläuft schräg, wenn Sie neben der Frequenz liegen.** SSTV verzeiht Abstimmfehler nicht. Neigen sich die Zeilen, stimmen Sie in kleinen Schritten nach und lassen Sie das nächste Bild neu beginnen.
- Farbbalance und Schärfe sind fest eingestellt; es gibt nichts nachzuregeln.

---

## 12. Allgemeine Tipps

**Decoder: ON muss zuerst eingeschaltet werden.** Das Auswahlmenü ist deaktiviert (ausgegraut), bis Sie die Decoder-Schaltfläche anklicken.

**Immer nur ein Decoder.** Die Auswahl eines neuen Decoders im Menü beendet automatisch den zuvor aktiven und setzt alle von ihm vorgenommenen Betriebsart- oder Durchlassbereichsänderungen zurück.

**Die Betriebsart wird für Sie verwaltet.** HF-FAX und NAVTEX schalten den Empfänger sofort nach der Auswahl auf USB, SSTV wählt das Seitenband anhand des Bandes (LSB unter 10 MHz, USB darüber), und FAX, NAVTEX sowie FSK passen zusätzlich den Durchlassbereich an, wenn Sie ihre Tune-Schaltfläche anklicken. FT8, FT4, FT2, JS8 und WSPR tun dasselbe, sobald Sie sie auswählen — über die Schaltflächenreihe oder das Auswahlmenü: Der Empfänger schaltet auf USB und erhält den passenden Durchlassbereich — das gesamte 3-kHz-Teilband für die FT8-Familie, 1350–1650 Hz für WSPR. Beim Beenden des Decoders wird die Standardbetriebsart des Bandes wiederhergestellt.

**Das Einschalten eines Decoders unterbricht den Ton nicht mehr.** Die Decoder laufen in eigenen Threads, sodass es beim Starten, Stoppen oder Wechseln weder Lücke noch Klick noch Aussetzer gibt.

**Die Genauigkeit der Systemuhr zählt.** FT8, FT4 und WSPR sind zeitkritisch. Sie dekodieren in festen, an UTC ausgerichteten Fenstern. Weicht Ihre Rechneruhr um mehr als 1–2 Sekunden ab, sinken die Dekodierraten deutlich. Halten Sie Ihre Uhr mit einem NTP-Client genau.

**Die Rauschfilter erreichen die Decoder nicht.** NR, NB, NS und AN sind
Hörhilfen, ausschließlich für Ihre Ohren. Jeder Decoder — FT8, FT4/FT2, CW, WSPR, FAX, NAVTEX, FSK/RTTY/PSK31/Olivia, SSTV und der QRSS-Grabber — greift das Audio *vor* diesen Filtern ab; stellen Sie sie also so ein, wie es am besten klingt, ohne sich um die Decodierqualität zu sorgen. Aus demselben Grund laufen die Decoder weiter, während der Empfänger stummgeschaltet oder zugerauscht ist: Sie können den Lautsprecher abschalten und einen Decoder oder eine Nacht-QRSS-Aufzeichnung weiterlaufen lassen. Was dem Gehörten tatsächlich folgt, ist allein das Audio-Spektrogramm, das bewusst das gefilterte Audio zeigt.

**Signalqualität schlägt Signalstärke.** Die meisten dieser Decoder sind für schwache Signale ausgelegt. Ein ruhigeres Band mit geringerem Rauschen ist oft ergiebiger als ein lautes, störungsreiches Signal. Nutzen Sie Wasserfall und Durchlassbereichseinstellungen, um QRM zu erkennen und zu meiden, bevor Sie einen Decoder aktivieren.

**Nutzen Sie die Schaltflächen Refresh oder Clear großzügig.** FAX-Bilder verlaufen, wenn die Anzeigefrequenz leicht danebenliegt, und Textdecoder sammeln Störzeichen an. Ein Neuanfang nach Abstimmkorrekturen liefert oft eine deutlich sauberere Ausgabe.

### Automatisches Spot-Reporting und Systemgraphen

FT8-, FT4- und WSPR-Dekodierungen kann auch der Server selbst hochladen — FT8/FT4 an PSK Reporter, WSPR an WSPRnet — über einen Autorun-Daemon, den der Sysop im Admin-Panel startet. Er ist von den Decodern in Ihrem Browser unabhängig: er läuft weiter, ob jemand zuhört oder nicht, und nichts, was Sie im Browser dekodieren, wird gemeldet.

Der Sysop verfolgt ihn über zwei Zähler, die leicht zu verwechseln sind: Die Kacheln je Decoder zählen die seit dem letzten Start des Daemons hochgeladenen Spots, während die Zahl neben dem Kontrollkästchen jedes Bands bzw. jeder Betriebsart der Gesamtwert seit Beginn ist und Neustarts übersteht. Dasselbe Panel enthält eine Seite **Graphen**, die CPU-Takt, CPU-Last, CPU-Temperatur und Nutzer online über die letzten 15 Minuten bis 24 Stunden darstellt. Beides beschreibt das [Admin-Panel-Handbuch](ADMIN_PANEL_SETUP.md).

---

*PhantomSDR-Plus — sv1btl-Fork — [phantomsdr.no-ip.org](http://phantomsdr.no-ip.org:8900)*
