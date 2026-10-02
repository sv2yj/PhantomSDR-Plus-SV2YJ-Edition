#include "client.h"
#include "signal.h"
#include "spectrumserver.h"
#include "waterfall.h"
#include "chat.h"
#include "kiwi_bridge.h"
#include <algorithm>

#include "glaze/glaze.hpp"

#include <chrono>
#include <map>

// ---------------------------------------------------------------------------
// Adaptive throttling
//
// Browsers aggressively throttle background tabs (JS timers, rendering, and
// websocket message handling). When the client becomes a slow consumer,
// websocketpp's send buffer grows; if the server responds by *never sending*
// (i.e., `continue;` forever), the user experiences a "freeze".
//
// The strategy below is:
//  - Never enter an infinite starvation state.
//  - When buffered_amount rises, reduce send rate (drop intermediate frames).
//  - When buffered_amount falls, automatically ramp back up.
//
// This keeps audio/waterfall "alive" under background throttling, while still
// protecting server memory.
//
// IMPROVEMENTS:
//  - More granular buffer thresholds for smoother degradation
//  - Separate tuning for audio (needs tighter timing) vs waterfall
//  - Lower base intervals to maintain better continuity
// ---------------------------------------------------------------------------

namespace {
using clock_t = std::chrono::steady_clock;

struct throttle_state {
    uint64_t last_frame_sent = 0;                 // last frame_num we sent
    clock_t::time_point last_send_time = {};      // last time we sent
};

// Use owner_less so connection_hdl can be map key safely.
using throttle_map_t = std::map<connection_hdl, throttle_state, std::owner_less<connection_hdl>>;

// Separate state for audio and waterfall (different thresholds).
throttle_map_t g_audio_throttle;
throttle_map_t g_waterfall_throttle;
// Mutexes protecting the throttle maps — accessed from signal/waterfall loops
// AND from close handlers which may run on a different io thread.
std::mutex g_audio_throttle_mtx;
std::mutex g_waterfall_throttle_mtx;

// Decide whether to send this frame given the current buffered amount.
// Returns true if we should send now.
inline bool should_send_adaptive(throttle_state &st,
                                const size_t buffered_amount,
                                const uint64_t frame_num,
                                const int base_fps_cap,
                                const bool is_audio = false) {
    // base_fps_cap is interpreted as a *minimum* cadence guard in ms when
    // we are under pressure (acts like a token bucket).
    // In normal operation, we send every frame.

    // Map buffer pressure -> frame skipping and minimum interval.
    // These values are conservative and meant to avoid starvation.
    // Audio uses tighter thresholds to prevent audible gaps.
    int skip_mod = 1;
    int min_interval_ms = 0;

    if (is_audio) {
        // AUDIO: More aggressive early intervention to prevent buffer buildup
        // Lower thresholds, gentler skipping to maintain continuity
        if (buffered_amount > 500000) {          // severe pressure
            skip_mod = 20;
            min_interval_ms = base_fps_cap * 5;
        } else if (buffered_amount > 300000) {   // high pressure
            skip_mod = 10;
            min_interval_ms = base_fps_cap * 4;
        } else if (buffered_amount > 150000) {   // moderate pressure
            skip_mod = 5;
            min_interval_ms = base_fps_cap * 3;
        } else if (buffered_amount > 75000) {    // light pressure
            skip_mod = 3;
            min_interval_ms = base_fps_cap * 2;
        } else if (buffered_amount > 30000) {    // early warning
            skip_mod = 2;
            min_interval_ms = base_fps_cap;
        }
    } else {
        // WATERFALL: Can tolerate more aggressive skipping
        // Higher thresholds, more aggressive skipping (visual continuity less critical)
        if (buffered_amount > 700000) {          // very slow client
            skip_mod = 30;
            min_interval_ms = base_fps_cap * 6;
        } else if (buffered_amount > 400000) {
            skip_mod = 15;
            min_interval_ms = base_fps_cap * 4;
        } else if (buffered_amount > 200000) {
            skip_mod = 8;
            min_interval_ms = base_fps_cap * 3;
        } else if (buffered_amount > 100000) {
            skip_mod = 4;
            min_interval_ms = base_fps_cap * 2;
        } else if (buffered_amount > 50000) {
            skip_mod = 2;
            min_interval_ms = base_fps_cap;
        }
    }

    // If no pressure: send.
    if (skip_mod == 1 && min_interval_ms == 0) {
        return true;
    }

    // Skip intermediate frames by modulo.
    if ((frame_num % static_cast<uint64_t>(skip_mod)) != 0) {
        return false;
    }

    // Also enforce a minimum time interval when under pressure.
    const auto now = clock_t::now();
    if (min_interval_ms > 0) {
        if (st.last_send_time.time_since_epoch().count() != 0) {
            const auto elapsed = std::chrono::duration_cast<std::chrono::milliseconds>(now - st.last_send_time).count();
            if (elapsed < min_interval_ms) {
                return false;
            }
        }
    }

    st.last_send_time = now;
    st.last_frame_sent = frame_num;
    return true;
}
} // namespace

void broadcast_server::send_basic_info(connection_hdl hdl,
                                       const std::string &client_id) {

    // Example format:
    // "{\"sps\":1000000,\"fft_size\":65536,\"clientid\":\"123\",\"basefreq\":123}";
    // Craft a JSON string for the client

    std::string grid_locator = config["websdr"]["grid_locator"].value_or("-");
    std::optional<int> offset_smeter = config["input"]["smeter_offset"].value<int>();
    int offset_smeter_value = offset_smeter.value_or(0);

    std::optional<int> analog_offset_smeter = config["input"]["analog_smeter_offset"].value<int>();
    int analog_offset_smeter_value = analog_offset_smeter.value_or(0);

    glz::json_t json = {
        {"sps", sps},
        {"audio_max_sps", audio_max_sps},
        {"audio_max_fft", audio_max_fft_size},
        {"fft_size", fft_size},
        {"fft_result_size", fft_result_size},
        {"waterfall_size", min_waterfall_fft},
        {"basefreq", basefreq},
        {"total_bandwidth", is_real ? sps / 2 : sps},
        {"defaults",
         {{"frequency", default_frequency},
          {"modulation", default_mode_str},
          {"l", default_l},
          {"m", default_m},
          {"r", default_r}}},
        {"waterfall_compression", waterfall_compression_str},
        {"audio_compression", audio_compression_str},
        {"grid_locator", grid_locator},
        {"smeter_offset", offset_smeter_value},
        {"analog_smeter_offset", analog_offset_smeter_value},
        {"markers", [&]() {
            std::shared_lock lk(markers_mutex);  // protect against concurrent write by marker_update_thread
            return markers.dump();
        }()}
    };

    // The client's own signal-protocol UUID.  This is the SAME id used as the
    // key in /users and in the events-socket signal_changes map, so the browser
    // can identify its own waterfall pill exactly — instead of guessing "me" by
    // frequency proximity, which mislabels users who share a frequency.
    // Empty for the waterfall socket (no AudioClient), so only emit when set.
    if (!client_id.empty()) {
        json["client_id"] = client_id;
    }

    m_server.send(hdl, glz::write_json(json), websocketpp::frame::opcode::text);
}

