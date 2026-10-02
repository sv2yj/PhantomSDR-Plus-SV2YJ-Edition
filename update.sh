#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
#  PhantomSDR-Plus  –  update.sh
#  Update an installed instance from the GitHub tree, without touching the
#  files that make it THIS site rather than any other site.
#
#  It does not use git. The published tree is downloaded as a tarball and
#  compared file by file against what is on disk, so it works exactly the same
#  whether this instance was cloned, unzipped from update.zip, or copied off a
#  USB stick — and it does not care that the local tree has no matching
#  history.
#
#  Usage:
#    ./update.sh                   report what would change; writes NOTHING
#    ./update.sh --apply           actually update, asking about your own edits
#    ./update.sh --apply --yes     unattended; anything you edited is KEPT
#    ./update.sh --ref v4.1.0      a tag, branch or commit instead of main
#    ./update.sh --apply --prune   also offer to delete files GitHub removed
#    ./update.sh --list-excludes   print the exclusion rules as resolved here
#    ./update.sh --restore LAST    put back the files the last run overwrote
#    ./update.sh --restore 20260923-164530   ... from that run
#    ./update.sh --verbose         list every file, not just the first 40
#
#  A tree that holds a file called .update-source-of-truth is the tree the
#  published version is built FROM, so --apply refuses to run in it. Reporting
#  still works, and there it lists what has not been published yet.
#
#  Every file an update overwrites is first saved into a dated archive under
#  update-backups/ — a plain visible folder, not a hidden one, so it can be
#  found in a file manager and copied off the machine as one file.
#
#  Exit status of a report run: 0 = already up to date, 10 = updates pending.
#  (So `./update.sh || notify-me` works from cron.)
#
#  Env overrides (all optional, same contract as install.sh):
#    PHANTOM_NONINTERACTIVE=1      never ask; use the unattended defaults
#    PHANTOM_STOP_SERVICES=y|n     stop the receiver + panel before writing
#    PHANTOM_RECOMPILE=y|n         run recompile.sh afterwards
#    UPDATE_REF=main               same as --ref
# ─────────────────────────────────────────────────────────────────────────────

set -e
set -o pipefail

if [ -z "${BASH_VERSINFO[0]}" ] || [ "${BASH_VERSINFO[0]}" -lt 4 ]; then
    echo "This script needs bash 4 or newer (it uses associative arrays)." >&2
    exit 1
fi

# ------------------------------------------------------------------------------
# Where we are, and what we talk to
# ------------------------------------------------------------------------------
# The instance is wherever this script lives — the same rule the start-*.sh
# launchers use, so a second clone updates itself and not the one on air.
SCRIPT_PATH="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/$(basename "${BASH_SOURCE[0]}")"
# When we have re-executed ourselves from a copy in /tmp (see "Re-exec" below),
# the running file is NOT in the instance — the instance is where the original
# was, and that path is handed over in the environment.
[ -n "${PHANTOM_UPDATE_REEXEC:-}" ] && SCRIPT_PATH="$PHANTOM_UPDATE_REEXEC"
PHANTOM_DIR="$(dirname "$SCRIPT_PATH")"
# Canonical form, for deciding whether a running process belongs to THIS
# instance: symlinks and /home/../home spellings must not make the same
# directory look like a different one.
PHANTOM_DIR_REAL="$(cd "$PHANTOM_DIR" 2>/dev/null && pwd -P)" || PHANTOM_DIR_REAL="$PHANTOM_DIR"

REPO_SLUG="${UPDATE_REPO:-sv1btl/PhantomSDR-Plus}"
REF="${UPDATE_REF:-main}"

STATE_DIR="$PHANTOM_DIR/.update-state"
MANIFEST="$STATE_DIR/manifest.sha256"
# Deliberately NOT a dotted name. A backup nobody can find is not a backup:
# a leading dot hides it from `ls`, from every file manager, and from the
# sysop who is looking for it with the site off the air. Runs before
# 2026-09-22 wrote into the hidden .update-backups/, so that is still read.
BACKUP_ROOT="$PHANTOM_DIR/update-backups"
LEGACY_BACKUP_ROOT="$PHANTOM_DIR/.update-backups"
KEEP_BACKUPS=3
EXCLUDE_FILE="$PHANTOM_DIR/update-exclude.txt"

MODE="check"          # check | apply | list-excludes | restore
ASSUME_YES=false
PRUNE=false
VERBOSE=false
RESTORE_ARG=""

# ------------------------------------------------------------------------------
# Output helpers — deliberately the same look and the same prompt contract as
# install.sh, so the two scripts do not feel like they came from two projects.
# ------------------------------------------------------------------------------
red()    { echo -e "\e[31m$*\e[0m"; }
green()  { echo -e "\e[32m$*\e[0m"; }
yellow() { echo -e "\e[33m$*\e[0m"; }
blue()   { echo -e "\e[34m$*\e[0m"; }
grey()   { echo -e "\e[90m$*\e[0m"; }

