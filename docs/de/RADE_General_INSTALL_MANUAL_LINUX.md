# RADE v1 — Anleitung zur manuellen Installation
### Alle Linux-Systeme — Ubuntu / Debian / Fedora / Arch / Raspberry Pi OS · PhantomSDR-Plus

> **Voraussetzung:** Die gepatchten Dateien (`rade_helper.py`, `rade.sh`, `audio.js`, `App.svelte`) liegen bereits im Verzeichnisbaum von PhantomSDR-Plus. Diese Anleitung baut alles Übrige darum herum auf.

> [!IMPORTANT]
> **Für eine normale Installation brauchen Sie diese Anleitung nicht.** `./install_rade.sh` im PhantomSDR-Plus-Ordner erledigt jeden Schritt unten für Sie — Systempakete, Python-Module, den radae-Build, die Prüfung der Modellgewichte und den Start des Sidecars — und läuft auf apt-, pacman-, dnf- und zypper-Systemen gleichermaßen. `./install.sh` und die vier Distributionsskripte bieten an, es im Rahmen der normalen Installation auszuführen. Folgen Sie dieser Anleitung nur für eine manuelle Einrichtung, für ein System, das das Skript nicht abdeckt, oder um einen Schritt von Hand zu reparieren.

> **Raspberry-Pi-Nutzer:** Dies ist auch Ihre Anleitung. Raspberry Pi OS ist Debian, folgen Sie also durchgehend den Debian-Blöcken und lesen Sie die Hinweise **Raspberry Pi / Bookworm**, wo sie auftauchen — sie behandeln die beiden Punkte, die sich auf einem Pi unterscheiden: PEP 668 und das CPU-only-torch-Wheel.

---

## Schritt 1 — Systempakete

Wählen Sie den Block, der zu Ihrer Distribution passt.

### Ubuntu / Debian / Raspberry Pi OS

```bash
sudo apt update
sudo apt install -y \
    build-essential cmake git \
    python3 python3-pip \
    nodejs npm \
    alsa-utils
```

### Fedora / RHEL / Rocky

```bash
sudo dnf install -y \
    gcc gcc-c++ cmake git \
    python3 python3-pip \
    nodejs npm \
    alsa-utils
```

### Arch / Manjaro

```bash
sudo pacman -Sy --needed \
    base-devel cmake git \
    python python-pip \
    nodejs npm \
    alsa-utils
```

### Node.js-Version prüfen (alle Distributionen)

Der Frontend-Build von RADE benötigt Node.js 22 oder neuer:

```bash
node --version
```

Liegt die Version unter 22.x, installieren Sie Node.js über `nvm` (jede Distribution, ohne root):

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.4/install.sh | bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm install 22 && nvm use 22 && nvm alias default 22
```

> **Nicht über NodeSource.** `deb.nodesource.com` und `rpm.nodesource.com` antworten inzwischen auf jedem Repository-Pfad mit HTTP 403. Die alte Zeile `curl -fsSL https://deb.nodesource.com/setup_NN.x | sudo -E bash -` funktioniert daher nicht mehr — und unter Debian/Ubuntu hinterlässt sie eine apt-Quelle, die jedes spätere `apt update` scheitern lässt. Aus demselben Grund verwenden die Installationsskripte `nvm`.

---

## Schritt 2 — Python-Pakete

### Ubuntu 24.04 und älter / Fedora / Arch

Auf diesen Systemen funktioniert ein einfaches `pip3 install`:

```bash
pip3 install websockets matplotlib numpy scipy

# torch — CPU-only build (~150–250 MB, avoids the ~3 GB CUDA wheel)
# Use this if the server has no GPU, which is the typical case for a WebSDR
pip3 install torch --index-url https://download.pytorch.org/whl/cpu
```

> Verfügt Ihr Server **doch** über eine NVIDIA-GPU mit installiertem CUDA, können Sie `--index-url` weglassen, um den vollständigen CUDA-Build zu erhalten. Für RADE bringt das keinen Leistungsvorteil — `radae_rxe.py` nutzt PyTorch nur für Matrixoperationen auf der CPU.

### Ubuntu 23.04+ / Debian Bookworm+ / Raspberry Pi OS (PEP-668-Systeme)

Diese Distributionen blockieren ein bloßes `pip3 install`. Ergänzen Sie die Option:

```bash
# All packages except torch
pip3 install --break-system-packages websockets matplotlib numpy scipy

# torch — CPU-only build
pip3 install --break-system-packages torch \
    --index-url https://download.pytorch.org/whl/cpu
```

