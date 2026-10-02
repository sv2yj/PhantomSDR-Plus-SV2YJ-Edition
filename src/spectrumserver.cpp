#include "spectrumserver.h"
#include "kiwi_bridge.h"
#include "chat.h"
#include "samplereader.h"
#include "crash_handler.h"
#include "listing/software_info.h"

#include <arpa/inet.h>
#include <boost/algorithm/string.hpp>
#include <cerrno>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <ctime>
#include <curl/curl.h>
#include <fcntl.h>
#include <fstream>
#include <iostream>
#include <netdb.h>
#include <netinet/in.h>
#include <poll.h>
#include <random>
#include <shared_mutex>
#include <sstream>
#include <sys/socket.h>
#include <thread>
#include <toml++/toml.h>
#include <unistd.h>

#include "glaze/glaze.hpp"
#include <nlohmann/json.hpp>

// ============================================================================
// Globals
// ============================================================================

toml::table config;
nlohmann::json markers;

// Protects `markers` against concurrent read (HTTP / WebSocket handler threads)
// vs write (marker_update_thread).  Use shared_lock to read, unique_lock to write.
std::shared_mutex markers_mutex;

// Kept for backwards-compatibility with external debugger scripts that may
// reference this symbol.  Actual signal handling is done via boost::asio
// signal_set inside broadcast_server::run().
broadcast_server *g_signal;

// ============================================================================
// Marker update thread
// ============================================================================

void broadcast_server::check_and_update_markers() {
    while (marker_update_running) {
        std::ifstream file("markers.json");
        if (file.is_open()) {
            nlohmann::json new_markers;
            try {
                file >> new_markers;
                file.close();
                std::unique_lock lk(markers_mutex);
                if (new_markers != markers) {
                    std::cout << "Markers updated." << std::endl;
                    markers = new_markers;
                }
            } catch (nlohmann::json::parse_error &e) {
                std::cerr << "Error parsing markers.json: " << e.what() << std::endl;
            }
        } else {
            std::cerr << "Unable to open markers.json file." << std::endl;
        }

        // Interruptible 60-second sleep: wakes promptly when stop() sets
        // marker_update_running = false.
        for (int i = 0; i < 60 && marker_update_running; ++i)
            std::this_thread::sleep_for(std::chrono::seconds(1));
    }
}

// ============================================================================
// Dead-connection cleanup (called from the 1-second event timer)
// ============================================================================

void broadcast_server::cleanup_dead_connections() {
    // FIX (SIGSEGV): Previously this function erased iterators directly from
    // signal_slices and waterfall_slices.  That bypassed the atomic<bool>
    // closed guard in AudioClient::on_close() and WaterfallClient::on_close(),
    // so a close/fail handler firing concurrently would erase the same iterator
    // a second time — corrupting the rb-tree → SIGSEGV in
    // _Rb_tree_rebalance_for_erase.
    //
    // Fix: collect dead client shared_ptrs under the lock (snapshot only),
    // release the lock, then call on_close() on each.  on_close() owns the
    // mutex acquisition and the closed-guard check, so concurrent close/fail
    // handlers and this cleanup path are all mutually exclusive.

    // Signal (audio) clients
    {
        std::vector<std::shared_ptr<AudioClient>> to_close;
        {
            std::scoped_lock lg(signal_slice_mtx);
            for (auto &[slice, client] : signal_slices) {
                try {
                    auto con = m_server.get_con_from_hdl(client->hdl);
                    if (!con || con->get_state() != websocketpp::session::state::open)
                        to_close.push_back(client);
                } catch (...) {
                    to_close.push_back(client);
                }
            }
        }
        for (auto &c : to_close)
            try { c->on_close(); } catch (...) {}
    }

    // Waterfall clients (one mutex per downsample level)
    for (int i = 0; i < downsample_levels; i++) {
        std::vector<std::shared_ptr<WaterfallClient>> to_close;
        {
            std::scoped_lock lg(waterfall_slice_mtx[i]);
            for (auto &[slice, client] : waterfall_slices[i]) {
                try {
                    auto con = m_server.get_con_from_hdl(client->hdl);
                    if (!con || con->get_state() != websocketpp::session::state::open)
                        to_close.push_back(client);
                } catch (...) {
                    to_close.push_back(client);
                }
            }
        }
        for (auto &c : to_close)
            try { c->on_close(); } catch (...) {}
    }

    // Events clients
    {
        std::scoped_lock lg(events_connections_mtx);
        for (auto it = events_connections.begin();
             it != events_connections.end();) {
            try {
                auto con = m_server.get_con_from_hdl(*it);
                if (!con || con->get_state() != websocketpp::session::state::open) {
                    it = events_connections.erase(it);
                    continue;
                }
            } catch (...) {
                it = events_connections.erase(it);
                continue;
            }
            ++it;
        }
    }
}

// ============================================================================
// Constructor
// ============================================================================

