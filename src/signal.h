#ifndef SIGNAL_H
#define SIGNAL_H

#include "audio.h"
#include "client.h"
#include "utils.h"
#include "utils/audioprocessing.h"

#include <atomic>
#include <chrono>
#include <complex>
#include <cmath>
#include <cstring>   // memset
#include <limits>    // std::numeric_limits
#include <memory>    // std::unique_ptr
#include <string>

#include <boost/align/aligned_allocator.hpp>

#ifdef HAS_LIQUID
#include <liquid/liquid.h>
#endif

template <typename T>
using AlignedAllocator = boost::alignment::aligned_allocator<T, 64>;

extern std::atomic<size_t> total_audio_bits_sent;
extern std::atomic<bool>   monitor_audio_thread_running;
extern std::atomic<double> audio_kbits_per_second;


// fftwf_malloc allocator for std::vector
template <typename T> struct fftwfAllocator {
    typedef T value_type;
    fftwfAllocator() {}
    template <typename U> fftwfAllocator(const fftwfAllocator<U> &) {}
    T *allocate(std::size_t n) {
        if (n > std::numeric_limits<std::size_t>::max() / sizeof(T))
            throw std::bad_alloc();
        if (auto p = static_cast<T *>(fftwf_malloc(n * sizeof(T))))
            return p;
        throw std::bad_alloc();
    }
    void deallocate(T *p, std::size_t) { fftwf_free(p); }
};

struct ComplexDeleter {
    void operator()(std::complex<float> *f) {
        fftwf_free(reinterpret_cast<fftwf_complex *>(f));
    }
};

// FIX 1: Removed `static` (caused a separate copy per TU); `inline` is correct
//         for a header utility function template.
// FIX 2: Added null check after fftwf_malloc — it can return nullptr on OOM,
//         which would make the subsequent memset/fill undefined behaviour.
// FIX 3: Qualified fill as std::fill — ADL does not find it for raw pointer types,
//         causing a compile error in the non-trivial branch.
template <typename T>
inline std::unique_ptr<T[], ComplexDeleter>
fftwf_malloc_unique_ptr(size_t n) {
    T *ptr = reinterpret_cast<T *>(fftwf_malloc(n * sizeof(T)));
    if (!ptr) throw std::bad_alloc();
    if constexpr (std::is_trivial<T>::value) {
        std::memset(ptr, 0, n * sizeof(T));
    } else {
        std::fill(ptr, ptr + n, T());
    }
    return std::unique_ptr<T[], ComplexDeleter>(ptr);
}

// ============================================================================
// NOISE GATE CLASS - Reduces background noise between signals
// ============================================================================
class NoiseGate {
private:
    float envelope    = 0.0f;
    float noise_floor = 0.001f;
    bool  gate_open   = true;

    // Preset parameters (default: balanced).
    //
    // process() logic:  close when (ratio < close_factor),
    //                   open  when (ratio > open_factor).
    // INVARIANT: open_factor > close_factor  — this creates the hysteresis
    // dead-zone [close_factor, open_factor] where gate state is unchanged.
    // If open_factor < close_factor the gate chatters on every sample in the
    // overlap region, which is a bug.
    //
    // FIX (presets): all 7 presets had open_factor and close_factor swapped
    // (open_factor was set to ~1.6–2.0, close_factor to ~3.3–3.8), violating
    // the invariant above and causing constant chattering in the most common
    // signal-level range.  Values are corrected below so open_factor (higher)
    // is always greater than close_factor (lower).
    float open_factor  = 2.2f;   // Open gate when ratio exceeds this (high threshold)
    float close_factor = 1.5f;   // Close gate when ratio drops below this (low threshold)
    float floor_gain   = 0.15f;  // Gain applied when gate is closed (15 %)

    float alpha_env   = 0.020f;   // Envelope tracking speed
    float alpha_noise = 0.0004f;  // Noise floor tracking speed

    bool enabled = false;         // Disabled by default

public:
    NoiseGate() = default;

    void set_enabled(bool en) {
        enabled = en;
        if (!en) {
            // Reset state when disabled
            envelope    = 0.0f;
            noise_floor = 0.001f;
            gate_open   = true;
        }
    }

