#ifndef KIWI_BRIDGE_H
#define KIWI_BRIDGE_H

// ============================================================================
// kiwi_bridge.h — WITH RETUNING + LOGGING
//
// A KiwiSDR protocol shim for PhantomSDR-Plus. The frame format was validated
// byte by byte against a real KiwiSDR and re-checked with a real third-party
// client (AetherSDR) — connection, handshake, audio and waterfall all
// confirmed working on a clean 3.8.0 base.
//
// RETUNING (SND): "SET mod=<mode> low_cut=<lc> high_cut=<hc> freq=<khz>" is
// translated into set_audio_range()/set_audio_demodulation(), for a REAL input
// only (is_real == true, signal="real" in config.toml). For an IQ input the
// bin<->frequency formula differs and is not implemented here — see
// TODO_KIWI_RETUNE_IQ.
//
// LOGGING: every step of a retune is traced to /tmp/kiwi_retune.log through
// kiwi_debug_log(), so no terminal has to be watching — read the file
// afterwards with `cat /tmp/kiwi_retune.log`. The cost is negligible and it
// can be left in place permanently.
//
// WATERFALL RETUNING: "SET zoom=<z> cf=<khz>" and "SET zoom=<z>
// start=<counter>" (both forms of the real Kiwi protocol are handled) are
// translated into WaterfallClient::on_window_message(), which reuses the
// existing decimation-level selection logic.
// ============================================================================

#include "audio.h"
#include "waterfallcompression.h"
#include "client.h"

#include <algorithm>
#include <chrono>
#include <cmath>
#include <cstdint>
#include <ctime>
#include <fstream>
#include <functional>
#include <iomanip>
#include <sstream>
#include <string>
#include <mutex>
#include <unordered_map>
#include <unordered_set>
#include <vector>

// ----------------------------------------------------------------------------
// Debug logging — /tmp/kiwi_retune.log
// ----------------------------------------------------------------------------

inline void kiwi_debug_log(const std::string &msg) {
    std::ofstream log("/tmp/kiwi_retune.log", std::ios::app);
    if (!log) return;
    auto now = std::chrono::system_clock::now();
    std::time_t t = std::chrono::system_clock::to_time_t(now);
    char buf[32];
    // localtime_r, not localtime: the SND and W/F encoders log from different
    // threads and localtime returns a shared static buffer.
    std::tm tm{};
    localtime_r(&t, &tm);
    std::strftime(buf, sizeof(buf), "%H:%M:%S", &tm);
    log << "[" << buf << "] " << msg << std::endl;
}

// Log an unrecognised command ONCE per distinct command word.
//
// The catch-all below used to write a line every time. A Kiwi client repeats a
// small set of commands forever -- AetherSDR sends "SET keepalive" every few
// seconds on both sockets and "SET maxdb=.. mindb=.." on every drag of its
// contrast slider -- so a single client added tens of thousands of lines a day
// to a file that nothing ever rotates. Measured on one 9-minute session: 43 kB,
// of which 98 lines were keepalives and 75 were maxdb/mindb.
//
// None of those repeats carried information. The point of the catch-all is to
// reveal WHICH commands a client sends that we do not handle, and the first
// sighting says that completely. So the command word is the key -- everything
// before the first '=', which turns "SET maxdb=-10 mindb=-143" into
// "SET maxdb" -- and only its first occurrence is written.
inline void kiwi_log_unhandled(const char *side, const std::string &msg) {
    std::string key = msg.substr(0, msg.find('='));
    if (key.size() > 64) key.resize(64);

    static std::mutex mtx;
    static std::unordered_set<std::string> seen;
    {
        std::scoped_lock lk(mtx);
        if (!seen.insert(std::string(side) + key).second) return;
    }
    kiwi_debug_log(std::string(side) + " commande non geree (1re fois): " + msg);
}

// ----------------------------------------------------------------------------
// S-meter calibration
// ----------------------------------------------------------------------------
// Kiwi clients render the meter as dBm = -127 + raw * 0.1, so whatever this
// encoder puts on the wire is displayed verbatim as dBm. Uncalibrated it fed
// raw dBFS into that field, which read S9+ on weak signals.
//
// The meter now uses the SAME quantity the PhantomSDR web UI meter uses --
// the per-packet `pwr` the demodulator hands to every AudioEncoder via
// set_data() -- through the frontend's own formula (audio.js):
//
//     dB = 20 * log10(sqrt(pwr) / 2) + smeter_offset
//
// but that is only the number the web UI starts from, not the one it shows.
// The figure on the page goes through three more stages before a listener
// reads it, and matching them is the whole point of this block:
//
//   App.svelte::_smeterTick()      + input.analog_smeter_offset
//                                  then expanded about -130 dBm by visualGain
//   SMeterDigital.svelte           + VISUAL_DBM_OFFSET
//
// Skipping them left the Kiwi meter reading the raw scale while the page read
// the expanded one. Because visualGain is a SLOPE, the two disagreed by an
// amount that moved with signal strength -- about 13 dB on a strong carrier and
// 6 dB near the noise floor -- so no single offset could have reconciled them.
//
// The constants below mirror the frontend. If the look of the web meter is ever
// retuned, these have to move with it: App.svelte's visualGain and
// SMeterDigital.svelte's VISUAL_DBM_OFFSET are the two to watch.
//
// Note this scale is the web page's, not a physical one: a 10 dB change in
// signal is displayed as 11. That is deliberate -- the receiver's own meter is
// the reference the operator compares against.
//
// The offset is set at startup from input.analog_smeter_offset, the value the
// page's own chain uses; [kiwi_emulation] smeter_offset overrides it if the
// Kiwi meter should differ. Nothing here touches the web UI's own path.
inline double kiwi_smeter_offset_db = 0.0;

