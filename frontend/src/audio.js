import { createDecoder, firdes_kaiser_lowpass } from './lib/wrappers'
import { DiversityCombiner } from './diversity'
import { RemoteSource } from './remoteSource'
import { KiwiSource } from './kiwiSource'
import { UberSource } from './uberSource'
import { WebSdrSource } from './webSdrSource'
import { ConnectionRefused, isRefusal, isKick, defaultReason } from './refused'
import { loadRnnoise, RNNOISE_FRAME, RNNOISE_RATE, RNNOISE_DELAY } from './lib/rnnoise'
// Opus ML decoder — loaded ON DEMAND, not at startup.
//
// @wasm-audio-decoders/opus-ml is a single 4.1 MB minified file with an
// embedded ML model. A static import put all of it in the initial bundle of
// every page, even though the server only streams Opus when a client is
// switched to it (C-QUAM); receivers configured with audio_compression="flac"
// may never touch it at all. Loading it lazily takes ~3.3 MB gzipped off the
// first paint of both the desktop and the mobile page.
//
// This is safe because OpusMLAdapter was ALREADY asynchronous: isReady starts
// false and decode() discards frames until the underlying decoder resolves, so
// a pending load simply widens a window the pipeline already handles. See
// _createDecoder() below for the generation guard that makes concurrent loads
// (mono→stereo swaps) safe, and prefetchOpusDecoder() for how the first-switch
// delay is hidden.
let _opusMLPromise = null;
function loadOpusMLDecoder() {
  if (!_opusMLPromise) {
    _opusMLPromise = import('@wasm-audio-decoders/opus-ml')
      .then((m) => m.OpusMLDecoder)
      .catch((e) => {
        // Let a later attempt retry rather than caching the failure forever
        _opusMLPromise = null;
        throw e;
      });
  }
  return _opusMLPromise;
}

/**
 * Warm the Opus decoder in the background so the first switch into Opus does
 * not stall on a multi-megabyte download.
 *
 * Skipped on connections that report as slow or metered: a listener on cellular
 * should not silently spend 3.3 MB of their data plan on a decoder they may
 * never need. On those links the decoder still loads on demand — the switch is
 * just slower the first time.
 */
export function prefetchOpusDecoder() {
  if (!OPUS_ENABLED) return;
  try {
    const c = navigator.connection;
    if (c) {
      if (c.saveData) return;
      if (/(^|-)2g$/.test(c.effectiveType || '')) return;
      if (c.effectiveType === '3g') return;
    }
  } catch (e) { /* Connection API absent — assume a normal link */ }

  const start = () => { loadOpusMLDecoder().catch(() => {}) };
  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(start, { timeout: 10000 });
  } else {
    setTimeout(start, 3000);
  }
}

import { decode as cbor_decode } from 'cbor-x';
import { encode } from "./modules/ft8.js";
import { WSPR_TOTAL_SAMPLES, wspr2SlotPosition } from "./modules/wspr.js";
// SSTV runs in its own Worker (sstv.worker.js) via this proxy — the decoder is
// the heaviest client-side DSP and used to stall the main thread; see the header
// of sstv.worker.js.  The proxy keeps the KiwiSSTVDecoder method surface, so the
// call sites below are unchanged, and falls back to in-thread decoding if the
// Worker cannot be created.
import { SSTVWorkerProxy } from './sstvWorkerProxy.js';
// HF FAX likewise — the discriminator runs per sample and adds two quarter-line
// DFTs plus a phasing sweep at every line boundary; see fax.worker.js.
import { FAXWorkerProxy }  from './faxWorkerProxy.js';
// NAVTEX and FSK/RTTY are one shared engine (fsk.js); each role gets its own
// decoder instance and its own worker.  See fsk.worker.js.
import { FSKWorkerProxy }  from './fskWorkerProxy.js';
import { ModeIdWorkerProxy } from './modeIdWorkerProxy.js';
import { VideoRecorder } from './videoRecorder.js';
// CW runs in its own Worker too; the proxy keeps the CWDecoder surface that
// _cwReset/_cwFeedPCM below use.  See cw.worker.js for why CW is fed the
// PROCESSED buffer rather than the raw tap.
import { CWWorkerProxy } from './cwWorkerProxy.js';

// ── Opus master switch ──────────────────────────────────────────────────
// Set false to "kill" Opus in the browser: the client tells the server it
// cannot decode Opus (via the "codec_caps" command on connect), so the server
// keeps C-QUAM on FLAC instead of switching this client to Opus.  Also guards
// the decode path so a stray Opus packet can never reach a disabled decoder.
// Leave true for normal operation.
const OPUS_ENABLED = true;

// All gain sources mapped
// FLAC decoder output  ×175  (line 2440) const flacGain = 175.0                ─┐
// Opus decoder output  ×175  (line 179) const gain = 175.0;                    ─┤→ playAudio() → DSP chain → playPCM() → audioInputNode
// RADE decoded speech  ×0.20 (line 2017) this.radeGainNode.gain.value = 0.20   ─┘ 

import { Js8Reassembler }          from './modules/js8-reassembler.js';
import { decodeFrame as js8DecodeFrame,
         loadDictionary as js8LoadDictionary } from './modules/js8.js';
import { formatJs8Frame }         from './modules/js8-format.js';
import { SUBMODE_PERIOD_S as JS8_PERIOD_S,
         SUBMODE_TXDUR_S  as JS8_TXDUR_S,
         SUBMODE_NAMES    as JS8_NAMES }       from './modules/js8-tables.js';
import { js8Period, js8CaptureSamples,
         js8SlotPos, js8StartWindow }          from './modules/js8-slots.js';

// ── Decoder Web Worker ────────────────────────────────────────────────────
// All heavy decoding (FT8, FT4, WSPR) runs off the main thread so audio
// playback and the UI never freeze at slot boundaries.
const _decoderWorker = new Worker(
  new URL('./decoder.worker.js', import.meta.url),
  { type: 'module' }
);

let _workerReqId = 0;
const _workerPending = new Map();

_decoderWorker.onmessage = ({ data }) => {
  const p = _workerPending.get(data.id);
  if (!p) return;
  _workerPending.delete(data.id);
  if (data.error) {
    console.error(`[Worker] ${data.type} error:`, data.error);
    p.resolve([]);
  } else {
    p.resolve(data.results);
  }
};

_decoderWorker.onerror = (e) => {
  console.error('[Worker] Uncaught worker error:', e);
};

/**
 * Send a PCM buffer to the decoder worker and return a Promise of results.
 * NOTE: we do NOT transfer the buffer — structured clone is used instead.
 * Transfer would detach the pre-allocated accumulator buffer, breaking audio.
 */
function _workerDecode(type, pcm, opts = {}) {
  return new Promise((resolve) => {
    const id  = ++_workerReqId;
    _workerPending.set(id, { resolve });
    _decoderWorker.postMessage({ id, type, pcm, ...opts });
    // No [pcm.buffer] transfer list — structured clone keeps the accumulator intact
  });
}
// ── end worker bridge ─────────────────────────────────────────────────────

import { AudioContext, AudioWorkletNode, ConvolverNode, IIRFilterNode, GainNode, AudioBuffer, AudioBufferSourceNode, DynamicsCompressorNode, MediaStreamAudioDestinationNode } from 'standardized-audio-context'
import { BiquadFilterNode } from 'standardized-audio-context';

// PERF (#1): drop-in replacement for `fft-js`. Same { fft, ifft } interface
// (real-or-pair input → [re,im] pairs), bit-identical output, but an iterative
// radix-2 transform with cached twiddle/bit-reversal tables and reused scratch
// buffers — ~32× faster on the 2048-pt NR round-trip that runs per audio
// buffer on the main thread. Verified against fft-js: scratchpad/fft_verify.mjs.
import { fft, ifft, transformFlat } from './lib/fftRadix2.js';

/* Opus Encoder */
class OpusMLAdapter {
  constructor(targetSampleRate, initialChannels) {
    // targetSampleRate is what the rest of the pipeline expects (e.g. 12000),
    // but the Opus bitstream itself carries its own sample rate, so we mostly
    // use this value for logging and optional resampling if ever needed.
    this.targetSampleRate = targetSampleRate || 48000;
    // Track mono/stereo (1 or 2) for C-QUAM.  Set BEFORE _createDecoder() so the
    // underlying decoder is built at the right channel count immediately —
    // otherwise a later setChannels(2) would free a not-yet-ready mono decoder
    // (its _common is still undefined) and throw during the swap to C-QUAM.
    this.channels = (initialChannels === 2) ? 2 : 1;
    this.decoder = null;
    this.isReady = false;
    // Native-rate tap for timing-sensitive decoders other than FAX.
    // FAX always uses the shared pipeline (rawPcm) for both FLAC and Opus.
    this.lastNativePcm = new Float32Array(0);
    this.lastNativeSampleRate = 48000;
    // Fractional phase accumulators for non-integer resampling in resampleAndGain.
    // Carries the remainder across decode() calls so the output sample rate is
    // exact on average rather than drifting by Math.round() error each frame.
    // Separate L/R accumulators so stereo channels don't share phase state.
    this._resampleAccum  = 0.0;   // mono / stereo-L
    this._resampleAccumR = 0.0;   // stereo-R only
    // Generation counter for the async decoder load — see _createDecoder().
    // MUST be initialised before the first _createDecoder() call below.
    this._decoderGen = 0;
    this._createDecoder();  // ✅ ADDED: Separate decoder creation method
  }
  
  // ✅ ADDED: Separate decoder creation for stereo support
  //
  // Now two-stage: the decoder module is fetched on demand (see
  // loadOpusMLDecoder at the top of this file), then constructed. Callers are
  // unaffected — this method still returns synchronously and decode() already
  // discards frames while isReady is false.
  //
  // GENERATION GUARD: setChannels() calls this again for the mono→stereo C-QUAM
  // swap, and free() can land at any time. With a synchronous constructor those
  // could not interleave, but an awaited load can: a slow first fetch could
  // resolve AFTER a later call and install a decoder with the wrong channel
  // count, or resurrect one that free() had torn down. Every call takes a
  // generation number and abandons its own result if it is no longer current.
  _createDecoder() {
    const gen = ++this._decoderGen;

    if (this.decoder) {
      try {
        this.decoder.free();
      } catch (e) {
        console.warn('Error freeing old OpusMLDecoder:', e);
      }
      this.decoder = null;
    }
    this.isReady = false;

    const channels = this.channels;

    loadOpusMLDecoder()
      .then((OpusMLDecoder) => {
        if (gen !== this._decoderGen) return;   // superseded while loading

        // Let the decoder infer the Opus stream configuration from the frames
        // themselves. Channels can be 1 (mono) or 2 (stereo) for C-QUAM.
        const decoder = new OpusMLDecoder({
          sampleRate: 48000,
          channels,   // ✅ CHANGED: Use this.channels instead of hardcoded 1
          // Opus 1.5 ML speech post-filter. Library default is 'nolace'. This is a
          // separate audio-quality knob ('none' | 'lace' | 'nolace') — not related
          // to the spectrogram display; tune to taste.
          frameDuration: 10,     // 10 ms packets – sweet spot for HF
          forwardErrorCorrection: false,
          lowLatency: true,
        });
        this.decoder = decoder;

        // If the decoder exposes a .ready Promise, wait for it; otherwise assume ready now.
        if (decoder && decoder.ready && typeof decoder.ready.then === 'function') {
          decoder.ready
            .then(() => {
              if (gen !== this._decoderGen) return;
              this.isReady = true;
              console.log('OpusMLDecoder ready, channels=', channels, ', target=', this.targetSampleRate, 'Hz');
            })
            .catch((e) => {
              console.error('OpusMLDecoder.ready rejected', e);
            });
        } else {
          this.isReady = true;
          console.log('OpusMLDecoder created (no ready Promise), channels=', channels);
        }
      })
      .catch((e) => {
        console.error('Failed to load or construct OpusMLDecoder', e);
        if (gen === this._decoderGen) {
          this.decoder = null;
          this.isReady = false;
        }
      });
  }

  decode(encoded) {
    if (!this.decoder || !this.isReady) {
      // Decoder not ready yet; drop frame
      return new Float32Array(0);
    }

    try {
      // Normalise to Uint8Array – CBOR gives us either a Uint8Array already
      // or an ArrayBuffer / typed array view.
      let frame;
      if (encoded instanceof Uint8Array) {
        frame = encoded;
      } else if (encoded instanceof ArrayBuffer) {
        frame = new Uint8Array(encoded);
      } else if (ArrayBuffer.isView(encoded)) {
        frame = new Uint8Array(encoded.buffer, encoded.byteOffset, encoded.byteLength);
      } else {
        // Last-ditch attempt – this should still give us a sane view if it's array-like.
        frame = new Uint8Array(encoded);
      }

      // Prefer the sync decodeFrame() API, which returns a decoded block immediately.
      const result = this.decoder.decodeFrame(frame);

      if (!result || !result.channelData || result.channelData.length === 0) {
        return new Float32Array(0);
      }

      // Apply a modest gain boost for Opus to bring its level closer to FLAC,
      // and to make even very small decoded values audible for debugging.
      const gain = 175.0; // Adjust if it sounds too loud/quiet.

      const nativeGainOnly = (input) => {
        if (!input || input.length === 0) return new Float32Array(0);
        const out = new Float32Array(input.length);
        for (let i = 0; i < input.length; i++) out[i] = input[i] * gain;
        return out;
      };

      // Determine input/output sample rates
      const inSampleRate = result.sampleRate || this.targetSampleRate || 48000;
      const outSampleRate = this.targetSampleRate || inSampleRate;

      // ✅ ADDED: Helper function to resample and apply gain.
      // `accumKey` selects which phase-accumulator field to use so that
      // stereo L and R channels each carry their own fractional remainder
      // across frames without polluting each other's phase state.
      const resampleAndGain = (input, accumKey) => {
        if (!input || input.length === 0) return new Float32Array(0);

        if (inSampleRate && outSampleRate && inSampleRate !== outSampleRate) {
          const ratio = inSampleRate / outSampleRate;
          const rounded = Math.round(ratio);
          if (Math.abs(ratio - rounded) < 1e-6 && rounded >= 1) {
            // ── Integer decimation (e.g. 48000→12000, factor=4) ──────────────
            // Boxcar-average each group of `factor` input samples.
            // Nearest-neighbour (taking input[i*factor] only) aliases the full
            // 0–24 kHz Opus output into the 0–12 kHz band, corrupting the FAX
            // FM phase discriminator.  Boxcar gives a sinc anti-alias response
            // with a first null at outSampleRate, sufficient to suppress alias
            // energy across the FAX tone band (1500–2300 Hz).
            const factor = rounded;
            const outLen = Math.floor(input.length / factor);
            const out = new Float32Array(outLen);
            const invFactor = 1.0 / factor;
            for (let i = 0; i < outLen; i++) {
              const base = i * factor;
              let sum = 0;
              for (let j = 0; j < factor; j++) sum += input[base + j];
              out[i] = sum * invFactor * gain;
            }
            return out;
          }

          // ── Non-integer decimation (e.g. 48000→trueAudioSps≈12207 Hz) ─────
          // Using Math.round(L/ratio) per frame causes a fixed fractional error
          // that accumulates as sample-rate drift (visible as diagonal lean in
          // HF FAX images).  A phase accumulator carried across frames ensures
          // the output rate equals outSampleRate exactly on average.
          // Each channel uses its own accumulator field (accumKey) so L and R
          // are independently phase-accurate.
          const out = [];
          let pos = this[accumKey];          // fractional input position
          while (pos < input.length) {
            const idx  = Math.floor(pos);
            const frac = pos - idx;
            const a    = input[idx];
            const b    = input[Math.min(idx + 1, input.length - 1)];
            out.push((a + frac * (b - a)) * gain);
            pos += ratio;
          }
          this[accumKey] = pos - input.length; // carry remainder to next frame
          return new Float32Array(out);
        }

        // inSampleRate === outSampleRate — gain only, no resampling needed.
        const out = new Float32Array(input.length);
        for (let i = 0; i < input.length; i++) {
          out[i] = input[i] * gain;
        }
        return out;
      };

      let pcm;
      let maxAbs = 0;

      // Native-rate tap (48 kHz, no anti-aliasing).  Not used by any active decoder;
      // retained in case a future timing-sensitive consumer needs it.  FAX was removed
      // from this path — it now uses the shared 12 kHz pipeline like all other decoders.
      this.lastNativeSampleRate = inSampleRate || 48000;
      this.lastNativePcm = nativeGainOnly(result.channelData[0] || new Float32Array(0));

      // ✅ ADDED: Stereo (C-QUAM) handling - interleave L/R channels
      if (this.channels === 2 && result.channelData.length >= 2) {
        // L uses _resampleAccum, R uses _resampleAccumR — independent phase state.
        const L = resampleAndGain(result.channelData[0] || new Float32Array(0), '_resampleAccum');
        const R = resampleAndGain(result.channelData[1] || new Float32Array(0), '_resampleAccumR');
        const len = Math.min(L.length, R.length);

        // Interleave L and R: [L0, R0, L1, R1, L2, R2, ...]
        pcm = new Float32Array(len * 2);
        const step = Math.max(1, Math.floor(len / 32));
        for (let i = 0; i < len; i++) {
          pcm[i * 2] = L[i];
          pcm[i * 2 + 1] = R[i];
          if (i % step === 0) {
            const aL = Math.abs(L[i]);
            const aR = Math.abs(R[i]);
            const a = Math.max(aL, aR);
            if (a > maxAbs) maxAbs = a;
          }
        }
      } else {
        // Mono path (original code)
        const pcmRaw = result.channelData[0] || new Float32Array(0);
        pcm = resampleAndGain(pcmRaw, '_resampleAccum');
        
        const step = Math.max(1, Math.floor(pcm.length / 32));
        for (let i = 0; i < pcm.length; i += step) {
          const a = Math.abs(pcm[i]);
          if (a > maxAbs) maxAbs = a;
        }
      }

      if (result.errors && result.errors.length) {
        console.warn('OpusMLDecoder reported errors for frame:', result.errors[0]);
      }

      return pcm;
    } catch (e) {
      console.error('OpusMLAdapter.decode error', e);
      return new Float32Array(0);
    }
  }

  // ✅ ADDED: Method to switch between mono and stereo for C-QUAM
  setChannels(ch) {
    const wanted = (ch === 2) ? 2 : 1;
    if (wanted === this.channels) return;  // Already at desired channel count
    
    console.log('[OpusMLAdapter] Switching from', this.channels, 'to', wanted, 'channel(s)');
    this.channels = wanted;
    this.isReady = false;
    this._createDecoder();  // Recreate decoder with new channel count
  }

  free() {
    // Bump the generation so a decoder load still in flight abandons its result
    // instead of installing itself into an adapter that has just been torn down.
    this._decoderGen++;
    if (this.decoder && typeof this.decoder.free === 'function') {
      this.decoder.free();
    }
    this.decoder = null;
    this.isReady = false;
    this.lastNativePcm = new Float32Array(0);
  }
}
/**/

// ─────────────────────────────────────────────────────────────────────────────
// Sample-rate conversion for the playback stream.
//
// Normally the AudioContext runs at the stream's own rate and none of this is
// reached. It matters when the two differ: when a browser declines the rate we
// asked for, or under ?ctxrate=native.
//
// The reason it exists at all is that the obvious alternative does not work.
// Handing each arriving packet to the browser as its own AudioBuffer at a rate
// the context does not run at makes the browser resample every packet in
// isolation, so every packet edge becomes a discontinuity — and a discontinuity
// repeating at a steady packet rate is an audible tone, which is exactly what
// testing ?ctxrate=native produced before this existed. Interpolation state has
// to be carried across packets so that the boundaries are not boundaries.
//
// Measured 12k->48k, 12k->44.1k and 12k->22.05k over 80 consecutive blocks:
// no discontinuity anywhere (largest sample-to-sample step equals the smooth
// limit for the tone under test), exact output frame counts, spurious content
// below -60 dBc.
// ─────────────────────────────────────────────────────────────────────────────
// Polyphase windowed-sinc interpolator, state carried across blocks.
const TAPS = 16, PHASES = 512;

function besselI0(x) {
  let s = 1, t = 1
  for (let k = 1; k < 50; k++) { t *= (x / (2 * k)) * (x / (2 * k)); s += t; if (t < 1e-16 * s) break }
  return s
}

function buildBank(cutoff, beta) {
  // cutoff in cycles/input-sample (0.5 == input Nyquist)
  const bank = new Float32Array(PHASES * TAPS)
  const half = TAPS / 2
  const i0b = besselI0(beta)
  for (let p = 0; p < PHASES; p++) {
    const frac = p / PHASES
    let sum = 0
    for (let t = 0; t < TAPS; t++) {
      const x = (t - half + 1) - frac          // distance in input samples
      const s = (x === 0) ? 2 * cutoff : Math.sin(2 * Math.PI * cutoff * x) / (Math.PI * x)
      const r = (t - half + 1 - frac) / half   // window position in [-1,1]
      const w = (Math.abs(r) >= 1) ? 0 : besselI0(beta * Math.sqrt(1 - r * r)) / i0b
      const h = s * w
      bank[p * TAPS + t] = h
      sum += h
    }
    // Normalise each phase to unity DC gain so the output level is flat.
    if (sum !== 0) for (let t = 0; t < TAPS; t++) bank[p * TAPS + t] /= sum
  }
  return bank
}

class PolyResampler {
  constructor(inRate, outRate, channels) { this.reset(inRate, outRate, channels) }
  reset(inRate, outRate, channels) {
    this.inRate = inRate; this.outRate = outRate; this.channels = channels
    this.ratio = inRate / outRate
    // Anti-imaging/anti-aliasing cutoff, in cycles per INPUT sample.
    const c = (outRate >= inRate) ? 0.5 : 0.5 * (outRate / inRate)
    this.bank = buildBank(c * 0.92, 9.0)
    this.hist = new Float32Array(TAPS * channels)   // TAPS previous frames
    // The window for an output at p spans floor(p)-H/2+1 .. floor(p)+H/2, so
    // the read position can never go below H/2-1 without reading off the front
    // of the history. That is also where it starts.
    this.pos = TAPS / 2 - 1
  }
  process(input) {
    const ch = this.channels, H = TAPS
    const n = Math.floor(input.length / ch)
    if (n === 0) return new Float32Array(0)
    const total = H + n
    // Highest position whose window still fits inside hist+input. Getting this
    // wrong is what made the carry underflow: stopping at `total - H` left the
    // next block's position below H/2-1, so its first window reached in front
    // of the history and produced NaN from index -1 onwards.
    const last = n + H / 2 - 1
    // Clamped rather than raw: a non-integer ratio can put the last position of
    // a block one index past the end through floating-point rounding alone, and
    // an unclamped read there returns undefined, which poisons the sample with
    // NaN. Clamping repeats an edge frame in a case that should never arise and
    // is inaudible if it does.
    const at = (j, c) => {
      if (j < 0) j = 0
      else if (j >= total) j = total - 1
      return (j < H) ? this.hist[j * ch + c] : input[(j - H) * ch + c]
    }
    // Largest k with pos + k*ratio <= last, plus one for k = 0. ceil() is wrong
    // here: on an exact ratio it drops the final output of every block.
    let count = Math.floor((last - this.pos) / this.ratio) + 1
    if (count < 0) count = 0
    const out = new Float32Array(count * ch)
    let p = this.pos
    for (let k = 0; k < count; k++) {
      const j = Math.floor(p)
      const ph = Math.min(PHASES - 1, ((p - j) * PHASES) | 0) * H
      for (let c = 0; c < ch; c++) {
        let acc = 0
        for (let t = 0; t < H; t++) acc += this.bank[ph + t] * at(j - H / 2 + 1 + t, c)
        out[k * ch + c] = acc
      }
      p += this.ratio
    }
    this.pos = p - n
    const keep = new Float32Array(H * ch)
    for (let i = 0; i < H; i++) for (let c = 0; c < ch; c++) keep[i * ch + c] = at(total - H + i, c)
    this.hist = keep
    return out
  }
}

export default class SpectrumAudio {

