#!/bin/bash
# ==============================================================================
# PhantomSDR-Plus — INSTALLER DEMO / DRY RUN
# SV1BTL — https://github.com/sv1btl/PhantomSDR-Plus
#
# Emulates a complete run of install.sh so the look and the flow can be seen
# without installing anything. All three of the things it shows are now live in
# install.sh, install_arch.sh, install_fedora.sh and install_opensuse.sh:
#
#   1. the new pre-flight step that finds and stops running PhantomSDR-Plus
#      services (admin panel, reverse proxy, stats server, the receiver)
#   2. every yes/no question with the default spelled out as a capital Y or N
#   3. the graphical frame that separates one step from the next
#
# IT CHANGES NOTHING. No package is installed, no service is stopped, no file
# is written, nothing is compiled. Every command it would run is printed with a
# "would run" marker instead of being executed. The only thing it really does
# is READ systemd and the process list, so the service table shows your machine.
#
# Usage:
#     ./demo_installer.sh              walk through it, answering the questions
#     ./demo_installer.sh --fast       same, but without the typing/progress delays
#     ./demo_installer.sh --auto       answer every question with its default, no input
# ==============================================================================
set -uo pipefail

FAST=0
AUTO=0
for a in "$@"; do
    case "$a" in
        --fast) FAST=1 ;;
        --auto) AUTO=1; FAST=1 ;;
        -h|--help) sed -n '2,26p' "$0" | sed 's/^# \?//'; exit 0 ;;
        *) echo "unknown option: $a  (try --help)"; exit 1 ;;
    esac
done

# In the demo, "sleeping" is how the pace of the real thing is suggested.
nap() { [ "$FAST" = 1 ] && return 0; sleep "$1"; }

# ------------------------------------------------------------------------------
# Frames
# ------------------------------------------------------------------------------
W=72                                   # inner width of every frame

red()    { echo -e "\033[31m$*\033[0m"; }
green()  { echo -e "\033[32m$*\033[0m"; }
yellow() { echo -e "\033[33m$*\033[0m"; }
blue()   { echo -e "\033[34m$*\033[0m"; }
grey()   { echo -e "\033[90m$*\033[0m"; }

repeat() { local i out=""; for ((i=0;i<$2;i++)); do out+="$1"; done; printf '%s' "$out"; }

# One framed line, truncated or padded to W visible columns.
fline() {
    local text="${1:-}"
    (( ${#text} > W )) && text="${text:0:$((W-1))}…"
    printf '\033[34m║\033[0m%s%s\033[34m║\033[0m\n' "$text" "$(repeat ' ' $(( W - ${#text} )))"
}
ftop() { printf '\033[34m╔%s╗\033[0m\n' "$(repeat '═' $W)"; }
fmid() { printf '\033[34m╟%s╢\033[0m\n' "$(repeat '─' $W)"; }
fbot() { printf '\033[34m╚%s╝\033[0m\n' "$(repeat '═' $W)"; }

# ------------------------------------------------------------------------------
# Steps
# ------------------------------------------------------------------------------
STEP_NO=0
STEP_TOTAL=18
STEP_T0=0
declare -a STEP_NAME=() STEP_STATE=() STEP_NOTE=()
declare -a WARNINGS=()

step() {
    STEP_NO=$((STEP_NO + 1)); STEP_T0=$SECONDS
    STEP_NAME[$STEP_NO]="$1"; STEP_STATE[$STEP_NO]="OK"; STEP_NOTE[$STEP_NO]=""
    local pct filled bar
    pct=$(( (STEP_NO - 1) * 100 / STEP_TOTAL ))
    filled=$(( pct * 40 / 100 ))
    bar="$(repeat '█' $filled)$(repeat '░' $((40 - filled)))"
    echo ""
    ftop
    fline "$(printf '  STEP %2d/%d  ▸  %s' "$STEP_NO" "$STEP_TOTAL" "$1")"
    [ -n "${2:-}" ] && fline "                 $2"
    fmid
    fline "  [${bar}] ${pct}%"
    fbot
}

# step_done <OK|SKIPPED|PARTIAL|FAILED> [note]
step_done() {
    local st="$1" note="${2:-}" icon col
    STEP_STATE[$STEP_NO]="$st"; STEP_NOTE[$STEP_NO]="$note"
    case "$st" in
        OK)      icon="✅"; col="\033[32m" ;;
        SKIPPED) icon="⏭️" ; col="\033[90m" ;;
        PARTIAL) icon="⚠️" ; col="\033[33m" ;;
        FAILED)  icon="❌"; col="\033[31m" ;;
    esac
    printf '  \033[34m└─\033[0m %s %b STEP %d/%d %s\033[0m  \033[90m(%ds)\033[0m\n' \
        "$icon" "$col" "$STEP_NO" "$STEP_TOTAL" "$st" "$((SECONDS - STEP_T0))"
    [ -n "$note" ] && grey "       $note"
}