// PacketSender---------------------------------------------------------------

void broadcast_server::init_server() {
    // Suppress all access logs
    m_server.clear_access_channels(websocketpp::log::alevel::all);

    // Suppress all error logs
    m_server.clear_error_channels(websocketpp::log::elevel::all);

    // IMPORTANT: do NOT re-enable fatal logs
    // Either delete this line:
    // m_server.set_error_channels(websocketpp::log::elevel::fatal);

    // Or explicitly set none:
    m_server.set_error_channels(websocketpp::log::elevel::none);

    // Your fail handler etc. can stay as-is
    m_server.set_fail_handler([this](connection_hdl hdl) {
        // A connection that dies before it ever makes a request reaches this
        // handler and nothing else — on_open and on_http never run for it, and
        // those are the only other places the idle bookkeeping is released.
        // Without this line its entry stays in pending_handshakes for the life
        // of the process, so every aborted page load, port scan or TCP probe
        // permanently spends one of that address's idle_per_ip slots until the
        // address can no longer connect at all. Harmless for a connection that
        // did make a request: handshake_watch_done() is a no-op the second
        // time.
        handshake_watch_done(hdl);

        try {
            auto con = m_server.get_con_from_hdl(hdl);
            auto ec  = con->get_ec();
            // Ignore typical EOF / transport errors (2, 7, etc.)
            if (ec.value() != 2 && ec.value() != 7) {
                // std::cerr << "Connection failed: " << ec.message() << std::endl;
            }
        } catch (...) {
        }
    });

    // Same reasoning for a connection closed cleanly before any per-connection
    // close handler was installed. A path handler that sets its own replaces
    // this one, and those paths have already released the entry in on_open.
    m_server.set_close_handler([this](connection_hdl hdl) {
        handshake_watch_done(hdl);
    });
    
    // Set custom interrupt handler to suppress EOF errors during close
    m_server.set_interrupt_handler([this](connection_hdl hdl) {
        try {
            auto con = m_server.get_con_from_hdl(hdl);
            // Silently close the connection
            websocketpp::lib::error_code ec;
            con->terminate(ec);
        } catch (...) {
            // Connection already gone
        }
    });
}

void broadcast_server::log(connection_hdl, const std::string &str) {
    m_server.get_alog().write(websocketpp::log::alevel::app, str);
}

std::string broadcast_server::ip_from_hdl(connection_hdl hdl) {
    auto con = m_server.get_con_from_hdl(hdl);

    // When the server is behind a VPN or reverse proxy (Nginx, etc.) the real
    // client IP is carried in X-Forwarded-For or X-Real-IP headers set by the
    // proxy. get_remote_endpoint() would return the proxy's IP in that case.
    //
    // X-Forwarded-For can contain a comma-separated chain of IPs when there
    // are multiple proxies — the first one is the original client.
    const std::string xff = con->get_request_header("X-Forwarded-For");
    if (!xff.empty()) {
        const auto comma = xff.find(',');
        std::string first = (comma != std::string::npos)
            ? xff.substr(0, comma)
            : xff;
        const auto start = first.find_first_not_of(" \t");
        const auto end   = first.find_last_not_of(" \t");
        if (start != std::string::npos)
            return first.substr(start, end - start + 1);
    }

    const std::string xri = con->get_request_header("X-Real-IP");
    if (!xri.empty()) {
        const auto start = xri.find_first_not_of(" \t");
        const auto end   = xri.find_last_not_of(" \t");
        if (start != std::string::npos)
            return xri.substr(start, end - start + 1);
    }

    // No proxy headers — direct connection, use the TCP endpoint.
    return con->get_remote_endpoint();
}

// ── Per-IP connection limiting ───────────────────────────────────────────────
// Motivation and the meaning of each knob are in spectrumserver.h. In short:
// on 2026-09-16 a single address opened 134 listener sessions inside one
// minute and sat on 181 of them, and neither the cap nor the rate limit alone
// would have ended that — the cap stops it holding them, the rate limit stops
// it retrying forever.
//
// The table is keyed on normalize_client_ip() so that the two spellings of an
// IPv4 client (direct, and the "::ffff:" mapped form a dual-stack listener
// reports) cannot each get their own allowance. Entries outlive their sessions
// on purpose: the rate bucket and any ban have to survive a disconnect, or
// reconnecting would reset the very thing being measured.

// Beyond this many tracked addresses, prune the ones that carry no live
// session and no useful history. Without it an attacker spraying from many
// source addresses could grow the table without bound — trading the flood we
// just blocked for a slower memory one.
static constexpr size_t IP_LIMIT_TABLE_SOFT_MAX = 4096;

// At most one log line per address per this interval. See ip_limit_result.
static constexpr std::chrono::seconds IP_LIMIT_LOG_INTERVAL{5};

// WebSocket close code for a refused connection. 4000-4999 is the range
// reserved for private application use, so it cannot be confused with a
// protocol-level status. The browser must not auto-reconnect on this one —
// see _handleSocketTerminal() in frontend/src/audio.js.
static constexpr uint16_t CLOSE_IP_LIMIT = 4003;

// WebSocket close code for a listener the sysop kicked. It has to be distinct
// from an ordinary close: on a plain 1000/1006 the browser cannot tell a kick
// from a dropped connection, so audio.js reconnects and the kick undoes itself
// a second later — see KICKED_CLOSE_CODE in frontend/src/refused.js.
static constexpr uint16_t CLOSE_KICKED = 4001;

