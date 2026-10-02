#!/usr/bin/env bash
# kiwi_install.sh
#
# Installs the complete KiwiSDR protocol bridge into a PhantomSDR-Plus tree
# (4.1.0 or close to it). Kept in step with src/ as of 31 August 2026.
# Validated end to end:
#   - connection, handshake, audio and waterfall streams (confirmed working
#     with AetherSDR, both on the LAN and through a router)
#   - full retuning: changing frequency/mode in the Kiwi client really does
#     change what PhantomSDR demodulates and streams
#   - debug logging to /tmp/kiwi_retune.log (negligible cost, fine to leave
#     in place permanently)
#   - an S-meter the Kiwi clients recognise (confirmed with AetherSDR): SND
#     frames are grouped into exact blocks of 512 samples (1034 bytes), the
#     only size clients associate with a valid S-meter
#   - the SND greeting carries center_freq, bandwidth and adc_clk_nom on one
#     MSG line; without center_freq a client has no anchor for its zoom-out
#     range and stays stuck at a narrow span (AetherSDR never went below
#     zoom 5 of 14 until this was added)
#   - waterfall frames are exactly 1024 bins whatever the zoom (constant-width
#     window), and each bin is an absolute dBm on the same scale the S-meter
#     is calibrated to, so the display does not shift when you zoom
#   - [kiwi_emulation] smeter_offset / audio_gain / wf_cal are read from the
#     config; all three default to the calibrated values
#
# NOTE: this script installs the bridge, it does not upgrade one. On a tree
# that already has it, every patch reports "already applied" and nothing is
# written -- that is the intended way to verify a tree. If a patch FAILS on a
# tree that already works, the source has moved ahead of this script and the
# script is what needs updating, not the source.
#
# 31 August 2026: that is exactly what had happened. The waterfall pacing work
# rewrote lines this script inserts, so on a current tree it stopped at
# waterfall.cpp -- and "already applied" was being decided by comparing the
# whole replacement, which no longer matched. Two things came out of it:
#
#   - Every patch now carries a `marker`: a short string that is in the file
#     only once that patch is in place. Later work on the same lines can no
#     longer make a healthy tree look unpatched -- nor, worse, make an insert
#     patch fire a second time (see the docstring on patch() below).
#   - The pacing itself is installed here now: waterfall.h, waterfall.cpp,
#     fft.cpp, spectrumserver.h/.cpp and websocket.cpp. A tree that has the
#     older bridge gets it; a current tree reports "already applied".
#
# TCP_NODELAY, which landed in websocket.cpp in the same commit, is deliberately
# NOT here: it is a fix for every listener, not part of the Kiwi bridge, and it
# arrives with the source.
#
# Run it from the ROOT of the repository (where meson.build is), with
# kiwi_bridge.h in the same directory as this script (or already in src/).
#
# The script:
#   - backs up every file it touches into backup_kiwi_bridge_<timestamp>/
#   - applies patches by EXACT text match (via Python); if an expected anchor
#     is not found (diverged local tree, different version) it stops at once
#     WITHOUT touching the file concerned, and says precisely which one.
#   - is idempotent: re-run on a tree that already has the bridge, it detects
#     what is in place and skips it cleanly.
#   - copies kiwi_bridge.h into src/ (backing up any existing one first)
#   - appends a documented [kiwi_emulation] block, enabled = true, to each of
#     the config .toml files listed in KIWI_TOML_FILES below that exist in the
#     repository root and have not got one already
#
# Afterwards:
#   1. ./recompile.sh   (option [1] Backend only)
#   2. A Kiwi client (AetherSDR, kiwiclient...) connects on the same
#      host/port as usual, paths /kiwi/<id>/SND and /kiwi/<id>/W/F.
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(pwd)"
SRC_DIR="$REPO_ROOT/src"
BACKUP_DIR="$REPO_ROOT/backup_kiwi_bridge_$(date +%Y%m%d_%H%M%S)"

if [ ! -f "$SRC_DIR/spectrumserver.cpp" ]; then
    echo "ERROR: src/spectrumserver.cpp not found."
    echo "Run this script from the root of the PhantomSDR-Plus repository."
    exit 1
fi

# kiwi_bridge.h: beside this script for a fresh install, or already in src/
# when the bridge is being re-checked on a tree that has it.
if [ -f "$SCRIPT_DIR/kiwi_bridge.h" ]; then
    BRIDGE_HEADER="$SCRIPT_DIR/kiwi_bridge.h"
elif [ -f "$SRC_DIR/kiwi_bridge.h" ]; then
    BRIDGE_HEADER="$SRC_DIR/kiwi_bridge.h"
else
    echo "ERROR: kiwi_bridge.h found neither beside this script nor in src/."
    exit 1
fi

# The source patches below and kiwi_bridge.h are one unit: the waterfall pacing
# added on 31 August 2026 calls handle_wf_message() with three more arguments
# than the older header declares, so patching against a stale header produces a
# tree that will not compile. Check before writing anything, not after.
if ! grep -q "kiwi_wf_fps_cap" "$BRIDGE_HEADER"; then
    echo "ERROR: $BRIDGE_HEADER is older than this script."
    echo "  It has no kiwi_wf_fps_cap, so it is from before the Kiwi waterfall"
    echo "  pacing (31 August 2026). Patching the source against it would leave"
    echo "  a tree that does not compile, so nothing has been touched."
    echo "  Take src/kiwi_bridge.h from the current distribution and re-run."
    exit 1
fi

mkdir -p "$BACKUP_DIR"
echo "Backups in: $BACKUP_DIR"

for f in client.h signal.cpp waterfall.cpp spectrumserver.h spectrumserver.cpp websocket.cpp http.cpp; do
    cp "$SRC_DIR/$f" "$BACKUP_DIR/$f"
done

if [ -f "$SRC_DIR/kiwi_bridge.h" ]; then
    cp "$SRC_DIR/kiwi_bridge.h" "$BACKUP_DIR/kiwi_bridge.h"
fi
if [ "$BRIDGE_HEADER" != "$SRC_DIR/kiwi_bridge.h" ]; then
    cp "$BRIDGE_HEADER" "$SRC_DIR/kiwi_bridge.h"
    echo "Copied: src/kiwi_bridge.h"
else
    echo "Kept:   src/kiwi_bridge.h (already in place)"
fi

