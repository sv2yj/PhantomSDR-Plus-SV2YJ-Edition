# RADE v1 — Manual Installation Guide
### Raspberry Pi / Debian Bookworm (ARM64) · PhantomSDR-Plus

> **Pre-condition:** The patched files (`rade_helper.py`, `rade.sh`, `audio.js`, `App.svelte`) are already placed in the PhantomSDR-Plus directory tree. This guide builds everything around them.

> [!IMPORTANT]
> **Try the script first.** `./install_rade.sh` in the PhantomSDR-Plus folder does every step below for you and is offered by `./install.sh` during the normal installation. This guide is here for doing it by hand, and for the Pi-specific details (PEP 668 and the CPU-only torch wheel) if the script runs into trouble on your board.

---

## Step 1 — System packages

```bash
sudo apt update
sudo apt install -y \
    build-essential cmake git \
    python3 python3-pip \
    nodejs npm \
    alsa-utils
```

---

## Step 2 — Python packages

> **Important — two Debian Bookworm rules:**
>
> 1. Every `pip3 install` requires `--break-system-packages` (PEP 668
> enforcement). Without it the install is blocked entirely.
> 2. Plain `pip3 install torch` downloads the CUDA wheel (~3 GB).
> On a Pi there is no CUDA — use the CPU-only index to get the lean ARM64 wheel (~150 MB).

```bash
# All packages except torch
pip3 install --break-system-packages websockets matplotlib numpy scipy

# torch — CPU-only build (~150 MB, no CUDA)
pip3 install --break-system-packages torch \
    --index-url https://download.pytorch.org/whl/cpu
```

### Verify

```bash
python3 -c "import websockets, matplotlib, torch, numpy, scipy; print('All OK')"
```

Expected output:
```
All OK
```

---

## Step 3 — Clone and build the radae repository

The RADE decoder lives in a separate repository from codec2. `freedv_rx` from codec2 does **not** support RADE v1.

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

### Verify lpcnet_demo was built

```bash
ls -la ~/radae/build/src/lpcnet_demo
```

Expected: the binary is present and executable.

### Verify model weights are present

```bash
ls ~/radae/model19_check3/checkpoints/checkpoint_epoch_100.pth
```

Expected: the `.pth` file is listed. The weights are bundled in the repository — no separate download needed.

---

## Step 4 — Verify the decode pipeline

This step confirms the full offline pipeline works before wiring it to the browser. Run from `~/radae`:

```bash
cd ~/radae
```

### 4a — Generate a RADE-encoded test signal

```bash
./inference.sh model19_check3/checkpoints/checkpoint_epoch_100.pth \
    wav/brian_g8sez.wav /dev/null \
    --rate_Fs --pilots --pilot_eq --eq_ls --cp 0.004 \
    --write_rx rx.f32 --auxdata
```

Wait for it to finish. The last lines printed should be:
```
loss: 0.741 Auxdata BER: 0.012
```

### 4b — Decode and play

```bash
cat rx.f32 \
    | python3 radae_rxe.py \
        --model_name model19_check3/checkpoints/checkpoint_epoch_100.pth \
    | ./build/src/lpcnet_demo -fargan-synthesis - - \
    | aplay -f S16_LE -r 16000
```

You should hear a voice. The output shows sync acquisition:
```
  1 state: search     ...
  5 state: sync       ... SNRdB:  4.03 uw_err: 0
Playing raw data 'stdin' : Signed 16 bit Little Endian, Rate 16000 Hz, Mono
```

> **`underrun!!!` messages during this test are expected and harmless.** `radae_rxe.py` processes slower than file I/O. They do not occur during live reception because the browser feeds audio at real-time rate.

### 4c — Verify the sidecar starts correctly

```bash
python3 ~/PhantomSDR-Plus/rade_helper.py
```

Expected output (no WARNING lines):
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

Press **Ctrl+C** to stop.

---

## Step 5 — Build the PhantomSDR-Plus frontend

```bash
cd ~/PhantomSDR-Plus/frontend

# Only if node_modules is missing:
npm install

cd ~/PhantomSDR-Plus
./recompile.sh
```

Watch for Vite/acorn parser errors. The patched files deliberately avoid `?.`, `??`, and bare `catch {}` to comply with the acorn constraint.

---

## Step 6 — Sidecar control

**You normally do not need a separate RADE control script.** The start scripts (`start-rx888mk2.sh`, `start-airspyhf.sh`, `start-rtl.sh`, `start-rsp1a.sh`) start the sidecar themselves once the server is up, restart it if it exits, and report its state; `stop-websdr.sh` stops it along with the server. Go straight to Step 7 unless you want to run the sidecar by hand.

`rade.sh` still ships for standalone use — running the sidecar without the PhantomSDR-Plus launcher, or testing it on its own:

