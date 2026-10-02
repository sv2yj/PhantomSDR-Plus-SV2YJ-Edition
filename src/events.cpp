#include "spectrumserver.h"

#include "glaze/glaze.hpp"

#include <chrono>
#include <cstdio>    // std::rename
#include <fstream>
#include <iomanip>
#include <sstream>
#include <sys/stat.h> // ::mkdir for log directory creation

// ============================================================================
// USER TRACKING — /users HTTP endpoint + users.json on-disk dump
//
// Frequency conversion:
//   audio_mid is stored in fractional FFT bin units.
//   Hz = basefreq + round(audio_mid * sps / fft_size)
//   This formula is symmetric with the one used in spectrumserver.cpp to
//   compute default_m from default_frequency.
// ============================================================================

// is_loopback_ip() now lives in utils.cpp. It is shared with the per-IP
// connection limiter in websocket.cpp, which must exempt exactly the same
// server-local connections this file already keeps out of users.json and the
// JSONL statistics log — the autorun PCM tap above all, which would otherwise
// be able to spend a real listener's slot.

std::string broadcast_server::get_users_json() {
    const auto now_steady = std::chrono::steady_clock::now();
    const auto now_sys    = std::chrono::system_clock::now();
    const auto now_t      = std::chrono::system_clock::to_time_t(now_sys);

    // ISO-8601 UTC timestamp
    char ts[32];
    {
        struct tm tm_utc{};
        gmtime_r(&now_t, &tm_utc);
        std::strftime(ts, sizeof(ts), "%Y-%m-%dT%H:%M:%SZ", &tm_utc);
    }

    // The station's own Maidenhead locator, so a page can place a session that
    // has no public location of its own — a loopback or LAN listener, labelled
    // "Local" — at the receiver instead of dropping it off the map.
    std::string grid_locator = config["websdr"]["grid_locator"].value_or("");
    {
        std::string clean;
        for (unsigned char c : grid_locator)
            if (std::isalnum(c)) clean += static_cast<char>(c);
        grid_locator = clean;   // "-" / unset / punctuation -> empty
    }

    std::ostringstream o;
    o << "{\n"
      << "  \"timestamp\": \"" << ts << "\",\n"
      << "  \"grid_locator\": \"" << grid_locator << "\",\n"
      << "  \"users\": [\n";

    size_t total_clients = 0;
    {
        std::scoped_lock lk(signal_slice_mtx);

        bool first = true;
        for (auto &[slice, client] : signal_slices) {
            // Skip the station's own internal PCM tap (autorun spot decoder).
            // It is not a listener and would pollute the user count and
            // users.json. A browser opened on the server itself is a real
            // session and stays in the list, with its IP and "Local" label.
            if (client->is_internal_tap.load(std::memory_order_acquire)) continue;
            // FIX (off-by-one): skip clients that have set disconnecting=true in
            // on_close() but haven't been erased from signal_slices yet.
            if (client->disconnecting.load(std::memory_order_acquire)) continue;

            ++total_clients;
            if (!first) o << ",\n";
            first = false;

            // --- Duration ---
            const auto secs_total =
                std::chrono::duration_cast<std::chrono::seconds>(
                    now_steady - client->connected_at).count();
            const long hh = secs_total / 3600;
            const long mm = (secs_total % 3600) / 60;
            const long ss = secs_total % 60;
            char dur[16];
            std::snprintf(dur, sizeof(dur), "%ld:%02ld:%02ld", hh, mm, ss);

            // --- Frequency ---
            // audio_mid is in FFT bin units; see spectrumserver.cpp default_m
            // formula for the inverse: freq_hz = basefreq + audio_mid*sps/fft_size
            const int64_t freq_hz =
                basefreq + static_cast<int64_t>(
                    std::round(client->audio_mid * sps / fft_size));
            const double freq_khz = static_cast<double>(freq_hz) / 1000.0;

            // --- Connected-at timestamp (ISO-8601 UTC) ---
            const auto conn_sys =
                std::chrono::system_clock::now() -
                std::chrono::duration_cast<std::chrono::system_clock::duration>(
                    now_steady - client->connected_at);
            const auto conn_t = std::chrono::system_clock::to_time_t(conn_sys);
            char conn_ts[32];
            {
                struct tm tm_conn{};
                gmtime_r(&conn_t, &tm_conn);
                std::strftime(conn_ts, sizeof(conn_ts), "%Y-%m-%dT%H:%M:%SZ", &tm_conn);
            }

            // --- Geo location (async-filled; empty string while pending) ---
            std::string geo;
            {
                std::lock_guard<std::mutex> glk(*client->geo_mutex_ptr);
                geo = *client->geo_location_ptr;
            }
            // If still pending show the raw IP so the field is never blank
            if (geo.empty()) geo = client->ip_address;

            // Escape geo for safe embedding in a JSON string literal.
            // (append_user_log already does this for JSONL — mirror it here.)
            std::string geo_esc;
            geo_esc.reserve(geo.size());
            for (unsigned char c : geo) {
                if (c == '"' || c == '\\') geo_esc += '\\';
                geo_esc += static_cast<char>(c);
            }

            o << "    {\n"
              << "      \"id\": \""           << client->get_unique_id() << "\",\n"
              << "      \"ip\": \""           << client->ip_address      << "\",\n"
              << "      \"geo\": \""          << geo_esc                 << "\",\n"
              << "      \"freq_hz\": "        << freq_hz                 << ",\n"
              << "      \"freq_khz\": "
                  << std::fixed << std::setprecision(3) << freq_khz      << ",\n"
              << "      \"mode\": \""         << client->get_mode_str()  << "\",\n"
              << "      \"connected_at\": \"" << conn_ts                 << "\",\n"
              << "      \"duration\": \""     << dur                     << "\",\n"
              << "      \"duration_s\": "     << secs_total              << "\n"
              << "    }";
        }
    }

    o << "\n  ],\n"
      << "  \"total\": " << total_clients << "\n"
      << "}\n";

    return o.str();
}

