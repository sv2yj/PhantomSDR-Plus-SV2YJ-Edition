<script>
  /**
   * SMeterAnalog.svelte — the analog (moving-needle) S-meter.
   *
   * Extracted verbatim from the `App__*analog_smeter_` variants so the four App
   * files stop carrying ~550 duplicated lines of canvas code between them.  The
   * drawing routines are unchanged; only their surroundings moved.
   *
   * Two differences from the inline original, both deliberate:
   *
   *   1. The needle smoothing is now actually wired up.  setSMeterPower() and
   *      _animateNeedle() existed in every variant but nothing ever called them —
   *      _smeterTick() drew the raw per-frame value.  The exponential smoother
   *      (SMOOTH_TIME_MS) now sits between the incoming dBm and the draw.
   *
   *   2. The dBm -> 0..100 needle mapping moved in from _smeterTick(), since it
   *      is this meter's own scale and means nothing to the digital one.
   *
   * The dead setSignalStrength() calibration curve was dropped: it was a second,
   * never-invoked mapping, and reviving it on top of the one above would apply
   * the calibration twice.
   *
   * The draw routines still address their canvases by id (getElementById) rather
   * than bind:this.  That is intentional — it keeps ~550 lines byte-identical to
   * the code that has been on air, so this refactor cannot change what is drawn.
   * Only one instance is ever mounted (the desktop and mobile layouts are
   * mutually exclusive `{#if !Device.isMobile}` branches), so the ids stay unique.
   */
     import { onMount, onDestroy, createEventDispatcher } from "svelte";
     const dispatch = createEventDispatcher(); 

  /** Calibrated signal power in dBm, as computed by the parent's _smeterTick(). */
  export let dbm = -130;
  /** Render the compact mobile bar instead of the round desktop face. */
  export let mobile = false;

  // Inline in the App files, the draw could assume its canvas was in the DOM.
  // As a component the reactive block below runs once *before* mount, and the
  // smoothing RAF can outlive the component, so both are gated on these.
  let mounted = false;
  let destroyed = false;

// --- Smooth S-Meter needle animation (add this) ------------------------------
let currentPower = 0;   // what we actually draw (smoothed)
let targetPower  = 0;   // latest requested value
let animating    = false;
let _lastTs      = 0;
let _smeterRaf   = null;

// Time constant (ms): lower = snappier, higher = smoother.
// 16 ms is one frame at 60 fps — the practical floor.  The smoother is stepped
// once per animation frame, so a constant shorter than a frame cannot make the
// needle move any sooner; it only rounds alpha closer to 1, i.e. straight to the
// raw value.  At 16 ms the needle covers ~63% of the gap in the first frame and
// is there within ~3 frames (~50 ms), while still absorbing single-frame spikes.
const SMOOTH_TIME_MS = 16; //lower ->faster, higher -> smoother e.g. 120-2000
// Stop when we're within this many "power" units
const STOP_EPS = 0.02;

// --- S-Meter face theme -----------------------------------------------------
// 'dark' = original dark brushed metal; 'amber' = light (pale grey) face;
// 'green' = warm aged-amber face. Same light-face artwork for 'amber' and
// 'green'; only the background gradient differs.
// Click the meter to cycle dark -> amber -> green; the choice persists.
let smeterTheme = 'dark';
// One-time reset: bump SMETER_PREF_VERSION (via ./smeter_theme.sh) to make
// every browser forget its saved face ONCE, so the 'dark' default above takes
// over. The reset runs only while the stored version is behind; afterwards the
// click-toggle persists normally again. Managed by smeter_theme.sh.
const SMETER_PREF_VERSION = 8;
try {
  const ver = parseInt(localStorage.getItem('smeterThemePrefV') || '0', 10);
  if (!(ver >= SMETER_PREF_VERSION)) {
    localStorage.removeItem('smeterTheme');
    localStorage.setItem('smeterThemePrefV', String(SMETER_PREF_VERSION));
  }
  const _st = localStorage.getItem('smeterTheme');
  if (_st === 'amber' || _st === 'dark' || _st === 'green') smeterTheme = _st;
} catch (e) {}

// Click order: dark -> amber -> green -> dark ...
const SMETER_THEMES = ['dark', 'amber', 'green'];