warn() { yellow "  ⚠️  $*"; WARNINGS+=("step ${STEP_NO}|$*"); }

# ------------------------------------------------------------------------------
# Questions
# ------------------------------------------------------------------------------
prompt_fence() {
    echo ""
    yellow "  ┌──────────────────────────────────────────────────────────────────┐"
    yellow "  │  ⌨️   YOUR INPUT IS NEEDED                                        │"
    yellow "  └──────────────────────────────────────────────────────────────────┘"
}

# confirm <default y|n> <question> — 0 = yes, 1 = no
confirm() {
    local def="$1" q="$2" hint word ans
    if [ "$def" = "y" ]; then hint="\033[1;32mY\033[0m/n"; word="Yes"
                        else hint="y/\033[1;31mN\033[0m"; word="No";  fi
    if [ "$AUTO" = 1 ]; then
        echo ""
        echo "  ❓ $q"
        printf '     → %s  \033[90m(--auto: the default)\033[0m\n' "$word"
        [ "$def" = "y" ]; return
    fi
    prompt_fence
    printf '  ❓ %s [%b]  \033[90m(ENTER = %s)\033[0m: ' "$q" "$hint" "$word"
    read -r ans; echo ""
    ans="${ans:-$def}"
    [[ $ans =~ ^[Yy] ]]
}

# ask_menu <default> <question> → $MENU_ANSWER
MENU_ANSWER=""
ask_menu() {
    local def="$1" q="$2"
    if [ "$AUTO" = 1 ]; then
        MENU_ANSWER="$def"
        echo ""
        printf '  ❓ %s  → \033[1m%s\033[0m  \033[90m(--auto: the default)\033[0m\n' "$q" "$def"
        return
    fi
    prompt_fence
    printf '  ❓ %s \033[90m[default %s]\033[0m: ' "$q" "$def"
    read -r MENU_ANSWER; echo ""
    MENU_ANSWER="${MENU_ANSWER:-$def}"
}

pause() {
    if [ "$AUTO" = 1 ]; then grey "  (--auto — continuing)"; return 0; fi
    prompt_fence
    read -rp "  ⏎  $1"
    echo ""
}

# ------------------------------------------------------------------------------
# Fake work
# ------------------------------------------------------------------------------
# would <command...> — what the real installer would run at this point.
would() { printf '     \033[90m$ %s\033[0m  \033[90m(not run)\033[0m\n' "$*"; nap 0.25; }