broadcast_server::ip_limit_result
broadcast_server::ip_limit_acquire(const std::string &ip, bool listener) {
    ip_limit_result res;
    const bool limits_off = limit_per_ip <= 0 && limit_per_ip_sockets <= 0 &&
                            limit_per_ip_rate <= 0;

    const auto now = std::chrono::steady_clock::now();
    std::lock_guard<std::mutex> lk(ip_limit_mtx);

    if (limits_off) {
        // The limits are disabled, but a kick still bans the address and that
        // ban has to hold — it is the only thing stopping the kicked browser
        // from reconnecting immediately. Nothing else is tracked in this case,
        // so an address with no entry is simply allowed.
        auto it = ip_limit_table.find(ip);
        if (it == ip_limit_table.end()) return res;
        if (it->second.banned_until <= now) {
            ip_limit_table.erase(it);
            return res;
        }
        res.allowed = false;
        res.reason  = "disconnected by the sysop";
        res.code    = CLOSE_KICKED;
        if (now - it->second.last_log >= IP_LIMIT_LOG_INTERVAL) {
            it->second.last_log = now;
            res.log_it = true;
        }
        return res;
    }

    if (ip_limit_table.size() > IP_LIMIT_TABLE_SOFT_MAX) {
        for (auto it = ip_limit_table.begin(); it != ip_limit_table.end();) {
            // Both counters must be clear. Dropping an entry that still has
            // sockets open would lose the count while the tokens holding them
            // are alive — an address could then push the table past the limit
            // on purpose, prune itself out, and come back with a fresh
            // allowance while keeping everything it already had.
            const bool idle  = it->second.active == 0 && it->second.sockets == 0;
            const bool free_ = it->second.banned_until <= now;
            // A bucket refills completely in a minute, so an entry idle for
            // longer than that holds nothing worth remembering.
            const bool stale = now - it->second.last_refill > std::chrono::seconds(60);
            if (idle && free_ && stale) it = ip_limit_table.erase(it);
            else ++it;
        }
    }

    auto &e = ip_limit_table[ip];
    if (e.last_refill.time_since_epoch().count() == 0) {
        // First sight of this address: a full bucket, so a normal listener is
        // never penalised for the connection that introduced them.
        e.last_refill = now;
        e.tokens      = limit_per_ip_rate > 0 ? limit_per_ip_rate : 0.0;
    }

    // Decide whether this refusal (if it is one) gets a log line, before any
    // branch below returns.
    auto mark_refused = [&](const char *why) {
        res.allowed = false;
        res.reason  = why;
        if (now - e.last_log >= IP_LIMIT_LOG_INTERVAL) {
            e.last_log = now;
            res.log_it = true;
        }
    };

    if (e.banned_until > now) {
        if (e.kick_ban) {
            mark_refused("disconnected by the sysop");
            res.code = CLOSE_KICKED;
        } else {
            mark_refused("too many connection attempts");
        }
        return res;
    }

    // The rate is charged BEFORE the simultaneous cap is tested, and this
    // order matters. An address that is already at its cap and reconnects in a
    // loop must still accumulate rate violations — otherwise the cheap "you
    // are at the cap" refusal would answer it forever and the ban that ends
    // the loop would never trigger.
    if (limit_per_ip_rate > 0) {
        const double elapsed =
            std::chrono::duration<double>(now - e.last_refill).count();
        e.last_refill = now;
        e.tokens = std::min<double>(limit_per_ip_rate,
                                    e.tokens + elapsed * limit_per_ip_rate / 60.0);
        if (e.tokens < 1.0) {
            e.banned_until = now + std::chrono::seconds(limit_per_ip_ban_s);
            e.kick_ban     = false;
            mark_refused("too many connection attempts");
            return res;
        }
        e.tokens -= 1.0;
    }

    if (listener && limit_per_ip > 0 && e.active >= limit_per_ip) {
        mark_refused("too many simultaneous connections");
        return res;
    }

    if (limit_per_ip_sockets > 0 && e.sockets >= limit_per_ip_sockets) {
        mark_refused("too many simultaneous connections");
        return res;
    }

    e.sockets++;
    if (listener) e.active++;
    return res;
}

// Remembers one live WebSocket so kick_ip() can find it later. Expired handles
// are swept out here, so the map cannot grow without bound on a station where
// nobody is ever kicked.
void broadcast_server::live_conn_add(connection_hdl hdl, const std::string &ip) {
    std::lock_guard<std::mutex> lk(live_conns_mtx);
    if (live_conns.size() >= LIVE_CONNS_SWEEP_AT) {
        for (auto it = live_conns.begin(); it != live_conns.end();) {
            if (it->first.expired()) it = live_conns.erase(it);
            else ++it;
        }
    }
    live_conns[hdl] = ip;
}

// Disconnects an address and bans it for `ban_s` seconds.
//
// Closing the sockets alone is not a kick: every page reconnects after a drop
// (audio.js does it deliberately, to survive a change of network), so without
// the ban the listener is back before the sysop has let go of the mouse. The
// ban is what makes it stick, and CLOSE_KICKED is what tells the browser not
// to try in the first place.
size_t broadcast_server::kick_ip(const std::string &ip_raw, int ban_s) {
    const std::string ip = normalize_client_ip(ip_raw);
    // Loopback is the station itself: proxy.py, the admin panel, the autorun
    // PCM tap. Kicking it would disconnect the sysop's own tooling, and on a
    // proxied station it would mean every listener at once.
    if (ip.empty() || is_loopback_ip(ip)) return 0;

    if (ban_s > 0) {
        const auto now = std::chrono::steady_clock::now();
        std::lock_guard<std::mutex> lk(ip_limit_mtx);
        auto &e = ip_limit_table[ip];
        if (e.last_refill.time_since_epoch().count() == 0) {
            e.last_refill = now;
            e.tokens      = limit_per_ip_rate > 0 ? limit_per_ip_rate : 0.0;
        }
        e.banned_until = now + std::chrono::seconds(ban_s);
        e.kick_ban     = true;
    }

    std::vector<connection_hdl> victims;
    {
        std::lock_guard<std::mutex> lk(live_conns_mtx);
        for (auto it = live_conns.begin(); it != live_conns.end();) {
            if (it->first.expired()) { it = live_conns.erase(it); continue; }
            if (it->second == ip) victims.push_back(it->first);
            ++it;
        }
    }

    size_t closed = 0;
    for (const auto &hdl : victims) {
        websocketpp::lib::error_code ec;
        m_server.close(hdl, CLOSE_KICKED, "disconnected by the sysop", ec);
        if (!ec) closed++;
    }
    if (closed || ban_s > 0)
        std::cout << "Kicked " << ip << ": " << closed << " socket(s) closed, "
                  << "refused for " << ban_s << "s" << std::endl;
    return closed;
}

