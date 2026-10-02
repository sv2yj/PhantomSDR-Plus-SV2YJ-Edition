#!/bin/bash
# ============================================================
#  PhantomSDR-Plus Admin Panel — Setup Script
#  Run from inside your PhantomSDR-Plus directory:
#    chmod +x setup_admin.sh && ./setup_admin.sh
#
#  Asks for: ports, the start/stop scripts the panel drives the receiver with,
#  and how far the CPU over-temperature guard may act on its own. Everything
#  here can be changed later in the panel (Settings) — nothing is one-way.
#
#  Thermal guard manual: docs/THERMAL_GUARD.md
# ============================================================

set -e

# Running as root: sudo is unnecessary, and minimal images (containers, some
# VPS base images) do not ship it at all — every "sudo apt-get" below then dies
# with "sudo: command not found" halfway through the install. Make it a
# transparent no-op in that one case. A non-root user without sudo still gets
# the original error, which is the right thing to tell them.
if [ "$(id -u)" -eq 0 ] && ! command -v sudo >/dev/null 2>&1; then
    sudo() { "$@"; }
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ── Sudoers drop-in ───────────────────────────────────────────────────────────
# Every restart of the two units needs a sudo password. Fine at a terminal, but
# it blocks anything without a TTY — a script, a cron job, an SSH command, an
# agent — which fails in a confusing way: the command appears to run and the
# services are simply never restarted. This writes a drop-in lifting the
# password for these two units only.
#
# A function because there are two ways in: the prompt at the end of the
# service install (fresh machines) and --sudoers (machines whose units already
# exist, where re-running the service install would restart both units for
# no reason). Both must generate exactly the same rule.
install_sudoers_rule() {
    local tmp systemctl_bin
    tmp="$(mktemp)"
    # '|| true' matters: command -v exits non-zero when the binary is missing,
    # and under 'set -e' the bare assignment would kill the script before the
    # explanation below could be printed.
    systemctl_bin="$(command -v systemctl || true)"
    if [ -z "$systemctl_bin" ]; then
        echo "[!]  No systemctl on this machine — a sudoers rule for it would"
        echo "     be meaningless. Nothing written."
        rm -f "$tmp"
        return 1
    fi
    # sudoers matches the entire command line, so every verb and unit is spelled
    # out and the two-unit form appears in both orderings; anything else still
    # prompts for a password.
    cat > "$tmp" << SUDOERS
# PhantomSDR-Plus — password-free control of the panel and proxy units.
# Written by setup_admin.sh. Scoped to these verbs and these two units only;
# it grants no shell and touches no other service.
#
# The units set KillMode=process, so restarting the panel no longer takes the
# receiver down with it. Restarting phantomsdr-proxy still drops the WebSocket
# connections it is proxying, so listeners reconnect.
Cmnd_Alias PHANTOMSDR_UNITS = \\
    $systemctl_bin restart phantomsdr-admin, \\
    $systemctl_bin restart phantomsdr-proxy, \\
    $systemctl_bin restart phantomsdr-admin phantomsdr-proxy, \\
    $systemctl_bin restart phantomsdr-proxy phantomsdr-admin, \\
    $systemctl_bin start phantomsdr-admin, \\
    $systemctl_bin start phantomsdr-proxy, \\
    $systemctl_bin start phantomsdr-admin phantomsdr-proxy, \\
    $systemctl_bin stop phantomsdr-admin, \\
    $systemctl_bin stop phantomsdr-proxy, \\
    $systemctl_bin stop phantomsdr-admin phantomsdr-proxy, \\
    $systemctl_bin status phantomsdr-admin, \\
    $systemctl_bin status phantomsdr-proxy, \\
    $systemctl_bin is-active phantomsdr-admin, \\
    $systemctl_bin is-active phantomsdr-proxy

$(whoami) ALL=(root) NOPASSWD: PHANTOMSDR_UNITS
SUDOERS
    # Validate before installing. A syntactically broken file in /etc/sudoers.d
    # can lock the machine out of sudo entirely, so a rule that does not parse
    # must never reach the directory.
    if visudo -c -f "$tmp" >/dev/null 2>&1 ||
       /usr/sbin/visudo -c -f "$tmp" >/dev/null 2>&1; then
        # 0440 root:root — sudo ignores a drop-in that any other user could
        # edit, so 'install' sets mode and owner in one step.
        if sudo install -m 0440 -o root -g root "$tmp" /etc/sudoers.d/phantomsdr; then
            echo "[OK] /etc/sudoers.d/phantomsdr installed"
            echo "     Test it: sudo -n systemctl is-active phantomsdr-admin"
        else
            echo "[!]  Could not write /etc/sudoers.d/phantomsdr."
        fi
    else
        echo "[!]  The generated rule failed visudo -c — not installed."
        echo "     Nothing was written to /etc/sudoers.d."
    fi
    rm -f "$tmp"
}

