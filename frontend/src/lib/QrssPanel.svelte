<script>
  /**
   * QrssPanel.svelte — a QRSS grabber display.
   *
   * QRSS is CW sent so slowly that a dot lasts seconds instead of milliseconds.
   * At those speeds the signal occupies only a few tenths of a hertz, so it can
   * sit 20-30 dB below the noise floor and still be perfectly readable — but
   * only if the analysis bandwidth is narrow enough to match it.  That is the
   * whole trick, and it is why this cannot simply reuse the main waterfall:
   *
   *     Δf × T = 1
   *
   * A 0.09 Hz bin needs an 11-second transform.  The main waterfall runs at a
   * few Hz per bin so a QRSS trace is buried in one of its pixels.
   *
   * So this panel runs its own long FFT over the demodulated audio, and paints
   * the result the way grabbers have always shown it: frequency on the VERTICAL
   * axis, time scrolling left to right, one column per transform.
   *
   * Feed it with feedPCMData() from the audio.js QRSS tap.  It expects mono at
   * `sampleRate` — the same stream the spectrogram gets.
   */

  import { onDestroy } from "svelte";
  import { transformFlat } from "./fftRadix2.js";

  // ── Props ────────────────────────────────────────────────────────────────
  /** Mono PCM rate of the incoming stream (audio.audioOutputSps). */
  export let sampleRate = 12000;
  /** Key of QRSS_MODES below. */
  export let mode = "qrss10";
  /** Centre of the displayed slice, in audio Hz (where you tuned the beacon). */
  export let centerHz = 800;
  /** Total height of the displayed slice, in Hz. */
  export let spanHz = 100;
  /** dB added to every pixel before the colour map. */
  export let gain = 0;
  /** dB of range between "black" and "full scale". */
  export let range = 40;
  export let colorScheme = "rainbow";
  export let height = 260;
  export let showLabels = true;

  /**
   * Transform length per QRSS speed, at a 12 kHz nominal audio rate.
   *
   * The rule is that the analysis bin should be a little narrower than the
   * keying bandwidth, and the transform a little shorter than a dot — resolve
   * the tone, but still see the dot as a dash-length mark rather than smearing
   * two elements into one.  N is scaled to the actual sample rate at runtime,
   * so a 8 kHz or 48 kHz stream lands on the same resolution in Hz.
   */
  const QRSS_MODES = {
    qrss3:  { label: "QRSS 3",  dot: 3,  n12k: 16384 },   // 0.73 Hz / 1.4 s
    qrss6:  { label: "QRSS 6",  dot: 6,  n12k: 32768 },   // 0.37 Hz / 2.7 s
    qrss10: { label: "QRSS 10", dot: 10, n12k: 65536 },   // 0.18 Hz / 5.5 s
    qrss30: { label: "QRSS 30", dot: 30, n12k: 131072 },  // 0.09 Hz / 10.9 s
    qrss60: { label: "QRSS 60", dot: 60, n12k: 262144 },  // 0.05 Hz / 21.8 s
  };
  export const modes = QRSS_MODES;

  // Column rate as a fraction of the transform length.  Without overlap at all,
  // a dot straddling two transform boundaries is split into two half-strength
  // marks; at 2x that was fixed but a dot was still only ~4 columns wide, and
  // its edges quantised to half a window — so two dots and a dash of the same
  // beacon could render 4, 5 and 13 columns wide depending on where they
  // happened to fall.  Reading QRSS *is* judging mark lengths against each
  // other, so that jitter lands squarely on the one thing the panel exists to
  // show.  At 4x every mark is twice as many columns and its edges land within
  // a quarter of a window, which is what makes a dot and a dash separate at a
  // glance.
  //
  // This is purely the time axis: the transform length, and so the frequency
  // resolution and the sensitivity, are untouched.  It costs twice as many
  // FFTs, and the display scrolls twice as fast (at QRSS 6, a 1000 px panel
  // holds 11 minutes instead of 23 — still several repeats of a callsign).
  const OVERLAP = 4;

  let canvas;
  let ctx;
  let running = false;
  /**
   * Backing-store pixels per CSS pixel.
   *
   * The canvas used to be sized in CSS pixels while the stylesheet stretches it
   * to width:100%, so on any HiDPI screen the browser bilinearly upscaled the
   * whole panel.  That blur runs in BOTH axes, and the vertical one is the
   * expensive half: a DFCW beacon carries its dots and dashes in a 4 Hz step,
   * which at a 20 Hz span is a few tens of pixels — softened by exactly the
   * resampling this removes.
   *
   * Rounded to a whole number rather than used raw.  An integer factor keeps
   * one column exactly one CSS pixel wide, so the time axis, the scroll rate
   * and the apparent size of a mark are all unchanged from before; the extra
   * pixels go into resolution, not into rescaling the display.
   */
  let scale = 1;

  // Analysis state, rebuilt by configure() whenever N changes.
  let N = 0;
  let fill = null; // Float32Array(N)   ring of incoming samples
  let pos = 0;
  let re = null; // Float64Array(N)
  let im = null;
  let win = null; // Float32Array(N)   Hann
  let hop = 0;
  let sinceLastColumn = 0;

  let binHz = 0;
  let secsPerColumn = 0;
  /**
   * Displayed resolution, as opposed to analysis resolution.
   *
   * These two come apart the moment the slice holds more bins than the panel
   * has rows, and when they do the Speed setting stops buying what it claims:
   * QRSS 10 over a 100 Hz span is 546 bins, which a 260-row panel can only
   * show through a max() over pairs.  Surfaced in the status line because the
   * fix is a setting the operator chooses — a narrower span — and there is no
   * way to know the display is the limit without being told.
   */
  let rowHz = 0;
  let decimating = false;
  let statusText = "idle";

  // Adaptive display floor — see renderColumn().
  let dbCol = null;
  let baseline = null;

  // ── Analysis ─────────────────────────────────────────────────────────────

  function configure() {
    const m = QRSS_MODES[mode] || QRSS_MODES.qrss10;
    // Scale the 12 kHz reference length to the real rate, rounded to a power of
    // two — transformFlat() requires one.
    const want = (m.n12k * sampleRate) / 12000;
    let n = 1 << Math.round(Math.log2(Math.max(1024, want)));

    if (n === N) return;
    N = n;
    fill = new Float32Array(N);
    re = new Float64Array(N);
    im = new Float64Array(N);
    win = new Float32Array(N);
    for (let k = 0; k < N; k++) {
      win[k] = 0.5 - 0.5 * Math.cos((2 * Math.PI * k) / N);
    }
    pos = 0;
    hop = N / OVERLAP;
    sinceLastColumn = 0;
    binHz = sampleRate / N;
    secsPerColumn = hop / sampleRate;
    statusText = `${binHz.toFixed(3)} Hz/bin · ${(N / sampleRate).toFixed(1)} s window`;
  }

  /** Called from App.svelte with each mono PCM block. */
  export function feedPCMData(pcm) {
    if (!running || !fill) return;
    let i = 0;
    while (i < pcm.length) {
      const take = Math.min(N - pos, pcm.length - i);
      fill.set(pcm.subarray(i, i + take), pos);
      pos += take;
      i += take;
      sinceLastColumn += take;

      if (pos < N) return;

      // Full frame. Transform it, then slide the ring by one hop so the next
      // column overlaps this one.
      if (sinceLastColumn >= hop) {
        renderColumn();
        sinceLastColumn = 0;
      }
      fill.copyWithin(0, hop);
      pos = N - hop;
    }
  }

  function renderColumn() {
    for (let k = 0; k < N; k++) {
      re[k] = fill[k] * win[k];
      im[k] = 0;
    }
    try {
      transformFlat(re, im, false);
    } catch (e) {
      return; // display only — never take the audio path down with us
    }

    const loHz = centerHz - spanHz / 2;
    const hiHz = centerHz + spanHz / 2;
    let loBin = Math.max(0, Math.floor(loHz / binHz));
    let hiBin = Math.min(N >> 1, Math.ceil(hiHz / binHz));
    if (hiBin <= loBin) return;

    const h = canvas.height;
    // One column of the display is one CSS pixel, which is `scale` backing
    // pixels — stamped as a block so the mark keeps its width on screen.
    const col = ctx.createImageData(scale, h);
    const d = col.data;

    if (!dbCol || dbCol.length !== h) dbCol = new Float32Array(h);

    // How many analysis bins have to share one pixel row. Above 1 the display
    // cannot show them all, and WHICH ones it drops decides whether the panel
    // is usable: sampling one position per row (the old behaviour) skips bins
    // outright, and a QRSS trace is only one or two bins wide, so it fades in
    // and out — or never appears — as the beacon drifts across a row boundary.
    // A 200 Hz span at QRSS 6 puts 2.1 bins in every row of a 260 px panel,
    // i.e. about half the spectrum was not being looked at.
    const binsPerRow = (hiBin - loBin) / (h - 1 || 1);

    // Only touch the reactive pair when it actually moves, so a column every
    // second does not churn Svelte for a number that changes on retune.
    const rhz = binsPerRow * binHz;
    if (!rowHz || Math.abs(rhz - rowHz) > rowHz * 0.01) {
      rowHz = rhz;
      decimating = binsPerRow > 1;
    }

    // Row 0 is the TOP of the canvas and must be the HIGHEST frequency, the way
    // every grabber on the air draws it.
    for (let y = 0; y < h; y++) {
      const t = 1 - y / (h - 1 || 1);
      const b = loBin + t * (hiBin - loBin);
      let p;

      if (binsPerRow > 1) {
        // Decimating: take the PEAK of the bins this row covers. A signal can
        // then never hide between rows — the standard rule for a waterfall
        // being shown at less than its own resolution. Averaging instead would
        // dilute a one-bin trace into the noise sharing its row, which is
        // exactly the sensitivity QRSS exists to preserve.
        let k0 = Math.round(b - binsPerRow / 2);
        let k1 = Math.round(b + binsPerRow / 2);
        if (k0 < loBin) k0 = loBin;
        if (k1 > hiBin) k1 = hiBin;
        p = 0;
        for (let k = k0; k <= k1; k++) {
          const pk = re[k] * re[k] + im[k] * im[k];
          if (pk > p) p = pk;
        }
      } else {
        // Oversampling: interpolate in power, not dB, so a bin boundary does
        // not make a steady carrier flicker as it drifts across it.
        const b0 = Math.floor(b);
        const b1 = Math.min(hiBin, b0 + 1);
        const f = b - b0;
        const p0 = re[b0] * re[b0] + im[b0] * im[b0];
        const p1 = re[b1] * re[b1] + im[b1] * im[b1];
        p = p0 + (p1 - p0) * f;
      }

      dbCol[y] = 10 * Math.log10(p / (N * N) + 1e-14);
    }

    // Reference the colour map to the CURRENT noise, not to an absolute dBFS
    // level.  The absolute level depends on band, antenna, AGC and volume, so
    // any fixed floor is wrong within a day; a QRSS trace is defined by how far
    // it sits above the noise around it, which is exactly what this measures.
    // The 30th percentile of the column is noise by construction — a QRSS slice
    // is mostly empty spectrum with one or two narrow traces in it.
    const sorted = Float32Array.from(dbCol).sort();
    const noise = sorted[(h * 0.3) | 0];
    // Smooth across columns so a burst of QRM does not re-scale the whole
    // display for one frame, then snap back.
    baseline = baseline === null ? noise : baseline + 0.25 * (noise - baseline);

    for (let y = 0; y < h; y++) {
      const v = Math.max(0, Math.min(1, (dbCol[y] - baseline + gain) / range));
      const [r, g, bl] = colorOf(v);
      let o = y * scale * 4;
      for (let x = 0; x < scale; x++) {
        d[o] = r;
        d[o + 1] = g;
        d[o + 2] = bl;
        d[o + 3] = 255;
        o += 4;
      }
    }

    // Scroll left by one column, then stamp the new one on the right edge.
    const w = canvas.width;
    ctx.drawImage(canvas, -scale, 0);
    ctx.putImageData(col, w - scale, 0);
  }

  function colorOf(v) {
    switch (colorScheme) {
      case "grey":
        return [(v * 255) | 0, (v * 255) | 0, (v * 255) | 0];
      case "green":
        return [(v * v * 120) | 0, (v * 255) | 0, (v * v * 120) | 0];
      case "rainbow":
      default: {
        // Black -> blue -> cyan -> yellow -> red, the classic waterfall ramp.
        const x = v * 4;
        if (x < 1) return [0, 0, (x * 255) | 0];
        if (x < 2) return [0, ((x - 1) * 255) | 0, 255];
        if (x < 3) return [((x - 2) * 255) | 0, 255, ((3 - x) * 255) | 0];
        return [255, ((4 - x) * 255) | 0, 0];
      }
    }
  }

  // ── Lifecycle ────────────────────────────────────────────────────────────

  export function initialize(rate) {
    if (rate) sampleRate = rate;
    if (!canvas) return;
    ctx = canvas.getContext("2d", { willReadFrequently: false });
    resize();
    configure();
  }

  export function start() {
    if (!ctx) initialize(sampleRate);
    configure();
    running = true;
  }

  export function stop() {
    running = false;
    pos = 0;
    sinceLastColumn = 0;
    baseline = null;
  }

  export function clear() {
    if (!ctx) return;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    baseline = null;
  }

  /**
   * Render the grabber to a standalone PNG and hand back a Blob.
   *
   * Not a plain canvas.toBlob(): what is on screen is only the pixels. The
   * frequency scale is an HTML overlay and the caption is nowhere in the
   * canvas at all, so a bare export would be an unlabelled smear that means
   * nothing a week later. This draws the caption, the scale and the status
   * line around the image, so the file carries its own context — which is the
   * whole point of a grabber capture.
   *
   * `meta` supplies what the panel cannot know: { freqText, extra }.
   */
  export function toPNGBlob(meta = {}) {
    if (!canvas) return Promise.resolve(null);

    const PAD = 12;
    const GUTTER = 78; // frequency scale down the left
    const HEAD = 52;
    const FOOT = 26;
    // Laid out in CSS pixels, not backing-store pixels: PAD, GUTTER and the
    // font sizes below are fixed, so sizing the sheet from a HiDPI backing
    // store would leave a postage-stamp caption beside a huge image.  The
    // canvas is drawn scaled down into it, which supersamples — the export
    // comes out slightly cleaner than what is on screen, never coarser.
    const imgW = Math.round(canvas.width / scale);
    const imgH = Math.round(canvas.height / scale);
    const out = document.createElement("canvas");
    out.width = imgW + GUTTER + PAD;
    out.height = HEAD + imgH + FOOT;
    const g = out.getContext("2d");

    g.fillStyle = "#0b0f14";
    g.fillRect(0, 0, out.width, out.height);

    // ── Caption ──────────────────────────────────────────────────────────
    const now = new Date();
    const utc =
      now.toISOString().slice(0, 19).replace("T", " ") + " UTC";

    g.textBaseline = "middle";
    g.fillStyle = "#7ee0ff";
    g.font = "bold 20px ui-monospace, SFMono-Regular, Menlo, monospace";
    g.fillText("QRSS", PAD, 22);

    g.fillStyle = "#e6f0ff";
    g.font = "bold 18px ui-monospace, SFMono-Regular, Menlo, monospace";
    if (meta.freqText) g.fillText(meta.freqText, PAD + 72, 22);

    g.fillStyle = "#8ba7bf";
    g.font = "14px ui-monospace, SFMono-Regular, Menlo, monospace";
    g.textAlign = "right";
    g.fillText(utc, out.width - PAD, 22);
    g.textAlign = "left";

    const sub = [QRSS_MODES[mode]?.label ?? mode, meta.extra]
      .filter(Boolean)
      .join("   ·   ");
    g.fillStyle = "#8ba7bf";
    g.font = "13px ui-monospace, SFMono-Regular, Menlo, monospace";
    g.fillText(sub, PAD, HEAD - 14);

    // ── The grabber image ────────────────────────────────────────────────
    g.drawImage(canvas, GUTTER, HEAD, imgW, imgH);
    g.strokeStyle = "#374151";
    g.lineWidth = 1;
    g.strokeRect(GUTTER - 0.5, HEAD - 0.5, imgW + 1, imgH + 1);

    // ── Frequency scale, the overlay the canvas itself does not carry ────
    g.fillStyle = "#8ba7bf";
    g.font = "12px ui-monospace, SFMono-Regular, Menlo, monospace";
    g.textAlign = "right";
    g.strokeStyle = "#4b5563";
    for (const t of ticks) {
      const y = HEAD + (t.pct / 100) * imgH;
      if (y < HEAD - 1 || y > HEAD + imgH + 1) continue;
      g.fillText(`${t.hz} Hz`, GUTTER - 8, y);
      g.beginPath();
      g.moveTo(GUTTER - 5, y + 0.5);
      g.lineTo(GUTTER, y + 0.5);
      g.stroke();
    }
    g.textAlign = "left";

    // ── Status line, as shown under the panel ────────────────────────────
    g.fillStyle = "#6b8299";
    g.font = "12px ui-monospace, SFMono-Regular, Menlo, monospace";
    const foot = [
      statusText,
      secsPerColumn ? `${secsPerColumn.toFixed(1)} s/column` : "",
      rowHz ? `${rowHz.toFixed(3)} Hz/row` : "",
    ]
      .filter(Boolean)
      .join("   ·   ");
    g.fillText(foot, GUTTER, HEAD + imgH + FOOT / 2);

    return new Promise((resolve) => out.toBlob(resolve, "image/png"));
  }

  function resize() {
    if (!canvas || !canvas.parentElement) return;
    const cssW = canvas.parentElement.clientWidth || 800;
    const s = Math.max(1, Math.round(window.devicePixelRatio || 1));
    const w = Math.round(cssW * s);
    const h = Math.round(height * s);
    if (canvas.width !== w || canvas.height !== h || scale !== s) {
      scale = s;
      canvas.width = w;
      canvas.height = h;
      // Pin the layout HEIGHT in CSS pixels, so the panel does not grow by
      // `scale` on a HiDPI screen.  The width is deliberately left to the
      // stylesheet's width:100%, which keeps the canvas responsive to its
      // container the way it has always been — the backing store is already
      // cssW * scale, so at the current container width the browser maps it
      // one-to-one and the resampling is gone.
      canvas.style.height = height + "px";
      clear();
    }
  }

  // Re-plan when the speed or the stream rate changes.  Not on centreHz/spanHz:
  // those only affect how an already-computed spectrum is sliced, so changing
  // them takes effect on the next column with no loss of history.
  $: if (ctx && (mode || sampleRate)) configure();
  // Height is a prop, so it can change under a running panel — resize() is what
  // reallocates the backing store, and without this the select would relabel
  // the control while the canvas kept its old row count.
  $: if (ctx && height) resize();

  onDestroy(() => stop());

  // ── Axis labels ──────────────────────────────────────────────────────────
  // Ticks every 10 Hz, or every 5 Hz on a narrow span.
  $: tickStep = spanHz <= 40 ? 5 : spanHz <= 120 ? 10 : 25;
  $: ticks = (() => {
    const out = [];
    const lo = centerHz - spanHz / 2;
    const hi = centerHz + spanHz / 2;
    const first = Math.ceil(lo / tickStep) * tickStep;
    for (let f = first; f <= hi; f += tickStep) {
      out.push({ hz: f, pct: (1 - (f - lo) / spanHz) * 100 });
    }
    return out;
  })();
