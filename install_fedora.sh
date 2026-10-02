#!/bin/bash
set -euo pipefail

# ==============================================================================
# PhantomSDR-Plus Installer — Fedora
# ------------------------------------------------------------------------------
# UNATTENDED USE
# ------------------------------------------------------------------------------
# Every question has an environment-variable override, and this script also
# switches to defaults on its own when stdin is not a terminal (a pipe, a
# container, a CI job). Set PHANTOM_NONINTERACTIVE=1 and the run completes
# without asking anything:
#
#   PHANTOM_NONINTERACTIVE=1   answer every question with its default
#   PHANTOM_STOP_SERVICES=y|n  stop a running admin panel / proxy / stats
#                              server / receiver before installing, and
#                              start them again at the end   (default y)
#   PHANTOM_SDR=1..7           RX888 | RTL-SDR | RSP1A | skip | Fobos | Airspy HF+ | HackRF  (default 4)
#   PHANTOM_RTLSDR_V4=y|n      RTL-SDR Blog V4 driver             (default n)
#   PHANTOM_SITE_EDIT=y|n      open site_information.json in an editor
#   PHANTOM_OPENCL=y|n         install OpenCL                     (default y)
#   PHANTOM_ADMIN=y|n          admin panel      (y interactive, n unattended)
#   PHANTOM_WEBSDR_RELAY=y|n   WebSDR diversity relay (y interactive, n unattended)
#   PHANTOM_RADE=y|n           RADE / FreeDV    (y interactive, n unattended)
#   PHANTOM_STATS=y|n          statistics server(y interactive, n unattended)
#   PHANTOM_KIWI=y|n           Kiwi client emulation  (default y interactive, n unattended)
#   PHANTOM_RECOMPILE=y|n      final rebuild                      (default y)
#   PHANTOM_FIX_CLOCK_SKEW=y|n reset source timestamps that are dated in
#                              the future, so meson can build   (default y)
#   PHANTOM_CURLPP=y|n         continue without curlpp            (default y)
#
# The three sub-installers marked above are interactive scripts of their own,
# so unattended runs skip them by default rather than hang on their prompts.
#
# ------------------------------------------------------------------------------
# THE REPORT
# ------------------------------------------------------------------------------
# Every run writes install.txt into the PhantomSDR-Plus directory: the result,
# each of the 19 steps as OK / SKIPPED / PARTIAL / FAILED, what was detected
# (distribution, Boost, compiler, Node), what was installed, and every warning.
# It is written by an EXIT trap, so a run that dies halfway still leaves a
# report that ends at the step which failed.
# ==============================================================================

# ------------------------------------------------------------------------------
# Helpers
# ------------------------------------------------------------------------------

NEEDS_REBOOT=false
RX888_UDEV_DONE=false
RADE_INSTALLED=false
STATS_INSTALLED=false
KIWI_INSTALLED=false
RELAY_INSTALLED=false
WSPP_PATCHED=false
WSPP_REQUIRED=false

red()    { echo -e "\e[31m$*\e[0m"; }
green()  { echo -e "\e[32m$*\e[0m"; }
yellow() { echo -e "\e[33m$*\e[0m"; }
blue()   { echo -e "\e[34m$*\e[0m"; }

# A section heading that is not a step — same frame, so the run reads as one
# thing rather than as two styles of box that happen to share a script.
banner() {
    echo ""
    ftop
    fline "  $1"
    fbot
}

die() {
    red "❌ Fatal: $*"
    exit 1
}

run() {
    "$@" || die "Command failed: $*"
}

# Same, but captures the output so the report can quote it when the command
# fails. install.txt used to say only "Command failed: meson setup build" —
# true and useless, because the actual error scrolled past in the terminal.
#
# ONLY for external programs. The pipeline runs the command in a subshell, so
# anything that has to change this shell's environment (nvm, or sourcing) must
# use run() above instead. pipefail is on, so the status is the command's own.
FAILED_CMD_LOG=""
run_logged() {
    local log
    log="$(mktemp "${TMPDIR:-/tmp}/phantom-install-XXXXXX.log")"
    if "$@" 2>&1 | tee "$log"; then
        rm -f "$log"
    else
        FAILED_CMD_LOG="$log"
        die "Command failed: $*"
    fi
}

