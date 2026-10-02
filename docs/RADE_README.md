# RADE v1 Digital Voice for PhantomSDR-Plus

**RADE** (Radio AutoencoDEr) is FreeDV's flagship HF digital voice mode. It uses a Machine Learning / DSP hybrid (the FARGAN neural vocoder) to deliver high-quality speech over HF radio at SNRs as low as −2 dB, in just 1500 Hz of RF bandwidth — narrower than an SSB signal.

This document covers the complete integration of RADE v1 receive support into PhantomSDR-Plus, implemented as a Python sidecar (`rade_helper.py`) that bridges the browser to the `radae_rxe.py` + `lpcnet_demo` decode pipeline.

## Installing it — the short way

```bash
cd ~/PhantomSDR-Plus
./install_rade.sh
```

That is the whole installation. The script installs the system packages through whichever package manager the machine has (apt, pacman, dnf or zypper), falls back to pip for anything a distribution does not ship, upgrades `websockets` if the distro version is older than the 11.0 the sidecar needs, clones and builds radae, checks the model weights, rebuilds the frontend and starts the sidecar. On Ubuntu 22.04 it hands over to `install_rade_ubuntu22.sh` for you. `./install.sh` offers to run it as part of the normal PhantomSDR-Plus installation, so on a fresh machine RADE is already there.

**This document explains how RADE works and how to run it — it is not the install procedure.** If you need to do the installation by hand, on a system the script does not cover or to repair one step, follow the manual guide linked below; it is the single place the steps are written down. Everything here — the architecture, the patched files, the port, using RADE in the browser, the environment variables, troubleshooting and concurrency measurement — applies to every installation however it was made.

- **[Manual installation on Linux](RADE_General_INSTALL_MANUAL_LINUX.md)** - the by-hand route, step by step, covering Ubuntu, Debian, Fedora, Arch and Raspberry Pi OS

---

## Table of Contents