STEP_W=70
FRAME_C='\033[34m'
frepeat() { local i out=""; for ((i = 0; i < $2; i++)); do out+="$1"; done; printf '%s' "$out"; }
fline() {
    local text="${1:-}" extra="${2:-0}" pad
    if (( ${#text} + extra > STEP_W )); then text="${text:0:$((STEP_W - 1 - extra))}…"; fi
    pad=$(( STEP_W - ${#text} - extra )); (( pad < 0 )) && pad=0
    printf '%b║\033[0m%s%s%b║\033[0m\n' "$FRAME_C" "$text" "$(frepeat ' ' $pad)" "$FRAME_C"
}
ftop() { printf '%b╔%s╗\033[0m\n' "$FRAME_C" "$(frepeat '═' $STEP_W)"; }
fbot() { printf '%b╚%s╝\033[0m\n' "$FRAME_C" "$(frepeat '═' $STEP_W)"; }
banner() { echo ""; ftop; fline "  $1"; fbot; }

die()  { red "❌ Fatal: $*"; exit 1; }
warn() { yellow "⚠️  $*"; }

# stdin is not a terminal (piped from curl, run from cron): asking would eat the
# wrong input, so fall back to the unattended defaults exactly as install.sh does.
if [ "${PHANTOM_NONINTERACTIVE:-}" != "1" ] && [ ! -t 0 ]; then
    PHANTOM_NONINTERACTIVE=1
fi

prompt_fence() {
    echo ""
    yellow "  ┌──────────────────────────────────────────────────────────────────┐"
    yellow "  │  ⌨️   YOUR INPUT IS NEEDED                                        │"
    yellow "  └──────────────────────────────────────────────────────────────────┘"
}

# confirm <ENV_NAME> <default-interactive> <default-unattended> <question>
confirm() {
    local envname="$1" def="$2" def_ni="$3" q="$4"
    local override="${!envname:-}" hint word ans

    if [ -n "$override" ]; then
        echo ""; echo "  ❓ $q"
        [[ $override =~ ^[Yy] ]] && word="Yes" || word="No"
        echo "     → ${word} (from ${envname}=${override})"
        [[ $override =~ ^[Yy] ]]; return
    fi
    if [ "${PHANTOM_NONINTERACTIVE:-}" = "1" ]; then
        echo ""; echo "  ❓ $q"
        [[ $def_ni =~ ^[Yy] ]] && word="Yes" || word="No"
        echo "     → ${word} (unattended default; set ${envname}=y|n to choose)"
        [[ $def_ni =~ ^[Yy] ]]; return
    fi
    if [ "$def" = "y" ]; then hint="\033[1;32mY\033[0m/n"; word="Yes"
    else                      hint="y/\033[1;31mN\033[0m"; word="No"; fi
    prompt_fence
    printf '  ❓ %s [%b]  \033[90m(ENTER = %s)\033[0m: ' "$q" "$hint" "$word"
    # EOF (a closed stdin part-way through) must not kill the run under set -e;
    # it means "no answer", which is what the default is for.
    read -r ans || true
    ans="${ans:-$def}"
    [[ $ans =~ ^[Yy] ]]
}

# ------------------------------------------------------------------------------
# Arguments
# ------------------------------------------------------------------------------
usage() { sed -n '2,39p' "$SCRIPT_PATH" | sed 's/^# \?//'; }

while [ $# -gt 0 ]; do
    case "$1" in
        --apply)          MODE="apply"; shift ;;
        --check)          MODE="check"; shift ;;
        --list-excludes)  MODE="list-excludes"; shift ;;
        --restore)        MODE="restore"; RESTORE_ARG="${2:-LAST}"; shift 2 ;;
        --ref)            REF="${2:?--ref needs a branch, tag or commit}"; shift 2 ;;
        --yes|-y)         ASSUME_YES=true; shift ;;
        --prune)          PRUNE=true; shift ;;
        --verbose|-v)     VERBOSE=true; shift ;;
        -h|--help)        usage; exit 0 ;;
        *)                die "Unknown argument '$1' — try --help" ;;
    esac
done

# --yes means "do not stop to ask" for the file decisions AND for the service
# questions, so it implies the same unattended defaults everywhere.
[ "$ASSUME_YES" = true ] && PHANTOM_NONINTERACTIVE=1

if [ "$(id -u)" -eq 0 ]; then SUDO=""
elif command -v sudo >/dev/null 2>&1; then SUDO="sudo"
else SUDO=""; fi

# ------------------------------------------------------------------------------
# The source-of-truth guard
# ------------------------------------------------------------------------------
# Exactly one machine must never take files FROM the published tree: the one the
# published tree is made from. Its copies are ahead of anything on GitHub, so
# "differs from upstream" there means "not published yet" rather than "out of
# date", and applying an update would replace current work with the last
# snapshot. Nothing in the files can settle which side is newer — mtimes do not
# survive a tarball and most files carry no version — so the maintainer marks
# the tree by hand, once, and this refuses to write to it ever after.
#
# Reporting still works, and is the useful thing to do there: it says exactly
# what has not been published yet.
GUARD_FILE="$PHANTOM_DIR/.update-source-of-truth"
# Used further down to turn the report around: on a source tree "differs"
# means "not published yet", which is the opposite of what it means here.
IS_SOURCE=false
[ -e "$GUARD_FILE" ] && IS_SOURCE=true
if [ "$MODE" = "apply" ] && [ -e "$GUARD_FILE" ]; then
    banner "This tree is marked as a source, not a copy"
    echo ""
    red   "  ✋ Refusing to apply an update here."
    echo ""
    echo "     $(basename "$GUARD_FILE") is present, which marks this directory as the"
    echo "     tree the published version is BUILT FROM. Its files are newer than"
    echo "     GitHub's, so applying an update would overwrite them with an older"
    echo "     snapshot of themselves."
    echo ""
    echo "     What to do instead:"
    echo "       ./update.sh          report what is here but not yet published"
    echo "       rm $GUARD_FILE"
    echo "                            remove the marker, if this really is a copy"
    echo ""
    exit 3
fi

# ------------------------------------------------------------------------------
# The exclusion rules
# ------------------------------------------------------------------------------
# TIER A — never written, never even mentioned in a prompt. These are what make
# this installation a particular receiver at a particular place: its config, its
# markers, its admin secret, its logs, its build output. An updater that
# overwrites any of them has not updated the site, it has replaced it.
#
# Patterns are shell globs matched against the path relative to the instance
# root, with `*` crossing directory separators (so `logs/*` covers everything
# beneath it).
TIER_A=(
    # site identity and per-site configuration
    # config-<receiver>.toml IS the live config of a site that runs that
    # receiver, so it is untouchable. The config.example.*.toml samples are
    # Tier B instead — see below.
    'config.toml' 'config-*.toml'
    'admin_config.json' 'markers.json' 'mymarkers.json'
    # The sysop's callsign, locator, city, hardware and antenna — what visitors
    # see. The repository ships the placeholder version of this file, so leaving
    # it out of this list would reset a working site to "your name or callsign".
    'frontend/site_information.json' 'users.json' '*/users.json'
    'autorun.json' 'autorun-status.json' 'autorun-totals.json'
    'frontend/variant.json' '.tap_token'
    # The relay's own config: the .example beside it is what gets distributed.
    'websdr_relay.json' 'websdr_relay.json.bak'
    # our own marker, which must never travel to a copy — a copy that had it
    # would refuse every --apply from then on
    '.update-source-of-truth'
    # externally refreshed data, permanently dirty by design
    'frequencylist/*'
    # written by users while the site runs
    'chat_history.txt'
    # logs, pids, flags, reports — regenerated, and some are open right now
    '*.log' '*.log.*' 'logs/*' 'logproxy/*' 'logwebsdr.txt' 'logwebsdr.flag' 'install.txt'
    '*.pid' '.watchdog.lock' '*.fifo' '*fftw_wisdom'
    # build output and fetched dependencies — never distributed, always rebuilt
    'build/*' 'frontend/dist/*' 'node_modules/*' '*/node_modules/*'
    'subprojects/glaze/*' 'subprojects/packagecache/*' 'subprojects/websocketpp-*/*'
    'rx888_stream/*' '__pycache__/*' '*/__pycache__/*'
    'frontend/stats.html' 'frontend/stats-*.html'
    'frontend/src/lib/VersionSelector.svelte.backup'
    # ours, and the tooling that is not distributed
    '.git/*' '.claude/*' '.update-state/*'
    '.update-backups/*' 'update-backups/*'
    'update-exclude.txt' 'tools/*'
)

