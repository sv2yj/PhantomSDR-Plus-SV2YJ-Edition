<script>
    import { onDestroy, onMount } from 'svelte'
    import { createPopper } from '@popperjs/core'

    export let text
    let popover
    
    let popoverPopper = null
    let parentNode = null
    let timeout = null

    // BUG FIX (non-unique ID): same issue as Tooltip.svelte — multiple mounted
    // Popover instances all had id="popover", causing CSS to show/hide all of them
    // at once.  Generate a unique ID per instance.
    const popoverId = `popover-${Math.random().toString(36).slice(2, 9)}`

    function show () {
      if (!popoverPopper && popover) {
        popoverPopper = createPopper(parentNode, popover, {
          modifiers: [
            {
              name: 'offset',
              options: {
                offset: [0, 8]
              }
            }
          ],
          placement: 'top'
        })
      }
      popover.setAttribute('data-show', '')
      if (timeout) {
        clearTimeout(timeout)
      }
      timeout = setTimeout(() => {
        popover.removeAttribute('data-show')
      }, 1000)
    }
    onMount(() => {
      parentNode = popover.parentElement
      parentNode.addEventListener('click', show)
    })

    onDestroy(() => {
      // BUG FIX (crash on fast unmount): guard parentNode before calling
      // removeEventListener so rapid unmounting doesn't throw TypeError.
      if (parentNode) {
        parentNode.removeEventListener('click', show)
      }
      if (timeout) {
        clearTimeout(timeout)
        timeout = null
      }
      if (popoverPopper) {
        popoverPopper.destroy()
        popoverPopper = null
      }
    })
</script>

<style>
    /* BUG FIX: was #popover / #popover[data-show] — now uses role=tooltip
       attribute selector so the rule works with per-instance generated IDs. */
    [role="tooltip"] {
      background: #333;
      color: white;
      font-weight: bold;
      padding: 4px 8px;
      font-size: 13px;
      border-radius: 4px;
      display: none;
    }
  
    :global([role="tooltip"][data-show]) {
        display: block;
    }

    #arrow,
    #arrow::before {
      position: absolute;
      width: 8px;
      height: 8px;
      z-index: -1;
    }

    #arrow::before {
      content: '';
      transform: rotate(45deg);
      background: #333;
    }
      
    :global([data-popper-placement^='top'] > #arrow) {
        bottom: -4px;
    }

    :global([data-popper-placement^='bottom'] > #arrow) {
        top: -4px;
    }

    :global([data-popper-placement^='left'] > #arrow) {
        right: -4px;
    }

    :global([data-popper-placement^='right'] > #arrow) {
        left: -4px;
    }

</style>

<div bind:this={popover} id={popoverId} role="tooltip" class="z-50">
    {text}
    <div id="arrow" data-popper-arrow></div>
</div>