inline constexpr double kKiwiSmeterFloorDb  = -130.0;  // App.svelte minDb
inline constexpr double kKiwiSmeterSlope    = 1.1;     // App.svelte visualGain
inline constexpr double kKiwiSmeterVisualDb = 5.0;     // SMeterDigital.svelte

// ----------------------------------------------------------------------------
// Kiwi waterfall dB scale
// ----------------------------------------------------------------------------
//   kiwi_wf_size_log2 = log2(fft_size) + brightness_offset, i.e. exactly the
//   "power_offset" that power_and_quantize() adds to the log2 of the power.
//   It has to be subtracted again to recover an absolute power.
//   kiwi_wf_cal_db is the final calibration, measured against the GUI's
//   (already calibrated) S-meter — see the note in KiwiWfEncoder::send().
inline int    kiwi_wf_size_log2 = 0;
inline double kiwi_wf_cal_db    = 0.0;

// Ceiling on the waterfall rate offered to a Kiwi client, in frames per
// second. 23 is what the KiwiSDR protocol declares as its maximum and what
// clients are built around, so it is the default; the receiver can only
// deliver 2*sps/fft_size anyway and the lower of the two wins. Raise it with
// [kiwi_emulation] wf_fps_max if your client is happy to render faster than
// the protocol promises -- it is the client, not the wire, that decides
// whether that helps or just fills its buffer.
inline double kiwi_wf_fps_cap = 23.0;

// ----------------------------------------------------------------------------
// Output gain, for Kiwi clients only
// ----------------------------------------------------------------------------
// The demodulator hands every encoder the same buffer, so a Kiwi client gets
// exactly the PCM a browser gets — measured identical, 57 counts peak on both
// paths at the same frequency and passband. What a browser then does with it,
// and a Kiwi client cannot, is audio.js's whole chain: bass boost, bandpass,
// presence, a compressor with makeup gain and the volume slider. That is the
// entire reason the web page sounds loud and a raw Kiwi stream sounds thin.
//
// This gain closes that gap for Kiwi clients without touching the web path.
// It is applied before the int16 clamp, so it uses the real headroom rather
// than amplifying an already-clamped value. 0 dB (no change) unless
// [kiwi_emulation] audio_gain is set.
//
// HOW FAR IT CAN BE PUSHED, and where it stops paying. Peaks off the
// demodulator sit around -55 dBFS (57 counts), so the first ~55 dB is pure
// level with the limiter idle. Past that the limiter starts working, which
// is the point of it: every further 6 dB lifts everything below the
// threshold while the peaks stay pinned at -0.55 dBFS, the same trade the
// browser's compressor makes.
//
// But it does NOT go on forever. Once the limiter is riding continuously it
// is normalising the envelope to the threshold, so the output settles at
// threshold / crest-factor regardless of the gain in front of it. Simulated
// against speech-shaped audio at the 57-count peak above (output RMS, dBFS):
//
//     55 dB -> -17.6    60 dB -> -14.5    66 dB -> -12.8
//     70 dB -> -12.1    75 dB -> -12.0    80 dB -> -12.0
//
// i.e. it is flat from about 70 dB up. Setting audio_gain higher than that
// buys no loudness at all, only compression. 66 keeps most of the available
// level with the limiter working less of the time; 70 is the ceiling. If a
// Kiwi client still sounds quieter than the web page at 70, the difference
// is no longer gain -- it is audio.js's EQ and compressor, neither of which
// has an equivalent here, and a bigger number will not stand in for them.
//
// THE S-METER DOES NOT FOLLOW THIS. The meter is computed in emit_frame()
// from packet["pwr"], the demodulator's own power for the block, which is
// set before process() ever sees the samples and is never touched by the
// gain. Changing audio_gain moves the audio and nothing else. (The one place
// the two meet is the fallback meter used when "pwr" is absent, and that
// path subtracts kiwi_audio_gain_db back out for precisely this reason.)
inline double kiwi_audio_gain_db = 0.0;
inline double kiwi_audio_gain_lin = 1.0;   // derived from the dB at startup

// ----------------------------------------------------------------------------
// URL path recognition
// ----------------------------------------------------------------------------

inline bool kiwi_path_ends_with(const std::string &path,
                                 const std::string &suffix) {
    return path.size() >= suffix.size() &&
           path.compare(path.size() - suffix.size(), suffix.size(), suffix) == 0;
}

