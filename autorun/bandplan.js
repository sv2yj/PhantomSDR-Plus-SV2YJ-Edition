/**
 * bandplan.js — standard USB dial frequencies for FT8 / FT4 / JS8 / WSPR.
 * FT8/FT4 span 160m–10m; WSPR additionally covers 2200m/630m (LF/MF) and an
 * extra 80m EU channel.
 *
 * All values are the conventional *dial* frequency in Hz (the USB suppressed
 * carrier). The transmitted signal sits above the dial in the audio passband:
 *   FT8/FT4 occupy roughly dial+0 .. dial+3000 Hz
 *   WSPR    occupies roughly dial+1400 .. dial+1600 Hz
 *
 * 6m (50 MHz) is intentionally absent: the RX888 runs at sps=60 MHz → 30 MHz
 * Nyquist, so 6m is not in the sampled window. Everything here is < 30 MHz.
 */

export const DIAL = {
    ft8: {
        '160m': 1840000,
        '80m':  3573000,
        '60m':  5357000,
        '40m':  7074000,
        '30m':  10136000,
        '20m':  14074000,
        '17m':  18100000,
        '15m':  21074000,
        '12m':  24915000,
        '10m':  28074000,
    },
    ft4: {
        '80m':  3575000,
        '40m':  7047500,
        '30m':  10140000,
        '20m':  14080000,
        '17m':  18104000,
        '15m':  21140000,
        '12m':  24919000,
        '10m':  28180000,
    },
    // JS8 calling frequencies, from JS8Call's own FrequencyList.cpp. 6m and 2m
    // are in that list too but are above the RX888's 30 MHz Nyquist, and there
    // is no 60m JS8 channel.
    js8: {
        '160m': 1842000,
        '80m':  3578000,
        '40m':  7078000,
        '30m':  10130000,
        '20m':  14078000,
        '17m':  18104000,
        '15m':  21078000,
        '12m':  24922000,
        '10m':  28078000,
    },
    wspr: {
        '2200m': 136000,   // LF WSPR (MkII direct-sampling; watch the front-end HPF)
        '630m':  474200,   // MF WSPR
        '160m': 1836600,   // 160m. WSPR 
        '80m':  3568600,   // 80m. WSPR
        '80mEU': 3592600,  // extra 80m WSPR channel requested for EU coverage
        '60m':  5287200,   // 60m WSPR (was 5364700; changed on request)
        '40m':  7038600,   // 40m. WSPR
        '30m':  10138700,  // 30m. WSPR
        '20m':  14095600,  // 20m. WSPR
        '17m':  18104600,  // 17m. WSPR
        '15m':  21094600,  // 15m. WSPR
        '12m':  24924600,  // 12m. WSPR
        '10m':  28124600,  // 10m. WSPR
    },
};

// Audio window above the dial that must be extracted per mode, in Hz.
// FT8/FT4 want the full ~3 kHz sub-band; WSPR only needs a margin around
// 1400–1600 Hz but we take the same 3 kHz for simplicity (cheap, and lets the
// WSPR front-end find the signal regardless of exact placement).
export const AUDIO_SPAN_HZ = 3000;

/** Look up a dial frequency; throws on an unknown mode/band combo. */
export function dialFreq(mode, band) {
    const table = DIAL[mode];
    if (!table) throw new Error(`unknown mode: ${mode}`);
    const hz = table[band];
    if (hz === undefined) throw new Error(`no ${mode} dial for band ${band}`);
    return hz;
}
