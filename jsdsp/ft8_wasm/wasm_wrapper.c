/**
 * wasm_wrapper.c — FT8 / FT4 / FT2 decode bridge for PhantomSDR-Plus
 * Place at: ~/ft8_lib_ft2/wasm_wrapper.c
 *
 * Harness modelled on KiwiSDR's FT8 extension
 * (Beagle_SDR_GPS/extensions/FT8/decode_ft8.c), which drives ft8_lib's own
 * common/monitor.c unmodified. This file does the same rather than
 * reimplementing the STFT — the previous hand-rolled waterfall builder
 * produced zero decodes.
 *
 * Kiwi parity notes:
 *   - passband 100..3100 Hz (Kiwi's FT8_PASSBAND_LO/HI)
 *   - kMax_candidates = 140, kLDPC_iterations = 25, kMin_score = 10
 *   - reported audio frequency computed from the candidate + mon.min_bin
 *     (ftx_decode_candidate() never assigns status.freq — reading it was a bug)
 *   - persistent aging callsign hash table so <...> compound calls resolve
 *   - sample rate is a parameter, not a compile-time constant
 *
 * JS protocol: 0=FT8, 1=FT4, 2=FT2
 * C enum:      FTX_PROTOCOL_FT4=0, FTX_PROTOCOL_FT8=1
 * FT2 strategy: 2x upsample PCM, decode as FT4.
 */

#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <stdint.h>
#include <stdbool.h>

#include "ft8/decode.h"
#include "ft8/constants.h"
#include "ft8/message.h"
#include "common/monitor.h"

/* ── Constants (mirroring Kiwi's decode_ft8.c) ────────────────────────────── */
#define DEFAULT_SAMPLE_RATE 12000
#define TIME_OSR            2
#define FREQ_OSR            2
#define MIN_SCORE           10
#define MAX_CANDIDATES      140
#define LDPC_ITERATIONS     25
#define MAX_RESULTS         64
#define MSG_BUF_LEN         36
#define SNR_ADJ             (-10.0f)

/* Kiwi: FT8_PASSBAND_LO / FT8_PASSBAND_HI in extensions/FT8/FT8.h */
#define PASSBAND_LO         100.0f
#define PASSBAND_HI         3100.0f

/* ── Result store ─────────────────────────────────────────────────────────── */
typedef struct { char text[MSG_BUF_LEN]; float freq; float snr; float dt; } result_t;
static result_t s_results[MAX_RESULTS];
static int      s_count = 0;

/* ── Callsign hash table ──────────────────────────────────────────────────────
 * Mirrors Kiwi's hashtable_add/lookup/cleanup. Entries carry an age in the 10
 * MSBs of `hash`; the 22 LSBs hold the hash value itself. Aged out after
 * CALLSIGN_AGE_MAX slots. Persists across ftx_decode() calls — that is the
 * whole point: a compound callsign heard in one slot lets a later slot's
 * hashed reference to it be printed in full instead of as <...>.
 */
#define CALLSIGN_HASHTABLE_MAX 1024
#define CALLSIGN_AGE_MAX       60

typedef struct {
    /* NB: callsign is NOT null terminated. Must use strncpy() / strncmp(). */
    char     callsign[11];
    uint32_t hash;   /* 10 MSBs = age, 22 LSBs = hash value */
} callsign_hashtable_t;

static callsign_hashtable_t s_callsign_hashtable[CALLSIGN_HASHTABLE_MAX];
static int                  s_callsign_hashtable_size = 0;

static void hashtable_cleanup(uint8_t max_age)
{
    callsign_hashtable_t *ht = s_callsign_hashtable;

    for (int i = 0; i < CALLSIGN_HASHTABLE_MAX; ++i, ++ht) {
        if (ht->callsign[0] == '\0') continue;

        uint8_t age = (uint8_t)(ht->hash >> 22);
        if (age >= max_age) {
            ht->callsign[0] = '\0';
            ht->hash = 0;
            s_callsign_hashtable_size--;
        } else {
            ht->hash = (((uint32_t)age + 1u) << 22) | (ht->hash & 0x3FFFFFu);
        }
    }
}

