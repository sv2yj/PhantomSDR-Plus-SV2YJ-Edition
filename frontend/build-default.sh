#!/bin/bash
# Build ONLY the default version (App.svelte)
# AUTOMATICALLY fixes title and favicon after build

set -e

echo "📦 Building Default Version with auto title fix"

if [ ! -f "src/App.svelte" ]; then
    echo "❌ Error: src/App.svelte not found!"
    exit 1
fi

# Check for favicon
if [ ! -f "favicon.ico" ]; then
    echo "⚠️  Warning: favicon.ico not found"
fi

# No PHANTOM_SMETER/PHANTOM_LAYOUT here on purpose: the root page is whichever
# variant the sysop picked in recompile.sh, which writes it to variant.json.
# vite.config.js falls back to analog/v1 when that file is absent.
#
# This script used to write props into src/main.js instead, hardcoded to
# analog/v1 — which silently overwrote the choice recompile.sh had just made, so
# picking "Digital S-Meter" as the default still produced an analog root page.

# Build
npm run build -- --outDir "dist" --base "/"

# Copy favicon if it exists
if [ -f "favicon.ico" ]; then
    cp favicon.ico dist/
    echo "✓ Copied favicon.ico"
fi

# Copy site_information.json if it exists
if [ -f "site_information.json" ]; then
    cp site_information.json dist/
    echo "✓ Copied site_information.json"
fi

# Redirect stubs for the retired per-variant URLs.  Vite empties dist/ on this
# build, so they are rewritten here too, not only in build-all.sh.
if [ -f "make-redirect-stubs.sh" ]; then
    bash make-redirect-stubs.sh
else
    echo "⚠️  make-redirect-stubs.sh not found — old bookmarks will 404"
fi

# AUTO-FIX TITLE
echo ""
echo "🔧 Auto-fixing title and favicon..."
if [ -f "fix-title-python.py" ]; then
    python3 fix-title-python.py
    echo ""
else
    echo "⚠️  fix-title-python.py not found, skipping title fix"
    echo "   Run manually: python3 fix-title-python.py"
    echo ""
fi

echo "✅ Default version built with title fix!"
echo "   ✓ Title includes your siteSysop"
echo "   ✓ Favicon included"
echo "🌐 Test: cd dist && python3 -m http.server port_used"
