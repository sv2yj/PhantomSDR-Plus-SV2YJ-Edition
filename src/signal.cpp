#include <complex>

#include "fft.h"
#include "signal.h"
#include "utils/dsp.h"
#include "kiwi_bridge.h"

#include <atomic>
#include <chrono>
#include <thread>
#include <mutex>
#include <iostream>
#include <unordered_map>
#include <cmath>
#include <curl/curl.h>
#include <nlohmann/json.hpp>

// ---- Synchronous AM (SAM) product detector with simple PI-PLL ----
namespace {
struct SAM_PLL {
    double fs = 48000.0;
    double theta = 0.0;     // NCO phase
    double dtheta = 0.0;    // nominal freq offset (rad/sample), keep at 0 for centered carrier
    double ki = 0.0, kp = 0.0;
    double acc = 0.0;       // integrator

    // Separate DC blocker state for each channel
    float xm1_L = 0.0f, ym1_L = 0.0f;       // Left channel
    float xm1_R = 0.0f, ym1_R = 0.0f;       // Right channel
    float xm1_mono = 0.0f, ym1_mono = 0.0f; // Mono (legacy SAM)

    double dc_a_mono   = 0.999; // Gentler for natural bass
    double dc_a_stereo = 0.999; // Even gentler for stereo imaging
    double dc_a        = 0.997; // Current active coefficient

    // Signal magnitude tracking for normalization
    float mag_avg   = 1.0f;
    float mag_alpha = 0.01f; // Responsive tracking

    // Lock detector.  When the PLL is locked, the normalized in-phase carrier
    // component (Ir) sits near +1 and the quadrature (Qr) near 0; unlocked, Ir
    // wanders and its average collapses toward 0.  lock_ema is a slow average of
    // Ir (~40 ms); `locked` is the hysteresis'd boolean the UI reads.
    float lock_ema = 0.0f;
    bool  locked   = false;

    // Recompute the PI loop gains for a given loop bandwidth WITHOUT resetting
    // the NCO/integrator state.  Lets us switch loop bandwidth per mode (narrow
    // for mono SAM, wider for C-QUAM) without dropping lock.
    inline void set_loop_bw(double loop_bw_hz) {
        // Convert loop bandwidth to discrete PI gains (damping factor 0.707)
        const double damping = 0.707;
        const double wn = 2.0 * M_PI * loop_bw_hz / fs;
        kp = 2.0 * damping * wn;
        ki = wn * wn;
    }

    void setup(double sample_rate, double loop_bw_hz = 50.0) {
        fs = sample_rate > 1.0 ? sample_rate : 48000.0;
        set_loop_bw(loop_bw_hz);
        // Reset state
        theta = 0.0;
        acc = 0.0;
        xm1_L = xm1_R = xm1_mono = 0.0f;
        ym1_L = ym1_R = ym1_mono = 0.0f;
        mag_avg = 1.0f;
        lock_ema = 0.0f;
        locked = false;
    }

    // FIX: wrap() was defined here but never called — step() and step_cquam()
    // both do inline phase wrapping with if-statements.  The dead function
    // produced a -Wunused-function warning and has been removed.

    // Set stereo mode (switches DC blocker coefficient)
    inline void set_stereo_mode(bool stereo) {
        dc_a = stereo ? dc_a_stereo : dc_a_mono;
    }

    // Separate DC blocking functions for each channel
    inline float dcblock_L(float x) {
        float y = x - xm1_L + (float)dc_a * ym1_L;
        xm1_L = x;
        ym1_L = y;
        return y;
    }

    inline float dcblock_R(float x) {
        float y = x - xm1_R + (float)dc_a * ym1_R;
        xm1_R = x;
        ym1_R = y;
        return y;
    }

    inline float dcblock_mono(float x) {
        float y = x - xm1_mono + (float)dc_a * ym1_mono;
        xm1_mono = x;
        ym1_mono = y;
        return y;
    }

    // Mono SAM product detector.
    //
    // The PLL locks on the CARRIER phasor (Ic,Qc) — the baseband low-pass
    // filtered to <500 Hz, i.e. essentially the pure carrier — which is far more
    // stable than locking on carrier+sidebands: on deep modulation the full
    // signal's in-phase term can swing negative and make atan2 jump by π,
    // slipping the loop.  The carrier-locked phase then demodulates the FULL
    // signal (Isig,Qsig) to produce the audio.
    inline float step(float Ic, float Qc, float Isig, float Qsig) {
        // Track carrier magnitude for phase-detector normalization (keeps loop
        // gain independent of signal strength).
        float mag = sqrtf(Ic * Ic + Qc * Qc);
        if (mag > 0.0001f) {
            mag_avg = mag_avg * (1.0f - mag_alpha) + mag * mag_alpha;
        }
        float norm_factor = (mag_avg > 0.0001f) ? (1.0f / mag_avg) : 1.0f;
        float In = Ic * norm_factor;
        float Qn = Qc * norm_factor;

        // NCO rotation by -theta to bring the carrier to baseband.
        float c = cosf((float)theta);
        float s = sinf((float)theta);
        float Ir =  In * c + Qn * s;
        float Qr = -In * s + Qn * c;

        // Phase detector — atan2 for robust acquisition over wide range.
        float e = atan2f(Qr, Ir);

        // PI loop filter with anti-windup clamp on the integrator (prevents
        // wind-up and sudden phase jumps / stuttering on off-frequency signals).
        acc += ki * e;
        const double max_acc = M_PI / 4.0;
        if (acc >  max_acc) acc =  max_acc;
        if (acc < -max_acc) acc = -max_acc;
        double u = kp * e + acc;

        // Advance NCO and wrap phase to [-π, π].
        theta += dtheta + u;
        if (theta >  M_PI) theta -= 2.0 * M_PI;
        if (theta <= -M_PI) theta += 2.0 * M_PI;

        // Lock detector: slow-average the normalized in-phase carrier (≈1 when
        // locked, →0 when not), then apply hysteresis for a steady indicator.
        // Use cos(phase error) = Ir / |phasor|, which is amplitude-INDEPENDENT
        // (robust to AM modulation depth): ~1 when phase-locked, ~0 when the loop
        // is slipping.  Averaging raw Ir instead sagged below threshold on deeply
        // modulated carriers, so lock was never indicated even when locked.
        float phasor = sqrtf(Ir * Ir + Qr * Qr) + 1e-6f;
        float cos_e  = Ir / phasor;
        lock_ema += 0.002f * (cos_e - lock_ema);
        if (lock_ema >= 0.85f) locked = true;
        else if (lock_ema <= 0.60f) locked = false;

        // Demodulate the FULL signal (carrier+sidebands) with the carrier-locked
        // phase.  Reusing the same c,s as the phase detector makes the output the
        // in-phase component of the raw baseband — identical amplitude to the
        // previous full-signal detector, so AM loudness / AGC calibration is
        // unchanged; only the lock is more robust.
        float sigIr = Isig * c + Qsig * s;
        return dcblock_mono(sigIr);
    }

