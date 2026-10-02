#!/bin/bash
set -euo pipefail

# ==============================================================================
# PhantomSDR-Plus Installer — Ubuntu 22.04 LTS (Jammy) variant
# SV1BTL — https://github.com/sv1btl/PhantomSDR-Plus
#
# install.sh covers Ubuntu 22.04 → 26.04 and Debian 12/13 from one file. This
# variant exists for the four places where Jammy is genuinely different:
#
#   1. debconf. Jammy's python3-matplotlib (pulled in by the RADE step) drags
#      in tzdata, which stops and asks for a geographic area on any host where
#      tzdata was never configured — a minimal cloud or container image. The
#      installer then eats the answer meant for the next question and the run
#      derails. DEBIAN_FRONTEND=noninteractive below makes that impossible.
#
#   2. RADE. Jammy's apt python3-websockets is 10.1 and rade_helper.py needs
#      >= 11.0, so install_rade_ubuntu22.sh is the correct installer here. The
#      generic install.sh calls install_rade.sh, which detects Jammy and asks
#      whether to switch — one more prompt to get wrong. This calls the Jammy
#      installer directly.
#
#   3. OpenCL. intel-opencl-icd is in Jammy's own repos, so the whole
#      per-distro menu in install.sh collapses to one apt-get here.
#
#   4. Compiler. NONE needed — this is worth writing down because it is the
#      thing everyone assumes. Jammy's stock GCC 11.4 accepts -std=c++23 and
#      builds spectrumserver, glaze, tomlplusplus and websocketpp cleanly
#      against Boost 1.74. Do not add gcc-12 here; it buys nothing.
#
# Everything else is identical to install.sh, including the @swc/core pin in
# the npm overrides block — that failure is not Jammy-specific, it hits a fresh
# install on every distro (see the note above the overrides).
# ==============================================================================

# Jammy ships debconf questions in packages the RADE step needs; answering them
# from a pipe is what breaks an unattended run. Set before the first apt-get,
# and exported so setup_admin.sh / install_rade_ubuntu22.sh inherit it.
export DEBIAN_FRONTEND=noninteractive

# ------------------------------------------------------------------------------
# Helpers
# ------------------------------------------------------------------------------

NEEDS_REBOOT=false
RX888_UDEV_DONE=false
RADE_INSTALLED=false
STATS_INSTALLED=false
WSPP_PATCHED=false

red()    { echo -e "\e[31m$*\e[0m"; }
green()  { echo -e "\e[32m$*\e[0m"; }
yellow() { echo -e "\e[33m$*\e[0m"; }
blue()   { echo -e "\e[34m$*\e[0m"; }

banner() {
    echo ""
    echo "=========================================="
    blue "$1"
    echo "=========================================="
}

die() {
    red "❌ Fatal: $*"
    exit 1
}

# Run a command and exit with a clear message on failure.
run() {
    "$@" || die "Command failed: $*"
}

# ------------------------------------------------------------------------------
# websocketpp header patches
# ------------------------------------------------------------------------------
# PhantomSDR-Plus ships patched copies of five websocketpp headers. Meson fetches
# a pristine websocketpp-0.8.2 into subprojects/, so they must be copied over it
# AFTER `meson setup` (which downloads it) and BEFORE `meson compile`.
#   request.hpp / connection_impl.hpp — the project's own changes
#   websocketpp_asio*.hpp             — Boost 1.89 removed
#                                       basic_waitable_timer::expires_from_now(),
#                                       which websocketpp 0.8.2 calls six times;
#                                       without these the backend does not build
#                                       on Ubuntu 26.04 (Boost 1.90) or newer.

WSPP_PATCHES=(
    # NOTE: request.hpp is websocketpp's http/impl/request.hpp (include guard
    # HTTP_PARSER_REQUEST_IMPL_HPP), carrying the websdr.org fix that accepts
    # Host-less HTTP/1.1 requests. Copying it over http/request.hpp — as the
    # old manual instructions said — replaces the class declaration with the
    # implementation and breaks the build with "request_type does not name a
    # type". The live tree has it at the path below, which is the correct one.
    "request.hpp|websocketpp/http/impl/request.hpp"
    "connection_impl.hpp|websocketpp/impl/connection_impl.hpp"
    "websocketpp_asio.hpp|websocketpp/common/asio.hpp"
    "websocketpp_asio_connection.hpp|websocketpp/transport/asio/connection.hpp"
    "websocketpp_asio_endpoint.hpp|websocketpp/transport/asio/endpoint.hpp"
)

patch_websocketpp() {
    local wspp="$PHANTOM_DIR/subprojects/websocketpp-0.8.2"
    local entry src dst

    if [ ! -d "$wspp" ]; then
        yellow "⚠️  websocketpp not fetched yet ($wspp) — skipping the header patch"
        WSPP_PATCHED=false
        # Must not return non-zero: the callers run under `set -e`, so a failed
        # return here would abort the whole installation over a warning.
        return 0
    fi

    WSPP_PATCHED=true
    for entry in "${WSPP_PATCHES[@]}"; do
        src="$PHANTOM_DIR/${entry%%|*}"
        dst="$wspp/${entry##*|}"
        if [ -f "$src" ] && [ -d "$(dirname "$dst")" ]; then
            run cp "$src" "$dst"
        else
            WSPP_PATCHED=false
            yellow "⚠️  Missing $src or $(dirname "$dst") — not patched"
        fi
    done

    if [ "$WSPP_PATCHED" = true ]; then
        green "✅ websocketpp headers patched (${#WSPP_PATCHES[@]} files)"
    else
        yellow "⚠️  websocketpp only partly patched — see the warnings above"
    fi
}

# ------------------------------------------------------------------------------
# Privilege escalation
# ------------------------------------------------------------------------------

if command -v sudo >/dev/null 2>&1; then
    SUDO="sudo"
else
    SUDO=""
fi

# ------------------------------------------------------------------------------
# OS detection
# ------------------------------------------------------------------------------

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MAIN_SCRIPT="$SCRIPT_DIR/install.sh"

