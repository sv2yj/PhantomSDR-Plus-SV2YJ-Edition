<script>
  /**
   * ModeIdChip — the "what am I listening to?" readout that sits under the
   * Decoders heading, above the one-touch decoder buttons.
   *
   * Deliberately suggests rather than acts: it never switches the decoder by
   * itself, because a misidentification would then yank the operator out of a
   * decoder they had chosen on purpose.  The best guess gets a Tune button, and
   * the runners-up sit alongside it so a wrong top answer costs nothing.
   *
   * The frame sits on its own line under the heading and is full width, so the
   * layout runs left-to-right — verdict, what was measured, then the actions.
   * It wraps rather than overflowing: the parent lives inside screw-col-2, and
   * nothing here may grow past that column.
   */
  import { createEventDispatcher } from "svelte";
  const dispatch = createEventDispatcher();

  export let on = false;
  export let result = null;
  /** Candidates after the band plan has been applied — see modePriors.js. */
  export let ranked = [];
  /** Set when the signal sits where measurement is unreliable — see App.svelte. */
  export let offCentre = false;

  $: fill = result && result.fill ? result.fill : 0;
  $: ready = !!(result && result.ready);
  // Prefer the band-plan ranking; fall back to the raw one if it is absent.
  $: candidates = (ranked && ranked.length ? ranked : (result && result.candidates)) || [];
  $: best = candidates[0] || null;
  $: rest = candidates.slice(1);
  $: features = (result && result.features) || null;

  /** What was actually measured — the evidence behind the verdict. */
  $: measured = features
    ? [
        features.bwHz ? `${features.bwHz.toFixed(0)} Hz wide` : null,
        features.toneSpacingHz ? `${features.toneSpacingHz.toFixed(0)} Hz shift` : null,
        features.baud ? `${features.baud.toFixed(2)} Bd` : null,
        features.envRate ? `${features.envRate.toFixed(1)} Bd env` : null,
        features.gridSec
          ? `${features.gridSec} s grid`
          : features.slowGridSec
            // Recovered by folding the history onto the grid rather than from
            // whole bursts, which is how a fading signal is placed at all.  Said
            // differently on purpose: it is weaker evidence and scores lower.
            ? `${features.slowGridSec} s grid (through fading)`
            : null,
        features.burstSec
          ? `${features.burstSec.toFixed(1)} s burst`
          : features.runSec
            ? `${features.runSec.toFixed(0)} s on air`
            : null,
        features.keyRate ? `${(features.keyRate * 1.2).toFixed(0)} WPM` : null,
        features.snrDb ? `${features.snrDb.toFixed(0)} dB S/N` : null,
      ]
        .filter(Boolean)
        .join("  ·  ")
    : "";

  function pct(x) {
    return `${Math.round((x || 0) * 100)}%`;
  }

  /** Green when we are confident, amber when it is a guess. */
  function tone(score) {
    if (score >= 0.75) return "text-green-400";
    if (score >= 0.5) return "text-yellow-300";
    return "text-orange-300";
  }
</script>

<div class="glass-window rounded-md px-3 py-1.5 text-xs w-full">
  <div class="flex flex-wrap items-center gap-x-3 gap-y-1.5">
    <span class="text-gray-300 font-semibold whitespace-nowrap">Decoder ID</span>
    <button
      class="px-2 py-0.5 rounded font-semibold transition-all duration-200 {on
        ? 'bg-blue-600 text-white shadow-lg'
        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}"
      on:click={() => dispatch("toggle")}
      title="Identify the digital mode in the passband. Off by default — it only uses CPU while it is on."
    >
      {on ? "On" : "Off"}
    </button>

    {#if on}
      {#if !ready}
        <!-- The cadence measurements need ~15 s before FT8/WSPR timing means
             anything, so say so rather than showing a half-formed guess. -->
        <span class="text-gray-400 whitespace-nowrap">Listening…</span>
        <div class="flex-1 h-1.5 bg-gray-700 rounded overflow-hidden min-w-[4rem]">
          <div class="h-full bg-blue-500 transition-all" style="width:{pct(fill)}"></div>
        </div>
        <span class="text-gray-500 whitespace-nowrap">{pct(fill)}</span>
      {:else if !best}
        <span class="text-gray-400 whitespace-nowrap">
          {result && result.quiet ? "Nothing above the noise" : "Not recognised"}
        </span>
        {#if measured}
          <span class="text-gray-500 flex-1 truncate">{measured}</span>
        {:else}
          <span class="flex-1"></span>
        {/if}
        {#if offCentre}
          <button
            class="px-3 py-0.5 rounded bg-amber-700 hover:bg-amber-600 text-white whitespace-nowrap transition-colors"
            on:click={() => dispatch("recentre")}
            title="The signal is near the edge of the passband, where the measurement is unreliable. Move the dial so it sits mid-passband, then measure again."
          >
            Recentre &amp; retry
          </button>
        {/if}
      {:else}
        <span class="{tone(best.score)} font-semibold whitespace-nowrap" title={best.why}>
          {best.label}
        </span>
        {#if best.onPlan}
          <span
            class="text-blue-300 whitespace-nowrap"
            title="This is a known calling frequency for that mode, which is part of why it ranks first."
          >📻</span>
        {/if}
        <span class="text-gray-400 whitespace-nowrap">{pct(best.score)}</span>

        {#if measured}
          <span class="text-gray-500 flex-1 truncate" title="Measured from the signal">
            {measured}
          </span>
        {:else}
          <span class="flex-1"></span>
        {/if}

        {#if rest.length}
          <span class="text-gray-600 whitespace-nowrap">or</span>
          {#each rest as c}
            <button
              class="px-1.5 py-0.5 rounded text-gray-400 whitespace-nowrap transition-colors {c.key
                ? 'hover:bg-gray-700 hover:text-gray-200'
                : 'opacity-60 cursor-default'}"
              on:click={() => c.key && dispatch("tune", c)}
              title={c.key ? c.why : `${c.why} — no decoder for this mode`}
            >
              {c.label.split(" (")[0]}
              <span class="text-gray-600">{pct(c.score)}</span>
            </button>
          {/each}
        {/if}

        {#if offCentre}
          <button
            class="px-3 py-0.5 rounded bg-amber-700 hover:bg-amber-600 text-white whitespace-nowrap transition-colors"
            on:click={() => dispatch("recentre")}
            title="The signal is near the edge of the passband, where the measurement is unreliable. Move the dial so it sits mid-passband, then measure again."
          >
            Recentre &amp; retry
          </button>
        {/if}
        {#if best.key}
          <button
            class="px-3 py-0.5 rounded bg-green-700 hover:bg-green-600 text-white whitespace-nowrap transition-colors"
            on:click={() => dispatch("tune", best)}
            title="Switch to the decoder for this mode"
          >
            Use {best.label.split(" (")[0]}
          </button>
        {:else}
          <span
            class="text-gray-500 whitespace-nowrap"
            title="Identified, but this build has no decoder for it."
          >no decoder</span>
        {/if}
      {/if}
    {/if}
  </div>
</div>