# task <label> <seconds> [result]
task() {
    local label="$1" secs="${2:-1}" result="${3:-done}" i
    # Truncate rather than let a long label push the leader dots into it. The
    # dots are the progress indicator; dots that start in a different column on
    # every line stop reading as a column and start reading as damage.
    if (( ${#label} > 45 )); then label="${label:0:44}…"; fi
    printf '     %-46s' "$label"
    for ((i=0;i<secs;i++)); do printf '.'; nap 0.18; done
    printf ' \033[32m%s\033[0m\n' "$result"
}

pkg_list() {
    local p
    for p in "$@"; do
        printf '     %-34s' "$p"
        nap 0.12
        if (( RANDOM % 3 == 0 )); then grey "already newest"; else green "installed"; fi
    done
}

# ==============================================================================
clear
ftop
fline ""
fline "        ██  PhantomSDR-Plus — Installer"
fline "            SV1BTL · github.com/sv1btl/PhantomSDR-Plus"
fline ""
fmid
fline "        DEMO / DRY RUN — nothing is installed, nothing is stopped,"
fline "        nothing is written. Every command is printed, not run."
fline ""
fbot
nap 1.2

# ==============================================================================
step "Running PhantomSDR-Plus services" "what is live right now, before we touch anything"

UNITS=(phantomsdr-admin.service phantomsdr-proxy.service sdr-stats.service)
FOUND=(); FOUNDLBL=()

printf '  %-32s %-14s %s\n' "SERVICE" "STATE" "WHAT IT IS"
printf '  %-32s %-14s %s\n' "$(repeat '─' 32)" "$(repeat '─' 14)" "$(repeat '─' 18)"
for u in "${UNITS[@]}"; do
    case "$u" in
        phantomsdr-admin.service) what="Admin panel" ;;
        phantomsdr-proxy.service) what="Reverse proxy" ;;
        sdr-stats.service)        what="Statistics server" ;;
    esac
    nap 0.25
    if systemctl is-active --quiet "$u" 2>/dev/null; then
        printf '  %-32s \033[32m%-14s\033[0m %s\n' "$u" "running" "$what"
        FOUND+=("$u"); FOUNDLBL+=("$what")
    elif systemctl cat "$u" >/dev/null 2>&1; then
        printf '  %-32s \033[90m%-14s\033[0m %s\n' "$u" "stopped" "$what"
    else
        printf '  %-32s \033[90m%-14s\033[0m %s\n' "$u" "not installed" "$what"
    fi
done

# The receiver is a start-*.sh watchdog, not a unit, so it is found by process.
nap 0.25
if pgrep -f 'start-(rx888mk2|airspyhf|rtl|rsp1a)\.sh' >/dev/null 2>&1 ||
   pgrep -x spectrumserver >/dev/null 2>&1; then
    printf '  %-32s \033[32m%-14s\033[0m %s\n' "spectrumserver + watchdog" "running" "The receiver"
    FOUND+=("__receiver__"); FOUNDLBL+=("The receiver")
else
    printf '  %-32s \033[90m%-14s\033[0m %s\n' "spectrumserver + watchdog" "stopped" "The receiver"
fi
echo ""

if [ ${#FOUND[@]} -eq 0 ]; then
    green "  ✅ No part of PhantomSDR-Plus is running — safe to continue."
    step_done OK "nothing was running"
else
    warn "${#FOUND[@]} PhantomSDR-Plus component(s) are running."
    echo "     Installing over a running receiver overwrites files that are open,"
    echo "     can leave the admin panel half-restarted, and hides build errors"
    echo "     behind a binary that is still in use."
    if confirm y "Stop them now, and start them again when the install finishes?"; then
        for i in "${!FOUND[@]}"; do
            case "${FOUND[$i]}" in
                __receiver__) would "./stop-websdr.sh" ;;
                *)            would "sudo systemctl stop ${FOUND[$i]}" ;;
            esac
            task "  stopping ${FOUNDLBL[$i]}" 2 "stopped"
        done
        echo ""
        green "  ✅ All PhantomSDR-Plus components stopped."
        grey  "     They are started again in step ${STEP_TOTAL}."
        RESTART_AT_END=1
        step_done OK "stopped: ${FOUNDLBL[*]}"
    else
        RESTART_AT_END=0
        echo ""
        red "  ✋ Nothing was stopped. The installer waits for you."
        echo ""
        echo "     In another terminal:"
        echo "       sudo systemctl stop phantomsdr-admin phantomsdr-proxy sdr-stats"
        echo "       cd ~/PhantomSDR-Plus && ./stop-websdr.sh"
        echo ""
        pause "Press ENTER once they are stopped (Ctrl-C to abort) "
        step_done PARTIAL "stopped by hand — they will NOT be restarted for you"
    fi
fi

# ==============================================================================
step "Detecting the system" "reads /etc/os-release and the installed Boost version"
would "cat /etc/os-release"
nap 0.5
printf '     %-26s %s\n' "Distribution ............." "$( . /etc/os-release 2>/dev/null; echo "${PRETTY_NAME:-unknown}")"
printf '     %-26s %s\n' "Architecture ............." "$(uname -m)"
printf '     %-26s %s\n' "Kernel ..................." "$(uname -r)"
printf '     %-26s %s\n' "Boost ...................." "1.83.0"
printf '     %-26s %s\n' "Compiler ................." "g++ 13.3.0  (accepts -std=c++23)"
printf '     %-26s %s\n' "websocketpp patch ........" "recommended (Boost < 1.87)"
step_done OK "Boost 1.83 — the header patch is a warning here, not a hard failure"

