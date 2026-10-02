// src/lib/opusMlDecoder.js
// Wrapper around @wasm-audio-decoders/opus-ml for raw Opus frames

// FIX (Bug 1): The original imported { OpusDecoder } which does not exist in
// @wasm-audio-decoders/opus-ml.  OpusDecoder belongs to @wasm-audio-decoders/opus.
// @wasm-audio-decoders/opus-ml exports OpusMLDecoder — use that instead.
import { OpusMLDecoder } from '@wasm-audio-decoders/opus-ml';

/**
 * OpusMlBrowserDecoder
 *
 * streamSampleRate  = actual Opus stream rate (MUST match encoder, e.g. 48000)
 * pipelineSampleRate = optional rate for your later DSP chain (e.g. 12000),
 *                      but by default we keep it == streamSampleRate so there
 *                      is NO pitch change.
 */
export class OpusMlBrowserDecoder {
  constructor({
    streamSampleRate,       // MUST be the same as OpusAudioEncoder sample rate
    pipelineSampleRate,     // optional: where you eventually want to run DSP
    channels = 1,
  }) {
    if (!streamSampleRate) {
      throw new Error('OpusMlBrowserDecoder: streamSampleRate is required');
    }

    this.streamSampleRate   = streamSampleRate;
    this.pipelineSampleRate = pipelineSampleRate || streamSampleRate;
    this.channels           = channels;
    this.onChunk            = null;

    // FIX (Bug 3): OpusMLDecoder is WASM-backed; the module may not be loaded
    // yet when the constructor returns.  The library exposes a `.ready` Promise
    // that must resolve before decodeFrame() is called.  We track readiness via
    // this.isReady and skip frames that arrive before it is set.
    this.isReady = false;

    // FIX (Bug 2): The original code used the streaming-callback API
    // ({ onDecode: cb } + decoder.decode()) which belongs to
    // @wasm-audio-decoders/opus, not opus-ml.  OpusMLDecoder uses the
    // synchronous decodeFrame(frame) API — the same pattern already used in
    // audio.js's OpusMLAdapter.
    this.decoder = new OpusMLDecoder({
      sampleRate:           this.streamSampleRate,
      channels:             this.channels,
      frameDuration:        10,    // 10 ms packets — sweet spot for HF
      forwardErrorCorrection: false,
      lowLatency:           true,
    });

    // Wait for WASM to load before marking the decoder ready.
    if (this.decoder && this.decoder.ready &&
        typeof this.decoder.ready.then === 'function') {
      this.decoder.ready
        .then(() => {
          this.isReady = true;
          console.log(
            `OpusMlBrowserDecoder ready (stream=${this.streamSampleRate} Hz, ` +
            `pipeline=${this.pipelineSampleRate} Hz, ch=${this.channels})`
          );
        })
        .catch((e) => {
          console.error('OpusMlBrowserDecoder: .ready rejected', e);
        });
    } else {
      // Library didn't provide a .ready Promise — assume synchronous init.
      this.isReady = true;
      console.log(
        `OpusMlBrowserDecoder created (stream=${this.streamSampleRate} Hz, ` +
        `pipeline=${this.pipelineSampleRate} Hz, ch=${this.channels})`
      );
    }
  }

  /**
   * Set callback that receives decoded PCM samples.
   * cb(pcm: Float32Array, sampleRate: number)
   * For stereo (channels=2) pcm is interleaved [L0, R0, L1, R1, …].
   */
  setOnChunk(cb) {
    this.onChunk = cb;
  }

  /**
   * Feed a chunk of raw Opus frame bytes (Uint8Array).
   * Decoded samples are delivered to the onChunk callback.
   */
  decode(chunk) {
    // FIX (Bug 3): drop frames that arrive before WASM has loaded.
    if (!this.isReady || !this.decoder) return;

    // Normalise input to Uint8Array — callers may pass ArrayBuffer or views.
    let frame;
    if (chunk instanceof Uint8Array) {
      frame = chunk;
    } else if (chunk instanceof ArrayBuffer) {
      frame = new Uint8Array(chunk);
    } else if (ArrayBuffer.isView(chunk)) {
      frame = new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.byteLength);
    } else {
      frame = new Uint8Array(chunk);
    }

    let result;
    try {
      // FIX (Bug 2): use decodeFrame() — the correct OpusMLDecoder API.
      result = this.decoder.decodeFrame(frame);
    } catch (e) {
      console.warn('OpusMlBrowserDecoder.decode error:', e);
      return;
    }

    if (!result || !result.channelData || result.channelData.length === 0) return;
    if (!this.onChunk) return;

    const sps = result.sampleRate || this.streamSampleRate;

    // FIX (Bug 4): the original callback used only channelData[0], silently
    // discarding the right channel when channels=2.  For mono, pass the single
    // channel as-is.  For stereo, interleave L and R so the caller receives a
    // standard [L0, R0, L1, R1, …] buffer consistent with the rest of the
    // C-QUAM pipeline.
    if (this.channels === 2 && result.channelData.length >= 2) {
      const L   = result.channelData[0];
      const R   = result.channelData[1];
      const len = Math.min(L.length, R.length);
      const pcm = new Float32Array(len * 2);
      for (let i = 0; i < len; i++) {
        pcm[i * 2]     = L[i];
        pcm[i * 2 + 1] = R[i];
      }
      this.onChunk(pcm, sps);
    } else {
      // Mono (or unexpected single-channel stereo result).
      this.onChunk(result.channelData[0], sps);
    }

    // If you later want to downsample to pipelineSampleRate (e.g. 12000),
    // do it in the onChunk handler or add a resample step here.
    // The pitch-safe way is to use the boxcar / linear-interpolation helpers
    // already present in audio.js's resampleAndGain().
  }

  /**
   * Free WASM memory when you want to tear down the decoder.
   */
  free() {
    if (this.decoder && typeof this.decoder.free === 'function') {
      try { this.decoder.free(); } catch (_) {}
    }
    this.decoder  = null;
    this.isReady  = false;
    this.onChunk  = null;
  }
}