static void hashtable_add(const char *callsign, uint32_t hash)
{
    uint16_t hash10   = (hash >> 12) & 0x3FFu;
    int      idx_hash = (hash10 * 23) % CALLSIGN_HASHTABLE_MAX;
    callsign_hashtable_t *ht = &s_callsign_hashtable[idx_hash];
    int wrap_idx = -1;

    while (ht->callsign[0] != '\0') {
        if (((ht->hash & 0x3FFFFFu) == hash) &&
            (0 == strncmp(ht->callsign, callsign, 11))) {
            /* Already present — reset age so active calls stay resident. */
            ht->hash &= 0x3FFFFFu;
            return;
        }
        /* Collision: linear probe until an empty slot or full wrap. */
        if (wrap_idx == -1) wrap_idx = idx_hash;
        idx_hash = (idx_hash + 1) % CALLSIGN_HASHTABLE_MAX;
        ht = &s_callsign_hashtable[idx_hash];
        if (idx_hash == wrap_idx) {
            /* Table full — overwrite this entry. */
            s_callsign_hashtable_size--;
            break;
        }
    }

    s_callsign_hashtable_size++;
    strncpy(ht->callsign, callsign, 11);    /* NB: strncpy zero-fills */
    ht->hash = hash;
}

static bool hashtable_lookup(ftx_callsign_hash_type_t hash_type,
                             uint32_t hash, char *callsign)
{
    uint8_t hash_shift = (hash_type == FTX_CALLSIGN_HASH_10_BITS) ? 12
                       : (hash_type == FTX_CALLSIGN_HASH_12_BITS) ? 10 : 0;
    uint16_t hash10   = (hash >> (12 - hash_shift)) & 0x3FFu;
    int      idx_hash = (hash10 * 23) % CALLSIGN_HASHTABLE_MAX;
    callsign_hashtable_t *ht = &s_callsign_hashtable[idx_hash];
    int wrap_idx = -1;

    while (ht->callsign[0] != '\0') {
        if (((ht->hash & 0x3FFFFFu) >> hash_shift) == hash) {
            strncpy(callsign, ht->callsign, 11);
            callsign[11] = '\0';   /* caller's buffer is char[12] and strlen()d */
            return true;
        }
        if (wrap_idx == -1) wrap_idx = idx_hash;
        idx_hash = (idx_hash + 1) % CALLSIGN_HASHTABLE_MAX;
        ht = &s_callsign_hashtable[idx_hash];
        if (idx_hash == wrap_idx) break;
    }

    callsign[0] = '\0';
    return false;
}

static ftx_callsign_hash_interface_t s_hash_if = {
    .lookup_hash = hashtable_lookup,
    .save_hash   = hashtable_add
};

/* ── Monitor, kept alive between calls and reinitialised only on change ───── */
static monitor_t s_mon;
static bool      s_mon_init  = false;
static int       s_mon_rate  = 0;
static int       s_mon_proto = -1;

/* ── 2x upsample (FT2 → FT4) ─────────────────────────────────────────────── */
static void upsample2x(const float *src, int n, float *dst) {
    int i;
    for (i = 0; i < n - 1; i++) {
        dst[2*i]   = src[i];
        dst[2*i+1] = 0.5f * (src[i] + src[i+1]);
    }
    dst[2*i]   = src[i];
    dst[2*i+1] = src[i];
}

