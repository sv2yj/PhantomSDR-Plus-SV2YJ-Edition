<script>
  const VERSION = "4.2.0 with mobile support and enhancements";

  // ── Variant selection ────────────────────────────────────────────────────
  //
  // This one file replaces the four App__*_smeter_.svelte copies.  The variant
  // is chosen by main.js, which the per-variant build scripts write:
  //
  //   new App({ target, props: { smeter: "digital", layout: "v2" } })
  //
  // Props rather than build-time defines on purpose: the build scripts already
  // rewrite main.js per variant, so nothing new is needed in vite.config.js,
  // and a future build could switch variant at runtime without a rebuild.
  //
  // These two props are the *seed* only.  The ⚙️ VersionSelector assigns to
  // them directly, which is what makes switching variants silent: since all
  // four variants are this one component, flipping the props re-renders a few
  // control panels in place instead of navigating to another build.  Nothing
  // outside these blocks is touched, so audio, the waterfall canvases and the
  // decoders keep running across a switch.
  //
  /** "analog" = moving-needle face, "digital" = segmented bar. */
  export let smeter = "analog";
  /** "v1" or "v2" — panel ordering of the Band/Modes selectors. */
  export let layout = "v1";

  $: isAnalog = smeter !== "digital";
  $: isV2 = layout === "v2";

  // A variant picked from the ⚙️ menu has to survive a real reload too, or F5
  // would snap the page back to whatever variant this dist/ directory was
  // built as.  Stored choice wins when present; otherwise the build default
  // (which is what a first-time visitor and every bookmarked /digital/,
  // /v2-analog/, … URL still gets).
  // Read at init rather than in onMount: this page is client-rendered, so the
  // value is available before the first render and the correct S-meter mounts
  // straight away instead of flashing the built-in one for a frame.
  const VARIANT_STORAGE_KEY = "phantom.variant";

  try {
    const saved = JSON.parse(
      localStorage.getItem(VARIANT_STORAGE_KEY) || "null",
    );
    if (saved && typeof saved === "object") {
      if (saved.smeter === "analog" || saved.smeter === "digital")
        smeter = saved.smeter;
      if (saved.layout === "v1" || saved.layout === "v2") layout = saved.layout;
    }
  } catch (e) {
    // Private mode / corrupt entry — keep the build default.
  }

  function handleVariantChange(next) {
    smeter = next.smeter;
    layout = next.layout;
    try {
      localStorage.setItem(VARIANT_STORAGE_KEY, JSON.stringify(next));
    } catch (e) {
      // Not persisting is survivable; the switch itself still happened.
    }
  }

  // 'emoji-picker-element' is lazy-loaded on first open (see toggleEmojiPicker)
  import {
    onDestroy,
    onMount,
    tick,
    beforeUpdate,
    afterUpdate,
  } from "svelte";
  import { fade, fly, scale } from "svelte/transition";
  import copy from "copy-to-clipboard";
  import SMeterAnalog from "./lib/SMeterAnalog.svelte";
  import SMeterDigital from "./lib/SMeterDigital.svelte";
  import StatusIndicators from "./lib/StatusIndicators.svelte";
  import BandSelector from "./lib/BandSelector.svelte";
  import ModesSelector from "./lib/ModesSelector.svelte";
  import { writable } from "svelte/store";

  import PassbandTuner from "./lib/PassbandTuner.svelte";
  import FreeDVReporter from "./lib/FreeDVReporter.svelte";
  import FrequencyInput from "./lib/FrequencyInput.svelte";
  import FrequencyMarkers from "./lib/FrequencyMarkers.svelte";
  import MagicEyeIndicator from "./lib/MagicEyeIndicator.svelte";
  import ModeIdChip from "./lib/ModeIdChip.svelte";
  import {
    RELIABLE_LO_HZ,
    RELIABLE_HI_HZ,
    RECENTRE_TARGET_HZ,
  } from "./modeId.js";
  import { applyBandPriors, signalKhz } from "./modePriors.js";

  import { eventBus } from "./eventBus";
  import {
    createScanner,
    THRESHOLDS_DB,
    RESUME_CHOICES_MS,
    MAX_STAY_CHOICES_MS,
    SWEEP_MODES,
    RANGE_MODES,
  } from "./scanner.js";
  import {
    FAX_SCHEDULE,
    NAVTEX_DB,
    RTTY_SCHEDULE,
    RTTY_PROGRAMME_BY_KHZ,
    parseSlots,
    navtexSlots,
    scheduleRows,
  } from "./broadcastSchedules";

  import { quintOut } from "svelte/easing";

  import { pinch, pan } from "./lib/hammeractions.js";
  import { availableColormaps } from "./lib/colormaps";
  import FtxSpectrum from "./lib/FtxSpectrum.svelte";
  import {
    SUBMODE_NAMES as JS8_SUBMODE_NAMES,
    SUBMODE_PERIOD_S as JS8_SUBMODE_PERIOD_S,
  } from "./modules/js8-tables.js";
  import { formatJs8Parts } from "./modules/js8-format.js";
  // PNG, not the SVG master: this server labels every asset text/plain, and
  // browsers sniff raster formats but never SVG -- an <img> would refuse it.
  import sstvSplashUrl from "./assets/SSTV.png";
  import DiversityPanel from "./lib/DiversityPanel.svelte";
  import { ConnectionRefused } from "./refused.js";
  import {
    init,
    audio,
    waterfall,
    events,
    FFTOffsetToFrequency,
    frequencyToFFTOffset,
    frequencyToWaterfallOffset,
    getMaximumBandwidth,
    waterfallOffsetToFrequency,
    sendUserID,
  } from "./lib/backend.js";
  import {
    constructLink,
    parseLink,
    storeInLocalStorage,
  } from "./lib/storage.js";

  // Added to create the Site Information area //
  import {
    siteSysop,
    siteSysopEmailAddress,
    siteInformation,
    siteGridSquare,
    siteCity,
    siteHardware,
    siteSoftware,
    siteReceiver,
    siteAntenna,
    siteNote,
    siteIP,
    siteStats,
    siteSDRBaseFrequency,
    siteSDRBandwidth,
    siteRegion,
    siteChatEnabled,
  } from "../site_information.json";
  // End of Information Area import //

  // Import to detect mobile devices //
  import Device from "svelte-device-info";

  import VersionSelector from "./lib/VersionSelector.svelte";
  import Spectrogram from "./lib/Spectrogram.svelte";
  import QrssPanel from "./lib/QrssPanel.svelte";
  import VideoAreaSelector from "./lib/VideoAreaSelector.svelte";
  import { connectCatSyncAny, buildDefaultSources } from "./lib/catsync.js";

  // ── CAT sync over TCI (transceiver <-> PhantomSDR) ──────────────────────
  // Muting the audio while the rig transmits (PTT) is always on, there is no
  // switch for it. Frequency tracking is a single toggle: either both ways
  // (rig <-> Phantom) or nothing.
  let showCatPopup = false;
  let catSyncEnabled = false;
  let catConnected = false;
  let catActiveSourceLabel = null;
  // True while the rig transmits: the page is silent, and the volume slider
  // only takes effect again on receive.
  let catTxMuted = false;
  let catSyncHandle = null;
  // Machine running the TCI server (ExpertSDR, AetherSDR, Thetis).
  // "localhost" when it is the browser's own computer, otherwise its LAN IP.
  let catHost = "localhost";
  // True while a frequency change is being applied BECAUSE the rig moved, so
  // that frequency is not echoed straight back to the rig.
  let catApplyingRemoteFreq = false;
  // Last frequency sent to the rig from a waterfall click/drag.
  let catLastSentHz = null;
  // The rig's frequency and mode as last reported over TCI.
  let catRigHz = null;
  let catRigMode = null;
  // The mode last sent to the rig and when, so the rig's report of its
  // previous mode, still on the way, does not switch the page back.
  let catLastSentMode = null;
  let catLastSentModeAt = 0;

  // This receiver's modes in TCI's names. CW-L has no TCI name of its own.
  const CAT_TCI_MODES = {
    USB: "usb", LSB: "lsb", CW: "cw", "CW-L": "cw", AM: "am", QUAM: "am",
    FM: "nfm", WBFM: "wfm", RADEU: "usb", RADEL: "lsb",
  };

  // CAT sync over TCI, Phantom -> rig: the receiver's mode. Every mode change
  // (a button, the band plan, a decoder, a bookmark) arrives here through
  // handleDemodulationChange.
  function catSendModeToRig() {
    if (!catSyncEnabled || catApplyingRemoteFreq || !catSyncHandle) return;
    const tci = CAT_TCI_MODES[demodulation];
    if (!tci) return;
    // The rig is already there, or it was just asked to go there.
    if (catRigMode && catsyncModeFromTool(catRigMode) === catsyncModeFromTool(tci)) return;
    if (tci === catLastSentMode && Date.now() - catLastSentModeAt < 2000) return;
    if (catSyncHandle.sendModeToRig(tci)) {
      catLastSentMode = tci;
      catLastSentModeAt = Date.now();
    }
  }

  // CAT sync over TCI, Phantom -> rig: the passband. updatePassband calls this
  // after every passband change; a drag fires it many times, so only the
  // width that is still there 300 ms later is sent.
  let catLastSentWidth = null;
  let catLastSentWidthAt = 0;
  let catFilterTimer = null;
  let catPendingWidth = null;
  function catSendFilterToRig() {
    if (!catSyncEnabled || !catSyncHandle || !audio || !audio.getAudioRange) return;
    const [l, m, r] = audio.getAudioRange().map(FFTOffsetToFrequency);
    const lo = Math.round(l - m);
    const hi = Math.round(r - m);
    const width = hi - lo;
    // A passband reset by the rig's own mode change is the rig's filter
    // already, so it is not sent back.
    if (catApplyingRemoteFreq) {
      clearTimeout(catFilterTimer);
      catFilterTimer = null;
      catLastSentWidth = width;
      return;
    }
    if (!(width > 0) || width === catLastSentWidth) return;
    // The same width reported again while it waits: let the timer run, or a
    // page that refreshes its passband often would never send at all.
    if (catFilterTimer && width === catPendingWidth) return;
    clearTimeout(catFilterTimer);
    catPendingWidth = width;
    // Marked as sent from the start, so a rig report arriving during the
    // 300 ms wait does not override the listener's drag.
    catLastSentWidthAt = Date.now() + 300;
    catFilterTimer = setTimeout(() => {
      catFilterTimer = null;
      if (catSyncHandle && catSyncHandle.sendFilterToRig(lo, hi)) {
        catLastSentWidth = width;
        catLastSentWidthAt = Date.now();
      }
    }, 300);
  }

  function toggleCatPopup() {
    showCatPopup = !showCatPopup;
  }

  function loadCatSyncPreferences() {
    try {
      catSyncEnabled = JSON.parse(
        localStorage.getItem("catSyncEnabled") || "false",
      );
    } catch (e) {
      catSyncEnabled = false;
    }
    try {
      catHost = localStorage.getItem("catHost") || "localhost";
    } catch (e) {
      catHost = "localhost";
    }
  }

  // bind:checked already flips catSyncEnabled; this only persists it and must
  // never invert it again.
  function persistCatSyncPreference() {
    try {
      localStorage.setItem("catSyncEnabled", JSON.stringify(catSyncEnabled));
    } catch (e) {}
  }

  // A new host means reconnecting: close the old links before opening new ones.
  function applyCatHostChange() {
    catHost = (catHost || "").trim() || "localhost";
    try {
      localStorage.setItem("catHost", catHost);
    } catch (e) {}
    if (catSyncHandle) catSyncHandle.close();
    catConnected = false;
    catActiveSourceLabel = null;
    catSyncHandle = startCatSync();
  }

  // See ./lib/catsync.js. The usual TCI ports (ExpertSDR3/AetherSDR 50001,
  // ExpertSDR2/Thetis 40001) are tried in parallel on catHost, so the
  // listener never has to know which one their software uses; the one that
  // answers is shown in catActiveSourceLabel.
  function startCatSync() {
    const catConnectedByPort = {};
    return connectCatSyncAny(buildDefaultSources(catHost), {
      onPtt: (isTx) => {
        catTxMuted = isTx;
        if (isTx) {
          audio.setGain(0); // always mute on TX -- no switch
        } else {
          handleVolumeChange(); // the slider as it is now
        }
      },
      onVfo: (freqHz, mode) => {
        // The rig moved on its own, so the next click must be sent even if it
        // lands on the frequency we sent last time.
        catLastSentHz = null;
        // catsync.js reports frequency and mode together, so work out which
        // of the two the rig actually changed.
        const freqChanged = freqHz && freqHz !== catRigHz;
        const modeChanged = mode && mode !== catRigMode;
        catRigHz = freqHz;
        catRigMode = mode;
        if (!catSyncEnabled) return;
        catApplyingRemoteFreq = true;
        try {
          // The rig only moves the dial: no band zoom or brightness, and the
          // band plan's mode is held off (see the "setMode" subscription).
          if (freqChanged) {
            frequencyInputComponent.setFrequency(freqHz);
            handleFrequencyChange({ detail: freqHz });
          }
          // The mode follows only when the rig's mode itself changed, so the
          // echo of a waterfall click does not overwrite the listener's mode.
          // A report that contradicts a mode sent a moment ago is the rig's
          // old mode still on the way, not a hand on the rig.
          const stale =
            Date.now() - catLastSentModeAt < 1500 &&
            catsyncModeFromTool(mode) !== catsyncModeFromTool(catLastSentMode);
          if (modeChanged && !stale) {
            // TCI servers spell some modes their own way (nfm, digu, sam);
            // the CATsync name table knows them all.
            const wanted = catsyncModeFromTool(mode);
            if (_decoderOwnsReceiver()) _decoderReassertReceiver();
            else if (wanted && wanted !== demodulation) SetMode(wanted);
          }
        } finally {
          catApplyingRemoteFreq = false;
        }
      },
      onFilter: (low, high) => {
        const width = Math.round(high - low);
        if (!catSyncEnabled || !(width > 0) || !audio || !audio.getAudioRange) return;
        // The listener has just changed the passband or the mode: a report
        // now is the rig's filter from before, still on the way.
        const recent = Math.max(catLastSentWidthAt, catLastSentModeAt);
        if (catFilterTimer || Date.now() - recent < 1500) return;
        // A running decoder keeps its own passband.
        if (_decoderOwnsReceiver()) return;
        const [l, , r] = audio.getAudioRange().map(FFTOffsetToFrequency);
        if (Math.abs(r - l - width) < 50) return;
        catApplyingRemoteFreq = true;
        try {
          handleSetStaticBandwidth(width, false);
        } finally {
          catApplyingRemoteFreq = false;
        }
      },
      onStatus: (state, detail, sourceConfig) => {
        catConnectedByPort[sourceConfig.port] = state === "connecté";
        const activePorts = Object.entries(catConnectedByPort)
          .filter(([, connected]) => connected)
          .map(([port]) => port);
        catConnected = activePorts.length > 0;
        catActiveSourceLabel = activePorts.length
          ? `TCI (port ${activePorts.join(", ")})`
          : null;
      },
    });
  }

  let isRecording = false;
  let canDownload = false;
  let isVideoRecording = false;
  let canDownloadVideo = false;
  let selectingArea = false;
  // Normalised { x, y, w, h } against the visible waterfall canvases, or null
  // for the full panel. Kept normalised so it survives a resize or zoom.
  let videoCrop = null;

  let waterfallCanvas;
  let waterfallReverse = false;
  let eventBusUnsubscribers = [];
  let dxVisibilityChangeHandler = null;

  function loadWaterfallDirection() {
    try {
      waterfallReverse = JSON.parse(
        localStorage.getItem("waterfallReverse") || "false",
      );
    } catch (e) {
      waterfallReverse = false;
    }
  }

  function toggleWaterfallDirection() {
    waterfallReverse = !waterfallReverse;
    try {
      localStorage.setItem(
        "waterfallReverse",
        JSON.stringify(waterfallReverse),
      );
    } catch (e) {}
  }

  function drawTopFrequencyBar() {
    if (!topGraduationCanvas || !graduationCanvas) return;
    const src = graduationCanvas;
    const dst = topGraduationCanvas;
    const ctx = dst.getContext("2d");
    if (!ctx) return;
    // Spectrum active: hide the upper frequency numbers, show a thin black row instead
    if (spectrumDisplay) {
      const thin = 10;
      if (dst.width !== src.width) dst.width = src.width;
      if (dst.height !== thin) dst.height = thin;
      ctx.fillStyle = "#000000";
      ctx.fillRect(0, 0, dst.width, dst.height);
      return;
    }
    if (dst.width !== src.width) dst.width = src.width;
    if (dst.height !== src.height) dst.height = src.height;
    ctx.clearRect(0, 0, dst.width, dst.height);
    ctx.drawImage(src, 0, 0, dst.width, dst.height);
  }

  function stopTopFrequencyBarSync() {
    if (topGraduationRaf !== null) {
      cancelAnimationFrame(topGraduationRaf);
      topGraduationRaf = null;
    }
  }

  function startTopFrequencyBarSync() {
    stopTopFrequencyBarSync();
    const loop = () => {
      if (waterfallDisplay) {
        drawTopFrequencyBar();
      }
      topGraduationRaf = requestAnimationFrame(loop);
    };
    tick().then(drawTopFrequencyBar);
    topGraduationRaf = requestAnimationFrame(loop);
  }

  $: if (waterfallDisplay) {
    tick().then(drawTopFrequencyBar);
  }

  let waterfallHighlightCanvas;
  let waterfallHighlightInner;
  let spectrumHighlightInner; // bandwidth highlight extended over the spectrum

  // ── Admin waterfall message ────────────────────────────────────────────────
  let adminMessage = ""; // empty string = banner hidden
  let adminMsgColor = "#ffffff";
  let spectrumCanvas;
  let graduationCanvas;
  let topGraduationCanvas;
  let topGraduationRaf = null;
  let clientsCanvas;
  let myDisplayId = "";
  let _myId = null;

  function idToSixDigits(id) {
    let h = 0;
    for (let i = 0; i < id.length; i++) {
      h = (Math.imul(31, h) + id.charCodeAt(i)) >>> 0;
    }
    return String((h % 900000) + 100000);
  }
  let showClients = true;

  // --- Geo labels for waterfall client pills ---
  // Polled from /users (same endpoint as users.html) every 5 s.
  // Map shape: { sessionId → "GR · Athens" } or "Local" for LAN/loopback connections.
  let _clientGeoMap = {};

  function _isLocalIp(ip) {
    if (!ip) return false;
    const raw = ip.startsWith("::ffff:") ? ip.slice(7) : ip;
    if (raw === "::1" || raw === "localhost") return true;
    return (
      /^127\./.test(raw) ||
      /^10\./.test(raw) ||
      /^192\.168\./.test(raw) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(raw) ||
      /^fc/i.test(raw) ||
      /^fd/i.test(raw)
    );
  }

  async function _fetchClientGeo() {
    try {
      const r = await fetch("/users", { cache: "no-store" });
      if (!r.ok) return;
      const raw = await r.json();
      // /users may return an array directly or an object with a nested array
      const users = Array.isArray(raw)
        ? raw
        : Array.isArray(raw.users)
          ? raw.users
          : Array.isArray(raw.clients)
            ? raw.clients
            : Array.isArray(raw.data)
              ? raw.data
              : null;
      if (!users) return;
      // Build { uuid → "GR · Athens" } — IDs are UUIDs shared between /users and
      // the WebSocket signal protocol: exact per-user match, no frequency collisions.
      const map = {};
      for (const u of users) {
        if (!u.id) continue;
        if (_isLocalIp(u.ip) || u.geo === "Local") {
          map[u.id] = "Local";
          continue;
        }
        if (!u.geo || u.geo === u.ip) continue;
        const parts = u.geo.split(",").map((s) => s.trim());
        const cc = parts[parts.length - 1]; // "GR"
        // Strip any leading flag emoji the backend prepends (e.g. "🇬🇷 Athens");
        // the pill draws its own Twemoji PNG from cc, and a native flag in the label
        // would render a SECOND flag on browsers that have flag glyphs (Firefox).
        const city = parts[0].replace(/^[\u{1F1E6}-\u{1F1FF}]{2}\s*/u, ""); // "Athens"
        map[u.id] = cc === city ? cc : `${cc} · ${city}`;
      }
      _clientGeoMap = map;
      waterfall.setClientGeo(_clientGeoMap);
    } catch (e) {
      /* network blip — keep previous map */
    }
  }
  // --- End geo labels ---
  let bandPlanCanvas;
  let tempCanvas;

  let frequencyInputComponent;

  let frequency;

  let passbandTunerComponent;

  // Spectrogram variables
  let spectrogramComponent;
  let spectrogramEnabled = false;
  let spectrogramHeight = 200;
  let spectrogramGain = 1.0;
  let spectrogramColorScheme = "rainbow";

  // QRSS grabber variables
  let qrssComponent;
  let qrssEnabled = false;
  let qrssMode = "qrss10";
  let qrssCenterHz = 800;
  let qrssSpanHz = 100;
  let qrssGain = 5;
  let qrssColorScheme = "rainbow";
  // Fixed panel height; there is no control for it.
  let qrssHeight = 260;

  /**
   * The QRSS / MEPT windows, as signal frequencies (where the trace is), not
   * dial frequencies — _qrssApplyKnownFrequency() does the arithmetic.
   *
   * Each is the centre of a window normally only 100 Hz wide, which is why the
   * grabber's span goes down to 20 Hz. 30 m is the main band and comes first.
   *
   * Two families are in use and they do not agree on every band, so both are
   * listed rather than one being picked: the modern windows sit 200 Hz below
   * the band's WSPR frequency, while the older Knights windows are elsewhere
   * entirely (and on 40/80 m much lower). If a band has two entries, that is
   * why — see docs/DECODERS.md §5.
   */
  const QRSS_KNOWN_FREQUENCIES = [
    { label: "10140.00 kHz — 30m (the main QRSS window)", khz: 10140.0 },
    { label: "7039.90 kHz — 40m", khz: 7039.9 },
    { label: "7000.85 kHz — 40m (Knights, 7000.8–7000.9)", khz: 7000.85 },
    { label: "14096.90 kHz — 20m", khz: 14096.9 },
    { label: "3569.90 kHz — 80m", khz: 3569.9 },
    { label: "3568.60 kHz — 80m (older window)", khz: 3568.6 },
    { label: "3500.85 kHz — 80m (Knights, 3500.8–3500.9)", khz: 3500.85 },
    { label: "1837.90 kHz — 160m", khz: 1837.9 },
    { label: "1843.30 kHz — 160m (older window)", khz: 1843.3 },
    { label: "476.10 kHz — 630m", khz: 476.1 },
    { label: "137.70 kHz — 2200m (LF QRSS/DFCW)", khz: 137.7 },
    { label: "5288.55 kHz — 60m", khz: 5288.55 },
    { label: "18105.90 kHz — 17m", khz: 18105.9 },
    { label: "21095.90 kHz — 15m", khz: 21095.9 },
    { label: "24925.90 kHz — 12m", khz: 24925.9 },
    { label: "28125.70 kHz — 10m", khz: 28125.7 },
    { label: "28000.85 kHz — 10m (older window)", khz: 28000.85 },
    { label: "28322.00 kHz — 10m (alternative)", khz: 28322.0 },
    { label: "50294.30 kHz — 6m", khz: 50294.3 },
  ];
  let qrssKnownFrequency = "";
  // True once a QRSS window has been tuned from the list: the grabber then
  // holds the receiver in CW with its own passband, the same way a decoder
  // does — see _decoderOwnsReceiver().
  let qrssHoldsReceiver = false;

  let autoAdjust; // added after C&P of the original App.svelte //

  let link;
  var chatContentDiv;

  // Added to allow the user to toggle the waterfall on and off //
  function handleWaterfallChange() {
    waterfallDisplay = !waterfallDisplay;
  }
  // End of waterfall toggle addition //

  // Declarations for the store and restore of the waterfall settings //
  // when Auto Adjust is enabled. //
  let previous_min_waterfall;
  let previous_max_waterfall;
  let previous_brightness;
  let storeWaterfallSettings = false;
  // End of store and restore variables //

  // Adaptive Auto-Adjust Configuration
  // The waterfall now automatically adjusts based on real-time noise levels!
  let autoAdjustConfig = {
    noiseFloorPercentile: 10, // 5-15: Lower = darker background
    signalCeilingPercentile: 99, // Top 1% for strong signals
    noiseSuppressionFactor: 0.15, // 0.1-0.25: Higher = darker background
    brightnessFactor: 0.3, // 0.25-0.4: Higher = brighter weak signals
    smoothingFrames: 8, // 6-15: Higher = smoother but slower response
    // ADAPTIVE parameters - monitors noise in real-time
    adaptiveEnabled: true, // Enable automatic adaptation to noise levels
    adaptationSpeed: 0.3, // 0.1-0.5: How fast to adapt to changes
    adaptationInterval: 1000, // Check noise level every X milliseconds
  };

  // Preset configurations for different scenarios
  const autoAdjustPresets = {
    default: {
      noiseFloorPercentile: 10,
      noiseSuppressionFactor: 0.15,
      brightnessFactor: 0.3,
      smoothingFrames: 8,
      adaptiveEnabled: true,
      adaptationSpeed: 0.3,
    },
    darkBackground: {
      noiseFloorPercentile: 5, // Very aggressive noise suppression
      noiseSuppressionFactor: 0.2, // Push noise down more
      brightnessFactor: 0.25,
      smoothingFrames: 10,
      adaptiveEnabled: true,
      adaptationSpeed: 0.3,
    },
    weakSignals: {
      noiseFloorPercentile: 15, // Gentler on noise
      noiseSuppressionFactor: 0.1,
      brightnessFactor: 0.35, // Boost weak signals more
      smoothingFrames: 6,
      adaptiveEnabled: true,
      adaptationSpeed: 0.3,
    },
    highContrast: {
      noiseFloorPercentile: 3, // Maximum noise suppression
      noiseSuppressionFactor: 0.25,
      brightnessFactor: 0.2,
      smoothingFrames: 12,
      adaptiveEnabled: true,
      adaptationSpeed: 0.3,
    },
    static: {
      noiseFloorPercentile: 10,
      noiseSuppressionFactor: 0.15,
      brightnessFactor: 0.3,
      smoothingFrames: 8,
      adaptiveEnabled: false, // No adaptation, static settings
      adaptationSpeed: 0,
    },
  };

  let currentAutoAdjustPreset = "default";
  let adaptiveStatus = { condition: "WAITING", avgSNR: "0.0" };

  // Definitions for handleBandChange function //
  // To show the proper band upon startup, you must set //
  // currentBand to the integer of the band starting at 0 //
  // uup to that band. I am publishing several bands, so //
  // the integer for 80m is 7. //
  let bandArray = waterfall.bands;
  //  let currentBand = 34; // 40m

  // This changed by sv2amk. //
  // It's done by the initBandButton function that autodetects //
  // and show the proper band upon startup. It is called from //
  // the display subsection inside the svelte section //
  // near the middle of this file and it's triggered //
  // by the -2 value below. //
  let currentBand = -2;
  let bandName;

  // CATsync: non-zero while a command from the CATsync Tool is being applied,
  // so the changes it causes are not reported back to the tool as the
  // listener's own (which would echo the rig's command straight back to it).
  let catsyncRemote = 0;
  // The last frequency and mode the tool sent.  The tool re-sends the rig's
  // frequency and mode on every poll, changed or not, so a command equal to
  // its previous one is a repeat, not a request - applying it would pull the
  // receiver straight back to the rig every time the listener tuned away.
  // Only a command that differs from the last one means the rig has moved.
  let catsyncLastToolHz = null;
  let catsyncLastToolMode = null;
  // What the tool was sending just before the listener last tuned, and until
  // when a repeat of it still counts as stale.  A tool that re-sends the rig
  // before it has read the new position keeps sending the old value for a
  // poll or two; after this grace the same value means the rig really went
  // back there.
  const CATSYNC_STALE_MS = 2000;
  let catsyncStaleHz = null;
  let catsyncStaleMode = null;
  let catsyncStaleUntil = 0;

  // Begin Wheel Tuning Steps declarations
  let defaultStep,
    currentTuneStep = 1000; // Default step value / Track current step
  let tuningsteps = ["10", "50", "100", "500", "1000", "5000", "9000", "10000"];

  // buttons = true for Buttons for Waterfall controls //
  // buttons = false for toggle switches for Waterfall controls //
  let buttons = true;

  // Added to create a fineTune function to use //
  // buttons to click on for mobile users //
  let fineTuneAmount = 0;

  // Set default AGC (0 = Off) //
  let currentAGC = 0;

  // Set default compressor state (off) //
  let compressorEnabled = false;

  // Toggle the SSB audio compressor in audio.js //
  function handleCompressorToggle() {
    compressorEnabled = !compressorEnabled;
    if (audio) audio.setCompressor(compressorEnabled);
  }

  // ── Compressor popup state & regulators (mirror setters in audio.js) ──
  let showCompPopup = false;
  let compThreshold = -24;
  let compKnee = 6;
  let compRatio = 4;
  let compAttack = 0.003;
  let compRelease = 0.25;
  let compMakeup = 0.3;
  let compAuto = true;

  function toggleCompPopup() {
    showCompPopup = !showCompPopup;
  }
  // Auto-makeup: reflect the gain audio.js computed from threshold & ratio.
  function refreshCompMakeup() {
    if (audio && compAuto)
      compMakeup = Math.round(audio.getCompressorSettings().makeup * 100) / 100;
  }
  function handleCompThreshold() {
    if (audio) {
      audio.setCompressorThreshold(compThreshold);
      refreshCompMakeup();
    }
  }
  function handleCompKnee() {
    if (audio) {
      audio.setCompressorKnee(compKnee);
      refreshCompMakeup();
    }
  }
  function handleCompRatio() {
    if (audio) {
      audio.setCompressorRatio(compRatio);
      refreshCompMakeup();
    }
  }
  function handleCompAttack() {
    if (audio) audio.setCompressorAttack(compAttack);
  }
  function handleCompRelease() {
    if (audio) audio.setCompressorRelease(compRelease);
  }
  function handleCompMakeup() {
    if (audio && !compAuto) audio.setCompressorMakeup(compMakeup);
  }
  function handleCompAutoToggle() {
    if (!audio) return;
    const g = audio.setCompressorAutoMakeup(compAuto);
    if (compAuto && g != null) compMakeup = Math.round(g * 100) / 100;
  }
  function handleCompReset() {
    compThreshold = -24;
    compKnee = 6;
    compRatio = 4;
    compAttack = 0.003;
    compRelease = 0.25;
    compAuto = true;
    if (audio) {
      audio.setCompressorThreshold(compThreshold);
      audio.setCompressorKnee(compKnee);
      audio.setCompressorRatio(compRatio);
      audio.setCompressorAttack(compAttack);
      audio.setCompressorRelease(compRelease);
      const g = audio.setCompressorAutoMakeup(true);
      if (g != null) compMakeup = Math.round(g * 100) / 100;
    }
  }

  // ── 5-band Equalizer UI state (mirrors setEqualizer/setEqBand in audio.js) ──
  let showEqPopup = false;
  let eqEnabled = false;
  const eqBandLabels = ["100 Hz", "350 Hz", "1 kHz", "2 kHz", "3 kHz", "5 kHz"];
  let eqGains = [0, 0, 0, 0, 0, 0];

  function toggleEqPopup() {
    showEqPopup = !showEqPopup;
  }
  function handleEqEnableToggle() {
    eqEnabled = !eqEnabled;
    if (audio) audio.setEqualizer(eqEnabled);
  }
  function handleEqBandChange(i) {
    if (audio) audio.setEqBand(i, eqGains[i]);
  }
  function handleEqReset() {
    eqGains = [0, 0, 0, 0, 0, 0];
    if (audio) audio.setEqGains(eqGains);
  }

  // This function was added to enable AGC to the client //
  function handleAGCChange(newAGC) {
    currentAGC = newAGC;
    switch (newAGC) {
      case 0:
        audio.setAGC(0);
        break;
      case 1:
        audio.setAGC(1);
        break;
      case 2:
        audio.setAGC(2);
        break;
      case 3:
        audio.setAGC(3);
        break;
    }
  }

  // Added to allow an adjustment of the dynamic audio //
  // buffer function inside audio.js //
  let audioBufferDelayEnabled = false;
  // x1 is the engine's own default and suits a wired connection. A phone needs
  // more than a 20 ms cushion, so handsets start at x2 (0.5 s / 0.1 s) — the
  // same value /mobile defaults to. The ladder itself is identical on both, so
  // a listener can still move anywhere on it.
  let audioBufferDelay = Device.isMobile ? 2 : 1;

  // by sv2amkzoom
  // Added to allow adjustment of the zoom //
  // with a button and a slider in mobile version //
  // in function handleZoomStepMove //
  let zoomStepEnabled = false;
  let zoomStep = 1;

  // The zoom factor for the handleZoomStepMove //
  // and the handleZoomStepMagnify functions for //
  // the zoom slider //
  let zwaterfallSpan;

  // Waterfall Auto Control //
  let AutoAdjustEnabled = false;

  // Used to track bandwidth as to make sure the //
  // static bandwidth buttons can be enabled and returened //
  // to the default bandwidth for thr chosen mode //
  let currentBandwidth = 0;
  let staticBandwidthEnabled = false;

  // Getting The Current Date & Time And Setting It
  let currentDateTime = new Date();

  // SMeter Clock
  // Spectrogram functions
  // Initialize spectrogram
  async function initSpectrogram() {
    if (spectrogramComponent) {
      try {
        await spectrogramComponent.initialize(audio.audioOutputSps || 12000);

        // Set up callback to feed PCM data from audio.js
        audio.setSpectrogramCallback((pcmData) => {
          if (spectrogramEnabled && spectrogramComponent) {
            spectrogramComponent.feedPCMData(pcmData);
          }
        });

        spectrogramComponent.start();
        audio.setSpectrogramEnabled(true); // Enable after callback is registered
        console.log("Spectrogram initialized successfully");
      } catch (error) {
        console.error("Failed to initialize spectrogram:", error);
      }
    }
  }

  // QRSS grabber functions
  //
  // Simpler than the spectrogram's: QrssPanel has no AudioContext of its own —
  // it only does arithmetic on the PCM it is handed — so there is nothing to
  // wait for beyond the canvas being in the DOM.
  async function toggleQrss() {
    qrssEnabled = !qrssEnabled;

    if (qrssEnabled) {
      await tick();
      if (!qrssComponent) {
        console.error("QRSS component not available after tick()");
        qrssEnabled = false;
        return;
      }
      qrssComponent.initialize(audio.audioOutputSps || 12000);
      qrssComponent.start();
      audio.setQRSSCallback((pcmData) => {
        if (qrssEnabled && qrssComponent) qrssComponent.feedPCMData(pcmData);
      });
    } else {
      audio.setQRSSCallback(null);
      if (qrssComponent) qrssComponent.stop();
      // Hiding the grabber hands the receiver back, like switching a decoder off.
      _qrssRestoreReceiverControl();
    }
  }

  /**
   * The passband a QRSS window needs.
   *
   * CW here is USB on the backend with the window shifted down (audio.js
   * updateAudioParams() sends the *Offset triple in CW), so the tone the
   * operator hears is set by where that shifted centre sits. Placing it at
   * dial − centre puts the trace exactly on the grabber's centre line, at
   * whatever centre the operator chose, and makes the dial read the real QRSS
   * frequency rather than an offset one.
   *
   * The window is only as wide as the grabber's span plus a little room, so a
   * 100 Hz QRSS window is heard through ~±200 Hz instead of the ±250 Hz of
   * normal CW skewed 300–800 Hz. Everything else on the band stays out.
   */
  function qrssApplyPassband() {
    const dial = Math.round((Number(frequency) || 0) * 1000);
    const centre = Math.max(100, Number(qrssCenterHz) || 800);
    // Half-width in Hz, but never so wide that the window would reach below
    // the carrier — the backend receives this as USB, where that is nonsense.
    const half = Math.min(
      Math.max(120, Math.round((Number(qrssSpanHz) || 100) / 2 + 100)),
      Math.max(60, centre - 50),
    );
    const audioParameters = [dial - half, dial, dial + half].map(
      frequencyToFFTOffset,
    );
    // Only the middle offset differs from the plain triple: it is the carrier
    // the backend demodulates against, and the trace lands at dial − it.
    const audioParametersOffset = [dial - half, dial - centre, dial + half].map(
      frequencyToFFTOffset,
    );
    audio.setAudioRange(...audioParameters, ...audioParametersOffset);
    if (typeof updatePassband === "function") updatePassband();
    if (typeof updateLink === "function") updateLink();
  }

  function _qrssTakeReceiverControl() {
    qrssHoldsReceiver = true;
    // As in _fskTakeReceiverControl(): switch the audio engine over directly
    // rather than through handleDemodulationChange(), whose BFO compensation
    // would move the dial out from under us. qrssApplyPassband() sets the
    // window itself.
    demodulation = "CW";
    passbandTunerComponent.setMode("CW");
    audio.setFmDeemph(0);
    audio.setAudioDemodulation("CW");
    qrssApplyPassband();
    if (audio && typeof audio.updateFilters === "function") audio.updateFilters();
  }

  function _qrssRestoreReceiverControl() {
    if (!qrssHoldsReceiver) return;
    qrssHoldsReceiver = false;
    const m = _bandDefaultMode();
    demodulation = m;
    handleDemodulationChange(null, true);
    if (audio && typeof audio.updateFilters === "function") audio.updateFilters();
  }

  /**
   * Save the grabber display as a PNG.
   *
   * A QRSS capture is worth keeping — traces build over minutes and are what
   * gets posted and compared — but only if it says what it is, so the panel
   * draws the caption (QRSS, frequency, UTC), the frequency scale and the
   * status line into the image. All this side supplies is the frequency,
   * which the panel has no way of knowing.
   */
  async function qrssSavePNG() {
    if (!qrssComponent || typeof qrssComponent.toPNGBlob !== "function") return;
    const khz = Number(frequency) || 0;
    try {
      const blob = await qrssComponent.toPNGBlob({
        freqText: `${khz.toFixed(2)} kHz`,
        extra: `centre ${qrssCenterHz} Hz · span ${qrssSpanHz} Hz`,
      });
      if (!blob) return;
      const a = document.createElement("a");
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      a.href = URL.createObjectURL(blob);
      a.download = `qrss-${khz.toFixed(2)}kHz-${stamp}.png`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        URL.revokeObjectURL(a.href);
        a.remove();
      }, 0);
    } catch (e) {
      console.warn("[QRSS] PNG save failed", e);
    }
  }

  /** Tune to the QRSS window picked in the list, in CW, and hold it there. */
  function qrssApplyKnownFrequency() {
    const khz = Number(qrssKnownFrequency);
    if (!Number.isFinite(khz) || khz <= 0) return;
    const hz = Math.round(khz * 1000);
    try {
      if (frequencyInputComponent && frequencyInputComponent.setFrequency)
        frequencyInputComponent.setFrequency(hz);
      handleFrequencyChange({ detail: hz });
      frequency = (hz / 1e3).toFixed(3);
      _qrssTakeReceiverControl();
    } catch (e) {
      console.warn("[QRSS] tune error", e);
    }
  }

  // Toggle spectrogram on/off
  async function toggleSpectrogram() {
    spectrogramEnabled = !spectrogramEnabled;

    if (spectrogramEnabled) {
      // ENABLING - wait for component to be created by Svelte
      await tick(); // Wait for DOM to update

      // CRITICAL FIX: Wait for canvas to be visible and sized
      await new Promise((resolve) => setTimeout(resolve, 50));

      if (spectrogramComponent && !spectrogramComponent.audioContext) {
        // First time - need to initialize
        await initSpectrogram();
      } else if (spectrogramComponent) {
        // Already initialized - just start it
        spectrogramComponent.start();
        audio.setSpectrogramEnabled(true);
      } else {
        console.error(
          "Spectrogram component not available after tick() - check if component is in DOM",
        );
      }
    } else {
      // DISABLING
      if (spectrogramComponent) {
        spectrogramComponent.stop();
      }
      audio.setSpectrogramEnabled(false);
    }
  }

  // Update spectrogram frequency range - Fixed 50-10000 Hz for all modes
  function updateSpectrogramRange() {
    if (!spectrogramComponent || !spectrogramEnabled) return;

    // Fixed range: 50-10000 Hz for all modes
    const minFreq = 50;
    const maxFreq = 10000;

    spectrogramComponent.setFrequencyRange(minFreq, maxFreq);
    console.log(
      `Spectrogram range: ${minFreq}-${maxFreq} Hz (fixed for all modes)`,
    );
  }

  onMount(() => {
    // Adopt the stored sync offset and let the auto-sync loop drive the slider.
    bindFtxSync();

    // Initial update
    updateTime();

    // Set up the interval (using 5000ms as in the original code)
    intervalId = setInterval(updateTime, 5000);

    // Clean up on component destruction
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  });

  // ── Admin waterfall message polling ─────────────────────────────────────
  // Fetches /wf-message.json — a static file written by admin_server.py
  // directly into frontend/dist/.  Served by spectrumserver with zero
  // proxy / auth / routing involvement.
  onMount(() => {
    console.log(
      "[WF-MSG] Admin message polling active — fetching /wf-message.json",
    );
    async function pollAdminMsg() {
      try {
        // Cache-bust with timestamp so the browser never serves stale data
        const r = await fetch("/wf-message.json?_=" + Date.now());
        if (!r.ok) {
          // File not yet created — treat as "no message"
          adminMessage = "";
          return;
        }
        const d = await r.json();
        adminMessage = (d.text || "").trim();
        adminMsgColor = d.color || "#ffffff";
        if (adminMessage) {
          console.log("[WF-MSG] Message active:", adminMessage);
        }
      } catch (err) {
        // File absent or malformed JSON — silently clear the banner
        adminMessage = "";
      }
    }
    pollAdminMsg(); // immediate check on page load
    const _t = setInterval(pollAdminMsg, 5000); // re-check every 5 s
    return () => clearInterval(_t);
  });

  let time = "";
  let intervalId;

  function updateTime() {
    const Digital = new Date();

    // UTC time
    let hours = Digital.getUTCHours();
    let minutes = Digital.getUTCMinutes();
    let seconds = Digital.getUTCSeconds();

    // Reset hours if it's 24 or greater
    if (hours >= 24) {
      hours = 0;
    }

    // Add leading zeros
    hours = hours <= 9 ? `0${hours}` : hours;
    minutes = minutes <= 9 ? `0${minutes}` : minutes;

    // Local time
    let localHours = Digital.getHours();
    let localMinutes = Digital.getMinutes();

    // Reset local hours if it's 24 or greater
    if (localHours >= 24) {
      localHours = 0;
    }

    // Add leading zeros for local time
    localHours = localHours <= 9 ? `0${localHours}` : localHours;
    localMinutes = localMinutes <= 9 ? `0${localMinutes}` : localMinutes;

    // Update the time string
    time = `${hours}:${minutes} (UTC) • ${localHours}:${localMinutes} (Local)`;
  }

  // Function added to toggle the Additional Info menu //
  function toggleMenu() {
    const menu = document.getElementById("collapsible-menu");
    const label = document.getElementById("menu-toggle-label");

    if (menu.classList.contains("hidden")) {
      menu.classList.remove("hidden");
      label.innerText = "Close Additional Info";
    } else {
      menu.classList.add("hidden");
      label.innerText = "Open Additional Info";
    }
  }
  // End of Site Information addition //

  function toggleRecording() {
    if (!isRecording) {
      audio.startRecording();
      isRecording = true;
      canDownload = false;
    } else {
      audio.stopRecording();
      isRecording = false;
      canDownload = true;
    }
  }

  function downloadRecording() {
    audio.downloadRecording();
  }

  // Waterfall panel stack, top to bottom. Passed to the recorder each time we
  // start so it picks up whichever canvases are actually laid out right now.
  function videoRecordingLayers() {
    return [
      { canvas: spectrumCanvas },
      { canvas: topGraduationCanvas },
      { canvas: waterfallCanvas, flipY: () => waterfallReverse },
    ];
  }

  function videoRecordingCaption() {
    const utc = new Date().toISOString().slice(11, 19);
    return (
      (Number(frequency) || 0).toFixed(2) +
      " kHz  " +
      demodulation +
      "  " +
      utc +
      "Z"
    );
  }

  function toggleVideoRecording() {
    if (!isVideoRecording) {
      const started = audio.startVideoRecording({
        layers: videoRecordingLayers(),
        getCaption: videoRecordingCaption,
        crop: videoCrop,
        // The recorder self-stops at the duration cap; keep the button in sync.
        onAutoStop: () => {
          isVideoRecording = false;
          canDownloadVideo = true;
        },
      });
      if (!started) {
        alert(
          "Video recording could not start.\n\n" +
            "Make sure audio is started and the waterfall is visible. " +
            "Your browser may not support recording video.",
        );
        return;
      }
      isVideoRecording = true;
      canDownloadVideo = false;
    } else {
      audio.stopVideoRecording();
      isVideoRecording = false;
      canDownloadVideo = true;
    }
  }

  function downloadVideoRecording() {
    audio.downloadVideoRecording();
  }

  function toggleAreaSelection() {
    selectingArea = !selectingArea;
  }

  function handleAreaSelect(event) {
    videoCrop = event.detail.crop;
    selectingArea = false;
  }

  function handleAreaCancel() {
    selectingArea = false;
  }

  function clearVideoArea() {
    videoCrop = null;
    selectingArea = false;
  }

  // Put the recording panel back to how it starts, without a page reload:
  // stops anything running, discards buffered recordings, and clears the area.
  function resetRecordings() {
    audio.resetAudioRecording();
    audio.resetVideoRecording();
    isRecording = false;
    canDownload = false;
    isVideoRecording = false;
    canDownloadVideo = false;
    selectingArea = false;
    videoCrop = null;
  }

  function generateUniqueId() {
    return (
      Math.random().toString(36).substr(2, 10) +
      Math.random().toString(36).substr(2, 10)
    );
  }

  let userId; // Global variable to store the user's unique ID
  let autoAdjustEnabled = false;

  // Updates the passband display
  function updatePassband(passband) {
    passband = passband || audio.getAudioRange();
    const frequencies = passband.map(FFTOffsetToFrequency);
    bandwidth = ((frequencies[2] - frequencies[0]) / 1000).toFixed(2);
    const offsets = frequencies.map(frequencyToWaterfallOffset);
    passbandTunerComponent.changePassband(offsets);
    // Feed tuned passband (Hz) to the waterfall-bin SNR estimator
    if (typeof waterfall.setSnrPassband === "function") {
      waterfall.setSnrPassband(frequencies[0], frequencies[2]);
    }
    // important:
    drawWaterfallHighlight(passband);
    catSendFilterToRig();
  }

  function drawWaterfallHighlight(passband) {
    try {
      if (
        !waterfallHighlightCanvas ||
        !waterfallHighlightInner ||
        !waterfallDisplay
      )
        return;

      // Helper: hide both the waterfall and spectrum highlight overlays
      const hideHighlights = () => {
        waterfallHighlightInner.style.display = "none";
        if (spectrumHighlightInner)
          spectrumHighlightInner.style.display = "none";
      };

      // Waterfall range is in FFT-offset units
      const [waterfallL, waterfallR] = waterfall.getWaterfallRange();
      const span = waterfallR - waterfallL;
      if (!span || !Number.isFinite(span)) {
        hideHighlights();
        return;
      }

      // Passband is in FFT offsets, same space as audio.getAudioRange()
      passband =
        passband || (audio.getAudioRange ? audio.getAudioRange() : null);
      if (!passband || passband.length < 3) {
        hideHighlights();
        return;
      }

      const [l, , r] = passband;

      // Map offsets to percentage across the waterfall (0–100%)
      const x1 = ((l - waterfallL) / span) * 100;
      const x2 = ((r - waterfallL) / span) * 100;

      if (!Number.isFinite(x1) || !Number.isFinite(x2)) {
        hideHighlights();
        return;
      }

      const leftPercent = Math.max(0, Math.min(100, Math.min(x1, x2)));
      const rightPercent = Math.max(0, Math.min(100, Math.max(x1, x2)));
      const widthPercent = Math.max(0.2, rightPercent - leftPercent);

      waterfallHighlightInner.style.display = "block";
      waterfallHighlightInner.style.left = leftPercent + "%";
      waterfallHighlightInner.style.width = widthPercent + "%";

      // Light yellow fill (no horizontal lines)
      waterfallHighlightInner.style.background = "rgba(255,255,180,0.15)";
      // Vertical borders only (smooth)
      waterfallHighlightInner.style.borderLeft =
        "2px solid rgba(255,255,200,0.20)";
      waterfallHighlightInner.style.borderRight =
        "2px solid rgba(255,255,200,0.20)";

      // Remove any shadows that create horizontal glow
      waterfallHighlightInner.style.boxShadow = "none";

      // Mirror the same band onto the spectrum analyzer (same X mapping / range)
      if (spectrumHighlightInner) {
        if (spectrumDisplay) {
          spectrumHighlightInner.style.display = "block";
          spectrumHighlightInner.style.left = leftPercent + "%";
          spectrumHighlightInner.style.width = widthPercent + "%";
          spectrumHighlightInner.style.background = "rgba(255,255,180,0.15)";
          spectrumHighlightInner.style.borderLeft =
            "2px solid rgba(255,255,200,0.20)";
          spectrumHighlightInner.style.borderRight =
            "2px solid rgba(255,255,200,0.20)";
          spectrumHighlightInner.style.boxShadow = "none";
        } else {
          spectrumHighlightInner.style.display = "none";
        }
      }
    } catch (err) {
      console.warn("drawWaterfallHighlight error", err);
    }
  }

  /*
  // Wheel zooming, update passband and markers
  function handleWaterfallWheel(e) {
    waterfall.canvasWheel(e);
    passbandTunerComponent.updatePassbandLimits();
    updatePassband();
    frequencyMarkerComponent.updateFrequencyMarkerPositions();
  }
  */

  // begin change frequency with arrows
  // Keep decimals tidy when stepping by 0.01 kHz
  const roundKHz = (v) => Math.round(v * 1000) / 1000;

  function applyStep(deltaKHz) {
    const next = roundKHz((Number(frequency) || 0) + deltaKHz);
    frequency = next;

    const hz = Math.round(next * 1e3);
    try {
      if (frequencyInputComponent && frequencyInputComponent.setFrequency)
        frequencyInputComponent.setFrequency(hz);
    } catch (e) {}
    handleFrequencyChange({ detail: hz });
  }

  function cancelBrowser(e) {
    e.preventDefault();
    e.stopPropagation();
    if (e.stopImmediatePropagation) e.stopImmediatePropagation();
  }

  function onKey(e) {
    // If ArrowLeft/ArrowRight are pressed inside the chat input textarea,
    // let them move the caret instead of tuning.
    try {
      const t = e.target;

      if (t instanceof HTMLElement) {
        // Adjust these selectors to match your chat & bookmark textarea
        const inTextInput =
          t.id === "textInput" || // e.g. <textarea id="textInput">
          (t.closest ? t.closest('[data-role="chat-input"]') : null); // or wrapper with data-role

        if (
          inTextInput &&
          (e.code === "ArrowLeft" || e.code === "ArrowRight")
        ) {
          return; // allow native cursor movement only in chat input
        }
      }
    } catch (e) {}

    // --- Right-Ctrl = snap to .00 kHz ---
    if (e.code === "ControlRight") {
      cancelBrowser(e);

      const base = Math.floor(Number(frequency) || 0);
      frequency = base;

      const hz = Math.round(base * 1e3);
      try {
        if (frequencyInputComponent && frequencyInputComponent.setFrequency)
          frequencyInputComponent.setFrequency(hz);
      } catch (e) {}
      handleFrequencyChange({ detail: hz });

      return;
    }

    // Only arrows
    const c = e.code;
    if (!c || !c.startsWith("Arrow")) return;

    const shift = e.shiftKey;
    const ctrlOrMeta = e.ctrlKey || e.metaKey;
    const isUpDown = c === "ArrowUp" || c === "ArrowDown";
    const isLeftRight = c === "ArrowLeft" || c === "ArrowRight";

    let stepKHz = 0;
    let sign = 0;

    if (isUpDown) {
      if (shift && ctrlOrMeta) stepKHz = 1000;
      else if (ctrlOrMeta) stepKHz = 100;
      else if (shift) stepKHz = 1;
      else stepKHz = 0.01;
      sign = c === "ArrowUp" ? +1 : -1;
    } else if (isLeftRight) {
      if (shift && ctrlOrMeta) stepKHz = 10000;
      else if (ctrlOrMeta) stepKHz = 500;
      else if (shift) stepKHz = 10;
      else stepKHz = 0.1;
      sign = c === "ArrowRight" ? +1 : -1;
    }

    if (!stepKHz) return;

    cancelBrowser(e);
    applyStep(sign * stepKHz);
  }

  onMount(() => {
    window.addEventListener("keydown", onKey, {
      capture: true,
      passive: false,
    });
  });
  onDestroy(() => {
    window.removeEventListener("keydown", onKey, { capture: true });
  });
  // end change frequency with arrows

  // Window for shortcuts
  let showShortcuts = false;
  let closeBtnEl;

  function openShortcuts() {
    showShortcuts = true;
    tick().then(() => closeBtnEl && closeBtnEl.focus());
  }

  function closeShortcuts() {
    showShortcuts = false;
  }

  // Window for users
  let showUsers = false;
  let closeUsersBtnEl;

  function openUsers() {
    showUsers = true;
    tick().then(() => closeUsersBtnEl && closeUsersBtnEl.focus());
  }

  function closeUsers() {
    showUsers = false;
  }

  // Tune to a listener's frequency, requested from the "Connected Users"
  // window. users.html is served inside an <iframe> and posts a
  // {type:'phantomsdr-tune'} message up to us, because it has no receiver of
  // its own -- the waterfall and audio socket live here.
  //
  // Deliberately a PLAIN tune: frequency + mode, nothing else. Unlike
  // tuneToDXFrequency(), this does not zoom to the band, does not overwrite
  // min/max_waterfall with the band presets and does not switch auto-adjust
  // off. Someone checking what another listener is hearing expects their own
  // display to survive the trip.
  // bands-config spells CW as 'CW-U' and marks data segments 'DIGITAL';
  // neither is a demodulator we can hand to SetMode as-is. Returns null for
  // anything with no matching entry, meaning "leave the mode alone".
  function _tuneModeToDemod(m) {
    if (!m) return null;
    const up = m === "CW-U" ? "CW" : m;
    return demodulationDefaults[up] ? up : null;
  }

  function tuneToUserFrequency(hz, mode) {
    const f = Number(hz);
    if (!isFinite(f) || f <= 0) return;
    try {
      // 1. Frequency first. `frequency` (kHz) is what _bandDefaultMode() reads,
      //    so it has to reflect the new position before we ask for the mode.
      frequencyInputComponent.setFrequency(f);
      handleFrequencyChange({ detail: f });

      // 2. Mode: what the other listener is actually using wins, so we hear
      //    what they hear. The server reports "iq" when there is no real
      //    demodulation to copy -- only then does the band's default fill in.
      //    A running decoder outranks both: it keeps its own mode and passband
      //    until it is switched off.
      const wanted = _tuneModeToDemod(mode) || _bandDefaultMode();
      if (_decoderOwnsReceiver()) _decoderReassertReceiver();
      else if (wanted && wanted !== demodulation) SetMode(wanted);

      // 3. Band framing -- zoom, brightness (Min slider) and contrast (Max
      //    slider) follow the band we landed in, the same way a band change
      //    frames it. Auto-adjust is deliberately left alone: it only moves
      //    the slider display, never waterfall.minWaterfall/maxWaterfall
      //    (setMinOffset/setMaxOffset are the only writers), so the band
      //    brightness holds without switching the feature off.
      const freqKHz = f / 1000;
      let bandIdx = -1;
      for (let i = 0; i < bandArray.length; i++) {
        const b = bandArray[i];
        if (
          freqKHz >= b.startFreq / 1000 &&
          freqKHz <= b.endFreq / 1000 &&
          (b.ITU === siteRegion || b.ITU === 123)
        ) {
          bandIdx = i;
          break;
        }
      }

      if (bandIdx >= 0) {
        const band = bandArray[bandIdx];

        // bands-config.js is hand-edited per site, so treat its fields as
        // untrusted: a band missing min/max would push NaN into the colour
        // mapping, and a NaN zoom range slips past setWaterfallRange's
        // `l >= r` check (NaN comparisons are always false) and blanks the
        // waterfall. Skip what is missing, keep what is there.
        const bMin = parseInt(band.min);
        const bMax = parseInt(band.max);
        if (Number.isFinite(bMin) && Number.isFinite(bMax)) {
          min_waterfall = bMin; // Brightness slider
          max_waterfall = bMax; // Contrast slider
          handleMinMove();
          handleMaxMove();
        }

        // Whole band plus a 1 % margin, centred on where we landed rather than
        // on the band centre, so the frequency we tuned to stays in view.
        // A band wider than the receiver's coverage is fine: setWaterfallRange
        // clamps out-of-bounds edges to the full span.
        const hzPerBin = waterfall.sps / waterfall.fftSize;
        let bandSpan =
          (band.endFreq / hzPerBin - band.startFreq / hzPerBin) / 2;
        bandSpan += bandSpan * 0.01;

        let m = frequencyToFFTOffset(f);
        m = Math.min(waterfall.waterfallMaxSize - 512, Math.max(512, m));
        if (Number.isFinite(bandSpan) && Number.isFinite(m)) {
          waterfall.setWaterfallRange(
            Math.floor(m - 512) - bandSpan,
            Math.ceil(m + 512) + bandSpan,
          );
        }

        currentBand = bandIdx;
        bandName = band.name;
        currentTuneStep = band.stepi;
      }
      // Outside every configured band there is nothing to frame with, so the
      // frequency and mode still change and the display is left as it was.

      // 4. Refresh markers and passband for the new position and zoom.
      updatePassband();
      frequencyMarkerComponent.updateFrequencyMarkerPositions();
    } catch (e) {
      console.warn("User tune error:", e);
    }
  }

  // The users iframe is embedded as {siteIP}/users.html, and siteIP is an
  // absolute URL from site_information.json -- so its origin legitimately
  // differs from ours whenever the visitor arrived by LAN IP, an alternate
  // hostname, or https while siteIP is http. Trust both, and nothing else.
  function isTrustedTuneOrigin(origin) {
    if (origin === location.origin) return true;
    try {
      return !!siteIP && origin === new URL(siteIP, location.href).origin;
    } catch (e) {
      return false; // malformed siteIP -- same-origin only
    }
  }

  function onUserTuneMessage(e) {
    if (!isTrustedTuneOrigin(e.origin)) return;
    const d = e.data;
    if (!d) return;

    // The users iframe asks who we are so it can mark our own row "you", the
    // way the mobile page does. Only we can answer: the id is the signal-
    // protocol UUID the server handed our audio socket in the initial
    // settings frame, and it is the same key it writes into every /users row.
    if (d.type === "phantomsdr-hello") {
      let id = null;
      try {
        if (audio && typeof audio.getClientId === "function")
          id = audio.getClientId();
      } catch (err) {
        id = null; // audio not up yet -- the iframe asks again next poll
      }
      try {
        if (e.source)
          e.source.postMessage({ type: "phantomsdr-me", id }, e.origin);
      } catch (err) {
        // iframe closed between asking and answering -- nothing to do
      }
      return;
    }

    if (d.type !== "phantomsdr-tune") return;
    tuneToUserFrequency(d.freq_hz, d.mode);
    // Both the users and the statistics iframes send this, and we cannot tell
    // which from the message alone. Closing both is safe -- they are plain
    // booleans, and closing one that is already shut is a no-op. Either way we
    // get out of the way so the waterfall move is visible.
    closeUsers();
    closeStats();
  }

  onMount(() => window.addEventListener("message", onUserTuneMessage));
  onDestroy(() => window.removeEventListener("message", onUserTuneMessage));
  onDestroy(() => catSyncHandle && catSyncHandle.close());

  // users.html opened in its own tab (http://host:port/users.html) rather than
  // in the modal has no parent frame to ask, so the same "who am I" question
  // arrives over a BroadcastChannel instead. Identical question, identical
  // answer -- only the transport differs, and it is same-origin by definition,
  // which is the trust boundary isTrustedTuneOrigin() enforces by hand for the
  // iframe. A page on another origin (LAN IP vs hostname) cannot reach us this
  // way and simply marks no row, exactly as it does today.
  let _whoAmIChannel = null;

  function _myClientId() {
    try {
      return audio && typeof audio.getClientId === "function"
        ? audio.getClientId()
        : null;
    } catch (e) {
      return null; // audio not up yet -- the asker retries every poll
    }
  }

  function _onWhoAmIMessage(e) {
    const d = e && e.data;
    if (!d || d.type !== "phantomsdr-hello") return;
    const id = _myClientId();
    if (!id) return; // no id yet; the next question gets a real answer
    try {
      _whoAmIChannel.postMessage({ type: "phantomsdr-me", id });
    } catch (err) {
      // channel closed between question and answer -- nothing to do
    }
  }

  onMount(() => {
    if (typeof BroadcastChannel === "undefined") return;
    try {
      _whoAmIChannel = new BroadcastChannel("phantomsdr");
      _whoAmIChannel.addEventListener("message", _onWhoAmIMessage);
    } catch (e) {
      _whoAmIChannel = null;
    }
  });

  onDestroy(() => {
    if (!_whoAmIChannel) return;
    try {
      _whoAmIChannel.removeEventListener("message", _onWhoAmIMessage);
      _whoAmIChannel.close();
    } catch (e) {
      /* already gone */
    }
    _whoAmIChannel = null;
  });

  // Window for stats
  let showStats = false;
  let closeStatsBtnEl;

  function openStats() {
    showStats = true;
    tick().then(() => closeStatsBtnEl && closeStatsBtnEl.focus());
  }

  function closeStats() {
    showStats = false;
  }

  function onGlobalKey(e) {
    // Close shortcuts dialog on Escape when open
    if (showShortcuts && (e.key === "Escape" || e.code === "Escape")) {
      e.preventDefault();
      closeShortcuts();
      return;
    }
    // Close users dialog on Escape when open
    if (showUsers && (e.key === "Escape" || e.code === "Escape")) {
      e.preventDefault();
      closeUsers();
      return;
    }
    // Close stats dialog on Escape when open
    if (showStats && (e.key === "Escape" || e.code === "Escape")) {
      e.preventDefault();
      closeStats();
      return;
    }

    // --- Mode shortcuts: l/u/a/q/f ---
    // Ignore if user is typing in an input/textarea or editable element
    try {
      const t = e.target;
      if (
        t instanceof HTMLInputElement ||
        t instanceof HTMLTextAreaElement ||
        (t instanceof HTMLElement && t.isContentEditable)
      ) {
        return;
      }
    } catch (e) {}

    if (e.repeat) return;

    const k = (e.key || "").toLowerCase();
    if (k === "l") {
      e.preventDefault();
      SetMode("LSB");
      return;
    }
    if (k === "u") {
      e.preventDefault();
      SetMode("USB");
      return;
    }
    if (k === "a") {
      e.preventDefault();
      SetMode("AM");
      return;
    }
    if (k === "q") {
      e.preventDefault();
      SetMode("QUAM");
      return;
    }
    if (k === "f") {
      e.preventDefault();
      SetMode("FM");
      return;
    }
    if (k === "w") {
      e.preventDefault();
      toggleWaterfallDirection();
      return;
    }
  }

  onMount(() =>
    window.addEventListener("keydown", onGlobalKey, { capture: true }),
  );
  onDestroy(() =>
    window.removeEventListener("keydown", onGlobalKey, { capture: true }),
  );
  // End of the popup window

  // Window for system stats
  let showSystemStats = false;
  let systemStatsCloseBtnEl;
  let systemStatsInterval;

  // System stats data - will be fetched from server
  let systemStats = {
    cpu: { usage: 0, cores: 0, coresUsed: null, temperature: null, frequency: null, topProcesses: [] },
    memory: { used: 0, total: 0, percent: 0 },
  };

  // Fetch system stats from the server
  async function fetchSystemStats() {
    try {
      const response = await fetch(`${siteStats}/api/system-stats`);
      if (response.ok) {
        systemStats = await response.json();
      } else {
        console.error("Failed to fetch system stats:", response.statusText);
      }
    } catch (error) {
      console.error("Error fetching system stats:", error);
    }
  }

  function openSystemStats() {
    showSystemStats = true;
    tick().then(() => systemStatsCloseBtnEl && systemStatsCloseBtnEl.focus());

    // Fetch stats immediately when opening
    fetchSystemStats();

    // Update stats every 5 seconds while the modal is open
    systemStatsInterval = setInterval(fetchSystemStats, 5000);
  }

  function closeSystemStats() {
    showSystemStats = false;

    // Stop updating when modal is closed
    if (systemStatsInterval) {
      clearInterval(systemStatsInterval);
      systemStatsInterval = null;
    }
  }

  function onSystemStatsKey(e) {
    if (showSystemStats && (e.key === "Escape" || e.code === "Escape")) {
      e.preventDefault();
      closeSystemStats();
    }
  }

  onMount(() => {
    window.addEventListener("keydown", onSystemStatsKey, { capture: true });
    // Optionally fetch stats on initial load
    fetchSystemStats();
  });

  onDestroy(() => {
    window.removeEventListener("keydown", onSystemStatsKey, { capture: true });
    if (systemStatsInterval) {
      clearInterval(systemStatsInterval);
    }
  });
  // End of system stats popup window

  // Wheel zooming, update passband and markers
  function handleWaterfallWheel(e) {
    const ctrlPressed = e.ctrlKey || e.metaKey; // metaKey for Mac Command key
    const shiftPressed = e.shiftKey;
    const shiftCtrlPressed = ctrlPressed && shiftPressed; // Both pressed together

    // If Ctrl, Shift, or Shift+Ctrl is pressed, adjust frequency instead of zooming
    if (ctrlPressed || shiftPressed || shiftCtrlPressed) {
      e.preventDefault(); // Prevent default scroll behavior
      if (shiftCtrlPressed) {
        e.preventDefault();
        // Snap to .000 kHz (coarse step)
        const base = Math.floor(Number(frequency) || 0);
        frequency = base; // keep in kHz
        // Convert back to Hz for the tuner
        const hz = Math.round(base * 1000);
        frequencyInputComponent.setFrequency(hz);
        handleFrequencyChange({ detail: hz });

        return; // do NOT apply wheel delta further
      }

      // Determine step size based on which modifier key is pressed
      let stepSize;
      if (shiftPressed) {
        stepSize = 100; // Shift alone = 100 Hz
      } else if (ctrlPressed) {
        stepSize = 10; // Ctrl alone = 10 Hz
      }

      // Determine frequency change direction based on wheel delta
      const delta = e.deltaY > 0 ? -stepSize : stepSize;

      // Get current center frequency in Hz
      let currentFreqHz = frequencyInputComponent.getFrequency();

      // Update frequency
      currentFreqHz += delta;

      // Ensure frequency is not negative
      currentFreqHz = Math.max(0, currentFreqHz);

      // Apply the new frequency
      frequencyInputComponent.setFrequency(currentFreqHz);
      handleFrequencyChange({ detail: currentFreqHz });

      // Update the display variable (convert Hz to kHz with 2 decimals)
      frequency = (currentFreqHz / 1e3).toFixed(3);
    } else {
      // Normal zoom behavior when no modifier keys are pressed
      waterfall.canvasWheel(e);
      passbandTunerComponent.updatePassbandLimits();
      updatePassband();
      frequencyMarkerComponent.updateFrequencyMarkerPositions();
    }
  }

  function handleBandPlanClick(event) {
    const rect = event.target.getBoundingClientRect();
    const x = event.clientX - rect.left;

    // First, check if a marker was clicked
    const markerClicked = waterfall.handleMarkerClick(x);

    // If no marker was clicked, handle the passband click
    if (!markerClicked) {
      passbandTunerComponent.handlePassbandClick(event);
    }
  }

  function handleBandPlanMouseMove(event) {
    const rect = event.target.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    if (waterfall.handleMarkerHover(x, y)) {
      event.target.style.cursor = "pointer";
    } else {
      event.target.style.cursor = "default";
      waterfall.updateBandPlan(); // Clear previous hover effects
    }
  }

  function handleGraduationClick(event) {
    const canvas = event.currentTarget;
    const rect = canvas.getBoundingClientRect();
    const canvasX = (event.clientX - rect.left) * (canvas.width / rect.width);
    const canvasY = (event.clientY - rect.top) * (canvas.height / rect.height);
    const freqHz = waterfall.checkClientClick(canvasX, canvasY);
    if (freqHz !== null) {
      frequency = Math.max(0, freqHz / 1e3).toFixed(3);
      frequencyInputComponent.setFrequency(freqHz);
      handleFrequencyChange({ detail: freqHz });
    } else {
      passbandTunerComponent.handlePassbandClick(event);
    }
  }

  function handleClientsMouseMove(event) {
    const canvas = event.currentTarget;
    const rect = canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) * (canvas.width / rect.width);
    const y = (event.clientY - rect.top) * (canvas.height / rect.height);
    canvas.style.cursor =
      waterfall.checkClientClick(x, y) !== null ? "pointer" : "default";
  }

  // Decoder
  // ── Unified decoder toggle / dropdown ──────────────────────────────────
  let decoderOn = false; // Off/On master toggle
  let selectedDecoder = "none"; // value from the <select> dropdown

  // internal per-decoder state (driven by activateSelectedDecoder)
  let ft8Enabled = false;
  let ft4Enabled = false;

  // FTx capture lead-in, in seconds, matching KiwiSDR's time_shift. The audio
  // reaching the decoder lags the UTC slot boundary by the streaming/jitter
  // buffer depth, so the capture window has to open that much later. 0.8 s is
  // ft8_lib's own default; trim it if decodes are weak or absent.
  let ftxTimeShift = 0.8;
  // The slider's range is the active mode's slot period, not a constant: the
  // shift is a phase within the slot, and FT2's is 3.75 s.
  let ftxShiftMax = 3.75;
  let ftxAutoSync = true;
  function handleFtxTimeShift() {
    ftxAutoSync = false; // touching the slider means manual control
    audio?.setFTxAutoSync?.(false);
    audio?.setFTxTimeShift?.(ftxTimeShift);
  }
  function handleFtxAutoSync() {
    audio?.setFTxAutoSync?.(ftxAutoSync);
  }
  // Let the auto-sync loop drive the slider, and adopt the stored value on load.
  function bindFtxSync() {
    if (!audio) return;
    if (typeof audio.getFTxTimeShift === "function")
      ftxTimeShift = audio.getFTxTimeShift();
    if (typeof audio.getFTxShiftRange === "function")
      ftxShiftMax = audio.getFTxShiftRange();
    if (typeof audio.ftxAutoSync === "boolean") ftxAutoSync = audio.ftxAutoSync;
    audio.onFTxTimeShiftChange = (v) => {
      ftxTimeShift = v;
      // Fires on a mode switch too, so the range follows the mode.
      if (typeof audio.getFTxShiftRange === "function")
        ftxShiftMax = audio.getFTxShiftRange();
    };
  }
  let ft2Enabled = false;
  let cwEnabled = false;
  let wsprEnabled = false;

  // ── JS8 ────────────────────────────────────────────────────────────────
  // Unlike FT8, a JS8 frame is not a message: several frames in consecutive
  // slots assemble into one. So the panel shows two lists — messages that have
  // completed, and the ones still being received.
  let js8Enabled = false;
  let js8Submode = 0; // 0=Normal 1=Fast 2=Turbo 3=Slow 4=Ultra
  let js8Messages = [];
  let js8Pending = [];
  let js8SlotPos = 0;
  let _js8Timer = null;
  let wsprMessages = []; // reactive list for Svelte WSPR panel
  let wsprSlotPos = 0; // 0–119 s position within current 2-min slot
  let wsprPhase = "waiting"; // 'waiting' | 'collecting' | 'decoding'
  let _wsprTimer = null;

  function _wsprTickStart() {
    if (_wsprTimer) return;
    _wsprTimer = setInterval(() => {
      const now = new Date();
      wsprSlotPos = (now.getUTCMinutes() % 2) * 60 + now.getUTCSeconds();
      wsprPhase =
        wsprSlotPos >= 119
          ? "decoding"
          : wsprSlotPos >= 0
            ? "collecting"
            : "waiting";
    }, 500);
  }
  /**
   * Refresh the JS8 panel twice a second.
   *
   * Two things need it: the slot progress bar, and the list of part-received
   * messages. The reassembler is only touched when a slot decodes, so the UI
   * has to pull its state rather than wait to be pushed.
   */
  function _js8TickStart() {
    if (_js8Timer) return;
    _js8Timer = setInterval(() => {
      const period = JS8_SUBMODE_PERIOD_S[js8Submode] || 15;
      js8SlotPos = (Date.now() / 1000) % period;
      if (audio && typeof audio.js8Pending === "function") {
        js8Pending = audio.js8Pending();
      }
    }, 500);
  }
  function _js8TickStop() {
    if (_js8Timer) {
      clearInterval(_js8Timer);
      _js8Timer = null;
    }
    js8SlotPos = 0;
    js8Pending = [];
  }

  /**
   * Change JS8 speed.
   *
   * Everything in flight is abandoned by audio.setJS8Submode(): the buffers
   * hold frames from a different slot cadence, and the frequency tolerance for
   * grouping them differs per speed. The sync offset is per-submode too, so the
   * slider re-reads it.
   */
  function handleJs8Submode() {
    const n = Number(js8Submode);
    js8Submode = n;
    js8Pending = [];
    audio?.setJS8Submode?.(n);
    bindFtxSync();
  }

  function _wsprTickStop() {
    if (_wsprTimer) {
      clearInterval(_wsprTimer);
      _wsprTimer = null;
    }
    wsprSlotPos = 0;
    wsprPhase = "waiting";
  }

  // ─────────────────────────────────────────────────────────────────────────
  // HF FAX / WEFAX decoder state
  // ─────────────────────────────────────────────────────────────────────────

  const FAX_STATIONS = [
    // ── Europe ────────────────────────────────────────────────────────────
    {
      name: "GYA — UK Northwood",
      freqs: [2618.5, 4610, 8040, 11086.5],
      lpm: 120,
      ioc: 576,
    },
    {
      name: "DDH3/DDK6 — Germany Hamburg",
      freqs: [3855, 7880, 13882.5],
      lpm: 120,
      ioc: 576,
    },
    {
      name: "SVJ4 — Greece Athens",
      freqs: [4482.9, 8106.9],
      lpm: 120,
      ioc: 576,
    },
    // ── Russia ────────────────────────────────────────────────────────────
    {
      name: "RBW41 — Russia Murmansk",
      freqs: [5336, 6445.5, 7908.8, 8444, 10130],
      lpm: 120,
      ioc: 576,
    },
    // ── Asia ──────────────────────────────────────────────────────────────
    {
      name: "HLL2 — South Korea Seoul",
      freqs: [3585, 5857.5, 7433.5, 9165, 13570],
      lpm: 120,
      ioc: 576,
    },
    {
      name: "JMH — Japan Tokyo",
      freqs: [3622.5, 7795, 13988.5],
      lpm: 120,
      ioc: 576,
    },
    {
      name: "JFX — Japan Kagoshima",
      freqs: [4274, 8658, 13074, 16907.5, 22559.6],
      lpm: 120,
      ioc: 576,
    },
    {
      name: "XSG — China Shanghai",
      freqs: [4170, 8302, 12382, 16559],
      lpm: 120,
      ioc: 576,
    },
    {
      name: "XSQ — China Guangzhou",
      freqs: [4199.75, 8412.5, 12629.25, 16826.25],
      lpm: 120,
      ioc: 576,
    },
    // ── Pacific ───────────────────────────────────────────────────────────
    {
      name: "VMC — Australia Charleville",
      freqs: [2628, 5100, 11030, 13920, 20469],
      lpm: 120,
      ioc: 576,
    },
    {
      name: "VMW — Australia Wiluna",
      freqs: [5755, 7535, 10555, 15615, 18060],
      lpm: 120,
      ioc: 576,
    },
    // ZLM — New Zealand Wellington: ceased radiofax 1 July 2023
    // ── Americas ──────────────────────────────────────────────────────────
    {
      name: "KVM70 — USA Honolulu HI",
      freqs: [9982.5, 11090, 16135],
      lpm: 120,
      ioc: 576,
    },
    {
      name: "NMC — USA Point Reyes CA",
      freqs: [4346, 8682, 12786, 17151.2, 22527],
      lpm: 120,
      ioc: 576,
    },
    {
      name: "NMG — USA New Orleans LA",
      freqs: [4317.9, 8503.9, 12789.9, 17146.4],
      lpm: 120,
      ioc: 576,
    },
    {
      name: "NMF — USA Boston MA",
      freqs: [4235, 6340.5, 9110, 12750],
      lpm: 120,
      ioc: 576,
    },
    {
      name: "NOJ — USA Kodiak AK",
      freqs: [2054, 4298, 8459, 12412.5],
      lpm: 120,
      ioc: 576,
    },
    {
      name: "VCO — Canada Sydney NS",
      freqs: [4416, 6915.1],
      lpm: 120,
      ioc: 576,
    },
    {
      name: "CBV — Chile Valparaiso",
      freqs: [4228, 8677, 17146.4],
      lpm: 120,
      ioc: 576,
    },
  ];

  let faxEnabled = false;

  let faxLPM = 120;
  let faxIOC = 576;
  let faxShift = 800;
  let faxAutoAlign = true;
  let faxInvert = false;
  let faxLineCount = 0;
  let faxPhasing = false;
  let faxStopTone = false;
  let faxSelectedStation = "";
  let faxSelectedFreqIdx = 0;
  let faxStationObj = null;

  const FAX_CANVAS_W = 910;
  const FAX_CANVAS_H = 540;
  let faxCanvas;
  let faxCtx = null;

  // A fax line is π×IOC pixels wide (1810 at IOC 576) but the canvas is only
  // FAX_CANVAS_W px, so the horizontal scale is ~0.5.  Advancing one canvas row
  // per fax line therefore stretched the picture vertically by the same factor
  // (letters and coastlines pulled up and down).  Keep a fractional row budget
  // instead and box-average the fax lines that share one canvas row.
  const faxRowAccum = new Float32Array(FAX_CANVAS_W);
  const faxRowPix = new Uint8Array(FAX_CANVAS_W);
  let faxRowLines = 0;
  let faxRowBudget = 0;

  function _faxResetScaler() {
    faxRowAccum.fill(0);
    faxRowLines = 0;
    faxRowBudget = 0;
  }

  function _faxInitCanvas() {
    if (!faxCanvas) return;
    faxCtx = faxCanvas.getContext("2d", { willReadFrequently: true });
    faxCtx.fillStyle = "#000";
    faxCtx.fillRect(0, 0, FAX_CANVAS_W, FAX_CANVAS_H);
    _faxResetScaler();
  }

  function _faxDrawLine(pixels) {
    if (!faxCtx) return;
    const W = FAX_CANVAS_W;
    const H = FAX_CANVAS_H;
    const PPL = pixels.length;
    if (!PPL) return;

    // Horizontal box-average into the row accumulator (nearest-neighbour
    // sampling threw away half the pixels and aliased the fine print).
    for (let x = 0; x < W; x++) {
      const first = Math.floor((x * PPL) / W);
      const last = Math.max(
        first,
        Math.min(PPL - 1, Math.floor(((x + 1) * PPL) / W) - 1),
      );
      let acc = 0;
      for (let s = first; s <= last; s++) acc += pixels[s];
      faxRowAccum[x] += acc / (last - first + 1);
    }
    faxRowLines++;

    // One fax line is W/PPL canvas rows tall — only emit when a full row is due.
    faxRowBudget += W / PPL;
    if (faxRowBudget < 1) return;

    for (let x = 0; x < W; x++) {
      let g = Math.round(faxRowAccum[x] / faxRowLines);
      if (faxInvert) g = 255 - g;
      faxRowPix[x] = g < 0 ? 0 : g > 255 ? 255 : g;
    }
    faxRowAccum.fill(0);
    faxRowLines = 0;

    const img = faxCtx.getImageData(0, 0, W, H);
    const d = img.data;
    const rowStart = (H - 1) * W * 4;

    // Bottom-up streaming mode:
    // 1) move the existing image one line upward
    // 2) draw the newest line at the bottom
    // (the loop repeats the row when a line is taller than one canvas row,
    //  which happens at IOC 288 where the line is narrower than the canvas)
    while (faxRowBudget >= 1) {
      faxRowBudget -= 1;
      d.copyWithin(0, W * 4, H * W * 4);
      for (let x = 0; x < W; x++) {
        const g = faxRowPix[x];
        const i = rowStart + x * 4;
        d[i] = g;
        d[i + 1] = g;
        d[i + 2] = g;
        d[i + 3] = 255;
      }
    }

    faxCtx.putImageData(img, 0, 0);
  }

  function _faxLineCallback(event) {
    if (event.type !== "line") return;
    faxLineCount = event.lineNum;
    faxPhasing = event.phasing;
    faxStopTone = event.stopTone;
    _faxDrawLine(event.pixels);
  }

  function _faxDeactivate() {
    if (!faxEnabled) return;
    faxEnabled = false;
    audio.setFAXDecoding(false);
    audio.setFAXCallback(null);
    _faxCountdownStop();
    const m = _bandDefaultMode();
    if (m !== demodulation) {
      demodulation = m;
      handleDemodulationChange(null, true);
    }
    if (audio && typeof audio.updateFilters === "function")
      audio.updateFilters();
  }

  function _faxActivate() {
    tick().then(async () => {
      _faxInitCanvas();
      faxLineCount = 0;
      faxPhasing = false;
      faxStopTone = false;

      // FAX is always received USB.  Switch FIRST: handleDemodulationChange()
      // retunes the server-side stream, and doing that after the decoder is
      // running fed the transition into the discriminator as image data (and
      // dropped audio on top of decoder start-up), same as the SSTV path.
      if (demodulation !== "USB") {
        demodulation = "USB";
        handleDemodulationChange(null, true);
        await tick();
        await new Promise((resolve) => setTimeout(resolve, 60));
      }

      audio.setFAXParams(faxLPM, faxIOC, faxShift);
      audio.setFAXAutoAlign(faxAutoAlign);
      audio.setFAXCallback(_faxLineCallback);
      audio.setFAXDecoding(true);
    });
    _faxCountdownStart();
  }

  function _faxUpdateParams() {
    if (!faxEnabled) return;
    audio.setFAXParams(faxLPM, faxIOC, faxShift);
    audio.setFAXAutoAlign(faxAutoAlign);
  }

  function faxRefresh() {
    faxLineCount = 0;
    faxPhasing = false;
    faxStopTone = false;
    if (faxCtx) {
      faxCtx.fillStyle = "#000";
      faxCtx.fillRect(0, 0, FAX_CANVAS_W, FAX_CANVAS_H);
      _faxResetScaler();
    }
    if (faxEnabled) {
      audio.setFAXDecoding(false);
      audio.setFAXDecoding(true);
      audio.setFAXParams(faxLPM, faxIOC, faxShift);
      audio.setFAXAutoAlign(faxAutoAlign);
      audio.setFAXCallback(_faxLineCallback);
    }
  }

  function faxSaveImage() {
    if (!faxCanvas) return;
    const a = document.createElement("a");
    const ts = new Date().toISOString().slice(0, 16).replace(":", "-");
    a.download = `hffax_${ts}.png`;
    a.href = faxCanvas.toDataURL("image/png");
    a.click();
  }

  function faxApplyStation() {
    const st = FAX_STATIONS.find((s) => s.name === faxSelectedStation);
    if (!st) return;
    faxStationObj = st;
    faxLPM = st.lpm;
    faxIOC = st.ioc;
    const freqKhz = st.freqs[faxSelectedFreqIdx] || st.freqs[0];
    // WEFAX stations are published as the centre frequency of the signal.
    // In USB mode the dial must be set 1900 Hz BELOW that centre so that
    // the black tone (1500 Hz) and white tone (2300 Hz) both fall inside
    // the passband.  e.g. 13882.5 kHz centre → dial 13880.6 kHz USB.
    const FAX_USB_OFFSET_HZ = 1900;
    const hz = Math.round(freqKhz * 1000) - FAX_USB_OFFSET_HZ;
    try {
      if (frequencyInputComponent && frequencyInputComponent.setFrequency)
        frequencyInputComponent.setFrequency(hz);
      handleFrequencyChange({ detail: hz });
      frequency = (hz / 1e3).toFixed(3);
    } catch (e) {
      console.warn("[FAX] tune error", e);
    }
    demodulation = "USB";
    handleDemodulationChange(null, true);
    _faxUpdateParams();
  }

  function faxToggleAutoAlign() {
    faxAutoAlign = !faxAutoAlign;
    if (faxEnabled) audio.setFAXAutoAlign(faxAutoAlign);
  }

  function faxToggleInvert() {
    faxInvert = !faxInvert;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SSTV desktop + mobile panel state
  // ─────────────────────────────────────────────────────────────────────────

  let sstvEnabled = false;
  let sstvRunning = false;
  let sstvCanvas;
  let sstvCtx = null;
  let sstvModeChoice = "auto";
  let sstvStarting = false;
  let sstvDetectedMode = "";
  let sstvStatusText = "";
  let sstvLineCount = 0;
  let sstvSoftSync = false;
  const SSTV_CANVAS_W = 320;
  const SSTV_CANVAS_H = 256; // default / fallback
  let sstvCanvasH = 256; // actual height, updated per decoded frame

  // ── Idle splash ───────────────────────────────────────────────────────────
  // The station test card is shown, dimmed and captioned, from the moment the
  // panel opens until the first decoded row arrives.  Undimmed it looks exactly
  // like a completed decode, which is precisely the wrong thing to show while
  // the decoder is sitting on an empty channel.
  const SSTV_SPLASH_ALPHA = 0.35;
  let _sstvSplashImg = null; // decoded once, reused for every open
  let _sstvSplashPending = null; // in-flight load
  let _sstvSplashShown = false; // splash currently on the canvas
  let _sstvSplashToken = 0; // invalidates a load that resolves too late

  function _sstvSplashLoad() {
    if (_sstvSplashImg) return Promise.resolve(_sstvSplashImg);
    if (_sstvSplashPending) return _sstvSplashPending;
    _sstvSplashPending = new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        _sstvSplashImg = img;
        resolve(img);
      };
      img.onerror = () => resolve(null); // no splash, plain black -- never fatal
      img.src = sstvSplashUrl;
    });
    return _sstvSplashPending;
  }

  /**
   * Paint the dimmed test card over the whole canvas.
   *
   * The card is 4:3 while the canvas is 320x256 (5:4) for Martin/Scottie, and it
   * is stretched to fill rather than letterboxed on purpose: SSTV pixels are not
   * square, so this is exactly how the decoder itself renders the same picture
   * when one arrives.  Robot's 320x240 is 4:3 and fits with no distortion.
   *
   * The load is asynchronous, so by the time it resolves a picture may already be
   * decoding -- hence both the token and the line-count guard.
   */
  function _sstvDrawSplash(token) {
    _sstvSplashLoad().then((img) => {
      if (!img || !sstvCtx || token !== _sstvSplashToken || sstvLineCount > 0)
        return;
      const h = sstvCanvasH;
      sstvCtx.save();
      sstvCtx.fillStyle = "#000";
      sstvCtx.fillRect(0, 0, SSTV_CANVAS_W, h);
      sstvCtx.globalAlpha = SSTV_SPLASH_ALPHA;
      sstvCtx.drawImage(img, 0, 0, SSTV_CANVAS_W, h);
      sstvCtx.globalAlpha = 1;
      sstvCtx.fillStyle = "rgba(0,0,0,0.55)";
      sstvCtx.fillRect(0, h / 2 - 13, SSTV_CANVAS_W, 26);
      sstvCtx.font = "bold 13px system-ui, -apple-system, sans-serif";
      sstvCtx.textAlign = "center";
      sstvCtx.fillStyle = "#9be7ff";
      sstvCtx.fillText("WAITING FOR SIGNAL", SSTV_CANVAS_W / 2, h / 2 + 5);
      sstvCtx.restore();
      _sstvSplashShown = true;
    });
  }

  /** Wipe the splash before the first decoded row lands on top of it. */
  function _sstvClearSplash() {
    if (!_sstvSplashShown) return;
    _sstvSplashShown = false;
    _sstvSplashToken++;
    if (!sstvCtx) return;
    sstvCtx.fillStyle = "#000";
    sstvCtx.fillRect(0, 0, SSTV_CANVAS_W, sstvCanvasH);
  }

  function _sstvInitCanvas({ splash = true } = {}) {
    if (!sstvCanvas) return;
    sstvCanvasH = 256; // reset; resized on first 'line' event
    sstvCanvas.width = SSTV_CANVAS_W;
    sstvCanvas.height = sstvCanvasH;
    sstvCtx = sstvCanvas.getContext("2d", { willReadFrequently: true });
    sstvCtx.fillStyle = "#000";
    sstvCtx.fillRect(0, 0, SSTV_CANVAS_W, sstvCanvasH);
    _sstvSplashShown = false;
    _sstvSplashToken++;
    if (splash) _sstvDrawSplash(_sstvSplashToken);
  }

  async function sstvRefresh() {
    // Reset must stop, clean and restart the decoder.
    const wasRunning = !!sstvRunning;

    sstvRunning = false;
    sstvLineCount = 0;
    sstvSoftSync = false;
    sstvDetectedMode = "";
    sstvStatusText = "Resetting SSTV decoder";

    if (sstvCtx) {
      sstvCtx.fillStyle = "#000";
      sstvCtx.fillRect(0, 0, SSTV_CANVAS_W, sstvCanvasH);
      _sstvSplashShown = false;
      _sstvDrawSplash(++_sstvSplashToken);
    }

    audio.setSSTVDecoding(false);
    audio.setSSTVCallback(null);

    if (audio && typeof audio.resetSSTVDecoder === "function") {
      audio.resetSSTVDecoder(sstvModeChoice);
    }

    await tick();
    await new Promise((resolve) => setTimeout(resolve, 90));

    if (sstvEnabled && wasRunning) {
      sstvStatusText = "Waiting for VIS / AUTO lock";
      audio.setSSTVMode(sstvModeChoice);

      if (audio && typeof audio.resetSSTVDecoder === "function") {
        audio.resetSSTVDecoder(sstvModeChoice);
      }

      audio.setSSTVCallback(_sstvCallback);
      audio.setSSTVDecoding(true);
      sstvRunning = true;
    } else {
      sstvStatusText = "SSTV stopped";
    }
  }

  function sstvSaveImage() {
    if (!sstvCanvas) return;
    const a = document.createElement("a");
    const ts = new Date().toISOString().slice(0, 16).replace(":", "-");
    a.download = `sstv_${ts}.png`;
    a.href = sstvCanvas.toDataURL("image/png");
    a.click();
  }

  function _sstvDrawLine(event) {
    if (!sstvCtx || !event?.pixels) return;
    const y = Math.max(0, Math.min(sstvCanvasH - 1, event.lineNum || 0));
    const row = new ImageData(event.pixels, event.width || SSTV_CANVAS_W, 1);
    sstvCtx.putImageData(row, 0, y);
  }

  function _sstvCallback(event) {
    if (!event) return;
    if (event.type === "mode") {
      sstvDetectedMode = event.mode || "";
    } else if (event.type === "status") {
      sstvStatusText = event.text || "";
    } else if (event.type === "line") {
      // Resize canvas when a new frame has a different height (Robot 36 = 240, others = 256)
      const frameH = event.height || SSTV_CANVAS_H;
      if (frameH !== sstvCanvasH && sstvCanvas) {
        sstvCanvasH = frameH;
        sstvCanvas.height = sstvCanvasH;
        sstvCtx = sstvCanvas.getContext("2d", { willReadFrequently: true });
        sstvCtx.fillStyle = "#000";
        sstvCtx.fillRect(0, 0, SSTV_CANVAS_W, sstvCanvasH);
        _sstvSplashShown = false; // the resize already cleared it
      }
      _sstvClearSplash();
      sstvLineCount = (event.lineNum || 0) + 1;
      sstvSoftSync = !!event.soft;
      if (event.mode) sstvDetectedMode = event.mode;
      _sstvDrawLine(event);
    }
  }

  function _sstvStop() {
    sstvRunning = false;
    sstvSoftSync = false;
    sstvLineCount = 0;
    sstvDetectedMode = "";
    sstvStatusText = "SSTV stopped";

    audio.setSSTVDecoding(false);
    audio.setSSTVCallback(null);

    if (audio && typeof audio.resetSSTVDecoder === "function") {
      audio.resetSSTVDecoder(sstvModeChoice);
    }

    if (sstvCtx) {
      sstvCtx.fillStyle = "#000";
      sstvCtx.fillRect(0, 0, SSTV_CANVAS_W, sstvCanvasH);
      _sstvSplashShown = false;
      _sstvDrawSplash(++_sstvSplashToken);
    }
  }

  function _sstvDeactivate() {
    if (!sstvEnabled) return;
    sstvEnabled = false;
    _sstvStop();
    const m = _bandDefaultMode();
    if (m !== demodulation) {
      demodulation = m;
      handleDemodulationChange(null, true);
    }
    if (audio && typeof audio.updateFilters === "function")
      audio.updateFilters();
  }

  // Order matters here, and the old sequence caused an audible gap on every
  // activation.  It ran disable -> reset (which disables again) -> 60 ms wait ->
  // reset -> enable, i.e. four output-chain rebuilds, and THEN switched the
  // demodulator to USB, so the server-side stream change landed on top of the
  // graph churn.  Now: switch demodulation FIRST (skipped when already USB),
  // then a single reset + enable.
  /** Conventional SSTV sideband: LSB on 80m/40m, USB from 30m up. */
  function _sstvDefaultSideband() {
    const hz =
      Number(
        frequencyInputComponent && frequencyInputComponent.getFrequency
          ? frequencyInputComponent.getFrequency()
          : 0,
      ) || Math.round((Number(frequency) || 0) * 1000);
    return hz > 0 && hz < 10e6 ? "LSB" : "USB";
  }

  function _sstvStart() {
    tick().then(async () => {
      _sstvInitCanvas();
      sstvRunning = true;
      sstvStarting = true;
      sstvLineCount = 0;
      sstvDetectedMode = "";
      sstvSoftSync = false;
      sstvStatusText = "Waiting for VIS / AUTO lock";

      // SSTV is worked USB from 30m up, but LSB on 80m and 40m by convention.
      // On the wrong sideband the tone mapping is inverted and nothing decodes.
      // This is only the starting point -- switching sideband by hand afterwards
      // is respected (see handleDemodulationChange), for the stations that do
      // not follow the convention.
      const wantMode = _sstvDefaultSideband();
      if (demodulation !== wantMode) {
        demodulation = wantMode;
        handleDemodulationChange(null, true);
        // Let the new demodulation/window commands reach the server and the
        // first re-tuned PCM arrive before the decoder starts consuming it,
        // so the mode change is not decoded as image data.
        await tick();
        await new Promise((resolve) => setTimeout(resolve, 60));
      }

      audio.setSSTVCallback(null);
      audio.setSSTVMode(sstvModeChoice);
      if (audio && typeof audio.resetSSTVDecoder === "function") {
        audio.resetSSTVDecoder(sstvModeChoice);
      }
      audio.setSSTVCallback(_sstvCallback);
      audio.setSSTVDecoding(true);
      sstvStarting = false;
    });
  }

  function _sstvActivate() {
    _sstvStart();
  }

  // Operator override for a picture the detectors will not lock on their own:
  // the mode comes from the dropdown and the timing origin from the moment of
  // the click, so detection is skipped entirely.  Disabled on 'auto' -- there
  // would be no mode to force.
  function sstvForceNow() {
    if (!sstvRunning || sstvModeChoice === "auto") return;
    sstvLineCount = 0;
    _sstvInitCanvas({ splash: false });
    if (audio && typeof audio.forceSSTVStart === "function") {
      audio.forceSSTVStart(sstvModeChoice);
    }
  }

  function sstvModeChanged() {
    if (sstvEnabled) {
      audio.setSSTVMode(sstvModeChoice);
      if (sstvRunning) sstvRefresh();
    }
  }

  // ── END SSTV state ──────────────────────────────────────────────────────

  // ── END FAX state ─────────────────────────────────────────────────────────

  /**
   * bands-config.js speaks its own dialect: CW segments are spelled 'CW-U' and
   * data segments 'DIGITAL', and neither is a key in demodulationDefaults.
   * Callers that assign _bandDefaultMode()'s result straight to `demodulation`
   * and then call handleDemodulationChange() would throw on
   * demodulationDefault.type -- a real crash on every CW segment, since
   * bands-config uses MODES.CW in 26 places. Normalise here, once, so every
   * caller gets something selectable. Anything unrecognised degrades to 'USB',
   * the same fallback _bandDefaultMode() already uses for an unknown frequency.
   */
  function _bandModeToDemod(m) {
    if (!m) return "USB";
    const up = m === "CW-U" ? "CW" : m;
    return demodulationDefaults[up] ? up : "USB";
  }

  /**
   * Look up the correct default demodulation mode for the current frequency
   * using the same bands-config data that updateBandButton uses.
   * Always returns a mode present in demodulationDefaults; falls back to 'USB'
   * when the frequency matches no band, or the band names a mode we cannot
   * select.
   */
  function _bandDefaultMode() {
    const freqHz = frequency * 1000;
    for (let i = 0; i < bandArray.length; i++) {
      const b = bandArray[i];
      if (
        freqHz >= b.startFreq &&
        freqHz <= b.endFreq &&
        (b.ITU === siteRegion || b.ITU === 123)
      ) {
        if (b.modes && b.modes.length > 0) {
          let segMode = b.modes[0].mode;
          for (let j = 0; j < b.modes.length; j++) {
            if (
              freqHz >= b.modes[j].startFreq &&
              freqHz <= b.modes[j].endFreq
            ) {
              segMode = b.modes[j].mode;
              break;
            }
          }
          return _bandModeToDemod(segMode);
        }
        break;
      }
    }
    return "USB";
  }

  // The FAX / NAVTEX / RTTY timetables live in broadcastSchedules.js.
  let faxScheduleRows = [];
  let faxCountdownTimer = null;

  function _faxTickCountdown() {
    const sched = FAX_SCHEDULE[faxSelectedStation];
    if (!sched || !sched.length) {
      faxScheduleRows = [];
      return;
    }
    const now = new Date();
    const nowSec =
      now.getUTCHours() * 3600 + now.getUTCMinutes() * 60 + now.getUTCSeconds();
    // maxDur 12 min: a 120 LPM / IOC 576 chart runs about 10 minutes, so a slot
    // whose successor is hours away still stops being "on air" at a sane point.
    faxScheduleRows = scheduleRows(parseSlots(sched), nowSec, {
      maxDur: 12 * 60,
      limit: 4,
    });
  }

  function _faxCountdownStart() {
    _faxTickCountdown();
    faxCountdownTimer = setInterval(_faxTickCountdown, 1000);
  }
  function _faxCountdownStop() {
    if (faxCountdownTimer) {
      clearInterval(faxCountdownTimer);
      faxCountdownTimer = null;
    }
    faxScheduleRows = [];
  }

  // ── NAVTEX / SITOR-B decoder state ───────────────────────────────────────

  const NAVTEX_STATIONS = [
    { name: "International — 518 kHz", freqKhz: 518 },
    { name: "Domestic — 490 kHz", freqKhz: 490 },
    { name: "Japan — 424 kHz", freqKhz: 424 },
    { name: "HF — 4209.5 kHz", freqKhz: 4209.5 },
    { name: "HF — 6314 kHz", freqKhz: 6314 },
    { name: "HF — 8416.5 kHz", freqKhz: 8416.5 },
    { name: "HF — 12579 kHz", freqKhz: 12579 },
    { name: "HF — 16806.5 kHz", freqKhz: 16806.5 },
  ];

  let navtexScheduleRows = [];
  let navtexCountdownTimer = null;

  function _navtexTickCountdown() {
    const sel = NAVTEX_STATIONS.find((s) => s.name === navtexSelectedStation);
    const freq = sel ? sel.freqKhz : null;
    const stats = freq ? NAVTEX_DB.filter((s) => s.freq === freq) : [];
    if (!stats.length) {
      navtexScheduleRows = [];
      return;
    }
    const now = new Date();
    const nowSec =
      now.getUTCHours() * 3600 + now.getUTCMinutes() * 60 + now.getUTCSeconds();

    const slots = [];
    for (const st of stats) {
      for (const sec of navtexSlots(st)) {
        slots.push({
          sec,
          id: st.id,
          flag: st.flag,
          name: st.name,
          area: st.area,
        });
      }
    }
    // A NAVTEX station owns its 10-minute slot, so it stays listed as ON AIR for
    // the whole slot rather than jumping to the end of the queue the moment it
    // keys up.
    navtexScheduleRows = scheduleRows(slots, nowSec, { maxDur: 10 * 60 }).map(
      (r) => ({ ...r, label: r.countdown }),
    );
  }

  function _navtexCountdownStart() {
    _navtexTickCountdown();
    navtexCountdownTimer = setInterval(_navtexTickCountdown, 1000);
  }
  function _navtexCountdownStop() {
    if (navtexCountdownTimer) {
      clearInterval(navtexCountdownTimer);
      navtexCountdownTimer = null;
    }
    navtexScheduleRows = [];
  }

  let navtexEnabled = false;
  let navtexSelectedStation = NAVTEX_STATIONS[0].name;
  let navtexMessages = [];
  let navtexCurrentLine = "";
  let navtexScrollEl;
  let navtexStatusText = "";

  // ── RADE v1 state ─────────────────────────────────────────────────────────
  let radeEnabled = false;
  let radeConnected = false;
  let radeSynced = false;
  let radeSnr = null;
  let radeReporterOpen = false;

  function _radeDeactivate() {
    if (!radeEnabled) return;
    radeEnabled = false;
    radeConnected = false;
    radeSynced = false;
    radeSnr = null;
    audio.setRADEDecoding(false);
    audio.setRADECallback(null);
    demodulation = _bandDefaultMode();
    handleDemodulationChange(null, true);
    if (audio && typeof audio.updateFilters === "function")
      audio.updateFilters();
  }

  function _navtexDeactivate() {
    if (!navtexEnabled) return;
    navtexEnabled = false;
    audio.setNAVTEXDecoding(false);
    audio.setNAVTEXCallback(null);
    _navtexCountdownStop();
    demodulation = _bandDefaultMode();
    handleDemodulationChange(null, true);
    if (audio && typeof audio.updateFilters === "function")
      audio.updateFilters();
  }

  function _navtexActivate() {
    navtexMessages = [];
    navtexCurrentLine = "";
    navtexStatusText = "";
    _navtexCountdownStart();
    // Callback first, then enable: the decoder now runs in a worker, so events
    // are delivered asynchronously and must never arrive before the sink exists.
    audio.setNAVTEXCallback((event) => {
      if (event.type === "char") {
        const ch = event.char;
        if (ch === "\r") return;
        if (ch === "\n") {
          if (navtexCurrentLine.trim()) {
            navtexMessages = [...navtexMessages, navtexCurrentLine].slice(-300);
            navtexCurrentLine = "";
          }
          return;
        }
        navtexCurrentLine += ch;
        if (navtexCurrentLine.length >= 72) {
          navtexMessages = [...navtexMessages, navtexCurrentLine].slice(-300);
          navtexCurrentLine = "";
        }
      } else if (event.type === "navstart") {
        if (navtexCurrentLine.trim()) {
          navtexMessages = [...navtexMessages, navtexCurrentLine].slice(-300);
          navtexCurrentLine = "";
        }
        navtexMessages = [
          ...navtexMessages,
          `━━ ZCZC ${event.station}${event.subject}${event.seq} ━━`,
        ].slice(-300);
      } else if (event.type === "navend") {
        if (navtexCurrentLine.trim()) {
          navtexMessages = [...navtexMessages, navtexCurrentLine].slice(-300);
          navtexCurrentLine = "";
        }
        navtexMessages = [...navtexMessages, "━━ NNNN ━━", ""].slice(-300);
      } else if (event.type === "status") {
        navtexStatusText = event.text;
      }
      navtexMessages = navtexMessages;
      navtexCurrentLine = navtexCurrentLine;
    });
    tick().then(async () => {
      // NAVTEX is always received USB.  Switch FIRST, like FAX and SSTV:
      // handleDemodulationChange() retunes the server-side stream, and feeding
      // that transition into a running demodulator is wasted audio.  This also
      // makes activation symmetric -- _navtexDeactivate() has always restored
      // the band default, so leaving the mode alone here meant switching NAVTEX
      // off could change your demodulation when switching it on had not.
      if (demodulation !== "USB") {
        demodulation = "USB";
        handleDemodulationChange(null, true);
        await tick();
        await new Promise((resolve) => setTimeout(resolve, 60));
      }
      audio.setNAVTEXDecoding(true);
    });
  }

  function navtexApplyStation() {
    const st = NAVTEX_STATIONS.find((s) => s.name === navtexSelectedStation);
    if (!st) return;
    const NAVTEX_USB_OFFSET_HZ = 500;
    const hz = Math.round(st.freqKhz * 1000) - NAVTEX_USB_OFFSET_HZ;
    try {
      if (frequencyInputComponent && frequencyInputComponent.setFrequency)
        frequencyInputComponent.setFrequency(hz);
      handleFrequencyChange({ detail: hz });
      frequency = (hz / 1e3).toFixed(3);
    } catch (e) {
      console.warn("[NAVTEX] tune error", e);
    }
    demodulation = "USB";
    handleDemodulationChange(null, true);
    // Narrow IF to 350–650 Hz audio (300 Hz passband centred on 500 Hz)
    const navL = hz + 350; // was 375
    const navM = hz;
    const navR = hz + 650; // was 625
    const audioParameters = [navL, navM, navR].map(frequencyToFFTOffset);
    const audioParametersOffset = [navL - 200, navM - 750, navR - 200].map(
      frequencyToFFTOffset,
    );
    audio.setAudioRange(...audioParameters, ...audioParametersOffset);
    if (typeof updatePassband === "function") updatePassband();
    if (typeof updateLink === "function") updateLink();
  }

  function navtexClear() {
    navtexMessages = [];
    navtexCurrentLine = "";
    navtexStatusText = "";
  }

  // Auto-scroll is handled centrally for every decoder pane — see the
  // "Decoder pane auto-scroll" block further down.

  // ── END NAVTEX state ──────────────────────────────────────────────────────

  // ── FSK / RTTY decoder state ─────────────────────────────────────────────
  const FSK_VARIANT_PRESETS = {
    maritime: {
      center: 500,
      shift: 170,
      baud: 100,
      framing: "7N1",
      encoding: "ccir476",
      invert: false,
    },
    weather: {
      center: 1000,
      shift: 450,
      baud: 50,
      framing: "5N1.5",
      encoding: "ita2",
      invert: true,
    },
    ham: {
      center: 1000,
      shift: 170,
      baud: 45.45,
      framing: "5N1.5",
      encoding: "ita2",
      invert: false,
    },
    // PSK31 is not FSK: no tone pair, no UART framing. The shift/framing fields
    // are only here so the shared config plumbing has something to carry — the
    // controls for them are hidden, and psk31.js ignores them.
    psk31: {
      center: 1000,
      shift: 0,
      baud: 31.25,
      framing: "—",
      encoding: "varicode",
      invert: false,
    },
    // Olivia is MFSK with its own FEC; tones/bandwidth are the real controls.
    olivia: {
      center: 1000,
      shift: 0,
      baud: 31.25,
      framing: "—",
      encoding: "olivia",
      invert: false,
    },
  };

  // The four configurations that cover essentially all on-air Olivia traffic.
  // The first entry is the default the panel opens with.
  const OLIVIA_MODE_OPTIONS = [
    { label: "8 / 250", tones: 8, bw: 250 },
    { label: "16 / 500", tones: 16, bw: 500 },
    { label: "32 / 1000", tones: 32, bw: 1000 },
    { label: "16 / 1000", tones: 16, bw: 1000 },
  ];
  let oliviaMode = "8/250";
  // Squelch = the FEC signal-to-noise a block must reach to be printed.
  // 3.0 is the floor below which pure noise starts leaking through.
  let oliviaSquelch = 4.0;
  $: oliviaCfg =
    OLIVIA_MODE_OPTIONS.find((m) => `${m.tones}/${m.bw}` === oliviaMode) ||
    OLIVIA_MODE_OPTIONS[0];

  // Per-variant option lists for Center / Shift / Baud selects.
  // The first entry in each list matches the variant preset so the
  // select always shows the correct value after _applyFskVariantDefaults().
  const FSK_CENTER_OPTIONS = {
    maritime: [500, 800, 1000, 1200, 1500, 1700, 1800],
    weather: [1000, 500, 1200, 1500, 1700, 1800],
    ham: [1000, 500, 800, 1200, 1500, 1700, 1800, 2125],
    // psk31 uses a free-entry number field instead of a list: the carrier can
    // sit anywhere in the passband, and auto-tune reports back an exact value.
  };
  const FSK_SHIFT_OPTIONS = {
    maritime: [170, 85, 200, 425, 500, 850],
    weather: [450, 170, 85, 200, 500, 850],
    ham: [170, 85, 200, 425, 450, 500, 850],
  };
  const FSK_BAUD_OPTIONS = {
    maritime: [100, 50, 75, 110, 150, 200, 300],
    weather: [50, 45.45, 75, 100, 110, 150],
    ham: [45.45, 50, 75, 100, 110, 150],
  };

  const FSK_KNOWN_FREQUENCIES = {
    // 490/518/4209.5 kHz are the NAVTEX channels; the 4210 kHz series is the
    // ITU Appendix 15 NBDP/SITOR-B set for maritime safety information.
    maritime: [
      { label: "2174.50 kHz — MF NBDP (ITU working)", khz: 2174.5 },
      { label: "518.00 kHz — International NAVTEX", khz: 518.0 },
      { label: "490.00 kHz — National NAVTEX", khz: 490.0 },
      { label: "4209.50 kHz — HF NAVTEX", khz: 4209.5 },
      { label: "4210.00 kHz — HF SITOR (MSI)", khz: 4210.0 },
      { label: "6314.00 kHz — HF SITOR (MSI)", khz: 6314.0 },
      { label: "8416.50 kHz — HF SITOR (MSI)", khz: 8416.5 },
      { label: "12579.00 kHz — HF SITOR (MSI)", khz: 12579.0 },
      { label: "16806.50 kHz — HF SITOR (MSI)", khz: 16806.5 },
      { label: "19680.50 kHz — HF SITOR (MSI)", khz: 19680.5 },
      { label: "22376.00 kHz — HF SITOR (MSI)", khz: 22376.0 },
      { label: "26100.50 kHz — HF SITOR (MSI)", khz: 26100.5 },
    ],
    weather: [
      // DWD Programme 1 (English — North Sea, Baltic, N Atlantic, Mediterranean 5-day)
      { label: "4583.00 kHz — DWD Prog.1 DDK2", khz: 4583.0 },
      { label: "7646.00 kHz — DWD Prog.1 DDH7", khz: 7646.0 },
      { label: "10100.80 kHz — DWD Prog.1 DDK9", khz: 10100.8 },
      // DWD Programme 2 (German — North Sea, Baltic coast, Mediterranean)
      { label: "11039.00 kHz — DWD Prog.2 DDH9", khz: 11039.0 },
      { label: "14467.30 kHz — DWD Prog.2 DDH8", khz: 14467.3 },
      // DDH47 is the only DWD outlet that is not 450 Hz: it runs +/-42.5 Hz.
      { label: "147.30 kHz — DWD Prog.2 DDH47 (LF)", khz: 147.3, shift: 85 },
    ],
    ham: [
      { label: "3590.00 kHz — 80m RTTY", khz: 3590.0 },
      { label: "7043.00 kHz — 40m RTTY", khz: 7043.0 },
      { label: "10143.00 kHz — 30m RTTY", khz: 10143.0 },
      { label: "14083.00 kHz — 20m RTTY", khz: 14083.0 },
      { label: "21083.00 kHz — 15m RTTY", khz: 21083.0 },
      { label: "28083.00 kHz — 10m RTTY", khz: 28083.0 },
    ],
    // Signal frequencies, not dial frequencies — fskApplyKnownFrequency()
    // subtracts the audio centre, which is how USB tuning works out.
    psk31: [
      { label: "14070.15 kHz — 20m PSK31", khz: 14070.15 },
      { label: "3580.15 kHz — 80m PSK31", khz: 3580.15 },
      { label: "7040.15 kHz — 40m PSK31", khz: 7040.15 },
      { label: "10142.15 kHz — 30m PSK31", khz: 10142.15 },
      { label: "18100.15 kHz — 17m PSK31", khz: 18100.15 },
      { label: "21080.15 kHz — 15m PSK31", khz: 21080.15 },
      { label: "24920.15 kHz — 12m PSK31", khz: 24920.15 },
      { label: "28120.15 kHz — 10m PSK31", khz: 28120.15 },
    ],
    // Centre frequencies from the oliviadigitalmode.org calling-frequency table
    // (its "dial" column assumes a 1500 Hz audio centre; ours is 1000 Hz, so we
    // carry the centre and let fskApplyKnownFrequency() do the subtraction).
    olivia: [
      { label: "14072.50 kHz — 20m Olivia 8/250", khz: 14072.5 },
      { label: "14108.50 kHz — 20m Olivia 32/1000", khz: 14108.5 },
      { label: "3583.00 kHz — 80m Olivia 8/250", khz: 3583.0 },
      { label: "7040.00 kHz — 40m Olivia 8/250", khz: 7040.0 },
      { label: "7072.50 kHz — 40m Olivia 8/250 (alt)", khz: 7072.5 },
      { label: "10143.00 kHz — 30m Olivia 8/250", khz: 10143.0 },
      { label: "18099.00 kHz — 17m Olivia 8/250", khz: 18099.0 },
      { label: "21072.50 kHz — 15m Olivia 8/250", khz: 21072.5 },
      { label: "24922.50 kHz — 12m Olivia 8/250", khz: 24922.5 },
      { label: "28122.50 kHz — 10m Olivia 8/250", khz: 28122.5 },
    ],
  };

  let fskEnabled = false;
  let fskVariant = "maritime";
  let fskKnownFrequency = "";
  let fskTextLines = [];
  let fskCurrentLine = "";
  let fskScrollEl;
  let fskStatusText = "";
  let fskShift = 170;
  let fskCenter = 500;
  let fskBaud = 100;
  let fskFraming = "7N1";
  let fskEncoding = "ccir476";
  let fskInvert = false;
  let fskAutoShift = true;
  let fskMetrics = {
    snrDb: 0,
    lockQuality: 0,
    markHz: 585,
    spaceHz: 415,
    timingLocked: false,
  };

  let _fskControlBackup = null;

  function _applyFskVariantDefaults(v) {
    const p = FSK_VARIANT_PRESETS[v] || FSK_VARIANT_PRESETS.maritime;
    fskCenter = p.center;
    fskShift = p.shift;
    fskBaud = p.baud;
    fskFraming = p.framing;
    fskEncoding = p.encoding;
    fskInvert = !!p.invert;
    if (v === "maritime") fskKnownFrequency = "518";
    if (v === "psk31") fskKnownFrequency = "14070.15";
    if (v === "olivia") fskKnownFrequency = "14075.5";
  }

  $: isPsk = fskVariant === "psk31";
  $: isOlivia = fskVariant === "olivia";
  // Neither mode has a tone pair or UART framing, so they share the same
  // "hide the FSK-only controls" branch throughout the panel.
  $: isMfskLike = isPsk || isOlivia;

  function _fskEffectiveConfig() {
    if (fskVariant === "psk31") {
      return { center: Number(fskCenter) || 1000, encoding: "varicode" };
    }
    if (fskVariant === "olivia") {
      return {
        center: Number(fskCenter) || 1000,
        encoding: "olivia",
        tones: oliviaCfg.tones,
        bandwidth: oliviaCfg.bw,
        syncThreshold: Number(oliviaSquelch) || 4.0,
      };
    }
    return {
      center: Number(fskCenter) || 1000,
      shift: Number(fskShift) || 170,
      baud: Number(fskBaud) || 45.45,
      framing: fskFraming,
      encoding: fskEncoding,
      inverted: !!fskInvert,
    };
  }

  function _fskRememberReceiverControl() {
    if (_fskControlBackup) return;
    _fskControlBackup = {
      demodulation,
      audioRange: audio.getAudioRange ? [...audio.getAudioRange()] : null,
    };
  }

  function _fskRestoreReceiverControl() {
    if (!_fskControlBackup) return;
    try {
      const currentHz =
        Number(
          frequencyInputComponent && frequencyInputComponent.getFrequency
            ? frequencyInputComponent.getFrequency()
            : 0,
        ) || Math.round((Number(frequency) || 0) * 1000);
      const restoreMode = _bandDefaultMode();

      // Restore exactly the same way as the other decoders: return to the
      // band-default mode/passband, then re-assert the current dial frequency
      // so the tuned marker/cursor becomes visible again immediately.
      if (restoreMode !== demodulation) {
        demodulation = restoreMode;
        handleDemodulationChange(null, true);
      } else {
        passbandTunerComponent.setMode(demodulation);
        const dm = demodulationDefaults[demodulation];
        if (demodulation === "WBFM") {
          audio.setFmDeemph(50e-6);
        } else {
          audio.setFmDeemph(0);
        }
        if (dm) audio.setAudioDemodulation(dm.type);
        const defaults = dm ? dm.offsets : undefined;
        if (defaults && defaults.length >= 2) {
          const l = currentHz - defaults[0];
          const m = currentHz + (dm.bfo || 0);
          const r = currentHz + defaults[1];
          const lOffset = l - 200;
          const mOffset = m - 750;
          const rOffset = r - 200;
          const audioParameters = [l, m, r].map(frequencyToFFTOffset);
          const audioParametersOffset = [lOffset, mOffset, rOffset].map(
            frequencyToFFTOffset,
          );
          audio.setAudioRange(...audioParameters, ...audioParametersOffset);
          if (typeof updatePassband === "function") updatePassband();
          if (typeof updateLink === "function") updateLink();
        }
      }

      if (frequencyInputComponent && frequencyInputComponent.setFrequency)
        frequencyInputComponent.setFrequency(currentHz);
      handleFrequencyChange({ detail: currentHz, markerclick: true });
      frequency = (currentHz / 1e3).toFixed(3);
      if (audio && typeof audio.updateFilters === "function")
        audio.updateFilters();
    } catch (e) {
      console.warn("[FSK] restore receiver control failed", e);
    }
    _fskControlBackup = null;
  }

  function fskApplyBandpass() {
    const cfg = _fskEffectiveConfig();
    const hz = Math.round((Number(frequency) || 0) * 1000);
    // PSK31 occupies ~62 Hz; a narrow window keeps neighbouring signals on the
    // same watering hole out of the decoder. Olivia needs its full bandwidth
    // plus room for the sync search either side.
    const halfWidth =
      fskVariant === "psk31"
        ? 100
        : fskVariant === "olivia"
          ? (cfg.bandwidth || 1000) / 2 + 150
          : (cfg.shift || 0) / 2 + 120;
    const low = hz + Math.round(cfg.center - halfWidth);
    const mid = hz;
    const high = hz + Math.round(cfg.center + halfWidth);
    const audioParameters = [low, mid, high].map(frequencyToFFTOffset);
    const audioParametersOffset = [low - 200, mid - 750, high - 200].map(
      frequencyToFFTOffset,
    );
    audio.setAudioRange(...audioParameters, ...audioParametersOffset);
    if (typeof updatePassband === "function") updatePassband();
    if (typeof updateLink === "function") updateLink();
  }

  function _fskTakeReceiverControl() {
    _fskRememberReceiverControl();
    demodulation = "USB";
    // Do NOT call handleDemodulationChange — it runs BFO compensation that
    // shifts the center frequency and moves the cursor.  Just switch the
    // audio engine to USB; fskApplyBandpass() sets the correct passband.
    passbandTunerComponent.setMode("USB");
    audio.setFmDeemph(0);
    audio.setAudioDemodulation("USB");
    fskApplyBandpass();
  }

  function _fskPushLine(line) {
    fskTextLines = [...fskTextLines, line].slice(-300);
  }

  // Following the text as it is typed (rather than only when a line completes,
  // which is what the old scroll inside _fskPushLine did) is handled centrally
  // for every decoder pane — see the "Decoder pane auto-scroll" block below.

  // ── FSK / RTTY broadcast schedule countdown ──────────────────────────────
  let fskScheduleRows = [];
  let fskScheduleTitle = "";
  let fskCountdownTimer = null;

  function _fskTickCountdown() {
    const now = new Date();
    const nowSec =
      now.getUTCHours() * 3600 + now.getUTCMinutes() * 60 + now.getUTCSeconds();
    const khz = Number(fskKnownFrequency);

    if (fskVariant === "weather") {
      const prog = RTTY_PROGRAMME_BY_KHZ[String(khz)] || "DWD Programme 1";
      fskScheduleTitle = prog;
      fskScheduleRows = scheduleRows(parseSlots(RTTY_SCHEDULE[prog]), nowSec, {
        maxDur: 8 * 60,
        limit: 4,
      });
    } else if (fskVariant === "maritime" && khz) {
      const stats = NAVTEX_DB.filter((s) => s.freq === khz);
      if (!stats.length) {
        fskScheduleRows = [];
        fskScheduleTitle = "";
        return;
      }
      fskScheduleTitle = `NAVTEX ${khz} kHz`;
      const slots = [];
      for (const st of stats) {
        for (const sec of navtexSlots(st)) {
          slots.push({
            sec,
            label: `${st.id} · ${st.flag} ${st.name} (NAVAREA ${st.area})`,
          });
        }
      }
      fskScheduleRows = scheduleRows(slots, nowSec, {
        maxDur: 10 * 60,
        limit: 5,
      });
    } else {
      fskScheduleRows = [];
      fskScheduleTitle = "";
    }
  }

  function _fskCountdownStart() {
    _fskTickCountdown();
    if (!fskCountdownTimer)
      fskCountdownTimer = setInterval(_fskTickCountdown, 1000);
  }
  function _fskCountdownStop() {
    if (fskCountdownTimer) {
      clearInterval(fskCountdownTimer);
      fskCountdownTimer = null;
    }
    fskScheduleRows = [];
  }

  function _fskActivate() {
    fskEnabled = true;
    fskTextLines = [];
    fskCurrentLine = "";
    fskStatusText = "";
    fskMetrics = {
      snrDb: 0,
      lockQuality: 0,
      markHz: 0,
      spaceHz: 0,
      timingLocked: false,
    };
    _fskTakeReceiverControl();
    _fskCountdownStart();

    const cfg = _fskEffectiveConfig();
    audio.setFSKVariant(fskVariant);
    audio.setFSKConfig(cfg);
    if (audio.setFSKAutoShift) audio.setFSKAutoShift(!!fskAutoShift);
    audio.setFSKCallback((event) => {
      if (!event || !event.type) return;
      if (event.type === "char") {
        const ch = event.char;
        if (!ch || ch === "\r") return;
        if (ch === "\n") {
          if (fskCurrentLine.trim()) {
            _fskPushLine(fskCurrentLine);
            fskCurrentLine = "";
          }
          return;
        }
        fskCurrentLine += ch;
        // 72 columns, matching the NAVTEX pane.
        if (fskCurrentLine.length >= 72) {
          _fskPushLine(fskCurrentLine);
          fskCurrentLine = "";
        }
      } else if (event.type === "status") {
        fskStatusText = event.text || "";
      } else if (event.type === "metrics") {
        fskMetrics = event;
        if (
          event.shiftHz &&
          Math.abs((Number(fskShift) || 0) - event.shiftHz) >= 20
        )
          fskShift = Math.round(event.shiftHz);
        if (
          event.centerHz &&
          Math.abs((Number(fskCenter) || 0) - event.centerHz) >= 10
        )
          fskCenter = Math.round(event.centerHz);
      } else if (
        event.type === "parity-error" ||
        event.type === "framing-error"
      ) {
        fskStatusText =
          event.type === "parity-error" ? "Parity error" : "Framing error";
      }
      fskTextLines = fskTextLines;
      fskCurrentLine = fskCurrentLine;
    });
    audio.setFSKDecoding(true, fskVariant);
  }

  function fskClear() {
    fskTextLines = [];
    fskCurrentLine = "";
  }

  function _saveDecoderTextFile(
    filenameBase,
    lines,
    currentLine = "",
    ext = "txt",
  ) {
    const allLines = [...(Array.isArray(lines) ? lines : [])];
    const tail = String(currentLine || "");
    if (tail.trim()) allLines.push(tail);
    const text = allLines.join("\n");
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    a.href = URL.createObjectURL(blob);
    a.download = `${filenameBase}-${stamp}.${ext}`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 0);
  }

  function saveNavtexText() {
    _saveDecoderTextFile("navtex-session", navtexMessages, navtexCurrentLine);
  }

  function saveFskText() {
    const mode =
      fskVariant === "weather"
        ? "weather-rtty"
        : fskVariant === "ham"
          ? "amateur-rtty"
          : fskVariant === "psk31"
            ? "psk31"
            : fskVariant === "olivia"
              ? "olivia"
              : "maritime-fsk";
    _saveDecoderTextFile(mode, fskTextLines, fskCurrentLine);
  }

  function fskApplySettings(takeControl = true) {
    const cfg = _fskEffectiveConfig();
    audio.setFSKVariant(fskVariant);
    audio.setFSKConfig(cfg);
    if (audio.setFSKAutoShift) audio.setFSKAutoShift(!!fskAutoShift);
    if (takeControl) _fskTakeReceiverControl();
  }

  // Squelch-only update. Deliberately does NOT go through fskApplySettings():
  // that re-sends the variant, which resets the engine, and Olivia would lose a
  // sync that took several seconds to find every time the slider moved.
  function fskApplySquelch() {
    audio.setFSKConfig(_fskEffectiveConfig());
  }

  function fskVariantChanged() {
    if (fskEnabled) _fskTickCountdown();
    _applyFskVariantDefaults(fskVariant);
    fskApplySettings(true);
  }

  function fskApplyKnownFrequency() {
    const khz = Number(fskKnownFrequency);
    if (!Number.isFinite(khz) || khz <= 0) return;
    // A few outlets do not use their variant's default shift (DWD's 147.3 kHz
    // LF outlet is 85 Hz, not 450) — apply the override before tuning so the
    // decoder is already on the right tone pair when the dial moves.
    const known = (FSK_KNOWN_FREQUENCIES[fskVariant] || []).find(
      (e) => e.khz === khz,
    );
    if (known && known.shift && Number(fskShift) !== known.shift) {
      fskShift = known.shift;
      if (fskEnabled) audio.setFSKConfig(_fskEffectiveConfig());
    }
    const cfg = _fskEffectiveConfig();
    const hz = Math.round(khz * 1000 - cfg.center);
    try {
      if (frequencyInputComponent && frequencyInputComponent.setFrequency)
        frequencyInputComponent.setFrequency(hz);
      handleFrequencyChange({ detail: hz });
      frequency = (hz / 1e3).toFixed(3);
      _fskTakeReceiverControl();
    } catch (e) {
      console.warn("[FSK] tune error", e);
    }
  }

  _applyFskVariantDefaults(fskVariant);
  // ── END FSK state ─────────────────────────────────────────────────────────

  // CW text output
  let cwMessages = [];
  let cwCurrentLine = "";
  let cwDetectedHz = 0;
  let cwDetectedWpm = 0;
  let cwScrollEl;

  // ── Digital mode decoder state ───────────────────────────────────────────

  // Shared text output for digital decoders
  let digiMessages = [];
  let digiCurrentLine = "";
  let digiMode = "";
  let digiScrollEl;

  // ── Decoder pane auto-scroll ──────────────────────────────────────────────
  // Follow the text as it is decoded, but only while the operator is already at
  // the bottom. Scrolling up to read back must not be yanked away by the next
  // character to arrive.
  //
  // The "am I at the bottom?" test has to run BEFORE the DOM update: once the
  // new text is in, the pane has already grown by that much, so a check made
  // afterwards always reports "not at the bottom" and the pane would never
  // follow anything.
  const DECODER_SCROLL_EPS = 16; // px of slack: fractional metrics, a nudge of the wheel

  function _paneAtBottom(el) {
    if (!el) return true; // not mounted yet — start pinned
    return el.scrollHeight - el.scrollTop - el.clientHeight <= DECODER_SCROLL_EPS;
  }

  let _decoderPanesAtBottom = {};

  beforeUpdate(() => {
    _decoderPanesAtBottom = {
      navtex: _paneAtBottom(navtexScrollEl),
      fsk: _paneAtBottom(fskScrollEl),
      cw: _paneAtBottom(cwScrollEl),
    };
  });

  afterUpdate(() => {
    const stick = (el, was) => {
      if (el && was) el.scrollTop = el.scrollHeight;
    };
    stick(navtexScrollEl, _decoderPanesAtBottom.navtex);
    stick(fskScrollEl, _decoderPanesAtBottom.fsk);
    stick(cwScrollEl, _decoderPanesAtBottom.cw);
  });

  // Handling dragging the waterfall left or right
  let waterfallDragging = false;
  let waterfallDragTotal = 0;
  let waterfallBeginX = 0;
  let cursorFrequency = null;
  let cursorX = 0;
  let cursorY = 0;
  let showCursorFreq = false;

  function handleWaterfallMouseDown(e) {
    waterfallDragTotal = 0;
    waterfallDragging = true;
    waterfallBeginX = e.clientX;
  }

  function handleWindowMouseMove(e) {
    if (waterfallDragging) {
      waterfallDragTotal += Math.abs(e.movementX) + Math.abs(e.movementY);
      waterfall.mouseMove(e);
      updatePassband();
      frequencyMarkerComponent.updateFrequencyMarkerPositions();
    }
  }

  // Format frequency as MHz.kHz.Hz
  function formatFrequency(freqHz) {
    const totalHz = Math.round(freqHz);
    const mhz = Math.floor(totalHz / 1000000);
    const khz = Math.floor((totalHz % 1000000) / 1000);
    const hz = totalHz % 1000;

    // Pad kHz and Hz with leading zeros
    const khzStr = String(khz).padStart(3, "0");
    const hzStr = String(hz).padStart(3, "0");

    return `${mhz}.${khzStr}.${hzStr}`;
  }

  function handleSpectrumMouseMove(e) {
    if (!spectrumCanvas) return;
    const rect = spectrumCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const canvasWidth = rect.width;

    // Get the current waterfall range (in FFT offsets)
    const [waterfallL, waterfallR] = waterfall.getWaterfallRange();
    const waterfallSpan = waterfallR - waterfallL;

    // Calculate the FFT offset based on mouse position
    const offset = waterfallL + (x / canvasWidth) * waterfallSpan;

    // Convert FFT offset to frequency in Hz
    const freq = FFTOffsetToFrequency(offset);

    cursorFrequency = freq;
    cursorX = e.clientX;
    cursorY = e.clientY;
    showCursorFreq = true;
  }

  function handleSpectrumMouseLeave() {
    showCursorFreq = false;
  }

  function handleWaterfallMouseMove(e) {
    if (!waterfallCanvas) return;
    const rect = waterfallCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const canvasWidth = rect.width;

    // Get the current waterfall range (in FFT offsets)
    const [waterfallL, waterfallR] = waterfall.getWaterfallRange();
    const waterfallSpan = waterfallR - waterfallL;

    // Calculate the FFT offset based on mouse position
    const offset = waterfallL + (x / canvasWidth) * waterfallSpan;

    // Convert FFT offset to frequency in Hz
    const freq = FFTOffsetToFrequency(offset);

    cursorFrequency = freq;
    cursorX = e.clientX;
    cursorY = e.clientY;
    showCursorFreq = true;
  }

  function handleWaterfallMouseLeave() {
    showCursorFreq = false;
  }

  function handleWindowMouseUp(e) {
    if (waterfallDragging) {
      // If mouseup without moving, handle as click
      if (waterfallDragTotal < 2) {
        passbandTunerComponent.handlePassbandClick(e);
      }
      waterfallDragging = false;
    }
  }

  // bysv2amkMobile

  // Sidebar controls for waterfall and spectrum analyzer
  let waterfallDisplay = true;
  let spectrumDisplay = true;
  let biggerWaterfall = false;

  function handleSpectrumChange() {
    spectrumDisplay = !spectrumDisplay;
    waterfall.setSpectrum(spectrumDisplay, Device.isMobile);
    // Spectrum on -> reverse waterfall on; off -> back to normal
    waterfallReverse = spectrumDisplay;
  }

  function handleWaterfallSizeChange() {
    biggerWaterfall = !biggerWaterfall;
    waterfall.setWaterfallBig(biggerWaterfall, Device.isMobile);
  }

  // bysv2amkMobile end

  // Declaration for the VFO A/B system //
  let vfo = "VFO A";
  let vfoModeA = true;
  let vfoAFrequency = siteSDRBaseFrequency;
  let vfoBFrequency = siteSDRBaseFrequency;
  let initialVFOB = true;
  let vfoAMode = "LSB";
  let vfoBMode = "LSB";
  let vfoAStep = 50;
  let vfoBStep = 50;
  let vfoAwaterfallL = 0;
  let vfoAwaterfallR = 0;
  let vfoBwaterfallL = 0;
  let vfoBwaterfallR = 0;

  // declaration for function handlePassbandChange(passband) //
  let bandwidth;

  // Waterfall drawing
  let currentColormap = "PhantomSDR"; //select any of "turbo, gqrx, twente, twentev2, SpectraVU, custom, PhantomSDR"
  let alpha = 0.5;
  let brightness = 130;
  let min_waterfall = -30;
  let max_waterfall = 110;
  function initializeColormap() {
    // Check if a colormap is saved in local storage
    const savedColormap = localStorage.getItem("selectedColormap");
    if (savedColormap) {
      currentColormap = savedColormap;
    }
    waterfall.setColormap(currentColormap);
  }

  function handleWaterfallColormapSelect(event) {
    currentColormap = event.target.value;
    waterfall.setColormap(currentColormap);

    // Save the selected colormap to local storage
    localStorage.setItem("selectedColormap", currentColormap);
  }

  // Waterfall slider controls
  function handleAlphaMove() {
    waterfall.setAlpha(1 - alpha);
  }
  function handleBrightnessMove() {
    waterfall.setOffset(brightness);
  }
  function handleMinMove() {
    waterfall.setMinOffset(min_waterfall);
  }
  function handleMaxMove() {
    waterfall.setMaxOffset(max_waterfall);
  }

  function handleAutoAdjust() {
    // Toggle state
    autoAdjustEnabled = !autoAdjustEnabled;
    waterfall.autoAdjust = autoAdjustEnabled;

    if (autoAdjustEnabled) {
      // Store current manual settings only once
      if (!storeWaterfallSettings) {
        previous_min_waterfall = min_waterfall;
        previous_max_waterfall = max_waterfall;
        previous_brightness = brightness;
        storeWaterfallSettings = true;
      }

      // Configure the waterfall backend with adaptive auto-adjust parameters
      if (typeof waterfall.setAutoAdjustConfig === "function") {
        waterfall.setAutoAdjustConfig(autoAdjustConfig);
      }

      // Enable adaptive auto-adjust
      if (typeof waterfall.enableAutoAdjust === "function") {
        waterfall.enableAutoAdjust(autoAdjustConfig);
      }

      // Start monitoring adaptive status
      startStatusMonitoring();

      console.log("🎯 ADAPTIVE AUTO-ADJUST ENABLED");
      console.log("   Watch console for real-time adaptation messages");
    } else {
      // Stop monitoring
      stopStatusMonitoring();

      // Restore brightness to whatever it was set to before auto-adjust.
      if (storeWaterfallSettings) {
        brightness =
          previous_brightness !== null && previous_brightness !== undefined
            ? previous_brightness
            : brightness;
        storeWaterfallSettings = false;
      }

      // Min/max return to the current band's default range rather than
      // whatever manual value happened to be set before auto-adjust was
      // turned on — auto-adjust may have been running for a while, so the
      // "previous" manual value is stale and not a meaningful target.
      if (bandArray && bandArray[currentBand]) {
        min_waterfall = parseInt(bandArray[currentBand].min);
        max_waterfall = parseInt(bandArray[currentBand].max);
      } else {
        min_waterfall =
          previous_min_waterfall !== null &&
          previous_min_waterfall !== undefined
            ? previous_min_waterfall
            : min_waterfall;
        max_waterfall =
          previous_max_waterfall !== null &&
          previous_max_waterfall !== undefined
            ? previous_max_waterfall
            : max_waterfall;
      }

      // Apply restored settings to the waterfall
      handleMinMove();
      handleMaxMove();
      handleBrightnessMove();
    }

    // Optional: reflect state in a UI toggle if present
    const btn = document.getElementById("autoAdjustBtn");
    if (btn) btn.classList.toggle("active", autoAdjustEnabled);
  }

  // Helper function to change auto-adjust preset on the fly
  function setAutoAdjustPreset(presetName) {
    if (autoAdjustPresets[presetName]) {
      currentAutoAdjustPreset = presetName;
      autoAdjustConfig = { ...autoAdjustPresets[presetName] };

      // If auto-adjust is currently enabled, reapply with new config
      if (
        autoAdjustEnabled &&
        typeof waterfall.setAutoAdjustConfig === "function"
      ) {
        waterfall.setAutoAdjustConfig(autoAdjustConfig);
      }

      console.log(
        `Auto-adjust preset changed to: ${presetName}`,
        autoAdjustConfig,
      );
    }
  }

  // Helper function to update individual auto-adjust parameters
  function updateAutoAdjustParameter(paramName, value) {
    if (autoAdjustConfig.hasOwnProperty(paramName)) {
      autoAdjustConfig[paramName] = value;

      // If auto-adjust is currently enabled, reapply
      if (
        autoAdjustEnabled &&
        typeof waterfall.setAutoAdjustConfig === "function"
      ) {
        waterfall.setAutoAdjustConfig(autoAdjustConfig);
      }

      console.log(`Auto-adjust ${paramName} updated to: ${value}`);
    }
  }

  // Toggle adaptive mode on/off
  function toggleAdaptiveMode() {
    autoAdjustConfig.adaptiveEnabled = !autoAdjustConfig.adaptiveEnabled;

    if (
      autoAdjustEnabled &&
      typeof waterfall.setAutoAdjustConfig === "function"
    ) {
      waterfall.setAutoAdjustConfig(autoAdjustConfig);
    }

    console.log(
      `Adaptive mode: ${autoAdjustConfig.adaptiveEnabled ? "ENABLED" : "DISABLED"}`,
    );
  }

  // Get current adaptive status
  function getAdaptiveStatus() {
    if (typeof waterfall.getAutoAdjustStatus === "function") {
      const status = waterfall.getAutoAdjustStatus();
      if (status) {
        adaptiveStatus = status;
        return status;
      }
    }
    return { condition: "UNKNOWN", avgSNR: "0.0" };
  }

  // Update status periodically
  let statusInterval;
  function startStatusMonitoring() {
    if (statusInterval) clearInterval(statusInterval);
    statusInterval = setInterval(() => {
      if (autoAdjustEnabled) {
        getAdaptiveStatus();
        // Move the sliders to show what auto-adjust is measuring, WITHOUT
        // changing the actual color-mapping range: this only updates the
        // bound variable (a plain assignment, not a real DOM 'input' event)
        // so handleMinMove/handleMaxMove never fire and waterfall.minWaterfall/
        // maxWaterfall — what transformValue() actually uses — stay exactly
        // as the user/band left them. autoAdjustDisplayMin/Max are read-only
        // telemetry computed separately in waterfall.js.
        if (Number.isFinite(waterfall.autoAdjustDisplayMin))
          min_waterfall = Math.round(waterfall.autoAdjustDisplayMin);
        if (Number.isFinite(waterfall.autoAdjustDisplayMax))
          max_waterfall = Math.round(waterfall.autoAdjustDisplayMax);
      }
    }, 500); // Update every 0.5s — quick enough that the sliders visibly glide
  }

  function stopStatusMonitoring() {
    if (statusInterval) {
      clearInterval(statusInterval);
      statusInterval = null;
    }
  }

  function checkColor(color) {
    console.log("C = " + color);
  }

  // This function checks the region inside waterfall.js and compares //
  // it to the siteRegion and then approves the proper button to be //
  // printed to the screen. //
  function verifyRegion(region) {
    switch (region) {
      case 123:
        return true;
        break;
      case 1:
        if (region === 1 && siteRegion === 1) {
          return true;
        }
        break;
      case 2:
        if (region === 2 && siteRegion === 2) {
          return true;
        }
        break;
      case 3:
        if (region === 3 && siteRegion === 3) {
          return true;
        }
        break;
    }
    return false;
  }

  // This function checks the siteSDRBasebandFrequency siteSDRBandwidth and //
  // compares it to the startFreq & endFreq from waterfall.js and if all that //
  // passes, then a Band Button is printed to the SDR interface. //
  function printBandButton(startFreq, endFreq, publish) {
    let sdrStartFreq = siteSDRBaseFrequency;
    let sdrBandwidth = siteSDRBandwidth;
    if (publish) {
      return endFreq >= sdrStartFreq && endFreq <= sdrStartFreq + sdrBandwidth;
    } else {
      return false;
    }
  }

  // Audio demodulation selection
  let demodulators = ["USB", "LSB", "CW", "CW-L", "AM", "QUAM", "FM"];
  const demodulationDefaults = {
    USB: { type: "USB", offsets: [0, 2700] },
    LSB: { type: "LSB", offsets: [2700, 0] },
    CW: { type: "CW", offsets: [250, 250] }, // DSB centered on carrier, ±250 Hz
    "CW-L": { type: "CWL", offsets: [250, 250] }, // CW lower sideband tone, ±250 Hz
    AM: { type: "AM", offsets: [4500, 4500] }, // 9 kHz for AM
    QUAM: { type: "QUAM", offsets: [5000, 5000] }, // C-QUAM AM-stereo
    FM: { type: "FM", offsets: [5000, 5000] },
    WBFM: { type: "FM", offsets: [80000, 80000] },
    RADEL: { type: "LSB", offsets: [2200, -700] }, // RADE v1 Lower sideband — 700 Hz to 2200 Hz from carrier
    RADEU: { type: "USB", offsets: [-700, 2200] }, // RADE v1 Upper sideband — 700 Hz to 2200 Hz from carrier
  };

  let demodulation = "USB";
  let cquamPilotDetected = false; // C-QUAM 25 Hz stereo pilot present -> QUAM button turns green
  let samLocked = false; // mono SAM (AM) PLL locked -> AM button shows "SAM" in red
  let samEnabled = false; // AM detector: false = envelope (default), true = SAM (synchronous)
  function roundAudioOffsets(offsets) {
    const [l, m, r] = offsets;
    return [Math.floor(l), m, Math.floor(r)];
  }

  // CATsync: a mode name from the CATsync Tool (Kiwi, WebSDR or rig
  // spelling) as one of this receiver's modes, or null if it has none.
  function catsyncModeFromTool(name) {
    const m = String(name || "").toUpperCase().trim();
    const alias = {
      NBFM: "FM", NNFM: "FM", NFM: "FM", FMN: "FM",
      WFM: "WBFM",
      "CW-U": "CW", CWU: "CW", CWN: "CW",
      CWL: "CW-L", CWR: "CW-L", "CW-R": "CW-L",
      USN: "USB", USBN: "USB", DIGU: "USB", PKTUSB: "USB",
      LSN: "LSB", LSBN: "LSB", DIGL: "LSB", PKTLSB: "LSB",
      AMN: "AM", AMW: "AM", SAM: "AM", SAL: "AM", SAU: "AM", SAS: "AM", AMSYNC: "AM", DSB: "AM",
      QAM: "QUAM",
    };
    const mode = alias[m] || m;
    return demodulationDefaults[mode] ? mode : null;
  }

  // CATsync: this receiver's mode in the Kiwi spelling the tool expects.
  // Kiwi has no CW-L or wideband FM, so those report as their nearest mode.
  function catsyncModeForTool(mode) {
    switch (mode) {
      case "USB": case "RADEU": return "usb";
      case "LSB": case "RADEL": return "lsb";
      case "CW": case "CW-L": return "cw";
      case "AM": return samEnabled ? "sam" : "am";
      case "QUAM": return "qam";
      case "FM": case "WBFM": return "nbfm";
      default: return "usb";
    }
  }

  // CATsync: show the receiver's frequency in the Kiwi frequency box of
  // index.html, the way a KiwiSDR does - the CATsync Tool reads it from there.
  function catsyncPublish() {
    try {
      const form = document.forms["form_freq"];
      const input = form && form.elements[0];
      if (!input || !frequencyInputComponent || !frequencyInputComponent.getFrequency) return;
      const hz = frequencyInputComponent.getFrequency();
      if (Number.isFinite(hz) && hz > 0) input.value = (hz / 1000).toFixed(2);
    } catch (e) {}
  }

  // CATsync: notify external tools (e.g. CATsync) when frequency/mode changes
  function catsyncNotify(changed) {
    // The box first: a tool reacting to the notification reads it at once.
    catsyncPublish();
    // The listener has moved the receiver, and the tool is about to move the
    // rig to match.  From now on that is the rig's position: a command equal
    // to it is the tool repeating itself, while anything else - including
    // the frequency the rig was on before - means the rig was really turned.
    if (changed && changed.freq && frequencyInputComponent && frequencyInputComponent.getFrequency) {
      catsyncStaleHz = catsyncLastToolHz;
      catsyncStaleUntil = Date.now() + CATSYNC_STALE_MS;
      catsyncLastToolHz = frequencyInputComponent.getFrequency();
    }
    if (changed && changed.mode) {
      catsyncStaleMode = catsyncLastToolMode;
      catsyncStaleUntil = Date.now() + CATSYNC_STALE_MS;
      catsyncLastToolMode = demodulation;
    }
    if (
      typeof window !== "undefined" &&
      typeof window.injection_environment_changed === "function"
    ) {
      try {
        window.injection_environment_changed(changed);
      } catch (e) {
        // swallow — injection must not crash the UI
      }
    }
  }

  function SetMode(mode, userClick = false) {
    if (mode == "CW-U") {
      mode = "CW";
    }
    // Picking a mode by hand takes the receiver back from the QRSS grabber.
    if (userClick) qrssHoldsReceiver = false;
    if (mode === "AM") {
      // Only a deliberate re-click of the AM button toggles SAM; automatic
      // mode changes (band/frequency) always default to plain envelope AM.
      samEnabled = userClick && demodulation === "AM" ? !samEnabled : false;
    }
    console.log("Setting mode to", mode);
    demodulation = mode;

    handleDemodulationChange(null, true);
    updateLink();
  }

  function setModePopup(mode) {
    if (mode == "CW-U") {
      mode = "CW";
    }
    qrssHoldsReceiver = false; // a deliberate mode choice, as in SetMode()
    if (mode === "AM") {
      // Re-selecting AM in the popup toggles SAM, else plain envelope AM.
      samEnabled = demodulation === "AM" ? !samEnabled : false;
    }
    console.log("Setting mode to", mode);
    demodulation = mode;

    handleDemodulationChange(null, true);
    updateLink();
    setTimeout(function () {
      toggleModePopup();
    }, 300);
  }

  // Demodulation controls
  function handleDemodulationChange(e, changed) {
    passbandTunerComponent.setMode(demodulation);
    // CATsync: every mode change - a button, the band plan, a decoder, a
    // bookmark - passes through here, so this is where the tool hears of it.
    window.__catsync_state = window.__catsync_state || { hz: null, mode: null };
    if (changed && window.__catsync_state.mode !== demodulation) {
      window.__catsync_state.mode = demodulation;
      if (!catsyncRemote) catsyncNotify({ mode: 1 });
    }
    if (changed) catSendModeToRig();
    const demodulationDefault = demodulationDefaults[demodulation];
    if (changed) {
      if (demodulation === "WBFM") {
        audio.setFmDeemph(50e-6);
      } else {
        audio.setFmDeemph(0);
      }
      audio.setAudioDemodulation(
        demodulation === "AM" && !samEnabled
          ? "AM-ENV"
          : demodulationDefault.type,
      );
    }
    let prevBFO = frequencyInputComponent.getBFO();
    let newBFO = demodulationDefault.bfo || 0;
    let [l, m, r] = audio.getAudioRange().map(FFTOffsetToFrequency);
    m = m + newBFO - prevBFO;
    l = m - demodulationDefault.offsets[0];
    r = m + demodulationDefault.offsets[1];

    frequencyInputComponent.setBFO(newBFO);
    frequencyInputComponent.setFrequency();

    frequency = (frequencyInputComponent.getFrequency() / 1e3).toFixed(3);

    // CW
    const lOffset = l - 200;
    const mOffset = m - 750;
    const rOffset = r - 200;
    const audioParametersOffset = [lOffset, mOffset, rOffset].map(
      frequencyToFFTOffset,
    );
    const audioParameters = [l, m, r].map(frequencyToFFTOffset);

    // Set audio range with both normal and offset values
    audio.setAudioRange(...audioParameters, ...audioParametersOffset);

    updatePassband();
    updateLink();

    // A sideband change under a running SSTV decode inverts the tone mapping,
    // so whatever was being drawn is void.  Start a clean frame instead of
    // making the operator sit through a corrupted one.  (Skipped while
    // _sstvStart is doing its own switch -- it resets immediately after.)
    if (
      changed &&
      sstvRunning &&
      !sstvStarting &&
      audio &&
      typeof audio.resetSSTVDecoder === "function"
    ) {
      audio.resetSSTVDecoder(sstvModeChoice);
      sstvLineCount = 0;
      sstvDetectedMode = "";
      sstvStatusText = "Waiting for VIS / AUTO lock";
      _sstvInitCanvas({ splash: false });
    }
  }

  // ── Decoder helpers ───────────────────────────────────────────────────────

  /**
   * True while a decoder dictates the receiver's mode and passband.
   *
   * Deliberately a function, not a `$:` reactive: the flags below are flipped
   * inside _deactivateAll(), and a reactive value would still read `true` for
   * the rest of that synchronous block — long enough for the restore path to
   * be undone by _decoderReassertReceiver() below.
   *
   * The CW decoder is not in the list: it works in whatever mode the operator
   * is listening in and never took the receiver over. The QRSS grabber is,
   * but only once a window has been tuned from its list — merely showing the
   * panel leaves the receiver alone.
   */
  function _decoderOwnsReceiver() {
    return (
      qrssHoldsReceiver ||
      ft8Enabled ||
      ft4Enabled ||
      ft2Enabled ||
      js8Enabled ||
      wsprEnabled ||
      faxEnabled ||
      sstvEnabled ||
      navtexEnabled ||
      fskEnabled ||
      radeEnabled
    );
  }

  /**
   * Put the receiver back the way the running decoder wants it, after a tune
   * has moved it.
   *
   * Every retune runs waterfall.checkBandAndSetMode(), which publishes the mode
   * bands-config.js declares for that segment and ends in
   * handleDemodulationChange() — resetting BOTH the mode and the passband to
   * the band/mode defaults. That is right for listening and wrong while a
   * decoder runs: FT8 on 40 m would flip to LSB the moment the dial moved, and
   * the FSK window's narrow passband would widen back to the full USB filter.
   * The bands-config mode is therefore suppressed while a decoder owns the
   * receiver (see the "setMode" subscription), and this re-asserts the
   * decoder's own settings afterwards.
   *
   * The band default returns when the decoder is switched off — every
   * _*Deactivate() and _deactivateAll() already restores _bandDefaultMode().
   */
  function _decoderReassertReceiver() {
    if (!_decoderOwnsReceiver()) return;
    // The FSK/RTTY window is the only decoder with a passband of its own
    // (PSK31 ±100 Hz, Olivia its bandwidth, RTTY its shift). Re-asserting is
    // exactly what activation did, and _fskRememberReceiverControl() inside it
    // is a no-op while the backup is already held.
    if (fskEnabled) {
      _fskTakeReceiverControl();
      return;
    }
    // Likewise the QRSS grabber: CW, and its window follows the dial, so the
    // trace stays on the centre line while hunting along a band.
    if (qrssHoldsReceiver) {
      _qrssTakeReceiverControl();
      return;
    }
    // RADE carries its own demodulation (RADEL/RADEU), set by its own path.
    if (radeEnabled) return;
    // The rest are USB decoders; handleFrequencyChange() carries the USB
    // passband across a tune unchanged, so only the mode can need restoring.
    if (demodulation !== "USB") {
      demodulation = "USB";
      handleDemodulationChange(null, true);
    }
  }

  /** Stop every decoder and reset all flags */
  function _deactivateAll() {
    // Capture whether a USB digital decoder (FT8/FT4/FT2/WSPR) was running,
    // so we can restore the band's default mode (bands-config.js) below.
    const _ftxWasActive =
      ft8Enabled || ft4Enabled || ft2Enabled || wsprEnabled || js8Enabled;
    // FT8 / FT4
    if (ft8Enabled) {
      ft8Enabled = false;
      audio.setFT8Decoding(false);
    }
    if (ft4Enabled) {
      ft4Enabled = false;
      audio.setFT4Decoding(false);
    }
    if (ft2Enabled) {
      ft2Enabled = false;
      audio.setFT2Decoding(false);
    }
    // JS8
    if (js8Enabled) {
      js8Enabled = false;
      audio.setJS8Decoding(false);
      audio.onJS8Message = null;
      js8Messages = [];
      js8Pending = [];
      _js8TickStop();
    }
    // CW
    if (cwEnabled) {
      cwEnabled = false;
      audio.setCWDecoding(false);
      audio.setCWCallback(null);
      cwDetectedHz = 0;
      cwDetectedWpm = 0;
    }
    // WSPR
    if (wsprEnabled) {
      wsprEnabled = false;
      audio.setWSPRDecoding(false);
      wsprMessages = [];
      _wsprTickStop();
    }
    // FAX
    if (faxEnabled) {
      _faxDeactivate();
    }
    // SSTV
    if (sstvEnabled) {
      _sstvDeactivate();
    }
    // NAVTEX
    if (navtexEnabled) {
      _navtexDeactivate();
    }
    // FSK / RTTY
    if (fskEnabled) {
      fskEnabled = false;
      audio.setFSKDecoding(false);
      audio.setFSKCallback(null);
      _fskCountdownStop();
      _fskRestoreReceiverControl();
    }
    // RADE v1
    if (radeEnabled) {
      _radeDeactivate();
    }
    // A USB digital decoder stopped — return to the band's default mode
    // (LSB/CW/AM… per bands-config.js). Mirrors FAX/SSTV/NAVTEX behaviour.
    // If the caller is about to start another USB decoder it re-asserts USB.
    if (_ftxWasActive) {
      demodulation = _bandDefaultMode();
      handleDemodulationChange(null, true);
      if (audio && typeof audio.updateFilters === "function")
        audio.updateFilters();
    }
    // Digital
  }

  /** Build a callback that feeds the shared digi text window */
  function _makeDigiCallback(modeName) {
    digiMessages = [];
    digiCurrentLine = "";
    digiMode = modeName;
    return (event) => {
      if (event.type === "char") {
        const ch = event.char;
        if (ch === "\r") return;
        if (ch === "\n") {
          if (digiCurrentLine.trim()) {
            digiMessages = [...digiMessages, digiCurrentLine].slice(-200);
            digiCurrentLine = "";
          }
          return;
        }
        digiCurrentLine += ch;
        if (digiCurrentLine.length >= 80) {
          digiMessages = [...digiMessages, digiCurrentLine].slice(-200);
          digiCurrentLine = "";
        }
      } else if (event.type === "navstart") {
        digiMessages = [
          ...digiMessages,
          `── ZCZC ${event.station}${event.subject}${event.seq} ──`,
        ].slice(-200);
        digiCurrentLine = "";
      } else if (event.type === "navend") {
        if (digiCurrentLine.trim()) {
          digiMessages = [...digiMessages, digiCurrentLine].slice(-200);
          digiCurrentLine = "";
        }
        digiMessages = [...digiMessages, "── NNNN ──"].slice(-200);
      } else if (event.type === "frame") {
        const via =
          event.via && event.via.length ? ` via ${event.via.join(",")}` : "";
        digiMessages = [
          ...digiMessages,
          `${event.from}→${event.to}${via}: ${event.payload}`,
        ].slice(-200);
        digiCurrentLine = "";
      } else if (event.type === "dsc") {
        digiMessages = [
          ...digiMessages,
          `[${event.format}] MMSI:${event.mmsi} ${event.category} ${event.msgType}`,
        ].slice(-200);
        digiCurrentLine = "";
      }
      digiMessages = digiMessages;
      digiCurrentLine = digiCurrentLine;
    };
  }

  /** Activate the decoder named by selectedDecoder */
  function activateSelectedDecoder() {
    _deactivateAll();
    // A decoder sets its own mode and passband, so it outranks the grabber's
    // hold; the grabber keeps running and just follows whatever it is given.
    qrssHoldsReceiver = false;
    const d = selectedDecoder;

    // Decoder ID has done its job the moment a decoder is running — it was only
    // ever there to choose one — and it measures the same audio the decoder now
    // wants. Switch it off rather than leave it analysing in the background.
    if (d && d !== "none") _modeIdOff();

    // FT2/FT4/FT8/WSPR are USB sub-bands — switch the receiver to USB while
    // decoding, regardless of the band's default mode (e.g. LSB/CW on 40/80m).
    // The band default is restored in _deactivateAll() when the decoder stops.
    if (d === "ft8" || d === "ft4" || d === "ft2" || d === "wspr" || d === "js8") {
      if (demodulation !== "USB") {
        demodulation = "USB";
        handleDemodulationChange(null, true);
      }
      // ...and give them the passband they are worked with, the same one the
      // Signal-ID chip applies: the whole 3 kHz sub-band for FT2/FT4/FT8/JS8,
      // the WSPR slot for WSPR.  handleDemodulationChange() has just reset the
      // filter to the plain USB default, so this has to come after it.
      _modeIdApplyReceiverDefaults(d);
    }

    if (d === "ft8") {
      ft8Enabled = true;
      audio.setFT8Decoding(true);
      const list = document.getElementById("ft8MessagesList");
      if (list) list.innerHTML = "";
    } else if (d === "ft4") {
      ft4Enabled = true;
      audio.setFT4Decoding(true);
      const list = document.getElementById("ft8MessagesList");
      if (list) list.innerHTML = "";
    } else if (d === "ft2") {
      ft2Enabled = true;
      audio.setFT2Decoding(true);
      const list = document.getElementById("ft8MessagesList");
      if (list) list.innerHTML = "";
    } else if (d === "js8") {
      js8Enabled = true;
      js8Messages = [];
      js8Pending = [];
      // Sink first, then enable: a slot could finish before the next statement.
      audio.onJS8Message = (m) => {
        js8Messages = [...js8Messages, m].slice(-200);
        if (typeof audio.js8Pending === "function") js8Pending = audio.js8Pending();
      };
      audio.setJS8Submode(js8Submode);
      audio.setJS8Decoding(true);
      bindFtxSync(); // adopt this submode's stored capture lead-in
      _js8TickStart();
    } else if (d === "cw") {
      cwEnabled = true;
      cwMessages = [];
      cwCurrentLine = "";
      cwDetectedHz = 0;
      cwDetectedWpm = 0;
      // Callback first, then enable: CW now decodes in a worker and delivers
      // events asynchronously, so the sink must exist before it starts.
      audio.setCWCallback((event) => {
        if (event.type === "char") {
          cwCurrentLine += event.char;
          if (cwCurrentLine.length >= 60) {
            cwMessages = [...cwMessages, cwCurrentLine].slice(-100);
            cwCurrentLine = "";
          }
        } else if (event.type === "word") {
          if (cwCurrentLine.length >= 45) {
            cwMessages = [...cwMessages, cwCurrentLine].slice(-100);
            cwCurrentLine = "";
          } else if (cwCurrentLine.length > 0) cwCurrentLine += " ";
        } else if (event.type === "freq") {
          cwDetectedHz = event.hz;
          cwDetectedWpm = event.wpm || 0;
        } else if (event.type === "silence") {
          if (cwCurrentLine.trim()) {
            cwMessages = [...cwMessages, cwCurrentLine].slice(-100);
            cwCurrentLine = "";
          }
          cwMessages = [...cwMessages, "───"].slice(-100);
          cwDetectedHz = 0;
          cwDetectedWpm = 0;
        }
        cwMessages = cwMessages;
        cwCurrentLine = cwCurrentLine;
      });
      audio.setCWDecoding(true);
    } else if (d === "wspr") {
      wsprEnabled = true;
      wsprMessages = [];
      const wsprList = document.getElementById("wsprMessagesList");
      if (wsprList) wsprList.innerHTML = "";
      audio.setWSPRDecoding(true);
      _wsprTickStart();
      // Pass dial frequency from current tuned frequency if available
      if (audio && typeof audio.setWSPRDialFreq === "function") {
        const dialHz = typeof frequency !== "undefined" ? frequency * 1000 : 0;
        audio.setWSPRDialFreq(dialHz);
      }
    } else if (d === "hffax") {
      faxEnabled = true;
      _faxActivate();
    } else if (d === "sstv") {
      sstvEnabled = true;
      _sstvActivate();
    } else if (d === "navtex") {
      navtexEnabled = true;
      _navtexActivate();
    } else if (d === "fsk") {
      _fskActivate();
    } else if (d === "radel" || d === "radeu") {
      radeEnabled = true;
      const sideband = d === "radel" ? "LSB" : "USB";
      demodulation = d === "radel" ? "RADEL" : "RADEU";
      // NOTE: handleDemodulationChange is intentionally deferred — do NOT call
      // it here. It runs inside the callback below, only after the sidecar
      // socket confirms open. Calling it eagerly would fire demodulation/window
      // commands to spectrumserver on every failed connection attempt (e.g. when
      // rade_helper.py is not yet running), causing rapid-fire server messages
      // that can trigger connection-teardown race conditions in spectrumserver.
      audio.setRADECallback((event) => {
        if (event.type === "status") {
          if (event.connected) {
            handleDemodulationChange(null, true);
          }
          radeConnected = event.connected;
          radeConnected = radeConnected;
        } else if (event.type === "snr") {
          radeSynced = event.synced;
          radeSnr = event.snr;
          radeSynced = radeSynced;
          radeSnr = radeSnr;
        } else if (event.type === "error") {
          radeConnected = false;
          radeConnected = radeConnected;
        }
      });
      audio.setRADEDecoding(true, sideband);
    }
    // 'none' → everything already off from _deactivateAll()
  }

  /** Master Off/On toggle */
  function toggleDecoder() {
    decoderOn = !decoderOn;
    if (decoderOn) {
      activateSelectedDecoder();
    } else {
      _deactivateAll();
      selectedDecoder = "none";
    }
  }

  /** Called when the dropdown changes while decoder is ON */
  function handleDecoderChange() {
    if (decoderOn) activateSelectedDecoder();
  }

  /**
   * One-touch decoder launch, used by the Decoders button row and by the
   * RADEL/RADEU buttons in the Modes selector and the Modes/Bands popups.
   * Does what the user would otherwise do by hand: pick the decoder in the
   * dropdown, switch the decoder On, then scroll its panel into view.
   * Pressing the button of the decoder that is already running switches it
   * back off and its window closes, so the buttons work as a toggle.
   */
  function launchDecoder(key) {
    if (decoderOn && selectedDecoder === key) {
      decoderOn = false;
      _deactivateAll();
      selectedDecoder = "none";
      return;
    }
    selectedDecoder = key;
    decoderOn = true;
    activateSelectedDecoder();
    // Close whichever popup the button was pressed in so the panel is visible.
    showModePopup = false;
    showBandPopup = false;
    tick().then(() => {
      const el = document.querySelector(".decoder-panel");
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }

  // ── Mode identifier ────────────────────────────────────────────────────────
  //
  // Suggests which decoder to reach for.  Off by default and torn down when
  // switched off, so it costs nothing unless it is asked for.

  let modeIdOn = false;
  let modeIdResult = null;

  /** Tear the identifier down. Safe to call when it is already off. */
  function _modeIdOff() {
    if (!modeIdOn) return;
    modeIdOn = false;
    audio.setModeIDDecoding(false);
    audio.setModeIDCallback(null);
    modeIdResult = null;
  }

  function toggleModeId() {
    if (modeIdOn) { _modeIdOff(); return; }
    modeIdOn = true;
    audio.setModeIDCallback((ev) => {
      if (ev && ev.t === "result") modeIdResult = ev;
    });
    audio.setModeIDDecoding(true);
  }

  /**
   * Where each identified mode lives inside the passband, as offsets in Hz from
   * the dial, plus the sideband it is worked in.
   *
   * These are the conventional windows, not a measurement: FT8 and friends
   * occupy the whole 3 kHz sub-band, WSPR only the 1350-1650 Hz slot, NAVTEX a
   * few hundred Hz around its 500 Hz centre, and CW sits on the dial itself.
   * Narrowing to them keeps the neighbours out of the decoder, which is what an
   * operator would do by hand after choosing the mode.
   *
   * `mode: null` means "leave the sideband alone" -- SSTV picks its own by band
   * (LSB on 80/40 m), and overriding it here would invert its tone mapping.
   * The FSK panel is absent on purpose: fskApplyBandpass() already sets a
   * window from the variant's shift or bandwidth, which is tighter than
   * anything a table could say.
   */
  const MODE_ID_RECEIVER_DEFAULTS = {
    ft8: { mode: "USB", passband: [0, 3000] },
    ft4: { mode: "USB", passband: [0, 3000] },
    ft2: { mode: "USB", passband: [0, 3000] },
    js8: { mode: "USB", passband: [0, 3000] },
    wspr: { mode: "USB", passband: [1350, 1650] },
    navtex: { mode: "USB", passband: [250, 750] },
    hffax: { mode: "USB", passband: [800, 2700] },
    sstv: { mode: null, passband: [900, 2600] },
    cw: { mode: "CW", passband: [-250, 250] },
  };

  /**
   * Put the receiver where the chosen mode expects to be worked: its sideband
   * and its passband.
   *
   * Deferred rather than immediate.  The FAX and SSTV decoders switch sideband
   * from inside a tick()+60 ms chain, and handleDemodulationChange() resets the
   * passband to the mode default on the way -- so anything set synchronously
   * here would be wiped by the decoder that was just started.  This waits for
   * that to have happened and then has the last word.
   *
   * The offsets are written for an upper sideband; on LSB the passband hangs
   * below the dial instead, so they are mirrored.
   */
  async function _modeIdApplyReceiverDefaults(key) {
    const def = MODE_ID_RECEIVER_DEFAULTS[key];
    if (!def) return;
    await tick();
    await new Promise((resolve) => setTimeout(resolve, 150));
    try {
      if (def.mode && demodulation !== def.mode) {
        demodulation = def.mode;
        handleDemodulationChange(null, true);
        await tick();
      }
      const type = (demodulationDefaults[demodulation] || {}).type;
      const [lo, hi] = def.passband;
      const m = FFTOffsetToFrequency(audio.getAudioRange()[1]);
      const [l, r] =
        type === "LSB" || type === "CWL" ? [m - hi, m - lo] : [m + lo, m + hi];
      applyIFEdges(l, m, r);
      updateLink();
    } catch (e) {
      console.warn("[ModeID] applying receiver defaults failed", e);
    }
  }

  // How much spectrum to show around the signal once a suggested mode is
  // accepted.  Wide enough to keep the sub-band and its neighbours in view,
  // narrow enough to see the individual signals in it.
  const MODE_ID_VIEW_SPAN_HZ = 100000;

  /**
   * Frame the signal: put the tuned frequency in the middle and set the view
   * to MODE_ID_VIEW_SPAN_HZ across, zooming out as readily as in.
   *
   * 1024 bins is as far as the waterfall goes; on a receiver whose bins are
   * wide enough for that to be more than the span asked for, the view lands
   * there instead.
   */
  function _modeIdZoomIn() {
    try {
      const [, m] = audio.getAudioRange();
      const edge = frequencyToFFTOffset(
        FFTOffsetToFrequency(m) + MODE_ID_VIEW_SPAN_HZ / 2,
      );
      const half = Math.max(512, Math.round(edge - m));
      waterfall.setWaterfallRange(Math.round(m - half), Math.round(m + half));
      frequencyMarkerComponent.updateFrequencyMarkerPositions();
      updatePassband();
    } catch (e) {
      console.warn("[ModeID] zoom failed", e);
    }
  }

  /**
   * Act on a candidate: launch its decoder, first selecting the FSK variant for
   * the modes that live inside the FSK panel (RTTY / weather / PSK31 / Olivia).
   * The variant has to be set BEFORE launchDecoder() so activating the panel
   * already applies the right tone pair and baud.
   *
   * Choosing a mode here is also a decision to work it, so the receiver is set
   * up for it: the sideband and the passband become the ones that mode is
   * worked with, and the view closes in on the tuned frequency.
   */
  function modeIdTune(candidate) {
    if (!candidate || !candidate.key) return;
    if (candidate.key === "fsk" && candidate.variant) {
      fskVariant = candidate.variant;
      _applyFskVariantDefaults(fskVariant);
    }
    const wasRunning = decoderOn && selectedDecoder === candidate.key;
    launchDecoder(candidate.key);
    if (candidate.key === "fsk" && candidate.variant) fskApplySettings(true);
    // launchDecoder() toggles a running decoder back off -- leave the receiver
    // as it is in that case, rather than framing a decoder that just stopped.
    if (wasRunning) return;
    _modeIdZoomIn();
    _modeIdApplyReceiverDefaults(candidate.key);
  }

  /**
   * Move the dial so the signal lands in the middle of the audio passband, then
   * measure again from scratch.
   *
   * This is NOT a search.  The identifier already reports where the signal sits
   * in the audio (features.centerHz), so the required shift is known exactly and
   * one move does it — no stepping, no guessing.  It exists because measurement
   * degrades below ~700 Hz audio (the Hilbert transform's response near DC) and
   * above ~2700 Hz (an SSB filter clipping the upper tone); in between, position
   * makes no difference at all and this button is not offered.
   *
   * USB puts audio above the dial and LSB below it, so the shift changes sign.
   */
  function modeIdRecentre() {
    const f = modeIdResult && modeIdResult.features;
    if (!f || !f.centerHz) return;
    const dialHz = Math.round(Number(frequency) * 1e3);
    if (!Number.isFinite(dialHz) || dialHz <= 0) return;

    const delta = Math.round(f.centerHz - RECENTRE_TARGET_HZ);
    const inverted = demodulation === "LSB" || demodulation === "CW-L";
    const target = dialHz + (inverted ? -delta : delta);
    if (target <= 0) return;

    try {
      if (frequencyInputComponent && frequencyInputComponent.setFrequency)
        frequencyInputComponent.setFrequency(target);
      handleFrequencyChange({ detail: target });
      frequency = (target / 1e3).toFixed(3);
      // Everything measured so far describes the old frequency.
      audio.resetModeID();
      modeIdResult = null;
    } catch (e) {
      console.warn("[ModeID] recentre failed", e);
    }
  }

  /**
   * A retune invalidates everything measured.  The cadence buffer now holds
   * over four minutes of history so that WSPR's 2-minute grid can be seen at
   * all, which is long enough to hand back a confident answer about a frequency
   * the operator has already left.
   */
  let _modeIdDial = null;
  $: {
    const dial = `${frequency}|${demodulation}`;
    if (modeIdOn && _modeIdDial !== null && dial !== _modeIdDial) {
      audio.resetModeID();
      modeIdResult = null;
    }
    _modeIdDial = dial;
  }

  /**
   * The engine is deaf to everything but the audio, so the band plan is applied
   * here, where the dial frequency and sideband are known.  This is also what
   * splits the FT8 / JS8 family: the two are the same waveform, but they have
   * different calling frequencies.
   */
  $: modeIdRanked = (() => {
    if (!modeIdResult || !modeIdResult.candidates) return [];
    const f = modeIdResult.features;
    const khz = f
      ? signalKhz(Number(frequency), f.centerHz, demodulation)
      : 0;
    return applyBandPriors(modeIdResult.candidates, khz);
  })();

  /** True when the signal is far enough off to be worth moving. */
  $: modeIdOffCentre = (() => {
    const f = modeIdResult && modeIdResult.features;
    if (!modeIdOn || !f || !f.centerHz || !f.snrDb) return false;
    return f.centerHz < RELIABLE_LO_HZ || f.centerHz > RELIABLE_HI_HZ;
  })();

  /** RADEL/RADEU buttons pass the mode name rather than the decoder key. */
  function launchRadeDecoder(which) {
    launchDecoder(which === "RADEL" ? "radel" : "radeu");
  }

  /** The decoder currently running, or "none" — drives the button highlight. */
  $: activeDecoder = decoderOn ? selectedDecoder : "none";

  /**
   * The Decoders button row.  RADEL/RADEU are deliberately absent — they have
   * their own buttons in the Modes selector and the Modes/Bands popups.
   * `label` is kept short so all ten buttons fit on ONE line at any width --
   * hence NAVTX rather than NAVTEX, with the full name in the tooltip.
   */
  const decoderButtons = [
    { key: "ft8", label: "FT8", title: "FT8" },
    { key: "ft4", label: "FT4", title: "FT4" },
    { key: "ft2", label: "FT2", title: "FT2" },
    { key: "js8", label: "JS8", title: "JS8 (JS8Call)" },
    { key: "cw", label: "CW", title: "CW" },
    { key: "wspr", label: "WSPR", title: "WSPR" },
    { key: "hffax", label: "FAX", title: "HF FAX / WEFAX" },
    { key: "sstv", label: "SSTV", title: "SSTV" },
    { key: "navtex", label: "NAVTX", title: "NAVTEX" },
    { key: "fsk", label: "RTTY", title: "FSK / RTTY" },
  ];

  // Legacy shims — keep for any remaining call sites in the file
  function handleFt8Decoder(e, value) {
    selectedDecoder = "ft8";
    decoderOn = !!value;
    if (decoderOn) activateSelectedDecoder();
    else _deactivateAll();
  }
  function handleFt4Decoder(e, value) {
    selectedDecoder = "ft4";
    decoderOn = !!value;
    if (decoderOn) activateSelectedDecoder();
    else _deactivateAll();
  }
  function handleFt2Decoder(e, value) {
    selectedDecoder = "ft2";
    decoderOn = !!value;
    if (decoderOn) activateSelectedDecoder();
    else _deactivateAll();
  }
  function handleCwDecoder(e, value) {
    selectedDecoder = "cw";
    decoderOn = !!value;
    if (decoderOn) activateSelectedDecoder();
    else _deactivateAll();
  }

  // Normalizes dB values to a 0-100 scale for visualization
  function normalizeDb(dbValue) {
    const minDb = -100; // Minimum expected dB value
    const maxDb = 0; // Maximum dB value (best signal)
    return ((dbValue - minDb) / (maxDb - minDb)) * 100;
  }

  function handlePassbandChange(passband) {
    let [l, m, r] = passband.detail.map(waterfallOffsetToFrequency);

    let bfo = frequencyInputComponent.getBFO();

    l += bfo;
    m += bfo;
    r += bfo;

    const demodulationDefault = demodulationDefaults[demodulation];

    // Get current displayed frequency
    const currentFreq = frequencyInputComponent.getFrequency();
    const frequencyChange = Math.abs(m - currentFreq);

    // If m is close to current frequency (< 1000 Hz), it's wheel - don't recalculate!
    // If m is far from current frequency (> 1000 Hz), it's click - recalculate!
    const isWheel = frequencyChange < 1000;

    if (!isWheel) {
      // CLICK - recalculate, snapped within each 1 kHz block to .00 or .50:
      //   fraction .000..355 Hz -> .00 (this kHz)
      //   fraction .356..645 Hz -> .50
      //   fraction .646..999 Hz -> .00 (next kHz)
      const rawFreq = (l + r) / 2;
      const blockBase = Math.floor(rawFreq / 1000) * 1000;
      const blockFrac = rawFreq - blockBase;
      let clickedFreq;
      if (blockFrac < 355)
        clickedFreq = blockBase; // .00 (this kHz)
      else if (blockFrac > 645)
        clickedFreq = blockBase + 1000; // .00 (next kHz)
      else clickedFreq = blockBase + 500; // .50

      if (demodulation === "USB") {
        l = clickedFreq;
        m = clickedFreq;
        r = clickedFreq + demodulationDefault.offsets[1];
      } else if (demodulation === "LSB") {
        l = clickedFreq - demodulationDefault.offsets[0];
        m = clickedFreq;
        r = clickedFreq;
      } else if (demodulation === "CW" || demodulation === "CW-L") {
        l = clickedFreq - demodulationDefault.offsets[0];
        m = clickedFreq;
        r = clickedFreq + demodulationDefault.offsets[1];
      } else {
        l = clickedFreq - demodulationDefault.offsets[0];
        m = clickedFreq;
        r = clickedFreq + demodulationDefault.offsets[1];
      }
    } else {
    }

    // CW offsets
    const lOffset = l - 200;
    const mOffset = m - 750;
    const rOffset = r - 200;

    bandwidth = ((r - l) / 1000).toFixed(2);
    frequencyInputComponent.setFrequency(m);
    frequency = (m / 1e3).toFixed(3);

    const audioParameters = [l, m, r].map(frequencyToFFTOffset);
    const audioParametersOffset = [lOffset, mOffset, rOffset].map(
      frequencyToFFTOffset,
    );

    audio.setAudioRange(...audioParameters, ...audioParametersOffset);

    updateLink();
    updatePassband(audioParameters);
    waterfall.checkBandAndSetMode(m);
    updateBandButton();
    // A waterfall click rebuilds the passband from the mode defaults, so a
    // running decoder has to get its own back.
    _decoderReassertReceiver();

    // CATsync: a waterfall click or passband drag is the listener tuning,
    // and the most common way they do it - tell the tool.
    window.__catsync_state = window.__catsync_state || { hz: null, mode: null };
    window.__catsync_state.hz = frequencyInputComponent.getFrequency();
    if (!catsyncRemote) catsyncNotify({ freq: 1 });

    // CAT sync over TCI, Phantom -> rig: a waterfall click or passband drag
    // moves the rig too. A drag fires this on every move, so skip repeats.
    if (catSyncEnabled && !catApplyingRemoteFreq && catSyncHandle) {
      const hz = Math.round(m);
      if (hz !== catLastSentHz && catSyncHandle.sendFreqToRig(hz)) {
        catLastSentHz = hz;
      }
    }
  }

  // Entering new frequency into the textbox
  function handleFrequencyChange(event) {
    const frequencyHz = event.detail;

    // CAT sync, Phantom -> rig (TCI): only when "CAT Sync" is switched on, and
    // only when this change did not come from the rig itself (no echo).
    if (catSyncEnabled && !catApplyingRemoteFreq && catSyncHandle) {
      catSyncHandle.sendFreqToRig(frequencyHz);
    }
    const audioRange = audio.getAudioRange();

    // Keep the shared UI frequency state in sync before any band/mode refresh.
    // Otherwise clicks on user labels/bookmarks can tune correctly, but the
    // band selector may still evaluate against the previous frequency.
    frequency = Math.max(0, frequencyHz / 1e3).toFixed(3);

    const [l, m, r] = audioRange.map(FFTOffsetToFrequency);

    // Preserve current bandwidth settings
    let audioParameters = [
      frequencyHz - (m - l),
      frequencyHz,
      frequencyHz + (r - m),
    ].map(frequencyToFFTOffset);
    const newm = audioParameters[1];

    const lOffset = frequencyHz - (m - l) - 200;
    const mOffset = frequencyHz - 750;
    const rOffset = frequencyHz + (r - m) - 200;

    const audioParametersOffset = [lOffset, mOffset, rOffset].map(
      frequencyToFFTOffset,
    );

    // If the ranges are not within limit, shift it back
    let [waterfallL, waterfallR] = waterfall.getWaterfallRange();
    if (newm < waterfallL || newm >= waterfallR) {
      const limits = Math.floor((waterfallR - waterfallL) / 2);
      let offset;
      if (audioRange[1] >= waterfallL && audioRange[1] < waterfallR) {
        offset = audioRange[1] - waterfallL;
      } else {
        offset = limits;
      }
      const newMid = Math.min(
        waterfall.waterfallMaxSize - limits,
        Math.max(limits, newm - offset + limits),
      );

      waterfallL = Math.floor(newMid - limits);
      waterfallR = Math.floor(newMid + limits);
      waterfall.setWaterfallRange(waterfallL, waterfallR);
    }
    audio.setAudioRange(...audioParameters, ...audioParametersOffset);
    updatePassband();
    updateLink();
    // Always refresh the band selector immediately, including for marker/user-label
    // clicks. The clicked marker's own SetMode() call can still override mode right
    // after this, but the band highlight must update on the first click.
    waterfall.checkBandAndSetMode(frequencyHz);
    frequencyMarkerComponent.updateFrequencyMarkerPositions();
    syncBandButtonToFrequency(frequencyHz);
    updateBandButton();
    _decoderReassertReceiver();

    // --- CATsync: update shared state mirror and notify external tools ---
    window.__catsync_state = window.__catsync_state || { hz: null, mode: null };
    window.__catsync_state.hz = event.detail;
    // Only fire the hook when the tune came from the user, not from CATsync itself
    if (!event.__catsync_remote && !catsyncRemote) {
      catsyncNotify({ freq: 1 });
    }
  }

  // Waterfall magnification controls
  function handleWaterfallMagnify(e, type) {
    let [l, m, r] = audio.getAudioRange();
    const [waterfallL, waterfallR] = waterfall.getWaterfallRange();
    const offset =
      ((m - waterfallL) / (waterfallR - waterfallL)) * waterfall.canvasWidth;
    switch (type) {
      case "max":
        m = Math.min(waterfall.waterfallMaxSize - 512, Math.max(512, m));
        l = Math.floor(m - 512);
        r = Math.ceil(m + 512);
        break;
      case "+":
        e.coords = { x: offset };
        e.scale = -1;
        waterfall.canvasWheel(e);
        updatePassband();
        frequencyMarkerComponent.updateFrequencyMarkerPositions();
        return;
      case "go":
        e.coords = { x: offset };
        e.scale = -100;
        waterfall.canvasWheel(e);
        updatePassband();
        frequencyMarkerComponent.updateFrequencyMarkerPositions();
        return;
      case "-":
        e.coords = { x: offset };
        e.scale = 1;
        waterfall.canvasWheel(e);
        updatePassband();
        frequencyMarkerComponent.updateFrequencyMarkerPositions();
        return;
      case "min":
        l = 0;
        r = waterfall.waterfallMaxSize;
        min_waterfall = -30;
        max_waterfall = 110;
        handleMinMove(-30);
        handleMaxMove(110);
        break;
    }
    waterfall.setWaterfallRange(l, r);
    frequencyMarkerComponent.updateFrequencyMarkerPositions();

    updatePassband();
  }

  // Zoom the waterfall to show the full band that the current frequency belongs to.
  // The tuned frequency is NOT recentered — the view just snaps to the band edges.
  // Zoom the waterfall to the full band the current frequency belongs to.
  // Also applies the band's min/max brightness from bands-config.js.
  // The tuned frequency is NOT recentered — view snaps to the band edges.
  function handleZoomToBand() {
    if (currentBand < 0) return;
    const band = bandArray[currentBand];
    // Via frequencyToFFTOffset, not sps/fftSize: the waterfall range is
    // measured in fft_result_size bins from the receiver's baseband frequency,
    // and dividing a plain RF frequency by the bin width ignores that offset --
    // which puts the view megahertz away on every receiver whose baseband is
    // not 0 Hz (RTL, RSP1A).
    const l = Math.floor(frequencyToFFTOffset(band.startFreq));
    const r = Math.ceil(frequencyToFFTOffset(band.endFreq));
    waterfall.setWaterfallRange(l, r);
    min_waterfall = parseInt(band.min);
    max_waterfall = parseInt(band.max);
    handleMinMove();
    handleMaxMove();
    frequencyMarkerComponent.updateFrequencyMarkerPositions();
    updatePassband();
  }

  let mute = false;
  let volume = 50;
  let squelchEnable;
  let squelch = -50;
  // Calibrated power in dBm, handed to the round desktop <SMeterAnalog/>.
  let smeterDbm = -130;
  // The same power without visualGain, handed to the mobile <SMeterAnalog/>,
  // which draws a bar rather than a needle — see the note in _smeterTick().
  let smeterDbmFlat = -130;
  // <SMeterDigital/> is driven from the RAW power plus audio.smeter_offset, not
  // from the calibrated dBm the analog face uses — see the note in that
  // component.  _smeterTick() publishes both every frame so neither meter needs
  // a branch; only the markup below picks which one is mounted.
  let smeterRawDb = -130;
  let smeterOffset = 0;
  // Handle for the _smeterTick() RAF loop.  It used to be declared alongside the
  // needle-animation state that moved into lib/SMeterAnalog.svelte, but the tick
  // itself stays here, so the declaration has to stay with it.
  let _smeterRaf = null;
  // resize listener handle, so onDestroy can remove what onMount added
  let _resizeHandler = null;

  // S-meter drawing now lives in lib/SMeterAnalog.svelte.

  function handleWheel(node) {
    function onWheel(event) {
      event.preventDefault();
      const delta = event.deltaY > 0 ? -1 : 1;
      const isShiftPressed = event.shiftKey;
      const isAltPressed = event.altKey;

      // Convert frequency to Hz for calculations
      let frequencyHz = Math.round(parseFloat(frequency) * 1e3);

      function adjustFrequency(freq, direction, shiftPressed, altPressed) {
        const step =
          currentTuneStep ||
          (altPressed ? 10000 : shiftPressed ? 1000 : defaultStep);
        const lastDigits = freq % step;

        if (lastDigits === 0) {
          return freq + direction * step;
        } else if (direction > 0) {
          return Math.ceil(freq / step) * step;
        } else {
          return Math.floor(freq / step) * step;
        }
      }

      frequencyHz = adjustFrequency(
        frequencyHz,
        delta,
        isShiftPressed,
        isAltPressed,
      );

      // Convert back to kHz and ensure 2 decimal places
      frequency = (frequencyHz / 1e3).toFixed(3);

      // Ensure frequency is not negative
      frequency = Math.max(0, parseFloat(frequency));

      frequencyInputComponent.setFrequency(frequencyHz);
      handleFrequencyChange({ detail: frequencyHz });
    }

    node.addEventListener("wheel", onWheel);

    return {
      destroy() {
        node.removeEventListener("wheel", onWheel);
      },
    };
  }

  // Auto-focus helper action used by the frequency manual input
  function focusOnMount(node) {
    node.focus();
    node.select();
    return { destroy: function () {} };
  }

  // ── Digit-by-digit frequency tuning ─────────────────────────────────────
  // Each entry is the step size in Hz for that digit position (left→right).
  // Display: [d0][d1][d2],[d3][d4][d5].[d6][d7][d8] kHz
  //           100M 10M  1M  100k 10k  1k   100  10   1 Hz
  var DIGIT_POWERS_HZ = [
    100000000, 10000000, 1000000, 100000, 10000, 1000, 100, 10, 1,
  ];

  var selectedDigitIdx = -1; // -1 = none selected yet
  var hoveredDigitIdx = -1; // -1 = none hovered
  var frameHovered = false; // hovering the frequency frame itself (not a specific digit)

  function handleDigitMouseEnter(idx) {
    hoveredDigitIdx = idx;
  }

  function handleDigitMouseLeave() {
    hoveredDigitIdx = -1;
  }

  function handleFreqFrameMouseEnter() {
    frameHovered = true;
  }

  function handleFreqFrameMouseLeave() {
    frameHovered = false;
  }

  // FIX [5]: support up to 10 digits (covers up to 9,999 MHz / ~10 GHz)
  // Hz value padded to 9 digits (1 Hz resolution); keep full precision in
  // the frequency variable.
  var DIGIT_COUNT = 9;

  $: freqDigitChars = (function () {
    var f = parseFloat(frequency) || 0;
    var hz = Math.round(f * 1000); // units of 1 Hz
    var s = String(hz);
    while (s.length < DIGIT_COUNT) {
      s = "0" + s;
    }
    // If overflow beyond DIGIT_COUNT, clamp display to leading digits
    if (s.length > DIGIT_COUNT) {
      s = s.slice(0, DIGIT_COUNT);
    }
    var firstNZ = 0;
    while (firstNZ < DIGIT_COUNT - 1 && s[firstNZ] === "0") {
      firstNZ++;
    }
    return s.split("").map(function (ch, i) {
      return { ch: ch, idx: i, dim: i < firstNZ };
    });
  })();

  function handleDigitClick(idx) {
    selectedDigitIdx = idx;
  }

  // Mobile frequency box — same tap behaviour as the /mobile page: the whole
  // reading is selected on focus so the first digit typed replaces it, and a
  // decimal keypad comes up. text + inputmode="decimal" is what gets that pad
  // on both iOS and Android; type="number" opens a pad that has no decimal
  // point on some Android keyboards and does not survive select() reliably.
  // The box always reads two decimals, but it must not reformat under the
  // user's fingers, so while it has focus it echoes exactly what was typed.
  // That also keeps it off `frequency`, which other code assigns bare numbers
  // to (applyStep, initBandButton) and which would otherwise show as "14200".
  var mobileFreqFocused = false;
  var mobileFreqTyped = "";
  $: mobileFreqValue = mobileFreqFocused
    ? mobileFreqTyped
    : (parseFloat(frequency) || 0).toFixed(2);

  function selectMobileFreq(e) {
    var el = e.currentTarget;
    mobileFreqTyped = (parseFloat(frequency) || 0).toFixed(2);
    mobileFreqFocused = true;
    // Deferred: iOS Safari moves the caret after its own focus handling, which
    // would undo an immediate select().
    setTimeout(function () {
      try {
        el.select();
      } catch (err) {}
    }, 0);
  }

  function commitMobileFreq() {
    mobileFreqFocused = false;
    var val = parseFloat(String(mobileFreqTyped).replace(",", "."));
    if (!isNaN(val) && val >= 0) {
      var hz = Math.round(val * 1e3);
      frequency = (hz / 1e3).toFixed(3);
      frequencyInputComponent.setFrequency(hz);
      handleFrequencyChange({ detail: hz });
    } else {
      // Restore the readout when the box is left empty or unparseable.
      frequency = (frequencyInputComponent.getFrequency() / 1e3).toFixed(3);
    }
  }

  var showFreqInput = false;
  var freqInputValue = "";
  var _commitBusy = false; // FIX [3]: guard against double-fire on Enter+blur

  function handleDigitContextMenu(e) {
    e.preventDefault();
    freqInputValue = (parseFloat(frequency) || 0).toFixed(3);
    _commitBusy = false;
    showFreqInput = true;
  }

  function commitFreqInput() {
    // Guard against double-fire: Enter keydown → commitFreqInput → showFreqInput=false
    // → blur fires again. The flag blocks the second call.
    if (_commitBusy) {
      return;
    }
    _commitBusy = true;
    var val = parseFloat(freqInputValue);
    if (!isNaN(val) && val >= 0) {
      var hz = Math.round(val * 1e3);
      frequency = (hz / 1e3).toFixed(3);
      frequencyInputComponent.setFrequency(hz);
      handleFrequencyChange({ detail: hz });
    }
    showFreqInput = false;
    // FIX [9]: reset after a tick so the blur-triggered second call is still blocked,
    // but subsequent right-clicks are never permanently locked out.
    setTimeout(function () {
      _commitBusy = false;
    }, 100);
  }

  function cancelFreqInput() {
    // FIX [6]: also deselect digit so cyan highlight doesn't linger
    showFreqInput = false;
    selectedDigitIdx = -1;
    _commitBusy = false;
  }

  function handleFreqInputKey(e) {
    if (e.key === "Enter") {
      commitFreqInput();
    } else if (e.key === "Escape") {
      cancelFreqInput();
    }
  }

  // FIX [1+2]: debounced server dispatch — UI updates instantly, server
  // notified only after 50 ms of inactivity to prevent WebSocket flooding.
  var _digitDispatchTimer = null;
  function dispatchFrequencyDebounced(hz) {
    if (_digitDispatchTimer !== null) {
      clearTimeout(_digitDispatchTimer);
    }
    _digitDispatchTimer = setTimeout(function () {
      _digitDispatchTimer = null;
      frequencyInputComponent.setFrequency(hz);
      handleFrequencyChange({ detail: hz });
    }, 50);
  }

  function handleDigitKeydown(e) {
    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      if (selectedDigitIdx < 0) {
        return;
      }
      var delta = e.key === "ArrowUp" ? 1 : -1;
      var step = DIGIT_POWERS_HZ[selectedDigitIdx];
      var frequencyHz = Math.round(parseFloat(frequency) * 1e3);
      frequencyHz = frequencyHz + delta * step;
      frequencyHz = Math.max(0, frequencyHz);
      frequency = (frequencyHz / 1e3).toFixed(3);
      dispatchFrequencyDebounced(frequencyHz); // FIX [2]
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      if (selectedDigitIdx > 0) {
        selectedDigitIdx = selectedDigitIdx - 1;
      } else {
        selectedDigitIdx = 0;
      }
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      if (selectedDigitIdx < 7) {
        selectedDigitIdx = selectedDigitIdx + 1;
      } else {
        selectedDigitIdx = 7;
      }
    } else if (e.key >= "0" && e.key <= "9") {
      e.preventDefault();
      if (selectedDigitIdx < 0) {
        return;
      }
      var tenHz = Math.round((parseFloat(frequency) || 0) * 100);
      var s = String(tenHz);
      while (s.length < DIGIT_COUNT) {
        s = "0" + s;
      }
      if (s.length > DIGIT_COUNT) {
        s = s.slice(0, DIGIT_COUNT);
      }
      s = s.slice(0, selectedDigitIdx) + e.key + s.slice(selectedDigitIdx + 1);
      var newHz = parseInt(s, 10) * 10;
      newHz = Math.max(0, newHz);
      frequency = (newHz / 1e3).toFixed(3);
      dispatchFrequencyDebounced(newHz); // FIX [2]
      if (selectedDigitIdx < 7) {
        selectedDigitIdx = selectedDigitIdx + 1;
      }
    }
  }

  function handleDigitWheel(node) {
    function onWheel(event) {
      event.preventDefault();
      var delta = event.deltaY > 0 ? -1 : 1;
      var isShiftPressed = event.shiftKey;
      var isAltPressed = event.altKey;
      var frequencyHz = Math.round(parseFloat(frequency) * 1e3);
      var step; // FIX [4]: declare once, assign in branches

      var activeDigitIdx =
        selectedDigitIdx >= 0 ? selectedDigitIdx : hoveredDigitIdx;

      if (activeDigitIdx >= 0) {
        // Digit-specific tuning: true place-value add/subtract, no snapping
        step = DIGIT_POWERS_HZ[activeDigitIdx];
        frequencyHz = frequencyHz + delta * step;
      } else {
        // No digit selected — fall back to default step tuning
        step =
          currentTuneStep ||
          (isAltPressed ? 10000 : isShiftPressed ? 1000 : defaultStep);
        var lastDigits = frequencyHz % step;
        if (lastDigits === 0) {
          frequencyHz = frequencyHz + delta * step;
        } else if (delta > 0) {
          frequencyHz = Math.ceil(frequencyHz / step) * step;
        } else {
          frequencyHz = Math.floor(frequencyHz / step) * step;
        }
      }

      frequencyHz = Math.max(0, frequencyHz);
      frequency = (frequencyHz / 1e3).toFixed(3);
      dispatchFrequencyDebounced(frequencyHz); // FIX [1]
    }

    // FIX [7]: clicking outside deselects digit AND closes any open popup
    function onDocClick(e) {
      if (!node.contains(e.target)) {
        selectedDigitIdx = -1;
        if (showFreqInput) {
          showFreqInput = false;
          _commitBusy = false;
        }
      }
    }

    node.addEventListener("wheel", onWheel, { passive: false });
    document.addEventListener("click", onDocClick);
    return {
      destroy: function () {
        node.removeEventListener("wheel", onWheel);
        document.removeEventListener("click", onDocClick);
        if (_digitDispatchTimer !== null) {
          clearTimeout(_digitDispatchTimer);
          _digitDispatchTimer = null;
        }
      },
    };
  }
  // ── End digit tuning ─────────────────────────────────────────────────────

  // Bandwidth offset control.  The button row that used to drive this was
  // removed from the panel; the IF filter's static-bandwidth path still calls it.
  function handleBandwidthOffsetClick(bandwidthoffset) {
    bandwidthoffset = parseFloat(bandwidthoffset);
    const demodulationDefault = demodulationDefaults[demodulation].type;
    let [l, m, r] = audio.getAudioRange().map(FFTOffsetToFrequency);
    if (demodulationDefault === "USB") {
      r = Math.max(m, Math.min(m + getMaximumBandwidth(), r + bandwidthoffset));
    } else if (demodulationDefault === "LSB") {
      l = Math.max(m - getMaximumBandwidth(), Math.min(m, l - bandwidthoffset));
    } else {
      r = Math.max(
        0,
        Math.min(m + getMaximumBandwidth() / 2, r + bandwidthoffset / 2),
      );
      l = Math.max(
        m - getMaximumBandwidth() / 2,
        Math.min(m, l - bandwidthoffset / 2),
      );
    }
    let audioParameters = [l, m, r].map(frequencyToFFTOffset);
    const lOffset = l - 200;
    const mOffset = m - 750;
    const rOffset = r - 200;
    const audioParametersOffset = [lOffset, mOffset, rOffset].map(
      frequencyToFFTOffset,
    );

    audio.setAudioRange(...audioParameters, ...audioParametersOffset);
    updatePassband();
  }

  // Toggle buttons and slides for audio
  function handleMuteChange() {
    mute = !mute;
    audio.setMute(mute);
  }

  function handleVolumeChange() {
    // During TX the slider still moves; its level is applied on receive.
    if (catTxMuted) return;
    audio.setGain(Math.pow(10, (volume - 50) / 50 + 2.6));
  }

  function handleSquelchChange() {
    squelchEnable = !squelchEnable;
    audio.setSquelch(squelchEnable);
    squelch = Math.round(audio.getPowerDb()) + 2;
    audio.setSquelchThreshold(squelch);
  }

  function handleSquelchMove() {
    audio.setSquelchThreshold(squelch);
  }

  function handleEnterKey(event) {
    if (event.key === "Enter") {
      event.preventDefault(); // Prevent the default action
      sendMessage();
    }
  }

  const AINR_DEFAULT_STRENGTH = 50;
  let NREnabled = false;
  let AINREnabled = false;
  let AINRLoading = false;   // first enable downloads RNNoise (~1.3 MB)
  // Share of denoised audio in the output; the rest is the original. Weak
  // stations are held up by the make-up gain in audio.js, not by this — the
  // slider is taste: how much natural band noise to keep. Always visible, so
  // it can be set before AI is switched on.
  let AINRStrength = AINR_DEFAULT_STRENGTH;
  let NBEnabled = false;
  let NSEnabled = false;
  let ANEnabled = false;
  let CTCSSSupressEnabled = false;

  // Backend Noise Gate Control
  let noiseGatePreset = "balanced";
  let backendNoiseGateEnabled = false;
  let lastAppliedNoiseGatePreset = null;

  function applyNoiseGatePreset() {
    if (!audio || !audio.decoder) return;
    if (noiseGatePreset === lastAppliedNoiseGatePreset) return;

    // Use backend control methods from audio_corrected.js
    if (typeof audio.decoder.set_noise_gate_preset === "function") {
      audio.decoder.set_noise_gate_preset(noiseGatePreset);
      lastAppliedNoiseGatePreset = noiseGatePreset;
    }
  }

  function toggleBackendNoiseGate() {
    backendNoiseGateEnabled = !backendNoiseGateEnabled;

    if (
      audio &&
      audio.decoder &&
      typeof audio.decoder.set_noise_gate_enable === "function"
    ) {
      audio.decoder.set_noise_gate_enable(backendNoiseGateEnabled);

      // Apply current preset when enabling
      if (backendNoiseGateEnabled) {
        setTimeout(() => applyNoiseGatePreset(), 100);
      }
    }
  }

  // NR and NB, like AN, are done in audio.js. The WASM flags are forced off so
  // the two implementations can never stack: the FLAC decoder's noise blanker
  // is already known to crash (index out of bounds) and is bypassed inside
  // audio.js, and the Opus decoder has neither method, so the WASM calls were
  // dead weight on one codec and a hazard on the other.
  function applyNoiseReduction(enabled) {
    if (!audio) return;
    if (audio.decoder && typeof audio.decoder.set_nr === "function") {
      try {
        audio.decoder.set_nr(false);
      } catch (e) {}
    }
    if (typeof audio.enableNoiseReduction === "function") {
      audio.enableNoiseReduction(enabled);
    } else {
      audio.nrEnabled = enabled;
    }
  }

  function applyNoiseBlanker(enabled) {
    if (!audio) return;
    if (audio.decoder && typeof audio.decoder.set_nb === "function") {
      try {
        audio.decoder.set_nb(false);
      } catch (e) {}
    }
    if (typeof audio.enableNoiseBlanker === "function") {
      audio.enableNoiseBlanker(enabled);
    } else {
      audio.nbBlankerEnabled = enabled;
      audio.nbEnabled = enabled;
    }
    // Hum notch filters follow NB — both 50 Hz and 60 Hz toggled together
    if (typeof audio.setHumNotch === "function") {
      audio.setHumNotch("both", enabled);
    }
  }

  function handleNRChange() {
    NREnabled = !NREnabled;
    applyNoiseReduction(NREnabled);
  }

  // AI NR (RNNoise) is a speech model: audio.js bypasses it outside the voice
  // modes, and the button dims to say so rather than switching itself off.
  const AINR_MODES = ["USB", "LSB", "AM", "SAM"];

  function handleAINRStrength() {
    if (audio && typeof audio.setAiNoiseReductionMix === "function") {
      audio.setAiNoiseReductionMix(AINRStrength / 100);
    }
  }
  $: AINRActive = AINREnabled && AINR_MODES.includes(demodulation);

  async function handleAINRChange() {
    if (!audio || AINRLoading || typeof audio.enableAiNoiseReduction !== "function") return;
    const want = !AINREnabled;
    AINREnabled = want;
    AINRLoading = want;
    if (want) handleAINRStrength();
    const ok = await audio.enableAiNoiseReduction(want);
    AINRLoading = false;
    if (want && !ok) AINREnabled = false;
  }

  function handleNBChange() {
    NBEnabled = !NBEnabled;
    applyNoiseBlanker(NBEnabled);
  }

  function handleNSChange() {
    NSEnabled = !NSEnabled;
    if (audio && typeof audio.setBackgroundNoiseSuppression === "function") {
      audio.setBackgroundNoiseSuppression(NSEnabled);
    }
  }

  // Auto Notch runs in JavaScript (the NLMS adaptive predictor in audio.js),
  // not in the WASM decoder. The Opus decoder has no set_an() at all, so the
  // old decoder-only toggle was a silent no-op on the default codec; on FLAC
  // the WASM notch would stack a second, un-resettable notch on top of ours.
  // Force the backend one off and drive audio.js as the single implementation.
  function applyAutoNotch(enabled) {
    if (!audio) return;
    if (audio.decoder && typeof audio.decoder.set_an === "function") {
      try {
        audio.decoder.set_an(false);
      } catch (e) {}
    }
    if (typeof audio.enableAutoNotch === "function") {
      audio.enableAutoNotch(enabled);
    }
  }

  function handleANChange() {
    ANEnabled = !ANEnabled;
    applyAutoNotch(ANEnabled);
  }

  function handleCTCSSChange() {
    CTCSSSupressEnabled = !CTCSSSupressEnabled;
    audio.setCTCSSFilter(CTCSSSupressEnabled);
    console.log("mD = " + Device.isMobile);
  }

  function handleNoiseGatePresetChange(event) {
    noiseGatePreset = event.target.value;
    applyNoiseGatePreset();
    console.log("Noise gate preset changed to:", noiseGatePreset);
  }

  // This function was added by sv2amk to autodetect //
  // and show the proper band upon startup. It is called from //
  // the display subsection inside the svelte section //
  // near the middle of this file and it's triggered //
  // by the -2 value. //

  function initBandButton(Kcps) {
    frequency = Kcps;
    if (currentBand == -2) {
      for (var i = 0; i < bandArray.length; i++) {
        if (
          frequency >= bandArray[i].startFreq / 1000 &&
          frequency <= bandArray[i].endFreq / 1000 &&
          (bandArray[i].ITU === siteRegion || bandArray[i].ITU === 123)
        ) {
          currentBand = i;
          bandName = bandArray[i].name;
        }
      }
    }
  }

  // amkamk

  // This function was added to track band changes //
  // and makes the band buttons track along with frequency //
  // adjustments. //
  let prevBand,
    stepi = 0;
  function syncBandButtonToFrequency(frequencyHz) {
    const frequencyKhz = Number(frequencyHz) / 1000;
    currentBand = -1;
    for (let i = 0; i < bandArray.length; i++) {
      if (
        frequencyKhz >= bandArray[i].startFreq / 1000 &&
        frequencyKhz <= bandArray[i].endFreq / 1000 &&
        (bandArray[i].ITU === siteRegion || bandArray[i].ITU === 123)
      ) {
        currentBand = i;
        newStaticBandwidth = 0; // To reset the IF Filter button //
        if (prevBand != currentBand) {
          currentTuneStep = bandArray[i].stepi;
        }
        bandName = bandArray[i].name;
        break;
      }
    }
    prevBand = currentBand;
  }

  function updateBandButton() {
    const frequencyHz = Number(
      frequencyInputComponent && frequencyInputComponent.getFrequency
        ? frequencyInputComponent.getFrequency()
        : Math.round((Number(frequency) || 0) * 1000),
    );
    syncBandButtonToFrequency(frequencyHz);
  }

  // Regular updating UI elements:
  // Other user tuning displays
  //
  let updateInterval;
  let lastUpdated = 0;

  let eyeDbm = -130;

  function _smeterTick() {
    let powerDb = audio.getPowerDb();
    const analogSmeterOffset = Number.isFinite(
      Number(audio?.analog_smeter_offset),
    )
      ? Number(audio.analog_smeter_offset)
      : 0;
    powerDb += analogSmeterOffset;
    const visualGain = 1.1; // 👈 every 0.10 = 5 dbm
    const minDb = -130;
    powerDb = minDb + (powerDb - minDb) * visualGain;
    // The dBm -> needle mapping moved into lib/SMeterAnalog.svelte; publishing
    // smeterDbm re-renders the meter component.
    smeterDbm = powerDb;
    // Same dBm without visualGain, for the mobile analog face.  On mobile
    // SMeterAnalog renders a compact *bar*, not the round needle face, so it
    // sits right next to the digital bar and /mobile's bar in the user's eye —
    // and visualGain pushed it 1-2 segments (~3-5 dB) above both.  The round
    // desktop face keeps the gain; only the bar reads flat, so every bar in
    // the project now agrees.
    smeterDbmFlat = audio.getPowerDb() + analogSmeterOffset;
    smeterRawDb = audio.getPowerDb();
    smeterOffset = audio.smeter_offset;
    try {
      window._lastPowerDb = powerDb;
      eyeDbm = powerDb;
      // Purely spectral SNR from off-passband spectrum bins (waterfall.js).
      // Noise floor is derived so (dBm − NF) === SNR by construction, keeping
      // the NF and SNR windows consistent in the same displayed dBm scale.
      const _wf =
        typeof waterfall.getSnrEstimate === "function"
          ? waterfall.getSnrEstimate()
          : null;
      const _snr = _wf && Number.isFinite(_wf.snrDb) ? _wf.snrDb : 0;
      window._lastSnr = _snr;
      window._noiseFloorDb = window._lastPowerDb - _snr;
    } catch (e) {}
    _smeterRaf = requestAnimationFrame(_smeterTick);
  }

  function updateTick() {
    // Poll C-QUAM 25 Hz stereo-pilot detection for the QUAM button green indicator.
    {
      const _q =
        audio && typeof audio.getCquamPilotDetected === "function"
          ? audio.getCquamPilotDetected()
          : false;
      if (_q !== cquamPilotDetected) cquamPilotDetected = _q;
    }
    {
      const _s =
        audio && typeof audio.getSamLocked === "function"
          ? audio.getSamLocked()
          : false;
      if (_s !== samLocked) samLocked = _s;
    }
    if (events.getLastModified() > lastUpdated) {
      const myRange = audio.getAudioRange();
      const clients = events.getSignalClients();
      // Identify our own pill. Prefer our real signal-protocol UUID (sent by the
      // server in the initial settings) — this is exact even when another user
      // shares our frequency. Only fall back to the closest-frequency heuristic
      // if the server didn't provide an id (older backend).
      const clientKeys = Object.keys(clients);
      let myId = null;
      const realId =
        typeof audio.getClientId === "function" ? audio.getClientId() : null;
      if (realId && clients[realId]) {
        myId = realId;
      } else if (clientKeys.length > 0) {
        myId = clientKeys.reduce((a, b) => {
          const aDiff = Math.abs(clients[a][1] - myRange[1]);
          const bDiff = Math.abs(clients[b][1] - myRange[1]);
          return aDiff < bDiff ? a : b;
        });
      }
      _myId = myId;
      if (myId) myDisplayId = idToSixDigits(myId);
      waterfall.setClients(clients, myId, username);
      waterfall.setClientGeo(_clientGeoMap);
      requestAnimationFrame(() => {
        waterfall.updateGraduation();
        waterfall.drawClients();
      });
      lastUpdated = events.getLastModified();
    }
  }

  // Tune to the frequency when clicked
  let frequencyMarkerComponent;
  async function handleFrequencyMarkerClick(event) {
    const targetHz = Number(event.detail.frequency) || 0;

    // First sync the actual tuned/input frequency so any follow-up logic that
    // reads frequencyInputComponent sees the NEW dial immediately, not the
    // previous one.
    frequencyInputComponent.setFrequency(targetHz);

    // Keep the shared UI frequency state aligned before band refresh.
    frequency = Math.max(0, targetHz / 1e3).toFixed(3);

    // Force the band button state from the clicked marker frequency itself,
    // without waiting for any other click path or waterfall-side refresh.
    syncBandButtonToFrequency(targetHz);
    await tick();

    // Now retune passband / waterfall / band selector using the new frequency.
    handleFrequencyChange({
      detail: targetHz,
      markerclick: true,
    });

    // Finally apply the marker's requested mode — unless a decoder owns the
    // receiver, in which case the marker is a tuning shortcut only and the
    // decoder keeps its mode and passband.
    if (_decoderOwnsReceiver()) {
      _decoderReassertReceiver();
    } else {
      SetMode(event.detail.modulation);
    }

    // Re-assert band selection once more after mode-change side effects.
    syncBandButtonToFrequency(targetHz);
    await tick();
    updateBandButton();
    //demodulation = event.detail.modulation;
    //handleDemodulationChange();
  }

  // Permalink handling
  function updateLink() {
    const linkObj = {
      frequency: frequencyInputComponent.getFrequency().toFixed(0),
      modulation: demodulation,
    };
    frequency = (frequencyInputComponent.getFrequency() / 1e3).toFixed(3);
    const linkQuery = constructLink(linkObj);
    link = `${location.origin}${location.pathname}?${linkQuery}`;
    storeInLocalStorage(linkObj);

    // Keep the address bar on the current tuning.  parseLink() already reads
    // ?frequency/&modulation on load (see onMount), so this is what makes a
    // reload — or a bookmark of the page as it stands — come back to the same
    // frequency instead of the receiver default.  replaceState, not pushState:
    // every nudge of the tuning would otherwise become a history entry and the
    // back button would walk backwards through the dial.
    //
    // ?desktop=1 must survive, or reloading the desktop view on a phone would
    // drop back to the mobile layout (the flag is read by the inline script in
    // frontend/index.html).
    try {
      const q = new URLSearchParams(location.search);
      q.set("frequency", linkObj.frequency);
      q.set("modulation", linkObj.modulation);
      history.replaceState(null, "", `${location.pathname}?${q}`);
    } catch (e) {
      // History API unavailable — tuning is unaffected.
    }
  }

  // Link to the simplified /mobile page, carrying the current tuning so that
  // page opens where this one is tuned.  Reactive on frequency (a kHz string
  // refreshed by updateLink) and demodulation, so the href never goes stale.
  $: mobilePageHref = (() => {
    const hz = Math.round(parseFloat(frequency) * 1000);
    if (!Number.isFinite(hz)) return "/mobile";
    // AM + samEnabled is what that page calls SAM; sending plain "AM" would
    // silently drop the synchronous detector on the way over.
    const m = demodulation === "AM" && samEnabled ? "SAM" : demodulation;
    return `/mobile?frequency=${hz}&modulation=${encodeURIComponent(m)}`;
  })();
  function handleLinkCopyClick() {
    copy(link);
  }

  let bookmarks = writable([]);
  let newBookmarkName = "";
  let newBookmarkLabel = "";

  let messages = writable([]);
  let newMessage = "";
  let showEmojiPicker = false;
  // Load the ~140 KB emoji-picker-element chunk on demand, only when the
  // user first opens the picker, so it stays out of the initial bundle.
  async function toggleEmojiPicker() {
    if (!showEmojiPicker) {
      await import("emoji-picker-element");
    }
    showEmojiPicker = !showEmojiPicker;
  }
  let socket;

  let username = `user${Math.floor(Math.random() * 10000)}`;
  let showUsernameInput = false;

  function saveUsername() {
    localStorage.setItem("chatusername", username);
    showUsernameInput = false;
    sendUserID(username);
    if (_myId) waterfall.setClients(waterfall.clients, _myId, username);
    waterfall.setClientGeo(_clientGeoMap);
    requestAnimationFrame(() => waterfall.drawClients());
  }

  function editUsername() {
    showUsernameInput = true;
  }

  const formatMessage = (text) => {
    const now = new Date();
    return `${username}: ${text.substring(0, 500)}`; // Ensure message is capped at 25 chars
  };

  function addBookmark() {
    const [currentWaterfallL, currentWaterfallR] =
      waterfall.getWaterfallRange();

    const bookmark = {
      name: newBookmarkName,
      label: newBookmarkLabel,
      link: link,
      frequency: frequencyInputComponent.getFrequency(),
      demodulation: demodulation,
      // This section was added to store more settings in the bookmark //
      volume: volume,
      squelch: squelch,
      squelchEnable: squelchEnable,
      audioBufferDelay: audioBufferDelay,
      audioBufferDelayEnabled: audioBufferDelayEnabled,
      NREnabled: NREnabled,
      ANEnabled: ANEnabled,
      NBEnabled: NBEnabled,
      NSEnabled: NSEnabled,
      CTCSSSupressEnabled: CTCSSSupressEnabled,
      currentTuneStep: currentTuneStep,
      min_waterfall: min_waterfall,
      max_waterfall: max_waterfall,
      brightness: brightness,
      currentWaterfallR: currentWaterfallR,
      currentWaterfallL: currentWaterfallL,
      currentColormap: currentColormap,
      waterfallDisplay: waterfallDisplay,
      spectrumDisplay: spectrumDisplay,
      currentBandwidth: currentBandwidth,
      staticBandwidthEnabled: staticBandwidthEnabled,
    };

    frequency = (frequencyInputComponent.getFrequency() / 1e3).toFixed(3);
    bookmarks.update((currentBookmarks) => {
      const updatedBookmarks = [...currentBookmarks, bookmark];
      localStorage.setItem("bookmarks", JSON.stringify(updatedBookmarks));
      return updatedBookmarks;
    });
    newBookmarkName = "";
    newBookmarkLabel = "";
  }

  function goToBookmark(bookmark) {
    // Set frequency
    frequencyInputComponent.setFrequency(bookmark.frequency);
    handleFrequencyChange({ detail: bookmark.frequency });

    // Set demodulation
    demodulation = bookmark.demodulation;
    handleDemodulationChange(null, true);

    // This next section was added to restore more //
    // settings in a bookmark.

    // Set Volume
    volume = bookmark.volume;
    handleVolumeChange();

    // Set Squelch
    audio.setSquelch(false);
    squelch = bookmark.squelch;
    squelchEnable = bookmark.squelchEnable;
    audio.setSquelch(squelchEnable);
    audio.setSquelchThreshold(squelch);

    // Begin code to store and restore additional //
    // WebSDR settings.
    // Set Audio Buffer
    // Applying, not just displaying: this used to set the variable and stop,
    // so the slider jumped to the bookmarked value while the engine carried on
    // with whatever it had. handleAudioBufferDelayMove sets both fields itself.
    if (bookmark.audioBufferDelayEnabled) {
      handleAudioBufferDelayMove(bookmark.audioBufferDelay);
    } else {
      handleAudioBufferDelayMove(1);
    }

    // Set Noise Reduction
    applyNoiseReduction(false);
    NREnabled = bookmark.NREnabled;
    applyNoiseReduction(NREnabled);

    // Set Noise Blanker (this also restores the hum notches, which follow NB —
    // restoring a bookmark used to leave them wherever they happened to be)
    applyNoiseBlanker(false);
    NBEnabled = bookmark.NBEnabled;
    applyNoiseBlanker(NBEnabled);

    // Set Background Noise Suppression
    NSEnabled = !!bookmark.NSEnabled;
    if (audio && typeof audio.setBackgroundNoiseSuppression === "function") {
      audio.setBackgroundNoiseSuppression(NSEnabled);
    }

    // Set Auto Notch
    applyAutoNotch(false);
    ANEnabled = bookmark.ANEnabled;
    applyAutoNotch(ANEnabled);

    // Set CTCSS
    CTCSSSupressEnabled = false;
    audio.setCTCSSFilter(CTCSSSupressEnabled);
    CTCSSSupressEnabled = bookmark.CTCSSSupressEnabled;
    audio.setCTCSSFilter(CTCSSSupressEnabled);

    // Set bandwidth
    if (bookmark.staticBandwidthEnabled) {
      handleSetStaticBandwidth(bookmark.currentBandwidth, false);
      staticBandwidthEnabled = bookmark.staticBandwidthEnabled;
      currentBandwidth = bookmark.currentBandwidth;
    }

    // Set Tuning Step
    currentTuneStep = bookmark.currentTuneStep;
    handleTuningStep(currentTuneStep);
    // Set Waterfall brightness
    min_waterfall = bookmark.min_waterfall;
    max_waterfall = bookmark.max_waterfall;
    brightness = bookmark.brightness;
    handleMinMove();
    handleMaxMove();
    handleBrightnessMove();

    // Set Waterfall Display
    waterfallDisplay = !bookmark.waterfallDisplay;
    handleWaterfallChange();

    // Set Spectrum Display
    spectrumDisplay = !bookmark.spectrumDisplay;
    handleSpectrumChange();

    // Set Waterfall Size
    let [l, m, r] = audio.getAudioRange();
    const [waterfallL, waterfallR] = waterfall.getWaterfallRange();
    const offset =
      ((m - waterfallL) / (waterfallR - waterfallL)) * waterfall.canvasWidth;
    m = Math.min(waterfall.waterfallMaxSize - 512, Math.max(512, m));
    l = bookmark.currentWaterfallL;
    r = bookmark.currentWaterfallR;
    waterfall.setWaterfallRange(l, r);
    frequencyMarkerComponent.updateFrequencyMarkerPositions();
    updatePassband();

    // Set Waterfall Colormap
    currentColormap = bookmark.currentColormap;
    waterfall.setColormap(currentColormap);

    // Update the link
    updateLink();
  }

  function copyToClipboard(text) {
    try {
      navigator.clipboard.writeText(text).then(() => {
        console.log("Text copied to clipboard!");
      });
    } catch (err) {
      console.error("Clipboard write failed", err);
    }
  }

  function deleteBookmark(index) {
    bookmarks.update((currentBookmarks) => {
      const updatedBookmarks = currentBookmarks.filter((_, i) => i !== index);
      saveBookmarks(updatedBookmarks);
      return updatedBookmarks;
    });
  }

  function saveBookmarks(bookmarksToSave) {
    localStorage.setItem("bookmarks", JSON.stringify(bookmarksToSave));
  }

  // amkbookmarks

  // UPLOAD BOOKMARKS

  let file;
  let fileInput;

  // Function to handle the reading of the JSON or CSV file
  function uploadBookmarks() {
    const file = fileInput.files[0]; // Get the selected file
    if (!file) {
      alert("Please select a file.");
      return;
    }

    const fileExtension = file.name.split(".").pop().toLowerCase();
    if (fileExtension === "json") {
      // If the file is a JSON
      processJSON(file);
    } else if (fileExtension === "csv") {
      // If the file is a CSV
      processCSV(file);
    } else {
      alert("Please select a JSON or CSV file.");
    }
  }

  // Function to process JSON files
  function processJSON(file) {
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const uploadedBookmarks = JSON.parse(event.target.result);
        console.log("Uploaded JSON Bookmarks:", uploadedBookmarks);

        const defaultLink = link || "http://default-server.com"; // Example
        const url = new URL(defaultLink);
        const extractedLink = url.hostname;
        const extractedPort = url.port || "9003"; // Example

        console.log("Extracted Link:", extractedLink);
        console.log("Extracted Port:", extractedPort);

        const updatedBookmarks = uploadedBookmarks.map((bookmark) => {
          if (bookmark.link) {
            const bookmarkUrl = new URL(bookmark.link);
            const link_to_be_checked = bookmarkUrl.hostname;
            if (extractedLink !== link_to_be_checked) {
              bookmarkUrl.hostname = extractedLink;
              bookmarkUrl.port = extractedPort;
              bookmark.link = bookmarkUrl.toString();

              bookmark.currentWaterfallR =
                waterfall.waterfallMaxSize.toString();
              bookmark.currentWaterfallL = "1".toString();
            }
          }

          return bookmark;
        });

        let existingBookmarks = [];
        try {
          existingBookmarks =
            JSON.parse(localStorage.getItem("bookmarks")) || [];
        } catch (e) {
          existingBookmarks = [];
        }
        const finalBookmarks = [...existingBookmarks, ...updatedBookmarks];
        localStorage.setItem("bookmarks", JSON.stringify(finalBookmarks));

        console.log("Final Updated Bookmarks:", finalBookmarks);
        //alert("The Bookmarks have been uploaded and saved successfully. Please reload the webpage!");
      } catch (error) {
        alert("Error reading the file.");
      }
    };

    reader.readAsText(file);
  }

  // Function to process CSV files
  function processCSV(file) {
    const rightEdge = waterfall.waterfallMaxSize;
    const reader = new FileReader();
    const defaultLink = link || "http://default-server.com"; // Example
    const url = new URL(defaultLink);
    const extractedLink = url.hostname;
    const extractedPort = url.port || "9003"; // Example

    reader.onload = (event) => {
      try {
        const csvData = event.target.result;
        // Split by LF (Line Feed) to separate rows in the CSV
        const rows = csvData.split("\n").filter((row) => row.trim() !== ""); // Split by LF
        console.log("Raw CSV data after splitting by LF:", rows);
        // Skip the header row manually, as it's the first line
        rows.shift();
        console.log("Raw CSV data after stripping the header:", rows);

        const bookmarksFromCSV = rows.map((row) => {
          const columns = row.split(","); // Split by comma for columns
          //        console.log("Column CSV data after splitting by commas:", columns);

          // Extract necessary fields (freq, mode, label)
          const frequency = parseFloat(columns[0].trim() * 1000);
          const mode = columns[2].trim();
          const name = columns[3].trim(); // Using label as name
          //        console.log("name:", name);
          return {
            name: name || frequency, // Default name if label is empty
            link: `http://${extractedLink}:${extractedPort}/?frequency=${frequency}&modulation=${mode}`,
            frequency: frequency,
            demodulation: mode,
            volume: 50, // default
            squelch: -50, // default
            audioBufferDelay: 1, // default
            audioBufferDelayEnabled: false, // default
            NREnabled: false, // default
            ANEnabled: false, // default
            NBEnabled: false, // default
            NSEnabled: false, // default
            CTCSSSupressEnabled: false, // default
            currentTuneStep: 9000, // default
            min_waterfall: -30, // default
            max_waterfall: 110, // default
            brightness: 130, // default
            currentWaterfallR: rightEdge, // default
            currentWaterfallL: 1, // default
            currentColormap: "custom", // default
            waterfallDisplay: true, // default
            spectrumDisplay: true, // default
            currentBandwidth: 0, // default
            staticBandwidthEnabled: false, // default
          };
        });
        console.log("bookmarksFromCSV:", bookmarksFromCSV);
        // Merge the bookmarks from the CSV with existing ones
        let existingBookmarks = [];
        try {
          existingBookmarks =
            JSON.parse(localStorage.getItem("bookmarks")) || [];
        } catch (e) {
          existingBookmarks = [];
        }
        const finalBookmarks = [...existingBookmarks, ...bookmarksFromCSV];
        localStorage.setItem("bookmarks", JSON.stringify(finalBookmarks));

        console.log("Final Updated Bookmarks from CSV:", finalBookmarks);
        //alert("The Bookmarks from CSV have been uploaded and saved successfully. Please reload the webpage!");
      } catch (error) {
        alert("Error reading the CSV file.");
      }
    };

    reader.readAsText(file);
  }

  // END OF UPLOAD BOOKMARKS

  // DOWNLOADLOAD BOOKMARKS

  function downloadBookmarks() {
    const storedBookmarks = localStorage.getItem("bookmarks");
    const jsonFile = storedBookmarks;

    // Create a timestamp for the bookmark file to be saved //
    const bookmarkDate = new Date();
    const bookmarkYear = bookmarkDate.getFullYear();
    const bookmarkMonth = bookmarkDate.getMonth() + 1;
    const bookmarkDay = bookmarkDate.getDate();
    //
    const bookmarkHour = bookmarkDate.getHours();
    const bookmarkMinute = bookmarkDate.getMinutes();
    const bookmarkSeconds = bookmarkDate.getSeconds();
    //
    const bookmarkFullDate =
      bookmarkYear + "-" + bookmarkDay + "-" + bookmarkMonth;
    const bookmarkTime =
      bookmarkHour + "-" + bookmarkMinute + "-" + bookmarkSeconds;
    const timeStamp = bookmarkFullDate + "_" + bookmarkTime;
    // Create download link
    const url = URL.createObjectURL(
      new Blob([jsonFile], { type: "JSON/json" }),
    );
    const a = document.createElement("a");
    document.body.appendChild(a);
    a.style.display = "none";
    a.href = url;
    a.download = "bookmarks_" + timeStamp + "_.json";
    a.click();
    window.URL.revokeObjectURL(url);
  }

  // END OF DOWNLOADLOAD BOOKMARKS

  //end of amkbookmarks

  let showBookmarkPopup,
    showModePopup,
    showBandPopup,
    showIFPopup = false;

  function toggleBookmarkPopup() {
    showBookmarkPopup = !showBookmarkPopup;
  }

  function toggleModePopup() {
    showModePopup = !showModePopup;
  }

  function toggleBandPopup() {
    showBandPopup = !showBandPopup;
  }

  function toggleIFPopup() {
    showIFPopup = !showIFPopup;
    if (showIFPopup) refreshIFSlider();
  }

  function toggleVFO() {
    const [waterfallL, waterfallR] = waterfall.getWaterfallRange();
    if (initialVFOB) {
      initialVFOB = false;
      vfoBMode = demodulation;
      vfoBwaterfallL = waterfallL;
      vfoBwaterfallR = waterfallR;
      vfoBStep = currentTuneStep;
      vfoBFrequency = frequencyInputComponent.getFrequency();
    }
    if (vfoModeA) {
      vfo = "VFO B";
      vfoAFrequency = frequency * 1000;
      vfoAMode = demodulation;
      vfoAwaterfallL = waterfallL;
      vfoAwaterfallR = waterfallR;
      vfoAStep = currentTuneStep;
      SetMode(vfoBMode);
      waterfall.setWaterfallRange(vfoBwaterfallL, vfoBwaterfallR);
      frequencyInputComponent.setFrequency(vfoBFrequency);
      handleFrequencyChange({ detail: vfoBFrequency });
      frequencyMarkerComponent.updateFrequencyMarkerPositions();
      updatePassband();
      //      handleBandChangePopup(currentBand)
      min_waterfall = parseInt(bandArray[currentBand].min);
      max_waterfall = parseInt(bandArray[currentBand].max);
      handleMinMove();
      handleMaxMove();
      ////      updateBandButton();
    }
    if (!vfoModeA) {
      vfo = "VFO A";
      vfoBFrequency = frequency * 1000;
      vfoBMode = demodulation;
      vfoBwaterfallL = waterfallL;
      vfoBwaterfallR = waterfallR;
      vfoBStep = currentTuneStep;
      handleTuningStep(vfoAStep);
      SetMode(vfoAMode);
      waterfall.setWaterfallRange(vfoAwaterfallL, vfoAwaterfallR);
      frequencyInputComponent.setFrequency(vfoAFrequency);
      handleFrequencyChange({ detail: vfoAFrequency });
      frequencyMarkerComponent.updateFrequencyMarkerPositions();
      updatePassband();
      //      handleBandChangePopup(currentBand)
      min_waterfall = parseInt(bandArray[currentBand].min);
      max_waterfall = parseInt(bandArray[currentBand].max);
      handleMinMove();
      handleMaxMove();
    }
    vfoModeA = !vfoModeA;
    handleFineTuningStep(0); // Needed for a waterfall bug //
  }

  let backendPromise;
  // Set when the server turns this session away because the address is over
  // its per-IP limit. Nothing is retried in that case (see audio.js), so the
  // page has to say why instead of sitting half-initialised forever.
  let connectionRefused = "";
  onMount(async () => {
    // The audio socket ending mid-session — a kick, the server stopping, the
    // network going — is the end of this session: nothing reopens it. The
    // waterfall's own socket is already gone with it, so all that is left is
    // to stop its draw loop. Deliberately no message: the page simply stops,
    // and whoever wants back in loads it again.
    audio.onConnectionChange = (state) => {
      if (state === "connected") return;
      try { waterfall.stop(); } catch (e) {}
    };
    loadWaterfallDirection();
    startTopFrequencyBarSync();
    waterfall.initCanvas({
      canvasElem: waterfallCanvas,
      spectrumCanvasElem: spectrumCanvas,
      graduationCanvasElem: graduationCanvas,
      bandPlanCanvasElem: bandPlanCanvas,
      clientsCanvasElem: clientsCanvas,
      tempCanvasElem: tempCanvas,
    });

    // Apply initial spectrum state so waterfall height matches (50% when spectrum on)
    waterfall.setSpectrum(spectrumDisplay, Device.isMobile);
    // Spectrum on -> reverse waterfall on; off -> normal
    waterfallReverse = spectrumDisplay;

    // Load username before init so server gets it on first connection
    username = localStorage.getItem("chatusername") || "";
    if (!username) username = "user" + Math.floor(Math.random() * 10000);
    sendUserID(username);
    backendPromise = init(username);

    try {
      await backendPromise;
    } catch (e) {
      if (e instanceof ConnectionRefused) {
        connectionRefused = e.reason || e.message;
        return; // buttons stay disabled: there is no receiver to drive
      }
      throw e;
    }

    // Start geo label polling for waterfall client pills
    await _fetchClientGeo();
    setInterval(_fetchClientGeo, 5000);

    waterfall.setFrequencyMarkerComponent(frequencyMarkerComponent);

    // Apply client-side DSP settings after audio is ready
    applyNoiseGatePreset();
    waterfall.setFrequencyMarkerComponent(frequencyMarkerComponent);

    // Enable after connection established
    [
      ...document.getElementsByTagName("button"),
      ...document.getElementsByTagName("input"),
    ].forEach((element) => {
      element.disabled = false;
    });

    // Enable WBFM option if bandwidth is wide enough
    if (audio.trueAudioSps > 170000) {
      demodulators.push("WBFM");
      demodulators = demodulators;
    }

    frequencyInputComponent.setFrequency(
      FFTOffsetToFrequency(audio.getAudioRange()[1]),
    );
    frequencyInputComponent.updateFrequencyLimits(
      audio.baseFreq,
      audio.baseFreq + audio.totalBandwidth,
    );

    showUsernameInput = !username;

    demodulation = audio.settings.defaults.modulation;

    const updateParameters = (linkParameters) => {
      frequencyInputComponent.setFrequency(linkParameters.frequency);
      if (frequencyInputComponent.getFrequency() === linkParameters.frequency) {
        handleFrequencyChange({ detail: linkParameters.frequency });
      }

      // Mode on arrival, same rule tuneToUserFrequency() uses: an explicit,
      // selectable mode wins, otherwise the band plan in bands-config.js
      // decides — never the startup default.  Without the fallback, arriving
      // from /mobile in a mode this page has no equivalent for (RADEL, RADEU)
      // left a broadcast frequency sitting in USB.
      //
      // 'SAM' is the /mobile page's name for AM with the synchronous
      // detector, which here is demodulation AM plus samEnabled.
      const wantsSam = linkParameters.modulation === "SAM";
      const asked = wantsSam ? "AM" : linkParameters.modulation;
      const usable = demodulators.indexOf(asked) !== -1 ? asked : null;
      if (usable) {
        samEnabled = wantsSam;
        demodulation = usable;
        handleDemodulationChange({}, true);
      } else if (linkParameters.frequency !== undefined) {
        // _bandDefaultMode() reads `frequency` (kHz), which the
        // handleFrequencyChange above has already moved to the new position.
        samEnabled = false;
        demodulation = _bandDefaultMode();
        handleDemodulationChange({}, true);
      }
      frequencyMarkerComponent.updateFrequencyMarkerPositions();
    };

    /* const storageParameters = loadFromLocalStorage()
    updateParameters(storageParameters) */
    const linkParameters = parseLink(location.search.slice(1));
    updateParameters(linkParameters);

    // Refresh all the controls to the initial value
    updatePassband();
    passbandTunerComponent.updatePassbandLimits();
    //handleWaterfallColormapSelect();
    initializeColormap();
    handleDemodulationChange({}, true);
    // Apply the spectrum default WITHOUT toggling, so a hard refresh honors the
    // default "spectrum on" state (handleSpectrumChange would invert it).
    // Height (50%) and reverse-waterfall follow from setSpectrum + this flag.
    waterfall.setSpectrum(spectrumDisplay, Device.isMobile);
    waterfallReverse = spectrumDisplay;
    handleVolumeChange();
    // Push the buffer setting into the engine too. Without this the control
    // showed a value that had never been applied, and on a handset the x2
    // default above would not have taken effect at all.
    handleAudioBufferDelayMove(audioBufferDelay);
    updateLink();

    // CAT sync over TCI: see ./lib/catsync.js and startCatSync().
    loadCatSyncPreferences();
    catSyncHandle = startCatSync();

    userId = generateUniqueId();
    let [l, m, r] = audio.getAudioRange().map(FFTOffsetToFrequency);

    const storedBookmarks = localStorage.getItem("bookmarks");
    if (storedBookmarks) {
      try {
        bookmarks.set(JSON.parse(storedBookmarks));
      } catch (e) {
        bookmarks.set([]);
      }
    }

    updateInterval = setInterval(() => requestAnimationFrame(updateTick), 200);
    _smeterTick();

    window["spectrumAudio"] = audio;
    window["spectrumWaterfall"] = waterfall;

    socket = new WebSocket(
      window.location.origin.replace(/^http/, "ws") + "/chat",
    );

    chatContentDiv = document.getElementById("chat_content");

    socket.onmessage = (event) => {
      const _data = event.data.trim();

      if (_data.startsWith("Chat history:")) {
        // ── Initial history load ──────────────────────────────────────────
        const history = _data.replace("Chat history:\n", "").trim();
        if (history) {
          const historyMessages = history.split("\n").map((line, index) => ({
            id: Date.now() + index,
            text: line.trim(),
            isCurrentUser: line.includes(` ${username}: `),
            timestamp: Date.now() - (history.length - index) * 1000,
          }));
          messages.set(historyMessages);
        }
      } else if (_data.startsWith("__CHAT_DELETE__:")) {
        // ── Admin deleted a message — remove it from the list instantly ───
        // Backend broadcasts: __CHAT_DELETE__:2026-05-25 20:41:18 SV1BTL: test
        const toDelete = _data.slice("__CHAT_DELETE__:".length).trim();
        messages.update((cur) => cur.filter((m) => m.text !== toDelete));
        // No scrollToBottom — list just shrinks silently
      } else {
        // ── New chat message ──────────────────────────────────────────────
        const receivedMessageObject = {
          id: Date.now(),
          text: _data,
          isCurrentUser: _data.includes(` ${username}: `),
          timestamp: Date.now(),
        };
        messages.update((currentMessages) => [
          ...currentMessages,
          receivedMessageObject,
        ]);
        scrollToBottom();
      }
    };

    const middleColumn = document.getElementById("middle-column");
    const chatBox = document.getElementById("chat-box");

    function setWidth() {
      if (!middleColumn) return;
      const width = middleColumn.offsetWidth;
      if (!Number.isFinite(width) || width <= 0) return;
      document.documentElement.style.setProperty(
        "--middle-column-width",
        `1380px`,
      );
    }

    setWidth();
    // Keep a component-scoped reference: setWidth is local to this async
    // onMount closure, so onDestroy cannot see it by name.
    _resizeHandler = setWidth;
    window.addEventListener("resize", setWidth);

    const unsubscribeFrequencyClick = eventBus.subscribe(
      "frequencyClick",
      ({ frequency, mode }) => {
        handleFrequencyClick(frequency, mode);
      },
    );

    const unsubscribeFrequencyChange = eventBus.subscribe(
      "frequencyChange",
      (event) => {
        frequencyInputComponent.setFrequency(event.detail);
        frequency = (event.detail / 1e3).toFixed(3);
        handleFrequencyChange(event);
      },
    );

    const unsubscribeSetMode = eventBus.subscribe("setMode", (mode) => {
      // The band segment's mode from bands-config.js. A running decoder owns
      // the receiver, so this loses to it until the decoder is switched off —
      // see _decoderReassertReceiver(). Mode buttons still work: those call
      // SetMode() directly and are a deliberate operator choice.
      if (_decoderOwnsReceiver()) return;
      // A frequency from the rig over TCI keeps the rig's mode, not the band's.
      if (catApplyingRemoteFreq) return;
      SetMode(mode);
    });

    eventBusUnsubscribers = [
      unsubscribeFrequencyClick,
      unsubscribeFrequencyChange,
      unsubscribeSetMode,
    ].filter((fn) => typeof fn === "function");

    // =========================================================
    // CATsync API — installed after backend is ready
    // =========================================================

    // Public getters/setters (clean API for external tools)
    window.catsync_getFrequency = function () {
      if (!frequencyInputComponent || !frequencyInputComponent.getFrequency)
        return null;
      return frequencyInputComponent.getFrequency(); // Hz
    };

    window.catsync_getMode = function () {
      return demodulation || null; // "USB", "LSB", ...
    };

    window.catsync_setFrequency = function (hz) {
      var f = Number(hz);
      if (!isFinite(f)) return false;
      if (!frequencyInputComponent || !frequencyInputComponent.setFrequency)
        return false;
      frequencyInputComponent.setFrequency(Math.round(f));
      // handleFrequencyChange reports the change to the CATsync Tool itself.
      handleFrequencyChange({ detail: Math.round(f) });
      return true;
    };

    window.catsync_setMode = function (mode) {
      var m = catsyncModeFromTool(mode);
      if (!m) return false;
      // SetMode -> handleDemodulationChange reports the change itself.
      SetMode(m);
      return true;
    };

    // Filter width, in Hz: the whole passband, low edge to high edge.
    // Setting it keeps the passband anchored the way the IF filter buttons
    // do (USB grows up, LSB grows down, the rest symmetrically). Call it
    // after catsync_setMode, which resets the passband to the mode default.
    window.catsync_getBandwidth = function () {
      if (!audio || !audio.getAudioRange) return null;
      const [l, , r] = audio.getAudioRange().map(FFTOffsetToFrequency);
      return Math.round(r - l);
    };

    window.catsync_setBandwidth = function (hz) {
      var bw = Math.round(Number(hz));
      if (!isFinite(bw) || bw <= 0) return false;
      handleSetStaticBandwidth(bw, false);
      return true;
    };

    // Mute, for a controller that silences the receiver while its own
    // transceiver transmits. Goes through the mute button's state, so the
    // button shows it and the listener can still unmute by hand.
    window.catsync_getMute = function () {
      return mute;
    };

    window.catsync_setMute = function (on) {
      if (!!on !== mute) handleMuteChange();
      return true;
    };

    window.catsync_ready = true;
    catsyncPublish();

    // Twente WebSDR / KiwiSDR compatibility layer
    window.nominalfreq = function () {
      if (!frequencyInputComponent || !frequencyInputComponent.getFrequency)
        return null;
      return frequencyInputComponent.getFrequency() / 1000; // kHz
    };

    // These are the tool's commands, so they go through the same remote
    // implementations as freqset_complete and ext_set_mode.
    window.setfreq = function (f) {
      var x = Number(f);
      if (!isFinite(x)) return false;
      var hz = x < 1e6 ? Math.round(x * 1000) : Math.round(x);
      return window.__catsync_setfreq_impl(hz);
    };

    window.set_mode = function (m) {
      return window.__catsync_setmode_impl(m);
    };

    // What the CATsync Tool reads back.  It sees this page as a KiwiSDR, so
    // it reads the Kiwi getters - and they must report the receiver as it
    // really is, however the listener got there, not a copy that only some
    // tuning paths ever updated.
    window.ext_get_freq_kHz = function () {
      if (!frequencyInputComponent || !frequencyInputComponent.getFrequency)
        return null;
      return frequencyInputComponent.getFrequency() / 1000;
    };

    window.ext_get_mode = function () {
      return catsyncModeForTool(demodulation);
    };

    // Internal implementations called by the early index.html shim
    window.__catsync_setfreq_impl = function (hz) {
      if (!frequencyInputComponent || !frequencyInputComponent.setFrequency)
        return false;
      hz = Math.round(Number(hz));
      if (!isFinite(hz) || hz <= 0) return false;
      window.__catsync_state = window.__catsync_state || {
        hz: null,
        mode: null,
      };
      // A repeat of the tool's last command is its routine poll, not the rig
      // moving: leave the receiver where the listener has put it.
      const staleHz = hz === catsyncStaleHz && Date.now() < catsyncStaleUntil;
      if (hz === catsyncLastToolHz || staleHz) {
        // The tool wrote its repeat into the box; put the receiver's back.
        catsyncPublish();
        return true;
      }
      catsyncLastToolHz = hz;
      window.__catsync_state.hz = hz;
      if (frequencyInputComponent.getFrequency() === hz) {
        catsyncPublish();
        return true;
      }
      const modeBefore = demodulation;
      catsyncRemote++;
      try {
        frequencyInputComponent.setFrequency(hz);
        handleFrequencyChange({ detail: hz, __catsync_remote: true });
        // A retune can select the band's default mode.  The rig did not ask
        // for that - a KiwiSDR would keep its mode - and reporting it would
        // push the rig out of the mode it is in.  Put the mode back, unless a
        // running decoder owns the receiver.
        if (demodulation !== modeBefore && !_decoderOwnsReceiver()) {
          SetMode(modeBefore);
        }
      } finally {
        catsyncRemote--;
        catsyncPublish();
      }
      return true;
    };

    window.__catsync_setmode_impl = function (mode) {
      const m = catsyncModeFromTool(mode);
      if (!m) return false;
      window.__catsync_state = window.__catsync_state || {
        hz: null,
        mode: null,
      };
      // As for frequency: a repeated mode is the tool polling, not the rig.
      if (m === catsyncLastToolMode) return true;
      if (m === catsyncStaleMode && Date.now() < catsyncStaleUntil) return true;
      catsyncLastToolMode = m;
      window.__catsync_state.mode = m;
      if (demodulation === m) return true;
      catsyncRemote++;
      try {
        SetMode(m);
      } finally {
        catsyncRemote--;
      }
      return true;
    };

    // Flush any commands that arrived before Svelte finished loading
    var __catsync_q_snapshot = window.__catsync_q || [];
    while (__catsync_q_snapshot.length) {
      var __catsync_cmd = __catsync_q_snapshot.shift();
      if (__catsync_cmd.t === "freq")
        window.__catsync_setfreq_impl(__catsync_cmd.hz);
      if (__catsync_cmd.t === "mode")
        window.__catsync_setmode_impl(__catsync_cmd.mode);
    }

    document.addEventListener("click", handleEmojiOutsideClick);

    return () => {
      document.removeEventListener("click", handleEmojiOutsideClick);
      window.removeEventListener("resize", setWidth);
      eventBusUnsubscribers.forEach((unsubscribe) => {
        try {
          unsubscribe();
        } catch (e) {}
      });
      eventBusUnsubscribers = [];
    };
  });

  function emojiAction(node) {
    function onEmojiClick(e) {
      newMessage += e.detail.unicode;
      showEmojiPicker = false;
      const inp = document.getElementById("textInput");
      if (inp) inp.focus();
    }
    node.addEventListener("emoji-click", onEmojiClick);
    return {
      destroy() {
        node.removeEventListener("emoji-click", onEmojiClick);
      },
    };
  }

  function handleEmojiOutsideClick(e) {
    if (
      !e.target.closest(".emoji-picker-wrapper") &&
      !e.target.closest('button[title="Emoji"]')
    ) {
      showEmojiPicker = false;
    }
  }

  function sendMessage() {
    if (newMessage.trim() && username.trim()) {
      const messageObject = {
        cmd: "chat",
        message: newMessage.trim(),
        username: username,
      };
      socket.send(JSON.stringify(messageObject));
      newMessage = "";
      scrollToBottom();
    }
  }

  function stripText(s) {
    let badStrings = ["777", "chmod", ".sh", "chown", "tftp"];
    let fixedStrings = new RegExp("\\b(" + badStrings.join("|") + ")\\b", "g");
    return (s || "").replace(fixedStrings, "").replace(/[ ]{2,}/, " ");
  }

  function pasteFrequency() {
    const frequency = frequencyInputComponent.getFrequency();
    const currentDemodulation = demodulation;
    const frequencyText = `[FREQ:${Math.round(frequency)}:${currentDemodulation}]`;
    newMessage = newMessage + " " + frequencyText; // Append the frequency to the current message
  }

  function shareFrequency() {
    const frequency = frequencyInputComponent.getFrequency();
    const currentDemodulation = demodulation;
    const shareMessage = `[FREQ:${Math.round(frequency)}:${currentDemodulation}] Check out this frequency!`;
    const messageObject = {
      cmd: "chat",
      message: shareMessage,
      username: username,
    };
    socket.send(JSON.stringify(messageObject));
    scrollToBottom();
  }

  let chatMessages;

  function scrollToBottom() {
    if (chatMessages) {
      chatMessages.scrollTo({
        top: chatMessages.scrollHeight,
        behavior: "smooth",
      });
    }
  }

  $: {
    if ($messages) {
      setTimeout(scrollToBottom, 100);
    }
  }

  // Helper function to apply band settings for a frequency
  function applyBandSettingsForFrequency(frequencyHz) {
    // Find which band this frequency belongs to
    let targetBand = -1;
    const frequencyKhz = frequencyHz / 1000;

    for (let i = 0; i < bandArray.length; i++) {
      const band = bandArray[i];
      if (
        frequencyKhz >= band.startFreq / 1000 &&
        frequencyKhz <= band.endFreq / 1000 &&
        (band.ITU === siteRegion || band.ITU === 123)
      ) {
        targetBand = i;
        break;
      }
    }

    // If no band found, exit early
    if (targetBand < 0) {
      console.log(`No band settings found for ${frequencyHz} Hz`);
      return;
    }

    const band = bandArray[targetBand];
    console.log(
      `Applying settings for ${band.name}: min=${band.min}, max=${band.max}`,
    );

    // Disable auto-adjust if enabled (it will override manual settings)
    if (autoAdjustEnabled) {
      autoAdjustEnabled = false;
      waterfall.autoAdjust = false;
      storeWaterfallSettings = false;
    }

    // Set brightness values from band
    min_waterfall = parseInt(band.min);
    max_waterfall = parseInt(band.max);

    // Calculate zoom span for this band
    let waterfallEndSpan = parseFloat(
      band.endFreq / (waterfall.sps / waterfall.fftSize),
    );
    let waterfallStartSpan = parseFloat(
      band.startFreq / (waterfall.sps / waterfall.fftSize),
    );
    let waterfallSpan = (waterfallEndSpan - waterfallStartSpan) / 2;
    waterfallSpan = waterfallSpan + waterfallSpan * 0.01; // 1% margin

    // Get current audio parameters
    let [l, m, r] = audio.getAudioRange();

    // Center the view
    m = Math.min(waterfall.waterfallMaxSize - 512, Math.max(512, m));
    l = Math.floor(m - 512);
    r = Math.ceil(m + 512);

    // Apply brightness settings
    handleMinMove();
    handleMaxMove();

    // Apply zoom with band span
    l -= waterfallSpan;
    r += waterfallSpan;

    // Set the waterfall range (this actually changes the zoom)
    waterfall.setWaterfallRange(l, r);

    // Update UI elements
    frequencyMarkerComponent.updateFrequencyMarkerPositions();
    updatePassband();

    // Update tracking variables
    currentBand = targetBand;
    bandName = band.name;
    currentTuneStep = band.stepi;

    console.log(
      `✓ Band settings applied: zoom ${l}-${r}, brightness ${min_waterfall}/${max_waterfall}`,
    );
  }

  // Function to handle clicking on a shared frequency
  function handleFrequencyClick(frequency, mode) {
    const numericFrequency = parseInt(frequency, 10);
    if (isNaN(numericFrequency)) {
      console.error("Invalid frequency:", frequency);
      return;
    }

    console.log(`Frequency link: ${numericFrequency} Hz, mode: ${mode}`);

    // Set the frequency
    frequencyInputComponent.setFrequency(numericFrequency);
    handleFrequencyChange({ detail: numericFrequency });

    // Apply band-specific settings (brightness, zoom, etc.)
    applyBandSettingsForFrequency(numericFrequency);

    // Set mode AFTER band settings to override any auto-detection
    if (mode && mode !== "") {
      demodulation = mode;
      handleDemodulationChange(null, true);
      console.log(`✓ Mode set to ${mode}`);
    }

    // Update the link in the URL
    updateLink();
  }

  function sanitizeHtml(html) {
    const div = document.createElement("div");
    div.textContent = html;
    return div.innerHTML;
  }

  function formatFrequencyMessage(text) {
    const regex = /^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}) (.+?): (.+)$/;
    const match = text.match(regex);
    if (match) {
      const [_, timestamp, username, message] = match;
      const freqRegex = /\[FREQ:(\d+):([\w-]+)\]/;
      const freqMatch = message.match(freqRegex);
      if (freqMatch) {
        const [fullMatch, frequency, demodulation] = freqMatch;
        const [beforeFreq, afterFreq] = message
          .split(fullMatch)
          .map((part) => formatLinks(sanitizeHtml(part)));
        return {
          isFormatted: true,
          timestamp: sanitizeHtml(timestamp),
          username: sanitizeHtml(username),
          frequency: parseInt(frequency, 10),
          demodulation: sanitizeHtml(demodulation),
          beforeFreq,
          afterFreq,
        };
      }
      return {
        isFormatted: false,
        timestamp: sanitizeHtml(timestamp),
        username: sanitizeHtml(username),
        parts: formatLinks(sanitizeHtml(message)),
      };
    }
    return {
      isFormatted: false,
      parts: formatLinks(sanitizeHtml(text)),
    };
  }

  function formatLinks(text) {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = urlRegex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push({
          type: "text",
          content: text.slice(lastIndex, match.index),
        });
      }
      parts.push({ type: "link", content: match[0], url: match[0] });
      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < text.length) {
      parts.push({ type: "text", content: text.slice(lastIndex) });
    }

    return parts;
  }

  function renderParts(parts) {
    return parts
      .map((part) => {
        if (part.type === "link") {
          return `<a href="${sanitizeHtml(part.url)}" target="_blank" rel="noopener noreferrer" class="text-blue-400 hover:underline">${sanitizeHtml(part.content)}</a>`;
        }
        return part.content;
      })
      .join("");
  }

  onDestroy(() => {
    // The resize listener leaked: the cleanup used to live in the `return`
    // at the end of the async onMount block, and an async onMount returns a
    // Promise, so Svelte never calls it.  Moving it here was right, but
    // `setWidth` is scoped to that closure — naming it here threw a
    // ReferenceError that aborted the whole teardown below.  Use the
    // component-scoped handle instead.
    if (_resizeHandler) window.removeEventListener("resize", _resizeHandler);
    // Stop everything
    clearInterval(updateInterval);
    if (_smeterRaf) cancelAnimationFrame(_smeterRaf);
    stopTopFrequencyBarSync();
    try {
      if (audio && audio.stop) audio.stop();
    } catch (e) {}
    try {
      if (waterfall && waterfall.stop) waterfall.stop();
    } catch (e) {}
    try {
      if (socket && socket.close) socket.close();
    } catch (e) {}
    // Stop DX cluster auto-refresh
    if (dxRefreshInterval) clearInterval(dxRefreshInterval);
    dxRefreshInterval = null;
    if (dxVisibilityChangeHandler) {
      document.removeEventListener(
        "visibilitychange",
        dxVisibilityChangeHandler,
      );
      dxVisibilityChangeHandler = null;
    }
    eventBusUnsubscribers.forEach((unsubscribe) => {
      try {
        unsubscribe();
      } catch (e) {}
    });
    eventBusUnsubscribers = [];
  });

  // Start DX cluster widget after DOM is ready
  onMount(() => startDXCluster());

  // Added to allow the user to adjust the dynamic audio //
  // buffer limits in the playAudio(pcmArray) function inside //
  // audio.js - the variables inside audio.js to allow this adjustment //
  // are bufferLimit = 0.5 and bufferThreshold = 0.1 //
  function handleAudioBufferDelayMove(newAudioBufferDelay) {
    if (newAudioBufferDelay > 6) {
      newAudioBufferDelay = 1;
    }

    audioBufferDelay = newAudioBufferDelay;

    // The ladder starts at audio.js's own constructor defaults, so x1 means
    // exactly what the engine already does. It used to start at 0.5/0.1 while
    // nothing applied it at startup, so the control read x1 while the engine
    // sat at 0.25/0.01 — the display and the audio disagreed until the slider
    // was touched. Matching the two here is what makes applying it at startup
    // free of any latency cost.
    //
    // The second number is the cushion, and it is the whole margin the
    // playback path has against a late packet. 0.01 clamps up to 0.02 inside
    // setAudioBufferDelay, and 20 ms is fine on a cable and much too little on
    // a phone — which is why handsets start at x2, not x1. See the initial
    // value of audioBufferDelay.
    switch (audioBufferDelay) {
      case 1:
        // Tightest: the engine's own default. Wired connections.
        audioBufferDelayEnabled = false;
        audio.setAudioBufferDelay(0.25, 0.01);
        break;
      case 2:
        // Default for handsets. Rides out ordinary mobile jitter.
        audioBufferDelayEnabled = true;
        audio.setAudioBufferDelay(0.5, 0.1);
        break;
      case 3:
        // Low: good for fast but variable connections.
        audioBufferDelayEnabled = true;
        audio.setAudioBufferDelay(1.0, 0.2);
        break;
      case 4:
        // Medium: balanced.
        audioBufferDelayEnabled = true;
        audio.setAudioBufferDelay(1.5, 0.3);
        break;
      case 5:
        // High: poor connections.
        audioBufferDelayEnabled = true;
        audio.setAudioBufferDelay(2.0, 0.4);
        break;
      case 6:
        // Maximum: very unstable connections.
        audioBufferDelayEnabled = true;
        audio.setAudioBufferDelay(2.5, 0.5);
        break;
      default:
        audioBufferDelayEnabled = false;
        audio.setAudioBufferDelay(0.25, 0.01);
    }
  }

  // by sv2amkzoom
  // Added by sv2amk to allow the user to adjust the zoom //
  // with a button and a slider but in mobile version only //

  function handleZoomStepMove(e, newZoomStep) {
    if (newZoomStep > 8) {
      newZoomStep = 1;
    }
    zoomStep = newZoomStep;
    if (zoomStep === 1) {
      zoomStepEnabled = false;
    } else {
      zoomStepEnabled = true;
    }
    switch (zoomStep) {
      case 1:
        handleWaterfallMagnify(e, "min");
        break;
      case 2:
        zwaterfallSpan = 16384;
        handleZoomStepMagnify();
        break;
      case 3:
        zwaterfallSpan = 8192;
        handleZoomStepMagnify();
        break;
      case 4:
        zwaterfallSpan = 4096;
        handleZoomStepMagnify();
        break;
      case 5:
        zwaterfallSpan = 2048;
        handleZoomStepMagnify();
        break;
      case 6:
        zwaterfallSpan = 1024;
        handleZoomStepMagnify();
        break;
      case 7:
        zwaterfallSpan = 512;
        handleZoomStepMagnify();
        break;
      case 8:
        zwaterfallSpan = 256;
        handleZoomStepMagnify();
        break;
      case 9:
        handleWaterfallMagnify(e, "min");
        for (var i = 0; i <= 5 * zoomStep; i++) {
          handleWaterfallMagnify(e, "+");
        }
        break;
    }
  }

  // by sv2amkzoom
  // This Band Selection function handles band changes sent from the Band Selection section of the main page //
  // The 7.15255 float below is (total_watefall_span / maximum_frequency_sampled) //
  function handleBandChangePopup(newBand) {
    let centerFreq = parseFloat(
      (bandArray[newBand].endFreq - bandArray[newBand].startFreq) / 2 +
        bandArray[newBand].startFreq,
    );
    let initFreq = parseFloat(bandArray[newBand].initFreq);
    min_waterfall = parseInt(bandArray[newBand].min);
    max_waterfall = parseInt(bandArray[newBand].max);

    let waterfallEndSpan = parseFloat(
      bandArray[newBand].endFreq / (waterfall.sps / waterfall.fftSize),
    );
    let waterfallStartSpan = parseFloat(
      bandArray[newBand].startFreq / (waterfall.sps / waterfall.fftSize),
    );
    let waterfallSpan = (waterfallEndSpan - waterfallStartSpan) / 2;
    waterfallSpan = waterfallSpan + waterfallSpan * 0.01; // 10% above band edge
    frequencyInputComponent.setFrequency(centerFreq);
    handleFrequencyChange({ detail: centerFreq });
    updatePassband();
    let [l, m, r] = audio.getAudioRange();
    const [waterfallL, waterfallR] = waterfall.getWaterfallRange();
    const offset =
      ((m - waterfallL) / (waterfallR - waterfallL)) * waterfall.canvasWidth;
    m = Math.min(waterfall.waterfallMaxSize - 512, Math.max(512, m));
    l = Math.floor(m - 512);
    r = Math.ceil(m + 512);
    // Below sets the waterfall brightness //
    //  min_waterfall = -30;
    //  max_waterfall = 110;
    handleMinMove();
    handleMaxMove();
    // End waterfall brightness //
    l -= waterfallSpan;
    r += waterfallSpan;

    if (initFreq) {
      centerFreq = initFreq;
    }

    frequencyInputComponent.setFrequency(centerFreq);
    handleFrequencyChange({ detail: centerFreq });
    waterfall.setWaterfallRange(l, r);
    frequencyMarkerComponent.updateFrequencyMarkerPositions();
    updatePassband();
    currentBand = newBand;
    setTimeout(function () {
      toggleBandPopup();
    }, 300);
  }
  // End of Band Selection Function //

  // by sv2amkzoom
  // This Band Selection function handles band changes sent from the Band Selection section of the main page //
  // The 7.15255 float below is (total_watefall_span / maximum_frequency_sampled) //
  function handleBandChange(newBand) {
    let centerFreq = parseFloat(
      (bandArray[newBand].endFreq - bandArray[newBand].startFreq) / 2 +
        bandArray[newBand].startFreq,
    );
    let initFreq = parseFloat(bandArray[newBand].initFreq);
    min_waterfall = parseInt(bandArray[newBand].min);
    max_waterfall = parseInt(bandArray[newBand].max);

    let waterfallEndSpan = parseFloat(
      bandArray[newBand].endFreq / (waterfall.sps / waterfall.fftSize),
    );
    let waterfallStartSpan = parseFloat(
      bandArray[newBand].startFreq / (waterfall.sps / waterfall.fftSize),
    );
    let waterfallSpan = (waterfallEndSpan - waterfallStartSpan) / 2;
    waterfallSpan = waterfallSpan + waterfallSpan * 0.01; // 10% above band edge
    frequencyInputComponent.setFrequency(centerFreq);
    handleFrequencyChange({ detail: centerFreq });
    updatePassband();
    let [l, m, r] = audio.getAudioRange();
    const [waterfallL, waterfallR] = waterfall.getWaterfallRange();
    const offset =
      ((m - waterfallL) / (waterfallR - waterfallL)) * waterfall.canvasWidth;
    m = Math.min(waterfall.waterfallMaxSize - 512, Math.max(512, m));
    l = Math.floor(m - 512);
    r = Math.ceil(m + 512);
    // Below sets the waterfall brightness //
    //  min_waterfall = -30;
    //  max_waterfall = 110;
    handleMinMove();
    handleMaxMove();
    // End waterfall brightness //
    l -= waterfallSpan;
    r += waterfallSpan;

    if (initFreq) {
      centerFreq = initFreq;
    }

    frequencyInputComponent.setFrequency(centerFreq);
    handleFrequencyChange({ detail: centerFreq });
    waterfall.setWaterfallRange(l, r);
    frequencyMarkerComponent.updateFrequencyMarkerPositions();
    updatePassband();
    currentBand = newBand;
  }
  // End of Band Selection Function //

  // This function by sv2amk handles the magnification of the waterfall //
  // according to the magnification factor -zwaterfallSpan- comming from the  //
  // handleZoomStepMove function -zoom slider-. It also handles brightness //
  // according to the currentBand. //

  function handleZoomStepMagnify() {
    min_waterfall = parseInt(bandArray[currentBand].min);
    max_waterfall = parseInt(bandArray[currentBand].max);
    let [l, m, r] = audio.getAudioRange();
    const [waterfallL, waterfallR] = waterfall.getWaterfallRange();
    const offset =
      ((m - waterfallL) / (waterfallR - waterfallL)) * waterfall.canvasWidth;
    m = Math.min(waterfall.waterfallMaxSize - 512, Math.max(512, m));
    l = Math.floor(m - zwaterfallSpan);
    r = Math.ceil(m + zwaterfallSpan);
    // Below sets the waterfall brightness //
    handleMinMove();
    handleMaxMove();
    // End waterfall brightness //
    waterfall.setWaterfallRange(l, r);
    frequencyMarkerComponent.updateFrequencyMarkerPositions();
    updatePassband();
  }

  // End of zoom slider magnification  Function by sv2amk//

  // Function to publish bandwidth buttons //
  let newBandwidth = [
    "500",
    "1800",
    "2400",
    "2700",
    "3000",
    "3500",
    "4000",
    "4500",
    "5000",
    "6000",
    "9000",
    "10000",
  ];
  let newStaticBandwidth = 0;
  // IF Filter bandwidth slider: per-side offset from the carrier/centre (Hz)
  let ifSlider = 0;
  let ifSliderMax = 6000; // refreshed on popup open (mode dependent)
  // showIFPopup=false is used by the bookmark restore path: the popup exists as
  // feedback for a human clicking a bandwidth button, not for a restore.
  function handleSetStaticBandwidth(newstaticbandwidth, showIFPopup = true) {
    let bwDiff = 0;
    currentBandwidth = bandwidth * 1000;
    if (newstaticbandwidth > currentBandwidth) {
      bwDiff = newstaticbandwidth - currentBandwidth;
    } else if (newstaticbandwidth < currentBandwidth) {
      bwDiff = newstaticbandwidth - currentBandwidth;
    } else {
      bwDiff = 0;
    }
    handleBandwidthOffsetClick(bwDiff);
    newStaticBandwidth = newstaticbandwidth; // This will update the IF Filter button //
    if (showIFPopup) {
      setTimeout(function () {
        toggleIFPopup();
      }, 300);
    }
  }

  // === IF Filter bandwidth slider ===
  // Which way the passband grows for the current mode:
  //   LSB -> "left", USB -> "right", everything else (AM/FM/CW...) -> "both"
  function ifSidebandDir() {
    const type = (demodulationDefaults[demodulation] || {}).type;
    if (type === "LSB") return "left";
    if (type === "USB") return "right";
    return "both";
  }

  // Apply new passband edges (l, m, r in Hz) reusing the audio-range machinery
  function applyIFEdges(l, m, r) {
    const audioParameters = [l, m, r].map(frequencyToFFTOffset);
    const audioParametersOffset = [l - 200, m - 750, r - 200].map(
      frequencyToFFTOffset,
    );
    audio.setAudioRange(...audioParameters, ...audioParametersOffset);
    updatePassband();
  }

  // Sync the slider position and its limit from the current passband
  function refreshIFSlider() {
    try {
      const max = getMaximumBandwidth();
      const dir = ifSidebandDir();
      if (max) ifSliderMax = Math.round(max);
      const [l, m, r] = audio.getAudioRange().map(FFTOffsetToFrequency);
      let d;
      if (dir === "left") d = m - l;
      else if (dir === "right") d = r - m;
      else d = r - l; // symmetric: slider shows the total width (up to ~12 kHz)
      ifSlider = Math.max(0, Math.min(ifSliderMax, Math.round(d)));
    } catch (e) {}
  }

  // Slider: grow the passband from the centre toward the active sideband
  function handleIFSlider() {
    const [, m] = audio.getAudioRange().map(FFTOffsetToFrequency);
    const dir = ifSidebandDir();
    const v = Math.max(0, Math.min(getMaximumBandwidth(), ifSlider));
    if (dir === "left") applyIFEdges(m - v, m, m);
    else if (dir === "right") applyIFEdges(m, m, m + v);
    else applyIFEdges(m - v / 2, m, m + v / 2); // symmetric: value = total width
  }

  // Reset the passband to the current mode's default offsets
  function resetIFFilter() {
    const [, m] = audio.getAudioRange().map(FFTOffsetToFrequency);
    const def = demodulationDefaults[demodulation];
    const offsets = def ? def.offsets : [2700, 2700];
    applyIFEdges(m - offsets[0], m, m + offsets[1]);
    newStaticBandwidth = 0; // clear the IF Filter preset highlight
    refreshIFSlider();
  }

  // Begin Fine Tuning Steps Function
  //Function created to create a fine tune button and modified by sv2amk //
  // for mobile users first Column top //
  let mobiletopfinetuningsteps = [
    "-1",
    "-0.1",
    "-0.01",
    "0",
    "+0.01",
    "+0.1",
    "+1",
  ];
  // For desktop users
  let finetuningsteps = [
    "-5",
    "-1",
    "-0.5",
    "-0.1",
    "-0.01",
    "0",
    "+0.01",
    "+0.1",
    "+0.5",
    "+1",
    "+5",
  ];

  function handleFineTuningStep(finetuningstep) {
    finetuningstep = parseFloat(finetuningstep) * 1e3;
    if (finetuningstep == 0) {
      frequency = Math.round(frequency);
    }
    frequencyInputComponent.setFrequency(frequency * 1e3 + finetuningstep);
    handleFrequencyChange({ detail: frequency * 1e3 + finetuningstep });
    updatePassband();
  }
  // End Fine Tuning Steps Function //

  // Begin Scanner Function
  //
  // The logic lives in scanner.js; this is only the wiring and the UI state it
  // publishes.  See that file for why the threshold is dB over the band noise
  // floor and why empty channels are screened out of the spectrum rather than
  // dwelt on.
  const scannerThresholds = THRESHOLDS_DB;
  const scannerResumeChoices = RESUME_CHOICES_MS;
  const scannerMaxStayChoices = MAX_STAY_CHOICES_MS;
  const scannerStayLabel = (ms) =>
    ms === 0 ? "Off" : ms >= 60000 ? `${ms / 60000} min` : `${ms / 1000} s`;
  const scannerSweepModes = SWEEP_MODES;
  const scannerRangeModes = RANGE_MODES;
  const scannerRangeLabel = { band: "Scan Band", visible: "Scan Visible" };
  const scannerRangeHint = {
    band: "Sweep the band the scan starts in, from the band plan",
    visible: "Sweep exactly what the waterfall is showing — zoom or drag it and the scan follows",
  };
  const scannerSweepLabel = { sweep: "Every channel", fast: "Skip empty" };
  const scannerSweepHint = {
    sweep: "The classic scan: every channel is tuned and listened to, so you see and hear it cross the band",
    fast: "Channels the spectrum places below the threshold are skipped without tuning — much faster, but the scan jumps signal to signal",
  };
  let showScannerThreshold = false;
  // Everything the scanner tells the UI, in one object so a single assignment
  // re-renders the row.
  let scan = {
    running: false,
    parked: false,
    dir: 1,
    cursorHz: null,
    sweepMode: "sweep",
    rangeMode: "band",
    loHz: null,
    hiHz: null,
    thresholdDb: 30,
    resumeMs: 3000,
    resumeInMs: null,
    maxStayMs: 0,
    stayLeftMs: null,
    snrDb: null,
    lockCount: 0,
    locked: false,
  };

  const scanner = createScanner({
    getFrequencyHz: () => Math.round((Number(frequency) || 0) * 1e3),
    getMode: () => demodulation,
    getRegion: () => siteRegion,
    getBands: () => bandArray,
    getAudio: () => audio,
    getWaterfall: () => waterfall,
    tune: (hz) => {
      try {
        if (frequencyInputComponent && frequencyInputComponent.setFrequency)
          frequencyInputComponent.setFrequency(hz);
      } catch (e) {}
      handleFrequencyChange({ detail: hz });
      updatePassband();
    },
    onState: (s) => {
      scan = s;
    },
  });

  // Shown in the arrow tooltips; re-read whenever the VFO or the mode moves.
  $: scannerStepKHz =
    scanner.stepAt(Math.round((Number(frequency) || 0) * 1e3), demodulation)
      .stepHz / 1000;

  const scannerResumeLabel = (ms) => (ms === 0 ? "Hold" : `${ms / 1000} s`);

  // Keep a popup panel on screen wherever its button happens to sit.  Anchored
  // absolutely it opened downwards from the Fine Tuning row and, on a short
  // window or with the row scrolled low, the bottom of it was simply off the
  // screen with no way to reach the entries.  Going `fixed` also frees it from
  // being clipped by any scrolling ancestor.  It is placed against the button,
  // flipped above when there is no room below, slid back inside when it would
  // run off an edge, and only then, as a last resort on a very short window,
  // allowed to scroll inside itself.
  function keepInView(node, opts) {
    const anchorSelector = opts.anchor;
    const onOutside = opts.onOutside;
    const GAP = 4;
    const MARGIN = 8;
    let frame = null;
    const place = () => {
      frame = null;
      const anchor =
        (node.parentElement &&
          node.parentElement.querySelector(anchorSelector)) ||
        node.parentElement;
      if (!anchor) return;
      const a = anchor.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      node.style.position = "fixed";
      node.style.maxHeight = "";
      const w = node.offsetWidth;
      let h = node.offsetHeight;
      const below = vh - a.bottom - GAP - MARGIN;
      const above = a.top - GAP - MARGIN;
      let top;
      if (h <= below || below >= above) {
        top = a.bottom + GAP;
        if (h > below) {
          node.style.maxHeight = Math.max(80, below) + "px";
          node.style.overflowY = "auto";
          h = node.offsetHeight;
        }
      } else {
        if (h > above) {
          node.style.maxHeight = Math.max(80, above) + "px";
          node.style.overflowY = "auto";
          h = node.offsetHeight;
        }
        top = a.top - h - GAP;
      }
      node.style.top =
        Math.min(Math.max(MARGIN, top), Math.max(MARGIN, vh - h - MARGIN)) +
        "px";
      // Right-aligned with the button, like the absolute version was.
      const left = a.right - w;
      node.style.left =
        Math.min(Math.max(MARGIN, left), Math.max(MARGIN, vw - w - MARGIN)) +
        "px";
      node.style.right = "auto";
    };
    const schedule = () => {
      if (frame == null) frame = requestAnimationFrame(place);
    };
    // Closing on an outside click is done with a document listener rather than
    // a full-screen catcher div.  The catcher swallowed the wheel: it is fixed,
    // so its scroll chain is the document, and this UI scrolls an inner
    // container — pointing at the catcher meant nothing scrolled at all while
    // the panel was open.  A listener blocks nothing.
    const outside = (e) => {
      if (node.contains(e.target)) return;
      const anchor =
        node.parentElement && node.parentElement.querySelector(anchorSelector);
      if (anchor && anchor.contains(e.target)) return; // its own toggle
      if (onOutside) onOutside();
    };
    const onKey = (e) => {
      if (e.key === "Escape" && onOutside) onOutside();
    };
    schedule();
    window.addEventListener("resize", schedule);
    window.addEventListener("scroll", schedule, true);
    document.addEventListener("pointerdown", outside, true);
    document.addEventListener("keydown", onKey);
    return {
      destroy() {
        if (frame != null) cancelAnimationFrame(frame);
        window.removeEventListener("resize", schedule);
        window.removeEventListener("scroll", schedule, true);
        document.removeEventListener("pointerdown", outside, true);
        document.removeEventListener("keydown", onKey);
      },
    };
  }

  onDestroy(() => scanner.destroy());
  // End Scanner Function //

  // Begin Tuning Steps Function
  function handleTuningStep(tuningstep) {
    //parseFloat(tuningstep);
    currentTuneStep = tuningstep;
  }
  // End Tuning Steps Function //

  // Mobile gestures
  // Pinch = Mousewheel = Zoom
  let pinchX = 0;
  function handleWaterfallPinchStart(e) {
    pinchX = 0;
  }
  function handleWaterfallPinchMove(e) {
    const diff = e.detail.scale - pinchX;
    pinchX = e.detail.scale;
    const scale =
      1 -
      Math.abs(e.detail.srcEvent.movementX) /
        waterfallCanvas.getBoundingClientRect().width;
    const evt = e.detail.srcEvent;
    evt.coords = { x: e.detail.center.x };
    evt.deltaY = -Math.sign(diff);
    evt.scaleAmount = scale;
    waterfall.canvasWheel(evt);
    updatePassband();
    // Prevent mouseup event from firing
    waterfallDragTotal += 2;
  }
  // Pan = Mousewheel = waterfall dragging
  function handleWaterfallPanMove(e) {
    if (e.detail.srcEvent.pointerType === "touch") {
      waterfall.mouseMove(e.detail.srcEvent);
      updatePassband();
      frequencyMarkerComponent.updateFrequencyMarkerPositions();
    }
  }

  // === dBm Visual Correction (display-only, module-scope) ===
  let dBmVisualOffset = 0;
  try {
    const savedVis = localStorage.getItem("dbmVisualOffset");
    if (savedVis !== null && !isNaN(parseFloat(savedVis)))
      dBmVisualOffset = parseFloat(savedVis);
  } catch (_) {}

  // Display-only correction in dB for the dBm LED (does not affect SNR or needle)
  function setDbmVisual(offsetDb) {
    dBmVisualOffset = Number(offsetDb) || 0;
    try {
      localStorage.setItem("dbmVisualOffset", String(dBmVisualOffset));
    } catch (_) {}
    // Update cached visual value immediately
    try {
      if (
        typeof window !== "undefined" &&
        typeof window._lastPowerDb === "number"
      ) {
        const cal = typeof dBmCalOffset === "number" ? dBmCalOffset : 0;
        window._lastPowerDbVisual = window._lastPowerDb + cal + dBmVisualOffset;
      }
    } catch (_) {}
    // No explicit redraw needed: _smeterTick() publishes smeterDbm every frame
    // and <SMeterAnalog/> redraws reactively, so the next frame picks this up.
  }
  try {
    window.setDbmVisual = setDbmVisual;
  } catch (_) {}

  // ── DX Cluster Widget ────────────────────────────────────────────────────
  let dxSpots = [];
  let dxBandFilter = "ALL";
  let dxLoading = false;
  let dxError = null;
  let dxRefreshInterval = null;

  const DX_BAND_LIST = [
    "ALL",
    "160",
    "80",
    "60",
    "40",
    "30",
    "20",
    "17",
    "15",
    "12",
    "10",
    "6",
  ];

  const DX_BAND_FREQ = {
    "160": "1.8MHz",
    "80": "3.5MHz",
    "60": "5MHz",
    "40": "7MHz",
    "30": "10MHz",
    "20": "14MHz",
    "17": "18MHz",
    "15": "21MHz",
    "12": "24MHz",
    "10": "28MHz",
    "6": "50MHz",
  };

  // DX spots are fetched from the local backend endpoint.
  function buildDXUrl() {
    const band = dxBandFilter === "ALL" ? "" : `&band=${dxBandFilter}`;
    return `/api/dxspots?limit=30${band}&_t=${Date.now()}`;
  }

  function freqToBand(f) {
    if (f >= 1800 && f <= 2000) return "160m";
    if (f >= 3500 && f <= 4000) return "80m";
    if (f >= 5300 && f <= 5410) return "60m";
    if (f >= 7000 && f <= 7300) return "40m";
    if (f >= 10100 && f <= 10150) return "30m";
    if (f >= 14000 && f <= 14350) return "20m";
    if (f >= 18068 && f <= 18168) return "17m";
    if (f >= 21000 && f <= 21450) return "15m";
    if (f >= 24890 && f <= 24990) return "12m";
    if (f >= 28000 && f <= 29700) return "10m";
    if (f >= 50000 && f <= 54000) return "6m";
    return "";
  }

  function detectMode(info) {
    if (!info) return "";
    const modes = [
      "FT8",
      "FT4",
      "FT2",
      "CW",
      "SSB",
      "AM",
      "FM",
      "RTTY",
      "PSK31",
      "BPSK31",
      "JS8",
      "WSPR",
      "JT65",
      "JT9",
      "MSK144",
    ];
    const upper = info.toUpperCase();
    for (const m of modes) {
      if (upper === m || upper.startsWith(m + " ") || upper.startsWith(m + ","))
        return m;
    }
    return "";
  }

  function parseDXJSON(data) {
    return data
      .filter((s) => s.dx_call && s.frequency > 0 && s.frequency < 60000)
      .map((s) => ({
        dx: (s.dx_call || "").trim(),
        spotter: (s.de_call || "").trim().replace(/-@$/, ""),
        freq: String(s.frequency),
        time: s.time || "",
        timeUtc: s.time_utc_hhmm || "",
        comment: s.info || "",
        mode: detectMode(s.info),
        band: freqToBand(s.frequency),
        country: s.dx_country || "",
      }));
  }

  async function tryFetch(url) {
    var _dxAbort = new AbortController();
    var _dxTimer = setTimeout(function () {
      _dxAbort.abort();
    }, 8000);
    const res = await fetch(url, {
      signal: _dxAbort.signal,
      cache: "no-store",
    });
    clearTimeout(_dxTimer);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.text();
  }

  async function fetchDXSpots() {
    dxLoading = true;
    dxError = null;
    const target = buildDXUrl();
    try {
      const text = await tryFetch(target);
      const data = JSON.parse(text);
      const spots = parseDXJSON(Array.isArray(data) ? data : []);
      if (spots.length > 0) {
        dxSpots = spots;
        dxError = null;
        dxLoading = false;
        return;
      }
      dxError = "Could not load spots (Empty response). Check browser console.";
      dxSpots = [];
      dxLoading = false;
    } catch (e) {
      dxError =
        "Could not load spots (" +
        (e && e.message ? e.message : "unknown") +
        "). Check browser console.";
      dxSpots = [];
      dxLoading = false;
    }
  }

  // Tune waterfall to a DX spot frequency (kHz → Hz),
  // zoom into the band and apply the band's brightness settings —
  // mirrors handleBandChange() but centres on the spot frequency.
  function tuneToDXFrequency(freqKhz) {
    const hz = parseFloat(freqKhz) * 1000;
    if (isNaN(hz) || hz <= 0) return;
    try {
      // ── 1. Tune frequency display + audio passband ──────────────────────
      frequencyInputComponent.setFrequency(hz);
      handleFrequencyChange({ detail: hz });
      updatePassband();

      // ── 2. Find the matching band (same lookup used everywhere else) ─────
      const freqKHz = hz / 1000;
      let bandIdx = -1;
      for (let i = 0; i < bandArray.length; i++) {
        const b = bandArray[i];
        if (
          freqKHz >= b.startFreq / 1000 &&
          freqKHz <= b.endFreq / 1000 &&
          (b.ITU === siteRegion || b.ITU === 123)
        ) {
          bandIdx = i;
          break;
        }
      }
      if (bandIdx < 0) return; // frequency outside any known band – just tune

      const band = bandArray[bandIdx];

      // ── 3. Disable auto-adjust so it cannot override the band brightness ─
      if (autoAdjustEnabled) {
        autoAdjustEnabled = false;
        waterfall.autoAdjust = false;
        storeWaterfallSettings = false;
      }
      if (typeof AutoAdjustEnabled !== "undefined" && AutoAdjustEnabled) {
        AutoAdjustEnabled = false;
      }

      // ── 4. Apply the band's brightness from bands-config.js ──────────────
      min_waterfall = parseInt(band.min);
      max_waterfall = parseInt(band.max);
      handleMinMove();
      handleMaxMove();

      // ── 5. Compute waterfall zoom span from the band's edge frequencies ──
      const hzPerBin = waterfall.sps / waterfall.fftSize;
      const spanEnd = band.endFreq / hzPerBin;
      const spanStart = band.startFreq / hzPerBin;
      let bandSpan = (spanEnd - spanStart) / 2;
      bandSpan += bandSpan * 0.01; // 1 % margin to show both edges

      // ── 6. Centre the zoom window on the spot frequency ──────────────────
      let m = frequencyToFFTOffset(hz);
      m = Math.min(waterfall.waterfallMaxSize - 512, Math.max(512, m));
      const l = Math.floor(m - 512) - bandSpan;
      const r = Math.ceil(m + 512) + bandSpan;

      waterfall.setWaterfallRange(l, r);

      // ── 7. Update all UI markers / tracking ─────────────────────────────
      frequencyMarkerComponent.updateFrequencyMarkerPositions();
      updatePassband();
      currentBand = bandIdx;
      bandName = band.name;
      currentTuneStep = band.stepi;
    } catch (e) {
      console.warn("DX tune error:", e);
    }
  }

  function dxSelectBand(band) {
    dxBandFilter = band;
    fetchDXSpots();
  }

  function formatDXTime(t, hhmm) {
    const hhmmStr = String(hhmm || "").trim();
    if (/^\d{4}$/.test(hhmmStr)) return `${hhmmStr}Z`;
    if (!t) return "";
    try {
      // DX Summit may return ISO-like UTC timestamps without explicit timezone.
      const d = new Date(t.includes("Z") ? t : t + "Z");
      if (!Number.isNaN(d.getTime())) {
        const h = d.getUTCHours().toString().padStart(2, "0");
        const m = d.getUTCMinutes().toString().padStart(2, "0");
        return `${h}${m}Z`;
      }
    } catch (e) {}
    const m = String(t).match(/(?:^|\D)(\d{2}):(\d{2})(?::\d{2})?(?:\D|$)/);
    if (m) return `${m[1]}${m[2]}Z`;
    return "";
  }

  function startDXCluster() {
    fetchDXSpots();
    // Refresh every 20s — fast enough to catch short DX openings,
    // safe enough not to trigger CORS proxy rate limits.
    if (dxRefreshInterval) clearInterval(dxRefreshInterval);
    dxRefreshInterval = setInterval(fetchDXSpots, 20000);
    // Pause polling when the tab is hidden, resume when visible again.
    if (dxVisibilityChangeHandler) {
      document.removeEventListener(
        "visibilitychange",
        dxVisibilityChangeHandler,
      );
    }
    dxVisibilityChangeHandler = () => {
      if (document.hidden) {
        if (dxRefreshInterval) clearInterval(dxRefreshInterval);
        dxRefreshInterval = null;
      } else {
        fetchDXSpots(); // immediate refresh on tab focus
        if (dxRefreshInterval) clearInterval(dxRefreshInterval);
        dxRefreshInterval = setInterval(fetchDXSpots, 20000);
      }
    };
    document.addEventListener("visibilitychange", dxVisibilityChangeHandler);
  }
</script>

<svelte:window
  on:mousemove={handleWindowMouseMove}
  on:mouseup={handleWindowMouseUp}
/>

{#if connectionRefused}
  <div
    class="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 p-4"
  >
    <div
      class="max-w-md rounded-lg border border-gray-600 bg-custom-dark p-6 text-center text-gray-200 shadow-xl"
    >
      <h2 class="mb-3 text-lg font-semibold">Connection refused</h2>
      <p class="mb-4 text-sm">
        This receiver refused the connection: {connectionRefused}.
      </p>
      <p class="mb-4 text-xs text-gray-400">
        Everyone sharing your internet connection counts as one address. Close
        any other tabs that have this receiver open, then reload.
      </p>
      <button
        class="rounded bg-gray-700 px-4 py-2 text-sm hover:bg-gray-600"
        on:click={() => window.location.reload()}>Reload</button
      >
    </div>
  </div>
{/if}

<main class="custom-scrollbar">
  <!-- comment the following 3 lines if you don't want the other versions to be shown -->
  {#if !Device.isMobile}
    <VersionSelector {smeter} {layout} onSelect={handleVariantChange} />
  {/if}

  <div class="h-screen overflow-hidden flex flex-col min-h-screen">
    {#if !Device.isMobile}
      <div
        class="w-full sm:h-screen overflow-y-scroll sm:w-1/2 xl:w-1/3 lg:w-1/4 sm:transition-all sm:ease-linear sm:duration-100"
        style="width:100%;"
      >
        <div
          class="min-h-screen bg-custom-dark text-gray-200"
          style="padding-top: 3px;"
        >
          <div class="max-w-screen-lg mx-auto">

            <!--Titel Box with Admin Infos, to be personalized-->
            <div
              class="flex flex-col rounded p-2 justify-center"
              id="chat-column"
            >
              <div
                class="p-3 sm:p-5 flex flex-col bg-gray-800 border border-gray-700 rounded-lg w-full mb-2 screw-panel"
                id="chat-box"
                style="opacity: 0.85;"
              >
                <!-- Header -->

                <h4
                  class="text-xl sm:text-2xl font-semibold text-gray-100 mb-2 sm:mb-4"
                >
                  WebSDR <a
                    href="https://www.qrz.com/db/{siteSysop}"
                    target="new"
                    style="color:rgba(0, 225, 255, 0.993)">{siteSysop}</a
                  >, located in
                  <a
                    href="http://k7fry.com/grid/?qth={siteGridSquare}"
                    target="new"
                    style="color:rgba(0, 225, 255, 0.993)"
                    >{siteCity}, {siteGridSquare}</a
                  >
                </h4>

                <!-- Details -->
                <span class="text-white text-sm sm:text-sm mr-4 mb-2 sm:mb-0">
                  {siteSysop}:
                  <a
                    href="mailto:{siteSysopEmailAddress}?subject=WebSDR"
                    style="color:rgba(0, 225, 255, 0.993)">email</a
                  >

                  &nbsp - &nbsp

                  <!-- Shortcuts trigger + popup -->
                  <button
                    type="button"
                    class="glass-button text-white py-1 px-3 mb-2 lg:mb-0 rounded-lg text-xs sm:text-sm"
                    on:click={openShortcuts}
                    title="Keyboard Shortcuts"
                    aria-haspopup="dialog"
                    aria-expanded={showShortcuts}
                    aria-controls="shortcuts-dialog"
                    style="color:rgba(0, 225, 255, 0.993)"
                  >
                    ⌨️ Keyboard Shortcuts
                  </button>

                  &nbsp;&nbsp;
                  <button
                    type="button"
                    class="glass-button text-white py-1 px-3 mb-2 lg:mb-0 rounded-lg text-xs sm:text-sm"
                    on:click={openUsers}
                    title="Connected Users"
                    aria-haspopup="dialog"
                    aria-expanded={showUsers}
                    aria-controls="users-dialog"
                    style="color:rgba(0, 225, 255, 0.993)"
                  >
                    📝 Users
                  </button>

                  &nbsp;&nbsp;
                  <button
                    type="button"
                    class="glass-button text-white py-1 px-3 mb-2 lg:mb-0 rounded-lg text-xs sm:text-sm"
                    on:click={openStats}
                    title="User Statistics"
                    aria-haspopup="dialog"
                    aria-expanded={showStats}
                    aria-controls="stats-dialog"
                    style="color:rgba(0, 225, 255, 0.993)"
                  >
                    📊 Stats
                  </button>

                  &nbsp-&nbsp Other servers:&nbsp;
                  <button
                    class="glass-button text-white py-1 px-3 mb-2 lg:mb-0 rounded-lg text-xs sm:text-sm"
                    style="color:rgba(0, 225, 255, 0.993)"
                    title="sdr-list.xyz"
                    onClick="window.open('https://sdr-list.xyz/');"
                  >
                    <span class="icon">1</span>
                  </button>
                  <button
                    class="glass-button text-white py-1 px-3 mb-2 lg:mb-0 rounded-lg text-xs sm:text-sm"
                    style="color:rgba(0, 225, 255, 0.993)"
                    title="sdr.shbrg.nl/sdr"
                    onClick="window.open('https://sdr.shbrg.nl/sdr/');"
                  >
                    <span class="icon">2</span>
                  </button>
                  <button
                    class="glass-button text-white py-1 px-3 mb-2 lg:mb-0 rounded-lg text-xs sm:text-sm"
                    style="color:rgba(0, 225, 255, 0.993)"
                    title="websdr.org"
                    onClick="window.open('http://websdr.org/');"
                  >
                    <span class="icon">3</span>
                  </button>

                  <div
                    class="flex flex-wrap items-center justify-center w-full gap-y-1"
                  >
                    <!-- Frequency & QRZ Lookup -->

                    Frequency Search :&nbsp;
                    <button
                      class="glass-button text-white py-1 px-3 mb-2 lg:mb-0 rounded-lg text-sm sm:text-sm"
                      style="color:rgba(0, 225, 255, 0.993)"
                      title="Find the MW you are hearing"
                      onClick="window.open('http://www.mwlist.org/mwlist_quick_and_easy.php?area=1&amp;kHz='+{Math.round(
                        frequency,
                      )},'websdrstationinfo','');"
                    >
                      <span class="icon">MW</span>
                    </button>
                    &nbsp;&nbsp;&nbsp;
                    <button
                      class="glass-button text-white py-1 px-3 mb-2 lg:mb-0 rounded-lg text-sm sm:text-sm"
                      style="color:rgba(0, 225, 255, 0.993)"
                      title="Find the SW you are hearing"
                      onClick="window.open('http://www.short-wave.info/index.php?freq='+{Math.round(
                        frequency,
                      )}+'&amp;timbus=NOW&amp;ip=179&amp;porm=4','websdrstationinfo','')"
                    >
                      <span class="icon">SW</span>
                    </button>
                    &nbsp;&nbsp;&nbsp;
                    <button
                      class="glass-button text-white py-1 px-3 mb-2 lg:mb-0 rounded-lg text-sm sm:text-sm"
                      style="color:rgba(0, 225, 255, 0.993)"
                      title="HamDash - Ham Radio Dashboard"
                      onClick="window.open('https://hamdash.com/','_blank')"
                    >
                      <span class="icon">HamDash</span>
                    </button>
                    &nbsp;&nbsp;&nbsp;
                    <button
                      class="glass-button text-white py-1 px-3 mb-2 lg:mb-0 rounded-lg text-sm sm:text-sm"
                      style="color:rgba(0, 225, 255, 0.993)"
                      title="PSK Reporter"
                      onClick="window.open('https://pskreporter.info/pskmap.html','_blank')"
                    >
                      <span class="icon">PSK Reporter</span>
                    </button>
                    &nbsp;&nbsp;&nbsp;
                    <button
                      class="glass-button text-white py-1 px-3 mb-2 lg:mb-0 rounded-lg text-sm sm:text-sm"
                      style="color:rgba(0, 225, 255, 0.993)"
                      title="WSPRnet"
                      onClick="window.open('https://www.wsprnet.org/drupal/wsprnet/map','_blank')"
                    >
                      <span class="icon">WSPRnet</span>
                    </button>
                    &nbsp; - &nbsp;
                    <form
                      method="get"
                      target="_blank"
                      action="https://www.qrzcq.com"
                    >
                      Callsign Search: &nbsp;&nbsp;&nbsp;
                      <input
                        type="text"
                        name="q"
                        value=""
                        size="6"
                        style=" background-color: #2D3B4F; color: rgb(0, 255, 255); border-style: groove; border-color: grey; text-align:center; font-size: 84%;"
                        on:click={() => this.form.q.select().focus()}
                      />&nbsp;&nbsp;&nbsp;
                      <input type="hidden" name="action" value="search" />
                      <input
                        class="glass-button text-white py-1 px-3 mb-2 lg:mb-0 rounded-lg text-xs sm:text-sm"
                        type="submit"
                        name="page"
                        value="Search"
                        style="color:rgba(0, 225, 255, 0.993)"
                      />
                    </form>
                  </div>
                  <div>
                    {#if showShortcuts}
                      <div class="modal-backdrop" on:click={closeShortcuts}>
                        <div
                          id="shortcuts-dialog"
                          role="dialog"
                          aria-modal="true"
                          aria-labelledby="shortcuts-title"
                          class="modal-right"
                        >
                          <div class="modal-header">
                            <h2 id="shortcuts-title">Keyboard Shortcuts</h2>
                            <button
                              class="close-btn"
                              on:click={closeShortcuts}
                              bind:this={closeBtnEl}
                              title="Close window"
                              aria-label="Close">×</button
                            >
                          </div>

                          <div class="modal-body">
                            <table class="shortcuts-table">
                              <tbody>
                                <tr
                                  ><td>l, u, a, q, f</td><td
                                    >LSB, USB, AM, QUAM, FM mode</td
                                  ></tr
                                >
                                <tr><td>w</td><td>reverse waterfall</td></tr>
                                <tr><td>ControlRight</td><td>.00 KHz </td></tr>
                                <tr><td>↑ / ↓</td><td>±0.01 kHz</td></tr>
                                <tr><td>← / →</td><td>∓0.10 kHz</td></tr>
                                <tr><td>Shift + ↑ / ↓</td><td>±1 kHz</td></tr>
                                <tr><td>Shift + ← / →</td><td>∓10 kHz</td></tr>
                                <tr><td>Ctrl + ↑ / ↓</td><td>±100 kHz</td></tr>
                                <tr><td>Ctrl + ← / →</td><td>∓500 kHz</td></tr>
                                <tr
                                  ><td>Shift + Ctrl + ↑ / ↓</td><td>±1 MHz</td
                                  ></tr
                                >
                                <tr
                                  ><td>Shift + Ctrl + ← / →</td><td>∓10 MHz</td
                                  ></tr
                                >
                              </tbody>
                            </table>
                          </div>

                          <div class="modal-header">
                            <h2 id="shortcuts-title">
                              Keyboard Shortcuts inside Waterfall
                            </h2>
                          </div>

                          <div class="modal-body">
                            <table class="shortcuts-table">
                              <tbody>
                                <tr
                                  ><td>Wheel up/down</td><td>Zoom in/out</td
                                  ></tr
                                >
                                <tr
                                  ><td>Shift + Wheel up/down</td><td
                                    >Tune ±100 Hz</td
                                  ></tr
                                >
                                <tr
                                  ><td>Ctrl + Wheel up/down</td><td
                                    >Tune ±10 Hz</td
                                  ></tr
                                >
                                <tr
                                  ><td>Ctrl + Shift + Wheel</td><td
                                    >Snap to .00 kHz</td
                                  ></tr
                                >
                              </tbody>
                            </table>
                            <br />
                            <p class="hint">
                              Press <kbd>Esc</kbd> or click <b>×</b> to close.
                            </p>
                          </div>
                        </div>
                      </div>
                    {/if}

                    {#if showUsers}
                      <div class="modal-backdrop" on:click={closeUsers}>
                        <div
                          id="users-dialog"
                          role="dialog"
                          aria-modal="true"
                          aria-labelledby="users-title"
                          class="modal-right"
                        >
                          <div class="modal-header">
                            <h2 id="users-title">👥 Connected Users</h2>
                            <button
                              class="close-btn"
                              on:click={closeUsers}
                              bind:this={closeUsersBtnEl}
                              title="Close window"
                              aria-label="Close">×</button
                            >
                          </div>
                          <div
                            class="modal-body"
                            style="padding:0; overflow:auto;"
                          >
                            <iframe
                              class="modal-embed"
                              src="{siteIP}/users.html"
                              title="Connected Users"
                              style="width:100%; height:420px; border:none; background:#0f172a; display:block;"
                              loading="lazy"
                            ></iframe>
                          </div>
                          <div class="modal-body" style="padding:4px 10px;">
                            <p class="hint">
                              Press <kbd>Esc</kbd> or click <b>×</b> to close.
                            </p>
                          </div>
                        </div>
                      </div>
                    {/if}

                    {#if showStats}
                      <div class="modal-backdrop" on:click={closeStats}>
                        <div
                          id="stats-dialog"
                          role="dialog"
                          aria-modal="true"
                          aria-labelledby="stats-title"
                          class="modal-right"
                        >
                          <div class="modal-header">
                            <h2 id="stats-title">📊 User Statistics</h2>
                            <button
                              class="close-btn"
                              on:click={closeStats}
                              bind:this={closeStatsBtnEl}
                              title="Close window"
                              aria-label="Close">×</button
                            >
                          </div>
                          <div
                            class="modal-body"
                            style="padding:0; overflow:auto;"
                          >
                            <iframe
                              class="modal-embed"
                              src="{siteIP}/stats.html"
                              title="User Statistics"
                              style="width:100%; height:420px; border:none; background:#050a07; display:block;"
                              loading="lazy"
                            ></iframe>
                          </div>
                          <div class="modal-body" style="padding:4px 10px;">
                            <p class="hint">
                              Press <kbd>Esc</kbd> or click <b>×</b> to close.
                            </p>
                          </div>
                        </div>
                      </div>
                    {/if}
                  </div>

                  <!-- End Frequency & QRZ Lookupp -->

                  <!-- Collapsible Menu -->
                  <div>
                    <!-- Toggle Button -->
                    <center>
                      <button
                        class="bg-gray-700 hover:bg-gray-600 text-white font-medium py-2 px-4 rounded-lg flex items-center transition-colors ring-2 ring-blue-500 s-XsEmFtvddWTw"
                        on:click={() => toggleMenu()}
                        style="margin-top: 15px;"
                      >
                        <span id="menu-toggle-label">Open Additional Info</span>
                      </button>
                    </center>

<!-- @@COLLAPSIBLE_MENU_START@@ -->

               <!-- Collapsible Content -->
               <div id="collapsible-menu" class="hidden mt-3 p-3 rounded decoder-window">
                <div class="columns">
                  <div class="first-column">
                    <ul style="font-size: 0.91rem; text-align: left;">
                    <b>Setup &amp; Configuration:</b>
                      <img
                        src="https://img.shields.io/badge/version- 4.2.0-cyan?logo=github"
                        alt="Version"
                        class="inline-block align-middle ml-2"
                      />
                     with <a href="https://catsyncsdr.wordpress.com/" target="new" style="color:rgba(0, 225, 255, 0.993)">CAT sync ®</a> and <a href="https://www.aethersdr.com/" target="new" style="color:rgba(0, 225, 255, 0.993)">AetherSDR ®</a> ready.
                    <br>
                    <span style="/*text-decoration: line-through*/">PC: {siteHardware} {siteSoftware}</span>                  
                    
                   <!-- In case you don't want the Stats Button to appear, please comment this button section (12 lines)-->                     
                    <!-- System Stats Button -->
                    <button
                      type="button"
                      class="glass-button text-white py-1 px-2 ml-2 rounded text-xs"
                      on:click={openSystemStats}
                      title="System Resources"
                      aria-haspopup="dialog"
                      aria-expanded={showSystemStats}
                      aria-controls="system-stats-dialog"
                      style="color:rgba(0, 225, 255, 0.993); font-size: 0.75rem;"
                    >
                      📊 System Resources
                    </button>
                    
                    <!-- Desktop applications: the installers for Desktop PhantomSDR+ live in a
                         public Dropbox folder, because GitHub cannot host files that size. -->
                    <button
                      type="button"
                      class="glass-button text-white py-1 px-2 ml-2 rounded text-xs"
                      on:click={() => window.open("https://www.dropbox.com/scl/fo/kjwj96zg3kj7dgq4fjef9/APnA3c9hhv4hk3YMGIGjH7s?rlkey=jfiwklly63kv73poalx631pk3&st=m37uvaym&dl=0", "_blank", "noopener,noreferrer")}
                      title="Download Desktop PhantomSDR+ for Linux and Windows"
                      style="color:rgba(0, 225, 255, 0.993); font-size: 0.75rem;"
                    >
                      💾 Desktop applications
                    </button>

                    <!-- System Stats Modal -->
                    {#if showSystemStats}
                      <div class="modal-backdrop" on:click={closeSystemStats}>
                        <div 
                          id="system-stats-dialog"
                          role="dialog"
                          aria-modal="true"
                          aria-labelledby="system-stats-title"
                          class="modal-right"
                        >
                        <div class="modal-header">
                          <h2 id="system-stats-title">System Resources</h2>
                          <button
                            class="close-btn"
                            on:click={closeSystemStats}
                            bind:this={systemStatsCloseBtnEl}
                            title="Close window"
                            aria-label="Close"
                          >×</button>
                        </div>
                        
                        <div class="modal-body">
                          <div style="font-size: 0.9rem;">
                            <!-- CPU Stats -->
                            <div style="margin-bottom: 1rem; padding: 0.75rem; background: rgba(255,255,255,0.05); border-radius: 8px;">
                              <h3 style="margin: 0 0 0.5rem 0; color: rgba(0, 225, 255, 0.993); font-size: 1rem;">🖥️ CPU</h3>
                              <div style="display: flex; justify-content: space-between; margin-bottom: 0.25rem;">
                                <span>Usage:</span>
                                <!-- Every field below is read through ?. so that a stats
                                     server which stops sending one cannot throw mid-render:
                                     the exception aborts the whole Svelte flush and freezes
                                     every other value in this dialog at its initial 0. -->
                                <span style="color: #4ade80;">{systemStats.cpu?.usage ?? "–"}%</span>
                              </div>
                              <div style="display: flex; justify-content: space-between; margin-bottom: 0.25rem;">
                                <span>Cores:</span>
                                <!-- Cores' worth of work / total. toFixed keeps it at one
                                     decimal: JSON drops the trailing zero, so the value would
                                     otherwise flick between "1" and "0.8". Falls back to the
                                     plain total on a stats server without the field. -->
                                <span>{systemStats.cpu?.coresUsed != null
                                       ? `${systemStats.cpu.coresUsed.toFixed(1)} / ${systemStats.cpu.cores} in use`
                                       : systemStats.cpu?.cores ?? "–"}</span>
                              </div>
                              {#if systemStats.cpu?.frequency}
                              <div style="display: flex; justify-content: space-between; margin-bottom: 0.25rem;">
                                <span>Frequency:</span>
                                <span style="color: #4ade80;">{systemStats.cpu.frequency.current} GHz{#if systemStats.cpu.frequency.max} <span style="opacity: 0.7;">(max {systemStats.cpu.frequency.max})</span>{/if}</span>
                              </div>
                              {/if}

                              {#if systemStats.cpu?.temperature != null}
                              <div style="display: flex; justify-content: space-between; margin-bottom: 0.25rem;">
                                <span>Temperature:</span>
                                <span style="color: {systemStats.cpu.temperature >= 80 ? '#ef4444' : systemStats.cpu.temperature >= 70 ? '#fbbf24' : '#4ade80'};">{systemStats.cpu.temperature}°C</span>
                              </div>
                              {/if}
                              
                              {#if systemStats.cpu?.topProcesses?.length > 0}
                              <div style="margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px solid rgba(255,255,255,0.1);">
                                <h4 style="margin: 0 0 0.5rem 0; font-size: 0.85rem; color: rgba(0, 225, 255, 0.8);">Top Processes:</h4>
                                {#each systemStats.cpu.topProcesses as process}
                                <div style="display: flex; justify-content: space-between; margin-bottom: 0.25rem; font-size: 0.85rem;">
                                  <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 70%;">{process.name}</span>
                                  <span style="color: {process.cpu > 80 ? '#ef4444' : process.cpu > 50 ? '#fbbf24' : '#4ade80'};">{process.cpu}%</span>
                                </div>
                                {/each}
                              </div>
                              {/if}
                            </div>

                            <!-- Memory Stats -->
                            <div style="padding: 0.75rem; background: rgba(255,255,255,0.05); border-radius: 8px;">
                              <h3 style="margin: 0 0 0.5rem 0; color: rgba(0, 225, 255, 0.993); font-size: 1rem;">💾 Memory</h3>
                              <div style="display: flex; justify-content: space-between; margin-bottom: 0.25rem;">
                                <span>Used:</span>
                                <span>{systemStats.memory?.used ?? "–"} GB / {systemStats.memory?.total ?? "–"} GB</span>
                              </div>
                              <div style="display: flex; justify-content: space-between;">
                                <span>Usage:</span>
                                <span style="color: {systemStats.memory?.percent > 80 ? '#ef4444' : '#4ade80'};">{systemStats.memory?.percent ?? "–"}%</span>
                              </div>
                            </div>
                          </div>

                          <br>
                          <p class="hint" style="font-size: 0.75rem;">Press <kbd>Esc</kbd> or click <b>×</b> to close.</p>
                        </div>
                      </div>
                    </div>
                    {/if}
                    <!-- End System Stats Modal -->
                    <br> <br>
                    <b>SDR Receivers &amp; Antenna</b>
                    <br>
                    <span style="/*text-decoration: line-through*/">Receiver: {siteReceiver}</span>
                    <br>                    
                    <span style="/*text-decoration: line-through*/">Antenna: {siteAntenna}</span> <br>
                    <span>Github: <a href="https://github.com/sv1btl/PhantomSDR-Plus" target="new" style="color:rgba(0, 225, 255, 0.993)"> {siteInformation} </a></span>
                    <br><br>

                    <b>Note:</b> <br> 
                     <span style="/*text-decoration: line-through*/"><button
                       type="button"
                       class="glass-button text-white py-1 px-2 mr-1 rounded text-xs"
                       on:click={() => window.open(`https://pskreporter.info/pskmap.html#preset&callsign=${siteSysop}&txrx=rx&mode=FT8&timerange=3600&mapCenter=22.6243,10.9375,2.59`, 'FT8map', 'width=1100,height=750,menubar=no,toolbar=no,location=no,status=no,resizable=yes,scrollbars=yes')}
                       style="color:rgba(0, 225, 255, 0.993); font-size: 0.75rem;"
                     >
                       📡 FT8 map
                     </button>
                     <button
                       type="button"
                       class="glass-button text-white py-1 px-2 mr-1 rounded text-xs"
                       on:click={() => window.open(`https://pskreporter.info/pskmap.html#preset&callsign=${siteSysop}&txrx=rx&mode=FT4&timerange=3600&mapCenter=22.6243,10.9375,2.59`, 'FT4map', 'width=1100,height=750,menubar=no,toolbar=no,location=no,status=no,resizable=yes,scrollbars=yes')}
                       style="color:rgba(0, 225, 255, 0.993); font-size: 0.75rem;"
                     >
                       📡 FT4 map
                     </button>
                     <button
                       type="button"
                       class="glass-button text-white py-1 px-2 mr-1 rounded text-xs"
                       on:click={() => window.open(`https://pskreporter.info/pskmap.html#preset&callsign=${siteSysop}&txrx=rx&mode=JS8&timerange=3600&mapCenter=22.6243,10.9375,2.59`, 'JS8map', 'width=1100,height=750,menubar=no,toolbar=no,location=no,status=no,resizable=yes,scrollbars=yes')}
                       style="color:rgba(0, 225, 255, 0.993); font-size: 0.75rem;"
                     >
                       📡 JS8 map
                     </button>
                     <button
                       type="button"
                       class="glass-button text-white py-1 px-2 mr-1 rounded text-xs"
                       on:click={() => window.open(`https://www.wsprnet.org/olddb?mode=html&band=all&limit=100&findcall=&findreporter=${siteSysop}&sort=date`, 'WSPRlog', 'width=1100,height=750,menubar=no,toolbar=no,location=no,status=no,resizable=yes,scrollbars=yes')}
                       style="color:rgba(0, 225, 255, 0.993); font-size: 0.75rem;"
                     >
                       📋 WSPR log
                     </button>
                     <button
                       type="button"
                       class="glass-button text-white py-1 px-2 rounded text-xs"
                       on:click={() => window.open('https://wspr.aprsinfo.com/', 'WSPRmap', 'width=1100,height=750,menubar=no,toolbar=no,location=no,status=no,resizable=yes,scrollbars=yes')}
                       style="color:rgba(0, 225, 255, 0.993); font-size: 0.75rem;"
                     >
                       🗺️ WSPR map
                     </button> <br><br>

                    <!--


                     NOTHING HERE


                     NOTHING HERE


                     NOTHING HERE


                     -->

                     <b>Info:</b>
                     {siteNote}
                     <!-- Any other information here -->
                     
                     <br><br>
                             
                  <div style="font-weight: bold;">Current band propagation for Europe and statistics:</div>
                  <div style="display: flex; align-items: center; margin-top: 10px;">
                     <img src="https://images.lightningmaps.org/blitzortung/europe/index.php?map=5&amp;t=5092072" alt="Lightning Map" style="margin-right: 10px;" />
                     <a href="https://www.hamqsl.com/solar.html" title="Click for more information">
                     <img alt="Solar propagation" src="https://www.hamqsl.com/solar101vhf.php" /> </a><br>
                   </div>
                </div>
                   
                <div class="second-column"> 
                 <!-- ── Native DX Cluster Widget ─────────────────────────────────────── -->
                 <!-- Replaces the cross-origin <embed> so frequency clicks can directly  -->
                 <!-- tune the waterfall via frequencyInputComponent.setFrequency()        -->
                 <div style="
                   margin-left:10px;
                   width:100%;
                   max-width:660px;
                   background:#0d1117;
                   border:1px solid #30363d;
                   border-radius:6px;
                   font-family:monospace;
                   font-size:12px;
                   color:#c9d1d9;
                   overflow:hidden;
                 ">
                   <!-- Header bar -->
                   <div style="
                     background:#161b22;
                     border-bottom:1px solid #30363d;
                     padding:6px 10px;
                     display:flex;
                     align-items:center;
                     justify-content:space-between;
                     gap:6px;
                     flex-wrap:wrap;
                   ">
                     <span style="color:#58a6ff;font-weight:bold;font-size:13px;">📡 DX Cluster</span>
                     <!-- Band filter buttons -->
                     <div style="display:flex;flex-wrap:wrap;gap:3px;">
                       {#each DX_BAND_LIST as band}
                         <button
                           on:click={() => dxSelectBand(band)}
                           style="
                             padding:2px 6px;
                             border-radius:4px;
                             border:1px solid {dxBandFilter===band ? '#58a6ff' : '#30363d'};
                             background:{dxBandFilter===band ? 'rgba(88,166,255,0.2)' : 'transparent'};
                             color:{dxBandFilter===band ? '#58a6ff' : '#8b949e'};
                             cursor:pointer;
                             font-size:11px;
                             font-family:monospace;
                             transition:all 0.15s;
                           "
                         >{band==='ALL' ? 'All' : band+'m'}</button>
                       {/each}
                     </div>
                     <!-- Refresh button -->
                     <button
                       on:click={fetchDXSpots}
                       title="Refresh spots"
                       style="
                         padding:2px 8px;
                         border-radius:4px;
                         border:1px solid #30363d;
                         background:transparent;
                         color:#8b949e;
                         cursor:pointer;
                         font-size:11px;
                         font-family:monospace;
                       "
                     >{dxLoading ? '⟳ …' : '⟳ Refresh'}</button>
                   </div>

                   <!-- Table area -->
                   <div style="height:430px;overflow-y:auto;overflow-x:auto;">
                     {#if dxError}
                       <div style="padding:16px;color:#f85149;text-align:center;line-height:1.6;">
                         ⚠ Could not load spots<br>
                         <small style="color:#8b949e;">{dxError}</small><br><br>
                         <small style="color:#6e7681;">
                           All three CORS proxies failed.<br>
                           Possible causes: network/firewall blocks outbound HTTPS,<br>
                           or all proxy services are temporarily unavailable.<br>
                           Try clicking Refresh in a moment.
                         </small>
                       </div>
                     {:else if dxLoading && dxSpots.length === 0}
                       <div style="padding:16px;color:#8b949e;text-align:center;">Loading spots…</div>
                     {:else if dxSpots.length === 0}
                       <div style="padding:16px;color:#8b949e;text-align:center;">No spots found.</div>
                     {:else}
                       <table style="width:100%;min-width:560px;border-collapse:collapse;">
                         <thead>
                           <tr style="background:#161b22;position:sticky;top:0;z-index:1;">
                             <th style="padding:4px 6px;text-align:left;color:#8b949e;font-weight:normal;border-bottom:1px solid #21262d;white-space:nowrap;">UTC</th>
                             <th style="padding:4px 6px;text-align:left;color:#8b949e;font-weight:normal;border-bottom:1px solid #21262d;">Spotter</th>
                             <th style="padding:4px 6px;text-align:left;color:#8b949e;font-weight:normal;border-bottom:1px solid #21262d;">DX Call</th>
                             <th style="padding:4px 6px;text-align:right;color:#8b949e;font-weight:normal;border-bottom:1px solid #21262d;">Freq (kHz)</th>
                             <th style="padding:4px 6px;text-align:left;color:#8b949e;font-weight:normal;border-bottom:1px solid #21262d;">Band</th>
                             <th style="padding:4px 6px;text-align:left;color:#8b949e;font-weight:normal;border-bottom:1px solid #21262d;">Mode</th>
                             <th style="padding:4px 6px;text-align:left;color:#8b949e;font-weight:normal;border-bottom:1px solid #21262d;">Comment</th>
                           </tr>
                         </thead>
                         <tbody>
                           {#each dxSpots as spot, i}
                             <tr style="background:{i%2===0 ? 'transparent' : 'rgba(255,255,255,0.02)'};">
                               <td style="padding:3px 6px;color:#8b949e;white-space:nowrap;">{formatDXTime(spot.time, spot.timeUtc)}</td>
                               <td style="padding:3px 6px;white-space:nowrap;">
                                 <a
                                   href="https://www.qrzcq.com/call/{(spot.spotter || '').trim()}"
                                   target="_blank"
                                   rel="noopener noreferrer"
                                   title="Look up {(spot.spotter || '').trim()} on QRZCQ"
                                   style="
                                     color:#79c0ff;
                                     font-weight:bold;
                                     text-decoration:none;
                                     border-bottom:1px dotted rgba(121,192,255,0.5);
                                     transition:color 0.15s;
                                   "
                                   on:mouseover={e => e.target.style.color='#a5d6ff'}
                                   on:mouseout={e => e.target.style.color='#79c0ff'}
                                 >{spot.spotter || ''}</a>
                               </td>
                               <td style="padding:3px 6px;white-space:nowrap;">
                                 <a
                                   href="https://www.qrzcq.com/call/{(spot.dx || '').trim()}"
                                   target="_blank"
                                   rel="noopener noreferrer"
                                   title="Look up {(spot.dx || '').trim()} on QRZCQ"
                                   style="
                                     color:#ffa657;
                                     font-weight:bold;
                                     text-decoration:none;
                                     border-bottom:1px dotted rgba(255,166,87,0.5);
                                     transition:color 0.15s;
                                   "
                                   on:mouseover={e => e.target.style.color='#ffcc99'}
                                   on:mouseout={e => e.target.style.color='#ffa657'}
                                 >{spot.dx || ''}</a>
                               </td>
                               <!-- ★ Clickable frequency – tunes the waterfall -->
                               <td style="padding:3px 6px;text-align:right;">
                                 <button
                                   on:click={() => tuneToDXFrequency(spot.freq)}
                                   title="Click to tune waterfall to {spot.freq} kHz"
                                   style="
                                     background:transparent;
                                     border:none;
                                     color:#3fb950;
                                     cursor:pointer;
                                     font-family:monospace;
                                     font-size:12px;
                                     font-weight:bold;
                                     padding:0;
                                     text-decoration:underline dotted;
                                     white-space:nowrap;
                                   "
                                 >{spot.freq}</button>
                               </td>
                               <td style="padding:3px 6px;color:#8b949e;white-space:nowrap;">{spot.band || ''}</td>
                               <td style="padding:3px 6px;color:#d2a8ff;white-space:nowrap;">{spot.mode || ''}</td>
                               <td style="padding:3px 6px;color:#c9d1d9;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title={spot.comment || ''}>{spot.comment || ''}</td>
                             </tr>
                           {/each}
                         </tbody>
                       </table>
                     {/if}
                   </div>

                   <!-- Footer -->
                   <div style="padding:4px 10px;background:#161b22;border-top:1px solid #30363d;color:#484f58;font-size:10px;display:flex;justify-content:space-between;">
                     <span>Data: local backend /api/dxspots • auto-refresh 20 s</span>
                     <span>{dxSpots.length} spot{dxSpots.length===1?'':'s'}</span>
                   </div>
                 </div>
                 <!-- ── End DX Cluster Widget ──────────────────────────────────────────── -->
              </div>     
            </div>
           </div>
<!-- @@COLLAPSIBLE_MENU_END@@ -->
         </div>
        </div>

              <style>
                /* No .hidden here: Tailwind already defines it, and a copy in
                   this raw (unscoped, late-loading) block overrode every
                   responsive `hidden sm:inline` / `sm:block` on the page. */

                /* Setting the container width to 100% enabling overflow auto to clear the float */
                .columns {
                  width: 100%;
                  overflow: auto; /* To clear the float */
                }

                /* Styling for the left column */
                .first-column {
                  float: left; /* Float left to place it on the left side */
                  width: 47%; /* Taking 47% of the container width */
                }

                /* Styling for the right column */
                .second-column {
                  float: right; /* Float right to place it on the right side */
                  width: 53%; /* Taking 53% of the container width */
                }

                /* Tablets and phones: two floated columns do not fit side by
                   side, so stack them full width instead of letting the right
                   one get squeezed to an unreadable sliver. */
                @media (max-width: 1023px) {
                  .first-column,
                  .second-column {
                    float: none;
                    width: 100%;
                  }
                  .second-column {
                    margin-top: 12px;
                  }
                }
              </style>

              <!--End of Titel Box -->

              <!--Beginn of Waterfall -->
              <div class="flex justify-center w-full">
                <div class="w-full" id="outer-waterfall-container">
                  <div
                    style="image-rendering:pixelated;"
                    class="relative w-full xl:rounded-lg peer overflow-hidden"
                    id="waterfall"
                  >
                    <VideoAreaSelector
                      active={selectingArea}
                      crop={videoCrop}
                      getLayers={videoRecordingLayers}
                      on:select={handleAreaSelect}
                      on:cancel={handleAreaCancel}
                    />
                    <div class="relative w-full">
                      <canvas
                        class="w-full bg-black peer {spectrumDisplay
                          ? 'max-h-40'
                          : 'max-h-0'}"
                        bind:this={spectrumCanvas}
                        on:wheel={handleWaterfallWheel}
                        on:mousedown={handleWaterfallMouseDown}
                        on:mousemove={handleSpectrumMouseMove}
                        on:mouseleave={handleSpectrumMouseLeave}
                        width="1024"
                        height="128"
                      ></canvas>
                      <!-- Bandwidth highlight mirrored from the waterfall -->
                      <div
                        bind:this={spectrumHighlightInner}
                        class="pointer-events-none absolute top-0 bottom-0 z-[9999] bg-yellow-300/10 border-l border-r border-yellow-300/60"
                        style="pointer-events: none; display: none;"
                      ></div>
                    </div>
                    <canvas
                      class="w-full bg-black peer"
                      bind:this={topGraduationCanvas}
                      on:wheel={handleWaterfallWheel}
                      on:click={passbandTunerComponent.handlePassbandClick}
                      on:mousedown={(e) =>
                        passbandTunerComponent.handleMoveStart(e, 1)}
                      on:touchstart={passbandTunerComponent.handleTouchStart}
                      on:touchmove={passbandTunerComponent.handleTouchMove}
                      on:touchend={passbandTunerComponent.handleTouchEnd}
                      width="1024"
                      height="20"
                    ></canvas>
                    <!-- ★ Admin waterfall message bar — appears between freq scale and waterfall -->
                    {#if adminMessage}
                      <div
                        style="width:100%;background:rgba(0,0,0,0.92);
                                  border-left:4px solid #ffb000;padding:6px 14px;
                                  font-family:monospace;font-size:13px;font-weight:bold;
                                  display:flex;align-items:center;gap:10px;
                                  box-shadow:0 2px 6px rgba(0,0,0,0.5);"
                      >
                        <span style="color:#ffb000;flex-shrink:0;"
                          >&#9733; ADMIN:</span
                        >
                        <span
                          style="color:{adminMsgColor};overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"
                          >{adminMessage}</span
                        >
                      </div>
                    {/if}
                    <div class="relative w-full">
                      <canvas
                        class="w-full bg-black {waterfallDisplay
                          ? 'block'
                          : 'hidden'}"
                        bind:this={waterfallCanvas}
                        style:transform={waterfallReverse
                          ? "scaleY(-1)"
                          : "scaleY(1)"}
                        style:transform-origin={"center center"}
                        use:pinch
                        on:pinchstart={handleWaterfallPinchStart}
                        on:pinchmove={handleWaterfallPinchMove}
                        use:pan
                        on:panmove={handleWaterfallPanMove}
                        on:wheel={handleWaterfallWheel}
                        on:mousedown={handleWaterfallMouseDown}
                        on:mousemove={handleWaterfallMouseMove}
                        on:mouseleave={handleWaterfallMouseLeave}
                        width="1024"
                        title="Wheel = Zoom
Shift + Wheel = 0.1 KHz
Ctrl + Wheel = 0.01 KHz
Shift + Ctrl + Wheel = snap to .00 KHz"
                      ></canvas>

                      <!-- Cursor Frequency Display -->
                      {#if showCursorFreq && cursorFrequency !== null}
                        <div
                          class="cursor-frequency-tooltip"
                          style="position: fixed; left: {cursorX +
                            15}px; top: {cursorY -
                            30}px; pointer-events: none; z-index: 10000;"
                        >
                          {formatFrequency(cursorFrequency)}
                        </div>
                      {/if}

                      <div
                        class="pointer-events-none absolute inset-0 z-[9999] {waterfallDisplay
                          ? 'block'
                          : 'hidden'}"
                        bind:this={waterfallHighlightCanvas}
                        style:transform={waterfallReverse
                          ? "scaleY(-1)"
                          : "scaleY(1)"}
                        style:transform-origin={"center center"}
                      >
                        <div
                          bind:this={waterfallHighlightInner}
                          class="absolute top-0 bottom-0 bg-yellow-300/10 border-l border-r border-yellow-300/60"
                          style="pointer-events: none;"
                        ></div>
                      </div>
                    </div>
                    <canvas
                      class="hidden"
                      bind:this={tempCanvas}
                      width="1024"
                      height="1024"
                    ></canvas>
                    <FrequencyInput
                      bind:this={frequencyInputComponent}
                      on:change={handleFrequencyChange}
                    ></FrequencyInput>

                    <FrequencyMarkers
                      bind:this={frequencyMarkerComponent}
                      bookmarks={$bookmarks}
                      on:click={passbandTunerComponent.handlePassbandClick}
                      on:wheel={handleWaterfallWheel}
                      on:markerclick={handleFrequencyMarkerClick}
                    ></FrequencyMarkers>
                    <canvas
                      class="w-full bg-black peer"
                      bind:this={graduationCanvas}
                      on:wheel={handleWaterfallWheel}
                      on:click={passbandTunerComponent.handlePassbandClick}
                      on:mousedown={(e) =>
                        passbandTunerComponent.handleMoveStart(e, 1)}
                      on:touchstart={passbandTunerComponent.handleTouchStart}
                      on:touchmove={passbandTunerComponent.handleTouchMove}
                      on:touchend={passbandTunerComponent.handleTouchEnd}
                      width="1024"
                      height="20"
                    ></canvas>
                    <PassbandTuner
                      on:change={handlePassbandChange}
                      on:wheel={handleWaterfallWheel}
                      bind:this={passbandTunerComponent}
                    ></PassbandTuner>
                    <canvas
                      class="w-full bg-black peer"
                      bind:this={bandPlanCanvas}
                      on:wheel={handleWaterfallWheel}
                      on:click={passbandTunerComponent.handlePassbandClick}
                      on:mousedown={(e) =>
                        passbandTunerComponent.handleMoveStart(e, 1)}
                      on:touchstart={passbandTunerComponent.handleTouchStart}
                      on:touchmove={passbandTunerComponent.handleTouchMove}
                      on:touchend={passbandTunerComponent.handleTouchEnd}
                      width="1024"
                      height="20"
                    >
                    </canvas>
                    <div class="relative w-full" style="min-height:14px">
                      <button
                        class="absolute top-0 right-0 z-10 text-xs px-1 leading-none rounded"
                        style="background:rgba(0,0,0,0.6);color:{showClients
                          ? '#4ade80'
                          : '#ef4444'};border:1px solid {showClients
                          ? '#4ade80'
                          : '#ef4444'};"
                        on:click={() => (showClients = !showClients)}
                        title="{showClients ? 'Hide' : 'Show'} user labels"
                        >{showClients ? "●" : "○"}</button
                      >
                      <canvas
                        class="w-full bg-black peer"
                        style="display:{showClients ? 'block' : 'none'}"
                        bind:this={clientsCanvas}
                        on:wheel={handleWaterfallWheel}
                        on:click={handleGraduationClick}
                        on:mousemove={handleClientsMouseMove}
                        on:mousedown={(e) =>
                          passbandTunerComponent.handleMoveStart(e, 1)}
                        on:touchstart={passbandTunerComponent.handleTouchStart}
                        on:touchmove={passbandTunerComponent.handleTouchMove}
                        on:touchend={passbandTunerComponent.handleTouchEnd}
                        width="1024"
                        height="20"
                      ></canvas>
                    </div>

                    <!-- Spectrogram Display -->
                    <div
                      class="mt-2 w-full"
                      style="display: {spectrogramEnabled ? 'block' : 'none'}"
                    >
                      <Spectrogram
                        bind:this={spectrogramComponent}
                        minHz={50}
                        maxHzLimit={10000}
                        fftSize={4096}
                        displayGain={spectrogramGain}
                        colorScheme={spectrogramColorScheme}
                        showLabels={true}
                        height={spectrogramHeight}
                        enabled={spectrogramEnabled}
                        on:initialized={initSpectrogram}
                      />
                    </div>

                    <!-- QRSS Grabber Display -->
                    <div
                      class="mt-2 w-full"
                      style="display: {qrssEnabled ? 'block' : 'none'}"
                    >
                      <QrssPanel
                        bind:this={qrssComponent}
                        sampleRate={audio?.audioOutputSps || 12000}
                        mode={qrssMode}
                        centerHz={qrssCenterHz}
                        spanHz={qrssSpanHz}
                        gain={qrssGain}
                        colorScheme={qrssColorScheme}
                        height={qrssHeight}
                        showLabels={true}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div
                class="absolute inset-0 z-20 bg-black bg-opacity-40 backdrop-filter backdrop-blur-sm transition-opacity duration-300 ease-in-out cursor-pointer flex justify-center items-center"
                id="startaudio"
              >
                <div class="text-center p-4 pointer-events-none">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    class="h-12 w-12 mx-auto mb-2 text-white opacity-80"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="1.5"
                      d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
                    />
                  </svg>
                  <p class="text-white text-lg font-medium">
                    Tap to enable audio
                  </p>
                </div>
              </div>

              <!-- Audio Begins -->

              <!-- First Column -->

              <div
                class="flex flex-col xl:flex-row rounded px-5 pt-2 pb-0.5 justify-center rounded y-7"
                id="middle-column"
              >
                <div
                  class="p-5 flex flex-col items-center bg-gray-800 lg:border lg:border-gray-700 rounded-none rounded-t-lg lg:rounded-none lg:rounded-l-lg screw-panel screw-col-1"
                >
                  {#if isV2}
                  <BandSelector
                    {bandArray}
                    {currentBand}
                    {verifyRegion}
                    {printBandButton}
                    onSelect={(index) => handleBandChange(index)}
                  />
                    <!-- End Band Selection -->

                    <div><hr class="border-gray-600 my-2" /></div>

                  <ModesSelector
                    {demodulation}
                    {cquamPilotDetected}
                    {samLocked}
                    {samEnabled}
                    {activeDecoder}
                    onSelect={(mode) => SetMode(mode, true)}
                    onRade={(which) => launchRadeDecoder(which)}
                  />

                    <div style="margin-bottom: 5px; margin-top: 5px;">
                      &nbsp;&nbsp;&nbsp;
                    </div>
                  {/if}

                  <h3
                    class="text-base font-semibold text-gray-100 {isV2
                      ? 'mb-4'
                      : 'mb-6'}"
                  >
                    Audio & Buffer
                  </h3>
                  <div class="control-group" id="volume-slider">
                    <button
                      class="glass-button text-white font-bold rounded-full w-7 h-7 flex items-center justify-center mr-4"
                      style="background: {mute
                        ? 'rgba(255, 0, 0, 0.3)'
                        : 'rgba(255, 255, 255, 0.05)'}"
                      on:click={handleMuteChange}
                      title="Click to mute audio"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        class="w-5 h-5"
                      >
                        {#if mute}
                          <path
                            d="M13.5 4.06c0-1.336-1.616-2.005-2.56-1.06l-4.5 4.5H4.508c-1.141 0-2.318.664-2.66 1.905A9.76 9.76 0 001.5 12c0 .898.121 1.768.35 2.595.341 1.24 1.518 1.905 2.659 1.905h1.93l4.5 4.5c.945.945 2.561.276 2.561-1.06V4.06zM17.78 9.22a.75.75 0 10-1.06 1.06L18.44 12l-1.72 1.72a.75.75 0 001.06 1.06L19.5 13.06l1.72 1.72a.75.75 0 101.06-1.06L20.56 12l1.72-1.72a.75.75 0 00-1.06-1.06L19.5 10.94l-1.72-1.72z"
                          />
                        {:else}
                          <path
                            d="M13.5 4.06c0-1.336-1.616-2.005-2.56-1.06l-4.5 4.5H4.508c-1.141 0-2.318.664-2.66 1.905A9.76 9.76 0 001.5 12c0 .898.121 1.768.35 2.595.341 1.24 1.518 1.905 2.659 1.905h1.93l4.5 4.5c.945.945 2.561.276 2.561-1.06V4.06zM18.584 5.106a.75.75 0 011.06 0c3.808 3.807 3.808 9.98 0 13.788a.75.75 0 11-1.06-1.06 8.25 8.25 0 000-11.668.75.75 0 010-1.06z"
                          />
                        {/if}
                      </svg>
                    </button>
                    &nbsp;&nbsp;&nbsp;
                    <div class="slider-container">
                      <input
                        type="range"
                        bind:value={volume}
                        on:input={handleVolumeChange}
                        title="Audio slider"
                        class="glass-slider"
                        disabled={mute}
                        min="0"
                        max="100"
                        step="1"
                      />
                    </div>
                    <span class="value-display text-sm text-gray-300 ml-4"
                      >{volume}%</span
                    >
                  </div>

                  <div class="control-group mt-1" id="squelch-slider">
                    <button
                      class="glass-button text-white font-bold rounded-full w-7 h-7 flex items-center justify-center mr-4"
                      style="background: {squelchEnable
                        ? 'rgba(255, 100, 0, 0.3)'
                        : 'rgba(255, 255, 255, 0.05)'}"
                      on:click={handleSquelchChange}
                      title="Auto Squelch
Click first to noise-free frequency
to measure noise
Click again to de-activate"
                    >
                      <span class="text-xs font-semibold">SQ</span>
                    </button>
                    &nbsp;&nbsp;&nbsp;
                    <div class="slider-container">
                      <input
                        type="range"
                        bind:value={squelch}
                        on:input={handleSquelchMove}
                        title="Squelch slider"
                        class="glass-slider"
                        min="-150"
                        max="0"
                        step="1"
                      />
                    </div>
                    <span class="value-display text-sm text-gray-300 ml-4"
                      >{squelch}db</span
                    >
                  </div>

                  <!-- AI noise reduction (RNNoise) -->
                  <div class="control-group mt-1" id="ai-nr-slider">
                    <button
                      class="glass-button text-white font-bold rounded-full w-7 h-7 flex items-center justify-center mr-4 {AINREnabled &&
                      !AINRActive
                        ? 'opacity-50'
                        : ''} {AINRLoading ? 'animate-pulse' : ''}"
                      style="background: {AINREnabled
                        ? 'rgba(0, 140, 255, 0.35)'
                        : 'rgba(255, 255, 255, 0.05)'}"
                      on:click={handleAINRChange}
                      title="AI noise reduction (RNNoise)
Voice modes only: USB, LSB, AM
Slider: share of denoised audio, the rest is the original"
                    >
                      <span class="text-xs font-semibold">AI</span>
                    </button>
                    &nbsp;&nbsp;&nbsp;
                    <div class="slider-container">
                      <input
                        type="range"
                        bind:value={AINRStrength}
                        on:input={handleAINRStrength}
                        title="AI strength slider"
                        class="glass-slider"
                        min="0"
                        max="100"
                        step="5"
                      />
                    </div>
                    <span
                      class="value-display text-sm ml-4 {AINREnabled
                        ? 'text-gray-300'
                        : 'text-gray-600'}"
                      >{AINRStrength}%</span
                    >
                  </div>

                  <!-- Audio Buffer Slider -->
                  <div class="control-group mt-1" id="audio-buffer-slider">
                    <button
                      class="glass-button text-white font-bold rounded-full w-7 h-7 flex items-center justify-center mr-4"
                      style="background: {audioBufferDelayEnabled
                        ? 'rgba(30, 255, 0, 0.2)'
                        : 'rgba(255, 255, 255, 0.05)'}"
                      on:click={() =>
                        handleAudioBufferDelayMove((audioBufferDelay += 1))}
                      title="Increase buffer to avoid slow internet issues"
                    >
                      <span class="text-white text-xs font-semibold"
                        ><svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="24"
                          height="24"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="2"
                          stroke-linecap="round"
                          stroke-linejoin="round"
                        >
                          <path d="M6 9a6 6 0 1 0 12 0a6 6 0 0 0 -12 0" />
                          <path
                            d="M12 3c1.333 .333 2 2.333 2 6s-.667 5.667 -2 6"
                          />
                          <path
                            d="M12 3c-1.333 .333 -2 2.333 -2 6s.667 5.667 2 6"
                          />
                          <path d="M6 9h12" />
                          <path d="M3 20h7" />
                          <path d="M14 20h7" />
                          <path d="M10 20a2 2 0 1 0 4 0a2 2 0 0 0 -4 0" />
                          <path d="M12 15v3" />
                        </svg>
                      </span>
                    </button>
                    &nbsp;&nbsp;&nbsp;
                    <div class="slider-container">
                      <input
                        type="range"
                        bind:value={audioBufferDelay}
                        on:input={() => handleAudioBufferDelayMove(audioBufferDelay)}
                        title="Buffer slider"
                        class="glass-slider"
                        min="1"
                        max="6"
                        step="1"
                      />
                    </div>
                    <span class="value-display text-sm text-gray-300 ml-4"
                      >×{audioBufferDelay}</span
                    >
                    <hr class="border-gray-600 my-2" />
                  </div>
                  <!-- End of Buffer -->

                  <div><hr class="border-gray-600 my-2" /></div>

                  <!-- AGC Selection in Desktop -->
                  <div class="flex w-full items-center justify-between mb-2">
                    <h3 class="text-white text-base font-semibold">AGC</h3>
                    <div class="flex items-center gap-2">
                      <button
                        class={`retro-button text-white font-bold h-6 px-3 text-xs rounded-md flex items-center justify-center border border-gray-600 shadow-inner transition-all duration-200 ease-in-out ${
                          compressorEnabled
                            ? "bg-blue-600 pressed scale-95"
                            : "bg-gray-700 hover:bg-gray-600"
                        }`}
                        on:click={toggleCompPopup}
                      >
                        <span>Compressor</span>
                      </button>
                      <button
                        class={`retro-button text-white font-bold h-6 px-3 text-xs rounded-md flex items-center justify-center border border-gray-600 shadow-inner transition-all duration-200 ease-in-out ${
                          eqEnabled
                            ? "bg-blue-600 pressed scale-95"
                            : "bg-gray-700 hover:bg-gray-600"
                        }`}
                        on:click={toggleEqPopup}
                      >
                        <span>Equalizer</span>
                      </button>
                    </div>
                  </div>

                  <!-- Equalizer Popup -->
                  {#if showEqPopup}
                    <div
                      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
                      on:click={toggleEqPopup}
                    >
                      <div
                        class="p-6 rounded-lg max-w-lg w-full max-h-[80vh] flex flex-col decoder-window popup-panel"
                        on:click|stopPropagation
                      >
                        <div class="flex justify-between items-center mb-4">
                          <h2 class="text-base font-bold text-white">
                            Equalizer
                          </h2>
                          <button
                            class="text-gray-400 hover:text-white"
                            on:click={toggleEqPopup}
                          >
                            <svg
                              class="w-6 h-6"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                              xmlns="http://www.w3.org/2000/svg"
                            >
                              <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                stroke-width="2"
                                d="M6 18L18 6M6 6l12 12"
                              ></path>
                            </svg>
                          </button>
                        </div>

                        <!-- Enable toggle -->
                        <div class="flex items-center justify-between mb-4">
                          <span class="text-white text-sm font-semibold"
                            >Enable Equalizer</span
                          >
                          <button
                            class={`retro-button text-white font-bold h-8 px-4 text-sm rounded-md flex items-center justify-center border border-gray-600 shadow-inner transition-all duration-200 ease-in-out ${
                              eqEnabled
                                ? "bg-blue-600 pressed scale-95"
                                : "bg-gray-700 hover:bg-gray-600"
                            }`}
                            on:click={handleEqEnableToggle}
                          >
                            <span>{eqEnabled ? "On" : "Off"}</span>
                          </button>
                        </div>

                        <!-- Band sliders -->
                        <div class="flex flex-col gap-3">
                          {#each eqBandLabels as label, i}
                            <div class="flex items-center gap-3">
                              <span
                                class="text-gray-300 text-xs w-14 text-right"
                                >{label}</span
                              >
                              <div class="slider-container flex-1 mx-0">
                                <input
                                  type="range"
                                  min="-12"
                                  max="12"
                                  step="1"
                                  bind:value={eqGains[i]}
                                  on:input={() => handleEqBandChange(i)}
                                  title="{label} band"
                                  class="glass-slider"
                                />
                              </div>
                              <span
                                class="text-gray-300 text-xs w-12 text-right"
                                >{eqGains[i]} dB</span
                              >
                            </div>
                          {/each}
                        </div>

                        <!-- Reset -->
                        <div class="mt-4 flex justify-end">
                          <button
                            class="retro-button text-white font-bold h-8 px-4 text-sm rounded-md flex items-center justify-center border border-gray-600 shadow-inner bg-gray-700 hover:bg-gray-600 transition-all duration-200 ease-in-out"
                            on:click={handleEqReset}
                          >
                            <span>Reset</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  {/if}
                  <!-- End Equalizer Popup -->

                  <!-- Compressor Popup -->
                  {#if showCompPopup}
                    <div
                      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
                      on:click={toggleCompPopup}
                    >
                      <div
                        class="p-6 rounded-lg max-w-lg w-full max-h-[80vh] flex flex-col overflow-y-auto decoder-window popup-panel"
                        on:click|stopPropagation
                      >
                        <div class="flex justify-between items-center mb-4">
                          <h2 class="text-base font-bold text-white">
                            Compressor
                          </h2>
                          <button
                            class="text-gray-400 hover:text-white"
                            on:click={toggleCompPopup}
                          >
                            <svg
                              class="w-6 h-6"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                              xmlns="http://www.w3.org/2000/svg"
                            >
                              <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                stroke-width="2"
                                d="M6 18L18 6M6 6l12 12"
                              ></path>
                            </svg>
                          </button>
                        </div>

                        <!-- Enable toggle -->
                        <div class="flex items-center justify-between mb-4">
                          <span class="text-white text-sm font-semibold"
                            >Enable Compressor</span
                          >
                          <button
                            class={`retro-button text-white font-bold h-8 px-4 text-sm rounded-md flex items-center justify-center border border-gray-600 shadow-inner transition-all duration-200 ease-in-out ${
                              compressorEnabled
                                ? "bg-blue-600 pressed scale-95"
                                : "bg-gray-700 hover:bg-gray-600"
                            }`}
                            on:click={handleCompressorToggle}
                          >
                            <span>{compressorEnabled ? "On" : "Off"}</span>
                          </button>
                        </div>

                        <!-- Regulators -->
                        <div class="flex flex-col gap-3">
                          <div class="flex items-center gap-3">
                            <span class="text-gray-300 text-xs w-20 text-right"
                              >Threshold</span
                            >
                            <div class="slider-container flex-1 mx-0">
                              <input
                                type="range"
                                min="-60"
                                max="0"
                                step="1"
                                bind:value={compThreshold}
                                on:input={handleCompThreshold}
                                title="Threshold"
                                class="glass-slider"
                              />
                            </div>
                            <span class="text-gray-300 text-xs w-16 text-right"
                              >{compThreshold} dB</span
                            >
                          </div>

                          <div class="flex items-center gap-3">
                            <span class="text-gray-300 text-xs w-20 text-right"
                              >Ratio</span
                            >
                            <div class="slider-container flex-1 mx-0">
                              <input
                                type="range"
                                min="1"
                                max="20"
                                step="0.5"
                                bind:value={compRatio}
                                on:input={handleCompRatio}
                                title="Ratio"
                                class="glass-slider"
                              />
                            </div>
                            <span class="text-gray-300 text-xs w-16 text-right"
                              >{compRatio}:1</span
                            >
                          </div>

                          <div class="flex items-center gap-3">
                            <span class="text-gray-300 text-xs w-20 text-right"
                              >Attack</span
                            >
                            <div class="slider-container flex-1 mx-0">
                              <input
                                type="range"
                                min="0"
                                max="0.1"
                                step="0.001"
                                bind:value={compAttack}
                                on:input={handleCompAttack}
                                title="Attack"
                                class="glass-slider"
                              />
                            </div>
                            <span class="text-gray-300 text-xs w-16 text-right"
                              >{Math.round(compAttack * 1000)} ms</span
                            >
                          </div>

                          <div class="flex items-center gap-3">
                            <span class="text-gray-300 text-xs w-20 text-right"
                              >Release</span
                            >
                            <div class="slider-container flex-1 mx-0">
                              <input
                                type="range"
                                min="0.01"
                                max="1"
                                step="0.01"
                                bind:value={compRelease}
                                on:input={handleCompRelease}
                                title="Release"
                                class="glass-slider"
                              />
                            </div>
                            <span class="text-gray-300 text-xs w-16 text-right"
                              >{Math.round(compRelease * 1000)} ms</span
                            >
                          </div>

                          <div class="flex items-center gap-3">
                            <span class="text-gray-300 text-xs w-20 text-right"
                              >Knee</span
                            >
                            <div class="slider-container flex-1 mx-0">
                              <input
                                type="range"
                                min="0"
                                max="40"
                                step="1"
                                bind:value={compKnee}
                                on:input={handleCompKnee}
                                title="Knee"
                                class="glass-slider"
                              />
                            </div>
                            <span class="text-gray-300 text-xs w-16 text-right"
                              >{compKnee} dB</span
                            >
                          </div>

                          <div class="flex items-center gap-3">
                            <span class="text-gray-300 text-xs w-20 text-right"
                              >Makeup</span
                            >
                            <div class="slider-container flex-1 mx-0">
                              <input
                                type="range"
                                min="0"
                                max="4"
                                step="0.1"
                                bind:value={compMakeup}
                                on:input={handleCompMakeup}
                                disabled={compAuto}
                                title="Makeup gain"
                                class="glass-slider"
                              />
                            </div>
                            <span class="text-gray-300 text-xs w-16 text-right"
                              >{compMakeup}×</span
                            >
                          </div>
                          <div class="flex items-center gap-3">
                            <span class="text-gray-300 text-xs w-20 text-right"
                              >Auto</span
                            >
                            <label
                              class="flex items-center gap-2 flex-1 cursor-pointer"
                            >
                              <input
                                type="checkbox"
                                bind:checked={compAuto}
                                on:change={handleCompAutoToggle}
                              />
                              <span class="text-gray-300 text-xs"
                                >Auto makeup (tracks threshold &amp; ratio)</span
                              >
                            </label>
                            <span class="text-gray-300 text-xs w-16 text-right"
                            ></span>
                          </div>
                        </div>

                        <!-- Reset -->
                        <div class="mt-4 flex justify-end">
                          <button
                            class="retro-button text-white font-bold h-8 px-4 text-sm rounded-md flex items-center justify-center border border-gray-600 shadow-inner bg-gray-700 hover:bg-gray-600 transition-all duration-200 ease-in-out"
                            on:click={handleCompReset}
                          >
                            <span>Reset</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  {/if}
                  <!-- End Compressor Popup -->
                  <div class="w-full mb-6">
                    <div id="moreoptions" class="grid grid-cols-4 gap-2">
                      {#each [{ option: "Auto", AGCbutton: 0 }, { option: "Fast", AGCbutton: 1 }, { option: "Medium", AGCbutton: 2 }, { option: "Slow", AGCbutton: 3 }] as { option, AGCbutton }}
                        <button
                          class={`retro-button text-white font-bold h-8 text-sm rounded-md flex items-center justify-center border border-gray-600 shadow-inner transition-all duration-200 ease-in-out ${
                            AGCbutton == currentAGC
                              ? "bg-blue-600 pressed scale-95"
                              : "bg-gray-700 hover:bg-gray-600"
                          }`}
                          on:click={() => handleAGCChange(AGCbutton)}
                        >
                          <span>{option}</span>
                        </button>
                      {/each}
                    </div>
                  </div>
                  <!-- End AGC Section in Desktop -->

                  <!-- Begin Filter Selection -->
                  <div class="flex w-full items-center justify-between mb-2">
                    <h3 class="text-white text-base font-semibold">Filters</h3>
                    <div class="flex items-center gap-2">
                      <!-- Backend Noise Gate Toggle Button -->
                      <button
                        class="text-xs px-3 py-1 rounded-md font-semibold transition-all duration-200 {backendNoiseGateEnabled
                          ? 'bg-blue-600 text-white shadow-lg'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}"
                        on:click={toggleBackendNoiseGate}
                        title="Enable/disable backend noise gate"
                      >
                        Gate: {backendNoiseGateEnabled ? "ON" : "OFF"}
                      </button>

                      <!-- Preset Dropdown (only active when gate is ON) -->
                      <label for="noise-gate-preset" class="text-white text-sm"
                        >Preset:</label
                      >
                      <select
                        id="noise-gate-preset"
                        bind:value={noiseGatePreset}
                        on:change={handleNoiseGatePresetChange}
                        disabled={!backendNoiseGateEnabled}
                        class="glass-select text-white text-xs px-2 py-1 rounded-md cursor-pointer focus:outline-none {!backendNoiseGateEnabled
                          ? 'opacity-50 cursor-not-allowed'
                          : ''}"
                      >
                        <option value="balanced">Balanced</option>
                        <option value="aggressive">Aggressive</option>
                        <option value="weak-signal">Weak Signal</option>
                        <option value="smooth">Smooth</option>
                        <option value="maximum">Maximum</option>
                        <option value="cw">CW/Digital</option>
                        <option value="am-fm">AM/FM</option>
                      </select>
                    </div>
                  </div>
                  <div class="w-full mb-6">
                    <div id="moreoptions" class="grid grid-cols-5 gap-2">
                      {#each [{ option: "NR", icon: "wave-square", enabled: NREnabled }, { option: "NB", icon: "zap", enabled: NBEnabled }, { option: "NS", icon: "waves", enabled: NSEnabled }, { option: "AN", icon: "shield", enabled: ANEnabled }, { option: "CTCSS", icon: "filter", enabled: CTCSSSupressEnabled }] as { option, icon, enabled }}
                        <button
                          class="retro-button h-8 text-white font-bold h-8 text-xs rounded-md flex items-center justify-center border border-gray-600 shadow-inner transition-all duration-200 ease-in-out {enabled
                            ? 'bg-blue-600 pressed scale-95'
                            : 'bg-gray-700 hover:bg-gray-600'}"
                          on:click={() => {
                            if (option === "NR") handleNRChange();
                            else if (option === "NB") handleNBChange();
                            else if (option === "NS") handleNSChange();
                            else if (option === "AN") handleANChange();
                            else handleCTCSSChange();
                          }}
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            class="h-4 w-4 mr-2"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                          >
                            {#if icon === "wave-square"}
                              <path
                                d="M0 15h3v-3h3v3h3v-3h3v3h3v-3h3v3h3v-3h3"
                              />
                            {:else if icon === "zap"}
                              <polygon
                                points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"
                              />
                            {:else if icon === "waves"}
                              <path
                                d="M2 6c1.5-2 3.5-2 5 0s3.5 2 5 0 3.5-2 5 0 3.5 2 5 0"
                              />
                              <path
                                d="M2 12c1.5-2 3.5-2 5 0s3.5 2 5 0 3.5-2 5 0 3.5 2 5 0"
                              />
                              <path
                                d="M2 18c1.5-2 3.5-2 5 0s3.5 2 5 0 3.5-2 5 0 3.5 2 5 0"
                              />
                            {:else if icon === "shield"}
                              <path
                                d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"
                              />
                            {:else if icon === "filter"}
                              <polygon
                                points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"
                              />
                            {/if}
                          </svg>
                          <span>{option}</span>
                        </button>
                      {/each}
                    </div>
                    <!-- End Filter Selection -->
                  </div>

                  {#if !isV2}
                  <ModesSelector
                    {demodulation}
                    {cquamPilotDetected}
                    {samLocked}
                    {samEnabled}
                    {activeDecoder}
                    onSelect={(mode) => SetMode(mode, true)}
                    onRade={(which) => launchRadeDecoder(which)}
                  />

                    <div><hr class="border-gray-600 my-2" /></div>

                  <BandSelector
                    {bandArray}
                    {currentBand}
                    {verifyRegion}
                    {printBandButton}
                    onSelect={(index) => handleBandChange(index)}
                  />
                  {/if}
                </div>

                <!-- Audio Ends -->

                <!-- Second Column -->

                <div
                  class="flex flex-col items-center bg-gray-800 p-6 border-l-0 border-r-0 border border-gray-700 screw-panel screw-col-2"
                >
                  <div
                    class="bg-black rounded-lg p-8 {isAnalog
                      ? 'min-w-40'
                      : 'min-w-80 lg:min-h-[227px] lg:flex lg:flex-col lg:justify-center'} lg:min-w-0 lg:p-4 mb-4 w-full"
                    id="smeter-tut"
                  >
                    <div
                      class="flex flex-col sm:flex-row items-center justify-between gap-4"
                    >
                      <div class="flex flex-col items-center">
                        <!--
                  Added by sv2amk to triger the initBandButton function
                  and show the proper band upon startup                  
-->
                        {#if isAnalog}
                          <div
                            class="flex items-center justify-center text-xs w-48"
                          >
                            <span class="date-time text-cyan-300 px-1"
                              >{time}
                            </span>
                          </div>
                          <div><hr class="border-gray-600 my-2" /></div>
                        {/if}
                        {#if currentBand == -2}
                          {initBandButton(frequency)}
                        {/if}
                        <!-- Digit-by-digit frequency tuner -->
                        <div class="relative mb-2">
                          <div
                            class="flex items-center justify-center font-mono select-none rounded-lg px-2 py-1 bg-black border cursor-default focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-colors duration-100 {frameHovered
                              ? 'border-cyan-500'
                              : 'border-gray-700'}"
                            use:handleDigitWheel
                            title="Hover a digit and scroll to tune · Right-click to type"
                            on:contextmenu={handleDigitContextMenu}
                            on:mouseenter={handleFreqFrameMouseEnter}
                            on:mouseleave={handleFreqFrameMouseLeave}
                          >
                            {#each freqDigitChars as d}
                              <span
                                class="text-[1.65rem] sm:text-[2rem] w-[1.02rem] sm:w-[1.1rem] text-center rounded transition-colors duration-100 {hoveredDigitIdx ===
                                d.idx
                                  ? 'bg-cyan-600 text-white'
                                  : d.dim
                                    ? 'text-gray-600 hover:text-gray-400'
                                    : 'text-cyan-300 hover:text-cyan-100'}"
                                on:mouseenter={() =>
                                  handleDigitMouseEnter(d.idx)}
                                on:mouseleave={handleDigitMouseLeave}
                                >{d.ch}</span
                              >
                              {#if d.idx === 2}
                                <span
                                  class="text-gray-500 text-2xl w-3 text-center"
                                  >,</span
                                >
                              {/if}
                              {#if d.idx === 5}
                                <span
                                  class="text-gray-400 text-2xl w-3 text-center"
                                  >.</span
                                >
                              {/if}
                            {/each}
                          </div>
                          {#if showFreqInput}
                            <div
                              class="absolute inset-0 flex items-center justify-center bg-black rounded-lg border border-cyan-500 z-50"
                            >
                              <input
                                class="w-full text-center bg-transparent text-cyan-300 text-2xl font-mono focus:outline-none px-2"
                                type="text"
                                inputmode="decimal"
                                bind:value={freqInputValue}
                                on:keydown={handleFreqInputKey}
                                on:blur={commitFreqInput}
                                use:focusOnMount
                              />
                            </div>
                          {/if}
                        </div>

                        <div
                          class="flex items-center justify-center text-xs w-48"
                        >
                          <span class="text-cyan-400 px-1"
                            >Current Band:&nbsp;{bandName}</span
                          >
                        </div>

                        <div
                          class="flex items-center justify-center text-xs w-48"
                        >
                          <span class="text-yellow-400 px-1">{vfo}</span>
                          <span class="text-gray-400 px-1">|</span>
                          <span class="text-green-400 px-1">{demodulation}</span
                          >
                          <span class="text-gray-400 px-1">|</span>
                          <span class="text-cyan-300 px-1">{bandwidth} kHz</span
                          >
                        </div>

                        {#if isAnalog}
                          <div><hr class="border-gray-600 my-2" /></div>
                          <StatusIndicators
                            {mute}
                            {squelchEnable}
                            {AINREnabled}
                            AINRBypassed={AINREnabled && !AINRActive}
                            {NREnabled}
                            {NBEnabled}
                            {NSEnabled}
                            {ANEnabled}
                            {CTCSSSupressEnabled}
                          />
                        {/if}
                      </div>

                      <div class="flex flex-col items-center">
                        {#if !isAnalog}
                          <div class="flex space-x-2 mb-1">
                            <span
                              class="date-time"
                              style="color:rgba(0, 225, 255, 0.993)"
                              >Time: {time}
                            </span>
                          </div>
                          <StatusIndicators
                            wide
                            {mute}
                            {squelchEnable}
                            {AINREnabled}
                            AINRBypassed={AINREnabled && !AINRActive}
                            {NREnabled}
                            {NBEnabled}
                            {NSEnabled}
                            {ANEnabled}
                            {CTCSSSupressEnabled}
                          />
                          <SMeterDigital rawDb={smeterRawDb} {smeterOffset} />
                        {:else}
                          <SMeterAnalog dbm={smeterDbm} />
                        {/if}
                      </div>
                    </div>
                  </div>

                  <div id="frequencyContainer" class="w-full mt-1 sm:mt-1">
                    <div class="space-y-5">
                      <!-- Begin Fine Tuning Buttons -->

                      <div class="w-full mt-0">
                        <!-- Label hard left, scanner hard right, one line -->
                        <div
                          class="flex items-center justify-between gap-2 mb-2"
                        >
                          <h3 class="text-white text-base font-semibold">
                            Fine Tuning (kHz)
                          </h3>
                          <div class="flex items-center gap-1 relative">
                            <!-- Status, fixed width so the row never jitters:
                                 idle = the word, scanning = where the scan has
                                 got to, parked = the countdown to resume. -->
                            <span
                              class="text-white text-sm font-semibold mr-1 text-right tabular-nums min-w-[5.5rem]"
                              title={scan.running
                                ? `Scanning ${scan.dir > 0 ? "up" : "down"} — threshold ${scan.thresholdDb} dB over the noise floor`
                                : "Channel scanner"}
                            >
                              {#if scan.parked}
                                <!-- Three different states used to read "hold",
                                     which made a channel that is simply still
                                     busy look like the Hold setting. -->
                                ◉ {scan.resumeInMs != null
                                  ? `${Math.ceil(scan.resumeInMs / 1000)}s`
                                  : scan.stayLeftMs != null
                                    ? `${scan.snrDb == null ? "" : Math.round(scan.snrDb)}·${Math.ceil(scan.stayLeftMs / 1000)}s`
                                    : scan.resumeMs === 0
                                      ? "hold"
                                      : `busy ${scan.snrDb == null ? "" : Math.round(scan.snrDb)}`}
                              {:else if scan.running}
                                {((scan.cursorHz || 0) / 1e3).toFixed(1)}
                              {:else}
                                Scanner
                              {/if}
                            </span>
                            <button
                              id="scanner-down"
                              class="retro-button text-white h-7 w-7 rounded-md flex items-center justify-center border border-gray-600 shadow-inner transition-all duration-200 ease-in-out {scan.running &&
                              scan.dir === -1
                                ? scan.parked
                                  ? 'bg-amber-600 pressed scale-95'
                                  : 'bg-green-600 pressed scale-95'
                                : 'bg-gray-700 hover:bg-gray-600'}"
                              on:click={() => scanner.start(-1)}
                              title="Scan down in {scannerStepKHz} kHz steps — resumes when parked"
                            >
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                class="h-4 w-4"
                                viewBox="0 0 20 20"
                                fill="currentColor"
                              >
                                <path
                                  fill-rule="evenodd"
                                  d="M12.707 15.707a1 1 0 01-1.414 0l-5-5a1 1 0 010-1.414l5-5a1 1 0 111.414 1.414L8.414 10l4.293 4.293a1 1 0 010 1.414z"
                                  clip-rule="evenodd"
                                />
                              </svg>
                            </button>
                            <button
                              id="scanner-stop"
                              class="retro-button text-white h-7 w-7 rounded-md flex items-center justify-center border border-gray-600 shadow-inner transition-all duration-200 ease-in-out {scan.running
                                ? 'bg-red-700 hover:bg-red-600'
                                : 'bg-gray-700 opacity-40'}"
                              on:click={() => scanner.stop()}
                              title="Stop the scan"
                            >
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                class="h-3 w-3"
                                viewBox="0 0 20 20"
                                fill="currentColor"
                              >
                                <rect x="3" y="3" width="14" height="14" rx="2" />
                              </svg>
                            </button>
                            <button
                              id="scanner-up"
                              class="retro-button text-white h-7 w-7 rounded-md flex items-center justify-center border border-gray-600 shadow-inner transition-all duration-200 ease-in-out {scan.running &&
                              scan.dir === 1
                                ? scan.parked
                                  ? 'bg-amber-600 pressed scale-95'
                                  : 'bg-green-600 pressed scale-95'
                                : 'bg-gray-700 hover:bg-gray-600'}"
                              on:click={() => scanner.start(1)}
                              title="Scan up in {scannerStepKHz} kHz steps — resumes when parked"
                            >
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                class="h-4 w-4"
                                viewBox="0 0 20 20"
                                fill="currentColor"
                              >
                                <path
                                  fill-rule="evenodd"
                                  d="M7.293 15.707a1 1 0 010-1.414L11.586 10 7.293 5.707a1 1 0 011.414-1.414l5 5a1 1 0 010 1.414l-5 5a1 1 0 01-1.414 0z"
                                  clip-rule="evenodd"
                                />
                              </svg>
                            </button>
                            <button
                              id="scanner-lock"
                              class="retro-button text-white h-7 w-7 rounded-md flex items-center justify-center border border-gray-600 shadow-inner transition-all duration-200 ease-in-out {scan.locked
                                ? 'bg-red-700'
                                : 'bg-gray-700 hover:bg-gray-600'} {scan.parked
                                ? ''
                                : 'opacity-40'}"
                              on:click={() => scanner.lockCurrent()}
                              title="Lock this channel out of the scan and carry on — for a birdie or a permanent carrier"
                            >
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                class="h-4 w-4"
                                viewBox="0 0 20 20"
                                fill="currentColor"
                              >
                                <path
                                  fill-rule="evenodd"
                                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM5.05 5.05a7 7 0 019.9 9.9l-9.9-9.9z"
                                  clip-rule="evenodd"
                                />
                              </svg>
                            </button>
                            <button
                              id="scanner-threshold"
                              class="retro-button text-white font-bold h-7 px-2 text-xs rounded-md flex items-center justify-center border border-gray-600 shadow-inner transition-all duration-200 ease-in-out bg-gray-700 hover:bg-gray-600"
                              on:click={() =>
                                (showScannerThreshold = !showScannerThreshold)}
                              title="Scanner threshold — the scan stops on the first channel this far above the band noise floor"
                            >
                              {scan.thresholdDb} dB{scan.running &&
                              scan.snrDb != null
                                ? ` · ${Math.round(scan.snrDb)}`
                                : ""} ▾
                            </button>
                            {#if showScannerThreshold}
                              <!-- Laid out in rows of small cells rather than
                                   one long list: fifteen full-width entries ran
                                   off the bottom of the page and made the user
                                   scroll to reach the threshold. -->
                              <div
                                class="z-50 p-2 rounded-md decoder-window popup-panel w-64"
                                use:keepInView={{
                                  anchor: "#scanner-threshold",
                                  onOutside: () =>
                                    (showScannerThreshold = false),
                                }}
                              >
                                <div
                                  class="text-[10px] uppercase tracking-wide text-gray-400 mb-1"
                                >
                                  Range{scan.loHz == null
                                    ? ""
                                    : ` · ${(scan.loHz / 1e3).toFixed(0)}–${(scan.hiHz / 1e3).toFixed(0)} kHz`}
                                </div>
                                <div class="grid grid-cols-2 gap-1">
                                  {#each scannerRangeModes as m}
                                    <button
                                      class="px-2 py-1 text-xs rounded text-center {m ===
                                      scan.rangeMode
                                        ? 'bg-green-600 text-white'
                                        : 'text-gray-200 bg-gray-700 hover:bg-gray-600'}"
                                      on:click={() => scanner.setRangeMode(m)}
                                      title={scannerRangeHint[m]}
                                    >
                                      {scannerRangeLabel[m]}
                                    </button>
                                  {/each}
                                </div>
                                <div
                                  class="text-[10px] uppercase tracking-wide text-gray-400 mt-2 mb-1"
                                >
                                  Scan
                                </div>
                                <div class="grid grid-cols-2 gap-1">
                                  {#each scannerSweepModes as m}
                                    <button
                                      class="px-2 py-1 text-xs rounded text-center {m ===
                                      scan.sweepMode
                                        ? 'bg-green-600 text-white'
                                        : 'text-gray-200 bg-gray-700 hover:bg-gray-600'}"
                                      on:click={() => scanner.setSweepMode(m)}
                                      title={scannerSweepHint[m]}
                                    >
                                      {scannerSweepLabel[m]}
                                    </button>
                                  {/each}
                                </div>
                                <div
                                  class="text-[10px] uppercase tracking-wide text-gray-400 mt-2 mb-1"
                                >
                                  Stop at (dB over noise)
                                </div>
                                <div class="grid grid-cols-3 gap-1">
                                  {#each scannerThresholds as t}
                                    <button
                                      class="px-2 py-1 text-xs font-mono rounded text-center {t ===
                                      scan.thresholdDb
                                        ? 'bg-green-600 text-white'
                                        : 'text-gray-200 bg-gray-700 hover:bg-gray-600'}"
                                      on:click={() => scanner.setThreshold(t)}
                                      title="{t} dB over the band noise floor, which the waterfall tracks continuously"
                                    >
                                      +{t}
                                    </button>
                                  {/each}
                                </div>
                                <div
                                  class="text-[10px] uppercase tracking-wide text-gray-400 mt-2 mb-1"
                                >
                                  Resume after
                                </div>
                                <div class="grid grid-cols-4 gap-1">
                                  {#each scannerResumeChoices as ms}
                                    <button
                                      class="px-1 py-1 text-xs font-mono rounded text-center {ms ===
                                      scan.resumeMs
                                        ? 'bg-green-600 text-white'
                                        : 'text-gray-200 bg-gray-700 hover:bg-gray-600'}"
                                      on:click={() => scanner.setResume(ms)}
                                      title={ms === 0
                                        ? "Stay on the channel until an arrow is pressed"
                                        : `Carry on once the channel has been quiet for ${ms / 1000} seconds`}
                                    >
                                      {scannerResumeLabel(ms)}
                                    </button>
                                  {/each}
                                </div>
                                <div
                                  class="text-[10px] uppercase tracking-wide text-gray-400 mt-2 mb-1"
                                >
                                  Max stay
                                </div>
                                <div class="grid grid-cols-4 gap-1">
                                  {#each scannerMaxStayChoices as ms}
                                    <button
                                      class="px-1 py-1 text-xs font-mono rounded text-center {ms ===
                                      scan.maxStayMs
                                        ? 'bg-green-600 text-white'
                                        : 'text-gray-200 bg-gray-700 hover:bg-gray-600'}"
                                      on:click={() => scanner.setMaxStay(ms)}
                                      title={ms === 0
                                        ? "Stay as long as the signal lasts — a permanent carrier will hold the scan"
                                        : `Move on after ${scannerStayLabel(ms)} even if the signal is still there`}
                                    >
                                      {scannerStayLabel(ms)}
                                    </button>
                                  {/each}
                                </div>
                                {#if scan.lockCount > 0}
                                  <button
                                    class="mt-2 w-full px-2 py-1 text-xs font-mono rounded text-gray-200 bg-gray-700 hover:bg-gray-600"
                                    on:click={() => {
                                      scanner.clearLocks();
                                      showScannerThreshold = false;
                                    }}
                                  >
                                    Clear {scan.lockCount} locked
                                  </button>
                                {/if}
                              </div>
                            {/if}
                          </div>
                        </div>
                        <div class="grid grid-cols-5 sm:grid-cols-11 gap-2">
                          {#each finetuningsteps as finetuningstep}
                            <button
                              id="fine-tuning-selector"
                              class="retro-button text-white font-bold h-7 text-sm rounded-md flex items-center justify-center border border-gray-600 shadow-inner transition-all duration-200 ease-in-out bg-gray-700 hover:bg-gray-600"
                              on:click={() =>
                                handleFineTuningStep(finetuningstep)}
                              title="{finetuningstep} kHz"
                            >
                              {finetuningstep}
                            </button>
                          {/each}
                        </div>
                        <hr class="border-gray-600 my-2" />
                      </div>

                      <!-- Phil -->
                      <!-- Begin Popup Buttons Menu -->
                      <div class="w-full mt-4">
                        <div class="grid grid-cols-5 sm:grid-cols-5 gap-2">
                          <button
                            id="vfo-ab-button"
                            class="glass-button h-8 text-white text-sm font-bold py-2 px-1 rounded-lg flex items-center w-full justify-center whitespace-nowrap {toggleVFO ===
                            vfo
                              ? 'bg-green-600 pressed scale-95'
                              : 'bg-blue-700 hover:bg-gray-600'}"
                            on:click={() => toggleVFO(vfo)}
                            title="VFO Toggle"
                          >
                            {vfo}
                          </button>

                          <button
                            id="mode-button"
                            class="glass-button h-8 text-white text-sm font-bold py-2 px-1 rounded-lg flex items-center w-full justify-center whitespace-nowrap"
                            on:click={toggleModePopup}
                          >
                            Modes
                          </button>
                          <!-- Mode Popup -->
                          {#if showModePopup}
                            <div
                              class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
                              on:click={toggleModePopup}
                            >
                              <div
                                class="p-6 rounded-lg max-w-lg w-full max-h-[80vh] flex flex-col decoder-window popup-panel"
                                on:click|stopPropagation
                              >
                                <div
                                  class="flex justify-between items-center mb-4"
                                >
                                  <h2 class="text-base font-bold text-white">
                                    Modes
                                  </h2>
                                  <button
                                    class="text-gray-400 hover:text-white"
                                    on:click={toggleModePopup}
                                  >
                                    <svg
                                      class="w-6 h-6"
                                      fill="none"
                                      stroke="currentColor"
                                      viewBox="0 0 24 24"
                                      xmlns="http://www.w3.org/2000/svg"
                                    >
                                      <path
                                        stroke-linecap="round"
                                        stroke-linejoin="round"
                                        stroke-width="2"
                                        d="M6 18L18 6M6 6l12 12"
                                      ></path>
                                    </svg>
                                  </button>
                                </div>
                                <!--Mode Content Begins -->
                                <div
                                  id="demodulationModes"
                                  class="grid grid-cols-3 sm:grid-cols-6 gap-2 w-full max-w-md"
                                >
                                  {#each ["USB", "LSB", "CW", "AM", "QUAM", "FM"] as mode}
                                    <button
                                      class="retro-button {mode === 'QUAM' &&
                                      cquamPilotDetected
                                        ? 'text-green-400 font-bold'
                                        : mode === 'AM' && samLocked
                                          ? 'text-yellow-400 font-bold'
                                          : 'text-white'} font-bold h-10 text-base rounded-md flex items-center justify-center border border-gray-600 shadow-inner transition-all duration-200 ease-in-out {demodulation ===
                                      mode
                                        ? 'bg-blue-600 pressed scale-95'
                                        : 'bg-gray-700 hover:bg-gray-600'}"
                                      on:click={() => setModePopup(mode)}
                                      >{mode === "AM" &&
                                      demodulation === "AM" &&
                                      samEnabled
                                        ? "SAM"
                                        : mode}
                                    </button>
                                  {/each}
                                </div>
                                <!-- RADE v1 one-touch decoder launch -->
                                <div
                                  class="grid grid-cols-2 gap-2 w-full max-w-md mt-3"
                                >
                                  {#each [["RADEL", "radel"], ["RADEU", "radeu"]] as [label, key]}
                                    <button
                                      class="retro-button text-white font-bold h-10 text-base rounded-md flex items-center justify-center border border-gray-600 shadow-inner transition-all duration-200 ease-in-out {activeDecoder ===
                                      key
                                        ? 'bg-blue-600 pressed scale-95'
                                        : 'bg-gray-700 hover:bg-gray-600'}"
                                      title="Start the RADE v1 {label} decoder"
                                      on:click={() => launchRadeDecoder(label)}
                                    >
                                      {label}
                                    </button>
                                  {/each}
                                </div>
                                <!-- End of Mode Content -->
                              </div>
                            </div>
                          {/if}
                          <!-- End of Modes Popup Menu -->

                          <!-- Begin Bands Popup Menu -->
                          <button
                            id="band-popup-button"
                            class="glass-button h-8 text-white text-sm font-bold py-2 px-1 rounded-lg flex items-center w-full justify-center whitespace-nowrap"
                            on:click={toggleBandPopup}
                          >
                            Bands
                          </button>

                          <!-- Bands Popup -->
                          {#if showBandPopup}
                            <div
                              class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
                              on:click={toggleBandPopup}
                            >
                              <div
                                class="p-6 rounded-lg max-w-lg w-full max-h-[80vh] flex flex-col decoder-window popup-panel"
                                on:click|stopPropagation
                              >
                                <div
                                  class="flex justify-between items-center mb-4"
                                >
                                  <h2 class="text-base font-bold text-white">
                                    Bands
                                  </h2>
                                  <button
                                    class="text-gray-400 hover:text-white"
                                    on:click={toggleBandPopup}
                                  >
                                    <svg
                                      class="w-6 h-6"
                                      fill="none"
                                      stroke="currentColor"
                                      viewBox="0 0 24 24"
                                      xmlns="http://www.w3.org/2000/svg"
                                    >
                                      <path
                                        stroke-linecap="round"
                                        stroke-linejoin="round"
                                        stroke-width="2"
                                        d="M6 18L18 6M6 6l12 12"
                                      ></path>
                                    </svg>
                                  </button>
                                </div>
                                <!-- Content Starts -->

                                <div
                                  class="grid grid-cols-5 sm:grid-cols-5 gap-2"
                                >
                                  {#each bandArray as bandData, index}
                                    {#if verifyRegion(bandData.ITU)}
                                      {#if bandData.publishBand == 1}
                                        {#if printBandButton(bandData.startFreq, bandData.endFreq, bandData.publishBand)}
                                          <button
                                            id="band-selector"
                                            class="retro-button text-sm text-white fontrbold h-7 text-base rounded-md flex items-center justify-center border border-gray-600 shadow-inner transition-all duration-200 ease-in-out {currentBand ===
                                            index
                                              ? 'bg-blue-600 pressed scale-95'
                                              : 'bg-gray-700 hover:bg-gray-600'}"
                                            on:click={() =>
                                              handleBandChangePopup(index)}
                                            title={bandData.name}
                                            >{bandData.name}
                                          </button>
                                        {/if}
                                      {/if}
                                    {:else}{/if}
                                  {/each}
                                </div>
                                <div><hr class="border-gray-600 my-2" /></div>
                                <div
                                  class="grid grid-cols-5 sm:grid-cols-5 gap-2"
                                >
                                  {#each bandArray as bandData, index}
                                    {#if verifyRegion(bandData.ITU)}
                                      {#if bandData.publishBand == 2}
                                        {#if printBandButton(bandData.startFreq, bandData.endFreq, bandData.publishBand)}
                                          <button
                                            id="band-selector"
                                            class="retro-button text-sm text-white fontrbold h-7 text-base rounded-md flex items-center justify-center border border-gray-600 shadow-inner transition-all duration-200 ease-in-out {currentBand ===
                                            index
                                              ? 'bg-blue-600 pressed scale-95'
                                              : 'bg-gray-700 hover:bg-gray-600'}"
                                            on:click={() =>
                                              handleBandChangePopup(index)}
                                            title={bandData.name}
                                            >{bandData.name}
                                          </button>
                                        {/if}
                                      {/if}
                                    {:else}{/if}
                                  {/each}
                                </div>
                                <!-- Content Ends -->
                              </div>
                            </div>
                          {/if}
                          <!-- End Bands Popup Menu -->

                          <!-- Begin IF Filters Popup Menu -->
                          <button
                            id="if-filter-popup-button"
                            class="glass-button h-8 text-white text-sm font-bold py-2 px-1 rounded-lg flex items-center w-full justify-center whitespace-nowrap"
                            on:click={toggleIFPopup}
                          >
                            IF Filters
                          </button>

                          <!-- Static IF Popup -->
                          {#if showIFPopup}
                            <div
                              class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
                              on:click={toggleIFPopup}
                            >
                              <div
                                class="p-6 rounded-lg max-w-lg w-full max-h-[80vh] flex flex-col decoder-window popup-panel"
                                on:click|stopPropagation
                              >
                                <div
                                  class="flex justify-between items-center mb-4"
                                >
                                  <h2 class="text-base font-bold text-white">
                                    Static IF Filters
                                  </h2>
                                  <button
                                    class="text-gray-400 hover:text-white"
                                    on:click={toggleIFPopup}
                                  >
                                    <svg
                                      class="w-6 h-6"
                                      fill="none"
                                      stroke="currentColor"
                                      viewBox="0 0 24 24"
                                      xmlns="http://www.w3.org/2000/svg"
                                    >
                                      <path
                                        stroke-linecap="round"
                                        stroke-linejoin="round"
                                        stroke-width="2"
                                        d="M6 18L18 6M6 6l12 12"
                                      ></path>
                                    </svg>
                                  </button>
                                </div>

                                <!-- Content Starts -->

                                <div class="w-full mt-4">
                                  <div
                                    class="grid grid-cols-4 sm:grid-cols-6 gap-2"
                                  >
                                    {#each newBandwidth as newbandwidth}
                                      <button
                                        id="static-bandwidth-selector"
                                        class="retro-button text-sm text-white font-bold h-8 text-lg rounded-md flex items-center justify-center border border-gray-600 shadow-inner transition-all duration-200 ease-in-out {newStaticBandwidth ==
                                          newbandwidth ||
                                        Math.round(bandwidth * 1000) ==
                                          newbandwidth
                                          ? 'bg-blue-600 pressed scale-95'
                                          : 'bg-gray-700 hover:bg-gray-600'}"
                                        on:click={() =>
                                          handleSetStaticBandwidth(
                                            newbandwidth,
                                          )}
                                        title={newbandwidth}
                                      >
                                        {#if newbandwidth == 500}500 Hz
                                        {:else if newbandwidth == 1800}1.8 kHz
                                        {:else if newbandwidth == 2400}2.4 kHz
                                        {:else if newbandwidth == 2700}2.7 kHz
                                        {:else if newbandwidth == 3000}3.0 kHz
                                        {:else if newbandwidth == 3500}3.5 kHz
                                        {:else if newbandwidth == 4000}4.0 kHz
                                        {:else if newbandwidth == 4500}4.5 kHz
                                        {:else if newbandwidth == 5000}5.0 kHz
                                        {:else if newbandwidth == 6000}6.0 kHz
                                        {:else if newbandwidth == 9000}9.0 kHz
                                        {:else if newbandwidth == 10000}10.0 kHz
                                        {:else}{/if}
                                      </button>
                                    {/each}
                                  </div>
                                </div>
                                <!-- IF Filter bandwidth slider -->
                                <div
                                  class="w-full mt-4 border-t border-gray-600 pt-3"
                                >
                                  <div
                                    class="flex items-center justify-between mb-1"
                                  >
                                    <label class="text-gray-400 text-xs"
                                      >Bandwidth (center &#8594; edge)</label
                                    >
                                    <span
                                      class="value-display text-gray-300 text-xs whitespace-nowrap"
                                      >{ifSlider} Hz</span
                                    >
                                  </div>
                                  <div class="flex items-center gap-2">
                                    <div class="slider-container flex-1">
                                      <input
                                        type="range"
                                        class="glass-slider"
                                        bind:value={ifSlider}
                                        on:input={handleIFSlider}
                                        min="0"
                                        max={ifSliderMax}
                                        step="100"
                                        title="Adjust bandwidth from centre toward the active sideband"
                                      />
                                    </div>
                                    <button
                                      class="retro-button text-xs text-white font-bold h-8 px-3 rounded-md flex items-center justify-center border border-gray-600 shadow-inner bg-gray-700 hover:bg-gray-600 transition-all duration-200 ease-in-out whitespace-nowrap"
                                      on:click={resetIFFilter}
                                      title="Reset passband to mode default"
                                      >Reset</button
                                    >
                                  </div>
                                </div>
                                <!-- Content Ends -->
                              </div>
                            </div>
                          {/if}
                          <!-- End IF Filters Popup Menu -->
                          <!-- Begin CAT (TCI) Popup Menu -->
                          <button
                            id="cat-tci-popup-button"
                            class="glass-button h-8 text-white text-sm font-bold py-2 px-1 rounded-lg flex items-center w-full justify-center whitespace-nowrap"
                            on:click={toggleCatPopup}
                            title={catConnected
                              ? `CAT control active — ${catActiveSourceLabel}`
                              : "CAT control via TCI (ExpertSDR, AetherSDR, Thetis)"}
                          >
                            <span
                              class="mr-1 {catConnected
                                ? 'text-green-400'
                                : 'text-gray-500'}">●</span
                            >
                            TCI-CAT
                          </button>

                          {#if showCatPopup}
                            <div
                              class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
                              on:click={toggleCatPopup}
                            >
                              <div
                                class="p-6 rounded-lg max-w-lg w-full max-h-[80vh] flex flex-col decoder-window popup-panel"
                                on:click|stopPropagation
                              >
                                <div
                                  class="flex justify-between items-center mb-4"
                                >
                                  <h2 class="text-base font-bold text-white">
                                    CAT control via TCI
                                  </h2>
                                  <button
                                    class="text-gray-400 hover:text-white"
                                    on:click={toggleCatPopup}
                                  >
                                    <svg
                                      class="w-6 h-6"
                                      fill="none"
                                      stroke="currentColor"
                                      viewBox="0 0 24 24"
                                      xmlns="http://www.w3.org/2000/svg"
                                    >
                                      <path
                                        stroke-linecap="round"
                                        stroke-linejoin="round"
                                        stroke-width="2"
                                        d="M6 18L18 6M6 6l12 12"
                                      ></path>
                                    </svg>
                                  </button>
                                </div>
                                <!-- Content Starts -->
                                <div class="flex flex-col gap-4">
                                  <p class="text-xs text-gray-400 text-center">
                                    ExpertSDR, AetherSDR, Thetis — TCI ports
                                    50001 / 40001 are searched automatically.
                                  </p>
                                  <div
                                    class="flex items-center justify-center gap-3 flex-wrap"
                                  >
                                    <span
                                      class="text-sm font-semibold {catConnected
                                        ? 'text-green-400'
                                        : 'text-gray-500'}"
                                      title={catConnected
                                        ? `CAT link active — source: ${catActiveSourceLabel}`
                                        : "No CAT link found (searching TCI on ports 50001/40001)"}
                                    >
                                      ● {catConnected
                                        ? `Active — ${catActiveSourceLabel}`
                                        : "Inactive"}
                                    </span>
                                    {#if !catConnected}
                                      <span
                                        class="text-xs text-gray-400 animate-pulse"
                                        title="Searching for a TCI server..."
                                      >
                                        ⏳ Wait
                                      </span>
                                    {/if}
                                  </div>
                                  <div
                                    class="flex items-center justify-center gap-4 flex-wrap"
                                  >
                                    <div class="flex items-center gap-2">
                                      <span class="text-sm text-gray-300"
                                        >CAT Sync</span
                                      >
                                      <label
                                        class="toggle-switch"
                                        title="Turns frequency tracking (rig <-> PhantomSDR) on or off. Audio is always muted while the rig transmits."
                                      >
                                        <input
                                          type="checkbox"
                                          bind:checked={catSyncEnabled}
                                          on:change={persistCatSyncPreference}
                                        />
                                        <span class="toggle-slider"></span>
                                      </label>
                                    </div>
                                    <div class="flex items-center gap-2">
                                      <span class="text-xs text-gray-400"
                                        >Host:</span
                                      >
                                      <input
                                        type="text"
                                        class="text-xs bg-gray-800 text-gray-200 rounded px-2 py-0.5 w-32"
                                        bind:value={catHost}
                                        on:change={applyCatHostChange}
                                        title="Address of the computer running ExpertSDR/AetherSDR/Thetis (TCI): 'localhost' for this computer, otherwise its LAN IP (e.g. 192.168.1.42)."
                                      />
                                    </div>
                                  </div>
                                </div>
                                <!-- Content Ends -->
                              </div>
                            </div>
                          {/if}
                          <!-- End CAT (TCI) Popup Menu -->
                        </div>
                        <hr class="border-gray-600 my-2" />
                      </div>
                      <!-- End of Popup Buttons Menu -->

                      <!-- Wheel Tuning Steps — took over the row the Bandwidth
                           offset selector used to occupy -->

                      <div class="w-full mt-1">
                        <h3 class="text-white text-base font-semibold mb-2">
                          Wheel Tuning Steps
                        </h3>
                        <div class="grid grid-cols-4 sm:grid-cols-8 gap-2">
                          {#each tuningsteps as tuningstep (tuningstep)}
                            <button
                              id="tuning-step-selector"
                              class="text-sm retro-button text-white font-bold h-8 text-sm rounded-md flex items-center justify-center border border-gray-600 shadow-inner transition-all duration-200 ease-in-out {currentTuneStep ==
                              tuningstep
                                ? 'bg-blue-600 pressed scale-95'
                                : 'bg-gray-700 hover:bg-gray-600'}"
                              on:click={() => handleTuningStep(tuningstep)}
                              title="{tuningstep} Hz"
                            >
                              {#if tuningstep == 10}10 Hz
                              {:else if tuningstep == 50}50 Hz
                              {:else if tuningstep == 100}100 Hz
                              {:else if tuningstep == 500}500 Hz
                              {:else if tuningstep == 1000}1 kHz
                              {:else if tuningstep == 5000}5 kHz
                              {:else if tuningstep == 9000}9 kHz
                              {:else if tuningstep == 10000}10 kHz
                              {:else}
                                {tuningstep}
                              {/if}
                            </button>
                          {/each}
                        </div>
                        <hr class="border-gray-600 my-2" />
                      </div>

                      <!-- End of Tuning Step Selection Area -->

                      <!-- Begin Decoders Selection Area — one-touch buttons for
                           the dropdown's decoders (RADEL/RADEU excluded: they
                           have their own buttons in the Modes selector) -->
                      <div class="w-full mt-1">
                        <!-- w-full: the parent is inside screw-col-2, so the
                             frame can never outgrow that column. -->
                        <div class="w-full min-w-0 mb-2">
                          <ModeIdChip
                            on={modeIdOn}
                            result={modeIdResult}
                            ranked={modeIdRanked}
                            offCentre={modeIdOffCentre}
                            on:toggle={toggleModeId}
                            on:tune={(e) => modeIdTune(e.detail)}
                            on:recentre={modeIdRecentre}
                          />
                        </div>
                        <!-- One row, always: ten equal cells that shrink
                             together rather than wrapping to a second line. -->
                        <div class="flex flex-nowrap gap-1">
                          {#each decoderButtons as dec (dec.key)}
                            <button
                              id="decoder-selector"
                              class="retro-button flex-1 min-w-0 px-0.5 text-white font-bold h-8 text-[10px] sm:text-xs rounded-md flex items-center justify-center whitespace-nowrap border border-gray-600 shadow-inner transition-all duration-200 ease-in-out {activeDecoder ===
                              dec.key
                                ? 'bg-blue-600 pressed scale-95'
                                : 'bg-gray-700 hover:bg-gray-600'}"
                              on:click={() => launchDecoder(dec.key)}
                              title={dec.title}
                            >
                              {dec.label}
                            </button>
                          {/each}
                        </div>
                        <hr class="border-gray-600 my-2" />
                      </div>
                      <!-- End of Decoders Selection Area -->
                    </div>
                  </div>

                  <!-- Spectrogram / QRSS / Decoders — one row when collapsed -->
                  <div class="flex flex-col sm:flex-row sm:flex-wrap items-start gap-x-12 gap-y-4">
                    <!-- Audio Spectrogram Section -->
                    <div>
                      <h3
                        class="text-left text-white text-base font-semibold mb-2"
                      >
                        Spectrogram
                      </h3>
                      <div class="flex items-center gap-3 flex-wrap">
                        <button
                          class="retro-button px-4 h-7 inline-flex items-center justify-center text-white text-sm rounded-md border border-gray-600 shadow-inner transition-all duration-200 ease-in-out {spectrogramEnabled
                            ? 'bg-blue-600 pressed scale-95'
                            : 'bg-gray-700 hover:bg-gray-600'}"
                          on:click={toggleSpectrogram}
                        >
                          {spectrogramEnabled ? "📊 Hide" : "📊 Show"}
                        </button>

                        {#if spectrogramEnabled}
                          <div class="flex items-center gap-2">
                            <label class="text-sm text-gray-300">Gain:</label>
                            <input
                              type="range"
                              min="0"
                              max="3"
                              step="0.1"
                              bind:value={spectrogramGain}
                              on:input={() => {
                                if (
                                  spectrogramComponent &&
                                  spectrogramComponent.setDisplayGain
                                )
                                  spectrogramComponent.setDisplayGain(
                                    spectrogramGain,
                                  );
                              }}
                              class="w-24"
                            />
                            <span class="text-xs text-gray-400"
                              >{spectrogramGain.toFixed(1)}×</span
                            >
                          </div>

                          <div class="flex items-center gap-2">
                            <label class="text-sm text-gray-300">Color:</label>
                            <select
                              bind:value={spectrogramColorScheme}
                              class="glass-select px-2 py-1 text-sm text-white"
                            >
                              <option value="rainbow">Rainbow</option>
                              <option value="blue">Blue</option>
                              <option value="green">Green</option>
                              <option value="white">Grayscale</option>
                            </select>
                          </div>
                        {/if}
                      </div>
                    </div>

                    <!-- QRSS Grabber Section -->
                    <div>
                      <h3
                        class="text-left text-white text-base font-semibold mb-2"
                      >
                        QRSS
                      </h3>
                      <div class="flex items-center gap-3 flex-wrap">
                        <button
                          class="retro-button px-4 h-7 inline-flex items-center justify-center text-white text-sm rounded-md border border-gray-600 shadow-inner transition-all duration-200 ease-in-out {qrssEnabled
                            ? 'bg-blue-600 pressed scale-95'
                            : 'bg-gray-700 hover:bg-gray-600'}"
                          on:click={toggleQrss}
                        >
                          {qrssEnabled ? "🐌 Hide" : "🐌 Show"}
                        </button>

                        {#if qrssEnabled}
                          <div class="flex items-center gap-2">
                            <label class="text-sm text-gray-300">Band:</label>
                            <select
                              bind:value={qrssKnownFrequency}
                              class="glass-select px-2 py-1 text-sm text-white"
                            >
                              <option value="">— QRSS frequency —</option>
                              {#each QRSS_KNOWN_FREQUENCIES as item}
                                <option value={String(item.khz)}
                                  >{item.label}</option
                                >
                              {/each}
                            </select>
                            <button
                              class="text-xs px-3 py-1 rounded bg-green-700 hover:bg-green-600 text-white transition-colors whitespace-nowrap"
                              on:click={qrssApplyKnownFrequency}>Tune</button
                            >
                          </div>

                          <div class="flex items-center gap-2">
                            <label class="text-sm text-gray-300">Speed:</label>
                            <select
                              bind:value={qrssMode}
                              class="glass-select px-2 py-1 text-sm text-white"
                            >
                              <option value="qrss3">QRSS 3</option>
                              <option value="qrss6">QRSS 6</option>
                              <option value="qrss10">QRSS 10</option>
                              <option value="qrss30">QRSS 30</option>
                              <option value="qrss60">QRSS 60</option>
                            </select>
                          </div>

                          <div class="flex items-center gap-2">
                            <label class="text-sm text-gray-300">Centre:</label>
                            <input
                              type="number"
                              min="100"
                              max="3000"
                              step="10"
                              bind:value={qrssCenterHz}
                              on:change={() =>
                                qrssHoldsReceiver && qrssApplyPassband()}
                              class="glass-select w-20 px-2 py-1 text-sm text-white"
                            />
                            <span class="text-xs text-gray-400">Hz</span>
                          </div>

                          <div class="flex items-center gap-2">
                            <label class="text-sm text-gray-300">Span:</label>
                            <select
                              bind:value={qrssSpanHz}
                              on:change={() =>
                                qrssHoldsReceiver && qrssApplyPassband()}
                              class="glass-select px-2 py-1 text-sm text-white"
                            >
                              <option value={20}>20 Hz</option>
                              <option value={50}>50 Hz</option>
                              <option value={100}>100 Hz</option>
                              <option value={200}>200 Hz</option>
                            </select>
                            <button
                              class="retro-button px-3 py-1 text-white text-xs rounded-md border border-green-800 bg-green-900 hover:bg-green-800"
                              on:click={() => qrssComponent && qrssComponent.clear()}
                              title="Wipe the grabber display and start a fresh trace"
                            >
                              Clear
                            </button>
                          </div>

                          <div class="flex items-center gap-2">
                            <label class="text-sm text-gray-300">Gain:</label>
                            <input
                              type="range"
                              min="-10"
                              max="40"
                              step="1"
                              bind:value={qrssGain}
                              class="w-24"
                            />
                            <span class="text-xs text-gray-400"
                              >{qrssGain} dB</span
                            >
                          </div>

                          <div class="flex items-center gap-2">
                            <label class="text-sm text-gray-300">Color:</label>
                            <select
                              bind:value={qrssColorScheme}
                              class="glass-select px-2 py-1 text-sm text-white"
                            >
                              <option value="rainbow">Rainbow</option>
                              <option value="green">Green</option>
                              <option value="grey">Grayscale</option>
                            </select>
                          </div>

                          <button
                            class="retro-button px-3 py-1 text-white text-xs rounded-md border border-green-800 bg-green-900 hover:bg-green-800"
                            on:click={qrssSavePNG}
                            title="Save the grabber display as a PNG, captioned with the frequency and UTC time"
                          >
                            💾 Save as .PNG
                          </button>
                        {/if}
                      </div>
                    </div>

                    <!-- Decoder Options Section -->
                    <div class="min-w-0">
                      <h3 class="text-white text-base font-semibold mb-2">
                        Decoders
                      </h3>
                      <div class="flex items-center gap-2">
                        <!-- Off/On toggle — mirrors Gate button style -->
                        <button
                          class="text-sm px-3 py-1 rounded-md font-semibold transition-all duration-200 {decoderOn
                            ? 'bg-blue-600 text-white shadow-lg'
                            : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}"
                          on:click={toggleDecoder}
                          title="Enable/disable decoder"
                        >
                          {decoderOn ? "On" : "Off"}
                        </button>

                        <!-- Decoder selector dropdown -->
                        <select
                          bind:value={selectedDecoder}
                          on:change={handleDecoderChange}
                          disabled={!decoderOn}
                          class="glass-select text-white text-sm px-2 py-1 rounded-md cursor-pointer focus:outline-none {!decoderOn
                            ? 'opacity-50 cursor-not-allowed'
                            : ''}"
                        >
                          <option value="none">— Select decoder —</option>
                          <option value="ft8">FT8</option>
                          <option value="ft4">FT4</option>
                          <option value="ft2">FT2</option>
                          <option value="js8">JS8</option>
                          <option value="cw">CW</option>
                          <option value="wspr">WSPR</option>
                          <option value="hffax">HF FAX / WEFAX</option>
                          <option value="sstv">SSTV</option>
                          <option value="navtex">NAVTEX</option>
                          <option value="fsk">FSK / RTTY</option>
                          <option value="radel">RADE v1 — RADEL (LSB)</option>
                          <option value="radeu">RADE v1 — RADEU (USB)</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <!-- Receive diversity (second receiver) -->
                  <DiversityPanel />

                  <!-- FT8 / FT4 Messages List -->
                  {#if decoderOn && (ft8Enabled || ft4Enabled || ft2Enabled)}
                    <div class="w-full rounded-lg p-6 mt-6 decoder-window decoder-panel">
                      <div
                        class="w-full flex justify-between items-center mb-5 text-xs"
                      >
                        <h4 class="text-white font-semibold">
                          {ft2Enabled ? "FT2" : ft4Enabled ? "FT4" : "FT8"} Messages
                        </h4>
                        <span
                          class="text-gray-300 pl-4 lg:pl-0"
                          id="farthest-distance">Farthest: 0 km</span
                        >
                      </div>
                      <FtxSpectrum {audio} />
                      <div
                        class="flex items-center gap-2 text-xs text-gray-300 mb-1"
                      >
                        <label
                          class="whitespace-nowrap"
                          title="Capture lead-in after the UTC slot boundary, to offset audio pipeline latency (KiwiSDR time_shift)"
                          >Sync offset</label
                        >
                        <input
                          type="range"
                          min="0"
                          max={ftxShiftMax}
                          step="0.05"
                          bind:value={ftxTimeShift}
                          on:input={handleFtxTimeShift}
                          class="flex-grow accent-cyan-400"
                        />
                        <span class="font-mono w-12 text-right"
                          >{ftxTimeShift.toFixed(2)}s</span
                        >
                        <label
                          class="flex items-center gap-1 whitespace-nowrap"
                          title="Track the capture timing automatically from the decoders' own DT measurement"
                        >
                          <input
                            type="checkbox"
                            bind:checked={ftxAutoSync}
                            on:change={handleFtxAutoSync}
                            class="accent-cyan-400"
                          />
                          Auto
                        </label>
                      </div>
                      <div
                        class="w-full text-gray-300 overflow-auto max-h-40 custom-scrollbar pr-2"
                      >
                        <div class="ftx-grid ftx-head">
                          <div>Mode</div>
                          <div class="ftx-num">dB</div>
                          <div class="ftx-num">Hz</div>
                          <div class="ftx-num">DT</div>
                          <div>Message</div>
                          <div>Locator</div>
                          <div class="ftx-num">Dist</div>
                        </div>
                        <div id="ft8MessagesList">
                          <!-- Dynamic content populated here -->
                        </div>
                        <div><hr class="border-gray-600 my-2" /></div>
                      </div>
                    </div>
                  {/if}

                  <!-- JS8 Decoder Window -->
                  {#if decoderOn && js8Enabled}
                    <div
                      class="w-full rounded-lg p-4 mt-6 text-left decoder-window decoder-panel"
                    >
                      <div
                        class="w-full flex justify-between items-center mb-3 text-xs"
                      >
                        <h4
                          class="text-white font-semibold flex items-center gap-2"
                        >
                          <span
                            class="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse"
                          ></span>
                          JS8 Decoder
                        </h4>
                        <div class="flex items-center gap-2">
                          <label
                            class="text-gray-400"
                            title="JS8 speed. All stations in a QSO must use the same one; Normal is the common calling speed."
                            >Speed</label
                          >
                          <select
                            bind:value={js8Submode}
                            on:change={handleJs8Submode}
                            class="glass-select text-white text-xs px-2 py-0.5 rounded-md cursor-pointer focus:outline-none"
                          >
                            {#each JS8_SUBMODE_NAMES as name, i}
                              <option value={i}
                                >{name} ({JS8_SUBMODE_PERIOD_S[i]}s)</option
                              >
                            {/each}
                          </select>
                          <button
                            class="bg-green-900 hover:bg-green-800 text-green-100 hover:text-white text-xs px-2 py-0.5 rounded border border-green-700 hover:border-green-500 transition-colors"
                            on:click={() => {
                              js8Messages = [];
                            }}>Clear</button
                          >
                        </div>
                      </div>

                      <!-- Slot progress -->
                      <div
                        class="w-full mb-2 h-2 rounded-full bg-gray-600 overflow-hidden"
                        title="JS8 slot progress"
                      >
                        <div
                          class="h-full rounded-full bg-emerald-400 transition-all duration-500"
                          style="width:{(
                            (js8SlotPos /
                              (JS8_SUBMODE_PERIOD_S[js8Submode] || 15)) *
                            100
                          ).toFixed(1)}%"
                        ></div>
                      </div>

                      <FtxSpectrum {audio} />

                      <div
                        class="flex items-center gap-2 text-xs text-gray-300 mb-2"
                      >
                        <label
                          class="whitespace-nowrap"
                          title="Capture lead-in after the UTC slot boundary, to offset audio pipeline latency"
                          >Sync offset</label
                        >
                        <input
                          type="range"
                          min="0"
                          max={ftxShiftMax}
                          step="0.05"
                          bind:value={ftxTimeShift}
                          on:input={handleFtxTimeShift}
                          class="flex-grow accent-emerald-400"
                        />
                        <span class="font-mono w-12 text-right"
                          >{ftxTimeShift.toFixed(2)}s</span
                        >
                        <label
                          class="flex items-center gap-1 whitespace-nowrap"
                          title="Track the capture timing automatically from the decoder's own DT measurement"
                        >
                          <input
                            type="checkbox"
                            bind:checked={ftxAutoSync}
                            on:change={handleFtxAutoSync}
                            class="accent-emerald-400"
                          />
                          Auto
                        </label>
                      </div>

                      <!-- Still arriving. A JS8 message can span several slots,
                           so showing the partial text is what makes the mode
                           feel live rather than stalled. -->
                      {#if js8Pending.length > 0}
                        <div class="js8-pending">
                          {#each js8Pending as p (p.id)}
                            <div class="js8-row js8-row-pending">
                              <span class="js8-mode">JS8</span>
                              <span class="js8-hz">{Math.round(p.freq)}</span>
                              <!-- No SNR until the message completes, but the
                                   cell must exist: without it the text lands in
                                   the dB track and overflows across it. -->
                              <span class="js8-snr"></span>
                              <span class="js8-text"
                                >{#if p.from}<span class="js8-call"
                                    >{p.from}</span
                                  >{": "}{/if}{p.text}<span class="js8-caret"
                                  >▌</span
                                ></span
                              >
                            </div>
                          {/each}
                        </div>
                      {/if}

                      <div
                        class="w-full text-gray-300 overflow-auto max-h-48 custom-scrollbar pr-1"
                      >
                        <div class="js8-row js8-head">
                          <span class="js8-mode">Mode</span>
                          <span class="js8-hz">Hz</span>
                          <span class="js8-snr">dB</span>
                          <span class="js8-text">Message</span>
                        </div>
                        {#each js8Messages as m (m.id)}
                          <div
                            class="js8-row"
                            class:js8-incomplete={!m.complete}
                            title={m.complete
                              ? `${m.frames} frame${m.frames === 1 ? "" : "s"}`
                              : "Timed out before the last frame arrived"}
                          >
                            <span class="js8-mode">JS8</span>
                            <span class="js8-hz">{Math.round(m.freq)}</span>
                            <span class="js8-snr"
                              >{m.snr === null ? "" : m.snr.toFixed(2)}</span
                            >
                            <span class="js8-text"
                              >{#each formatJs8Parts(m) as part}<span
                                  class:js8-call={part.call}>{part.text}</span
                                >{/each}</span
                            >
                          </div>
                        {/each}
                        {#if js8Messages.length === 0}
                          <div
                            class="text-gray-500 italic text-xs font-mono mt-2"
                          >
                            Listening on the {JS8_SUBMODE_NAMES[
                              js8Submode
                            ]} cycle…
                          </div>
                        {/if}
                      </div>
                    </div>
                  {/if}

                  <!-- CW Decoder Window -->
                  {#if decoderOn && cwEnabled}
                    <div
                      class="w-full rounded-lg p-4 mt-6 text-left decoder-window decoder-panel"
                    >
                      <div
                        class="w-full flex justify-between items-center mb-3 text-xs"
                      >
                        <h4
                          class="text-white font-semibold flex items-center gap-2"
                        >
                          <span
                            class="inline-block w-2 h-2 rounded-full bg-amber-400 animate-pulse"
                          ></span>
                          CW Decoder
                          {#if cwDetectedHz > 0}
                            <span class="text-amber-400 font-mono font-normal"
                              >≈ {cwDetectedHz} Hz</span
                            >
                            {#if cwDetectedWpm > 0}
                              <span
                                class="text-gray-400 font-mono font-normal text-xs"
                                >· {cwDetectedWpm} WPM</span
                              >
                            {/if}
                          {:else}
                            <span class="text-gray-500 font-normal italic"
                              >scanning…</span
                            >
                          {/if}
                        </h4>
                        <button
                          class="text-green-100 bg-green-900 hover:bg-green-800 hover:text-white text-xs px-2 py-0.5 rounded border border-green-700 hover:border-green-500 transition-colors"
                          on:click={() => {
                            cwMessages = [];
                            cwCurrentLine = "";
                          }}>Clear</button
                        >
                      </div>
                      <div
                        bind:this={cwScrollEl}
                        class="w-full font-mono text-sm text-amber-300 bg-gray-900 rounded p-3 overflow-y-auto max-h-64 custom-scrollbar text-left recess-window"
                        style="letter-spacing:0.05em; word-break:break-all;"
                      >
                        {#each cwMessages as line}
                          <div class="break-words whitespace-pre-wrap">
                            {line}
                          </div>
                        {/each}
                        {#if cwCurrentLine}
                          <div class="text-amber-200">
                            {cwCurrentLine}<span class="animate-pulse">▋</span>
                          </div>
                        {:else if cwMessages.length === 0}
                          <div class="text-gray-500 italic">
                            Listening for CW signal…
                          </div>
                        {/if}
                      </div>
                    </div>
                  {/if}

                  <!-- WSPR Decoder Window -->
                  {#if decoderOn && wsprEnabled}
                    <div
                      class="w-full rounded-lg p-4 mt-6 text-left decoder-window decoder-panel"
                    >
                      <div
                        class="w-full flex justify-between items-center mb-3 text-xs"
                      >
                        <h4
                          class="text-white font-semibold flex items-center gap-2"
                        >
                          <span
                            class="inline-block w-2 h-2 rounded-full bg-cyan-400 animate-pulse"
                          ></span>
                          WSPR-2 Decoder
                        </h4>
                        <!-- WSPR slot progress bar -->
                        <div
                          class="w-full mt-1 mb-2 h-2 rounded-full bg-gray-600 overflow-hidden"
                          title="WSPR slot progress"
                        >
                          {#if wsprPhase === "collecting"}
                            <div
                              class="h-full rounded-full bg-cyan-400 transition-all duration-500"
                              style="width:{((wsprSlotPos / 119) * 100).toFixed(
                                1,
                              )}%"
                            ></div>
                          {:else if wsprPhase === "decoding"}
                            <div
                              class="h-full rounded-full bg-amber-400 animate-pulse"
                              style="width:100%"
                            ></div>
                          {:else}
                            <div
                              class="h-full rounded-full bg-gray-500"
                              style="width:0%"
                            ></div>
                          {/if}
                        </div>
                        <button
                          class="text-green-100 bg-green-900 hover:bg-green-800 hover:text-white text-xs px-2 py-0.5 rounded border border-green-700 hover:border-green-500 transition-colors"
                          on:click={() => {
                            wsprMessages = [];
                            const el =
                              document.getElementById("wsprMessagesList");
                            if (el) el.innerHTML = "";
                          }}>Clear</button
                        >
                      </div>
                      <FtxSpectrum {audio} source="wspr" />
                      <!-- Header row -->
                      <div
                        class="w-full font-mono text-xs text-gray-400 flex justify-between px-1 mb-1 border-b border-gray-600 pb-1"
                      >
                        <span class="w-18">UTC Callsign</span>
                        <span class="w-6 text-left">Grid</span>
                        <span class="w-10 text-left">Power</span>
                        <span class="w-20 text-left">Freq</span>
                        <span class="w-14 text-center">SNR</span>
                      </div>
                      <div
                        class="w-full text-gray-300 overflow-auto max-h-48 custom-scrollbar pr-1"
                      >
                        <div
                          id="wsprMessagesList"
                          class="flex flex-col gap-0.5"
                        >
                          <!-- Rows injected by audio.js stopWSPRCollection() -->
                        </div>
                        {#if wsprMessages.length === 0}
                          <div
                            class="text-gray-500 italic text-xs font-mono mt-2"
                          >
                            Waiting for next even UTC minute slot…
                          </div>
                        {/if}
                      </div>
                    </div>
                  {/if}

                  <!-- HF FAX / WEFAX Decoder Panel -->
                  {#if decoderOn && faxEnabled}
                    <div
                      class="w-full rounded-lg p-4 mt-6 text-left decoder-window decoder-panel"
                    >
                      <!-- Header -->
                      <div
                        class="flex flex-wrap items-center justify-between gap-2 mb-3"
                      >
                        <h4
                          class="text-white font-semibold flex items-center gap-2 text-sm"
                        >
                          <span
                            class="inline-block w-2 h-2 rounded-full bg-green-400 animate-pulse"
                          ></span>
                          HF FAX / WEFAX Receiver
                          {#if faxPhasing}
                            <span class="text-xs text-cyan-400 font-mono"
                              >[PHASING]</span
                            >
                          {/if}
                          {#if faxStopTone}
                            <span class="text-xs text-red-400 font-mono"
                              >[STOP]</span
                            >
                          {/if}
                        </h4>
                        <span class="text-xs text-gray-400 font-mono"
                          >Lines: {faxLineCount}</span
                        >
                      </div>

                      <!-- Station preset bar -->
                      <div class="flex flex-wrap gap-2 items-end mb-3">
                        <div class="flex flex-col gap-1 flex-1 min-w-[180px]">
                          <label class="text-gray-400 text-xs">Station</label>
                          <select
                            bind:value={faxSelectedStation}
                            on:change={() => {
                              faxStationObj =
                                FAX_STATIONS.find(
                                  (s) => s.name === faxSelectedStation,
                                ) || null;
                              faxSelectedFreqIdx = 0;
                              _faxTickCountdown();
                            }}
                            class="glass-select text-white text-xs px-2 py-1 rounded-md cursor-pointer focus:outline-none bg-gray-800 border border-gray-600"
                          >
                            <option value="">— Select station —</option>
                            {#each FAX_STATIONS as st}
                              <option value={st.name}>{st.name}</option>
                            {/each}
                          </select>
                        </div>

                        {#if faxStationObj && faxStationObj.freqs.length > 1}
                          <div class="flex flex-col gap-1">
                            <label class="text-gray-400 text-xs"
                              >Frequency</label
                            >
                            <select
                              bind:value={faxSelectedFreqIdx}
                              class="glass-select text-white text-xs px-2 py-1 rounded-md cursor-pointer focus:outline-none bg-gray-800 border border-gray-600"
                            >
                              {#each faxStationObj.freqs as f, i}
                                <option value={i}>{f} kHz</option>
                              {/each}
                            </select>
                          </div>
                        {/if}

                        <button
                          class="text-white text-xs font-bold px-3 py-1.5 rounded-md h-7 flex items-center gap-1 bg-green-700 hover:bg-green-600 transition-colors whitespace-nowrap"
                          on:click={faxApplyStation}
                          title="Tune to this station">▶ Tune</button
                        >
                      </div>

                      <!-- FAX broadcast schedule countdown -->
                      {#if faxScheduleRows.length > 0}
                        <div
                          class="mb-3 rounded-md bg-gray-900 overflow-hidden text-xs recess-window"
                        >
                          <div
                            class="flex items-center gap-1.5 px-2.5 py-1.5 border-b border-gray-700 bg-gray-800"
                          >
                            <svg
                              class="w-3 h-3 text-green-400 shrink-0"
                              fill="none"
                              stroke="currentColor"
                              stroke-width="2"
                              viewBox="0 0 24 24"
                              ><circle cx="12" cy="12" r="10" /><polyline
                                points="12 6 12 12 16 14"
                              /></svg
                            >
                            <span
                              class="text-green-400 font-semibold tracking-wide uppercase"
                              >Next Transmissions · UTC</span
                            >
                          </div>
                          <div class="divide-y divide-gray-800">
                            {#each faxScheduleRows as row, i}
                              <div
                                class="flex items-center gap-2 px-2.5 py-1.5 {row.onAir
                                  ? 'bg-green-900/30'
                                  : i === 0
                                    ? 'bg-gray-800/70'
                                    : 'hover:bg-gray-800/40'} transition-colors"
                              >
                                <span
                                  class="font-mono text-gray-300 shrink-0 w-10"
                                  >{row.utc}</span
                                >
                                <span class="text-gray-400 flex-1 truncate"
                                  >{row.label}</span
                                >
                                <span
                                  class="font-mono tabular-nums shrink-0
                                  {row.onAir
                                    ? 'text-green-300 font-bold'
                                    : row.imminent
                                      ? 'text-red-400 font-bold'
                                      : row.urgent
                                        ? 'text-amber-400 font-semibold'
                                        : i === 0
                                          ? 'text-green-300'
                                          : 'text-gray-500'}"
                                  >{row.countdown}</span
                                >
                                {#if row.onAir}
                                  <span
                                    class="text-green-400 animate-pulse shrink-0"
                                    title="Transmitting now">●</span
                                  >
                                {:else if row.imminent}
                                  <span
                                    class="text-red-400 animate-pulse shrink-0"
                                    >●</span
                                  >
                                {:else if row.urgent}
                                  <span
                                    class="text-amber-400 animate-pulse shrink-0"
                                    title="Transmission starts soon">⚡</span
                                  >
                                {/if}
                              </div>
                            {/each}
                          </div>
                        </div>
                      {/if}

                      <!-- Parameter bar -->
                      <div class="flex flex-wrap gap-3 items-end mb-3">
                        <div class="flex flex-col gap-1">
                          <label class="text-gray-400 text-xs">LPM</label>
                          <select
                            bind:value={faxLPM}
                            on:change={_faxUpdateParams}
                            class="glass-select text-white text-xs px-2 py-1 rounded-md cursor-pointer bg-gray-800 border border-gray-600"
                          >
                            <option value={60}>60</option>
                            <option value={90}>90</option>
                            <option value={100}>100</option>
                            <option value={120}>120 ★</option>
                            <option value={240}>240</option>
                          </select>
                        </div>

                        <div class="flex flex-col gap-1">
                          <label class="text-gray-400 text-xs">IOC</label>
                          <select
                            bind:value={faxIOC}
                            on:change={_faxUpdateParams}
                            class="glass-select text-white text-xs px-2 py-1 rounded-md cursor-pointer bg-gray-800 border border-gray-600"
                          >
                            <option value={288}>288</option>
                            <option value={576}>576 ★</option>
                          </select>
                        </div>

                        <div class="flex flex-col gap-1">
                          <label class="text-gray-400 text-xs">Shift</label>
                          <select
                            bind:value={faxShift}
                            on:change={_faxUpdateParams}
                            class="glass-select text-white text-xs px-2 py-1 rounded-md cursor-pointer bg-gray-800 border border-gray-600"
                          >
                            <option value={400}>400 Hz</option>
                            <option value={800}>800 Hz ★</option>
                          </select>
                        </div>

                        <button
                          class="text-xs px-2 py-1 rounded border transition-colors h-7
                                 {faxAutoAlign
                            ? 'bg-cyan-700 border-cyan-500 text-cyan-200'
                            : 'bg-gray-700 border-gray-600 text-gray-400 hover:border-gray-400'}"
                          on:click={faxToggleAutoAlign}
                          title="Automatic sync-pulse line alignment"
                          >⇔ Auto-align</button
                        >

                        <button
                          class="text-xs px-2 py-1 rounded border transition-colors h-7
                                 {faxInvert
                            ? 'bg-green-700 border-green-400 text-green-100'
                            : 'bg-green-900 border-green-700 text-green-100 hover:bg-green-800 hover:border-green-500'}"
                          on:click={faxToggleInvert}
                          title="Swap black and white (use for LSB receive or inverted polarity)"
                          >⇅ Invert</button
                        >
                      </div>

                      <!-- Signal status bar -->
                      <div
                        class="flex items-center gap-3 mb-3 text-xs font-mono"
                      >
                        <span class="text-gray-400"
                          >Black: <span class="text-gray-200"
                            >{faxInvert ? 1500 + faxShift : 1500} Hz</span
                          ></span
                        >
                        <span class="text-gray-400"
                          >White: <span class="text-gray-200"
                            >{faxInvert ? 1500 : 1500 + faxShift} Hz</span
                          ></span
                        >
                        <span class="text-gray-400"
                          >{Math.round(Math.PI * faxIOC)} px/line</span
                        >
                        <span class="text-gray-400"
                          >{((60 / faxLPM) * 1000).toFixed(0)} ms/line</span
                        >
                      </div>

                      <!-- FAX canvas (scrolling image) -->
                      <div
                        class="w-full overflow-x-auto rounded border border-gray-600 bg-black"
                      >
                        <canvas
                          bind:this={faxCanvas}
                          width={FAX_CANVAS_W}
                          height={FAX_CANVAS_H}
                          class="block fax-flip"
                          style="image-rendering: pixelated; width: 100%; max-width: {FAX_CANVAS_W}px;"
                          title="HF FAX image — rotated 180°, newest lines build from bottom to top"
                        ></canvas>
                      </div>

                      <!-- Tone indicators + action buttons -->
                      <div class="flex items-center gap-2 mt-2 flex-wrap">
                        <div
                          class="flex items-center gap-1 text-xs {faxPhasing
                            ? 'text-cyan-300'
                            : 'text-gray-600'}"
                        >
                          <span
                            class="inline-block w-2 h-2 rounded-full {faxPhasing
                              ? 'bg-cyan-400 animate-pulse'
                              : 'bg-gray-600'}"
                          ></span>
                          300 Hz phasing
                        </div>
                        <div
                          class="flex items-center gap-1 text-xs {faxStopTone
                            ? 'text-red-300'
                            : 'text-gray-600'}"
                        >
                          <span
                            class="inline-block w-2 h-2 rounded-full {faxStopTone
                              ? 'bg-red-400 animate-pulse'
                              : 'bg-gray-600'}"
                          ></span>
                          450 Hz stop
                        </div>
                        <div class="flex-1"></div>
                        <button
                          class="text-green-100 bg-green-900 hover:bg-green-800 text-xs px-2 py-0.5 rounded border border-green-700 hover:border-green-500 transition-colors"
                          on:click={faxRefresh}
                          title="Clear canvas and reset decoder — use between transmissions"
                          >↺ Reset</button
                        >
                        <button
                          class="text-green-100 bg-green-900 hover:bg-green-800 text-xs px-2 py-0.5 rounded border border-green-700 hover:border-green-500 transition-colors"
                          on:click={faxSaveImage}
                          title="Save current image as PNG">⤓ Save PNG</button
                        >
                      </div>

                      <!-- Hint -->
                      <p class="text-gray-500 text-xs mt-3 leading-relaxed">
                        Mode must be <strong class="text-gray-300">USB</strong>
                        · Standard: 1500 Hz black · 2300 Hz white · 120 LPM ·
                        IOC 576 · Image scrolls upward — newest lines at bottom
                        · Use <em>↺ Refresh</em> between transmissions or when
                        image tears -
                        <a
                          href="https://www.weather.gov/media/marine/rfax.pdf"
                          target="_blank"
                          rel="noopener noreferrer"
                          style="color: cyan;">FAX transmission schedules</a
                        >
                      </p>
                    </div>
                  {/if}
                  <!-- END HF FAX Panel -->

                  {#if decoderOn && sstvEnabled}
                    <div
                      class="mt-3 rounded-xl border border-cyan-500/25 p-3 decoder-window decoder-panel"
                    >
                      <div class="flex items-center justify-between gap-2 mb-2">
                        <div class="flex items-center gap-2 min-w-0">
                          <span class="font-semibold text-cyan-300">SSTV</span>
                          {#if sstvDetectedMode}
                            <span
                              class="text-xs text-emerald-300 font-mono whitespace-nowrap"
                              >[{sstvDetectedMode}]</span
                            >
                          {/if}
                          <span
                            class="text-xs truncate {sstvSoftSync
                              ? 'text-yellow-300'
                              : 'text-gray-400'}"
                            title={sstvSoftSync
                              ? "soft sync hold"
                              : "hard sync lock"}
                            >{sstvSoftSync
                              ? "soft sync hold"
                              : "hard sync lock"}</span
                          >
                        </div>
                        <div class="flex items-center gap-1 shrink-0">
                          <button
                            class="text-xs px-2 py-1 rounded bg-teal-700 hover:bg-teal-600 text-white transition-colors whitespace-nowrap"
                            on:click={_sstvStart}
                            disabled={sstvRunning}>▶ Start</button
                          >
                          <button
                            class="text-xs px-2 py-1 rounded bg-teal-700 hover:bg-teal-600 text-white transition-colors whitespace-nowrap"
                            on:click={_sstvStop}
                            disabled={!sstvRunning}>■ Stop</button
                          >
                          <button
                            class="text-xs px-2 py-1 rounded bg-teal-700 hover:bg-teal-600 text-white transition-colors whitespace-nowrap"
                            on:click={sstvRefresh}
                            disabled={!sstvRunning}>↺ Reset</button
                          >
                          <button
                            class="text-xs px-2 py-1 rounded bg-amber-700 hover:bg-amber-600 text-white transition-colors whitespace-nowrap"
                            on:click={sstvForceNow}
                            disabled={!sstvRunning || sstvModeChoice === "auto"}
                            title="Start drawing now in the selected mode, without waiting for a VIS header or sync detection. Pick a mode other than Auto to enable."
                            >⏺ Force</button
                          >
                          <button
                            class="text-xs px-2 py-1 rounded bg-teal-700 hover:bg-teal-600 text-white transition-colors whitespace-nowrap"
                            on:click={sstvSaveImage}>💾 Save</button
                          >
                        </div>
                      </div>
                      <div
                        class="flex flex-wrap items-center gap-3 mb-2 text-xs text-gray-300"
                      >
                        <label class="flex items-center gap-2">
                          <span>Mode</span>
                          <select
                            bind:value={sstvModeChoice}
                            on:change={sstvModeChanged}
                            class="glass-select text-white text-xs px-2 py-1 rounded-md"
                          >
                            <option value="auto">Auto</option>
                            <option value="martin1">Martin M1</option>
                            <option value="martin2">Martin M2</option>
                            <option value="scottie1">Scottie S1</option>
                            <option value="scottie2">Scottie S2</option>
                            <option value="robot36">Robot 36</option>
                            <option value="scottieDX">Scottie DX</option>
                            <option value="robot72">Robot 72</option>
                          </select>
                        </label>
                        <span class="text-gray-400"
                          >Desktop + mobile · raw PCM before AGC/NR/mute</span
                        >
                        <span
                          class={sstvRunning
                            ? "text-emerald-300"
                            : "text-red-300"}
                          >{sstvRunning ? "Running" : "Stopped"}</span
                        >
                        <span class="text-gray-400"
                          >Lines: <span class="text-gray-200"
                            >{sstvLineCount}</span
                          >/{sstvCanvasH}</span
                        >
                      </div>
                      <div
                        class="mb-2 text-xs font-mono {sstvStatusText?.includes(
                          'lock',
                        )
                          ? 'text-cyan-300'
                          : 'text-gray-400'}"
                      >
                        {sstvStatusText}
                      </div>
                      <div
                        class="rounded-lg overflow-hidden border border-gray-700 bg-black inline-block w-full max-w-[340px] sm:max-w-full"
                      >
                        <canvas
                          bind:this={sstvCanvas}
                          width={SSTV_CANVAS_W}
                          height={SSTV_CANVAS_H}
                          class="block w-full h-auto"
                        ></canvas>
                      </div>
                    </div>
                  {/if}

                  <!-- ── NAVTEX / SITOR-B Decoder Panel ───────────────────── -->
                  {#if decoderOn && navtexEnabled}
                    <div
                      class="w-full rounded-lg p-4 mt-6 text-left decoder-window decoder-panel"
                    >
                      <!-- Header -->
                      <div
                        class="flex flex-wrap items-center justify-between gap-2 mb-3"
                      >
                        <h4
                          class="text-white font-semibold flex items-center gap-2 text-sm"
                        >
                          <span
                            class="inline-block w-2 h-2 rounded-full bg-teal-400 animate-pulse"
                          ></span>
                          NAVTEX Receiver
                          {#if navtexStatusText}
                            <span
                              class="text-xs text-teal-300 font-mono font-normal"
                              >[{navtexStatusText}]</span
                            >
                          {:else}
                            <span
                              class="text-xs text-gray-500 font-normal italic"
                              >waiting for phasing…</span
                            >
                          {/if}
                        </h4>
                        <button
                          class="text-green-100 bg-green-900 hover:bg-green-800 text-xs px-2 py-0.5 rounded border border-green-700 hover:border-green-500 transition-colors"
                          on:click={navtexClear}>Clear</button
                        >
                      </div>

                      <!-- Station selector + Tune button -->
                      <div class="flex flex-wrap items-center gap-2 mb-3">
                        <select
                          bind:value={navtexSelectedStation}
                          class="glass-select text-white text-xs px-2 py-1 rounded-md flex-1 min-w-0"
                          on:change={_navtexTickCountdown}
                        >
                          {#each NAVTEX_STATIONS as st}
                            <option value={st.name}>{st.name}</option>
                          {/each}
                        </select>
                        <button
                          class="text-xs px-2 py-1 rounded bg-teal-700 hover:bg-teal-600 text-white transition-colors whitespace-nowrap"
                          on:click={navtexApplyStation}
                          >⇒ Tune &amp; Set IF</button
                        >
                      </div>

                      <!-- Broadcast schedule countdown -->
                      {#if navtexScheduleRows.length > 0}
                        <div
                          class="mb-3 rounded-md bg-gray-900 overflow-hidden text-xs recess-window"
                        >
                          <div
                            class="flex items-center gap-1.5 px-2.5 py-1.5 border-b border-gray-700 bg-gray-800"
                          >
                            <svg
                              class="w-3 h-3 text-teal-400 shrink-0"
                              fill="none"
                              stroke="currentColor"
                              stroke-width="2"
                              viewBox="0 0 24 24"
                              ><circle cx="12" cy="12" r="10" /><polyline
                                points="12 6 12 12 16 14"
                              /></svg
                            >
                            <span
                              class="text-teal-400 font-semibold tracking-wide uppercase"
                              >Next Broadcasts · UTC</span
                            >
                          </div>
                          <div
                            class="overflow-y-auto max-h-40 custom-scrollbar divide-y divide-gray-800"
                          >
                            {#each navtexScheduleRows as row, i}
                              <div
                                class="flex items-center gap-2 px-2.5 py-1 {row.onAir
                                  ? 'bg-teal-900/40'
                                  : i === 0
                                    ? 'bg-gray-800/70'
                                    : 'hover:bg-gray-800/40'} transition-colors"
                              >
                                <span class="shrink-0 text-sm leading-none"
                                  >{@html window.twemoji
                                    ? window.twemoji.parse(row.flag)
                                    : row.flag}</span
                                >
                                <span
                                  class="inline-flex items-center justify-center w-4 h-4 rounded text-[10px] font-bold shrink-0
                                  {row.onAir
                                    ? 'bg-green-500 text-gray-900 animate-pulse'
                                    : row.imminent
                                      ? 'bg-red-500 text-white animate-pulse'
                                      : row.urgent
                                        ? 'bg-amber-500 text-gray-900'
                                        : i === 0
                                          ? 'bg-teal-600 text-white'
                                          : 'bg-gray-600 text-gray-300'}"
                                  >{row.id}</span
                                >
                                <span class="text-gray-200 flex-1 truncate"
                                  >{row.name}</span
                                >
                                <span
                                  class="text-gray-500 shrink-0 hidden sm:inline"
                                  >{row.area}</span
                                >
                                <span class="text-gray-400 font-mono shrink-0"
                                  >{row.nextUTC}</span
                                >
                                <span
                                  class="font-mono tabular-nums w-20 text-right shrink-0
                                  {row.onAir
                                    ? 'text-green-300 font-bold'
                                    : row.imminent
                                      ? 'text-red-400 font-bold'
                                      : row.urgent
                                        ? 'text-amber-400 font-semibold'
                                        : i === 0
                                          ? 'text-teal-300'
                                          : 'text-gray-500'}">{row.label}</span
                                >
                                {#if row.onAir}
                                  <span
                                    class="text-green-400 animate-pulse shrink-0 font-semibold"
                                    title="Transmitting now">●</span
                                  >
                                {:else if row.imminent}
                                  <span
                                    class="text-red-400 animate-pulse shrink-0 font-semibold"
                                    >●</span
                                  >
                                {:else if row.urgent}
                                  <span
                                    class="text-amber-400 animate-pulse shrink-0"
                                    title="Arm decoder now">⚡</span
                                  >
                                {/if}
                              </div>
                            {/each}
                          </div>
                        </div>
                      {/if}

                      <!-- Text output -->
                      <div
                        bind:this={navtexScrollEl}
                        class="w-full font-mono text-sm text-teal-200 bg-gray-900 rounded p-3 overflow-y-auto max-h-72 custom-scrollbar text-left recess-window"
                        style="letter-spacing:0.04em; word-break:break-all; line-height:1.5; text-align:left;"
                      >
                        {#each navtexMessages as line}
                          <div
                            class={line.startsWith("━━")
                              ? "text-teal-400 font-semibold my-1"
                              : ""}
                          >
                            {line}
                          </div>
                        {/each}
                        {#if navtexCurrentLine}
                          <div class="text-teal-100">
                            {navtexCurrentLine}<span class="animate-pulse"
                              >▋</span
                            >
                          </div>
                        {:else if navtexMessages.length === 0}
                          <div class="text-gray-500 italic text-xs">
                            Listening for NAVTEX signal…<br />
                            Set mode to
                            <strong class="text-gray-300">USB</strong>
                            and use <em>⇒ Tune &amp; Set IF</em> to auto-tune.
                          </div>
                        {/if}
                      </div>

                      <!-- Hint -->
                      <p class="text-gray-500 text-xs mt-3 leading-relaxed">
                        Mode: <strong class="text-gray-300">USB</strong> · 100
                        Baud FSK · 170 Hz shift · SITOR-B FEC · Dial set 500 Hz
                        below channel (signal centre at 500 Hz audio) ·
                        <a
                          href="https://yachtlycrew.com/tools/navtex-stations"
                          target="_blank"
                          rel="noopener noreferrer"
                          style="color:cyan;">NAVTEX Maps Stations</a
                        >
                      </p>
                      <div class="mt-3 flex justify-end">
                        <button
                          class="text-xs px-2 py-1 rounded bg-teal-700 hover:bg-teal-600 text-white transition-colors whitespace-nowrap"
                          on:click={saveNavtexText}>Save Text</button
                        >
                      </div>
                    </div>
                  {/if}
                  <!-- END NAVTEX Panel -->

                  <!-- ── RADE v1 Digital Voice Panel ──────────────────────── -->
                  {#if decoderOn && radeEnabled}
                    <div
                      class="w-full rounded-lg p-4 mt-6 text-left decoder-window decoder-panel"
                    >
                      <div
                        class="flex flex-wrap items-center justify-between gap-2 mb-3"
                      >
                        <h4
                          class="text-white font-semibold flex items-center gap-2 text-sm"
                        >
                          <span
                            class="inline-block w-2 h-2 rounded-full {radeConnected
                              ? radeSynced
                                ? 'bg-green-400 animate-pulse'
                                : 'bg-yellow-400 animate-pulse'
                              : 'bg-red-500'}"
                          ></span>
                          RADE v1 &nbsp;·&nbsp; {demodulation === "RADEL"
                            ? "RADEL (LSB)"
                            : "RADEU (USB)"}
                          <span
                            class="text-xs font-mono font-normal {radeConnected
                              ? radeSynced
                                ? 'text-green-300'
                                : 'text-yellow-300'
                              : 'text-red-400'}"
                          >
                            {#if !radeConnected}
                              Connecting to sidecar…
                            {:else if radeSynced}
                              Synced{radeSnr !== null
                                ? " · SNR " + radeSnr.toFixed(1) + " dB"
                                : ""}
                            {:else}
                              Searching for signal…
                            {/if}
                          </span>
                        </h4>
                      </div>

                      <!-- Status row -->
                      <div class="flex items-center gap-3 mb-3 text-xs">
                        <span
                          class="px-2 py-0.5 rounded font-semibold {radeConnected
                            ? 'bg-green-800 text-green-200'
                            : 'bg-gray-800 text-gray-400'}"
                        >
                          {radeConnected ? "Sidecar OK" : "No Sidecar"}
                        </span>
                        <span
                          class="px-2 py-0.5 rounded font-semibold {radeSynced
                            ? 'bg-blue-800 text-blue-200'
                            : 'bg-gray-800 text-gray-500'}"
                        >
                          {radeSynced ? "Frame Sync" : "Acquiring…"}
                        </span>
                        <span class="text-gray-500 font-mono"
                          >1500 Hz BW · FARGAN vocoder</span
                        >
                      </div>

                      <!-- Info / error -->
                      {#if !radeConnected}
                        <div
                          class="rounded bg-red-900/40 border border-red-700 px-3 py-2 text-xs text-red-300 mb-3"
                        >
                          <strong>⚠ Sidecar not reachable.</strong> Start it on
                          the server:<br />
                          <code class="text-red-200 font-mono"
                            >python3 rade_helper.py</code
                          >
                          &nbsp;(listens on port 8074)
                        </div>
                      {/if}

                      <!-- Hint -->
                      <p class="text-gray-500 text-xs mt-2 leading-relaxed">
                        FreeDV RADE v1 · decoded server-side by
                        <code class="text-gray-400">rade_helper.py</code> →
                        <code class="text-gray-400">radae_rxe.py</code> →
                        <code class="text-gray-400">lpcnet_demo</code><br />
                        {demodulation === "RADEL"
                          ? "LSB — use on 40 m / 80 m / 160 m."
                          : "USB — use on 20 m / 17 m / 15 m / 10 m."}
                        See
                        <a
                          href="https://freedv.org/radio-autoencoder/"
                          target="_blank"
                          rel="noopener noreferrer"
                          style="color:cyan;">freedv.org/radio-autoencoder</a
                        >.
                      </p>

                      <!-- FreeDV Reporter toggle -->
                      <div class="mt-3 flex items-center justify-end gap-2">
                        <button
                          class="text-xs px-3 py-1 rounded {radeReporterOpen
                            ? 'bg-green-500 hover:bg-green-400'
                            : 'bg-green-700 hover:bg-green-600'} text-white transition-colors whitespace-nowrap"
                          on:click={() =>
                            (radeReporterOpen = !radeReporterOpen)}
                        >
                          {radeReporterOpen
                            ? "▲ Hide Reporter"
                            : "📡 FreeDV Reporter"}
                        </button>
                        {#if radeReporterOpen}
                          <a
                            href="https://qso.freedv.org/"
                            target="_blank"
                            rel="noopener noreferrer"
                            class="text-xs text-gray-400 hover:text-gray-200 transition-colors"
                            >↗ open in tab</a
                          >
                        {/if}
                      </div>

                      <!-- FreeDV Reporter — native live list (was qso.freedv.org iframe) -->
                      {#if radeReporterOpen}
                        <div class="mt-2">
                          <FreeDVReporter />
                        </div>
                        <p class="text-gray-600 text-xs mt-1 text-right">
                          Live · <a
                            href="https://qso.freedv.org/"
                            target="_blank"
                            rel="noopener noreferrer"
                            class="hover:text-gray-400 transition-colors"
                            >qso.freedv.org</a
                          >
                        </p>
                      {/if}
                    </div>
                  {/if}
                  <!-- END RADE Panel -->

                  <!-- ── FSK / RTTY Decoder Panel ─────────────────────────── -->
                  {#if decoderOn && fskEnabled}
                    <div
                      class="w-full rounded-lg p-4 mt-6 text-left decoder-window decoder-panel"
                    >
                      <div
                        class="flex flex-wrap items-center justify-between gap-2 mb-3"
                      >
                        <h4
                          class="text-white font-semibold flex items-center gap-2 text-sm"
                        >
                          <span
                            class="inline-block w-2 h-2 rounded-full bg-green-400 animate-pulse"
                          ></span>
                          {isPsk
                            ? "PSK31 Decoder"
                            : isOlivia
                              ? "Olivia Decoder"
                              : "FSK / RTTY Decoder"}
                          {#if fskStatusText}
                            <span
                              class="text-xs text-green-300 font-mono font-normal"
                              >[{fskStatusText}]</span
                            >
                          {:else}
                            <span
                              class="text-xs text-gray-500 font-normal italic"
                              >waiting for lock…</span
                            >
                          {/if}
                        </h4>
                        <button
                          class="text-green-100 bg-green-900 hover:bg-green-800 text-xs px-2 py-0.5 rounded border border-green-700 hover:border-green-500 transition-colors"
                          on:click={fskClear}>Clear</button
                        >
                      </div>

                      <div class="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                        <div>
                          <label class="text-xs text-gray-300 block mb-1"
                            >Variant</label
                          >
                          <select
                            bind:value={fskVariant}
                            class="glass-select text-white text-xs px-2 py-1 rounded-md w-full"
                            on:change={fskVariantChanged}
                          >
                            <option value="maritime"
                              >Maritime FSK / SITOR</option
                            >
                            <option value="weather">Weather RTTY</option>
                            <option value="ham">Amateur RTTY</option>
                            <option value="psk31">PSK31 (BPSK)</option>
                            <option value="olivia">Olivia (MFSK)</option>
                          </select>
                        </div>
                        <div>
                          <label class="text-xs text-gray-300 block mb-1"
                            >Known frequency</label
                          >
                          <div class="flex gap-2">
                            <select
                              bind:value={fskKnownFrequency}
                              class="glass-select text-white text-xs px-2 py-1 rounded-md w-full"
                            >
                              <option value="">— Select frequency —</option>
                              {#each FSK_KNOWN_FREQUENCIES[fskVariant] || [] as item}
                                <option value={String(item.khz)}
                                  >{item.label}</option
                                >
                              {/each}
                            </select>
                            <button
                              class="text-xs px-3 py-1 rounded bg-green-700 hover:bg-green-600 text-white transition-colors whitespace-nowrap"
                              on:click={fskApplyKnownFrequency}>Tune</button
                            >
                          </div>
                        </div>
                      </div>

                      <!-- Broadcast schedule countdown -->
                      {#if fskScheduleRows.length > 0}
                        <div
                          class="mb-3 rounded-md bg-gray-900 overflow-hidden text-xs recess-window"
                        >
                          <div
                            class="flex items-center gap-1.5 px-2.5 py-1.5 border-b border-gray-700 bg-gray-800"
                          >
                            <svg
                              class="w-3 h-3 text-green-400 shrink-0"
                              fill="none"
                              stroke="currentColor"
                              stroke-width="2"
                              viewBox="0 0 24 24"
                              ><circle cx="12" cy="12" r="10" /><polyline
                                points="12 6 12 12 16 14"
                              /></svg
                            >
                            <span
                              class="text-green-400 font-semibold tracking-wide uppercase"
                              >Next Broadcasts · UTC</span
                            >
                            {#if fskScheduleTitle}
                              <span class="text-gray-500 normal-case"
                                >· {fskScheduleTitle}</span
                              >
                            {/if}
                          </div>
                          <div class="divide-y divide-gray-800">
                            {#each fskScheduleRows as row, i}
                              <div
                                class="flex items-center gap-2 px-2.5 py-1.5 {row.onAir
                                  ? 'bg-green-900/30'
                                  : i === 0
                                    ? 'bg-gray-800/70'
                                    : 'hover:bg-gray-800/40'} transition-colors"
                              >
                                <span
                                  class="font-mono text-gray-300 shrink-0 w-10"
                                  >{row.utc}</span
                                >
                                <span class="text-gray-400 flex-1 truncate"
                                  >{@html window.twemoji
                                    ? window.twemoji.parse(row.label)
                                    : row.label}</span
                                >
                                <span
                                  class="font-mono tabular-nums shrink-0
                                  {row.onAir
                                    ? 'text-green-300 font-bold'
                                    : row.imminent
                                      ? 'text-red-400 font-bold'
                                      : row.urgent
                                        ? 'text-amber-400 font-semibold'
                                        : 'text-gray-500'}"
                                  >{row.countdown}</span
                                >
                                {#if row.onAir}
                                  <span
                                    class="text-green-400 animate-pulse shrink-0"
                                    title="Transmitting now">●</span
                                  >
                                {:else if row.imminent}
                                  <span
                                    class="text-red-400 animate-pulse shrink-0"
                                    >●</span
                                  >
                                {:else if row.urgent}
                                  <span
                                    class="text-amber-400 animate-pulse shrink-0"
                                    title="Transmission starts soon">⚡</span
                                  >
                                {/if}
                              </div>
                            {/each}
                          </div>
                        </div>
                      {/if}

                      <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                        <div>
                          <label class="text-xs text-gray-300 block mb-1"
                            >Center audio (Hz)</label
                          >
                          {#if isMfskLike}
                            <!-- Free entry: a PSK31 carrier (or an Olivia block
                                 centre) can sit anywhere in the passband, and
                                 auto-tune reports an exact value that no fixed
                                 list would contain. -->
                            <input
                              type="number"
                              min="200"
                              max="2800"
                              step="1"
                              bind:value={fskCenter}
                              class="glass-select text-white text-xs px-2 py-1 rounded-md w-full"
                              on:change={() => fskApplySettings(true)}
                            />
                          {:else}
                            <select
                              bind:value={fskCenter}
                              class="glass-select text-white text-xs px-2 py-1 rounded-md w-full"
                              on:change={() => fskApplySettings(true)}
                            >
                              {#each FSK_CENTER_OPTIONS[fskVariant] || [] as v}
                                <option value={v}>{v} Hz</option>
                              {/each}
                            </select>
                          {/if}
                        </div>
                        {#if isOlivia}
                          <div>
                            <label class="text-xs text-gray-300 block mb-1"
                              >Mode (tones / Hz)</label
                            >
                            <select
                              bind:value={oliviaMode}
                              class="glass-select text-white text-xs px-2 py-1 rounded-md w-full"
                              on:change={() => fskApplySettings(true)}
                            >
                              {#each OLIVIA_MODE_OPTIONS as m}
                                <option value="{m.tones}/{m.bw}">{m.label}</option
                                >
                              {/each}
                            </select>
                          </div>
                          <div class="col-span-2">
                            <label
                              class="text-xs text-gray-300 block mb-1 flex justify-between"
                            >
                              <span>Squelch (FEC S/N)</span>
                              <span class="text-green-300 font-mono"
                                >{Number(oliviaSquelch).toFixed(1)}</span
                              >
                            </label>
                            <input
                              type="range"
                              min="3"
                              max="15"
                              step="0.5"
                              bind:value={oliviaSquelch}
                              class="w-full accent-green-500"
                              on:input={fskApplySquelch}
                            />
                            <p class="text-gray-500 text-[10px] mt-0.5">
                              Below 3.5 noise starts printing; a good signal
                              reads 8–9 on the FEC meter.
                            </p>
                          </div>
                        {/if}
                        {#if !isMfskLike}
                          <div>
                            <label class="text-xs text-gray-300 block mb-1"
                              >Shift (Hz)</label
                            >
                            <select
                              bind:value={fskShift}
                              class="glass-select text-white text-xs px-2 py-1 rounded-md w-full"
                              on:change={() => fskApplySettings(true)}
                            >
                              {#each FSK_SHIFT_OPTIONS[fskVariant] || [] as v}
                                <option value={v}>{v} Hz</option>
                              {/each}
                            </select>
                          </div>
                          <div>
                            <label class="text-xs text-gray-300 block mb-1"
                              >Baud</label
                            >
                            <select
                              bind:value={fskBaud}
                              class="glass-select text-white text-xs px-2 py-1 rounded-md w-full"
                              on:change={() => fskApplySettings(false)}
                            >
                              {#each FSK_BAUD_OPTIONS[fskVariant] || [] as v}
                                <option value={v}>{v}</option>
                              {/each}
                            </select>
                          </div>
                          <div>
                          <label class="text-xs text-gray-300 block mb-1"
                            >Framing</label
                          >
                          <select
                            bind:value={fskFraming}
                            class="glass-select text-white text-xs px-2 py-1 rounded-md w-full"
                            on:change={() => fskApplySettings(false)}
                          >
                            <option value="5N1">5N1</option>
                            <option value="5N1.5">5N1.5</option>
                            <option value="5N2">5N2</option>
                            <option value="7N1">7N1</option>
                            <option value="7E1">7E1</option>
                            <option value="7O1">7O1</option>
                            <option value="8N1">8N1</option>
                          </select>
                          </div>
                        {/if}
                      </div>

                      {#if !isMfskLike}
                        <div class="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                          <div>
                            <label class="text-xs text-gray-300 block mb-1"
                              >Encoding</label
                            >
                            <select
                              bind:value={fskEncoding}
                              class="glass-select text-white text-xs px-2 py-1 rounded-md w-full"
                              on:change={() => fskApplySettings(false)}
                            >
                              <option value="ccir476">CCIR-476</option>
                              <option value="ita2">ITA2 / Baudot</option>
                              <option value="ascii">ASCII</option>
                            </select>
                          </div>
                          <label
                            class="flex items-center gap-2 text-xs text-gray-300 mt-5"
                          >
                            <input
                              type="checkbox"
                              bind:checked={fskInvert}
                              on:change={() => fskApplySettings(false)}
                            />
                            Invert mark / space
                          </label>
                          <label
                            class="flex items-center gap-2 text-xs text-gray-300 mt-5"
                          >
                            <input
                              type="checkbox"
                              bind:checked={fskAutoShift}
                              on:change={() => fskApplySettings(false)}
                            />
                            Auto shift detect
                          </label>
                        </div>
                      {/if}

                      <div
                        class="flex flex-wrap items-center gap-2 mb-3 text-xs"
                      >
                        <button
                          class="text-xs px-3 py-1 rounded bg-green-700 hover:bg-green-600 text-white transition-colors whitespace-nowrap"
                          on:click={fskApplyBandpass}>⇒ Set IF Band-Pass</button
                        >
                        <button
                          class="text-xs px-3 py-1 rounded bg-blue-700 hover:bg-blue-600 text-white transition-colors whitespace-nowrap"
                          on:click={() => {
                            audio.setFSKAutoCenter(true);
                            fskStatusText = "Auto-tune scanning…";
                          }}>⟳ Auto-tune Center</button
                        >
                        {#if isPsk}
                          <span class="text-gray-300"
                            >Carrier: <span class="text-green-300 font-mono"
                              >{Math.round(fskMetrics.centerHz || 0)} Hz</span
                            ></span
                          >
                          <span class="text-gray-300"
                            >IMD: <span class="text-green-300 font-mono"
                              >{Number(fskMetrics.imdDb || 0).toFixed(1)} dB</span
                            ></span
                          >
                        {:else if isOlivia}
                          <span class="text-gray-300"
                            >Centre: <span class="text-green-300 font-mono"
                              >{Math.round(fskMetrics.centerHz || 0)} Hz</span
                            ></span
                          >
                          <span class="text-gray-300"
                            >Mode: <span class="text-green-300 font-mono"
                              >{oliviaCfg.label}</span
                            ></span
                          >
                        {:else}
                          <span class="text-gray-300"
                            >Mark: <span class="text-green-300 font-mono"
                              >{Math.round(fskMetrics.markHz || 0)} Hz</span
                            ></span
                          >
                          <span class="text-gray-300"
                            >Space: <span class="text-green-300 font-mono"
                              >{Math.round(fskMetrics.spaceHz || 0)} Hz</span
                            ></span
                          >
                        {/if}
                        <span class="text-gray-300"
                          >{isMfskLike ? "S/N" : "SNR"}: <span
                            class="text-green-300 font-mono"
                            >{Number(fskMetrics.snrDb || 0).toFixed(1)} dB</span
                          ></span
                        >
                        <span class="text-gray-300"
                          >{isOlivia ? "FEC" : "Lock"}: <span
                            class="text-green-300 font-mono"
                            >{fskMetrics.lockQuality || 0}%</span
                          ></span
                        >
                        <span class="text-gray-300"
                          >{isOlivia ? "Sync" : "Timing"}: <span
                            class="{fskMetrics.timingLocked
                              ? 'text-green-300'
                              : 'text-gray-500'} font-mono"
                            >{fskMetrics.timingLocked
                              ? isOlivia
                                ? "SYNCED"
                                : "LOCKED"
                              : "SEARCH"}</span
                          ></span
                        >
                      </div>

                      <div
                        bind:this={fskScrollEl}
                        class="w-full font-mono text-sm text-green-300 bg-gray-900 rounded p-3 overflow-y-auto max-h-72 custom-scrollbar text-left recess-window"
                        style="letter-spacing:0.04em; word-break:break-word; overflow-wrap:anywhere; white-space:pre-wrap; line-height:1.5; text-align:left;"
                      >
                        {#each fskTextLines as line}
                          <div class="break-words whitespace-pre-wrap">
                            {line}
                          </div>
                        {/each}
                        {#if fskCurrentLine}
                          <div
                            class="break-words whitespace-pre-wrap text-green-100"
                          >
                            {fskCurrentLine}<span class="animate-pulse">▋</span>
                          </div>
                        {:else if fskTextLines.length === 0}
                          <div class="text-gray-500 italic text-xs">
                            {#if isPsk}
                              PSK31 decoder has taken control of mode and IF
                              while active.<br />
                              Pick a watering hole above, then use Auto-tune Center
                              or set the carrier by hand — the decoder pulls in the
                              last ±25 Hz on its own.
                            {:else if isOlivia}
                              Olivia decoder has taken control of mode and IF
                              while active.<br />
                              Olivia sends no preamble, so sync is searched for:
                              allow a few seconds before text appears. The Mode
                              setting must match the transmission exactly.
                            {:else}
                              FSK / RTTY decoder has taken control of mode and IF
                              while active.<br />
                              Use the known frequency list, then fine-tune until the
                              text becomes stable.
                            {/if}
                          </div>
                        {/if}
                      </div>

                      <!-- Hint -->
                      <p class="text-gray-500 text-xs mt-3 leading-relaxed">
                        {#if isPsk}
                          <strong class="text-gray-300"
                            >Mode: USB. Tune so the carrier sits on the Center
                            audio value,
                            <br /> and expect IMD better than −20 dB from a clean
                            transmitter</strong
                          >.
                        {:else if isOlivia}
                          <strong class="text-gray-300"
                            >Mode: USB. Pick the right tones / bandwidth — a
                            wrong Mode decodes nothing at all,
                            <br /> and the FEC lags a few blocks, so text arrives
                            in bursts</strong
                          >.
                        {:else}
                          <strong class="text-gray-300"
                            >Mode: USB. Please check "Invert mark / space" for
                            RTTY (weather),
                            <br /> but leave it unchecked for maritime FSK and HAM RTTY</strong
                          >.
                        {/if}
                      </p>
                      <div class="mt-3 flex justify-end">
                        <button
                          class="text-xs px-3 py-1 rounded bg-green-700 hover:bg-green-600 text-white transition-colors whitespace-nowrap"
                          on:click={saveFskText}>Save Text</button
                        >
                      </div>
                    </div>
                  {/if}
                  <!-- END FSK Panel -->
                </div>

                <!-- Third Column -->

                <!-- WF Begins -->
                <div
                  class="flex flex-col items-center bg-gray-800 p-6 lg:border lg:border-gray-700 rounded-none rounded-b-lg lg:rounded-none lg:rounded-r-lg screw-panel screw-col-3"
                >
                  <div class="mb-4 flex items-center gap-3">
                    <h3 class="text-white text-base font-semibold">
                      Waterfall Controls
                    </h3>
                    <button
                      class="glass-button flex items-center gap-2 px-3 py-1 text-sm"
                      on:click={toggleWaterfallDirection}
                      title="Toggle waterfall direction (W)"
                    >
                      <span
                        class={`inline-block text-[1.45rem] leading-none transition-transform duration-300 ${waterfallReverse ? "text-green-400" : "text-cyan-400"}`}
                        style:transform={waterfallReverse
                          ? "rotate(180deg)"
                          : "rotate(0deg)"}>⬆</span
                      >
                      <span
                        class={waterfallReverse
                          ? "text-green-400"
                          : "text-cyan-400"}
                      >
                        {waterfallReverse ? "Reverse" : "Default"}
                      </span>
                    </button>
                  </div>

                  <div class="w-full mb-5 space-y-4">
                    <div
                      id="brightness-controls"
                      class="flex items-center justify-between mb-2"
                    >
                      <span class="text-gray-300 text-sm w-10">Min:</span>
                      <div class="slider-container w-48 mx-2">
                        <input
                          type="range"
                          bind:value={min_waterfall}
                          min="-100"
                          max="255"
                          step="1"
                          class="glass-slider w-full"
                          on:input={handleMinMove}
                          title="Brightness slider"
                        />
                      </div>
                      <span class="text-gray-300 text-sm w-10 text-right"
                        >{min_waterfall}</span
                      >
                    </div>
                    <div class="flex items-center justify-between">
                      <span class="text-gray-300 text-sm w-10">Max:</span>
                      <div class="slider-container w-48 mx-2">
                        <input
                          type="range"
                          bind:value={max_waterfall}
                          min="0"
                          max="255"
                          step="1"
                          class="glass-slider w-full"
                          on:input={handleMaxMove}
                          title="Contrast slider"
                        />
                      </div>
                      <span class="text-gray-300 text-sm w-10 text-right"
                        >{max_waterfall}</span
                      >
                    </div>

                    <!-- Zoom Slider when Desktop -->
                    <div
                      class="flex items-center justify-between"
                      id="zoom-slider"
                    >
                      <button
                        class="glass-button text-white font-bold rounded-full w-6 h-6 flex items-center justify-center mr-4"
                        style="background: {zoomStepEnabled
                          ? 'rgba(0, 180, 255, 0.3)'
                          : 'rgba(255, 255, 255, 0.05)'}"
                        on:click={(e) => handleZoomStepMove(e, (zoomStep += 1))}
                        title="Enables manual zoom in steps"
                      >
                        <span class="text-white text-xs font-semibold">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="24"
                            height="24"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                          >
                            <path
                              d="M10 10m-7 0a7 7 0 1 0 14 0a7 7 0 1 0 -14 0"
                            />
                            <path d="M21 21l-6 -6" />
                            <path d="M8 8l-2 2l2 2" />
                            <path d="M12 8l2 2l-2 2" />
                          </svg>
                        </span>
                      </button>

                      <div class="slider-container w-48 mx-2">
                        <input
                          type="range"
                          bind:value={zoomStep}
                          min="1"
                          max="8"
                          step="1"
                          class="glass-slider w-full"
                          on:input={(e) => handleZoomStepMove(e, zoomStep)}
                          title="Zoom slider"
                        />
                      </div>

                      <span class="text-gray-300 text-sm w-10 text-right"
                        >×{zoomStep}</span
                      >
                      <hr class="border-gray-600 my-2" />
                    </div>
                  </div>
                  <!-- End of Zoom Slider when Desktop -->

                  <MagicEyeIndicator dbm={eyeDbm} />

                  <div class="w-full mt-6 mb-5">
                    <div class="flex items-center justify-center gap-2 mb-2">
                      <h3 class="text-white text-base font-semibold">Zoom</h3>
                      <button
                        class="retro-button text-white font-bold h-6 px-2 text-xs rounded-md flex items-center justify-center border border-gray-600 shadow-inner bg-gray-700 hover:bg-gray-600"
                        on:click={handleZoomToBand}
                        title="Zoom waterfall to the band of the tuned frequency"
                        >To Band</button
                      >
                    </div>
                    <div id="zoom-controls" class="grid grid-cols-4 gap-2">
                      {#each [{ action: "+", title: "Zoom in", icon: "zoom-in", text: "In" }, { action: "-", title: "Zoom out", icon: "zoom-out", text: "Out" }, { action: "max", title: "Zoom to max", icon: "maximize", text: "Max" }, { action: "min", title: "Zoom to min", icon: "minimize", text: "Min" }] as { action, title, icon, text }}
                        <button
                          class="retro-button text-white font-bold h-8 text-sm rounded-md flex items-center justify-center border border-gray-600 shadow-inner transition-all duration-200 ease-in-out bg-gray-700 hover:bg-gray-600"
                          on:click={(e) => handleWaterfallMagnify(e, action)}
                          {title}
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            class="h-4 w-4 mr-2"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                          >
                            {#if icon === "zoom-in"}
                              <circle cx="11" cy="11" r="8" />
                              <line x1="21" y1="21" x2="16.65" y2="16.65" />
                              <line x1="11" y1="8" x2="11" y2="14" />
                              <line x1="8" y1="11" x2="14" y2="11" />
                            {:else if icon === "zoom-out"}
                              <circle cx="11" cy="11" r="8" />
                              <line x1="21" y1="21" x2="16.65" y2="16.65" />
                              <line x1="8" y1="11" x2="14" y2="11" />
                            {:else if icon === "maximize"}
                              <path
                                d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"
                              />
                            {:else if icon === "minimize"}
                              <path
                                d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"
                              />
                            {/if}
                          </svg>
                          <span>{text}</span>
                        </button>
                      {/each}
                    </div>
                    <hr class="border-gray-600 my-2" />
                  </div>
                  <div class="w-full mb-4">
                    <!-- START of waterfal control buttons when Desktop -->
                    <div class="w-full mb-4">
                      <div class="grid grid-cols-1 sm:grid-cols-4 gap-2">
                        <div
                          id="waterfall-toggle"
                          class="flex flex-col items-center"
                        >
                          <span class="text-sm text-gray-300 mb-1 text-center"
                            >Waterfall</span
                          >
                          <label class="toggle-switch">
                            {#if waterfallDisplay}
                              <input
                                type="checkbox"
                                checked
                                on:change={handleWaterfallChange}
                              />
                            {:else}
                              <input
                                type="checkbox"
                                on:change={handleWaterfallChange}
                              />
                            {/if}
                            <span class="toggle-slider"></span>
                          </label>
                        </div>

                        <div
                          id="spectrum-toggle"
                          class="flex flex-col items-center"
                        >
                          <span class="text-sm text-gray-300 mb-1"
                            >Spectrum</span
                          >
                          <label class="toggle-switch">
                            {#if spectrumDisplay}
                              <input
                                type="checkbox"
                                checked
                                on:change={handleSpectrumChange}
                              />
                            {:else}
                              <input
                                type="checkbox"
                                on:change={handleSpectrumChange}
                              />
                            {/if}
                            <span class="toggle-slider"></span>
                          </label>
                        </div>

                        <div
                          id="auto-adjust"
                          class="flex flex-col items-center"
                        >
                          <span class="text-sm text-gray-300 mb-1"
                            >Auto Adj.</span
                          >
                          <label class="toggle-switch">
                            <input
                              type="checkbox"
                              on:change={() => handleAutoAdjust()}
                            />
                            <span class="toggle-slider"></span>
                          </label>
                        </div>

                        <div
                          id="bigger-waterfall"
                          class="flex flex-col items-center"
                        >
                          <span class="text-sm text-gray-300 mb-1 text-center"
                            >Height (+)</span
                          >
                          <label class="toggle-switch">
                            <input
                              type="checkbox"
                              on:change={handleWaterfallSizeChange}
                            />
                            <span class="toggle-slider"></span>
                          </label>
                        </div>
                      </div>
                      <!-- <hr class="border-gray-600 my-2" /> -->
                    </div>
                  </div>
                  <!-- END of Waterfall Control Buttons when Desktop -->

                  <div class="w-full mb-4">
                    <div id="colormap-select" class="relative">
                      <select
                        bind:value={currentColormap}
                        on:change={handleWaterfallColormapSelect}
                        class="glass-select block w-full pl-3 pr-10 py-2 text-sm rounded-lg text-gray-200 appearance-none focus:outline-none"
                      >
                        {#each availableColormaps as colormap}
                          <option value={colormap}>{colormap}</option>
                        {/each}
                      </select>
                      <div
                        class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-400"
                      >
                        <svg
                          class="fill-current h-4 w-4"
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 20 20"
                        >
                          <path
                            d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                          />
                        </svg>
                      </div>
                    </div>
                  </div>

                  <!-- Begin Bookmark Button Area -->
                  <button
                    id="bookmark-button"
                    class="glass-button text-white font-bold py-2 px-4 rounded-lg flex items-center w-full justify-center"
                    on:click={toggleBookmarkPopup}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      class="h-5 w-5 mr-2"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        d="M5 4a2 2 0 012-2h6a2 2 0 012 2v14l-5-2.5L5 18V4z"
                      />
                    </svg>
                    Bookmarks
                  </button>

                  <div
                    id="user_count_container"
                    class="w-full mt-4 bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg p-1"
                  >
                    <div
                      id="total_user_count"
                      class="bg-gray-800 rounded-md p-2 text-center flex justify-between items-center"
                    >
                      <!-- Content will be populated by JavaScript -->
                    </div>
                  </div>

                  <!-- Recording Options -->
                  <div class="mt-6 w-full">
                    <h3 class="text-white text-base font-semibold mb-2">
                      Recording Options
                    </h3>
                    <!-- Primary controls. Icons dropped and text shrunk so
                         Audio / Video / Area always fit on a single line. -->
                    <div class="flex flex-nowrap justify-center gap-2">
                      <button
                        class="bg-gray-700 hover:bg-red-600 text-white text-sm font-medium py-2 px-3 rounded-lg whitespace-nowrap transition-colors {isRecording
                          ? 'ring-2 ring-red-500'
                          : ''}"
                        on:click={toggleRecording}
                        title="Record the demodulated audio on its own (WAV)"
                      >
                        {isRecording ? "Stop Audio" : "Audio"}
                      </button>

                      <button
                        class="bg-gray-700 hover:bg-red-600 text-white text-sm font-medium py-2 px-3 rounded-lg whitespace-nowrap transition-colors {isVideoRecording
                          ? 'ring-2 ring-red-500'
                          : ''}"
                        on:click={toggleVideoRecording}
                        title="Record the waterfall display together with the demodulated audio"
                      >
                        {isVideoRecording ? "Stop Video" : "Video"}
                      </button>

                      <button
                        class="bg-gray-700 hover:bg-yellow-600 text-white text-sm font-medium py-2 px-3 rounded-lg whitespace-nowrap transition-colors disabled:opacity-50 {selectingArea
                          ? 'ring-2 ring-yellow-400'
                          : ''}"
                        on:click={toggleAreaSelection}
                        disabled={isVideoRecording}
                        title="Drag a box on the waterfall to record only that area. Records the full panel if unset."
                      >
                        {selectingArea
                          ? "Cancel"
                          : videoCrop
                            ? "Area \u2713"
                            : "Area"}
                      </button>
                    </div>

                    <!-- Secondary controls, only shown once they apply. -->
                    {#if canDownload || canDownloadVideo || (videoCrop && !selectingArea)}
                      <div class="flex flex-wrap justify-center gap-2 mt-2">
                        {#if canDownload}
                          <button
                            class="bg-gray-700 hover:bg-green-600 text-white text-xs font-medium py-2 px-3 rounded-lg whitespace-nowrap transition-colors"
                            on:click={downloadRecording}
                          >
                            Download Audio
                          </button>
                        {/if}

                        {#if canDownloadVideo}
                          <button
                            class="bg-gray-700 hover:bg-green-600 text-white text-xs font-medium py-2 px-3 rounded-lg whitespace-nowrap transition-colors"
                            on:click={downloadVideoRecording}
                          >
                            Download Video
                          </button>
                        {/if}

                        {#if videoCrop && !selectingArea}
                          <button
                            class="bg-gray-700 hover:bg-gray-600 text-white text-xs font-medium py-2 px-3 rounded-lg whitespace-nowrap transition-colors disabled:opacity-50"
                            on:click={clearVideoArea}
                            disabled={isVideoRecording}
                            title="Go back to recording the full waterfall panel"
                          >
                            Full
                          </button>
                        {/if}

                        <button
                          class="bg-gray-700 hover:bg-red-700 text-white text-xs font-medium py-2 px-3 rounded-lg whitespace-nowrap transition-colors"
                          on:click={resetRecordings}
                          title="Discard recordings and the selected area, ready for a new one"
                        >
                          Reset
                        </button>
                      </div>
                    {/if}
                  </div>
                </div>
                <!-- Audio Ends -->

                <!-- Bookmark Popup -->
                {#if showBookmarkPopup}
                  <div
                    class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
                    on:click={toggleBookmarkPopup}
                  >
                    <div
                      class="p-6 rounded-lg max-w-lg w-full max-h-[80vh] flex flex-col decoder-window popup-panel"
                      on:click|stopPropagation
                    >
                      <div class="flex justify-between items-center mb-4">
                        <h2 class="text-xl font-bold text-white">Bookmarks</h2>
                        <button
                          class="text-gray-400 hover:text-white"
                          on:click={toggleBookmarkPopup}
                        >
                          <svg
                            class="w-6 h-6"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              stroke-width="2"
                              d="M6 18L18 6M6 6l12 12"
                            ></path>
                          </svg>
                        </button>
                      </div>

                      <!-- Add Bookmark Section -->
                      <div class="mb-6">
                        <label
                          class="block text-sm font-medium text-gray-300 mb-2"
                          >Add New Bookmark</label
                        >
                        <div class="flex items-center gap-2 w-full">
                          <input
                            id="textInput"
                            class="glass-input text-white text-sm rounded-lg focus:outline-none px-3 py-2 flex-1 min-w-0"
                            bind:value={newBookmarkName}
                            placeholder="Bookmark name"
                          />
                          <input
                            class="glass-input text-white text-sm rounded-lg focus:outline-none px-3 py-2 flex-1 min-w-0"
                            bind:value={newBookmarkLabel}
                            placeholder="Label"
                          />
                          <button
                            class="glass-button text-white font-bold py-2 px-4 rounded-lg flex items-center whitespace-nowrap flex-shrink-0"
                            on:click={addBookmark}
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              class="h-5 w-5 mr-2"
                              viewBox="0 0 20 20"
                              fill="currentColor"
                            >
                              <path
                                fill-rule="evenodd"
                                d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"
                                clip-rule="evenodd"
                              />
                            </svg>
                            Add
                          </button>
                        </div>
                      </div>

                      <!-- Current Link Section -->
                      <div class="mb-6">
                        <label
                          class="block text-sm font-medium text-gray-300 mb-2"
                          >Current Link</label
                        >
                        <div class="flex items-center gap-2">
                          <input
                            type="text"
                            class="glass-input text-white text-sm rounded-lg focus:outline-none px-3 py-2 flex-grow"
                            value={link}
                            readonly
                          />
                          <button
                            class="glass-button text-white font-bold py-2 px-4 rounded-lg flex items-center"
                            on:click={handleLinkCopyClick}
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              class="h-5 w-5 mr-2"
                              viewBox="0 0 20 20"
                              fill="currentColor"
                            >
                              <path
                                d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z"
                              />
                              <path
                                d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z"
                              />
                            </svg>
                            Copy
                          </button>
                        </div>
                      </div>

                      <!-- amkbookmarks -->

                      <!-- upload bookmark section -->

                      <div class="mb-6">
                        <label
                          class="block text-sm font-medium text-gray-300 mb-2"
                          >Upload - Download Bookmarks. If you don't see them,
                          please refresh the webpage (or press F5)!
                        </label>
                        <div class="flex items-center gap-2">
                          <!-- Click button το file input -->

                          <!-- Descret input type file  -->
                          <input
                            type="file"
                            accept=".json, .csv, application/json"
                            style="display: none;"
                            on:change={uploadBookmarks}
                            bind:this={fileInput}
                          />

                          <!-- Button for activating file input  -->
                          <button
                            class="glass-button text-white font-bold py-2 px-4 rounded-lg flex items-center"
                            on:click={() => fileInput.click()}
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              class="h-5 w-5 mr-2"
                              viewBox="0 0 20 20"
                              fill="currentColor"
                            >
                              <path
                                d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z"
                              />
                              <path
                                d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z"
                              />
                            </svg>
                            Upload Bookmarks
                          </button>

                          <!-- End of upload bookmark section -->

                          <!-- download bookmark Section -->

                          <button
                            class="glass-button text-white font-bold py-2 px-4 rounded-lg flex items-center"
                            on:click={downloadBookmarks}
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              class="h-5 w-5 mr-2"
                              viewBox="0 0 20 20"
                              fill="currentColor"
                            >
                              <path
                                d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z"
                              />
                              <path
                                d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z"
                              />
                            </svg>
                            Download Bookmarks
                          </button>
                        </div>
                      </div>

                      <!-- End off Download bookmark Section -->

                      <!-- end of amkbookmarks -->

                      <!-- Bookmarks List -->
                      <div class="overflow-y-auto flex-grow h-80">
                        <label
                          class="block text-sm font-medium text-gray-300 mb-2"
                          >Saved Bookmarks</label
                        >
                        {#each $bookmarks as bookmark, index}
                          <div
                            class="glass-panel rounded-lg p-3 flex items-center justify-between mb-2"
                          >
                            <div class="flex flex-col">
                              <span class="text-white text-sm"
                                >{bookmark.name}</span
                              >
                              <span class="text-gray-400 text-xs"
                                >{(bookmark.frequency / 1000).toFixed(3)} kHz</span
                              >
                            </div>
                            <div class="flex gap-2">
                              <button
                                class="glass-button text-white font-bold py-1 px-3 rounded-lg flex items-center"
                                on:click={() => goToBookmark(bookmark)}
                              >
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  class="h-4 w-4 mr-1"
                                  viewBox="0 0 20 20"
                                  fill="currentColor"
                                >
                                  <path
                                    fill-rule="evenodd"
                                    d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z"
                                    clip-rule="evenodd"
                                  />
                                </svg>
                                Go
                              </button>
                              <button
                                class="glass-button text-white font-bold py-1 px-3 rounded-lg flex items-center"
                                on:click={() => copy(bookmark.link)}
                              >
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  class="h-4 w-4 mr-1"
                                  viewBox="0 0 20 20"
                                  fill="currentColor"
                                >
                                  <path
                                    d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z"
                                  />
                                  <path
                                    d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z"
                                  />
                                </svg>
                                Copy
                              </button>
                              <button
                                class="glass-button text-white font-bold py-1 px-3 rounded-lg flex items-center"
                                on:click={() => deleteBookmark(index)}
                              >
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  class="h-4 w-4 mr-1"
                                  viewBox="0 0 20 20"
                                  fill="currentColor"
                                >
                                  <path
                                    fill-rule="evenodd"
                                    d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                                    clip-rule="evenodd"
                                  />
                                </svg>
                                Delete
                              </button>
                            </div>
                          </div>
                        {/each}
                      </div>
                    </div>
                  </div>
                {/if}
              </div>
            </div>

            {#if siteChatEnabled}
              <!--Beginn of Chatbox -->
              <!--To disable Chatbox: Delte Code from here to .. -->

              <div
                class="flex flex-col rounded p-2 justify-center"
                id="chat-column"
              >
                <div
                  class="p-3 sm:p-5 flex flex-col bg-gray-800 border border-gray-700 rounded-lg w-full mb-2 screw-panel"
                  id="chat-box"
                >
                  <h2
                    class="text-xl sm:text-2xl font-semibold text-gray-100 mb-2 sm:mb-4"
                  >
                    Chat
                  </h2>

                  <!-- Username Display/Input -->
                  <div class="mb-2 sm:mb-4 flex flex-wrap items-center">
                    <span
                      class="text-white text-xs sm:text-sm mr-2 mb-2 sm:mb-0"
                      >Chatting as:</span
                    >
                    {#if showUsernameInput}
                      <input
                        class="glass-input text-white py-1 px-2 rounded-lg outline-none text-xs sm:text-sm flex-grow mr-2 mb-2 sm:mb-0"
                        bind:value={username}
                        placeholder="Enter your name/callsign"
                        on:keydown={(e) => e.key === "Enter" && saveUsername()}
                      />
                      <button
                        class="glass-button text-white py-1 px-3 mb-2 lg:mb-0 rounded-lg text-xs sm:text-sm"
                        on:click={saveUsername}
                      >
                        Save
                      </button>
                    {:else}
                      <span
                        class="glass-username text-white text-xs sm:text-sm px-3 py-1 rounded-lg mr-2 mb-2 sm:mb-0"
                      >
                        {username || myDisplayId || "Anonymous"}
                      </span>
                      <button
                        class="glass-button text-white py-1 px-3 mb-2 lg:mb-0 rounded-lg text-xs sm:text-sm"
                        on:click={editUsername}
                      >
                        Edit
                      </button>
                    {/if}
                  </div>

                  <!-- Chat Messages -->
                  <div
                    class="bg-gray-900 rounded-lg p-2 sm:p-3 mb-2 sm:mb-4 h-48 sm:h-64 overflow-y-auto custom-scrollbar"
                    bind:this={chatMessages}
                  >
                    {#each $messages as { id, text } (id)}
                      {@const formattedMessage = formatFrequencyMessage(text)}
                      <div
                        class="mb-2 sm:mb-3 text-left"
                        in:fly={{ y: 20, duration: 300, easing: quintOut }}
                      >
                        <div
                          class="inline-block bg-gray-800 rounded-lg p-2 max-w-full"
                        >
                          <p class="text-white text-xs sm:text-sm break-words">
                            <span class="font-semibold text-blue-300"
                              >{formattedMessage.username}</span
                            >
                            <span class="text-xs text-gray-400 ml-2"
                              >{formattedMessage.timestamp}</span
                            >
                          </p>
                          <p
                            class="text-white text-xs sm:text-sm break-words mt-1"
                          >
                            {#if formattedMessage.isFormatted}
                              {@html renderParts(formattedMessage.beforeFreq)}
                              <a
                                href="#"
                                class="text-blue-300 hover:underline"
                                on:click|preventDefault={() =>
                                  handleFrequencyClick(
                                    formattedMessage.frequency,
                                    formattedMessage.demodulation,
                                  )}
                              >
                                {(formattedMessage.frequency / 1000).toFixed(3)}
                                kHz ({formattedMessage.demodulation})
                              </a>
                              {@html renderParts(formattedMessage.afterFreq)}
                            {:else}
                              {@html renderParts(formattedMessage.parts)}
                            {/if}
                          </p>
                        </div>
                      </div>
                    {/each}
                  </div>

                  <!-- Message Input and Buttons -->
                  <div
                    class="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2"
                  >
                    <input
                      id="textInput"
                      class="glass-input text-white py-2 px-3 rounded-lg outline-none text-xs sm:text-sm flex-grow"
                      bind:value={newMessage}
                      on:keydown={handleEnterKey}
                      placeholder="Type a message..."
                    />
                    <div class="flex space-x-2">
                      <div class="emoji-btn-container">
                        <button
                          class="glass-button text-white font-semibold py-2 px-3 rounded-lg flex items-center justify-center text-xs sm:text-sm"
                          on:click|stopPropagation={toggleEmojiPicker}
                          title="Emoji"
                        >
                          😊
                        </button>
                        {#if showEmojiPicker}
                          <div
                            class="emoji-picker-wrapper"
                            on:click|stopPropagation
                          >
                            <emoji-picker class="dark" use:emojiAction
                            ></emoji-picker>
                          </div>
                        {/if}
                      </div>
                      <button
                        class="glass-button text-white font-semibold py-2 px-4 rounded-lg flex items-center justify-center text-xs sm:text-sm flex-grow sm:flex-grow-0"
                        on:click={sendMessage}
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          class="h-4 w-4 mr-2"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path
                            d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z"
                          />
                        </svg>
                        Send
                      </button>
                      <button
                        class="glass-button text-white font-semibold py-2 px-4 rounded-lg flex items-center justify-center text-xs sm:text-sm flex-grow sm:flex-grow-0"
                        on:click={pasteFrequency}
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          class="h-4 w-4 mr-2"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path
                            d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z"
                          />
                          <path
                            d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z"
                          />
                        </svg>
                        Paste Freq
                      </button>
                    </div>
                  </div>
                  <hr class="border-gray-600 my-2" />
                  <span class="text-xs text-gray-400"
                    >PhantomSDR+ | v{VERSION}</span
                  >
                </div>
              </div>
            {:else}{/if}
            <!--To disable Chatbox: Delte Code till above this here -->
          </div>
        </div>
        <footer class="mt-4 mb-4 text-center text-gray-400 text-sm">
          <!-- <span class="text-sm text-gray-400">PhantomSDR+ | v{VERSION}</span> -->
        </footer>
      </div>
    {:else}
      <!-- secondsvelte Mobile Version -->

      <div
        class="w-full sm:h-screen overflow-y-scroll sm:w-1/2 xl:w-1/3 lg:w-1/4 sm:transition-all sm:ease-linear sm:duration-100"
        style="width:100%;"
      >
        <div
          class="min-h-screen bg-custom-dark text-gray-200"
          style="padding-top: 3px;"
        >
          <div class="max-w-screen-lg mx-auto">

            <!--Titel Box with Admin Infos, to be personalized-->
            <div
              class="flex flex-col rounded p-2 justify-center"
              id="chat-column"
            >
              <div
                class="p-3 sm:p-5 flex flex-col bg-gray-800 rounded-lg w-full mb-2"
                id="chat-box"
                style="opacity: 0.85;"
              >
                <!-- Header -->
                <div
                  class="text-xs sm:text-sm font-semibold text-gray-100 mb-2 sm:mb-4"
                >
                  <a
                    href="https://www.qrz.com/db/{siteSysop}"
                    target="new"
                    style="color:rgba(0, 225, 255, 0.993)">{siteSysop}</a
                  >
                  PhantomSDR+ in
                  <a
                    href="http://k7fry.com/grid/?qth={siteGridSquare}"
                    target="new"
                    style="color:rgba(0, 225, 255, 0.993)"
                    >{siteCity}, {siteGridSquare}</a
                  >
                  <br />
                  <button
                    type="button"
                    class="glass-button text-white py-1 px-3 mb-2 rounded-lg text-xs"
                    on:click={openUsers}
                    title="Connected Users"
                    aria-haspopup="dialog"
                    aria-expanded={showUsers}
                    aria-controls="users-dialog"
                    style="color:rgba(0, 225, 255, 0.993)"
                  >
                    📝 Users
                  </button>
                  &nbsp; Other &nbsp;
                  <a
                    href="https://sdr-list.xyz/"
                    target="new"
                    style="color:rgba(0, 225, 255, 0.993)">Servers</a
                  >
                  &nbsp;
                  <!-- Carries the current tuning across the page load, so the
                       simplified page opens where this one was tuned. -->
                  <a
                    href={mobilePageHref}
                    class="glass-button text-white py-1 px-3 mb-1 rounded-lg text-xs"
                    title="Simplified mobile"
                    style="background:rgba(200, 30, 30, 0.95); color:rgb(255, 230, 0)"
                    >Simplified mobile</a
                  >
                </div>
              </div>
              <!--End of Titel Box -->

              <!--Beginn of Waterfall -->
              <div class="flex justify-center w-full">
                <div class="w-full" id="outer-waterfall-container">
                  <div
                    style="image-rendering:pixelated;"
                    class="relative w-full xl:rounded-lg peer overflow-hidden"
                    id="waterfall"
                  >
                    <VideoAreaSelector
                      active={selectingArea}
                      crop={videoCrop}
                      getLayers={videoRecordingLayers}
                      on:select={handleAreaSelect}
                      on:cancel={handleAreaCancel}
                    />
                    <div class="relative w-full">
                      <canvas
                        class="w-full bg-black peer {spectrumDisplay
                          ? 'max-h-40'
                          : 'max-h-0'}"
                        bind:this={spectrumCanvas}
                        on:wheel={handleWaterfallWheel}
                        on:mousedown={handleWaterfallMouseDown}
                        on:mousemove={handleSpectrumMouseMove}
                        on:mouseleave={handleSpectrumMouseLeave}
                        width="1024"
                        height="128"
                      ></canvas>
                      <!-- Bandwidth highlight mirrored from the waterfall -->
                      <div
                        bind:this={spectrumHighlightInner}
                        class="pointer-events-none absolute top-0 bottom-0 z-[9999] bg-yellow-300/10 border-l border-r border-yellow-300/60"
                        style="pointer-events: none; display: none;"
                      ></div>
                    </div>
                    <canvas
                      class="w-full bg-black peer"
                      bind:this={topGraduationCanvas}
                      on:wheel={handleWaterfallWheel}
                      on:click={passbandTunerComponent.handlePassbandClick}
                      on:mousedown={(e) =>
                        passbandTunerComponent.handleMoveStart(e, 1)}
                      on:touchstart={passbandTunerComponent.handleTouchStart}
                      on:touchmove={passbandTunerComponent.handleTouchMove}
                      on:touchend={passbandTunerComponent.handleTouchEnd}
                      width="1024"
                      height="20"
                    ></canvas>
                    <!-- ★ Admin waterfall message — mobile bar -->
                    {#if adminMessage}
                      <div
                        style="width:100%;background:rgba(0,0,0,0.88);
                                  border-left:4px solid #ffb000;padding:5px 12px;
                                  font-family:monospace;font-size:12px;font-weight:bold;
                                  display:flex;align-items:center;gap:8px;
                                  box-shadow:0 2px 6px rgba(0,0,0,0.5);"
                      >
                        <span style="color:#ffb000;flex-shrink:0;"
                          >&#9733; ADMIN:</span
                        >
                        <span
                          style="color:{adminMsgColor};overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"
                          >{adminMessage}</span
                        >
                      </div>
                    {/if}
                    <canvas
                      class="w-full bg-black {waterfallDisplay
                        ? 'block'
                        : 'hidden'}"
                      bind:this={waterfallCanvas}
                      style:transform={waterfallReverse
                        ? "scaleY(-1)"
                        : "scaleY(1)"}
                      style:transform-origin={"center center"}
                      use:pinch
                      on:pinchstart={handleWaterfallPinchStart}
                      on:pinchmove={handleWaterfallPinchMove}
                      use:pan
                      on:panmove={handleWaterfallPanMove}
                      on:wheel={handleWaterfallWheel}
                      on:mousedown={handleWaterfallMouseDown}
                      on:mousemove={handleWaterfallMouseMove}
                      on:mouseleave={handleWaterfallMouseLeave}
                      width="1024"
                    ></canvas>
                    <canvas
                      class="hidden"
                      bind:this={tempCanvas}
                      width="1024"
                      height="1024"
                    ></canvas>
                    <FrequencyInput
                      bind:this={frequencyInputComponent}
                      on:change={handleFrequencyChange}
                    ></FrequencyInput>

                    <FrequencyMarkers
                      bind:this={frequencyMarkerComponent}
                      bookmarks={$bookmarks}
                      on:click={passbandTunerComponent.handlePassbandClick}
                      on:wheel={handleWaterfallWheel}
                      on:markerclick={handleFrequencyMarkerClick}
                    ></FrequencyMarkers>
                    <canvas
                      class="w-full bg-black peer"
                      bind:this={graduationCanvas}
                      on:wheel={handleWaterfallWheel}
                      on:click={passbandTunerComponent.handlePassbandClick}
                      on:mousedown={(e) =>
                        passbandTunerComponent.handleMoveStart(e, 1)}
                      on:touchstart={passbandTunerComponent.handleTouchStart}
                      on:touchmove={passbandTunerComponent.handleTouchMove}
                      on:touchend={passbandTunerComponent.handleTouchEnd}
                      width="1024"
                      height="20"
                    ></canvas>
                    <PassbandTuner
                      on:change={handlePassbandChange}
                      on:wheel={handleWaterfallWheel}
                      bind:this={passbandTunerComponent}
                    ></PassbandTuner>
                    <canvas
                      class="w-full bg-black peer"
                      bind:this={bandPlanCanvas}
                      on:wheel={handleWaterfallWheel}
                      on:click={passbandTunerComponent.handlePassbandClick}
                      on:mousedown={(e) =>
                        passbandTunerComponent.handleMoveStart(e, 1)}
                      on:touchstart={passbandTunerComponent.handleTouchStart}
                      on:touchmove={passbandTunerComponent.handleTouchMove}
                      on:touchend={passbandTunerComponent.handleTouchEnd}
                      width="1024"
                      height="20"
                    >
                    </canvas>
                    <div class="relative w-full" style="min-height:14px">
                      <button
                        class="absolute top-0 right-0 z-10 text-xs px-1 leading-none rounded"
                        style="background:rgba(0,0,0,0.6);color:{showClients
                          ? '#4ade80'
                          : '#ef4444'};border:1px solid {showClients
                          ? '#4ade80'
                          : '#ef4444'};"
                        on:click={() => (showClients = !showClients)}
                        title="{showClients ? 'Hide' : 'Show'} user labels"
                        >{showClients ? "●" : "○"}</button
                      >
                      <canvas
                        class="w-full bg-black peer"
                        style="display:{showClients ? 'block' : 'none'}"
                        bind:this={clientsCanvas}
                        on:wheel={handleWaterfallWheel}
                        on:click={handleGraduationClick}
                        on:mousemove={handleClientsMouseMove}
                        on:mousedown={(e) =>
                          passbandTunerComponent.handleMoveStart(e, 1)}
                        on:touchstart={passbandTunerComponent.handleTouchStart}
                        on:touchmove={passbandTunerComponent.handleTouchMove}
                        on:touchend={passbandTunerComponent.handleTouchEnd}
                        width="1024"
                        height="20"
                      ></canvas>
                    </div>

                    <!-- Spectrogram Display -->
                    <div
                      class="mt-2 w-full"
                      style="display: {spectrogramEnabled ? 'block' : 'none'}"
                    >
                      <Spectrogram
                        bind:this={spectrogramComponent}
                        minHz={50}
                        maxHzLimit={10000}
                        fftSize={4096}
                        displayGain={spectrogramGain}
                        colorScheme={spectrogramColorScheme}
                        showLabels={true}
                        height={spectrogramHeight}
                        enabled={spectrogramEnabled}
                        on:initialized={initSpectrogram}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div
                class="absolute inset-0 z-20 bg-black bg-opacity-40 backdrop-filter backdrop-blur-sm transition-opacity duration-300 ease-in-out cursor-pointer flex justify-center items-center"
                id="startaudio"
              >
                <div class="text-center p-4 pointer-events-none">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    class="h-12 w-12 mx-auto mb-2 text-white opacity-80"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="1.5"
                      d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
                    />
                  </svg>
                  <p class="text-white text-lg font-medium">
                    Tap to enable audio
                  </p>
                </div>
              </div>

              <!-- Audio Begins -->

              <!-- First Column -->

              <div
                class="flex flex-col xl:flex-row rounded sm:px-5 sm:pt-2 sm:pb-0.5 justify-center rounded mt-4 sm:mt-0"
                id="middle-column"
              >
                <div
                  class="sm:p-5 flex flex-col items-center bg-gray-800 lg:border lg:border-gray-700 rounded-none rounded-t-lg lg:rounded-none lg:rounded-l-lg"
                >
                  <div class="control-group" id="volume-slider">
                    <button
                      class="glass-button text-white font-bold rounded-full w-7 h-6 flex items-center justify-center mr-4"
                      style="background: {mute
                        ? 'rgba(255, 0, 0, 0.3)'
                        : 'rgba(255, 255, 255, 0.05)'}"
                      on:click={handleMuteChange}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        class="w-4 h-6"
                      >
                        {#if mute}
                          <path
                            d="M13.5 4.06c0-1.336-1.616-2.005-2.56-1.06l-4.5 4.5H4.508c-1.141 0-2.318.664-2.66 1.905A9.76 9.76 0 001.5 12c0 .898.121 1.768.35 2.595.341 1.24 1.518 1.905 2.659 1.905h1.93l4.5 4.5c.945.945 2.561.276 2.561-1.06V4.06zM17.78 9.22a.75.75 0 10-1.06 1.06L18.44 12l-1.72 1.72a.75.75 0 001.06 1.06L19.5 13.06l1.72 1.72a.75.75 0 101.06-1.06L20.56 12l1.72-1.72a.75.75 0 00-1.06-1.06L19.5 10.94l-1.72-1.72z"
                          />
                        {:else}
                          <path
                            d="M13.5 4.06c0-1.336-1.616-2.005-2.56-1.06l-4.5 4.5H4.508c-1.141 0-2.318.664-2.66 1.905A9.76 9.76 0 001.5 12c0 .898.121 1.768.35 2.595.341 1.24 1.518 1.905 2.659 1.905h1.93l4.5 4.5c.945.945 2.561.276 2.561-1.06V4.06zM18.584 5.106a.75.75 0 011.06 0c3.808 3.807 3.808 9.98 0 13.788a.75.75 0 11-1.06-1.06 8.25 8.25 0 000-11.668.75.75 0 010-1.06z"
                          />
                        {/if}
                      </svg>
                    </button>
                    &nbsp;&nbsp;&nbsp;
                    <div class="slider-container">
                      <input
                        type="range"
                        bind:value={volume}
                        on:input={handleVolumeChange}
                        class="glass-slider"
                        disabled={mute}
                        min="0"
                        max="100"
                        step="1"
                      />
                    </div>
                    <span class="value-display text-xs text-gray-300 ml-4"
                      >{volume}%</span
                    >
                  </div>

                  <div class="control-group mt-1" id="squelch-slider">
                    <button
                      class="glass-button text-white font-bold rounded-full w-7 h-6 flex items-center justify-center mr-4"
                      style="background: {squelchEnable
                        ? 'rgba(255, 100, 0, 0.3)'
                        : 'rgba(255, 255, 255, 0.05)'}"
                      on:click={handleSquelchChange}
                    >
                      <span class="text-xs font-semibold">SQ</span>
                    </button>
                    &nbsp;&nbsp;&nbsp;
                    <div class="slider-container">
                      <input
                        type="range"
                        bind:value={squelch}
                        on:input={handleSquelchMove}
                        class="glass-slider"
                        min="-150"
                        max="0"
                        step="1"
                      />
                    </div>
                    <span class="value-display text-xs text-gray-300 ml-4"
                      >{squelch}db</span
                    >
                  </div>

                  <!-- AI noise reduction (RNNoise) -->
                  <div class="control-group mt-1" id="ai-nr-slider">
                    <button
                      class="glass-button text-white font-bold rounded-full w-7 h-6 flex items-center justify-center mr-4 {AINREnabled &&
                      !AINRActive
                        ? 'opacity-50'
                        : ''} {AINRLoading ? 'animate-pulse' : ''}"
                      style="background: {AINREnabled
                        ? 'rgba(0, 140, 255, 0.35)'
                        : 'rgba(255, 255, 255, 0.05)'}"
                      on:click={handleAINRChange}
                      title="AI noise reduction (RNNoise)
Voice modes only: USB, LSB, AM
Slider: share of denoised audio, the rest is the original"
                    >
                      <span class="text-xs font-semibold">AI</span>
                    </button>
                    &nbsp;&nbsp;&nbsp;
                    <div class="slider-container">
                      <input
                        type="range"
                        bind:value={AINRStrength}
                        on:input={handleAINRStrength}
                        title="AI strength slider"
                        class="glass-slider"
                        min="0"
                        max="100"
                        step="5"
                      />
                    </div>
                    <span
                      class="value-display text-xs ml-4 {AINREnabled
                        ? 'text-gray-300'
                        : 'text-gray-600'}"
                      >{AINRStrength}%</span
                    >
                  </div>

                  <!-- Zoom Slider  -->
                  <div class="control-group mt-4" id="zoom-slider">
                    <button
                      class="glass-button text-white font-bold rounded-full w-7 h-6 flex items-center justify-center mr-4"
                      style="background: {zoomStepEnabled
                        ? 'rgba(0, 180, 255, 0.3)'
                        : 'rgba(255, 255, 255, 0.05)'}"
                      on:click={(e) => handleZoomStepMove(e, (zoomStep += 1))}
                    >
                      <span class="text-white text-xs font-semibold">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="18"
                          height="18"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="2"
                          stroke-linecap="round"
                          stroke-linejoin="round"
                        >
                          <path
                            d="M10 10m-7 0a7 7 0 1 0 14 0a7 7 0 1 0 -14 0"
                          />
                          <path d="M21 21l-6 -6" />
                          <path d="M8 8l-2 2l2 2" />
                          <path d="M12 8l2 2l-2 2" />
                        </svg>
                      </span>
                    </button>
                    &nbsp;&nbsp;&nbsp;
                    <div class="slider-container">
                      <input
                        type="range"
                        bind:value={zoomStep}
                        on:input={(e) => handleZoomStepMove(e, zoomStep)}
                        class="glass-slider"
                        min="1"
                        max="8"
                        step="1"
                      />
                    </div>

                    <span class="value-display text-xs text-gray-300 ml-4"
                      >×{zoomStep}</span
                    >
                  </div>
                  <!-- End of Zoom Slider -->

                  <!-- Audio Ends -->
                  <span>&nbsp;</span>
                  {#if isV2}
                  <!-- Begin of TOP Fine Tuning Buttons by sv2amk -->
                  <div class="grid grid-cols-7 sm:grid-cols-7 gap-2">
                    {#each mobiletopfinetuningsteps as finetuningstep}
                      <button
                        id="mobile-fine-tuning-selector"
                        class="retro-button text-white font-bold h-5 text-sm rounded-md flex items-center justify-center border border-gray-600 shadow-inner transition-all duration-200 ease-in-out bg-gray-700 hover:bg-gray-600"
                        on:click={() => handleFineTuningStep(finetuningstep)}
                        title="{finetuningstep} kHz"
                      >
                        {finetuningstep}
                      </button>
                    {/each}
                  </div>
                  {/if}

                  <!-- Second Column -->

                  <div
                    class="flex flex-col items-center bg-gray-800 sm:p-6 border-l-0 border-r-0 border border-gray-700"
                  >
                    <div
                      class="bg-black rounded-lg p-2 sm:p-8 min-w-0 lg:min-w-0 lg:p-4 mb-4 w-full"
                      id="smeter-tut"
                    >
                      <div
                        class="flex flex-col sm:flex-row items-center justify-between gap-4"
                      >
                        <div class="flex flex-col items-center">
                          <!--
                  Added by sv2amk to triger the initBandButton function
                  and show the proper band upon startup
-->
                          {#if currentBand == -2}
                            {initBandButton(frequency)}
                          {/if}
                          <input
                            class="w-56 max-w-full text-center bg-black text-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-500 rounded-lg mb-2"
                            style="font-size: clamp(1.6rem, 8vw, 2.4rem); font-weight: 600; line-height: 1.25; padding: 4px 6px;"
                            type="text"
                            inputmode="decimal"
                            autocomplete="off"
                            autocorrect="off"
                            autocapitalize="off"
                            spellcheck="false"
                            value={mobileFreqValue}
                            on:input={(e) =>
                              (mobileFreqTyped = e.currentTarget.value)}
                            size="3"
                            name="frequency"
                            on:focus={selectMobileFreq}
                            on:blur={commitMobileFreq}
                            on:keydown={(e) => {
                              if (e.key === "Enter") {
                                e.currentTarget.blur();
                              }
                            }}
                          />

                          {#if isAnalog}
                            <SMeterAnalog dbm={smeterDbmFlat} mobile />
                          {:else}
                            <SMeterDigital
                              rawDb={smeterRawDb}
                              {smeterOffset}
                              mobile
                            />
                          {/if}

                          <div
                            class="flex items-center justify-center text-xs w-48"
                          >
                            <span class="text-cyan-400 px-1"
                              >Current Band:&nbsp;{bandName}</span
                            >
                          </div>
                          <div
                            class="flex items-center justify-center text-xs w-48"
                          >
                            <span class="text-yellow-400 px-1">{vfo}</span>
                            <span class="text-gray-400 px-1">|</span>
                            <span class="text-green-400 px-1"
                              >{demodulation}</span
                            >
                            <span class="text-gray-400 px-1">|</span>
                            <span class="text-cyan-300 px-1"
                              >{bandwidth} kHz</span
                            >
                          </div>

                          <!-- w-full, not w-48: with AI added the row is ~223 px
                               of text, wider than a w-48 box (it spilled over
                               both sides; the panel has ~330 px). -->
                          <div
                            class="flex items-center justify-center text-xs w-full"
                          >
                            <span
                              class="text-xs font-mono {mute
                                ? 'text-red-500'
                                : 'text-red-500/20'}"
                              >MUTED</span
                            >
                            &nbsp;&nbsp;&nbsp;&nbsp;
                            <span
                              class="text-xs font-mono {squelchEnable
                                ? `text-orange-500`
                                : `text-orange-500/20`}"
                              >SQ</span
                            >
                            &nbsp;&nbsp;&nbsp;&nbsp;
                            <span
                              class="text-xs font-mono {AINREnabled
                                ? AINREnabled && !AINRActive
                                  ? `text-cyan-400/50`
                                  : `text-cyan-400`
                                : `text-cyan-400/20`}"
                              >AI</span
                            >
                            &nbsp;&nbsp;&nbsp;&nbsp;
                            <span
                              class="text-xs font-mono {NREnabled
                                ? `text-green-500`
                                : `text-green-500/20`}"
                              >NR</span
                            >
                            &nbsp;&nbsp;&nbsp;&nbsp;
                            <span
                              class="text-xs font-mono {NBEnabled
                                ? `text-green-500`
                                : `text-green-500/20`}"
                              >NB<span> </span></span
                            >
                            &nbsp;&nbsp;&nbsp;&nbsp;
                            <span
                              class="text-xs font-mono {NSEnabled
                                ? `text-green-500`
                                : `text-green-500/20`}"
                              >NS</span
                            >
                            &nbsp;&nbsp;&nbsp;&nbsp;
                            <span
                              class="text-xs font-mono {ANEnabled
                                ? `text-green-500`
                                : `text-green-500/20`}"
                              >AN</span
                            >
                            &nbsp;&nbsp;&nbsp;&nbsp;
                            <span
                              class="text-xs font-mono {CTCSSSupressEnabled
                                ? `text-yellow-500`
                                : `text-yellow-500/20`}"
                              >CTCSS</span
                            >
                          </div>
                        </div>
                      </div>
                    </div>
                    {#if !isV2}
                      <!-- Begin of TOP Fine Tuning Buttons by sv2amk -->
                      <div class="grid grid-cols-7 sm:grid-cols-7 gap-2">
                        {#each mobiletopfinetuningsteps as finetuningstep}
                          <button
                            id="mobile-fine-tuning-selector"
                            class="retro-button text-white font-bold h-5 text-sm rounded-md flex items-center justify-center border border-gray-600 shadow-inner transition-all duration-200 ease-in-out bg-gray-700 hover:bg-gray-600"
                            on:click={() => handleFineTuningStep(finetuningstep)}
                            title="{finetuningstep} kHz"
                          >
                            {finetuningstep}
                          </button>
                        {/each}
                      </div>
                    {/if}
                  </div>
                  <div id="frequencyContainer" class="w-full mt-4">
                    <div class="space-y-5">
                      <!-- Phil -->
                      <!-- Begin Popup Buttons Menu -->
                      <div class="w-full mt-4">
                        <div class="grid grid-cols-5 sm:grid-cols-5 gap-2">
                          <button
                            id="vfo-ab-button"
                            class="glass-button h-8 text-white text-sm font-bold py-2 px-1 rounded-lg flex items-center w-full justify-center whitespace-nowrap {toggleVFO ===
                            vfo
                              ? 'bg-green-600 pressed scale-95'
                              : 'bg-blue-700 hover:bg-gray-600'}"
                            on:click={() => toggleVFO(vfo)}
                            title="VFO Toggle"
                          >
                            {vfo}
                          </button>

                          <button
                            id="mode-button"
                            class="glass-button h-8 text-white text-sm font-bold py-2 px-1 rounded-lg flex items-center w-full justify-center whitespace-nowrap"
                            on:click={toggleModePopup}
                          >
                            Mode
                          </button>
                          <!-- Mode Popup -->
                          {#if showModePopup}
                            <div
                              class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
                              on:click={toggleModePopup}
                            >
                              <div
                                class="p-6 rounded-lg max-w-lg w-full max-h-[80vh] flex flex-col decoder-window popup-panel"
                                on:click|stopPropagation
                              >
                                <div
                                  class="flex justify-between items-center mb-4"
                                >
                                  <h2 class="text-base font-bold text-white">
                                    Modes
                                  </h2>
                                  <button
                                    class="text-gray-400 hover:text-white"
                                    on:click={toggleModePopup}
                                  >
                                    <svg
                                      class="w-6 h-6"
                                      fill="none"
                                      stroke="currentColor"
                                      viewBox="0 0 24 24"
                                      xmlns="http://www.w3.org/2000/svg"
                                    >
                                      <path
                                        stroke-linecap="round"
                                        stroke-linejoin="round"
                                        stroke-width="2"
                                        d="M6 18L18 6M6 6l12 12"
                                      ></path>
                                    </svg>
                                  </button>
                                </div>
                                <!--Mode Content Begins -->
                                <div
                                  id="demodulationModes"
                                  class="grid grid-cols-3 sm:grid-cols-6 gap-2 w-full max-w-md"
                                >
                                  {#each ["USB", "LSB", "CW", "AM", "QUAM", "FM"] as mode}
                                    <button
                                      class="retro-button {mode === 'QUAM' &&
                                      cquamPilotDetected
                                        ? 'text-green-400 font-bold'
                                        : mode === 'AM' && samLocked
                                          ? 'text-yellow-400 font-bold'
                                          : 'text-white'} font-bold h-10 text-base rounded-md flex items-center justify-center border border-gray-600 shadow-inner transition-all duration-200 ease-in-out {demodulation ===
                                      mode
                                        ? 'bg-blue-600 pressed scale-95'
                                        : 'bg-gray-700 hover:bg-gray-600'}"
                                      on:click={() => setModePopup(mode)}
                                      >{mode === "AM" &&
                                      demodulation === "AM" &&
                                      samEnabled
                                        ? "SAM"
                                        : mode}
                                    </button>
                                  {/each}
                                </div>
                                <!-- RADE v1 one-touch decoder launch -->
                                <div
                                  class="grid grid-cols-2 gap-2 w-full max-w-md mt-3"
                                >
                                  {#each [["RADEL", "radel"], ["RADEU", "radeu"]] as [label, key]}
                                    <button
                                      class="retro-button text-white font-bold h-10 text-base rounded-md flex items-center justify-center border border-gray-600 shadow-inner transition-all duration-200 ease-in-out {activeDecoder ===
                                      key
                                        ? 'bg-blue-600 pressed scale-95'
                                        : 'bg-gray-700 hover:bg-gray-600'}"
                                      title="Start the RADE v1 {label} decoder"
                                      on:click={() => launchRadeDecoder(label)}
                                    >
                                      {label}
                                    </button>
                                  {/each}
                                </div>
                                <!-- End of Mode Content -->
                              </div>
                            </div>
                          {/if}
                          <!-- End of Modes Popup Menu -->

                          <!-- Begin Bands Popup Menu -->
                          <button
                            id="band-popup-button"
                            class="glass-button h-8 text-white text-sm font-bold py-2 px-1 rounded-lg flex items-center w-full justify-center whitespace-nowrap"
                            on:click={toggleBandPopup}
                          >
                            Band
                          </button>

                          <!-- Bands Popup -->
                          {#if showBandPopup}
                            <div
                              class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
                              on:click={toggleBandPopup}
                            >
                              <div
                                class="p-6 rounded-lg max-w-lg w-full max-h-[80vh] flex flex-col decoder-window popup-panel"
                                on:click|stopPropagation
                              >
                                <div
                                  class="flex justify-between items-center mb-4"
                                >
                                  <h2 class="text-base font-bold text-white">
                                    Bands
                                  </h2>
                                  <button
                                    class="text-gray-400 hover:text-white"
                                    on:click={toggleBandPopup}
                                  >
                                    <svg
                                      class="w-6 h-6"
                                      fill="none"
                                      stroke="currentColor"
                                      viewBox="0 0 24 24"
                                      xmlns="http://www.w3.org/2000/svg"
                                    >
                                      <path
                                        stroke-linecap="round"
                                        stroke-linejoin="round"
                                        stroke-width="2"
                                        d="M6 18L18 6M6 6l12 12"
                                      ></path>
                                    </svg>
                                  </button>
                                </div>
                                <!-- Content Starts -->

                                <div
                                  class="grid grid-cols-5 sm:grid-cols-5 gap-2"
                                >
                                  {#each bandArray as bandData, index}
                                    {#if verifyRegion(bandData.ITU)}
                                      {#if bandData.publishBand == 1}
                                        {#if printBandButton(bandData.startFreq, bandData.endFreq, bandData.publishBand)}
                                          <button
                                            id="band-selector"
                                            class="retro-button text-sm text-white fontrbold h-7 text-base rounded-md flex items-center justify-center border border-gray-600 shadow-inner transition-all duration-200 ease-in-out {currentBand ===
                                            index
                                              ? 'bg-blue-600 pressed scale-95'
                                              : 'bg-gray-700 hover:bg-gray-600'}"
                                            on:click={() =>
                                              handleBandChangePopup(index)}
                                            title={bandData.name}
                                            >{bandData.name}
                                          </button>
                                        {/if}
                                      {/if}
                                    {:else}{/if}
                                  {/each}
                                </div>
                                <div><hr class="border-gray-600 my-2" /></div>
                                <div
                                  class="grid grid-cols-5 sm:grid-cols-5 gap-2"
                                >
                                  {#each bandArray as bandData, index}
                                    {#if verifyRegion(bandData.ITU)}
                                      {#if bandData.publishBand == 2}
                                        {#if printBandButton(bandData.startFreq, bandData.endFreq, bandData.publishBand)}
                                          <button
                                            id="band-selector"
                                            class="retro-button text-sm text-white fontrbold h-7 text-base rounded-md flex items-center justify-center border border-gray-600 shadow-inner transition-all duration-200 ease-in-out {currentBand ===
                                            index
                                              ? 'bg-blue-600 pressed scale-95'
                                              : 'bg-gray-700 hover:bg-gray-600'}"
                                            on:click={() =>
                                              handleBandChangePopup(index)}
                                            title={bandData.name}
                                            >{bandData.name}
                                          </button>
                                        {/if}
                                      {/if}
                                    {:else}{/if}
                                  {/each}
                                </div>
                                <!-- Content Ends -->
                              </div>
                            </div>
                          {/if}
                          <!-- End Bands Popup Menu -->

                          <!-- Begin IF Filters Popup Menu -->
                          <button
                            id="if-filter-popup-button"
                            class="glass-button h-8 text-white text-sm font-bold py-2 px-1 rounded-lg flex items-center w-full justify-center whitespace-nowrap"
                            on:click={toggleIFPopup}
                          >
                            IF
                          </button>

                          <!-- Static IF Popup -->
                          {#if showIFPopup}
                            <div
                              class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
                              on:click={toggleIFPopup}
                            >
                              <div
                                class="p-6 rounded-lg max-w-lg w-full max-h-[80vh] flex flex-col decoder-window popup-panel"
                                on:click|stopPropagation
                              >
                                <div
                                  class="flex justify-between items-center mb-4"
                                >
                                  <h2 class="text-base font-bold text-white">
                                    Static IF Filters
                                  </h2>
                                  <button
                                    class="text-gray-400 hover:text-white"
                                    on:click={toggleIFPopup}
                                  >
                                    <svg
                                      class="w-6 h-6"
                                      fill="none"
                                      stroke="currentColor"
                                      viewBox="0 0 24 24"
                                      xmlns="http://www.w3.org/2000/svg"
                                    >
                                      <path
                                        stroke-linecap="round"
                                        stroke-linejoin="round"
                                        stroke-width="2"
                                        d="M6 18L18 6M6 6l12 12"
                                      ></path>
                                    </svg>
                                  </button>
                                </div>

                                <!-- Content Starts -->

                                <div class="w-full mt-4">
                                  <div
                                    class="grid grid-cols-4 sm:grid-cols-6 gap-2"
                                  >
                                    {#each newBandwidth as newbandwidth}
                                      <button
                                        id="static-bandwidth-selector"
                                        class="retro-button text-sm text-white font-bold h-8 text-lg rounded-md flex items-center justify-center border border-gray-600 shadow-inner transition-all duration-200 ease-in-out {newStaticBandwidth ==
                                          newbandwidth ||
                                        Math.round(bandwidth * 1000) ==
                                          newbandwidth
                                          ? 'bg-blue-600 pressed scale-95'
                                          : 'bg-gray-700 hover:bg-gray-600'}"
                                        on:click={() =>
                                          handleSetStaticBandwidth(
                                            newbandwidth,
                                          )}
                                        title={newbandwidth}
                                      >
                                        {#if newbandwidth == 500}500 Hz
                                        {:else if newbandwidth == 1800}1.8 kHz
                                        {:else if newbandwidth == 2400}2.4 kHz
                                        {:else if newbandwidth == 2700}2.7 kHz
                                        {:else if newbandwidth == 3000}3.0 kHz
                                        {:else if newbandwidth == 3500}3.5 kHz
                                        {:else if newbandwidth == 4000}4.0 kHz
                                        {:else if newbandwidth == 4500}4.5 kHz
                                        {:else if newbandwidth == 5000}5.0 kHz
                                        {:else if newbandwidth == 6000}6.0 kHz
                                        {:else if newbandwidth == 9000}9.0 kHz
                                        {:else if newbandwidth == 10000}10.0 kHz
                                        {:else}{/if}
                                      </button>
                                    {/each}
                                  </div>
                                </div>
                                <!-- IF Filter bandwidth slider -->
                                <div
                                  class="w-full mt-4 border-t border-gray-600 pt-3"
                                >
                                  <div
                                    class="flex items-center justify-between mb-1"
                                  >
                                    <label class="text-gray-400 text-xs"
                                      >Bandwidth (center &#8594; edge)</label
                                    >
                                    <span
                                      class="value-display text-gray-300 text-xs whitespace-nowrap"
                                      >{ifSlider} Hz</span
                                    >
                                  </div>
                                  <div class="flex items-center gap-2">
                                    <div class="slider-container flex-1">
                                      <input
                                        type="range"
                                        class="glass-slider"
                                        bind:value={ifSlider}
                                        on:input={handleIFSlider}
                                        min="0"
                                        max={ifSliderMax}
                                        step="100"
                                        title="Adjust bandwidth from centre toward the active sideband"
                                      />
                                    </div>
                                    <button
                                      class="retro-button text-xs text-white font-bold h-8 px-3 rounded-md flex items-center justify-center border border-gray-600 shadow-inner bg-gray-700 hover:bg-gray-600 transition-all duration-200 ease-in-out whitespace-nowrap"
                                      on:click={resetIFFilter}
                                      title="Reset passband to mode default"
                                      >Reset</button
                                    >
                                  </div>
                                </div>
                                <!-- Content Ends -->
                              </div>
                            </div>
                          {/if}
                          <!-- End IF Filters Popup Menu -->
                          <!-- Begin CAT (TCI) Popup Menu -->
                          <button
                            id="cat-tci-popup-button"
                            class="glass-button h-8 text-white text-sm font-bold py-2 px-1 rounded-lg flex items-center w-full justify-center whitespace-nowrap"
                            on:click={toggleCatPopup}
                            title={catConnected
                              ? `CAT control active — ${catActiveSourceLabel}`
                              : "CAT control via TCI (ExpertSDR, AetherSDR, Thetis)"}
                          >
                            <span
                              class="mr-1 {catConnected
                                ? 'text-green-400'
                                : 'text-gray-500'}">●</span
                            >
                            CAT
                          </button>

                          {#if showCatPopup}
                            <div
                              class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
                              on:click={toggleCatPopup}
                            >
                              <div
                                class="p-6 rounded-lg max-w-lg w-full max-h-[80vh] flex flex-col decoder-window popup-panel"
                                on:click|stopPropagation
                              >
                                <div
                                  class="flex justify-between items-center mb-4"
                                >
                                  <h2 class="text-base font-bold text-white">
                                    CAT control via TCI
                                  </h2>
                                  <button
                                    class="text-gray-400 hover:text-white"
                                    on:click={toggleCatPopup}
                                  >
                                    <svg
                                      class="w-6 h-6"
                                      fill="none"
                                      stroke="currentColor"
                                      viewBox="0 0 24 24"
                                      xmlns="http://www.w3.org/2000/svg"
                                    >
                                      <path
                                        stroke-linecap="round"
                                        stroke-linejoin="round"
                                        stroke-width="2"
                                        d="M6 18L18 6M6 6l12 12"
                                      ></path>
                                    </svg>
                                  </button>
                                </div>
                                <!-- Content Starts -->
                                <div class="flex flex-col gap-4">
                                  <p class="text-xs text-gray-400 text-center">
                                    ExpertSDR, AetherSDR, Thetis — TCI ports
                                    50001 / 40001 are searched automatically.
                                  </p>
                                  <div
                                    class="flex items-center justify-center gap-3 flex-wrap"
                                  >
                                    <span
                                      class="text-sm font-semibold {catConnected
                                        ? 'text-green-400'
                                        : 'text-gray-500'}"
                                      title={catConnected
                                        ? `CAT link active — source: ${catActiveSourceLabel}`
                                        : "No CAT link found (searching TCI on ports 50001/40001)"}
                                    >
                                      ● {catConnected
                                        ? `Active — ${catActiveSourceLabel}`
                                        : "Inactive"}
                                    </span>
                                    {#if !catConnected}
                                      <span
                                        class="text-xs text-gray-400 animate-pulse"
                                        title="Searching for a TCI server..."
                                      >
                                        ⏳ Wait
                                      </span>
                                    {/if}
                                  </div>
                                  <div
                                    class="flex items-center justify-center gap-4 flex-wrap"
                                  >
                                    <div class="flex items-center gap-2">
                                      <span class="text-sm text-gray-300"
                                        >CAT Sync</span
                                      >
                                      <label
                                        class="toggle-switch"
                                        title="Turns frequency tracking (rig <-> PhantomSDR) on or off. Audio is always muted while the rig transmits."
                                      >
                                        <input
                                          type="checkbox"
                                          bind:checked={catSyncEnabled}
                                          on:change={persistCatSyncPreference}
                                        />
                                        <span class="toggle-slider"></span>
                                      </label>
                                    </div>
                                    <div class="flex items-center gap-2">
                                      <span class="text-xs text-gray-400"
                                        >Host:</span
                                      >
                                      <input
                                        type="text"
                                        class="text-xs bg-gray-800 text-gray-200 rounded px-2 py-0.5 w-32"
                                        bind:value={catHost}
                                        on:change={applyCatHostChange}
                                        title="Address of the computer running ExpertSDR/AetherSDR/Thetis (TCI): 'localhost' for this computer, otherwise its LAN IP (e.g. 192.168.1.42)."
                                      />
                                    </div>
                                  </div>
                                </div>
                                <!-- Content Ends -->
                              </div>
                            </div>
                          {/if}
                          <!-- End CAT (TCI) Popup Menu -->
                        </div>
                        <hr class="border-gray-600 my-2" />
                      </div>
                      <!-- End of Popup Buttons Menu -->

                      <!-- Begin Bandwidth Selection Area -->
                      <div class="w-full mt-4"></div>
                      <!-- End of Bandwidth Selection Area -->

                      <!-- Tuning Steps -->
                      <div class="w-full mt-4"></div>

                      <!-- End of Tuning Step Selection Area -->

                      <!-- AGC Selection in Mobile -->
                      <div class="w-full mb-6">
                        <div
                          class="flex w-full items-center justify-between gap-2 mb-2 flex-wrap"
                        >
                          <h3 class="text-white text-base font-semibold">AGC</h3>
                          <!-- Compressor + Equalizer buttons in Mobile -->
                          <div class="flex items-center gap-2">
                            <button
                              class={`retro-button text-white font-bold h-6 px-3 text-xs rounded-md flex items-center justify-center border border-gray-600 shadow-inner transition-all duration-200 ease-in-out ${
                                compressorEnabled
                                  ? "bg-blue-600 pressed scale-95"
                                  : "bg-gray-700 hover:bg-gray-600"
                              }`}
                              on:click={toggleCompPopup}
                            >
                              <span>Compressor</span>
                            </button>
                            <button
                              class={`retro-button text-white font-bold h-6 px-3 text-xs rounded-md flex items-center justify-center border border-gray-600 shadow-inner transition-all duration-200 ease-in-out ${
                                eqEnabled
                                  ? "bg-blue-600 pressed scale-95"
                                  : "bg-gray-700 hover:bg-gray-600"
                              }`}
                              on:click={toggleEqPopup}
                            >
                              <span>Equalizer</span>
                            </button>
                          </div>
                        </div>
                        <div id="moreoptions" class="grid grid-cols-4 gap-2">
                          {#each [{ option: "Auto", AGCbutton: 0 }, { option: "Fast", AGCbutton: 1 }, { option: "Medium", AGCbutton: 2 }, { option: "Slow", AGCbutton: 3 }] as { option, AGCbutton }}
                            <button
                              class={`retro-button text-white font-bold h-8 text-sm rounded-md flex items-center justify-center border border-gray-600 shadow-inner transition-all duration-200 ease-in-out ${
                                AGCbutton == currentAGC
                                  ? "bg-blue-600 pressed scale-95"
                                  : "bg-gray-700 hover:bg-gray-600"
                              }`}
                              on:click={() => handleAGCChange(AGCbutton)}
                            >
                              <span>{option}</span>
                            </button>
                          {/each}
                        </div>

                        <!-- Equalizer Popup (mobile) -->
                        {#if showEqPopup}
                          <div
                            class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
                            on:click={toggleEqPopup}
                          >
                            <div
                              class="p-6 rounded-lg max-w-lg w-full max-h-[80vh] flex flex-col decoder-window popup-panel"
                              on:click|stopPropagation
                            >
                              <div
                                class="flex justify-between items-center mb-4"
                              >
                                <h2 class="text-base font-bold text-white">
                                  Equalizer
                                </h2>
                                <button
                                  class="text-gray-400 hover:text-white"
                                  on:click={toggleEqPopup}
                                >
                                  <svg
                                    class="w-6 h-6"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                    xmlns="http://www.w3.org/2000/svg"
                                  >
                                    <path
                                      stroke-linecap="round"
                                      stroke-linejoin="round"
                                      stroke-width="2"
                                      d="M6 18L18 6M6 6l12 12"
                                    ></path>
                                  </svg>
                                </button>
                              </div>

                              <!-- Enable toggle -->
                              <div
                                class="flex items-center justify-between mb-4"
                              >
                                <span class="text-white text-sm font-semibold"
                                  >Enable Equalizer</span
                                >
                                <button
                                  class={`retro-button text-white font-bold h-8 px-4 text-sm rounded-md flex items-center justify-center border border-gray-600 shadow-inner transition-all duration-200 ease-in-out ${
                                    eqEnabled
                                      ? "bg-blue-600 pressed scale-95"
                                      : "bg-gray-700 hover:bg-gray-600"
                                  }`}
                                  on:click={handleEqEnableToggle}
                                >
                                  <span>{eqEnabled ? "On" : "Off"}</span>
                                </button>
                              </div>

                              <!-- Band sliders -->
                              <div class="flex flex-col gap-3">
                                {#each eqBandLabels as label, i}
                                  <div class="flex items-center gap-3">
                                    <span
                                      class="text-gray-300 text-xs w-14 text-right"
                                      >{label}</span
                                    >
                                    <div class="slider-container flex-1 mx-0">
                                      <input
                                        type="range"
                                        min="-12"
                                        max="12"
                                        step="1"
                                        bind:value={eqGains[i]}
                                        on:input={() => handleEqBandChange(i)}
                                        title="{label} band"
                                        class="glass-slider"
                                      />
                                    </div>
                                    <span
                                      class="text-gray-300 text-xs w-12 text-right"
                                      >{eqGains[i]} dB</span
                                    >
                                  </div>
                                {/each}
                              </div>

                              <!-- Reset -->
                              <div class="mt-4 flex justify-end">
                                <button
                                  class="retro-button text-white font-bold h-8 px-4 text-sm rounded-md flex items-center justify-center border border-gray-600 shadow-inner bg-gray-700 hover:bg-gray-600 transition-all duration-200 ease-in-out"
                                  on:click={handleEqReset}
                                >
                                  <span>Reset</span>
                                </button>
                              </div>
                            </div>
                          </div>
                        {/if}
                        <!-- End Equalizer Popup (mobile) -->

                        <!-- Compressor Popup (mobile) -->
                        {#if showCompPopup}
                          <div
                            class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
                            on:click={toggleCompPopup}
                          >
                            <div
                              class="p-6 rounded-lg max-w-lg w-full max-h-[80vh] flex flex-col overflow-y-auto decoder-window popup-panel"
                              on:click|stopPropagation
                            >
                              <div
                                class="flex justify-between items-center mb-4"
                              >
                                <h2 class="text-base font-bold text-white">
                                  Compressor
                                </h2>
                                <button
                                  class="text-gray-400 hover:text-white"
                                  on:click={toggleCompPopup}
                                >
                                  <svg
                                    class="w-6 h-6"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                    xmlns="http://www.w3.org/2000/svg"
                                  >
                                    <path
                                      stroke-linecap="round"
                                      stroke-linejoin="round"
                                      stroke-width="2"
                                      d="M6 18L18 6M6 6l12 12"
                                    ></path>
                                  </svg>
                                </button>
                              </div>

                              <!-- Enable toggle -->
                              <div
                                class="flex items-center justify-between mb-4"
                              >
                                <span class="text-white text-sm font-semibold"
                                  >Enable Compressor</span
                                >
                                <button
                                  class={`retro-button text-white font-bold h-8 px-4 text-sm rounded-md flex items-center justify-center border border-gray-600 shadow-inner transition-all duration-200 ease-in-out ${
                                    compressorEnabled
                                      ? "bg-blue-600 pressed scale-95"
                                      : "bg-gray-700 hover:bg-gray-600"
                                  }`}
                                  on:click={handleCompressorToggle}
                                >
                                  <span>{compressorEnabled ? "On" : "Off"}</span
                                  >
                                </button>
                              </div>

                              <!-- Regulators -->
                              <div class="flex flex-col gap-3">
                                <div class="flex items-center gap-3">
                                  <span
                                    class="text-gray-300 text-xs w-20 text-right"
                                    >Threshold</span
                                  >
                                  <div class="slider-container flex-1 mx-0">
                                    <input
                                      type="range"
                                      min="-60"
                                      max="0"
                                      step="1"
                                      bind:value={compThreshold}
                                      on:input={handleCompThreshold}
                                      title="Threshold"
                                      class="glass-slider"
                                    />
                                  </div>
                                  <span
                                    class="text-gray-300 text-xs w-16 text-right"
                                    >{compThreshold} dB</span
                                  >
                                </div>

                                <div class="flex items-center gap-3">
                                  <span
                                    class="text-gray-300 text-xs w-20 text-right"
                                    >Ratio</span
                                  >
                                  <div class="slider-container flex-1 mx-0">
                                    <input
                                      type="range"
                                      min="1"
                                      max="20"
                                      step="0.5"
                                      bind:value={compRatio}
                                      on:input={handleCompRatio}
                                      title="Ratio"
                                      class="glass-slider"
                                    />
                                  </div>
                                  <span
                                    class="text-gray-300 text-xs w-16 text-right"
                                    >{compRatio}:1</span
                                  >
                                </div>

                                <div class="flex items-center gap-3">
                                  <span
                                    class="text-gray-300 text-xs w-20 text-right"
                                    >Attack</span
                                  >
                                  <div class="slider-container flex-1 mx-0">
                                    <input
                                      type="range"
                                      min="0"
                                      max="0.1"
                                      step="0.001"
                                      bind:value={compAttack}
                                      on:input={handleCompAttack}
                                      title="Attack"
                                      class="glass-slider"
                                    />
                                  </div>
                                  <span
                                    class="text-gray-300 text-xs w-16 text-right"
                                    >{Math.round(compAttack * 1000)} ms</span
                                  >
                                </div>

                                <div class="flex items-center gap-3">
                                  <span
                                    class="text-gray-300 text-xs w-20 text-right"
                                    >Release</span
                                  >
                                  <div class="slider-container flex-1 mx-0">
                                    <input
                                      type="range"
                                      min="0.01"
                                      max="1"
                                      step="0.01"
                                      bind:value={compRelease}
                                      on:input={handleCompRelease}
                                      title="Release"
                                      class="glass-slider"
                                    />
                                  </div>
                                  <span
                                    class="text-gray-300 text-xs w-16 text-right"
                                    >{Math.round(compRelease * 1000)} ms</span
                                  >
                                </div>

                                <div class="flex items-center gap-3">
                                  <span
                                    class="text-gray-300 text-xs w-20 text-right"
                                    >Knee</span
                                  >
                                  <div class="slider-container flex-1 mx-0">
                                    <input
                                      type="range"
                                      min="0"
                                      max="40"
                                      step="1"
                                      bind:value={compKnee}
                                      on:input={handleCompKnee}
                                      title="Knee"
                                      class="glass-slider"
                                    />
                                  </div>
                                  <span
                                    class="text-gray-300 text-xs w-16 text-right"
                                    >{compKnee} dB</span
                                  >
                                </div>

                                <div class="flex items-center gap-3">
                                  <span
                                    class="text-gray-300 text-xs w-20 text-right"
                                    >Makeup</span
                                  >
                                  <div class="slider-container flex-1 mx-0">
                                    <input
                                      type="range"
                                      min="0"
                                      max="4"
                                      step="0.1"
                                      bind:value={compMakeup}
                                      on:input={handleCompMakeup}
                                      disabled={compAuto}
                                      title="Makeup gain"
                                      class="glass-slider"
                                    />
                                  </div>
                                  <span
                                    class="text-gray-300 text-xs w-16 text-right"
                                    >{compMakeup}×</span
                                  >
                                </div>
                                <div class="flex items-center gap-3">
                                  <span
                                    class="text-gray-300 text-xs w-20 text-right"
                                    >Auto</span
                                  >
                                  <label
                                    class="flex items-center gap-2 flex-1 cursor-pointer"
                                  >
                                    <input
                                      type="checkbox"
                                      bind:checked={compAuto}
                                      on:change={handleCompAutoToggle}
                                    />
                                    <span class="text-gray-300 text-xs"
                                      >Auto makeup (tracks threshold &amp;
                                      ratio)</span
                                    >
                                  </label>
                                  <span
                                    class="text-gray-300 text-xs w-16 text-right"
                                  ></span>
                                </div>
                              </div>

                              <!-- Reset -->
                              <div class="mt-4 flex justify-end">
                                <button
                                  class="retro-button text-white font-bold h-8 px-4 text-sm rounded-md flex items-center justify-center border border-gray-600 shadow-inner bg-gray-700 hover:bg-gray-600 transition-all duration-200 ease-in-out"
                                  on:click={handleCompReset}
                                >
                                  <span>Reset</span>
                                </button>
                              </div>
                            </div>
                          </div>
                        {/if}
                        <!-- End Compressor Popup (mobile) -->

                        <hr class="border-gray-600 my-2" />
                      </div>
                      <!-- End AGC Section in Mobile -->

                      <!-- Begin Filter Selection when mobile-->
                      <div class="w-full mb-6">
                        <div class="flex w-full items-center justify-between mb-2">
                          <h3 class="text-white text-base font-semibold">
                            Filters
                          </h3>
                          <div class="flex items-center gap-2">
                            <!-- Backend Noise Gate Toggle Button -->
                            <button
                              class="{isAnalog
                                ? 'text-xs'
                                : 'text-sm'} px-3 py-1 rounded-md font-semibold transition-all duration-200 {backendNoiseGateEnabled
                                ? 'bg-blue-600 text-white shadow-lg'
                                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}"
                              on:click={toggleBackendNoiseGate}
                              title="Enable/disable backend noise gate"
                            >
                              Gate: {backendNoiseGateEnabled ? "ON" : "OFF"}
                            </button>

                            <!-- Preset Dropdown (only active when gate is ON) -->
                            <label
                              for="noise-gate-preset"
                              class="text-white text-sm">Preset:</label
                            >
                            <select
                              id="noise-gate-preset"
                              bind:value={noiseGatePreset}
                              on:change={handleNoiseGatePresetChange}
                              disabled={!backendNoiseGateEnabled}
                              class="glass-select text-white text-xs px-2 py-1 rounded-md cursor-pointer focus:outline-none {!backendNoiseGateEnabled
                                ? 'opacity-50 cursor-not-allowed'
                                : ''}"
                            >
                              <option value="balanced">Balanced</option>
                              <option value="aggressive">Aggressive</option>
                              <option value="weak-signal">Weak Signal</option>
                              <option value="smooth">Smooth</option>
                              <option value="maximum">Maximum</option>
                              <option value="cw">CW/Digital</option>
                              <option value="am-fm">AM/FM</option>
                            </select>
                          </div>
                        </div>
                        <div
                          id="moreoptions"
                          class="grid grid-cols-5 gap-2 text-sm h-8 mb-3"
                        >
                          {#each [{ option: "NR", icon: "wave-square", enabled: NREnabled }, { option: "NB", icon: "zap", enabled: NBEnabled }, { option: "NS", icon: "waves", enabled: NSEnabled }, { option: "AN", icon: "shield", enabled: ANEnabled }, { option: "CTCSS", icon: "filter", enabled: CTCSSSupressEnabled }] as { option, icon, enabled }}
                            <button
                              class="retro-button text-white font-bold h-8 text-xs rounded-md flex items-center justify-center border border-gray-600 shadow-inner transition-all duration-200 ease-in-out {enabled
                                ? 'bg-blue-600 pressed scale-95'
                                : 'bg-gray-700 hover:bg-gray-600'}"
                              on:click={() => {
                                if (option === "NR") handleNRChange();
                                else if (option === "NB") handleNBChange();
                                else if (option === "NS") handleNSChange();
                                else if (option === "AN") handleANChange();
                                else handleCTCSSChange();
                              }}
                            >
                              <span>{option}</span>
                            </button>
                          {/each}
                        </div>
                        <!-- End Filter Selection when mobile-->
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Third Column -->

                <!-- WF Begins -->
                <div
                  class="flex flex-col items-center bg-gray-800 p-6 lg:border lg:border-gray-700 rounded-none rounded-b-lg lg:rounded-none lg:rounded-r-lg"
                >
                  <div class="mb-4 flex items-center gap-3">
                    <h3 class="text-white text-base font-semibold">
                      Waterfall Controls
                    </h3>
                    <button
                      class="glass-button flex items-center gap-2 px-3 py-1 text-sm"
                      on:click={toggleWaterfallDirection}
                      title="Toggle waterfall direction (W)"
                    >
                      <span
                        class={`inline-block text-[1.45rem] leading-none transition-transform duration-300 ${waterfallReverse ? "text-green-400" : "text-cyan-400"}`}
                        style:transform={waterfallReverse
                          ? "rotate(180deg)"
                          : "rotate(0deg)"}>⬆</span
                      >
                      <span
                        class={waterfallReverse
                          ? "text-green-400"
                          : "text-cyan-400"}
                      >
                        {waterfallReverse ? "Reverse" : "Default"}
                      </span>
                    </button>
                  </div>

                  <div class="w-full mb-6 space-y-5">
                    <div
                      id="brightness-controls"
                      class="flex items-center justify-between mb-2"
                    >
                      <span class="text-gray-300 text-xs w-10">Min:</span>
                      <div class="slider-container w-10 mx-2">
                        <input
                          type="range"
                          bind:value={min_waterfall}
                          min="-100"
                          max="255"
                          step="1"
                          class="glass-slider w-full"
                          on:input={handleMinMove}
                        />
                      </div>
                      <span class="text-gray-300 text-xs w-10 text-right"
                        >{min_waterfall}</span
                      >
                    </div>
                    <div class="flex items-center justify-between">
                      <span class="text-gray-300 text-xs w-10">Max:</span>
                      <div class="slider-container w-10 mx-2">
                        <input
                          type="range"
                          bind:value={max_waterfall}
                          min="0"
                          max="255"
                          step="1"
                          class="glass-slider w-full"
                          on:input={handleMaxMove}
                        />
                      </div>
                      <span class="text-gray-300 text-xs w-10 text-right"
                        >{max_waterfall}</span
                      >
                    </div>

                    <!-- Audio Buffer Slider transfered by sv2amk -->
                    <div class="control-group mt-4" id="audio-buffer-slider">
                      <button
                        class="glass-button text-white font-bold rounded-full w-10 h-10 flex items-center justify-center mr-4"
                        style="background: {audioBufferDelayEnabled
                          ? 'rgba(16, 185, 129, 0.2)'
                          : 'rgba(255, 255, 255, 0.05)'}"
                        on:click={() =>
                          handleAudioBufferDelayMove((audioBufferDelay += 1))}
                      >
                        <span class="text-white text-xs font-normal"
                          >Buffer</span
                        >
                      </button>
                      <div class="slider-container w-10 mx-2">
                        <input
                          type="range"
                          bind:value={audioBufferDelay}
                          on:input={() => handleAudioBufferDelayMove(audioBufferDelay)}
                          class="glass-slider"
                          min="1"
                          max="6"
                          step="1"
                        />
                      </div>
                      <span class="text-gray-300 text-xs w-10 text-right"
                        >×{audioBufferDelay}</span
                      >
                      <hr class="border-gray-600 my-2" />
                    </div>
                  </div>
                  <!-- End of Buffer -->

                  <div class="w-full mb-6">
                    <div id="colormap-select" class="relative">
                      <select
                        bind:value={currentColormap}
                        on:change={handleWaterfallColormapSelect}
                        class="glass-select block w-full pl-3 pr-10 py-2 text-sm rounded-lg text-gray-200 appearance-none focus:outline-none"
                      >
                        {#each availableColormaps as colormap}
                          <option value={colormap}>{colormap}</option>
                        {/each}
                      </select>
                      <div
                        class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-400"
                      >
                        <svg
                          class="fill-current h-4 w-4"
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 20 20"
                        >
                          <path
                            d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                          />
                        </svg>
                      </div>
                    </div>
                  </div>

                  <div class="w-full mb-6">
                    <div class="flex items-center justify-center gap-2 mb-2">
                      <h3 class="text-white text-base font-semibold">Zoom</h3>
                      <button
                        class="retro-button text-white font-bold h-6 px-2 text-xs rounded-md flex items-center justify-center border border-gray-600 shadow-inner bg-gray-700 hover:bg-gray-600"
                        on:click={handleZoomToBand}
                        title="Zoom waterfall to the band of the tuned frequency"
                        >To Band</button
                      >
                    </div>
                    <div id="zoom-controls" class="grid grid-cols-4 gap-2">
                      {#each [{ action: "+", title: "Zoom in", icon: "zoom-in", text: "In" }, { action: "-", title: "Zoom out", icon: "zoom-out", text: "Out" }, { action: "max", title: "Zoom to max", icon: "maximize", text: "Max" }, { action: "min", title: "Zoom to min", icon: "minimize", text: "Min" }] as { action, title, icon, text }}
                        <button
                          class="retro-button text-white font-bold h-8 text-xs rounded-md flex items-center justify-center border border-gray-600 shadow-inner transition-all duration-200 ease-in-out bg-gray-700 hover:bg-gray-600"
                          on:click={(e) => handleWaterfallMagnify(e, action)}
                          {title}
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            class="h-4 w-4 mr-2"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                          >
                            {#if icon === "zoom-in"}
                              <circle cx="11" cy="11" r="8" />
                              <line x1="21" y1="21" x2="16.65" y2="16.65" />
                              <line x1="11" y1="8" x2="11" y2="14" />
                              <line x1="8" y1="11" x2="14" y2="11" />
                            {:else if icon === "zoom-out"}
                              <circle cx="11" cy="11" r="8" />
                              <line x1="21" y1="21" x2="16.65" y2="16.65" />
                              <line x1="8" y1="11" x2="14" y2="11" />
                            {:else if icon === "maximize"}
                              <path
                                d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"
                              />
                            {:else if icon === "minimize"}
                              <path
                                d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"
                              />
                            {/if}
                          </svg>
                          <span>{text}</span>
                        </button>
                      {/each}
                    </div>
                    <hr class="border-gray-600 my-2" />
                  </div>

                  <!-- START of waterfal control buttons -->
                  <div class="w-full mb-6">
                    <div class="grid grid-cols-4 gap-2">
                      <button
                        id="waterfall-toggle"
                        class="retro-button text-white font-normal h-8 text-xs rounded-md flex items-center justify-center border border-gray-600 shadow-inner transition-all duration-200 ease-in-out {waterfallDisplay ===
                        true
                          ? 'bg-blue-600 pressed scale-95'
                          : 'bg-gray-700 hover:bg-gray-600'}"
                        on:click={handleWaterfallChange}
                        title="Waterfall Toggle"
                      >
                        Waterf.
                      </button>

                      <button
                        id="spectrum-toggle"
                        class="retro-button text-white font-normal h-8 text-xs rounded-md flex items-center justify-center border border-gray-600 shadow-inner transition-all duration-200 ease-in-out {spectrumDisplay ===
                        true
                          ? 'bg-blue-600 pressed scale-95'
                          : 'bg-gray-700 hover:bg-gray-600'}"
                        on:click={handleSpectrumChange}
                        title="Spectrum Toggle"
                      >
                        Spectr.
                      </button>
                      <button
                        id="auto-adjust"
                        class="retro-button text-white font-normal h-8 text-xs rounded-md flex items-center justify-center border border-gray-600 shadow-inner transition-all duration-200 ease-in-out {autoAdjustEnabled ===
                        true
                          ? 'bg-blue-600 pressed scale-95'
                          : 'bg-gray-700 hover:bg-gray-600'}"
                        on:click={() => handleAutoAdjust()}
                        title="Auto Adjust"
                      >
                        Auto Adj.
                      </button>
                      <button
                        id="bigger-waterfall"
                        class="retro-button text-white font-normal h-8 text-xs rounded-md flex items-center justify-center border border-gray-600 shadow-inner transition-all duration-200 ease-in-out {biggerWaterfall ===
                        true
                          ? 'bg-blue-600 pressed scale-95'
                          : 'bg-gray-700 hover:bg-gray-600'}"
                        on:click={handleWaterfallSizeChange}
                        title="Height (+)"
                      >
                        Height (+)
                      </button>
                    </div>
                  </div>
                  <!-- END of Waterfall Control Buttons -->

                  <!-- Mobile Decoder Section (exact desktop copy) -->
                  <!-- Decoder Options Section -->
                  <div>
                    <h3 class="text-white text-base font-semibold mb-2">
                      Decoder Options
                    </h3>
                    <div class="flex items-center gap-2">
                      <!-- Off/On toggle — mirrors Gate button style -->
                      <button
                        class="text-sm px-3 py-1 rounded-md font-semibold transition-all duration-200 {decoderOn
                          ? 'bg-blue-600 text-white shadow-lg'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}"
                        on:click={toggleDecoder}
                        title="Enable/disable decoder"
                      >
                        Decoder: <br />{decoderOn ? "ON" : "OFF"}
                      </button>

                      <!-- Decoder selector dropdown -->
                      <select
                        bind:value={selectedDecoder}
                        on:change={handleDecoderChange}
                        disabled={!decoderOn}
                        class="glass-select text-white text-sm px-2 py-1 rounded-md cursor-pointer focus:outline-none {!decoderOn
                          ? 'opacity-50 cursor-not-allowed'
                          : ''}"
                      >
                        <option value="none">— Select decoder —</option>
                        <option value="ft8">FT8</option>
                        <option value="ft4">FT4</option>
                        <option value="ft2">FT2</option>
                        <option value="js8">JS8</option>
                        <option value="cw">CW</option>
                        <option value="wspr">WSPR</option>
                        <option value="hffax">HF FAX / WEFAX</option>
                        <option value="sstv">SSTV</option>
                        <option value="navtex">NAVTEX</option>
                        <option value="fsk">FSK / RTTY</option>
                        <option value="radel">RADE v1 — RADEL (LSB)</option>
                        <option value="radeu">RADE v1 — RADEU (USB)</option>
                      </select>
                    </div>
                  </div>

                  <!-- Receive diversity (second receiver) -->
                  <DiversityPanel />

                  <!-- FT8 / FT4 Messages List -->
                  {#if decoderOn && (ft8Enabled || ft4Enabled || ft2Enabled)}
                    <div class="w-full rounded-lg p-6 mt-6 decoder-window decoder-panel">
                      <div
                        class="w-full flex justify-between items-center mb-5 text-xs"
                      >
                        <h4 class="text-white font-semibold">
                          {ft2Enabled ? "FT2" : ft4Enabled ? "FT4" : "FT8"} Messages
                        </h4>
                        <span
                          class="text-gray-300 pl-4 lg:pl-0"
                          id="farthest-distance">Farthest: 0 km</span
                        >
                      </div>
                      <FtxSpectrum {audio} />
                      <div
                        class="flex items-center gap-2 text-xs text-gray-300 mb-1"
                      >
                        <label
                          class="whitespace-nowrap"
                          title="Capture lead-in after the UTC slot boundary, to offset audio pipeline latency (KiwiSDR time_shift)"
                          >Sync offset</label
                        >
                        <input
                          type="range"
                          min="0"
                          max={ftxShiftMax}
                          step="0.05"
                          bind:value={ftxTimeShift}
                          on:input={handleFtxTimeShift}
                          class="flex-grow accent-cyan-400"
                        />
                        <span class="font-mono w-12 text-right"
                          >{ftxTimeShift.toFixed(2)}s</span
                        >
                        <label
                          class="flex items-center gap-1 whitespace-nowrap"
                          title="Track the capture timing automatically from the decoders' own DT measurement"
                        >
                          <input
                            type="checkbox"
                            bind:checked={ftxAutoSync}
                            on:change={handleFtxAutoSync}
                            class="accent-cyan-400"
                          />
                          Auto
                        </label>
                      </div>
                      <div
                        class="w-full text-gray-300 overflow-auto max-h-40 custom-scrollbar pr-2"
                      >
                        <div class="ftx-grid ftx-head">
                          <div>Mode</div>
                          <div class="ftx-num">dB</div>
                          <div class="ftx-num">Hz</div>
                          <div class="ftx-num">DT</div>
                          <div>Message</div>
                          <div>Locator</div>
                          <div class="ftx-num">Dist</div>
                        </div>
                        <div id="ft8MessagesList">
                          <!-- Dynamic content populated here -->
                        </div>
                        <div><hr class="border-gray-600 my-2" /></div>
                      </div>
                    </div>
                  {/if}

                  <!-- JS8 Decoder Window -->
                  {#if decoderOn && js8Enabled}
                    <div
                      class="w-full rounded-lg p-4 mt-6 text-left decoder-window decoder-panel"
                    >
                      <div
                        class="w-full flex justify-between items-center mb-3 text-xs"
                      >
                        <h4
                          class="text-white font-semibold flex items-center gap-2"
                        >
                          <span
                            class="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse"
                          ></span>
                          JS8 Decoder
                        </h4>
                        <div class="flex items-center gap-2">
                          <label
                            class="text-gray-400"
                            title="JS8 speed. All stations in a QSO must use the same one; Normal is the common calling speed."
                            >Speed</label
                          >
                          <select
                            bind:value={js8Submode}
                            on:change={handleJs8Submode}
                            class="glass-select text-white text-xs px-2 py-0.5 rounded-md cursor-pointer focus:outline-none"
                          >
                            {#each JS8_SUBMODE_NAMES as name, i}
                              <option value={i}
                                >{name} ({JS8_SUBMODE_PERIOD_S[i]}s)</option
                              >
                            {/each}
                          </select>
                          <button
                            class="bg-green-900 hover:bg-green-800 text-green-100 hover:text-white text-xs px-2 py-0.5 rounded border border-green-700 hover:border-green-500 transition-colors"
                            on:click={() => {
                              js8Messages = [];
                            }}>Clear</button
                          >
                        </div>
                      </div>

                      <!-- Slot progress -->
                      <div
                        class="w-full mb-2 h-2 rounded-full bg-gray-600 overflow-hidden"
                        title="JS8 slot progress"
                      >
                        <div
                          class="h-full rounded-full bg-emerald-400 transition-all duration-500"
                          style="width:{(
                            (js8SlotPos /
                              (JS8_SUBMODE_PERIOD_S[js8Submode] || 15)) *
                            100
                          ).toFixed(1)}%"
                        ></div>
                      </div>

                      <FtxSpectrum {audio} />

                      <div
                        class="flex items-center gap-2 text-xs text-gray-300 mb-2"
                      >
                        <label
                          class="whitespace-nowrap"
                          title="Capture lead-in after the UTC slot boundary, to offset audio pipeline latency"
                          >Sync offset</label
                        >
                        <input
                          type="range"
                          min="0"
                          max={ftxShiftMax}
                          step="0.05"
                          bind:value={ftxTimeShift}
                          on:input={handleFtxTimeShift}
                          class="flex-grow accent-emerald-400"
                        />
                        <span class="font-mono w-12 text-right"
                          >{ftxTimeShift.toFixed(2)}s</span
                        >
                        <label
                          class="flex items-center gap-1 whitespace-nowrap"
                          title="Track the capture timing automatically from the decoder's own DT measurement"
                        >
                          <input
                            type="checkbox"
                            bind:checked={ftxAutoSync}
                            on:change={handleFtxAutoSync}
                            class="accent-emerald-400"
                          />
                          Auto
                        </label>
                      </div>

                      <!-- Still arriving. A JS8 message can span several slots,
                           so showing the partial text is what makes the mode
                           feel live rather than stalled. -->
                      {#if js8Pending.length > 0}
                        <div class="js8-pending">
                          {#each js8Pending as p (p.id)}
                            <div class="js8-row js8-row-pending">
                              <span class="js8-mode">JS8</span>
                              <span class="js8-hz">{Math.round(p.freq)}</span>
                              <!-- No SNR until the message completes, but the
                                   cell must exist: without it the text lands in
                                   the dB track and overflows across it. -->
                              <span class="js8-snr"></span>
                              <span class="js8-text"
                                >{#if p.from}<span class="js8-call"
                                    >{p.from}</span
                                  >{": "}{/if}{p.text}<span class="js8-caret"
                                  >▌</span
                                ></span
                              >
                            </div>
                          {/each}
                        </div>
                      {/if}

                      <div
                        class="w-full text-gray-300 overflow-auto max-h-48 custom-scrollbar pr-1"
                      >
                        <div class="js8-row js8-head">
                          <span class="js8-mode">Mode</span>
                          <span class="js8-hz">Hz</span>
                          <span class="js8-snr">dB</span>
                          <span class="js8-text">Message</span>
                        </div>
                        {#each js8Messages as m (m.id)}
                          <div
                            class="js8-row"
                            class:js8-incomplete={!m.complete}
                            title={m.complete
                              ? `${m.frames} frame${m.frames === 1 ? "" : "s"}`
                              : "Timed out before the last frame arrived"}
                          >
                            <span class="js8-mode">JS8</span>
                            <span class="js8-hz">{Math.round(m.freq)}</span>
                            <span class="js8-snr"
                              >{m.snr === null ? "" : m.snr.toFixed(2)}</span
                            >
                            <span class="js8-text"
                              >{#each formatJs8Parts(m) as part}<span
                                  class:js8-call={part.call}>{part.text}</span
                                >{/each}</span
                            >
                          </div>
                        {/each}
                        {#if js8Messages.length === 0}
                          <div
                            class="text-gray-500 italic text-xs font-mono mt-2"
                          >
                            Listening on the {JS8_SUBMODE_NAMES[
                              js8Submode
                            ]} cycle…
                          </div>
                        {/if}
                      </div>
                    </div>
                  {/if}

                  <!-- CW Decoder Window -->
                  {#if decoderOn && cwEnabled}
                    <div
                      class="w-full rounded-lg p-4 mt-6 text-left decoder-window decoder-panel"
                    >
                      <div
                        class="w-full flex justify-between items-center mb-3 text-xs"
                      >
                        <h4
                          class="text-white font-semibold flex items-center gap-2"
                        >
                          <span
                            class="inline-block w-2 h-2 rounded-full bg-amber-400 animate-pulse"
                          ></span>
                          CW Decoder
                          {#if cwDetectedHz > 0}
                            <span class="text-amber-400 font-mono font-normal"
                              >≈ {cwDetectedHz} Hz</span
                            >
                            {#if cwDetectedWpm > 0}
                              <span
                                class="text-gray-400 font-mono font-normal text-xs"
                                >· {cwDetectedWpm} WPM</span
                              >
                            {/if}
                          {:else}
                            <span class="text-gray-500 font-normal italic"
                              >scanning…</span
                            >
                          {/if}
                        </h4>
                        <button
                          class="text-green-100 bg-green-900 hover:bg-green-800 hover:text-white text-xs px-2 py-0.5 rounded border border-green-700 hover:border-green-500 transition-colors"
                          on:click={() => {
                            cwMessages = [];
                            cwCurrentLine = "";
                          }}>Clear</button
                        >
                      </div>
                      <div
                        bind:this={cwScrollEl}
                        class="w-full font-mono text-sm text-amber-300 bg-gray-900 rounded p-3 overflow-y-auto max-h-64 custom-scrollbar text-left recess-window"
                        style="letter-spacing:0.05em; word-break:break-all;"
                      >
                        {#each cwMessages as line}
                          <div class="break-words whitespace-pre-wrap">
                            {line}
                          </div>
                        {/each}
                        {#if cwCurrentLine}
                          <div class="text-amber-200">
                            {cwCurrentLine}<span class="animate-pulse">▋</span>
                          </div>
                        {:else if cwMessages.length === 0}
                          <div class="text-gray-500 italic">
                            Listening for CW signal…
                          </div>
                        {/if}
                      </div>
                    </div>
                  {/if}

                  <!-- WSPR Decoder Window -->
                  {#if decoderOn && wsprEnabled}
                    <div
                      class="w-full rounded-lg p-4 mt-6 text-left decoder-window decoder-panel"
                    >
                      <div
                        class="w-full flex justify-between items-center mb-3 text-xs"
                      >
                        <h4
                          class="text-white font-semibold flex items-center gap-2"
                        >
                          <span
                            class="inline-block w-2 h-2 rounded-full bg-cyan-400 animate-pulse"
                          ></span>
                          WSPR-2 Decoder
                        </h4>
                        <!-- WSPR slot progress bar -->
                        <div
                          class="w-full mt-1 mb-2 h-2 rounded-full bg-gray-600 overflow-hidden"
                          title="WSPR slot progress"
                        >
                          {#if wsprPhase === "collecting"}
                            <div
                              class="h-full rounded-full bg-cyan-400 transition-all duration-500"
                              style="width:{((wsprSlotPos / 119) * 100).toFixed(
                                1,
                              )}%"
                            ></div>
                          {:else if wsprPhase === "decoding"}
                            <div
                              class="h-full rounded-full bg-amber-400 animate-pulse"
                              style="width:100%"
                            ></div>
                          {:else}
                            <div
                              class="h-full rounded-full bg-gray-500"
                              style="width:0%"
                            ></div>
                          {/if}
                        </div>
                        <button
                          class="text-green-100 bg-green-900 hover:bg-green-800 hover:text-white text-xs px-2 py-0.5 rounded border border-green-700 hover:border-green-500 transition-colors"
                          on:click={() => {
                            wsprMessages = [];
                            const el =
                              document.getElementById("wsprMessagesList");
                            if (el) el.innerHTML = "";
                          }}>Clear</button
                        >
                      </div>
                      <FtxSpectrum {audio} source="wspr" />
                      <!-- Header row -->
                      <div
                        class="w-full font-mono text-xs text-gray-400 flex justify-between px-1 mb-1 border-b border-gray-600 pb-1"
                      >
                        <span class="w-18">UTC Callsign</span>
                        <span class="w-6 text-left">Grid</span>
                        <span class="w-10 text-left">Power</span>
                        <span class="w-20 text-left">Freq</span>
                        <span class="w-14 text-center">SNR</span>
                      </div>
                      <div
                        class="w-full text-gray-300 overflow-auto max-h-48 custom-scrollbar pr-1"
                      >
                        <div
                          id="wsprMessagesList"
                          class="flex flex-col gap-0.5"
                        >
                          <!-- Rows injected by audio.js stopWSPRCollection() -->
                        </div>
                        {#if wsprMessages.length === 0}
                          <div
                            class="text-gray-500 italic text-xs font-mono mt-2"
                          >
                            Waiting for next even UTC minute slot…
                          </div>
                        {/if}
                      </div>
                    </div>
                  {/if}

                  <!-- HF FAX / WEFAX Decoder Panel -->
                  {#if decoderOn && faxEnabled}
                    <div
                      class="w-full rounded-lg p-4 mt-6 text-left decoder-window decoder-panel"
                    >
                      <!-- Header -->
                      <div
                        class="flex flex-wrap items-center justify-between gap-2 mb-3"
                      >
                        <h4
                          class="text-white font-semibold flex items-center gap-2 text-sm"
                        >
                          <span
                            class="inline-block w-2 h-2 rounded-full bg-green-400 animate-pulse"
                          ></span>
                          HF FAX / WEFAX Receiver
                          {#if faxPhasing}
                            <span class="text-xs text-cyan-400 font-mono"
                              >[PHASING]</span
                            >
                          {/if}
                          {#if faxStopTone}
                            <span class="text-xs text-red-400 font-mono"
                              >[STOP]</span
                            >
                          {/if}
                        </h4>
                        <span class="text-xs text-gray-400 font-mono"
                          >Lines: {faxLineCount}</span
                        >
                      </div>

                      <!-- Station preset bar -->
                      <div class="flex flex-wrap gap-2 items-end mb-3">
                        <div class="flex flex-col gap-1 flex-1 min-w-[180px]">
                          <label class="text-gray-400 text-xs">Station</label>
                          <select
                            bind:value={faxSelectedStation}
                            on:change={() => {
                              faxStationObj =
                                FAX_STATIONS.find(
                                  (s) => s.name === faxSelectedStation,
                                ) || null;
                              faxSelectedFreqIdx = 0;
                              _faxTickCountdown();
                            }}
                            class="glass-select text-white text-xs px-2 py-1 rounded-md cursor-pointer focus:outline-none bg-gray-800 border border-gray-600"
                          >
                            <option value="">— Select station —</option>
                            {#each FAX_STATIONS as st}
                              <option value={st.name}>{st.name}</option>
                            {/each}
                          </select>
                        </div>

                        {#if faxStationObj && faxStationObj.freqs.length > 1}
                          <div class="flex flex-col gap-1">
                            <label class="text-gray-400 text-xs"
                              >Frequency</label
                            >
                            <select
                              bind:value={faxSelectedFreqIdx}
                              class="glass-select text-white text-xs px-2 py-1 rounded-md cursor-pointer focus:outline-none bg-gray-800 border border-gray-600"
                            >
                              {#each faxStationObj.freqs as f, i}
                                <option value={i}>{f} kHz</option>
                              {/each}
                            </select>
                          </div>
                        {/if}

                        <button
                          class="text-white text-xs font-bold px-3 py-1.5 rounded-md h-7 flex items-center gap-1 bg-green-700 hover:bg-green-600 transition-colors whitespace-nowrap"
                          on:click={faxApplyStation}
                          title="Tune to this station">▶ Tune</button
                        >
                      </div>

                      <!-- FAX broadcast schedule countdown -->
                      {#if faxScheduleRows.length > 0}
                        <div
                          class="mb-3 rounded-md bg-gray-900 overflow-hidden text-xs recess-window"
                        >
                          <div
                            class="flex items-center gap-1.5 px-2.5 py-1.5 border-b border-gray-700 bg-gray-800"
                          >
                            <svg
                              class="w-3 h-3 text-green-400 shrink-0"
                              fill="none"
                              stroke="currentColor"
                              stroke-width="2"
                              viewBox="0 0 24 24"
                              ><circle cx="12" cy="12" r="10" /><polyline
                                points="12 6 12 12 16 14"
                              /></svg
                            >
                            <span
                              class="text-green-400 font-semibold tracking-wide uppercase"
                              >Next Transmissions · UTC</span
                            >
                          </div>
                          <div class="divide-y divide-gray-800">
                            {#each faxScheduleRows as row, i}
                              <div
                                class="flex items-center gap-2 px-2.5 py-1.5 {row.onAir
                                  ? 'bg-green-900/30'
                                  : i === 0
                                    ? 'bg-gray-800/70'
                                    : 'hover:bg-gray-800/40'} transition-colors"
                              >
                                <span
                                  class="font-mono text-gray-300 shrink-0 w-10"
                                  >{row.utc}</span
                                >
                                <span class="text-gray-400 flex-1 truncate"
                                  >{row.label}</span
                                >
                                <span
                                  class="font-mono tabular-nums shrink-0
                                  {row.onAir
                                    ? 'text-green-300 font-bold'
                                    : row.imminent
                                      ? 'text-red-400 font-bold'
                                      : row.urgent
                                        ? 'text-amber-400 font-semibold'
                                        : i === 0
                                          ? 'text-green-300'
                                          : 'text-gray-500'}"
                                  >{row.countdown}</span
                                >
                                {#if row.onAir}
                                  <span
                                    class="text-green-400 animate-pulse shrink-0"
                                    title="Transmitting now">●</span
                                  >
                                {:else if row.imminent}
                                  <span
                                    class="text-red-400 animate-pulse shrink-0"
                                    >●</span
                                  >
                                {:else if row.urgent}
                                  <span
                                    class="text-amber-400 animate-pulse shrink-0"
                                    title="Transmission starts soon">⚡</span
                                  >
                                {/if}
                              </div>
                            {/each}
                          </div>
                        </div>
                      {/if}

                      <!-- Parameter bar -->
                      <div class="flex flex-wrap gap-3 items-end mb-3">
                        <div class="flex flex-col gap-1">
                          <label class="text-gray-400 text-xs">LPM</label>
                          <select
                            bind:value={faxLPM}
                            on:change={_faxUpdateParams}
                            class="glass-select text-white text-xs px-2 py-1 rounded-md cursor-pointer bg-gray-800 border border-gray-600"
                          >
                            <option value={60}>60</option>
                            <option value={90}>90</option>
                            <option value={100}>100</option>
                            <option value={120}>120 ★</option>
                            <option value={240}>240</option>
                          </select>
                        </div>

                        <div class="flex flex-col gap-1">
                          <label class="text-gray-400 text-xs">IOC</label>
                          <select
                            bind:value={faxIOC}
                            on:change={_faxUpdateParams}
                            class="glass-select text-white text-xs px-2 py-1 rounded-md cursor-pointer bg-gray-800 border border-gray-600"
                          >
                            <option value={288}>288</option>
                            <option value={576}>576 ★</option>
                          </select>
                        </div>

                        <div class="flex flex-col gap-1">
                          <label class="text-gray-400 text-xs">Shift</label>
                          <select
                            bind:value={faxShift}
                            on:change={_faxUpdateParams}
                            class="glass-select text-white text-xs px-2 py-1 rounded-md cursor-pointer bg-gray-800 border border-gray-600"
                          >
                            <option value={400}>400 Hz</option>
                            <option value={800}>800 Hz ★</option>
                          </select>
                        </div>

                        <button
                          class="text-xs px-2 py-1 rounded border transition-colors h-7
                                 {faxAutoAlign
                            ? 'bg-cyan-700 border-cyan-500 text-cyan-200'
                            : 'bg-gray-700 border-gray-600 text-gray-400 hover:border-gray-400'}"
                          on:click={faxToggleAutoAlign}
                          title="Automatic sync-pulse line alignment"
                          >⇔ Auto-align</button
                        >

                        <button
                          class="text-xs px-2 py-1 rounded border transition-colors h-7
                                 {faxInvert
                            ? 'bg-green-700 border-green-400 text-green-100'
                            : 'bg-green-900 border-green-700 text-green-100 hover:bg-green-800 hover:border-green-500'}"
                          on:click={faxToggleInvert}
                          title="Swap black and white (use for LSB receive or inverted polarity)"
                          >⇅ Invert</button
                        >
                      </div>

                      <!-- Signal status bar -->
                      <div
                        class="flex items-center gap-3 mb-3 text-xs font-mono"
                      >
                        <span class="text-gray-400"
                          >Black: <span class="text-gray-200"
                            >{faxInvert ? 1500 + faxShift : 1500} Hz</span
                          ></span
                        >
                        <span class="text-gray-400"
                          >White: <span class="text-gray-200"
                            >{faxInvert ? 1500 : 1500 + faxShift} Hz</span
                          ></span
                        >
                        <span class="text-gray-400"
                          >{Math.round(Math.PI * faxIOC)} px/line</span
                        >
                        <span class="text-gray-400"
                          >{((60 / faxLPM) * 1000).toFixed(0)} ms/line</span
                        >
                      </div>

                      <!-- FAX canvas (scrolling image) -->
                      <div
                        class="w-full overflow-x-auto rounded border border-gray-600 bg-black"
                      >
                        <canvas
                          bind:this={faxCanvas}
                          width={FAX_CANVAS_W}
                          height={FAX_CANVAS_H}
                          class="block fax-flip"
                          style="image-rendering: pixelated; width: 100%; max-width: {FAX_CANVAS_W}px;"
                          title="HF FAX image — rotated 180°, newest lines build from bottom to top"
                        ></canvas>
                      </div>

                      <!-- Tone indicators + action buttons -->
                      <div class="flex items-center gap-2 mt-2 flex-wrap">
                        <div
                          class="flex items-center gap-1 text-xs {faxPhasing
                            ? 'text-cyan-300'
                            : 'text-gray-600'}"
                        >
                          <span
                            class="inline-block w-2 h-2 rounded-full {faxPhasing
                              ? 'bg-cyan-400 animate-pulse'
                              : 'bg-gray-600'}"
                          ></span>
                          300 Hz phasing
                        </div>
                        <div
                          class="flex items-center gap-1 text-xs {faxStopTone
                            ? 'text-red-300'
                            : 'text-gray-600'}"
                        >
                          <span
                            class="inline-block w-2 h-2 rounded-full {faxStopTone
                              ? 'bg-red-400 animate-pulse'
                              : 'bg-gray-600'}"
                          ></span>
                          450 Hz stop
                        </div>
                        <div class="flex-1"></div>
                        <button
                          class="text-green-100 bg-green-900 hover:bg-green-800 text-xs px-2 py-0.5 rounded border border-green-700 hover:border-green-500 transition-colors"
                          on:click={faxRefresh}
                          title="Clear canvas and reset decoder — use between transmissions"
                          >↺ Reset</button
                        >
                        <button
                          class="text-green-100 bg-green-900 hover:bg-green-800 text-xs px-2 py-0.5 rounded border border-green-700 hover:border-green-500 transition-colors"
                          on:click={faxSaveImage}
                          title="Save current image as PNG">⤓ Save PNG</button
                        >
                      </div>

                      <!-- Hint -->
                      <p class="text-gray-500 text-xs mt-3 leading-relaxed">
                        Mode must be <strong class="text-gray-300">USB</strong>
                        · Standard: 1500 Hz black · 2300 Hz white · 120 LPM ·
                        IOC 576 · Image scrolls upward — newest lines at bottom
                        · Use <em>↺ Refresh</em> between transmissions or when
                        image tears -
                        <a
                          href="https://www.weather.gov/media/marine/rfax.pdf"
                          target="_blank"
                          rel="noopener noreferrer"
                          style="color: cyan;">FAX transmission schedules</a
                        >
                      </p>
                    </div>
                  {/if}
                  <!-- END HF FAX Panel -->

                  {#if decoderOn && sstvEnabled}
                    <div
                      class="mt-3 rounded-xl border border-cyan-500/25 p-3 decoder-window decoder-panel"
                    >
                      <div class="flex flex-col items-start gap-2 mb-2">
                        <div class="flex items-center gap-2 min-w-0">
                          <span class="font-semibold text-cyan-300">SSTV</span>
                          {#if sstvDetectedMode}
                            <span
                              class="text-xs text-emerald-300 font-mono whitespace-nowrap"
                              >[{sstvDetectedMode}]</span
                            >
                          {/if}
                          <span
                            class="text-xs truncate {sstvSoftSync
                              ? 'text-yellow-300'
                              : 'text-gray-400'}"
                            title={sstvSoftSync
                              ? "soft sync hold"
                              : "hard sync lock"}
                            >{sstvSoftSync
                              ? "soft sync hold"
                              : "hard sync lock"}</span
                          >
                        </div>
                        <div class="flex flex-wrap items-center gap-1 w-full">
                          <button
                            class="text-xs px-2 py-1 rounded bg-teal-700 hover:bg-teal-600 text-white transition-colors whitespace-nowrap"
                            on:click={_sstvStart}
                            disabled={sstvRunning}>▶ Start</button
                          >
                          <button
                            class="text-xs px-2 py-1 rounded bg-teal-700 hover:bg-teal-600 text-white transition-colors whitespace-nowrap"
                            on:click={_sstvStop}
                            disabled={!sstvRunning}>■ Stop</button
                          >
                          <button
                            class="text-xs px-2 py-1 rounded bg-teal-700 hover:bg-teal-600 text-white transition-colors whitespace-nowrap"
                            on:click={sstvRefresh}
                            disabled={!sstvRunning}>↺ Reset</button
                          >
                          <button
                            class="text-xs px-2 py-1 rounded bg-amber-700 hover:bg-amber-600 text-white transition-colors whitespace-nowrap"
                            on:click={sstvForceNow}
                            disabled={!sstvRunning || sstvModeChoice === "auto"}
                            title="Start drawing now in the selected mode, without waiting for a VIS header or sync detection. Pick a mode other than Auto to enable."
                            >⏺ Force</button
                          >
                          <button
                            class="text-xs px-2 py-1 rounded bg-teal-700 hover:bg-teal-600 text-white transition-colors whitespace-nowrap"
                            on:click={sstvSaveImage}>💾 Save</button
                          >
                        </div>
                      </div>
                      <div
                        class="flex flex-wrap items-center gap-3 mb-2 text-xs text-gray-300"
                      >
                        <label class="flex items-center gap-2">
                          <span>Mode</span>
                          <select
                            bind:value={sstvModeChoice}
                            on:change={sstvModeChanged}
                            class="glass-select text-white text-xs px-2 py-1 rounded-md"
                          >
                            <option value="auto">Auto</option>
                            <option value="martin1">Martin M1</option>
                            <option value="martin2">Martin M2</option>
                            <option value="scottie1">Scottie S1</option>
                            <option value="scottie2">Scottie S2</option>
                            <option value="robot36">Robot 36</option>
                            <option value="scottieDX">Scottie DX</option>
                            <option value="robot72">Robot 72</option>
                          </select>
                        </label>
                        <span class="text-gray-400"
                          >Desktop + mobile · raw PCM before AGC/NR/mute</span
                        >
                        <span
                          class={sstvRunning
                            ? "text-emerald-300"
                            : "text-red-300"}
                          >{sstvRunning ? "Running" : "Stopped"}</span
                        >
                        <span class="text-gray-400"
                          >Lines: <span class="text-gray-200"
                            >{sstvLineCount}</span
                          >/{sstvCanvasH}</span
                        >
                      </div>
                      <div
                        class="mb-2 text-xs font-mono {sstvStatusText?.includes(
                          'lock',
                        )
                          ? 'text-cyan-300'
                          : 'text-gray-400'}"
                      >
                        {sstvStatusText}
                      </div>
                      <div
                        class="rounded-lg overflow-hidden border border-gray-700 bg-black inline-block w-full max-w-[340px] sm:max-w-full"
                      >
                        <canvas
                          bind:this={sstvCanvas}
                          width={SSTV_CANVAS_W}
                          height={SSTV_CANVAS_H}
                          class="block w-full h-auto"
                        ></canvas>
                      </div>
                    </div>
                  {/if}

                  <!-- ── NAVTEX / SITOR-B Decoder Panel ───────────────────── -->
                  {#if decoderOn && navtexEnabled}
                    <div
                      class="w-full rounded-lg p-4 mt-6 text-left decoder-window decoder-panel"
                    >
                      <!-- Header -->
                      <div
                        class="flex flex-wrap items-center justify-between gap-2 mb-3"
                      >
                        <h4
                          class="text-white font-semibold flex items-center gap-2 text-sm"
                        >
                          <span
                            class="inline-block w-2 h-2 rounded-full bg-teal-400 animate-pulse"
                          ></span>
                          NAVTEX Receiver
                          {#if navtexStatusText}
                            <span
                              class="text-xs text-teal-300 font-mono font-normal"
                              >[{navtexStatusText}]</span
                            >
                          {:else}
                            <span
                              class="text-xs text-gray-500 font-normal italic"
                              >waiting for phasing…</span
                            >
                          {/if}
                        </h4>
                        <button
                          class="text-green-100 bg-green-900 hover:bg-green-800 text-xs px-2 py-0.5 rounded border border-green-700 hover:border-green-500 transition-colors"
                          on:click={navtexClear}>Clear</button
                        >
                      </div>

                      <!-- Station selector + Tune button -->
                      <div class="flex flex-wrap items-center gap-2 mb-3">
                        <select
                          bind:value={navtexSelectedStation}
                          class="glass-select text-white text-xs px-2 py-1 rounded-md flex-1 min-w-0"
                          on:change={_navtexTickCountdown}
                        >
                          {#each NAVTEX_STATIONS as st}
                            <option value={st.name}>{st.name}</option>
                          {/each}
                        </select>
                        <button
                          class="text-xs px-2 py-1 rounded bg-teal-700 hover:bg-teal-600 text-white transition-colors whitespace-nowrap"
                          on:click={navtexApplyStation}
                          >⇒ Tune &amp; Set IF</button
                        >
                      </div>

                      <!-- Broadcast schedule countdown -->
                      {#if navtexScheduleRows.length > 0}
                        <div
                          class="mb-3 rounded-md bg-gray-900 overflow-hidden text-xs recess-window"
                        >
                          <div
                            class="flex items-center gap-1.5 px-2.5 py-1.5 border-b border-gray-700 bg-gray-800"
                          >
                            <svg
                              class="w-3 h-3 text-teal-400 shrink-0"
                              fill="none"
                              stroke="currentColor"
                              stroke-width="2"
                              viewBox="0 0 24 24"
                              ><circle cx="12" cy="12" r="10" /><polyline
                                points="12 6 12 12 16 14"
                              /></svg
                            >
                            <span
                              class="text-teal-400 font-semibold tracking-wide uppercase"
                              >Next Broadcasts · UTC</span
                            >
                          </div>
                          <div
                            class="overflow-y-auto max-h-40 custom-scrollbar divide-y divide-gray-800"
                          >
                            {#each navtexScheduleRows as row, i}
                              <div
                                class="flex items-center gap-2 px-2.5 py-1 {row.onAir
                                  ? 'bg-teal-900/40'
                                  : i === 0
                                    ? 'bg-gray-800/70'
                                    : 'hover:bg-gray-800/40'} transition-colors"
                              >
                                <span class="shrink-0 text-sm leading-none"
                                  >{@html window.twemoji
                                    ? window.twemoji.parse(row.flag)
                                    : row.flag}</span
                                >
                                <span
                                  class="inline-flex items-center justify-center w-4 h-4 rounded text-[10px] font-bold shrink-0
                                  {row.onAir
                                    ? 'bg-green-500 text-gray-900 animate-pulse'
                                    : row.imminent
                                      ? 'bg-red-500 text-white animate-pulse'
                                      : row.urgent
                                        ? 'bg-amber-500 text-gray-900'
                                        : i === 0
                                          ? 'bg-teal-600 text-white'
                                          : 'bg-gray-600 text-gray-300'}"
                                  >{row.id}</span
                                >
                                <span class="text-gray-200 flex-1 truncate"
                                  >{row.name}</span
                                >
                                <span
                                  class="text-gray-500 shrink-0 hidden sm:inline"
                                  >{row.area}</span
                                >
                                <span class="text-gray-400 font-mono shrink-0"
                                  >{row.nextUTC}</span
                                >
                                <span
                                  class="font-mono tabular-nums w-20 text-right shrink-0
                                  {row.onAir
                                    ? 'text-green-300 font-bold'
                                    : row.imminent
                                      ? 'text-red-400 font-bold'
                                      : row.urgent
                                        ? 'text-amber-400 font-semibold'
                                        : i === 0
                                          ? 'text-teal-300'
                                          : 'text-gray-500'}">{row.label}</span
                                >
                                {#if row.onAir}
                                  <span
                                    class="text-green-400 animate-pulse shrink-0 font-semibold"
                                    title="Transmitting now">●</span
                                  >
                                {:else if row.imminent}
                                  <span
                                    class="text-red-400 animate-pulse shrink-0 font-semibold"
                                    >●</span
                                  >
                                {:else if row.urgent}
                                  <span
                                    class="text-amber-400 animate-pulse shrink-0"
                                    title="Arm decoder now">⚡</span
                                  >
                                {/if}
                              </div>
                            {/each}
                          </div>
                        </div>
                      {/if}

                      <!-- Text output -->
                      <div
                        bind:this={navtexScrollEl}
                        class="w-full font-mono text-sm text-teal-200 bg-gray-900 rounded p-3 overflow-y-auto max-h-72 custom-scrollbar text-left recess-window"
                        style="letter-spacing:0.04em; word-break:break-all; line-height:1.5; text-align:left;"
                      >
                        {#each navtexMessages as line}
                          <div
                            class={line.startsWith("━━")
                              ? "text-teal-400 font-semibold my-1"
                              : ""}
                          >
                            {line}
                          </div>
                        {/each}
                        {#if navtexCurrentLine}
                          <div class="text-teal-100">
                            {navtexCurrentLine}<span class="animate-pulse"
                              >▋</span
                            >
                          </div>
                        {:else if navtexMessages.length === 0}
                          <div class="text-gray-500 italic text-xs">
                            Listening for NAVTEX signal…<br />
                            Set mode to
                            <strong class="text-gray-300">USB</strong>
                            and use <em>⇒ Tune &amp; Set IF</em> to auto-tune.
                          </div>
                        {/if}
                      </div>

                      <!-- Hint -->
                      <p class="text-gray-500 text-xs mt-3 leading-relaxed">
                        Mode: <strong class="text-gray-300">USB</strong> · 100
                        Baud FSK · 170 Hz shift · SITOR-B FEC · Dial set 500 Hz
                        below channel (signal centre at 500 Hz audio) ·
                        <a
                          href="https://yachtlycrew.com/tools/navtex-stations"
                          target="_blank"
                          rel="noopener noreferrer"
                          style="color:cyan;">NAVTEX Maps Stations</a
                        >
                      </p>
                      <div class="mt-3 flex justify-end">
                        <button
                          class="text-xs px-2 py-1 rounded bg-teal-700 hover:bg-teal-600 text-white transition-colors whitespace-nowrap"
                          on:click={saveNavtexText}>Save Text</button
                        >
                      </div>
                    </div>
                  {/if}
                  <!-- END NAVTEX Panel -->

                  <!-- ── RADE v1 Digital Voice Panel ──────────────────────── -->
                  {#if decoderOn && radeEnabled}
                    <div
                      class="w-full rounded-lg p-4 mt-6 text-left decoder-window decoder-panel"
                    >
                      <div
                        class="flex flex-wrap items-center justify-between gap-2 mb-3"
                      >
                        <h4
                          class="text-white font-semibold flex items-center gap-2 text-sm"
                        >
                          <span
                            class="inline-block w-2 h-2 rounded-full {radeConnected
                              ? radeSynced
                                ? 'bg-green-400 animate-pulse'
                                : 'bg-yellow-400 animate-pulse'
                              : 'bg-red-500'}"
                          ></span>
                          RADE v1 &nbsp;·&nbsp; {demodulation === "RADEL"
                            ? "RADEL (LSB)"
                            : "RADEU (USB)"}
                          <span
                            class="text-xs font-mono font-normal {radeConnected
                              ? radeSynced
                                ? 'text-green-300'
                                : 'text-yellow-300'
                              : 'text-red-400'}"
                          >
                            {#if !radeConnected}
                              Connecting to sidecar…
                            {:else if radeSynced}
                              Synced{radeSnr !== null
                                ? " · SNR " + radeSnr.toFixed(1) + " dB"
                                : ""}
                            {:else}
                              Searching for signal…
                            {/if}
                          </span>
                        </h4>
                      </div>

                      <!-- Status row -->
                      <div class="flex items-center gap-3 mb-3 text-xs">
                        <span
                          class="px-2 py-0.5 rounded font-semibold {radeConnected
                            ? 'bg-green-800 text-green-200'
                            : 'bg-gray-800 text-gray-400'}"
                        >
                          {radeConnected ? "Sidecar OK" : "No Sidecar"}
                        </span>
                        <span
                          class="px-2 py-0.5 rounded font-semibold {radeSynced
                            ? 'bg-blue-800 text-blue-200'
                            : 'bg-gray-800 text-gray-500'}"
                        >
                          {radeSynced ? "Frame Sync" : "Acquiring…"}
                        </span>
                        <span class="text-gray-500 font-mono"
                          >1500 Hz BW · FARGAN vocoder</span
                        >
                      </div>

                      <!-- Info / error -->
                      {#if !radeConnected}
                        <div
                          class="rounded bg-red-900/40 border border-red-700 px-3 py-2 text-xs text-red-300 mb-3"
                        >
                          <strong>⚠ Sidecar not reachable.</strong> Start it on
                          the server:<br />
                          <code class="text-red-200 font-mono"
                            >python3 rade_helper.py</code
                          >
                          &nbsp;(listens on port 8074)
                        </div>
                      {/if}

                      <!-- Hint -->
                      <p class="text-gray-500 text-xs mt-2 leading-relaxed">
                        FreeDV RADE v1 · decoded server-side by
                        <code class="text-gray-400">rade_helper.py</code> →
                        <code class="text-gray-400">radae_rxe.py</code> →
                        <code class="text-gray-400">lpcnet_demo</code><br />
                        {demodulation === "RADEL"
                          ? "LSB — use on 40 m / 80 m / 160 m."
                          : "USB — use on 20 m / 17 m / 15 m / 10 m."}
                        See
                        <a
                          href="https://freedv.org/radio-autoencoder/"
                          target="_blank"
                          rel="noopener noreferrer"
                          style="color:cyan;">freedv.org/radio-autoencoder</a
                        >.
                      </p>

                      <!-- FreeDV Reporter toggle -->
                      <div class="mt-3 flex items-center justify-end gap-2">
                        <button
                          class="text-xs px-3 py-1 rounded {radeReporterOpen
                            ? 'bg-green-500 hover:bg-green-400'
                            : 'bg-green-700 hover:bg-green-600'} text-white transition-colors whitespace-nowrap"
                          on:click={() =>
                            (radeReporterOpen = !radeReporterOpen)}
                        >
                          {radeReporterOpen
                            ? "▲ Hide Reporter"
                            : "📡 FreeDV Reporter"}
                        </button>
                        {#if radeReporterOpen}
                          <a
                            href="https://qso.freedv.org/"
                            target="_blank"
                            rel="noopener noreferrer"
                            class="text-xs text-gray-400 hover:text-gray-200 transition-colors"
                            >↗ open in tab</a
                          >
                        {/if}
                      </div>

                      <!-- FreeDV Reporter — native live list (was qso.freedv.org iframe) -->
                      {#if radeReporterOpen}
                        <div class="mt-2">
                          <FreeDVReporter />
                        </div>
                        <p class="text-gray-600 text-xs mt-1 text-right">
                          Live · <a
                            href="https://qso.freedv.org/"
                            target="_blank"
                            rel="noopener noreferrer"
                            class="hover:text-gray-400 transition-colors"
                            >qso.freedv.org</a
                          >
                        </p>
                      {/if}
                    </div>
                  {/if}
                  <!-- END RADE Panel -->

                  <!-- ── FSK / RTTY Decoder Panel ─────────────────────────── -->
                  {#if decoderOn && fskEnabled}
                    <div
                      class="w-full rounded-lg p-4 mt-6 text-left decoder-window decoder-panel"
                    >
                      <div
                        class="flex flex-wrap items-center justify-between gap-2 mb-3"
                      >
                        <h4
                          class="text-white font-semibold flex items-center gap-2 text-sm"
                        >
                          <span
                            class="inline-block w-2 h-2 rounded-full bg-green-400 animate-pulse"
                          ></span>
                          {isPsk
                            ? "PSK31 Decoder"
                            : isOlivia
                              ? "Olivia Decoder"
                              : "FSK / RTTY Decoder"}
                          {#if fskStatusText}
                            <span
                              class="text-xs text-green-300 font-mono font-normal"
                              >[{fskStatusText}]</span
                            >
                          {:else}
                            <span
                              class="text-xs text-gray-500 font-normal italic"
                              >waiting for lock…</span
                            >
                          {/if}
                        </h4>
                        <button
                          class="text-green-100 bg-green-900 hover:bg-green-800 text-xs px-2 py-0.5 rounded border border-green-700 hover:border-green-500 transition-colors"
                          on:click={fskClear}>Clear</button
                        >
                      </div>

                      <div class="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                        <div>
                          <label class="text-xs text-gray-300 block mb-1"
                            >Variant</label
                          >
                          <select
                            bind:value={fskVariant}
                            class="glass-select text-white text-xs px-2 py-1 rounded-md w-full"
                            on:change={fskVariantChanged}
                          >
                            <option value="maritime"
                              >Maritime FSK / SITOR</option
                            >
                            <option value="weather">Weather RTTY</option>
                            <option value="ham">Amateur RTTY</option>
                            <option value="psk31">PSK31 (BPSK)</option>
                            <option value="olivia">Olivia (MFSK)</option>
                          </select>
                        </div>
                        <div>
                          <label class="text-xs text-gray-300 block mb-1"
                            >Known frequency</label
                          >
                          <div class="flex gap-2">
                            <select
                              bind:value={fskKnownFrequency}
                              class="glass-select text-white text-xs px-2 py-1 rounded-md w-full"
                            >
                              <option value="">— Select frequency —</option>
                              {#each FSK_KNOWN_FREQUENCIES[fskVariant] || [] as item}
                                <option value={String(item.khz)}
                                  >{item.label}</option
                                >
                              {/each}
                            </select>
                            <button
                              class="text-xs px-3 py-1 rounded bg-green-700 hover:bg-green-600 text-white transition-colors whitespace-nowrap"
                              on:click={fskApplyKnownFrequency}>Tune</button
                            >
                          </div>
                        </div>
                      </div>

                      <!-- Broadcast schedule countdown -->
                      {#if fskScheduleRows.length > 0}
                        <div
                          class="mb-3 rounded-md bg-gray-900 overflow-hidden text-xs recess-window"
                        >
                          <div
                            class="flex items-center gap-1.5 px-2.5 py-1.5 border-b border-gray-700 bg-gray-800"
                          >
                            <svg
                              class="w-3 h-3 text-green-400 shrink-0"
                              fill="none"
                              stroke="currentColor"
                              stroke-width="2"
                              viewBox="0 0 24 24"
                              ><circle cx="12" cy="12" r="10" /><polyline
                                points="12 6 12 12 16 14"
                              /></svg
                            >
                            <span
                              class="text-green-400 font-semibold tracking-wide uppercase"
                              >Next Broadcasts · UTC</span
                            >
                            {#if fskScheduleTitle}
                              <span class="text-gray-500 normal-case"
                                >· {fskScheduleTitle}</span
                              >
                            {/if}
                          </div>
                          <div class="divide-y divide-gray-800">
                            {#each fskScheduleRows as row, i}
                              <div
                                class="flex items-center gap-2 px-2.5 py-1.5 {row.onAir
                                  ? 'bg-green-900/30'
                                  : i === 0
                                    ? 'bg-gray-800/70'
                                    : 'hover:bg-gray-800/40'} transition-colors"
                              >
                                <span
                                  class="font-mono text-gray-300 shrink-0 w-10"
                                  >{row.utc}</span
                                >
                                <span class="text-gray-400 flex-1 truncate"
                                  >{@html window.twemoji
                                    ? window.twemoji.parse(row.label)
                                    : row.label}</span
                                >
                                <span
                                  class="font-mono tabular-nums shrink-0
                                  {row.onAir
                                    ? 'text-green-300 font-bold'
                                    : row.imminent
                                      ? 'text-red-400 font-bold'
                                      : row.urgent
                                        ? 'text-amber-400 font-semibold'
                                        : 'text-gray-500'}"
                                  >{row.countdown}</span
                                >
                                {#if row.onAir}
                                  <span
                                    class="text-green-400 animate-pulse shrink-0"
                                    title="Transmitting now">●</span
                                  >
                                {:else if row.imminent}
                                  <span
                                    class="text-red-400 animate-pulse shrink-0"
                                    >●</span
                                  >
                                {:else if row.urgent}
                                  <span
                                    class="text-amber-400 animate-pulse shrink-0"
                                    title="Transmission starts soon">⚡</span
                                  >
                                {/if}
                              </div>
                            {/each}
                          </div>
                        </div>
                      {/if}

                      <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                        <div>
                          <label class="text-xs text-gray-300 block mb-1"
                            >Center audio (Hz)</label
                          >
                          {#if isMfskLike}
                            <!-- Free entry: a PSK31 carrier (or an Olivia block
                                 centre) can sit anywhere in the passband, and
                                 auto-tune reports an exact value that no fixed
                                 list would contain. -->
                            <input
                              type="number"
                              min="200"
                              max="2800"
                              step="1"
                              bind:value={fskCenter}
                              class="glass-select text-white text-xs px-2 py-1 rounded-md w-full"
                              on:change={() => fskApplySettings(true)}
                            />
                          {:else}
                            <select
                              bind:value={fskCenter}
                              class="glass-select text-white text-xs px-2 py-1 rounded-md w-full"
                              on:change={() => fskApplySettings(true)}
                            >
                              {#each FSK_CENTER_OPTIONS[fskVariant] || [] as v}
                                <option value={v}>{v} Hz</option>
                              {/each}
                            </select>
                          {/if}
                        </div>
                        {#if isOlivia}
                          <div>
                            <label class="text-xs text-gray-300 block mb-1"
                              >Mode (tones / Hz)</label
                            >
                            <select
                              bind:value={oliviaMode}
                              class="glass-select text-white text-xs px-2 py-1 rounded-md w-full"
                              on:change={() => fskApplySettings(true)}
                            >
                              {#each OLIVIA_MODE_OPTIONS as m}
                                <option value="{m.tones}/{m.bw}">{m.label}</option
                                >
                              {/each}
                            </select>
                          </div>
                          <div class="col-span-2">
                            <label
                              class="text-xs text-gray-300 block mb-1 flex justify-between"
                            >
                              <span>Squelch (FEC S/N)</span>
                              <span class="text-green-300 font-mono"
                                >{Number(oliviaSquelch).toFixed(1)}</span
                              >
                            </label>
                            <input
                              type="range"
                              min="3"
                              max="15"
                              step="0.5"
                              bind:value={oliviaSquelch}
                              class="w-full accent-green-500"
                              on:input={fskApplySquelch}
                            />
                            <p class="text-gray-500 text-[10px] mt-0.5">
                              Below 3.5 noise starts printing; a good signal
                              reads 8–9 on the FEC meter.
                            </p>
                          </div>
                        {/if}
                        {#if !isMfskLike}
                          <div>
                            <label class="text-xs text-gray-300 block mb-1"
                              >Shift (Hz)</label
                            >
                            <select
                              bind:value={fskShift}
                              class="glass-select text-white text-xs px-2 py-1 rounded-md w-full"
                              on:change={() => fskApplySettings(true)}
                            >
                              {#each FSK_SHIFT_OPTIONS[fskVariant] || [] as v}
                                <option value={v}>{v} Hz</option>
                              {/each}
                            </select>
                          </div>
                          <div>
                            <label class="text-xs text-gray-300 block mb-1"
                              >Baud</label
                            >
                            <select
                              bind:value={fskBaud}
                              class="glass-select text-white text-xs px-2 py-1 rounded-md w-full"
                              on:change={() => fskApplySettings(false)}
                            >
                              {#each FSK_BAUD_OPTIONS[fskVariant] || [] as v}
                                <option value={v}>{v}</option>
                              {/each}
                            </select>
                          </div>
                          <div>
                          <label class="text-xs text-gray-300 block mb-1"
                            >Framing</label
                          >
                          <select
                            bind:value={fskFraming}
                            class="glass-select text-white text-xs px-2 py-1 rounded-md w-full"
                            on:change={() => fskApplySettings(false)}
                          >
                            <option value="5N1">5N1</option>
                            <option value="5N1.5">5N1.5</option>
                            <option value="5N2">5N2</option>
                            <option value="7N1">7N1</option>
                            <option value="7E1">7E1</option>
                            <option value="7O1">7O1</option>
                            <option value="8N1">8N1</option>
                          </select>
                          </div>
                        {/if}
                      </div>

                      {#if !isMfskLike}
                        <div class="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                          <div>
                            <label class="text-xs text-gray-300 block mb-1"
                              >Encoding</label
                            >
                            <select
                              bind:value={fskEncoding}
                              class="glass-select text-white text-xs px-2 py-1 rounded-md w-full"
                              on:change={() => fskApplySettings(false)}
                            >
                              <option value="ccir476">CCIR-476</option>
                              <option value="ita2">ITA2 / Baudot</option>
                              <option value="ascii">ASCII</option>
                            </select>
                          </div>
                          <label
                            class="flex items-center gap-2 text-xs text-gray-300 mt-5"
                          >
                            <input
                              type="checkbox"
                              bind:checked={fskInvert}
                              on:change={() => fskApplySettings(false)}
                            />
                            Invert mark / space
                          </label>
                          <label
                            class="flex items-center gap-2 text-xs text-gray-300 mt-5"
                          >
                            <input
                              type="checkbox"
                              bind:checked={fskAutoShift}
                              on:change={() => fskApplySettings(false)}
                            />
                            Auto shift detect
                          </label>
                        </div>
                      {/if}

                      <div
                        class="flex flex-wrap items-center gap-2 mb-3 text-xs"
                      >
                        <button
                          class="text-xs px-3 py-1 rounded bg-green-700 hover:bg-green-600 text-white transition-colors whitespace-nowrap"
                          on:click={fskApplyBandpass}>⇒ Set IF Band-Pass</button
                        >
                        <button
                          class="text-xs px-3 py-1 rounded bg-blue-700 hover:bg-blue-600 text-white transition-colors whitespace-nowrap"
                          on:click={() => {
                            audio.setFSKAutoCenter(true);
                            fskStatusText = "Auto-tune scanning…";
                          }}>⟳ Auto-tune Center</button
                        >
                        {#if isPsk}
                          <span class="text-gray-300"
                            >Carrier: <span class="text-green-300 font-mono"
                              >{Math.round(fskMetrics.centerHz || 0)} Hz</span
                            ></span
                          >
                          <span class="text-gray-300"
                            >IMD: <span class="text-green-300 font-mono"
                              >{Number(fskMetrics.imdDb || 0).toFixed(1)} dB</span
                            ></span
                          >
                        {:else if isOlivia}
                          <span class="text-gray-300"
                            >Centre: <span class="text-green-300 font-mono"
                              >{Math.round(fskMetrics.centerHz || 0)} Hz</span
                            ></span
                          >
                          <span class="text-gray-300"
                            >Mode: <span class="text-green-300 font-mono"
                              >{oliviaCfg.label}</span
                            ></span
                          >
                        {:else}
                          <span class="text-gray-300"
                            >Mark: <span class="text-green-300 font-mono"
                              >{Math.round(fskMetrics.markHz || 0)} Hz</span
                            ></span
                          >
                          <span class="text-gray-300"
                            >Space: <span class="text-green-300 font-mono"
                              >{Math.round(fskMetrics.spaceHz || 0)} Hz</span
                            ></span
                          >
                        {/if}
                        <span class="text-gray-300"
                          >{isMfskLike ? "S/N" : "SNR"}: <span
                            class="text-green-300 font-mono"
                            >{Number(fskMetrics.snrDb || 0).toFixed(1)} dB</span
                          ></span
                        >
                        <span class="text-gray-300"
                          >{isOlivia ? "FEC" : "Lock"}: <span
                            class="text-green-300 font-mono"
                            >{fskMetrics.lockQuality || 0}%</span
                          ></span
                        >
                        <span class="text-gray-300"
                          >{isOlivia ? "Sync" : "Timing"}: <span
                            class="{fskMetrics.timingLocked
                              ? 'text-green-300'
                              : 'text-gray-500'} font-mono"
                            >{fskMetrics.timingLocked
                              ? isOlivia
                                ? "SYNCED"
                                : "LOCKED"
                              : "SEARCH"}</span
                          ></span
                        >
                      </div>

                      <div
                        bind:this={fskScrollEl}
                        class="w-full font-mono text-sm text-green-300 bg-gray-900 rounded p-3 overflow-y-auto max-h-72 custom-scrollbar text-left recess-window"
                        style="letter-spacing:0.04em; word-break:break-word; overflow-wrap:anywhere; white-space:pre-wrap; line-height:1.5; text-align:left;"
                      >
                        {#each fskTextLines as line}
                          <div class="break-words whitespace-pre-wrap">
                            {line}
                          </div>
                        {/each}
                        {#if fskCurrentLine}
                          <div
                            class="break-words whitespace-pre-wrap text-green-100"
                          >
                            {fskCurrentLine}<span class="animate-pulse">▋</span>
                          </div>
                        {:else if fskTextLines.length === 0}
                          <div class="text-gray-500 italic text-xs">
                            {#if isPsk}
                              PSK31 decoder has taken control of mode and IF
                              while active.<br />
                              Pick a watering hole above, then use Auto-tune Center
                              or set the carrier by hand — the decoder pulls in the
                              last ±25 Hz on its own.
                            {:else if isOlivia}
                              Olivia decoder has taken control of mode and IF
                              while active.<br />
                              Olivia sends no preamble, so sync is searched for:
                              allow a few seconds before text appears. The Mode
                              setting must match the transmission exactly.
                            {:else}
                              FSK / RTTY decoder has taken control of mode and IF
                              while active.<br />
                              Use the known frequency list, then fine-tune until the
                              text becomes stable.
                            {/if}
                          </div>
                        {/if}
                      </div>

                      <!-- Hint -->
                      <p class="text-gray-500 text-xs mt-3 leading-relaxed">
                        {#if isPsk}
                          <strong class="text-gray-300"
                            >Mode: USB. Tune so the carrier sits on the Center
                            audio value,
                            <br /> and expect IMD better than −20 dB from a clean
                            transmitter</strong
                          >.
                        {:else if isOlivia}
                          <strong class="text-gray-300"
                            >Mode: USB. Pick the right tones / bandwidth — a
                            wrong Mode decodes nothing at all,
                            <br /> and the FEC lags a few blocks, so text arrives
                            in bursts</strong
                          >.
                        {:else}
                          <strong class="text-gray-300"
                            >Mode: USB. Please check "Invert mark / space" for
                            RTTY (weather),
                            <br /> but leave it unchecked for maritime FSK and HAM RTTY</strong
                          >.
                        {/if}
                      </p>
                      <div class="mt-3 flex justify-end">
                        <button
                          class="text-xs px-3 py-1 rounded bg-green-700 hover:bg-green-600 text-white transition-colors whitespace-nowrap"
                          on:click={saveFskText}>Save Text</button
                        >
                      </div>
                    </div>
                  {/if}
                  <!-- END FSK Panel -->

                  <!-- Begin Bookmark Button Area -->

                  <hr class="border-gray-600 my-2" />
                  <button
                    id="bookmark-button"
                    class="glass-button text-white font-bold py-2 px-4 rounded-lg flex items-center w-full justify-center"
                    on:click={toggleBookmarkPopup}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      class="h-5 w-5 mr-2"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        d="M5 4a2 2 0 012-2h6a2 2 0 012 2v14l-5-2.5L5 18V4z"
                      />
                    </svg>
                    Bookmarks
                  </button>

                  <div
                    id="user_count_container"
                    class="w-full mt-4 bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg p-1"
                  >
                    <div
                      id="total_user_count"
                      class="bg-gray-800 rounded-md p-2 text-center flex justify-between items-center"
                    >
                      <!-- Content will be populated by JavaScript -->
                    </div>
                  </div>
                </div>

                <!-- Bookmark Popup -->
                {#if showBookmarkPopup}
                  <div
                    class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
                    on:click={toggleBookmarkPopup}
                  >
                    <div
                      class="p-6 rounded-lg max-w-lg w-full max-h-[80vh] flex flex-col decoder-window popup-panel"
                      on:click|stopPropagation
                    >
                      <div class="flex justify-between items-center mb-4">
                        <h2 class="text-xl font-bold text-white">Bookmarks</h2>
                        <button
                          class="text-gray-400 hover:text-white"
                          on:click={toggleBookmarkPopup}
                        >
                          <svg
                            class="w-6 h-6"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              stroke-width="2"
                              d="M6 18L18 6M6 6l12 12"
                            ></path>
                          </svg>
                        </button>
                      </div>

                      <!-- Add Bookmark Section -->
                      <div class="mb-6">
                        <label
                          class="block text-sm font-medium text-gray-300 mb-2"
                          >Add New Bookmark</label
                        >
                        <div class="flex flex-col gap-2">
                          <input
                            id="textInput"
                            class="glass-input text-white text-sm rounded-lg focus:outline-none px-3 py-2"
                            bind:value={newBookmarkName}
                            placeholder="Bookmark name"
                          />
                          <input
                            class="glass-input text-white text-sm rounded-lg focus:outline-none px-3 py-2"
                            bind:value={newBookmarkLabel}
                            placeholder="Label (optional)"
                          />
                          <button
                            class="glass-button text-white font-bold py-2 px-4 rounded-lg flex items-center justify-center"
                            on:click={addBookmark}
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              class="h-5 w-5 mr-2"
                              viewBox="0 0 20 20"
                              fill="currentColor"
                            >
                              <path
                                fill-rule="evenodd"
                                d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"
                                clip-rule="evenodd"
                              />
                            </svg>
                            Add
                          </button>
                        </div>
                      </div>

                      <!-- Current Link Section -->
                      <div class="mb-6">
                        <label
                          class="block text-sm font-medium text-gray-300 mb-2"
                          >Current Link</label
                        >
                        <div class="flex items-center gap-2">
                          <input
                            type="text"
                            class="glass-input text-white text-sm rounded-lg focus:outline-none px-3 py-2 flex-grow"
                            value={link}
                            readonly
                          />
                          <button
                            class="glass-button text-white font-bold py-2 px-4 rounded-lg flex items-center"
                            on:click={handleLinkCopyClick}
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              class="h-5 w-5 mr-2"
                              viewBox="0 0 20 20"
                              fill="currentColor"
                            >
                              <path
                                d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z"
                              />
                              <path
                                d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z"
                              />
                            </svg>
                            Copy
                          </button>
                        </div>
                      </div>

                      <!-- amkbookmarks -->

                      <!-- upload bookmark section -->

                      <div class="mb-6">
                        <label
                          class="block text-sm font-medium text-gray-300 mb-2"
                          >Up-Down/load Bookmarks. REFRESH the webpage (F5) to
                          see them!
                        </label>
                        <div class="flex items-center gap-2">
                          <!-- Click button το file input -->

                          <!-- Descret input type file  -->
                          <input
                            type="file"
                            accept=".json, .csv, application/json"
                            style="display: none;"
                            on:change={uploadBookmarks}
                            bind:this={fileInput}
                          />

                          <!-- Button for activating file input  -->
                          <button
                            class="glass-button text-white font-bold py-2 px-4 rounded-lg flex items-center"
                            on:click={() => fileInput.click()}
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              class="h-5 w-5 mr-2"
                              viewBox="0 0 20 20"
                              fill="currentColor"
                            >
                              <path
                                d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z"
                              />
                              <path
                                d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z"
                              />
                            </svg>
                            Upload Bookmarks
                          </button>

                          <!-- End of upload bookmark section -->

                          <!-- download bookmark Section -->

                          <button
                            class="glass-button text-white font-bold py-2 px-4 rounded-lg flex items-center"
                            on:click={downloadBookmarks}
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              class="h-5 w-5 mr-2"
                              viewBox="0 0 20 20"
                              fill="currentColor"
                            >
                              <path
                                d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z"
                              />
                              <path
                                d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z"
                              />
                            </svg>
                            Download Bookmarks
                          </button>
                        </div>
                      </div>

                      <!-- End off Download bookmark Section -->

                      <!-- end of amkbookmarks -->

                      <!-- Bookmarks List -->
                      <div class="overflow-y-auto flex-grow h-80">
                        <label
                          class="block text-sm font-medium text-gray-300 mb-2"
                          >Saved Bookmarks</label
                        >
                        {#each $bookmarks as bookmark, index}
                          <div
                            class="glass-panel rounded-lg p-3 flex items-center justify-between mb-2"
                          >
                            <div class="flex flex-col">
                              <span class="text-white text-sm"
                                >{bookmark.name}</span
                              >
                              <span class="text-gray-400 text-xs"
                                >{(bookmark.frequency / 1000).toFixed(3)} kHz</span
                              >
                            </div>
                            <div class="flex gap-2">
                              <button
                                class="glass-button text-white font-bold py-1 px-3 rounded-lg flex items-center"
                                on:click={() => goToBookmark(bookmark)}
                              >
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  class="h-4 w-4 mr-1"
                                  viewBox="0 0 20 20"
                                  fill="currentColor"
                                >
                                  <path
                                    fill-rule="evenodd"
                                    d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z"
                                    clip-rule="evenodd"
                                  />
                                </svg>
                                Go
                              </button>
                              <button
                                class="glass-button text-white font-bold py-1 px-3 rounded-lg flex items-center"
                                on:click={() => copy(bookmark.link)}
                              >
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  class="h-4 w-4 mr-1"
                                  viewBox="0 0 20 20"
                                  fill="currentColor"
                                >
                                  <path
                                    d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z"
                                  />
                                  <path
                                    d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z"
                                  />
                                </svg>
                                Copy
                              </button>
                              <button
                                class="glass-button text-white font-bold py-1 px-3 rounded-lg flex items-center"
                                on:click={() => deleteBookmark(index)}
                              >
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  class="h-4 w-4 mr-1"
                                  viewBox="0 0 20 20"
                                  fill="currentColor"
                                >
                                  <path
                                    fill-rule="evenodd"
                                    d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                                    clip-rule="evenodd"
                                  />
                                </svg>
                                Delete
                              </button>
                            </div>
                          </div>
                        {/each}
                      </div>
                    </div>
                  </div>
                {/if}
              </div>
            </div>

            {#if siteChatEnabled}
              <!--Beginn of Chatbox -->
              <!--To disable Chatbox: Delte Code from here to .. -->

              <div
                class="flex flex-col rounded p-2 justify-center"
                id="chat-column"
              >
                <div
                  class="p-3 sm:p-5 flex flex-col bg-gray-800 border border-gray-700 rounded-lg w-full mb-2"
                  id="chat-box"
                >
                  <h2
                    class="text-xl sm:text-2xl font-semibold text-gray-100 mb-2 sm:mb-4"
                  >
                    Chat
                  </h2>

                  <!-- Username Display/Input -->
                  <div class="mb-2 sm:mb-4 flex flex-wrap items-center">
                    <span
                      class="text-white text-xs sm:text-sm mr-2 mb-2 sm:mb-0"
                      >Chatting as:</span
                    >
                    {#if showUsernameInput}
                      <input
                        class="glass-input text-white py-1 px-2 rounded-lg outline-none text-xs sm:text-sm flex-grow mr-2 mb-2 sm:mb-0"
                        bind:value={username}
                        placeholder="Enter your name/callsign"
                        on:keydown={(e) => e.key === "Enter" && saveUsername()}
                      />
                      <button
                        class="glass-button text-white py-1 px-3 mb-2 lg:mb-0 rounded-lg text-xs sm:text-sm"
                        on:click={saveUsername}
                      >
                        Save
                      </button>
                    {:else}
                      <span
                        class="glass-username text-white text-xs sm:text-sm px-3 py-1 rounded-lg mr-2 mb-2 sm:mb-0"
                      >
                        {username || myDisplayId || "Anonymous"}
                      </span>
                      <button
                        class="glass-button text-white py-1 px-3 mb-2 lg:mb-0 rounded-lg text-xs sm:text-sm"
                        on:click={editUsername}
                      >
                        Edit
                      </button>
                    {/if}
                  </div>

                  <!-- Chat Messages -->
                  <div
                    class="bg-gray-900 rounded-lg p-2 sm:p-3 mb-2 sm:mb-4 h-48 sm:h-64 overflow-y-auto custom-scrollbar"
                    bind:this={chatMessages}
                  >
                    {#each $messages as { id, text } (id)}
                      {@const formattedMessage = formatFrequencyMessage(text)}
                      <div
                        class="mb-2 sm:mb-3 text-left"
                        in:fly={{ y: 20, duration: 300, easing: quintOut }}
                      >
                        <div
                          class="inline-block bg-gray-800 rounded-lg p-2 max-w-full"
                        >
                          <p class="text-white text-xs sm:text-sm break-words">
                            <span class="font-semibold text-blue-300"
                              >{formattedMessage.username}</span
                            >
                            <span class="text-xs text-gray-400 ml-2"
                              >{formattedMessage.timestamp}</span
                            >
                          </p>
                          <p
                            class="text-white text-xs sm:text-sm break-words mt-1"
                          >
                            {#if formattedMessage.isFormatted}
                              {@html renderParts(formattedMessage.beforeFreq)}
                              <a
                                href="#"
                                class="text-blue-300 hover:underline"
                                on:click|preventDefault={() =>
                                  handleFrequencyClick(
                                    formattedMessage.frequency,
                                    formattedMessage.demodulation,
                                  )}
                              >
                                {(formattedMessage.frequency / 1000).toFixed(3)} kHz
                                ({formattedMessage.demodulation})
                              </a>
                              {@html renderParts(formattedMessage.afterFreq)}
                            {:else}
                              {@html renderParts(formattedMessage.parts)}
                            {/if}
                          </p>
                        </div>
                      </div>
                    {/each}
                  </div>

                  <!-- Message Input and Buttons -->
                  <div
                    class="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2"
                  >
                    <input
                      class="glass-input text-white py-2 px-3 rounded-lg outline-none text-xs sm:text-sm flex-grow"
                      bind:value={newMessage}
                      on:keydown={handleEnterKey}
                      placeholder="Type a message..."
                    />
                    <div class="flex space-x-2">
                      <div class="emoji-btn-container">
                        <button
                          class="glass-button text-white font-semibold py-2 px-3 rounded-lg flex items-center justify-center text-xs sm:text-sm"
                          on:click|stopPropagation={toggleEmojiPicker}
                          title="Emoji"
                        >
                          😊
                        </button>
                        {#if showEmojiPicker}
                          <div
                            class="emoji-picker-wrapper"
                            on:click|stopPropagation
                          >
                            <emoji-picker class="dark" use:emojiAction
                            ></emoji-picker>
                          </div>
                        {/if}
                      </div>
                      <button
                        class="glass-button text-white font-semibold py-2 px-4 rounded-lg flex items-center justify-center text-xs sm:text-sm flex-grow sm:flex-grow-0"
                        on:click={sendMessage}
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          class="h-4 w-4 mr-2"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path
                            d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z"
                          />
                        </svg>
                        Send
                      </button>
                      <button
                        class="glass-button text-white font-semibold py-2 px-4 rounded-lg flex items-center justify-center text-xs sm:text-sm flex-grow sm:flex-grow-0"
                        on:click={pasteFrequency}
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          class="h-4 w-4 mr-2"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path
                            d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z"
                          />
                          <path
                            d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z"
                          />
                        </svg>
                        Paste Freq
                      </button>
                    </div>
                  </div>
                  <hr class="border-gray-600 my-2" />
                  <span class="text-xs text-gray-400"
                    >PhantomSDR+ | v{VERSION}</span
                  >
                </div>
              </div>
            {:else}{/if}
            <!--To disable Chatbox: Delte Code till above this here -->
          </div>
        </div>
        <footer class="mt-4 mb-4 text-center text-gray-400 text-sm">
          <!--  <span class="text-xs text-gray-400">PhantomSDR+ | v{VERSION}</span> -->
        </footer>
      </div>

      <!-- Users modal — mobile (tap anywhere to close) -->
      {#if showUsers}
        <div
          class="modal-backdrop"
          on:click={closeUsers}
          style="cursor:pointer;"
        >
          <div
            id="users-dialog-mobile"
            role="dialog"
            aria-modal="true"
            aria-labelledby="users-title-mobile"
            class="modal-right"
          >
            <div class="modal-header">
              <h2 id="users-title-mobile">👥 Connected Users</h2>
              <button
                class="close-btn"
                on:click={closeUsers}
                title="Close window"
                aria-label="Close">×</button
              >
            </div>
            <div
              class="modal-body"
              style="padding:0; overflow:hidden; position:relative;"
            >
              <iframe
                src="{siteIP}/users.html"
                title="Connected Users"
                style="width:100%; height:420px; border:none; background:#0f172a; display:block;"
                loading="lazy"
              ></iframe>
            </div>
            <div class="modal-body" style="padding:4px 10px;">
              <p class="hint">Tap <b>×</b> or outside this window to close.</p>
            </div>
          </div>
        </div>
      {/if}
    {/if}
  </div>
</main>

<svelte:head>
  <link
    href="https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap"
    rel="stylesheet"
  />
  <link
    href="https://fonts.googleapis.com/css2?family=Courier+Prime:ital,wght@0,400;0,700;1,400;1,700&display=swap"
    rel="stylesheet"
  />
</svelte:head>

<style global lang="postcss">
  /* Plain text everywhere - no shadow effect */
  * {
    text-shadow: none;
  }

  body {
    font-family: "Inter", sans-serif;
    background-color: #f0f0f0;
    color: #333;
    line-height: 1.6;
    margin: 0;
    padding: 0;
  }

  .container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 20px;
  }

  #hero {
    background-color: #2c3e50;
    color: #ecf0f1;
    padding: 100px 0;
    text-align: center;
  }

  #tagline {
    font-size: 2rem;
    margin-bottom: 2rem;
  }

  .btn {
    display: inline-block;
    padding: 12px 24px;
    background-color: #e74c3c;
    color: #fff;
    text-decoration: none;
    border-radius: 5px;
    font-weight: 700;
    transition: background-color 0.3s ease;
  }

  .btn:hover {
    background-color: #c0392b;
  }

  :root {
    font-family:
      -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu,
      Cantarell, "Open Sans", "Helvetica Neue", sans-serif;
  }

  @media (min-width: 1380px) {
    #chat-box {
      min-width: var(--middle-column-width);
    }
    #chat-column {
      align-items: center;
    }
    /* Left + middle + right panels together match the chat box: 1380px,
       edge to edge with it (px-5 dropped so the panels, not the padding,
       make up the width). */
    #middle-column {
      width: 1380px;
      flex-shrink: 0;
      padding-left: 0;
      padding-right: 0;
    }
    /* Outer panels share one width; the middle panel takes the rest (604px).
       Padding is trimmed a little so everything fits: the left panel's
       minimum drops to ~388px, and the middle needs ~594px with the analog
       meter (300px canvas) and ~572px with the digital one. */
    #middle-column > .screw-col-1,
    #middle-column > .screw-col-3 {
      flex: 0 0 388px;
    }
    #middle-column > .screw-col-1 {
      padding: 1rem;
    }
    #middle-column > .screw-col-2 {
      flex: 1 1 auto;
      padding-left: 1.25rem;
      padding-right: 1.25rem;
    }
    #middle-column #smeter-tut {
      padding-left: 0.75rem;
      padding-right: 0.75rem;
    }
  }

  /* ── Spacing between the stacked page blocks ────────────────────────────
     The page stack is #chat-column (despite the name), and its blocks are
     #chat-box, the waterfall, and #middle-column. Each gap is 3px, and each
     is written in exactly one place so the three cannot drift apart again:

       top of page -> #chat-box      the page wrapper's own padding-top
       #chat-box   -> waterfall      #outer-waterfall-container's margin-top
       waterfall   -> #middle-column #middle-column's padding-top

     Set by id because the markup exists once per layout variant, and because
     an id outranks the Tailwind margin classes without needing !important. */
  #chat-column {
    padding-top: 0;
    padding-bottom: 0;
  }
  /* Its mb-2 sat between the chat panel and the waterfall, on top of the
     waterfall's own margin. */
  #chat-box {
    margin-bottom: 0;
  }
  #outer-waterfall-container {
    margin-top: 3px;
  }
  #middle-column {
    padding-top: 3px;
  }

  .full-screen-container {
    display: flex;
    flex-direction: row;
    height: 100vh;
  }

  .side-nav {
    flex-basis: 250px;
    overflow-y: auto;
    background-color: #333;
    color: #fff;
  }

  .main-content {
    flex-grow: 1;
    overflow-y: auto;
    padding: 20px;
    max-width: 1380px;
    margin: auto;
  }

  .tab-content {
    display: none;
  }

  .tab-content.active {
    display: block;
  }

  .cursor-frequency-tooltip {
    background-color: rgba(0, 0, 0, 0.85);
    color: #00ff00;
    padding: 4px 8px;
    border-radius: 4px;
    font-family: "Courier New", monospace;
    font-size: 14px;
    font-weight: bold;
    border: 1px solid #00ff00;
    box-shadow: 0 2px 8px rgba(0, 255, 0, 0.3);
    white-space: nowrap;
  }

  :global(body.light-mode) {
    background-color: #a9a9a9;
    transition: background-color 0.3s;
  }
  :global(body) {
    background-color: #212121;
  }

  main {
    text-align: center;
    margin: 0 auto;
  }
  .thick-line-through {
    text-decoration-thickness: 2px;
  }

  .basic-button {
    @apply text-blue-500 border border-blue-500 font-bold uppercase transition-all duration-100 text-center text-xs px-2 py-1
            peer-checked:bg-blue-600 peer-checked:text-white;
  }
  .basic-button:hover {
    @apply border-blue-400 text-white;
  }

  .click-button {
    @apply text-blue-500 border border-blue-500 font-bold uppercase transition-all duration-100 text-center text-xs px-2 py-1;
  }
  .click-button:active {
    @apply bg-blue-600 text-white;
  }

  .custom-scrollbar::-webkit-scrollbar {
    width: 12px;
    background-color: transparent;
  }

  .custom-scrollbar::-webkit-scrollbar-track {
    background-color: rgba(255, 255, 255, 0.05);
    border-radius: 10px;
    margin: 5px 0;
  }

  .custom-scrollbar::-webkit-scrollbar-thumb {
    background-color: rgba(255, 255, 255, 0.2);
    border-radius: 10px;
    border: 3px solid rgba(0, 0, 0, 0.2);
    background-clip: padding-box;
  }

  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background-color: rgba(255, 255, 255, 0.3);
  }

  .custom-scrollbar {
    scrollbar-width: thin;
    scrollbar-color: rgba(255, 255, 255, 0.2) rgba(255, 255, 255, 0.05);
  }

  .scrollbar-container {
    padding-right: 12px;
    box-sizing: content-box;
  }

  /* Here you can Change the Background of WebSDR, Picture must be in assets folder*/
  .bg-custom-dark {
    /* background-color: #1c1c1c; /* Original: A very dark gray with a tiny hint of warmth */
    background: url("./assets/background.jpg") no-repeat center center fixed;
    background-size: cover;
  }

  .glass-username {
    background: rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(5px);
    display: inline-block;
    max-width: 150px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .glass-button {
    background: rgba(255, 255, 255, 0.05);
    backdrop-filter: blur(8px);
    border: 1px solid rgba(255, 255, 255, 0.1);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    transition: all 0.3s ease;
  }

  .glass-button:hover {
    background: rgba(255, 255, 255, 0.1);
    border-color: rgba(255, 255, 255, 0.2);
  }

  .glass-slider {
    -webkit-appearance: none;
    appearance: none;
    width: 100%;
    height: 10px;
    background: transparent;
    outline: none;
    border-radius: 999px;
    cursor: pointer;
  }

  .glass-slider::-webkit-slider-runnable-track {
    height: 10px;
    border-radius: 999px;
    background: linear-gradient(180deg, #5c5c5c 0%, #2e2e2e 45%, #171717 100%);
    border: 1px solid #0d0d0d;
    box-shadow:
      inset 0 2px 4px rgba(255, 255, 255, 0.12),
      inset 0 -3px 5px rgba(0, 0, 0, 0.78),
      0 1px 1px rgba(255, 255, 255, 0.06),
      0 3px 8px rgba(0, 0, 0, 0.55);
  }

  .glass-slider::-moz-range-track {
    height: 10px;
    border-radius: 999px;
    background: linear-gradient(180deg, #5c5c5c 0%, #2e2e2e 45%, #171717 100%);
    border: 1px solid #0d0d0d;
    box-shadow:
      inset 0 2px 4px rgba(255, 255, 255, 0.12),
      inset 0 -3px 5px rgba(0, 0, 0, 0.78),
      0 1px 1px rgba(255, 255, 255, 0.06),
      0 3px 8px rgba(0, 0, 0, 0.55);
  }

  .glass-slider:hover::-webkit-slider-thumb {
    transform: scale(1.1);
    box-shadow:
      inset 0 2px 4px rgba(255, 255, 255, 0.98),
      inset 0 -3px 5px rgba(0, 0, 0, 0.34),
      0 6px 12px rgba(0, 0, 0, 0.9),
      0 2px 4px rgba(0, 0, 0, 0.65),
      0 0 0 1px rgba(255, 255, 255, 0.14);
  }

  .glass-slider:hover::-moz-range-thumb {
    transform: scale(1.1);
    box-shadow:
      inset 0 2px 4px rgba(255, 255, 255, 0.98),
      inset 0 -3px 5px rgba(0, 0, 0, 0.34),
      0 6px 12px rgba(0, 0, 0, 0.9),
      0 2px 4px rgba(0, 0, 0, 0.65),
      0 0 0 1px rgba(255, 255, 255, 0.14);
  }

  .glass-slider:active::-webkit-slider-thumb {
    transform: translateY(2px) scale(0.95);
    box-shadow:
      inset 0 2px 5px rgba(0, 0, 0, 0.4),
      inset 0 1px 2px rgba(255, 255, 255, 0.55),
      0 1px 3px rgba(0, 0, 0, 0.9);
  }

  .glass-slider:active::-moz-range-thumb {
    transform: translateY(2px) scale(0.95);
    box-shadow:
      inset 0 2px 5px rgba(0, 0, 0, 0.4),
      inset 0 1px 2px rgba(255, 255, 255, 0.55),
      0 1px 3px rgba(0, 0, 0, 0.9);
  }

  .glass-slider:focus-visible::-webkit-slider-thumb {
    transform: scale(1.08);
    box-shadow:
      inset 0 2px 4px rgba(255, 255, 255, 0.98),
      inset 0 -3px 5px rgba(0, 0, 0, 0.34),
      0 0 0 2px rgba(255, 255, 255, 0.18),
      0 0 0 4px rgba(59, 130, 246, 0.5),
      0 5px 10px rgba(0, 0, 0, 0.9);
  }

  .glass-slider:focus-visible::-moz-range-thumb {
    transform: scale(1.08);
    box-shadow:
      inset 0 2px 4px rgba(255, 255, 255, 0.98),
      inset 0 -3px 5px rgba(0, 0, 0, 0.34),
      0 0 0 2px rgba(255, 255, 255, 0.18),
      0 0 0 4px rgba(59, 130, 246, 0.5),
      0 5px 10px rgba(0, 0, 0, 0.9);
  }

  .glass-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    cursor: pointer;
    /* Metallic sphere: dark base → mid grey → bright top */
    background:
      radial-gradient(
        circle at 38% 32%,
        rgba(255, 255, 255, 0.92) 0%,
        rgba(220, 220, 220, 0.72) 20%,
        rgba(160, 160, 160, 0.55) 45%,
        rgba(90, 90, 90, 0.8) 72%,
        rgba(30, 30, 30, 0.95) 100%
      ),
      linear-gradient(180deg, #e8e8e8 0%, #b0b0b0 48%, #6a6a6a 100%);
    border: 1px solid rgba(0, 0, 0, 0.45);
    box-shadow:
      /* specular rim */
      inset 0 2px 3px rgba(255, 255, 255, 0.9),
      /* inner depth */ inset 0 -3px 5px rgba(0, 0, 0, 0.3),
      /* main drop shadow — gives the "lifted off the track" look */ 0 4px 8px
        rgba(0, 0, 0, 0.85),
      /* soft outer glow */ 0 1px 2px rgba(0, 0, 0, 0.6),
      /* thin bright ring */ 0 0 0 1px rgba(255, 255, 255, 0.1);
    transition:
      transform 0.1s ease,
      box-shadow 0.1s ease;
    margin-top: -6px; /* keep vertically centred on the taller thumb */
  }

  /* Firefox base thumb */
  .glass-slider::-moz-range-thumb {
    -moz-appearance: none;
    appearance: none;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    cursor: pointer;
    background:
      radial-gradient(
        circle at 38% 32%,
        rgba(255, 255, 255, 0.92) 0%,
        rgba(220, 220, 220, 0.72) 20%,
        rgba(160, 160, 160, 0.55) 45%,
        rgba(90, 90, 90, 0.8) 72%,
        rgba(30, 30, 30, 0.95) 100%
      ),
      linear-gradient(180deg, #e8e8e8 0%, #b0b0b0 48%, #6a6a6a 100%);
    border: 1px solid rgba(0, 0, 0, 0.45);
    box-shadow:
      inset 0 2px 3px rgba(255, 255, 255, 0.9),
      inset 0 -3px 5px rgba(0, 0, 0, 0.3),
      0 4px 8px rgba(0, 0, 0, 0.85),
      0 1px 2px rgba(0, 0, 0, 0.6),
      0 0 0 1px rgba(255, 255, 255, 0.1);
    transition:
      transform 0.1s ease,
      box-shadow 0.1s ease;
  }

  .smeter-container {
    background-color: black;
    padding: 10px;
    border-radius: 5px;
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 310px;
    padding: 15px;
    background: #111;
    border-radius: 5px;
    position: relative;
    margin: 0 auto;
    box-shadow: 0 0 10px rgb(83 83 83 / 30%);
    font-family: "VT323", monospace;
  }

  .glass-slider::-moz-range-thumb {
    width: 18px;
    height: 18px;
    background: rgba(255, 255, 255, 0.8);
    cursor: pointer;
    border-radius: 50%;
  }

  /* FT8/FT4/FT2 spot list.
     The header row in the markup and the rows built by _ftxRenderSpot() in
     audio.js share this template, so the column order must stay in step:
     Mode | dB | Hz | Message | Locator | Distance */
  .ftx-grid {
    display: grid;
    grid-template-columns: 2.6rem 2.6rem 3.4rem 3rem minmax(
        0,
        1fr
      ) 4.6rem 4.6rem;
    gap: 0.5rem;
    align-items: center;
    /* Narrow screens scroll the whole grid sideways in the list's existing
       overflow container rather than dropping columns. */
    min-width: 26rem;
  }

  .ftx-head {
    position: sticky;
    top: 0;
    z-index: 1;
    padding: 0 0.5rem 0.25rem; /* horizontal padding matches the rows' p-2 */
    margin-bottom: 0.25rem;
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: #9ca3af;
    background: rgba(17, 24, 39, 0.85);
    backdrop-filter: blur(4px);
    border-bottom: 1px solid rgba(156, 163, 175, 0.3);
  }

  .ftx-num {
    text-align: right;
    font-variant-numeric: tabular-nums;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  }

  .ftx-msg {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .glass-message {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    transition: background-color 0.3s;
  }

  .glass-message:hover {
    background: rgba(255, 255, 255, 0.1);
  }

  .glass-panel {
    background: rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.2);
    transition: all 0.3s ease;
  }

  .glass-panel:hover {
    background: rgba(255, 255, 255, 0.15);
    transform: translateY(-5px);
    box-shadow: 0 10px 20px rgba(0, 0, 0, 0.2);
  }

  .glass-input {
    background: rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(5px);
    border: 1px solid rgba(255, 255, 255, 0.2);
  }

  .control-group {
    display: flex;
    justify-content: center;
    align-items: center;
    width: 100%;
    max-width: 400px;
  }

  .slider-container {
    flex-grow: 1;
    margin: 0 15px;
    width: 200px;
  }

  .value-display {
    width: 50px;
    text-align: right;
  }

  .glass-button.active {
    background: linear-gradient(
      135deg,
      rgba(50, 50, 80, 0.8),
      rgba(60, 50, 80, 0.8)
    );
    border-color: rgba(120, 100, 180, 0.4);
    box-shadow:
      0 2px 4px rgba(0, 0, 0, 0.2),
      inset 0 1px 2px rgba(150, 130, 200, 0.1);
  }

  .glass-select {
    appearance: none;
    -webkit-appearance: none;
    -moz-appearance: none;
    background:
      linear-gradient(
        180deg,
        rgba(255, 255, 255, 0.14),
        rgba(255, 255, 255, 0.03)
      ),
      linear-gradient(180deg, rgba(58, 61, 78, 0.96), rgba(26, 28, 38, 0.98));
    backdrop-filter: blur(8px);
    border: 1px solid rgba(255, 255, 255, 0.16);
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.14),
      inset 0 -2px 3px rgba(0, 0, 0, 0.45),
      0 3px 0 rgba(0, 0, 0, 0.55),
      0 6px 12px rgba(0, 0, 0, 0.28);
    transition:
      box-shadow 0.18s ease,
      transform 0.18s ease,
      border-color 0.18s ease,
      background 0.18s ease;
  }

  .glass-select:hover {
    border-color: rgba(255, 255, 255, 0.22);
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.16),
      inset 0 -2px 3px rgba(0, 0, 0, 0.48),
      0 4px 0 rgba(0, 0, 0, 0.6),
      0 8px 14px rgba(0, 0, 0, 0.32);
  }

  .glass-select:focus {
    background:
      linear-gradient(
        180deg,
        rgba(255, 255, 255, 0.18),
        rgba(255, 255, 255, 0.05)
      ),
      linear-gradient(180deg, rgba(66, 69, 88, 0.98), rgba(30, 32, 44, 1));
    border-color: rgba(99, 102, 241, 0.45);
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.18),
      inset 0 -2px 3px rgba(0, 0, 0, 0.48),
      0 2px 0 rgba(0, 0, 0, 0.62),
      0 0 0 2px rgba(99, 102, 241, 0.2),
      0 8px 16px rgba(0, 0, 0, 0.3);
    outline: none;
  }

  .glass-select:active {
    transform: translateY(1px);
    box-shadow:
      inset 0 2px 2px rgba(255, 255, 255, 0.08),
      inset 0 -3px 4px rgba(0, 0, 0, 0.52),
      0 2px 0 rgba(0, 0, 0, 0.58),
      0 4px 8px rgba(0, 0, 0, 0.26);
  }

  .glass-select option {
    background-color: #2a2c3e;
  }

  .glass-toggle-button {
    background: rgba(255, 255, 255, 0.05);
    backdrop-filter: blur(8px);
    border: 1px solid rgba(255, 255, 255, 0.1);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    transition: all 0.3s ease;
    min-width: 48px;
  }

  .glass-toggle-button:hover {
    background: rgba(255, 255, 255, 0.1);
    border-color: rgba(255, 255, 255, 0.2);
  }

  .glass-toggle-button.active {
    background: rgba(16, 185, 129, 0.2);
    border-color: rgba(16, 185, 129, 0.4);
  }

  .slide-transition {
    transition: max-height 300ms cubic-bezier(0.23, 1, 0.32, 1);
    overflow: hidden;
  }

  .emoji-btn-container {
    position: relative;
  }
  .emoji-picker-wrapper {
    position: absolute;
    bottom: calc(100% + 8px);
    right: 0;
    z-index: 9999;
  }
  emoji-picker {
    --background: #1a1a2e;
    --border-color: rgba(255, 255, 255, 0.15);
    --emoji-size: 1.2rem;
    --num-columns: 8;
    width: 300px;
    height: 350px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
    border-radius: 12px;
    overflow: hidden;
  }

  .chat-input {
    -webkit-appearance: none;
    -moz-appearance: none;
    appearance: none;
    background-color: rgba(255, 255, 255, 0.1) !important;
    color: white !important;
    border: 1px solid rgba(255, 255, 255, 0.2) !important;
  }

  .chat-input::placeholder {
    color: rgba(255, 255, 255, 0.5);
  }

  .chat-button {
    -webkit-appearance: none;
    -moz-appearance: none;
    appearance: none;
    background-color: rgba(255, 255, 255, 0.1) !important;
    color: white !important;
    border: 1px solid rgba(255, 255, 255, 0.2) !important;
    font-size: 14px;
  }

  @supports (-webkit-touch-callout: none) {
    .chat-input,
    .chat-button {
      background-color: rgba(255, 255, 255, 0.1) !important;
      color: white !important;
      border: 1px solid rgba(255, 255, 255, 0.2) !important;
    }
  }

  .toggle-switch {
    position: relative;
    display: inline-block;
    width: 44px;
    height: 24px;
  }

  .toggle-switch input {
    opacity: 0;
    width: 0;
    height: 0;
  }

  .toggle-slider {
    position: absolute;
    cursor: pointer;
    inset: 0;
    border-radius: 999px;
    background: linear-gradient(180deg, #595959 0%, #373737 52%, #1d1d1d 100%);
    border: 1px solid #111;
    box-shadow:
      inset 0 2px 6px rgba(0, 0, 0, 0.95),
      inset 0 -1px 1px rgba(255, 255, 255, 0.05),
      0 3px 6px rgba(0, 0, 0, 0.8);
    transition:
      background 0.12s ease,
      box-shadow 0.12s ease,
      transform 0.12s ease,
      filter 0.12s ease;
    overflow: hidden;
  }

  .toggle-slider::after {
    content: "";
    position: absolute;
    left: 4px;
    right: 4px;
    top: 3px;
    height: 35%;
    border-radius: 999px;
    background: linear-gradient(
      180deg,
      rgba(255, 255, 255, 0.22),
      rgba(255, 255, 255, 0.02)
    );
    pointer-events: none;
  }

  .toggle-slider:before {
    position: absolute;
    content: "";
    width: 18px;
    height: 18px;
    left: 2px;
    top: 2px;
    border-radius: 50%;
    background: linear-gradient(180deg, #f0f0f0 0%, #cdcdcd 48%, #8f8f8f 100%);
    border: 1px solid rgba(0, 0, 0, 0.38);
    box-shadow:
      inset 0 1px 2px rgba(255, 255, 255, 0.88),
      inset 0 -2px 3px rgba(0, 0, 0, 0.18),
      0 2px 4px rgba(0, 0, 0, 0.9);
    transition:
      transform 0.12s ease,
      top 0.12s ease,
      box-shadow 0.12s ease;
    z-index: 1;
  }

  .toggle-switch:hover .toggle-slider {
    filter: brightness(1.03);
    box-shadow:
      inset 0 2px 6px rgba(0, 0, 0, 0.98),
      inset 0 -1px 1px rgba(255, 255, 255, 0.06),
      0 4px 7px rgba(0, 0, 0, 0.84);
  }

  .toggle-switch:active .toggle-slider {
    transform: translateY(3px);
    box-shadow:
      inset 0 3px 8px rgba(0, 0, 0, 1),
      0 1px 2px rgba(0, 0, 0, 0.82);
  }

  .toggle-switch:active .toggle-slider:before {
    top: 3px;
    box-shadow:
      inset 0 1px 2px rgba(255, 255, 255, 0.72),
      inset 0 -2px 4px rgba(0, 0, 0, 0.24),
      0 1px 2px rgba(0, 0, 0, 0.9);
  }

  input:checked + .toggle-slider {
    background: linear-gradient(180deg, #4bb7ff 0%, #2196f3 50%, #0f6fbd 100%);
    box-shadow:
      inset 0 3px 8px rgba(0, 0, 0, 1),
      inset 0 1px 2px rgba(255, 255, 255, 0.08),
      0 1px 2px rgba(0, 0, 0, 0.8),
      0 0 8px rgba(33, 150, 243, 0.2);
    transform: translateY(2px);
  }

  input:focus + .toggle-slider {
    box-shadow:
      inset 0 2px 6px rgba(0, 0, 0, 0.95),
      inset 0 -1px 1px rgba(255, 255, 255, 0.05),
      0 3px 6px rgba(0, 0, 0, 0.8),
      0 0 0 2px rgba(33, 150, 243, 0.22);
  }

  input:checked + .toggle-slider:before {
    transform: translateX(20px) translateY(1px);
    top: 2px;
    box-shadow:
      inset 0 1px 2px rgba(255, 255, 255, 0.62),
      inset 0 -2px 4px rgba(0, 0, 0, 0.24),
      0 1px 2px rgba(0, 0, 0, 0.9);
  }

  @media screen and (min-width: 1380px) {
    #outer-waterfall-container {
      min-width: 1380px;
    }
  }

  /* Everything below used to sit inside the 1380px media query above, which
     left the dialogs (shortcuts / users / stats / system stats) completely
     unstyled on anything narrower than a desktop — they rendered as bare text
     in the page flow.  The rules are global now; the desktop 50% / 75% widths
     are restored in the min-width block further down. */

  /* --- Modal Header and close --- */
  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: #111827;
    border-bottom: 2px solid #1e293b;
    margin: auto;
    width: 96%;
    max-width: 900px;
    border: 3px solid #111827;
    padding: 10px;
  }
  .close-btn {
    background: transparent;
    border: none;
    color: #9ca3af;
    font-size: 1.2rem;
    line-height: 1;
    cursor: pointer;
    transition:
      transform 0.15s ease,
      color 0.15s ease;
  }
  .close-btn:hover {
    color: #e5e7eb;
    transform: scale(1.2);
  }
  /* --- Modal Body --- */
  .modal-body {
    flex: 1;
    overflow-y: auto;
    overflow-x: auto;
    background: #0f172a;
    font-size: 0.7rem;
    line-height: 1.2;
    margin: auto;
    width: 96%;
    max-width: 900px;
    max-height: 70vh;
    border: 3px solid #111827;
    padding: 10px;
  }
  /* --- Table --- */
  .shortcuts-table {
    width: 100%;
    border-collapse: collapse;
    margin: 0;
  }
  .shortcuts-table td {
    padding: 0.18rem 0.22rem;
    border-bottom: 1px solid #1f2a38;
    font-size: 0.7rem;
    line-height: 1.22;
    text-align: left;
  }
  .shortcuts-table tr:last-child td {
    border-bottom: none;
  }
  /* Left column: */
  .shortcuts-table td:first-child {
    width: 65%;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 0.8rem;
  }
  /* Right column */
  .shortcuts-table td:last-child {
    width: 35%;
  }
  /* Hint text */
  .hint {
    font-size: 0.8rem;
    color: #9ca3af;
    text-align: right;
  }
  /* kbd */
  kbd {
    background: #111827;
    border: 1px solid #374151;
    border-radius: 4px;
    padding: 0 0.25rem;
    font-size: 0.72rem;
  }

  /*Hide Input Number Arrows*/
  /* Chrome, Safari, Edge, Opera */
  input::-webkit-outer-spin-button,
  input::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }

  /* Firefox */
  input[type="number"] {
    -moz-appearance: textfield;
  }

  /* Desktop widths, unchanged from before. */
  @media screen and (min-width: 1380px) {
    .modal-header,
    .modal-body {
      width: 50%;
      max-width: none;
    }
    .modal-body {
      max-height: none;
    }
    /* --- Users & Stats wider modals --- */
    #users-dialog .modal-header,
    #users-dialog .modal-body,
    #stats-dialog .modal-header,
    #stats-dialog .modal-body {
      width: 75%;
    }
  }

  /* Global 3D button effect */
  button {
    position: relative;
    overflow: hidden;
    border-radius: 0.5rem;
    transition:
      transform 0.08s ease,
      box-shadow 0.08s ease,
      filter 0.12s ease;
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.18),
      inset 0 -1px 0 rgba(0, 0, 0, 0.22),
      0 1px 0 rgba(255, 255, 255, 0.08),
      0 4px 0 rgba(0, 0, 0, 0.38),
      0 6px 14px rgba(0, 0, 0, 0.28);
  }

  button::before {
    content: "";
    position: absolute;
    left: 1px;
    right: 1px;
    top: 1px;
    height: 46%;
    border-radius: calc(0.5rem - 1px);
    background: linear-gradient(
      to bottom,
      rgba(255, 255, 255, 0.24),
      rgba(255, 255, 255, 0.02)
    );
    pointer-events: none;
    opacity: 0.95;
  }

  button:hover:not(:disabled) {
    transform: translateY(-1px);
    filter: brightness(1.03);
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.2),
      inset 0 -1px 0 rgba(0, 0, 0, 0.24),
      0 1px 0 rgba(255, 255, 255, 0.1),
      0 5px 0 rgba(0, 0, 0, 0.4),
      0 8px 16px rgba(0, 0, 0, 0.32);
  }

  button:active:not(:disabled) {
    transform: translateY(3px);
    box-shadow:
      inset 0 2px 4px rgba(0, 0, 0, 0.28),
      inset 0 1px 0 rgba(255, 255, 255, 0.08),
      0 1px 0 rgba(0, 0, 0, 0.45),
      0 2px 6px rgba(0, 0, 0, 0.28);
  }

  button:focus-visible {
    outline: none;
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.18),
      inset 0 -1px 0 rgba(0, 0, 0, 0.22),
      0 4px 0 rgba(0, 0, 0, 0.38),
      0 6px 14px rgba(0, 0, 0, 0.28),
      0 0 0 2px rgba(255, 255, 255, 0.12),
      0 0 0 4px rgba(59, 130, 246, 0.45);
  }

  button:disabled {
    opacity: 0.65;
    cursor: not-allowed;
    transform: none;
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.12),
      inset 0 -1px 0 rgba(0, 0, 0, 0.16),
      0 2px 0 rgba(0, 0, 0, 0.28),
      0 4px 8px rgba(0, 0, 0, 0.16);
  }

  /* ── 3D corner screws (flat-head, random slot angle per corner) ────────── */
  .screw-panel {
    position: relative;
    /* Bead-blasted anodized finish: fine matte grain from an inline SVG noise
       tile (no image file, no external request). Flat -- no sheen gradients --
       over a slightly darker ground than the panels' bg-gray-800. */
    background-color: #242b35;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23g)' opacity='0.38'/%3E%3C/svg%3E");
    background-size: 160px 160px;
    background-blend-mode: overlay;
    --screw-head: radial-gradient(
      circle closest-side at 50% 50%,
      #ededee 0%,
      #d0d1d4 26%,
      #a6a7ad 50%,
      #77787f 72%,
      #4f5057 87%,
      #313137 96%,
      rgba(18, 18, 22, 0.92) 99%,
      transparent 100%
    );
    --screw-spec: radial-gradient(
      circle closest-side at 62% 34%,
      rgba(255, 255, 255, 0.75) 0%,
      rgba(255, 255, 255, 0.12) 34%,
      rgba(255, 255, 255, 0) 55%
    );
    /* one straight slot per corner, each at its own "hand-driven" angle */
    --screw-slot-tl: linear-gradient(
      27deg,
      transparent 41%,
      rgba(255, 255, 255, 0.08) 43%,
      rgba(15, 15, 18, 0.8) 45%,
      rgba(15, 15, 18, 0.8) 55%,
      rgba(255, 255, 255, 0.16) 57%,
      transparent 59%
    );
    --screw-slot-tr: linear-gradient(
      112deg,
      transparent 41%,
      rgba(255, 255, 255, 0.08) 43%,
      rgba(15, 15, 18, 0.8) 45%,
      rgba(15, 15, 18, 0.8) 55%,
      rgba(255, 255, 255, 0.16) 57%,
      transparent 59%
    );
    --screw-slot-bl: linear-gradient(
      66deg,
      transparent 41%,
      rgba(255, 255, 255, 0.08) 43%,
      rgba(15, 15, 18, 0.8) 45%,
      rgba(15, 15, 18, 0.8) 55%,
      rgba(255, 255, 255, 0.16) 57%,
      transparent 59%
    );
    --screw-slot-br: linear-gradient(
      143deg,
      transparent 41%,
      rgba(255, 255, 255, 0.08) 43%,
      rgba(15, 15, 18, 0.8) 45%,
      rgba(15, 15, 18, 0.8) 55%,
      rgba(255, 255, 255, 0.16) 57%,
      transparent 59%
    );
  }
  .screw-panel::after {
    content: "";
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 4;
    background-repeat: no-repeat;
    filter: drop-shadow(-0.5px 1px 1.2px rgba(0, 0, 0, 0.55));
    /* per corner: slot (11px) over specular + metal head (15px) */
    background-image:
      var(--screw-slot-tl), var(--screw-spec), var(--screw-head),
      var(--screw-slot-tr), var(--screw-spec), var(--screw-head),
      var(--screw-slot-bl), var(--screw-spec), var(--screw-head),
      var(--screw-slot-br), var(--screw-spec), var(--screw-head);
    background-size:
      11px 11px,
      15px 15px,
      15px 15px,
      11px 11px,
      15px 15px,
      15px 15px,
      11px 11px,
      15px 15px,
      15px 15px,
      11px 11px,
      15px 15px,
      15px 15px;
    background-position:
      left 10px top 10px,
      left 8px top 8px,
      left 8px top 8px,
      right 10px top 10px,
      right 8px top 8px,
      right 8px top 8px,
      left 10px bottom 10px,
      left 8px bottom 8px,
      left 8px bottom 8px,
      right 10px bottom 10px,
      right 8px bottom 8px,
      right 8px bottom 8px;
  }
  /* per-column screw removal so the three columns join cleanly */
  /* column 1: keep top-left & bottom-left, remove top-right & bottom-right */
  .screw-col-1::after {
    background-image:
      var(--screw-slot-tl), var(--screw-spec), var(--screw-head),
      var(--screw-slot-bl), var(--screw-spec), var(--screw-head);
    background-size:
      11px 11px,
      15px 15px,
      15px 15px,
      11px 11px,
      15px 15px,
      15px 15px;
    background-position:
      left 10px top 10px,
      left 8px top 8px,
      left 8px top 8px,
      left 10px bottom 10px,
      left 8px bottom 8px,
      left 8px bottom 8px;
  }
  /* column 2: remove all screws */
  .screw-col-2::after {
    background-image: none;
  }
  /* column 3: keep top-right & bottom-right, remove top-left & bottom-left */
  .screw-col-3::after {
    background-image:
      var(--screw-slot-tr), var(--screw-spec), var(--screw-head),
      var(--screw-slot-br), var(--screw-spec), var(--screw-head);
    background-size:
      11px 11px,
      15px 15px,
      15px 15px,
      11px 11px,
      15px 15px,
      15px 15px;
    background-position:
      right 10px top 10px,
      right 8px top 8px,
      right 8px top 8px,
      right 10px bottom 10px,
      right 8px bottom 8px,
      right 8px bottom 8px;
  }

  /* ── Plate edges: the panel reads as a metal sheet bolted onto the chassis ──
     A chamfered lip on all four sides (lit from above, falling away below),
     plus a compression shadow drawn tight around each fastener that eases off
     toward mid-span. Sits under the screw heads (z-index 3 vs 4) and never
     eats clicks. Per-column variants drop the edges that face a neighbour, so
     the three joined columns still read as one continuous plate. */
  .screw-panel::before {
    content: "";
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 3;
    border-radius: inherit;
    background-repeat: no-repeat;
    --edge-top: linear-gradient(
      180deg,
      rgba(255, 255, 255, 0.075),
      rgba(255, 255, 255, 0)
    );
    --edge-bottom: linear-gradient(0deg, rgba(0, 0, 0, 0.42), rgba(0, 0, 0, 0));
    --edge-left: linear-gradient(90deg, rgba(0, 0, 0, 0.34), rgba(0, 0, 0, 0));
    --edge-right: linear-gradient(
      270deg,
      rgba(255, 255, 255, 0.04),
      rgba(255, 255, 255, 0)
    );
    --clamp: radial-gradient(
      circle closest-side at 50% 50%,
      rgba(0, 0, 0, 0.34),
      rgba(0, 0, 0, 0.12) 55%,
      rgba(0, 0, 0, 0) 100%
    );
    background-image:
      var(--edge-top), var(--edge-bottom), var(--edge-left), var(--edge-right),
      var(--clamp), var(--clamp), var(--clamp), var(--clamp);
    background-size:
      100% 9px,
      100% 11px,
      9px 100%,
      9px 100%,
      54px 54px,
      54px 54px,
      54px 54px,
      54px 54px;
    background-position:
      left top,
      left bottom,
      left top,
      right top,
      left -12px top -12px,
      right -12px top -12px,
      left -12px bottom -12px,
      right -12px bottom -12px;
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.1),
      inset 0 -1px 0 rgba(0, 0, 0, 0.6),
      inset 1px 0 0 rgba(0, 0, 0, 0.45),
      inset -1px 0 0 rgba(255, 255, 255, 0.045);
  }
  /* column 1: open on the right, so no right lip and no right-hand clamps */
  .screw-col-1::before {
    background-image:
      var(--edge-top), var(--edge-bottom), var(--edge-left), var(--clamp),
      var(--clamp);
    background-size:
      100% 9px,
      100% 11px,
      9px 100%,
      54px 54px,
      54px 54px;
    background-position:
      left top,
      left bottom,
      left top,
      left -12px top -12px,
      left -12px bottom -12px;
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.1),
      inset 0 -1px 0 rgba(0, 0, 0, 0.6),
      inset 1px 0 0 rgba(0, 0, 0, 0.45);
  }
  /* column 2: open on both sides -- top and bottom lips only, no clamps */
  .screw-col-2::before {
    background-image: var(--edge-top), var(--edge-bottom);
    background-size:
      100% 9px,
      100% 11px;
    background-position:
      left top,
      left bottom;
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.1),
      inset 0 -1px 0 rgba(0, 0, 0, 0.6);
  }
  /* column 3: open on the left, so no left lip and no left-hand clamps */
  .screw-col-3::before {
    background-image:
      var(--edge-top), var(--edge-bottom), var(--edge-right), var(--clamp),
      var(--clamp);
    background-size:
      100% 9px,
      100% 11px,
      9px 100%,
      54px 54px,
      54px 54px;
    background-position:
      left top,
      left bottom,
      right top,
      right -12px top -12px,
      right -12px bottom -12px;
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.1),
      inset 0 -1px 0 rgba(0, 0, 0, 0.6),
      inset -1px 0 0 rgba(255, 255, 255, 0.045);
  }

  /* ── Recessed window: the black frequency / S-meter box reads as an opening
     cut into the metal plate and glazed, lit from the upper right like the
     panel around it. Light entering from the upper right lands on the bottom
     and left inner walls, so those carry the highlight; the top and right
     walls stay in shadow, which the black interior gives for free. ── */
  /* The frequency box is lifted just off pure black, so the wall shading
     inside the recess has something to darken against -- on #000 the top
     and right walls simply vanish. The decoder readouts already sit on
     gray-900, so they need no equivalent. */
  #smeter-tut {
    background-color: #0a0d12;
  }
  #smeter-tut,
  .recess-window {
    position: relative;
    /* faint sheen across the glass, falling away from the upper right */
    background-image: linear-gradient(
      215deg,
      rgba(255, 255, 255, 0.055) 0%,
      rgba(255, 255, 255, 0.014) 26%,
      rgba(255, 255, 255, 0) 48%
    );
    box-shadow:
      /* the cut edge itself */
      0 0 0 1px rgba(0, 0, 0, 0.92),
      /* the recess shades the metal above it and to its right */ 0 -3px
        8px -2px rgba(0, 0, 0, 0.75),
      4px 0 8px -3px rgba(0, 0, 0, 0.6),
      /* and the metal lip below and left of the opening catches the light */ 0
        2px 1px -1px rgba(255, 255, 255, 0.09),
      -1px 1px 0 rgba(255, 255, 255, 0.045),
      /* wall thickness: the top and right walls fall away into shadow */ inset
        0 7px 9px -7px rgba(0, 0, 0, 0.95),
      inset -7px 0 9px -7px rgba(0, 0, 0, 0.85),
      /* the bottom and left walls take the light, hard edge then falloff */
      inset 0 -1px 0 rgba(255, 255, 255, 0.13),
      inset 1px 0 0 rgba(255, 255, 255, 0.075),
      inset 0 -3px 3px -2px rgba(255, 255, 255, 0.16),
      inset 3px 0 3px -2px rgba(255, 255, 255, 0.09);
  }

  /* ── Glass window: the Decoder ID readout. Same panel and the same light
     source from the upper right, but its contents sit BEHIND a pane rather
     than in an open recess. So the ground goes almost black, the opening is
     darkened by the glass itself, and a specular streak runs across the top
     of everything -- including the text, because the pane is in front of it. ── */
  .glass-window {
    position: relative;
    /* own stacking context, so the pane's reflections sit above the readout
       without having to out-rank anything else on the page */
    isolation: isolate;
    background-color: #010307;
    /* Glass is not colourless when you look through enough of it: a cold
       green-blue body tint, deepest at the bottom where the pane is thickest.
       The last stop is a faint pool of light on the floor of the cavity --
       what little gets past the pane and bounces back off the bottom wall. */
    background-image: radial-gradient(
        120% 80% at 50% 118%,
        rgba(120, 168, 210, 0.07) 0%,
        rgba(120, 168, 210, 0) 62%
      ),
      linear-gradient(
        180deg,
        rgba(96, 136, 186, 0.09) 0%,
        rgba(28, 46, 66, 0.06) 40%,
        rgba(6, 18, 20, 0.05) 100%
      );
    /* The FRAME below varies top-to-bottom only, never left-to-right, so any
       vertical slice of the opening looks like any other. That is a departure
       from the panel's usual single light source at the upper right, which
       shades the left of a recess differently from the right -- the metal
       around the pane is meant to read the same across its width.
       The GLASS ITSELF does not follow that rule: see ::after, where the
       front surface is lit from the upper right like everything else on the
       console. A pane whose reflections have no direction reads as a dark
       card, and direction is most of what makes glass look like glass. */
    box-shadow:
      /* the cut edge itself */
      0 0 0 1px rgba(0, 0, 0, 0.96),
      /* The pane stands slightly PROUD of the panel rather than being sunk
         into it, so its raised top edge catches the light and it casts its own
         shadow downwards onto the metal below. Three stacked shadows rather
         than two: a tight contact line where the bezel actually meets the
         metal, then the penumbra opening out beneath it. A cast shadow that
         starts hard at the contact and softens with distance is most of what
         tells the eye the pane is standing off the panel. */
      0 -1px 0 rgba(255, 255, 255, 0.12),
      0 1px 1px -1px rgba(10, 13, 18, 0.9),
      0 3px 5px -1px rgba(18, 22, 28, 0.72),
      0 9px 18px -6px rgba(14, 18, 24, 0.62),
      /* Glass thickness. The pane is set into the opening, so the top wall
         throws a hard shadow across what is behind it -- this is the cue that
         says "behind", rather than "printed on". Deeper here than the open
         recesses elsewhere on the panel, because there is a pane's worth of
         material above the readout as well as a wall. */
      inset 0 14px 18px -9px rgba(0, 0, 0, 1),
      inset 0 4px 5px -2px rgba(0, 0, 0, 0.95),
      inset 0 2px 2px -1px rgba(0, 0, 0, 0.9),
      /* the bottom wall takes the light */ inset 0 -1px 0
        rgba(255, 255, 255, 0.16),
      inset 0 -4px 4px -3px rgba(255, 255, 255, 0.18),
      inset 0 -9px 9px -8px rgba(255, 255, 255, 0.1),
      /* the two side walls, treated alike */ inset 1px 0 0
        rgba(255, 255, 255, 0.055),
      inset -1px 0 0 rgba(255, 255, 255, 0.055),
      inset 6px 0 7px -6px rgba(0, 0, 0, 0.75),
      inset -6px 0 7px -6px rgba(0, 0, 0, 0.75),
      /* and the glass itself darkens the whole opening, deepest at the rim */
      inset 0 0 30px 9px rgba(0, 0, 0, 0.82);
  }
  /* The far side of the pane -- the inner mouth of the opening, seen THROUGH
     the glass and therefore drawn a few pixels in from the front edge. A real
     pane has two rims at slightly different depths, and that offset pair is
     what gives the frame its thickness; one rim on its own reads as a sticker.
     It sits under ::after so the front-surface reflections still run over it. */
  .glass-window::before {
    content: "";
    position: absolute;
    /* not symmetric: the far rim is seen from slightly above, so more of the
       bottom wall shows than of the top */
    inset: 3px 3px 4px;
    pointer-events: none;
    z-index: 3;
    border-radius: inherit;
    box-shadow:
      /* the rim line itself, softened because it is being read through glass */
      0 0 0 1px rgba(0, 0, 0, 0.55),
      /* The polished arris of the pane's cut edge. Not neutral white on both
         faces: thick glass splits what passes through it, so the top arris
         runs cold and the bottom one warm. The shift is far too small to
         read as colour -- it is only meant to stop the edge looking like a
         grey line -- but dispersion is the detail the eye uses to tell
         glass from perspex. */
      inset 0 1px 0 rgba(176, 214, 255, 0.055),
      inset 0 -1px 0 rgba(255, 228, 196, 0.075),
      /* refraction: the last millimetre before the edge bends the light and
         goes bright, which is why the border of real glass glows */
      0 0 5px 1px rgba(150, 190, 225, 0.06),
      inset 0 0 6px -1px rgba(160, 200, 235, 0.05);
  }
  /* The front surface of the pane, lying over the readout because that is
     where it physically is. Everything here is a reflection, not a light --
     nothing on this layer illuminates the text underneath, it only veils it.

     This is the layer that decides whether the window reads as glass or as a
     dark card, and the deciding property is DIRECTION. The console is lit
     from the upper right, so the sweep runs down-left across the pane, the
     glint sits in the upper-right corner, and the whole surface is brighter
     on that side. Reflections that only varied top-to-bottom looked painted
     on however carefully they were graded. ── */
  .glass-window::after {
    content: "";
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 4;
    border-radius: inherit;
    background-image:
      /* The corner glint: the light source itself, seen in the pane. Small,
         soft and offset into the corner rather than centred, because a
         reflected source is a shape at a place, not a general glow. */
      radial-gradient(
        62% 130% at 92% -12%,
        rgba(255, 255, 255, 0.135) 0%,
        rgba(226, 238, 255, 0.055) 38%,
        rgba(255, 255, 255, 0) 72%
      ),
      /* THE SWEEP. A broad band of reflected light crossing the pane on the
         diagonal. The two abrupt steps in it are the whole point: a real
         reflection has EDGES where the thing being reflected stops, and a
         smoothly graded band reads as a painted sheen no matter how subtle
         it is. Bright side up-right, running off the lower-left corner. */
      linear-gradient(
        118deg,
        rgba(255, 255, 255, 0) 0%,
        rgba(255, 255, 255, 0.012) 26%,
        rgba(255, 255, 255, 0.016) 40.5%,
        rgba(236, 246, 255, 0.062) 41%,
        rgba(236, 246, 255, 0.05) 52%,
        rgba(255, 255, 255, 0.014) 52.6%,
        rgba(255, 255, 255, 0.01) 74%,
        rgba(255, 255, 255, 0) 100%
      ),
      /* A second, much fainter sweep parallel to the first -- the back face
         of the pane returning the same reflection a little offset. Two
         parallel returns is how thick glass differs from a thin sheet. */
      linear-gradient(
        118deg,
        rgba(255, 255, 255, 0) 58%,
        rgba(210, 228, 248, 0.022) 63%,
        rgba(210, 228, 248, 0.016) 70%,
        rgba(255, 255, 255, 0.003) 70.6%,
        rgba(255, 255, 255, 0) 86%
      ),
      /* the narrow bright band along the top of the pane, and the softer
         grey one answering it along the bottom: a slightly convex face
         standing out of the panel rather than a flat sheet let into it */
      linear-gradient(
        180deg,
        rgba(255, 255, 255, 0.17) 0%,
        rgba(255, 255, 255, 0.06) 8%,
        rgba(255, 255, 255, 0) 20%
      ),
      linear-gradient(
        0deg,
        rgba(168, 178, 194, 0.115) 0%,
        rgba(132, 144, 162, 0.045) 8%,
        rgba(255, 255, 255, 0) 22%
      ),
      /* The room, very faintly, in the lower half. Even a clean pane is
         never empty down there -- it is what stops the bottom of the glass
         going dead once the sweep has passed. */
      linear-gradient(
        180deg,
        rgba(255, 255, 255, 0) 62%,
        rgba(158, 178, 202, 0.02) 78%,
        rgba(158, 178, 202, 0.032) 100%
      ),
      /* Fresnel: glass turns mirror-like where you see it at a grazing angle,
         so the perimeter picks up more than the middle. Weighted towards the
         lit side rather than centred, for the same reason as everything else
         on this layer. */
      radial-gradient(
        128% 128% at 68% 34%,
        rgba(255, 255, 255, 0) 54%,
        rgba(255, 255, 255, 0.022) 82%,
        rgba(255, 255, 255, 0.075) 100%
      );
    /* the polished arris along the pane's own top and bottom faces */
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.07),
      inset 0 -1px 0 rgba(255, 255, 255, 0.025);
  }

  /* ── Decoder windows: the same metal as the panels -- same ground colour,
     same bead-blasted grain, same four-sided chamfer lit from the upper
     right. No screws: these are let into the panel, not bolted onto it. ── */
  .decoder-window {
    position: relative;
    background-color: #242b35;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23g)' opacity='0.38'/%3E%3C/svg%3E");
    background-size: 160px 160px;
    background-blend-mode: overlay;
  }
  .decoder-window::before {
    content: "";
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 3;
    border-radius: inherit;
    background-repeat: no-repeat;
    background-image:
      linear-gradient(
        180deg,
        rgba(255, 255, 255, 0.075),
        rgba(255, 255, 255, 0)
      ),
      linear-gradient(0deg, rgba(0, 0, 0, 0.42), rgba(0, 0, 0, 0)),
      linear-gradient(90deg, rgba(0, 0, 0, 0.34), rgba(0, 0, 0, 0)),
      linear-gradient(270deg, rgba(255, 255, 255, 0.04), rgba(255, 255, 255, 0));
    background-size:
      100% 9px,
      100% 11px,
      9px 100%,
      9px 100%;
    background-position:
      left top,
      left bottom,
      left top,
      right top;
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.1),
      inset 0 -1px 0 rgba(0, 0, 0, 0.6),
      inset 1px 0 0 rgba(0, 0, 0, 0.45),
      inset -1px 0 0 rgba(255, 255, 255, 0.045);
  }

  /* ── Popups: the same metal as the panels, lifted off the page. They float
     over the console rather than sitting in it, so they add a cast shadow
     the fixed panels do not have. ── */
  .popup-panel::before {
    /* Two of these popups scroll, and an absolutely positioned chamfer would
       drift with the content. Inset shadows stay pinned to the border box, so
       the edges are drawn on the element itself instead. */
    display: none;
  }
  .popup-panel {
    box-shadow:
      /* cast shadow: the popup floats over the console */
      0 0 0 1px rgba(0, 0, 0, 0.6),
      0 28px 60px -18px rgba(0, 0, 0, 0.85),
      0 6px 16px -6px rgba(0, 0, 0, 0.7),
      /* the same chamfer as the panels, lit from the upper right */ inset 0 1px
        0 rgba(255, 255, 255, 0.1),
      inset 0 9px 9px -9px rgba(255, 255, 255, 0.1),
      inset 0 -1px 0 rgba(0, 0, 0, 0.6),
      inset 0 -11px 11px -11px rgba(0, 0, 0, 0.5),
      inset 1px 0 0 rgba(0, 0, 0, 0.45),
      inset 9px 0 9px -9px rgba(0, 0, 0, 0.35),
      inset -1px 0 0 rgba(255, 255, 255, 0.045),
      inset -9px 0 9px -9px rgba(255, 255, 255, 0.05);
  }

  /* ── Slider thumbs: the metal ball ─────────────────────────────────────
     One thumb for every range input on every engine, lit from the upper
     right like the rest of the console: specular high on the upper right of
     the ball, cast shadow falling to the left.

     Written for all three thumb pseudo-elements (Blink/WebKit, Gecko and
     legacy Edge) and matched on input[type="range"] as well as
     .glass-slider, so no slider anywhere is left on the browser default. ── */
  input[type="range"],
  .glass-slider {
    -webkit-appearance: none;
    -moz-appearance: none;
    appearance: none;
    width: 100%;
    height: 24px;
    background: transparent;
    outline: none;
    cursor: pointer;
    /* one definition of the ball, inherited by every thumb pseudo-element */
    --thumb-d: 18px;
    /* No specular hotspot. The ball is round because of its silhouette
       shading: a directional face gradient (bright on the upper-right side,
       dark on the lower-left), an edge vignette that turns the rim away from
       the viewer, and the cast shadow that lifts it off the track. */
    --thumb-face:
      radial-gradient(
        circle closest-side at 50% 50%,
        rgba(0, 0, 0, 0) 70%,
        rgba(0, 0, 0, 0.26) 87%,
        rgba(0, 0, 0, 0.6) 100%
      ),
      linear-gradient(
        215deg,
        #f4f4f5 0%,
        #d2d4d7 22%,
        #a9abb0 48%,
        #7c8087 72%,
        #4e535a 100%
      );
    --thumb-lift:
      /* curvature: the lower-left of the ball turns into shadow */
      inset 2px -2px 3px rgba(0, 0, 0, 0.42),
      /* a faint bounce along the lit rim, no hotspot */ inset -1px 1px 1px
        rgba(255, 255, 255, 0.22),
      /* lifted off the track, shadow to the left */ -1px 2px 3px
        rgba(0, 0, 0, 0.85),
      -1px 1px 1px rgba(0, 0, 0, 0.55);
    --track-h: 8px;
  }

  /* the track: a slot cut into the metal, like the recessed windows */
  input[type="range"]::-webkit-slider-runnable-track,
  .glass-slider::-webkit-slider-runnable-track {
    height: var(--track-h);
    border-radius: 999px;
    background: #0f1218;
    border: 0;
    box-shadow:
      0 0 0 1px rgba(0, 0, 0, 0.92),
      0 -2px 5px -2px rgba(0, 0, 0, 0.7),
      0 1px 0 rgba(255, 255, 255, 0.07),
      inset 0 2px 3px rgba(0, 0, 0, 0.9),
      inset 0 -1px 0 rgba(255, 255, 255, 0.1);
  }
  input[type="range"]::-moz-range-track,
  .glass-slider::-moz-range-track {
    height: var(--track-h);
    border-radius: 999px;
    background: #0f1218;
    border: 0;
    box-shadow:
      0 0 0 1px rgba(0, 0, 0, 0.92),
      inset 0 2px 3px rgba(0, 0, 0, 0.9),
      inset 0 -1px 0 rgba(255, 255, 255, 0.1);
  }
  input[type="range"]::-ms-track,
  .glass-slider::-ms-track {
    height: var(--track-h);
    border: 0;
    color: transparent;
    background: #0f1218;
  }
  input[type="range"]::-ms-fill-lower,
  input[type="range"]::-ms-fill-upper {
    background: #0f1218;
    border-radius: 999px;
  }

  /* the ball itself */
  input[type="range"]::-webkit-slider-thumb,
  .glass-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: var(--thumb-d);
    height: var(--thumb-d);
    border-radius: 50%;
    border: 1px solid rgba(0, 0, 0, 0.45);
    background: var(--thumb-face);
    box-shadow: var(--thumb-lift);
    cursor: pointer;
    /* centre the ball on the track */
    margin-top: calc((var(--track-h) - var(--thumb-d)) / 2);
    transition:
      transform 0.1s ease,
      box-shadow 0.1s ease;
  }
  input[type="range"]::-moz-range-thumb,
  .glass-slider::-moz-range-thumb {
    width: var(--thumb-d);
    height: var(--thumb-d);
    border-radius: 50%;
    border: 1px solid rgba(0, 0, 0, 0.45);
    background: var(--thumb-face);
    box-shadow: var(--thumb-lift);
    cursor: pointer;
    transition:
      transform 0.1s ease,
      box-shadow 0.1s ease;
  }
  input[type="range"]::-ms-thumb,
  .glass-slider::-ms-thumb {
    width: var(--thumb-d);
    height: var(--thumb-d);
    border-radius: 50%;
    border: 1px solid rgba(0, 0, 0, 0.45);
    background: var(--thumb-face);
    cursor: pointer;
  }

  input[type="range"]:hover::-webkit-slider-thumb,
  .glass-slider:hover::-webkit-slider-thumb {
    transform: scale(1.08);
    box-shadow: var(--thumb-lift);
  }
  input[type="range"]:hover::-moz-range-thumb,
  .glass-slider:hover::-moz-range-thumb {
    transform: scale(1.08);
    box-shadow: var(--thumb-lift);
  }
  input[type="range"]:active::-webkit-slider-thumb,
  .glass-slider:active::-webkit-slider-thumb {
    transform: scale(1.04);
    box-shadow:
      inset 2px -2px 3px rgba(0, 0, 0, 0.42),
      inset -1px 1px 1px rgba(255, 255, 255, 0.22),
      -1px 1px 2px rgba(0, 0, 0, 0.85);
  }
  input[type="range"]:active::-moz-range-thumb,
  .glass-slider:active::-moz-range-thumb {
    transform: scale(1.04);
  }
  input[type="range"]:focus-visible::-webkit-slider-thumb,
  .glass-slider:focus-visible::-webkit-slider-thumb {
    box-shadow:
      var(--thumb-lift),
      0 0 0 3px rgba(34, 211, 238, 0.55);
  }
  input[type="range"]:focus-visible::-moz-range-thumb,
  .glass-slider:focus-visible::-moz-range-thumb {
    box-shadow:
      var(--thumb-lift),
      0 0 0 3px rgba(34, 211, 238, 0.55);
  }

  @media (prefers-reduced-motion: reduce) {
    input[type="range"]::-webkit-slider-thumb,
    input[type="range"]::-moz-range-thumb {
      transition: none;
    }
  }

  /* ── Toggle switches: relit from the upper right, to match the caps ── */
  .toggle-slider:before {
    background:
      radial-gradient(
        circle closest-side at 62% 34%,
        rgba(255, 255, 255, 0.95) 0%,
        rgba(255, 255, 255, 0.25) 38%,
        rgba(255, 255, 255, 0) 62%
      ),
      linear-gradient(
        215deg,
        #f2f2f3 0%,
        #cfd2d6 42%,
        #93979e 74%,
        #6a6e75 100%
      );
    border: 1px solid rgba(0, 0, 0, 0.42);
    box-shadow:
      inset 0 1px 1px rgba(255, 255, 255, 0.85),
      inset -1px 0 1px rgba(255, 255, 255, 0.45),
      inset 1px -1px 2px rgba(0, 0, 0, 0.3),
      -2px 3px 4px rgba(0, 0, 0, 0.85);
  }

  /* ==================================================================
     Small screens — tablets, iPad, Android and iPhone
     ------------------------------------------------------------------
     The desktop layout is what iPadOS gets (its Safari reports a Mac
     user agent, so Device.isMobile is false) and what any phone gets via
     the /mobile page's "full desktop view" switch.  These rules keep it
     usable from ~360 px up; nothing here applies at desktop widths.
     ================================================================== */

  /* Viewport units that account for the browser's collapsing toolbars.
     Plain 100vh leaves the bottom of the app unreachable on iOS Safari
     and Chrome Android, because the outer container is overflow-hidden. */
  @supports (height: 100dvh) {
    main .h-screen {
      height: 100dvh;
    }
    main .min-h-screen {
      min-height: 100dvh;
    }
  }

  /* The S-Meter version picker is position:fixed at the top right.  On a
     desktop it sits in empty space beside the title; below that it lands
     on top of it, so give the title bar room to clear it. */
  @media (max-width: 1279px) {
    #chat-box {
      padding-top: 52px;
    }
  }

  @media (max-width: 1023px) {
    /* Band buttons are a fixed h-7 with 16px text in a 5-column grid.
       Under ~600 px per row the longer labels ("11m SSB", "180m AM") wrap
       to a second line and spill over the button below, so let the row
       grow and drop the text a notch. */
    #band-selector,
    [id="band-selector"] {
      height: auto;
      min-height: 1.9rem;
      padding: 2px 3px;
      font-size: 0.72rem;
      line-height: 1.1;
      text-align: center;
    }

    /* Fixed 310px meter box, in a column that can be narrower than that. */
    .smeter-container {
      width: 100%;
      max-width: 310px;
    }

    /* Sliders keep their 400px group / 200px track on a 360px screen. */
    .control-group {
      max-width: 100%;
    }
    .slider-container {
      width: auto;
      min-width: 0;
      margin: 0 10px;
    }

    /* Emoji picker is wider than a small phone viewport. */
    emoji-picker {
      width: min(300px, calc(100vw - 32px));
    }
  }

  /* users.html / stats.html are embedded as-is and have desktop-width tables
     of their own.  Rather than let them squeeze down to an illegible 300 px,
     hold them at a readable width and let the modal body pan sideways. */
  @media (max-width: 767px) {
    .modal-embed {
      min-width: 620px;
    }
  }

  @media (max-width: 639px) {
    /* Touch targets: the dense button rows are laid out for a mouse. */
    #band-selector,
    [id="band-selector"] {
      min-height: 2.1rem;
    }

    /* The chat username pill and the modal text both get cramped. */
    .modal-header,
    .modal-body {
      width: 100%;
      border-width: 2px;
    }
  }
</style>
