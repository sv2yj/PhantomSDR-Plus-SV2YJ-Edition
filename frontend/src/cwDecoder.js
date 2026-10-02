// cwDecoder.js — coherent weak-signal CW / Morse decoder
// ============================================================================
// Designed to hold up at low SNR / under QSB, where a per-frame threshold
// decoder fragments every element. The processing gain comes from integrating
// the keying envelope over a window matched to the dot length BEFORE any hard
// decision — the same principle as PA3FWM's RSCW.
//
// Pipeline
// --------
//   1. Tone acquisition — peak of a time-AVERAGED power spectrum (the tone is
//        persistent; broadband noise averages out), so a single noise burst
//        cannot hijack the lock. Decoding is gated until the tone is valid.
//   2. Complex baseband — an NCO downconverts the tone to DC, a 2-pole low-pass
//        per I/Q arm forms a narrowband filter; |I+jQ| is the keying envelope,
//        decimated to ~2 ms frames and kept in a ring buffer.
//   3. Speed estimation — the crux. Over a multi-second window we search dot
//        periods and score each by how cleanly the envelope, integrated into
//        dot-length slots, separates into on/off (Otsu separability). The best
//        score gives the dot period T. This is independent of any threshold, so
//        it bootstraps the whole decoder even on a signal too weak to threshold
//        frame-by-frame, and it refuses to lock on pure noise (low separability).
//   4. Matched filter + slice — a boxcar integrator of ~0.7·T (matched to the
//        dot) plus a hysteresis slicer at the estimated on/off levels turns the
//        cleaned envelope into key-up/down with high SNR.
//   5. Element/gap timing — durations are classified against the KNOWN T
//        (1·T dot / 3·T dash; 1/3/7·T gaps), not a fragile online estimate.
//   6. Dictionary MAP decode — each character's element durations give soft
//        dit/dah log-likelihoods; we pick the valid Morse codeword of that
//        length with the highest joint likelihood (+ a light letter-frequency
//        prior), recovering a marginal element a hard decoder would lose.
//
// Public interface is unchanged so the Svelte UI needs no edits:
//   new CWDecoder({sampleRate, callback}); .setCallback(); .setSampleRate();
//   .reset(); .feed(Float32Array);
// Events: {type:'char',char} {type:'word'} {type:'freq',hz,wpm} {type:'silence'}
// ============================================================================

import { transformFlat } from './lib/fftRadix2.js';

// ── Morse table (code → character) ──────────────────────────────────────────
const MORSE = {
  '.-':'A',   '-...':'B', '-.-.':'C', '-..':'D',  '.':'E',
  '..-.':'F', '--.':'G',  '....':'H', '..':'I',   '.---':'J',
  '-.-':'K',  '.-..':'L', '--':'M',   '-.':'N',   '---':'O',
  '.--.':'P', '--.-':'Q', '.-.':'R',  '...':'S',  '-':'T',
  '..-':'U',  '...-':'V', '.--':'W',  '-..-':'X', '-.--':'Y',
  '--..':'Z',
  '-----':'0','.----':'1','..---':'2','...--':'3','....-':'4',
  '.....':'5','-....':'6','--...':'7','---..':'8','----.':'9',
  '.-.-.-':'.','--..--':',','..--..':'?','-..-.':'/',
  '-.-.--':'!','.--.-.':'@','-....-':'-','...-..-':'$','-...-':'='
};

// Relative English letter frequencies (%) — a gentle MAP prior that only breaks
// ties between codewords that fit the timing about equally well.
const LETTER_FREQ = {
  E:12.7, T:9.06, A:8.17, O:7.51, I:6.97, N:6.75, S:6.33, H:6.09, R:5.99,
  D:4.25, L:4.03, C:2.78, U:2.76, M:2.41, W:2.36, F:2.22, G:2.02, Y:1.97,
  P:1.93, B:1.29, V:0.98, K:0.77, J:0.15, X:0.15, Q:0.10, Z:0.07
};