# ---------------------------------------------------------------------------
# Config .toml files in the repository root to enable
# [kiwi_emulation] / enabled = true in. Add the name of any other
# config file used on your installation here — the list is passed
# to the Python block below, so one edit covers backup and patching.
# ---------------------------------------------------------------------------
KIWI_TOML_FILES=(config.toml config-rx888mk2.toml config-airspyhf.toml \
                 config-rtl.toml config-rsp1a.toml \
                 config-fobos.toml config-fobos-hf.toml config-hackrf.toml)

for toml in "${KIWI_TOML_FILES[@]}"; do
    toml_path="$REPO_ROOT/$toml"
    if [ -f "$toml_path" ]; then
        cp "$toml_path" "$BACKUP_DIR/$toml"
    fi
done

python3 - "$SRC_DIR" "${KIWI_TOML_FILES[@]}" <<'PYEOF'
import sys
import pathlib

src = pathlib.Path(sys.argv[1])

def patch(path: pathlib.Path, anchor: str, replacement: str, label: str,
          marker: str = ""):
    """Apply one exact-text edit, once.

    `marker` is a short string that exists in the file ONLY once this patch is
    in place, and it is what decides "already applied". Comparing the whole
    replacement instead -- which is what this did until 31 August 2026 -- asks
    the wrong question: the bridge is patched INTO the source, so later work on
    the same lines (the Kiwi waterfall pacing did exactly this) leaves the
    region correct but no longer identical, and the whole replacement stops
    matching. Two ways to be wrong followed from that. Where the anchor is not
    part of the replacement the run aborted on a tree that was perfectly fine;
    where it IS part of it -- an insertion around an anchor line, most of the
    patches here -- the anchor was still found and the block was inserted a
    SECOND time. A marker cannot drift that way.
    """
    text = path.read_text()
    if (marker and marker in text) or (not marker and text.count(replacement) >= 1):
        print(f"OK   [{label}]: already applied, skipped.")
        return
    count = text.count(anchor)
    if count == 0:
        print(f"FAIL [{label}]: anchor not found in {path.name}.")
        print("  --- expected anchor ---")
        print(anchor)
        print("  ------------------------")
        print(f"  {path.name} was NOT modified. Manual patching required.")
        print(f"  If {path.name} changed in this version of PhantomSDR-Plus,")
        print(f"  send its current contents so the patch can be adjusted.")
        sys.exit(2)
    if count > 1:
        print(f"FAIL [{label}]: anchor found {count} times (expected exactly 1) in {path.name}.")
        print(f"  {path.name} was NOT modified. Manual patching required.")
        sys.exit(2)
    path.write_text(text.replace(anchor, replacement, 1))
    print(f"OK   [{label}]: {path.name} patched.")

# ---------------------------------------------------------------------------
# The [kiwi_emulation] block appended to any config .toml that has not got one.
# Only "enabled" is set; the four trims are documented but left commented, so
# the defaults (which are the calibrated values) apply until you choose to move
# them.
# ---------------------------------------------------------------------------
KIWI_TOML_BLOCK = """
[kiwi_emulation]
# Answer the KiwiSDR protocol as well, so Kiwi clients (AetherSDR,
# kiwiclient...) can connect on the same host and port, at /kiwi/<id>/SND
# and /kiwi/<id>/W/F.
enabled = true
# smeter_offset = 0   # dB, Kiwi clients only. Overrides input.analog_smeter_offset,
#                     # which is the default and makes the Kiwi S-meter read the
#                     # same as the web page. Set it only to make Kiwi differ.
# audio_gain = 55     # dB, Kiwi clients only. The bridge sends the same PCM a
#                     # browser gets, but a browser then applies its own EQ and
#                     # compressor, which a Kiwi client has not got - so the
#                     # stream sounds thin by comparison. 0 (the default) leaves
#                     # it untouched. A look-ahead limiter keeps the peaks safe,
#                     # so too high costs loudness, not clipping; 55-60 is usual.
# wf_cal = 0          # dB, Kiwi clients only. The bridge converts each waterfall
#                     # bin to an absolute dBm before sending it, so the Kiwi
#                     # spectrum is on a real dB scale and does not shift when
#                     # you zoom. That scale is already the one the S-meter is
#                     # calibrated to, so 0 is correct: this is a DISPLAY trim,
#                     # not a calibration. A negative value simply pushes the
#                     # spectrum and the waterfall down together - they share one
#                     # byte stream, the Kiwi protocol cannot scale them apart.
#                     # To verify the scale, compare the waterfall summed over
#                     # the passband against the S-meter on a QUIET frequency:
#                     # on a carrier an SSB passband excludes the carrier itself
#                     # and the two are not comparable.
# wf_fps_max = 23     # Waterfall frames per second, Kiwi clients only. 23 is the
#                     # KiwiSDR protocol's own declared maximum and the default.
#                     # The receiver can only produce 2*sps/fft_size frames a
#                     # second and the LOWER of the two always wins, so raising
#                     # this does anything only if your FFT is fast enough to
#                     # have spare frames. Whether feeding a client faster than
#                     # the protocol promises helps, or merely fills its buffer,
#                     # is decided by the client - measure it, do not assume it.
"""

def patch_toml(path: pathlib.Path):
    label = f"{path.name}: [kiwi_emulation] enabled"
    if not path.exists():
        print(f"SKIP [{label}]: file absent, skipped.")
        return
    text = path.read_text()
    if "[kiwi_emulation]" in text:
        print(f"OK   [{label}]: already present, skipped.")
        return
    separator = "" if text.endswith("\n") else "\n"
    text += separator + KIWI_TOML_BLOCK
    path.write_text(text)
    print(f"OK   [{label}]: {path.name} patched.")

# ---------------------------------------------------------------------------
# client.h
# ---------------------------------------------------------------------------
client_h = src / "client.h"

patch(
    client_h,
    """enum conn_type {
    SIGNAL,
    WATERFALL,
    AUDIO,
    EVENTS,
    CHAT,
    WATERFALL_RAW,
    SIGNAL_RAW,
    UNKNOWN
};""",
    """enum conn_type {
    SIGNAL,
    WATERFALL,
    AUDIO,
    EVENTS,
    CHAT,
    WATERFALL_RAW,
    SIGNAL_RAW,
    UNKNOWN,
    KIWI_SND,
    KIWI_WF
};""",
    "client.h: conn_type enum",
    marker="""    KIWI_SND,
    KIWI_WF""",
)

patch(
    client_h,
    """    case CHAT:
        return "Chat";
    default:
        return "Unknown";
    }
}""",
    """    case CHAT:
        return "Chat";
    case KIWI_SND:
        return "Kiwi SND";
    case KIWI_WF:
        return "Kiwi W/F";
    default:
        return "Unknown";
    }
}""",
    "client.h: type_to_name switch",
    marker='case KIWI_SND:',
)