# ------------------------------------------------------------------------------
# Stale subproject directories
# ------------------------------------------------------------------------------
# glaze and websocketpp are wrap-git subprojects: they are not in the repository
# (.gitignore skips them) and meson clones them from GitHub on the first
# `meson setup`. If a clone is interrupted, or the tree is cleaned with
# `git clean -xfd` in a way that leaves the directory behind, subprojects/glaze
# can exist while being empty. Meson then refuses to re-fetch it and stops with
#
#   meson.build:57:16: ERROR: Subproject exists but has no CMakeLists.txt file.
#
# which says nothing about what to do. Remove such a directory so meson clones
# it again on this run.
clean_stale_subprojects() {
    local d name
    for d in subprojects/*/; do
        [ -d "$d" ] || continue          # unexpanded glob when there are none
        name="$(basename "$d")"
        case "$name" in
            packagecache) continue ;;
        esac
        # A subproject is usable if it has something meson can build from.
        if [ -f "$d/CMakeLists.txt" ] || [ -f "$d/meson.build" ]; then
            continue
        fi
        yellow "   Removing incomplete subproject: $d (meson will re-fetch it)"
        rm -rf "$d"
    done
}

# ------------------------------------------------------------------------------
# Clock skew
# ------------------------------------------------------------------------------
# meson and ninja refuse to build when a source file is newer than the system
# clock:
#
#   ERROR: Clock skew detected. File .../meson.build has a time stamp
#   10392.2144s in the future.
#
# because they cannot tell which outputs are out of date. Nothing is wrong with
# the tree: the clock is behind. A Raspberry Pi with no cell in its RTC holder
# starts every boot from the last time it knew, so a build launched before NTP
# catches up sees the whole tree dated in the future; a tree unpacked or rsynced
# from a machine whose clock is ahead looks the same.
#
# Say that here, with both cures, instead of letting meson say it hundreds of
# lines into its output. Correcting the clock is the real fix and is printed
# first; resetting the timestamps is the local one and is offered because it
# always works, even on a machine with no network to reach a time server.
check_clock_skew() {
    local newest now skew mins synced
    # Newest modification time in the source tree. build/ is ours to overwrite
    # and .git/ is large and never compiled, so both are skipped.
    #
    # awk, not `sort -rn | head -1`: head closes the pipe as soon as it has its
    # line, sort dies of SIGPIPE, and under `set -o pipefail` that is a 141 exit
    # status which takes the whole installer with it. Whether it happens is a
    # race between the two sides of the pipe — it passed on three distributions
    # and killed the Arch run at step 7. awk reads its input to the end, so
    # there is no pipe to break.
    newest="$(find . -path ./build -prune -o -path ./.git -prune -o \
                     -type f -printf '%T@\n' 2>/dev/null |
              awk 'BEGIN { m = 0 } $1 > m { m = $1 } END { printf "%d\n", m }')"
    [ -n "$newest" ] || return 0
    now="$(date +%s)"
    skew=$(( newest - now ))
    # A second or two is normal rounding on a network filesystem, not skew.
    [ "$skew" -gt 5 ] || return 0

    mins=$(( (skew + 59) / 60 ))
    warn "Files in $PWD are up to ${mins} minute(s) newer than the system clock."
    echo ""
    echo "   meson and ninja stop with \"Clock skew detected\" when that happens."
    echo ""
    echo "   System time : $(date)"
    if command -v timedatectl >/dev/null 2>&1; then
        synced="$(timedatectl show -p NTPSynchronized --value 2>/dev/null || true)"
        echo "   NTP synced  : ${synced:-unknown}"
    fi
    echo ""
    echo "   If the time above is wrong, that is the real cause. Correct it with"
    echo "      sudo timedatectl set-ntp true"
    echo "   wait a few seconds for it to settle, then run this installer again."
    echo ""

    if confirm PHANTOM_FIX_CLOCK_SKEW y y \
        "Reset those file timestamps to now so the build can go ahead?"; then
        find . -path ./build -prune -o -path ./.git -prune -o \
               -newermt "@${now}" -print0 2>/dev/null | xargs -0r touch
        green "   Timestamps reset to the current time."
    else
        die "The source tree is newer than the system clock, so meson cannot build.
       Correct the clock, or re-run and let the installer reset the timestamps."
    fi
}

# Meson fetches glaze and websocketpp over the network during `meson setup`.
# When the machine cannot reach GitHub, that surfaces as a git clone failing
# three times inside a CMake trace, hundreds of lines deep. Say it up front
# instead, and only when a fetch is actually still needed — a tree that already
# has both subprojects builds fine with no network at all.
# The directory a wrap extracts into: its "directory =" key, or the wrap's own
# name when it does not set one. Reading it means nothing here hardcodes a
# version number, so bumping websocketpp or tomlplusplus needs no edit.
wrap_directory() {
    local wrap="$1" dir
    dir="$(awk -F= '/^[[:space:]]*directory[[:space:]]*=/ {
                        gsub(/^[[:space:]]+|[[:space:]]+$/, "", $2); print $2; exit }' "$wrap")"
    [ -n "$dir" ] || dir="$(basename "$wrap" .wrap)"
    printf '%s\n' "$dir"
}

# The three subprojects the backend cannot be configured without. Each is either
# already in the tree (they are all committed, so normally yes), or fetchable via
# its .wrap, or missing entirely — and those last two need very different advice.
check_subproject_network() {
    local missing=() unfetchable=() name wrap dir
    for name in glaze websocketpp tomlplusplus; do
        wrap="subprojects/${name}.wrap"
        if [ -f "$wrap" ]; then
            dir="subprojects/$(wrap_directory "$wrap")"
            if [ -f "$dir/CMakeLists.txt" ] || [ -f "$dir/meson.build" ]; then
                continue                      # present and usable
            fi
            missing+=("$name")                # absent, but the wrap can fetch it
        else
            # No wrap and no way to know where it would live: if nothing that
            # looks like it is there, nothing can bring it in.
            if compgen -G "subprojects/${name}*/meson.build" > /dev/null \
            || compgen -G "subprojects/${name}*/CMakeLists.txt" > /dev/null; then
                continue
            fi
            unfetchable+=("$name")
        fi
    done

    if [ ${#unfetchable[@]} -ne 0 ]; then
        die "this source tree is incomplete. Missing, with no .wrap to fetch from:
         ${unfetchable[*]}

       Those directories are part of the repository — the backend cannot be
       configured without them. Unpack the current release over this directory,
       or re-clone it, and run this installer again.

       (If you update by unpacking a zip, the zip is missing subprojects/ —
       that is a packaging bug, not something to fix on this machine.)"
    fi

    [ ${#missing[@]} -eq 0 ] && return 0

    if getent hosts github.com >/dev/null 2>&1; then
        return 0
    fi

    die "cannot reach github.com, and these subprojects still need fetching:
         ${missing[*]}

       Meson clones them from GitHub when they are not already in the tree.
       Without name resolution that clone fails and the build cannot start.

       Fix DNS or the proxy on this machine and re-run, or copy the missing
       directories from subprojects/ on a machine that already has them."
}

# The driver step clones from GitHub too, and a machine with no DNS fails there
# exactly the same way meson does — so say it in one line before git spends a
# minute timing out.
require_github() {
    # A proxy that answers 401 for a public repo makes git ask for a username,
    # and on a terminal it sits there waiting forever. Fail instead of hanging.
    export GIT_TERMINAL_PROMPT=0
    getent hosts github.com >/dev/null 2>&1 && return 0
    die "cannot reach github.com — the SDR driver has to be cloned from there.
       Fix DNS or the proxy on this machine and run this installer again."
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

# Reads the installed Boost version and decides whether the patch is mandatory.
# Boost is the number every 26.04 build question is really about, so print it
# before anything is compiled.
BOOST_LABEL="unknown"
detect_boost() {
    local hdr="/usr/include/boost/version.hpp" v
    [ -r "$hdr" ] || return 0
    v=$(awk '/define BOOST_LIB_VERSION/{gsub(/"/,"",$3); print $3}' "$hdr")
    [ -n "$v" ] || return 0
    BOOST_LABEL="${v//_/.}"

    case "$v" in
        1_8[7-9]*|1_9[0-9]*|1_[1-9][0-9][0-9]*|[2-9]_*)
            WSPP_REQUIRED=true ;;
    esac
}

report_boost_version() {
    [ "$BOOST_LABEL" = "unknown" ] && return 0
    echo "   Boost: ${BOOST_LABEL}"
    if [ "$WSPP_REQUIRED" = true ]; then
        yellow "   → io_service / expires_from_now are gone in this Boost."
        yellow "     The bundled websocketpp patch is what makes the build work,"
        yellow "     so this installer treats it as mandatory, not optional."
    fi
    echo ""
}

# The five files must exist in the source tree before the build starts. A zip
# snapshot taken before commit ec0123b ("fix(build): support Boost >= 1.87")
# does not contain them, and on Boost 1.90 that clone simply cannot be built —
# better to say so in one line now than after 15 minutes of npm and apt.
check_wspp_sources() {
    local entry src missing=0

    for entry in "${WSPP_PATCHES[@]}"; do
        src="$PHANTOM_DIR/${entry%%|*}"
        [ -f "$src" ] || { red "   missing: ${entry%%|*}"; missing=1; }
    done

    # Present but stale: an old copy of websocketpp_asio.hpp predates the
    # io_context shim, which fails exactly the same way as no patch at all.
    if [ "$missing" -eq 0 ] \
       && ! grep -q "io_context" "$PHANTOM_DIR/websocketpp_asio.hpp"; then
        red "   stale: websocketpp_asio.hpp has no io_context shim"
        missing=1
    fi

    if [ "$missing" -eq 0 ]; then
        green "✅ Patched websocketpp headers present in the source tree"
        return 0
    fi

    if [ "$WSPP_REQUIRED" = true ]; then
        die "This checkout does not ship the current patched websocketpp headers.
       They are required with Boost ${BOOST_LABEL} — without them the backend
       cannot compile at all.
       Update the source tree and re-run:
           cd $PHANTOM_DIR && git pull
       or download a current snapshot from
           https://github.com/sv1btl/PhantomSDR-Plus"
    fi

    warn "Patched websocketpp headers are missing or stale."
    yellow "    Boost ${BOOST_LABEL} still has the old Asio API, so the build"
    yellow "    should succeed anyway — but update the tree when you can."
}

patch_websocketpp() {
    local wspp="$PHANTOM_DIR/subprojects/websocketpp-0.8.2"
    local entry src dst

    if [ ! -d "$wspp" ]; then
        if [ "$WSPP_REQUIRED" = true ]; then
            die "websocketpp was not fetched into $wspp.
       'meson setup' downloads it; if it exited 0 without creating that
       directory the wrap fetch failed — usually no network access to
       wrapdb.mesonbuild.com or github.com. Fix that and re-run.
       With Boost ${BOOST_LABEL} the build cannot proceed without it."
        fi
        warn "websocketpp not fetched yet ($wspp) — skipping the header patch"
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
            red "   not patched: ${entry##*|}"
        fi
    done

    if [ "$WSPP_PATCHED" != true ]; then
        [ "$WSPP_REQUIRED" = true ] && die "websocketpp could not be patched — see the lines above.
       The backend will not compile against Boost ${BOOST_LABEL} without these headers."
        warn "websocketpp only partly patched — see the warnings above"
        return 0
    fi

    # Verify the copy actually landed. `meson subprojects update` (and a
    # re-extracted wrap) silently reverts the tree to upstream websocketpp, and
    # the only symptom is the io_service compile error much later on.
    verify_wspp_patched
}

# Reads the subproject headers back and confirms the modern-Asio spellings are
# the ones the compiler will see.
verify_wspp_patched() {
    local wspp="$PHANTOM_DIR/subprojects/websocketpp-0.8.2/websocketpp"
    local bad=""

    # Checking common/asio.hpp alone is not enough. Two of the other four
    # headers carry shim spellings that exist nowhere upstream, so grep for
    # those rather than for anything websocketpp also defines:
    #   endpoint.hpp   ws_work / ws_restart   (upstream: io_service::work,
    #                                          io_service::reset)
    #   connection.hpp ws_post                (upstream: io_service::post)
    # Without them the build stops inside the websocketpp headers themselves
    # with io_service / strand_ptr / expires_from_now errors.
    grep -q "io_context"            "$wspp/common/asio.hpp"              || bad="$bad common/asio.hpp(io_context)"
    grep -q "ws_max_listen_backlog" "$wspp/common/asio.hpp"              || bad="$bad common/asio.hpp(ws_max_listen_backlog)"
    grep -q "ws_work"               "$wspp/transport/asio/endpoint.hpp"  || bad="$bad transport/asio/endpoint.hpp(ws_work)"
    grep -q "ws_post"               "$wspp/transport/asio/connection.hpp"|| bad="$bad transport/asio/connection.hpp(ws_post)"

    if [ -n "$bad" ]; then
        WSPP_PATCHED=false
        [ "$WSPP_REQUIRED" = true ] && die "the patched websocketpp headers did not land:${bad}
       Did something run 'meson subprojects update'?
       Re-run this installer, or copy the five headers by hand — see
       docs/INSTALLATION.md."
        warn "websocketpp subproject is still upstream:${bad}"
        return 0
    fi

    green "✅ websocketpp headers patched and verified (${#WSPP_PATCHES[@]} files)"
}


# ------------------------------------------------------------------------------
# A build tool that is on PATH but cannot run
# ------------------------------------------------------------------------------
# The package manager puts meson and ninja in /usr/bin, but a leftover
# `pip install --user meson` leaves a launcher script in ~/.local/bin that
# comes first on PATH. After a distribution upgrade moves Python to a new
# version, the library that launcher imports is in the old version's
# site-packages and the shim dies before it does anything:
#
#   File "/home/<user>/.local/bin/meson", line 3, in <module>
#     from mesonbuild.mesonmain import main
#   ModuleNotFoundError: No module named 'mesonbuild'
#
# Nothing here is wrong with PhantomSDR-Plus, but the build fails and the
# traceback names no cause. So: if the copy PATH picks first cannot even print
# its version, find one that can, put that one in front, and say what happened
# so the machine actually gets repaired.
PHANTOM_TOOL_BIN=""

# Create a directory of our own at the front of PATH and leave its path in
# PHANTOM_TOOL_BIN. Narrow on purpose — prepending /usr/bin instead would
# shadow everything else the user keeps in ~/.local/bin (pipx, their own
# scripts), which is not ours to change.
#
# The caller reads PHANTOM_TOOL_BIN rather than the output of this function:
# it exports PATH, and a command substitution would run it in a subshell that
# throws that export away — the same trap run() documents for nvm.
phantom_tool_bin() {
    if [ -z "$PHANTOM_TOOL_BIN" ]; then
        PHANTOM_TOOL_BIN="$(mktemp -d "${TMPDIR:-/tmp}/phantom-tools-XXXXXX")"
        PATH="$PHANTOM_TOOL_BIN:$PATH"
        export PATH
    fi
}

# ensure_working_tool <name>   — no-op when the tool is fine or not yet installed
ensure_working_tool() {
    local name="$1" first="" working="" old_ifs search dir candidate

    first="$(command -v "$name" 2>/dev/null || true)"
    # Not installed yet is not this function's business: the package step
    # installs it, and the build step already fails clearly if it is missing.
    [ -n "$first" ] || return 0
    "$name" --version >/dev/null 2>&1 && return 0

    # The whole list has to come from ONE expansion. Word splitting applies to
    # what an expansion produced, not to literal text typed beside it, so
    # `for dir in $PATH:/usr/bin` glues the last PATH entry to the literal tail
    # and searches a directory that cannot exist. On Fedora, whose PATH ends in
    # /usr/bin, that hid the only working copy on the machine.
    search="$PATH:/usr/bin:/usr/local/bin:/bin"
    old_ifs="$IFS"
    IFS=:
    for dir in $search; do
        [ -n "$dir" ] || continue
        candidate="$dir/$name"
        [ "$candidate" != "$first" ] || continue
        [ -x "$candidate" ] || continue
        if "$candidate" --version >/dev/null 2>&1; then
            working="$candidate"
            break
        fi
    done
    IFS="$old_ifs"

    if [ -z "$working" ]; then
        die "$name is on PATH at $first, but it cannot run:
       '$name --version' fails, and no working copy exists anywhere else
       on this system.

       This is almost always a leftover 'pip install --user $name': the
       launcher script in ~/.local/bin outlived the Python version whose
       site-packages held its library, so it raises ModuleNotFoundError
       before doing any work — and it hides the copy the package manager
       installed.

       Remove it and run this installer again:

           rm -f ~/.local/bin/$name
           hash -r

       Or reinstall it for the Python this system has now:

           python3 -m pip install --user --force-reinstall --break-system-packages $name"
    fi

    phantom_tool_bin
    ln -sf "$working" "$PHANTOM_TOOL_BIN/$name"
    hash -r 2>/dev/null || true

    warn "$first cannot run — using $working for this installation."
    echo "   That file is a leftover 'pip install --user $name' whose Python"
    echo "   library is gone (ModuleNotFoundError), and it shadows the working"
    echo "   copy on PATH. This run works around it, but repair the system:"
    echo ""
    echo "       rm -f ~/.local/bin/$name"
    echo "       hash -r"
    echo ""
}

# ------------------------------------------------------------------------------
# Installation report — install.txt
# ------------------------------------------------------------------------------
# Everything worth knowing after the run is collected as it happens and written
# to install.txt in the PhantomSDR-Plus directory by an EXIT trap. The trap
# fires on success, on die(), and on an unexpected non-zero exit under `set -e`,
# so a run that dies halfway still leaves a readable report that ends at the
# step which failed. Nothing else in this script needs to remember to call it.
#
#   step_state <OK|SKIPPED|PARTIAL|FAILED> [detail]   status of the current step
#   warn <text>                    print a warning AND record it in the report
#   fact <label> <value>           a line in the report's SYSTEM/COMPONENTS block
#
# A step that never calls step_state is recorded OK when the next step starts,
# which is what "it ran and did not die" means for the steps that cannot fail
# halfway.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPORT_NAME="install.txt"
INSTALL_STARTED_ISO="$(date -Is)"
INSTALL_STARTED_EPOCH="$(date +%s)"
DIE_MESSAGE=""

declare -a STEP_NAME=()  STEP_STATE=()  STEP_NOTE=()
declare -a WARNINGS=()
declare -a FACTS=()
declare -a COMPONENTS=()

warn() {
    yellow "⚠️  $*"
    WARNINGS+=("step ${STEP_NO}|$*")
}

fact()      { FACTS+=("$1|$2"); }
component() { COMPONENTS+=("$1|$2"); }

# "Label ............ value", for the report's aligned two-column blocks.
dotted() {
    local label="$1" value="$2" n pad=""
    n=$(( 26 - ${#label} ))
    [ "$n" -lt 2 ] && n=2
    pad=$(printf '%*s' "$n" '')
    printf '  %s %s %s\n' "$label" "${pad// /.}" "$value"
}

step_state() {
    [ "$STEP_NO" -gt 0 ] || return 0
    STEP_STATE[$STEP_NO]="$1"
    STEP_NOTE[$STEP_NO]="${2:-}"
}

# ------------------------------------------------------------------------------
# Step counter
# ------------------------------------------------------------------------------
# Every phase announces itself as "STEP n/N — Title" so it is obvious at a
# glance how far along the install is and what is happening. Keep STEP_TOTAL in
# sync when adding or removing a step() call.

STEP_NO=0
STEP_TOTAL=20
STEP_T0=0

# Frame drawing. Every framed line is padded to STEP_W visible columns, so the
# right-hand border lines up whatever is printed inside it. Text longer than the
# frame is truncated rather than allowed to break the box — the frames are the
# only thing separating one step from the next on a long install log.
STEP_W=70

frepeat() { local i out=""; for ((i = 0; i < $2; i++)); do out+="$1"; done; printf '%s' "$out"; }

# The colour of the frame itself. Blue everywhere except the reboot warning,
# which sets it to yellow around its own box and puts it back afterwards.
FRAME_C='\033[34m'

# fline <text> [extra-columns]
#   `extra-columns` is how many display columns the text takes BEYOND its
#   character count. Bash counts characters, terminals draw columns, and emoji
#   are two columns wide while counting as one character (🎉) or two characters
#   (⚠️ , which is a warning sign plus an invisible variation selector). Getting
#   this wrong is what makes the right-hand border of a hand-drawn box wander,
#   which is exactly what it did in the old closing banners.
fline() {
    local text="${1:-}" extra="${2:-0}" pad
    if (( ${#text} + extra > STEP_W )); then
        text="${text:0:$((STEP_W - 1 - extra))}…"
    fi
    pad=$(( STEP_W - ${#text} - extra ))
    (( pad < 0 )) && pad=0
    printf '%b║\033[0m%s%s%b║\033[0m\n' \
        "$FRAME_C" "$text" "$(frepeat ' ' $pad)" "$FRAME_C"
}
ftop() { printf '%b╔%s╗\033[0m\n' "$FRAME_C" "$(frepeat '═' $STEP_W)"; }
fmid() { printf '%b╟%s╢\033[0m\n' "$FRAME_C" "$(frepeat '─' $STEP_W)"; }
fbot() { printf '%b╚%s╝\033[0m\n' "$FRAME_C" "$(frepeat '═' $STEP_W)"; }

# The end-of-run verdict table. install.txt has had this since the report was
# added; printing it on the terminal too means the answer to "what actually
# happened" is on screen, without opening a file.
print_step_table() {
    local i name st col
    echo ""
    blue "  Every step of this run:"
    for ((i = 1; i <= STEP_NO; i++)); do
        name="${STEP_NAME[$i]:-}"
        [ -n "$name" ] || continue
        if (( ${#name} > 46 )); then name="${name:0:45}…"; fi
        case "${STEP_STATE[$i]:-OK}" in
            OK)      col='\033[32m' ;;
            SKIPPED) col='\033[90m' ;;
            PARTIAL) col='\033[33m' ;;
            FAILED)  col='\033[31m' ;;
            *)       col='\033[0m'  ;;
        esac
        printf '     %2d. %-46s %b%s\033[0m\n' \
            "$i" "$name" "$col" "${STEP_STATE[$i]:-OK}"
    done
    return 0
}

# Closes the step that was running: prints its verdict, so the end of one step
# is as visible as the start of the next. Called from step() for the previous
# step, and once by hand after the last one.
step_close() {
    if [ "$STEP_NO" -le 0 ]; then return 0; fi
    if [ -z "${STEP_STATE[$STEP_NO]:-}" ]; then STEP_STATE[$STEP_NO]="OK"; fi

    local st="${STEP_STATE[$STEP_NO]}" icon col
    case "$st" in
        OK)      icon="✅"; col="\033[32m" ;;
        SKIPPED) icon="⏭️" ; col="\033[90m" ;;
        PARTIAL) icon="⚠️" ; col="\033[33m" ;;
        FAILED)  icon="❌"; col="\033[31m" ;;
        *)       icon="•" ; col="\033[0m"  ;;
    esac
    printf '  \033[34m└─\033[0m %s %b STEP %d/%d %s\033[0m  \033[90m(%ds)\033[0m\n' \
        "$icon" "$col" "$STEP_NO" "$STEP_TOTAL" "$st" "$(( $(date +%s) - STEP_T0 ))"
    if [ -n "${STEP_NOTE[$STEP_NO]:-}" ]; then
        printf '     \033[90m%s\033[0m\n' "${STEP_NOTE[$STEP_NO]}"
    fi
    return 0
}

step() {
    step_close                       # verdict of the step that just finished

    STEP_NO=$((STEP_NO + 1))
    STEP_NAME[$STEP_NO]="$1"
    STEP_STATE[$STEP_NO]=""          # empty = still running
    STEP_NOTE[$STEP_NO]=""
    STEP_T0=$(date +%s)

    # A progress bar of how many steps are behind us. It is deliberately based
    # on the step count and not on time: the steps are wildly uneven (the
    # backend build is minutes, the marker list is seconds), so a time estimate
    # would be a lie, while "12 of 18 done" is always true.
    local pct filled bar
    pct=$(( (STEP_NO - 1) * 100 / STEP_TOTAL ))
    filled=$(( pct * 40 / 100 ))
    bar="$(frepeat '█' $filled)$(frepeat '░' $((40 - filled)))"

    echo ""
    ftop
    fline "$(printf '  STEP %2d/%d  ▸  %s' "$STEP_NO" "$STEP_TOTAL" "$1")"
    if [ -n "${2:-}" ]; then fline "                 $2"; fi
    fmid
    fline "  [${bar}] ${pct}%"
    fbot
}

# Writes install.txt. Registered as an EXIT trap right after the helpers, so it
# runs no matter how the script ends.
write_report() {
    local rc=$?
    local target dir finished elapsed result i state note label value
    trap - EXIT                      # never re-enter, whatever happens below

    # PHANTOM_DIR is only known from the source-tree step onwards; before
    # that, the script's own directory is the best guess, and it is almost
    # always the right one.
    dir="${PHANTOM_DIR:-$SCRIPT_DIR}"
    target="${dir}/${REPORT_NAME}"

    finished="$(date -Is)"
    elapsed=$(( $(date +%s) - INSTALL_STARTED_EPOCH ))

    # The step that was running when we exited is the one that failed.
    if [ "$rc" -eq 0 ]; then
        [ "$STEP_NO" -gt 0 ] && [ -z "${STEP_STATE[$STEP_NO]:-}" ] \
            && STEP_STATE[$STEP_NO]="OK"
        if [ ${#WARNINGS[@]} -gt 0 ]; then
            result="SUCCESS — with ${#WARNINGS[@]} warning(s), see below"
        else
            result="SUCCESS"
        fi
    else
        [ "$STEP_NO" -gt 0 ] && STEP_STATE[$STEP_NO]="FAILED"
        result="FAILED at step ${STEP_NO}/${STEP_TOTAL} — ${STEP_NAME[$STEP_NO]:-startup}"
    fi

    {
        echo "══════════════════════════════════════════════════════════════════════════"
        echo " PhantomSDR-Plus — installation report"
        echo "══════════════════════════════════════════════════════════════════════════"
        echo ""
        echo "  Result ......... ${result}"
        echo "  Exit code ...... ${rc}"
        echo "  Started ........ ${INSTALL_STARTED_ISO}"
        echo "  Finished ....... ${finished}"
        printf '  Duration ....... %d min %d s\n' $((elapsed / 60)) $((elapsed % 60))
        echo "  Host ........... $(hostname 2>/dev/null || echo unknown) ($(uname -m))"
        echo "  Source tree .... ${dir}"
        echo "  Run by ......... $(id -un)"
        echo ""

        echo "SYSTEM"
        echo "──────────────────────────────────────────────────────────────────────────"
        if [ ${#FACTS[@]} -eq 0 ]; then
            echo "  (the run ended before the system could be identified)"
        else
            for i in "${FACTS[@]}"; do
                label="${i%%|*}"; value="${i#*|}"
                dotted "$label" "$value"
            done
        fi
        echo ""

        echo "STEPS"
        echo "──────────────────────────────────────────────────────────────────────────"
        for (( i = 1; i <= STEP_TOTAL; i++ )); do
            state="${STEP_STATE[$i]:-}"
            note="${STEP_NOTE[$i]:-}"
            if [ -z "${STEP_NAME[$i]:-}" ]; then
                printf '  %2d/%d  %-42s %s\n' "$i" "$STEP_TOTAL" \
                       "(not reached)" "—"
                continue
            fi
            [ -z "$state" ] && state="NOT FINISHED"
            # Truncate the name so the status column stays aligned.
            printf '  %2d/%d  %-42.42s %-12s %s\n' \
                   "$i" "$STEP_TOTAL" "${STEP_NAME[$i]}" "$state" "$note"
        done
        echo ""

        if [ ${#COMPONENTS[@]} -gt 0 ]; then
            echo "COMPONENTS"
            echo "──────────────────────────────────────────────────────────────────────────"
            for i in "${COMPONENTS[@]}"; do
                label="${i%%|*}"; value="${i#*|}"
                dotted "$label" "$value"
            done
            echo ""
        fi

        echo "WARNINGS AND ISSUES (${#WARNINGS[@]})"
        echo "──────────────────────────────────────────────────────────────────────────"
        if [ ${#WARNINGS[@]} -eq 0 ]; then
            echo "  None. Nothing reported a problem during this run."
        else
            for i in "${WARNINGS[@]}"; do
                label="${i%%|*}"; value="${i#*|}"
                printf '  [%s] %s\n' "$label" "$value"
            done
        fi
        echo ""

        if [ "$rc" -ne 0 ]; then
            echo "FAILURE DETAIL"
            echo "──────────────────────────────────────────────────────────────────────────"
            echo "  Step ${STEP_NO}/${STEP_TOTAL} — ${STEP_NAME[$STEP_NO]:-startup}"
            echo ""
            if [ -n "$DIE_MESSAGE" ]; then
                echo "$DIE_MESSAGE" | sed 's/^/  /'
                if [ -n "$FAILED_CMD_LOG" ] && [ -s "$FAILED_CMD_LOG" ]; then
                    echo ""
                    echo "  Last lines of that command's output:"
                    echo ""
                    tail -n 30 "$FAILED_CMD_LOG" | sed 's/^/  | /'
                fi
            else
                echo "  The script exited with code ${rc} without a message of its own."
                echo "  That is an unguarded command failing under 'set -e'. The last"
                echo "  lines printed in the terminal say which one."
            fi
            echo ""
            echo "  This installer is safe to re-run. It keeps what is already there:"
            echo "  dnf is idempotent, meson reconfigures an existing build tree,"
            echo "  and the questions you already answered can be answered the same way."
            echo ""
        fi

        echo "WHAT TO DO NEXT"
        echo "──────────────────────────────────────────────────────────────────────────"
        if [ "$rc" -eq 0 ]; then
            echo "  1. Restart your terminal — Node.js and Rust are not on PATH until you do."
            echo "  2. Edit the .toml for your receiver, then start it:"
            echo "        cd ${dir}"
            echo "        ./start-rx888mk2.sh     (or start-airspyhf.sh / start-rtl.sh /"
            echo "                                 start-rsp1a.sh / start-fobos-hf.sh /"
            echo "                                 start-fobos.sh / start-hackrf.sh —"
            echo "                                 re-run to restart)"
            echo "        ./stop-websdr.sh        to stop"
            echo "  3. Open http://localhost:PORT/ with the port from your .toml."
        else
            echo "  Fix what the FAILURE DETAIL above describes, then run ./$(basename "$0") again."
        fi
        echo ""
        echo "  Full guide ..... ${dir}/docs/INSTALLATION.md"
        echo "  Issues ......... https://github.com/sv1btl/PhantomSDR-Plus"
        echo ""
        echo "══════════════════════════════════════════════════════════════════════════"
        echo " Written by install.sh at ${finished}"
        echo " This file is overwritten by every run. Keep a copy if you want to"
        echo " compare two installations."
        echo "══════════════════════════════════════════════════════════════════════════"
    } | sed 's/[[:space:]]*$//' > "$target" 2>/dev/null || {
        red "⚠️  Could not write the installation report to ${target}"
        return 0
    }

    echo ""
    if [ "$rc" -eq 0 ]; then
        green "📄 Installation report written: ${target}"
    else
        red   "📄 Installation report written: ${target}"
        red   "   It records how far the run got and what went wrong."
    fi
    return 0
}

trap write_report EXIT

# ------------------------------------------------------------------------------
# Prompting
# ------------------------------------------------------------------------------
# Every point where the installer waits for the operator is fenced by the same
# banner, so a question can never be mistaken for ordinary progress output
# scrolling past.

PHANTOM_NONINTERACTIVE="${PHANTOM_NONINTERACTIVE:-0}"

# A piped run (curl | bash, podman build, a CI job) has no terminal to read
# from; asking anyway would consume the wrong stdin. Fall back to the defaults.
if [ "$PHANTOM_NONINTERACTIVE" != "1" ] && [ ! -t 0 ]; then
    PHANTOM_NONINTERACTIVE=1
fi

prompt_fence() {
    echo ""
    yellow "  ┌──────────────────────────────────────────────────────────────────┐"
    yellow "  │  ⌨️   YOUR INPUT IS NEEDED                                        │"
    yellow "  └──────────────────────────────────────────────────────────────────┘"
}

# confirm <ENV_NAME> <default-interactive> <default-unattended> <question>
#   Returns 0 for yes, 1 for no. The environment variable, if set, wins over
#   both defaults and over anything typed.
confirm() {
    local envname="$1" def="$2" def_ni="$3" q="$4"
    local override="${!envname:-}" hint word ans

    if [ -n "$override" ]; then
        echo ""
        echo "  ❓ $q"
        [[ $override =~ ^[Yy] ]] && word="Yes" || word="No"
        echo "     → ${word} (from ${envname}=${override})"
        [[ $override =~ ^[Yy] ]]
        return
    fi

    if [ "$PHANTOM_NONINTERACTIVE" = "1" ]; then
        echo ""
        echo "  ❓ $q"
        [[ $def_ni =~ ^[Yy] ]] && word="Yes" || word="No"
        echo "     → ${word} (unattended default; set ${envname}=y|n to choose)"
        [[ $def_ni =~ ^[Yy] ]]
        return
    fi

    # The default is stated twice and never in lower case: once as the
    # capitalised, coloured letter inside the brackets, once spelled out in full
    # after them. Pressing ENTER on its own has to be unambiguous — half the
    # support questions about the old installer were someone who pressed ENTER
    # at "[y/n]" and did not know which one they had just chosen.
    if [ "$def" = "y" ]; then
        hint="\033[1;32mY\033[0m/n"; word="Yes"
    else
        hint="y/\033[1;31mN\033[0m"; word="No"
    fi
    prompt_fence
    printf '  ❓ %s [%b]  \033[90m(ENTER = %s)\033[0m: ' "$q" "$hint" "$word"
    read -r ans
    ans="${ans:-$def}"
    [[ $ans =~ ^[Yy] ]]
}

# ask_menu <ENV_NAME> <default> <question> — answer lands in $MENU_ANSWER.
# The caller prints the option list first.
MENU_ANSWER=""
ask_menu() {
    local envname="$1" def="$2" q="$3"
    local override="${!envname:-}"

    if [ -n "$override" ]; then
        MENU_ANSWER="$override"
        echo ""
        echo "  ❓ $q  → ${MENU_ANSWER} (from ${envname})"
        return
    fi

    if [ "$PHANTOM_NONINTERACTIVE" = "1" ]; then
        MENU_ANSWER="$def"
        echo ""
        echo "  ❓ $q  → ${def} (unattended default; set ${envname} to choose)"
        return
    fi

    prompt_fence
    read -rp "  ❓ ${q}: " MENU_ANSWER
    MENU_ANSWER="${MENU_ANSWER:-$def}"
}

# pause <message> — a plain "press ENTER" acknowledgement.
pause() {
    if [ "$PHANTOM_NONINTERACTIVE" = "1" ]; then
        echo "  (unattended — continuing)"
        return 0
    fi
    prompt_fence
    read -rp "  ⏎  $1"
}

# ------------------------------------------------------------------------------
# Running PhantomSDR-Plus components
# ------------------------------------------------------------------------------
# Installing on top of a live receiver is the single most effective way to get a
# broken result that looks like a broken build: meson writes over a
# build/spectrumserver that is still mapped by the running process, the admin
# panel keeps serving the old frontend out of a directory that no longer exists,
# and the watchdog helpfully restarts the half-written binary in the middle of
# the compile. So the first thing the installer does is find what is running and
# stop it — and, because it stopped it, start it again at the end.
#
# Three of the four components are systemd units. The receiver is not: it is a
# start-<radio>.sh launcher that detaches its own watchdog, so it is found in the
# process list and stopped with the stop-websdr.sh that lives next to it. That
# also means the directory the running receiver came from is known exactly,
# which matters when the installer is being run from a second clone.

PHANTOM_UNITS=(phantomsdr-admin.service phantomsdr-proxy.service sdr-stats.service)
STOPPED_UNITS=()
STOPPED_RECEIVER=""          # full path of the start-*.sh that was running
RESTART_SERVICES=false       # only true when WE stopped them

unit_label() {
    case "$1" in
        phantomsdr-admin.service) echo "Admin panel" ;;
        phantomsdr-proxy.service) echo "Reverse proxy" ;;
        sdr-stats.service)        echo "Statistics server" ;;
        *)                        echo "$1" ;;
    esac
}

# Prints the full path of the running start-*.sh launcher, or nothing.
#
# Only a shell running a launcher counts: argv is "bash <path>/start-X.sh …"
# for the watchdog ("--watchdog") and for a launcher still in the foreground
# alike. Matching the name anywhere on a command line also caught "nano
# start-rtl.sh", or any tool that merely had the name among its arguments, and
# the installer then "stopped" a receiver that was not running and failed to
# start it again at the end. A relative path ("./start-rtl.sh", started by
# hand) is resolved against that process's own working directory, so the
# restart at the end runs the right file.
running_receiver_script() {
    local pid argv0 path cwd
    local re='^start-(rx888mk2|airspyhf|rtl|rsp1a|fobos|fobos-hf|hackrf)\.sh$'
    while read -r pid; do
        [ -n "$pid" ] || continue
        { IFS= read -r -d '' argv0 && IFS= read -r -d '' path; } \
            < "/proc/$pid/cmdline" 2>/dev/null || continue
        case "${argv0##*/}" in bash|sh|dash) ;; *) continue ;; esac
        [[ "${path##*/}" =~ $re ]] || continue
        case "$path" in
            /*) ;;
            *)  cwd="$(readlink -f "/proc/$pid/cwd" 2>/dev/null)" || continue
                [ -n "$cwd" ] || continue
                path="$cwd/${path#./}" ;;
        esac
        printf '%s\n' "$path"
        return 0
    done < <(pgrep -f 'start-(rx888mk2|airspyhf|rtl|rsp1a|fobos|fobos-hf|hackrf)\.sh' 2>/dev/null)
    return 1
}

# The whole of step 1.
stop_running_phantom() {
    local u lbl state script found=0
    local -a live_units=()

    printf '  %-32s %-14s %s\n' "COMPONENT" "STATE" "WHAT IT IS"
    printf '  %-32s %-14s %s\n' "$(frepeat '─' 32)" "$(frepeat '─' 14)" "$(frepeat '─' 18)"

    for u in "${PHANTOM_UNITS[@]}"; do
        lbl="$(unit_label "$u")"
        if systemctl is-active --quiet "$u" 2>/dev/null; then
            printf '  %-32s \033[32m%-14s\033[0m %s\n' "$u" "running" "$lbl"
            live_units+=("$u")
            found=$((found + 1))
        elif systemctl cat "$u" >/dev/null 2>&1; then
            printf '  %-32s \033[90m%-14s\033[0m %s\n' "$u" "stopped" "$lbl"
        else
            printf '  %-32s \033[90m%-14s\033[0m %s\n' "$u" "not installed" "$lbl"
        fi
    done

    script="$(running_receiver_script || true)"
    if [ -n "$script" ]; then
        printf '  %-32s \033[32m%-14s\033[0m %s\n' "$(basename "$script")" "running" "The receiver"
        found=$((found + 1))
    else
        printf '  %-32s \033[90m%-14s\033[0m %s\n' "start-<radio>.sh" "stopped" "The receiver"
    fi
    echo ""

    if [ "$found" -eq 0 ]; then
        green "  ✅ No part of PhantomSDR-Plus is running — safe to continue."
        step_state OK "nothing was running"
        return 0
    fi

    # Not warn(): this is the normal path. Everything below either stops them
    # cleanly -- and step ${STEP_TOTAL} starts them again -- or records its own
    # warning. Reporting "1 warning" for a run that did exactly what it was
    # asked to do teaches sysops to ignore the warnings that matter.
    yellow "⚠️  ${found} PhantomSDR-Plus component(s) are running."
    echo "     Installing over a running receiver overwrites files that are open,"
    echo "     can leave the admin panel serving a frontend that no longer exists,"
    echo "     and lets the watchdog restart a half-written binary mid-compile."

    if ! confirm PHANTOM_STOP_SERVICES y y \
         "Stop them now, and start them again when the install finishes?"; then
        echo ""
        red "  ✋ Nothing was stopped. The installer will wait for you."
        echo ""
        echo "     In another terminal:"
        echo "       ${SUDO:+$SUDO }systemctl stop ${PHANTOM_UNITS[*]}"
        if [ -n "$script" ]; then echo "       $(dirname "$script")/stop-websdr.sh"; fi
        echo ""
        pause "Press ENTER once they are stopped (Ctrl-C to abort) "
        step_state PARTIAL "stopped by hand — they will NOT be restarted for you"
        warn "You stopped ${found} component(s) by hand — this installer only starts
       again what it stopped itself, so start them when the install finishes."
        return 0
    fi

    echo ""
    for u in "${live_units[@]}"; do
        lbl="$(unit_label "$u")"
        printf '     %-40s' "stopping ${lbl} ..."
        if $SUDO systemctl stop "$u" >/dev/null 2>&1; then
            green "stopped"
            STOPPED_UNITS+=("$u")
        else
            red "failed"
            warn "Could not stop ${u} — stop it by hand before continuing."
        fi
    done

    if [ -n "$script" ]; then
        printf '     %-40s' "stopping the receiver ..."
        if [ -x "$(dirname "$script")/stop-websdr.sh" ] \
           && "$(dirname "$script")/stop-websdr.sh" >/dev/null 2>&1; then
            green "stopped"
            STOPPED_RECEIVER="$script"
        else
            red "failed"
            warn "Could not stop ${script} — stop it by hand before continuing."
        fi
    fi

    if [ ${#STOPPED_UNITS[@]} -gt 0 ] || [ -n "$STOPPED_RECEIVER" ]; then
        RESTART_SERVICES=true
        echo ""
        green "  ✅ Stopped. They are started again in step ${STEP_TOTAL}."
        step_state OK "stopped ${#STOPPED_UNITS[@]} service(s)${STOPPED_RECEIVER:+ + the receiver}"
    else
        step_state PARTIAL "nothing could be stopped"
    fi
    return 0
}

# The other half: only ever starts what this run stopped, and only if it stopped
# it itself. A component the user stopped by hand is theirs to start again.
restart_stopped_phantom() {
    [ "$RESTART_SERVICES" = true ] || return 0

    local u lbl
    echo ""
    blue "  Starting again what was stopped in step 1:"
    for u in "${STOPPED_UNITS[@]}"; do
        lbl="$(unit_label "$u")"
        printf '     %-40s' "starting ${lbl} ..."
        if $SUDO systemctl start "$u" >/dev/null 2>&1; then
            green "running"
        else
            red "failed"
            warn "Could not start ${u} — start it by hand: ${SUDO} systemctl start ${u}"
        fi
    done

    if [ -n "$STOPPED_RECEIVER" ]; then
        printf '     %-40s' "starting the receiver ..."
        # -q keeps it to two lines; the launcher detaches its own watchdog and
        # returns, so this does not block the end of the install.
        if "$STOPPED_RECEIVER" -q >/dev/null 2>&1; then
            green "running"
        else
            red "failed"
            warn "Could not start ${STOPPED_RECEIVER} — start it by hand."
        fi
    fi
    echo ""
    return 0
}

# ------------------------------------------------------------------------------
# Privilege escalation
# ------------------------------------------------------------------------------

# Already root? Then use nothing. Choosing sudo purely because the binary
# exists breaks every root install where sudo is present but not usable — a
# container, a minimal image, or a root account that is not in sudoers. It
# fails as "sudo: a password is required" on a machine that needed no password
# at all, which reads like a permissions problem and is not one.
if [ "$(id -u)" -eq 0 ]; then
    SUDO=""
elif command -v sudo >/dev/null 2>&1; then
    SUDO="sudo"
else
    SUDO=""
fi

# ------------------------------------------------------------------------------
# Node.js / npm via nvm
# ------------------------------------------------------------------------------

# ------------------------------------------------------------------------------
# Prerequisites
# ------------------------------------------------------------------------------
# The base packages, installed before anything else touches the system. Order
# matters: nvm fetches Node.js with curl, and the RX888 / RTL-SDR driver builds
# need libusb — both used to be pulled in later on, so a bare minimal image
# could fail partway through. psmisc provides fuser/killall, which the
# start/stop scripts use, and findutils provides find/xargs, which nvm's
# "nvm use" needs and which recompile.sh and update.sh call directly.
# openSUSE Tumbleweed's base image is the one that ships without it.
#
# The package manager is idempotent, so the fuller "Installing System
# Dependencies" step further down simply confirms these and adds the rest.

step "Running PhantomSDR-Plus services" "what is live right now, before anything is touched"
stop_running_phantom

step "Detecting the system" "confirms the distribution and reads the installed Boost version"

# This installer is Fedora only — the distribution is not in question, but
# the Boost version is: it decides whether the websocketpp header patch is
# merely applied or strictly required (see the notes above).
OS_LABEL="Fedora"
if [ -r /etc/os-release ]; then
    # shellcheck source=/dev/null
    . /etc/os-release
    OS_LABEL="${PRETTY_NAME:-Fedora}"
    case "${ID:-}" in
        fedora|*fedora*) : ;;
        *) yellow "⚠️  This is Fedora's installer and /etc/os-release says '${ID:-unknown}'."
           yellow "   Continuing anyway — package names may not match." ;;
    esac
fi
green "✅ Detected: ${OS_LABEL}"
detect_boost
report_boost_version

fact "Distribution"   "${OS_LABEL}"
fact "Package manager" "dnf"
fact "Architecture"   "$(uname -m)"
fact "Kernel"         "$(uname -r)"
fact "Unattended run" "$([ "$PHANTOM_NONINTERACTIVE" = "1" ] && echo 'yes' || echo 'no')"

banner "Before we start"
echo ""
echo "Target: ${OS_LABEL}"
echo ""
echo "The installation runs in ${STEP_TOTAL} steps. It will stop and ask you"
echo "for something at exactly these points (step 1 has asked its"
echo "own question already — whether to stop a running receiver):"
echo ""
echo "   STEP  8  Which SDR (RX888/RTL/RSP1A/Fobos/Airspy/HackRF/skip)"
echo "   STEP  9  Your site information — opens an editor (callsign, QTH, …)"
echo "   STEP 12  OpenCL acceleration — yes / no"
echo "   STEP 13  Admin panel         — yes / no  (asks its own questions)"
echo "   STEP 14  WebSDR relay        — yes / no  (asks its own questions)"
echo "   STEP 15  RADE / FreeDV       — yes / no  (asks its own questions)"
echo "   STEP 16  Statistics server   — yes / no  (asks its own questions)"
echo "   STEP 18  Kiwi emulation      — yes / no  (patches source for Kiwi clients)"
echo "   STEP 19  Final rebuild       — yes / no"
echo ""
yellow "Each of those is fenced by a '⌨️  YOUR INPUT IS NEEDED' banner."
echo "Everything else runs on its own and needs no attention."
echo ""
echo "When the run ends — whether it succeeds or fails — a full report is"
echo "written to install.txt in the PhantomSDR-Plus directory."
echo ""
if [ "$PHANTOM_NONINTERACTIVE" = "1" ]; then
    yellow "Running UNATTENDED — every question takes its default answer."
    yellow "See the header of this script for the PHANTOM_* overrides."
    echo ""
fi

step "Prerequisites" "base packages — no input needed"
echo "Installing the prerequisites..."
run $SUDO dnf install -y \
    curl @development-tools gcc gcc-c++ make cmake pkg-config meson \
    libusb1-devel fftw-devel websocketpp-devel flac-devel \
    zlib-devel libzstd-devel boost-devel \
    opus-devel \
    git psmisc procps-ng findutils

green "✅ Prerequisites installed"

# The package manager may only now have installed Boost; re-read it, because
# it decides whether the websocketpp patch is mandatory further down.
detect_boost
report_boost_version
fact "Boost" "${BOOST_LABEL}$([ "$WSPP_REQUIRED" = true ] \
    && echo '  (>= 1.87 — the websocketpp patch is MANDATORY here)' \
    || echo '  (< 1.87 — the websocketpp patch is applied but optional)')"
fact "Compiler" "$(gcc --version 2>/dev/null | head -1 || echo 'gcc (version unknown)')"
# A broken pip --user shim in ~/.local/bin hides the copy just installed, and
# the failure it causes has nothing to do with PhantomSDR-Plus. Deal with it
# before the version is recorded, so the report names the copy this run uses.
ensure_working_tool meson
fact "meson"    "$(meson --version 2>/dev/null || echo unknown)"
echo ""

step "Node.js and npm" "installs Node 22 via nvm if the system copy is too old"
NVM_VERSION="v0.40.4"
NODE_NEED=22

install_node_via_nvm() {
    echo "Installing nvm ${NVM_VERSION}..."
    # nvm's installer refuses to run when NVM_DIR names a directory that does
    # not exist yet — it prints "You have $NVM_DIR set to ..., but that
    # directory does not exist" and installs nothing. NVM_DIR is exported a few
    # lines below (so an existing nvm can be loaded), which is exactly that
    # situation on a machine that has never had nvm. Debian and Ubuntu tolerate
    # it; openSUSE Tumbleweed does not, and the run dies at the Node.js step. Creating the
    # directory first costs nothing and makes every distribution behave.
    mkdir -p "${NVM_DIR:-$HOME/.nvm}"
    # NOTE: Do NOT use `run` here — run() only guards the left side of a pipe.
    curl -o- "https://raw.githubusercontent.com/nvm-sh/nvm/${NVM_VERSION}/install.sh" \
        | bash || die "nvm installation script failed"
    export NVM_DIR="$HOME/.nvm"
    # shellcheck source=/dev/null
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
    run nvm install ${NODE_NEED}
    run nvm use ${NODE_NEED}
    run nvm alias default ${NODE_NEED}
}

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
        echo "nvm already installed — upgrading Node.js..."
        \. "$NVM_DIR/nvm.sh"
        run nvm install ${NODE_NEED}
        run nvm use ${NODE_NEED}
        run nvm alias default ${NODE_NEED}
    fi
    command -v node >/dev/null 2>&1 && command -v npm >/dev/null 2>&1 \
        || die "Node.js / npm installation failed. Install Node.js ${NODE_NEED}+ manually and retry."
    green "✅ Node.js $(node --version) and npm $(npm --version) installed"
fact "Node.js / npm" "$(node --version 2>/dev/null || echo '?') / $(npm --version 2>/dev/null || echo '?')"
fi

echo ""

# ------------------------------------------------------------------------------
# Locate PhantomSDR-Plus source tree
# ------------------------------------------------------------------------------

step "Locating the PhantomSDR-Plus source tree" "asks for a path only if it cannot find one"
find_phantom_dir() {
    local candidates=( "." "PhantomSDR-Plus" "../PhantomSDR-Plus" "$HOME/PhantomSDR-Plus" )
    for dir in "${candidates[@]}"; do
        if [ -f "$dir/meson.build" ] && [ -d "$dir/frontend" ] && [ -d "$dir/src" ]; then
            PHANTOM_DIR=$(realpath "$dir")
            green "✅ Found PhantomSDR-Plus at: $PHANTOM_DIR"
            return 0
        fi
    done
    red "❌ Could not locate PhantomSDR-Plus automatically"
    echo ""
    [ "$PHANTOM_NONINTERACTIVE" = "1" ] && die "No PhantomSDR-Plus tree found and running unattended.
       Run the installer from inside the source directory."
    prompt_fence
    read -rp "  ❓ Full path to the PhantomSDR-Plus directory: " user_path
    if [ -d "$user_path" ] && [ -f "$user_path/meson.build" ]; then
        PHANTOM_DIR=$(realpath "$user_path")
        green "✅ Using: $PHANTOM_DIR"
    else
        die "Path '$user_path' is not a valid PhantomSDR-Plus directory."
    fi
}

find_phantom_dir

# Before anything long-running: does this checkout ship the headers the
# build needs? (See the websocketpp notes near the top of this file.)
check_wspp_sources
echo ""

# ------------------------------------------------------------------------------
# System dependencies
# ------------------------------------------------------------------------------

step "Installing build dependencies" "the rest of the packages — no input needed"
echo "Installing build tools and libraries..."
run $SUDO dnf install -y \
    @development-tools gcc gcc-c++ make cmake pkg-config meson ninja-build \
    fftw-devel websocketpp-devel flac-devel \
    zlib-devel libzstd-devel boost-devel \
    opus-devel \
    curlpp-devel curl \
    git cargo util-linux

# nlohmann/json ships as json-devel on current Fedora — it is the package that
# provides cmake(nlohmann_json). Older releases used nlohmann-json-devel, and
# naming it directly made dnf fail the whole transaction, so try both and warn
# rather than abort: meson can fetch the subproject if neither is present.
if ! $SUDO dnf install -y json-devel 2>/dev/null; then
    $SUDO dnf install -y nlohmann-json-devel 2>/dev/null \
        || yellow "⚠️  nlohmann/json headers not found — meson will fetch the subproject instead"
fi

# Note: liquid-dsp-devel is NOT in the standard Fedora repos — it is in RPM Fusion.
# Enable RPM Fusion free repo first:
#   sudo dnf install -y https://download1.rpmfusion.org/free/fedora/rpmfusion-free-release-$(rpm -E %fedora).noarch.rpm
# Then install: sudo dnf install -y liquid-dsp-devel
# If RPM Fusion is not available, build from source: https://github.com/jgaeddert/liquid-dsp
if ! rpm -q liquid-dsp-devel >/dev/null 2>&1; then
    yellow "⚠️  liquid-dsp-devel not found — attempting install (requires RPM Fusion free repo)..."
    $SUDO dnf install -y liquid-dsp-devel 2>/dev/null \
        || yellow "   Not found. Enable RPM Fusion or build from source: https://github.com/jgaeddert/liquid-dsp"
fi

green "✅ System packages installed"
echo ""

# ------------------------------------------------------------------------------
# Build PhantomSDR-Plus backend
# ------------------------------------------------------------------------------

step "Building the PhantomSDR-Plus backend" "meson setup + compile — takes a few minutes"
cd "$PHANTOM_DIR"
# Re-checked here: ninja arrived with the build dependencies (meson calls it
# by name, so a broken shim would surface as a confusing meson error), and the
# build tools may have been installed after the earlier check.
ensure_working_tool meson
ensure_working_tool ninja

check_clock_skew

echo "Configuring with Meson..."
clean_stale_subprojects
check_subproject_network
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

echo "Compiling (2 cores — safe for low-RAM systems)..."
run meson compile -j2 -C build
green "✅ Backend compiled: $PHANTOM_DIR/build/"
component "Backend" "built — $PHANTOM_DIR/build/spectrumserver"
cd - > /dev/null
echo ""

# ------------------------------------------------------------------------------
# SDR hardware driver
# ------------------------------------------------------------------------------

step "SDR hardware driver" "⌨️  YOU WILL BE ASKED which receiver to set up"
echo "Which SDR would you like to set up?"
echo "  [1] RX888 MkII / RX888"
echo "  [2] RTL-SDR"
echo "  [3] SDRplay RSP1A (libmirisdr-5 + SoapyMiri + rx_sdr)"
echo "  [4] Skip — install SDR driver manually later"
echo "  [5] RigExpert Fobos SDR (SoapyFobosSDR + rx_sdr, RF and HF)"
echo "  [6] Airspy HF+ (libairspyhf + SoapyAirspyHF + rx_sdr)"
echo "  [7] HackRF One (hackrf_transfer from the distribution)"
ask_menu PHANTOM_SDR 4 "Select an option [1-7]"
option="$MENU_ANSWER"

case $option in

    # ------------------------------------------------------------------
    1)  echo ""
        echo "Setting up RX888 MkII / RX888..."
        # dnf remove (not autoremove) is the correct command to remove a
        # named package.  autoremove only removes unused auto-deps.
        $SUDO dnf remove -y rust 2>/dev/null || true

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
            # A failed pull is not a reason to abandon the installation: the
            # existing clone still builds. It fails routinely when the directory
            # belongs to a different user than the one installing ("detected
            # dubious ownership"), and on any offline machine.
            git pull || warn "git pull failed in rx888_stream — building the existing clone"
        else
            require_github
            run_logged git clone https://github.com/rhgndf/rx888_stream
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
        if confirm PHANTOM_RTLSDR_V4 n n "Do you have an RTL-SDR Blog V4?"; then rtlsdr_v4=y; else rtlsdr_v4=n; fi

        if [[ $rtlsdr_v4 =~ ^[Yy]$ ]]; then
            echo "Setting up RTL-SDR Blog V4..."
            $SUDO dnf remove -y 'rtl-sdr*' 'librtlsdr*' 2>/dev/null || true
            $SUDO rm -f \
                /usr/lib/librtlsdr* /usr/include/rtl-sdr* \
                /usr/local/lib/librtlsdr* /usr/local/include/rtl-sdr* \
                /usr/local/include/rtl_* /usr/local/bin/rtl_*

            run $SUDO dnf install -y libusb1-devel git cmake pkg-config

            if [ -d "rtl-sdr-blog" ]; then
                yellow "rtl-sdr-blog already exists — pulling latest..."
                cd rtl-sdr-blog
                git pull || warn "git pull failed in rtl-sdr-blog — building the existing clone" && cd ..
            else
                require_github
                run_logged git clone https://github.com/rtlsdrblog/rtl-sdr-blog
            fi

            cd rtl-sdr-blog
            mkdir -p build && cd build
            run cmake ../ -DINSTALL_UDEV_RULES=ON
            run make -j4
            run $SUDO make install
            run $SUDO cp ../rtl-sdr.rules /etc/udev/rules.d/
            run $SUDO ldconfig
            echo "blacklist dvb_usb_rtl28xxu" \
                | $SUDO tee /etc/modprobe.d/blacklist-rtl.conf > /dev/null
            cd ../..

            green "✅ RTL-SDR Blog V4 drivers installed"
            yellow "⚠️  A reboot is required for the RTL-SDR V4 to be recognised."
            NEEDS_REBOOT=true
        else
            echo "Setting up standard RTL-SDR..."
            run $SUDO dnf install -y rtl-sdr rtl-sdr-devel
            green "✅ Standard RTL-SDR drivers installed"
        fi
        ;;

    # ------------------------------------------------------------------
    3)  echo ""
        echo "Setting up SDRplay RSP1A (libmirisdr-5)..."
        [ -f "$PHANTOM_DIR/setup-rsp1a.sh" ] \
            || die "setup-rsp1a.sh not found in $PHANTOM_DIR — is the source tree complete?"
        require_github
        # One script for every distribution — it picks apt / dnf / pacman /
        # zypper itself — and a station installed earlier can run it alone.
        run_logged bash "$PHANTOM_DIR/setup-rsp1a.sh"
        green "✅ SDRplay RSP1A installed (libmirisdr-5 + SoapyMiri + rx_sdr)"
        ;;

    # ------------------------------------------------------------------
    4)  echo "Skipping SDR driver installation." ;;

    # ------------------------------------------------------------------
    5)  echo ""
        echo "Setting up RigExpert Fobos SDR..."
        [ -f "$PHANTOM_DIR/setup-fobos.sh" ] \
            || die "setup-fobos.sh not found in $PHANTOM_DIR — is the source tree complete?"
        require_github
        # One script for every distribution — it picks apt / dnf / pacman /
        # zypper itself — and a station installed earlier can run it alone.
        run_logged bash "$PHANTOM_DIR/setup-fobos.sh"
        green "✅ Fobos SDR installed (SoapyFobosSDR + rx_sdr + cf32_to_real)"
        ;;

    # ------------------------------------------------------------------
    6)  echo ""
        echo "Setting up Airspy HF+..."
        [ -f "$PHANTOM_DIR/setup-airspyhf.sh" ] \
            || die "setup-airspyhf.sh not found in $PHANTOM_DIR — is the source tree complete?"
        require_github
        # One script for every distribution — it picks apt / dnf / pacman /
        # zypper itself — and a station installed earlier can run it alone.
        run_logged bash "$PHANTOM_DIR/setup-airspyhf.sh"
        green "✅ Airspy HF+ installed (libairspyhf + SoapyAirspyHF + rx_sdr)"
        ;;

    # ------------------------------------------------------------------
    7)  echo ""
        echo "Setting up HackRF One..."
        [ -f "$PHANTOM_DIR/setup-hackrf.sh" ] \
            || die "setup-hackrf.sh not found in $PHANTOM_DIR — is the source tree complete?"
        # One script for every distribution — it picks apt / dnf / pacman /
        # zypper itself — and a station installed earlier can run it alone.
        run_logged bash "$PHANTOM_DIR/setup-hackrf.sh"
        green "✅ HackRF One installed (hackrf_transfer + udev rule)"
        ;;

    # ------------------------------------------------------------------
    *)  die "Invalid option '$option'." ;;

esac

case $option in
    1) step_state OK "RX888 MkII / RX888"
       component "SDR driver" "RX888 MkII — rx888_stream in ~/.cargo/bin" ;;
    2) step_state OK "RTL-SDR"
       component "SDR driver" "RTL-SDR — $([[ ${rtlsdr_v4:-n} =~ ^[Yy]$ ]] && echo 'Blog V4 built from source' || echo 'distro packages')" ;;
    3) step_state OK "SDRplay RSP1A"
       component "SDR driver" "SDRplay RSP1A — libmirisdr-5 + SoapyMiri + rx_sdr, udev rule, msi2500 blacklisted" ;;
    5) step_state OK "RigExpert Fobos SDR"
       component "SDR driver" "Fobos SDR — SoapyFobosSDR + rx_sdr + cf32_to_real, udev rule" ;;
    6) step_state OK "Airspy HF+"
       component "SDR driver" "Airspy HF+ — libairspyhf + SoapyAirspyHF + rx_sdr, udev rule" ;;
    7) step_state OK "HackRF One"
       component "SDR driver" "HackRF One — hackrf_transfer from the distribution, udev rule" ;;
    4) step_state SKIPPED "you chose to install a driver later"
       component "SDR driver" "none — install one by hand before going on air"
       warn "No SDR driver was installed. The receiver cannot see hardware until you install one." ;;
esac
echo ""

# ------------------------------------------------------------------------------
# Site information
# ------------------------------------------------------------------------------

step "Site information" "⌨️  YOU WILL EDIT frontend/site_information.json"
SITE_INFO_PATH="$PHANTOM_DIR/frontend/site_information.json"
[ -f "$SITE_INFO_PATH" ] \
    || die "site_information.json not found at $SITE_INFO_PATH — is the source tree complete?"

echo "You will now edit your site information (callsign, location, hardware, etc.)."
echo ""
if confirm PHANTOM_SITE_EDIT y n "Open it in an editor now?"; then
    if command -v nano >/dev/null 2>&1; then
        VISUAL_EDITOR="nano"
    elif command -v vim >/dev/null 2>&1; then
        VISUAL_EDITOR="vim"
    elif command -v vi >/dev/null 2>&1; then
        VISUAL_EDITOR="vi"
    else
        echo "No editor found — installing nano..."
        run $SUDO dnf install -y nano
        VISUAL_EDITOR="nano"
    fi

    [ "$VISUAL_EDITOR" = "nano" ] && echo "(Ctrl+X → Y → ENTER to save and exit)"
    echo ""
    "$VISUAL_EDITOR" "$SITE_INFO_PATH" || warn "Editor exited non-zero — verify the file manually."
    echo ""
    green "✅ Site information saved: $SITE_INFO_PATH"
    component "Site information" "edited — $SITE_INFO_PATH"
else
    step_state SKIPPED "not edited"
    warn "Site information was not edited — do it before going on air: nano $SITE_INFO_PATH"
    component "Site information" "NOT edited — still the shipped defaults"
fi
echo ""

# ------------------------------------------------------------------------------
# Frontend dependencies and build
# ------------------------------------------------------------------------------

step "Installing frontend dependencies" "npm — several minutes, no input needed"
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
    # Match major version 9 in any semver range form (^9, ~9, >=9.0.0, 9, 9.x, etc.)
    if cur and re.search(r'(?:^|[^\d])9(?:\.|$|\s|x)', cur) and has_eslint_ecosystem:
        pkg[section]['eslint'] = '^8.0.0'
        print('   eslint: reverted ^9 -> ^8.0.0 (eslint-config/plugin packages require ^8)')

# Force safe versions for deprecated/vulnerable transitive packages.
#   rimraf ^4  - rimraf@2/3 are EOL
#   glob  ^10  - glob@7 has a published ReDoS security advisory
# ESLint 8 deprecation is a warning only, not a security issue — not touched.
# inflight has no API-compatible replacement — not touched.
#
#   @swc/core 1.15.33 — pinned because a fresh install otherwise fails.
#     vite-plugin-top-level-await@1.6.0 asks for "@swc/core": "^1.12.14", so a
#     clean install resolves 1.16.0, whose printSync() rejects the AST the
#     plugin hands it:
#
#       [vite-plugin-top-level-await] missing field `type`
#           at Compiler.printSync (node_modules/@swc/core/index.js:257:29)
#       error during build:  ->  build-all.sh reports "❌ Failed: Default"
#
#     The backend is already built by then, so the install looks half-done: a
#     spectrumserver binary and no frontend/dist/ to serve. Nothing about it is
#     distro-specific — it is npm picking the newest @swc/core, which is why
#     every installer carries this pin. frontend/package.json carries it too,
#     for people who build by hand or with recompile.sh. Verified in a clean
#     container: 1.16.0 fails, 1.15.33 builds every variant. Revisit when
#     vite-plugin-top-level-await tracks the newer SWC AST.
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
run npm install --no-audit --no-fund --save-dev \
    vite@5.4.16 \
    "@sveltejs/vite-plugin-svelte@^3.1.2" \
    "@vitejs/plugin-legacy@^5.4.2" \
    "svelte@^4.2.20"

echo ""
echo "Installing remaining dependencies from package.json..."
run npm install --no-audit --no-fund

echo ""
echo "Installing Opus WASM decoder..."
run npm install --no-audit --no-fund @wasm-audio-decoders/opus-ml

echo ""
echo "Installing emoji picker..."
run npm install --no-audit --no-fund emoji-picker-element

echo ""
echo "Installing Socket.IO client (FreeDV Reporter live feed)..."
run npm install --no-audit --no-fund socket.io-client

# Run audit fix WITHOUT --force so only safe (non-breaking) patches are
# applied.  --force can silently pull in Vite 6/7/8 or Svelte 5 and break
# the build; we deliberately avoid it here.
echo ""
echo "Running safe audit fix..."
npm audit fix 2>/dev/null || true
# Re-install after audit fix to ensure the lock file is consistent.
run npm install --no-audit --no-fund

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

step "Building all frontend versions" "build-all.sh — no input needed"
BUILD_SCRIPT="$PHANTOM_DIR/frontend/build-all.sh"

if [ ! -f "$BUILD_SCRIPT" ]; then
    yellow "⚠️  build-all.sh not found at $BUILD_SCRIPT — skipping."
    yellow "    Run manually once it is in place:"
    yellow "      cd $PHANTOM_DIR/frontend && ./build-all.sh"
else
    chmod +x "$BUILD_SCRIPT"
    cd "$PHANTOM_DIR/frontend"

    if ./build-all.sh; then
        green "✅ All frontend versions built: $PHANTOM_DIR/frontend/dist/"
        component "Frontend" "built — $(find "$PHANTOM_DIR/frontend/dist" -type f 2>/dev/null | wc -l) files in frontend/dist/"
    else
        yellow "⚠️  build-all.sh exited with errors — check output above."
        yellow "    Re-run: cd $PHANTOM_DIR/frontend && ./build-all.sh"
    fi

    cd - > /dev/null
fi
echo ""

# ------------------------------------------------------------------------------
# OpenCL (optional)
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

step "OpenCL support (optional)" "⌨️  YOU WILL BE ASKED whether to install it"
echo "OpenCL can accelerate FFT processing on Intel/AMD/NVIDIA hardware."
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
    if confirm PHANTOM_OPENCL y y "Install OpenCL support?"; then install_opencl=y; else install_opencl=n; fi
    if [[ ${install_opencl:-y} =~ ^[Nn] ]]; then
        install_opencl="n"
    else
        install_opencl="y"
    fi
fi

if [[ $install_opencl =~ ^[Yy]$ ]]; then
    echo ""
    echo "Installing OpenCL base packages..."
    run $SUDO dnf install -y ocl-icd ocl-icd-devel opencl-headers clinfo

    cpu_vendor=$(lscpu | awk '/Vendor ID/{print $3}')

    case "$cpu_vendor" in
        GenuineIntel)
            echo "Intel CPU detected."
            echo ""
            yellow "⚠️  Intel Compute Runtime on Fedora requires manual steps."
            echo "   Option 1 — Intel CPU with integrated GPU:"
            echo "     sudo dnf install -y intel-opencl"
            echo "   Option 2 — CPU-only NEO driver (RPM packages):"
            echo "     https://github.com/intel/compute-runtime/releases"
            echo "     Download the .rpm files for your Fedora version and install with dnf."
            echo ""
            pause "Press ENTER once the Intel runtime is installed..."
            ;;
        AuthenticAMD)
            yellow "AMD CPU/GPU detected."
            yellow "   Install ROCm OpenCL: sudo dnf install -y rocm-opencl"
            ;;
        *)
            yellow "Unknown CPU vendor '$cpu_vendor'."
            yellow "   For NVIDIA: install the CUDA toolkit from https://developer.nvidia.com/cuda-downloads"
            ;;
    esac

    echo ""
    echo "Testing OpenCL installation (as current user)..."
    if clinfo > /dev/null 2>&1; then
        green "✅ OpenCL device(s) detected"
        # Devices already visible — no reboot needed
    else
        yellow "⚠️  clinfo found no devices — reboot and run 'clinfo' to verify."
        NEEDS_REBOOT=true
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
    step "Admin panel (optional)" "⌨️  YOU WILL BE ASKED — and setup asks its own questions"
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
    if confirm PHANTOM_ADMIN y n "Install the admin panel now?"; then install_admin=y; else install_admin=n; fi

    if [[ ! ${install_admin:-y} =~ ^[Nn] ]]; then
        # setup_admin.sh pulls its Python libraries with pip, which a minimal
        # system does not always have. Not fatal: setup_admin.sh prints the
        # manual command if this fails.
        if ! command -v pip3 >/dev/null 2>&1; then
            echo ""
            echo "[*] Installing pip..."
            $SUDO dnf install -y python3-pip || yellow "   ⚠️  Could not install pip — setup will tell you what to run"
        fi
        chmod +x "$PHANTOM_DIR/setup_admin.sh" "$PHANTOM_DIR/manage_admin.sh" 2>/dev/null || true
        echo ""
        if ( cd "$PHANTOM_DIR" && ./setup_admin.sh ); then
            ADMIN_INSTALLED=true
            component "Admin panel" "installed"
        else
            yellow "⚠️  Admin panel setup did not finish — run ./setup_admin.sh again later"
        fi
    else
        echo "Skipping the admin panel — run ./setup_admin.sh later if you change your mind."
    fi
    echo ""
fi

# ------------------------------------------------------------------------------
# WebSDR diversity relay
# ------------------------------------------------------------------------------

if [ -f "$PHANTOM_DIR/setup_websdr_relay.sh" ]; then
    step "WebSDR diversity relay (optional)" "⌨️  YOU WILL BE ASKED — and setup asks its own questions"
    echo ""
    echo "Receive diversity combines this receiver with a second one to ride"
    echo "through fading. PhantomSDR+, KiwiSDR and UberSDR partners work"
    echo "straight from the browser. A WebSDR (websdr.org software) does not:"
    echo "it refuses connections whose Origin header is not its own site, and"
    echo "no browser lets a script change that header."
    echo ""
    echo "This small relay makes those connections from the server instead."
    echo "It names your station to the WebSDR operator and caps how many"
    echo "sessions it will open to any one site."
    echo ""
    yellow "   Setup asks for a port and for your callsign, and can install a"
    yellow "   systemd service. That port must be forwarded on your router, or"
    yellow "   only listeners on your own network will be able to use it."
    yellow "   Answer 'n' to skip — ./setup_websdr_relay.sh works any time."
    echo ""
    if confirm PHANTOM_WEBSDR_RELAY y n "Install the WebSDR diversity relay now?"; then install_relay=y; else install_relay=n; fi

    if [[ ! ${install_relay:-y} =~ ^[Nn] ]]; then
        chmod +x "$PHANTOM_DIR/setup_websdr_relay.sh" 2>/dev/null || true
        echo ""
        if ( cd "$PHANTOM_DIR" && ./setup_websdr_relay.sh ); then
            RELAY_INSTALLED=true
            component "WebSDR relay" "installed"
        else
            yellow "⚠️  Relay setup did not finish — run ./setup_websdr_relay.sh again later"
        fi
    else
        echo "Skipping the WebSDR relay — the other three diversity partners work without it."
    fi
    echo ""
fi

# ------------------------------------------------------------------------------
# RADE / FreeDV sidecar
# ------------------------------------------------------------------------------

if [ -f "$PHANTOM_DIR/install_rade.sh" ]; then
    step "RADE / FreeDV decoder (optional)" "⌨️  YOU WILL BE ASKED — and setup asks its own questions"
    echo ""
    echo "RADE (Radio Autoencoder) decodes FreeDV RADE V1 voice in the browser."
    echo "It builds the radae repository into ~/radae and runs as a small Python"
    echo "sidecar on port 8074, controlled by ./rade.sh."
    echo ""
    yellow "   Installed by default — answer 'n' to skip it."
    yellow "   Packages come from apt / pacman / dnf / zypper, whichever this"
    yellow "   system has; torch is pulled as a CPU wheel with pip."
    echo ""
    if confirm PHANTOM_RADE y n "Install RADE now?"; then install_rade=y; else install_rade=n; fi

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
                PHANTOM_SKIP_ADMIN_OFFER=1 ./install_rade.sh ); then
            RADE_INSTALLED=true
            component "RADE / FreeDV" "installed"
            green "✅ RADE installed"
        else
            yellow "⚠️  RADE setup did not finish — run ./install_rade.sh again later"
        fi
    else
        echo "Skipping RADE — run ./install_rade.sh later if you change your mind."
    fi
    echo ""
fi

# ------------------------------------------------------------------------------
# Statistics server
# ------------------------------------------------------------------------------

if [ -f "$PHANTOM_DIR/install-stats-server.sh" ]; then
    step "System statistics server (optional)" "⌨️  YOU WILL BE ASKED — and setup asks its own questions"
    echo ""
    echo "A small Node.js service that publishes this machine's CPU, RAM and"
    echo "temperature readings for the receiver page to display."
    echo ""
    yellow "   Setup asks for an install directory, a port and this server's"
    yellow "   address, and can register it as a systemd service."
    yellow "   Installed by default — answer 'n' to skip it."
    echo ""
    if confirm PHANTOM_STATS y n "Install the statistics server now?"; then install_stats=y; else install_stats=n; fi

    if [[ ! ${install_stats:-y} =~ ^[Nn] ]]; then
        chmod +x "$PHANTOM_DIR/install-stats-server.sh" 2>/dev/null || true
        echo ""
        if ( cd "$PHANTOM_DIR" \
             && PHANTOM_SKIP_ADMIN_OFFER=1 ./install-stats-server.sh ); then
            STATS_INSTALLED=true
            component "Statistics server" "installed"
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

step "Re-patching websocketpp and preparing the marker list" "no input needed"
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
# Kiwi client emulation (optional)
# ------------------------------------------------------------------------------
# kiwi_install.sh patches client.h, signal.cpp, waterfall.cpp, spectrumserver.h/
# .cpp, websocket.cpp and http.cpp so PhantomSDR-Plus also answers the KiwiSDR
# protocol (SND + W/F) — retuning, audio and an S-meter recognised by existing
# Kiwi clients (AetherSDR, kiwiclient...). It only touches source, so it runs
# here, one step before the final rebuild that compiles its changes in.
#
# kiwi_install.sh insists on finding kiwi_bridge.h in ITS OWN directory — a
# guard against patching against the wrong header version — and copies it into
# src/ itself. So the only prerequisite is a kiwi_bridge.h somewhere in the
# tree: src/ if an earlier run already staged one, otherwise beside this script
# or at the top of the source tree. Whichever copy is found is placed next to
# kiwi_install.sh before it runs, so its own check passes.
#
# Neither file is part of every snapshot of the tree. Missing both is a normal
# state, not a fault, so it skips quietly; kiwi_install.sh present WITHOUT the
# header is a broken pair and does warn.

step "Kiwi client emulation (optional)" "⌨️  YOU WILL BE ASKED — patches source for the KiwiSDR protocol"

KIWI_INSTALL_SRC=""
for cand in "$SCRIPT_DIR/kiwi_install.sh" "$PHANTOM_DIR/kiwi_install.sh"; do
    [ -f "$cand" ] && { KIWI_INSTALL_SRC="$cand"; break; }
done

KIWI_BRIDGE_SRC=""
for cand in "$PHANTOM_DIR/src/kiwi_bridge.h" "$SCRIPT_DIR/kiwi_bridge.h" \
            "$PHANTOM_DIR/kiwi_bridge.h"; do
    [ -f "$cand" ] && { KIWI_BRIDGE_SRC="$cand"; break; }
done

if [ -n "$KIWI_INSTALL_SRC" ] && [ -n "$KIWI_BRIDGE_SRC" ]; then
    echo ""
    echo "Adds a KiwiSDR-protocol bridge (SND + W/F) so Kiwi clients such as"
    echo "AetherSDR or kiwiclient can connect to this receiver directly —"
    echo "including retuning and an S-meter."
    echo ""
    yellow "   Patches src/client.h, signal.cpp, waterfall.cpp, spectrumserver.*,"
    yellow "   websocket.cpp and http.cpp; each original file is backed up first."
    yellow "   Installed by default — answer 'n' to skip it."

    if confirm PHANTOM_KIWI y n "Install Kiwi client emulation now?"; then
        [ "$KIWI_INSTALL_SRC" -ef "$PHANTOM_DIR/kiwi_install.sh" ] \
            || cp "$KIWI_INSTALL_SRC" "$PHANTOM_DIR/kiwi_install.sh"
        chmod +x "$PHANTOM_DIR/kiwi_install.sh" 2>/dev/null || true

        # kiwi_install.sh looks for kiwi_bridge.h beside itself (see above).
        # Remember whether that copy is ours, so the root of the tree can be
        # left as it was found.
        KIWI_STAGED_HDR=false
        if ! [ "$KIWI_BRIDGE_SRC" -ef "$PHANTOM_DIR/kiwi_bridge.h" ]; then
            cp "$KIWI_BRIDGE_SRC" "$PHANTOM_DIR/kiwi_bridge.h"
            KIWI_STAGED_HDR=true
        fi

        echo ""
        # Captured, not just run: this step only warns, so without the log the
        # report said "kiwi_install.sh did not finish" and nothing about why,
        # while the reason had scrolled off the terminal hours earlier.
        KIWI_LOG="$(mktemp "${TMPDIR:-/tmp}/phantom-kiwi-XXXXXX.log")"
        if ( cd "$PHANTOM_DIR" && ./kiwi_install.sh ) 2>&1 | tee "$KIWI_LOG"; then
            rm -f "$KIWI_LOG"
            KIWI_INSTALLED=true
            # Our staged copy has served its purpose; kiwi_install.sh has put
            # the real one in src/. On failure it is left in place, because the
            # manual re-run advised below needs it.
            if [ "$KIWI_STAGED_HDR" = true ]; then
                rm -f "$PHANTOM_DIR/kiwi_bridge.h"
            fi
            green "✅ Kiwi client emulation installed"
            component "Kiwi client emulation" \
                "patched, [kiwi_emulation] enabled in the config .toml files — /kiwi/<id>/SND and /kiwi/<id>/W/F"
        else
            step_state PARTIAL "kiwi_install.sh did not finish"
            # kiwi_install.sh patches by exact text match and stops on the first
            # anchor it cannot find, naming the file — which is the one line
            # worth carrying into the report.
            kiwi_tail=""
            [ -s "$KIWI_LOG" ] && kiwi_tail="
       Last lines of its output:
$(tail -n 12 "$KIWI_LOG" | sed 's/^/       | /')"
            warn "kiwi_install.sh did not finish — run it by hand: cd $PHANTOM_DIR && ./kiwi_install.sh
       Nothing is half-patched: it stops on the first anchor it cannot find,
       without touching that file, and the originals are in
       $PHANTOM_DIR/backup_kiwi_bridge_*/${kiwi_tail}"
            component "Kiwi client emulation" "FAILED — run ./kiwi_install.sh by hand"
        fi
    else
        echo "Skipping Kiwi client emulation — run ./kiwi_install.sh later if you change your mind."
        step_state SKIPPED "you declined"
        component "Kiwi client emulation" "not installed — ./kiwi_install.sh installs it later"
    fi
elif [ -n "$KIWI_INSTALL_SRC" ]; then
    step_state SKIPPED "kiwi_bridge.h not found"
    warn "kiwi_install.sh is here but kiwi_bridge.h is not — skipping Kiwi client emulation."
    component "Kiwi client emulation" "not installed — kiwi_bridge.h missing from src/ and the source tree"
else
    step_state SKIPPED "kiwi_install.sh not part of this tree"
    echo "kiwi_install.sh is not part of this tree — nothing to install."
    component "Kiwi client emulation" "not installed — kiwi_install.sh not shipped with this tree"
fi
echo ""

# ------------------------------------------------------------------------------
# Final rebuild
# ------------------------------------------------------------------------------
# Last action: one full rebuild, so the backend picks up the patched headers and
# the frontend is built from whatever RADE and the admin panel just added.

step "Final rebuild" "⌨️  YOU WILL BE ASKED — recompile.sh then asks three questions"
echo ""
echo "This rebuilds everything one last time. Answer:"
echo "   [3] Both backend and frontend  →  your default variant  →  [1] build-all.sh"
echo ""

# recompile.sh is a menu with no flags: it reads three answers from stdin and
# exits the moment stdin is at EOF. An unattended run therefore fell straight
# through it, printed "did not finish", and left the backend un-rebuilt — while
# the step still reported OK, because nothing here set the step state. Mirror
# install.sh: honour PHANTOM_RECOMPILE, do the work directly when unattended,
# and report the real outcome either way.
if confirm PHANTOM_RECOMPILE y y "Run the final rebuild now?"; then
    if [ "$PHANTOM_NONINTERACTIVE" = "1" ]; then
        # The frontend was already built by build-all.sh earlier, so only the
        # backend needs recompiling against the patched headers.
        echo "Unattended — rebuilding the backend directly instead of recompile.sh."
        if ( cd "$PHANTOM_DIR" && meson compile -j2 -C build ); then
            green "✅ Final rebuild finished"
            component "Final rebuild" "backend recompiled (unattended path)"
        else
            step_state PARTIAL "backend rebuild failed"
            warn "Final backend rebuild failed — see the output above."
            component "Final rebuild" "FAILED — run ./recompile.sh by hand"
        fi
    elif [ -f "$PHANTOM_DIR/recompile.sh" ]; then
        chmod +x "$PHANTOM_DIR/recompile.sh" 2>/dev/null || true
        if ( cd "$PHANTOM_DIR" && ./recompile.sh ); then
            green "✅ Final rebuild finished"
            component "Final rebuild" "recompile.sh completed"
        else
            step_state PARTIAL "recompile.sh did not finish"
            warn "recompile.sh did not finish — run it manually: cd $PHANTOM_DIR && ./recompile.sh"
            component "Final rebuild" "FAILED — run ./recompile.sh by hand"
        fi
    else
        step_state SKIPPED "recompile.sh not present"
        warn "recompile.sh not found in $PHANTOM_DIR — skipping the final rebuild"
        component "Final rebuild" "skipped — recompile.sh missing from the tree"
    fi
else
    echo "Skipping the final rebuild — run ./recompile.sh later if you need it."
    step_state SKIPPED "you declined"
    component "Final rebuild" "declined — ./recompile.sh runs it later"
fi
echo ""

# ------------------------------------------------------------------------------
# Summary
# ------------------------------------------------------------------------------

component "Reboot required" "$([ "$NEEDS_REBOOT" = true ] \
    && echo 'YES — udev rules and/or OpenCL drivers take effect after a reboot' \
    || echo 'no')"

step "Installation summary" ""
restart_stopped_phantom
echo ""
green "✅ System packages:"
echo "   • Node.js $(node --version) / npm $(npm --version)"
echo "   • Build tools (gcc, cmake, meson, ninja)"
echo "   • DSP libs (FFTW3, libopus, libliquid)"
echo "   • Network libs (libwebsocketpp, curlpp)"
echo "   • Compression libs (zlib, zstd, FLAC)"
echo "   • Boost libraries"
[[ $install_opencl =~ ^[Yy]$ ]] && echo "   • OpenCL"

echo ""
green "✅ Backend:"
echo "   • Compiled: $PHANTOM_DIR/build/"

echo ""
case $option in
    1)  green "✅ SDR hardware: RX888 MkII / RX888"
        echo "   • rx888_stream: installed to ~/.cargo/bin/"
        yellow "   ⚠️  Open a new terminal (or 'source ~/.cargo/env') before using rx888_stream"
        ;;
    2)  green "✅ SDR hardware: RTL-SDR"
        [[ ${rtlsdr_v4:-n} =~ ^[Yy]$ ]] \
            && echo "   • RTL-SDR Blog V4 drivers + udev rules installed" \
            || echo "   • Standard RTL-SDR drivers installed"
        ;;
    3)  green "✅ SDR hardware: SDRplay RSP1A (libmirisdr-5 + SoapyMiri + rx_sdr)" ;;
    5)  green "✅ SDR hardware: RigExpert Fobos SDR (SoapyFobosSDR + rx_sdr + cf32_to_real)" ;;
    6)  green "✅ SDR hardware: Airspy HF+ (libairspyhf + SoapyAirspyHF + rx_sdr)" ;;
    7)  green "✅ SDR hardware: HackRF One (hackrf_transfer)" ;;
    4)  yellow "⚠️  SDR hardware: skipped — install driver manually" ;;
esac

echo ""
green "✅ Frontend:"
echo "   • Vite 5.4.16 / Svelte 4"
echo "   • Site information: $SITE_INFO_PATH"
[ -d "$PHANTOM_DIR/frontend/dist" ] \
    && echo "   • Built: $PHANTOM_DIR/frontend/dist/"

if [ "$ADMIN_INSTALLED" = true ]; then
    echo ""
    green "✅ Admin panel:"
    echo "   • Configured — password is 'admin', change it on first login"
    echo "   • Manual: docs/ADMIN_PANEL_SETUP.md"
fi

if [ "$RELAY_INSTALLED" = true ]; then
    echo ""
    green "✅ WebSDR diversity relay:"
    echo "   • Settings in websdr_relay.json — port, caps, and who you identify as"
    echo "   • FORWARD ITS TCP PORT on your router, or only listeners on your own"
    echo "     network can use it: browsers reach the relay directly, not through"
    echo "     the receiver"
    echo "   • Manual: docs/RECEIVE_DIVERSITY.md"
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

if [ "$KIWI_INSTALLED" = true ]; then
    echo ""
    green "✅ Kiwi client emulation:"
    echo "   • Served at /kiwi/<id>/SND and /kiwi/<id>/W/F, same host/port as usual"
    echo "   • Debug log: /tmp/kiwi_retune.log"
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
    3) echo "      nano $PHANTOM_DIR/config-rsp1a.toml" ;;
    5) echo "      nano $PHANTOM_DIR/config-fobos-hf.toml" ;;
    6) echo "      nano $PHANTOM_DIR/config-airspyhf.toml" ;;
    7) echo "      nano $PHANTOM_DIR/config-hackrf.toml" ;;
    4) echo "      nano $PHANTOM_DIR/<your_sdr>.toml" ;;