function toggleSMeterTheme() {
  const i = SMETER_THEMES.indexOf(smeterTheme);
  smeterTheme = SMETER_THEMES[(i + 1) % SMETER_THEMES.length];
  try { localStorage.setItem('smeterTheme', smeterTheme); } catch (e) {}
  dispatch('themechange', { theme: smeterTheme });  
// Redraw immediately at the current needle position (works even when idle).
  drawSMeter(currentPower);
}

function setSMeterPower(value) {
  // clamp 0..100 like your gauge
  targetPower = Math.max(0, Math.min(100, value|0 === value ? value : +value));
  if (!animating && mounted && !destroyed) {
    animating = true;
    _lastTs = performance.now();
    requestAnimationFrame(_animateNeedle);
  }
}

function _animateNeedle(ts) {
  if (destroyed) { animating = false; return; }
  const dt = Math.min(100, ts - _lastTs); // cap big frame gaps
  _lastTs = ts;

  // Exponential smoothing with time-constant (frame-rate independent)
  const alpha = 1 - Math.exp(-dt / SMOOTH_TIME_MS);
  currentPower += (targetPower - currentPower) * alpha;

  // Draw using the smoothed value.  Via the wrapper, not drawSMeterDesktop:
  // this path was written for the desktop face back when it was dead code, and
  // calling it directly would leave the mobile bar frozen.
  drawSMeter(currentPower);

  if (Math.abs(targetPower - currentPower) > STOP_EPS) {
    requestAnimationFrame(_animateNeedle);
  } else {
    currentPower = targetPower;
    drawSMeter(currentPower); // final snap to exact target
    animating = false;
  }
}

  function drawSMeterDesktop(powerValue) {
    const canvas = document.getElementById("sMeter");
    if (!canvas) {
      console.error("S-Meter canvas not found!");
      return;
    }

    const ctx = canvas.getContext("2d");
    canvas.width = 220;
    canvas.height = 220;

    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height - 50;
    const radius = 160;

    // Rounded rectangle clip
    const cornerRadius = 20;
    ctx.beginPath();
    ctx.moveTo(cornerRadius, 0);
    ctx.lineTo(canvas.width - cornerRadius, 0);
    ctx.quadraticCurveTo(canvas.width, 0, canvas.width, cornerRadius);
    ctx.lineTo(canvas.width, canvas.height - cornerRadius);
    ctx.quadraticCurveTo(
      canvas.width,
      canvas.height,
      canvas.width - cornerRadius,
      canvas.height,
    );
    ctx.lineTo(cornerRadius, canvas.height);
    ctx.quadraticCurveTo(0, canvas.height, 0, canvas.height - cornerRadius);
    ctx.lineTo(0, cornerRadius);
    ctx.quadraticCurveTo(0, 0, cornerRadius, 0);
    ctx.closePath();
    ctx.clip();

    ctx.clearRect(0, 0, width, height);

    const startAngle = Math.PI * 1.25;
    const endAngle = Math.PI * 1.75;
    const totalSweep = endAngle - startAngle;

    // Clamp power value
    powerValue = Math.min(Math.max(powerValue, 0), 100);
    const normalizedValue = powerValue / 100;
    const needleAngle = startAngle + normalizedValue * totalSweep;

    const green = smeterTheme === 'green';
    // Light face artwork is shared by the 'amber' (pale) and 'green' faces.
    const amber = green || smeterTheme === 'amber';

    if (amber) {
      // ===== Light / Green Illuminated Face =====
      const bgGradient = ctx.createRadialGradient(
        centerX,
        centerY - 40,
        10,
        centerX,
        centerY - 40,
        radius + 20,
      );
            if (green) {
        bgGradient.addColorStop(0, "#d8f0c8");
        bgGradient.addColorStop(0.45, "#9fbd7a");
        bgGradient.addColorStop(0.8, "#627b46");
        bgGradient.addColorStop(1, "#394d2c");
        bgGradient.addColorStop(1.0, "#22301c");
        } else {
        bgGradient.addColorStop(0, "#fff6df");
        bgGradient.addColorStop(0.45, "#e9c98a");
        bgGradient.addColorStop(0.8, "#c08d45");
        bgGradient.addColorStop(1, "#845223");
        bgGradient.addColorStop(1.0, "#4b2b12");
      }
      ctx.fillStyle = bgGradient;
      ctx.fillRect(0, 0, width, height);

      // Faint warm grain for a glassy (non-flat) look
      ctx.globalAlpha = 0.04;
      for (let i = 0; i < height; i += 2) {
        const shade = (Math.random() * 20 + 200) | 0;
        ctx.strokeStyle = `rgb(${shade},${(shade * 0.7) | 0},${(shade * 0.3) | 0})`;
        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(width, i);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    } else {
      // ===== Dark Brushed Metal Background =====
      const bgGradient = ctx.createLinearGradient(0, 0, width, height);
      bgGradient.addColorStop(0, "#0a0a0a");
      bgGradient.addColorStop(0.4, "#111");
      bgGradient.addColorStop(0.6, "#1b1b1b");
      bgGradient.addColorStop(1, "#050505");
      ctx.fillStyle = bgGradient;
      ctx.fillRect(0, 0, width, height);

      // Add subtle brushed texture (horizontal)
      ctx.globalAlpha = 0.15;
      for (let i = 0; i < height; i += 2) {
        const shade = (Math.random() * 20 + 30) | 0;
        ctx.strokeStyle = `rgb(${shade},${shade},${shade})`;
        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(width, i);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    // ===== Chrome Rim (dark theme only; transparent in light theme) =====
    if (!amber) {
      const rimGradient = ctx.createLinearGradient(
        0,
        centerY - radius,
        0,
        centerY + radius,
      );
      rimGradient.addColorStop(0, "#333");
      rimGradient.addColorStop(0.25, "#111");
      rimGradient.addColorStop(0.5, "#555");
      rimGradient.addColorStop(0.75, "#0a0a0a");
      rimGradient.addColorStop(1, "#000");

      ctx.lineWidth = 14;
      ctx.strokeStyle = rimGradient;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius - 6, startAngle, endAngle);
      ctx.stroke();

      // Rim reflection highlight
      const rimHighlight = ctx.createLinearGradient(
        centerX - 60,
        centerY - 80,
        centerX + 60,
        centerY + 100,
      );
      rimHighlight.addColorStop(0, "rgba(255,255,255,0.05)");
      rimHighlight.addColorStop(0.5, "rgba(255,255,255,0.25)");
      rimHighlight.addColorStop(1, "rgba(255,255,255,0.05)");
      ctx.lineWidth = 2;
      ctx.strokeStyle = rimHighlight;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius - 6, startAngle + 0.05, endAngle - 0.05);
      ctx.stroke();
    }

    // ===== Scale Base groove (dark theme only; hidden in light theme) =====
    if (!amber) {
      const scaleGradient = ctx.createLinearGradient(
        0,
        centerY - radius,
        0,
        centerY + radius,
      );
      scaleGradient.addColorStop(0, "#111");
      scaleGradient.addColorStop(0.5, "#080808");
      scaleGradient.addColorStop(1, "#000");
      ctx.strokeStyle = scaleGradient;
      ctx.lineWidth = 18;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius - 15, startAngle, endAngle);
      ctx.stroke();
    }

    // ===== Color Segments =====
    const totalSegments = 32;
    const segmentGap = 0.008;
    const segmentWidth = totalSweep / totalSegments - segmentGap;

    for (let i = 0; i < totalSegments; i++) {
      const segmentProgress = i / totalSegments;
      const segStart =
        startAngle + (i * totalSweep) / totalSegments + segmentGap / 2;
      const segEnd = segStart + segmentWidth;

      let color1, color2;
      if (amber) {
        if (segmentProgress < 0.56) {
          // S1..S9 region: near-black scale band
          const blackProgress = segmentProgress / 0.56;
          color1 = `rgb(${Math.floor(30 - blackProgress * 12)}, ${Math.floor(26 - blackProgress * 10)}, ${Math.floor(20 - blackProgress * 8)})`;
          color2 = `rgb(${Math.floor(12 - blackProgress * 6)}, ${Math.floor(10 - blackProgress * 5)}, ${Math.floor(8 - blackProgress * 4)})`;
        } else {
          // +20..+60 overload region: red scale band
          const redProgress = (segmentProgress - 0.56) / 0.44;
          color1 = `rgb(${Math.floor(216 - redProgress * 40)}, ${Math.floor(30 - redProgress * 20)}, ${Math.floor(30 - redProgress * 20)})`;
          color2 = `rgb(${Math.floor(170 - redProgress * 40)}, 8, 8)`;
        }
      } else {
        if (segmentProgress < 0.56) {
          const blueProgress = segmentProgress / 0.56;
          color1 = `rgb(${Math.floor(0 + blueProgress * 20)}, ${Math.floor(120 - blueProgress * 20)}, ${Math.floor(200 - blueProgress * 40)})`;
          color2 = `rgb(${Math.floor(0 + blueProgress * 20)}, ${Math.floor(100 - blueProgress * 20)}, ${Math.floor(170 - blueProgress * 40)})`;
        } else {
          const redProgress = (segmentProgress - 0.56) / 0.44;
          color1 = `rgb(${Math.floor(255 - redProgress * 40)}, ${Math.floor(50 - redProgress * 40)}, ${Math.floor(50 - redProgress * 40)})`;
          color2 = `rgb(${Math.floor(200 - redProgress * 40)}, 0, 0)`;
        }
      }

      const segGradient = ctx.createLinearGradient(
        centerX + Math.cos(segStart) * radius,
        centerY + Math.sin(segStart) * radius,
        centerX + Math.cos(segEnd) * radius,
        centerY + Math.sin(segEnd) * radius,
      );
      segGradient.addColorStop(0, color1);
      segGradient.addColorStop(1, color2);

      ctx.strokeStyle = segGradient;
      ctx.lineWidth = 12;
      ctx.lineCap = "butt";
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius - 15, segStart, segEnd);
      ctx.stroke();

      // Metallic shine line
      ctx.strokeStyle = "rgba(255,255,255,0.1)";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius - 21, segStart, segEnd);
      ctx.stroke();

      // Outer dark shadow
      ctx.strokeStyle = "rgba(0,0,0,0.35)";
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius - 9, segStart, segEnd);
      ctx.stroke();
    }

    // ===== Major Ticks and Labels =====
    const labels = ["S1", "3", "5", "7", "9", "+20", "+40", "+60"];
    const majorMarks = labels.length - 1;

    for (let i = 0; i <= majorMarks; i++) {
      const angle = startAngle + (i / majorMarks) * totalSweep;
      const markStart = radius - 26;
      const markEnd = radius - 38;

      const tickGradient = ctx.createLinearGradient(
        centerX + Math.cos(angle) * markStart,
        centerY + Math.sin(angle) * markStart,
        centerX + Math.cos(angle) * markEnd,
        centerY + Math.sin(angle) * markEnd,
      );
      if (amber) {
        if (i <= 4) {
          tickGradient.addColorStop(0, "#1a1a1a");
          tickGradient.addColorStop(1, "#000");
        } else {
          tickGradient.addColorStop(0, "#d81f1f");
          tickGradient.addColorStop(1, "#8a0000");
        }
      } else {
        tickGradient.addColorStop(0, "#ddd");
        tickGradient.addColorStop(1, "#666");
      }

      ctx.strokeStyle = tickGradient;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(
        centerX + Math.cos(angle) * markStart,
        centerY + Math.sin(angle) * markStart,
      );
      ctx.lineTo(
        centerX + Math.cos(angle) * markEnd,
        centerY + Math.sin(angle) * markEnd,
      );
      ctx.stroke();

      const labelRadius = radius - 55;
      const labelX = centerX + Math.cos(angle) * labelRadius;
      const labelY = centerY + Math.sin(angle) * labelRadius;

      ctx.font = "bold 13px 'Courier New', monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      if (amber) {
        ctx.fillStyle = "rgba(255,240,200,0.55)";
        ctx.fillText(labels[i], labelX + 0.8, labelY + 0.8);
        ctx.fillStyle = i <= 4 ? "#141414" : "#c1121f";
        ctx.fillText(labels[i], labelX, labelY);
      } else {
        ctx.fillStyle = "rgba(0,0,0,0.9)";
        ctx.fillText(labels[i], labelX + 1, labelY + 1);
        ctx.fillStyle = i <= 4 ? "#33bbff" : "#ff9933";
        ctx.fillText(labels[i], labelX, labelY);
      }
    }

    // ===== Minor Ticks =====
    for (let i = 0; i < majorMarks * 2; i++) {
      if (i % 2 === 1) {
        const angle = startAngle + (i / (majorMarks * 2)) * totalSweep;
        const markStart = radius - 26;
        const markEnd = radius - 33;
        const minorFrac = i / (majorMarks * 2);
        ctx.strokeStyle = amber
          ? (minorFrac < 4 / majorMarks ? "rgba(20,20,20,0.7)" : "rgba(180,20,20,0.75)")
          : "rgba(160,160,160,0.5)";
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(
          centerX + Math.cos(angle) * markStart,
          centerY + Math.sin(angle) * markStart,
        );
        ctx.lineTo(
          centerX + Math.cos(angle) * markEnd,
          centerY + Math.sin(angle) * markEnd,
        );
        ctx.stroke();
      }
    }

    // ===== Center Pivot (Dark Metal) =====
    const pivotOuter = ctx.createRadialGradient(
      centerX,
      centerY,
      0,
      centerX,
      centerY,
      15,
    );
    if (amber) {
      pivotOuter.addColorStop(0, "#fafafa");
      pivotOuter.addColorStop(0.5, "#dbd9d9");
      pivotOuter.addColorStop(1, "#b8b6b6");
    } else {
      pivotOuter.addColorStop(0, "#666");
      pivotOuter.addColorStop(0.5, "#222");
      pivotOuter.addColorStop(1, "#000");
    }
    ctx.fillStyle = pivotOuter;
    ctx.beginPath();
    ctx.arc(centerX, centerY, 15, 0, Math.PI * 2);
    ctx.fill();

    const pivotInner = ctx.createRadialGradient(
      centerX - 2,
      centerY - 2,
      0,
      centerX,
      centerY,
      9,
    );
    if (amber) {
      pivotInner.addColorStop(0, "#555");
      pivotInner.addColorStop(1, "#111");
    } else {
      pivotInner.addColorStop(0, "#999");
      pivotInner.addColorStop(1, "#222");
    }
    ctx.fillStyle = pivotInner;
    ctx.beginPath();
    ctx.arc(centerX, centerY, 9, 0, Math.PI * 2);
    ctx.fill();

    // ===== Needle (Deep Metallic Red) =====
    const needleLength = radius - 30;
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.8)";
    ctx.shadowBlur = 18;
    ctx.shadowOffsetX = 3;
    ctx.shadowOffsetY = 3;

    const needleGradient = ctx.createLinearGradient(
      centerX,
      centerY,
      centerX + Math.cos(needleAngle) * needleLength,
      centerY + Math.sin(needleAngle) * needleLength,
    );
    if (amber) {
      needleGradient.addColorStop(0, "#2a2a2a");
      needleGradient.addColorStop(0.5, "#0a0a0a");
      needleGradient.addColorStop(1, "#000");
    } else {
      needleGradient.addColorStop(0, "#660000");
      needleGradient.addColorStop(0.5, "#cc0000");
      needleGradient.addColorStop(1, "#ff3333");
    }

    ctx.fillStyle = needleGradient;
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(
      centerX + Math.cos(needleAngle - 0.06) * 35,
      centerY + Math.sin(needleAngle - 0.06) * 35,
    );
    ctx.lineTo(
      centerX + Math.cos(needleAngle) * needleLength,
      centerY + Math.sin(needleAngle) * needleLength,
    );
    ctx.lineTo(
      centerX + Math.cos(needleAngle + 0.06) * 35,
      centerY + Math.sin(needleAngle + 0.06) * 35,
    );
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // ===== Center Screw (Dark Chrome) =====
    const screwGrad = ctx.createRadialGradient(
      centerX - 2,
      centerY - 2,
      0,
      centerX,
      centerY,
      8,
    );
    screwGrad.addColorStop(0, "#bbb");
    screwGrad.addColorStop(0.4, "#444");
    screwGrad.addColorStop(1, "#111");
    ctx.fillStyle = screwGrad;
    ctx.beginPath();
    ctx.arc(centerX, centerY, 6, 0, Math.PI * 2);
    ctx.fill();

