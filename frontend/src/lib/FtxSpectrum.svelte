<script>
  import { onMount, onDestroy } from "svelte";

  /** SpectrumAudio instance (from lib/backend.js) */
  export let audio = null;
  /** Height of the strip in CSS pixels. Override per call site if needed. */
  export let height = 56;
  /**
   * Which decoder's spectrum to draw: "ftx" (FT8/FT4/FT2, 100-3100 Hz) or
   * "wspr" (zoomed to 1390-1610 Hz). The snapshot carries its own axis and
   * gridline spacing, so nothing below is mode-specific.
   */
  export let source = "ftx";

  let canvas;
  let raf = null;
  let lastSeq = -1;
  let lastW = 0, lastH = 0;

  // Vertical scaling.
  //
  // The floor is referenced to the measured noise level rather than fixed in
  // absolute dB, so the trace looks the same whatever the receiver gain or AGC
  // is doing. Measured on real signals the band median sits ~33 dB below the
  // strongest peak, so a 55 dB span keeps the noise hugging the bottom while
  // leaving strong signals short of the ceiling.
  //
  // TOP_MARGIN reserves headroom so even a maximal signal cannot reach the top
  // of the box — the strip is read for horizontal position, and a trace that
  // fills its box vertically just looks cramped.
  const DB_SPAN     = 50;   // smaller = taller trace
  const FLOOR_BELOW = 6;      // dB below the band median
  const TOP_MARGIN  = 0.20;   // fraction of box height left clear at the top

  let floorDb = null;         // smoothed across frames to stop it twitching

  function draw() {
    raf = requestAnimationFrame(draw);
    const getter = source === "wspr" ? "getWSPRSpectrum" : "getFTxSpectrum";
    if (!canvas || !audio || typeof audio[getter] !== "function") return;

    const snap = audio[getter]();
    const dpr  = window.devicePixelRatio || 1;
    const cssW = canvas.clientWidth;
    const cssH = height;
    if (!cssW) return;

    const w = Math.round(cssW * dpr);
    const h = Math.round(cssH * dpr);
    const resized = w !== lastW || h !== lastH;
    if (resized) { canvas.width = w; canvas.height = h; lastW = w; lastH = h; }
    // Redraw only when the data actually changed (or the box did).
    if (!resized && snap.seq === lastSeq) return;
    lastSeq = snap.seq;

    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, w, h);

    const { mags, binHz, loHz, hiHz, marks, gridHz = 500 } = snap;
    const loBin = Math.max(1, Math.floor(loHz / binHz));
    const hiBin = Math.min(mags.length - 1, Math.ceil(hiHz / binHz));
    const span  = hiHz - loHz;
    const xOf   = (hz) => ((hz - loHz) / span) * w;

    // Track the noise floor via the median of the visible band — robust to a
    // few strong signals in a way a mean or a min would not be.
    let med = -100;
    if (hiBin > loBin) {
      const scratch = new Float32Array(hiBin - loBin);
      for (let k = loBin; k < hiBin; k++) scratch[k - loBin] = mags[k];
      scratch.sort();
      med = scratch[scratch.length >> 1];
    }
    const targetFloor = med - FLOOR_BELOW;
    floorDb = floorDb === null ? targetFloor : floorDb + 0.2 * (targetFloor - floorDb);

    const usable = h * (1 - TOP_MARGIN);
    const yOf = (db) => {
      const t = (db - floorDb) / DB_SPAN;
      return h - Math.max(0, Math.min(1, t)) * usable;
    };

    // Gridlines at the spacing the snapshot asked for
    ctx.strokeStyle = "rgba(255,255,255,0.10)";
    ctx.fillStyle   = "rgba(255,255,255,0.38)";
    ctx.lineWidth   = 1 * dpr;
    ctx.font        = `${9 * dpr}px ui-monospace, monospace`;
    ctx.textAlign   = "center";
    for (let f = Math.ceil(loHz / gridHz) * gridHz; f <= hiHz; f += gridHz) {
      const x = xOf(f);
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
      ctx.fillText(String(f), x, h - 2 * dpr);
    }

    // Spectrum trace: one column per pixel, taking the max bin in that column
    // so narrow signals cannot be missed by undersampling.
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let px = 0; px < w; px++) {
      const f0 = loHz + (px / w) * span;
      const f1 = loHz + ((px + 1) / w) * span;
      let b0 = Math.max(loBin, Math.floor(f0 / binHz));
      let b1 = Math.min(hiBin, Math.max(b0, Math.ceil(f1 / binHz)));
      let peak = -140;
      for (let b = b0; b <= b1; b++) if (mags[b] > peak) peak = mags[b];
      ctx.lineTo(px, yOf(peak));
    }
    ctx.lineTo(w, h);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, "rgba(34,211,238,0.55)");
    grad.addColorStop(1, "rgba(34,211,238,0.06)");
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.strokeStyle = "rgba(34,211,238,0.85)";
    ctx.stroke();

    // Decoded spots from the last slot, at the frequency the decoder reported.
    // If a marker does not line up with a trace, the reported Hz is wrong.
    ctx.textAlign = "left";
    for (const m of marks || []) {
      if (m.hz < loHz || m.hz > hiHz) continue;
      const x = xOf(m.hz);
      ctx.strokeStyle = "rgba(250,204,21,0.9)";
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
      ctx.fillStyle = "rgba(250,204,21,0.95)";
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x - 3 * dpr, 6 * dpr);
      ctx.lineTo(x + 3 * dpr, 6 * dpr);
      ctx.closePath();
      ctx.fill();
    }
  }

  onMount(() => { raf = requestAnimationFrame(draw); });
  onDestroy(() => { if (raf) cancelAnimationFrame(raf); });
</script>

<div class="ftx-spec-wrap">
  <canvas bind:this={canvas} style="height:{height}px"></canvas>
  <span class="ftx-spec-label">audio Hz — yellow marks = decoded spots</span>
</div>

<style>
  .ftx-spec-wrap {
    position: relative;
    width: 100%;
    margin-bottom: 0.35rem;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 0.375rem;
    background: rgba(0, 0, 0, 0.28);
    overflow: hidden;
  }
  .ftx-spec-wrap canvas {
    display: block;
    width: 100%;
  }
  .ftx-spec-label {
    position: absolute;
    top: 2px;
    right: 6px;
    font-size: 0.6rem;
    color: rgba(255, 255, 255, 0.4);
    pointer-events: none;
  }
</style>