// Per element-count, the candidate codewords with dit/dah bits and a log-prior.
const DECODE_BY_LEN = (() => {
  const byLen = {};
  for (const code in MORSE) {
    const ch = MORSE[code];
    const bits = new Uint8Array(code.length);
    for (let i = 0; i < code.length; i++) bits[i] = code[i] === '-' ? 1 : 0;
    const freq = LETTER_FREQ[ch] != null ? LETTER_FREQ[ch] : 0.05;
    (byLen[code.length] || (byLen[code.length] = [])).push(
      { bits, char: ch, logPrior: Math.log(freq) });
  }
  return byLen;
})();

export default class CWDecoder {
  constructor({ sampleRate = 12000, callback = null } = {}) {
    this.sr = sampleRate || 12000;
    this.callback = callback || null;
    this.reset();
  }

  setCallback(cb) { this.callback = cb || null; }

  setSampleRate(sr) {
    sr = sr || 12000;
    if (sr !== this.sr) { this.sr = sr; this._configure(); this.reset(); }
  }

  reset() {
    this._configure();

    // Tone acquisition
    this.toneHz = 700; this.toneValid = false;
    this.specAvg = null; this.specFrames = 0;
    this.fftBuf = new Float32Array(this.FFT_N); this.fftFill = 0;

    // NCO + I/Q low-pass
    this.oscC = 1; this.oscS = 0; this.oscNorm = 0;
    this.lpI1 = 0; this.lpI2 = 0; this.lpQ1 = 0; this.lpQ2 = 0;

    // Decimation
    this.hopCount = 0; this.magAccum = 0;

    // Envelope ring buffer
    this.envBuf = new Float64Array(this.BUF);
    this.envPos = 0; this.envCount = 0;
    this.frameNo = 0;            // absolute frame counter
    this.decodePos = 0;          // next absolute frame index to decode

    // Speed / threshold estimation
    this.Td = 0;                 // dot period in frames (0 = unknown)
    this.sepEma = null;          // averaged separability-vs-period landscape
    this.mfWin = 8;              // matched-filter boxcar width (frames)
    this.onLvl = 0; this.offLvl = 0;
    // Fast local on/off level followers that ride QSB between the (slow, ~0.7 s)
    // estimator updates. Anchored to onLvl/offLvl; null until the first lock.
    this.onLvlLocal = null; this.offLvlLocal = null;
    this.framesSinceEst = 0;

    // Keying state
    this.keyOn = false;
    this.markFrames = 0; this.spaceFrames = 0;

    // Character assembly
    this.curElems = [];
    this.charFlushed = true;
    this.wordEmitted = true;
    this.silent = false;
    this.charGapEma = 0;         // learned character-gap width (Farnsworth-aware)
  }

  _configure() {
    const sr = this.sr;
    this.FFT_N   = 2048;                                 // ~0.17 s @ 12 kHz
    this.hop     = Math.max(1, Math.round(sr * 0.002));  // ~2 ms frames
    this.frameMs = (this.hop / sr) * 1000;
    this._setToneCoeffs(this.toneHz || 700);
    this.lpA = 1 - Math.exp(-2 * Math.PI * 50 / sr);     // ~50 Hz per-arm LP

    // Frame-domain constants
    this.BUF        = Math.round(12000 / this.frameMs);  // 12 s ring
    this.EST_WIN    = Math.round(6000  / this.frameMs);  // 6 s estimation window
    this.EST_MIN    = Math.round(1400  / this.frameMs);  // min before 1st estimate
    this.EST_PERIOD = Math.round(700   / this.frameMs);  // re-estimate cadence
    this.TD_MIN     = Math.max(6, Math.round(18  / this.frameMs)); // ~67 wpm
    this.TD_MAX     = Math.round(260 / this.frameMs);              // ~4.6 wpm
    this.silenceFrames = Math.round(2000 / this.frameMs);
  }

  _setToneCoeffs(hz) {
    const dphi = 2 * Math.PI * hz / this.sr;
    this.oscStepC = Math.cos(dphi);
    this.oscStepS = Math.sin(dphi);
    this.oscFreq  = hz;
  }

