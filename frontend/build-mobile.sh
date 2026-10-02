#!/bin/bash
# Build ONLY the mobile page (/mobile), leaving the desktop build in place.
#
# The mobile page is a second Vite entry point rather than a separate app, so
# normally it is emitted by the default build (build-default.sh / build-all.sh).
# This script is the fast path for when you are iterating on the mobile UI and
# do not want to rebuild the desktop pages as well.
#
# How it stays safe:
#   PHANTOM_MOBILE_ONLY=1  -> vite.config.js narrows the entry list to the
#                             mobile page and turns OFF emptyOutDir, so the
#                             desktop build already in dist/ is untouched.
#   outDir/base stay dist and / -> the emitted html path is derived from the
#                             entry's location under the project root, so
#                             mobile/index.html lands at dist/mobile/index.html
#                             and its assets resolve from /assets/ as usual.
#
# Caveat: because this build does not share a chunk graph with the desktop
# build, it emits its own copy of the shared code into dist/assets/. Those
# extra chunks are harmless (the desktop keeps referencing its own, which are
# still present) and are cleared by the next full build.

set -e

cd "$(dirname "$0")"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📱 Building: Mobile page only (/mobile)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ ! -d "dist" ]; then
    echo ""
    echo "⚠️  dist/ does not exist yet."
    echo "   Run ./build-default.sh or ./build-all.sh first — the mobile page"
    echo "   is served alongside the desktop build."
    exit 1
fi

# The whole page lives under dist/mobile/, so one directory removal is enough.
echo ""
echo "🗑️  Removing previous mobile output..."
rm -rf dist/mobile

echo ""
PHANTOM_MOBILE_ONLY=1 npm run build -- --outDir "dist" --base "/"

if [ $? -ne 0 ]; then
    echo "   ❌ Mobile build failed"
    exit 1
fi

echo ""
echo "   ✅ Built: dist/mobile/"

# Self-contained means its own favicon too.
if [ -f "favicon.ico" ]; then
    cp favicon.ico dist/mobile/
    echo "   ✓ dist/mobile/favicon.ico"
fi

# Inject the callsign title + favicon, same as every other build script.
if [ -f "fix-title-python.py" ]; then
    echo ""
    python3 fix-title-python.py
else
    echo "⚠️  fix-title-python.py not found, skipping title fix"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Mobile build complete"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🌐 Served at: /mobile"
echo ""
