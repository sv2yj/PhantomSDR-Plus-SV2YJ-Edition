# PhantomSDR-Plus

**An enhanced open-source WebSDR server with advanced features and futuristic design**

PhantomSDR-Plus is a fork of PhantomSDR that provides a high-performance Software Defined Radio (SDR) web server capable of handling hundreds of simultaneous users. It features an enhanced user interface, multiple decoder support, band plan visualization, and compatibility with various SDR hardware platforms.

---

## 🌟 Key Features

### Performance & Scalability
- **Multi-user support**: Handle hundreds of concurrent users depending on hardware
- **High sample rate**: Support for SDRs up to 70 MSPS (real) / 35 MSPS (IQ)
- **Hardware acceleration**: OpenCL and CUDA support for GPU-accelerated processing
- **Optimized streaming**: Low-latency FLAC and Opus audio compression

### User Interface
- **Futuristic design**: Modern, responsive web interface
- **Mobile-optimized**: Enhanced mobile GUI for on-the-go listening
- **Band plan visualization**: Interactive waterfall with frequency band overlays
- **Customizable colormaps**: Multiple waterfall color schemes
- **Dual S-meter**: Choice between analog or digital signal meter display
- **One-touch decoder buttons**: A Decoders row sits on the main panel directly under the Modes selector (FT8, FT4, FT2, CW, WSPR, FAX, SSTV, NAVTEX, RTTY), with RADEL and RADEU beside the Modes selector itself and repeated in the Modes and Bands pop-ups. One press starts the decoder and opens its window, a second press stops it. The old Bandwidth row has been removed.
- **Channel scanner**: sweeps the band, or exactly what the waterfall is showing, and stops on the first channel rising a chosen number of dB above the band's own noise floor, then carries on by itself once that channel goes quiet. The step follows the mode and stops land on the channel grid (1 kHz SSB, 100 Hz CW, 5 kHz shortwave AM, 9/10 kHz medium wave, 9 kHz long wave); a *Skip empty* mode reads the waterfall spectrum and jumps straight to the signals; a lockout button drops an always-busy channel out of the sweep. Everything is local to the listener's browser, so scanning never moves the receiver for anyone else (see [User Guide](USER_GUIDE.md))
- **Receive diversity**: pairs the receiver with a second one somewhere else and plays whichever of the two currently has the better signal, so a fade at one site is covered by the other. The partner can be another PhantomSDR-Plus, a KiwiSDR, an UberSDR or a WebSDR; the first three need nothing beyond the listener's browser, and only a WebSDR needs a small relay on your own server. Alignment takes about fifteen seconds, and a remote SNR trim balances the two sites against each other. Each listener keeps a named list of second receivers in their own browser, in whatever order they choose, and can export it to a file and import it back (see [Receive Diversity](RECEIVE_DIVERSITY.md))

### Signal Processing
- **Multiple demodulation modes**: AM, FM, USB, LSB, CW, and more. A version 1 RADE decoder has also been implemented.
- **Synchronous AM detection**: Improved AM reception quality
- **Noise reduction**: Advanced NR, NC (Noise Cancel), and NB (Noise Blanker)
- **AGC options**: Multiple Automatic Gain Control modes
- **Auto squelch**: Automatic noise-based squelch threshold
- **AI noise reduction**: RNNoise neural network in the listener's browser, removes band noise from speech (voice modes only; see [User Guide](USER_GUIDE.md))