  constructor(endpoint) {


    // For Recording
    this.isRecording = false;
    this.recordedAudio = [];

    // Added to allow for adjustment of the //
    // dynamic audio buffer //
    // ── Audio buffer latency tuning ─────────────────────────────────────────
    // These are the two knobs behind the buffer presets in the UI, and they
    // drive BOTH playback paths — do not raise one without the other:
    //
    //   bufferLimit      — how much audio may sit buffered ahead of the
    //                      listener (seconds). On the worklet path (everyone,
    //                      since the AudioWorklet fix) this becomes the ring
    //                      buffer ceiling via _workletBufferOptions(); on the
    //                      fallback path it is the point at which playTime is
    //                      judged to have drifted too far ahead and is reset.
    //                      Current: 0.25s  Safe range: 0.15 – 2.50s
    //
    //   bufferThreshold  — underrun recovery point (seconds): how much audio
    //                      must be buffered before playback (re)starts, and
    //                      where playTime is reset to after a dropout.
    //                      Raising this adds steady-state latency directly.
    //                      Current: 0.01s  Safe range: 0.01 – 0.50s
    //
    // Both reach the worklet through _workletBufferOptions() — at construction
    // and again on every setAudioBufferDelay() call, so a listener on a jittery
    // mobile link can raise the buffer mid-session and hear it take effect.
    // Note that the worklet applies its own hard floors (see that file), so a
    // very small value here may be clamped rather than honoured.
    // Note: RADE decoding has its own ~260ms pipeline latency and is not
    // affected by any of these values.
    // ────────────────────────────────────────────────────────────────────────
    this.bufferLimit = 0.25;      // ring buffer ceiling / overrun ceiling
    this.bufferThreshold = 0.01;  // 10ms underrun recovery point

    // ── A dropped socket is the end of the session ──────────────────────────
    // There is deliberately no reconnect here. This page briefly had one, with
    // backoff, borrowed from the chat-app pattern, and it was wrong for a
    // receiver: /waterfall and /events never came back with it, so a retried
    // session was a live audio socket attached to a frozen waterfall, and the
    // sysop's user list filled with sessions nobody was really in. Stopping
    // the server no longer cleared it either — everyone was back seconds
    // later. A WebSDR drop ends the session; the listener loads the page
    // again, which is one action and leaves no half-alive state behind.
    //
    // onConnectionChange, if set, is called with 'connected' | 'lost' |
    // 'failed' | 'refused'. All but 'connected' are final.
    this.onConnectionChange = null;
    // Set when the server refuses this session outright; see
    // _handleSocketTerminal() and ConnectionRefused in refused.js.
    this.refusedReason = null;
    // Set by the page before init(); see _wantsNativeContextRate().
    this.preferNativeContextRate = false;
    this._stopped = false;
    this._everConnected = false;

    // AudioWorklet / fallback diagnostics and hardening
    this._streamForceFallback = false;
    this._loggedWorkletPlayback = false;
    this._loggedFallbackPlayback = false;
    this._loggedWorkletFailure = false;
    this._streamStats = null;

    this.endpoint = endpoint

    this.playAmount = 0

    this.playMovingAverage = []
    this.playSampleLength = 1
    this.audioQueue = []

    this.demodulation = 'USB'
    this.channels = 1  // ✅ ADDED: Track mono/stereo (1 or 2) for C-QUAM

    // Receive diversity (see diversity.js).  Both stay null until
    // startDiversity() is called; every path below is a no-op while they are.
    this.diversity = null
    this.diversityRemote = null

    // Decoders
    //
    // FTx slot capture follows KiwiSDR's decode_ft8.c: the capture window opens
    // at the UTC slot boundary plus `ftxTimeShift` seconds and runs for
    // (slot_period - 0.4) s. The shift compensates for the streaming/jitter
    // buffer latency — audio arriving now was actually received a moment ago.
    //
    // Unlike Kiwi, which decodes server-side and so has a fixed local buffer
    // depth, we decode in the browser: the latency being compensated includes
    // the whole network path to *this* client. It therefore differs per
    // installation AND per visitor, and no constant can be right for everyone.
    // So the value self-calibrates from the decoders' own DT measurement — see
    // _ftxAutoCalibrate(). 0.8 s (ft8_lib's default) is only the starting seed.
    // Stored PER MODE. The optimal shift is not the same for all three: the
    // capture windows have different slack (1.96 s for FT8 against 0.83 s for
    // FT2), so the ideal DT — and hence the shift — differs. Measured on air:
    // FT8 settles near 0.03 s where FT2 needs ~0.35 s on the same pipeline.
    // A single shared value left FT2 parked at FT8's optimum, far outside
    // FT2's -0.24..+0.46 s tolerance, so it decoded nothing and the loop could
    // never bootstrap.
    this.ftxShift = {
      FT8: this._ftxLoadPref('ftxShift.FT8', 0.8),
      FT4: this._ftxLoadPref('ftxShift.FT4', 0.8),
      FT2: this._ftxLoadPref('ftxShift.FT2', 0.8),
    };
    this.ftxActiveMode = 'FT8';
    this.ftxAutoSync   = this._ftxLoadPref('ftxAutoSync', 1) ? true : false;

    // DT samples accumulate ACROSS slots, per mode. Requiring several in a
    // single slot makes auto-sync useless on sparse modes — an FT2 band may
    // carry exactly one signal, so a per-slot threshold never fires.
    this._ftxDtHistory = { FT8: [], FT4: [], FT2: [] };

    // Consecutive slots that decoded nothing, per mode. Drives the bootstrap
    // sweep in _ftxBootstrapShift() — see why the loop cannot self-recover
    // without it.
    this._ftxDrySlots = { FT8: 0, FT4: 0, FT2: 0 };

    // Whether this mode's shift has been proved by an actual decode in this
    // session. Until it has, a long silence may mean the stored shift is wrong
    // and the sweep may look for a better one; afterwards a silence is just a
    // quiet band, and the shift is left alone.
    this._ftxShiftProved = { FT8: false, FT4: false, FT2: false };

    // ── JS8 state ───────────────────────────────────────────────────────
    // One submode is active at a time (0=Normal 1=Fast 2=Turbo 3=Slow
    // 4=Ultra). Slot scheduling aligns to the T/R CYCLE, which for Slow is
    // 30 s even though a station only transmits for 28 of them.
    this.decodeJS8          = false;
    this.js8Submode         = this._ftxLoadPref('js8.submode', 0);
    this.isJS8Collecting    = false;
    this.js8Accumulator     = null;   // pre-allocated in _initAccumulators()
    this.js8AccumulatorLen  = 0;
    this.maxJS8AccumulatorSize = 12000 * 31;   // sized for Slow's 30 s cycle
    // Each submode gets its own capture lead-in: their start delays differ
    // (0.5 / 0.2 / 0.1 / 0.5 / 0.1 s) and so do their timing tolerances.
    for (let i = 0; i < JS8_NAMES.length; i++) {
      const key = `JS8:${i}`;
      this.ftxShift[key] = this._ftxLoadPref(`ftxShift.${key}`, 0.8);
      this._ftxDtHistory[key] = [];
    }
    // Holds partial multi-frame messages across slots. Feeding it is the whole
    // point of decoding JS8 rather than treating each frame as a message.
    this.js8Reassembler = new Js8Reassembler({
      onMessage: (m) => {
        if (typeof this.onJS8Message === 'function') this.onJS8Message(m);
      },
    });
    this.onJS8Message = null;   // set by the UI

    // ── Mini audio spectrum for the decoder panel ────────────────────────
    // Max-hold across the current slot. FT signals are short bursts of hopping
    // tones, so an instantaneous spectrum mostly shows gaps; holding the peak
    // per bin draws each station as a steady mark at its audio frequency,
    // which is what makes it comparable with the Hz column.
    this._ftxSpec  = this._makeSpec(4096);   // 2.93 Hz/bin at 12 kHz
    // WSPR gets a 4x longer transform. Its whole band is only 220 Hz wide and
    // a busy one packs stations a few Hz apart; measured with Hann windowing,
    // 4096 merges any pair closer than ~6 Hz, while 16384 still separates them
    // at 3 Hz. 0.73 Hz bins also match the resolution the WSPR decoder itself
    // works at (DF2 in wspr.js). One transform per 1.37 s of a 2-minute slot,
    // so the extra cost is irrelevant.
    this._wsprSpec = this._makeSpec(16384);  // 0.73 Hz/bin at 12 kHz

    this.decodeFT4      = false;
    this.isFT4Collecting = false;
    this.ft4Accumulator    = null;  // pre-allocated in _initAccumulators()
    this.ft4AccumulatorLen = 0;
    this.maxFT4AccumulatorSize = 90000 * 2;

    // FT2 state — 3.75 s T/R slots
    this.decodeFT2          = false;
    this.isFT2Collecting    = false;
    this.ft2Accumulator     = null;
    this.ft2AccumulatorLen  = 0;
    this.maxFT2AccumulatorSize = 45000 * 2;

    // WSPR-2 state — 2-minute slots on even UTC minutes
    this.decodeWSPR         = false;
    this.isWSPRCollecting   = false;
    this.wsprAccumulator    = null;  // pre-allocated in _initAccumulators()
    this.wsprAccumulatorLen = 0;
    this.wsprDialFreqHz     = 0;
    this.wsprTimer          = null;
    this.maxWSPRAccumulatorSize = 12000 * 125;

    this.accumulator    = null;   // pre-allocated in _initAccumulators()
    this.accumulatorLen = 0;
    this.decodeFT8 = false;
    this.farthestDistance = 0;   // ✅ FIXED: was undefined → distance > undefined always false
    this.nb = false;
    // Separate client-side toggles. These are independent: NB is an impulse
    // blanker, NR is spectral noise reduction. Only the legacy `this.nb`
    // master switch means "both".
    this.nbBlankerEnabled = false; // impulsive noise blanker
    this.nrEnabled = false;        // spectral noise reduction
    // Blanker state, one set per channel so C-QUAM L and R don't share an
    // envelope follower (they used to, which made each channel blank on the
    // other's impulses).
    this._nbCh = [this._makeNBChannelState(), this._makeNBChannelState()];

    // Adaptive noise-cancel gate (works for FLAC & Opus)
    this.noiseCancelEnabled = true;
    this.noiseEnv           = 0;
    this.noiseFloor         = 0.001;
    this.noiseGateOpen      = true;
    this.noiseGatePreset    = 'balanced'; // Options: balanced, aggressive, weak-signal, smooth, maximum, cw, am-fm

    // Audio controls
    this.mute = false
    this.squelchMute = false
    this.squelch = false
    this.squelchThreshold = 0
    this.power = 1;
    this.dBPower = -130;
    this._dBQueue = [];
    this.ctcss = false
    this.ctcssToneHz = null;          // null => accept any valid CTCSS tone
    this.ctcssMute = false;           // true while tone squelch should hold audio closed
    this._ctcssEnabled = false;
    this._ctcssDetectThreshold = 0.20;  // confidence = bestPower/sumSq; real tones >> 0.5, noise << 0.05
    this._ctcssNeighborReject = 2.5;    // separation vs secondPower; at N=4096 legit seps are >> 10
    this._ctcssMinRms = 0.008;          // raised from 0.003; filters sub-threshold noise frames early
    this._ctcssHoldMs = 220;
    this._ctcssLastOpenMs = 0;
    this._ctcssDetectedToneHz = null;
    this._ctcssDetectBuffer = new Float32Array(4096); // 341 ms @ 12 kHz — 2.93 Hz/bin resolves all CTCSS pairs
    this._ctcssDetectFill = 0;
    this._ctcssHpState = 0;
    this._ctcssHpPrevIn = 0;
    this._ctcssLpState = 0;
    // Consecutive-detection gate: gate opens only after this many back-to-back
    // window detections (~openCount x 341 ms). A single spurious window
    // (noise spike, brief interference) cannot open the squelch.
    this._ctcssConsecutive = 0;
    this._ctcssOpenCount   = 3;         // ~1 s of sustained tone required
    this._ctcssStdTones = [
      67.0, 71.9, 74.4, 77.0, 79.7, 82.5, 85.4, 88.5, 91.5, 94.8,
      97.4, 100.0, 103.5, 107.2, 110.9, 114.8, 118.8, 123.0, 127.3,
      131.8, 136.5, 141.3, 146.2, 151.4, 156.7, 159.8, 162.2, 165.5,
      167.9, 171.3, 173.8, 177.3, 179.9, 183.5, 186.2, 189.9, 192.8,
      196.6, 199.5, 203.5, 206.5, 210.7, 218.1, 225.7, 229.1, 233.6,
      241.8, 250.3, 254.1
    ];
    
    // Spectrogram integration
    this.spectrogramCallback = null
    this.spectrogramEnabled = false

    // QRSS grabber integration.  Separate from the spectrogram tap on purpose:
    // both panels can be open at once, and each tap is single-consumer.
    this.qrssCallback = null
    this.qrssEnabled = false

    // CW Decoder state — initialised by _cwReset()
    this.decodeCW = false;
    this.cwCallback = null;
    this._cwReset();

    // ── HF FAX / WEFAX decoder state ─────────────────────────────────────
    this.decodeFAX   = false;
    this.faxCallback = null;
    this._faxDecoder = new FAXWorkerProxy({
      sampleRate: () => this.audioOutputSps || 12000,
      callback: (event) => {
        if (typeof this.faxCallback === 'function') this.faxCallback(event);
      }
    });

    // ── SSTV decoder state (Kiwi-style raw PCM path) ──────────────────────
    this.decodeSSTV   = false;
    this.sstvCallback = null;
    this._sstvForcedMode = 'auto';
    this._sstvDecoder = new SSTVWorkerProxy({
      sampleRate: () => this.audioOutputSps || this.trueAudioSps || this.audioMaxSps || 12000,
      callback: (event) => {
        if (typeof this.sstvCallback === 'function') this.sstvCallback(event);
      },
      defaultMode: this._sstvForcedMode
    });
    this._sstvReset();

    // ── NAVTEX / SITOR-B decoder state ───────────────────────────────────
    this.decodeNAVTEX   = false;
    this.navtexCallback = null;
    this._navtexDecoder = new FSKWorkerProxy({
      role: 'navtex',
      sampleRate: () => this.trueAudioSps || this.audioOutputSps || 12000,
      callback: (event) => {
        if (typeof this.navtexCallback === 'function') this.navtexCallback(event);
      }
    });

    // ── RADE v1 digital voice decoder state ──────────────────────────────
    this.decodeRADE    = false;
    this._radeSideband = 'USB';
    this._radeSocket   = null;
    this._radeCallback = null;
    this._radeReady    = false;
    this._radeNextTime = 0;    // scheduled end-time of last RADE audio chunk
    this._radeSources  = new Set(); // active/scheduled RADE decoded-audio sources

    // ── Mode identifier ("what am I listening to?") ───────────────────────
    // Not a decoder: it measures the signal and ranks which decoder to use.
    // Off by default, and it only costs anything while it is switched on.
    this.decodeModeID   = false;
    this.modeIDCallback = null;
    this._modeIdEngine  = new ModeIdWorkerProxy({
      sampleRate: () => this.trueAudioSps || this.audioOutputSps || 12000,
      callback: (event) => {
        if (typeof this.modeIDCallback === 'function') this.modeIDCallback(event);
      }
    });

    // ── Generic Kiwi-style FSK decoder state (weather / maritime / ham) ──
    this.decodeFSK   = false;
    this.fskCallback = null;
    this.fskVariant  = 'maritime';
    this._fskDecoder = new FSKWorkerProxy({
      role: 'fsk',
      variant: this.fskVariant,
      sampleRate: () => this.trueAudioSps || this.audioOutputSps || 12000,
      callback: (event) => {
        if (typeof this.fskCallback === 'function') this.fskCallback(event);
      }
    });
    
    // Remove the element with id startaudio from the DOM

    // Frontend audio-level control state (playback-only; backend AGC stays in charge)
    this.agcGain = 1;
    this.agcEnvelope = 0;
    this.agcLookaheadBuffer = [];
    this.userGain = 1.0;
    this.audioLevelGain = 1.0;
    this.audioLevelEnabled = true;
    this.audioLevelMode = 0;   // 0=Auto/Bypass, 1=Fast, 2=Medium, 3=Slow
    this.audioLevelRms = 0.0;
    this.audioLevelPeak = 0.0;
    this.audioLevelTarget = 0.22;
    this.audioLevelMaxBoost = 1.8;
    this.audioLevelAttack = 0.10;
    this.audioLevelRelease = 0.03;

    // ── Noise Blanker (impulsive) parameters ────────────────────────────────
    this.nbEnabled = false;       // legacy alias, kept for callers that set it
    this.nbBlankRatio  = 3.5;     // blank when |sample| > 3.5x envelope (~11 dB)
    this.nbHoldMs      = 1.2;     // blanking window per impulse — a static crash
                                  // is well under a millisecond; 5 ms (the old
                                  // value) punched audible holes in speech
    this.nbLookahead   = 4;       // samples of look-ahead so the impulse's own
                                  // rising edge is inside the blanked window
    this.nbRampSamples = 3;       // cosine in/out ramp — hard zeroing a sample
                                  // is itself a click, i.e. more impulse noise
    this.nbAttackTC    = 0.020;   // 20 ms — deliberately SLOW so the envelope
                                  // does not rise with the impulse it must detect
    this.nbReleaseTC   = 0.200;   // 200 ms — stable floor, doesn't chase QSB
    this.nbBlankedSamples = 0;    // diagnostics: how much audio got blanked
    this.nbTotalSamples   = 0;

    // ── Noise Reduction (spectral, weighted overlap-add) ────────────────────
    // Frame/hop for the WOLA analysis. 512 @ 12 kHz = 42.7 ms window, 23 Hz
    // bins, 75% overlap. Latency is one frame, paid only while NR is on.
    this.nrFFTSize     = 512;
    this.nrHop         = 128;
    this.nrStrengthDB  = 14;      // maximum attenuation applied to a noise bin
    this.nrDownTC      = 0.3;     // noise floor tracker: falls fast to find quiet
    this.nrUpTC        = 2.5;     // ...rises slowly so speech can't drag it up
    this.nrAlphaDD     = 0.96;    // decision-directed a-priori SNR smoothing
    this.nrTonalTC     = 0.5;     // averaging time for the tonality test
    this.nrTonalRelVar = 0.30;    // below this |X| std/mean a bin counts as
                                  // tonal (carrier, CW, birdie) and is never
                                  // absorbed into the noise floor
    this.nrTonalDecayTC = 1.0;    // how fast the floor backs away from a bin
                                  // judged tonal
    this.nrOverSub     = 2.0;     // over-subtraction: the tracked floor is a
                                  // mean, and half of a Rayleigh-distributed
                                  // noise bin sits above its own mean, so
                                  // treating the floor as the noise level
                                  // under-suppresses. 2.0 in power ≈ +3 dB.
    this._nrCh = [null, null];    // per-channel WOLA state, built on demand

    // ── AI Noise Reduction (RNNoise, lib/rnnoise.js) ────────────────────────
    // A speech model, so it is scoped to the voice modes: on CW it erases the
    // tone outright, and on data modes it would mangle what the decoders
    // see. Decoders are fed from the raw tap anyway, before any of this.
    // Latency: 20 ms inside RNNoise + up to one 10 ms frame of buffering.
    this.aiNrEnabled   = false;
    this.aiNrMix       = 1.0;     // 0 = original audio, 1 = fully denoised
    // The slider's top end is softened: full scale was too aggressive on air
    // ("speech damaged"). Measured at -3 dB SNR: at full wet the speech itself
    // came out 4.4 dB down (2.3 dB at the 50% default), water 0.97, breathing
    // 5.56. Mapping full scale to 85% wet with the cut limited to 20 dB gives
    // speech -2.6 dB, water 0.53, breathing 2.90 and slightly better ESTOI,
    // while still cleaning more than 50% does. The curve keeps 0 -> 0 and
    // 0.5 -> 0.5, so the default setting is untouched, and the deepest cut
    // only tightens above 50%.
    this.aiNrTopWet       = 0.85; // wet share at slider 100% (1 = old behaviour)
    this.aiNrTopFloorDB   = 20;   // deepest cut at slider 100% (aiNrMaskFloorDB at <= 50%)
    // Make-up gain. RNNoise takes weak speech for noise: at -6 dB SNR it still
    // improves SNR ~5 dB, but pulls speech and noise both down ~15 dB, so a
    // weak station simply goes quiet. Restoring the long-term level keeps the
    // SNR gain and brings the station back (measured: -3 dB SNR speech back to
    // 0 dB with the noise 10 dB down). The cap bounds how far hiss on an empty
    // channel comes back up: -48 dB plain, about -33 dB at +15 dB.
    this.aiNrMakeupTC     = 2.0;  // seconds
    this.aiNrMakeupMaxDB  = 15;
    // ...but never louder than the input was at that moment. The slow gain
    // climbs during a fade (QSB), and when the station came back it was still
    // up: measured up to +10 dB over the unprocessed audio for a moment, and
    // clipping — heard as distortion on weak and fading signals. So the gain
    // is also capped by the ratio of short-term (50 ms) input to output level.
    this.aiNrCapTC        = 0.05; // seconds
    // Speech-aware strength, from RNNoise's own voice-activity flag. Measured
    // on the test set: at the slider's 50% the in-word "watery" gain wobble is
    // near the unprocessed figure but only ~6 dB of noise goes; at 100% the
    // pauses lose 28-38 dB but speech wobbles 7-11 dB and the leftover hiss
    // turns tonal. So the slider sets the strength WHILE SOMEONE TALKS, and in
    // the pauses the original audio's share is cut to aiNrPauseDry of that
    // (50% -> 80% wet). Result at 50%: 10-11 dB of noise gone in the pauses
    // instead of 6, same in-word wobble and hiss texture, breathing 2.5-3 dB
    // (was 1). Going to 100% in the pauses was worse: RNNoise's musical noise
    // plus the hiss pumping 11-13 dB on every false flag.
    // Tying the pause share to the slider keeps the hiss swing the same
    // (~8 dB) at any slider setting.
    // The flag is 20 ms ahead of RNNoise's output — a free lookahead, so the
    // switch to speech strength lands before the word does. Leaving speech is
    // held, then ramped, so word tails and short gaps are not treated as pauses.
    this.aiNrPauseDry     = 0.4;  // original audio's share in pauses, relative to speech (1 = off)
    this.aiNrVadThresh    = 0.5;  // flag level counted as speech (0.3 flags ~10% of pauses, 0.5 ~5%)
    this.aiNrVadHoldMs    = 200;  // stay in speech mode this long after the flag drops
    this.aiNrPauseRampMs  = 150;  // then move to the pause strength over this long
    this.aiNrMakeupGated  = true; // make-up gain learns only while speech is flagged
    // Mask mode: RNNoise's output is not played. Its per-band gain is read off
    // (output / input, per FFT bin, averaged over ±aiNrMaskSmoothHz), smoothed
    // in time (fast up, slow down), floored, and applied to the ORIGINAL audio.
    // RNNoise's own gains jump every 10 ms per band — the "watery" wobble and
    // the tonal leftovers in the pauses; the smoothing removes both.
    this.aiNrMaskMode      = true;
    this.aiNrMaskSmoothHz  = 150;  // frequency smoothing of the gain, ± Hz
    this.aiNrMaskAttackMs  = 5;    // gain may rise this fast (word starts)
    this.aiNrMaskReleaseMs = 40;   // ...and fall only this slowly (no wobble).
                                   // 80 ms smoothed more but cost intelligibility
                                   // (ESTOI -0.01..-0.02); 5/40 matches step 2's.
    this.aiNrMaskFloorDB   = 30;   // deepest cut
    this.aiNrMaskWinMs     = 21;   // analysis window (256 points at 12 kHz)
    // Weak-signal adaptation. On weak stations RNNoise cannot tell speech from
    // noise moment to moment and its gains jump — the "watery" sound that is
    // still audible there after smoothing. A running SNR (speech-flagged level
    // vs pause level, 1.5 s averages; on the test set it tracks the true SNR
    // within about ±3-4 dB) gives a weakness factor q: 0 at aiNrWeakSnrHi and
    // above (behaviour exactly as without it), 1 at aiNrWeakSnrLo and below.
    // q can (1) lower the strength while speech is flagged and (2) slow the
    // mask's attack and release and widen its frequency smoothing. Both follow
    // the same q, so they cannot work against each other. Measured with a
    // per-band "water" score (frame-to-frame jump of the applied gain inside
    // words, 0 = untouched): (2) at 25/150 ms, ±350 Hz cuts it 24% at -6/-3 dB
    // SNR at the 50% default, keeps the pause cleaning and the breathing, costs
    // ~1 dB of weak speech level. Slowing only the release did almost nothing —
    // the water is as much the gain jumping UP. (1) adds nothing at 50% and at
    // 100% trades 3-5 dB of pause cleaning and more breathing for less water,
    // so it ships off (cut 0) and stays available.
    this.aiNrWeakAdapt        = true;
    this.aiNrWeakSnrLo        = -3;    // dB: fully "weak"
    this.aiNrWeakSnrHi        = 6;     // dB: fully "strong"
    this.aiNrWeakTC           = 1.5;   // s, averaging of the two levels
    this.aiNrWeakStrengthCut  = 0;     // (1) strength while talking × (1 - cut·q); off
    // Chosen by ear on the test clips 2026-09-20, over 25/150/350 and 80/500:
    // the water at -3 dB SNR falls another 28% (0.64 -> 0.46) for ESTOI -0.010,
    // 1 dB less weak speech, 1.5 dB less pause cleaning and a little more
    // breathing (2.40 -> 2.76). Signals at +6 dB SNR and above are untouched.
    this.aiNrWeakAttackMs     = 120;   // (2) mask attack at q = 1 (5 at q = 0)
    this.aiNrWeakReleaseMs    = 1000;  // (2) mask release at q = 1 (40 at q = 0)
    this.aiNrWeakSmoothHz     = 450;   // (2) mask smoothing at q = 1 (150 at q = 0)
    // Hold the mask up longer WHILE SOMEONE IS TALKING (0 = same release as in
    // the pauses). Between syllables and between a voice's harmonics the bands
    // fall back and rise again, which is the watery sound; a longer release
    // there rides over it, while the pauses keep the fast release so the noise
    // still drops quickly when the over ends.
    this.aiNrSpeechReleaseMs  = 0;
    // Deepest cut allowed at q = 1 (aiNrMaskFloorDB at q = 0). The water is the
    // gain jumping in dB, so bounding its range bounds the jumps.
    this.aiNrWeakFloorDB      = 30;
    this.aiNrModes     = ['USB', 'LSB', 'AM', 'SAM'];
    this._aiNrEngine   = null;    // resolved RnnoiseEngine, loaded on first use
    this._aiNrCh       = [null, null];

    // === Background Noise Measurement & Fixed Suppression ===
    this.bnFFTSize         = 512;
    // bnFFTSize (512 @ 12 kHz = 23 Hz bins, 42.7 ms window)
    // 1024 — finer bins and a steadier floor estimate, at double the latency
    //  256 — half the latency, coarse bins; only if CPU or delay really matters
    // Hop, not "overlap": 75% overlap, matching the NR stage. One window of
    // latency (512 @ 12 kHz = 42.7 ms) is paid only while NS is on.
    this.bnHop             = 128;
    this._bnCh             = [null, null];  // per-channel WOLA + floor state
    // Noise floor by minimum statistics (Martin's method): smooth each bin,
    // then take the minimum of the smoothed value over a sliding window and
    // correct for the known downward bias of a minimum.
    //
    // The tracker this replaces was fall-fast (4 s) / rise-very-slowly (300 s),
    // which converges on the *minimum* of a fluctuating bin while the
    // classifier compared against it as though it were the mean. Measured
    // against steady band noise the floor settled 4.5x (13 dB) low, so noise
    // bins scored ~4.5 against a threshold of 2.0 and were classified as
    // SIGNAL: NS passed through almost everything it was meant to suppress
    // (-0.3 dB on noise-only audio). A relative gate instead of the minimum
    // was worse — once the floor landed low, every frame read as signal and
    // it could never climb back.
    this.bnSmoothTC         = 0.5;   // seconds — per-bin smoothing before the min
    this.bnMinWindowSec     = 9;     // seconds — sliding window for the minimum
    this.bnMinSubWindows    = 4;     // split into this many sub-windows (O(1) min)
    this.bnFloorBias        = 1.20;  // corrects the minimum back up to the mean;
                                     // measured against Rayleigh-distributed
                                     // bins at the smoothing/window above
    this.bnClassifyRatio    = 2.00;    // bins within this ratio of the floor are classified as noise
    // bnClassifyRatio (noise vs signal threshold, currently 1.25×)
    // 1.2 — tighter; only classifies bins very close to floor as noise — less risk of nibbling signal
    // 1.8 — wider; catches more noise bins but more likely to clip quiet SSB sidebands
    // 2.0 — aggressive; useful when noise floor is flat and well-characterised
    // 1.35 — a conservative middle ground between 1.2 and 1.5    
    this.bnSuppressionDB    = 12;     // suppression depth at the LOW end of the band (below bnTiltLowHz=300Hz)
    // bnSuppressionDB (low-end cut depth, currently 9 dB)
    // 3 — gentle; just takes the edge off without audible effect on band character
    // 9 — noticeable improvement on a quiet band without killing low-frequency hiss
    // 12 — strong cut; good if LF band noise dominates
    // 0 — effectively disables low-end suppression while keeping the tilt active    
    this.bnSuppressionDBHigh = 30
    // bnSuppressionDBHigh (high-end cut depth, currently 26 dB)
    // 12 — less aggressive HF cut; better if the tilt feels like it's muffling weak signals
    // 18 — previous tested value, a reasonable midpoint
    // 30 — maximum useful cut before noise-classified bins become inaudible gaps
    // 36 — essentially silences HF noise bins; only suitable if bnClassifyRatio is tight (≤1.3)    
    this.bnTiltLowHz         = 300
    this.bnTiltHighHz        = 2500
    // bnTiltHighHz (top of tilt ramp, currently 2500 Hz)
    // 2500 — keeps full suppression away from the upper SSB edge, safer for DX
    // 3000 — extends into the filter skirt (fine if your BPF rolls off before 3 kHz)
    // 2200 — a more conservative top-end; leaves 2.2–3 kHz fully unaffected    
    this.bnEnabled          = false; // off by default — toggled via the NS button in the UI, scoped to bnModes below
    this.bnModes            = ['USB', 'LSB', 'AM']; // scope — SSB + AM per the stated goal, nothing else

    // Soft-knee width around bnClassifyRatio, as a fraction of the threshold.
    // A hard yes/no cut right at the ratio boundary means a bin that's 1%
    // above/below the line gets a totally different gain — that's what
    // nibbles the edges of real signal and causes musical-noise chatter on
    // borderline bins. Widening this softens the decision into a ramp.
    // Deliberately asymmetric: the low (noise) side is narrow so bins that
    // are clearly below the floor reach full suppression depth quickly —
    // that's where the extra strength comes from. The high (signal) side
    // stays wide, which is what keeps real audio protected: nothing gets
    // more suppression as a *result* of this change unless it was already
    // well inside the "noise" side of the boundary.
    this.bnKneeRatioLow     = 0.12;
    this.bnKneeRatioHigh    = 0.35;
    // Per-bin gain is smoothed over time, deliberately asymmetric:
    // fast attack (open up) so a real signal appearing doesn't get clipped
    // on its first block, slow release (clamp down) so a bin doesn't
    // chatter open/closed across blocks that are individually noisy —
    // that chatter is what's audible as "musical noise".
    this.bnGainAttackMs     = 8;
    this.bnGainReleaseMs    = 180;

    // ── Auto Notch Filter (ANF) ──────────────────────────────────────────────
    // NLMS adaptive linear predictor: learns to predict tonal interference
    // (carriers, birdies, heterodynes) and subtracts it in real time.
    // Broadband audio (voice, CW) is unpredictable → passes through as the
    // prediction *error* and is therefore preserved.
    this.anfEnabled       = false;
    this.anfTaps          = 64;     // FIR predictor length  (more = more simultaneous notches)
    this.anfDelay         = 2;      // decorrelation delay in samples (1–4 for SSB/AM; ≥8 for FM)
    this.anfMu            = 0.01;   // NLMS step size (0.005=slow/stable … 0.05=fast/aggressive)
    // A CW signal *is* a steady tone, so the predictor cancels the very thing
    // the operator is listening to. Every hardware radio bypasses its notch in
    // CW for that reason; do the same rather than silently gutting the signal.
    this.anfBypassCW      = true;
    // Delay picked per mode by _anfApplyModeDefaults(): short for SSB/AM so
    // close-in heterodynes decorrelate, longer for FM whose recovered audio is
    // itself correlated over a few samples.
    this.anfDelaySSB      = 2;
    this.anfDelayFM       = 8;
    this._anfAllocate();
    // ────────────────────────────────────────────────────────────────────────

    // ✅ FIXED: Cleanup tracking for proper resource management
    this.collectionTimer = null;
    this.userGestureFunc = null;
    this.maxAccumulatorSize = 12000 * 30; // 30 seconds max at 12 kHz
    this.maxRecordingDuration = 3600;
    // Matches the audio cap. Video is heavier than WAV, but the bitrate cap in
    // videoRecorder.js keeps it to roughly 15 MB/min rather than whatever rate
    // the browser would pick on its own.
    this.maxVideoRecordingDuration = 3600;
    this.recordingStartTime = null;
    this._initAccumulators();


    if (this.audioCtx && this.audioCtx.state == 'running') {
      startaudio = document.getElementById('startaudio')
      if (startaudio) {
        startaudio.remove()
      }
    } else {
      // for chrome
      // ✅ FIXED: Remove old listener if exists to prevent leaks
      if (this.userGestureFunc) {
        document.documentElement.removeEventListener('mousedown', this.userGestureFunc);
      }
      
      this.userGestureFunc = () => {
        if (this.audioCtx && this.audioCtx.state !== 'running') {
          this.audioCtx.resume();
        }
        // Remove the element with id startaudio from the DOM
        const startaudio = document.getElementById('startaudio');
        if (startaudio) {
          startaudio.remove();
        }
        document.documentElement.removeEventListener('mousedown', this.userGestureFunc);
        this.userGestureFunc = null;
      };
      
      document.documentElement.addEventListener('mousedown', this.userGestureFunc);
    }


    this.highThres = 1

    this.initTimer(); // Start the timing mechanism

    // Warm the lazily-loaded Opus decoder in the background once the page is
    // idle, so a later C-QUAM switch into Opus does not stall on the download.
    // Lives here rather than in a page component so both the desktop app and
    // the mobile page get it without either having to opt in. No-ops when the
    // link looks slow or metered — see prefetchOpusDecoder().
    prefetchOpusDecoder();
  }


_resetInitPromise(err = null) {
  const reject = this.rejectPromise
  this.promise = null
  this.resolvePromise = null
  this.rejectPromise = null
  if (err && reject) {
    try { reject(err) } catch (_) {}
  }
}

_clearInitTimeout() {
  if (this._initTimeout) {
    clearTimeout(this._initTimeout)
    this._initTimeout = null
  }
}

_isSocketOpen() {
  return !!this.audioSocket && this.audioSocket.readyState === WebSocket.OPEN
}

_safeSend(payload) {
  if (!this._isSocketOpen()) {
    return false
  }
  try {
    this.audioSocket.send(typeof payload === 'string' ? payload : JSON.stringify(payload))
    return true
  } catch (e) {
    console.warn('[Audio] WebSocket send failed:', e)
    return false
  }
}

_handleSocketTerminal(kind, evt) {
  this._clearInitTimeout()

  if (this.audioSocket) {
    try {
      this.audioSocket.onmessage = null
      this.audioSocket.onopen = null
      this.audioSocket.onerror = null
      this.audioSocket.onclose = null
    } catch (_) {}
  }

  // Close code 4003 is the server refusing this session outright: too many
  // connections, or too many attempts, from this address (see CLOSE_IP_LIMIT
  // in src/websocket.cpp). Reconnecting would hammer a server that is already
  // saying no — and, once the rate limit is involved, each attempt extends the
  // refusal. 4001 is the sysop kicking this listener (handle_kick in proxy.py);
  // reconnecting there would simply undo the kick a second later. Both are
  // terminal: latch off instead and let the page explain itself. The reason
  // text arrives in the close frame because /audio's first data frame is
  // reserved for basic_info.
  const refused = kind === 'close' && isRefusal(evt)
  if (refused) {
    this.refusedCode   = evt.code
    this.kicked        = isKick(evt)
    this.refusedReason = (evt.reason || defaultReason(evt.code))
    this._stopped = true
  }

  const hadPendingInit = !!this.promise
  const err = refused
    ? new ConnectionRefused(this.refusedReason, this.refusedCode)
    : new Error(`[Audio] socket ${kind}`)
  this._resetInitPromise(hadPendingInit ? err : null)

  this.audioSocket = null

  if (refused) {
    console.warn(`[Audio] connection ended by the server: ${this.refusedReason}`)
    this._notifyConnection('refused')
    return
  }

  // Terminal, whatever the cause: the socket is not reopened from here.
  this._stopped = true;
  console.warn(`[Audio] socket ${kind}; the session has ended`);
  this._notifyConnection(this._everConnected ? 'lost' : 'failed');
}

_notifyConnection(state) {
  if (typeof this.onConnectionChange !== 'function') return;
  try { this.onConnectionChange(state); }
  catch (e) { console.warn('[Audio] onConnectionChange threw:', e); }
}

async init() {
  if (this.promise) {
    return this.promise
  }

  // An explicit init() is also the way to revive an instance after stop(),
  // so clear the latch.
  this._stopped = false

  this.promise = new Promise((resolve, reject) => {
    this.resolvePromise = resolve
    this.rejectPromise = reject
  })

  this.audioSocket = new WebSocket(this.endpoint)
  this.audioSocket.binaryType = 'arraybuffer'
  this.firstAudioMessage = true
  this.audioSocket.onmessage = this.socketMessageInitial.bind(this)
  this.audioSocket.onopen = () => {
    // Advertise codec capabilities before any mode change can trigger C-QUAM.
    // Older servers ignore unknown commands, so this is backward-compatible.
    this._safeSend({ cmd: 'codec_caps', opus: OPUS_ENABLED })
  }
  this.audioSocket.onerror = (evt) => this._handleSocketTerminal('error', evt)
  this.audioSocket.onclose = (evt) => this._handleSocketTerminal('close', evt)

  this._clearInitTimeout()
  this._initTimeout = setTimeout(() => {
    if (this.promise) {
      this._handleSocketTerminal('timeout')
    }
  }, 8000)

  return this.promise
}

  stop() {
    // Latched before the socket is closed below, so the close handler knows
    // this teardown was deliberate.
    this._stopped = true;
    this._clearInitTimeout();
    this._resetInitPromise();
    try { _workerPending.clear(); } catch (_) {}

    // Close the second receiver before the audio graph goes: its socket is
    // independent of ours and would otherwise keep reconnecting forever.
    try { this.stopDiversity(); } catch (e) {
      console.warn('[Diversity] stop error', e);
    }

    // Stop the compositor before the audio graph below is torn down, otherwise
    // its rAF loop keeps running against a closed context and holds the encoder
    // open. Chunks recorded so far stay downloadable.
    try {
      this.stopVideoRecording();
      this._closeResampleContext();
    } catch (e) {
      console.warn('[VideoRecording] stop error', e);
    }
    // ✅ FIXED: Clear the FT8 collection timer
    if (this.collectionTimer) {
      clearInterval(this.collectionTimer);
      this.collectionTimer = null;
    }

    if (this.ft4CollectionTimer) {
      clearInterval(this.ft4CollectionTimer);
      this.ft4CollectionTimer = null;
    }

    if (this.wsprTimer) {
      clearInterval(this.wsprTimer);
      this.wsprTimer = null;
    }
    
    // ✅ FIXED: Remove user gesture listener
    if (this.userGestureFunc) {
      document.documentElement.removeEventListener('mousedown', this.userGestureFunc);
      this.userGestureFunc = null;
    }
    
    // ✅ FIXED: Close WebSocket and remove handlers
    if (this.audioSocket) {
      this.audioSocket.onmessage = null;
      this.audioSocket.onopen = null;
      this.audioSocket.onerror = null;
      this.audioSocket.onclose = null;
      
      if (this.audioSocket.readyState === WebSocket.OPEN || 
          this.audioSocket.readyState === WebSocket.CONNECTING) {
        try {
          this.audioSocket.close();
        } catch (e) {
          console.warn('Error closing WebSocket:', e);
        }
      }
      this.audioSocket = null;
    }
    
    // ✅ FIXED: Free decoder
    if (this.decoder && typeof this.decoder.free === 'function') {
      try {
        this.decoder.free();
      } catch (e) {
        console.warn('Error freeing decoder:', e);
      }
      this.decoder = null;
    }
    
    // ✅ FIXED: Clean up audio context
    if (this.audioCtx && this.audioCtx.state !== 'closed') {
      try {
        // Disconnect all nodes first
        if (this.destinationNode) this.destinationNode.disconnect();
        if (this.gainNode) this.gainNode.disconnect();
        if (this.audioInputNode) this.audioInputNode.disconnect();
        if (this.convolverNode) this.convolverNode.disconnect();
        if (this.humNotch50) this.humNotch50.disconnect();
        if (this.humNotch60) this.humNotch60.disconnect();
        
        this.audioCtx.close();
      } catch (e) {
        console.warn('Error closing audio context:', e);
      }
      this.audioCtx = null;
    }

    // The worklet belongs to the context that has just gone. Clearing this is
    // what makes a later init() on the same instance work at all — see
    // _resetWorkletState() for the silent failure it prevents.
    this._resetWorkletState();
    this._dBQueue = [];
    this._everConnected = false;
    
    // ✅ FIXED: Clear accumulator and recording data
    this.accumulatorLen     = 0;
    this.ft4AccumulatorLen  = 0;
    this.ft2AccumulatorLen  = 0;
    this.wsprAccumulatorLen = 0;
    // JS8 also holds partly-assembled messages; a teardown means the audio
    // stream is gone, so anything half-received will never be completed.
    this.js8AccumulatorLen  = 0;
    this.isJS8Collecting    = false;
    if (this.js8Reassembler) this.js8Reassembler.reset();
    this.recordedAudio = [];
    this.audioQueue = [];
    this.recordedChunks = [];
    // Clear CW state
    this.decodeCW = false;
    if (this.cw) {
      try { this.cw.destroy(); } catch (e) { console.warn('[CW] destroy error', e); }
      this.cw = null;
    }

    // Clear FAX state
    if (this.decodeFAX) { this.decodeFAX = false; this._faxDecoder.reset(); }
    if (this._faxDecoder && typeof this._faxDecoder.destroy === 'function') {
      try { this._faxDecoder.destroy(); } catch (e) { console.warn('[FAX] destroy error', e); }
    }
    this.faxCallback = null;

    // Clear NAVTEX state
    if (this.decodeNAVTEX) { this.decodeNAVTEX = false; this._navtexDecoder.setEnabled(false); }
    if (this._navtexDecoder) {
      try { this._navtexDecoder.destroy(); } catch (e) { console.warn('[NAVTEX] destroy error', e); }
    }
    this.navtexCallback = null;

    if (this._sstvDecoder && typeof this._sstvDecoder.destroy === 'function') {
      try { this._sstvDecoder.destroy(); } catch (e) { console.warn('[SSTV] destroy error', e); }
    }

    // Clear generic FSK state
    if (this.decodeFSK) { this.decodeFSK = false; this._fskDecoder.setEnabled(false); }
    if (this._fskDecoder) {
      try { this._fskDecoder.destroy(); } catch (e) { console.warn('[FSK] destroy error', e); }
    }
    this.fskCallback = null;
  }

    applyAGC(pcmArray) {
    // Frontend sample-domain AGC is intentionally disabled.
    // Backend AGC should be the only real AGC in the chain.
    return pcmArray;
  }

  _resetAudioLevelControl() {
    this.audioLevelGain = 1.0;
    this.audioLevelRms = 0.0;
    this.audioLevelPeak = 0.0;
    this.audioLevelDetectorPeak = 0.0;
    this.agcGain = 1.0;
    this.agcEnvelope = 0.0;
    this.agcLookaheadBuffer = [];
    this._applyOutputGain();
  }

  _applyOutputGain() {
    const finalGain = Math.max(0, (this.userGain ?? 1.0) * (this.audioLevelEnabled ? (this.audioLevelGain ?? 1.0) : 1.0));
    this.gain = finalGain;
    // A chain rebuild has the output ramped to zero; it calls this again on
    // completion.  Writing the gain now would un-mute mid-surgery (audible click).
    if (this._chainDipActive) return;
    if (this.gainNode) {
      const now = this.audioCtx ? this.audioCtx.currentTime : 0;
      try {
        this.gainNode.gain.cancelScheduledValues(now);
        this.gainNode.gain.setTargetAtTime(finalGain, now, 0.010);
      } catch (_) {
        this.gainNode.gain.value = finalGain;
      }
    }
  }

  _configureAudioLevelMode(mode) {
    this.audioLevelMode = mode;
    this.audioLevelHoldCounter = 0;
    this.audioLevelDetectorFast = 0.0;
    this.audioLevelDetectorSlow = 0.0;
    this.audioLevelDetectorPeak = 0.0;  // smoothed peak follower — reset on every mode switch
    this.audioLevelSilenceRms = 0.0;    // 0 = no silence gate; modes opt in below

    switch (mode) {
      case 1: // Fast — real transceiver VERY FAST AGC
          // Attack and release both essentially instant (one frame): the gain follows
          // the signal envelope packet by packet. Level is nailed down hard, every
          // syllable comes out the same loudness, and the gain is back to unity the
          // moment a signal stops. This is the "FAST/QSK" end of the range — best for
          // CW, pileups and rapid QSB, at the price of an audibly busy, dense sound.
          // Peak-driven: reacts to peaks, not RMS average.
          // Silence is never amplified: max boost is unity, and below
          // audioLevelSilenceRms the release is frozen so band noise stays where it is.
          this.audioLevelEnabled    = true;
          this.audioLevelTarget     = 0.38;
          this.audioLevelMinGain    = 0.45;
          this.audioLevelMaxBoost   = 1.00;   // never boosts above unity — silence stays quiet
          this.audioLevelSilenceRms = 0.006;  // below this the release is frozen entirely
          this.audioLevelAttack     = 0.95;   // ~1 frame — clamps within a single packet
          this.audioLevelRelease    = 0.92;   // ~1 frame — gain snaps back immediately
          this.audioLevelHoldFrames = 0;      // no hold at all — releases the instant level drops
          this.audioLevelPeakWeight = 0.95;   // almost purely peak-driven
          this.audioLevelFastCoeff  = 0.75;   // fast detector ≈ 1 frame
          this.audioLevelSlowCoeff  = 0.20;   // slow detector ≈ 0.8s
          this.audioLevelPeakCoeff  = 0.90;   // peak follower tracks per-packet peaks
          break;

      case 2: // Medium — real transceiver MEDIUM AGC
          // Attack: fast (as always). Release: ~1.2s T63 — the classic "MED" position.
          // It rides QSB and holds the level steady across a sentence, but unlike Slow
          // it does recover between overs, so a weak station following a loud one is
          // audible after a second or two rather than a dozen.
          // Detectors sit halfway between Fast and Slow: they follow the envelope of
          // speech, not individual syllables.
          // Silence is never amplified: max boost is unity, and below
          // audioLevelSilenceRms the release is frozen so band noise stays where it is.
          // The program-dependent branch in _updateAudioLevelControl still shifts timing
          // around this medium centre based on crest factor and signal dynamics.
          this.audioLevelEnabled    = true;
          this.audioLevelTarget     = 0.38;
          this.audioLevelMinGain    = 0.42;
          this.audioLevelMaxBoost   = 1.00;   // never boosts above unity — silence stays quiet
          this.audioLevelSilenceRms = 0.008;  // below this the release is frozen entirely
          this.audioLevelAttack     = 0.85;   // T63 ≈ 85ms — fast attack
          this.audioLevelRelease    = 0.13;   // T63 ≈ 1.2s — medium release
          this.audioLevelHoldFrames = 9;      // ~1.4s hold before release starts
          this.audioLevelPeakWeight = 0.80;
          this.audioLevelFastCoeff  = 0.15;   // fast detector ≈ 1s — speech envelope
          this.audioLevelSlowCoeff  = 0.03;   // slow detector ≈ 5s — band level
          this.audioLevelPeakCoeff  = 0.20;   // peak follower ≈ 0.8s
          break;

      case 3: // Slow — real transceiver VERY SLOW AGC
          // Attack: fast (same as Fast mode — all hardware AGCs attack fast).
          // Release: ~13s T63 — the gain essentially does not recover between words,
          // between overs, or across a whole QSO. Once a strong station has pulled the
          // gain down, the noise floor stays buried for ten seconds or more after it
          // stops. This is the "SLOW/LONG" position of a collins-style / K3 hang AGC:
          // rock-steady loudness, zero pumping, at the price of losing weak signals
          // for a while after a loud one.
          // Detectors are deliberately sluggish too, so single loud packets set the
          // level and short gaps never leak through.
          // Silence is never amplified: max boost is unity, and below audioLevelSilenceRms
          // the release is frozen outright so the noise floor cannot creep back up.
          this.audioLevelEnabled    = true;
          this.audioLevelTarget     = 0.38;
          this.audioLevelMinGain    = 0.55;
          this.audioLevelMaxBoost   = 1.00;   // never boosts above unity — silence stays quiet
          this.audioLevelSilenceRms = 0.010;  // below this the release is frozen entirely
          this.audioLevelAttack     = 0.85;   // T63 ≈ 85ms — same fast attack as Fast mode
          this.audioLevelRelease    = 0.012;  // T63 ≈ 13s — extremely slow recovery
          this.audioLevelHoldFrames = 100;    // ~16s hang before release even starts
          this.audioLevelPeakWeight = 0.75;
          this.audioLevelFastCoeff  = 0.025;  // fast detector ≈ 6s — barely "fast" at all
          this.audioLevelSlowCoeff  = 0.004;  // slow detector ≈ 40s — long-term band level
          this.audioLevelPeakCoeff  = 0.035;  // peak follower decays over several seconds
          break;

      case 0: // Auto = bypass frontend audio-level
      default:
        this.audioLevelEnabled = false;
        this.audioLevelTarget = 0.20;
        this.audioLevelMinGain = 1.0;
        this.audioLevelMaxBoost = 2.0;
        this.audioLevelAttack = 0.0;
        this.audioLevelRelease = 0.0;
        this.audioLevelHoldFrames = 0;
        this.audioLevelPeakWeight = 0.0;
        this.audioLevelFastCoeff = 0.0;
        this.audioLevelSlowCoeff = 0.0;
        break;
    }
  }

  _updateAudioLevelControl(pcmArray) {
    if (!this.audioLevelEnabled || !pcmArray || !pcmArray.length) {
      if (!this.audioLevelEnabled && this.audioLevelGain !== 1.0) {
        this.audioLevelGain = 1.0;
        this._applyOutputGain();
      }
      return;
    }

    let sumSq = 0.0;
    let peak = 0.0;
    for (let i = 0; i < pcmArray.length; i++) {
      const s = pcmArray[i];
      const a = Math.abs(s);
      sumSq += s * s;
      if (a > peak) peak = a;
    }

    const rms = Math.sqrt(sumSq / pcmArray.length);
    this.audioLevelRms = rms;
    this.audioLevelPeak = peak;

    const fastCoeff = this.audioLevelFastCoeff ?? 0.12;
    const slowCoeff = this.audioLevelSlowCoeff ?? 0.03;
    const peakCoeff = this.audioLevelPeakCoeff ?? 0.22;
    this.audioLevelDetectorFast += (rms - this.audioLevelDetectorFast) * fastCoeff;
    this.audioLevelDetectorSlow += (rms - this.audioLevelDetectorSlow) * slowCoeff;
    // Smoothed peak follower — tracks the per-frame peak envelope across frames.
    // The original code used raw per-frame `peak` (instantaneous) with peakWeight=0.78,
    // meaning 78% of each gain decision was based on a single-frame peak that varies
    // wildly between SSB/CW packets. This caused subtle gain jitter on every packet.
    // The smoothed follower removes this noise while still reacting to real level changes.
    if (this.audioLevelDetectorPeak === undefined) this.audioLevelDetectorPeak = 0.0;
    this.audioLevelDetectorPeak += (peak - this.audioLevelDetectorPeak) * peakCoeff;

    let detector = Math.max(
      (this.audioLevelDetectorFast * (1.0 - (this.audioLevelPeakWeight ?? 0.75))) + (this.audioLevelDetectorPeak * (this.audioLevelPeakWeight ?? 0.75)),
      this.audioLevelDetectorSlow * 0.85,
      1e-4
    );

    let target = this.audioLevelTarget;
    let minGain = this.audioLevelMinGain ?? 0.65;
    let maxBoost = this.audioLevelMaxBoost;
    let attack = this.audioLevelAttack;
    let release = this.audioLevelRelease;
    let holdFrames = this.audioLevelHoldFrames ?? 0;

    if (this.audioLevelMode === 2) {   // Medium — program-dependent timing
      const crest = peak / Math.max(rms, 1e-4);
      const levelVsSlow = this.audioLevelDetectorFast / Math.max(this.audioLevelDetectorSlow, 1e-4);

      // Keep the same nominal loudness as Fast/Slow — only the reaction timing moves,
      // never the steady-state gain law. All four branches stay around the medium
      // centre (release T63 ≈ 0.8–2s) and keep the fast attack.
      if (crest > 3.2) {
        // Spiky material (CW, static crashes) — clamp on the peak, recover a bit quicker.
        detector = Math.max(detector, peak * 1.03);
        attack = 0.85;
        release = 0.20;   // T63 ≈ 0.8s
        holdFrames = 6;
      } else if (rms < this.audioLevelDetectorSlow * 0.65) {
        // Signal has dropped well below the tracked noise floor — quiet passage or gap.
        // Use slower timing to avoid gain rushing up into a noise burst.
        detector = Math.max(detector, this.audioLevelDetectorSlow * 0.98);
        attack = 0.60;
        release = 0.09;   // T63 ≈ 1.8s
        holdFrames = 14;
      } else if (levelVsSlow > 1.35) {
        // Signal rising above its own average — a station coming up out of QSB.
        attack = 0.85;
        release = 0.15;   // T63 ≈ 1.1s
        holdFrames = 9;
      } else {
        attack = 0.70;
        release = 0.13;   // T63 ≈ 1.2s — same as the preset centre
        holdFrames = 9;
      }
    }

    let desired = Math.min(maxBoost, Math.max(minGain, target / detector));

    if (desired < this.audioLevelGain) {
      this.audioLevelHoldCounter = holdFrames;
      this.audioLevelGain += (desired - this.audioLevelGain) * attack;
    } else {
      if (rms < (this.audioLevelSilenceRms ?? 0)) {
        // Silence / band noise only — freeze the gain where the last signal left it.
        // Releasing here is what makes an AGC "breathe" the noise floor up between
        // overs; a very slow AGC must not do that.
        desired = this.audioLevelGain;
      } else if ((this.audioLevelHoldCounter ?? 0) > 0) {
        this.audioLevelHoldCounter--;
        desired = this.audioLevelGain;
      } else {
        this.audioLevelGain += (desired - this.audioLevelGain) * release;
      }
    }

    this.audioLevelGain = Math.min(maxBoost, Math.max(minGain, this.audioLevelGain));
    this._applyOutputGain();
  }

