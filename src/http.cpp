#include "compression.h"
#include "spectrumserver.h"

#include <filesystem>
#include <fstream>
#include <sstream>
#include <string>
#include <vector>
#include <algorithm>
#include <cctype>
#include <chrono>
#include <mutex>
#include <regex>
#include <curl/curl.h>
#include <nlohmann/json.hpp>
#include <sys/socket.h>
#include <unistd.h>
#include <fcntl.h>
#include <cerrno>
#include <cstring>
#include <cstdio>
#include <thread>
#include <iostream>

#include <boost/algorithm/string.hpp>

std::unordered_map<std::string, std::string> mime_types{
    {".html", "text/html"},
    {".js", "text/javascript"},
    {".css", "text/css"},
    {".wasm", "application/wasm"},
};

static size_t dxspots_write_cb(char *ptr, size_t size, size_t nmemb, void *userdata) {
    if (!userdata) return 0;
    auto *out = static_cast<std::string *>(userdata);
    out->append(ptr, size * nmemb);
    return size * nmemb;
}

static std::string trim_copy(const std::string &s) {
    const auto b = std::find_if_not(s.begin(), s.end(), [](unsigned char c){ return std::isspace(c); });
    const auto e = std::find_if_not(s.rbegin(), s.rend(), [](unsigned char c){ return std::isspace(c); }).base();
    if (b >= e) return "";
    return std::string(b, e);
}

static std::string url_decode(const std::string &src) {
    std::string out;
    out.reserve(src.size());
    for (size_t i = 0; i < src.size(); ++i) {
        if (src[i] == '%' && i + 2 < src.size()) {
            const std::string hex = src.substr(i + 1, 2);
            char *end = nullptr;
            long v = std::strtol(hex.c_str(), &end, 16);
            if (end && *end == '\0') {
                out.push_back(static_cast<char>(v));
                i += 2;
                continue;
            }
        } else if (src[i] == '+') {
            out.push_back(' ');
            continue;
        }
        out.push_back(src[i]);
    }
    return out;
}

static std::string get_query_param(const std::string &resource, const std::string &key) {
    const auto qpos = resource.find('?');
    if (qpos == std::string::npos || qpos + 1 >= resource.size()) return "";

    const std::string query = resource.substr(qpos + 1);
    std::stringstream ss(query);
    std::string part;
    while (std::getline(ss, part, '&')) {
        const auto eq = part.find('=');
        const std::string k = url_decode(part.substr(0, eq));
        if (k != key) continue;
        if (eq == std::string::npos) return "";
        return url_decode(part.substr(eq + 1));
    }
    return "";
}

static bool looks_like_json(const std::string &s) {
    for (char c : s) {
        if (std::isspace(static_cast<unsigned char>(c))) continue;
        return c == '[' || c == '{';
    }
    return false;
}

static bool looks_like_callsign(const std::string &s) {
    const std::string t = trim_copy(s);
    if (t.empty() || t.size() < 3 || t.size() > 16) return false;

    bool has_alpha = false;
    bool has_digit = false;
    for (unsigned char c : t) {
        if (std::isalpha(c)) {
            has_alpha = true;
            continue;
        }
        if (std::isdigit(c)) {
            has_digit = true;
            continue;
        }
        if (c == '/' || c == '-' || c == '#') continue;
        return false;
    }

    if (!has_alpha || !has_digit) return false;

    std::string u = t;
    boost::algorithm::to_upper(u);
    if (u == "META" || u == "HTML" || u == "HEAD" || u == "BODY" || u == "TITLE" || u == "SCRIPT") {
        return false;
    }

    return true;
}

static std::string normalize_band(std::string band) {
    band = trim_copy(band);
    boost::algorithm::to_upper(band);
    if (band == "ALL" || band == "*" || band.empty()) return "ALL";
    if (!band.empty() && band.back() == 'M') band.pop_back();
    return band;
}

static bool band_matches(double f, const std::string &band_in) {
    const std::string band = normalize_band(band_in);
    if (band.empty() || band == "ALL") return true;
    if (band == "160") return f >= 1800  && f <= 2000;
    if (band == "80")  return f >= 3500  && f <= 4000;
    if (band == "60")  return f >= 5300  && f <= 5410;
    if (band == "40")  return f >= 7000  && f <= 7300;
    if (band == "30")  return f >= 10100 && f <= 10150;
    if (band == "20")  return f >= 14000 && f <= 14350;
    if (band == "17")  return f >= 18068 && f <= 18168;
    if (band == "15")  return f >= 21000 && f <= 21450;
    if (band == "12")  return f >= 24890 && f <= 24990;
    if (band == "10")  return f >= 28000 && f <= 29700;
    if (band == "6")   return f >= 50000 && f <= 54000;
    return false;   // unrecognised band — reject rather than pass everything through
}

