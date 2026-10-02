#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
#  PhantomSDR-Plus  –  setup-airspyhf.sh
#  Install everything the Airspy HF+ (Discovery / Dual Port) needs, so that
#  start-airspyhf.sh can run:
#
#    1. build dependencies, SoapySDR and libairspyhf, from the distribution's
#       packages — libairspyhf is built from source where there is no package
#       (Arch has it only in the AUR)
#    2. SoapyAirspyHF, built from source (no distribution packages it everywhere)
#    3. rx_tools (rx_sdr), built from source unless rx_sdr is already on PATH
#    4. a udev rule, so the receiver runs without sudo
#
#  Called by install.sh option 6 (and the Fedora / Arch / openSUSE installers),
#  and can be run on its own on a station that is already installed:
#
#    ./setup-airspyhf.sh
#
#  Idempotent — safe to re-run. Sources are cloned into sdr_drivers/ (not
#  tracked by git). Run it as your normal user: it calls sudo itself for the
#  parts that need root. The shared steps and the SDR_* overrides are in
#  setup-sdr-common.sh.
# ─────────────────────────────────────────────────────────────────────────────
# shellcheck source=setup-sdr-common.sh
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/setup-sdr-common.sh"

sdr_install_deps "libairspyhf-dev" "airspyhf-devel" "" "airspyhf-devel"

if pkg-config --exists libairspyhf; then
    echo ""
    green "✅ libairspyhf $(pkg-config --modversion libairspyhf) from the distribution"
else
    sdr_build airspyhf https://github.com/airspy/airspyhf
fi
sdr_build SoapyAirspyHF https://github.com/pothosware/SoapyAirspyHF
sdr_build_rx_tools

sdr_udev_rule /etc/udev/rules.d/70-airspyhf.rules \
    "Airspy HF+ — allow rx_sdr to open it without sudo." \
    03eb:800c

sdr_require_driver airspyhf
echo ""
green "Airspy HF+ ready. Plug it in, then:"
echo "    SoapySDRUtil --find=\"driver=airspyhf\""
echo "    ./start-airspyhf.sh"