void broadcast_server::write_users_json() {
    const std::string json = get_users_json();

    // Atomic write: write to a .tmp file then rename so readers never see a
    // partial file (rename is atomic on POSIX when src and dst are on the same
    // filesystem, which they always are here).
    // Strip any trailing slash from docroot before appending to avoid double-slash
    const std::string docroot = (!m_docroot.empty() && m_docroot.back() == '/')
                                ? m_docroot.substr(0, m_docroot.size() - 1)
                                : m_docroot;
    const std::string tmp  = docroot + "/users.json.tmp";
    const std::string dest = docroot + "/users.json";

    {
        std::ofstream f(tmp, std::ios::trunc);
        if (!f) {
            std::cerr << "write_users_json: cannot open " << tmp << "\n";
            return;
        }
        f << json;
    }

    if (std::rename(tmp.c_str(), dest.c_str()) != 0) {
        std::cerr << "write_users_json: rename failed for " << dest << "\n";
    }
}

// ============================================================================
// STATISTICS LOG — one JSONL file per day, auto-rotated at midnight UTC.
//
// Each line is a single JSON object representing one user event:
//
//  {"ts":"2024-11-15T14:32:07Z","event":"tune","id":"a3f9c2",
//   "ip":"82.104.x.x","geo":"🇬🇷 Athens, GR",
//   "freq_hz":7100000,"freq_khz":7100.000,"mode":"usb","duration_s":45}
//
// event values:
//   "tune"       — user connected or changed frequency / mode
//   "disconnect" — user closed the connection (duration_s = full session length)
//
// Files are written to: <docroot>/logs/users_YYYY-MM-DD.jsonl
// ============================================================================