   // Frontend audio-level parameters (backend AGC remains enabled)

setAGC(newAGCSpeed) {
  if (typeof this.decoder?.set_agc_enable === 'function') {
    this.decoder.set_agc_enable(true);
  }

  this.mute = false;
  this._configureAudioLevelMode(newAGCSpeed);
  this._resetAudioLevelControl();

  const modeNames = {
    0: 'Audio Level Auto (Bypass)',
    1: 'Audio Level Fast (Very Fast / QSK)',
    2: 'Audio Level Medium (Program Dependent)',
    3: 'Audio Level Slow (Very Slow / Hang)'
  };

  console.log('Backend AGC ENABLED | Frontend mode = ' + (modeNames[newAGCSpeed] || ('Unknown ' + newAGCSpeed)));
}

  smoothMaxgain(maxgain) {
    // Legacy helper kept for compatibility. It now only limits
    // frontend playback-level boost instead of enabling sample AGC.
    this.audioLevelMaxBoost = Math.max(1.0, Number(maxgain) || 1.0);
  }


  _initAccumulators() {
    // The FTx capture length is (slot_period - 0.4) s, so the buffers have to
    // be sized from the real sample rate. They were previously fixed at 12 kHz
    // assumptions; at a higher audio_sps the buffer would fill before a full
    // window was collected and the slot would never decode.
    const sps = this.audioOutputSps || 12000;
    const slotBuf = (period) => Math.ceil(period * sps) + sps;   // +1 s headroom

    this.maxAccumulatorSize     = Math.max(this.maxAccumulatorSize,    slotBuf(15.0));
    this.maxFT4AccumulatorSize  = Math.max(this.maxFT4AccumulatorSize, slotBuf(7.5));
    this.maxFT2AccumulatorSize  = Math.max(this.maxFT2AccumulatorSize, slotBuf(3.75));
    this.maxWSPRAccumulatorSize = Math.max(this.maxWSPRAccumulatorSize, sps * 125);
    // Sized for the longest JS8 cycle (Slow, 30 s) so switching submode never
    // needs a reallocation mid-stream.
    this.maxJS8AccumulatorSize  = Math.max(this.maxJS8AccumulatorSize,  slotBuf(30.0));

    this.accumulator        = new Float32Array(this.maxAccumulatorSize);
    this.accumulatorLen     = 0;
    this.ft4Accumulator     = new Float32Array(this.maxFT4AccumulatorSize);
    this.ft4AccumulatorLen  = 0;
    this.ft2Accumulator     = new Float32Array(this.maxFT2AccumulatorSize);
    this.ft2AccumulatorLen  = 0;
    this.wsprAccumulator    = new Float32Array(this.maxWSPRAccumulatorSize);
    this.wsprAccumulatorLen = 0;
    this.js8Accumulator     = new Float32Array(this.maxJS8AccumulatorSize);
    this.js8AccumulatorLen  = 0;
  }

  _makeNBChannelState() {
    return {
      env: 0.001,      // smoothed |signal| envelope
      seeded: false,   // env seeded from the first block of audio
      hold: 0,         // samples left to blank
      gain: 1,         // current blanking gain (ramped, never a hard step)
      delay: null,     // look-ahead delay line
      delayIdx: 0,
    };
  }

  // ── Impulse noise blanker (time domain) ───────────────────────────────────
  //
  // Tracks a smoothed envelope and blanks only samples that exceed it by a
  // fixed ratio. True impulsive events (static crashes, ignition, QRM bursts)
  // have instantaneous amplitude >> envelope; normal SSB/AM audio stays close
  // to it. The predecessor of this code compared IFFT magnitudes against a
  // spectral average and gated the original sample by that ratio — incoherent
  // phase made the gating effectively random within a frame, which is what
  // produced the metallic ring-modulator artifact.
  //
  // Two things this now does that it did not before:
  //   * look-ahead, so the impulse's own leading edge falls inside the blanked
  //     window instead of getting through before the trigger fires;
  //   * a short cosine ramp in and out instead of a hard zero, because a step
  //     to zero is itself a broadband click — blanking one impulse by creating
  //     another is self-defeating.
  applyNoiseBlanker(pcmArray, chR = false) {
    if (!this.nbBlankerEnabled && !this.nb) return pcmArray;
    const N = pcmArray.length;
    if (N === 0) return pcmArray;

    const st = this._nbCh[chR ? 1 : 0];
    const sps        = this.audioOutputSps || 12000;
    const lookahead  = Math.max(0, Math.round(this.nbLookahead));
    const holdSamples = Math.max(1, Math.round((this.nbHoldMs / 1000) * sps));
    const ratio      = this.nbBlankRatio;
    const rampStep   = 1 / Math.max(1, this.nbRampSamples);

    const alphaA = 1 - Math.exp(-1 / (sps * this.nbAttackTC));
    const alphaR = 1 - Math.exp(-1 / (sps * this.nbReleaseTC));

    if (!st.delay || st.delay.length !== lookahead + 1) {
      st.delay = new Float32Array(lookahead + 1);
      st.delayIdx = 0;
    }
    const delay = st.delay, DL = delay.length;

    // Seed the envelope from the first block rather than climbing to it from
    // the initial value: starting far below the signal means every sample
    // looks like an impulse, and the blanker mutes audio while it catches up.
    if (!st.seeded) {
      let sum = 0;
      for (let i = 0; i < N; i++) sum += Math.abs(pcmArray[i]);
      st.env = Math.max(sum / N, 1e-6);
      st.seeded = true;
      st.frames++;
    }

    const out = new Float32Array(N);
    let env = st.env, hold = st.hold, gain = st.gain, blanked = 0;

    for (let i = 0; i < N; i++) {
      const s = Number.isFinite(pcmArray[i]) ? pcmArray[i] : 0;
      const abs = Math.abs(s);

      // Detect on the *incoming* sample, emit the delayed one, so the window
      // we blank starts `lookahead` samples before the impulse.
      const triggered = abs > ratio * env;

      // Feed the follower a value clamped to the trigger threshold. Letting
      // the crash itself into the envelope is how a burst train desensitises
      // the detector until it stops triggering; freezing the follower outright
      // is worse still — it can never recover from a low start and blanks
      // everything forever.
      const envIn = abs < ratio * env ? abs : ratio * env;
      env = envIn > env
        ? env + alphaA * (envIn - env)
        : env + alphaR * (envIn - env);

      if (triggered) hold = holdSamples;

      // Delay line: read the oldest sample, then overwrite with the newest.
      const idx = st.delayIdx;
      const delayed = delay[idx];
      delay[idx] = s;
      st.delayIdx = idx + 1 === DL ? 0 : idx + 1;

      const target = hold > 0 ? 0 : 1;
      if (hold > 0) { hold--; blanked++; }

      // Ramp toward the target instead of stepping to it.
      if (gain < target)      gain = Math.min(target, gain + rampStep);
      else if (gain > target) gain = Math.max(target, gain - rampStep);

      // Raised-cosine shaping of the linear ramp — smoother spectrum than a
      // straight line, and free (gain only moves during the few ramp samples).
      const g = gain <= 0 ? 0 : (gain >= 1 ? 1 : 0.5 - 0.5 * Math.cos(Math.PI * gain));
      out[i] = delayed * g;
    }

    st.env = env; st.hold = hold; st.gain = gain;
    this.nbBlankedSamples += blanked;
    this.nbTotalSamples   += N;

    return out;
  }