broadcast_server::broadcast_server(
    std::unique_ptr<SampleConverterBase> reader, toml::parse_result &config)
    : reader{std::move(reader)},
      frame_num{0},
      marker_update_running(false),
      websdr_running(false) {

    // Must be called once before any thread calls curl_easy_init().
    // Without this, curl_easy_init() has undefined behaviour and may silently
    // return null — all geo lookups would fail with no diagnostic.
    curl_global_init(CURL_GLOBAL_DEFAULT);

    server_threads = config["server"]["threads"].value_or(1);

    // ── Input: sample rate ────────────────────────────────────────────────
    auto sps_config = config["input"]["sps"].value<int>();
    if (!sps_config.has_value())
        throw std::runtime_error("Missing sample rate");
    sps = sps_config.value();

    // ── Input: centre frequency ───────────────────────────────────────────
    auto frequency = config["input"]["frequency"].value<int64_t>();
    if (!frequency.has_value())
        throw std::runtime_error("Missing frequency");

    // ── Input: FFT accelerator ────────────────────────────────────────────
    std::string accelerator_str = config["input"]["accelerator"].value_or("none");
    fft_threads = config["input"]["fft_threads"].value_or(1);

    // ── Input: signal type (real / IQ) ────────────────────────────────────
    auto signal_type_opt = config["input"]["signal"].value<std::string>();
    std::string signal_type_str =
        signal_type_opt.has_value()
            ? boost::algorithm::to_lower_copy(signal_type_opt.value())
            : "";
    if (!signal_type_opt.has_value() ||
        (signal_type_str != "real" && signal_type_str != "iq"))
        throw std::runtime_error(
            "Invalid signal type, specify either real or IQ input");

    is_real = (signal_type_str == "real");

    // ── Misc input parameters ─────────────────────────────────────────────
    fft_size          = config["input"]["fft_size"].value_or(131072);
    audio_max_sps     = config["input"]["audio_sps"].value_or(12000);
    min_waterfall_fft = config["input"]["waterfall_size"].value_or(1024);
    brightness_offset = config["input"]["brightness_offset"].value_or(0);
    show_other_users  = config["server"]["otherusers"].value_or(1) > 0;
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
    kiwi_audio_gain_lin = std::pow(10.0, kiwi_audio_gain_db / 20.0);

    // FIX: default_frequency previously used value_or(basefreq) before basefreq
    // was assigned.  Read as a raw value here; resolve against basefreq below.
    int64_t default_frequency_raw =
        config["input"]["defaults"]["frequency"].value<int64_t>().value_or(-1LL);
    default_mode_str = boost::algorithm::to_upper_copy<std::string>(
        config["input"]["defaults"]["modulation"].value_or("USB"));

    waterfall_compression_str =
        config["input"]["waterfall_compression"].value_or("zstd");
    audio_compression_str =
        config["input"]["audio_compression"].value_or("flac");

    m_docroot     = config["server"]["html_root"].value_or("html/");

    // ── Internal PCM-tap token ────────────────────────────────────────────
    // Random per-boot secret that lets a LOCAL loopback client (the autorun
    // spot daemon) bypass the loopback filter on /audio. Written to ./.tap_token
    // with owner-only permissions so only a same-host process running as this
    // user can read it. Regenerated every start — a stale token simply fails.
    {
        std::random_device rd;
        std::mt19937_64 gen(rd());
        std::uniform_int_distribution<uint64_t> dist;
        char buf[33];
        std::snprintf(buf, sizeof(buf), "%016llx%016llx",
                      (unsigned long long)dist(gen),
                      (unsigned long long)dist(gen));
        tap_token.assign(buf, 32);
        // Write mode-600 so only the owner can read the token.
        int fd = ::open(".tap_token", O_WRONLY | O_CREAT | O_TRUNC, 0600);
        if (fd >= 0) {
            ssize_t n = ::write(fd, tap_token.data(), tap_token.size());
            (void)n;
            ::close(fd);
        } else {
            std::cerr << "Warning: could not write .tap_token; internal audio "
                         "tap will be unavailable\n";
        }
    }

    // Per-IP limiting — off unless the config asks for it, so an existing
    // installation is unchanged until its config.toml gains these keys.
    limit_per_ip         = config["limits"]["per_ip"].value_or(0);
    limit_per_ip_sockets = config["limits"]["per_ip_sockets"].value_or(0);
    limit_per_ip_rate    = config["limits"]["per_ip_rate"].value_or(0);
    limit_per_ip_ban_s   = config["limits"]["per_ip_ban_s"].value_or(600);
    limit_idle_per_ip    = config["limits"]["idle_per_ip"].value_or(8);
    limit_idle_total     = config["limits"]["idle_total"].value_or(512);
    min_client_version   = config["server"]["min_client_version"].value_or(0);
    if (min_client_version > 0)
        std::cout << "Minimum client build on /audio: v"
                  << min_client_version
                  << " (older pages are asked to reload)" << std::endl;
    // A desktop tab opens four sockets (audio, waterfall, events, chat), so
    // the socket ceiling has to be a multiple of the listener limit or a
    // listener would be refused their own waterfall. The spare four absorb
    // sockets from a reloaded page that the kernel has not reaped yet.
    if (limit_per_ip_sockets <= 0 && limit_per_ip > 0)
        limit_per_ip_sockets = limit_per_ip * 4 + 4;
    if (limit_per_ip > 0 || limit_per_ip_sockets > 0 || limit_per_ip_rate > 0) {
        std::cout << "Per-IP limits: "
                  << (limit_per_ip > 0
                          ? std::to_string(limit_per_ip) + " listeners"
                          : std::string("unlimited listeners"))
                  << ", "
                  << (limit_per_ip_sockets > 0
                          ? std::to_string(limit_per_ip_sockets) + " sockets"
                          : std::string("unlimited sockets"))
                  << ", "
                  << (limit_per_ip_rate > 0
                          ? std::to_string(limit_per_ip_rate) +
                                " new/min then " +
                                std::to_string(limit_per_ip_ban_s) +
                                "s refused"
                          : std::string("no rate limit"))
                  << std::endl;
    }

    // ── Derive basefreq and fft_result_size ───────────────────────────────
    // For IQ, the left edge of the baseband is (centre − sps/2).
    if (is_real) {
        fft_result_size = fft_size / 2;
        basefreq        = frequency.value();
    } else {
        fft_result_size = fft_size;
        basefreq        = frequency.value() - sps / 2;
    }

    // Now basefreq is valid — resolve the default tuning frequency.
    // -1 (or absent from config) means "centre of the band".
    default_frequency = (default_frequency_raw == -1LL)
                            ? basefreq + sps / 2
                            : default_frequency_raw;

    if (is_real) {
        default_m = (double)(default_frequency - basefreq)
                    * fft_result_size * 2 / sps;
    } else {
        default_m = (double)(default_frequency - basefreq)
                    * fft_result_size / sps;
    }

    // ── Default window extents per mode ──────────────────────────────────
    int offsets_3  = (int)((3000LL  * fft_result_size) / sps);
    int offsets_4  = (int)((4500LL  * fft_result_size) / sps);
    int offsets_5  = (int)((5000LL  * fft_result_size) / sps);
    int offsets_96 = (int)((96000LL * fft_result_size) / sps);

    if (default_mode_str == "LSB") {
        default_mode = LSB;
        default_l = (int)default_m - offsets_3;
        default_r = (int)default_m;
    } else if (default_mode_str == "AM") {
        default_mode = AM;
        default_l = (int)default_m - offsets_4;
        default_r = (int)default_m + offsets_4;
    } else if (default_mode_str == "FM") {
        default_mode = FM;
        default_l = (int)default_m - offsets_5;
        default_r = (int)default_m + offsets_5;
    } else if (default_mode_str == "WBFM") {
        default_mode = FM;
        default_l = (int)default_m - offsets_96;
        default_r = (int)default_m + offsets_96;
    } else {
        default_mode = USB;
        default_l = (int)default_m;
        default_r = (int)default_m + offsets_3;
    }

    default_m = std::max(0.0, std::min((double)fft_result_size, default_m));
    default_l = std::max(0, std::min(fft_result_size, default_l));
    default_r = std::max(0, std::min(fft_result_size, default_r));

    audio_max_fft_size =
        (int)(std::ceil((double)audio_max_sps * fft_size / sps / 4.0) * 4);

    // ── Compression codecs ────────────────────────────────────────────────
    if (waterfall_compression_str == "zstd") {
        waterfall_compression = WATERFALL_ZSTD;
    } else if (waterfall_compression_str == "av1") {
#ifdef HAS_LIBAOM
        waterfall_compression = WATERFALL_AV1;
#else
        throw std::runtime_error("AV1 support not compiled in");
#endif
    } else {
        throw std::runtime_error(
            "Unknown waterfall_compression: " + waterfall_compression_str);
    }

    if (audio_compression_str == "flac") {
        audio_compression = AUDIO_FLAC;
    } else if (audio_compression_str == "opus") {
#ifdef HAS_LIBOPUS
        audio_compression = AUDIO_OPUS;
#else
        throw std::runtime_error("Opus support not compiled in");
#endif
    } else {
        throw std::runtime_error(
            "Unknown audio_compression: " + audio_compression_str);
    }

    // ── FFT accelerator selection ─────────────────────────────────────────
    fft_accelerator accelerator = CPU_FFTW;
    if (accelerator_str == "cuda") {
        accelerator = GPU_cuFFT;
        std::cout << "Using CUDA" << std::endl;
    } else if (accelerator_str == "opencl") {
        accelerator = GPU_clFFT;
        std::cout << "Using OpenCL" << std::endl;
    } else if (accelerator_str == "mkl") {
        accelerator = CPU_mklFFT;
        std::cout << "Using MKL" << std::endl;
    }

    // ── Waterfall downsample levels ───────────────────────────────────────
    downsample_levels = 0;
    for (int cur = fft_result_size; cur >= min_waterfall_fft; cur /= 2)
        downsample_levels++;

    // ── Create FFT object ─────────────────────────────────────────────────
    if (accelerator == GPU_cuFFT) {
#ifdef CUFFT
        fft = std::make_unique<cuFFT>(
            fft_size, fft_threads, downsample_levels, brightness_offset);
#else
        throw std::runtime_error("CUDA support is not compiled in");
#endif
    } else if (accelerator == GPU_clFFT) {
#ifdef CLFFT
        fft = std::make_unique<clFFT>(
            fft_size, fft_threads, downsample_levels, brightness_offset);
#else
        throw std::runtime_error("OpenCL support is not compiled in");
#endif
    } else if (accelerator == CPU_mklFFT) {
#ifdef MKL
        fft = std::make_unique<mklFFT>(
            fft_size, fft_threads, downsample_levels, brightness_offset);
#else
        throw std::runtime_error("MKL support is not compiled in");
#endif
    } else {
        fft = std::make_unique<FFTW>(
            fft_size, fft_threads, downsample_levels, brightness_offset);
    }
    fft->set_output_additional_size(audio_max_fft_size);

    // ── WebSocket server ──────────────────────────────────────────────────
    m_server.init_asio();
    // websdr.org keeps the inbound callback TCP connection idle for a while
    // before sending GET /~~orgstatus; the default handshake timeout is too short.
    m_server.set_open_handshake_timeout(600000);

    init_server();  // suppress noisy EOF / handshake error logs

    m_server.clear_access_channels(websocketpp::log::alevel::frame_header |
                                   websocketpp::log::alevel::frame_payload);

    m_server.set_open_handler(
        std::bind(&broadcast_server::on_open, this, std::placeholders::_1));
    m_server.set_http_handler(
        std::bind(&broadcast_server::on_http, this, std::placeholders::_1));

    // Count the connection from the moment it is accepted — before a single
    // byte has been read, which is the whole point. See handshake_watch_begin()
    // and the idle-connection limits in spectrumserver.h.
    if (limit_idle_per_ip > 0 || limit_idle_total > 0) {
        m_server.set_socket_init_handler(
            [this](connection_hdl hdl, boost::asio::ip::tcp::socket &sock) {
                // The peer address is all we have here: there is no request
                // yet, so no X-Forwarded-For. That is fine — loopback covers
                // everything arriving through proxy.py, and a direct flood
                // carries its own address.
                std::string ip;
                try {
                    boost::system::error_code ec;
                    auto ep = sock.remote_endpoint(ec);
                    if (!ec) ip = normalize_client_ip(ep.address().to_string());
                } catch (...) {}

                if (ip.empty() || is_loopback_ip(ip)) return;

                if (!handshake_watch_begin(hdl, ip)) {
                    boost::system::error_code ig;
                    sock.close(ig);
                }
            });
        std::cout << "Idle connections: "
                  << (limit_idle_per_ip > 0
                          ? std::to_string(limit_idle_per_ip) + " per address"
                          : std::string("unlimited per address"))
                  << ", "
                  << (limit_idle_total > 0
                          ? std::to_string(limit_idle_total) + " total"
                          : std::string("no total"))
                  << std::endl;
    }

    // ── Slice data structures ─────────────────────────────────────────────
    waterfall_slices.resize(downsample_levels);
    waterfall_slice_mtx.resize(downsample_levels);
}