void broadcast_server::append_user_log(const std::string &event,
                                       const std::string &unique_id,
                                       int l, double audio_mid, int /*r*/) {
    // Build UTC timestamp and today's log filename.
    const auto now_sys = std::chrono::system_clock::now();
    const auto now_t   = std::chrono::system_clock::to_time_t(now_sys);
    char ts[32], date[12];
    {
        struct tm tm_utc{};
        gmtime_r(&now_t, &tm_utc);
        std::strftime(ts,   sizeof(ts),   "%Y-%m-%dT%H:%M:%SZ", &tm_utc);
        std::strftime(date, sizeof(date), "%Y-%m-%d",            &tm_utc);
    }

    // Frequency — l == -1 is the disconnect sentinel, no valid freq.
    int64_t freq_hz  = 0;
    double  freq_khz = 0.0;
    if (l != -1) {
        freq_hz  = basefreq + static_cast<int64_t>(std::round(audio_mid * sps / fft_size));
        freq_khz = static_cast<double>(freq_hz) / 1000.0;
    }

    // Look up the live client to get ip / geo / mode / session duration.
    std::string ip_str, geo_str, mode_str = "?";
    long duration_s = 0;
    bool is_tap = false;
    {
        std::scoped_lock lk(signal_slice_mtx);
        for (auto &[slice, client] : signal_slices) {
            if (client->get_unique_id() == unique_id) {
                ip_str  = client->ip_address;
                is_tap  = client->is_internal_tap.load(std::memory_order_acquire);
                {
                    std::lock_guard<std::mutex> glk(*client->geo_mutex_ptr);
                    geo_str = *client->geo_location_ptr;
                }
                if (geo_str.empty()) geo_str = client->ip_address;
                mode_str   = client->get_mode_str();
                duration_s = std::chrono::duration_cast<std::chrono::seconds>(
                    std::chrono::steady_clock::now() - client->connected_at).count();
                break;
            }
        }
    }

    // Do not log the station's own internal PCM tap (autorun spot decoder):
    // it is permanently connected and would skew session statistics. A browser
    // on the server machine is a real session and is logged like any other.
    if (is_tap) return;

    // Ensure logs/ directory exists (no-op if already present).
    // Write logs to "logs/" relative to the working directory (project root).
    // The server always runs from ~/PhantomSDR-Plus/ so this resolves to
    // ~/PhantomSDR-Plus/logs/ — completely outside frontend/dist/ and
    // therefore never touched by Vite builds.
    const std::string logdir  = "logs";
    const std::string logfile = logdir + "/users_" + date + ".jsonl";
    ::mkdir(logdir.c_str(), 0755);

    // Escape any double-quotes or backslashes in geo string (rare but safe).
    std::string geo_esc;
    geo_esc.reserve(geo_str.size());
    for (unsigned char c : geo_str) {
        if (c == '"' || c == '\\') geo_esc += '\\';
        geo_esc += static_cast<char>(c);
    }

    // Build and append the JSONL line.
    std::ostringstream line;
    line << "{\"ts\":\""       << ts        << "\""
         << ",\"event\":\""    << event     << "\""
         << ",\"id\":\""       << unique_id << "\""
         << ",\"ip\":\""       << ip_str    << "\""
         << ",\"geo\":\""      << geo_esc   << "\""
         << ",\"freq_hz\":"    << freq_hz
         << ",\"freq_khz\":"   << std::fixed << std::setprecision(3) << freq_khz
         << ",\"mode\":\""     << mode_str  << "\""
         << ",\"duration_s\":" << duration_s
         << "}\n";

    std::ofstream f(logfile, std::ios::app);
    if (!f) {
        std::cerr << "append_user_log: cannot open " << logfile << "\n";
    } else {
        // Dedup: if this line is byte-for-byte identical to the last one logged
        // for this uid, skip it.  This suppresses duplicate entries that arise
        // when broadcast_signal_changes() is called twice within the same second
        // with the same arguments (e.g. initial set_audio_range at connect-time
        // followed immediately by the client's first window message, or rapid
        // re-tunes landing in the same 1-second timestamp bucket).
        // On disconnect (l == -1) we always log and clear the cache entry so the
        // next connect for this uid starts fresh.
        static std::mutex dedup_mtx;
        static std::unordered_map<std::string, std::string> last_logged;
        {
            std::lock_guard<std::mutex> dlk(dedup_mtx);
            auto it_dedup = last_logged.find(unique_id);
            if (l == -1) {
                // Always log disconnects; remove from map so the next session starts fresh.
                // BUG FIX (MEMORY LEAK): also erase stale entries for UIDs that
                // disconnected without an l==-1 event (abrupt drops, crashes).
                // The erase here handles the normal disconnect path.
                if (it_dedup != last_logged.end()) last_logged.erase(it_dedup);
            } else if (it_dedup != last_logged.end() && it_dedup->second == line.str()) {
                return; // exact duplicate — drop silently
            } else {
                last_logged[unique_id] = line.str();
            }
        }
        f << line.str();
    }
}

