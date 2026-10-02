# PhantomSDR-Plus

**Ein erweiterter Open-Source-WebSDR-Server mit fortschrittlichen Funktionen und futuristischem Design**

PhantomSDR-Plus ist ein Fork von PhantomSDR und stellt einen leistungsstarken Software-Defined-Radio-(SDR-)Webserver bereit, der Hunderte gleichzeitiger Nutzer bedienen kann. Er bietet eine verbesserte Benutzeroberfläche, Unterstützung mehrerer Decoder, eine Bandplan-Visualisierung sowie Kompatibilität mit verschiedenen SDR-Hardwareplattformen.

---

## 🌟 Wichtigste Funktionen

### Leistung und Skalierbarkeit
- **Mehrbenutzerbetrieb**: Hunderte gleichzeitiger Nutzer, je nach Hardware
- **Hohe Abtastrate**: Unterstützung von SDRs bis 70 MSPS (real) / 35 MSPS (IQ)
- **Hardwarebeschleunigung**: OpenCL- und CUDA-Unterstützung für GPU-beschleunigte Verarbeitung
- **Optimiertes Streaming**: FLAC- und Opus-Audiokompression mit geringer Latenz

### Benutzeroberfläche
- **Futuristisches Design**: moderne, responsive Weboberfläche
- **Für Mobilgeräte optimiert**: verbesserte mobile Oberfläche für unterwegs
- **Bandplan-Visualisierung**: interaktiver Wasserfall mit Frequenzband-Overlays
- **Anpassbare Farbpaletten**: mehrere Farbschemata für den Wasserfall
- **Doppeltes S-Meter**: wahlweise analoge oder digitale Signalanzeige
- **Decoder-Tasten mit einem Druck**: eine Decoder-Reihe im Hauptfeld direkt unter der Modus-Auswahl (FT8, FT4, FT2, JS8, CW, WSPR, FAX, SSTV, NAVTX, RTTY), dazu RADEL und RADEU neben der Modus-Auswahl selbst sowie in den Pop-ups für Modi und Bänder. Ein Druck startet den Decoder und öffnet sein Fenster, ein zweiter beendet ihn. Die bisherige Bandbreiten-Reihe ist entfallen.
- **Kanalsuchlauf**: durchsucht das Band oder genau den sichtbaren Wasserfallausschnitt und hält beim ersten Kanal an, der eine wählbare Anzahl dB über dem Rauschflur des Bandes liegt; sobald der Kanal wieder still ist, läuft er von selbst weiter. Die Schrittweite folgt der Betriebsart, und die Stopps liegen auf dem Kanalraster (1 kHz SSB, 100 Hz CW, 5 kHz Kurzwellen-AM, 9/10 kHz Mittelwelle, 9 kHz Langwelle). Ein Modus *Leere überspringen* liest das Wasserfallspektrum und springt direkt zu den Signalen, und eine Sperrtaste nimmt einen dauerbelegten Kanal aus dem Suchlauf. Alles läuft lokal im Browser des Hörers, der Suchlauf verstellt den Empfänger für niemanden sonst (siehe [Benutzerhandbuch](USER_GUIDE.md))
- **Empfangsdiversität**: koppelt den Empfänger mit einem zweiten an einem anderen Ort und gibt jeweils die Seite mit dem besseren Signal wieder, sodass ein Schwund an der einen Station von der anderen aufgefangen wird. Der Partner kann ein weiterer PhantomSDR-Plus, ein KiwiSDR, ein UberSDR oder ein WebSDR sein; die ersten drei brauchen nichts außer dem Browser des Hörers, und nur ein WebSDR benötigt ein kleines Relais auf Ihrem eigenen Server. Die Ausrichtung dauert etwa fünfzehn Sekunden, und ein Fernabgleich des SNR gleicht die beiden Stationen aneinander an. Jeder Hörer führt im eigenen Browser eine benannte Liste zweiter Empfänger in selbst gewählter Reihenfolge und kann sie in eine Datei exportieren und wieder einlesen (siehe [Empfangsdiversität](RECEIVE_DIVERSITY.md))

### Signalverarbeitung
- **Mehrere Demodulationsarten**: AM, FM, USB, LSB, CW und mehr. Ein RADE-Decoder der Version 1 wurde ebenfalls implementiert.
- **Synchrone AM-Demodulation**: verbesserte AM-Empfangsqualität
- **Rauschminderung**: NR (spektral), NB (Störaustaster), NS (Grundrauschunterdrückung) und AN (automatische Notch) — sämtlich am Hörweg, nie an den Decodern
- **AGC-Optionen**: mehrere Betriebsarten der automatischen Verstärkungsregelung
- **Auto-Squelch**: automatische, rauschbasierte Rauschsperrenschwelle
- **KI-Rauschunterdrückung**: neuronales Netz RNNoise im Browser des Hörers, entfernt Bandrauschen aus Sprache (nur Sprachbetriebsarten; siehe [Benutzerhandbuch](USER_GUIDE.md))