inline bool is_kiwi_snd_path(const std::string &path) {
    return path.find("/kiwi/") != std::string::npos &&
           kiwi_path_ends_with(path, "/SND");
}

inline bool is_kiwi_wf_path(const std::string &path) {
    if (path.find("/kiwi/") == std::string::npos) return false;
    return kiwi_path_ends_with(path, "/W/F") ||
           kiwi_path_ends_with(path, "W%2FF") ||
           kiwi_path_ends_with(path, "W%2fF");
}

// ----------------------------------------------------------------------------
// Look-ahead peak limiter
//
// audio_gain is what makes a Kiwi client as loud as the web page, but the two
// are not free of each other: past about 50 dB on this receiver the peaks reach
// full scale, and the int16 clamp then flattens them. That is hard clipping --
// measured at 60 dB it destroyed 1-2% of samples, and a client's own AGC cannot
// put back what the clamp threw away.
//
// This limiter lets the gain go where the operator wants it without that.
// Every sample is delayed by kLookahead while the gain is computed from the
// sample that has NOT been emitted yet, so by the time a loud one comes out the
// gain has already come down to meet it -- peaks fold instead of flattening.
//
// Below the threshold the gain is exactly 1.0 and the multiply is exact for
// every value an int16 can hold, so a receiver that is not driving the audio
// hard gets bit-for-bit what it got before the limiter existed.
class KiwiPeakLimiter {
  public:
    KiwiPeakLimiter() : delay_(kLookahead, 0.0) {}

    double process(double x) {
        // Emit the oldest sample; the newest one, still kLookahead away from
        // being heard, is what sets the gain.
        const double out = delay_[pos_];
        delay_[pos_] = x;
        pos_ = (pos_ + 1) % kLookahead;

        // Peak-hold envelope, not the bare sample. Following one sample lets
        // the envelope fall again the instant a loud one has passed, so the
        // gain starts releasing while that sample is still inside the delay
        // line and has not been heard yet -- which is how peaks escaped. Holding
        // the peak and bleeding it away keeps the gain down until the loud
        // passage has actually been emitted.
        const double a = std::fabs(x);
        env_ = std::max(a, env_ * kEnvDecay);
        const double target = (env_ > kThreshold) ? kThreshold / env_ : 1.0;

        // Down fast enough to converge well inside the look-ahead window, back
        // up slowly so speech is not pumped. One-pole either way.
        gain_ += (target - gain_) * (target < gain_ ? kAttack : kRelease);
        return out * gain_;
    }

  private:
    // kLookahead is 4 ms at the 12 kHz the bridge announces.
    //
    // kAttack matters more than it looks: the gain moves toward its target by
    // that fraction per sample, so it must converge within the 48-sample window
    // or a loud sample is emitted before the gain has come down to meet it. At
    // 0.08 a 4x overshoot still arrived ~5% high and hit the clamp. At 0.20 the
    // residual after 48 samples is 0.8^48, about one part in 70000 -- overshoot
    // stays well inside the headroom the threshold leaves.
    static constexpr size_t kLookahead = 48;
    static constexpr double kThreshold = 30800.0;    // -0.55 dBFS
    static constexpr double kAttack    = 0.20;
    static constexpr double kRelease   = 0.000833;   // ~100 ms
    static constexpr double kEnvDecay  = 0.999167;   // peak hold, ~100 ms

    std::vector<double> delay_;
    size_t pos_  = 0;
    double gain_ = 1.0;
    double env_  = 0.0;
};

// ----------------------------------------------------------------------------
// KiwiSndEncoder — packs demodulated PCM into the Kiwi "SND" frame format
// ----------------------------------------------------------------------------

class KiwiSndEncoder : public AudioEncoder {
  public:
    KiwiSndEncoder(websocketpp::connection_hdl hdl, PacketSender &sender)
        : AudioEncoder(hdl, sender) {
        codec_name = "kiwi_pcm";
    }
    ~KiwiSndEncoder() override = default;

