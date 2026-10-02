// chat.cpp
#include "spectrumserver.h"
#include "chat.h"
#include <chrono>
#include <iomanip>
#include <random>
#include <sstream>
#include <algorithm>
#include <fstream>
#include <regex>
#include <sys/socket.h>
#include <sys/un.h>
#include <sys/stat.h>
#include <unistd.h>
#include <cstring>

std::set<websocketpp::connection_hdl, std::owner_less<websocketpp::connection_hdl>> ChatClient::chat_connections;
std::mutex ChatClient::chat_connections_mtx;
std::unordered_map<std::string, std::string> ChatClient::user_id_to_name;
std::deque<std::string> ChatClient::chat_messages_history;
bool ChatClient::is_history_loaded = false;

PacketSender*     ChatClient::shared_sender_{nullptr};
std::atomic<bool> ChatClient::admin_listener_running_{false};
int               ChatClient::admin_listener_fd_{-1};
std::thread       ChatClient::admin_listener_thread_;

const std::set<std::string> ChatClient::blocked_usernames = {
    "admin", "operator", "host", "root", "system", "moderator"
};

const std::set<std::string> ChatClient::blocked_words = {
    "fuck", "fucking", "bitch", "shit", "ass", "cunt", "bastard", "idiot",
    "moron", "dumb", "stupid", "loser", "dummy", "retard", "dumbass", "asshole"
};

ChatClient::ChatClient(connection_hdl hdl, PacketSender &sender)
    : Client(hdl, sender, CHAT) {
    // Stash a non-owning pointer so static methods can broadcast to all clients.
    // All ChatClient instances share the same PacketSender object.
    if (!shared_sender_) shared_sender_ = &sender;
    {
        std::scoped_lock lk(chat_connections_mtx);
        if (!is_history_loaded) {
            load_chat_history();
            is_history_loaded = true;
        }
    }
    on_open_chat(hdl);
}

// BUG FIX (LINKER ERROR): send_event was declared in chat.h but had no
// implementation.  Any call-site would produce an unresolved-symbol error at
// link time.  Added a minimal implementation that forwards the event to this
// client as a text WebSocket frame, consistent with how EventsClient does it.
void ChatClient::send_event(std::string& event) {
    sender.send_text_packet(hdl, event);
}

// ---------------------------------------------------------------------------
// Private helper — removes this client from chat_connections exactly once.
// Used by both on_close_chat and the destructor to avoid:
//   (a) a double-erase (on_close_chat fires, then destructor fires again), and
//   (b) a deadlock if both paths race to acquire chat_connections_mtx.
// ---------------------------------------------------------------------------
void ChatClient::remove_from_connections() {
    // exchange returns the OLD value; only the first caller (false → true) wins.
    if (!removed_from_chat_.exchange(true, std::memory_order_acq_rel)) {
        std::scoped_lock lk(chat_connections_mtx);
        chat_connections.erase(hdl);
    }
}

std::string ChatClient::get_or_generate_username(const std::string& user_id) {
    auto it = user_id_to_name.find(user_id);
    if (it != user_id_to_name.end()) {
        return it->second;
    }
    // Generate a deterministic username from the id hash, then store it
    // under the original key so every subsequent lookup is O(1).
    std::string candidate = user_id;
    std::string username;
    do {
        std::hash<std::string> hasher;
        auto hashed = hasher(candidate);
        std::string numeric_part = std::to_string(hashed).substr(0, 6);
        username = "user" + numeric_part;
        candidate += "1";   // perturb and retry if the generated name is blocked
    } while (!is_valid_username(username));

    user_id_to_name[user_id] = username;   // always store under the original key
    return username;
}

bool ChatClient::is_valid_username(const std::string& username) {
    return blocked_usernames.find(username) == blocked_usernames.end();
}

std::string ChatClient::filter_message(const std::string& message) {
    // Build the compiled regex list once per process lifetime.
    // std::regex construction is expensive; doing it per call would cost
    // hundreds of microseconds per blocked word on every incoming message.
    static const std::vector<std::regex> compiled_words = []() {
        std::vector<std::regex> v;
        v.reserve(blocked_words.size());
        for (const auto& w : blocked_words)
            v.emplace_back("\\b" + w + "\\b", std::regex_constants::icase);
        return v;
    }();
    static const std::vector<std::string> word_list(blocked_words.begin(), blocked_words.end());

    std::string filtered = message;
    for (size_t i = 0; i < compiled_words.size(); ++i)
        filtered = std::regex_replace(filtered, compiled_words[i],
                                      std::string(word_list[i].size(), '*'));
    return filtered;
}


void ChatClient::store_chat_message(const std::string& message) {
    // NOTE: caller must hold chat_connections_mtx before calling this.
    // This method only updates the in-memory deque; file persistence is
    // handled separately (outside the lock) to avoid holding the mutex
    // during disk I/O.
    if(chat_messages_history.size() >= 20)
        chat_messages_history.pop_front();
    chat_messages_history.push_back(message);
}

