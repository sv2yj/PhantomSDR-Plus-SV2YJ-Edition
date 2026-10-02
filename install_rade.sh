#!/usr/bin/env bash
# =============================================================================
# install_rade.sh — RADE / FreeDV sidecar installer for PhantomSDR-Plus
# SV1BTL — https://github.com/sv1btl/PhantomSDR-Plus
# =============================================================================
set -euo pipefail


# Running as root: sudo is unnecessary, and minimal images (containers, some
# VPS base images) do not ship it at all — every "sudo apt-get" below then dies
# with "sudo: command not found" halfway through the install. Make it a
# transparent no-op in that one case. A non-root user without sudo still gets
# the original error, which is the right thing to tell them.
if [ "$(id -u)" -eq 0 ] && ! command -v sudo >/dev/null 2>&1; then
    sudo() { "$@"; }
fi

RADAE_DIR="$HOME/radae"
# The distro installers export PHANTOM_DIR for trees that are not in $HOME.
PHANTOM_DIR="${PHANTOM_DIR:-$HOME/PhantomSDR-Plus}"
MODEL_CHECKPOINT="model19_check3/checkpoints/checkpoint_epoch_100.pth"
REQUIRED_NODE_MAJOR=22

# ── colours ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

info()    { echo -e "${CYAN}[INFO]${NC}  $*"; }
ok()      { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*"; }
section() { echo -e "\n${BOLD}══════════════════════════════════════════${NC}"; \
            echo -e "${BOLD}  $*${NC}"; \
            echo -e "${BOLD}══════════════════════════════════════════${NC}"; }

# =============================================================================
# PACKAGE MANAGER ABSTRACTION
# =============================================================================
# RADE itself is distro-agnostic — only the package names differ. Everything
# below goes through pkg_refresh / pkg_install so this script works on
# Debian/Ubuntu (apt), Arch (pacman), Fedora (dnf) and openSUSE (zypper).
# Where a distro does not ship one of the Python modules, the install falls
# back to pip for that one module instead of failing the whole run.

PKG_MGR="unknown"
if   command -v apt-get >/dev/null 2>&1; then PKG_MGR="apt"
elif command -v pacman  >/dev/null 2>&1; then PKG_MGR="pacman"
elif command -v dnf     >/dev/null 2>&1; then PKG_MGR="dnf"
elif command -v zypper  >/dev/null 2>&1; then PKG_MGR="zypper"
fi

case "$PKG_MGR" in
    apt)
        PKGS_BUILD=(build-essential autoconf automake libtool
                    cmake git python3 python3-pip alsa-utils procps)
        PKGS_PY=(python3-numpy python3-scipy python3-matplotlib
                 python3-websockets python3-psutil)
        PKG_PIP="python3-pip"
        ;;
    pacman)
        PKGS_BUILD=(base-devel autoconf automake libtool
                    cmake git python python-pip alsa-utils procps-ng)
        PKGS_PY=(python-numpy python-scipy python-matplotlib
                 python-websockets python-psutil)
        PKG_PIP="python-pip"
        ;;
    dnf)
        PKGS_BUILD=(gcc gcc-c++ make autoconf automake libtool
                    cmake git python3 python3-pip alsa-utils procps-ng)
        PKGS_PY=(python3-numpy python3-scipy python3-matplotlib
                 python3-websockets python3-psutil)
        PKG_PIP="python3-pip"
        ;;
    zypper)
        PKGS_BUILD=(gcc gcc-c++ make autoconf automake libtool
                    cmake git python3 python3-pip alsa-utils procps)
        PKGS_PY=(python3-numpy python3-scipy python3-matplotlib
                 python3-websockets python3-psutil)
        PKG_PIP="python3-pip"
        ;;
    *)
        PKGS_BUILD=()
        PKGS_PY=()
        PKG_PIP=""
        ;;
esac

pkg_refresh() {
    case "$PKG_MGR" in
        apt)    sudo apt-get update -qq ;;
        # -Sy alone can leave Arch in a partial-upgrade state, so sync + upgrade.
        pacman) sudo pacman -Syu --noconfirm ;;
        dnf)    sudo dnf makecache -q || true ;;
        zypper) sudo zypper --non-interactive refresh ;;
        *)      warn "No supported package manager — skipping the metadata refresh" ;;
    esac
}