# ==============================================================================
step "Prerequisites" "base apt packages — no input needed"
would "sudo apt-get update"
would "sudo apt-get install -y git curl build-essential pkg-config"
pkg_list git curl build-essential pkg-config ca-certificates
step_done OK "5 packages"

# ==============================================================================
step "Node.js and npm" "installs Node 22 via nvm if the system copy is too old"
printf '     %-26s %s\n' "System node .............." "v20.19.0  (/usr/bin/node)"
printf '     %-26s %s\n' "Required ................." "v22 or newer"
warn "The system node is too old to build the frontend."
grey  "     /usr/bin/node is left alone — nvm installs alongside it."
would "curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash"
would "nvm install 22"
task "  downloading Node v22" 4 "ok"
task "  activating v22" 2 "ok"
step_done OK "node v22 via nvm; the system v20 is untouched"

# ==============================================================================
step "Locating the PhantomSDR-Plus source tree" "the directory this installer will build in"
printf '     %-26s %s\n' "Found ...................." "$HOME/PhantomSDR-Plus"
printf '     %-26s %s\n' "Git branch ..............." "main"
printf '     %-26s %s\n' "Last commit .............." "ee57b34  docs: translate the ask_port defaults section"
echo ""
echo "  An existing installation is already there."
echo ""
green "  KEPT — never overwritten:"
grey  "      config-*.toml · frontend/site_information.json · admin_config.json"
grey  "      frequencylist/ · your logs"
yellow "  REPLACED:"
grey  "      build/ · frontend/dist/ · subprojects/ · the systemd unit files"
if confirm y "Overwrite the existing installation?"; then
    green "  ✅ Overwriting — your configuration files are kept."
    step_done OK "in-place upgrade"
else
    yellow "  ⏭️  Nothing will be overwritten; the build steps are skipped."
    step_done SKIPPED "user declined the overwrite"
fi

# ==============================================================================
step "Installing build dependencies" "the rest of the apt packages — no input needed"
would "sudo apt-get install -y meson ninja-build libboost-all-dev libfftw3-dev ..."
pkg_list meson ninja-build libboost-all-dev libfftw3-dev libflac-dev \
         libopus-dev libzstd-dev libwebsocketpp-dev nlohmann-json3-dev
step_done OK "9 packages"

# ==============================================================================
step "Building the PhantomSDR-Plus backend" "meson setup + compile — takes a few minutes"
would "meson setup build --buildtype=release"
task "  fetching subproject glaze" 3 "cloned"
task "  fetching subproject websocketpp" 3 "cloned"
task "  patching websocketpp headers (5 files)" 2 "patched"
would "ninja -C build"
task "  compiling spectrumserver [1/142]" 6 ""
task "  linking build/spectrumserver" 2 "ok"
step_done OK "build/spectrumserver — 4 min 51 s"

# ==============================================================================
step "SDR hardware driver" "⌨️  YOU WILL BE ASKED which receiver to set up"
echo "     1) RX888 / RX888 MkII      (rx888_stream + udev rules)"
echo "     2) RTL-SDR                 (librtlsdr, optionally the Blog V4 driver)"
echo "     3) SDRplay RSP             (libmirisdr-5)"
echo "     4) Skip — my driver is already installed"
ask_menu 1 "Which receiver? [1-4]"
case "$MENU_ANSWER" in
    1)  would "git clone https://github.com/rhgndf/rx888_stream"
        task "  building rx888_stream" 4 "ok"
        would "sudo ./setup-rx888-udev.sh"
        task "  installing udev rules (no sudo afterwards)" 2 "ok"
        step_done OK "RX888 MkII — replug the receiver once" ;;
    2)  would "sudo apt-get install -y librtlsdr-dev rtl-sdr"
        pkg_list librtlsdr-dev rtl-sdr
        if confirm n "Use the RTL-SDR Blog V4 driver instead of the stock one?"; then
            task "  building rtl-sdr-blog" 4 "ok"
            step_done OK "RTL-SDR Blog V4"
        else
            step_done OK "stock librtlsdr"
        fi ;;
    3)  task "  building libmirisdr-5" 4 "ok"
        step_done OK "SDRplay RSP" ;;
    *)  grey "  Skipped — no driver installed."
        step_done SKIPPED "driver already present" ;;