    // C-QUAM stereo decoder with separate DC blockers
    void step_cquam(float I, float Q, float &outL, float &outR) {
        // Track signal magnitude for normalization
        float mag = sqrtf(I * I + Q * Q);
        if (mag > 0.0001f) {
            mag_avg = mag_avg * (1.0f - mag_alpha) + mag * mag_alpha;
        }

        // Normalize inputs
        float invmag = (mag_avg > 0.0001f) ? 1.0f / mag_avg : 1.0f;
        float In = I * invmag;
        float Qn = Q * invmag;

        // Rotate into PLL tracking frame
        float c = cosf((float)theta);
        float s = sinf((float)theta);
        float Ir =  In * c + Qn * s;
        float Qr = -In * s + Qn * c;

        // Phase detector: atan2 for robust lock
        float e = atan2f(Qr, Ir);

        // PI loop filter with anti-windup
        acc += ki * e;
        // Clamp integrator to prevent wind-up and sudden phase jumps (stuttering)
        const double max_acc = M_PI / 4.0;
        if (acc >  max_acc) acc =  max_acc;
        if (acc < -max_acc) acc = -max_acc;
        double u = kp * e + acc;

        // Advance NCO and wrap phase
        theta += dtheta + u;
        if (theta >  M_PI) theta -= 2.0 * M_PI;
        if (theta <= -M_PI) theta += 2.0 * M_PI;

        // In C-QUAM, Ir ~ (L+R), Qr ~ (L-R) after proper normalization.
        float sum  = Ir * mag_avg;
        float diff = -Qr * mag_avg; // INVERTED: Fixes rapid gain changes / pumping effect.
                                    // The quadrature demodulator output (L-R) had opposite
                                    // polarity, causing L and R to fight each other → volume
                                    // fluctuations. Inverting restores correct phase relationship.

        float L = 0.5f * (sum + diff);
        float R = 0.5f * (sum - diff);

        // Use separate DC blockers for each channel
        outL = dcblock_L(L);
        outR = dcblock_R(R);
    }

    void reset() {
        theta = 0.0;
        acc = 0.0;
        xm1_L = xm1_R = xm1_mono = 0.0f;
        ym1_L = ym1_R = ym1_mono = 0.0f;
        mag_avg = 1.0f;
        lock_ema = 0.0f;
        locked = false;
    }
};

// Keep a per-AudioClient SAM_PLL instance without editing headers
static std::unordered_map<const void*, std::shared_ptr<SAM_PLL>> g_sam_by_client;
static std::mutex g_sam_mutex; // Thread-safe access to prevent crashes on rapid mode switching

// Helper to get/create SAM for a client pointer.
// Returns a shared_ptr so the PLL object survives concurrent cleanup_sam()
// calls — the caller holds a live reference even if the map entry is erased.
static std::shared_ptr<SAM_PLL> get_sam(const void* key, double fs) {
    std::lock_guard<std::mutex> lock(g_sam_mutex);
    auto it = g_sam_by_client.find(key);
    if (it == g_sam_by_client.end()) {
        auto sam = std::make_shared<SAM_PLL>();
        sam->setup(fs, 50.0);
        auto it2 = g_sam_by_client.emplace(key, sam);
        return it2.first->second;
    }
    // Refresh fs if changed (resets PLL state — acceptable, sample rate changes are rare)
    if (fabs(it->second->fs - fs) > 1.0) {
        it->second->setup(fs, 50.0);
    }
    return it->second;
}

// Cleanup SAM instance for a client
static void cleanup_sam(const void* key) {
    std::lock_guard<std::mutex> lock(g_sam_mutex);
    g_sam_by_client.erase(key);
}

} // namespace

// --- Aggressive time-domain impulse blanker on complex baseband ---
static void apply_impulse_blanker_complex(std::complex<float>* buf,
                                          int len,
                                          float threshold_mul = 3.0f,
                                          int blank_len = 32)
{
    if (!buf || len <= 0) {
        return;
    }

    // Compute RMS magnitude of the complex buffer
    double sum_sq = 0.0;
    for (int i = 0; i < len; ++i) {
        const float re = buf[i].real();
        const float im = buf[i].imag();
        sum_sq += static_cast<double>(re) * re +
                  static_cast<double>(im) * im;
    }

    // FIX: Removed redundant `|| len <= 0` — already checked and returned above.
    if (sum_sq <= 0.0) {
        return;
    }

    const float rms = std::sqrt(static_cast<float>(sum_sq / len));
    if (rms <= 0.0f) {
        return;
    }

    const float thr = threshold_mul * rms;

    int hold = 0;
    std::complex<float> last(0.0f, 0.0f);

    for (int i = 0; i < len; ++i) {
        const std::complex<float> s = buf[i];
        const float mag_sq = static_cast<float>(s.real() * s.real() +
                                                s.imag() * s.imag());

        if (hold > 0) {
            // Still blanking
            buf[i] = last;
            --hold;
        } else if (mag_sq > thr * thr) {
            // Start blanking
            buf[i] = last;
            hold = blank_len - 1;
        } else {
            // Normal sample
            last = s;
        }
    }
}