# ── --sudoers: install just the rule, then stop ───────────────────────────────
# For an existing install. The prompt below lives inside the branch that writes
# the unit files, so a sysop who already has them never reaches it, and the only
# other route — re-running the service install — rewrites both units and
# restarts them, dropping listeners to change one file in /etc/sudoers.d.
# This path touches nothing else and restarts nothing.
case "${1:-}" in
    --sudoers)
        echo ""
        echo "PhantomSDR-Plus — sudoers rule only (no services touched)"
        echo ""
        install_sudoers_rule
        exit $?
        ;;
    --help|-h)
        echo "Usage: $0 [--sudoers]"
        echo ""
        echo "  (no arguments)  full interactive setup: ports, scripts, thermal"
        echo "                  guard, optional systemd units"
        echo "  --sudoers       install only /etc/sudoers.d/phantomsdr, so the"
        echo "                  two units can be restarted without a password."
        echo "                  For installs that already have the units."
        exit 0
        ;;
    "") ;;
    *)
        echo "[ERROR] Unknown option: $1"
        echo "        Try: $0 --help"
        exit 1
        ;;
esac

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║      PhantomSDR-Plus Admin Panel — Setup             ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""

# ── Sanity checks ─────────────────────────────────────────────────────────────
if ! command -v python3 &>/dev/null; then
    echo "[ERROR] python3 not found. Install: sudo apt install python3"
    exit 1
fi
echo "[OK] $(python3 --version)"

if [ ! -f "$SCRIPT_DIR/admin_server.py" ]; then
    echo "[ERROR] admin_server.py not found in $SCRIPT_DIR"
    echo "        Run this script from the PhantomSDR-Plus directory."
    exit 1
fi
echo "[OK] admin_server.py found"

if [ ! -f "$SCRIPT_DIR/manage_admin.sh" ]; then
    echo "[ERROR] manage_admin.sh not found in $SCRIPT_DIR"
    exit 1
fi
echo "[OK] manage_admin.sh found"
echo ""

# ── Upstream host ────────────────────────────────────────────────────────────
# The proxy reaches spectrumserver over loopback. This used to be the machine's
# LAN IP, auto-detected here, because spectrumserver closed loopback WebSockets;
# it no longer does (see src/websocket.cpp on_open). Loopback is the better
# choice: it survives DHCP lease changes and network outages, and it removes the
# guesswork of picking the "right" interface on a host with docker0, vmnet*,
# virbr0 or a VPN. Edit sdr_host in admin_config.json only if spectrumserver
# runs on a different machine than the proxy.
SDR_HOST="127.0.0.1"

# ── Port helper ───────────────────────────────────────────────────────────────
# ask_port <label> <varname> <default>
#
# Takes a default on a bare Enter, and — this is the part that matters — never
# loops forever. The original re-asked on any invalid answer with no default and
# no way out, so a run whose stdin is not a terminal spun until it was killed:
# EOF gave it an empty answer, empty was invalid, and it asked again. Piping
# anything into this script (unattended install, cron, ssh, CI) hung here and
# wrote the same error line until the disk or someone's patience ran out.
#
# Two exits now. EOF takes the default immediately — there is no point asking a
# closed stdin twice. A stream of answers that are simply wrong gives up after
# ASK_PORT_TRIES and takes the default too.
ASK_PORT_TRIES=5
ask_port() {
    local label="$1"
    local varname="$2"
    local default="$3"
    local value tries=0
    while true; do
        if ! read -rp "$label [$default]: " value; then
            echo ""
            echo "[WARN] $label: no input (EOF) — using the default $default"
            eval "$varname=$default"
            return 0
        fi
        value="${value:-$default}"
        if [[ "$value" =~ ^[0-9]+$ ]] && [ "$value" -ge 1 ] && [ "$value" -le 65535 ]; then
            eval "$varname=$value"
            echo "[OK] $label: $value"
            return 0
        fi
        tries=$((tries + 1))
        if [ "$tries" -ge "$ASK_PORT_TRIES" ]; then
            echo "[WARN] $label: ${tries} invalid answers — using the default $default"
            eval "$varname=$default"
            return 0
        fi
        echo "[ERROR] Enter a valid port number (1-65535), or press Enter for $default."
    done
}

