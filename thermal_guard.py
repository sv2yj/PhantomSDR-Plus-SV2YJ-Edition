#!/usr/bin/env python3
# ─────────────────────────────────────────────────────────────────────────────
#  PhantomSDR-Plus  –  thermal_guard.py
#  Universal CPU over-temperature guard.
#
#  Protects the machine when the CPU gets too hot, on ANY sysop's box, without
#  knowing or caring how the SDR server is started, stopped or supervised.
#
#  Two ideas make it universal:
#
#   1. It never tries to identify the supervisor (systemd / watchdog / tmux /
#      cron / bare shell).  Instead it holds a LOCKOUT: while the machine is
#      over-temp it re-issues the stop on every tick, so whatever revives the
#      process gets undone within one tick until the CPU has cooled.
#
#   2. It never hard-codes a temperature.  Thresholds are derived from the trip
#      points the machine itself publishes (hwmon tempN_crit), so the same code
#      lands on ~95C on an Intel with Tjmax 100, ~90C on a Ryzen (Tctl runs at
#      95 by design under boost) and ~80C on a Raspberry Pi.  A sysop may
#      override any of them with absolute values, but never has to.
#
#  Runs two ways, same code, same admin_config.json:
#    - imported by admin_server.py, ticked from the existing graph sampler
#    - standalone:  python3 thermal_guard.py     (for sysops with no panel)
#
#  Stdlib only.  psutil is used if present but is never required.
# ─────────────────────────────────────────────────────────────────────────────

import glob
import json
import os
import subprocess
import sys
import threading
import time
from collections import deque
from datetime import datetime
from pathlib import Path

BASE_DIR = Path(__file__).parent.resolve()

# ── Sensor allow-list ────────────────────────────────────────────────────────
# ONLY real CPU-die sensors.  Deliberately excludes acpitz and unlabelled
# thermal zones: on a typical desktop acpitz reads ~28C while the package is at
# 59C, so a guard trusting it would simply never fire.  Better to report
# "disabled, no trusted sensor" than to pretend to protect.
HWMON_NAMES = ("coretemp", "k10temp", "zenpower", "zenpower3",
               "cpu_thermal", "cpu-thermal", "soc_thermal", "soc-thermal")
ZONE_TYPES  = ("x86_pkg_temp", "cpu_thermal", "cpu-thermal",
               "soc_thermal", "soc-thermal", "cpu-thermal-zone")
PSUTIL_KEYS = ("coretemp", "k10temp", "zenpower", "cpu_thermal", "soc_thermal")

# A reading outside this range is a sensor glitch, not a CPU temperature.
TEMP_SANE_MIN = 20.0
TEMP_SANE_MAX = 125.0

# Consecutive valid samples required before the guard will act at all.
ARM_SAMPLES = 3

# Threshold offsets below the machine's own critical trip point.
OFF_WARN, OFF_THROTTLE, OFF_STOP, OFF_RESUME = 12.0, 8.0, 5.0, 25.0

DEFAULTS = {
    "thermal_enabled":         True,
    "thermal_mode":            "log",   # log | throttle | stop | stop+restart
    "thermal_warn":            None,    # None => derive from crit
    "thermal_throttle":        None,
    "thermal_stop":            None,
    "thermal_resume":          None,
    "thermal_sustain_s":       60,      # hold above `stop` this long before stopping
    "thermal_warn_sustain_s":  30,      # hold above warn/throttle this long
    "thermal_resume_s":        300,     # hold below `resume` this long before release
    "thermal_max_stops_hour":  2,       # after this many trips, stay down
    "thermal_test_temp":       None,    # inject a fake reading to test the path
}

MODE_RANK = {"log": 0, "throttle": 1, "stop": 2, "stop+restart": 3}


# ─── Sensor discovery ────────────────────────────────────────────────────────
def _read_int(path):
    try:
        with open(path) as f:
            return int(f.read().strip())
    except Exception:
        return None