patch(
    client_h,
    'enum waterfall_compressor { WATERFALL_ZSTD, WATERFALL_AV1 };',
    'enum waterfall_compressor { WATERFALL_ZSTD, WATERFALL_AV1, WATERFALL_KIWI };',
    "client.h: waterfall_compressor enum",
    marker='WATERFALL_KIWI }',
)

patch(
    client_h,
    'enum audio_compressor { AUDIO_FLAC, AUDIO_OPUS, AUDIO_PCM };',
    'enum audio_compressor { AUDIO_FLAC, AUDIO_OPUS, AUDIO_PCM, AUDIO_KIWI_PCM };',
    "client.h: audio_compressor enum",
    marker='AUDIO_KIWI_PCM }',
)

# ---------------------------------------------------------------------------
# signal.cpp
# ---------------------------------------------------------------------------
signal_cpp = src / "signal.cpp"

patch(
    signal_cpp,
    '#include "fft.h"\n#include "signal.h"\n#include "utils/dsp.h"',
    '#include "fft.h"\n#include "signal.h"\n#include "utils/dsp.h"\n#include "kiwi_bridge.h"',
    "signal.cpp: include kiwi_bridge.h",
    marker='#include "kiwi_bridge.h"',
)

patch(
    signal_cpp,
    """void AudioClient::set_audio_demodulation(demodulation_mode demodulation) {
    this->demodulation = demodulation;
}""",
    """void AudioClient::set_audio_demodulation(demodulation_mode demodulation) {
    this->demodulation = demodulation;

    // Mode-dependent AGC profile, mirroring what on_demodulation_message()
    // does for browser clients. Every Kiwi client reaches the demodulator ONLY
    // through here -- "SET mod=" is translated into this call -- so without
    // this it kept whatever profile the AGC was constructed with (SSB, see
    // AGC::AGC) no matter what it tuned to, and AM ran with SSB hang and
    // release timing.
    //
    // Deliberately NOT calling set_am_stereo(): that rebuilds the encoder as
    // Opus or FLAC, which for a Kiwi client would throw away the KiwiSndEncoder
    // mid-session and break the bridge. am_stereo and sam_enabled both default
    // to false, so a Kiwi client gets the envelope detector on AM -- which is
    // what "SET mod=am" means to a Kiwi client anyway. C-QUAM stays reachable
    // only through the browser path, which owns the encoder swap.
    {
        std::scoped_lock lk(agc_mtx_);
        agc.reset();
        if (demodulation == AM) {
            if (am_stereo.load(std::memory_order_relaxed)) {
                agc.configureForQUAM();
            } else {
                agc.configureForAM();
            }
        } else {
            agc.configureForSSB();
        }
    }
}""",
    "signal.cpp: AGC profile in set_audio_demodulation (Kiwi tunes only via here)",
    marker='Mode-dependent AGC profile, mirroring what on_demodulation_message()',
)

patch(
    signal_cpp,
    """    if (codec == AUDIO_PCM) {
        // Raw PCM needs no configuration — no sample rate, blocksize or channel
        // setup. The autorun loopback client is mono; PcmEncoder ships int16 LE.
        return std::make_unique<PcmEncoder>(hdl, sender);
    }
#ifdef HAS_LIBOPUS""",
    """    if (codec == AUDIO_PCM) {
        // Raw PCM needs no configuration — no sample rate, blocksize or channel
        // setup. The autorun loopback client is mono; PcmEncoder ships int16 LE.
        return std::make_unique<PcmEncoder>(hdl, sender);
    }
    if (codec == AUDIO_KIWI_PCM) {
        return std::make_unique<KiwiSndEncoder>(hdl, sender);
    }
#ifdef HAS_LIBOPUS""",
    "signal.cpp: make_audio_encoder AUDIO_KIWI_PCM branch",
    marker='codec == AUDIO_KIWI_PCM',
)

# ---------------------------------------------------------------------------
# waterfall.cpp
# ---------------------------------------------------------------------------
waterfall_cpp = src / "waterfall.cpp"

patch(
    waterfall_cpp,
    '#include "waterfall.h"\n#include "waterfallcompression.h"',
    '#include "waterfall.h"\n#include "waterfallcompression.h"\n#include "kiwi_bridge.h"',
    "waterfall.cpp: include kiwi_bridge.h",
    marker='#include "kiwi_bridge.h"',
)

patch(
    waterfall_cpp,
    """    if (waterfall_compression == WATERFALL_ZSTD) {
        waterfall_encoder =
            std::make_unique<ZstdEncoder>(hdl, sender, min_waterfall_fft);
    }
#ifdef HAS_LIBAOM""",
    """    if (waterfall_compression == WATERFALL_ZSTD) {
        waterfall_encoder =
            std::make_unique<ZstdEncoder>(hdl, sender, min_waterfall_fft);
    } else if (waterfall_compression == WATERFALL_KIWI) {
        waterfall_encoder = std::make_unique<KiwiWfEncoder>(hdl, sender);
        is_kiwi = true;
    }
#ifdef HAS_LIBAOM""",
    "waterfall.cpp: constructor WATERFALL_KIWI branch",
    marker='waterfall_compression == WATERFALL_KIWI',
)

# ---------------------------------------------------------------------------
# spectrumserver.h
# ---------------------------------------------------------------------------
spectrumserver_h = src / "spectrumserver.h"

patch(
    spectrumserver_h,
    """    // Signal functions, audio demodulation
    void on_open_signal(connection_hdl hdl, conn_type signal_type);""",
    """    // Signal functions, audio demodulation
    void on_open_signal(connection_hdl hdl, conn_type signal_type);

    // Kiwi protocol bridge (leurre KiwiSDR)
    void on_open_kiwi_snd(connection_hdl hdl);
    void on_open_kiwi_wf(connection_hdl hdl);""",
    "spectrumserver.h: declare on_open_kiwi_snd/wf",
    marker='on_open_kiwi_snd(',
)

patch(
    spectrumserver_h,
    '    bool show_other_users;',
    """    bool show_other_users;
    bool kiwi_emulation_enabled;""",
    "spectrumserver.h: kiwi_emulation_enabled member",
    marker='bool kiwi_emulation_enabled;',
)

# ---------------------------------------------------------------------------
# spectrumserver.cpp
# ---------------------------------------------------------------------------
spectrumserver_cpp = src / "spectrumserver.cpp"

patch(
    spectrumserver_cpp,
    '#include "spectrumserver.h"\n#include "chat.h"',
    '#include "spectrumserver.h"\n#include "kiwi_bridge.h"\n#include "chat.h"',
    "spectrumserver.cpp: include kiwi_bridge.h",
    marker='#include "kiwi_bridge.h"',
)