  // ── Main entry ──────────────────────────────────────────────────────────
  feed(pcm) {
    for (let n = 0; n < pcm.length; n++) {
      const x = pcm[n];

      // (1) Tone acquisition buffer.
      this.fftBuf[this.fftFill++] = x;
      if (this.fftFill >= this.FFT_N) { this._detectTone(); this.fftFill = 0; }
      if (Math.abs(this.toneHz - this.oscFreq) > 1.5) this._setToneCoeffs(this.toneHz);

      // (2) Complex downconvert by e^{-jωn} via incremental rotator.
      const c = this.oscC, s = this.oscS;
      const iIn = x * c, qIn = -x * s;
      this.oscC = c * this.oscStepC - s * this.oscStepS;
      this.oscS = s * this.oscStepC + c * this.oscStepS;
      if (++this.oscNorm >= 1024) {
        const g = 1 / Math.hypot(this.oscC, this.oscS);
        this.oscC *= g; this.oscS *= g; this.oscNorm = 0;
      }

      // I/Q low-pass (2-pole each) → envelope magnitude.
      const a = this.lpA;
      this.lpI1 += a * (iIn - this.lpI1); this.lpI2 += a * (this.lpI1 - this.lpI2);
      this.lpQ1 += a * (qIn - this.lpQ1); this.lpQ2 += a * (this.lpQ1 - this.lpQ2);
      this.magAccum += Math.hypot(this.lpI2, this.lpQ2);

      // (3) Decimate to a ~2 ms envelope frame.
      if (++this.hopCount >= this.hop) {
        const e = this.magAccum / this.hop;
        this.magAccum = 0; this.hopCount = 0;
        this._processFrame(e);
      }
    }
  }

  // ── Tone detection (time-averaged spectrum) ───────────────────────────────
  _detectTone() {
    const N = this.FFT_N, sr = this.sr;
    const re = new Float64Array(N), im = new Float64Array(N);
    const buf = this.fftBuf;
    for (let i = 0; i < N; i++) {
      const w = 0.5 * (1 - Math.cos(2 * Math.PI * i / (N - 1)));
      re[i] = buf[i] * w;
    }
    try { transformFlat(re, im, false); } catch (e) { return; }

    const half = N >> 1;
    if (!this.specAvg) this.specAvg = new Float64Array(half + 1);
    const beta = this.specFrames < 4 ? 0.5 : 0.25;
    for (let b = 1; b <= half; b++) {
      const p = re[b] * re[b] + im[b] * im[b];
      this.specAvg[b] = this.specAvg[b] * (1 - beta) + p * beta;
    }
    this.specFrames++;

    const res = sr / N;
    const bLo = Math.max(1, Math.floor(200 / res));
    const bHi = Math.min(half, Math.ceil(2500 / res));
    const spec = this.specAvg;
    let maxP = 0, maxB = bLo;
    for (let b = bLo; b <= bHi; b++) if (spec[b] > maxP) { maxP = spec[b]; maxB = b; }

    let sum = 0, cnt = 0;
    for (let b = Math.max(bLo, maxB - 20); b <= Math.min(bHi, maxB + 20); b++) {
      if (b === maxB) continue;
      sum += spec[b]; cnt++;
    }
    const meanNb = cnt ? sum / cnt : maxP;
    if (maxP <= 1e-12 || meanNb <= 0 || maxP < meanNb * 4.0) return;

    let delta = 0;
    if (maxB > bLo && maxB < bHi) {
      const yL = spec[maxB - 1], yC = spec[maxB], yR = spec[maxB + 1];
      const den = 2 * (2 * yC - yL - yR);
      if (den > 0) delta = (yL - yR) / den;
    }
    const hz = (maxB + delta) * res;
    if (hz > 150 && hz < 3000) {
      if (!this.toneValid) {
        if (this.specFrames < 2) { this._emitFreq(); return; }
        this.toneHz = hz; this.toneValid = true;
        this._resetTiming();   // discard pre-lock garbage
      } else {
        this.toneHz = hz;      // averaged spectrum is stable; follow directly
      }
      this._emitFreq();
    }
  }

  _resetTiming() {
    this.envPos = 0; this.envCount = 0;
    this.frameNo = 0; this.decodePos = 0;
    this.Td = 0; this.sepEma = null; this.framesSinceEst = 0;
    this.onLvlLocal = null; this.offLvlLocal = null;
    this.keyOn = false; this.markFrames = 0; this.spaceFrames = 0;
    this.curElems = []; this.charFlushed = true; this.wordEmitted = true;
    this.silent = false; this.charGapEma = 0;
  }