void broadcast_server::ip_limit_release(const std::string &ip, bool listener) {
    std::lock_guard<std::mutex> lk(ip_limit_mtx);
    auto it = ip_limit_table.find(ip);
    if (it == ip_limit_table.end()) return;
    // The entry itself stays: erasing it here would hand a reconnecting
    // attacker a fresh rate bucket every time a connection ended.
    if (it->second.sockets > 0) it->second.sockets--;
    if (listener && it->second.active > 0) it->second.active--;
}

// ── Idle (pre-request) connections ───────────────────────────────────────────
// See spectrumserver.h: the limit is on how many idle connections an address
// may hold and never on how long one may live, because websdr.org's callback
// host legitimately holds one idle for longer than any deadline worth setting.

bool broadcast_server::handshake_watch_begin(connection_hdl hdl,
                                             const std::string &ip) {
    if (limit_idle_per_ip <= 0 && limit_idle_total <= 0)
        return true; // nothing to enforce

    std::lock_guard<std::mutex> lk(pending_handshakes_mtx);

    if (limit_idle_total > 0 &&
        static_cast<int>(pending_handshakes.size()) >= limit_idle_total) {
        return false;
    }
    if (limit_idle_per_ip > 0) {
        auto it = pending_by_ip.find(ip);
        if (it != pending_by_ip.end() && it->second >= limit_idle_per_ip)
            return false;
    }

    pending_handshakes[hdl] = ip;
    pending_by_ip[ip]++;
    return true;
}

void broadcast_server::handshake_watch_done(connection_hdl hdl) {
    std::lock_guard<std::mutex> lk(pending_handshakes_mtx);
    auto it = pending_handshakes.find(hdl);
    if (it == pending_handshakes.end()) return;
    auto cit = pending_by_ip.find(it->second);
    if (cit != pending_by_ip.end() && --cit->second <= 0)
        pending_by_ip.erase(cit);
    pending_handshakes.erase(it);
}

void IPLimitToken::release() {
    if (released.exchange(true)) return;
    server.ip_limit_release(ip, listener);
}

waterfall_slices_t &broadcast_server::get_waterfall_slices() {
    return waterfall_slices;
}

waterfall_mutexes_t &broadcast_server::get_waterfall_slice_mtx() {
    return waterfall_slice_mtx;
}

signal_slices_t &broadcast_server::get_signal_slices() { 
    return signal_slices; 
}

std::mutex &broadcast_server::get_signal_slice_mtx() {
    return signal_slice_mtx;
}

void broadcast_server::on_message(connection_hdl, server::message_ptr msg,
                                  std::shared_ptr<Client> &client) {

    // Limit the amount of data received
    std::string payload = msg->get_payload().substr(0, 1024);
    // Isolate the handler: this runs on the websocketpp io_service thread, and
    // an exception escaping here propagates out of m_server.run() → std::terminate
    // → the ENTIRE server aborts, dropping every connected user on one bad
    // message (or a std::bad_alloc under memory pressure). Swallow per-message.
    try {
        client->on_message(payload);
    } catch (const std::exception &e) {
        m_server.get_alog().write(websocketpp::log::alevel::app,
                                  std::string("on_message handler threw: ") + e.what());
    } catch (...) {
        m_server.get_alog().write(websocketpp::log::alevel::app,
                                  "on_message handler threw unknown exception");
    }
}

void broadcast_server::on_open_signal(connection_hdl hdl,
                                      conn_type signal_type,
                                      std::shared_ptr<IPLimitToken> ip_token) {
    // Pre-generate the client's unique id so we can advertise it in basic_info
    // WITHOUT reordering: basic_info MUST be the very first frame the browser
    // receives on /audio (socketMessageInitial JSON.parse's the first message).
    // If we sent it after the AudioClient is inserted into signal_slices, an
    // audio frame from the FFT thread could race ahead of it — the browser then
    // JSON.parse()s a binary audio frame, tears down the socket, and there is
    // NO SOUND.  Sending basic_info first (as the original code did) guarantees
    // the browser gets settings before any audio.
    const std::string uid = generate_unique_id();
    send_basic_info(hdl, uid);

    int audio_fft_size = ceil((double)audio_max_sps * fft_size / sps / 4.) * 4;
    std::shared_ptr<AudioClient> client = std::make_shared<AudioClient>(
        hdl, *this, audio_compression, is_real, audio_fft_size, audio_max_sps,
        fft_result_size);
    // Override the constructor-generated id with the one we already advertised
    // so /users and the events-socket signal_changes agree with what the
    // browser was told in basic_info.
    client->unique_id = uid;

    // Is this the station's own PCM tap? Only a loopback client presenting the
    // secret token on /audio?tap=<token> counts. Everything else — including a
    // browser opened on the server itself — is a normal listener and keeps its
    // IP and "Local" label in /users and on the waterfall. Must be set before
    // the client is published (signal_slices insert / set_audio_range, which
    // broadcasts a signal change) so no reader ever sees the default.
    if (!tap_token.empty()) {
        server::connection_ptr tap_con = m_server.get_con_from_hdl(hdl);
        const std::string resource = tap_con->get_resource();
        const auto qpos = resource.find('?');
        if (qpos != std::string::npos &&
            is_loopback_ip(normalize_client_ip(ip_from_hdl(hdl)))) {
            std::string query = resource.substr(qpos + 1);
            size_t pos = 0;
            while (pos < query.size()) {
                const size_t amp = query.find('&', pos);
                const std::string part = query.substr(
                    pos, amp == std::string::npos ? std::string::npos
                                                  : amp - pos);
                if (part.rfind("tap=", 0) == 0) {
                    if (part.substr(4) == tap_token)
                        client->is_internal_tap.store(
                            true, std::memory_order_release);
                    break;
                }
                if (amp == std::string::npos) break;
                pos = amp + 1;
            }
        }
    }

    client->set_audio_demodulation(default_mode);
    {
        std::scoped_lock lg(signal_slice_mtx);
        auto it = signal_slices.insert({{0, 0}, client});
        client->it = it;
    }
    // Default slice
    client->set_audio_range(default_l, default_m, default_r);

    server::connection_ptr con = m_server.get_con_from_hdl(hdl);

    // ip_token is captured by both handlers below (and by nothing else), so the
    // per-IP slot is given back on whichever of close / fail fires first, and
    // at the latest when websocketpp destroys the handlers. Releasing it more
    // than once is harmless — see IPLimitToken.
    con->set_close_handler([client, ip_token](connection_hdl h) {
        // Clean up throttle state for this connection
        {
            std::lock_guard<std::mutex> tlk(g_audio_throttle_mtx);
            g_audio_throttle.erase(h);
        }
        if (ip_token) ip_token->release();
        // AudioClient::on_close() takes no arguments
        try { client->on_close(); } catch (...) {}
    });

    // FIX: Register a per-connection fail handler so ungraceful disconnects
    // (browser tab closed, network drop, TCP reset) also trigger on_close()
    // and get logged.  The global fail handler in init_server() never had
    // access to the per-client shared_ptr so it couldn't call on_close().
    // on_close() is guarded by an atomic<bool> so double-fire (close + fail)
    // is safe — only the first call does anything.
    con->set_fail_handler([client, ip_token](connection_hdl h) {
        {
            std::lock_guard<std::mutex> tlk(g_audio_throttle_mtx);
            g_audio_throttle.erase(h);
        }
        if (ip_token) ip_token->release();
        try { client->on_close(); } catch (...) {}
    });
    con->set_message_handler(std::bind(
        &broadcast_server::on_message, this, std::placeholders::_1,
        std::placeholders::_2, std::static_pointer_cast<Client>(client)));
}

