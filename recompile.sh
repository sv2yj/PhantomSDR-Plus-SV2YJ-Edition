#!/bin/bash

# PhantomSDR-Plus Recompile Script (Enhanced)
# This script helps you recompile backend and/or frontend components
# with support for selecting default App.svelte variant

set -e  # Exit on error

echo "=========================================="
echo "  PhantomSDR-Plus Recompile Script"
echo "=========================================="
echo ""

# Function to find PhantomSDR-Plus directory
find_phantom_dir() {
    # Check if we're already inside PhantomSDR-Plus directory
    if [ -f "meson.build" ] && [ -d "frontend" ] && [ -d "src" ]; then
        PHANTOM_DIR="."
        echo "✅ Found PhantomSDR-Plus in current directory"
        return 0
    fi
    
    # Check if PhantomSDR-Plus exists as a subdirectory
    if [ -d "PhantomSDR-Plus" ]; then
        PHANTOM_DIR="PhantomSDR-Plus"
        echo "✅ Found PhantomSDR-Plus directory"
        return 0
    fi
    
    # Check parent directory
    if [ -d "../PhantomSDR-Plus" ]; then
        PHANTOM_DIR="../PhantomSDR-Plus"
        echo "✅ Found PhantomSDR-Plus in parent directory"
        return 0
    fi
    
    # Check common locations
    if [ -d "$HOME/PhantomSDR-Plus" ]; then
        PHANTOM_DIR="$HOME/PhantomSDR-Plus"
        echo "✅ Found PhantomSDR-Plus in home directory"
        return 0
    fi
    
    # Not found, ask user
    echo "❌ Could not automatically locate PhantomSDR-Plus directory"
    echo ""
    read -p "Enter the full path to PhantomSDR-Plus directory: " user_path
    
    if [ -d "$user_path" ] && [ -f "$user_path/meson.build" ]; then
        PHANTOM_DIR="$user_path"
        echo "✅ Using: $PHANTOM_DIR"
        return 0
    else
        echo "❌ Error: Invalid path or not a PhantomSDR-Plus directory!"
        exit 1
    fi
}

# Function to select and set default App.svelte
select_default_app() {
    echo ""
    echo "=========================================="
    echo "Select Default Variant"
    echo "=========================================="
    echo ""
    echo "Which version should a first-time visitor see?"
    echo ""
    echo "  [1] Analog S-Meter      (smeter=analog,  layout=v1)"
    echo "  [2] Digital S-Meter     (smeter=digital, layout=v1)"
    echo "  [3] V2 Analog S-Meter   (smeter=analog,  layout=v2)"
    echo "  [4] V2 Digital S-Meter  (smeter=digital, layout=v2)"
    echo ""
    read -p "Select default variant [1-4]: " default_choice
    
    FRONTEND_SRC="$PHANTOM_DIR/frontend/src"
    FRONTEND_ROOT="$PHANTOM_DIR/frontend"

    case $default_choice in
        1) DEFAULT_NAME="Analog S-Meter";    SMETER="analog";  LAYOUT="v1";;
        2) DEFAULT_NAME="Digital S-Meter";   SMETER="digital"; LAYOUT="v1";;
        3) DEFAULT_NAME="V2 Analog S-Meter"; SMETER="analog";  LAYOUT="v2";;
        4) DEFAULT_NAME="V2 Digital S-Meter";SMETER="digital"; LAYOUT="v2";;
        *)
            echo "❌ Invalid option. Exiting."
            exit 1
            ;;
    esac
    
    # The four App__*_smeter_.svelte variants were merged into one App.svelte.
    # Selecting the default no longer copies a file over it — that would destroy
    # the merged component.  It records the variant props in variant.json instead.
    if [ ! -f "$FRONTEND_SRC/App.svelte" ]; then
        echo "❌ Error: $FRONTEND_SRC/App.svelte not found"
        exit 1
    fi

    echo ""
    echo "Setting default variant: $DEFAULT_NAME (smeter=$SMETER, layout=$LAYOUT)..."

    # The choice goes to frontend/variant.json, which vite.config.js reads when a
    # build does not name a variant itself — i.e. the root page.  It used to be
    # written into src/main.js, but build-default.sh then rewrote that same file
    # with a hardcoded analog/v1 and the choice was lost.
    cat > "$FRONTEND_ROOT/variant.json" << EOF
{
  "smeter": "$SMETER",
  "layout": "$LAYOUT"
}
EOF

    if [ $? -eq 0 ]; then
        echo "✅ Successfully set $DEFAULT_NAME as the default"
        echo "   This is the STARTING variant: what a first-time visitor gets."
        echo "   The ⚙️ menu lets each visitor switch, and their choice is kept"
        echo "   in that browser (localStorage 'phantom.variant') from then on."
    else
        echo "❌ Failed to write variant.json"
        exit 1
    fi

    # There used to be an update_version_selector() here that regenerated
    # frontend/src/lib/VersionSelector.svelte from a heredoc on every run.  It
    # is gone: the selector no longer navigates between per-variant builds, it
    # assigns App.svelte's smeter/layout props in place, so regenerating it
    # would have reverted that to the old reload-the-page behaviour.  The
    # variant.json write above is the whole job now.
}