detect_os() {
    # Source /etc/os-release — portable across Ubuntu and Debian
    # shellcheck source=/dev/null
    . /etc/os-release
    OS_ID="${ID:-unknown}"                          # ubuntu | debian
    OS_VERSION="${VERSION_ID:-0}"                   # 22.04 | 24.04 | 12 | 13
    OS_CODENAME="${VERSION_CODENAME:-unknown}"       # jammy | noble | bookworm | trixie

    if [ "$OS_ID" = "ubuntu" ] && [ "$OS_CODENAME" = "jammy" ]; then
        OS_LABEL="Ubuntu 22.04 (Jammy)"
        green "✅ Detected: ${OS_LABEL}"
        echo ""
        return 0
    fi

    # Not Jammy — the generic installer is the right one. Mirrors the handover
    # in install_rade_ubuntu22.sh so the two variants behave the same way.
    banner "This is the Ubuntu 22.04 variant"
    echo ""
    echo "  Detected: ${OS_ID} ${OS_VERSION:-(unknown version)} (${OS_CODENAME})"
    echo ""
    echo "  This variant only exists for Ubuntu 22.04's quirks. On your system"
    echo "  the normal installer, install.sh, is the right one — it covers"
    echo "  Ubuntu 22.04 → 26.04 and Debian 12/13."
    echo ""
    if [ -f "$MAIN_SCRIPT" ]; then
        read -rp "Switch to install.sh now? [Y/n]: " use_main
        if [[ ! ${use_main:-y} =~ ^[Nn] ]]; then
            echo "Handing over to install.sh …"
            echo ""
            exec bash "$MAIN_SCRIPT" "$@"
        fi
    else
        yellow "⚠️  install.sh not found next to this script"
    fi

    yellow "⚠️  Continuing with the Jammy variant on a non-Jammy system."
    yellow "   Some steps may need manual adjustment."
    OS_LABEL="${OS_ID} ${OS_VERSION}"
    echo ""
}

# "$@" so the handover to install.sh forwards whatever this was called with.
detect_os "$@"



# ------------------------------------------------------------------------------
# Prerequisites
# ------------------------------------------------------------------------------
# The Debian/Ubuntu base packages, installed before anything else touches the
# system. Order matters: nvm fetches Node.js with curl, and the RX888 / RTL-SDR
# driver builds need libusb — both used to be pulled in later on, so a bare
# minimal image could fail partway through. psmisc provides fuser/killall, which
# the start/stop scripts use.
#
# apt-get is idempotent, so the fuller "Installing System Dependencies" step
# further down simply confirms these and adds the rest.

banner "Prerequisites"

echo "Updating package lists..."
run $SUDO apt-get update -qq

echo "Installing the Debian/Ubuntu prerequisites..."
run $SUDO apt-get install -y \
    curl build-essential cmake pkg-config meson \
    libusb-1.0-0-dev libfftw3-dev libwebsocketpp-dev libflac++-dev \
    zlib1g-dev libzstd-dev libboost-all-dev \
    libopus-dev libliquid-dev \
    git psmisc

green "✅ Prerequisites installed"
echo ""

banner "Checking Node.js and npm"

NVM_VERSION="v0.40.4"
NODE_NEED=22

install_node_via_nvm() {
    echo "Installing nvm ${NVM_VERSION}..."
    # NOTE: Do NOT use `run` here — run() only guards the left side of a pipe.
    # The || die at the end guards the entire pipeline (curl + bash together).
    curl -o- "https://raw.githubusercontent.com/nvm-sh/nvm/${NVM_VERSION}/install.sh" \
        | bash || die "nvm installation script failed"

    export NVM_DIR="$HOME/.nvm"
    # shellcheck source=/dev/null
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

    echo "Installing Node.js ${NODE_NEED}..."
    run nvm install ${NODE_NEED}
    run nvm use ${NODE_NEED}
    run nvm alias default ${NODE_NEED}
}

# Load nvm if already installed
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

NODE_OK=false
if command -v node >/dev/null 2>&1 && command -v npm >/dev/null 2>&1; then
    NODE_MAJOR=$(node --version | cut -d'.' -f1 | tr -d 'v')
    if [ "$NODE_MAJOR" -ge ${NODE_NEED} ]; then
        green "✅ Node.js $(node --version) and npm $(npm --version) — OK"
        NODE_OK=true
    else
        yellow "⚠️  Node.js $(node --version) is too old (need ${NODE_NEED}+)"
    fi
fi

if [ "$NODE_OK" = false ]; then
    if [ ! -d "$HOME/.nvm" ]; then
        install_node_via_nvm
    else
        echo "nvm already installed — loading and upgrading Node.js..."
        # shellcheck source=/dev/null
        \. "$NVM_DIR/nvm.sh"
        run nvm install ${NODE_NEED}
        run nvm use ${NODE_NEED}
        run nvm alias default ${NODE_NEED}
    fi

    command -v node >/dev/null 2>&1 && command -v npm >/dev/null 2>&1 \
        || die "Node.js / npm installation failed. Install Node.js ${NODE_NEED}+ manually and retry."

    green "✅ Node.js $(node --version) and npm $(npm --version) installed"
fi

echo ""

# ------------------------------------------------------------------------------
# Locate PhantomSDR-Plus source tree
# ------------------------------------------------------------------------------

banner "Locating PhantomSDR-Plus directory"

find_phantom_dir() {
    local candidates=(
        "."
        "PhantomSDR-Plus"
        "../PhantomSDR-Plus"
        "$HOME/PhantomSDR-Plus"
    )

    for dir in "${candidates[@]}"; do
        if [ -f "$dir/meson.build" ] && [ -d "$dir/frontend" ] && [ -d "$dir/src" ]; then
            PHANTOM_DIR=$(realpath "$dir")
            green "✅ Found PhantomSDR-Plus at: $PHANTOM_DIR"
            return 0
        fi
    done

    red "❌ Could not locate PhantomSDR-Plus automatically"
    echo ""
    read -rp "Enter the full path to the PhantomSDR-Plus directory: " user_path
    if [ -d "$user_path" ] && [ -f "$user_path/meson.build" ]; then
        PHANTOM_DIR=$(realpath "$user_path")
        green "✅ Using: $PHANTOM_DIR"
    else
        die "Path '$user_path' is not a valid PhantomSDR-Plus directory."
    fi
}

find_phantom_dir
echo ""

# ------------------------------------------------------------------------------
# System dependencies
# ------------------------------------------------------------------------------

banner "Installing System Dependencies"

echo "Updating package lists..."
run $SUDO apt-get update -qq