  protected:
    int process(int32_t *data, size_t size) override {
        // ------------------------------------------------------------------
        // FIXED FRAME SIZE, FOR THE S-METER
        //
        // Found by reading AetherSDR's own source
        // (src/core/KiwiSdrProtocol.cpp, classifySoundFrame()):
        //
        //   constexpr int kObservedExtendedSoundFrameBytes = 1034;
        //   constexpr int kServerSoundHeaderBytes = 10;
        //   ...
        //   observation.layout = frame.size() == kObservedExtendedSoundFrameBytes
        //       ? FrameLayout::SndObservedPcm16WithMeter
        //       : FrameLayout::SndPcm16;
        //
        // In other words: AetherSDR shows "observed"/"meter" ONLY if the SND
        // frame is EXACTLY 1034 bytes (a 10-byte header + 512 16-bit samples
        // = 1024 bytes of PCM). Any other size is still read and played
        // perfectly -- hence the flawless audio -- but is never tagged as
        // carrying an S-meter.
        //
        // So the samples we receive (a size that varies with the PhantomSDR
        // pipeline) are accumulated in an internal buffer, and an SND frame is
        // emitted only once exactly 512 samples are ready to go -- the format
        // of the frame itself does not change at all.
        // ------------------------------------------------------------------
        for (size_t i = 0; i < size; i++) {
            // Gain first, clamp second: clamping and then amplifying would
            // waste the headroom the clamp just threw away. At unity the
            // multiply is exact for every value an int16 can hold, so a
            // receiver left at 0 dB behaves precisely as it did before.
            double g = static_cast<double>(data[i]) * kiwi_audio_gain_lin;
            // The clamp stays as the last line of defence, but with the limiter
            // ahead of it there should be nothing left for it to cut.
            g = limiter_.process(g);
            int32_t v = std::clamp(static_cast<int32_t>(std::lround(g)),
                                   -32768, 32767);
            pending_samples.push_back(static_cast<int16_t>(v));
        }

        static constexpr size_t SAMPLES_PER_FRAME = 512;
        while (pending_samples.size() >= SAMPLES_PER_FRAME) {
            emit_frame(SAMPLES_PER_FRAME);
        }
        return 0;
    }

    int finish_encoder() override { return 0; }

  private:
    void emit_frame(size_t n) {
        // `pwr` is the demodulator's average power for this block, the exact
        // value the browser meter is driven from; set_data() refreshes it
        // immediately before process() on every call. Reuse it with the
        // frontend's formula so both meters read the same number. Falls back
        // to the old PCM-RMS estimate only if the field is missing.
        double pwr = 0.0;
        if (packet.contains("pwr") && packet["pwr"].is_number()) {
            pwr = packet["pwr"].get<double>();
        }

        double raw_db;
        if (pwr > 0.0) {
            raw_db = 20.0 * std::log10(std::sqrt(pwr) / 2.0);
        } else {
            // Fallback for the case where the demodulator sent no `pwr`.
            // pending_samples has already been through audio_gain and the
            // limiter, so the gain has to come back off or this reads as much
            // too high as the operator has turned the audio up. It is an
            // estimate either way -- limiting is not undone -- but a wrong
            // meter is worse than a rough one. The main path never comes here:
            // `pwr` is set by set_data() before every process() call, so the
            // meter proper is driven from the demodulator's own power and
            // nothing in the audio chain can move it.
            double sum_sq = 0.0;
            for (size_t i = 0; i < n; i++) {
                sum_sq += double(pending_samples[i]) * double(pending_samples[i]);
            }
            double rms = n ? std::sqrt(sum_sq / double(n)) : 0.0;
            raw_db = rms > 0.0 ? 20.0 * std::log10(rms / 32768.0) -
                                     kiwi_audio_gain_db
                               : -120.0;
        }

        // The web page's own display chain, reproduced. See the note above.
        const double approx_dbfs =
            kKiwiSmeterFloorDb +
            (raw_db + kiwi_smeter_offset_db - kKiwiSmeterFloorDb) *
                kKiwiSmeterSlope +
            kKiwiSmeterVisualDb;

        // S-meter smoothing (hardware-AGC-like ballistics) -- already in
        // place before the fixed frame size was discovered, and left active:
        // it has nothing to do with the "observed/meter" problem (which was
        // purely a matter of frame size), but it is a worthwhile improvement
        // in its own right and carries no risk.
        static constexpr double METER_SMOOTHING_ALPHA = 0.85;
        if (!meter_initialized) {
            smoothed_dbfs = approx_dbfs;
            meter_initialized = true;
        } else {
            smoothed_dbfs = METER_SMOOTHING_ALPHA * smoothed_dbfs +
                            (1.0 - METER_SMOOTHING_ALPHA) * approx_dbfs;
        }

        uint16_t smeter_raw = static_cast<uint16_t>(
            std::clamp((smoothed_dbfs + 127.0) * 10.0, 0.0, 65535.0));

        call_count++;
        // Every 200 frames (~8.5 s) while a client settles in, then one line
        // per 2000 (~85 s) for the rest of the session. The frequent lines are
        // what you want when checking a meter against the web UI; keeping that
        // cadence forever just fills the file.
        const uint64_t meter_log_every = call_count <= 2000 ? 200 : 2000;
        if (call_count % meter_log_every == 0) {
            kiwi_debug_log("KiwiSndEncoder::process appele #" +
                           std::to_string(call_count) +
                           " n=" + std::to_string(n) +
                           " pwr=" + [pwr] {
                               // std::to_string gives 6 decimals, and
                               // pwr runs around 1e-9: it would print
                               // a misleading 0.000000.
                               std::ostringstream o;
                               o << std::scientific << std::setprecision(3)
                                 << pwr;
                               return o.str();
                           }() +
                           " approx_dbfs_brut=" + std::to_string(approx_dbfs) +
                           " approx_dbfs_lisse=" + std::to_string(smoothed_dbfs) +
                           " smeter_raw=" + std::to_string(smeter_raw) +
                           " sample0=" + std::to_string(n ? pending_samples[0] : 0));
        }

        std::vector<uint8_t> frame;
        frame.reserve(10 + n * 2);
        frame.push_back('S');
        frame.push_back('N');
        frame.push_back('D');
        frame.push_back(0x00);

        uint32_t seq = seq_counter++;
        frame.push_back(static_cast<uint8_t>(seq & 0xFF));
        frame.push_back(static_cast<uint8_t>((seq >> 8) & 0xFF));
        frame.push_back(static_cast<uint8_t>((seq >> 16) & 0xFF));
        frame.push_back(static_cast<uint8_t>((seq >> 24) & 0xFF));

        frame.push_back(static_cast<uint8_t>((smeter_raw >> 8) & 0xFF));
        frame.push_back(static_cast<uint8_t>(smeter_raw & 0xFF));

        // PCM byte order. Kiwi sound payloads are BIG-endian on the wire
        // unless bit 0x80 of the flags byte is set, and the flags byte above
        // is 0x00. Verified in both clients this bridge targets:
        //   AetherSDR  src/core/KiwiSdrProtocol.cpp
        //              soundFrameLittleEndian(flags) = (flags & 0x80) != 0,
        //              else sample = (p[2i] << 8) | p[2i+1]
        //   kiwiclient kiwi/client.py, SND_FLAG_LITTLE_ENDIAN = 0x80
        //              dtype = '<h' if (camping and LE flag) else '>h'
        // Setting the flag instead would not be portable: kiwiclient honours
        // it only while camping, so it would still read these big-endian.
        for (size_t i = 0; i < n; i++) {
            uint16_t u = static_cast<uint16_t>(pending_samples[i]);
            frame.push_back(static_cast<uint8_t>((u >> 8) & 0xFF));
            frame.push_back(static_cast<uint8_t>(u & 0xFF));
        }

        if (frames_hex_logged < 20) {
            std::ostringstream hex;
            hex << std::hex << std::setfill('0');
            for (size_t i = 0; i < 10 && i < frame.size(); i++) {
                hex << std::setw(2) << static_cast<int>(frame[i]) << " ";
            }
            kiwi_debug_log("SND #" + std::to_string(frames_hex_logged) +
                           "  frame_bytes=" + std::to_string(frame.size()) +
                           "  seq=" + std::to_string(seq) +
                           "  smeter=" + std::to_string(smeter_raw) +
                           "  hex[0:10]=" + hex.str());
            frames_hex_logged++;
        }

        sender.send_binary_packet(hdl, frame.data(), frame.size());

        // Drop the n samples just sent and keep the remainder (the tail of
        // fewer than 512 samples) for the next call.
        pending_samples.erase(pending_samples.begin(),
                               pending_samples.begin() + static_cast<long>(n));
    }