void broadcast_server::on_open_chat(connection_hdl hdl,
                                    std::shared_ptr<IPLimitToken> ip_token) {
    std::shared_ptr<ChatClient> client = std::make_shared<ChatClient>(hdl, *this);
    server::connection_ptr con = m_server.get_con_from_hdl(hdl);
    // See on_open_signal() for why ip_token is captured here.
    con->set_close_handler([client, ip_token](connection_hdl h) {
        if (ip_token) ip_token->release();
        client->on_close_chat(h);
    });
    con->set_message_handler(std::bind(
        &broadcast_server::on_message, this, std::placeholders::_1,
        std::placeholders::_2, std::static_pointer_cast<Client>(client)));
}

// Iterates through the client list to send the slices
std::vector<std::future<void>> broadcast_server::signal_loop() {
    int base_idx = 0;
    if (!is_real) {
        base_idx = fft_size / 2 + 1;
    }
    std::scoped_lock lg(signal_slice_mtx);
    auto &io_service = m_server.get_io_service();

    // Completion futures
    std::vector<std::future<void>> futures;
    futures.reserve(signal_slices.size());

    // Send the apprioriate signal slice to the client
    for (auto &[slice, data] : signal_slices) {
        auto &[l_idx, r_idx] = slice;
        // Adaptive throttling for audio: never starve the client forever.
        // When buffered_amount rises (common in background tabs), reduce
        // send rate instead of hard-dropping everything.
        
        try {
            auto con = m_server.get_con_from_hdl(data->hdl);
            
            // Check connection state before sending
            if (!con || con->get_state() != websocketpp::session::state::open) {
                continue;
            }

            // FIX (dangling pointer): previously a pointer into g_audio_throttle
            // was taken under the lock and then used *after* the lock was released.
            // If the close handler ran in that window it would erase the entry,
            // making the pointer dangle.  Fix: hold the lock for the full call —
            // should_send_adaptive is pure arithmetic so the added hold time is
            // negligible.
            const size_t buffered = con->get_buffered_amount();
            bool do_send_audio;
            {
                std::lock_guard<std::mutex> tlk(g_audio_throttle_mtx);
                do_send_audio = should_send_adaptive(
                    g_audio_throttle[data->hdl], buffered,
                    static_cast<uint64_t>(frame_num), 20, true);
            }
            if (!do_send_audio) {
                continue;
            }

            // Equivalent to
            // data->send_audio(&fft_buffer[(l_idx + base_idx) % fft_result_size],
            // frame_num);
            // Boost 1.87 removed io_service::post(); the free function has
            // been the supported spelling since Boost 1.66.
            futures.emplace_back(boost::asio::post(
                io_service, boost::asio::use_future(std::bind(
                &AudioClient::send_audio, data,
                &fft_buffer[(l_idx + base_idx) % fft_result_size], frame_num))));
        } catch (...) {
            // Connection no longer valid, skip
            continue;
        }
    }
    return futures;
}

void broadcast_server::on_open_waterfall(connection_hdl hdl,
                                         std::shared_ptr<IPLimitToken> ip_token) {
    send_basic_info(hdl);

    // Set default to the entire spectrum
    std::shared_ptr<WaterfallClient> client = std::make_shared<WaterfallClient>(
        hdl, *this, waterfall_compression, min_waterfall_fft);
    {
        std::scoped_lock lk(waterfall_slice_mtx[0]);
        auto it = waterfall_slices[0].insert({{0, min_waterfall_fft}, client});
        client->it = it;
    }
    client->set_waterfall_range(downsample_levels - 1, 0, min_waterfall_fft);

    server::connection_ptr con = m_server.get_con_from_hdl(hdl);
    // See on_open_signal() for why ip_token is captured in both handlers.
    con->set_close_handler([client, ip_token](connection_hdl h) {
        // Clean up throttle state for this connection
        {
            std::lock_guard<std::mutex> tlk(g_waterfall_throttle_mtx);
            g_waterfall_throttle.erase(h);
        }
        if (ip_token) ip_token->release();
        try { client->on_close(); } catch (...) {}
    });
    // FIX (SIGSEGV): Register a per-connection fail handler so ungraceful
    // disconnects (network drop, TCP reset, browser tab close) also trigger
    // on_close().  Without this, cleanup_dead_connections() was the only
    // path that removed dead waterfall clients — but it erased the iterator
    // directly, bypassing the closed atomic guard, causing double-erase into
    // the rb-tree → _Rb_tree_rebalance_for_erase → SIGSEGV.
    // on_close() is guarded by atomic<bool> closed so close+fail double-fire
    // is safe — only the first call does anything.
    con->set_fail_handler([client, ip_token](connection_hdl h) {
        {
            std::lock_guard<std::mutex> tlk(g_waterfall_throttle_mtx);
            g_waterfall_throttle.erase(h);
        }
        if (ip_token) ip_token->release();
        try { client->on_close(); } catch (...) {}
    });
    con->set_message_handler(std::bind(
        &broadcast_server::on_message, this, std::placeholders::_1,
        std::placeholders::_2, std::static_pointer_cast<Client>(client)));
}