std::string ChatClient::get_chat_history_as_string() {
    // NOTE: caller must hold chat_connections_mtx before calling this.
    std::string history;
    for (const auto& msg : chat_messages_history) {
        history += msg + "\n";
    }
    return history;
}

void ChatClient::on_chat_message(connection_hdl sender_hdl, std::string& username, std::string& message) {
    // Input validation
    const size_t MAX_USERNAME_LENGTH = 14;
    const size_t MAX_MESSAGE_LENGTH = 200;

    // Trim leading and trailing spaces from the username
    username.erase(0, username.find_first_not_of(" \t\n\r\f\v"));
    {
        auto last = username.find_last_not_of(" \t\n\r\f\v");
        if (last != std::string::npos)
            username.erase(last + 1);
        else
            username.clear();
    }

    if (username.length() > MAX_USERNAME_LENGTH) {
        username = username.substr(0, MAX_USERNAME_LENGTH);
    }

    if (message.length() > MAX_MESSAGE_LENGTH) {
        message = message.substr(0, MAX_MESSAGE_LENGTH);
    }

    // Check if the username is blocked
    if (!is_valid_username(username)) {
        // Use a properly seeded PRNG — rand() always produces the same sequence
        static std::mt19937 rng{std::random_device{}()};
        static std::uniform_int_distribution<int> dist(0, 999999);
        std::string random_username = "user" + std::to_string(dist(rng));
        printf("Blocked username '%s' detected. Assigned random username: %s\n", username.c_str(), random_username.c_str());
        username = random_username;
    }

    auto now = std::chrono::system_clock::now();
    auto now_c = std::chrono::system_clock::to_time_t(now);
    std::stringstream ss;
    struct tm tm_buf{};
    localtime_r(&now_c, &tm_buf);
    ss << std::put_time(&tm_buf, "%Y-%m-%d %H:%M:%S");
    std::string timestamp = ss.str();

    std::string filtered_message = filter_message(message);
    std::string formatted_message = timestamp + " " + username + ": " + filtered_message;

    // BUG FIX (LIVENESS): Previously store_chat_message() called
    // save_chat_history() (a full disk write) while holding chat_connections_mtx.
    // This blocked all concurrent chat sends for the duration of the I/O,
    // which under I/O pressure could be tens of milliseconds — enough to
    // trigger WebSocket timeouts and block the close handler.
    //
    // Fix: update the in-memory deque and broadcast under the lock (fast),
    // then take a cheap snapshot (≤20 strings) and write it to disk after
    // releasing the lock.
    std::vector<std::string> history_snapshot;
    {
        std::scoped_lock lk(chat_connections_mtx);
        store_chat_message(formatted_message);
        // Snapshot the current history for persistence (≤20 items — cheap copy).
        history_snapshot.assign(chat_messages_history.begin(),
                                chat_messages_history.end());
        for (const auto& conn : chat_connections) {
            sender.send_text_packet(conn, formatted_message);
        }
    } // mutex released here — disk write happens below

    // Write history to disk outside the lock so disk latency doesn't block
    // concurrent sends or close handlers.
    {
        std::ofstream file("chat_history.txt", std::ios::trunc);
        for (const auto& msg : history_snapshot) {
            file << msg << "\n";
        }
    }
}

// BUG FIX (DATA RACE): Previously on_open_chat released chat_connections_mtx
// before reading chat_messages_history.  Any concurrent on_chat_message thread
// could be writing to the deque at the same time → undefined behaviour (deque
// iterator invalidation, torn reads).
//
// Fix: read the history INSIDE the lock scope and copy it to a local std::string,
// then send the copy OUTSIDE the lock so we never hold the mutex across a
// potentially-blocking WebSocket send call.
void ChatClient::on_open_chat(connection_hdl hdl) {
    std::string history;
    {
        std::scoped_lock lk(chat_connections_mtx);
        chat_connections.insert(hdl);
        // Read history under the lock — the deque is only safe to access
        // while chat_connections_mtx is held.
        if (!chat_messages_history.empty()) {
            history = "Chat history:\n" + get_chat_history_as_string();
        }
    }
    // Send outside the lock: WebSocket sends can block; holding the mutex
    // across them would starve other chat threads.
    if (!history.empty()) {
        sender.send_text_packet(hdl, history);
    }
}

void ChatClient::on_close_chat(connection_hdl hdl) {
    remove_from_connections();
}

void ChatClient::load_chat_history() {
    std::ifstream file("chat_history.txt");
    std::string line;
    while (std::getline(file, line) && chat_messages_history.size() < 20) {
        chat_messages_history.push_back(line);
    }
    file.close();
}