  // Percentage of audio the blanker has removed since the last call. Useful to
  // spot a mis-set threshold: a healthy band sits well under 1%.
  getNoiseBlankerStats() {
    const pct = this.nbTotalSamples > 0
      ? (100 * this.nbBlankedSamples / this.nbTotalSamples) : 0;
    const stats = { blanked: this.nbBlankedSamples, total: this.nbTotalSamples, percent: pct };
    this.nbBlankedSamples = 0;
    this.nbTotalSamples = 0;
    return stats;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  SHARED WEIGHTED OVERLAP-ADD ENGINE
  //  Used by both spectral stages (NR and NS). Frames arrive from the decoder
  //  far shorter than one analysis window — 120 samples for a 10 ms Opus frame
  //  against a 512-point window — so a stage that simply FFTs "the current
  //  block" is transforming mostly whatever the previous call left in its
  //  buffer. This keeps a sliding window across calls and reconstructs by
  //  overlap-add, which is the only way the output is continuous at block
  //  boundaries.
  // ═══════════════════════════════════════════════════════════════════════════

  _makeWolaState(N, hop) {
    // sqrt-Hann used for BOTH analysis and synthesis: their product is a Hann
    // window, and Hann at 75% overlap sums to a constant, so overlap-add
    // reconstructs the signal exactly when every gain is 1.
    const win = new Float32Array(N);
    for (let j = 0; j < N; j++) {
      win[j] = Math.sqrt(0.5 - 0.5 * Math.cos(2 * Math.PI * j / N));
    }
    let wsum = 0;
    for (let j = 0; j < N; j += hop) wsum += win[j] * win[j];
    return {
      N, hop,
      win,
      norm:    wsum > 0 ? 1 / wsum : 1,
      hist:    new Float32Array(N),        // sliding analysis window
      pending: 0,                          // samples buffered toward the next hop
      acc:     new Float32Array(N),        // overlap-add accumulator
      outQ:    new Float32Array(N + 4096), // finished samples waiting to leave
      outLen:  0,
      primed:  false,
      re: new Float64Array(N),
      im: new Float64Array(N),
    };
  }

  // Push `pcmArray` through the WOLA engine, calling applyGains(re, im, half)
  // once per completed hop to modify the spectrum in place. Always returns
  // exactly pcmArray.length samples, delayed by one window.
  _wolaRun(st, pcmArray, applyGains) {
    const inLen = pcmArray.length;
    const N = st.N, hop = st.hop, half = N >> 1;
    const { win, hist, acc, re, im } = st;

    // Grow the output queue if a caller ever hands us an unusually long block.
    if (st.outQ.length < st.outLen + inLen + N) {
      const bigger = new Float32Array(st.outLen + inLen + 2 * N);
      bigger.set(st.outQ.subarray(0, st.outLen));
      st.outQ = bigger;
    }
    const outQ = st.outQ;

    let consumed = 0;
    while (consumed < inLen) {
      // Slide `take` new samples into the right-hand end of the window.
      const take = Math.min(hop - st.pending, inLen - consumed);
      hist.copyWithin(0, take);
      hist.set(pcmArray.subarray(consumed, consumed + take), N - take);
      consumed += take;
      st.pending += take;
      if (st.pending < hop) break;       // not a full hop yet — wait for more
      st.pending = 0;

      for (let j = 0; j < N; j++) { re[j] = hist[j] * win[j]; im[j] = 0; }
      transformFlat(re, im, false);

      applyGains(re, im, half);

      transformFlat(re, im, true);
      for (let j = 0; j < N; j++) acc[j] += re[j] * win[j] * st.norm;

      // The oldest `hop` samples are complete — emit them and slide.
      outQ.set(acc.subarray(0, hop), st.outLen);
      st.outLen += hop;
      acc.copyWithin(0, hop);
      acc.fill(0, N - hop);
    }

    // One window of latency. Until the pipeline has filled, emit silence
    // rather than unprocessed audio, so the stage never mixes raw and
    // processed samples into one stream.
    if (!st.primed) {
      if (st.outLen < inLen) return new Float32Array(inLen);
      st.primed = true;
    }

    const out = new Float32Array(inLen);
    const avail = Math.min(inLen, st.outLen);
    out.set(outQ.subarray(0, avail));
    outQ.copyWithin(0, avail, st.outLen);
    st.outLen -= avail;
    return out;
  }

  // Scale one spectrum by a per-bin gain vector, mirroring onto the negative
  // frequencies so the inverse transform stays real. The stages this replaced
  // scaled only bins 0..N/2-1 and then took the real part of the inverse,
  // which is not the filter they thought they were applying.
  _applyBinGains(re, im, half, gains) {
    const N = half * 2;
    for (let j = 0; j < half; j++) {
      const g = gains[j];
      re[j] *= g; im[j] *= g;
      if (j > 0) { re[N - j] *= g; im[N - j] *= g; }
    }
    // Nyquist has no mirror partner — scale it with its neighbour so it isn't
    // the one band left at full noise level.
    re[half] *= gains[half - 1]; im[half] *= gains[half - 1];
  }

  _makeNRChannelState() {
    const N = this.nrFFTSize, half = N >> 1;
    const st = this._makeWolaState(N, this.nrHop);
    st.floor = new Float32Array(half);          // per-bin noise magnitude estimate
    st.prevG = new Float32Array(half).fill(1);
    st.prevP = new Float32Array(half);          // previous clean power (decision-directed)
    st.mMean = new Float32Array(half);          // per-bin |X| mean  ┐ tonality test
    st.mSq   = new Float32Array(half);          // per-bin |X|² mean ┘
    st.gain  = new Float32Array(half).fill(1);
    st.seeded = false;
    return st;
  }

  // Clear NR state — the noise floor describes the band we *were* on, so a
  // retune or mode change makes it wrong rather than merely stale.
  resetNoiseReduction() {
    this._nrCh = [null, null];
  }

  // Tune NR at run-time. strengthDB is the maximum attenuation applied to a
  // bin judged to be pure noise; fftSize/hop change the time/frequency
  // trade-off and rebuild the state.
  setNoiseReductionParams({ strengthDB, fftSize, hop } = {}) {
    if (typeof strengthDB === 'number') {
      this.nrStrengthDB = Math.max(0, Math.min(30, strengthDB));
    }
    let rebuild = false;
    if (typeof fftSize === 'number') {
      // Power of two only — the radix-2 transform requires it.
      const n = Math.pow(2, Math.round(Math.log2(Math.max(128, Math.min(2048, fftSize)))));
      if (n !== this.nrFFTSize) { this.nrFFTSize = n; rebuild = true; }
    }
    if (typeof hop === 'number') {
      const h = Math.max(this.nrFFTSize / 8, Math.min(this.nrFFTSize / 2, Math.round(hop)));
      if (h !== this.nrHop) { this.nrHop = h; rebuild = true; }
    }
    if (this.nrHop > this.nrFFTSize / 2) this.nrHop = this.nrFFTSize / 4;
    if (rebuild) this.resetNoiseReduction();
    console.log(`[NR] strength=${this.nrStrengthDB} dB, fft=${this.nrFFTSize}, hop=${this.nrHop}`);
  }

  // ── Spectral noise reduction (WOLA + decision-directed Wiener) ────────────
  //
  // What this replaces mattered more than what it adds. The old NR ran a
  // 2048-point FFT over `nbBuffer`, into which only the current audio block
  // (120 samples for a 10 ms Opus frame) had been copied — the other ~1900
  // samples were whatever an earlier call had left there. So the spectrum it
  // measured, and the gains it derived, described mostly stale audio; the
  // output was the first 120 samples of a rectangular-window IFFT of that
  // mixture, written straight out with no overlap-add. Every block boundary
  // was a discontinuity. On top of that its "noise estimate" was a running
  // average of the recent spectrum *including the signal*, so steady hiss
  // (mag == its own average) passed untouched while speech onsets (mag above
  // their own average) got attenuated — backwards.
  //
  // This version runs on the shared WOLA engine and applies a Wiener gain from
  // a decision-directed a-priori SNR — the standard cure for musical noise,
  // since a bin's gain depends on its own history, not only on one noisy frame.
  applyNoiseReduction(pcmArray, chR = false) {
    if (!this.nrEnabled && !this.nb) return pcmArray;
    if (pcmArray.length === 0) return pcmArray;

    const chIdx = chR ? 1 : 0;
    if (!this._nrCh[chIdx]) this._nrCh[chIdx] = this._makeNRChannelState();
    const st = this._nrCh[chIdx];

    const sps = this.audioOutputSps || 12000;
    const hopSeconds = st.hop / sps;
    const downA = 1 - Math.exp(-hopSeconds / this.nrDownTC);
    const upA   = 1 - Math.exp(-hopSeconds / this.nrUpTC);
    const gFloor = Math.pow(10, -this.nrStrengthDB / 20);
    const alphaDD = this.nrAlphaDD;
    const tonalA = 1 - Math.exp(-hopSeconds / this.nrTonalTC);
    const tonalDecay = Math.exp(-hopSeconds / this.nrTonalDecayTC);
    const overSub = this.nrOverSub;
    const tonalRelVar = this.nrTonalRelVar;
    const floor = st.floor, prevG = st.prevG, prevP = st.prevP, gain = st.gain;

    return this._wolaRun(st, pcmArray, (re, im, half) => {
      for (let j = 0; j < half; j++) {
        const p = re[j] * re[j] + im[j] * im[j];   // power
        const mag = Math.sqrt(p);

        // Tonality test. A noise bin's magnitude is Rayleigh-distributed, so
        // its standard deviation is ~0.52 of its mean; a steady carrier or a
        // held CW note is nearly constant, so its ratio collapses toward zero.
        // Without this, the slow up-follower simply absorbs any steady tone
        // into the "noise" estimate and then suppresses it — the filter would
        // erase exactly the signal a CW operator is listening to (measured:
        // a 1 kHz tone at +10 dB SNR pinned at the gain floor from t=0).
        const mm = st.mMean[j] + tonalA * (mag - st.mMean[j]);
        const ms = st.mSq[j]   + tonalA * (p - st.mSq[j]);
        st.mMean[j] = mm; st.mSq[j] = ms;
        const relVar = mm > 1e-12 ? Math.sqrt(Math.max(0, ms - mm * mm)) / mm : 1;
        const noiseLike = relVar > tonalRelVar;

        if (!st.seeded) {
          // Seed below the observed level rather than at it: if a signal is
          // already present when NR is switched on, seeding at its magnitude
          // would declare it noise for good.
          floor[j] = mag * 0.5;
        } else if (mag < floor[j]) {
          floor[j] = floor[j] + downA * (mag - floor[j]);
        } else if (noiseLike) {
          floor[j] = floor[j] + upA * (mag - floor[j]);
        } else {
          // Tonal bin sitting above the floor. Freezing the floor here is not
          // enough — whatever value it happened to be seeded at would keep
          // suppressing the tone (measured: floor stuck at half the carrier
          // level held a +10 dB CW note down at the gain floor forever).
          // Let it decay instead, so a sustained tone converges to full gain,
          // and let it climb back the moment the bin looks like noise again.
          floor[j] *= tonalDecay;
        }

        const nPow = Math.max(floor[j] * floor[j] * overSub, 1e-20);
        const gammaPost = p / nPow;                      // a-posteriori SNR
        // Decision-directed a-priori SNR: mostly the previous frame's clean
        // estimate, topped up by this frame's excess over the noise floor.
        const xi = Math.max(
          1e-6,
          alphaDD * (prevG[j] * prevG[j] * prevP[j] / nPow) +
          (1 - alphaDD) * Math.max(gammaPost - 1, 0)
        );
        let g = xi / (1 + xi);                           // Wiener gain
        if (g < gFloor) g = gFloor;
        gain[j] = g;
        prevP[j] = p;
      }
      st.seeded = true;

      // Light 3-tap smoothing across frequency. Isolated bins flipping between
      // pass and cut from frame to frame is exactly what musical noise is.
      for (let j = 0; j < half; j++) {
        const lo = j > 0 ? gain[j - 1] : gain[j];
        const hi = j < half - 1 ? gain[j + 1] : gain[j];
        prevG[j] = (lo + gain[j] + hi) / 3;
      }
      this._applyBinGains(re, im, half, prevG);
    });
  }

  /**
   * Enable or disable the impulse noise blanker.
   * @param {boolean} enabled
   */
  enableNoiseBlanker(enabled) {
    this.nbBlankerEnabled = !!enabled;
    this.nbEnabled = this.nbBlankerEnabled;   // legacy alias
    if (this.nbBlankerEnabled) {
      this._nbCh = [this._makeNBChannelState(), this._makeNBChannelState()];
    }
    console.log(`[NB] Noise Blanker: ${this.nbBlankerEnabled ? 'ENABLED' : 'DISABLED'}`);
  }

  /**
   * Enable or disable spectral noise reduction.
   * @param {boolean} enabled
   */
  enableNoiseReduction(enabled) {
    this.nrEnabled = !!enabled;
    // Always start from a clean floor estimate; a stale one from a different
    // band would either over- or under-suppress until it re-converged.
    this.resetNoiseReduction();
    console.log(`[NR] Noise Reduction: ${this.nrEnabled ? 'ENABLED' : 'DISABLED'} (${this.nrStrengthDB} dB)`);
  }

  // ── AI Noise Reduction (RNNoise) ──────────────────────────────────────────
  // Per channel: audio rate -> 48 kHz -> RNNoise in 480-sample frames -> audio
  // rate. A block's output is always exactly as long as its input — the stereo
  // path re-interleaves L and R by index, and the playback path schedules by
  // length — so the output queue starts primed with silence covering what the
  // frame buffering and the two resamplers hold back.
  //
  // The dry/wet mix is done at 48 kHz against the input delayed by exactly
  // RNNOISE_DELAY samples. Mixing against the undelayed input would comb-filter
  // the voice (20 ms apart = notches every 50 Hz).
  // Two-input WOLA for mask mode: the spectrum of RNNoise's output (wet) and
  // of the original (dry), window by window, in step. Same sqrt-Hann / 75 %
  // overlap scheme as _makeWolaState, so unit gains reconstruct the input.
  _makeAiMaskState(sps) {
    const N = Math.max(64, 1 << Math.round(Math.log2(sps * this.aiNrMaskWinMs / 1000)));
    const hop = N >> 2, half = N >> 1, hopS = hop / sps;
    const win = new Float32Array(N);
    for (let j = 0; j < N; j++) win[j] = Math.sqrt(0.5 - 0.5 * Math.cos(2 * Math.PI * j / N));
    let wsum = 0;
    for (let j = 0; j < N; j += hop) wsum += win[j] * win[j];
    return {
      N, hop, half, win, norm: wsum > 0 ? 1 / wsum : 1,
      band: Math.max(0, Math.round(this.aiNrMaskSmoothHz / (sps / N))),
      binHz: sps / N, hopS,
      aAtt: 1 - Math.exp(-hopS / (this.aiNrMaskAttackMs / 1000)),
      aRel: 1 - Math.exp(-hopS / (this.aiNrMaskReleaseMs / 1000)),
      floorDB: -Math.abs(this.aiNrMaskFloorDB),
      histW: new Float32Array(N), histD: new Float32Array(N), pending: 0,
      acc: new Float32Array(N),
      reW: new Float64Array(N), imW: new Float64Array(N),
      reD: new Float64Array(N), imD: new Float64Array(N),
      pw: new Float64Array(half + 1), pd: new Float64Array(half + 1),
      sdb: new Float64Array(half + 1),   // smoothed gain per bin, dB (starts at 0 = pass)
    };
  }

  // Feed aligned wet/dry blocks (same length); returns the processed samples
  // completed so far (whole hops). Per bin: H = (1 - w) + w * g * mask.
  // Slider -> wet share, as A·s² + B·s through (0,0), (0.5,0.5) and
  // (1, aiNrTopWet): A = 2·top - 2, B = 2 - top. At top = 1 it is s itself.
  _aiTopWet() {
    const s = Math.min(1, Math.max(0, this.aiNrMix));
    const top = Math.min(1, Math.max(0, this.aiNrTopWet));
    return Math.min(1, Math.max(0, (2 * top - 2) * s * s + (2 - top) * s));
  }

  // Deepest cut for the current slider position: aiNrMaskFloorDB up to 50%,
  // tightening to aiNrTopFloorDB at 100%.
  _aiTopFloorDB() {
    const sl = Math.min(1, Math.max(0, this.aiNrMix));
    const base = Math.abs(this.aiNrMaskFloorDB), top = Math.abs(this.aiNrTopFloorDB);
    if (sl <= 0.5 || top >= base) return -base;
    return -(base + (top - base) * (sl - 0.5) / 0.5);
  }

  _aiMaskPush(ms, wet, dry, w, g, q = 0, speech = false) {
    const { N, hop, half, win, histW, histD, acc, reW, imW, reD, imD, pw, pd, sdb } = ms;
    // Weak-signal adaptation: slower release and wider smoothing as q -> 1.
    let band = ms.band, aRel = ms.aRel, aAtt = ms.aAtt, relMs = this.aiNrMaskReleaseMs;
    let floorDB = this._aiTopFloorDB();
    if (q > 0) {
      const att = this.aiNrMaskAttackMs + q * (Math.max(this.aiNrMaskAttackMs, this.aiNrWeakAttackMs) - this.aiNrMaskAttackMs);
      aAtt = 1 - Math.exp(-ms.hopS / (att / 1000));
      const rel = this.aiNrMaskReleaseMs + q * (Math.max(this.aiNrMaskReleaseMs, this.aiNrWeakReleaseMs) - this.aiNrMaskReleaseMs);
      const sm = this.aiNrMaskSmoothHz + q * (Math.max(this.aiNrMaskSmoothHz, this.aiNrWeakSmoothHz) - this.aiNrMaskSmoothHz);
      aRel = 1 - Math.exp(-ms.hopS / (rel / 1000));
      band = Math.max(0, Math.round(sm / ms.binHz));
      relMs = rel;
      // From the slider's own limit, so the top end's tighter cut is not undone.
      const baseFloor = Math.abs(floorDB);
      floorDB = -(baseFloor + q * (Math.min(Math.abs(this.aiNrWeakFloorDB), baseFloor) - baseFloor));
    }
    if (speech && this.aiNrSpeechReleaseMs > relMs) {
      aRel = 1 - Math.exp(-ms.hopS / (this.aiNrSpeechReleaseMs / 1000));
    }
    const out = [];
    let i = 0;
    while (i < wet.length) {
      const take = Math.min(hop - ms.pending, wet.length - i);
      histW.copyWithin(0, take); histW.set(wet.subarray(i, i + take), N - take);
      histD.copyWithin(0, take); histD.set(dry.subarray(i, i + take), N - take);
      i += take; ms.pending += take;
      if (ms.pending < hop) break;
      ms.pending = 0;

      for (let j = 0; j < N; j++) { reW[j] = histW[j] * win[j]; imW[j] = 0; reD[j] = histD[j] * win[j]; imD[j] = 0; }
      transformFlat(reW, imW, false);
      transformFlat(reD, imD, false);
      for (let k = 0; k <= half; k++) {
        pw[k] = reW[k] * reW[k] + imW[k] * imW[k];
        pd[k] = reD[k] * reD[k] + imD[k] * imD[k];
      }
      // Running sums give the ±band average in one pass.
      let sw = 0, sd = 0;
      for (let k = 0; k <= Math.min(band, half); k++) { sw += pw[k]; sd += pd[k]; }
      for (let k = 0; k <= half; k++) {
        const kin = k + band + 1 <= half ? k + band + 1 : -1;
        let gdb = sd > 1e-20 ? 10 * Math.log10(Math.max(sw, 1e-30) / sd) : 0;
        if (gdb > 0) gdb = 0;
        if (gdb < floorDB) gdb = floorDB;
        sdb[k] += (gdb > sdb[k] ? aAtt : aRel) * (gdb - sdb[k]);
        const hk = (1 - w) + w * g * Math.pow(10, sdb[k] / 20);
        reD[k] *= hk; imD[k] *= hk;
        if (k > 0 && k < half) { reD[N - k] *= hk; imD[N - k] *= hk; }
        if (kin >= 0) { sw += pw[kin]; sd += pd[kin]; }
        const kout = k - band;
        if (kout >= 0) { sw -= pw[kout]; sd -= pd[kout]; }
      }
      transformFlat(reD, imD, true);
      for (let j = 0; j < N; j++) acc[j] += reD[j] * win[j] * ms.norm;
      out.push(acc.slice(0, hop));
      acc.copyWithin(0, hop); acc.fill(0, N - hop);
    }
    if (out.length === 1) return out[0];
    const r = new Float32Array(out.length * hop);
    out.forEach((b, k) => r.set(b, k * hop));
    return r;
  }

  _makeAiNrChannelState(sps) {
    const same = sps === RNNOISE_RATE;
    const mask = this.aiNrMaskMode ? this._makeAiMaskState(sps) : null;
    // Mask mode hands out whole hops only, so up to one hop more is held back.
    const prime = Math.ceil((RNNOISE_FRAME + TAPS) * sps / RNNOISE_RATE) + TAPS + (mask ? mask.hop : 0);
    const out = { buf: new Float32Array(prime * 4), len: prime };  // zeros
    return {
      sps,
      dn: this._aiNrEngine.createState(),
      up: same ? null : new PolyResampler(sps, RNNOISE_RATE, 1),
      down: same ? null : new PolyResampler(RNNOISE_RATE, sps, 1),
      mask,
      // Mask mode resamples the dry side separately; identical resamplers
      // keep the two exactly aligned.
      downDry: mask && !same ? new PolyResampler(RNNOISE_RATE, sps, 1) : null,
      wetF: mask ? new Float32Array(RNNOISE_FRAME) : null,
      in48: { buf: new Float32Array(RNNOISE_FRAME * 4), len: 0 },
      out,
      frame: new Float32Array(RNNOISE_FRAME),
      // Last RNNOISE_DELAY + RNNOISE_FRAME input samples; [0, FRAME) is the
      // dry audio that lines up with the frame RNNoise has just returned.
      dry: new Float32Array(RNNOISE_DELAY + RNNOISE_FRAME),
      eIn: 0, eOut: 0,    // slow energy of the aligned dry and the denoised frames
      eInF: 0, eOutF: 0,  // the same, short-term, for the overshoot cap
      g: 1,               // gain applied at the end of the previous frame
      w: -1,              // wet share applied at the end of the previous frame (-1 = not yet)
      vad: [0, 0, 0],     // flags of the last three input frames (output lags by two)
      hold: 0,            // frames of speech hold left
      eSp: -1, eNo: -1,   // weak-signal adaptation: speech-flagged and pause levels
      q: 0,               // weakness factor 0..1
      underruns: 0,
    };
  }

  applyAiNoiseReduction(pcmArray, chR = false) {
    if (!this.aiNrEnabled || !this._aiNrEngine || pcmArray.length === 0) return pcmArray;
    if (!this.aiNrModes.includes(this.demodulation)) return pcmArray;

    const sps = this.audioOutputSps || 12000;
    const chIdx = chR ? 1 : 0;
    let st = this._aiNrCh[chIdx];
    if (!st || st.sps !== sps || !st.mask !== !this.aiNrMaskMode) {
      if (st) st.dn.destroy();
      st = this._aiNrCh[chIdx] = this._makeAiNrChannelState(sps);
    }

    const qPush = (q, data) => {
      if (q.len + data.length > q.buf.length) {
        const grown = new Float32Array(Math.max(q.buf.length * 2, q.len + data.length));
        grown.set(q.buf.subarray(0, q.len));
        q.buf = grown;
      }
      q.buf.set(data, q.len);
      q.len += data.length;
    };
    const qShift = (q, n) => { q.buf.copyWithin(0, n, q.len); q.len -= n; };

    qPush(st.in48, st.up ? st.up.process(pcmArray) : pcmArray);

    const FRAME = RNNOISE_FRAME, S = 32768;
    const mix = this._aiTopWet(), frame = st.frame, dry = st.dry;
    const mkA = 1 - Math.exp(-(FRAME / RNNOISE_RATE) / this.aiNrMakeupTC);
    const mkMax = Math.pow(10, this.aiNrMakeupMaxDB / 20);
    const capA = 1 - Math.exp(-(FRAME / RNNOISE_RATE) / this.aiNrCapTC);
    const frameMs = FRAME / RNNOISE_RATE * 1000;
    const pauseMix = 1 - (1 - mix) * Math.min(1, Math.max(0, this.aiNrPauseDry));
    const holdFrames = Math.round(this.aiNrVadHoldMs / frameMs);
    const rampStep = (pauseMix - mix) * frameMs / Math.max(frameMs, this.aiNrPauseRampMs);
    const vadT = this.aiNrVadThresh, gated = this.aiNrMakeupGated;
    const weakA = 1 - Math.exp(-(FRAME / RNNOISE_RATE) / this.aiNrWeakTC);
    const weakOn = this.aiNrWeakAdapt, snrLo = this.aiNrWeakSnrLo, snrHi = this.aiNrWeakSnrHi;
    while (st.in48.len >= FRAME) {
      const src = st.in48.buf;
      dry.copyWithin(0, FRAME);
      dry.set(src.subarray(0, FRAME), RNNOISE_DELAY);
      for (let i = 0; i < FRAME; i++) frame[i] = src[i] * S;
      qShift(st.in48, FRAME);

      const v = st.dn.process(frame);
      // The output frame is the input from two frames back; the flags of that
      // frame and the two after it are all known now.
      st.vad[0] = st.vad[1]; st.vad[1] = st.vad[2]; st.vad[2] = v;
      if (st.vad[0] >= vadT || st.vad[1] >= vadT || st.vad[2] >= vadT) st.hold = holdFrames;
      else if (st.hold > 0) st.hold--;
      const speech = st.hold > 0;

      let eIn = 0, eOut = 0;
      for (let i = 0; i < FRAME; i++) { eIn += dry[i] * dry[i]; eOut += frame[i] * frame[i]; }
      eIn *= S * S;
      if (speech || !gated) {
        st.eIn += mkA * (eIn - st.eIn);
        st.eOut += mkA * (eOut - st.eOut);
      }

      // Running SNR from the dry frame's level: while this output frame is
      // flagged as speech, and while it is clearly a pause (flag low, no hold).
      if (weakOn) {
        if (st.vad[0] >= vadT) st.eSp = st.eSp < 0 ? eIn : st.eSp + weakA * (eIn - st.eSp);
        else if (st.vad[0] < 0.2 && st.hold === 0) st.eNo = st.eNo < 0 ? eIn : st.eNo + weakA * (eIn - st.eNo);
        if (st.eSp > 0 && st.eNo > 0) {
          const snr = 10 * Math.log10(Math.max(st.eSp / st.eNo - 1, 1e-3));
          st.q = Math.min(1, Math.max(0, (snrHi - snr) / (snrHi - snrLo)));
        }
      } else st.q = 0;
      st.eInF += capA * (eIn - st.eInF);
      st.eOutF += capA * (eOut - st.eOutF);
      // Slow make-up, capped so the short-term output level never exceeds the
      // short-term input level. Starts at unity and never attenuates.
      let g = st.eOut > 0 ? Math.min(mkMax, Math.sqrt(st.eIn / st.eOut)) : 1;
      if (st.eOutF > 0) g = Math.min(g, Math.sqrt(st.eInF / st.eOutF));
      if (!(g >= 1)) g = 1;

      // Wet share: the slider's at once when speech is flagged, the pause
      // share after the hold, reached along a ramp.
      const speechMix = mix * (1 - Math.min(1, Math.max(0, this.aiNrWeakStrengthCut)) * st.q);
      let w = speech ? speechMix : Math.min(pauseMix, (st.w < 0 ? pauseMix : st.w) + rampStep);
      if (st.w < 0) st.w = w;

      if (st.mask) {
        // Mask mode: RNNoise's output only guides the gain; the original is
        // what is played. w and g are applied per bin inside the WOLA.
        const wetF = st.wetF;
        for (let i = 0; i < FRAME; i++) wetF[i] = frame[i] / S;
        const w12 = st.down ? st.down.process(wetF) : wetF;
        const d12 = st.downDry ? st.downDry.process(dry.subarray(0, FRAME)) : dry.slice(0, FRAME);
        const o = this._aiMaskPush(st.mask, w12, d12, w, g, st.q, speech);
        if (o.length) qPush(st.out, o);
        st.g = g; st.w = w;
        continue;
      }

      // Ramp gain and wet share across the frame so neither steps.
      const g0 = st.g, dg = (g - g0) / FRAME, w0 = st.w, dw = (w - w0) / FRAME;
      for (let i = 0; i < FRAME; i++) {
        const wi = w0 + dw * i;
        frame[i] = frame[i] * wi * (g0 + dg * i) / S + dry[i] * (1 - wi);
      }
      st.g = g; st.w = w;
      qPush(st.out, st.down ? st.down.process(frame) : frame);
    }

    const n = pcmArray.length;
    const result = new Float32Array(n);
    const have = Math.min(n, st.out.len);
    result.set(st.out.buf.subarray(0, have));
    qShift(st.out, have);
    if (have < n && st.underruns++ === 0) {
      console.warn(`[AI NR] output queue ran short by ${n - have} samples — padded with silence`);
    }
    return result;
  }

  /**
   * Enable or disable AI noise reduction. The first enable downloads the
   * RNNoise module; until it arrives audio passes through untouched.
   * @param {boolean} enabled
   * @returns {Promise<boolean>} whether AI NR ended up enabled — false if the
   *   module failed to load, so the UI can put its button back.
   */
  enableAiNoiseReduction(enabled) {
    this.aiNrEnabled = !!enabled;
    this.resetAiNoiseReduction();
    console.log(`[AI NR] ${this.aiNrEnabled ? 'ENABLED' : 'DISABLED'} (mix ${Math.round(this.aiNrMix * 100)}%)`);
    if (!this.aiNrEnabled) return Promise.resolve(false);
    if (this._aiNrEngine) return Promise.resolve(true);
    return loadRnnoise()
      .then((engine) => { this._aiNrEngine = engine; return this.aiNrEnabled; })
      .catch((e) => {
        console.error('[AI NR] RNNoise failed to load:', e);
        this.aiNrEnabled = false;
        return false;
      });
  }

  // 0 = original audio, 1 = fully denoised. Takes effect on the next frame.
  setAiNoiseReductionMix(mix) {
    this.aiNrMix = Math.max(0, Math.min(1, Number(mix) || 0));
  }

  resetAiNoiseReduction() {
    for (const st of this._aiNrCh) if (st) st.dn.destroy();
    this._aiNrCh = [null, null];
  }

  // Enable/disable and tune the background-noise tool from outside (UI hook).
  setBackgroundNoiseSuppression(enabled, depthDB) {
    this.bnEnabled = !!enabled;
    if (typeof depthDB === 'number' && depthDB >= 0) {
      this.bnSuppressionDB = depthDB;
    }
    this.resetBackgroundNoise();
    console.log('[BG Noise] ' + (this.bnEnabled ? 'ENABLED' : 'DISABLED') +
                ' depth=' + this.bnSuppressionDB + 'dB modes=' + this.bnModes.join('/'));
  }

  // Frequency/mode changes invalidate the floor measurement (it describes
  // noise character at the OLD tuned spot, not the new one). Dropping the
  // per-channel state re-seeds it from the next block's actual spectrum —
  // an instant reasonable starting point rather than waiting out the slow
  // up-follower again.
  resetBackgroundNoise() {
    this._bnCh = [null, null];
  }

  _makeBNChannelState() {
    const N = this.bnFFTSize, half = N >> 1;
    const st = this._makeWolaState(N, this.bnHop);
    st.floor    = new Float32Array(half);       // per-bin noise floor estimate
    st.mags     = new Float32Array(half);       // this frame's magnitudes
    st.fast     = new Float32Array(half);       // per-bin smoothed magnitude
    st.subMin   = new Float32Array(half);       // running min of the current sub-window
    st.minHist     = [];                           // minima of the previous sub-windows
    for (let k = 0; k < Math.max(1, this.bnMinSubWindows - 1); k++) {
      st.minHist.push(new Float32Array(half));
    }
    st.gain     = new Float32Array(half).fill(1);
    st.seeded   = false;
    st.subFrames = 0;           // frames elapsed in the current sub-window
    return st;
  }

  // Per-bin suppression-depth curve — ramps from bnSuppressionDB to
  // bnSuppressionDBHigh between bnTiltLowHz and bnTiltHighHz. Cached and only
  // rebuilt when something it depends on actually changes, since recomputing
  // every bin's dB math per block is wasted work when no parameter moved.
  _bnDepthCurve(N) {
    const sps = this.audioOutputSps || 12000;
    const key = N + ':' + sps + ':' + this.bnSuppressionDB + ':' +
                this.bnSuppressionDBHigh + ':' + this.bnTiltLowHz + ':' + this.bnTiltHighHz;
    if (this._bnGainCurveKey !== key) {
      this._bnGainCurve = new Float32Array(N / 2);
      for (let j = 0; j < N / 2; j++) {
        const freq = j * sps / N;
        const frac = Math.max(0, Math.min(1,
          (freq - this.bnTiltLowHz) / (this.bnTiltHighHz - this.bnTiltLowHz)));
        // Store the depth in dB directly — the old code stored a linear gain
        // and immediately converted it back to dB every block.
        this._bnGainCurve[j] = this.bnSuppressionDB +
          frac * (this.bnSuppressionDBHigh - this.bnSuppressionDB);
      }
      this._bnGainCurveKey = key;
    }
    return this._bnGainCurve;
  }

  // ── Background noise suppression (WOLA + slow floor tracker) ──────────────
  //
  // Same disease as the old NR, same cure. This ran a 1024-point FFT over
  // `bnBuffer` after copying only the current block (120 samples) into it,
  // leaving ~900 samples of whatever the previous call had left behind; it
  // then wrote out the first 120 samples of a rectangular-window IFFT with no
  // overlap-add, so every block boundary was a discontinuity. It also scaled
  // only bins 0..N/2-1 and took the real part of the inverse, which is not the
  // filter it intended, and its `i += hop` loop never actually ran more than
  // once per call — meaning the "seconds" time constants below were being
  // applied per 10 ms block, roughly six times faster than the numbers say.
  // Finally, L and R shared one floor and one gain vector, so in C-QUAM each
  // channel was suppressed according to a mixture of both.
  //
  // The classification behaviour is deliberately unchanged: slow asymmetric
  // floor tracking, a soft knee around bnClassifyRatio, the low-to-high
  // frequency depth tilt, and attack/release smoothing of the per-bin gain.
  applyBackgroundNoiseSuppression(pcmArray, chR = false) {
    if (!this.bnEnabled) return pcmArray;
    if (pcmArray.length === 0) return pcmArray;

    // Scope strictly to SSB/AM per the stated goal — leave CW/FM/digital
    // modes completely untouched rather than guessing whether this helps
    // them too.
    if (!this.bnModes.includes(this.demodulation)) return pcmArray;

    const chIdx = chR ? 1 : 0;
    if (!this._bnCh[chIdx]) this._bnCh[chIdx] = this._makeBNChannelState();
    const st = this._bnCh[chIdx];

    const sps = this.audioOutputSps || 12000;
    const hopSeconds = st.hop / sps;

    // Smoothing rate for the per-bin magnitude, and the length of one
    // sub-window of the sliding minimum.
    const smoothAlpha = 1 - Math.exp(-hopSeconds / this.bnSmoothTC);
    const subWindows  = Math.max(1, this.bnMinSubWindows);
    const subFrames   = Math.max(1, Math.round(this.bnMinWindowSec / subWindows / hopSeconds));
    const bias        = this.bnFloorBias;

    // Per-bin gain smoothing (attack fast, release slow).
    const gainAttackAlpha  = 1 - Math.exp(-hopSeconds / (Math.max(this.bnGainAttackMs, 1e-3) / 1000));
    const gainReleaseAlpha = 1 - Math.exp(-hopSeconds / (Math.max(this.bnGainReleaseMs, 1e-3) / 1000));

    // Soft-knee boundaries around bnClassifyRatio: below loR, treated as
    // fully noise (depth curve applied); above hiR, treated as fully signal
    // (no suppression); in between, a smoothstep ramp between the two.
    const loR = this.bnClassifyRatio * (1 - this.bnKneeRatioLow);
    const hiR = this.bnClassifyRatio * (1 + this.bnKneeRatioHigh);
    const depthCurve = this._bnDepthCurve(st.N);
    const floor = st.floor, mags = st.mags, fast = st.fast, subMin = st.subMin, gain = st.gain;

    return this._wolaRun(st, pcmArray, (re, im, half) => {
      // Pass 1: smooth each bin, then track the minimum over the sliding
      // window as the running min of the current sub-window together with the
      // minima of the previous ones. Signal raises a bin but cannot lower the
      // window minimum, which is what makes this robust without any explicit
      // signal/noise decision.
      const rolled = st.subFrames >= subFrames;
      if (rolled) {
        // Retire the oldest sub-window and start a new one.
        for (let h = st.minHist.length - 1; h > 0; h--) st.minHist[h].set(st.minHist[h - 1]);
        if (st.minHist.length > 0) st.minHist[0].set(subMin);
        st.subFrames = 0;
      }

      for (let j = 0; j < half; j++) {
        const mag = Math.sqrt(re[j] * re[j] + im[j] * im[j]);
        mags[j] = mag;

        if (!st.seeded) {
          // First frame after a retune/mode change/enable: snap straight to
          // the current spectrum instead of climbing from zero, so suppression
          // is meaningful immediately rather than minutes later.
          fast[j] = mag;
          subMin[j] = mag;
          for (let h = 0; h < st.minHist.length; h++) st.minHist[h][j] = mag;
        } else {
          fast[j] += smoothAlpha * (mag - fast[j]);
        }

        if (rolled || fast[j] < subMin[j]) subMin[j] = fast[j];

        let m = subMin[j];
        for (let h = 0; h < st.minHist.length; h++) {
          if (st.minHist[h][j] < m) m = st.minHist[h][j];
        }
        floor[j] = m * bias;
      }
      st.seeded = true;
      st.subFrames++;

      // Pass 2: light 3-tap smoothing of the floor across frequency, used only
      // for the decision below — not written back. Keeps neighbouring bins
      // from picking wildly different floor references, which is what lets
      // isolated bins flip in and out of the gate independently of their
      // neighbours — the actual "musical noise".
      for (let j = 0; j < half; j++) {
        const lo = j > 0 ? floor[j - 1] : floor[j];
        const hi = j < half - 1 ? floor[j + 1] : floor[j];
        const ref = (lo + floor[j] + hi) / 3;

        const ratio = mags[j] / Math.max(ref, 1e-9);
        let t = (ratio - loR) / (hiR - loR);
        t = t < 0 ? 0 : (t > 1 ? 1 : t);
        const smooth = t * t * (3 - 2 * t);   // smoothstep: 0=noise, 1=signal
        const targetGain = Math.pow(10, -depthCurve[j] * (1 - smooth) / 20);

        // Asymmetric temporal smoothing: open (gain rising) fast so real
        // signal isn't clipped on onset, close (gain falling) slowly so
        // isolated noisy frames don't cause audible chatter.
        const g = gain[j];
        gain[j] = g + (targetGain > g ? gainAttackAlpha : gainReleaseAlpha) * (targetGain - g);
      }

      this._applyBinGains(re, im, half, gain);
    });
  }


  // ═══════════════════════════════════════════════════════════════════════════
  //  AUTO NOTCH FILTER (ANF)
  //  NLMS Adaptive Linear Predictor
  // ═══════════════════════════════════════════════════════════════════════════

  // Allocate/clear every piece of ANF state for the current taps/delay.
  // The delay lines are 2x the window length and each sample is written twice
  // (at ptr and ptr+L) so the tap window is always contiguous — that removes a
  // modulo from the inner loop, which runs taps times per sample.
  _anfAllocate() {
    const L = this.anfTaps + this.anfDelay;
    this._anfW       = new Float32Array(this.anfTaps);   // adaptive weights, L channel
    this._anfBuf     = new Float32Array(2 * L);          // doubled delay line
    this._anfBufIdx  = 0;
    // Second set of state for the stereo R channel (C-QUAM)
    this._anfWR      = new Float32Array(this.anfTaps);
    this._anfBufR    = new Float32Array(2 * L);
    this._anfBufIdxR = 0;
    this._anfXvec    = new Float32Array(this.anfTaps);   // per-block tap cache (scratch)
  }

  // True only when the notch should actually process audio. Kept separate from
  // anfEnabled so the UI indicator still reflects what the user asked for.
  anfActive() {
    if (!this.anfEnabled) return false;
    if (this.anfBypassCW && this.demodulation === 'CW') {
      if (!this._anfCWBypassLogged) {
        console.log('[ANF] bypassed in CW — the notch would cancel the CW tone itself');
        this._anfCWBypassLogged = true;
      }
      return false;
    }
    this._anfCWBypassLogged = false;
    return true;
  }

  // Pick the decorrelation delay for the current demodulation mode and clear
  // any weights trained under the previous one.
  _anfApplyModeDefaults() {
    const wanted = (this.demodulation === 'FM' || this.demodulation === 'NFM' || this.demodulation === 'WFM')
      ? this.anfDelayFM
      : this.anfDelaySSB;
    if (wanted !== this.anfDelay) {
      this.anfDelay = wanted;
      this._anfAllocate();          // buffer length depends on the delay
      console.log(`[ANF] delay set to ${wanted} samples for ${this.demodulation}`);
      return;
    }
    this.resetAutoNotch();
  }

  applyAutoNotch(pcmIn, chR = false) {
    const N      = pcmIn.length;
    const out    = new Float32Array(N);
    if (N === 0) return out;

    const taps   = this.anfTaps;
    const D      = this.anfDelay;
    const mu     = this.anfMu;
    const leak   = 1e-4;           // weight leakage — prevents long-term drift
    const eps    = 1e-9;           // NLMS denominator floor (prevents ÷0)
    const leak_c = 1.0 - mu * leak;

    const w      = chR ? this._anfWR    : this._anfW;
    const buf    = chR ? this._anfBufR  : this._anfBuf;
    const L      = taps + D;       // one window; buf holds two copies of it
    let   ptr    = chR ? this._anfBufIdxR : this._anfBufIdx;

    const xvec   = this._anfXvec;  // reused across blocks — no per-block alloc

    for (let n = 0; n < N; n++) {
      // A single NaN/Inf from a corrupt frame would poison every weight for
      // good (they are fed back each sample), silencing the audio until the
      // next mode change. Drop it here instead.
      const x = Number.isFinite(pcmIn[n]) ? pcmIn[n] : 0;

      // 1. Write current sample into both halves of the delay line
      buf[ptr] = x;
      buf[ptr + L] = x;

      // 2. Fill tap cache, compute prediction ŷ and signal power in one pass.
      //    Tap k is the sample at lag D+k, i.e. index ptr+L-D-k, which walks
      //    down a contiguous run — no wraparound arithmetic needed.
      let yhat  = 0.0;
      let power = eps;
      const base = ptr + L - D;
      for (let k = 0; k < taps; k++) {
        const s  = buf[base - k];
        xvec[k]  = s;
        yhat    += w[k] * s;
        power   += s * s;
      }

      // 3. Prediction error = desired output (tones predicted → cancelled;
      //    voice is unpredictable → passes through untouched)
      const e = x - yhat;

      // 4. NLMS weight update with leakage:
      //    w[k] ← w[k]·(1 − μ·leak) + (μ/‖x‖²)·e·x[n−D−k]
      const mu_n = mu / power;
      for (let k = 0; k < taps; k++) {
        w[k] = w[k] * leak_c + mu_n * e * xvec[k];
      }

      // No hard clip — NLMS is unconditionally stable, and a fixed threshold
      // destroyed normal audio because the Opus decode gain puts samples far
      // above ±1.5.
      out[n] = e;

      // 5. Advance circular pointer
      ptr = ptr + 1 === L ? 0 : ptr + 1;
    }

    if (chR) { this._anfBufIdxR = ptr; }
    else     { this._anfBufIdx  = ptr; }

    // Cheap once-per-block sanity check: if the weight vector has gone
    // non-finite despite the input guard (extreme levels, mu mis-set), start
    // over rather than emitting NaN audio for the rest of the session.
    for (let k = 0; k < taps; k++) {
      if (!Number.isFinite(w[k])) {
        console.warn('[ANF] weights diverged — resetting adaptive filter');
        w.fill(0);
        buf.fill(0);
        break;
      }
    }

    return out;
  }

  /**
   * Reset the ANF adaptive weights and delay lines.
   * Call this whenever the demodulation mode changes to avoid
   * stale weight vectors from a previous mode corrupting the new one.
   */
  resetAutoNotch() {
    this._anfW.fill(0);
    this._anfBuf.fill(0);
    this._anfBufIdx = 0;
    this._anfWR.fill(0);
    this._anfBufR.fill(0);
    this._anfBufIdxR = 0;
  }

  /**
   * Enable or disable the Auto Notch Filter.
   * @param {boolean} enabled
   */
  enableAutoNotch(enabled) {
    const was = this.anfEnabled;
    this.anfEnabled = !!enabled;
    if (!was && this.anfEnabled) {
      // Re-entering: clear stale weights so filter converges cleanly, and pick
      // the delay that suits the mode we are actually in right now.
      this._anfApplyModeDefaults();
    }
    console.log(`[ANF] Auto Notch Filter: ${this.anfEnabled ? '✅ ENABLED' : '❌ DISABLED'}`);
  }

  /**
   * Tune the Auto Notch Filter parameters at run-time.
   *
   * @param {object} opts
   * @param {number} [opts.mu]     NLMS step size (0.005 – 0.05).
   *                               Lower  → slower convergence, less audio artefact.
   *                               Higher → faster lock-on,    more background ripple.
   * @param {number} [opts.taps]  FIR predictor length (16 – 256).
   *                               More taps = more simultaneous notches and sharper cuts.
   *                               More taps also increases CPU load (linear).
   * @param {number} [opts.delay] Decorrelation delay in samples (1 – 8).
   *                               2 is ideal for SSB/AM.
   *                               Set to ≥ 8 for wideband FM.
   *                               Also sets the per-mode default for this class
   *                               of mode, so a later mode switch keeps it.
   */
  setAutoNotchParams({ mu, taps, delay } = {}) {
    let resetNeeded = false;   // only taps/delay changes require a reallocation

    if (mu !== undefined) {
      this.anfMu = Math.max(1e-4, Math.min(0.1, mu));
      // mu is a scalar — update in-flight, no state reset needed
      console.log(`[ANF] mu updated → ${this.anfMu}`);
    }
    if (taps !== undefined) {
      const newTaps = Math.max(8, Math.min(512, Math.round(taps)));
      if (newTaps !== this.anfTaps) {
        this.anfTaps = newTaps;
        resetNeeded = true;
      }
    }
    if (delay !== undefined) {
      const newDelay = Math.max(1, Math.min(32, Math.round(delay)));
      // Remember it as the default for this family of modes, otherwise the
      // next mode switch would silently undo the operator's choice.
      if (this.demodulation === 'FM' || this.demodulation === 'NFM' || this.demodulation === 'WFM') {
        this.anfDelayFM = newDelay;
      } else {
        this.anfDelaySSB = newDelay;
      }
      if (newDelay !== this.anfDelay) {
        this.anfDelay = newDelay;
        resetNeeded = true;
      }
    }

    if (resetNeeded) {
      // Reallocate buffers and weights to match new dimensions
      this._anfAllocate();
      console.log(`[ANF] Params updated — taps=${this.anfTaps}, delay=${this.anfDelay}, mu=${this.anfMu}`);
    }
  }
  // ── end ANF ───────────────────────────────────────────────────────────────


  /*
  * CONFIGURABLE NOISE GATE PRESETS
  * ================================
  * 
  * Usage: spectrumAudio.setNoiseGatePreset('preset-name')
  * 
  * Available presets:
  * 
  * 'balanced' (default)  - General purpose, works well for most situations
  * 'aggressive'          - More noise reduction, quieter background (-20 dB)
  * 'weak-signal'         - Better preservation of weak DX signals
  * 'smooth'              - Less gate "pumping", smoother transitions
  * 'maximum'             - Maximum quieting for very noisy bands (-26 dB)
  * 'cw'                  - Optimized for CW and digital modes
  * 'am-fm'               - Optimized for AM/FM with natural sound
  * 
  */

  applyNoiseCancel(pcmArray) {
    if (!this.noiseCancelEnabled) return pcmArray;

    const out = new Float32Array(pcmArray.length);

    // --- State ---
    let env        = this.noiseEnv || 0;
    let noiseFloor = this.noiseFloor || 0.001;
    let gateOpen   = (this.noiseGateOpen !== undefined)
      ? this.noiseGateOpen
      : true;
    let gateGain   = this.noiseGateGain ?? 1.0;

    // Track gate state changes for debugging
    const previousGateState = gateOpen;

    // Select parameters based on preset (ENHANCED FOR MORE AUDIBLE DIFFERENCES)
    let alphaEnv, alphaNoiseFloor, openFactor, closeFactor, floorGain;
    
    switch (this.noiseGatePreset) {

      case 'aggressive':
        alphaEnv = 0.0025;          // faster open (prevents clipped consonants)
        alphaNoiseFloor = 0.00008;
        // FIX: openFactor/closeFactor were swapped in all presets — see comment below.
        // Correct invariant: openFactor (HIGH) > closeFactor (LOW).
        // Gate opens when ratio > openFactor, closes when ratio < closeFactor.
        // Dead zone [closeFactor, openFactor] prevents chattering.
        openFactor = 3.50;          // HIGH — opens only on clear signal
        closeFactor = 1.70;         // LOW  — stays open through normal fades
        floorGain = 0.06;           // very quiet floor — near-silence between transmissions
        break;

      case 'weak-signal':
        alphaEnv = 0.0022;
        alphaNoiseFloor = 0.00007;
        openFactor = 3.40;          // FIX: was 1.60 (swapped)
        closeFactor = 1.60;         // FIX: was 3.40 (swapped)
        floorGain = 0.15;           // quiet floor while still keeping faint DX barely audible
        break;

      case 'smooth':
        alphaEnv = 0.0005;          // was 0.0020 — slowest envelope; immune to QSB-rate swings
        alphaNoiseFloor = 0.00006;
        openFactor = 3.60;          // FIX: was 1.75 (swapped)
        closeFactor = 1.40;         // was 1.75 — wider hysteresis; stays open through fades
        floorGain = 0.10;           // smooth fade to near-silence; no abrupt cuts
        break;

      case 'maximum':
        alphaEnv = 0.0028;
        alphaNoiseFloor = 0.00008;
        openFactor = 3.45;          // FIX: was 1.65 (swapped)
        closeFactor = 1.65;         // FIX: was 3.45 (swapped)
        floorGain = 0.03;           // maximum quieting — almost inaudible floor
        break;

      case 'cw':
        // CW needs a bit more “shape”, but still avoid clicky gating
        alphaEnv = 0.0035;
        alphaNoiseFloor = 0.00010;
        openFactor = 3.30;          // FIX: was 1.65 (swapped)
        closeFactor = 1.65;         // FIX: was 3.30 (swapped)
        floorGain = 0.06;           // near-silent floor between dits/dahs
        break;

      case 'am-fm':
        // Mostly-open feel; just gentle quieting
        alphaEnv = 0.0020;
        alphaNoiseFloor = 0.00006;
        openFactor = 3.80;          // FIX: was 2.00 (swapped)
        closeFactor = 2.00;         // FIX: was 3.80 (swapped)
        floorGain = 0.20;           // AM/FM: slightly more floor to preserve natural feel
        break;

      case 'balanced':
      default:
        alphaEnv = 0.0008;          // was 0.0024 — slower envelope; stops tracking QSB fades
        alphaNoiseFloor = 0.00008;
        openFactor = 3.50;          // FIX: was 1.70 (swapped)
        closeFactor = 1.50;         // was 1.70 — less hair-trigger on re-close during fades
        floorGain = 0.10;           // much quieter background; signals still open gate cleanly
      }

    // Debug counter for logging
    if (!this.noiseGateDebugCounter) this.noiseGateDebugCounter = 0;

    for (let i = 0; i < pcmArray.length; i++) {
      const s = pcmArray[i];
      const x = Math.abs(s);

      // Envelope follower
      env += alphaEnv * (x - env);

      // Update noise floor when we're near the noise region
      if (env < noiseFloor * 1.5) {
        noiseFloor += alphaNoiseFloor * (env - noiseFloor);
      }
      if (noiseFloor < 1e-6) noiseFloor = 1e-6;

      const ratio = env / noiseFloor;

      if (gateOpen) {
        if (ratio < closeFactor) {
          gateOpen = false;
        }
      } else {
        if (ratio > openFactor) {
          gateOpen = true;
        }
      }

      // Smooth gain ramp instead of hard binary switch — eliminates breathing/clicks.
      // Close is slow (~250 ms), open is fast (~20 ms) so signals cut through immediately.
      const targetGain = gateOpen ? 1.0 : floorGain;
      gateGain += (targetGain > gateGain ? 0.002 : 0.0003) * (targetGain - gateGain);
      out[i] = s * gateGain;
    }

    // Debug logging (once every 5 seconds)
    this.noiseGateDebugCounter++;
    if (this.noiseGateDebugCounter % 60000 === 0) {
      console.log(`[Noise Gate] Preset: ${this.noiseGatePreset}, Gate: ${gateOpen ? 'OPEN' : 'CLOSED'}, Env: ${env.toFixed(6)}, Noise: ${noiseFloor.toFixed(6)}, Ratio: ${(env/noiseFloor).toFixed(2)}x, FloorGain: ${floorGain}`);
    }

    // Log state changes
    if (gateOpen !== previousGateState) {
      console.log(`[Noise Gate] ${gateOpen ? '🔊 OPENED' : '🔇 CLOSED'} (Preset: ${this.noiseGatePreset}, FloorGain: ${floorGain})`);
    }

    this.noiseEnv      = env;
    this.noiseFloor    = noiseFloor;
    this.noiseGateOpen = gateOpen;
    this.noiseGateGain = gateGain;

    return out;
  }

  // Create the decoder for `codec` ('flac' | 'opus'), freeing any previous one,
  // and (re)attach the backend control methods.  Called at connect time and
  // whenever the server switches this client's codec mid-session.
  _buildDecoder(codec) {
    // ✅ Free old decoder before creating new one to prevent memory leak
    if (this.decoder && typeof this.decoder.free === 'function') {
      try {
        console.log('[Audio] Freeing old decoder before creating new one');
        this.decoder.free();
      } catch (e) {
        console.warn('[Audio] Error freeing old decoder:', e);
      }
      this.decoder = null;
    }

    if (codec === 'opus') {
      // Use WASM-based Opus ML decoder for raw Opus frames.  Build it at the
      // current channel count (2 for C-QUAM) up front so we don't create a mono
      // decoder and immediately rebuild it stereo via setChannels().
      this.decoder = new OpusMLAdapter(this.audioMaxSps || this.trueAudioSps || this.audioOutputSps || 48000, this.channels || 1);
    } else {
      // Use existing wrapper-based decoder (FLAC, etc.)
      this.decoder = createDecoder(codec, this.audioMaxSps, this.trueAudioSps, this.audioOutputSps);

      // ✅ CRITICAL FIX: Disable buggy WASM noise blanker for FLAC
      // The WASM FLAC decoder has a noise blanker with an index-out-of-bounds bug
      // (noiseblankerwild.rs:189 - tries to access array[26] when len=26).
      // Override set_nb() to prevent the crash while keeping JavaScript NB working.
      if (codec === 'flac' && this.decoder && typeof this.decoder.set_nb === 'function') {
        const originalSetNb = this.decoder.set_nb.bind(this.decoder);
        this.decoder.set_nb = function(enabled) {
          console.warn('[FLAC NB Bypass] WASM noise blanker disabled due to bug (use JavaScript NB instead)');
          // Don't call originalSetNb - it crashes!
          // JavaScript noise blanker (applyNoiseBlanker) will handle it instead
        };
        console.log('✅ FLAC WASM noise blanker bypassed - using JavaScript noise blanker only');
      }
    }

    // ============================================================================
    // Add backend audio control methods to decoder (signal.cpp control)
    // ============================================================================
    if (this.decoder) {
      // Store reference to WebSocket for sending commands
      this.decoder.socket = this.audioSocket;

      // Backend noise gate preset control
      this.decoder.set_noise_gate_preset = function(preset) {
        if (this.socket && this.socket.readyState === 1) {
          this.socket.send(JSON.stringify({
            cmd: "noise_gate_preset",
            preset: preset
          }));
          console.log('✅ Backend noise gate preset:', preset);
        } else {
          console.warn('⚠️ WebSocket not ready for noise gate preset');
        }
      };

      // Backend noise gate enable/disable
      this.decoder.set_noise_gate_enable = function(enabled) {
        if (this.socket && this.socket.readyState === 1) {
          this.socket.send(JSON.stringify({
            cmd: "noise_gate_enable",
            enabled: enabled
          }));
          console.log('✅ Backend noise gate:', enabled ? 'ENABLED' : 'DISABLED');
        } else {
          console.warn('⚠️ WebSocket not ready for noise gate enable');
        }
      };

      // Backend AGC enable/disable
      this.decoder.set_agc_enable = function(enabled) {
        if (this.socket && this.socket.readyState === 1) {
          this.socket.send(JSON.stringify({
            cmd: "agc_enable",
            enabled: enabled
          }));
          console.log('✅ Backend AGC:', enabled ? 'ENABLED' : 'DISABLED');
        } else {
          console.warn('⚠️ WebSocket not ready for AGC enable');
        }
      };

      // ✅ For FLAC: Add JavaScript noise blanker control method
      // Since WASM NB is bypassed, provide alternative control
      // Blanker only — NR has its own switch and its own button in the UI.
      this.decoder.set_js_nb = (enabled) => {
        this.enableNoiseBlanker(enabled);
      };

      // Make it easy to enable both blanker and NR together
      this.decoder.enableJavascriptNoiseBlanker = () => {
        this.enableNoiseBlanker(true);
        this.enableNoiseReduction(true);
      };

      this.decoder.disableJavascriptNoiseBlanker = () => {
        this.enableNoiseBlanker(false);
        this.enableNoiseReduction(false);
      };

      // Keep the fresh decoder's channel count in sync (mono vs C-QUAM stereo).
      if (typeof this.decoder.setChannels === 'function') {
        this.decoder.setChannels(this.channels || 1);
      }

      console.log('✅ Backend audio control methods initialized');
    }
    // ============================================================================
  }

  // Swap the active decoder to `codec` mid-session, in response to the server
  // changing this client's codec (it does so when C-QUAM is toggled: Opus while
  // stereo is active, the configured default — normally FLAC — otherwise).
  // No-op if the codec is unchanged.  A brief audio gap at the swap is expected.
  switchCodec(codec) {
    const c = (codec === 'opus') ? 'opus' : 'flac';
    if (!this.settings) this.settings = {};
    if (this.settings.audio_compression === c) return;
    if (!this.audioCtx) {
      // Decoder not built yet (pre-initAudio); just record the choice.
      this.settings.audio_compression = c;
      return;
    }
    console.log('[Audio] Runtime codec switch:', this.settings.audio_compression, '→', c);
    // Update settings BEFORE rebuilding: the flac gain-boost path in decode()
    // keys off this.settings.audio_compression, so it must match the new codec.
    this.settings.audio_compression = c;
    this._buildDecoder(c);
  }

  initAudio(settings) {
    const sampleRate = this.audioOutputSps
    const nativeRate = this._wantsNativeContextRate()

    // ── Reconnect: reuse the graph that is already there ──────────────────
    // Rebuilding would leak the old context and, worse, hand the listener a
    // brand-new suspended one — which on a phone means "Tap to start" every
    // time the network changed, because the gesture that unlocked audio
    // belongs to the context it unlocked. Everything the listener has set
    // (gain, filters, EQ, compressor) already lives on these nodes, so
    // reusing them keeps all of it across a drop.
    //
    // Only the per-stream state is reset: a fresh decoder, since the old one
    // holds partly-consumed frames from a stream that has ended, and the
    // playback timeline, since audioCtx.currentTime has run on throughout.
    // Under ?ctxrate=native the context's rate is whatever the device chose and
    // will not change between connections, so any live context is reusable.
    if (this.audioCtx && this.audioCtx.state !== 'closed' &&
        (nativeRate || this.audioCtx.sampleRate === sampleRate)) {
      this.audioStartTime = this.audioCtx.currentTime
      this.playTime       = this.audioCtx.currentTime + this.bufferThreshold
      this.playStartTime  = this.audioCtx.currentTime
      this._buildDecoder(settings.audio_compression)
      this._resetPlaybackQueues()
      this._clearInitTimeout()
      if (this.resolvePromise) this.resolvePromise(settings)
      this._resetInitPromise()
      return
    }

    // Not reusable — a context at a different sample rate, or a closed one.
    // Close it explicitly; letting it drop out of scope leaks a live audio
    // device on every reconnect.
    if (this.audioCtx) {
      try { if (this.audioCtx.state !== 'closed') this.audioCtx.close() } catch (_) {}
      this._resetWorkletState()
      this.audioCtx = null
    }

    // ── Which rate to run the context at ──────────────────────────────────
    // Normally we ask for audioOutputSps (12 kHz here), which keeps the graph
    // at the stream's own rate and lets the worklet copy samples straight
    // through. The browser then resamples the whole 12 kHz context up to the
    // device's hardware rate, once, on the way out.
    //
    // That last step is not equally good everywhere. A desktop resamples it
    // cleanly; a phone reportedly does not, which would explain audio that is
    // clean on a PC and distorted on a handset over the identical code path —
    // headphones and all, so not the speaker.
    //
    // ?ctxrate=native runs the context at whatever the device wants instead,
    // leaving the 12 kHz → hardware conversion to the AudioBufferSourceNode
    // resampler, which is a different implementation. The sample-rate guard
    // below then forces the fallback path automatically, because the worklet
    // cannot resample. Opt-in: this is a comparison, not a default.
    try {
      this.audioCtx = nativeRate
        ? new AudioContext()
        : new AudioContext({ sampleRate: sampleRate })
    } catch {
      this._clearInitTimeout()
      if (this.resolvePromise) this.resolvePromise()
      this._resetInitPromise()
      return
    }

    // ── The worklet cannot resample, so it must not run at the wrong rate ──
    // process() copies samples 1:1 into the output; sampleRateHint sizes the
    // ring buffer and nothing else. A browser that declines the rate we asked
    // for and hands back its hardware rate instead would therefore play
    // everything at the wrong pitch, with nothing in the console to say so.
    //
    // The AudioBufferSourceNode fallback is immune — its AudioBuffer carries
    // its own sampleRate and the browser resamples on playback — so the right
    // response is to force that path. It is a slightly worse scheduler playing
    // the correct audio, rather than a better one playing nonsense.
    //
    // Unreachable while the station is plain http, where the only listener on
    // the worklet is localhost. It becomes reachable the moment the page is
    // served over https and every listener moves onto the worklet.
    if (this.audioCtx.sampleRate !== sampleRate) {
      console.warn(
        `[Audio] AudioContext runs at ${this.audioCtx.sampleRate} Hz, not the ` +
        `${sampleRate} Hz requested; resampling the stream to match.`
      );
    }
    // Any carried resampler state belongs to the old context's rate.
    this._resampler = null;

    this.audioStartTime = this.audioCtx.currentTime
    this.playTime       = this.audioCtx.currentTime + this.bufferThreshold;
    this.playStartTime  = this.audioCtx.currentTime;

    // Build the audio decoder for the negotiated codec.  Factored into
    // _buildDecoder() so the same setup runs when the server swaps this
    // client's codec at runtime (FLAC↔Opus on C-QUAM) — see switchCodec().
    this._buildDecoder(settings.audio_compression)
    // ============================================================================

    // Bass boost (lowshelf filter) – a bit more bass, slightly higher corner
    this.bassBoost = new BiquadFilterNode(this.audioCtx)
    this.bassBoost.type = 'lowshelf'
    this.bassBoost.frequency.value = 120    // was 100
    this.bassBoost.Q.value = 0.8            // was 0.7
    this.bassBoost.gain.value = 8           // was 6 (more bass)

    /* Bandpass (upper mids) – slightly lower center, softer gain
      so the midrange is not so “forward” */
    this.bandpass = new BiquadFilterNode(this.audioCtx)
    this.bandpass.type = 'peaking'
    this.bandpass.frequency.value = 1800    // was 1800
    this.bandpass.Q.value = 1.0             // was 1.2
    this.bandpass.gain.value = 3            // updateFilters() sets 3 for USB/LSB, 2 for AM/FM — constructor value is immediately overridden

    // High-pass filter – let a bit more low end through
    this.highPass = new BiquadFilterNode(this.audioCtx)
    this.highPass.type = 'highpass'
    this.highPass.frequency.value = 45      // was 60
    this.highPass.Q.value = 0.7

    /* Presence boost – move it lower and reduce gain
      so highs are smoother / less sharp */
    this.presenceBoost = new BiquadFilterNode(this.audioCtx)
    this.presenceBoost.type = 'peaking'
    this.presenceBoost.frequency.value = 2200  // was 3500 — 2200Hz sits inside SSB passband where consonant intelligibility lives; updateFilters() overrides per mode
    this.presenceBoost.Q.value = 1.2
    this.presenceBoost.gain.value = 2          // was 4 — updateFilters() overrides this per mode

    // Convolver node for additional filtering
    // Mains hum notch filters — 50 Hz (EU/Asia) and 60 Hz (Americas).
    // Both are always in the graph; each can be enabled/disabled independently
    // via setHumNotch(). Q=10 → ~5 Hz bandwidth at 50 Hz, ~6 Hz at 60 Hz.
    this.humNotch50 = new BiquadFilterNode(this.audioCtx)
    this.humNotch50.type = 'allpass'  // transparent until enabled — allpass = unity gain all freqs
    this.humNotch50.frequency.value = 50
    this.humNotch50.Q.value = 10     // Q=10 → ~5 Hz bandwidth; catches drifting hum, still inaudible in voice
    this.humNotch50Enabled = false    // off by default — sysop enables via setHumNotch()

    this.humNotch60 = new BiquadFilterNode(this.audioCtx)
    // These are brand-new nodes with no connections, so the memo in
    // _rebuildOutputChain describes the OLD graph and must be dropped — otherwise
    // an unchanged topology would skip wiring the new chain entirely (no audio).
    this._outputChainSig = undefined
    if (this._chainDipTimer) { clearTimeout(this._chainDipTimer); this._chainDipTimer = null }
    this._chainDipActive = false
    this.humNotch60.type = 'allpass'  // transparent until enabled
    this.humNotch60.frequency.value = 60
    this.humNotch60.Q.value = 10     // Q=10 → ~6 Hz bandwidth at 60 Hz
    this.humNotch60Enabled = false

    this.convolverNode = new ConvolverNode(this.audioCtx)
    this.setLowpass(15000)

    // Dynamic compressor — tuned for SSB voice speech processing.
    // Off by default; toggle with setCompressor(true) from the UI.
    this.compressor = new DynamicsCompressorNode(this.audioCtx)
    this.compressor.threshold.value = -30;  // start compressing well below peaks
    this.compressor.knee.value = 10;        // moderate knee for smooth onset
    this.compressor.ratio.value = 4;        // 4:1 — solid SSB speech compression
    this.compressor.attack.value = 0.085;   // fast enough to catch syllables
    this.compressor.release.value = 0.50;   // natural release for voice
    this.compressorEnabled = false          // default OFF

    // Makeup gain — compression lowers the average level, so raise it back
    // here. THIS is the knob to change the compressor's audio level:
    //   > 1.0 louder, < 1.0 quieter.
    this.compressorMakeup = new GainNode(this.audioCtx)
    this.compressorMakeup.gain.value = 0.3   // <-- COMPRESSOR AUDIO LEVEL HERE (0-1 = quieter, >1 = louder)

    // Auto-makeup: when ON, the makeup gain is driven by threshold, knee and
    // ratio, spanning _makeupMin..._makeupMax. Each knob maps to a 0..1 factor
    // (threshold -60 dB→0 .. 0 dB→1; knee 0→0 .. 40→1; ratio 20:1→0 .. 1:1→1);
    // the three factors are averaged and mapped onto the makeup range. ON by
    // default. So threshold/knee up → louder, ratio up → quieter.
    this.autoMakeup = true
    this._makeupMin = 0.3
    this._makeupMax = 1.5
    this._applyAutoMakeup()

    // 5-band graphic equalizer — peaking filters log-spaced 100 Hz .. 10 kHz.
    // Off by default; each band gain is in dB (-12 .. +12), 0 = flat.
    this.eqEnabled = false
    this.eqFreqs = [100, 350, 1000, 2000, 3000, 5000]
    this.eqBands = this.eqFreqs.map((f) => {
      const b = new BiquadFilterNode(this.audioCtx)
      b.type = 'peaking'
      b.frequency.value = f
      b.Q.value = 1.0
      b.gain.value = 0
      return b
    })

    // Gain node
    this.gainNode = new GainNode(this.audioCtx)
    this.setGain(1.0) // was 3.5 — 3.5× on top of 6× = 21× total, still fine
    this._configureAudioLevelMode(this.audioLevelMode || 0)
    this._resetAudioLevelControl()

    // Add MediaStreamDestination node
    this.destinationNode = new MediaStreamAudioDestinationNode(this.audioCtx);

    // Connect nodes in the correct order
    this.convolverNode.connect(this.highPass)
    this.highPass.connect(this.bandpass)
    this.bandpass.connect(this.bassBoost)
    this.bassBoost.connect(this.presenceBoost)
    this.presenceBoost.connect(this.humNotch50)
    this.humNotch50.connect(this.humNotch60)
    // Output chain from humNotch60 -> [EQ] -> [compressor] -> gainNode is
    // built dynamically. Both EQ and compressor are OFF by default and are
    // always bypassed for digital modes (see _rebuildOutputChain).
    this._rebuildOutputChain()
    this.gainNode.connect(this.destinationNode);
    this.gainNode.connect(this.audioCtx.destination)

    // RADE decoded-audio gain node.
    // Change ONLY the next line to trim recorded demodulated RADE audio:
    // lower value = quieter recording, higher value = louder recording.
    this.radeGainNode = new GainNode(this.audioCtx)
    this.radeGainNode.gain.value = 0.20 // <-- TRIM RADE RECORDED AUDIO LEVEL HERE
    this.radeGainNode.connect(this.gainNode)

    this.audioInputNode = this.convolverNode

    // Initial filter update based on current demodulation
    this.updateFilters()

    this._clearInitTimeout()
    if (this.resolvePromise) this.resolvePromise(settings)
    this._resetInitPromise()
  }

  updateFilters() {
    switch (this.demodulation) {
      case 'USB':
      case 'LSB':
      case 'CW':
        this.bassBoost.gain.value = 12
        this.bandpass.frequency.value = 1800
        this.bandpass.Q.value = 1.0              // was 1.2 — wider peak, less forward midrange
        this.bandpass.gain.value = 3
        this.highPass.frequency.value = 60
        this.presenceBoost.frequency.value = 2200 // was 3500 — inside passband, consonant band; 3500 was above FIR cutoff
        this.presenceBoost.gain.value = 2         // was 4 — softer boost; 4dB at 3500Hz was boosting filter skirt noise
        this.setLowpass(3000)
        break
      case 'AM':
        this.bassBoost.gain.value = 20
        this.bandpass.frequency.value = 1500
        this.bandpass.Q.value = 1
        this.bandpass.gain.value = 2
        this.highPass.frequency.value = 50
        this.presenceBoost.frequency.value = 2200 // explicit — don't inherit from previous mode
        this.presenceBoost.gain.value = 3
        this.setLowpass(4500)
        break
      case 'AM-S':
        // C-QUAM AM stereo carries full-fidelity music, so mono-AM's heavy 20 dB
        // low-shelf is boomy here.  Previously there was NO 'AM-S' case, so
        // C-QUAM silently inherited the previous mode's bass (usually AM's 20 dB).
        // Lighter shelf + slightly wider top end for a balanced stereo sound.
        this.bassBoost.gain.value = 8            // was inheriting 20 dB → too much bass
        this.bandpass.frequency.value = 1500
        this.bandpass.Q.value = 1
        this.bandpass.gain.value = 1
        this.highPass.frequency.value = 60       // trims subsonic rumble/boom
        this.presenceBoost.frequency.value = 2200
        this.presenceBoost.gain.value = 2
        this.setLowpass(5000)                    // a touch more air than mono AM (4500)
        break
      case 'FM':
        // Was 40dB — a 100x voltage gain on a lowshelf, with the compressor
        // downstream only doing a gentle 1.8:1 ratio above -4dB. That's
        // nowhere near enough to act as a limiter against a boost that
        // large; any real low-frequency content in FM audio would push the
        // output well past 0dBFS and hard-clip at the Web Audio
        // destination. 26dB keeps FM as the most bass-forward of the three
        // modes (above AM's 23, SSB's 15) while staying inside what this
        // compressor can actually control without audible clipping.
        this.bassBoost.gain.value = 26
        this.bandpass.frequency.value = 2400
        this.bandpass.Q.value = 1
        this.bandpass.gain.value = 2
        this.highPass.frequency.value = this.ctcss ? 35 : 100
        this.presenceBoost.frequency.value = 2200 // explicit — don't inherit from previous mode
        this.presenceBoost.gain.value = 3
        this.setLowpass(4800)
        break
    }
    // If a hum notch is active, keep highpass at 35 Hz regardless of mode
    // default — a mode switch must not silently undo the notch effectiveness
    // by pre-attenuating 50/60 Hz before it reaches the notch filter.
    if ((this.humNotch50Enabled || this.humNotch60Enabled) && this.highPass) {
      this.highPass.frequency.value = 35;
    }
  }


  /**
   * The rate the Web Audio graph itself runs at.
   *
   * Almost always audioOutputSps, because that is what we ask the context for.
   * It differs when the browser declines that rate, or under ?ctxrate=native —
   * and anything that builds an AudioBuffer for a node in the graph has to
   * follow the graph, not the stream.
   */
  _graphSampleRate() {
    return (this.audioCtx && this.audioCtx.sampleRate) || this.audioOutputSps || 12000
  }

  setFIRFilter(fir) {
    // A ConvolverNode requires its buffer to be at the context's sample rate
    // and throws NotSupportedError otherwise. This used to build the buffer at
    // audioOutputSps unconditionally, which is the same thing only while the
    // context is running at the stream's rate. When it is not, this threw from
    // inside initAudio, nothing caught it, the init promise never settled and
    // the page simply never started — so a browser that declined 12 kHz did
    // not fall back gracefully, it failed to load at all.
    const firAudioBuffer = new AudioBuffer({
      length: fir.length,
      numberOfChannels: 1,
      sampleRate: this._graphSampleRate()
    })
    firAudioBuffer.copyToChannel(fir, 0, 0)
    this.convolverNode.buffer = firAudioBuffer
  }

  setLowpass(lowpass, transitionWidth = 400) {
    // Designed against the GRAPH's rate, not the stream's: the convolver sits
    // after the source node, so it sees audio already converted to the context
    // rate. Designing at the stream rate would put the cutoff in the wrong
    // place by exactly the ratio between the two.
    const sampleRate = this._graphSampleRate()
    // Bypass the FIR filter if the sample rate is low enough
    if (lowpass >= sampleRate / 2) {
      this.setFIRFilter(Float32Array.of(1))
      return
    }
    // transitionWidth was hardcoded at 1000 Hz — a gentle roll-off that lets
    // noise well above the nominal cutoff leak through before being
    // attenuated. 400 Hz gives a much sharper transition at the SAME
    // cutoff frequencies already set per mode, purely via a longer linear
    // FIR filter — no adaptive/gating behavior, so no pumping or musical
    // noise, just less out-of-band noise getting through to begin with.
    const fir = firdes_kaiser_lowpass(lowpass / sampleRate, transitionWidth / sampleRate, 0.001)
    this.setFIRFilter(fir)
  }


  // Audio Buffer Delay function that sets the new values for //
  // bufferLimit and bufferThreshold //
  setAudioBufferDelay(newAudioBufferLimit, newAudioBufferThreshold) {
  // Validate inputs
  if (typeof newAudioBufferLimit !== 'number' || typeof newAudioBufferThreshold !== 'number') {
    console.warn('Invalid buffer delay parameters, using defaults');
    this.bufferLimit = 0.25;      // the constructor default, not 0.15
    this.bufferThreshold = 0.01;
    this._pushWorkletBufferConfig();
    return;
  }
  
  // Ensure threshold is less than limit
  if (newAudioBufferThreshold >= newAudioBufferLimit) {
    console.warn('Threshold must be less than limit, adjusting automatically');
    newAudioBufferThreshold = newAudioBufferLimit * 0.5;
  }
  
  // Clamp to reasonable ranges (20ms to 5 seconds)
  this.bufferThreshold = Math.max(0.02, Math.min(5.0, newAudioBufferThreshold));
  this.bufferLimit = Math.max(0.02, Math.min(5.0, newAudioBufferLimit));
  
  console.log(`Audio buffer delay updated: threshold=${this.bufferThreshold.toFixed(3)}s, limit=${this.bufferLimit.toFixed(3)}s`);

  // The two fields above are read only by the fallback scheduler in decode().
  // On the worklet path — which is every listener since the AudioWorklet fix —
  // the ring buffer inside the worklet is what decides whether audio breaks up,
  // and it does not see them unless we say so. Without this line the buffer
  // presets are inert: a listener on a jittery mobile link can drag the setting
  // to its maximum and not one millisecond of buffering changes.
  this._pushWorkletBufferConfig();
}

  /**
   * Ring buffer geometry for the streaming worklet, derived from the same two
   * fields the buffer presets set. Kept in one place so the node's constructor
   * options and any later 'config' message can never disagree.
   *
   * minStartSeconds keeps a 0.03 s floor of its own: bufferThreshold defaults
   * to 0.01 s, and starting playback on 10 ms of audio underruns on the next
   * render quantum. It is also held below half the ceiling, so a preset can
   * never ask the worklet to wait for more audio than it is allowed to hold.
   */
  _workletBufferOptions() {
    const limit = (typeof this.bufferLimit === 'number' && this.bufferLimit > 0)
      ? this.bufferLimit : 0.25;
    const threshold = (typeof this.bufferThreshold === 'number' && this.bufferThreshold > 0)
      ? this.bufferThreshold : 0.03;
    return {
      maxBufferedSeconds: limit,
      minStartSeconds: Math.min(Math.max(0.03, threshold), limit * 0.5),
    };
  }

  /**
   * Whether to run the AudioContext at the device's own sample rate rather
   * than at the stream's, resampling to match.
   *
   * Handsets default to the device's rate. Asking a phone for a 12 kHz context
   * makes it stretch that to its hardware rate on the way out, and at least on
   * Android that conversion is audibly poor — the same receiver over the same
   * code path is clean on a desktop and distorted on a phone, on headphones as
   * well as the speaker. Running at the rate the device actually wants and
   * doing the conversion ourselves, once and continuously, is measurably
   * better there. Desktops are left alone: their own conversion is clean and
   * there is nothing to gain by changing a path that works.
   *
   * A page says which it is by setting preferNativeContextRate before init;
   * ?ctxrate=native and ?ctxrate=stream override it either way, so the
   * comparison stays available on any device without a rebuild.
   */
  _wantsNativeContextRate() {
    try {
      const forced = new URLSearchParams(window.location.search).get('ctxrate')
      if (forced === 'native') return true
      if (forced === 'stream') return false
    } catch (e) { /* no URL to read; fall through to the page's preference */ }
    return !!this.preferNativeContextRate
  }

  /**
   * What the playback path is actually doing right now.
   *
   * The worklet path and the AudioBufferSourceNode fallback sound very
   * different, and which one you get depends on things a listener cannot see —
   * chiefly whether the page is a secure context, since BaseAudioContext's
   * audioWorklet attribute is [SecureContext] and is therefore undefined on a
   * plain-http origin that is not localhost. Over http a desktop on localhost
   * gets the worklet while a phone on the LAN address silently does not, so
   * "it is fine here and broken there" has a cause that no amount of buffer
   * tuning will reach. There is no way to see that from a phone without a USB
   * cable, hence this readout — see the mobile page's audio diagnostic line.
   */
  getPlaybackDiagnostics() {
    const ctx = this.audioCtx;
    return {
      path: this._streamWorkletNode
        ? 'worklet'
        : (this._streamForceFallback ? 'fallback' : 'starting'),
      secureContext: (typeof isSecureContext !== 'undefined') ? !!isSecureContext : null,
      workletAvailable: !!(ctx && ctx.audioWorklet),
      contextState: ctx ? ctx.state : null,
      contextSampleRate: ctx ? ctx.sampleRate : null,
      outputSampleRate: this.audioOutputSps || null,
      bufferLimit: this.bufferLimit,
      bufferThreshold: this.bufferThreshold,
      stats: this._streamStats || null,
      // Fallback-path health: restarts are underruns (a clean gap), drops are
      // chunks shed because the link ran too far ahead. Both climbing means the
      // cushion is too small for the link — raise the buffer preset.
      fallbackRestarts: this._fallbackRestarts || 0,
      fallbackDrops: this._fallbackDrops || 0,
      socketOpen: this._isSocketOpen(),
      framesPerPacket: this._pktFrames || 0,
      packetsPerSec: this._pktRate || 0,
      resampling: !!this._resampler,
      // Latency, in seconds, split by who is responsible for it.
      //   packet   — one server audio block; nothing can be played before a
      //              whole one has arrived, so it is a floor, not a setting.
      //   buffered — how far ahead of the clock we are actually scheduled.
      //              This is the part the buffer presets move.
      //   output   — the browser's own graph and device latency, which no
      //              setting here can touch and which differs hugely between
      //              a desktop and a phone.
      latency: (() => {
        const ctx = this.audioCtx
        const packet = (this._pktFrames || 0) / (this.audioOutputSps || 12000)
        const buffered = (ctx && this.playTime)
          ? Math.max(0, this.playTime - ctx.currentTime)
          : 0
        const base = (ctx && Number.isFinite(ctx.baseLatency)) ? ctx.baseLatency : 0
        const out = (ctx && Number.isFinite(ctx.outputLatency)) ? ctx.outputLatency : 0
        return { packet, buffered, base, output: out, total: packet + buffered + base + out }
      })(),
      // The rest of the chain, so a clean timeline with dirty audio can be
      // narrowed down without a cable: which codec the server actually settled
      // on for this client, how many channels are being decoded, and the
      // decoder object in use.
      codec: (this.settings && this.settings.audio_compression) || null,
      channels: this.channels || null,
      decoder: (this.decoder && this.decoder.constructor && this.decoder.constructor.name) || null,
    };
  }

  /**
   * Drop everything queued for playback, without touching the audio graph.
   *
   * Used on reconnect: the worklet's ring buffer and the S-meter queue both
   * hold audio from a stream that has ended, and playing it out after the gap
   * would be worse than the gap.
   */
  _resetPlaybackQueues() {
    if (this._streamWorkletNode) {
      try { this._streamWorkletNode.port.postMessage({ type: 'reset' }) }
      catch (e) { console.warn('[Audio] worklet reset failed:', e) }
    }
    this._dBQueue = [];
    this._fallbackRestarts = 0;
    this._fallbackDrops = 0;
    // Its history is the tail of a stream that has ended.
    this._resampler = null;
  }

  /**
   * Forget the streaming worklet entirely.
   *
   * Must run whenever the AudioContext goes, because every one of these is
   * tied to that context. A node left behind here is the quiet failure mode:
   * playPCM() finds _streamWorkletNode truthy, posts PCM to the port of a
   * processor whose context is closed, gets no error back, reports success and
   * returns the frame duration — so audio is silently dead with nothing in the
   * console. _streamWorkletModuleLoaded is per-context too, so leaving it set
   * makes the next node construction skip addModule() and fail.
   */
  _resetWorkletState() {
    if (this._streamWorkletNode) {
      try { this._streamWorkletNode.port.onmessage = null } catch (_) {}
      try { this._streamWorkletNode.disconnect() } catch (_) {}
    }
    this._streamWorkletNode = null;
    this._streamConnectedNode = null;
    this._streamInitPromise = null;
    this._streamWorkletModuleLoaded = false;
    this._streamForceFallback = false;
    this._streamStats = null;
    this._loggedWorkletPlayback = false;
    this._loggedFallbackPlayback = false;
    this._loggedWorkletFailure = false;
  }

  /** Send the current buffer geometry to a live worklet node, if there is one. */
  _pushWorkletBufferConfig() {
    if (!this._streamWorkletNode) return;
    try {
      this._streamWorkletNode.port.postMessage(
        Object.assign({ type: 'config' }, this._workletBufferOptions())
      );
    } catch (e) {
      console.warn('[Audio] Worklet buffer reconfigure failed:', e);
    }
  }

  setFT8Decoding(value) {
    this.decodeFT8 = value;
    if (value) this._ftxSetActiveMode('FT8');
    if (value) {
      // ✅ FIXED: Reset farthest-distance counter and label on each new session
      this.farthestDistance = 0;
      const el = document.getElementById('farthest-distance');
      if (el) el.textContent = 'Farthest: 0 km';
    }
  }

  setFT4Decoding(value) {
    this.decodeFT4 = value;
    if (value) this._ftxSetActiveMode('FT4');
    this._rebuildOutputChain();
    if (value) {
      // ✅ FIXED: Reset farthest-distance counter and label on each new session
      this.farthestDistance = 0;
      const el = document.getElementById('farthest-distance');
      if (el) el.textContent = 'Farthest: 0 km';
    } else {
      this.isFT4Collecting = false;
      this.ft4AccumulatorLen = 0;
    }
  }

  setFT2Decoding(value) {
    this.decodeFT2 = value;
    if (value) this._ftxSetActiveMode('FT2');
    if (!value) {
      this.isFT2Collecting = false;
      this.ft2AccumulatorLen = 0;
    }
  }

  setNoiseGatePreset(preset) {
    const validPresets = ['balanced', 'aggressive', 'weak-signal', 'smooth', 'maximum', 'cw', 'am-fm'];
    if (validPresets.includes(preset)) {
      this.noiseGatePreset = preset;
      //console.log('Noise gate preset set to:', preset);
    } else {
      console.warn('Invalid noise gate preset. Valid options:', validPresets.join(', '));
      console.log('Current preset remains:', this.noiseGatePreset);
    }
  }


  setFmDeemph(tau) {
    if (tau === 0) {
      this.audioInputNode = this.convolverNode
      return
    }
    // FM deemph https://github.com/gnuradio/gnuradio/blob/master/gr-analog/python/analog/fm_emph.py
    // Digital corner frequency
    const wc = 1.0 / tau
    const fs = this.audioOutputSps

    // Prewarped analog corner frequency
    const wca = 2.0 * fs * Math.tan(wc / (2.0 * fs))

    // Resulting digital pole, zero, and gain term from the bilinear
    // transformation of H(s) = w_ca / (s + w_ca) to
    // H(z) = b0 (1 - z1 z^-1)/(1 - p1 z^-1)
    const k = -wca / (2.0 * fs)
    const z1 = -1.0
    const p1 = (1.0 + k) / (1.0 - k)
    const b0 = -k / (1.0 - k)

    const feedForwardTaps = [b0 * 1.0, b0 * -z1]
    const feedBackwardTaps = [1.0, -p1]

    // Disconnect any previously created de-emphasis node before creating the
    // new one.  Without this, every call to setFmDeemph() leaves the old
    // IIRFilterNode connected to this.convolverNode in parallel with the new
    // one, doubling the signal and creating a comb-filter artefact.
    if (this.fmDeemphNode) {
      try { this.fmDeemphNode.disconnect(); } catch (_) {}
      this.fmDeemphNode = null;
    }

    this.fmDeemphNode = new IIRFilterNode(this.audioCtx, { feedforward: feedForwardTaps, feedback: feedBackwardTaps })
    this.fmDeemphNode.connect(this.convolverNode)

    this.audioInputNode = this.fmDeemphNode
  }

  socketMessageInitial(event) {
    // first message gives the parameters in json.
    // Guard: if an audio (binary) frame ever races ahead of the settings text
    // frame, event.data is an ArrayBuffer/Blob, not a string. Such frames are
    // undecodable before settings arrive anyway — skip them and keep waiting
    // for the JSON settings rather than tearing down the socket (no sound).
    if (typeof event.data !== 'string') {
      return
    }
    let settings;
    try {
      settings = JSON.parse(event.data)
    } catch (e) {
      console.error('[Audio] socketMessageInitial: expected JSON settings, got:', typeof event.data, e)
      this._handleSocketTerminal('bad-settings')
      return
    }
    this.settings = settings
    this.fftSize = settings.fft_size
    this.audioMaxSize = settings.fft_result_size
    this.baseFreq = settings.basefreq
    this.totalBandwidth = settings.total_bandwidth
    this.sps = settings.sps
    // BUG FIX (NaN propagation): settings.fft_overlap is NOT sent by the C++
    // server's send_basic_info() (websocket.cpp).  Reading it gives undefined,
    // and undefined / 2 === NaN, silently poisoning any downstream arithmetic.
    // Default to 0 when the field is absent.
    this.audioOverlap = (settings.fft_overlap ?? 0) / 2
    this.audioMaxSps = settings.audio_max_sps
    this.grid_locator = settings.grid_locator
    this.smeter_offset = settings.smeter_offset
    this.analog_smeter_offset = settings.analog_smeter_offset ?? 0
    // Our own signal-protocol UUID, sent by the C++ server (websocket.cpp).
    // Same key used in /users and events-socket signal_changes, so the UI can
    // identify its own waterfall pill exactly instead of guessing by frequency.
    this.clientId = settings.client_id ?? null

    // The server's defaults are where a session starts. Guarded all the same:
    // a page that calls init() on a live instance (after stop(), say) has a
    // listener already tuned somewhere, and taking the defaults here would
    // clobber the local range that getAudioRange() reports.
    if (!this._everConnected) {
      this.audioL = settings.defaults.l
      this.audioM = settings.defaults.m
      this.audioR = settings.defaults.r
    }

    const targetFFTBins = Math.ceil(this.audioMaxSps * this.audioMaxSize / this.sps / 4) * 4

    this.trueAudioSps = targetFFTBins / this.audioMaxSize * this.sps
    this.audioOutputSps = Math.min(this.audioMaxSps, 96000)

    // Reinitialise the decoder accumulators now that audioOutputSps is known.
    // The constructor sizes them at 12 kHz, which truncates the collection
    // window at any higher audio_sps (WSPR needs 119 s; the FTx buffers must
    // hold a full slot_period - 0.4 s or the slot never reaches decode).
    this._initAccumulators();

    this._everConnected = true

    this._clearInitTimeout()
    this.audioSocket.onmessage = this.socketMessage.bind(this)
    this.audioSocket.onerror = (evt) => this._handleSocketTerminal('error', evt)
    this.audioSocket.onclose = (evt) => this._handleSocketTerminal('close', evt)

    try {
      this.initAudio(settings)
    } catch (e) {
      // initAudio builds the entire Web Audio graph. Anything that threw in
      // there escaped past socketMessageInitial into the WebSocket event
      // handler, so the init promise was never settled and the page sat
      // waiting for its own 20 s budget to expire — reporting a timeout for
      // what was actually an exception on the first line it touched. Settle it
      // with the real error instead.
      console.error('[Audio] initAudio failed:', e)
      this._clearInitTimeout()
      this._resetInitPromise(e instanceof Error ? e : new Error(String(e)))
      return
    }

    // Order matters: the socket handlers above are live by now, and initAudio
    // has the decoder ready, so anything the server sends in reply to these
    // will be decodable.
    this._notifyConnection('connected')

    console.log('Audio Samplerate: ', this.trueAudioSps)
  }

  socketMessage(event) {
    if (event.data instanceof ArrayBuffer) {
      const packet = cbor_decode(new Uint8Array(event.data))
      
      // ✅ ADDED: Track channel count for C-QUAM stereo
      this.channels = packet.channels || 1;

      // Mono SAM (AM) PLL lock state — drives the AM button "SAM" indicator.
      this.samLocked = !!packet.sam_locked;

      // Runtime codec switch: the server tags each audio packet with the codec
      // that produced it (see audio.cpp).  When it changes — e.g. FLAC→Opus as
      // C-QUAM is enabled — rebuild the decoder BEFORE decoding this packet so
      // the new decoder matches the new frames.
      let wantCodec = packet.codec;
      // Defensive guard: if Opus is disabled in this build the server should
      // already keep us on FLAC (it honors our codec_caps).  Should an Opus
      // packet still slip through (e.g. an old server), never spin up the
      // disabled Opus decoder — treat it as FLAC so we fail safe, not silent.
      if (!OPUS_ENABLED && wantCodec === 'opus') {
        console.warn('[Audio] Opus disabled locally but server sent opus; forcing flac');
        wantCodec = 'flac';
      }
      if (wantCodec && this.settings && wantCodec !== this.settings.audio_compression) {
        this.switchCodec(wantCodec);
      }

      if (this.decoder && this.decoder.setChannels) {
        this.decoder.setChannels(this.channels);
      }
      
      // Exponential smoothing of the reported power. The guard belongs on the
      // INPUT, not on the result. This used to read
      //     this.power = 0.5 * this.power + 0.5 * receivedPower || 1
      // and || binds looser than +, so the whole smoothed value — not the
      // missing term — fell back to 1 whenever it reached zero or went NaN on
      // a packet carrying no pwr field. 1 is -6.02 dB, not silence, and it
      // feeds the squelch comparison below: a zero-power packet OPENED the
      // squelch instead of closing it.
      const receivedPower = Number.isFinite(packet.pwr) ? packet.pwr : 0;
      // The floor keeps the dB conversion finite. log10(0) is -Infinity, which
      // would propagate into the S-meter and into that same squelch test;
      // 1e-15 lands near -156 dB, below anything a real signal reaches.
      this.power = Math.max(1e-15, 0.5 * this.power + 0.5 * receivedPower);
      const dBpower = 20 * Math.log10(Math.sqrt(this.power) / 2);
      if (this.squelch && dBpower < this.squelchThreshold) {
        this.squelchMute = true;
      } else {
        this.squelchMute = false;
      }

      // Capture scheduled play time BEFORE decode() advances this.playTime.
      // getPowerDb() will only release this value once audioCtx.currentTime
      // reaches it, so the S-meter tracks the audio instead of leading it.
      if (this.audioCtx && this.audioCtx.state === 'running' && this.playTime) {
        this._dBQueue.push({ playAt: this.playTime, value: dBpower });
        // Cap queue: when AudioContext is suspended (background tab, autoplay policy)
        // currentTime freezes so nothing drains, causing unbounded GC pressure that
        // eventually stalls the event loop and backs up the server's send path.
        if (this._dBQueue.length > 300) this._dBQueue.splice(0, this._dBQueue.length - 300);
      } else {
        this.dBPower = dBpower;
      }

      this.decode(packet.data);
    }
  }

  decode(encoded) {
    // Audio not available
    if (!this.audioCtx) {
      return
    }
    let pcmArray = this.decoder.decode(encoded)
    // More samples needed
    if (pcmArray.length === 0) {
      return
    }

    // ✅ FIX: WASM FLAC decoder may return object with channelData for stereo
    // Handle both formats: object (stereo) or flat array (mono or already interleaved)
    if (pcmArray.channelData && this.channels === 2) {
      // FLAC stereo: decoder returns {channelData: [L_array, R_array]}
      // Interleave manually
      const L = pcmArray.channelData[0] || new Float32Array(0)
      const R = pcmArray.channelData[1] || new Float32Array(0)
      const len = Math.min(L.length, R.length)
      const interleaved = new Float32Array(len * 2)
      for (let i = 0; i < len; i++) {
        interleaved[i * 2] = L[i]
        interleaved[i * 2 + 1] = R[i]
      }
      pcmArray = interleaved
      if (!this._flacStereoLogged) { console.log('[FLAC Stereo] Interleaved channelData:', len, 'frames'); this._flacStereoLogged = true; }
    }

    // Packet geometry, for the ?diag=1 line. On the fallback path every packet
    // becomes its own scheduled AudioBufferSourceNode, so the rate here is the
    // number of separate nodes per second the browser has to join seamlessly —
    // the one number that says how hard that path is being asked to work.
    this._pktFrames = (this.channels === 2) ? Math.floor(pcmArray.length / 2) : pcmArray.length;
    this._pktCount = (this._pktCount || 0) + 1;
    {
      const nowMs = performance.now();
      if (!this._pktWindowStart) this._pktWindowStart = nowMs;
      const span = nowMs - this._pktWindowStart;
      if (span >= 1000) {
        this._pktRate = Math.round((this._pktCount * 1000) / span);
        this._pktCount = 0;
        this._pktWindowStart = nowMs;
      }
    }

    // An RFC 3550-style inter-arrival jitter estimator used to run here, over
    // two 10000-sample sliding windows of packet intervals and lengths. Every
    // value it produced (d, v, var, mode, n1, n2, intervals, lens) was written
    // per packet and read nowhere in the codebase — arithmetic and 20000
    // retained numbers per session, on a phone CPU, for a figure nobody
    // consumed. Removed rather than wired up: the playback scheduler measures
    // what it needs directly, and the ?diag=1 counters report the result.

    this.pcmArray = pcmArray

    // C-QUAM 25 Hz stereo-pilot detection.  Only meaningful in stereo (QUAM):
    // pcmArray is interleaved [L0,R0,L1,R1,...] here.  A genuine C-QUAM
    // transmission carries a 25 Hz pilot in the L−R difference channel; mono AM
    // does not.  Drives the QUAM button's green indicator in the UI.
    if (this.channels === 2) {
      this._updateCquamPilot(pcmArray, this.audioOutputSps || 12000)
    } else if (this.cquamPilotDetected || this._pilot) {
      this.cquamPilotDetected = false
      this._pilot = null   // reset detector state so it re-locks next time
    }

    // Save original (pre-boost) PCM specifically for RADE.
    // The 300x FLAC gain boost is needed by the speaker pipeline and by
    // all other decoders (which are calibrated to ~256 amplitude).
    // RADE must receive the original unmodified amplitude — the boost would
    // saturate radae_rxe.py and destroy sync acquisition.
    const pcmArrayPreBoost = pcmArray;

    // ✅ FLAC 16-bit gain boost: pipeline is calibrated for 8-bit amplitude (~256).
    // 16-bit FLAC decoder outputs amplitude ~1.0 → 256× too quiet → silence.
    if (this.settings && this.settings.audio_compression === 'flac') {
      const flacGain = 175.0
      const boosted = new Float32Array(pcmArray.length)
      for (let i = 0; i < pcmArray.length; i++) boosted[i] = pcmArray[i] * flacGain
      pcmArray = boosted
    }

    if (this.signalDecoder) {
      this.signalDecoder.decode(pcmArray)
    }

    // FAX always uses rawPcm (the shared, properly band-limited 12 kHz stream)
    // regardless of codec.  The old Opus native-PCM override (48 kHz without
    // anti-aliasing) corrupted the FM phase discriminator and prevented phasing
    // calibration.  FLAC and Opus now follow the identical path here.
    // ── Receive diversity ────────────────────────────────────────────────
    // The combiner returns its own buffer unchanged whenever it cannot
    // help (not locked, remote stalled, stereo), so the inactive and
    // degraded paths are both byte-identical to the single-receiver one.
    //
    // The LOCAL stream is still what reaches the decoders: FT8, JS8, WSPR
    // and RADE integrate coherently across a whole slot, and a site switch
    // mid-slot is a phase discontinuity that can cost the very decode
    // diversity was meant to save.  Diversity serves the speaker; the
    // decoders keep the continuous local stream.
    let speakerPcm = pcmArray
    if (this.diversity && this.diversity.active) {
      try {
        speakerPcm = this.diversity.pushLocal(pcmArray, this.channels)
      } catch (e) {
        console.error('[Diversity] combiner threw, falling back to local:', e)
        speakerPcm = pcmArray
      }
    }
    this.playAudio(speakerPcm, pcmArrayPreBoost, pcmArray)
  }

  // True while a C-QUAM 25 Hz stereo pilot is being detected on the current
  // (stereo) audio.  Read by the UI to light the QUAM button green.
  getCquamPilotDetected() {
    return !!this.cquamPilotDetected
  }

  // True while mono SAM (AM) has PLL lock.  Read by the UI to show "SAM" in red
  // on the AM button.
  getSamLocked() {
    return !!this.samLocked
  }

  // Detect the 25 Hz C-QUAM stereo pilot in the L−R difference of an interleaved
  // stereo block, using block Goertzels.  The pilot bin (25 Hz) is compared to
  // two off-pilot reference bins (45 & 70 Hz); a real pilot stands well above
  // them, whereas mono/noise leaves all bins comparable.  A smoothed ratio with
  // hysteresis drives this.cquamPilotDetected.  Thresholds are conservative and
  // may want field tuning on weak HF signals (see ON/OFF below).
  _updateCquamPilot(interleaved, fs) {
    if (!interleaved || interleaved.length < 4 || !fs) return

    let p = this._pilot
    if (!p || p.fs !== fs) {
      const w = (f) => 2 * Math.cos((2 * Math.PI * f) / fs)
      p = this._pilot = {
        fs,
        N: Math.max(1024, Math.round(fs * 0.5)), // ~0.5 s integration window
        n: 0,
        coeffP: w(25), coeffA: w(45), coeffB: w(70),
        sP1: 0, sP2: 0, sA1: 0, sA2: 0, sB1: 0, sB2: 0,
        ratioEMA: 0,
      }
    }

    for (let i = 0; i + 1 < interleaved.length; i += 2) {
      const d = interleaved[i] - interleaved[i + 1] // L − R
      let s = d + p.coeffP * p.sP1 - p.sP2; p.sP2 = p.sP1; p.sP1 = s
      s = d + p.coeffA * p.sA1 - p.sA2; p.sA2 = p.sA1; p.sA1 = s
      s = d + p.coeffB * p.sB1 - p.sB2; p.sB2 = p.sB1; p.sB1 = s

      if (++p.n >= p.N) {
        const powP = p.sP1 * p.sP1 + p.sP2 * p.sP2 - p.coeffP * p.sP1 * p.sP2
        const powA = p.sA1 * p.sA1 + p.sA2 * p.sA2 - p.coeffA * p.sA1 * p.sA2
        const powB = p.sB1 * p.sB1 + p.sB2 * p.sB2 - p.coeffB * p.sB1 * p.sB2
        const ref = 0.5 * (powA + powB) + 1e-12
        const ratio = powP / ref

        // Smooth to reject momentary spikes, then apply hysteresis.
        p.ratioEMA = 0.6 * p.ratioEMA + 0.4 * ratio
        const ON = 6.0, OFF = 3.0 // pilot must be ~6× the neighbour bins to lock
        if (p.ratioEMA >= ON) this.cquamPilotDetected = true
        else if (p.ratioEMA <= OFF) this.cquamPilotDetected = false
        this.cquamPilotRatio = p.ratioEMA // exposed for debugging/tuning

        // Reset accumulators for the next block.
        p.n = 0
        p.sP1 = p.sP2 = p.sA1 = p.sA2 = p.sB1 = p.sB2 = 0
      }
    }
  }

  updateAudioParams() {
    // Built once and kept: storing the command rather than re-deriving it is
    // what keeps the CW offset window from being sent as the plain one.
    this._lastWindowCmd = (this.demodulation == "CW")
      ? { cmd: 'window', l: this.audioLOffset, m: this.audioMOffset, r: this.audioROffset }
      : { cmd: 'window', l: this.audioL, m: this.audioM, r: this.audioR }
    this._safeSend(this._lastWindowCmd)

    this._diversityRetune()
  }

  setAudioDemodulation(demodulation) {

    // ✅ ADDED: Normalize AM stereo labels to "AM-S" for C-QUAM
    const d0 = String(demodulation || '').trim();
    const dUpper = d0.toUpperCase();
    let backendDemod = null; // overrides the wire value without changing this.demodulation

    if (
      dUpper === 'CQUAM' ||
      dUpper === 'AM-S' ||
      dUpper === 'AM S' ||
      dUpper === 'AMST' ||
      dUpper === 'AM ST' ||
      dUpper === 'AM STEREO' ||
      dUpper === 'AM-STEREO' ||
      dUpper === 'AM_STEREO' ||
      dUpper === 'QUAM'
    ) {
      demodulation = 'AM-S';
      console.log('[C-QUAM] Stereo mode activated:', d0, '→ AM-S');
    } else if (dUpper === 'AM-ENV' || dUpper === 'AMENV' || dUpper === 'AM ENV') {
      // Envelope (non-synchronous) AM. Internally it stays plain 'AM' so all
      // filter/UI logic is unchanged; only the backend is told 'AM-ENV'.
      demodulation = 'AM';
      backendDemod = 'AM-ENV';
    } else {
      demodulation = d0;
    }

    this.demodulation = demodulation
    this._resetCTCSSState(this._ctcssEnabled && this.demodulation === 'FM');
    // ANF weights trained for one mode can corrupt another — reset on mode switch
    if (this.anfEnabled) this._anfApplyModeDefaults();
    if (this.bnEnabled) this.resetBackgroundNoise();
    if (this.nrEnabled || this.nb) this.resetNoiseReduction();
    // Flush, so returning to a voice mode doesn't replay 20 ms of the old one
    if (this.aiNrEnabled) this.resetAiNoiseReduction();
    if (demodulation == "CW") {
      demodulation = "USB"
    }
    this.updateFilters()
    // The wire value, so AM-ENV goes out as AM-ENV rather than as the plain AM
    // it is normalised to internally.
    this._lastDemodCmd = backendDemod || demodulation
    this._safeSend({
      cmd: 'demodulation',
      demodulation: this._lastDemodCmd
    })
    this._diversityRetune()
  }

  setAudioRange(audioL, audioM, audioR, audioLOffset, audioMOffset, audioROffset) {
    // Retuning means the old floor measurement describes noise at a
    // different frequency — same reasoning as the ANF reset on mode switch
    // above, just triggered by frequency instead of demodulation. NR's floor
    // is just as frequency-specific, so it goes with it.
    if (this.bnEnabled) this.resetBackgroundNoise();
    if (this.nrEnabled || this.nb) this.resetNoiseReduction();
    this.audioL = Math.floor(audioL);
    this.audioM = audioM;
    this.audioR = Math.ceil(audioR);
    this.actualL = audioL;
    this.actualR = audioR;

    this.audioLOffset = Math.floor(audioLOffset);
    this.audioMOffset = audioMOffset;
    this.audioROffset = Math.ceil(audioROffset);
    this.actualLOffset = audioLOffset;
    this.actualROffset = audioROffset;


    this.updateAudioParams();
  }

  getAudioRange() {
    return [this.actualL, this.audioM, this.actualR]
  }

  // ── Receive diversity control ───────────────────────────────────────────
  // See diversity.js for what the combiner does and why it switches rather
  // than sums.  Everything here is inert until startDiversity() is called.

  /**
   * Bring up a second receiver and start combining.
   * @param {string} endpoint   ws://host:port/audio of the remote instance
   * @param {number} remoteCalibDb  offset applied to the remote's SNR before
   *   comparison — needed when the remote's codec floors its noise (a classic
   *   WebSDR sends 8-bit aLaw); 0 for another PhantomSDR-Plus.
   * @param {string} type  'phantom' (default), 'kiwi', 'uber' or 'websdr'.
   *   Each speaks a completely different protocol; all four implement the
   *   same source contract, so nothing below this line changes.  'websdr'
   *   additionally needs websdr_relay.py running on this server — WebSDR
   *   rejects a browser's Origin and no script can change that header.
   */
  startDiversity(endpoint, { remoteCalibDb = 0, type = 'phantom' } = {}) {
    if (!this.audioOutputSps) {
      console.warn('[Diversity] not connected yet — no sample rate to combine at')
      return false
    }
    this.stopDiversity()

    this.diversity = new DiversityCombiner({
      sampleRate: this.audioOutputSps,
      remoteCalibDb
    })
    this.diversityEndpoint = endpoint
    this.diversityType = type
    const Source = type === 'kiwi' ? KiwiSource
                 : type === 'uber' ? UberSource
                 : type === 'websdr' ? WebSdrSource
                 : RemoteSource
    this.diversityRemote = new Source(endpoint, {
      onPcm: (pcm, sr) => {
        if (this.diversity) this.diversity.pushRemote(pcm, sr)
      },
      onState: (state, detail) => {
        this.diversityState = state
        // A WebSocket close carries a code and reason that say a great deal
        // about WHY a remote refused us — 1006 (abnormal) for a handshake
        // the server dropped, 1002/1008 for a policy rejection such as an
        // Origin check. Without surfacing it, every failure looks alike.
        if (detail && typeof detail.code === 'number') {
          this.diversityCloseCode = detail.code
          this.diversityCloseReason = detail.reason || ''
        }
        // Sources report a refusal as text the server actually sent — the
        // JSON {"error":...} of a rejected session, or the reason field of a
        // failed admission check. Showing "error" alone told nobody anything.
        if (state === 'error' && detail) {
          // A source may report its reason as a plain string rather than as
          // an object — WebSDR's does, since most of its failures are our
          // own message ("the relay is not running") and not a server's.
          // Missing this case showed a bare "error" and lost the one line
          // that said what to fix.
          this.diversityErrorText = typeof detail === 'string'
            ? detail
            : String(detail.error || detail.reason || detail.message || '') || ''
        } else if (state === 'ready') {
          // A close code from a previous attempt is not news once the link
          // is up again; leaving it on screen read as "ready (1006)".
          this.diversityErrorText = ''
          this.diversityCloseCode = null
          this.diversityCloseReason = ''
        }
        // The remote comes up untuned; point it at whatever we are on now.
        if (state === 'ready') this._diversityRetune()
        // A dropped remote invalidates the alignment — the reconnected
        // stream starts at a different point in the content.
        if ((state === 'closed' || state === 'error') && this.diversity) {
          this.diversity.reset()
        }
        if (typeof this.onDiversityState === 'function') {
          try { this.onDiversityState(state, detail) } catch (_) {}
        }
      }
    })

    this.diversity.active = true

    // Tune BEFORE connecting.  UberSDR carries the frequency in the connect
    // URL, so a source that has never been tuned has nothing to open; it sat
    // at 'idle' waiting for a retune that only fires on 'ready', which could
    // never arrive.  The other two sources hold an early tune as pending and
    // replay it once their handshake completes, so this is safe for all
    // three — and it also means no source ever starts on the wrong frequency.
    this._diversityRetune()
    this.diversityRemote.connect()
    return true
  }

  stopDiversity() {
    if (this.diversityRemote) {
      this.diversityRemote.close()
      this.diversityRemote = null
    }
    if (this.diversity) {
      this.diversity.active = false
      this.diversity.reset()
      this.diversity = null
    }
    this.diversityState = 'idle'
    this.diversityEndpoint = null
    this.diversityType = null
    this.diversityCloseCode = null
    this.diversityCloseReason = ''
    this.diversityErrorText = ''
  }

  isDiversityActive() {
    return !!(this.diversity && this.diversity.active)
  }

  setDiversityCalib(db) {
    if (this.diversity) this.diversity.remoteCalibDb = Number(db) || 0
  }

  getDiversityStatus() {
    const base = {
      state: this.diversityState || 'idle',
      endpoint: this.diversityEndpoint || null,
      type: this.diversityType || null,
      closeCode: this.diversityCloseCode ?? null,
      closeReason: this.diversityCloseReason || '',
      errorText: this.diversityErrorText || '',
      inRange: null
    }
    if (!this.diversity) return { ...base, active: false, locked: false }
    if (this.diversityRemote && this.audioMaxSize) {
      base.inRange = this.diversityRemote.canReceive(this._binToHz(this.audioM))
    }
    return { ...base, ...this.diversity.getStatus() }
  }

  _binToHz(offset) {
    if (!this.audioMaxSize) return 0
    return offset / this.audioMaxSize * this.totalBandwidth + this.baseFreq
  }

  // Keep the second receiver on the same signal as this one.  Called from
  // updateAudioParams() and setAudioDemodulation(), i.e. from every path
  // that retunes the local receiver, so the UI never has to think about it.
  _diversityRetune() {
    const r = this.diversityRemote
    if (!r || !this.audioMaxSize) return
    // Mirror updateAudioParams()'s choice: CW is tuned by the offset
    // triplet, everything else by the plain one.
    const cw = this.demodulation === 'CW'
    const l = cw ? this.audioLOffset : this.audioL
    const m = cw ? this.audioMOffset : this.audioM
    const rr = cw ? this.audioROffset : this.audioR
    if (l == null || m == null || rr == null) return
    r.tune(this._binToHz(l), this._binToHz(m), this._binToHz(rr), this.demodulation)
  }

  // Our own signal-protocol UUID, sent by the server in the initial settings.
  // Used to identify our own waterfall pill exactly (see updateTick in App).
  getClientId() {
    return this.clientId ?? null
  }

  setAudioOptions(options) {
    this.audioOptions = options
    this._safeSend({
      cmd: 'options',
      options: options
    })
  }


_resetCTCSSState(closeGate = false) {
  this._ctcssDetectFill = 0;
  this._ctcssHpState = 0;
  this._ctcssHpPrevIn = 0;
  this._ctcssLpState = 0;
  this._ctcssLastOpenMs = 0;
  this._ctcssDetectedToneHz = null;
  this._ctcssConsecutive = 0;
  this.ctcssMute = !!closeGate;
}

_normalizeCTCSSSelection(ctcss) {
  if (ctcss === false || ctcss === null || typeof ctcss === 'undefined') {
    return { enabled: false, toneHz: null };
  }
  if (ctcss === true) {
    return { enabled: true, toneHz: null };
  }
  if (typeof ctcss === 'number' && isFinite(ctcss) && ctcss > 0) {
    return { enabled: true, toneHz: ctcss };
  }
  if (typeof ctcss === 'string') {
    const trimmed = ctcss.trim().toLowerCase();
    if (!trimmed || trimmed === 'off' || trimmed === 'false' || trimmed === 'none') {
      return { enabled: false, toneHz: null };
    }
    if (trimmed === 'on' || trimmed === 'true' || trimmed === 'any') {
      return { enabled: true, toneHz: null };
    }
    const parsed = parseFloat(trimmed);
    if (isFinite(parsed) && parsed > 0) {
      return { enabled: true, toneHz: parsed };
    }
  }
  if (typeof ctcss === 'object') {
    const enabled = ctcss.enabled !== false;
    const parsed = parseFloat(ctcss.tone ?? ctcss.toneHz ?? ctcss.frequency ?? ctcss.freq);
    return { enabled, toneHz: (isFinite(parsed) && parsed > 0) ? parsed : null };
  }
  return { enabled: !!ctcss, toneHz: null };
}

_nearestCTCSSTone(targetHz) {
  if (!(targetHz > 0)) return null;
  let best = null;
  let bestErr = Infinity;
  for (const tone of this._ctcssStdTones) {
    const err = Math.abs(tone - targetHz);
    if (err < bestErr) {
      bestErr = err;
      best = tone;
    }
  }
  return best;
}

_goertzelPower(samples, targetHz, sampleRate) {
  const n = samples.length;
  if (!n || !(targetHz > 0) || !(sampleRate > 0)) return 0;
  const omega = (2 * Math.PI * targetHz) / sampleRate;
  const coeff = 2 * Math.cos(omega);
  let s0 = 0, s1 = 0, s2 = 0;
  for (let i = 0; i < n; i++) {
    s0 = samples[i] + coeff * s1 - s2;
    s2 = s1;
    s1 = s0;
  }
  return s1 * s1 + s2 * s2 - coeff * s1 * s2;
}

_analyzeCTCSSWindow(windowSamples, sampleRate) {
  const n = windowSamples.length;
  if (!n || !(sampleRate > 0)) return null;

  const prepared = new Float32Array(n);
  let mean = 0;
  for (let i = 0; i < n; i++) mean += windowSamples[i];
  mean /= n;

  let sumSq = 0;
  for (let i = 0; i < n; i++) {
    const w = 0.54 - 0.46 * Math.cos((2 * Math.PI * i) / (n - 1));
    const v = (windowSamples[i] - mean) * w;
    prepared[i] = v;
    sumSq += v * v;
  }

  const rms = Math.sqrt(sumSq / n);
  if (!(rms > this._ctcssMinRms)) return null;

  const tones = (this.ctcssToneHz && this.ctcssToneHz > 0)
    ? [this._nearestCTCSSTone(this.ctcssToneHz)].filter(Boolean)
    : this._ctcssStdTones;

  let bestTone = null;
  let bestPower = 0;
  let secondPower = 0;

  for (const tone of tones) {
    const power = this._goertzelPower(prepared, tone, sampleRate);
    if (power > bestPower) {
      secondPower = bestPower;
      bestPower = power;
      bestTone = tone;
    } else if (power > secondPower) {
      secondPower = power;
    }
  }

  if (!bestTone || !(bestPower > 0)) return null;

  // Separation: compare best CTCSS tone against the second-best standard tone.
  // ±Hz Goertzel neighbor checks are intentionally omitted: at any realistic
  // window length they fall inside the Hamming mainlobe (half-width ≈ 2 bins)
  // and produce near-peak power, making the ratio meaningless and suppressing
  // every valid detection. secondPower is the correct discriminator — it
  // measures whether a single tone dominates over all other CTCSS candidates.
  // Requires _ctcssDetectBuffer ≥ 4096 samples so the 2.93 Hz/bin resolution
  // can actually distinguish adjacent CTCSS pairs (closest gap: 2.4 Hz).
  const neighborPower = secondPower;

  const confidence = bestPower / Math.max(sumSq, 1e-12);
  const separation  = bestPower / Math.max(neighborPower, 1e-12);
  const toneErr = this.ctcssToneHz ? Math.abs(bestTone - this.ctcssToneHz) : 0;
  const toneTol = this.ctcssToneHz ? Math.max(1.5, this.ctcssToneHz * 0.015) : Infinity;

  if (confidence < this._ctcssDetectThreshold) return null;
  if (separation < this._ctcssNeighborReject) return null;
  if (toneErr > toneTol) return null;

  return { toneHz: bestTone, confidence, separation, rms };
}

_updateCTCSSGate(rawPcm) {
  if (!this._ctcssEnabled || this.demodulation !== 'FM' || this.channels !== 1) {
    this.ctcssMute = false;
    return;
  }

  if (!(rawPcm && rawPcm.length)) {
    const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    this.ctcssMute = (now - this._ctcssLastOpenMs) > this._ctcssHoldMs;
    return;
  }

  const sampleRate = this.audioOutputSps || this.trueAudioSps || this.audioMaxSps || 12000;
  const hpCut = 55;
  const lpCut = 300;
  const hpAlpha = sampleRate > 0 ? Math.exp(-2 * Math.PI * hpCut / sampleRate) : 0.97;
  const lpAlpha = sampleRate > 0 ? Math.exp(-2 * Math.PI * lpCut / sampleRate) : 0.85;
  const detectBuf = this._ctcssDetectBuffer;
  let fill = this._ctcssDetectFill;
  let hpState = this._ctcssHpState;
  let hpPrevIn = this._ctcssHpPrevIn;
  let lpState = this._ctcssLpState;

  for (let i = 0; i < rawPcm.length; i++) {
    const x = rawPcm[i];
    hpState = hpAlpha * (hpState + x - hpPrevIn);
    hpPrevIn = x;
    lpState = lpState + (1 - lpAlpha) * (hpState - lpState);
    detectBuf[fill++] = lpState;

    if (fill >= detectBuf.length) {
      const result = this._analyzeCTCSSWindow(detectBuf, sampleRate);
      if (result) {
        // Require _ctcssOpenCount consecutive detections before opening the gate.
        // Prevents a single noise window from briefly unmuting the speaker.
        this._ctcssConsecutive = (this._ctcssConsecutive || 0) + 1;
        if (this._ctcssConsecutive >= this._ctcssOpenCount) {
          const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
          this._ctcssLastOpenMs = now;
          this._ctcssDetectedToneHz = result.toneHz;
        }
      } else {
        // Miss: reset streak. One failed window re-arms the false-positive guard.
        this._ctcssConsecutive = 0;
      }
      fill = 0;
    }
  }

  this._ctcssDetectFill = fill;
  this._ctcssHpState = hpState;
  this._ctcssHpPrevIn = hpPrevIn;
  this._ctcssLpState = lpState;

  const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  this.ctcssMute = (now - this._ctcssLastOpenMs) > this._ctcssHoldMs;
}

  setGain(gain) {
    gain /= 30;
    this.userGain = gain;
    this._applyOutputGain();
  }

  // True when any digital decoder is active — compressor and EQ must never
  // colour the audio for digital modes.
  _isDigitalActive() {
    return !!(this.decodeFT4 || this.decodeCW || this.decodeSSTV || this.decodeRADE);
  }

  // (Re)build the output chain from humNotch60 -> gainNode, inserting the EQ
  // and/or compressor only when they are enabled AND no digital mode is active.
  //
  // Re-wiring a LIVE graph is audible: every disconnect()/connect() pair is a
  // waveform discontinuity (a click), and the callers below fire in bursts —
  // activating SSTV alone used to run this four times inside 60 ms.  Two guards:
  //
  //   1. Topology memo.  Only the (useEq, useComp) pair changes what gets wired,
  //      so a call that produces the same pair is a no-op.  This is what removes
  //      the burst: enabling a digital decoder while EQ/compressor are already
  //      bypassed changes nothing and must not touch the graph.
  //   2. Gain dip.  When the topology really does change, mute the output over
  //      ~6 ms, re-wire in a timeout, then ramp back — so the unavoidable
  //      discontinuity happens while the chain is silent.  The topology is
  //      recomputed inside the timeout, so overlapping calls coalesce onto the
  //      latest requested state instead of fighting each other.
  _rebuildOutputChain() {
    if (!this.humNotch60 || !this.gainNode) return;

    const digital = this._isDigitalActive();
    const useEq   = this.eqEnabled && !digital;
    const useComp = this.compressorEnabled && !digital;
    const sig     = `${useEq ? 1 : 0}${useComp ? 1 : 0}`;

    // First build: wire synchronously, no dip (nothing is playing yet).
    if (this._outputChainSig === undefined) {
      this._wireOutputChain(useEq, useComp);
      this._outputChainSig = sig;
      return;
    }

    if (sig === this._outputChainSig) return;   // topology unchanged — leave the graph alone
    this._outputChainSig = sig;

    if (this._chainDipTimer) return;            // a dip is already pending; it will pick up the new state

    const ctx = this.audioCtx;
    if (!ctx) { this._wireOutputChain(useEq, useComp); return; }

    this._chainDipActive = true;
    try {
      const now = ctx.currentTime;
      this.gainNode.gain.cancelScheduledValues(now);
      this.gainNode.gain.setTargetAtTime(0.0, now, 0.002);
    } catch (_) {
      try { this.gainNode.gain.value = 0.0; } catch (__) {}
    }

    this._chainDipTimer = setTimeout(() => {
      this._chainDipTimer = null;
      // Recompute: several toggles may have landed while the dip was running.
      const dig = this._isDigitalActive();
      this._wireOutputChain(this.eqEnabled && !dig, this.compressorEnabled && !dig);
      this._chainDipActive = false;
      this._applyOutputGain();
    }, 8);
  }

  // Raw graph surgery for _rebuildOutputChain — never call directly.
  _wireOutputChain(useEq, useComp) {
    if (!this.humNotch60 || !this.gainNode) return;

    // Tear down every possible link from humNotch60 downstream.
    try { this.humNotch60.disconnect(); } catch (e) {}
    try { this.compressor.disconnect(); } catch (e) {}
    try { this.compressorMakeup.disconnect(); } catch (e) {}
    if (this.eqBands) {
      for (const b of this.eqBands) { try { b.disconnect(); } catch (e) {} }
    }

    let cursor = this.humNotch60;
    if (useEq && this.eqBands) {
      for (const b of this.eqBands) { cursor.connect(b); cursor = b; }
    }
    if (useComp) {
      cursor.connect(this.compressor);
      this.compressor.connect(this.compressorMakeup);
      cursor = this.compressorMakeup;
    }
    cursor.connect(this.gainNode);
  }

  // Toggle the SSB dynamic compressor in/out of the audio chain.
  setCompressor(enabled) {
    this.compressorEnabled = !!enabled;
    this._rebuildOutputChain();
  }

  // ── Compressor parameter regulators (used by the Compressor popup) ──
  // Auto-makeup gain, spanning _makeupMin.._makeupMax. Each knob maps to a
  // 0..1 factor; the three factors are averaged and mapped onto the makeup
  // range, so all knobs at their "loud" ends → _makeupMax, all at their "quiet"
  // ends → _makeupMin. The 0-factor anchors are set at the Reset/startup
  // defaults so that operating point evaluates to exactly _makeupMin (0.3);
  // the user's quiet endpoints (threshold -60, knee 0, ratio 20:1) sit past the
  // anchors and clamp to 0.3, and the loud endpoints reach _makeupMax (1.5).
  _computeAutoMakeup() {
    if (!this.compressor) return this._makeupMin;
    // Fractional position of v between anchors v0 (→0) and v1 (→1), clamped.
    const norm = (v, v0, v1) =>
      v1 === v0 ? 0 : Math.max(0, Math.min(1, (v - v0) / (v1 - v0)));
    const fThr   = norm(this.compressor.threshold.value, -24,  0);  // ≤-24 dB→0, 0 dB→1
    const fKnee  = norm(this.compressor.knee.value,       10, 40);  //  ≤10→0, 40→1
    const fRatio = norm(this.compressor.ratio.value,        4,  1);  //  ≥4:1→0, 1:1→1
    const f = (fThr + fKnee + fRatio) / 3;
    return this._makeupMin + f * (this._makeupMax - this._makeupMin);
  }
  // When auto-makeup is on, recompute and apply the makeup gain. Returns the
  // effective linear makeup gain so the UI can reflect it.
  _applyAutoMakeup() {
    if (!this.compressorMakeup) return null;
    if (!this.autoMakeup) return this.compressorMakeup.gain.value;
    const g = this._computeAutoMakeup();
    this.compressorMakeup.gain.value = g;
    return g;
  }
  // threshold: dB (-100..0) — level above which compression starts
  setCompressorThreshold(db) {
    if (!this.compressor) return;
    this.compressor.threshold.value = Math.max(-100, Math.min(0, Number(db) || 0));
    this._applyAutoMakeup();
  }
  // knee: dB (0..40) — how gradual the onset of compression is
  setCompressorKnee(db) {
    if (!this.compressor) return;
    this.compressor.knee.value = Math.max(0, Math.min(40, Number(db) || 0));
    this._applyAutoMakeup();
  }
  // ratio: :1 (1..20) — amount of gain reduction above threshold
  setCompressorRatio(ratio) {
    if (!this.compressor) return;
    this.compressor.ratio.value = Math.max(1, Math.min(20, Number(ratio) || 1));
    this._applyAutoMakeup();
  }
  // attack: seconds (0..1) — how fast it clamps down on peaks
  setCompressorAttack(sec) {
    if (!this.compressor) return;
    this.compressor.attack.value = Math.max(0, Math.min(1, Number(sec) || 0));
  }
  // release: seconds (0..1) — how fast it lets go after peaks
  setCompressorRelease(sec) {
    if (!this.compressor) return;
    this.compressor.release.value = Math.max(0, Math.min(1, Number(sec) || 0));
  }
  // makeup: linear gain (0..4) — output level after compression.
  // Manually setting makeup turns auto-makeup OFF (it becomes the live value).
  setCompressorMakeup(gain) {
    if (!this.compressorMakeup) return;
    this.autoMakeup = false;
    this.compressorMakeup.gain.value = Math.max(0, Math.min(4, Number(gain) || 0));
  }
  // Toggle auto-makeup. When enabled, makeup is recomputed from threshold &
  // ratio; returns the effective makeup gain so the UI can display it.
  setCompressorAutoMakeup(enabled) {
    this.autoMakeup = !!enabled;
    return this._applyAutoMakeup();
  }

  // Return current compressor settings so the UI can initialise its controls.
  getCompressorSettings() {
    return {
      enabled:   !!this.compressorEnabled,
      threshold: this.compressor ? this.compressor.threshold.value : -24,
      knee:      this.compressor ? this.compressor.knee.value : 6,
      ratio:     this.compressor ? this.compressor.ratio.value : 4,
      attack:    this.compressor ? this.compressor.attack.value : 0.003,
      release:   this.compressor ? this.compressor.release.value : 0.25,
      makeup:    this.compressorMakeup ? this.compressorMakeup.gain.value : 0.3,
      autoMakeup: !!this.autoMakeup,
    };
  }

  // Enable/disable the 5-band equalizer.
  setEqualizer(enabled) {
    this.eqEnabled = !!enabled;
    this._rebuildOutputChain();
  }

  // Set a single EQ band gain in dB. index 0..4, gainDb typically -12..+12.
  setEqBand(index, gainDb) {
    if (!this.eqBands || index < 0 || index >= this.eqBands.length) return;
    const g = Math.max(-24, Math.min(24, Number(gainDb) || 0));
    this.eqBands[index].gain.value = g;
  }

  // Set all EQ band gains at once from an array of dB values.
  setEqGains(gains) {
    if (!Array.isArray(gains) || !this.eqBands) return;
    for (let i = 0; i < this.eqBands.length && i < gains.length; i++) {
      this.setEqBand(i, gains[i]);
    }
  }

  setMute(mute) {
    if (mute === this.mute) {
      return
    }
    this.mute = mute
    this._safeSend({
      cmd: 'mute',
      mute: mute
    })
  }

  setCTCSSFilter(ctcss) {
    const normalized = this._normalizeCTCSSSelection(ctcss);
    this.ctcss = normalized.enabled;
    this._ctcssEnabled = normalized.enabled;
    this.ctcssToneHz = normalized.toneHz;
    this._resetCTCSSState(normalized.enabled && this.demodulation === 'FM');
    this.updateFilters();
  }

  setSquelch(squelch) {
    this.squelch = squelch
  }

  setSquelchThreshold(squelchThreshold) {
    this.squelchThreshold = squelchThreshold
  }

  // Enable or disable the mains-hum notch filters.
  // freq: 50 | 60 | 'both'
  // enabled: true | false
  // Example: audio.setHumNotch(50, true)   // EU/Asia sysops
  //          audio.setHumNotch(60, true)   // Americas sysops
  //          audio.setHumNotch('both', true)
  setHumNotch(freq, enabled) {
    // Toggle between 'notch' (active) and 'allpass' (transparent bypass).
    if (freq === 50 || freq === 'both') {
      this.humNotch50Enabled = !!enabled;
      if (this.humNotch50) this.humNotch50.type = enabled ? 'notch' : 'allpass';
      console.log('[HumNotch] 50 Hz notch: ' + (enabled ? 'ON' : 'OFF'));
    }
    if (freq === 60 || freq === 'both') {
      this.humNotch60Enabled = !!enabled;
      if (this.humNotch60) this.humNotch60.type = enabled ? 'notch' : 'allpass';
      console.log('[HumNotch] 60 Hz notch: ' + (enabled ? 'ON' : 'OFF'));
    }

    // The highpass filter sits before the notches in the graph. In USB/LSB mode
    // it is set to 60 Hz, which pre-attenuates 50 Hz hum by ~5 dB before the
    // notch even sees it — making the 50 Hz notch largely ineffective.
    // When any notch is active, pull the highpass down to 35 Hz so both 50 Hz
    // and 60 Hz hum pass through with negligible pre-attenuation (<1 dB) and
    // the notch can do its full 30+ dB of rejection. Restore normal cutoff when
    // both notches are off.
    if (this.highPass) {
      const eitherActive = this.humNotch50Enabled || this.humNotch60Enabled;
      if (eitherActive) {
        this.highPass.frequency.value = 35;
        console.log('[HumNotch] Highpass lowered to 35 Hz to allow notch full rejection');
      } else {
        // Restore mode-appropriate cutoff via updateFilters
        this.updateFilters();
        console.log('[HumNotch] Highpass restored to mode default');
      }
    }
  }

  getPowerDb() {
    if (this._dBQueue && this._dBQueue.length && this.audioCtx) {
      const now = this.audioCtx.currentTime;
      let i = 0;
      while (i < this._dBQueue.length && this._dBQueue[i].playAt <= now) {
        this.dBPower = this._dBQueue[i].value;
        i++;
      }
      if (i > 0) {
        this._dBQueue.splice(0, i);
      }
    }
    return this.dBPower;
  }

  setUserID(userID) {
    this._userID = userID
    this._safeSend({
      cmd: 'userid',
      userid: userID
    })
  }

  setSignalDecoder(decoder) {
    this.signalDecoder = decoder
  }

  getSignalDecoder() {
    return this.signalDecoder
  }


  // FT8 Start

  gridSquareToLatLong(gridSquare) {
    const l = gridSquare.toUpperCase();
    let lon = ((l.charCodeAt(0) - 'A'.charCodeAt(0)) * 20) - 180;
    let lat = ((l.charCodeAt(1) - 'A'.charCodeAt(0)) * 10) - 90;

    if (l.length >= 4) {
      lon += ((l.charCodeAt(2) - '0'.charCodeAt(0)) * 2);
      lat += (l.charCodeAt(3) - '0'.charCodeAt(0));
    }

    if (l.length == 6) {
      lon += ((l.charCodeAt(4) - 'A'.charCodeAt(0)) * (5 / 60));
      lat += ((l.charCodeAt(5) - 'A'.charCodeAt(0)) * (2.5 / 60));
      lon += (5 / 120); // center of the square for 6-char grid
      lat += (1.25 / 120); // center of the square for 6-char grid
    } else if (l.length == 4) {
      lon += 1; // center of the square for 4-char grid
      lat += 0.5; // center of the square for 4-char grid
    }

    return [lat, lon];
  }


  initTimer() {
    // ✅ FIXED: Store interval ID for proper cleanup
    if (this.collectionTimer) {
      clearInterval(this.collectionTimer);
    }
    
    // NB: FT8/FT4/FT2 slot boundaries are no longer polled from a timer. They
    // are evaluated on every arriving audio block by _ftxSlotStart(), the way
    // Kiwi's decode_ft8_samples() does it. Browsers coalesce setInterval in
    // background tabs, and a single missed tick used to drop a whole slot.

    // WSPR timer — checks every 500 ms for 2-minute even-UTC-minute slots
    if (this.wsprTimer) clearInterval(this.wsprTimer);
    this.wsprTimer = setInterval(() => {
      this.updateWSPRCollectionStatus();
    }, 500);
  }

  /**
   * One decoded spot, as a row of the FTx grid.
   *
   * Column order is fixed by `.ftx-grid` in the App style blocks and must stay
   * in step with the header row there:
   *
   *     Mode | dB | Hz | DT | Message | Locator | Distance
   *
   * dB and Hz both come from the decoder. The frequency in particular used to
   * be read from an uninitialised field, so it is newly meaningful.
   */
  _ftxRenderSpot(mode, message, baseLocation) {
    const row = document.createElement('div');
    row.classList.add('glass-message', 'ftx-grid', 'p-2', 'rounded-lg', 'text-sm');

    const cell = (classes, text) => {
      const d = document.createElement('div');
      if (classes) d.classList.add(...classes);
      if (text !== undefined) d.textContent = text;
      row.appendChild(d);
      return d;
    };

    cell(['text-green-400', 'font-bold', 'text-xs'], mode);
    cell(['ftx-num', 'text-cyan-300', 'text-xs'],
         Number.isFinite(message.snr)
           ? `${message.snr > 0 ? '+' : ''}${message.snr.toFixed(0)}` : '');
    cell(['ftx-num', 'text-cyan-300', 'text-xs'],
         Number.isFinite(message.freq) ? message.freq.toFixed(0) : '');
    // DT relative to the ideal, so a well-synced client reads ~0.0 here
    // regardless of protocol — the same convention WSJT-X uses.
    const dtRel = Number.isFinite(message.dt)
      ? message.dt - this._ftxDtTarget(mode) : NaN;
    cell(['ftx-num', 'text-xs', Math.abs(dtRel) > 0.5 ? 'text-orange-400' : 'text-gray-400'],
         Number.isFinite(dtRel) ? `${dtRel > 0 ? '+' : ''}${dtRel.toFixed(1)}` : '');
    cell(['ftx-msg'], message.text);

    const locCell  = cell(['text-xs']);
    const distCell = cell(['ftx-num', 'text-xs']);

    // Locator and distance stay empty for messages that carry no grid square
    // (signal reports, RRR/RR73/73, bare CQ) — those are still listed.
    const locators = this.extractGridLocators(message.text);
    if (locators.length > 0) {
      locators.forEach((locator, i) => {
        const link = document.createElement('a');
        link.href = `https://www.levinecentral.com/ham/grid_square.php?&Grid=${locator}&Zoom=13&sm=y`;
        link.classList.add('text-yellow-300', 'hover:underline');
        link.textContent = locator;
        link.target = '_blank';
        if (i > 0) locCell.appendChild(document.createTextNode(', '));
        locCell.appendChild(link);
      });

      const target = this.gridSquareToLatLong(locators[0]);
      const distance = this.calculateDistance(
        baseLocation[0], baseLocation[1], target[0], target[1]);
      distCell.textContent = `${distance.toFixed(0)} km`;

      if (distance > this.farthestDistance) {
        this.farthestDistance = distance;
        const el = document.getElementById('farthest-distance');
        if (el) el.textContent = `Farthest Distance: ${this.farthestDistance.toFixed(2)} km`;
      }
    }

    return row;
  }

  /** Append one slot's spots and keep the list scrolled to the newest. */
  _ftxRenderSpots(mode, decodedMessages) {
    // Calibrate FIRST, and on every slot: an empty slot is exactly the signal
    // the bootstrap sweep counts, so it must not be lost to the render bail-out
    // below.
    this._ftxAutoCalibrate(mode, decodedMessages || []);

    const list = document.getElementById('ft8MessagesList');
    if (!list || !decodedMessages || decodedMessages.length === 0) return;

    const baseLocation = this.gridSquareToLatLong(this.grid_locator);
    for (const message of decodedMessages) {
      list.appendChild(this._ftxRenderSpot(mode, message, baseLocation));
    }
    setTimeout(() => { list.scrollTop = list.scrollHeight; }, 500);

    // Marks let the Hz column be read straight off the spectrum.
    this._ftxSpec.marks = decodedMessages
      .filter(m => Number.isFinite(m.freq))
      .map(m => ({ hz: m.freq, snr: m.snr, text: m.text }));
    this._ftxSpec.seq++;
  }

  // For FT8
  extractGridLocators(message) {
    // Regular expression for matching grid locators
    const regex = /[A-R]{2}[0-9]{2}([A-X]{2})?/gi;

    // Find matches in the provided message
    const matches = message.match(regex);

    // Ensure unique matches, as the same locator might appear more than once
    const uniqueLocators = matches ? Array.from(new Set(matches)) : [];

    return uniqueLocators;
  }

  calculateDistance(lat1, lon1, lat2, lon2) {
    function toRad(x) {
      return x * Math.PI / 180;
    }

    var R = 6371; // km
    var dLat = toRad(lat2 - lat1);
    var dLon = toRad(lon2 - lon1);
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    var d = R * c;
    return d;
  }

  // ── Kiwi-style FTx slot scheduling ──────────────────────────────────────
  //
  // Port of the tsync logic in KiwiSDR's decode_ft8_samples(). Both halves run
  // off arriving audio rather than a timer:
  //
  //   _ftxSlotStart()  — before samples are appended, opens a capture window if
  //                      the clock has reached a slot boundary (+ time shift).
  //   _ftxSlotFinish() — after samples are appended, decodes once a full
  //                      (slot_period - 0.4) s window is in hand.

  /** Position within the current slot, in seconds, honouring the time shift. */
  _ftxSlotPos(slotPeriod, mode) {
    const t = Date.now() / 1000 - (this.ftxShift[mode] ?? 0.8);
    const m = t % slotPeriod;
    return m < 0 ? m + slotPeriod : m;
  }

  /** Number of samples Kiwi captures per slot: (slot_period - 0.4) s. */
  _ftxSlotSamples(slotPeriod) {
    const sps = this.audioOutputSps || 12000;
    return Math.floor((slotPeriod - 0.4) * sps);
  }

  // JS8 slot geometry lives in modules/js8-slots.js so it can be tested
  // directly; see the creep warning there.
  _js8Period() { return js8Period(this.js8Submode); }
  _js8SlotSamples() { return js8CaptureSamples(this.js8Submode, this.audioOutputSps || 12000); }
  _js8Mode() { return `JS8:${this.js8Submode}`; }

  /**
   * Width of the window, at the head of a slot, in which a capture may start.
   *
   * Kiwi uses slot_period/4 because it evaluates this from a comparatively
   * coarse loop and wants to be sure not to miss the boundary. We are called on
   * every audio block (tens of ms), so a much tighter window is both safe and
   * necessary: a capture runs for (slot_period - 0.4) s, so it ends 0.4 s
   * *before* the next boundary. With a quarter-slot window that end still falls
   * inside the acceptance window, so the next capture latches 0.4 s early and
   * every slot creeps earlier until it happens to wrap — minutes of misaligned
   * captures. Keeping the window under 0.4 s makes the end-of-capture position
   * wrap negative, so the next start can only happen at a true boundary.
   */
  _ftxStartWindow(slotPeriod) {
    // Must span at least one audio block or boundaries fall between calls and
    // slots get skipped; must stay under 0.4 s or the creep described above
    // returns. Block size is server-driven (fft_result_size), so track it.
    const sps = this.audioOutputSps || 12000;
    const blockDur = (this._ftxLastBlockLen || 0) / sps;
    return Math.min(slotPeriod / 4, 0.39, Math.max(0.35, blockDur * 1.05));
  }

  _ftxSlotStart(blockLen) {
    if (blockLen) this._ftxLastBlockLen = blockLen;

    if (this.decodeFT8 && !this.isCollecting &&
        this._ftxSlotPos(15.0, 'FT8') <= this._ftxStartWindow(15.0)) {
      this.isCollecting = true;
      this.accumulatorLen = 0;
      this._ftxSpecReset();
    }
    if (this.decodeFT4 && !this.isFT4Collecting &&
        this._ftxSlotPos(7.5, 'FT4') <= this._ftxStartWindow(7.5)) {
      this.isFT4Collecting = true;
      this.ft4AccumulatorLen = 0;
      this._ftxSpecReset();
    }
    if (this.decodeFT2 && !this.isFT2Collecting &&
        this._ftxSlotPos(3.75, 'FT2') <= this._ftxStartWindow(3.75)) {
      this.isFT2Collecting = true;
      this.ft2AccumulatorLen = 0;
      this._ftxSpecReset();
    }
    if (this.decodeJS8 && !this.isJS8Collecting) {
      const sps = this.audioOutputSps || 12000;
      const blockDur = (this._ftxLastBlockLen || 0) / sps;
      if (js8SlotPos(Date.now(), this._js8Period(), this.ftxShift[this._js8Mode()] ?? 0.8)
          <= js8StartWindow(this.js8Submode, blockDur)) {
        this.isJS8Collecting = true;
        this.js8AccumulatorLen = 0;
        this._ftxSpecReset();
      }
    }
  }

  _ftxSlotFinish() {
    if (this.isCollecting && this.accumulatorLen >= this._ftxSlotSamples(15.0)) {
      this.stopCollection();
    }
    if (this.isFT4Collecting && this.ft4AccumulatorLen >= this._ftxSlotSamples(7.5)) {
      this.stopFT4Collection();
    }
    if (this.isFT2Collecting && this.ft2AccumulatorLen >= this._ftxSlotSamples(3.75)) {
      this.stopFT2Collection();
    }
    if (this.isJS8Collecting && this.js8AccumulatorLen >= this._js8SlotSamples()) {
      this.stopJS8Collection();
    }
  }

  // ── Mini audio spectrum ─────────────────────────────────────────────────

  /** Allocate one max-hold spectrum accumulator of transform size N. */
  _makeSpec(N) {
    return {
      N,
      re:    new Float64Array(N),
      im:    new Float64Array(N),
      fill:  new Float32Array(N),
      pos:   0,
      max:   new Float32Array((N >> 1) + 1).fill(-140),
      marks: [],   // decoded spots: {hz, snr, text}
      seq:   0,    // bumped on change so the UI can skip redraws
    };
  }

  /** Feed slot audio; runs one FFT per full frame and max-holds the result. */
  _specFeed(st, pcm) {
    const N = st.N;
    let i = 0;
    while (i < pcm.length) {
      const take = Math.min(N - st.pos, pcm.length - i);
      st.fill.set(pcm.subarray(i, i + take), st.pos);
      st.pos += take;
      i += take;
      if (st.pos < N) return;

      // Hann window, so neighbouring strong signals don't smear across the
      // display and hide weak ones.
      const re = st.re, im = st.im;
      for (let k = 0; k < N; k++) {
        const w = 0.5 - 0.5 * Math.cos((2 * Math.PI * k) / N);
        re[k] = st.fill[k] * w;
        im[k] = 0;
      }
      try { transformFlat(re, im, false); } catch (e) { st.pos = 0; return; }

      const half = N >> 1;
      const max  = st.max;
      for (let k = 0; k <= half; k++) {
        const p  = re[k] * re[k] + im[k] * im[k];
        const db = 10 * Math.log10(p / (N * N) + 1e-14);
        if (db > max[k]) max[k] = db;
      }
      st.seq++;
      st.pos = 0;
    }
  }

  _specReset(st) {
    st.max.fill(-140);
    st.pos = 0;
    st.seq++;
  }

  _ftxSpecFeed(pcm)  { this._specFeed(this._ftxSpec, pcm); }
  _ftxSpecReset()    { this._specReset(this._ftxSpec); }

  /**
   * Snapshot for the panel display: max-hold magnitudes over the slot so far,
   * plus the frequencies of the spots decoded from the previous slot.
   */
  getFTxSpectrum() {
    const sps = this.audioOutputSps || 12000;
    const st  = this._ftxSpec;
    return {
      mags:       st.max,
      binHz:      sps / st.N,
      marks:      st.marks,
      seq:        st.seq,
      // Match the decoder's own passband so the axis means the same thing.
      loHz:       100,
      hiHz:       Math.min(3100, sps / 2),
      gridHz:     500,
      collecting: !!(this.isCollecting || this.isFT4Collecting || this.isFT2Collecting || this.isJS8Collecting),
    };
  }

  /**
   * Same shape as getFTxSpectrum(), zoomed to the WSPR sub-band.
   *
   * WSPR only ever occupies WSPR_CENTER +/- 110 Hz (FMIN/FMAX in wspr.js), so
   * the full 100-3100 Hz axis would compress the whole band into a few percent
   * of the strip and merge every station into one smear. 1390-1610 Hz gives the
   * same box ~14x the horizontal resolution.
   */
  getWSPRSpectrum() {
    const sps = this.audioOutputSps || 12000;
    const st  = this._wsprSpec;
    return {
      mags:       st.max,
      binHz:      sps / st.N,
      marks:      st.marks,
      seq:        st.seq,
      loHz:       1390,
      hiHz:       1610,
      gridHz:     50,
      collecting: !!this.isWSPRCollecting,
    };
  }

  // ── Sync offset: persistence and self-calibration ───────────────────────

  _ftxLoadPref(key, dflt) {
    try {
      const v = Number(localStorage.getItem(key));
      return Number.isFinite(v) && localStorage.getItem(key) !== null ? v : dflt;
    } catch (e) { return dflt; }   // private mode / storage disabled
  }

  _ftxSavePref(key, value) {
    try { localStorage.setItem(key, String(value)); } catch (e) { /* ignore */ }
  }

  /** Capture lead-in for a mode (defaults to whichever mode is running). */
  getFTxTimeShift(mode) {
    return this.ftxShift[mode || this.ftxActiveMode] ?? 0.8;
  }

  /**
   * Largest lead-in the slider offers. 3 s everywhere, as it has always been,
   * except FT2: its shift is a phase within a 3.75 s slot, and a 3 s maximum
   * could not show the top of that range.
   */
  getFTxShiftRange(mode) {
    return (mode || this.ftxActiveMode) === 'FT2' ? 3.75 : 3;
  }

  /** Adjust the lead-in for the active mode. Manual override; clears history. */
  setFTxTimeShift(seconds, mode) {
    const v = Number(seconds);
    if (!Number.isFinite(v)) return;
    const m = mode || this.ftxActiveMode;
    this.ftxShift[m] = Math.max(0, Math.min(this.getFTxShiftRange(m), v));
    this._ftxSavePref(`ftxShift.${m}`, this.ftxShift[m].toFixed(3));
    this._ftxDtHistory[m] = [];        // stale relative to the new shift
    console.log(`[FTx] ${m} time shift = ${this.ftxShift[m].toFixed(2)} s`);
  }

  /**
   * Note which mode is decoding, so the slider tracks the right value and
   * calibration is attributed correctly.
   */
  _ftxSetActiveMode(mode) {
    if (this.ftxActiveMode === mode) return;
    this.ftxActiveMode = mode;
    this._ftxDtHistory[mode] = [];
    if (typeof this.onFTxTimeShiftChange === 'function') {
      this.onFTxTimeShiftChange(this.ftxShift[mode]);
    }
  }

  setFTxAutoSync(on) {
    this.ftxAutoSync = !!on;
    this._ftxSavePref('ftxAutoSync', this.ftxAutoSync ? 1 : 0);
    console.log(`[FTx] auto-sync ${this.ftxAutoSync ? 'ON' : 'OFF'}`);
  }

  /**
   * Ideal DT for a protocol: centre the transmission in the capture window —
   * but never past what the decoder can still find.
   *
   * ft8_lib searches time_offset over [-10, +19] BLOCKS (decode.c:205), so the
   * reachable DT ceiling is 19 symbol periods, not the width of the capture
   * window. Measured against the wasm with a synthesised frame swept across the
   * window: FT8 decodes throughout, FT4 up to DT 0.936, FT2 up to 0.468.
   *
   * FT2 is the one that matters. Its centring target (0.415 s) sits 0.04 s under
   * a 0.456 s ceiling, so any extra path latency or a slightly late station puts
   * DT over the edge — and since DT is measured FROM a decode, once decodes stop
   * the loop has nothing left to steer with and the mode stays dead. So FT2, and
   * only FT2, aims at half its ceiling instead: dead centre of the range the
   * decoder can actually search. (FT2 is an FT4 decode on a 2x time-stretched
   * buffer, so its blocks are FT4's halved — hence the 0.024 s symbol period.)
   *
   * FT4 needs the same clamp for the same reason, and the numbers are stark:
   * swept across the window, with and without noise, it decodes on EVERY trial
   * from DT 0.048 to 0.936 and on none at all from 0.984 up. Its centring target
   * of 1.03 s is past that cliff, so the loop pushed the shift down until the
   * stations piled up against the edge and only those whose clocks ran early
   * still got under it — strong signals, few decodes.
   *
   * (An earlier revision reverted FT4 to plain centring after FT4 decodes fell
   * off. That fall was caused by the bootstrap sweep below stepping FT4's shift
   * on a quiet band, not by this target; the sweep is now FT2-only and the
   * clamp is back.)
   *
   * FT8 keeps the plain centring target: its 3.04 s ceiling is far beyond the
   * 0.98 s it aims at, so there is nothing to clamp.
   */
  _ftxDtTarget(mode) {
    // JS8 submodes: the capture window is driven by the transmit duration, and
    // the frame is always 79 symbols. The wasm already removes the STFT's
    // one-symbol lag from the DT it reports, so this is a true centring target.
    if (typeof mode === 'string' && mode.startsWith('JS8:')) {
      const i = Number(mode.slice(4));
      const nsps = [1920, 1200, 600, 3840, 384][i];
      if (!nsps) return 0;
      const capture = (JS8_TXDUR_S[i] ?? 15) - 0.4;
      return Math.max(0, (capture - 79 * (nsps / 12000)) / 2);
    }
    const spec = {
      FT8: { slot: 15.0,  sym: 0.160, n: 79  },
      FT4: { slot: 7.5,   sym: 0.048, n: 105 },
      FT2: { slot: 3.75,  sym: 0.024, n: 105 },
    }[mode];
    if (!spec) return 0;
    const centring = ((spec.slot - 0.4) - spec.n * spec.sym) / 2;
    if (mode === 'FT8') return Math.max(0, centring);
    const searchMid = (19 * spec.sym) / 2;   // middle of ft8_lib's offset search
    return Math.max(0, Math.min(centring, searchMid));
  }

  /**
   * Break the shift out of a dead spot after a long silence.
   *
   * Auto-sync can only steer while decodes are arriving: DT is measured FROM a
   * decode. If the shift ever drifts so far that DT leaves the decoder's search
   * range, decodes stop, no DT is measured, and the shift stays wrong forever —
   * the mode is dead until someone resets it by hand. The shift is persisted,
   * so that dead state survives a reload too.
   *
   * After a long dry spell, therefore, step the shift across the slot instead
   * of sitting still. The step is 0.75x the width of the decoder's DT search,
   * so no reachable position is skipped, and the whole slot is covered in a
   * bounded number of steps (11 for FT2, ~41 s of a quiet band). A single
   * decode ends the sweep and hands control back to the calibration loop.
   *
   * Deliberately narrow, because a silence usually just means a quiet band, and
   * stepping the shift of a mode that is merely waiting for a signal causes the
   * exact fault this is here to cure:
   *
   *   - FT2 only. It is the one mode whose target sits near its ceiling, so it
   *     is the only one that can be trapped. Sweeping FT4 as well measurably
   *     cost decodes on a quiet band, and FT8 has metres of margin.
   *   - never once a decode has proved the shift in this session. From then on
   *     silence is the band, not the timing.
   *   - never while auto-sync is off: a hand-set shift is the user's business.
   */
  _ftxBootstrapShift(mode) {
    if (mode !== 'FT2' || this._ftxShiftProved[mode]) return false;
    const spec = { slot: 3.75, sym: 0.024 };

    const dry = (this._ftxDrySlots[mode] = (this._ftxDrySlots[mode] || 0) + 1);
    // Long enough that an ordinarily quiet band does not trigger it: 8 FT2
    // slots is 30 s.
    if (dry < 8) return false;
    this._ftxDrySlots[mode] = 0;

    const step = 0.75 * (19 * spec.sym);
    const cur  = this.ftxShift[mode] ?? 0.8;
    let next = (cur + step) % spec.slot;
    if (next < 0) next += spec.slot;

    this.ftxShift[mode] = next;
    this._ftxSavePref(`ftxShift.${mode}`, next.toFixed(3));
    (this._ftxDtHistory[mode] || []).length = 0;
    console.log(`[FTx] ${mode}: no decodes in ${dry} slots — sweeping shift ` +
                `${cur.toFixed(2)}s → ${next.toFixed(2)}s`);

    if (mode === this.ftxActiveMode &&
        typeof this.onFTxTimeShiftChange === 'function') {
      this.onFTxTimeShiftChange(next);
    }
    return true;
  }

  /**
   * Nudge the capture lead-in from the decoders' own DT measurements.
   *
   * DT is where the decoded signal actually sat in the analysis window, so
   * DT = latency - shift. Verified empirically: trimming N seconds off the
   * front of a recording lowers DT by exactly N. The correction is therefore
   * `shift += (DT - target)`, damped.
   *
   * Uses the median, not the mean: one badly mistimed station would otherwise
   * drag the whole loop. Needs a few decodes before acting, for the same
   * reason.
   */
  _ftxAutoCalibrate(mode, decodedMessages) {
    if (!this.ftxAutoSync) return;

    if (decodedMessages.length) {
      this._ftxDrySlots[mode] = 0;
      this._ftxShiftProved[mode] = true;   // this shift works; stop searching
    } else if (this._ftxBootstrapShift(mode)) return;

    // Accumulate across slots rather than requiring several in one. A band may
    // carry a single signal — FT2 typically does — and a per-slot threshold
    // would then never fire at all.
    const hist = this._ftxDtHistory[mode] || (this._ftxDtHistory[mode] = []);
    for (const m of decodedMessages) {
      if (Number.isFinite(m.dt)) hist.push(m.dt);
    }
    while (hist.length > 12) hist.shift();   // rolling, so it tracks drift
    if (hist.length < 3) return;

    const sorted = hist.slice().sort((a, b) => a - b);
    const median = sorted.length % 2
      ? sorted[(sorted.length - 1) / 2]
      : 0.5 * (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]);

    const error = median - this._ftxDtTarget(mode);
    if (Math.abs(error) < 0.05) return;  // deadband: don't chase jitter

    const GAIN = 0.5;                    // damped, so it settles instead of ringing
    const cur  = this.ftxShift[mode] ?? 0.8;
    // FT2's shift is a phase within a 3.75 s slot, so wrap it there: the old
    // hard 0..3 s clamp cut off the top of a legitimate range and pinned the
    // value at the limit. Every other mode keeps that clamp — their shifts have
    // never needed more than 3 s, and widening the range is not this fix's job.
    let next;
    if (mode === 'FT2') {
      next = (cur + GAIN * error) % 3.75;
      if (next < 0) next += 3.75;
    } else {
      next = Math.max(0, Math.min(3, cur + GAIN * error));
    }
    if (Math.abs(next - cur) < 0.01) return;

    this.ftxShift[mode] = next;
    this._ftxSavePref(`ftxShift.${mode}`, next.toFixed(3));
    hist.length = 0;                     // measured against the old shift
    console.log(`[FTx] auto-sync: ${mode} median DT ${median.toFixed(2)}s ` +
                `(target ${this._ftxDtTarget(mode).toFixed(2)}s) → shift ${next.toFixed(2)}s`);

    // Let the UI slider follow, but only while this mode is the one showing.
    if (mode === this.ftxActiveMode &&
        typeof this.onFTxTimeShiftChange === 'function') {
      this.onFTxTimeShiftChange(next);
    }
  }