// ============================================================================
// run() — start all threads and block until shutdown
// ============================================================================

void broadcast_server::run(uint16_t port) {
    running               = true;
    marker_update_running = true;
    marker_update_thread  =
        std::thread(&broadcast_server::check_and_update_markers, this);

    m_server.set_listen_backlog(8192);
    m_server.set_reuse_addr(true);
    try {
        m_server.listen(port);
    } catch (...) {
        // IPv6 not available — fall back to IPv4 only
        m_server.listen(websocketpp::lib::asio::ip::tcp::v4(), port);
    }
    m_server.start_accept();



    // Start the chat admin Unix-socket listener so the admin panel can delete
    // individual chat messages in real time without restarting the server.
    ChatClient::start_admin_listener();

    fft_thread = std::thread(&broadcast_server::fft_task, this);
    set_event_timer();

    // FIX (async-signal-safety): std::signal() with a handler that calls
    // mutex::lock() or thread::join() is undefined behaviour per POSIX.  Use
    // boost::asio signal_set instead: the completion runs on the io_service
    // thread pool where it is safe to call stop().
    //
    // FIX (deadlock — single-threaded io_service):
    // stop() must NOT join threads.  The signal completion runs on an io_service
    // thread.  Joining fft_thread from there while fft_task is blocked waiting
    // for io_service futures (dispatched via io_service.post(use_future)) would
    // deadlock with server_threads=1: the single io_service thread is occupied
    // in stop(), so the futures fft_task is waiting for can never execute.
    //
    // All joins are deferred to after m_server.run() returns (below), where we
    // are safely outside the io_service.
    boost::asio::signal_set signals(m_server.get_io_service(), SIGINT, SIGTERM);
    signals.async_wait(
        [this](const boost::system::error_code &ec, int signum) {
            if (!ec) {
                // Record why we are shutting down so crash.log explains an
                // otherwise-silent exit (the crash handler does NOT catch
                // SIGINT/SIGTERM). Runs in normal io_service context.
                crash_log_note(signum == SIGINT
                                   ? "received SIGINT — graceful shutdown"
                                   : signum == SIGTERM
                                         ? "received SIGTERM — graceful shutdown"
                                         : "received termination signal — graceful shutdown");
                stop();
            }
        });

    // Run io_context on a single thread only.
    //
    // websocketpp's close-handshake timer and connection I/O handlers both
    // capture shared_ptr copies in bound lambdas.  When the io_context runs
    // on multiple threads, those lambdas can be destroyed simultaneously on
    // different threads, causing concurrent shared_ptr refcount decrements
    // that corrupt the allocator's internal rb-tree and crash inside
    // _Rb_tree_rebalance_for_erase with SIGSEGV (si_code=SI_KERNEL).
    //
    // Confirmed by addr2line — crash call chain:
    //   handle_close_handshake_timeout()
    //     → handle_async_shutdown()
    //       → ~tuple() / ~__shared_count()   ← two threads, same object
    //         → _Rb_tree_rebalance_for_erase → SIGSEGV
    //
    // All CPU-heavy work (FFT, audio, waterfall, geo-IP) already runs on
    // dedicated std::threads outside this loop, so there is zero throughput
    // loss from keeping the websocketpp io_context single-threaded.
    // The server_threads config key is retained for compatibility but
    // intentionally ignored here.
    m_server.run();  // blocks until stop() calls m_server.stop()

    // Background service threads: websdr listing, WebSDR.org, marker updater,
    // and the FFT task.  Each checks its own atomic flag and exits cleanly.
    if (fft_thread.joinable())            fft_thread.join();
    if (websdr_thread.joinable())         websdr_thread.join();
    if (websdr_org_thread_.joinable())    websdr_org_thread_.join();
    if (marker_update_thread.joinable())  marker_update_thread.join();
}

