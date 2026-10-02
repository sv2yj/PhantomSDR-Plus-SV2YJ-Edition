import { ConnectionRefused, isRefusal } from './refused'

export default class SpectrumEvent {
  constructor (endpoint) {
    this.endpoint = endpoint
    this.signalClients = {}
    this.lastModified = performance.now()
  }

  init () {
    if (this.promise) {
      return this.promise
    }

    this.eventSocket = new WebSocket(this.endpoint)
    this.eventSocket.binaryType = 'arraybuffer'
    this.eventSocket.onmessage = this.socketMessage.bind(this)

    this.promise = new Promise((resolve, reject) => {
      this.eventSocket.onopen = resolve
      this.resolvePromise = resolve
      this.rejectPromise = reject
    })

    // See waterfall.js: a refused socket has to reject, or the page waits on a
    // connection the server has already turned away.
    this.eventSocket.onclose = (evt) => {
      if (isRefusal(evt) && this.rejectPromise) {
        this.rejectPromise(new ConnectionRefused(evt.reason, evt.code))
      }
    }

    return this.promise
  }

  socketMessage (event) {
    const data = JSON.parse(event.data)
    this.data = data
    if ('signal_list' in data) {
      this.signalClients = data.signal_list
    }
    if ('signal_changes' in data) {
      const signalChanges = data.signal_changes
      for (const [user, range] of Object.entries(signalChanges)) {
        if (range[0] === -1 && range[1] === -1) {
          delete this.signalClients[user]
        } else {
          this.signalClients[user] = range
        }
      }
    }
 
    if ('waterfall_clients' in data) {
      // Count listeners by their /audio connection, not their /waterfall one.
      // The desktop page opens waterfall + audio + events, but /mobile opens
      // /audio ONLY (no waterfall canvas) — counting waterfall sockets made
      // mobile listeners invisible here even though they showed up in
      // users.html and as labels on the waterfall, both of which are built
      // from the audio (signal_slices) list. signal_clients is that same
      // list, already excluding loopback taps and closing connections, so it
      // matches the /users total exactly.
      const userCount = 'signal_clients' in data
        ? data.signal_clients
        : data.waterfall_clients;
      // Guard: coerce to Number before adding — if the server sends these
      // as strings, the bare `+` operator would concatenate them instead of
      // adding, and parseInt() would then parse only the first number.
      const dataRate = Math.round((+data.waterfall_kbits || 0) + (+data.audio_kbits || 0));
      
      document.getElementById('total_user_count').innerHTML = `
        <div class="flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2 text-fuchsia-400" viewBox="0 0 20 20" fill="currentColor">
            <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
          </svg>
          <span class="text-fuchsia-400 font-medium">${userCount} ${userCount > 1 ? 'Users' : 'User'}</span>
        </div>
        <div class="flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clip-rule="evenodd" />
          </svg>
          <span class="text-blue-400 font-medium">${dataRate} kbit/s</span>
        </div>
      `;
    }
    this.lastModified = performance.now()
  }

  setUserID (userID) {
    this.eventSocket.send(JSON.stringify({
      cmd: 'userid',
      userid: userID
    }))
  }

  getSignalClients () {
    let signalClients = {}
    Object.assign(signalClients, this.signalClients)
    return signalClients
  }

  getLastModified () {
    return this.lastModified
  }
}
