# PhantomSDR-Plus Benutzerhandbuch

Willkommen bei PhantomSDR-Plus! Dieses Handbuch hilft Ihnen, das Beste aus Ihrem WebSDR-Hörerlebnis herauszuholen.

---

## Inhaltsverzeichnis

1. [Einführung](#einführung)
2. [Erste Schritte](#erste-schritte)
3. [Überblick über die Oberfläche](#überblick-über-die-oberfläche)
4. [Grundlegende Bedienung](#grundlegende-bedienung)
5. [Erweiterte Funktionen](#erweiterte-funktionen)
6. [Demodulationsarten](#demodulationsarten)
7. [Digitale Decoder](#digitale-decoder)
8. [Tastenkürzel](#tastenkürzel)
9. [Lesezeichen](#lesezeichen)
10. [Nutzung auf Mobilgeräten](#nutzung-auf-mobilgeräten)
11. [Tipps und bewährte Praktiken](#tipps-und-bewährte-praktiken)
12. [Fehlerbehebung](#fehlerbehebung)
13. [Häufig gestellte Fragen](#häufig-gestellte-fragen)

---

## Einführung

### Was ist PhantomSDR-Plus?

PhantomSDR-Plus ist ein webbasiertes Software-Defined Radio (SDR), mit dem Sie Funksignale über das Internet hören können. Auf Ihrer Seite werden weder besondere Software noch Hardware benötigt – nur ein moderner Webbrowser!

### Was können Sie hören?

Je nach Konfiguration des WebSDR können Sie Folgendes empfangen:

- **Amateurfunk**: Funkamateure weltweit
- **Rundfunkstationen**: AM-/UKW-Rundfunk, Kurzwellenrundfunk
- **Luftfahrt**: Flugsicherung, Flugfunk
- **Seefunk**: Schiff-Land-Verkehr, Seewetterdienst
- **Wettersatelliten**: NOAA, METEOR-M
- **Digitale Betriebsarten**: FT8, RTTY, PSK31 und mehr
- **Nutzfunkstationen**: Zeitzeichen, Militär, Behörden

### Systemanforderungen

- **Browser**: Chrome/Edge (empfohlen), Firefox, Safari
- **Verbindung**: Breitband-Internet (1 Mbit/s oder mehr empfohlen)
- **Audio**: funktionierende Lautsprecher oder Kopfhörer
- **Optional**: Maus mit Scrollrad zum leichteren Abstimmen

---

## Erste Schritte

### 1. Auf das WebSDR zugreifen

Öffnen Sie Ihren Browser und rufen Sie die vom Betreiber angegebene WebSDR-Adresse auf.

Beispiel: `http://websdr.example.com:9002`

### 2. Erster Seitenaufbau

Beim Laden der Seite sehen Sie:
- eine farbige Wasserfallanzeige mit der Funkaktivität
- ein Bedienfeld mit Frequenzanzeige und Schaltflächen
- ein S-Meter für die Signalstärke
- eine Anzeige der Nutzerzahl

### 3. Mit dem Hören beginnen

1. **Klicken Sie auf ein Signal** in der Wasserfallanzeige
2. **Der Ton startet automatisch**
3. **Regeln Sie die Lautstärke** über die Lautstärkeregelung des Browsers oder den Regler auf dem Bildschirm
4. **Stimmen Sie fein ab**, indem Sie genau auf das Signal klicken

---

## Überblick über die Oberfläche

### Hauptbestandteile

```
┌──────────────────────────────────────────────────────────────────────────┐
│  WebSDR <callsign>, located in <QTH>              ⚙ [ Analog S-Meter ▾ ] │
│  email · Keyboard Shortcuts · Users · Stats · Other servers 1 2 3        │
│  Frequency Search: MW SW HamDash PSK Reporter WSPRnet · Callsign Search  │
│                        [ Open Additional Info ]                          │
├──────────────────────────────────────────────────────────────────────────┤
│                     Spectrum  +  Waterfall                               │
│                     band-plan strip along the bottom                     │
├───────────────────────┬────────────────────────────┬─────────────────────┤
│ Audio & Buffer        │   Frequency  │  S-Meter    │ Waterfall Controls  │
│   volume · SQ · zoom  │   7,120.00   │  dBm dBμV   │   Min · Max · zoom  │
│ AGC Auto Fast Med Slow│   band · VFO │  SNR · NF   │   colour-map strip  │
│   Compressor Equalizer├────────────────────────────┤ Zoom In Out Max Min │
│ Filters               │  Fine Tuning (kHz)         │ Waterfall Spectrum  │
│   NR NB NS AN CTCSS   │  VFO A · Modes · Bands     │ Auto Adj. Height    │
│ Modes selector        │           · IF Filters     │ [ profile ▾ ]       │
│   ...  RADEL  RADEU   │  Wheel Tuning Steps        │ [ Bookmarks ]       │
│   USB LSB CW AM QUAM  │  Decoders                  │                     │
│   FM                  │   FT8 FT4 FT2 JS8 CW WSPR  │                     │
│ Band selector         │   FAX SSTV NAVTEX RTTY ... │                     │
└───────────────────────┴────────────────────────────┴─────────────────────┘
```

Die drei Panels unter dem Wasserfall scrollen als eine Seite; in einem schmalen Fenster stapeln sie sich, statt nebeneinander zu stehen. **RADEL** und **RADEU** sitzen auf der Überschriftenzeile *Modes selector* selbst, rechts davon.

### 1. Wasserfallanzeige

Der Wasserfall ist eine visuelle Darstellung von Funksignalen:

- **Waagerechte Achse**: Frequenz
- **Senkrechte Achse**: Zeit (läuft nach unten)
- **Farben**: Signalstärke
  - **Dunkelblau/schwarz**: kein Signal (Rauschteppich)
  - **Grün/gelb**: schwache bis mittlere Signale
  - **Orange/rot**: starke Signale
  - **Weiß**: sehr starke Signale

### 2. Frequenzanzeige

Zeigt die aktuell eingestellte Frequenz in verschiedenen Formaten:
- **MHz**: 7.100.000 MHz (KW-Bänder)
- **kHz**: 14200 kHz
- **Hz**: 145500000 Hz (VHF/UHF)

### 3. S-Meter (analog oder digital)

Zeigt die Signalstärke an:
- **S1-S9**: übliche Signalstärkeskala
- **+dB**: Signale über S9 (z. B. S9+20dB)
- **Analog oder digital**: je nach Konfiguration

### 4. Betriebsartentasten

Wählen Sie die Demodulationsart:
- **AM**: Amplitudenmodulation
- **FM**: Frequenzmodulation
- **USB**: oberes Seitenband
- **LSB**: unteres Seitenband
- **CW**: Morsetelegrafie (Continuous Wave)
- **WBFM**: Breitband-FM (Rundfunk)
- **QUAM**: C-QUAM-AM-Stereo — die Beschriftung wird grün, sobald ein Stereopilot erkannt wird

Neben der Überschrift **Modes selector** stehen die Tasten **RADEL** und **RADEU**, die RADE v1 Digital Voice mit einem Druck starten — siehe [Digitale Decoder](#digitale-decoder).

### 5. Bedienfeld

Weitere Bedienelemente:
- **AGC**: automatische Verstärkungsregelung
- **NR**: Rauschminderung (spektral)
- **NB**: Störaustaster (impulsiv)
- **NS**: Grundrauschunterdrückung
- **AN**: automatische Notch
- **CTCSS**: Subton-Rauschsperre (FM)
- **SQL**: Rauschsperre
- **AI**: KI-Rauschunterdrückung (nur Sprache)
- **Zoom**: Vergrößerungsstufe des Wasserfalls
- **Wheel Tuning Steps**: Schrittweite des Mausrads
- **Decoders**: Tasten, die jeden Decoder mit einem Druck starten und stoppen

### 6. Bandplan-Overlay

Farbige Balken zeigen die Frequenzzuweisungen:
- unterschiedliche Farben für unterschiedliche Funkdienste
- hilft zu erkennen, was auf welcher Frequenz zulässig ist

---

## Grundlegende Bedienung

### Auf eine Frequenz abstimmen

#### Methode 1: In den Wasserfall klicken

1. Klicken Sie direkt auf ein Signal im Wasserfall
2. Der Empfänger stimmt auf diese Frequenz ab
3. Der Ton beginnt

#### Methode 2: Frequenz eingeben

1. Klicken Sie auf die Frequenzanzeige
2. Geben Sie die gewünschte Frequenz ein
3. Drücken Sie die Eingabetaste

Beispiele:
- `7100` → 7.100 MHz
- `14200.0` → 14.200 MHz
- `145.500` → 145.500 MHz

#### Methode 3: Mausrad verwenden

1. Bewegen Sie den Zeiger über die Frequenzanzeige
2. Rad nach oben: Frequenz erhöhen
3. Rad nach unten: Frequenz verringern

#### Methode 4: Schrittschaltflächen

1. Verwenden Sie die Schaltflächen **▲** und **▼** neben der Frequenz
2. Die Schrittweite hängt von der Betriebsart ab:
   - **AM/FM**: Schritte von 1 kHz
   - **SSB**: Schritte von 100 Hz
   - **CW**: Schritte von 10 Hz

### Scanner

Der Scanner führt den Empfänger über einen Bereich von Kanälen und hält beim ersten an, auf dem ein Signal liegt. Er sitzt in der Zeile **Fine Tuning (kHz)** ganz rechts:

```
7 152.0   ◀  ■  ▶  ⊘   30 dB · 4 ▾
```

| Bedienelement | Funktion |
|---------------|----------|
| **◀ ▶** | Abwärts / aufwärts suchen. Steht der Scanner auf einem Signal, setzt ein Pfeil den Suchlauf fort. |
| **■** | Anhalten. |
| **⊘** | Diesen Kanal vom Suchlauf ausschließen — für Pfeifstellen oder Dauerträger. |
| **30 dB · 4 ▾** | Die Schwelle, daneben der gerade gemessene Pegel. Öffnet die Einstellungen. |

Der Text links zeigt, was der Scanner tut: `Scanner` im Ruhezustand, die erreichte Frequenz während des Suchlaufs, `◉ 3s` während des Rücklaufzählers,
`◉ 30·22s` solange der Kanal noch belegt ist, `◉ hold`, wenn er stehen bleibt.

**Einstellungen**

- **Range** — *Scan Band* durchsucht das Band, in dem der Suchlauf beginnt;
  *Scan Visible* durchsucht genau den sichtbaren Wasserfall und folgt ihm beim
Zoomen und Verschieben.
- **Scan** — *Every channel* stimmt jeden Kanal der Reihe nach ab und hört hinein;
  *Skip empty* liest das Spektrum und springt direkt zu den Signalen.
- **Stop at** — wie weit über dem Grundrauschen des Bandes ein Kanal liegen muss,
damit der Suchlauf anhält, in dB. Das Rauschen wird laufend nachgeführt, eine Einstellung passt daher tags wie nachts. Ein leerer Kanal zeigt nicht 0 dB — beobachten Sie den Live-Wert auf der Schaltfläche und wählen Sie die Schwelle darüber.
- **Resume after** — wie lange ein Kanal ruhig bleiben muss, bevor der Suchlauf
weiterläuft. Sprechpausen starten ihn nicht neu. *Hold* bleibt stehen, bis Sie eine Taste drücken.
- **Max stay** — läuft nach dieser Zeit weiter, auch wenn das Signal noch da ist,
damit ein Dauerträger den Suchlauf nicht dauerhaft festhält.

Die Schrittweite richtet sich nach der Betriebsart — 1 kHz in SSB, 0,1 kHz in CW, 5 kHz in AM, 9 oder 10 kHz auf Mittelwelle und 9 kHz auf Langwelle — und die Haltepunkte liegen im Kanalraster. Der Suchlauf bleibt in seinem Bereich und innerhalb dessen, was der Empfänger abstimmen kann; an einer Grenze läuft er am anderen Ende weiter.

Einstellungen und ausgeschlossene Kanäle merkt sich Ihr Browser.


### Demodulationsart auswählen

Wählen Sie die zum Signal passende Betriebsart:

**Für Sprechfunk:**
- **AM**: Luftfahrt, AM-Rundfunk, teils Amateurfunk
- **FM**: VHF-/UHF-Relaisfunkstellen, UKW-Rundfunk
- **USB**: KW-Amateurfunk (20 m, 17 m, 15 m, 12 m, 10 m)
- **LSB**: KW-Amateurfunk (160 m, 80 m, 40 m, 30 m)

**Für Daten/Digital:**
- **USB**: die meisten digitalen Betriebsarten (FT8, PSK31, RTTY)
- **LSB**: einige digitale Betriebsarten auf den unteren KW-Bändern

**Für Morsetelegrafie:**
- **CW**: Telegrafie-/Morsesignale

### Lautstärke einstellen

- **Regler auf dem Bildschirm**: Lautstärkeregler ziehen
- **Browser-Lautstärke**: Mediensteuerung des Browsers verwenden
- **Systemlautstärke**: Lautstärke des Computers anpassen
- **Tastatur**: Tasten + und - verwenden (sofern unterstützt)

### Das S-Meter nutzen

Das S-Meter zeigt die Signalstärke:

- **S0-S3**: sehr schwaches Signal, schwer aufzunehmen
- **S4-S6**: schwaches bis mittleres Signal
- **S7-S9**: gutes bis starkes Signal
- **S9+**: außerordentlich starkes Signal

**Tipp**: Für die beste Tonqualität stimmen Sie auf Signale ab, die S7 oder mehr anzeigen.

**Das Skalenbild wechseln**: Klicken Sie beim analogen Instrument (Zeiger) auf das Instrument selbst — oder wählen Sie es an und drücken Sie Enter oder die Leertaste —, um drei Hintergründe durchzuschalten: dunkles gebürstetes Metall, ein helles blassgraues Zifferblatt und ein warmes Bernstein-Zifferblatt im Vintage-Stil. Ihr Browser merkt sich die Wahl, sie ist also nach einem Neuladen oder Neustart noch da. Sie gilt pro Browser und pro Adresse: Der Aufruf des Empfängers über den Hostnamen und über die IP ergibt zwei getrennte Einstellungen, und ein privates Fenster startet immer mit der Standardeinstellung der Seite.

---

## Erweiterte Funktionen

### Automatische Verstärkungsregelung (AGC)

Die AGC passt die Audiopegel automatisch an:

- **Off**: keine automatische Verstärkungsanpassung
- **Slow**: allmähliche Pegeländerungen (am besten für SSB)
- **Medium**: ausgewogenes Verhalten
- **Fast**: schnelle Anpassung (am besten für AM)

**Empfehlung**: Beginnen Sie mit „Fast" für AM und „Slow" für SSB.

### Die vier Rauschregler

NR, NB, NS und AN sind getrennte Ein/Aus-Schalter, die jeweils eine andere Art von Störung angehen. Sie sind unabhängig voneinander — einer schaltet keinen anderen mit ein — und lassen sich beliebig kombinieren.

Keiner von ihnen erreicht die Decoder: FT8, CW, WSPR, SSTV, FAX, NAVTEX, RTTY/PSK31/Olivia und der QRSS-Grabber lesen das Audio *vor* diesen Filtern. Sie können sie also rein nach Gehör einstellen, ohne zu beeinflussen, was decodiert wird. Siehe das [Decoder-Handbuch](DECODERS.md#12-allgemeine-tipps).

### Rauschminderung (NR)

Spektrale Rauschminderung. Sie schätzt den Rauschpegel in jedem Teil des Audiospektrums und dreht diese Anteile herunter; was über dem Rauschen steht, bleibt unangetastet.

**Verwenden, wenn**: Sie gleichmäßiges Zischen oder weißes Rauschen hinter dem
Signal hören.

Dauertöne — eine CW-Note, ein Träger — werden als Signal erkannt und geschützt. NR frisst also kein CW-Signal, wie es ein naives Filter täte. Typische Wirkung: 10 dB weniger Rauschen in den Sprechpausen, für ein paar Zehntel dB Verlust an der Sprache selbst.

### Störaustaster (NB)

Entfernt Impulsstörungen: Knacken, Knallen, atmosphärische Entladungen, Zünd- und Netzstörungen. Er beobachtet die Audio-Hüllkurve und schweigt nur die Abtastwerte still, die weit darüber ausschlagen — etwa eine Millisekunde je Knall, mit weichen Flanken, damit die Austastung nicht selbst knackt.

**Verwenden, wenn**: Sie Knacken von Stromleitungen, Motoren, Gewittern oder
Fahrzeugzündungen hören.

Die Netzbrumm-Notches bei 50 Hz und 60 Hz folgen dieser Taste.

### Grundrauschunterdrückung (NS)

Misst über mehrere Sekunden das Grundrauschen des Bandes und senkt alles ab, was auf diesem Pegel liegt — bei hohen Tonfrequenzen stärker als bei tiefen. Wo NR von Moment zu Moment reagiert, ist NS die langsame, ruhige Hand: Sie senkt das Bandrauschen, ohne den Klang des Signals selbst zu verändern.

**Verwenden, wenn**: Das Band ruhig, aber zischig ist und Sie das Rauschen
absenken wollen, ohne den „Unterwasser"-Klang aggressiver NR.

Nur in USB, LSB und AM aktiv — CW, FM und die digitalen Betriebsarten bleiben unberührt. Bei jedem Frequenz- oder Modewechsel wird neu gemessen; das ist nach wenigen Sekunden eingeschwungen.

### Automatische Notch (AN)

Findet und entfernt selbsttätig Dauertöne — Heterodyne, Träger, Pfeifstellen — ohne dass Sie ein Notchfilter von Hand setzen müssen. Sie passt sich laufend an, kann also mehrere Töne gleichzeitig entfernen und bleibt auch an einem driftenden Ton hängen.

**Verwenden, wenn**: Sie einen Pfeifton über dem gewünschten Signal hören.

In CW abgeschaltet, denn dort *ist* das Nutzsignal ein Dauerton.

**Hinweis zur Verzögerung**: NR und NS fügen im eingeschalteten Zustand je rund
40 ms Audioverzögerung hinzu (beide zusammen etwa 80 ms). NB und AN fügen keine hinzu. Das betrifft nur das Hören, nie die Decoder.

### Automatische Rauschsperre (SQL)

Schaltet den Ton stumm, wenn kein Signal anliegt:

- **Off**: immer hörbar (Rauschen zu hören)
- **Auto**: Schwelle wird automatisch gesetzt
- **Manual**: Schwelle manuell einstellen

**Verwenden, wenn**: Sie eine Frequenz auf Aktivität überwachen.

### KI-Rauschunterdrückung (AI)

Die Taste **AI** mit einem Stärkeregler daneben sitzt im Bereich Audio & Buffer direkt unter SQ. Auf der Seite /mobile befindet sie sich im Reiter Audio unter Squelch. Sie entfernt Bandrauschen aus Sprache mit RNNoise, einem kleinen, auf Sprache trainierten neuronalen Netz.

Alles geschieht in Ihrem eigenen Browser: Nichts wird an einen fremden Server geschickt, es gibt kein Konto, und der Empfänger hat keine zusätzliche Arbeit.

- **Ein/Aus**: **AI** anklicken; die Taste wird blau. Beim ersten Klick wird das Modul geladen (etwa 1,3 MB), und die Taste pulsiert, solange es lädt.
- **Stärke**: Der Regler mischt den entrauschten Ton mit dem Original — 100 % ist voll bearbeitet, niedrigere Werte holen einen Teil des Bandes zurück. Voreingestellt sind 50 %. Er lässt sich auch bei ausgeschaltetem AI einstellen.
- **Statusanzeige**: Die Anzeige AI unter der Frequenz leuchtet cyan, solange AI arbeitet, und erscheint halb abgedunkelt, wenn AI eingeschaltet ist, die aktuelle Betriebsart aber keine Sprachbetriebsart ist.

**Verwenden, wenn**: Sie SSB- oder AM-Sprache auf einem verrauschten Band hören. Das Rauschen zwischen den Worten sinkt typisch um 10–20 dB, während die Sprache ihren Pegel behält.

Nur Sprachbetriebsarten — USB, LSB, AM und SAM. In CW, FM, den Datenbetriebsarten und C-QUAM läuft der Ton unverändert durch, weil das Netz einen CW-Ton oder Musik als Rauschen behandelt. Wie die vier Rauschfilter erreicht es die Decoder nie. Bei sehr schwachen Stationen (um 0 dB SNR) kann Sprache bearbeitet klingen; klingt ein Signal „wässrig“, den Regler zurücknehmen. Es fügt etwa 30 ms Audioverzögerung hinzu.

### Zoomfunktion

Vergrößert die Wasserfallanzeige:

- **1x**: Normalansicht (breite Abdeckung)
- **2x**: 2-fache Vergrößerung
- **4x**: 4-fache Vergrößerung
- **8x**: 8-fache Vergrößerung

**Verwenden, wenn**: Sie Signale deutlicher sehen oder genauer abstimmen möchten.

### Transceiver-Steuerung (CAT)

Ihr eigener Transceiver und die Empfängerseite lassen sich auf derselben Frequenz halten: Drehen Sie am Abstimmknopf des Funkgeräts, folgt der Wasserfall – oder klicken Sie auf ein Signal im Wasserfall, und das Funkgerät stimmt darauf ab. Das betrifft nur *Ihre* eigene Hörsitzung; niemand sonst am Empfänger merkt etwas davon.

**Mit Desktop PhantomSDR+ (ab 4.0).** Die Desktop-Anwendung hat ein Menü **Rig**. *Rig → Rig control...* öffnet ein Fenster, in dem Sie Ihr Funkgerät und den Verbindungsweg wählen; das Menü selbst schaltet die Synchronisierung ein und aus. Synchronisiert werden Frequenz, Betriebsart und Filterbreite, in eine Richtung oder in beide, und auf Wunsch wird der Empfänger während des Sendens stummgeschaltet. Neben PhantomSDR-Plus steuert sie auf dieselbe Weise auch Empfänger **KiwiSDR, PA3FWM WebSDR und UberSDR**. Das Funkgerät wird auf einem von vier Wegen erreicht:

- **Integriert** – ohne weitere Software: Icom (CI-V), Yaesu (neues CAT sowie FT-817/857/897), Kenwood, Elecraft, FlexRadio SmartSDR CAT, QRP Labs und andere Kenwood-kompatible Geräte.
- **Hamlib** – jedes Funkgerät, das Hamlib kennt, mehr als 300, ausgewählt aus einer durchsuchbaren Liste. Die Windows-Installer enthalten Hamlib; unter Linux installieren Sie `libhamlib-utils`.
- **rigctld im Netzwerk** – ein bereits laufender `rigctld`.
- **flrig** – für ein Funkgerät, das flrig schon mit fldigi, WSJT-X oder einem Logbuch teilt.

Die Anwendung, ihre Installer und das vollständige Handbuch finden Sie unter [Desktop PhantomSDR+ (Dropbox)](https://www.dropbox.com/scl/fo/kjwj96zg3kj7dgq4fjef9/APnA3c9hhv4hk3YMGIGjH7s?rlkey=jfiwklly63kv73poalx631pk3&st=m37uvaym&dl=0).

**Mit einem Webbrowser.** Das [CATsync Tool for WebSDRs](https://catsyncsdr.wordpress.com/) (Windows) koppelt ein Funkgerät an die im Browser geöffnete Empfängerseite. Es synchronisiert Frequenz und Betriebsart.

**Filterbreite und Stummschaltung beim Senden** funktionieren mit KiwiSDR-, WebSDR- und UberSDR-Empfängern sowie mit einem PhantomSDR-Plus-Empfänger mit 4.1.0 oder neuer. Bei einem älteren PhantomSDR-Plus werden Frequenz und Betriebsart weiterhin synchronisiert, der Filter nicht.

Das vollständige Handbuch — jede Einstellung, die unterstützten Geräte, wie verhindert wird, dass sich beide Seiten bekämpfen, und die Fehlerbehebung — ist **[Transceiver-Steuerung](RIG_CONTROL.md)**.

**Für Entwickler.** Jede Empfängerseite stellt diese Funktionen auf `window` bereit; beide Werkzeuge nutzen sie:

| Funktion | Wirkung |
|---|---|
| `catsync_getFrequency()` / `catsync_setFrequency(hz)` | Abgestimmte Frequenz in Hz |
| `catsync_getMode()` / `catsync_setMode(mode)` | `USB`, `LSB`, `CW`, `CW-L`, `AM`, `FM`, `WBFM` … |
| `catsync_getBandwidth()` / `catsync_setBandwidth(hz)` | Gesamte Durchlassbreite in Hz. Nach der Betriebsart setzen: ein Wechsel der Betriebsart setzt den Durchlassbereich zurück |
| `catsync_getMute()` / `catsync_setMute(on)` | Stummschaltung, über die Stummschalttaste der Seite |
| `catsync_ready` | `true`, sobald die Funktionen installiert sind |

Die letzten drei Zeilen sind mit 4.1.0 hinzugekommen; prüfen Sie vor dem Aufruf, ob eine Funktion vorhanden ist.

---

## Demodulationsarten

### AM (Amplitudenmodulation)

**Verwendet für:**
- Flugfunk
- AM-Rundfunk
- Teile des Amateurfunks
- Seefunk

**Eigenschaften:**
- große Bandbreite (typisch 10 kHz)
- störanfällig
- leicht abzustimmen (einfach auf das Signal klicken)

**Bewährte Praxis:**
- schnelle AGC verwenden
- Störaustaster einschalten, wenn Sie Knacken hören
- auf das Maximum des Signals im Wasserfall abstimmen

### QUAM (C-QUAM-AM-Stereo)

**Verwendet für:**
- Mittelwellensender, die AM-Stereo ausstrahlen

**Eigenschaften:**
- 10 kHz breit, wird als Stereopaar statt als Mono-AM decodiert
- Die Tastenbeschriftung wird von selbst **grün**, sobald der 25-Hz-Stereopilot anliegt — so sehen Sie schon vor dem Umschalten, welche Sender wirklich in Stereo senden
- Aus AM heraus schaltet ein weiterer Druck auf synchrone AM-Demodulation am Träger um; die Beschriftung wird **gelb** und zeigt `SAM`. Ein dritter Druck führt zurück zu einfachem AM
- C-QUAM-Audio wird mit Opus übertragen, alle anderen Betriebsarten nutzen FLAC

**Bewährte Vorgehensweise:**
- Nachts auf starken Mittelwellensignalen nach der grünen Beschriftung suchen
- Klingt Stereo instabil, ist `SAM` bei schwachem Träger die ruhigere Wahl

### FM (Frequenzmodulation)

**Verwendet für:**
- VHF-/UHF-Amateurfunkrelais
- Behördenfunk (Polizei, Feuerwehr, Rettungsdienst)
- kommerziellen Betriebsfunk
- einige Satellitenverbindungen

**Eigenschaften:**
- schmale Bandbreite (typisch 12,5 oder 25 kHz)
- ausgezeichnete Störfestigkeit
- „Mitnahmeeffekt" (das stärkste Signal setzt sich durch)

**Bewährte Praxis:**
- genau auf die Signalmitte abstimmen
- Rauschsperre nutzen, um im Ruhezustand stummzuschalten
- Rauschminderung ausschalten (nicht nötig)

### USB (oberes Seitenband)

**Verwendet für:**
- KW-Amateurfunk (oberhalb 10 MHz)
- die meisten digitalen KW-Betriebsarten
- Seefunk (oberhalb 8 MHz)

**Eigenschaften:**
- schmale Bandbreite (typisch 2.4 kHz)
- effiziente Spektrumnutzung
- erfordert genaue Abstimmung

**Bewährte Praxis:**
- langsame AGC verwenden
- auf die untere Signalkante im Wasserfall abstimmen
- bei Bedarf Rauschminderung einschalten

### LSB (unteres Seitenband)

**Verwendet für:**
- KW-Amateurfunk (unterhalb 10 MHz)
- einige digitale KW-Betriebsarten
- Seefunk (unterhalb 8 MHz)

**Eigenschaften:**
- wie USB, aber spiegelbildlich
- Konvention: LSB auf den unteren KW-Bändern

**Bewährte Praxis:**
- langsame AGC verwenden
- auf die obere Signalkante im Wasserfall abstimmen
- bei Bedarf Rauschminderung einschalten

### CW (Continuous Wave / Morsetelegrafie)

**Verwendet für:**
- Amateurfunktelegrafie
- Navigationsbaken
- Zeitzeichensender

**Eigenschaften:**
- sehr schmale Bandbreite (100-500 Hz)
- hohe Effizienz
- erfordert Kenntnis des Morsecodes

**Bewährte Praxis:**
- schmales Filter verwenden (400-500 Hz)
- genau auf die Tonmitte abstimmen
- Audiofilter für einen besseren Ton einschalten

### CW-L (CW, unteres Seitenband)

Derselbe ±250-Hz-Morsefilter wie **CW**, der Ton wird aber unterhalb statt oberhalb des Trägers entnommen. Nützlich, wenn ein Signal auf der unteren Seite besser aufzunehmen ist oder ein störender Träger direkt über dem gewünschten liegt.

**Auf der Desktop-Seite gibt es keine CW-L-Taste.** Deren Betriebsartenreihe lautet `USB · LSB · CW · AM · QUAM · FM`. CW-L wird auf der vereinfachten Seite `/mobile` angeboten; am Desktop lässt es sich weiterhin über einen Link oder ein Lesezeichen setzen, das es benennt.

### WBFM (Breitband-FM)

**Verwendet für:**
- UKW-Rundfunk (88-108 MHz)
- einige Satelliten-Downlinks

**Eigenschaften:**
- sehr große Bandbreite (200 kHz)
- ausgezeichnete Tonqualität
- hohe Wiedergabetreue

**Bewährte Praxis:**
- genau auf die Mittenfrequenz abstimmen
- für Rundfunk keine Rauschsperre nötig
- genießen Sie den hochwertigen Klang!

---

## Digitale Decoder

PhantomSDR-Plus enthält integrierte Decoder für digitale Betriebsarten. Eine vollständige Anleitung finden Sie unter [Decoder](DECODERS.md).

Der schnellste Weg ist die Tastenreihe **Decoders** im Hauptpanel, direkt unter **Wheel Tuning Steps**: zehn Tasten — **FT8, FT4, FT2, JS8, CW, WSPR, FAX, SSTV, NAVTX, RTTY** —, die mit einem einzigen Druck ihren Decoder starten, den Hauptschalter Decoder auf ON stellen und das Fenster des Decoders in den sichtbaren Bereich holen. Die Taste bleibt blau, solange der Decoder läuft; ein erneuter Druck stoppt den Decoder und schließt sein Fenster. Das Dropdown-Menü **Decoder Options** funktioniert weiterhin genau wie bisher und bleibt mit den Tasten synchron.

**RADEL** und **RADEU** (RADE v1 Digital Voice) haben eigene Tasten neben der Überschrift **Modes selector** sowie in den Popup-Fenstern **Modes** und **Bands** und arbeiten nach demselben Prinzip: drücken zum Starten, erneut drücken zum Stoppen.

Die Decoder für SSTV, HF-FAX, NAVTEX, FSK/RTTY und CW laufen jeweils in einem eigenen Hintergrund-Thread, sodass das Ein- oder Ausschalten eines Decoders den Ton nie unterbricht und der Wasserfall während des Dekodierens flüssig bleibt. Sie erhalten das Audiosignal vor AGC, Rauschminderung und Stummschaltung – Sie können den Empfänger stummschalten, und die Dekodierung läuft unbeeinflusst weiter.

**Solange ein Decoder läuft, hält er Betriebsart und Durchlassbereich.** Normalerweise folgt die Betriebsart dem Bandplan — stimmen Sie in einen als LSB oder AM markierten Abschnitt, schaltet der Empfänger um. Ein laufender Decoder setzt sich darüber hinweg und behält die Betriebsart und den schmalen Durchlassbereich, die er braucht, selbst wenn Sie auf ein anderes Band gehen. Die bandeigene Betriebsart kehrt zurück, sobald Sie den Decoder abschalten, und die Mode-Schaltflächen greifen jederzeit, wenn Sie übernehmen wollen. Der CW-Decoder ist die Ausnahme: Er dekodiert in der Betriebsart, in der Sie gerade hören.

### FT8-, FT4-Decoder

**Was ist FT8, FT4?**
- weit verbreitete digitale Amateurfunk-Betriebsart
- Verbindungen mit schwachen Signalen
- 15-Sekunden-Aussendungen bei FT8, 7,5-Sekunden-Aussendungen bei FT4

**Anwendung:**
1. Stimmen Sie auf FT8- oder FT4-Frequenzen ab
2. Wählen Sie die Betriebsart USB
3. Aktivieren Sie den FT8-Decoder — drücken Sie die Taste **FT8** oder wählen Sie ihn über das Menü
4. Beobachten Sie, wie die dekodierten Meldungen erscheinen

**Übliche FT8-Frequenzen (USB):**
- 160 Meter: 1.840 MHz
- 80 Meter: 3.573 MHz
- 60 Meter: 5.357 MHz
- 40 Meter: 7.074 MHz
- 30 Meter: 10.136 MHz
- 20 Meter: 14.074 MHz
- 17 Meter: 18.100 MHz
- 15 Meter: 21.074 MHz
- 12 Meter: 24.915 MHz
- 10 Meter: 28.074 MHz
- 6 Meter: 50.313 MHz (50.323 MHz für DX)

**Übliche FT4-Frequenzen (USB):**

- 80 m: 3.575 MHz
- 40 m: 7.0475 MHz
- 30 m: 10.140 MHz
- 20 m: 14.080 MHz
- 17 m: 18.104 MHz
- 15 m: 21.140 MHz
- 12 m: 24.919 MHz
- 10 m: 28.180 MHz
- 6 m: 50.318 MHz

---

### JS8-Decoder

**Was ist JS8?**
- FT8s Schwachsignal-Engine, genutzt für Gespräche von Tastatur zu Tastatur
- Freier Text statt fester Meldungen: lange Nachrichten kommen über mehrere Zyklen
- Fünf Geschwindigkeiten; **Normal** (15 s) ist die Anruf-Geschwindigkeit und trägt fast allen Verkehr

**Bedienung:**
1. Auf eine JS8-Frequenz abstimmen
2. **USB** wählen
3. Den JS8-Decoder einschalten — Taste **JS8** oder Auswahl im Menü
4. **Speed** auf *Normal* und den Sync-Regler auf **Auto** lassen

**Das Fenster lesen:**
- Noch eintreffende Nachrichten stehen oben in Grün mit blinkendem Cursor — bei Normal kann eine Nachricht eine volle Minute brauchen
- Fertige Nachrichten darunter als `Mode | Hz | dB | Message`, **Rufzeichen in Grün**
- Eine blasse, kursive Zeile lief ab, bevor der letzte Rahmen ankam: der Text ist echt, kann aber abgeschnitten sein

**Übliche JS8-Frequenzen (USB):**

- 160m: 1.842 MHz
- 80m: 3.578 MHz
- 40m: 7.078 MHz
- 30m: 10.130 MHz
- 20m: 14.078 MHz
- 17m: 18.104 MHz
- 15m: 21.078 MHz
- 12m: 24.922 MHz
- 10m: 28.078 MHz

JS8 ist viel ruhiger als FT8 — eine Aussendung alle paar Minuten ist normal, Pausen sind kein Fehler. Vollständige Anleitung: [Decoder](DECODERS.md).

---

### CW-Decoder
Drücken Sie einfach die CW-Schaltfläche, und der dekodierte Text erscheint. Drücken Sie die CW-Schaltfläche erneut, um das Fenster zu leeren und den Decoder neu zu starten.

---

### WSPR

WSPR (Weak Signal Propagation Reporter, ausgesprochen „whisper") ist eine Bakenbetriebsart für extrem schwache Signale, die KW-Ausbreitungswege weltweit kartiert. Jede Aussendung dauert etwa 110 Sekunden und passt in einen 200 Hz breiten Kanal. Der Decoder wartet auf einen vollständigen, an UTC ausgerichteten 2-Minuten-Zeitschlitz, bevor er dekodiert. Aktivieren Sie den Decoder und wählen Sie **WSPR** aus der Auswahlliste. Oder drücken Sie einfach die Taste **WSPR**.

---

### HF-FAX / WEFAX

HF-Radiofax (auch WEFAX genannt) wird von Küstenwachen und Wetterdiensten weltweit genutzt, um Wetterkarten, Seegangskarten und Bodenanalysen über Kurzwelle auszustrahlen. Der Decoder setzt das Bild Zeile für Zeile zusammen, während es empfangen wird.

---

### NAVTEX

NAVTEX ist das internationale seefunkgestützte Aussendungssystem für küstennahe Sicherheitsinformationen – Navigationswarnungen, Wettervorhersagen sowie Such- und Rettungsmeldungen.

---

### FSK / RTTY, PSK31 und Olivia

Ein universeller Decoder für schmalbandige Textbetriebsarten mit fünf Varianten in einem Fenster: maritimes FSK (SITOR), Wetter-RTTY, Amateur-RTTY, **PSK31** (Phasenumtastung, 31,25 Baud) und **Olivia** (Mehrton-FSK mit Vorwärtsfehlerkorrektur). Das Bedienfeld passt sich der Variante an — die Regler für Shift, Baud und Rahmung verschwinden bei PSK31 und Olivia, und Olivia ergänzt einen Mode-Wähler und einen Squelch-Regler.

Zwei Dinge sind wichtig: PSK31 korrigiert seinen Abstimmfehler über etwa ±25 Hz selbst, Sie müssen also nur in die Nähe kommen; Olivia braucht einen **Mode** (Töne / Bandbreite), der exakt zur Aussendung passt, sendet keine Präambel und benötigt daher einige Sekunden zur Synchronisierung, bevor Text erscheint. Das Bedienfeld startet mit Olivia **8 / 250**.

---

### QRSS-Grabber

QRSS ist CW, das so langsam gesendet wird, dass ein einzelner Punkt Sekunden dauert; es wird angesehen statt gehört — der Grabber zeichnet die Spur auf seiner eigenen Anzeige. Er steht nicht im Decoder-Auswahlmenü, sondern hat einen eigenen Bereich **QRSS** und kann gleichzeitig mit einem Decoder laufen.

Drücken Sie **🐌 Show**, wählen Sie dann ein Fenster aus der Liste **Band** und drücken Sie **Tune**: Der Empfänger geht in **CW** auf diese Frequenz, mit einem für die Betriebsart passenden Durchlassbereich, und die Spur landet auf der Mittellinie der Anzeige. 30 m (10.140,00 kHz) ist das belebteste Fenster. Stellen Sie **Speed** passend zur Bake ein — **QRSS 10**, wenn Sie es nicht wissen — und haben Sie Geduld: Ein Rufzeichen kann zehn Minuten brauchen, um über den Schirm zu wandern. Einzelheiten in [Decoder](DECODERS.md).

---

### SSTV

Slow-Scan-Television überträgt Standbilder Zeile für Zeile über einen gewöhnlichen SSB-Kanal. Aktivieren Sie den Decoder, wählen Sie **SSTV** und stimmen Sie auf eine SSTV-Frequenz ab – 14.230 MHz ist die wichtigste internationale Anruffrequenz. Belassen Sie **Mode** auf **Auto**: Der Decoder liest den VIS-Kopf der Aussendung und bestimmt die Betriebsart notfalls anhand des Synchronisationstimings, falls Sie erst nach dem Kopf eingestiegen sind. Die Modi Martin, Scottie und Robot werden unterstützt, und das Bild baut sich Zeile für Zeile auf. Oder drücken Sie einfach die Taste **SSTV**.

### Automatisches Spot-Reporting und Systemgraphen

FT8-, FT4- und WSPR-Dekodierungen kann auch der Server selbst hochladen — FT8/FT4 an PSK Reporter, WSPR an WSPRnet — über einen Autorun-Daemon, den der Sysop im Admin-Panel startet. Er ist von den Decodern in Ihrem Browser unabhängig: er läuft weiter, ob jemand zuhört oder nicht, und nichts, was Sie im Browser dekodieren, wird gemeldet.

Der Sysop verfolgt ihn über zwei Zähler, die leicht zu verwechseln sind: Die Kacheln je Decoder zählen die seit dem letzten Start des Daemons hochgeladenen Spots, während die Zahl neben dem Kontrollkästchen jedes Bands bzw. jeder Betriebsart der Gesamtwert seit Beginn ist und Neustarts übersteht. Dasselbe Panel enthält eine Seite **Graphen**, die CPU-Takt, CPU-Last, CPU-Temperatur und Nutzer online über die letzten 15 Minuten bis 24 Stunden darstellt. Beides beschreibt das [Admin-Panel-Handbuch](ADMIN_PANEL_SETUP.md).


---

## Tastenkürzel

Tastenkürzel für zügigeres Arbeiten.

---

### Frequenzsteuerung

Die Frequenzanzeige ist eine Ziffernreihe, die Sie direkt bedienen. **Klicken Sie zuerst auf eine Ziffer** — das wählt sie aus, und alles Folgende wirkt auf die Auswahl.

- **Pfeil links / rechts**: verschiebt die Auswahl zur nächsten Ziffer (acht Ziffern, 100 MHz bis 10 Hz)
- **Pfeil hoch / runter**: erhöht oder verringert die *ausgewählte* Ziffer um ihren Stellenwert — auf der MHz-Ziffer also 1 MHz, auf der letzten 10 Hz
- **0 – 9**: schreibt die Ziffer direkt an die ausgewählte Stelle

**Mausrad über der Frequenzanzeige**: schrittet mit der Abstimmschrittweite des Bandes (1 kHz, sofern der Bandplan nichts anderes vorgibt). **Shift** für 1 kHz, **Alt** für 10 kHz.

**Mausrad über dem Wasserfall**: zoomt. Mit **Ctrl** (oder **Cmd**) bzw. **Shift** wird stattdessen abgestimmt, mit **Shift + Ctrl** auf volle kHz gerundet.

> Page-Up- / Page-Down-Kürzel gibt es nicht.

---

## Lesezeichen

Speichern Sie Ihre Lieblingsfrequenzen für den schnellen Zugriff. Sie können die Lesezeichenliste auch exportieren, lokal speichern und anschließend in ein beliebiges anderes PhantomSDR importieren.

Wenn sich Lesezeichen und Marker überlappen:

🔵 Blaue Lesezeichen erscheinen oben <br /> 🟡 Gelbe Marker erscheinen darunter <br />
✅ Klicks auf Lesezeichen haben Vorrang <br />


### Ein Lesezeichen hinzufügen

1. Auf die gewünschte Frequenz abstimmen
2. Auf die Schaltfläche „Bookmarks" klicken
3. Auf „Add Bookmark" klicken
4. Eine Beschreibung eingeben
5. Auf „Save" klicken

┌──────────────┬────────────────┬────────┐ │ Bookmark name│Label (optional)│ [Add]  │ └──────────────┴────────────────┴────────┘

### Verwendung:

**Lesezeichen hinzufügen:**
- Name: „Local News Station"
- Label: „NEWS"
- Auf Add klicken

**Anzeige im Wasserfall:**
- hineinzoomen, bis die Marker erscheinen
- ein marineblauer Kasten mit „NEWS" in fettem Gelb erscheint

**Lesezeichen anklicken:**
- stimmt auf die Frequenz ab
- stellt die Demodulationsart ein
- funktioniert genau wie ein Klick auf einen Marker

### Lesezeichen verwalten
- **Bearbeiten**: auf das Stiftsymbol neben dem Lesezeichen klicken
- **Löschen**: auf das Papierkorbsymbol neben dem Lesezeichen klicken
- **Exportieren**: Lesezeichen als JSON-Datei herunterladen
- **Importieren**: Lesezeichen aus einer JSON-Datei hochladen

### Lesezeichen weitergeben

1. Auf „Export Bookmarks" klicken
2. Die JSON-Datei an andere weitergeben
3. Die Empfänger klicken auf „Import Bookmarks"
4. Sie wählen Ihre Datei aus
---

## Nutzung auf Mobilgeräten

PhantomSDR-Plus funktioniert hervorragend auf Mobilgeräten!

### Zwei mobile Ansichten

Es gibt zwei Wege, den Empfänger auf dem Telefon zu benutzen:

- **`http://ihr_server:PORT/mobile`** — die vereinfachte Seite. Kein Wasserfall, dadurch etwa halb so viel Datenverbrauch. Frequenzeingabe, Abstimmschritte, Betriebsarten, S-Meter, Bänder, Lesezeichen, Benutzerliste und Chat.
- **Die erweiterte Ansicht** — das Telefon-Layout der Hauptoberfläche, mit Wasserfall und dem vollen Umfang der Bedienelemente.

Gewechselt wird mit den Schaltflächen am unteren Rand von `/mobile` (**Mobile extended view**, **Full desktop view**) und mit **Simplified mobile** in der erweiterten Ansicht.

**Ihre Frequenz kommt mit.** Ein Ansichtswechsel lässt Sie auf demselben Signal — Frequenz und Betriebsart reisen im Link mit, Sie landen also nicht mehr auf der Standardfrequenz des Empfängers. Auch die Adresszeile folgt Ihrer Abstimmung: Neuladen, ein Lesezeichen oder ein an jemanden verschickter Link führen genau auf diese Frequenz zurück.

**Die Betriebsart folgt auf beiden Seiten dem Bandplan.** Stimmen Sie in ein Segment ab, das als AM, LSB, USB oder CW eingetragen ist — durch Eingeben einer Frequenz, schrittweises Abstimmen oder eine Bandtaste — schaltet der Empfänger auf diese Betriebsart um, auf der vereinfachten Seite ebenso wie in der vollen Oberfläche. Eine von Hand gewählte Betriebsart bleibt bestehen, solange Sie sich innerhalb desselben Segments bewegen; außerhalb der definierten Bänder wird Ihre Betriebsart nicht angetastet. Während **RADE** (RADEL/RADEU) läuft, behält es den Empfänger, sodass das Abstimmen den Decoder nicht unterbricht.

Beim Wechsel zwischen den beiden Ansichten kommt Ihre aktuelle Betriebsart mit; kennt die Zielansicht sie nicht, entscheidet der Bandplan für diese Frequenz — eine Rundfunkfrequenz kommt in AM an, 40 m in LSB, ein CW-Segment in CW. `SAM` auf der vereinfachten Seite wird in der erweiterten Ansicht zu AM mit dem Synchrondemodulator und umgekehrt. `RADEL` und `RADEU` gibt es nur auf der vereinfachten Seite; wechseln Sie von dort weg, bleibt die Frequenz erhalten und der Bandplan wählt die Betriebsart.

Eine Frequenz außerhalb des Empfangsbereichs wird auf die nächste Bereichsgrenze gezogen, ein alter Link kann Sie also nie außerhalb des Bandes stranden lassen.

### Besonderheiten auf Mobilgeräten

- **Fingerfreundliche Bedienelemente**: große Schaltflächen und Regler
- **Wischen zum Abstimmen**: nach links/rechts über den Wasserfall wischen
- **Zwei-Finger-Zoom**: den Wasserfall zum Vergrößern/Verkleinern aufziehen
- **Querformat**: für eine bessere Ansicht drehen

### Tipps für Mobilgeräte

1. **WLAN nutzen**: Audiostreaming verbraucht Datenvolumen
2. **Querformat**: bessere Sicht auf den Wasserfall
3. **Kopfhörer**: bessere Tonqualität
4. **Favoriten als Lesezeichen**: erleichtert das Wiederfinden von Stationen
5. **Andere Apps schließen**: sorgt für flüssigen Betrieb

### Empfohlene mobile Browser

- **Android**: Chrome oder Samsung Internet
- **iOS**: Mozilla
- **Beide**: achten Sie darauf, dass der Browser aktuell ist

---

## Tipps und bewährte Praktiken

### Für besten Empfang

1. **Starke Signale wählen**: achten Sie auf Orange/Rot im Wasserfall
2. **Genau abstimmen**: direkt auf die Signalmitte klicken
3. **Richtige Betriebsart wählen**: passend zum Signaltyp
4. **AGC einstellen**: schnell für AM, langsam für SSB
5. **NR/NB nutzen**: hilfreich bei störreichen Bedingungen

### Aktivität finden

1. **Den Wasserfall beobachten**: die Farben zeigen die Signalstärke
2. **Auf beliebten Frequenzen hören**:
   - 40 m: 7.100-7.300 MHz (LSB)
   - 20 m: 14.200-14.350 MHz (USB)
   - 2 m: 145.200-145.600 MHz (FM)
3. **Bandplan-Overlay prüfen**: zeigt die Frequenzzuweisungen
4. **Lesezeichen nutzen**: schneller Zugriff auf aktive Frequenzen

### Ausbreitungsbedingungen verstehen

**Kurzwelle tagsüber:**
- die höheren Bänder funktionieren besser (20 m, 15 m, 10 m)
- Weitverbindungen (DX) sind möglich
- Rundfunkstationen sind hörbar

**Kurzwelle nachts:**
- die niedrigeren Bänder funktionieren besser (80 m, 40 m)
- andere Ausbreitungsmuster
- andere Stationen sind hörbar

**VHF/UHF:**
- überwiegend Sichtverbindung
- örtlicher Funkverkehr
- gleichmäßigere Bedingungen

### Umgangsformen

1. **Blockieren Sie den Empfänger nicht**: andere möchten auch hören
2. **Nutzen Sie den Chat respektvoll**: seien Sie höflich zu anderen Nutzern
3. **Melden Sie Probleme**: helfen Sie dem Betreiber, die Station zu pflegen
4. **Fragen Sie nicht nach technischem Support**: dies ist eine Hörplattform. Schreiben Sie dem SysOp, wenn Sie Hilfe brauchen.

---

## Fehlerbehebung

### Kein Ton

**Mögliche Ursachen:**
1. Browser stummgeschaltet → Lautstärkeregelung des Browsers prüfen
2. System stummgeschaltet → Lautstärke des Rechners prüfen
3. Schwaches Signal → auf ein stärkeres Signal abstimmen (S7+)
4. Falsche Betriebsart → andere Demodulationsarten ausprobieren

**Lösungen:**
1. Auf ein starkes Signal klicken (orange/rot im Wasserfall)
2. Prüfen, ob der Browser nicht stummgeschaltet ist (Stummsymbol im Tab)
3. Eine andere Frequenz ausprobieren
4. Die Seite neu laden (F5)

### Verzerrter Ton

**Mögliche Ursachen:**
1. Übersteuertes Signal → Signal zu stark
2. Falsche Betriebsart → AM-Signal in SSB gehört usw.
3. Störungen → Nachbarsignale strahlen ein

**Lösungen:**
1. Lautstärke verringern
2. Eine andere Demodulationsart ausprobieren
3. Ein schmaleres Filter verwenden
4. Von störenden Signalen wegstimmen

### Wasserfall wird nicht aktualisiert

**Mögliche Ursachen:**
1. Netzwerkproblem → langsame oder unterbrochene Verbindung
2. Browserleistung → zu viele geöffnete Tabs
3. Serverüberlastung → zu viele Nutzer

**Lösungen:**
1. Internetverbindung prüfen
2. Nicht benötigte Browser-Tabs schließen
3. Seite neu laden (F5)
4. Später erneut versuchen, wenn weniger Nutzer online sind

### Abstimmen auf eine Frequenz nicht möglich

**Mögliche Ursachen:**
1. Frequenz außerhalb des Bereichs → das SDR deckt diese Frequenz nicht ab
2. Falsches Eingabeformat → richtiges Format verwenden (z. B. „14200" statt „14.200.000")

**Lösungen:**
1. Frequenzabdeckung des SDR prüfen (auf der Seite angegeben)
2. Die angegebenen Formatbeispiele verwenden
3. Stattdessen in den Wasserfall klicken

### Stotternder/abgehackter Ton

**Mögliche Ursachen:**
1. langsame Internetverbindung
2. hohe Serverlast
3. Leistungsprobleme des Browsers

**Lösungen:**
1. Andere Anwendungen schließen, die Bandbreite verbrauchen
2. Außerhalb der Stoßzeiten erneut versuchen
3. Nicht benötigte Browser-Tabs schließen
4. Kabelverbindung statt WLAN verwenden

---

## Häufig gestellte Fragen

### Allgemeine Fragen

**F: Brauche ich besondere Ausrüstung, um WebSDR zu nutzen?**
A: Nein! Nur einen Computer oder ein Mobilgerät mit Internetzugang.

**F: Ist die Nutzung von WebSDR kostenlos?**
A: Ja, die meisten WebSDRs sind kostenlos. Sie werden von Freiwilligen betrieben.

**F: Kann ich mit WebSDR senden?**
A: Nein, WebSDR ist reiner Empfang. Senden ist nicht möglich.

**F: Welche Frequenzen kann ich hören?**
A: Das hängt von der Konfiguration des WebSDR ab. Sehen Sie in den Stationsinformationen nach.

**F: Kann ich den Ton aufzeichnen?**
A: Einige Browser erlauben Aufnahmen. Prüfen Sie die Funktionen Ihres Browsers.

### Technische Fragen

**F: Welche Abtastrate verwendet das SDR?**
A: Das ist von Station zu Station verschieden. Sehen Sie auf der Stationsinformationsseite nach.

**F: Wie groß ist die Latenz?**
A: Typischerweise 2-5 Sekunden zwischen Funksignal und Ihren Lautsprechern.

**F: Kann ich mehrere Instanzen nutzen?**
A: Meist ja, das kann den Server aber belasten. Bitte nehmen Sie Rücksicht.

**F: Funktioniert es offline?**
A: Nein, WebSDR erfordert eine Internetverbindung.

**F: Welche Browser werden unterstützt?**
A: Chrome, Firefox, Edge, Safari (jeweils aktuelle Versionen)

### Fragen zur Nutzung

**F: Wie viele Personen können gleichzeitig hören?**
A: Das hängt von der Serverkapazität ab. Oft 50-200 Nutzer und mehr.

**F: Kann ich sehen, was andere hören?**
A: Falls aktiviert, ja. Achten Sie auf die Anzeigen für „andere Nutzer".

**F: Kann ich mit anderen Hörern chatten?**
A: Falls vom Betreiber aktiviert. Achten Sie auf das Chatfenster.

**F: Warum ist auf manchen Frequenzen nichts zu sehen?**
A: Auf dieser Frequenz sind gerade keine Signale. Probieren Sie andere!

**F: Was sind die farbigen Bänder im Wasserfall?**
A: Das Bandplan-Overlay mit den Frequenzzuweisungen.

---

## Ressourcen

### Mehr über Funk erfahren

- **Bandpläne**: suchen Sie nach „amateur radio band plan" + Ihre Region
- **Ausbreitung**: informieren Sie sich über die Ausbreitung von KW-Funkwellen
- **Digitale Betriebsarten**: informieren Sie sich über FT8, PSK31, RTTY
- **Amateurfunk**: erwägen Sie, eine Amateurfunkgenehmigung zu erwerben!

### Weitere WebSDRs finden

- **WebSDR-Verzeichnis**: http://sdr-list.xyz
- **WebSDR.org**: http://websdr.org
- **KiwiSDR**: http://kiwisdr.com/public/

### Hilfe erhalten

1. **Stationsbetreiber**: Kontaktdaten auf der Seite prüfen
2. **Nutzerchat**: andere Hörer fragen (falls verfügbar)
3. **Onlineforen**: nach WebSDR-Gemeinschaften suchen
4. **Dokumentation**: dieses Handbuch zurate ziehen!

---

## Anhang: übliche Frequenzen

### KW-Amateurfunkbänder

| Band | Frequenzbereich | Betriebsart | Aktivität |
|------|-----------------|-------------|-----------|
| 160 m | 1.800-2.000 MHz | LSB | nachts/lokal |
| 80 m | 3.500-4.000 MHz | LSB | nachts/regional |
| 40 m | 7.000-7.300 MHz | LSB | tags/nachts/DX |
| 30 m | 10.100-10.150 MHz | USB | nur Daten/CW |
| 20 m | 14.000-14.350 MHz | USB | tagsüber/DX |
| 17 m | 18.068-18.168 MHz | USB | tagsüber/DX |
| 15 m | 21.000-21.450 MHz | USB | tagsüber/DX |
| 12 m | 24.890-24.990 MHz | USB | tagsüber/DX |
| 10 m | 28.000-29.700 MHz | USB | sporadisch/DX |

### VHF-/UHF-Amateurbänder

| Band | Frequenzbereich | Betriebsart | Aktivität |
|------|-----------------|-------------|-----------|
| 6 m | 50.000-54.000 MHz | USB/FM | sporadisch |
| 2 m | 144.000-148.000 MHz | FM | sehr rege |
| 70 cm | 420.000-450.000 MHz | FM | rege |

### Rundfunkbänder

| Dienst | Frequenzbereich | Betriebsart |
|--------|-----------------|-------------|
| AM-Rundfunk | 530-1710 kHz | AM |
| Kurzwelle | 2.3-26.1 MHz | AM |
| UKW-Rundfunk | 88-108 MHz | WBFM |

### Luftfahrt

| Dienst | Frequenzbereich | Betriebsart |
|--------|-----------------|-------------|
| Flugsicherung | 118-137 MHz | AM |
| ACARS (Daten) | 130-136 MHz | Daten |

### Seefunk

| Dienst | Frequenzbereich | Betriebsart |
|--------|-----------------|-------------|
| UKW-Seefunk | 156-162 MHz | FM |
| KW-Seefunk | 2-22 MHz | USB |

---

## Glossar

**AGC**: automatische Verstärkungsregelung – passt die Audiopegel automatisch an

**AM**: Amplitudenmodulation – Sprechfunkart für Luftfahrt und Rundfunk

**Bandbreite**: der Frequenzbereich eines Signals

**CW**: Continuous Wave – Morsesignale

**DX**: Weitverbindung

**FFT**: schnelle Fourier-Transformation – wandelt den Zeit- in den Frequenzbereich

**FM**: Frequenzmodulation – Sprechfunkart für VHF/UHF

**HF**: Kurzwelle (3-30 MHz) – Bänder für große Entfernungen

**kHz**: Kilohertz (1.000 Hz)

**LSB**: unteres Seitenband – Sprechfunkart für die unteren KW-Bänder

**MHz**: Megahertz (1.000.000 Hz)

**NB**: Störaustaster – entfernt Impulsstörungen

**NR**: Rauschminderung – vermindert Hintergrundrauschen

**PSK**: Phasenumtastung – digitale Betriebsart

**RTTY**: Funkfernschreiben – digitale Textbetriebsart

**S-Meter**: Signalstärkeanzeige

**SDR**: Software Defined Radio

**SQL**: Rauschsperre – schaltet den Ton bei fehlendem Signal stumm

**SSB**: Einseitenband (USB oder LSB)

**USB**: oberes Seitenband – Sprechfunkart für die oberen KW-Bänder

**VHF**: Ultrakurzwelle (30-300 MHz) – Sichtverbindung

**UHF**: Dezimeterwelle (300-3000 MHz) – Sichtverbindung

**Wasserfall**: visuelle Darstellung des Funkspektrums über die Zeit

---

**Viel Freude beim Erkunden des Funkspektrums mit PhantomSDR-Plus!**

**73 (beste Grüße) de SV1BTL & SV2AMK**

Installationsanweisungen finden Sie in [INSTALLATION.md](INSTALLATION.md). Technische Einzelheiten finden Sie in [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md).
