#!/bin/bash
#
# waterfall.sh - change the default minimum waterfall level (dB)
#
# The waterfall floor is defined in two places:
#   frontend/src/waterfall.js   ->  this.minWaterfall = -30
#   frontend/src/App.svelte     ->  let min_waterfall = -30;          (initial value)
#                                   min_waterfall = -30;              ("min" reset case)
#                                   handleMinMove(-30);               ("min" reset case)
#                                   min_waterfall: -30, // default    (bookmark defaults)
#
# A HIGHER value (e.g. -15) gives a darker waterfall,
# a LOWER value (e.g. -45) gives a brighter waterfall.
#
# This script never uses hard-coded line numbers: it locates every spot by
# pattern, so it keeps working after the sources are updated.
#
# Usage:
#   ./waterfall.sh              interactive
#   ./waterfall.sh -v -15       set the value without being asked
#   ./waterfall.sh -v -15 -y    ... and skip every confirmation
#   ./waterfall.sh -s           show the current values only
#

set -u

NEW_VALUE=""
ASSUME_YES=0
SHOW_ONLY=0

usage() {
    cat <<EOF
Usage: $(basename "$0") [-v VALUE] [-y] [-s] [-h]

  -v VALUE   new minimum waterfall level in dB (e.g. -15, -30, -45.5)
  -y         answer yes to all confirmations (non-interactive)
  -s         show the current values and exit
  -h         this help
EOF
}

while getopts ":v:ysh" opt; do
    case "$opt" in
        v) NEW_VALUE="$OPTARG" ;;
        y) ASSUME_YES=1 ;;
        s) SHOW_ONLY=1 ;;
        h) usage; exit 0 ;;
        :) echo "Error: -$OPTARG needs a value" >&2; usage; exit 1 ;;
        \?) echo "Error: unknown option -$OPTARG" >&2; usage; exit 1 ;;
    esac
done

# ---------------------------------------------------------------- locate files
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
ROOT=""
for cand in "$SCRIPT_DIR" "$PWD" "$HOME/PhantomSDR-Plus"; do
    if [ -f "$cand/frontend/src/waterfall.js" ] && [ -f "$cand/frontend/src/App.svelte" ]; then
        ROOT="$cand"
        break
    fi
done

if [ -z "$ROOT" ]; then
    echo "❌ Could not find frontend/src/waterfall.js and frontend/src/App.svelte."
    echo "   Run this script from inside the PhantomSDR-Plus directory."
    exit 1
fi

WF="$ROOT/frontend/src/waterfall.js"
APP="$ROOT/frontend/src/App.svelte"

echo "=========================================="
echo "  PhantomSDR-Plus - waterfall floor"
echo "=========================================="
echo "waterfall.js : $WF"
echo "App.svelte   : $APP"
echo ""

NUM='-?[0-9]+(\.[0-9]+)?'

# Patterns: description | file | regex prefix (group 1) | regex suffix
# The number always sits between prefix and suffix.
report() {
    local file="$1" label="$2" re="$3"
    grep -nE "$re" "$file" | grep -vE '^[0-9]+:[[:space:]]*//' | \
        while IFS= read -r line; do
            printf '   %-28s %s:%s\n' "$label" "$(basename "$file")" "$line"
        done
}

RE_WF_MIN="^[[:space:]]*this\.minWaterfall[[:space:]]*=[[:space:]]*$NUM"
RE_APP_LET="^[[:space:]]*let[[:space:]]+min_waterfall[[:space:]]*=[[:space:]]*$NUM"
RE_APP_ASSIGN="^[[:space:]]*min_waterfall[[:space:]]*=[[:space:]]*$NUM"
RE_APP_MOVE="^[[:space:]]*handleMinMove\([[:space:]]*$NUM"
RE_APP_BOOK="^[[:space:]]*min_waterfall:[[:space:]]*$NUM"

echo "Current settings found:"
report "$WF"  "this.minWaterfall"   "$RE_WF_MIN"
report "$APP" "let min_waterfall"   "$RE_APP_LET"
report "$APP" "min_waterfall ="     "$RE_APP_ASSIGN"
report "$APP" "handleMinMove()"     "$RE_APP_MOVE"
report "$APP" "min_waterfall: (bkm)" "$RE_APP_BOOK"
echo ""

# ------------------------------------------------------- current (old) values
OLD_WF="$(grep -hE "$RE_WF_MIN" "$WF" | grep -vE '^[[:space:]]*//' | head -n1 | grep -oE -- "$NUM[[:space:]]*\$" | tr -d '[:space:]')"
OLD_APP="$(grep -hE "$RE_APP_LET" "$APP" | grep -vE '^[[:space:]]*//' | head -n1 | grep -oE -- "$NUM" | tail -n1)"

if [ -z "$OLD_WF" ]; then
    echo "❌ Could not read the current value from waterfall.js (this.minWaterfall)."
    echo "   The file layout may have changed - check it manually."
    exit 1
fi

echo "Current minimum waterfall level : $OLD_WF dB (waterfall.js)"
if [ -n "$OLD_APP" ] && [ "$OLD_APP" != "$OLD_WF" ]; then
    echo "⚠️  App.svelte currently says     : $OLD_APP dB - the two files are out of sync,"
    echo "    both will be set to the new value."
