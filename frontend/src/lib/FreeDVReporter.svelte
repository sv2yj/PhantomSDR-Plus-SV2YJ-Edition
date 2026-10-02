<script>
  // Native FreeDV Reporter list — replaces the qso.freedv.org <iframe>.
  // Data comes live from the shared Socket.IO store in freedv-reporter.js.
  import { reporter, sortStations } from "./freedv-reporter.js";

  // Sorted view: Transmitting first, then most recent, then frequency.
  $: sorted = sortStations($reporter.stations);
  $: connected = $reporter.connected;
  $: count = $reporter.stations.length;

  function freqMHz(hz) {
    if (hz == null) return "--";
    return (hz / 1e6).toFixed(4);
  }

  // HF band label from frequency (Hz) — used only for a subtle colour tag.
  function band(hz) {
    if (hz == null) return "";
    const m = hz / 1e6;
    if (m >= 1.8 && m <= 2.0) return "160m";
    if (m >= 3.5 && m <= 4.0) return "80m";
    if (m >= 5.25 && m <= 5.45) return "60m";
    if (m >= 7.0 && m <= 7.3) return "40m";
    if (m >= 10.1 && m <= 10.15) return "30m";
    if (m >= 14.0 && m <= 14.35) return "20m";
    if (m >= 18.068 && m <= 18.168) return "17m";
    if (m >= 21.0 && m <= 21.45) return "15m";
    if (m >= 24.89 && m <= 24.99) return "12m";
    if (m >= 28.0 && m <= 29.7) return "10m";
    if (m >= 50.0 && m <= 54.0) return "6m";
    return "";
  }

  function hhmmss(msVal) {
    if (!msVal) return "--";
    const d = new Date(msVal);
    const p = (n) => String(n).padStart(2, "0");
    return `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}Z`;
  }

  function snrText(v) {
    return v == null ? "--" : Number(v).toFixed(1);
  }
  function dash(s) {
    return s ? s : "--";
  }
</script>

<div class="fdv-reporter">
  <div class="fdv-head">
    <span class="fdv-dot" class:on={connected}></span>
    <span>{connected ? "Live" : "Connecting…"}</span>
    <span class="fdv-count">{count} station{count === 1 ? "" : "s"}</span>
  </div>

  <div class="fdv-scroll">
    <table class="fdv-table">
      <thead>
        <tr>
          <th>Callsign</th>
          <th>Locator</th>
          <th>Freq</th>
          <th>Status</th>
          <th>Message</th>
          <th>TX Mode</th>
          <th>Last TX</th>
          <th>RX Callsign</th>
          <th>RX Mode</th>
          <th>SNR</th>
          <th>Updated</th>
        </tr>
      </thead>
      <tbody>
        {#each sorted as s (s.sid)}
          <tr class:tx={s.status === "Transmitting"}>
            <td class="call">{s.callsign}</td>
            <td class="mono">{dash(s.grid)}</td>
            <td class="mono">
              {freqMHz(s.freq)}{#if s.freq != null}<span class="unit"> MHz</span>{/if}
              {#if band(s.freq)}<span class="band">{band(s.freq)}</span>{/if}
            </td>
            <td>
              <span class="status" class:s-tx={s.status === "Transmitting"} class:s-ro={s.status === "Receive Only"}>{s.status}</span>
            </td>
            <td class="msg" title={s.message}>{dash(s.message)}</td>
            <td>{dash(s.txMode)}</td>
            <td class="mono">{hhmmss(s.lastTx)}</td>
            <td class="call rx">{dash(s.rxCallsign)}</td>
            <td>{dash(s.rxMode)}</td>
            <td class="mono">{snrText(s.snr)}</td>
            <td class="mono upd">{hhmmss(s.lastUpdate)}</td>
          </tr>
        {:else}
          <tr>
            <td colspan="11" class="empty">{connected ? "No active stations." : "Connecting to FreeDV Reporter…"}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
</div>

<style>
  .fdv-reporter {
    /* Fixed-size box that fills the column width. Its children are taken
       out of flow (absolute) so the wide table contributes ZERO intrinsic
       width — the containing column can never be forced wider by it; the
       table scrolls horizontally inside .fdv-scroll instead. */
    position: relative;
    width: 100%;
    max-width: 100%;
    min-width: 0;
    height: 424px;
    box-sizing: border-box;
    background: #1f2937;
    border: 1px solid #4b5563;
    border-radius: 0.5rem;
    overflow: hidden;
    font-size: 11px;
    color: #d1d5db;
  }
  .fdv-head {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 24px;
    box-sizing: border-box;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 8px;
    background: #111827;
    border-bottom: 1px solid #374151;
    font-size: 11px;
    white-space: nowrap;
  }
  .fdv-count {
    margin-left: auto;
    color: #9ca3af;
  }
  .fdv-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #6b7280;
    box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.5);
  }
  .fdv-dot.on {
    background: #22c55e;
  }
  .fdv-scroll {
    position: absolute;
    top: 24px;
    left: 0;
    right: 0;
    bottom: 0;
    overflow: auto;
  }
  .fdv-table {
    width: 100%;
    border-collapse: collapse;
    white-space: nowrap;
  }
  .fdv-table th,
  .fdv-table td {
    padding: 3px 8px;
    text-align: left;
    border-bottom: 1px solid #374151;
  }
  .fdv-table thead th {
    position: sticky;
    top: 0;
    background: #111827;
    color: #9ca3af;
    font-weight: 600;
    z-index: 1;
  }
  .fdv-table tbody tr:hover {
    background: #273449;
  }
  .fdv-table tbody tr.tx {
    background: rgba(34, 197, 94, 0.12);
  }
  .fdv-table tbody tr.tx:hover {
    background: rgba(34, 197, 94, 0.2);
  }
  .mono {
    font-variant-numeric: tabular-nums;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  }
  .call {
    font-weight: 600;
    color: #e5e7eb;
  }
  .call.rx {
    font-weight: 500;
    color: #cbd5e1;
  }
  .unit {
    color: #6b7280;
  }
  .band {
    margin-left: 4px;
    padding: 0 4px;
    border-radius: 3px;
    background: #374151;
    color: #93c5fd;
    font-size: 9px;
  }
  .status {
    color: #9ca3af;
  }
  .status.s-tx {
    color: #34d399;
    font-weight: 700;
  }
  .status.s-ro {
    color: #6b7280;
  }
  .msg {
    max-width: 220px;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .upd {
    color: #9ca3af;
  }
  .empty {
    text-align: center;
    color: #6b7280;
    padding: 24px 8px;
  }
</style>
