#!/bin/bash
# ============================================================
#  PhantomSDR-Plus WebSDR Relay — Setup Script
#  Run from inside your PhantomSDR-Plus directory:
#    chmod +x setup_websdr_relay.sh && ./setup_websdr_relay.sh
#
#  The relay lets receive diversity use a WebSDR (PA3FWM's websdr.org
#  software) as the second receiver. WebSDR refuses the browser's audio
#  WebSocket because of its Origin header, which no script may change, so
#  the connection has to be made from this server instead.
#
#  This script asks for the port, who to identify the station as, and
#  whether to run under systemd or by hand. Everything it writes can be
#  changed later by editing websdr_relay.json.
#
#  Manual: docs/RECEIVE_DIVERSITY.md
# ============================================================

set -e

# Running as root: sudo is unnecessary, and minimal images do not ship it at
# all. Make it a transparent no-op in that one case; a non-root user without
# sudo still gets the original error, which is the right thing to tell them.
if [ "$(id -u)" -eq 0 ] && ! command -v sudo >/dev/null 2>&1; then
    sudo() { "$@"; }
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RELAY_PY="$SCRIPT_DIR/websdr_relay.py"
CONFIG="$SCRIPT_DIR/websdr_relay.json"
SITE_INFO="$SCRIPT_DIR/frontend/site_information.json"
SOURCE_JS="$SCRIPT_DIR/frontend/src/webSdrSource.js"
UNIT_NAME="phantomsdr-websdr-relay"
UNIT_PATH="/etc/systemd/system/$UNIT_NAME.service"

DEFAULT_PORT=9000
DEFAULT_CAP=10
DEFAULT_TOTAL=60

# ── Prompt helpers ────────────────────────────────────────────────────────────
# Same house style as setup_admin.sh: the default letter capitalised and
# coloured inside the brackets, and spelled out after them, so pressing ENTER
# on its own is never ambiguous.
ask_yn() {
    local prompt="$1" default="$2" varname="$3" ans hint word
    prompt="${prompt%"${prompt##*[![:space:]]}"}"
    prompt="${prompt%:}"
    local yn_re='[[:space:]]*[([](y/n|yes/no)[])]$'
    shopt -s nocasematch
    while [[ "$prompt" =~ $yn_re ]]; do
        prompt="${prompt%"${BASH_REMATCH[0]}"}"
        prompt="${prompt%:}"
    done
    shopt -u nocasematch
    if [ "$default" = "y" ]; then
        hint="\033[1;32mY\033[0m/n"; word="Yes"
    else
        hint="y/\033[1;31mN\033[0m"; word="No"
    fi
    printf '%s [%b]  \033[90m(ENTER = %s)\033[0m: ' "$prompt" "$hint" "$word"
    if ! read -r ans; then
        echo ""
        echo "   (no input — using the default: $word)"
        ans=""
    fi
    ans="${ans:-$default}"
    case "$ans" in
        [Yy]*) eval "$varname=y" ;;
        *)     eval "$varname=n" ;;
    esac
}

ask_value() {
    local prompt="$1" default="$2" varname="$3" ans
    printf '%s \033[90m(ENTER = %s)\033[0m: ' "$prompt" "$default"
    if ! read -r ans; then echo ""; ans=""; fi
    eval "$varname=\"\${ans:-\$default}\""
}

# Read one string field out of site_information.json without needing jq.
site_field() {
    [ -f "$SITE_INFO" ] || return 0
    python3 - "$SITE_INFO" "$1" <<'PY' 2>/dev/null || true
import json, sys
try:
    with open(sys.argv[1]) as f:
        print(str(json.load(f).get(sys.argv[2], "")).strip())
except Exception:
    pass
PY
}

echo ""
echo "=========================================================="
echo "  PhantomSDR-Plus — WebSDR diversity relay setup"
echo "=========================================================="
echo ""

# ── 1. Sanity ─────────────────────────────────────────────────────────────────
if [ ! -f "$RELAY_PY" ]; then
    echo "[ERR] websdr_relay.py not found next to this script."
    echo "      Run it from inside your PhantomSDR-Plus directory."
    exit 1
fi

