// chat.h
#ifndef CHAT_H
#define CHAT_H

#include "client.h"
#include <atomic>
#include <string>
#include <mutex>
#include <thread>
#include <unordered_map>
#include <deque>
#include <set>

class ChatClient : public Client {
public:
    ChatClient(connection_hdl hdl, PacketSender& sender);

    void send_event(std::string& event);

    virtual void on_chat_message(connection_hdl sender_hdl, std::string& user_id, std::string& message);
    virtual void store_chat_message(const std::string& message);
    virtual void on_close_chat(connection_hdl hdl);
    virtual void on_open_chat(connection_hdl hdl);

    std::string get_or_generate_username(const std::string& user_id);
    std::string get_chat_history_as_string();

    static std::set<connection_hdl, std::owner_less<connection_hdl>>& get_chat_connections();

    // ── Admin IPC ────────────────────────────────────────────────────────────
    // Call once after the WebSocket server is listening (from broadcast_server::run()).
    // Starts a background thread that listens on a Unix domain socket for
    // admin commands (currently: DELETE:<formatted_line>).
    static void start_admin_listener(
        const std::string& socket_path = "/tmp/phantomsdr_chat.sock");

    // Call from broadcast_server::stop() to cleanly shut down the listener thread.
    static void stop_admin_listener();

    // BUG FIX (DEADLOCK): Previously the destructor acquired chat_connections_mtx
    // unconditionally.  If on_close_chat (or any code path that holds the mutex
    // on the same thread) ever triggers the final release of a ChatClient
    // shared_ptr, the destructor would try to re-acquire a non-recursive mutex
    // it already owns → deadlock.
    //
    // Fix: use an atomic "already removed" flag so the erase is attempted at
    // most once, and both the destructor and on_close_chat use the same helper.
    // The flag also eliminates the no-op double-erase that occurred when
    // on_close_chat fired before the destructor ran.
    virtual ~ChatClient() {
        remove_from_connections();
    }

private:
    // Ensures chat_connections.erase(hdl) happens exactly once, safely.
    // Called from both on_close_chat and the destructor.
    void remove_from_connections();

    // Set to true as soon as this client is removed from chat_connections.
    // Prevents a second mutex acquisition + erase in the destructor when
    // on_close_chat has already cleaned up (normal close path), and prevents
    // a deadlock when both paths race to acquire chat_connections_mtx.
    std::atomic<bool> removed_from_chat_{false};

    static std::set<connection_hdl, std::owner_less<connection_hdl>> chat_connections;
    static std::mutex chat_connections_mtx;
    static std::unordered_map<std::string, std::string> user_id_to_name;
    static std::deque<std::string> chat_messages_history;
    static const std::set<std::string> blocked_usernames;
    static const std::set<std::string> blocked_words;
    static bool is_history_loaded;

    void load_chat_history();
    void save_chat_history();
    bool is_valid_username(const std::string& username);
    std::string filter_message(const std::string& message);

    // ── Admin IPC internals ──────────────────────────────────────────────────
    // Non-owning pointer to the shared PacketSender — captured from the first
    // ChatClient constructor call.  All instances share the same sender object.
    static PacketSender*      shared_sender_;

    static std::atomic<bool>  admin_listener_running_;
    static int                admin_listener_fd_;   // server listen fd; -1 = not open
    static std::thread        admin_listener_thread_;

    // Remove `line` from the in-memory deque, rewrite chat_history.txt, and
    // broadcast a "__CHAT_DELETE__:<line>" frame to every connected chat client.
    // Must NOT be called while holding chat_connections_mtx.
    static void delete_message(const std::string& line);

    // Background thread body: accepts connections on the Unix socket and
    // dispatches commands to delete_message().
    static void admin_listener_loop(const std::string& socket_path);
};

#endif