esac

# ==============================================================================
step "Site information" "⌨️  YOU WILL EDIT frontend/site_information.json"
echo "  This is the name, the location and the contact shown on your web page."
echo "  The real installer opens it in your editor; the demo only shows it."
grey  '     { "name": "PhantomSDR-Plus", "grid": "KM17ux", "callsign": "SV1BTL", ... }'
if confirm y "Open it in an editor now?"; then
    would "\${EDITOR:-nano} frontend/site_information.json"
    grey "     (the demo does not open an editor)"
    step_done OK "edited"
else
    step_done SKIPPED "edit it later by hand"
fi

# ==============================================================================
step "Installing frontend dependencies" "npm — several minutes, no input needed"
would "cd frontend && npm ci"
task "  npm ci" 8 "added 612 packages"
warn "3 moderate severity vulnerabilities reported by npm audit"
grey  "     These are build-time only and do not reach the browser."
# A warning does not change the verdict. Only a step that ran without finishing
# its job is PARTIAL — see the next step for what that looks like.
step_done OK "612 packages, 3 audit warnings"

# ==============================================================================
step "Building all frontend versions" "build-all.sh — no input needed"
for v in classic dark metal mobile; do
    task "  vite build — $v" 3 "ok"
done
printf '     %-46s' "  vite build — compact"
for i in 1 2 3; do printf '.'; nap 0.18; done
printf ' \033[31m%s\033[0m\n' "failed"
warn "build-all.sh reported errors for 1 of the 5 variants"
grey  "     The other four are built and usable; rerun ./recompile.sh to retry."
# PARTIAL is the verdict for a step that ran but did not finish its job, while
# the install carried on regardless. It is not the verdict for a step that
# merely printed a warning.
step_done PARTIAL "build-all.sh reported errors"

# ==============================================================================
step "OpenCL support (optional)" "⌨️  YOU WILL BE ASKED whether to install it"
echo "  OpenCL moves the FFT onto the GPU. Detected hardware:"
printf '     %-26s %s\n' "GPU ......................" "Intel UHD Graphics (auto → Intel runtime)"
if confirm y "Install OpenCL?"; then
    echo "     1) Intel   (intel-opencl-icd)"
    echo "     2) Mesa / Rusticl  (AMD, and Intel as a fallback)"
    echo "     3) POCL    (CPU only — always works, no speed-up)"
    ask_menu 1 "Which runtime? [1-3]"
    pkg_list intel-opencl-icd ocl-icd-libopencl1 clinfo
    task "  clinfo — verifying the platform" 2 "1 platform, 1 device"
    step_done OK "Intel OpenCL runtime"
else
    grey "  Skipped — the FFT stays on the CPU."
    step_done SKIPPED "declined"
fi

# ==============================================================================
step "Admin panel (optional)" "⌨️  YOU WILL BE ASKED — setup asks its own questions"
echo "  The web admin panel plus its reverse proxy, both as systemd services."
if confirm y "Install the admin panel?"; then
    would "./setup_admin.sh"
    task "  writing admin_config.json" 2 "ok"
    task "  installing phantomsdr-admin.service" 2 "ok"
    task "  installing phantomsdr-proxy.service" 2 "ok"
    ADMIN=y
    step_done OK "listening on :8080, proxy on :80"
else
    ADMIN=n
    step_done SKIPPED "declined"
fi

# ==============================================================================
step "RADE / FreeDV decoder (optional)" "⌨️  YOU WILL BE ASKED — setup asks its own"
echo "  RADE is the machine-learning FreeDV mode. It needs python3 + torch."
if confirm y "Install RADE?"; then
    would "./install_rade.sh"
    task "  cloning radae" 3 "ok"
    task "  installing python packages (torch, numpy)" 6 "ok"
    task "  building the RADE helper" 4 "ok"
    RADE=y
    step_done OK "~/radae — helper starts with the receiver"