// ============================================================================

struct event_info {
    size_t waterfall_clients;
    size_t signal_clients;
    std::unordered_map<std::string, std::tuple<int, double, int>> signal_changes;
    double waterfall_kbits;
    double audio_kbits;
};

template <> 
struct glz::meta<event_info>
{
    using T = event_info;
    static constexpr auto value = object(
        "waterfall_clients", &T::waterfall_clients,
        "signal_clients", &T::signal_clients,
        "signal_changes", &T::signal_changes,
        "waterfall_kbits", &T::waterfall_kbits,
        "audio_kbits", &T::audio_kbits
    );
};
/* clang-format on */

// ---------------------------------------------------------------------------
// BUG FIX (DATA RACE): waterfall_slices[i] is a multimap that is modified by
// the FFT task thread (waterfall_loop) under waterfall_slice_mtx[i].  Reading
// .size() without holding the corresponding per-level mutex is a data race →
// undefined behaviour.
//
// Fix: acquire each per-level mutex in index order before reading .size().
// Since we always acquire them in the same order (0 … downsample_levels-1),
// and the FFT task only ever holds one at a time, there is no deadlock risk.
// ---------------------------------------------------------------------------
static size_t count_waterfall_clients(
        const waterfall_slices_t   &slices,
        waterfall_mutexes_t        &mtxs)
{
    size_t total = 0;
    for (size_t i = 0; i < slices.size(); ++i) {
        std::scoped_lock lk(mtxs[i]);
        total += slices[i].size();
    }
    return total;
}

// ---------------------------------------------------------------------------
// Count active (non-disconnecting, non-loopback) signal clients.
// Must be called with signal_slice_mtx already held.
// ---------------------------------------------------------------------------
static size_t count_signal_clients(const signal_slices_t &slices) {
    size_t n = 0;
    for (auto &[slice, client] : slices) {
        if (client->disconnecting.load(std::memory_order_acquire)) continue;
        if (client->is_internal_tap.load(std::memory_order_acquire)) continue;
        ++n;
    }
    return n;
}

size_t broadcast_server::count_listeners() {
    std::scoped_lock lk(signal_slice_mtx);
    return count_signal_clients(signal_slices);
}

std::string broadcast_server::get_event_info() {

    static auto last_kbits_time = std::chrono::steady_clock::now();
    auto now = std::chrono::steady_clock::now();

    // Hold the lock for the entire size-check + move to eliminate TOCTOU
    std::scoped_lock lk(signal_changes_mtx);

    if (!signal_changes.size() && std::chrono::duration_cast<std::chrono::seconds>(now - last_kbits_time).count() >= 10) {
        event_info info;
        {
            std::scoped_lock slk(signal_slice_mtx);
            info.signal_clients = count_signal_clients(signal_slices);
        }
        // BUG FIX: use the mutex-safe helper instead of bare accumulate.
        info.waterfall_clients = count_waterfall_clients(
            waterfall_slices, waterfall_slice_mtx);
        info.waterfall_kbits = waterfall_kbits_per_second.load(std::memory_order_relaxed);
        info.audio_kbits = audio_kbits_per_second.load(std::memory_order_relaxed);
        last_kbits_time = now;
        return glz::write_json(info);
    } else if (signal_changes.size()) {
        event_info info;
        info.waterfall_kbits = waterfall_kbits_per_second.load(std::memory_order_relaxed);
        info.audio_kbits = audio_kbits_per_second.load(std::memory_order_relaxed);
        // BUG FIX: use the mutex-safe helper instead of bare accumulate.
        info.waterfall_clients = count_waterfall_clients(
            waterfall_slices, waterfall_slice_mtx);
        {
            std::scoped_lock slk(signal_slice_mtx);
            info.signal_clients = count_signal_clients(signal_slices);
        }
        if (show_other_users) {
            info.signal_changes = std::move(signal_changes);
        }
        return glz::write_json(info);
    }

    return "";
}

