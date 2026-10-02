#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
#  PhantomSDR-Plus  –  start-airspyhf.sh
#  Universal launcher + watchdog for an Airspy HF+ front end (via SoapySDR rx_sdr).
#
#  Same self-contained design as start-rx888mk2.sh: one script that STARTS,
#  RESTARTS, WATCHDOGS (auto-restarts on failure) and LOGS the server. Derives
#  its own directory — no hard-coded or user-specific paths. Shares stop-websdr.sh.
#
#  Usage:
#    ./start-airspyhf.sh           start (or restart) the server in the background
#    ./stop-websdr.sh              stop the server + watchdog (separate script)
#  Add -q to the start command for two-line output instead of the live log.
#
#  Env overrides (optional):
#    SPECTRUM_CORES=0-3            pin spectrumserver to these CPUs (taskset list)
#    SPECTRUM_CORES=none          do not pin at all
#    RADE_ENABLED=0               do not run the RADE sidecar at all
#    RX_ARGS="…"                  override the rx_sdr argument string
#
#  Drivers: ./setup-airspyhf.sh (or install.sh option 6) installs libairspyhf,
#  SoapyAirspyHF and rx_sdr.
#
#  NOTE: not tested on Airspy hardware — it reuses the exact control/watchdog
#  logic validated on RX-888; only the receiver command/config differ.
# ─────────────────────────────────────────────────────────────────────────────

PHANTOMDIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SELF="$PHANTOMDIR/$(basename "${BASH_SOURCE[0]}")"