# ask_yn <prompt> <default: y|n> <varname>
#
# Same contract as ask_port for the yes/no questions. The important part is the
# `if ! read` test: this script runs under `set -e`, and a bare `read` that hits
# EOF returns non-zero, which kills the whole script on the spot. That is how an
# unattended run died halfway through with "Admin panel setup did not finish" —
# nothing was wrong, stdin had simply run out. Testing the status makes it a
# handled condition instead of a fatal one.
#
# The default is never shown in lower case. Whatever the caller wrote at the end
# of its prompt — "(y/n)", "[Y/n]", a trailing colon — is stripped off and
# replaced by one house style: the default letter capitalised and coloured
# inside the brackets, and the same answer spelled out in full after them, so
# that pressing ENTER on its own is unambiguous.
ask_yn() {
    local prompt="$1" default="$2" varname="$3" ans hint word

    prompt="${prompt%"${prompt##*[![:space:]]}"}"          # trailing whitespace
    prompt="${prompt%:}"                                    # trailing colon
    # A bracketed y/n hint at the very end, in either bracket style. Kept in a
    # variable: written inline, the brackets would have to be escaped, and an
    # escaped bracket inside a bracket expression matches a backslash, not a
    # bracket — the regex then silently never fires.
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

# ── Ports ─────────────────────────────────────────────────────────────────────
# Defaults are the worked example in docs/ADMIN_PANEL_SETUP.md: 8900 is what
# every config-*.toml in the repository ships with.
echo "Enter the port numbers for your setup (Enter accepts the default):"
echo ""
ask_port "PhantomSDR server port (spectrumserver)"  SDR_PORT   8900
ask_port "Admin panel internal port"                ADMIN_PORT 3000
ask_port "Proxy public port (combines SDR + admin)" PROXY_PORT 8902
echo ""

# ── Python dependencies ───────────────────────────────────────────────────────
# flask  → the panel itself          psutil    → CPU/RAM figures and the Graphs page
# aiohttp→ proxy.py                  tomli-w   → writing config.toml from the panel
# tomli  → reading config.toml on Python < 3.11 (3.11+ has tomllib built in)
echo "[*] Installing Python dependencies..."
PY_DEPS="flask psutil aiohttp tomli-w"
python3 -c 'import tomllib' 2>/dev/null || PY_DEPS="$PY_DEPS tomli"
pip3 install $PY_DEPS --break-system-packages 2>/dev/null || \
pip3 install $PY_DEPS --user 2>/dev/null || \
echo "[WARN] Auto-install failed. Run manually: pip3 install $PY_DEPS"

# ── ss capability (fallback path of the Kick Users feature) ──────────────────
# Kicking normally goes through proxy.py, which closes the WebSocket from inside
# its own process and needs no privilege at all. The 'ss -K' path below is only
# used when the panel runs standalone, without the proxy in front of it.
echo ""
SS_BIN="$(which ss 2>/dev/null || echo /usr/bin/ss)"
if command -v getcap &>/dev/null && getcap "$SS_BIN" 2>/dev/null | grep -q cap_net_admin; then
    echo "[OK] ss already has cap_net_admin"
else
    echo "[*] Granting ss cap_net_admin (Kick Users without the proxy)..."
    if sudo setcap cap_net_admin+ep "$SS_BIN" 2>/dev/null; then
        echo "[OK] setcap applied to $SS_BIN"
    else
        echo "[WARN] Could not set capability. Kicking still works through the proxy."
        echo "       Run manually later: sudo setcap cap_net_admin+ep $SS_BIN"
    fi
fi

# ── Start / stop scripts ──────────────────────────────────────────────────────
# The panel drives the receiver through these two, and so does the thermal guard:
# its stop+restart mode can only restart if start_script is set here.
ask_choice() {
    local label="$1" varname="$2"; shift 2
    local opts=("$@") i ans
    if [ ${#opts[@]} -eq 0 ]; then
        eval "$varname=''"
        echo "[WARN] $label: no candidates found — set it later in Settings"
        return
    fi
    echo "$label"
    for i in "${!opts[@]}"; do printf "   %d) %s\n" $((i+1)) "${opts[$i]}"; done
    echo "   0) none — set it later in the panel (Settings)"
    local tries=0
    while true; do
        if ! read -rp "   choice [0-${#opts[@]}]: " ans; then
            echo ""
            echo "   (no input — choosing none)"
            ans=0
        fi
        [ -z "$ans" ] && ans=0
        if [[ "$ans" =~ ^[0-9]+$ ]] && [ "$ans" -le "${#opts[@]}" ]; then
            if [ "$ans" -eq 0 ]; then
                eval "$varname=''"; echo "   [OK] none"
            else
                eval "$varname=\"\${opts[\$((ans-1))]}\""
                echo "   [OK] ${opts[$((ans-1))]}"
            fi
            break
        fi
        tries=$((tries + 1))
        if [ "$tries" -ge "$ASK_PORT_TRIES" ]; then
            eval "$varname=''"
            echo "   [WARN] $tries invalid answers — choosing none"
            break
        fi
        echo "   [ERROR] Enter a number between 0 and ${#opts[@]}."
    done
}

echo ""
echo "── Receiver control scripts ──────────────────────────────────────────"
mapfile -t START_OPTS < <(cd "$SCRIPT_DIR" && ls -1 start-*.sh 2>/dev/null)
mapfile -t STOP_OPTS  < <(cd "$SCRIPT_DIR" && ls -1 stop-*.sh 2>/dev/null)
ask_choice "Script that STARTS the receiver:" START_SCRIPT "${START_OPTS[@]}"
echo ""
ask_choice "Script that STOPS the receiver:"  STOP_SCRIPT  "${STOP_OPTS[@]}"

# ── CPU over-temperature guard ────────────────────────────────────────────────
# The guard runs inside the panel — no extra service, no browser, no login. All
# that has to be decided here is how far it is allowed to go on its own.
# Full manual: docs/THERMAL_GUARD.md
THERMAL_MODE=""
if [ -f "$SCRIPT_DIR/thermal_guard.py" ]; then
    echo ""
    echo "── CPU over-temperature guard ────────────────────────────────────────"
    python3 "$SCRIPT_DIR/thermal_guard.py" --once 2>/dev/null || \
        echo "[WARN] Could not read a CPU sensor — the guard will stay idle."
    echo ""
    echo "   1) log          — record temperatures only, never act"
    echo "   2) throttle     — lower the CPU clock, never interrupt service"
    echo "   3) stop         — stop the receiver and leave it down"
    echo "   4) stop+restart — stop, then restart once it has cooled (recommended)"
    echo ""
    if [ -n "$START_SCRIPT" ]; then TG_DEFAULT=4; else TG_DEFAULT=3; fi
    TG_TRIES=0
    while true; do
        if ! read -rp "   mode [1-4, Enter = $TG_DEFAULT]: " TG_ANS; then
            echo ""
            echo "   (no input — using the default: $TG_DEFAULT)"
            TG_ANS=""
        fi
        [ -z "$TG_ANS" ] && TG_ANS=$TG_DEFAULT
        case "$TG_ANS" in
            1) THERMAL_MODE="log" ;;
            2) THERMAL_MODE="throttle" ;;
            3) THERMAL_MODE="stop" ;;
            4) THERMAL_MODE="stop+restart" ;;
            *)
                TG_TRIES=$((TG_TRIES + 1))
                if [ "$TG_TRIES" -ge "$ASK_PORT_TRIES" ]; then
                    # Resolve the default here and leave. Setting TG_ANS and
                    # looping again would re-read the same bad input forever.
                    echo "   [WARN] $TG_TRIES invalid answers — using the default $TG_DEFAULT"
                    case "$TG_DEFAULT" in
                        1) THERMAL_MODE="log" ;;
                        2) THERMAL_MODE="throttle" ;;
                        3) THERMAL_MODE="stop" ;;
                        *) THERMAL_MODE="stop+restart" ;;
                    esac
                    break
                fi
                echo "   [ERROR] Enter 1, 2, 3 or 4."
                continue
                ;;
        esac
        break
    done
    echo "   [OK] thermal_mode: $THERMAL_MODE"
    if [ "$THERMAL_MODE" = "stop+restart" ] && [ -z "$START_SCRIPT" ]; then
        echo "   [WARN] No start_script chosen — this mode will stop but not restart."
    fi

    # Throttle stage: needs write access to the CPU frequency ceiling. Granting
    # it to a group is what avoids running the whole panel (and every start/stop
    # script it launches) as root.
    if [ -x "$SCRIPT_DIR/setup-cpufreq-perms.sh" ] && [ "$THERMAL_MODE" != "log" ]; then
        echo ""
        echo "   The throttle stage lowers the CPU clock before the stop threshold."
        echo "   It needs write access to scaling_max_freq, which is root-owned."
        ask_yn "   Grant it now (group + tmpfiles.d rule, sudo)? [y/N]:" n TG_PERM
        case "$TG_PERM" in
            [yY]*)
                if sudo "$SCRIPT_DIR/setup-cpufreq-perms.sh"; then
                    echo "   [OK] Log out and back in (or reboot) before the panel"
                    echo "        can use the new group — see docs/THERMAL_GUARD.md"
                else
                    echo "   [WARN] Not granted. The throttle stage disables itself;"
                    echo "          warn / stop / stop+restart are unaffected."
                fi
                ;;
            *) echo "   Skipped — run ./setup-cpufreq-perms.sh later if you want it." ;;
        esac
    fi