echo "Installing build tools and libraries..."
run $SUDO apt-get install -y \
    build-essential cmake pkg-config meson ninja-build \
    libfftw3-dev libwebsocketpp-dev libflac++-dev \
    zlib1g-dev libzstd-dev libboost-all-dev \
    libopus-dev libliquid-dev \
    libcurl4-openssl-dev curl \
    nlohmann-json3-dev \
    git \
    util-linux \
    nano

green "✅ System packages installed"
echo ""

# ------------------------------------------------------------------------------
# Build PhantomSDR-Plus backend
# ------------------------------------------------------------------------------

banner "Building PhantomSDR-Plus Backend"

cd "$PHANTOM_DIR"

echo "Configuring with Meson..."
# --wipe reconfigures an existing valid build tree.
# On a fresh clone or after 'rm -rf build', there is no valid tree and
# --wipe will fail.  Check for the sentinel file meson writes on success.
if [ -f build/meson-private/build.ninja ]; then
    run meson setup --wipe build
else
    rm -rf build
    run meson setup build
fi

# meson setup can exit 0 and still leave no usable build directory — a failed
# subproject download (wrapdb unreachable) does exactly that, and the next
# command then fails with a confusing "not a meson build directory".
if [ ! -f build/build.ninja ]; then
    die "meson setup did not produce a build directory.
       This is usually a network problem while fetching the subprojects
       (wrapdb.mesonbuild.com). Check the output above, then re-run."
fi

patch_websocketpp

echo "Compiling (using 2 cores to stay within memory limits on low-RAM systems)..."
run meson compile -j2 -C build

green "✅ Backend compiled: $PHANTOM_DIR/build/"
cd - > /dev/null
echo ""

# ------------------------------------------------------------------------------
# SDR hardware driver
# ------------------------------------------------------------------------------

banner "SDR Hardware Setup"

echo "Which SDR would you like to set up?"
echo "  [1] RX888 MkII / RX888"
echo "  [2] RTL-SDR"
echo "  [3] SDRPlay (via libmirisdr-5)"
echo "  [4] Skip — install SDR driver manually later"
read -rp "Select an option [1-4]: " option

case $option in

    # ------------------------------------------------------------------
    1)  echo ""
        echo "Setting up RX888 MkII / RX888..."

        # Remove any system-packaged Rust that might conflict.
        $SUDO apt-get remove --purge -y rustc cargo 2>/dev/null || true

        echo "Installing Rust via rustup..."
        # NOTE: Do NOT use `run` here — run() only guards the left side of a pipe.
        curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \
            | sh -s -- -y || die "rustup installation script failed"
        # shellcheck source=/dev/null
        source "$HOME/.cargo/env"

        echo "Cloning rx888_stream..."
        if [ -d "rx888_stream" ]; then
            yellow "rx888_stream directory already exists — pulling latest..."
            cd rx888_stream
            run git pull
        else
            run git clone https://github.com/rhgndf/rx888_stream
            cd rx888_stream
        fi

        echo "Building rx888_stream..."
        run env RUSTFLAGS="-C target-cpu=native" cargo build --release
        run env RUSTFLAGS="-C target-cpu=native" cargo install --path .

        green "✅ RX888 driver built and installed (~/.cargo/bin/rx888_stream)"

        # Install the udev rules straight away: without them rx888_stream — and
        # so every start-*.sh launcher — needs sudo to open the device.  The
        # script re-executes itself with sudo and is idempotent.
        if [ -f "$PHANTOM_DIR/setup-rx888-udev.sh" ]; then
            echo ""
            echo "Installing RX888 udev rules (so the server starts without sudo)..."
            chmod +x "$PHANTOM_DIR/setup-rx888-udev.sh" 2>/dev/null || true
            if RX888_USER="$(id -un)" "$PHANTOM_DIR/setup-rx888-udev.sh"; then
                RX888_UDEV_DONE=true
                green "✅ RX888 udev rules installed — rx888_stream runs without sudo"
                yellow "   ⚠️  Log out and back in once for the 'plugdev' group to apply."
            else
                yellow "⚠️  setup-rx888-udev.sh failed — run it manually later:"
                yellow "     cd $PHANTOM_DIR && ./setup-rx888-udev.sh"
            fi
        else
            yellow "⚠️  setup-rx888-udev.sh not found in $PHANTOM_DIR — skipping udev rules"
        fi
        cd ..
        ;;

    # ------------------------------------------------------------------
    2)  echo ""
        read -rp "Do you have an RTL-SDR Blog V4? (y/n): " rtlsdr_v4

        if [[ $rtlsdr_v4 =~ ^[Yy]$ ]]; then
            echo "Setting up RTL-SDR Blog V4..."

            # Remove conflicting upstream packages.
            $SUDO apt-get purge -y "^librtlsdr" 2>/dev/null || true
            $SUDO rm -f \
                /usr/lib/librtlsdr* \
                /usr/include/rtl-sdr* \
                /usr/local/lib/librtlsdr* \
                /usr/local/include/rtl-sdr* \
                /usr/local/include/rtl_* \
                /usr/local/bin/rtl_*

            run $SUDO apt-get install -y libusb-1.0-0-dev git cmake pkg-config

            if [ -d "rtl-sdr-blog" ]; then
                yellow "rtl-sdr-blog already exists — pulling latest..."
                cd rtl-sdr-blog
                run git pull
                cd ..
            else
                run git clone https://github.com/rtlsdrblog/rtl-sdr-blog
            fi

            cd rtl-sdr-blog
            mkdir -p build && cd build
            run cmake ../ -DINSTALL_UDEV_RULES=ON
            run make
            run $SUDO make install
            run $SUDO cp ../rtl-sdr.rules /etc/udev/rules.d/
            run $SUDO ldconfig
            echo 'blacklist dvb_usb_rtl28xxu' \
                | $SUDO tee /etc/modprobe.d/blacklist-dvb_usb_rtl28xxu.conf > /dev/null
            cd ../..

            green "✅ RTL-SDR Blog V4 drivers installed"
            yellow "⚠️  A reboot is required for the RTL-SDR V4 to be recognised."
            NEEDS_REBOOT=true

        else
            echo "Setting up standard RTL-SDR..."
            run $SUDO apt-get install -y \
                libusb-1.0-0-dev librtlsdr0 librtlsdr-dev rtl-sdr
            green "✅ Standard RTL-SDR drivers installed"
        fi
        ;;

    # ------------------------------------------------------------------
    3)  echo ""
        echo "Setting up SDRPlay via libmirisdr-5..."

        if [ -d "libmirisdr-5" ]; then
            yellow "libmirisdr-5 already exists — re-using existing clone."
        else
            run git clone https://github.com/ericek111/libmirisdr-5
        fi

        cd libmirisdr-5 || die "Failed to enter libmirisdr-5 directory"
        # Build out-of-source (mirrors RTL-SDR section; avoids projects that
        # reject in-source builds and keeps the source tree clean).
        mkdir -p build && cd build
        run cmake ..
        run make
        run $SUDO make install
        run $SUDO ldconfig
        cd ../..

        green "✅ SDRPlay (libmirisdr-5) installed"
        ;;

    # ------------------------------------------------------------------
    4)  echo "Skipping SDR driver installation."
        ;;

    # ------------------------------------------------------------------
    *)  die "Invalid option '$option'." ;;