pkg_install() {
    case "$PKG_MGR" in
        apt)    sudo apt-get install -y "$@" ;;
        pacman) sudo pacman -S --needed --noconfirm "$@" ;;
        dnf)    sudo dnf install -y "$@" ;;
        zypper) sudo zypper --non-interactive install "$@" ;;
        *)      return 1 ;;
    esac
}

# distro package name -> importable module / pip name (python3-foo, python-foo)
pkg_to_pip() { echo "${1#python3-}" | sed 's/^python-//'; }

# =============================================================================
# DISTRIBUTION CHECK — this script or the Ubuntu 22.04 variant?
# =============================================================================
# Ubuntu 22.04 (Jammy) ships python3-websockets 10.1, which is API-incompatible
# with rade_helper.py — it needs >= 11.0. install_rade_ubuntu22.sh is identical
# except that it installs websockets through pip instead of apt. Running the
# wrong one of the two builds fine and then fails at the first RADE decode, so
# it is worth one question here.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
JAMMY_SCRIPT="$SCRIPT_DIR/install_rade_ubuntu22.sh"

OS_ID=""; OS_VER=""
if [[ -r /etc/os-release ]]; then
    OS_ID=$(sed -n 's/^ID=//p'         /etc/os-release | tr -d '"' | head -1)
    OS_VER=$(sed -n 's/^VERSION_ID=//p' /etc/os-release | tr -d '"' | head -1)
fi

if [[ "$OS_ID" == "ubuntu" && "$OS_VER" == 22.04* ]]; then
    section "Ubuntu 22.04 detected"
    echo ""
    echo "  Jammy's apt package python3-websockets is 10.1, too old for"
    echo "  rade_helper.py (needs >= 11.0). The variant installer"
    echo "  install_rade_ubuntu22.sh installs a current one via pip instead."
    echo ""
    if [[ -f "$JAMMY_SCRIPT" ]]; then
        read -rp "Switch to install_rade_ubuntu22.sh now? [Y/n]: " use_jammy
        if [[ ! ${use_jammy:-y} =~ ^[Nn] ]]; then
            info "Handing over to install_rade_ubuntu22.sh …"
            echo ""
            exec bash "$JAMMY_SCRIPT" "$@"
        fi
        warn "Continuing with install_rade.sh — RADE may fail with 'websockets' errors"
    else
        warn "install_rade_ubuntu22.sh not found next to this script"
        warn "Get it from the repository, or install websockets>=11.0 with pip yourself"
    fi
elif [[ "$PKG_MGR" == "unknown" ]]; then
    section "Unsupported package manager"
    echo ""
    echo "  None of apt-get, pacman, dnf or zypper was found, so the system"
    echo "  packages cannot be installed automatically. Install these first:"
    echo ""
    echo "    a C/C++ toolchain, cmake, git, python3, pip, alsa-utils"
    echo "    python modules: numpy scipy matplotlib websockets(>=11) psutil"
    echo ""
    read -rp "Continue anyway (they are already installed)? [y/N]: " go_on
    if [[ ! ${go_on:-n} =~ ^[Yy] ]]; then
        error "Aborted — install the packages above and re-run"
        exit 1
    fi
elif [[ -z "$OS_ID" ]]; then
    # No usable /etc/os-release — ask rather than guess.
    section "Which distribution is this?"
    echo ""
    echo "  Ubuntu 22.04 (Jammy) needs the variant installer, because its apt"
    echo "  python3-websockets (10.1) is too old for rade_helper.py."
    echo ""
    read -rp "Are you on Ubuntu 22.04? [y/N]: " is_jammy
    if [[ ${is_jammy:-n} =~ ^[Yy] ]]; then
        if [[ -f "$JAMMY_SCRIPT" ]]; then
            info "Handing over to install_rade_ubuntu22.sh …"
            echo ""
            exec bash "$JAMMY_SCRIPT" "$@"
        fi
        warn "install_rade_ubuntu22.sh not found next to this script — continuing"
    fi