    bool is_enabled() const { return enabled; }

    void set_preset(const std::string& preset) {
        if (preset == "aggressive") {
            alpha_env    = 0.0025f;   // Slower envelope for smoother response
            alpha_noise  = 0.00008f;  // More stable noise floor
            open_factor  = 3.50f;     // Gate opens when signal > 3.50 × noise floor
            close_factor = 1.70f;     // Gate closes when signal < 1.70 × noise floor
            floor_gain   = 0.38f;     // Higher floor for natural sound
        } else if (preset == "weak-signal") {
            alpha_env    = 0.0022f;   // Very slow, preserves weak signals
            alpha_noise  = 0.00007f;  // Very stable noise tracking
            open_factor  = 3.40f;     // Opens at slightly lower threshold (preserves weak signal)
            close_factor = 1.60f;     // Large hysteresis band (2.12× ratio)
            floor_gain   = 0.52f;     // High floor, natural background
        } else if (preset == "smooth") {
            alpha_env    = 0.0020f;   // Ultra-slow for smoothest transitions
            alpha_noise  = 0.00006f;  // Very stable
            open_factor  = 3.60f;     // Moderate opening threshold
            close_factor = 1.75f;     // Largest hysteresis band (2.06× ratio)
            floor_gain   = 0.55f;     // Very natural sound
        } else if (preset == "maximum") {
            alpha_env    = 0.0028f;   // Slightly faster for noise reduction
            alpha_noise  = 0.00008f;  // Stable tracking
            open_factor  = 3.45f;     // High threshold for maximum attenuation
            close_factor = 1.65f;     // Large hysteresis band (2.09× ratio)
            floor_gain   = 0.32f;     // Lower floor for quiet background
        } else if (preset == "cw") {
            // CW needs faster response but still smooth
            alpha_env    = 0.0035f;   // Faster for CW tones
            alpha_noise  = 0.00010f;  // Adaptive for changing conditions
            open_factor  = 3.30f;     // Quick to open on CW bursts
            close_factor = 1.65f;     // Good hysteresis band (2.0× ratio)
            floor_gain   = 0.35f;     // Moderate floor
        } else if (preset == "am-fm") {
            // Ultra-open, barely gates
            alpha_env    = 0.0020f;   // Very slow
            alpha_noise  = 0.00006f;  // Very stable
            open_factor  = 3.80f;     // High threshold — opens only on strong signals
            close_factor = 2.00f;     // Large hysteresis band (1.9× ratio)
            floor_gain   = 0.62f;     // Very high floor, natural sound
        } else if (preset == "balanced") {
            alpha_env    = 0.0024f;   // Moderate speed
            alpha_noise  = 0.00008f;  // Stable
            open_factor  = 3.50f;     // Balanced open threshold
            close_factor = 1.70f;     // Large hysteresis band (2.06× ratio)
            floor_gain   = 0.45f;     // Natural background level
        }
    }

    void process(float* audio, size_t length) {
        if (!enabled) return;

        for (size_t i = 0; i < length; i++) {
            float x = fabsf(audio[i]);

            envelope += alpha_env * (x - envelope);

            // Track noise floor only during quiet periods (signal near floor)
            if (envelope < noise_floor * 1.5f) {
                noise_floor += alpha_noise * (envelope - noise_floor);
            }
            if (noise_floor < 1e-6f) noise_floor = 1e-6f;

            float ratio = envelope / noise_floor;

            // Hysteresis: close below close_factor, open above open_factor.
            // Dead-zone [close_factor, open_factor] prevents chattering.
            if (gate_open) {
                if (ratio < close_factor) gate_open = false;
            } else {
                if (ratio > open_factor)  gate_open = true;
            }

            audio[i] = gate_open ? audio[i] : audio[i] * floor_gain;
        }
    }

    void reset() {
        envelope    = 0.0f;
        noise_floor = 0.001f;
        gate_open   = true;
    }
};
// ============================================================================