static bool json_value_to_double(const nlohmann::json &j, double &out) {
    try {
        if (j.is_number_float() || j.is_number_integer() || j.is_number_unsigned()) {
            out = j.get<double>();
            return true;
        }
        if (j.is_string()) {
            const auto s = trim_copy(j.get<std::string>());
            if (s.empty()) return false;
            out = std::stod(s);
            return true;
        }
    } catch (...) {}
    return false;
}

static std::string json_value_to_string(const nlohmann::json &obj, const std::vector<std::string> &keys) {
    for (const auto &key : keys) {
        try {
            if (!obj.contains(key)) continue;
            const auto &v = obj.at(key);
            if (v.is_string()) return v.get<std::string>();
            if (v.is_number_integer()) return std::to_string(v.get<long long>());
            if (v.is_number_unsigned()) return std::to_string(v.get<unsigned long long>());
            if (v.is_number_float()) {
                std::ostringstream os;
                os << v.get<double>();
                return os.str();
            }
        } catch (...) {}
    }
    return "";
}


static bool is_likely_callsign(const std::string &s_in) {
    const std::string s = trim_copy(s_in);
    if (s.size() < 3 || s.size() > 24) return false;
    bool has_digit = false;
    bool has_alpha = false;
    for (unsigned char c : s) {
        if (std::isdigit(c)) {
            has_digit = true;
            continue;
        }
        if (std::isalpha(c)) {
            has_alpha = true;
            continue;
        }
        if (c == '/' || c == '-' || c == '#') continue;
        return false;
    }
    return has_digit && has_alpha;
}

static std::string extract_utc_hhmm(const std::string &time_str) {
    // Prefer HH:MM found anywhere in the string.
    // This avoids misreading ISO timestamps like "2026-04-12T08:19:00" as "2026".
    for (size_t i = 0; i + 4 < time_str.size(); ++i) {
        if (std::isdigit(static_cast<unsigned char>(time_str[i])) &&
            std::isdigit(static_cast<unsigned char>(time_str[i + 1])) &&
            time_str[i + 2] == ':' &&
            std::isdigit(static_cast<unsigned char>(time_str[i + 3])) &&
            std::isdigit(static_cast<unsigned char>(time_str[i + 4]))) {
            const int hh = (time_str[i] - '0') * 10 + (time_str[i + 1] - '0');
            const int mm = (time_str[i + 3] - '0') * 10 + (time_str[i + 4] - '0');
            if (hh >= 0 && hh <= 23 && mm >= 0 && mm <= 59) {
                return time_str.substr(i, 2) + time_str.substr(i + 3, 2);
            }
        }
    }

    // Accept compact HHMM only when it really looks like a time token,
    // not the leading year of an ISO date.
    for (size_t i = 0; i + 3 < time_str.size(); ++i) {
        if (std::isdigit(static_cast<unsigned char>(time_str[i])) &&
            std::isdigit(static_cast<unsigned char>(time_str[i + 1])) &&
            std::isdigit(static_cast<unsigned char>(time_str[i + 2])) &&
            std::isdigit(static_cast<unsigned char>(time_str[i + 3]))) {
            const bool prev_ok = (i == 0) || !std::isdigit(static_cast<unsigned char>(time_str[i - 1]));
            const bool next_ok = (i + 4 >= time_str.size()) || !std::isdigit(static_cast<unsigned char>(time_str[i + 4]));
            if (!prev_ok || !next_ok) continue;

            const int hh = (time_str[i] - '0') * 10 + (time_str[i + 1] - '0');
            const int mm = (time_str[i + 2] - '0') * 10 + (time_str[i + 3] - '0');
            if (hh >= 0 && hh <= 23 && mm >= 0 && mm <= 59) {
                return time_str.substr(i, 4);
            }
        }
    }

    return "";
}

static nlohmann::json normalize_json_spots(const nlohmann::json &in, const std::string &band, int limit_num) {
    nlohmann::json out = nlohmann::json::array();
    if (!in.is_array()) return out;

    for (const auto &s : in) {
        try {
            if (!s.is_object()) continue;

            std::string dx_call = json_value_to_string(s, {"dx_call", "dx", "call", "callsign"});
            std::string de_call = json_value_to_string(s, {"de_call", "spotter", "de", "spotter_call"});
            // DXSummit appends a node suffix ("-@", "-#") to every spotter call;
            // strip it so the callsign check below does not reject the whole feed.
            {
                const size_t dash = de_call.find_last_of('-');
                if (dash != std::string::npos && dash + 2 == de_call.size() &&
                    !std::isalnum((unsigned char)de_call[dash + 1])) {
                    de_call.erase(dash);
                }
            }
            std::string info = json_value_to_string(s, {"info", "comment", "remarks", "message"});
            std::string time = json_value_to_string(s, {"time", "spot_time", "timestamp", "utc"});
            std::string dx_country = json_value_to_string(s, {"dx_country", "country"});

            double frequency = 0.0;
            bool have_freq = false;
            if (s.contains("frequency")) have_freq = json_value_to_double(s["frequency"], frequency);
            if (!have_freq && s.contains("freq")) have_freq = json_value_to_double(s["freq"], frequency);
            if (!have_freq && s.contains("mhz")) {
                double mhz = 0.0;
                if (json_value_to_double(s["mhz"], mhz)) {
                    frequency = mhz * 1000.0;
                    have_freq = true;
                }
            }

            if (dx_call.empty() || !is_likely_callsign(dx_call) || (!de_call.empty() && !is_likely_callsign(de_call)) || !have_freq || frequency <= 0.0 || !band_matches(frequency, band)) continue;

            out.push_back({
                {"dx_call", dx_call},
                {"de_call", de_call},
                {"frequency", frequency},
                {"time", time},
                {"time_utc_hhmm", extract_utc_hhmm(time)},
                {"info", info},
                {"dx_country", dx_country}
            });

            if ((int)out.size() >= limit_num) break;
        } catch (...) {}
    }
    return out;
}

