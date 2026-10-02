#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
#  PhantomSDR-Plus  –  setup-rx888-udev.sh
#  Install the udev rules so rx888_stream runs WITHOUT sudo.
#
#  The RX-888 MkII uses a Cypress FX3 USB chip. It first enumerates under a
#  bootloader product-id (00f1 / 00f3, depends on the last shutdown state); then
#  rx888_stream loads SDDC_FX3.img and the device re-enumerates (8613). All three
#  need to be accessible by a normal user, so this grants each one to the
#  `plugdev` group (+ uaccess for a logged-in seat) and adds you to that group.
#
#  Idempotent — safe to re-run. Needs root to write /etc/udev and edit groups;
#  it re-executes itself with sudo automatically.
#
#  Usage:
#    ./setup-rx888-udev.sh                 # sets up the invoking user
#    RX888_USER=alice ./setup-rx888-udev.sh
#    sudo ./setup-rx888-udev.sh bob        # user as first argument
# ─────────────────────────────────────────────────────────────────────────────
set -e

RULES="/etc/udev/rules.d/99-rx888.rules"

# ── Re-exec as root if needed ────────────────────────────────────────────────
if [ "$(id -u)" -ne 0 ]; then
    echo "Root privileges required — re-running with sudo…"
    exec sudo -E bash "$0" "$@"
fi

# ── Which non-root user should be able to use the device? ────────────────────
# Prefer an explicit choice, else the user that invoked sudo, else the console
# user, else the owner of this script's directory.
TARGET_USER="${RX888_USER:-${1:-${SUDO_USER:-}}}"
if [ -z "$TARGET_USER" ]; then
    TARGET_USER="$(logname 2>/dev/null || true)"
fi
if [ -z "$TARGET_USER" ] || [ "$TARGET_USER" = "root" ]; then
    TARGET_USER="$(stat -c '%U' "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)" 2>/dev/null || true)"
fi

# ── 1) Ensure the plugdev group exists ───────────────────────────────────────
if ! getent group plugdev >/dev/null; then
    echo "Creating 'plugdev' group…"
    groupadd plugdev
fi

# ── 2) Install the udev rules ────────────────────────────────────────────────
echo "Writing $RULES"
cat > "$RULES" <<'RULES_EOF'
# RX-888 MkII — allow rx888_stream to run without sudo.
# Cypress FX3: bootloader PID is 00f1 or 00f3 (varies by last shutdown state);
# after rx888_stream loads SDDC_FX3.img the device re-enumerates as 8613.
# Grant all three to the plugdev group (0664) + uaccess, ignore ModemManager,
# and expose a stable /dev/rx888 symlink.
SUBSYSTEM=="usb", ATTRS{idVendor}=="04b4", ATTRS{idProduct}=="00f1", GROUP="plugdev", MODE="0664", TAG+="uaccess", SYMLINK+="rx888", ENV{ID_MM_DEVICE_IGNORE}="1"
SUBSYSTEM=="usb", ATTRS{idVendor}=="04b4", ATTRS{idProduct}=="00f3", GROUP="plugdev", MODE="0664", TAG+="uaccess", SYMLINK+="rx888", ENV{ID_MM_DEVICE_IGNORE}="1"
SUBSYSTEM=="usb", ATTRS{idVendor}=="04b4", ATTRS{idProduct}=="8613", GROUP="plugdev", MODE="0664", TAG+="uaccess", SYMLINK+="rx888", ENV{ID_MM_DEVICE_IGNORE}="1"
RULES_EOF
chmod 0644 "$RULES"

# ── 3) Add the user to plugdev ───────────────────────────────────────────────
if [ -n "$TARGET_USER" ] && [ "$TARGET_USER" != "root" ]; then
    if id -nG "$TARGET_USER" 2>/dev/null | tr ' ' '\n' | grep -qx plugdev; then
        echo "User '$TARGET_USER' is already in 'plugdev'."
    else
        echo "Adding user '$TARGET_USER' to 'plugdev'…"
        usermod -aG plugdev "$TARGET_USER"
        NEED_RELOGIN=1
    fi
else
    echo "WARNING: could not determine a non-root user to add to 'plugdev'."
    echo "         Re-run as:  RX888_USER=<name> ./setup-rx888-udev.sh"
fi

# ── 4) Reload rules and apply to already-connected devices ───────────────────
echo "Reloading udev rules…"
udevadm control --reload-rules
udevadm trigger --subsystem-match=usb

echo
echo "✔ Done. RX-888 udev rules installed."
if [ "${NEED_RELOGIN:-0}" = "1" ]; then
    echo "  ⚠ '$TARGET_USER' was just added to 'plugdev' — log out and back in"
    echo "    (or reboot) for the group membership to take effect."
fi
echo "  If the device was plugged in, unplug and replug it once so the new"
echo "  permissions apply. Verify with:  ls -l /dev/rx888   and   lsusb | grep 04b4"
echo
echo "  Note: if another rule in /etc/udev/rules.d/ also matches 04b4 (e.g. a"
echo "  Perseus/westbridge rule), remove or disable it if it interferes."