// ============================================================================
// stop() — signal all threads to exit and close all WebSocket connections
// ============================================================================

void broadcast_server::stop() {
    // ── Step 1: signal all threads to exit ───────────────────────────────
    running               = false;
    marker_update_running = false;
    websdr_running        = false;
    websdr_org_running_   = false;
    ChatClient::stop_admin_listener();

    // Wake fft_task if it is sleeping on the condition variable.
    fft_processed.notify_all();

    // FIX (deadlock): do NOT join any threads here.
    // stop() is called from a boost::asio signal-handler completion, which runs
    // on one of the io_service threads.  If we tried to join fft_thread here:
    //   • fft_task() may be blocked on signal_futures / waterfall_futures,
    //   • those futures were posted to the io_service with use_future,
    //   • with server_threads=1 the only io_service thread is us, occupied
    //     waiting in join() → the futures can never execute → deadlock.
    // All joins are done in run() after m_server.run() has returned.

    // ── Step 2: stop accepting new connections ────────────────────────────
    m_server.stop_listening();

    // ── Step 3: close all existing connections ────────────────────────────
    // FIX (data race): close handlers for currently-open connections fire on
    // io_service threads and may concurrently erase from signal_slices /
    // waterfall_slices.  Acquire the relevant mutex before iterating each
    // container so we never race a concurrent erase.

    // Signal (audio) clients
    {
        std::scoped_lock lk(signal_slice_mtx);
        for (auto &[slice, data] : signal_slices) {
            websocketpp::lib::error_code ec;
            try {
                m_server.close(data->hdl,
                               websocketpp::close::status::going_away, "", ec);
            } catch (...) {}
        }
    }

    // Waterfall clients
    for (int i = 0; i < downsample_levels; i++) {
        std::scoped_lock lk(waterfall_slice_mtx[i]);
        for (auto &[slice, data] : waterfall_slices[i]) {
            websocketpp::lib::error_code ec;
            try {
                m_server.close(data->hdl,
                               websocketpp::close::status::going_away, "", ec);
            } catch (...) {}
        }
    }

    // Events clients
    {
        std::scoped_lock lg(events_connections_mtx);
        for (auto &hdl : events_connections) {
            websocketpp::lib::error_code ec;
            try {
                m_server.close(hdl,
                               websocketpp::close::status::going_away, "", ec);
            } catch (...) {}
        }
    }

    // ── Step 4: stop the io_service ───────────────────────────────────────
    // FIX (slow shutdown): without this call, keep-alive ping timers (scheduled
    // 25 seconds out per connection) kept the io_service alive long after all
    // connections were closed.  m_server.run() would not return until those
    // timers fired and were not rescheduled — a 25-second stall on every
    // controlled shutdown.  m_server.stop() forces the io_service to drain
    // immediately so m_server.run() (in run()) returns without delay.
    m_server.stop();
}

