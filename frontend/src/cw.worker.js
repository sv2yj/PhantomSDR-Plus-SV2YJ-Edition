/**
 * cw.worker.js — off-main-thread host for the CW decoder (cwDecoder.js)
 *
 * Fourth and last of the decoders to move off the main thread (after SSTV, FAX
 * and NAVTEX/FSK).  CW is fed from the same raw PCM tap as all of them, above
 * the mute/squelch gate in playAudio().  It used to be fed the PROCESSED buffer
 * instead, on the reasoning that the auto-notch cleared interfering carriers
 * ahead of the tone detector; ANF is now bypassed in CW (it would cancel the CW
 * note itself), so that buffer only added blanker gaps, spectral-stage gain
 * ripple and 42 ms of latency to the envelope the matched filter reads.  The
 * proxy still copies the buffer before posting: transferring it would detach
 * the audio pipeline's own buffer.
 *
 * Per chunk the decoder runs a Goertzel tone search, a matched filter, envelope
 * tracking and the dictionary MAP character decode — modest next to SSTV's
 * per-pixel FFTs, but it runs on every single audio buffer rather than in
 * bursts, so it is a steady tax on the thread that also feeds the worklet.
 *
 * Protocol (main → worker), all messages carry `t`:
 *
 *   { t: 'init',       sampleRate }
 *   { t: 'sampleRate', sampleRate }
 *   { t: 'reset',      sampleRate }
 *   { t: 'pcm',        pcm: Float32Array, sampleRate }
 *   { t: 'destroy' }
 *
 * Worker → main: the decoder's own events, forwarded verbatim
 * ({ type: 'char' | 'word' | 'silence' | 'freq', … }).
 */

import CWDecoder from './cwDecoder.js';

let sampleRate = 12000;
let decoder    = null;

function ensure() {
  if (decoder) return decoder;
  decoder = new CWDecoder({
    sampleRate,
    callback: (event) => { self.postMessage(event); },
  });
  return decoder;
}

self.onmessage = ({ data }) => {
  const d = data || {};
  try {
    switch (d.t) {
      case 'init': {
        if (d.sampleRate) sampleRate = d.sampleRate;
        // Reset if a decoder is already here: 'init' can arrive when the proxy
        // re-creates its worker, and carrying over envelope/timing state from
        // the previous session would corrupt the first characters.
        const existed = !!decoder;
        ensure().setSampleRate(sampleRate);
        if (existed) decoder.reset();
        break;
      }

      case 'sampleRate':
        if (d.sampleRate && d.sampleRate !== sampleRate) {
          sampleRate = d.sampleRate;
          ensure().setSampleRate(sampleRate);
        }
        break;

      case 'reset':
        if (d.sampleRate) sampleRate = d.sampleRate;
        ensure().setSampleRate(sampleRate);
        decoder.reset();
        break;

      case 'pcm':
        if (d.sampleRate && d.sampleRate !== sampleRate) {
          sampleRate = d.sampleRate;
          ensure().setSampleRate(sampleRate);
        }
        if (d.pcm && d.pcm.length) ensure().feed(d.pcm);
        break;

      case 'destroy':
        decoder = null;
        self.close();
        break;

      default:
        break;
    }
  } catch (e) {
    console.error('[CW worker]', e);
  }
};
