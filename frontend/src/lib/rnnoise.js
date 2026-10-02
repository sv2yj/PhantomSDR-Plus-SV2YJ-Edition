// RNNoise (xiph.org, via @jitsi/rnnoise-wasm) — the "AI NR" engine.
//
// Loaded ON DEMAND, like the Opus ML decoder: the sync build inlines the wasm
// as base64 (~1.9 MB, ~1.3 MB gzipped), which nobody should pay for on first
// paint when most listeners never switch AI NR on.
//
// The sync build was chosen over @shiguredo/rnnoise-wasm after a bench on
// SSB-filtered speech in band noise, 12 kHz -> 48 kHz -> RNNoise -> 12 kHz:
// same suppression within ~0.5 dB either way, but half the CPU (0.55 ms vs
// 1.2 ms per 10 ms frame on the station's desktop) and 40% of the download.
//
// Contract of rnnoise_process_frame, as measured rather than as documented:
//   - exactly 480 samples at 48 kHz per call (10 ms)
//   - samples in 16-bit PCM scale (±32768), not ±1
//   - output lags input by exactly 960 samples (20 ms) — the dry/wet mix in
//     audio.js depends on this number
//   - it is a speech model: a keyed CW tone comes out 30-90 dB down, i.e. gone.
//     Callers must keep it off CW and data modes.

export const RNNOISE_FRAME = 480
export const RNNOISE_RATE = 48000
export const RNNOISE_DELAY = 960

let _rnnoisePromise = null

export function loadRnnoise() {
  if (!_rnnoisePromise) {
    _rnnoisePromise = import('@jitsi/rnnoise-wasm/dist/rnnoise-sync.js')
      .then((m) => m.default())
      .then((mod) => new RnnoiseEngine(mod))
      .catch((e) => {
        // Let a later attempt retry rather than caching the failure forever
        _rnnoisePromise = null
        throw e
      })
  }
  return _rnnoisePromise
}

class RnnoiseEngine {
  constructor(mod) { this.mod = mod }

  // One denoiser per audio channel; each keeps its own recurrent state.
  createState() {
    const mod = this.mod
    const st = mod._rnnoise_create()
    const ptr = mod._malloc(RNNOISE_FRAME * 4)
    let alive = true
    return {
      // In place, on a 480-sample Float32Array in ±32768 scale. Returns
      // RNNoise's voice-activity probability (0..1) for the INPUT frame just
      // given — which is 20 ms ahead of the audio this call hands back.
      process(frame) {
        if (!alive) return 0
        // HEAPF32 is re-read on every call: a heap growth replaces the buffer.
        const base = ptr >> 2
        mod.HEAPF32.set(frame, base)
        const vad = mod._rnnoise_process_frame(st, ptr, ptr)
        frame.set(mod.HEAPF32.subarray(base, base + RNNOISE_FRAME))
        return vad
      },
      destroy() {
        if (!alive) return
        alive = false
        mod._rnnoise_destroy(st)
        mod._free(ptr)
      },
    }
  }
}
