// Mobile page entry. No app.css / Tailwind import on purpose — the mobile UI
// is self-contained plain CSS inside Mobile.svelte, so it does not inherit the
// desktop app's global reset and utility layer.
import Mobile from './Mobile.svelte'

const app = new Mobile({
  target: document.getElementById('app')
})

export default app
