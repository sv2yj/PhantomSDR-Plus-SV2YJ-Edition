/**
 * cwWorkerProxy.js — stand-in for CWDecoder that runs the real decoder inside
 * cw.worker.js.  Mirrors the SSTV / FAX / FSK proxies: lazy worker creation,
 * in-thread fallback, PCM copied before transfer.
 *
 * The surface matches the subset of CWDecoder that audio.js uses —
 * setCallback / setSampleRate / reset / feed — plus setEnabled(), which is what
 * triggers the lazy start, and destroy().
 */

import CWDecoder from './cwDecoder.js';

export class CWWorkerProxy {

  constructor(options = {}) {
    this._sampleRate = options.sampleRate || 12000;
    this._callback   = typeof options.callback === 'function' ? options.callback : null;
    this._enabled    = false;
    this._worker     = null;
    this._local      = null;
  }

  _ensureWorker() {
    if (this._worker || this._local) return;

    try {
      this._worker = new Worker(
        new URL('./cw.worker.js', import.meta.url),
        { type: 'module' }
      );
    } catch (e) {
      console.warn('[CW] Worker unavailable, decoding in-thread:', e);
      this._startLocal();
      return;
    }

    this._worker.onmessage = ({ data }) => {
      if (typeof this._callback === 'function') this._callback(data);
    };
    this._worker.onerror = (e) => {
      console.error('[CW] Worker error, falling back to in-thread decoding:', e);
      try { this._worker.terminate(); } catch (_) {}
      this._worker = null;
      this._startLocal();
    };

    this._post({ t: 'init', sampleRate: this._sampleRate });
  }

  _startLocal() {
    if (this._local) return;
    this._local = new CWDecoder({
      sampleRate: this._sampleRate,
      callback:   (event) => { if (this._callback) this._callback(event); },
    });
  }

  _post(msg, transfer) {
    if (!this._worker) return;
    try { this._worker.postMessage(msg, transfer || []); }
    catch (e) { console.error('[CW] postMessage failed:', e); }
  }

  // ── CWDecoder-compatible surface ──────────────────────────────────────────

  setEnabled(enabled) {
    this._enabled = !!enabled;
    if (this._enabled) this._ensureWorker();
  }

  setCallback(cb) {
    this._callback = typeof cb === 'function' ? cb : null;
    if (this._local) this._local.setCallback(this._callback);
  }

  setSampleRate(sr) {
    const rate = sr || 12000;
    if (rate === this._sampleRate) return;      // called per chunk; only post on change
    this._sampleRate = rate;
    if (this._local) { this._local.setSampleRate(rate); return; }
    this._post({ t: 'sampleRate', sampleRate: rate });
  }

  reset() {
    if (this._local) { this._local.reset(); return; }
    this._post({ t: 'reset', sampleRate: this._sampleRate });
  }

  /**
   * `pcm` here is the PROCESSED playback buffer, moments before it is handed to
   * playPCM() — copying is not optional.
   */
  feed(pcm) {
    if (!pcm || pcm.length === 0) return;
    if (this._local) { this._local.feed(pcm); return; }
    this._ensureWorker();
    if (this._local) { this._local.feed(pcm); return; }
    const copy = new Float32Array(pcm);
    this._post({ t: 'pcm', pcm: copy, sampleRate: this._sampleRate }, [copy.buffer]);
  }

  destroy() {
    this._local = null;
    if (this._worker) {
      this._post({ t: 'destroy' });
      try { this._worker.terminate(); } catch (_) {}
      this._worker = null;
    }
    this._callback = null;
    this._enabled  = false;
  }
}