// ============================================================================
// WebSDR listing registration
// ============================================================================

void broadcast_server::start_websdr_updates() {
    websdr_running = true;
    websdr_thread  = std::thread(&broadcast_server::update_websdr_list, this);

    // Also start WebSDR.org registration if [websdr.org] enabled = true
    const auto *org_cfg = config["websdr"]["org"].as_table();
    if (org_cfg && (*org_cfg)["enabled"].value_or(false)) {
        websdr_org_running_ = true;
        websdr_org_thread_  =
            std::thread(&broadcast_server::update_websdr_org, this);
    }
}

void broadcast_server::update_websdr_list() {
    std::srand(std::time(nullptr));

    int port = config["server"]["port"].value_or(9002);
    auto center_frequency = config["input"]["frequency"].value<int64_t>();
    auto bandwidth        = config["input"]["sps"].value<int64_t>();
    std::string antenna     = config["websdr"]["antenna"].value_or("N/A");
    std::string grid_locator = config["websdr"]["grid_locator"].value_or("-");
    std::string hostname    = config["websdr"]["hostname"].value_or("");
    std::string websdr_name =
        config["websdr"]["name"].value_or("WebSDR_" + std::to_string(std::rand()));
    std::string signal_type = config["input"]["signal"].value_or("real");
    auto max_users          = config["limits"]["audio"].value<int64_t>();

    std::vector<std::string> register_urls;
    if (auto *url_array = config["websdr"]["register_urls"].as_array()) {
        for (const auto &node : *url_array) {
            if (auto url = node.value<std::string>()) {
                if (!url->empty())
                    register_urls.push_back(*url);
            }
        }
    }
    if (register_urls.empty())
        register_urls.emplace_back("https://sdr-list.xyz/api/update_websdr");

    const listing::SoftwareInfo software_info =
        listing::resolve_software_info(config);

    std::string websdr_id = std::to_string(std::rand());
    if (signal_type == "real")
        bandwidth = bandwidth.value_or(30000000) / 2;
    if (center_frequency.value_or(15000000) == 0)
        center_frequency = bandwidth.value_or(30000000) / 2;

    CURL *curl = curl_easy_init();
    if (!curl) {
        std::cerr << "Failed to initialize cURL" << std::endl;
        return;
    }
    curl_easy_setopt(curl, CURLOPT_NOSIGNAL,      1L);
    curl_easy_setopt(curl, CURLOPT_CONNECTTIMEOUT, 5L);
    curl_easy_setopt(curl, CURLOPT_TIMEOUT,       10L);
    curl_easy_setopt(curl, CURLOPT_VERBOSE,        0L);

    FILE *devnull = fopen("/dev/null", "w+");
    if (!devnull) {
        std::cerr << "Failed to open /dev/null" << std::endl;
        curl_easy_cleanup(curl);
        return;
    }

    CURLcode res;
    while (websdr_running) {
        // /audio clients, not /events sockets — the /mobile page opens /audio
        // only, so events sockets undercount by every mobile listener.
        const int user_count = static_cast<int>(count_listeners());

        glz::json_t json_data = {
            {"id",               websdr_id},
            {"name",             websdr_name},
            {"software",         software_info.name},
            {"software_version", software_info.version},
            {"version",          software_info.version},
            {"antenna",          antenna},
            {"bandwidth",        bandwidth.value_or(30000000)},
            {"users",            user_count},
            {"center_frequency", center_frequency.value_or(15000000)},
            {"grid_locator",     grid_locator},
            {"hostname",         hostname},
            {"max_users",        max_users.value_or(100)},
            {"port",             port}
        };
        std::string serialized_json = glz::write_json(json_data);

        curl_easy_setopt(curl, CURLOPT_WRITEDATA,      devnull);
        curl_easy_setopt(curl, CURLOPT_POSTFIELDS,     serialized_json.c_str());
        curl_easy_setopt(curl, CURLOPT_POSTFIELDSIZE,
                         static_cast<long>(serialized_json.length()));

        for (const auto &register_url : register_urls) {
            curl_easy_setopt(curl, CURLOPT_URL, register_url.c_str());

            struct curl_slist *headers = nullptr;
            struct curl_slist *tmp =
                curl_slist_append(headers, "Content-Type: application/json");
            if (!tmp) {
                std::cerr << "curl_slist_append OOM" << std::endl;
                continue;
            }
            headers = tmp;
            curl_easy_setopt(curl, CURLOPT_HTTPHEADER, headers);

            res = curl_easy_perform(curl);
            if (res != CURLE_OK)
                std::cerr << "curl_easy_perform() failed for " << register_url
                          << ": " << curl_easy_strerror(res) << std::endl;

            curl_slist_free_all(headers);
            curl_easy_setopt(curl, CURLOPT_HTTPHEADER, nullptr);
        }

        // Interruptible sleep: exits promptly when stop() sets websdr_running=false.
        for (int i = 0; i < 10 && websdr_running; ++i)
            std::this_thread::sleep_for(std::chrono::seconds(1));
    }

    curl_easy_cleanup(curl);
    fclose(devnull);
}