// ===== LED Windows (dBm & SNR) beneath the center screw =====
    (function () {
      const VISUAL_DBM_OFFSET = 5; // 👈 +10 or -10 or whatever you want

      const dbm = (typeof window !== "undefined" && typeof window._lastPowerDb === "number") ? Math.round(window._lastPowerDb + VISUAL_DBM_OFFSET) : null;
      const snr = (typeof window !== "undefined" && typeof window._lastSnr === "number") ? Math.round(window._lastSnr) : null;
      // Tracked band noise floor, shown in the same calibrated dBm scale as the dBm window
      const nf  = (typeof window !== "undefined" && typeof window._noiseFloorDb === "number") ? Math.round(window._noiseFloorDb + VISUAL_DBM_OFFSET) : null;
      // dBuV = dBm + 107 (50-ohm)
      const dbuv = (dbm != null) ? (dbm + 107) : null;

      // Layout (four windows: dBm | dBuV | SNR | NF)
      const rectW = 40;
      const rectH = 25;
      const gap = 10;
      const baseY = centerY + 18;
      const x1 = Math.round(centerX - rectW * 2 - gap * 1.5);
      const x2 = Math.round(centerX - rectW - gap * 0.5);
      const x3 = Math.round(centerX + gap * 0.5);
      const x4 = Math.round(centerX + rectW + gap * 1.5);

      // Helper draw rounded rectangle
      const rr = (x, y, w, h, r=4) => {
        ctx.beginPath();
        ctx.moveTo(x+r, y);
        ctx.arcTo(x+w, y, x+w, y+h, r);
        ctx.arcTo(x+w, y+h, x, y+h, r);
        ctx.arcTo(x, y+h, x, y, r);
        ctx.arcTo(x, y, x+w, y, r);
        ctx.closePath();
      };

      // Transparent dBm/SNR windows for both light and dark S-meter themes.
      // Background fill, border, highlight and glow are intentionally skipped;
      // label/value colors below still change per theme.
      
      // Labels and values
      ctx.font = "12px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      ctx.fillStyle = amber ? "#000000" : "#7acb97";
      ctx.fillText("dBm", x1 + rectW/2, baseY + 6);
      ctx.fillStyle = amber ? "#000000" : "#7acb97";
      ctx.fillText("dB\u00B5V", x2 + rectW/2, baseY + 6);
      ctx.fillStyle = amber ? "#000000" : "#6bb688";
      ctx.fillText("SNR", x3 + rectW/2, baseY + 6);
      ctx.fillStyle = amber ? "#000000" : "#6bb688";
      ctx.fillText("NF", x4 + rectW/2, baseY + 6);
      ctx.fillStyle = amber ? "#5f0000" : "#d6fbe3";
      const dTxt = (dbm != null ? (dbm > 0 ? "+"+dbm : ""+dbm) : "--");
      const uTxt = (dbuv != null ? (dbuv > 0 ? "+"+dbuv : ""+dbuv) : "--");
      const sTxt = (snr != null ? (snr + " dB") : "--");
      const nTxt = (nf  != null ? (nf > 0 ? "+"+nf : ""+nf) : "--");
      ctx.font = "12px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
      ctx.fillText(dTxt, x1 + rectW/2, baseY + rectH - 7);
      ctx.fillText(uTxt, x2 + rectW/2, baseY + rectH - 7);
      ctx.fillText(sTxt, x3 + rectW/2, baseY + rectH - 7);
      ctx.fillText(nTxt, x4 + rectW/2, baseY + rectH - 7);
    })();


    ctx.strokeStyle = "#111";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(centerX - 4, centerY);
    ctx.lineTo(centerX + 4, centerY);
    ctx.stroke();

    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.beginPath();
    ctx.arc(centerX - 1, centerY - 1, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  // --- Mobile version of S-Meter (injected, refined) ---
  function drawSMeterMobile(value) {
    const canvas = document.getElementById("sMeterMobile");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    // Apply class for mobile styling
    canvas.classList.add("sMeterMobile");

    canvas.width = 300;
    canvas.height = 40;

    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    const segmentWidth = 6;
    const segmentGap = 3;
    const segmentHeight = 6;
    const lineY = 10;
    const labelY = 18;
    const tickHeight = 4;
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

    ctx.font = "10px monospace";
    ctx.textAlign = "center";

    const labels = ["S1", "3", "5", "7", "9", "+20", "+40", "+60dB"];

    for (let i = 0; i <= 16; i++) {
      const x = i * 16.6970588235;
      ctx.fillStyle = x <= s9Position ? "#a3eced" : "#d9191c";

      if (i % 2 === 1) {
        ctx.fillRect(x, lineY, 1, longTickHeight + 1);
        if ((i - 1) / 2 < labels.length) {
          ctx.fillText(labels[(i - 1) / 2], x, labelY + 5);
        }
      } else {
        ctx.fillRect(x, lineY, 1, tickHeight);
      }
    }
  }

  // --- Wrapper: switches between Desktop and Mobile implementations ---
  function drawSMeter(value) {
    if (mobile) {
      // Map 0–100 power to 0–30 segments for the bar
      const segments = Math.max(0, Math.min(30, Math.round(value * 0.3)));
      return drawSMeterMobile(segments);
    }
    return drawSMeterDesktop(value);
  }
  // dBm -> 0..100 needle units.  Lifted out of _smeterTick(); the S9 knee at
  // -73 dBm and the two power-law curves either side of it are unchanged.
  function powerFromDbm(db) {
    const minDb = -130;
    const s9Db = -73;
    const maxDb = -13;
    if (!Number.isFinite(db)) return 0;
    let power;
    if (db < minDb) {
      power = 0;
    } else if (db < s9Db) {
      const norm = (db - minDb) / (s9Db - minDb);
      const curved = Math.pow(norm, 0.6);
      power = curved * 60;
    } else {
      const norm = (db - s9Db) / (maxDb - s9Db);
      const curved = Math.pow(norm, 0.8);
      power = 60 + curved * 40;
    }
    return Math.min(Math.max(power, 0), 100);
  }

  // Drive the needle from the incoming dBm.  setSMeterPower() starts the
  // smoothing loop if it is not already running.
  $: if (mounted) setSMeterPower(powerFromDbm(dbm));

  onMount(() => {
    mounted = true;
    dispatch('themechange', { theme: smeterTheme });
    // Land the needle on the first real reading instead of sweeping up from 0.
    currentPower = targetPower = powerFromDbm(dbm);
    drawSMeter(currentPower);
  });

  onDestroy(() => {
    destroyed = true;
    animating = false;
  });
</script>

{#if mobile}
  <!-- SMeter -->
  <canvas id="sMeterMobile" width="300" height="40"></canvas>
{:else}
  <!-- SMeter (click to cycle face: dark -> amber -> green) -->
  <div
    class="smeter-canvas-wrap {smeterTheme === 'dark'
      ? 'theme-dark'
      : 'theme-amber'}"
  >
    <canvas
      id="sMeter"
      width="auto"
      height="auto"
      role="button"
      tabindex="0"
      title="Click to switch meter style (dark / amber / green)"
      on:click={toggleSMeterTheme}
      on:keydown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          toggleSMeterTheme();
        }
      }}
    ></canvas>
    <span class="smeter-glyph" aria-hidden="true">◐</span>
    <span class="smeter-hint">click to switch style</span>
  </div>
{/if}

