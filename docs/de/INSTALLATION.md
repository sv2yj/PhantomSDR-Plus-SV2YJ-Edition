# PhantomSDR-Plus Installationsanleitung für Systembetreiber

Diese ausführliche Anleitung führt Sie durch Installation und Konfiguration von PhantomSDR-Plus auf Ihrem Server.

---

## Inhaltsverzeichnis

1. [Systemanforderungen](#systemanforderungen)
2. [Vorbereitung vor der Installation](#vorbereitung-vor-der-installation)
3. [PhantomSDR-Plus installieren](#phantomsdr-plus-installieren) — das Skript und [was es erledigt](#was-das-installationsskript-erledigt)
4. [Autorun-Spot-Reporter (FT8/FT4/WSPR)](#autorun-spot-reporter-ft8ft4wspr)
5. [Emulation von KiwiSDR-Clients (optional)](#emulation-von-kiwisdr-clients-optional)
6. [Konfiguration](#konfiguration)
7. [Gerätespezifische SDR-Einrichtung](#gerätespezifische-sdr-einrichtung)
8. [Test und Überprüfung](#test-und-überprüfung)
9. [Automatischen Start einrichten](#automatischen-start-einrichten)
10. [CPU-Überhitzungsschutz](#cpu-überhitzungsschutz)
11. [Fehlerbehebung](#fehlerbehebung)

**Nur als Nachschlagewerk — das Installationsskript erledigt all dies bereits für Sie.** Lesen Sie diese Abschnitte, wenn Sie eine Distribution verwenden, die keines der Skripte abdeckt, oder wenn Sie einen einzelnen Schritt von Hand reparieren müssen:

- [Abhängigkeiten installieren](#abhängigkeiten-installieren)
- [Node.js und npm installieren](#nodejs-und-npm-installieren)
- [OpenCL installieren](#opencl-installieren-optional-aber-empfohlen)
- [Von Hand bauen](#von-hand-bauen-referenz)
- [Opus-Audiocodec installieren](#opus-audiocodec-installieren)
---

## Systemanforderungen

### Unterstützte Betriebssysteme

**Primär (empfohlen):**
- Ubuntu 22.04 LTS (Jammy), 24.04 LTS (Noble) und 26.04 LTS (Resolute) — 24.04 empfohlen
- Debian 12 (Bookworm) und Debian 13 (Trixie)

**Alternative:**
- Fedora (aktuelle stabile Version)
- Arch Linux (Rolling Release)
- openSUSE Tumbleweed (nicht Leap — siehe Hinweis weiter unten)

### Hardwareanforderungen

**Mindestkonfiguration:**
- CPU: Zweikernprozessor (2 GHz oder mehr)
- RAM: 4 GB
- Speicher: 10 GB freier Platz
- Netzwerk: 100-Mbit/s-Verbindung

**Empfohlene Konfiguration:**
- CPU: Vierkerner oder besser (Ryzen 5 2600, Intel i5-6500T oder besser)
- RAM: 8 GB oder mehr
- Speicher: SSD ab 20 GB
- GPU: AMD/NVIDIA mit OpenCL-Unterstützung (sehr empfehlenswert)
- Netzwerk: 1-Gbit/s-Verbindung

**Hochleistungskonfiguration:**
- CPU: 6 Kerne oder mehr (Ryzen 7, Intel i7 oder besser)
- RAM: 16 GB oder mehr
- Speicher: NVMe-SSD
- GPU: dedizierte GPU mit OpenCL-/CUDA-Unterstützung
- Netzwerk: 1 Gbit/s oder besser

---

## Vorbereitung vor der Installation

### 1. System aktualisieren

```bash
# Ubuntu/Debian
sudo apt update
sudo apt upgrade -y
sudo reboot

# Fedora
sudo dnf update -y
sudo reboot
```

### 2. Ubuntu-Version prüfen

```bash
lsb_release -a
```

**Die erwartete Ausgabe sollte zeigen:** Ubuntu 24.04 LTS

### 3. Verfügbaren Speicherplatz prüfen

```bash
df -h
```

Stellen Sie sicher, dass in Ihrem Heimatverzeichnis mindestens 10 GB frei sind.

### 4. CPU-Informationen prüfen

```bash
lscpu
```

Notieren Sie die Anzahl der Kerne/Threads zur Optimierung der Konfiguration.

---

## Abhängigkeiten installieren

> [!IMPORTANT]
> **Für eine normale Installation brauchen Sie diesen Abschnitt nicht.** `./install.sh` — bzw. das Installationsskript Ihrer Distribution — erledigt all das für Sie; siehe [Was das Installationsskript erledigt](#was-das-installationsskript-erledigt). Das Folgende ist eine Referenz für eine manuelle Einrichtung, für eine Distribution, die keines der Skripte abdeckt, oder um einen einzelnen Schritt von Hand zu reparieren.


### Ubuntu 24.04 LTS

```bash
sudo apt install -y \
  build-essential \
  cmake \
  pkg-config \
  meson \
  libfftw3-dev \
  libwebsocketpp-dev \
  libflac++-dev \
  zlib1g-dev \
  libzstd-dev \
  libboost-all-dev \
  libopus-dev \
  libliquid-dev \
  git \
  psmisc \
  wget \
  curl
```

### Fedora

```bash
sudo dnf install -y \
  g++ \
  meson \
  cmake \
  fftw3-devel \
  websocketpp-devel \
  flac-devel \
  zlib-devel \
  boost-devel \
  libzstd-devel \
  opus-devel \
  liquid-dsp-devel \
  git \
  psmisc \
  wget \
  curl
```

### Installation überprüfen

```bash
# Check if key dependencies are installed
pkg-config --modversion fftw3
cmake --version
meson --version
```

---

## Node.js und npm installieren

> [!IMPORTANT]
> **Für eine normale Installation brauchen Sie diesen Abschnitt nicht.** `./install.sh` — bzw. das Installationsskript Ihrer Distribution — erledigt all das für Sie; siehe [Was das Installationsskript erledigt](#was-das-installationsskript-erledigt). Das Folgende ist eine Referenz für eine manuelle Einrichtung, für eine Distribution, die keines der Skripte abdeckt, oder um einen einzelnen Schritt von Hand zu reparieren.


PhantomSDR-Plus benötigt Node.js, um das Frontend zu bauen. Wir verwenden dafür NVM (Node Version Manager).

### 1. NVM installieren

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.4/install.sh | bash
```

### 2. NVM laden

**WICHTIG:** Schließen Sie Ihr Terminal und öffnen Sie es erneut, oder führen Sie aus:

```bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
```

### 3. NVM-Installation überprüfen

```bash
nvm --version
```

Erwartete Ausgabe: `0.40.4` oder ähnlich

### 4. Node.js installieren

```bash
# Install Node.js 22 - the version every install script requires
nvm install 22

# Make it the default, so systemd units and cron see it too
nvm alias default 22

# Verify installation
node --version
npm --version
```

### 5. Optional: weitere Node-Versionen installieren

```bash
# Install latest version
nvm install node

# Install specific version (if needed)
nvm install 22.22.3

# List installed versions
nvm list

# Use specific version
nvm use 22
```

---

## OpenCL installieren (optional, aber empfohlen)

> [!IMPORTANT]
> **Für eine normale Installation brauchen Sie diesen Abschnitt nicht.** `./install.sh` — bzw. das Installationsskript Ihrer Distribution — erledigt all das für Sie; siehe [Was das Installationsskript erledigt](#was-das-installationsskript-erledigt). Das Folgende ist eine Referenz für eine manuelle Einrichtung, für eine Distribution, die keines der Skripte abdeckt, oder um einen einzelnen Schritt von Hand zu reparieren.


OpenCL verbessert die Leistung erheblich, indem es FFT-Berechnungen auf die GPU auslagert. Dieser Abschnitt behandelt integrierte Intel-Grafik. Für AMD-/NVIDIA-GPUs beachten Sie die Dokumentation des Herstellers.

### Intel-CPU mit integrierter Grafik

#### 1. OpenCL-Basiskomponenten installieren

```bash
sudo apt install -y \
  build-essential \
  cmake \
  pkg-config \
  meson \
  libfftw3-dev \
  libwebsocketpp-dev \
  libflac++-dev \
  zlib1g-dev \
  libzstd-dev \
  libboost-all-dev \
  libopus-dev \
  libliquid-dev \
  libclfft-dev \
  ocl-icd-opencl-dev \
  clinfo
```

#### 2. Intel Compute Runtime herunterladen

```bash
mkdir -p ~/neo
cd ~/neo

wget https://github.com/intel/compute-runtime/releases/download/19.07.12410/intel-gmmlib_18.4.1_amd64.deb
wget https://github.com/intel/compute-runtime/releases/download/19.07.12410/intel-igc-core_18.50.1270_amd64.deb
wget https://github.com/intel/compute-runtime/releases/download/19.07.12410/intel-igc-opencl_18.50.1270_amd64.deb
wget https://github.com/intel/compute-runtime/releases/download/19.07.12410/intel-opencl_19.07.12410_amd64.deb
wget https://github.com/intel/compute-runtime/releases/download/19.07.12410/intel-ocloc_19.07.12410_amd64.deb
```

#### 3. Intel-OpenCL-Runtime installieren

```bash
sudo dpkg -i *.deb
```

Falls Abhängigkeitsfehler auftreten:

```bash
sudo apt --fix-broken install
```

#### 4. OpenCL-ICD-Loader installieren

```bash
sudo apt update
sudo apt install intel-opencl-icd
```

Falls Fehler auftreten:

```bash
sudo apt --fix-broken install
sudo apt install intel-opencl-icd
```

#### 5. OpenCL-Installation überprüfen

```bash
sudo clinfo
```

Sie sollten Informationen zu Ihrer OpenCL-Plattform und den Geräten sehen. Achten Sie auf:
- Anzahl der Plattformen: 1 (oder mehr)
- Plattformname: Intel(R) OpenCL (oder ähnlich)
- Gerätetyp: GPU oder CPU

#### 6. Neu starten

```bash
sudo reboot
```

### OpenCL auf AMD-GPU

Installieren Sie für AMD-GPUs ROCm:

```bash
# Add ROCm repository
wget -q -O - https://repo.radeon.com/rocm/rocm.gpg.key | sudo apt-key add -
echo 'deb [arch=amd64] https://repo.radeon.com/rocm/apt/debian/ ubuntu main' | sudo tee /etc/apt/sources.list.d/rocm.list

# Install ROCm
sudo apt update
sudo apt install rocm-opencl rocm-clinfo

# Add user to video group
sudo usermod -a -G video $USER

# Reboot
sudo reboot

# Verify
clinfo
```

### OpenCL auf NVIDIA-GPU

Installieren Sie für NVIDIA-GPUs CUDA:

```bash
# Install NVIDIA drivers
sudo apt install nvidia-driver-525

# Install CUDA toolkit
wget https://developer.download.nvidia.com/compute/cuda/repos/ubuntu2204/x86_64/cuda-keyring_1.0-1_all.deb
sudo dpkg -i cuda-keyring_1.0-1_all.deb
sudo apt update
sudo apt install cuda

# Reboot
sudo reboot

# Verify
nvidia-smi
clinfo
```

---

## PhantomSDR-Plus installieren

### Repository klonen, Skripte ausführbar machen, Installation starten

```bash
cd ~
git clone --recursive https://github.com/sv1btl/PhantomSDR-Plus
cd PhantomSDR-Plus
chmod +x *.sh
./install.sh
```

**⚠️ WICHTIG:** Starten Sie nach dem Ende der Installation **Ihr Terminal neu** — das frisch installierte Node.js und Rust liegen erst danach in Ihrem `PATH`.

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

Nehmen Sie das Skript, das zu Ihrem System passt. Alle leisten dieselbe Arbeit und stellen dieselben Fragen; nur der Paketmanager unterscheidet sich:

| System | Skript |
|---|---|
| Ubuntu 22.04 / 24.04 / 26.04, Debian 12 / 13 | `./install.sh` |
| Fedora | `./install_fedora.sh` |
| Arch | `./install_arch.sh` |
| openSUSE Tumbleweed | `./install_opensuse.sh` |

> **Ein Installationsskript für jede Debian- und Ubuntu-Version.** `install.sh` liest `/etc/os-release` und die installierte Boost-Version und passt sich selbst an; die früheren `install_ubuntu22.sh`, `install-Deb12.sh` und `install_ubuntu26.sh` sind entfallen. Es setzt `DEBIAN_FRONTEND=noninteractive`, damit das mit `python3-matplotlib` hereinkommende `tzdata` den Lauf nicht anhalten kann, um nach Ihrer Zeitzone zu fragen — und dann die Antwort verschluckt, die für die nächste Frage gedacht war. Unter Jammy ruft es direkt `install_rade_ubuntu22.sh` auf, denn Jammys `python3-websockets` ist 10.1, RADE braucht aber 11.0 oder neuer. Es weiß, wo `intel-opencl-icd` in jeder Version liegt: in den Repositories bei 22.04 und 26.04, in `non-free` bei Debian 12 und in Intels eigenem Grafik-Repository bei 24.04 und Debian 13. Und wo Boost 1.87 oder neuer ist, ist der websocketpp-Header-Patch nicht mehr optional — das Skript prüft, dass er angekommen ist, und baut sonst gar nicht erst. Ein neuerer Compiler wird nie gebraucht: Der Standard-GCC akzeptiert `-std=c++23` auf allen fünf Versionen, installieren Sie dafür also kein `gcc-12`.

Die Installation läuft in 17 klar nummerierten Schritten ab, und jede Stelle, an der auf Sie gewartet wird, ist von einem **⌨️  IHRE EINGABE WIRD BENÖTIGT**-Rahmen eingefasst, damit eine Frage nicht im durchlaufenden Text untergeht. Die sieben Fragen werden vorab aufgelistet, bevor irgendetwas installiert wird. `PHANTOM_NONINTERACTIVE=1` beantwortet alle mit ihren Vorgaben; die `PHANTOM_*`-Variablen stehen im Kopf von `install.sh`.

**Jeder Lauf schreibt `install.txt`.** Wenn das Installationsskript fertig ist — oder auf halbem Weg abbricht — schreibt es einen Bericht nach `install.txt` im PhantomSDR-Plus-Verzeichnis: das Ergebnis, jeden der 17 Schritte als OK / SKIPPED / PARTIAL / FAILED, was erkannt wurde (Distribution, Boost, Compiler, Node.js), welche Komponenten installiert wurden, und jede aufgetretene Warnung. Ein fehlgeschlagener Lauf hinterlässt einen Bericht, der beim gescheiterten Schritt endet, mit dem Grund und dem Hinweis, dass das Skript gefahrlos erneut laufen darf. Es ist die erste Datei, die man liest, wenn etwas nicht funktioniert hat, und die erste, die man an einen Fehlerbericht hängt. Jeder Lauf überschreibt sie — heben Sie eine Kopie auf, wenn Sie zwei Installationen vergleichen wollen.

> **Ubuntu 26.04, Arch und openSUSE Tumbleweed lassen sich übersetzen, sind aber noch nicht im Funkbetrieb erprobt.** Alle drei bringen ein Boost neuer als 1.87, das die `io_service`-API entfernt hat, für die das mitgelieferte websocketpp 0.8.2 geschrieben wurde. Die gepatchten Header, die das Installationsskript hineinkopiert, überbrücken das (`io_context`, `executor_work_guard`, `boost::asio::post`, der moderne Resolver), und wo Boost 1.87 oder neuer ist, behandelt das Skript den Patch als zwingend statt optional — es prüft, dass die Kopien angekommen sind, und baut sonst nicht. Eine vollständige Installation samt Empfängertreiber und allen optionalen Komponenten wurde in Containern auf Boost 1.90 (Ubuntu 26.04), 1.91 (openSUSE Tumbleweed) und 1.92 (Arch) durchgängig verifiziert. Das belegt, dass der Server kompiliert und startet — nicht, dass er stundenlang einen Empfänger bedient. Behandeln Sie alle drei als im Produktivbetrieb ungetestet, bis jemand berichtet.

> **openSUSE heißt hier Tumbleweed.** Dort ist `install_opensuse.sh` geprüft. Leap 15.6 funktioniert nicht: In seinen Repositories gibt es überhaupt kein `liquid-dsp-devel`, das das Backend braucht, und Boost liegt nur unter versionierten Paketnamen vor. Leap zu unterstützen hieße, fremde OBS-Repositories einzubinden — das bleibt vorerst außen vor.

### Was das Installationsskript erledigt

Nichts muss vorher von Hand vorbereitet werden — keine Paketliste zum Kopieren, kein Node.js zum Nachladen, keine OpenCL-Pakete zum Suchen. Er läuft in 19 nummerierten Schritten und hält für bis zu zehn Fragen an, jede in einem „IHRE EINGABE WIRD BENÖTIGT"-Rahmen — bleiben Sie also entweder an der Tastatur, oder setzen Sie `PHANTOM_NONINTERACTIVE=1` und lassen Sie alles mit den Vorgaben beantworten (siehe unten). Lassen Sie ihn also nicht unbeaufsichtigt, und rechnen Sie je nach Maschine und Anzahl der Extras mit etwa zwanzig Minuten bis deutlich über einer Stunde.

| # | Schritt | Was Sie gefragt werden |
|---|---|---|
| 1 | Listet die gerade laufenden PhantomSDR-Plus-Dienste auf — Admin-Panel, Reverse-Proxy, Statistikserver, Empfänger — und bietet an, sie zu stoppen, bevor irgendetwas angefasst wird. Nur ein laufendes Startskript gilt als Empfänger; eines, das nur in einem Editor geöffnet ist, bleibt unberührt. | bestätigen, **Vorgabe ja** |
| 2–6 | Erkennt die Distribution und installiert alle Build-Abhängigkeiten (Compiler, meson/ninja, FFTW, Boost, FLAC, Opus, liquid-dsp, zlib/zstd, libcurl …) und dabei Node.js 22 über nvm, falls das System keines oder ein zu altes hat | nichts |
| 7 | Baut das Backend mit meson | nichts |
| 8 | Baut den Treiber für Ihren Empfänger — RX888 MkII / RX888, RTL-SDR (Blog V4 wird getrennt gefragt), SDRplay RSP1A, RigExpert Fobos SDR, Airspy HF+, HackRF One oder keinen. Beim RX888 werden **auch die udev-Regeln installiert**, damit der Server nie `sudo` für das Gerät braucht. RSP1A, Fobos und Airspy HF+ laufen über SoapySDR: ihre Wahl startet `setup-rsp1a.sh`, `setup-fobos.sh` oder `setup-airspyhf.sh`, die den Treiber und `rx_sdr` bauen und ebenfalls eine udev-Regel installieren (siehe [Empfänger über SoapySDR (RSP1A, Fobos, Airspy HF+)](#empfänger-über-soapysdr-rsp1a-fobos-airspy-hf)) Der HackRF One braucht kein SoapySDR: seine Wahl startet `setup-hackrf.sh`, das das Paket `hackrf` der Distribution und eine udev-Regel installiert. | welchen SDR Sie haben |
| 9 | Öffnet `frontend/site_information.json` in Ihrem Editor | Rufzeichen, Locator, Hardware, Antenne — **nicht überspringen** |
| 10–11 | Installiert die Frontend-Abhängigkeiten und baut die Desktop- und `/mobile`-Seiten | nichts |
| 12 | Installiert OpenCL und wählt den Anbieter anhand der gefundenen Hardware (Intel-, AMD- oder NVIDIA-GPU bzw. die x86-CPU-Laufzeit). Gibt es kein OpenCL-fähiges Gerät, sagt es das und fährt fort | bestätigen, Vorgabe ja |
| 13–15 | Installiert das **Admin-Panel**, den **FreeDV-RADE-V1-Decoder** und den **Statistikserver** — alle drei standardmäßig | jeweils bestätigen, Vorgabe ja; jedes stellt eigene Fragen |
| 16 | Kopiert die fünf gepatchten websocketpp-Header erneut über das Meson-Subprojekt und prüft, dass sie angekommen sind. Drei davon sind die Boost-≥-1.87-Kompatibilitätsarbeit, ohne die das Backend unter Boost 1.90 nicht kompiliert; die anderen beiden sind projekteigene Änderungen, eine davon die Korrektur, die die Registrierung bei websdr.org braucht | nichts |
| 17 | Installiert die **Emulation von KiwiSDR-Clients** durch Ausführen von `kiwi_install.sh`, damit sich Kiwi-Clients wie AetherSDR mit diesem Empfänger verbinden können. Patcht die Quellen und ergänzt `[kiwi_emulation]` in den Konfigurationsdateien im Wurzelverzeichnis — siehe [Emulation von KiwiSDR-Clients](Aether_config.md) | bestätigen, Vorgabe ja |
| 18 | Führt `recompile.sh` aus, damit alles aus den gepatchten Quellen gebaut wird | `[3] Both backend and frontend` → Startvariante → `[1] build-all.sh` |
| 19 | Gibt die Zusammenfassung aus: jeder Schritt mit seinem Ergebnis und jede Komponente mit dem, was installiert wurde | nichts |

#### Unbeaufsichtigt installieren

Jede Frage hat eine Umgebungsvariable, die sie überschreibt, und das Installationsskript wechselt von selbst auf die Vorgaben, wenn stdin kein Terminal ist (eine Pipe, ein Container, ein CI-Job). Das gilt in allen vier gleichermaßen: `install.sh`, `install_arch.sh`, `install_fedora.sh` und `install_opensuse.sh`. Mit `PHANTOM_NONINTERACTIVE=1` läuft alles durch, ohne zu fragen:

| Variable | Wirkung |
|---|---|
| `PHANTOM_NONINTERACTIVE=1` | answer every question with its default |
| `PHANTOM_SDR=1…7` | RX888 · RTL-SDR · SDRplay RSP1A · skip · Fobos · Airspy HF+ · HackRF (default 4) |
| `PHANTOM_RTLSDR_V4=y\|n` | RTL-SDR Blog V4 driver (default n) |
| `PHANTOM_SITE_EDIT=y\|n` | open `site_information.json` in an editor |
| `PHANTOM_OPENCL=y\|n` | install OpenCL (default y) |
| `PHANTOM_OPENCL_PROVIDER=1\|2\|3` | Intel · Mesa/Rusticl · POCL (default: from the detected hardware) |
| `PHANTOM_ADMIN=y\|n` | admin panel (y interactive, n unattended) |
| `PHANTOM_RADE=y\|n` | RADE / FreeDV (y interactive, n unattended) |
| `PHANTOM_STATS=y\|n` | statistics server (y interactive, n unattended) |
| `PHANTOM_KIWI=y\|n` | KiwiSDR client emulation (default y) |
| `PHANTOM_RECOMPILE=y\|n` | final rebuild (default y) |
| `PHANTOM_CURLPP=y\|n` | ohne curlpp fortfahren — nur Arch und openSUSE (Vorgabe y) |
| `PHANTOM_FIX_CLOCK_SKEW=y\|n` | Zeitstempel der Quelldateien zurücksetzen, die in der Zukunft liegen, damit meson bauen kann (Vorgabe y) |

Die drei mit *n unbeaufsichtigt* markierten Unterinstallationsskripte sind selbst interaktiv, ein unbeaufsichtigter Lauf überspringt sie deshalb, statt an ihren Fragen hängenzubleiben. Nennen Sie sie ausdrücklich, um sie einzuschließen:

```bash
# a complete unattended install for an RX888 MkII
PHANTOM_NONINTERACTIVE=1 PHANTOM_SDR=1 ./install.sh

# ... and with the admin panel, RADE and the statistics server too
PHANTOM_NONINTERACTIVE=1 PHANTOM_SDR=1 \
  PHANTOM_ADMIN=y PHANTOM_RADE=y PHANTOM_STATS=y ./install.sh
```

Nach einem Neustart sind die RX888-udev-Regeln und ein eventueller OpenCL-Treiber vollständig wirksam; das Skript sagt Ihnen, wann ein Neustart oder eine neue Anmeldung nötig ist.

Beim Einrichten des Admin-Panels bietet der Installer auch die beiden systemd-Units an und **empfiehlt dringend**, sie anzunehmen: Der CPU-Überhitzungsschutz läuft im Panel, ohne sie lässt ein Neustart oder ein Absturz die Maschine ungeschützt. Das Angebot entfällt automatisch dort, wo systemd nicht läuft (Container, WSL1, OpenRC) — siehe [Admin-Panel-Handbuch](ADMIN_PANEL_SETUP.md).

Jedes Extra ist ein normales Skript, das Sie jederzeit auch einzeln starten können — `./setup_admin.sh` ([Handbuch](ADMIN_PANEL_SETUP.md)), `./install_rade.sh` ([Handbuch](RADE_README.md)), `./install-stats-server.sh` ([Handbuch](sdr-stats/README.md)), `./setup-rx888-udev.sh` und die Empfänger-Skripte `./setup-rsp1a.sh`, `./setup-fobos.sh`, `./setup-airspyhf.sh` und `./setup-hackrf.sh` — genau diese ruft das Installationsskript auf.

### Von Hand bauen (Referenz)

> [!IMPORTANT]
> **Für eine normale Installation brauchen Sie diesen Abschnitt nicht.** `./install.sh` — bzw. das Installationsskript Ihrer Distribution — erledigt all das für Sie; siehe [Was das Installationsskript erledigt](#was-das-installationsskript-erledigt). Das Folgende ist eine Referenz für eine manuelle Einrichtung, für eine Distribution, die keines der Skripte abdeckt, oder um einen einzelnen Schritt von Hand zu reparieren.

Falls Sie einmal ohne das Installationsskript bauen müssen — eine Distribution, die keines der Skripte abdeckt, oder eine halb fertige Installation reparieren:

#### Backend bauen

```bash
# Clean any previous builds, Configure build with optimization, Compile
rm -rf build
meson setup build --buildtype=release --optimization=3
meson compile -C build

# Verify binary was created
ls -lh build/spectrumserver
```

#### Frontend bauen

```bash
cd frontend

# Install dependencies, Fix any vulnerabilities, Build the frontend
npm install
npm audit fix
npm run build

# Return to project root
cd ..
```

### Installation überprüfen

```bash
# Check if binary exists
ls -lh build/spectrumserver

# Check if frontend was built
ls -lh frontend/dist/

# List important files
ls -lh *.sh *.toml
```

---

## Opus-Audiocodec installieren

> [!IMPORTANT]
> **Für eine normale Installation brauchen Sie diesen Abschnitt nicht.** `./install.sh` — bzw. das Installationsskript Ihrer Distribution — erledigt all das für Sie; siehe [Was das Installationsskript erledigt](#was-das-installationsskript-erledigt). Das Folgende ist eine Referenz für eine manuelle Einrichtung, für eine Distribution, die keines der Skripte abdeckt, oder um einen einzelnen Schritt von Hand zu reparieren.


Opus bietet gegenüber FLAC bessere Tonqualität und geringere Latenz.

### 1. Systembibliothek libopus installieren

```bash
sudo apt-get update
sudo apt-get install -y libopus0 libopus-dev
```

### 2. Opus-Decoder für das Frontend installieren

```bash
cd PhantomSDR-Plus/frontend

# Install npm dependencies if not already done, Install Opus WASM decoder, Fix any vulnerabilities, Rebuild frontend
npm install
npm install @wasm-audio-decoders/opus-ml
npm audit fix
npm run build

# Return to project root
cd ..
```

### 3. Opus-Installation überprüfen

```bash
# Check if Opus system library is installed
pkg-config --modversion opus

# Check if Opus npm package is installed
cd frontend
npm list @wasm-audio-decoders/opus-ml
cd ..
```

---

## Autorun-Spot-Reporter (FT8/FT4/WSPR)

PhantomSDR-Plus bringt einen optionalen **Autorun-Spot-Reporter** mit (im Verzeichnis `autorun/`). Er dekodiert FT8/FT4/WSPR serverseitig direkt vom Empfänger und lädt die Spots zu den Reporting-Netzwerken hoch:

- **FT8 / FT4 → PSK Reporter** (IPFIX/UDP)
- **WSPR → wsprnet.org** (HTTP)

Er wird vollständig über den Reiter **Admin-Panel → „Spot Reporting"** gesteuert, und **das Reporting ist standardmäßig AUS** — es wird nichts gesendet oder hochgeladen, bis Sie es dort aktivieren. Der Decoder läuft als eigener Node.js-Daemon und greift den Ton des Empfängers lokal ab, benötigt also keine zusätzliche HF-Hardware.

### Voraussetzungen

| Voraussetzung | Anmerkungen |
|---------------|-------------|
| **Node.js 22+** | Dieselbe Laufzeitumgebung, die der Frontend-Build ohnehin braucht — im [Node.js-Schritt](#nodejs-und-npm-installieren) installiert. |
| **npm-Pakete `ws` + `cbor-x`** | Werden über `autorun/node_modules` aufgelöst, einen Symlink auf das `node_modules` des Frontends (beide Pakete sind in `frontend/package.json` deklariert). |
| **`util-linux`** (`taskset`) | Die Schaltfläche „Start" im Admin-Bereich bindet den Daemon per `taskset` an die E-Cores. Praktisch auf jeder Distribution vorhanden; die Installer fügen es ausdrücklich hinzu. |
| **Rufzeichen + Locator** | Werden aus `frontend/site_information.json` gelesen (`siteSysop` / `siteGridSquare`), sofern nicht im Admin-Reiter überschrieben. Spots werden unter diesem Rufzeichen hochgeladen. |

> ⚠️ **Melden Sie nur, was Sie tatsächlich empfangen.** Spots werden unter Ihrem Rufzeichen in öffentliche Netze hochgeladen — aktivieren Sie nur Bänder/Betriebsarten, die Ihr Empfänger wirklich hört, und verwenden Sie Ihren korrekten Locator.

### Automatische Installation

`install.sh` (und die distributionsspezifischen Varianten `install_arch.sh`, `install_fedora.sh`, `install_opensuse.sh`) erledigen alles für Sie: Sie installieren Node.js 22 und `util-linux`, führen das `npm install` des Frontends aus und legen anschließend den Symlink `autorun/node_modules` automatisch an. Weitere Schritte sind nicht nötig — die Funktion ist einsatzbereit, sobald `install.sh` fertig ist.

### Manuelle Installation

> [!NOTE]
> Das Installationsskript erledigt dies bereits für Sie: Es legt den Symlink an und installiert `util-linux`. Nutzen Sie die folgenden Schritte nur, um eine Installation von Hand zu reparieren.

Wenn Sie manuell installiert haben (Option B), legen Sie den Symlink nach dem `npm install` des Frontends selbst an, damit der Daemon seine Abhängigkeiten auflösen kann:

```bash
cd ~/PhantomSDR-Plus

# 1. Frontend deps must be installed first (ws + cbor-x live there)
cd frontend && npm install && cd ..

# 2. Link the autorun daemon to the frontend's node_modules
ln -sfn ../frontend/node_modules autorun/node_modules

# 3. Ensure taskset is available (Debian/Ubuntu shown; use your package manager)
sudo apt install -y util-linux
```

> **Hinweis:** `autorun/node_modules` wird von git ignoriert, ein frisches `git clone` enthält es also nie — der Symlink muss nach jedem sauberen Checkout (neu) angelegt werden. Die Installer erledigen das für Sie; der obige Befehl gilt nur für manuelle Einrichtungen.

### Überprüfen

```bash
# The symlink should point at ../frontend/node_modules
ls -l autorun/node_modules

# ws + cbor-x must resolve
ls -d frontend/node_modules/ws frontend/node_modules/cbor-x

# taskset must be on PATH
command -v taskset
```

Öffnen Sie danach das Admin-Panel, wechseln Sie auf den Reiter **Spot Reporting**, tragen Sie Ihre Identität ein, kreuzen Sie die zu dekodierenden Bänder/Betriebsarten an, aktivieren Sie die Ziele und drücken Sie **Start**. Ein Abzeichen „📶 REPORTING" erscheint im Hauptwasserfall, solange das Reporting aktiv ist. (PSK Reporter lädt gebündelt alle 5 Minuten hoch und wsprnet alle 2 Minuten, ein frisch gestarteter Daemon zeigt daher in den ersten Minuten „0 sent" — das ist normal.)

Danach werden zwei verschiedene Zähler angezeigt, die leicht zu verwechseln sind. Die Kacheln **SPOTS UPLOADED PER DECODER** zählen nur den aktuellen Lauf, Stop/Start setzt sie also auf null zurück; die Zahl neben dem Kontrollkästchen jedes Bands bzw. jeder Betriebsart ist der **Gesamtwert seit Beginn**, gespeichert in `autorun-totals.json` und damit über Neustarts hinweg erhalten. Beides beschreibt das [Admin-Panel-Handbuch](ADMIN_PANEL_SETUP.md), ebenso die Seite **Graphen**, die CPU-Takt, CPU-Last, Temperatur und Nutzer online über 15 Minuten bis 24 Stunden darstellt.

> **Wenn Ihre Maschine heiß läuft**, bietet das Panel außerdem einen [thermischen Schutz](ADMIN_PANEL_SETUP.md#thermal-guard), der den Server bei gefährlicher CPU-Temperatur stoppt und wieder startet, sobald sie abgekühlt ist. Seine Schwellen leitet er aus dem kritischen Grenzwert Ihrer eigenen CPU ab, es gibt also nichts zu rechnen, und er funktioniert mit jeder Start-/Stopp-Methode. Er wird mit dem Panel installiert, startet aber im reinen Protokollmodus: Er zeichnet auf, was er *getan hätte*, und ändert nichts, bis Sie ihn in den Einstellungen aktivieren. Dauerdekodierung hält eine CPU rund um die Uhr beschäftigt, daher lohnt sich nach einer Woche Autorun ein Blick in den CRASH-Reiter, um zu sehen, wie nah Ihre Maschine tatsächlich kommt.

> **Der Serverport wird automatisch erkannt.** Der Daemon greift direkt auf den `[server] port` des spectrumservers zu (Loopback + Token, unter Umgehung des Proxys). Er liest diesen Port aus der Konfigurationsdatei, mit der der laufende spectrumserver gestartet wurde, und funktioniert damit ohne Konfiguration auf jedem Port — die Zeile `[autorun] tap backend: …` in `autorun.log` zeigt, was er ermittelt hat. Lief Ihr Server beim Start des Daemons nicht oder haben Sie eine ungewöhnliche Einrichtung, legen Sie ihn in `autorun.json` fest:
> ```json
> "server": { "host": "127.0.0.1", "port": 9002 }
> ```
> Ein falscher Port zeigt sich als `504` / `tap closed 1006` in `autorun.log`, wobei `decodes` bei 0 stehen bleibt.

---

## Emulation von KiwiSDR-Clients (optional)

Seit v4.1.0 kann PhantomSDR-Plus auch das **KiwiSDR-Protokoll** beantworten, sodass Software, die für einen KiwiSDR geschrieben wurde — **AetherSDR**, `kiwiclient` und die übrigen — sich direkt mit Ihrem Empfänger verbindet, auf demselben Host und Port, den Sie ohnehin veröffentlichen. Sie ist aus, bis `[kiwi_emulation] enabled = true` in der Konfiguration steht, mit der Ihr Empfänger läuft.

Das Installationsprogramm bietet sie als Schritt 17 an; `./kiwi_install.sh` spielt sie auf einem bereits installierten Baum ein.

> **Vollständige Dokumentation: [Emulation von KiwiSDR-Clients](Aether_config.md)** — was die Brücke tut, wie man sie installiert, jeder `[kiwi_emulation]`-Schlüssel, das Verbinden eines Clients, die Lautstärke, das S-Meter, die Wasserfallrate und eine Symptomtabelle.

---

## Konfiguration

### 1. Konfigurationsdatei auswählen

Wählen Sie die passende Konfigurationsdatei für Ihr SDR:

- `config-rtl.toml` – RTL-SDR-Sticks
- `config-rsp1a.toml` – SDRplay RSP1A
- `config-airspyhf.toml` – Airspy HF+ Discovery
- `config-fobos-hf.toml` – RigExpert Fobos SDR, HF1/HF2 Direktabtastung (0-25 MHz)
- `config-fobos.toml` – RigExpert Fobos SDR, RF-Zweig (25-6000 MHz)
- `config-rx888mk2.toml` – RX888 MK2
- `config-hackrf.toml` – HackRF One
- `config.example.hackrf.toml` – HackRF One

In diesem Beispiel verwenden wir den RTL-SDR.

### 2. Konfigurationsdatei bearbeiten

```bash
nano config-rtl.toml
```

#### Wichtige Einstellungen

```toml
[server]
port = 9002                      # Web interface port (or everything else)
html_root = "frontend/dist/"     # Frontend location
otherusers = 1                   # Show other users (1=yes, 0=no)
threads = 2                      # Number of server threads

[websdr]
register_online = true           # Register on sdr-list.xyz (true/false)
name = "Your WebSDR Name"        # Display name
antenna = "Your Antenna Type"    # e.g., "Vertical", "Loop", "Dipole"
grid_locator = "AB12cd"          # Your Maidenhead grid square
hostname = "your.domain.com"     # Your domain or IP address

[input]
sps = 2048000                    # Sample rate (adjust for your coverage)
fft_size = 131072                # FFT size (higher = better resolution)
brightness_offset = -10          # Waterfall brightness adjustment
frequency = 145000000            # Base frequency in Hz (145 MHz for 2m)
signal = "iq"                    # "iq" for complex, "real" for real sampling
fft_threads = 2                  # FFT processing threads
accelerator = "opencl"           # "none", "cuda", or "opencl"
audio_sps = 12000                # Audio sample rate (keep at 12000)
audio_compression = "opus"       # "flac" or "opus"
smeter_offset = -2               # S-meter calibration
waterfall_size = 1024            # Waterfall FFT size
waterfall_compression = "zstd"   # Waterfall compression

[input.driver]
name = "stdin"                   # Input driver
format = "u8"                    # Sample format for RTL-SDR

[input.defaults]
frequency = 145500000            # Default tuning frequency
modulation = "FM"                # Default modulation mode
```

#### Richtwerte für die Abtastrate

| Abdeckung | Abtastrate | FFT-Größe |
|-----------|------------|-----------|
| 2 MHz | 2048000 | 131072 |
| 3.2 MHz | 3200000 | 131072 |
| 10 MHz | 10000000 | 1048576 |
| 30 MHz | 30000000 | 2097152 |
| 60 MHz | 60000000 | 4194304 |

### 3. Standortinformationen konfigurieren

```bash
nano frontend/site_information.json
```

Bearbeiten Sie die folgenden Felder:

```json
{
  "siteSysop": "YourCallsign",
  "siteSysopEmailAddress": "your@email.com",
  "siteGridSquare": "AB12cd",
  "siteCity": "Your City, Country",
  "siteInformation": "https://github.com/sv1btl/PhantomSDR-Plus",
  "siteHardware": "Computer specifications",
  "siteSoftware": "PhantomSDR-Plus v4.2.0",
  "siteReceiver": "Your SDR model",
  "siteAntenna": "Antenna description",
  "siteNote": "Additional information",
  "siteIP": "http://your.domain.com:9002",
  "siteSDRBaseFrequency": 0,
  "siteSDRBandwidth": 2048000,
  "siteRegion": 1,
  "siteChatEnabled": true
}
```

**IARU-Regionen:**
- **1**: Europa, Afrika, Naher Osten, Nordasien
- **2**: Amerika (Nord, Mitte, Süd), Karibik
- **3**: Asien-Pazifik, Ozeanien

### 4. Frequenzmarker anpassen (optional)

```bash
nano markers.json
```

Fügen Sie Ihre bevorzugten Frequenzen, Relaisfunkstellen und Rundfunksender hinzu.

### 5. Startskript bearbeiten

```bash
nano start-rtl.sh
```

Das Startskript ist ein eigenständiger Starter mit Watchdog. Bearbeiten Sie nur den Block **RECEIVER CONFIGURATION** nahe dem Anfang, damit die Empfängerargumente zu Ihrer Einrichtung passen:

```bash
# ═══ RECEIVER CONFIGURATION (the only receiver-specific part) ═══
RX_LABEL="RTL-SDR"
RX_COMM="rtl_sdr"                       # process name to monitor/kill
CONFIG="$PHANTOMDIR/config-rtl.toml"    # your .toml
FIFO="$PHANTOMDIR/rtl.fifo"
RX_ARGS="${RX_ARGS:--f 145000000 -s 2048000 -}"   # receiver args (edit these)
```

Parameter innerhalb von `RX_ARGS`:
- `-f 145000000`: Mittenfrequenz (145 MHz)
- `-s 2048000`: Abtastrate (2,048 MSPS)

`CONFIG` verweist auf Ihre `.toml`. Sie müssen sonst **nichts** im Skript ändern — die Logik für Start/Neustart/Watchdog/Protokollierung ist allgemeingültig. Sie können die Empfängerargumente auch beim Start überschreiben, ohne die Datei zu bearbeiten: `RX_ARGS="-f 145000000 -s 2048000 -" ./start-rtl.sh` (`RX888_ARGS` für `start-rx888mk2.sh`).

---

## Gerätespezifische SDR-Einrichtung

### RTL-SDR

#### RTL-SDR-Werkzeuge installieren

```bash
sudo apt install -y rtl-sdr
```

#### RTL-SDR testen

```bash
rtl_test
```

Drücken Sie Strg+C zum Beenden. Sie sollten Informationen zur Abtastrate sehen.

#### Konfiguration bearbeiten

```bash
nano config-rtl.toml
```

Übliche Einstellungen für den RTL-SDR:
```toml
sps = 2048000
frequency = 145000000
signal = "iq"
format = "u8"
```

### Empfänger über SoapySDR (RSP1A, Fobos, Airspy HF+)

SDRplay RSP1A, RigExpert Fobos SDR und Airspy HF+ erreichen den Server auf dieselbe Weise: ein SoapySDR-Treiber für das Gerät und `rx_sdr` (aus rx_tools), das die Samples an `spectrumserver` weiterreicht. Ein Skript pro Empfänger installiert die ganze Kette:

| Empfänger | Skript | Installer-Option | Startskript | Konfiguration |
|---|---|---|---|---|
| SDRplay RSP1A | `./setup-rsp1a.sh` | 3 | `start-rsp1a.sh` | `config-rsp1a.toml` |
| RigExpert Fobos SDR | `./setup-fobos.sh` | 5 | `start-fobos-hf.sh` (HF) / `start-fobos.sh` (RF) | `config-fobos-hf.toml` / `config-fobos.toml` |
| Airspy HF+ | `./setup-airspyhf.sh` | 6 | `start-airspyhf.sh` | `config-airspyhf.toml` |

Jedes dieser Skripte:

- installiert git, cmake, einen Compiler, libusb und **SoapySDR** aus den Paketen Ihrer Distribution — es erkennt apt, dnf, pacman und zypper und funktioniert damit auf Debian/Ubuntu, Fedora, Arch und openSUSE gleichermaßen;
- baut den Treiber des Empfängers aus den Quellen in `sdr_drivers/` (nicht von git erfasst);
- baut **rx_tools** für `rx_sdr`, sofern `rx_sdr` noch nicht installiert ist — eine Kopie dient allen Empfängern;
- installiert eine **udev-Regel** und nimmt Sie in die Gruppe `plugdev` auf, damit das Startskript nie `sudo` für das Gerät braucht. **Melden Sie sich einmal ab und wieder an**, damit die Gruppe wirksam wird;
- prüft zum Schluss, dass SoapySDR den Treiber wirklich auflistet, und bricht sonst mit einer Fehlermeldung ab.

Starten Sie sie als normaler Benutzer — sie rufen `sudo` selbst auf. Sie sind idempotent: ein erneuter Lauf aktualisiert die Treiberquellen mit `git pull` und baut neu. Das Installationsskript ruft genau diese Skripte auf; auf einer bereits installierten Station starten Sie einfach das für Ihren Empfänger. Der gemeinsame Teil steht in `setup-sdr-common.sh`, das nicht allein gestartet wird. Zwei optionale Variablen gelten für alle drei: `SDR_USER=<Name>` nimmt ein anderes Konto in `plugdev` auf, `SDR_SKIP_DEPS=1` überspringt die Paketinstallation.

Prüfen Sie bei angeschlossenem Gerät, dass der Empfänger gefunden wird:

```bash
SoapySDRUtil --find="driver=soapyMiri"   # RSP1A
SoapySDRUtil --find="driver=fobos"       # Fobos
SoapySDRUtil --find="driver=airspyhf"    # Airspy HF+
```

#### SDRplay RSP1A

`setup-rsp1a.sh` installiert den **Open-Source-Treiber**: libmirisdr-5, den per Reverse Engineering entstandenen Treiber für die Mirics-Chips MSi2500/MSi001 im RSP1 und RSP1A, mit seinem SoapySDR-Modul SoapyMiri (`driver=soapyMiri`). Er braucht keinen Hintergrunddienst und kein root. Das Skript sperrt außerdem die Kernel-Treiber `msi2500` und `msi001` in `/etc/modprobe.d/blacklist-msi2500.conf`, weil sie den RSP1A als V4L2-Radio belegen, bevor `rx_sdr` ihn öffnen kann. War das Gerät angeschlossen, während sie geladen waren, stecken Sie es einmal neu ein (oder starten Sie neu).

Die geschlossene API von SDRplay (`driver=sdrplay`, mit SoapySDRPlay und dem Dienst `sdrplay`) funktioniert weiterhin — die mitgelieferte Datei `instructions-for-rsp1a` beschreibt diese Installation. `start-rsp1a.sh` wählt selbst zwischen beiden: Hat SoapySDR den Treiber `sdrplay`, nutzt es die API und startet vorher den Dienst `sdrplay` neu, sonst libmirisdr-5. Eine auf der API eingerichtete Station läuft also unverändert weiter. Um einen Treiber zu erzwingen, starten Sie mit `RX_DRIVER=miri` oder `RX_DRIVER=sdrplay`. Der gewählte Treiber steht in `logwebsdr.txt` als `RSP1A driver: miri` oder `RSP1A driver: sdrplay`.

#### RigExpert Fobos SDR

Der Fobos liefert **immer nur einen Zweig gleichzeitig**, deshalb hat er zwei Startskripte, die sich wie jedes `start-*.sh` die Watchdog-Sperre teilen — der Start des einen beendet das andere:

- **`start-fobos-hf.sh`** — die Eingänge HF1/HF2 in Direktabtastung, 0-25 MHz, auf Port 9003. In dieser Betriebsart gibt es keinen Lokaloszillator: der ADC digitalisiert ständig 0-25 MHz (`-f 0` ist Absicht, und die Warnung *Failed to set center freq* von rx_sdr ist zu erwarten). `rx_sdr` liefert CF32 mit 50 Msps; der kleine Wandler `cf32_to_real` (von `setup-fobos.sh` aus `cf32_to_real.c` gebaut) behält den I-Kanal und skaliert ihn auf s16, daher verwendet `config-fobos-hf.toml` `signal="real"` und `format="s16"`.
- **`start-fobos.sh`** — der RF-Zweig, 25-6000 MHz, IQ, auf Port 9002. Wählen Sie das Fenster vor dem ersten Start: `-f` (Mitte) und `-s` (Abtastrate) in der Zeile `RX_ARGS` müssen zu `frequency=` und `sps=` in `config-fobos.toml` passen. Die mitgelieferten Werte (97 MHz, 20 Msps) sind nur ein Ausgangspunkt, um zu prüfen, dass es läuft.

> [!IMPORTANT]
> `config-fobos-hf.toml` wird mit `accelerator="opencl"` ausgeliefert: ein 50-Msps-Strom durch eine FFT mit 1M Bins ist so schwer wie die 60 Msps des RX888, und auf der CPU gehen Samples verloren und die Maschine wird heiß. Auf einem Rechner ohne OpenCL-Gerät startet `spectrumserver` mit dieser Einstellung nicht — setzen Sie dort `accelerator="none"`.

SoapyFobosSDR braucht zum Bauen die Header von libfobos und libfobos-sdr-agile, daher baut `setup-fobos.sh` beide, auch für die Standard-Firmware. Die Fobos-Unterstützung stammt aus einem Skript, das eine andere Station geschrieben hat, nachdem sie einen Fobos mit PhantomSDR-Plus in Betrieb genommen hatte; die HF-Werte in `config-fobos-hf.toml` sind die, die dort funktioniert haben.

#### Airspy HF+

`setup-airspyhf.sh` installiert libairspyhf aus der Distribution, wo sie paketiert ist (Debian und Ubuntu, Fedora, openSUSE), und baut sie aus den Quellen, wo nicht (Arch hat sie nur im AUR); danach baut es SoapyAirspyHF (`driver=airspyhf`). `start-airspyhf.sh` liefert 912 ksps IQ in CS16, die `config-airspyhf.toml` als `format="s16"` liest. Die mitgelieferte Datei `instructions-for-airspy` beschreibt den manuellen Weg.

### RX888 MK2

#### RX888-Werkzeuge installieren

```bash
# Install rx_tools
git clone https://github.com/rxseger/rx_tools.git
cd rx_tools
mkdir build && cd build
cmake ..
make -j4
sudo make install
sudo ldconfig

# Install RX888 firmware and support
# Follow manufacturer instructions
```

#### rx888_stream ohne sudo ausführen (udev-Regeln)

Standardmäßig ist das Cypress-FX3-USB-Gerät des RX-888 nur für root zugänglich, sodass `rx888_stream` `sudo` bräuchte. Führen Sie das mitgelieferte Hilfsskript einmal aus, um udev-Regeln zu installieren und sich der Gruppe `plugdev` hinzuzufügen:

```bash
./setup-rx888-udev.sh          # re-runs itself with sudo automatically
```

Es schreibt `/etc/udev/rules.d/99-rx888.rules` für alle drei Cypress-FX3-Produkt-IDs (`04b4:00f1`/`00f3` Bootloader und `04b4:8613` mit geladener Firmware), lädt udev neu und legt einen stabilen Symlink `/dev/rx888` an. **Melden Sie sich ab und wieder an** (wegen der Gruppenänderung) und **stecken Sie das Gerät einmal neu an**; danach laufen `rx888_stream` — und der Starter `start-rx888mk2.sh` — ohne `sudo`. Das Skript ist idempotent und kann gefahrlos erneut ausgeführt werden. Für ein anderes Konto: `RX888_USER=<name> ./setup-rx888-udev.sh`.

#### Konfiguration bearbeiten

```bash
nano config-rx888mk2.toml
```

Übliche Einstellungen für den RX888:
```toml
sps = 60000000
frequency = 0
signal = "real"
format = "s16"
fft_size = 4194304
```

### HackRF One

Für den HackRF wird nichts gebaut: `hackrf_transfer` aus dem Paket `hackrf` Ihrer Distribution liefert die Samples direkt an `spectrumserver`. `./setup-hackrf.sh` (Installer-Option 7) installiert dieses Paket mit apt, dnf, pacman oder zypper und ergänzt eine udev-Regel und die Gruppe `plugdev`, damit `start-hackrf.sh` ohne `sudo` läuft — melden Sie sich danach einmal ab und wieder an.

```bash
./setup-hackrf.sh    # installs the hackrf package and the udev rule
hackrf_info          # with the HackRF plugged in: must list the board
```

`start-hackrf.sh` liefert jeweils ein Fenster. Wählen Sie es vor dem ersten Start: `-f` (Mitte) und `-s` (Abtastrate) in seiner Zeile `RX_ARGS` müssen zu `frequency=` und `sps=` in `config-hackrf.toml` passen. `-l` und `-g` sind die Verstärkungen von LNA (0-40 dB, 8-dB-Schritte) und VGA (0-62 dB, 2-dB-Schritte), `-a 1` schaltet den HF-Verstärker ein. Die mitgelieferten Werte (98 MHz, 20 Msps) sind nur ein Ausgangspunkt, um zu prüfen, dass es läuft.

`hackrf_transfer` schreibt **vorzeichenbehaftetes** 8-Bit-IQ, daher braucht die Konfiguration `format="s8"`. `config.example.hackrf.toml` enthielt bis September 2026 `u8`; damit ist jedes Sample um 128 verschoben und der Wasserfall zeigt nur Rauschen — prüfen Sie ältere Kopien davon.

---

## Test und Überprüfung

### 1. Testlauf

```bash
# For RTL-SDR
./start-rtl.sh
```

Damit startet der Server **im Hintergrund** (er löst sich ab und kehrt sofort zurück) und beginnt, in `logwebsdr.txt` zu protokollieren.

### 2. Auf Fehler prüfen

Das Skript protokolliert seinen Fortschritt in `logwebsdr.txt` — beobachten Sie ihn live:

```bash
tail -f logwebsdr.txt
```

Achten Sie auf:
- ✅ `Starting the initialization script of the PhantomSDR Server`
- ✅ `<receiver> running (PID …)`
- ✅ `Server started normally`
- ❌ `Server … FAILED …` oder `ERROR: receiver binary '…' not found` (korrigieren Sie die Empfängerargumente bzw. die `.toml` oder installieren Sie das Empfängerwerkzeug und führen Sie das Startskript erneut aus)

### 3. Weboberfläche aufrufen

Öffnen Sie im Browser:
```
http://localhost:9002
```

(Ersetzen Sie die Portnummer durch Ihren konfigurierten Port)

### 4. Funktion überprüfen

- Der Wasserfall sollte angezeigt werden
- Beim Klick auf Signale sollte Ton wiedergegeben werden
- Das S-Meter sollte auf Signale reagieren
- Die Nutzerzahl sollte „1" anzeigen

### 5. Von einem anderen Gerät testen

Von einem anderen Rechner in Ihrem Netzwerk:
```
http://YOUR_SERVER_IP:9002
```

### 6. Ressourcenverbrauch prüfen

```bash
# Monitor CPU usage
htop

# Monitor GPU usage (if OpenCL/CUDA enabled)
nvidia-smi  # For NVIDIA
radeontop   # For AMD

# Monitor network usage
iftop
```

### 7. Server stoppen

Der Server läuft im Hintergrund unter einem Watchdog, **Strg+C stoppt ihn also nicht** (und der Watchdog würde ihn ohnehin neu starten). Verwenden Sie das gemeinsame Stopp-Skript, das für jeden Empfänger funktioniert — es beendet zuerst den Watchdog, dann den Empfänger und `spectrumserver`:

```bash
./stop-websdr.sh
```

---

## Automatischen Start einrichten

### Mit systemd (empfohlen)

#### 1. Service-Datei anlegen

```bash
sudo nano /etc/systemd/system/phantomsdr.service
```

Fügen Sie den folgenden Inhalt ein (Pfade und Benutzer anpassen):

```ini
[Unit]
Description=PhantomSDR-Plus WebSDR Server
After=network.target

[Service]
Type=simple
User=youruser
WorkingDirectory=/home/youruser/PhantomSDR-Plus
# Run the watchdog in the FOREGROUND (note the --watchdog flag) so systemd can
# track it. Do NOT use the plain "./start-rtl.sh" here — that form detaches into
# the background and exits, which systemd would treat as the service stopping.
ExecStart=/home/youruser/PhantomSDR-Plus/start-rtl.sh --watchdog
ExecStop=/home/youruser/PhantomSDR-Plus/stop-websdr.sh
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

> Der `--watchdog`-Prozess startet Empfänger und `spectrumserver` bereits selbst neu; `Restart=always` ist nur eine Rückfallebene für den seltenen Fall, dass der Watchdog selbst beendet wird. Da systemd den Server hier überwacht, können Sie `systemctl start/stop/restart` und `journalctl -u phantomsdr -f` verwenden, statt die Skripte von Hand auszuführen.

#### 2. Dienst aktivieren und starten

```bash
# Reload systemd
sudo systemctl daemon-reload

# Enable service to start on boot
sudo systemctl enable phantomsdr.service

# Start service now
sudo systemctl start phantomsdr.service

# Check status
sudo systemctl status phantomsdr.service
```

#### 3. Dienst verwalten

```bash
# Start
sudo systemctl start phantomsdr

# Stop
sudo systemctl stop phantomsdr

# Restart
sudo systemctl restart phantomsdr

# View logs
sudo journalctl -u phantomsdr -f
```

### Mit Screen (Alternative)

> Meist unnötig: `./start-rtl.sh` löst sich bereits in den Hintergrund ab (per `setsid`) und läuft nach dem Abmelden mit eigenem Watchdog weiter. Screen ist nur dann praktisch, wenn Sie ausdrücklich eine interaktive Sitzung für die Vordergrundform `./start-rtl.sh --watchdog` möchten.

#### 1. Screen installieren

```bash
sudo apt install -y screen
```

#### 2. In einer Screen-Sitzung starten

```bash
screen -S phantomsdr
./start-rtl.sh
```

Drücken Sie Strg+A und dann D zum Ablösen.

#### 3. Sitzung wieder aufnehmen

```bash
screen -r phantomsdr
```

---

## CPU-Überhitzungsschutz

> 📖 **Vollständiges Handbuch: [THERMAL_GUARD.md](THERMAL_GUARD.md)** — die vier Modi und was ein Sysop bei jedem tun muss, Betrieb ohne Panel, die Throttle-Stufe ohne root, Testen und Fehlersuche.

PhantomSDR-Plus bringt einen Wächter mit, der den Server stoppt, wenn die CPU eine gefährliche Temperatur erreicht, und ihn wieder startet, sobald sie abgekühlt ist. Seine Schwellen leitet er aus dem kritischen Grenzwert ab, den Ihre eigene CPU veröffentlicht, es gibt also nichts zu rechnen, und er funktioniert mit jeder Start-/Stopp-Methode.

**Wenn Sie das Admin-Panel betreiben, haben Sie ihn bereits** — er läuft im Panel und wird auf dessen Seite „Einstellungen“ konfiguriert. Siehe das [Admin-Panel-Handbuch](ADMIN_PANEL_SETUP.md#thermal-guard). Der Rest dieses Abschnitts gilt für Installationen **ohne** Panel.

### 1. Prüfen, was der Wächter auf Ihrer Maschine sieht

```bash
cd ~/PhantomSDR-Plus
python3 thermal_guard.py --once
```

```
sensor     : hwmon:coretemp
temperature: 58.0 C
crit       : 100.0 C
mode       : log
thresholds : warn 88.0  throttle 92.0  stop 95.0  resume 75.0 (C)
cpufreq    : not writable — throttle stage disabled
```

Verwendet werden nur echte CPU-Die-Sensoren (`coretemp`, `k10temp`, `zenpower`, `cpu_thermal`); `acpitz` und unbeschriftete Thermal Zones werden bewusst ignoriert, weil sie oft eine Gehäuse- oder Platinentemperatur zig Grad unter der CPU melden. Steht dort `sensor : NONE`, lässt sich diese Maschine nicht schützen — häufig auf einem VPS oder in einem Container —, und der Wächter bleibt untätig, statt es vorzutäuschen.

Dafür muss nichts installiert werden: `thermal_guard.py` kommt mit der Python-Standardbibliothek aus.

### 2. Konfigurieren

Der Wächter liest `admin_config.json` neben `thermal_guard.py`. Legen Sie die Datei an, falls Sie keine haben — ohne Panel haben Sie keine. Das Nötigste:

```json
{
  "sdr_process_name": "spectrumserver",
  "stop_script":  "stop-websdr.sh",
  "start_script": "start-rx888mk2.sh",
  "thermal_mode": "stop+restart"
}
```

- `thermal_mode` — `log` (nur aufzeichnen, der Standard), `throttle`, `stop` oder `stop+restart`. **Diesen Wert müssen Sie setzen**, denn der Wächter wird untätig ausgeliefert: unverändert schreibt er nur auf, was er *getan hätte*. Sie können ihn auch auf der Kommandozeile als `--mode stop+restart` übergeben, was die Datei überschreibt — sind Sie mit allen anderen Standardwerten zufrieden, brauchen Sie also gar keine Konfigurationsdatei.
- `stop_script` / `start_script` — womit der Wächter Ihren Server stoppt und startet. Ohne Stopp-Skript greift er auf `SIGTERM` und nach 10 Sekunden auf `SIGKILL` für `sdr_process_name` zurück. Ohne Start-Skript stoppt er, startet aber nie neu.
- Schwellen und Zeiten lassen sich hier ebenfalls setzen, mit denselben Schlüsselnamen wie im Panel — die vollständige Tabelle steht im [Admin-Panel-Handbuch](ADMIN_PANEL_SETUP.md#thermal-guard).

> **Wenn systemd Ihren SDR-Server überwacht**, lassen Sie `stop_script` auf ein kleines Skript zeigen, das `systemctl stop ihre-unit` ausführt, statt den Wächter den Prozess direkt signalisieren zu lassen. Der Wächter gewinnt ohnehin — solange die CPU zu heiß ist, wiederholt er den Stopp alle 2 Sekunden, sodass alles, was den Server wiederbelebt, rückgängig gemacht wird —, aber ein sauberer Stopp ist besser als ein Kampf im Zwei-Sekunden-Takt.

### 3. Als Dienst betreiben

Das Repository enthält eine fertige Unit, `thermal-guard.service`. Passen Sie darin `User=` und die beiden Pfade an, dann:

```bash
sudo cp thermal-guard.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now thermal-guard
systemctl status thermal-guard
```

`User=` muss ein Konto sein, das Ihre Start-/Stopp-Skripte ausführen darf — normalerweise derselbe Benutzer, der den SDR-Server betreibt. **Ein Wächter, der als Benutzer läuft, der den Server nicht stoppen kann, lässt Sie ungeschützt zurück und sieht dabei geschützt aus.**

Um den Wächter aus der Unit statt aus der Konfigurationsdatei scharfzuschalten, ergänzen Sie `ExecStart` um `--mode`:

```ini
ExecStart=/usr/bin/python3 -u /home/sysop/PhantomSDR-Plus/thermal_guard.py --mode stop+restart
```

Ohne systemd:

```bash
cd ~/PhantomSDR-Plus
nohup python3 -u thermal_guard.py --mode stop+restart >> thermal.log 2>&1 &
```

`python3 thermal_guard.py --help` listet alle Optionen auf, auch `--config` für eine Konfigurationsdatei an einem anderen Ort als neben dem Skript.

### 4. Beobachten, dann vertrauen

Alles, was der Wächter tut, landet in `crash.log` im PhantomSDR-Plus-Verzeichnis, ein Ereignis pro Zeile:

```
[THERMAL] warn: 89.0C (warn=88.0 crit=100.0) sustained 31s
[THERMAL] STOPPED server: 96.0C sustained 62s (stop=95.0 crit=100.0) — Started stop-websdr.sh
[THERMAL] lockout: process reappeared at 94.0C — re-stopped [3 time(s) so far]
[THERMAL] recovered: 74.0C held below 75.0 — lockout cleared
```

```bash
grep THERMAL crash.log
```

Lassen Sie `thermal_mode` zunächst eine Woche auf `"log"` und lesen Sie die Datei nach Ihren harten Momenten — einem vollen Rebuild, einem heißen Nachmittag. Steht dort nichts, kam Ihre Maschine nie in die Nähe. Stellen Sie dann den Modus auf `stop`.

Bevor Sie sich darauf verlassen, prüfen Sie den ganzen Weg einmal mit einer fiktiven Messung oberhalb Ihrer Stopp-Schwelle:

```json
"thermal_test_temp": 97
```

Der Wächter behandelt sie als echt, sodass warn → stop → Sperre → Erholung → Neustart auf Wunsch ablaufen. Entfernen Sie die Zeile (oder setzen Sie sie auf `null`), um zum echten Sensor zurückzukehren. Im Modus `stop` wird der Server dabei wirklich gestoppt und Ihre Hörer werden getrennt — machen Sie das also, wenn niemand zuhört, oder testen Sie im Modus `log`, wo gezeigt wird, was passiert *wäre*, ohne etwas anzufassen.

---

## Fehlerbehebung

### Build-Fehler

#### Abhängigkeitsprobleme

```bash
# Ubuntu: Install missing dependencies
sudo apt install --fix-broken

# Fedora: Install missing dependencies
sudo dnf install <package-name>
```

#### Meson-Konfiguration schlägt fehl

```bash
# Clean and reconfigure
rm -rf build
meson setup build --buildtype=release
```

#### `meson setup` bricht mit `ModuleNotFoundError: No module named 'mesonbuild'` ab

```
Traceback (most recent call last):
  File "/home/<user>/.local/bin/meson", line 3, in <module>
    from mesonbuild.mesonmain import main
ModuleNotFoundError: No module named 'mesonbuild'
```

Am Quellbaum ist nichts falsch. Eine übrig gebliebene Installation per
`pip install --user meson` hat ein Startskript in `~/.local/bin` hinterlassen,
das im `PATH` vor `/usr/bin` steht und damit die funktionierende Kopie der Paketverwaltung verdeckt. Ein Distributions-Upgrade (etwa Ubuntu 24.04 → 26.04) stellt Python auf eine neue Version um, das alte `site-packages` mit
`mesonbuild` liegt nicht mehr im Importpfad, und das Skript stirbt, bevor es
irgendetwas tut. Dasselbe kann `ninja` passieren.

Das Installationsprogramm erkennt das, umgeht es für die Dauer des Laufs und warnt Sie dabei — reparieren Sie das System dennoch:

```bash
rm -f ~/.local/bin/meson
hash -r
meson --version        # muss eine Version ausgeben
```

Wenn Sie meson lieber weiterhin über pip installiert lassen möchten, installieren Sie es für das Python neu, das dieses System jetzt hat:

```bash
python3 -m pip install --user --force-reinstall --break-system-packages meson
```

#### `meson setup` bricht mit `Clock skew detected` ab

```
ERROR: Clock skew detected. File /home/pi/PhantomSDR-Plus/build/../meson.build has a time stamp 10392.2144s in the future.
```

Mit dem Quellbaum ist nichts verkehrt: die Systemuhr geht den Dateien hinterher. meson und ninja bauen nicht, wenn eine Eingabe neuer als die aktuelle Zeit ist, denn sie können nicht erkennen, was veraltet ist. Das passiert auf einem Raspberry Pi ohne Zelle in der RTC-Halterung — jeder Start beginnt bei der zuletzt bekannten Zeit, und ein Build vor der NTP-Synchronisierung sieht den ganzen Baum in der Zukunft datiert — und bei jedem Baum, der von einer vorgehenden Maschine entpackt oder kopiert wurde.

Stellen Sie zuerst die Uhr richtig:

```bash
timedatectl                       # stimmt die Zeit? ist NTP synchronisiert?
sudo timedatectl set-ntp true
```

Warten Sie ein paar Sekunden und starten Sie das Installationsprogramm erneut. Es prüft das vor dem Aufruf von meson und bietet an, die betroffenen Zeitstempel zurückzusetzen (`PHANTOM_FIX_CLOCK_SKEW=y|n`). Von Hand, im Quellverzeichnis:

```bash
find . -path ./build -prune -o -path ./.git -prune -o -newermt now -print0 | xargs -0r touch
```

#### Das Backend wurde gebaut, aber es gibt keine Webseite

Das Symptom ist eine Installation, die weitgehend geglückt aussieht: `build/spectrumserver` ist da, der Server startet, und der Browser bekommt nichts — weil `frontend/dist/` nie erzeugt wurde. Suchen Sie in der Ausgabe des Installationsskripts nach:

```
[vite-plugin-top-level-await] missing field `type`
    at Compiler.printSync (node_modules/@swc/core/index.js:257:29)
error during build:
   ❌ Failed: Default
```

`vite-plugin-top-level-await` verlangt `@swc/core` `^1.12.14`, daher löst ein frisches `npm install` auf 1.16.0 auf, dessen `printSync()` den Syntaxbaum ablehnt, den das Plugin ihm übergibt. Mit Ihrer Distribution hat das nichts zu tun — jedes Installationsskript pinnt jetzt die funktionierende Version, und `frontend/package.json` ebenfalls. Eine vor diesem Pin eingerichtete Maschine läuft weiter, bis ihr `node_modules` gelöscht wird; deshalb taucht das bei einer Neuinstallation scheinbar aus dem Nichts auf.

Wenn Sie einen älteren Checkout von Hand reparieren:

```bash
cd frontend
npm pkg set 'overrides.@swc/core=1.15.33'
npm install
./build-all.sh
```

### Laufzeitfehler

#### Port bereits belegt

```bash
# Find process using port
sudo lsof -i :9002

# Kill process
sudo kill -9 <PID>
```

#### Zugriff auf das SDR verweigert

```bash
# Add user to plugdev group
sudo usermod -a -G plugdev $USER

# Reload groups (or log out and back in)
newgrp plugdev
```

Bei einem **RX-888 MkII** reicht das allein nicht — das Cypress-FX3-Gerät benötigt zusätzlich udev-Regeln. Führen Sie das mitgelieferte Hilfsskript aus (es installiert die Regeln *und* fügt Sie zu `plugdev` hinzu), melden Sie sich dann ab und wieder an und stecken Sie das Gerät neu an:

```bash
./setup-rx888-udev.sh
```

#### Audioprobleme

```bash
# Try different codec
# Edit config file and change:
audio_compression = "flac"  # or "opus"

# Rebuild
cd frontend && npm run build && cd ..
```

### OpenCL-Probleme

#### clinfo zeigt keine Geräte

```bash
# Verify drivers are loaded
sudo clinfo

# Check OpenCL ICD files
ls /etc/OpenCL/vendors/

# Reinstall drivers (Intel example)
sudo apt remove --purge intel-opencl-icd
sudo apt install intel-opencl-icd
```

#### Keine Leistungsverbesserung

```bash
# Verify OpenCL is enabled in config
accelerator = "opencl"

# Try different device
# Add to config file:
[input.opencl]
device_id = 0  # Try 0, 1, 2, etc.
```

### Netzwerkprobleme

#### Kein Zugriff von anderen Geräten

```bash
# Check firewall
sudo ufw status
sudo ufw allow 9002/tcp

# Or disable firewall temporarily for testing
sudo ufw disable
```

#### Hohe Latenz

```bash
# Reduce waterfall size in config
waterfall_size = 512

# Increase buffer size
buffer_size = 16384

# Use Opus instead of FLAC
audio_compression = "opus"
```

### Probleme mit dem SDR-Gerät

#### RTL-SDR nicht gefunden

```bash
# Check if device is recognized
lsusb | grep Realtek

# Test with rtl_test
rtl_test

# Try blacklisting DVB-T drivers
echo "blacklist dvb_usb_rtl28xxu" | sudo tee /etc/modprobe.d/blacklist-rtl.conf
sudo rmmod dvb_usb_rtl28xxu
```

#### SDRplay nicht gefunden

`grep "RSP1A driver" logwebsdr.txt` zeigt, welchen Treiber `start-rsp1a.sh` gewählt hat.

Mit dem offenen Treiber (libmirisdr-5, `RSP1A driver: miri`):

```bash
# The kernel's msi2500 driver must not hold the device
lsmod | grep msi2500 && sudo modprobe -r msi2500 msi001

# Test with SoapySDR
SoapySDRUtil --find="driver=soapyMiri"
```

Mit der API von SDRplay (`RSP1A driver: sdrplay`):

```bash
# Check API installation
systemctl status sdrplay

# Restart API
sudo systemctl restart sdrplay

# Test with SoapySDR
SoapySDRUtil --find="driver=sdrplay"
```

#### Fobos oder Airspy HF+ nicht gefunden

```bash
SoapySDRUtil --info | grep -i factories   # must list fobos / airspyhf
SoapySDRUtil --find="driver=fobos"         # or driver=airspyhf
id | grep plugdev                          # log out and back in if missing
```

Fehlt der Treiber in der Liste, starten Sie `./setup-fobos.sh` oder `./setup-airspyhf.sh` erneut: es bricht mit dem Grund ab, wenn der Bau oder die SoapySDR-Prüfung scheitert.

---

## Leistungsoptimierung

### CPU-Optimierung

```toml
# Adjust thread counts based on CPU cores
[server]
threads = 4  # Set to number of cores

[input]
fft_threads = 4  # Set to number of cores
```

### Speicheroptimierung

```toml
# Reduce memory usage
[input]
waterfall_size = 512  # Lower value = less memory
fft_size = 65536      # Lower value = less memory
```

### Netzwerkoptimierung

```toml
# Optimize for limited bandwidth
[input]
audio_compression = "opus"  # More efficient than FLAC
waterfall_compression = "zstd"  # Efficient compression
```

---

## PhantomSDR-Plus aktualisieren

Seit Version 4.1.0 enthält das Repository **`update.sh`** — ein Update-Werkzeug, das eine installierte Station auf den veröffentlichten Stand bringt, **ohne die Dateien anzurühren, die sie zu Ihrer Station machen**. Es ersetzt das handgeschriebene `git pull`-Skript, das frühere Ausgaben dieser Anleitung anzulegen empfahlen, und benötigt git überhaupt nicht: der veröffentlichte Baum wird als Tarball geladen und Datei für Datei mit Ihrem verglichen. Es funktioniert also gleich, ob Sie das Repository geklont, ein `update.zip` entpackt oder den Baum von einem USB-Stick kopiert haben.

### Wenn Ihre Installation update.sh noch nicht hat

Ein älterer Baum enthält das Skript nicht. Holen Sie es einmal — es ist der einzige Schritt dieses ganzen Verfahrens, den Sie je von Hand tun:

```bash
cd ~/PhantomSDR-Plus
curl -fLO https://raw.githubusercontent.com/sv1btl/PhantomSDR-Plus/main/update.sh
chmod +x update.sh
```

Von da an wird alles — Quellen, Frontend, Dokumentation, Installer und `update.sh` selbst — vom Werkzeug geholt.

### Schritt 1 — ansehen, was sich ändern würde (es wird nichts geschrieben)

```bash
cd ~/PhantomSDR-Plus
./update.sh
```

Der veröffentlichte Baum wird geladen, mit Ihrem verglichen und ein Bericht ausgegeben. Geschrieben wird dabei nichts, der Aufruf ist also jederzeit gefahrlos — auch auf einer Station, die gerade auf Sendung ist. Der Rückgabewert ist `0`, wenn alles aktuell ist, und `10`, wenn ein Update bereitliegt; so kann ein Cron-Job Sie benachrichtigen, wenn es etwas zu tun gibt.

### Schritt 2 — anwenden

```bash
./update.sh --apply
```

Drei Arten von Dateien werden unterschiedlich behandelt, und genau darauf kommt es an:

| Dateien | Was geschieht |
|---|---|
| `config*.toml`, `markers.json`, `admin_config.json`, `autorun.json`, `frequencylist/`, `chat_history.txt`, `frontend/variant.json`, `frontend/site_information.json`, die Logdateien, `build/`, `frontend/dist/` | **Werden nie angerührt** und tauchen in keiner Rückfrage auf. Sie sind es, die aus dem Rechner *Ihre* Station machen. |
| `start-*.sh`, `stop-websdr.sh`, die `*.service`-Units, `install*.sh`, `recompile.sh`, `setup_admin.sh`, `smeter_theme.sh`, `proxy.py`, `admin_server.py`, `thermal_guard.py`, `frontend/src/bands-config.js` | **Es wird immer nachgefragt**, denn das sind die Dateien, die ein Betreiber aus gutem Grund geändert haben kann. |
| Alles Übrige | Wird aktualisiert, nachdem eine Kopie der alten Datei in `.update-backups/` gesichert wurde. |

Für jede Datei der mittleren Gruppe werden die Unterschiede angezeigt und drei Möglichkeiten angeboten:

```
  ❓ start-rx888mk2.sh  [K]eep mine / [u]pstream / [b]oth  (ENTER = Keep mine)
```

* **Keep mine** — Ihre Datei bleibt genau so, wie sie ist.
* **upstream** — die neue Fassung wird eingespielt, Ihre wird vorher gesichert.
* **both** — die neue Fassung wird als `start-rx888mk2.sh.new` daneben abgelegt, damit Sie Ihre
eigenen Änderungen in Ruhe übernehmen können.

**Wie sich der erste Lauf anfühlt.** Beim ersten Mal gibt es keine Aufzeichnung darüber,
aus welcher Fassung Ihre Dateien stammen, also wird jede Datei der mittleren Gruppe Ihnen vorgelegt — etwa zehn Fragen. Antworten Sie so:

| Ihre Lage | Antwort |
|---|---|
| Sie haben die Datei nie geändert | `u` — neue Fassung übernehmen. Der Normalfall. |
| Sie haben sie geändert (eigene `RX888_ARGS`, CPU-Pinning, angepasste Unit) | `b` — Ihre bleibt, die neue landet als `<Datei>.new` daneben. |
| Sie sind unsicher | ENTER — Ihre bleibt, nichts geht verloren, Sie können später vergleichen. |

Ihre Konfiguration ist davon nie betroffen: gefragt wird nur nach Skripten und Service-Units.

`update.sh` merkt sich in `.update-state/` die Fassung jeder eingespielten Datei. Ab dem zweiten
Lauf kann es daher eine Datei, die **Sie** geändert haben, von einer bloß alten unterscheiden und fragt nur noch bei denen nach, die Sie wirklich angefasst haben.

Bevor irgendetwas geschrieben wird, hält es Empfänger, Admin-Panel und Reverse-Proxy **der Installation an, die es aktualisiert** — was zu einem anderen Verzeichnis gehört, wird aufgeführt und weiterlaufen gelassen, sodass ein zweiter Klon aktualisiert werden kann, während der erste auf Sendung bleibt — und startet am Ende genau das wieder, was es angehalten hat. Haben sich Quell- oder Frontend-Dateien geändert, bietet es an, `recompile.sh` für Sie auszuführen. Gelöscht wird nie etwas: Dateien, die aus dem Repository verschwunden sind, werden gemeldet und nur auf ausdrückliche Anforderung mit `--prune` entfernt.

### Ein Update rückgängig machen

```bash
./update.sh --restore LAST
```

Jede überschriebene Datei liegt in `.update-backups/<Zeitstempel>/` mit einem eigenen
`restore.sh`; die letzten drei Läufe werden aufbewahrt.

### Weitere Optionen

```bash
./update.sh --apply --yes     # fragt nie; jede von Ihnen geänderte Datei BLEIBT
./update.sh --ref v4.1.0      # ein Tag, Branch oder Commit statt des aktuellen Standes
./update.sh --list-excludes   # zeigt die Nie-anrühren-Regeln, wie sie hier gelten
./update.sh --verbose         # listet jede Datei, nicht nur die ersten 40
```

Eigene Nie-anrühren-Regeln tragen Sie zeilenweise als Glob-Muster in `update-exclude.txt` im Wurzelverzeichnis der Installation ein.

### Wenn der Neubau auf einer sehr alten Installation scheitert

`update.sh` aktualisiert Dateien, keine Systempakete. Ist Ihr Baum so alt, dass der Bau
inzwischen Bibliotheken braucht, die Sie nicht haben, bricht `recompile.sh` mit einem Compiler- oder meson-Fehler ab. Das ist kein kaputtes Update — es fehlen die Abhängigkeiten:

```bash
./install.sh
```

Der Installer wird vom selben Lauf mit aktualisiert, und Ihre Konfiguration übersteht auch ihn.

### Von Hand aktualisieren

Wenn Sie ein Dateipaket lieber selbst einspielen:

```bash
cd ~
unzip -o update.zip
cd PhantomSDR-Plus
./stop-websdr.sh
cp -a ~/update/. .
chmod +x *.sh
./recompile.sh
./start-rx888mk2.sh          # oder das Startskript Ihres Empfängers
```

Sichern Sie vorher Ihre Konfiguration — `config-*.toml`, `frontend/site_information.json`,
`admin_config.json` und `markers.json` —, denn ein Dateipaket kann Ihre Änderungen nicht von
denen der Veröffentlichung unterscheiden. Genau dieses Problem löst `update.sh`.

---

## Sichern und Wiederherstellen

### Zu sichernde Dateien

- Konfigurationsdateien: `*.toml`
- Standortinformationen: `frontend/site_information.json`
- Marker: `markers.json`
- Eigene Skripte: `start-*.sh`, `stop-*.sh`
- Chatverlauf: `chat_history.txt`
- Hintergrundbild: `frontend/src/assets/background.jpg`

### Sicherungsbefehl

```bash
cd ~/PhantomSDR-Plus
tar -czf phantomsdr-backup-$(date +%Y%m%d).tar.gz \
  *.toml \
  *.sh \
  markers.json \
  chat_history.txt \
  frontend/site_information.json \
  frontend/src/assets/background.jpg
```

### Wiederherstellungsbefehl

```bash
tar -xzf phantomsdr-backup-YYYYMMDD.tar.gz
```

---

## Sicherheitsüberlegungen

### Firewall-Konfiguration

```bash
# Allow only necessary ports
sudo ufw allow 9002/tcp
sudo ufw enable
```

### Reverse-Proxy (optional)

Erwägen Sie nginx oder Apache als Reverse-Proxy für:
- SSL-/TLS-Verschlüsselung
- Zuordnung eines Domainnamens
- Lastverteilung
- Zugriffssteuerung

### Nutzerbegrenzung

Bearbeiten Sie `config.toml`:
```toml
[server]
max_users = 100  # Limit concurrent users
```

---

## Hilfe erhalten

### Ressourcen

- **Dokumentation**: diese Anleitung, README.md, USER_GUIDE.md
- **GitHub Issues**: https://github.com/sv1btl/PhantomSDR-Plus/issues
- **Live-Demo**: http://phantomsdr.no-ip.org:8900/

### Probleme melden

Geben Sie beim Melden von Problemen an:
1. Betriebssystem und Version
2. Modell des SDR-Geräts
3. Inhalt der Konfigurationsdatei
4. Fehlermeldungen
5. Systemressourcenverbrauch (CPU, RAM, GPU)

### Unterstützung durch die Gemeinschaft

- Prüfen Sie vorhandene GitHub-Issues, bevor Sie neue anlegen
- Machen Sie ausführliche Angaben zu Ihrer Einrichtung
- Fügen Sie Protokolle und Fehlermeldungen bei
- Bleiben Sie geduldig und respektvoll

---

## Anhang A: vollständige Abhängigkeitsliste

### Paketliste für Ubuntu 24.04

```
build-essential
cmake
pkg-config
meson
libfftw3-dev
libwebsocketpp-dev
libflac++-dev
zlib1g-dev
libzstd-dev
libboost-all-dev
libopus-dev
libliquid-dev
git
util-linux (taskset — for the autorun spot reporter)
psmisc
wget
curl
rtl-sdr (for RTL-SDR)
airspy (for Airspy)
hackrf (for HackRF)
libclfft-dev (for OpenCL)
ocl-icd-opencl-dev (for OpenCL)
clinfo (for OpenCL)
```

---

## Anhang B: Konfigurationsbeispiele

### Beispiel 1: RTL-SDR für VHF/UHF

```toml
[input]
sps = 2048000
frequency = 145000000
signal = "iq"

[input.driver]
format = "u8"

[input.defaults]
frequency = 145500000
modulation = "FM"
```

### Beispiel 2: RX-888 mk2 für Kurzwelle (0-30 MHz)

Der Empfänger, den die meisten Sysops einsetzen. Dies ist ein vollständiger `[input]`-Abschnitt und kein Ausschnitt; die Werte stammen aus der mitgelieferten `config-rx888mk2.toml`.

```toml
[input]
sps = 60000000            # 0-30 MHz per Direktabtastung
fft_size = 4194304        # siehe Hinweis unten
fft_threads = 8
brightness_offset = -9    # negativer, wenn der Wasserfall schwarze Flächen zeigt
frequency = 0             # Basisband: der RX-888 tastet ab DC ab
signal = "real"           # nicht "iq" - Direktabtastung liefert einen reellen Strom
accelerator = "opencl"    # "none", wenn keine OpenCL-Laufzeit vorhanden ist
audio_sps = 12000
audio_compression = "flac"
waterfall_size = 1024
waterfall_compression = "zstd"
smeter_offset = 5
analog_smeter_offset = 5

[input.driver]
name = "stdin"
format = "s16"

[input.defaults]
frequency = 7120000
modulation = "LSB"
```

Gespeist wird es von `rx888_stream`, was `start-rx888mk2.sh` für Sie übernimmt:

```bash
rx888_stream -f /path/to/SDDC_FX3.img -s 60000000 -g 50 -a 0 -m low --pga -d -r -o - \
  | build/spectrumserver --config config-rx888mk2.toml
```

**Zu `fft_size`:** Bei 60 MSPS ist 4194304 die richtige Größe. 8388608 verdoppelt die Wasserfallauflösung und zugleich Speicher- und CPU-Bedarf jeder Transformation — auf den meisten Rechnern erkauft man schärfere Bins mit verlorenen Frames. Beginnen Sie mit 4194304 und gehen Sie nur höher, wenn der Server deutlich Luft hat.

### Beispiel 3: HackRF für Breitband-FM

```toml
[input]
sps = 10000000
frequency = 100900000
signal = "iq"

[input.driver]
format = "s8"

[input.defaults]
frequency = 100900000
modulation = "WBFM"
```

---

**Installation abgeschlossen! Sie sollten nun einen voll funktionsfähigen PhantomSDR-Plus-Server haben.**

**73 de SV1BTL & SV2AMK**