std::vector<std::future<void>>
broadcast_server::waterfall_loop(int8_t *fft_power_quantized, bool kiwi_only,
                                 double source_fps) {
    // FIX: was futures.reserve(signal_slices.size()) — wrong container.
    // Approximate the total waterfall client count across all downsample levels.
    // No lock required here; this is only a pre-allocation hint.
    std::vector<std::future<void>> futures;
    {
        size_t approx = 0;
        for (const auto &wf : waterfall_slices) approx += wf.size();
        futures.reserve(approx);
    }

    auto &io_service = m_server.get_io_service();
    for (int i = 0; i < downsample_levels; i++) {
        // Iterate over each waterfall client and send each slice
        std::scoped_lock lg(waterfall_slice_mtx[i]);
        for (auto &[slice, data] : waterfall_slices[i]) {
            auto &[l_idx, r_idx] = slice;

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

            // If the client is slow, avoid unnecessary buffering and
            // drop the packet - changed from 50000 to 100000
            
            try {
                auto con = m_server.get_con_from_hdl(data->hdl);
                
                // Check connection state before sending
                if (!con || con->get_state() != websocketpp::session::state::open) {
                    continue;
                }

                // FIX (dangling pointer): same race as audio throttle — hold the
                // lock for the full should_send_adaptive call.
                const size_t buffered = con->get_buffered_amount();
                bool do_send_wf;
                {
                    std::lock_guard<std::mutex> tlk(g_waterfall_throttle_mtx);
                    do_send_wf = should_send_adaptive(
                        g_waterfall_throttle[data->hdl], buffered,
                        static_cast<uint64_t>(frame_num), 40, false);
                }
                if (!do_send_wf) {
                    continue;
                }
                
                // Equivalent to
                // data->send_waterfall(&fft_power_quantized[l_idx],frame_num);
                futures.emplace_back(
                    boost::asio::post(io_service, boost::asio::use_future(
                        std::bind(&WaterfallClient::send_waterfall, data,
                                  &fft_power_quantized[l_idx], frame_num))));
            } catch (...) {
                // Connection no longer valid, skip
                continue;
            }
        }

        // Prevent overwrite of previous level's quantized waterfall
        fft_power_quantized += (fft_result_size >> i);
    }
    return futures;
}

void broadcast_server::on_open_unknown(connection_hdl hdl) {
    server::connection_ptr con = m_server.get_con_from_hdl(hdl);
    if (con) {
        con->set_close_handler([](connection_hdl) {}); // No-op
    }
    // Immediately close with a benign status
    websocketpp::lib::error_code ec;
    m_server.close(hdl, websocketpp::close::status::going_away, "", ec);
}

