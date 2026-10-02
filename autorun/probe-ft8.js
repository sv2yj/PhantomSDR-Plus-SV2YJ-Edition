/**
 * probe-ft8.js — phase-1 milestone: prove the PCM tap → decoder chain in Node.
 *
 * Tunes ONE FT8 band via the internal PCM tap, aligns to the 15 s FT8 slot
 * boundary, decodes each cycle, and prints the decodes. No uploaders, no admin,
 * no worker pool yet — just end-to-end validation that the server-side tap and
 * the reused browser decoder work together under Node.
 *
 * Usage:  node autorun/probe-ft8.js [band]      (default band: 20m)
 * Requires the spectrumserver running and ./.tap_token present.
 */
import './wasm-shim.js'; // MUST precede the decoder import (installs fetch shim)
import { decodeFT8viaLib } from '../frontend/src/modules/ft4.js';
import { AudioTap } from './audiotap.js';
import { dialFreq } from './bandplan.js';

const band = process.argv[2] ?? '20m';
const dialHz = dialFreq('ft8', band);

const FT8_PERIOD_S = 15;
const WINDOW_S = 15;       // decode the trailing 15 s at each slot boundary
let sampleRate = 12000;    // set from basic_info

// Rolling PCM buffer (~17 s) so a full 15 s window is always available.
let ring = null;           // Float32Array
let ringCap = 0;
let ringLen = 0;

function ensureRing() {
    if (ring) return;
    ringCap = Math.ceil(sampleRate * 17);
    ring = new Float32Array(ringCap);
    ringLen = 0;
}

function pushSamples(f32) {
    ensureRing();
    if (f32.length >= ringCap) {
        ring.set(f32.subarray(f32.length - ringCap));
        ringLen = ringCap;
        return;
    }
    if (ringLen + f32.length > ringCap) {
        const drop = ringLen + f32.length - ringCap;
        ring.copyWithin(0, drop, ringLen);
        ringLen -= drop;
    }
    ring.set(f32, ringLen);
    ringLen += f32.length;
}

function trailingWindow(seconds) {
    const want = Math.min(ringLen, Math.ceil(sampleRate * seconds));
    return ring.subarray(ringLen - want, ringLen);
}

let decoding = false;
async function decodeSlot() {
    if (decoding) return;
    const window = trailingWindow(WINDOW_S);
    const haveS = window.length / sampleRate;
    if (haveS < WINDOW_S - 1.5) {
        console.log(`[probe] slot @ ${new Date().toISOString()} — only ${haveS.toFixed(1)}s buffered, skipping`);
        return;
    }
    decoding = true;
    const t0 = Date.now();
    try {
        const results = await decodeFT8viaLib(Float32Array.from(window), sampleRate);
        const dt = ((Date.now() - t0) / 1000).toFixed(2);
        const stamp = new Date().toISOString().slice(11, 19);
        if (!results || results.length === 0) {
            console.log(`[${stamp}] ${band} FT8: 0 decodes  (${dt}s)`);
        } else {
            console.log(`[${stamp}] ${band} FT8: ${results.length} decodes  (${dt}s)`);
            for (const r of results) {
                const audioHz = (dialHz + (r.freq ?? 0));
                console.log(
                    `    ${(r.snr ?? 0).toString().padStart(3)} dB  ` +
                    `${(r.dt ?? 0).toFixed(1).padStart(5)}s  ` +
                    `${((r.freq ?? 0)).toFixed(0).padStart(4)}Hz  ` +
                    `(${(audioHz / 1e6).toFixed(4)} MHz)  ${r.text}`
                );
            }
        }
    } catch (err) {
        console.error('[probe] decode error:', err.message);
    } finally {
        decoding = false;
    }
}

// Align a timer to the next FT8 slot boundary, then every 15 s.
function scheduleSlots() {
    const now = Date.now();
    const periodMs = FT8_PERIOD_S * 1000;
    const msToNext = periodMs - (now % periodMs);
    console.log(`[probe] first decode in ${(msToNext / 1000).toFixed(1)}s, then every ${FT8_PERIOD_S}s`);
    setTimeout(() => {
        decodeSlot();
        setInterval(decodeSlot, periodMs);
    }, msToNext);
}

console.log(`[probe] FT8 ${band} dial=${(dialHz / 1e6).toFixed(4)} MHz — connecting…`);

const tap = new AudioTap({ dialHz, mode: 'USB', label: `FT8 ${band}` });

tap.on('ready', (info) => {
    sampleRate = info.audio_max_sps || 12000;
    console.log(`[probe] tuned. audio_max_sps=${sampleRate} basefreq=${info.basefreq} bw=${info.total_bandwidth}`);
    scheduleSlots();
});
tap.on('pcm', pushSamples);
tap.on('error', (err) => console.error('[probe] tap error:', err.message));
tap.on('close', (code, reason) => {
    console.error(`[probe] tap closed: ${code} ${reason}`);
    process.exit(1);
});

tap.connect();
