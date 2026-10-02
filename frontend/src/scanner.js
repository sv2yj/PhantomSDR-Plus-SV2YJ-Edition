// Channel scanner.
//
// The v1 scanner was a tune-and-listen scanner: retune, wait for the audio to
// arrive, measure the passband power, repeat — about 150 ms per channel whether
// or not there was anything there.  That is how a superhet has to work, because
// it can only look where it is tuned.  This receiver is panoramic: the whole
// visible span is already in the browser, decoded every frame, a few pixels
// from the scanner.  So this version screens channels in the SPECTRUM and only
// retunes to the ones worth listening to.
//
// Two rules keep that honest:
//
//   * the spectrum may only ever SKIP a channel, never stop on one.  Anything
//     the screen does not confidently place below the threshold is tuned and
//     confirmed with a real dwell, so a stop always means the receiver was
//     actually sitting on the channel.
//   * when the frame cannot resolve the channel spacing — zoomed out, or the
//     channel is off-screen — the screen returns "unknown" and the scan falls
//     straight back to tune-and-listen.  Nothing is skipped on a guess.
//
// The threshold is dB OVER THE BAND NOISE FLOOR, not an absolute dBm level.
// That is what removes the calibration problem v1 kept running into: the floor
// is measured continuously by waterfall.js (`snrNoiseDb`, the minimum of the
// medians of ~3 kHz windows across the visible span — the quietest signal-free
// patch), so "10 dB over the noise" means the same thing at midday and at night,
// on a quiet band and a noisy one, and it is already known before the scan
// starts.  No calibration sweep, no warm-up, nothing to keep in step.

// ---------------------------------------------------------------- constants

// Step follows the MODE, not a fixed value, and each mode's steps are anchored
// to a raster so stops land on channels: SSB whole kHz, CW whole 100 Hz, AM the
// 5 kHz shortwave grid, medium wave the region's spacing, long wave 9 kHz
// everywhere.  Modes not listed fall back to the band plan's own `stepi`.
const STEP_SSB_HZ = 1000;
const STEP_CW_HZ = 100;
const STEP_AM_HZ = 5000;
const MW_LO_HZ = 520e3;
const MW_HI_HZ = 1710e3;
// Long wave broadcast: 9 kHz on the 153 + 9k kHz grid in every region — unlike
// medium wave this does not follow the region, region 2 has no LW service and
// so no 10 kHz variant to pick.
const LW_LO_HZ = 148.5e3;
const LW_HI_HZ = 283.5e3;
const LW_STEP_HZ = 9000;
const LW_ANCHOR_HZ = 153e3;
const STEP_DEFAULT_HZ = 1000;
// Band-plan fallback only: above this a band is genuinely channelised, so its
// steps land on the raster.  Below it, anchoring to the band's start frequency
// would put every stop on an odd offset (a 1 kHz band starting at 137.8 kHz).
const RASTER_MIN_HZ = 5000;

// A stop is nudged onto the strongest point nearby, but only in the modes where
// the peak is the thing you tune to: the CW tone, the AM carrier.  In SSB the
// peak is voice energy a few hundred Hz off the suppressed carrier and centring
// on it would detune the station — those are snapped back onto the scan grid.
const CENTRE_MODES = ["CW", "CW-L", "AM", "QUAM", "SAM"];
const CENTRE_RES_CW_HZ = 100;
const CENTRE_RES_AM_HZ = 1000; // AM carriers are whole kHz by allocation
const CENTRE_MAX_HZ = 2500; // half a 9 kHz step reaches the next carrier

// Dwell on a channel the screen could not rule out.  The settle clears the
// audio still in flight from the previous channel; the sample peak-holds over a
// handful of frames rather than trusting one reading taken at the wrong
// instant.  ~150 ms is slow enough to hear what it lands on.
const SETTLE_MS = 70;
const SAMPLE_MS = 80;