esac

echo ""
echo "🚀 2. Start the server:"
echo "      cd $PHANTOM_DIR"
case $option in
    1) echo "      ./build/spectrumserver rx888.toml" ;;
    2) echo "      ./build/spectrumserver rtlsdr.toml" ;;
    3) echo "      ./start-rsp1a.sh" ;;
    5) echo "      ./start-fobos-hf.sh   (HF1/HF2, 0-25 MHz)  or  ./start-fobos.sh   (RF)" ;;
    6) echo "      ./start-airspyhf.sh" ;;
    7) echo "      ./start-hackrf.sh" ;;
    4) echo "      ./build/spectrumserver <your_sdr>.toml" ;;
esac

echo ""
echo "🌐 3. Open in your browser (replace PORT with the port in your .toml):"
if [ -d "$PHANTOM_DIR/frontend/dist" ]; then
    echo "      http://localhost:PORT/              → Desktop page"
    echo "      http://localhost:PORT/mobile/       → Mobile page"
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
    echo "      Start / stop it with:  sudo systemctl start|stop phantomsdr-admin"
fi

if [ "$KIWI_INSTALLED" = true ]; then
    KIWI_STEP_NO=4
    [ "$ADMIN_INSTALLED" = true ] && KIWI_STEP_NO=5
    echo ""
    echo "📡 ${KIWI_STEP_NO}. Point a Kiwi client (AetherSDR, kiwiclient...) at this receiver —"
    echo "      same host/port as above, paths /kiwi/<id>/SND and /kiwi/<id>/W/F."
