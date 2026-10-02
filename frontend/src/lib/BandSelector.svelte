<script>
  /**
   * BandSelector.svelte — the two rows of band buttons (publishBand 1 and 2).
   *
   * Extracted alongside ModesSelector for the same reason: v1 and v2 order this
   * block differently within the panel.  Markup unchanged.
   *
   * verifyRegion/printBandButton are passed in rather than reimplemented: both
   * depend on site configuration (siteRegion, siteSDRBaseFrequency,
   * siteSDRBandwidth) that lives in the parent and is fixed for the session.
   */

  /** bands-config.js band list. */
  export let bandArray = [];
  /** Index of the active band, or -1/-2 for none. */
  export let currentBand = -1;
  /** (ITU) => bool — is this band visible in the site's region. */
  export let verifyRegion = () => true;
  /** (startFreq, endFreq, publish) => bool — is the band within the SDR span. */
  export let printBandButton = () => true;
  /** Called with the band index. */
  export let onSelect = () => {};
</script>

                  <!-- Begin Band Selection -->
                  <h3 class="text-white text-base font-semibold mb-2">
                    Band selector
                  </h3>
                  <div class="w-full grid grid-cols-5 sm:grid-cols-5 gap-2">
                    {#each bandArray as bandData, index}
                      {#if verifyRegion(bandData.ITU)}
                        {#if bandData.publishBand == 1}
                          {#if printBandButton(bandData.startFreq, bandData.endFreq, bandData.publishBand)}
                            <button
                              id="band-selector"
                              class="retro-button text-sm text-white fontrbold h-7 text-base rounded-md flex items-center justify-center border border-gray-600 shadow-inner transition-all duration-200 ease-in-out {currentBand ===
                              index
                                ? 'bg-blue-600 pressed scale-95'
                                : 'bg-gray-700 hover:bg-gray-600'}"
                              on:click={() => onSelect(index)}
                              title={bandData.name}
                              >{bandData.name}
                            </button>
                          {/if}
                        {/if}
                      {:else}{/if}
                    {/each}
                  </div>
                  <div><hr class="border-gray-600 my-2" /></div>
                  <div class="w-full grid grid-cols-5 sm:grid-cols-5 gap-2">
                    {#each bandArray as bandData, index}
                      {#if verifyRegion(bandData.ITU)}
                        {#if bandData.publishBand == 2}
                          {#if printBandButton(bandData.startFreq, bandData.endFreq, bandData.publishBand)}
                            <button
                              id="band-selector"
                              class="retro-button text-sm text-white fontrbold h-7 text-base rounded-md flex items-center justify-center border border-gray-600 shadow-inner transition-all duration-200 ease-in-out {currentBand ===
                              index
                                ? 'bg-blue-600 pressed scale-95'
                                : 'bg-gray-700 hover:bg-gray-600'}"
                              on:click={() => onSelect(index)}
                              title={bandData.name}
                              >{bandData.name}
                            </button>
                          {/if}
                        {/if}
                      {:else}{/if}
                    {/each}
                  </div>