    std::vector<int16_t> pending_samples;
    KiwiPeakLimiter      limiter_;
    uint32_t seq_counter{0};
    uint64_t call_count{0};
    double smoothed_dbfs{-120.0};
    bool meter_initialized{false};
    int frames_hex_logged{0};
};

// ----------------------------------------------------------------------------
// KiwiWfEncoder — packs waterfall magnitudes into the Kiwi "W/F" format
// ----------------------------------------------------------------------------

class KiwiWfEncoder : public WaterfallEncoder {
  public:
    KiwiWfEncoder(connection_hdl hdl, PacketSender &sender)
        : WaterfallEncoder(hdl, sender) {}
    ~KiwiWfEncoder() override = default;

    // A Kiwi W/F frame ALWAYS carries this many samples: it is the
    // wf_fft_size we advertise ourselves in "MSG wf_setup".
    static constexpr size_t kKiwiWfBins = 1024;

    int send(const void *buffer, size_t bytes, uint64_t frame_num, int start,
             int stop) override {
        std::vector<uint8_t> frame;
        frame.reserve(16 + kKiwiWfBins);

        frame.push_back('W');
        frame.push_back('/');
        frame.push_back('F');
        frame.push_back(0x20);

        auto push_u32le = [&](uint32_t v) {
            frame.push_back(static_cast<uint8_t>(v & 0xFF));
            frame.push_back(static_cast<uint8_t>((v >> 8) & 0xFF));
            frame.push_back(static_cast<uint8_t>((v >> 16) & 0xFF));
            frame.push_back(static_cast<uint8_t>((v >> 24) & 0xFF));
        };
        push_u32le(0);
        push_u32le(0);
        push_u32le(static_cast<uint32_t>(frame_num));

        // --------------------------------------------------------------
        // Conversion to the Kiwi dB scale.
        //
        // PhantomSDR stores each bin as an int8:
        //     v = 20*log10(P) + 6.0206*power_offset + 127
        // (power_and_quantize() in fft_impl.cpp -- note the 20*log10 of a
        // POWER, i.e. twice the usual dB), where
        //     power_offset = kiwi_wf_size_log2 - decimation_level.
        //
        // A Kiwi client reads an UNSIGNED BYTE and displays (b - 255) dBm.
        // We used to copy v straight across: the int8 -> uint8 cast wrapped
        // the scale (v=-20 became 236, i.e. -19 dBm, while a real carrier at
        // v=77 stayed 77, i.e. -178 dBm). The display was therefore both
        // saturated and inverted. The full calculation is redone here:
        //   1. remove the +127 and the factor of two    -> v/2 - 63.5
        //   2. remove the zoom-dependent power_offset   -> absolute scale
        //   3. apply the same calibration as the S-meter-> displayable dBm
        //   4. encode as b = dBm + 255, clamped [0, 255]-> monotonic
        // --------------------------------------------------------------
        double level = 0.0;
        const double full_span = static_cast<double>(stop - start);
        if (bytes > 0 && full_span > 0.0)
            level = std::round(std::log2(full_span / static_cast<double>(bytes)));
        const double power_offset_db =
            3.0103 * (static_cast<double>(kiwi_wf_size_log2) - level);

        const int8_t *src = static_cast<const int8_t *>(buffer);
        dbm_scratch_.resize(bytes);
        for (size_t i = 0; i < bytes; i++) {
            dbm_scratch_[i] = static_cast<double>(src[i]) * 0.5 - 63.5 -
                              power_offset_db - 6.0206 +
                              kiwi_smeter_offset_db + kiwi_wf_cal_db;
        }

        // --------------------------------------------------------------
        // Resampling to a fixed size (kKiwiWfBins).
        //
        // "bytes" is the number of NATIVE bins the requested zoom window
        // covers (websocket.cpp, retune_wf_cb: width = (hi_hz - lo_hz) /
        // bin_hz). At low zoom the window is wide and "bytes" is at or
        // above 1024. But the further in the client zooms the narrower the
        // window gets: past zoom 11 it falls below 1024 bins (512 at zoom
        // 12, 128 at zoom 14 with fft_size=4194304). We then sent a short
        // frame, which a strict Kiwi client -- one that ALWAYS expects 1024
        // samples per line -- stretches in raw blocks, hence the blocky
        // look at deep zoom in AetherSDR. The native web display showed
        // nothing wrong because its canvas smooths the same sparse data
        // instead of stretching it. Raising fft_size does not help: a finer
        // FFT needs FEWER native bins to cover the same narrow window.
        //
        // The fix in commit 2ef1b5b addressed only the other cause of short
        // frames (clamping at the edges of the spectrum). So exactly
        // kKiwiWfBins values are reconstructed here by linear
        // interpolation, on the dBm rather than on the raw bytes so the
        // result stays consistent whatever the scale, whether "bytes" is
        // smaller (deep zoom, the common case) or larger than kKiwiWfBins.
        // --------------------------------------------------------------
        for (size_t i = 0; i < kKiwiWfBins; i++) {
            double value;
            if (bytes == 0) {
                value = -255.0;  // no data: silence (degenerate case)
            } else if (bytes == 1) {
                value = dbm_scratch_[0];
            } else {
                // Fractional position in the source, over [0, bytes-1].
                const double pos = static_cast<double>(i) *
                                   static_cast<double>(bytes - 1) /
                                   static_cast<double>(kKiwiWfBins - 1);
                const size_t i0 = static_cast<size_t>(pos);
                const size_t i1 = std::min(i0 + 1, bytes - 1);
                const double frac = pos - static_cast<double>(i0);
                value = dbm_scratch_[i0] * (1.0 - frac) +
                        dbm_scratch_[i1] * frac;
            }
            const long b = std::lround(value) + 255;
            frame.push_back(static_cast<uint8_t>(std::clamp(b, 0L, 255L)));
        }

        sender.send_binary_packet(hdl, frame.data(), frame.size());
        return 0;
    }

