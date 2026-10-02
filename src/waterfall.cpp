#include <cmath>

#include "waterfall.h"
#include "waterfallcompression.h"
#include "kiwi_bridge.h"
#include <atomic>
#include <chrono>
#include <thread>
#include <iostream>

std::atomic<bool> monitor_thread_running{false};
std::atomic<size_t> total_bits_sent{0};
std::atomic<double> waterfall_kbits_per_second{0.0};

void monitor_data_rate() {
    monitor_thread_running = true;
    while (monitor_thread_running) {
        std::this_thread::sleep_for(std::chrono::seconds(1));
        size_t bits = total_bits_sent.exchange(0); // Reset counter and get value atomically
        waterfall_kbits_per_second.store(bits / 1000.0, std::memory_order_relaxed);
        //std::cout << "Data rate: " << kbits_per_second << " kbit/s" << std::endl;
    }
}

static std::once_flag waterfall_monitor_once_flag;

void ensure_monitor_thread_runs() {
    std::call_once(waterfall_monitor_once_flag, [] {
        std::thread(monitor_data_rate).detach();
    });
}

WaterfallClient::WaterfallClient(
    connection_hdl hdl, PacketSender &sender,
    waterfall_compressor waterfall_compression, int min_waterfall_fft)
    : Client(hdl, sender, WATERFALL), min_waterfall_fft{min_waterfall_fft},
      level{0}, waterfall_slices{sender.get_waterfall_slices()},
      waterfall_slice_mtx{sender.get_waterfall_slice_mtx()} {

    if (waterfall_compression == WATERFALL_ZSTD) {
        waterfall_encoder =
            std::make_unique<ZstdEncoder>(hdl, sender, min_waterfall_fft);
    } else if (waterfall_compression == WATERFALL_KIWI) {
        waterfall_encoder = std::make_unique<KiwiWfEncoder>(hdl, sender);
        is_kiwi = true;
    }
#ifdef HAS_LIBAOM
    else if (waterfall_compression == WATERFALL_AV1) {
        waterfall_encoder =
            std::make_unique<AV1Encoder>(hdl, sender, min_waterfall_fft);
    }
#endif
}

// Rate matching for Kiwi clients.  Called once per FFT frame (the source
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

void WaterfallClient::set_waterfall_range(int level, int l, int r) {
    // FIX (data race / SIGSEGV): set_waterfall_range and on_close both mutate
    // the stored iterator `it`.  The original code released the old-level lock
    // before acquiring the new-level lock, leaving a window where on_close()
    // could fire against an already-extracted, not-yet-reinserted node —
    // causing _Rb_tree_rebalance_for_erase to walk a detached node → SIGSEGV.
    //
    // Additional hazard: on_close() had no idempotency guard at all, so a
    // websocketpp close + fail double-fire would erase `it` twice.
    //
    // Fix: mirror the AudioClient pattern — double-check `closed` before and
    // after acquiring the per-level lock so set_waterfall_range and on_close
    // are mutually exclusive with respect to the multimap.

    if (closed.load()) return;

    // Snapshot the current level under range_mtx_ so we know which map to
    // extract from.  Use a local to avoid holding range_mtx_ across the map
    // operations (which take their own per-level mutexes).
    int old_level;
    {
        std::scoped_lock lk(range_mtx_);
        old_level = this->level;
    }

    if (old_level == level) {
        // Same level — only one lock needed; avoids a potential self-deadlock.
        std::scoped_lock lk(waterfall_slice_mtx[level]);
        if (closed.load()) return;
        auto node = waterfall_slices[level].extract(it);
        if (node.empty()) return;
        node.key() = {l, r};
        it = waterfall_slices[level].insert(std::move(node));
    } else {
        // Different levels — acquire both in index order to prevent deadlock,
        // then re-check closed under the locks.
        int lo = std::min(old_level, level);
        int hi = std::max(old_level, level);
        std::scoped_lock lk(waterfall_slice_mtx[lo], waterfall_slice_mtx[hi]);
        if (closed.load()) return;
        auto node = waterfall_slices[old_level].extract(it);
        if (node.empty()) return;
        node.key() = {l, r};
        it = waterfall_slices[level].insert(std::move(node));
    }

    {
        std::scoped_lock lk(range_mtx_);
        this->l     = l;
        this->r     = r;
        this->level = level;
    }
}

void WaterfallClient::send_waterfall(int8_t *buf, size_t frame_num) {
    try {
        int snap_l, snap_r, snap_level;
        {
            std::scoped_lock lk(range_mtx_);
            snap_l     = l;
            snap_r     = r;
            snap_level = level;
        }

        // Guard against a torn read producing a nonsensical range
        if (snap_l >= snap_r) return;

        int len = snap_r - snap_l;
        size_t bits_sent = static_cast<size_t>(len) * 8;

        waterfall_encoder->send(buf, len, frame_num,
                                snap_l << snap_level,
                                snap_r << snap_level);

        // Ensure monitoring thread is running
        ensure_monitor_thread_runs();

        // Add to the total bits sent
        total_bits_sent.fetch_add(bits_sent, std::memory_order_relaxed);
    } catch (...) {
        // Handle error (client disconnect, etc.)
    }
}

void WaterfallClient::on_window_message(int new_l, std::optional<double> &,
                                        int new_r, std::optional<int> &) {
    // Sanitize the inputs
    if (new_l < 0 || new_r < 0 || new_l >= new_r) {
        return;
    }
    // Calculate which level should it be at
    // Each level decreases the amount of points available by 2
    // Use floating point to prevent integer rounding errors
    // Find level closest to min_waterfall_fft samples

    float new_l_f = new_l;
    float new_r_f = new_r;
    int downsample_levels = waterfall_slices.size();
    int new_level = downsample_levels - 1;
    float best_difference = min_waterfall_fft * 2;
    for (int i = 0; i < downsample_levels; i++) {
        float send_size = abs((new_r_f - new_l_f) - min_waterfall_fft);
        if (send_size < best_difference) {
            best_difference = send_size;
            new_level = i;
            new_l = round(new_l_f);
            new_r = round(new_r_f);
        }
        new_l_f /= 2;
        new_r_f /= 2;
    }

    // Since the parameters are modified, output the new parameters


    set_waterfall_range(new_level, new_l, new_r);
}

void WaterfallClient::on_close() {
    // FIX: close and fail handlers can both fire on an unclean disconnect.
    // The atomic exchange ensures only the first call erases from the multimap.
    if (closed.exchange(true)) return;

    int snap_level;
    {
        std::scoped_lock lk(range_mtx_);
        snap_level = level;
    }
    std::scoped_lock lk(waterfall_slice_mtx[snap_level]);
    waterfall_slices[snap_level].erase(it);
}