fi

# ── Write admin_config.json ───────────────────────────────────────────────────
echo ""
CONFIG_FILE="$SCRIPT_DIR/admin_config.json"
python3 - <<PYEOF
import json, hashlib

cfg_path = '$CONFIG_FILE'
defaults = {
    'password_hash':    hashlib.sha256(b'admin').hexdigest(),
    'sdr_base_dir':     '$SCRIPT_DIR',
    'log_lines':        200,
    'start_script':     '',
    'stop_script':      '',
    'sdr_process_name': 'spectrumserver',
}

cfg = {}
try:
    with open(cfg_path) as f:
        content = f.read().strip()
    if content:
        cfg = json.loads(content)
except (FileNotFoundError, json.JSONDecodeError):
    pass

for k, v in defaults.items():
    if k not in cfg:
        cfg[k] = v

# Always overwrite ports — these are the source of truth
cfg['port']        = $ADMIN_PORT   # admin panel internal port
cfg['public_port'] = $SDR_PORT     # spectrumserver port (used by Users page)
cfg['proxy_port']  = $PROXY_PORT   # proxy public port
cfg['sdr_host']    = '$SDR_HOST'   # host the proxy reaches spectrumserver on

# Answers from this run win, but "none" (empty) leaves an existing value alone
for key, chosen in (('start_script',  '''$START_SCRIPT'''),
                    ('stop_script',   '''$STOP_SCRIPT'''),
                    ('thermal_mode',  '''$THERMAL_MODE''')):
    if chosen:
        cfg[key] = chosen

