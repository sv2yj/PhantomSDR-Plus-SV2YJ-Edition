#include "audioprocessing.h"
#include <cmath>
#include <algorithm>
#include <mutex>

// Local mutex for FFTW thread safety in audioprocessing.
// This avoids dependency on fft.h and provides thread-safe FFTW plan operations.
namespace {
    std::mutex g_audioprocessing_fftw_mutex;

    // AGC release is intentionally slower than attack to give the classic
    // "fast attack, soft release" receiver character.  The base releaseTimeMs
    // passed to the constructor is multiplied by this factor so the design
    // intent is explicit rather than hidden inside a unit-conversion constant.
    constexpr float kReleaseStretch = 5.0f;
}


AGC::AGC(float desiredLevel, float attackTimeMs, float releaseTimeMs, float lookAheadTimeMs, float sr)
    : desired_level(desiredLevel), sample_rate(sr) {

    // Look-ahead buffer in samples
    look_ahead_samples = static_cast<size_t>(lookAheadTimeMs * sample_rate / 1000.0f);

    // Attack/release time constants (per-sample coefficients).
    // Both use 0.001f to convert milliseconds → seconds correctly.
    // Release is additionally stretched by kReleaseStretch so it recovers
    // slowly after a signal drop, giving smooth "breathe-out" behaviour
    // without coupling the design choice to a unit-conversion mistake.
    attack_coeff  = 1.0f - std::exp(-1.0f / (attackTimeMs  * 0.001f * sample_rate));
    release_coeff = 1.0f - std::exp(-1.0f / (releaseTimeMs * 0.001f * sample_rate * kReleaseStretch));

    // Multiple gain stages (RF, IF1, IF2, IF3, Audio) – kept for future use
    gains.resize(5, 1.0f);

    // Limit how loud AGC can go.
    // Effective max linear gain = max_gain × 0.01f (output scale applied in process()).
    // 500 × 0.01 = 10× (+20 dB).
    max_gain = 1000.0f;

    // Dual time constant (fast branch, common to all modes)
    fast_attack_coeff = 1.0f - std::exp(-1.0f / (0.003f * sample_rate)); // ~3 ms

    // Stereo shared-gain AGC defaults (used by C-QUAM).
    stereo_level = 0.1f;
    stereo_gain = 1.0f;
    stereo_min_gain = 0.25f;
    stereo_max_gain = 10.0f;
    stereo_attack_alpha = 0.22f;
    stereo_release_alpha_fast = 0.006f;
    stereo_release_alpha_slow = 0.003f;
    stereo_level_alpha = 0.02f;
    stereo_target_level = 0.20f;

    // ▼ Default profile: SSB / CW (more agile speech AGC)
    configureForSSB();
    // ▲ Caller can later call configureForAM() / configureForQUAM() by mode

    // Initialize Noise Blanker parameters
    nb_enabled = false;
    nb_fft_size = 2048; // Profile 1 Audio.js
    nb_overlap = 1536;
    nb_average_windows = 32;
    nb_threshold = 0.140f;

    // Additional NB parameters (from header).
    // Note: nb_threshold_factor duplicates nb_threshold — nb_threshold is the
    // authoritative value used in applyNoiseBlanker(). nb_threshold_factor is
    // retained for ABI compatibility but should be considered deprecated.
    nb_window_size = 2048;
    nb_threshold_factor = nb_threshold;
    nb_smoothing_factor = 0.1f;

    nb_buffer.resize(nb_fft_size);
    nb_spectrum_history.resize(nb_average_windows, std::vector<float>(nb_fft_size / 2 + 1));
    nb_spectrum_average.resize(nb_fft_size / 2 + 1);
    nb_history_index = 0;

    // Allocate FFTW memory
    nb_fft_in  = fftwf_alloc_complex(nb_fft_size);
    nb_fft_out = fftwf_alloc_complex(nb_fft_size);

    // Create FFTW plans with mutex protection for thread safety.
    // FFTW planner is NOT thread-safe; protect all plan operations.
    {
        std::scoped_lock lock(g_audioprocessing_fftw_mutex);
        nb_fft_plan  = fftwf_plan_dft_1d(nb_fft_size, nb_fft_in,  nb_fft_out, FFTW_FORWARD,  FFTW_ESTIMATE);
        nb_ifft_plan = fftwf_plan_dft_1d(nb_fft_size, nb_fft_out, nb_fft_in,  FFTW_BACKWARD, FFTW_ESTIMATE);
    }

    // Validate that FFTW plans were created successfully
    if (!nb_fft_plan || !nb_ifft_plan) {
        std::cerr << "ERROR: Failed to create FFTW plans for AGC Noise Blanker" << std::endl;
        {
            std::scoped_lock lock(g_audioprocessing_fftw_mutex);
            if (nb_fft_plan)  { fftwf_destroy_plan(nb_fft_plan);  nb_fft_plan  = nullptr; }
            if (nb_ifft_plan) { fftwf_destroy_plan(nb_ifft_plan); nb_ifft_plan = nullptr; }
        }
        if (nb_fft_in)  { fftwf_free(nb_fft_in);  nb_fft_in  = nullptr; }
        if (nb_fft_out) { fftwf_free(nb_fft_out); nb_fft_out = nullptr; }
        throw std::runtime_error("FFTW plan creation failed in AGC constructor");
    }

    reset();
}

