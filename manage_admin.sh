#!/bin/bash
# ============================================================
#  PhantomSDR Admin Panel — Start / Stop manager
#  Usage:
#    ./manage_admin.sh start
#    ./manage_admin.sh stop
#    ./manage_admin.sh status
#
#  There is no 'restart' — use systemd:
#    sudo systemctl restart phantomsdr-admin phantomsdr-proxy
# ============================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PY_SCRIPT="$SCRIPT_DIR/admin_server.py"
PROXY_SCRIPT="$SCRIPT_DIR/proxy.py"
PID_FILE="$SCRIPT_DIR/admin.pid"
PROXY_PID_FILE="$SCRIPT_DIR/proxy.pid"
LOG_FILE="$SCRIPT_DIR/admin.log"
PROXY_LOG_FILE="$SCRIPT_DIR/proxy.log"

# Match the launch command by its absolute script path, anchored to the start
# of the command line. A bare pattern like 'python3.*admin_server.py' makes
# 'pgrep -f' also match unrelated command lines that merely mention the script —
# this manager itself, or a terminal running a diagnostic — which caused false
# "already running" and skipped starts. Anchoring keeps that out while still
# accepting every spelling of the interpreter actually in use:
#
#     python3 /abs/path.py                 <- this script's own nohup line
#     /usr/bin/python3 -u /abs/path.py     <- the systemd units' ExecStart
#
# Without the interpreter and -u wildcards, 'status' reported "not running"
# for a panel systemd had happily been running for weeks.
# $1 = absolute script path -> an anchored ERE for 'pgrep -f'
_cmd_pat() {
    # Escape the regex metacharacters a filesystem path can legally contain,
    # so '.' in '.py' (and a '+' or '(' in a directory name) match literally.
    local esc
    esc=$(printf '%s' "$1" | sed 's/[].[^$()*+?{|\\]/\\&/g')
    printf '^[^ ]*python3[^ ]* (-[^ ]+ )*%s($| )' "$esc"
}

ADMIN_PAT=$(_cmd_pat "$PY_SCRIPT")
PROXY_PAT=$(_cmd_pat "$PROXY_SCRIPT")

# Resolve the PID of an already-running instance, even if it wasn't started
# by this script (systemd, manual `python3 foo.py &`, a PID file lost to a
# crash). Falls back to pgrep like cmd_stop/cmd_status already do, and adopts
# the result into the PID file so subsequent start/stop/status stay in sync.
# $1 = pidfile  $2 = pgrep pattern
_find_pid() {
    local pidfile="$1" pattern="$2" pid
    if [ -f "$pidfile" ]; then
        pid=$(cat "$pidfile")
        if kill -0 "$pid" 2>/dev/null; then
            echo "$pid"
            return 0
        fi
    fi
    pid=$(pgrep -f "$pattern" | head -1)
    if [ -n "$pid" ]; then
        echo "$pid" > "$pidfile"
        echo "$pid"
        return 0
    fi
    return 1
}

cmd_start() {
    # ── Admin panel ───────────────────────────────────────────────────────────
    local PID
    if PID=$(_find_pid "$PID_FILE" "$ADMIN_PAT"); then
        echo "[!] Admin panel already running (PID=$PID)"
    else
        echo "[*] Starting admin panel..."
        nohup python3 -u "$PY_SCRIPT" >> "$LOG_FILE" 2>&1 &
        echo $! > "$PID_FILE"
        sleep 1
        if kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
            echo "[OK] Admin panel started — PID=$(cat "$PID_FILE")"
        else
            echo "[ERR] Admin panel failed to start. Check $LOG_FILE"
            rm -f "$PID_FILE"
        fi
    fi

    # ── Proxy ─────────────────────────────────────────────────────────────────
    if [ ! -f "$PROXY_SCRIPT" ]; then
        echo "[–] proxy.py not found, skipping"
        return
    fi
    local PROXY_PID
    if PROXY_PID=$(_find_pid "$PROXY_PID_FILE" "$PROXY_PAT"); then
        echo "[!] Proxy already running (PID=$PROXY_PID)"
    else
        # Check proxy dependency before starting
        if ! python3 -c "import aiohttp" 2>/dev/null; then
            echo "[ERR] aiohttp not installed — proxy cannot start."
            echo "      Fix: pip3 install aiohttp --break-system-packages"
            echo "      External access to admin panel will not work without it."
            return
        fi
        echo "[*] Starting proxy..."
        nohup python3 -u "$PROXY_SCRIPT" >> "$PROXY_LOG_FILE" 2>&1 &
        echo $! > "$PROXY_PID_FILE"
        sleep 1
        if kill -0 "$(cat "$PROXY_PID_FILE")" 2>/dev/null; then
            echo "[OK] Proxy started — PID=$(cat "$PROXY_PID_FILE")"
        else
            echo "[ERR] Proxy failed to start. Check $PROXY_LOG_FILE"
            rm -f "$PROXY_PID_FILE"
        fi
    fi
}

