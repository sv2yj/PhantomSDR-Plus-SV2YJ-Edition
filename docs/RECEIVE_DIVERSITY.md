# PhantomSDR-Plus — Receive Diversity

Combine your receiver with a **second receiver somewhere else** and listen to whichever of the two currently has the better signal. When one site drops into a fade, the other usually has not, and you keep copy through it.

The second receiver can be another PhantomSDR-Plus, a KiwiSDR, an UberSDR or a WebSDR. For the first three, everything runs in the browser: no server changes, no configuration files, nothing to install, and no special access to the other receiver. A WebSDR is the exception and needs one small piece of software on your own server — see [Using a WebSDR](#using-a-websdr) below.

---

## What it does, and what it does not

Diversity here means **selection**: at any moment you are listening to one site or the other, with a short crossfade when it switches. It is not a phased array and it does not add the two signals together.

That is a deliberate choice, and the reason is physics rather than software. Two receivers hundreds of kilometres apart hear the same transmission over different ionospheric paths. The two audio waveforms arrive with unrelated phase and slightly different Doppler, so adding them sounds hollow and comb-filtered — the classic "phasey" artefact. True coherent combining needs two receivers on a **common clock**, sample-aligned; two independent receivers connected over the internet can never provide that.

So what you gain is **continuity, not raw signal strength**:

- On a stable path where one receiver is simply better, you will hear that receiver and gain nothing. This is normal.
- On a fluttery path with deep QSB, fades at two distant sites are largely uncorrelated. Site A drops out for three seconds, site B does not, and the audio carries on. Expect *"I stopped losing words"*, not *"S3 became S7"*.
- The second win is often **local noise and QRM**. Two sites have different neighbours, different power lines and different broadcast splatter. On a noisy band this can matter more than the fading.

There is a cost: you listen **one to three seconds behind real time**, because the earlier stream has to be delayed to match the later one. That is irrelevant for listening and decoding, and unhelpful if you are trying to work a station.

> [!NOTE]
> The digital decoders (FT8, JS8, WSPR, RADE and the rest) deliberately keep using your **local** receiver, not the combined audio. Those modes integrate coherently across a whole transmission slot, and switching sites in the middle of a slot is a phase discontinuity that can cost you the very decode diversity was meant to save. Diversity serves the speaker; the decoders keep the continuous local stream.

---

## Quick start

1. Open the **Receive Diversity** panel — it sits just below the decoder windows, collapsed, showing `Receive Diversity — off`. Click it to expand.
2. Choose what the second receiver is: **PhantomSDR+**, **KiwiSDR**, **UberSDR** or **WebSDR**.
3. Type its address — or pick one you have saved — and press **Start**.
4. Tune your own receiver normally. The second receiver **follows automatically** — frequency, mode and passband — every time you retune.

That is the whole setup. There is nothing to configure on the other receiver, and no separate tuning control: it always tracks you.

### Addresses

| Second receiver | What to type | Notes |
|---|---|---|
| PhantomSDR+ | `host:8900` | The receiver's normal port |
| KiwiSDR | `host:8073` | The KiwiSDR's own port |
| UberSDR | `host` | Its **normal web port**, not 8073 |
| WebSDR | `host:8901` | The site's own port. Needs the relay — see below |

A bare hostname, an `http://` URL or a full `ws://` URL are all accepted. If the other receiver is served over HTTPS, type the hostname and it will use a secure connection.

### Saved receivers

Every address you connect to is remembered, in a list of its own for each receiver type — a KiwiSDR address is never a useful suggestion when the selector says WebSDR. The lists live in your own browser: they are not sent anywhere, and every listener has their own.

The **☰** button beside the address box opens the list.

- **Names.** Any entry can be given a name — `Twente` reads better than `websdr.ewi.utwente.nl:8901`. Named entries appear in green above their address, and the name shows beside the address in the drop-down as you type. An entry is identified by its address, so naming one never puts the same station in the list twice. While diversity is running, the receiver it is running against shows its name **bold and slowly blinking**, so the list also says which one you are actually hearing.
- **add** enters a receiver by hand, without connecting to it first. **✎** corrects a name and address in place, **✕** removes one entry, and **clear all** empties the list for the type on screen. Enter saves, Escape cancels.
- **🌍** opens that receiver's own web page in a new tab. The address stored is the one the software dials, so it is turned back into a browsable one first — `ws://` becomes `http://`, and the `/audio`, `/ws` or KiwiSDR `/kiwi/…/SND` path each kind of receiver needs is trimmed away, since the site's own page is at the root. It is a real link, so a middle click or a long press behaves as usual.
- **The order is yours.** Move a row with **▲▼**, or drag it and drop it where it belongs. That is the order in which the drop-down offers the addresses.
- **⭳ export and ⭱ import.** The lists are held in the browser's own storage, which is thrown away when you clear the site's data — this is what protects against that. Export writes all four lists, names included, to a JSON file you can keep or carry to another browser or machine. Import reads it back and asks whether to **merge** it with what is saved or **replace** everything.
- **▦ QR.** Draws every list as a QR code on the screen, for carrying it to a phone — see "On a phone" below. A list too large to scan falls back to the text beside it, which can be copied and pasted anywhere.

There is no limit on how many receivers you keep.

### On a phone

The `/mobile` page has the same feature in a **Div** tab, beside Audio, Bands, Marks, Users and Chat: the receiver type, the address, Start and Stop, the saved receivers as a tap-to-pick list, the live figures and the SNR trim. Each row also carries the **🌍** link to that receiver's own page. The second receiver follows the phone's tuning by itself, exactly as on the desktop page. What it leaves out is the editing — renaming, reordering, deleting — which stays on the desktop page, where there is room for it.

The saved list belongs to one browser, so a phone starts with an empty one however many receivers are saved on the desktop. That is what the QR code is for: press **☰** then **▦ QR** on the desktop, scan the code with the phone's camera, and paste the text into **Import** on the Div tab. It asks whether to merge or replace, and Export on the phone sends a list back the other way.

---

## Using a WebSDR

A WebSDR — the software written by Pieter-Tjerk de Boer, PA3FWM, that runs at Twente and several hundred other sites — can be used as the second receiver, but not directly from the browser.

The reason is a deliberate check on their side. A WebSDR refuses its audio connection unless the `Origin` header names its own site, and `Origin` is a *forbidden header name*: the browser sets it from the page you are on and no script is permitted to change it. There is no client-side way around this, and there should not be.

So the connection is made by a small program on your own server instead, `websdr_relay.py`. Your browser talks to the relay, and the relay talks to the WebSDR.

### Installing the relay

The four distribution installers offer it as an optional step. To add it to an existing installation:

```
cd ~/PhantomSDR-Plus
./setup_websdr_relay.sh
```

It asks for a port, takes your callsign and site address from `frontend/site_information.json`, and offers to install a systemd service so the relay starts at boot. Settings live in `websdr_relay.json` and can be changed at any time.

**One thing the installer cannot do for you: forward the relay's port on your router.** Visitors' browsers connect to the relay directly — it is not proxied through the receiver — so without that forward, WebSDR diversity works only from inside your own network. The other three receiver types are unaffected.

If the admin panel is installed, its dashboard shows a **WebSDR Diversity Relay** card with the relay's state, the port, how many sessions are running and to which sites.

### Being a good guest

The relay connects to other people's receivers from your server rather than from each listener's own address, so it is built to behave:

- **A cap of ten concurrent sessions to any one WebSDR**, and sixty overall. This is what stops a busy day at your site from looking like an attack on someone else's.
- **A `User-Agent` naming your station and its operator**, so an operator who would rather not be used this way knows exactly who to write to. Please fill it in honestly.
- **Only tuning commands are forwarded.** The connection cannot be used to send anything else.
- **Private, loopback and carrier-NAT addresses are refused**, so a visitor cannot aim the relay at something inside your machine or your LAN.

> [!IMPORTANT]
> The `Origin` check exists because the WebSDR authors did not want their receivers driven from other people's pages. Using the relay is a considered decision, not an oversight on their part. Keep the cap where it is, keep the User-Agent honest, and stop if an operator asks you to.

### What is different about a WebSDR

- **Many sites cover a few narrow slices of spectrum**, not a continuous range — a 256 kHz window on 40 m, for example. Diversity engages only inside them, and the panel reads the site's own band list to know where those are.
- **The audio sample rate varies** with the filter width and sits further from nominal than the other receiver types, so alignment can take a little longer.
- **CW is not adjusted** for WebSDR's convention, which places the passband entirely below the carrier. SSB and AM are correct.

---

## Reading the panel

Once running, the panel shows a small table:

| Row | Meaning |
|---|---|
| **link** | The connection to the second receiver. `ready` is what you want. A failure shows the server's own error text and the WebSocket close code |
| **aligned** | The measured delay between the two streams once they are locked together, or `searching` |
| **corr** | How strongly the two streams correlate. Only meaningful once aligned |
| **remote audio** | Decoded audio arriving from the second receiver. `none` in amber means nothing is being decoded |
| **SNR local / remote** | The two signal-to-noise estimates being compared |
| **switches** | How many times it has changed site |

Beside the title, one word tells you where you stand:

| | |
|---|---|
| `off` (grey) | not running |
| **`Please wait…`** (amber) | connecting, or connected and still aligning |
| **`Ready`** (green) | linked, locked and following the better site |
| the receiver's own error (red) | it has failed and will not recover on its own |

The distinction between amber and red is the one that saves time: amber means keep waiting, red means stop waiting and read the message.

The coloured dot adds which site you are actually hearing — green for your own receiver, cyan for the remote.

### Alignment takes about 15 seconds

This is normal and worth expecting. The two streams are aligned by correlating their **audio envelopes**, and that needs a window of audio to work with. The search runs in two stages: a narrow ±1.5 second search can start once about 9 seconds of audio has been gathered, and a second, independent measurement five seconds later has to **agree** with the first before the alignment is trusted. When the two sites are further apart in time than that — a second or two of extra buffering somewhere along the path — the full ±4 second search takes over at about 14 seconds and confirmation follows at 19.

The confirmation step matters. When two sites fade in antiphase — never both carrying the signal at the same moment — a single correlation will happily lock onto a confident, completely wrong delay, which sounds like an echo. Requiring two independent measurements to agree rejects that.

A second thing has to be right before a lock can hold: the two receivers' sample rates. Two receivers are two clocks and two decimation chains, so their audio streams do **not** arrive at quite the same rate even when both declare 12 kHz — 2% apart is normal, which is 240 samples a second of creep, far more than the alignment tolerance. The remote stream is therefore continuously resampled to match your own receiver's rate. That ratio is measured by **counting samples**, not by correlating, so it needs no lock of its own and is settled within the first few seconds — before the first alignment search even runs. A weak or intermittent signal can still take two or three tries to align, so 30 seconds is not a cause for concern; a minute with nothing to show is.

While `searching`, both SNR figures read `0.0`. That is by design: the two signal-to-noise estimates are measured on **content-aligned** samples, so nothing is measured until there is an alignment. `0.0 / 0.0` means "not locked yet", not "no signal".

---

## Remote SNR trim

This slider biases the choice between the two sites. It is added to the remote receiver's measured SNR before the comparison — positive favours the remote, negative favours your own. It changes **nothing else**: not the audio level, not the combining, only which site wins.

It exists because the two SNR figures are not always comparable. Both are measured the same way — a percentile spread of the audio — but a receiver whose codec floors its own noise reads lower than it deserves. A KiwiSDR applies strong gain and a limiter, which compresses the spread; a lossy codec sets a noise floor the signal never gets below.

**How to set it:**

1. Tune both receivers to a signal that is reliably present, and wait for `aligned`.
2. Watch the two SNR figures for half a minute. Note the typical gap.
3. Use the extremes as a listening test: **+15** forces the remote site live, **−15** forces your own. Listen to each for a few seconds. This is the only way to hear one site in isolation.
4. If the remote reads, say, 5 dB lower but sounds just as good, set **+5**. You are making the two readings agree when the two sites sound equal.
5. Watch the **switches** counter over ten minutes of listening. Constant flipping means the trim is too close to a tie; never switching even when your own receiver audibly fades means it is too far the other way.

Starting points: **0** for another PhantomSDR-Plus, which uses an identical audio path and is comparable by construction; a small **positive** value for a KiwiSDR or UberSDR.

> [!TIP]
> If you need more than about ±8 dB, stop trimming. At that point the honest explanation is usually that one receiver really is worse for that path, and biasing past a real difference just means listening to the weaker site.

The setting applies immediately and is remembered in your browser.

---

## Choosing a second receiver

**Distance matters.** Fades decorrelate with distance — a few hundred kilometres on HF is a good target. Two receivers in the same city fade together and buy you nothing. Too far apart and the second receiver may not hear your signal at all.

**Both must actually hear the signal.** This is the requirement no software can work around. If the second receiver cannot hear what you are listening to, the correlation stays low and it will refuse to lock — deliberately, because a wrong alignment sounds worse than no diversity at all.

**Coverage.** A second PhantomSDR-Plus or a KiwiSDR announces the frequency range it covers, and the panel warns you if you tune outside it. A WebSDR announces its bands, which are often narrow slices rather than a continuous range. UberSDR does not announce coverage, so there the refusal to lock is your only signal.

> [!IMPORTANT]
> Public receivers are run by volunteers and have a limited number of listener slots. A diversity session occupies one of them for as long as it runs, just as a human listener would. Please be considerate about leaving one connected indefinitely, and ask the operator if you intend to use their receiver heavily.

---

## Troubleshooting

**`link` never leaves `connecting`, or cycles connect/close** The address or port is probably wrong. Check the table above — in particular, UberSDR uses its normal web port, not 8073. The panel shows the WebSocket close code, and the browser console (F12) shows the underlying error.

**`link` shows an error with text after it** That text comes from the other receiver. It is usually specific: a refused session, a full server, or a receiver that does not accept outside clients.

**KiwiSDR refuses the connection** Some KiwiSDRs require a password, and on an UberSDR the KiwiSDR-compatible endpoint is switched off by default. For an UberSDR, use the **UberSDR** source type instead — that path is always available.

**WebSDR: `the WebSDR relay is not reachable`** The relay is not running, or your browser cannot reach its port. It must be reachable at the **same hostname the receiver page is served from**, because the browser connects to it directly rather than through the receiver. Open `http://<that hostname>:<relay port>/status` in the same browser to see which. If it answers on your LAN but not from outside, the port is not forwarded on the router.

**WebSDR: an error mentioning a refused connection** That site has locked things down further than the standard `Origin` check, or its operator has blocked this station.

**`link` is `ready` but `remote audio` shows `none`** Audio is not being decoded. Reload the page; if it persists, the browser console will show which decoder failed.

**Audio arrives but it never aligns** The two receivers are not hearing the same thing. Try a strong broadcast station, or a band where both sites have good propagation. A quiet band with only noise at both ends will never correlate — and should not.

**It switches back and forth constantly** The two sites are too close in SNR. Adjust the trim slightly so one is consistently preferred.

**It never uses the second receiver** Check `remote audio` is climbing and that the SNR figures look sensible. If the remote reads much lower than it sounds, that is what the trim is for.

---

## Limitations

- **Not coherent.** No phasing, no nulling, no direction finding. Cancelling a noise source needs two antennas on one clock at one site; this is a different technique for a different problem.
- **One to three seconds of delay**, unavoidably.
- **Two receivers only.**
- **Mono.** If your receiver is in a stereo mode such as C-QUAM, the audio passes through untouched and diversity does not engage.
- **Alignment needs signal.** Under about 10 dB SNR at one of the two sites, expect it to sit at `searching`.
- **A WebSDR needs the relay** on your own server, and its port forwarded. The other three receiver types need neither.
