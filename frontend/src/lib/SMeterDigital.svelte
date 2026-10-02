<script>
  /**
   * SMeterDigital.svelte — the segmented (bar-graph) S-meter.
   *
   * Extracted verbatim from the `App__*digital_smeter_` variants, alongside
   * SMeterAnalog.svelte, so the four App files stop carrying two full copies of
   * the meter between them.  drawSMeter() and setSignalStrength() are unchanged.
   *
   * The input differs from the analog meter's on purpose.  This meter has always
   * been driven from the *raw* audio.getPowerDb() plus audio.smeter_offset, not
   * from the calibrated dBm the analog face uses, so it takes those two numbers
   * and does its own mapping — exactly as the inline code did.  Feeding it the
   * calibrated value instead would shift every reading, so the split stays.
   *
   * As in SMeterAnalog, the canvas is addressed by id rather than bind:this to
   * keep the drawing code byte-identical to what has been on air; the desktop and
   * mobile layouts are mutually exclusive so the id stays unique.
   */

  import { onMount } from "svelte";

  /** Raw audio.getPowerDb(). */
  export let rawDb = -130;
  /** audio.smeter_offset. */
  export let smeterOffset = 0;
  /** Mobile layout. Only affects the canvas' initial attributes — drawSMeter()
   *  sets width/height itself on every frame, so both render identically. */
  export let mobile = false;

  // Segment count of the bar — used by both the draw and the mapping below.
  const numberOfDots = 35;

  // Inline in the App files this ran only from _smeterTick(), i.e. always after
  // the canvas was in the DOM.  As a component the reactive block at the bottom
  // fires once *before* mount, so both the gate and the null check below are
  // required — drawSMeter() never checked its canvas.
  let mounted = false;

  // Function to draw the S-meter
  function drawSMeter(value) {
    const canvas = document.getElementById("sMeter");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    canvas.width = 300;
    canvas.height = 80;

    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    const segmentWidth = 6;
    const segmentGap = 3;
    const segmentHeight = 8;
    const lineY = 15;
    const labelY = 25;
    const tickHeight = 5;
    const longTickHeight = 5;

    const s9Position = width / 2;

    ctx.strokeStyle = "#a7e6fe";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, lineY);
    ctx.lineTo(s9Position, lineY);
    ctx.stroke();

    ctx.strokeStyle = "#ed1c24";
    ctx.beginPath();
    ctx.moveTo(s9Position, lineY);
    ctx.lineTo(268, lineY);
    ctx.stroke();

    for (let i = 0; i < 30; i++) {
      const x = i * (segmentWidth + segmentGap);
      if (i < value) {
        ctx.fillStyle = i < 17 ? "#a3eced" : "#d9191c";
      } else {
        ctx.fillStyle = i < 17 ? "#003333" : "#330000";
      }
      ctx.fillRect(x, 0, segmentWidth, segmentHeight);
    }

    ctx.font = "13px monospace";
    ctx.textAlign = "center";

    const labels = ["S1", "3", "5", "7", "9", "+20", "+40", "+60dB"];

    for (let i = 0; i <= 16; i++) {
      const x = i * 16.6970588235;
      ctx.fillStyle = x <= s9Position ? "#a3eced" : "#f00";

      if (i % 2 === 1) {
        ctx.fillRect(x, lineY, 1, longTickHeight + 2);
        if ((i - 1) / 2 < labels.length) {
          ctx.fillText(labels[(i - 1) / 2], x, labelY + 8);
        }
      } else {
        ctx.fillRect(x, lineY, 1, tickHeight);
      }
    }

    // ===== LED windows: dBm | dBuV | SNR | NF (centered at the bottom) =====
    (() => {
      const VISUAL_DBM_OFFSET = 5;
      const dbm = (typeof window !== "undefined" && typeof window._lastPowerDb === "number") ? Math.round(window._lastPowerDb + VISUAL_DBM_OFFSET) : null;
      const snr = (typeof window !== "undefined" && typeof window._lastSnr === "number") ? Math.round(window._lastSnr) : null;
      const nf  = (typeof window !== "undefined" && typeof window._noiseFloorDb === "number") ? Math.round(window._noiseFloorDb + VISUAL_DBM_OFFSET) : null;
      // dBuV = dBm + 107 (50-ohm)
      const dbuv = (dbm != null) ? (dbm + 107) : null;

      const rectW = 40;
      const rectH = 25;
      const gap = 30;
      const baseY = 50;           // just below the scale labels
      const centerX = width / 2;
      const x1 = Math.round(centerX - rectW * 2 - gap * 1.5);
      const x2 = Math.round(centerX - rectW - gap * 0.5);
      const x3 = Math.round(centerX + gap * 0.5);
      const x4 = Math.round(centerX + rectW + gap * 1.5);

      ctx.font = "12px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      ctx.fillStyle = "#7acb97";
      ctx.fillText("dBm", x1 + rectW/2, baseY + 6);
      ctx.fillText("dB\u00B5V", x2 + rectW/2, baseY + 6);
      ctx.fillStyle = "#6bb688";
      ctx.fillText("SNR", x3 + rectW/2, baseY + 6);
      ctx.fillText("NF", x4 + rectW/2, baseY + 6);
      ctx.fillStyle = "#d6fbe3";
      const dTxt = (dbm != null ? (dbm > 0 ? "+"+dbm : ""+dbm) : "--");
      const uTxt = (dbuv != null ? (dbuv > 0 ? "+"+dbuv : ""+dbuv) : "--");
      const sTxt = (snr != null ? (snr + " dB") : "--");
      const nTxt = (nf  != null ? (nf > 0 ? "+"+nf : ""+nf) : "--");
      ctx.fillText(dTxt, x1 + rectW/2, baseY + rectH - 7);
      ctx.fillText(uTxt, x2 + rectW/2, baseY + rectH - 7);
      ctx.fillText(sTxt, x3 + rectW/2, baseY + rectH - 7);
      ctx.fillText(nTxt, x4 + rectW/2, baseY + rectH - 7);
    })();
  }

  function setSignalStrength(db) {
    db = Math.min(Math.max(db, -100), 0);

    // 👉 Trimm bars in digital smeter.  +1 on both layouts: /mobile's own copy
    // of the bar (in mobile/Mobile.svelte) carries the same +1, so all three
    // digital bars read alike.  The branch is kept even though the two sides
    // now match, because this is the place to pull them apart again.  One
    // segment is about 4.3 dB on this 35-dot scale, so change it in whole
    // segments only — there is no finer step here.
    const DIGITAL_BAR_TRIM = mobile ? 1 : 1;
    const activeSegments = Math.max(
      0,
      Math.min(numberOfDots, Math.round(((db + 100) * numberOfDots) / 100) + DIGITAL_BAR_TRIM)
    );

    drawSMeter(activeSegments);
  }

  // Was inline in _smeterTick(): raw dB -> the scale setSignalStrength expects.
  $: if (mounted) setSignalStrength((rawDb / 150) * 100 + smeterOffset);

  onMount(() => {
    mounted = true;
    setSignalStrength((rawDb / 150) * 100 + smeterOffset);
  });
</script>

<!-- SMeter -->
{#if mobile}
  <canvas id="sMeter" width="300" height="80"></canvas>
{:else}
  <canvas id="sMeter" class="desktop" width="300" height="80"></canvas>
{/if}

<style>
  /* Moved out of App.svelte during the four-file merge — see SMeterAnalog. */
  #sMeter {
    width: 290px;
    height: 80px;
    background-color: transparent;
    display: block;
    margin-left: 30px;
    margin-top: 5px;
  }
  /* Desktop: no indent, so the middle panel is narrow enough for the outer
     panels to share one width inside the 1380px row. */
  #sMeter.desktop {
    margin-left: 0;
  }
</style>
