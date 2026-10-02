#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
#  PhantomSDR-Plus  –  setup-cpufreq-perms.sh
#  Let the thermal guard use its THROTTLE stage WITHOUT running as root.
#
#  The guard's throttle stage lowers the CPU's maximum frequency by 20% as a
#  middle step between "warn" and "stop". To do that it must write
#      /sys/devices/system/cpu/cpuN/cpufreq/scaling_max_freq
#  which the kernel creates root-owned and mode 0644. An unprivileged admin
#  panel therefore skips the stage and logs "no cpufreq write access".
#
#  Running the whole guard as root would be the wrong fix: it also runs your
#  start/stop scripts, and those should stay unprivileged. Instead this script
#  hands write access on those specific files to a dedicated group:
#
#    1. creates the group `cpufreq` (if missing) and adds your user to it
#    2. installs /etc/tmpfiles.d/99-phantomsdr-cpufreq.conf so the group
#       ownership and 0664 mode are re-applied on every boot — sysfs
#       permissions do NOT survive a reboot on their own
#    3. applies the same change immediately, so you can test without rebooting
#
#  Nothing else on the system is touched, and no password is needed at runtime:
#  the elevation happens once, here.
#
#  Idempotent — safe to re-run.
#
#  Usage:
#    ./setup-cpufreq-perms.sh                    # sets up the invoking user
#    CPUFREQ_USER=alice ./setup-cpufreq-perms.sh
#    sudo ./setup-cpufreq-perms.sh bob           # user as first argument
#    sudo ./setup-cpufreq-perms.sh --revoke      # undo everything
#
#  After running it you must log out and back in (or reboot) for the new group
#  to apply, then restart the admin panel. Verify with:
#    python3 thermal_guard.py --once
#  which should print "cpufreq : writable, throttle stage available".
#
#  See docs/THERMAL_GUARD.md for the full manual.
# ─────────────────────────────────────────────────────────────────────────────
set -e

GROUP="cpufreq"
CONF="/etc/tmpfiles.d/99-phantomsdr-cpufreq.conf"
GLOB="/sys/devices/system/cpu/cpu*/cpufreq/scaling_max_freq"

# ── Re-exec as root if needed ────────────────────────────────────────────────
if [ "$(id -u)" -ne 0 ]; then
    echo "Root privileges required — re-running with sudo…"
    exec sudo -E bash "$0" "$@"
fi

# ── Undo mode ────────────────────────────────────────────────────────────────
if [ "$1" = "--revoke" ]; then
    echo "Removing $CONF…"
    rm -f "$CONF"
    for f in $GLOB; do
        [ -e "$f" ] || continue
        chgrp root "$f" 2>/dev/null || true
        chmod 0644 "$f" 2>/dev/null || true
    done
    echo "[OK] cpufreq files returned to root:root 0644."
    echo "     The '$GROUP' group was left in place; remove it yourself with"
    echo "     'groupdel $GROUP' if nothing else uses it."
    exit 0
fi

# ── Which non-root user should be able to throttle? ──────────────────────────
TARGET_USER="${CPUFREQ_USER:-${1:-${SUDO_USER:-}}}"
if [ -z "$TARGET_USER" ]; then
    TARGET_USER="$(logname 2>/dev/null || true)"
fi
if [ -z "$TARGET_USER" ] || [ "$TARGET_USER" = "root" ]; then
    TARGET_USER="$(stat -c '%U' "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)" 2>/dev/null || true)"
fi
if [ -z "$TARGET_USER" ] || ! id "$TARGET_USER" >/dev/null 2>&1; then
    echo "[ERR] Could not work out which user to grant access to."
    echo "      Re-run as:  sudo ./setup-cpufreq-perms.sh YOURUSERNAME"
    exit 1
fi

# ── 0) Is there anything to grant access to? ─────────────────────────────────
# Some machines have no cpufreq driver at all (many VPS, some ARM boards). The
# throttle stage simply cannot work there; the rest of the guard is unaffected.
FOUND=0
for f in $GLOB; do
    [ -e "$f" ] && FOUND=$((FOUND + 1))
