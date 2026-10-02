#include "client.h"
#include "glaze/glaze.hpp"

Client::Client(connection_hdl hdl, PacketSender &sender, conn_type type)
    : type{type}, hdl{hdl}, sender{sender}, frame_num{0}, mute{false} {}

void PacketSender::send_binary_packet(connection_hdl hdl, const void *data,
                                      size_t size) {
    send_binary_packet(hdl, {{data, size}});
}

void PacketSender::send_text_packet(connection_hdl hdl,
                                    const std::string &data) {
    send_text_packet(hdl, {data});
}

/* clang-format off */
struct window_cmd {
    int l;
    int r;
    std::optional<double> m;
    std::optional<int> level;
};

template <> 
struct glz::meta<window_cmd>
{
    using T = window_cmd;
    static constexpr auto value = object(
        "l", &T::l,
        "r", &T::r,
        "m", &T::m,
        "level", &T::level
    );
};

struct demodulation_cmd {
    std::string demodulation;
};

template <>
struct glz::meta<demodulation_cmd>
{
    using T = demodulation_cmd;
    static constexpr auto value = object(
        "demodulation", &T::demodulation
    );
};

struct userid_cmd {
    std::string userid;
};

template <>
struct glz::meta<userid_cmd>
{
    using T = userid_cmd;
    static constexpr auto value = object(
        "userid", &T::userid
    );
};

struct mute_cmd {
    bool mute;
};

template <>
struct glz::meta<mute_cmd>
{
    using T = mute_cmd;
    static constexpr auto value = object(
        "mute", &T::mute
    );
};

struct chat_cmd {
    std::string message;
    std::string username;
};

template <>
struct glz::meta<chat_cmd>
{
    using T = chat_cmd;
    static constexpr auto value = object(
        "message", &T::message,
        "username", &T::username
    );
};

// Noise gate enable command
struct noise_gate_enable_cmd {
    bool enabled;
};

template <>
struct glz::meta<noise_gate_enable_cmd>
{
    using T = noise_gate_enable_cmd;
    static constexpr auto value = object(
        "enabled", &T::enabled
    );
};

// Noise gate preset command
struct noise_gate_preset_cmd {
    std::string preset;
};

template <>
struct glz::meta<noise_gate_preset_cmd>
{
    using T = noise_gate_preset_cmd;
    static constexpr auto value = object(
        "preset", &T::preset
    );
};

// AGC enable command
struct agc_enable_cmd {
    bool enabled;
};

template <>
struct glz::meta<agc_enable_cmd>
{
    using T = agc_enable_cmd;
    static constexpr auto value = object(
        "enabled", &T::enabled
    );
};

// Codec capability command: the client advertises which codecs it can decode.
// Currently only Opus support is negotiable; when false the server keeps this
// client on FLAC even for C-QUAM (see AudioClient::set_am_stereo).
struct codec_caps_cmd {
    bool opus;
};

template <>
struct glz::meta<codec_caps_cmd>
{
    using T = codec_caps_cmd;
    static constexpr auto value = object(
        "opus", &T::opus
    );
};

// Runtime codec request. Used by the internal autorun loopback client to ask
// for raw PCM ("pcm"); the browser never sends this, so normal clients are
// unaffected.
struct set_codec_cmd {
    std::string codec;
};

template <>
struct glz::meta<set_codec_cmd>
{
    using T = set_codec_cmd;
    static constexpr auto value = object(
        "codec", &T::codec
    );
};

using msg_variant = std::variant<window_cmd, demodulation_cmd, userid_cmd, mute_cmd, chat_cmd,
                                  noise_gate_enable_cmd, noise_gate_preset_cmd, agc_enable_cmd,
                                  codec_caps_cmd, set_codec_cmd>;

template <>
struct glz::meta<msg_variant>
{
    static constexpr std::string_view tag = "cmd";
    static constexpr auto ids = std::array{
        "window",
        "demodulation",
        "userid",
        "mute",
        "chat",
        "noise_gate_enable",
        "noise_gate_preset",
        "agc_enable",
        "codec_caps",
        "set_codec"
    };
};

template<class... Ts>
struct overloaded : Ts... { using Ts::operator()...; };
/* clang-format on */

void Client::on_message(std::string &msg) {
    msg_variant msg_parsed;
    auto ec = glz::read_json(msg_parsed, msg);
    if (ec) {
        return;
    }

    std::visit(
        overloaded{
            [&](window_cmd &cmd) {
                on_window_message(cmd.l, cmd.m, cmd.r, cmd.level);
            },
            [&](demodulation_cmd &cmd) {
                on_demodulation_message(cmd.demodulation);
            },
            [&](userid_cmd &cmd) {
                on_userid_message(cmd.userid);
            },
            [&](chat_cmd &cmd) {
                on_chat_message(hdl, cmd.username, cmd.message);
            },
            [&](mute_cmd &cmd) {
                on_mute(cmd.mute);
            },
            [&](noise_gate_enable_cmd &cmd) {
                on_noise_gate_enable_message(cmd.enabled);
            },
            [&](noise_gate_preset_cmd &cmd) {
                on_noise_gate_preset_message(cmd.preset);
            },
            [&](agc_enable_cmd &cmd) {
                on_agc_enable_message(cmd.enabled);
            },
            [&](codec_caps_cmd &cmd) {
                on_codec_caps_message(cmd.opus);
            },
            [&](set_codec_cmd &cmd) {
                on_set_codec_message(cmd.codec);
            }
        },
        msg_parsed);
}

void Client::on_window_message(int, std::optional<double> &, int,
                               std::optional<int> &) {}
void Client::on_demodulation_message(std::string &) {}
void Client::on_codec_caps_message(bool) {}
void Client::on_set_codec_message(std::string &) {}
void Client::on_chat_message(connection_hdl, std::string &, std::string &) {}
void Client::on_userid_message(std::string &userid) {
    // Used for correlating between signal and waterfall sockets
    user_id = userid.substr(0, 32);
}
void Client::on_mute(bool mute) { this->mute = mute; }

// Default empty implementations for noise gate and AGC (AudioClient will override)
void Client::on_noise_gate_enable_message(bool) {}
void Client::on_noise_gate_preset_message(std::string &) {}
void Client::on_agc_enable_message(bool) {}