// Destructor: proper FFTW cleanup with thread safety
AGC::~AGC() {
    {
        std::scoped_lock lock(g_audioprocessing_fftw_mutex);
        if (nb_fft_plan)  { fftwf_destroy_plan(nb_fft_plan);  nb_fft_plan  = nullptr; }
        if (nb_ifft_plan) { fftwf_destroy_plan(nb_ifft_plan); nb_ifft_plan = nullptr; }
    }
    // fftwf_free is thread-safe; no lock needed
    if (nb_fft_in)  { fftwf_free(nb_fft_in);  nb_fft_in  = nullptr; }
    if (nb_fft_out) { fftwf_free(nb_fft_out); nb_fft_out = nullptr; }
}

// --------------------------------------------------------------------------
// Mode-dependent AGC profiles
// --------------------------------------------------------------------------

// SSB / CW: smoother speech handling
void AGC::configureForSSB() {
    hang_time      = static_cast<size_t>(0.40f * sample_rate);  // mild hold; avoids syllable pumping
    hang_threshold = 0.15f;                                     // trigger hang at normal speech level
    am_attack_coeff  = attack_coeff * 0.2f;                     // moderate peak control
    am_release_coeff = release_coeff * 0.20f;                   // gentle gain-up; smoother audio
}

// AM broadcast: very stable level, aggressive control, minimal movement
void AGC::configureForAM() {
    hang_time      = static_cast<size_t>(1.0f * sample_rate);   // 1 second hold
    hang_threshold = 0.25f;                                     // engage hang more often
    am_attack_coeff  = attack_coeff * 0.5f;                     // faster peak control
    am_release_coeff = release_coeff * 0.15f;                   // ultra-slow gain-up
}

// C-QUAM stereo: shared gain for both channels to preserve stereo image,
// with loudness kept close to mono AM but cleaner / less "fighty" than original.
void AGC::configureForQUAM() {
    // Base stage: gentler than plain AM so it protects and stabilizes,
    // but does not dominate the final loudness.
    hang_time        = static_cast<size_t>(0.45f * sample_rate);
    hang_threshold   = 0.35f;
    am_attack_coeff  = attack_coeff * 0.40f;
    am_release_coeff = release_coeff * 0.25f;

    // Stereo shared-gain stage: hot enough to match AM loudness,
    // but slightly smoother/cleaner than the original defaults.
    stereo_min_gain = 0.25f;
    stereo_max_gain = 9.0f;
    stereo_attack_alpha = 0.18f;
    // Release made much slower (smaller alpha = longer release) for very smooth,
    // non-"pumping" C-QUAM music: ~18 s / ~37 s recovery.  Downside: sluggish
    // level recovery on HF fades / when tuning to a weaker station.
    // TO RESTORE original: fast = 0.007f, slow = 0.0035f.
    // Previous (~2× slower) step was: fast = 0.0035f, slow = 0.0018f.
    stereo_release_alpha_fast = 0.0018f;  // ~18 s
    stereo_release_alpha_slow = 0.0009f;  // ~37 s (near max gain)
    stereo_level_alpha = 0.018f;
    // Lowered from 0.20f → 0.10f: this is the level the C-QUAM AGC raises strong
    // signals up to, and 0.20 made QUAM louder than mono AM.  Weak stations are
    // limited by stereo_max_gain (they never reach the target), so they are
    // unaffected — matching the "only strong stations" symptom.
    // TO RESTORE the old behaviour: set this back to 0.20f.
    stereo_target_level = 0.10f;   // was 0.20f (tried 0.14f)
}

