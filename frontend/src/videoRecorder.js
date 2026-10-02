// Video + audio recording of the waterfall display.
//
// The visible waterfall panel is a vertical stack of independent canvases
// (spectrum, graduation, waterfall) with HTML overlays on top. captureStream()
// only ever captures a single canvas, so this module composites the stack into
// one offscreen canvas each frame and captures that instead, muxing in the
// demodulated audio from the AudioStreamDestination node.

// MP4/H.264 first because it opens anywhere without conversion (Chrome 126+ and
// Safari can record it directly). WebM/VP9 is the fallback for browsers that
// can't mux MP4 — note VP9 actually compresses waterfall content better than
// H.264, so the WebM fallback tends to produce the *smaller* file of the two.
const MIME_CANDIDATES = [
  'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
  'video/mp4',
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm',
];

function pickMimeType() {
  if (typeof MediaRecorder === 'undefined') return null;
  for (const type of MIME_CANDIDATES) {
    try {
      if (MediaRecorder.isTypeSupported(type)) return type;
    } catch (e) {
      /* isTypeSupported throws on some older builds; keep probing */
    }
  }
  return null;
}

function isMp4(mimeType) {
  return !!mimeType && mimeType.startsWith('video/mp4');
}

function extensionFor(mimeType) {
  return mimeType && mimeType.startsWith('video/mp4') ? 'mp4' : 'webm';
}

const CAPTION_HEIGHT = 24;

export class VideoRecorder {
  constructor({ fps = 25, maxDurationSec = 600, videoBitsPerSecond = 2000000 } = {}) {
    this.fps = fps;
    this.maxDurationSec = maxDurationSec;
    this.videoBitsPerSecond = videoBitsPerSecond;

    this.isRecording = false;
    this.chunks = [];
    this.mimeType = null;
    this.mediaRecorder = null;
    this.stream = null;
    this.rafHandle = null;
    this.startTime = 0;
    // stage holds the full composited stack; frame is what gets captured, and
    // is either the whole stage or a crop of it, plus the caption bar.
    this.stage = null;
    this.stageCtx = null;
    this.frame = null;
    this.frameCtx = null;
    this.cropRect = null;
    this.slots = [];
    this.getCaption = null;
    this.onAutoStop = null;
    this.onStopped = null;
  }

  // Map a normalised crop onto stage pixels, clamped to the stage and floored
  // at a usable size. Anything missing or degenerate records the full stack.
  _resolveCrop(crop, stageWidth, stageHeight) {
    const full = { x: 0, y: 0, w: stageWidth, h: stageHeight };
    if (!crop) return full;

    const nx = Math.min(Math.max(crop.x, 0), 1);
    const ny = Math.min(Math.max(crop.y, 0), 1);
    const nw = Math.min(Math.max(crop.w, 0), 1 - nx);
    const nh = Math.min(Math.max(crop.h, 0), 1 - ny);

    const x = Math.round(nx * stageWidth);
    const y = Math.round(ny * stageHeight);
    const w = Math.round(nw * stageWidth);
    const h = Math.round(nh * stageHeight);

    // A stray click rather than a real drag; not worth encoding a 2px video.
    if (w < 16 || h < 16) {
      console.warn('[VideoRecording] Selected area too small, recording full panel');
      return full;
    }
    return { x, y, w, h };
  }

  static isSupported() {
    return (
      typeof MediaRecorder !== 'undefined' &&
      typeof HTMLCanvasElement !== 'undefined' &&
      typeof HTMLCanvasElement.prototype.captureStream === 'function' &&
      pickMimeType() !== null
    );
  }