std::string broadcast_server::get_initial_state_info() {

    event_info info;
    // BUG FIX: use the mutex-safe helper instead of bare accumulate.
    info.waterfall_clients = count_waterfall_clients(
        waterfall_slices, waterfall_slice_mtx);
    {
        std::scoped_lock lk(signal_slice_mtx);
        info.signal_clients = count_signal_clients(signal_slices);
        if (show_other_users) {
            info.signal_changes.reserve(signal_slices.size());
            for (auto &[slice, data] : signal_slices) {
                if (data->disconnecting.load(std::memory_order_acquire)) continue;
                // Skip the station's own PCM taps: not real listeners.
                if (data->is_internal_tap.load(std::memory_order_acquire)) continue;
                info.signal_changes.emplace(data->get_unique_id(),
                                            std::tuple<int, double, int>{
                                                data->l, data->audio_mid, data->r});
            }
        }
    }
    return glz::write_json(info);
}

void broadcast_server::broadcast_signal_changes(const std::string &unique_id,
                                                int l, double audio_mid,
                                                int r, const std::string &ip,
                                                bool internal_tap) {
    // signal_changes drives waterfall overlays — only populated when
    // show_other_users, and never for the station's own PCM taps (the autorun
    // spot decoder). Those are not listeners, so they must not appear as user
    // labels on the waterfall — the same rule already applied to /users and
    // users.json. A browser opened on the server itself IS a listener and gets
    // its label like everyone else.
    (void)ip;
    if (show_other_users && !internal_tap) {
        std::scoped_lock lk(signal_changes_mtx);
        signal_changes[unique_id] = {l, audio_mid, r};
    }

    // Append to daily JSONL statistics log.
    // l == -1 is the disconnect sentinel from AudioClient::on_close().
    append_user_log((l == -1) ? "disconnect" : "tune", unique_id, l, audio_mid, r);

    // Always write users.json on every connect / tune / disconnect event,
    // regardless of show_other_users (which only controls waterfall overlays).
    write_users_json();
}

void broadcast_server::on_open_events(connection_hdl hdl,
                                     std::shared_ptr<IPLimitToken> ip_token) {
    {
        std::scoped_lock lg(events_connections_mtx);  // ✅ ADDED: Thread-safe insertion
        events_connections.insert(hdl);
    }
    
    m_server.send(hdl, get_initial_state_info(),
                  websocketpp::frame::opcode::text);

    server::connection_ptr con = m_server.get_con_from_hdl(hdl);
    // ip_token is captured here so this address gets its connection slot back
    // when the socket goes; see on_open_signal() in websocket.cpp.
    con->set_close_handler([this, ip_token](connection_hdl h) {
        if (ip_token) ip_token->release();
        on_close_events(h);
    });
    con->set_message_handler([](connection_hdl, server::message_ptr) {
        // Ignore messages
    });
}

void broadcast_server::on_close_events(connection_hdl hdl) {
    std::scoped_lock lg(events_connections_mtx);  // ✅ ADDED: Thread-safe removal
    events_connections.erase(hdl);
}

void broadcast_server::set_event_timer() {
    m_timer = m_server.set_timer(1000, std::bind(&broadcast_server::on_timer,
                                                 this, std::placeholders::_1));
}

void broadcast_server::on_timer(websocketpp::lib::error_code const &ec) {
    if (ec) {
        // There was an error, stop sending control messages
        m_server.get_alog().write(websocketpp::log::alevel::app,
                                  "Timer Error: " + ec.message());
        return;
    }
    
    std::string info = get_event_info();
    // Broadcast to all event connections.
    // Snapshot the list under the lock so we never call m_server.send() while
    // holding events_connections_mtx — send can trigger a close handler on
    // another IO thread that calls on_close_events(), which also acquires the
    // same mutex, causing a deadlock.
    if (info.length() != 0) {
        std::vector<connection_hdl> snapshot;
        {
            std::scoped_lock lg(events_connections_mtx);
            snapshot.assign(events_connections.begin(), events_connections.end());
        }
        for (auto &hdl : snapshot) {
            try {
                m_server.send(hdl, info, websocketpp::frame::opcode::text);
            } catch (...) {
            }
        }
    }
    
    // Cleanup dead connections every 10 seconds
    static int cleanup_counter = 0;
    if (++cleanup_counter >= 10) {
        cleanup_counter = 0;
        cleanup_dead_connections();
    }

    // Write users.json on every tick (1 s) — cheap file write, always fresh.
    write_users_json();

    // Send info every second
    if (running) {
        set_event_timer();
    }
}