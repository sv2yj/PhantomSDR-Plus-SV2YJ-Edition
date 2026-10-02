# PhantomSDR-Plus — Decoder User Manual

This guide covers every built-in decoder available in PhantomSDR-Plus. All decoders share the same activation workflow, described below, followed by per-decoder setup instructions.

---

## Table of Contents

1. [How to Start a Decoder](#1-how-to-start-a-decoder)
2. [FT8](#2-ft8)
3. [FT4-FT2](#3-ft4-ft2)
4. [JS8](#4-js8)
5. [CW — Morse Code](#5-cw--morse-code)
6. [QRSS Grabber](#6-qrss-grabber)
7. [WSPR](#7-wspr)
8. [HF FAX / WEFAX](#8-hf-fax--wefax)
9. [NAVTEX](#9-navtex)
10. [FSK / RTTY — including PSK31 and Olivia](#10-fsk--rtty--including-psk31-and-olivia)
11. [SSTV](#11-sstv)
12. [General Tips](#12-general-tips)

---

## 1. How to Start a Decoder

All decoders are accessed from the **Decoder Options** section, located below the Audio Spectrogram controls on the main panel.

**Steps:**

1. Click the **Decoder: OFF** button to switch it to **Decoder: ON** (it turns blue when active).
2. Open the dropdown menu that appears to the right of the button and select the decoder you want.
3. The chosen decoder's panel will appear below the controls — follow the decoder-specific instructions in the relevant section of this guide.
4. To stop decoding, select **— Select decoder —** from the dropdown, or click the **Decoder: ON** button to turn it back OFF.

### One-touch decoder buttons

The dropdown is not the only way in. The main panel carries a **Decoders** button row — directly below **Wheel Tuning Steps** — with one button per decoder:

| Button | Decoder | Button | Decoder |
|---|---|---|---|
| **FT8** | FT8 | **SSTV** | SSTV |
| **FT4** | FT4 | **NAVTEX** | NAVTEX |
| **FT2** | FT2 | **RTTY** | FSK / RTTY |
| **CW** | CW | | |
| **WSPR** | WSPR | **FAX** | HF FAX / WEFAX |

Pressing a button does the whole sequence in one go: it selects the decoder, switches the decoder ON, and scrolls its panel into view. The button turns blue while its decoder is running. **Press the same button again to switch the decoder off** — its window closes with it.

**RADEL** and **RADEU** are deliberately *not* in this row. They are digital-voice modes rather than text decoders, so they have their own pair of buttons next to the **Modes selector** heading, and inside the **Modes** and **Bands** popup windows. Those behave in exactly the same way — press to start, press again to stop. See the [RADE manual](RADE_README.md).

The buttons, the dropdown and the ON/OFF button all drive the same state, so whichever you use, the others follow.

> Only one decoder can be active at a time. Switching to a different decoder automatically stops the previous one.
>
> The **QRSS grabber** is not part of this dropdown — it has its own **QRSS** section and can run at the same time as a decoder.

**Decoding runs in the background.** SSTV, HF FAX, NAVTEX, FSK/RTTY and CW each run in a separate Web Worker thread, so the decoding work never competes with audio playback or the waterfall. Starting or stopping a decoder does not interrupt the audio, and the interface stays responsive while a picture or a page is being received. All decoders are fed raw audio taken *before* AGC, noise reduction and mute — so muting the receiver, or changing those settings to suit your ears, does not affect decoding.

**A running decoder owns the mode and the passband.** Normally the mode follows the band plan in `bands-config.js`: move the dial into a segment marked LSB or AM and the receiver switches to it. While a decoder is running that no longer happens. The decoder holds the mode it needs (USB for most, its own for RADE) and the passband it needs — PSK31 about ±100 Hz, Olivia its full bandwidth, RTTY its shift — and both survive retuning, including a jump to another band. Without this, tuning FT8 on 40 m would flip the receiver to LSB the moment the dial moved, and the narrow decoder passbands would widen back to the full SSB filter.

The band's own mode returns the moment you switch the decoder off. You can still override the mode by hand at any time: the mode buttons are a deliberate choice and always win. The CW decoder is the exception to all of this — it decodes in whatever mode you are listening in and never takes the receiver over.


### Decoder ID — recognising the mode automatically

Above the decoder buttons sits a **Decoder ID** frame. It answers the question *"what am I listening to?"* when you come across a digital signal you cannot place, and then offers the matching decoder in one click.

It is **off by default** and costs nothing while it is off. Press **On** and leave the signal tuned in. For about half a minute it shows *Listening…* with a progress bar — the timing measurements have to see two complete FT8 cycles before they mean anything — and then it names the mode:

```
Decoder ID [On]   NAVTEX / SITOR-B  99% 📻   170 Hz shift · 100.00 Bd · 43 dB S/N   [ Use NAVTEX ]
```

* The **mode** and a **confidence** figure. Green above 75%, amber above 50%, orange below — treat an orange answer as a hint, not a verdict.
* **What was actually measured**: occupied bandwidth, tone spacing, symbol rate, burst length, the UTC grid it fits, signal-to-noise. This is the evidence behind the verdict, so you can judge it for yourself.
* **Use <mode>** starts the right decoder, exactly as if you had pressed its button — and sets the receiver up to work that mode. For the modes that live in the FSK panel it also selects the correct variant — RTTY, Weather RTTY, PSK31 or Olivia.
* Runners-up are listed after **or**. Click one to try it instead, so a wrong first answer costs you nothing.
* **📻** means the frequency you are tuned to is a known calling frequency for that mode, and that this counted towards the ranking.

It never switches your decoder by itself. It only ever suggests. And once you start a decoder — from the button row, from the dropdown, or from Decoder ID's own **Use** button — Decoder ID switches itself off: its job was to choose one, and the decoder now wants the same audio.

**It sets the receiver up for the mode.** Choosing a mode is a decision to work it, so the receiver follows: the tuned frequency moves to the middle of the waterfall and the view becomes about 100 kHz wide around it, the sideband becomes the one that mode is worked on, and the passband narrows to the window that mode lives in — the whole 3 kHz sub-band for FT8, FT4, FT2 and JS8, 1350–1650 Hz for WSPR, 250–750 Hz for NAVTEX, 800–2700 Hz for HF FAX, 900–2600 Hz for SSTV, and ±250 Hz either side of the dial for CW, which also switches the receiver to CW. A narrow passband keeps the neighbouring signals out of the decoder, which is what you would have done by hand. Two exceptions: SSTV keeps the sideband it chose for itself — LSB on 80 and 40 m by convention, where forcing USB would invert its tone mapping — and the FSK modes keep the window their own panel derives from the variant's shift or bandwidth, which is tighter than any fixed figure. Pressing **Use** for the decoder that is already running still switches it off, and then the receiver is left exactly as it was.

**The slow modes take longer.** WSPR sits on a two-minute grid and SSTV pictures run for a minute or two, so those two are named later than the rest — give them three or four minutes on frequency. HF FAX and SSTV are also recognised only when they are tuned the usual way — the picture band sitting between about 1500 and 2300 Hz in the audio, which is where their decoders expect it too. Retuning starts the measurement again from scratch, because everything gathered so far describes the frequency you have just left.

**What it recognises:** FT8, FT4, JS8, WSPR, CW, NAVTEX/SITOR-B, RTTY at 45.45 Bd, Weather RTTY (DWD), PSK31, Olivia, HF FAX, SSTV and DSC. There is no DSC decoder in this build, so DSC is named and marked *no decoder*.

**Recentre & retry.** Where the signal sits in the audio passband makes no difference between about 400 Hz and 2700 Hz. Outside that range the measurement degrades, and an amber **Recentre & retry** button appears. Pressing it moves the dial so that the signal lands in the middle of the passband, and starts a fresh measurement. It is a single calculated move, not a search.

**Three honest limits:**

* **FT8, JS8 and FT2 are the same signal.** The same 8-FSK modulation, the same tone spacing, and JS8 at Normal speed uses FT8's 15-second cadence. Nothing in the signal itself separates them. Frequency does: on an FT8 calling frequency it reports FT8, on a JS8 one it reports JS8, and anywhere else it honestly reports the family — *FT8 / JS8 / FT2*. Start either decoder and see which one produces text.
* **It goes quiet rather than guessing.** Below roughly 10 dB signal-to-noise it reports *Nothing above the noise* or *Not recognised* instead of naming a mode it cannot really see. This is deliberate: a confident wrong answer is worse than no answer at all.
* **A fading signal is read a different way.** WSPR transmits for 110 seconds without a break, which is longer than an ordinary QSB fade, so a deep fade cuts the transmission into pieces and its two-minute rhythm can no longer be read from them. It is then recovered by another route — matching the whole listening history against the two-minute grid instead of against single transmissions — and the evidence line says *120 s grid (through fading)*. That is weaker evidence than a transmission heard whole, so the confidence shown is deliberately lower. A fade deep enough to bury the signal in the noise cannot be recovered at all, and Olivia is stricter than the rest: it will not be named until its symbol rate has been measured, so it falls silent earlier than the other modes.

---

## 2. FT8

**What it is:** FT8 is a popular weak-signal digital mode used by amateur radio operators worldwide. Transmissions last exactly 15 seconds, and the protocol can copy signals up to 20–25 dB below the noise floor. It is the most commonly used mode for long-distance (DX) contacts.

### Recommended frequencies (USB)

| Band | Frequency |
|------|-----------|
| 160m | 1.840 MHz |
| 80m  | 3.573 MHz |
| 40m  | 7.074 MHz |
| 30m  | 10.136 MHz |
| 20m  | 14.074 MHz |
| 17m  | 18.100 MHz |
| 15m  | 21.074 MHz |
| 12m  | 24.915 MHz |
| 10m  | 28.074 MHz |

### Setup

1. Tune to an FT8 frequency listed above and set mode to **USB**.
2. Enable the decoder and select **FT8** from the dropdown. Or simply press the **FT8** button.
3. The **FT8 Messages** panel appears automatically below.

### Reading the output

The message list shows decoded transmissions as they arrive. Each 15-second cycle produces a new batch of messages. The **Farthest** field (top-right of the panel) shows the greatest distance decoded in the current session in kilometres.

Typical message format: `CQ DX AA1BB FN31` — a CQ call from callsign AA1BB located in grid square FN31.

> **Tip:** FT8 is tightly time-synchronised. Your browser uses your computer clock; if your system clock drifts by more than a couple of seconds, decoding will fail. Keep your system time synchronised to NTP.

---

## 3. FT4-FT2

**What it is:** FT4 is a faster variant of FT8 designed for contest-style operation. Each transmission cycle is 7.5 seconds (half of FT8), making it twice as fast but requiring a slightly stronger signal. FT2 is an even faster variant of FT8. It is an ultra-fast 77-bit mode with TR periods of 3.75 seconds (= 1/2 of FT4) — still experimental.

### Recommended frequencies (USB)

| Band | Frequency FT4|
|------|-----------|
| 80m  | 3.575 MHz |
| 40m  | 7.047 MHz |
| 30m  | 10.140 MHz |
| 20m  | 14.080 MHz |
| 15m  | 21.140 MHz |
| 10m  | 28.180 MHz |

| Band | Frequency FT2|
|------|-----------|
|160m | 1.843 to 1.846 |
|80m   | 3.578  to  3.581 |
|60m   | 5.360 (Check local regional regulations) |
|40m   | 7.052  to 7.062 |
|30m   | 10.144 |
|20m   | 14.084 |
|17m   | 18.108 |
|15m   | 21.144 |
|12m   | 24.923 |
|10m   | 28.184 |

### Setup

1. Tune to an FT4 frequency and set mode to **USB**.
2. Enable the decoder and select **FT4** or **FT2** from the dropdown. Or simply press the **FT4** / **FT2** button.
3. The **FT4 Messages** or  **FT2 Messages** panel appears below, identical in layout to the FT8 panel.

> **Note:** FT4 and FT8 use different spectral formats and are not interchangeable. Make sure you are on an FT4 frequency when using this decoder.

---

## 4. JS8

**What it is:** JS8 (the mode used by JS8Call) takes FT8's weak-signal engine and turns it into a keyboard-to-keyboard conversation mode. Where FT8 sends fixed 13-character exchanges, JS8 sends free text a few characters at a time and stitches consecutive transmissions back into whole sentences — so anything longer than about twelve characters arrives over several 15-second cycles. It decodes about as deep as FT8, which makes it usable when voice and CW are not.

### Recommended frequencies (USB)

| Band | Frequency |
|------|-----------|
| 160m | 1.842 MHz |
| 80m  | 3.578 MHz |
| 40m  | 7.078 MHz |
| 30m  | 10.130 MHz |
| 20m  | 14.078 MHz |
| 17m  | 18.104 MHz |
| 15m  | 21.078 MHz |
| 12m  | 24.922 MHz |
| 10m  | 28.078 MHz |

### Speeds

JS8 has five speeds. Every station in a conversation must use the same one. **Normal** is the calling speed and is where almost all activity is — start there.

| Speed | Cycle | Bandwidth | When it is used |
|--------|-------|-----------|-----------------|
| Slow   | 30 s  | 25 Hz  | Very weak paths; the most sensitive |
| Normal | 15 s  | 50 Hz  | The standard calling speed |
| Fast   | 10 s  | 80 Hz  | Quicker exchanges, needs a stronger signal |
| Turbo  | 6 s   | 160 Hz | Strong local signals |
| Ultra  | 4 s   | 250 Hz | Experimental, rarely seen on the air |

### Setup

1. Tune to a JS8 frequency and set mode to **USB**.
2. Enable the decoder and select **JS8** from the dropdown, or simply press the **JS8** button.
3. The **JS8 Decoder** panel appears below. Leave **Speed** on *Normal* unless you know the station you are after is using another.

### Reading the output

The panel has two lists.

**Messages still arriving** appear at the top in green, with a blinking cursor. A JS8 message can take four cycles — a full minute on Normal — so this is where you watch a sentence build up. Nothing has gone wrong if it sits there for a while.

**Completed messages** fill the main list, one row each:

| Column | Meaning |
|--------|---------|
| Mode | Always `JS8` |
| Hz | Audio frequency of the signal inside the passband |
| dB | Signal-to-noise ratio in a 2500 Hz reference bandwidth |
| Message | The decoded text; **callsigns are shown in green** |

Typical messages:

* `SV1BTL KM17: HB` — a heartbeat: the station is announcing it is on the air, with its grid square.
* `KN4CRD: K0OG SNR -05` — a directed message: KN4CRD tells K0OG it is hearing them at −5 dB.
* `MP 100W 8M/BALUN JN58KH AUGSBURG, MARTIN` — free text, in this case a station description that arrived over four cycles.

A message shown **dimmed and in italics** timed out before its last frame arrived. The text is real, but it may be cut short.

### Sync offset

The **Sync offset** slider sets how long after the UTC cycle boundary the receiver starts capturing, which compensates for delay through the audio pipeline. Leave **Auto** ticked: the decoder measures the timing of the signals it hears and adjusts on its own. Only touch the slider if you have a reason to.

### Spectrum marks

The small spectrum strip in the panel draws a yellow vertical line at the frequency of every signal decoded in the last cycle, so the Hz column can be read straight off the display.

### Seeing your own spots

If the receiver is uploading JS8 spots to PSK Reporter (see the admin panel's Spot Reporting tab), the **📡 JS8 map** button in the **Note:** panel opens PSK Reporter's map filtered to this receiver's callsign and mode JS8 — the same thing the **📡 FT8 map** and **📡 FT4 map** buttons do for those modes.

> **Tip:** JS8 is much quieter than FT8. On a mid-band afternoon you may see one transmission every couple of minutes, and long stretches of nothing at all are normal. Give it five or ten minutes before concluding something is wrong. 20m (14.078) and 40m (7.078) are the usual places to look.

> **Tip:** Like FT8, JS8 is tightly time-synchronised and uses your computer's clock. If your system time drifts by more than a second or two, nothing will decode. Keep it synchronised to NTP.

---

## 5. CW — Morse Code

**What it is:** The CW decoder listens for Morse code (continuous wave) signals and converts them to text in real time. It automatically tracks the signal frequency and adapts to the operator's sending speed.

### Recommended frequencies

CW is active across amateur bands, typically at the lower portion of each band. Common spots:

| Band | Segment |
|------|---------|
| 40m  | 7.000–7.040 MHz |
| 20m  | 14.000–14.070 MHz |
| 15m  | 21.000–21.080 MHz |

### Setup

1. Tune to a CW signal using **CW** or **CW-L** demodulation mode as appropriate.
2. Enable the decoder and select **CW** from the dropdown. Or simply press the **CW** button.
3. The **CW Decoder** panel appears below.

### Reading the output

- The panel header shows the detected signal frequency in Hz (e.g. `≈ 700 Hz`) and the estimated sending speed in words per minute (e.g. `· 22 WPM`).
- If no signal is detected the header shows **scanning…**
- Decoded text scrolls in amber monospaced text. The blinking cursor (▋) marks where text is currently being written.
- Click **Clear** to erase the output buffer.

> **Tips:**
> - Centre your passband on the CW tone. The decoder works best when the CW signal sits between roughly 400–900 Hz in the audio spectrum.
> - Very fast or very slow sending, and heavily hand-keyed (irregular) Morse, may reduce accuracy.
> - The decoder performs best on a single clean signal. Strong QRM from nearby signals on the same band may confuse it.

---

## 6. QRSS Grabber

**What it is:** QRSS is CW sent so slowly that a single dot lasts seconds instead of milliseconds. At that speed the signal occupies only a fraction of a hertz, so an analysis narrow enough to match it can pull the trace out from 20–30 dB *below* the noise floor. There is nothing to read by ear — QRSS is **looked at**, not listened to. The grabber runs its own very long FFT over the receiver audio and paints the classic grabber display: frequency on the vertical axis, time scrolling from left to right, the newest column always at the right-hand edge.

Most of what you will see comes from MEPT beacons (Manned Experimental Propagation Transmitter) — low-power transmitters, often a few hundred milliwatts into a wire, identifying continuously in very slow Morse or in patterned FSK.

### Where to look

QRSS beacons live in narrow 100–200 Hz windows near the bottom of each band. You do not have to remember them: the grabber has a **Band** list of the windows below, and picking one tunes there and sets the receiver up for it (see *Opening the grabber*).

| Band | Window centre | Note |
|------|---------------|------|
| 30m  | 10,140.00 kHz | The main QRSS window — busiest by far, day and night |
| 40m  | 7,039.90 kHz | |
| 40m  | 7,000.85 kHz | Knights window, 7,000.8–7,000.9 kHz |
| 20m  | 14,096.90 kHz | |
| 80m  | 3,569.90 kHz | |
| 80m  | 3,568.60 kHz | Older window |
| 80m  | 3,500.85 kHz | Knights window, 3,500.8–3,500.9 kHz |
| 160m | 1,837.90 kHz | |
| 160m | 1,843.30 kHz | Older window |
| 630m | 476.10 kHz | |
| 2200m | 137.70 kHz | LF QRSS / DFCW |
| 60m  | 5,288.55 kHz | |
| 17m  | 18,105.90 kHz | |
| 15m  | 21,095.90 kHz | |
| 12m  | 24,925.90 kHz | |
| 10m  | 28,125.70 kHz | |
| 10m  | 28,000.85 kHz | Older window |
| 10m  | 28,322.00 kHz | Alternative |
| 6m   | 50,294.30 kHz | |

Several bands appear twice because two conventions are genuinely in use. The modern windows sit 200 Hz below that band's WSPR frequency; the older *Knights* windows are somewhere else entirely, and on 40 and 80 m much lower down. If a band is quiet on one, try the other.

These are conventions, not regulations, and some are regional — the 10 m figures in particular vary. Treat the list as a starting point and follow local practice.

### Opening the grabber

The QRSS grabber is **not** in the Decoder dropdown. It has its own **QRSS** section, alongside the Spectrogram and Decoder controls.

1. Click **🐌 Show**. The grabber canvas appears and its controls unfold next to the button.
2. Pick a window from the **Band** list and press **Tune**. This does everything the mode needs in one step: it tunes to the window, switches the receiver to **CW**, and sets a passband just wide enough for the slice you are watching. The dial then reads the true QRSS frequency, and the traces land on the centre line of the display.
3. Set **Speed** to match the beacon's dot length.
4. **Centre** and **Span** work as before; changing either re-shapes the passband to match, so the display and the receiver stay in step.
5. Click **🐌 Hide** to stop. The band's normal mode comes back.

You can still do it by hand instead — tune in **USB** about 1 kHz below the window so the traces land near 800 Hz of audio. The **Band** list only saves you the arithmetic.

While a window from the list is tuned, the grabber holds the receiver the way a decoder does: CW and its passband survive retuning, and the window follows the dial, so the trace stays on the centre line as you hunt along the band. It hands the receiver back when you hide the grabber, click a mode button, or start a decoder.

### Speeds

| Setting | Dot length | Resolution | Analysis window | New column every |
|---------|-----------|------------|-----------------|------------------|
| QRSS 3  | 3 s  | 0.73 Hz | 1.4 s  | 0.7 s  |
| QRSS 6  | 6 s  | 0.37 Hz | 2.7 s  | 1.4 s  |
| QRSS 10 | 10 s | 0.18 Hz | 5.5 s  | 2.7 s  |
| QRSS 30 | 30 s | 0.09 Hz | 10.9 s | 5.5 s  |
| QRSS 60 | 60 s | 0.05 Hz | 21.8 s | 10.9 s |

A setting faster than the beacon wastes sensitivity — the trace comes out thin and noisy. A setting slower than the beacon smears consecutive dots and dashes into one bar. The panel opens at **QRSS 6**, which is a reasonable place to start on an unknown signal: it is more sensitive than QRSS 3, and quicker to update and more forgiving of drift than QRSS 10. Once you can see the shape of the keying, move to the speed the beacon is actually sending — every step up in speed setting costs 3 dB of sensitivity.

### Controls

| Control | What it does |
|---------|--------------|
| **Band** | The QRSS windows listed above. **Tune** goes to the selected one in CW with a matching passband. |
| **Speed** | Sets the transform length — the trade between frequency resolution and time resolution (table above). |
| **Centre** | Audio frequency at the middle of the display, 100–3000 Hz. |
| **Span** | Height of the displayed slice: 20, 50, 100 or 200 Hz, opening at 100 Hz — the width of a QRSS sub-band. A narrower span spreads each trace over more pixels. Wider spans fit more bins into the panel than it has pixel rows; each row then shows the strongest bin it covers, so nothing can hide between rows. |
| **Gain** | −10 to +40 dB. Shifts the colour map relative to the measured noise floor; raise it to brighten faint traces. |
| **Color** | Rainbow, Green or Grayscale. |
| **Clear** | Wipes the canvas and resets the noise reference. |

### Reading the display

Frequency ticks run down the left edge, highest frequency at the top. Under the canvas a status line shows the selected speed, the resolution actually in use (e.g. `0.183 Hz/bin · 5.5 s window`) and the column rate (e.g. `2.7 s/column`).

The colour map is referenced to the **current** noise, measured continuously from the empty parts of each column, not to an absolute level. Volume, AGC, antenna and band changes therefore do not require re-adjusting Gain — the display keeps a constant contrast against whatever the band noise happens to be. As with the decoders, the audio is taken before AGC, noise reduction and mute, so you can mute the receiver and keep watching.

What the shapes mean:

- A **steady carrier** draws a straight horizontal line.
- **Slow Morse** draws that line as a chain of short and long segments — dots and dashes read left to right.
- **Curved or drifting traces** are an unstabilised beacon oscillator warming up or cooling down. This is normal, and the drift signature is often how a regular grabber-watcher recognises a station.
- **Vertical streaks** across the whole slice are static crashes or local noise bursts, not signal.

> **Tips:**
> - Be patient. At QRSS 30 a single column takes 5.5 seconds, so a complete callsign can take ten minutes or more to cross the screen. Leave it running.
> - Tuning from the **Band** list already narrows the passband around the window. If you tuned by hand, do it yourself: it does not change what the transform resolves, but it keeps strong neighbours from working the receiver's AGC.
> - The grabber is independent of the decoders — you can leave it running while a decoder works on something else.
> - A wide span at a slow speed is the heaviest combination; the whole transform runs in the browser, so on a modest machine prefer a 50 Hz span.

---

## 7. WSPR

**What it is:** WSPR (Weak Signal Propagation Reporter, pronounced "whisper") is an ultra-weak-signal beacon mode that maps HF propagation paths worldwide. Each transmission takes approximately 110 seconds and fits inside a 200 Hz-wide slot. The decoder waits for a complete 2-minute UTC-aligned slot before decoding.

### Recommended frequencies (USB, dial)

| Band | Dial frequency |
|------|---------------|
| 160m | 1.836.600 MHz |
| 80m  | 3.568.600 MHz |
| 40m  | 7.038.600 MHz |
| 30m  | 10.138.700 MHz |
| 20m  | 14.095.600 MHz |
| 17m  | 18.104.600 MHz |
| 15m  | 21.094.600 MHz |

### Setup

1. Tune to a WSPR dial frequency above and set mode to **USB**.
2. The WSPR signal occupies the 1400–1600 Hz audio range. Selecting **WSPR** does the rest for you: the receiver switches to USB and the passband narrows to 1350–1650 Hz, which covers the whole range the decoder searches. You do not need to adjust it further.
3. Enable the decoder and select **WSPR** from the dropdown. Or simply press the **WSPR** button.
4. The **WSPR-2 Decoder** panel appears below.

### Reading the output

The panel shows a progress bar for the current 2-minute slot:

- **Cyan bar filling** — collecting signal data (0–116 s into the slot).
- **Amber bar pulsing** — decoding in progress (last ~4 s of the slot).
- **Empty bar** — waiting for the next even UTC minute.

Each successfully decoded spot is shown in a table with the following columns:

| Column | Meaning |
|--------|---------|
| UTC | Time of the spot (even minute) |
| Callsign | The station that transmitted |
| Grid | Maidenhead locator of the transmitter |
| Power | Transmitted power in dBm |
| Freq | Exact audio frequency (Hz) within the WSPR passband |
| SNR | Signal-to-noise ratio in dB |

Click **Clear** to erase the spot list.

> **Tip:** WSPR decoding requires very accurate system time (within ±1 second of UTC). The first slot after enabling the decoder will begin at the next even UTC minute — a short wait is normal.

---

## 8. HF FAX / WEFAX

**What it is:** HF Radiofax (also known as WEFAX) is used by coast guard and meteorological services worldwide to broadcast weather maps, sea-state charts, and surface analyses over shortwave. The decoder reconstructs the image line by line as it is received.

### Setup

1. Enable the decoder and select **HF FAX / WEFAX** from the dropdown. Or simply press the **FAX** button.
2. The **HF FAX / WEFAX Receiver** panel appears below.
3. **Select a station** from the Station dropdown. Over 20 stations are available covering Europe, Asia, Oceania, and the Americas (e.g. DDH3/DDK3 Germany, SVJ4/GR Greece, JMH Japan, NMG USA New Orleans).
4. If the station broadcasts on more than one frequency, select the desired frequency from the **Frequency** sub-dropdown.
5. Click **▶ Tune** to automatically tune the waterfall to that station.
6. The mode is forced to **USB** automatically.

### Broadcast schedule

When a station is selected, a **Next Transmissions** countdown table appears showing the next 4 scheduled broadcasts in UTC, with a live countdown:

- Normal (grey/green) — transmission is coming up.
- **Amber ⚡** — transmission starts within 3 minutes; arm the decoder now.
- **Red ●** — transmission starts within 30 seconds; reception is imminent.

### Parameters

Most stations use the standard defaults (marked ★). Change only if you know the station uses non-standard settings.

| Parameter | Default | Description |
|-----------|---------|-------------|
| LPM | 120 ★ | Lines per minute — the drum rotation speed |
| IOC | 576 ★ | Index of cooperation — determines pixels per line |
| Shift | 800 Hz ★ | Frequency shift between black and white tones |

### Controls

- **⇔ Auto-align** — enabled by default. Automatically synchronises to the phasing signal at the start of each image. Disable only if you are experiencing alignment problems on a known-good signal.
- **⇅ Invert** — swaps black and white. Use if the image appears as a negative (white areas where black should be).
- **↺ Refresh** — clears the canvas and resets the decoder. Use this between transmissions or if the image tears or drifts.
- **⤓ Save PNG** — saves the current canvas as a PNG file to your computer.

### Status indicators

At the bottom of the image, two tone indicators show:

- **300 Hz phasing** — lights cyan when the start-of-image phasing tone is detected.
- **450 Hz stop** — lights red when the end-of-image stop tone is detected.

> **Note:** The image scrolls upward — the newest received line always appears at the bottom of the canvas. If you see **[PHASING]** in the header, the decoder has locked onto a new image start.

---

## 9. NAVTEX

**What it is:** NAVTEX is the international maritime broadcast system for coastal safety information — navigational warnings, weather forecasts, and search-and-rescue notices. It uses 100-baud FSK (SITOR-B with FEC) and is received on dedicated channels worldwide.

### Available channels

| Channel | Frequency | Usage |
|---------|-----------|-------|
| International | 518 kHz | English-language, international |
| Domestic | 490 kHz | National language broadcasts |
| HF (×5) | 4209.5 / 6314 / 8416.5 / 12579 / 16806.5 kHz | Long-range HF NAVTEX |

### Setup

1. Enable the decoder and select **NAVTEX** from the dropdown. Or simply press the **NAVTEX** button. The receiver switches to **USB** automatically.
2. The **NAVTEX Receiver** panel appears.
3. Select the desired channel from the **Station** dropdown (e.g. `International — 518 kHz`).
4. Click **⇒ Tune & Set IF** to automatically tune the waterfall and narrow the passband to the correct audio window. Mode is set to **USB** automatically. The dial is placed 500 Hz below the channel centre, so the NAVTEX signal appears at 500 Hz audio.

### Broadcast schedule

The schedule table lists all known stations on the selected channel with:

- Their ITU identifier letter and country flag
- Next broadcast time in UTC
- Live countdown to the next transmission
- **Amber ⚡** within 2 minutes / **Red ●** within 30 seconds — arm the decoder now

### Reading the output

Decoded text appears in teal monospace. Message boundaries are clearly marked:

```
━━ ZCZC MA12 ━━
... message content ...
━━ NNNN ━━
```

`ZCZC` marks the start of a message. The three characters after it identify the station (`M`), subject (`A` = navigational warnings), and sequential number (`12`). `NNNN` marks the end.

Click **Clear** to erase the message buffer.

> **Note:** NAVTEX operates on MF and LF frequencies (518/490 kHz). Reception range is typically 200–400 nautical miles from the transmitter. The HF channels (4–17 MHz) provide much greater range.

---

## 10. FSK / RTTY — including PSK31 and Olivia

**What it is:** A general-purpose decoder for narrow-band text modes, with five operating variants selected from one dropdown. Three are true FSK (Frequency-Shift Keying): Maritime FSK (SITOR), Weather RTTY and Amateur RTTY. The other two are not FSK at all but share the same window: **PSK31**, which is phase-shift keying, and **Olivia**, which is multi-tone FSK with forward error correction. Each variant comes with a preset tuned to its standard parameters.

### Variants and presets

| Variant | Center | Shift | Baud | Framing | Encoding |
|---------|--------|-------|------|---------|----------|
| Maritime FSK / SITOR | 500 Hz | 170 Hz | 100 | 7N1 | CCIR-476 |
| Weather RTTY | 1000 Hz | 450 Hz | 50 | 5N1.5 | ITA2 |
| Amateur RTTY | 1000 Hz | 170 Hz | 45.45 | 5N1.5 | ITA2 |
| PSK31 (BPSK) | 1000 Hz | — | 31.25 | — | Varicode |
| Olivia (MFSK) | 1000 Hz | — | see mode | — | 7-bit + FEC |

The panel adapts to the variant you choose. **Shift**, **Baud**, **Framing**, **Encoding**, **Invert mark / space** and **Auto shift detect** are hidden for PSK31 and Olivia, because neither mode has a mark/space tone pair or UART-style framing. In their place, **Center audio** becomes a free-entry number field (the carrier can sit anywhere in the passband), and Olivia gains a **Mode** selector and a **Squelch** slider.

### Setup

1. Enable the decoder and select **FSK / RTTY** from the dropdown. Or simply press the **RTTY** button.
2. The decoder panel appears. Its title follows the variant — *FSK / RTTY Decoder*, *PSK31 Decoder* or *Olivia Decoder*.
3. Select the **Variant**. The parameters update automatically.
4. For Olivia, set **Mode** (tones / bandwidth) to match the transmission — see the Olivia notes below.
5. Use the **Known frequency** dropdown to select a common frequency for the chosen variant, then click **Tune** to jump to it.
6. Fine-tune frequency until decoded text becomes stable and readable.

### Known frequencies by variant

**Maritime FSK / SITOR**
- 518.0 kHz — International NAVTEX
- 490.0 kHz — National NAVTEX
- 4209.5 / 6314.0 / 8416.5 / 12579.0 / 16806.5 / 22376.0 kHz — HF SITOR

**Weather RTTY**
- 4583.0 / 7646.0 / 10100.8 / 11039.0 / 14467.3 kHz — DWD (German Weather Service)

**Amateur RTTY**
- 3590 kHz (80m), 7043 kHz (40m), 10143 kHz (30m), 14083 kHz (20m), 21083 kHz (15m), 28083 kHz (10m)

**PSK31**
- 3580.15 kHz (80m), 7040.15 kHz (40m), 10142.15 kHz (30m), 14070.15 kHz (20m), 18100.15 kHz (17m), 21080.15 kHz (15m), 24920.15 kHz (12m), 28120.15 kHz (10m)

**Olivia**
- 3577.75 kHz (80m), 7073.75 kHz (40m), 10142.25 kHz (30m), 14075.5 kHz (20m), 18103.75 kHz (17m), 21075.75 kHz (15m), 24921.75 kHz (12m), 28123.75 kHz (10m)

### Parameters

| Parameter | Applies to | Description |
|-----------|------------|-------------|
| Center audio (Hz) | all | The audio frequency of the mark/space midpoint; for PSK31 the carrier, for Olivia the centre of the tone block. A dropdown for the FSK variants, a free-entry field for PSK31 and Olivia |
| Shift (Hz) | FSK only | Frequency difference between mark and space tones |
| Baud | FSK only | Symbol rate |
| Framing | FSK only | Data bits, parity, stop bits (e.g. 7N1 = 7 data, no parity, 1 stop) |
| Encoding | FSK only | Character set (CCIR-476, ITA2/Baudot, or ASCII) |
| Invert mark / space | FSK only | Swaps mark and space tones |
| Auto shift detect | FSK only | Attempts automatic shift measurement from the incoming signal |
| Mode (tones / Hz) | Olivia only | Number of tones and bandwidth — must match the transmission exactly |
| Squelch (FEC S/N) | Olivia only | How strong the error-correction match must be before text is printed |

### Signal metrics

The status bar shows live measurements, and the fields change with the variant:

| Variant | Fields shown |
|---------|--------------|
| FSK variants | **Mark / Space** (measured tone frequencies), **SNR**, **Lock**, **Timing** |
| PSK31 | **Carrier** (Hz, after automatic frequency correction), **IMD** (dB), **S/N**, **Lock**, **Timing** |
| Olivia | **Centre** (Hz), **Mode**, **S/N**, **FEC** (%), **Sync** |

`Timing`/`Sync` reads `LOCKED`/`SYNCED` once the decoder is tracking, and `SEARCH` while it is still hunting.

### Additional controls

- **⇒ Set IF Band-Pass** — narrows the receiver passband to tightly bracket the signal. The width follows the variant: mark/space plus margin for FSK, about ±100 Hz for PSK31, and the full tone-block width plus margin for Olivia.
- **⟳ Auto-tune Center** — automatic search for the signal. For the FSK variants it looks for a balanced pair of tones; for PSK31 it finds the carrier; for Olivia it finds the strongest block of the selected bandwidth.

### PSK31 notes

PSK31 is the most common keyboard-to-keyboard mode on HF. It is only 62 Hz wide, so several QSOs sit side by side within a few hundred hertz of the watering-hole frequency, and tuning is a matter of picking one trace out of the group on the waterfall.

- The decoder corrects its own tuning error automatically over roughly **±25 Hz**, so you only need to get close. **Carrier** in the metrics row shows where it actually settled.
- **IMD** measures transmitter quality, not reception: a clean signal reads about −20 dB or better. A poor reading means the other station is overdriving, not that you are mistuned.
- Text appears character by character with no error correction, so a weak signal degrades into occasional wrong letters rather than stopping.

### Olivia notes

Olivia trades speed for robustness. It is far slower than PSK31 but decodes signals that are inaudible by ear, which makes it popular for weak-signal and long-distance contacts.

- **The Mode setting must match the transmission exactly.** A wrong tones/bandwidth combination decodes nothing at all — not garbled text, but silence. The panel opens on **8 / 250**, the narrow configuration left running on the calling frequencies; **16 / 500** and **32 / 1000** are the other two in common use, and **16 / 1000** is also offered.
- Olivia sends no preamble, so the decoder has to search for synchronisation. **Allow a few seconds** after tuning before text appears. The **Sync** field shows `SEARCH` until it locks.
- The error correction works on blocks, so text arrives in **bursts rather than a steady stream**, and there is a delay of several blocks between transmission and display.
- **Squelch (FEC S/N)** sets how confident the error correction must be before printing. The default of 4.0 keeps noise out; 3.0 is the floor, below which random noise starts printing occasional characters. A good signal reads 8–9 on the **FEC** meter, so there is plenty of room to raise the squelch on a busy band.

> **Mode note:** The decoder takes control of the demodulation mode and IF passband while active. Both are restored automatically when you disable the decoder. All five variants use **USB**.
>
> **Polarity note (FSK variants only):** For Weather RTTY you usually need to check **Invert mark / space**. For Maritime FSK (SITOR/NAVTEX-style) and Amateur RTTY, leave it unchecked — amateur RTTY sends mark as the higher radio frequency, and USB keeps it as the higher audio tone, which is the unchecked case. If decoded text is garbled, toggling this checkbox is the first thing to try. The checkbox is hidden for PSK31 and Olivia, which have no mark/space pair.
>
> **Letters/figures note (FSK variants only):** Baudot carries letters and figures in two separate states, and noise can flip the decoder into the wrong one — which garbles every following character, not just the damaged one. The decoder therefore returns to letters on every space, standard practice that repairs a corrupted shift within a word or two instead of a whole line. The cost is that groups of digits separated by spaces need the sender to repeat the figures shift after each space, as transmitters normally do.

---

## 11. SSTV

**What it is:** Slow-Scan Television transmits still pictures over a normal SSB voice channel, one line at a time, as a frequency-modulated tone between 1500 Hz (black) and 2300 Hz (white). A full picture takes between 36 seconds and 4½ minutes depending on the mode.

### Recommended frequencies (USB)

| Band | Frequency | Mode | Notes |
|------|-----------|------|-------|
| 20m | 14.230 MHz | USB | The main international SSTV calling frequency — by far the most active |
| 20m | 14.233 MHz | USB | Secondary, used when 14.230 is busy |
| 15m | 21.340 MHz | USB | |
| 10m | 28.680 MHz | USB | Active during band openings |
| 40m | 7.171 MHz | LSB | |
| 80m | 3.845 MHz | LSB | Regional, evenings |

**Sideband is chosen for you.** Starting the decoder selects **LSB below 10 MHz** and **USB above it**, following normal amateur practice. On the wrong sideband the tone mapping is inverted and the picture will not decode. If you meet a station that ignores the convention, simply change the sideband by hand — the decoder stays running, clears the frame and starts fresh on the new setting.

### Setup

1. Enable the decoder and select **SSTV** from the dropdown. Or simply press the **SSTV** button. The receiver switches sideband automatically — USB above 10 MHz, LSB below.
2. Tune so the picture tones fall in the middle of the passband. A correctly tuned signal has its sync pulses at 1200 Hz and the picture content between 1500 and 2300 Hz.
3. Leave **Mode** on **Auto** unless you already know what is being sent. The image builds line by line as it is received.

### Modes

| Setting | Picture | Duration |
|---------|---------|----------|
| **Auto** | Detected automatically | — |
| Martin M1 / M2 | 320×256 colour | 114 s / 58 s |
| Scottie S1 / S2 | 320×256 colour | 110 s / 71 s |
| Scottie DX | 320×256 colour | 269 s |
| Robot 36 / 72 | 320×240 colour | 36 s / 72 s |

**Auto** works two ways: it reads the **VIS header** — the digital mode code sent in the first 300 ms of a transmission — and, if the header was missed (you tuned in late, or it was lost in QSB), it identifies the mode from the sync-pulse timing instead. Selecting a specific mode forces that mode, but the decoder still verifies the sync before it draws anything, so a wrong choice produces no picture rather than noise.

### Reading the output

The status line under the controls reports what the decoder is doing:

| Status | Meaning |
|--------|---------|
| `Waiting for VIS / AUTO lock` | Listening; nothing identified yet |
| `Martin M1? verifying sync…` | A candidate was found and is being confirmed against the next lines |
| `Martin M1 lock (VIS)` | Locked from the VIS header |
| `Martin M1 lock (AUTO)` | Locked from sync-pulse timing |
| `Martin M1 lock (MANUAL)` | Started by the **⏺ Force** button |
| `Candidate rejected (no sync)` | The candidate failed confirmation — normal on noise |
| `— sync lost, resetting` | The signal disappeared mid-picture |
| `Frame complete` | The full picture was received |

The detected mode also appears in green next to the **SSTV** title, and the line counter shows progress.

### Controls

| Button | Action |
|--------|--------|
| **▶ Start** | Arms the decoder. It does not draw a picture by itself — a lock still has to come from the VIS header or from sync detection. |
| **■ Stop** | Stops decoding. |
| **↺ Reset** | Clears the canvas and re-arms in place. Use it between pictures, or after retuning. |
| **⏺ Force** | Starts drawing **immediately** in the mode selected in the dropdown, skipping VIS and sync detection entirely. Only available when Mode is not **Auto**. |
| **💾 Save** | Saves the current image as a PNG. |

**When to use Force.** If you can see a picture in the waterfall but the decoder will not lock onto it — an unusual mode, a signal too weak or too distorted for the detectors, or a header you missed — select the mode by hand and press **⏺ Force**. The frame is anchored at the moment you click, and the mode badge shows `MANUAL` so you can tell it from a VIS or AUTO lock. The decoder still snaps to a real sync pulse if it finds one, so a click that is slightly early or late is corrected.

Because Force skips every safety check, it will happily paint noise if you press it on an empty channel, and it will not stop on its own — press **■ Stop** or **↺ Reset**.

### Notes

- **Noise will not start the decoder.** Static crashes, sparks and mains hash used to be enough to trigger a decode. Every detection stage now tests that the tone is a genuine tone and confirms the candidate against the following lines before a single pixel is drawn. Expect the decoder to sit quietly on an empty band.
- **The picture drifts diagonally if you are off frequency.** SSTV is unforgiving of tuning error. If lines slant, adjust the dial in small steps and let the next picture start.
- Colour balance and sharpness are fixed; there are no adjustments to make.

---

## 12. General Tips

**Decoder: ON must be engaged first.** The dropdown is disabled (greyed out) until you click the Decoder button to turn it on.

**One decoder at a time.** Selecting a new decoder from the dropdown automatically stops the previously active one and resets any mode or passband changes it made.

**Mode is managed for you.** HF FAX and NAVTEX switch the receiver to USB as soon as you select them, and SSTV picks the sideband from the band (LSB below 10 MHz, USB above), and FAX, NAVTEX and FSK also adjust the passband when you click their Tune button. FT8, FT4, FT2, JS8 and WSPR do the same as soon as you select them — from the button row or the dropdown — switching the receiver to USB and setting their own passband: the whole 3 kHz sub-band for the FT8 family, 1350–1650 Hz for WSPR. When you stop the decoder, the band's default mode is restored.

**Switching a decoder on no longer interrupts the audio.** The decoders run on their own threads, so there is no gap, click or dropout when one starts, stops, or is swapped for another.

**System clock accuracy matters.** FT8, FT4, and WSPR are time-critical. They decode in fixed UTC-aligned windows. If your computer clock is off by more than 1–2 seconds, decode rates will drop significantly. Use an NTP client to keep your clock accurate.

**The noise filters do not reach the decoders.** NR, NB, NS and AN are listening
aids for your ears only. Every decoder — FT8, FT4/FT2, CW, WSPR, FAX, NAVTEX, FSK/RTTY/PSK31/Olivia, SSTV and the QRSS grabber — taps the audio *before* those filters, so set them however sounds best without worrying about decode quality. For the same reason the decoders keep running while the receiver is muted or squelched: you can silence the speaker and leave a decoder or an overnight QRSS grab collecting. The one thing that does follow what you hear is the Audio Spectrogram, which is meant to show the filtered audio.

**Signal quality beats signal strength.** Most of these decoders are designed for weak signals. A quieter band with lower noise is often more productive than a loud, interference-filled signal. Use the waterfall and passband controls to identify and avoid QRM before enabling a decoder.

**Use the Refresh or Clear buttons liberally.** FAX images drift if the dial frequency is slightly off, and text decoders accumulate noise characters. A fresh start after tuning adjustments often produces much cleaner output.

### Automatic spot reporting and server graphs

FT8, FT4 and WSPR decodes can also be uploaded automatically by the server itself — FT8/FT4 to PSK Reporter, WSPR to WSPRnet — by an autorun daemon the sysop starts from the admin panel. It is independent of the decoders in your browser: it keeps running whether or not anyone is listening, and nothing you decode in the browser is reported.

The sysop follows it with two counters, which are easy to mistake for each other: the per-decoder tiles count the spots uploaded since the daemon last started, while the number beside each band/mode checkbox is that slot's all-time total and survives restarts. The same panel has a **Graphs** page plotting CPU frequency, CPU load, CPU temperature and users online over the last 15 minutes to 24 hours. Both are described in the [Admin Panel guide](ADMIN_PANEL_SETUP.md).

---

*PhantomSDR-Plus — sv1btl fork — [phantomsdr.no-ip.org](http://phantomsdr.no-ip.org:8900)*