### Advanced Features
- **Digital decoders**: FT8, FT4, FT2, JS8, CW, QRSS Grabber, WSPR, HF FAX, SSTV, NAVTEX, FSK/RTTY, PSK31, Olivia and FreeDV RADE, each running on its own background thread so decoding never interrupts the audio (see [Decoders](DECODERS.md))
- **Decoder ID**: names the digital mode in the passband and offers the matching decoder in one click, from measured bandwidth, tone spacing, symbol rate and burst timing, with the frequency taken into account as supporting evidence — which is also what separates **FT8 from JS8**, two modes whose signals are identical. It only suggests, never switches by itself, and stays quiet rather than guessing when the signal is too weak. Fading does not silence it: when QSB breaks a two-minute WSPR transmission into fragments it still names the mode, reading the cadence from the whole listening history, and lowers the confidence it shows to say that the evidence is weaker. Between about 400 Hz and 2700 Hz the position in the passband makes no difference; outside that an amber **Recentre & retry** button appears, which moves the dial once and starts a fresh measurement. When you do accept a suggestion, the receiver is set up to work that mode: the tuned frequency moves to the middle of the waterfall, the view becomes about 100 kHz wide around it, and the sideband and passband become the ones the mode is worked with — the 3 kHz sub-band for the FT8 family, 1350–1650 Hz for WSPR, ±250 Hz and CW for Morse, and so on. Off by default, and about 0.5% of one core while running (see [Decoders](DECODERS.md))
- **Digital mode presets**: pressing FT8, FT4, FT2, JS8 or WSPR sets both the sideband and the passband
- **JS8 conversation panel**: multi-frame messages are reassembled into whole sentences
- **Statistics dashboard**: Real-time server and user statistics
- **Connected users list**: everyone listening, with a tune-to button on each row. Your own session is marked **you** — both in the pop-up window and when `users.html` is opened as a page of its own
- **Automatic spot reporting**: an autorun daemon decodes FT8, FT4 and WSPR on the server and uploads spots to PSK Reporter and WSPRnet, with two counters in the admin panel — per-decoder tiles for the current run, and an all-time total beside each band/mode checkbox
- **Server graphs**: an admin **Graphs** page plotting CPU frequency, CPU load, CPU temperature and users online over the last 15 minutes to 24 hours (see [Admin Panel](ADMIN_PANEL_SETUP.md))
- **Thermal protection**: a guard in the admin panel stops the server if the CPU overheats and restarts it once cool, with thresholds derived from your own CPU's critical trip point and no assumptions about how you start or stop the server; it ships in log-only mode, so it does nothing until you enable it (see the [Thermal Guard manual](THERMAL_GUARD.md))
- **KiwiSDR client emulation**: an optional bridge that answers the KiwiSDR protocol on the same host and port, so Kiwi software such as **AetherSDR** and `kiwiclient` connects to the receiver directly — with real retuning, waterfall and an S-meter on the same scale as the web one. Off until `[kiwi_emulation] enabled = true` is added to your config (see [KiwiSDR Client Emulation](Aether_config.md))
- **Transceiver control (CAT)**: keeps your own rig and your receiver window on the same frequency, mode and filter, in either direction or both — through the Rig menu of [Desktop PhantomSDR+](https://www.dropbox.com/scl/fo/kjwj96zg3kj7dgq4fjef9/APnA3c9hhv4hk3YMGIGjH7s?rlkey=jfiwklly63kv73poalx631pk3&st=m37uvaym&dl=0) (Icom, Yaesu, Kenwood, Elecraft, FlexRadio and QRP Labs directly, every other rig through Hamlib, or flrig) or the CATsync Tool for WebSDRs in a browser. Pages expose `catsync_*` functions for frequency, mode, filter width and mute. It works with PhantomSDR-Plus, KiwiSDR, PA3FWM WebSDR and UberSDR receivers (see [Rig Control](RIG_CONTROL.md))
- **Bookmark system**: Import/export frequency bookmarks
- **Keyboard shortcuts**: Efficient navigation and control
- **Mouse wheel support**: Intuitive frequency tuning
- **WebSDR directory**: Integration with https://sdr-list.xyz

---

## 📋 Supported Hardware

PhantomSDR-Plus supports a wide range of SDR receivers:

| Device | Sample Rate | Format | Interface |
|--------|-------------|--------|-----------|
| **RX888 MK2** | Up to 64 MHz | 16-bit | Native |
| **RTL-SDR** | Up to 3.2 MHz | 8-bit | rtl_sdr |
| **HackRF One** | Up to 20 MHz | 8-bit | hackrf_transfer |
| **Airspy HF+ / Discovery** | Up to 912 kHz | 16-bit | SoapySDR (SoapyAirspyHF) + rx_sdr |
| **SDRplay RSP1A** | Up to 10 MHz | 16-bit | SoapySDR (libmirisdr-5 + SoapyMiri, or the SDRplay API) + rx_sdr |
| **RigExpert Fobos SDR** | 50 MHz (HF direct sampling) / up to 20 MHz (RF) | 16-bit / 32-bit float | SoapySDR (SoapyFobosSDR) + rx_sdr |
| **Other devices** | Variable | Various | SoapySDR/rx_tools |

---

## 🚀 Quick Start

### System Requirements

**Minimum:**
- Ubuntu 22.04 LTS (recommended) or Fedora
- 2-core CPU
- 4 GB RAM
- 10 GB disk space

**Recommended:**
- Ubuntu 24.04 LTS
- 4+ core CPU (Ryzen 5 2600 or Intel i5-6500T or better)
- 8 GB RAM
- GPU with OpenCL support (optional but highly recommended)
- SSD storage

### Installation

```bash
# Clone the repository
git clone --recursive https://github.com/sv1btl/PhantomSDR-Plus
cd PhantomSDR-Plus

# Make scripts executable
chmod +x *.sh

# Run the installer
./install.sh
```

**Note:** After running `install.sh`, restart your terminal before proceeding.

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

Use `install_fedora.sh` on Fedora, `install_arch.sh` on Arch or `install_opensuse.sh` on openSUSE Tumbleweed — they do the same work with a different package manager. Every Debian and Ubuntu release is covered by `install.sh` itself.

Nothing has to be installed by hand first. The script installs the build dependencies and Node.js, builds the backend, builds the driver for the receiver you choose (and the RX888 udev rules with it), opens `site_information.json` for you to fill in, builds the frontend, installs OpenCL when the hardware supports it, then sets up the **admin panel**, the **FreeDV RADE decoder** and the **statistics server** — all three by default, answer `n` to skip any — and finishes with a full `recompile.sh`. It is interactive throughout and can take from twenty minutes to over an hour.

For the step-by-step description, see [INSTALLATION.md → What the installer does](INSTALLATION.md#what-the-installer-does).

---

## 📊 Performance Benchmarks

| Hardware | Sample Rate | CPU Usage | User Capacity |
|----------|-------------|-----------|---------------|
| Ryzen 5 2600 (all cores) | 64 MHz (32 MHz IQ) | 38-40% | 100+ users |
| AMD RX 580 (GPU) | 64 MHz (32 MHz IQ) | 28-35% | 100+ users |
| Intel i5-6500T (with OpenCL) | 60 MHz (30 MHz IQ) | 10-12% | 100+ users |

*Note: Per-user CPU overhead is minimal (<1% per user) when hardware acceleration is enabled.*

---

## 🎯 Usage

### Basic Operation

1. **Configure your SDR**: Edit the appropriate config file (e.g., `config-rtl.toml`)
2. **Update site information**: Edit `frontend/site_information.json`
3. **Start the server**: Run the appropriate start script:
   ```bash
   ./start-rtl.sh      # For RTL-SDR
   ./start-rsp1a.sh    # For SDRplay RSP1A
   ./start-airspyhf.sh # For Airspy HF+
   ./start-fobos-hf.sh # For RigExpert Fobos SDR, HF1/HF2 (0-25 MHz)
   ./start-fobos.sh    # For RigExpert Fobos SDR, RF (25-6000 MHz)
   ./start-hackrf.sh   # For HackRF One
   ./start-rx888mk2.sh # For RX888 MK2
   ```
   The RSP1A, Airspy HF+ and Fobos run through SoapySDR and `rx_sdr`; the installer sets up their driver when you pick them (options 3, 6 and 5), or run `./setup-rsp1a.sh`, `./setup-airspyhf.sh` or `./setup-fobos.sh` on an installed station. See [INSTALLATION.md](INSTALLATION.md#receivers-on-soapysdr-rsp1a-fobos-airspy-hf). The HackRF One (option 7) needs only the distribution's `hackrf` package: `./setup-hackrf.sh`.
   Each start script is **self-contained**: it stops any running instance, launches the receiver + `spectrumserver`, **detaches into the background** (survives closing the terminal), and runs a **watchdog** that auto-restarts the chain if it dies. Progress is logged to `logwebsdr.txt` — watch it with `tail -f logwebsdr.txt`. Re-running a start script is a clean restart, and a `flock` lock ensures only one receiver runs at a time. Optional: `SPECTRUM_CORES=0-3` to pin CPUs, `RX_ARGS="…"` to override receiver args without editing the file (`RX888_ARGS` for RX888), `RX_DRIVER=miri|sdrplay` to choose the RSP1A driver.
4. **Access the interface**: Open your browser to `http://localhost:PORT` (default varies by config)

### Stopping the Server

One shared stop script works for **every** receiver — it stops the watchdog first (so it can't auto-restart), then the receiver and `spectrumserver`:

```bash
./stop-websdr.sh
```

---

## 🔧 Configuration

### Essential Configuration Files

1. **`config-[device].toml`** - Server and SDR configuration
   - Server settings (port, threads, HTML root)
   - Input settings (sample rate, FFT size, frequency)
   - WebSDR registration options
   - Audio compression settings
   - After modifying it, restart the server.

2. **`frontend/site_information.json`** - Public site information
   - Operator details (callsign, email, location)
   - Hardware and antenna information
   - Region and bandwidth settings
   - Chat enable/disable
   - After modifying it, run recompile.sh in a terminal.

3. **`markers.json`** - Frequency markers and band plan

4. **`frontend/src/bands-config.js`** - Band plan configuration This file is located in frontend/src/bands-config.js and defines the bands the SysOp creates. <br />
- You will see something like the following, and you are free to edit it as you like:
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
   **Where:** <br />
   - **ITU** is the region in which the server is located,
   - **min & max** are the waterfall brightness limits for the given band,
   - **initFreq** is the initial frequency to tune to when the band is selected,
   - **publishBand** sets whether the band is shown: 1 for amateur bands, 2 for broadcast bands,
   - **startFreq & endFreq** define the band limits,
   - **stepi** is the default mouse-wheel step for the band, and **modes** is the preferred default mode for the band.

- After making changes, **run recompile.sh in a terminal** from the PhantomSDR-Plus folder.

For configuration examples, see the included sample files:
- `config-rtl.toml` - RTL-SDR configuration
- `config-rsp1a.toml` - SDRplay RSP1A configuration
- `config-airspyhf.toml` - Airspy HF+ configuration
- `config-fobos-hf.toml` / `config-fobos.toml` - RigExpert Fobos SDR configuration (HF / RF)
- `config-hackrf.toml` - HackRF One
- `config-rx888mk2.toml` - RX888 MK2 configuration

---

## 🌊 Waterfall Floor — `waterfall.sh`

`waterfall.sh` (in the repository root) changes the **default minimum waterfall level** in dB — the floor the waterfall starts from on a fresh visit.

That value lives in two source files at five different places (`frontend/src/waterfall.js` → `this.minWaterfall`, and `frontend/src/App.svelte` → the initial `let min_waterfall`, the two "min" reset cases and the bookmark default). Editing them by hand is easy to get wrong, so the script does it for you. It never uses hard-coded line numbers — every spot is located by pattern, so it keeps working after the sources are updated.

- A **higher** value (e.g. `-15`) gives a **darker** waterfall.
- A **lower** value (e.g. `-45`) gives a **brighter** waterfall.

```bash
./waterfall.sh              # interactive — shows the current values and asks for the new one
./waterfall.sh -v -15       # set the value without being asked
./waterfall.sh -v -15 -y    # ... and skip every confirmation
./waterfall.sh -s           # show the current values only, change nothing
```

Before editing, it timestamps a backup of both files (`*.bak-YYYYmmdd-HHMMSS`) and prints the restore command. Only literals equal to the value currently in use are touched, so unrelated numbers in those files can never be rewritten by accident. If the new value does not show up afterwards, the script restores the backups by itself and exits with an error. It also warns you when the two files are out of sync and sets both.

- After the change the frontend must be rebuilt — the script offers to run `recompile.sh` for you (with `-y` it skips the rebuild, so run `./recompile.sh` yourself when you are ready).

---

## 🎨 Customization

### Changing the Background Image

Replace `frontend/src/assets/background.jpg` with your preferred image (keep the same filename).

- After modifying it, run recompile.sh in a terminal.


### Audio Codec Selection

Choose between FLAC and Opus in your `.toml` configuration:
```toml
[input]
audio_compression="opus"  # or "flac"
```
- After modifying it, restart the server.


### S-meter calibration

The two meters are deliberately on **separate chains**, so they are tuned with two different knobs.

#### The two knobs

Both live in the `[input]` section of the config the server is started with (`config.toml`, `config-rx888mk2.toml`, etc.):

```toml
[input]
smeter_offset=5         # digital bar only
analog_smeter_offset=5  # analog needle only
```

They are read in `src/websocket.cpp` and sent to the browser in the first `basic_info` frame, so **a server restart is enough** — no frontend rebuild is required.

#### Analog chain

```
displayed dBm = -130 + (rawDb + analog_smeter_offset + 130) x 1.1
```

- The visual gain of 1.1 is applied *after* the offset, pivoting at -130 dBm. So one unit of `analog_smeter_offset` moves the reading by 1.1 dB. To shift the display by X dB, use `analog_smeter_offset ~= 0.91 x X`. The TOML value is parsed as an integer, so only whole steps are available.
- The needle law (`powerFromDbm` in `frontend/src/lib/SMeterAnalog.svelte`) puts **S9 at -73 dBm**, at 60 of 100 needle units, with a `pow(...,0.6)` curve from -130 to -73 below S9 and a `pow(...,0.8)` curve from -73 to -13 (S9+60) above it.
- It is **not** a linear 6 dB per S-unit scale, so S9 is the meaningful calibration anchor — the marks below S9 will not track a signal generator in 6 dB steps.

#### Digital chain

```
value    = (rawDb / 150) x 100 + smeter_offset   -> clamped to [-100, 0]
segments = round((value + 100) x 35 / 100) + DIGITAL_BAR_TRIM
```

- Note the `/150 x 100`: the digital scale is **compressed to 2/3**, and it never sees `analog_smeter_offset` or the 1.1 visual gain. That is why the bar and the needle never agree exactly — it is intentional.
- 35 segments over 100 units means one segment is 2.86 offset units, roughly 4.3 raw dB. So `smeter_offset=3` is about one segment.
- `DIGITAL_BAR_TRIM` in `frontend/src/lib/SMeterDigital.svelte` (currently 0) shifts the bar by whole segments. Changing it is a source edit and **does** require a frontend rebuild.

#### The LED windows are analog-driven in both meters

The dBm / dBµV / SNR / NF windows in **both** meters read the analog-calibrated value and add a fixed `VISUAL_DBM_OFFSET` of 5, hardcoded in `SMeterAnalog.svelte` and `SMeterDigital.svelte`. Therefore:

- `smeter_offset` does **not** change any number in the windows, only the bar length.
- dBµV = dBm + 107 (50 ohm), and NF = dBm - SNR by construction, so NF follows automatically.
- To correct the **numbers** without touching the needle position, `VISUAL_DBM_OFFSET` is the knob — but it is a source constant, needs a rebuild, and must be changed in **both** files to stay consistent.

#### Procedure

1. Feed a known level into the antenna port (signal generator at -73 dBm = S9), in SSB/CW with a stable passband. Readings depend on bandwidth and AGC, so fix the mode and bandwidth first.
2. Note what the analog dBm window shows, then set `analog_smeter_offset ~= 0.91 x (-73 - shown)`. Restart the server and recheck. One iteration should be enough; the needle should land on S9.
3. Switch to the digital meter and set `smeter_offset` so the bar length places S9 where you want it — roughly 3 units per segment. This step is cosmetic matching only and has no effect on the readouts.
4. Without a signal generator, a quiet band with a known-level reference beacon is a reasonable substitute, or simply anchor the noise floor to a plausible value (e.g. -120 dBm on 20 m with a decent antenna) — accepting that this calibrates the whole chain including antenna gain, not the receiver alone.


### GUI Variants

All four GUI variants (analog/digital S-meter x v1/v2 layout) live in the one build. Visitors switch between them with the ⚙️ menu at the top right of the page — nothing reloads, so audio, the waterfall and any running decoder carry on — and each visitor's choice is remembered in their own browser.
- Run recompile.sh in a terminal to set the *starting* variant, the one a first-time visitor sees.
- **[EDITING_VARIANTS.md](EDITING_VARIANTS.md)** - How to edit the frontend variants (S-meter and layout) and rebuild them

---

## 📚 Documentation

- **[INSTALLATION.md](INSTALLATION.md)** - Complete installation guide for system operators
- **[ADMIN_PANEL_SETUP.md](ADMIN_PANEL_SETUP.md)** - Installation guide for admin system operators
- **[USER_GUIDE.md](USER_GUIDE.md)** - End-user guide for operating the WebSDR
- **[THERMAL_GUARD.md](THERMAL_GUARD.md)** - Sysop manual for the CPU over-temperature guard: the four modes and what to do with each
- **[CONNECTION_LIMITS.md](CONNECTION_LIMITS.md)** - Sysop manual for connection limits: protecting a public receiver from connection floods
- **[PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md)** - Directory structure and code organization
- **[EDITING_VARIANTS.md](EDITING_VARIANTS.md)** - How to edit the frontend variants (S-meter and layout) and rebuild them

---

## 🌐 Online WebSDR List

Register your WebSDR on the official directory: https://sdr-list.xyz

Set `register_online=true` in your `.toml` configuration file to automatically register.

---

## 🐛 Troubleshooting

### Common Issues

**OpenCL Not Working**
- Ensure drivers are properly installed
- Check with `clinfo` command
- See INSTALLATION.md for detailed OpenCL setup

**Audio Latency Issues**
- Try switching between FLAC and Opus codecs
- Adjust buffer settings in configuration
- Ensure adequate CPU/GPU resources

**Build Failures**
- Verify all dependencies are installed
- Try cleaning build directory: `rm -rf build && meson setup build`
- Check for conflicting library versions

---

## 🤝 Contributing

Contributions are welcome! This is an independent fork with additional features. Please:

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

---

## 📄 License

This project is licensed under the GNU General Public License v3.0 - see the [LICENSE](../LICENSE) file for details.

---

## 👥 Authors & Credits

- **SV1BTL & SV2AMK** - PhantomSDR-Plus development and enhancements
- Based on the original PhantomSDR project

---

## 🔗 Links

- **Live Demo**: http://phantomsdr.no-ip.org:8900/
- **WebSDR Directory**: https://sdr-list.xyz
- **GitHub Repository**: https://github.com/sv1btl/PhantomSDR-Plus

---

## 📞 Support

- **Issues**: Report bugs via [GitHub Issues](https://github.com/sv1btl/PhantomSDR-Plus/issues)
- **Email**: contact sv1btl@otenet.gr

---

## ⚡ Performance Tips

1. **Enable OpenCL/CUDA** for GPU acceleration - dramatically reduces CPU usage
2. **Use SSD storage** for better I/O performance
3. **Allocate sufficient RAM** - at least 8 GB recommended
4. **Optimize FFT size** - larger FFT = better resolution but more CPU usage
5. **Consider dedicated GPU** - AMD or NVIDIA with OpenCL support

---

**73 de SV1BTL & SV2AMK**

*For detailed setup instructions, see INSTALLATION.md* *For end-user operation guide, see USER_GUIDE.md* *For other translations in various languages, please refer to the folders in this section*
