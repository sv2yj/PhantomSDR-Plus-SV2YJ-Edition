#!/bin/bash
# Build each App*.svelte version separately
# AUTOMATICALLY fixes title and favicon after build

set -e

echo "🚀 Building all App versions with auto title fix"
echo ""

# Check we're in the right directory
if [ ! -d "src" ]; then
    echo "❌ Error: src directory not found!"
    echo "   Run this from the frontend/ directory of your PhantomSDR-Plus"
    echo "   checkout, e.g.:  cd /path/to/PhantomSDR-Plus/frontend && ./build-all.sh"
    exit 1
fi

# Check all App files exist
echo "📋 Checking App files..."
for file in App.svelte; do
    if [ ! -f "src/$file" ]; then
        echo "❌ Error: src/$file not found!"
        exit 1
    fi
    echo "   ✓ $file"
done

# Check for favicon.ico
if [ ! -f "favicon.ico" ]; then
    echo "⚠️  Warning: favicon.ico not found in current directory"
    FAVICON_EXISTS=false
else
    echo "   ✓ favicon.ico found"
    FAVICON_EXISTS=true
fi

# Check for site_information.json
if [ ! -f "site_information.json" ]; then
    echo "⚠️  Warning: site_information.json not found"
    SITEINFO_EXISTS=false
else
    echo "   ✓ site_information.json found"
    SITEINFO_EXISTS=true
fi

# How many desktop builds to run at once.
#
# Largely vestigial since the four variant builds were dropped: there is one
# desktop build left, so nothing queues behind anything.  The machinery is kept
# because it costs nothing and would be needed again if a genuinely different
# desktop page (not a variant of this one) were ever added.
#
# For the record, from when there were five: one build only keeps ~1.4 cores
# busy — Svelte compiling App.svelte is a single thread of work — so 4
# concurrent builds finished in 26s against 78s sequentially, at the cost of
# heat (84C against 62-67C for a single build), which is why the default is 3.
JOBS="${PHANTOM_BUILD_JOBS:-3}"

# Vite must not empty dist/ itself: this script does the cleaning below, and it
# deliberately spares dist/users.json, which the running server owns.  Vite's
# emptyOutDir would delete it.
export PHANTOM_KEEP_OUTDIR=1

BUILD_LOG_DIR="$(mktemp -d)"
trap 'rm -rf "$BUILD_LOG_DIR"' EXIT

# Function to build a version.  Runs in the background; its output is buffered
# to a log so that concurrent builds do not interleave their lines.
build_version() {
    local SMETER=$1
    local LAYOUT=$2
    local VERSION_NAME=$3
    local OUTPUT_DIR=$4
    local BASE_PATH=$5
    local LOG=$6

    {
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo "📦 Built: $VERSION_NAME"
        if [ -n "$SMETER" ]; then
            echo "   Variant:  smeter=$SMETER layout=$LAYOUT"
        else
            echo "   Variant:  site default (variant.json)"
        fi
        echo "   Base path: $BASE_PATH"
        echo "   Output: $OUTPUT_DIR"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

        # The variant reaches App.svelte as a vite define, so all of these read
        # the same unmodified src/main.js.  Each also needs its own visualizer
        # output path, or concurrent builds interleave into one stats.html.
        PHANTOM_SMETER="$SMETER" \
        PHANTOM_LAYOUT="$LAYOUT" \
        PHANTOM_STATS_FILE="stats-$(basename "$OUTPUT_DIR").html" \
            npm run build -- --outDir "$OUTPUT_DIR" --base "$BASE_PATH"
    } > "$LOG" 2>&1
}

# Wait for the running builds, print their logs in a stable order, and fail the
# script if any of them failed.
wait_for_builds() {
    local rc=0
    local pid name log
    for entry in "${RUNNING[@]}"; do
        IFS='|' read -r pid name log <<< "$entry"
        if wait "$pid"; then
            cat "$log"
            echo "   ✅ $name"
        else
            rc=1
            cat "$log"
            echo "   ❌ Failed: $name"
        fi
    done
    RUNNING=()
    return $rc
}

