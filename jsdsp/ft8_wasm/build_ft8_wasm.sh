#!/usr/bin/env bash
# build_ft8_wasm.sh — compile ft8_lib + FT2 wrapper to WebAssembly
# Place at: ~/ft8_lib_ft2/build_ft8_wasm.sh
#
# Usage:
#   cd ~/ft8_lib_ft2
#   source ~/emsdk/emsdk_env.sh
#   bash build_ft8_wasm.sh
#
# Output: ft8_lib.wasm  (copy to ~/PhantomSDR-Plus/frontend/public/decoders/)

set -euo pipefail
cd "$(dirname "$0")"

echo "[build] emcc $(emcc --version | head -1)"

SOURCES=(
    wasm_wrapper.c
    ft8/decode.c
    ft8/encode.c
    ft8/ldpc.c
    ft8/message.c
    ft8/text.c
    ft8/constants.c
    ft8/crc.c
    common/monitor.c
    fft/kiss_fft.c
    fft/kiss_fftr.c
)

for f in "${SOURCES[@]}"; do
    [[ -f "$f" ]] || { echo "[build] ERROR: missing $f"; exit 1; }
done

EXPORTS='["_ftx_decode","_get_message_text","_get_freq","_get_snr","_get_dt","_malloc","_free"]'

echo "[build] Compiling ${#SOURCES[@]} source files..."

# common/monitor.c hardcodes `#define LOG_LEVEL LOG_INFO`, so it writes to
# stderr on every init. There is no stdio in the browser build, and a stderr
# write reaches the JS fd_write stub — so silence LOG_PRINTF here. debug.h
# guards it with #ifndef, so this command-line define wins without patching
# any library source.
emcc \
    "${SOURCES[@]}" \
    -I . \
    -D'LOG_PRINTF(...)=' \
    -O3 \
    -s WASM=1 \
    -s EXPORTED_FUNCTIONS="$EXPORTS" \
    -s EXPORTED_RUNTIME_METHODS='[]' \
    -s ALLOW_MEMORY_GROWTH=1 \
    -s INITIAL_MEMORY=16777216 \
    -s STACK_SIZE=1048576 \
    -s STANDALONE_WASM=1 \
    -s ASSERTIONS=0 \
    -s FILESYSTEM=0 \
    --no-entry \
    -lm \
    -o ft8_lib.wasm

echo "[build] Done: $(pwd)/ft8_lib.wasm  ($(wc -c < ft8_lib.wasm) bytes)"
echo ""
echo "Deploy: cp ft8_lib.wasm ~/PhantomSDR-Plus/frontend/public/decoders/"