class AudioClient : public Client,
                    public std::enable_shared_from_this<AudioClient> {
    // NOTE: if Client already inherits from enable_shared_from_this somewhere
    // in your hierarchy, remove the second base class above and the code will
    // still compile correctly because shared_from_this() is inherited.
  public:
    AudioClient(connection_hdl hdl, PacketSender &sender,
                audio_compressor audio_compression, bool is_real,
                int audio_fft_size, int audio_max_sps, int fft_result_size);
    void set_audio_range(int l, double audio_mid, int r);
    void set_audio_demodulation(demodulation_mode demodulation);
    void set_am_stereo(bool enable);
    const std::string &get_unique_id();

  private:
    // Build a fully-initialised audio encoder for the given codec and channel
    // count.  Centralises the (fiddly) FLAC configuration and Opus setup so the
    // constructor and set_am_stereo() stay in sync.  Falls back to FLAC if Opus
    // is requested but not compiled in.
    std::unique_ptr<AudioEncoder> make_audio_encoder(audio_compressor codec,
                                                     int channels);

  public:

    virtual void on_window_message(int l, std::optional<double> &m, int r,
                                   std::optional<int> &level);
    virtual void on_demodulation_message(std::string &demodulation);
    void on_close();

    // Noise gate control methods
    void on_noise_gate_enable_message(bool enabled);
    void on_noise_gate_preset_message(std::string &preset);

    // AGC control methods
    void on_agc_enable_message(bool enabled);

    // Codec capability: false means this client cannot decode Opus, so C-QUAM
    // stays on FLAC for it (see set_am_stereo).
    void on_codec_caps_message(bool opus_supported) override;

    // Switch this client to raw PCM at runtime (autorun loopback client).
    void on_set_codec_message(std::string &codec) override;

    void send_audio(std::complex<float> *buf, size_t frame_num);
    virtual ~AudioClient();

    // Returns the demodulation mode as a lowercase string (e.g. "usb", "am").
    const char *get_mode_str() const;

    std::multimap<std::pair<int, int>, std::shared_ptr<AudioClient>>::iterator
        it;

    // User tracking — populated at construction time and never mutated after.
    std::string                                  ip_address;
    std::chrono::steady_clock::time_point        connected_at;

    // True only for the station's own internal PCM tap — a loopback client on
    // /audio?tap=<token> (the autorun spot decoder). Those are not listeners:
    // they must stay out of the user count, /users, users.json, the JSONL stats
    // log and the waterfall labels. A plain browser opened on the server itself
    // (http://localhost:<port>) is a real session and is NOT flagged here, so it
    // shows up with its IP and the "Local" label like any other client.
    // Set once in on_open_signal() before the client is published; read from
    // other threads afterwards, hence atomic.
    std::atomic<bool> is_internal_tap{false};

    // Set to true at the start of on_close(), before signal_slices.erase().
    // write_users_json() / get_users_json() skip clients where this is true so
    // the user count drops immediately on disconnect — fixing the off-by-one
    // where signal_clients was still N during the broadcast_signal_changes →
    // write_users_json() window before erase() actually ran.
    std::atomic<bool> disconnecting{false};

    // Geo location — filled asynchronously after construction.
    // Stored behind shared_ptrs so the background lookup thread can safely
    // extend their lifetime past an AudioClient disconnect/destroy.
    // Format of *geo_location_ptr: "🇬🇷 Athens, GR" | "Local" | "" (pending)
    std::shared_ptr<std::mutex>  geo_mutex_ptr    = std::make_shared<std::mutex>();
    std::shared_ptr<std::string> geo_location_ptr = std::make_shared<std::string>();

  protected:
    // User requested demodulation mode.
    // FIX (data race): written on websocket thread, read on FFT worker thread.
    std::atomic<demodulation_mode> demodulation;

    // Scratch space for the slice the user requested
    fftwf_complex *fft_slice_buf;
    uint8_t       *waterfall_slice_buf;

    // Scratch space for audio demodulation
    bool is_real;
    int  audio_fft_size;
    int  fft_result_size;
    int  audio_rate;
    std::unique_ptr<std::complex<float>[], ComplexDeleter> audio_fft_input;

    // IQ data for demodulation
    std::unique_ptr<std::complex<float>[], ComplexDeleter> audio_complex_baseband;
    std::unique_ptr<std::complex<float>[], ComplexDeleter> audio_complex_baseband_prev;

    std::unique_ptr<std::complex<float>[], ComplexDeleter> audio_complex_baseband_carrier;
    std::unique_ptr<std::complex<float>[], ComplexDeleter> audio_complex_baseband_carrier_prev;

    std::vector<float,   AlignedAllocator<float>>   audio_real;
    std::vector<float,   AlignedAllocator<float>>   audio_real_prev;
    std::vector<int32_t, AlignedAllocator<int32_t>> audio_real_int16;

    // Pre-allocated C-QUAM stereo channel buffers — avoids per-frame heap
    // allocation in the AM stereo path (send_audio is called at ~50 Hz).
    std::vector<float,   AlignedAllocator<float>>   cquam_L;
    std::vector<float,   AlignedAllocator<float>>   cquam_R;

    // IFFT plans for demodulation
    fftwf_plan p_complex;
    fftwf_plan p_complex_carrier;
    fftwf_plan p_real;

    // DC offset removal and AGC implementation
    DCBlocker<float>    dc;
    std::mutex agc_mtx_;              // guards agc against set_am_stereo / on_demodulation_message races
    AGC                 agc;
    MovingAverage<float> ma;
    MovingMode<int>     mm;

    // Noise gate (backend processing)
    NoiseGate noise_gate;

    // FIX: In-class initializers prevent UB from uninitialized reads if the
    // constructor body sets these fields late or a code path is ever added that
    // reads them before the constructor assignment.
    //
    // FIX (data race): demodulation, am_stereo and agc_enabled are written by
    // the websocket I/O thread (on_demodulation_message, on_agc_enable_message,
    // set_am_stereo) and read concurrently by the FFT worker thread (send_audio).
    // Without synchronization this is UB under the C++ memory model.  Making
    // them atomic provides sequentially-consistent loads/stores at essentially
    // zero extra cost on x86-64.
    std::atomic<bool> agc_enabled{false};
    std::atomic<bool> am_stereo{false};
    // True while mono SAM (AM, non-stereo) has PLL lock — drives the UI's
    // "SAM" lock indicator on the AM button.  False in every other mode.
    std::atomic<bool> sam_locked{false};
    // True = mono AM uses the synchronous PLL detector (SAM); false = classic
    // envelope (magnitude) detector.  Toggled from the UI by re-clicking AM.
    // Defaults false so AM starts as plain envelope; SAM is opt-in.
    std::atomic<bool> sam_enabled{false};

    // Per-instance debounce for on_demodulation_message.
    // (Previously static locals — shared across ALL clients, which was a bug.)
    std::mutex debounce_mutex;
    std::chrono::steady_clock::time_point debounce_last_change{
        std::chrono::steady_clock::now()};

    // Guard against double cleanup_sam between on_close() and ~AudioClient()
    std::atomic<bool> sam_cleaned{false};
    // Guard against on_close() being called by both the close and fail handlers.
    std::atomic<bool> closed{false};

#ifdef HAS_LIQUID
    nco_crcf mixer;
#endif

    // Compression codec
    std::mutex encoder_mtx_;              // guards encoder against set_am_stereo races
    std::unique_ptr<AudioEncoder> encoder;
    // The codec configured in the .toml — the client's default when NOT in
    // C-QUAM.  set_am_stereo() overrides to Opus while stereo is active (Opus
    // sounds better on noisy C-QUAM) and restores this default when stereo is
    // turned off, so FAX/SSTV/digital modes always fall back to the safe codec.
    audio_compressor base_audio_compression{AUDIO_FLAC};

    // Whether this client can decode Opus.  Set from the client's "codec_caps"
    // message (on_codec_caps_message); defaults true so clients that never send
    // it behave exactly as before.  When false, set_am_stereo keeps C-QUAM on
    // FLAC instead of switching to Opus.  Read by set_am_stereo on the I/O
    // thread; atomic for safety.
    std::atomic<bool> client_opus_ok{true};

    // True once the client has requested raw PCM via "set_codec". Pins the
    // encoder to PcmEncoder: the C-QUAM Opus swap in set_am_stereo is skipped so
    // the autorun decoder always receives raw samples regardless of demod mode.
    std::atomic<bool> codec_pinned_pcm{false};

    signal_slices_t &signal_slices;
    std::mutex      &signal_slice_mtx;
};

#endif