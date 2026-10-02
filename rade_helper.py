#!/usr/bin/env python3
"""
rade_helper.py — RADE v1 sidecar for PhantomSDR-Plus
=====================================================

PER-CONNECTION ARCHITECTURE
----------------------------
Each browser connection gets its own independent decode pipeline:

  radae_rxe.py + lpcnet_demo  (one pair per connected client)

This allows each user to tune to a different frequency independently.
PyTorch thread count is limited so each instance uses ~2 cores instead
of all available cores.

Pipeline per connection:
  Browser (f32 real PCM @ audioOutputSps)
      | resample to 8000 Hz
      | zero-pad to complex f32
      v
  radae_rxe.py  --model_name <path>   [OMP_NUM_THREADS=2]
      | vocoder features f32  (OS pipe)
      v
  lpcnet_demo  -fargan-synthesis  -  -
      | s16 PCM @ 16000 Hz -> f32
      v
  Browser (_radePlayPCM @ 16000 Hz)

Environment variables
---------------------
  RADE_HELPER_PORT      TCP port (default 8074)
  RADE_HELPER_HOST      Bind address (default 0.0.0.0)
  RADAE_DIR             Root of the radae repo (default ~/radae)
  RADE_MODEL            Path to .pth checkpoint
  LPCNET_DEMO           Path to lpcnet_demo binary
  RADE_AUXDATA          Set to '0' to add --noauxdata flag
  RADE_TORCH_THREADS    PyTorch/OpenBLAS threads per instance (default 2)

Compatible with websockets 10.x through 16.x+.
"""
from __future__ import annotations

import asyncio
import json
import os
import struct
import sys
from pathlib import Path

# websockets version-agnostic
try:
    import websockets
    try:
        from websockets.asyncio.server import serve as _ws_serve
    except ImportError:
        from websockets.legacy.server import serve as _ws_serve
    import websockets.exceptions
except ImportError:
    sys.exit("[RADE] ERROR: 'websockets' not found.  pip3 install websockets")

# Configuration
PORT          = int(os.environ.get("RADE_HELPER_PORT", 8074))
HOST          = os.environ.get("RADE_HELPER_HOST", "0.0.0.0")
RADAE_DIR     = Path(os.environ.get("RADAE_DIR", Path.home() / "radae")).expanduser()
RADAE_RX      = str(RADAE_DIR / "radae_rxe.py")
RADE_MODEL    = os.environ.get(
    "RADE_MODEL",
    str(RADAE_DIR / "model19_check3" / "checkpoints" / "checkpoint_epoch_100.pth")
)
LPCNET_DEMO   = os.environ.get("LPCNET_DEMO", str(RADAE_DIR / "build" / "src" / "lpcnet_demo"))
USE_AUXDATA   = os.environ.get("RADE_AUXDATA", "1") != "0"
# PyTorch/OpenBLAS threads per radae_rxe.py instance.
# 1 thread = ~70-80% of one core, sufficient for real-time RADE decode.
# 2 threads = ~100% of one core, use if you hear dropouts with 1 thread.
TORCH_THREADS = os.environ.get("RADE_TORCH_THREADS", "1")

SPS_RADAE = 8000
SPS_OUT   = 16000

# Core pinning: spread decode pipelines across cores so no single core
# thermally saturates. RADE pins one thread hard, so without this a couple
# of clients can push individual cores to ~90 C while total CPU looks idle.
PIN_CORES        = os.environ.get("RADE_PIN_CORES", "1") != "0"
CORES_PER_CLIENT = int(os.environ.get("RADE_CORES_PER_CLIENT", "2"))
try:
    _NCPU = len(os.sched_getaffinity(0))
except AttributeError:
    _NCPU = os.cpu_count() or 1
_pin_next = 0   # round-robin cursor


def _taskset_prefix():
    """Return ['taskset','-c','a,b'] for the next client, rotating cores."""
    global _pin_next
    if not PIN_CORES or _NCPU <= 1:
        return []
    cores = [str((_pin_next + i) % _NCPU) for i in range(CORES_PER_CLIENT)]
    _pin_next = (_pin_next + CORES_PER_CLIENT) % _NCPU
    return ["taskset", "-c", ",".join(cores)]


def _resample_f32(data, from_sps):
    if from_sps == SPS_RADAE or from_sps <= 0:
        return data
    try:
        import numpy as np
        samples = np.frombuffer(data, dtype=np.float32).copy()
        try:
            from scipy.signal import resample_poly
            from fractions import Fraction
            r = Fraction(SPS_RADAE, from_sps).limit_denominator(50)
            out = resample_poly(samples, r.numerator, r.denominator)
        except ImportError:
            n_out = max(1, int(round(len(samples) * SPS_RADAE / from_sps)))
            x_in  = np.linspace(0.0, 1.0, len(samples), endpoint=False)
            x_out = np.linspace(0.0, 1.0, n_out, endpoint=False)
            out   = np.interp(x_out, x_in, samples)
        return out.astype(np.float32).tobytes()
    except ImportError:
        return data