1. [Installing it — the short way](#installing-it--the-short-way)
2. [How It Works](#how-it-works)
3. [Architecture Overview](#architecture-overview)
4. [RADEL vs RADEU](#radel-vs-radeu)
5. [Prerequisites](#prerequisites)
6. [Installing by hand](#installing-by-hand)
7. [The Patched Files](#the-patched-files)
8. [Sidecar control](#sidecar-control)
9. [Port 8074](#port-8074)
10. [Using RADE in the Browser](#using-rade-in-the-browser)
11. [Verification and Debugging](#verification-and-debugging)
12. [Environment Variables](#environment-variables)
13. [Files Changed](#files-changed)
14. [Signal Flow Summary](#signal-flow-summary)
15. [Troubleshooting](#troubleshooting)
16. [Measuring Concurrency on Your Own Hardware](#measuring-concurrency-on-your-own-hardware)
17. [Updating RADE v1](#updating-rade-v1)

---

## How It Works

RADE v1 cannot run in the browser — it requires PyTorch and the FARGAN neural vocoder, which are too large for WASM. The solution is a Python sidecar process (`rade_helper.py`) that runs on the same server as PhantomSDR-Plus.

> **Important:** `freedv_rx` from the codec2 repository does **not** support RADEV1. The RADE decode pipeline lives entirely in the separate `radae` repository by David Rowe (VK5DGR). Do not attempt to use codec2's `freedv_rx` for RADE.

When you select RADE in the browser:

1. The frontend sets the underlying demodulation to USB or LSB — the C++ server demodulates the SSB signal as normal.
2. The raw demodulated PCM is tapped in `audio.js` **before** any mute or squelch gating — `radae_rxe.py` needs continuous input to maintain frame sync.
3. Each PCM chunk is zero-padded from real f32 to complex f32 (real + 0.0 imaginary) — this is what `radae_rxe.py` expects on stdin.
4. The sidecar pipes those samples into `radae_rxe.py`, which outputs vocoder features.
5. `lpcnet_demo -fargan-synthesis` converts the features into s16 speech at 16000 Hz.
6. The sidecar converts s16 → f32 and sends it back to the browser as binary WebSocket frames.
7. The browser plays the decoded speech via the Web Audio API at 16000 Hz.

The C++ server (`spectrumserver.cpp`) is not modified at all.

---

## Architecture Overview

```
┌────────────────────────────────────────────────────────────────────┐
│  Browser                                                           │
│                                                                    │
│  Decoder → "RADE v1 — RADEL (LSB)" / "RADEU (USB)"               │
│       │                                                            │
│  audio.js ── demod cmd (LSB/USB) ──────────► C++ spectrumserver   │
│       │                                              │             │
│       │  raw SSB PCM @ audioOutputSps ◄─────────────┘             │
│       │  (tapped before mute gate, zero-padded to complex f32)     │
│       │                                                            │
│       │  binary WebSocket ──► ws://host:8074                       │
│       ▼                                                            │
├────────────────────────────────────────────────────────────────────┤
│  rade_helper.py  (port 8074)                                       │
│                                                                    │
│  resample to 8000 Hz if needed                                     │
│  zero-pad real f32 → complex f32 pairs                             │
│       │ stdin pipe                                                  │
│       ▼                                                            │
│  radae_rxe.py  --model_name model19_check3/.../checkpoint_100.pth  │
│       │ stdout pipe (vocoder features f32)                         │
│       ▼                                                            │
│  lpcnet_demo  -fargan-synthesis  -  -                              │
│       │ stdout (s16 PCM @ 16000 Hz)                                │
│       │ converted → f32 by sidecar                                 │
│       │ binary WebSocket frames ──► browser                        │
│       ▼                                                            │
├────────────────────────────────────────────────────────────────────┤
│  Browser                                                           │
│                                                                    │
│  _radePlayPCM() → AudioContext.createBuffer(16000 Hz) → speaker   │
└────────────────────────────────────────────────────────────────────┘
```

---

## RADEL vs RADEU

RADE v1 is always transmitted over SSB. By convention:

| Mode  | Sideband | Use on bands                             |
|-------|----------|------------------------------------------|
| RADEL | LSB      | 160 m, 80 m, 40 m  (≤ 10 MHz)           |
| RADEU | USB      | 20 m, 17 m, 15 m, 12 m, 10 m (> 10 MHz) |

---

## Prerequisites

| Requirement | Version | Notes |
|---|---|---|
| PhantomSDR-Plus | any | with Vite/Svelte frontend |
| Linux | Ubuntu 24.04+ / Debian Bookworm+ | tested |
| Python | 3.8+ | for `rade_helper.py` and `radae_rxe.py` |
| radae repo | latest master | provides `radae_rxe.py` and `lpcnet_demo` |
| cmake | 3.10+ | to build `lpcnet_demo` from radae |
| PyTorch | 2.0+ | required by `radae_rxe.py` |
| Node.js | 16+ | for `npm run build` |
| websockets (Python) | 10–16+ | `pip3 install websockets` — all versions supported |
| matplotlib | any | required by `radae_rxe.py` at import time |
| numpy | 1.23+ | required; also enables resampling |
| scipy | any | optional, enables accurate resampling |

---

## Installing by hand

`./install_rade.sh` does the whole installation. When you want to do it yourself — a system the script does not cover, or one step to repair — the procedure lives in **[RADE v1 — Manual Installation Guide](RADE_General_INSTALL_MANUAL_LINUX.md)**, and only there. It covers Ubuntu, Debian, Fedora, Arch and Raspberry Pi OS in one pass:

| | |
|---|---|
| Step 1 | System packages, and the Node.js 22+ check |
| Step 2 | Python packages, including the PEP 668 flag and the CPU-only torch wheel |
| Step 3 | Clone and build the radae repository, verify `lpcnet_demo` and the model weights |
| Step 4 | Verify the decode pipeline offline, before wiring it to the browser |
| Step 5 | Build the PhantomSDR-Plus frontend |
| Step 6 | Sidecar control |
| Step 7 | Open port 8074 |
| Steps 8–10 | Start the server, verify RADE, use it in the browser |

The rest of this document assumes that is done.

---

## The Patched Files

Copy the following files from the patch set into your PhantomSDR-Plus repository.

### New file — place in the repository root, alongside the start script you use:

```
rade_helper.py
```

### Patched frontend files — place in `frontend/src/`:

```
audio.js
App.svelte
```

### What the patches do

**`audio.js`** — 5 changes:
- Constructor: 5 new RADE state fields (`decodeRADE`, `_radeSideband`, `_radeSocket`, `_radeCallback`, `_radeReady`, `_radeNextTime`)
- Pre-boost PCM save: `pcmArrayPreBoost` saved before the FLAC 300× gain boost so RADE receives original amplitude (the boost would saturate `radae_rxe.py`)
- `playAudio()`: RADE PCM tap using pre-boost audio, before mute/squelch gate
- `playAudio()`: `if (this.decodeRADE) return` guard — suppresses raw SSB playback while RADE decoded speech plays
- New methods: `setRADEDecoding()`, `setRADECallback()`, `_radePlayPCM()` with gapless scheduled playback via `_radeNextTime` clock (plays at **16000 Hz** — the output rate of `lpcnet_demo`)

**Each Svelte variant** — 6 changes:
- `demodulationDefaults`: RADEL `{type:'LSB', offsets:[2200,-700]}`, RADEU `{type:'USB', offsets:[-700,2200]}` — passband starts 700 Hz from carrier, 1500 Hz wide
- State variables: `radeEnabled`, `radeConnected`, `radeSynced`, `radeSnr`, `_radeDeactivate()`
- `_radeDeactivate()`: stops the decoder and **restores the band default mode** from `bands-config.js` — identical behaviour to FAX, NAVTEX, FSK deactivation
- `_deactivateAll()`: RADE cleanup line
- `activateSelectedDecoder()`: `radel` and `radeu` branches
- Decoder dropdown: two new `<option>` entries
- Status panel: connection dot, sync/SNR status, error banner

### Startup scripts

The receiver launchers (`start-rx888mk2.sh`, `start-airspyhf.sh`, `start-rtl.sh`, `start-rsp1a.sh`, `start-fobos-hf.sh`, `start-fobos.sh`, `start-hackrf.sh`) start the sidecar themselves once the server is up, and `stop-websdr.sh` stops it with the server. `rade.sh` remains for running the sidecar standalone — see [Sidecar control](#sidecar-control).

---

## Sidecar control

**You normally do not need a separate RADE control script.** The receiver launchers start the sidecar once the server is confirmed up, restart it if it exits, and report its state in their closing summary — `✔ RADE sidecar running`, or a `·` note explaining why it was not activated (not installed, `RADE_ENABLED=0`, or no `python3`). `./stop-websdr.sh` stops it along with the server. To run the server without RADE, start it with `RADE_ENABLED=0`.

`rade.sh` ships for standalone use — running the sidecar without the PhantomSDR-Plus launcher, or testing it on its own:

```bash
chmod +x ~/PhantomSDR-Plus/rade.sh
cd ~/PhantomSDR-Plus
./rade.sh start      # start sidecar with self-restarting watchdog
./rade.sh stop       # stop sidecar + watchdog + all lpcnet_demo children
./rade.sh restart    # stop then start cleanly
./rade.sh status     # show running / stopped + process info
```

Sidecar activity is logged to `~/PhantomSDR-Plus/rade.log`:

```bash
tail -f ~/PhantomSDR-Plus/rade.log
```

> **Do not mix the two while the server is running.** If a launcher's watchdog is active it will bring the sidecar back within about five seconds, so `./rade.sh stop` looks like it failed. To stop RADE while the server runs, either start the server with `RADE_ENABLED=0`, or stop everything with `./stop-websdr.sh`.

> If you do run `rade.sh` standalone, **always use `./rade.sh stop`** — `pkill -f rade_helper.py` alone will not beat its own watchdog, which respawns the process within 3 seconds.

---

## Port 8074

The sidecar listens on TCP port **8074** and the browser connects to it directly, so the port has to be reachable from outside. Opening it — ufw, firewalld, iptables, the router NAT rule, and the Nginx proxy to use when an ISP blocks the port outright — is [Step 7 of the manual guide](RADE_General_INSTALL_MANUAL_LINUX.md).

Two things worth repeating here, because they cost the most time:

```bash
# Is the sidecar listening?
ss -tlnp | grep 8074
```

> **NAT hairpin warning:** testing with `curl` from the server to its own public hostname often returns `Connection refused` even when the port is open — many routers do not loop traffic back. Always test from an outside machine, or use **https://portchecker.co**.

---

## Using RADE in the Browser

1. Open your PhantomSDR-Plus web interface
2. Find active stations at **[qso.freedv.org](https://qso.freedv.org)**
3. Tune to the station's dial frequency
4. In **Decoder Options**, select:
   - **RADE v1 — RADEL (LSB)** for 40 m / 80 m / 160 m
   - **RADE v1 — RADEU (USB)** for 20 m / 17 m / 15 m / 12 m / 10 m
5. Click **Decoder: ON**

### The RADEL / RADEU buttons (one-touch)

Steps 4 and 5 can be replaced by a single press. A pair of **RADEL** / **RADEU** buttons is available in three places:

- next to the **Modes selector** heading on the main panel;
- inside the **Modes** popup window;
- inside the **Bands** popup window.

Pressing one selects the decoder, switches the decoder ON, closes the popup you pressed it in, and scrolls the RADE panel into view. The button turns blue while RADE is running. **Press the same button again to switch RADE off** — the panel closes and mode and passband revert as described below. The buttons, the **Decoder Options** dropdown and the ON/OFF button all share the same state.

### Panel indicator states

| Indicator | Meaning |
|---|---|
| 🔴 Red — "Connecting to sidecar…" | Port 8074 unreachable or sidecar not running |
| 🟡 Yellow — "Searching for signal…" | Sidecar connected, no RADE frame detected yet |
| 🟢 Green — "Synced · SNR x.x dB" | Decoding — speech is playing |

### When you turn the decoder OFF

Mode and passband automatically revert to the correct default for the current frequency as defined in `bands-config.js` — identical to FAX, NAVTEX, FSK.

---

## Verification and Debugging

### Is the sidecar running?

```bash
ps aux | grep rade_helper | grep -v grep
ss -tlnp | grep 8074
```

### Watch live activity

```bash
tail -f ~/PhantomSDR-Plus/rade.log
```

When a browser connects:
```
[RADE] client connected: x.x.x.x:XXXXX
[RADE] x.x.x.x:XXXXX  sps=12000 sideband=LSB
[RADE] x.x.x.x:XXXXX spawning pipeline (torch_threads=1)
```

### Quick WebSocket smoke test

```bash
python3 - << 'EOF'
import asyncio, websockets, json

async def test():
    async with websockets.connect('ws://localhost:8074') as ws:
        await ws.send(json.dumps({'type': 'init', 'sps': 8000, 'sideband': 'LSB'}))
        print(await ws.recv())   # expect: {"type": "status", "connected": true}

asyncio.run(test())
EOF
```

### Browser console (F12)

```
[RADE] ▶ ENABLED LSB @ 12000 Hz → helper ws://localhost:8074
```
Good — WebSocket opened. The Hz value matches your server's `audioOutputSps` (typically 8000–12000 Hz).

```
[RADE] sidecar socket error
```
Port 8074 is unreachable — check firewall and router NAT rule.

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `RADE_HELPER_PORT` | `8074` | TCP port the sidecar listens on |
| `RADE_HELPER_HOST` | `0.0.0.0` | Bind address (`127.0.0.1` if behind a proxy) |
| `RADAE_DIR` | `~/radae` | Root of the radae repository |
| `RADE_MODEL` | `RADAE_DIR/model19_check3/checkpoints/checkpoint_epoch_100.pth` | Model weights |
| `LPCNET_DEMO` | `RADAE_DIR/build/src/lpcnet_demo` | lpcnet_demo binary |
| `RADE_AUXDATA` | `1` | Set to `0` to pass `--noauxdata` to `radae_rxe.py` |
| `RADE_TORCH_THREADS` | `1` | PyTorch/OpenBLAS threads per `radae_rxe.py` instance — limits CPU usage |
| `RADE_PIN_CORES` | `1` | Pin each decode pipeline to its own core set; `0` disables pinning |
| `RADE_CORES_PER_CLIENT` | `2` | Cores allocated per client when pinning is enabled |

---

## Files Changed

| File | Type | Notes |
|---|---|---|
| `rade_helper.py` | **New** | Python sidecar: WebSocket server + two-process decode pipeline |
| `frontend/src/audio.js` | Modified | 4 patches |
| `frontend/src/App.svelte` | Modified | 6 patches |
| `rade.sh` | **New** | RADE sidecar control script for standalone use (start/stop/restart/status) |
| `start-rx888mk2.sh` | Modified | starts, watchdogs and reports the sidecar; same for `start-airspyhf.sh`, `start-rtl.sh`, `start-rsp1a.sh`, `start-fobos-hf.sh`, `start-fobos.sh`, `start-hackrf.sh` |
| `stop-websdr.sh` | Modified | stops the sidecar along with the server |
| `spectrumserver.cpp` | **Unchanged** | No C++ modifications required |

---

## Signal Flow Summary

```
Antenna → RX-888 MK2 → PhantomSDR-Plus C++ server
                              │
                    FFT + DDC + SSB demodulation
                    (USB or LSB — set by RADEL/RADEU)
                              │
                    Opus/FLAC encode → WebSocket → Browser
                              │
                         audio.js decode()
                              │
                         playAudio(pcmArray)
                              │
               ┌──────────────┴────────────────────────────┐
               │  rawPcm tap (before mute gate)             │
               │  real f32 → zero-padded complex f32 pairs  │
               └──────────────┬────────────────────────────┘
                              │ WebSocket binary → ws://host:8074
                              ▼
                       rade_helper.py
                              │ resample to 8000 Hz if needed
                              │ stdin pipe
                              ▼
          radae_rxe.py  --model_name model19_check3/.../checkpoint_epoch_100.pth
          (PyTorch FARGAN neural vocoder, auxdata ON by default)
                              │ stdout pipe (vocoder features f32)
                              ▼
          lpcnet_demo  -fargan-synthesis  -  -
                              │ stdout: s16 PCM @ 16000 Hz
                              │ sidecar converts s16 → f32
                              │ WebSocket binary frames → browser
                              ▼
                  audio.js  _radePlayPCM()
                  AudioContext.createBuffer(16000 Hz)
                              │
                           Speaker 🔊
```

---

## Troubleshooting

### Red banner — "Sidecar not reachable"

```bash
# Is sidecar running?
ps aux | grep rade_helper | grep -v grep

# Start it manually for testing
python3 ~/PhantomSDR-Plus/rade_helper.py &

# Check port is open externally — use portchecker.co NOT curl from the server
# (curl from the server uses NAT loopback and gives false "Connection refused")
```

---

### Port 8074 closed on portchecker.co despite iptables rule

The ISP may be filtering the port, or the router NAT rule is missing. Options:

1. Try a different port: `RADE_HELPER_PORT=8080 python3 rade_helper.py`
2. Proxy through your existing public port via Nginx (see [Step 7 of the manual guide](RADE_General_INSTALL_MANUAL_LINUX.md))

---

### `radae_rxe.py: error: unrecognized arguments: model_path`

The model path must use `--model_name`, not a positional argument:

```bash
# WRONG — positional argument
python3 radae_rxe.py model19_check3/checkpoints/checkpoint_epoch_100.pth

# CORRECT — named argument
python3 radae_rxe.py --model_name model19_check3/checkpoints/checkpoint_epoch_100.pth
```

---

### `ModuleNotFoundError: No module named 'matplotlib'`

```bash
pip3 install matplotlib
```

`radae_rxe.py` imports matplotlib unconditionally at the top of the file.

---

### `ModuleNotFoundError: No module named 'torch'`

```bash
pip3 install torch
```

---

### `lpcnet_demo: No such file or directory`

The radae build did not complete. Rebuild:

```bash
cd ~/radae/build
cmake .. && make -j$(nproc)
ls src/lpcnet_demo     # should exist now
```

---

### `size mismatch` error in `inference.sh`

`model19_check3` requires `--auxdata` when encoding with `inference.sh`:

```bash
./inference.sh model19_check3/checkpoints/checkpoint_epoch_100.pth \
    wav/brian_g8sez.wav /dev/null \
    --rate_Fs --pilots --pilot_eq --eq_ls --cp 0.004 \
    --write_rx rx.f32 --auxdata    # ← required for model19_check3
```

Note: when **decoding** with `radae_rxe.py`, `--auxdata` is the default — do not pass it.

---

### Yellow indicator — "Searching for signal" — never syncs

- Confirm the correct sideband: RADEL for ≤ 10 MHz, RADEU for > 10 MHz
- Check [qso.freedv.org](https://qso.freedv.org) to confirm a station is currently transmitting
- RADE v1 uses 30 carriers in 1500 Hz BW — it appears as a compact cluster on the waterfall
- Allow up to 1.5 seconds for acquisition

---

### `underrun!!!` from aplay during the offline pipeline test

Expected during offline file testing only. `radae_rxe.py` processes slower than file I/O, causing the audio buffer to starve. This does not occur during live reception because the browser feeds audio at real-time rate.

---

### `ConnectionClosedError: received 1011 (internal error)`

The sidecar accepted the WebSocket connection but crashed internally before responding. This is caused by an incompatible version of `rade_helper.py` — an older version attempted to pass an asyncio `StreamReader` as a subprocess stdin, which fails silently and closes with error 1011.

**Fix:** Replace `rade_helper.py` with the current version from the patch set. The current version uses `os.pipe()` for the inter-process pipe and is compatible with websockets 10.x through 16.x+.

---

### Multiple simultaneous users

Each browser connection spawns its own independent `radae_rxe.py` + `lpcnet_demo` pair, so each user can tune to a different frequency freely.

By default `radae_rxe.py` uses **all available CPU cores** for PyTorch matrix operations, causing ~900% CPU usage per instance. `rade_helper.py` limits this with two optimisations:

1. `OMP_NUM_THREADS=1` (and MKL/OpenBLAS equivalents) — limits PyTorch to 1 thread
2. Numpy-vectorised audio conversion functions — eliminates Python loop overhead

Result: each instance uses roughly **~8–10%** of one core, sufficient for real-time RADE decode. If you hear audio dropouts, raise to 2 threads:

```bash
RADE_TORCH_THREADS=2 ./start-rx888mk2.sh     # or your receiver's launcher
# standalone: RADE_TORCH_THREADS=2 ./rade.sh restart
```

| Simultaneous RADE users | Approximate CPU |
|---|---|
| 1 | ~9% |
| 5 | ~45% |
| 10 | ~90% |
| 20 | ~180% |

On an i5-12450H (12 threads) with spectrumserver using ~42% and rx888_stream ~11%, you have roughly **1000% headroom** — enough for **20+ simultaneous** RADE users before CPU becomes a concern.

> **The table above assumes CPU cost scales linearly with users. Measurement says it does not.** A `rade_loadtest.py` run on that same i5-12450H showed per-listener CPU well below this table up to ~24 listeners, then rising sharply above it, with the machine stopped by **package temperature at 32 listeners** — not by CPU and not by bandwidth. Treat these figures as a rough guide for small numbers only and measure your own box: see [Measuring Concurrency on Your Own Hardware](#measuring-concurrency-on-your-own-hardware). Note the load test drives the pipeline with noise rather than a real RADE signal, so absolute CPU under genuine traffic may differ; the *shape* of the curve is the reliable part.

---

## Measuring Concurrency on Your Own Hardware

The numbers above are from one specific box. `rade_loadtest.py` (repository root) measures the same thing on **yours** — it ramps synthetic RADE listeners against the sidecar in steps and reports the last listener count your machine sustained before something gave way.

After each step it lets the box settle, then samples package temperature, total CPU, available RAM, swap, and the combined RSS of every `radae_rxe.py` and `lpcnet_demo` process. It stops at the first **knee** — whichever limit is breached first — and prints the last stable count.

### Requirements

```bash
sudo apt install python3-websockets python3-psutil
```

Run it **on the SDR host** (it reads local sensors and process memory), with spectrumserver and the RADE sidecar already running:

```bash
cd ~/PhantomSDR-Plus
python3 rade_loadtest.py
```

Ctrl-C tears down all connections cleanly at any point.

### Before the first run

Open the file and check the two blocks at the top:

- **`CONFIG`** — `WS_URL` defaults to `ws://127.0.0.1:8074`; change it if you moved the sidecar off its default port. `RADE_SPS` (12000) and `RADE_SIDEBAND` (`USB`) should match what your frontend reports.
- **`handshake_messages()`** — the single `init` frame it sends must match the RADE init in `frontend/src/audio.js`. If that handshake has drifted, every listener fails to connect and the test ends immediately with connect failures.

### Knee thresholds

Tune these in `CONFIG` to taste — they are deliberately conservative:

| Threshold | Default | Stops when |
|---|---|---|
| `TEMP_KNEE_C` | `85.0` | Package temperature reaches this ceiling |
| `MIN_AVAIL_MB` | `800` | Available RAM falls below this |
| `SWAP_GROWTH_MB` | `50` | Swap grows past the baseline taken at startup |
| `FAIL_LIMIT` | `3` | This many listeners fail to connect in one step |
| `MAX_LISTENERS` | `60` | Hard stop even if no knee is ever hit |

Ramp shape is controlled by `STEP` (listeners added per step, default 2), `SETTLE_S` (25 s of settling before sampling — this is what lets heat build) and `SAMPLE_S` (5 s CPU averaging window). A full run to the default 60-listener ceiling therefore takes roughly 15 minutes.

### Reading the results

Each step prints a line and appends a row to `rade_loadtest.csv`:

| Column | Meaning |
|---|---|
| `listeners` | Synthetic listeners connected at this step |
| `connect_fails` | Listeners that failed to establish or hold a connection |
| `pkg_c` | Package temperature, median of 5 samples (spike-resistant) |
| `cpu_pct` | **Whole-system** CPU percent, not per-listener |
| `avail_mb` | Available RAM |
| `swap_mb` | Swap in use |
| `dec_rss_mb` | Combined RSS of all decoder processes |
| `dec_procs` | Decoder process count — expect **2 per listener** (`radae_rxe.py` + `lpcnet_demo`) |

#### A measured run

On the i5-12450H referenced above, a full run ended like this:

```
KNEE at n=32: temp 91.0°C ≥ 85.0
Last stable concurrency: 30 RADE listeners
```

**Heat was the binding constraint**, and it was not close. At the knee there was still 7004 MB of RAM available — 6.2 GB clear of the `MIN_AVAIL_MB` cutoff — and zero connect failures on every step.

Two columns are worth reading carefully:

**`dec_rss_mb` overstates real memory cost.** It grows at a very steady 295 MB per listener (292, 294, 294 … 295 across all 16 steps), but *available RAM* only falls about **202 MB per listener**. The two processes behind each listener share library pages, and RSS counts those pages once per process. Extrapolating the `avail_mb` slope, the memory knee would arrive near **63 listeners** — past the 60-listener hard stop, so on this box it can never trip. Size memory from `avail_mb`, not from `dec_rss_mb`.

**`cpu_pct` is flat and then it is not.** It sits at ~5.3% of the whole machine through 24 listeners, then goes superlinear:

| Listeners | 24 | 26 | 28 | 30 | 32 |
|---|---|---|---|---|---|
| `cpu_pct` | 6.7% | 18.4% | 30.1% | 49.6% | 65.2% |

That is a 10× rise in CPU while listener count grows by a third. The inflection reproduces at the same point across runs, so treat it as a property of the box rather than noise — per-listener CPU cost is roughly 3.4% of one core below the inflection and about 20% above it. Do not extrapolate a per-user CPU figure taken at low listener counts.

> **The test has no CPU knee.** The four cutoffs are temperature, available RAM, swap growth and connect failures — CPU is recorded but never ends the run. In the run above CPU reached 65% and would have kept climbing had temperature not tripped first. If you care about a CPU ceiling, watch the column yourself or add a threshold.

> **What this does and does not prove.** Each synthetic listener streams low-amplitude random noise, not a real RADE signal. That is enough to make the full decode pipeline run and consume resources, so the resource figures are meaningful — but the test says nothing about decode *quality* or audio continuity under load. Confirm those with real listeners on a real signal.

### If cores saturate before the knee

RADE pins one thread hard per instance, so individual cores can reach ~90 °C while total CPU still looks idle. `rade_helper.py` spreads pipelines across cores round-robin to counter this. If a run shows early thermal knees, widen the core allocation per client:

```bash
RADE_CORES_PER_CLIENT=3 ./rade.sh restart
```

No file edit is needed — this is an environment variable (see [Environment Variables](#environment-variables)); `RADE_PIN_CORES=0` disables pinning entirely.

---

## Updating RADE v1

The PhantomSDR-Plus integration (`rade_helper.py`, frontend patches) is a bridge only — all RADE decode logic lives in the `radae` repository. Updates are therefore almost always a simple `git pull` + rebuild with no changes to PhantomSDR-Plus itself.

### Standard update (new code, same model)

```bash
# 1. Pull latest radae code
cd ~/radae
git pull

# 2. Rebuild lpcnet_demo (in case C code changed)
cd build
cmake ..
make -j$(nproc)

# 3. Restart the sidecar — no server restart needed
cd ~/PhantomSDR-Plus
./rade.sh restart
```

That is all. No frontend rebuild, no server restart, no file edits.

### New model weights only

If a new checkpoint is released (e.g. `model20`) without code changes, point the sidecar at the new weights using the env var — no file editing required:

```bash
# One-off: start with new model
RADE_MODEL=~/radae/model20/checkpoints/checkpoint_epoch_100.pth ./rade.sh start

# Or permanently — add to your shell profile (~/.bashrc):
export RADE_MODEL=~/radae/model20/checkpoints/checkpoint_epoch_100.pth
```

### What each type of change requires

| What changed in radae | Action required |
|---|---|
| New model weights (new `.pth` file) | Set `RADE_MODEL` env var, `./rade.sh restart` |
| Code change in `radae_rxe.py` | `git pull`, `./rade.sh restart` |
| `lpcnet_demo` C code changed | `git pull`, rebuild, `./rade.sh restart` |
| `radae_rxe.py` renamed or moved | Update `RADAE_RX` path in `rade_helper.py` (one line) |
| `--model_name` argument renamed | Update `radae_cmd` in `rade_helper.py` (one line) |
| New output sample rate (≠ 16000 Hz) | Update `SPS_OUT` in `rade_helper.py` + `createBuffer()` in `audio.js` |
| RADE v2 uses a different binary | Update `RADAE_RX` in `rade_helper.py` (one line) |

### Verifying the update worked

After restarting, confirm the new code is running:

```bash
# Check sidecar picked up new radae_rxe.py
./rade.sh status

# Tail log to see startup lines
tail -20 ~/PhantomSDR-Plus/rade.log
```

The log should show the model path you expect:
```
[RADE] model : /home/sv1btl/radae/model19_check3/checkpoints/checkpoint_epoch_100.pth
```

### Staying up to date

Subscribe to the radae repository releases page to be notified of new models and code updates:

```
https://github.com/drowe67/radae/releases
```

Check the FreeDV blog for announcements about new RADE waveforms and models:

```
https://freedv.org/blog/
```

---

*Developed and tested on PhantomSDR-Plus (sv1btl/PhantomSDR-Plus fork) with RX-888 MK2 on Ubuntu 24.04. The C++ server is not modified.*

*RADE is developed by David Rowe VK5DGR and the FreeDV team.* *See [freedv.org/radio-autoencoder](https://freedv.org/radio-autoencoder).*

---

### Full uninstall and fresh re-install

Here's the full teardown before re-running install_rade.sh:
1. Stop the sidecar cd ~/PhantomSDR-Plus && ./rade.sh stop
2. Remove the radae repo and build rm -rf ~/radae
3. Remove torch (installed in user local) pip3 uninstall -y torch rm -rf ~/.local/lib/python3.11/site-packages/torch*
4. Remove apt Python packages (optional — skip if used by other things) sudo apt-get remove -y python3-numpy python3-scipy python3-matplotlib python3-websockets sudo apt-get autoremove -y
5. Verify everything is gone python3 -c "import torch" 2>&1        # should say ModuleNotFoundError ls ~/radae 2>&1                        # should say No such file or directory
6. Fresh install chmod +x ~/PhantomSDR-Plus/install_rade.sh ~/PhantomSDR-Plus/install_rade.sh