  private:
    // Reused from one frame to the next: send() is on the waterfall's hot
    // path, and an allocation per frame has no business being there.
    std::vector<double> dbm_scratch_;
};

// ----------------------------------------------------------------------------
// Kiwi command parsing helpers and mode mapping
// ----------------------------------------------------------------------------

inline std::unordered_map<std::string, std::string>
kiwi_parse_set_params(const std::string &msg) {
    std::unordered_map<std::string, std::string> params;
    std::istringstream iss(msg);
    std::string token;
    while (iss >> token) {
        auto eq = token.find('=');
        if (eq != std::string::npos) {
            params[token.substr(0, eq)] = token.substr(eq + 1);
        }
    }
    return params;
}

inline demodulation_mode kiwi_mode_to_demod(const std::string &mode,
                                            bool &recognized) {
    recognized = true;
    if (mode == "usb" || mode == "usn" || mode == "cw") return USB;
    if (mode == "lsb" || mode == "lsn" || mode == "cwn") return LSB;
    if (mode == "am" || mode == "amn" || mode == "sam") return AM;
    if (mode == "nbfm" || mode == "nnfm" || mode == "fm") return FM;
    recognized = false;
    return USB;
}

// ----------------------------------------------------------------------------
// KiwiCommandParser
// ----------------------------------------------------------------------------