  startCollection() {
    this.isCollecting = true;
    this.accumulatorLen = 0;
  }

  async stopCollection() {
    this.isCollecting = false;
    if (this.decodeFT8) {
      // ✅ FIXED: zero accumulatorLen immediately after snapshot so the slot
      //           boundary timer cannot read a stale length before startCollection()
      const bigFloat32Array = this.accumulator.slice(0, this.accumulatorLen);
      this.accumulatorLen = 0;

      const decodedMessages = await _workerDecode('ft8', bigFloat32Array, { sampleRate: this.audioOutputSps || 12000 });
      this._ftxRenderSpots('FT8', decodedMessages);
    }
  }

// ── FT4 collection ──────────────────────────────────────────────────────
// NB: slot boundaries are handled by _ftxSlotStart()/_ftxSlotFinish(), driven
// from playAudio(). The old timer-polled updateFT4CollectionStatus() is gone.

startFT4Collection() {
    this.isFT4Collecting = true;
    this.ft4AccumulatorLen = 0;
}

async stopFT4Collection() {
    this.isFT4Collecting = false;
    if (!this.decodeFT4 || this.ft4AccumulatorLen < 1000) return;

    const pcm = this.ft4Accumulator.slice(0, this.ft4AccumulatorLen);
    this.ft4AccumulatorLen = 0;

    let decodedMessages;
    try {
        decodedMessages = await _workerDecode('ft4', pcm, { sampleRate: this.audioOutputSps || 12000 });
    } catch (e) {
        console.error('[FT4] decode error:', e);
        return;
    }

    this._ftxRenderSpots('FT4', decodedMessages);
}
// ── FT4 collection END ───────────────────────────────────────────────────

// ── FT2 collection ──────────────────────────────────────────────────────
// Slot boundaries handled by _ftxSlotStart()/_ftxSlotFinish(); see above.
startFT2Collection() {
    this.isFT2Collecting = true;
    this.ft2AccumulatorLen = 0;
}
async stopFT2Collection() {
    this.isFT2Collecting = false;
    if (!this.decodeFT2 || this.ft2AccumulatorLen < 1000) return;
    const pcm = this.ft2Accumulator.slice(0, this.ft2AccumulatorLen);
    this.ft2AccumulatorLen = 0;
    let decodedMessages;
    try {
        decodedMessages = await _workerDecode('ft2', pcm, { sampleRate: this.audioOutputSps || 12000 });
    } catch (e) {
        console.error('[FT2] decode error:', e);
        return;
    }
    this._ftxRenderSpots('FT2', decodedMessages);
}
// ── FT2 collection END ───────────────────────────────────────────────────

// ── JS8 collection ───────────────────────────────────────────────────────
// Slot boundaries handled by _ftxSlotStart()/_ftxSlotFinish(), like the FTx
// modes. The difference is what happens afterwards: a JS8 frame is not a
// message, so decoded frames go through js8.js and then into the reassembler,
// which may hold them for several more slots before a message comes out.
startJS8Collection() {
    this.isJS8Collecting = true;
    this.js8AccumulatorLen = 0;
}

async stopJS8Collection() {
    this.isJS8Collecting = false;
    if (!this.decodeJS8 || this.js8AccumulatorLen < 1000) return;

    const submode = this.js8Submode;
    const pcm = this.js8Accumulator.slice(0, this.js8AccumulatorLen);
    this.js8AccumulatorLen = 0;

    let raw;
    try {
        raw = await _workerDecode('js8', pcm, {
            sampleRate: this.audioOutputSps || 12000,
            submode,
        });
    } catch (e) {
        console.error('[JS8] decode error:', e);
        return;
    }

    const now = Date.now();
    const frames = [];

    for (const r of raw) {
        let frame;
        try {
            frame = js8DecodeFrame(r.payload, r.i3bit);
        } catch (e) {
            console.error('[JS8] frame decode error:', e);
            continue;
        }

        // Compressed data frames need the 1.9 MB JSC dictionary. It is not
        // fetched up front -- most traffic (heartbeats, directed commands,
        // plain text) never needs it -- so the first compressed frame triggers
        // the load and decodes on a later slot instead.
        if (frame.needsDictionary) {
            js8LoadDictionary().catch((e) => console.error('[JS8] dictionary:', e));
        }

        frames.push({ frame, meta: {
            freq: r.freq, submode, snr: r.snr, dt: r.dt, time: now,
        }});
    }

    // Feed the reassembler in frequency order so that, when one slot carries
    // several stations, the per-offset buffers are touched predictably.
    frames.sort((a, b) => a.meta.freq - b.meta.freq);
    for (const { frame, meta } of frames) {
        try {
            this.js8Reassembler.addFrame(frame, meta);
        } catch (e) {
            console.error('[JS8] reassembly error:', e);
        }
    }

    // Apply the idle / timeout rules once per slot.
    try { this.js8Reassembler.tick(now); } catch (e) { console.error('[JS8] tick:', e); }

    // Yellow marks on the mini spectrum, same shape the FTx modes use
    // ({hz, snr, text}) so FtxSpectrum can render them unchanged.
    this._ftxSpec.marks = frames
        .filter(({ meta }) => Number.isFinite(meta.freq))
        .map(({ frame, meta }) => ({
            hz: meta.freq,
            snr: meta.snr,
            text: formatJs8Frame(frame),
        }));
    this._ftxSpec.seq++;

    this._ftxAutoCalibrate(this._js8Mode(), raw);

    if (typeof this.onJS8Frames === 'function') {
        this.onJS8Frames(frames.map(({ frame, meta }) => ({ ...frame, ...meta })));
    }
}

/** Turn JS8 decoding on or off. */
setJS8Decoding(value) {
    this.decodeJS8 = !!value;
    if (value) {
        // Warm the JSC dictionary now rather than on the first compressed
        // frame. Observed on air: the first frame of the first compressed
        // message decodes as empty while the 1.9 MB fetch is still in flight,
        // so that message loses its opening chunk. The first slot is at least
        // 4 s away and usually 15, which is ample. It is still never fetched
        // unless JS8 is actually selected, which was the point of being lazy.
        js8LoadDictionary().catch((e) => console.error('[JS8] dictionary:', e));
        this._ftxSetActiveMode(this._js8Mode());
    } else {
        this.isJS8Collecting = false;
        this.js8AccumulatorLen = 0;
        this.js8Reassembler.reset();
    }
}

/**
 * Select the JS8 submode: 0=Normal 1=Fast 2=Turbo 3=Slow 4=Ultra.
 *
 * Changing speed invalidates everything in flight -- the buffers hold frames
 * from a different slot cadence and their frequency tolerances differ -- so
 * the reassembler is cleared rather than carried over.
 */
setJS8Submode(index) {
    const n = Number(index);
    if (!Number.isInteger(n) || n < 0 || n >= JS8_NAMES.length) return;
    if (n === this.js8Submode) return;

    this.js8Submode = n;
    this._ftxSavePref('js8.submode', n);
    this.isJS8Collecting = false;
    this.js8AccumulatorLen = 0;
    this.js8Reassembler.reset();
    if (this.decodeJS8) this._ftxSetActiveMode(this._js8Mode());
    console.log(`[JS8] submode ${JS8_NAMES[n]} (${JS8_PERIOD_S[n]} s cycle)`);
}

/** Messages still being assembled, for a live UI. */
js8Pending() {
    return this.js8Reassembler.pending();
}
// ── JS8 collection END ───────────────────────────────────────────────────

// ── WSPR-2 collection ────────────────────────────────────────────────────
  /**
   * Called every 500 ms.  WSPR-2 slots start on even UTC minutes (0, 2, 4 …).
   * Transmission occupies 1.0 s … 111.6 s of the slot; we collect to 119 s.
   *
   *  pos   0 s  → start collecting  (slot open, even minute)
   *  pos 119 s  → stop and decode
   *
   * The stop point is set by capture latency, not by the decoder: with latency
   * L the collected audio covers signal times [-L, 119-L], so the transmission
   * is only complete while L <= 7.4 s.  (At the old 116 s the budget was 4.4 s,
   * and users past it saw silent "too few samples" skips.)  Nothing needs to be
   * calibrated beyond that — unlike FT8/FT4, wsprd searches the time offset
   * itself over roughly -3 … +7.5 s, so any latency inside the capture window
   * is absorbed by the sync search.  See _wsprDecode()'s k0 loop in wspr.js.
   */
  updateWSPRCollectionStatus() {
    if (!this.decodeWSPR) return;
    const pos = wspr2SlotPosition(); // 0–119 s within the current 2-minute slot

    if (pos < 2 && !this.isWSPRCollecting) {
      this.startWSPRCollection();
    } else if (pos >= 119 && this.isWSPRCollecting) {
      this.stopWSPRCollection();
    }
  }