patch(
    spectrumserver_cpp,
    '    show_other_users  = config["server"]["otherusers"].value_or(1) > 0;',
    """    show_other_users  = config["server"]["otherusers"].value_or(1) > 0;
    kiwi_emulation_enabled = config["kiwi_emulation"]["enabled"].value_or(false);
    // Kiwi S-meter calibration. Defaults to the offset the web UI is
    // already calibrated with, so both meters read the same; set
    // [kiwi_emulation] smeter_offset only to make Kiwi differ.
    // Defaults to analog_smeter_offset because that is the offset the web
    // page's own display chain applies before its visual expansion -- see the
    // S-meter note in kiwi_bridge.h. smeter_offset (the digital-only one) is
    // NOT the right default here: it never reaches the number on the page.
    kiwi_smeter_offset_db =
        config["kiwi_emulation"]["smeter_offset"].value_or(
            config["input"]["analog_smeter_offset"].value_or(0.0));
    // Kiwi output gain. The bridge sends the same PCM the browser gets, but
    // a Kiwi client has none of the browser's EQ/compressor chain, so it
    // sounds thin by comparison. 0 dB leaves the stream untouched.
    kiwi_wf_cal_db = config["kiwi_emulation"]["wf_cal"].value_or(0.0);
    kiwi_wf_size_log2 =
        (int)std::lround(std::log2((double)fft_size)) + brightness_offset;
    kiwi_wf_fps_cap = config["kiwi_emulation"]["wf_fps_max"].value_or(23.0);
    kiwi_audio_gain_db = config["kiwi_emulation"]["audio_gain"].value_or(0.0);
    kiwi_audio_gain_lin = std::pow(10.0, kiwi_audio_gain_db / 20.0);""",
    "spectrumserver.cpp: read the [kiwi_emulation] settings from config",
    marker='kiwi_emulation_enabled = config["kiwi_emulation"]',
)

# ---------------------------------------------------------------------------
# http.cpp
# ---------------------------------------------------------------------------
http_cpp = src / "http.cpp"

patch(
    http_cpp,
    '    // ── /logs/users_YYYY-MM-DD.jsonl ────────────────────────────────────────',
    """    if (kiwi_emulation_enabled && resource.rfind("/status", 0) == 0) {
        // Un client Kiwi (AetherSDR, kiwiclient...) exige un 200 OK sur
        // /status avant de tenter l'upgrade WebSocket. Le contenu exact
        // importe peu — valide empiriquement contre un stub minimal avant
        // cette integration.
        con->append_header("Content-Type", "text/html");
        con->set_body("<html><body>Kiwi bridge OK</body></html>");
        con->set_status(websocketpp::http::status_code::ok);
        return;
    }

    // ── /logs/users_YYYY-MM-DD.jsonl ────────────────────────────────────────""",
    "http.cpp: /status handler for Kiwi pre-flight check",
    marker='resource.rfind("/status", 0) == 0',
)

# ---------------------------------------------------------------------------
# websocket.cpp
# ---------------------------------------------------------------------------
websocket_cpp = src / "websocket.cpp"

patch(
    websocket_cpp,
    '#include "waterfall.h"\n#include "chat.h"',
    """#include "waterfall.h"
#include "chat.h"
#include "kiwi_bridge.h"
#include <algorithm>""",
    "websocket.cpp: include kiwi_bridge.h + algorithm",
    marker='#include "kiwi_bridge.h"',
)