esac
echo ""

# ------------------------------------------------------------------------------
# Site information
# ------------------------------------------------------------------------------

banner "Site Information"

SITE_INFO_PATH="$PHANTOM_DIR/frontend/site_information.json"

[ -f "$SITE_INFO_PATH" ] \
    || die "site_information.json not found at $SITE_INFO_PATH — is the source tree complete?"

echo "You will now edit your site information (callsign, location, hardware, etc.)."
echo ""
read -rp "Press ENTER to open the editor (or Ctrl+C to skip)..."

if command -v nano >/dev/null 2>&1; then
    VISUAL_EDITOR="nano"
elif command -v vim >/dev/null 2>&1; then
    VISUAL_EDITOR="vim"
elif command -v vi >/dev/null 2>&1; then
    VISUAL_EDITOR="vi"
else
    echo "No editor found — installing nano..."
    run $SUDO apt-get install -y nano
    VISUAL_EDITOR="nano"
fi

[ "$VISUAL_EDITOR" = "nano" ] && echo "(Ctrl+X → Y → ENTER to save and exit)"
echo ""
"$VISUAL_EDITOR" "$SITE_INFO_PATH" || yellow "⚠️  Editor exited non-zero — verify the file manually."
echo ""
green "✅ Site information saved: $SITE_INFO_PATH"
echo ""

# ------------------------------------------------------------------------------
# Frontend dependencies and build
# ------------------------------------------------------------------------------

banner "Installing Frontend Dependencies"

[ -d "$PHANTOM_DIR/frontend" ] \
    || die "Frontend directory not found at $PHANTOM_DIR/frontend"

cd "$PHANTOM_DIR/frontend"

echo "Cleaning previous install artefacts..."
rm -rf node_modules package-lock.json

# ------------------------------------------------------------------------------
# Patch package.json before any npm install
# ------------------------------------------------------------------------------
# This does two things automatically:
#
#   1. Injects an "overrides" block so npm resolves deprecated/vulnerable
#      transitive packages to safe modern versions on first install, avoiding
#      the flood of `npm warn deprecated` messages.
#
#   2. Upgrades ESLint to ^9 in devDependencies if the project still pins ^8.
#      ESLint 8 is deprecated and drags in rimraf@2/3, glob@7, and the
#      @humanwhocodes/* packages.  ESLint 9 replaces all of them.
#      NOTE: ESLint 9 uses flat config (eslint.config.js).  If linting breaks
#      after this upgrade run:  npx @eslint/migrate-config .eslintrc.*
#
# Packages deliberately NOT overridden:
#   inflight@1.0.6  — deprecated but has no API-compatible replacement and
#                     poses no security risk (JS GC handles the leak in
#                     practice for short-lived processes like a build tool).
# ------------------------------------------------------------------------------
echo "Patching package.json -- injecting transitive dependency overrides..."
python3 - "$PHANTOM_DIR/frontend/package.json" << 'PYEOF'
import sys, json, re

path = sys.argv[1]
with open(path) as fh:
    pkg = json.load(fh)

all_deps = {}
all_deps.update(pkg.get('dependencies', {}))
all_deps.update(pkg.get('devDependencies', {}))

# Repair: if a previous run of this script incorrectly upgraded eslint to ^9
# while eslint-config-* or eslint-plugin-* packages (which pin to eslint@^8)
# are still present, revert eslint back to ^8.0.0.
# eslint-config-standard@17, and most other ESLint configs/plugins published
# before 2025, carry a peer dep of eslint@^8 — they will break under ^9.
has_eslint_ecosystem = any(
    k.startswith('eslint-config-') or k.startswith('eslint-plugin-')
    for k in all_deps
)
for section in ('dependencies', 'devDependencies'):
    cur = pkg.get(section, {}).get('eslint', '')
    # Match major version 9 in any semver range form:
    # ^9, ^9.0.0, ~9.0.0, >=9.0.0, 9, 9.x, 9.0.0, etc.
    if cur and re.search(r'(?:^|[^\d])9(?:\.|$|\s|x)', cur) and has_eslint_ecosystem:
        pkg[section]['eslint'] = '^8.0.0'
        print('   eslint: reverted ^9 -> ^8.0.0 (eslint-config/plugin packages require ^8)')

# Force safe versions for deprecated/vulnerable transitive packages.
#   rimraf ^4  - rimraf@2/3 are EOL
#   glob  ^10  - glob@7 has a published ReDoS security advisory
# ESLint 8 deprecation is a warning only, not a security issue — not touched.
# inflight has no API-compatible replacement — not touched.
#
#   @swc/core 1.15.33 — THIS IS THE ONE THAT BREAKS A FRESH INSTALL.
#     vite-plugin-top-level-await@1.6.0 depends on "@swc/core": "^1.12.14", so
#     a fresh npm install resolves 1.16.0, whose printSync() rejects the AST
#     the plugin hands it:
#
#       [vite-plugin-top-level-await] missing field `type`
#           at Compiler.printSync (node_modules/@swc/core/index.js:257:29)
#       error during build:  ->  build-all.sh reports "❌ Failed: Default"
#
#     The backend is already built by then, so the install looks like it
#     "half worked": a spectrumserver binary and no frontend/dist to serve.
#     Because install.sh deletes node_modules and package-lock.json before
#     installing, every fresh install gets the newest @swc/core and hits this
#     — machines that were installed before 1.16.0 shipped keep working, which
#     is why this reads as "the installer is broken" rather than "npm moved".
#
#     Nothing about this is Ubuntu 22.04 specific. Verified in a clean Jammy
#     container: 1.16.0 fails, 1.15.33 builds all variants. 1.15.33 is also
#     what the reference machine runs. Revisit when the plugin publishes a
#     release that tracks the newer SWC AST.
overrides = {
    'rimraf': '^4.0.0',
    'glob':   '^10.3.0',
    '@swc/core': '1.15.33',
}
pkg.setdefault('overrides', {}).update(overrides)
for k, v in overrides.items():
    print('   override', k, '->', v)