// ============================================================================
// WebSDR.org registration thread
// ============================================================================

void broadcast_server::update_websdr_org() {
    const toml::table *org_cfg = nullptr;
    if (auto ws = config["websdr"].as_table()) {
        if (auto org = (*ws)["org"].as_table())
            org_cfg = org;
    }
    if (!org_cfg || !(*org_cfg)["enabled"].value_or(false)) {
        std::cout << "[WebSDROrg] disabled ([websdr.org] enabled=true to enable)"
                  << std::endl;
        return;
    }

    std::string public_host = (*org_cfg)["public_host"].value_or(std::string(""));
    int         public_port =
        static_cast<int>((*org_cfg)["public_port"].value_or(int64_t(9002)));
    std::string qth         = (*org_cfg)["qth"].value_or(std::string(""));
    std::string description = (*org_cfg)["description"].value_or(std::string(""));
    std::string logo        =
        (*org_cfg)["logo"].value_or(std::string("vlag-nl-48.jpg"));
    std::string email_raw   = (*org_cfg)["email"].value_or(std::string(""));

    if (public_host.empty()) {
        std::cerr << "[WebSDROrg] public_host missing in [websdr.org]" << std::endl;
        return;
    }

    uint32_t cfg_serial =
        static_cast<uint32_t>(time(nullptr) & 0x7FFFFFFFu);
    char cookie_buf[32];
    snprintf(cookie_buf, sizeof(cookie_buf), "%08x0000", cfg_serial);

    std::string email_obf;
    for (unsigned char c : email_raw)
        email_obf += static_cast<char>(c ^ 1u);

    std::vector<WebsdrOrgState::Band> bands;
    {
        int64_t bw_hz     = is_real ? (sps / 2) : sps;
        int64_t center_hz = basefreq + (bw_hz / 2);
        std::string antenna =
            config["websdr"]["antenna"].value_or(std::string("N/A"));
        std::string name =
            config["websdr"]["name"].value_or(std::string("RX1"));
        std::string label = antenna.empty() ? name : (antenna + ". " + name);
        bands.push_back({center_hz / 1000.0, bw_hz / 1000.0, label});
    }

    {
        std::scoped_lock lk(websdr_org_state_mtx_);
        websdr_org_state_.enabled     = true;
        websdr_org_state_.cfg_serial  = cfg_serial;
        websdr_org_state_.cookie_id   = std::string(cookie_buf);
        websdr_org_state_.email_obf   = email_obf;
        websdr_org_state_.qth         = qth;
        websdr_org_state_.description = description;
        websdr_org_state_.logo        = logo;
        websdr_org_state_.bands       = bands;
    }

    std::cout << "[WebSDROrg] Starting (host=" << public_host
              << " port=" << public_port
              << " bands=" << bands.size() << ")" << std::endl;

    const std::string org_host = "websdr.ewi.utwente.nl";
    const std::string req      =
        "GET /~~websdrorg?host=" + public_host +
        "&port=" + std::to_string(public_port) +
        " HTTP/1.1\r\nHost: " + org_host + "\r\n\r\n";

    auto interruptible_sleep = [&](int seconds) {
        for (int i = 0; i < seconds && websdr_org_running_; ++i)
            std::this_thread::sleep_for(std::chrono::seconds(1));
    };

    int attempt = 0;
    int fd      = -1;

    while (websdr_org_running_) {
        if (fd < 0) {
            struct addrinfo hints{}, *res = nullptr;
            hints.ai_family   = AF_UNSPEC;
            hints.ai_socktype = SOCK_STREAM;

            if (getaddrinfo(org_host.c_str(), "80", &hints, &res) == 0) {
                for (auto *rp = res; rp; rp = rp->ai_next) {
                    char ipbuf[NI_MAXHOST]  = {0};
                    char portbuf[NI_MAXSERV] = {0};
                    getnameinfo(rp->ai_addr, rp->ai_addrlen,
                                ipbuf,   sizeof(ipbuf),
                                portbuf, sizeof(portbuf),
                                NI_NUMERICHOST | NI_NUMERICSERV);
                    std::cout << "[WebSDROrg] Connect try -> "
                              << ipbuf << ":" << portbuf << std::endl;

                    fd = socket(rp->ai_family, rp->ai_socktype, rp->ai_protocol);
                    if (fd < 0) {
                        std::cerr << "[WebSDROrg] socket() failed: "
                                  << strerror(errno) << std::endl;
                        continue;
                    }

                    int flags = fcntl(fd, F_GETFL, 0);
                    if (flags >= 0)
                        fcntl(fd, F_SETFL, flags | O_NONBLOCK);

                    struct timeval tv{15, 0};
                    setsockopt(fd, SOL_SOCKET, SO_RCVTIMEO, &tv, sizeof(tv));
                    setsockopt(fd, SOL_SOCKET, SO_SNDTIMEO, &tv, sizeof(tv));

                    if (connect(fd, rp->ai_addr, rp->ai_addrlen) == 0) {
                        if (flags >= 0) fcntl(fd, F_SETFL, flags);
                        std::cout << "[WebSDROrg] Connected to "
                                  << ipbuf << std::endl;
                        break;
                    }

                    if (errno == EINPROGRESS) {
                        struct pollfd pfd{};
                        pfd.fd     = fd;
                        pfd.events = POLLOUT;
                        int pr     = poll(&pfd, 1, 15000);
                        if (pr > 0 && (pfd.revents & POLLOUT)) {
                            int so_error = 0;
                            socklen_t slen = sizeof(so_error);
                            getsockopt(fd, SOL_SOCKET, SO_ERROR,
                                       &so_error, &slen);
                            if (so_error == 0) {
                                if (flags >= 0) fcntl(fd, F_SETFL, flags);
                                std::cout << "[WebSDROrg] Connected to "
                                          << ipbuf << std::endl;
                                break;
                            }
                            std::cerr << "[WebSDROrg] Connect failed to "
                                      << ipbuf << ": "
                                      << strerror(so_error) << std::endl;
                        } else if (pr == 0) {
                            std::cerr << "[WebSDROrg] Connect timeout to "
                                      << ipbuf << std::endl;
                        } else {
                            std::cerr << "[WebSDROrg] poll() failed: "
                                      << strerror(errno) << std::endl;
                        }
                    } else {
                        std::cerr << "[WebSDROrg] Connect failed to "
                                  << ipbuf << ": "
                                  << strerror(errno) << std::endl;
                    }

                    close(fd);
                    fd = -1;
                }
                freeaddrinfo(res);
            } else {
                std::cerr << "[WebSDROrg] DNS resolve failed for "
                          << org_host << std::endl;
            }

            if (fd < 0) {
                websdr_org_last_ok_.store(false);
                std::cerr << "[WebSDROrg] Connect failed, retry in 30s"
                          << std::endl;
                interruptible_sleep(30);
                continue;
            }
            std::cout << "[WebSDROrg] Connected to " << org_host << std::endl;
        }

        // The ping used to print three lines every 60 s -- sending, waiting,
        // and the reply -- which is 4320 lines a day saying the registration is
        // still fine. Only the reply is logged now, and only when it is worth
        // reading: see below. Every failure path still reports, on cerr.
        const bool prev_ok = websdr_org_last_ok_.load();
        if (send(fd, req.c_str(), req.size(), MSG_NOSIGNAL) < 0) {
            std::cerr << "[WebSDROrg] Send failed, reconnecting: "
                      << strerror(errno) << std::endl;
            close(fd);
            fd = -1;
            websdr_org_last_ok_.store(false);
            interruptible_sleep(30);
            continue;
        }
        ++attempt;

        char rbuf[256];
        rbuf[0] = '\0';
        ssize_t n = recv(fd, rbuf, sizeof(rbuf) - 1, 0);
        if (n > 0) {
            rbuf[n] = '\0';
            std::string s(rbuf);
            size_t nl = s.find('\r');
            // First ping, a recovery after any failure, and one an hour.
            if (attempt == 1 || !prev_ok || attempt % 60 == 0) {
                std::cout << "[WebSDROrg] ping #" << attempt << " OK — "
                          << (nl != std::string::npos ? s.substr(0, nl) : s)
                          << std::endl;
            }
            websdr_org_last_ok_.store(true);
        } else if (n == 0) {
            std::cerr << "[WebSDROrg] Remote closed connection, reconnecting"
                      << std::endl;
            close(fd);
            fd = -1;
            websdr_org_last_ok_.store(false);
            interruptible_sleep(30);
            continue;
        } else {
            std::cerr << "[WebSDROrg] Receive failed: " << strerror(errno)
                      << " (reconnecting)" << std::endl;
            close(fd);
            fd = -1;
            websdr_org_last_ok_.store(false);
            interruptible_sleep(30);
            continue;
        }

        interruptible_sleep(60);
    }

    if (fd >= 0) close(fd);
    std::cout << "[WebSDROrg] thread stopped" << std::endl;
}