if ! command -v python3 >/dev/null 2>&1; then
    echo "[ERR] python3 is not installed."
    exit 1
fi

if ! python3 -c "import aiohttp" >/dev/null 2>&1; then
    echo "[!]  The relay needs the Python package 'aiohttp', which is missing."
    ask_yn "Install it now?" y INSTALL_AIOHTTP
    if [ "$INSTALL_AIOHTTP" = "y" ]; then
        # PEP 668 marks system Python as externally managed on modern distros;
        # the distro package is the polite route, pip the fallback.
        if command -v apt-get >/dev/null 2>&1; then
            sudo apt-get update -qq && sudo apt-get install -y python3-aiohttp || \
                pip3 install aiohttp --break-system-packages
        elif command -v dnf >/dev/null 2>&1; then
            sudo dnf install -y python3-aiohttp || pip3 install aiohttp --break-system-packages
        elif command -v pacman >/dev/null 2>&1; then
            sudo pacman -S --noconfirm python-aiohttp || pip3 install aiohttp --break-system-packages
        elif command -v zypper >/dev/null 2>&1; then
            sudo zypper install -y python3-aiohttp || pip3 install aiohttp --break-system-packages
        else
            pip3 install aiohttp --break-system-packages
        fi
        python3 -c "import aiohttp" >/dev/null 2>&1 || {
            echo "[ERR] aiohttp still missing. Install it and re-run."
            exit 1
        }
        echo "[OK] aiohttp installed."
    else
        echo "     Nothing written. Install aiohttp and re-run."
        exit 1
    fi
fi
echo "[OK] python3 and aiohttp present."
echo ""

# ── 2. Who we are ─────────────────────────────────────────────────────────────
echo "----------------------------------------------------------"
echo " Identifying this station"
echo "----------------------------------------------------------"
echo ""
echo " Every connection the relay makes carries a User-Agent naming your site"
echo " and callsign. That is what lets a WebSDR operator who would rather not"
echo " be used this way find out who to write to. Please do not leave it blank."
echo ""

SYSOP="$(site_field siteSysop)"
EMAIL="$(site_field siteSysopEmailAddress)"
SITE_URL="$(site_field siteIP)"
[ -n "$SITE_URL" ] || SITE_URL="http://$(hostname -I 2>/dev/null | awk '{print $1}'):8900"

DEFAULT_OPERATOR="$SYSOP"
[ -n "$EMAIL" ] && DEFAULT_OPERATOR="$SYSOP <$EMAIL>"
[ -n "$DEFAULT_OPERATOR" ] || DEFAULT_OPERATOR="unknown"

if [ -n "$SYSOP" ]; then
    echo " Taken from frontend/site_information.json:"
    echo "   sysop : $SYSOP"
    [ -n "$EMAIL" ] && echo "   email : $EMAIL"
    echo "   site  : $SITE_URL"
    echo ""
fi

ask_value " Public URL of this receiver" "$SITE_URL" SITE_URL
ask_value " Operator (callsign and contact)" "$DEFAULT_OPERATOR" OPERATOR
echo ""

# ── 3. Port ───────────────────────────────────────────────────────────────────
echo "----------------------------------------------------------"
echo " Network"
echo "----------------------------------------------------------"
echo ""
echo " The relay listens on its own port. Visitors' browsers connect to it"
echo " DIRECTLY — it is not proxied through the spectrumserver — so this port"
echo " has to be reachable from wherever your listeners are."
echo ""

# Whatever the frontend was built with is the honest default: change one
# without the other and the panel reports "the relay is not reachable".
BUILT_PORT="$(grep -oP 'DEFAULT_RELAY_PORT\s*=\s*\K[0-9]+' "$SOURCE_JS" 2>/dev/null || true)"
[ -n "$BUILT_PORT" ] || BUILT_PORT="$DEFAULT_PORT"

ask_value " Relay port" "$BUILT_PORT" PORT
if ! [[ "$PORT" =~ ^[0-9]+$ ]] || [ "$PORT" -lt 1 ] || [ "$PORT" -gt 65535 ]; then
    echo "[ERR] '$PORT' is not a valid port."
    exit 1
fi

