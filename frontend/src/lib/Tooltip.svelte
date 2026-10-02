<script>
    import { onDestroy, onMount } from 'svelte'
    import { createPopper } from '@popperjs/core'

    export let text
    let tooltip
    let tooltipPopper = null
    let parentNode = null

    // BUG FIX (non-unique ID): Using a static id="tooltip" means every mounted
    // Tooltip shares the same ID, violating the HTML spec.  The CSS rule
    // #tooltip[data-show] then shows / hides ALL tooltip instances simultaneously.
    // Fix: generate a unique ID per instance so each tooltip is independent.
    const tooltipId = `tooltip-${Math.random().toString(36).slice(2, 9)}`

    function show () {
      if (!tooltipPopper && tooltip) {
        tooltipPopper = createPopper(parentNode, tooltip, {
          modifiers: [
            {
              name: 'offset',
              options: {
                offset: [0, 8]
              }
            }
          ],
          placement: 'bottom'
        })
      }
      tooltip.setAttribute('data-show', '')
    }
    function hide () {
      tooltip.removeAttribute('data-show')
    }

    onMount(() => {
      parentNode = tooltip.parentElement
      parentNode.addEventListener('mouseenter', show)
      parentNode.addEventListener('mouseleave', hide)
    })

    onDestroy(() => {
      // BUG FIX (crash on fast unmount): if the component is destroyed before
      // onMount fires, parentNode is still null → TypeError.  Guard both calls.
      if (parentNode) {
        parentNode.removeEventListener('mouseenter', show)
        parentNode.removeEventListener('mouseleave', hide)
      }
      if (tooltipPopper) {
        tooltipPopper.destroy()
        tooltipPopper = null
      }
    })
</script>

<style>
    /* BUG FIX: The original CSS used #tooltip and #tooltip[data-show] selectors.
       Now that each instance has a unique id (tooltip-XXXXXXX), those selectors
       no longer match.  Use attribute selectors on role=tooltip so the rule
       applies to any tooltip instance regardless of its generated id. */
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

<div bind:this={tooltip} id={tooltipId} role="tooltip" class="z-50">
    {text}
    <div id="arrow" data-popper-arrow></div>
</div>