// How much below the threshold a channel must screen before it is skipped
// without listening.  The screen reads a single frame's bins over a max-hold;
// this margin is what stops a marginal reading from throwing a real signal away.
const SCREEN_MARGIN_DB = 3;
// Bins decay this fast in the max-hold, so a signal that keys up briefly keeps
// the channel a candidate for about a second afterwards instead of vanishing
// between frames.
const MAXHOLD_DECAY_DB = 0.5;
// A channel needs at least this many frame bins across it before the screen
// will judge it; below that the frame cannot tell the channel from its
// neighbours and the scan dwells instead.
const SCREEN_MIN_BINS = 2;
// Channels screened per animation frame.  A whole band is usually well inside
// this, so an empty band is swept once per frame.
const SCREEN_BUDGET = 600;

// Thresholds offered in the dropdown, in dB over the band noise floor.
//
// Bare noise does not read 0 dB: the floor is the MEDIAN of a quiet window
// while the reading is the PEAK across the passband, and the peak of a few
// dozen noise bins sits several dB above their median — more bins, so more of
// them, in a wide AM passband than in a narrow CW one.  So an empty channel
// typically reads a handful of dB rather than nothing, and the default sits
// well clear of that — it stops on real signals rather than on a lively floor.  The threshold button shows the live figure beside the
// setting, so picking one is a matter of watching a quiet channel for a second.
export const THRESHOLDS_DB = [6, 10, 15, 20, 30, 40];
export const RESUME_CHOICES_MS = [0, 3000, 5000, 10000];
// The timeout timer: how long the scan may stay on one channel even while the
// signal is still there.  Without it a permanent carrier — a broadcast, a
// birdie, a local heterodyne — holds the scan forever, because the resume delay
// only ever counts while the channel is QUIET and that channel never is.
export const MAX_STAY_CHOICES_MS = [0, 30000, 60000, 120000];
const DEFAULT_MAX_STAY_MS = 0;
// How the scan crosses the band.
//
//   sweep  the classic scanner: every channel is tuned and listened to in
//          turn, so you watch the VFO walk the band and hear it go past.
//   fast   channels the spectrum can confidently place below the threshold are
//          skipped without tuning, so the VFO jumps signal to signal.
//
// Sweep is the default because it is what a scanner is: the speed of `fast` is
// bought by never putting the receiver on the empty channels at all, which
// takes away both the sound and the sight of the scan.
export const SWEEP_MODES = ["sweep", "fast"];
// What the scan sweeps between.
//
//   band     the band the scan started in, from the band plan.
//   visible  whatever the waterfall is currently showing, so what you can see
//            is what gets scanned.  Re-read every pass, so zooming or dragging
//            the waterfall while the scan runs moves the scan with it.
//
// Either way the result is clipped to what the receiver can tune, and the scan
// wraps at the edges rather than walking off the end of the spectrum.
export const RANGE_MODES = ["band", "visible"];
const DEFAULT_RANGE = "band";
const DEFAULT_SWEEP = "sweep";
const DEFAULT_THRESHOLD_DB = 30;
const DEFAULT_RESUME_MS = 3000;
// While parked, the signal has to stay below the threshold continuously for the
// resume delay before the scan moves on — so ordinary speech pauses do not
// restart it.
const MONITOR_MS = 120;
const PUBLISH_MS = 200;
const STORE_KEY = "phantomsdr.scanner.v3";
const LOCK_LIMIT = 200;

const now = () =>
  typeof performance !== "undefined" ? performance.now() : Date.now();

// ------------------------------------------------------------------ factory

