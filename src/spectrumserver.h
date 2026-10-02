#ifndef SPECTRUMSERVER_H
#define SPECTRUMSERVER_H

#include <chrono>
#include <deque>
#include <map>
#include <memory>
#include <mutex>
#include <shared_mutex>
#include <string>
#include <unordered_map>
#include <vector>

#include <toml++/toml.h>

#include "client.h"
#include "fft.h"
#include "samplereader.h"
#include "signal.h"
#include "waterfall.h"
#include "websocket.h"
#include "chat.h"

using websocketpp::connection_hdl;

extern toml::table config;
extern nlohmann::json markers;
// FIX: Shared mutex protecting `markers` — use shared_lock to read, unique_lock to write
extern std::shared_mutex markers_mutex;

typedef std::set<connection_hdl, std::owner_less<connection_hdl>>
    event_con_list;

// WebSDR.org registration shared state
// Written once by update_websdr_org(), read by the /~~orgstatus HTTP handler.
struct WebsdrOrgState {
    bool enabled = false;
    uint32_t cfg_serial = 0;
    std::string cookie_id;
    std::string email_obf;
    std::string qth;
    std::string description;
    std::string logo;
    struct Band { double center_khz, bw_khz; std::string label; };
    std::vector<Band> bands;
};

// Holds one per-IP listener slot for as long as a session is open.
// Defined below the server class; see IPLimitToken.
class IPLimitToken;

class broadcast_server : public PacketSender {
  public:
    broadcast_server(std::unique_ptr<SampleConverterBase> reader,
                     toml::parse_result &config);
    void run(uint16_t port);
    void stop();

    // Initialize server logging configuration
    void init_server();

    size_t get_events_connections_size() {
        return events_connections.size();
    }

    // Websocket handlers
    void on_open(connection_hdl hdl);
    void on_open_unknown(connection_hdl hdl);
    void send_basic_info(connection_hdl hdl, const std::string &client_id = "");
    void on_message(connection_hdl hdl, server::message_ptr msg,
                    std::shared_ptr<Client> &d);
    void on_close(connection_hdl hdl);
    void on_http(connection_hdl hdl);

    //Chat
    void on_open_chat(connection_hdl hdl,
                      std::shared_ptr<IPLimitToken> ip_token = nullptr);
    void on_close_chat(connection_hdl hdl);

    // Events socket
    std::string get_event_info();
    std::string get_initial_state_info();
    std::string get_users_json();   // real-time user list as JSON
    // Listener count: one per /audio connection, loopback and closing clients
    // excluded.  This is the count that includes /mobile clients, which open
    // /audio but no /waterfall and no /events socket.
    size_t      count_listeners();
    void        write_users_json(); // atomically writes users.json to docroot
    void        append_user_log(const std::string &event,
                                const std::string &unique_id,
                                int l, double audio_mid, int r); // JSONL statistics log
    void on_open_events(connection_hdl hdl,
                        std::shared_ptr<IPLimitToken> ip_token = nullptr);
    void on_message_control(connection_hdl hdl);
    void on_close_events(connection_hdl hdl);
    void set_event_timer();
    void on_timer(websocketpp::lib::error_code const &ec);
    void update_statistics();

    // Connection cleanup
    void cleanup_dead_connections();

    // Main FFT loop to process input samples
    void fft_task();

    // SDR List - http://sdr-list.xyz
    void update_websdr_list();
    void start_websdr_updates();  // FIXED: Added method to manage websdr thread

    // WebSDR.org registration
    void update_websdr_org();

    // Signal functions, audio demodulation
    // ip_token holds this session's per-IP slot; it is kept alive by the
    // connection's close/fail handlers and released when the first of them
    // fires. Null means the session is not counted (loopback, or the limit
    // is switched off).
    void on_open_signal(connection_hdl hdl, conn_type signal_type,
                        std::shared_ptr<IPLimitToken> ip_token = nullptr);

    // Kiwi protocol bridge (leurre KiwiSDR)
    void on_open_kiwi_snd(connection_hdl hdl,
                          std::shared_ptr<IPLimitToken> ip_token = nullptr);
    void on_open_kiwi_wf(connection_hdl hdl,
                         std::shared_ptr<IPLimitToken> ip_token = nullptr);
    void on_close_signal(connection_hdl hdl, std::shared_ptr<AudioClient> &d);
    std::vector<std::future<void>> signal_loop();