### Erweiterte Funktionen
- **Digitale Decoder**: FT8, FT4, FT2, JS8, CW, QRSS Grabber, WSPR, HF-FAX, SSTV, NAVTEX, FSK/RTTY, PSK31, Olivia und FreeDV RADE, jeweils in einem eigenen Hintergrund-Thread, sodass die Dekodierung das Audio nie unterbricht (siehe [Decoder](DECODERS.md))
- **Decoder ID**: benennt die digitale Betriebsart im Durchlassbereich und bietet mit einem Klick den passenden Decoder an — aus gemessener Bandbreite, Tonabstand, Symbolrate und Burst-Timing, wobei die Frequenz als zusätzlicher Hinweis einfließt, was zugleich **FT8 von JS8** trennt, zwei Betriebsarten mit identischem Signal. Es schlägt nur vor, schaltet nie von selbst um, und schweigt lieber, als bei zu schwachem Signal zu raten. Schwund bringt es nicht zum Verstummen: Zerlegt QSB eine zweiminütige WSPR-Aussendung in Bruchstücke, benennt es die Betriebsart weiterhin, liest den Takt aus dem gesamten Beobachtungszeitraum und senkt die angezeigte Sicherheit, um den schwächeren Beleg kenntlich zu machen. Zwischen etwa 400 Hz und 2700 Hz spielt die Lage im Durchlassbereich keine Rolle; außerhalb erscheint eine bernsteinfarbene Schaltfläche **Recentre & retry**, die die Abstimmung einmal verschiebt und neu misst. Nehmen Sie einen Vorschlag an, wird der Empfänger auf diese Betriebsart eingestellt: Die Abstimmfrequenz rückt in die Mitte des Wasserfalls, die Ansicht wird rund 100 kHz breit, und Seitenband und Durchlassbereich werden die, mit denen diese Betriebsart gearbeitet wird — das 3-kHz-Teilband für die FT8-Familie, 1350–1650 Hz für WSPR, ±250 Hz und CW für Morsetelegrafie, und so weiter. Standardmäßig aus, im Betrieb etwa 0,5 % eines Kerns (siehe [Decoder](DECODERS.md))
- **Voreinstellungen für digitale Betriebsarten**: FT8, FT4, FT2, JS8 oder WSPR setzen Seitenband und Durchlassbereich zugleich
- **JS8-Gesprächsfenster**: Nachrichten aus mehreren Frames werden zu ganzen Sätzen zusammengesetzt
- **Statistik-Dashboard**: Server- und Nutzerstatistiken in Echtzeit
- **Liste der verbundenen Nutzer**: alle, die gerade zuhören, mit einer Abstimmschaltfläche in jeder Zeile. Ihre eigene Sitzung ist mit **you** markiert — sowohl im Fenster der Oberfläche als auch, wenn `users.html` als eigene Seite geöffnet wird
- **Automatisches Spot-Reporting**: Ein Autorun-Daemon dekodiert FT8, FT4 und WSPR auf dem Server und lädt Spots zu PSK Reporter und WSPRnet hoch, mit zwei Zählern im Admin-Panel — Kacheln je Decoder für den aktuellen Lauf und ein Gesamtwert seit Beginn neben jedem Band-/Betriebsart-Kontrollkästchen
- **Systemgraphen**: eine Seite **Graphen** im Admin-Panel mit CPU-Takt, CPU-Last, CPU-Temperatur und Nutzern online über die letzten 15 Minuten bis 24 Stunden (siehe [Admin-Panel](ADMIN_PANEL_SETUP.md))
- **Thermischer Schutz**: ein Wächter im Admin-Panel stoppt den Server bei CPU-Überhitzung und startet ihn wieder, sobald sie abgekühlt ist — mit Schwellen aus dem kritischen Grenzwert Ihrer eigenen CPU und ohne Annahmen darüber, wie Sie den Server starten oder stoppen. Ausgeliefert im reinen Protokollmodus, er tut also nichts, bis Sie ihn aktivieren (siehe [Thermal Guard](THERMAL_GUARD.md)) Für einen unbeaufsichtigten Empfänger wird **dringend empfohlen**, das Panel als systemd-Unit zu betreiben — der Wächter läuft darin, also nimmt ein Neustart ihm sonst den Schutz (siehe [Admin-Panel](ADMIN_PANEL_SETUP.md#panel-neu-starten)).
- **Emulation von KiwiSDR-Clients**: eine optionale Brücke, die auf demselben Host und Port zusätzlich das KiwiSDR-Protokoll beantwortet, sodass Kiwi-Software wie **AetherSDR** und `kiwiclient` sich direkt mit dem Empfänger verbindet — mit echtem Abstimmen, Wasserfall und einem S-Meter auf derselben Skala wie das Web-S-Meter. Aus, bis `[kiwi_emulation] enabled = true` in Ihrer Konfiguration steht (siehe [Installation](Aether_config.md))
- **Transceiver-Steuerung (CAT)**: hält Ihr eigenes Funkgerät und Ihr Empfängerfenster auf derselben Frequenz, Betriebsart und Filterbreite, in eine Richtung oder in beide – über das Menü Rig von [Desktop PhantomSDR+](https://www.dropbox.com/scl/fo/kjwj96zg3kj7dgq4fjef9/APnA3c9hhv4hk3YMGIGjH7s?rlkey=jfiwklly63kv73poalx631pk3&st=m37uvaym&dl=0) (Icom, Yaesu, Kenwood, Elecraft, FlexRadio und QRP Labs direkt, jedes andere Funkgerät über Hamlib, oder flrig) oder mit dem CATsync Tool for WebSDRs im Browser. Die Seiten stellen `catsync_*`-Funktionen für Frequenz, Betriebsart, Filterbreite und Stummschaltung bereit. Es funktioniert mit Empfängern PhantomSDR-Plus, KiwiSDR, PA3FWM WebSDR und UberSDR (siehe [Transceiver-Steuerung](RIG_CONTROL.md))
- **Lesezeichensystem**: Import/Export von Frequenz-Lesezeichen
- **Tastenkürzel**: effiziente Navigation und Bedienung
- **Mausrad-Unterstützung**: intuitive Frequenzabstimmung
- **WebSDR-Verzeichnis**: Anbindung an https://sdr-list.xyz

---

## 📋 Unterstützte Hardware

PhantomSDR-Plus unterstützt eine breite Palette von SDR-Empfängern:

| Gerät | Abtastrate | Format | Schnittstelle |
|-------|------------|--------|---------------|
| **RX888 MK2** | bis 64 MHz | 16 Bit | nativ |
| **RTL-SDR** | bis 3.2 MHz | 8 Bit | rtl_sdr |
| **HackRF One** | bis 20 MHz | 8 Bit | hackrf_transfer |
| **Airspy HF+ / Discovery** | bis 912 kHz | 16 Bit | SoapySDR (SoapyAirspyHF) + rx_sdr |
| **SDRplay RSP1A** | bis 10 MHz | 16 Bit | SoapySDR (libmirisdr-5 + SoapyMiri oder die SDRplay-API) + rx_sdr |
| **RigExpert Fobos SDR** | 50 MHz (HF-Direktabtastung) / bis 20 MHz (RF) | 16 Bit / 32-Bit-Float | SoapySDR (SoapyFobosSDR) + rx_sdr |
| **Weitere Geräte** | variabel | verschieden | SoapySDR/rx_tools |

---

## 🚀 Schnellstart

### Systemanforderungen

**Minimum:**
- Ubuntu 22.04 LTS (empfohlen) oder Fedora
- 2-Kern-CPU
- 4 GB RAM
- 10 GB Festplattenspeicher

**Empfohlen:**
- Ubuntu 24.04 LTS
- CPU mit 4+ Kernen (Ryzen 5 2600 oder Intel i5-6500T oder besser)
- 8 GB RAM
- GPU mit OpenCL-Unterstützung (optional, aber sehr empfehlenswert)
- SSD-Speicher

### Installation

```bash
# Das Repository klonen
git clone --recursive https://github.com/sv1btl/PhantomSDR-Plus
cd PhantomSDR-Plus

# Skripte ausführbar machen
chmod +x *.sh

# Automatische Installation ausführen
./install.sh
```

**Hinweis:** Starten Sie nach dem Ausführen von `install.sh` Ihr Terminal neu, bevor Sie fortfahren.

> **Läuft PhantomSDR-Plus bei Ihnen schon?** Dann nicht neu installieren, sondern aktualisieren. Holen Sie das Update-Werkzeug einmal und starten Sie es; Konfiguration, Marker, Admin-Passwort, Frequenzliste und Chatverlauf werden nie angerührt, und was Sie selbst geändert haben, wird Ihnen vorgelegt statt überschrieben:
>
> ```bash
> cd ~/PhantomSDR-Plus
> curl -fLO https://raw.githubusercontent.com/sv1btl/PhantomSDR-Plus/main/update.sh
> chmod +x update.sh
> ./update.sh
> ```
>
> Die letzte Zeile *meldet* nur, was sich ändern würde, und schreibt nichts; `./update.sh --apply` führt es aus. Einzelheiten im Kapitel *PhantomSDR-Plus aktualisieren*. Den Installer über eine laufende Station zu wiederholen ist nur nötig, wenn der Neubau an fehlenden Systempaketen scheitert.

Nehmen Sie `install_fedora.sh` auf Fedora, `install_arch.sh` auf Arch oder `install_opensuse.sh` auf openSUSE Tumbleweed — sie leisten dieselbe Arbeit mit einem anderen Paketmanager. Jede Debian- und Ubuntu-Version deckt `install.sh` selbst ab.

Nichts muss vorher von Hand installiert werden. Das Skript installiert die Build-Abhängigkeiten und Node.js, baut das Backend, baut den Treiber für den von Ihnen gewählten Empfänger (beim RX888 samt udev-Regeln), öffnet `site_information.json` zum Ausfüllen, baut das Frontend, installiert OpenCL, wenn die Hardware es unterstützt, und richtet dann das **Admin-Panel**, den **FreeDV-RADE-Decoder** und den **Statistikserver** ein — alle drei standardmäßig, mit `n` überspringen — und schließt mit einem vollständigen `recompile.sh` ab. Es ist durchgehend interaktiv und dauert von zwanzig Minuten bis über eine Stunde.

Die Schritt-für-Schritt-Beschreibung finden Sie in [INSTALLATION.md → Was das Installationsskript erledigt](INSTALLATION.md#was-das-installationsskript-erledigt). Ausführliche Installationsanweisungen finden Sie in [INSTALLATION.md](INSTALLATION.md).

---

## 📊 Leistungsmessungen

| Hardware | Abtastrate | CPU-Auslastung | Nutzerkapazität |
|----------|------------|----------------|------------------|
| Ryzen 5 2600 (alle Kerne) | 64 MHz (32 MHz IQ) | 38–40 % | 100+ Nutzer |
| AMD RX 580 (GPU) | 64 MHz (32 MHz IQ) | 28–35 % | 100+ Nutzer |
| Intel i5-6500T (mit OpenCL) | 60 MHz (30 MHz IQ) | 10–12 % | 100+ Nutzer |

*Hinweis: Der CPU-Mehraufwand pro Nutzer ist minimal (< 1 % pro Nutzer), wenn die Hardwarebeschleunigung aktiviert ist.*

---

## 🎯 Verwendung

### Grundlegender Betrieb

1. **SDR konfigurieren**: Bearbeiten Sie die passende Konfigurationsdatei (z. B. `config-rtl.toml`)
2. **Standortinformationen aktualisieren**: Bearbeiten Sie `frontend/site_information.json`
3. **Server starten**: Führen Sie das passende Startskript aus:
   ```bash
   ./start-rtl.sh      # Für RTL-SDR
   ./start-rsp1a.sh    # Für SDRplay RSP1A
   ./start-airspyhf.sh # Für Airspy HF+
   ./start-fobos-hf.sh # Für RigExpert Fobos SDR, HF1/HF2 (0-25 MHz)
   ./start-fobos.sh    # Für RigExpert Fobos SDR, RF (25-6000 MHz)
   ./start-hackrf.sh   # Für HackRF One
   ./start-rx888mk2.sh # Für RX888 MK2
   ```
   RSP1A, Airspy HF+ und Fobos laufen über SoapySDR und `rx_sdr`; das Installationsskript richtet ihren Treiber ein, wenn Sie sie wählen (Optionen 3, 6 und 5), oder Sie starten auf einer installierten Station `./setup-rsp1a.sh`, `./setup-airspyhf.sh` oder `./setup-fobos.sh`. Siehe [INSTALLATION.md](INSTALLATION.md#empfänger-über-soapysdr-rsp1a-fobos-airspy-hf). Der HackRF One (Option 7) braucht nur das Paket `hackrf` der Distribution: `./setup-hackrf.sh`.
   Jedes Startskript ist **eigenständig**: Es beendet eine laufende Instanz, startet den Empfänger + `spectrumserver`, **löst sich in den Hintergrund** (übersteht das Schließen des Terminals) und betreibt einen **Watchdog**, der die Kette bei einem Absturz automatisch neu startet. Der Fortschritt wird in `logwebsdr.txt` protokolliert — beobachten Sie ihn mit `tail -f logwebsdr.txt`. Ein erneuter Aufruf eines Startskripts entspricht einem sauberen Neustart, und eine `flock`-Sperre stellt sicher, dass immer nur ein Empfänger läuft. Optional: `SPECTRUM_CORES=0-3`, um CPUs festzulegen, `RX_ARGS="…"`, um Empfängerargumente ohne Bearbeiten der Datei zu überschreiben (`RX888_ARGS` beim RX888), `RX_DRIVER=miri|sdrplay`, um den RSP1A-Treiber zu wählen.
4. **Oberfläche aufrufen**: Öffnen Sie im Browser `http://localhost:PORT` (Standardport je nach Konfiguration unterschiedlich)

### Server stoppen

Ein gemeinsames Stopp-Skript funktioniert für **jeden** Empfänger — es beendet zuerst den Watchdog (damit er nicht automatisch neu startet), dann den Empfänger und `spectrumserver`:

```bash
./stop-websdr.sh
```

---

## 🔧 Konfiguration

### Wesentliche Konfigurationsdateien

1. **`config-[Gerät].toml`** – Server- und SDR-Konfiguration
   - Servereinstellungen (Port, Threads, HTML-Wurzelverzeichnis)
   - Eingangseinstellungen (Abtastrate, FFT-Größe, Frequenz)
   - Optionen zur WebSDR-Registrierung
   - Einstellungen zur Audiokompression
   - Nach Änderungen den Server neu starten.

2. **`frontend/site_information.json`** – öffentliche Standortinformationen
   - Angaben zum Betreiber (Rufzeichen, E-Mail, Standort)
   - Informationen zu Hardware und Antenne
   - Region- und Bandbreiteneinstellungen
   - Chat aktivieren/deaktivieren
   - Führen Sie nach Änderungen recompile.sh in einem Terminal aus.

3. **`markers.json`** – Frequenzmarker und Bandplan

4. **`frontend/src/bands-config.js`** – Bandplan-Konfiguration Diese Datei liegt unter frontend/src/bands-config.js und definiert die Bänder, die der SysOp anlegt. <br />
- Sie sehen etwa Folgendes und können es nach Belieben bearbeiten:
   ```
   - const bands = 
   .....
   - { ITU: 1,
            name: '40m', min: -30, max: 110, initFreq: '7120000', publishBand: '1', startFreq: 7000000, endFreq: 7200000,  stepi: 1000, color: 'rgba(50, 168, 72, 0.6)', 
	    modes: [
              { mode: MODES.CW, startFreq: 7000000, endFreq: 7040000 },
              { mode: MODES.LSB, startFreq: 7040000, endFreq: 7200000 }]
	},
	{ ITU: 2,
            name: '40m', min: -30, max: 110, initFreq: '', publishBand: '1', startFreq: 7000000, endFreq: 7300000,  stepi: 1000, color: 'rgba(50, 168, 72, 0.6)', 
	    modes: [
              { mode: MODES.CW, startFreq: 7000000, endFreq: 7050000 },
              { mode: MODES.LSB, startFreq: 7050000, endFreq: 7300000 }]
	},
	{ ITU: 3,
            name: '40m', min: -30, max: 110, initFreq: '', publishBand: '1', startFreq: 7000000, endFreq: 7200000,  stepi: 1000, color: 'rgba(50, 168, 72, 0.6)',
            modes: [
              { mode: MODES.CW, startFreq: 7000000, endFreq: 7040000 },
              { mode: MODES.LSB, startFreq: 7040000, endFreq: 7200000 }]
   .....
   etc
   ```
   **Dabei gilt:** <br />
   - **ITU** ist die Region, in der sich der Server befindet,
   - **min und max** sind die Helligkeitsgrenzen des Wasserfalls für das jeweilige Band,
   - **initFreq** ist die Frequenz, auf die bei Auswahl des Bandes zunächst abgestimmt wird,
   - **publishBand** legt fest, ob das Band angezeigt wird: 1 für Amateurbänder, 2 für Rundfunkbänder,
   - **startFreq und endFreq** definieren die Bandgrenzen,
   - **stepi** ist die Standard-Mausradschrittweite für das Band, und **modes** ist die bevorzugte Standardbetriebsart für das Band.

- Führen Sie nach Änderungen **recompile.sh in einem Terminal** aus dem Ordner PhantomSDR-Plus aus.

Konfigurationsbeispiele finden Sie in den mitgelieferten Beispieldateien:
- `config-rtl.toml` – RTL-SDR-Konfiguration
- `config-rsp1a.toml` – SDRplay-RSP1A-Konfiguration
- `config-airspyhf.toml` – Airspy-HF+-Konfiguration
- `config-fobos-hf.toml` / `config-fobos.toml` – Konfiguration für RigExpert Fobos SDR (HF / RF)
- `config-hackrf.toml` – HackRF One
- `config-rx888mk2.toml` – RX888-MK2-Konfiguration

---

## 🌊 Wasserfall-Untergrenze — `waterfall.sh`

`waterfall.sh` (im Wurzelverzeichnis des Projekts) ändert den **voreingestellten minimalen Wasserfallpegel** in dB — also den Wert, bei dem der Wasserfall bei einem neuen Besuch beginnt.

Dieser Wert steht in zwei Quelldateien an fünf verschiedenen Stellen (`frontend/src/waterfall.js` → `this.minWaterfall` sowie `frontend/src/App.svelte` → das anfängliche `let min_waterfall`, die beiden „min“-Rücksetzfälle und der Lesezeichen-Standardwert). Von Hand ist das leicht falsch gemacht, deshalb erledigt es das Skript für Sie. Es verwendet niemals fest verdrahtete Zeilennummern — jede Stelle wird über ein Muster gefunden, sodass es auch nach Aktualisierungen der Quellen weiter funktioniert.

- Ein **höherer** Wert (z. B. `-15`) ergibt einen **dunkleren** Wasserfall.
- Ein **niedrigerer** Wert (z. B. `-45`) ergibt einen **helleren** Wasserfall.

```bash
./waterfall.sh              # interaktiv — zeigt die aktuellen Werte und fragt nach dem neuen
./waterfall.sh -v -15       # Wert ohne Rückfrage setzen
./waterfall.sh -v -15 -y    # ... und alle Bestätigungen überspringen
./waterfall.sh -s           # nur die aktuellen Werte anzeigen, nichts ändern
```

Vor dem Ändern legt es von beiden Dateien eine Sicherung mit Zeitstempel an (`*.bak-JJJJmmtt-HHMMSS`) und gibt den Befehl zum Zurückspielen aus. Angefasst werden nur Literale, die dem gerade verwendeten Wert entsprechen, sodass unbeteiligte Zahlen in diesen Dateien niemals versehentlich überschrieben werden können. Erscheint der neue Wert danach nicht, stellt das Skript die Sicherungen selbst wieder her und bricht mit einem Fehler ab. Es warnt außerdem, wenn die beiden Dateien nicht übereinstimmen, und setzt beide.

- Nach der Änderung muss das Frontend neu gebaut werden — das Skript bietet an, `recompile.sh` für Sie auszuführen (mit `-y` überspringt es den Neubau, führen Sie dann `./recompile.sh` selbst aus, wenn Sie so weit sind).

---

## 🎨 Anpassung

### Hintergrundbild ändern

Ersetzen Sie `frontend/src/assets/background.jpg` durch Ihr bevorzugtes Bild (behalten Sie denselben Dateinamen bei).

- Führen Sie nach der Änderung recompile.sh in einem Terminal aus.


### Auswahl des Audio-Codecs

Wählen Sie in Ihrer `.toml`-Konfiguration zwischen FLAC und Opus:
```toml
[input]
audio_compression="opus"  # or "flac"
```
- Starten Sie nach der Änderung den Server neu.


### S-Meter-Kalibrierung

Die beiden Instrumente laufen absichtlich über **getrennte Ketten** und werden daher mit zwei verschiedenen Stellgrößen abgeglichen.

#### Die zwei Stellgrößen

Beide stehen im Abschnitt `[input]` der Konfigurationsdatei, mit der der Server gestartet wird (`config.toml`, `config-rx888mk2.toml` usw.):

```toml
[input]
smeter_offset=5         # nur der digitale Balken
analog_smeter_offset=5  # nur der analoge Zeiger
```

Sie werden in `src/websocket.cpp` gelesen und im ersten `basic_info`-Frame an den Browser geschickt. **Ein Neustart des Servers genügt also** — ein Neubau des Frontends ist nicht nötig.

#### Analoge Kette

```
angezeigte dBm = -130 + (rawDb + analog_smeter_offset + 130) x 1,1
```

- Die visuelle Verstärkung von 1,1 wirkt *nach* dem Offset, mit Drehpunkt bei -130 dBm. Eine Einheit `analog_smeter_offset` verschiebt die Anzeige also um 1,1 dB. Für eine Verschiebung um X dB gilt `analog_smeter_offset ~= 0,91 x X`. Der TOML-Wert wird als Ganzzahl gelesen, es sind also nur ganze Schritte möglich.
- Die Zeigerkennlinie (`powerFromDbm` in `frontend/src/lib/SMeterAnalog.svelte`) legt **S9 auf -73 dBm** bei 60 von 100 Zeigereinheiten, mit einer `pow(...,0,6)`-Kurve von -130 bis -73 unterhalb S9 und einer `pow(...,0,8)`-Kurve von -73 bis -13 (S9+60) darüber.
- Das ist **keine** lineare Skala mit 6 dB pro S-Stufe. Der sinnvolle Bezugspunkt ist deshalb S9 — die Marken unterhalb S9 folgen einem Messsender nicht in 6-dB-Schritten.

#### Digitale Kette

```
value    = (rawDb / 150) x 100 + smeter_offset   -> begrenzt auf [-100, 0]
segments = round((value + 100) x 35 / 100) + DIGITAL_BAR_TRIM
```

- Man beachte das `/150 x 100`: die digitale Skala ist **auf 2/3 gestaucht** und sieht weder `analog_smeter_offset` noch die 1,1-fache visuelle Verstärkung. Deshalb stimmen Balken und Zeiger nie exakt überein — das ist so gewollt.
- 35 Segmente auf 100 Einheiten bedeuten: ein Segment sind 2,86 Offset-Einheiten, also etwa 4,3 dB roh. `smeter_offset=3` entspricht somit ungefähr einem Segment.
- `DIGITAL_BAR_TRIM` in `frontend/src/lib/SMeterDigital.svelte` (derzeit 0) verschiebt den Balken um ganze Segmente. Eine Änderung ist ein Eingriff in den Quelltext und **erfordert** einen Neubau des Frontends.

#### Die LED-Fenster werden in beiden Instrumenten analog gespeist

Die Fenster dBm / dBµV / SNR / NF lesen in **beiden** Instrumenten den analog kalibrierten Wert und addieren einen festen `VISUAL_DBM_OFFSET` von 5, fest verdrahtet in `SMeterAnalog.svelte` und `SMeterDigital.svelte`. Daraus folgt:

- `smeter_offset` ändert **keine** Zahl in den Fenstern, nur die Balkenlänge.
- dBµV = dBm + 107 (50 Ohm), und NF = dBm - SNR per Konstruktion, NF folgt also automatisch.
- Sollen die **Zahlen** stimmen, ohne die Zeigerstellung anzutasten, ist `VISUAL_DBM_OFFSET` die richtige Stellgröße — aber es ist eine Konstante im Quelltext, erfordert einen Neubau und muss in **beiden** Dateien gleich geändert werden.

#### Vorgehen

1. Einen bekannten Pegel in den Antenneneingang einspeisen (Messsender mit -73 dBm = S9), in SSB/CW mit stabiler Durchlassbreite. Die Anzeige hängt von Bandbreite und AGC ab, also zuerst Modus und Bandbreite festlegen.
2. Ablesen, was das analoge dBm-Fenster zeigt, dann `analog_smeter_offset ~= 0,91 x (-73 - Anzeige)` setzen. Server neu starten und erneut prüfen. Ein Durchgang sollte genügen; der Zeiger sollte auf S9 stehen.
3. Auf das digitale Instrument umschalten und `smeter_offset` so setzen, dass die Balkenlänge S9 dorthin legt, wo man es haben will — etwa 3 Einheiten pro Segment. Dieser Schritt ist reine Optik und beeinflusst die Zahlenwerte nicht.
4. Ohne Messsender ist ein ruhiges Band mit einer Bake bekannten Pegels ein brauchbarer Ersatz, oder man legt schlicht das Grundrauschen auf einen plausiblen Wert (z. B. -120 dBm auf 20 m mit ordentlicher Antenne) — wohl wissend, dass damit die gesamte Kette einschließlich Antennengewinn kalibriert wird, nicht nur der Empfänger.


### GUI-Varianten

Alle vier GUI-Varianten (analoges/digitales S-Meter x Layout v1/v2) stecken in einem einzigen Build. Besucher wechseln über das Menü ⚙️ oben rechts zwischen ihnen — nichts wird neu geladen, Audio, Wasserfall und laufende Decoder machen weiter — und die Wahl wird pro Browser gespeichert.
- Führen Sie recompile.sh in einem Terminal aus, um die *Startvariante* festzulegen, also das, was ein Erstbesucher sieht.
- **[EDITING_VARIANTS.md](EDITING_VARIANTS.md)** – wie man die Frontend-Varianten (S-Meter und Layout) bearbeitet und neu baut

---

## 📚 Dokumentation

- **[INSTALLATION.md](INSTALLATION.md)** – vollständige Installationsanleitung für Systembetreiber
- **[ADMIN_PANEL_SETUP.md](ADMIN_PANEL_SETUP.md)** – Installationsanleitung für administrierende Systembetreiber
- **[USER_GUIDE.md](USER_GUIDE.md)** – Anleitung für Endnutzer zur Bedienung des WebSDR
- **[THERMAL_GUARD.md](THERMAL_GUARD.md)** - Sysop-Handbuch für den CPU-Überhitzungsschutz: die vier Modi und was bei jedem zu tun ist
- **[CONNECTION_LIMITS.md](CONNECTION_LIMITS.md)** - Sysop-Handbuch für Verbindungslimits: einen öffentlichen Empfänger vor Verbindungsfluten schützen
- **[PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md)** – Verzeichnisstruktur und Codeorganisation
- **[EDITING_VARIANTS.md](EDITING_VARIANTS.md)** – wie man die Frontend-Varianten (S-Meter und Layout) bearbeitet und neu baut

---

## 🌐 Online-WebSDR-Liste

Registrieren Sie Ihren WebSDR im offiziellen Verzeichnis: https://sdr-list.xyz

Setzen Sie `register_online=true` in Ihrer `.toml`-Konfigurationsdatei, um sich automatisch zu registrieren.

---

## 🐛 Fehlerbehebung

### Häufige Probleme

**OpenCL funktioniert nicht**
- Stellen Sie sicher, dass die Treiber korrekt installiert sind
- Prüfen Sie es mit dem Befehl `clinfo`
- Siehe INSTALLATION.md für die ausführliche OpenCL-Einrichtung

**Probleme mit der Audiolatenz**
- Wechseln Sie testweise zwischen den Codecs FLAC und Opus
- Passen Sie die Puffereinstellungen in der Konfiguration an
- Sorgen Sie für ausreichende CPU-/GPU-Ressourcen

**Build-Fehler**
- Prüfen Sie, ob alle Abhängigkeiten installiert sind
- Versuchen Sie, das Build-Verzeichnis zu bereinigen: `rm -rf build && meson setup build`
- Prüfen Sie auf widersprüchliche Bibliotheksversionen

---

## 🤝 Mitwirken

Beiträge sind willkommen! Dies ist ein unabhängiger Fork mit zusätzlichen Funktionen. Bitte:

1. Forken Sie das Repository
2. Erstellen Sie einen Feature-Branch
3. Committen Sie Ihre Änderungen
4. Pushen Sie den Branch
5. Erstellen Sie einen Pull Request

---

## 📄 Lizenz

Dieses Projekt steht unter der GNU General Public License v3.0 – Einzelheiten finden Sie in der Datei [LICENSE](../../LICENSE).

---

## 👥 Autoren und Danksagungen

- **SV1BTL und SV2AMK** – Entwicklung und Erweiterungen von PhantomSDR-Plus
- Basierend auf dem ursprünglichen PhantomSDR-Projekt

---

## 🔗 Links

- **Live-Demo**: http://phantomsdr.no-ip.org:8900/
- **WebSDR-Verzeichnis**: https://sdr-list.xyz
- **GitHub-Repository**: https://github.com/sv1btl/PhantomSDR-Plus

---

## 📞 Unterstützung

- **Probleme**: Melden Sie Fehler über [GitHub Issues](https://github.com/sv1btl/PhantomSDR-Plus/issues)
- **E-Mail**: Kontakt sv1btl@otenet.gr

---

## ⚡ Leistungstipps

1. **Aktivieren Sie OpenCL/CUDA** für GPU-Beschleunigung – reduziert die CPU-Last drastisch
2. **Verwenden Sie SSD-Speicher** für bessere E/A-Leistung
3. **Weisen Sie ausreichend RAM zu** – mindestens 8 GB empfohlen
4. **Optimieren Sie die FFT-Größe** – größere FFT = bessere Auflösung, aber mehr CPU-Last
5. **Erwägen Sie eine dedizierte GPU** – AMD oder NVIDIA mit OpenCL-Unterstützung

---

**73 de SV1BTL & SV2AMK**

*Ausführliche Einrichtungsanweisungen finden Sie in INSTALLATION.md* *Die Bedienungsanleitung für Endnutzer finden Sie in USER_GUIDE.md*
