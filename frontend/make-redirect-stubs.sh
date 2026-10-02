#!/bin/bash
# Write redirect stubs for the retired per-variant URLs.
#
# Until 2026-08-10 each S-meter/layout variant was its own build, served at
# /analog/, /digital/, /v2-analog/ and /v2-digital/.  Those builds are gone —
# the ⚙️ selector switches variant inside the running page now — but listeners
# who bookmarked one of those URLs would otherwise get a 404.  Each path keeps
# a ~700-byte index.html that sends them to /, where their stored variant (or
# the site default) applies anyway.
#
# dist/ is rebuilt from scratch on every build, so this runs after the build,
# not once by hand.  Called by build-all.sh and build-default.sh.
#
# Drop this call — and the four directories — once the bookmarks have aged out.

set -e

if [ ! -d "dist" ]; then
    echo "⚠️  dist/ not found — skipping redirect stubs"
    exit 0
fi

echo ""
echo "🔗 Writing redirect stubs for the old variant URLs..."

for dir in analog digital v2-analog v2-digital; do
    mkdir -p "dist/$dir"
    cat > "dist/$dir/index.html" << 'EOF'
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="refresh" content="0; url=/">
<link rel="canonical" href="/">
<link rel="icon" href="/favicon.ico">
<title>This page has moved</title>
<style>
  body { background:#0e141c; color:#cfe3ff; font-family:system-ui,-apple-system,sans-serif;
         display:flex; align-items:center; justify-content:center; height:100vh; margin:0;
         text-align:center; padding:1rem; }
  a { color:#7ee0ff; }
</style>
</head>
<body>
<div>
  <p>This page has moved to <a href="/">the main page</a>.</p>
  <p>The S-meter and layout are now chosen from the &#9881;&#65039; menu there,
     without reloading.</p>
</div>
<script>location.replace('/');</script>
</body>
</html>
EOF
    echo "   ✓ dist/$dir/index.html → /"
done