  _emitFreq() {
    if (!this.callback) return;
    const wpm = this.Td > 0 ? Math.round(1200 / (this.Td * this.frameMs)) : 0;
    this.callback({ type: 'freq', hz: Math.round(this.toneHz), wpm });
  }

  // ── Per-frame processing ──────────────────────────────────────────────────
  _processFrame(e) {
    if (!this.toneValid) return;

    // Buffer the raw envelope.
    this.envBuf[this.envPos] = e;
    this.envPos = (this.envPos + 1) % this.BUF;
    if (this.envCount < this.BUF) this.envCount++;
    this.frameNo++;

    // Periodic speed / threshold estimation.
    const hadTd = this.Td;
    if (++this.framesSinceEst >= this.EST_PERIOD || (this.Td === 0 && this.envCount >= this.EST_MIN)) {
      if (this.envCount >= this.EST_MIN) { this._estimateSpeed(); this.framesSinceEst = 0; }
    }
    if (this.Td === 0) { this.decodePos = this.frameNo; return; }  // keep pointer at "now"

    // #3 look-back: on the FIRST speed lock, rewind the decode pointer to the
    // oldest buffered frame and replay everything captured during acquisition,
    // recovering the first word/character otherwise lost to the ~1.5 s lock
    // latency. Td/levels from the lock are applied to those buffered frames.
    if (hadTd === 0) this.decodePos = this.frameNo - this.envCount;

    // Decode all frames up to the current one (normally just the newest; a whole
    // buffer's worth on the first-lock replay).
    while (this.decodePos < this.frameNo) { this._decodeFrame(this.decodePos); this.decodePos++; }
  }

  // Slice + edge-detect one buffered frame (absolute index p) through the
  // matched filter → keying state. Used for both live decoding and replay.
  _decodeFrame(p) {
    const sm = this._boxcarAt(p, this.mfWin);

    // QSB-tracking slice levels. The estimator's onLvl/offLvl are stable but only
    // refreshed every ~0.7 s; a fading signal drifts between updates, so slicing
    // against a static level chops dashes / merges characters. Ride the fade with
    // fast local followers (onLvlLocal/offLvlLocal) that update per-frame from the
    // matched-filter output while gated by the current key state — anchored to the
    // estimator so they can't run away, and with a static fallback if a deep fade
    // collapses the local span.
    let eOn = this.onLvlLocal, eOff = this.offLvlLocal;
    const estSpan = this.onLvl - this.offLvl;
    if (eOn === null || eOn - eOff < 0.25 * estSpan) { eOn = this.onLvl; eOff = this.offLvl; }
    const span = eOn - eOff;
    const HIGH = eOff + 0.55 * span;
    const LOW  = eOff + 0.35 * span;
    let on = this.keyOn;
    if (!this.keyOn && sm > HIGH) on = true;
    else if (this.keyOn && sm < LOW) on = false;

    if (on !== this.keyOn) {
      if (on) this._risingEdge(); else this._fallingEdge();
      this.keyOn = on;
    }

    if (this.keyOn) { this.markFrames++; }
    else { this.spaceFrames++; this._handleGaps(); }

    // Advance the local followers AFTER the decision, gated by key state so marks
    // train the on-level and spaces the off-level. Time constant ≈ 5 dots: fast
    // enough for typical QSB (≈1–3 Hz), slow enough not to collapse within a dash.
    // Followers are clamped to a plausible band around the estimator levels.
    if (this.onLvlLocal !== null) {
      const a = 1 / Math.max(3, 5 * this.Td);
      if (this.keyOn) this.onLvlLocal += a * (sm - this.onLvlLocal);
      else            this.offLvlLocal += a * (sm - this.offLvlLocal);
      const lo = this.offLvl - 0.5 * estSpan, hi = this.onLvl + 0.7 * estSpan;
      if (this.onLvlLocal > hi) this.onLvlLocal = hi;
      if (this.onLvlLocal < this.offLvl + 0.3 * estSpan) this.onLvlLocal = this.offLvl + 0.3 * estSpan;
      if (this.offLvlLocal < lo) this.offLvlLocal = lo;
      if (this.offLvlLocal > this.onLvl - 0.3 * estSpan) this.offLvlLocal = this.onLvl - 0.3 * estSpan;
    }
  }

