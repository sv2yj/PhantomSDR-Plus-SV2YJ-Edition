/**
 * ft4_wasm_glue.c
 * WASM glue for kgoba/ft8_lib — FT8 and FT4 decoding.
 *
 * CRITICAL: NFFT must match the tone spacing of each mode:
 *   FT8 — 8-FSK, tone spacing = 6.25 Hz  → NFFT = 12000/6.25  = 1920
 *   FT4 — 4-FSK, tone spacing = 20.83 Hz → NFFT = 12000/20.83 = 576
 *
 * Exported functions:
 *   int   ftx_decode(float* pcm, int num_samples, int protocol)
 *             protocol: 0 = FT8, 1 = FT4
 *             returns: number of decoded messages
 *   char* get_message_text(int index)
 *   float get_freq(int index)
 *   float get_snr(int index)
 */

#include <stdint.h>
#include <stdbool.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>

#include "ft8/constants.h"
#include "ft8/message.h"
#include "ft8/decode.h"
#include "fft/kiss_fftr.h"

#define SAMPLE_RATE  12000
#define TIME_OSR     2
#define FREQ_OSR     1

/* FT8 — 6.25 Hz bins */
#define NFFT_FT8     1920
#define NUM_BINS_FT8 (NFFT_FT8 / 2)   /* 960 */
#define TONE_HZ_FT8  6.25f

/* FT4 — 20.833 Hz bins */
#define NFFT_FT4     576
#define NUM_BINS_FT4 (NFFT_FT4 / 2)   /* 288 */
#define TONE_HZ_FT4  (SAMPLE_RATE / (float)NFFT_FT4)   /* 20.833... Hz */

#define MAX_DECODED 50

typedef struct {
    char  text[FTX_MAX_MESSAGE_LENGTH + 1];
    float freq;
    float snr;
} DecodedMsg;

static DecodedMsg g_decoded[MAX_DECODED];
static int        g_num_decoded = 0;

/* Pre-computed Hann windows for each NFFT */
static float g_hann_ft8[NFFT_FT8];
static float g_hann_ft4[NFFT_FT4];
static int   g_hann_ready = 0;

static void init_hann(void) {
    if (g_hann_ready) return;
    for (int i = 0; i < NFFT_FT8; i++)
        g_hann_ft8[i] = 0.5f - 0.5f * cosf(2.0f * (float)M_PI * i / NFFT_FT8);
    for (int i = 0; i < NFFT_FT4; i++)
        g_hann_ft4[i] = 0.5f - 0.5f * cosf(2.0f * (float)M_PI * i / NFFT_FT4);
    g_hann_ready = 1;
}