patch(
    websocket_cpp,
    """    if (path == "/audio") {
        on_open_signal(hdl, AUDIO);
    } else if (path == "/signal") {
        // on_open_signal(hdl, SIGNAL);
    } else if (path == "/waterfall") {
        on_open_waterfall(hdl);
    } else if (path == "/waterfall_raw") {
        // on_open_waterfall_raw(hdl);
    } else if (path == "/events") {
        on_open_events(hdl);
    } else if (path == "/chat") {
        on_open_chat(hdl);
    } else {
        on_open_unknown(hdl);
    }
}""",
    """    if (path == "/audio") {
        on_open_signal(hdl, AUDIO);
    } else if (path == "/signal") {
        // on_open_signal(hdl, SIGNAL);
    } else if (path == "/waterfall") {
        on_open_waterfall(hdl);
    } else if (path == "/waterfall_raw") {
        // on_open_waterfall_raw(hdl);
    } else if (path == "/events") {
        on_open_events(hdl);
    } else if (path == "/chat") {
        on_open_chat(hdl);
    } else if (kiwi_emulation_enabled && is_kiwi_snd_path(path)) {
        on_open_kiwi_snd(hdl);
    } else if (kiwi_emulation_enabled && is_kiwi_wf_path(path)) {
        on_open_kiwi_wf(hdl);
    } else {
        on_open_unknown(hdl);
    }
}

// ----------------------------------------------------------------------------
// Kiwi protocol bridge (leurre KiwiSDR) — voir kiwi_bridge.h
// ----------------------------------------------------------------------------

void broadcast_server::on_open_kiwi_snd(connection_hdl hdl) {
    // Pas de send_basic_info() : un client Kiwi n'attend rien avant d'avoir
    // lui-même envoyé "SET auth ...".
    int kiwi_audio_fft_size =
        ceil((double)audio_max_sps * fft_size / sps / 4.) * 4;
    std::shared_ptr<AudioClient> client = std::make_shared<AudioClient>(
        hdl, *this, AUDIO_KIWI_PCM, is_real, kiwi_audio_fft_size, audio_max_sps,
        fft_result_size);
    client->unique_id = generate_unique_id();
    client->set_audio_demodulation(default_mode);
    {
        std::scoped_lock lg(signal_slice_mtx);
        auto it = signal_slices.insert({{0, 0}, client});
        client->it = it;
    }
    client->set_audio_range(default_l, default_m, default_r);

    server::connection_ptr con = m_server.get_con_from_hdl(hdl);
    con->set_close_handler([client](connection_hdl) {
        try { client->on_close(); } catch (...) {}
    });
    con->set_fail_handler([client](connection_hdl) {
        try { client->on_close(); } catch (...) {}
    });

    // Réaccordage : traduit "SET mod=... freq=..." en indices de bin FFT.
    // UNIQUEMENT pour une entrée réelle (is_real) — voir TODO_KIWI_RETUNE_IQ
    // dans kiwi_bridge.h pour le cas IQ, non implémenté. Journalisé dans
    // /tmp/kiwi_retune.log à chaque étape.
    //
    // IMPORTANT : audio_mid (le paramètre "m" de set_audio_range) doit être
    // exprimé en INDICE DE BIN, comme l/r — PAS en Hz. C'est le point qui a
    // fait échouer la première tentative (silence total, quelle que soit la
    // fréquence) : on passait la fréquence en Hz directement, ce qui rendait
    // audio_m totalement hors de portée dans AudioClient::send_audio() et
    // empêchait toute copie de données vers le buffer de démodulation.
    auto retune_cb = [this, client, kiwi_audio_fft_size](const std::string &mode_str,
                                    double low_cut_hz, double high_cut_hz,
                                    double freq_khz) {
        if (!is_real) {
            kiwi_debug_log("REJETE: entree non reelle (IQ), reaccordage non supporte");
            return;
        }
        double bin_hz = (double)sps / (double)fft_size;
        double freq_hz = freq_khz * 1000.0;
        double lo = freq_hz + low_cut_hz - (double)basefreq;
        double hi = freq_hz + high_cut_hz - (double)basefreq;
        if (lo > hi) std::swap(lo, hi);

        int l_bin = static_cast<int>(std::floor(lo / bin_hz));
        int r_bin = static_cast<int>(std::ceil(hi / bin_hz));
        l_bin = std::clamp(l_bin, 0, fft_result_size - 1);
        r_bin = std::clamp(r_bin, 0, fft_result_size - 1);
        kiwi_debug_log("is_real=" + std::to_string(is_real) +
                       " bin_hz=" + std::to_string(bin_hz) +
                       " l_bin=" + std::to_string(l_bin) +
                       " r_bin=" + std::to_string(r_bin) +
                       " fft_result_size=" + std::to_string(fft_result_size) +
                       " kiwi_audio_fft_size=" + std::to_string(kiwi_audio_fft_size));
        if (l_bin >= r_bin) {
            kiwi_debug_log("REJETE: l_bin >= r_bin");
            return;
        }
        if (r_bin - l_bin > kiwi_audio_fft_size) {
            kiwi_debug_log("REJETE: intervalle trop large");
            return;
        }

        bool recognized = false;
        demodulation_mode dmod = kiwi_mode_to_demod(mode_str, recognized);
        if (recognized) client->set_audio_demodulation(dmod);

        double m_bin = (freq_hz - (double)basefreq) / bin_hz;
        kiwi_debug_log("set_audio_range(l=" + std::to_string(l_bin) +
                       ", m_bin=" + std::to_string(m_bin) +
                       ", r=" + std::to_string(r_bin) +
                       ") mode_recognized=" + std::to_string(recognized));
        client->set_audio_range(l_bin, m_bin, r_bin);
    };

    auto auth_acked = std::make_shared<bool>(false);
    con->set_message_handler(
        [this, auth_acked, retune_cb](connection_hdl h, server::message_ptr msg) {
            KiwiCommandParser::handle_snd_message(
                msg->get_payload(), *auth_acked,
                [this, h](const std::string &s) {
                    send_binary_packet(h, s.data(), s.size());
                },
                retune_cb, (double)sps / 2.0,
                (double)basefreq + (double)sps / 4.0, (double)sps);
        });
}

void broadcast_server::on_open_kiwi_wf(connection_hdl hdl) {
    std::shared_ptr<WaterfallClient> client = std::make_shared<WaterfallClient>(
        hdl, *this, WATERFALL_KIWI, min_waterfall_fft);
    {
        std::scoped_lock lk(waterfall_slice_mtx[0]);
        auto it = waterfall_slices[0].insert({{0, min_waterfall_fft}, client});
        client->it = it;
    }
    client->set_waterfall_range(downsample_levels - 1, 0, min_waterfall_fft);

    // The FFT loop produces 2*sps/fft_size spectra per second. A Kiwi client
    // asks for at most 23 fps, so that is the ceiling we advertise and the
    // default a client gets until it says otherwise with SET wf_speed.
    const double kiwi_wf_max_fps =
        std::min(2.0 * (double)sps / (double)fft_size, kiwi_wf_fps_cap);
    client->set_kiwi_target_fps(kiwi_wf_max_fps);

    server::connection_ptr con = m_server.get_con_from_hdl(hdl);
    con->set_close_handler([client](connection_hdl) {
        try { client->on_close(); } catch (...) {}
    });
    con->set_fail_handler([client](connection_hdl) {
        try { client->on_close(); } catch (...) {}
    });

    // Réaccordage waterfall : traduit "SET zoom=.../cf=..." ou
    // "SET zoom=.../start=..." en WaterfallClient::on_window_message(),
    // qui réutilise la logique existante de sélection du niveau de
    // sous-échantillonnage — pas besoin de la réimplémenter.
    //
    // MAX_FREQ_KHZ est calculé depuis notre propre sps (pas figé à 30 MHz)
    // pour rester correct quel que soit le débit d'échantillonnage —
    // annoncé au client via "MSG bandwidth=..." côté SND.
    auto retune_wf_cb = [this, client](int zoom, double value, bool is_cf) {
        constexpr int MAX_ZOOM = 14;
        constexpr int WF_BINS = 1024;
        double max_freq_khz = (double)sps / 2.0 / 1000.0;

        double span_khz = max_freq_khz / (double)(1LL << zoom);
        double start_freq_khz;
        if (is_cf) {
            start_freq_khz = value - span_khz / 2.0;
        } else {
            double counter = value;
            start_freq_khz =
                counter * max_freq_khz / ((double)WF_BINS * (double)(1LL << MAX_ZOOM));
        }
        double end_freq_khz = start_freq_khz + span_khz;

        double bin_hz = (double)sps / (double)fft_size;
        double lo_hz = start_freq_khz * 1000.0 - (double)basefreq;
        double hi_hz = end_freq_khz * 1000.0 - (double)basefreq;

        // Une trame W/F Kiwi fait TOUJOURS 1024 bins. Si la fenetre
        // demandee deborde de notre spectre (0 .. sps/2), il ne faut donc
        // pas rogner les bords — cela produisait des trames courtes (770,
        // 1133, 1161 bins mesures) que le client redimensionne de travers.
        // On fait glisser la fenetre en conservant sa largeur, et on ne la
        // reduit que si elle est plus large que le spectre entier.
        int width = static_cast<int>(std::lround((hi_hz - lo_hz) / bin_hz));
        width = std::clamp(width, 1, fft_result_size);
        int l_bin = static_cast<int>(std::floor(lo_hz / bin_hz));
        l_bin = std::clamp(l_bin, 0, fft_result_size - width);
        int r_bin = l_bin + width;

        kiwi_debug_log("[WF] zoom=" + std::to_string(zoom) +
                       " is_cf=" + std::to_string(is_cf) +
                       " start_freq_khz=" + std::to_string(start_freq_khz) +
                       " span_khz=" + std::to_string(span_khz) +
                       " l_bin=" + std::to_string(l_bin) +
                       " r_bin=" + std::to_string(r_bin));

        if (l_bin >= r_bin) {
            kiwi_debug_log("[WF] REJETE: l_bin >= r_bin");
            return;
        }

        std::optional<double> dummy_m;
        std::optional<int> dummy_level;
        client->on_window_message(l_bin, dummy_m, r_bin, dummy_level);
        kiwi_debug_log("[WF] on_window_message applique");
    };

    auto auth_acked_wf = std::make_shared<bool>(false);
    auto wf_speed_cb = [client](double fps) {
        client->set_kiwi_target_fps(fps);
    };
    con->set_message_handler(
        [this, auth_acked_wf, retune_wf_cb, wf_speed_cb,
         kiwi_wf_max_fps](connection_hdl h, server::message_ptr msg) {
            KiwiCommandParser::handle_wf_message(
                msg->get_payload(), *auth_acked_wf,
                [this, h](const std::string &s) {
                    send_binary_packet(h, s.data(), s.size());
                },
                retune_wf_cb, kiwi_wf_max_fps, wf_speed_cb);
        });
}""",
    "websocket.cpp: routing + on_open_kiwi_snd/wf definitions (avec reaccordage audio et waterfall)",
    marker='is_kiwi_snd_path(path)',
)

