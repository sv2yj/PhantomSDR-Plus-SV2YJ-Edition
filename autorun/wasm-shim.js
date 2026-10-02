/**
 * wasm-shim.js — let the browser decoder modules load their WASM under Node.
 *
 * modules/ft4.js does `fetch('/decoders/ft8_lib.wasm')` — an absolute URL that
 * only resolves in the browser against the dev/prod server. Rather than edit the
 * decoder (we want to reuse it byte-for-byte), we install a globalThis.fetch
 * wrapper that intercepts the /decoders/* path and serves the file straight from
 * frontend/public/decoders/. Every other fetch falls through to Node's native
 * fetch, so nothing else changes.
 *
 * Import this module for its side effect BEFORE importing the decoders:
 *   import './wasm-shim.js';
 *   import { decodeFT8viaLib } from '../frontend/src/modules/ft4.js';
 */
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
// autorun/ -> ../frontend/public/decoders/
const DECODERS_DIR = join(__dirname, '..', 'frontend', 'public', 'decoders');

const nativeFetch = globalThis.fetch;

globalThis.fetch = async function (resource, init) {
    const url = typeof resource === 'string' ? resource : resource?.url ?? '';

    // Intercept only the decoder asset path; serve from disk.
    const marker = '/decoders/';
    const idx = url.indexOf(marker);
    if (idx !== -1) {
        const rel = url.slice(idx + marker.length); // e.g. "ft8_lib.wasm"
        try {
            const buf = await readFile(join(DECODERS_DIR, rel));
            // Minimal Response-like object: only .ok and .arrayBuffer() are used.
            return {
                ok: true,
                status: 200,
                arrayBuffer: async () =>
                    buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
            };
        } catch (err) {
            return { ok: false, status: 404, arrayBuffer: async () => new ArrayBuffer(0) };
        }
    }

    if (typeof nativeFetch === 'function') return nativeFetch(resource, init);
    throw new Error('fetch not available for: ' + url);
};