# Start a build, waiting first if $JOBS are already running.
queue_build() {
    local SMETER=$1 LAYOUT=$2 VERSION_NAME=$3 OUTPUT_DIR=$4 BASE_PATH=$5

    if [ "${#RUNNING[@]}" -ge "$JOBS" ]; then
        wait_for_builds || return 1
    fi

    local log="$BUILD_LOG_DIR/$(basename "$OUTPUT_DIR").log"
    build_version "$SMETER" "$LAYOUT" "$VERSION_NAME" "$OUTPUT_DIR" "$BASE_PATH" "$log" &
    RUNNING+=("$!|$VERSION_NAME|$log")
    if [ -n "$SMETER" ]; then
        echo "   ▶ started: $VERSION_NAME (smeter=$SMETER layout=$LAYOUT)"
    else
        echo "   ▶ started: $VERSION_NAME (site default)"
    fi
}

RUNNING=()

# Clean dist directory
#
# Clear the CONTENTS, never the directory itself.  A running spectrumserver
# writes dist/users.json on every listener connect and disconnect
# (write_users_json() in src/events.cpp).  `rm -rf dist` empties the directory,
# the server recreates users.json in the split second before the final rmdir,
# and rm exits non-zero with "Directory not empty".  With `set -e` above, that
# aborts the whole build and leaves dist empty — the site 404s until someone
# notices and rebuilds.  Intermittent by nature: it only fires if a listener
# happens to connect or drop inside that window.
#
# users.json is the server's own live state, not a build output, so it is left
# in place rather than deleted and immediately rewritten.
if [ -d "dist" ]; then
    echo ""
    echo "🗑️  Cleaning old dist/ directory..."
    find dist -mindepth 1 -maxdepth 1 ! -name 'users.json' -exec rm -rf {} +
fi

# Build each version, up to $JOBS at a time.
echo ""
echo "🔨 Starting builds ($JOBS at a time)..."

# Root version: no variant passed, so it follows variant.json — the default the
# sysop picked in recompile.sh.
queue_build ""        ""   "Default"            "dist"            "/"

# There used to be four more builds here, one per S-meter/layout variant, each
# into its own dist/<variant>/ directory.  They produced byte-for-byte the same
# application: since the variants were merged into one App.svelte they differ
# only in the two props it starts with, and the ⚙️ selector now changes those
# in the running page instead of navigating to another build.  Four builds of
# identical code for a value the visitor overrides on first use, so they are
# gone; the site is this one desktop build plus /mobile.

# The mobile build and everything after it need the desktop output complete.
wait_for_builds

# Build the mobile page. It is not a desktop variant — it is its own
# self-contained bundle under dist/mobile/ — so it gets its own script, run
# after the desktop builds because it relies on dist/ already existing.
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📱 Building: Mobile page"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ -f "build-mobile.sh" ]; then
    # Called through bash, not as ./build-mobile.sh: a copy that came back from
    # the GitHub web UI has lost its executable bit and would stop the build.
    bash build-mobile.sh
else
    echo "⚠️  build-mobile.sh not found — /mobile will not be built"
fi

# Redirect stubs for the retired /analog, /digital, /v2-analog and /v2-digital
# URLs.  dist/ was emptied above, so they have to be rewritten every build.
if [ -f "make-redirect-stubs.sh" ]; then
    bash make-redirect-stubs.sh
else
    echo "⚠️  make-redirect-stubs.sh not found — old bookmarks will 404"
fi

# Copy favicon to all directories
if [ "$FAVICON_EXISTS" = true ]; then
    echo ""
    echo "📎 Copying favicon.ico to all directories..."
    cp favicon.ico dist/
    echo "   ✓ dist/favicon.ico"
    
fi

# Copy site_information.json to root
if [ "$SITEINFO_EXISTS" = true ]; then
    echo ""
    echo "📋 Copying site_information.json..."
    cp site_information.json dist/
    echo "   ✓ dist/site_information.json"
fi

# AUTO-FIX TITLE AND FAVICON
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔧 Auto-fixing title and favicon..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ -f "fix-title-python.py" ]; then
    python3 fix-title-python.py
else
    echo "⚠️  Warning: fix-title-python.py not found"
    echo "   Titles will use default values"
    echo ""
    echo "   To fix manually:"
    echo "   python3 fix-title-python.py"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ All builds complete with title fix!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "✨ Title is automatically fixed after every build!"
echo ""
