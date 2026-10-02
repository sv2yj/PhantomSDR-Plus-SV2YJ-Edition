#ifndef CLIENT_H
#define CLIENT_H

#include <mutex>
#include <optional>
#include <string>
#include <vector>

#include <fftw3.h>
#include <websocketpp/connection.hpp>

using websocketpp::connection_hdl;

enum conn_type {
    SIGNAL,
    WATERFALL,
    AUDIO,
    EVENTS,
    CHAT,
    WATERFALL_RAW,
    SIGNAL_RAW,
    UNKNOWN,
    KIWI_SND,
    KIWI_WF
};

constexpr const char *type_to_name(conn_type type) {
    switch (type) {
    case SIGNAL:
        return "Signal";
    case WATERFALL:
        return "Waterfall";
    case AUDIO:
        return "Audio";
    case EVENTS:
        return "Events";
    case WATERFALL_RAW:
        return "Waterfall Raw";
    case SIGNAL_RAW:
        return "Signal Raw";
    case CHAT:
        return "Chat";
    case KIWI_SND:
        return "Kiwi SND";
    case KIWI_WF:
        return "Kiwi W/F";
    default:
        return "Unknown";
    }
}

enum demodulation_mode { USB, LSB, AM, FM };

enum waterfall_compressor { WATERFALL_ZSTD, WATERFALL_AV1, WATERFALL_KIWI };

// AUDIO_PCM: raw little-endian int16 samples, no encoding. Never selected by
// config or the browser; only an internal loopback client (the autorun spot
// decoder) opts into it at runtime via the "set_codec" command, so it pays no
// FLAC/Opus encode cost on the P-cores. See PcmEncoder in audio.h.
enum audio_compressor { AUDIO_FLAC, AUDIO_OPUS, AUDIO_PCM, AUDIO_KIWI_PCM };

class WaterfallClient;
class AudioClient;
class ChatClient;
typedef std::vector<
    std::multimap<std::pair<int, int>, std::shared_ptr<WaterfallClient>>>
    waterfall_slices_t;
typedef std::deque<std::mutex> waterfall_mutexes_t;
typedef std::multimap<std::pair<int, int>, std::shared_ptr<AudioClient>>
    signal_slices_t;



class PacketSender {
  public:
    PacketSender() {}
    virtual void send_binary_packet(
        connection_hdl hdl,
        const std::initializer_list<std::pair<const void *, size_t>> &bufs) = 0;
    virtual void send_binary_packet(connection_hdl hdl, const void *data,
                                    size_t size);
    virtual void
    send_text_packet(connection_hdl hdl,
                     const std::initializer_list<std::string> &data) = 0;
    virtual void send_text_packet(connection_hdl hdl, const std::string &data);
    virtual std::string ip_from_hdl(connection_hdl hdl) = 0;
    virtual void log(connection_hdl hdl, const std::string &msg) = 0;

    virtual waterfall_slices_t &get_waterfall_slices() = 0;
    virtual waterfall_mutexes_t &get_waterfall_slice_mtx() = 0;
    virtual signal_slices_t &get_signal_slices() = 0;
    virtual std::mutex &get_signal_slice_mtx() = 0;

    virtual void broadcast_signal_changes(const std::string &unique_id, int l,
                                          double m, int r,
                                          const std::string &ip = "",
                                          bool internal_tap = false) = 0;

    virtual ~PacketSender() {}
};

class Client {
  public:
    Client(connection_hdl hdl, PacketSender &sender, conn_type type);
    void on_message(std::string &msg);

    virtual void on_window_message(int l, std::optional<double> &m, int r,
                                   std::optional<int> &level);
    virtual void on_demodulation_message(std::string &demodulation);
    virtual void on_userid_message(std::string &userid);
    virtual void on_chat_message(connection_hdl sender_hdl, std::string &userid, std::string &message);
    virtual void on_mute(bool mute);
    
    // Noise gate and AGC control (AudioClient will override these)
    virtual void on_noise_gate_enable_message(bool enabled);
    virtual void on_noise_gate_preset_message(std::string &preset);
    virtual void on_agc_enable_message(bool enabled);

    // Client codec capability (AudioClient overrides). opus_supported=false
    // keeps the client on FLAC even for C-QUAM.
    virtual void on_codec_caps_message(bool opus_supported);

    // Runtime codec request ("set_codec"). AudioClient overrides to switch the
    // encoder (e.g. to raw PCM for the internal autorun loopback client).
    virtual void on_set_codec_message(std::string &codec);

    // Type of connection
    conn_type type;

    // User ID is sent for each client with waterfall + signal
    std::string user_id;

    // Unique id
    std::string unique_id;

    // Connection handle
    connection_hdl hdl;
    PacketSender &sender;

    // 0 frequency of the downconverted signal
    double audio_mid;
    int frame_num;
    bool mute;

    // User requested frequency range
    int l;
    int r;
};

#endif