fi
echo ""

[ "$SHOW_ONLY" -eq 1 ] && exit 0

# ------------------------------------------------------------------ new value
if [ -z "$NEW_VALUE" ]; then
    echo "  higher than $OLD_WF  (e.g. -15)  ->  darker waterfall"
    echo "  lower  than $OLD_WF  (e.g. -45)  ->  brighter waterfall"
    echo ""
    read -r -p "New minimum waterfall value in dB [default $OLD_WF]: " NEW_VALUE
    [ -z "$NEW_VALUE" ] && NEW_VALUE="$OLD_WF"
fi

if ! [[ "$NEW_VALUE" =~ ^-?[0-9]+(\.[0-9]+)?$ ]]; then
    echo "❌ '$NEW_VALUE' is not a number (examples: -15, -30, -45.5)."
    exit 1
fi

if [ "$NEW_VALUE" = "$OLD_WF" ] && { [ -z "$OLD_APP" ] || [ "$OLD_APP" = "$OLD_WF" ]; }; then
    echo "Nothing to do - the value is already $NEW_VALUE dB."
    exit 0
fi

# Only literals equal to one of the values in use are touched, so unrelated
# numbers elsewhere in the files can never be rewritten by accident.
OLDS="$(printf '%s\n' "$OLD_WF" "$OLD_APP" | grep -v '^$' | sort -u | tr '\n' '|' | sed 's/|$//' | sed 's/\./\\./g')"

echo ""
echo "About to change $OLD_WF  ->  $NEW_VALUE dB in:"
echo "   $(basename "$WF")  and  $(basename "$APP")"
if [ "$ASSUME_YES" -ne 1 ]; then
    read -r -p "Proceed? [y/N]: " ans
    case "$ans" in [Yy]*) ;; *) echo "Cancelled."; exit 0 ;; esac
fi

# ---------------------------------------------------------------- backup + edit
STAMP="$(date +%Y%m%d-%H%M%S)"
cp -p "$WF"  "$WF.bak-$STAMP"
cp -p "$APP" "$APP.bak-$STAMP"
echo ""
echo "Backups: $(basename "$WF").bak-$STAMP , $(basename "$APP").bak-$STAMP"

# sed program: skip comment lines, replace only the matching old literals
edit() {   # file  prefix-regex  [suffix-regex]
    local file="$1" prefix="$2" suffix="${3:-}"
    sed -i -E "\%^[[:space:]]*//%! s%^(${prefix})(${OLDS})(${suffix})%\1${NEW_VALUE}\3%" "$file"
}

edit "$WF"  "[[:space:]]*this\.minWaterfall[[:space:]]*=[[:space:]]*" '([[:space:]]*(;|//.*)?$)'
edit "$APP" "[[:space:]]*let[[:space:]]+min_waterfall[[:space:]]*=[[:space:]]*" '([[:space:]]*;)'
edit "$APP" "[[:space:]]*min_waterfall[[:space:]]*=[[:space:]]*" '([[:space:]]*;)'
edit "$APP" "[[:space:]]*handleMinMove\([[:space:]]*" '([[:space:]]*\))'
edit "$APP" "[[:space:]]*min_waterfall:[[:space:]]*" '([[:space:]]*,)'

echo ""
echo "New settings:"
report "$WF"  "this.minWaterfall"   "$RE_WF_MIN"
report "$APP" "let min_waterfall"   "$RE_APP_LET"
report "$APP" "min_waterfall ="     "$RE_APP_ASSIGN"
report "$APP" "handleMinMove()"     "$RE_APP_MOVE"
report "$APP" "min_waterfall: (bkm)" "$RE_APP_BOOK"

# sanity check
LEFT="$(grep -cE "^[[:space:]]*this\.minWaterfall[[:space:]]*=[[:space:]]*${NEW_VALUE//./\\.}([[:space:]]|;|$)" "$WF")"
if [ "$LEFT" -eq 0 ]; then
    echo ""
    echo "⚠️  waterfall.js does not show the new value - restoring the backups."
    mv "$WF.bak-$STAMP" "$WF"
    mv "$APP.bak-$STAMP" "$APP"
    exit 1
fi

echo ""
echo "✅ Minimum waterfall level is now $NEW_VALUE dB."
echo "   (restore with:  mv $WF.bak-$STAMP $WF )"

# ------------------------------------------------------------------ recompile
echo ""
echo "The frontend must be rebuilt for the change to take effect."
if [ ! -x "$ROOT/recompile.sh" ]; then
    echo "   recompile.sh not found - rebuild the frontend manually."
    exit 0
fi

if [ "$ASSUME_YES" -eq 1 ]; then
    echo "   -y given: skipping the rebuild, run ./recompile.sh when you are ready."
    exit 0
fi

read -r -p "Run ./recompile.sh now? [y/N]: " ans
case "$ans" in
    [Yy]*) exec "$ROOT/recompile.sh" ;;
    *) echo "Remember to run ./recompile.sh (frontend) and restart the server." ;;
esac
