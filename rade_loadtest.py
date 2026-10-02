#!/usr/bin/env python3
"""
rade_loadtest.py — find the RADE concurrency knee on your box empirically.

Ramps synthetic RADE listeners against spectrumserver in steps, and after each
step lets the box settle, then samples package temp / CPU / RAM / swap and the
RSS of the radae_rxe + lpcnet_demo pipelines. Stops at the first knee it sees
(temp, swap, or low free RAM) and reports the last stable listener count.

Run ON the SDR host:
    pip install websockets psutil
    python3 rade_loadtest.py

Confirm the three lines in the HANDSHAKE block match your audio.js RADE init,
then adjust CONFIG for your endpoint. Ctrl-C tears down all connections cleanly.
"""

import asyncio
import csv
import json
import math
import os
import random
import re
import signal
import struct
import time

import psutil
import websockets

# ─── CONFIG ────────────────────────────────────────────────────────────────
WS_URL          = "ws://127.0.0.1:8074"        # rade_helper.py socket (spawns the pipeline)
RADE_SPS        = 12000                          # reported audio rate (trueAudioSps); 8000/12000 typical
RADE_SIDEBAND   = "USB"
STEP            = 2        # listeners added per ramp step
SETTLE_S        = 25       # wait after each step before sampling (let temp build)
SAMPLE_S        = 5        # averaging window for CPU% at each sample
MAX_LISTENERS   = 60       # hard stop even if no knee is hit

# Knee thresholds — first one breached ends the test
TEMP_KNEE_C     = 85.0     # package temp ceiling (you hit 92 °C once — stay clear)
MIN_AVAIL_MB    = 800      # stop if available RAM drops below this
SWAP_GROWTH_MB  = 50       # stop if swap-in grows past baseline by this much
FAIL_LIMIT      = 3        # stop if this many listeners fail to connect in a step

DECODER_RE      = re.compile(r"radae_rxe|lpcnet_demo")
CSV_PATH        = "rade_loadtest.csv"

# ─── HANDSHAKE (confirm against audio.js RADE init) ─────────────────────────
# spectrumserver audio socket: first msg selects tuning + demod, then we just
# drain frames to keep the server (and the per-connection sidecar) working.
def handshake_messages():
    return [
        json.dumps({"type": "init", "sps": RADE_SPS, "sideband": RADE_SIDEBAND}),
    ]
# ────────────────────────────────────────────────────────────────────────────


class Listener:
    def __init__(self, idx):
        self.idx = idx
        self.ws = None
        self.task = None
        self.alive = False

    async def run(self):
        try:
            self.ws = await websockets.connect(WS_URL, max_size=None, ping_interval=20)
            for m in handshake_messages():
                await self.ws.send(m)
            self.alive = True
            asyncio.ensure_future(self._drain())
            # stream f32 PCM at RADE_SPS in real-time chunks so the decoder runs
            chunk = RADE_SPS // 10                      # 100 ms per chunk
            period = chunk / RADE_SPS
            while True:
                pcm = struct.pack(f"<{chunk}f",
                                  *(random.uniform(-0.2, 0.2) for _ in range(chunk)))
                await self.ws.send(pcm)
                await asyncio.sleep(period)
        except Exception as e:
            self.alive = False
            if self.idx < 2:
                print(f"  listener {self.idx} failed: {type(e).__name__}: {e}")

    async def _drain(self):
        try:
            async for _ in self.ws:
                pass
        except Exception:
            pass

    async def close(self):
        try:
            if self.ws:
                await self.ws.close()
        except Exception:
            pass


def sensors_pkg_temp():
    vals = []
    for _ in range(5):
        vals.append(_pkg_temp_once())
        time.sleep(0.3)
    vals = [v for v in vals if v > 0]
    if not vals:
        return 0.0
    vals.sort()
    return vals[len(vals) // 2]          # median rejects transient spikes


def _pkg_temp_once():
    try:
        temps = psutil.sensors_temperatures()
        ct = temps.get("coretemp", [])
        pkg = [t for t in ct if "Package" in (t.label or "")]
        if pkg:
            return pkg[0].current
        if ct:
            return max(t.current for t in ct)   # cores, if package label missing
    except Exception:
        pass
    return 0.0


def decoder_rss_mb():
    total, n = 0, 0
    for p in psutil.process_iter(["name", "cmdline", "memory_info"]):
        try:
            hay = " ".join(p.info["cmdline"] or []) or (p.info["name"] or "")
            if DECODER_RE.search(hay):
                total += p.info["memory_info"].rss
                n += 1
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            pass
    return total / 1e6, n


def sample():
    cpu = psutil.cpu_percent(interval=SAMPLE_S)          # blocks SAMPLE_S seconds
    vm  = psutil.virtual_memory()
    sw  = psutil.swap_memory()
    rss_mb, n = decoder_rss_mb()
    return {
        "pkg_c":     round(sensors_pkg_temp(), 1),
        "cpu_pct":   round(cpu, 1),
        "avail_mb":  round(vm.available / 1e6),
        "swap_mb":   round(sw.used / 1e6),
        "dec_rss_mb": round(rss_mb),
        "dec_procs": n,
    }


async def main():
    listeners, tasks = [], []
    stop = {"flag": False}
    loop = asyncio.get_event_loop()
    for s in (signal.SIGINT, signal.SIGTERM):
        loop.add_signal_handler(s, lambda: stop.__setitem__("flag", True))

    base = psutil.swap_memory().used / 1e6
    print(f"baseline swap {base:.0f} MB — ramping in steps of {STEP}\n")

    rows, last_stable, knee = [], 0, None
    with open(CSV_PATH, "w", newline="") as f:
        w = None
        while not stop["flag"] and len(listeners) < MAX_LISTENERS:
            fails = 0
            for _ in range(STEP):
                l = Listener(len(listeners))
                l.task = asyncio.ensure_future(l.run())
                listeners.append(l); tasks.append(l.task)
            await asyncio.sleep(SETTLE_S)
            fails = sum(1 for l in listeners if not l.alive)

            m = sample()
            n = len(listeners)
            row = {"listeners": n, "connect_fails": fails, **m}
            rows.append(row)
            if w is None:
                w = csv.DictWriter(f, fieldnames=list(row.keys())); w.writeheader()
            w.writerow(row); f.flush()

            print(f"n={n:>3}  pkg={m['pkg_c']:>5}°C  cpu={m['cpu_pct']:>5}%  "
                  f"avail={m['avail_mb']:>6}MB  swap={m['swap_mb']:>5}MB  "
                  f"dec={m['dec_procs']:>3}proc/{m['dec_rss_mb']:>6}MB  fails={fails}")

            if m["pkg_c"] >= TEMP_KNEE_C:            knee = f"temp {m['pkg_c']}°C ≥ {TEMP_KNEE_C}"
            elif m["avail_mb"] < MIN_AVAIL_MB:       knee = f"avail RAM {m['avail_mb']}MB < {MIN_AVAIL_MB}"
            elif m["swap_mb"] - base > SWAP_GROWTH_MB: knee = f"swap grew {m['swap_mb']-base:.0f}MB"
            elif fails >= FAIL_LIMIT:                knee = f"{fails} connect failures"
            if knee:
                print(f"\nKNEE at n={n}: {knee}")
                break
            last_stable = n

    print(f"\nLast stable concurrency: {last_stable} RADE listeners")
    print(f"CSV: {os.path.abspath(CSV_PATH)}")

    for l in listeners:
        await l.close()
    for t in tasks:
        t.cancel()


if __name__ == "__main__":
    asyncio.run(main())
