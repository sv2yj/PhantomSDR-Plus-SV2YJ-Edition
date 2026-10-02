// tci-rigctld.mjs — makes a Hamlib rig (IC-7300, FT-991A, TS-590...) look
// like a TCI server, so the receiver page's TCI-CAT button can drive a
// transceiver that has no TCI of its own. It runs on the LISTENER's computer,
// the one wired to the radio, next to the browser.
//
// Two ways to reach the rig through Hamlib:
//
// A) rigctl — one program, no network port (simplest, and the one to use on
//    Windows, where rigctld is often blocked):
//
//      node tci-rigctld.mjs --rigctl rigctl -m 3073 -r /dev/ttyUSB0 -s 115200
//      node tci-rigctld.mjs --rigctl C:\hamlib\bin\rigctl.exe -m 3073 -r COM4 -s 115200
//
//    Everything after --rigctl is the rigctl program and its own options
//    (-m model, -r port, -s speed; rigctl -l lists the models).
//
// B) rigctld — a running Hamlib server, which other programs can share:
//
//      rigctld -m 3073 -r /dev/ttyUSB0 -s 115200         (leave it running)
//      node tci-rigctld.mjs                              (TCI on port 50001)
//      node tci-rigctld.mjs 50001 127.0.0.1:4532         port, rigctld address
//
// A TCI port other than 50001 goes first in both forms:
//      node tci-rigctld.mjs 40001 --rigctl rigctl -m 3073 -r COM4 -s 115200
//
// Icom filters (FIL1/FIL2/FIL3). Given a width, Hamlib selects a filter and
// then writes that width into it — and on the IC-7300 the width can land on
// the filter selected before, which scrambles the rig's filter settings. For
// Icom rigs the bridge therefore never sends a width: it picks the nearest of
// three reference widths and only SELECTS that filter, with the CI-V command
// 06 <mode> <filter> (1A 06 01 <filter> in a data mode). The rig's own filter
// widths are never changed. Reference widths, FIL1,FIL2,FIL3:
//   USB/LSB 2700,2400,1800 (change with --filters)   CW 1200,500,250
//   AM 9000,6000,3000   FM 15000,10000,7000   RTTY 2400,500,250
// On automatically for -m 3073 (IC-7300). For another Icom rig give --filters
// (and --civ with its CI-V address in hex when it is not 94); --filters off
// sends widths through Hamlib as for any other rig.
//      node tci-rigctld.mjs --filters 2700,2400,1800 --rigctl rigctl -m 3073 ...
//      node tci-rigctld.mjs --filters 3000,2400,1800 --civ A4 --rigctl rigctl -m 3085 ...
//
// Needs Node.js and the "ws" package: inside a PhantomSDR-Plus tree it uses
// frontend/node_modules; anywhere else run "npm install ws" in this folder.
//
// It polls the rig for frequency, mode, filter width and PTT, sends the page
// only what changed, and passes the page's frequency, mode and filter changes
// to the rig.
import { createRequire } from "module";
import { spawn } from "child_process";
import net from "net";

function loadWs() {
  for (const base of ["./package.json", "../frontend/package.json"]) {
    try {
      return createRequire(new URL(base, import.meta.url))("ws");
    } catch (e) {}
  }
  console.error('The "ws" package is missing: run "npm install ws" here.');
  process.exit(1);
}
const { WebSocketServer } = loadWs();