void broadcast_server::on_open(connection_hdl hdl) {
    // This connection made a request, so it is no longer a silent socket the
    // handshake deadline should reap.
    handshake_watch_done(hdl);

    server::connection_ptr con = m_server.get_con_from_hdl(hdl);
    // get_resource() includes any query string (e.g. "/audio?tap=abc"). Strip it
    // so routing below matches on the bare path.
    std::string resource = con->get_resource();
    std::string path = resource;
    {
        auto qpos = resource.find('?');
        if (qpos != std::string::npos)
            path = resource.substr(0, qpos);
    }

    // ── Per-IP connection limiting ──────────────────────────────────────
    // Only *listener* sessions are counted. One desktop tab opens /audio,
    // /waterfall, /events and /chat, so counting raw sockets would make a
    // single listener look like four and a limit of 3 would refuse everyone.
    // /audio is the unit that users.json, the waterfall labels and the user
    // count already treat as one listener; the Kiwi sound socket is the same
    // thing for a client speaking the Kiwi protocol.
    //
    // This runs before the socket options and the keepalive timer below so a
    // refused connection costs as little as possible — that is the whole point
    // when the caller is flooding.
    std::shared_ptr<IPLimitToken> ip_token;
    {
        const bool is_listener_path =
            (path == "/audio") ||
            (kiwi_emulation_enabled && is_kiwi_snd_path(path));
        const std::string ip = normalize_client_ip(ip_from_hdl(hdl));

        // ── Outdated page? Send it away so it reloads ────────────────────────
        // Only /audio carries the marker, and only /audio matters: it is the
        // socket a page keeps alive, so refusing it ends the session. See
        // min_client_version in spectrumserver.h for why this exists at all.
        if (min_client_version > 0 && path == "/audio" &&
            !is_loopback_ip(ip)) {
            int client_v = 0;
            const auto qpos = resource.find('?');
            if (qpos != std::string::npos) {
                std::string query = resource.substr(qpos + 1);
                size_t pos = 0;
                while (pos < query.size()) {
                    const size_t amp = query.find('&', pos);
                    const std::string part = query.substr(
                        pos, amp == std::string::npos ? std::string::npos
                                                      : amp - pos);
                    if (part.rfind("v=", 0) == 0) {
                        try { client_v = std::stoi(part.substr(2)); }
                        catch (...) { client_v = 0; }
                        break;
                    }
                    if (amp == std::string::npos) break;
                    pos = amp + 1;
                }
            }
            if (client_v < min_client_version) {
                std::cout << "Outdated client on /audio from " << ip
                          << " (v" << client_v << " < v" << min_client_version
                          << "), asked to reload" << std::endl;
                websocketpp::lib::error_code ec;
                m_server.close(hdl, CLOSE_IP_LIMIT,
                               "this page is out of date — please reload it",
                               ec);
                return;
            }
        }
        // Loopback is never limited. The autorun PCM tap, the admin panel and
        // a browser opened on the server itself all arrive from 127.0.0.1, and
        // letting them consume slots would mean the station's own decoders
        // could lock out real listeners.
        if (!is_loopback_ip(ip)) {
            const ip_limit_result verdict =
                ip_limit_acquire(ip, is_listener_path);
            if (!verdict.allowed) {
                if (verdict.log_it) {
                    // std::cout, not the websocketpp access log: that channel
                    // is switched off wholesale in init_server(), so anything
                    // written to it would be discarded. This reaches
                    // spectrumserver.log.
                    std::cout << "Refused " << path << " from " << ip << ": "
                              << verdict.reason << std::endl;
                }
                // Codes 4000-4999 are reserved for the application, so this
                // cannot collide with a protocol status. The reason travels in
                // the close frame and reaches the browser as
                // CloseEvent.reason: it is the only channel available, because
                // the first frame on /audio must be basic_info (see
                // send_basic_info) and an error frame ahead of it would break
                // the parse on every normal connection.
                websocketpp::lib::error_code ec;
                m_server.close(hdl, verdict.code, verdict.reason, ec);
                return;
            }
            // Held until the connection ends; see the handlers in
            // on_open_signal() and its siblings. For a path with no handlers
            // of its own (on_open_unknown) it dies with this scope, which is
            // exactly when that connection is closed anyway.
            ip_token = std::make_shared<IPLimitToken>(*this, ip,
                                                      is_listener_path);
            // Remember the socket so a kick can close it (see kick_ip).
            live_conn_add(hdl, ip);
        }
    }

    // NOTE: loopback connections are NOT rejected here.
    //
    // An earlier version closed every WebSocket whose source IP was 127.0.0.1 /
    // ::1, exempting only the internal PCM tap (/audio?tap=<token>). The goal was
    // to keep server-local connections out of users.json, the JSONL stats log and
    // the waterfall user labels — but events.cpp already does exactly that, on its
    // own, via is_loopback_ip(). The close was redundant for that purpose and had
    // two real costs:
    //
    //   • A browser on the server machine (http://localhost:<port>) got the page
    //     but no /waterfall, /audio or /events data — a permanently blank GUI.
    //
    //   • The filter's last resort was get_remote_endpoint(), the raw TCP peer.
    //     Behind a same-host reverse proxy (Nginx/Caddy with upstream
    //     127.0.0.1:<port> — the standard setup) that is loopback for EVERY
    //     client, so all real users were dropped no matter what X-Forwarded-For
    //     said. proxy.py had to dial the LAN IP purely to dodge this.
    //
    // Loopback clients are served normally now and remain invisible in stats and
    // on the waterfall, exactly as before. .tap_token is still generated and the
    // autorun tap still sends ?tap=<token>; it is simply no longer a gate.

    // Enable TCP keep-alive to detect dead connections
    try {
        auto socket_ptr = con->get_socket().lowest_layer().native_handle();
        
        #ifdef _WIN32
        // Windows
        DWORD keepalive = 1;
        setsockopt(socket_ptr, SOL_SOCKET, SO_KEEPALIVE, 
                   (const char*)&keepalive, sizeof(keepalive));
        
        // Set keep-alive parameters
        tcp_keepalive keepalive_vals;
        keepalive_vals.onoff = 1;
        keepalive_vals.keepalivetime = 30000;  // 30 seconds
        keepalive_vals.keepaliveinterval = 10000;  // 10 seconds
        
        DWORD bytes_returned;
        WSAIoctl(socket_ptr, SIO_KEEPALIVE_VALS, &keepalive_vals, 
                 sizeof(keepalive_vals), NULL, 0, &bytes_returned, NULL, NULL);
        #else
        // Linux/Unix
        int keepalive = 1;
        setsockopt(socket_ptr, SOL_SOCKET, SO_KEEPALIVE, &keepalive, sizeof(keepalive));
        
        int keepidle = 30;  // 30 seconds before sending keepalive
        int keepintvl = 10; // 10 seconds between keepalive probes
        int keepcnt = 3;    // 3 failed probes before declaring dead
        
        setsockopt(socket_ptr, IPPROTO_TCP, TCP_KEEPIDLE, &keepidle, sizeof(keepidle));
        setsockopt(socket_ptr, IPPROTO_TCP, TCP_KEEPINTVL, &keepintvl, sizeof(keepintvl));
        setsockopt(socket_ptr, IPPROTO_TCP, TCP_KEEPCNT, &keepcnt, sizeof(keepcnt));
        #endif
    } catch (...) {
        // Ignore errors setting keep-alive
    }

    // Disable Nagle. Every socket this server owns carries a real-time stream
    // of frames well under one MSS -- a 1040-byte waterfall line, a 1034-byte
    // audio frame -- and Nagle holds a small segment back until the previous
    // one is acknowledged. Paired with the peer's delayed ACK that is up to
    // 40 ms of pure queueing delay added to a frame that was ready to leave,
    // and it lands hardest on exactly the traffic that cannot afford it. There
    // is nothing here for Nagle to coalesce: the frames are already whole
    // messages, produced one per FFT hop, so switching it off costs no extra
    // packets in the normal case.
    try {
        auto socket_ptr = con->get_socket().lowest_layer().native_handle();
        int nodelay = 1;
        #ifdef _WIN32
        setsockopt(socket_ptr, IPPROTO_TCP, TCP_NODELAY,
                   (const char *)&nodelay, sizeof(nodelay));
        #else
        setsockopt(socket_ptr, IPPROTO_TCP, TCP_NODELAY, &nodelay,
                   sizeof(nodelay));
        #endif
    } catch (...) {
        // Ignore errors setting TCP_NODELAY
    }

    // Per-connection pong timeout (10s) to detect dead peers.
    try { con->set_pong_timeout(30000); } catch (...) {}

    // Start a lightweight keepalive ping loop to prevent idle/proxy drops.
    {
        auto& io = m_server.get_io_service();
        auto timer = std::make_shared<boost::asio::steady_timer>(io);
        std::weak_ptr<server::connection_type> weak = m_server.get_con_from_hdl(hdl);
        // FIX: Capturing a std::function by value into itself captures the
        // *not-yet-assigned* empty function — calling it is UB/crash on the
        // first timer tick.  Use a shared_ptr<function> so the lambda captures
        // a pointer to the function object rather than a copy of it.
        auto ping_fn = std::make_shared<std::function<void()>>();
        *ping_fn = [this, timer, weak, ping_fn]() {
            if (auto c = weak.lock()) {
                if (c->get_state() == websocketpp::session::state::open) {
                    try { c->ping("k"); } catch (...) {}
                }
                timer->expires_after(std::chrono::seconds(25));
                // Capture ping_fn by value so the shared_ptr keeps the
                // function alive for the duration of the timer.
                timer->async_wait([ping_fn](const boost::system::error_code& e){
                    if (!e) (*ping_fn)();
                });
            }
            // If the connection is gone we simply don't reschedule; the
            // shared_ptr chain unwinds and both timer and function are freed.
        };
        (*ping_fn)();
    }

    if (path == "/audio") {
        on_open_signal(hdl, AUDIO, ip_token);
    } else if (path == "/signal") {
        // on_open_signal(hdl, SIGNAL);
    } else if (path == "/waterfall") {
        on_open_waterfall(hdl, ip_token);
    } else if (path == "/waterfall_raw") {
        // on_open_waterfall_raw(hdl);
    } else if (path == "/events") {
        on_open_events(hdl, ip_token);
    } else if (path == "/chat") {
        on_open_chat(hdl, ip_token);
    } else if (kiwi_emulation_enabled && is_kiwi_snd_path(path)) {
        on_open_kiwi_snd(hdl, ip_token);
    } else if (kiwi_emulation_enabled && is_kiwi_wf_path(path)) {
        on_open_kiwi_wf(hdl, ip_token);
    } else {
        on_open_unknown(hdl);
    }
}