> **Raspberry Pi / Bookworm — zwei Regeln, die beißen:**
>
> 1. Jedes `pip3 install` erfordert `--break-system-packages` (Durchsetzung von
> PEP 668). Ohne diese Option wird die Installation vollständig blockiert.
> 2. Ein einfaches `pip3 install torch` lädt das CUDA-Wheel (~3 GB) herunter.
> Auf einem Pi gibt es kein CUDA — nutzen Sie den CPU-Index, um das schlanke ARM64-Wheel (~150 MB) zu erhalten.

Alternativ nutzen Sie eine virtuelle Umgebung und vermeiden die Option ganz:

```bash
python3 -m venv ~/rade-venv
source ~/rade-venv/bin/activate
pip install websockets matplotlib numpy scipy torch \
    --index-url https://download.pytorch.org/whl/cpu
```

> Bei Verwendung eines venv stellen Sie allen folgenden `python3`-Aufrufen dieser Anleitung `source ~/rade-venv/bin/activate` voran oder verwenden den vollen Pfad `~/rade-venv/bin/python3`.

### Überprüfen

```bash
python3 -c "import websockets, matplotlib, torch, numpy, scipy; print('All OK')"
```

Erwartete Ausgabe:
```
All OK
```

---

## Schritt 3 — Das radae-Repository klonen und bauen

Der RADE-Decoder liegt in einem anderen Repository als codec2. `freedv_rx` aus codec2 unterstützt RADE v1 **nicht**.

```bash
# Remove any previous incomplete clone
rm -rf ~/radae

# Clone
git clone https://github.com/drowe67/radae.git ~/radae
cd ~/radae

# Build
mkdir build && cd build
cmake ..
make -j$(nproc)
```

### Prüfen, ob lpcnet_demo gebaut wurde

```bash
ls -la ~/radae/build/src/lpcnet_demo
```

Erwartet: Die Binärdatei ist vorhanden und ausführbar.

### Prüfen, ob die Modellgewichte vorhanden sind

```bash
ls ~/radae/model19_check3/checkpoints/checkpoint_epoch_100.pth
```

Erwartet: Die `.pth`-Datei wird aufgelistet. Die Gewichte liegen dem Repository bei — ein separater Download ist nicht nötig.

---

## Schritt 4 — Die Dekodierkette überprüfen

Dieser Schritt bestätigt, dass die vollständige Offline-Kette funktioniert, bevor sie mit dem Browser verbunden wird. Ausführen aus `~/radae`:

```bash
cd ~/radae
```

### 4a — Ein RADE-kodiertes Testsignal erzeugen

```bash
./inference.sh model19_check3/checkpoints/checkpoint_epoch_100.pth \
    wav/brian_g8sez.wav /dev/null \
    --rate_Fs --pilots --pilot_eq --eq_ls --cp 0.004 \
    --write_rx rx.f32 --auxdata
```

Warten Sie, bis der Vorgang beendet ist. Die letzten ausgegebenen Zeilen sollten lauten:
```
loss: 0.741 Auxdata BER: 0.012
```

### 4b — Dekodieren und abspielen

```bash
cat rx.f32 \
    | python3 radae_rxe.py \
        --model_name model19_check3/checkpoints/checkpoint_epoch_100.pth \
    | ./build/src/lpcnet_demo -fargan-synthesis - - \
    | aplay -f S16_LE -r 16000
```

Sie sollten eine Stimme hören. Die Ausgabe zeigt das Einrasten der Synchronisation:
```
  1 state: search     ...
  5 state: sync       ... SNRdB:  4.03 uw_err: 0
Playing raw data 'stdin' : Signed 16 bit Little Endian, Rate 16000 Hz, Mono
```

> **`underrun!!!`-Meldungen sind bei diesem Test zu erwarten und harmlos.** Sie entstehen, weil `radae_rxe.py` langsamer verarbeitet als die Datei-Ein-/ Ausgabe. Beim Live-Empfang treten sie nicht auf — der Browser liefert den Ton in Echtzeit.

### 4c — Prüfen, ob der Sidecar korrekt startet

```bash
python3 ~/PhantomSDR-Plus/rade_helper.py
```

Erwartete Ausgabe (keine WARNING-Zeilen):
```
[RADE] helper starting on ws://0.0.0.0:8074
[RADE] radae_rx.py    : /home/<user>/radae/radae_rxe.py
[RADE] model          : /home/<user>/radae/model19_check3/checkpoints/checkpoint_epoch_100.pth
[RADE] lpcnet_demo    : /home/<user>/radae/build/src/lpcnet_demo
[RADE] auxdata        : ON (default)
[RADE] torch threads  : 1 per instance (RADE_TORCH_THREADS to override)
[RADE] architecture   : per-connection (each user tunes independently)
[RADE] listening — waiting for PhantomSDR-Plus clients
```

