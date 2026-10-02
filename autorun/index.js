/**
 * index.js — autorun spot reporter entry point.
 *
 * Wires the decode engine (manager.js) to the reporters (pskreporter.js,
 * wsprnet.js). FT8/FT4/JS8 -> PSK Reporter (IPFIX/UDP); WSPR -> wsprnet. Reporting is
 * OFF by default; it is enabled per-destination in autorun.json (which the admin
 * panel writes). Decoding still runs and logs when reporting is off, so activity
 * is visible before anything is uploaded.
 *
 * Config resolution (autorun.json at repo root; env overrides for testing):
 *   identity   : autorun.json.identity.{callsign,grid} || site_information.json
 *   slots      : autorun.json.slots[enabled] || AUTORUN_SLOTS="20m:ft8,40m:ft8"
 *   reporting  : autorun.json.reporting.{pskreporter,wsprnet} || AUTORUN_REPORT=..
 *   dryRun     : autorun.json.dryRun || AUTORUN_DRYRUN=1  (log spots, don't send)
 *
 * The admin launcher pins the daemon to the top CPU cores (config-aware — the
 * E-cores on an 8P+4E box, fewer on smaller CPUs, unpinned on <=4 cores). To run
 * it by hand on such a box:  taskset -c 8-11 node autorun/index.js
 */