// --------------------------------------------------------------------------
// Lookahead buffer management
// --------------------------------------------------------------------------

void AGC::push(float sample) {
    lookahead_buffer.push_back(sample);
    while (!lookahead_max.empty() && std::abs(lookahead_max.back()) < std::abs(sample)) {
        lookahead_max.pop_back();
    }
    lookahead_max.push_back(sample);

    if (lookahead_buffer.size() > look_ahead_samples) {
        pop();
    }
}

void AGC::pop() {
    float sample = lookahead_buffer.front();
    lookahead_buffer.pop_front();
    if (!lookahead_max.empty() && sample == lookahead_max.front()) {
        lookahead_max.pop_front();
    }
}

float AGC::max() {
    return lookahead_max.empty() ? 0.0f : std::abs(lookahead_max.front());
}

// --------------------------------------------------------------------------
// Noise Blanker Implementation (overlap-save architecture)
//
// Input blocks stride by nb_overlap and are nb_fft_size wide, so consecutive
// blocks overlap by (nb_fft_size - nb_overlap) samples — correct for
// overlap-save.  Only the LAST nb_overlap samples of each IFFT block are the
// valid, non-aliased output region and are written to processed_buffer.
// Writing the full nb_fft_size output samples per stride would cause later
// blocks to clobber earlier ones in the overlap region.
//
// Spectral processing is Wiener-style: the IFFT output provides a magnitude
// estimate used to derive a reduction factor, which is then applied to the
// original time-domain input sample.  This avoids IFFT ringing in the output
// while still using the spectral estimate for gating decisions.
// --------------------------------------------------------------------------

