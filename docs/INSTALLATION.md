# PhantomSDR-Plus Installation Guide for System Operators

This comprehensive guide will walk you through installing and configuring PhantomSDR-Plus on your server.

---

## Table of Contents

1. [System Requirements](#system-requirements)
2. [Pre-Installation Preparation](#pre-installation-preparation)
3. [Installing PhantomSDR-Plus](#installing-phantomsdr-plus) — the installer, and [what it does](#what-the-installer-does)
4. [Autorun Spot Reporter (FT8/FT4/WSPR)](#autorun-spot-reporter-ft8ft4wspr)
5. [KiwiSDR Client Emulation (optional)](#kiwisdr-client-emulation-optional)
6. [Configuration](#configuration)
7. [SDR Device-Specific Setup](#sdr-device-specific-setup)
8. [Testing and Verification](#testing-and-verification)
9. [Setting Up Autostart](#setting-up-autostart)
10. [CPU Thermal Protection](#cpu-thermal-protection)
11. [Troubleshooting](#troubleshooting)

**Reference only — the installer already does all of this for you.** Read these sections when you are on a distribution none of the installers covers, or when you need to repair one piece by hand:

- [Installing Dependencies](#installing-dependencies)
- [Installing Node.js and npm](#installing-nodejs-and-npm)
- [Installing OpenCL](#installing-opencl-optional-but-recommended)
- [Building by hand](#building-by-hand-reference)
- [Installing Opus Audio Codec](#installing-opus-audio-codec)

---

## System Requirements

### Supported Operating Systems

**Primary (Recommended):**
- Ubuntu 22.04 LTS (Jammy), 24.04 LTS (Noble) and 26.04 LTS (Resolute) — 24.04 recommended
- Debian 12 (Bookworm) and Debian 13 (Trixie)

**Alternative:**
- Fedora (latest stable release)
- Arch Linux (rolling)
- openSUSE Tumbleweed (not Leap — see the note further down)

### Hardware Requirements

**Minimum Configuration:**
- CPU: Dual-core processor (2+ GHz)
- RAM: 4 GB
- Storage: 10 GB free space
- Network: 100 Mbps connection

**Recommended Configuration:**
- CPU: Quad-core or better (Ryzen 5 2600, Intel i5-6500T or better)
- RAM: 8 GB or more
- Storage: 20 GB+ SSD
- GPU: AMD/NVIDIA with OpenCL support (highly recommended)
- Network: 1 Gbps connection

**High-Performance Configuration:**
- CPU: 6+ cores (Ryzen 7, Intel i7 or better)
- RAM: 16 GB or more
- Storage: NVMe SSD
- GPU: Dedicated GPU with OpenCL/CUDA support
- Network: 1 Gbps or better

---

## Pre-Installation Preparation

### 1. Update Your System

```bash
# Ubuntu/Debian
sudo apt update
sudo apt upgrade -y
sudo reboot

# Fedora
sudo dnf update -y
sudo reboot
```

### 2. Verify Ubuntu Version

```bash
lsb_release -a
```

**Expected output should show:** Ubuntu 24.04 LTS

### 3. Check Available Disk Space

```bash
df -h
```

Ensure you have at least 10 GB free in your home directory.

### 4. Check CPU Information

```bash
lscpu
```

Note the number of cores/threads for configuration optimization.

---

## Installing Dependencies

> [!IMPORTANT]
> **You do not need this section for a normal installation.** `./install.sh` — or the installer for your distribution — does all of it for you; see [What the installer does](#what-the-installer-does). What follows is a reference for a manual setup, for a distribution none of the installers covers, or for repairing one piece by hand.


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

### Verify Installation

```bash
# Check if key dependencies are installed
pkg-config --modversion fftw3
cmake --version
meson --version
```

---

## Installing Node.js and npm

> [!IMPORTANT]
> **You do not need this section for a normal installation.** `./install.sh` — or the installer for your distribution — does all of it for you; see [What the installer does](#what-the-installer-does). What follows is a reference for a manual setup, for a distribution none of the installers covers, or for repairing one piece by hand.


PhantomSDR-Plus requires Node.js for building the frontend. We'll use NVM (Node Version Manager) for installation.

### 1. Install NVM

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.4/install.sh | bash
```

### 2. Load NVM

**IMPORTANT:** Close and reopen your terminal, or run:

```bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
```

### 3. Verify NVM Installation

```bash
nvm --version
```

Expected output: `0.40.4` or similar

### 4. Install Node.js

```bash
# Install Node.js 22 - the version every install script requires
nvm install 22

# Make it the default, so systemd units and cron see it too
nvm alias default 22

# Verify installation
node --version
npm --version
```

### 5. Optional: Install Additional Node Versions

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

## Installing OpenCL (Optional but Recommended)

> [!IMPORTANT]
> **You do not need this section for a normal installation.** `./install.sh` — or the installer for your distribution — does all of it for you; see [What the installer does](#what-the-installer-does). What follows is a reference for a manual setup, for a distribution none of the installers covers, or for repairing one piece by hand.


OpenCL dramatically improves performance by offloading FFT calculations to the GPU. This section covers Intel integrated graphics. For AMD/NVIDIA GPUs, refer to manufacturer documentation.

### Intel CPU with Integrated Graphics

#### 1. Install Base OpenCL Components

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

#### 2. Download Intel Compute Runtime

```bash
mkdir -p ~/neo
cd ~/neo

wget https://github.com/intel/compute-runtime/releases/download/19.07.12410/intel-gmmlib_18.4.1_amd64.deb
wget https://github.com/intel/compute-runtime/releases/download/19.07.12410/intel-igc-core_18.50.1270_amd64.deb
wget https://github.com/intel/compute-runtime/releases/download/19.07.12410/intel-igc-opencl_18.50.1270_amd64.deb
wget https://github.com/intel/compute-runtime/releases/download/19.07.12410/intel-opencl_19.07.12410_amd64.deb
wget https://github.com/intel/compute-runtime/releases/download/19.07.12410/intel-ocloc_19.07.12410_amd64.deb
```

#### 3. Install Intel OpenCL Runtime

```bash
sudo dpkg -i *.deb
```

If dependency errors occur:

```bash
sudo apt --fix-broken install
```

#### 4. Install OpenCL ICD Loader

```bash
sudo apt update
sudo apt install intel-opencl-icd
```

If errors occur:

```bash
sudo apt --fix-broken install
sudo apt install intel-opencl-icd
```

#### 5. Verify OpenCL Installation

```bash
sudo clinfo
```

You should see information about your OpenCL platform and devices. Look for:
- Number of platforms: 1 (or more)
- Platform name: Intel(R) OpenCL (or similar)
- Device type: GPU or CPU

#### 6. Reboot

```bash
sudo reboot
```

### AMD GPU OpenCL

For AMD GPUs, install ROCm:

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

### NVIDIA GPU OpenCL

For NVIDIA GPUs, install CUDA:

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

## Installing PhantomSDR-Plus

### Clone the Repository, Make Scripts Executable, Run the Installer

```bash
cd ~
git clone --recursive https://github.com/sv1btl/PhantomSDR-Plus
cd PhantomSDR-Plus
chmod +x *.sh
./install.sh
```

**⚠️ IMPORTANT:** After the installer completes, **restart your terminal** before continuing — the newly installed Node.js and Rust are not on your `PATH` until you do.

> **Already running PhantomSDR-Plus?** Do not install it again — update it. Fetch the updater once and run it; your configuration, markers, admin password, frequency list and chat history are never touched, and anything you edited yourself is put to you rather than overwritten:
>
> ```bash
> cd ~/PhantomSDR-Plus
> curl -fLO https://raw.githubusercontent.com/sv1btl/PhantomSDR-Plus/main/update.sh
> chmod +x update.sh
> ./update.sh
> ```
>
> That last line only *reports* what would change and writes nothing; `./update.sh --apply` does it. The *Updating PhantomSDR-Plus* chapter has the details. Re-running the installer over a working site is only needed when a rebuild fails because system packages are missing.

Use the script that matches your system. They do the same work and ask the same questions; only the package manager differs:

| System | Script |
|---|---|
| Ubuntu 22.04 / 24.04 / 26.04, Debian 12 / 13 | `./install.sh` |
| Fedora | `./install_fedora.sh` |
| Arch | `./install_arch.sh` |
| openSUSE Tumbleweed | `./install_opensuse.sh` |

> **One installer for every Debian and Ubuntu release.** `install.sh` reads `/etc/os-release` and the installed Boost version and adapts itself; the old `install_ubuntu22.sh`, `install-Deb12.sh` and `install_ubuntu26.sh` are gone. It sets `DEBIAN_FRONTEND=noninteractive`, so the `tzdata` that arrives with `python3-matplotlib` cannot stop the run to ask for your time zone and then swallow the answer meant for the next question. On Jammy it calls `install_rade_ubuntu22.sh` directly, because Jammy's `python3-websockets` is 10.1 and RADE needs 11.0 or newer. It knows where `intel-opencl-icd` lives on each release: in the repositories on 22.04 and 26.04, in `non-free` on Debian 12, and in Intel's own graphics repository on 24.04 and Debian 13. And where Boost is 1.87 or newer, the websocketpp header patch stops being optional — the installer verifies it landed and refuses to build without it. No newer compiler is ever needed: the stock GCC accepts `-std=c++23` on all five releases, so do not install `gcc-12` for this.

The installation runs in 17 clearly numbered steps, and every point where it waits for you is fenced by a **⌨️  YOUR INPUT IS NEEDED** banner, so a question cannot be mistaken for progress output scrolling past. The seven questions are listed up front, before anything is installed. Setting `PHANTOM_NONINTERACTIVE=1` answers all of them with their defaults; see the header of `install.sh` for the `PHANTOM_*` overrides.

**Every run writes `install.txt`.** When the installer finishes — or dies halfway — it writes a report to `install.txt` in the PhantomSDR-Plus directory: the result, each of the 17 steps as OK / SKIPPED / PARTIAL / FAILED, what it detected (distribution, Boost, compiler, Node.js), which components were installed, and every warning that came up. A run that fails leaves a report ending at the step that failed, with the reason and a note that the installer is safe to re-run. It is the first file to read when something did not work, and the first to attach to a bug report. Each run overwrites it, so keep a copy if you want to compare two installations.

> **Ubuntu 26.04, Arch and openSUSE Tumbleweed build, but have not been run on air.** All three ship a Boost newer than 1.87, which removed the `io_service` API that the vendored websocketpp 0.8.2 was written against. The patched headers the installer copies in bridge that gap (`io_context`, `executor_work_guard`, `boost::asio::post`, the modern resolver), and where Boost is 1.87 or newer the installer treats that patch as mandatory rather than optional — it verifies the copies landed and refuses to build without them. A complete install, receiver driver and all optional components included, has been verified end to end in containers on Boost 1.90 (Ubuntu 26.04), 1.91 (openSUSE Tumbleweed) and 1.92 (Arch). That proves the server compiles and starts — not that it serves a receiver for hours. Treat all three as untested in production until someone reports back.

> **openSUSE means Tumbleweed.** That is where `install_opensuse.sh` is verified. Leap 15.6 does not work: its repositories carry no `liquid-dsp-devel` at all, which the backend needs, and Boost is only available under versioned package names. Supporting Leap would mean adding third-party OBS repositories, so it is out of scope for now.

### What the installer does

Nothing has to be prepared by hand first — no dependency list to paste, no Node.js to fetch, no OpenCL packages to hunt down. It runs as 19 numbered steps and stops to ask you up to ten questions, each one fenced by a "YOUR INPUT IS NEEDED" banner — so either stay at the keyboard, or set `PHANTOM_NONINTERACTIVE=1` and let it answer everything with its defaults (see below), and allow anywhere from about twenty minutes to well over an hour depending on the machine and on how many extras you keep.

| # | Step | What you are asked |
|---|---|---|
| 1 | Lists the PhantomSDR-Plus services that are running right now — admin panel, reverse proxy, statistics server, receiver — and offers to stop them before anything is touched. Only a running start script counts as the receiver; one that is merely open in an editor is left alone. | confirm, **default yes** |
| 2–6 | Detects the distribution and installs every build dependency (compiler, meson/ninja, FFTW, Boost, FLAC, Opus, liquid-dsp, zlib/zstd, libcurl …), installing Node.js 22 through nvm if the system Node is missing or too old | nothing |
| 7 | Builds the backend with meson | nothing |
| 8 | Builds the driver for your receiver — RX888 MkII / RX888, RTL-SDR (Blog V4 asked separately), SDRplay RSP1A, RigExpert Fobos SDR, Airspy HF+, HackRF One, or none. Picking the RX888 **also installs the udev rules**, so the server never needs `sudo` for the device. The RSP1A, Fobos and Airspy HF+ run through SoapySDR: their choice runs `setup-rsp1a.sh`, `setup-fobos.sh` or `setup-airspyhf.sh`, which builds the driver and `rx_sdr` and installs a udev rule as well (see [Receivers on SoapySDR](#receivers-on-soapysdr-rsp1a-fobos-airspy-hf)) The HackRF One needs no SoapySDR: its choice runs `setup-hackrf.sh`, which installs the distribution's `hackrf` package and a udev rule. | which SDR you have |
| 9 | Opens `frontend/site_information.json` in your editor | your callsign, locator, hardware, antenna — **do not skip this** |
| 10–11 | Installs the frontend dependencies and builds the desktop and `/mobile` pages | nothing |
| 12 | Installs OpenCL, choosing the provider from the hardware it finds (Intel / AMD / NVIDIA GPU, or the x86 CPU runtime). If there is no OpenCL-capable device it says so and moves on | confirm, default yes |
| 13–15 | Installs the **admin panel**, the **FreeDV RADE V1 decoder** and the **statistics server** — all three by default | confirm each, default yes; each has its own questions |
| 16 | Re-applies the five patched websocketpp headers over the meson subproject and verifies they landed. Three of them are the Boost ≥ 1.87 compatibility work, without which the backend cannot compile on Boost 1.90; the other two are the project's own changes, one being the fix websdr.org registration needs | nothing |
| 17 | Installs the **KiwiSDR client emulation** by running `kiwi_install.sh`, so Kiwi clients such as AetherSDR can connect to this receiver. Patches the sources and adds `[kiwi_emulation]` to the config files in the repository root — see [KiwiSDR Client Emulation](Aether_config.md) | confirm, default yes |
| 18 | Runs `recompile.sh`, so everything is built from the patched sources | `[3] Both backend and frontend` → starting variant → `[1] build-all.sh` |
| 19 | Prints the summary: every step with its verdict, and every component with what was installed | nothing |

#### Installing unattended

Every question has an environment-variable override, and the installer also switches to defaults on its own when stdin is not a terminal (a pipe, a container, a CI job). This works the same way in all four installers — `install.sh`, `install_arch.sh`, `install_fedora.sh` and `install_opensuse.sh`. Set `PHANTOM_NONINTERACTIVE=1` and the whole run completes without asking anything:

| Variable | Effect |
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
| `PHANTOM_CURLPP=y\|n` | continue without curlpp — Arch and openSUSE only (default y) |
| `PHANTOM_FIX_CLOCK_SKEW=y\|n` | reset source file timestamps dated in the future, so meson can build (default y) |

The three sub-installers marked *n unattended* are interactive scripts of their own, so an unattended run skips them by default rather than hang on their prompts. Name them explicitly to include them:

```bash
# a complete unattended install for an RX888 MkII
PHANTOM_NONINTERACTIVE=1 PHANTOM_SDR=1 ./install.sh

# ... and with the admin panel, RADE and the statistics server too
PHANTOM_NONINTERACTIVE=1 PHANTOM_SDR=1 \
  PHANTOM_ADMIN=y PHANTOM_RADE=y PHANTOM_STATS=y ./install.sh
```

After a reboot the RX888 udev rules and any OpenCL driver are fully in effect; the installer tells you when a reboot or a re-login is needed.

When it sets up the admin panel, the installer offers to install the two systemd units as well, and **strongly recommends** accepting: the CPU over-temperature guard runs inside the panel, so without them a reboot or a crash leaves the machine unprotected. The offer is skipped automatically where systemd is not running (containers, WSL1, OpenRC) — see the [Admin Panel guide](ADMIN_PANEL_SETUP.md#step-3--start--stop--restart).

Each extra is a normal script you can also run on its own at any time — `./setup_admin.sh` ([manual](ADMIN_PANEL_SETUP.md)), `./install_rade.sh` ([manual](RADE_README.md)), `./install-stats-server.sh` ([manual](sdr-stats/README.md)), `./setup-rx888-udev.sh` and the receiver scripts `./setup-rsp1a.sh`, `./setup-fobos.sh`, `./setup-airspyhf.sh` and `./setup-hackrf.sh` — they are exactly what the installer calls.

### Building by hand (reference)

> [!IMPORTANT]
> **You do not need this section for a normal installation.** `./install.sh` — or the installer for your distribution — does all of it for you; see [What the installer does](#what-the-installer-does). What follows is a reference for a manual setup, for a distribution none of the installers covers, or for repairing one piece by hand.

Should you ever have to build without the installer — a distribution none of the scripts covers, or repairing a half-finished build:

#### Build the Backend

```bash
# Clean any previous builds, Configure build with optimization, Compile
rm -rf build
meson setup build --buildtype=release --optimization=3
meson compile -C build

# Verify binary was created
ls -lh build/spectrumserver
```

#### Build the Frontend

```bash
cd frontend

# Install dependencies, Fix any vulnerabilities, Build the frontend
npm install
npm audit fix
npm run build

# Return to project root
cd ..
```

### Verify Installation

```bash
# Check if binary exists
ls -lh build/spectrumserver

# Check if frontend was built
ls -lh frontend/dist/

# List important files
ls -lh *.sh *.toml
```

---

## Installing Opus Audio Codec

> [!IMPORTANT]
> **You do not need this section for a normal installation.** `./install.sh` — or the installer for your distribution — does all of it for you; see [What the installer does](#what-the-installer-does). What follows is a reference for a manual setup, for a distribution none of the installers covers, or for repairing one piece by hand.


Opus provides better audio quality and lower latency compared to FLAC.

### 1. Install libopus System Library

```bash
sudo apt-get update
sudo apt-get install -y libopus0 libopus-dev
```

### 2. Install Opus Decoder for Frontend

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

### 3. Verify Opus Installation

```bash
# Check if Opus system library is installed
pkg-config --modversion opus

# Check if Opus npm package is installed
cd frontend
npm list @wasm-audio-decoders/opus-ml
cd ..
```

---

## Autorun Spot Reporter (FT8/FT4/WSPR)

PhantomSDR-Plus ships an optional **autorun spot reporter** (in the `autorun/` directory). It decodes FT8/FT4/WSPR server-side straight off the receiver and uploads spots to the reporting networks:

- **FT8 / FT4 → PSK Reporter** (IPFIX/UDP)
- **WSPR → wsprnet.org** (HTTP)

It is controlled entirely from the **admin panel → "Spot Reporting"** tab, and **reporting is OFF by default** — nothing is transmitted or uploaded until you enable it there. The decoder runs as a separate Node.js daemon and taps the receiver's audio locally, so it adds no extra RF hardware.

### Requirements

| Requirement | Notes |
|-------------|-------|
| **Node.js 22+** | Same runtime the frontend build already needs — installed in the [Node.js step](#installing-nodejs-and-npm). |
| **`ws` + `cbor-x` npm packages** | Resolved through `autorun/node_modules`, a symlink to the frontend's `node_modules` (both packages are declared in `frontend/package.json`). |
| **`util-linux`** (`taskset`) | The admin "Start" button pins the daemon to the E-cores with `taskset`. Present on virtually every distro; the installers add it explicitly. |
| **Callsign + grid** | Read from `frontend/site_information.json` (`siteSysop` / `siteGridSquare`) unless overridden in the admin tab. Spots are uploaded under this callsign. |

> ⚠️ **Report only what you actually receive.** Spots are uploaded to public networks under your callsign — only enable bands/modes your receiver genuinely hears, and use your correct grid square.

### Automatic installation

`install.sh` (and the per-distro variants: `install_arch.sh`, `install_fedora.sh`, `install_opensuse.sh`) handle everything for you: they install Node.js 22 and `util-linux`, run the frontend `npm install`, and then create the `autorun/node_modules` symlink automatically. No extra steps are required — the feature is ready as soon as `install.sh` finishes.

### Manual installation

> [!NOTE]
> The installer already does this for you: it creates the symlink and installs `util-linux`. Use the steps below only to repair an installation by hand.

If you installed manually (Option B), create the symlink yourself after the frontend `npm install` so the daemon can resolve its dependencies:

```bash
cd ~/PhantomSDR-Plus

# 1. Frontend deps must be installed first (ws + cbor-x live there)
cd frontend && npm install && cd ..

# 2. Link the autorun daemon to the frontend's node_modules
ln -sfn ../frontend/node_modules autorun/node_modules

# 3. Ensure taskset is available (Debian/Ubuntu shown; use your package manager)
sudo apt install -y util-linux
```

> **Note:** `autorun/node_modules` is git-ignored, so a fresh `git clone` never contains it — the symlink must be (re)created after every clean checkout. The installers do this for you; the command above is only for manual setups.

### Verifying

```bash
# The symlink should point at ../frontend/node_modules
ls -l autorun/node_modules

# ws + cbor-x must resolve
ls -d frontend/node_modules/ws frontend/node_modules/cbor-x

# taskset must be on PATH
command -v taskset
```

Then open the admin panel, go to the **Spot Reporting** tab, set your identity, tick the bands/modes to decode, enable the destination(s), and press **Start**. A "📶 REPORTING" badge appears on the main waterfall whenever reporting is active. (PSK Reporter uploads batch every 5 minutes and wsprnet every 2 minutes, so a freshly started daemon shows "0 sent" for the first few minutes — that is normal.)

Two different counters are then shown, and it is easy to mistake one for the other. The **SPOTS UPLOADED PER DECODER** tiles count only the current run, so Stop/Start resets them to zero; the number beside each band/mode checkbox is that slot's **all-time** total, kept in `autorun-totals.json` so it survives restarts. See the [Admin Panel guide](ADMIN_PANEL_SETUP.md) for both, and for the **Graphs** page that plots CPU frequency, load, temperature and users online over the last 15 minutes to 24 hours.

> **If your machine runs hot**, the panel also carries a [Thermal Guard](ADMIN_PANEL_SETUP.md#thermal-guard) that stops the server when the CPU reaches a dangerous temperature and restarts it once cool. It derives its thresholds from your own CPU's critical trip point, so there is nothing to calculate, and it works whatever start/stop method you use. It is installed with the panel but starts in log-only mode: it records what it *would* have done and changes nothing until you enable it in Settings. Continuous decoding keeps a CPU busy around the clock, so it is worth reading the CRASH tab after a week of autorun to see how close your machine actually gets.

> **Server port is auto-detected.** The daemon taps spectrumserver's own `[server] port` directly (loopback + token, bypassing the proxy). It reads that port from the config file the running spectrumserver was launched with, so it works on any port with no configuration — the `[autorun] tap backend: …` line in `autorun.log` shows what it resolved. If your server wasn't running when the daemon started, or you use an unusual setup, pin it in `autorun.json`:
> ```json
> "server": { "host": "127.0.0.1", "port": 9002 }
> ```
> A wrong port shows up as `504` / `tap closed 1006` in `autorun.log` with `decodes` stuck at 0.

---

## KiwiSDR Client Emulation (optional)

Since v4.1.0 PhantomSDR-Plus can also answer the **KiwiSDR protocol**, so software written for a KiwiSDR — **AetherSDR**, `kiwiclient` and the rest — connects to your receiver directly, on the same host and port you already publish. It is off until `[kiwi_emulation] enabled = true` is added to the config your receiver runs with.

The installer offers it as step 17, or `./kiwi_install.sh` applies it to a tree that is already installed.

> **Full documentation: [KiwiSDR Client Emulation](Aether_config.md)** — what the bridge does, how to install it, every `[kiwi_emulation]` key, connecting a client, audio level, the S-meter, the waterfall rate, and a symptom table.

---

## Configuration

### 1. Choose Your Configuration File

Select the appropriate config file for your SDR:

- `config-rtl.toml` - RTL-SDR dongles
- `config-rsp1a.toml` - SDRplay RSP1A
- `config-airspyhf.toml` - Airspy HF+ Discovery
- `config-fobos-hf.toml` - RigExpert Fobos SDR, HF1/HF2 direct sampling (0-25 MHz)
- `config-fobos.toml` - RigExpert Fobos SDR, RF path (25-6000 MHz)
- `config-rx888mk2.toml` - RX888 MK2
- `config-hackrf.toml` - HackRF One
- `config.example.hackrf.toml` - HackRF One

For this example, we'll use RTL-SDR.

### 2. Edit Configuration File

```bash
nano config-rtl.toml
```

#### Key Settings to Configure

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

#### Sample Rate Guidelines

| Coverage | Sample Rate | FFT Size |
|----------|-------------|----------|
| 2 MHz | 2048000 | 131072 |
| 3.2 MHz | 3200000 | 131072 |
| 10 MHz | 10000000 | 1048576 |
| 30 MHz | 30000000 | 2097152 |
| 60 MHz | 60000000 | 4194304 |

### 3. Configure Site Information

```bash
nano frontend/site_information.json
```

Edit the following fields:

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

**IARU Regions:**
- **1**: Europe, Africa, Middle East, Northern Asia
- **2**: Americas (North, Central, South), Caribbean
- **3**: Asia-Pacific, Oceania

### 4. Customize Frequency Markers (Optional)

```bash
nano markers.json
```

Add your favorite frequencies, repeaters, and broadcast stations.

### 5. Edit Start Script

```bash
nano start-rtl.sh
```

The start script is a self-contained launcher + watchdog. Edit only the **RECEIVER CONFIGURATION** block near the top so the receiver arguments match your setup:

```bash
# ═══ RECEIVER CONFIGURATION (the only receiver-specific part) ═══
RX_LABEL="RTL-SDR"
RX_COMM="rtl_sdr"                       # process name to monitor/kill
CONFIG="$PHANTOMDIR/config-rtl.toml"    # your .toml
FIFO="$PHANTOMDIR/rtl.fifo"
RX_ARGS="${RX_ARGS:--f 145000000 -s 2048000 -}"   # receiver args (edit these)
```

Parameters inside `RX_ARGS`:
- `-f 145000000`: Center frequency (145 MHz)
- `-s 2048000`: Sample rate (2.048 MSPS)

`CONFIG` points at your `.toml`. You do **not** need to edit anything else in the script — the start/restart/watchdog/logging logic is generic. You can also override the receiver args at launch without editing the file: `RX_ARGS="-f 145000000 -s 2048000 -" ./start-rtl.sh` (`RX888_ARGS` for `start-rx888mk2.sh`).

---

## SDR Device-Specific Setup

### RTL-SDR

#### Install RTL-SDR Tools

```bash
sudo apt install -y rtl-sdr
```

#### Test RTL-SDR

```bash
rtl_test
```

Press Ctrl+C to stop. You should see sample rate information.

#### Edit Configuration

```bash
nano config-rtl.toml
```

Common settings for RTL-SDR:
```toml
sps = 2048000
frequency = 145000000
signal = "iq"
format = "u8"
```

### Receivers on SoapySDR (RSP1A, Fobos, Airspy HF+)

The SDRplay RSP1A, the RigExpert Fobos SDR and the Airspy HF+ all reach the server the same way: a SoapySDR driver for the device, and `rx_sdr` (from rx_tools) to stream its samples into `spectrumserver`. One script per receiver installs the whole chain:

| Receiver | Script | Installer option | Launcher | Config |
|---|---|---|---|---|
| SDRplay RSP1A | `./setup-rsp1a.sh` | 3 | `start-rsp1a.sh` | `config-rsp1a.toml` |
| RigExpert Fobos SDR | `./setup-fobos.sh` | 5 | `start-fobos-hf.sh` (HF) / `start-fobos.sh` (RF) | `config-fobos-hf.toml` / `config-fobos.toml` |
| Airspy HF+ | `./setup-airspyhf.sh` | 6 | `start-airspyhf.sh` | `config-airspyhf.toml` |

Each script:

- installs git, cmake, a compiler, libusb and **SoapySDR** from your distribution's own packages — it recognises apt, dnf, pacman and zypper, so it works on Debian/Ubuntu, Fedora, Arch and openSUSE alike;
- builds the receiver's driver from source into `sdr_drivers/` (not tracked by git);
- builds **rx_tools** for `rx_sdr`, unless `rx_sdr` is already installed — one copy serves every receiver;
- installs a **udev rule** and adds you to the `plugdev` group, so the start script never needs `sudo` for the device. **Log out and back in once** for the group to take effect;
- finishes by checking that SoapySDR really lists the driver, and stops with an error if it does not.

Run them as your normal user — they call `sudo` themselves. They are idempotent, so re-running one updates the driver sources with `git pull` and rebuilds. The installer calls exactly these scripts; on a station that is already installed, run the one for your receiver on its own. The shared parts live in `setup-sdr-common.sh`, which is not meant to be run by itself. Two optional overrides apply to all three: `SDR_USER=<name>` puts another account in `plugdev`, and `SDR_SKIP_DEPS=1` skips the package installation.

Check that the receiver is seen, with it plugged in:

```bash
SoapySDRUtil --find="driver=soapyMiri"   # RSP1A
SoapySDRUtil --find="driver=fobos"       # Fobos
SoapySDRUtil --find="driver=airspyhf"    # Airspy HF+
```

#### SDRplay RSP1A

`setup-rsp1a.sh` installs the **open-source driver**: libmirisdr-5, the reverse-engineered driver for the Mirics MSi2500/MSi001 chips inside the RSP1 and RSP1A, with its SoapySDR module SoapyMiri (`driver=soapyMiri`). It needs no background service and no root. The script also blacklists the kernel's `msi2500` and `msi001` drivers in `/etc/modprobe.d/blacklist-msi2500.conf`, because they claim the RSP1A as a V4L2 radio before `rx_sdr` can open it. If the device was plugged in while they were loaded, replug it once (or reboot).

SDRplay's own closed API (`driver=sdrplay`, with SoapySDRPlay and the `sdrplay` service) still works — the included file `instructions-for-rsp1a` describes that installation. `start-rsp1a.sh` chooses between the two by itself: if SoapySDR has the `sdrplay` driver it uses the API and restarts the `sdrplay` service first, otherwise it uses libmirisdr-5. A station set up on the API therefore keeps working unchanged. To force one, start it with `RX_DRIVER=miri` or `RX_DRIVER=sdrplay`. The chosen driver is written to `logwebsdr.txt` as `RSP1A driver: miri` or `RSP1A driver: sdrplay`.

#### RigExpert Fobos SDR

The Fobos streams **one path at a time**, so it has two launchers that share the watchdog lock like every `start-*.sh` — starting one stops the other:

- **`start-fobos-hf.sh`** — the HF1/HF2 inputs in direct sampling, 0-25 MHz, on port 9003. There is no local oscillator in this mode: the ADC digitises 0-25 MHz all the time (`-f 0` is intentional, and rx_sdr's *Failed to set center freq* warning is expected). `rx_sdr` delivers CF32 at 50 Msps; the small converter `cf32_to_real` (built by `setup-fobos.sh` from `cf32_to_real.c`) keeps the I channel and scales it to s16, so `config-fobos-hf.toml` uses `signal="real"` and `format="s16"`.
- **`start-fobos.sh`** — the RF path, 25-6000 MHz, IQ, on port 9002. Choose the window before the first start: `-f` (centre) and `-s` (sample rate) in the `RX_ARGS` line must match `frequency=` and `sps=` in `config-fobos.toml`. The shipped values (97 MHz, 20 Msps) are only a starting point to check that it runs.

> [!IMPORTANT]
> `config-fobos-hf.toml` ships with `accelerator="opencl"`: a 50 Msps stream through a 1M-bin FFT is as heavy as the RX888's 60 Msps, and on the CPU it drops samples and heats the machine. On a machine with no OpenCL device `spectrumserver` will not start with that setting — set `accelerator="none"` there.

SoapyFobosSDR needs the headers of both libfobos and libfobos-sdr-agile to build, so `setup-fobos.sh` builds both, even for the stock firmware. The Fobos support comes from a script another station wrote after bringing a Fobos up on PhantomSDR-Plus; the HF values in `config-fobos-hf.toml` are the ones that worked there.

#### Airspy HF+

`setup-airspyhf.sh` installs libairspyhf from the distribution where it is packaged (Debian and Ubuntu, Fedora, openSUSE) and builds it from source where it is not (Arch has it only in the AUR), then builds SoapyAirspyHF (`driver=airspyhf`). `start-airspyhf.sh` streams 912 ksps IQ in CS16, which `config-airspyhf.toml` reads as `format="s16"`. The included file `instructions-for-airspy` describes the manual route.

### RX888 MK2

#### Install RX888 Tools

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

#### Run rx888_stream Without sudo (udev rules)

By default the RX-888's Cypress FX3 USB device is only accessible to root, so `rx888_stream` would need `sudo`. Run the bundled helper once to install udev rules and add yourself to the `plugdev` group:

```bash
./setup-rx888-udev.sh          # re-runs itself with sudo automatically
```

It writes `/etc/udev/rules.d/99-rx888.rules` for all three Cypress FX3 product ids (`04b4:00f1`/`00f3` bootloader and `04b4:8613` firmware-loaded), reloads udev, and creates a stable `/dev/rx888` symlink. **Log out and back in** (for the group change) and **replug the device** once, then `rx888_stream` — and the `start-rx888mk2.sh` launcher — run without `sudo`. It is idempotent, so it's safe to re-run. To set up a different account: `RX888_USER=<name> ./setup-rx888-udev.sh`.

#### Edit Configuration

```bash
nano config-rx888mk2.toml
```

Common settings for RX888:
```toml
sps = 60000000
frequency = 0
signal = "real"
format = "s16"
fft_size = 4194304
```

### HackRF One

The HackRF needs nothing built: `hackrf_transfer`, from your distribution's `hackrf` package, streams the samples straight into `spectrumserver`. `./setup-hackrf.sh` (installer option 7) installs that package with apt, dnf, pacman or zypper and adds a udev rule plus the `plugdev` group, so `start-hackrf.sh` runs without `sudo` — log out and back in once afterwards.

```bash
./setup-hackrf.sh    # installs the hackrf package and the udev rule
hackrf_info          # with the HackRF plugged in: must list the board
```

`start-hackrf.sh` streams one window at a time. Choose it before the first start: `-f` (centre) and `-s` (sample rate) in its `RX_ARGS` line must match `frequency=` and `sps=` in `config-hackrf.toml`. `-l` and `-g` are the LNA (0-40 dB, 8 dB steps) and VGA (0-62 dB, 2 dB steps) gains, and `-a 1` switches the RF amplifier on. The shipped values (98 MHz, 20 Msps) are only a starting point to check that it runs.

`hackrf_transfer` writes **signed** 8-bit IQ, so the config needs `format="s8"`. `config.example.hackrf.toml` said `u8` until September 2026; with `u8` every sample is off by 128 and the waterfall shows only noise — check an older copy of it.

---

## Testing and Verification

### 1. Test Run

```bash
# For RTL-SDR
./start-rtl.sh
```

This starts the server **in the background** (it detaches and returns immediately) and begins logging to `logwebsdr.txt`.

### 2. Check for Errors

The script logs its progress to `logwebsdr.txt` — watch it live:

```bash
tail -f logwebsdr.txt
```

Look for:
- ✅ `Starting the initialization script of the PhantomSDR Server`
- ✅ `<receiver> running (PID …)`
- ✅ `Server started normally`
- ❌ `Server … FAILED …` or `ERROR: receiver binary '…' not found` (fix the receiver args/`.toml`, or install the receiver tool, then re-run the start script)

### 3. Access Web Interface

Open your browser to:
```
http://localhost:9002
```

(Replace port number with your configured port)

### 4. Verify Functionality

- Waterfall should be displaying
- Audio should play when clicking on signals
- S-meter should respond to signals
- User count should show "1"

### 5. Test from Another Device

From another computer on your network:
```
http://YOUR_SERVER_IP:9002
```

### 6. Check Resource Usage

```bash
# Monitor CPU usage
htop

# Monitor GPU usage (if OpenCL/CUDA enabled)
nvidia-smi  # For NVIDIA
radeontop   # For AMD

# Monitor network usage
iftop
```

### 7. Stop the Server

The server runs in the background under a watchdog, so **Ctrl+C won't stop it** (and the watchdog would just restart it). Use the shared stop script, which works for any receiver — it stops the watchdog first, then the receiver and `spectrumserver`:

```bash
./stop-websdr.sh
```

---

## Setting Up Autostart

### Using systemd (Recommended)

#### 1. Create Service File

```bash
sudo nano /etc/systemd/system/phantomsdr.service
```

Add the following content (adjust paths and user):

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

> The `--watchdog` process already auto-restarts the receiver/`spectrumserver` on its own; `Restart=always` is just a backstop for the rare case the watchdog itself exits. Because systemd supervises the server here, you can use `systemctl start/stop/restart` and `journalctl -u phantomsdr -f` in place of running the scripts by hand.

#### 2. Enable and Start Service

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

#### 3. Manage Service

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

### Using Screen (Alternative)

> Usually unnecessary: `./start-rtl.sh` already detaches into the background (via `setsid`) and keeps running after you log out, with its own watchdog. Screen is only handy if you specifically want an interactive session to run the foreground `./start-rtl.sh --watchdog` form.

#### 1. Install Screen

```bash
sudo apt install -y screen
```

#### 2. Start in Screen Session

```bash
screen -S phantomsdr
./start-rtl.sh
```

Press Ctrl+A, then D to detach.

#### 3. Reattach to Session

```bash
screen -r phantomsdr
```

---

## CPU Thermal Protection

> 📖 **Full manual: [THERMAL_GUARD.md](THERMAL_GUARD.md)** — the four modes and what a sysop must do for each, the standalone systemd service, enabling the throttle stage without root, testing and troubleshooting.

PhantomSDR-Plus ships a guard that stops the server if the CPU reaches a dangerous temperature and starts it again once it has cooled. It derives its thresholds from the critical trip point your own CPU publishes, so there is nothing to calculate, and it works whatever start/stop method you use.

**If you run the admin panel, you already have it** — it runs inside the panel and is configured on its Settings page. See the [Admin Panel guide](ADMIN_PANEL_SETUP.md#thermal-guard). The rest of this section is for installations **without** the panel.

### 1. Check what the guard sees on your machine

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

Only real CPU-die sensors are used (`coretemp`, `k10temp`, `zenpower`, `cpu_thermal`); `acpitz` and unlabelled thermal zones are ignored on purpose, because they often report a case or board temperature tens of degrees below the CPU. If this prints `sensor : NONE`, that machine cannot be protected — common on a VPS or inside a container — and the guard will stay inactive rather than pretend.

Nothing needs to be installed for this: `thermal_guard.py` uses only the Python standard library.

### 2. Configure it

The guard reads `admin_config.json` next to `thermal_guard.py`. Create it if you do not have one — with no panel installed you will not. The minimum useful file:

```json
{
  "sdr_process_name": "spectrumserver",
  "stop_script":  "stop-websdr.sh",
  "start_script": "start-rx888mk2.sh",
  "thermal_mode": "stop+restart"
}
```

- `thermal_mode` — `log` (record only, the default), `throttle`, `stop`, or `stop+restart`. **This is the one you must set**, because the guard ships inert: left alone it only writes what it *would* have done. You can also pass it on the command line as `--mode stop+restart`, which overrides the file — so if you are happy with every other default you need no config file at all.
- `stop_script` / `start_script` — how the guard stops and starts your server. Without a stop script it falls back to `SIGTERM`, then `SIGKILL` after 10 seconds, on `sdr_process_name`. Without a start script it stops but never restarts.
- Thresholds and timings can be set here too, with the same key names the panel uses — the full table is in the [Admin Panel guide](ADMIN_PANEL_SETUP.md#thermal-guard).

> **If systemd supervises your SDR server**, point `stop_script` at a small wrapper that runs `systemctl stop your-unit` rather than letting the guard signal the process directly. The guard will win either way — while the CPU is too hot it re-issues the stop every 2 seconds, so anything that revives the server is undone — but a clean stop beats a fight every two seconds.

### 3. Run it as a service

The repository includes a ready-made unit, `thermal-guard.service`. Edit `User=` and the two paths in it, then:

```bash
sudo cp thermal-guard.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now thermal-guard
systemctl status thermal-guard
```

`User=` must be an account allowed to run your start/stop scripts — normally the same user that runs the SDR server. **A guard running as a user that cannot stop the server leaves you unprotected while looking protected.**

To arm the guard from the unit instead of the config file, add `--mode` to `ExecStart`:

```ini
ExecStart=/usr/bin/python3 -u /home/sysop/PhantomSDR-Plus/thermal_guard.py --mode stop+restart
```

To run it without systemd:

```bash
cd ~/PhantomSDR-Plus
nohup python3 -u thermal_guard.py --mode stop+restart >> thermal.log 2>&1 &
```

`python3 thermal_guard.py --help` lists every option, including `--config` for a config file somewhere other than beside the script.

### 4. Watch it, then trust it

Everything the guard does is written to `crash.log` in the PhantomSDR-Plus directory, one event per line:

```
[THERMAL] warn: 89.0C (warn=88.0 crit=100.0) sustained 31s
[THERMAL] STOPPED server: 96.0C sustained 62s (stop=95.0 crit=100.0) — Started stop-websdr.sh
[THERMAL] lockout: process reappeared at 94.0C — re-stopped [3 time(s) so far]
[THERMAL] recovered: 74.0C held below 75.0 — lockout cleared
```

```bash
grep THERMAL crash.log
```

Leave `thermal_mode` at `"log"` for a week first and read that file after your heavy moments — a full rebuild, a hot afternoon. If nothing appears, your machine never came close. Then set the mode to `stop`.

Before relying on it, prove the whole path once by adding a fake reading above your stop threshold:

```json
"thermal_test_temp": 97
```

The guard treats it as real, so warn → stop → lockout → recover → restart all run on demand. Remove the line (or set it to `null`) to return to the real sensor. With the mode at `stop` this really does stop the server and disconnect your listeners, so do it when nobody is on — or run the test at `log`, where it shows what *would* have happened without touching anything.

---

## Troubleshooting

### Build Errors

#### Dependency Issues

```bash
# Ubuntu: Install missing dependencies
sudo apt install --fix-broken

# Fedora: Install missing dependencies
sudo dnf install <package-name>
```

#### Meson Configuration Fails

```bash
# Clean and reconfigure
rm -rf build
meson setup build --buildtype=release
```

#### `meson setup` dies with `ModuleNotFoundError: No module named 'mesonbuild'`

```
Traceback (most recent call last):
  File "/home/<user>/.local/bin/meson", line 3, in <module>
    from mesonbuild.mesonmain import main
ModuleNotFoundError: No module named 'mesonbuild'
```

Nothing is wrong with the source tree. A leftover `pip install --user meson` left a launcher script in `~/.local/bin`, which comes before `/usr/bin` on
`PATH` and therefore hides the working copy the package manager installed. A
distribution upgrade (Ubuntu 24.04 → 26.04, for example) moves Python to a new version, the old `site-packages` that held `mesonbuild` is no longer on the import path, and the script dies before it does any work. The same thing can happen to `ninja`.

The installer detects this and works around it for the duration of the run, warning you in the process, but repair the system:

```bash
rm -f ~/.local/bin/meson
hash -r
meson --version        # must print a version
```

Keep a pip-installed meson instead if you prefer, by reinstalling it for the Python this system has now:

```bash
python3 -m pip install --user --force-reinstall --break-system-packages meson
```

#### `meson setup` stops with `Clock skew detected`

```
ERROR: Clock skew detected. File /home/pi/PhantomSDR-Plus/build/../meson.build has a time stamp 10392.2144s in the future.
```

Nothing is wrong with the source tree: the system clock is behind the files. meson and ninja refuse to build when an input is newer than the current time, because they cannot tell which outputs are out of date. It happens on a Raspberry Pi with no cell in its RTC holder — every boot starts from the last time it knew, so a build launched before NTP catches up sees the whole tree dated in the future — and on any tree unpacked or copied from a machine whose clock is ahead.

Correct the clock first:

```bash
timedatectl                       # is the time right? is NTP synchronised?
sudo timedatectl set-ntp true
```

Wait a few seconds for it to settle, then run the installer again. It checks for this before calling meson and offers to reset the offending timestamps (`PHANTOM_FIX_CLOCK_SKEW=y|n`). By hand, from the source tree, that is:

```bash
find . -path ./build -prune -o -path ./.git -prune -o -newermt now -print0 | xargs -0r touch
```

#### The backend built but there is no web page

The symptom is an installation that looks like it mostly worked: `build/spectrumserver` exists, the server starts, and the browser gets nothing — because `frontend/dist/` was never produced. Look back through the installer output for:

```
[vite-plugin-top-level-await] missing field `type`
    at Compiler.printSync (node_modules/@swc/core/index.js:257:29)
error during build:
   ❌ Failed: Default
```

`vite-plugin-top-level-await` asks for `@swc/core` `^1.12.14`, so a fresh `npm install` resolves 1.16.0, whose `printSync()` rejects the syntax tree the plugin gives it. It has nothing to do with your distribution — every installer now pins the working version, and so does `frontend/package.json`. A machine installed before that pin was added keeps working until its `node_modules` is deleted, which is why this appears out of nowhere on a reinstall.

If you are repairing an older checkout by hand:

```bash
cd frontend
npm pkg set 'overrides.@swc/core=1.15.33'
npm install
./build-all.sh
```

### Runtime Errors

#### Port Already in Use

```bash
# Find process using port
sudo lsof -i :9002

# Kill process
sudo kill -9 <PID>
```

#### Permission Denied for SDR

```bash
# Add user to plugdev group
sudo usermod -a -G plugdev $USER

# Reload groups (or log out and back in)
newgrp plugdev
```

For an **RX-888 MkII** this isn't enough on its own — the Cypress FX3 device also needs udev rules. Run the bundled helper (installs the rules *and* adds you to `plugdev`), then log out/in and replug the device:

```bash
./setup-rx888-udev.sh
```

#### Audio Issues

```bash
# Try different codec
# Edit config file and change:
audio_compression = "flac"  # or "opus"

# Rebuild
cd frontend && npm run build && cd ..
```

### OpenCL Issues

#### clinfo Shows No Devices

```bash
# Verify drivers are loaded
sudo clinfo

# Check OpenCL ICD files
ls /etc/OpenCL/vendors/

# Reinstall drivers (Intel example)
sudo apt remove --purge intel-opencl-icd
sudo apt install intel-opencl-icd
```

#### Performance Not Improved

```bash
# Verify OpenCL is enabled in config
accelerator = "opencl"

# Try different device
# Add to config file:
[input.opencl]
device_id = 0  # Try 0, 1, 2, etc.
```

### Network Issues

#### Can't Access from Other Devices

```bash
# Check firewall
sudo ufw status
sudo ufw allow 9002/tcp

# Or disable firewall temporarily for testing
sudo ufw disable
```

#### High Latency

```bash
# Reduce waterfall size in config
waterfall_size = 512

# Increase buffer size
buffer_size = 16384

# Use Opus instead of FLAC
audio_compression = "opus"
```

### SDR Device Issues

#### RTL-SDR Not Found

```bash
# Check if device is recognized
lsusb | grep Realtek

# Test with rtl_test
rtl_test

# Try blacklisting DVB-T drivers
echo "blacklist dvb_usb_rtl28xxu" | sudo tee /etc/modprobe.d/blacklist-rtl.conf
sudo rmmod dvb_usb_rtl28xxu
```

#### SDRplay Not Found

`grep "RSP1A driver" logwebsdr.txt` shows which driver `start-rsp1a.sh` picked.

With the open driver (libmirisdr-5, `RSP1A driver: miri`):

```bash
# The kernel's msi2500 driver must not hold the device
lsmod | grep msi2500 && sudo modprobe -r msi2500 msi001

# Test with SoapySDR
SoapySDRUtil --find="driver=soapyMiri"
```

With SDRplay's API (`RSP1A driver: sdrplay`):

```bash
# Check API installation
systemctl status sdrplay

# Restart API
sudo systemctl restart sdrplay

# Test with SoapySDR
SoapySDRUtil --find="driver=sdrplay"
```

#### Fobos or Airspy HF+ Not Found

```bash
SoapySDRUtil --info | grep -i factories   # must list fobos / airspyhf
SoapySDRUtil --find="driver=fobos"         # or driver=airspyhf
id | grep plugdev                          # log out and back in if missing
```

If the driver is missing from the list, re-run `./setup-fobos.sh` or `./setup-airspyhf.sh`: it stops with the reason if the build or the SoapySDR check fails.

---

## Performance Optimization

### CPU Optimization

```toml
# Adjust thread counts based on CPU cores
[server]
threads = 4  # Set to number of cores

[input]
fft_threads = 4  # Set to number of cores
```

### Memory Optimization

```toml
# Reduce memory usage
[input]
waterfall_size = 512  # Lower value = less memory
fft_size = 65536      # Lower value = less memory
```

### Network Optimization

```toml
# Optimize for limited bandwidth
[input]
audio_compression = "opus"  # More efficient than FLAC
waterfall_compression = "zstd"  # Efficient compression
```

---

## Updating PhantomSDR-Plus

Since version 4.1.0 the repository ships **`update.sh`**, an updater that brings an installed receiver up to date with the published tree **without touching the files that make it your site**. It replaces the hand-written `git pull` script that earlier editions of this guide asked you to create, and it does not need git at all: the published tree is downloaded as a tarball and compared with yours file by file, so it works the same whether you cloned the repository, unpacked an `update.zip`, or copied the tree off a USB stick.

### If your installation does not have update.sh yet

An older tree will not contain the script. Fetch it once — it is the only step of this whole procedure you ever do by hand:

```bash
cd ~/PhantomSDR-Plus
curl -fLO https://raw.githubusercontent.com/sv1btl/PhantomSDR-Plus/main/update.sh
chmod +x update.sh
```

From then on everything — sources, frontend, documentation, installers, and `update.sh` itself — is brought in by the tool.

### Step 1 — see what would change (this writes nothing)

```bash
cd ~/PhantomSDR-Plus
./update.sh
```

It downloads the published tree, compares it with yours and prints a report. It writes nothing at all, so it is safe to run at any time, including on a receiver that is on the air. The exit status is `0` when you are already up to date and `10` when an update is waiting, so a cron job can tell you when there is something to do.

### Step 2 — apply it

```bash
./update.sh --apply
```

Three kinds of file are treated differently, and that difference is the whole point:

| Files | What happens |
|---|---|
| `config*.toml`, `markers.json`, `admin_config.json`, `autorun.json`, `frequencylist/`, `chat_history.txt`, `frontend/variant.json`, `frontend/site_information.json`, the logs, `build/`, `frontend/dist/` | **Never touched**, and never even shown in a prompt. These are what make the machine *your* receiver. |
| `start-*.sh`, `stop-websdr.sh`, the `*.service` units, `install*.sh`, `recompile.sh`, `setup_admin.sh`, `smeter_theme.sh`, `proxy.py`, `admin_server.py`, `thermal_guard.py`, `frontend/src/bands-config.js` | **Always asked about**, because these are the files a sysop has a reason to have edited. |
| Everything else | Updated, after a copy of the old file is saved in `.update-backups/`. |

For each file in the middle group you are shown the differences and given three choices:

```
  ❓ start-rx888mk2.sh  [K]eep mine / [u]pstream / [b]oth  (ENTER = Keep mine)
```

* **Keep mine** — your file is left exactly as it is.
* **upstream** — the new version is installed, and your file is backed up first.
* **both** — the new version is written beside yours as `start-rx888mk2.sh.new`, so you can
merge your own changes into it in your own time.

**What a first run feels like.** The first time you run it there is no record of which
version your files came from, so every file in the middle group above is put to you: about ten questions. Answer them like this:

| Your situation | Answer |
|---|---|
| You never edited that file | `u` — take the new version. This is the usual case. |
| You edited it (your own `RX888_ARGS`, CPU pinning, a tweaked unit) | `b` — yours is kept, and the new one lands beside it as `<file>.new` to merge later. |
| You are not sure | ENTER — yours is kept, nothing is lost, and you can compare afterwards. |

Your configuration is never part of this: the questions are only ever about scripts and service units.

`update.sh` records the version of every file it installs in `.update-state/`. From the second
run on it can therefore tell a file **you** edited from a file that is merely old, and it only stops to ask about the ones you actually changed.

Before writing anything it stops the receiver, the admin panel and the reverse proxy **of the installation it is updating** — a component serving another directory is listed and left running, so a second clone can be updated while the first one stays on the air — and when it has finished it starts back exactly what it stopped. If source or frontend files changed, it offers to run `recompile.sh` for you. Nothing is ever deleted: files that have gone from the repository are reported, and removed only if you ask with `--prune`.

### Undoing an update

```bash
./update.sh --restore LAST
```

Every overwritten file is kept in `.update-backups/<timestamp>/` with its own `restore.sh`, and the last three runs are retained.

### Other options

```bash
./update.sh --apply --yes     # never asks; every file you edited is KEPT
./update.sh --ref v4.1.0      # a tag, branch or commit instead of the current tree
./update.sh --list-excludes   # print the never-touch rules as they resolve here
./update.sh --verbose         # list every file, not only the first 40
```

You can add your own never-touch rules by putting one glob per line in `update-exclude.txt` in the root folder of the installation.

### If the rebuild fails on a very old installation

`update.sh` updates files, not system packages. If your tree is old enough that the build
now needs libraries you do not have, `recompile.sh` will stop with a compiler or meson error. That is not a broken update — you need the dependencies:

```bash
./install.sh
```

The installer is itself brought up to date by the same run, and your configuration survives it too.

### Updating by hand

If you would rather apply a file drop yourself:

```bash
cd ~
unzip -o update.zip
cd PhantomSDR-Plus
./stop-websdr.sh
cp -a ~/update/. .
chmod +x *.sh
./recompile.sh
./start-rx888mk2.sh          # or the start script for your receiver
```

Back up your configuration first — `config-*.toml`, `frontend/site_information.json`,
`admin_config.json` and `markers.json` — because a file drop cannot tell your edits from the
release's. That is exactly the problem `update.sh` exists to solve.

---

## Backup and Restore

### Files to Backup

- Configuration files: `*.toml`
- Site information: `frontend/site_information.json`
- Markers: `markers.json`
- Custom scripts: `start-*.sh`, `stop-*.sh`
- Chat history: `chat_history.txt`
- Background image: `frontend/src/assets/background.jpg`

### Backup Command

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

### Restore Command

```bash
tar -xzf phantomsdr-backup-YYYYMMDD.tar.gz
```

---

## Security Considerations

### Firewall Configuration

```bash
# Allow only necessary ports
sudo ufw allow 9002/tcp
sudo ufw enable
```

### Reverse Proxy (Optional)

Consider using nginx or Apache as a reverse proxy for:
- SSL/TLS encryption
- Domain name mapping
- Load balancing
- Access control

### User Limits

Edit `config.toml`:
```toml
[server]
max_users = 100  # Limit concurrent users
```

---

## Getting Help

### Resources

- **Documentation**: This guide, README.md, USER_GUIDE.md
- **GitHub Issues**: https://github.com/sv1btl/PhantomSDR-Plus/issues
- **Live Demo**: http://phantomsdr.no-ip.org:8900/

### Reporting Issues

When reporting issues, include:
1. Operating system and version
2. SDR device model
3. Configuration file contents
4. Error messages
5. System resource usage (CPU, RAM, GPU)

### Community Support

- Check existing GitHub issues before creating new ones
- Provide detailed information about your setup
- Include logs and error messages
- Be patient and respectful

---

## Appendix A: Complete Dependency List

### Ubuntu 24.04 Package List

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

## Appendix B: Configuration Examples

### Example 1: RTL-SDR for VHF/UHF

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

### Example 2: RX-888 mk2 for HF (0-30 MHz)

The receiver most sysops run. This is a complete `[input]` section rather than a fragment, with the values from the `config-rx888mk2.toml` that ships with the repository.

```toml
[input]
sps = 60000000            # 0-30 MHz by direct sampling
fft_size = 4194304        # see the note below
fft_threads = 8
brightness_offset = -9    # more negative if the waterfall shows black patches
frequency = 0             # baseband: the RX-888 samples from DC
signal = "real"           # not "iq" - direct sampling gives a real stream
accelerator = "opencl"    # "none" if there is no OpenCL runtime
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

Feed it from `rx888_stream`, which `start-rx888mk2.sh` does for you:

```bash
rx888_stream -f /path/to/SDDC_FX3.img -s 60000000 -g 50 -a 0 -m low --pga -d -r -o - \
  | build/spectrumserver --config config-rx888mk2.toml
```

**On `fft_size`:** 4194304 is the size to use at 60 MSPS. 8388608 doubles the waterfall resolution and doubles the memory and CPU cost of every transform with it, which on most machines buys sharper bins at the price of dropped frames. Start at 4194304 and only go higher if the server is comfortably idle.

### Example 3: HackRF for Wideband FM

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

**Installation complete! You should now have a fully functional PhantomSDR-Plus server.**

**73 de SV1BTL & SV2AMK**