with open(path, 'w') as fh:
    json.dump(pkg, fh, indent=2)
    print(file=fh)
PYEOF

echo ""
echo "Installing pinned Vite / Svelte packages..."
# VERSION NOTES (April 2026)
# ─────────────────────────────────────────────────────────────────────────────
# Vite 8 (current stable) requires @sveltejs/vite-plugin-svelte v7, which in
# turn requires Svelte 5.  PhantomSDR-Plus uses Svelte 4 components; upgrading
# requires source migration:  npx sv migrate svelte-5
# Until that migration is done, Vite 5.4.16 + Svelte 4 are the correct pins.
#
# When ready to upgrade replace this block with:
#   vite@latest  "@sveltejs/vite-plugin-svelte@^7"  "svelte@^5"
# and drop @vitejs/plugin-legacy (Vite 8 targets modern browsers by default).
#
# esbuild: NOT pinned here — Vite 5 has a strict peer range (^0.21.x);
# let npm resolve it automatically from Vite's peer dep.
# ─────────────────────────────────────────────────────────────────────────────
run npm install --save-dev \
    vite@5.4.16 \
    "@sveltejs/vite-plugin-svelte@^3.1.2" \
    "@vitejs/plugin-legacy@^5.4.2" \
    "svelte@^4.2.20"

echo ""
echo "Installing remaining dependencies from package.json..."
run npm install

echo ""
echo "Installing Opus WASM decoder..."
run npm install @wasm-audio-decoders/opus-ml

echo ""
echo "Installing emoji picker..."
run npm install emoji-picker-element

echo ""
echo "Installing Socket.IO client (FreeDV Reporter live feed)..."
run npm install socket.io-client

# Run audit fix WITHOUT --force so only safe (non-breaking) patches are
# applied.  --force can silently pull in Vite 6/7/8 or Svelte 5 and break
# the build; we deliberately avoid it here.
echo ""
echo "Running safe audit fix..."
npm audit fix 2>/dev/null || true
# Re-install after audit fix to ensure the lock file is consistent.
run npm install

green "✅ npm dependencies installed"

# The autorun spot-reporter daemon reuses the frontend's node_modules (ws +
# cbor-x) through a symlink. It is git-ignored, so a fresh clone won't have it —
# (re)create it here so `node autorun/index.js` can resolve its dependencies.
ln -sfn ../frontend/node_modules "$PHANTOM_DIR/autorun/node_modules"
green "✅ autorun/node_modules linked to frontend/node_modules"
cd - > /dev/null
echo ""


# ------------------------------------------------------------------------------
# Build all frontend variants
# ------------------------------------------------------------------------------

banner "Building All Frontend Versions"

BUILD_SCRIPT="$PHANTOM_DIR/frontend/build-all.sh"

if [ ! -f "$BUILD_SCRIPT" ]; then
    yellow "⚠️  build-all.sh not found at $BUILD_SCRIPT — skipping."
    yellow "    Run it manually once you have the script in place:"
    yellow "      cd $PHANTOM_DIR/frontend && ./build-all.sh"
else
    chmod +x "$BUILD_SCRIPT"
    cd "$PHANTOM_DIR/frontend"

    if ./build-all.sh; then
        green "✅ All frontend versions built: $PHANTOM_DIR/frontend/dist/"
    else
        yellow "⚠️  build-all.sh exited with errors — check output above."
        yellow "    Re-run manually: cd $PHANTOM_DIR/frontend && ./build-all.sh"
    fi

    cd - > /dev/null
fi
echo ""

# ------------------------------------------------------------------------------
# OpenCL (optional, Intel CPU / GPU)
# ------------------------------------------------------------------------------

# ------------------------------------------------------------------------------
# OpenCL hardware detection
# ------------------------------------------------------------------------------
# OpenCL is installed by default now, but only where there is something for an
# ICD to drive: an Intel / AMD / NVIDIA GPU, or an x86 CPU (the vendor runtimes
# expose the CPU itself as a device).  Machines with neither — most ARM SBCs, a
# VM with a virtio-only display — are told so instead of having packages
# installed that would leave a broken ICD behind.

OPENCL_HW_VENDOR="none"
OPENCL_HW_DESC="no OpenCL-capable device"

detect_opencl_hardware() {
    local gpu_ids="" vfile vid cpu_vendor

    # PCI GPUs straight from sysfs — no pciutils needed.
    for vfile in /sys/class/drm/card*/device/vendor; do
        [ -r "$vfile" ] || continue
        vid=$(cat "$vfile" 2>/dev/null || true)
        gpu_ids="$gpu_ids $vid"
    done

    # lspci as a second source, for devices without a bound drm node.
    if command -v lspci >/dev/null 2>&1; then
        gpu_ids="$gpu_ids $(lspci 2>/dev/null | grep -iE 'vga|3d controller|display' || true)"
    fi

    cpu_vendor=$(lscpu 2>/dev/null | awk -F: '/Vendor ID/{gsub(/ /,"",$2); print $2; exit}')

    case "$gpu_ids" in
        *0x8086*|*Intel*|*intel*)
            OPENCL_HW_VENDOR="intel";  OPENCL_HW_DESC="Intel GPU" ;;
        *0x1002*|*AMD*|*ATI*|*amd*)
            OPENCL_HW_VENDOR="amd";    OPENCL_HW_DESC="AMD GPU" ;;
        *0x10de*|*NVIDIA*|*nVidia*)
            OPENCL_HW_VENDOR="nvidia"; OPENCL_HW_DESC="NVIDIA GPU" ;;
    esac

    if [ "$OPENCL_HW_VENDOR" = "none" ]; then
        case "$cpu_vendor" in
            GenuineIntel) OPENCL_HW_VENDOR="intel"; OPENCL_HW_DESC="Intel CPU (no GPU found)" ;;
            AuthenticAMD) OPENCL_HW_VENDOR="amd";   OPENCL_HW_DESC="AMD CPU (no GPU found)" ;;
        esac
    fi
}

