<!-- Ehanced by F1NSK to match true old EM84 -->

<script>
  import { tweened } from "svelte/motion";
  import { cubicOut } from "svelte/easing";

  // Signal level in dBm driving the indicator (e.g. window._lastPowerDb).
  export let dbm = -130;
  export let minDb = -130;
  export let maxDb = -13;

  const level = tweened(0, { duration: 160, easing: cubicOut });

  $: {
    const norm = (dbm - minDb) / (maxDb - minDb);
    level.set(Math.min(1, Math.max(0, Number.isFinite(norm) ? norm : 0)));
  }

  // Dark central gap between the two luminous bars; as the signal strengthens
  // the bars grow inward from each end and the gap closes, exactly like a
  // classic EM84 tuning-eye tube (edges -> centre).
  $: shadowPct = (1 - $level) * 85;
  $: glowAlpha = 0.35 + $level * 0.80;
</script>

<div class="magic-eye" title="Oeil Magique (Sensible à la puissance du signal reçu">
  <div class="eye-mount">
    <div class="eye-cap eye-cap-left" />
    <div class="eye-tube">
      <div class="eye-glass">
        <div class="eye-glow" style="opacity: {glowAlpha}" />
        <div class="eye-shadow eye-shadow-center" style="width: {shadowPct}%" />
        <div class="eye-sheen" />
      </div>
      <div class="eye-rim" />
    </div>
    <div class="eye-cap eye-cap-right" />
  </div>
  <div class="eye-reflection" />
</div>

<style>
  .magic-eye {
    width: 100%;
    padding: 10px 0 6px;
  }

  .eye-mount {
    position: relative;
    display: flex;
    align-items: center;
    filter: drop-shadow(0 3px 3px rgba(0, 0, 0, 0.5));
  }

  /* Metal end caps, like the electrode pins/base of a real tube */
  .eye-cap {
    flex: 0 0 auto;
    width: 7px;
    height: 10px;
    background: linear-gradient(
      to bottom,
      #e8e8ec 0%,
      #9a9aa2 35%,
      #55555c 65%,
      #2a2a2e 100%
    );
    box-shadow:
      inset 0 0 1px rgba(255, 255, 255, 0.6),
      0 0 2px rgba(0, 0, 0, 0.6);
    z-index: 2;
  }

  .eye-cap-left {
    border-radius: 3px 0 0 3px;
    margin-right: -2px;
  }

  .eye-cap-right {
    border-radius: 0 3px 3px 0;
    margin-left: -2px;
  }

  .eye-tube {
    position: relative;
    flex: 1 1 auto;
    height: 18px;
    border-radius: 999px;
    /* Cylindrical shading: dark at the rolled edges, lifted through the middle */
    background: linear-gradient(
      to bottom,
      #303035 0%,
      #101012 12%,
      #000 30%,
      #000 70%,
      #101012 88%,
      #303035 100%
    );
    box-shadow:
      inset 0 0 0 1px rgba(0, 0, 0, 0.9),
      0 1px 1px rgba(255, 255, 255, 0.05);
  }

  .eye-glass {
    position: absolute;
    inset: 2px;
    border-radius: 999px;
    overflow: hidden;
    background: radial-gradient(ellipse at center, #05130a 0%, #000 100%);
    box-shadow: inset 0 0 5px rgba(0, 0, 0, 0.95);
  }

  .eye-glow {
  position: absolute;
  inset: 0;
  background: linear-gradient(
  90deg,
  #0a3518 0%,
  #1aa04d 8%,
  #46c962 16%,
  #1fe918 24%,
  #3dfd03 34%,
  #95ffa0 50%,
  #3dfd03 66%,
  #1fe918 76%,
  #46c962 84%,
  #1aa04d 92%,
  #0a3518 100%
  );
  box-shadow:
      0 0 10px rgba(120,255,120,.45),
      0 0 18px rgba(222, 250, 203, 0.18);
  transition: opacity 120ms linear;
}

  /* Single dark gap in the centre; soft edges so the two bright bars fade into
     it. Its width shrinks toward zero as the bars close on strong signals. */
  .eye-shadow-center {
    position: absolute;
    top: 0;
    bottom: 0;
    left: 50%;
    transform: translateX(-50%);
    background: linear-gradient(
      to right,
      transparent 0%,
      #000 22%,
      #000 78%,
      transparent 100%
    );
    transition: width 120ms linear;
  }

  /* Glassy specular highlight along the top of the cylinder */
  .eye-sheen {
    position: absolute;
    left: 4%;
    right: 4%;
    top: 8%;
    height: 32%;
    border-radius: 999px;
    background: linear-gradient(
      to bottom,
      rgba(255, 255, 255, 0.55),
      rgba(255, 255, 255, 0) 100%
    );
    mix-blend-mode: screen;
    pointer-events: none;
  }

  /* Thin bright rim tracing the glass edge for extra roundness */
  .eye-rim {
    position: absolute;
    inset: 0;
    border-radius: 999px;
    box-shadow:
      inset 0 1px 1px rgba(255, 255, 255, 0.25),
      inset 0 -1px 2px rgba(0, 0, 0, 0.8);
    pointer-events: none;
  }

  /* Soft ambient glow cast beneath the tube, like light spilling onto a panel */
  .eye-reflection {
    height: 5px;
    margin: 2px 10px 0;
    border-radius: 50%;
    background: radial-gradient(
      ellipse at center,
      rgba(80, 255, 150, 0.25),
      transparent 75%
    );
    filter: blur(1px);
  }
</style>