    // Waterfall functions
    void on_open_waterfall(connection_hdl hdl,
                           std::shared_ptr<IPLimitToken> ip_token = nullptr);
    void on_close_waterfall(connection_hdl hdl,
                            std::shared_ptr<WaterfallClient> &d);
    std::vector<std::future<void>> waterfall_loop(int8_t *fft_power_quantized,
                                                  bool kiwi_only,
                                                  double source_fps);

    virtual void send_binary_packet(
        connection_hdl hdl,
        const std::initializer_list<std::pair<const void *, size_t>> &bufs);
    virtual void send_binary_packet(connection_hdl hdl, const void *data,
                                    size_t size);
    virtual void
    send_text_packet(connection_hdl hdl,
                     const std::initializer_list<std::string> &data);
    virtual void send_text_packet(connection_hdl hdl, const std::string &data);
    virtual std::string ip_from_hdl(connection_hdl hdl);
    virtual void log(connection_hdl hdl, const std::string &msg);

    virtual waterfall_slices_t &get_waterfall_slices();
    virtual waterfall_mutexes_t &get_waterfall_slice_mtx();
    virtual signal_slices_t &get_signal_slices();
    virtual std::mutex &get_signal_slice_mtx();

    virtual void broadcast_signal_changes(const std::string &unique_id, int l,
                                          double m, int r,
                                          const std::string &ip = "",
                                          bool internal_tap = false);

  private:
    std::unique_ptr<FFT> fft;
    std::unique_ptr<SampleConverterBase> reader;
    server m_server;
    server::timer_ptr m_timer;

    // Server parameters
    int fft_size;
    int fft_result_size;
    int sps;
    int64_t basefreq;
    int min_waterfall_fft;
    bool is_real;
    int downsample_levels;
    int audio_max_sps;
    int audio_fft_size;
    int audio_max_fft_size;
    int brightness_offset;
    int fft_threads;
    std::string input_format;
    std::string m_docroot;
    // Secret token gating the internal PCM-tap loopback exemption. Generated at
    // startup, written to ./.tap_token (mode 600). A loopback client (the
    // autorun spot daemon) must present it as ?tap=<token> on /audio; every
    // other loopback connection is still closed. See on_open in websocket.cpp.
    std::string tap_token;
    std::atomic<bool> running{false};
    bool show_other_users;
    bool kiwi_emulation_enabled;
    int server_threads;
    int frame_num;
    waterfall_compressor waterfall_compression;
    std::string waterfall_compression_str;
    audio_compressor audio_compression;
    std::string audio_compression_str;

    // Default parameters
    int64_t default_frequency;
    double default_m;
    int default_l;
    int default_r;
    std::string default_mode_str;
    demodulation_mode default_mode;

    // [limits] audio/waterfall/events are NOT held here. audio is read straight
    // from the config where it is used, as max_users on the /users endpoint;
    // waterfall and events are accepted for compatibility with upstream
    // configs and have never been enforced. Members for them existed, were
    // assigned at startup and read by nothing.

    // ── Per-IP connection limiting ──────────────────────────────────────────
    // Guards against a single host opening listener sessions in a loop, which
    // is what happened on 2026-09-16: one address held 181 simultaneous
    // sessions after opening 134 of them inside one minute.
    //
    // limit_per_ip        — simultaneous listener sessions allowed per address.
    //                       A listener session is one /audio (or Kiwi sound)
    //                       connection: the unit users.json already counts.
    // limit_per_ip_sockets— simultaneous WebSockets of ANY path per address.
    //                       Needed because /audio is not the only stream worth
    //                       flooding — /waterfall is the heaviest one on the
    //                       server, and a cap that only counted listeners
    //                       would simply move the attack one path across.
    //                       A desktop tab opens four sockets (audio,
    //                       waterfall, events, chat) and a phone two, so this
    //                       has to be several times limit_per_ip; it is
    //                       derived from it when left unset.
    // limit_per_ip_rate   — NEW sockets per minute allowed per address. A cap
    //                       on its own does not stop a flood: refusing a
    //                       connection is cheap but not free, and an attacker
    //                       can still burn CPU reconnecting as fast as the
    //                       refusals come back. This is what actually ends it.
    // limit_per_ip_ban_s  — how long an address that breaks the rate stays
    //                       refused at the door.
    // Any of them set to 0 disables that check, which is the default, so an
    // existing config.toml behaves exactly as before.
    int limit_per_ip;
    int limit_per_ip_sockets;
    int limit_per_ip_rate;
    int limit_per_ip_ban_s;

