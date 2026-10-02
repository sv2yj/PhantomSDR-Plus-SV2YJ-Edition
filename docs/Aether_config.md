# KiwiSDR Client Emulation

**Connecting AetherSDR, kiwiclient and other KiwiSDR software to PhantomSDR-Plus**

Since v4.1.0 PhantomSDR-Plus can also answer the **KiwiSDR protocol**, so software written for a KiwiSDR — **AetherSDR**, `kiwiclient` and the rest — connects to your receiver directly. It is a bridge inside the same server process, on the same host and the same port you already publish: no second daemon, no second port, no proxy.

**It is off until you enable it.** Nothing about the bridge runs — not a socket, not a check — while `[kiwi_emulation]` is missing or `false`, which is the state a fresh tree is in.

---

## Table of Contents

1. [What a Kiwi client gets](#1-what-a-kiwi-client-gets)
2. [Installing the bridge](#2-installing-the-bridge)
3. [Switching it on](#3-switching-it-on)
4. [Configuration reference](#4-configuration-reference)
5. [Connecting a client](#5-connecting-a-client)
6. [Audio level](#6-audio-level)
7. [The S-meter](#7-the-s-meter)
8. [Waterfall and spectrum](#8-waterfall-and-spectrum)
9. [If something looks wrong](#9-if-something-looks-wrong)
10. [How far this has been verified](#10-how-far-this-has-been-verified)

---

## 1. What a Kiwi client gets

| | |
|---|---|
| **Audio** | `ws://<host>:<port>/kiwi/<id>/SND` — demodulated audio in the Kiwi's own SND framing |
| **Waterfall** | `ws://<host>:<port>/kiwi/<id>/W/F` — the spectrum, in Kiwi W/F frames |
| **Retuning** | real, not cosmetic: `SET mod=…` from the client changes frequency, sideband and passband on the PhantomSDR side, exactly as a browser listener would |
| **S-meter** | driven from the demodulator's own per-block power, on the same scale as the web S-meter |

Retuning is supported for a **real** input (`signal = "real"` in your `.toml`). For an IQ input the bin-to-frequency relation differs and is not implemented, so an IQ receiver will serve audio and waterfall but will not follow a Kiwi client's tuning.

---

## 2. Installing the bridge

The bridge is a set of patches to the backend sources plus one new header, `src/kiwi_bridge.h`. There are two ways to get them in.

**With the installer.** `install.sh` (and `install_arch.sh`, `install_fedora.sh`, `install_opensuse.sh`) have a step of their own for it — step 17, *Kiwi client emulation*. It is offered, not forced: answer `n` and nothing is patched. For an unattended run, `PHANTOM_KIWI=y|n` decides it, and the default is yes.

**On a tree that is already installed**, run the installer script that ships in the repository root:

```bash
cd ~/PhantomSDR-Plus
./kiwi_install.sh
./recompile.sh          # choose [1] Backend only
```

`kiwi_install.sh` backs every file it touches up into `backup_kiwi_bridge_<timestamp>/` first, and applies each patch by exact text match — if an anchor is not where it expects it (a locally modified tree, a different version), it stops there and then, names the file, and leaves that file untouched. It is idempotent: run it on a tree that already has the bridge and it reports each patch as already applied and changes nothing.

> **If you have just applied an update archive that already contains the bridge, you do not need to run it.** The patched sources are in the drop; `kiwi_install.sh` would only tell you every patch is already in place.

The files it patches are `src/client.h`, `src/signal.cpp`, `src/waterfall.cpp`, `src/spectrumserver.h`, `src/spectrumserver.cpp`, `src/websocket.cpp` and `src/http.cpp`, and it copies `kiwi_bridge.h` into `src/`.

> **It installs the bridge; it does not upgrade one.** If a patch ever *fails* on a tree where the bridge already works, the source has moved ahead of the script and it is the script that needs updating — not your tree.

---

## 3. Switching it on

Add this to the `.toml` your receiver actually runs with — the same file you pass to `spectrumserver`, the one named in your `start-<radio>.sh`. Not `config.example.*`:

```toml
[kiwi_emulation]
enabled = true
```

Then restart the receiver:

```bash
./stop-websdr.sh
./start-<your-radio>.sh
```

`kiwi_install.sh` adds the block for you, with `enabled = true`, to whichever of `config.toml`, `config-rx888mk2.toml`, `config-airspyhf.toml`, `config-rtl.toml`, `config-rsp1a.toml`, `config-fobos.toml`, `config-fobos-hf.toml` and `config-hackrf.toml` exist in the repository root. It cannot know about a config you keep elsewhere or under another name, and **update archives never ship a `.toml`**, so after an update the block is yours to add by hand. The shipped `config.example.*.toml` files carry it documented and set to `false`.

---

## 4. Configuration reference

Everything the bridge reads lives in one `[kiwi_emulation]` section. Only `enabled` is required; the four trims all default to the calibrated value, so a block with nothing but `enabled = true` is already correct.

| Key | Default | What it does |
|---|---|---|
| `enabled` | `false` | Answer the KiwiSDR protocol at all. Off = completely inert. |
| `audio_gain` | `0` | dB. Output gain for Kiwi clients only. See [Audio level](#6-audio-level). |
| `smeter_offset` | `input.analog_smeter_offset` | dB. Overrides the S-meter offset for Kiwi clients only. See [The S-meter](#7-the-s-meter). |
| `wf_cal` | `0` | dB. Display trim for the waterfall and spectrum. See [Waterfall and spectrum](#8-waterfall-and-spectrum). |
| `wf_fps_max` | `23` | Waterfall frames per second. See [Waterfall and spectrum](#8-waterfall-and-spectrum). |

A fully populated block, with the values this project's own receiver runs:

```toml
[kiwi_emulation]
enabled       = true
audio_gain    = 60.0    # dB, Kiwi clients only. 0 = untouched.
wf_cal        = -10.0   # dB, display taste. 0 = agrees with the S-meter.
wf_fps_max    = 28      # frames/s. 23 is the protocol maximum.
# smeter_offset = 5.0   # dB. Defaults to input.analog_smeter_offset.
```

> **Every key here is read at startup.** Changing any of them is a **restart**, not a rebuild — `./stop-websdr.sh` then your start script. You never need to recompile to retune these.

Integer and decimal forms are both accepted: `28` and `28.0` are read identically. Only a key that is genuinely absent falls back to its default.

---

## 5. Connecting a client

Point the client at the same address and port your listeners use — no path, no prefix. AetherSDR asks for a host and a port; `kiwiclient` takes `-s` and `-p`:

```bash
# kiwiclient, recording 30 seconds of 7100 kHz LSB
python3 kiwirecorder.py -s your.receiver.example -p 8073 -f 7100 -m lsb --tlimit=30
```

The client tunes, the waterfall fills, and the S-meter reads. If nothing happens at all, the bridge is almost certainly still disabled — see [section 3](#3-switching-it-on).

---

## 6. Audio level

The first thing most people notice is that a Kiwi client sounds thinner than the PhantomSDR web page. That is not the bridge losing anything: one buffer feeds every encoder, and measuring the same frequency and passband through the browser's own audio path and through `/SND` gives identical samples. The web page is loud because `audio.js` rebuilds the sound in the browser — bass boost, bandpass, a presence lift, a compressor with makeup gain and the volume slider. A Kiwi client has none of that and cannot be given it.

`audio_gain` closes the gap, for Kiwi clients only:

```toml
[kiwi_emulation]
enabled    = true
audio_gain = 55.0       # dB, Kiwi clients only. 0 = untouched.
```

**Start around 55–60 dB.** 55 dB is not arithmetic: it is where a Kiwi client and the PhantomSDR web page were measured level with each other, listening to a strong local signal on 729 kHz. In practice a little more is often preferred — this receiver settled on 60 — so pick it by ear.

You cannot break the audio with it. A **look-ahead peak limiter** sits between the gain and the 16-bit clamp: every sample is delayed by 4 ms while the gain is worked out from audio that has not been sent yet, so a loud passage arrives to a gain that has already come down for it, and peaks fold instead of being flattened. Driven to 60 and even 70 dB — far past the headroom the raw gain has — not one sample in a quarter of a million was clipped. Below the limiter's threshold the gain is exactly 1.0, so a receiver that is not driving the audio hard gets the samples untouched.

What a too-high value costs is loudness, not damage. Above about 60 dB the extra gain is simply limited away: measured here, the level rose about 1 dB from 55 to 60 and hardly moved from 60 to 70. Past that point you are buying compression rather than volume.

None of this touches the web page, and none of it moves the S-meter — that is derived from the demodulator's power, not from the audio samples, so turning the volume up cannot make the meter lie.

---

## 7. The S-meter

The Kiwi S-meter is not calibrated separately: it reproduces what your web page displays, stage for stage. The demodulator's per-block power is the starting point for both, and the page then applies `input.analog_smeter_offset`, expands the result about −130 dBm, and adds its own display offset. The bridge does the same, so a Kiwi client and the page show the same signal at the same strength — verified on a strong local station, where both read −37 dBm.

If, and only if, you want Kiwi clients to read differently from your page, give the bridge an offset of its own:

```toml
[kiwi_emulation]
enabled       = true
smeter_offset = 5.0     # replaces input.analog_smeter_offset for Kiwi clients only
```

> **Compare the two meters on the same filter, or not at all.** The reading comes from the power in the passband, so a wider filter collects more noise and reads higher — on a quiet band the same frequency measured 5.6 dB stronger at 9 kHz wide than at 2.4 kHz. A Kiwi client with a 6 kHz filter against a web page on 2.4 kHz will disagree by several dB no matter how either is calibrated. Match the mode and the bandwidth first.

> **This is the page's scale, not a physical one.** The web meter expands its range for readability, so 10 dB of real signal change is displayed as about 11. Matching it means Kiwi clients agree with your receiver and differ from a genuine KiwiSDR by an amount that grows with signal strength. That is the right trade when your own page is the reference everyone compares against; if you would rather the bridge stayed physically honest, this is the section to change.

---

## 8. Waterfall and spectrum

### The dB scale — `wf_cal`

Each waterfall bin is converted to a real dBm before it is sent, on the same scale the S-meter is calibrated to. A carrier therefore reads the **same level at every zoom**, which is what a genuine KiwiSDR gives you, and the spectrum agrees with the web page's own S-meter over the same passband.

```toml
[kiwi_emulation]
enabled = true
wf_cal  = 0.0           # dB, Kiwi clients only
```

> **`wf_cal` is not a calibration.** `0` is the value at which the spectrum agrees with your S-meter, and that is what to leave it at if you want the numbers to mean something. It exists because how *strong* a spectrum should look is a matter of taste and of what your client does with the range — this project's receiver runs `-10` simply because that is what looks right in AetherSDR. One value moves the spectrum and the waterfall together: they are the same bytes on the wire, and the Kiwi protocol cannot scale them apart. If you want them to differ, that has to come from the client's own display controls.

To check the scale, compare the waterfall summed over the passband against the S-meter on a **quiet** frequency. On a carrier an SSB passband excludes the carrier itself and the two are not comparable.

### The frame rate — `wf_fps_max`

A Kiwi client asks for the fastest waterfall it can have (`SET wf_speed=4`) and paces its scroll — and its spectrum averaging — on the rate the server says it will deliver. If the two disagree the display looks sluggish even though nothing is actually late.

The receiver produces `2 × sps / fft_size` spectra per second. Kiwi clients are served from every one of them and thinned to the rate they asked for; the web page keeps its own slower cadence and is unaffected.

```toml
[kiwi_emulation]
enabled    = true
wf_fps_max = 23         # frames per second
```

`23` is the KiwiSDR protocol's own declared maximum and the safe default. **The lower of `wf_fps_max` and the receiver's own rate always wins**, so raising it does something only if your FFT is fast enough to have frames to spare. Worked example, for a receiver at 60 Msps with a 4194304-point FFT — `2 × 60000000 / 4194304 = 28.6` frames a second:

| `wf_fps_max` | delivered |
|---|---|
| absent (default 23) | 23.0 fps |
| `28` | 28.0 fps |
| `40` | 28.6 fps — the receiver's own ceiling wins |

`SET wf_speed` from the client is honoured as well: `0` off, `1` = 1 fps, `2` a quarter of the maximum, `3` a half, `4` the maximum. A client on a thin link can therefore ask for less.

> **Whether raising it helps is the client's decision, not the server's.** A client that draws each frame as it arrives gives you a smoother scroll; a client that paces itself at the 23 it expects will simply queue the extra frames, and the latency will grow. Try it, and if the waterfall feels laggier rather than smoother, put it back to `23`.

### What sets the rest of the delay

If you are chasing latency, most of it is not in the bridge. The analysis window is `fft_size / sps` wide — 70 ms on a 4194304-point FFT at 60 Msps — and a sample also waits up to half of that for the hop to fill. Halving `fft_size` halves both and doubles the frame rate, but it also halves your frequency resolution, which is what the narrowband decoders (WSPR, FT8, CW) live on. On most receivers that is a poor trade for a few tens of milliseconds. It is a configuration decision in `[input]`, not something the bridge can do anything about.

---

## 9. If something looks wrong

Every command a Kiwi client sends is written to **`/tmp/kiwi_retune.log`** — the tuning requests, the mode changes, the authentication, and anything the bridge did not recognise. It costs nothing measurable and is meant to be left in place. When a client behaves oddly, that file shows what it actually asked for, which is usually the whole answer.

| Symptom | Look at |
|---|---|
| Client connects and immediately drops | `[kiwi_emulation] enabled = true` missing from the config the server was **launched with** |
| No audio, no waterfall, no log lines | the backend was not rebuilt after `kiwi_install.sh` — run `./recompile.sh`, option `[1]` |
| `kiwi_install.sh` stops on a patch | the message names the file and the anchor; the tree has diverged from what the patch expects, and that file was left untouched |
| Audio present but thin and quiet | expected — set `audio_gain`, see [section 6](#6-audio-level) |
| Waterfall scrolls sluggishly | `wf_fps_max`, see [section 8](#8-waterfall-and-spectrum) |
| Tuning in the client does nothing | an IQ input (`signal = "iq"`); retuning is implemented for real inputs only |
| A changed setting had no effect | these keys are read at startup — restart the receiver |

> **AGC is client-side.** `SET agc=` from a Kiwi client is accepted and ignored — the audio arrives with PhantomSDR's own AGC applied, and the client's AGC controls act on what it receives.

---

## 10. How far this has been verified

The wire format has been checked against a live receiver and read line by line against the source of both clients it targets — AetherSDR's `KiwiSdrProtocol.cpp` and kiwiclient's `kiwi/client.py`. Frame layout and size, sequence numbers, byte order, the S-meter scale, retuning and the waterfall all agree. The bridge has also been **confirmed working with the AetherSDR desktop application** itself, by the maintainer, against this receiver.

Measured on that receiver, with a test client on the live sockets: retuning lands in 35–50 ms, audio runs at real time with no drift, and the waterfall delivers the configured rate with no stalls or dropped frames.

If something does look wrong on your own installation, `/tmp/kiwi_retune.log` is the place to look first, and a report either way is welcome.

---

**See also:** [Installation Guide](INSTALLATION.md) · [Project Structure](PROJECT_STRUCTURE.md) · [User Guide](USER_GUIDE.md)