# The vendored websocketpp 0.8.2 needs five patched headers to build and to
# behave: the websdr.org fix that accepts Host-less HTTP/1.1 requests, and the
# Boost >= 1.87 compatibility work (io_context, executor_work_guard,
# boost::asio::post, the modern resolver).  install.sh copies them in, but a
# plain recompile used to skip the step, so `meson setup` re-extracting the
# subproject silently reverted the tree to upstream websocketpp.
#
# NOTE: request.hpp is websocketpp's http/impl/request.hpp, NOT http/request.hpp
# — copying it over the latter replaces the class declaration and breaks the
# build with "request_type does not name a type".
WSPP_PATCHES=(
    "request.hpp|websocketpp/http/impl/request.hpp"
    "connection_impl.hpp|websocketpp/impl/connection_impl.hpp"
    "websocketpp_asio.hpp|websocketpp/common/asio.hpp"
    "websocketpp_asio_connection.hpp|websocketpp/transport/asio/connection.hpp"
    "websocketpp_asio_endpoint.hpp|websocketpp/transport/asio/endpoint.hpp"
)

patch_websocketpp() {
    local wspp="$PHANTOM_DIR/subprojects/websocketpp-0.8.2"
    local entry src dst patched=true

    if [ ! -d "$wspp" ]; then
        echo "⚠️  websocketpp not fetched yet ($wspp) — skipping the header patch"
        return 0
    fi

    for entry in "${WSPP_PATCHES[@]}"; do
        src="$PHANTOM_DIR/${entry%%|*}"
        dst="$wspp/${entry##*|}"
        if [ -f "$src" ] && [ -d "$(dirname "$dst")" ]; then
            cp "$src" "$dst"
        else
            patched=false
            echo "⚠️  Missing $src or $(dirname "$dst") — not patched"
        fi
    done

    if [ "$patched" = true ]; then
        echo "✅ websocketpp headers patched (${#WSPP_PATCHES[@]} files)"
    else
        echo "⚠️  websocketpp only partly patched — see the warnings above"
    fi
}

# Function to recompile backend
recompile_backend() {
    echo ""
    echo "=========================================="
    echo "Recompiling Backend"
    echo "=========================================="
    echo ""
    
    cd "$PHANTOM_DIR"
    
    echo "Removing old build directory..."
    rm -rf build
    
    echo "Setting up new build with Meson..."
    meson setup build
    
    if [ $? -ne 0 ]; then
        echo "❌ Error: Meson setup failed!"
        cd - > /dev/null
        exit 1
    fi

    # meson setup can exit 0 and still leave no usable build directory — a
    # failed subproject download (wrapdb unreachable) does exactly that.
    if [ ! -f build/build.ninja ]; then
        echo "❌ Error: meson setup produced no build directory."
        echo "   This is usually a network problem while fetching the"
        echo "   subprojects (wrapdb.mesonbuild.com). Check the output above."
        cd - > /dev/null
        exit 1
    fi
    
    # Must run after `meson setup` (which extracts the subproject) and before
    # the compile.
    echo "Patching websocketpp headers..."
    patch_websocketpp

    echo "Compiling backend..."
    meson compile -C build
    
    if [ $? -eq 0 ]; then
        echo ""
        echo "✅ Backend compiled successfully!"
    else
        echo ""
        echo "❌ Backend compilation failed!"
        cd - > /dev/null
        exit 1
    fi
    
    cd - > /dev/null
}

