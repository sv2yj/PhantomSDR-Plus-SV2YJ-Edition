/**
 * decodeworker.js — worker_thread that runs one decoder invocation off the
 * main thread. One of these runs per pool slot (see pool.js). Each worker holds
 * its OWN wasm instance (ft8_lib), so decodes are fully isolated and can run in
 * parallel across the pool.
 *
 * Protocol (parentPort):
 *   in:  { id, type: 'ft8'|'ft4'|'ft2'|'js8'|'wspr', pcm: Float32Array,
 *          sampleRate, dialFreqHz?, submode? }
 *   out: { id, results, error? }
 *
 * The wasm-shim must be imported before the decoders so ft4.js can load its
 * wasm from disk (it fetches an absolute URL that only resolves in a browser).
 */
import { parentPort } from 'node:worker_threads';
import './wasm-shim.js';
import { decodeFT8viaLib, decodeFT4, decodeFT2 } from '../frontend/src/modules/ft4.js';
import { decodeWSPR }                            from '../frontend/src/modules/wspr.js';
import { decodeJS8 }                             from '../frontend/src/modules/js8-decoder.js';
import { decodeFrame as js8DecodeFrame }         from '../frontend/src/modules/js8.js';

parentPort.on('message', async (msg) => {
    const { id, type, pcm, sampleRate, dialFreqHz, submode } = msg;
    try {
        let results;
        switch (type) {
            case 'ft8':  results = await decodeFT8viaLib(pcm, sampleRate); break;
            case 'ft4':  results = await decodeFT4(pcm, sampleRate); break;
            case 'ft2':  results = await decodeFT2(pcm, sampleRate); break;
            case 'js8': {
                // Frames are turned into structured messages here rather than in
                // index.js, so the parsing stays off the reporter's main thread.
                // The JSC dictionary is deliberately NOT loaded: it only affects
                // the TEXT of compressed data frames, and a data frame carries no
                // callsign, so it is never spottable.
                const raw = await decodeJS8(pcm, submode ?? 0, sampleRate);
                results = raw.map((r) => ({
                    ...js8DecodeFrame(r.payload, r.i3bit),
                    freq: r.freq, snr: r.snr, dt: r.dt, i3bit: r.i3bit,
                }));
                break;
            }
            case 'wspr': results = await decodeWSPR(pcm, sampleRate, dialFreqHz); break;
            default: throw new Error(`unknown decode type: ${type}`);
        }
        parentPort.postMessage({ id, results: results ?? [] });
    } catch (err) {
        parentPort.postMessage({ id, results: [], error: err?.message ?? String(err) });
    }
});
