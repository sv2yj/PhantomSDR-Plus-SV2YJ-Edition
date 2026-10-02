# FT8 / FT4 / FT2 decoder — WebAssembly build

Source for `frontend/public/decoders/ft8_lib.wasm`, which decodes all three
protocols for `frontend/src/modules/ft4.js`.

| File | Purpose |
|---|---|
| `wasm_wrapper.c` | The bridge: waterfall via ft8_lib's `monitor.c`, candidate search, callsign hash table, result accessors |
| `build_ft8_wasm.sh` | emcc invocation |

## Building

The build needs the **ft8_lib tree**, which is *not* vendored here — it lives at
`~/ft8_lib_ft2` (ft8_lib plus the FT2 experiment). The two files above are the
canonical copies; `~/ft8_lib_ft2/wasm_wrapper.c` and `build_ft8_wasm.sh` are
**symlinks back into this directory**, so there is exactly one copy of each and
it is the tracked one.

That arrangement is deliberate. A previous untracked copy of the wrapper sat at
`jsdsp/ft4_wasm_glue.c` and drifted badly out of date — it described a decoder
configuration that had not been shipped in a long time, and reading it produced
a completely wrong picture of how the decoder worked.

```sh
cd ~/ft8_lib_ft2
source ~/emsdk/emsdk_env.sh
bash build_ft8_wasm.sh
cp ft8_lib.wasm ~/PhantomSDR-Plus/frontend/public/decoders/
```

Then rebuild the frontend so `dist/` picks it up.

## Verifying a change

`cd ~/ft8_lib_ft2 && make` builds ft8_lib's reference decoder. Run it over the
corpus in `test/wav/` (31 files) and compare decode counts against a native
build of this wrapper:

```sh
./decode_ft8 test/wav/websdr_test2.wav          # reference
gcc -O2 -I. -o ab wasm_wrapper.c ft8/*.c common/monitor.c fft/*.c -lm
```

**FT8 parity is 354 decodes across the corpus.** Hitting 354 means the change is
sound. Several files are 6400 Hz, which is what catches sample-rate hardcoding.

Note the corpus contains **no FT4 or FT2 signals**, so neither can be verified
this way — FT4 is confirmed only on air. `gen_ft8 -ft4` is not a workaround: its
output fails to decode even in the upstream reference decoder.

## Three landmines in ft8_lib

1. `ftx_decode_candidate()` never assigns `status.freq`. Compute the frequency
   from the candidate plus `mon.min_bin` instead.
2. `ftx_message_decode()` dereferences its `offsets` argument unconditionally —
   passing `NULL` segfaults.
3. `common/monitor.c` hardcodes `#define LOG_LEVEL LOG_INFO`, so it writes to
   stderr. In the browser that reaches the JS `fd_write` stub; if that stub is
   bound to the wrong memory the module hangs. The build passes
   `-D'LOG_PRINTF(...)='` to silence it, and `ft4.js` binds its heap views to
   the module's *exported* memory (it is a `STANDALONE_WASM` reactor, so it also
   needs `_initialize()` called before first use).

## Kiwi parity

The harness mirrors KiwiSDR's `extensions/FT8/decode_ft8.c`: 100–3100 Hz
passband, 140 candidates, 25 LDPC iterations, min score 10, and a persistent
aging callsign hash table so compound calls resolve instead of printing `<...>`.
Slot capture timing lives on the JS side in `audio.js`.