const argv = process.argv.slice(2);
// --filters <FIL1,FIL2,FIL3 | off> goes before --rigctl.
// --filters and --civ go before --rigctl.
function takeOption(name) {
  const i = argv.indexOf(name);
  const r = argv.indexOf("--rigctl");
  if (i < 0 || (r >= 0 && i > r)) return null;
  const value = argv[i + 1] || "";
  argv.splice(i, 2);
  return value;
}
const filtersArg = takeOption("--filters");
const civArg = takeOption("--civ");
const rigctlAt = argv.indexOf("--rigctl");
const positional = rigctlAt >= 0 ? argv.slice(0, rigctlAt) : argv;
const rigctlPath = rigctlAt >= 0 ? argv[rigctlAt + 1] : null;
const rigctlArgs = rigctlAt >= 0 ? argv.slice(rigctlAt + 2) : [];
if (rigctlAt >= 0 && !rigctlPath) {
  console.error("--rigctl needs the rigctl program, e.g.:");
  console.error("  node tci-rigctld.mjs --rigctl rigctl -m 3073 -r COM4 -s 115200");
  process.exit(1);
}
// A long command line pasted into a terminal is easily cut short, leaving
// "-s" without its speed; rigctl then only answers "Type: rigctl --help".
for (const opt of ["-m", "-r", "-s", "-c"]) {
  const i = rigctlArgs.indexOf(opt);
  if (i >= 0 && (i === rigctlArgs.length - 1 || rigctlArgs[i + 1].startsWith("-"))) {
    const example = { "-m": "-m 3073", "-r": "-r COM4", "-s": "-s 115200", "-c": "-c 148" }[opt];
    console.error(`The value after ${opt} is missing (e.g. ${example}).`);
    console.error("The command line was probably cut short when it was pasted; type the end again.");
    process.exit(1);
  }
}

const port = Number(positional[0]) || 50001;

// Icom filter selection: reference widths per mode (FIL1, FIL2, FIL3), or
// null when widths go through Hamlib instead.
const modelAt = rigctlArgs.indexOf("-m");
const model = modelAt >= 0 ? rigctlArgs[modelAt + 1] : null;
let icomFilters = null;
if (filtersArg !== null && filtersArg.toLowerCase() !== "off") {
  const w = filtersArg.split(",").map((x) => parseInt(x, 10));
  if (w.length !== 3 || !w.every((x) => x > 0)) {
    console.error("--filters needs three widths in Hz, FIL1,FIL2,FIL3, e.g. --filters 2700,2400,1800");
    process.exit(1);
  }
  icomFilters = { ssb: w };
} else if (filtersArg === null && model === "3073") {
  icomFilters = { ssb: [2700, 2400, 1800] };
}
// The rig's CI-V address: --civ (hex), rigctl's -c (decimal), else 94h.
let civAddress = 0x94;
if (civArg) civAddress = parseInt(civArg, 16);
else if (rigctlArgs.indexOf("-c") >= 0) civAddress = parseInt(rigctlArgs[rigctlArgs.indexOf("-c") + 1], 10);
if (!(civAddress > 0 && civAddress < 0x100)) {
  console.error("--civ needs the rig's CI-V address in hex, e.g. --civ 94");
  process.exit(1);
}

const [rigHost, rigPort] = (positional[1] || "127.0.0.1:4532").split(":");
const POLL_MS = 250;

// Hamlib mode -> the TCI name the page understands. Data modes (USB-D on
// the IC-7300) are sent as their voice mode so the receiver still follows.
const MODES = {
  USB: "usb", PKTUSB: "usb", LSB: "lsb", PKTLSB: "lsb",
  CW: "cw", CWR: "cw-l", AM: "am", PKTAM: "am", FM: "fm", PKTFM: "fm",
};

const log = (msg) =>
  console.log(`${new Date().toTimeString().slice(0, 8)}  ${msg}`);
const rig = { hz: null, mode: null, tx: null, hamlib: null, width: null, widthMode: null };

// TCI mode names from the page -> Hamlib's.
const HAMLIB_MODES = {
  usb: "USB", lsb: "LSB", cw: "CW", "cw-l": "CWR", am: "AM", sam: "AM",
  nfm: "FM", fm: "FM", wfm: "WFM", digu: "PKTUSB", digl: "PKTLSB",
};

// The mode the page last asked for. A filter that arrives right behind it
// must be set in that mode, not in the one the rig still reports.
let wanted = { mode: null, at: 0 };

// Hamlib repeats the same error on every poll; print each one once, and
// again only if it is still there a minute later.
const lastErrors = new Map();
function logError(msg) {
  const now = Date.now();
  if (now - (lastErrors.get(msg) || 0) < 60000) return;
  lastErrors.set(msg, now);
  log(msg);
}

// ── TCI server for the page ───────────────────────────────────────────────
const wss = new WebSocketServer({ port });
const send = (frame) =>
  wss.clients.forEach((c) => c.readyState === 1 && c.send(frame));

