<script>
  // The four "versions" are not four builds any more — they are two props on
  // the single merged App.svelte (smeter × layout).  So this control changes
  // the running page instead of navigating: no reload, no dropped audio, no
  // waterfall reset.  It is a controlled component; App.svelte owns the state
  // and persists the choice.
  const versions = [
    { id: 'default',    name: 'Analog S-Meter',    smeter: 'analog',  layout: 'v1' },
    { id: 'digital',    name: 'Digital S-Meter',   smeter: 'digital', layout: 'v1' },
    { id: 'v2-analog',  name: 'V2 Analog S-Meter', smeter: 'analog',  layout: 'v2' },
    { id: 'v2-digital', name: 'V2 Digital S-Meter',smeter: 'digital', layout: 'v2' }
  ];

  /** Current variant, straight from App.svelte. */
  export let smeter = 'analog';
  export let layout = 'v1';
  /** Called with { smeter, layout } when the user picks a different variant. */
  export let onSelect = () => {};

  // Kept in step with the live variant, so the dropdown also follows a change
  // made elsewhere — such as the stored choice App.svelte restores on load.
  let currentVersion = 'default';
  $: currentVersion =
    (versions.find(
      (v) => v.smeter === (smeter === 'digital' ? 'digital' : 'analog') &&
             v.layout === (layout === 'v2' ? 'v2' : 'v1')
    ) || versions[0]).id;

  function handleVersionChange(event) {
    const version = versions.find(v => v.id === event.target.value);
    if (version) {
      onSelect({ smeter: version.smeter, layout: version.layout });
    }
  }
</script>

<div class="version-selector">
  <label for="version-select">⚙️</label>
  <select id="version-select" bind:value={currentVersion} on:change={handleVersionChange}>
    {#each versions as version}
      <option value={version.id}>{version.name}</option>
    {/each}
  </select>
</div>

<style>
  .version-selector {
    position: fixed;
    top: 10px;
    right: 10px;
    z-index: 10000;
    display: flex;
    align-items: center;
    gap: 8px;
    background: rgba(0, 0, 0, 0.75);
    padding: 8px 12px;
    border-radius: 6px;
    border: 1px solid rgba(255, 255, 255, 0.3);
    backdrop-filter: blur(10px);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  }
  
  label {
    color: white;
    font-size: 12px;
    font-family: system-ui, -apple-system, sans-serif;
    font-weight: 500;
    margin: 0;
  }
  
  select {
    background: rgba(255, 255, 255, 0.15);
    color: white;
    border: 1px solid rgba(255, 255, 255, 0.3);
    padding: 6px 10px;
    border-radius: 4px;
    font-size: 14px;
    font-family: system-ui, -apple-system, sans-serif;
    cursor: pointer;
    outline: none;
    min-width: 90px;
  }
  
  select:hover {
    background: rgba(255, 255, 255, 0.2);
    border-color: rgba(255, 255, 255, 0.5);
  }
  
  select:focus {
    border-color: rgba(255, 255, 255, 0.7);
    box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.1);
  }
  
  select option {
    background: #2a2a2a;
    color: white;
    padding: 8px;
  }
  
  /* Tablets and phones: this control is position:fixed over the page, so
     keep it small enough that it covers as little of the header as
     possible.  App.svelte pads the title panel to clear its height. */
  @media (max-width: 1023px) {
    .version-selector {
      top: 5px;
      right: 5px;
      padding: 6px 8px;
      gap: 6px;
    }

    label {
      font-size: 12px;
    }

    select {
      font-size: 12px;
      padding: 4px 8px;
      min-width: 0;
      max-width: 45vw;
    }
  }
</style>