if command -v ss >/dev/null 2>&1 && ss -ltn 2>/dev/null | grep -q ":$PORT "; then
    echo ""
    echo "[!]  Something is already listening on port $PORT."
    echo "     If that is an older relay, stop it before starting a new one."
    echo ""
fi

# The browser looks for the relay on a port compiled into the frontend. If the
# two disagree the feature simply cannot work, so offer to fix it here rather
# than leaving a mismatch to be discovered later in the panel.
REBUILD_NEEDED=n
if [ "$PORT" != "$BUILT_PORT" ]; then
    echo ""
    echo "[!]  The frontend is built to look for the relay on port $BUILT_PORT,"
    echo "     but you chose $PORT. They must match."
    ask_yn " Update frontend/src/webSdrSource.js to $PORT?" y FIX_JS
    if [ "$FIX_JS" = "y" ]; then
        sed -i "s/DEFAULT_RELAY_PORT = $BUILT_PORT/DEFAULT_RELAY_PORT = $PORT/" "$SOURCE_JS"
        echo "[OK] webSdrSource.js now points at port $PORT."
        REBUILD_NEEDED=y
    else
        echo "[!]  Left alone. WebSDR diversity will not work until they agree."
    fi
fi
echo ""

ask_value " Max concurrent sessions to ONE WebSDR site" "$DEFAULT_CAP" CAP
ask_value " Max concurrent sessions overall" "$DEFAULT_TOTAL" TOTAL
echo ""
echo " The per-site cap is what keeps your relay from looking like a swarm to"
echo " a small club receiver. Raising it is a decision about someone else's"
echo " bandwidth, not only your own."
echo ""

# ── 4. Write the config ───────────────────────────────────────────────────────
if [ -f "$CONFIG" ]; then
    echo "[!]  $CONFIG already exists:"
    sed 's/^/       /' "$CONFIG"
    ask_yn " Overwrite it?" y OVERWRITE
    if [ "$OVERWRITE" != "y" ]; then
        echo "     Keeping the existing file. Nothing else was changed."
        exit 0
    fi
    cp "$CONFIG" "$CONFIG.bak"
    echo "[OK] Previous config saved as websdr_relay.json.bak"
fi

python3 - "$CONFIG" "$PORT" "$CAP" "$TOTAL" "$SITE_URL" "$OPERATOR" <<'PY'
import json, sys
path, port, cap, total, site, operator = sys.argv[1:7]
cfg = {
    "port": int(port),
    "bind": "0.0.0.0",
    "max_per_host": int(cap),
    "max_total": int(total),
    "site": site,
    "operator": operator,
}
with open(path, "w") as f:
    json.dump(cfg, f, indent=2)
    f.write("\n")
PY
echo "[OK] Wrote $CONFIG"
echo ""

# ── 5. Firewall ───────────────────────────────────────────────────────────────
if command -v ufw >/dev/null 2>&1 && sudo -n ufw status 2>/dev/null | grep -q "Status: active"; then
    echo "----------------------------------------------------------"
    echo " Firewall"
    echo "----------------------------------------------------------"
    echo ""
    ask_yn " ufw is active. Allow incoming TCP $PORT?" y OPEN_FW
    if [ "$OPEN_FW" = "y" ]; then
        sudo ufw allow "$PORT"/tcp && echo "[OK] ufw now allows $PORT/tcp."
    else
        echo "[!]  Left closed. Listeners outside this machine will not connect."
    fi
    echo ""
fi

# ── 6. systemd or by hand ─────────────────────────────────────────────────────
echo "----------------------------------------------------------"
echo " How should the relay run?"
echo "----------------------------------------------------------"
echo ""
echo " [1] As a systemd service — starts at boot, restarts on failure."
echo " [2] By hand — you run it in a terminal when you want it."
echo ""
printf ' Select [1/2] \033[90m(ENTER = 1)\033[0m: '
read -r RUN_MODE || RUN_MODE=""
RUN_MODE="${RUN_MODE:-1}"
echo ""

if [ "$RUN_MODE" = "1" ]; then
    if ! command -v systemctl >/dev/null 2>&1; then
        echo "[!]  No systemctl on this machine — falling back to manual."
        RUN_MODE=2
    fi