  startWSPRCollection() {
    this.isWSPRCollecting = true;
    this.wsprAccumulatorLen = 0;
    this._specReset(this._wsprSpec);
    console.log('[WSPR] Collection started');
  }

  async stopWSPRCollection() {
    this.isWSPRCollecting = false;
    if (!this.decodeWSPR || this.wsprAccumulatorLen < WSPR_TOTAL_SAMPLES) {
      console.log(`[WSPR] Too few samples (${this.wsprAccumulatorLen} < ${WSPR_TOTAL_SAMPLES}), skipping decode`);
      return;
    }

    const pcm = this.wsprAccumulator.slice(0, this.wsprAccumulatorLen);
    this.wsprAccumulatorLen = 0;
    console.log(`[WSPR] Decoding ${pcm.length} samples…`);

    let results;
    try {
      results = await _workerDecode('wspr', pcm, {
        sampleRate: this.audioOutputSps || 12000,
        dialFreqHz: this.wsprDialFreqHz || 0,
      });
    } catch (e) {
      console.error('[WSPR] decode error:', e);
      return;
    }

    console.log(`[WSPR] ${results.length} message(s) decoded`);

    // Marks stay on the strip through the next collection window, so the spots
    // in the list can be read straight off the spectrum they came from.
    this._wsprSpec.marks = results
      .filter(r => Number.isFinite(r.audioHz))
      .map(r => ({ hz: r.audioHz, snr: r.snr, text: r.callsign }));
    this._wsprSpec.seq++;

    const listDiv = document.getElementById('wsprMessagesList');
    if (!listDiv) return;

    const now = new Date();
    const utc = now.toISOString().slice(11, 16); // "HH:MM"

    for (const r of results) {
      const row = document.createElement('div');
      row.classList.add('glass-message', 'p-1', 'rounded', 'text-xs',
                        'flex', 'justify-between', 'items-center', 'font-mono', 'gap-2');

      // Timestamp + callsign
      const csSpan = document.createElement('span');
      csSpan.classList.add('text-cyan-300', 'font-bold');
      csSpan.textContent = `${utc}  ${r.callsign}`;
      row.appendChild(csSpan);

      // Grid — clickable link
      const gridLink = document.createElement('a');
      gridLink.href = `https://www.levinecentral.com/ham/grid_square.php?&Grid=${r.grid}&Zoom=10&sm=y`;
      gridLink.target = '_blank';
      gridLink.classList.add('text-yellow-300', 'hover:underline');
      gridLink.textContent = r.grid;
      row.appendChild(gridLink);

      // Power
      const pwrSpan = document.createElement('span');
      pwrSpan.classList.add('text-orange-300');
      pwrSpan.textContent = `${r.dbm} dBm`;
      row.appendChild(pwrSpan);

      // Freq (kHz relative to dial, or absolute if dial set)
      const freqSpan = document.createElement('span');
      freqSpan.classList.add('text-gray-300');
      freqSpan.textContent = this.wsprDialFreqHz
        ? `${(r.freq / 1000).toFixed(3)} kHz`
        : `+${Number(r.freq).toFixed(0)} Hz`;
      row.appendChild(freqSpan);

      // SNR. Fixed to one decimal so the column does not jitter between "-23"
      // and "-23.4"; wspr.js already rounds to 0.1 dB at source, which is the
      // decoder's real precision, so a second decimal would always be a zero.
      const snrSpan = document.createElement('span');
      snrSpan.classList.add(r.snr >= 0 ? 'text-green-400' : 'text-gray-400');
      snrSpan.textContent = Number.isFinite(r.snr)
        ? `${r.snr > 0 ? '+' : ''}${r.snr.toFixed(1)} dB`
        : '';
      row.appendChild(snrSpan);

      listDiv.appendChild(row);
    }

    // Keep list bounded to last 200 rows
    while (listDiv.children.length > 200) listDiv.removeChild(listDiv.firstChild);

    if (results.length > 0) {
      setTimeout(() => { listDiv.scrollTop = listDiv.scrollHeight; }, 200);
    }
  }