// A filter width as TCI's edges around the carrier: above it in USB, below
// it in LSB, centred otherwise.
function filterEdges(hamlibMode, width) {
  if (/USB$/.test(hamlibMode)) return [0, width];
  if (/LSB$/.test(hamlibMode)) return [-width, 0];
  return [-Math.round(width / 2), Math.round(width / 2)];
}

// What the rig reported; only changes go to the page.
function update(hz, hamlibMode, ptt, width) {
  if (Number.isFinite(hz) && hz > 0 && hz !== rig.hz) {
    rig.hz = hz;
    send(`vfo:0,0,${hz};`);
    log(`rig -> page ${hz} Hz`);
  }
  if (typeof hamlibMode === "string" && hamlibMode) rig.hamlib = hamlibMode;
  const mode = MODES[hamlibMode];
  if (mode && mode !== rig.mode) {
    rig.mode = mode;
    send(`modulation:0,${mode};`);
    log(`rig -> page mode ${hamlibMode}`);
  }
  // The edges depend on the mode, so a mode change re-sends the filter too.
  if (Number.isFinite(width) && width > 0 && rig.hamlib &&
      (width !== rig.width || rig.hamlib !== rig.widthMode)) {
    rig.width = width;
    rig.widthMode = rig.hamlib;
    const [low, high] = filterEdges(rig.hamlib, width);
    send(`rx_filter_band:0,${low},${high};`);
    log(`rig -> page filter ${width} Hz`);
  }
  if (ptt === "0" || ptt === "1") {
    const tx = ptt === "1";
    if (tx !== rig.tx) {
      rig.tx = tx;
      send(`trx:0,${tx};`);
      log(`rig -> page ${tx ? "TX (page muted)" : "RX"}`);
    }
  }
}

// ── Backend A: rigctl, commands through its standard input ────────────────
function startRigctl() {
  let proc = null;
  let inflight = 0; // commands written and not yet finished
  let lastPrompt = 0;
  let out = "";
  let errLine = "";

  function write(cmd) {
    if (!proc) return false;
    inflight++;
    proc.stdin.write(cmd + "\n");
    return true;
  }

  function launch() {
    const shown = [rigctlPath, ...rigctlArgs].join(" ");
    log(`starting ${shown}`);
    try {
      proc = spawn(rigctlPath, rigctlArgs, { windowsHide: true });
    } catch (e) {
      log(`cannot start rigctl: ${e.message} — retrying`);
      proc = null;
      setTimeout(launch, 3000);
      return;
    }
    // rigctl prints one "Rig command:" prompt at start and one after each
    // command it has finished; counting them keeps the polls from piling up
    // behind a slow rig.
    inflight = 1;
    lastPrompt = Date.now();
    out = "";
    let answered = false;
    proc.stdin.on("error", () => {});
    proc.stdout.setEncoding("utf8");
    proc.stdout.on("data", (d) => {
      out += d;
      const parts = out.split("Rig command:");
      out = parts.pop();
      if (parts.length) {
        inflight = Math.max(0, inflight - parts.length);
        lastPrompt = Date.now();
      }
      // Whole lines only: the text after the last newline may still be
      // arriving ("Frequency: 1450...").
      const nl = out.lastIndexOf("\n");
      const done = nl === -1 ? "" : out.slice(0, nl);
      if (nl !== -1) out = out.slice(nl + 1);
      for (const text of [...parts, done]) {
        for (const raw of text.split("\n")) {
          const line = raw.trim();
          let m;
          if ((m = line.match(/^Frequency:\s*(\d+)/))) {
            if (!answered) log("rig answered through rigctl");
            answered = true;
            update(parseInt(m[1], 10), null, null, NaN);
          } else if ((m = line.match(/^Mode:\s*(\S+)/))) {
            update(NaN, m[1], null, NaN);
          } else if ((m = line.match(/^Passband:\s*(\d+)/))) {
            update(NaN, null, null, parseInt(m[1], 10));
          } else if ((m = line.match(/^PTT:\s*(\d)/))) {
            update(NaN, null, m[1], NaN);
          }
        }
      }
    });
    proc.stderr.setEncoding("utf8");
    proc.stderr.on("data", (d) => {
      for (const raw of d.split("\n")) {
        const line = raw.trim();
        if (!line) continue;
        errLine = line;
        if (/error|failed|denied|timeout|cannot|can't/i.test(line)) {
          logError(`rigctl: ${line}`);
        }
      }
    });
    proc.on("error", (e) => {
      log(`cannot start ${rigctlPath}: ${e.message}`);
    });
    proc.on("close", (code) => {
      log(
        `rigctl stopped (exit ${code})${errLine ? ` — ${errLine}` : ""}; ` +
          "restarting in 3 s",
      );
      proc = null;
      setTimeout(launch, 3000);
    });
  }

  function poll() {
    if (proc) {
      if (inflight > 0 && Date.now() - lastPrompt > 5000) {
        logError("the rig is not answering (check -r port and -s speed)");
        inflight = 0;
      }
      if (inflight === 0) {
        write("f");
        write("m");
        write("t");
      }
    }
    setTimeout(poll, POLL_MS);
  }

  launch();
  poll();
  return {
    label: `rigctl ${rigctlArgs.join(" ")}`,
    command: async (cmd) => (write(cmd) ? "sent" : "rigctl not running"),
    raw: async (cmd) => (write(cmd) ? "sent" : "rigctl not running"),
  };
}