void ChatClient::save_chat_history() {
    // NOTE: this method is now only called from on_chat_message, OUTSIDE the
    // chat_connections_mtx lock, operating on a snapshot passed by the caller.
    // Kept for API compatibility; direct callers should prefer the snapshot
    // approach in on_chat_message.
    std::ofstream file("chat_history.txt", std::ios::trunc);
    for (const auto& msg : chat_messages_history) {
        file << msg << std::endl;
    }
    file.close();
}

// ── Admin Unix-socket listener ────────────────────────────────────────────────
//
// The admin panel (admin_server.py) connects to /tmp/phantomsdr_chat.sock and
// sends a single line of the form:
//
//   DELETE:<full formatted message line>\n
//
// On receipt, delete_message() erases the line from the in-memory deque,
// rewrites chat_history.txt, and broadcasts "__CHAT_DELETE__:<line>" to every
// connected chat WebSocket client so their UI removes it in real time.
//
// No server restart is required for any of this to take effect.

void ChatClient::start_admin_listener(const std::string& socket_path) {
    // Idempotent: no-op if the listener is already running.
    if (admin_listener_running_.exchange(true)) return;
    admin_listener_thread_ = std::thread(admin_listener_loop, socket_path);
    admin_listener_thread_.detach();
}

void ChatClient::stop_admin_listener() {
    admin_listener_running_.store(false);
    // Closing the listening fd unblocks any pending accept() call so the
    // background thread can observe the flag and exit cleanly.
    int fd = admin_listener_fd_;
    if (fd != -1) {
        admin_listener_fd_ = -1;
        ::close(fd);
    }
}

void ChatClient::admin_listener_loop(const std::string& socket_path) {
    // Remove a stale socket file left over from a previous (crashed) run.
    ::unlink(socket_path.c_str());

    int server_fd = ::socket(AF_UNIX, SOCK_STREAM, 0);
    if (server_fd < 0) {
        perror("[chat admin] socket");
        admin_listener_running_.store(false);
        return;
    }
    admin_listener_fd_ = server_fd;

    struct sockaddr_un addr{};
    addr.sun_family = AF_UNIX;
    std::strncpy(addr.sun_path, socket_path.c_str(), sizeof(addr.sun_path) - 1);

    if (::bind(server_fd, reinterpret_cast<struct sockaddr*>(&addr), sizeof(addr)) < 0 ||
        ::listen(server_fd, 8) < 0) {
        perror("[chat admin] bind/listen");
        ::close(server_fd);
        admin_listener_running_.store(false);
        return;
    }
    // Only the process owner can connect — admin_server.py runs as the same user.
    ::chmod(socket_path.c_str(), 0600);
    printf("[chat admin] Listening on %s\n", socket_path.c_str());

    while (admin_listener_running_.load()) {
        int client_fd = ::accept(server_fd, nullptr, nullptr);
        if (client_fd < 0) {
            if (admin_listener_running_.load())
                perror("[chat admin] accept");
            break;
        }

        // Read one newline-terminated command line (max 4 KiB for safety).
        std::string cmd;
        cmd.reserve(256);
        char ch;
        while (cmd.size() < 4096 && ::read(client_fd, &ch, 1) == 1 && ch != '\n')
            cmd += ch;
        ::close(client_fd);

        if (cmd.rfind("DELETE:", 0) == 0)
            delete_message(cmd.substr(7));
        else if (!cmd.empty())
            printf("[chat admin] Unknown command: %s\n", cmd.c_str());
    }

    ::unlink(socket_path.c_str());
    admin_listener_running_.store(false);
}

void ChatClient::delete_message(const std::string& line) {
    if (line.empty()) return;

    std::vector<std::string> snapshot;
    const std::string delete_frame = "__CHAT_DELETE__:" + line;

    {
        std::scoped_lock lk(chat_connections_mtx);
        auto it = std::find(chat_messages_history.begin(),
                            chat_messages_history.end(), line);
        if (it == chat_messages_history.end()) {
            printf("[chat admin] DELETE: line not found in history\n");
            return;
        }
        chat_messages_history.erase(it);
        snapshot.assign(chat_messages_history.begin(), chat_messages_history.end());

        // Broadcast the deletion frame to every currently connected chat client.
        // Clients handle "__CHAT_DELETE__:<line>" by removing that message from
        // their displayed chat UI immediately, with no page reload needed.
        if (shared_sender_) {
            for (const auto& conn : chat_connections)
                shared_sender_->send_text_packet(conn, delete_frame);
        }
    }   // mutex released before disk I/O

    // Rewrite history file outside the lock so disk latency does not block
    // concurrent message sends or close handlers.
    std::ofstream file("chat_history.txt", std::ios::trunc);
    for (const auto& msg : snapshot)
        file << msg << "\n";
}