static nlohmann::json parse_dxsummit_text(const std::string &text, const std::string &band, int limit_num) {
    nlohmann::json out = nlohmann::json::array();
    std::stringstream ss(text);
    std::string line;

    while (std::getline(ss, line)) {
        line = trim_copy(line);
        if (line.empty()) continue;

        // Ignore HTML / markup lines if an upstream text URL returns an HTML wrapper
        std::string upper = line;
        boost::algorithm::to_upper(upper);
        if (!line.empty() && line[0] == '<') continue;
        if (line.find('<') != std::string::npos || line.find('>') != std::string::npos) continue;
        if (boost::algorithm::starts_with(upper, "<!DOCTYPE")) continue;
        if (boost::algorithm::starts_with(upper, "<HTML")) continue;
        if (boost::algorithm::starts_with(upper, "<HEAD")) continue;
        if (boost::algorithm::starts_with(upper, "<META")) continue;
        if (boost::algorithm::starts_with(upper, "META ")) continue;
        if (upper.find("HTTP-EQUIV") != std::string::npos) continue;
        if (boost::algorithm::starts_with(upper, "<TITLE")) continue;
        if (boost::algorithm::starts_with(upper, "<BODY")) continue;
        if (boost::algorithm::starts_with(upper, "<SCRIPT")) continue;

        std::istringstream ls(line);
        std::vector<std::string> tokens;
        std::string tok;
        while (ls >> tok) tokens.push_back(tok);
        if (tokens.size() < 3) continue;

        double freq = 0.0;
        size_t freq_idx = std::string::npos;
        for (size_t i = 1; i < tokens.size(); ++i) {
            try {
                double v = std::stod(tokens[i]);
                if (v > 1000.0 && v < 60000.0) {
                    freq = v;
                    freq_idx = i;
                    break;
                }
            } catch (...) {}
        }
        if (freq_idx == std::string::npos || freq_idx == 0 || freq_idx + 1 >= tokens.size()) continue;
        if (!band_matches(freq, band)) continue;

        std::string de_call = tokens[0];
        std::string dx_call = tokens[freq_idx + 1];
        if (!looks_like_callsign(dx_call)) continue;
        if (!looks_like_callsign(de_call)) de_call.clear();
        // Only require dx_call to be a valid callsign; de_call may be absent.
        if (!is_likely_callsign(dx_call)) continue;
        std::string time = "";
        std::string comment = "";

        const size_t n = tokens.size();
        if (n >= 3 &&
            tokens[n - 3].size() == 4 &&
            std::all_of(tokens[n - 3].begin(), tokens[n - 3].end(),
                        [](unsigned char c) { return std::isdigit(c); })) {
            time = tokens[n - 3] + " " + tokens[n - 2] + " " + tokens[n - 1];
            for (size_t i = freq_idx + 2; i + 3 < n; ++i) {
                if (!comment.empty()) comment += " ";
                comment += tokens[i];
            }
        } else {
            for (size_t i = freq_idx + 2; i < n; ++i) {
                if (!comment.empty()) comment += " ";
                comment += tokens[i];
            }
        }

        out.push_back({
            {"dx_call", dx_call},
            {"de_call", de_call},
            {"frequency", freq},
            {"time", time},
            {"time_utc_hhmm", extract_utc_hhmm(time)},
            {"info", comment},
            {"dx_country", ""}
        });

        if ((int)out.size() >= limit_num) break;
    }

    return out;
}

std::string get_mime_type(std::string &extension) {
    auto it = mime_types.find(extension);
    std::string mime_type;
    if (it == mime_types.end()) {
        mime_type = "text/plain";
    } else {
        mime_type = it->second;
    }
    return mime_type;
}