  // Trailing matched-filter boxcar of `win` frames ending at absolute frame
  // index p (mean of the envelope). Reads the ring by absolute index so it works
  // for replayed frames, not just the newest.
  _boxcarAt(p, win) {
    const BUF = this.BUF, bufStart = this.frameNo - this.envCount;
    const start = Math.max(bufStart, p - win + 1);
    let sum = 0, cnt = 0;
    for (let a = start; a <= p; a++) {
      const idx = ((this.envPos - (this.frameNo - a)) % BUF + BUF) % BUF;
      sum += this.envBuf[idx]; cnt++;
    }
    return cnt > 0 ? sum / cnt : 0;
  }

  _risingEdge() {
    // A mark begins. Learn this operator's character-gap width from the gap that
    // just ended, so word spacing adapts to wide (Farnsworth) sending instead of
    // splitting words at every stretched inter-character gap. Only gaps that did
    // NOT already count as a word (below the current word threshold) feed the
    // estimate, so genuine word gaps don't inflate it.
    const gap = this.spaceFrames, T = this.Td;
    if (gap > T * 1.5 && gap < this._wordThresh()) {
      this.charGapEma = this.charGapEma > 0 ? this.charGapEma * 0.85 + gap * 0.15 : gap;
    }
    this.spaceFrames = 0;
    this.markFrames = 0;
    this.charFlushed = false;
    this.wordEmitted = false;
    this.silent = false;
  }

  // Word-gap threshold. Standard word:char spacing is 7:3 ≈ 2.3×, and Farnsworth
  // stretches both together, so 1.8× the observed character gap tracks either.
  // Defaults to 6·T (handles standard 3T chars / 7T words and moderate stretch)
  // until the character-gap width is learned.
  _wordThresh() {
    const T = this.Td;
    return this.charGapEma > 0
      ? Math.min(T * 12, Math.max(T * 4.5, this.charGapEma * 1.8))
      : T * 6;
  }

  _fallingEdge() {
    const d = this.markFrames;
    this.markFrames = 0;
    this.spaceFrames = 0;
    // Reject marks shorter than ~40 % of a dot (noise spikes through the slicer).
    if (d < this.Td * 0.4) return;
    if (this.curElems.length < 8) this.curElems.push(d);
    this.charFlushed = false;
  }

  // Timeout-driven gap classification against the known dot period T:
  //   <2·T inter-element (do nothing — the char keeps growing)
  //    2·T character gap → flush the character
  //    5·T word gap      → emit a word space
  //   silence            → flush + silence event
  _handleGaps() {
    const T = this.Td;
    if (!this.charFlushed && this.curElems.length > 0 && this.spaceFrames >= T * 2) {
      this._flushChar();
    }
    if (this.charFlushed && !this.wordEmitted && this.spaceFrames >= this._wordThresh()) {
      this.wordEmitted = true;
      this._emitWord();
    }
    const silenceThresh = Math.max(this.silenceFrames, T * 20);
    if (!this.silent && this.spaceFrames >= silenceThresh) {
      this.silent = true;
      this._flushChar();
      if (this.callback) this.callback({ type: 'silence' });
    }
  }

  _emitWord() { if (this.callback) this.callback({ type: 'word' }); }

