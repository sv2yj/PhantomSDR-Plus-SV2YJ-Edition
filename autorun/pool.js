/**
 * pool.js — bounded worker pool with a priority queue for decode jobs.
 *
 * Decode latency does not matter: PSK Reporter / wsprnet upload on a multi-
 * minute cycle, so a decode finishing seconds late is worth exactly as much as
 * an instant one. What matters is sustained throughput and never oversubscribing
 * the CPU. So decodes never run more than `size` at once; the rest queue.
 *
 * At the top of each even minute every WSPR window and every FT8 window close at
 * once — a burst. We drain it in priority order rather than in parallel: FT4
 * first (shortest T/R period, would otherwise get lapped), then FT8, then WSPR
 * (its Fano search is the long pole but it tolerates the most delay).
 *
 * The admin launcher pins the whole daemon to the top CPU cores at launch
 * (config-aware — the E-cores on an 8P+4E box, unpinned on a <=4-core machine);
 * the pool threads inherit that affinity, keeping decode bursts off the SDR's
 * lower cores where spectrumserver runs.
 */
import { Worker } from 'node:worker_threads';

// Lower number = higher priority.
const PRIORITY = { ft4: 0, ft8: 1, ft2: 2, wspr: 3 };

export class DecodePool {
    /** @param {number} size number of worker threads (default 4 = the E-cores). */
    constructor(size = 4) {
        this.workerUrl = new URL('./decodeworker.js', import.meta.url);
        this.workers = [];
        this.idle = [];
        this.queue = [];          // pending entries, not yet assigned
        this.pending = new Map(); // id -> entry (assigned or queued)
        this._nextId = 1;
        this._closed = false;

        for (let i = 0; i < size; i++) this._spawn();
    }

    _spawn() {
        const w = new Worker(this.workerUrl);
        w.on('message', (msg) => this._onDone(w, msg));
        w.on('error', (err) => this._onWorkerError(w, err));
        this.workers.push(w);
        this.idle.push(w);
    }

    /**
     * Submit a decode job. Resolves with { results, error?, job }.
     * @param {{type:string, pcm:Float32Array, sampleRate:number,
     *          dialFreqHz?:number, label?:string}} job
     *   `pcm` must be an owned buffer (it is structured-cloned to the worker).
     */
    submit(job) {
        if (this._closed) return Promise.reject(new Error('pool closed'));
        return new Promise((resolve) => {
            const entry = {
                id: this._nextId++,
                job,
                resolve,
                prio: PRIORITY[job.type] ?? 9,
                worker: null,
            };
            this.pending.set(entry.id, entry);
            this.queue.push(entry);
            this._dispatch();
        });
    }

    _dispatch() {
        while (this.idle.length && this.queue.length) {
            // Highest priority first; FIFO (lowest id) within the same priority.
            let best = 0;
            for (let i = 1; i < this.queue.length; i++) {
                const a = this.queue[i], b = this.queue[best];
                if (a.prio < b.prio || (a.prio === b.prio && a.id < b.id)) best = i;
            }
            const entry = this.queue.splice(best, 1)[0];
            const w = this.idle.pop();
            entry.worker = w;
            const { id, job } = entry;
            // Structured clone (no transfer): the pcm buffer may be a slice of a
            // shared accumulator on the caller side; transferring would detach it.
            w.postMessage({
                id,
                type: job.type,
                pcm: job.pcm,
                sampleRate: job.sampleRate,
                dialFreqHz: job.dialFreqHz,
            });
        }
    }

    _onDone(w, msg) {
        const entry = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        this.idle.push(w);
        if (entry) {
            entry.resolve({
                results: msg.results ?? [],
                error: msg.error,
                job: entry.job,
            });
        }
        this._dispatch();
    }

    _onWorkerError(w, err) {
        // A worker crashed. Fail its in-flight job (if any), drop it, respawn so
        // the pool keeps its size — one bad decode must not shrink the pool.
        const idx = this.workers.indexOf(w);
        if (idx !== -1) this.workers.splice(idx, 1);
        const ii = this.idle.indexOf(w);
        if (ii !== -1) this.idle.splice(ii, 1);
        for (const entry of this.pending.values()) {
            if (entry.worker === w) {
                this.pending.delete(entry.id);
                entry.resolve({ results: [], error: `worker crashed: ${err?.message ?? err}`, job: entry.job });
            }
        }
        if (!this._closed) this._spawn();
        this._dispatch();
    }

    get stats() {
        return {
            size: this.workers.length,
            idle: this.idle.length,
            busy: this.workers.length - this.idle.length,
            queued: this.queue.length,
        };
    }

    async close() {
        this._closed = true;
        await Promise.all(this.workers.map((w) => w.terminate()));
        this.workers = [];
        this.idle = [];
    }
}
