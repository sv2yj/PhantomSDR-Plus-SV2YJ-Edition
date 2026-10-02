/**
 * pskreporter.js — batch spots and upload to PSK Reporter over IPFIX/UDP.
 *
 * Wire format mirrors KiwiSDR's proven implementation (extensions/FT8/
 * PSKReporter.cpp): private enterprise number 30351, a sender/spot template
 * (id 0x1140) and a receiver options template (id 0x1138), both re-sent in every
 * datagram so the collector can always parse the data records. All multi-byte
 * fields are big-endian (network order).
 *
 * Spots accumulate and are flushed on a multi-minute cycle (PSK Reporter asks
 * for >= 5 min between uploads). Each datagram stays under a safe UDP MTU.
 */
import dgram from 'node:dgram';

const PEN = 30351;                 // PSK Reporter private enterprise number
const TX_TEMPLATE_ID = 0x1140;     // sender / spot record
const RX_TEMPLATE_ID = 0x1138;     // receiver info record
const MAX_DATAGRAM = 1400;         // keep under typical MTU

// Enterprise-specific element ids (high bit set on the wire).
const E = {
    RX_CALL: 2, RX_LOC: 4, RX_CLIENT: 8,
    TX_CALL: 1, TX_FREQ: 5, TX_SNR: 6, TX_MODE: 10, TX_LOC: 3, TX_ISRC: 11,
};
const TIME_SECS = 150;             // standard element (no enterprise)

// ── little byte-buffer builder (big-endian) ─────────────────────────────────
class Buf {
    constructor() { this.a = []; }
    u8(v)  { this.a.push(v & 0xff); return this; }
    u16(v) { this.a.push((v >>> 8) & 0xff, v & 0xff); return this; }
    u32(v) { this.a.push((v >>> 24) & 0xff, (v >>> 16) & 0xff, (v >>> 8) & 0xff, v & 0xff); return this; }
    str(s) {                        // 1 length byte + ASCII bytes
        const b = Buffer.from(String(s), 'ascii');
        this.a.push(b.length & 0xff);
        for (const x of b) this.a.push(x);
        return this;
    }
    pad4() { while (this.a.length % 4 !== 0) this.a.push(0); return this; }
    get length() { return this.a.length; }
    bytes() { return this.a; }
}
const efield = (buf, id, len) => buf.u16(0x8000 | id).u16(len).u32(PEN); // enterprise field spec

export class PskReporter {
    constructor({ callsign, grid, host = 'report.pskreporter.info', port = 4739,
                  software = 'PhantomSDR-Plus', antenna = '' } = {}) {
        if (!callsign) throw new Error('PskReporter: callsign required');
        this.callsign = callsign;
        this.grid = grid || '';
        this.host = host;
        this.port = port;
        this.software = software;
        this.antenna = antenna;
        this.seq = 1;
        this.uniq = (Math.random() * 0xffffffff) >>> 0; // stable per session
        this.queue = [];
        this.sent = 0;
        // FT8 and FT4 share this one queue, and so do all bands, so the caller
        // cannot tell from the flush count alone what went out. flush() fills
        // both of these in: by mode, and by mode+band slot.
        this.lastSentByMode = {};
        this.lastSentBySlot = {};
        this.socket = dgram.createSocket('udp4');
        this.socket.on('error', () => { /* non-fatal; drop this cycle */ });
    }

    /** Queue one spot. freqHz = absolute RF Hz; snr in dB; mode 'FT8'|'FT4'.
     *  `band` is carried for accounting only; it is not part of the datagram. */
    addSpot({ call, grid = '', freqHz, snr, mode, slotTime, band = '' }) {
        if (!call || !freqHz) return;
        this.queue.push({
            band,
            call: String(call).slice(0, 20),
            grid: grid ? String(grid).slice(0, 6) : '',
            freqHz: Math.round(freqHz),
            snr: Math.max(-128, Math.min(127, Math.round(snr ?? 0))),
            mode: mode || 'FT8',
            slotTime: Math.floor(slotTime ?? Date.now() / 1000),
        });
    }

    get pending() { return this.queue.length; }