fi

echo ""
echo "📄 A full report of this run has been written to:"
echo "      ${PHANTOM_DIR}/install.txt"
echo "   It lists every step, everything installed, and every warning."
echo ""
echo "📚 Docs / issues: https://github.com/sv1btl/PhantomSDR-Plus"

# ------------------------------------------------------------------------------
# Reboot warning
# ------------------------------------------------------------------------------

if [ "$NEEDS_REBOOT" = true ]; then
    echo ""
    FRAME_C='\033[33m'
    ftop
    fline ""
    fline "          ⚠️  SYSTEM REBOOT REQUIRED" 0
    fline ""
    if [[ ${rtlsdr_v4:-n} =~ ^[Yy]$ ]]; then
        fline "     RTL-SDR V4 udev rules take effect after reboot."
    fi
    if [[ ${install_opencl:-n} =~ ^[Yy]$ ]]; then
        fline "     OpenCL drivers take effect after reboot."
    fi
    fline ""
    fline "     Run:  sudo reboot"
    fline ""
    fbot
    FRAME_C='\033[34m'
    echo ""
    echo ""
fi

# ------------------------------------------------------------------------------
# Done
# ------------------------------------------------------------------------------

step_close                       # verdict line of the final step

print_step_table

echo ""
ftop
fline ""
fline "            🎉  INSTALLATION COMPLETE  🎉" 2
fline "                 PhantomSDR-Plus WebSDR"
fline ""
fbot
echo ""