/**
 * wsprnet.js — upload WSPR spots to wsprnet.org.
 *
 * Uses the same GET endpoint KiwiSDR uses (extensions/wspr/wspr_main.cpp):
 *   http://wsprnet.org/post?function=wspr&rcall=..&rgrid=..&rqrg=..&date=YYMMDD
 *     &time=HHMM&sig=..&dt=..&drift=..&tqrg=..&tcall=..&tgrid=..&dbm=..&version=..
 * rqrg/tqrg are in MHz; date/time are UTC. One request per spot (WSPR spots are
 * sparse — a handful every 2 min). WSPR goes ONLY here, not to PSK Reporter
 * (PSK Reporter's WSPR data arrives via a wsprnet bridge; sending both duplicates).
 */
const ENDPOINT = 'http://wsprnet.org/post';

function utcDateTime(unixSec) {
    const d = new Date(unixSec * 1000);
    const p2 = (n) => String(n).padStart(2, '0');
    const date = p2(d.getUTCFullYear() % 100) + p2(d.getUTCMonth() + 1) + p2(d.getUTCDate());
    const time = p2(d.getUTCHours()) + p2(d.getUTCMinutes());
    return { date, time };
}

export class WsprNet {
    constructor({ callsign, grid, software = 'PhantomSDR-Plus', endpoint = ENDPOINT } = {}) {
        if (!callsign) throw new Error('WsprNet: callsign required');
        this.rcall = callsign;
        this.rgrid = (grid || '').slice(0, 6);
        this.software = software;
        this.endpoint = endpoint;
        this.queue = [];
        this.lastSentByBand = {};   // per-band split of the last flush
        this.sent = 0;
    }

    /**
     * Queue a WSPR spot.
     * @param {object} s
     * @param {string} s.tcall transmitter callsign  @param {string} s.tgrid grid
     * @param {number} s.dbm reported power  @param {number} s.txFreqHz absolute RF Hz
     * @param {number} s.snr  @param {number} s.dt  @param {number} s.drift
     * @param {number} s.dialHz WSPR dial the tap was tuned to
     * @param {number} s.slotTime unix seconds of the slot
     */
    addSpot(s) {
        if (!s.tcall || !s.txFreqHz) return;
        this.queue.push(s);
    }

    get pending() { return this.queue.length; }

    _url(s) {
        const { date, time } = utcDateTime(s.slotTime ?? Date.now() / 1000);
        const q = new URLSearchParams({
            function: 'wspr',
            rcall: this.rcall,
            rgrid: this.rgrid,
            rqrg: (s.dialHz / 1e6).toFixed(6),
            date, time,
            sig: String(Math.round(s.snr ?? 0)),
            dt: (s.dt ?? 0).toFixed(1),
            drift: String(Math.round(s.drift ?? 0)),
            tqrg: (s.txFreqHz / 1e6).toFixed(6),
            tcall: s.tcall,
            tgrid: s.tgrid || '',
            dbm: String(s.dbm ?? 0),
            version: this.software,
        });
        return `${this.endpoint}?${q.toString()}`;
    }

    /** Send all queued spots. Returns count attempted.
     *
     *  Also records a per-band breakdown in `lastSentByBand`. That breakdown
     *  counts spots the server ACCEPTED, while the return value counts spots
     *  attempted — they differ when the network drops one, and the per-band
     *  figure is the one that means "uploaded".
     */
    async flush() {
        this.lastSentByBand = {};
        if (this.queue.length === 0) return 0;
        const spots = this.queue;
        this.queue = [];
        let ok = 0;
        await Promise.all(spots.map(async (s) => {
            try {
                const res = await fetch(this._url(s), { method: 'GET' });
                if (res.ok) {
                    ok++;
                    if (s.band) this.lastSentByBand[s.band] = (this.lastSentByBand[s.band] || 0) + 1;
                }
            } catch { /* drop this spot; network hiccup */ }
        }));
        this.sent += ok;
        return spots.length;
    }

    close() { /* nothing to release */ }
}