# ═══ RECEIVER CONFIGURATION (the only receiver-specific part) ═════════════════
RX_LABEL="Airspy HF+"
RX_COMM="rx_sdr"                                   # process name to monitor/kill
CONFIG="$PHANTOMDIR/config-airspyhf.toml"
FIFO="$PHANTOMDIR/airspy.fifo"
RX_ARGS="${RX_ARGS:--f 6956000 -s 912000 -d driver=airspyhf -F CS16 -}"
RX_CMD=(rx_sdr)                                    # binary; args come from RX_ARGS
prestart() {
    # Turn USB power-saving off (best-effort; needs root / passwordless sudo).
    echo on | sudo tee /sys/bus/usb/devices/*/power/control >/dev/null 2>&1 || true
}
# ═════════════════════════════════════════════════════════════════════════════

LOG="$PHANTOMDIR/logwebsdr.txt"
SPECTRUM="$PHANTOMDIR/build/spectrumserver"
STOP="$PHANTOMDIR/stop-websdr.sh"
LOCK="$PHANTOMDIR/.watchdog.lock"

# RADE v1 sidecar (optional — skipped silently if rade_helper.py isn't present).
RADE="$PHANTOMDIR/rade_helper.py"
RADE_LOG="$PHANTOMDIR/rade.log"

# spectrumserver's own stdout/stderr (client connects, [WebSDROrg] registration,
# curl errors). Kept out of $LOG so the bring-up log stays readable; the
# [WebSDROrg] lines are mirrored into $LOG because those are worth watching.
SRV_LOG="$PHANTOMDIR/spectrumserver.log"
SRV_LOG_MAX=10485760            # rotate at 10 MB (one .1 generation kept)
LOG_MAX=2097152                 # rotate logwebsdr.txt at 2 MB (one .1 kept)

SS_PID=""
RX_PID=""
SS_TASKSET=()

# ── logging helpers ─────────────────────────────────────────────────────────
log()   { echo "$*"          >> "$LOG"; }
stamp() { date --rfc-email   >> "$LOG"; }

# ── keep $LOG bounded (it is append-only and long-lived) ─────────────────────
# One generation is kept: logwebsdr.txt.1. Note that everything writing to $LOG
# must reopen it per line (log() does, and so does the mirror in
# start_spectrumserver) — a writer holding the fd open would keep appending to
# the renamed inode and its output would vanish from the live log.
rotate_log() {
    local sz
    sz=$(wc -c < "$LOG" 2>/dev/null || echo 0)
    [ "$sz" -gt "$LOG_MAX" ] 2>/dev/null || return 0
    mv -f "$LOG" "$LOG.1" 2>/dev/null
    stamp
    log "(log passed $LOG_MAX bytes — previous log is now $(basename "$LOG").1)"
}

# ── keep $SRV_LOG bounded while the server is RUNNING ────────────────────────
# start_spectrumserver() trims this file too, but only at startup: a receiver
# left running for months therefore had no bound at all. This is the periodic
# half of it.
#
# It cannot rename the file the way rotate_log() does. spectrumserver.log is
# written by `tee -a`, which holds the fd open for the life of the server, so a
# rename would leave tee appending to the renamed inode and the live log would
# stay empty until the next restart — exactly the trap described above. Copy
# and truncate instead: tee opened with O_APPEND, so its next write lands at
# offset 0 of the emptied file. Lines written between the copy and the truncate
# are lost, which is the accepted cost of this approach (logrotate calls it
# copytruncate and makes the same trade).
rotate_srv_log() {
    local sz
    sz=$(wc -c < "$SRV_LOG" 2>/dev/null || echo 0)
    [ "$sz" -gt "$SRV_LOG_MAX" ] 2>/dev/null || return 0
    cp -f "$SRV_LOG" "$SRV_LOG.1" 2>/dev/null || return 0
    : > "$SRV_LOG"
    log "($(basename "$SRV_LOG") passed $SRV_LOG_MAX bytes — previous log is now $(basename "$SRV_LOG").1)"
}

# ── read one key out of one [section] of the TOML config ─────────────────────
# Deliberately tiny: enough for scalar keys (enabled/public_host/public_port),
# not a TOML parser. Arrays and multi-line values are not handled — spectrumserver
# is the authority on the config, this is only for what we print. $1 = section
# name without brackets (e.g. "websdr.org"), $2 = key. Empty output = not found.
toml_get() {
    [ -f "$CONFIG" ] || return 1
    awk -v sect="$1" -v key="$2" '
        /^[[:space:]]*\[/ {                       # section header line
            s = $0
            sub(/^[[:space:]]*\[/, "", s)
            sub(/\][[:space:]]*$/, "", s)
            in_s = (s == sect)
            next
        }
        !in_s { next }
        {
            line = $0
            sub(/^[[:space:]]+/, "", line)
            if (index(line, key) != 1) next       # key must start the line
            rest = substr(line, length(key) + 1)
            if (rest !~ /^[[:space:]]*=/) next    # ...and be followed by =
            sub(/^[^=]*=[[:space:]]*/, "", line)
            sub(/[[:space:]]+#.*$/, "", line)     # strip trailing comment
            gsub(/^["'"'"']|["'"'"']$/, "", line) # strip surrounding quotes
            sub(/[[:space:]]+$/, "", line)
            print line
            exit
        }
    ' "$CONFIG" 2>/dev/null
}

# ── announce what the config asks for regarding the public directories ───────
# Two independent mechanisms, both driven by the .toml:
#   [websdr] register_online  → periodic HTTPS POSTs to register_urls
#                               (sdr-list.xyz etc.); silent unless curl fails.
#   [websdr.org] enabled      → a persistent TCP registration thread that logs
#                               [WebSDROrg] Connected / ping / OK lines, which
#                               start_spectrumserver mirrors into $LOG.
report_registration() {
    local en host port
    en=$(toml_get "websdr.org" enabled)
    if [ "$en" = "true" ]; then
        host=$(toml_get "websdr.org" public_host)
        port=$(toml_get "websdr.org" public_port)
        log "websdr.org: ENABLED — announcing ${host:-?}:${port:-?} (watch for [WebSDROrg] lines)"
    else
        log "websdr.org: disabled ([websdr.org] enabled=true in $(basename "$CONFIG") to enable)"
    fi
    if [ "$(toml_get websdr register_online)" = "true" ]; then
        log "SDR directory: ENABLED — posting to [websdr] register_urls (quiet unless it errors)"
    else
        log "SDR directory: disabled ([websdr] register_online=true to enable)"
    fi
}