// ============================================================================
// main()
// ============================================================================

int main(int argc, char **argv) {
    install_crash_handlers();
    std::string config_file;
    for (int i = 1; i < argc; i++) {
        if ((std::string(argv[i]) == "-c" ||
             std::string(argv[i]) == "--config") &&
            i + 1 < argc) {
            config_file = argv[i + 1];
            i++;
        }
        if (std::string(argv[i]) == "-h" ||
            std::string(argv[i]) == "--help") {
            std::cout
                << "Options:\n"
                   "--help                             produce help message\n"
                   "-c [ --config ] arg (=config.toml) config file\n";
            return 0;
        }
    }

    std::cout
        << "\r\n __                   __ __  __      \r\n"
           "|__)|_  _  _ |_ _  _ (_ |  \\|__) _|_ \r\n"
           "|   | )(_|| )|_(_)|||__)|__/| \\   |  \r\n"
           "                                     \n"
        << "Thank you for using PhantomSDR+, you are supporting the "
           "Development of an Open-Source WebSDR Project ♥"
        << std::endl;

    config = toml::parse_file(config_file);

    // host is read from config but websocketpp binds on all interfaces by
    // default; the value is kept for future selective-bind support.
    [[maybe_unused]] std::string host =
        config["server"]["host"].value_or("0.0.0.0");

    auto driver_type = config["input"]["driver"]["name"].value<std::string>();
    if (!driver_type.has_value()) {
        std::cout << "Specify an input driver" << std::endl;
        return 0;
    }

    std::string input_format =
        config["input"]["driver"]["format"].value_or("f32");
    boost::algorithm::to_lower(input_format);

    // Initialise multi-threaded FFTW if requested
    int fft_threads = config["input"]["fft_threads"].value_or(1);
    if (fft_threads > 1)
        fftwf_init_threads();

    // Reopen stdin in binary mode for the raw IQ/real sample stream
    freopen(nullptr, "rb", stdin);
    auto reader = std::make_unique<FileSampleReader>(stdin);
    std::unique_ptr<SampleConverterBase> driver;

    if      (input_format == "u8")  driver = std::make_unique<SampleConverter<uint8_t>> (std::move(reader));
    else if (input_format == "s8")  driver = std::make_unique<SampleConverter<int8_t>>  (std::move(reader));
    else if (input_format == "u16") driver = std::make_unique<SampleConverter<uint16_t>>(std::move(reader));
    else if (input_format == "s16") driver = std::make_unique<SampleConverter<int16_t>> (std::move(reader));
    else if (input_format == "f32") driver = std::make_unique<SampleConverter<float>>   (std::move(reader));
    else if (input_format == "f64") driver = std::make_unique<SampleConverter<double>>  (std::move(reader));
    else {
        std::cout << "Unknown input format: " << input_format << std::endl;
        return 1;
    }

    int  port            = config["server"]["port"].value_or(9002);
    bool register_online = config["websdr"]["register_online"].value_or(false);

    broadcast_server server(std::move(driver), config);

    if (register_online)
        server.start_websdr_updates();

    // Signal handling is performed inside broadcast_server::run() via
    // boost::asio::signal_set, which is async-signal-safe.
    server.run(port);
    std::exit(0);
}