def _to_complex_f32(real_bytes):
    """Zero-pad real f32 → complex f32 pairs (real, 0.0 imaginary).
    Uses numpy for speed — a Python loop over individual samples is ~100x slower."""
    try:
        import numpy as np
        real = np.frombuffer(real_bytes, dtype=np.float32)
        # Interleave real samples with zeros: [r0, 0, r1, 0, ...]
        out = np.zeros(len(real) * 2, dtype=np.float32)
        out[0::2] = real
        return out.tobytes()
    except ImportError:
        # Fallback: pure Python (slow but correct)
        n   = len(real_bytes) // 4
        out = bytearray(n * 8)
        for i in range(n):
            out[i*8 : i*8+4] = real_bytes[i*4 : i*4+4]
        return bytes(out)


def _s16_to_f32(s16_bytes):
    """Convert lpcnet_demo s16 LE output → f32.
    Uses numpy for speed — struct.pack with a generator is ~100x slower."""
    try:
        import numpy as np
        samples = np.frombuffer(s16_bytes, dtype=np.int16).astype(np.float32)
        samples /= 32768.0
        return samples.tobytes()
    except ImportError:
        # Fallback: pure Python
        n = len(s16_bytes) // 2
        if n == 0:
            return b""
        return struct.pack("%df" % n,
                           *(s / 32768.0 for s in struct.unpack("<%dh" % n, s16_bytes)))


async def _send_json(ws, obj):
    try:
        await ws.send(json.dumps(obj))
    except Exception:
        pass