Drücken Sie **Strg+C** zum Beenden.

> `<user>` in den Pfaden oben ist das Konto, mit dem Sie angemeldet sind — auf einem Standard-Image von Raspberry Pi OS lauten sie damit `/home/pi/radae/...`.

---

## Schritt 5 — Das PhantomSDR-Plus-Frontend bauen

```bash
cd ~/PhantomSDR-Plus/frontend

# Only if node_modules is missing:
npm install

cd ~/PhantomSDR-Plus
./recompile.sh
```

Achten Sie auf Parserfehler von Vite/acorn. Die gepatchten Dateien vermeiden bewusst `?.`, `??` und leere `catch {}`, um die acorn-Einschränkung einzuhalten.

---

## Schritt 6 — Steuerung des Sidecars

**Normalerweise brauchen Sie kein eigenes Steuerskript für RADE.** Die Startskripte (`start-rx888mk2.sh`, `start-airspyhf.sh`, `start-rtl.sh`, `start-rsp1a.sh`, `start-fobos-hf.sh`, `start-fobos.sh`, `start-hackrf.sh`) starten das Sidecar selbst, sobald der Server läuft, starten es neu, wenn es sich beendet, und melden seinen Zustand; `stop-websdr.sh` stoppt es zusammen mit dem Server. Gehen Sie direkt zu Schritt 7.