  // ── Speed & threshold estimation ──────────────────────────────────────────
  // Search dot periods; score each by the best-phase Otsu separability of the
  // envelope integrated into dot-length slots. The winning period is the dot;
  // its on/off class means become the slicer levels. Refuses to lock on noise
  // (separability below MIN_SEP) so idle periods don't produce garbage.
  _estimateSpeed() {
    const W = Math.min(this.envCount, this.EST_WIN);
    if (W < this.EST_MIN) return;

    // Copy the recent window (oldest→newest) and build a cumulative sum.
    const win = new Float64Array(W);
    let idx = this.envPos - W; if (idx < 0) idx += this.BUF;
    for (let j = 0; j < W; j++) { win[j] = this.envBuf[idx++]; if (idx >= this.BUF) idx -= this.BUF; }
    const cum = new Float64Array(W + 1);
    for (let j = 0; j < W; j++) cum[j + 1] = cum[j] + win[j];

    const tdMax = Math.min(this.TD_MAX, W >> 4);   // need ≥16 slots to score
    const scoreArr = new Float64Array(tdMax + 1);
    const m0Arr = new Float64Array(tdMax + 1);
    const m1Arr = new Float64Array(tdMax + 1);
    for (let Td = this.TD_MIN; Td <= tdMax; Td++) {
      const step = Math.max(1, Math.floor(Td / 5));
      let sTd = 0, m0 = 0, m1 = 0, bestVals = null;
      for (let ph = 0; ph < Td; ph += step) {
        const nSlots = Math.floor((W - ph) / Td);
        if (nSlots < 12) continue;
        const vals = new Float64Array(nSlots);
        for (let k = 0; k < nSlots; k++) {
          const x = ph + k * Td;
          vals[k] = (cum[x + Td] - cum[x]) / Td;
        }
        const r = this._separability(vals);
        if (r.sep > sTd) { sTd = r.sep; m0 = r.m0; m1 = r.m1; bestVals = vals; }
      }
      // Separability alone is ambiguous — it is high at the dot, its harmonics,
      // AND every sub-period (all separate cleanly). CW STRUCTURE breaks the tie:
      // at the true dot, runs of "on" slots cluster at 1 (dot) and 3 (dash), and
      // "off" runs at 1/3/7. Combine separability with that run-integer score.
      const runScore = bestVals ? this._runScore(bestVals, (m0 + m1) / 2) : 0;
      scoreArr[Td] = sTd * (0.4 + 0.6 * runScore);
      m0Arr[Td] = m0; m1Arr[Td] = m1;
    }

    // Average the combined score across windows (the true dot is persistent;
    // spurious peaks are random per window). Same idea as the averaged tone lock.
    if (!this.sepEma || this.sepEma.length < tdMax + 1) {
      const prev = this.sepEma; this.sepEma = new Float64Array(tdMax + 1);
      if (prev) this.sepEma.set(prev.subarray(0, Math.min(prev.length, tdMax + 1)));
    }
    const ema = this.sepEma, beta = 0.45;
    let bestScore = 0, bestTd = 0;
    for (let Td = this.TD_MIN; Td <= tdMax; Td++) {
      ema[Td] = ema[Td] * (1 - beta) + scoreArr[Td] * beta;
      if (ema[Td] > bestScore) { bestScore = ema[Td]; bestTd = Td; }
    }
    if (bestTd === 0 || bestScore < 0.35) return;   // no confident CW present

    // Adopt / smooth the estimate.
    if (this.Td === 0 || Math.abs(bestTd - this.Td) > 0.3 * this.Td) this.Td = bestTd;
    else this.Td = Math.round(0.6 * this.Td + 0.4 * bestTd);

    this.mfWin = Math.max(2, Math.round(this.Td * 0.7));

    // #1: narrow the front-end I/Q low-pass to the keying bandwidth now that the
    // dot rate is known. A CW signal only occupies a few × its dot rate; the
    // fixed 50 Hz default passes far more noise (and adjacent QRM) than a slow
    // signal needs. Rejecting it BEFORE the nonlinear magnitude step — where
    // out-of-band noise would otherwise rectify into the envelope — is real
    // weak-signal gain (≈5 dB at 12 wpm). Clamped so fast CW keeps enough
    // bandwidth for clean dit edges.
    // fc ≈ 4.5× the keying rate keeps the 2-pole LP wide enough not to smear a
    // fast dit's edges (rise ≈ 0.35/fc must stay well under a dot), while still
    // narrowing well below the 50 Hz default for slow CW where noise dominates.
    const dotSec = this.Td * this.frameMs / 1000;
    const baud = 1 / (2 * dotSec);                 // dot-dot keying rate
    const fc = Math.min(90, Math.max(15, 4.5 * baud));
    this.lpA = 1 - Math.exp(-2 * Math.PI * fc / this.sr);

    this.offLvl = m0Arr[bestTd];
    this.onLvl  = m1Arr[bestTd];
    if (this.onLvl <= this.offLvl) this.onLvl = this.offLvl * 1.5 + 1e-9;
    // Seed the fast local followers on the first lock; afterwards leave them to
    // track QSB on their own (nudge only if they've drifted implausibly far).
    if (this.onLvlLocal === null) { this.onLvlLocal = this.onLvl; this.offLvlLocal = this.offLvl; }
    this._emitFreq();
  }