# setup_complete intentionally NOT set — first browser login triggers wizard

with open(cfg_path, 'w') as f:
    json.dump(cfg, f, indent=2)
print('[OK] admin_config.json saved')
PYEOF

# ── Systemd service ───────────────────────────────────────────────────────────
# Recommended by default, because the CPU over-temperature guard runs INSIDE the
# panel: without the units, a reboot or a crash leaves the machine unprotected
# until someone logs in and starts the panel by hand. It is still a choice, not
# a requirement — plenty of valid targets have no systemd at all (containers,
# WSL1, OpenRC/sysvinit distros), so we detect it rather than assume it.
#
# /run/systemd/system exists only when systemd is actually PID 1. Testing for
# the systemctl binary instead would wrongly say yes on machines that merely
# have the package installed.
SERVICE_INSTALLED=false
echo ""
if [ ! -d /run/systemd/system ]; then
    echo "[–] systemd is not running on this machine (container, WSL1 or a"
    echo "    non-systemd init) — skipping the service install."
    echo "    Start the panel with:  ./manage_admin.sh start"
    SVC_CHOICE="n"
else
    echo "The CPU over-temperature guard only runs while the admin panel runs."
    echo "Without a service the panel does not come back after a reboot or a"
    echo "crash, and the guard stops protecting the machine until you notice."
    echo ""
    # bare Enter — and an exhausted stdin — accept the recommendation
    ask_yn "Install as systemd service (auto-start on boot)? [Y/n]:" y SVC_CHOICE
