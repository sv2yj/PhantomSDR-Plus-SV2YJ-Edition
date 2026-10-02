# ─────────────────────────────────────────────────────────────────────────────
#  PhantomSDR-Plus  –  setup-sdr-common.sh
#  Shared helpers for the receiver installers:
#
#    setup-rsp1a.sh      SDRplay RSP1A   (libmirisdr-5 + SoapyMiri)
#    setup-fobos.sh      RigExpert Fobos (libfobos + SoapyFobosSDR)
#    setup-airspyhf.sh   Airspy HF+      (libairspyhf + SoapyAirspyHF)
#    setup-hackrf.sh     HackRF One      (the distribution's hackrf package)
#
#  Each of them sources this file. It is not meant to be run on its own.
#
#  What the three SoapySDR ones have in common: SoapySDR from the
#  distribution's packages, drivers built from source into sdr_drivers/ (not
#  tracked by git), rx_tools for rx_sdr, a udev rule so the receiver opens
#  without sudo, and a final check that SoapySDR really lists the driver. The
#  HackRF uses only the package install and the udev rule.
#
#  Env overrides (optional, for every setup-*.sh that sources this):
#    SDR_SKIP_DEPS=1              do not install packages (the caller already did)
#    SDR_USER=name                user to add to the plugdev group (default: you)
# ─────────────────────────────────────────────────────────────────────────────
set -eo pipefail

PHANTOMDIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC_DIR="$PHANTOMDIR/sdr_drivers"

green()  { echo -e "\e[32m$*\e[0m"; }
yellow() { echo -e "\e[33m$*\e[0m"; }
die()    { echo -e "\e[31m❌ $*\e[0m" >&2; exit 1; }

# SUDO_USER only means "the real user" when sudo made us root. A shell opened
# with `sudo -iu sdr` carries SUDO_USER=root into a normal session, and the
# station user would then never be added to plugdev.
if [ "$(id -u)" -eq 0 ]; then
    SUDO=""
    TARGET_USER="${SDR_USER:-${SUDO_USER:-root}}"
else
    command -v sudo >/dev/null 2>&1 || die "sudo is required (or run as root)."
    SUDO="sudo"
    TARGET_USER="${SDR_USER:-$(id -un)}"
fi

# ── Dependencies ─────────────────────────────────────────────────────────────
# sdr_install_packages "<apt>" "<dnf>" "<pacman>" "<zypper>"
#
# Installs the given package list with whichever package manager the machine
# has. Used on its own by receivers that need no build at all (HackRF).
sdr_install_packages() {
    if [ "${SDR_SKIP_DEPS:-0}" = "1" ]; then
        echo "Skipping package installation (SDR_SKIP_DEPS=1)."
        return 0
    fi
    # shellcheck disable=SC2086  # the lists are word lists on purpose
    if command -v apt-get >/dev/null 2>&1; then
        # Stale package lists 404 on install; install.sh has just refreshed
        # them, but these scripts are also run on their own months later.
        $SUDO apt-get update
        # env, not sudo -E: sudo's env_reset drops DEBIAN_FRONTEND otherwise.
        $SUDO env DEBIAN_FRONTEND=noninteractive apt-get install -y $1
    elif command -v dnf >/dev/null 2>&1; then
        $SUDO dnf install -y $2
    elif command -v pacman >/dev/null 2>&1; then
        $SUDO pacman -S --needed --noconfirm $3
    elif command -v zypper >/dev/null 2>&1; then
        $SUDO zypper install -y $4
    else
        die "No apt-get, dnf, pacman or zypper found. Install these by hand,
       then re-run with SDR_SKIP_DEPS=1:  $1"
    fi
}

# sdr_install_deps "<apt extras>" "<dnf extras>" "<pacman extras>" "<zypper extras>"
#
# The build toolchain plus SoapySDR, and the receiver's own packages where the
# distribution has them. SoapySDR comes from the distribution: every supported
# one packages 0.8, and a second copy built into /usr/local is how two module
# directories end up disagreeing about which drivers exist.
sdr_install_deps() {
    echo "Installing build dependencies and SoapySDR..."
    sdr_install_packages \
        "git cmake build-essential pkg-config libusb-1.0-0-dev libsoapysdr-dev soapysdr-tools $1" \
        "git cmake gcc gcc-c++ make pkgconf-pkg-config libusb1-devel SoapySDR SoapySDR-devel $2" \
        "git cmake base-devel pkgconf libusb soapysdr $3" \
        "git cmake gcc gcc-c++ make pkg-config libusb-1_0-devel soapy-sdr soapy-sdr-devel $4"

    local tool
    for tool in git cmake make gcc g++ pkg-config; do
        command -v "$tool" >/dev/null 2>&1 || die "'$tool' is not installed."
    done
    pkg-config --exists SoapySDR \
        || die "SoapySDR development files not found (pkg-config SoapySDR)."
    mkdir -p "$SRC_DIR"
}

# ── Building from source ─────────────────────────────────────────────────────
# /usr/local/lib64 (Fedora) and /usr/local/lib (Fedora, Arch) are not on the
# loader path everywhere; without this, rx_sdr and the Soapy modules load but
# cannot find the driver's own .so at run time.
sdr_ensure_ldpath() {
    local d conf="/etc/ld.so.conf.d/phantomsdr-sdr.conf"
    for d in /usr/local/lib /usr/local/lib64; do
        [ -d "$d" ] || continue
        if ! grep -rqsx "$d/\?" /etc/ld.so.conf /etc/ld.so.conf.d/; then
            echo "Adding $d to the loader path ($conf)"
            grep -qxs "$d" "$conf" || echo "$d" | $SUDO tee -a "$conf" >/dev/null
        fi
    done
    $SUDO ldconfig
}