// ============================================================================
// GEO-LOCATION LOOKUP — async, one call per user connection
// Uses ip-api.com (free, no key, 45 req/min).  Private IPs are short-circuited
// locally and never sent to any external service.
// ============================================================================
namespace {

static size_t geo_write_cb(char *ptr, size_t size, size_t nmemb, void *ud) {
    static_cast<std::string *>(ud)->append(ptr, size * nmemb);
    return size * nmemb;
}

// Convert ISO 3166-1 alpha-2 code → flag emoji (UTF-8).
// Each regional-indicator letter is U+1F1E6..U+1F1FF.
static std::string country_flag(const std::string &cc) {
    if (cc.size() != 2) return "";
    auto encode4 = [](uint32_t cp) -> std::string {
        std::string s;
        s += char(0xF0 | (cp >> 18));
        s += char(0x80 | ((cp >> 12) & 0x3F));
        s += char(0x80 | ((cp >> 6)  & 0x3F));
        s += char(0x80 | ( cp        & 0x3F));
        return s;
    };
    return encode4(0x1F1E6u + uint32_t(std::toupper((unsigned char)cc[0]) - 'A'))
         + encode4(0x1F1E6u + uint32_t(std::toupper((unsigned char)cc[1]) - 'A'));
}

// strip_port() now lives in utils.cpp — the per-IP connection limiter in
// websocket.cpp needs the same address spelling this file records, so the two
// cannot be allowed to drift apart.

// Returns true if the IP is RFC-1918 / loopback / link-local — skip API call.
static bool is_private_ip(const std::string &ip_raw) {
    // ip_address is only port-stripped, so a dual-stack listener hands us the
    // IPv4-mapped spelling ("::ffff:127.0.0.1"). Unmap it first, or every
    // prefix test below misses and a LAN/loopback client gets sent to the geo
    // API — which answers nothing, leaving geo empty and the label as a bare IP.
    const std::string ip = normalize_client_ip(ip_raw);
    if (ip.empty() || ip == "127.0.0.1" || ip == "::1") return true;
    // IPv4 private ranges: 10.x, 172.16-31.x, 192.168.x
    if (ip.rfind("10.",      0) == 0) return true;
    if (ip.rfind("192.168.", 0) == 0) return true;
    if (ip.rfind("169.254.", 0) == 0) return true;
    if (ip.rfind("172.",     0) == 0) {
        const auto dot2 = ip.find('.', 4);
        if (dot2 != std::string::npos) {
            try {
                int second = std::stoi(ip.substr(4, dot2 - 4));
                if (second >= 16 && second <= 31) return true;
            } catch (...) {
                // Malformed octet — not a valid private range, continue
            }
        }
    }
    return false;
}

// Blocking geo lookup — always called from a detached background thread.
static std::string lookup_geo(const std::string &ip) {
    if (is_private_ip(ip)) return "Local";

    CURL *curl = curl_easy_init();
    if (!curl) return "";

    std::string response;
    const std::string url =
        "http://ip-api.com/json/" + ip +
        "?fields=status,city,country,countryCode";

    curl_easy_setopt(curl, CURLOPT_URL,            url.c_str());
    curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION,  geo_write_cb);
    curl_easy_setopt(curl, CURLOPT_WRITEDATA,      &response);
    curl_easy_setopt(curl, CURLOPT_TIMEOUT,        5L);
    curl_easy_setopt(curl, CURLOPT_CONNECTTIMEOUT, 3L);
    curl_easy_setopt(curl, CURLOPT_NOSIGNAL,       1L);

    const CURLcode rc = curl_easy_perform(curl);
    curl_easy_cleanup(curl);

    if (rc != CURLE_OK || response.empty()) return "";

    try {
        auto j = nlohmann::json::parse(response);
        if (j.value("status", "") != "success") return "";

        const std::string city = j.value("city",        "");
        const std::string cc   = j.value("countryCode", "");
        const std::string flag = country_flag(cc);

        if (city.empty())
            return flag + " " + j.value("country", cc);
        return flag + " " + city + ", " + cc;
    } catch (...) {
        return "";
    }
}

} // namespace

// monitor_audio_thread_running is declared extern in signal.h;
// total_audio_bits_sent and audio_kbits_per_second are defined below.
std::atomic<bool> monitor_audio_thread_running{false};
std::atomic<size_t> total_audio_bits_sent{0};
std::atomic<double> audio_kbits_per_second{0.0};

void monitor_audio_data_rate() {
    monitor_audio_thread_running = true;
    while (monitor_audio_thread_running) {
        std::this_thread::sleep_for(std::chrono::seconds(1));
        size_t bits = total_audio_bits_sent.exchange(0);
        audio_kbits_per_second.store(bits / 1000.0, std::memory_order_relaxed);
    }
}

// Use call_once to eliminate the TOCTOU race where multiple audio threads
// could simultaneously observe !monitor_audio_thread_running and each spawn
// their own monitor thread, corrupting the kbits statistics.
static std::once_flag audio_monitor_once_flag;

void ensure_audio_monitor_thread_runs() {
    std::call_once(audio_monitor_once_flag, [] {
        std::thread(monitor_audio_data_rate).detach();
    });
}