fi

# =============================================================================
# VERSION CHECK — detect existing install and decide update vs fresh
# =============================================================================
section "Checking existing RADE installation"

NEED_CLONE=true
NEED_BUILD=true

if [[ -d "$RADAE_DIR/.git" ]]; then
    info "Found existing radae repository at $RADAE_DIR"
    cd "$RADAE_DIR"

    LOCAL=$(git rev-parse HEAD 2>/dev/null || echo "unknown")
    git fetch origin --quiet 2>/dev/null || warn "Could not reach GitHub — skipping remote check"
    REMOTE=$(git rev-parse origin/main 2>/dev/null || echo "unknown")

    if [[ "$LOCAL" == "$REMOTE" ]]; then
        ok "radae is already up to date (${LOCAL:0:8})"
        NEED_CLONE=false
        if [[ -f "$RADAE_DIR/build/src/lpcnet_demo" ]]; then
            ok "lpcnet_demo binary already present — skipping rebuild"
            NEED_BUILD=false
        else
            warn "lpcnet_demo missing — will rebuild"
            NEED_CLONE=false
        fi
    else
        warn "Update available: local=${LOCAL:0:8}  remote=${REMOTE:0:8}"
        info "Will pull latest code and rebuild"
        NEED_CLONE=false
    fi
else
    info "No existing radae installation found — performing fresh install"
fi

# =============================================================================
# VERSION CHECK — PhantomSDR-Plus RADE integration files
# =============================================================================
section "Checking PhantomSDR-Plus RADE integration files"

PHANTOM_RADE_FILES=(
    "rade_helper.py"
    "rade.sh"
)
PHANTOM_FRONTEND_FILES=(
    "frontend/src/audio.js"
    "frontend/src/App.svelte"
    "frontend/src/lib/SMeterAnalog.svelte"
    "frontend/src/lib/SMeterDigital.svelte"
)

PHANTOM_FILES_UPDATED=false
PHANTOM_FRONTEND_UPDATED=false

if [[ -d "$PHANTOM_DIR/.git" ]]; then
    info "Found PhantomSDR-Plus git repository at $PHANTOM_DIR"
    cd "$PHANTOM_DIR"

    PHANTOM_LOCAL=$(git rev-parse HEAD 2>/dev/null || echo "unknown")
    git fetch origin --quiet 2>/dev/null || warn "Could not reach GitHub — skipping PhantomSDR-Plus remote check"
    PHANTOM_REMOTE=$(git rev-parse origin/main 2>/dev/null \
                    || git rev-parse origin/master 2>/dev/null \
                    || echo "unknown")

    if [[ "$PHANTOM_LOCAL" == "$PHANTOM_REMOTE" || "$PHANTOM_REMOTE" == "unknown" ]]; then
        ok "PhantomSDR-Plus is already up to date (${PHANTOM_LOCAL:0:8})"
    else
        warn "PhantomSDR-Plus update available: local=${PHANTOM_LOCAL:0:8}  remote=${PHANTOM_REMOTE:0:8}"
        info "Pulling latest PhantomSDR-Plus changes…"
        if ! git pull --ff-only --quiet 2>/dev/null; then
            warn "Cannot fast-forward PhantomSDR-Plus — local and remote have diverged."
            warn "Run manually:  cd $PHANTOM_DIR && git pull --rebase"
            warn "Continuing with current local files…"
            PHANTOM_FILES_UPDATED=false
            PHANTOM_FRONTEND_UPDATED=false
        fi

        # Check if any RADE root files changed in this pull
        for f in "${PHANTOM_RADE_FILES[@]}"; do
            if git diff HEAD@{1} HEAD --name-only 2>/dev/null | grep -q "^${f}$"; then
                ok "  Updated: $f"
                PHANTOM_FILES_UPDATED=true
            fi
        done

        # Check if any frontend RADE files changed
        for f in "${PHANTOM_FRONTEND_FILES[@]}"; do
            if git diff HEAD@{1} HEAD --name-only 2>/dev/null | grep -q "^${f}$"; then
                ok "  Updated: $f"
                PHANTOM_FRONTEND_UPDATED=true
            fi
        done

        if $PHANTOM_FILES_UPDATED; then
            info "RADE sidecar files updated — will restart rade.sh after install"
        fi
        if $PHANTOM_FRONTEND_UPDATED; then
            info "Frontend RADE files updated — will rebuild frontend"
        fi
        if ! $PHANTOM_FILES_UPDATED && ! $PHANTOM_FRONTEND_UPDATED; then
            ok "No RADE-specific files changed in this PhantomSDR-Plus update"
        fi
    fi