# TIER B — updated, but never silently. These are the files a sysop most often
# has a reason to have edited: the launcher with their own RX888_ARGS or CPU
# pinning, a hand-tuned service unit, an installer they adapted. If we cannot
# prove the local copy is an untouched earlier release (see the manifest below),
# the sysop is asked before anything is written over it.
TIER_B=(
    'start-*.sh' 'stop-websdr.sh' 'go.sh' 'xgo.sh' 'rade.sh' '_relaunch.sh'
    'kill.sh' 'check-go.sh' 'waterfall.sh' 'smeter_theme.sh'
    '*.service' 'logrotate/*'
    'install.sh' 'install_*.sh' 'install-*.sh' 'recompile.sh'
    'setup_admin.sh' 'setup-*.sh' 'manage_admin.sh' 'setup_websdr_relay.sh'
    'proxy.py' 'admin_server.py' 'thermal_guard.py' 'rade_helper.py'
    'websdr_relay.py'
    # The sample configs. They are only ever copied from, never run, so
    # freezing them in Tier A meant a sysop could never receive an improved
    # one. But people do annotate the sample they worked from, and losing
    # that to a silent overwrite is a nasty surprise even with a backup, so
    # they are offered here rather than taken.
    'config.example.*.toml'
    # The band-plan overlay: shipped with sensible defaults, but the bands a
    # site shows, and their colours and limits, are a matter of where it is
    # and what it is for. Improvements upstream are worth having, so it is
    # offered rather than skipped — and never taken silently.
    'frontend/src/bands-config.js'
)

