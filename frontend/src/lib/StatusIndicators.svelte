<script>
  /**
   * StatusIndicators.svelte — the MUTED / SQ / AI / NR / NB / NS / AN / CTCSS chips.
   *
   * Extracted because the two S-meter faces put this row in different places:
   * the analog layout keeps it in the left column under the frequency readout,
   * the digital one stacks it above the bar meter in the right column, with
   * smaller chips.  Rather than carry the row twice in App.svelte, it
   * moves here and each layout renders one tag.
   *
   * Both Tailwind width classes appear as complete literals on purpose — a
   * computed class name like `w-{n}` would be invisible to Tailwind's scanner
   * and get purged from the stylesheet.
   */

  export let mute = false;
  export let squelchEnable = false;
  export let AINREnabled = false;
  /** AI is on but the mode is not a voice mode, so audio.js bypasses it. */
  export let AINRBypassed = false;
  export let NREnabled = false;
  export let NBEnabled = false;
  export let NSEnabled = false;
  export let ANEnabled = false;
  export let CTCSSSupressEnabled = false;
  /** Digital face: labels sized to their text with an 8px gap, at the
   *  same 12px as the analog face. The row is 214px in a 290px slot, so it
   *  still fits the 1380px left+middle+right panel row. */
  export let wide = false;
  // Analog face: each chip is as wide as its own label, with a fixed gap
  // between them. It used to be eight fixed 32 px boxes, which cut the
  // five-letter labels (MUTED, CTCSS) and left wide holes around the
  // two-letter ones.
  //
  // "Off" labels are dimmed through the colour's alpha (text-red-500/20), not
  // with opacity-20: opacity (plus the old relative z-10) puts faint text on
  // its own compositing path, and browsers re-rasterise it differently each
  // time something nearby repaints — seen as the labels blinking whenever
  // the mouse moved. Same look, drawn as plain text.
</script>

<div
  class={wide
    ? "flex items-center gap-2 mb-1"
    : "flex items-center justify-center gap-2 text-xs w-48 w-full"}
>
  <div
    class="px-0 py-0.5 flex items-center justify-center {wide
                ? 'w-auto'
                : 'w-auto'} h-5 relative overflow-hidden"
  >
    <span
      class="text-xs font-mono {mute
        ? 'text-red-500'
        : 'text-red-500/20'}"
      >MUTED</span
    >
  </div>

  <div
    class="px-0 py-0.5 flex items-center justify-center {wide
                ? 'w-auto'
                : 'w-auto'} h-5 relative overflow-hidden"
  >
    <span
      class="text-xs font-mono {squelchEnable
        ? `text-orange-500`
        : `text-orange-500/20`}"
      >SQ</span
    >
  </div>

  <div
    class="px-0 py-0.5 flex items-center justify-center {wide
                ? 'w-auto'
                : 'w-auto'} h-5 relative overflow-hidden"
  >
    <span
      class="text-xs font-mono {AINREnabled
        ? AINRBypassed
          ? `text-cyan-400/50`
          : `text-cyan-400`
        : `text-cyan-400/20`}"
      >AI</span
    >
  </div>

  <div
    class="px-0 py-0.5 flex items-center justify-center {wide
                ? 'w-auto'
                : 'w-auto'} h-5 relative overflow-hidden"
  >
    <span
      class="text-xs font-mono {NREnabled
        ? `text-green-500`
        : `text-green-500/20`}"
      >NR</span
    >
  </div>

  <div
    class="px-0 py-0.5 flex items-center justify-center {wide
                ? 'w-auto'
                : 'w-auto'} h-5 relative overflow-hidden"
  >
    <span
      class="text-xs font-mono {NBEnabled
        ? `text-green-500`
        : `text-green-500/20`}"
      >NB<span> </span></span
    >
  </div>

  <div
    class="px-0 py-0.5 flex items-center justify-center {wide
                ? 'w-auto'
                : 'w-auto'} h-5 relative overflow-hidden"
  >
    <span
      class="text-xs font-mono {NSEnabled
        ? `text-green-500`
        : `text-green-500/20`}"
      >NS</span
    >
  </div>

  <div
    class="px-0 py-0.5 flex items-center justify-center {wide
                ? 'w-auto'
                : 'w-auto'} h-5 relative overflow-hidden"
  >
    <span
      class="text-xs font-mono {ANEnabled
        ? `text-green-500`
        : `text-green-500/20`}"
      >AN</span
    >
  </div>

  <div
    class="px-0 py-0.5 flex items-center justify-center {wide
                ? 'w-auto'
                : 'w-auto'} h-5 relative overflow-hidden"
  >
    <span
      class="text-xs font-mono {CTCSSSupressEnabled
        ? `text-yellow-500`
        : `text-yellow-500/20`}"
      >CTCSS</span
    >
  </div>
</div>