# ---------------------------------------------------------------------------
# Kiwi waterfall pacing
# ---------------------------------------------------------------------------
# fft.cpp serves the waterfall every skip_num FFT frames, a cadence chosen for
# the web page -- about 14 fps on a 4M-point FFT at 60 Msps. A Kiwi client asks
# for 23 with "SET wf_speed=4" and paces its own scroll on what it was told, so
# the browser cadence makes its waterfall and spectrum look sluggish. Kiwi
# clients are therefore offered EVERY frame and thinned back to the rate they
# asked for, per client. The frames in between were already being computed and
# thrown away, so this adds no FFT work, and browser clients keep exactly the
# cadence they had.
#
# On a tree that already carries this (anything from 31 August 2026 on) every
# one of these reports "already applied" -- they are here for a tree that has
# the bridge but not the pacing.
# ---------------------------------------------------------------------------
fft_cpp = src / "fft.cpp"
waterfall_h = src / "waterfall.h"

patch(
    waterfall_h,
    """    void set_waterfall_range(int level, int l, int r);
    void send_waterfall(int8_t *buf, size_t frame_num);
    virtual void on_window_message(int l, std::optional<double> &m, int r,""",
    """    void set_waterfall_range(int level, int l, int r);
    void send_waterfall(int8_t *buf, size_t frame_num);

    // ---- Kiwi waterfall pacing -------------------------------------------
    // Browser clients are served every `skip_num` FFT frames (~14 fps on a
    // 4M-point FFT at 60 Msps).  A Kiwi client asks for 23 fps with
    // "SET wf_speed=4" and paces its own scroll from what it was told, so
    // feeding it the browser cadence makes its waterfall and spectrum look
    // sluggish.  Kiwi clients are therefore offered EVERY FFT frame (~28.6
    // fps) and thinned back down here to the rate they actually asked for.
    // The accumulator is touched only from the FFT thread; the target can be
    // changed from the io thread by a wf_speed message, hence the atomic.
    bool is_kiwi{false};
    void set_kiwi_target_fps(double fps) {
        kiwi_target_fps.store(fps, std::memory_order_relaxed);
    }
    bool kiwi_take_frame(double source_fps);
    virtual void on_window_message(int l, std::optional<double> &m, int r,""",
    "waterfall.h: Kiwi pacing flag and target fps",
    marker='bool is_kiwi{false};',
)

patch(
    waterfall_h,
    """    std::chrono::steady_clock::time_point last_send_time;
    int data_points_sent_in_current_second;
};""",
    """    std::chrono::steady_clock::time_point last_send_time;
    int data_points_sent_in_current_second;

    std::atomic<double> kiwi_target_fps{0.0};
    double kiwi_frame_accum{0.0}; // FFT thread only
};""",
    "waterfall.h: Kiwi pacing accumulator",
    marker='kiwi_target_fps{0.0}',
)

patch(
    waterfall_cpp,
    'void WaterfallClient::set_waterfall_range(int level, int l, int r) {',
    """// Rate matching for Kiwi clients.  Called once per FFT frame (the source
// cadence) and returns true for as many of them as the requested fps needs.
// The fractional accumulator keeps the long-run average exact instead of
// rounding the ratio down to an integer frame skip -- 23 fps out of a 28.6 fps
// source is 4 frames in every 5, which no modulo can express.
bool WaterfallClient::kiwi_take_frame(double source_fps) {
    const double target = kiwi_target_fps.load(std::memory_order_relaxed);
    if (target <= 0.0) return false;              // SET wf_speed=0 -> off
    if (target >= source_fps || source_fps <= 0.0) return true;
    kiwi_frame_accum += target / source_fps;
    if (kiwi_frame_accum >= 1.0) {
        kiwi_frame_accum -= 1.0;
        return true;
    }
    return false;
}

void WaterfallClient::set_waterfall_range(int level, int l, int r) {""",
    "waterfall.cpp: WaterfallClient::kiwi_take_frame",
    marker='WaterfallClient::kiwi_take_frame',
)

patch(
    spectrumserver_h,
    '    std::vector<std::future<void>> waterfall_loop(int8_t *fft_power_quantized);',
    """    std::vector<std::future<void>> waterfall_loop(int8_t *fft_power_quantized,
                                                  bool kiwi_only,
                                                  double source_fps);""",
    "spectrumserver.h: waterfall_loop takes kiwi_only and source_fps",
    marker='double source_fps);',
)

patch(
    websocket_cpp,
    """std::vector<std::future<void>>
broadcast_server::waterfall_loop(int8_t *fft_power_quantized) {""",
    """std::vector<std::future<void>>
broadcast_server::waterfall_loop(int8_t *fft_power_quantized, bool kiwi_only,
                                 double source_fps) {""",
    "websocket.cpp: waterfall_loop signature",
    marker='double source_fps) {',
)