# Maps the detected hardware onto the provider menus further down:
#   [1] Intel runtime   [2] Mesa / Rusticl   [3] POCL (CPU only)
opencl_auto_choice() {
    case "$OPENCL_HW_VENDOR" in
        intel) echo 1 ;;
        amd)   echo 2 ;;
        *)     echo 3 ;;   # NVIDIA ships its own ICD with the proprietary
                           # driver, so POCL is the sane default here.
    esac
}

detect_opencl_hardware

banner "OpenCL Support (Optional)"

echo "OpenCL can accelerate FFT processing on Intel CPUs and integrated GPUs."
echo "Recommended for Intel-based systems."
echo ""
echo "Detected hardware: ${OPENCL_HW_DESC}"
echo ""

if [ "$OPENCL_HW_VENDOR" = "none" ]; then
    install_opencl="n"
    yellow "⚠️  OpenCL cannot be installed on this machine — no Intel / AMD / NVIDIA"
    yellow "    GPU and no x86 CPU runtime was found."
    yellow "    PhantomSDR-Plus runs fine without it (FFTW is used instead) — just"
    yellow "    leave the OpenCL options out of your .toml."
else
    read -rp "Install OpenCL support? [Y/n]: " install_opencl
    if [[ ${install_opencl:-y} =~ ^[Nn] ]]; then
        install_opencl="n"
    else
        install_opencl="y"
    fi
fi

if [[ $install_opencl =~ ^[Yy]$ ]]; then
    echo ""

    opencl_ok=false

    # Jammy is the easy case, and this is the whole reason the OpenCL section
    # is shorter here than in install.sh: intel-opencl-icd, mesa-opencl-icd,
    # pocl-opencl-icd, ocl-icd-opencl-dev, libclfft-dev and clinfo are all in
    # the 22.04 repos. install.sh needs a per-distro menu because Noble
    # dropped intel-opencl-icd (Intel's own graphics repo) and Debian needs
    # Rusticl or POCL chosen by hand — none of that applies here, so the
    # detected hardware picks the ICD and one apt-get finishes the job.
    case "$OPENCL_HW_VENDOR" in

        intel)
            echo "Installing OpenCL packages (Ubuntu 22.04 — distro repo)..."
            if $SUDO apt-get install -y \
                    ocl-icd-opencl-dev intel-opencl-icd libclfft-dev clinfo; then
                opencl_ok=true
                opencl_provider="intel-opencl-icd"
            fi
            ;;

        amd)
            echo "Installing OpenCL packages (Mesa / Clover)..."
            if $SUDO apt-get install -y \
                    ocl-icd-opencl-dev mesa-opencl-icd libclfft-dev clinfo; then
                opencl_ok=true
                opencl_provider="mesa-opencl-icd"
            fi
            ;;

        # NVIDIA ships its own ICD with the proprietary driver, so POCL is the
        # sane default here — same reasoning as install.sh.
        *)
            echo "Installing OpenCL packages (POCL — CPU only)..."
            if $SUDO apt-get install -y \
                    ocl-icd-opencl-dev pocl-opencl-icd libclfft-dev clinfo; then
                opencl_ok=true
                opencl_provider="pocl-opencl-icd (CPU)"
            fi
            ;;
    esac

    if [ "$opencl_ok" = true ]; then
        green "✅ OpenCL packages installed"
        echo ""
        echo "Testing OpenCL installation..."
        # Run as the current user (not root) — GPU device visibility
        # for the user account is what actually matters.
        if clinfo > /dev/null 2>&1; then
            green "✅ OpenCL device(s) detected"
        else
            yellow "⚠️  clinfo found no devices — reboot and run 'clinfo' to verify."
        fi
        NEEDS_REBOOT=true
    else
        yellow "⚠️  OpenCL package installation failed — continuing without it."
    fi
else
    echo "Skipping OpenCL."
fi
echo ""

# ------------------------------------------------------------------------------
# Admin panel (optional)
# ------------------------------------------------------------------------------

ADMIN_INSTALLED=false

if [ -f "$PHANTOM_DIR/setup_admin.sh" ]; then
    banner "Admin Panel (optional)"
    echo ""
    echo "A small web dashboard for this receiver: server status, CPU/RAM and"
    echo "user graphs, log viewer, config editor, connected users with a kick"
    echo "button, chat moderation, spot reporting — and a CPU over-temperature"
    echo "guard that stops the server before the heat can do damage."
    echo ""
    echo "It runs as two Python services behind a single public port and is"
    echo "reached at  http://YOUR_IP:<proxy_port>/admin"
    echo ""
    yellow "   Setup asks for three port numbers and for the start/stop scripts."
    yellow "   Installed by default — answer 'n' to skip it and run"
    yellow "   ./setup_admin.sh whenever you like instead."
    echo ""
    read -rp "Install the admin panel now? [Y/n]: " install_admin

    if [[ ! ${install_admin:-y} =~ ^[Nn] ]]; then
        # setup_admin.sh pulls its Python libraries with pip, which a minimal
        # system does not always have. Not fatal: setup_admin.sh prints the
        # manual command if this fails.
        if ! command -v pip3 >/dev/null 2>&1; then
            echo ""
            echo "[*] Installing pip..."
            $SUDO apt-get install -y python3-pip || yellow "   ⚠️  Could not install pip — setup will tell you what to run"
        fi
        chmod +x "$PHANTOM_DIR/setup_admin.sh" "$PHANTOM_DIR/manage_admin.sh" 2>/dev/null || true
        echo ""
        if ( cd "$PHANTOM_DIR" && ./setup_admin.sh ); then
            ADMIN_INSTALLED=true
        else
            yellow "⚠️  Admin panel setup did not finish — run ./setup_admin.sh again later"
        fi
    else
        echo "Skipping the admin panel — run ./setup_admin.sh later if you change your mind."
    fi
    echo ""
fi

# ------------------------------------------------------------------------------
# RADE / FreeDV sidecar
# ------------------------------------------------------------------------------