```bash
chmod +x ~/PhantomSDR-Plus/rade.sh
cd ~/PhantomSDR-Plus
./rade.sh start      # start sidecar with self-restarting watchdog
./rade.sh stop       # stop sidecar + watchdog + all lpcnet_demo children
./rade.sh restart    # stop then start cleanly
./rade.sh status     # show running / stopped + process info
```

> **Do not mix the two while the server is running.** If a start script's watchdog is active it will bring the sidecar back within about five seconds, so `./rade.sh stop` looks like it failed. To stop RADE while the server runs, either use `RADE_ENABLED=0 ./start-<receiver>.sh` to start without it, or stop everything with `./stop-websdr.sh`.

> If you do run `rade.sh` standalone, **always use `./rade.sh stop`** — `pkill -f rade_helper.py` alone will not beat its own watchdog, which respawns the process within 3 seconds.

---

## Step 7 — Open port 8074

The sidecar listens on TCP port **8074**. The browser connects directly to this port. You must open it manually:

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

Add a NAT/port-forward rule: **TCP 8074 → server LAN IP : 8074**

### Test from outside

Use **https://portchecker.co** and check port 8074 against your public hostname. Do **not** test with `curl` from the server itself — NAT hairpin gives false "Connection refused" results even when the port is open.

### Alternative — Nginx proxy (if port 8074 is blocked by ISP)

Add inside your existing `server {}` block:

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

Then edit `audio.js` inside `setRADEDecoding()`:

```js
// Change:
var helperUri = uri || ('ws://' + window.location.hostname + ':8074');
// To:
var helperUri = uri || ('ws://' + window.location.host + '/rade');
```

Rebuild the frontend after this change.

---

## Step 8 — Start the server

Start PhantomSDR-Plus as usual. The launcher starts RADE for you, once the receiver and `spectrumserver` are both confirmed running:

```bash
cd ~/PhantomSDR-Plus
./start-rx888mk2.sh      # or start-airspyhf.sh,
                         # start-rtl.sh, start-rsp1a.sh
```

Use the launcher that matches your receiver. Each one includes its own watchdog and log; `./stop-websdr.sh` stops whichever is running, RADE included.

The launcher mirrors its log to the terminal and finishes with a summary line for the sidecar — `✔ RADE sidecar running`, or a `·` note explaining why it was not activated (not installed, `RADE_ENABLED=0`, or no `python3`). A missing sidecar never stops the server from starting.

---

## Step 9 — Verify RADE

The sidecar was already started by Step 8. Confirm it:

```bash
cd ~/PhantomSDR-Plus
pgrep -af rade_helper.py     # should print one python3 process
tail -f rade.log
```

Expected log:
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

## Step 10 — Using RADE in the browser

1. Open your PhantomSDR-Plus web interface
2. Find active stations at **https://qso.freedv.org**
3. Tune to the station's dial frequency
4. In **Decoder Options**, select:
   - **RADE v1 — RADEL (LSB)** for 40 m / 80 m / 160 m (≤ 10 MHz)
   - **RADE v1 — RADEU (USB)** for 20 m / 17 m / 15 m / 12 m / 10 m (> 10 MHz)
5. Click **Decoder: ON**

Steps 4 and 5 can be replaced by a single press: **RADEL** / **RADEU** buttons sit next to the **Modes selector** heading and inside the **Modes** and **Bands** popup windows. One press selects the decoder, switches it ON and scrolls the RADE panel into view; press the same button again to switch RADE off. See the [RADE manual](RADE_README.md).

| Indicator | Meaning |
|---|---|
| 🔴 Red — "Connecting to sidecar…" | Port 8074 unreachable or sidecar not running |
| 🟡 Yellow — "Searching for signal…" | Sidecar connected, no RADE frame detected yet (allow ~1.5 s) |
| 🟢 Green — "Synced · SNR x.x dB" | Decoding — speech is playing |

---

## CPU note

Each RADE user uses ~8–10 % of one core (PyTorch thread count capped at 1 by the sidecar). If you hear audio dropouts, raise to 2 threads:

```bash
RADE_TORCH_THREADS=2 ./start-rx888mk2.sh     # or your receiver's launcher
```

The launcher passes its environment through to the sidecar, so setting the variable on the start command is enough. (Standalone: `RADE_TORCH_THREADS=2 ./rade.sh restart`.)

---

## Updating RADE in future

```bash
cd ~/radae
git pull
cmake -S . -B build && make -C build -j$(nproc)

cd ~/PhantomSDR-Plus
./start-rx888mk2.sh          # or your receiver's launcher
```

Re-running the launcher restarts the sidecar along with the server. No frontend rebuild is needed unless `rade_helper.py` itself changed.

---

*Tested on Raspberry Pi 4 / ARM64, Debian Bookworm, Python 3.11.* *PhantomSDR-Plus fork: sv1btl/PhantomSDR-Plus.* *RADE developed by David Rowe VK5DGR and the FreeDV team — https://freedv.org*