def _hwmon_reading():
    """Hottest CPU-die reading from /sys/class/hwmon, with its crit trip point.

    Returns (temp_c, crit_c_or_None, source) or None.
    """
    best = None
    for chip in sorted(glob.glob("/sys/class/hwmon/hwmon*")):
        try:
            with open(os.path.join(chip, "name")) as f:
                name = f.read().strip()
        except Exception:
            continue
        if name not in HWMON_NAMES:
            continue
        crits = []
        hottest = None
        for inp in sorted(glob.glob(os.path.join(chip, "temp*_input"))):
            raw = _read_int(inp)
            if raw is None:
                continue
            t = raw / 1000.0
            if not (TEMP_SANE_MIN <= t <= TEMP_SANE_MAX):
                continue
            stem = inp[:-len("_input")]
            c = _read_int(stem + "_crit") or _read_int(stem + "_max")
            if c is not None:
                c = c / 1000.0
                if TEMP_SANE_MIN < c <= TEMP_SANE_MAX:
                    crits.append(c)
                else:
                    c = None
            if hottest is None or t > hottest[0]:
                hottest = (t, c)
        if hottest is None:
            continue
        # Prefer the hottest core's own crit; else the chip's most conservative.
        crit = hottest[1] if hottest[1] is not None else (min(crits) if crits else None)
        cand = (hottest[0], crit, "hwmon:" + name)
        if best is None or cand[0] > best[0]:
            best = cand
    return best


def _zone_reading():
    """Fallback: /sys/class/thermal, allow-listed zone types only."""
    best = None
    for zone in sorted(glob.glob("/sys/class/thermal/thermal_zone*")):
        try:
            with open(os.path.join(zone, "type")) as f:
                ztype = f.read().strip()
        except Exception:
            continue
        if ztype not in ZONE_TYPES:
            continue
        raw = _read_int(os.path.join(zone, "temp"))
        if raw is None:
            continue
        t = raw / 1000.0
        if not (TEMP_SANE_MIN <= t <= TEMP_SANE_MAX):
            continue
        # Trip points: take the hottest "critical" trip if the zone publishes one.
        crit = None
        for tp in sorted(glob.glob(os.path.join(zone, "trip_point_*_type"))):
            try:
                with open(tp) as f:
                    if f.read().strip() != "critical":
                        continue
            except Exception:
                continue
            raw_c = _read_int(tp.replace("_type", "_temp"))
            if raw_c is not None:
                c = raw_c / 1000.0
                if TEMP_SANE_MIN < c <= TEMP_SANE_MAX and (crit is None or c < crit):
                    crit = c
        cand = (t, crit, "thermal:" + ztype)
        if best is None or cand[0] > best[0]:
            best = cand
    return best


def _psutil_reading():
    try:
        import psutil
    except Exception:
        return None
    if not hasattr(psutil, "sensors_temperatures"):
        return None
    try:
        temps = psutil.sensors_temperatures()
    except Exception:
        return None
    for key in PSUTIL_KEYS:
        entries = temps.get(key) or []
        hottest, crit = None, None
        for e in entries:
            if e.current is None or not (TEMP_SANE_MIN <= e.current <= TEMP_SANE_MAX):
                continue
            if hottest is None or e.current > hottest:
                hottest = e.current
                crit = e.critical or e.high
        if hottest is not None:
            if crit is not None and not (TEMP_SANE_MIN < crit <= TEMP_SANE_MAX):
                crit = None
            return (round(hottest, 1), crit, "psutil:" + key)
    return None


def read_cpu_temp():
    """(temp_c, crit_c_or_None, source) or None when no trusted sensor exists."""
    for fn in (_hwmon_reading, _zone_reading, _psutil_reading):
        try:
            r = fn()
        except Exception:
            r = None
        if r is not None:
            return (round(r[0], 1), (round(r[1], 1) if r[1] is not None else None), r[2])
    return None