class KiwiCommandParser {
  public:
    using RetuneCallback =
        std::function<void(const std::string &, double, double, double)>;

    static void handle_snd_message(
        const std::string &msg, bool &auth_acked,
        const std::function<void(const std::string &)> &send_binary_text,
        const RetuneCallback &on_retune, double bandwidth_hz,
        double center_freq_hz, double adc_clk_hz, double audio_rate_hz) {
        if (msg.rfind("SET auth", 0) == 0) {
            if (auth_acked) return;
            auth_acked = true;
            // Both fields come from input.audio_sps, the rate the rest of the
            // pipeline is built on: AudioClient stores it as audio_rate and
            // hands it to every encoder (FLAC set_sample_rate, Opus), so it is
            // the rate the PCM in an SND frame actually carries. They used to
            // be hardcoded ("sample_rate=11998.992747", a figure copied from a
            // real KiwiSDR, and "audio_rate=12000"), which was silently
            // correct only for a 12 kHz receiver -- with input.audio_sps at
            // 192000 a Kiwi client was told 12 kHz and played the stream 16x
            // too slow. A Kiwi announces sample_rate with decimals because it
            // measures its own clock drift; we resample to an exact rate, so
            // the two fields are simply the same number.
            std::ostringstream srate;
            srate << std::fixed << std::setprecision(6) << audio_rate_hz;
            send_binary_text("MSG sample_rate=" + srate.str());
            send_binary_text(
                "MSG audio_rate=" +
                std::to_string(static_cast<long long>(std::llround(audio_rate_hz))));
            // A real KiwiSDR advertises all three fields on the SAME line:
            //   MSG center_freq=15000000 bandwidth=30000000 adc_clk_nom=66666600
            // "bandwidth" alone tells the client how WIDE we are but not
            // WHERE that width sits; a client that builds its zoom-out range
            // from "center_freq" then has nothing to anchor on and confines
            // itself to a narrow window around the current frequency (the
            // symptom seen with AetherSDR, which never once asked for a zoom
            // below 5, i.e. 937 kHz out of 30 MHz).
            auto as_int = [](double v) {
                return std::to_string(static_cast<long long>(std::llround(v)));
            };
            send_binary_text("MSG center_freq=" + as_int(center_freq_hz) +
                             " bandwidth=" + as_int(bandwidth_hz) +
                             " adc_clk_nom=" + as_int(adc_clk_hz));
            return;
        }

        if (msg.rfind("SET mod=", 0) == 0) {
            kiwi_debug_log("SET mod recu (brut): " + msg);
            auto params = kiwi_parse_set_params(msg);
            auto it_mod = params.find("mod");
            auto it_freq = params.find("freq");
            if (it_mod == params.end() || it_freq == params.end()) {
                kiwi_debug_log("REJETE: mod ou freq absent du message");
                return;
            }
            try {
                double freq_khz = std::stod(it_freq->second);
                double low_cut = params.count("low_cut")
                                     ? std::stod(params.at("low_cut"))
                                     : -3000.0;
                double high_cut = params.count("high_cut")
                                      ? std::stod(params.at("high_cut"))
                                      : 3000.0;
                kiwi_debug_log("SET mod parse: mod=" + it_mod->second +
                               " freq=" + std::to_string(freq_khz) + "kHz" +
                               " low_cut=" + std::to_string(low_cut) +
                               " high_cut=" + std::to_string(high_cut));
                on_retune(it_mod->second, low_cut, high_cut, freq_khz);
            } catch (const std::exception &e) {
                kiwi_debug_log(std::string("REJETE: exception de parsing: ") +
                               e.what());
            }
            return;
        }

        // ------------------------------------------------------------------
        // CATCH EVERY UNRECOGNISED COMMAND (SND)
        //
        // Only "SET auth" and "SET mod=" were handled until now. A real
        // KiwiSDR requires "SET agc=..." before it will serve audio, for
        // instance (confirmed by the KiwiSDR developer on the official
        // forum); a client such as AetherSDR may send that command, or
        // others, without us ever knowing, since they were silently
        // dropped. They are logged here so the full sequence is visible,
        // without changing any behaviour -- what we do not handle is still
        // simply ignored.
        // ------------------------------------------------------------------
        kiwi_log_unhandled("[SND]", msg);
    }

    // wf_speed -> frames per second, following the KiwiSDR menu
    //   0 = off, 1 = 1 fps, 2 = slow, 3 = medium, 4 = fast (the maximum).
    // A real Kiwi's maximum is 23; ours is whatever the FFT loop produces
    // (2*sps/fft_size), capped at 23 so a client that paces itself from the
    // advertised figure is never fed faster than it expects.
    static double kiwi_wf_speed_to_fps(int speed, double max_fps) {
        switch (speed) {
        case 0:  return 0.0;
        case 1:  return 1.0;
        case 2:  return max_fps / 4.0;
        case 3:  return max_fps / 2.0;
        default: return max_fps;
        }
    }