fi
case "$SVC_CHOICE" in
    [yY]*)
        if ! sudo -n true 2>/dev/null; then
            echo "[*] sudo needed for systemd service..."
        fi
        # Ask for the password now rather than discovering halfway through that
        # we cannot write to /etc/systemd/system — a failed 'sudo tee' would
        # otherwise leave a half-installed pair and still report success.
        SUDO_OK=true
        if ! sudo -v; then
            SUDO_OK=false
            echo "[!] No sudo access — cannot install the systemd units."
            echo "    Start the panel by hand instead:  ./manage_admin.sh start"
        fi
        if [ "$SUDO_OK" = true ]; then
        PYTHON_BIN="$(command -v python3)"
        # Under systemd the group list is built fresh at every start, so the
        # thermal guard's throttle stage works from the first boot — no logout
        # dance like an already-open login shell needs.
        SUPP_GROUP=""
        if getent group cpufreq >/dev/null 2>&1; then
            SUPP_GROUP="SupplementaryGroups=cpufreq"
        fi
        # KillMode=process is load-bearing: the panel's Start button launches
        # the receiver as a child, and a child inherits the unit's cgroup —
        # start_new_session drops the terminal and process group, not the
        # cgroup. Under systemd's default KillMode=control-group, restarting
        # the panel would SIGTERM and SIGKILL spectrumserver, its watchdog and
        # the autorun daemon with it, and stall for the full stop timeout.
        sudo tee /etc/systemd/system/phantomsdr-admin.service > /dev/null << UNIT
[Unit]
Description=PhantomSDR Admin Panel
After=network.target

[Service]
Type=simple
User=$(whoami)
$SUPP_GROUP
WorkingDirectory=$SCRIPT_DIR
ExecStart=$PYTHON_BIN -u $SCRIPT_DIR/admin_server.py
StandardOutput=append:$SCRIPT_DIR/admin.log
StandardError=append:$SCRIPT_DIR/admin.log
KillMode=process
Restart=always
RestartSec=5
Environment=ADMIN_PORT=$ADMIN_PORT

[Install]
WantedBy=multi-user.target
UNIT
        # The proxy gets its own unit. Leaving it to manage_admin.sh would mean
        # the panel returns after a reboot but the public port stays dead.
        sudo tee /etc/systemd/system/phantomsdr-proxy.service > /dev/null << UNIT
[Unit]
Description=PhantomSDR Reverse Proxy
After=network.target phantomsdr-admin.service

[Service]
Type=simple
User=$(whoami)
WorkingDirectory=$SCRIPT_DIR
ExecStart=$PYTHON_BIN -u $SCRIPT_DIR/proxy.py
StandardOutput=append:$SCRIPT_DIR/proxy.log
StandardError=append:$SCRIPT_DIR/proxy.log
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
UNIT
        # ── Keep admin.log / proxy.log writable by the panel ─────────────────
        # StandardOutput=append: is opened by PID 1 *before* it drops to User=,
        # so a log that does not exist yet is created root:root 0644 and the
        # panel — running as $(whoami) — cannot truncate it. "Clear Logs" then
        # fails with Errno 13 on exactly these two files and no other. Fix the
        # pair that exists now, and install a tmpfiles.d rule so a deleted log
        # is re-created with the right owner at the next boot, before the units
        # start. chown, never rm: both are held open O_APPEND.
        for LOG in admin.log proxy.log; do
            sudo touch "$SCRIPT_DIR/$LOG"
            sudo chown "$(id -un):$(id -gn)" "$SCRIPT_DIR/$LOG"
            sudo chmod 664 "$SCRIPT_DIR/$LOG"
        done
        sudo tee /etc/tmpfiles.d/99-phantomsdr-logs.conf > /dev/null << TMPF