// ── Backend B: rigctld over TCP, one command at a time ─────────────────────
function startRigctld() {
  let sock = null;
  let buf = "";
  let pending = null; // { lines, want, resolve }
  const queue = [];

  function pump() {
    if (pending || !queue.length || !sock) return;
    pending = queue.shift();
    sock.write(pending.cmd + "\n");
    // A raw CI-V command ("w ...") gets no reply from rigctld at all.
    if (pending.want === 0) {
      const p = pending;
      pending = null;
      p.resolve([]);
      pump();
    }
  }

  function ask(cmd, want) {
    return new Promise((resolve) => {
      queue.push({ cmd, want, lines: [], resolve });
      pump();
    });
  }

  function connectRig() {
    sock = net.createConnection(Number(rigPort) || 4532, rigHost);
    sock.setEncoding("utf8");
    sock.on("connect", () => log(`rigctld connected at ${rigHost}:${rigPort}`));
    sock.on("data", (d) => {
      buf += d;
      let i;
      while ((i = buf.indexOf("\n")) !== -1) {
        const line = buf.slice(0, i).trim();
        buf = buf.slice(i + 1);
        if (!pending) continue;
        pending.lines.push(line);
        // An error answers with a single RPRT line whatever was asked.
        if (pending.lines.length >= pending.want || line.startsWith("RPRT")) {
          const p = pending;
          pending = null;
          p.resolve(p.lines);
          pump();
        }
      }
    });
    const retry = () => {
      if (!sock) return;
      sock = null;
      buf = "";
      if (pending) pending.resolve([]);
      pending = null;
      queue.splice(0).forEach((q) => q.resolve([]));
      log(`rigctld not reachable at ${rigHost}:${rigPort} — retrying`);
      setTimeout(connectRig, 3000);
    };
    sock.on("error", () => {});
    sock.on("close", retry);
  }

  async function poll() {
    if (sock && !sock.connecting) {
      const [f] = await ask("f", 1);
      const [m, w] = await ask("m", 2);
      const [t] = await ask("t", 1);
      if (f && f.startsWith("RPRT")) {
        logError(`rigctld cannot read the rig (${f}) — check its -r port and -s speed`);
      }
      update(parseInt(f, 10), m, t, parseInt(w, 10));
    }
    setTimeout(poll, POLL_MS);
  }

  connectRig();
  poll();
  return {
    label: `rigctld at ${rigHost}:${rigPort}`,
    command: async (cmd) => {
      const [r] = await ask(cmd, 1);
      return r === "RPRT 0" ? "ok" : r || "no answer";
    },
    raw: async (cmd) => {
      if (!sock) return "rigctld not connected";
      await ask(cmd, 0);
      return "sent";
    },
  };
}

const backend = rigctlPath ? startRigctl() : startRigctld();
log(`TCI bridge on port ${port}, ${backend.label}`);
if (icomFilters) {
  const [a, b, c] = icomFilters.ssb;
  log(`Icom filter selection (CI-V ${civAddress.toString(16).toUpperCase()}h): SSB widths nearest ${a} / ${b} / ${c} Hz -> FIL1 / FIL2 / FIL3; the rig's filter widths are never changed`);
}

