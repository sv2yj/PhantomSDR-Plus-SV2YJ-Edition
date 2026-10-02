#!/bin/bash

# ─────────────────────────────────────────────
#  PhantomSDR-Plus  –  RADE sidecar control
#  Usage: ./rade.sh {start|stop|restart|status}
# ─────────────────────────────────────────────

PHANTOMDIR="${PHANTOMDIR:-$HOME/PhantomSDR-Plus}"
SCRIPT="$PHANTOMDIR/rade_helper.py"
LOGFILE="$PHANTOMDIR/rade.log"
PIDFILE="$PHANTOMDIR/rade.pid"

# ── Helpers ────────────────────────────────────────────────────────────────

_is_running() {
    # Check both the watchdog loop and the python process
    pgrep -f "rade_helper.py" > /dev/null 2>&1
}

_kill_all() {
    # Step 1: kill via PID file (the watchdog loop we started)
    if [ -f "$PIDFILE" ]; then
        WPID=$(cat "$PIDFILE" 2>/dev/null)
        [ -n "$WPID" ] && kill -9 "$WPID" 2>/dev/null
        rm -f "$PIDFILE"
    fi

    # Step 2: kill ALL bash/sh watchdog loops that reference rade_helper.py.
    # This catches leftover loops from previous rade.sh start calls or manual
    # launches — the PID file only tracks the last one started.
    ps ax -o pid,cmd 2>/dev/null \
        | grep "rade_helper" \
        | grep -v "python3" \
        | grep -v grep \
        | awk '{print $1}' \
        | xargs -r kill -9 2>/dev/null

    # Step 3: kill all python3 rade_helper.py instances
    pkill -9 -f "rade_helper.py" 2>/dev/null

    # Step 4: kill any lpcnet_demo children
    killall -KILL lpcnet_demo 2>/dev/null

    sleep 2

    # Step 5: final pass — kill anything that survived the above
    pkill -9 -f "rade_helper.py" 2>/dev/null
    killall -KILL lpcnet_demo 2>/dev/null
}

_wait_up() {
    local i
    for i in 1 2 3 4 5; do
        sleep 1
        if _is_running; then
            return 0
        fi
    done
    return 1
}

# ── Commands ───────────────────────────────────────────────────────────────

do_status() {
    if _is_running; then
        echo "[RADE] Running"
        ps aux | grep "rade_helper.py" | grep -v grep | grep -v color
    else
        echo "[RADE] Stopped"
    fi
}

do_stop() {
    if ! _is_running; then
        echo "[RADE] Already stopped"
        return 0
    fi
    echo "[RADE] Stopping..."
    _kill_all
    if _is_running; then
        echo "[RADE] ERROR: still running after kill"
        return 1
    fi
    echo "[RADE] Stopped"
}

do_start() {
    if _is_running; then
        echo "[RADE] Already running"
        do_status
        return 0
    fi

    if [ ! -f "$SCRIPT" ]; then
        echo "[RADE] ERROR: $SCRIPT not found"
        return 1
    fi

    echo "[RADE] Starting..."

    # Self-restarting watchdog loop.
    # We exec bash so $! is the PID of the bash process running the loop,
    # not an intermediate subshell — this makes kill -9 $WPID reliable.
    bash -c "
        while true; do
            echo \"[RADE] sidecar starting at \$(date --rfc-email)\" >> \"$LOGFILE\"
            python3 \"$SCRIPT\" >> \"$LOGFILE\" 2>&1
            echo \"[RADE] sidecar exited at \$(date --rfc-email) — restarting in 3s\" >> \"$LOGFILE\"
            sleep 3
        done
    " &
    WATCHDOG_PID=$!
    echo $WATCHDOG_PID > "$PIDFILE"
    disown $WATCHDOG_PID

    if _wait_up; then
        echo "[RADE] Started (watchdog PID $WATCHDOG_PID)"
        echo "[RADE] Log: tail -f $LOGFILE"
    else
        echo "[RADE] ERROR: failed to start — check $LOGFILE"
        return 1
    fi
}

do_restart() {
    echo "[RADE] Restarting..."
    do_stop
    sleep 1
    do_start
}

# ── Main ───────────────────────────────────────────────────────────────────

case "$1" in
    start)   do_start   ;;
    stop)    do_stop    ;;
    restart) do_restart ;;
    status)  do_status  ;;
    *)
        echo "Usage: $0 {start|stop|restart|status}"
        echo ""
        echo "  start    Start the RADE sidecar (self-restarting watchdog)"
        echo "  stop     Stop the RADE sidecar and its watchdog"
        echo "  restart  Stop then start"
        echo "  status   Show whether RADE is running"
        echo ""
        echo "Log:  tail -f $LOGFILE"
        exit 1
        ;;
esac