// Is this a build artefact whose URL already contains a content hash?
//
// Vite emits every bundle, chunk, worker and asset as <name>-<hash>.<ext>
// under an assets/ directory (assets/ for the desktop pages, mobile/assets/
// for the self-contained mobile page — see frontend/vite.config.js). The hash
// is derived from the contents, so the bytes behind one of those URLs can
// never change: a rebuild produces a *different* URL instead. They are safe to
// cache forever, which is what `immutable` tells the browser — don't even
// revalidate on reload.
//
// Deliberately conservative: the path must be inside an assets/ directory AND
// the stem must end in "-" plus exactly eight base64url characters, which is
// what Rollup's [hash] placeholder produces. Anything else falls through to
// the revalidate-always policy, which is only a bandwidth cost, never a
// staleness bug.
//
// The length is matched literally rather than by splitting on the last "-",
// because the alphabet includes "-" and "_": real names in this tree include
// SSTV-CIpiZn-6.png, fax.worker-D-IQdd95.js and sstv.worker-_oTRb-TC.js, all
// of which a rfind('-') split reads as a two-character hash and rejects.
static bool is_fingerprinted_asset(const std::string &path) {
    if (path.find("/assets/") == std::string::npos) {
        return false;
    }

    constexpr std::size_t hash_len = 8;
    std::string stem = std::filesystem::path(path).stem().string();

    // "<name>-<8 chars>" — so at least one name character, the dash, the hash.
    if (stem.size() < hash_len + 2) {
        return false;
    }
    if (stem[stem.size() - hash_len - 1] != '-') {
        return false;
    }

    return std::all_of(stem.end() - hash_len, stem.end(), [](unsigned char c) {
        return std::isalnum(c) != 0 || c == '_' || c == '-';
    });
}

// Cache-Control for a static file.
//
// The old policy was a flat `max-age=30` for everything, which was wrong in
// both directions:
//
//   * The multi-megabyte hashed bundles were re-downloaded every 30 seconds of
//     browsing, even though their URLs guarantee the contents cannot change.
//
//   * index.html was served from cache without revalidation for up to 30
//     seconds, and browsers may hold a cached copy well past that when the
//     response carries no validator. After a deploy that leaves visitors
//     running the previous bundle with no way to fix it but a hard refresh —
//     awkward on desktop, genuinely obscure on iOS and Android.
//
// So: hashed assets get a year and `immutable`; everything else — the HTML
// entry points, the JSON the pages poll (users.json, wf-message.json,
// site_information.json), the loose pages under public/ — must ask the server
// before reuse. `no-cache` still permits storing the response, it just forbids
// serving it without revalidating, so a refresh after a rebuild always lands
// on the current page.
static const char *get_cache_control(const std::string &path) {
    if (is_fingerprinted_asset(path)) {
        return "public, max-age=31536000, immutable";
    }
    return "no-cache";
}

// ---------------------------------------------------------------------------
// DX-spots cache — file-scope so both the cache-hit check and the background
// thread update share the SAME storage.  Previously both used static locals
// inside their respective blocks, which are distinct objects — the check
// always missed and every request spawned a new curl thread.
// ---------------------------------------------------------------------------
namespace {
    std::mutex          dxspot_cache_mtx;
    std::string         dxspot_cached_band;
    int                 dxspot_cached_limit  = 0;
    std::string         dxspot_cached_body   = "[]";
    std::chrono::steady_clock::time_point dxspot_cached_at{};
} // namespace

