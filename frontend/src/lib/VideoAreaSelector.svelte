<script>
  // Drag-to-select overlay for choosing the video recording area.
  //
  // Sits on top of the waterfall panel while `active` is true and swallows
  // pointer events so a drag doesn't retune the receiver. The selection is
  // emitted normalised (0..1) against the union of the visible layer canvases,
  // NOT against this overlay: the overlay spans the whole panel including the
  // admin message bar, while the recorder only ever composites the canvases.
  import { createEventDispatcher } from "svelte";

  export let active = false;
  // () => [{ canvas }] — same layer list handed to the recorder.
  export let getLayers = () => [];
  // Normalised { x, y, w, h } or null, for drawing the persistent outline.
  export let crop = null;

  const dispatch = createEventDispatcher();

  let dragging = false;
  let startX = 0;
  let startY = 0;
  let curX = 0;
  let curY = 0;
  let overlayEl;

  // Union of the laid-out layer canvases, in client coordinates. This is the
  // rectangle the recorder's composited stack actually corresponds to.
  function layerBounds() {
    const rects = getLayers()
      .filter((l) => l && l.canvas && l.canvas.clientHeight > 0)
      .map((l) => l.canvas.getBoundingClientRect());
    if (rects.length === 0) return null;
    return {
      left: Math.min(...rects.map((r) => r.left)),
      right: Math.max(...rects.map((r) => r.right)),
      top: Math.min(...rects.map((r) => r.top)),
      bottom: Math.max(...rects.map((r) => r.bottom)),
    };
  }

  function handleDown(e) {
    if (!active) return;
    e.preventDefault();
    e.stopPropagation();
    dragging = true;
    startX = curX = e.clientX;
    startY = curY = e.clientY;
  }

  function handleMove(e) {
    if (!dragging) return;
    e.preventDefault();
    curX = e.clientX;
    curY = e.clientY;
  }

  function handleUp(e) {
    if (!dragging) return;
    e.preventDefault();
    e.stopPropagation();
    dragging = false;

    const b = layerBounds();
    if (!b) {
      dispatch("cancel");
      return;
    }

    const w = b.right - b.left;
    const h = b.bottom - b.top;
    if (w <= 0 || h <= 0) {
      dispatch("cancel");
      return;
    }

    const x1 = Math.min(startX, curX);
    const x2 = Math.max(startX, curX);
    const y1 = Math.min(startY, curY);
    const y2 = Math.max(startY, curY);

    // A click with no real drag means "cancel", not "record a 1px area".
    if (x2 - x1 < 8 || y2 - y1 < 8) {
      dispatch("cancel");
      return;
    }

    const clamp = (v) => Math.min(Math.max(v, 0), 1);
    const nx = clamp((x1 - b.left) / w);
    const ny = clamp((y1 - b.top) / h);
    dispatch("select", {
      crop: {
        x: nx,
        y: ny,
        w: clamp((x2 - b.left) / w) - nx,
        h: clamp((y2 - b.top) / h) - ny,
      },
    });
  }

  function handleKey(e) {
    if (active && e.key === "Escape") dispatch("cancel");
  }

  // The saved outline is derived from live element geometry, which Svelte can't
  // see change. Bump this on resize so the box tracks the panel instead of
  // sticking to where it was drawn.
  let geometryTick = 0;
  function handleResize() {
    geometryTick += 1;
  }

  // Live drag rectangle, in coordinates local to the overlay.
  $: dragBox =
    dragging && overlayEl
      ? (() => {
          const r = overlayEl.getBoundingClientRect();
          return {
            left: Math.min(startX, curX) - r.left,
            top: Math.min(startY, curY) - r.top,
            width: Math.abs(curX - startX),
            height: Math.abs(curY - startY),
          };
        })()
      : null;

  // Persistent outline of an already-chosen area, mapped from normalised
  // coordinates back onto the current layout.
  $: savedBox = ((_tick) => {
    if (!crop || dragging || !overlayEl) return null;
    const b = layerBounds();
    if (!b) return null;
    const r = overlayEl.getBoundingClientRect();
    return {
      left: b.left - r.left + crop.x * (b.right - b.left),
      top: b.top - r.top + crop.y * (b.bottom - b.top),
      width: crop.w * (b.right - b.left),
      height: crop.h * (b.bottom - b.top),
    };
  })(geometryTick);
</script>

<svelte:window
  on:mousemove={handleMove}
  on:mouseup={handleUp}
  on:keydown={handleKey}
  on:resize={handleResize}
/>

<div
  bind:this={overlayEl}
  class="absolute inset-0 z-[10000]"
  class:pointer-events-none={!active}
  style={active ? "cursor: crosshair;" : ""}
  on:mousedown={handleDown}
  role="presentation"
>
  {#if savedBox}
    <div
      class="absolute border-2 border-dashed border-yellow-300 bg-yellow-300/5 pointer-events-none"
      style="left:{savedBox.left}px; top:{savedBox.top}px; width:{savedBox.width}px; height:{savedBox.height}px;"
    ></div>
  {/if}

  {#if dragBox}
    <div
      class="absolute border-2 border-dashed border-yellow-300 bg-yellow-300/10 pointer-events-none"
      style="left:{dragBox.left}px; top:{dragBox.top}px; width:{dragBox.width}px; height:{dragBox.height}px;"
    ></div>
  {/if}

  {#if active && !dragging}
    <div
      class="absolute top-2 left-1/2 -translate-x-1/2 bg-black/85 text-yellow-300 text-xs font-mono px-3 py-1 rounded pointer-events-none whitespace-nowrap"
    >
      Drag to select the video recording area &nbsp;·&nbsp; Esc to cancel
    </div>
  {/if}
</div>