fi

if [ "$RUN_MODE" = "1" ]; then
    TMP_UNIT="$(mktemp)"
    cat > "$TMP_UNIT" << UNIT
# WebSDR relay for PhantomSDR-Plus receive diversity.
# Written by setup_websdr_relay.sh. Settings live in websdr_relay.json;
# edit that and 'systemctl restart $UNIT_NAME'.

[Unit]
Description=PhantomSDR-Plus WebSDR diversity relay
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=$(id -un)
WorkingDirectory=$SCRIPT_DIR
ExecStart=$(command -v python3) $RELAY_PY
Restart=on-failure
RestartSec=5

# It only makes outbound WebSocket connections and serves one port; it needs
# nothing else on the machine.
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=read-only
ProtectKernelTunables=true
ProtectControlGroups=true
RestrictAddressFamilies=AF_INET AF_INET6

[Install]
WantedBy=multi-user.target
UNIT

    # ProtectHome=read-only would stop the relay writing anywhere under /home,
    # which is where this checkout usually lives. It only ever reads its own
    # config, so read-only is right — but say so, because a future change that
    # needs to write will fail in a way that looks like a permissions bug.
    sudo cp "$TMP_UNIT" "$UNIT_PATH"
    rm -f "$TMP_UNIT"
    sudo systemctl daemon-reload

    # Restart, not start: re-running this script on a machine whose unit is
    # already up must pick up the new config rather than report "already
    # running" and leave the old settings live.
    sudo systemctl enable "$UNIT_NAME" >/dev/null 2>&1 || true
    sudo systemctl restart "$UNIT_NAME"
    sleep 2
    if systemctl is-active --quiet "$UNIT_NAME"; then
        echo "[OK] $UNIT_NAME is running and enabled at boot."
    else
        echo "[ERR] The service did not start. Look at:"
        echo "      systemctl status $UNIT_NAME"
        echo "      journalctl -u $UNIT_NAME -n 30"
        exit 1
    fi
else
    echo "[OK] Start it yourself with:"
    echo ""
    echo "      cd $SCRIPT_DIR && python3 websdr_relay.py"
    echo ""
    echo "     It runs in the foreground and logs to the terminal."
fi
echo ""

# ── 7. Verify ─────────────────────────────────────────────────────────────────
if [ "$RUN_MODE" = "1" ]; then
    echo "----------------------------------------------------------"
    echo " Check"
    echo "----------------------------------------------------------"
    echo ""
    if command -v curl >/dev/null 2>&1; then
        if curl -fsS --max-time 5 "http://127.0.0.1:$PORT/status" >/dev/null 2>&1; then
            echo "[OK] The relay answers on 127.0.0.1:$PORT"
            curl -fsS --max-time 5 "http://127.0.0.1:$PORT/status" | sed 's/^/       /'
            echo ""
        else
            echo "[!]  No answer on 127.0.0.1:$PORT — check the service log."
        fi
    fi
fi

# ── 8. What is left for a human ───────────────────────────────────────────────
echo "=========================================================="
echo "  Done"
echo "=========================================================="
echo ""
echo " Still to do by hand:"
echo ""
echo "  1. FORWARD TCP $PORT on your router to this machine."
echo "     Listeners' browsers reach the relay directly, so without this"
echo "     WebSDR diversity works only from inside your own network."
echo ""
if [ "$REBUILD_NEEDED" = "y" ]; then
echo "  2. REBUILD THE FRONTEND — the relay port changed:"
echo "        cd $SCRIPT_DIR && ./recompile.sh      (option 2)"
echo "     then restart the receiver as usual."
echo ""
fi
echo " Then, in the receiver page: expand Receive Diversity, choose WebSDR,"
echo " type the site's address (for example websdr.ewi.utwente.nl:8901) and"
echo " press Start."
echo ""
echo " Live sessions:  curl -s localhost:$PORT/status"
echo " Settings:       $CONFIG"
echo ""
if [ "$RUN_MODE" = "1" ]; then
echo " Service:        sudo systemctl {status,restart,stop} $UNIT_NAME"
echo ""
fi
