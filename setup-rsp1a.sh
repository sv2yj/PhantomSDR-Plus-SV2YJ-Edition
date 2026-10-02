#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
#  PhantomSDR-Plus  –  setup-rsp1a.sh
#  Install the open-source driver chain for the SDRplay RSP1A, so that
#  start-rsp1a.sh can run:
#
#    1. build dependencies and SoapySDR, from the distribution's packages
#    2. libmirisdr-5 and SoapyMiri, built from source (no distribution has them)
#    3. rx_tools (rx_sdr), built from source unless rx_sdr is already on PATH
#    4. the msi2500 / msi001 kernel drivers blacklisted — they claim the RSP1A
#       as a V4L2 radio before libusb can open it
#    5. a udev rule, so the receiver runs without sudo
#
#  libmirisdr-5 is the reverse-engineered driver for the Mirics MSi2500/MSi001
#  chips inside the RSP1 and RSP1A. It needs no background service and no root.
#  SDRplay's own closed API (driver=sdrplay, see instructions-for-rsp1a) is
#  the other way to run the RSP1A; start-rsp1a.sh uses it instead when it is
#  installed, so stations already set up that way keep working.
#
#  Called by install.sh option 3 (and the Fedora / Arch / openSUSE installers),
#  and can be run on its own on a station that is already installed:
#
#    ./setup-rsp1a.sh
#
#  Idempotent — safe to re-run. Sources are cloned into sdr_drivers/ (not
#  tracked by git). Run it as your normal user: it calls sudo itself for the
#  parts that need root. The shared steps and the SDR_* overrides are in
#  setup-sdr-common.sh.
# ─────────────────────────────────────────────────────────────────────────────
# shellcheck source=setup-sdr-common.sh
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/setup-sdr-common.sh"

sdr_install_deps "" "" "" ""

sdr_build libmirisdr-5 https://github.com/ericek111/libmirisdr-5
sdr_build SoapyMiri    https://github.com/ericek111/SoapyMiri
sdr_build_rx_tools

sdr_blacklist_modules /etc/modprobe.d/blacklist-msi2500.conf msi2500 msi001

# The Mirics IDs libmirisdr-5 knows: RSP1, RSP1A, RSP2.
sdr_udev_rule /etc/udev/rules.d/70-rsp1a.rules \
    "SDRplay RSP1 / RSP1A / RSP2 (libmirisdr-5) — allow rx_sdr to open it without sudo." \
    1df7:2500 1df7:3000 1df7:3010

sdr_require_driver soapyMiri
echo ""
green "SDRplay RSP1A ready (libmirisdr-5). Plug it in, then:"
echo "    SoapySDRUtil --find=\"driver=soapyMiri\""
echo "    ./start-rsp1a.sh"