# Jammy needs install_rade_ubuntu22.sh, not install_rade.sh: the apt
# python3-websockets here is 10.1 and rade_helper.py needs >= 11.0, so the
# Jammy variant installs it from pip instead. install_rade.sh does detect this
# and offers to hand over, but that is an extra prompt in the middle of an
# install — call the right script directly and skip the question.
RADE_SCRIPT="$PHANTOM_DIR/install_rade_ubuntu22.sh"
[ -f "$RADE_SCRIPT" ] || RADE_SCRIPT="$PHANTOM_DIR/install_rade.sh"

if [ -f "$RADE_SCRIPT" ]; then
    banner "RADE / FreeDV Decoder"
    echo ""
    echo "RADE (Radio Autoencoder) decodes FreeDV RADE V1 voice in the browser."
    echo "It builds the radae repository into ~/radae and runs as a small Python"
    echo "sidecar on port 8074, controlled by ./rade.sh."
    echo ""
    yellow "   Installed by default — answer 'n' to skip it."
    yellow "   Packages come from apt; torch and websockets>=11.0 are pulled"
    yellow "   with pip, because Jammy's own websockets (10.1) is too old."
    echo ""
    if [ "$(basename "$RADE_SCRIPT")" != "install_rade_ubuntu22.sh" ]; then
        yellow "   ⚠️  install_rade_ubuntu22.sh is missing — falling back to"
        yellow "       install_rade.sh, which will ask to switch to it."
    fi
    echo ""
    read -rp "Install RADE now? [Y/n]: " install_rade

    if [[ ! ${install_rade:-y} =~ ^[Nn] ]]; then
        chmod +x "$PHANTOM_DIR/install_rade.sh" \
                 "$PHANTOM_DIR/install_rade_ubuntu22.sh" \
                 "$PHANTOM_DIR/rade.sh" 2>/dev/null || true
        echo ""
        # PHANTOM_SKIP_RECOMPILE stops the RADE installer from running
        # recompile.sh — this installer does one full rebuild at the end.
        # PHANTOM_SKIP_ADMIN_OFFER stops it from asking about the admin panel
        # a second time.
        if ( cd "$PHANTOM_DIR" \
             && PHANTOM_DIR="$PHANTOM_DIR" PHANTOM_SKIP_RECOMPILE=1 \
                PHANTOM_SKIP_ADMIN_OFFER=1 "$RADE_SCRIPT" ); then
            RADE_INSTALLED=true
            green "✅ RADE installed"
        else
            yellow "⚠️  RADE setup did not finish — run ./install_rade_ubuntu22.sh again later"
        fi
    else
        echo "Skipping RADE — run ./install_rade_ubuntu22.sh later if you change your mind."
    fi
    echo ""
fi

# ------------------------------------------------------------------------------
# Statistics server
# ------------------------------------------------------------------------------

if [ -f "$PHANTOM_DIR/install-stats-server.sh" ]; then
    banner "System Statistics Server"
    echo ""
    echo "A small Node.js service that publishes this machine's CPU, RAM and"
    echo "temperature readings for the receiver page to display."
    echo ""
    yellow "   Setup asks for an install directory, a port and this server's"
    yellow "   address, and can register it as a systemd service."
    yellow "   Installed by default — answer 'n' to skip it."
    echo ""
    read -rp "Install the statistics server now? [Y/n]: " install_stats

    if [[ ! ${install_stats:-y} =~ ^[Nn] ]]; then
        chmod +x "$PHANTOM_DIR/install-stats-server.sh" 2>/dev/null || true
        echo ""
        if ( cd "$PHANTOM_DIR" \
             && PHANTOM_SKIP_ADMIN_OFFER=1 ./install-stats-server.sh ); then
            STATS_INSTALLED=true
            green "✅ Statistics server installed"
        else
            yellow "⚠️  Statistics server setup did not finish —"
            yellow "    run ./install-stats-server.sh again later"
        fi
    else
        echo "Skipping the statistics server — run ./install-stats-server.sh later."
    fi
    echo ""
fi

# ------------------------------------------------------------------------------
# websocketpp header patch
# ------------------------------------------------------------------------------
# The headers were already applied before the backend build; this is the safety
# net for the final rebuild (see patch_websocketpp near the top of this script).

banner "Patching websocketpp Headers"

# meson may have re-fetched the subproject since the build; re-apply so the
# final rebuild below definitely compiles the patched headers.
patch_websocketpp
echo ""

# ------------------------------------------------------------------------------
# Frequency marker list
# ------------------------------------------------------------------------------
# update-markers.sh refreshes the on-waterfall frequency markers from the online
# lists. A snapshot of the tree does not always keep the executable bit, so set
# it here — otherwise the first run stops with "Permission denied".

banner "Frequency Marker List"

MARKERS_DIR="$PHANTOM_DIR/frequencylist"
if [ -f "$MARKERS_DIR/update-markers.sh" ]; then
    chmod +x "$MARKERS_DIR/update-markers.sh" 2>/dev/null || true
    green "✅ frequencylist/update-markers.sh is executable"
    echo "   Refresh the markers whenever you want to:"
    echo "      cd $MARKERS_DIR && ./update-markers.sh"
else
    yellow "⚠️  $MARKERS_DIR/update-markers.sh not found — skipping"
fi
echo ""

# ------------------------------------------------------------------------------
# Final rebuild
# ------------------------------------------------------------------------------
# Last action: one full rebuild, so the backend picks up the patched headers and
# the frontend is built from whatever RADE and the admin panel just added.

banner "Final Rebuild (recompile.sh)"

echo ""
echo "This rebuilds everything one last time. Answer:"
echo "   [3] Both backend and frontend  →  your default variant  →  [1] build-all.sh"
echo ""

if [ -f "$PHANTOM_DIR/recompile.sh" ]; then
    chmod +x "$PHANTOM_DIR/recompile.sh" 2>/dev/null || true
    if ( cd "$PHANTOM_DIR" && ./recompile.sh ); then
        green "✅ Final rebuild finished"
    else
        yellow "⚠️  recompile.sh did not finish — run it manually:"
        yellow "      cd $PHANTOM_DIR && ./recompile.sh"
    fi
else
    yellow "⚠️  recompile.sh not found in $PHANTOM_DIR — skipping the final rebuild"
fi
echo ""

# ------------------------------------------------------------------------------
# Summary
# ------------------------------------------------------------------------------

banner "Installation Summary"

