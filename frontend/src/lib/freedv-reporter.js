// freedv-reporter.js — live FreeDV Reporter feed for PhantomSDR-Plus
// ====================================================================
// Connects directly to the FreeDV Reporter Socket.IO server as a
// view-only client (the same feed https://qso.freedv.org/ uses) and
// exposes a reactive store of active stations. This replaces the
// cross-origin <iframe> embed with our own native list.
//
// The server accepts cross-origin connections (it reflects
// Access-Control-Allow-Origin), so this works straight from the browser.
//
// Protocol (reverse-engineered from qso.freedv.org/static/js/index.js):
//   connect auth : { role: "view", protocol_version: 2 }
//   server emits : bulk_update (snapshot) then live deltas:
//     new_connection    {sid, callsign, grid_square, version, rx_only}
//     tx_report         {sid, mode, transmitting, last_tx, last_update}
//     freq_change       {sid, freq (Hz), last_update}
//     message_update    {sid, message, last_update}
//     rx_report         {sid, callsign(heard), mode, snr, last_update}
//     remove_connection {sid}
//     bulk_update       [[eventName, data], ...]

import { readable } from "svelte/store";
import { io } from "socket.io-client";

const REPORTER_URL = "https://qso.freedv.org";

// Parse the server's date strings into epoch-ms (0 if absent/invalid).
function ms(v) {
  if (!v) return 0;
  const t = Date.parse(v);
  return Number.isNaN(t) ? 0 : t;
}

function makeStation(o) {
  return {
    sid: o.sid,
    callsign: (o.callsign || "").toUpperCase(),
    grid: o.grid_square || "",
    version: o.version || "",
    rxOnly: !!o.rx_only,
    status: o.rx_only ? "Receive Only" : "Receiving",
    message: "",
    freq: null, // Hz
    txMode: o.rx_only ? "N/A" : "--",
    lastTx: 0,
    rxCallsign: "",
    rxMode: "",
    snr: null,
    lastUpdate: 0,
  };
}

// Sort: Transmitting first, then by frequency, then callsign.
// Deliberately NOT by last-update — sorting on recency makes rows jump on
// every packet. A stable key keeps rows in place while their cells update
// live (Svelte re-renders each row by sid without moving it).
export function sortStations(list) {
  return list.slice().sort((a, b) => {
    const ra = a.status === "Transmitting" ? 0 : 1;
    const rb = b.status === "Transmitting" ? 0 : 1;
    if (ra !== rb) return ra - rb;
    const fa = a.freq == null ? Infinity : a.freq;
    const fb = b.freq == null ? Infinity : b.freq;
    if (fa !== fb) return fa - fb; // ascending frequency
    return a.callsign.localeCompare(b.callsign); // stable tiebreaker
  });
}

// Single shared readable store. The socket is opened on the first
// subscriber and torn down when the last subscriber leaves (i.e. when
// the Reporter panel is closed), so we only hold a connection while
// something is actually watching.
export const reporter = readable({ connected: false, stations: [] }, (set) => {
  const stations = new Map();
  let socket;

  const snapshot = () =>
    set({ connected: !!(socket && socket.connected), stations: Array.from(stations.values()) });

  const ensure = (sid) => {
    let st = stations.get(sid);
    if (!st) {
      st = makeStation({ sid });
      stations.set(sid, st);
    }
    return st;
  };

  const handlers = {
    new_connection(o) {
      stations.set(o.sid, makeStation(o));
    },
    remove_connection(o) {
      stations.delete(o.sid);
    },
    tx_report(o) {
      const st = ensure(o.sid);
      st.status = o.transmitting ? "Transmitting" : st.rxOnly ? "Receive Only" : "Receiving";
      if (!st.rxOnly) st.txMode = o.mode || "--";
      if (o.last_tx) st.lastTx = ms(o.last_tx);
      st.lastUpdate = ms(o.last_update);
    },
    freq_change(o) {
      const st = ensure(o.sid);
      st.freq = typeof o.freq === "number" ? o.freq : parseFloat(o.freq) || null;
      st.lastUpdate = ms(o.last_update);
    },
    message_update(o) {
      const st = ensure(o.sid);
      st.message = o.message || "";
      st.lastUpdate = ms(o.last_update);
    },
    rx_report(o) {
      const st = ensure(o.sid);
      const heard = o.callsign || "";
      const mode = o.mode || "";
      if (heard === "" && mode === "") {
        // frequency change cleared the RX data
        st.rxCallsign = "";
        st.rxMode = "";
        st.snr = null;
      } else {
        st.rxCallsign = heard.toUpperCase();
        st.rxMode = mode;
        st.snr = o.snr == null ? null : o.snr;
      }
      st.lastUpdate = ms(o.last_update);
    },
  };

  socket = io(REPORTER_URL, {
    auth: { role: "view", protocol_version: 2 },
    transports: ["websocket", "polling"],
  });

  socket.on("connect", () => {
    // Fresh session — the server (re)sends a bulk_update snapshot, so
    // start from a clean slate to avoid stale/duplicate rows.
    stations.clear();
    snapshot();
  });
  socket.on("disconnect", snapshot);
  socket.io.on("reconnect", () => {
    stations.clear();
    snapshot();
  });

  for (const [name, fn] of Object.entries(handlers)) {
    socket.on(name, (data) => {
      fn(data);
      snapshot();
    });
  }

  socket.on("bulk_update", (batch) => {
    if (Array.isArray(batch)) {
      for (const msg of batch) {
        const fn = handlers[msg[0]];
        if (fn) fn(msg[1]);
      }
    }
    snapshot();
  });

  return () => {
    socket.disconnect();
    stations.clear();
  };
});
