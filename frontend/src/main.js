import './app.css'
import App from './App.svelte'

// The variant is a build-time define, not a rewrite of this file — see the
// "Which S-meter variant is this?" block in vite.config.js.  Keeping this file
// constant is what lets build-all.sh build the variants in parallel.
const app = new App({
  target: document.getElementById('app'),
  props: { smeter: __PHANTOM_SMETER__, layout: __PHANTOM_LAYOUT__ }
})

export default app
