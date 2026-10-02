// Mobile backend wiring.
//
// Deliberately NOT lib/backend.js: that module also constructs SpectrumWaterfall
// and SpectrumEvents, which would open two extra sockets and stream waterfall
// bins to a phone for a page that draws no waterfall. Here we open /audio only.
//
// Everything the mobile UI needs is reachable without the waterfall socket:
//   - tuning        → audio.settings.{basefreq,total_bandwidth,fft_result_size}
//   - signal level  → audio.getPowerDb()
//   - connected users → GET /users (plain HTTP poll)
//   - chat          → its own /chat WebSocket
import SpectrumAudio from '../audio'
import { CLIENT_VERSION } from '../clientVersion'
import initWrappers from '../lib/wrappers'

const loc = window.location
const baseUri = `${loc.protocol.replace('http', 'ws')}//${loc.host}`

export const audio = new SpectrumAudio(baseUri + '/audio?v=' + CLIENT_VERSION)

// This page only exists for handsets, so it always asks for the device's own
// sample rate and lets audio.js resample the 12 kHz stream up to it. Asking a
// phone for a 12 kHz AudioContext leaves the stretch to its hardware rate to
// the platform, which on Android is audibly poor. ?ctxrate=stream still forces
// the old behaviour for comparison.
audio.preferNativeContextRate = true

// Expose for browser-console debugging, same convention as lib/backend.js
try { window.audio = audio } catch (e) {}

let _settings = null
export function getSettings () { return _settings }

export async function init () {
  // audio.init() carries its own 8 s timeout, but initWrappers() (WASM load)
  // has none — so bound the whole sequence. Without this, one stalled fetch
  // leaves the page on "Connecting…" with no way out and nothing to report.
  const budget = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Timed out preparing the audio pipeline')), 20000)
  )
  await Promise.race([
    (async () => {
      await initWrappers()
      await audio.init()
    })(),
    budget
  ])
  _settings = audio.settings
  return _settings
}

/**
 * Try to resume the AudioContext.
 *
 * audio.js installs its own 'mousedown' listener for this (see initAudio), but
 * mobile browsers — iOS Safari especially — are stricter: the context must be
 * resumed from inside a real touch handler. The UI therefore also offers an
 * explicit "Tap to start" button.
 *
 * NEVER await ctx.resume() unguarded. On mobile Safari (and Chrome on Android)
 * a resume() issued OUTSIDE a user gesture returns a promise that simply stays
 * pending — it neither resolves nor rejects, because the browser is waiting for
 * a gesture that may never come. Awaiting it on page load wedges the caller
 * forever, which is exactly what left this page stuck on "Connecting…" while
 * the audio socket was in fact already connected.
 *
 * So: settle on ctx.state, and race the resume against a short timer. A
 * gesture-driven resume completes in well under 400 ms; a blocked one loses the
 * race and we correctly report "not running" so the UI can ask for a tap.
 */
export async function resumeAudio () {
  const ctx = audio.audioCtx
  if (!ctx) return false
  if (ctx.state === 'running') return true

  try {
    await Promise.race([
      Promise.resolve(ctx.resume()),
      new Promise((resolve) => setTimeout(resolve, 400))
    ])
  } catch (e) {
    // A rejected resume() is fine — state below is the real answer.
  }
  return ctx.state === 'running'
}