    // ── Idle (pre-request) connections ──────────────────────────────────────
    // A peer that opens a socket and says nothing is invisible to everything
    // above: it never reaches on_open or on_http, so no per-IP limit and no
    // client object exists for it, and holding thousands open costs the
    // attacker almost nothing.
    //
    // What separates that from a legitimate peer is QUANTITY, not patience, so
    // the limit is on how MANY idle connections an address may hold and never
    // on how long one may live. There was a deadline here once and it had to
    // go: websdr.org's callback host connects back and then sits idle for well
    // over 30 s before sending GET /~~orgstatus, so any deadline short enough
    // to bother an attacker cut that callback every time. It is also what the
    // 10-minute websocketpp open_handshake_timeout in run() is really for —
    // do not shorten that either.
    //
    // limit_idle_per_ip — idle connections allowed per address. One is normal
    //                     (websdr.org holds exactly one); a browser's are idle
    //                     only between connect and request.
    // limit_idle_total  — ceiling across all addresses, so a flood spread over
    //                     many source addresses is still bounded. Over it, new
    //                     idle connections are refused rather than existing
    //                     ones evicted, so an established legitimate one — the
    //                     websdr.org callback above all — is never the thing
    //                     that gets dropped.
    // Loopback is never counted: proxy.py reaches the server from 127.0.0.1,
    // so every proxied listener would otherwise share one address's allowance.
    int limit_idle_per_ip;
    int limit_idle_total;

    // ── Minimum frontend build allowed on /audio ────────────────────────────
    // A browser tab keeps the JavaScript it loaded until someone reloads it,
    // so a page opened before a frontend change goes on behaving the old way
    // no matter what the server does. The only lever left is the door: pages
    // announce their build as /audio?v=N (CLIENT_VERSION in
    // frontend/src/clientVersion.js) and anything below this is refused with
    // CLOSE_IP_LIMIT, which every build since the per-IP work treats as final.
    // The listener's page stops, they reload, and they are current.
    //
    // 0 disables the check, which is the default: a station whose listeners
    // are all current has nothing to enforce. Loopback and the Kiwi paths are
    // never checked — the station's own taps and Kiwi clients do not carry it.
    int min_client_version;

    // Connections accepted but not yet seen by a handler, and how many each
    // address holds. Nothing ages them out: an entry leaves when the
    // connection makes a request or dies, never on a clock.
    std::map<connection_hdl, std::string, std::owner_less<connection_hdl>>
        pending_handshakes;
    std::map<std::string, int> pending_by_ip;
    std::mutex pending_handshakes_mtx;

    // Returns false if this connection must be closed on the spot.
    bool handshake_watch_begin(connection_hdl hdl, const std::string &ip);
    void handshake_watch_done(connection_hdl hdl);

    struct ip_limit_entry {
        int    active  = 0;  // listener sessions currently open
        int    sockets = 0;  // WebSockets of any path currently open
        double tokens  = 0;  // token bucket for the new-connection rate
        std::chrono::steady_clock::time_point last_refill{};
        std::chrono::steady_clock::time_point banned_until{};
        std::chrono::steady_clock::time_point last_log{};
        // True when banned_until came from a sysop kick rather than from the
        // connection rate. It only changes what the listener is told and which
        // close code they get; the refusal itself is the same.
        bool kick_ban = false;
    };
    std::map<std::string, ip_limit_entry> ip_limit_table;
    std::mutex ip_limit_mtx;