// ----------------------------------------------------------------------------
// Kiwi protocol bridge (leurre KiwiSDR) — voir kiwi_bridge.h
// ----------------------------------------------------------------------------

void broadcast_server::on_open_kiwi_snd(connection_hdl hdl,
                                        std::shared_ptr<IPLimitToken> ip_token) {
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
    // See on_open_signal() for why the token is captured in both handlers.
    con->set_close_handler([client, ip_token](connection_hdl) {
        if (ip_token) ip_token->release();
        try { client->on_close(); } catch (...) {}
    });
    con->set_fail_handler([client, ip_token](connection_hdl) {
        if (ip_token) ip_token->release();
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
                (double)basefreq + (double)sps / 4.0, (double)sps,
                (double)audio_max_sps);
        });
}

void broadcast_server::on_open_kiwi_wf(connection_hdl hdl,
                                       std::shared_ptr<IPLimitToken> ip_token) {
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

    // Deepest zoom at which every pixel of a 1024-bin W/F frame is still a
    // real FFT bin: our spectrum is fft_result_size bins wide and a Kiwi zoom
    // z shows fft_result_size >> z of them. Beyond this the encoder is
    // interpolating. Capped at 14, the deepest zoom the protocol defines.
    // See the long note in KiwiCommandParser::handle_wf_message.
    int kiwi_zoom_max = 0;
    for (int bins = fft_result_size;
         bins > (int)KiwiWfEncoder::kKiwiWfBins && kiwi_zoom_max < 14;
         bins /= 2) {
        kiwi_zoom_max++;
    }

    server::connection_ptr con = m_server.get_con_from_hdl(hdl);
    // See on_open_signal() for why ip_token is captured in both handlers.
    con->set_close_handler([client, ip_token](connection_hdl) {
        if (ip_token) ip_token->release();
        try { client->on_close(); } catch (...) {}
    });
    con->set_fail_handler([client, ip_token](connection_hdl) {
        if (ip_token) ip_token->release();
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
        [this, auth_acked_wf, retune_wf_cb, wf_speed_cb, kiwi_wf_max_fps,
         kiwi_zoom_max](connection_hdl h, server::message_ptr msg) {
            KiwiCommandParser::handle_wf_message(
                msg->get_payload(), *auth_acked_wf,
                [this, h](const std::string &s) {
                    send_binary_packet(h, s.data(), s.size());
                },
                retune_wf_cb, kiwi_wf_max_fps, kiwi_zoom_max, wf_speed_cb);
        });
}

void broadcast_server::send_text_packet(
    connection_hdl hdl, const std::initializer_list<std::string> &data) {
    
    try {
        auto con = m_server.get_con_from_hdl(hdl);
        
        // Check if connection exists and is open
        if (!con || con->get_state() != websocketpp::session::state::open) {
            return;
        }
        
        // Don't drop important control text packets too aggressively.
        // We allow moderate buffering so background tabs can recover.
        if (con->get_buffered_amount() > 2000000) {
            return;
        }

        auto total_size = std::accumulate(
            data.begin(), data.end(), size_t{0},
            [](size_t acc, const std::string &str) { return acc + str.size(); });
        
        auto msg_ptr = con->get_message(websocketpp::frame::opcode::text, total_size);
        for (auto &str : data) {
            msg_ptr->append_payload(str);
        }
        
        websocketpp::lib::error_code ec;
        ec = con->send(msg_ptr);
        
        // Silently ignore send errors (connection likely dead)
        if (ec) {
            // Connection is broken, will be cleaned up by close handler
            return;
        }
    } catch (const websocketpp::exception& e) {
        // Connection no longer valid
    } catch (const std::exception& e) {
        // Other error
    } catch (...) {
        // Unknown error
    }
}

void broadcast_server::send_binary_packet(
    connection_hdl hdl,
    const std::initializer_list<std::pair<const void *, size_t>> &bufs) {
    
    try {
        auto con = m_server.get_con_from_hdl(hdl);
        
        // Check if connection exists and is open
        if (!con || con->get_state() != websocketpp::session::state::open) {
            return;
        }
        
        // Binary packets can be large; allow some buffering but cap runaway.
        if (con->get_buffered_amount() > 2000000) {
            return;
        }

        auto total_size =
            std::accumulate(bufs.begin(), bufs.end(), size_t{0},
                            [](size_t acc, auto &p) { return acc + p.second; });
        
        auto msg_ptr = con->get_message(websocketpp::frame::opcode::binary, total_size);
        for (auto &bp : bufs) {
            msg_ptr->append_payload(bp.first, bp.second);
        }
        
        websocketpp::lib::error_code ec;
        ec = con->send(msg_ptr);
        
        // Silently ignore send errors
        if (ec) {
            return;
        }
    } catch (const websocketpp::exception& e) {
        // Connection no longer valid
    } catch (const std::exception& e) {
        // Other error
    } catch (...) {
        // Unknown error
    }
}

// --- Wrapper overloads to satisfy existing virtual interface ---
void broadcast_server::send_text_packet(connection_hdl hdl, const std::string &str) {
    this->send_text_packet(hdl, {str});
}

void broadcast_server::send_binary_packet(connection_hdl hdl, const void *buf, size_t len) {
    this->send_binary_packet(hdl, {{buf, len}});
}