<style>
  .smeter-canvas-wrap {
    position: relative;
    display: inline-block;
    line-height: 0;
  }
  .smeter-glyph {
    position: absolute;
    top: 9px;
    right: 12px;
    font-size: 12px;
    line-height: 1;
    pointer-events: none;
    opacity: 0.55;
    transition: opacity 0.15s ease;
    z-index: 2;
  }
  .smeter-canvas-wrap:hover .smeter-glyph {
    opacity: 0.95;
  }
  .smeter-canvas-wrap.theme-amber .smeter-glyph {
    color: rgba(20, 15, 5, 0.6);
  }
  .smeter-canvas-wrap.theme-dark .smeter-glyph {
    color: rgba(255, 255, 255, 0.5);
  }
  .smeter-hint {
    position: absolute;
    top: 6px;
    left: 50%;
    transform: translateX(-50%);
    padding: 2px 8px;
    font-size: 10px;
    font-family: inherit;
    letter-spacing: 0.02em;
    white-space: nowrap;
    color: #f5e6c8;
    background: rgba(0, 0, 0, 0.72);
    border-radius: 4px;
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.15s ease;
    z-index: 3;
  }
  .smeter-canvas-wrap:hover .smeter-hint {
    opacity: 1;
  }

  #sMeterMobile {
    width: 300px;
    height: 40px;
    background-color: transparent;
    display: block;
    margin-left: 30px;
    margin-top: 5px;
  }

  /* Moved out of App.svelte during the four-file merge: the two faces size
     their canvas differently, and the rule belongs with the canvas it styles.
     Svelte scopes this to the component, and the canvas lives here. */
  #sMeter {
    width: 300px;
    height: 190px;
    background-color: transparent;
    display: block;
    margin-left: auto;
    margin-right: auto;
    margin-top: 5px;
    cursor: pointer;
  }
</style>
