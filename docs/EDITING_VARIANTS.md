# PhantomSDR-Plus — How to Edit the Frontend Variants

*(after the four `App__*_smeter_.svelte` files were merged into one `App.svelte`)*

---

## 1. What the Variants Are

Two independent choices, giving four combinations:

```
smeter = "analog"     the moving-needle meter face
       = "digital"    the segmented bar-graph meter

layout = "v1"         Modes selector above,  Band selector below
       = "v2"         Band  selector above,  Modes selector below
                      (also moves the mobile fine-tuning button row)
```

All four live in **one build**, served at `/`. The ⚙️ selector at the top right switches between them inside the running page: it assigns `App.svelte`'s `smeter`/`layout` props, so nothing reloads and audio, the waterfall and the decoders keep running. The choice is stored per browser in `localStorage` under `phantom.variant`, and that stored value wins over the build default on the next visit.

The variant the sysop picks in `recompile.sh` is therefore the **starting** variant — what a first-time visitor sees before touching the menu.

| URL | what it is |
|-----|-----------|
| `/` | the desktop page, all four variants, switchable at runtime |
| `/mobile/` | *separate page, built by `build-mobile.sh` — not a variant* |

> Until 2026-08-10 each variant was its own build under `/analog/`, `/digital/`, `/v2-analog/` and `/v2-digital/`, and the selector navigated between them — which is why switching used to reload the page and drop the audio. Those builds are gone; each of the four paths now holds only a small `index.html` that redirects to `/`, written by `frontend/make-redirect-stubs.sh` on every build so old bookmarks keep working.

The variant is **not** written into any source file. `src/main.js` is a fixed entry point that hands two build-time defines to the component:

```js
const app = new App({
  target: document.getElementById('app'),
  props: { smeter: __PHANTOM_SMETER__, layout: __PHANTOM_LAYOUT__ }
})
```

`vite.config.js` fills those in at build time, taking the first of these that is set:

1. **`PHANTOM_SMETER` / `PHANTOM_LAYOUT`** — environment variables. Nothing sets them now that the per-variant builds are gone; they still work for a one-off build with a different starting variant.
2. **`frontend/variant.json`** — the site default, written by `recompile.sh`. The root (`/`) build passes no variant, so it lands here.
3. **`analog` / `v1`** — the fallback.

Those two values are only the **seed**. `App.svelte` overwrites them at init from `localStorage` when the visitor has already chosen a variant, and the ⚙️ selector assigns them again on every switch.

Inside `App.svelte` the props are turned into two flags at lines 20-21:

```js
$: isAnalog = smeter !== "digital";
$: isV2     = layout === "v2";
```

Use those two flags — never `smeter`/`layout` directly — so the whole file reads the same way.

---

## 2. Which File Does What

### `frontend/src/main.js` — 12 lines

The entry point. Nothing but the App instantiation and the two `__PHANTOM_*__` defines it passes as props. It is **constant** — neither `recompile.sh` nor the build scripts rewrite it any more, and keeping it that way is what lets the variant builds run at the same time.

> **Do not put application code here.** It is the entry file, not a place for logic.

### `frontend/src/App.svelte` — ~17130 lines

The whole application: waterfall, tuning, decoders, bookmarks, panels, desktop layout AND the responsive phone layout. Almost every edit you will ever make goes here.

### `frontend/src/lib/SMeterAnalog.svelte` — 824 lines

The moving-needle meter, complete: face drawing, needle, the light/dark face toggle and its localStorage key, and the needle smoothing.

- Input prop: `dbm` — the CALIBRATED power in dBm.
- Also takes: `mobile` — smaller canvas attributes for the phone layout.
- Tuning knob: `SMOOTH_TIME_MS` at line 55. Lower = faster needle, higher = smoother. Currently 16 (one frame at 60 fps, effectively the floor).

#### The three meter faces — and `smeter_theme.sh`

The analog meter has three background faces, all drawn by the same code:

```
dark      the original dark brushed metal
amber     a light, pale grey face
vintage   a warm aged-amber face
```

**Do not confuse this with the `smeter = analog / digital` variant above.** The variant chooses *which meter component* is shown; the face chooses *how the analog one is painted*. They are stored under different localStorage keys (`phantom.variant` vs `smeterTheme`) and are set in different places.

**The visitor's side.** The meter canvas is a button (`role="button"`, also Enter/Space from the keyboard, with a "click to switch style" hint under it). Each click cycles dark → amber → vintage and saves the choice in `localStorage.smeterTheme`. It is read back on every page load, so the visitor's pick survives refreshes and browser restarts indefinitely. It is deliberately **not** a cookie: a cookie would be sent to the server on every waterfall and audio request for a value the server never reads.

**The sysop's side.** Two things in `SMeterAnalog.svelte` control what everyone else gets:

| Line | What it does |
|------|--------------|
| `let smeterTheme = 'dark';` | The face a browser with **no saved choice** gets. |
| `const SMETER_PREF_VERSION = 2;` | A counter. When a browser's stored version is behind this, it forgets its saved face **once** and takes the default above. Bump it to move visitors who have already chosen. |

Editing the default alone therefore only reaches brand-new visitors. Both edits together move everybody — that is what `smeter_theme.sh` in the repository root is for:

```bash
./smeter_theme.sh                 # report the current default, then pick one from a menu
./smeter_theme.sh vintage         # set it straight away, then offer the rebuild
./smeter_theme.sh dark --build    # run frontend/build-all.sh without asking
./smeter_theme.sh amber --no-reset  # new visitors only — leave existing users alone
```

It reports the current default, sets the new one, bumps the reset counter (always upward — **never lower it**, a lower number simply stops the reset from firing), and then offers the same frontend build choice `recompile.sh` gives. It does **not** touch the backend and does **not** rewrite `variant.json`.

> A change reaches a connected listener only when their page reloads — the default is compiled into the JS bundle and the reset runs at load time. There is no live push. An ordinary reload is enough, since vite hashes the bundle filenames.

The counter's one-time wipe overrides everyone, including visitors who deliberately clicked their own face. That is intended: it is the only way to bring the whole site back onto one look. Use `--no-reset` when you would rather leave them alone.

### `frontend/src/lib/SMeterDigital.svelte` — 184 lines

The segmented bar meter, complete.

- Input props: `rawDb` — the RAW `audio.getPowerDb()`
- `smeterOffset` — `audio.smeter_offset`
- `mobile` — smaller canvas attributes

> **NOTE:** this meter is deliberately driven from the RAW power plus the offset, NOT from the calibrated dBm the analog face uses. It has always done its own mapping. Feeding it the calibrated value would shift every reading on every digital site. Do not "unify" these two inputs.

### `frontend/src/lib/BandSelector.svelte` — 69 lines

The band buttons grid. Rendered twice in `App.svelte` (once per layout).

### `frontend/src/lib/ModesSelector.svelte` — 75 lines

The mode buttons grid. Rendered twice in `App.svelte`.

### `frontend/src/lib/StatusIndicators.svelte` — 122 lines

The status lamps (mute, squelch, NR, NB, NS, AN, CTCSS). Takes a `wide` prop: the digital layout uses wider lamps than the analog one. Both Tailwind classes (`w-8` and `w-10`) are written out in full inside the component — Tailwind's scanner only sees literal class names, so never build them by string concatenation.

All other files in `frontend/src/lib/` (Spectrogram, PassbandTuner, FrequencyInput, VersionSelector, ...) predate this work and are unchanged.

---

## 3. Making a Change That Affects Only Some Variants

Wrap it in the flag. In markup:

```svelte
{#if isAnalog}
  ...only the analog sites see this...
{:else}
  ...only the digital sites see this...
{/if}

{#if isV2} ... {/if}          {#if !isV2} ... {/if}
```

In a class attribute:

```svelte
class="p-4 {isAnalog ? 'text-xs' : 'text-sm'} rounded-md"
```

Write both alternatives out as whole literals, as above. Tailwind scans the source for complete class names; `text-{size}` or a concatenated name is purged from the CSS and the style silently vanishes.

In the `<script>` block: try NOT to branch at all. The script deliberately computes the inputs of BOTH meters on every tick —

```js
smeterDbm    = powerDb;                    // analog face
smeterRawDb  = audio.getPowerDb();         // digital face
smeterOffset = audio.smeter_offset;        // digital face
```

— so only the markup has to choose. That is why there are just 15 variant switches in a 17000-line file. Keep it that way; script-level branching is what made the four old files drift apart.

---

## 4. Where the Variant Switches Are

Fifteen places in `App.svelte`. Line numbers drift when you edit — the reliable way to find them all is:

```bash
cd frontend/src && grep -n 'isAnalog\|isV2' App.svelte
```

As of this writing:

| Line | Flag | What it switches |
|------|------|------------------|
| 20 | | `isAnalog` declared |
| 21 | | `isV2` declared |
| 8062 | `isV2` | desktop: Band selector first (v2 ordering) |
| 8090 | `isV2` | desktop: panel heading size |
| 8686 | `isV2` | desktop: Modes selector first (v1 ordering) |
| 8717 | `isAnalog` | meter panel min-width (needle is narrower) |
| 8730 | `isAnalog` | analog-only date/time line above the meter |
| 8819 | `isAnalog` | analog-only status lamps + divider |
| 8834 | `isAnalog` | digital-only time line, wide lamps, and the `<SMeterDigital>` / `<SMeterAnalog>` choice itself |
| 8861 | `isAnalog` | vertical spacing of the frequency block |
| 8864 | `isAnalog` | top margin of the fine-tuning block |
| 12288 | `isV2` | phone: fine-tuning row above (v2 ordering) |
| 12347 | `isAnalog` | phone: which meter to render |
| 12433 | `isV2` | phone: fine-tuning row below (v1 ordering) |
| 13204 | `isAnalog` | noise-gate button text size |