void broadcast_server::on_http(connection_hdl hdl) {
    // A request arrived, so the handshake deadline has nothing more to do with
    // this connection. /~~orgstatus below depends on this: it hands the socket
    // to a thread and never writes a response through websocketpp, so it would
    // otherwise look exactly like a connection that went silent.
    handshake_watch_done(hdl);

    // NOTE: set_access_channels is a global server setting — do NOT call it here
    //       per request (was a race condition). Configure logging at startup instead.
    server::connection_ptr con = m_server.get_con_from_hdl(hdl);
    std::string resource = con->get_resource();

    // websdr.org callback: /~~orgstatus — persistent connection via defer_http_response()
    // websdr.ewi.utwente.nl connects back here after our registration ping
    // and keeps the connection alive to poll user counts and config.
    {
        std::string filename_only = resource;
        size_t qpos = filename_only.find('?');
        if (qpos != std::string::npos) filename_only = filename_only.substr(0, qpos);

        bool org_enabled = false;
        uint32_t    cfg_serial  = 0;
        std::string cookie_id, email_obf, qth, description, logo;
        std::vector<WebsdrOrgState::Band> bands;
        {
            std::scoped_lock lk(websdr_org_state_mtx_);
            org_enabled = websdr_org_state_.enabled;
            cfg_serial  = websdr_org_state_.cfg_serial;
            cookie_id   = websdr_org_state_.cookie_id;
            email_obf   = websdr_org_state_.email_obf;
            qth         = websdr_org_state_.qth;
            description = websdr_org_state_.description;
            logo        = websdr_org_state_.logo;
            bands       = websdr_org_state_.bands;
        }

        if (filename_only == "/~~orgstatus" && org_enabled) {
            con->defer_http_response();

            int first_cfg = 0;
            {
                size_t pos = resource.find("config=");
                if (pos != std::string::npos) {
                    try { first_cfg = std::stoi(resource.substr(pos + 7)); } catch (...) {}
                }
            }

            int raw_fd = dup(con->get_raw_socket().native_handle());
            if (raw_fd < 0) {
                std::cerr << "[WebSDROrg] dup(socket) failed for /~~orgstatus: "
                          << strerror(errno) << std::endl;
                return;
            }

            std::thread([this, raw_fd, first_cfg,
                         cfg_serial, cookie_id, email_obf,
                         qth, description, logo, bands]() {
                int flags = fcntl(raw_fd, F_GETFL, 0);
                if (flags >= 0) {
                    fcntl(raw_fd, F_SETFL, flags & ~O_NONBLOCK);
                }
                struct timeval tv{60, 0};
                setsockopt(raw_fd, SOL_SOCKET, SO_RCVTIMEO, &tv, sizeof(tv));
                setsockopt(raw_fd, SOL_SOCKET, SO_SNDTIMEO, &tv, sizeof(tv));

                // Count /audio clients, not /events sockets: the /mobile page
                // opens /audio only, so counting events sockets hid every
                // mobile listener from the websdr.org status report.
                auto current_users = [this]() -> int {
                    return static_cast<int>(count_listeners());
                };

                auto build_body = [&](int req_cfg) -> std::string {
                    int users = current_users();
                    std::string body;
                    if (req_cfg != 0 && static_cast<uint32_t>(req_cfg) == cfg_serial) {
                        body = "Users: " + std::to_string(users) + "\n";
                    } else {
                        body  = "Config: " + std::to_string(cfg_serial) + "\n";
                        body += "Email: "  + email_obf   + "\n";
                        body += "Qth: "    + qth         + "\n";
                        body += "Description: " + description + "\n";
                        body += "Logo: "   + logo        + "\n";
                        body += "Bands: "  + std::to_string(bands.size()) + "\n";
                        for (size_t i = 0; i < bands.size(); ++i) {
                            char b[512];
                            snprintf(b, sizeof(b), "Band: %zu %f %f %s\n",
                                     i, bands[i].center_khz, bands[i].bw_khz,
                                     bands[i].label.c_str());
                            body += b;
                        }
                        body += "Users: " + std::to_string(users) + "\n";
                    }
                    return body;
                };

                auto send_resp = [&](const std::string& body) -> bool {
                    std::string resp;
                    resp  = "HTTP/1.1 200 OK\r\n";
                    resp += "Server: WebSDR/20140718.1716-64\r\n";
                    resp += "Content-Length: " + std::to_string(body.size()) + "\r\n";
                    resp += "Content-Type: text/plain\r\n";
                    resp += "Cache-control: no-cache\r\n";
                    resp += "Set-Cookie: ID=" + cookie_id +
                            "; expires=Thu, 31-Dec-2099 00:00:00 GMT\r\n";
                    resp += "\r\n";
                    resp += body;
                    // MSG_NOSIGNAL: if the peer already closed, return -1 with
                    // errno=EPIPE instead of raising SIGPIPE (matches the
                    // WebSDR.org send() path in spectrumserver.cpp).
                    return send(raw_fd, resp.c_str(), resp.size(),
                                MSG_NOSIGNAL) > 0;
                };

                std::string body = build_body(first_cfg);
                int  last_users = current_users();
                int  last_cfg   = first_cfg;
                unsigned polls  = 0;
                std::cout << "[WebSDROrg] /~~orgstatus config=" << first_cfg
                          << " users=" << last_users
                          << " bytes=" << body.size() << std::endl;
                if (!send_resp(body)) { close(raw_fd); return; }

                std::string buf;
                char tmp[2048];
                bool alive = true;
                while (running && alive) {
                    while (buf.find("\r\n\r\n") == std::string::npos) {
                        ssize_t n = recv(raw_fd, tmp, sizeof(tmp) - 1, 0);
                        if (n == 0) {
                            std::cout << "[WebSDROrg] /~~orgstatus peer closed callback connection" << std::endl;
                            alive = false;
                            break;
                        }
                        if (n < 0) {
                            if (errno == EINTR) continue;
                            if (errno == EAGAIN || errno == EWOULDBLOCK) continue;
                            std::cerr << "[WebSDROrg] recv failed on callback connection: "
                                      << strerror(errno) << std::endl;
                            alive = false;
                            break;
                        }
                        buf.append(tmp, static_cast<size_t>(n));
                    }
                    if (!alive) break;
                    size_t he = buf.find("\r\n\r\n");
                    std::string hdr = buf.substr(0, he);
                    buf = buf.substr(he + 4);
                    int req_cfg = 0;
                    size_t cp = hdr.find("config=");
                    if (cp != std::string::npos) {
                        try { req_cfg = std::stoi(hdr.substr(cp + 7)); } catch (...) {}
                    }
                    body = build_body(req_cfg);

                    // websdr.org polls this callback continuously, and logging
                    // every poll made it the single biggest thing in
                    // spectrumserver.log -- 57% of the file, all of it saying
                    // nothing had changed. Report the first poll (above), then
                    // only a change in listeners or config, plus one line every
                    // 120 polls so a quiet log still shows the callback alive.
                    const int users_now = current_users();
                    if (users_now != last_users || req_cfg != last_cfg ||
                        ++polls % 120 == 0) {
                        std::cout << "[WebSDROrg] /~~orgstatus config=" << req_cfg
                                  << " users=" << users_now
                                  << " bytes=" << body.size() << std::endl;
                        last_users = users_now;
                        last_cfg   = req_cfg;
                    }
                    if (!send_resp(body)) break;
                }
                close(raw_fd);
            }).detach();

            return;
        }
    }

    // ── /~~kick?ip=<addr>&secs=<n> — the sysop kick, loopback only ──────────
    // The admin panel calls this. It has to be handled HERE, in spectrumserver,
    // and not only in proxy.py: on a station whose public port is open (the
    // usual case) listeners connect to this process directly, so proxy.py never
    // sees their sockets and its kick closes nothing. 'ss -K' does reach them,
    // but it destroys the TCP socket, which the browser cannot tell from a
    // network drop — it reconnects, and the kick undoes itself.
    //
    // Loopback is checked on the TCP peer, never on X-Forwarded-For: that
    // header is whatever the client typed, so trusting it here would hand the
    // kick to the internet.
    {
        std::string path_only = resource;
        const auto qpos = path_only.find('?');
        if (qpos != std::string::npos) path_only = path_only.substr(0, qpos);

        if (path_only == "/~~kick") {
            const std::string peer =
                normalize_client_ip(con->get_remote_endpoint());
            con->append_header("Content-Type", "application/json");
            con->append_header("Cache-Control", "no-store");
            if (!is_loopback_ip(peer)) {
                con->set_status(websocketpp::http::status_code::forbidden);
                con->set_body("{\"ok\":false,\"msg\":\"forbidden\"}");
                return;
            }
            const std::string ip = get_query_param(resource, "ip");
            if (ip.empty()) {
                con->set_status(websocketpp::http::status_code::bad_request);
                con->set_body("{\"ok\":false,\"msg\":\"no ip\"}");
                return;
            }
            // No ban by default: a kick disconnects, it does not lock the
            // address out. secs is honoured if a caller asks for one.
            int ban_s = 0;
            const std::string secs = get_query_param(resource, "secs");
            if (!secs.empty()) {
                try { ban_s = std::stoi(secs); } catch (...) {}
            }
            // A ban outlives the sysop's patience, not the station's uptime.
            if (ban_s < 0)     ban_s = 0;
            if (ban_s > 86400) ban_s = 86400;

            const size_t closed = kick_ip(ip, ban_s);
            con->set_status(websocketpp::http::status_code::ok);
            con->set_body("{\"ok\":true,\"count\":" +
                          std::to_string(closed) + ",\"ban_s\":" +
                          std::to_string(ban_s) + "}");
            return;
        }
    }

    if (kiwi_emulation_enabled && resource.rfind("/status", 0) == 0) {
        // Un client Kiwi (AetherSDR, kiwiclient...) exige un 200 OK sur
        // /status avant de tenter l'upgrade WebSocket. Le contenu exact
        // importe peu — valide empiriquement contre un stub minimal avant
        // cette integration.
        con->append_header("Content-Type", "text/html");
        con->set_body("<html><body>Kiwi bridge OK</body></html>");
        con->set_status(websocketpp::http::status_code::ok);
        return;
    }

    // ── /logs/users_YYYY-MM-DD.jsonl ────────────────────────────────────────
    // Serve daily JSONL statistics files from logs/ at the project root (CWD).
    // Only filenames matching the exact pattern are accepted — no path traversal.
    if (resource.rfind("/logs/", 0) == 0) {
        const std::string filename = resource.substr(6);
        static const std::regex log_pattern("^users_\\d{4}-\\d{2}-\\d{2}\\.jsonl$");
        if (!std::regex_match(filename, log_pattern)) {
            con->set_status(websocketpp::http::status_code::not_found);
            con->set_body("Not found");
            return;
        }
        // Logs live at ~/PhantomSDR-Plus/logs/ (project root, never wiped by Vite)
        const std::string filepath = "logs/" + filename;
        std::ifstream f(filepath, std::ios::binary);
        if (!f) {
            con->set_status(websocketpp::http::status_code::not_found);
            con->set_body("Not found");
            return;
        }
        std::ostringstream buf;
        buf << f.rdbuf();
        con->append_header("Content-Type", "application/x-ndjson");
        con->append_header("Cache-Control", "no-store");
        con->append_header("Access-Control-Allow-Origin", "*");
        con->set_body(buf.str());
        con->set_status(websocketpp::http::status_code::ok);
        return;
    }

    if (resource == "/users" || resource == "/users.json") {
        // Live user list — always fresh from in-memory state, never from disk.
        const std::string body = get_users_json();
        con->append_header("Content-Type", "application/json");
        con->append_header("Cache-Control", "no-store");
        con->append_header("Access-Control-Allow-Origin", "*");
        con->set_body(body);
        con->set_status(websocketpp::http::status_code::ok);
        return;
    }

    if (resource.rfind("/api/dxspots", 0) == 0) {
        std::string band = normalize_band(get_query_param(resource, "band"));
        std::string limit = get_query_param(resource, "limit");

        int limit_num = 30;
        try {
            if (!limit.empty()) limit_num = std::stoi(limit);
        } catch (...) {
            limit_num = 30;
        }
        if (limit_num < 1) limit_num = 1;
        if (limit_num > 200) limit_num = 200;

        {
            std::scoped_lock lk(dxspot_cache_mtx);
            const auto now = std::chrono::steady_clock::now();
            if (dxspot_cached_limit == limit_num &&
                dxspot_cached_band == band &&
                dxspot_cached_at.time_since_epoch().count() != 0 &&
                std::chrono::duration_cast<std::chrono::seconds>(now - dxspot_cached_at).count() < 10) {
                con->append_header("Content-Type", "application/json");
                con->append_header("Cache-Control", "no-store");
                con->append_header("Access-Control-Allow-Origin", "*");
                con->set_body(dxspot_cached_body);
                con->set_status(websocketpp::http::status_code::ok);
                return;
            }
        }

        // Defer response: run the blocking curl fetch on a background thread
        // so the WebSocket I/O thread is never stalled.
        con->defer_http_response();

        std::thread([this, con, band, limit_num]() {
            // DXSummit serves port 80 only — a https attempt just burns the
            // connect timeout on every refresh, so plain http comes first.
            const std::vector<std::string> urls = {
                "http://new.dxsummit.fi/api/v1/spots?limit=" + std::to_string(limit_num),
                "http://www.dxsummit.fi/api/v1/spots?limit=" + std::to_string(limit_num),
                "https://new.dxsummit.fi/api/v1/spots?limit=" + std::to_string(limit_num),
                "http://www.dxsummit.fi/text/dx25.html",
                "https://www.dxsummit.fi/text/dx25.html"
            };

            CURL *curl = curl_easy_init();
            nlohmann::json normalized = nlohmann::json::array();

            if (curl) {
                for (const auto &url : urls) {
                    std::string response_data;
                    long http_code = 0;

                    curl_easy_reset(curl);
                    curl_easy_setopt(curl, CURLOPT_URL, url.c_str());
                    curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, dxspots_write_cb);
                    curl_easy_setopt(curl, CURLOPT_WRITEDATA, &response_data);
                    curl_easy_setopt(curl, CURLOPT_TIMEOUT, 10L);
                    curl_easy_setopt(curl, CURLOPT_CONNECTTIMEOUT, 5L);
                    curl_easy_setopt(curl, CURLOPT_FOLLOWLOCATION, 1L);
                    curl_easy_setopt(curl, CURLOPT_MAXREDIRS, 5L);
                    curl_easy_setopt(curl, CURLOPT_ACCEPT_ENCODING, "");
                    curl_easy_setopt(curl, CURLOPT_USERAGENT, "PhantomSDR-Plus/1.0");
                    curl_easy_setopt(curl, CURLOPT_NOSIGNAL, 1L);

                    struct curl_slist *headers = nullptr;
                    headers = curl_slist_append(headers, "Accept: application/json, text/plain, text/html, */*");
                    curl_easy_setopt(curl, CURLOPT_HTTPHEADER, headers);

                    CURLcode rc = curl_easy_perform(curl);
                    if (rc == CURLE_OK) {
                        curl_easy_getinfo(curl, CURLINFO_RESPONSE_CODE, &http_code);
                        if (http_code < 400 && !response_data.empty()) {
                            try {
                                if (looks_like_json(response_data)) {
                                    normalized = normalize_json_spots(nlohmann::json::parse(response_data), band, limit_num);
                                } else {
                                    normalized = parse_dxsummit_text(response_data, band, limit_num);
                                }
                            } catch (...) {
                                normalized = parse_dxsummit_text(response_data, band, limit_num);
                            }

                            if (normalized.is_array()) {
                                curl_slist_free_all(headers);
                                break;
                            }
                        }
                    }

                    curl_slist_free_all(headers);
                }

                curl_easy_cleanup(curl);
            }

            if (!normalized.is_array()) normalized = nlohmann::json::array();

            const std::string body = normalized.dump();
            {
                std::scoped_lock lk(dxspot_cache_mtx);
                dxspot_cached_band  = band;
                dxspot_cached_limit = limit_num;
                dxspot_cached_body  = body;
                dxspot_cached_at    = std::chrono::steady_clock::now();
            }

            // This runs on a DETACHED thread after a ~10s curl fetch. If the
            // client disconnected meanwhile, these websocketpp con-> calls can
            // throw — and an uncaught exception in a detached thread is
            // std::terminate → whole-server abort. Swallow it.
            try {
                con->append_header("Content-Type", "application/json");
                con->append_header("Cache-Control", "no-store");
                con->append_header("Access-Control-Allow-Origin", "*");
                con->set_body(body);
                con->set_status(websocketpp::http::status_code::ok);
                con->send_http_response();
            } catch (...) {
                // Client likely gone; nothing more to do.
            }
        }).detach();

        return;
    }

    std::ifstream file;
    std::string filename;
    try {
        filename = std::filesystem::weakly_canonical(
                       std::filesystem::path("/" + resource))
                       .string();
    } catch (const std::filesystem::filesystem_error &) {
        con->set_body("Bad Request");
        con->set_status(websocketpp::http::status_code::bad_request);
        return;
    }
    std::string response;

    filename = filename.substr(0, filename.find("?"));
    if (filename == "/") {
        filename = m_docroot + "/" + "index.html";
    } else {
        filename = m_docroot + "/" + filename.substr(1);
    }

    // Docroot boundary check — prevent symlink / path-traversal escapes
    {
        std::string canonical_docroot;
        std::string canonical_file;
        try {
            canonical_docroot = std::filesystem::canonical(m_docroot).string();
            canonical_file    = std::filesystem::weakly_canonical(filename).string();
        } catch (...) {
            con->set_body("Not Found");
            con->set_status(websocketpp::http::status_code::not_found);
            return;
        }
        if (canonical_file.rfind(canonical_docroot, 0) != 0) {
            con->set_body("Not Found");
            con->set_status(websocketpp::http::status_code::not_found);
            return;
        }
    }

    // Resolve a directory to its index.html, and refuse anything that is not a
    // regular file.
    //
    // On Linux std::ifstream::open() SUCCEEDS on a directory, so the `!file`
    // check further down does not catch one. tellg() then reports a nonsense
    // size and response.reserve() throws std::bad_alloc, which nothing catches
    // — std::terminate kills the whole server. Any visitor requesting a path
    // with a trailing slash ("/analog/", "/assets/") could therefore take the
    // receiver down for everyone.
    {
        std::error_code ec;
        if (std::filesystem::is_directory(filename, ec)) {
            filename = (std::filesystem::path(filename) / "index.html").string();
        }
        if (!std::filesystem::is_regular_file(filename, ec)) {
            con->set_body("Not Found");
            con->set_status(websocketpp::http::status_code::not_found);
            return;
        }
    }

    // NB: mime type is derived from the RESOLVED filename, so a directory
    // request correctly reports text/html for its index.html.
    std::string extension = std::filesystem::path(filename).extension();
    std::string mime_type = get_mime_type(extension);
    con->append_header("content-type", mime_type);
    con->append_header("Connection", "close");

    file.open(filename.c_str(), std::ios::in);
    if (!file) {
        std::stringstream ss;
        ss << "<!doctype html><html><head>"
           << "<title>Error 404 (Resource not found)</title><body>"
           << "<h1>Error 404</h1>"
           << "<p>The requested URL " << resource
           << " was not found on this server.</p>"
           << "</body></head></html>";

        con->append_header("content-type", "text/html");
        con->set_body(ss.str());
        con->set_status(websocketpp::http::status_code::not_found);
        return;
    }

    file.seekg(0, std::ios::end);
    std::streampos fileSize = file.tellg();
    if (fileSize > 0) {
        // Defence in depth: reserve() must never be allowed to terminate the
        // process, whatever tellg() reports.
        try {
            response.reserve(static_cast<std::size_t>(fileSize));
        } catch (const std::exception &) {
            con->set_body("Internal Server Error");
            con->set_status(
                websocketpp::http::status_code::internal_server_error);
            return;
        }
    }
    file.seekg(0, std::ios::beg);
    response.assign(std::istreambuf_iterator<char>(file), std::istreambuf_iterator<char>());

    std::set<std::string> encodings;
    boost::algorithm::split(encodings, con->get_request_header("accept-encoding"),
                            boost::is_any_of(", "), boost::token_compress_on);
    if (encodings.find("gzip") != encodings.end()) {
        response = Gzip::compress(response);
        con->append_header("Content-Encoding", "gzip");
    }

    // The body depends on whether the client asked for gzip, so a shared cache
    // must key on it — otherwise a proxy can hand a compressed response to a
    // client that never requested one.
    con->append_header("Vary", "Accept-Encoding");
    con->append_header("Cache-Control", get_cache_control(filename));
    con->set_body(response);
    con->set_status(websocketpp::http::status_code::ok);
}
