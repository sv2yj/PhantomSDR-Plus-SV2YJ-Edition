#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
#  PhantomSDR-Plus  –  setup-hackrf.sh
#  Install what the HackRF One needs, so that start-hackrf.sh can run:
#
#    1. the distribution's hackrf package — hackrf_transfer and libhackrf;
#       apt, dnf, pacman and zypper all call it "hackrf"
#    2. a udev rule, so the receiver runs without sudo
#
#  Nothing is built: hackrf_transfer streams the HackRF's samples straight into
#  spectrumserver, with no SoapySDR and no rx_sdr in between.
#
#  Called by install.sh option 7 (and the Fedora / Arch / openSUSE installers),
#  and can be run on its own on a station that is already installed:
#
#    ./setup-hackrf.sh
#
#  Idempotent — safe to re-run. Run it as your normal user: it calls sudo
#  itself for the parts that need root. The shared steps and the SDR_*
#  overrides are in setup-sdr-common.sh.
# ─────────────────────────────────────────────────────────────────────────────
# shellcheck source=setup-sdr-common.sh
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/setup-sdr-common.sh"

echo "Installing the hackrf package..."
sdr_install_packages hackrf hackrf hackrf hackrf
command -v hackrf_transfer >/dev/null 2>&1 \
    || die "hackrf_transfer is not on PATH after installing the hackrf package."
echo ""
green "✅ hackrf_transfer installed ($(command -v hackrf_transfer))"

# The package ships a rule of its own on every distribution, but they differ
# (group plugdev on Debian, uaccess only elsewhere); this one is the same
# everywhere and covers a headless station too.
sdr_udev_rule /etc/udev/rules.d/70-hackrf.rules \
    "HackRF One / Jawbreaker / rad1o — allow hackrf_transfer to open it without sudo." \
    1d50:6089 1d50:604b 1d50:cc15

echo ""
green "HackRF ready. Plug it in, then:"
echo "    hackrf_info"
echo "    ./start-hackrf.sh        # set the window in RX_ARGS + config-hackrf.toml"