    // ── template + record encoders ──────────────────────────────────────────
    _txTemplate(buf) {
        const b = new Buf();
        b.u16(TX_TEMPLATE_ID).u16(7);          // template id, field count
        efield(b, E.TX_CALL, 0xffff);
        efield(b, E.TX_FREQ, 5);
        efield(b, E.TX_SNR, 1);
        efield(b, E.TX_MODE, 0xffff);
        efield(b, E.TX_LOC, 0xffff);
        efield(b, E.TX_ISRC, 1);
        b.u16(TIME_SECS).u16(4);               // standard field (flowStart secs)
        buf.u16(2).u16(4 + b.length);          // set id 2 (template set) + length
        for (const x of b.bytes()) buf.u8(x);
    }
    _rxTemplate(buf) {
        const b = new Buf();
        b.u16(RX_TEMPLATE_ID).u16(3).u16(0);   // template id, field count, scope count
        efield(b, E.RX_CALL, 0xffff);
        efield(b, E.RX_LOC, 0xffff);
        efield(b, E.RX_CLIENT, 0xffff);
        b.u16(0);                              // pad (matches Kiwi struct)
        buf.u16(3).u16(4 + b.length);          // set id 3 (options template set) + length
        for (const x of b.bytes()) buf.u8(x);
    }
    _rxRecord(buf) {
        const b = new Buf();
        b.str(this.callsign).str(this.grid).str(this.software).pad4();
        buf.u16(RX_TEMPLATE_ID).u16(4 + b.length);
        for (const x of b.bytes()) buf.u8(x);
    }
    _spotRecord(buf, s) {
        const b = new Buf();
        b.str(s.call);
        // 5-byte frequency: high byte then low 32 bits (big-endian).
        b.u8(Math.floor(s.freqHz / 0x100000000) & 0xff).u32(s.freqHz >>> 0);
        b.u8(s.snr & 0xff);                    // signed int8
        b.str(s.mode).str(s.grid);
        b.u8(1);                               // information source = automatic
        b.u32(s.slotTime >>> 0);
        b.pad4();
        buf.u16(TX_TEMPLATE_ID).u16(4 + b.length);
        for (const x of b.bytes()) buf.u8(x);
    }

    /** Build one datagram for up to `spots.length` spots (caller pre-chunks). */
    _buildDatagram(spots) {
        const body = new Buf();
        this._txTemplate(body);
        this._rxTemplate(body);
        this._rxRecord(body);
        for (const s of spots) this._spotRecord(body, s);

        const total = 16 + body.length;        // 16-byte header
        const hdr = new Buf();
        hdr.u16(0x000A).u16(total)             // version 10, total length
           .u32(Math.floor(Date.now() / 1000)) // export time
           .u32(this.seq++)                    // sequence number
           .u32(this.uniq);                    // observation domain / session id
        return Buffer.from([...hdr.bytes(), ...body.bytes()]);
    }

    /** Send all queued spots, chunked to stay under MTU. Returns count sent.
     *  Also records the per-mode split of that count in `lastSentByMode`. */
    flush() {
        this.lastSentByMode = {};
        this.lastSentBySlot = {};
        if (this.queue.length === 0) return 0;
        const spots = this.queue;
        this.queue = [];
        let i = 0, sent = 0;
        while (i < spots.length) {
            // Grow a chunk until near the MTU (templates+rx add a fixed ~110 B).
            const chunk = [];
            let est = 16 + 60 + 36 + 32; // header + tx tmpl + rx tmpl + rx record
            while (i < spots.length) {
                const s = spots[i];
                const sz = 4 + 1 + s.call.length + 5 + 1 + 1 + s.mode.length + 1 + s.grid.length + 1 + 4 + 3;
                if (chunk.length && est + sz > MAX_DATAGRAM) break;
                chunk.push(s); est += sz; i++;
            }
            const dg = this._buildDatagram(chunk);
            this.socket.send(dg, this.port, this.host);
            sent += chunk.length;
            for (const s of chunk) {
                const k = String(s.mode || 'FT8').toUpperCase();
                this.lastSentByMode[k] = (this.lastSentByMode[k] || 0) + 1;
                if (s.band) {
                    const slot = k.toLowerCase() + ':' + s.band;
                    this.lastSentBySlot[slot] = (this.lastSentBySlot[slot] || 0) + 1;
                }
            }
        }
        this.sent += sent;
        return sent;
    }

    close() { try { this.socket.close(); } catch { /* ignore */ } }
}
