#ifndef WATERFALL_H
#define WATERFALL_H

#include "client.h"
#include "waterfallcompression.h"
#include <atomic>


extern std::atomic<size_t> total_bits_sent;
extern std::atomic<bool> monitor_thread_running;
extern std::atomic<double> waterfall_kbits_per_second;

class WaterfallClient : public Client {
  public:
    WaterfallClient(connection_hdl hdl, PacketSender &sender,
                    waterfall_compressor waterfall_compression,
                    int min_waterfall_fft);
    void set_waterfall_range(int level, int l, int r);
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
    virtual void on_window_message(int l, std::optional<double> &m, int r,
                                   std::optional<int> &level);
    void on_close();
    virtual ~WaterfallClient(){};

    std::multimap<std::pair<int, int>,
                  std::shared_ptr<WaterfallClient>>::iterator it;

    // FIX: guards set_waterfall_range / on_close race (see waterfall.cpp).
    // close and fail handlers can both fire; only the first call does work.
    std::atomic<bool> closed{false};

  protected:
    int min_waterfall_fft;
    int level;
    std::mutex range_mtx_; // protects l, r, level against send_waterfall races
    // Compression codec variables for waterfall
    std::unique_ptr<WaterfallEncoder> waterfall_encoder;

    waterfall_slices_t &waterfall_slices;
    waterfall_mutexes_t &waterfall_slice_mtx;

    std::chrono::steady_clock::time_point last_send_time;
    int data_points_sent_in_current_second;

    std::atomic<double> kiwi_target_fps{0.0};
    double kiwi_frame_accum{0.0}; // FFT thread only
};

#endif