/*
 * cf32_to_real.c — PhantomSDR-Plus helper for the Fobos SDR HF path
 *
 * Reads CF32 on stdin (interleaved float32 I,Q at full scale ±1.0, which is
 * what rx_sdr -F CF32 produces from SoapyFobosSDR) and writes only the real
 * part (I) on stdout as s16 (±32767), the same convention as the other real
 * sources in this project (RX888, format="s16").
 *
 * In direct sampling (direct_samp=1, inputs HF1/HF2) there is no local
 * oscillator: the ADC digitises 0-25 MHz and the samples arrive in I. Keeping
 * I at 50 Msps gives spectrumserver a real 0-25 MHz stream (signal="real").
 *
 * Used by start-fobos-hf.sh:
 *   rx_sdr -d driver=fobos -t direct_samp=1 -f 0 -s 50000000 \
 *       -I CF32 -F CF32 - | ./cf32_to_real | spectrumserver ...
 *
 * Built by setup-fobos.sh (install.sh option 5):
 *   gcc -O3 -Wall -o cf32_to_real cf32_to_real.c -lm
 */
#include <stdio.h>
#include <stdlib.h>
#include <stdint.h>
#include <math.h>

#define BUF_SAMPLES (1 << 16)

int main(void) {
    static float   in_buf[BUF_SAMPLES * 2];
    static int16_t out_buf[BUF_SAMPLES];

    setvbuf(stdin, NULL, _IOFBF, 1 << 20);
    setvbuf(stdout, NULL, _IOFBF, 1 << 20);

    size_t n;
    while ((n = fread(in_buf, sizeof(float) * 2, BUF_SAMPLES, stdin)) > 0) {
        for (size_t i = 0; i < n; i++) {
            float v = in_buf[i * 2] * 32767.0f;
            if (v > 32767.0f)  v = 32767.0f;
            if (v < -32768.0f) v = -32768.0f;
            out_buf[i] = (int16_t) lrintf(v);
        }
        /* A failed write means spectrumserver is gone. Exiting makes rx_sdr
         * take SIGPIPE, so the watchdog sees the chain down and restarts it. */
        if (fwrite(out_buf, sizeof(int16_t), n, stdout) != n) {
            fprintf(stderr, "cf32_to_real: write to stdout failed\n");
            return 1;
        }
    }
    return 0;
}
