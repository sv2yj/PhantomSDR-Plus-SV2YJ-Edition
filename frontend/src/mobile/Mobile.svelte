<script>
  import { onMount, onDestroy, tick } from 'svelte'
  import { audio, init as initBackend, resumeAudio } from './backend.js'
  import { MODES, tune, coverage } from './tuning.js'
  import { bands as ALL_BANDS } from '../bands-config.js'
  import * as BM from './bookmarks.js'
  import siteInfo from '../../site_information.json'
  import copy from 'copy-to-clipboard'
  import {
    LS_URL as DIV_LS_URL,
    LS_TYPE as DIV_LS_TYPE,
    LS_CAL as DIV_LS_CAL,
    TYPES as DIV_TYPES,
    typeLabel as divTypeLabel,
    hintFor as divHint,
    emptyHistory,
    loadHistory,
    saveHistory as persistDivHistory,
    remembered,
    normalise as divNormalise,
    exportBlob as divExportBlob,
    parseBlob as divParseBlob,
    mergeHistories as divMergeHistories,
    qrTooLarge as divQrTooLarge,
    qrDataUrl as divQrDataUrl,
    browseUrl as divBrowseUrl
  } from '../diversityList.js'

  // ── Header ───────────────────────────────────────────────────────────────
  // Plain text, no links — same source the desktop App.svelte imports.
  const siteTitle = [
    `WebSDR ${siteInfo.siteSysop || ''}`.trim(),
    siteInfo.siteCity || '',
    siteInfo.siteGridSquare || ''
  ].filter(Boolean).join(', ')
  // Directory links, same three the desktop app offers.
  const SDR_LIST_XYZ_URL = 'https://sdr-list.xyz/'
  const SHBRG_URL        = 'https://sdr.shbrg.nl/sdr/'
  const WEBSDR_ORG_URL   = 'http://websdr.org/'

  // ── Connection ───────────────────────────────────────────────────────────
  let status = 'connecting'    // connecting | needs-gesture | running | error
  let errorMsg = ''
  let settings = null

  // ── Tuning ───────────────────────────────────────────────────────────────
  let frequency = 0            // Hz
  let mode = 'USB'
  let tuneStep = 1000
  const TUNE_STEPS = [10, 100, 1000, 5000, 9000, 10000]
  let freqEditing = false
  let freqEditValue = ''

  // ── Audio controls ───────────────────────────────────────────────────────
  let volume = 50
  let muted = false
  let squelchEnable = false
  let squelch = -50
  // AI noise reduction (RNNoise, see lib/rnnoise.js) — same control as the
  // desktop's AI row: off by default, strength 50%, voice modes only.
  let aiEnabled = false
  let aiLoading = false          // first enable downloads RNNoise (~1.3 MB)
  let aiStrength = 50
  const AI_MODES = ['USB', 'LSB', 'AM', 'SAM']
  $: aiActive = aiEnabled && AI_MODES.includes(mode)
  // The desktop's six buffer presets, exactly — same values, same order. See
  // handleAudioBufferDelayMove() in App.svelte, which is now the same ladder
  // starting at audio.js's own constructor defaults so that x1 means what the
  // engine already does.
  //
  // Index here is the desktop's step minus one, which is what lets a bookmark
  // saved on either page restore the same setting on the other.
  //
  // The default is index 1, not 0: the second number is the cushion, the whole
  // margin the playback path has against a late packet, and index 0's 0.01 s
  // clamps up to 0.02 s. Twenty milliseconds is fine on a cable and far too
  // little on a phone. It stays on the ladder because the two pages offer the
  // same choices, but it is not what a handset starts on.
  //
  // (bufferLimit, bufferThreshold) pairs. Both halves reach the playback path
  // live — the worklet's ring buffer via _workletBufferOptions(), and the
  // scheduled-buffer path's cushion directly — so moving this is heard at
  // once, mid-session.
  const BUFFER_PRESETS = [
    [0.25, 0.01], [0.5, 0.1], [1.0, 0.2], [1.5, 0.3], [2.0, 0.4], [2.5, 0.5]
  ]
  let bufferStep = 1        // the desktop's x2 — the handset default

  // ── Recording ────────────────────────────────────────────────────────────
  let isRecording = false
  let recordError = ''

  // ── RADE ─────────────────────────────────────────────────────────────────
  let radeEnabled = false
  let radeConnected = false
  let radeSynced = false
  let radeSnr = null

  // ── Receive diversity ────────────────────────────────────────────────────
  // The engine is already in this bundle — audio.js imports the combiner and
  // all four source adapters — and tuning.js already goes through
  // audio.setAudioRange/setAudioDemodulation, both of which retune the remote.
  // So only the controls were missing, and nothing here needs the waterfall
  // (this page has none): the combiner measures both SNRs from audio alone.
  //
  // The saved list is the SAME localStorage list the desktop page keeps, in
  // the same format — see diversityList.js. A receiver added on the desktop
  // is offered here, and the other way round.
  let divType = 'phantom'
  let divEndpoint = ''
  let divCalib = 0
  let divRunning = false
  let divStatus = { active: false, state: 'idle', locked: false }
  let divHistory = emptyHistory()
  let divPoller = null

  try {
    divEndpoint = localStorage.getItem(DIV_LS_URL) || ''
    divType = localStorage.getItem(DIV_LS_TYPE) || 'phantom'
    divCalib = Number(localStorage.getItem(DIV_LS_CAL) || 0) || 0
  } catch (e) {}
  divHistory = loadHistory()

  $: divSaved = divHistory[divType] || []
  $: divAnySaved = DIV_TYPES.some((t) => (divHistory[t] || []).length > 0)
  // The entry actually on air, matched on the address: neither the box nor
  // the type selector can move while a session is up, so it cannot go stale.
  $: divLiveAddr = divRunning ? (divEndpoint || '').trim() : ''
  // Two states are what matters at a glance — still working on it, or good.
  $: divWaiting = divRunning && (divStatus.state !== 'ready' || !divStatus.locked)

  function divStartPoll () {
    if (divPoller) return
    // The combiner reports in stream time and updates a few times a second;
    // 500 ms is plenty, and it only runs while a session is up so an idle
    // phone is not woken for nothing.
    divPoller = setInterval(() => {
      try {
        divStatus = audio.getDiversityStatus()
        divRunning = !!divStatus.active
      } catch (e) {}
    }, 500)
  }

  function divStopPoll () {
    if (divPoller) clearInterval(divPoller)
    divPoller = null
  }

  function divToggle () {
    if (divRunning) {
      try { audio.stopDiversity() } catch (e) {}
      divStopPoll()
      divRunning = false
      divStatus = { active: false, state: 'idle', locked: false }
      return
    }
    const url = divNormalise(divEndpoint, divType)
    if (!url) return
    try {
      localStorage.setItem(DIV_LS_URL, divEndpoint)
      localStorage.setItem(DIV_LS_TYPE, divType)
      localStorage.setItem(DIV_LS_CAL, String(divCalib))
    } catch (e) {}
    if (audio.startDiversity(url, { remoteCalibDb: divCalib, type: divType })) {
      // Only on a start that was accepted: a rejected address is not one
      // worth offering again.
      divHistory[divType] = remembered(divHistory, divType, divEndpoint)
      divHistory = divHistory
      persistDivHistory(divHistory)
      divRunning = true
      divStartPoll()
    }
  }

  function divSetCalib () {
    try { audio.setDiversityCalib(divCalib) } catch (e) {}
    try { localStorage.setItem(DIV_LS_CAL, String(divCalib)) } catch (e) {}
  }

  // Switching type swaps in that type's most recent address, but only when the
  // box is empty or still holds one belonging to the type being left — never
  // overwrite something half-typed. divPrevType is tracked by hand because
  // bind:value has already written the new type by the time change fires.
  // ── Carrying the list between browsers ───────────────────────────────────
  // This phone is a different browser from the desktop, so it starts with an
  // empty list however many receivers are saved there. The desktop panel can
  // draw its list as a QR code; scan it and paste the text here. Same shape as
  // the bookmarks transfer above, on purpose.
  let divTransfer = null       // null | 'export' | 'import'
  let divBlob = ''
  let divQr = ''
  let divQrError = ''
  let divPaste = ''
  let divPending = null        // parsed text waiting for merge-or-replace
  let divResult = ''

  async function divShowExport () {
    divTransfer = 'export'
    divResult = ''
    divPending = null
    divQr = ''
    divQrError = ''
    divBlob = divExportBlob(divHistory)
    if (divQrTooLarge(divBlob)) {
      divQrError = 'Too many receivers for a scannable QR code — use the text below.'
      return
    }
    try {
      divQr = await divQrDataUrl(divBlob)
    } catch (e) {
      divQrError = 'Could not draw the QR code — use the text below.'
    }
  }

  // See copyExport() below for why this is not navigator.clipboard.
  function divCopyExport () {
    divResult = copy(divBlob)
      ? 'Copied to the clipboard.'
      : 'Copy failed — select the text and copy it by hand.'
  }

  function divDoImport () {
    const parsed = divParseBlob(divPaste)
    if (!parsed.ok) { divResult = parsed.error; divPending = null; return }
    divPending = parsed
    divResult = ''
  }

  function divApplyImport (merge) {
    if (!divPending) return
    divHistory = divMergeHistories(divHistory, divPending.history, merge)
    persistDivHistory(divHistory)
    if (!(divEndpoint || '').trim()) {
      const first = (divHistory[divType] || [])[0]
      divEndpoint = first ? first.addr : ''
    }
    divResult = (merge ? 'Merged ' : 'Replaced with ') + divPending.count +
      (divPending.count === 1 ? ' receiver.' : ' receivers.')
    divPending = null
    divPaste = ''
    divTransfer = null
  }

  let divPrevType = divType
  function divOnTypeChange () {
    const leaving = divHistory[divPrevType] || []
    const current = (divEndpoint || '').trim()
    if (current === '' || leaving.some((e) => e.addr === current)) {
      const first = (divHistory[divType] || [])[0]
      divEndpoint = first ? first.addr : ''
    }
    divPrevType = divType
  }

  // ── Tabs ─────────────────────────────────────────────────────────────────
  let tab = 'audio'

  // ── Users ────────────────────────────────────────────────────────────────
  let users = []
  let usersError = ''
  let usersTimer = null

  // ── Audio path diagnostic ────────────────────────────────────────────────
  // Which playback path this phone actually got, shown on the page because it
  // cannot be read any other way without plugging the phone into a computer.
  // The distinction matters: over plain http a desktop on localhost is a
  // secure context and gets the AudioWorklet, while a phone on the LAN address
  // is not and silently falls back to scheduled AudioBufferSourceNodes, which
  // sound far worse. That difference is invisible and no buffer setting
  // touches it.
  // Opt-in with ?diag=1 — a listener cannot act on "you are on the degraded
  // path", so it is not worth a line of permanent UI, but it is exactly what
  // is needed when someone reports bad audio and the only machine that can
  // reproduce it is a phone somewhere else.
  const DIAG_ON = (() => {
    try { return new URLSearchParams(window.location.search).has('diag') } catch (e) { return false }
  })()
  let diag = null
  let diagTimer = null

  // Connection banner. The audio socket dropping is routine on a phone —
  // screen lock, WiFi to cellular — and the engine now reconnects by itself.
  // This exists so the gap is visible while it happens, instead of the page
  // looking perfectly healthy with no sound coming out of it.
  let audioLink = 'connected'   // connected | lost | refused | kicked
  let audioLinkTimer = null
  // Reason text when the server refused this session outright (per-IP limit).
  let refusedReason = ''

  // ── Chat ─────────────────────────────────────────────────────────────────
  let chatSocket = null
  let chatMessages = []
  let chatInput = ''
  let username = ''
  let chatConnected = false
  let chatScroller

  // ── Bookmarks ────────────────────────────────────────────────────────────
  let bookmarks = []
  let newBookmarkName = ''
  let transferMode = null      // null | 'export' | 'import'
  let exportText = ''
  let exportQr = ''
  let exportQrError = ''
  let importText = ''
  let importResult = ''

  // ── S-meter ──────────────────────────────────────────────────────────────
  // Logical drawing space is 300x40, matching App__digital_smeter_.svelte's
  // geometry exactly; the canvas is scaled to the container width and to
  // devicePixelRatio so it stays sharp on a phone instead of overflowing.
  const SM_W = 300, SM_H = 40
  let smeterCanvas
  let smeterRaf = null

  // ═══════════════════════════════════════════════════════════════════════
  // Lifecycle
  // ═══════════════════════════════════════════════════════════════════════
  // Safari throws on any localStorage access when "Block All Cookies" is set,
  // and older iOS private-browsing modes throw on write. An uncaught throw here
  // would abort onMount and strand the page on "Connecting…", so every access
  // goes through these.
  function lsGet (key, dflt = '') {
    try { return localStorage.getItem(key) ?? dflt } catch (e) { return dflt }
  }
  function lsSet (key, value) {
    try { localStorage.setItem(key, value); return true } catch (e) { return false }
  }

  onMount(async () => {
    username = lsGet('chatusername')
    bookmarks = BM.load()

    try {
      settings = await initBackend()
    } catch (e) {
      status = 'error'
      // A refusal (per-IP limit) is not a fault the listener can wait out, so
      // say what it was and what would actually help. audio.js does not retry
      // this one — see ConnectionRefused in refused.js.
      errorMsg = (e && e.name === 'ConnectionRefused')
        ? `The receiver refused the connection: ${e.reason || e.message}. Everyone sharing your internet connection counts as one address — close other tabs on this receiver and reload.`
        : (e && e.message) ? e.message : 'Could not connect to the receiver'
      return
    }

    myId = audio.clientId ?? null
    // Receiver defaults first, then anything the URL carries — that query
    // string is how the extended view hands its tuning over (and how a reload
    // of this page gets back to where it was).  retune() clamps it to the
    // receiver's coverage, so a stale or out-of-range link cannot strand the
    // page off the band.
    frequency = settings.defaults?.frequency ?? coverage(settings)[0]
    mode = normaliseServerMode(settings.defaults?.modulation) || 'USB'
    const urlTuning = parseUrlTuning()
    if (urlTuning.frequency !== undefined) {
      frequency = urlTuning.frequency
      // An explicit, selectable mode from the link wins; otherwise the band
      // plan in bands-config.js decides, the same way a band button does.
      // Falling back to the receiver default instead would land, say, a
      // broadcast frequency in USB.
      mode = urlTuning.mode || bandDefaultModeFor(frequency) || mode
    } else if (urlTuning.mode) {
      mode = urlTuning.mode
    }
    // Seed the band tracker at the frequency we are opening on, so the first
    // retune() sees no change and leaves the mode decided above alone. Without
    // this it would look like a move into a new band and overwrite it.
    checkBandAndSetMode(frequency, false)

    status = (await resumeAudio()) ? 'running' : 'needs-gesture'

    // Self-correct: the context can start slightly after resumeAudio() gave up
    // (or later, from audio.js's own gesture listener). Follow the real state
    // rather than trusting that one snapshot, so the page can never sit showing
    // "Tap to start" while audio is already playing.
    watchAudioState()

    applyVolume()
    // Applied at startup so the control and the engine agree from the first
    // frame. The default is preset 1 while audio.js's constructor sits at
    // preset 0, so leaving this unsent would show "0.5 s" on a page actually
    // running at 0.25 s. Ordering is not delicate — the worklet node is built
    // lazily on the first PCM frame and reads these values then, and a later
    // change is posted to it as a 'config' message, so either side of
    // retune() works.
    applyBuffer()
    retune()

    audio.onConnectionChange = (state) => {
      if (audioLinkTimer) { clearTimeout(audioLinkTimer); audioLinkTimer = null }
      if (state === 'refused') {
        // A kick shows nothing: the sysop ended the session, the page simply
        // stops. Only a per-IP refusal gets a banner, because that one the
        // listener can act on.
        refusedReason = audio.refusedReason || 'too many connections from your address'
        audioLink = audio.kicked ? 'kicked' : 'refused'
        return
      }
      // Every other non-connected state is a drop, and a drop is the end of
      // the session: audio.js does not reopen the socket, so the banner says
      // what to do rather than promising a reconnect that is not coming.
      audioLink = (state === 'connected') ? 'connected' : 'lost'
    }

    startUsersPoll()
    startDiagPoll()
    connectChat()
    openWhoAmIChannel()
    await tick()
    startSmeter()
  })

  onDestroy(() => {
    if (usersTimer) clearInterval(usersTimer)
    if (diagTimer) clearInterval(diagTimer)
    if (audioLinkTimer) clearTimeout(audioLinkTimer)
    if (smeterRaf) cancelAnimationFrame(smeterRaf)
    try { chatSocket && chatSocket.close() } catch (e) {}
    try { whoChannel && whoChannel.close() } catch (e) {}
    divStopPoll()
    try { audio.onConnectionChange = null } catch (e) {}
    try { audio.stopDiversity() } catch (e) {}
    try { audio.stop() } catch (e) {}
  })

  // users.html, opened in its own tab, asks over a BroadcastChannel which of
  // the listed sessions belongs to the person reading it, so it can mark that
  // row "you". We hold a session too, so we answer the same way the desktop
  // app does — otherwise someone listening here sees an unmarked list.
  let whoChannel = null

  function openWhoAmIChannel () {
    if (typeof BroadcastChannel === 'undefined') return
    try {
      whoChannel = new BroadcastChannel('phantomsdr')
      whoChannel.addEventListener('message', (e) => {
        const d = e.data
        if (!d || d.type !== 'phantomsdr-hello') return
        const id = audio.clientId ?? myId
        if (!id) return  // no id yet; the next question gets a real answer
        try { whoChannel.postMessage({ type: 'phantomsdr-me', id: String(id) }) } catch (err) {}
      })
    } catch (e) {
      whoChannel = null
    }
  }

  async function handleStart () {
    const ok = await resumeAudio()
    if (ok) {
      status = 'running'
      await tick()
      startSmeter()
    }
    // If it did not take effect immediately, watchAudioState() below will pick
    // it up as soon as the context reports 'running'.
  }

  /** Track the AudioContext's real state for the life of the page. */
  function watchAudioState () {
    const ctx = audio.audioCtx
    if (!ctx) return
    const sync = async () => {
      if (ctx.state === 'running' && status !== 'running') {
        status = 'running'
        await tick()
        startSmeter()
      } else if (ctx.state !== 'running' && status === 'running') {
        status = 'needs-gesture'
      }
    }
    // standardized-audio-context exposes onstatechange; guard anyway.
    try { ctx.onstatechange = sync } catch (e) {}
    sync()
  }

  /**
   * Map a server-side mode name to one of ours.
   *
   * Two vocabularies arrive here. settings.defaults.modulation comes from the
   * config file, while /users reports AudioClient::get_mode_str() (signal.cpp),
   * which is lowercase and much coarser: only usb/lsb/am/fm/am-s/iq. CW is
   * carried as a plain sideband server-side, so a CW listener shows as "usb" —
   * that is the server's view, and there is nothing finer to recover.
   * Returns null when there is no sensible mapping, meaning "leave mode alone".
   */
  function normaliseServerMode (m) {
    if (!m) return null
    const up = String(m).toUpperCase()
    if (up === 'CWL') return 'CW-L'
    if (up === 'AM-ENV') return 'AM'
    if (up === 'AM-S') return 'QUAM'   // AM stereo == C-QUAM
    if (up === 'IQ') return null
    return MODES.includes(up) ? up : null
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Carrying the tuning between the two mobile views
  // ═══════════════════════════════════════════════════════════════════════
  // This page and App.svelte's extended mobile layout are separate bundles on
  // separate URLs, so switching between them is a full page load and each side
  // would otherwise start at the receiver's default frequency.  Both now pass
  // the current frequency and mode in the query string — the same
  // ?frequency=<Hz>&modulation=<MODE> pair App.svelte has always accepted (see
  // parseLink in lib/storage.js).
  //
  // Parsed here with URLSearchParams rather than by importing lib/storage.js:
  // that would pull qs + is-number into this deliberately small bundle for the
  // sake of two values.

  /** Read ?frequency / ?modulation. Returns {} when absent or unusable. */
  function parseUrlTuning () {
    const out = {}
    try {
      const q = new URLSearchParams(location.search)
      const hz = parseFloat(q.get('frequency'))
      if (Number.isFinite(hz) && hz > 0) out.frequency = Math.round(hz)
      const m = normaliseServerMode(q.get('modulation'))
      if (m) out.mode = m
    } catch (e) {
      // Malformed query string — fall back to the receiver defaults.
    }
    return out
  }

  /** Keep the address bar on the current frequency, so a reload or a bookmark
   *  of this page comes back to it instead of the receiver default.  No history
   *  entry: replaceState, or every tap of the step buttons would add one and
   *  the back button would walk through them. */
  function syncUrl () {
    if (!settings) return
    try {
      const q = new URLSearchParams(location.search)
      q.set('frequency', String(frequency))
      q.set('modulation', mode)
      history.replaceState(null, '', `${location.pathname}?${q}`)
    } catch (e) {
      // History API unavailable (or a file:// origin) — tuning still works.
    }
  }

  /** Query string for a link to the other view, carrying the current tuning.
   *  hz and m are passed in rather than read from the outer scope so that the
   *  reactive statements below re-run when the tuning changes — a bare
   *  tuningQuery() in the markup would be evaluated once and freeze the link
   *  at the frequency the page opened on. */
  function tuningQuery (extra, hz, m) {
    const q = new URLSearchParams(extra)
    q.set('frequency', String(hz))
    q.set('modulation', m)
    return q.toString()
  }

  $: extendedViewHref = `/?${tuningQuery('', frequency, mode)}`
  $: desktopViewHref = `/?${tuningQuery('desktop=1', frequency, mode)}`

  // ═══════════════════════════════════════════════════════════════════════
  // Tuning
  // ═══════════════════════════════════════════════════════════════════════
  // The band plan follows the dial, not just the band buttons.
  //
  // Port of waterfall.js's checkBandAndSetMode(), which the desktop runs on
  // every retune: the mode bands-config.js declares takes effect whenever the
  // dial moves into a different band OR a different mode segment of the same
  // band, and within one segment your own choice sticks. This page has no
  // waterfall, so nothing was doing it — typing a frequency kept whatever mode
  // was selected, while the band buttons (which set the mode themselves) did
  // the right thing.
  let bandTrackBand = null // the band we were last in, or null when outside
  let bandTrackMode = null // its segment mode, in bands-config's own dialect

  /**
   * @param apply false only seeds the tracker — used at start-up so an
   *              explicit mode from the URL is not immediately overwritten.
   */
  function checkBandAndSetMode (freqHz, apply = true) {
    const newBand = bandAt(freqHz)
    const newMode = newBand ? bandPlanMode(newBand, freqHz) : null

    const changed =
      newBand !== bandTrackBand || (newBand && newMode !== bandTrackMode)
    bandTrackBand = newBand
    bandTrackMode = newMode
    if (!changed || !apply || !newBand || !newMode) return

    // Out of every defined band the mode is left alone, exactly as the
    // desktop does — it publishes 'outOfBand' there, which no one acts on.
    const m = selectableMode(newMode)
    if (!m) return
    // RADE owns the receiver while it runs, the way a decoder does on the
    // desktop: moving the dial must not drop it back to a listening mode.
    if (mode === 'RADEL' || mode === 'RADEU') return
    mode = m
  }

  function retune (keepMode = false) {
    if (!settings) return
    const [lo, hi] = coverage(settings)
    frequency = Math.min(Math.max(frequency, lo), hi)
    // Tracked even when not applied, or the next move inside the same segment
    // would be read as a change and override the mode after all.
    checkBandAndSetMode(frequency, !keepMode)
    tune(audio, frequency, mode, settings)
    syncUrl()
  }

  /**
   * @param explicitMode a mode chosen by the operator or handed over by a
   *        bookmark, another listener or a shared link. It wins over the band
   *        plan, the same way a mode button does on the desktop.
   */
  function setFrequency (hz, explicitMode = null) {
    frequency = Math.round(hz)
    if (explicitMode) mode = explicitMode
    retune(!!explicitMode)
  }

  function nudge (dir) {
    setFrequency(frequency + dir * tuneStep)
  }

  /** Snap to the nearest whole kHz, so the readout's decimals go to .00. */
  function snapToKHz () {
    setFrequency(Math.round(frequency / 1000) * 1000)
  }

  function setMode (m) {
    // RADEL/RADEU are ordinary sideband modes plus the sidecar decoder, so the
    // decoder is torn down whenever we leave them (mirrors _radeDeactivate).
    const wasRade = mode === 'RADEL' || mode === 'RADEU'
    const isRade = m === 'RADEL' || m === 'RADEU'

    mode = m
    retune()

    if (wasRade && !isRade) stopRade()
    if (isRade) startRade(m === 'RADEL' ? 'LSB' : 'USB')
  }

  /** Focus + select the frequency field as soon as it appears, so tapping the
   *  readout goes straight to typing. An action rather than the autofocus
   *  attribute, which Svelte flags for accessibility. */
  function focusOnMount (node) {
    node.focus()
    node.select()
  }

  function beginFreqEdit () {
    freqEditValue = (frequency / 1000).toFixed(3).replace(/0+$/, '').replace(/\.$/, '')
    freqEditing = true
  }

  function commitFreqEdit () {
    const khz = parseFloat(freqEditValue.replace(',', '.'))
    if (Number.isFinite(khz)) setFrequency(khz * 1000)
    freqEditing = false
  }

  $: freqDisplay = (frequency / 1000).toFixed(2)

  // ═══════════════════════════════════════════════════════════════════════
  // Bands — the publishBand '1' and '2' entries from bands-config.js, in file
  // order. '1' is the amateur allocations, '2' the broadcast ones; everything
  // else (publishBand '') is a spacer or an unpublished range.
  //
  // Still no ITU-region or coverage filtering — the list is the file's own.
  // The name guard is belt-and-braces: every publishBand 1/2 entry currently
  // has a name, so it drops nothing today, but an unnamed one would render as
  // a blank button.
  // ═══════════════════════════════════════════════════════════════════════
  /** App.svelte's verifyRegion(): ITU 123 is all-regions, otherwise it must
   *  match this site's region. */
  function verifyRegion (ITU) {
    if (ITU === 123) return true
    return ITU === siteInfo.siteRegion
  }

  /** App.svelte's printBandButton(). Note it deliberately tests only endFreq
   *  against the receiver's declared span, and reads that span from
   *  site_information.json rather than the live /audio settings — keeping the
   *  mobile list identical to the desktop's. */
  function printBandButton (startFreq, endFreq, publish) {
    if (!publish) return false
    const base = Number(siteInfo.siteSDRBaseFrequency) || 0
    const bandwidth = Number(siteInfo.siteSDRBandwidth) || 0
    return endFreq >= base && endFreq <= base + bandwidth
  }

  function bandGroup (publish) {
    return ALL_BANDS.filter(
      (b) =>
        b.name &&
        b.publishBand === publish &&
        verifyRegion(b.ITU) &&
        printBandButton(b.startFreq, b.endFreq, b.publishBand)
    )
  }

  // Grouped exactly as App.svelte lays them out: one grid of every
  // publishBand 1 entry, then a divider, then every publishBand 2 entry —
  // each group in bands-config.js file order, both gated on region + coverage.
  $: bandsAmateur   = bandGroup('1')
  $: bandsBroadcast = bandGroup('2')

  /**
   * The mode bands-config.js declares for a given frequency.
   *
   * A band's `modes` array is a BAND PLAN: each entry covers its own
   * sub-range, so the right mode depends on where inside the band you land —
   * 630m, for example, is CW from 472.000 to 474.000 and USB from 474.100 up,
   * and its own initFreq of 474.200 falls in the USB segment. Taking modes[0]
   * would call that CW. Port of App.svelte's _bandDefaultMode(): walk the
   * segments for the one containing the frequency, falling back to the first.
   */
  function bandPlanMode (band, freqHz) {
    if (!band.modes || !band.modes.length) return null
    let segMode = band.modes[0].mode
    for (const seg of band.modes) {
      if (freqHz >= seg.startFreq && freqHz <= seg.endFreq) {
        segMode = seg.mode
        break
      }
    }
    return segMode
  }

  /**
   * The bands-config.js mode for a bare frequency — the same lookup
   * goToBand() does, but starting from a frequency instead of a band button.
   * Region-gated exactly like App.svelte's _bandDefaultMode(): ITU 123 is
   * all-regions, anything else must match this site.
   *
   * Used when a link hands us a frequency without a mode we can select, so
   * the band plan decides rather than whatever this page happened to start
   * on. Returns null when no band covers the frequency, meaning "leave the
   * mode alone".
   */
  function bandDefaultModeFor (freqHz) {
    const b = bandAt(freqHz)
    return b ? selectableMode(bandPlanMode(b, freqHz)) : null
  }

  /** The region-gated band covering a frequency, or null when outside them
   *  all. ITU 123 is all-regions; anything else must match this site. */
  function bandAt (freqHz) {
    return ALL_BANDS.find(
      (b) => verifyRegion(b.ITU) && freqHz >= b.startFreq && freqHz <= b.endFreq
    ) || null
  }

  /** A bands-config mode translated to one this page can select — it writes
   *  CW as 'CW-U' and marks data segments 'DIGITAL'. Null if unusable. */
  function selectableMode (planned) {
    if (!planned) return null
    const m = planned === 'CW-U' ? 'CW' : planned
    return MODES.includes(m) ? m : null
  }

  function goToBand (band) {
    const init = parseFloat(band.initFreq)
    const target = Number.isFinite(init) && init > 0
      ? init
      : (band.startFreq + band.endFreq) / 2

    const wanted = selectableMode(bandPlanMode(band, target))
    if (band.stepi) tuneStep = nearestStep(band.stepi)
    // Passed explicitly rather than left to the band plan: identical result,
    // but it cannot be second-guessed if the button and the plan ever differ.
    setFrequency(target, wanted)
  }

  function nearestStep (s) {
    return TUNE_STEPS.reduce((a, b) => (Math.abs(b - s) < Math.abs(a - s) ? b : a))
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Audio controls
  // ═══════════════════════════════════════════════════════════════════════
  function applyVolume () {
    // Identical curve to App.svelte's handleVolumeChange.
    audio.setGain(Math.pow(10, (volume - 50) / 50 + 2.6))
  }

  /**
   * Silence the speaker without touching the volume setting.
   *
   * setMute() gates playback in the browser (audio.js playAudio) and also
   * tells the server, though the server only records the flag — the stream
   * keeps arriving and the decoders keep running, so the S-meter stays live
   * and unmuting is instant. It is not a way to save bandwidth.
   */
  function toggleMute () {
    muted = !muted
    audio.setMute(muted)
  }

  function applySquelch () {
    audio.setSquelch(squelchEnable)
    audio.setSquelchThreshold(squelch)
  }

  function toggleSquelch () {
    // Same one-click behaviour as the desktop SQ button: each click flips the
    // squelch and re-measures the floor, so you tap it on a quiet frequency.
    squelchEnable = !squelchEnable
    squelch = Math.min(0, Math.max(-120, Math.round(audio.getPowerDb()) + 2))
    applySquelch()
  }

  function applyAiStrength () {
    audio.setAiNoiseReductionMix(aiStrength / 100)
  }

  async function toggleAi () {
    if (aiLoading) return
    const want = !aiEnabled
    aiEnabled = want
    aiLoading = want
    if (want) applyAiStrength()
    const ok = await audio.enableAiNoiseReduction(want)
    aiLoading = false
    if (want && !ok) aiEnabled = false
  }

  function startDiagPoll () {
    if (!DIAG_ON) return
    const read = () => {
      try {
        diag = audio.getPlaybackDiagnostics ? audio.getPlaybackDiagnostics() : null
      } catch (e) {
        diag = null
      }
    }
    read()
    diagTimer = setInterval(read, 1000)
  }

  function stepBuffer () {
    // Desktop's button walks one preset up per tap and wraps at the top.
    bufferStep = (bufferStep + 1) % BUFFER_PRESETS.length
    applyBuffer()
  }

  function applyBuffer () {
    const [limit, threshold] = BUFFER_PRESETS[bufferStep] || BUFFER_PRESETS[1]
    audio.setAudioBufferDelay(limit, threshold)
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Recording
  // ═══════════════════════════════════════════════════════════════════════
  function toggleRecording () {
    recordError = ''
    if (!isRecording) {
      try {
        audio.startRecording()
        isRecording = true
      } catch (e) {
        recordError = 'Recording is not supported by this browser.'
      }
      return
    }

    // Download from the recorder's own onstop, not straight after stop():
    // stop() flushes one final ondataavailable asynchronously, so downloading
    // immediately can drop the last chunk.
    try {
      if (audio.mediaRecorder) {
        audio.mediaRecorder.onstop = () => {
          try { audio.downloadRecording() } catch (e) {
            recordError = 'Could not save the recording.'
          }
        }
      }
      audio.stopRecording()
    } catch (e) {
      recordError = 'Could not stop the recording.'
    }
    isRecording = false
  }

  // ═══════════════════════════════════════════════════════════════════════
  // RADE
  // ═══════════════════════════════════════════════════════════════════════
  function startRade (sideband) {
    radeEnabled = true
    radeConnected = false
    radeSynced = false
    radeSnr = null
    audio.setRADECallback((event) => {
      if (!event) return
      if (event.type === 'status') {
        radeConnected = !!event.connected
        if (!radeConnected) { radeSynced = false; radeSnr = null }
      } else if (event.type === 'error') {
        radeConnected = false
      } else {
        if ('synced' in event) radeSynced = !!event.synced
        if ('snr' in event) radeSnr = event.snr
      }
    })
    audio.setRADEDecoding(true, sideband)
  }

  function stopRade () {
    radeEnabled = false
    radeConnected = false
    radeSynced = false
    radeSnr = null
    try { audio.setRADEDecoding(false) } catch (e) {}
    try { audio.setRADECallback(null) } catch (e) {}
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Users — plain HTTP poll of the endpoint the server already exposes.
  // ═══════════════════════════════════════════════════════════════════════
  async function fetchUsers () {
    try {
      const res = await fetch('/users', { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      users = Array.isArray(data.users) ? data.users : []
      usersError = ''
    } catch (e) {
      usersError = 'Could not load the user list.'
    }
  }

  function startUsersPoll () {
    fetchUsers()
    usersTimer = setInterval(fetchUsers, 5000)
  }

  function tuneToUser (u) {
    // What the other listener is actually using wins over the band plan —
    // the point of the button is to hear what they hear.
    setFrequency(Number(u.freq_hz), normaliseServerMode(u.mode))
  }

  /** Our own row, so the list can mark it. */
  // Our own signal-protocol UUID, used to mark our row in the /users list.
  //
  // NOT a `$:` statement: `audio` is an imported binding, which Svelte does not
  // track as a reactive dependency, so the block would run once at component
  // init — before initBackend() resolves and before clientId exists — and stay
  // null forever. Assigned explicitly in onMount instead, once settings have
  // arrived. Same id the server puts in /users (websocket.cpp / events.cpp).
  let myId = null

  // ═══════════════════════════════════════════════════════════════════════
  // Chat — same wire protocol as the desktop: send JSON, receive plain text.
  // ═══════════════════════════════════════════════════════════════════════
  function connectChat () {
    try {
      chatSocket = new WebSocket(window.location.origin.replace(/^http/, 'ws') + '/chat')
    } catch (e) {
      return
    }
    chatSocket.onopen = () => { chatConnected = true }
    chatSocket.onclose = () => { chatConnected = false }
    chatSocket.onerror = () => { chatConnected = false }
    chatSocket.onmessage = (event) => {
      const data = String(event.data).trim()

      if (data.startsWith('Chat history:')) {
        const history = data.replace('Chat history:\n', '').trim()
        chatMessages = history
          ? history.split('\n').map((line, i) => ({ id: `h${i}`, text: line.trim() }))
          : []
      } else if (data.startsWith('__CHAT_DELETE__:')) {
        const gone = data.slice('__CHAT_DELETE__:'.length).trim()
        chatMessages = chatMessages.filter((m) => m.text !== gone)
        return
      } else {
        chatMessages = [...chatMessages, { id: `m${Date.now()}${Math.random()}`, text: data }]
      }
      scrollChat()
    }
  }

  async function scrollChat () {
    await tick()
    if (chatScroller) chatScroller.scrollTop = chatScroller.scrollHeight
  }

  function sendChat () {
    const text = chatInput.trim()
    if (!text || !username.trim()) return
    if (!chatSocket || chatSocket.readyState !== WebSocket.OPEN) return
    chatSocket.send(JSON.stringify({ cmd: 'chat', message: text, username }))
    chatInput = ''
  }

  function saveUsername () {
    lsSet('chatusername', username)
  }

  function shareFrequency () {
    chatInput = `${chatInput} [FREQ:${Math.round(frequency)}:${mode}]`.trim()
  }

  /** Split a message into text and [FREQ:hz:MODE] tokens so they can be tapped. */
  function chatParts (text) {
    const out = []
    const re = /\[FREQ:(\d+):([A-Z-]+)\]/g
    let last = 0, m
    while ((m = re.exec(text)) !== null) {
      if (m.index > last) out.push({ t: 'text', v: text.slice(last, m.index) })
      out.push({ t: 'freq', hz: Number(m[1]), mode: m[2], v: `${(Number(m[1]) / 1000).toFixed(2)} kHz ${m[2]}` })
      last = m.index + m[0].length
    }
    if (last < text.length) out.push({ t: 'text', v: text.slice(last) })
    return out
  }

  function tuneToShared (hz, m) {
    setFrequency(hz, normaliseServerMode(m))
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Bookmarks
  // ═══════════════════════════════════════════════════════════════════════
  function addBookmark () {
    bookmarks = BM.add(bookmarks, {
      name: newBookmarkName,
      frequency,
      demodulation: mode,
      volume,
      squelch,
      squelchEnable,
      // Stored on the desktop's 1..5 scale, which is what App.svelte reads back
      // from a shared bookmark — bufferStep is the 0-based index into the same
      // five presets.
      audioBufferDelay: bufferStep + 1
    })
    BM.save(bookmarks)
    newBookmarkName = ''
  }

  function goToBookmark (b) {
    // A bookmark records the mode it was saved in; that is the operator's own
    // earlier choice, so it outranks the band plan.
    const m = normaliseServerMode(b.demodulation)
    if (Number.isFinite(Number(b.volume))) { volume = Number(b.volume); applyVolume() }
    if (Number.isFinite(Number(b.squelch))) {
      squelch = Number(b.squelch)
      squelchEnable = !!b.squelchEnable
      applySquelch()
    }
    setFrequency(Number(b.frequency), m)
  }

  function deleteBookmark (i) {
    bookmarks = BM.remove(bookmarks, i)
    BM.save(bookmarks)
  }

  async function openExport () {
    transferMode = 'export'
    exportQr = ''
    exportQrError = ''
    exportText = BM.exportBlob(bookmarks)

    if (BM.qrTooLarge(exportText)) {
      exportQrError = `Too many bookmarks for a scannable QR code (limit ~${BM.QR_MAX_BYTES} bytes). Use the text below.`
      return
    }
    try {
      exportQr = await BM.qrDataUrl(exportText)
    } catch (e) {
      exportQrError = 'Could not draw the QR code — use the text below.'
    }
  }

  // navigator.clipboard exists only in a SECURE CONTEXT. This page is served
  // over plain http, so on a phone it is undefined and the write throws —
  // which is why this reported a failure every time. copy-to-clipboard falls
  // back to a hidden selection plus document.execCommand("copy").
  function copyExport () {
    importResult = copy(exportText)
      ? 'Copied to clipboard.'
      : 'Copy failed — select the text and copy it manually.'
  }

  function doImport () {
    const parsed = BM.parseBlob(importText)
    if (!parsed.ok) { importResult = parsed.error; return }
    const { list, added, skipped } = BM.merge(bookmarks, parsed.list)
    bookmarks = list
    if (!BM.save(bookmarks)) {
      importResult = 'Imported, but could not be saved to this browser.'
      return
    }
    importResult = `Imported ${added} bookmark${added === 1 ? '' : 's'}` +
                   (skipped ? `, skipped ${skipped} duplicate${skipped === 1 ? '' : 's'}.` : '.')
    importText = ''
  }

  // ═══════════════════════════════════════════════════════════════════════
  // S-meter — port of drawSMeter()/setSignalStrength() from
  // App__digital_smeter_.svelte, minus the dBm/dBuV/SNR/NF readout windows.
  // ═══════════════════════════════════════════════════════════════════════
  // Calibration copied from App__digital_smeter_.svelte. Two different counts,
  // and that is not a mistake — it is how the desktop meter behaves:
  //   METER_DOTS (35)   — the divisor in setSignalStrength()'s segment maths
  //   SEGMENTS_DRAWN (30) — the segments drawSMeter() actually paints
  // so the bar reaches full scale at 30/35 of the range. Matching the desktop
  // means matching both numbers.
  const METER_DOTS = 35
  const SEGMENTS_DRAWN = 30

  function drawSMeter (activeSegments) {
    const canvas = smeterCanvas
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Fit the logical 300x40 drawing into the element's real pixel size.
    const dpr = window.devicePixelRatio || 1
    const cssW = canvas.clientWidth || SM_W
    const cssH = cssW * (SM_H / SM_W)
    if (canvas.width !== Math.round(cssW * dpr) || canvas.height !== Math.round(cssH * dpr)) {
      canvas.width = Math.round(cssW * dpr)
      canvas.height = Math.round(cssH * dpr)
      canvas.style.height = `${cssH}px`
    }
    const scale = (cssW / SM_W) * dpr
    ctx.setTransform(scale, 0, 0, scale, 0, 0)
    ctx.clearRect(0, 0, SM_W, SM_H)

    const segmentWidth = 6
    const segmentGap = 3
    const segmentHeight = 8
    const lineY = 15
    const labelY = 25
    const tickHeight = 5
    const longTickHeight = 5
    const s9Position = SM_W / 2

    ctx.strokeStyle = '#a7e6fe'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(0, lineY)
    ctx.lineTo(s9Position, lineY)
    ctx.stroke()

    ctx.strokeStyle = '#ed1c24'
    ctx.beginPath()
    ctx.moveTo(s9Position, lineY)
    ctx.lineTo(268, lineY)
    ctx.stroke()

    for (let i = 0; i < SEGMENTS_DRAWN; i++) {
      const x = i * (segmentWidth + segmentGap)
      if (i < activeSegments) {
        ctx.fillStyle = i < 17 ? '#a3eced' : '#d9191c'
      } else {
        ctx.fillStyle = i < 17 ? '#003333' : '#330000'
      }
      ctx.fillRect(x, 0, segmentWidth, segmentHeight)
    }

    ctx.font = '13px monospace'
    ctx.textAlign = 'center'

    const labels = ['S1', '3', '5', '7', '9', '+20', '+40', '+60dB']
    for (let i = 0; i <= 16; i++) {
      const x = i * 16.6970588235
      ctx.fillStyle = x <= s9Position ? '#a3eced' : '#f00'
      if (i % 2 === 1) {
        ctx.fillRect(x, lineY, 1, longTickHeight + 2)
        if ((i - 1) / 2 < labels.length) ctx.fillText(labels[(i - 1) / 2], x, labelY + 8)
      } else {
        ctx.fillRect(x, lineY, 1, tickHeight)
      }
    }
  }

  // DIGITAL_BAR_TRIM is the desktop's segment-count nudge; 1 there too, so the
  // two bars read alike.  Kept as its own constant so they can be retuned apart.
  const DIGITAL_BAR_TRIM = 1

  function setSignalStrength (db) {
    db = Math.min(Math.max(db, -100), 0)
    const active = Math.max(
      0,
      Math.min(METER_DOTS, Math.round(((db + 100) * METER_DOTS) / 100) + DIGITAL_BAR_TRIM)
    )
    drawSMeter(active)
  }

  // Visual lift, in real dB, applied before the rescale below.
  //
  // The analog face in App.svelte's mobile section runs its power through
  // visualGain = 1.1 anchored at -130 dBm, so it sits roughly 3-5 dB hotter
  // than the digital bar across the useful part of the scale. This bar is a
  // port of the *digital* meter, so with no lift at all it reads about an
  // S-unit low next to the extended mobile view in analog.
  //
  // Set to 0 on purpose: the desktop digital meter is the reference face, and
  // it applies no lift at all, so this bar now reads exactly like it. +5 then
  // +3 were both tried and both ran hot against the desktop bar. Raise this
  // only to chase the analog face, and expect to drift off the desktop one.
  //
  // This is deliberately NOT smeter_offset: that one is the per-receiver
  // calibration knob from config.toml and is applied on top, in bar units.
  const SMETER_VISUAL_DB = 0

  function startSmeter () {
    if (smeterRaf) cancelAnimationFrame(smeterRaf)
    const tickFn = () => {
      // Same calibration the desktop digital meter feeds its bar:
      //   power = (getPowerDb() / 150) * 100 + smeter_offset
      // NOT raw dBm. getPowerDb() spans roughly -150..0, so the /150*100 term
      // rescales it onto the -100..0 range setSignalStrength() clamps to; the
      // smeter_offset is the per-receiver calibration knob from config.toml.
      let raw = audio.getPowerDb()
      if (!Number.isFinite(raw)) raw = -150
      const power = ((raw + SMETER_VISUAL_DB) / 150) * 100 + (audio.smeter_offset || 0)
      setSignalStrength(power)
      smeterRaf = requestAnimationFrame(tickFn)
    }
    smeterRaf = requestAnimationFrame(tickFn)
  }
</script>

<div class="mobile-root">
  <header class="site-header">
    <div class="site-title">{siteTitle}</div>
    <div class="site-links">
      <a class="site-link-btn" href={SDR_LIST_XYZ_URL} target="_blank" rel="noopener noreferrer"
         title="sdr-list.xyz">SDR-list</a>
      <a class="site-link-btn" href={SHBRG_URL} target="_blank" rel="noopener noreferrer"
         title="sdr.shbrg.nl/sdr">SHsdr</a>
      <a class="site-link-btn" href={WEBSDR_ORG_URL} target="_blank" rel="noopener noreferrer"
         title="websdr.org">WebSDR</a>
    </div>
  </header>

  {#if status === 'error'}
    <div class="notice error">
      <div class="notice-title">Not connected</div>
      <div class="notice-sub">{errorMsg}</div>
    </div>
  {:else if status === 'connecting'}
    <div class="notice">
      <div class="spinner"></div>
      <div class="notice-sub">Connecting to receiver…</div>
    </div>
  {:else}
    {#if status === 'needs-gesture'}
      <button class="tap-start" on:click={handleStart}>Tap to start audio</button>
    {/if}

    {#if audioLink !== 'connected' && audioLink !== 'kicked'}
      <div class="link-banner">
        {audioLink === 'refused'
          ? `Receiver refused the connection: ${refusedReason}. Close other tabs on this receiver and reload.`
          : 'Connection lost — reload the page to listen again.'}
      </div>
    {/if}

    <main class="panes">
      <!-- ── Always-visible tuning column ──────────────────────────────── -->
      <section class="pane pane-primary">
        <div class="freq-row">
          <button class="step-btn" on:click={() => nudge(-1)} aria-label="Down">−</button>
          {#if freqEditing}
            <input
              class="freq-input"
              type="text"
              inputmode="decimal"
              bind:value={freqEditValue}
              on:blur={commitFreqEdit}
              on:keydown={(e) => e.key === 'Enter' && commitFreqEdit()}
              use:focusOnMount />
          {:else}
            <button class="freq-display" on:click={beginFreqEdit}>
              {freqDisplay}<span class="freq-unit">kHz</span>
            </button>
          {/if}
          <button class="step-btn" on:click={() => nudge(1)} aria-label="Up">+</button>
        </div>

        <div class="grid-row steps">
          <button class="chip small snap" on:click={snapToKHz} aria-label="Snap to nearest kHz">&gt;|&lt;</button>
          {#each TUNE_STEPS as s}
            <button class="chip small" class:active={tuneStep === s} on:click={() => (tuneStep = s)}>
              {s >= 1000 ? `${s / 1000}k` : s}
            </button>
          {/each}
        </div>

        <canvas class="smeter" bind:this={smeterCanvas}></canvas>

        <div class="grid-row modes">
          {#each MODES as m}
            <button class="chip" class:active={mode === m} on:click={() => setMode(m)}>{m}</button>
          {/each}
        </div>

        {#if radeEnabled}
          <div class="rade-status">
            <span class="dot" class:ok={radeConnected && radeSynced}
                  class:warn={radeConnected && !radeSynced} class:bad={!radeConnected}></span>
            {#if !radeConnected}
              RADE sidecar offline — is rade_helper.py running?
            {:else if radeSynced}
              RADE synced{radeSnr !== null ? ` · SNR ${Number(radeSnr).toFixed(1)} dB` : ''}
            {:else}
              RADE connected, searching…
            {/if}
          </div>
        {/if}

        <div class="slider-row volume-block">
          <span class="slider-label">
            Volume<em>{muted ? 'muted' : volume}</em>
          </span>
          <div class="volume-row">
            <button
              class="mute-btn"
              class:muted
              aria-pressed={muted}
              title={muted ? 'Unmute' : 'Mute'}
              on:click={toggleMute}>{muted ? '🔇' : '🔊'}</button>
            <input type="range" min="0" max="100" bind:value={volume} on:input={applyVolume} />
          </div>
        </div>
      </section>

      <!-- ── Tabbed column ─────────────────────────────────────────────── -->
      <section class="pane pane-secondary">
        <nav class="tabs">
          {#each [['audio','Audio'],['bands','Bands'],['marks','Marks'],['div','Div'],['users','Users'],['chat','Chat']] as [id, label]}
            <button class="tab" class:active={tab === id} on:click={() => (tab = id)}>{label}</button>
          {/each}
        </nav>

        <div class="tab-body">
          {#if tab === 'bands'}
            <div class="grid-row bands">
              {#each bandsAmateur as b}
                <button class="chip" on:click={() => goToBand(b)}>{b.name}</button>
              {/each}
            </div>
            <hr class="band-divider" />
            <div class="grid-row bands">
              {#each bandsBroadcast as b}
                <button class="chip" on:click={() => goToBand(b)}>{b.name}</button>
              {/each}
            </div>

          {:else if tab === 'marks'}
            <div class="add-row">
              <input class="text-input" placeholder="Bookmark name" bind:value={newBookmarkName} />
              <button class="btn" on:click={addBookmark}>Add</button>
            </div>
            <ul class="list">
              {#each bookmarks as b, i}
                <li class="row">
                  <button class="row-main" on:click={() => goToBookmark(b)}>
                    <span class="row-title">{b.name}</span>
                    <span class="row-sub">{(Number(b.frequency) / 1000).toFixed(2)} kHz · {b.demodulation}</span>
                  </button>
                  <button class="row-del" on:click={() => deleteBookmark(i)} aria-label="Delete">×</button>
                </li>
              {/each}
            </ul>
            {#if !bookmarks.length}<div class="muted">No bookmarks yet.</div>{/if}

            <div class="transfer-actions">
              <button class="btn" on:click={openExport} disabled={!bookmarks.length}>Export</button>
              <button class="btn" on:click={() => { transferMode = 'import'; importResult = '' }}>Import</button>
            </div>

            {#if transferMode === 'export'}
              <div class="transfer">
                {#if exportQr}
                  <img class="qr" src={exportQr} alt="Bookmarks QR code" />
                {:else if exportQrError}
                  <div class="muted">{exportQrError}</div>
                {/if}
                <textarea class="blob" readonly rows="4" value={exportText}></textarea>
                <div class="transfer-actions">
                  <button class="btn" on:click={copyExport}>Copy text</button>
                  <button class="btn ghost" on:click={() => (transferMode = null)}>Close</button>
                </div>
              </div>
            {:else if transferMode === 'import'}
              <div class="transfer">
                <textarea class="blob" rows="4" placeholder="Paste exported bookmark text here"
                          bind:value={importText}></textarea>
                <div class="transfer-actions">
                  <button class="btn" on:click={doImport}>Import</button>
                  <button class="btn ghost" on:click={() => (transferMode = null)}>Close</button>
                </div>
              </div>
            {/if}
            {#if importResult}<div class="muted">{importResult}</div>{/if}

          {:else if tab === 'users'}
            {#if usersError}<div class="muted">{usersError}</div>{/if}
            <ul class="list">
              {#each users as u}
                <li class="row">
                  <div class="row-main static">
                    <span class="row-title">
                      {u.geo}{#if myId && u.id === myId}<em class="me">you</em>{/if}
                    </span>
                    <span class="row-sub">{Number(u.freq_khz).toFixed(2)} kHz · {u.mode} · {u.duration}</span>
                  </div>
                  <!-- No Tune on our own row: it would retune us to where we already are. -->
                  {#if !(myId && u.id === myId)}
                    <button class="btn small" on:click={() => tuneToUser(u)}>Tune</button>
                  {/if}
                </li>
              {/each}
            </ul>
            {#if !users.length && !usersError}<div class="muted">No other listeners right now.</div>{/if}

          {:else if tab === 'chat'}
            <div class="chat-wrap">
              <div class="chat-msgs" bind:this={chatScroller}>
                {#each chatMessages as m (m.id)}
                  <div class="chat-msg">
                    {#each chatParts(m.text) as p}
                      {#if p.t === 'freq'}
                        <button class="freq-token" on:click={() => tuneToShared(p.hz, p.mode)}>{p.v}</button>
                      {:else}{p.v}{/if}
                    {/each}
                  </div>
                {/each}
                {#if !chatMessages.length}<div class="muted">No messages yet.</div>{/if}
              </div>
              <input class="text-input" placeholder="Your name" maxlength="14"
                     bind:value={username} on:change={saveUsername} />
              <div class="add-row">
                <input class="text-input" placeholder={username ? 'Message' : 'Enter a name first'}
                       maxlength="200" disabled={!username.trim()} bind:value={chatInput}
                       on:keydown={(e) => e.key === 'Enter' && sendChat()} />
                <button class="btn" on:click={shareFrequency} disabled={!username.trim()} title="Insert current frequency">f</button>
                <button class="btn" on:click={sendChat} disabled={!username.trim() || !chatConnected}>Send</button>
              </div>
              {#if !chatConnected}<div class="muted">Chat disconnected.</div>{/if}
            </div>

          {:else if tab === 'audio'}
            <div class="slider-row">
              <span class="slider-label">
                Squelch<em>{squelchEnable ? `${squelch} dB` : 'off'}</em>
              </span>
              <div class="slider-inline">
                <button class="sq-btn" class:active={squelchEnable} on:click={toggleSquelch}
                        title="Auto squelch — tap on a clear frequency to measure the noise, tap again to switch off">
                  SQ
                </button>
                <input type="range" min="-120" max="0" bind:value={squelch} on:input={applySquelch} />
              </div>
            </div>

            <div class="slider-row">
              <span class="slider-label">
                AI noise reduction<em class:dim={!aiEnabled}>{aiEnabled && !aiActive ? 'voice modes only' : `${aiStrength}%`}</em>
              </span>
              <div class="slider-inline">
                <button class="sq-btn ai" class:active={aiEnabled} class:pulse={aiLoading} on:click={toggleAi}
                        title="AI noise reduction (RNNoise) — USB, LSB and AM only. The slider sets how much of the result is denoised; the rest is the original audio.">
                  AI
                </button>
                <input type="range" min="0" max="100" step="5" bind:value={aiStrength} on:input={applyAiStrength} />
              </div>
            </div>

            <div class="slider-row">
              <span class="slider-label">
                Buffer<em>{BUFFER_PRESETS[bufferStep][0].toFixed(1)} s</em>
              </span>
              <div class="slider-inline">
                <button class="sq-btn buf" class:active={bufferStep > 0} on:click={stepBuffer}
                        title="Step the buffer up — more delay rides out a slow link; wraps back to the shortest">
                  BUF
                </button>
                <input type="range" min="0" max={BUFFER_PRESETS.length - 1} step="1"
                       bind:value={bufferStep} on:input={applyBuffer} />
              </div>
            </div>

            {#if DIAG_ON && diag}
              <div class="muted diag">
                audio: <b>{diag.path}</b>
                · {diag.secureContext ? 'secure' : 'INSECURE'}
                · worklet {diag.workletAvailable ? 'yes' : 'NO'}
                · ctx {diag.contextSampleRate}/{diag.outputSampleRate} {diag.contextState}
                {#if diag.stats}
                  · buf {diag.stats.bufferedFrames}f drop {diag.stats.droppedFrames} under {diag.stats.underruns}
                {:else if diag.path === 'fallback'}
                  · gaps {diag.fallbackRestarts} drop {diag.fallbackDrops}
                {/if}
                · {diag.codec} {diag.channels}ch {diag.decoder}
                · socket {diag.socketOpen ? 'up' : 'DOWN'} · reconnects {diag.reconnects}
                · {diag.framesPerPacket}f/pkt {diag.packetsPerSec}/s{diag.resampling ? ' · resampling' : ''}
                {#if diag.latency}
                  <br />latency: pkt {Math.round(diag.latency.packet * 1000)}
                  + buf {Math.round(diag.latency.buffered * 1000)}
                  + out {Math.round((diag.latency.base + diag.latency.output) * 1000)}
                  = <b>{Math.round(diag.latency.total * 1000)} ms</b>
                {/if}
              </div>
            {/if}

            <div class="transfer-actions">
              <button class="btn" class:rec={isRecording} on:click={toggleRecording}>
                {isRecording ? 'Stop & save' : 'Record audio'}
              </button>
            </div>
            {#if recordError}<div class="muted">{recordError}</div>{/if}

          {:else if tab === 'div'}
            <!-- Receive diversity. The second receiver follows this page's
                 tuning by itself; there is no separate tuning control. -->
            <div class="div-head">
              <span class="dot" class:ok={divRunning && divStatus.locked && divStatus.live !== 'remote'}
                    class:warn={divWaiting}
                    class:bad={divRunning && divStatus.state === 'error'}
                    class:remote={divRunning && divStatus.locked && divStatus.live === 'remote'}></span>
              <span class="div-state">
                {#if !divRunning}off
                {:else if divStatus.state === 'error'}{divStatus.errorText || 'link failed'}
                {:else if divWaiting}Please wait…
                {:else}Ready{/if}
              </span>
            </div>

            <div class="add-row">
              <select class="text-input div-type" bind:value={divType}
                      on:change={divOnTypeChange} disabled={divRunning}>
                {#each DIV_TYPES as t}<option value={t}>{divTypeLabel(t)}</option>{/each}
              </select>
              <button class="btn" class:rec={divRunning} on:click={divToggle}>
                {divRunning ? 'Stop' : 'Start'}
              </button>
            </div>

            <div class="add-row">
              <input class="text-input" type="text" inputmode="url"
                     autocapitalize="off" autocorrect="off" spellcheck="false"
                     bind:value={divEndpoint} disabled={divRunning}
                     placeholder={divHint(divType)} />
            </div>

            {#if divSaved.length}
              <!-- The same saved receivers the desktop page keeps. Tap one to
                   put it in the box; the running one is bold and blinking. -->
              <ul class="list">
                {#each divSaved as e}
                  <li class="row">
                    <button class="row-main" disabled={divRunning}
                            on:click={() => (divEndpoint = e.addr)}>
                      <span class="row-title div-name"
                            class:unnamed={!e.name}
                            class:on-air={e.addr === divLiveAddr}>{e.name || 'unnamed'}</span>
                      <span class="row-sub">{e.addr}</span>
                    </button>
                    <!-- An anchor, not a button: long-press to open in the
                         background is exactly what a phone user expects. -->
                    <a class="row-open"
                       href={divBrowseUrl(e.addr)}
                       target="_blank" rel="noopener noreferrer"
                       title="Open this receiver's own page">🌍</a>
                  </li>
                {/each}
              </ul>
            {:else}
              <div class="muted">
                No saved receivers on this phone yet. Type an address and press
                Start to remember it, or bring the list over from the desktop
                page with Import below.
              </div>
            {/if}

            <!-- The list lives in THIS browser, so the desktop's receivers are
                 not here until they are carried over. Same transfer shape as
                 the bookmarks tab. -->
            <div class="transfer-actions">
              <button class="btn small" on:click={divShowExport}
                      disabled={!divAnySaved}>Export</button>
              <button class="btn small"
                      on:click={() => { divTransfer = 'import'; divResult = ''; divPending = null }}>Import</button>
            </div>

            {#if divTransfer === 'export'}
              <div class="transfer">
                {#if divQr}
                  <img class="qr" src={divQr} alt="Saved receivers as a QR code" />
                {/if}
                {#if divQrError}<div class="muted">{divQrError}</div>{/if}
                <textarea class="blob" rows="3" readonly value={divBlob}></textarea>
                <div class="transfer-actions">
                  <button class="btn small" on:click={divCopyExport}>Copy</button>
                  <button class="btn small ghost" on:click={() => (divTransfer = null)}>Close</button>
                </div>
              </div>
            {:else if divTransfer === 'import'}
              <div class="transfer">
                <div class="muted">
                  On the desktop page open the diversity panel, press ☰ then ▦ QR,
                  and scan it with this phone — then paste the text here.
                </div>
                <textarea class="blob" rows="4" bind:value={divPaste}
                          placeholder="Paste the text from the desktop's QR code"></textarea>
                {#if divPending}
                  <div class="muted">
                    {divPending.count}
                    {divPending.count === 1 ? 'receiver' : 'receivers'} in that text.
                  </div>
                  <div class="transfer-actions">
                    <button class="btn small" on:click={() => divApplyImport(true)}>Merge</button>
                    <button class="btn small" on:click={() => divApplyImport(false)}>Replace</button>
                    <button class="btn small ghost" on:click={() => { divPending = null }}>Cancel</button>
                  </div>
                {:else}
                  <div class="transfer-actions">
                    <button class="btn small" on:click={divDoImport} disabled={!divPaste.trim()}>Read it</button>
                    <button class="btn small ghost" on:click={() => (divTransfer = null)}>Close</button>
                  </div>
                {/if}
              </div>
            {/if}
            {#if divResult}<div class="muted">{divResult}</div>{/if}

            {#if divRunning}
              <div class="div-stats">
                <span>link</span><span>{divStatus.state}</span>
                <span>aligned</span>
                <span>{divStatus.locked ? (divStatus.delayMs / 1000).toFixed(2) + ' s' : 'searching'}</span>
                <span>remote audio</span>
                <span class:warn-text={!divStatus.remoteSamples}>
                  {divStatus.remoteSamples
                    ? (divStatus.remoteSamples / 1000).toFixed(0) + 'k'
                    : 'none'}
                </span>
                <span>SNR local</span><span>{(divStatus.snrLocalDb ?? 0).toFixed(1)} dB</span>
                <span>SNR remote</span><span>{(divStatus.snrRemoteDb ?? 0).toFixed(1)} dB</span>
                <span>switches</span><span>{divStatus.switches ?? 0}</span>
              </div>
              {#if divStatus.inRange === false && divStatus.state === 'ready'}
                <div class="muted">The remote does not cover this frequency.</div>
              {/if}
            {/if}

            <div class="slider-row">
              <span class="slider-label">
                Remote SNR trim<em>{divCalib.toFixed(1)} dB</em>
              </span>
              <input type="range" min="-15" max="15" step="0.5"
                     bind:value={divCalib} on:input={divSetCalib} />
            </div>
            <div class="muted">
              Added to the remote's SNR before the two are compared. +15 forces
              the remote live, −15 forces this receiver — the only way to hear
              each site on its own.
            </div>
          {/if}
        </div>
      </section>
    </main>

    <footer class="view-switch">
      <!-- The main app's own mobile layout (App.svelte's Device.isMobile
           branches). Just the normal page — the phone is detected there.
           The query string carries the current tuning across the page load;
           App.svelte picks it up in parseLink (lib/storage.js). -->
      <a class="view-btn" href={extendedViewHref}>Mobile extended view</a>
      <!-- ?desktop=1 is handled by an inline script in frontend/index.html:
           it widens the viewport and makes svelte-device-info report a
           non-mobile device, so the full desktop layout renders. -->
      <a class="view-btn" href={desktopViewHref}>Full desktop view</a>
    </footer>
  {/if}
</div>

<style>
  /* ── Shell ───────────────────────────────────────────────────────────────
     No orientation lock. Portrait stacks; landscape splits into two columns,
     because a phone in landscape has only ~350px of height and the tuning
     controls must never scroll away. 100dvh (not 100vh) so the layout does
     not jump when the address bar hides. */
  .mobile-root {
    display: flex;
    flex-direction: column;
    height: 100dvh;
    padding:
      env(safe-area-inset-top) env(safe-area-inset-right)
      env(safe-area-inset-bottom) env(safe-area-inset-left);
    box-sizing: border-box;
    overflow: hidden;
    /* Nothing may ever scroll the page sideways; wide content scrolls inside
       its own container instead. */
    overflow-x: hidden;
    /* Base size scales with the viewport, so every rem-based control below
       follows suit from a 320px phone up to a tablet. */
    font-size: clamp(13px, 3.9vw, 17px);
  }

  /* Everything is sized in fractions of its container, so nothing can push the
     layout wider than the screen. */
  .mobile-root *, .mobile-root *::before, .mobile-root *::after { box-sizing: border-box; }
  /* Images only. This used to include `canvas`, which compiles to a selector
     one element-token MORE specific than .smeter's own rule — so its
     max-width:100% silently beat every max-width the S-meter set, and the
     meter stayed full width no matter what value was used. The canvas does not
     need the guard anyway: .smeter already sets width:100%, so it cannot
     overflow its container. */
  .mobile-root img { max-width: 100%; }

  .site-header {
    flex: none;
    display: flex; flex-direction: column; align-items: center; gap: 2px;
    padding: 6px 12px;
    border-bottom: 1px solid #1c2836;
    background: #0e141c;
  }
  .site-title {
    font-size: clamp(0.76rem, 3.4vw, 1rem);
    font-weight: 600; color: #e6f0ff; text-align: center; line-height: 1.25;
    overflow-wrap: anywhere;
  }
  /* Both directory links share one line, wrapping only if the screen is too
     narrow to hold them side by side. */
  .site-links { display: flex; gap: 6px; justify-content: center; flex-wrap: wrap; }

  /* Styled as a button but still an <a>, so long-press / open-in-new-tab and
     the usual link affordances keep working. */
  .site-link-btn {
    display: inline-block;
    padding: 5px 12px;
    font-size: 0.72rem;
    line-height: 1;
    color: #cfe3ff;
    background: #16202c;
    border: 1px solid #2f7fb5;
    border-radius: 999px;
    text-decoration: none;
    white-space: nowrap;
  }
  .site-link-btn:active { background: #1d4a6b; }

  .panes { flex: 1 1 auto; display: flex; flex-direction: column; min-height: 0; gap: 6px; padding: 6px; }
  .pane  { min-height: 0; display: flex; flex-direction: column; gap: 6px; }
  .pane-primary   { flex: none; }
  .pane-secondary { flex: 1 1 auto; min-height: 0; }

  /* Tablets and desktop browsers: stop the columns stretching to absurd widths
     and centre the layout instead. */
  @media (min-width: 900px) {
    .panes { max-width: 1100px; width: 100%; margin: 0 auto; }
  }

  @media (orientation: landscape) {
    .panes { flex-direction: row; }
    .pane-primary   { flex: 1 1 48%; overflow-y: auto; -webkit-overflow-scrolling: touch; }
    .pane-secondary { flex: 1 1 52%; }
    .site-header { flex-direction: row; justify-content: center; gap: 10px; padding: 4px 12px; }
  }

  /* ── Frequency ───────────────────────────────────────────────────────── */
  .freq-row { display: flex; align-items: stretch; gap: 6px; }
  .freq-display, .freq-input {
    flex: 1 1 auto;
    font-family: ui-monospace, "SF Mono", Menlo, monospace;
    font-size: clamp(1.6rem, 8vw, 2.4rem);
    font-weight: 600;
    text-align: center;
    color: #7ee0ff;
    background: #0e141c;
    border: 1px solid #1c2836;
    border-radius: 8px;
    padding: 4px 6px;
    min-width: 0;
  }
  .freq-unit { font-size: 0.42em; color: #6b8299; margin-left: 6px; }
  .step-btn {
    /* Sized as a share of the row rather than a fixed pixel width, with a
       44px floor so it stays a comfortable touch target on a small screen. */
    flex: 0 0 auto;
    width: clamp(44px, 14vw, 64px);
    font-size: clamp(1.35rem, 6vw, 1.9rem);
    line-height: 1;
    color: #cfe3ff; background: #16202c;
    border: 1px solid #22303f; border-radius: 8px;
  }

  /* Centred rather than stretched edge to edge. 300px is the meter's native
     drawing width (SM_W), so capping there also stops it being upscaled and
     going soft on a wide screen or in landscape; below that it still fills the
     available width, and drawSMeter() re-reads clientWidth so the scaling
     follows automatically.

     Size is purely cosmetic: drawSMeter() works in a fixed 300x40 logical
     space and scales it to clientWidth, so changing the cap below only makes
     the picture bigger or smaller — the dB-to-segment calibration in
     setSignalStrength() is untouched. Lower it further (210px = 70%) if you
     want it smaller still; the labels are the limit, not the accuracy. */
  .smeter {
    display: block;
    width: 100%;
    max-width: 300px;   /* 100% — the native drawing width, no upscaling */
    margin: 10px auto 12px;   /* breathing room above and below */
  }

  /* ── Chips / buttons ─────────────────────────────────────────────────── */
  /* Fluid button grids.
     auto-fit + minmax(<floor>, 1fr) packs as many columns as the container can
     hold and stretches them to fill the row, wrapping the rest onto new lines.
     Nothing scrolls sideways and nothing is pushed off-screen — which is what
     used to hide RADEU at the end of the mode row. The floor is in vw-aware
     clamp() units so the columns also adapt between a 320px phone and a
     tablet. */
  .grid-row { display: grid; gap: 4px; }
  .grid-row.modes { grid-template-columns: repeat(auto-fit, minmax(clamp(52px, 17vw, 78px), 1fr)); }
  /* The step row is a fixed set (snap + TUNE_STEPS), so it gets fixed columns
     instead of auto-fit: one line always, however narrow the pane. */
  .grid-row.steps { grid-template-columns: repeat(7, 1fr); gap: 3px; }
  .grid-row.bands { grid-template-columns: repeat(auto-fit, minmax(clamp(56px, 18vw, 84px), 1fr)); }

  /* Separates the two publishBand groups, as the desktop's <hr> does. */
  .band-divider { width: 100%; height: 0; margin: 2px 0; border: 0; border-top: 1px solid #1c2836; }

  .chip {
    min-width: 0;
    padding: 7px 4px;
    font-size: clamp(0.76rem, 3.4vw, 0.94rem);
    color: #cfe3ff; background: #16202c;
    border: 1px solid #22303f; border-radius: 999px;
    white-space: nowrap;
    overflow: hidden; text-overflow: ellipsis;
    text-align: center;
  }
  /* Only the (short-labelled) step row uses .small, so the font can run larger
     than .chip's while the 7 fixed columns still fit a 320px phone. */
  .chip.small { padding: 6px 1px; font-size: clamp(0.7rem, 3.1vw, 0.95rem); }
  .chip.active { background: #1d4a6b; border-color: #2f7fb5; color: #eaf6ff; }
  /* Snap-to-kHz is an action, not a selection, so it gets its own dark green. */
  .chip.snap { background: #10361f; border-color: #1f6b3a; color: #b8ecc8; }

  /* In landscape the columns are ~half as wide, so the vw-based floors would
     over-count columns. Tighten them to the pane rather than the viewport. */
  @media (orientation: landscape) {
    .grid-row.modes { grid-template-columns: repeat(auto-fit, minmax(56px, 1fr)); }
    .grid-row.bands { grid-template-columns: repeat(auto-fit, minmax(58px, 1fr)); }
  }

  .btn {
    min-width: 0;
    padding: 8px clamp(8px, 3vw, 14px);
    font-size: clamp(0.8rem, 3.4vw, 0.97rem);
    white-space: nowrap;
    color: #cfe3ff; background: #16202c;
    border: 1px solid #22303f; border-radius: 8px;
  }
  .btn.small { padding: 6px clamp(6px, 2.5vw, 12px); font-size: clamp(0.76rem, 3.1vw, 0.9rem); }
  .btn.ghost { background: transparent; }
  .btn.active { background: #1d4a6b; border-color: #2f7fb5; }
  .btn.rec { background: #6b1d1d; border-color: #b52f2f; color: #ffecec; }
  .btn:disabled { opacity: 0.4; }

  /* ── Sliders ─────────────────────────────────────────────────────────── */
  .slider-row { display: flex; flex-direction: column; gap: 2px; }
  /* Detach the volume block from the mode chips / RADE status above it. */
  .volume-block { margin-top: 18px; }
  .slider-label { font-size: 0.72rem; color: #8ba7bf; display: flex; justify-content: space-between; }
  .slider-label em { font-style: normal; color: #cfe3ff; }
  .slider-row input[type="range"] { width: 100%; accent-color: #2f7fb5; height: 26px; }
  .slider-inline { display: flex; align-items: center; gap: 8px; }
  .sq-btn {
    flex: 0 0 auto; width: 34px; height: 26px; border-radius: 999px;
    background: #16222e; border: 1px solid #2a3f52; color: #cfe3ff;
    font-size: 0.76rem; font-weight: 700; letter-spacing: 0.04em;
  }
  .sq-btn.active { background: #6b3a12; border-color: #d1741f; color: #ffe6cc; }
  .sq-btn.buf { width: 42px; }
  .sq-btn.buf.active { background: #174a1d; border-color: #2f9c3c; color: #d8ffdc; }
  .sq-btn.ai.active { background: #123a5c; border-color: #2f7fb5; color: #dcefff; }
  .sq-btn.pulse { animation: ai-pulse 1s ease-in-out infinite; }
  @keyframes ai-pulse { 50% { opacity: 0.45; } }
  .slider-label em.dim { color: #4a5f72; }

  /* Mute sits beside the volume slider, which shrinks to make room. */
  .volume-row { display: flex; align-items: center; gap: 8px; }
  .volume-row input[type="range"] { flex: 1 1 auto; min-width: 0; }
  .mute-btn {
    flex: none;
    width: 44px; height: 34px;      /* 44px keeps it a comfortable touch target */
    font-size: 1.15rem; line-height: 1;
    color: #cfe3ff; background: #16202c;
    border: 1px solid #22303f; border-radius: 8px;
  }
  .mute-btn.muted { background: #6b1d1d; border-color: #b52f2f; }

  /* ── Tabs ────────────────────────────────────────────────────────────── */
  .tabs { flex: none; display: flex; gap: 3px; }
  .tab {
    /* min-width:0 lets five tabs shrink to share a narrow screen instead of
       overflowing it — flex items refuse to shrink below content width
       otherwise. */
    flex: 1 1 0; min-width: 0;
    padding: 8px 2px;
    font-size: clamp(0.8rem, 3.7vw, 1.02rem);
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    color: #8ba7bf; background: #101822;
    border: 1px solid #1c2836; border-radius: 7px 7px 0 0;
  }
  /* Selected tab uses the same fill as a selected mode chip (.chip.active). */
  .tab.active { color: #eaf6ff; background: #1d4a6b; border-color: #2f7fb5; }
  .tab-body {
    flex: 1 1 auto; min-height: 0;
    overflow-y: auto; -webkit-overflow-scrolling: touch;
    display: flex; flex-direction: column; gap: 8px;
    padding: 8px 4px;
    border: 1px solid #1c2836; border-top: none; border-radius: 0 0 8px 8px;
  }

  /* ── Lists ───────────────────────────────────────────────────────────── */
  .list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px; }
  .row { display: flex; align-items: center; gap: 6px; }
  .row-main {
    flex: 1 1 auto; min-width: 0;
    display: flex; flex-direction: column; align-items: flex-start; gap: 1px;
    padding: 7px 9px; text-align: left;
    color: #cfe3ff; background: #131c26;
    border: 1px solid #1c2836; border-radius: 7px;
  }
  .row-main.static { background: transparent; }
  .row-title { font-size: 0.82rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 100%; }
  .row-title .me { font-style: normal; font-size: 0.66rem; color: #7ee0ff; margin-left: 6px; }
  .row-sub { font-size: 0.72rem; color: #8ba7bf; }
  .row-del {
    flex: none; width: 34px; height: 34px; font-size: 1.35rem;
    color: #ff8a8a; background: transparent;
    border: 1px solid #3a2430; border-radius: 7px;
  }

  .add-row { display: flex; gap: 4px; }
  .text-input {
    flex: 1 1 auto; min-width: 0;
    padding: 8px 10px; font-size: 0.85rem;
    color: #e6f0ff; background: #0e141c;
    border: 1px solid #22303f; border-radius: 8px;
  }

  /* ── Chat ────────────────────────────────────────────────────────────── */
  .chat-wrap { display: flex; flex-direction: column; gap: 5px; height: 100%; min-height: 0; }
  .chat-msgs {
    flex: 1 1 auto; min-height: 120px;
    overflow-y: auto; -webkit-overflow-scrolling: touch;
    display: flex; flex-direction: column; gap: 3px;
    padding: 6px; font-size: 0.78rem; line-height: 1.35;
    background: #0e141c; border: 1px solid #1c2836; border-radius: 7px;
    overflow-wrap: anywhere;
  }
  .freq-token {
    display: inline; padding: 1px 5px; font: inherit;
    color: #7ee0ff; background: #16202c;
    border: 1px solid #2f7fb5; border-radius: 5px;
  }

  /* ── Transfer / bookmarks ────────────────────────────────────────────── */
  .transfer { display: flex; flex-direction: column; gap: 6px; }
  .transfer-actions { display: flex; gap: 6px; flex-wrap: wrap; }
  .blob {
    width: 100%; box-sizing: border-box;
    font-family: ui-monospace, Menlo, monospace; font-size: 0.68rem;
    color: #cfe3ff; background: #0e141c;
    border: 1px solid #22303f; border-radius: 7px; padding: 7px;
    resize: vertical;
  }
  .qr { width: 100%; max-width: 260px; align-self: center; image-rendering: pixelated; border-radius: 7px; }

  /* ── RADE / misc ─────────────────────────────────────────────────────── */
  /* Breathing room so the status line doesn't crowd the mode chips or the volume slider. */
  .rade-status { display: flex; align-items: center; gap: 6px; font-size: 0.72rem; color: #8ba7bf; margin: 6px 0; }
  .dot { width: 8px; height: 8px; border-radius: 50%; background: #666; flex: none; }
  .dot.ok { background: #4ade80; } .dot.warn { background: #fbbf24; } .dot.bad { background: #ef4444; }
  .muted { font-size: 0.75rem; color: #6b8299; padding: 2px 4px; }
  /* Diagnostic readout: deliberately small and plain — it is here to be read
     off a phone screen and reported, not to be part of the UI. */
  /* Connection banner — sits where "Tap to start" does, same weight, so a
     listener notices it without it taking over the page. */
  .link-banner {
    background: #4a3410; border: 1px solid #d1741f; border-radius: 9px;
    color: #ffe6cc; flex: none; font-size: 0.85rem; margin: 6px;
    padding: 10px; text-align: center;
  }
  /* The all-clear reads green rather than orange — it is reporting that the
     gap is over, not that something is still wrong. */
  .link-banner.ok { background: #10361f; border-color: #1f6b3a; color: #b8ecc8; }
  .diag { font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 0.68rem; line-height: 1.5; word-break: break-word; }
  .diag b { color: #9fd0ee; }

  /* ── View switcher ───────────────────────────────────────────────────── */
  .view-switch {
    flex: none;
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 6px;
    padding: 6px;
    border-top: 1px solid #1c2836;
  }
  .view-btn {
    padding: 10px 8px;
    font-size: clamp(0.78rem, 3.4vw, 0.94rem);
    text-align: center;
    text-decoration: none;
    color: #cfe3ff; background: #16202c;
    border: 1px solid #2f7fb5; border-radius: 8px;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .view-btn:active { background: #1d4a6b; }

  .tap-start {
    flex: none; margin: 6px; padding: 12px;
    font-size: 0.9rem; font-weight: 600;
    color: #041018; background: #58a6ff;
    border: none; border-radius: 9px;
  }

  /* ── Status screens ──────────────────────────────────────────────────── */
  .notice {
    flex: 1 1 auto; display: flex; flex-direction: column;
    align-items: center; justify-content: center; gap: 12px;
    padding: 24px; text-align: center;
  }
  .notice-title { font-size: 1.05rem; font-weight: 600; }
  .notice-sub   { font-size: 0.82rem; opacity: 0.6; }
  .error .notice-title { color: #ff6b6b; }
  .spinner {
    width: 42px; height: 42px;
    border: 4px solid rgba(120,170,255,0.18); border-top-color: #58a6ff;
    border-radius: 50%; animation: spin 0.9s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  /* ── Receive diversity ───────────────────────────────────────────────── */
  .div-head { display: flex; align-items: center; gap: 7px; padding: 2px 2px 0; }
  .div-state { font-size: 0.8rem; color: #cfe3ff; overflow-wrap: anywhere; }
  /* The remote site currently live, matching the desktop panel's cyan. */
  .dot.remote { background: #22d3ee; }
  /* The type selector shares the address box's look but must not stretch:
     the Start button and it split the row. */
  .div-type { flex: 0 1 auto; }

  /* A named receiver is green, as on the desktop; an unnamed one is dimmed so
     the address below it carries the identity instead. */
  .div-name { color: #4ade80; }
  .div-name.unnamed { color: #6b8299; font-style: italic; }
  /* The one on air. A fade rather than a hard blink — it has to be catchable
     out of the corner of the eye without demanding attention. */
  .div-name.on-air { font-weight: 700; animation: on-air-blink 1.4s ease-in-out infinite; }
  @keyframes on-air-blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
  /* Blinking text is the classic reason someone turns this setting on; the
     bold weight alone still says which receiver is running. */
  @media (prefers-reduced-motion: reduce) {
    .div-name.on-air { animation: none; }
  }

  /* The same shape and touch target as .row-del, in the link colour so it
     does not read as another destructive control. */
  .row-open {
    flex: none;
    width: 34px; height: 34px;
    display: flex; align-items: center; justify-content: center;
    font-size: 1.05rem; line-height: 1; text-decoration: none;
    background: transparent;
    border: 1px solid #234050; border-radius: 7px;
  }
  .row-open:active { background: #16202c; }

  .div-stats {
    display: grid; grid-template-columns: auto 1fr; gap: 2px 10px;
    padding: 7px 9px;
    font-family: ui-monospace, Menlo, monospace; font-size: 0.72rem;
    color: #cfe3ff; background: #0e141c;
    border: 1px solid #1c2836; border-radius: 7px;
    overflow-wrap: anywhere;
  }
  .div-stats span:nth-child(odd) { color: #8ba7bf; }
  .div-stats .warn-text { color: #fbbf24; }

  button { font-family: inherit; cursor: pointer; -webkit-tap-highlight-color: transparent; }
</style>