else
    warn "PhantomSDR-Plus directory ($PHANTOM_DIR) is not a git repository"
    warn "Cannot check for RADE integration file updates automatically"
    info "To update manually, copy the latest rade_helper.py and rade.sh from:"
    info "  https://github.com/sv1btl/PhantomSDR-Plus"
fi

# =============================================================================
# STEP 1 — System packages
# =============================================================================
section "Step 1 — System requirements"

info "Refreshing package metadata (${PKG_MGR})…"
pkg_refresh

if (( ${#PKGS_BUILD[@]} )); then
    info "Installing build tools and system dependencies (${PKG_MGR})…"
    pkg_install "${PKGS_BUILD[@]}" \
        || { error "Could not install: ${PKGS_BUILD[*]}"; exit 1; }
    ok "System packages installed"
else
    warn "No package manager — assuming the build tools are already present"
fi

# ── Node.js version check ─────────────────────────────────────────────────
# Installed via nvm, not deb.nodesource.com: that host now answers 403 on every
# repo path, so the old `setup_20.x` bootstrap can no longer work. Matches the
# approach already used by install_fedora.sh.
NVM_VERSION="v0.40.4"

install_node_via_nvm() {
    info "Installing Node ${REQUIRED_NODE_MAJOR} via nvm ${NVM_VERSION}…"
    if [ ! -s "$HOME/.nvm/nvm.sh" ]; then
        # NOTE: no `set -e` protection on the left of a pipe — check explicitly.
        curl -o- "https://raw.githubusercontent.com/nvm-sh/nvm/${NVM_VERSION}/install.sh" \
            | bash || { error "nvm installation script failed"; exit 1; }
    fi
    export NVM_DIR="$HOME/.nvm"
    # shellcheck source=/dev/null
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
    nvm install "${REQUIRED_NODE_MAJOR}"
    nvm use "${REQUIRED_NODE_MAJOR}"
    nvm alias default "${REQUIRED_NODE_MAJOR}"
}

info "Checking Node.js version…"

# pick up an existing nvm install so `node` is visible in a non-login shell
export NVM_DIR="$HOME/.nvm"
# shellcheck source=/dev/null
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

if command -v node &>/dev/null; then
    NODE_MAJOR=$(node --version | sed 's/v//' | cut -d. -f1)
    if (( NODE_MAJOR >= REQUIRED_NODE_MAJOR )); then
        ok "Node.js $(node --version) satisfies requirement (>= ${REQUIRED_NODE_MAJOR})"
    else
        warn "Node.js ${NODE_MAJOR} is too old — upgrading via nvm"
        install_node_via_nvm
        ok "Node.js upgraded to $(node --version)"
    fi
else
    warn "Node.js not found — installing via nvm"
    install_node_via_nvm
    ok "Node.js $(node --version) installed"
fi

command -v node &>/dev/null && command -v npm &>/dev/null \
    || { error "Node.js / npm missing — install Node ${REQUIRED_NODE_MAJOR}+ manually and retry"; exit 1; }

# =============================================================================
# STEP 2 — Python packages
# =============================================================================
section "Step 2 — Python packages"

# numpy, scipy, matplotlib, websockets and psutil come from the distro where
# possible (psutil is used by rade_loadtest.py, the concurrency benchmark).
# Anything a distro does not carry is collected and installed with pip below,
# so one missing package cannot fail the whole run.
PY_VIA_PIP=()

if (( ${#PKGS_PY[@]} )); then
    info "Installing Python packages (${PKG_MGR}): ${PKGS_PY[*]}"
    for py_pkg in "${PKGS_PY[@]}"; do
        if ! pkg_install "$py_pkg"; then
            warn "$py_pkg is not available from ${PKG_MGR} — will use pip"
            PY_VIA_PIP+=("$(pkg_to_pip "$py_pkg")")
        fi
    done
else
    warn "No package manager — every Python module will be installed with pip"
    PY_VIA_PIP=(numpy scipy matplotlib websockets psutil)
fi

# pip is needed for torch, and for anything the distro did not provide.
# Do NOT guess support from version number alone; detect the actual flag.
PIP_VER=$(pip3 --version 2>/dev/null | awk '{print $2}' || echo "unknown")
PIP_FLAGS=""

if pip3 install --help 2>/dev/null | grep -q -- '--break-system-packages'; then
    info "pip ${PIP_VER} supports --break-system-packages"
    PIP_FLAGS="--break-system-packages"
else
    warn "pip ${PIP_VER} does NOT support --break-system-packages — installing without it"
fi

# Install whatever the distro could not provide.
if (( ${#PY_VIA_PIP[@]} )); then
    info "Installing via pip: ${PY_VIA_PIP[*]}"
    # shellcheck disable=SC2086
    pip3 install $PIP_FLAGS "${PY_VIA_PIP[@]}" \
        || { error "pip could not install: ${PY_VIA_PIP[*]}"; exit 1; }
fi

# rade_helper.py needs the websockets 11+ API. Ubuntu 22.04 is handled by the
# variant installer, but an old distro package can turn up anywhere, so check
# the version that actually got installed rather than trusting the distro.
WS_MAJOR=$(python3 -c 'import websockets,sys; print(websockets.__version__.split(".")[0])' 2>/dev/null || echo 0)
if (( WS_MAJOR < 11 )); then
    warn "websockets ${WS_MAJOR}.x is too old for rade_helper.py (needs >= 11) — upgrading with pip"
    # shellcheck disable=SC2086
    pip3 install $PIP_FLAGS -U websockets \
        || { error "Could not upgrade websockets — RADE will fail at the first decode"; exit 1; }
    ok "websockets upgraded to $(python3 -c 'import websockets; print(websockets.__version__)' 2>/dev/null || echo unknown)"
fi

# Check if torch is already installed before downloading
if python3 -c "import torch" 2>/dev/null; then
    TORCH_VER=$(python3 -c "import torch; print(torch.__version__)")
    ok "torch ${TORCH_VER} already installed — skipping download"
else
    info "Installing torch CPU wheel (this may take a few minutes)…"
    if [[ -n "$PIP_FLAGS" ]]; then
        pip3 install $PIP_FLAGS torch --index-url https://download.pytorch.org/whl/cpu
    else
        pip3 install torch --index-url https://download.pytorch.org/whl/cpu
    fi
fi

info "Verifying Python imports…"
if python3 -c "import websockets, matplotlib, torch, numpy, scipy; print('All OK')"; then
    ok "All Python packages verified"
else
    error "One or more Python packages failed to import — check output above"
    exit 1
fi


# =============================================================================
# STEP 3 — Clone / update the radae repository
# =============================================================================
section "Step 3 — radae repository"

if $NEED_CLONE; then
    info "Cloning radae from GitHub…"
    git clone https://github.com/drowe67/radae.git "$RADAE_DIR"
    ok "Clone complete"
elif $NEED_BUILD; then
    # Repo exists and needs a rebuild — pull in case there are new commits
    info "Pulling latest changes…"
    cd "$RADAE_DIR"
    if ! git pull --ff-only --quiet 2>/dev/null; then
        warn "Cannot fast-forward radae — local and remote have diverged."
        warn "Run manually:  cd $RADAE_DIR && git pull --rebase"
        warn "Continuing with current local files…"
        NEED_BUILD=false
    else
        ok "Repository up to date"
    fi
else
    # Already up to date and binary present — nothing to pull
    ok "radae repository is current — skipping pull"
fi

# ── Build ─────────────────────────────────────────────────────────────────
if $NEED_BUILD; then
    info "Building radae (lpcnet_demo and friends)…"
    cd "$RADAE_DIR"
    mkdir -p build && cd build
    cmake .. -DCMAKE_BUILD_TYPE=Release
    make -j"$(nproc)"

    if [[ -f "$RADAE_DIR/build/src/lpcnet_demo" ]]; then
        ok "lpcnet_demo built successfully"
        ls -lh "$RADAE_DIR/build/src/lpcnet_demo"
    else
        error "Build completed but lpcnet_demo not found — check cmake/make output above"
        exit 1
    fi
fi

# ── Model weights check ───────────────────────────────────────────────────
info "Checking for model19_check3 weights…"
if [[ -f "$RADAE_DIR/$MODEL_CHECKPOINT" ]]; then
    ok "Model weights present: $MODEL_CHECKPOINT"
else
    warn "Model weights NOT found at $RADAE_DIR/$MODEL_CHECKPOINT"
    warn "You may need to download them separately — see the radae README."
fi

# =============================================================================
# STEP 4 — Python dependencies (second confirmation, idempotent)
# =============================================================================
section "Step 4 — Python dependencies (already installed in Step 2)"
ok "Nothing more to do"

# =============================================================================
# STEP 5 — Build the PhantomSDR-Plus frontend
# =============================================================================
section "Step 5 — Build PhantomSDR-Plus frontend"

# The distro installers set PHANTOM_SKIP_RECOMPILE=1: they run one full
# recompile.sh themselves as their very last step, so a rebuild here would only
# duplicate it (and ask the variant questions twice).
if [[ "${PHANTOM_SKIP_RECOMPILE:-0}" == "1" ]]; then
    info "PHANTOM_SKIP_RECOMPILE=1 — leaving the rebuild to the caller"
elif [[ -d "$PHANTOM_DIR" ]]; then
    # Rebuild if: fresh install, or frontend RADE files were updated
    if $PHANTOM_FRONTEND_UPDATED; then
        info "Frontend RADE files changed — rebuilding…"
        if [[ -x "$PHANTOM_DIR/recompile.sh" ]]; then
            cd "$PHANTOM_DIR"
            ./recompile.sh
            ok "Frontend rebuilt"
        elif [[ -d "$PHANTOM_DIR/frontend" ]]; then
            cd "$PHANTOM_DIR/frontend"
            npm install --silent
            npm run build
            ok "Frontend rebuilt via npm"
        else
            warn "Cannot find recompile.sh or frontend/ — skipping rebuild"
        fi
    elif [[ -x "$PHANTOM_DIR/recompile.sh" ]]; then
        if ! $NEED_BUILD && ! $PHANTOM_FILES_UPDATED; then
            ok "Frontend already up to date — skipping rebuild"
        else
            info "Running recompile.sh…"
            cd "$PHANTOM_DIR"
            ./recompile.sh
            ok "Frontend rebuilt"
        fi
    else
        warn "recompile.sh not found or not executable in $PHANTOM_DIR — skipping"
    fi
else
    warn "$PHANTOM_DIR not found — skipping frontend build"
    warn "Make sure PhantomSDR-Plus is installed before running this script"
fi

# =============================================================================
# STEP 6 — Make rade.sh executable and start/restart
# =============================================================================
section "Step 6 — rade.sh setup"

if [[ -f "$PHANTOM_DIR/rade.sh" ]]; then
    chmod +x "$PHANTOM_DIR/rade.sh"
    ok "rade.sh is now executable"
    cd "$PHANTOM_DIR"

    # Determine whether to start fresh or restart
    if pgrep -f "rade_helper.py" > /dev/null 2>&1; then
        if $PHANTOM_FILES_UPDATED || $NEED_BUILD; then
            info "RADE sidecar running — restarting to pick up new files…"
            ./rade.sh restart
            ok "RADE sidecar restarted"
        else
            ok "RADE sidecar already running and up to date — no restart needed"
        fi
    else
        info "Starting RADE sidecar…"
        ./rade.sh start
        ok "RADE sidecar started"
    fi
else
    warn "rade.sh not found at $PHANTOM_DIR/rade.sh — skipping start"
    warn "Copy rade.sh from your PhantomSDR-Plus repository first"
fi

# =============================================================================
# ADMIN PANEL (optional)
# =============================================================================
# Offered here because this script is often the first thing a sysop runs after
# the main installer. It stays quiet when the panel is already set up — this
# script doubles as the RADE updater, and an update must not nag.

ADMIN_INSTALLED=false

if [[ "${PHANTOM_SKIP_ADMIN_OFFER:-0}" == "1" ]]; then
    info "Admin panel handled by the main installer — not asking again"
elif [[ -f "$PHANTOM_DIR/admin_config.json" ]]; then
    info "Admin panel already configured — leaving it alone"
elif [[ -f "$PHANTOM_DIR/setup_admin.sh" ]]; then
    section "Admin Panel (optional)"
    echo ""
    echo "A web dashboard for this receiver: server status, CPU/RAM and user"
    echo "graphs, log viewer, config editor, connected users with a kick button,"
    echo "chat moderation, spot reporting — and a CPU over-temperature guard"
    echo "that stops the server before the heat can do damage."
    echo ""
    echo "Reached at  http://YOUR_IP:<proxy_port>/admin"
    echo ""
    warn "Setup asks for three port numbers and for the start/stop scripts."
    warn "Nothing here depends on it — you can run ./setup_admin.sh any time."
    echo ""
    read -rp "Install the admin panel now? (y/N): " install_admin

    if [[ ${install_admin:-n} =~ ^[Yy]$ ]]; then
        if ! command -v pip3 >/dev/null 2>&1; then
            info "Installing pip..."
            pkg_install "$PKG_PIP" \
                || warn "Could not install pip — setup will tell you what to run"
        fi
        chmod +x "$PHANTOM_DIR/setup_admin.sh" "$PHANTOM_DIR/manage_admin.sh" 2>/dev/null || true
        echo ""
        if ( cd "$PHANTOM_DIR" && ./setup_admin.sh ); then
            ADMIN_INSTALLED=true
        else
            warn "Admin panel setup did not finish — run ./setup_admin.sh again later"
        fi
    else
        info "Skipping the admin panel — run ./setup_admin.sh later if you change your mind"
    fi
fi

# =============================================================================
# REPORT
# =============================================================================
section "Installation Report"

echo ""
echo -e "  ${GREEN}✔${NC}  System packages       installed / verified"
echo -e "  ${GREEN}✔${NC}  Node.js               $(node --version 2>/dev/null || echo 'n/a')"
echo -e "  ${GREEN}✔${NC}  Python packages       websockets matplotlib torch numpy scipy"
echo -e "  ${GREEN}✔${NC}  radae repository      $RADAE_DIR"

if [[ -f "$RADAE_DIR/build/src/lpcnet_demo" ]]; then
echo -e "  ${GREEN}✔${NC}  lpcnet_demo           $(ls -lh "$RADAE_DIR/build/src/lpcnet_demo" | awk '{print $5, $9}')"
else
echo -e "  ${RED}✘${NC}  lpcnet_demo           NOT FOUND"
fi

if [[ -f "$RADAE_DIR/$MODEL_CHECKPOINT" ]]; then
echo -e "  ${GREEN}✔${NC}  Model weights         model19_check3  ✓"
else
echo -e "  ${YELLOW}!${NC}  Model weights         NOT FOUND — download manually"
fi

if [[ "$ADMIN_INSTALLED" == true ]]; then
echo -e "  ${GREEN}✔${NC}  Admin panel           configured — password 'admin', change it on first login"
fi

# PhantomSDR-Plus RADE integration status
if [[ -d "$PHANTOM_DIR/.git" ]]; then
    PHANTOM_COMMIT=$(cd "$PHANTOM_DIR" && git rev-parse --short HEAD 2>/dev/null || echo "unknown")
echo -e "  ${GREEN}✔${NC}  PhantomSDR-Plus       $PHANTOM_DIR  (${PHANTOM_COMMIT})"
else
echo -e "  ${YELLOW}!${NC}  PhantomSDR-Plus       not a git repo — manual updates only"
fi

if [[ -f "$PHANTOM_DIR/rade_helper.py" ]]; then
echo -e "  ${GREEN}✔${NC}  rade_helper.py        present"
else
echo -e "  ${RED}✘${NC}  rade_helper.py        NOT FOUND in $PHANTOM_DIR"
fi

if [[ -f "$PHANTOM_DIR/rade.sh" ]]; then
echo -e "  ${GREEN}✔${NC}  rade.sh               present and executable"
else
echo -e "  ${RED}✘${NC}  rade.sh               NOT FOUND in $PHANTOM_DIR"
fi
echo ""

# =============================================================================
# ROUTER / FIREWALL REMINDER
# =============================================================================
echo -e "${YELLOW}┌─────────────────────────────────────────────────────────────┐${NC}"
echo -e "${YELLOW}│  ⚠  ROUTER PORT FORWARD REQUIRED                            │${NC}"
echo -e "${YELLOW}│                                                             │${NC}"
echo -e "${YELLOW}│  Forward TCP port  8074  to this machine's LAN IP.          │${NC}"
echo -e "${YELLOW}│  RADE WebSocket clients connect on port 8074.               │${NC}"
echo -e "${YELLOW}│  Without this, remote RADE decoding will NOT work.          │${NC}"
echo -e "${YELLOW}└─────────────────────────────────────────────────────────────┘${NC}"
echo ""

# =============================================================================
# TROUBLESHOOTING QUICK REFERENCE
# =============================================================================
cat <<'EOF'
──────────────────────────────────────────────────────────────────────────────
 TROUBLESHOOTING QUICK REFERENCE
──────────────────────────────────────────────────────────────────────────────

▸ radae_rxe.py: error: unrecognized arguments: model_path
    Use --model_name, NOT a positional argument:
      WRONG:   python3 radae_rxe.py model19_check3/checkpoints/checkpoint_epoch_100.pth
      CORRECT: python3 radae_rxe.py --model_name model19_check3/checkpoints/checkpoint_epoch_100.pth

▸ ModuleNotFoundError: No module named 'matplotlib'
      pip3 install matplotlib

▸ ModuleNotFoundError: No module named 'torch'
      pip3 install torch

▸ lpcnet_demo: No such file or directory
      cd ~/radae/build && cmake .. && make -j$(nproc)
      ls src/lpcnet_demo   # should exist now

──────────────────────────────────────────────────────────────────────────────
 UPDATING RADE v1
──────────────────────────────────────────────────────────────────────────────

Standard update (new code, same model):
  cd ~/radae && git pull
  cd build && cmake .. && make -j$(nproc)
  cd ~/PhantomSDR-Plus && ./rade.sh restart

New model weights only (e.g. model20):
  RADE_MODEL=~/radae/model20/checkpoints/checkpoint_epoch_100.pth ./rade.sh start
  # or permanently:  export RADE_MODEL=... in ~/.bashrc

Verify the update:
  ./rade.sh status
  tail -20 ~/PhantomSDR-Plus/rade.log

──────────────────────────────────────────────────────────────────────────────
 UPDATE CHEAT-SHEET
──────────────────────────────────────────────────────────────────────────────
 What changed            │ Action
 ───────────────────────────────────────────────────────────────────────────
 New model .pth          │ Set RADE_MODEL env var, ./rade.sh restart
 radae_rxe.py changed    │ git pull, ./rade.sh restart
 lpcnet_demo C changed   │ git pull, rebuild, ./rade.sh restart
 radae_rxe.py renamed    │ Update RADAE_RX in rade_helper.py
 --model_name renamed    │ Update radae_cmd in rade_helper.py
 New output sample rate  │ Update SPS_OUT in rade_helper.py + audio.js
 RADE v2 new binary      │ Update RADAE_RX in rade_helper.py
──────────────────────────────────────────────────────────────────────────────
EOF

echo ""
ok "install_rade.sh finished — 73 de SV1BTL"