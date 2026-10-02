class PhantomSDRAudioStreamProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const processorOptions = (options && options.processorOptions) || {};
    this.sampleRateHint = processorOptions.sampleRate || sampleRate || 12000;
    // ── Audio buffer latency tuning ─────────────────────────────────────────
    // This worklet holds the ring buffer that actually decides what a listener
    // hears: playPCM() in audio.js hands PCM over and returns immediately, so
    // its own bufferLimit/bufferThreshold reach only the fallback scheduler.
    // The two dimensions below are the real ones, and both have hard floors
    // enforced by Math.max() — values below those floors are silently clamped.
    //
    //   maxBufferedFrames  — ring buffer ceiling in samples. A chunk that will
    //                        not fit is dropped on arrival (see _pushChunk).
    //                        The Math.max(1024,...) floor = 85ms at 12kHz — do
    //                        not lower the floor below 512 or the worklet will
    //                        drop frames faster than it can fill.
    //                        Fed by processorOptions.maxBufferedSeconds, which
    //                        audio.js derives from bufferLimit — the buffer
    //                        preset a listener picks in the UI.
    //                        Current floor: 1024 frames = 85ms @ 12kHz
    //
    //   minStartFrames     — frames that must be buffered before playback
    //                        starts (or restarts after underrun). The
    //                        Math.max(256,...) floor = 21ms at 12kHz, which is
    //                        2 AudioWorklet quanta — the practical minimum to
    //                        avoid an immediate underrun on start.
    //                        Fed by processorOptions.minStartSeconds, which
    //                        audio.js derives from bufferThreshold.
    //                        Current floor: 256 frames = 21ms @ 12kHz
    //
    // Neither is fixed for the life of the node: a 'config' message re-runs
    // _applyConfig(), which is how a mid-session buffer change is heard.
    //
    // If raising the preset has no effect on choppy audio, check whether the
    // value × sampleRate is still hitting the floor here.
    // Formula: effective ceiling = Math.max(1024, maxBufferedSeconds × 12000)
    // At 0.25s: max(1024, 3000) = 3000 ✓ (floor not active)
    // At 0.08s: max(1024,  960) = 1024 ✗ (clamped — the change is wasted)
    // ────────────────────────────────────────────────────────────────────────
    // Both are computed in _applyConfig() below, which also runs for every
    // 'config' message so a listener changing the buffer preset mid-session
    // is heard immediately instead of on the next page load.
    this.maxBufferedFrames = 0;
    this.minStartFrames = 0;

    this.queue = [];
    this.current = null;
    this.currentIndex = 0;
    this.bufferedFrames = 0;
    this.droppedFrames = 0;
    this.underruns = 0;
    this._applyConfig(processorOptions);
    this.started = false;
    this._lastStatsFrame = 0;

    this.port.onmessage = (event) => {
      const data = event.data || {};
      if (data.type === 'push' && data.pcm) {
        this._pushChunk(data.pcm, data.channels || 1);
      } else if (data.type === 'config') {
        this._applyConfig(data);
      } else if (data.type === 'reset') {
        this.queue = [];
        this.current = null;
        this.currentIndex = 0;
        this.bufferedFrames = 0;
        this.droppedFrames = 0;  // reset per-session — lifetime total would persist across reconnects
        this.underruns = 0;
        this.started = false;
      }
    };
  }

  /**
   * (Re)compute the ring buffer geometry from maxBufferedSeconds /
   * minStartSeconds. Called once from the constructor and again for every
   * 'config' message — see setAudioBufferDelay() in audio.js. The Math.max()
   * floors documented in the constructor still apply, and an absent or
   * nonsensical value leaves that dimension at whatever it already was
   * (falling back to the historical default on the constructor's first call).
   */
  _applyConfig(opts) {
    const o = opts || {};
    if (typeof o.maxBufferedSeconds === 'number' && o.maxBufferedSeconds > 0) {
      this.maxBufferedFrames = Math.max(1024, Math.floor(o.maxBufferedSeconds * this.sampleRateHint));
    } else if (!this.maxBufferedFrames) {
      this.maxBufferedFrames = Math.max(1024, Math.floor(1.5 * this.sampleRateHint));
    }
    if (typeof o.minStartSeconds === 'number' && o.minStartSeconds > 0) {
      this.minStartFrames = Math.max(256, Math.floor(o.minStartSeconds * this.sampleRateHint));
    } else if (!this.minStartFrames) {
      this.minStartFrames = Math.max(256, Math.floor(0.06 * this.sampleRateHint));
    }
    // A shrunken ceiling is not enforced retroactively here: the queue drains
    // at real time and the next _pushChunk() trims it, so there is no need to
    // throw away audio that is already buffered and about to be played.
  }

  _pushChunk(pcm, channels) {
    const samples = pcm instanceof Float32Array ? pcm : new Float32Array(pcm);
    const ch = channels === 2 ? 2 : 1;
    const frames = ch === 2 ? Math.floor(samples.length / 2) : samples.length;
    if (frames <= 0) return;

    // bufferedFrames is incremented when a chunk is pushed and decremented
    // per-frame consumed in process() — it therefore already includes any
    // remaining frames from the in-progress chunk (this.current).  Adding
    // currentRemaining on top double-counts those frames, making the buffer
    // look ~2× fuller than it is and causing premature drops.
    const totalBuffered = this.bufferedFrames;

    // Overflow: drop the INCOMING chunk, not the oldest queued one.
    //
    // Either choice discards the same amount of audio and leaves the same
    // steady-state latency, but dropping the oldest splices the waveform right
    // where the reader is about to arrive — a discontinuity in the middle of
    // whatever the listener is hearing this instant, and it moves the whole
    // buffered timeline forward under a reader that is already mid-chunk.
    // Dropping the newest puts the splice at the write end instead and leaves
    // everything already buffered contiguous with what is playing.
    //
    // The queue.length guard is the safety valve: a single chunk larger than
    // the whole ceiling would otherwise be refused forever and nothing would
    // ever play. An empty queue always accepts, whatever the size.
    if (totalBuffered + frames > this.maxBufferedFrames && this.queue.length > 0) {
      this.droppedFrames += frames;
      return;
    }

    this.queue.push({ samples, channels: ch, frames });
    this.bufferedFrames += frames;
  }

  _beginNextChunk() {
    if (this.queue.length === 0) {
      this.current = null;
      this.currentIndex = 0;
      return false;
    }
    this.current = this.queue.shift();
    this.currentIndex = 0;
    return true;
  }

  process(_inputs, outputs) {
    const output = outputs[0];
    if (!output || output.length === 0) return true;

    const left = output[0];
    const right = output[1] || output[0];
    let hadUnderrun = false;

    // bufferedFrames already includes the remaining frames in this.current
    // (they were counted when the chunk was pushed, and decremented per-sample
    // as they are consumed).  Do NOT add currentRemaining — that double-counts
    // those frames, makes the buffer look ~2× fuller than it is, and delays
    // the restart gate far longer than intended after an underrun.
    const totalBuffered = this.bufferedFrames;
    if (!this.started) {
      if (totalBuffered < this.minStartFrames) {
        for (let i = 0; i < left.length; i++) {
          left[i] = 0;
          if (output[1]) right[i] = 0;
        }
        return true;
      }
      this.started = true;
    }

    for (let i = 0; i < left.length; i++) {
      if (!this.current && !this._beginNextChunk()) {
        left[i] = 0;
        if (output[1]) right[i] = 0;
        hadUnderrun = true;
        continue;
      }

      const chunk = this.current;
      if (chunk.channels === 2) {
        const base = this.currentIndex * 2;
        left[i] = chunk.samples[base] || 0;
        // Only write right separately if a second output channel actually
        // exists. If output[1] is absent, right===left (same array reference)
        // and writing right[i] would overwrite left[i] with the wrong sample.
        if (output[1]) right[i] = chunk.samples[base + 1] || 0;
      } else {
        const v = chunk.samples[this.currentIndex] || 0;
        left[i] = v;
        if (output[1]) right[i] = v;
      }

      this.currentIndex++;
      this.bufferedFrames--;
      if (this.bufferedFrames < 0) this.bufferedFrames = 0;

      if (this.currentIndex >= chunk.frames) {
        this.current = null;
        this.currentIndex = 0;
      }
    }

    if (hadUnderrun) {
      this.underruns++;
      // Reset the start gate so recovery waits for minStartFrames before
      // resuming. Without this, playback restarts on the very next sample —
      // potentially with only 1–2 frames buffered — causing choppy audio
      // on recovery rather than a clean restart.
      this.started = false;
    }

    this._lastStatsFrame += left.length;
    if (this._lastStatsFrame >= 1024) {
      this._lastStatsFrame = 0;
      this.port.postMessage({
        type: 'stats',
        bufferedFrames: this.bufferedFrames,
        droppedFrames: this.droppedFrames,
        underruns: this.underruns
      });
    }

    return true;
  }
}

registerProcessor('phantomsdr-audio-stream', PhantomSDRAudioStreamProcessor);