cmd_stop() {
    local PID PROXY_PID
    # ── Admin panel ───────────────────────────────────────────────────────────
    if [ -f "$PID_FILE" ]; then
        PID=$(cat "$PID_FILE")
    else
        PID=$(pgrep -f "$ADMIN_PAT" | head -1)
    fi
    if [ -n "$PID" ]; then
        echo "[*] Stopping admin panel (PID=$PID)..."
        kill "$PID" 2>/dev/null
        sleep 1
        kill -0 "$PID" 2>/dev/null && kill -9 "$PID" 2>/dev/null && echo "[OK] Force killed admin" || echo "[OK] Admin stopped"
    else
        echo "[–] Admin panel not running"
    fi
    rm -f "$PID_FILE"

    # ── Proxy ─────────────────────────────────────────────────────────────────
    if [ -f "$PROXY_PID_FILE" ]; then
        PROXY_PID=$(cat "$PROXY_PID_FILE")
    else
        PROXY_PID=$(pgrep -f "$PROXY_PAT" | head -1)
    fi
    if [ -n "$PROXY_PID" ]; then
        echo "[*] Stopping proxy (PID=$PROXY_PID)..."
        kill "$PROXY_PID" 2>/dev/null
        sleep 1
        kill -0 "$PROXY_PID" 2>/dev/null && kill -9 "$PROXY_PID" 2>/dev/null && echo "[OK] Force killed proxy" || echo "[OK] Proxy stopped"
    else
        echo "[–] Proxy not running"
    fi
    rm -f "$PROXY_PID_FILE"
}

cmd_status() {
    # Admin panel
    if [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
        echo "[✓] Admin panel running — PID=$(cat "$PID_FILE")"
    else
        PID=$(pgrep -f "$ADMIN_PAT" | head -1)
        [ -n "$PID" ] && echo "[✓] Admin panel running — PID=$PID (no pid file)" || echo "[✗] Admin panel not running"
    fi
    # Proxy
    if [ -f "$PROXY_PID_FILE" ] && kill -0 "$(cat "$PROXY_PID_FILE")" 2>/dev/null; then
        echo "[✓] Proxy running — PID=$(cat "$PROXY_PID_FILE")"
    else
        PROXY_PID=$(pgrep -f "$PROXY_PAT" | head -1)
        [ -n "$PROXY_PID" ] && echo "[✓] Proxy running — PID=$PROXY_PID (no pid file)" || echo "[✗] Proxy not running"
    fi
}

case "$1" in
    start)   cmd_start ;;
    stop)    cmd_stop ;;
    # 'restart' was removed deliberately. It killed the panel and started its
    # own unmanaged copy; with the systemd units enabled, systemd starts a
    # second copy five seconds later and the two fight over port 3000.
    restart)
        echo "[ERR] 'restart' has been removed from this script."
        echo "      Under systemd (the normal setup) use:"
        echo "          sudo systemctl restart phantomsdr-admin phantomsdr-proxy"
        echo "      Without the units installed, run stop then start:"
        echo "          $0 stop && $0 start"
        exit 1
        ;;
    status)  cmd_status ;;
    *)
        echo "Usage: $0 {start|stop|status}"
        exit 1
        ;;
esac