AudioClient::AudioClient(connection_hdl hdl,
                         PacketSender &sender,
                         audio_compressor audio_compression,
                         bool is_real,
                         int audio_fft_size,
                         int audio_max_sps,
                         int fft_result_size)
    : Client(hdl, sender, AUDIO),
      is_real(is_real),
      audio_fft_size(audio_fft_size),
      fft_result_size(fft_result_size),
      audio_rate(audio_max_sps),
      signal_slices(sender.get_signal_slices()),
      signal_slice_mtx(sender.get_signal_slice_mtx()),
      agc(0.1f, 100.0f, 30.0f, 100.0f, audio_max_sps) {

    base_audio_compression = audio_compression;
    this->encoder = make_audio_encoder(audio_compression, 1);


    unique_id = generate_unique_id();
    frame_num = 0;

    // Audio demodulation scratch data structures
    audio_fft_input =
        fftwf_malloc_unique_ptr<std::complex<float>>(audio_fft_size);
    audio_complex_baseband =
        fftwf_malloc_unique_ptr<std::complex<float>>(audio_fft_size);
    audio_complex_baseband_prev =
        fftwf_malloc_unique_ptr<std::complex<float>>(audio_fft_size);
    audio_complex_baseband_carrier =
        fftwf_malloc_unique_ptr<std::complex<float>>(audio_fft_size);
    audio_complex_baseband_carrier_prev =
        fftwf_malloc_unique_ptr<std::complex<float>>(audio_fft_size);

    audio_real.resize(audio_fft_size);
    audio_real_prev.resize(audio_fft_size);
    // Allocate 2x for stereo interleaved use (C-QUAM path writes
    // [L0,R0,L1,R1,...] so needs audio_fft_size elements, not half).
    audio_real_int16.resize(audio_fft_size * 2);

    // Pre-allocate C-QUAM channel buffers (audio_fft_size / 2 samples each)
    cquam_L.resize(audio_fft_size / 2);
    cquam_R.resize(audio_fft_size / 2);

    dc = DCBlocker<float>(audio_max_sps / 750 * 2);
    ma = MovingAverage<float>(10);
    mm = MovingMode<int>(10);

    // Initialize noise gate with default preset (disabled by default)
    noise_gate.set_preset("balanced");
    noise_gate.set_enabled(false); // Disabled by default, user must enable

    // AGC enabled by default for backward compatibility
    agc_enabled = true;

#ifdef HAS_LIQUID
    mixer = nco_crcf_create(LIQUID_NCO);
    nco_crcf_pll_set_bandwidth(mixer, 0.001f);
#endif

    {
        std::scoped_lock lg(fftwf_planner_mutex);
        fftwf_plan_with_nthreads(1);
        p_complex = fftwf_plan_dft_1d(
            audio_fft_size, (fftwf_complex *)audio_fft_input.get(),
            (fftwf_complex *)audio_complex_baseband.get(), FFTW_BACKWARD,
            FFTW_MEASURE);
        p_complex_carrier = fftwf_plan_dft_1d(
            audio_fft_size, (fftwf_complex *)audio_fft_input.get(),
            (fftwf_complex *)audio_complex_baseband_carrier.get(),
            FFTW_BACKWARD, FFTW_MEASURE);
        p_real = fftwf_plan_dft_c2r_1d(audio_fft_size,
                                       (fftwf_complex *)audio_fft_input.get(),
                                       audio_real.data(), FFTW_MEASURE);
    }

    // C-QUAM AM stereo initialization
    am_stereo = false;

    // --- User-tracking fields ---
    // ip_from_hdl() returns the raw remote endpoint string, e.g. "82.x.x.x:54321".
    // Strip the port so ip_address holds a plain IP suitable for display,
    // private-range checks, and geo API lookups.
    ip_address   = strip_port(sender.ip_from_hdl(hdl));
    connected_at = std::chrono::steady_clock::now();

    // Geo lookup — run in background so constructor returns immediately.
    //
    // FIX (weak_from_this in constructor): enable_shared_from_this only
    // registers the internal weak reference AFTER the constructor returns,
    // so weak_from_this() called here always yields an empty weak_ptr and
    // weak.lock() always returns null — geo_location was never being written.
    //
    // Safe fix: capture shared_ptr copies of the two members that the thread
    // needs to write.  These shared_ptrs are independent of the AudioClient
    // lifetime so the write is safe even if the client disconnects before
    // the HTTP lookup completes (typically 1–3 s).
    {
        std::string ip_copy = ip_address;
        auto geo_loc_ptr   = geo_location_ptr;
        auto geo_mtx_ptr   = geo_mutex_ptr;
        std::thread([geo_loc_ptr, geo_mtx_ptr, ip_copy]() {
            std::string result = lookup_geo(ip_copy);
            std::lock_guard<std::mutex> lk(*geo_mtx_ptr);
            *geo_loc_ptr = result;
        }).detach();
    }
}

const char *AudioClient::get_mode_str() const {
    // FIX: load atomics once so switch/comparisons use a consistent snapshot.
    const auto demod   = demodulation.load(std::memory_order_relaxed);
    const auto stereo  = am_stereo.load(std::memory_order_relaxed);
    if (demod == AM && stereo) return "am-s";
    switch (demod) {
        case USB: return "usb";
        case LSB: return "lsb";
        case AM:  return "am";
        case FM:  return "fm";
        default:  return "iq";
    }
}

void AudioClient::set_audio_range(int l, double m, int r) {
    // FIX (data race / SIGSEGV): set_audio_range and on_close both mutate the
    // stored iterator `it` under signal_slice_mtx.  The race:
    //   1. set_audio_range calls extract(it) — node is removed from the tree,
    //      `it` is now a dangling handle to an extracted node.
    //   2. on_close fires on the websocketpp IO thread before insert() runs
    //      and calls erase(it) on the already-extracted node.
    //   3. _Rb_tree_rebalance_for_erase walks a detached node → SIGSEGV.
    //
    // Fix: double-check `closed` before and after acquiring the lock so that
    // exactly one of set_audio_range / on_close touches the tree.
    if (closed.load()) return;

    audio_mid = m;
    this->l = l;
    this->r = r;

    // Change the data structures to reflect the changes
    {
        std::scoped_lock lk(signal_slice_mtx);
        // Re-check under the lock: on_close() may have erased `it` between
        // the load above and acquiring signal_slice_mtx here.
        if (closed.load()) return;

        auto node = signal_slices.extract(it);
        if (node.empty()) return;   // iterator was already invalid — bail out
        node.key() = {l, r};
        it = signal_slices.insert(std::move(node));
    }
    sender.broadcast_signal_changes(unique_id, l, m, r, ip_address,
                                    is_internal_tap.load(std::memory_order_acquire));
}

void AudioClient::set_audio_demodulation(demodulation_mode demodulation) {
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
}