# ── is a process alive (by exact command name), excluding zombies? ───────────
is_running() {
    local pid stat
    for pid in $(pgrep -x "$1" 2>/dev/null); do
        stat=$(awk '{print $3}' "/proc/$pid/stat" 2>/dev/null)
        case "$stat" in Z) ;; "") ;; *) return 0 ;; esac
    done
    return 1
}

# ── kill only the receiver/server processes (never the watchdog) ─────────────
# Writer first, then reader (spectrumserver): killing the reader first would
# hand the writer a Broken-Pipe panic on the FIFO.
kill_receivers() {
    killall -KILL "$RX_COMM" 2>/dev/null
    sleep 1
    killall -KILL spectrumserver 2>/dev/null
    sleep 2
    [ -n "$RX_PID" ] && wait "$RX_PID" 2>/dev/null; RX_PID=""
    [ -n "$SS_PID" ] && wait "$SS_PID" 2>/dev/null; SS_PID=""
}

# ── derive an optional CPU pin for spectrumserver + the capture process ──────
# On boxes with >4 cores, pin the FFT/audio threads and the sample reader to the
# lower cores and keep the top few free (reduces waterfall/audio jitter). The
# reserved top cores are where the autorun daemon pins its decode workers, and a
# decode burst can saturate them all — which is exactly what the sample reader
# must not be sharing. Not heat-neutral for the reader: it moves work onto
# higher-clocked cores. Generic via nproc; SPECTRUM_CORES overrides (a list to
# pin, or none/off to disable both pins).
compute_taskset() {
    SS_TASKSET=()
    command -v taskset >/dev/null 2>&1 || return
    local override nproc reserve hi
    case "$(printf '%s' "${SPECTRUM_CORES:-}" | tr '[:upper:]' '[:lower:]')" in
        "")                override="" ;;
        none|off|unpinned) return ;;
        *[!0-9,-]*)        override="" ;;
        *)                 override="$SPECTRUM_CORES" ;;
    esac
    if [ -n "$override" ]; then
        SS_TASKSET=(taskset -c "$override")
        return
    fi
    nproc=$(nproc 2>/dev/null || echo 0)
    if [ "$nproc" -gt 4 ]; then
        if [ "$nproc" -ge 12 ]; then reserve=4; else reserve=$(( nproc / 4 )); [ "$reserve" -lt 1 ] && reserve=1; fi
        hi=$(( nproc - reserve - 1 ))
        SS_TASKSET=(taskset -c "0-$hi")
    fi
}

# ── start the receiver (FIFO pre-open + retry) ───────────────────────────────
# Pre-opening the FIFO O_RDWR on fd 8 provides a reader so the receiver's
# write-open doesn't block; kill -0 then tests the real process. fd 8 is closed
# once spectrumserver holds the read end. Returns 0 if the receiver stays up.
start_receiver() {
    if ! command -v "${RX_CMD[0]}" >/dev/null 2>&1; then
        log "ERROR: receiver binary '${RX_CMD[0]}' not found in PATH"
        return 1
    fi
    local attempt
    for attempt in 1 2 3; do
        log "Starting $RX_LABEL ($RX_COMM, attempt $attempt/3)..."
        rm -f "$FIFO"
        mkfifo "$FIFO"
        exec 8<>"$FIFO"
        # taskset execs into the target, so $! stays the real receiver PID — the
        # kill -0 check below and the killall in stop/prestart are unaffected.
        # shellcheck disable=SC2086
        "${SS_TASKSET[@]}" "${RX_CMD[@]}" $RX_ARGS > "$FIFO" &
        RX_PID=$!
        sleep 5
        if kill -0 "$RX_PID" 2>/dev/null; then
            log "$RX_COMM running (PID $RX_PID)"
            return 0
        fi
        exec 8>&-
        RX_PID=""
        sleep 5
    done
    return 1
}