echo ""
green "✅ System packages (Ubuntu 22.04 / Jammy):"
echo "   • Node.js $(node --version) / npm $(npm --version)"
echo "   • Build tools ($(gcc -dumpversion 2>/dev/null | sed 's/^/gcc /'), cmake, meson, ninja)"
echo "   • DSP libs (FFTW3, libopus, libliquid)"
echo "   • Network libs (libwebsocketpp, libcurl)"
echo "   • Compression libs (zlib, zstd, FLAC)"
echo "   • Boost libraries"
[[ ${install_opencl:-n} =~ ^[Yy]$ ]] && echo "   • OpenCL (${opencl_provider:-unknown})"

echo ""
green "✅ Backend:"
echo "   • Compiled: $PHANTOM_DIR/build/"

echo ""
case $option in
    1)  green "✅ SDR hardware: RX888 MkII / RX888"
        echo "   • Rust toolchain: $(rustc --version 2>/dev/null || echo 'see ~/.cargo/bin')"
        echo "   • rx888_stream: installed to ~/.cargo/bin/"
        yellow "   ⚠️  Open a new terminal (or 'source ~/.cargo/env') before using rx888_stream"
        ;;
    2)  green "✅ SDR hardware: RTL-SDR"
        [[ $rtlsdr_v4 =~ ^[Yy]$ ]] \
            && echo "   • RTL-SDR Blog V4 drivers + udev rules installed" \
            || echo "   • Standard RTL-SDR drivers installed"
        ;;
    3)  green "✅ SDR hardware: SDRPlay (libmirisdr-5)" ;;
    4)  yellow "⚠️  SDR hardware: skipped — install driver manually" ;;
esac

echo ""
green "✅ Frontend:"
echo "   • Vite 5.4.16 / Svelte 4 / @swc/core pinned to 1.15.33"
echo "   • emoji-picker-element"
echo "   • Site information: $SITE_INFO_PATH"
if [ -d "$PHANTOM_DIR/frontend/dist" ]; then
    echo "   • Built: $PHANTOM_DIR/frontend/dist/"
else
    # Worth calling out loudly: a missing dist/ is the failure mode that made
    # this variant necessary, and the backend having built fine hides it.
    yellow "   ⚠️  frontend/dist/ is MISSING — the page will not load."
    yellow "       Rebuild it:  cd $PHANTOM_DIR/frontend && ./build-all.sh"
fi

if [ "$ADMIN_INSTALLED" = true ]; then
    echo ""
    green "✅ Admin panel:"
    echo "   • Configured — password is 'admin', change it on first login"
    echo "   • Manual: docs/ADMIN_PANEL_SETUP.md"
fi

if [ "$RADE_INSTALLED" = true ]; then
    echo ""
    green "✅ RADE / FreeDV:"
    echo "   • radae built in ~/radae, sidecar started with ./rade.sh"
    echo "   • Forward TCP port 8074 for remote RADE decoding"
fi

if [ "$STATS_INSTALLED" = true ]; then
    echo ""
    green "✅ Statistics server:"
    echo "   • Installed — see the directory and port it printed above"
fi

if [ "$RX888_UDEV_DONE" = true ]; then
    echo ""
    green "✅ RX888 udev rules:"
    echo "   • rx888_stream runs without sudo (log out and back in once)"
fi

if [ "$WSPP_PATCHED" = true ]; then
    echo ""
    green "✅ websocketpp headers patched and compiled in"
fi

# ------------------------------------------------------------------------------
# Next steps
# ------------------------------------------------------------------------------

banner "Next Steps"

echo ""
echo "🔧 1. Configure your receiver — edit the appropriate .toml:"
case $option in
    1) echo "      nano $PHANTOM_DIR/rx888.toml" ;;
    2) echo "      nano $PHANTOM_DIR/rtlsdr.toml" ;;
    3) echo "      nano $PHANTOM_DIR/sdrplay.toml" ;;
    4) echo "      nano $PHANTOM_DIR/<your_sdr>.toml" ;;
esac

echo ""
echo "🚀 2. Start the server:"
echo "      cd $PHANTOM_DIR"
case $option in
    1) echo "      ./build/spectrumserver rx888.toml" ;;
    2) echo "      ./build/spectrumserver rtlsdr.toml" ;;
    3) echo "      ./build/spectrumserver sdrplay.toml" ;;
    4) echo "      ./build/spectrumserver <your_sdr>.toml" ;;
esac

echo ""
echo "🌐 3. Open in your browser (replace PORT with the port in your .toml):"
if [ -d "$PHANTOM_DIR/frontend/dist" ]; then
    echo "      http://localhost:PORT/                      → Desktop page"
    echo "      http://localhost:PORT/mobile/               → Mobile page"
    echo ""
    echo "      The S-meter and layout variants are switched from the ⚙️ menu"
    echo "      at the top right of the desktop page — no reload, no extra URLs."
else
    echo "      http://localhost:PORT/"
fi

echo ""
if [ "$ADMIN_INSTALLED" = true ]; then
    echo ""
    echo "🛠  4. Open the admin panel (same address, /admin):"
    echo "      http://YOUR_IP:<proxy_port>/admin      password: admin"
    echo "      Start / stop it with:  ./manage_admin.sh start|stop|status"
fi

echo "📚 Docs / issues: https://github.com/sv1btl/PhantomSDR-Plus"

# ------------------------------------------------------------------------------
# Reboot warning
# ------------------------------------------------------------------------------

if [ "$NEEDS_REBOOT" = true ]; then
    echo ""
    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║                                                              ║"
    echo "║          ⚠️  SYSTEM REBOOT REQUIRED  ⚠️                      ║"
    echo "║                                                              ║"
    [[ ${rtlsdr_v4:-n} =~ ^[Yy]$ ]] && \
    echo "║   RTL-SDR V4 udev rules take effect after reboot.            ║"
    [[ ${install_opencl:-n} =~ ^[Yy]$ ]] && \
    echo "║   OpenCL drivers take effect after reboot.                   ║"
    echo "║                                                              ║"
    echo "║   Run:  sudo reboot                                          ║"
    echo "║                                                              ║"
    echo "╚══════════════════════════════════════════════════════════════╝"
    echo ""
fi

# ------------------------------------------------------------------------------
# Done
# ------------------------------------------------------------------------------

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║                                                              ║"
echo "║           🎉  INSTALLATION COMPLETE  🎉                      ║"
echo "║                PhantomSDR-Plus WebSDR                        ║"
echo "║                                                              ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""