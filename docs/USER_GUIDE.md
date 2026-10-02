# PhantomSDR-Plus User Guide

Welcome to PhantomSDR-Plus! This guide will help you get the most out of your WebSDR listening experience.

---

## Table of Contents

1. [Introduction](#introduction)
2. [Getting Started](#getting-started)
3. [Interface Overview](#interface-overview)
4. [Basic Operations](#basic-operations)
5. [Advanced Features](#advanced-features)
6. [Demodulation Modes](#demodulation-modes)
7. [Digital Decoders](#digital-decoders)
8. [Keyboard Shortcuts](#keyboard-shortcuts)
9. [Bookmarks](#bookmarks)
10. [Mobile Usage](#mobile-usage)
11. [Tips and Best Practices](#tips-and-best-practices)
12. [Troubleshooting](#troubleshooting)
13. [Frequently Asked Questions](#frequently-asked-questions)

---

## Introduction

### What is PhantomSDR-Plus?

PhantomSDR-Plus is a web-based Software Defined Radio (SDR) that allows you to listen to radio signals over the internet. No special software or hardware is required on your end—just a modern web browser!

### What Can You Listen To?

Depending on the WebSDR's configuration, you can tune into:

- **Amateur Radio**: Ham radio operators worldwide
- **Broadcast Stations**: AM/FM radio, shortwave broadcasting
- **Aviation**: Air traffic control, aircraft communications
- **Marine**: Ship-to-shore, maritime weather
- **Weather Satellites**: NOAA, METEOR-M
- **Digital Modes**: FT8, JS8, RTTY, PSK31, and more
- **Utility Stations**: Time signals, military, government

### System Requirements

- **Browser**: Chrome/Edge (recommended), Firefox, Safari
- **Connection**: Broadband internet (1+ Mbps recommended)
- **Audio**: Working speakers or headphones
- **Optional**: Mouse with scroll wheel for easier tuning

---

## Getting Started

### 1. Access the WebSDR

Open your browser and navigate to the WebSDR URL provided by the operator.

Example: `http://websdr.example.com:9002`

### 2. Initial Page Load

When the page loads, you'll see:
- A colorful waterfall display showing radio activity
- Control panel with frequency display and buttons
- S-meter showing signal strength
- User count indicator

### 3. Start Listening

1. **Click on a signal** in the waterfall display
2. **Audio will automatically start** playing
3. **Adjust volume** using your browser's volume control or the on-screen slider
4. **Fine-tune frequency** by clicking precisely on the signal

---

## Interface Overview

### Main Components

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

The three panels below the waterfall scroll as one page; on a narrow window they stack instead of sitting side by side. **RADEL** and **RADEU** sit on the *Modes selector* heading line itself, to its right.

### 1. Waterfall Display

The waterfall is a visual representation of radio signals:

- **Horizontal axis**: Frequency
- **Vertical axis**: Time (scrolls downward)
- **Colors**: Signal strength
  - **Dark blue/black**: No signal (noise floor)
  - **Green/yellow**: Weak to moderate signals
  - **Orange/red**: Strong signals
  - **White**: Very strong signals

### 2. Frequency Display

Shows the currently tuned frequency in various formats:
- **MHz**: 7.100.000 MHz (HF bands)
- **kHz**: 14200 kHz
- **Hz**: 145500000 Hz (VHF/UHF)

### 3. S-Meter (analog or digital)

Displays signal strength:
- **S1-S9**: Standard signal strength scale
- **+dB**: Signals above S9 (e.g., S9+20dB)
- **Analog or Digital**: Depending on configuration

### 4. Mode Buttons

Select demodulation mode:
- **AM**: Amplitude Modulation
- **FM**: Frequency Modulation
- **USB**: Upper Sideband
- **LSB**: Lower Sideband
- **CW**: Morse Code (Continuous Wave)
- **WBFM**: Wideband FM (broadcast)
- **QUAM**: C-QUAM AM stereo — the label turns green when a stereo pilot is detected

Next to the **Modes selector** heading sit the **RADEL** and **RADEU** buttons, which start RADE v1 digital voice in one press — see [Digital Decoders](#digital-decoders).

### 5. Control Panel

Additional controls:
- **AGC**: Automatic Gain Control
- **NR**: Noise Reduction (spectral)
- **NB**: Noise Blanker (impulse)
- **NS**: Background Noise Suppression
- **AN**: Auto Notch
- **CTCSS**: Sub-audible tone squelch (FM)
- **SQL**: Squelch
- **AI**: AI noise reduction (voice modes)
- **Zoom**: Waterfall zoom level
- **Wheel Tuning Steps**: step size used by the mouse wheel
- **Decoders**: one-touch buttons that start and stop each decoder

### 6. Band Plan Overlay

Colored bars showing frequency allocations:
- Different colors for different services
- Helps identify what's allowed on each frequency

---

## Basic Operations

### Tuning to a Frequency

#### Method 1: Click on Waterfall

1. Click directly on a signal in the waterfall
2. The receiver will tune to that frequency
3. Audio will begin playing

#### Method 2: Type Frequency

1. Click on the frequency display
2. Type the desired frequency
3. Press Enter

Examples:
- `7100` → 7.100 MHz
- `14200.0` → 14.200 MHz
- `145.500` → 145.500 MHz

#### Method 3: Use Mouse Wheel

1. Hover over the frequency display
2. Scroll wheel up to increase frequency
3. Scroll wheel down to decrease frequency

#### Method 4: Step Buttons

1. Use the **▲** and **▼** buttons next to frequency
2. Step size varies by mode:
   - **AM/FM**: 1 kHz steps
   - **SSB**: 100 Hz steps
   - **CW**: 10 Hz steps

### Scanner

The scanner walks the receiver across a range of channels and stops on the first one carrying a signal. It sits on the **Fine Tuning (kHz)** row, hard right:

```
7 152.0   ◀  ■  ▶  ⊘   30 dB · 4 ▾
```

| Control | What it does |
|---------|--------------|
| **◀ ▶** | Scan down / up. While parked on a signal, an arrow resumes the scan. |
| **■** | Stop. |
| **⊘** | Lock this channel out of the scan — for a birdie or a permanent carrier. |
| **30 dB · 4 ▾** | The threshold, with the level being measured right now beside it. Opens the settings. |

The text to the left shows what the scanner is doing: `Scanner` when idle, the frequency it has reached while scanning, `◉ 3s` while counting down to resume,
`◉ 30·22s` while the channel is still busy, `◉ hold` when it will stay put.

**Settings**

- **Range** — *Scan Band* sweeps the band the scan starts in; *Scan Visible*
sweeps exactly what the waterfall shows, and follows it if you zoom or drag.
- **Scan** — *Every channel* tunes and listens to every channel in turn;
  *Skip empty* reads the spectrum and jumps straight to the signals.
- **Stop at** — how far above the band noise floor a channel must be to stop the
scan, in dB. The floor is tracked continuously, so one setting works by day and by night. An empty channel does not read 0 dB — watch the live figure on the button for a moment and set the threshold above it.
- **Resume after** — how long a channel must stay quiet before the scan moves on.
Pauses in speech do not restart it. *Hold* stays until you press a button.
- **Max stay** — moves on after this long even if the signal is still there, so a
permanent carrier cannot hold the scan for ever.

The step follows the mode — 1 kHz in SSB, 0.1 kHz in CW, 5 kHz in AM, 9 or 10 kHz on medium wave and 9 kHz on long wave — and stops land on the channel grid. The scan stays inside its range and inside what the receiver can tune; at an edge it wraps round and carries on.

Settings and the locked-out channels are remembered in your browser.


### Selecting Demodulation Mode

Choose the appropriate mode for the signal:

**For Voice Communications:**
- **AM**: Aviation, broadcast AM, some amateur
- **FM**: VHF/UHF repeaters, FM broadcast
- **USB**: HF ham radio (20m, 17m, 15m, 12m, 10m)
- **LSB**: HF ham radio (160m, 80m, 40m, 30m)

**For Data/Digital:**
- **USB**: Most digital modes (FT8, PSK31, RTTY)
- **LSB**: Some digital modes on lower HF bands

**For Morse Code:**
- **CW**: Telegraph/Morse code signals

### Adjusting Volume

- **On-screen slider**: Drag the volume slider
- **Browser volume**: Use browser's media controls
- **System volume**: Adjust your computer's volume
- **Keyboard**: Use + and - keys (if supported)

### Using the S-Meter

The S-meter shows signal strength:

- **S0-S3**: Very weak signal, difficult to copy
- **S4-S6**: Weak to fair signal
- **S7-S9**: Good to strong signal
- **S9+**: Extremely strong signal

**Tip**: For best audio, tune to signals showing S7 or higher.

**Changing the meter face**: on the analog (needle) meter, click the meter itself — or focus it and press Enter or Space — to cycle through three backgrounds: dark brushed metal, a light pale-grey face, and a warm vintage amber face. Your browser remembers the choice, so it is still there after a refresh or a restart. It is per browser and per address, so opening the receiver by hostname and by IP gives two separate settings, and a private window always starts from the site default.

---

## Advanced Features

### Auto Gain Control (AGC)

AGC automatically adjusts audio levels:

- **Off**: No automatic gain adjustment
- **Slow**: Gradual level changes (best for SSB)
- **Medium**: Balanced response
- **Fast**: Quick adjustment (best for AM)

**Recommendation**: Start with "Fast" for AM, "Slow" for SSB.

### The four noise controls

NR, NB, NS and AN are separate on/off buttons that each attack a different kind of noise. They are independent — switching one on does not switch on another — and they can be combined freely.

None of them reach the decoders: FT8, CW, WSPR, SSTV, FAX, NAVTEX, RTTY/PSK31/ Olivia and the QRSS grabber all read the audio *before* these filters, so you can set them purely by ear without affecting what decodes. See the
[Decoder manual](DECODERS.md#12-general-tips).

### Noise Reduction (NR)

Spectral noise reduction. It estimates the noise level in each part of the audio spectrum and turns those parts down, leaving what stands above the noise alone.

**Use when**: You hear steady hiss or white noise behind the signal.

Steady tones — a CW note, a carrier — are recognised as signal and protected, so NR does not eat a CW signal the way a naive filter would. Typical effect is a 10 dB drop in the noise between speech, for a few tenths of a dB off the speech itself.

### Noise Blanker (NB)

Removes impulse noise: clicks, pops, static crashes, ignition and power-line noise. It watches the audio envelope and silences only the samples that spike far above it — about a millisecond per crash, ramped in and out so the blanking does not itself click.

**Use when**: You hear clicks or crashes from power lines, motors, thunderstorms
or vehicle ignition.

The 50 Hz and 60 Hz mains hum notches follow this button.

### Background Noise Suppression (NS)

Measures the band's own noise floor over several seconds and applies a fixed cut to whatever sits at that floor, deeper at high audio frequencies than low. Where NR reacts moment to moment, NS is a slow, steady hand: it lowers the band hiss without changing how the signal itself sounds.

**Use when**: The band is quiet but hissy and you want the noise pushed down
without the "underwater" quality of aggressive NR.

Active in USB, LSB and AM only — CW, FM and digital modes are left untouched. It re-measures the floor whenever you retune or change mode, and settles within a few seconds.

### Auto Notch (AN)

Automatically finds and removes steady interfering tones — heterodynes, carriers, birdies — without you having to place a notch by hand. It adapts continuously, so several tones can be removed at once and a drifting one stays notched.

**Use when**: You hear a whistle or tone on top of the signal you want.

Bypassed in CW, where the wanted signal *is* a steady tone.

**Delay note**: NR and NS each add about 40 ms of audio delay while switched on
(both together, about 80 ms). NB and AN add none. This affects listening only, never the decoders.

### Auto Squelch (SQL)

Mutes audio when no signal is present:

- **Off**: Always playing (hear static)
- **Auto**: Automatically sets threshold
- **Manual**: Adjust threshold manually

**Use when**: Monitoring a frequency for activity.

### AI Noise Reduction (AI)

The **AI** button, with a strength slider beside it, sits in the Audio & Buffer panel right under SQ. On the /mobile page it is in the Audio tab, under Squelch. It removes band noise from speech with RNNoise, a small neural network trained on voice.

Everything happens in your own browser: nothing is sent to an outside server, there is no account, and the receiver does no extra work.

- **On/off**: Click **AI**; the button turns blue. The first click downloads the module (about 1.3 MB), and the button pulses while it loads.
- **Strength**: The slider mixes the denoised sound with the original — 100% is fully processed, lower values bring some of the band back. The default is 50%. You can set it while AI is off.
- **Status label**: The AI label under the frequency display lights cyan while AI is working, and shows half-dimmed when AI is on but the current mode is not a voice mode.

**Use when**: Listening to SSB or AM voice on a noisy band. The hiss between words typically drops by 10–20 dB while the speech keeps its level.

Voice modes only — USB, LSB, AM and SAM. In CW, FM, the data modes and C-QUAM the audio passes through untouched, because the network treats a CW tone or music as noise. Like the four noise controls, it never reaches the decoders. On very weak stations (around 0 dB SNR) speech can sound processed; if a signal sounds "watery", lower the slider. It adds about 30 ms of audio delay.

### Zoom Function

Magnifies the waterfall display:

- **1x**: Normal view (wide coverage)
- **2x**: 2× magnification
- **4x**: 4× magnification
- **8x**: 8× magnification

**Use when**: You need to see signals more clearly or tune precisely.

### Transceiver control (CAT)

Your own transceiver and the receiver page can be kept on the same frequency: turn the rig's dial and the waterfall follows, or click a signal on the waterfall and the rig tunes to it. It only moves *your* listening session — nobody else on the receiver is affected.

**With Desktop PhantomSDR+ (4.0 or later).** The desktop application has a **Rig** menu. *Rig → Rig control...* opens a window where you choose your rig and how to reach it, and the menu itself switches the sync on and off. It syncs frequency, mode and filter width, in either direction or both, and can mute the receiver while you transmit. Besides PhantomSDR-Plus it drives **KiwiSDR, PA3FWM WebSDR and UberSDR** receivers the same way. It reaches the rig in one of four ways:

- **Built-in** — no other software: Icom (CI-V), Yaesu (new CAT and the FT-817/857/897), Kenwood, Elecraft, FlexRadio SmartSDR CAT, QRP Labs and other Kenwood-compatible rigs.
- **Hamlib** — every rig Hamlib knows, more than 300 of them, picked from a searchable list. The Windows installers include Hamlib; on Linux install `libhamlib-utils`.
- **rigctld on the network** — a `rigctld` that is already running.
- **flrig** — for a rig that flrig already shares with fldigi, WSJT-X or a logger.

The application, its installers and its full manual are at [Desktop PhantomSDR+ (Dropbox)](https://www.dropbox.com/scl/fo/kjwj96zg3kj7dgq4fjef9/APnA3c9hhv4hk3YMGIGjH7s?rlkey=jfiwklly63kv73poalx631pk3&st=m37uvaym&dl=0).

**With a web browser.** The [CATsync Tool for WebSDRs](https://catsyncsdr.wordpress.com/) (Windows) couples a rig to the receiver page open in your browser. It syncs frequency and mode.

**Filter width and mute on transmit** work on KiwiSDR, WebSDR and UberSDR receivers, and on a PhantomSDR-Plus receiver running 4.1.0 or later. On an older PhantomSDR-Plus frequency and mode still sync; the filter does not.

The full manual — every setting, the supported rigs, how the two sides are kept from fighting, and troubleshooting — is **[Rig Control](RIG_CONTROL.md)**.

**For developers.** Every receiver page offers these functions on `window`, which is what both tools use:

| Function | Does |
|---|---|
| `catsync_getFrequency()` / `catsync_setFrequency(hz)` | Tuned frequency, in Hz |
| `catsync_getMode()` / `catsync_setMode(mode)` | `USB`, `LSB`, `CW`, `CW-L`, `AM`, `FM`, `WBFM` … |
| `catsync_getBandwidth()` / `catsync_setBandwidth(hz)` | Whole passband width, in Hz. Set it after the mode: changing mode resets the passband |
| `catsync_getMute()` / `catsync_setMute(on)` | Mute, through the page's own mute button |
| `catsync_ready` | `true` once the functions are installed |

The last three rows are new in 4.1.0; check that a function exists before calling it.

---

## Demodulation Modes

### AM (Amplitude Modulation)

**Used for:**
- Aviation communications
- AM broadcast radio
- Some amateur radio
- Maritime communications

**Characteristics:**
- Wide bandwidth (typically 10 kHz)
- Susceptible to noise
- Easy to tune (just click on signal)

**Best Practices:**
- Use Fast AGC
- Enable Noise Blanker if you hear clicks
- Tune to peak of signal on waterfall

### QUAM (C-QUAM AM Stereo)

**Used for:**
- Medium-wave broadcasters transmitting AM stereo

**Characteristics:**
- 10 kHz wide, decoded as a stereo pair rather than mono AM
- The button label turns **green** on its own when the 25 Hz stereo pilot is present, so you can see which stations are actually in stereo before selecting it
- From AM, pressing the button again switches to synchronous AM on the carrier; the label turns **yellow** and reads `SAM`. A third press returns to plain AM
- C-QUAM audio is carried with Opus; every other mode uses FLAC

**Best Practices:**
- Look for the green label on strong medium-wave signals at night
- If stereo sounds unstable, `SAM` is the steadier choice on a weak carrier

### FM (Frequency Modulation)

**Used for:**
- VHF/UHF amateur radio repeaters
- Public service (police, fire, EMS)
- Commercial two-way radio
- Some satellite communications

**Characteristics:**
- Narrow bandwidth (typically 12.5 or 25 kHz)
- Excellent noise immunity
- "Capture effect" (strongest signal wins)

**Best Practices:**
- Tune precisely to center of signal
- Use squelch to mute when idle
- Disable noise reduction (not needed)

### USB (Upper Sideband)

**Used for:**
- HF amateur radio (above 10 MHz)
- Most HF digital modes
- Maritime communications (above 8 MHz)

**Characteristics:**
- Narrow bandwidth (typically 2.4 kHz)
- Efficient use of spectrum
- Requires precise tuning

**Best Practices:**
- Use Slow AGC
- Tune to lower edge of signal on waterfall
- Enable Noise Reduction if needed

### LSB (Lower Sideband)

**Used for:**
- HF amateur radio (below 10 MHz)
- Some HF digital modes
- Maritime communications (below 8 MHz)

**Characteristics:**
- Same as USB but mirror image
- Convention: LSB on lower HF bands

**Best Practices:**
- Use Slow AGC
- Tune to upper edge of signal on waterfall
- Enable Noise Reduction if needed

### CW (Continuous Wave / Morse Code)

**Used for:**
- Amateur radio telegraphy
- Navigational beacons
- Time signal stations

**Characteristics:**
- Very narrow bandwidth (100-500 Hz)
- High efficiency
- Requires learning Morse code to understand

**Best Practices:**
- Use narrow filter (400-500 Hz)
- Tune precisely to tone center
- Enable audio filter for better tone

### CW-L (CW, Lower Sideband)

The same ±250 Hz Morse filter as **CW**, but the tone is taken from below the carrier instead of above it. Use it when a signal is easier to copy on the low side, or when an interfering carrier sits just above the one you want.

**There is no CW-L button on the desktop page.** Its mode row is `USB · LSB · CW · AM · QUAM · FM`. CW-L is offered on the simplified `/mobile` page, and on the desktop it can still be set by a link or a bookmark that names it.

### WBFM (Wideband FM)

**Used for:**
- FM broadcast radio (88-108 MHz)
- Some satellite downlinks

**Characteristics:**
- Very wide bandwidth (200 kHz)
- Excellent audio quality
- High fidelity

**Best Practices:**
- Tune to exact center frequency
- No squelch needed for broadcast
- Enjoy high-quality audio!

---

## Digital Decoders

PhantomSDR-Plus includes built-in decoders for digital modes. For a complete guide, see [Decoders](DECODERS.md).

The quickest way in is the **Decoders** button row on the main panel, just below **Wheel Tuning Steps**: ten buttons — **FT8, FT4, FT2, JS8, CW, WSPR, FAX, SSTV, NAVTX, RTTY** — that each start their decoder, switch the master Decoder toggle ON and scroll the decoder's window into view in a single press. The button stays blue while the decoder runs; press it again to stop the decoder and close its window. The **Decoder Options** dropdown still works exactly as before and stays in sync with the buttons.

**RADEL** and **RADEU** (RADE v1 digital voice) have their own buttons next to the **Modes selector** heading and inside the **Modes** and **Bands** popup windows, and work the same press-on / press-off way.

The SSTV, HF FAX, NAVTEX, FSK/RTTY and CW decoders each run on their own background thread, so switching a decoder on or off never interrupts the audio, and the waterfall stays smooth while decoding. They are fed audio taken before AGC, noise reduction and mute — you can mute the receiver and decoding continues unaffected.

**While a decoder runs it holds the mode and the passband.** Normally the mode follows the band plan — tune into a segment marked LSB or AM and the receiver switches to it. A running decoder overrides that, keeping the mode and the narrow passband it needs even if you tune to another band. The band's own mode returns as soon as you switch the decoder off, and the mode buttons still work at any time if you want to take over. The CW decoder is the exception: it decodes in whatever mode you are listening in.

### FT8, FT4 Decoder

**What is FT8, FT4?**
- Popular amateur radio digital mode
- Weak signal communication
- 15-second transmissions for FT8, 7.5-second transmissions for FT4

**How to use:**
1. Tune to FT8 or FT4 frequencies
2. Select USB mode
3. Enable the FT8 decoder — press the **FT8** button, or pick it from the menu
4. Watch decoded messages appear

**Common FT8 Frequencies (USB):**
- 160 meters: 1.840 MHz
- 80 meters: 3.573 MHz
- 60 meters: 5.357 MHz
- 40 meters: 7.074 MHz
- 30 meters: 10.136 MHz
- 20 meters: 14.074 MHz
- 17 meters: 18.100 MHz
- 15 meters: 21.074 MHz
- 12 meters: 24.915 MHz
- 10 meters: 28.074 MHz
- 6 meters: 50.313 MHz (50.323 MHz for DX)

**Common FT4 Frequencies (USB):**

- 80m: 3.575 MHz
- 40m: 7.0475 MHz
- 30m: 10.140 MHz
- 20m: 14.080 MHz
- 17m: 18.104 MHz
- 15m: 21.140 MHz
- 12m: 24.919 MHz
- 10m: 28.180 MHz
- 6m: 50.318 MHz

---

### JS8 Decoder

**What is JS8?**
- FT8's weak-signal engine used for keyboard-to-keyboard conversation
- Free text instead of fixed exchanges, so long messages arrive over several cycles
- Five speeds; **Normal** (15 s) is the calling speed and carries almost all traffic

**How to use:**
1. Tune to a JS8 frequency
2. Select USB mode
3. Enable the JS8 decoder — press the **JS8** button, or pick it from the menu
4. Leave **Speed** on *Normal* and leave the sync offset on **Auto**

**Reading the panel:**
- Messages still arriving show at the top in green with a blinking cursor — a message can take a full minute to complete on Normal
- Completed messages list below as `Mode | Hz | dB | Message`, with **callsigns in green**
- A dimmed, italic row timed out before its last frame arrived: the text is real but may be cut short

**Common JS8 Frequencies (USB):**

- 160m: 1.842 MHz
- 80m: 3.578 MHz
- 40m: 7.078 MHz
- 30m: 10.130 MHz
- 20m: 14.078 MHz
- 17m: 18.104 MHz
- 15m: 21.078 MHz
- 12m: 24.922 MHz
- 10m: 28.078 MHz

JS8 is far quieter than FT8 — one transmission every few minutes is normal, and quiet spells are not a fault. See [Decoders](DECODERS.md) for the full guide.

---

### CW Decoder
Just press the CW button and the decoded text will appear. Press the CW button once more to clear the window and restart the decoder.

---

### WSPR

WSPR (Weak Signal Propagation Reporter, pronounced "whisper") is an ultra-weak-signal beacon mode that maps HF propagation paths worldwide. Each transmission takes approximately 110 seconds and fits inside a 200 Hz-wide slot. The decoder waits for a complete 2-minute UTC-aligned slot before decoding. Enable the decoder and select **WSPR** from the dropdown. Or simply press the **WSPR** button.

---

### HF FAX / WEFAX

HF Radiofax (also known as WEFAX) is used by coast guard and meteorological services worldwide to broadcast weather maps, sea-state charts, and surface analyses over shortwave. The decoder reconstructs the image line by line as it is received.

---

### NAVTEX

NAVTEX is the international maritime broadcast system for coastal safety information — navigational warnings, weather forecasts, and search-and-rescue notices.

---

### FSK / RTTY, PSK31 and Olivia

A general-purpose decoder for narrow-band text modes, with five variants in one window: Maritime FSK (SITOR), Weather RTTY, Amateur RTTY, **PSK31** (phase-shift keying, 31.25 baud) and **Olivia** (multi-tone FSK with forward error correction). The panel adapts to the variant — the shift, baud and framing controls disappear for PSK31 and Olivia, and Olivia adds a Mode selector and a squelch slider.

Two things to know: PSK31 corrects its own tuning error over about ±25 Hz, so you only need to get close; Olivia needs its **Mode** (tones / bandwidth) set to exactly match the transmission, sends no preamble, and therefore takes a few seconds to synchronise before any text appears. The panel opens on Olivia **8 / 250**.

---

### QRSS Grabber

QRSS is CW sent so slowly that a single dot lasts seconds, and it is watched rather than heard — the grabber paints the trace on its own display. It is not in the Decoder dropdown; it has its own **QRSS** section and can run at the same time as a decoder.

Press **🐌 Show**, then pick a window from the **Band** list and press **Tune**: the receiver goes to that frequency in **CW** with a passband sized for the mode, and the trace lands on the centre line of the display. 30 m (10,140.00 kHz) is the busiest window. Set **Speed** to match the beacon — **QRSS 10** if you do not know — and be patient: a callsign can take ten minutes to cross the screen. Full details in [Decoders](DECODERS.md).

---

### SSTV

Slow-Scan Television sends still pictures over a normal SSB channel, one line at a time. Enable the decoder, select **SSTV**, and tune to an SSTV frequency — 14.230 MHz is the main international calling frequency. Leave **Mode** on **Auto**: the decoder reads the transmission's VIS header, and falls back to identifying the mode from the sync timing if you tuned in after the header. Martin, Scottie and Robot modes are supported, and the picture builds line by line as it arrives. Or simply press the **SSTV** button.

### Automatic spot reporting and server graphs

FT8, FT4 and WSPR decodes can also be uploaded automatically by the server itself — FT8/FT4 to PSK Reporter, WSPR to WSPRnet — by an autorun daemon the sysop starts from the admin panel. It is independent of the decoders in your browser: it keeps running whether or not anyone is listening, and nothing you decode in the browser is reported.

The sysop follows it with two counters, which are easy to mistake for each other: the per-decoder tiles count the spots uploaded since the daemon last started, while the number beside each band/mode checkbox is that slot's all-time total and survives restarts. The same panel has a **Graphs** page plotting CPU frequency, CPU load, CPU temperature and users online over the last 15 minutes to 24 hours. Both are described in the [Admin Panel guide](ADMIN_PANEL_SETUP.md).


---

## Keyboard Shortcuts

Keyboard shortcuts for faster operation.

---

### Frequency Control

The frequency display is a row of digits you drive directly. **Click a digit first** — that selects it, and everything below acts on the selection.

- **Arrow Left / Right**: move the selection to the next digit (eight digits, 100 MHz down to 10 Hz)
- **Arrow Up / Down**: step the *selected* digit up or down by its own place value — so the step is 1 MHz on the MHz digit, 10 Hz on the last one
- **0 – 9**: type that digit straight into the selected position

**Mouse wheel over the frequency display**: steps by the band's tuning step (1 kHz unless the band plan sets another). Hold **Shift** for 1 kHz, **Alt** for 10 kHz.

**Mouse wheel over the waterfall**: zooms. Hold **Ctrl** (or **Cmd**) or **Shift** to tune instead of zooming, and **Shift + Ctrl** together to snap to the nearest whole kHz.

> There are no Page Up / Page Down shortcuts.

---

## Bookmarks

Save your favorite frequencies for quick access. You can also export the list of bookmarks and save it locally, then import the list into any other PhantomSDR.

When bookmarks and markers overlap:

🔵 Blue bookmarks appear on top <br /> 🟡 Yellow markers appear underneath <br />
✅ Bookmark clicks take priority <br />


### Adding a Bookmark

1. Tune to desired frequency
2. Click "Bookmarks" button
3. Click "Add Bookmark"
4. Enter description
5. Click "Save"

┌──────────────┬────────────────┬────────┐ │ Bookmark name│Label (optional)│ [Add]  │ └──────────────┴────────────────┴────────┘

### How to Use:

**Add bookmark:**
- Name: "Local News Station"
- Label: "NEWS"
- Click Add

**View on waterfall:**
- Zoom in until markers appear
- See marine blue box with "NEWS" in bold yellow

**Click bookmark:**
- Tunes to frequency
- Sets demodulation mode
- Works exactly like clicking a marker

### Managing Bookmarks
- **Edit**: Click pencil icon next to bookmark
- **Delete**: Click trash icon next to bookmark
- **Export**: Download bookmarks as JSON file
- **Import**: Upload bookmarks from JSON file

### Sharing Bookmarks

1. Click "Export Bookmarks"
2. Share the JSON file with others
3. Recipients click "Import Bookmarks"
4. Select your file
---

## Mobile Usage

PhantomSDR-Plus works great on mobile devices!

### Two mobile views

There are two ways to use the receiver on a phone:

- **`http://your_server:PORT/mobile`** — the simplified page. No waterfall, so it uses roughly half the data. Frequency entry, tuning steps, modes, S-meter, bands, bookmarks, users and chat.
- **The extended view** — the main interface's own phone layout, with the waterfall and the full set of controls.

Switch between them with the buttons at the bottom of `/mobile` (**Mobile extended view**, **Full desktop view**) and the **Simplified mobile** button in the extended layout.

**Your frequency follows you.** Switching view keeps you on the same signal — the frequency and mode travel in the link, so you no longer land back on the receiver's default frequency. The address bar tracks your tuning as well, which means reloading the page, bookmarking it, or sending the link to someone else all return to that exact frequency.

**The mode follows the band plan on both pages.** Tune into a segment marked AM, LSB, USB or CW — by typing a frequency, stepping to it or pressing a band button — and the receiver switches to that mode, on the simplified page as well as the full interface. A mode you pick by hand stays put while you move around inside the same segment, and outside the defined bands your mode is left alone. While RADE (RADEL/RADEU) is running it keeps the receiver, so tuning does not interrupt it.

When you switch between the two views your current mode travels with you, but if the view you are switching to has no equivalent for it, the mode for that frequency is taken from the band plan — a broadcast frequency arrives in AM, 40 m in LSB, a CW segment in CW. `SAM` on the simplified page becomes AM with the synchronous detector in the extended view, and back again. `RADEL` and `RADEU` exist only on the simplified page, so switching away from one of those keeps your frequency and lets the band plan pick the mode.

A frequency outside the receiver's coverage is pulled back to the nearest edge, so an old link can never strand you off-band.

### Mobile-Specific Features

- **Touch-friendly controls**: Large buttons and sliders
- **Swipe to tune**: Swipe left/right on waterfall
- **Pinch to zoom**: Pinch waterfall to zoom in/out
- **Landscape mode**: Rotate for better view

### Mobile Tips

1. **Use WiFi**: Streaming audio uses data
2. **Landscape orientation**: Better waterfall view
3. **Headphones**: Better audio quality
4. **Bookmark favorites**: Easier to revisit stations
5. **Close other apps**: Ensure smooth performance

### Mobile Browser Recommendations

- **Android**: Chrome or Samsung Internet
- **iOS**: Mozilla
- **Both**: Ensure browser is up to date

---

## Tips and Best Practices

### For Best Reception

1. **Choose strong signals**: Look for orange/red on waterfall
2. **Tune precisely**: Click directly on signal center
3. **Select correct mode**: Match the signal type
4. **Adjust AGC**: Fast for AM, Slow for SSB
5. **Use NR/NB**: Help with noisy conditions

### Finding Activity

1. **Watch the waterfall**: Colors show signal strength
2. **Listen on popular frequencies**:
   - 40m: 7.100-7.300 MHz (LSB)
   - 20m: 14.200-14.350 MHz (USB)
   - 2m: 145.200-145.600 MHz (FM)
3. **Check band plan overlay**: Shows frequency allocations
4. **Use bookmarks**: Quick access to active frequencies

### Understanding Band Conditions

**Daytime HF (High Frequency):**
- Higher bands work better (20m, 15m, 10m)
- Long-distance (DX) communication possible
- Broadcast stations audible

**Nighttime HF:**
- Lower bands work better (80m, 40m)
- Different propagation patterns
- Different stations audible

**VHF/UHF:**
- Mostly line-of-sight
- Local communications
- More consistent conditions

### Etiquette

1. **Don't tie up the receiver**: Others want to listen too
2. **Use chat respectfully**: Be courteous to other users
3. **Report problems**: Help the operator maintain the station
4. **Don't ask for tech support**: This is a listening platform. Send a message to the Sysop for help.

---

## Troubleshooting

### No Audio

**Possible causes:**
1. Browser muted → Check browser volume controls
2. System muted → Check computer volume
3. Weak signal → Tune to stronger signal (S7+)
4. Wrong mode → Try different demodulation modes

**Solutions:**
1. Click a strong signal (orange/red on waterfall)
2. Check browser isn't muted (look for mute icon in tab)
3. Try a different frequency
4. Reload the page (F5)

### Distorted Audio

**Possible causes:**
1. Overdriven signal → Signal too strong
2. Wrong mode → AM signal on SSB mode, etc.
3. Interference → Adjacent signals bleeding over

**Solutions:**
1. Reduce volume
2. Try different demodulation mode
3. Use narrower filter bandwidth
4. Tune away from interfering signals

### Waterfall Not Updating

**Possible causes:**
1. Network issue → Slow or interrupted connection
2. Browser performance → Too many tabs open
3. Server overload → Too many users

**Solutions:**
1. Check internet connection
2. Close unnecessary browser tabs
3. Reload page (F5)
4. Try again later when fewer users online

### Can't Tune to Frequency

**Possible causes:**
1. Frequency out of range → SDR doesn't cover that frequency
2. Typing wrong format → Use correct format (e.g., "14200" not "14.200.000")

**Solutions:**
1. Check SDR's frequency coverage (shown on page)
2. Use frequency format examples provided
3. Click on waterfall instead

### Stuttering/Choppy Audio

**Possible causes:**
1. Slow internet connection
2. High server load
3. Browser performance issues

**Solutions:**
1. Close other applications using bandwidth
2. Try again during off-peak hours
3. Close unnecessary browser tabs
4. Use wired connection instead of WiFi

---

## Frequently Asked Questions

### General Questions

**Q: Do I need special equipment to use WebSDR?**
A: No! Just a computer or mobile device with internet access.

**Q: Is WebSDR free to use?**
A: Yes, most WebSDRs are free. They're operated by volunteers.

**Q: Can I transmit with WebSDR?**
A: No, WebSDR is receive-only. You cannot transmit.

**Q: What frequencies can I listen to?**
A: Depends on the WebSDR's configuration. Check the station info.

**Q: Can I record audio?**
A: Some browsers allow recording. Check your browser's features.

### Technical Questions

**Q: What sample rate does the SDR use?**
A: Varies by station. Check the station information page.

**Q: What's the latency?**
A: Typically 2-5 seconds between radio signal and your speakers.

**Q: Can I use multiple instances?**
A: Usually yes, but it may strain the server. Be considerate.

**Q: Does it work offline?**
A: No, WebSDR requires internet connection.

**Q: What browsers are supported?**
A: Chrome, Firefox, Edge, Safari (all recent versions)

### Usage Questions

**Q: How many people can listen at once?**
A: Depends on server capacity. Often 50-200+ users.

**Q: Can I see what others are listening to?**
A: If enabled, yes. Look for "other users" indicators.

**Q: Can I chat with other listeners?**
A: If enabled by operator. Look for chat box.

**Q: Why do some frequencies show nothing?**
A: No signals on that frequency at the moment. Try others!

**Q: What are the colored bands on the waterfall?**
A: Band plan overlay showing frequency allocations.

---

## Resources

### Learning More About Radio

- **Band Plans**: Search "amateur radio band plan" + your region
- **Propagation**: Learn about HF radio wave propagation
- **Digital Modes**: Research FT8, PSK31, RTTY
- **Ham Radio**: Consider getting an amateur radio license!

### Finding More WebSDRs

- **WebSDR Directory**: http://sdr-list.xyz
- **WebSDR.org**: http://websdr.org
- **KiwiSDR**: http://kiwisdr.com/public/

### Getting Help

1. **Station operator**: Check contact info on page
2. **User chat**: Ask other listeners (if available)
3. **Online forums**: Search for WebSDR communities
4. **Documentation**: Refer to this guide!

---

## Appendix: Common Frequencies

### HF Amateur Radio Bands

| Band | Frequency Range | Mode | Activity |
|------|----------------|------|----------|
| 160m | 1.800-2.000 MHz | LSB | Night/Local |
| 80m | 3.500-4.000 MHz | LSB | Night/Regional |
| 40m | 7.000-7.300 MHz | LSB | Day/Night/DX |
| 30m | 10.100-10.150 MHz | USB | Data/CW only |
| 20m | 14.000-14.350 MHz | USB | Daytime/DX |
| 17m | 18.068-18.168 MHz | USB | Daytime/DX |
| 15m | 21.000-21.450 MHz | USB | Daytime/DX |
| 12m | 24.890-24.990 MHz | USB | Daytime/DX |
| 10m | 28.000-29.700 MHz | USB | Sporadic/DX |

### VHF/UHF Amateur Bands

| Band | Frequency Range | Mode | Activity |
|------|----------------|------|----------|
| 6m | 50.000-54.000 MHz | USB/FM | Sporadic |
| 2m | 144.000-148.000 MHz | FM | Very Active |
| 70cm | 420.000-450.000 MHz | FM | Active |

### Broadcast Bands

| Service | Frequency Range | Mode |
|---------|----------------|------|
| AM Radio | 530-1710 kHz | AM |
| Shortwave | 2.3-26.1 MHz | AM |
| FM Radio | 88-108 MHz | WBFM |

### Aviation

| Service | Frequency Range | Mode |
|---------|----------------|------|
| Air Traffic Control | 118-137 MHz | AM |
| ACARS (data) | 130-136 MHz | Data |

### Maritime

| Service | Frequency Range | Mode |
|---------|----------------|------|
| Marine VHF | 156-162 MHz | FM |
| Marine HF | 2-22 MHz | USB |

---

## Glossary

**AGC**: Automatic Gain Control - adjusts audio levels automatically

**AM**: Amplitude Modulation - voice mode used for aviation and broadcast

**Bandwidth**: The frequency range of a signal

**CW**: Continuous Wave - Morse code signals

**DX**: Long distance communication

**FFT**: Fast Fourier Transform - converts time to frequency domain

**FM**: Frequency Modulation - voice mode for VHF/UHF

**HF**: High Frequency (3-30 MHz) - long distance bands

**kHz**: Kilohertz (1,000 Hz)

**LSB**: Lower Sideband - voice mode for lower HF bands

**MHz**: Megahertz (1,000,000 Hz)

**NB**: Noise Blanker - removes impulse noise

**NR**: Noise Reduction - reduces background noise

**PSK**: Phase Shift Keying - digital mode

**RTTY**: Radio Teletype - digital text mode

**S-meter**: Signal strength meter

**SDR**: Software Defined Radio

**SQL**: Squelch - mutes audio when no signal present

**SSB**: Single Sideband (USB or LSB)

**USB**: Upper Sideband - voice mode for higher HF bands

**VHF**: Very High Frequency (30-300 MHz) - line-of-sight

**UHF**: Ultra High Frequency (300-3000 MHz) - line-of-sight

**Waterfall**: Visual display of radio spectrum over time

---

**Enjoy exploring the radio spectrum with PhantomSDR-Plus!**

**73 (Best regards) de SV1BTL & SV2AMK**

For installation instructions, see [INSTALLATION.md](INSTALLATION.md). For technical details, see [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md).
