<script>
  import { createEventDispatcher, onMount } from 'svelte'
  import bounds from 'binary-search-bounds'

  import { frequencyToWaterfallOffset, getFrequencyView } from '../lib/backend'

  const dispatch = createEventDispatcher()
  let markerDiv;
  
  // Bookmarks prop
  export let bookmarks = [];
  var frequencyList = []
  export function insertAll (frequencies) {
    for (const frequency of frequencies) {
      frequencyList.push([
        frequency.f || frequency.frequency,
        frequency.d || frequency.description,
        frequency.m || frequency.modulation
      ])

    }

    frequencyList = [...frequencyList];
  }
  function frequencyListComparator (a, b) {
    return a[0] - b[0]
  }
  export function finalizeList () {
    frequencyList.sort(frequencyListComparator)
    if (frequencyList.length === 0) {
      markerDiv.style.display = 'none'
    }
  }

  function getFrequencyBoundsInRange (lo, hi) {
    return [bounds.ge(frequencyList, [lo], frequencyListComparator), bounds.ge(frequencyList, [hi], frequencyListComparator)]
  }

  let markerIdCounter = 0;

  function getFrequencyInRange(from, to) {
    return frequencyList.slice(from, to).map(x => ({
      id: markerIdCounter++,
      frequency: x[0],
      description: x[1],
      modulation: x[2],
      left: 0
    }))
  }
  
  let frequencyMarkers = []
  let frequencyBoundsLo = -1
  let frequencyBoundsHi = -1
  
  // Bookmark markers
  let bookmarkMarkers = []
  
  function updateBookmarkMarkerPositions() {
    if (!bookmarks || bookmarks.length === 0) {
      bookmarkMarkers = [];
      return;
    }
    
    const [frequencyFrom, frequencyTo] = getFrequencyView();
    
    // Only show when zoomed in (same threshold as frequency markers)
    if (frequencyTo - frequencyFrom > 3500000) {
      bookmarkMarkers = [];
      return;
    }
    
    // Filter bookmarks in current view and map to marker format.
    // Use bookmark.frequency as the stable id so Svelte's keyed {#each}
    // can diff and reuse existing DOM elements instead of destroying/recreating
    // them on every waterfall update.  (bookmarkIdCounter++ gave a new id every
    // call, which thrashed the DOM at the waterfall frame rate.)
    bookmarkMarkers = bookmarks
      .filter(bookmark => bookmark.frequency >= frequencyFrom && bookmark.frequency <= frequencyTo)
      .map(bookmark => ({
        id: bookmark.frequency,
        frequency: bookmark.frequency,
        description: bookmark.label || bookmark.name,
        modulation: bookmark.demodulation,
        left: frequencyToWaterfallOffset(bookmark.frequency)
      }));
  }
  
  export function updateFrequencyMarkerPositions() {
    const [frequencyFrom, frequencyTo] = getFrequencyView();
    const [from, to] = getFrequencyBoundsInRange(frequencyFrom, frequencyTo);
    
    if (frequencyTo - frequencyFrom <= 3500000) {
      if (from !== frequencyBoundsLo || to !== frequencyBoundsHi) {
        frequencyBoundsLo = from;
        frequencyBoundsHi = to;
        frequencyMarkers = getFrequencyInRange(frequencyBoundsLo, frequencyBoundsHi);
      }
    } else {
      frequencyMarkers = [];
      frequencyBoundsHi = -1;
      frequencyBoundsLo = -1;
    }

    // Update the left position, preserving the id
    frequencyMarkers = frequencyMarkers.map(marker => ({
      ...marker,
      left: frequencyToWaterfallOffset(marker.frequency)
    }));

    // Force Svelte to update the component
    frequencyMarkers = [...frequencyMarkers];
    
    // Update bookmark markers
    updateBookmarkMarkerPositions();
  }


  onMount(() => {
    //finalizeList()
  })
  
  // Reactive: update bookmarks when they change
  $: if (bookmarks) {
    updateBookmarkMarkerPositions();
  }
</script>
<div on:click|self on:wheel|self class="w-full h-4 bg-black relative" bind:this={markerDiv} role="button">
  {#each frequencyMarkers as frequencyMarker (frequencyMarker.id)}
  <div class="h-4 absolute p-0 group" style="left: {frequencyMarker.left * 100}%"
      on:click|stopPropagation={() => dispatch('markerclick', frequencyMarker)}>
      <div class="top-0 w-px h-8 z-0 peer bg-yellow-600 absolute">
      </div>
      <div class="outline-1 outline-black outline-offset-0 outline p-px
          bg-yellow-400 absolute bottom-0 z-10 group-hover:z-20 hover:z-20 peer-hover:z-20
          text-left whitespace-pre whitespace-nowrap text-black text-xs align-middle
          [text-shadow:none]
          border border-yellow-600 transform origin-bottom-left overflow-hidden
          h-auto max-h-full hover:max-h-screen peer-hover:max-h-screen
          transition-all ease-linear duration-1000">
      {frequencyMarker.description}</div>
  </div>
  {/each}
  
<!-- Bookmark markers with marine blue background and yellow text -->
  {#each bookmarkMarkers as bookmarkMarker (bookmarkMarker.id)}
  <div class="h-4 absolute p-0 group" style="left: {bookmarkMarker.left * 100}%"
      on:click|stopPropagation={() => dispatch('markerclick', bookmarkMarker)}>
      <div class="top-0 w-px h-8 z-0 peer bg-[#0051FF] absolute">
      </div>
      <div class="outline-1 outline-black outline-offset-0 outline p-px
          bg-[#0051FF] absolute bottom-0 z-20 group-hover:z-30 hover:z-30 peer-hover:z-30
          text-left whitespace-pre whitespace-nowrap text-[#FFD900] text-xs font-bold align-middle
          [text-shadow:none]
          border border-[#FFD900] transform origin-bottom-left overflow-hidden
          h-auto max-h-full hover:max-h-screen peer-hover:max-h-screen
          transition-all ease-linear duration-1000">
      {bookmarkMarker.description}</div>
  </div>
  {/each}
</div>