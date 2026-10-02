#include "utils.h"

#include <algorithm>
#include <cctype>
#include <string>

#include <boost/uuid/uuid.hpp>
#include <boost/uuid/uuid_generators.hpp>
#include <boost/uuid/uuid_io.hpp>

static boost::uuids::random_generator uuid_generator =
    boost::uuids::random_generator();

std::string generate_unique_id() {
    return boost::uuids::to_string(uuid_generator());
}
// ── Client address helpers ──────────────────────────────────────────────────
// Declared in utils.h; these used to be file-static copies in signal.cpp and
// events.cpp. They are shared now because the per-IP connection limiter in
// websocket.cpp has to key on exactly the same string the stats log records.

std::string strip_port(const std::string &endpoint) {
    if (endpoint.empty()) return endpoint;
    // IPv6 bracketed form: [2001:db8::1]:12345
    if (endpoint.front() == '[') {
        const auto close = endpoint.find(']');
        if (close != std::string::npos)
            return endpoint.substr(1, close - 1);
        return endpoint; // malformed — return as-is
    }
    // IPv4 (or bare IPv6): strip everything after the last colon that is followed
    // only by digits (i.e. the port), but leave a bare IPv6 address intact.
    const auto colon = endpoint.rfind(':');
    if (colon == std::string::npos) return endpoint;
    const std::string after = endpoint.substr(colon + 1);
    const bool all_digits = !after.empty() &&
        std::all_of(after.begin(), after.end(),
                    [](unsigned char c){ return std::isdigit(c); });
    return all_digits ? endpoint.substr(0, colon) : endpoint;
}

bool is_loopback_ip(const std::string &ip) {
    if (ip == "127.0.0.1" || ip == "::1") return true;
    // IPv4-mapped form: "::ffff:127." covers the entire 127.0.0.0/8 range
    if (ip.find("::ffff:127.") == 0)      return true;
    return false;
}

std::string normalize_client_ip(const std::string &endpoint) {
    std::string ip = strip_port(endpoint);
    // "::ffff:1.2.3.4" is the same host as "1.2.3.4" — a dual-stack listener
    // sees IPv4 clients in the mapped form, and both spellings reach this
    // server depending on whether the client came through proxy.py (which
    // passes X-Forwarded-For unmapped) or straight to the listening port.
    if (ip.rfind("::ffff:", 0) == 0 && ip.find('.') != std::string::npos)
        ip = ip.substr(7);
    return ip;
}