# ── start spectrumserver, then release the pre-opened FIFO fd ─────────────────
start_spectrumserver() {
    log "Starting spectrumserver (config: $(basename "$CONFIG"))..."

    # Keep spectrumserver.log from growing without bound across restarts.
    if [ -f "$SRV_LOG" ] && [ "$(wc -c < "$SRV_LOG" 2>/dev/null || echo 0)" -gt "$SRV_LOG_MAX" ]; then
        mv -f "$SRV_LOG" "$SRV_LOG.1" 2>/dev/null
    fi

    # Full output → $SRV_LOG; [WebSDROrg] registration lines also → $LOG so the
    # terminal mirror shows them. Two kinds of routine chatter are kept to
    # $SRV_LOG only, or $LOG would be nothing else: the /~~orgstatus callback
    # (every ~5s) and the keep-alive registration ping (every 60s, three lines
    # a time). What is left in $LOG is the registration story — start, connect,
    # the first ping and its acceptance, plus one "#N OK" confirmation after
    # every later reconnect (the counter never restarts, so #1 alone would go
    # quiet for the rest of the run). Nothing is filtered on the failure side:
    # send/receive failures, drops and connect errors don't match and pass
    # through. Process substitution (not a pipe) is used on purpose: with a
    # pipe, $! would be grep's PID and SS_PID would be wrong.
    "${SS_TASKSET[@]}" "$SPECTRUM" --config "$CONFIG" < "$FIFO" \
        > >(tee -a "$SRV_LOG" \
            | grep --line-buffered -E '^\[WebSDROrg\]' \
            | grep --line-buffered -v -E '^\[WebSDROrg\] /~~orgstatus' \
            | { after_connect=0
                while IFS= read -r l; do
                    # Ping filter. This lives in the read loop rather than in an
                    # awk stage on purpose: mawk buffers its INPUT and emits
                    # nothing until EOF, which for a process that runs for weeks
                    # means the mirror never appears at all. `read` is unbuffered.
                    msg=${l#"[WebSDROrg] "}
                    case "$msg" in
                        "Connected to "*) after_connect=1 ;;
                        "Sending registration ping #"*|"Waiting response for ping #"*)
                            [ "${msg##*#}" = "1" ] || continue ;;
                        "#"*" OK"*|"ping #"*" OK"*)
                            n=${msg#*#}; n=${n%% *}
                            [ "$n" = "1" ] || [ "$after_connect" = "1" ] || continue
                            after_connect=0 ;;
                    esac
                    echo "$l" >> "$LOG"
                done; }) 2>&1 &
    SS_PID=$!
    log "spectrumserver running (PID $SS_PID) — full output: $(basename "$SRV_LOG")"
    sleep 2
    exec 8>&-
    sleep 3
}

# ── RADE v1 sidecar ──────────────────────────────────────────────────────────
# rade_helper.py talks to the running spectrumserver, so its lifetime is tied to
# the server's: stopped before every bring-up, started after one succeeds, and
# revived by the same watchdog loop that watches the receiver. No separate
# self-restarting loop is needed — the loop below already polls every 5s.
# Availability is decided in ONE place so the log, the watchdog and the closing
# summary can never disagree. Echoes: ok | off | missing | nopython.
# A missing sidecar is not an error — the server runs fine without it, we just
# say so instead of leaving the user wondering.
rade_state() {
    [ "${RADE_ENABLED:-1}" = "0" ] && { echo off;      return; }
    [ -f "$RADE" ]                 || { echo missing;  return; }
    command -v python3 >/dev/null 2>&1 || { echo nopython; return; }
    echo ok
}