async def handle_client(websocket):
    remote = getattr(websocket, "remote_address", None) or ("?", "?")
    addr   = "%s:%s" % (remote[0], remote[1])
    print("[RADE] client connected: %s" % addr, file=sys.stderr)

    input_sps = SPS_RADAE

    # Wait for JSON init frame
    try:
        raw = await asyncio.wait_for(websocket.recv(), timeout=8.0)
        if isinstance(raw, str):
            cfg       = json.loads(raw)
            input_sps = int(cfg.get("sps", SPS_RADAE))
            sideband  = cfg.get("sideband", "USB")
            print("[RADE] %s  sps=%d sideband=%s" % (addr, input_sps, sideband), file=sys.stderr)
    except asyncio.TimeoutError:
        print("[RADE] %s timeout waiting for init frame" % addr, file=sys.stderr)
    except Exception as exc:
        print("[RADE] %s init error: %s" % (addr, exc), file=sys.stderr)

    # Validate paths
    for label, path in [("radae_rxe.py", RADAE_RX),
                        ("model",        RADE_MODEL),
                        ("lpcnet_demo",  LPCNET_DEMO)]:
        if not Path(path).exists():
            msg = "%s not found: %s" % (label, path)
            print("[RADE] ERROR: %s" % msg, file=sys.stderr)
            await _send_json(websocket, {"type": "error", "msg": msg})
            return

    # OS pipe: radae stdout -> lpcnet stdin
    r_fd, w_fd = os.pipe()

    pin        = _taskset_prefix()
    radae_cmd  = pin + ["python3", RADAE_RX, "--model_name", RADE_MODEL]
    if not USE_AUXDATA:
        radae_cmd.append("--noauxdata")
    lpcnet_cmd = pin + [LPCNET_DEMO, "-fargan-synthesis", "-", "-"]
    if pin:
        print("[RADE] %s pinned to cores %s" % (addr, pin[2]), file=sys.stderr)

    # Limit PyTorch threads to prevent CPU exhaustion
    radae_env = os.environ.copy()
    radae_env["OMP_NUM_THREADS"]      = TORCH_THREADS
    radae_env["MKL_NUM_THREADS"]      = TORCH_THREADS
    radae_env["OPENBLAS_NUM_THREADS"] = TORCH_THREADS
    radae_env["NUMEXPR_NUM_THREADS"]  = TORCH_THREADS

    print("[RADE] %s spawning pipeline (torch_threads=%s)" % (addr, TORCH_THREADS), file=sys.stderr)

    try:
        proc_radae = await asyncio.create_subprocess_exec(
            *radae_cmd,
            stdin  = asyncio.subprocess.PIPE,
            stdout = w_fd,
            stderr = asyncio.subprocess.PIPE,   # capture for sync/SNR parsing
            env    = radae_env,
        )
        os.close(w_fd)
        w_fd = -1   # mark closed so exception handler doesn't double-close

        proc_lpcnet = await asyncio.create_subprocess_exec(
            *lpcnet_cmd,
            stdin  = r_fd,
            stdout = asyncio.subprocess.PIPE,
            stderr = asyncio.subprocess.DEVNULL,
        )
        os.close(r_fd)
        r_fd = -1   # mark closed

    except Exception as exc:
        msg = "failed to spawn subprocess: %s" % exc
        print("[RADE] ERROR: %s" % msg, file=sys.stderr)
        # Close any FDs that are still open
        for fd in (r_fd, w_fd):
            if fd != -1:
                try:
                    os.close(fd)
                except Exception:
                    pass
        # If radae spawned but lpcnet failed, terminate radae
        try:
            proc_radae.terminate()
        except Exception:
            pass
        await _send_json(websocket, {"type": "error", "msg": msg})
        return

    await _send_json(websocket, {"type": "status", "connected": True})

    send_q = asyncio.Queue(maxsize=128)

    async def pump_radae_stderr():
        """Parse radae_rxe.py stderr for sync state and SNR, forward to browser.

        radae_rxe.py emits lines like:
          1 state: search     ... SNRdB:  0.00 ...
          5 state: sync       ... SNRdB:  4.03 uw_err: 0
          6 state: sync       ... SNRdB:  7.58 uw_err: 0

        We forward {type:'snr', synced:bool, snr:float} JSON frames so the
        browser panel can show the green 'Synced · SNR x.x dB' indicator.
        """
        import re
        snr_re  = re.compile(r'SNRdB:\s*([\-0-9.]+)')
        state_re = re.compile(r'state:\s*(\w+)')
        try:
            while True:
                line = await proc_radae.stderr.readline()
                if not line:
                    break
                text = line.decode('utf-8', errors='replace').strip()
                # Parse state
                sm = state_re.search(text)
                ss = snr_re.search(text)
                if sm:
                    state  = sm.group(1)          # 'search', 'candidate', 'sync'
                    synced = (state == 'sync')
                    snr    = float(ss.group(1)) if ss else 0.0
                    await _send_json(websocket, {
                        "type":   "snr",
                        "synced": synced,
                        "snr":    round(snr, 1),
                        "state":  state,
                    })
        except asyncio.CancelledError:
            pass
        except Exception as exc:
            print("[RADE] %s stderr pump: %s" % (addr, exc), file=sys.stderr)

    async def pump_lpcnet():
        try:
            while True:
                chunk = await proc_lpcnet.stdout.read(4096)
                if not chunk:
                    break
                await send_q.put(_s16_to_f32(chunk))
        except Exception as exc:
            print("[RADE] %s lpcnet pump: %s" % (addr, exc), file=sys.stderr)
        finally:
            await send_q.put(b"")

    async def pump_ws_send():
        try:
            while True:
                chunk = await send_q.get()
                if chunk == b"":
                    break
                await websocket.send(chunk)
        except Exception as exc:
            print("[RADE] %s ws send: %s" % (addr, exc), file=sys.stderr)

    t_lpcnet = asyncio.create_task(pump_lpcnet())
    t_send   = asyncio.create_task(pump_ws_send())
    t_stderr = asyncio.create_task(pump_radae_stderr())

    # Main receive loop: browser PCM -> resample -> zero-pad -> radae stdin
    try:
        async for msg in websocket:
            if isinstance(msg, bytes):
                if proc_radae.stdin is None or proc_radae.stdin.is_closing():
                    break
                data = _to_complex_f32(_resample_f32(msg, input_sps))
                proc_radae.stdin.write(data)
                try:
                    await proc_radae.stdin.drain()
                except Exception:
                    break
    except websockets.exceptions.ConnectionClosed:
        pass
    except Exception as exc:
        print("[RADE] %s receive error: %s" % (addr, exc), file=sys.stderr)
    finally:
        t_lpcnet.cancel()
        t_send.cancel()
        t_stderr.cancel()
        for proc in (proc_radae, proc_lpcnet):
            try:
                proc.stdin.close()
            except Exception:
                pass
            try:
                proc.terminate()
                await asyncio.wait_for(proc.wait(), timeout=3.0)
            except Exception:
                try:
                    proc.kill()
                except Exception:
                    pass
        try:
            await _send_json(websocket, {"type": "status", "connected": False})
        except Exception:
            pass
        print("[RADE] client disconnected: %s" % addr, file=sys.stderr)


async def main():
    print("[RADE] helper starting on ws://%s:%d" % (HOST, PORT), file=sys.stderr)
    print("[RADE] radae_rx.py    : %s" % RADAE_RX, file=sys.stderr)
    print("[RADE] model          : %s" % RADE_MODEL, file=sys.stderr)
    print("[RADE] lpcnet_demo    : %s" % LPCNET_DEMO, file=sys.stderr)
    print("[RADE] auxdata        : %s" % ("ON (default)" if USE_AUXDATA else "OFF (--noauxdata)"), file=sys.stderr)
    print("[RADE] torch threads  : %s per instance (RADE_TORCH_THREADS to override)" % TORCH_THREADS, file=sys.stderr)
    print("[RADE] architecture   : per-connection (each user tunes independently)", file=sys.stderr)

    for label, path in [("radae_rxe.py", RADAE_RX),
                        ("model",        RADE_MODEL),
                        ("lpcnet_demo",  LPCNET_DEMO)]:
        if not Path(path).exists():
            print("[RADE] WARNING: %s not found: %s" % (label, path), file=sys.stderr)

    async with _ws_serve(handle_client, HOST, PORT):
        print("[RADE] listening — waiting for PhantomSDR-Plus clients", file=sys.stderr)
        await asyncio.Future()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n[RADE] helper stopped", file=sys.stderr)