patch(
    websocket_cpp,
    """            auto &[l_idx, r_idx] = slice;
            // If the client is slow, avoid unnecessary buffering and""",
    """            auto &[l_idx, r_idx] = slice;

            // Kiwi clients are offered every FFT frame and thinned to the fps
            // they asked for; everyone else keeps the browser cadence, so on
            // the frames the browser waterfall skips there is nothing to do
            // for them.  See WaterfallClient::kiwi_take_frame().
            if (data->is_kiwi) {
                if (!data->kiwi_take_frame(source_fps)) {
                    continue;
                }
            } else if (kiwi_only) {
                continue;
            }

            // If the client is slow, avoid unnecessary buffering and""",
    "websocket.cpp: thin Kiwi clients to the fps they asked for",
    marker='kiwi_take_frame(source_fps)',
)

patch(
    fft_cpp,
    """    auto signal_loop_fn = std::bind(&broadcast_server::signal_loop, this);
    auto waterfall_loop_fn = std::bind(&broadcast_server::waterfall_loop, this,
                                       fft->get_quantized_buffer());""",
    """    // Rate at which this loop produces a new spectrum: one hop is half an FFT
    // window (50% overlap is hardcoded above), so sps/(fft_size/2).  Kiwi
    // clients are paced against it -- see WaterfallClient::kiwi_take_frame().
    const double waterfall_source_fps = 2.0 * (double)sps / (double)fft_size;

    auto signal_loop_fn = std::bind(&broadcast_server::signal_loop, this);
    int8_t *quantized_buffer = fft->get_quantized_buffer();
    auto waterfall_loop_fn = [this, quantized_buffer,
                              waterfall_source_fps](bool kiwi_only) {
        return waterfall_loop(quantized_buffer, kiwi_only,
                              waterfall_source_fps);
    };""",
    "fft.cpp: waterfall_loop lambda carries the source frame rate",
    marker='waterfall_source_fps',
)

patch(
    fft_cpp,
    """        signal_futures = signal_loop_fn();
        if (frame_num % skip_num == 0) {
            waterfall_futures = waterfall_loop_fn();
        }""",
    """        signal_futures = signal_loop_fn();
        // Run every frame now: browser clients still only get served on the
        // skip_num boundary, but Kiwi clients need the frames in between to
        // reach the ~23 fps their protocol asks for.
        waterfall_futures = waterfall_loop_fn(frame_num % skip_num != 0);""",
    "fft.cpp: run the waterfall loop on every frame",
    marker='waterfall_loop_fn(frame_num % skip_num != 0)',
)

patch(
    waterfall_cpp,
    """    } else if (waterfall_compression == WATERFALL_KIWI) {
        waterfall_encoder = std::make_unique<KiwiWfEncoder>(hdl, sender);
    }""",
    """    } else if (waterfall_compression == WATERFALL_KIWI) {
        waterfall_encoder = std::make_unique<KiwiWfEncoder>(hdl, sender);
        is_kiwi = true;
    }""",
    "waterfall.cpp: mark a Kiwi waterfall client as one",
    marker='is_kiwi = true;',
)

patch(
    spectrumserver_cpp,
    """    kiwi_wf_size_log2 =
        (int)std::lround(std::log2((double)fft_size)) + brightness_offset;
    kiwi_audio_gain_db = config["kiwi_emulation"]["audio_gain"].value_or(0.0);""",
    """    kiwi_wf_size_log2 =
        (int)std::lround(std::log2((double)fft_size)) + brightness_offset;
    kiwi_wf_fps_cap = config["kiwi_emulation"]["wf_fps_max"].value_or(23.0);
    kiwi_audio_gain_db = config["kiwi_emulation"]["audio_gain"].value_or(0.0);""",
    "spectrumserver.cpp: read [kiwi_emulation] wf_fps_max",
    marker='kiwi_wf_fps_cap = config',
)

