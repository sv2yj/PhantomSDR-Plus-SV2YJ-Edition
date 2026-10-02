// Frequency / mode → audio passband, ported from App.svelte.
//
// The desktop app routes tuning through the waterfall (waterfallOffsetToFrequency
// etc.), but none of that is actually required: the conversion only needs three
// numbers from the /audio settings frame — basefreq, total_bandwidth and
// fft_result_size (see src/websocket.cpp send_basic_info). So the mobile page
// tunes with no waterfall socket open.

/** Mode table — copied verbatim from App.svelte demodulationDefaults. */
export const DEMOD_DEFAULTS = {
  USB:     { type: 'USB',  offsets: [0, 2700] },
  LSB:     { type: 'LSB',  offsets: [2700, 0] },
  CW:      { type: 'CW',   offsets: [250, 250] },    // DSB centred on carrier, ±250 Hz
  'CW-L':  { type: 'CWL',  offsets: [250, 250] },
  AM:      { type: 'AM',   offsets: [4500, 4500] },
  // Synchronous AM. Same passband as AM — the difference is the detector the
  // server uses: App.svelte sends "AM-ENV" for envelope AM and the plain "AM"
  // type for SAM, which is exactly what tune() does with these two entries.
  SAM:     { type: 'AM',   offsets: [4500, 4500] },
  QUAM:    { type: 'QUAM', offsets: [5000, 5000] },  // C-QUAM AM-stereo
  FM:      { type: 'FM',   offsets: [5000, 5000] },
  WBFM:    { type: 'FM',   offsets: [80000, 80000] },
  RADEL:   { type: 'LSB',  offsets: [2200, -700] },  // RADE v1, 700–2200 Hz below carrier
  RADEU:   { type: 'USB',  offsets: [-700, 2200] }   // RADE v1, 700–2200 Hz above carrier
}

/** Modes offered in the mobile mode picker, in display order.
 *  WBFM is deliberately absent. Its entry stays in DEMOD_DEFAULTS above so an
 *  older bookmark carrying it still tunes correctly instead of falling back. */
export const MODES = ['USB', 'LSB', 'CW', 'CW-L', 'AM', 'SAM', 'QUAM', 'FM', 'RADEL', 'RADEU']

/** Hz → FFT bin offset. Mirrors frequencyToFFTOffset in lib/backend.js. */
export function frequencyToFFTOffset (frequency, settings) {
  if (!settings) return 0
  const offset = (frequency - settings.basefreq) / settings.total_bandwidth
  return offset * settings.fft_result_size
}

/** FFT bin offset → Hz. */
export function fftOffsetToFrequency (offset, settings) {
  if (!settings) return 0
  return offset / settings.fft_result_size * settings.total_bandwidth + settings.basefreq
}

/** Frequency range this receiver can actually tune, in Hz. */
export function coverage (settings) {
  if (!settings) return [0, 0]
  return [settings.basefreq, settings.basefreq + settings.total_bandwidth]
}

/**
 * Apply a frequency + mode to the audio socket.
 *
 * The passband is symmetric about the tuned frequency: l = f - offsets[0],
 * r = f + offsets[1]. That is exactly what App.svelte's handleDemodulationChange
 * does, and it reduces to the same l/m/r as the click path's USB/LSB
 * special-casing (USB has offsets[0] === 0, LSB has offsets[1] === 0).
 *
 * The second triple is the CW BFO-shifted passband, which the server expects
 * alongside the first — same -200/-750/-200 Hz shifts the desktop sends.
 */
export function tune (audio, frequency, mode, settings) {
  const def = DEMOD_DEFAULTS[mode] || DEMOD_DEFAULTS.USB

  const m = frequency
  const l = m - def.offsets[0]
  const r = m + def.offsets[1]

  // WBFM is the only mode needing de-emphasis; everything else must clear it,
  // otherwise it persists after switching away (same as App.svelte).
  audio.setFmDeemph(mode === 'WBFM' ? 50e-6 : 0)

  // "AM" selects the envelope detector, "SAM" the synchronous one. Both carry
  // type 'AM' in the table above, so the distinction is made here — mirroring
  // App.svelte's `demodulation === "AM" && !samEnabled ? "AM-ENV" : type`.
  audio.setAudioDemodulation(mode === 'AM' ? 'AM-ENV' : def.type)

  const params = [l, m, r].map((f) => frequencyToFFTOffset(f, settings))
  const offsets = [l - 200, m - 750, r - 200].map((f) => frequencyToFFTOffset(f, settings))
  audio.setAudioRange(...params, ...offsets)
}