std::unique_ptr<AudioEncoder>
AudioClient::make_audio_encoder(audio_compressor codec, int channels) {
    if (codec == AUDIO_PCM) {
        // Raw PCM needs no configuration — no sample rate, blocksize or channel
        // setup. The autorun loopback client is mono; PcmEncoder ships int16 LE.
        return std::make_unique<PcmEncoder>(hdl, sender);
    }
    if (codec == AUDIO_KIWI_PCM) {
        return std::make_unique<KiwiSndEncoder>(hdl, sender);
    }
#ifdef HAS_LIBOPUS
    if (codec == AUDIO_OPUS) {
        return std::make_unique<OpusAudioEncoder>(hdl, sender, audio_rate,
                                                  channels);
    }
#endif
    // FLAC (also the fallback when Opus is requested but not compiled in).
    auto flac_encoder = std::make_unique<FlacEncoder>(hdl, sender);
    flac_encoder->set_channels(channels);
    flac_encoder->set_verify(false);
    flac_encoder->set_sample_rate(audio_rate);
    flac_encoder->set_bits_per_sample(16);
    flac_encoder->configure_flac(FlacMode::Balanced); // good params + streamable_subset(true)
    flac_encoder->set_streamable_subset(false);        // CRITICAL: override AFTER configure_flac!
                                                       // configure_flac forces streamable_subset=true which only allows
                                                       // specific power-of-2 blocksizes (256,512,1024...). Our frame size
                                                       // (audio_fft_size/2 ≈ 394) is not valid → libFLAC silently ignores
                                                       // set_blocksize() and falls back to 1024 → buffering → tremor!
    flac_encoder->set_blocksize(audio_fft_size / 2);  // exact match to process() call size → no buffering
    flac_encoder->init();
    return flac_encoder;
}

void AudioClient::on_set_codec_message(std::string &codec) {
    // Only "pcm" is honoured here; it is a one-way pin for the internal autorun
    // loopback client. Unknown codecs are ignored so a stray message from a
    // normal client can never disturb its FLAC/Opus stream.
    if (codec != "pcm") {
        return;
    }
    codec_pinned_pcm = true;
    std::scoped_lock lk(encoder_mtx_);
    if (encoder) {
        encoder->finish_encoder();
    }
    encoder = make_audio_encoder(AUDIO_PCM, 1);
}

void AudioClient::set_am_stereo(bool enable) {
    // A PCM-pinned client (autorun decoder) must never be swapped to Opus/FLAC.
    if (codec_pinned_pcm.load()) {
        am_stereo = enable;
        return;
    }
    // If switching away from stereo, cleanup SAM PLL state
    if (!enable && am_stereo) {
        cleanup_sam(this);
    }

    am_stereo = enable;

    // Keep backend AGC profile aligned with AM mono vs C-QUAM stereo.
    if (demodulation == AM) {
        std::scoped_lock lk(agc_mtx_);
        agc.reset();
        if (am_stereo) {
            agc.configureForQUAM();
        } else {
            agc.configureForAM();
        }
    }

    // Only create/reset the SAM PLL when enabling stereo.
    if (enable) {
        auto sam = get_sam(this, audio_rate);
        sam->set_stereo_mode(true);
        sam->reset(); // clears theta, acc, and internal DC blocker state
    }

    // Recreate encoder with the correct channel count AND codec.
    //
    // Codec policy: C-QUAM sounds better on Opus (its joint-stereo/perceptual
    // coding smooths the noisy L−R difference channel), while FLAC's lossless
    // reproduction is required for FAX/SSTV/digital and precise timing.  So we
    // force Opus while stereo is active and restore the configured default
    // (base_audio_compression, normally FLAC) when stereo turns off.  The
    // per-packet `codec` label (see audio.cpp) tells the browser to rebuild its
    // decoder to match, so the swap is transparent to the client.
    {
        std::scoped_lock lk(encoder_mtx_);
        if (encoder) {
            encoder->finish_encoder();

            // Stereo (2) if C-QUAM enabled, else mono (1).
            const int channels = enable ? 2 : 1;
#ifdef HAS_LIBOPUS
            // Use Opus for C-QUAM only when the client can actually decode it
            // (it advertises this via "codec_caps"; defaults true).  A client
            // that disabled Opus stays on the configured default (FLAC).
            const audio_compressor codec =
                (enable && client_opus_ok.load()) ? AUDIO_OPUS
                                                  : base_audio_compression;
#else
            // No Opus available — stay on the configured default (FLAC).
            const audio_compressor codec = base_audio_compression;
#endif
            encoder = make_audio_encoder(codec, channels);
        }
    }
}

const std::string &AudioClient::get_unique_id() { return unique_id; }