// ctx supplies everything the scanner is not allowed to own itself:
//   getFrequencyHz()  current VFO, Hz
//   tune(hz)          retune (frequency box + audio + passband)
//   getMode()         demodulation string
//   getRegion()       ITU region from site_information.json
//   getBands()        the band plan array
//   getAudio()        audio object, for baseFreq / totalBandwidth
//   getWaterfall()    waterfall object, for the spectrum and the noise floor
//   onState(state)    called whenever anything the UI shows changes
export function createScanner(ctx) {
  let running = false;
  let parked = false;
  let dir = 1;
  let cursorHz = null; // where the SCAN is, which is not where the VFO is
  let loHz = null;
  let hiHz = null;
  let timer = null;
  let raf = null;
  let quietSince = null; // parked: since when the channel has been quiet
  let lastPublish = 0;
  let liveSnr = null;

  let sweepMode = DEFAULT_SWEEP;
  let rangeMode = DEFAULT_RANGE;
  let thresholdDb = DEFAULT_THRESHOLD_DB;
  let resumeMs = DEFAULT_RESUME_MS;
  let maxStayMs = DEFAULT_MAX_STAY_MS;
  let parkedAt = null;
  let locks = [];

  // Max-hold over the frame, rebuilt whenever the waterfall range moves.
  let mhData = null;
  let mhL = 0;
  let mhR = 0;

  // ------------------------------------------------------------ persistence

  function load() {
    try {
      const raw = window.localStorage.getItem(STORE_KEY);
      if (!raw) return;
      const v = JSON.parse(raw);
      if (SWEEP_MODES.indexOf(v.sweepMode) >= 0) sweepMode = v.sweepMode;
      if (RANGE_MODES.indexOf(v.rangeMode) >= 0) rangeMode = v.rangeMode;
      if (THRESHOLDS_DB.indexOf(v.thresholdDb) >= 0) thresholdDb = v.thresholdDb;
      if (RESUME_CHOICES_MS.indexOf(v.resumeMs) >= 0) resumeMs = v.resumeMs;
      if (MAX_STAY_CHOICES_MS.indexOf(v.maxStayMs) >= 0) maxStayMs = v.maxStayMs;
      if (Array.isArray(v.locks))
        locks = v.locks.filter(Number.isFinite).slice(0, LOCK_LIMIT);
    } catch (e) {}
  }

  function save() {
    try {
      window.localStorage.setItem(
        STORE_KEY,
        JSON.stringify({
          sweepMode,
          rangeMode,
          thresholdDb,
          resumeMs,
          maxStayMs,
          locks,
        }),
      );
    } catch (e) {}
  }

  // ------------------------------------------------------------ step & grid

  // The step in force at a frequency, plus the raster it is anchored to.  Mode
  // decides wherever the mode implies a spacing; only what is left falls
  // through to the band plan, whose selection repeats the rule the band button
  // uses — first entry covering the frequency whose ITU region matches.
  function stepAt(hz, mode) {
    const m = String(mode == null ? ctx.getMode() : mode || "").toUpperCase();
    if (m === "CW" || m === "CW-L")
      return { stepHz: STEP_CW_HZ, anchorHz: 0 };
    if (m === "USB" || m === "LSB" || m === "RADEU" || m === "RADEL")
      return { stepHz: STEP_SSB_HZ, anchorHz: 0 };
    if (m === "AM" || m === "QUAM" || m === "SAM") {
      if (hz >= LW_LO_HZ && hz <= LW_HI_HZ)
        return { stepHz: LW_STEP_HZ, anchorHz: LW_ANCHOR_HZ };
      if (hz >= MW_LO_HZ && hz <= MW_HI_HZ)
        return ctx.getRegion() === 2
          ? { stepHz: 10000, anchorHz: 530e3 }
          : { stepHz: 9000, anchorHz: 531e3 };
      return { stepHz: STEP_AM_HZ, anchorHz: 0 };
    }
    try {
      const bands = ctx.getBands() || [];
      const region = ctx.getRegion();
      for (let i = 0; i < bands.length; i++) {
        const b = bands[i];
        if (
          hz >= b.startFreq &&
          hz <= b.endFreq &&
          (b.ITU === region || b.ITU === 123)
        ) {
          const st = Number(b.stepi);
          if (Number.isFinite(st) && st >= 100)
            return {
              stepHz: st,
              anchorHz: st >= RASTER_MIN_HZ ? Number(b.startFreq) : null,
            };
          break;
        }
      }
    } catch (e) {}
    return { stepHz: STEP_DEFAULT_HZ, anchorHz: null };
  }

  // The stretch a scan is allowed to cover: the band it is in, clipped to what
  // the receiver can actually tune.  Running off the end of the received
  // spectrum leaves the waterfall with nothing to draw, so the scan wraps at
  // the edges instead and sweeps the band continuously.
  function rangeAt(hz) {
    let lo = null;
    let hi = null;
    if (rangeMode === "visible") {
      try {
        const wf = ctx.getWaterfall();
        const [l, r] = wf.getWaterfallRange();
        const a = wf.idxToFreq(l);
        const b = wf.idxToFreq(r);
        if (Number.isFinite(a) && Number.isFinite(b)) {
          lo = Math.min(a, b);
          hi = Math.max(a, b);
        }
      } catch (e) {}
      return clipToReceiver(lo, hi);
    }
    try {
      const bands = ctx.getBands() || [];
      const region = ctx.getRegion();
      for (let i = 0; i < bands.length; i++) {
        const b = bands[i];
        if (
          hz >= b.startFreq &&
          hz <= b.endFreq &&
          (b.ITU === region || b.ITU === 123)
        ) {
          lo = Number(b.startFreq);
          hi = Number(b.endFreq);
          break;
        }
      }
    } catch (e) {}
    return clipToReceiver(lo, hi);
  }

  // Whatever the range came from, it can never leave what the receiver can
  // tune.  With nothing to clip against, the receiver's own span is the range.
  function clipToReceiver(lo, hi) {
    let rxLo = null;
    let rxHi = null;
    try {
      const audio = ctx.getAudio();
      if (
        audio &&
        Number.isFinite(audio.baseFreq) &&
        Number.isFinite(audio.totalBandwidth)
      ) {
        rxLo = audio.baseFreq;
        // The frequency box takes f < hi and silently ignores anything outside,
        // while the tuning path does not check at all — landing exactly on the
        // top edge would move the audio and leave the readout behind.
        rxHi = audio.baseFreq + audio.totalBandwidth - 1;
      }
    } catch (e) {}
    if (lo == null) {
      lo = rxLo;
      hi = rxHi;
    } else if (rxLo != null) {
      lo = Math.max(lo, rxLo);
      hi = Math.min(hi, rxHi);
    }
    if (!(Number.isFinite(lo) && Number.isFinite(hi) && hi > lo)) return null;
    return { lo: Math.round(lo), hi: Math.round(hi) };
  }

  // First raster point at or inside an edge, looking in direction `sign`.
  function edgePoint(edgeHz, sign, stepHz, anchorHz) {
    if (anchorHz == null) return edgeHz;
    const k = (edgeHz - anchorHz) / stepHz;
    return anchorHz + (sign > 0 ? Math.ceil(k) : Math.floor(k)) * stepHz;
  }

  // Next channel along, purely computed — no tuning.  null when there is
  // nowhere to go: a range narrower than one step, or a raster with no point
  // inside it, which would otherwise sweep the same channel forever.
  function nextChannel(fromHz, sign) {
    const { stepHz, anchorHz } = stepAt(fromHz);
    let hz;
    if (anchorHz != null) {
      // Starting off-grid this also snaps onto the grid on the first step.
      const k = Math.round((fromHz - anchorHz) / stepHz);
      hz = anchorHz + (k + sign) * stepHz;
    } else {
      hz = fromHz + sign * stepHz;
    }
    if (loHz != null && hiHz != null) {
      if (hz > hiHz) hz = edgePoint(loHz, 1, stepHz, anchorHz);
      else if (hz < loHz) hz = edgePoint(hiHz, -1, stepHz, anchorHz);
      hz = Math.min(hiHz, Math.max(loHz, hz));
    }
    return hz === fromHz ? null : hz;
  }

  // ------------------------------------------------------------- detection

  // SNR over the band noise floor at the tuned passband, published every frame
  // by the S-meter tick and computed in waterfall.js from the same floor the
  // screen uses.  null when there is no estimate yet — which is never a reason
  // to stop, only a reason to keep moving.
  function snrNow() {
    try {
      const wf = ctx.getWaterfall();
      if (wf && typeof wf.getSnrEstimate === "function") {
        const e = wf.getSnrEstimate();
        if (e && Number.isFinite(e.snrDb)) return e.snrDb;
      }
    } catch (e) {}
    if (typeof window !== "undefined" && Number.isFinite(window._lastSnr))
      return window._lastSnr;
    return null;
  }

  // The current spectrum frame, max-held.  Rebuilt from scratch whenever the
  // waterfall range moves, because the bins then mean different frequencies.
  function frame() {
    let f = null;
    try {
      f = ctx.getWaterfall()._lastFrame;
    } catch (e) {}
    if (!f || !f.data) return null;
    const n = f.data.length;
    if (n < 8 || !(f.r > f.l)) return null;
    if (!mhData || mhData.length !== n || mhL !== f.l || mhR !== f.r) {
      mhData = Float32Array.from(f.data);
      mhL = f.l;
      mhR = f.r;
    } else {
      for (let i = 0; i < n; i++) {
        const decayed = mhData[i] - MAXHOLD_DECAY_DB;
        const v = f.data[i];
        mhData[i] = v > decayed ? v : decayed;
      }
    }
    return { data: mhData, l: f.l, r: f.r, n };
  }

  // How far the strongest bin across a channel stands over the band floor, or
  // null when this frame cannot answer: no floor written down yet, the channel
  // is off-screen, or the frame is too coarse to tell it from its neighbours.
  function screenSnr(fr, hz, halfHz) {
    if (!fr) return null;
    let wf;
    try {
      wf = ctx.getWaterfall();
    } catch (e) {
      return null;
    }
    const floor = wf && wf.snrNoiseDb;
    if (!Number.isFinite(floor)) return null;
    const span = fr.r - fr.l;
    const hzPerBin = (wf.totalBandwidth / wf.waterfallMaxSize) * (span / fr.n);
    if (!(hzPerBin > 0) || hzPerBin * SCREEN_MIN_BINS > 2 * halfHz) return null;
    const toIdx = (h) => Math.round(((wf.freqToIdx(h) - fr.l) / span) * fr.n);
    let a = toIdx(hz - halfHz);
    let b = toIdx(hz + halfHz);
    if (b < a) {
      const t = a;
      a = b;
      b = t;
    }
    // Only judge a channel the frame fully covers; one hanging over the edge
    // would be screened on half its spectrum.
    if (a < 0 || b > fr.n - 1) return null;
    let peak = -Infinity;
    for (let i = a; i <= b; i++) {
      const v = fr.data[i];
      if (v > peak) peak = v;
    }
    return Number.isFinite(peak) ? peak - floor : null;
  }

  // Peak-hold the SNR over a window, then hand the reading back.  Sampling
  // rides requestAnimationFrame because the estimate is republished once per
  // frame — polling faster would only re-read the same value.
  function measure(settleMs, sampleMs, done) {
    if (!running) return;
    timer = setTimeout(() => {
      timer = null;
      let peak = -Infinity;
      const until = now() + sampleMs;
      const tick = () => {
        if (!running) return;
        const s = snrNow();
        if (Number.isFinite(s)) {
          liveSnr = s;
          if (s > peak) peak = s;
        }
        if (now() < until) {
          raf = requestAnimationFrame(tick);
          return;
        }
        raf = null;
        done(peak);
      };
      tick();
    }, settleMs);
  }

  // --------------------------------------------------------------- lockout

  const lockKey = (hz) => Math.round(hz);
  const isLocked = (hz) => locks.indexOf(lockKey(hz)) >= 0;

  // ---------------------------------------------------------------- tuning

  function tune(hz) {
    cursorHz = Math.round(hz);
    ctx.tune(cursorHz);
  }

  // Land on the strongest point near where we stopped, so a stop sits on the
  // signal rather than on its skirt.  The spectrum peak is used for POSITION
  // only — the decision to stop was already made from a real dwell.
  function centre() {
    try {
      const cur = Math.round(ctx.getFrequencyHz());
      const mode = String(ctx.getMode() || "").toUpperCase();
      const { stepHz, anchorHz } = stepAt(cur, mode);
      if (CENTRE_MODES.indexOf(mode) < 0) {
        // Not a carrier mode: no centring, and the stop is forced onto the grid
        // so SSB parks on a whole kHz even if the VFO started on a fraction.
        if (anchorHz == null) return;
        const snapped =
          anchorHz + Math.round((cur - anchorHz) / stepHz) * stepHz;
        if (snapped !== cur) ctx.tune(snapped);
        return;
      }
      const wf = ctx.getWaterfall();
      if (!wf || typeof wf.getPeakFreq !== "function") return;
      const half = Math.min(stepHz / 2, CENTRE_MAX_HZ);
      const peak = wf.getPeakFreq(cur, half);
      if (!Number.isFinite(peak)) return;
      const res = mode.indexOf("CW") === 0 ? CENTRE_RES_CW_HZ : CENTRE_RES_AM_HZ;
      const hz = Math.round(peak / res) * res;
      const shift = Math.abs(hz - cur);
      if (shift < res || shift > half) return;
      ctx.tune(hz);
    } catch (e) {}
  }

  // ------------------------------------------------------------------ state

  function publish(force) {
    const t = now();
    if (!force && t - lastPublish < PUBLISH_MS) return;
    lastPublish = t;
    let resumeInMs = null;
    if (parked && resumeMs > 0 && quietSince != null)
      resumeInMs = Math.max(0, resumeMs - (t - quietSince));
    let stayLeftMs = null;
    if (parked && maxStayMs > 0 && parkedAt != null)
      stayLeftMs = Math.max(0, maxStayMs - (t - parkedAt));
    try {
      ctx.onState({
        running,
        parked,
        dir,
        sweepMode,
        rangeMode,
        loHz,
        hiHz,
        cursorHz,
        thresholdDb,
        resumeMs,
        resumeInMs,
        maxStayMs,
        stayLeftMs,
        snrDb: liveSnr,
        lockCount: locks.length,
        locked: cursorHz != null && isLocked(cursorHz),
      });
    } catch (e) {}
  }

  function clearTimers() {
    if (timer) clearTimeout(timer);
    timer = null;
    if (raf) cancelAnimationFrame(raf);
    raf = null;
  }

  // ------------------------------------------------------------- scan loop

  // Screen forward until a channel the spectrum cannot rule out, then dwell on
  // it.  Skipped channels cost nothing: no retune, no wait, so an empty band is
  // swept once per frame instead of once per 150 ms per channel.
  function scanTick() {
    raf = null;
    if (!running || parked) return;

    // The VFO can move under us — a band button, a bookmark, the frequency box.
    // Adopt wherever the user went rather than dragging them back.
    const vfo = Math.round(ctx.getFrequencyHz());
    if (cursorHz == null || Math.abs(vfo - cursorHz) > stepAt(vfo).stepHz) {
      cursorHz = vfo;
      const r = rangeAt(vfo);
      loHz = r ? r.lo : null;
      hiHz = r ? r.hi : null;
    } else if (rangeMode === "visible") {
      // Zooming or dragging the waterfall moves the scan with it, so re-read
      // the window rather than sweeping where the user is no longer looking.
      const r = rangeAt(vfo);
      if (r) {
        loHz = r.lo;
        hiHz = r.hi;
        cursorHz = Math.min(hiHz, Math.max(loHz, cursorHz));
      }
    }

    const fr = sweepMode === "fast" ? frame() : null;
    // Screening does not measure, so keep the readout alive from the estimate
    // the S-meter is publishing anyway.
    const s0 = snrNow();
    if (Number.isFinite(s0)) liveSnr = s0;
    let budget = SCREEN_BUDGET;
    while (budget-- > 0) {
      const hz = nextChannel(cursorHz, dir);
      if (hz == null) {
        // Nowhere to sweep.  Stopping beats spinning in place.
        stop();
        return;
      }
      cursorHz = hz;
      if (isLocked(hz)) continue;
      const { stepHz } = stepAt(hz);
      const s = screenSnr(fr, hz, stepHz / 2);
      if (s != null && s < thresholdDb - SCREEN_MARGIN_DB) continue;
      // Candidate: the receiver has to be on it before anything is decided.
      tune(hz);
      publish(true);
      measure(SETTLE_MS, SAMPLE_MS, (peak) => {
        if (!running) return;
        if (Number.isFinite(peak) && peak >= thresholdDb) {
          park();
          return;
        }
        raf = requestAnimationFrame(scanTick);
      });
      return;
    }
    publish();
    raf = requestAnimationFrame(scanTick);
  }

  // ----------------------------------------------------------------- parked

  function park() {
    parked = true;
    clearTimers();
    centre(); // park on the signal, not on the raster point next to it
    quietSince = null;
    parkedAt = now();
    publish(true);
    monitor();
  }

  // While parked, keep watching.  The scan resumes only after the channel has
  // been continuously below the threshold for the whole resume delay, so an
  // ordinary pause in speech does not restart it.
  function monitor() {
    if (!running || !parked) return;
    timer = setTimeout(() => {
      timer = null;
      if (!running || !parked) return;
      const s = snrNow();
      if (Number.isFinite(s)) liveSnr = s;
      if (Number.isFinite(s) && s >= thresholdDb) quietSince = null;
      else if (quietSince == null) quietSince = now();
      const quietLongEnough =
        resumeMs > 0 && quietSince != null && now() - quietSince >= resumeMs;
      // The timeout timer moves on whether or not the channel ever goes quiet,
      // so one permanent carrier cannot end the scan.
      const stayedTooLong =
        maxStayMs > 0 && parkedAt != null && now() - parkedAt >= maxStayMs;
      if (quietLongEnough || stayedTooLong) {
        parked = false;
        quietSince = null;
        parkedAt = null;
        publish(true);
        raf = requestAnimationFrame(scanTick);
        return;
      }
      publish();
      monitor();
    }, MONITOR_MS);
  }

  // -------------------------------------------------------------------- api

  function stop() {
    running = false;
    parked = false;
    quietSince = null;
    parkedAt = null;
    clearTimers();
    publish(true);
  }

  function start(d) {
    // The arrow always means "scan that way": pressing it while parked resumes,
    // pressing it while already scanning that way changes nothing.  Stopping is
    // the stop button's job, not an arrow's second meaning.
    if (running && dir === d && !parked) return;
    clearTimers();
    dir = d;
    running = true;
    parked = false;
    quietSince = null;
    parkedAt = null;
    const vfo = Math.round(ctx.getFrequencyHz());
    cursorHz = vfo;
    const r = rangeAt(vfo);
    loHz = r ? r.lo : null;
    hiHz = r ? r.hi : null;
    // Pressing an arrow with the VFO outside the window — scrolled away, or a
    // band edge just crossed — starts the sweep at the near edge instead of
    // wandering in from wherever the VFO happens to be.
    if (loHz != null && (cursorHz < loHz || cursorHz > hiHz))
      cursorHz = Math.min(hiHz, Math.max(loHz, cursorHz));
    publish(true);
    // Straight into the loop: the noise floor it judges against has been
    // tracked by the waterfall all along, so there is nothing to calibrate
    // first and no reason to make the user wait.
    scanTick();
  }

  load();

  return {
    start,
    stop,
    stepAt: (hz, mode) => stepAt(hz, mode),
    setRangeMode(m) {
      if (RANGE_MODES.indexOf(m) < 0) return;
      rangeMode = m;
      // Take effect at once rather than at the next arrow press.
      if (running) {
        const r = rangeAt(Math.round(ctx.getFrequencyHz()));
        loHz = r ? r.lo : null;
        hiHz = r ? r.hi : null;
      }
      save();
      publish(true);
    },
    setSweepMode(m) {
      if (SWEEP_MODES.indexOf(m) < 0) return;
      sweepMode = m;
      save();
      publish(true);
    },
    setThreshold(db) {
      thresholdDb = db;
      save();
      publish(true);
    },
    setResume(ms) {
      resumeMs = ms;
      quietSince = null;
      save();
      publish(true);
    },
    setMaxStay(ms) {
      if (MAX_STAY_CHOICES_MS.indexOf(ms) < 0) return;
      maxStayMs = ms;
      parkedAt = parked ? now() : null;
      save();
      publish(true);
    },
    // Lock out the channel we are parked on and carry on — for the local
    // birdie or the always-on carrier that would otherwise stop every lap.
    lockCurrent() {
      const hz = cursorHz == null ? Math.round(ctx.getFrequencyHz()) : cursorHz;
      if (!isLocked(hz)) {
        locks.push(lockKey(hz));
        while (locks.length > LOCK_LIMIT) locks.shift();
        save();
      }
      if (running) {
        parked = false;
        quietSince = null;
        parkedAt = null;
        clearTimers();
        publish(true);
        raf = requestAnimationFrame(scanTick);
      } else {
        publish(true);
      }
    },
    clearLocks() {
      locks = [];
      save();
      publish(true);
    },
    destroy() {
      stop();
    },
  };
}