    // ── Live WebSockets, for the sysop kick ─────────────────────────────────
    // A kick has to close the sockets a listener already holds AND keep them
    // from walking straight back in. The ban above does the second half; this
    // map does the first, because websocketpp offers no way to enumerate the
    // connections it is serving. Loopback is never registered: it can never be
    // kicked (see kick_ip), and the station's own taps would only bloat it.
    //
    // Entries are not removed when a connection ends — every path has its own
    // close handler and hooking all of them would be one more thing to forget.
    // The handles are weak, so a dead one is recognisable, and both kick_ip()
    // and live_conn_add() drop the expired ones as they go.
    std::map<connection_hdl, std::string, std::owner_less<connection_hdl>>
        live_conns;
    std::mutex live_conns_mtx;
    static constexpr size_t LIVE_CONNS_SWEEP_AT = 1024;
    void live_conn_add(connection_hdl hdl, const std::string &ip);
    // Tracks which clients wants which signal
    // Maintains a sorted list of signal slice mapped to the connection
    std::multimap<std::pair<int, int>, std::shared_ptr<AudioClient>>
        signal_slices;
    std::mutex signal_slice_mtx;

    // Tracks which part of the waterfall the clients are requesting
    // Maintains a tiered list based on downsampling rate of waterfall slices to
    // the connection
    std::vector<
        std::multimap<std::pair<int, int>, std::shared_ptr<WaterfallClient>>>
        waterfall_slices;
    std::deque<std::mutex> waterfall_slice_mtx;

    event_con_list events_connections;
    std::mutex events_connections_mtx;  // Mutex for thread-safe access to events_connections
    
    std::unordered_map<std::string, std::tuple<int, double, int>>
        signal_changes;
    std::mutex signal_changes_mtx;

    // FFT output to send to clients
    std::complex<float> *fft_buffer = nullptr;
    // std::shared_mutex fft_mutex;
    std::condition_variable_any fft_processed;

    // Dedicated threads for FFT
    std::thread fft_thread;

    // Markers
    void check_and_update_markers();
    std::thread marker_update_thread;
    std::atomic<bool> marker_update_running;

    // FIXED: Added websdr thread management
    std::thread websdr_thread;
    std::atomic<bool> websdr_running;

    // WebSDR.org registration
    WebsdrOrgState    websdr_org_state_;
    std::mutex        websdr_org_state_mtx_;
    std::atomic<bool> websdr_org_last_ok_{false};
    std::thread       websdr_org_thread_;
    std::atomic<bool> websdr_org_running_{false};

  public:
    struct ip_limit_result {
        bool        allowed = true;
        const char *reason  = nullptr; // short phrase, set when !allowed
        // Whether this refusal should be written to the log. A flood produces
        // one refusal per attempt, and logging every one of them would turn an
        // attack into unbounded disk writes, so this is true at most once per
        // address per few seconds.
        bool        log_it  = false;
        // Close code to refuse with: the per-IP limit's own, or the kick's
        // when this address was kicked and is still inside its ban.
        uint16_t    code    = 4003;
    };

    // Takes one connection slot for `ip`, or refuses it. `listener` marks the
    // paths that count against limit_per_ip as well; every path counts against
    // limit_per_ip_sockets and the rate. Safe from any thread.
    ip_limit_result ip_limit_acquire(const std::string &ip, bool listener);
    void            ip_limit_release(const std::string &ip, bool listener);

    // Disconnect `ip` and refuse it for the next `ban_s` seconds. Returns how
    // many sockets were closed. Loopback is never kicked. Safe from any
    // thread; called from the /~~kick handler in http.cpp.
    size_t          kick_ip(const std::string &ip, int ban_s);
};

// One per-IP listener slot, released exactly once.
//
// A connection can end through its close handler, its fail handler, or by
// being destroyed outright, and on an ungraceful drop more than one of those
// fires. The atomic flag makes every path after the first a no-op, so a slot
// can neither be released twice (which would let an address exceed its limit)
// nor leak (which would lock a listener out until restart).
class IPLimitToken {
  public:
    IPLimitToken(broadcast_server &server, std::string ip, bool listener)
        : server(server), ip(std::move(ip)), listener(listener) {}
    ~IPLimitToken() { release(); }

    IPLimitToken(const IPLimitToken &)            = delete;
    IPLimitToken &operator=(const IPLimitToken &) = delete;

    void release();

  private:
    broadcast_server &server;
    std::string       ip;
    bool              listener;
    std::atomic<bool> released{false};
};

#endif