`rade.sh` wird weiterhin für den eigenständigen Betrieb mitgeliefert — das Sidecar ohne den PhantomSDR-Plus-Launcher zu betreiben oder es allein zu testen. Seine Befehle, sein Protokoll und die zugehörigen Watchdog-Fallstricke stehen unter [Steuerung des Sidecars](RADE_README.md#steuerung-des-sidecars).
---

## Schritt 7 — Port 8074 öffnen

Der Sidecar lauscht auf TCP-Port **8074**. Der Browser verbindet sich direkt mit diesem Port. Sie müssen ihn selbst öffnen.

### ufw (Ubuntu / Debian / Raspberry Pi OS)

```bash
sudo ufw allow 8074/tcp && sudo ufw reload
```

### firewalld (Fedora / RHEL / Rocky)

```bash
sudo firewall-cmd --add-port=8074/tcp --permanent
sudo firewall-cmd --reload
```

### iptables (jede Distribution, dauerhaft)

```bash
sudo iptables -I INPUT -p tcp --dport 8074 -j ACCEPT

# Ubuntu / Debian / Raspberry Pi OS — persist across reboots:
sudo apt install iptables-persistent
sudo netfilter-persistent save

# Fedora / RHEL — persist:
sudo service iptables save
```

### Router

Legen Sie eine NAT-/Portweiterleitungsregel an: **TCP 8074 → LAN-IP des Servers : 8074**

### Test von außen

Verwenden Sie **https://portchecker.co** und prüfen Sie Port 8074 gegen Ihren öffentlichen Hostnamen. Testen Sie **nicht** mit `curl` vom Server selbst — NAT- Hairpin liefert falsche „Connection refused"-Ergebnisse, selbst wenn der Port offen ist.

### Alternative — Nginx-Proxy (falls Port 8074 vom Provider gesperrt ist)

Fügen Sie innerhalb Ihres bestehenden `server {}`-Blocks ein:

```nginx
location /rade {
    proxy_pass         http://127.0.0.1:8074;
    proxy_http_version 1.1;
    proxy_set_header   Upgrade    $http_upgrade;
    proxy_set_header   Connection "upgrade";
    proxy_set_header   Host       $host;
    proxy_read_timeout 3600s;
}
```

```bash
sudo nginx -t && sudo nginx -s reload
```

Bearbeiten Sie danach `audio.js` innerhalb von `setRADEDecoding()`:

```js
// Change:
var helperUri = uri || ('ws://' + window.location.hostname + ':8074');
// To:
var helperUri = uri || ('ws://' + window.location.host + '/rade');
```

Bauen Sie das Frontend nach dieser Änderung neu (`./recompile.sh`).

---

## Schritt 8 — Den Server starten

Starten Sie PhantomSDR-Plus wie gewohnt. RADE wird **nicht** automatisch gestartet:

```bash
cd ~/PhantomSDR-Plus
./start-rx888mk2.sh      # or start-airspyhf.sh,
                         # start-rtl.sh, start-rsp1a.sh,
                         # start-fobos-hf.sh, start-fobos.sh,
                         # start-hackrf.sh
```

Verwenden Sie den Starter, der zu Ihrem Empfänger passt. Jeder bringt einen eigenen Watchdog und ein eigenes Protokoll mit; `./stop-websdr.sh` beendet den jeweils laufenden.

---

## Schritt 9 — RADE starten

```bash
cd ~/PhantomSDR-Plus
./rade.sh start
./rade.sh status
tail -f rade.log
```

Erwartetes Protokoll:
```
[RADE] sidecar starting at ...
[RADE] helper starting on ws://0.0.0.0:8074
[RADE] radae_rx.py    : /home/<user>/radae/radae_rxe.py
[RADE] model          : /home/<user>/radae/model19_check3/checkpoints/checkpoint_epoch_100.pth
[RADE] lpcnet_demo    : /home/<user>/radae/build/src/lpcnet_demo
[RADE] auxdata        : ON (default)
[RADE] torch threads  : 1 per instance
[RADE] architecture   : per-connection (each user tunes independently)
[RADE] listening — waiting for PhantomSDR-Plus clients
```

---

## Schritt 10 — RADE im Browser nutzen

1. Öffnen Sie Ihre PhantomSDR-Plus-Weboberfläche
2. Aktive Stationen finden Sie unter **https://qso.freedv.org**
3. Stimmen Sie auf die Anzeigefrequenz der Station ab
4. Wählen Sie unter **Decoder Options**:
   - **RADE v1 — RADEL (LSB)** für 40 m / 80 m / 160 m (≤ 10 MHz)
   - **RADE v1 — RADEU (USB)** für 20 m / 17 m / 15 m / 12 m / 10 m (> 10 MHz)
5. Klicken Sie auf **Decoder: ON**

Die Schritte 4 und 5 lassen sich durch einen einzigen Druck ersetzen: Die Tasten **RADEL** / **RADEU** stehen neben der Überschrift **Modes selector** sowie in den Popup-Fenstern **Modes** und **Bands**. Ein Druck wählt den Decoder aus, schaltet ihn ON und holt das RADE-Panel in den sichtbaren Bereich; ein erneuter Druck schaltet RADE ab. Siehe das [RADE-Handbuch](RADE_README.md).

| Anzeige | Bedeutung |
|---|---|
| 🔴 Rot — „Connecting to sidecar…" | Port 8074 nicht erreichbar oder Sidecar läuft nicht |
| 🟡 Gelb — „Searching for signal…" | Sidecar verbunden, noch kein RADE-Rahmen erkannt (etwa 1,5 s einplanen) |
| 🟢 Grün — „Synced · SNR x.x dB" | Dekodierung läuft — Sprache ist zu hören |

---

## Hinweis zur CPU-Last

Jeder RADE-Nutzer belegt etwa 8–10 % eines Kerns (die PyTorch-Threadzahl ist vom Sidecar auf 1 begrenzt). Falls Sie Tonaussetzer hören, erhöhen Sie auf 2 Threads:

```bash
RADE_TORCH_THREADS=2 ./rade.sh restart
```

| Gleichzeitige Nutzer | Ungefähre CPU-Last |
|---|---|
| 1 | ~9 % |
| 5 | ~45 % |
| 10 | ~90 % |
| 20 | ~180 % |

> Diese Werte wurden auf x86_64 gemessen. Ein Raspberry Pi dekodiert RADE problemlos, doch die Kosten pro Nutzer sind höher und die Tabelle oben lässt sich nicht übertragen — messen Sie Ihr eigenes Board mit `top`, während ein Nutzer synchronisiert ist, bevor Sie eine Nutzerzahl angeben.

---

## RADE künftig aktualisieren

```bash
cd ~/radae
git pull
cmake -S . -B build && make -C build -j$(nproc)

cd ~/PhantomSDR-Plus
./rade.sh restart
```

Weder ein Neubau des Frontends noch ein Serverneustart ist nötig, sofern sich nicht `rade_helper.py` selbst geändert hat.

---

*Getestet auf Ubuntu 24.04 (x86_64) und Raspberry Pi 4 / Raspberry Pi OS Bookworm (ARM64, Python 3.11).* *PhantomSDR-Plus-Fork: sv1btl/PhantomSDR-Plus.* *RADE entwickelt von David Rowe VK5DGR und dem FreeDV-Team — https://freedv.org*