/* ── Main entry point ─────────────────────────────────────────────────────── */
int ftx_decode(const float *pcm, int num_samples, int js_protocol, int sample_rate)
{
    s_count = 0;

    if (sample_rate <= 0) sample_rate = DEFAULT_SAMPLE_RATE;

    /* Map JS convention (FT8=0, FT4=1, FT2=2) → C enum (FT4=0, FT8=1) */
    ftx_protocol_t protocol;
    const float   *decode_pcm = pcm;
    int            decode_n   = num_samples;
    float         *up_buf     = NULL;

    if (js_protocol == 0) {
        protocol = FTX_PROTOCOL_FT8;
    } else if (js_protocol == 1) {
        protocol = FTX_PROTOCOL_FT4;
    } else {
        /* FT2: 2x upsample then decode as FT4 at the same declared rate —
           doubling the sample count makes the doubled-rate symbols occupy the
           same number of samples an FT4 symbol would. */
        protocol = FTX_PROTOCOL_FT4;
        decode_n = num_samples * 2;
        up_buf   = (float *)malloc((size_t)decode_n * sizeof(float));
        if (!up_buf) return 0;
        upsample2x(pcm, num_samples, up_buf);
        decode_pcm = up_buf;
    }

    /* The FT2 buffer is stretched 2x in time but still analysed at the original
       declared rate, so every frequency in that domain sits at half its true
       audio value. Scale reported frequencies back up. (This affects only what
       is reported — the decode itself is correct, because an FT2 signal's
       doubled symbol rate and doubled tone spacing both halve into exactly the
       FT4 parameters the decoder expects.) */
    const float freq_scale = (js_protocol == 2) ? 2.0f : 1.0f;

    /* Time runs at half speed in that stretched domain, so a measured time
       offset must be halved to get real seconds — the inverse of freq_scale. */
    const float dt_scale = 1.0f / freq_scale;

    /* Reinit only when the sample rate or protocol changes; otherwise just
       reset, exactly as Kiwi does per slot. */
    if (!s_mon_init || s_mon_rate != sample_rate || s_mon_proto != (int)protocol) {
        if (s_mon_init) monitor_free(&s_mon);
        monitor_config_t cfg = {
            .f_min       = PASSBAND_LO,
            .f_max       = PASSBAND_HI,
            .sample_rate = sample_rate,
            .time_osr    = TIME_OSR,
            .freq_osr    = FREQ_OSR,
            .protocol    = protocol
        };
        monitor_init(&s_mon, &cfg);
        s_mon_init  = true;
        s_mon_rate  = sample_rate;
        s_mon_proto = (int)protocol;
    } else {
        monitor_reset(&s_mon);
    }

    /* Feed the slot one symbol-block at a time, as Kiwi's sample path does. */
    for (int frame_pos = 0;
         frame_pos + s_mon.block_size <= decode_n;
         frame_pos += s_mon.block_size)
    {
        monitor_process(&s_mon, decode_pcm + frame_pos);
    }

    ftx_waterfall_t *wf = &s_mon.wf;

    ftx_candidate_t heap[MAX_CANDIDATES];
    int num_cands = ftx_find_candidates(wf, MAX_CANDIDATES, heap, MIN_SCORE);

    for (int i = 0; i < num_cands && s_count < MAX_RESULTS; i++) {
        ftx_message_t       msg;
        ftx_decode_status_t status;

        if (!ftx_decode_candidate(wf, &heap[i], LDPC_ITERATIONS, &msg, &status))
            continue;
        if (status.ldpc_errors > 0)
            continue;
        if (status.crc_extracted != status.crc_calculated)
            continue;

        /* NB: ftx_message_decode() dereferences `offsets` unconditionally
           (message.c:401) — passing NULL segfaults. */
        char                  text[MSG_BUF_LEN] = {0};
        ftx_message_offsets_t offsets;
        ftx_message_decode(&msg, &s_hash_if, text, &offsets);
        if (text[0] == '\0') continue;

        /* Drop duplicates within the slot (Kiwi dedups via its message hash
           table; a linear scan over <=64 entries is equivalent here). */
        bool dup = false;
        for (int j = 0; j < s_count; j++) {
            if (0 == strcmp(s_results[j].text, text)) { dup = true; break; }
        }
        if (dup) continue;

        /* Kiwi: (min_bin + freq_offset + freq_sub/freq_osr) / symbol_period.
           status.freq is never assigned by ftx_decode_candidate(). */
        float freq_hz = (s_mon.min_bin + heap[i].freq_offset +
                         (float)heap[i].freq_sub / wf->freq_osr)
                        / s_mon.symbol_period * freq_scale;

        /* DT: where the decoded signal actually sat inside the analysis window,
           in seconds. Kiwi's time_sec. This is the residual capture-timing
           error — drive the capture lead-in from it and the client
           self-calibrates instead of relying on a hardcoded constant. */
        float dt = (heap[i].time_offset +
                    (float)heap[i].time_sub / wf->time_osr)
                   * s_mon.symbol_period * dt_scale;

        strncpy(s_results[s_count].text, text, MSG_BUF_LEN - 1);
        s_results[s_count].freq = freq_hz;
        s_results[s_count].snr  = (float)heap[i].score * 0.5f + SNR_ADJ;
        s_results[s_count].dt   = dt;
        s_count++;
    }

    /* Age the callsign table once per slot, as Kiwi does at the end of decode() */
    hashtable_cleanup(CALLSIGN_AGE_MAX);

    free(up_buf);
    return s_count;
}

/* ── Accessors ────────────────────────────────────────────────────────────── */
const char *get_message_text(int i) { return (i>=0&&i<s_count)?s_results[i].text:""; }
float       get_freq(int i)         { return (i>=0&&i<s_count)?s_results[i].freq:0.0f; }
float       get_snr(int i)          { return (i>=0&&i<s_count)?s_results[i].snr:0.0f; }
float       get_dt(int i)           { return (i>=0&&i<s_count)?s_results[i].dt:0.0f; }