# Human-readable reason for every non-ok state (empty when ok).
rade_reason() {
    case "$(rade_state)" in
        off)      echo "RADE disabled (RADE_ENABLED=0) — sidecar not activated" ;;
        missing)  echo "RADE not installed ($(basename "$RADE") not found) — sidecar not activated" ;;
        nopython) echo "RADE not activated — python3 not found in PATH" ;;
    esac
}

rade_wanted() { [ "$(rade_state)" = "ok" ]; }
rade_running() { pgrep -f "rade_helper\.py" >/dev/null 2>&1; }

stop_rade() {
    pkill -9 -f "rade_helper\.py" 2>/dev/null
    killall -KILL lpcnet_demo 2>/dev/null
    sleep 1
}

start_rade() {
    rade_wanted || return 0
    rade_running && return 0
    log "[RADE] sidecar starting at $(date --rfc-email)"
    python3 "$RADE" >> "$RADE_LOG" 2>&1 &
    disown 2>/dev/null
}

# ── bring the whole chain up and confirm it (polls, no fixed sleep) ──────────
bring_up() {
    local kind="$1" i failed=""
    kill_receivers
    stop_rade
    if ! start_receiver; then
        stamp; log "Server ${kind} FAILED — $RX_COMM did not start"; log " "
        return 1
    fi
    start_spectrumserver

    for i in $(seq 1 24); do
        if is_running spectrumserver && is_running "$RX_COMM"; then
            stamp
            start_rade
            [ "$kind" = "initial" ] && log "Server started normally" || log "Server restarted normally"
            log " "
            return 0
        fi
        sleep 5
    done

    is_running spectrumserver || failed="spectrumserver"
    is_running "$RX_COMM"     || failed="${failed:+$failed + }$RX_COMM"
    stamp; log "Server ${kind} FAILED — ${failed:-processes} did not come up"; log " "
    return 1
}

# ── watchdog loop: restart in place whenever a process dies ──────────────────
watchdog_loop() {
    local reason ticks=0
    while true; do
        sleep 5
        # Size-check the log every ~5 min (60 ticks) rather than every tick.
        ticks=$(( ticks + 1 ))
        if [ $(( ticks % 60 )) -eq 0 ]; then rotate_log; rotate_srv_log; fi
        reason=""
        is_running spectrumserver || reason="spectrumserver"
        is_running "$RX_COMM"     || reason="${reason:+$reason + }$RX_COMM"
        if [ -n "$reason" ]; then
            stamp
            log "PhantomSDR Server Broken: $reason — performing restart"
            log " "
            bring_up "restart"
            continue
        fi
        # Server is healthy: revive only the sidecar if it died on its own.
        if rade_wanted && ! rade_running; then
            log "[RADE] sidecar exited — restarting"
            start_rade
        fi
    done
}