</script>

<div class="qrss-wrap">
  <div class="qrss-canvas-holder">
    <canvas bind:this={canvas}></canvas>
    {#if showLabels}
      <div class="qrss-axis">
        {#each ticks as t}
          <span class="qrss-tick" style="top:{t.pct}%">{t.hz} Hz</span>
        {/each}
      </div>
    {/if}
  </div>
  <div class="qrss-status">
    <span>{QRSS_MODES[mode]?.label ?? mode}</span>
    <span>{statusText}</span>
    <span>{secsPerColumn ? secsPerColumn.toFixed(1) + " s/column" : ""}</span>
    <span class:qrss-warn={decimating}
      >{rowHz
        ? rowHz.toFixed(3) +
          " Hz/row" +
          (decimating ? " — display is the limit, narrow the Span" : "")
        : ""}</span
    >
  </div>
</div>

<svelte:window on:resize={resize} />

<style>
  .qrss-wrap {
    width: 100%;
  }
  .qrss-canvas-holder {
    position: relative;
    width: 100%;
    background: #000;
    border: 1px solid #374151;
    border-radius: 0.375rem;
    overflow: hidden;
  }
  .qrss-canvas-holder canvas {
    display: block;
    width: 100%;
  }
  .qrss-axis {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }
  .qrss-warn {
    color: #fbbf24;
  }
  .qrss-tick {
    position: absolute;
    left: 2px;
    transform: translateY(-50%);
    font-size: 10px;
    line-height: 1;
    color: #9ca3af;
    text-shadow:
      0 0 3px #000,
      0 0 3px #000;
  }
  .qrss-status {
    display: flex;
    justify-content: space-between;
    gap: 0.5rem;
    font-size: 11px;
    color: #9ca3af;
    padding: 2px 4px 0;
  }
</style>
