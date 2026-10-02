<script>
  import { onMount, onDestroy } from 'svelte';
  import { createEventDispatcher } from 'svelte';

  const dispatch = createEventDispatcher();

  // Props
  export let minHz = 50;
  export let maxHzLimit = 10000; // Will auto-adjust to Nyquist
  export let fftSize = 4096;
  export let displayGain = 1.0;
  export let colorScheme = 'rainbow';
  export let showLabels = true;
  export let height = 300;
  export let enabled = true;
  export let frequencyCalibration = 1.0; // Adjust if frequencies appear doubled/halved

  let canvas;
  let ctx;
  let audioContext;
  let analyser;
  let gainNode;
  let dataArray;
  let fftBinFreqs = [];
  let smoothedMagnitudes = [];
  let animationId;
  let isRunning = false;
  let playTime = 0;
  let buffersQueued = 0;
  
  // Pre-calculated mapping for performance
  let barToFFTIndexMap = [];
  let cachedMinHz = minHz;
  let cachedMaxHz = maxHzLimit;

  onMount(() => {
    ctx = canvas.getContext('2d');
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
  });

  onDestroy(() => {
    stop();
    destroy();
    window.removeEventListener('resize', resizeCanvas);
  });

  function resizeCanvas() {
    if (canvas && canvas.parentElement) {
      const parentWidth = canvas.parentElement.clientWidth;
      const parentHeight = height;
      
      if (parentWidth > 0 && parentHeight > 0) {
        canvas.width = parentWidth;
        canvas.height = parentHeight;
      }
    }
  }

  function updateBarToFFTMapping() {
    const numBars = 240; // Doubled from 120 for better resolution
    const effectiveMinHz = Math.max(minHz, 50);
    const maxHz = Math.min(maxHzLimit, audioContext.sampleRate / 2);
    
    barToFFTIndexMap = [];
    
    for (let i = 0; i < numBars; i++) {
      const targetFreq = effectiveMinHz * Math.pow(maxHz / effectiveMinHz, i / (numBars - 1));
      
      let closestIndex = 0;
      let minDiff = Infinity;
      
      for (let idx = 0; idx < fftBinFreqs.length; idx++) {
        const diff = Math.abs(fftBinFreqs[idx] - targetFreq);
        if (diff < minDiff) {
          minDiff = diff;
          closestIndex = idx;
        }
      }
      
      barToFFTIndexMap.push(closestIndex);
    }
    
    cachedMinHz = minHz;
    cachedMaxHz = maxHzLimit;
  }

  export async function initialize(sampleRate = 12000) {
    if (audioContext) {
      return audioContext;
    }

    try {
      // Use the ACTUAL audio sample rate - don't force higher!
      // The audio.js sends data at its native rate (usually 12 kHz)
      // Using higher rate causes frequency doubling issues
      audioContext = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: sampleRate,
        latencyHint: 'interactive'
      });

      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }

      analyser = audioContext.createAnalyser();
      analyser.fftSize = fftSize;
      analyser.minDecibels = -100;
      analyser.maxDecibels = 0;
      analyser.smoothingTimeConstant = 0.8;

      gainNode = audioContext.createGain();
      gainNode.gain.value = displayGain;

      gainNode.connect(analyser);

      dataArray = new Uint8Array(analyser.frequencyBinCount);
      smoothedMagnitudes = new Float32Array(analyser.frequencyBinCount).fill(0);

      fftBinFreqs = Array.from(
        { length: analyser.frequencyBinCount },
        (_, i) => ((i * audioContext.sampleRate) / analyser.fftSize) * frequencyCalibration
      );

      playTime = audioContext.currentTime;
      updateBarToFFTMapping();

      // Log actual frequency range
      const actualMaxHz = audioContext.sampleRate / 2;
      console.log(`Spectrogram initialized: ${audioContext.sampleRate} Hz sample rate, displaying ${minHz} Hz - ${actualMaxHz} Hz (Nyquist limit)`);

      dispatch('initialized');
      return audioContext;
    } catch (error) {
      console.error('Failed to initialize spectrogram:', error);
      throw error;
    }
  }

  export function feedPCMData(pcmArray) {
    if (!audioContext || !gainNode || !isRunning || !enabled) {
      return;
    }

    try {
      const audioBuffer = audioContext.createBuffer(
        1,
        pcmArray.length,
        audioContext.sampleRate
      );
      audioBuffer.copyToChannel(pcmArray, 0, 0);

      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(gainNode);

      const currentTime = audioContext.currentTime;

      if (playTime < currentTime) {
        playTime = currentTime;
      }

      source.start(playTime);
      playTime += audioBuffer.duration;

      buffersQueued++;

      source.onended = () => {
        source.disconnect();
      };
    } catch (error) {
      console.error('Error feeding PCM data:', error);
    }
  }

  export function start() {
    if (isRunning) return;

    if (!audioContext) {
      console.error('Spectrogram not initialized');
      return;
    }

    isRunning = true;
    buffersQueued = 0;
    playTime = audioContext.currentTime;
    
    // Force resize to ensure proper canvas dimensions
    setTimeout(() => {
      resizeCanvas();
    }, 10);
    
    draw();
  }

  export function stop() {
    if (!isRunning) return;
    isRunning = false;
    if (animationId) {
      cancelAnimationFrame(animationId);
      animationId = null;
    }
  }

  export function setDisplayGain(gain) {
    displayGain = gain;
    if (gainNode) {
      gainNode.gain.value = gain;
    }
  }

  export function setFrequencyRange(min, max) {
    minHz = Math.max(min, 50);
    maxHzLimit = max;
    
    if (audioContext && (minHz !== cachedMinHz || maxHzLimit !== cachedMaxHz)) {
      updateBarToFFTMapping();
    }
  }

  function getColorForValue(value) {
    switch (colorScheme) {
      case 'blue':
        return `hsl(210, 100%, ${5 + value * 75}%)`;
      case 'green':
        return `hsl(120, 100%, ${5 + value * 65}%)`;
      case 'white': {
        const i = Math.floor(value * 255);
        return `rgb(${i}, ${i}, ${i})`;
      }
      default: {
        // Enhanced jet: black → dark blue → blue → cyan → yellow → red
        const v = Math.max(0, Math.min(1, value));
        const t = Math.pow(v, 0.75);
        const stops = [
          [0.00,   0,   0,   0],
          [0.12,   0,   0,  80],
          [0.25,   0,   0, 255],
          [0.45,   0, 255, 255],
          [0.65, 255, 255,   0],
          [0.80, 255, 128,   0],
          [1.00, 200,   0,   0],
        ];
        let r = 0, g = 0, b = 0;
        for (let i = 0; i < stops.length - 1; i++) {
          const [t0, r0, g0, b0] = stops[i];
          const [t1, r1, g1, b1] = stops[i + 1];
          if (t >= t0 && t <= t1) {
            const f = (t - t0) / (t1 - t0);
            r = Math.round(r0 + f * (r1 - r0));
            g = Math.round(g0 + f * (g1 - g0));
            b = Math.round(b0 + f * (b1 - b0));
            break;
          }
        }
        return `rgb(${r},${g},${b})`;
      }
    }
  }

  function generateLogTicks(minHz, maxHz) {
    const ticks = [];
    const effectiveMinHz = Math.max(minHz, 50);
    const minExp = Math.floor(Math.log10(effectiveMinHz));
    const maxExp = Math.ceil(Math.log10(maxHz));

    for (let exp = minExp; exp <= maxExp; exp++) {
      for (let i = 1; i <= 9; i++) {
        const val = i * Math.pow(10, exp);
        if (val >= effectiveMinHz && val <= maxHz) {
          ticks.push(val);
        }
      }
    }
    return ticks;
  }

  function draw() {
    if (!isRunning || !enabled) return;
    animationId = requestAnimationFrame(draw);

    const width = canvas.width;
    const height = canvas.height;
    const leftMargin = showLabels ? 50 : 10;
    const topMargin = showLabels ? 30 : 5;
    const bottomMargin = 5;
    const plotHeight = height - topMargin - bottomMargin;
    const numBars = 240; // Doubled from 120 for better resolution
    const barWidth = Math.max(1, ((width - leftMargin) / numBars) * 0.9); // Thinner bars, more overlap

    // Background
    ctx.fillStyle = '#222';
    ctx.fillRect(0, 0, width, height);
    
    // Get FFT data
    analyser.getByteFrequencyData(dataArray);

    const effectiveMinHz = Math.max(minHz, 50);
    const maxHz = Math.min(maxHzLimit, audioContext.sampleRate / 2);
    const alpha = 0.2;

    // Draw bars
    for (let i = 0; i < numBars; i++) {
      const targetFreq = effectiveMinHz * Math.pow(maxHz / effectiveMinHz, i / (numBars - 1));
      const closestIndex = barToFFTIndexMap[i] || 0;

      let magnitude = dataArray[closestIndex] || 0;
      smoothedMagnitudes[closestIndex] =
        smoothedMagnitudes[closestIndex] * (1 - alpha) + magnitude * alpha;
      magnitude = smoothedMagnitudes[closestIndex];

      const normalizedMag = magnitude / 255;
      const barHeight = Math.max(1, normalizedMag * plotHeight); // Minimum 1px for thinner bars
      
      const x =
        leftMargin +
        (Math.log(targetFreq / effectiveMinHz) / Math.log(maxHz / effectiveMinHz)) *
          (width - leftMargin);

      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = 3;
      ctx.fillStyle = getColorForValue(normalizedMag);
      ctx.fillRect(x, plotHeight - barHeight + topMargin, barWidth, barHeight);
    }
    
    ctx.shadowBlur = 0;

    if (showLabels) {
      // Top banner
      ctx.fillStyle = 'rgba(34,34,34,0.9)';
      ctx.fillRect(0, 0, width, topMargin);

      // Frequency ticks
      const ticks = generateLogTicks(effectiveMinHz, maxHz);
      ctx.strokeStyle = 'rgba(200,200,200,0.2)';
      ctx.fillStyle = '#aaa';
      ctx.font = '11px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';

      ticks.forEach((freq) => {
        const x =
          leftMargin +
          (Math.log(freq / effectiveMinHz) / Math.log(maxHz / effectiveMinHz)) *
            (width - leftMargin);
        
        ctx.beginPath();
        ctx.moveTo(x, topMargin);
        ctx.lineTo(x, height - bottomMargin);
        ctx.stroke();

        const logVal = Math.log10(freq);
        const frac = logVal - Math.floor(logVal);
        if (
          Math.abs(frac) < 0.01 ||
          Math.abs(frac - Math.log10(2)) < 0.01 ||
          Math.abs(frac - Math.log10(5)) < 0.01
        ) {
          ctx.fillText(
            freq >= 1000 ? (freq / 1000).toFixed(1) + 'k' : freq + 'Hz',
            x,
            2
          );
        }
      });
    }
  }

  export function destroy() {
    stop();
    if (gainNode) {
      try {
        gainNode.disconnect();
      } catch (e) {}
      gainNode = null;
    }
    if (analyser) {
      try {
        analyser.disconnect();
      } catch (e) {}
      analyser = null;
    }
    if (audioContext && audioContext.state !== 'closed') {
      audioContext.close();
      audioContext = null;
    }
    dataArray = null;
    smoothedMagnitudes = null;
    fftBinFreqs = [];
    barToFFTIndexMap = [];
  }
</script>

<style>
  canvas {
    width: 100%;
    display: block;
    background: #222;
    border-radius: 4px;
    border: 1px solid #444;
  }
</style>

<canvas bind:this={canvas} {height}></canvas>