  setWSPRDecoding(enabled) {
    this.decodeWSPR = !!enabled;
    if (!enabled) {
      this.isWSPRCollecting   = false;
      this.wsprAccumulatorLen = 0;
    }
    console.log(`[WSPR] Decoding: ${this.decodeWSPR ? 'ON' : 'OFF'}`);
  }

  /** Call with the dial frequency in Hz when tuned to a WSPR band */
  setWSPRDialFreq(hz) {
    this.wsprDialFreqHz = hz || 0;
  }
// ── WSPR-2 collection END ─────────────────────────────────────────────────

  // FT8 END


  playAudio(pcmArray, pcmArrayPreBoost, decoderPcm) {
    // ── Tap raw PCM for digital decoders BEFORE mute/squelch/DSP ──────────
    // Every decoder taps here: NB, NR, NS and ANF are listening aids, and none
    // of them must be in the path of a decoder. They must also keep collecting
    // when speaker audio is muted or squelched, which is why this sits above
    // that gate.
    // rawPcm = post-FLAC-boost version, which all decoders expect.  When
    // diversity is running, `decoderPcm` is the undelayed LOCAL stream and
    // pcmArray is the combined one destined for the speaker; otherwise the
    // two are the same object and this is exactly what it always was.
    const rawPcm = decoderPcm || pcmArray;

    // Open any FTx capture window whose slot boundary has arrived, before the
    // appends below — so the block that crosses the boundary is captured too.
    this._ftxSlotStart(rawPcm.length);

    // Mini spectrum tracks whatever slot is being captured.
    if (this.decodeFT8 || this.decodeFT4 || this.decodeFT2 || this.decodeJS8) {
      try { this._ftxSpecFeed(rawPcm); } catch (e) { /* display only */ }
    }
    if (this.isWSPRCollecting && this.decodeWSPR) {
      try { this._specFeed(this._wsprSpec, rawPcm); } catch (e) { /* display only */ }
    }

    if (this.isCollecting && this.decodeFT8) {
      const end = Math.min(this.accumulatorLen + rawPcm.length, this.maxAccumulatorSize);
      this.accumulator.set(rawPcm.subarray(0, end - this.accumulatorLen), this.accumulatorLen);
      this.accumulatorLen = end;
    }
    if (this.isFT4Collecting && this.decodeFT4) {
      const end = Math.min(this.ft4AccumulatorLen + rawPcm.length, this.maxFT4AccumulatorSize);
      this.ft4Accumulator.set(rawPcm.subarray(0, end - this.ft4AccumulatorLen), this.ft4AccumulatorLen);
      this.ft4AccumulatorLen = end;
    }
    if (this.isFT2Collecting && this.decodeFT2) {
      const end = Math.min(this.ft2AccumulatorLen + rawPcm.length, this.maxFT2AccumulatorSize);
      this.ft2Accumulator.set(rawPcm.subarray(0, end - this.ft2AccumulatorLen), this.ft2AccumulatorLen);
      this.ft2AccumulatorLen = end;
    }
    if (this.isWSPRCollecting && this.decodeWSPR) {
      const end = Math.min(this.wsprAccumulatorLen + rawPcm.length, this.maxWSPRAccumulatorSize);
      this.wsprAccumulator.set(rawPcm.subarray(0, end - this.wsprAccumulatorLen), this.wsprAccumulatorLen);
      this.wsprAccumulatorLen = end;
    }
    if (this.isJS8Collecting && this.decodeJS8) {
      const end = Math.min(this.js8AccumulatorLen + rawPcm.length, this.maxJS8AccumulatorSize);
      this.js8Accumulator.set(rawPcm.subarray(0, end - this.js8AccumulatorLen), this.js8AccumulatorLen);
      this.js8AccumulatorLen = end;
    }

    // Decode any FTx window that is now complete.
    this._ftxSlotFinish();

    // FAX tap — uses rawPcm for both FLAC and Opus.  The 12 kHz pipeline stream
    // is already band-limited server-side, giving the FM phase discriminator a
    // clean signal.  No Opus-specific override; see calibration note above.
    if (this.decodeFAX) {
      try { this._faxFeedPCM(rawPcm); }
      catch(e) { console.error('[FAX] feed error', e); }
    }

    // SSTV tap — same raw PCM, before AGC/NR/mute/squelch
    if (this.decodeSSTV) {
      try { this._sstvFeedPCM(rawPcm); }
      catch(e) { console.error('[SSTV] feed error', e); }
    }

    // NAVTEX/SITOR-B tap — raw PCM before any DSP
    if (this.decodeNAVTEX) {
      try { this._navtexFeedPCM(rawPcm); }
      catch(e) { console.error('[NAVTEX] feed error', e); }
    }

    // Generic Kiwi-style FSK tap — raw PCM before any DSP
    if (this.decodeFSK) {
      try { this._fskFeedPCM(rawPcm); }
      catch(e) { console.error('[FSK] feed error', e); }
    }

    // Mode identifier tap — raw PCM, like the decoders it is choosing between.
    // It must see exactly what they would see, so NR/NS/ANF gain ripple cannot
    // change the tone structure it is measuring.
    if (this.decodeModeID) {
      try { this._modeIdEngine.feedPCM(this._monoForDisplay(rawPcm)); }
      catch(e) { console.error('[ModeID] feed error', e); }
    }

    // QRSS grabber tap — raw PCM, above the mute gate. The grabber is a
    // measurement display, not a monitor of what the speaker is doing: a slow
    // CW trace read off the screen is decoded by eye, so NR/NS gain ripple and
    // blanker gaps corrupt the very thing being read. It also has to keep
    // capturing while the receiver is muted, like the decoders around it — an
    // overnight grab must not depend on the speaker staying on.
    if (this.qrssEnabled && this.qrssCallback) {
      try { this.qrssCallback(this._monoForDisplay(rawPcm)); }
      catch(e) { console.error('[QRSS] feed error', e); }
    }

    // CW tap — raw PCM, like every other decoder.
    //
    // CW used to be fed the PROCESSED buffer, on the reasoning that the auto
    // notch removed interfering carriers before the tone detector saw them.
    // That no longer holds: ANF is bypassed in CW (it would cancel the CW note
    // itself), so the only thing the processed buffer still adds is the noise
    // blanker's gaps, the two spectral stages' gain fluctuation and their 42 ms
    // of latency — all of which distort the envelope statistics that the
    // matched filter and Schmitt trigger depend on. It also sat *below* the
    // mute/squelch gate, so muting the receiver silently stopped CW decoding.
    if (this.decodeCW) {
      try { this._cwFeedPCM(rawPcm); } catch(e) { console.error('CW feed error', e); }
    }

    // RADE v1 tap — forward raw SSB audio to sidecar even when muted.
    // rade_rx needs continuous input to maintain frame sync; do NOT gate on mute.
    // Uses pcmArrayPreBoost (pre-FLAC-boost) — boosted amplitude saturates radae_rxe.py.
    if (this.decodeRADE && this._radeSocket && this._radeReady &&
        this._radeSocket.readyState === WebSocket.OPEN) {
      var radePcm = pcmArrayPreBoost || pcmArray;
      try {
        this._radeSocket.send(
          radePcm.buffer.slice(radePcm.byteOffset,
                               radePcm.byteOffset + radePcm.byteLength));
      } catch(e) { console.error('[RADE] feed error', e); }
    }

    // Real FM CTCSS tone-squelch:
    // keep speaker audio closed until a valid subtone is detected.
    this._updateCTCSSGate(rawPcm);

    // Speaker-audio gate starts here. Decoder feeds above must still run.
    if (this.mute || (this.squelchMute && this.squelch) || this.ctcssMute) {
      return
    }
    if (this.audioCtx.state !== 'running') {
      return
    }

    // RADE mode: decoded speech arrives from sidecar via _radePlayPCM();
    // suppress raw SSB output so the two audio paths don't clash.
    if (this.decodeRADE) return;

    // Every digital decoder was already fed from the raw tap above, before
    // mute/squelch. Nothing below this point reaches a decoder — it is the
    // listening path only.
    // ✅ STEREO C-QUAM: Selective processing to avoid artifacts
    //
    // Noise blanker: ENABLED - safe for stereo when L/R processed separately
    // Noise gate: DISABLED - causes tremor (envelope follower sees L/R alternation)
    // AGC: DISABLED - fights backend C-QUAM AGC, causes pumping
    if (this.channels === 2) {
      const frames = Math.floor(pcmArray.length / 2)
      const L = new Float32Array(frames)
      const R = new Float32Array(frames)
      for (let i = 0; i < frames; i++) { 
        L[i] = pcmArray[i * 2]
        R[i] = pcmArray[i * 2 + 1]
      }

      // Blanker and NR per channel, each with its own state (chR flag) —
      // sharing it made one channel react to the other's impulses/spectrum.
      let Lp = this.applyNoiseBlanker(L, false)
      let Rp = this.applyNoiseBlanker(R, true)
      Lp = this.applyAiNoiseReduction(Lp, false)
      Rp = this.applyAiNoiseReduction(Rp, true)
      Lp = this.applyNoiseReduction(Lp, false)
      Rp = this.applyNoiseReduction(Rp, true)

      // Background noise measurement/suppression — per channel, each with its
      // own floor and gain vector (they used to share one set).
      Lp = this.applyBackgroundNoiseSuppression(Lp, false)
      Rp = this.applyBackgroundNoiseSuppression(Rp, true)

      // Apply ANF to each channel separately (safe for stereo)
      if (this.anfActive()) {
        Lp = this.applyAutoNotch(Lp, false)
        Rp = this.applyAutoNotch(Rp, true)
      }
      
      // Debug: log if noise blanker actually processed anything
      if (this.nbBlankerEnabled || this.nrEnabled || this.nb) {
        if (!this._noiseBlankerLoggedOnce) {
          console.log('[Stereo NB] Noise blanker active for C-QUAM, frames=', frames)
          this._noiseBlankerLoggedOnce = true
        }
      }

      // Skip noise gate - causes tremor on stereo
      // Skip AGC - fights backend AGC, causes pumping

      // Re-interleave
      const out = new Float32Array(frames * 2)
      for (let i = 0; i < frames; i++) { 
        out[i * 2] = Lp[i]
        out[i * 2 + 1] = Rp[i]
      }
      pcmArray = out
      this._updateAudioLevelControl(pcmArray)

    } else {
      // Mono path — full processing as before
      pcmArray = this.applyNoiseBlanker(pcmArray, false);
      pcmArray = this.applyAiNoiseReduction(pcmArray, false);
      pcmArray = this.applyNoiseReduction(pcmArray, false);
      pcmArray = this.applyBackgroundNoiseSuppression(pcmArray, false);
      if (this.anfActive()) {
        pcmArray = this.applyAutoNotch(pcmArray, false);
      }
      pcmArray = this.applyNoiseCancel(pcmArray);
      this._updateAudioLevelControl(pcmArray);
    }

    // Feed PCM data to the spectrogram (after all audio processing — unlike the
    // QRSS grabber, this display is meant to show what you are hearing, filters
    // included).
    if (this.spectrogramEnabled && this.spectrogramCallback) {
      try {
        this.spectrogramCallback(this._monoForDisplay(pcmArray));
      } catch (error) {
        console.error('Spectrogram feed error:', error);
      }
    }

    const currentTime = this.audioCtx.currentTime;
    let shedFromPlayback = false;

    if (this._streamForceFallback) {
      // ── Fallback path scheduling (AudioBufferSourceNode) ──────────────────
      //
      // This is the path taken by every listener whose page is not a secure
      // context, because BaseAudioContext's audioWorklet attribute is
      // [SecureContext] and is simply undefined on a plain-http origin that is
      // not localhost. A phone on the LAN address lands here while a desktop
      // on localhost does not — which is why the same receiver can sound clean
      // on one and break up on the other.
      //
      // Here each chunk is its own scheduled source node, so the ONE rule that
      // matters is: playTime must never move backwards while sources are still
      // queued to play. The previous overrun branch did exactly that, resetting
      // playTime to currentTime + bufferThreshold — so the next chunk started
      // on top of audio that was still sounding. Overlapping source nodes SUM
      // rather than replace, which is heard as distortion rather than as a
      // dropout, and on a jittery link it happened over and over.
      //
      // Decisions are also made BEFORE scheduling, not after. The old code
      // scheduled at the stale playTime and corrected afterwards, so every
      // correction landed one chunk late and playPCM needed a Math.max() clamp
      // to avoid scheduling in the past.
      //
      // The cushion this path runs on is exactly `prebuffer`: playTime advances
      // by each chunk's own duration, so in steady state it stays however far
      // ahead the last restart left it. That makes bufferThreshold — the second
      // half of each UI buffer preset — the value that decides how much jitter
      // a listener can absorb here, and raising the preset now genuinely helps.
      const prebuffer = Math.max(this.bufferThreshold, 0.02);

      if (!(this.playTime > currentTime)) {
        // Underrun: everything scheduled has already played out, so there is
        // nothing to overlap and we can safely restart the timeline ahead of
        // the clock. This is still a gap, but a clean silent one.
        this.playTime = currentTime + prebuffer;
        this._fallbackRestarts = (this._fallbackRestarts || 0) + 1;
      } else if ((this.playTime - currentTime) > (this.bufferLimit + prebuffer)) {
        // Overrun: the producer is outrunning playback. Shed THIS chunk and
        // leave the timeline untouched — the backlog drains by one chunk and
        // what is already scheduled stays continuous. Dropping one chunk is a
        // splice; rescheduling backwards was a collision.
        // Shed from PLAYBACK only: fall through to the recording block below,
        // so a running recording still captures a complete stream even when
        // the link is too far ahead to play everything.
        this._fallbackDrops = (this._fallbackDrops || 0) + 1;
        shedFromPlayback = true;
      }

      if (!shedFromPlayback) {
        const curPlayTime = this.playPCM(pcmArray, this.playTime, this.audioOutputSps, 1, this.channels)
        this.playTime += curPlayTime;
      }
    } else {
      // ── Worklet path ──────────────────────────────────────────────────────
      // playPCM() hands the chunk straight to the worklet's ring buffer, which
      // does its own underrun and overflow handling. playTime is not driving
      // playback here at all; it is kept advancing only so the S-meter's
      // _dBQueue has a play-out time to align against.
      const curPlayTime = this.playPCM(pcmArray, this.playTime, this.audioOutputSps, 1, this.channels)
      if ((this.playTime - currentTime) <= this.bufferThreshold) {
        this.playTime = (currentTime + this.bufferThreshold + curPlayTime);
      } else if ((this.playTime - currentTime) > this.bufferLimit) {
        this.playTime = (currentTime + this.bufferThreshold);
      } else {
        this.playTime += curPlayTime;
      }
    }

    if (this.isRecording) {
      // ✅ FIXED: Check recording duration to prevent memory exhaustion
      const recordingDuration = (Date.now() - this.recordingStartTime) / 1000;
      
      if (recordingDuration > this.maxRecordingDuration) {
        console.warn('[Recording] Maximum duration (' + 
                     (this.maxRecordingDuration / 60) + ' minutes) reached, stopping automatically');
        this.stopRecording();
        
        // ✅ Notify user if possible
        if (typeof window !== 'undefined' && window.postMessage) {
          window.postMessage({
            type: 'recording_limit_reached',
            duration: this.maxRecordingDuration
          }, '*');
        }
      } else {
        // FIX: recordedAudio.push(...pcmArray) spreads the entire Float32Array
        // as individual arguments — for large arrays this throws RangeError:
        // Maximum call stack size exceeded.  Use a loop instead.
        const base = this.recordedAudio.length;
        this.recordedAudio.length = base + pcmArray.length;
        for (let i = 0; i < pcmArray.length; i++) {
          this.recordedAudio[base + i] = pcmArray[i];
        }
      }
    }
  }

  async _ensureStreamingWorklet() {
    if (!this.audioCtx || !this.audioInputNode) return false;
    if (this._streamForceFallback) return false;
    if (this._streamWorkletNode) {
      if (this._streamConnectedNode !== this.audioInputNode) {
        try { this._streamWorkletNode.disconnect(); } catch (_) {}
        this._streamWorkletNode.connect(this.audioInputNode);
        this._streamConnectedNode = this.audioInputNode;
      }
      return true;
    }
    if (this._streamInitPromise) {
      return this._streamInitPromise;
    }

    this._streamInitPromise = (async () => {
      let stage = 'init';
      try {
        if (this.audioCtx.state === 'suspended') {
          stage = 'resume';
          try { await this.audioCtx.resume(); } catch (_) {}
        }
        stage = 'capability-check';
        // MUST be the standardized-audio-context AudioWorkletNode, not the
        // native one: this.audioCtx comes from that library (see the import at
        // the top), and Chromium rejects a native AudioWorkletNode built with
        // a wrapped context - "parameter 1 is not of type 'BaseAudioContext'".
        // That threw on every single call, so this whole worklet path fell
        // through to the AudioBufferSourceNode fallback below for every
        // listener, in every browser. Audible as constant breakup on Chromium,
        // which schedules the fallback less forgivingly than Firefox does.
        const WorkletCtor = AudioWorkletNode;
        if (!this.audioCtx.audioWorklet || !WorkletCtor) {
          throw new Error('AudioWorklet not available');
        }
        if (!this._streamWorkletModuleLoaded) {
          stage = 'addModule(URL)';
          try {
            await this.audioCtx.audioWorklet.addModule(new URL('./audio-stream-worklet.js', import.meta.url));
          } catch (urlErr) {
            // Some bundler/server setups (service worker interception, dev
            // preview servers, MIME-type quirks) handle a constructed URL
            // differently from a plain relative string. This is a cheap,
            // low-risk second attempt rather than giving up immediately —
            // if THIS also fails, the two errors together tell you whether
            // it's a path problem (both fail the same way) or specifically
            // an import.meta.url resolution problem (only the first fails).
            stage = 'addModule(string, after URL failed)';
            console.warn('[Audio] addModule via constructed URL failed, retrying with plain path:', urlErr);
            await this.audioCtx.audioWorklet.addModule('./audio-stream-worklet.js');
          }
          this._streamWorkletModuleLoaded = true;
        }
        stage = 'construct-node';
        const node = new WorkletCtor(this.audioCtx, 'phantomsdr-audio-stream', {
          numberOfInputs: 0,
          numberOfOutputs: 1,
          outputChannelCount: [2],
          // Geometry comes from _workletBufferOptions() rather than literals,
          // so a buffer preset chosen before the worklet was built (the usual
          // order — the node is created lazily on the first PCM frame) is
          // honoured instead of being overwritten by a hardcoded default.
          processorOptions: Object.assign(
            // The graph's rate, because playPCM converts to it before enqueuing.
            // This only sizes the ring buffer, so it must match the frames that
            // actually arrive, not the rate they were transmitted at.
            { sampleRate: this._graphSampleRate() },
            this._workletBufferOptions()
          )
        });
        node.connect(this.audioInputNode);
        this._streamConnectedNode = this.audioInputNode;
        node.port.onmessage = (event) => {
          const data = event.data || {};
          if (data.type === 'stats') {
            this._streamStats = data;
          }
        };
        this._streamWorkletNode = node;
        if (!this._loggedWorkletPlayback) {
          console.log('[Audio] Streaming AudioWorklet active');
          this._loggedWorkletPlayback = true;
        }
        return true;
      } catch (e) {
        if (!this._loggedWorkletFailure) {
          // Print stage + name + message explicitly rather than relying on
          // the console to expand the raw error object usefully — some
          // browsers collapse DOMException/AbortError objects to something
          // unhelpful when logged bare.
          console.warn('[Audio] AudioWorklet stream unavailable at stage "' + stage + '":',
                       e && e.name, '-', e && e.message, e);
          this._loggedWorkletFailure = true;
        }
        this._streamForceFallback = true;
        this._streamWorkletNode = null;
        return false;
      } finally {
        this._streamInitPromise = null;
      }
    })();

    return this._streamInitPromise;
  }