// Does the demodulation and sends the audio to the client.
// buf is given offset by l.
void AudioClient::send_audio(std::complex<float> *buf, size_t frame_num) {
    try {
        // FIX (data race / consistency): load the two atomic mode flags once
        // so every branch within this frame sees the same values.  Without a
        // snapshot a mode change arriving mid-function could, for example,
        // make the C-QUAM branch write audio_real_prev as the R-channel buffer
        // while the quantisation block at the bottom treats it as overlap-add
        // scratch, producing a corrupted frame.
        const demodulation_mode demod    = demodulation.load(std::memory_order_relaxed);
        const bool              stereo   = am_stereo.load(std::memory_order_relaxed);
        const bool              agc_on   = agc_enabled.load(std::memory_order_relaxed);

        // SAM lock indicator defaults off; only the mono-SAM branch sets it.
        sam_locked.store(false, std::memory_order_relaxed);

        // buf is pre-offset by l, so all local indices are relative to l.
        const int audio_l = 0;          // start of buf in relative coords (= l - l)
        const int audio_r = r - l;
        const int audio_m = floor(audio_mid) - l;
        const int audio_m_idx = floor(audio_mid);

        int len = audio_r - audio_l;
        // If the user requested the raw IQ signal, do not demodulate
        if (type == SIGNAL) {
            sender.send_binary_packet(hdl, buf,
                                      sizeof(std::complex<float>) * len);
            return;
        }

        float average_power = std::accumulate(
            buf, buf + len, 0.0f,
            [](float a, std::complex<float> &b) { return a + std::norm(b); });

        // Main demodulation logic for the frequency
        if (demod == USB || demod == LSB) {
            if (demod == USB) {
                // For USB, just copy the bins to the audio frequencies
                std::fill(audio_fft_input.get(),
                          audio_fft_input.get() + audio_fft_size, 0.0f);
                // User requested for [l, r)
                // IFFT bins are [audio_m, audio_m + audio_fft_size)
                // intersect and copy
                int copy_l = std::max(audio_l, audio_m);
                int copy_r = std::min(audio_r, audio_m + audio_fft_size);
                if (copy_r >= copy_l) {
                    std::copy(buf + copy_l - audio_l, buf + copy_r - audio_l,
                            audio_fft_input.get() + copy_l - audio_m);
                }
                fftwf_execute(p_real);
            } else if (demod == LSB) {
                // For LSB, just copy the inverted bins to the audio frequencies
                std::fill(audio_fft_input.get(),
                          audio_fft_input.get() + audio_fft_size, 0.0f);
                // User requested for [l, r)
                // IFFT bins are [audio_m - audio_fft_size + 1, audio_m + 1)
                // intersect and copy
                int copy_l = std::max(audio_l, audio_m - audio_fft_size + 1);
                int copy_r = std::min(audio_r, audio_m + 1);
                // last element should be at audio_fft_size - 1
                if (copy_r >= copy_l) {
                    std::reverse_copy(buf + copy_l - audio_l,
                                    buf + copy_r - audio_l,
                                    audio_fft_input.get() + audio_m - copy_r + 1);
                }
                fftwf_execute(p_real);
                std::reverse(audio_real.begin(), audio_real.end());
            }
            // On every other frame, the audio waveform is inverted due to the
            // 50% overlap. This only happens when downconverting by either even
            // or odd bins, depending on modulation.
            if (demod == USB && frame_num % 2 == 1 &&
                ((audio_m_idx % 2 == 0 && !is_real) ||
                 (audio_m_idx % 2 == 1 && is_real))) {
                dsp_negate_float(audio_real.data(), audio_fft_size);
            } else if (demod == LSB && frame_num % 2 == 1 &&
                       ((audio_m_idx % 2 == 0 && !is_real) ||
                        (audio_m_idx % 2 == 1 && is_real))) {
                dsp_negate_float(audio_real.data(), audio_fft_size);
            }

            // Overlap and add the audio waveform, due to the 50% overlap
            dsp_add_float(audio_real.data(), audio_real_prev.data(),
                          audio_fft_size / 2);
        } else if (demod == AM || demod == FM) {
            // For AM/SAM/FM, copy the bins to the complex baseband frequencies
            std::fill(audio_fft_input.get(),
                      audio_fft_input.get() + audio_fft_size, 0.0f);

            // Bins are [audio_l, audio_r)
            // Positive IFFT bins are [audio_m, audio_m + audio_fft_size / 2)
            // Negative IFFT bins are [audio_m - audio_fft_size / 2 + 1, audio_m)
            // intersect and copy
            int pos_copy_l = std::max(audio_l, audio_m);
            int pos_copy_r = std::min(audio_r, audio_m + audio_fft_size / 2);
            if (pos_copy_r >= pos_copy_l) {
                std::copy(buf + pos_copy_l - audio_l,
                          buf + pos_copy_r - audio_l,
                          audio_fft_input.get() + pos_copy_l - audio_m);
            }
            int neg_copy_l =
                std::max(audio_l, audio_m - audio_fft_size / 2 + 1);
            int neg_copy_r = std::min(audio_r, audio_m);
            // last element should be at audio_fft_size - 1
            if (neg_copy_r >= neg_copy_l) {
                std::copy(buf + neg_copy_l - audio_l,
                          buf + neg_copy_r - audio_l,
                          audio_fft_input.get() + audio_fft_size -
                              (audio_m - neg_copy_l));
            }

            auto prev = audio_complex_baseband[audio_fft_size / 2 - 1];
            std::copy(audio_complex_baseband.get() + audio_fft_size / 2,
                      audio_complex_baseband.get() + audio_fft_size,
                      audio_complex_baseband_prev.get());

            if (demod == AM) {
                // Carrier reconstruction for envelope detection
                std::copy(audio_complex_baseband_carrier.get() +
                              audio_fft_size / 2,
                          audio_complex_baseband_carrier.get() + audio_fft_size,
                          audio_complex_baseband_carrier_prev.get());
            }

            // Copy the bins to the complex baseband frequencies
            fftwf_execute(p_complex);

            if (demod == AM) {
                // Keep only the low frequencies < 500Hz for carrier estimation
                int cutoff = 500 * audio_fft_size / audio_rate;
                std::fill(audio_fft_input.get() + cutoff,
                          audio_fft_input.get() + audio_fft_size - cutoff,
                          0.0f);
                fftwf_execute(p_complex_carrier);
            }

            if (frame_num % 2 == 1 && ((audio_m_idx % 2 == 0 && !is_real) ||
                                       (audio_m_idx % 2 == 1 && is_real))) {
                // If the center frequency is even and the frame number is odd,
                // or if the center frequency is odd and the frame number is
                // even, then the signal is inverted.
                dsp_negate_complex(audio_complex_baseband.get(),
                                   audio_fft_size);
                if (demod == AM) {
                    dsp_negate_complex(audio_complex_baseband_carrier.get(),
                                       audio_fft_size);
                }
            }

            dsp_add_complex(audio_complex_baseband.get(),
                            audio_complex_baseband_prev.get(),
                            audio_fft_size / 2);

            // Aggressive complex impulse blanker on newly-accumulated baseband
            apply_impulse_blanker_complex(audio_complex_baseband.get(),
                                          audio_fft_size / 2);

            if (demod == AM) {
                dsp_add_complex(audio_complex_baseband_carrier.get(),
                                audio_complex_baseband_carrier_prev.get(),
                                audio_fft_size / 2);

                // Also blank impulses on the SAM carrier reconstruction
                apply_impulse_blanker_complex(audio_complex_baseband_carrier.get(),
                                              audio_fft_size / 2);

                // Synchronous AM demodulation with PLL (SAM / C-QUAM).
                // Narrow loop for mono SAM (cleaner lock, less phase noise);
                // keep the wider loop for C-QUAM so its strong pilot/carrier
                // acquires fast.  set_loop_bw() does not disturb lock state.
                auto sam = get_sam(this, audio_rate);
                sam->set_loop_bw(stereo ? 50.0 : 20.0);
                if (stereo) {
                    // C-QUAM: decode true stereo (L/R)
                    for (int i = 0; i < audio_fft_size / 2; i++) {
                        float L, R;
                        sam->step_cquam(
                            audio_complex_baseband[i].real(),
                            audio_complex_baseband[i].imag(),
                            L, R
                        );
                        audio_real[i]      = L;
                        audio_real_prev[i] = R; // Right (temporary buffer in stereo mode)
                    }
                } else if (sam_enabled.load(std::memory_order_relaxed)) {
                    // Standard mono SAM: lock the PLL on the reconstructed
                    // carrier (<500 Hz), demodulate the full baseband with it.
                    for (int i = 0; i < audio_fft_size / 2; i++) {
                        audio_real[i] = sam->step(
                            audio_complex_baseband_carrier[i].real(),
                            audio_complex_baseband_carrier[i].imag(),
                            audio_complex_baseband[i].real(),
                            audio_complex_baseband[i].imag()
                        );
                    }
                    // Publish PLL lock state for the AM-button "SAM" indicator.
                    sam_locked.store(sam->locked, std::memory_order_relaxed);
                } else {
                    // Classic envelope (non-synchronous) AM: magnitude of the
                    // complex baseband, DC-blocked to strip the carrier term.
                    // No PLL, so sam_locked stays false (button reads "AM").
                    for (int i = 0; i < audio_fft_size / 2; i++) {
                        const float I = audio_complex_baseband[i].real();
                        const float Q = audio_complex_baseband[i].imag();
                        audio_real[i] = sam->dcblock_mono(sqrtf(I * I + Q * Q));
                    }
                }
            } else if (demod == FM) {
                // Polar discriminator for FM
                polar_discriminator_fm(audio_complex_baseband.get(), prev,
                                       audio_real.data(), audio_fft_size / 2);
            }
        }

        // Decide output channel count (C-QUAM uses true stereo)
        const int out_channels = (demod == AM && stereo) ? 2 : 1;

        if (demod == AM && stereo) {
            // ===== C-QUAM STEREO PROCESSING =====
            // At this point: audio_real[i] = L, audio_real_prev[i] = R

            // Copy into pre-allocated per-instance channel buffers (avoids
            // a heap allocation on every 20 ms frame — same fix as Opus frame_buf).
            std::copy(audio_real.begin(),      audio_real.begin()      + audio_fft_size / 2, cquam_L.begin());
            std::copy(audio_real_prev.begin(), audio_real_prev.begin() + audio_fft_size / 2, cquam_R.begin());

            // Optional backend noise gate per channel
            noise_gate.process(cquam_L.data(), audio_fft_size / 2);
            noise_gate.process(cquam_R.data(), audio_fft_size / 2);

            // Stereo-safe AGC: shared gain for both channels to preserve stereo image
            if (agc_on) {
                std::scoped_lock lk(agc_mtx_);
                agc.process_stereo(cquam_L.data(), cquam_R.data(), audio_fft_size / 2);
            }

            // Interleave L and R for stereo encoder
            // CORRECTED: Balanced gain so mono AM is louder (as expected)
            // This is the master multiplier applied to both L and R channels right before
            // int16 conversion. Raise it (e.g. 0.5f) to make QUAM louder,
            // lower it to make it quieter. This is the simplest lever
            const float stereo_gain = 0.4f;

            // Soft limiter to prevent harsh clipping distortion.
            // threshold 2.0f effectively disables limiting for normal levels.
            auto soft_limit = [](float x, float threshold = 2.0f) -> float {
                if (x > threshold) {
                    float excess = x - threshold;
                    return threshold + excess / (1.0f + excess * 2.0f);
                } else if (x < -threshold) {
                    float excess = -x - threshold;
                    return -threshold - excess / (1.0f + excess * 2.0f);
                }
                return x;
            };

            for (int i = 0; i < audio_fft_size / 2; i++) {
                const float L = cquam_L[i] * stereo_gain;
                const float R = cquam_R[i] * stereo_gain;

                // Apply soft limiting before int16 conversion
                const float L_limited = soft_limit(L);
                const float R_limited = soft_limit(R);

                // Convert to int16 and interleave: [L0, R0, L1, R1, ...]
                int32_t L_int = static_cast<int32_t>(L_limited * 32767.0f);
                int32_t R_int = static_cast<int32_t>(R_limited * 32767.0f);
                L_int = std::clamp(L_int, -32768, 32767);
                R_int = std::clamp(R_int, -32768, 32767);

                audio_real_int16[i * 2]     = L_int;
                audio_real_int16[i * 2 + 1] = R_int;
            }

            // Set audio details with stereo channel count
            // Send interleaved stereo audio.
            // size argument is samples-per-channel, not total interleaved samples.
            {
                std::scoped_lock lk(encoder_mtx_);
                encoder->set_data(frame_num, audio_l, audio_mid, audio_r,
                                  average_power, out_channels,
                                  sam_locked.load(std::memory_order_relaxed));
                encoder->process(audio_real_int16.data(), audio_fft_size / 2);
            }
            } else {
            // ===== MONO PROCESSING (USB, LSB, AM mono, FM, etc.) =====

            // FIX: NaN detection previously threw std::runtime_error, which was
            // caught by the outer catch(std::exception&) and silently discarded —
            // making NaN conditions completely invisible in production.
            // Now: log to stderr and zero the frame, then continue normally.
            for (int i = 0; i < audio_fft_size / 2; i++) {
                if (std::isnan(audio_real[i])) {
                    std::cerr << "WARNING: NaN in audio_real[" << i
                              << "] (demod=" << static_cast<int>(demod) << "), zeroing frame\n";
                    std::fill(audio_real.begin(),
                              audio_real.begin() + audio_fft_size / 2,
                              0.0f);
                    break;
                }
            }

            // Copy the half to add in the next frame
            std::copy(audio_real.begin() + (audio_fft_size / 2), audio_real.end(),
                    audio_real_prev.begin());

            // DC removal
            dc.removeDC(audio_real.data(), audio_fft_size / 2);

            // NOISE GATE - Apply before AGC to work on full dynamic range
            noise_gate.process(audio_real.data(), audio_fft_size / 2);

            // AGC (conditional — can be disabled)
            if (agc_on) {
                std::scoped_lock lk(agc_mtx_);
                agc.process(audio_real.data(), audio_fft_size / 2);
            }

            // Quantize into 16 bit audio to save bandwidth.
            // Mono boost — mono AM should be louder than stereo (30% boost).
            const float mono_boost = 1.5f;
            dsp_float_to_int16(audio_real.data(), audio_real_int16.data(),
                            static_cast<int>(65536 / 2 * mono_boost), audio_fft_size / 2);


            // Set audio details with mono channel count
            // Encode audio and send it off
            {
                std::scoped_lock lk(encoder_mtx_);
                encoder->set_data(frame_num, audio_l, audio_mid, audio_r,
                                average_power, out_channels,
                                sam_locked.load(std::memory_order_relaxed));
                encoder->process(audio_real_int16.data(), audio_fft_size / 2);
            }
        }

        // Ensure monitoring thread is running
        ensure_audio_monitor_thread_runs();

        // Convert bytes to bits and add to the total_bits_sent
        size_t bits_sent = static_cast<size_t>(audio_fft_size / 2)
                         * static_cast<size_t>(out_channels)
                         * 16; // frames * channels * 16 bits
        total_audio_bits_sent.fetch_add(bits_sent, std::memory_order_relaxed);

        // Increment the frame number
        frame_num++;
    } catch (const std::exception &exc) {
        // std::cout << "client disconnect" << std::endl;
    }
}

