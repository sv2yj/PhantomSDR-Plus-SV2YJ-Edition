// Bookmark storage + transfer for the mobile page.
//
// Uses the SAME localStorage key as the desktop app ("bookmarks"), so a blob
// exported here and imported on a desktop browser — or vice versa — lands in
// the right place. localStorage is per-origin AND per-device, which is why the
// transfer functions below exist at all: a phone and a PC never share it.
//
// Two compatibility rules make round-tripping safe:
//
//  1. IMPORT PRESERVES UNKNOWN FIELDS. A desktop bookmark carries waterfall
//     state (colormap, brightness, min/max, view range) that the mobile page
//     has no concept of. We never strip it, so exporting again from the phone
//     hands the desktop back its settings intact.
//
//  2. MOBILE-CREATED BOOKMARKS CARRY DESKTOP DEFAULTS. App.svelte's
//     goToBookmark() reads fields raw — `volume = bookmark.volume` with no
//     fallback — so a bookmark missing `volume` would set the desktop volume
//     slider to undefined. We fill every field goToBookmark touches, using
//     App.svelte's own initial values.

const KEY = 'bookmarks'

/** Field defaults mirroring App.svelte's initial values, for fields the mobile
 *  UI does not model but goToBookmark() reads unguarded. */
const DESKTOP_DEFAULTS = {
  label: '',
  link: '',
  audioBufferDelayEnabled: false,
  NREnabled: false,
  NBEnabled: false,
  NSEnabled: false,
  ANEnabled: false,
  CTCSSSupressEnabled: false,
  currentTuneStep: 1000,
  min_waterfall: -30,
  max_waterfall: 110,
  brightness: 130,
  currentColormap: 'PhantomSDR',
  waterfallDisplay: true,
  spectrumDisplay: true,
  currentBandwidth: 0,
  staticBandwidthEnabled: false
}

export function load () {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch (e) {
    console.warn('[Bookmarks] unreadable store, starting empty:', e)
    return []
  }
}

export function save (list) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list))
    return true
  } catch (e) {
    // QuotaExceededError, or Safari private mode where setItem always throws
    console.warn('[Bookmarks] could not save:', e)
    return false
  }
}

export function add (list, { name, frequency, demodulation, volume, squelch, squelchEnable, audioBufferDelay }) {
  const entry = {
    ...DESKTOP_DEFAULTS,
    name: (name || '').trim() || `${(frequency / 1000).toFixed(2)} kHz`,
    frequency,
    demodulation,
    volume,
    squelch,
    squelchEnable,
    audioBufferDelay
  }
  return [...list, entry]
}

export function remove (list, index) {
  return list.filter((_, i) => i !== index)
}

// ── Transfer ───────────────────────────────────────────────────────────────

/** Serialise for copy-paste. Compact (no pretty-printing) to keep QR viable. */
export function exportBlob (list) {
  return JSON.stringify({ phantomsdr_bookmarks: 1, list })
}

/**
 * Parse a pasted blob. Accepts either the wrapped object produced by
 * exportBlob() or a bare array, so a blob hand-copied out of localStorage on a
 * desktop browser also works.
 *
 * Returns { ok, list, error }. Entries are validated only on the fields the
 * mobile UI needs; everything else is passed through untouched (rule 1 above).
 */
export function parseBlob (text) {
  let parsed
  try {
    parsed = JSON.parse(String(text).trim())
  } catch (e) {
    return { ok: false, error: 'That is not valid JSON.' }
  }

  const list = Array.isArray(parsed)
    ? parsed
    : (parsed && Array.isArray(parsed.list) ? parsed.list : null)

  if (!list) return { ok: false, error: 'No bookmark list found in that text.' }

  const clean = list.filter(
    (b) => b && typeof b === 'object' && Number.isFinite(Number(b.frequency))
  )
  if (!clean.length) return { ok: false, error: 'No usable bookmarks in that text.' }

  return { ok: true, list: clean }
}

/**
 * Merge imported bookmarks into the current list, skipping exact duplicates
 * (same frequency + mode + name). Returns { list, added, skipped }.
 */
export function merge (current, incoming) {
  const key = (b) => `${Math.round(Number(b.frequency))}|${b.demodulation || ''}|${b.name || ''}`
  const seen = new Set(current.map(key))
  const added = []
  for (const b of incoming) {
    const k = key(b)
    if (seen.has(k)) continue
    seen.add(k)
    added.push(b)
  }
  return { list: [...current, ...added], added: added.length, skipped: incoming.length - added.length }
}

// ── QR ─────────────────────────────────────────────────────────────────────

// A QR code tops out around 2.9 kB of binary data at the lowest error
// correction, and realistically far less before the modules get too dense to
// scan from a phone screen. Beyond this we do not even try — the text blob is
// the reliable path and the UI falls back to it automatically.
export const QR_MAX_BYTES = 1200

export function qrTooLarge (blob) {
  return new TextEncoder().encode(blob).length > QR_MAX_BYTES
}

/**
 * Render the blob as a QR data URL. The library is imported dynamically so its
 * ~50 kB never lands in the initial mobile bundle — this is only reached when
 * the user actually opens the export sheet.
 */
export async function qrDataUrl (blob) {
  const QRCode = (await import('qrcode')).default
  return QRCode.toDataURL(blob, {
    errorCorrectionLevel: 'L',   // lowest ECC = most payload per module
    margin: 2,
    width: 512
  })
}