Everything else in the file is shared by all four variants.

---

## 5. Other Knobs Worth Knowing

| Location | Constant | Purpose |
|----------|----------|---------|
| `App.svelte` line 5034 | `const visualGain = 1.1;` | Analog meter calibration. Each 0.10 is roughly 5 dBm on the reading. |
| `SMeterAnalog.svelte` line 55 | `const SMOOTH_TIME_MS = 16;` | Needle smoothing time constant, in milliseconds. |
| `SMeterAnalog.svelte` line 64 | `let smeterTheme = 'dark';` | Default analog meter face for a browser with no saved choice. Set it with `./smeter_theme.sh`, not by hand. |
| `SMeterAnalog.svelte` line 69 | `const SMETER_PREF_VERSION = 2;` | One-time reset counter for the saved face. Bump to move existing visitors onto the default; only ever goes up. |
| `SMeterDigital.svelte` line 149 | `const DIGITAL_BAR_TRIM = 0;` | Shifts the bar by whole segments. |
| `SMeterDigital.svelte` line 31 | `const numberOfDots = 35;` | Segment count of the bar. |

---

## 6. After You Edit — Rebuilding

Easiest, from the repository root:

```bash
./recompile.sh
```

Menu **[2]** rebuilds the frontend and asks which variant the site root (`/`) should serve. That choice is recorded in `frontend/variant.json` — no source file is copied or rewritten. (It used to regenerate `VersionSelector.svelte` from a heredoc as well; that was removed when the selector stopped navigating, because it would have reverted the runtime switching on every run.) Menu **[1]** is backend only, **[3]** is both.

Or directly, from `frontend/`:

```
./build-all.sh          builds the desktop page AND /mobile/  <-- normally use this
./build-default.sh      just the desktop page
./build-mobile.sh       just /mobile/
```

> `build-default.sh` lets vite empty `dist/`, which removes `dist/mobile/` until the next `build-all.sh` or `build-mobile.sh`. That is why `build-all.sh` is the normal choice.

`build-all.sh` has its own copy of the build logic (`build_version SMETER LAYOUT NAME OUTDIR BASE LOG`) rather than calling `build-default.sh`. If you change how the page is built, change it in BOTH places or the two paths will disagree.

A few details worth knowing:

- It sets `PHANTOM_KEEP_OUTDIR=1` so Vite does not empty the output directory, and cleans `dist/` itself instead — deleting the contents but keeping `users.json`, which the running `spectrumserver` rewrites on every listener connect and disconnect.
- It builds `/mobile` last, after the desktop output is complete.
- Its parallel-build machinery (`PHANTOM_BUILD_JOBS`, default 3) is left over from when there were five desktop builds. With one, nothing queues.

**Executable bits:** `recompile.sh` runs `chmod +x` on a script before running it, and `build-all.sh` deliberately invokes `bash build-mobile.sh` rather than `./build-mobile.sh`, so a missing bit no longer breaks a build. Uploading a script through the GitHub web interface still resets it to 644 though, so if you run one directly:

```bash
chmod +x frontend/build-*.sh
```

---

## 7. How to Check Your Edit Before Trusting It

A green `vite build` is **NOT** enough. The build cannot see an identifier that went missing when code moved between files — that is a runtime `ReferenceError`, and the page simply does not load. It has happened twice.

### 1) Undefined-identifier check (catches exactly that failure)

```bash
cd frontend
npx eslint --no-eslintrc \
    --parser svelte-eslint-parser \
    --rule '{"no-undef":"error"}' \
    --env browser,es2022 \
    src/App.svelte src/lib/SMeter*.svelte
```

One known-benign hit is expected:

```
'dBmCalOffset' is not defined
```

`typeof x === 'number'` on an undeclared name never throws, so that expression already evaluates to 0. Anything else is a real problem.

### 2) Build, then LOAD THE PAGE AND SWITCH THROUGH ALL FOUR VARIANTS

Not just the one you changed — an edit under `isAnalog`/`isV2` can break the other three while yours works. Open `/`, step through all four entries in the ⚙️ menu, then open `/mobile/`.

Open the browser console on each. A blank or half-drawn page with a `ReferenceError` in the console is the signature of the bug above.

### 3) Never leave `frontend/dist/` in a partial state

A bare `npx vite build` empties the output directory and takes `dist/mobile/` and the server's live `dist/users.json` with it — the mobile page 404s until the next successful build. Always build through the scripts: `build-all.sh` sets `PHANTOM_KEEP_OUTDIR=1` and does the cleaning itself, preserving `dist/users.json`. If in doubt, just run `./build-all.sh` again.