  // CW structure score: slice slot values at `thr`, then measure how well the
  // run lengths match valid element counts — on-runs at {1,3} (dot/dash), off-
  // runs at {1,3,7} (element/char/word gaps). Peaks sharply at the true dot,
  // unlike separability which plateaus across every sub-multiple.
  _runScore(vals, thr) {
    const n = vals.length;
    if (n < 8) return 0;
    const runs = [];
    let cur = vals[0] > thr ? 1 : 0, len = 1;
    for (let i = 1; i < n; i++) {
      const on = vals[i] > thr ? 1 : 0;
      if (on === cur) len++; else { runs.push([cur, len]); cur = on; len = 1; }
    }
    runs.push([cur, len]);
    if (runs.length < 4) return 0;
    const onV = [1, 3], offV = [1, 3, 7];
    let sum = 0, cnt = 0;
    for (let i = 1; i < runs.length - 1; i++) {   // skip partial first/last runs
      const on = runs[i][0], L = runs[i][1];
      if (L > 10) continue;
      const V = on ? onV : offV;
      let d = Infinity; for (const v of V) d = Math.min(d, Math.abs(L - v));
      sum += Math.max(0, 1 - d); cnt++;
    }
    return cnt >= 3 ? sum / cnt : 0;
  }

  // Otsu two-class split of `vals`; returns {sep, m0(off mean), m1(on mean)}.
  _separability(vals) {
    const n = vals.length;
    const s = Float64Array.from(vals).sort();
    let total = 0; for (let i = 0; i < n; i++) total += s[i];
    const mean = total / n;
    let varTot = 0; for (let i = 0; i < n; i++) { const d = s[i] - mean; varTot += d * d; }
    varTot /= n;
    if (varTot <= 0) return { sep: 0, m0: mean, m1: mean };

    let best = 0, bestK = 1, wsum = 0;
    for (let k = 1; k < n; k++) {
      wsum += s[k - 1];
      const w0 = k / n, w1 = 1 - w0;
      const m0 = wsum / k, m1 = (total - wsum) / (n - k);
      const bc = w0 * w1 * (m0 - m1) * (m0 - m1);
      if (bc > best) { best = bc; bestK = k; }
    }
    let s0 = 0; for (let i = 0; i < bestK; i++) s0 += s[i];
    const m0 = s0 / bestK, m1 = (total - s0) / (n - bestK);
    return { sep: best / varTot, m0, m1 };
  }

  // ── Dictionary-constrained MAP character decode ───────────────────────────
  _flushChar() {
    const durs = this.curElems;
    this.curElems = [];
    this.charFlushed = true;
    if (durs.length === 0) return;
    const ch = this._mapDecode(durs);
    if (ch && this.callback) this.callback({ type: 'char', char: ch });
  }

  _mapDecode(durs) {
    const n = durs.length;
    const T = this.Td;
    if (T < 1) return null;

    const SIG = 0.35;
    const lnT = Math.log(T), ln3T = Math.log(3 * T);
    const Ldit = new Float64Array(n), Ldah = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      const ln = Math.log(durs[i] + 1e-9);
      const zd = (ln - lnT) / SIG;   Ldit[i] = -zd * zd;
      const za = (ln - ln3T) / SIG;  Ldah[i] = -za * za;
    }

    const list = DECODE_BY_LEN[n];
    if (!list) {
      let code = '';
      for (let i = 0; i < n; i++) code += (Ldah[i] > Ldit[i]) ? '-' : '.';
      return MORSE[code] || `[${code}]`;
    }

    const PRIOR_W = 0.5;
    let best = -Infinity, bestChar = null;
    for (let k = 0; k < list.length; k++) {
      const { bits, char, logPrior } = list[k];
      let score = PRIOR_W * logPrior;
      for (let i = 0; i < n; i++) score += bits[i] ? Ldah[i] : Ldit[i];
      if (score > best) { best = score; bestChar = char; }
    }
    return bestChar;
  }
}
