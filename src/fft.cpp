#include "fft.h"
#include "spectrumserver.h"
#include "utils.h"
#include "crash_handler.h"

#include <numeric>
#include <csignal>

#include <fftw3.h>

// Main FFT loop to process input samples
void broadcast_server::fft_task() {

    // Attempt to import FFTW wisdom - Changed name to make clear.
    if (!fftwf_import_wisdom_from_filename("phantom_fftw_wisdom")) {
        std::cout << "No FFTW wisdom file found. Planning from scratch. This may take long on the first time but will then be fast." << std::endl;
    }

    // This is the buffer where it converts to a float

    std::unique_ptr<FFT> fft = std::move(this->fft);

    // Twice as many floats if it is complex
    float *input_buffers[3];
    int input_buffer_size = fft_size / 2 * (2 - is_real);
    int input_buffer_idx = 0;
    input_buffers[0] = fft->malloc(input_buffer_size);
    input_buffers[1] = fft->malloc(input_buffer_size);
    input_buffers[2] = fft->malloc(input_buffer_size);

    // FFT planning
    if (is_real) {
        fft->plan_r2c(FFTW_ESTIMATE | FFTW_DESTROY_INPUT); //ESTIMATE no need for MEASURE - Bas ON5HB
    } else {
        fft->plan_c2c(FFT::FORWARD, FFTW_MEASURE | FFTW_DESTROY_INPUT);
    }
    
    // Export FFTW wisdom after planning
    if (!fftwf_export_wisdom_to_filename("phantom_fftw_wisdom")) {
        std::cout << "Failed to export FFTW wisdom." << std::endl;
    }

    fft_buffer = reinterpret_cast<std::complex<float>*>(fft->get_output_buffer());

    // Target fps is 10, *2 since 50% overlap -- reduced to 5 for test
    int skip_num = std::max(1, (int)floor(((float)sps / fft_size) / 10.) * 2);
    std::cout << "Waterfall is sent every " << skip_num << " FFTs" << std::endl;

    MovingAverage<double> sps_measured(60);
    auto prev_data = std::chrono::steady_clock::now();

    // Rate at which this loop produces a new spectrum: one hop is half an FFT
    // window (50% overlap is hardcoded above), so sps/(fft_size/2).  Kiwi
    // clients are paced against it -- see WaterfallClient::kiwi_take_frame().
    const double waterfall_source_fps = 2.0 * (double)sps / (double)fft_size;

    auto signal_loop_fn = std::bind(&broadcast_server::signal_loop, this);
    int8_t *quantized_buffer = fft->get_quantized_buffer();
    auto waterfall_loop_fn = [this, quantized_buffer,
                              waterfall_source_fps](bool kiwi_only) {
        return waterfall_loop(quantized_buffer, kiwi_only,
                              waterfall_source_fps);
    };

    std::future<void> buffer_read = std::async(std::launch::async, [] {});
    std::vector<std::future<void>> signal_futures;
    std::vector<std::future<void>> waterfall_futures;

    while (running) {
        // Read, convert and scale the input
        // 50% overlap is hardcoded for favourable downconverter properties
        // FIX: use .get() so any exception thrown by reader->read() (e.g.
        // RX-888 EOF / read error) surfaces here with a clear log line and
        // triggers a clean shutdown instead of being silently swallowed when
        // the future is reassigned below.
        try {
            buffer_read.get();
        } catch (const std::exception &e) {
            std::cerr << "[FFT] Input stream stopped: " << e.what()
                      << " — shutting down FFT loop." << std::endl;
            // Record the reason in crash.log too — an input EOF (RX-888 /
            // rx888_stream died, FIFO closed) exits main cleanly and leaves no
            // fatal-signal banner, so without this crash.log goes silent.
            {
                std::string note = "input stream stopped: ";
                note += e.what();
                note += " — FFT loop shutting down";
                crash_log_note(note.c_str());
            }
            running = false;
            // Trigger a FULL clean shutdown, not just an FFT-loop exit.
            // Without this the process lingers with m_server.run() still
            // blocking: alive to ps (so the watchdog's grep sees it as
            // healthy) but producing no audio/waterfall — a "deaf" server that
            // never auto-restarts. raise(SIGTERM) fires the existing asio
            // signal handler on the io thread → stop() → main returns →
            // watchdog restarts. (Safer than calling stop() from this thread,
            // which websocketpp expects to run on the io_service thread.)
            raise(SIGTERM);
            break;
        } catch (...) {
            std::cerr << "[FFT] Input stream stopped (unknown exception) — "
                         "shutting down FFT loop." << std::endl;
            crash_log_note("input stream stopped (unknown exception) — "
                           "FFT loop shutting down");
            running = false;
            // See note above: force a full clean shutdown so the watchdog can
            // restart, instead of lingering as a deaf-but-alive process.
            raise(SIGTERM);
            break;
        }
        float *buf0 = input_buffers[input_buffer_idx];
        float *buf1 = input_buffers[(input_buffer_idx + 1) % 3];
        float *buf2 = input_buffers[(input_buffer_idx + 2) % 3];
        if (is_real) {
            // Read into buf2 asynchronously
            buffer_read = std::async(std::launch::async,
                                     [buf2, fft_size = fft_size, this] {
                                         reader->read(buf2, fft_size / 2);
                                     });

            fft->load_real_input(buf0, buf1);
        } else {
            // IQ data has twice as many floats
            buffer_read = std::async(std::launch::async,
                                     [buf2, fft_size = fft_size, this] {
                                         reader->read(buf2, fft_size);
                                     });
            fft->load_complex_input(buf0, buf1);
        }

        input_buffer_idx = (input_buffer_idx + 1) % 3;
        // Skip FFT computation when no clients are connected.
        // signal_slice_mtx guards signal_slices; waterfall_slices elements
        // each have their own per-level mutex — check them sequentially.
        {
            size_t total = 0;
            {
                std::scoped_lock lg(signal_slice_mtx);
                total = signal_slices.size();
            }
            if (total == 0) {
                for (int i = 0; i < downsample_levels; i++) {
                    std::scoped_lock lg(waterfall_slice_mtx[i]);
                    total += waterfall_slices[i].size();
                    if (total > 0) break;
                }
            }
            if (total == 0) continue;
        }

        // Wait for all the signal and waterfall clients to finish
        for (auto &f : signal_futures) {
            f.wait();
        }
        for (auto &f : waterfall_futures) {
            f.wait();
        }

        fft->execute();
        if (!is_real) {

            // If the user requested a range near the 0 frequency,
            // the data will wrap around, copy the front to the back to make
            // it contiguous
            memmove(&fft_buffer[fft_result_size], &fft_buffer[0],
                   sizeof(fftwf_complex) * audio_max_fft_size);
        }

        // Enqueue tasks once the fft is ready
        signal_futures = signal_loop_fn();
        // Run every frame now: browser clients still only get served on the
        // skip_num boundary, but Kiwi clients need the frames in between to
        // reach the ~23 fps their protocol asks for.
        waterfall_futures = waterfall_loop_fn(frame_num % skip_num != 0);
        frame_num++;

        /*auto cur_data = std::chrono::steady_clock::now();
        std::chrono::duration<double> diff_time = cur_data - prev_data;
        sps_measured.insert(diff_time.count());
        prev_data = cur_data;
        if (frame_num % 10 == 0) {
            // std::cout<<"SPS: "<<std::fixed<<(double)(fft_size / 2) /
            // sps_measured.getAverage()<<std::endl;
        }*/
    }
    // Ensure last iteration's async tasks finish before fft is destroyed
    for (auto &f : signal_futures)    f.wait();
    for (auto &f : waterfall_futures) f.wait();

    fft->free(input_buffers[0]);
    fft->free(input_buffers[1]);
    fft->free(input_buffers[2]);
}
