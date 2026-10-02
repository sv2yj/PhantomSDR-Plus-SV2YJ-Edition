import { defineConfig } from 'vite'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import legacy from '@vitejs/plugin-legacy'
import { visualizer } from 'rollup-plugin-visualizer'
import wasm from 'vite-plugin-wasm';
import topLevelAwait from 'vite-plugin-top-level-await'

// ── Which build is this? ────────────────────────────────────────────────────
// The S-meter variants are produced by re-running this same config with
// explicit overrides (build-all.sh, build-analog.sh, …):
//     npm run build -- --outDir "dist/analog" --base "/analog/"
// while the default build passes --outDir "dist" --base "/" (or nothing at all).
//
// Only the default build should emit the mobile page. Without this check every
// variant produced its own dist/<variant>/mobile/ copy — dead weight, since the
// real page is served from /mobile by the default build.
function cliArg (name) {
  const argv = process.argv
  const prefix = `--${name}=`
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === `--${name}`) return argv[i + 1]
    if (argv[i].startsWith(prefix)) return argv[i].slice(prefix.length)
  }
  return undefined
}

const buildBase = cliArg('base') ?? '/'
const buildOutDir = cliArg('outDir') ?? 'dist'
const isDefaultBuild = buildBase === '/' && buildOutDir.replace(/\/+$/, '') === 'dist'

// build-mobile.sh sets this to rebuild ONLY the mobile page. It reuses the
// default build's outDir and base (dist, /) because the emitted html path is
// derived from the entry's location under the project root — mobile/index.html
// therefore lands at dist/mobile/index.html either way. emptyOutDir is turned
// off below so the desktop build already in dist/ survives.
const isMobileOnly = process.env.PHANTOM_MOBILE_ONLY === '1'

// ── Which S-meter variant is this? ──────────────────────────────────────────
// The variant used to be baked in by rewriting src/main.js before each build.
// That made src/main.js shared mutable state, so the five desktop builds had to
// run one after another — six sequential builds of identical source.  The two
// props now arrive as build-time defines, so every build reads the same entry
// file and build-all.sh can run them in parallel.
//
// Precedence: PHANTOM_SMETER / PHANTOM_LAYOUT (set per build by the build-*.sh
// scripts) > variant.json (the site default, written by recompile.sh) >
// analog/v1.
function readVariantDefaults () {
  try {
    const path = fileURLToPath(new URL('./variant.json', import.meta.url))
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return {}
  }
}

const variantDefaults = readVariantDefaults()
const variant = {
  smeter: process.env.PHANTOM_SMETER || variantDefaults.smeter || 'analog',
  layout: process.env.PHANTOM_LAYOUT || variantDefaults.layout || 'v1'
}

// build-all.sh empties dist/ itself (preserving the server's live users.json)
// and then builds the root page and its variant subdirectories at the same
// time.  Vite's own emptyOutDir would race with that: the root build would wipe
// dist/ — and dist/analog, dist/digital, … with it — while those builds are
// midway through writing their files.
const keepOutDir = process.env.PHANTOM_KEEP_OUTDIR === '1'

// rollup-plugin-visualizer writes to the project root, so concurrent builds
// would interleave their writes into one stats.html.  Each parallel build
// passes its own path.
const statsFile = process.env.PHANTOM_STATS_FILE || 'stats.html'

const mobileEntry = fileURLToPath(new URL('./mobile/index.html', import.meta.url))
const mainEntry = fileURLToPath(new URL('./index.html', import.meta.url))

// The mobile page is built ONLY by build-mobile.sh (which build-all.sh calls),
// never as a side effect of a desktop build. isDefaultBuild is still used to
// keep variant builds from ever picking it up.
let entryPoints
if (isMobileOnly) {
  entryPoints = { mobile: mobileEntry }
} else {
  entryPoints = { main: mainEntry }
}

// Make the mobile build self-contained under dist/mobile/.
//
// outDir stays "dist" so Rollup's root-relative path for the entry
// (mobile/index.html) still lands at dist/mobile/index.html. Pointing every
// emitted chunk and asset at "mobile/assets/..." then puts the whole page —
// code, CSS, WASM, workers — inside that one directory, and because base is
// "/" the generated URLs come out as /mobile/assets/..., which is exactly
// where those files are served from.
//
// Trade-off: no chunk sharing with the desktop build, so the shared DSP code
// exists twice on disk and the two pages cannot reuse each other's browser
// cache. That is the price of a directory you can copy on its own.
const mobileFileNames = isMobileOnly
  ? {
      entryFileNames: 'mobile/assets/[name]-[hash].js',
      chunkFileNames: 'mobile/assets/[name]-[hash].js',
      assetFileNames: 'mobile/assets/[name]-[hash][extname]'
    }
  : {}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    wasm(),
    svelte(),
    topLevelAwait(),
    /*
    legacy({
      targets: ['ie >= 11'],
      additionalLegacyPolyfills: ['regenerator-runtime/runtime']
    })
      */
  ],
  server: {
    proxy: {
      '/audio': {
        target: 'http://localhost:9002',
        ws: true
      },
      '/waterfall': {
        target: 'http://localhost:9002',
        ws: true
      },
      '/events': {
        target: 'http://localhost:9002',
        ws: true
      },
      '/signal': {
        target: 'http://localhost:9002',
        ws: true
      }
    }
  },
  define: {
    __filename: JSON.stringify(''),
    __PHANTOM_SMETER__: JSON.stringify(variant.smeter),
    __PHANTOM_LAYOUT__: JSON.stringify(variant.layout)
  },
  worker: {
    format: 'es',      // required: decoder.worker.js uses top-level await via ft8/ft4/wspr modules
    plugins: () => [wasm(), topLevelAwait()],
    // Workers are bundled separately, so they need the same redirect or they
    // would land in dist/assets/ and break the self-contained mobile folder.
    rollupOptions: { output: { ...mobileFileNames } },
  },
  build: {
    minify: true,
    // A mobile-only build must not wipe the desktop pages sitting in dist/,
    // and neither must one parallel desktop build wipe another's output.
    emptyOutDir: !isMobileOnly && !keepOutDir,
    rollupOptions: {
      // The mobile page lives at frontend/mobile/index.html, so Rollup
      // preserves that relative path and emits dist/mobile/index.html — which
      // src/http.cpp serves at /mobile via its directory→index.html resolution.
      // Added only for the default build; see isDefaultBuild above.
      input: entryPoints,
  output: {
    ...mobileFileNames,
    manualChunks: {
      dsp: [
        'fft-js',
        'standardized-audio-context',
        'cbor-x'
        // add other big DSP/libs here
      ],
      codecs: [
        // e.g. your Opus / FLAC / ZSTD modules, if they are separate deps
      ]
    }
      },
      plugins: [visualizer({ filename: statsFile })]
    }
  }
  /*
  build: {
    minify: true,
    rollupOptions: {
      output: {
      },
      plugins: [visualizer()]
    }
  }
  */
})