void AudioClient::on_window_message(int new_l, std::optional<double> &m,
                                    int new_r, std::optional<int> &) {
    if (!m.has_value()) {
        return;
    }
    if (new_l < 0 || new_l >= fft_result_size || new_r < 0 ||
        new_r >= fft_result_size || new_l > new_r) {
        return;
    }
    if (new_r - new_l > audio_fft_size) {
        return;
    }
    double new_m = m.value();
    set_audio_range(new_l, new_m, new_r);
}

void AudioClient::on_demodulation_message(std::string &demodulation) {
    // debounce_last_change and debounce_mutex were previously static locals,
    // meaning they were SHARED across all AudioClient instances. One user changing
    // mode would block all other users from changing mode for 100ms.
    // Now they are per-instance members (added to AudioClient in signal.h).
    {
        std::lock_guard<std::mutex> lock(debounce_mutex);
        auto now = std::chrono::steady_clock::now();
        auto elapsed = std::chrono::duration_cast<std::chrono::milliseconds>(
            now - debounce_last_change).count();
        if (elapsed < 100) {
            return;
        }
        debounce_last_change = now;
    }

    // Update the demodulation type, including AM-S (C-QUAM)
    if (demodulation == "USB") {
        this->demodulation = USB;
        set_am_stereo(false);
    } else if (demodulation == "LSB") {
        this->demodulation = LSB;
        set_am_stereo(false);
    } else if (demodulation == "AM") {
        this->demodulation = AM;
        set_am_stereo(false);
        sam_enabled.store(true, std::memory_order_relaxed);   // synchronous (SAM)
    } else if (demodulation == "AM-ENV") {
        // Plain envelope AM (non-synchronous) — AM button toggled off SAM.
        this->demodulation = AM;
        set_am_stereo(false);
        sam_enabled.store(false, std::memory_order_relaxed);  // envelope detector
    } else if (demodulation == "AM-S") {
        // C-QUAM AM Stereo
        this->demodulation = AM;
        set_am_stereo(true);
        sam_enabled.store(true, std::memory_order_relaxed);
    } else if (demodulation == "FM") {
        this->demodulation = FM;
        set_am_stereo(false);
    }

    // Reset AGC when changing demodulation modes
    {
        std::scoped_lock lk(agc_mtx_);
        this->agc.reset();

        // Mode-dependent AGC profile
        if (this->demodulation == AM) {
            if (am_stereo) {
                this->agc.configureForQUAM();
            } else {
                this->agc.configureForAM();
            }
        } else {
            // USB, LSB, CW (if ever added) and FM
            this->agc.configureForSSB();
        }
    }

    // Reset SAM PLL when switching to AM mode
    if (this->demodulation == AM) {
        auto sam = get_sam(this, audio_rate);
        sam->reset();
    }

    // Reset noise gate when changing modes
    this->noise_gate.reset();
}