# ─── CPU frequency throttling (optional stage) ───────────────────────────────
class _Throttle:
    """Lowers cpufreq max ~20%.  Auto-disables where unsupported.

    Needs a cpufreq driver AND write access to scaling_max_freq, which usually
    means root.  Absent on most VPS and on many desktop setups where the panel
    runs unprivileged, so this whole stage is a bonus, never a requirement.
    """

    FACTOR = 0.8

    def __init__(self):
        self.paths = sorted(glob.glob(
            "/sys/devices/system/cpu/cpu[0-9]*/cpufreq/scaling_max_freq"))
        self.supported = bool(self.paths) and all(os.access(p, os.W_OK) for p in self.paths)
        self.active = False
        self._saved = {}

    def apply(self):
        if not self.supported or self.active:
            return False
        ok = False
        for p in self.paths:
            cur = _read_int(p)
            if cur is None:
                continue
            floor = _read_int(p.replace("scaling_max_freq", "cpuinfo_min_freq")) or 0
            target = max(int(cur * self.FACTOR), floor)
            if target >= cur:
                continue
            try:
                with open(p, "w") as f:
                    f.write(str(target))
                self._saved.setdefault(p, cur)
                ok = True
            except Exception:
                pass
        self.active = ok
        return ok

    def restore(self):
        if not self._saved:
            self.active = False
            return False
        for p, val in list(self._saved.items()):
            try:
                with open(p, "w") as f:
                    f.write(str(val))
            except Exception:
                pass
        self._saved.clear()
        self.active = False
        return True