patch(
    websocket_cpp,
    """    client->set_waterfall_range(downsample_levels - 1, 0, min_waterfall_fft);

    server::connection_ptr con = m_server.get_con_from_hdl(hdl);
    con->set_close_handler([client](connection_hdl) {
        try { client->on_close(); } catch (...) {}
    });
    con->set_fail_handler([client](connection_hdl) {
        try { client->on_close(); } catch (...) {}
    });

    // Réaccordage waterfall : traduit "SET zoom=.../cf=..." ou
    // "SET zoom=.../start=..." en WaterfallClient::on_window_message(),
    // qui réutilise la logique existante de sélection du niveau de
    // sous-échantillonnage — pas besoin de la réimplémenter.
    //
    // MAX_FREQ_KHZ est calculé depuis notre propre sps (pas figé à 30 MHz)
    // pour rester correct quel que soit le débit d'échantillonnage —
    // annoncé au client via "MSG bandwidth=..." côté SND.
    auto retune_wf_cb = [this, client](int zoom, double value, bool is_cf) {
        constexpr int MAX_ZOOM = 14;
        constexpr int WF_BINS = 1024;
        double max_freq_khz = (double)sps / 2.0 / 1000.0;

        double span_khz = max_freq_khz / (double)(1LL << zoom);
        double start_freq_khz;
        if (is_cf) {
            start_freq_khz = value - span_khz / 2.0;
        } else {
            double counter = value;
            start_freq_khz =
                counter * max_freq_khz / ((double)WF_BINS * (double)(1LL << MAX_ZOOM));
        }
        double end_freq_khz = start_freq_khz + span_khz;

        double bin_hz = (double)sps / (double)fft_size;
        double lo_hz = start_freq_khz * 1000.0 - (double)basefreq;
        double hi_hz = end_freq_khz * 1000.0 - (double)basefreq;

        // Une trame W/F Kiwi fait TOUJOURS 1024 bins. Si la fenetre
        // demandee deborde de notre spectre (0 .. sps/2), il ne faut donc
        // pas rogner les bords — cela produisait des trames courtes (770,
        // 1133, 1161 bins mesures) que le client redimensionne de travers.
        // On fait glisser la fenetre en conservant sa largeur, et on ne la
        // reduit que si elle est plus large que le spectre entier.
        int width = static_cast<int>(std::lround((hi_hz - lo_hz) / bin_hz));
        width = std::clamp(width, 1, fft_result_size);
        int l_bin = static_cast<int>(std::floor(lo_hz / bin_hz));
        l_bin = std::clamp(l_bin, 0, fft_result_size - width);
        int r_bin = l_bin + width;

        kiwi_debug_log("[WF] zoom=" + std::to_string(zoom) +
                       " is_cf=" + std::to_string(is_cf) +
                       " start_freq_khz=" + std::to_string(start_freq_khz) +
                       " span_khz=" + std::to_string(span_khz) +
                       " l_bin=" + std::to_string(l_bin) +
                       " r_bin=" + std::to_string(r_bin));

        if (l_bin >= r_bin) {
            kiwi_debug_log("[WF] REJETE: l_bin >= r_bin");
            return;
        }

        std::optional<double> dummy_m;
        std::optional<int> dummy_level;
        client->on_window_message(l_bin, dummy_m, r_bin, dummy_level);
        kiwi_debug_log("[WF] on_window_message applique");
    };

    auto auth_acked_wf = std::make_shared<bool>(false);
    con->set_message_handler(
        [this, auth_acked_wf, retune_wf_cb](connection_hdl h, server::message_ptr msg) {
            KiwiCommandParser::handle_wf_message(
                msg->get_payload(), *auth_acked_wf,
                [this, h](const std::string &s) {
                    send_binary_packet(h, s.data(), s.size());
                },
                retune_wf_cb);
        });
}""",
    """    client->set_waterfall_range(downsample_levels - 1, 0, min_waterfall_fft);

    // The FFT loop produces 2*sps/fft_size spectra per second. A Kiwi client
    // asks for at most 23 fps, so that is the ceiling we advertise and the
    // default a client gets until it says otherwise with SET wf_speed.
    const double kiwi_wf_max_fps =
        std::min(2.0 * (double)sps / (double)fft_size, kiwi_wf_fps_cap);
    client->set_kiwi_target_fps(kiwi_wf_max_fps);

    server::connection_ptr con = m_server.get_con_from_hdl(hdl);
    con->set_close_handler([client](connection_hdl) {
        try { client->on_close(); } catch (...) {}
    });
    con->set_fail_handler([client](connection_hdl) {
        try { client->on_close(); } catch (...) {}
    });

    // Réaccordage waterfall : traduit "SET zoom=.../cf=..." ou
    // "SET zoom=.../start=..." en WaterfallClient::on_window_message(),
    // qui réutilise la logique existante de sélection du niveau de
    // sous-échantillonnage — pas besoin de la réimplémenter.
    //
    // MAX_FREQ_KHZ est calculé depuis notre propre sps (pas figé à 30 MHz)
    // pour rester correct quel que soit le débit d'échantillonnage —
    // annoncé au client via "MSG bandwidth=..." côté SND.
    auto retune_wf_cb = [this, client](int zoom, double value, bool is_cf) {
        constexpr int MAX_ZOOM = 14;
        constexpr int WF_BINS = 1024;
        double max_freq_khz = (double)sps / 2.0 / 1000.0;

        double span_khz = max_freq_khz / (double)(1LL << zoom);
        double start_freq_khz;
        if (is_cf) {
            start_freq_khz = value - span_khz / 2.0;
        } else {
            double counter = value;
            start_freq_khz =
                counter * max_freq_khz / ((double)WF_BINS * (double)(1LL << MAX_ZOOM));
        }
        double end_freq_khz = start_freq_khz + span_khz;

        double bin_hz = (double)sps / (double)fft_size;
        double lo_hz = start_freq_khz * 1000.0 - (double)basefreq;
        double hi_hz = end_freq_khz * 1000.0 - (double)basefreq;

        // Une trame W/F Kiwi fait TOUJOURS 1024 bins. Si la fenetre
        // demandee deborde de notre spectre (0 .. sps/2), il ne faut donc
        // pas rogner les bords — cela produisait des trames courtes (770,
        // 1133, 1161 bins mesures) que le client redimensionne de travers.
        // On fait glisser la fenetre en conservant sa largeur, et on ne la
        // reduit que si elle est plus large que le spectre entier.
        int width = static_cast<int>(std::lround((hi_hz - lo_hz) / bin_hz));
        width = std::clamp(width, 1, fft_result_size);
        int l_bin = static_cast<int>(std::floor(lo_hz / bin_hz));
        l_bin = std::clamp(l_bin, 0, fft_result_size - width);
        int r_bin = l_bin + width;

        kiwi_debug_log("[WF] zoom=" + std::to_string(zoom) +
                       " is_cf=" + std::to_string(is_cf) +
                       " start_freq_khz=" + std::to_string(start_freq_khz) +
                       " span_khz=" + std::to_string(span_khz) +
                       " l_bin=" + std::to_string(l_bin) +
                       " r_bin=" + std::to_string(r_bin));

        if (l_bin >= r_bin) {
            kiwi_debug_log("[WF] REJETE: l_bin >= r_bin");
            return;
        }

        std::optional<double> dummy_m;
        std::optional<int> dummy_level;
        client->on_window_message(l_bin, dummy_m, r_bin, dummy_level);
        kiwi_debug_log("[WF] on_window_message applique");
    };

    auto auth_acked_wf = std::make_shared<bool>(false);
    auto wf_speed_cb = [client](double fps) {
        client->set_kiwi_target_fps(fps);
    };
    con->set_message_handler(
        [this, auth_acked_wf, retune_wf_cb, wf_speed_cb,
         kiwi_wf_max_fps](connection_hdl h, server::message_ptr msg) {
            KiwiCommandParser::handle_wf_message(
                msg->get_payload(), *auth_acked_wf,
                [this, h](const std::string &s) {
                    send_binary_packet(h, s.data(), s.size());
                },
                retune_wf_cb, kiwi_wf_max_fps, wf_speed_cb);
        });
}""",
    "websocket.cpp: on_open_kiwi_wf advertises and honours the frame rate",
    marker='const double kiwi_wf_max_fps',
)

# ---------------------------------------------------------------------------
# config .toml files — enable [kiwi_emulation] enabled = true
# ---------------------------------------------------------------------------
repo_root = src.parent
for toml_name in sys.argv[2:]:
    patch_toml(repo_root / toml_name)

print()
print("All patches applied successfully.")
PYEOF

echo
echo "=================================================================="
echo "Installation complete."
echo
echo "Remaining steps:"
echo "  1. ./recompile.sh   (choose [1] Backend only)"
echo "  2. Point a Kiwi client (AetherSDR, kiwiclient...) at the same"
echo "     host/port as usual — paths /kiwi/<id>/SND and /kiwi/<id>/W/F"
echo
echo "[kiwi_emulation] was enabled automatically in whichever of the"
echo "listed config .toml files are present in the repository root."
echo
echo "Debug log, always available: /tmp/kiwi_retune.log"
echo
echo "If a patch fails or the build breaks afterwards, keep the exact"
echo "message — it identifies precisely which anchor moved."
echo
echo "Backups of the original files: $BACKUP_DIR"
echo "=================================================================="