// ============================================================================
// MESSAGE HANDLERS
// ============================================================================

void AudioClient::on_noise_gate_enable_message(bool enabled) {
    noise_gate.set_enabled(enabled);
}

void AudioClient::on_noise_gate_preset_message(std::string &preset) {
    noise_gate.set_preset(preset);
}

void AudioClient::on_agc_enable_message(bool enabled) {
    agc_enabled = enabled;
}

void AudioClient::on_codec_caps_message(bool opus_supported) {
    // Remember whether the browser can decode Opus.  If C-QUAM is already
    // active when this arrives, re-run the codec selection so a no-Opus client
    // is moved onto FLAC immediately (set_am_stereo is a no-op-safe rebuild).
    const bool changed = client_opus_ok.exchange(opus_supported) != opus_supported;
    if (changed && am_stereo.load(std::memory_order_relaxed)) {
        set_am_stereo(true);
    }
}

// ============================================================================

void AudioClient::on_close() {
    // Guard: close and fail handlers can both fire (e.g. websocketpp sends
    // close then fail on an unclean disconnect).  Only the first call does work.
    if (closed.exchange(true)) return;

    // FIX: Log BEFORE erasing from signal_slices.
    // append_user_log looks up the client in signal_slices to fetch ip / geo /
    // mode / duration_s.  The previous order (erase → broadcast) meant the
    // lookup always failed → all disconnect events had empty ip/geo and zero
    // duration.  Reversing the order keeps the client visible for the lookup.
    sender.broadcast_signal_changes(unique_id, -1, -1, -1, ip_address,
                                    is_internal_tap.load(std::memory_order_acquire));

    {
        std::scoped_lock lk(signal_slice_mtx);
        signal_slices.erase(it);
    }

    // Guard cleanup_sam so the destructor doesn't erase an already-absent key.
    if (!sam_cleaned.exchange(true)) {
        cleanup_sam(this);
    }
}

AudioClient::~AudioClient() {
    fftwf_destroy_plan(p_real);
    fftwf_destroy_plan(p_complex_carrier);
    fftwf_destroy_plan(p_complex);
#ifdef HAS_LIQUID
    nco_crcf_destroy(mixer);
#endif

    // Only cleanup if on_close() wasn't already called (e.g. abnormal disconnect)
    if (!sam_cleaned.exchange(true)) {
        cleanup_sam(this);
    }
}