#!/usr/bin/env python3
"""
analyze_users.py — PhantomSDR-Plus user statistics from daily JSONL logs.

Usage:
    python3 analyze_users.py                        # today's log
    python3 analyze_users.py 2024-11-15             # specific date
    python3 analyze_users.py 2024-11-01 2024-11-30  # date range
    python3 analyze_users.py --all                  # all available logs

Log files are read from:  <script_dir>/logs/users_YYYY-MM-DD.jsonl
"""

import json
import sys
import os
import glob
import ipaddress
from datetime import datetime, timedelta, timezone
from collections import defaultdict, Counter

_SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
LOG_DIR      = os.path.join(_SCRIPT_DIR, "logs")


# ── QTH location (substituted for local/private IPs) ─────────────────────────
def _grid_to_latlon(grid):
    """Convert a Maidenhead locator (4–10 chars) to (lat, lon) centre coordinates.
    Works for any sysop's grid square — no hardcoded city names."""
    g = grid.upper().strip()
    if len(g) < 2 or not g[0].isalpha() or not g[1].isalpha():
        return None, None
    try:
        lon = (ord(g[0]) - ord('A')) * 20.0 - 180.0
        lat = (ord(g[1]) - ord('A')) * 10.0 -  90.0
        if len(g) >= 4:
            lon += int(g[2]) * 2.0
            lat += int(g[3]) * 1.0
        if len(g) >= 6:
            lon += (ord(g[4]) - ord('A')) * (5.0  / 60)
            lat += (ord(g[5]) - ord('A')) * (2.5  / 60)
        if len(g) >= 8:
            lon += int(g[6]) * (0.5  / 60)
            lat += int(g[7]) * (0.25 / 60)
        if len(g) >= 10:
            lon += (ord(g[8]) - ord('A')) * (5.0  / 60 / 24)
            lat += (ord(g[9]) - ord('A')) * (2.5  / 60 / 24)
        # Offset to cell centre
        half = {2: (10.0, 5.0), 4: (1.0, 0.5),
                6: (5.0/120, 2.5/120), 8: (0.5/120, 0.25/120),
                10: (5.0/2880, 2.5/2880)}
        precision = min(len(g), 10) - min(len(g), 10) % 2
        hlon, hlat = half.get(precision, (1.0, 0.5))
        return round(lat + hlat, 4), round(lon + hlon, 4)
    except (ValueError, IndexError):
        return None, None


def _load_qth_label():
    """Derive a display label from site_information.json.
    Uses siteCity if set, otherwise falls back to lat/lon from siteGridSquare.
    Works for any sysop — both fields are read from their own config file."""
    path = os.path.join(_SCRIPT_DIR, "site_information.json")
    try:
        with open(path) as f:
            info = json.load(f)
        city = info.get("siteCity", "").strip()
        if city:
            return f"{city} (local)"
        grid = info.get("siteGridSquare", "").strip()
        if grid:
            lat, lon = _grid_to_latlon(grid)
            if lat is not None:
                ns = "N" if lat >= 0 else "S"
                ew = "E" if lon >= 0 else "W"
                return f"{abs(lat):.2f}°{ns} {abs(lon):.2f}°{ew} (local)"
        return "Local"
    except (FileNotFoundError, json.JSONDecodeError):
        return "Local"

QTH_LABEL = _load_qth_label()


def is_local_ip(ip):
    """Return True for loopback, private, or link-local addresses (IPv4 and IPv6)."""
    if not ip:
        return False
    raw = ip[7:] if ip.startswith("::ffff:") else ip
    try:
        addr = ipaddress.ip_address(raw)
        return addr.is_loopback or addr.is_private or addr.is_link_local
    except ValueError:
        return False


def resolve_geo(geo, ip):
    """Return QTH_LABEL when the connection is local, otherwise return geo unchanged."""
    return QTH_LABEL if is_local_ip(ip) else geo


# ── helpers ──────────────────────────────────────────────────────────────────

def load_log(path):
    events = []
    seen = set()
    dupes = 0
    with open(path) as f:
        for lineno, line in enumerate(f, 1):
            line = line.strip()
            if not line:
                continue
            if line in seen:
                dupes += 1
                continue
            seen.add(line)
            try:
                events.append(json.loads(line))
            except json.JSONDecodeError as e:
                print(f"  [WARN] {path}:{lineno} — {e}", file=sys.stderr)
    if dupes:
        print(f"  [INFO] {os.path.basename(path)}: dropped {dupes} duplicate line(s)", file=sys.stderr)
    return events


def load_range(start_date, end_date):
    events = []
    cur = start_date
    while cur <= end_date:
        path = os.path.join(LOG_DIR, f"users_{cur.strftime('%Y-%m-%d')}.jsonl")
        if os.path.exists(path):
            events.extend(load_log(path))
        cur += timedelta(days=1)
    return events


def parse_ts(ts_str):
    return datetime.fromisoformat(ts_str.replace("Z", "+00:00"))


