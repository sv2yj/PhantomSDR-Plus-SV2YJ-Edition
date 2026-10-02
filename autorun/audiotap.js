/**
 * audiotap.js — one internal /audio client that pulls raw PCM for a band.
 *
 * Connects to the spectrumserver as an authenticated loopback client
 * (/audio?tap=<token>), requests the raw-PCM codec, tunes to a dial frequency in
 * USB, and emits decoded Float32 mono samples. One AudioTap == one band slot.
 *
 * Events:
 *   'ready'  (info)              — after basic_info parsed and tuning sent
 *   'pcm'    (Float32Array)      — a chunk of mono samples in [-1, 1)
 *   'error'  (Error)
 *   'close'  (code, reason)
 *
 * basic_info arrives as a TEXT frame (JSON); audio packets as BINARY (CBOR),
 * where with codec "pcm" the `data` field is raw int16 little-endian.
 */
import { EventEmitter } from 'node:events';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { WebSocket } from 'ws';
import { decode as cborDecode } from 'cbor-x';
import { AUDIO_SPAN_HZ } from './bandplan.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_TOKEN_PATH = join(__dirname, '..', '.tap_token');

export class AudioTap extends EventEmitter {
    /**
     * @param {object} opts
     * @param {number} opts.dialHz   USB dial frequency to tune.
     * @param {string} [opts.mode]   demodulation ('USB' for FT8/FT4/WSPR).
     * @param {number} [opts.spanHz] audio span above the dial to extract.
     * @param {string} [opts.host]   server host (default 127.0.0.1).
     * @param {number} [opts.port]   server port (default 8900).
     * @param {string} [opts.tokenPath] path to .tap_token.
     * @param {string} [opts.label]  human label for logs.
     */
    constructor(opts) {
        super();
        this.dialHz = opts.dialHz;
        this.mode = opts.mode ?? 'USB';
        this.spanHz = opts.spanHz ?? AUDIO_SPAN_HZ;
        this.host = opts.host ?? '127.0.0.1';
        this.port = opts.port ?? 8900;
        this.tokenPath = opts.tokenPath ?? DEFAULT_TOKEN_PATH;
        this.label = opts.label ?? `${this.mode}@${this.dialHz}`;
        // Enable the server-side AGC so the raw tap reaches healthy levels for
        // decoding (the browser normally applies AGC + gain; the tap gets neither).
        this.agc = opts.agc ?? true;

        this.info = null;         // basic_info once received
        this.sampleRate = null;   // audio_max_sps
        this._ws = null;
        this._gotInfo = false;
    }

    connect() {
        let token;
        try {
            token = readFileSync(this.tokenPath, 'utf8').trim();
        } catch (err) {
            this.emit('error', new Error(`cannot read tap token at ${this.tokenPath}: ${err.message}`));
            return;
        }
        const url = `ws://${this.host}:${this.port}/audio?tap=${token}`;
        const ws = new WebSocket(url);
        this._ws = ws;

        ws.on('open', () => { /* wait for basic_info before tuning */ });
        ws.on('message', (data, isBinary) => this._onMessage(data, isBinary));
        ws.on('error', (err) => this.emit('error', err));
        ws.on('close', (code, reasonBuf) => {
            this.emit('close', code, reasonBuf?.toString?.() ?? '');
        });
    }

    close() {
        try { this._ws?.close(); } catch { /* ignore */ }
    }

    _send(obj) {
        if (this._ws && this._ws.readyState === WebSocket.OPEN) {
            this._ws.send(JSON.stringify(obj));
        }
    }

    _onMessage(data, isBinary) {
        if (!isBinary) {
            // First text frame is basic_info. Parse, then tune.
            if (this._gotInfo) return;
            let info;
            try {
                info = JSON.parse(data.toString());
            } catch (err) {
                this.emit('error', new Error(`bad basic_info JSON: ${err.message}`));
                return;
            }
            this._gotInfo = true;
            this.info = info;
            this.sampleRate = info.audio_max_sps;
            this._tune(info);
            this.emit('ready', info);
            return;
        }
        // Binary: CBOR audio packet.
        let packet;
        try {
            packet = cborDecode(data);
        } catch (err) {
            return; // skip malformed packet
        }
        if (packet.codec !== 'pcm' || !packet.data) return;
        const f32 = this._pcmToFloat32(packet.data);
        if (f32.length) this.emit('pcm', f32);
    }

    _tune(info) {
        const binOf = (freqHz) =>
            ((freqHz - info.basefreq) / info.total_bandwidth) * info.fft_result_size;

        // Exactly what the browser sends for USB (demodulationDefaults USB
        // offsets [0, 2700]): l = m = dial (carrier at the passband's lower edge),
        // r = dial + span. audio 0 Hz = dial, so FT8 signals (dial+200..dial+3000)
        // land at audio 200..3000 Hz — the range ft8_lib expects.
        const m = binOf(this.dialHz);
        const l = binOf(this.dialHz);
        const r = binOf(this.dialHz + this.spanHz);

        const lI = Math.floor(l), rI = Math.ceil(r);
        this._send({ cmd: 'set_codec', codec: 'pcm' });
        if (this.agc) this._send({ cmd: 'agc_enable', enabled: true });
        this._send({ cmd: 'demodulation', demodulation: this.mode });
        this._send({ cmd: 'window', l: lI, m, r: rI });

        // The server debounces demodulation changes for 100 ms, and its debounce
        // timer starts at connection — so a demodulation command sent immediately
        // is DROPPED, leaving the client on the config default (often LSB). Resend
        // it (and the window) once the debounce window has passed so USB actually
        // takes effect. Without this the tap silently decodes the wrong sideband.
        setTimeout(() => {
            this._send({ cmd: 'demodulation', demodulation: this.mode });
            this._send({ cmd: 'window', l: lI, m, r: rI });
        }, 250);
    }

    /** Convert a raw int16-LE buffer to Float32 in [-1, 1). Copies for alignment. */
    _pcmToFloat32(buf) {
        // cbor-x hands back a Node Buffer / Uint8Array; byteOffset may be odd,
        // so copy into a fresh, 2-byte-aligned ArrayBuffer before viewing as i16.
        const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
        const n = bytes.byteLength >> 1; // whole int16 samples
        const aligned = new ArrayBuffer(n * 2);
        new Uint8Array(aligned).set(bytes.subarray(0, n * 2));
        const i16 = new Int16Array(aligned);
        const f32 = new Float32Array(n);
        for (let i = 0; i < n; i++) f32[i] = i16[i] / 32768;
        return f32;
    }
}