# sdr_build <name> <git url> [extra cmake args...]
sdr_build() {
    local name="$1" url="$2"; shift 2
    echo ""
    echo "── $name ─────────────────────────────────────────"
    if [ -d "$SRC_DIR/$name/.git" ]; then
        yellow "$name already cloned — pulling latest..."
        # Not fatal: offline, or a clone owned by another user, still builds.
        git -C "$SRC_DIR/$name" pull --ff-only \
            || yellow "⚠️  git pull failed in $name — building the existing clone"
    else
        # A half-finished clone from an interrupted run is not a git repo; the
        # check above skips it, so clear it rather than fail inside it.
        rm -rf "${SRC_DIR:?}/$name"
        git clone --depth 1 "$url" "$SRC_DIR/$name"
    fi
    mkdir -p "$SRC_DIR/$name/build"
    (
        cd "$SRC_DIR/$name/build"
        cmake .. -DCMAKE_BUILD_TYPE=Release "$@"
        make -j"$(nproc)"
        $SUDO make install
    )
    sdr_ensure_ldpath
    green "✅ $name installed"
}

# rx_sdr is what every start-*.sh on SoapySDR runs. One copy serves them all,
# so it is only built when it is not on PATH yet.
sdr_build_rx_tools() {
    if command -v rx_sdr >/dev/null 2>&1; then
        echo ""
        green "✅ rx_sdr already installed ($(command -v rx_sdr)) — not rebuilding rx_tools"
    else
        # rx_tools' CMakeLists asks for CMake 2.8, which CMake 4 refuses
        # outright; the policy minimum lets it configure without patching the
        # file. Older CMake ignores the variable.
        sdr_build rx_tools https://github.com/rxseger/rx_tools \
            -DCMAKE_POLICY_VERSION_MINIMUM=3.5
    fi
    command -v rx_sdr >/dev/null 2>&1 || die "rx_sdr is not on PATH after building rx_tools."
}

# ── Device access ────────────────────────────────────────────────────────────
# sdr_udev_rule <rules file> <comment> <vid:pid> [<vid:pid>...]
#
# Grants each device to plugdev plus uaccess, like setup-rx888-udev.sh does for
# the RX-888: uaccess alone covers a desktop seat, but not a headless server run
# over ssh or from a watchdog.
sdr_udev_rule() {
    local rules="$1" comment="$2" id; shift 2
    echo ""
    echo "Installing the udev rule ($rules)..."
    getent group plugdev >/dev/null || $SUDO groupadd plugdev
    # Absent where udev is not installed (containers, WSL, minimal servers).
    $SUDO mkdir -p "$(dirname "$rules")"
    {
        echo "# $comment"
        for id in "$@"; do
            echo "SUBSYSTEM==\"usb\", ATTRS{idVendor}==\"${id%%:*}\", ATTRS{idProduct}==\"${id##*:}\", GROUP=\"plugdev\", MODE=\"0664\", TAG+=\"uaccess\""
        done
    } | $SUDO tee "$rules" >/dev/null
    $SUDO chmod 0644 "$rules"
    if [ "$TARGET_USER" != "root" ] && ! id -nG "$TARGET_USER" 2>/dev/null | grep -qw plugdev; then
        $SUDO usermod -aG plugdev "$TARGET_USER"
        yellow "   ⚠️  $TARGET_USER was added to 'plugdev' — log out and back in once."
    fi
    # No udev daemon in a container or a chroot: the rule is still in place for
    # the next boot, so this is not an error.
    if command -v udevadm >/dev/null 2>&1; then
        $SUDO udevadm control --reload-rules 2>/dev/null \
            && $SUDO udevadm trigger --subsystem-match=usb 2>/dev/null \
            || yellow "   ⚠️  udev did not reload — the rule applies after a reboot or replug."
    fi
    green "✅ udev rule installed"
}

# sdr_blacklist_modules <modprobe.d file> <module> [<module>...]
#
# For receivers a kernel driver claims first: while it holds the device,
# libusb cannot open it. Unloading is best-effort — a module that is in use
# stays until the next boot, and the blacklist covers that boot.
sdr_blacklist_modules() {
    local conf="$1" m; shift
    echo ""
    echo "Blacklisting kernel drivers that would claim the device ($conf)..."
    $SUDO mkdir -p "$(dirname "$conf")"
    printf 'blacklist %s\n' "$@" | $SUDO tee "$conf" >/dev/null
    for m in "$@"; do
        $SUDO modprobe -r "$m" 2>/dev/null || true
    done
    green "✅ kernel drivers blacklisted: $*"
}

# ── Check ────────────────────────────────────────────────────────────────────
# sdr_require_driver <soapy driver key>
sdr_require_driver() {
    echo ""
    if SoapySDRUtil --info 2>/dev/null | grep -i 'factories' | grep -qw "$1"; then
        green "✅ SoapySDR lists the $1 driver"
    else
        die "SoapySDR does not list the $1 driver. Check:  SoapySDRUtil --info"
    fi
}
