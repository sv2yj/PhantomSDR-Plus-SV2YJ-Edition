// Shared by audio.js, waterfall.js and events.js: all three open a socket that
// the server can refuse under its per-IP limits, and all three have to settle
// their init promise when it does — otherwise the page waits on a connection
// that is never coming and shows nothing at all.

// The close code the server refuses a connection with (CLOSE_IP_LIMIT in
// src/websocket.cpp). 4000-4999 is the private range, so it can never collide
// with a protocol-level status.
const REFUSED_CLOSE_CODE = 4003

// The close code the admin panel kicks a listener with (handle_kick in
// proxy.py). It has to be distinct from an ordinary close: a plain 1000 looks
// exactly like a dropped connection, so audio.js reconnects within a second
// and the kick undoes itself while the waterfall — which never reconnects —
// stays frozen.
const KICKED_CLOSE_CODE = 4001

// Rejection reason when the server turned a connection away. A page can tell
// this apart from an ordinary connection failure and say why, instead of
// sitting half-initialised with no explanation. Nothing retries on it: see
// _handleSocketTerminal() in audio.js.
export class ConnectionRefused extends Error {
  constructor (reason, code = REFUSED_CLOSE_CODE) {
    const text = reason || defaultReason(code)
    super(text)
    this.name = 'ConnectionRefused'
    this.reason = text
    this.code = code
    this.kicked = code === KICKED_CLOSE_CODE
  }
}

// What to say when the close frame carried no reason text of its own.
export function defaultReason (code) {
  return code === KICKED_CLOSE_CODE
    ? 'disconnected by the sysop'
    : 'too many connections from your address'
}

// True when a CloseEvent is terminal: the server turned this connection away
// (per-IP limit) or the sysop kicked it. Either way, retrying is wrong.
export function isRefusal (evt) {
  return !!evt && (evt.code === REFUSED_CLOSE_CODE || evt.code === KICKED_CLOSE_CODE)
}

// True when a CloseEvent is specifically an admin kick.
export function isKick (evt) {
  return !!evt && evt.code === KICKED_CLOSE_CODE
}