# ── watchdog entry point (the detached process) ──────────────────────────────
watchdog_main() {
    exec 9>"$LOCK"
    if command -v flock >/dev/null 2>&1 && ! flock -n 9; then
        echo "$(basename "$SELF"): another watchdog is already running — exiting" >&2
        exit 0
    fi
    rotate_log
    stamp
    log "Starting the initialization script of the PhantomSDR Server ($RX_LABEL)"
    log " "
    compute_taskset
    if [ ${#SS_TASKSET[@]} -gt 0 ]; then
        log "CPU pin: ${SS_TASKSET[*]} (SPECTRUM_CORES=none to disable)"
    else
        log "CPU pin: none (unpinned)"
    fi
    report_registration
    if rade_wanted; then
        log "RADE: enabled — sidecar will start once the server is up"
    else
        log "$(rade_reason)"
    fi
    prestart
    bring_up "initial"
    watchdog_loop
}

# ── launcher entry point (what the user runs) ────────────────────────────────
# The watchdog is detached from the terminal (that is the whole point — it must
# outlive the shell), so it can only write to $LOG. To still show what is going
# on, the launcher mirrors the log to the terminal while the bring-up runs, then
# reports the outcome and exits. Killing the launcher (Ctrl-C) only stops the
# mirroring; the watchdog keeps going. -q restores the old two-line output.
launch() {
    local quiet="$1" tail_pid="" up=0 i

    echo "PhantomSDR-Plus ($RX_LABEL)"
    echo "  stopping any running instance..."
    [ -x "$STOP" ] && "$STOP" >/dev/null 2>&1
    sleep 5                        # let the device fully release after a kill

    # Mirror only what this run appends (-n 0), started before the watchdog so
    # no line is missed. -F survives the log being rotated out from under us.
    if [ "$quiet" != "quiet" ] && command -v tail >/dev/null 2>&1; then
        echo "  starting watchdog — live log below (Ctrl-C is safe, it keeps running)"
        echo "  ────────────────────────────────────────────────────────────"
        tail -n 0 -F "$LOG" 2>/dev/null &
        tail_pid=$!
    else
        echo "PhantomSDR-Plus ($RX_LABEL) starting in the background."
        echo "Progress is logged to: $LOG"
    fi

    if command -v setsid >/dev/null 2>&1; then
        setsid "$SELF" --watchdog >/dev/null 2>&1 &
    else
        nohup "$SELF" --watchdog >/dev/null 2>&1 &
    fi
    disown 2>/dev/null

    [ -n "$tail_pid" ] || exit 0

    # Worst case is ~30s of receiver retries plus the ~120s confirm poll inside
    # bring_up, so give it a little over 3 minutes before handing back the
    # prompt — the watchdog carries on either way.
    for i in $(seq 1 65); do
        sleep 3
        if is_running spectrumserver && is_running "$RX_COMM"; then up=1; break; fi
    done

    # If websdr.org registration is on, keep the mirror running a bit longer so
    # the [WebSDROrg] connect/ping/OK handshake is actually seen. It runs in a
    # thread of its own, so it lands a few seconds after the server is up.
    local org_state="off"
    if [ "$up" = 1 ] && [ "$(toml_get "websdr.org" enabled)" = "true" ]; then
        org_state="pending"
        for i in $(seq 1 15); do
            sleep 2
            if tail -n 60 "$LOG" 2>/dev/null | grep -qE '^\[WebSDROrg\] (ping )?#[0-9]+ OK'; then
                org_state="ok"; break
            fi
        done
    fi

    sleep 2                        # let the last log lines flush through tail
    kill "$tail_pid" 2>/dev/null
    wait "$tail_pid" 2>/dev/null
    echo "  ────────────────────────────────────────────────────────────"

    if [ "$up" = 1 ]; then
        echo "  ✔ server is up   (spectrumserver + $RX_COMM running)"
        if ! rade_wanted; then
            echo "  · $(rade_reason)"
        elif rade_running; then
            echo "  ✔ RADE sidecar running"
        else
            echo "  ! RADE sidecar not up — see $RADE_LOG"
        fi
        case "$org_state" in
            ok)      echo "  ✔ websdr.org registered ($(toml_get "websdr.org" public_host):$(toml_get "websdr.org" public_port))" ;;
            pending) echo "  ! websdr.org enabled but no OK yet — it retries every 30s"
                     echo "    Check: grep WebSDROrg $LOG" ;;
            *)       echo "  · websdr.org registration disabled in $(basename "$CONFIG")" ;;
        esac
        [ "$(toml_get websdr register_online)" = "true" ] \
            && echo "  · SDR directory posting enabled (errors only, in $(basename "$SRV_LOG"))"
    else
        echo "  ✖ server did not come up in time — the watchdog is still retrying."
        echo "    Check: tail -f $LOG"
    fi
    echo "  Full log: $LOG"
    exit 0
}

case "${1:-}" in
    --watchdog)          watchdog_main ;;
    ""|start|restart)    launch ;;
    -q|--quiet)          launch quiet ;;
    *) echo "usage: $(basename "$0") [start|restart|-q]" >&2; exit 1 ;;
esac
