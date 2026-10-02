# RADE v1 — Anleitung zur manuellen Installation
### Raspberry Pi / Debian Bookworm (ARM64) · PhantomSDR-Plus

> **Voraussetzung:** Die gepatchten Dateien (`rade_helper.py`, `rade.sh`, `audio.js`, `App.svelte`) liegen bereits im Verzeichnisbaum von PhantomSDR-Plus. Diese Anleitung baut alles Übrige darum herum auf.

> [!IMPORTANT]
> **Probieren Sie zuerst das Skript.** `./install_rade.sh` im PhantomSDR-Plus-Ordner erledigt jeden Schritt unten für Sie und wird von `./install.sh` während der normalen Installation angeboten. Diese Anleitung ist für die Einrichtung von Hand gedacht — und für die Pi-Besonderheiten (PEP 668 und das CPU-only-torch-Wheel), falls das Skript auf Ihrem Board Probleme macht.

---

## Schritt 1 — Systempakete

```bash
sudo apt update
sudo apt install -y \
    build-essential cmake git \
    python3 python3-pip \
    nodejs npm \
    alsa-utils
```

---

## Schritt 2 — Python-Pakete

> **Wichtig — zwei Besonderheiten von Debian Bookworm:**
>
> 1. Jedes `pip3 install` erfordert `--break-system-packages` (Durchsetzung von
> PEP 668). Ohne diese Option wird die Installation vollständig blockiert.
> 2. Ein einfaches `pip3 install torch` lädt das CUDA-Wheel (~3 GB) herunter.
> Auf einem Pi gibt es kein CUDA — nutzen Sie den CPU-Index, um das schlanke ARM64-Wheel (~150 MB) zu erhalten.

```bash
# All packages except torch
pip3 install --break-system-packages websockets matplotlib numpy scipy

# torch — CPU-only build (~150 MB, no CUDA)
pip3 install --break-system-packages torch \
    --index-url https://download.pytorch.org/whl/cpu
```

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

> **`underrun!!!`-Meldungen sind bei diesem Test zu erwarten und harmlos.** `radae_rxe.py` verarbeitet langsamer als die Datei-Ein-/Ausgabe. Beim Live-Empfang treten sie nicht auf, weil der Browser den Ton in Echtzeit liefert.

### 4c — Prüfen, ob der Sidecar korrekt startet

```bash
python3 ~/PhantomSDR-Plus/rade_helper.py
```

Erwartete Ausgabe (keine WARNING-Zeilen):
```
[RADE] helper starting on ws://0.0.0.0:8074
[RADE] radae_rx.py    : /home/pi/radae/radae_rxe.py
[RADE] model          : /home/pi/radae/model19_check3/checkpoints/checkpoint_epoch_100.pth
[RADE] lpcnet_demo    : /home/pi/radae/build/src/lpcnet_demo
[RADE] auxdata        : ON (default)
[RADE] torch threads  : 1 per instance (RADE_TORCH_THREADS to override)
[RADE] architecture   : per-connection (each user tunes independently)
[RADE] listening — waiting for PhantomSDR-Plus clients
```

Drücken Sie **Strg+C** zum Beenden.

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

## Schritt 6 — Steuerskript rade.sh

```bash
chmod +x ~/PhantomSDR-Plus/rade.sh
```

Verfügbare Befehle:

```bash
cd ~/PhantomSDR-Plus
./rade.sh start      # start sidecar with self-restarting watchdog
./rade.sh stop       # stop sidecar + watchdog + all lpcnet_demo children
./rade.sh restart    # stop then start cleanly
./rade.sh status     # show running / stopped + process info
```

> **Verwenden Sie immer `./rade.sh stop`** — ein bloßes `pkill -f rade_helper.py` kommt gegen den Watchdog nicht an, der den Prozess binnen 3 Sekunden neu startet.

---

## Schritt 7 — Port 8074 öffnen

Der Sidecar lauscht auf TCP-Port **8074**. Der Browser verbindet sich direkt mit diesem Port. Sie müssen ihn selbst öffnen:

### Firewall — ufw

```bash
sudo ufw allow 8074/tcp && sudo ufw reload
```

### Firewall — iptables

```bash
sudo iptables -I INPUT -p tcp --dport 8074 -j ACCEPT

# Make permanent across reboots:
sudo apt install iptables-persistent
sudo netfilter-persistent save
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

Bauen Sie das Frontend nach dieser Änderung neu.

---

## Schritt 8 — Den Server starten

Starten Sie PhantomSDR-Plus wie gewohnt. RADE wird **nicht** automatisch gestartet:

```bash
cd ~/PhantomSDR-Plus
./start-rx888mk2.sh      # or start-airspyhf.sh,
                         # start-rtl.sh, start-rsp1a.sh
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
[RADE] radae_rx.py    : /home/pi/radae/radae_rxe.py
[RADE] model          : /home/pi/radae/model19_check3/checkpoints/checkpoint_epoch_100.pth
[RADE] lpcnet_demo    : /home/pi/radae/build/src/lpcnet_demo
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

*Getestet auf Raspberry Pi 4 / ARM64, Debian Bookworm, Python 3.11.* *PhantomSDR-Plus-Fork: sv1btl/PhantomSDR-Plus.* *RADE entwickelt von David Rowe VK5DGR und dem FreeDV-Team — https://freedv.org*
