#!/bin/bash
# Comprehensive debug script - shows everything

echo "╔══════════════════════════════════════════════════════════════════╗"
echo "║                    TITLE DEBUG REPORT                            ║"
echo "╚══════════════════════════════════════════════════════════════════╝"
echo ""

# 1. Check current directory
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "1. CURRENT DIRECTORY"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
pwd
echo ""

# 2. Check if site_information.json exists
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "2. CHECKING site_information.json"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ -f "site_information.json" ]; then
    echo "✓ File exists"
    echo ""
    echo "FULL CONTENTS:"
    echo "───────────────────────────────────────────────────────────────"
    cat site_information.json
    echo ""
    echo "───────────────────────────────────────────────────────────────"
else
    echo "❌ FILE NOT FOUND!"
    echo ""
    exit 1
fi
echo ""

# 3. Extract siteSysop
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "3. EXTRACTING siteSysop"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
SITE_SYSOP=$(grep -o '"siteSysop"[[:space:]]*:[[:space:]]*"[^"]*"' site_information.json | cut -d'"' -f4)

if [ -z "$SITE_SYSOP" ]; then
    echo "❌ siteSysop NOT FOUND or EMPTY!"
    echo ""
    echo "Trying alternative extraction..."
    SITE_SYSOP=$(python3 -c "import json; f=open('site_information.json'); d=json.load(f); print(d.get('siteSysop', ''))" 2>/dev/null)
    
    if [ -z "$SITE_SYSOP" ]; then
        echo "❌ Still not found!"
        echo ""
        echo "Your site_information.json MUST have:"
        echo '  "siteSysop": "YourCallsign"'
        echo ""
    else
        echo "✓ Found with Python: $SITE_SYSOP"
    fi
else
    echo "✓ Found: $SITE_SYSOP"
fi

TITLE="$SITE_SYSOP PhantomSDR+"
echo "✓ Expected title: $TITLE"
echo ""

# 4. Check dist directory
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "4. CHECKING dist/ DIRECTORY"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ -d "dist" ]; then
    echo "✓ dist/ exists"
    echo ""
    echo "Structure:"
    ls -la dist/ | head -10
else
    echo "❌ dist/ NOT FOUND!"
    echo "   You need to build first!"
    echo ""
    exit 1
fi
echo ""

# 5. Check current title in HTML files
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "5. CURRENT TITLES IN HTML FILES"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

for file in "dist/index.html" "dist/digital/index.html" "dist/v2-analog/index.html" "dist/v2-digital/index.html"; do
    if [ -f "$file" ]; then
        echo "File: $file"
        CURRENT_TITLE=$(grep -o '<title>.*</title>' "$file" | sed 's/<title>//;s/<\/title>//')
        echo "  Current: $CURRENT_TITLE"
        echo "  Expected: $TITLE"
        
        if [ "$CURRENT_TITLE" = "$TITLE" ]; then
            echo "  Status: ✅ CORRECT!"
        else
            echo "  Status: ❌ WRONG!"
        fi
        echo ""
    else
        echo "File: $file"
        echo "  Status: ⚠️  NOT FOUND"
        echo ""
    fi
done

# 6. Check favicon
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "6. CHECKING FAVICON"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ -f "favicon.ico" ]; then
    echo "✓ favicon.ico exists in source"
else
    echo "⚠️  favicon.ico NOT found in source"
fi

for dir in "dist" "dist/digital" "dist/v2-analog" "dist/v2-digital"; do
    if [ -f "$dir/favicon.ico" ]; then
        echo "✓ $dir/favicon.ico exists"
    else
        echo "❌ $dir/favicon.ico MISSING"
    fi
done
echo ""

# 7. Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "7. SUMMARY & NEXT STEPS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ -z "$SITE_SYSOP" ]; then
    echo "❌ PROBLEM: siteSysop not found in site_information.json"
    echo ""
    echo "FIX:"
    echo "  nano site_information.json"
    echo ""
    echo "  Add this line:"
    echo '  "siteSysop": "YourCallsign",'
    echo ""
elif grep -q "<title>$TITLE</title>" dist/index.html 2>/dev/null; then
    echo "✅ SUCCESS! Title is correct!"
    echo "   $TITLE"
    echo ""
    echo "Test in browser:"
    echo "  cd dist && python3 -m http.server 8080"
    echo ""
else
    echo "❌ PROBLEM: Title is wrong"
    echo ""
    echo "Expected: $TITLE"
    echo "Actual:   $(grep -o '<title>.*</title>' dist/index.html 2>/dev/null | sed 's/<title>//;s/<\/title>//')"
    echo ""
    echo "FIX:"
    echo "  python3 fix-title-python.py"
    echo ""
    echo "This will inject the correct title immediately!"
    echo ""
fi

echo "╔══════════════════════════════════════════════════════════════════╗"
echo "║                      END OF REPORT                               ║"
echo "╚══════════════════════════════════════════════════════════════════╝"