    static void handle_wf_message(
        const std::string &msg, bool &auth_acked,
        const std::function<void(const std::string &)> &send_binary_text,
        const std::function<void(int, double, bool)> &on_retune_wf,
        double max_fps, int max_zoom,
        const std::function<void(double)> &on_wf_speed) {
        if (msg.rfind("SET auth", 0) == 0) {
            if (auth_acked) return;
            auth_acked = true;
            // Advertise the rate we can actually sustain. Claiming 23 while
            // delivering 14 is what made the waterfall and the spectrum look
            // sluggish: a client that scrolls on the advertised cadence runs
            // out of lines and stalls between them.
            const std::string fps =
                std::to_string(static_cast<int>(std::floor(max_fps)));
            // ----------------------------------------------------------
            // ZOOM CEILING -- why this is computed and not the flat 14 a
            // real KiwiSDR sends.
            //
            // A Kiwi runs a downconverter and a fresh FFT per zoom level,
            // so all 1024 bins of a W/F frame are real at every zoom, right
            // down to zoom 14. PhantomSDR has ONE FFT across the whole
            // band: at zoom z a client sees fft_result_size >> z of our
            // native bins, so the count falls as it zooms in. Once it drops
            // below 1024 the encoder is interpolating (see the resampling
            // note in KiwiWfEncoder::send) and the client is drawing a
            // smooth curve through data that is not there -- the "no real
            // waveform at high zoom" seen in AetherSDR.
            //
            // On a 60 MHz / 4194304-bin receiver that boundary lands exactly
            // at zoom 11: 2097152 >> 11 == 1024. We used to advertise
            // zoom_max=14 anyway (with zoom_cap=11 alongside it, which
            // clients ignore), inviting three zoom steps of invented
            // detail. Both fields now carry the honest figure, so a client
            // stops where the last real bin is. Raising input.fft_size is
            // what buys a deeper zoom -- one step per doubling -- and this
            // figure follows it automatically.
            //
            // Note this does NOT change the "SET zoom= start=" counter
            // scale: that counter is defined against the protocol's fixed
            // 14 zoom levels and clients hardcode it, so retune_wf_cb keeps
            // MAX_ZOOM = 14 for the conversion.
            // ----------------------------------------------------------
            const std::string zoom = std::to_string(max_zoom);
            send_binary_text(
                "MSG wf_fft_size=1024 wf_fps=" + fps + " wf_fps_max=" + fps +
                " zoom_max=" + zoom + " zoom_cap=" + zoom +
                " rx_chans=8 wf_chans=3 wf_chans_real=3 "
                "wf_share=1 wf_cal=0 wf_setup");
            return;
        }

        if (msg.rfind("SET wf_speed=", 0) == 0) {
            auto params = kiwi_parse_set_params(msg);
            auto it_speed = params.find("wf_speed");
            if (it_speed == params.end()) return;
            try {
                int speed = std::stoi(it_speed->second);
                double fps = kiwi_wf_speed_to_fps(speed, max_fps);
                kiwi_debug_log("[WF] SET wf_speed=" + std::to_string(speed) +
                               " -> " + std::to_string(fps) + " fps");
                on_wf_speed(fps);
            } catch (const std::exception &e) {
                kiwi_debug_log(std::string("[WF] REJETE: wf_speed illisible: ") +
                               e.what());
            }
            return;
        }

        if (msg.rfind("SET zoom=", 0) == 0) {
            kiwi_debug_log("[WF] SET zoom recu (brut): " + msg);
            auto params = kiwi_parse_set_params(msg);
            auto it_zoom = params.find("zoom");
            if (it_zoom == params.end()) {
                kiwi_debug_log("[WF] REJETE: zoom absent du message");
                return;
            }
            try {
                int zoom = std::stoi(it_zoom->second);
                // Two possible forms, depending on the Kiwi version the
                // client assumes (we advertise no version ourselves, so
                // both are handled and the one that arrives is logged):
                //   - "cf=<kHz>"        : centre frequency, the recent form
                //   - "start=<counter>" : the older form, which needs a
                //     conversion through MAX_FREQ/MAX_ZOOM/WF_BINS
                if (params.count("cf")) {
                    double cf_khz = std::stod(params.at("cf"));
                    kiwi_debug_log("[WF] format cf: zoom=" +
                                   std::to_string(zoom) + " cf=" +
                                   std::to_string(cf_khz) + "kHz");
                    on_retune_wf(zoom, cf_khz, true);
                } else if (params.count("start")) {
                    double start_counter = std::stod(params.at("start"));
                    kiwi_debug_log("[WF] format start: zoom=" +
                                   std::to_string(zoom) + " start=" +
                                   std::to_string(start_counter));
                    on_retune_wf(zoom, start_counter, false);
                } else {
                    kiwi_debug_log("[WF] REJETE: ni cf ni start present");
                }
            } catch (const std::exception &e) {
                kiwi_debug_log(std::string("[WF] REJETE: exception de parsing: ") +
                               e.what());
            }
            return;
        }

        // Same catch-all as on the SND side: see the comment above
        // "[SND] commande non geree" for why.
        kiwi_log_unhandled("[WF]", msg);
    }
};

#endif