void AGC::applyNoiseBlanker(std::vector<float>& buffer) {
    if (!nb_enabled.load(std::memory_order_relaxed) || !nb_fft_plan || !nb_ifft_plan) {
        return;
    }

    std::vector<float> processed_buffer(buffer.size(), 0.0f);
    const float norm         = 1.0f / static_cast<float>(nb_fft_size);
    const size_t valid_start = nb_fft_size - nb_overlap; // first valid output index per block

    for (size_t i = 0; i < buffer.size(); i += nb_overlap) {
        // Copy available samples then zero-pad so the FFT never sees stale data.
        size_t copy_size = std::min(nb_fft_size, buffer.size() - i);
        std::copy(buffer.begin() + i, buffer.begin() + i + copy_size, nb_buffer.begin());
        if (copy_size < nb_fft_size) {
            std::fill(nb_buffer.begin() + copy_size, nb_buffer.end(), 0.0f);
        }

        // Load as real-valued complex input (imaginary = 0)
        for (size_t j = 0; j < nb_fft_size; ++j) {
            nb_fft_in[j][0] = nb_buffer[j];
            nb_fft_in[j][1] = 0.0f;
        }
        fftwf_execute(nb_fft_plan);

        // FIX: magnitude_spectrum covers DC through Nyquist inclusive (N/2 + 1 bins).
        // Previously it was sized N/2, causing the Nyquist bin to be read from the
        // wrong index (N/2 - 1, i.e. the bin below Nyquist).
        std::vector<float> magnitude_spectrum(nb_fft_size / 2 + 1);
        for (size_t j = 0; j <= nb_fft_size / 2; ++j) {
            magnitude_spectrum[j] = std::sqrt(nb_fft_out[j][0] * nb_fft_out[j][0] +
                                              nb_fft_out[j][1] * nb_fft_out[j][1]);
        }

        // Incremental running-average update — O(N/2) instead of O(N/2 × W).
        // Subtract the evicted bin, add the new bin.
        for (size_t j = 0; j <= nb_fft_size / 2; ++j) {
            nb_spectrum_average[j] +=
                (magnitude_spectrum[j] - nb_spectrum_history[nb_history_index][j])
                / static_cast<float>(nb_average_windows);
        }
        nb_spectrum_history[nb_history_index] = magnitude_spectrum;
        nb_history_index = (nb_history_index + 1) % nb_average_windows;

        // Derive threshold from average spectral level
        float avg_signal_level = std::accumulate(nb_spectrum_average.begin(),
                                                 nb_spectrum_average.end(), 0.0f)
                                 / static_cast<float>(nb_spectrum_average.size());
        float dynamic_threshold = nb_threshold * avg_signal_level;

        // Scale spectral bins and apply the same scale to the conjugate-symmetric
        // upper half so the IFFT output stays real.
        // DC (j=0) and Nyquist (j=N/2) are self-conjugate — scale once.
        {
            // DC bin
            float ratio0 = magnitude_spectrum[0] / (nb_spectrum_average[0] + 1e-12f);
            float scale0 = ratio0 > 1.0f ? 1.0f / std::sqrt(ratio0) : 1.0f;
            nb_fft_out[0][0] *= scale0;
            nb_fft_out[0][1] *= scale0;

            // Positive + mirrored negative frequencies
            for (size_t j = 1; j < nb_fft_size / 2; ++j) {
                float ratio = magnitude_spectrum[j] / (nb_spectrum_average[j] + 1e-12f);
                float scale = ratio > 1.0f ? 1.0f / std::sqrt(ratio) : 1.0f;
                nb_fft_out[j][0] *= scale;
                nb_fft_out[j][1] *= scale;
                // Mirror to conjugate-symmetric bin
                nb_fft_out[nb_fft_size - j][0] *= scale;
                nb_fft_out[nb_fft_size - j][1] *= scale;
            }

            // FIX: Nyquist bin — use magnitude_spectrum[N/2], not [N/2 - 1].
            // Previously the wrong (sub-Nyquist) bin was used because magnitude_spectrum
            // was only sized N/2 and Nyquist was never computed.
            float ratioN = magnitude_spectrum[nb_fft_size / 2]
                           / (nb_spectrum_average[nb_fft_size / 2] + 1e-12f);
            float scaleN = ratioN > 1.0f ? 1.0f / std::sqrt(ratioN) : 1.0f;
            nb_fft_out[nb_fft_size / 2][0] *= scaleN;
            nb_fft_out[nb_fft_size / 2][1] *= scaleN;
        }

        // Inverse FFT — result lands in nb_fft_in
        fftwf_execute(nb_ifft_plan);

        // FIX: Overlap-save — write only the LAST nb_overlap output samples per block.
        // Previously the full nb_fft_size samples were written per stride of nb_overlap,
        // causing each block to clobber the overlap region written by the previous block.
        // The first valid_start = (nb_fft_size - nb_overlap) output samples per block
        // are discarded; they correspond to the circular-aliased region in overlap-save.
        for (size_t j = valid_start; j < nb_fft_size; ++j) {
            size_t out_idx = i + (j - valid_start);
            if (out_idx >= buffer.size()) break;

            // Normalise IFFT output by 1/N to get true amplitude estimate
            float real_out  = nb_fft_in[j][0] * norm;
            float imag_out  = nb_fft_in[j][1] * norm;
            float magnitude = std::sqrt(real_out * real_out + imag_out * imag_out);

            // Wiener-style gating: reduction factor derived from IFFT magnitude,
            // applied to original input sample to avoid IFFT ringing in output.
            if (magnitude > dynamic_threshold) {
                float reduction_factor = dynamic_threshold / (magnitude + 1e-12f);
                processed_buffer[out_idx] = buffer[out_idx] * reduction_factor;
            } else {
                processed_buffer[out_idx] = buffer[out_idx];
            }
        }
    }

    buffer = processed_buffer;
}

// --------------------------------------------------------------------------
// Main AGC Processing
// --------------------------------------------------------------------------