  // layers: [{ canvas, flipY }] in top-to-bottom stack order. Only canvases that
  // are laid out (non-zero client height) at start are given a slot; the frame
  // size is then locked for the whole recording, because changing a canvas's
  // size mid-capture renegotiates the video track resolution and produces files
  // that several players refuse to seek.
  //
  // crop: optional { x, y, w, h } with each value normalised 0..1 against the
  // composited stack (caption bar excluded). Normalised rather than pixels so a
  // selection made against the on-screen layout survives the mapping into the
  // stack's own resolution, which is a different size and aspect ratio.
  start({ audioStream, layers, getCaption, onAutoStop, onStopped, crop } = {}) {
    if (this.isRecording) return false;
    if (!VideoRecorder.isSupported()) {
      console.warn('[VideoRecording] Not supported in this browser');
      return false;
    }

    const active = (layers || []).filter(
      (l) => l && l.canvas && l.canvas.width > 0 && l.canvas.height > 0 && l.canvas.clientHeight > 0
    );
    if (active.length === 0) {
      console.warn('[VideoRecording] No visible waterfall canvas to record');
      return false;
    }

    // Each layer keeps its own aspect ratio, scaled to the widest layer so the
    // stack lines up horizontally (spectrum and waterfall are both 1024 wide
    // today, but nothing guarantees that).
    const widest = Math.max(...active.map((l) => l.canvas.width));
    const stageWidth = widest + (widest % 2);

    let y = 0;
    this.slots = active.map((layer) => {
      const h = Math.round(layer.canvas.height * (stageWidth / layer.canvas.width));
      const slot = { layer, y, h };
      y += h;
      return slot;
    });
    const stageHeight = y;

    this.stage = document.createElement('canvas');
    this.stage.width = stageWidth;
    this.stage.height = stageHeight;
    this.stageCtx = this.stage.getContext('2d', { alpha: false });

    this.cropRect = this._resolveCrop(crop, stageWidth, stageHeight);

    // Encoders want even dimensions; odd sizes fail outright on some H.264
    // implementations.
    const frameWidth = this.cropRect.w + (this.cropRect.w % 2);
    const bodyHeight = this.cropRect.h;
    const frameHeight = bodyHeight + CAPTION_HEIGHT + ((bodyHeight + CAPTION_HEIGHT) % 2);

    this.frame = document.createElement('canvas');
    this.frame.width = frameWidth;
    this.frame.height = frameHeight;
    this.frameCtx = this.frame.getContext('2d', { alpha: false });
    this.frameCtx.fillStyle = '#000';
    this.frameCtx.fillRect(0, 0, frameWidth, frameHeight);

    this.getCaption = typeof getCaption === 'function' ? getCaption : null;
    this.onAutoStop = typeof onAutoStop === 'function' ? onAutoStop : null;
    this.onStopped = typeof onStopped === 'function' ? onStopped : null;

    const videoStream = this.frame.captureStream(this.fps);
    this.stream = new MediaStream();
    videoStream.getVideoTracks().forEach((t) => this.stream.addTrack(t));

    const audioTracks = audioStream ? audioStream.getAudioTracks() : [];
    if (audioTracks.length === 0) {
      console.warn('[VideoRecording] No audio track available, recording video only');
    }
    audioTracks.forEach((t) => this.stream.addTrack(t));

    this.mimeType = pickMimeType();
    this.chunks = [];
    // The bitrate cap is what actually controls file size — the container
    // choice barely matters. Left unset, Chrome picks a rate far higher than
    // waterfall content needs.
    this.mediaRecorder = new MediaRecorder(this.stream, {
      mimeType: this.mimeType,
      videoBitsPerSecond: this.videoBitsPerSecond,
      audioBitsPerSecond: 96000,
    });
    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) this.chunks.push(event.data);
    };
    // Fires once the encoder has flushed its final chunk. Anything feeding the
    // stream must stay alive until then or the tail of the recording is lost.
    this.mediaRecorder.onstop = () => {
      if (this.onStopped) this.onStopped();
    };

    this.isRecording = true;
    this.startTime = Date.now();
    // WebM tolerates concatenated timeslice chunks, so slice it: a crashed tab
    // still leaves usable data. MP4 is fragmented and far pickier about how the
    // init segment and fragments are stitched, so take it as one blob at stop.
    if (isMp4(this.mimeType)) {
      this.mediaRecorder.start();
    } else {
      this.mediaRecorder.start(1000);
    }
    this.rafHandle = requestAnimationFrame(() => this._drawFrame());

    const cropped =
      this.cropRect.w !== this.stage.width || this.cropRect.h !== this.stage.height;
    console.log(
      '[VideoRecording] Started ' + this.frame.width + 'x' + this.frame.height +
      ' @' + this.fps + 'fps as ' + this.mimeType +
      ' ~' + Math.round(this.videoBitsPerSecond / 1000) + 'kbps' +
      (cropped
        ? ' (crop ' + this.cropRect.w + 'x' + this.cropRect.h + ' from ' +
          this.stage.width + 'x' + this.stage.height + ')'
        : ' (full panel)') +
      ' (max ' + (this.maxDurationSec / 60) + ' min)'
    );
    return true;
  }

  _drawFrame() {
    if (!this.isRecording) return;

    if ((Date.now() - this.startTime) / 1000 > this.maxDurationSec) {
      console.warn(
        '[VideoRecording] Maximum duration (' + (this.maxDurationSec / 60) +
        ' minutes) reached, stopping automatically'
      );
      this.stop();
      if (this.onAutoStop) this.onAutoStop();
      return;
    }

    const sctx = this.stageCtx;
    const sw = this.stage.width;

    // Clear every frame: a layer hidden mid-recording (spectrum toggled off)
    // must leave black rather than a frozen last frame.
    sctx.fillStyle = '#000';
    sctx.fillRect(0, 0, sw, this.stage.height);

    for (const slot of this.slots) {
      const canvas = slot.layer.canvas;
      if (!canvas || canvas.width === 0 || canvas.height === 0) continue;
      if (canvas.clientHeight === 0) continue; // toggled off, leave the slot black

      const flip = typeof slot.layer.flipY === 'function' ? slot.layer.flipY() : !!slot.layer.flipY;
      if (flip) {
        // The waterfall canvas is flipped with a CSS transform when reverse
        // scroll is on; drawImage doesn't see CSS, so mirror it here to match
        // what the operator is actually looking at.
        sctx.save();
        sctx.translate(0, slot.y + slot.h);
        sctx.scale(1, -1);
        sctx.drawImage(canvas, 0, 0, sw, slot.h);
        sctx.restore();
      } else {
        sctx.drawImage(canvas, 0, slot.y, sw, slot.h);
      }
    }

    // Blit the selected region 1:1 into the captured frame. When nothing is
    // cropped this is the whole stage, and the copy costs one blit per frame.
    const c = this.cropRect;
    this.frameCtx.fillStyle = '#000';
    this.frameCtx.fillRect(0, 0, this.frame.width, this.frame.height);
    this.frameCtx.drawImage(this.stage, c.x, c.y, c.w, c.h, 0, 0, c.w, c.h);

    this._drawCaption();
    this.rafHandle = requestAnimationFrame(() => this._drawFrame());
  }

  _drawCaption() {
    const ctx = this.frameCtx;
    const w = this.frame.width;
    const top = this.frame.height - CAPTION_HEIGHT;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.92)';
    ctx.fillRect(0, top, w, CAPTION_HEIGHT);
    ctx.fillStyle = '#ffb000';
    ctx.fillRect(0, top, 3, CAPTION_HEIGHT);

    const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
    const mm = String(Math.floor(elapsed / 60)).padStart(2, '0');
    const ss = String(elapsed % 60).padStart(2, '0');

    let text = '';
    try {
      if (this.getCaption) text = this.getCaption() || '';
    } catch (e) {
      text = '';
    }

    ctx.font = '13px monospace';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#e5e7eb';
    ctx.fillText(text, 10, top + CAPTION_HEIGHT / 2);

    ctx.fillStyle = '#f87171';
    ctx.textAlign = 'right';
    ctx.fillText('REC ' + mm + ':' + ss, w - 10, top + CAPTION_HEIGHT / 2);
    ctx.textAlign = 'left';
  }

  stop() {
    if (!this.isRecording) return;
    this.isRecording = false;

    if (this.rafHandle !== null) {
      cancelAnimationFrame(this.rafHandle);
      this.rafHandle = null;
    }
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
    // Only release the video track, which this class created. The audio track
    // came from the caller, so the caller decides when it dies — stopping a
    // track we don't own risks killing live playback.
    if (this.stream) {
      this.stream.getVideoTracks().forEach((t) => t.stop());
    }
    console.log('[VideoRecording] Stopped');
  }

  hasRecording() {
    return this.chunks.length > 0;
  }

  // Release everything this recorder holds. The chunks are the only part that
  // is really large — a few minutes of video is tens of megabytes sitting in
  // memory until it is dropped. Not reusable afterwards; make a new instance.
  dispose() {
    this.stop();
    // Detached so a late flush from the encoder can't push into the array we
    // are dropping, or re-trigger teardown of state that has moved on.
    if (this.mediaRecorder) {
      this.mediaRecorder.ondataavailable = null;
      this.mediaRecorder.onstop = null;
    }
    this.chunks = [];
    this.mediaRecorder = null;
    this.stream = null;
    this.stage = null;
    this.stageCtx = null;
    this.frame = null;
    this.frameCtx = null;
    this.slots = [];
    this.onStopped = null;
    this.onAutoStop = null;
    this.getCaption = null;
  }

  download() {
    if (this.chunks.length === 0) {
      console.warn('[VideoRecording] No recorded video to download');
      return;
    }

    const type = this.mimeType || 'video/webm';
    const blob = new Blob(this.chunks, { type });

    const d = new Date();
    const stamp =
      d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate() + '_' +
      d.getHours() + '-' + d.getMinutes() + '-' + d.getSeconds();

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    document.body.appendChild(a);
    a.style.display = 'none';
    a.href = url;
    a.download = 'recorded_video_' + stamp + '_.' + extensionFor(type);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}