done
if [ "$FOUND" -eq 0 ]; then
    echo "[ERR] No scaling_max_freq files found — this machine has no cpufreq"
    echo "      driver exposed to userspace (common on VPS and in containers)."
    echo "      The throttle stage cannot work here. Nothing was changed."
    echo "      warn / stop / stop+restart are unaffected — use one of those."
    exit 1
fi
echo "Found $FOUND CPU(s) with a writable-by-root frequency limit."

# ── 1) Ensure the group exists ───────────────────────────────────────────────
if ! getent group "$GROUP" >/dev/null; then
    echo "Creating '$GROUP' group…"
    groupadd --system "$GROUP"
else
    echo "Group '$GROUP' already exists."
fi

# ── 2) Add the user to it ────────────────────────────────────────────────────
if id -nG "$TARGET_USER" | tr ' ' '\n' | grep -qx "$GROUP"; then
    echo "User '$TARGET_USER' is already in '$GROUP'."
    NEED_RELOGIN=0
else
    echo "Adding '$TARGET_USER' to '$GROUP'…"
    usermod -aG "$GROUP" "$TARGET_USER"
    NEED_RELOGIN=1
fi

# ── 3) Make it survive a reboot ──────────────────────────────────────────────
# systemd-tmpfiles re-applies this on every boot. 'z' means "adjust the mode
# and ownership of an existing path", which is exactly right for sysfs: we are
# never creating anything, only relabelling what the kernel already made.
echo "Installing $CONF…"
cat > "$CONF" <<EOF
# PhantomSDR-Plus thermal guard — installed by setup-cpufreq-perms.sh
# Lets the '$GROUP' group lower the CPU frequency cap, so the guard's throttle
# stage works without running the admin panel as root.
# Remove this file (or run ./setup-cpufreq-perms.sh --revoke) to undo.
z $GLOB 0664 root $GROUP -
EOF

# ── 4) Apply now, so it can be tested without a reboot ───────────────────────
echo "Applying to the running system…"
if ! systemd-tmpfiles --create "$CONF" 2>/dev/null; then
    # Fall back to doing it by hand — the boot-time part is what matters and
    # that is already installed above.
    for f in $GLOB; do
        [ -e "$f" ] || continue
        chgrp "$GROUP" "$f" 2>/dev/null || true
        chmod 0664 "$f" 2>/dev/null || true
    done
fi

# ── 5) Verify ────────────────────────────────────────────────────────────────
OK=0
BAD=0
for f in $GLOB; do
    [ -e "$f" ] || continue
    if [ "$(stat -c '%G %a' "$f")" = "$GROUP 664" ]; then
        OK=$((OK + 1))
    else
        BAD=$((BAD + 1))
    fi
done

echo
if [ "$BAD" -eq 0 ]; then
    echo "[OK] $OK CPU frequency limit(s) now writable by group '$GROUP'."
else
    echo "[WARN] $OK ok, $BAD could not be changed. The boot-time rule is still"
    echo "       installed, so a reboot may well fix the rest."
fi

echo
echo "───────────────────────────────────────────────────────────────────────"
echo " Next steps"
echo "───────────────────────────────────────────────────────────────────────"
N=1
if [ "$NEED_RELOGIN" -eq 1 ]; then
    echo " $N. Log out and back in (or reboot) — a new group only reaches your"
    echo "    processes through a fresh login. Check with:  id"
    N=$((N + 1))
fi
# With the systemd units installed, manage_admin.sh must NOT be used: it starts
# its own copy while systemd starts another, and the two fight over port 3000.
if systemctl list-unit-files phantomsdr-admin.service 2>/dev/null | grep -q phantomsdr-admin; then
    RESTART_CMD="sudo systemctl restart phantomsdr-admin"
else
    RESTART_CMD="./manage_admin.sh stop && ./manage_admin.sh start"
fi
echo " $N. Restart the admin panel:   $RESTART_CMD"
echo "    (the guard tests for write access once, at startup)"
N=$((N + 1))
echo " $N. Confirm:                   python3 thermal_guard.py --once"
echo "    Look for:  cpufreq    : writable, throttle stage available"
echo
echo " The throttle stage only ACTS if thermal_mode is 'throttle' or higher."
echo " See docs/THERMAL_GUARD.md"
echo "───────────────────────────────────────────────────────────────────────"