else
    RADE=n
    step_done SKIPPED "declined"
fi

# ==============================================================================
step "System statistics server (optional)" "⌨️  YOU WILL BE ASKED"
echo "  A small Node.js service publishing this machine's CPU, RAM and"
echo "  temperature to the web page."
if confirm y "Install the statistics server?"; then
    would "./install-stats-server.sh"
    echo ""
    yellow "  ⚠️  /opt/sdr-stats already exists."
    if confirm y "Overwrite it?"; then
        task "  replacing /opt/sdr-stats" 3 "ok"
    else
        grey "     Keeping the existing copy — only the service file is refreshed."
    fi
    task "  installing sdr-stats.service" 2 "ok"
    STATS=y
    step_done OK "sdr-stats.service on :8073"
else
    STATS=n
    step_done SKIPPED "declined"
fi

# ==============================================================================
step "Re-patching websocketpp and preparing the marker list" "no input needed"
task "  verifying the 5 patched headers" 2 "all present"
task "  building the frequency marker list" 3 "12 840 markers"
step_done OK

# ==============================================================================
step "Final rebuild" "⌨️  YOU WILL BE ASKED — recompile.sh then asks three questions"
if confirm y "Run the final rebuild now?"; then
    would "./recompile.sh"
    task "  backend" 5 "ok"
    task "  frontend (5 variants)" 5 "ok"
    step_done OK "everything rebuilt from a clean state"
else
    step_done SKIPPED "run ./recompile.sh yourself later"
fi

# ==============================================================================
step "Installation summary" ""

if [ "${RESTART_AT_END:-0}" = "1" ]; then
    echo "  Starting again what was stopped in step 1:"
    would "sudo systemctl start phantomsdr-admin phantomsdr-proxy sdr-stats"
    would "./start-rx888mk2.sh"
    for l in "${FOUNDLBL[@]}"; do task "  starting $l" 2 "running"; done
    echo ""
fi

ok=0; skipped=0; partial=0; failed=0
for ((i=1;i<=STEP_NO;i++)); do
    case "${STEP_STATE[$i]}" in
        OK) ok=$((ok+1)) ;; SKIPPED) skipped=$((skipped+1)) ;;
        PARTIAL) partial=$((partial+1)) ;; FAILED) failed=$((failed+1)) ;;
    esac
done

echo ""
ftop
fline "  ✔  INSTALLATION COMPLETE  (demo — nothing was actually installed)"
fmid
fline "$(printf '     %-24s %s' 'Steps ..................' "$STEP_NO total · $ok OK · $skipped skipped")"
fline "$(printf '     %-24s %s' '........................' "$partial partial · $failed failed")"
fline "$(printf '     %-24s %s' 'Warnings ...............' "${#WARNINGS[@]}")"
fline "$(printf '     %-24s %s' 'Elapsed ................' "$((SECONDS/60)) min $((SECONDS%60)) s")"
fline "$(printf '     %-24s %s' 'Report .................' 'PhantomSDR-Plus/install.txt')"
fmid
fline "     The real installer would now print:"
fline "        Open http://<this-machine>:PORT in a browser"
fline "        Start / stop:  ./start-rx888mk2.sh   ./stop-websdr.sh"
fbot

if [ ${#WARNINGS[@]} -gt 0 ]; then
    echo ""
    yellow "  Warnings raised during the run:"
    for w in "${WARNINGS[@]}"; do
        grey "     ${w%%|*}: ${w#*|}"
    done
fi

echo ""
echo "  Per-step verdicts, as they would appear in install.txt:"
for ((i=1;i<=STEP_NO;i++)); do
    case "${STEP_STATE[$i]}" in
        OK)      c="\033[32m" ;; SKIPPED) c="\033[90m" ;;
        PARTIAL) c="\033[33m" ;; FAILED)  c="\033[31m" ;;
    esac
    n="${STEP_NAME[$i]}"; (( ${#n} > 46 )) && n="${n:0:45}…"
    printf '     %2d. %-46s %b%s\033[0m\n' "$i" "$n" "$c" "${STEP_STATE[$i]}"
done
echo ""
grey "  Demo finished. Nothing on this machine was changed."
echo ""