# Function to recompile frontend
recompile_frontend() {
    echo ""
    echo "=========================================="
    echo "Frontend Build Options"
    echo "=========================================="
    echo ""
    echo "Select which frontend build script to run:"
    echo ""
    echo "  [1] build-all.sh           - Build the site (desktop + /mobile)  (recommended)"
    echo "  [2] build-default.sh       - Build the desktop page only"
    echo "  [3] build-mobile.sh        - Build the mobile page only (/mobile)"
    echo "  [0] Skip frontend build"
    echo ""
    echo "  Note: there is one desktop build now.  The S-meter/layout variants"
    echo "        used to be four extra copies under /analog, /digital,"
    echo "        /v2-analog and /v2-digital; the ⚙️ menu switches between them"
    echo "        inside the running page instead, so those copies are gone"
    echo "        (those four paths now just redirect to /)."
    echo "        /mobile is a self-contained bundle under dist/mobile/, built"
    echo "        by its own script.  [1] builds it after the desktop page;"
    echo "        [3] rebuilds ONLY it (needs a dist/ to already exist)."
    echo ""
    read -p "Select an option [0-3]: " frontend_option
    
    case $frontend_option in
        0)
            echo "Skipping frontend build..."
            return
            ;;
        1)
            BUILD_SCRIPTS=("build-all.sh")
            ;;
        2)
            BUILD_SCRIPTS=("build-default.sh")
            ;;
        3)
            BUILD_SCRIPTS=("build-mobile.sh")
            ;;
        *)
            echo "Invalid option. Skipping frontend build."
            return
            ;;
    esac
    
    # Navigate to frontend directory
    FRONTEND_DIR="$PHANTOM_DIR/frontend"
    
    if [ ! -d "$FRONTEND_DIR" ]; then
        echo "❌ Error: Frontend directory not found at $FRONTEND_DIR"
        exit 1
    fi
    
    cd "$FRONTEND_DIR"
    
    # Run npm install to ensure dependencies are up to date
    echo ""
    echo "Updating npm dependencies..."
    npm install
    
    if [ $? -ne 0 ]; then
        echo "⚠️  Warning: npm install had issues, but continuing..."
    fi
    
    # Execute selected build scripts
    for script in "${BUILD_SCRIPTS[@]}"; do
        echo ""
        echo "=========================================="
        echo "Running $script"
        echo "=========================================="
        
        if [ ! -f "$script" ]; then
            echo "❌ Error: $script not found in $FRONTEND_DIR/"
            continue
        fi
        
        chmod +x "$script"
        ./"$script"
        
        if [ $? -eq 0 ]; then
            echo "✅ $script completed successfully!"
        else
            echo "❌ $script failed!"
        fi
    done
    
    cd - > /dev/null
}


# Main script execution
find_phantom_dir
echo ""

echo "What would you like to recompile?"
echo ""
echo "  [1] Backend only"
echo "  [2] Frontend only (with default variant selection)"
echo "  [3] Both backend and frontend"
echo "  [0] Exit"
echo ""
read -p "Select an option [0-3]: " main_option

case $main_option in
    1)
        recompile_backend
        ;;
    2)
        select_default_app
        recompile_frontend
        ;;
    3)
        recompile_backend
        select_default_app
        recompile_frontend
        ;;
    0)
        echo "Exiting..."
        exit 0
        ;;
    *)
        echo "Invalid option. Exiting."
        exit 1
        ;;
esac

echo ""
echo "=========================================="
echo "✅ Recompile Complete!"
echo "=========================================="
echo ""

if [ -d "$PHANTOM_DIR/frontend/dist" ]; then
    echo "📦 Frontend output: $PHANTOM_DIR/frontend/dist/"
fi

if [ -d "$PHANTOM_DIR/build" ]; then
    echo "📦 Backend output: $PHANTOM_DIR/build/"
fi

echo ""
echo "Summary:"
echo "  - Starting variant: $DEFAULT_NAME"
echo "  - Visitors can switch from the ⚙️ menu; their choice is remembered"
echo ""
echo "Next steps:"
echo "  - Test your changes"
echo "  - Restart your PhantomSDR-Plus server if it's running"
echo ""
echo "Thank you for using PhantomSDR-Plus!"
echo ""