import { readFileSync, existsSync, writeFileSync, unlinkSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { AutorunManager } from './manager.js';
import { PskReporter } from './pskreporter.js';
import { WsprNet } from './wsprnet.js';
import { parseFtxSpot, parseJs8Spot } from './spotparse.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const PSK_FLUSH_MS = 5 * 60 * 1000; // PSK Reporter: >= 5 min between uploads
const WSPR_FLUSH_MS = 2 * 60 * 1000;

function loadConfig() {
    const path = join(ROOT, 'autorun.json');
    let cfg = {};
    if (existsSync(path)) {
        try { cfg = JSON.parse(readFileSync(path, 'utf8')); }
        catch (e) { console.error(`[autorun] bad autorun.json: ${e.message}`); }
    }

    // Identity: config first, else site_information.json (grid truncated to 6).
    let callsign = cfg.identity?.callsign;
    let grid = cfg.identity?.grid;
    if (!callsign || !grid) {
        try {
            const si = JSON.parse(readFileSync(join(ROOT, 'frontend', 'site_information.json'), 'utf8'));
            callsign = callsign || si.siteSysop;
            grid = grid || (si.siteGridSquare || '').slice(0, 6);
        } catch (e) { console.error(`[autorun] cannot read site_information.json: ${e.message}`); }
    }

    // Slots: config.slots[enabled], else AUTORUN_SLOTS env ("band:mode,band:mode").
    let slots = (cfg.slots || []).filter((s) => s.enabled).map((s) => ({ band: s.band, mode: s.mode }));
    if (process.env.AUTORUN_SLOTS) {
        slots = process.env.AUTORUN_SLOTS.split(',').map((t) => {
            const [band, mode] = t.trim().split(':');
            return { band, mode };
        });
    }

    // Reporting toggles (default OFF).
    const report = { pskreporter: false, wsprnet: false, ...(cfg.reporting || {}) };
    if (process.env.AUTORUN_REPORT) {
        for (const d of process.env.AUTORUN_REPORT.split(',')) report[d.trim()] = true;
    }
    const dryRun = !!cfg.dryRun || process.env.AUTORUN_DRYRUN === '1';

    // Backend tap target: the tap connects DIRECTLY to spectrumserver (loopback +
    // token), bypassing the proxy, so it needs spectrumserver's own [server] port
    // — NOT the public/proxy port. Resolve it from the running server's config so
    // installs that don't use port 8900 work out of the box. Precedence:
    //   autorun.json.server.{host,port} || env || running server's toml || 8900
    const host = cfg.server?.host || process.env.AUTORUN_TAP_HOST || '127.0.0.1';
    let port = cfg.server?.port || Number(process.env.AUTORUN_TAP_PORT) || 0;
    if (!port) port = readServerPort() || 8900;

    return { callsign, grid, grid6: (grid || '').slice(0, 6), slots, report, dryRun, host, port };
}

/** Parse the [server] port out of a TOML file (the port spectrumserver binds). */
function portFromToml(path) {
    try {
        const toml = readFileSync(path, 'utf8');
        // Grab the first `port = N` at/after the [server] header, ignoring
        // public_port/proxy_port and inline "# ..." comments.
        const seg = toml.split(/^\s*\[/m).find((s) => s.startsWith('server]')) ?? toml;
        const m = seg.match(/^\s*port\s*=\s*(\d+)/m);
        if (m) return Number(m[1]);
    } catch { /* unreadable — caller falls back */ }
    return 0;
}

/**
 * Resolve spectrumserver's listen port. Different installs run different config
 * files (config.toml, config-rx888mk2.toml, config-rtl.toml, …) on different
 * ports, so we first ask the RUNNING spectrumserver which config it was launched
 * with (`--config <file>` or a positional `<file>.toml`) and read that file's
 * [server] port. Falls back to config.toml, then the caller's default.
 */
function readServerPort() {
    try {
        const out = execFileSync('pgrep', ['-af', 'spectrumserver'], { encoding: 'utf8' });
        for (const line of out.split('\n')) {
            if (!/spectrumserver/.test(line) || /pgrep/.test(line)) continue;
            const cfg = line.match(/--config\s+(\S+)/)?.[1] || line.match(/(\S+\.toml)\b/)?.[1];
            if (!cfg) continue;
            const path = cfg.startsWith('/') ? cfg : join(ROOT, cfg);
            const p = portFromToml(path);
            if (p) return p;
        }
    } catch { /* pgrep absent or nothing running — fall back to config.toml */ }
    return portFromToml(join(ROOT, 'config.toml'));
}

function main() {
    const cfg = loadConfig();
    if (!cfg.callsign) { console.error('[autorun] no callsign resolved; aborting'); process.exit(1); }
    if (cfg.slots.length === 0) { console.error('[autorun] no slots enabled; nothing to do'); process.exit(1); }

    console.log(`[autorun] identity ${cfg.callsign} / ${cfg.grid6}`);
    console.log(`[autorun] tap backend: ${cfg.host}:${cfg.port}`);
    console.log(`[autorun] slots: ${cfg.slots.map((s) => `${s.mode} ${s.band}`).join(', ')}`);
    console.log(`[autorun] reporting: PSKReporter=${cfg.report.pskreporter} wsprnet=${cfg.report.wsprnet}${cfg.dryRun ? ' (DRY RUN)' : ''}`);

    const psk = new PskReporter({ callsign: cfg.callsign, grid: cfg.grid6 });
    const wspr = new WsprNet({ callsign: cfg.callsign, grid: cfg.grid6 });
    const mgr = new AutorunManager({ slots: cfg.slots, poolSize: 4, host: cfg.host, port: cfg.port });

    const counts = { decodes: 0, pskQueued: 0, wsprQueued: 0, pskSent: 0, wsprSent: 0 };
    // Per-decoder tally for the admin panel. The aggregate counts above cannot
    // answer "how many FT4 spots went up", because FT8 and FT4 share one
    // PSK Reporter queue.
    const byMode = {};
    const modeTally = (m) => (byMode[m] ||= { decodes: 0, queued: 0, uploaded: 0 });
    for (const s of cfg.slots) modeTally(s.mode);   // so idle modes report 0, not absent

    // Per-slot (mode:band) running totals. Unlike everything above, these are
    // all-time: they are loaded from disk at startup and survive Stop/Start, so
    // the admin panel can show what each band+mode has ever produced.
    const totalsPath = join(ROOT, 'autorun-totals.json');
    let totals = {};
    try {
        if (existsSync(totalsPath)) totals = JSON.parse(readFileSync(totalsPath, 'utf8')) || {};
    } catch (e) { console.error(`[autorun] bad autorun-totals.json, starting fresh: ${e.message}`); }
    if (typeof totals !== 'object' || Array.isArray(totals)) totals = {};

    const slotTally = (mode, band) => {
        const k = `${mode}:${band}`;
        const t = (totals[k] ||= { decodes: 0, queued: 0, uploaded: 0, firstSeen: 0, lastSpotAt: 0 });
        if (!t.firstSeen) t.firstSeen = Math.floor(Date.now() / 1000);
        return t;
    };
    for (const s of cfg.slots) slotTally(s.mode, s.band);

    const writeTotals = () => {
        try { writeFileSync(totalsPath, JSON.stringify(totals, null, 2)); }
        catch { /* ignore — totals are a convenience, never worth crashing over */ }
    };
    const startedAt = Math.floor(Date.now() / 1000);
    let lastDecodeAt = 0, lastUploadAt = 0, lastUploadMsg = '';
    const statusPath = join(ROOT, 'autorun-status.json');

    const writeStatus = () => {
        try {
            writeFileSync(statusPath, JSON.stringify({
                pid: process.pid,
                startedAt,
                updatedAt: Math.floor(Date.now() / 1000),
                identity: { callsign: cfg.callsign, grid: cfg.grid6 },
                slots: cfg.slots,
                reporting: cfg.report,
                dryRun: cfg.dryRun,
                counts,
                byMode,
                lastDecodeAt, lastUploadAt, lastUploadMsg,
            }, null, 2));
        } catch { /* ignore */ }
    };

    const statusTimer = setInterval(() => { writeStatus(); writeTotals(); }, 15000);
    writeStatus();

    mgr.on('ready', (s) => { console.log(`[autorun] tuned ${s.mode} ${s.band}`); writeStatus(); });
    mgr.on('error', (e, ctx) => console.error(`[autorun] ${ctx?.mode ?? ''} ${ctx?.band ?? ''}: ${e.message}`));

    mgr.on('decode', (d) => {
        const stamp = new Date().toISOString().slice(11, 19);
        counts.decodes += d.results.length;
        modeTally(d.mode).decodes += d.results.length;
        slotTally(d.mode, d.band).decodes += d.results.length;
        if (d.results.length) lastDecodeAt = Math.floor(Date.now() / 1000);
        if (d.results.length) {
            console.log(`[${stamp}] ${d.mode.toUpperCase()} ${d.band}: ${d.results.length} decodes (${d.decodeMs}ms)`);
        }
        for (const r of d.results) {
            if (d.mode === 'wspr') {
                if (!r.callsign) continue;
                if (cfg.report.wsprnet) {
                    wspr.addSpot({
                        band: d.band,
                        tcall: r.callsign, tgrid: r.grid, dbm: r.dbm, txFreqHz: r.freq,
                        snr: r.snr, dt: r.dt, drift: r.drift, dialHz: d.dialHz, slotTime: d.slotTime,
                    });
                    counts.wsprQueued++;
                    modeTally('wspr').queued++;
                    slotTally('wspr', d.band).queued++;
                }
            } else {
                // JS8 hands over structured frames, not free text; FT8/FT4 hand
                // over a message string that has to be parsed.
                const p = d.mode === 'js8' ? parseJs8Spot(r) : parseFtxSpot(r.text);
                if (!p) continue;
                if (cfg.report.pskreporter) {
                    psk.addSpot({
                        band: d.band,
                        call: p.call, grid: p.grid, freqHz: d.dialHz + (r.freq || 0),
                        snr: r.snr, mode: d.mode.toUpperCase(), slotTime: d.slotTime,
                    });
                    counts.pskQueued++;
                    modeTally(d.mode).queued++;
                    slotTally(d.mode, d.band).queued++;
                }
            }
        }
    });

    // Flush cycles.
    const flushPsk = () => {
        if (psk.pending === 0) return;
        if (cfg.dryRun) { console.log(`[autorun] DRY RUN: would upload ${psk.pending} spots to PSK Reporter`); psk.queue = []; return; }
        const n = psk.flush();
        counts.pskSent += n;
        // Attribute the upload to the decoders that produced it, rather than
        // splitting the total by guesswork.
        for (const [m, v] of Object.entries(psk.lastSentByMode || {})) modeTally(m.toLowerCase()).uploaded += v;
        for (const [k, v] of Object.entries(psk.lastSentBySlot || {})) {
            const [m, b] = k.split(':');
            const t = slotTally(m, b);
            t.uploaded += v;
            t.lastSpotAt = Math.floor(Date.now() / 1000);
        }
        writeTotals();
        lastUploadAt = Math.floor(Date.now() / 1000);
        lastUploadMsg = `PSK Reporter: ${n} spots`;
        console.log(`[autorun] PSK Reporter: uploaded ${n} spots (total ${counts.pskSent})`);
        writeStatus();
    };
    const flushWspr = async () => {
        if (wspr.pending === 0) return;
        if (cfg.dryRun) { console.log(`[autorun] DRY RUN: would upload ${wspr.pending} spots to wsprnet`); wspr.queue = []; return; }
        const n = await wspr.flush();
        counts.wsprSent += n;
        modeTally('wspr').uploaded += n;
        for (const [b, v] of Object.entries(wspr.lastSentByBand || {})) {
            const t = slotTally('wspr', b);
            t.uploaded += v;
            t.lastSpotAt = Math.floor(Date.now() / 1000);
        }
        writeTotals();
        lastUploadAt = Math.floor(Date.now() / 1000);
        lastUploadMsg = `wsprnet: ${n} spots`;
        console.log(`[autorun] wsprnet: uploaded ${n} spots (total ${counts.wsprSent})`);
        writeStatus();
    };
    const pskTimer = setInterval(flushPsk, PSK_FLUSH_MS);
    const wsprTimer = setInterval(flushWspr, WSPR_FLUSH_MS);

    const shutdown = async () => {
        console.log('\n[autorun] shutting down…');
        clearInterval(pskTimer); clearInterval(wsprTimer); clearInterval(statusTimer);
        await flushPsk(); await flushWspr();
        await mgr.stop(); psk.close(); wspr.close();
        writeTotals();   // totals persist across restarts; status does not
        try { unlinkSync(statusPath); } catch { /* ignore */ }
        process.exit(0);
    };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
}

main();