# ─── The guard ───────────────────────────────────────────────────────────────
class ThermalGuard:
    def __init__(self, config_getter, stop_cb, start_cb, running_cb, base_dir=BASE_DIR):
        self.cfg_get   = config_getter
        self.stop_cb   = stop_cb      # () -> (ok, msg)
        self.start_cb  = start_cb     # () -> (ok, msg)   may be None
        self.running   = running_cb   # () -> bool
        self.base_dir  = Path(base_dir)
        self.lock      = threading.Lock()

        self.throttle  = _Throttle()
        self.valid     = 0            # consecutive sane samples
        self.since     = {}           # stage -> first tick above its threshold
        self.below     = None         # first tick below `resume` while locked
        self.stage     = "normal"     # normal | warn | throttle | stopped
        self.locked    = False
        self.locked_at = None
        self.stops     = deque()      # recent stop timestamps (rate limit)
        self.relocks   = 0            # times the lockout had to re-stop a revival
        self.relock_log = None        # last time that was logged (rate-limited)
        self.giveup    = False        # rate limit exhausted: stay down, stop acting
        self.last      = None         # last event line, for the panel
        self.temp      = None
        self.crit      = None
        self.source    = None
        self.reason    = "starting up"
        self.thr       = {}

    # ── logging ──────────────────────────────────────────────────────────────
    def log(self, msg):
        line = "[THERMAL] %s (%s)" % (msg, datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
        self.last = line
        try:
            with open(self.base_dir / "crash.log", "a", encoding="utf-8") as f:
                f.write(line + "\n")
        except Exception:
            pass
        try:
            sys.stderr.write(line + "\n")
            sys.stderr.flush()
        except Exception:
            pass

    # ── config ───────────────────────────────────────────────────────────────
    def _cfg(self):
        c = dict(DEFAULTS)
        try:
            c.update({k: v for k, v in (self.cfg_get() or {}).items() if k in DEFAULTS})
        except Exception:
            pass
        return c

    def _thresholds(self, cfg, crit):
        """Derive from the machine's own crit, then apply explicit overrides."""
        def pick(key, offset):
            v = cfg.get(key)
            try:
                if v is not None and float(v) > 0:
                    return float(v)
            except (TypeError, ValueError):
                pass
            return (crit - offset) if crit else None

        w = pick("thermal_warn", OFF_WARN)
        t = pick("thermal_throttle", OFF_THROTTLE)
        s = pick("thermal_stop", OFF_STOP)
        r = pick("thermal_resume", OFF_RESUME)
        if s is None:
            return None
        # Keep the ladder ordered and inside the physically sensible range.
        s = max(50.0, min(s, (crit - 2.0) if crit else s))
        t = min(t if t else s - 3.0, s - 1.0)
        w = min(w if w else t - 4.0, t - 1.0)
        r = min(r if r else w - 13.0, w - 5.0)
        return {"warn": round(w, 1), "throttle": round(t, 1),
                "stop": round(s, 1), "resume": round(r, 1)}

    # ── the tick ─────────────────────────────────────────────────────────────
    def tick(self, now=None):
        """Called once per sample interval.  Never raises."""
        try:
            with self.lock:
                self._tick(now if now is not None else time.time())
        except Exception as e:
            try:
                self.reason = "internal error: %s" % e
            except Exception:
                pass

    def _tick(self, now):
        cfg  = self._cfg()
        mode = str(cfg.get("thermal_mode", "log")).strip().lower()
        rank = MODE_RANK.get(mode, 0)

        if not cfg.get("thermal_enabled", True):
            self.reason = "disabled in settings"
            self._reset_soft()
            return

        # Sensor
        test = cfg.get("thermal_test_temp")
        reading = read_cpu_temp()
        if reading is None and test is None:
            self.valid = 0
            self.temp = self.crit = self.source = None
            self.reason = "no trusted CPU sensor (acpitz and unlabelled zones are ignored)"
            return
        if reading is not None:
            self.temp, self.crit, self.source = reading
        if test is not None:
            try:
                self.temp  = float(test)
                self.source = (self.source or "none") + " +TEST"
            except (TypeError, ValueError):
                pass

        thr = self._thresholds(cfg, self.crit)
        if thr is None:
            self.reason = ("no critical trip point published by %s — "
                           "set thermal_stop manually to arm" % self.source)
            self.valid = 0
            self.thr = {}
            return
        self.thr = thr

        if self.valid < ARM_SAMPLES:
            self.valid += 1
            self.reason = "arming (%d/%d samples)" % (self.valid, ARM_SAMPLES)
            return

        self.reason = "armed" if rank > 0 else "armed (log-only, taking no action)"

        # Sustained-threshold bookkeeping
        for name in ("warn", "throttle", "stop"):
            if self.temp >= thr[name]:
                self.since.setdefault(name, now)
            else:
                self.since.pop(name, None)

        def held(name, secs):
            t0 = self.since.get(name)
            return t0 is not None and (now - t0) >= secs

        warn_s = max(5, int(cfg.get("thermal_warn_sustain_s", 30) or 30))
        stop_s = max(5, int(cfg.get("thermal_sustain_s", 60) or 60))

        # ── Lockout: re-enforce every tick, whatever brought the server back ──
        if self.locked:
            if self.temp <= thr["resume"]:
                if self.below is None:
                    self.below = now
                if (now - self.below) >= max(30, int(cfg.get("thermal_resume_s", 300) or 300)):
                    self._release(cfg, rank)
                    return
            else:
                self.below = None
                # NB: enforced even after `giveup` — the rate limit disables the
                # automatic RESTART, it must never disable the protection.
                if rank >= MODE_RANK["stop"] and self.running():
                    ok, msg = self._call(self.stop_cb)
                    self.relocks += 1
                    # Rate-limit this line: a supervisor that fights back, or a
                    # stop that silently fails, would otherwise write one line
                    # per tick into crash.log for as long as the box is hot.
                    if (self.relock_log is None) or (now - self.relock_log) >= 60:
                        self.relock_log = now
                        self.log("lockout: process reappeared at %.1fC — re-stopped "
                                 "(%s) [%d time(s) so far]"
                                 % (self.temp, msg, self.relocks))
            return

        # ── Stage ladder ─────────────────────────────────────────────────────
        if held("stop", stop_s):
            self._to_stop(cfg, rank, stop_s)
        elif held("throttle", warn_s):
            self._to_throttle(rank, warn_s)
        elif held("warn", warn_s):
            self._to_warn(thr, warn_s)
        elif self.stage != "normal" and self.temp < thr["warn"]:
            self.log("back to normal: %.1fC (warn=%.1f)" % (self.temp, thr["warn"]))
            self.stage = "normal"
            if self.throttle.active:
                self.throttle.restore()
                self.log("cpufreq cap restored")

    # ── stage transitions ────────────────────────────────────────────────────
    def _to_warn(self, thr, secs):
        if self.stage in ("warn", "throttle"):
            return
        self.stage = "warn"
        self.log("warn: %.1fC (warn=%.1f crit=%s) sustained %ds"
                 % (self.temp, thr["warn"], self.crit or "?", secs))

    def _to_throttle(self, rank, secs):
        if self.stage == "throttle":
            return
        self.stage = "throttle"
        if rank >= MODE_RANK["throttle"] and self.throttle.supported:
            if self.throttle.apply():
                self.log("throttle: %.1fC sustained %ds — cpufreq max lowered 20%%"
                         % (self.temp, secs))
                return
        why = ("no cpufreq write access — stage skipped"
               if not self.throttle.supported else "mode=%s, not acting" % rank)
        self.log("throttle level reached: %.1fC sustained %ds (%s)" % (self.temp, secs, why))

    def _to_stop(self, cfg, rank, secs):
        if self.stage == "stopped":
            return
        self.stage = "stopped"
        if rank < MODE_RANK["stop"]:
            self.log("STOP level reached: %.1fC sustained %ds — mode is '%s', "
                     "NOT stopping (set thermal_mode to 'stop' to act)"
                     % (self.temp, secs, cfg.get("thermal_mode")))
            return

        # Rate limit: after N trips in an hour, stay down instead of flapping.
        cutoff = time.time() - 3600
        while self.stops and self.stops[0] < cutoff:
            self.stops.popleft()
        limit = max(1, int(cfg.get("thermal_max_stops_hour", 2) or 2))
        self.stops.append(time.time())
        self.locked, self.locked_at, self.below = True, time.time(), None
        ok, msg = self._call(self.stop_cb)
        self.log("STOPPED server: %.1fC sustained %ds (stop=%.1f crit=%s) — %s"
                 % (self.temp, secs, self.thr["stop"], self.crit or "?", msg))
        if len(self.stops) >= limit:
            self.giveup = True
            self.log("rate limit: %d thermal stops within the hour — automatic "
                     "restart is now DISABLED (the guard keeps stopping the server "
                     "while it is over-temp; investigate the cooling)" % len(self.stops))

    def _release(self, cfg, rank):
        self.locked, self.below, self.stage = False, None, "normal"
        self.since.clear()
        self.log("recovered: %.1fC held below %.1f — lockout cleared"
                 % (self.temp, self.thr["resume"]))
        if self.throttle.active:
            self.throttle.restore()
            self.log("cpufreq cap restored")
        if rank >= MODE_RANK["stop+restart"] and self.start_cb and not self.giveup:
            ok, msg = self._call(self.start_cb)
            self.log("auto-restart: %s" % msg)

    def _reset_soft(self):
        self.stage, self.valid = "normal", 0
        self.since.clear()
        if self.throttle.active:
            self.throttle.restore()

    @staticmethod
    def _call(cb):
        # Callback messages are collapsed onto one line: run_script() returns a
        # two-line result, and a stray newline would split one event across two
        # lines in crash.log, breaking `grep THERMAL crash.log`.
        def flat(s):
            return " ".join(str(s).split())

        if cb is None:
            return False, "no callback configured"
        try:
            r = cb()
            if isinstance(r, tuple) and len(r) == 2:
                return bool(r[0]), flat(r[1])
            return True, flat(r)
        except Exception as e:
            return False, flat("callback failed: %s" % e)

    def reset(self):
        """Manual override from the panel: clear a lockout and the rate limit.

        Does not disarm the guard — if the CPU is still hot the next tick simply
        stops the server again.  This is for after the sysop has fixed the
        cooling, not a way to defeat the guard.
        """
        with self.lock:
            was = self.locked
            self.locked, self.below, self.giveup = False, None, False
            self.stage, self.relocks, self.relock_log = "normal", 0, None
            self.stops.clear()
            self.since.clear()
            if self.throttle.active:
                self.throttle.restore()
        self.log("lockout manually cleared from the admin panel"
                 if was else "guard state manually reset from the admin panel")
        return True

    # ── status for the panel ─────────────────────────────────────────────────
    def status(self):
        cfg = self._cfg()
        with self.lock:
            return {
                "enabled":     bool(cfg.get("thermal_enabled", True)),
                "mode":        cfg.get("thermal_mode", "log"),
                "armed":       self.valid >= ARM_SAMPLES and bool(self.thr),
                "reason":      self.reason,
                "temp":        self.temp,
                "crit":        self.crit,
                "sensor":      self.source,
                "thresholds":  self.thr,
                "stage":       self.stage,
                "locked":      self.locked,
                "locked_at":   self.locked_at,
                "giveup":      self.giveup,
                "stops_hour":  len(self.stops),
                "relocks":     self.relocks,
                "throttle_supported": self.throttle.supported,
                "throttle_active":    self.throttle.active,
                "last_event":  self.last,
                "test_temp":   cfg.get("thermal_test_temp"),
            }


# ─── Module-level singleton, used by admin_server.py ─────────────────────────
_guard = None


def init(config_getter, stop_cb, start_cb, running_cb, base_dir=BASE_DIR):
    global _guard
    if _guard is None:
        _guard = ThermalGuard(config_getter, stop_cb, start_cb, running_cb, base_dir)
    return _guard


def tick():
    if _guard is not None:
        _guard.tick()


def reset():
    return _guard.reset() if _guard is not None else False


def status():
    if _guard is None:
        return {"enabled": False, "armed": False, "reason": "guard not initialised",
                "mode": "log", "temp": None, "crit": None, "sensor": None,
                "thresholds": {}, "stage": "normal", "locked": False,
                "throttle_supported": False, "throttle_active": False,
                "last_event": None}
    return _guard.status()


USAGE = """PhantomSDR-Plus thermal guard — CPU over-temperature protection.

  python3 thermal_guard.py [--mode MODE] [--config FILE]
  python3 thermal_guard.py --once [--mode MODE] [--config FILE]

  --once          Print the sensor, its critical trip point and the thresholds
                  that would be used on this machine, then exit. Run this first.
  --mode MODE     log | throttle | stop | stop+restart
                  Overrides thermal_mode from the config file, so the guard can
                  be armed without writing any JSON. `log` (the default) records
                  what it WOULD have done and never touches the server.
  --config FILE   Config file to read (default: admin_config.json beside this
                  script). A missing file is fine — built-in defaults are used.
  --help          This text.

Everything the guard does is appended to crash.log next to the config file.
Full documentation: docs/THERMAL_GUARD.md
"""


def _parse_args(argv):
    """Returns (mode_override_or_None, config_path). Exits on bad input."""
    mode, cfg_path = None, BASE_DIR / "admin_config.json"
    if "--help" in argv or "-h" in argv:
        print(USAGE)
        sys.exit(0)
    i = 0
    while i < len(argv):
        a = argv[i]
        for flag, setter in (("--mode", "mode"), ("--config", "config")):
            val = None
            if a == flag:
                if i + 1 >= len(argv):
                    sys.exit("%s needs a value. Try --help." % flag)
                val, i = argv[i + 1], i + 1
            elif a.startswith(flag + "="):
                val = a.split("=", 1)[1]
            if val is None:
                continue
            if setter == "mode":
                if val not in MODE_RANK:
                    sys.exit("Unknown --mode %r. Valid: %s"
                             % (val, " | ".join(MODE_RANK)))
                mode = val
            else:
                cfg_path = Path(val).expanduser()
        i += 1
    return mode, cfg_path


def _config_reader(cfg_path, mode_override=None):
    """Reads the config file on every call, applying any --mode override.

    Re-read rather than cached so edits take effect on the next tick, exactly as
    they do under the admin panel.
    """
    def cfg_get():
        try:
            with open(cfg_path) as f:
                cfg = json.load(f)
            if not isinstance(cfg, dict):
                cfg = {}
        except Exception:
            cfg = {}
        if mode_override is not None:
            cfg["thermal_mode"] = mode_override
        return cfg
    return cfg_get


# ─── Standalone mode ─────────────────────────────────────────────────────────
# For sysops who do not run the admin panel.  Same config file, same behaviour;
# start/stop go through the scripts named in admin_config.json, falling back to
# signalling the process by name so it works with no scripts configured at all.
def _standalone(mode_override=None, cfg_path=None):
    cfg_path = cfg_path or (BASE_DIR / "admin_config.json")
    cfg_get = _config_reader(cfg_path, mode_override)

    def proc_name():
        return (cfg_get().get("sdr_process_name") or "spectrumserver").strip()

    def run_script(key):
        name = (cfg_get().get(key) or "").strip()
        if not name:
            return None
        p = Path(name)
        if not p.is_absolute():
            p = Path(cfg_get().get("sdr_base_dir", str(BASE_DIR))) / name
        if not p.exists():
            return (False, "script not found: %s" % p)
        try:
            subprocess.Popen([str(p)], cwd=str(p.parent),
                             stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                             start_new_session=True)
            return (True, "ran %s" % p.name)
        except Exception as e:
            return (False, "%s failed: %s" % (p.name, e))

    def stop_cb():
        r = run_script("stop_script")
        if r is not None:
            return r
        # No stop script configured: signal the process directly.
        n = proc_name()
        subprocess.run(["pkill", "-TERM", "-f", n], capture_output=True)
        for _ in range(10):
            time.sleep(1)
            if not running_cb():
                return (True, "SIGTERM to %s" % n)
        subprocess.run(["pkill", "-KILL", "-f", n], capture_output=True)
        return (True, "SIGKILL to %s after grace" % n)

    def start_cb():
        r = run_script("start_script")
        return r if r is not None else (False, "no start_script configured")

    def running_cb():
        try:
            r = subprocess.run(["pgrep", "-f", proc_name()],
                               capture_output=True, text=True, timeout=3)
            return any(p.isdigit() for p in r.stdout.split())
        except Exception:
            return False

    g = init(cfg_get, stop_cb, start_cb, running_cb, cfg_path.parent)
    s = read_cpu_temp()
    mode = g._cfg().get("thermal_mode")
    print("PhantomSDR-Plus thermal guard — standalone")
    print("  sensor : %s" % (s[2] if s else "NONE FOUND (guard will not act)"))
    if s:
        print("  temp   : %.1fC   crit: %s" % (s[0], s[1] if s[1] else "not published"))
    print("  config : %s%s" % (cfg_path, "" if cfg_path.exists() else "  (missing — using defaults)"))
    print("  mode   : %s%s" % (mode, "  (from --mode)" if mode_override else ""))
    if mode == "log":
        print("           log-only: records what it WOULD do, never acts."
              " Use --mode stop to arm it.")
    while True:
        g.tick()
        time.sleep(2)


if __name__ == "__main__":
    _mode, _cfg_path = _parse_args(sys.argv[1:])
    if "--once" in sys.argv:
        # What this machine looks like to the guard: sensor, trip point and the
        # thresholds that would be used. Run it before trusting the guard.
        r = read_cpu_temp()
        if r is None:
            print("sensor     : NONE — no trusted CPU sensor on this machine.")
            print("             acpitz and unlabelled thermal zones are ignored on")
            print("             purpose; the guard will report itself disabled.")
            sys.exit(1)
        temp, crit, source = r
        g = ThermalGuard(_config_reader(_cfg_path, _mode), None, None, lambda: False)
        thr = g._thresholds(g._cfg(), crit)
        print("sensor     : %s" % source)
        print("temperature: %.1f C" % temp)
        print("crit       : %s" % ("%.1f C" % crit if crit else
                                    "not published — set thermal_stop manually"))
        print("mode       : %s%s" % (g._cfg().get("thermal_mode"),
                                   "  (from --mode)" if _mode else ""))
        if thr:
            print("thresholds : warn %.1f  throttle %.1f  stop %.1f  resume %.1f (C)"
                  % (thr["warn"], thr["throttle"], thr["stop"], thr["resume"]))
        else:
            print("thresholds : none — guard cannot arm")
        print("cpufreq    : %s" % ("writable, throttle stage available"
                                   if _Throttle().supported else
                                   "not writable — throttle stage disabled"))
    else:
        try:
            _standalone(_mode, _cfg_path)
        except KeyboardInterrupt:
            pass