def fmt_dur(seconds):
    h, r = divmod(int(seconds), 3600)
    m, s = divmod(r, 60)
    if h:
        return f"{h}h {m:02d}m {s:02d}s"
    if m:
        return f"{m}m {s:02d}s"
    return f"{s}s"


def band(freq_khz):
    if freq_khz <= 0:       return "?"
    if freq_khz < 300:      return "VLF/LF"
    if freq_khz < 3000:     return "MW"
    if freq_khz < 4000:     return "80m"
    if freq_khz < 5500:     return "60m"
    if freq_khz < 8000:     return "40m"
    if freq_khz < 11000:    return "30m"
    if freq_khz < 15000:    return "20m"
    if freq_khz < 19000:    return "17m"
    if freq_khz < 22000:    return "15m"
    if freq_khz < 25000:    return "12m"
    if freq_khz < 30000:    return "10m"
    return "6m+"


# ── analysis ─────────────────────────────────────────────────────────────────

def analyze(events):
    if not events:
        print("No events found.")
        return

    # ── Best-geo pre-pass ────────────────────────────────────────────────────
    # The first tune event fires before the async geo lookup finishes (~1-3 s)
    # so its geo field is just the raw IP.  Collect the first real geo seen per
    # uid AND per IP across ALL events so we can back-fill sessions below.
    # Per-IP cache (best_geo_by_ip) recovers geo for reconnecting users who get
    # a new session UUID but share the same IP as a previously resolved session.
    # This mirrors the two-cache approach in stats.html (bestGeoById/bestGeoByIP).
    def is_real_geo(geo, ip):
        return geo and geo != ip and not geo.startswith(('::ffff:', '::')) \
               and not geo[0].isdigit() and geo != '?'

    best_geo       = {}   # uid → resolved geo string
    best_geo_by_ip = {}   # ip  → resolved geo string

    for ev in events:
        uid = ev.get("id")
        ip  = ev.get("ip", "")
        geo = resolve_geo(ev.get("geo", ""), ip)   # local IPs → QTH_LABEL immediately
        if is_local_ip(ip) or is_real_geo(geo, ip):
            if uid and uid not in best_geo:
                best_geo[uid] = geo
            if ip and ip not in best_geo_by_ip:
                best_geo_by_ip[ip] = geo

    def best_known_geo(uid, ip, fallback_geo):
        """Return the best geo available: uid cache → IP cache → fallback."""
        return (best_geo.get(uid)
                or best_geo_by_ip.get(ip)
                or fallback_geo)

    # ── Pair connects with disconnects to compute session durations ──────────
    sessions = {}   # unique_id → {connect_ts, last_freq, last_mode, geo, ip}
    completed = []  # list of completed session dicts

    for ev in sorted(events, key=lambda e: e["ts"]):
        uid   = ev["id"]
        event = ev["event"]

        if event == "tune":
            ip = ev.get("ip", "")
            if uid not in sessions:
                # First tune event = effective connect
                sessions[uid] = {
                    "start":    parse_ts(ev["ts"]),
                    "freq_khz": ev.get("freq_khz", 0),
                    "mode":     ev.get("mode", "?"),
                    "geo":      best_known_geo(uid, ip, resolve_geo(ev.get("geo", "?"), ip)),
                    "ip":       ip,
                }
            else:
                sessions[uid]["freq_khz"] = ev.get("freq_khz", sessions[uid]["freq_khz"])
                sessions[uid]["mode"]     = ev.get("mode", sessions[uid]["mode"])
                # Upgrade geo if this event has a real location
                g = resolve_geo(ev.get("geo", ""), ip)
                if is_real_geo(g, ip) or is_local_ip(ip):
                    sessions[uid]["geo"] = g

        elif event == "disconnect":
            # duration_s is unreliable (always 0) because the client is erased
            # from signal_slices before broadcast_signal_changes fires.
            # Compute duration from timestamps instead.
            ip = ev.get("ip", "?")
            if uid in sessions:
                s = sessions.pop(uid)
                dur = round((parse_ts(ev["ts"]) - s["start"]).total_seconds())
            else:
                raw_dur = ev.get("duration_s", 0)
                dur = raw_dur  # last resort
                s = {
                    "start":    parse_ts(ev["ts"]) - timedelta(seconds=dur),
                    "freq_khz": ev.get("freq_khz", 0),
                    "mode":     ev.get("mode", "?"),
                    "geo":      best_known_geo(uid, ip, resolve_geo(ev.get("geo", "?"), ip)),
                    "ip":       ip,
                }
            geo = best_known_geo(uid, s["ip"], s["geo"])
            completed.append({
                "geo":      geo,
                "ip":       s["ip"],
                "freq_khz": s["freq_khz"],
                "mode":     s["mode"],
                "duration": max(0, dur),
                "hour":     s["start"].astimezone(timezone.utc).hour,
            })

    # sessions still open at log end — compute elapsed time from start to now
    now_utc = datetime.now(timezone.utc)
    for uid, s in sessions.items():
        elapsed = max(0, round((now_utc - s["start"]).total_seconds()))
        completed.append({
            "geo":      best_known_geo(uid, s["ip"], s["geo"]),
            "ip":       s["ip"],
            "freq_khz": s["freq_khz"],
            "mode":     s["mode"],
            "duration": elapsed,
            "hour":     s["start"].astimezone(timezone.utc).hour,
        })

    total_sessions = len(completed)
    total_seconds  = sum(c["duration"] for c in completed)

    # ── unique visitors ───────────────────────────────────────────────────────
    unique_ips  = {ev["ip"]  for ev in events if ev.get("ip") and not ev["ip"].startswith("::ffff:")}
    unique_geos = {ev["geo"] for ev in events if is_real_geo(ev.get("geo",""), ev.get("ip",""))}

    # ── top countries / cities ────────────────────────────────────────────────
    geo_counter = Counter(c["geo"] for c in completed if is_real_geo(c["geo"], c["ip"]))

    # ── top frequencies ───────────────────────────────────────────────────────
    freq_counter = Counter(
        round(c["freq_khz"] / 5) * 5   # bucket to nearest 5 kHz
        for c in completed if c["freq_khz"] > 0
    )

    # ── band popularity ───────────────────────────────────────────────────────
    band_counter = Counter(band(c["freq_khz"]) for c in completed)

    # ── mode popularity ───────────────────────────────────────────────────────
    mode_counter = Counter(c["mode"] for c in completed)

    # ── hourly distribution (UTC) ────────────────────────────────────────────
    hour_counter = Counter(c["hour"] for c in completed)

    # ── average session duration ──────────────────────────────────────────────
    durations    = [c["duration"] for c in completed if c["duration"] > 0]
    avg_duration = sum(durations) / len(durations) if durations else 0
    max_duration = max(durations) if durations else 0

    # ── print report ─────────────────────────────────────────────────────────
    SEP = "─" * 56

    print(f"\n{'═'*56}")
    print(f"  PhantomSDR-Plus  ·  User Statistics Report")
    print(f"{'═'*56}")

    print(f"\n  Log directory       : {LOG_DIR}")
    print(f"  Total events logged : {len(events)}")
    print(f"  Completed sessions  : {total_sessions}")
    print(f"  Unique IPs          : {len(unique_ips)}")
    print(f"  Unique locations    : {len(unique_geos)}")
    print(f"  Total airtime       : {fmt_dur(total_seconds)}")
    print(f"  Avg session         : {fmt_dur(avg_duration)}")
    print(f"  Longest session     : {fmt_dur(max_duration)}")

    print(f"\n{SEP}")
    print("  TOP LOCATIONS")
    print(SEP)
    for loc, cnt in geo_counter.most_common(10):
        bar = "█" * min(cnt, 30)
        print(f"  {loc:<28}  {cnt:>4}  {bar}")

    print(f"\n{SEP}")
    print("  BAND POPULARITY")
    print(SEP)
    for b, cnt in band_counter.most_common():
        bar = "█" * min(cnt, 30)
        print(f"  {b:<10}  {cnt:>4}  {bar}")

    print(f"\n{SEP}")
    print("  MODE POPULARITY")
    print(SEP)
    for mode, cnt in mode_counter.most_common():
        bar = "█" * min(cnt, 30)
        print(f"  {mode.upper():<8}  {cnt:>4}  {bar}")

    print(f"\n{SEP}")
    print("  TOP FREQUENCIES  (bucketed ±5 kHz)")
    print(SEP)
    for freq_k, cnt in freq_counter.most_common(10):
        label = f"{freq_k/1000:.3f} MHz" if freq_k >= 1000 else f"{freq_k} kHz"
        bar   = "█" * min(cnt, 30)
        print(f"  {label:<14}  {cnt:>4}  {bar}")

    print(f"\n{SEP}")
    print("  HOURLY DISTRIBUTION  (UTC)")
    print(SEP)
    for hour in range(24):
        cnt = hour_counter.get(hour, 0)
        bar = "█" * min(cnt, 30)
        print(f"  {hour:02d}:00  {cnt:>4}  {bar}")

    print(f"\n{'═'*56}\n")


# ── entry point ───────────────────────────────────────────────────────────────

def main():
    args = sys.argv[1:]
    today = datetime.now(timezone.utc).date()

    if not args:
        start = end = today
    elif args[0] == "--all":
        files = sorted(glob.glob(os.path.join(LOG_DIR, "users_*.jsonl")))
        if not files:
            print("No log files found in", LOG_DIR)
            return
        start = datetime.strptime(os.path.basename(files[0]),  "users_%Y-%m-%d.jsonl").date()
        end   = datetime.strptime(os.path.basename(files[-1]), "users_%Y-%m-%d.jsonl").date()
    elif len(args) == 1:
        start = end = datetime.strptime(args[0], "%Y-%m-%d").date()
    elif len(args) == 2:
        start = datetime.strptime(args[0], "%Y-%m-%d").date()
        end   = datetime.strptime(args[1], "%Y-%m-%d").date()
    else:
        print(__doc__)
        sys.exit(1)

    print(f"  Loading logs from {start} to {end} …")
    events = load_range(start, end)
    analyze(events)


if __name__ == "__main__":
    main()
