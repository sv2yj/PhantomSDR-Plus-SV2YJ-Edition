#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
#  PhantomSDR-Plus  –  setup-fobos.sh
#  Install everything the RigExpert Fobos SDR needs, so that start-fobos.sh
#  (RF, 25-6000 MHz) and start-fobos-hf.sh (HF1/HF2 direct sampling, 0-25 MHz)
#  can run:
#
#    1. build dependencies and SoapySDR, from the distribution's packages
#    2. libfobos, libfobos-sdr-agile and SoapyFobosSDR, built from source
#    3. rx_tools (rx_sdr), built from source unless rx_sdr is already on PATH
#    4. cf32_to_real, the converter the HF path pipes rx_sdr through
#    5. a udev rule, so the receiver runs without sudo
#
#  Called by install.sh option 5 (and the Fedora / Arch / openSUSE installers),
#  and can be run on its own on a station that is already installed:
#
#    ./setup-fobos.sh
#
#  Idempotent — safe to re-run. Sources are cloned into sdr_drivers/ (not
#  tracked by git) and updated with git pull on later runs. Run it as your
#  normal user: it calls sudo itself for the parts that need root. The shared
#  steps and the SDR_* overrides are in setup-sdr-common.sh.
#
#  SoapyFobosSDR needs the headers of BOTH libfobos and libfobos-sdr-agile to
#  build, even on the stock firmware — its CMakeLists stops with "Fobos SDR
#  (agile) development files not found" otherwise. Building the agile library
#  does not mean the agile firmware is used at run time.
# ─────────────────────────────────────────────────────────────────────────────
# shellcheck source=setup-sdr-common.sh
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/setup-sdr-common.sh"

sdr_install_deps "" "" "" ""

sdr_build libfobos           https://github.com/rigexpert/libfobos
sdr_build libfobos-sdr-agile https://github.com/rigexpert/libfobos-sdr-agile
sdr_build SoapyFobosSDR      https://github.com/rigexpert/SoapyFobosSDR
sdr_build_rx_tools

echo ""
echo "Building cf32_to_real..."
gcc -O3 -Wall -o "$PHANTOMDIR/cf32_to_real" "$PHANTOMDIR/cf32_to_real.c" -lm
green "✅ cf32_to_real built ($PHANTOMDIR/cf32_to_real)"

# libfobos-sdr-agile installs a uaccess-only rule of its own; this one adds
# plugdev for a headless station.
sdr_udev_rule /etc/udev/rules.d/70-fobos-sdr.rules \
    "RigExpert Fobos SDR — allow rx_sdr to open it without sudo." \
    16d0:132e

sdr_require_driver fobos
echo ""
green "Fobos SDR ready. Plug it in, then:"
echo "    SoapySDRUtil --find=\"driver=fobos\""
echo "    ./start-fobos-hf.sh      # HF1/HF2 direct sampling, 0-25 MHz"
echo "    ./start-fobos.sh         # RF, set the window in RX_ARGS + config-fobos.toml"