/* ── Main decode function ─────────────────────────────────────────────────── */
int ftx_decode(float* pcm, int num_samples, int protocol)
{
    g_num_decoded = 0;
    init_hann();

    ftx_protocol_t proto = (protocol == 1) ? FTX_PROTOCOL_FT4 : FTX_PROTOCOL_FT8;

    /* Protocol-dependent parameters */
    int   nfft          = (proto == FTX_PROTOCOL_FT4) ? NFFT_FT4     : NFFT_FT8;
    int   num_bins      = (proto == FTX_PROTOCOL_FT4) ? NUM_BINS_FT4 : NUM_BINS_FT8;
    float tone_hz       = (proto == FTX_PROTOCOL_FT4) ? TONE_HZ_FT4  : TONE_HZ_FT8;
    float symbol_period = (proto == FTX_PROTOCOL_FT4) ? FT4_SYMBOL_PERIOD : FT8_SYMBOL_PERIOD;
    int   num_symbols   = (proto == FTX_PROTOCOL_FT4) ? FT4_NN           : FT8_NN;
    float *hann         = (proto == FTX_PROTOCOL_FT4) ? g_hann_ft4        : g_hann_ft8;

    /* Samples per TIME_OSR sub-block */
    int step = (int)(symbol_period * SAMPLE_RATE / TIME_OSR);

    int num_blocks = num_symbols;
    int wf_size    = num_blocks * TIME_OSR * FREQ_OSR * num_bins;

    uint8_t* wf_mag = (uint8_t*)malloc(wf_size);
    if (!wf_mag) return 0;

    /* ── Build waterfall ─────────────────────────────────────────────────── */
    kiss_fftr_cfg cfg = kiss_fftr_alloc(nfft, 0, NULL, NULL);
    if (!cfg) { free(wf_mag); return 0; }

    float*        win_buf = (float*)        malloc(nfft       * sizeof(float));
    kiss_fft_cpx* fft_out = (kiss_fft_cpx*) malloc((nfft/2+1) * sizeof(kiss_fft_cpx));

    if (!win_buf || !fft_out) {
        free(wf_mag); kiss_fftr_free(cfg);
        if (win_buf) free(win_buf);
        if (fft_out) free(fft_out);
        return 0;
    }

    for (int block = 0; block < num_blocks; block++) {
        for (int t_sub = 0; t_sub < TIME_OSR; t_sub++) {
            int sample_start = (block * TIME_OSR + t_sub) * step;

            for (int i = 0; i < nfft; i++) {
                int idx = sample_start + i;
                float s = (idx < num_samples) ? pcm[idx] : 0.0f;
                win_buf[i] = s * hann[i];
            }

            kiss_fftr(cfg, win_buf, fft_out);

            int wf_offset = ((block * TIME_OSR + t_sub) * FREQ_OSR) * num_bins;
            for (int bin = 0; bin < num_bins; bin++) {
                float re  = fft_out[bin].r;
                float im  = fft_out[bin].i;
                float pwr = re*re + im*im;
                float pwr_db = 10.0f * log10f(pwr / ((float)(nfft * nfft)) + 1e-12f);
                /* Encode: byte = (dB + 120) * 2  (range -120..7.5 dB → 0..255) */
                float enc = (pwr_db + 120.0f) * 2.0f;
                if (enc <   0.0f) enc =   0.0f;
                if (enc > 255.0f) enc = 255.0f;
                wf_mag[wf_offset + bin] = (uint8_t)enc;
            }
        }
    }

    kiss_fftr_free(cfg);
    free(win_buf);
    free(fft_out);

    /* ── Run ft8_lib decoder ─────────────────────────────────────────────── */
    ftx_waterfall_t wf = {
        .max_blocks   = num_blocks,
        .num_blocks   = num_blocks,
        .num_bins     = num_bins,
        .time_osr     = TIME_OSR,
        .freq_osr     = FREQ_OSR,
        .mag          = wf_mag,
        .block_stride = TIME_OSR * FREQ_OSR * num_bins,
        .protocol     = proto,
    };

    ftx_candidate_t candidates[100];
    int num_candidates = ftx_find_candidates(&wf, 100, candidates, 0);

    ftx_message_t       message;
    ftx_decode_status_t status;

    for (int i = 0; i < num_candidates && g_num_decoded < MAX_DECODED; i++) {
        if (!ftx_decode_candidate(&wf, &candidates[i], 50, &message, &status))
            continue;

        char msg_text[FTX_MAX_MESSAGE_LENGTH + 1] = {0};
        ftx_message_decode(&message, NULL, msg_text, NULL);

        float freq = (candidates[i].freq_offset +
                      (float)candidates[i].freq_sub / FREQ_OSR) * tone_hz;
        float snr  = (float)candidates[i].score / 10.0f;

        /* Deduplicate */
        int dup = 0;
        for (int j = 0; j < g_num_decoded; j++) {
            if (strcmp(g_decoded[j].text, msg_text) == 0) { dup = 1; break; }
        }
        if (dup) continue;

        strncpy(g_decoded[g_num_decoded].text, msg_text, FTX_MAX_MESSAGE_LENGTH);
        g_decoded[g_num_decoded].freq = freq;
        g_decoded[g_num_decoded].snr  = snr;
        g_num_decoded++;
    }

    free(wf_mag);
    return g_num_decoded;
}

/* ── Result accessors ────────────────────────────────────────────────────── */
const char* get_message_text(int index) {
    if (index < 0 || index >= g_num_decoded) return "";
    return g_decoded[index].text;
}

float get_freq(int index) {
    if (index < 0 || index >= g_num_decoded) return 0.0f;
    return g_decoded[index].freq;
}

float get_snr(int index) {
    if (index < 0 || index >= g_num_decoded) return 0.0f;
    return g_decoded[index].snr;
}
