#ifndef AUDIO_H
#define AUDIO_H

#include <string>
#include <vector>
#include <cstdlib>
#include <deque>

#include <nlohmann/json.hpp>
using json = nlohmann::json;

#include "FLAC++/encoder.h"
#include "FLAC++/metadata.h"


// FLAC tuning modes for latency vs bandwidth
enum class FlacMode {
    UltraLowLatency,  // ~256-512 blocksize
    Balanced,         // ~1024 blocksize
    LowBandwidth      // ~4096 blocksize
};

#ifdef HAS_LIBOPUS
#include <opus/opus.h>
#endif

#include "client.h"

class AudioEncoder {
  public:
    AudioEncoder(websocketpp::connection_hdl hdl, PacketSender& sender);
    void set_data(uint64_t frame_num, int l, double m, int r, double pwr, int channels = 1, bool sam_locked = false);
    virtual int process(int32_t *data, size_t size) = 0;
    virtual int finish_encoder() = 0;
    virtual ~AudioEncoder();

  protected:
    int send(const void *buffer, size_t bytes, unsigned current_frame);
    websocketpp::connection_hdl hdl;
    PacketSender& sender;

    json packet;   // no ZSTD stream anymore
    // Codec label attached to every audio packet so the browser knows which
    // decoder produced `data`.  This lets the server swap a client's codec at
    // runtime (e.g. FLAC→Opus when C-QUAM is enabled) and have the frontend
    // rebuild its decoder in lock-step with the frames.  Subclasses override.
    std::string codec_name{"flac"};
};

class FlacEncoder : public AudioEncoder, public FLAC::Encoder::Stream {
  public:
    FlacEncoder(websocketpp::connection_hdl hdl, PacketSender& sender)
        : AudioEncoder(hdl, sender), FLAC::Encoder::Stream() {
        codec_name = "flac";
        const char* m = std::getenv("FLAC_MODE");
        if (m && std::string(m) == "UltraLowLatency") configure_flac(FlacMode::UltraLowLatency);
        else if (m && std::string(m) == "LowBandwidth") configure_flac(FlacMode::LowBandwidth);
        else configure_flac(FlacMode::Balanced);
    }
    ~FlacEncoder();

    // Configure encoder for latency/bandwidth tradeoff
    void configure_flac(FlacMode mode);


  protected:
    virtual FLAC__StreamEncoderWriteStatus
    write_callback(const FLAC__byte buffer[], size_t bytes, unsigned samples,
                   unsigned current_frame);
    int finish_encoder();
    int process(int32_t *data, size_t size);
};

// Raw PCM "encoder": clamps the demodulated int32 samples to int16 and ships
// them little-endian with no compression. Used only by the internal autorun
// loopback client so decoding never pays a FLAC/Opus encode cost. Lossless and
// trivial — exactly what a decoder wants, and cheapest for the P-cores.
class PcmEncoder : public AudioEncoder {
  public:
    PcmEncoder(websocketpp::connection_hdl hdl, PacketSender& sender)
        : AudioEncoder(hdl, sender) {
        codec_name = "pcm";
    }
    ~PcmEncoder() override = default;

  protected:
    int process(int32_t *data, size_t size) override;
    int finish_encoder() override;

  private:
    std::vector<int16_t> pcm_buf;  // reused per-call output buffer
};

#ifdef HAS_LIBOPUS
class OpusAudioEncoder : public AudioEncoder {
public:
  OpusAudioEncoder(websocketpp::connection_hdl hdl,
                   PacketSender& sender,
                   int samplerate,
                   int channels = 1);
  ~OpusAudioEncoder();

  // Return the actual sample rate used by the Opus encoder
  int get_sample_rate() const { return opus_samplerate; }
  int get_channels() const { return opus_channels; }

protected:
  ::OpusEncoder* encoder = nullptr;        // libopus encoder handle
  size_t frame_size = 0;                  // samples per frame
  std::deque<opus_int16> partial_frames;  // buffered interleaved samples
  std::vector<opus_int16> frame_buf;      // reused encode buffer (avoids per-frame alloc)
  int opus_samplerate = 48000;            // actual encoder sample rate (8–48 kHz)
  int opus_channels = 1;                  // 1=mono, 2=stereo

  int finish_encoder() override;
  int process(int32_t *data, size_t size) override;
};
#endif

#endif