async function setMode(tciMode) {
  let target = HAMLIB_MODES[tciMode.toLowerCase()];
  if (!target) return `not a mode Hamlib knows (${tciMode})`;
  // The page has no data modes: its USB agrees with the rig's USB-D, so the
  // rig is not knocked out of a data mode.
  if (target === "USB" && rig.hamlib === "PKTUSB") target = "PKTUSB";
  if (target === "LSB" && rig.hamlib === "PKTLSB") target = "PKTLSB";
  wanted = { mode: target, at: Date.now() };
  if (target === rig.hamlib) return "already";
  // -1 keeps the rig's own filter; the page sends its width separately.
  return `${target}  ${await backend.command(`M ${target} -1`)}`;
}

// CI-V mode byte and reference widths (FIL1, FIL2, FIL3) per Hamlib mode.
function icomFilterPlan(mode) {
  const voice = mode.replace(/^PKT/, "");
  const plans = {
    LSB: [0x00, icomFilters.ssb], USB: [0x01, icomFilters.ssb],
    AM: [0x02, [9000, 6000, 3000]], CW: [0x03, [1200, 500, 250]],
    RTTY: [0x04, [2400, 500, 250]], FM: [0x05, [15000, 10000, 7000]],
    CWR: [0x07, [1200, 500, 250]], RTTYR: [0x08, [2400, 500, 250]],
  };
  const plan = plans[voice];
  return plan ? { byte: plan[0], widths: plan[1], data: voice !== mode } : null;
}

const hex = (b) => "\\0x" + b.toString(16).toUpperCase().padStart(2, "0");

async function setFilter(low, high) {
  const width = high - low;
  if (!(width > 0)) return "ignored";
  const mode =
    wanted.mode && Date.now() - wanted.at < 3000 ? wanted.mode : rig.hamlib;
  if (!mode) return "rig mode not known yet";
  if (!icomFilters) {
    return `${mode}  ${await backend.command(`M ${mode} ${width}`)}`;
  }
  const plan = icomFilterPlan(mode);
  if (!plan) return `${mode}  no FIL selection in this mode`;
  let best = 0;
  plan.widths.forEach((w, i) => {
    if (Math.abs(w - width) < Math.abs(plan.widths[best] - width)) best = i;
  });
  const fil = best + 1;
  // Select only: 06 <mode> <filter>, or in a data mode 1A 06 01 <filter>.
  const body = plan.data ? [0x1a, 0x06, 0x01, fil] : [0x06, plan.byte, fil];
  const frame = [0xfe, 0xfe, civAddress, 0xe0, ...body, 0xfd].map(hex).join("");
  return `${mode}  → FIL${fil}  ${await backend.raw(`w ${frame}`)}`;
}

wss.on("connection", (ws, req) => {
  log(`page connected from ${req.socket.remoteAddress}`);
  if (rig.hz) ws.send(`vfo:0,0,${rig.hz};`);
  if (rig.mode) ws.send(`modulation:0,${rig.mode};`);
  if (rig.width && rig.hamlib) {
    const [low, high] = filterEdges(rig.hamlib, rig.width);
    ws.send(`rx_filter_band:0,${low},${high};`);
  }
  if (rig.tx !== null) ws.send(`trx:0,${rig.tx};`);
  ws.on("message", async (data) => {
    for (const raw of String(data).split(";")) {
      const cmd = raw.trim();
      let m;
      if ((m = cmd.match(/^vfo:0,0,(\d+)$/))) {
        log(`page -> rig ${m[1]} Hz  ${await backend.command(`F ${m[1]}`)}`);
      } else if ((m = cmd.match(/^modulation:0,([\w-]+)$/))) {
        log(`page -> rig mode ${await setMode(m[1])}`);
      } else if ((m = cmd.match(/^rx_filter_band:0,(-?\d+),(-?\d+)$/))) {
        const low = parseInt(m[1], 10);
        const high = parseInt(m[2], 10);
        log(`page -> rig filter ${high - low} Hz  ${await setFilter(low, high)}`);
      }
    }
  });
  ws.on("close", () => log("page disconnected"));
});