  _enqueuePCMToStreamingWorklet(buffer, channels) {
    if (!this._streamWorkletNode) return false;
    try {
      const pcm = new Float32Array(buffer);
      this._streamWorkletNode.port.postMessage({
        type: 'push',
        pcm,
        channels: channels === 2 ? 2 : 1,
      });
      return true;
    } catch (e) {
      console.warn('[Audio] Worklet enqueue failed:', e);
      return false;
    }
  }

  _logFallbackPlaybackOnce() {
    if (!this._loggedFallbackPlayback) {
      console.log('[Audio] Using fallback AudioBufferSourceNode playback');
      this._loggedFallbackPlayback = true;
    }
  }

  /**
   * Convert a block to the graph's sample rate, carrying filter state across
   * blocks. Returns the input untouched when the rates already agree, which is
   * the normal case and costs one comparison.
   */
  _toGraphRate(buffer, channels, inRate, outRate) {
    if (inRate === outRate) return buffer;
    const r = this._resampler;
    if (!r || r.inRate !== inRate || r.outRate !== outRate || r.channels !== channels) {
      this._resampler = new PolyResampler(inRate, outRate, channels);
    }
    return this._resampler.process(buffer);
  }

  playPCM(buffer, playTime, sampleRate, scale, channels = 1) {  // ✅ ADDED: channels parameter
    if (!this.audioInputNode) {
      console.warn('Audio not initialized');
      return 0;
    }

    const inFrames = (channels === 2) ? Math.floor(buffer.length / 2) : buffer.length;
    if (inFrames <= 0) return 0;

    // Duration is a property of the stream, not of the representation:
    // resampling changes the frame count and never the seconds. The scheduler
    // above is driven by this, so it must be computed from the stream rate.
    const streamRate = this.audioOutputSps || sampleRate || 12000;
    const blockSeconds = inFrames / streamRate;

    const graphRate = this._graphSampleRate();
    buffer = this._toGraphRate(buffer, channels, streamRate, graphRate);
    const frames = (channels === 2) ? Math.floor(buffer.length / 2) : buffer.length;
    if (frames <= 0) return blockSeconds;

    if (!this._streamForceFallback) {
      if (this._streamWorkletNode) {
        // Worklet already initialised — enqueue synchronously and return.
        // IMPORTANT: do NOT also enqueue via an async .then() path.  Because
        // _ensureStreamingWorklet() is async, the previous implementation ran
        // both the .then() callback (next microtask) AND the sync guard below
        // for the same buffer, sending every packet to the worklet twice.
        // That halved the effective maxBufferedSeconds, causing the ring buffer
        // to overflow in ~1.5 s and backing up the WebSocket receive queue.
        if (this._enqueuePCMToStreamingWorklet(buffer, channels)) {
          return blockSeconds;
        }
        // Enqueue failed — fall through to AudioBufferSourceNode fallback.
        this._streamForceFallback = true;
        this._streamWorkletNode = null;
      } else {
        // Not yet initialised — kick off async init; drop this frame (first-time only).
        this._ensureStreamingWorklet().catch((e) => {
          if (!this._loggedWorkletFailure) {
            console.warn('[Audio] AudioWorklet init failed, falling back:', e);
            this._loggedWorkletFailure = true;
          }
          this._streamForceFallback = true;
          this._streamWorkletNode = null;
        });
        // Advance playTime correctly even though we dropped the frame.
        return blockSeconds;
      }
    }

    this._logFallbackPlaybackOnce();
    
    const source = new AudioBufferSourceNode(this.audioCtx);
    // Built at the GRAPH's rate because _toGraphRate has already converted the
    // samples. Declaring the stream rate here instead would ask the browser to
    // resample each buffer a second time, in isolation — the per-packet
    // resampling whose boundary artefacts this whole path exists to avoid.
    const audioBuffer = new AudioBuffer({
      length: frames,
      numberOfChannels: channels,
      sampleRate: graphRate
    });

    if (channels === 2) {
      const L = new Float32Array(frames);
      const R = new Float32Array(frames);
      for (let i = 0; i < frames; i++) {
        L[i] = buffer[2 * i];
        R[i] = buffer[2 * i + 1];
      }
      audioBuffer.copyToChannel(L, 0, 0);
      audioBuffer.copyToChannel(R, 1, 0);
    } else {
      audioBuffer.copyToChannel(buffer, 0, 0);
    }

    source.buffer = audioBuffer;
    source.connect(this.audioInputNode);

    // Safety net only. decode() now guarantees playTime is ahead of the clock
    // on this path, but a caller that scheduled into the past would otherwise
    // get its chunk silently collapsed onto "now" — and several of those in a
    // row is the overlap that used to make this path sound distorted.
    const scheduledTime = Math.max(playTime, this.audioCtx.currentTime);
    let safetyTimerId = null;
    let disconnected = false;
    const disconnect = () => {
      if (!disconnected) {
        disconnected = true;
        if (safetyTimerId !== null) {
          clearTimeout(safetyTimerId);
          safetyTimerId = null;
        }
        try { source.disconnect(); } catch (_) {}
      }
    };

    source.onended = disconnect;
    const safetyTimeout = (audioBuffer.duration + 1) * 1000;
    safetyTimerId = setTimeout(disconnect, safetyTimeout);

    try {
      source.start(scheduledTime);
    } catch (e) {
      console.error('Failed to start audio source:', e);
      disconnect();
      return 0;
    }

    // The duration actually scheduled, not the stream-domain one.
    //
    // On this path each block is its own source node and the next is scheduled
    // at playTime + this value, so the two must butt together to the sample. A
    // resampler emits a whole number of frames, so with a non-integer rate
    // ratio the block length alternates — 882 frames then 883 at 44.1 kHz —
    // while the stream-domain duration stays fixed. Advancing by the fixed
    // value would leave a fraction of a frame of gap or overlap at every
    // boundary, and a defect repeating at the packet rate is a buzz.
    //
    // There is no drift in doing this: the resampler's output rate tracks the
    // input exactly over time, so these durations sum to the true one. Where
    // no resampling happens they are identical anyway.
    return frames / graphRate;
  }

  startRecording() {
    if (this.isRecording) return;

    this.isRecording = true;
    this.recordedAudio = [];  // ✅ FIXED: Clear previous recording
    this.recordingStartTime = Date.now();  // ✅ FIXED: Track start time
    this.recordedChunks = [];

    // Container negotiation.
    //
    // This used to be `new MediaRecorder(stream)` with the resulting blob
    // hard-labelled 'audio/webm' further down. Safari has never supported
    // WebM — on iOS the recorder emits MP4/AAC, so the blob carried a
    // container label that did not match its bytes, and decodeAudioData()
    // could reject it outright.
    //
    // Ask the browser what it can actually produce, most-preferred first, and
    // remember the answer for downloadRecording(). Chrome and Firefox take the
    // first entry; Safari falls through to MP4.
    const RECORDER_TYPES = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4;codecs=mp4a.40.2',   // Safari / iOS
      'audio/mp4',
      'audio/ogg;codecs=opus'
    ];

    let chosenType = '';
    if (typeof MediaRecorder !== 'undefined' &&
        typeof MediaRecorder.isTypeSupported === 'function') {
      for (const t of RECORDER_TYPES) {
        if (MediaRecorder.isTypeSupported(t)) { chosenType = t; break; }
      }
    }

    this.mediaRecorder = chosenType
      ? new MediaRecorder(this.destinationNode.stream, { mimeType: chosenType })
      : new MediaRecorder(this.destinationNode.stream);   // let the browser decide

    // Prefer what the recorder reports over what we asked for — they can differ,
    // and the reported value is the one that describes the bytes we receive.
    this.recordingMimeType =
      this.mediaRecorder.mimeType || chosenType || 'audio/webm';

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        this.recordedChunks.push(event.data);
      }
    };

    this.mediaRecorder.start();
    console.log('[Recording] Started (max duration: ' + 
                (this.maxRecordingDuration / 60) + ' minutes)');
  }

  stopRecording() {
    if (!this.isRecording) return;

    this.isRecording = false;
    this.mediaRecorder.stop();
  }

  downloadRecording() {
    if (this.recordedChunks.length === 0) {
      console.warn('No recorded audio to download');
      return;
    }

    // Label the blob with the container the recorder actually produced (set in
    // startRecording), not a hardcoded guess — otherwise decodeAudioData() is
    // handed MP4 bytes claiming to be WebM on Safari/iOS.
    const blob = new Blob(this.recordedChunks, {
      type: this.recordingMimeType || 'audio/webm'
    });

    // Timestamp for the saved file
    const audioDate = new Date();
    const audioFullDate = audioDate.getFullYear() + '-' +
                          (audioDate.getMonth() + 1) + '-' + audioDate.getDate();
    const audioTime = audioDate.getHours() + '-' +
                      audioDate.getMinutes() + '-' + audioDate.getSeconds();
    const timeStamp = audioFullDate + '_' + audioTime;

    // Convert blob to ArrayBuffer, decode, and re-encode as WAV.
    blob.arrayBuffer().then(arrayBuffer => {
      return this.audioCtx.decodeAudioData(arrayBuffer).then(audioBuffer => {
        const wavFile = this.createWavFile(audioBuffer);
        this._saveBlob(new Blob([wavFile], { type: 'audio/wav' }),
                       'recorded_audio_' + timeStamp + '_.wav');
      });
    }).catch(err => {
      // Previously there was no catch at all, so a decode failure vanished
      // silently and the operator simply never got a file. Rather than lose
      // the recording, save it in whatever container the recorder produced —
      // still playable, just not WAV.
      console.error('[Recording] Could not convert to WAV, saving original:', err);
      const ext = /mp4/.test(blob.type) ? 'm4a'
                : /ogg/.test(blob.type) ? 'ogg'
                : 'webm';
      try {
        this._saveBlob(blob, 'recorded_audio_' + timeStamp + '_.' + ext);
      } catch (e) {
        console.error('[Recording] Could not save the recording at all:', e);
      }
    });
  }

  /**
   * Trigger a file download for a Blob.
   *
   * revokeObjectURL() used to run synchronously right after click(), which can
   * cancel the download before it starts on Safari — the URL is torn down while
   * the browser is still reading it. Defer the revoke and remove the anchor.
   */
  _saveBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      try { URL.revokeObjectURL(url); } catch (e) {}
      if (a.parentNode) a.parentNode.removeChild(a);
    }, 10000);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Video + audio recording
  //
  // Reuses the same demodulated audio the WAV recorder uses (destinationNode),
  // muxed with a composite of the waterfall canvas stack. Independent of
  // startRecording(), so audio-only and video recording can run side by side.
  // ═══════════════════════════════════════════════════════════════════════════

  isVideoRecordingSupported() {
    return VideoRecorder.isSupported();
  }

  startVideoRecording({ layers, getCaption, onAutoStop, crop } = {}) {
    if (this.videoRecorder && this.videoRecorder.isRecording) return false;

    if (!this.audioCtx || !this.gainNode) {
      console.warn('[VideoRecording] Audio graph not ready, start audio first');
      return false;
    }

    // Deliberately NOT reusing this.destinationNode (the WAV recorder's node):
    // this keeps the video recorder from sharing a track with the WAV recorder.
    this._teardownVideoAudioTap();
    try {
      this.videoDestinationNode = new MediaStreamAudioDestinationNode(this.audioCtx);
      this.gainNode.connect(this.videoDestinationNode);
    } catch (e) {
      console.warn('[VideoRecording] Could not create audio tap:', e);
      this.videoDestinationNode = null;
      return false;
    }

    // The receiver's AudioContext runs at audioOutputSps (12 kHz typically).
    // MediaRecorder's Opus encoder wants 48 kHz, and when it is handed a
    // low-rate track alongside a video track it produces a silent audio channel
    // rather than resampling. The WAV recorder never hits this because it
    // records audio-only and re-decodes the result itself.
    //
    // A MediaStreamAudioSourceNode resamples whatever stream it is given up to
    // its own context's rate, so bouncing the tap through a second context
    // pinned at 48 kHz yields a track the encoder accepts. This is a native
    // context on purpose: the `AudioContext` imported at the top of this file
    // is the standardized-audio-context wrapper, and all we need here is a
    // plain resampler.
    const audioStream = this._resampleTo48k(this.videoDestinationNode.stream);

    const tracks = audioStream.getAudioTracks();
    console.log(
      '[VideoRecording] Audio tap: ' + tracks.length + ' track(s)' +
      (tracks[0]
        ? ' readyState=' + tracks[0].readyState + ' enabled=' + tracks[0].enabled +
          ' muted=' + tracks[0].muted
        : '') +
      ' src=' + this.audioCtx.sampleRate + 'Hz' +
      ' rec=' + (this.videoAudioCtx ? this.videoAudioCtx.sampleRate + 'Hz' : 'unresampled') +
      ' ctx=' + this.audioCtx.state
    );

    this.videoRecorder = new VideoRecorder({
      fps: 25,
      maxDurationSec: this.maxVideoRecordingDuration,
    });

    // Identifies this take. onStopped fires asynchronously, so a previous
    // take's flush can land after the next one has already built its tap —
    // without this check it would tear the new tap down and mute the recording.
    const session = (this._videoSession = (this._videoSession || 0) + 1);

    const started = this.videoRecorder.start({
      audioStream,
      layers,
      getCaption,
      onAutoStop,
      crop,
      // Keep the tap and the resampler alive until the encoder has flushed,
      // otherwise the tail of the recording is cut off.
      onStopped: () => {
        if (this._videoSession === session) this._teardownVideoAudioTap();
      },
    });

    if (!started) this._teardownVideoAudioTap();
    return started;
  }

  // Bounce a low-rate stream through a 48 kHz context so MediaRecorder's Opus
  // encoder accepts it. Falls back to the original stream if a context cannot
  // be created, which is still better than failing the recording.
  //
  // The context is created once and reused for the life of the page. Browsers
  // cap how many AudioContexts a page may hold (Chrome allows about six) and
  // close() only frees the slot asynchronously, so building a fresh one per
  // recording starts throwing after a handful of takes — the resampler then
  // silently falls back to the 12 kHz tap and the audio goes quiet again until
  // a reload. Only the source/destination nodes are per-recording.
  _resampleTo48k(stream) {
    const NativeAudioContext =
      typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
    if (!NativeAudioContext) return stream;

    try {
      if (!this.videoAudioCtx || this.videoAudioCtx.state === 'closed') {
        this.videoAudioCtx = new NativeAudioContext({ sampleRate: 48000 });
      }
      // Reached from a click handler, so this should already be running; resume
      // anyway because a suspended context silently emits nothing.
      if (this.videoAudioCtx.state === 'suspended') {
        this.videoAudioCtx.resume().catch(() => {});
      }
      this.videoResampleSource = this.videoAudioCtx.createMediaStreamSource(stream);
      this.videoResampleDest = this.videoAudioCtx.createMediaStreamDestination();
      this.videoResampleSource.connect(this.videoResampleDest);
      return this.videoResampleDest.stream;
    } catch (e) {
      console.warn('[VideoRecording] 48 kHz resample unavailable, using raw tap:', e);
      this._teardownResampler();
      return stream;
    }
  }

  // Drops the per-recording nodes but keeps the context for the next take.
  _teardownResampler() {
    try { if (this.videoResampleSource) this.videoResampleSource.disconnect(); } catch (e) {}
    try { if (this.videoResampleDest) this.videoResampleDest.disconnect(); } catch (e) {}
    this.videoResampleSource = null;
    this.videoResampleDest = null;
  }

  // Full release of the resample context. Only for tearing the client down —
  // routine stop/reset keeps the context so it can be reused.
  _closeResampleContext() {
    this._teardownResampler();
    if (this.videoAudioCtx) {
      try {
        if (this.videoAudioCtx.state !== 'closed') this.videoAudioCtx.close();
      } catch (e) {
        /* already closing */
      }
    }
    this.videoAudioCtx = null;
  }

  // Drop the dedicated recording tap off the output chain. Safe to call when no
  // tap exists; never touches the shared destinationNode used for playback.
  _teardownVideoAudioTap() {
    this._teardownResampler();
    if (!this.videoDestinationNode) return;
    try {
      if (this.gainNode) this.gainNode.disconnect(this.videoDestinationNode);
    } catch (e) {
      /* already disconnected, or the context is closing */
    }
    this.videoDestinationNode = null;
  }

  stopVideoRecording() {
    if (!this.videoRecorder || !this.videoRecorder.isRecording) {
      this._teardownVideoAudioTap();
      return;
    }
    // Teardown runs from the recorder's onStopped hook once the encoder has
    // flushed; tearing down here would truncate the final chunk.
    this.videoRecorder.stop();
  }

  downloadVideoRecording() {
    if (!this.videoRecorder) {
      console.warn('[VideoRecording] No recorded video to download');
      return;
    }
    this.videoRecorder.download();
  }

  // Drop everything held by the video recorder so the next take starts clean:
  // stops any capture in progress, releases the encoded chunks (the only part
  // that is actually large), and unhooks the tap. The 48 kHz context is kept on
  // purpose — see _resampleTo48k.
  resetVideoRecording() {
    // Bump first: any in-flight onStopped from the take being discarded must
    // not run against the state we are about to rebuild.
    this._videoSession = (this._videoSession || 0) + 1;
    if (this.videoRecorder) {
      try {
        this.videoRecorder.dispose();
      } catch (e) {
        console.warn('[VideoRecording] dispose error', e);
      }
      this.videoRecorder = null;
    }
    this._teardownVideoAudioTap();
    console.log('[VideoRecording] Reset');
  }

  // Same idea for the WAV recorder: stop it and release the buffered chunks.
  resetAudioRecording() {
    try {
      if (this.isRecording) this.stopRecording();
    } catch (e) {
      console.warn('[Recording] stop error', e);
    }
    this.isRecording = false;
    this.recordedChunks = [];
    this.recordedAudio = [];
    this.mediaRecorder = null;
  }

  createWavFile(audioBuffer) {
    const numChannels = audioBuffer.numberOfChannels;
    const sampleRate = audioBuffer.sampleRate;
    const format = 1; // PCM
    const bitsPerSample = 16;
    const bytesPerSample = bitsPerSample / 8;
    const blockAlign = numChannels * bytesPerSample;
    const byteRate = sampleRate * blockAlign;
    const dataSize = audioBuffer.length * blockAlign;
    const bufferSize = 44 + dataSize;
    const arrayBuffer = new ArrayBuffer(bufferSize);
    const view = new DataView(arrayBuffer);

    const writeString = (view, offset, string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };

    // Write WAV header
    writeString(view, 0, 'RIFF');
    view.setUint32(4, bufferSize - 8, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, format, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitsPerSample, true);
    writeString(view, 36, 'data');
    view.setUint32(40, dataSize, true);

    // Write audio data
    const offset = 44;
    for (let i = 0; i < audioBuffer.numberOfChannels; i++) {
      const channel = audioBuffer.getChannelData(i);
      for (let j = 0; j < channel.length; j++) {
        const sample = Math.max(-1, Math.min(1, channel[j]));
        view.setInt16(offset + (j * numChannels + i) * bytesPerSample, sample * 0x7FFF, true);
      }
    }

    return arrayBuffer;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  RADE v1  (Radio AutoencoDEr — FreeDV flagship HF digital voice)
  //
  //  Architecture:
  //    playAudio() taps raw SSB PCM → sends over WebSocket to rade_helper.py
  //    rade_helper.py pipes it into `freedv_rx RADEV1 - -` (or RADE_CMD env)
  //    Decoded f32 PCM @ 16000 Hz returns and is played via _radePlayPCM()
  //
  //  Sideband convention:
  //    RADEL → LSB (HF bands ≤ 10 MHz: 160m, 80m, 40m)
  //    RADEU → USB (HF bands > 10 MHz: 20m, 17m, 15m, 10m)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Enable or disable RADE v1 decoding via the rade_helper.py sidecar.
   * @param {boolean} enabled
   * @param {string}  sideband  'USB' (RADEU) or 'LSB' (RADEL)
   * @param {string}  [uri]     Sidecar WebSocket URI; default ws://host:8074
   */
  setRADEDecoding(enabled, sideband, uri) {
    if (!enabled) {
      this.decodeRADE = false;
      this._radeReady = false;
      this._rebuildOutputChain();

      // Stop any already-scheduled/playing RADE decoded audio immediately.
      // Without this, queued RADE chunks can keep sounding briefly while raw
      // receiver audio resumes, which makes the audio sound scattered.
      if (this._radeSources && this._radeSources.size) {
        for (const src of this._radeSources) {
          try { src.stop(0); } catch (e) {}
          try { src.disconnect(); } catch (e) {}
        }
        this._radeSources.clear();
      }

      this._radeNextTime = 0;
      if (this._radeSocket) {
        try { this._radeSocket.close(); } catch (e) {}
        this._radeSocket = null;
      }
      console.log('[RADE] \u25a0 DISABLED');
      return;
    }

    this._radeSideband = sideband || 'USB';
    var helperUri = uri || ('ws://' + window.location.hostname + ':8074');

    try {
      var ws = new WebSocket(helperUri);
      ws.binaryType = 'arraybuffer';

      ws.onopen = () => {
        // Report the ACTUAL delivered audio rate, not the nominal configured
        // one. audioOutputSps == audioMaxSps is fixed regardless of fft_size;
        // trueAudioSps is the real fft-bin-quantized rate the channelizer
        // produces and is what actually arrives on this socket. Sending the
        // nominal value here makes rade_helper.py's resample-to-8000 ratio
        // wrong whenever fft_size changes, which desyncs RADE's frame sync.
        //
        // IMPORTANT: do NOT use `this.trueAudioSps || fallback` — 0 is falsy
        // in JS, and a degenerate trueAudioSps (0/NaN, meaning the server
        // couldn't allocate enough bins for the channel at this fft_size)
        // would silently be replaced by the nominal value, hiding a real
        // channelizer failure behind what looks like a normal rate.
        var radeReportedSps;
        if (Number.isFinite(this.trueAudioSps) && this.trueAudioSps > 0) {
          radeReportedSps = this.trueAudioSps;
        } else {
          radeReportedSps = this.audioOutputSps || 8000;
          console.warn('[RADE] trueAudioSps is invalid (', this.trueAudioSps,
                       ') at fft_size=', this.fftSize, 'fft_result_size=', this.audioMaxSize,
                       '\u2014 falling back to nominal', radeReportedSps,
                       '\u2014 channelizer likely cannot build a usable channel at this fft_size');
        }
        ws.send(JSON.stringify({
          type:     'init',
          sps:      radeReportedSps,
          sideband: this._radeSideband,
        }));
        this._radeReady = true;
        this.decodeRADE = true;
        this._rebuildOutputChain();
        console.log('[RADE] \u25ba ENABLED', this._radeSideband,
                    '@', radeReportedSps, 'Hz (true) \u2192 helper', helperUri);
        if (this._radeCallback)
          this._radeCallback({ type: 'status', connected: true });
      };

      ws.onmessage = (event) => {
        if (event.data instanceof ArrayBuffer) {
          // Binary frame = decoded f32 PCM speech @ 16000 Hz (from lpcnet_demo)
          this._radePlayPCM(new Float32Array(event.data));
        } else {
          // Text frame = JSON status / error from the sidecar
          try {
            var msg = JSON.parse(event.data);
            if (this._radeCallback) this._radeCallback(msg);
          } catch (e) {}
        }
      };

      ws.onerror = () => {
        console.warn('[RADE] sidecar socket error');
        if (this._radeCallback)
          this._radeCallback({ type: 'error', msg: 'RADE sidecar unreachable — is rade_helper.py running on port 8074?' });
      };

      ws.onclose = () => {
        this._radeReady = false;
        this.decodeRADE = false;
        if (this._radeSocket === ws) this._radeSocket = null;
        console.log('[RADE] socket closed');
        if (this._radeCallback)
          this._radeCallback({ type: 'status', connected: false });
      };

      this._radeSocket = ws;
    } catch (e) {
      console.error('[RADE] failed to open sidecar socket:', e);
    }
  }

  /** Register a callback for RADE status/error events from the sidecar.
   *  Events: {type:'status', connected:bool}  {type:'error', msg:str} */
  setRADECallback(fn) {
    this._radeCallback = fn || null;
  }

  /** Play f32 mono PCM @ 16000 Hz returned by the RADE sidecar.
   *  Uses a scheduled playback queue so chunks play back-to-back without
   *  gaps. Each chunk is scheduled to start exactly where the previous one
   *  ended, using AudioContext.currentTime as a running clock.
   *  A small look-ahead (0.05 s) prevents underruns from scheduler jitter. */
  _radePlayPCM(samples) {
    if (!this.audioCtx || samples.length === 0) return;
    if (this.audioCtx.state !== 'running') return;
    try {
      var SAMPLE_RATE  = 16000;
      var LOOKAHEAD    = 0.05;   // seconds ahead of now to schedule if queue is empty
      var now          = this.audioCtx.currentTime;

      // If the queue has fallen behind (gap, first chunk, or long silence),
      // restart scheduling from now + lookahead
      if (this._radeNextTime < now + 0.01) {
        this._radeNextTime = now + LOOKAHEAD;
      }

      var buf = this.audioCtx.createBuffer(1, samples.length, SAMPLE_RATE);
      buf.getChannelData(0).set(samples);

      var src = this.audioCtx.createBufferSource();
      src.buffer = buf;

      // Route RADE through its own gain stage first so recorded RADE level
      // can be trimmed independently from the normal receiver audio path.
      if (this.radeGainNode) {
        src.connect(this.radeGainNode);
      } else {
        src.connect(this.audioCtx.destination);
      }

      // Track each RADE source so disabling RADE can cancel queued playback cleanly.
      this._radeSources.add(src);

      src.start(this._radeNextTime);
      src.onended = () => {
        if (this._radeSources) this._radeSources.delete(src);
        try { src.disconnect(); } catch (_) {}
      };

      // Advance the clock by the exact duration of this chunk
      this._radeNextTime += samples.length / SAMPLE_RATE;
    } catch (e) {
      console.error('[RADE] playback error', e);
    }
  }


  // ═══════════════════════════════════════════════════════════════════════════
  //  SSTV DECODER  (best-effort Kiwi-style browser path)
  //
  //  Design goals for PhantomSDR-Plus:
  //   • always consume RAW PCM before mute / AGC / NR / DSP
  //   • jitter buffer so browser scheduling does not tear lines
  //   • VIS decode when present
  //   • auto-mode fallback when VIS is damaged or missing
  //   • soft sync recovery: keep line clock running even if a sync pulse fades
  //
  //  Supported receive modes in this implementation:
  //   Martin M1 / M2, Scottie S1 / S2 (the most common on HF)
  // ═══════════════════════════════════════════════════════════════════════════

  setSSTVDecoding(enabled) {
    this.decodeSSTV = !!enabled;
    this._rebuildOutputChain();
    if (this._sstvDecoder) this._sstvDecoder.setEnabled(this.decodeSSTV);
    if (!this.decodeSSTV && this._sstvDecoder) this._sstvDecoder.reset({ mode: this._sstvForcedMode || 'auto' });
    console.log('[SSTV]', enabled ? '▶ ENABLED' : '■ DISABLED');
  }

  setSSTVCallback(fn) {
    this.sstvCallback = fn || null;
    if (this._sstvDecoder) this._sstvDecoder.setCallback(this.sstvCallback);
  }

  setSSTVMode(mode) {
    this._sstvForcedMode = mode || 'auto';
    if (this._sstvDecoder) this._sstvDecoder.setMode(this._sstvForcedMode);
  }

  /** Operator override: draw now in the selected mode, skipping detection. */
  forceSSTVStart(mode = null) {
    const key = mode || this._sstvForcedMode;
    if (!key || key === 'auto') return false;
    if (!this._sstvDecoder || typeof this._sstvDecoder.forceStartNow !== 'function') return false;
    this._sstvDecoder.forceStartNow(key);
    return true;
  }

  resetSSTVDecoder(mode = null) {
    if (mode != null) this._sstvForcedMode = mode || 'auto';

    this.setSSTVDecoding(false);
    this.setSSTVCallback(null);

    if (this._sstvDecoder) {
      if (typeof this._sstvDecoder.setMode === 'function') {
        this._sstvDecoder.setMode(this._sstvForcedMode || 'auto');
      }
      if (typeof this._sstvDecoder.reset === 'function') {
        this._sstvDecoder.reset({ mode: this._sstvForcedMode || 'auto' });
      }
    }
  }

  _sstvReset() {
    this.resetSSTVDecoder();
  }

  _sstvFeedPCM(pcm) {
    if (this._sstvDecoder) this._sstvDecoder.feedPCM(pcm);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  HF FAX / WEFAX DECODER  (ITU-T T.4 / CCIR 574)
  //
  //  Standard parameters:
  //    Black tone : 1500 Hz  (USB-demodulated audio)
  //    White tone : 2300 Hz  (shift = 800 Hz)
  //    Center freq: 1900 Hz  (FM discriminator reference)
  //    LPM        : 120  (lines per minute — most HF stations)
  //    IOC        : 576  (index of co-operation → π×IOC ≈ 1810 pixels/line)
  //    Start tone : 300 Hz alternating phasing (~5 min before image)
  //    Stop  tone : 450 Hz alternating phasing (~5 sec after image)
  //
  //  Algorithm: quadrature FM discriminator (mix → lowpass → atan2 derivative)
  //  followed by sub-sample pixel accumulation and optional sync-pulse
  //  auto-alignment.
  // ═══════════════════════════════════════════════════════════════════════════

  // The decoder itself lives in fax.js and runs inside fax.worker.js; these are
  // thin wrappers over FAXWorkerProxy so every call site above is unchanged.

  /** Enable or disable the FAX decoder.  Resets all internal DSP state. */
  setFAXDecoding(enabled) {
    this.decodeFAX = !!enabled;
    // Always reset: rebuilds the filters and line timing at the current
    // audioOutputSps.  Operator parameters (LPM/IOC/shift/auto-align) survive —
    // see the note on KiwiFAXDecoder.reset().
    this._faxDecoder.reset();
    this._faxDecoder.setEnabled(this.decodeFAX);
    console.log('[FAX]', enabled ? '▶ ENABLED' : '■ DISABLED');
  }

  /**
   * Register callback for decoded line events.
   *   { type:'line', pixels:Uint8Array, lineNum:number, phasing:bool, stopTone:bool }
   */
  setFAXCallback(fn) {
    this.faxCallback = fn || null;
  }

  /**
   * Set FAX parameters (live, no canvas/image reset).
   * @param {number} lpm   Lines per minute (60 | 90 | 100 | 120 | 240)
   * @param {number} ioc   Index of co-operation (288 | 576)
   * @param {number} shift Frequency shift Hz (400 | 800)
   */
  setFAXParams(lpm, ioc, shift) {
    this._faxDecoder.setParams(lpm, ioc, shift);
  }

  /** Enable / disable automatic sync-pulse line alignment. */
  setFAXAutoAlign(enabled) {
    this._faxDecoder.setAutoAlign(enabled);
  }

  _faxReset() {
    this._faxDecoder.reset();
  }

  _faxFeedPCM(pcm, inputSampleRate = null) {
    this._faxDecoder.feedPCM(pcm, inputSampleRate);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  END HF FAX DECODER
  // ═══════════════════════════════════════════════════════════════════════════

  // ═══════════════════════════════════════════════════════════════════════════

  // ── CW decoder (delegates to the soft-decision CWDecoder module) ──────────
  _cwReset() {
    if (!this.cw) {
      this.cw = new CWWorkerProxy({
        sampleRate: this.audioOutputSps || 12000,
        callback: (event) => {
          if (typeof this.cwCallback === 'function') this.cwCallback(event);
        },
      });
    } else {
      this.cw.setSampleRate(this.audioOutputSps || 12000);
      this.cw.reset();
    }
    this.cw.setEnabled(!!this.decodeCW);
  }

  setCWDecoding(value) {
    this.decodeCW = value;
    this._rebuildOutputChain();
    if (value) this._cwReset();
    else if (this.cw) this.cw.setEnabled(false);
  }

  setCWCallback(cb) {
    this.cwCallback = cb;
  }

  _cwFeedPCM(pcmArray) {
    if (!this.cw) this._cwReset();
    this.cw.setSampleRate(this.audioOutputSps || 12000);
    this.cw.feed(pcmArray);
  }


  // Mono copy of an audio buffer for the spectrogram / QRSS displays.
  //
  // Both expect a MONO stream at the audio sample rate. In C-QUAM the buffer is
  // interleaved stereo [L0,R0,L1,R1,...]; feeding that in makes the FFT read the
  // L-R difference component modulated near Nyquist and fold it back over the
  // audio band, producing a false "hole" around 2.7-3.5 kHz (seen only in
  // QUAM). Downmix to (L+R)/2 — the same sum the ear hears.
  //
  // Always a copy, never a view: the caller's buffer belongs to the audio
  // pipeline, and the consumers keep what they are handed.
  _monoForDisplay(pcm) {
    if (this.channels === 2) {
      const frames = pcm.length >> 1;
      const out = new Float32Array(frames);
      for (let i = 0; i < frames; i++) {
        out[i] = 0.5 * (pcm[i * 2] + pcm[i * 2 + 1]);
      }
      return out;
    }
    return new Float32Array(pcm);
  }

  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Set spectrogram callback for feeding PCM data
   * This is called from App.svelte to register the spectrogram component
   * @param {function} callback - Function to call with PCM data
   */
  setSpectrogramCallback(callback) {
    this.spectrogramCallback = callback;
    this.spectrogramEnabled = !!callback;
    console.log('Spectrogram callback', this.spectrogramEnabled ? 'enabled' : 'disabled');
  }

  /**
   * Enable/disable spectrogram
   * @param {boolean} enabled - Whether to enable spectrogram
   */
  setSpectrogramEnabled(enabled) {
    this.spectrogramEnabled = enabled && !!this.spectrogramCallback;
    console.log('Spectrogram', this.spectrogramEnabled ? 'enabled' : 'disabled');
  }

  /**
   * Set the QRSS grabber callback.  Receives the same mono PCM stream as the
   * spectrogram, at audioOutputSps; the grabber does its own long-FFT.
   * @param {function} callback - Function to call with PCM data, or null
   */
  setQRSSCallback(callback) {
    this.qrssCallback = callback;
    this.qrssEnabled = !!callback;
    console.log('QRSS callback', this.qrssEnabled ? 'enabled' : 'disabled');
  }

  /**
   * Enable/disable the QRSS grabber feed without dropping the callback.
   * @param {boolean} enabled
   */
  setQRSSEnabled(enabled) {
    this.qrssEnabled = enabled && !!this.qrssCallback;
    console.log('QRSS', this.qrssEnabled ? 'enabled' : 'disabled');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  NAVTEX / SITOR-B + generic FSK (RTTY / ITA2)
  //
  //  The engine lives in fsk.js and runs inside fsk.worker.js.  NAVTEX and FSK
  //  are two instances of it — one per role, each behind its own FSKWorkerProxy,
  //  so they no longer share state.  These are thin wrappers; every call site
  //  above and in the UI is unchanged.
  // ═══════════════════════════════════════════════════════════════════════════

  setNAVTEXDecoding(enabled) {
    this.decodeNAVTEX = !!enabled;
    this._navtexDecoder.setEnabled(this.decodeNAVTEX);
    console.log('[NAVTEX]', enabled ? '▶ ENABLED' : '■ DISABLED');
  }

  setNAVTEXCallback(fn) {
    this.navtexCallback = fn || null;
  }

  // setEnabled() resets the engine, which is what the old _navtexReset() did.
  _navtexReset() {
    this._navtexDecoder.setEnabled(this.decodeNAVTEX);
  }

  _navtexFeedPCM(pcm) {
    if (!this.decodeNAVTEX) return;
    this._navtexDecoder.feedPCM(pcm);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  //  Mode identifier
  // ═══════════════════════════════════════════════════════════════════════════

  /** Enable/disable the identifier.  Costs nothing at all while off. */
  setModeIDDecoding(enabled) {
    this.decodeModeID = !!enabled;
    this._modeIdEngine.setEnabled(this.decodeModeID);
    console.log('Mode identifier', this.decodeModeID ? 'enabled' : 'disabled');
  }

  /**
   * Discard the identifier's history.  The averaged spectrum and the 130 s
   * cadence buffer describe wherever the dial used to be, so retuning without
   * this would blend two different signals for minutes.
   */
  resetModeID() {
    this._modeIdEngine.reset();
  }

  /** Receives { t:'result', ready, fill, candidates, features } about 1/s. */
  setModeIDCallback(fn) {
    this.modeIDCallback = typeof fn === 'function' ? fn : null;
  }

  setFSKVariant(variant = 'maritime') {
    const v = String(variant || 'maritime').toLowerCase();
    if (v !== 'weather' && v !== 'maritime' && v !== 'ham' &&
        v !== 'psk31' && v !== 'olivia') {
      console.warn('[FSK] unknown variant:', variant, '— using maritime');
      this.fskVariant = 'maritime';
    } else {
      this.fskVariant = v;
    }
    // No log here: the decoder logs variant/config itself once it has actually
    // applied them (fsk.js), which is the state worth seeing.  Logging on both
    // sides printed every line twice.
    this._fskDecoder.setVariant(this.fskVariant);
  }

  setFSKConfig(cfg = null) {
    this._fskDecoder.setConfig(cfg);
  }

  getFSKConfig() {
    return this._fskDecoder.getConfig();
  }

  setFSKDecoding(enabled, variant = null) {
    if (variant) this.setFSKVariant(variant);
    this.decodeFSK = !!enabled;
    this._fskDecoder.setEnabled(this.decodeFSK);
    console.log(`[FSK] ${enabled ? '▶ ENABLED' : '■ DISABLED'} (${this.fskVariant})`);
  }

  setFSKCallback(fn) {
    this.fskCallback = fn || null;
  }

  setFSKAutoShift(enabled) {
    this._fskDecoder.setAutoShift(enabled);
  }

  // Trigger a one-shot auto-center scan on the next available PCM buffer.
  // Called from the UI "Auto-tune" button.
  setFSKAutoCenter(enabled) {
    this._fskDecoder.setAutoCenter(enabled);
  }

  _fskReset() {
    this._fskDecoder.setEnabled(this.decodeFSK);
  }

  _fskFeedPCM(pcm) {
    if (!this.decodeFSK) return;
    this._fskDecoder.feedPCM(pcm);
  }

}