# PhantomSDR-Plus — installed by setup_admin.sh
# Keeps admin.log and proxy.log owned by the user the units run as, so the
# panel's "Clear Logs" button can truncate them. See docs/ADMIN_PANEL_SETUP.md.
f $SCRIPT_DIR/admin.log 0664 $(id -un) $(id -gn) -
f $SCRIPT_DIR/proxy.log 0664 $(id -un) $(id -gn) -
TMPF
        sudo systemd-tmpfiles --create /etc/tmpfiles.d/99-phantomsdr-logs.conf \
            2>/dev/null || true
        echo "[OK] admin.log and proxy.log owned by $(id -un) (Clear Logs works)"

        # Free the ports in case a hand-started pair is still up, or the units
        # and manage_admin.sh will fight over them.
        chmod +x "$SCRIPT_DIR/manage_admin.sh"
        bash "$SCRIPT_DIR/manage_admin.sh" stop >/dev/null 2>&1
        sudo systemctl daemon-reload
        sudo systemctl enable --now phantomsdr-admin
        sudo systemctl enable --now phantomsdr-proxy
        echo "[OK] Services installed and started (admin panel + proxy)"
        echo "[!]  From now on use systemctl, not manage_admin.sh, to stop or"
        echo "     restart: sudo systemctl restart phantomsdr-admin"
        SERVICE_INSTALLED=true

        # ── Optional: password-free systemctl for these two units ─────────────
        # Off by default: it is a privilege grant, and nobody should acquire one
        # by pressing Enter through an installer.
        echo ""
        echo "Restarting the panel needs a sudo password each time, which"
        echo "non-interactive callers (cron, ssh, scripts) cannot supply."
        echo "A sudoers rule can lift that for these two units only."
        ask_yn "Allow password-free systemctl for the two units? [y/N]:" n SUDOERS_CHOICE
        case "${SUDOERS_CHOICE:-n}" in
            [yY]*) install_sudoers_rule ;;
            *)     echo "[–] Skipped — systemctl keeps asking for a password." ;;
        esac
        fi
        ;;
esac

# ── Ready banner ──────────────────────────────────────────────────────────────
echo ""
echo "╔════════════════════════════════════════════════════════╗"
echo "║  Ready!                                                "
echo "║                                                        "
echo "║  Spectrumserver  : port ${SDR_PORT}  (LAN IP: ${SDR_HOST})"
if [ "$SERVICE_INSTALLED" = true ]; then
echo "║  Admin panel     : port ${ADMIN_PORT} (internal, systemd) "
else
echo "║  Admin panel     : port ${ADMIN_PORT} (internal)       "
fi
echo "║  Proxy           : port ${PROXY_PORT} (public)         "
if [ -n "$THERMAL_MODE" ]; then
echo "║  Thermal guard   : ${THERMAL_MODE} (docs/THERMAL_GUARD.md)"
fi
echo "║                                                        "
if [ "$SERVICE_INSTALLED" = true ]; then
echo "║  Already running — auto-starts on boot                "
echo "║  Status : sudo systemctl status phantomsdr-admin       "
else
echo "║  1. Start : bash manage_admin.sh start                 "
fi
echo "║  2. Open  : http://YOUR_IP:${PROXY_PORT}/admin         "
echo "║  3. Login : password = admin  (change on first login!) "
echo "╚════════════════════════════════════════════════════════╝"
echo ""
if [ "$SERVICE_INSTALLED" != true ] && [ -n "$THERMAL_MODE" ] && [ "$THERMAL_MODE" != "log" ]; then
    echo "[NOTE] The thermal guard runs inside the panel. Without the systemd"
    echo "       service the panel does not come back after a reboot, and the"
    echo "       CPU is then unprotected — start it with:  ./manage_admin.sh start"
    echo ""
fi

if [ "$SERVICE_INSTALLED" = true ]; then
    exit 0
fi

# ── Launch now ────────────────────────────────────────────────────────────────
ask_yn "Launch admin panel now? [Y/n]:" y LAUNCH
case "$LAUNCH" in
    [nN]*) echo "Start later: bash manage_admin.sh start" ;;
    *)
        chmod +x "$SCRIPT_DIR/manage_admin.sh"
        # NOT 'restart': that verb was deliberately removed from
        # manage_admin.sh (systemd owns restarts, and the old restart fought
        # the units over the port). This branch is only reached when there are
        # no systemd units — a container, WSL1, any non-systemd init — so the
        # way to bring the panel up here is stop-then-start, exactly as
        # manage_admin.sh's own error message says. Calling 'restart' made
        # setup_admin.sh exit non-zero on every such machine, and install.sh
        # then reported a correctly-configured admin panel as failed.
        bash "$SCRIPT_DIR/manage_admin.sh" stop >/dev/null 2>&1 || true
        bash "$SCRIPT_DIR/manage_admin.sh" start
        ;;
esac