# A site can add its own Tier A patterns without editing this script.
EXTRA_EXCLUDES=()
if [ -f "$EXCLUDE_FILE" ]; then
    while IFS= read -r line; do
        line="${line%%#*}"; line="${line#"${line%%[![:space:]]*}"}"; line="${line%"${line##*[![:space:]]}"}"
        [ -n "$line" ] && EXTRA_EXCLUDES+=("$line")
    done < "$EXCLUDE_FILE"
fi

matches_any() {
    local path="$1"; shift
    local pat
    for pat in "$@"; do
        # shellcheck disable=SC2053
        [[ $path == $pat ]] && return 0
    done
    return 1
}

tier_of() {
    local path="$1"
    if [ ${#EXTRA_EXCLUDES[@]} -gt 0 ] && matches_any "$path" "${EXTRA_EXCLUDES[@]}"; then echo A; return; fi
    if matches_any "$path" "${TIER_A[@]}"; then echo A; return; fi
    if matches_any "$path" "${TIER_B[@]}"; then echo B; return; fi
    echo C
}

if [ "$MODE" = "list-excludes" ]; then
    banner "Exclusion rules for $PHANTOM_DIR"
    echo ""
    blue "  TIER A — never touched, never prompted:"
    printf '     %s\n' "${TIER_A[@]}"
    if [ ${#EXTRA_EXCLUDES[@]} -gt 0 ]; then
        echo ""
        blue "  TIER A — added by $(basename "$EXCLUDE_FILE"):"
        printf '     %s\n' "${EXTRA_EXCLUDES[@]}"
    else
        echo ""
        grey "  (no $(basename "$EXCLUDE_FILE") — create one, a glob per line, to add your own)"
    fi
    echo ""
    blue "  TIER B — updated only after asking you:"
    printf '     %s\n' "${TIER_B[@]}"
    echo ""
    blue "  TIER C — everything else: updated, after a backup."
    echo ""
    exit 0
fi

# ------------------------------------------------------------------------------
# Re-exec from a temp copy, so this script can rewrite ITSELF safely
# ------------------------------------------------------------------------------
# bash reads a script incrementally as it runs. Overwriting update.sh while
# update.sh is executing makes it jump into the middle of the new text — the
# classic way a self-updater corrupts its own run. Running from a copy in /tmp
# means the file on disk is just another file we are allowed to replace.
#
# --restore needs this exactly as much as --apply, and used to run before it:
# update.sh is an ordinary Tier C file, so an update backs it up like any other,
# and putting that backup back rewrites the very script doing the putting back.
if { [ "$MODE" = "apply" ] || [ "$MODE" = "restore" ]; } \
   && [ -z "${PHANTOM_UPDATE_REEXEC:-}" ]; then
    SELF_COPY="$(mktemp "${TMPDIR:-/tmp}/phantom-update-XXXXXX.sh")"
    cat "$SCRIPT_PATH" > "$SELF_COPY"
    chmod +x "$SELF_COPY"
    export PHANTOM_UPDATE_REEXEC="$SCRIPT_PATH"
    # `exec` replaces this process, so our own EXIT trap never runs and the
    # child cannot see our locals: the path of the copy to delete has to be
    # handed over in the environment, or every run leaves one behind in /tmp.
    export PHANTOM_UPDATE_SELF_COPY="$SELF_COPY"
    # Rebuild the argument list; the flags are all we need to carry over.
    if [ "$MODE" = "restore" ]; then
        args=(--restore "$RESTORE_ARG")
    else
        args=(--apply --ref "$REF")
        if [ "$ASSUME_YES" = true ]; then args+=(--yes);   fi
        if [ "$PRUNE"      = true ]; then args+=(--prune); fi
    fi
    if [ "$VERBOSE" = true ]; then args+=(--verbose); fi
    exec "$SELF_COPY" "${args[@]}"
fi
SELF_COPY="${PHANTOM_UPDATE_SELF_COPY:-}"
trap '[ -n "${SELF_COPY:-}" ] && rm -f "$SELF_COPY"' EXIT

# ------------------------------------------------------------------------------
# Backups: one dated archive per run
# ------------------------------------------------------------------------------
# zip is what a sysop can open anywhere, including on the Windows machine they
# copied it to. But zip is a separate package that a minimal server may not
# have, while tar is already required by this script, so tar.gz is the
# fallback. Restoring reads whichever it finds, and the hidden directories
# older versions left behind.
backup_format() {
    if command -v zip >/dev/null 2>&1 && command -v unzip >/dev/null 2>&1; then
        echo zip
    else
        echo tar.gz
    fi
}

# Every backup this instance holds, oldest first, named by its timestamp.
# Note the trailing `true`: with `set -o pipefail` a directory that does not
# exist yet would make the whole group fail, and `HAVE="$(list_backups)"` would
# then abort the script under `set -e` without printing anything at all.
list_backups() {
    {
        if [ -d "$BACKUP_ROOT" ]; then
            ls -1 "$BACKUP_ROOT" 2>/dev/null \
              | sed -n 's/^phantomsdr-backup-\(.*\)\.zip$/\1/p; s/^phantomsdr-backup-\(.*\)\.tar\.gz$/\1/p'
        fi
        if [ -d "$LEGACY_BACKUP_ROOT" ]; then
            ls -1 "$LEGACY_BACKUP_ROOT" 2>/dev/null
        fi
        true
    } 2>/dev/null | sort -u
}

# Where the backup for one timestamp actually is — an archive, or a directory
# from before this script archived them.
backup_path_for() {
    local stamp="$1" cand
    for cand in "$BACKUP_ROOT/phantomsdr-backup-$stamp.zip" \
                "$BACKUP_ROOT/phantomsdr-backup-$stamp.tar.gz" \
                "$LEGACY_BACKUP_ROOT/$stamp"; do
        if [ -e "$cand" ]; then printf '%s\n' "$cand"; return 0; fi
    done
    return 1
}

# ------------------------------------------------------------------------------
# Restore
# ------------------------------------------------------------------------------
if [ "$MODE" = "restore" ]; then
    HAVE="$(list_backups)"
    [ -n "$HAVE" ] || die "No backups have ever been taken (nothing in $BACKUP_ROOT)."
    if [ "$RESTORE_ARG" = "LAST" ] || [ -z "$RESTORE_ARG" ]; then
        RESTORE_ARG="$(printf '%s\n' "$HAVE" | tail -1)"
    fi
    # A whole filename is accepted too — it is what `ls update-backups/` shows,
    # so it is what a sysop will paste.
    case "$RESTORE_ARG" in
        phantomsdr-backup-*) RESTORE_ARG="${RESTORE_ARG#phantomsdr-backup-}"
                             RESTORE_ARG="${RESTORE_ARG%.zip}"
                             RESTORE_ARG="${RESTORE_ARG%.tar.gz}" ;;
    esac
    SRC="$(backup_path_for "$RESTORE_ARG")" \
        || die "No such backup: $RESTORE_ARG
     Have: $(printf '%s\n' "$HAVE" | tr '\n' ' ')"

    if [ -d "$SRC" ]; then
        B="$SRC"
        UNPACK=""
    else
        UNPACK="$(mktemp -d "${TMPDIR:-/tmp}/phantom-restore-XXXXXX")"
        B="$UNPACK"
        case "$SRC" in
            *.zip)    unzip -q "$SRC" -d "$B" || die "Could not read $SRC" ;;
            *.tar.gz) tar -xzf "$SRC" -C "$B" || die "Could not read $SRC" ;;
        esac
    fi
    banner "Restoring the files overwritten on $RESTORE_ARG"
    echo "     from $SRC"
    n=0
    while IFS= read -r rel; do
        [ "$rel" = "restore.sh" ] && continue
        mkdir -p "$PHANTOM_DIR/$(dirname "$rel")"
        cp -p "$B/$rel" "$PHANTOM_DIR/$rel"
        echo "     restored  $rel"
        n=$((n + 1))
    done < <(cd "$B" && find . -type f -printf '%P\n' | sort)
    [ -n "$UNPACK" ] && rm -rf "$UNPACK"
    echo ""
    green "  ✅ $n file(s) put back. A rebuild may be needed: ./recompile.sh"
    exit 0
fi

# ------------------------------------------------------------------------------
# Preflight
# ------------------------------------------------------------------------------
banner "PhantomSDR-Plus updater"
echo ""
printf '     %-14s %s\n' "instance"  "$PHANTOM_DIR"
printf '     %-14s %s\n' "source"    "github.com/${REPO_SLUG} @ ${REF}"
printf '     %-14s %s\n' "mode"      "$([ "$MODE" = apply ] && echo 'apply — files WILL be written' || echo 'check — nothing will be written')"
echo ""

for c in curl tar sha256sum find; do
    command -v "$c" >/dev/null 2>&1 || die "'$c' is not installed, and this script needs it."
done
[ -f "$PHANTOM_DIR/meson.build" ] && [ -d "$PHANTOM_DIR/src" ] && [ -d "$PHANTOM_DIR/frontend" ] \
    || die "$PHANTOM_DIR does not look like a PhantomSDR-Plus tree (no meson.build/src/frontend)."
[ "$MODE" != "apply" ] || [ -w "$PHANTOM_DIR" ] \
    || die "$PHANTOM_DIR is not writable by $(id -un)."

TMP="$(mktemp -d "${TMPDIR:-/tmp}/phantom-update-XXXXXX")"
cleanup() { rm -rf "$TMP"; [ -n "${SELF_COPY:-}" ] && rm -f "$SELF_COPY"; return 0; }
trap cleanup EXIT

# ------------------------------------------------------------------------------
# Fetch
# ------------------------------------------------------------------------------
TARBALL="$TMP/tree.tar.gz"
URL="https://codeload.github.com/${REPO_SLUG}/tar.gz/${REF}"
printf '  ⬇  fetching %s ... ' "$REF"
if ! curl -fsSL --retry 2 --connect-timeout 20 -o "$TARBALL" "$URL"; then
    echo ""
    die "Could not download $URL
     Check the network, and that '${REF}' exists in the repository."
fi
green "$(du -h "$TARBALL" | cut -f1)"

UP="$TMP/upstream"
mkdir -p "$UP"
# GitHub wraps everything in one <repo>-<ref> directory; strip it.
tar -xzf "$TARBALL" -C "$UP" --strip-components=1 \
    || die "The download is not a readable tar.gz — the ref may not exist."
[ -f "$UP/meson.build" ] && [ -d "$UP/src" ] \
    || die "The downloaded tree does not look like PhantomSDR-Plus. Refusing to touch anything."

# ------------------------------------------------------------------------------
# Compare
# ------------------------------------------------------------------------------
# The manifest is what makes this more than a diff: it records, for every file,
# the upstream hash AS OF THE LAST UPDATE. So a local file that differs from the
# new upstream can be told apart —
#
#   local == manifest   the sysop never touched it; it is simply an old release
#   local != manifest   the sysop edited it; overwriting would destroy their work
#
# Without that, every update either clobbers local edits or asks about all 300
# files. On the very first run there is no manifest, which is exactly why Tier B
# exists: the likely-edited files are prompted, the rest are taken.
declare -A PREV_SHA=()
if [ -f "$MANIFEST" ]; then
    while read -r sha path; do
        [ -n "$path" ] && PREV_SHA["$path"]="$sha"
    done < "$MANIFEST"
fi

mapfile -t UP_FILES < <(cd "$UP" && find . -type f -printf '%P\n' | sort)
[ ${#UP_FILES[@]} -gt 0 ] || die "The downloaded tree is empty."

# One batch hash of the upstream tree; the local side is compared with cmp,
# which does not read whole files when they differ early.
declare -A UP_SHA=()
while read -r sha path; do
    path="${path#\*}"
    [ -n "$path" ] && UP_SHA["$path"]="$sha"
done < <(cd "$UP" && printf '%s\0' "${UP_FILES[@]}" | xargs -0 sha256sum)

declare -a F_NEW=() F_UPDATE=() F_CONFLICT=() F_SAME=() F_SKIP=() F_GONE=()

printf '  🔍 comparing %d files ... ' "${#UP_FILES[@]}"
for rel in "${UP_FILES[@]}"; do
    tier="$(tier_of "$rel")"
    if [ "$tier" = "A" ]; then F_SKIP+=("$rel"); continue; fi

    local_f="$PHANTOM_DIR/$rel"
    if [ ! -e "$local_f" ]; then F_NEW+=("$rel"); continue; fi
    if cmp -s "$local_f" "$UP/$rel"; then F_SAME+=("$rel"); continue; fi

    lsha="$(sha256sum "$local_f" | cut -d' ' -f1)"
    prev="${PREV_SHA[$rel]:-}"
    if [ -n "$prev" ] && [ "$prev" = "$lsha" ]; then
        # Untouched copy of the previous release — a plain update, whatever tier.
        F_UPDATE+=("$rel")
    elif [ -z "$prev" ] && [ "$tier" = "C" ]; then
        # No history to judge by, and not a file people usually edit.
        F_UPDATE+=("$rel")
    else
        F_CONFLICT+=("$rel")
    fi
done

# Files that used to come from upstream and no longer exist there. Anything else
# in the tree is the sysop's own and is never a deletion candidate.
for rel in "${!PREV_SHA[@]}"; do
    [ -n "${UP_SHA[$rel]:-}" ] && continue
    [ -e "$PHANTOM_DIR/$rel" ] || continue
    [ "$(tier_of "$rel")" = "A" ] && continue
    F_GONE+=("$rel")
done

# The other direction: files that are HERE and not in the published tree at all.
# Only asked on the source tree, where it is the whole question — "have I
# uploaded everything?" — and where a plain report was silently answering "yes"
# because the comparison above only ever walks the UPSTREAM file list. On an
# ordinary site this would just list every stray file the sysop ever dropped in
# the tree, so it stays quiet there.
declare -a F_UNPUBLISHED=()
if [ "$IS_SOURCE" = true ]; then
    # Prune the heavy generated trees before find descends into them; whatever
    # survives is still passed through tier_of, which is the real filter.
    while IFS= read -r rel; do
        [ -n "$rel" ] || continue
        [ -n "${UP_SHA[$rel]:-}" ] && continue
        [ "$(tier_of "$rel")" = "A" ] && continue
        F_UNPUBLISHED+=("$rel")
    done < <(cd "$PHANTOM_DIR" && find . \
        \( -name .git -o -name node_modules -o -name build -o -name dist \
           -o -name __pycache__ -o -name .update-backups -o -name .update-state \
           -o -name .claude -o -name tools -o -name frequencylist \
           -o -name packagecache -o -name glaze -o -name rx888_stream \) -prune -o \
        -type f -printf '%P\n' | sort)
    # .gitignore is already the maintainer's own answer to "is this file meant
    # to be published?", and the source tree is by definition a git checkout.
    # Nothing else here touches git — an ordinary site has no history to
    # consult — but on this one side it is the right filter, and it costs one
    # call. Without it the list fills up with rotated logs and scratch files.
    if [ ${#F_UNPUBLISHED[@]} -gt 0 ] && command -v git >/dev/null 2>&1 \
       && git -C "$PHANTOM_DIR" rev-parse --git-dir >/dev/null 2>&1; then
        mapfile -t F_UNPUBLISHED < <(
            printf '%s\n' "${F_UNPUBLISHED[@]}" \
              | git -C "$PHANTOM_DIR" check-ignore --stdin --non-matching --verbose 2>/dev/null \
              | sed -n 's/^::\t//p'
        )
    fi
fi
green "done"

# ------------------------------------------------------------------------------
# Report
# ------------------------------------------------------------------------------
list_files() {
    local colour="$1" mark="$2"; shift 2
    local n=0 f
    for f in "$@"; do
        if [ "$VERBOSE" != true ] && [ "$n" -ge 40 ]; then
            grey "        … and $(($# - 40)) more (--verbose to see them all)"
            break
        fi
        echo -e "        \e[${colour}m${mark}\e[0m $f"
        n=$((n + 1))
    done
}

if [ "$IS_SOURCE" = true ]; then
    banner "This tree against what is published"
    echo ""
    grey "  This tree is marked as the source the published version is built from,"
    grey "  so a difference means \"not uploaded yet\", not \"out of date\"."
    echo ""
else
    banner "What this update would change"
    echo ""
fi
if [ ${#F_NEW[@]} -gt 0 ]; then
    if [ "$IS_SOURCE" = true ]; then
        green "  ➕ ${#F_NEW[@]} file(s) published but missing here:"
    else
        green "  ➕ ${#F_NEW[@]} new file(s):"
    fi
    list_files 32 "+" "${F_NEW[@]}"; echo ""
fi
if [ ${#F_UPDATE[@]} -gt 0 ]; then
    if [ "$IS_SOURCE" = true ]; then
        blue "  ⬆  ${#F_UPDATE[@]} file(s) here differ from the published copy:"
    else
        blue "  ⬆  ${#F_UPDATE[@]} file(s) to update:"
    fi
    list_files 34 "~" "${F_UPDATE[@]}"; echo ""
fi
if [ ${#F_CONFLICT[@]} -gt 0 ]; then
    if [ "$IS_SOURCE" = true ]; then
        yellow "  ✋ ${#F_CONFLICT[@]} file(s) differ, and are of the kind a site customises:"
    else
        yellow "  ✋ ${#F_CONFLICT[@]} file(s) differ AND look edited here — you decide each one:"
    fi
    list_files 33 "!" "${F_CONFLICT[@]}"; echo ""
fi
if [ ${#F_UNPUBLISHED[@]} -gt 0 ]; then
    yellow "  ⬆  ${#F_UNPUBLISHED[@]} file(s) here are not in the published tree at all:"
    list_files 33 "?" "${F_UNPUBLISHED[@]}"; echo ""
fi
if [ ${#F_GONE[@]} -gt 0 ]; then
    grey "  🗑  ${#F_GONE[@]} file(s) removed upstream (kept unless --prune):"
    list_files 90 "-" "${F_GONE[@]}"; echo ""
fi
grey "  🔒 ${#F_SKIP[@]} site-local file(s) skipped   ·   ${#F_SAME[@]} already current"
echo ""

# --prune has nothing to work with until the first --apply has written a
# manifest: F_GONE is built from it alone. Saying so beats looking like a
# no-op that quietly decided there was nothing to remove.
if [ "$PRUNE" = true ] && [ ! -f "$MANIFEST" ]; then
    warn "--prune needs a manifest from an earlier --apply run, and there is none
     here yet ($MANIFEST). Nothing can be offered for deletion this time; it
     will work from the next update onwards."
    echo ""
fi

PENDING=$(( ${#F_NEW[@]} + ${#F_UPDATE[@]} + ${#F_CONFLICT[@]} + ${#F_UNPUBLISHED[@]} ))
if [ "$PENDING" -eq 0 ] && { [ "$PRUNE" != true ] || [ ${#F_GONE[@]} -eq 0 ]; }; then
    if [ "$IS_SOURCE" = true ]; then
        green "  ✅ Everything in this tree is published at ${REPO_SLUG} @ ${REF}."
    else
        green "  ✅ This instance is already up to date with ${REF}."
    fi
    exit 0
fi

if [ "$MODE" != "apply" ]; then
    if [ "$IS_SOURCE" = true ]; then
        echo "     Nothing was written, and --apply is refused here. The files above"
        echo "     are what still has to go up to ${REPO_SLUG}."
    else
        echo "     Nothing was written. To do it:  ./update.sh --apply"
    fi
    exit 10
fi

# ------------------------------------------------------------------------------
# Decide the conflicts BEFORE anything is stopped or written
# ------------------------------------------------------------------------------
# Asking all the questions first means the receiver is off air for the length of
# the copy, not for the length of the sysop's thinking.
declare -A DECISION=()
if [ ${#F_CONFLICT[@]} -gt 0 ]; then
    banner "Files you appear to have edited"
    echo ""
    echo "     For each one: keep yours, take the new version, or take the new"
    echo "     version alongside yours as <file>.new so you can merge by hand."
    echo ""
    for rel in "${F_CONFLICT[@]}"; do
        if [ "${PHANTOM_NONINTERACTIVE:-}" = "1" ]; then
            DECISION["$rel"]="keep"
            echo "  ❓ $rel → keep yours (unattended default)"
            continue
        fi
        echo ""
        yellow "  ── $rel ──"
        if command -v diff >/dev/null 2>&1; then
            diff -u "$PHANTOM_DIR/$rel" "$UP/$rel" 2>/dev/null \
                | sed -n '3,23p' | sed 's/^/     /' || true
            added=$(diff "$PHANTOM_DIR/$rel" "$UP/$rel" 2>/dev/null | grep -c '^>' || true)
            removed=$(diff "$PHANTOM_DIR/$rel" "$UP/$rel" 2>/dev/null | grep -c '^<' || true)
            grey "     (upstream adds ${added} line(s), drops ${removed})"
        fi
        prompt_fence
        printf '  ❓ %s  [\033[1;32mK\033[0m]eep mine / [u]pstream / [b]oth  \033[90m(ENTER = Keep mine)\033[0m: ' "$(basename "$rel")"
        read -r ans || true
        case "${ans:-k}" in
            [Uu]*) DECISION["$rel"]="upstream" ;;
            [Bb]*) DECISION["$rel"]="both" ;;
            *)     DECISION["$rel"]="keep" ;;
        esac
    done
fi

PRUNE_OK=false
if [ "$PRUNE" = true ] && [ ${#F_GONE[@]} -gt 0 ]; then
    echo ""
    if confirm PHANTOM_PRUNE n n "Delete the ${#F_GONE[@]} file(s) that no longer exist upstream?"; then
        PRUNE_OK=true
    fi
fi

# ------------------------------------------------------------------------------
# Stop what is running
# ------------------------------------------------------------------------------
# Writing into a live tree is how an update turns into an outage that looks like
# a bad release: the binary is replaced while it is mapped, the panel serves a
# frontend directory that has moved under it, and the watchdog cheerfully
# restarts whatever half-written thing it finds.
PHANTOM_UNITS=(phantomsdr-admin.service phantomsdr-proxy.service sdr-stats.service
                phantomsdr-websdr-relay.service)
STOPPED_UNITS=()
STOPPED_RECEIVER=""

# Is this path a file of the instance we are updating? More than one
# PhantomSDR-Plus can run on one machine — a second clone, or a copy someone is
# testing this very script in — and stopping the wrong one takes a receiver off
# the air for an update it is not even receiving.
owns_path() {
    local p="$1" dir
    [ -n "$p" ] || return 1
    dir="$(cd "$(dirname "$p")" 2>/dev/null && pwd -P)" || return 1
    [ "$dir" = "$PHANTOM_DIR_REAL" ]
}

# The launcher of THIS instance, if it is running. Every matching process is
# examined, not just the first, because the first one found may well belong to
# another tree. The path is taken from /proc rather than from `pgrep -a`, and a
# relative one ("./start-rtl.sh", from someone who started it by hand) is
# resolved against that process's own working directory — resolving it against
# ours would silently make another instance look like this one.
#
# Only a shell running a launcher counts ("bash <path>/start-X.sh …", the
# watchdog or a launcher still in the foreground). An argument that merely
# names a launcher — "nano start-rtl.sh" in this very tree — is not one.
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
        owns_path "$path" || continue
        printf '%s\n' "$path"
        return 0
    done < <(pgrep -f 'start-(rx888mk2|airspyhf|rtl|rsp1a|fobos|fobos-hf|hackrf)\.sh' 2>/dev/null)
    return 1
}

# Same question for a systemd unit, answered from its WorkingDirectory and, if
# it declares none, from the directory of the program it starts. A unit we
# cannot place is treated as ours: that is the single-instance machine, where
# the old behaviour was right.
unit_belongs_here() {
    local u="$1" wd
    wd="$(systemctl show -p WorkingDirectory --value "$u" 2>/dev/null)" || wd=""
    if [ -z "$wd" ]; then
        wd="$(systemctl show -p ExecStart --value "$u" 2>/dev/null \
              | grep -oE '/[^ ]+\.py' | head -1)"
        [ -n "$wd" ] && wd="$(dirname "$wd")"
    fi
    [ -n "$wd" ] || return 0
    [ "$(cd "$wd" 2>/dev/null && pwd -P)" = "$PHANTOM_DIR_REAL" ]
}

stop_running_phantom() {
    local u script; local -a live=()
    for u in "${PHANTOM_UNITS[@]}"; do
        systemctl is-active --quiet "$u" 2>/dev/null || continue
        unit_belongs_here "$u" || { grey "  $u serves another directory — left alone."; continue; }
        live+=("$u")
    done
    script="$(running_receiver_script || true)"
    if [ ${#live[@]} -eq 0 ] && [ -z "$script" ]; then
        grey "  Nothing of PhantomSDR-Plus is running — writing straight away."
        return 0
    fi
    banner "Stopping the running receiver first"
    [ -n "$script" ] && echo "     receiver: $script"
    [ ${#live[@]} -gt 0 ] && echo "     services: ${live[*]}"
    if ! confirm PHANTOM_STOP_SERVICES y y \
         "Stop them now, and start them again when the update finishes?"; then
        warn "Updating a live tree can leave the site broken until the next rebuild."
        return 0
    fi
    echo ""
    for u in "${live[@]}"; do
        printf '     %-40s' "stopping ${u} ..."
        if $SUDO systemctl stop "$u" >/dev/null 2>&1; then green "stopped"; STOPPED_UNITS+=("$u")
        else red "failed"; warn "Could not stop ${u} — stop it by hand."; fi
    done
    if [ -n "$script" ]; then
        printf '     %-40s' "stopping the receiver ..."
        if [ -x "$(dirname "$script")/stop-websdr.sh" ] \
           && "$(dirname "$script")/stop-websdr.sh" >/dev/null 2>&1; then
            green "stopped"; STOPPED_RECEIVER="$script"
        else
            red "failed"; warn "Could not stop ${script} — stop it by hand."
        fi
    fi
}

# Only ever restarts what THIS run stopped: something the sysop stopped by hand
# is theirs to start again.
restart_stopped_phantom() {
    local u
    [ ${#STOPPED_UNITS[@]} -gt 0 ] || [ -n "$STOPPED_RECEIVER" ] || return 0
    echo ""
    blue "  Starting again what was stopped:"
    for u in "${STOPPED_UNITS[@]}"; do
        printf '     %-40s' "starting ${u} ..."
        $SUDO systemctl start "$u" >/dev/null 2>&1 && green "running" \
            || { red "failed"; warn "Start it by hand: ${SUDO:+$SUDO }systemctl start ${u}"; }
    done
    if [ -n "$STOPPED_RECEIVER" ]; then
        printf '     %-40s' "starting the receiver ..."
        "$STOPPED_RECEIVER" -q >/dev/null 2>&1 && green "running" \
            || { red "failed"; warn "Start it by hand: $STOPPED_RECEIVER"; }
    fi
    echo ""
}

stop_running_phantom

# ------------------------------------------------------------------------------
# Apply
# ------------------------------------------------------------------------------
STAMP="$(date +%Y%m%d-%H%M%S)"
# Staged outside the instance while the update runs, then packed into one
# archive at the end. A run that dies half way leaves no half-written backup
# directory in the tree, and the finished archive is a single file to copy off.
BACKUP_DIR="$TMP/backup-$STAMP"
BACKUP_FMT="$(backup_format)"
BACKUP_ARCHIVE="$BACKUP_ROOT/phantomsdr-backup-$STAMP.$BACKUP_FMT"
mkdir -p "$BACKUP_DIR" "$STATE_DIR"

backup_one() {
    local rel="$1"
    [ -e "$PHANTOM_DIR/$rel" ] || return 0
    mkdir -p "$BACKUP_DIR/$(dirname "$rel")"
    cp -p "$PHANTOM_DIR/$rel" "$BACKUP_DIR/$rel"
}

place() {
    local rel="$1"
    mkdir -p "$PHANTOM_DIR/$(dirname "$rel")"
    cp -p "$UP/$rel" "$PHANTOM_DIR/$rel"
    # A script arriving from a tarball keeps its upstream mode, but a file that
    # was executable here must stay executable even if the archive disagrees.
    [ -x "$BACKUP_DIR/$rel" ] && chmod +x "$PHANTOM_DIR/$rel"
    return 0
}

banner "Applying"
echo ""
n_new=0; n_upd=0; n_kept=0; n_both=0; n_del=0
declare -a APPLIED=()

for rel in "${F_NEW[@]}"; do
    place "$rel"; APPLIED+=("$rel"); n_new=$((n_new + 1))
done
for rel in "${F_UPDATE[@]}"; do
    backup_one "$rel"; place "$rel"; APPLIED+=("$rel"); n_upd=$((n_upd + 1))
done
for rel in "${F_CONFLICT[@]}"; do
    case "${DECISION[$rel]}" in
        upstream) backup_one "$rel"; place "$rel"; APPLIED+=("$rel"); n_upd=$((n_upd + 1)) ;;
        both)     cp -p "$UP/$rel" "$PHANTOM_DIR/$rel.new"; n_both=$((n_both + 1)) ;;
        *)        n_kept=$((n_kept + 1)) ;;
    esac
done
if [ "$PRUNE_OK" = true ]; then
    for rel in "${F_GONE[@]}"; do
        backup_one "$rel"; rm -f "$PHANTOM_DIR/$rel"; n_del=$((n_del + 1))
    done
fi

printf '     %-28s %d\n' "new files"          "$n_new"
printf '     %-28s %d\n' "updated"            "$n_upd"
printf '     %-28s %d\n' "yours, kept"        "$n_kept"
printf '     %-28s %d\n' "written as .new"    "$n_both"
[ "$n_del" -gt 0 ] && printf '     %-28s %d\n' "deleted (--prune)" "$n_del"
printf '     %-28s %d\n' "site-local, untouched" "${#F_SKIP[@]}"

# ------------------------------------------------------------------------------
# The manifest and the backup's own restore script
# ------------------------------------------------------------------------------
# Recorded for every upstream file, including the ones whose local copy we left
# alone: next time, "local still equals what upstream had" is the whole test.
: > "$MANIFEST.tmp"
for rel in "${UP_FILES[@]}"; do
    [ "$(tier_of "$rel")" = "A" ] && continue
    printf '%s %s\n' "${UP_SHA[$rel]}" "$rel" >> "$MANIFEST.tmp"
done
mv "$MANIFEST.tmp" "$MANIFEST"
printf '%s\n' "$REF" > "$STATE_DIR/last-ref"
date -Is > "$STATE_DIR/last-run"

if [ -n "$(find "$BACKUP_DIR" -type f -print -quit)" ]; then
    # Packed with the paths the files have in the instance, so the archive can
    # be unpacked straight over the tree by hand if this script is unavailable.
    cat > "$BACKUP_DIR/restore.sh" <<'RESTORE'
#!/bin/bash
# Put back exactly the files the update of this timestamp overwrote.
# Unpack this archive somewhere, then run this script from inside it and give
# it the instance directory:   ./restore.sh /path/to/PhantomSDR-Plus
# Equivalent to:               ./update.sh --restore <the archive's timestamp>
set -e
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEST="${1:-}"
if [ -z "$DEST" ]; then
    echo "usage: $0 /path/to/PhantomSDR-Plus" >&2; exit 1
fi
[ -f "$DEST/meson.build" ] || { echo "$DEST is not a PhantomSDR-Plus tree." >&2; exit 1; }
cd "$HERE"
find . -type f ! -name restore.sh -printf '%P\n' | while read -r f; do
    mkdir -p "$DEST/$(dirname "$f")"
    cp -p "$f" "$DEST/$f"
    echo "restored $f"
done
echo "Done. A rebuild may be needed: $DEST/recompile.sh"
RESTORE
    chmod +x "$BACKUP_DIR/restore.sh"
    mkdir -p "$BACKUP_ROOT"
    if [ "$BACKUP_FMT" = "zip" ]; then
        ( cd "$BACKUP_DIR" && zip -qr "$BACKUP_ARCHIVE" . ) \
            || warn "Could not write $BACKUP_ARCHIVE"
    else
        ( cd "$BACKUP_DIR" && tar -czf "$BACKUP_ARCHIVE" . ) \
            || warn "Could not write $BACKUP_ARCHIVE"
    fi
    if [ -f "$BACKUP_ARCHIVE" ]; then
        n_bk="$(find "$BACKUP_DIR" -type f ! -name restore.sh | wc -l)"
        echo ""
        grey "  💾 $n_bk overwritten file(s) saved in"
        grey "     update-backups/$(basename "$BACKUP_ARCHIVE")  ($(du -h "$BACKUP_ARCHIVE" | cut -f1))"
    fi
fi

# Keep the last few only; these are whole file copies and they add up. Old
# hidden directories from before archiving are aged out on the same rule.
while IFS= read -r old; do
    [ -n "$old" ] || continue
    rm -rf "$LEGACY_BACKUP_ROOT/$old" \
           "$BACKUP_ROOT/phantomsdr-backup-$old.zip" \
           "$BACKUP_ROOT/phantomsdr-backup-$old.tar.gz"
done < <(list_backups | head -n -"$KEEP_BACKUPS")

# ------------------------------------------------------------------------------
# Rebuild and restart
# ------------------------------------------------------------------------------
NEEDS_BUILD=false
for rel in ${APPLIED[@]+"${APPLIED[@]}"}; do
    case "$rel" in
        src/*|frontend/*|jsdsp/*|subprojects/*|meson.build|meson_options.txt|*.hpp|*.cpp)
            NEEDS_BUILD=true; break ;;
    esac
done

SELF_UPDATED=false
for rel in ${APPLIED[@]+"${APPLIED[@]}"}; do
    [ "$rel" = "update.sh" ] && SELF_UPDATED=true
done

if [ "$NEEDS_BUILD" = true ]; then
    banner "A rebuild is needed"
    echo ""
    echo "     Source, frontend or build files changed, so the running site will"
    echo "     not show any of this until it is compiled again."
    echo ""
    if confirm PHANTOM_RECOMPILE y n "Run ./recompile.sh now? (it asks its own questions)"; then
        if [ -x "$PHANTOM_DIR/recompile.sh" ]; then
            ( cd "$PHANTOM_DIR" && ./recompile.sh ) || warn "recompile.sh did not finish cleanly — run it by hand."
        else
            warn "recompile.sh is not executable here — run: bash recompile.sh"
        fi
    else
        yellow "     Remember to run ./recompile.sh before the changes take effect."
    fi
fi

restart_stopped_phantom

banner "Update finished"
echo ""
green "  ✅ Updated to ${REPO_SLUG} @ ${REF}."
[ "$n_kept" -gt 0 ] && echo "     ${n_kept} of your own file(s) were kept as they are."
[ "$n_both" -gt 0 ] && echo "     ${n_both} new version(s) are waiting beside yours as *.new."
[ "$SELF_UPDATED" = true ] && echo "     update.sh itself was updated; the new one is in place for next time."
echo ""
grey "     Undo:    ./update.sh --restore LAST"
[ -f "${BACKUP_ARCHIVE:-}" ] && grey "     Backup:  update-backups/$(basename "$BACKUP_ARCHIVE")"
echo ""
exit 0