void AGC::process(float *arr, size_t len) {
    // Copy input buffer so we can run the noise blanker
    std::vector<float> buffer(arr, arr + len);

    // Apply Noise Blanker if enabled (atomic load for thread safety)
    if (nb_enabled.load(std::memory_order_relaxed)) {
        applyNoiseBlanker(buffer);
    }

    // --- ZERO-LOOKAHEAD / MINIMUM-LATENCY PATH ---
    if (look_ahead_samples == 0) {
        for (size_t i = 0; i < len; ++i) {
            float sample      = buffer[i];
            float peak_sample = std::fabs(sample);

            float desired_gain = std::min(
                desired_level / (peak_sample + 1e-15f),
                max_gain
            );

            applyProgressiveAGC(desired_gain);

            float total_gain = 1.0f;
            for (float g : gains) {
                total_gain *= g;
            }
            total_gain = std::min(total_gain, max_gain);

            // 0.01f output scale: max_gain 1000 → 10× (+20 dB) effective ceiling
            arr[i] = sample * (total_gain * 0.01f);
        }
        return;
    }

    // --- LOOKAHEAD PATH (adds lookAheadTimeMs latency) ---
    for (size_t i = 0; i < len; ++i) {
        push(buffer[i]);

        if (lookahead_buffer.size() == look_ahead_samples) {
            float current_sample = lookahead_buffer.front();
            float peak_sample    = max();

            float desired_gain = std::min(
                desired_level / (peak_sample + 1e-15f),
                max_gain
            );

            applyProgressiveAGC(desired_gain);

            float total_gain = 1.0f;
            for (float g : gains) {
                total_gain *= g;
            }
            total_gain = std::min(total_gain, max_gain);

            // 0.01f output scale: max_gain 1000 → 10× (+20 dB) effective ceiling
            arr[i] = current_sample * (total_gain * 0.01f);
        } else {
            // Still filling lookahead buffer – mute until full window available
            arr[i] = 0.0f;
        }
    }
}

void AGC::process_stereo(float *left, float *right, size_t len) {
    if (!left || !right || len == 0) {
        return;
    }

    float avg_abs = 0.0f;
    for (size_t i = 0; i < len; ++i) {
        avg_abs += 0.5f * (std::fabs(left[i]) + std::fabs(right[i]));
    }
    avg_abs /= static_cast<float>(len);

    stereo_level += stereo_level_alpha * (avg_abs - stereo_level);

    float target_gain = 1.0f;
    if (stereo_level > 1e-6f) {
        target_gain = stereo_target_level / stereo_level;
        target_gain = std::clamp(target_gain, stereo_min_gain, stereo_max_gain);
    }

    const bool  near_max_gain = (stereo_gain > stereo_max_gain * 0.75f);
    const float release_alpha  = near_max_gain ? stereo_release_alpha_slow : stereo_release_alpha_fast;
    const float alpha          = (target_gain < stereo_gain) ? stereo_attack_alpha : release_alpha;
    stereo_gain += alpha * (target_gain - stereo_gain);

    for (size_t i = 0; i < len; ++i) {
        left[i]  *= stereo_gain;
        right[i] *= stereo_gain;
    }
}

// --------------------------------------------------------------------------
// Progressive Multi-Stage AGC
// --------------------------------------------------------------------------

void AGC::applyProgressiveAGC(float desired_gain) {
    // Decrement hang_counter ONCE per call, outside the stage loop.
    // (A previous version decremented once per stage — 5× too fast.)
    if (hang_counter > 0) {
        hang_counter--;
    }

    for (size_t i = 0; i < gains.size(); ++i) {
        float stage_desired_gain = std::min(std::pow(desired_gain, 1.0f / gains.size()), max_gain);

        // Re-arm hang timer when signal drops sharply
        if (stage_desired_gain < gains[i] * hang_threshold) {
            hang_counter = hang_time;
        }

        if (hang_counter > 0) {
            // Hang active — hold current gain, suppress release
        } else {
            // Dual time constant: fast branch dominates attack, slow branch dominates release
            float fast_gain = gains[i] * (1.0f - fast_attack_coeff) + stage_desired_gain * fast_attack_coeff;
            float slow_gain;

            if (stage_desired_gain < gains[i]) {
                slow_gain = gains[i] * (1.0f - am_attack_coeff)  + stage_desired_gain * am_attack_coeff;
            } else {
                slow_gain = gains[i] * (1.0f - am_release_coeff) + stage_desired_gain * am_release_coeff;
            }

            gains[i] = std::min(fast_gain, slow_gain);
        }
    }

    // Delayed AGC for RF stage (first stage): extra-slow release upward
    if (desired_gain > gains[0]) {
        gains[0] = std::min(
            gains[0] * (1.0f - release_coeff * 0.1f) + desired_gain * release_coeff * 0.1f,
            max_gain
        );
    }
}

void AGC::reset() {
    std::fill(gains.begin(), gains.end(), 1.0f);
    lookahead_buffer.clear();
    lookahead_max.clear();
    hang_counter = 0;
    stereo_level = 0.1f;
    stereo_gain  = 1.0f;
}