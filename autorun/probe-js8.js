/**
 * probe-js8.js — decode live JS8 off the air and print what comes out.
 *
 * The one thing the JS8 test suite cannot do: everything else is validated
 * against JS8Call or against synthesised audio from our own encoder. This
 * points the decoder at a real band and shows whether real stations decode.
 *
 * It runs the full chain — tap → wasm → frame decode → reassembly — so
 * multi-frame messages appear as whole sentences, not fragments.
 *
 * Usage:  node autorun/probe-js8.js [band] [submode]
 *           band     20m (default), 40m, 30m, …  see bandplan.js
 *           submode  0=Normal (default) 1=Fast 2=Turbo 3=Slow 4=Ultra
 *
 * Requires the spectrumserver running and ./.tap_token present.
 */
import './wasm-shim.js'; // MUST precede the decoder import (installs fetch shim)
import { decodeJS8 } from '../frontend/src/modules/js8-decoder.js';
import { decodeFrame, loadDictionary } from '../frontend/src/modules/js8.js';
import { Js8Reassembler } from '../frontend/src/modules/js8-reassembler.js';
import { formatJs8Message, formatJs8Frame } from '../frontend/src/modules/js8-format.js';
import { SUBMODE_NAMES, SUBMODE_PERIOD_S, SUBMODE_TXDUR_S } from '../frontend/src/modules/js8-tables.js';
import { AudioTap } from './audiotap.js';
import { dialFreq } from './bandplan.js';

const band = process.argv[2] ?? '20m';
const submode = Number(process.argv[3] ?? 0);
if (!Number.isInteger(submode) || submode < 0 || submode >= SUBMODE_NAMES.length) {
    console.error(`[probe] submode must be 0..${SUBMODE_NAMES.length - 1}`);
    process.exit(1);
}

const dialHz = dialFreq('js8', band);
const PERIOD_S = SUBMODE_PERIOD_S[submode];
const WINDOW_S = SUBMODE_TXDUR_S[submode];

let sampleRate = 12000;
let ring = null, ringCap = 0, ringLen = 0;

function ensureRing() {
    if (ring) return;
    ringCap = Math.ceil(sampleRate * (WINDOW_S + 2));
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

// Whole messages, once the reassembler has them.
const reassembler = new Js8Reassembler({
    onMessage: (m) => {
        const stamp = new Date().toISOString().slice(11, 19);
        const tag = m.complete ? ' ' : '~';   // '~' = closed by timeout, may be cut short
        console.log(`[${stamp}] ${tag} MESSAGE  ${String(Math.round(m.freq)).padStart(4)}Hz  ` +
                    `${String(m.snr ?? '').padStart(3)}dB  ${m.frames}f  ${formatJs8Message(m)}`);
    },
});

let decoding = false;
let dictWanted = false;

async function decodeSlot() {
    if (decoding) return;
    const window = trailingWindow(WINDOW_S);
    const haveS = window.length / sampleRate;
    if (haveS < WINDOW_S - 1.5) return;

    decoding = true;
    const t0 = Date.now();
    try {
        const raw = await decodeJS8(Float32Array.from(window), submode, sampleRate);
        const ms = Date.now() - t0;
        const stamp = new Date().toISOString().slice(11, 19);

        if (!raw.length) {
            console.log(`[${stamp}] ${band} JS8/${SUBMODE_NAMES[submode]}: 0 frames  (${ms}ms)`);
        } else {
            console.log(`[${stamp}] ${band} JS8/${SUBMODE_NAMES[submode]}: ${raw.length} frames  (${ms}ms)`);
        }

        const now = Date.now();
        for (const r of raw) {
            const frame = decodeFrame(r.payload, r.i3bit);

            // Compressed data frames need the JSC dictionary; fetch it the
            // first time one appears, and it will decode from the next slot on.
            if (frame.needsDictionary && !dictWanted) {
                dictWanted = true;
                console.log('[probe] compressed frame seen — loading the JSC dictionary');
                loadDictionary().catch((e) => console.error('[probe] dictionary:', e.message));
            }

            const flags = [frame.isFirst ? 'F' : '', frame.isLast ? 'L' : ''].join('') || '-';
            console.log(
                `    ${String(Math.round(r.snr)).padStart(3)} dB  ` +
                `${r.dt.toFixed(1).padStart(5)}s  ` +
                `${r.freq.toFixed(0).padStart(4)}Hz  ` +
                `(${((dialHz + r.freq) / 1e6).toFixed(4)} MHz)  ` +
                `${flags.padEnd(2)} ${frame.kind.padEnd(9)} ${formatJs8Frame(frame)}`
            );

            reassembler.addFrame(frame, {
                freq: r.freq, submode, snr: Math.round(r.snr), dt: r.dt, time: now,
            });
        }
        reassembler.tick(now);
    } catch (err) {
        console.error('[probe] decode error:', err.message);
    } finally {
        decoding = false;
    }
}

function scheduleSlots() {
    const periodMs = PERIOD_S * 1000;
    const msToNext = periodMs - (Date.now() % periodMs);
    console.log(`[probe] first decode in ${(msToNext / 1000).toFixed(1)}s, then every ${PERIOD_S}s`);
    setTimeout(() => {
        decodeSlot();
        setInterval(decodeSlot, periodMs);
    }, msToNext);
}

console.log(`[probe] JS8 ${band} ${SUBMODE_NAMES[submode]} ` +
            `dial=${(dialHz / 1e6).toFixed(4)} MHz — connecting…`);

const tap = new AudioTap({ dialHz, mode: 'USB', label: `JS8 ${band}` });

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
