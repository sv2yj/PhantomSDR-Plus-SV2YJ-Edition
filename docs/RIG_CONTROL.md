# PhantomSDR-Plus — Rig Control (CAT)

Keep **your own transceiver** and a **PhantomSDR-Plus receiver** on the same frequency, mode and filter. Turn the rig's dial and the waterfall follows; click a signal on the waterfall and the rig tunes to it. Key the rig, and the receiver can fall silent so it does not play your own signal back to you.

It works with **PhantomSDR-Plus, KiwiSDR, PA3FWM WebSDR and UberSDR** receivers, yours or someone else's, and only ever moves *your* listening session — nobody else on the receiver hears or sees a thing. There is nothing for the receiver's operator to install or configure.

---

## What you need

Two ways to connect a rig, and one requirement on the receiver:

| Piece | What it is | Syncs |
|---|---|---|
| **[Desktop PhantomSDR+](https://www.dropbox.com/scl/fo/kjwj96zg3kj7dgq4fjef9/APnA3c9hhv4hk3YMGIGjH7s?rlkey=jfiwklly63kv73poalx631pk3&st=m37uvaym&dl=0) 4.0 or later** | The desktop application, with a **Rig** menu. Linux (PC and Raspberry Pi) and Windows. | Frequency, mode, filter width, mute on transmit — in either direction or both |
| **[CATsync Tool for WebSDRs](https://catsyncsdr.wordpress.com/)** | A separate Windows program that couples a rig to the receiver page in your browser. | Frequency and mode |
| **TCI-CAT on the receiver page** | A button on the PhantomSDR-Plus page itself, in any browser. Talks TCI to ExpertSDR, AetherSDR or Thetis, or to any Hamlib rig through a small bridge. Only on PhantomSDR-Plus receivers running 4.1.0 or later. | Frequency, mode and filter width both ways; mute on transmit |
| **The receiver** | PhantomSDR-Plus, KiwiSDR, PA3FWM WebSDR or UberSDR. A PhantomSDR-Plus receiver needs **4.1.0** or later for filter width and mute. | An older PhantomSDR-Plus still syncs frequency and mode |

Most of this manual describes Desktop PhantomSDR+. The TCI-CAT button has its own section, [TCI-CAT on the receiver page](#tci-cat-on-the-receiver-page). The CATsync Tool has its own documentation on its website.

---

## Supported receivers

The app recognises the kind of receiver in a station window and drives it through that page's own controls. The Rig control window shows which kind it found next to the station's name.

| Receiver | Frequency and mode | Filter width | Mute on transmit |
|---|---|---|---|
| PhantomSDR-Plus | Yes | With 4.1.0 or later | With 4.1.0 or later |
| KiwiSDR (including Web-888) | Yes | Yes | Yes |
| PA3FWM WebSDR | Yes, switching band on a multi-band site | Yes | Yes |
| UberSDR | Yes | Yes | Yes |

A web receiver has fewer modes than most rigs, so some rig modes share one receiver mode: KiwiSDR and WebSDR have a single CW for both CW and CW-R. The receiver modes named in this manual are PhantomSDR-Plus's; the other receivers use their nearest equivalent. A WebSDR keeps a CW filter under 1 kHz and other filters at 1 kHz or wider, because that is how the page itself tells CW apart, and a frequency outside every band a WebSDR site covers is left alone. UberSDR sets its filter in slider steps, so a width can land up to about 50 Hz from the rig's. Any other kind of page — OpenWebRX, for example — shows *not a receiver this app can drive*, and nothing is synced.

---

## What it does, and what it does not

- It syncs **one rig with one receiver window** at a time.
- It reads both sides several times a second and, when they disagree, sets one to match the other. It does **not** transmit, key the rig, or send audio anywhere.
- Moving the receiver changes only your own session. Other listeners on the same receiver are not affected, and the receiver's operator does not have to allow it.
- A serial port can be opened by **one program at a time**. If WSJT-X, a logger or a manufacturer's utility already has the rig's port, use the **flrig** or **rigctld on network** choice to share the rig instead of fighting over the port.

---

## Quick start

1. Open a station in Desktop PhantomSDR+ as usual.
2. **Rig → Rig control...**
3. Under **Connection**, choose **Built-in** if your rig is in the list, otherwise **Hamlib (all rigs)**.
4. Pick your rig, the serial port, and the speed your rig's own CAT or CI-V menu is set to.
5. Under **Sync**, leave **Both directions** selected.
6. Press **Connect**. The two readouts at the top — transceiver and receiver — should show the same frequency within a second.

Every setting is saved as you change it. Next time, **Rig → Connect** is enough, or tick **Connect when the app starts**.

---

## Choosing how to reach the rig

| Choice | Use it when | Needs |
|---|---|---|
| **Built-in** | Your rig is in the list below. | Nothing else |
| **Hamlib (all rigs)** | Your rig is anything else — Hamlib knows more than 300 rigs. The app starts Hamlib's `rigctld` for you, on a private local port, and stops it when you disconnect. | Windows: nothing, Hamlib is included. Linux: `sudo apt install libhamlib-utils` |
| **rigctld on network** | A `rigctld` is already running, on this computer or another one on your network. | The host and port (4532 by default) |
| **flrig** | flrig already controls the rig for fldigi, WSJT-X or a logger. | flrig running, with its XML-RPC port (12345 by default) |

### Rigs with a built-in driver

The speed and CI-V address shown are the factory defaults the app fills in. **They are only a starting point — set them to what your rig's menu says.**

| Family | Rigs | Default speed | Notes |
|---|---|---|---|
| **Icom CI-V** | IC-7300, IC-7610, IC-705, IC-9700, IC-905, IC-7760, IC-7851, IC-7100, IC-7410, IC-9100, IC-7600, IC-7200, IC-7700, IC-7000, IC-7800, IC-756PROIII, IC-756PROII, IC-R8600, and any other CI-V rig | 19200 | CI-V address filled in per model (IC-7300 `94`, IC-705 `A4`, IC-9700 `A2`, IC-7610 `98` …) |
| | IC-746PRO, IC-718, IC-R75 | 9600 | |
| **Xiegu** (CI-V) | G90, X6100 | 19200 | Address `70`; check the rig's menu |
| **Yaesu new CAT** | FTDX101D/MP, FTDX10, FT-710, FT-991/A, FT-891, FTDX5000, FTDX3000, FTDX1200, FT-950, FT-2000, FT-450/450D | 38400 | |
| **Yaesu classic CAT** | FT-817/818, FT-857/857D, FT-897/897D | 38400 | 2 stop bits; tunes in 10 Hz steps |
| **Kenwood** | TS-990S, TS-890S, TS-590S/SG | 115200 | |
| | TS-480, TS-2000, TS-870S | 57600 | |
| **Elecraft** | K4, K3/K3S, KX3, KX2 | 38400 | Filter width syncs |
| **Kenwood-compatible** | FlexRadio SmartSDR CAT (virtual port), QRP Labs QMX/QMX+/QDX, (tr)uSDX, Lab599 Discovery TX-500, other Kenwood-compatible rigs | 9600–38400 | |

A rig that ought to be compatible but will not talk to a built-in driver usually works with **Hamlib**, which copes with far more variations.

---

## Serial settings

| Setting | What to put there |
|---|---|
| **Serial port** | The rig's port. USB adapters and rigs with a USB port are listed first. **Other / network address...** takes a port the list does not show — `COM7`, `/dev/ttyUSB1` — or `tcp://host:port` for a serial port served over the network by ser2net or similar. |
| **Speed (baud)** | Exactly what the rig's CAT / CI-V baud-rate menu says. A mismatch looks like a rig that never answers. |
| **Stop bits** | 1 for almost everything; 2 for the FT-817/857/897 family. |
| **CI-V address** | Icom only, in hexadecimal (`94`, not `148`). Must match the rig's CI-V address menu. |
| **DTR / RTS** | Leave **off** unless your interface needs them. Many CAT cables key the transmitter, or reset the rig, on one of those lines. |
| **Hardware flow control** | Leave off unless the rig's manual asks for RTS/CTS. |

For **Hamlib** the same settings are passed on to `rigctld`. Stop bits there has a *Rig default* choice, and **Extra rigctld options** takes anything else `rigctld` accepts, for example `--set-conf=post_write_delay=10`. **rigctld program** lets you point at a particular `rigctld` if you have more than one installed.

---

## Sync

### Direction

| Choice | What happens |
|---|---|
| **Rig → receiver** | The receiver window follows the rig. A change made on the waterfall is put back to the rig's frequency. |
| **Receiver → rig** | The rig follows the receiver window. Turning the rig's dial is undone. |
| **Both directions** | Whichever side you touched **last** wins. At the moment you connect, before either has been touched, the rig wins. |

The direction can also be changed from the **Rig** menu while connected.

### How the two sides are kept from fighting

Every value the app writes shows up a moment later as a change on the other side. If that were taken at face value, the rig and the receiver would chase each other for ever. The app avoids it in three ways:

- The receiver page applies a change at once, so it is read back straight after writing, and that reading becomes the new starting point.
- A rig applies a change a little later, so each value sent to it is remembered. When the rig reports that value, it is recognised as the app's own write rather than a hand on the dial.
- A value the rig refuses — wide FM on an HF rig, for example — is sent **twice** and then left alone until the source side changes, instead of being repeated several times a second.

Retuning the receiver page can make it choose its band's default mode (LSB below 10 MHz, for instance). When the rig is leading, the app puts the rig's own mode back straight away, so a rig in USB on 40 m keeps the receiver in USB.

### Which receiver window

**Receiver window** chooses which station follows the rig:

- **The station window last in front** (default) — with two stations open, click into one and the rig follows that one.
- **A particular station** — pin the rig to it, whether or not it is in front. If that station is not open, nothing is synced until it is.

### Update rate

**Update every** sets how often both sides are read: 150 ms, 300 ms (default), 500 ms or 1 s. Faster feels more immediate on the dial; slower is kinder to an old rig at 4800 or 9600 baud, where each read takes real time on the wire.

---

## Modes

| Rig mode | Receiver listens in |
|---|---|
| USB, LSB | USB, LSB |
| CW | CW |
| CW-R (reverse) | CW-L |
| AM, synchronous AM, DSB | AM |
| FM, narrow FM | FM |
| Wide FM | WBFM |
| RTTY / FSK | LSB |
| RTTY-R / FSK-R | USB |
| Data modes (USB-D, DATA-U, PKTUSB, DIG) | USB |
| Data LSB, data FM | LSB, FM |

| Receiver mode | Rig is set to |
|---|---|
| USB, LSB | USB, LSB |
| CW | CW |
| CW-L | CW-R |
| AM, QUAM | AM |
| FM | FM |
| WBFM | WFM — most HF rigs refuse it, and are left alone after two tries |
| RADE (upper / lower) | USB / LSB |

A rig in a **data mode** stays in it: the receiver's USB is treated as agreeing with the rig's USB-D, so the receiver never knocks the rig out of data mode.

---

## Filter width

Tick **Sync filter width** to keep the passbands matched. Two differences of less than 60 Hz are treated as equal, since no two filters step alike.

| Rig connection | Filter width |
|---|---|
| Hamlib | Yes, where Hamlib supports it for that rig |
| flrig | Yes |
| Built-in Icom CI-V | Yes — 50 Hz steps up to 500 Hz, then 100 Hz steps up to 3.6 kHz; AM in 200 Hz steps up to 10 kHz; not in FM |
| Built-in Elecraft | Yes, in 10 Hz steps |
| Built-in Kenwood, Yaesu, FT-817 family | No — these rigs select filters from per-model tables. Use Hamlib if you need the filter |

KiwiSDR, WebSDR and UberSDR receivers always have the control. A PhantomSDR-Plus receiver must run **4.1.0** or later; on an older one frequency and mode still sync, and the Rig control window says why the filter does not.

---

## Mute while transmitting

Tick **Mute receiver while transmitting**. While the rig is keyed the receiver window is muted, and when it is unkeyed the sound comes back. The receiver's own mute button shows it, and you can still unmute by hand.

If you had already muted the receiver yourself, it is left muted afterwards too.

It needs a rig connection that reports transmit state — all the built-in drivers, flrig, and Hamlib for most rigs — and, on a PhantomSDR-Plus receiver, 4.1.0 or later.

---

## Frequency offset

**Frequency offset** is added to the rig's frequency to get the receiver's:

> receiver frequency = rig frequency + offset

| Setup | Offset |
|---|---|
| 2 m transverter on a 10 m rig (144.100 MHz shows as 28.100 MHz) | `116000000` |
| 70 cm transverter on a 2 m rig (432 → 144) | `288000000` |
| No transverter | `0` |

---

## The Rig menu

| Item | Does |
|---|---|
| **Rig control...** | Opens the Rig control window |
| **Connect / Disconnect** *rig name* | Starts or stops the sync; for Hamlib this also starts or stops `rigctld` |
| **Rig to receiver / Receiver to rig / Both directions** | Sync direction |
| **Sync filter width** | On / off |
| **Mute receiver while transmitting** | On / off |
| Status line | *Not connected*, *Connecting...*, *Connected: rig name*, or the last error |

The live frequency readout is in the Rig control window rather than in the menu, which would close itself every time it changed.

---

## Linux

**Serial port permission.** Serial ports belong to the `dialout` group. A user outside it gets *Could not open ttyUSB0*. Add yourself once, then log out and back in:

```bash
sudo usermod -aG dialout $USER
```

**Hamlib.** Install it from your distribution:

```bash
sudo apt install libhamlib-utils
```

The `.deb` package of Desktop PhantomSDR+ recommends it, so `sudo apt install ./phantomsdr-plus-desktop_4.0.0_amd64.deb` brings it along; `dpkg -i` does not install recommended packages. The built-in drivers and flrig need no Hamlib.

## Windows

Hamlib's own `rigctld.exe` is included in both the 64-bit and the 32-bit installer. COM ports appear in the port list by name (`COM3`). If a rig's USB driver is needed, install the manufacturer's driver first — the port does not exist until it is.

---

## TCI-CAT on the receiver page

A PhantomSDR-Plus receiver page can also follow a transceiver **by itself**, with no desktop application: the browser talks straight to a **TCI** server on your own computer. TCI is the WebSocket control protocol of ExpertSDR2/ExpertSDR3 (SunSDR), AetherSDR (FlexRadio) and Thetis (Apache Labs ANAN, Hermes). For a rig without TCI, a small bridge included with PhantomSDR-Plus makes any Hamlib rig look like a TCI server.

It needs a PhantomSDR-Plus receiver running **4.1.0 or later**. KiwiSDR, WebSDR and UberSDR pages do not have it.

### The TCI-CAT button

The button sits in the row with **VFO**, **Modes**, **Bands** and **IF Filters** — **TCI-CAT** in the wide layout, **CAT** in the compact one. Its dot is **green** while a TCI server is connected and **grey** otherwise. It opens a window with: Until 4.2.0 the button was labelled **QRG Sync**.

| Control | What it does |
|---|---|
| Status | *Active — TCI (port 50001)* when connected; *Inactive* with ⏳ *Wait* while it searches |
| **CAT Sync** | Frequency, mode and filter sync on or off. The mute on transmit works either way |
| **Host** | The computer running the TCI server: `localhost` for this computer, or its address on your network, e.g. `192.168.1.42`. Press Enter or click away to reconnect |

Nothing needs choosing beyond that: ports **50001** (ExpertSDR3, AetherSDR) and **40001** (ExpertSDR2, Thetis) are tried at the same time and retried every few seconds, so the page connects as soon as the software starts. **CAT Sync** and **Host** are remembered by the browser.

Browsers that ask before a web page may reach your local network — recent Chrome and Edge do — ask once, the first time the page connects. Allow it, or the dot stays grey.

### What is kept in step

| | Behaviour |
|---|---|
| **Rig → receiver: frequency** | Only the dial moves. Zoom, brightness and contrast stay as you left them; the waterfall scrolls only when the frequency is off screen, and the band plan does not change the mode |
| **Rig → receiver: mode** | Follows when the rig's mode changes — USB, LSB, CW, AM, FM; data modes as USB or LSB. A mode the receiver lacks leaves it alone. A running decoder keeps its own mode |
| **Rig → receiver: filter width** | The receiver's passband takes the rig's filter width: turning the rig's filter, or pressing its **FIL** button, changes the passband. A running decoder keeps its own passband |
| **Receiver → rig: frequency** | Typing a frequency, a label or bookmark, a click on the waterfall and a passband drag all move the rig's VFO. A drag sends only changed frequencies |
| **Receiver → rig: mode** | Every mode change on the page — a mode button, the band plan, a decoder, a bookmark — sets the rig's mode (USB, LSB, CW, AM, FM; RADE as USB or LSB). A rig in a data mode (USB-D) stays in it |
| **Receiver → rig: filter width** | The **IF Filters** buttons, the IF slider, a passband drag and a mode change all set the rig's filter; a drag sends only the width it settles on. On Icom rigs the bridge selects FIL1, FIL2 or FIL3 instead — see [Icom filters](#icom-filters-fil1-fil2-fil3) |
| **No echo** | A change that came from the rig is never sent back to it, and a report of the rig's previous mode or filter that arrives just after the page changed it is ignored |
| **Mute on transmit** | Always on, even with CAT Sync off: the page falls silent while the rig transmits. Moving the volume slider during transmit keeps it silent; on receive the sound returns at the slider's current level |
| **Not handled** | Split, VFO B, RIT/XIT and transverter offsets. Only VFO A of the first receiver is followed |

Mode and filter width travel as TCI's own commands (`modulation`, `rx_filter_band`), so ExpertSDR, AetherSDR and Thetis should follow them too; only the Hamlib bridge has been tried. For a transverter offset, use Desktop PhantomSDR+ instead. Do not use both on the same rig at once — two controllers fight over the dial.

### Which transceivers it works with

| Transceiver | Works | How |
|---|---|---|
| SunSDR (ExpertSDR2/3), FlexRadio (AetherSDR), ANAN/Hermes (Thetis) | Yes | Directly — enable the TCI server in the software. Not yet tried with these programs; tested against a simulated TCI server |
| A radio with a CAT port that Hamlib supports — most Icom, Yaesu, Kenwood, Elecraft, Xiegu, QRP Labs | Yes | Through the Hamlib bridge below. Tried on an **Icom IC-7300**, on Linux and Windows; other drivers may differ in mode names or in reporting PTT |
| A radio with no CAT port, or one Hamlib does not support | No | There is nothing to read the frequency from |

### The Hamlib bridge (IC-7300 and other rigs without TCI)

`tci-bridge/tci-rigctld.mjs` in the PhantomSDR-Plus tree turns any radio that Hamlib can control into a TCI server for the page. It runs on **your** computer — the one wired to the radio, next to the browser — not on the receiver. Four times a second it asks Hamlib for frequency, mode, filter width and transmit state, sends the page only what changed, and passes the page's frequency, mode and filter changes to the rig.

It reaches Hamlib in one of two ways:

| Way | Chain | Use it when |
|---|---|---|
| **`--rigctl`** (recommended) | transceiver → `rigctl` → `tci-rigctld.mjs` → page | Normally. The bridge starts Hamlib's `rigctl` itself: one window, no network port. **Use this on Windows**, where `rigctld.exe` is often refused with *Access is denied* |
| **`rigctld`** | transceiver → `rigctld` → `tci-rigctld.mjs` → page | Another program, such as WSJT-X, must use the radio at the same time — see [Sharing the radio](#sharing-the-radio-the-rigctld-way) |

**What it needs**

| | Linux | Windows |
|---|---|---|
| Hamlib | `sudo apt install libhamlib-utils`, or your distribution's hamlib package | `hamlib-w64-….zip` from [github.com/Hamlib/Hamlib/releases](https://github.com/Hamlib/Hamlib/releases), extracted to `C:\hamlib` — `rigctl.exe` is in `C:\hamlib\bin` |
| Node.js | 18 or newer | The LTS *Windows Installer (.msi)* from [nodejs.org](https://nodejs.org), with the default options |
| The `ws` package | Found automatically inside the PhantomSDR-Plus tree | Copy `tci-rigctld.mjs` to a folder such as `C:\tci-bridge` and run `npm install ws` there once |
| The radio's port | `ls /dev/serial/by-id/`. Join the `dialout` group once: `sudo usermod -aG dialout $USER`, then log out and back in | Install the radio's USB driver from the manufacturer; the COM number is in **Device Manager → Ports (COM & LPT)** |

Only one program can hold the rig's CAT port. Close WSJT-X, flrig, JS8Call, RS-BA1 or Desktop PhantomSDR+'s rig connection before starting the bridge.

#### Example: Icom IC-7300

On the radio: **MENU → SET → Connectors → CI-V** — **CI-V USB Baud Rate** `115200`, **CI-V Transceive** `ON`. Hamlib's model number for the IC-7300 is `3073`.

**Linux.** The radio is the line containing `IC-7300` in `ls /dev/serial/by-id/`, usually also `/dev/ttyUSB0`.

1. Check that Hamlib reaches the radio — it must print the frequency, e.g. `14280000`:
   ```bash
   rigctl -m 3073 -r /dev/ttyUSB0 -s 115200 f
   ```
2. Start the bridge and leave it running:
   ```bash
   cd ~/PhantomSDR-Plus/tci-bridge
   node tci-rigctld.mjs --rigctl rigctl -m 3073 -r /dev/ttyUSB0 -s 115200
   ```

**Windows.** The radio appears in Device Manager as *Silicon Labs CP210x USB to UART Bridge (COM4)* — use your own COM number. In a Command Prompt:

1. Check that Hamlib reaches the radio — it must print the frequency:
   ```bat
   C:\hamlib\bin\rigctl.exe -m 3073 -r COM4 -s 115200 f
   ```
2. Start the bridge and leave the window open:
   ```bat
   cd C:\tci-bridge
   node tci-rigctld.mjs --rigctl C:\hamlib\bin\rigctl.exe -m 3073 -r COM4 -s 115200
   ```
   The line is long: make sure it really ends in `-s 115200`, or `rigctl` stops with *Type: rigctl --help*.

On both systems the bridge prints, within a second:

```
rig answered through rigctl
rig -> page 14280000 Hz
rig -> page mode USB
rig -> page RX
```

Then open the receiver page in a browser on the same computer, open **TCI-CAT** and switch **CAT Sync** on. The dot turns green and the bridge prints `page connected`. Turn the VFO and the receiver follows; click the waterfall and the radio follows (`page -> rig ... Hz`); key the radio and the page goes silent. **Ctrl+C** stops the bridge, and `rigctl` with it.

Everything after `--rigctl` is the `rigctl` program and its own options — exactly the ones that worked in the check. That is the rule for every rig: **when `rigctl … f` prints the frequency, the bridge works with the same options.**

#### Icom filters (FIL1, FIL2, FIL3)

Icom rigs such as the IC-7300 do not take just any filter width: they have three filters, **FIL1**, **FIL2** and **FIL3**, each with a width set in the rig's menu. Given a width, Hamlib would select one of them and also overwrite its width — and on the IC-7300 that width can land on the filter selected before, scrambling the rig's settings. So for Icom rigs the bridge never sends a width: it picks the filter whose reference width is nearest to the page's passband and only **selects** it, with the rig's own CI-V command. The widths set on the rig are never changed.

| Mode | FIL1 | FIL2 | FIL3 |
|---|---|---|---|
| USB, LSB (and their data modes) | 2700 Hz | 2400 Hz | 1800 Hz |
| CW | 1200 Hz | 500 Hz | 250 Hz |
| AM | 9000 Hz | 6000 Hz | 3000 Hz |
| FM | 15000 Hz | 10000 Hz | 7000 Hz |

On the IC-7300 (`-m 3073`) this is automatic. Set the rig's SSB filters to match — FIL1 2.7 kHz, FIL2 2.4 kHz, FIL3 1.8 kHz (hold **FIL** on the radio) — and choosing 2.7 / 2.4 / 1.8 kHz in **IF Filters** selects FIL1 / FIL2 / FIL3, while pressing **FIL** on the radio sets the page's passband to that filter's width. The bridge prints, for example, `page -> rig filter 2398 Hz  LSB  → FIL2  sent`.

| Option | Use |
|---|---|
| `--filters 3000,2400,1800` | Other SSB reference widths, in the order FIL1,FIL2,FIL3; also switches filter selection on for another Icom rig |
| `--civ A4` | The rig's CI-V address in hex, when it is not `94` (IC-705 `A4`, IC-9700 `A2`, IC-7610 `98`) |
| `--filters off` | Send widths through Hamlib instead, as for other makes |

Both options go before `--rigctl`, e.g. `node tci-rigctld.mjs --filters 3000,2400,1800 --civ A4 --rigctl rigctl -m 3085 -r /dev/ttyACM0 -s 19200`. Tried on an IC-7300 only. Other makes — Yaesu, Kenwood, Elecraft and the rest — receive the page's width through Hamlib, which sets it as closely as the rig allows.

#### Other rigs

The same steps work for any rig Hamlib supports; only the options change.

1. **Prepare the rig.** In its menu, note the CAT (or CI-V) speed, and switch on any *CAT over USB* or *CI-V transceive* setting it has. On Windows, install the manufacturer's USB driver.
2. **Find the Hamlib model number** in the list `rigctl -l` prints:
   - Linux: `rigctl -l | grep -i 991`
   - Windows: `C:\hamlib\bin\rigctl.exe -l | findstr /i 991`
3. **Find the port.** Linux: `ls /dev/serial/by-id/`. Windows: Device Manager. Some rigs create **two** ports — Yaesu's FT-991A, FTDX10 and FT-710 name them *Enhanced* and *Standard*; CAT is on the **Enhanced** one.
4. **Check, then start the bridge** with `-m <model> -r <port> -s <speed>`, as in the IC-7300 example: first `rigctl -m … -r … -s … f`, then the same options after `--rigctl`.

Some model numbers, from Hamlib 4.5 — confirm them with `rigctl -l`, as another Hamlib version may number a rig differently:

| Rig | `-m` | Rig | `-m` |
|---|---|---|---|
| Icom IC-7300 | 3073 | Yaesu FT-991 / FT-991A | 1035 |
| Icom IC-705 | 3085 | Yaesu FTDX10 | 1042 |
| Icom IC-7610 | 3078 | Yaesu FT-710 | 1049 |
| Icom IC-9700 | 3081 | Yaesu FT-891 | 1036 |
| Xiegu G90 | 3088 | Yaesu FT-817 | 1020 |
| Xiegu X6100 | 3087 | Kenwood TS-590SG | 2037 |
| Elecraft K3 / K3S | 2029 | Kenwood TS-890S | 2041 |
| Elecraft KX3 | 2045 | Kenwood TS-2000 | 2014 |
| Elecraft K4 | 2047 | QRP Labs QCX / QDX | 2052 |

Extra options, only when needed:

- **An Icom rig with a changed CI-V address:** add `-c` and the address in *decimal* — `94h` is `-c 148`.
- **A setting Hamlib offers for that rig:** `rigctl -m <model> -L` lists them; set one with `-C name=value`, e.g. `-C post_write_delay=10` for a slow interface.
- **A rig that keys up or resets when the port opens:** some CAT cables use DTR or RTS for PTT; add `-C dtr_state=OFF -C rts_state=OFF`.

#### Example: Yaesu FT-991A

Not tried on a real FT-991A — it follows Hamlib's settings for the rig; the `rigctl … f` check tells you at once whether it works.

On the radio, set **CAT RATE** (menu 031) to `38400`. Hamlib's model number for the FT-991 and FT-991A is `1035`.

The FT-991A's USB cable creates **two** serial ports. CAT is on the **Enhanced** one:

- **Linux:** `ls /dev/serial/by-id/` shows two lines for the radio; the one ending in `-if00-port0` is Enhanced, usually `/dev/ttyUSB0`.
- **Windows:** Device Manager shows *Silicon Labs Dual CP2105 USB to UART Bridge: Enhanced COM Port (COM5)* and a *Standard COM Port*; use the Enhanced one's number.

**Linux:**
```bash
rigctl -m 1035 -r /dev/ttyUSB0 -s 38400 f
cd ~/PhantomSDR-Plus/tci-bridge
node tci-rigctld.mjs --rigctl rigctl -m 1035 -r /dev/ttyUSB0 -s 38400
```

**Windows:**
```bat
C:\hamlib\bin\rigctl.exe -m 1035 -r COM5 -s 38400 f
cd C:\tci-bridge
node tci-rigctld.mjs --rigctl C:\hamlib\bin\rigctl.exe -m 1035 -r COM5 -s 38400
```

If the check prints nothing useful, the usual cause is the Standard port instead of the Enhanced one, or a CAT RATE that differs from `-s`.

#### Example: Kenwood TS-590SG

Not tried on a real TS-590SG — it follows Hamlib's settings for the rig; the `rigctl … f` check tells you at once whether it works.

In the radio's menu, set the baud rate of the **USB** port to `115200` (the menu number is in the TS-590SG manual). Hamlib's model number is `2037`; the older TS-590S is `2031`. On Windows, install Kenwood's virtual COM port driver for the USB port first.

The USB cable creates **one** serial port:

- **Linux:** the radio's line in `ls /dev/serial/by-id/`, usually `/dev/ttyUSB0`.
- **Windows:** Device Manager → Ports (COM & LPT), for example `COM6`.

**Linux:**
```bash
rigctl -m 2037 -r /dev/ttyUSB0 -s 115200 f
cd ~/PhantomSDR-Plus/tci-bridge
node tci-rigctld.mjs --rigctl rigctl -m 2037 -r /dev/ttyUSB0 -s 115200
```

**Windows:**
```bat
C:\hamlib\bin\rigctl.exe -m 2037 -r COM6 -s 115200 f
cd C:\tci-bridge
node tci-rigctld.mjs --rigctl C:\hamlib\bin\rigctl.exe -m 2037 -r COM6 -s 115200
```

If the check fails, the usual cause is a USB baud rate that differs from `-s`, or a cable in the rig's RS-232 (COM) socket while `-r` names the USB port.

#### More examples

None of these has been tried on real hardware. Each row gives the options to put after `rigctl` for the check and after `--rigctl rigctl` for the bridge; set the rig's menu to the same speed. The Linux port is the usual one — confirm it with `ls /dev/serial/by-id/`. On Windows, replace the port with the COM number from Device Manager and `rigctl` with `C:\hamlib\bin\rigctl.exe`.

| Rig | Rig's menu | Options (Linux) | Notes |
|---|---|---|---|
| Icom IC-705 (USB) | CI-V USB Baud Rate `19200` | `-m 3085 -r /dev/ttyACM0 -s 19200` | Two ports appear; CI-V is the first (`ttyACM0`) |
| Icom IC-7100 (USB) | CI-V USB Baud Rate `19200` | `-m 3070 -r /dev/ttyUSB0 -s 19200` | Hamlib's highest speed for this rig is 19200 |
| Icom IC-7610 | CI-V USB Baud Rate `115200` | `-m 3078 -r /dev/ttyUSB0 -s 115200` | |
| Icom IC-9700 | CI-V USB Baud Rate `38400` | `-m 3081 -r /dev/ttyUSB0 -s 38400` | |
| Yaesu FTDX101D / FTDX101MP | CAT RATE `38400` | `-m 1040 -r /dev/ttyUSB0 -s 38400` | `-m 1044` for the FTDX101MP. Two ports; use Enhanced |
| Yaesu FTDX10 | CAT RATE `38400` | `-m 1042 -r /dev/ttyUSB0 -s 38400` | Two ports; use Enhanced, as on the FT-991A |
| Yaesu FT-710 | CAT RATE `38400` | `-m 1049 -r /dev/ttyUSB0 -s 38400` | Two ports; use Enhanced, as on the FT-991A |
| Yaesu FT-891 | CAT RATE `38400` | `-m 1036 -r /dev/ttyUSB0 -s 38400` | Two ports; use Enhanced, as on the FT-991A |
| Yaesu FT-450D | CAT RATE `38400` | `-m 1046 -r /dev/ttyUSB0 -s 38400` | RS-232 socket: use a USB-serial adapter |
| Yaesu FT-817 / FT-818 | CAT RATE `38400` | `-m 1020 -r /dev/ttyUSB0 -s 38400` | `-m 1041` for the FT-818. Needs a CAT cable on the ACC socket |
| Yaesu FT-857 / FT-897 | CAT RATE `38400` | `-m 1022 -r /dev/ttyUSB0 -s 38400` | `-m 1023` for the FT-897. Needs a CAT cable |
| Kenwood TS-890S (USB) | USB baud rate `115200` | `-m 2041 -r /dev/ttyUSB0 -s 115200` | |
| Kenwood TS-990S (USB) | USB baud rate `115200` | `-m 2039 -r /dev/ttyUSB0 -s 115200` | |
| Kenwood TS-590SG / TS-590S (USB) | USB baud rate `115200` | `-m 2037 -r /dev/ttyUSB0 -s 115200` | Worked example above |
| Kenwood TS-480 | COM port baud rate `57600` | `-m 2028 -r /dev/ttyUSB0 -s 57600` | RS-232 socket: use a USB-serial adapter |
| Kenwood TS-2000 | COM port baud rate `57600` | `-m 2014 -r /dev/ttyUSB0 -s 57600` | RS-232 socket; Hamlib's highest speed for this rig is 57600 |
| Elecraft K4 (USB) | RS232 speed `115200` | `-m 2047 -r /dev/ttyUSB0 -s 115200` | |
| Elecraft K3 / K3S | RS232 speed `38400` | `-m 2029 -r /dev/ttyUSB0 -s 38400` | K3S: USB; K3: serial port or KUSB cable |
| Elecraft KX3 | RS232 speed `38400` | `-m 2045 -r /dev/ttyUSB0 -s 38400` | KXUSB cable |
| Elecraft KX2 | RS232 speed `38400` | `-m 2044 -r /dev/ttyUSB0 -s 38400` | KXUSB cable |
| Xiegu G90 | CI-V baud rate `19200` | `-m 3088 -r /dev/ttyUSB0 -s 19200` | Hamlib uses the G90's default CI-V address |
| Xiegu X6100 | CI-V baud rate `19200` | `-m 3087 -r /dev/ttyUSB0 -s 19200` | Hamlib's highest speed for this rig is 19200 |
| Lab599 TX-500 | — | `-m 2050 -r /dev/ttyUSB0 -s 9600` | Hamlib uses 9600 only |
| ELAD FDM-DUO | — | `-m 33001 -r /dev/ttyUSB0 -s 115200` | |
| QRP Labs QDX | — | `-m 2052 -r /dev/ttyACM0 -s 9600` | A USB serial port; the speed does not matter but must be given |

Complete Linux command for the IC-705, as an example of reading a row:

```bash
rigctl -m 3085 -r /dev/ttyACM0 -s 19200 f
node tci-rigctld.mjs --rigctl rigctl -m 3085 -r /dev/ttyACM0 -s 19200
```

#### Rigs run by other software

Some radios are already run by a program that can do the job — sometimes with no bridge at all. None of these has been tried.

| Radio and program | What to do |
|---|---|
| **SunSDR** with ExpertSDR2/3, **FlexRadio** with AetherSDR, **Apache Labs ANAN / Hermes** with Thetis | No bridge. Switch on the program's **TCI server** and use **TCI-CAT** directly — ports 50001 and 40001 are found automatically |
| **FlexRadio** with SmartSDR (Windows) | Add a port in **SmartSDR CAT**. It speaks Kenwood CAT, so a serial port there works as a TS-2000: `-m 2014 -r COM8 -s 57600`. A TCP port works with Hamlib's FlexRadio model: `-m 2036 -r 127.0.0.1:<port>` |
| **Any rig controlled by flrig** | Leave flrig running and use Hamlib's flrig model; the rig stays shared with fldigi, WSJT-X and loggers: `-m 4 -r 127.0.0.1:12345` |
| **A running rigctld**, or a program offering a *Hamlib NET rigctl* server | Start the bridge without `--rigctl`, with that address: `node tci-rigctld.mjs 50001 127.0.0.1:4532` |

As everywhere, the options go after `rigctl` for the check and after `--rigctl rigctl` for the bridge. A network address such as `127.0.0.1:12345` needs no `-s`.

#### Sharing the radio: the rigctld way

When WSJT-X or a logger must use the radio while the bridge runs, start Hamlib's server `rigctld` with the same options, leave it running, and connect both programs to it:

```bash
rigctld -m 3073 -r /dev/ttyUSB0 -s 115200
node tci-rigctld.mjs
```

Without `--rigctl` the bridge looks for `rigctld` at `127.0.0.1:4532` and prints `rigctld connected`; `node tci-rigctld.mjs 50001 192.168.1.50:4532` uses a `rigctld` on another computer. In WSJT-X choose rig *Hamlib NET rigctl* at the same address. On Windows the server is `C:\hamlib\bin\rigctld.exe` with the same options; if Windows answers *Access is denied*, use `--rigctl` and close the other program while the bridge runs.

**Ports.** The bridge serves TCI on port 50001; another port goes first on the command line, e.g. `node tci-rigctld.mjs 40001 --rigctl …`. If the bridge and the browser are on different computers, put the bridge computer's address in **Host**.

### TCI-CAT troubleshooting

| Symptom | Likely cause | What to do |
|---|---|---|
| Dot stays grey | TCI server or bridge not running; wrong **Host**; the browser's local-network permission was refused | Enable TCI in ExpertSDR/Thetis/AetherSDR, or start the bridge; check **Host**; allow local network access in the site settings |
| `rigctl … f` gives an error or waits | Wrong port or speed; no `dialout` permission (Linux) or no USB driver (Windows); another program has the port | Match `-s` to the rig's menu; check the port (`ls /dev/serial/by-id/`, Device Manager); close other rig programs |
| Bridge prints *rigctl stopped … Type: rigctl --help* | The command is incomplete — usually the speed after `-s` is missing | Type the whole line again |
| Bridge prints *The value after -s is missing* | The command line was cut short when it was pasted | Type the end of the line again, e.g. `-s 115200` |
| The filter does not follow in one direction or the other | **CAT Sync** is off, a decoder is running on the page, or (IC-7300) the rig's FIL widths differ from 2700 / 2400 / 1800 Hz | Switch CAT Sync on; stop the decoder; set the FIL widths on the rig, or give `--filters` with the rig's own widths |
| Bridge prints *rigctl stopped … rig_open: error* | `rigctl` cannot open the port | As for `rigctl … f` above |
| Bridge prints *the rig is not answering* | The port opens but the rig does not reply: wrong speed or model, CAT switched off in the rig's menu, or a changed Icom CI-V address | Repeat the `rigctl … f` check; add `-c` for a changed CI-V address |
| Bridge prints *rigctld not reachable* | Started without `--rigctl`, and no `rigctld` is running | Add `--rigctl …`, or start `rigctld` first |
| `rigctld.exe` says *Access is denied* (Windows) | Windows refuses to run it | Use `--rigctl` — it needs only `rigctl.exe` |
| Connected, but the receiver does not move | **CAT Sync** is off | Switch it on — the mute on transmit works without it |
| Rig mode does not follow | A mode the receiver has no equivalent for, or the Hamlib driver reports an unusual name | Frequency still syncs; set the mode on the page |
| No mute on transmit | The rig or its Hamlib driver does not report transmit state | Nothing to set on the page |
| The dial jumps back and forth | Desktop PhantomSDR+ or another program is also syncing the rig | Use one controller at a time |

---

## For receiver operators

Nothing to configure. Rig control uses a small JavaScript interface every PhantomSDR-Plus page already carries; it involves no server setting, no open port and no admin permission. The filter and mute functions came with version 4.1.0 — after applying it, rebuild the frontend (`./recompile.sh`, option 2); the receiver does not need to be stopped. KiwiSDR, WebSDR and UberSDR receivers need nothing either: the app uses the controls their pages already have.

The **TCI-CAT** button came with 4.1.0 too, again a frontend rebuild only. It opens no port on the receiver: the connection runs from each listener's browser to their own computer. The Hamlib bridge, `tci-bridge/tci-rigctld.mjs`, is for listeners to run at home; the receiver does not use it.

---

## For developers: the page interface

Both Desktop PhantomSDR+ and the CATsync Tool use these functions, which every PhantomSDR-Plus page puts on `window` once it has loaded (KiwiSDR, WebSDR and UberSDR pages are driven through their own, different controls):

| Function | Returns / does |
|---|---|
| `catsync_ready` | `true` once the functions below are installed |
| `catsync_getFrequency()` | Tuned frequency, Hz |
| `catsync_setFrequency(hz)` | Tune to `hz` |
| `catsync_getMode()` | `USB`, `LSB`, `CW`, `CW-L`, `AM`, `QUAM`, `FM`, `WBFM`, `RADEU`, `RADEL` |
| `catsync_setMode(mode)` | Set the mode; resets the passband to the mode's default |
| `catsync_getBandwidth()` | Whole passband width, Hz |
| `catsync_setBandwidth(hz)` | Set the width — grows upwards in USB, downwards in LSB, evenly otherwise. Call it **after** `catsync_setMode` |
| `catsync_getMute()` | `true` when muted |
| `catsync_setMute(on)` | Mute or unmute, through the page's mute button |

The last four arrived with 4.1.0, so test before calling:

```js
if (window.catsync_ready) {
  window.catsync_setFrequency(7074000)
  window.catsync_setMode('USB')
  if (typeof window.catsync_setBandwidth === 'function') window.catsync_setBandwidth(2400)
}
```

Setting the frequency retunes audio, so call a setter only when the value has actually changed — polling a setter with the same value is audible. The older KiwiSDR/WebSDR-style entry points (`setfreq`, `set_mode`, `freqset_complete`) are still there for tools that expect them.

---

## Troubleshooting

| Symptom | Likely cause | What to do |
|---|---|---|
| *Could not open ttyUSB0* (Linux) | Not in the `dialout` group, or another program has the port | `sudo usermod -aG dialout $USER`, log out and in; close WSJT-X, loggers, rig utilities |
| The receiver readout says *not a receiver this app can drive* | Another kind of web receiver, or the page is still loading | Supported are PhantomSDR-Plus, KiwiSDR, PA3FWM WebSDR and UberSDR; give a slow page a few seconds |
| *The rig did not answer* | Wrong speed, wrong rig type, wrong CI-V address, rig off | Match the speed to the rig's menu; check the CI-V address; try Hamlib |
| *Hamlib is not installed* | No `rigctld` found | Linux: `sudo apt install libhamlib-utils`. Or set **rigctld program** to its path |
| *rigctld stopped: ...* | Hamlib could not open the rig — its own message follows | Usually the port or speed; the text after the colon is Hamlib's reason |
| *flrig is not running at ...* | flrig closed, or its XML-RPC port differs | Start flrig; check its port in flrig's configuration |
| Connected, but the receiver does not move | No station window open, or **Receiver window** pinned to a station that is closed | Open the station, or choose *The station window last in front* |
| The rig transmits when connecting | DTR or RTS keys the rig through your interface | Untick **DTR on** and **RTS on** |
| Filter does not follow | Receiver older than 4.1.0, or a built-in Kenwood/Yaesu driver | Frequency and mode still sync; use Hamlib for the filter on Kenwood/Yaesu |
| Mute on transmit does nothing | Receiver without the update, or the rig does not report transmit state | As above |
| *Lost the rig ... reconnecting* | The cable was pulled, the rig was switched off, or rigctld died | Nothing — it retries every 3 seconds and carries on when the rig is back |
| The two sides keep jumping | Two programs are controlling the rig at once | Let only one program set the rig, or share it through flrig |

---

## Known limitations

- One rig, one receiver window at a time.
- Receivers other than PhantomSDR-Plus, KiwiSDR, PA3FWM WebSDR and UberSDR — OpenWebRX, for example — are not supported.
- The built-in drivers follow the manufacturers' published protocols and were tested against simulated rigs and real Hamlib; for a rig that behaves differently, Hamlib is the fallback.
- Split operation, VFO B, RIT/XIT and memory channels are not synced — only the frequency of the active VFO.
- TCI-CAT on the receiver page does not sync split, VFO B, RIT/XIT or transverter offsets, and was tried only on an IC-7300 through the Hamlib bridge.
- On Linux the packages use the distribution's Hamlib; none is bundled.
