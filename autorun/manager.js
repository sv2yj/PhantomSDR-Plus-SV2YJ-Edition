/**
 * manager.js — the autorun engine. Owns one AudioTap per (band, mode) slot,
 * accumulates PCM into a rolling window, and at each mode's T/R boundary submits
 * the trailing window to the shared DecodePool. Emits 'decode' with the results
 * plus slot metadata; uploaders/UI consume that. No reporting here.
 *
 * All digital modes are received as USB at the mode's standard dial frequency;
 * the slot "mode" (ft8/ft4/js8/wspr) only selects the decoder and the slot timing.
 *
 * Events:
 *   'ready'  ({band, mode, sampleRate})    — a slot's tap tuned
 *   'decode' ({band, mode, dialHz, sampleRate, results, decodeMs})
 *   'error'  (Error, {band, mode})
 */
import { EventEmitter } from 'node:events';
import { AudioTap } from './audiotap.js';
import { DecodePool } from './pool.js';
import { dialFreq } from './bandplan.js';

// T/R period and capture window per mode (seconds). The window is a hair under
// the period for FT4/WSPR so we never straddle two transmissions.
export const MODE_TIMING = {
    ft8:  { periodS: 15,  windowS: 15 },
    ft4:  { periodS: 7.5, windowS: 7.5 },
    // JS8 Normal only. The other speeds exist, but a spotting receiver wants
    // the calling speed: that is where heartbeats and CQs live, and it is the
    // one every station can hear. Running several speeds would need one tap
    // per speed on the same dial for little gain.
    js8:  { periodS: 15,  windowS: 15 },
    wspr: { periodS: 120, windowS: 116 },
};

class Slot {
    constructor({ band, mode, host, port }) {
        this.band = band;
        this.mode = mode;
        this.dialHz = dialFreq(mode, band);
        this.timing = MODE_TIMING[mode];
        if (!this.timing) throw new Error(`no timing for mode ${mode}`);
        this.sampleRate = 12000;
        this.tap = new AudioTap({ dialHz: this.dialHz, mode: 'USB', host, port,
                                  label: `${mode} ${band}` });
        this.ring = null;
        this.ringCap = 0;
        this.ringLen = 0;
        this._timer = null;
        this._interval = null;
    }

    _ensureRing() {
        if (this.ring) return;
        // ~1.15x the window so a full window is always available across a boundary.
        this.ringCap = Math.ceil(this.sampleRate * this.timing.windowS * 1.15);
        this.ring = new Float32Array(this.ringCap);
        this.ringLen = 0;
    }

    push(f32) {
        this._ensureRing();
        if (f32.length >= this.ringCap) {
            this.ring.set(f32.subarray(f32.length - this.ringCap));
            this.ringLen = this.ringCap;
            return;
        }
        if (this.ringLen + f32.length > this.ringCap) {
            const drop = this.ringLen + f32.length - this.ringCap;
            this.ring.copyWithin(0, drop, this.ringLen);
            this.ringLen -= drop;
        }
        this.ring.set(f32, this.ringLen);
        this.ringLen += f32.length;
    }

    /** Owned copy of the trailing `windowS` seconds (safe to hand to the pool). */
    trailingWindow() {
        const want = Math.min(this.ringLen, Math.ceil(this.sampleRate * this.timing.windowS));
        return this.ring.slice(this.ringLen - want, this.ringLen);
    }

    stop() {
        if (this._timer) clearTimeout(this._timer);
        if (this._interval) clearInterval(this._interval);
        this.tap.close();
    }
}

export class AutorunManager extends EventEmitter {
    /**
     * @param {object} opts
     * @param {Array<{band:string,mode:string}>} opts.slots
     * @param {number} [opts.poolSize=4]
     * @param {string} [opts.host] @param {number} [opts.port]
     */
    constructor({ slots = [], poolSize = 4, host, port } = {}) {
        super();
        this.pool = new DecodePool(poolSize);
        this.slots = [];
        this._stopping = false;
        this._decoding = new Set(); // slot keys currently queued/decoding (skip overlap)
        for (const spec of slots) this._addSlot({ ...spec, host, port });
    }

    _addSlot(spec) {
        const slot = new Slot(spec);
        this.slots.push(slot);

        slot.tap.on('ready', (info) => {
            slot.sampleRate = info.audio_max_sps || 12000;
            this.emit('ready', { band: slot.band, mode: slot.mode, sampleRate: slot.sampleRate });
            this._schedule(slot);
        });
        slot.tap.on('pcm', (f32) => slot.push(f32));
        slot.tap.on('error', (err) => this.emit('error', err, { band: slot.band, mode: slot.mode }));
        slot.tap.on('close', (code, reason) => {
            if (this._stopping) return; // expected during shutdown
            this.emit('error', new Error(`tap closed ${code} ${reason}`), { band: slot.band, mode: slot.mode });
        });
        slot.tap.connect();
    }

    _schedule(slot) {
        const periodMs = slot.timing.periodS * 1000;
        const msToNext = periodMs - (Date.now() % periodMs);
        slot._timer = setTimeout(() => {
            this._decodeSlot(slot);
            slot._interval = setInterval(() => this._decodeSlot(slot), periodMs);
        }, msToNext);
    }

    async _decodeSlot(slot) {
        const key = `${slot.mode}:${slot.band}`;
        if (this._decoding.has(key)) return; // previous decode still in flight
        const window = slot.trailingWindow();
        const haveS = window.length / slot.sampleRate;
        if (haveS < slot.timing.windowS - 1.5) return; // not enough buffered yet

        this._decoding.add(key);
        const t0 = Date.now();
        // The decode fires ~at a T/R boundary; the window covers the slot that
        // just ended. slotTime = that slot's UTC start (what the reporters want).
        const periodS = slot.timing.periodS;
        const boundary = Math.round(t0 / 1000 / periodS) * periodS;
        const slotTime = boundary - periodS;
        try {
            const { results, error } = await this.pool.submit({
                type: slot.mode,
                pcm: window,
                sampleRate: slot.sampleRate,
                dialFreqHz: slot.dialHz,
                label: key,
            });
            if (error) {
                this.emit('error', new Error(error), { band: slot.band, mode: slot.mode });
            } else {
                this.emit('decode', {
                    band: slot.band,
                    mode: slot.mode,
                    dialHz: slot.dialHz,
                    sampleRate: slot.sampleRate,
                    slotTime,
                    results: results ?? [],
                    decodeMs: Date.now() - t0,
                });
            }
        } finally {
            this._decoding.delete(key);
        }
    }

    get stats() {
        return { slots: this.slots.length, pool: this.pool.stats };
    }

    async stop() {
        this._stopping = true;
        for (const s of this.slots) s.stop();
        await this.pool.close();
    }
}
