#!/usr/bin/env python3
"""
PhantomSDR-Plus Admin Panel — Internal service (localhost only).
Do NOT run this directly for public access.
Use proxy.py to expose it on the main port alongside spectrumserver.

Direct access (internal/dev only): http://127.0.0.1:8901/admin
Via proxy (production):            http://server_address:8900/admin
Default password: admin (change on first login!)
"""

import os
import sys
import json
import hashlib
import subprocess
import threading
import time
import signal
import re
import glob
import logging
from collections import deque
from datetime import datetime, timedelta
from functools import wraps
from pathlib import Path

try:
    import tomllib
except ImportError:
    try:
        import tomli as tomllib
    except ImportError:
        tomllib = None

try:
    import tomli_w
except ImportError:
    tomli_w = None

try:
    import psutil
    HAS_PSUTIL = True
except ImportError:
    HAS_PSUTIL = False

# CPU over-temperature guard. Optional: a missing or broken thermal_guard.py
# must never stop the panel itself from starting.
try:
    import thermal_guard
    HAS_THERMAL = True
except Exception:
    thermal_guard = None
    HAS_THERMAL = False

from flask import (Flask, render_template_string, request, session,
                   redirect, url_for, jsonify, Response, flash)

# ─── Config ────────────────────────────────────────────────────────────────────
BASE_DIR = Path(__file__).parent.resolve()
ADMIN_CONFIG_FILE = BASE_DIR / "admin_config.json"
ADMIN_PORT = int(os.environ.get("ADMIN_PORT", 3000))    # internal only — proxy.py exposes it publicly
ADMIN_BIND = os.environ.get("ADMIN_BIND", "127.0.0.1")  # localhost by default; set "0.0.0.0" for standalone
PUBLIC_PORT = int(os.environ.get("PUBLIC_PORT", 8900))  # display default only — port users actually connect to

def _get_or_create_secret_key():
    """Load secret key from config (persistent across restarts) or create and save one."""
    env_key = os.environ.get("ADMIN_SECRET")
    if env_key:
        return env_key
    try:
        if ADMIN_CONFIG_FILE.exists():
            with open(ADMIN_CONFIG_FILE) as f:
                cfg = json.load(f)
            key = cfg.get("secret_key")
            if key:
                return key
            # First run: generate, persist, return
            key = os.urandom(24).hex()
            cfg["secret_key"] = key
            with open(ADMIN_CONFIG_FILE, "w") as f:
                json.dump(cfg, f, indent=2)
            return key
    except Exception:
        pass
    return os.urandom(24).hex()  # fallback: ephemeral key (config unreadable)

SECRET_KEY = _get_or_create_secret_key()

DEFAULT_CONFIG = {
    "password_hash": hashlib.sha256(b"admin").hexdigest(),
    "port": ADMIN_PORT,
    "sdr_base_dir": str(BASE_DIR),
    "log_lines": 200,
    "start_script": "",
    "stop_script":  "",
    "public_port":  PUBLIC_PORT   # port users connect to (proxy.py / nginx / spectrumserver direct)
}

# ─── App setup ─────────────────────────────────────────────────────────────────
app = Flask(__name__)
app.secret_key = SECRET_KEY

# Trust X-Forwarded-* headers from proxy.py so Flask generates correct
# external URLs for redirects and url_for() calls.
try:
    from werkzeug.middleware.proxy_fix import ProxyFix
    app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_host=1, x_proto=1, x_port=1)
except ImportError:
    pass  # Werkzeug < 1.0 — skip, redirects may use internal URL

log_buffer = []
log_lock = threading.Lock()

# ── Waterfall message (fixed banner shown to all connected users) ──────────────
_wf_message      = {"text": "", "color": "#ffffff"}
_wf_message_lock = threading.Lock()

LOG_FILES = {
    "logwebsdr.txt": "logwebsdr.txt",
    "spectrumserver.log": "spectrumserver.log",
    "admin.log": "admin.log",
    "rade.log": "rade.log",
    "crash.log": "crash.log",
    "autorun.log": "autorun.log",
    "proxy.log": "proxy.log",
}

# Logs that "Clear Logs" must leave alone. Empty by sysop decision: the button
# clears every log in LOG_FILES, autorun.log included.
#
# Both exclusions that used to live here are gone for the same reason — a button
# labelled "Clear Logs" that silently keeps a file looks broken, and neither file
# needed protecting. proxy.log is an access log the sysop owns; autorun.log is
# the decoder log, and while its spot history cannot be reconstructed, logrotate
# (logrotate/phantomsdr) keeps the rotated archives in logproxy/, so a clear
# costs only what has accumulated since the last rotation.
#
# Clearing autorun.log under a running decoder is safe: the daemon holds it open
# O_APPEND, so an in-place truncate takes effect immediately and the daemon goes
# on appending to the same inode. Whatever cannot be written is named in the
# toast rather than reported as success.
CLEAR_EXCLUDE = set()

# ─── Helpers ───────────────────────────────────────────────────────────────────
def load_admin_config():
    if ADMIN_CONFIG_FILE.exists():
        with open(ADMIN_CONFIG_FILE) as f:
            return json.load(f)
    return DEFAULT_CONFIG.copy()

def save_admin_config(cfg):
    with open(ADMIN_CONFIG_FILE, "w") as f:
        json.dump(cfg, f, indent=2)

def hash_password(pwd):
    return hashlib.sha256(pwd.encode()).hexdigest()

def check_password(pwd):
    cfg = load_admin_config()
    return hash_password(pwd) == cfg.get("password_hash", "")

def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if not session.get("authenticated"):
            return redirect(url_for("login"))
        return f(*args, **kwargs)
    return decorated

def get_sdr_dir():
    cfg = load_admin_config()
    return Path(cfg.get("sdr_base_dir", str(BASE_DIR)))

def find_config_files():
    base = get_sdr_dir()
    files = {}
    for pattern in ["config.toml", "config-*.toml", "config.example.*.toml"]:
        for f in sorted(base.glob(pattern)):
            files[f.name] = str(f)
    return files

def find_editable_files():
    """Find all editable files (.sh .toml .cpp .h .txt .json .html) in PhantomSDR-Plus dir."""
    import os
    base  = get_sdr_dir()
    exts  = {'.sh', '.toml', '.cpp', '.h', '.txt', '.json', '.html'}
    files = {}
    skip  = {'node_modules', 'build', 'dist', '__pycache__', '.git'}
    for root, dirs, filenames in os.walk(str(base)):
        dirs[:] = [d for d in dirs if not d.startswith('.') and d not in skip]
        for fn in sorted(filenames):
            if Path(fn).suffix.lower() in exts:
                if fn == "admin_config.json":
                    continue
                full = os.path.join(root, fn)
                rel  = os.path.relpath(full, str(base))
                files[rel] = full
    return dict(sorted(files.items()))

def find_json_files():
    base = get_sdr_dir()
    files = {}
    for pattern in ["*.json", "frontend/src/*.json", "frontend/*.json"]:
        for f in sorted(base.glob(pattern)):
            if f.name != "admin_config.json":
                files[str(f.relative_to(base))] = str(f)
    return files

def find_sh_files():
    """Discover all .sh files inside PhantomSDR-Plus directory. Returns {rel_path: abs_path}."""
    import os
    base  = get_sdr_dir()
    files = {}
    for root, dirs, filenames in os.walk(str(base)):
        dirs[:] = [d for d in dirs if not d.startswith('.')
                   and d not in ('node_modules', 'build', 'dist', '__pycache__')]
        for fn in sorted(filenames):
            if fn.endswith('.sh'):
                full = os.path.join(root, fn)
                rel  = os.path.relpath(full, str(base))
                files[rel] = full
    return dict(sorted(files.items()))

def find_config_files_all():
    """Find all .toml config files inside PhantomSDR-Plus directory. Returns {name: abs_path}."""
    base  = get_sdr_dir()
    files = {}
    for pattern in ["config.toml", "config-*.toml", "config.example.*.toml", "*.toml"]:
        for f in sorted(base.glob(pattern)):
            files[f.name] = str(f)
    return dict(sorted(files.items()))

def get_allowed_configs():
    return find_config_files_all()

def get_allowed_scripts():
    return find_sh_files()
# ─── First-run / Setup helpers ─────────────────────────────────────────────────

def is_first_run():
    if not ADMIN_CONFIG_FILE.exists():
        return True
    try:
        return not load_admin_config().get("setup_complete", False)
    except Exception:
        return True

def auto_detect_sdr_candidates():
    import glob as _glob
    seen, found = set(), []
    def add(p):
        s = str(Path(p).resolve())
        if s not in seen:
            seen.add(s); found.append(s)
    add(BASE_DIR)
    for tmpl in ["~/PhantomSDR-Plus", "~/phantomsdr", "/opt/PhantomSDR-Plus",
                 "/usr/local/PhantomSDR-Plus", "/home/*/PhantomSDR-Plus"]:
        for hit in _glob.glob(str(Path(tmpl).expanduser())):
            if Path(hit).is_dir(): add(hit)
    try:
        r = subprocess.run(["pgrep", "-a", "-f", "spectrumserver"],
                           capture_output=True, text=True, timeout=3)
        for line in r.stdout.splitlines():
            for part in line.split():
                if "spectrumserver" in part and os.sep in part:
                    for anc in [Path(part).parent, Path(part).parent.parent]:
                        if anc.is_dir(): add(anc)
    except Exception:
        pass
    def score(s):
        p = Path(s)
        return (4*int((p/"build"/"spectrumserver").exists()) +
                3*int(bool(list(p.glob("config*.toml")))) +
                2*int((p/"frontend").is_dir()) +
                  int((p/"admin_server.py").exists()))
    found.sort(key=score, reverse=True)
    return found or [str(BASE_DIR)]


def get_process_status():
    status = {"running": False, "pid": None, "name": None, "cpu": 0, "mem": 0, "uptime": None}
    proc_name = "spectrumserver"
    try:
        proc_name = load_admin_config().get("sdr_process_name", "spectrumserver").strip() or "spectrumserver"
    except Exception:
        pass
    # pgrep first — works across users, no psutil needed
    try:
        r = subprocess.run(["pgrep", "-f", proc_name], capture_output=True, text=True, timeout=3)
        pids = [p for p in r.stdout.split() if p.isdigit()]
        if pids:
            status.update({"running": True, "pid": int(pids[0]), "name": proc_name})
    except Exception:
        pass
    # psutil enriches with CPU/mem/uptime
    if HAS_PSUTIL:
        try:
            for proc in psutil.process_iter(["pid", "name", "cmdline", "cpu_percent", "memory_info", "create_time"]):
                try:
                    pname = (proc.info["name"] or "").lower()
                    cmd   = " ".join(proc.info["cmdline"] or []).lower()
                    if proc_name.lower() in pname or proc_name.lower() in cmd:
                        ut = time.time() - proc.info["create_time"]
                        status.update({"running": True, "pid": proc.info["pid"],
                                       "name": proc.info["name"],
                                       "cpu": proc.cpu_percent(interval=0.1),
                                       "mem": round(proc.info["memory_info"].rss / 1024 / 1024, 1),
                                       "uptime": str(timedelta(seconds=int(ut)))})
                        break
                except (psutil.NoSuchProcess, psutil.AccessDenied):
                    pass
                except Exception:
                    pass
        except Exception:
            pass
    return status


def get_temperature():
    """Try multiple methods to get CPU temperature."""
    # psutil sensors
    if HAS_PSUTIL and hasattr(psutil, "sensors_temperatures"):
        try:
            temps = psutil.sensors_temperatures()
            for key in ("coretemp", "cpu_thermal", "acpitz", "k10temp", "zenpower"):
                if key in temps and temps[key]:
                    return round(temps[key][0].current, 1)
            # any first available
            for key, entries in temps.items():
                if entries:
                    return round(entries[0].current, 1)
        except Exception:
            pass
    # /sys/class/thermal fallback
    try:
        import glob
        for p in sorted(glob.glob("/sys/class/thermal/thermal_zone*/temp")):
            with open(p) as f:
                val = int(f.read().strip())
            if val > 0:
                return round(val / 1000.0, 1)
    except Exception:
        pass
    # sensors command fallback
    try:
        r = subprocess.run(["sensors"], capture_output=True, text=True, timeout=2)
        import re
        m = re.search(r'[Tt]emp\d*:\s+\+?([\d.]+)', r.stdout)
        if m:
            return round(float(m.group(1)), 1)
    except Exception:
        pass
    return None

def get_system_stats():
    if not HAS_PSUTIL:
        return {"cpu": "N/A", "mem_used": "N/A", "mem_total": "N/A", "disk_used": "N/A", "disk_total": "N/A", "temp": None}
    mem = psutil.virtual_memory()
    disk = psutil.disk_usage("/")
    return {
        "cpu": psutil.cpu_percent(interval=0.5),
        "mem_used": round(mem.used / 1024**3, 1),
        "mem_total": round(mem.total / 1024**3, 1),
        "mem_pct": mem.percent,
        "disk_used": round(disk.used / 1024**3, 1),
        "disk_total": round(disk.total / 1024**3, 1),
        "disk_pct": disk.percent,
        "temp": get_temperature(),
    }

def get_top_processes(n=12):
    """Return top N processes sorted by CPU usage."""
    if not HAS_PSUTIL:
        # Fallback: use 'ps' command
        try:
            result = subprocess.run(
                ["ps", "aux", "--sort=-%cpu"],
                capture_output=True, text=True
            )
            lines = result.stdout.strip().split("\n")[1:n+1]
            procs = []
            for line in lines:
                parts = line.split(None, 10)
                if len(parts) >= 11:
                    procs.append({
                        "pid": parts[1],
                        "cpu": parts[2],
                        "mem": parts[3],
                        "name": parts[10][:40],
                    })
            return procs
        except Exception:
            return []
    procs = []
    for proc in psutil.process_iter(["pid", "name", "cpu_percent", "memory_percent", "status", "username"]):
        try:
            procs.append({
                "pid": proc.info["pid"],
                "name": (proc.info["name"] or "")[:35],
                "cpu": round(proc.info["cpu_percent"] or 0, 1),
                "mem": round(proc.info["memory_percent"] or 0, 1),
                "status": proc.info["status"],
                "user": (proc.info["username"] or "")[:12],
            })
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            pass
    procs.sort(key=lambda x: x["cpu"], reverse=True)
    return procs[:n]

# ── Stats history sampler (Graphs page) ───────────────────────────────────────
# A background thread samples a few cheap counters on a fixed interval and keeps
# them in a ring buffer, so the Graphs page has history the moment it is opened
# instead of having to build it up from scratch each visit. Nothing here touches
# the disk: the buffer is memory-only and is lost on restart by design.
# Two tiers. The fine tier gives a live 2s view; the coarse tier carries the
# long ranges. Storing a day at 2s would be ~43000 points — tens of MB to hold,
# a multi-MB first payload, and 40 points per pixel of canvas, which no screen
# can show. Aggregating to 30s keeps a day in 2880 points instead.
GRAPH_INTERVAL_S   = 2          # seconds between fine samples
GRAPH_FINE_S       = 3600       # how far back the fine tier reaches (1h)
GRAPH_COARSE_EVERY = 15         # fine samples per coarse point (15 x 2s = 30s)
GRAPH_COARSE_S     = 24 * 3600  # how far back the coarse tier reaches (24h)

GRAPH_COARSE_INTERVAL_S = GRAPH_INTERVAL_S * GRAPH_COARSE_EVERY
GRAPH_MAXLEN        = GRAPH_FINE_S // GRAPH_INTERVAL_S
GRAPH_COARSE_MAXLEN = GRAPH_COARSE_S // GRAPH_COARSE_INTERVAL_S
# Ranges longer than this are served from the coarse tier.
GRAPH_HISTORY_S     = GRAPH_COARSE_S   # deepest range the page can ask for

_graph_history = deque(maxlen=GRAPH_MAXLEN)
_graph_coarse  = deque(maxlen=GRAPH_COARSE_MAXLEN)
_graph_pending = []            # fine samples not yet folded into a coarse point
_graph_lock    = threading.Lock()
_graph_started = False


def _graph_fold(batch):
    """Average a run of fine samples into one coarse point.

    Averages over the readings that exist; a field is None only when every
    sample in the run lacked it, so an occasional failed read thins the average
    instead of punching a hole in the long-range view.
    """
    def avg(key, nd):
        vals = [p[key] for p in batch if p.get(key) is not None]
        return round(sum(vals) / len(vals), nd) if vals else None
    users = [p["u"] for p in batch if p.get("u") is not None]
    return {
        "t":  batch[-1]["t"],
        "l":  avg("l", 1),
        "f":  avg("f", 2),
        "fm": avg("fm", 2),
        "c":  avg("c", 1),
        "u":  round(sum(users) / len(users)) if users else None,
    }


def get_cpu_frequency():
    """Current CPU clock in GHz: (average across cores, fastest core, hw limit).

    psutil first, then the cpufreq sysfs tree.  Both read the same kernel data
    that cpufreq-info formats, so cpufrequtils is not required.  Any element may
    be None when the platform does not expose it.
    """
    if HAS_PSUTIL:
        try:
            per = psutil.cpu_freq(percpu=True)
            cur = [f.current for f in per if f and f.current]
            if cur:
                limit = max((f.max for f in per if f and f.max), default=0)
                return (round(sum(cur) / len(cur) / 1000, 2),
                        round(max(cur) / 1000, 2),
                        round(limit / 1000, 2) if limit else None)
        except Exception:
            pass
    try:
        cur, limit = [], 0
        for d in sorted(glob.glob("/sys/devices/system/cpu/cpu[0-9]*/cpufreq")):
            try:
                with open(os.path.join(d, "scaling_cur_freq")) as f:
                    cur.append(int(f.read().strip()))
            except Exception:
                pass
            try:
                with open(os.path.join(d, "cpuinfo_max_freq")) as f:
                    limit = max(limit, int(f.read().strip()))
            except Exception:
                pass
        cur = [c for c in cur if c > 0]
        if cur:
            return (round(sum(cur) / len(cur) / 1e6, 2),
                    round(max(cur) / 1e6, 2),
                    round(limit / 1e6, 2) if limit else None)
    except Exception:
        pass
    return (None, None, None)


def count_connected_users():
    """Number of clients currently on the WebSDR, or None if it cannot be read.

    Uses spectrumserver's own /users endpoint — the authoritative session list —
    rather than counting sockets with 'ss', which cannot see past the proxy.
    """
    import urllib.request
    try:
        cfg = load_admin_config()
        port = int(cfg.get("public_port", PUBLIC_PORT))
        with urllib.request.urlopen("http://127.0.0.1:%d/users" % port, timeout=2) as r:
            d = json.loads(r.read().decode())
        if isinstance(d.get("total"), int):
            return d["total"]
        return len(d.get("users", []))
    except Exception:
        return None


def _graph_sampler():
    """Append one sample per interval.  Never raises — a bad sample is skipped."""
    if HAS_PSUTIL:
        try:
            psutil.cpu_percent(interval=None)   # prime the delta counter
        except Exception:
            pass
    while True:
        time.sleep(GRAPH_INTERVAL_S)
        # Thermal guard rides along on this loop — it needs a temperature every
        # couple of seconds and the sampler already wakes up to take one. Its
        # own try/except so a guard problem can never stop graph sampling.
        if HAS_THERMAL:
            try:
                thermal_guard.tick()
            except Exception:
                pass
        try:
            load = None
            if HAS_PSUTIL:
                # interval=None measures since the previous call, i.e. across the
                # whole sleep — no extra blocking sample needed.
                load = round(psutil.cpu_percent(interval=None), 1)
            freq, freq_max, _ = get_cpu_frequency()
            point = {
                "t": int(time.time()),
                "l": load,
                "f": freq,
                "fm": freq_max,
                "c": get_temperature(),
                "u": count_connected_users(),
            }
            with _graph_lock:
                _graph_history.append(point)
                _graph_pending.append(point)
                if len(_graph_pending) >= GRAPH_COARSE_EVERY:
                    _graph_coarse.append(_graph_fold(_graph_pending))
                    _graph_pending.clear()
        except Exception:
            pass


def start_graph_sampler():
    global _graph_started
    if _graph_started:
        return
    _graph_started = True
    threading.Thread(target=_graph_sampler, name="graph-sampler", daemon=True).start()


def start_thermal_guard():
    """Wire the CPU over-temperature guard to this panel's start/stop paths.

    The guard itself knows nothing about PhantomSDR: it is handed callbacks, so
    it acts through whatever start/stop method THIS sysop configured, and works
    the same whether the server is supervised by a watchdog, systemd or nothing.
    """
    if not HAS_THERMAL:
        return False

    def _start():
        name = (load_admin_config().get("start_script") or "").strip()
        if not name:
            return (False, "no start_script configured — not restarting")
        return run_script(name)

    def _running():
        try:
            return bool(get_process_status().get("running"))
        except Exception:
            return False

    try:
        thermal_guard.init(load_admin_config, stop_server, _start, _running, get_sdr_dir())
        return True
    except Exception as e:
        print("[WARN] thermal guard failed to start: %s" % e)
        return False


def run_script(script_name):
    base = get_sdr_dir()
    sh   = get_allowed_scripts()
    # Resolve absolute path from whitelist map
    if script_name in sh:
        script_path = Path(sh[script_name])
    elif Path(script_name).is_absolute() and Path(script_name).exists():
        script_path = Path(script_name)
    else:
        script_path = base / script_name
    if not script_path.exists():
        return False, "Script not found: " + str(script_path)
    try:
        script_path.chmod(script_path.stat().st_mode | 0o111)
        proc = subprocess.Popen(
            ["bash", str(script_path)],
            cwd=str(script_path.parent),
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            start_new_session=True,
        )
        try:
            out, _ = proc.communicate(timeout=3)
        except subprocess.TimeoutExpired:
            out = "(running in background)"
        with log_lock:
            log_buffer.append("[" + datetime.now().strftime("%H:%M:%S") + "] RAN " + script_name + ": " + out[:200])
        return True, "Started " + script_path.name + " (PID " + str(proc.pid) + ")" + chr(10) + out
    except Exception as e:
        return False, str(e)

def stop_server():
    cfg = load_admin_config()
    configured = cfg.get("stop_script", "").strip()
    if configured:
        return run_script(configured)
    base = get_sdr_dir()
    fallback = base / "stop-websdr.sh"
    if fallback.exists():
        return run_script("stop-websdr.sh")
    # Last resort: kill by process name
    try:
        subprocess.run(["killall", "spectrumserver"], capture_output=True)
        return True, "Sent SIGTERM to spectrumserver"
    except Exception as e:
        return False, str(e)

def read_file_safe(path):
    try:
        with open(path, encoding="utf-8", errors="replace") as f:
            return f.read()
    except Exception as e:
        return f"# Error reading file: {e}"

def write_file_safe(path, content):
    try:
        with open(path, "w", encoding="utf-8") as f:
            f.write(content)
        return True, "Saved successfully"
    except Exception as e:
        return False, str(e)

def tail_file_lines(path, n):
    """The last n lines of a file, without reading all of it.

    This used to be f.readlines()[-n:], which pulls the entire file into memory
    to show a hundred lines. spectrumserver.log reaches ~10 MB before it
    rotates and the viewer refreshes every 3 seconds; measured, the old path
    costs about 30 ms per refresh at that size against 0.2 ms here. Not fatal,
    but it is pure waste on a panel that is polling anyway, and it grows with
    the log. Walk backwards from the end in blocks until there are enough
    newlines. Verified line-for-line against tail(1), including on an empty
    file, one with no trailing newline, and one spanning several blocks.
    """
    block = 64 * 1024
    data = b""
    with open(path, "rb") as f:
        f.seek(0, os.SEEK_END)
        pos = f.tell()
        while pos > 0 and data.count(b"\n") <= n:
            step = min(block, pos)
            pos -= step
            f.seek(pos)
            data = f.read(step) + data
    text = data.decode("utf-8", errors="replace")
    return [l.rstrip() for l in text.splitlines()[-n:]]

def read_log_lines(log_name, n=100):
    base = get_sdr_dir()
    if log_name not in LOG_FILES:
        return []
    lf = base / LOG_FILES[log_name]
    lines = []
    if lf.exists():
        try:
            lines = tail_file_lines(lf, n)
        except Exception as e:
            lines = [f"Error reading {lf.name}: {e}"]
    if log_name == "admin.log":
        with log_lock:
            mem_lines = list(log_buffer[-50:])
        return lines + mem_lines   # file (older) first, in-memory (newer) last
    return lines

def tail_log(n=100, log_name=None):
    if log_name:
        return read_log_lines(log_name, n)

    base = get_sdr_dir()
    lines = []
    for name in LOG_FILES:
        lf = base / LOG_FILES[name]
        if lf.exists():
            try:
                file_lines = tail_file_lines(lf, n)
                lines.append(f"===== {lf.name} =====")
                lines.extend(file_lines)
            except Exception as e:
                lines.append(f"===== {lf.name} =====")
                lines.append(f"Error reading {lf.name}: {e}")

    # Fallback: journalctl only if no log files were found/read
    if not lines:
        try:
            result = subprocess.run(
                ["journalctl", "-u", "phantomsdr-admin", "-n", str(n), "--no-pager", "--output=short"],
                capture_output=True, text=True, timeout=3
            )
            if result.stdout.strip():
                lines = result.stdout.strip().splitlines()
        except Exception:
            pass

    # Also try journalctl for spectrumserver process
    if not lines:
        try:
            result = subprocess.run(
                ["journalctl", "_COMM=spectrumserver", "-n", str(n), "--no-pager", "--output=short"],
                capture_output=True, text=True, timeout=3
            )
            if result.stdout.strip():
                lines = result.stdout.strip().splitlines()
        except Exception:
            pass

    with log_lock:
        mem_lines = list(log_buffer[-50:])
    return lines + mem_lines   # file (older) first, in-memory (newer) last

# ─── HTML Template ─────────────────────────────────────────────────────────────
LOGIN_HTML = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>PhantomSDR Admin · Login</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Orbitron:wght@400;700;900&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0;padding:0}
:root{
  --green:#00ff41;--green2:#00cc33;--amber:#ffb000;--red:#ff3333;
  --bg:#050a05;--panel:#0d1a0d;--border:#1a3a1a;--dim:#1f3a1f;
  --text:#c8ffc8;--text2:#7ab87a;--glow:0 0 10px #00ff4155,0 0 20px #00ff4122;
}
body{background:var(--bg);font-family:'Share Tech Mono',monospace;color:var(--text);
  min-height:100vh;display:flex;align-items:center;justify-content:center;
  background-image:repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,255,65,0.015) 2px,rgba(0,255,65,0.015) 4px);}
body::before{content:'';position:fixed;inset:0;background:radial-gradient(ellipse 80% 60% at 50% 40%,rgba(0,255,65,0.04) 0%,transparent 70%);pointer-events:none;}

.login-wrap{width:380px;animation:fadeIn .6s ease;}
@keyframes fadeIn{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:none}}

.logo{text-align:center;margin-bottom:2rem;}
.logo-title{font-family:'Orbitron',sans-serif;font-weight:900;font-size:1.4rem;
  color:var(--green);text-shadow:var(--glow);letter-spacing:0.1em;}
.logo-sub{font-size:.7rem;color:var(--text2);letter-spacing:.3em;margin-top:.4rem;}
.logo-icon{font-size:3rem;margin-bottom:.5rem;filter:drop-shadow(0 0 12px #00ff41);}

.card{background:var(--panel);border:1px solid var(--border);border-radius:4px;
  padding:2rem;box-shadow:0 0 40px rgba(0,255,65,0.08),inset 0 1px 0 rgba(0,255,65,0.1);}

label{display:block;font-size:.7rem;color:var(--text2);letter-spacing:.2em;margin-bottom:.4rem;margin-top:1.2rem;}
label:first-of-type{margin-top:0;}

input[type=password]{width:100%;background:#071007;border:1px solid var(--border);
  color:var(--green);font-family:'Share Tech Mono',monospace;font-size:.9rem;
  padding:.7rem 1rem;border-radius:3px;outline:none;transition:.2s;caret-color:var(--green);}
input[type=password]:focus{border-color:var(--green);box-shadow:var(--glow);}

.btn{width:100%;margin-top:1.5rem;padding:.8rem;background:transparent;
  border:1px solid var(--green);color:var(--green);font-family:'Orbitron',sans-serif;
  font-size:.75rem;letter-spacing:.2em;cursor:pointer;border-radius:3px;
  transition:.2s;text-transform:uppercase;}
.btn:hover{background:rgba(0,255,65,0.1);box-shadow:var(--glow);}

.error{background:rgba(255,51,51,0.1);border:1px solid #ff333355;color:#ff6666;
  padding:.7rem 1rem;border-radius:3px;font-size:.8rem;margin-bottom:1rem;text-align:center;}

.blink{animation:blink 1.2s step-end infinite;}
@keyframes blink{50%{opacity:0}}

.scanlines{pointer-events:none;position:fixed;inset:0;
  background:repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(0,0,0,0.08) 3px,rgba(0,0,0,0.08) 4px);
  z-index:9999;}
</style>
</head>
<body>
<div class="scanlines"></div>
<div class="login-wrap">
  <div class="logo">
    <div class="logo-icon">📡</div>
    <div class="logo-title">PHANTOM<span style="color:var(--amber)">SDR</span></div>
    <div class="logo-sub">ADMIN CONTROL PANEL</div>
  </div>
  <div class="card">
    {% if error %}<div class="error">⚠ {{ error }}</div>{% endif %}
    <form method="post">
      <label>ACCESS CODE</label>
      <input type="password" name="password" autofocus placeholder="••••••••">
      <button type="submit" class="btn">▶ AUTHENTICATE<span class="blink">_</span></button>
    </form>
  </div>
</div>
</body>
</html>"""

SETUP_HTML = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>PhantomSDR Admin &#183; Setup</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Orbitron:wght@400;700;900&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0;padding:0}
:root{--green:#00ff41;--amber:#ffb000;--red:#ff3333;--blue:#00ccff;
  --bg:#050a05;--panel:#0d1a0d;--border:#1a3a1a;--text:#c8ffc8;--text2:#7ab87a;--text3:#4a8a4a;
  --glow:0 0 10px #00ff4155,0 0 20px #00ff4122;}
body{background:var(--bg);font-family:"Share Tech Mono",monospace;color:var(--text);
  min-height:100vh;display:flex;align-items:center;justify-content:center;
  background-image:repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,255,65,0.015) 2px,rgba(0,255,65,0.015) 4px);}
body::before{content:"";position:fixed;inset:0;background:radial-gradient(ellipse 80% 60% at 50% 40%,rgba(0,255,65,0.04) 0%,transparent 70%);pointer-events:none;}
.scanlines{pointer-events:none;position:fixed;inset:0;background:repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(0,0,0,0.08) 3px,rgba(0,0,0,0.08) 4px);z-index:9999;}
.wrap{width:500px;max-width:96vw;animation:fadeIn .5s ease;}
@keyframes fadeIn{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}
.logo{text-align:center;margin-bottom:1.5rem;}
.logo-icon{font-size:2.5rem;filter:drop-shadow(0 0 10px #00ff41);}
.logo-title{font-family:"Orbitron",sans-serif;font-weight:900;font-size:1.3rem;color:var(--green);text-shadow:var(--glow);letter-spacing:.1em;margin-top:.4rem;}
.logo-sub{font-size:.65rem;color:var(--text3);letter-spacing:.3em;margin-top:.3rem;}
.card{background:var(--panel);border:1px solid var(--border);border-radius:4px;padding:1.6rem;box-shadow:0 0 40px rgba(0,255,65,0.06);}
.step-label{font-family:"Orbitron",sans-serif;font-size:.6rem;color:var(--text3);letter-spacing:.25em;margin-bottom:1.2rem;padding-bottom:.5rem;border-bottom:1px solid var(--border);}
.field{margin-bottom:1rem;}
.field label{display:block;font-size:.65rem;color:var(--text2);letter-spacing:.15em;margin-bottom:.35rem;}
.field input,.field select{width:100%;background:#071007;border:1px solid var(--border);color:var(--green);
  font-family:"Share Tech Mono",monospace;font-size:.85rem;padding:.6rem .8rem;border-radius:3px;outline:none;transition:.15s;}
.field input:focus,.field select:focus{border-color:var(--green);box-shadow:var(--glow);}
.field-row{display:grid;grid-template-columns:1fr 1fr;gap:.7rem;}
.hint{font-size:.62rem;color:var(--text3);margin-top:.3rem;line-height:1.5;}
.detect-btn{display:inline-flex;align-items:center;gap:.4rem;padding:.35rem .7rem;font-size:.65rem;cursor:pointer;border-radius:2px;border:1px solid #00ccff55;color:var(--blue);background:transparent;font-family:"Share Tech Mono",monospace;transition:.15s;margin-bottom:.5rem;}
.detect-btn:hover{background:rgba(0,204,255,0.08);}
.btn{width:100%;margin-top:1.2rem;padding:.85rem;background:transparent;border:1px solid var(--green);color:var(--green);font-family:"Orbitron",sans-serif;font-size:.75rem;letter-spacing:.2em;cursor:pointer;border-radius:3px;transition:.2s;text-transform:uppercase;}
.btn:hover{background:rgba(0,255,65,0.1);box-shadow:var(--glow);}
.btn:disabled{opacity:.4;cursor:not-allowed;}
.err{background:rgba(255,51,51,0.1);border:1px solid #ff333355;color:#ff6666;padding:.6rem .9rem;border-radius:3px;font-size:.75rem;margin-top:.8rem;display:none;}
.ok-msg{background:rgba(0,255,65,0.08);border:1px solid #00ff4155;color:var(--green);padding:.6rem .9rem;border-radius:3px;font-size:.75rem;margin-top:.8rem;display:none;}
.blink{animation:blink 1.2s step-end infinite;}
@keyframes blink{50%{opacity:0}}
</style>
</head>
<body>
<div class="scanlines"></div>
<div class="wrap">
  <div class="logo">
    <div class="logo-icon">&#128225;</div>
    <div class="logo-title">PHANTOM<span style="color:var(--amber)">SDR</span></div>
    <div class="logo-sub">FIRST-RUN SETUP</div>
  </div>
  <div class="card">
    <div class="step-label">&#9654; CONFIGURE YOUR STATION</div>
    <div class="field">
      <label>SDR INSTALLATION DIRECTORY</label>
      <button class="detect-btn" onclick="autoDetect()" id="detect-btn">&#9889; AUTO-DETECT</button>
      <select id="dir-sel" onchange="dirSelChange()" style="margin-bottom:.4rem;display:none;"></select>
      <input type="text" id="sdr-dir" placeholder="/path/to/PhantomSDR-Plus">
      <div class="hint">Root folder containing config.toml, build/, frontend/, etc.</div>
    </div>
    <div class="field-row">
      <div class="field">
        <label>SDR PROCESS NAME</label>
        <input type="text" id="proc-name" value="spectrumserver" placeholder="spectrumserver">
        <div class="hint">For ONLINE status detection</div>
      </div>
      <div class="field">
        <label>PUBLIC PORT</label>
        <input type="number" id="pub-port" value="8900" placeholder="8900" min="1" max="65535">
        <div class="hint">Port users connect to</div>
      </div>
    </div>
    <div class="field">
      <label>NEW ADMIN PASSWORD <span style="color:var(--red)">*</span></label>
      <input type="password" id="new-pwd" placeholder="Choose a strong password" autocomplete="new-password">
    </div>
    <div class="field">
      <label>CONFIRM PASSWORD</label>
      <input type="password" id="new-pwd2" placeholder="Repeat password" autocomplete="new-password">
    </div>
    <div class="err" id="err-box"></div>
    <div class="ok-msg" id="ok-box">Setup complete! Redirecting...<span class="blink">_</span></div>
    <button class="btn" onclick="completeSetup()" id="setup-btn">&#9654; COMPLETE SETUP<span class="blink">_</span></button>
  </div>
</div>
<script>
async function autoDetect() {
  var btn = document.getElementById("detect-btn");
  btn.textContent = "Detecting...";
  btn.disabled = true;
  try {
    var r = await fetch("/admin/api/autodetect");
    var d = await r.json();
    var candidates = d.candidates || [];
    var sel = document.getElementById("dir-sel");
    sel.innerHTML = "";
    if (candidates.length > 0) {
      sel.style.display = "block";
      candidates.forEach(function(c) {
        var opt = document.createElement("option");
        opt.value = c; opt.textContent = c;
        sel.appendChild(opt);
      });
      document.getElementById("sdr-dir").value = candidates[0];
      btn.textContent = "Found " + candidates.length + " candidate(s)";
    } else {
      btn.textContent = "Nothing found — enter path manually";
    }
  } catch(e) { btn.textContent = "Detection failed"; }
  btn.disabled = false;
}
function dirSelChange() {
  var v = document.getElementById("dir-sel").value;
  if (v) document.getElementById("sdr-dir").value = v;
}
function showErr(msg) {
  var el = document.getElementById("err-box");
  el.textContent = msg; el.style.display = "block";
  document.getElementById("ok-box").style.display = "none";
}
async function completeSetup() {
  document.getElementById("err-box").style.display = "none";
  var dir = document.getElementById("sdr-dir").value.trim();
  var pn  = document.getElementById("proc-name").value.trim() || "spectrumserver";
  var pp  = parseInt(document.getElementById("pub-port").value) || 8900;
  var pw  = document.getElementById("new-pwd").value;
  var pw2 = document.getElementById("new-pwd2").value;
  if (!dir)          { showErr("SDR base directory is required"); return; }
  if (!pw)           { showErr("Password is required"); return; }
  if (pw.length < 4) { showErr("Password must be at least 4 characters"); return; }
  if (pw !== pw2)    { showErr("Passwords do not match"); return; }
  var btn = document.getElementById("setup-btn");
  btn.disabled = true; btn.textContent = "Saving...";
  try {
    var r = await fetch("/admin/api/setup", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({sdr_base_dir: dir, sdr_process_name: pn,
                            public_port: pp, new_password: pw})
    });
    var d = await r.json();
    if (d.ok) {
      document.getElementById("ok-box").style.display = "block";
      btn.style.display = "none";
      setTimeout(function() { window.location.href = "/admin/dashboard"; }, 1200);
    } else {
      showErr(d.msg || "Setup failed");
      btn.disabled = false; btn.textContent = "&#9654; COMPLETE SETUP_";
    }
  } catch(e) {
    showErr("Network error: " + e.message);
    btn.disabled = false; btn.textContent = "&#9654; COMPLETE SETUP_";
  }
}
autoDetect();
</script>
</body>
</html>"""

MAIN_HTML = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>PhantomSDR Admin Panel</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Orbitron:wght@400;700;900&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0;padding:0}
:root{
  --green:#00ff41;--green2:#00cc33;--amber:#ffb000;--red:#ff4040;--blue:#00ccff;
  --bg:#050a05;--panel:#0a150a;--panel2:#0d1a0d;--border:#1a3a1a;--dim:#1f3a1f;
  --text:#c8ffc8;--text2:#7ab87a;--text3:#4a8a4a;
  --glow:0 0 8px #00ff4155,0 0 20px #00ff4122;
  --glow-amber:0 0 8px #ffb00055,0 0 20px #ffb00022;
  --glow-red:0 0 8px #ff404055;
}
html,body{height:100%;background:var(--bg);font-family:'Share Tech Mono',monospace;
  color:var(--text);font-size:20px;}
body{background-image:repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,255,65,0.01) 2px,rgba(0,255,65,0.01) 4px);}

/* Layout */
.layout{display:flex;height:100vh;overflow:hidden;}
.sidebar{width:220px;min-width:220px;background:var(--panel);border-right:1px solid var(--border);
  display:flex;flex-direction:column;overflow-y:auto;}
.main{flex:1;overflow:hidden;display:flex;flex-direction:column;}
.topbar{background:var(--panel);border-bottom:1px solid var(--border);
  padding:.7rem 1.2rem;display:flex;align-items:center;justify-content:space-between;}
.content{flex:1;overflow-y:auto;padding:1.4rem;}

/* Sidebar */
.sidebar-logo{padding:1.2rem 1rem;border-bottom:1px solid var(--border);text-align:center;}
.sidebar-logo .title{font-family:'Orbitron',sans-serif;font-weight:900;font-size:1rem;
  color:var(--green);text-shadow:var(--glow);}
.sidebar-logo .sub{font-size:.6rem;color:var(--text3);letter-spacing:.3em;margin-top:.2rem;}
.sidebar-logo .icon{font-size:1.8rem;margin-bottom:.3rem;filter:drop-shadow(0 0 8px #00ff41);}

.nav-section{padding:.5rem 0;}
.nav-label{font-size:.55rem;color:var(--text3);letter-spacing:.3em;padding:.4rem 1rem .2rem;}
.nav-item{display:flex;align-items:center;gap:.6rem;padding:.55rem 1rem;
  cursor:pointer;color:var(--text2);transition:.15s;border-left:2px solid transparent;
  text-decoration:none;font-size:.8rem;}
.nav-item:hover{color:var(--green);background:rgba(0,255,65,0.05);border-left-color:var(--green2);}
.nav-item.active{color:var(--green);background:rgba(0,255,65,0.08);
  border-left-color:var(--green);text-shadow:var(--glow);}
.nav-item .icon{font-size:1rem;width:1.2rem;text-align:center;}

.sidebar-footer{margin-top:auto;padding:.8rem 1rem;border-top:1px solid var(--border);
  font-size:.65rem;color:var(--text3);}

/* Topbar */
.topbar-title{font-family:'Orbitron',sans-serif;font-size:.85rem;color:var(--green);}
.status-pill{display:inline-flex;align-items:center;gap:.4rem;
  padding:.3rem .7rem;border-radius:2px;font-size:.7rem;}
.status-pill.online{background:rgba(0,255,65,0.1);border:1px solid #00ff4155;color:var(--green);}
.status-pill.offline{background:rgba(255,64,64,0.1);border:1px solid #ff404055;color:var(--red);}
.status-dot{width:6px;height:6px;border-radius:50%;animation:pulse 2s infinite;}
.status-dot.online{background:var(--green);box-shadow:0 0 6px var(--green);}
.status-dot.offline{background:var(--red);}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}

.topbar-right{display:flex;align-items:center;gap:1rem;}
.topbar-time{font-size:.7rem;color:var(--text3);}
.logout-btn{font-size:.65rem;color:var(--text3);text-decoration:none;
  padding:.2rem .5rem;border:1px solid var(--border);border-radius:2px;transition:.15s;}
.logout-btn:hover{color:var(--red);border-color:#ff404055;}

/* Cards */
.grid{display:grid;gap:1rem;}
.grid-2{grid-template-columns:1fr 1fr;}
.grid-3{grid-template-columns:1fr 1fr 1fr;}
.grid-4{grid-template-columns:repeat(4,1fr);}
.grid-5{grid-template-columns:repeat(5,1fr);}

.card{background:var(--panel);border:1px solid var(--border);border-radius:3px;padding:1rem;}
.card-header{font-family:'Orbitron',sans-serif;font-size:.7rem;color:var(--text2);
  letter-spacing:.15em;margin-bottom:.8rem;display:flex;align-items:center;gap:.5rem;}
.card-header .dot{width:6px;height:6px;border-radius:50%;background:var(--green);
  box-shadow:0 0 6px var(--green);}

/* Stat cards */
.stat-val{font-family:'Orbitron',sans-serif;font-size:1.6rem;font-weight:700;
  color:var(--green);text-shadow:var(--glow);}
.stat-label{font-size:.65rem;color:var(--text3);margin-top:.2rem;letter-spacing:.1em;}
.stat-sub{font-size:.7rem;color:var(--text2);margin-top:.3rem;}

/* Load/temperature thresholds. These are NOT the terminal palette above: they
   are the web UI's colours (App.svelte), so the same reading looks the same in
   both places.  The chrome stays green; only the numbers that mean "hot" move. */
:root{--stat-ok:#4ade80;--stat-warn:#fbbf24;--stat-bad:#ef4444;}

/* Progress bars */
.bar-wrap{background:#071207;border-radius:2px;height:6px;margin-top:.5rem;overflow:hidden;}
.bar-fill{height:100%;border-radius:2px;transition:.5s;background:var(--stat-ok);}
.bar-fill.warn{background:var(--stat-warn);}
.bar-fill.danger{background:var(--stat-bad);}

/* Buttons */
.btn{display:inline-flex;align-items:center;gap:.4rem;padding:.5rem .9rem;
  font-family:'Share Tech Mono',monospace;font-size:.75rem;cursor:pointer;
  border-radius:2px;transition:.15s;border:1px solid;background:transparent;letter-spacing:.05em;}
.btn-green{color:var(--green);border-color:#00ff4155;}
.btn-green:hover{background:rgba(0,255,65,0.1);box-shadow:var(--glow);}
.btn-red{color:var(--red);border-color:#ff404055;}
.btn-red:hover{background:rgba(255,64,64,0.1);box-shadow:var(--glow-red);}
.btn-amber{color:var(--amber);border-color:#ffb00055;}
.btn-amber:hover{background:rgba(255,176,0,0.1);box-shadow:var(--glow-amber);}
.btn-blue{color:var(--blue);border-color:#00ccff55;}
.btn-blue:hover{background:rgba(0,204,255,0.1);}
.btn-lg{padding:.7rem 1.4rem;font-size:.85rem;}
.btn:disabled{opacity:.4;cursor:not-allowed;}
/* Range picker on the Graphs page: the selected range must read as chosen, not
   merely hovered, so it gets the filled state the other buttons only borrow. */
.btn.graph-range{color:var(--text2);border-color:var(--border);}
.btn.graph-range:hover{color:var(--green);border-color:#00ff4155;}
.btn.graph-range.active{color:var(--green);border-color:#00ff4188;
  background:rgba(0,255,65,0.08);box-shadow:var(--glow);}
/* Larger type on the Graphs page only — these are readings meant to be read
   from across the room, not the dense label text the other pages use.  Scoped
   to #page-graphs so the shared card classes keep their sizing elsewhere. */
#page-graphs .card-header{font-size:.78rem;}
#page-graphs .stat-val{font-size:2rem;}
#page-graphs .stat-label{font-size:.78rem;}
#page-graphs .btn.graph-range{font-size:.82rem;padding:.55rem 1rem;}

/* Per-decoder spot tiles (Spot Reporting page) */
.ar-spot-tile{background:#071007;border:1px solid var(--border);border-radius:3px;
  padding:.6rem .7rem;text-align:center;}
.ar-spot-mode{font-family:'Orbitron',sans-serif;font-size:.72rem;color:var(--text2);
  letter-spacing:.18em;}
.ar-spot-count{font-family:'Orbitron',sans-serif;font-size:1.7rem;font-weight:700;
  color:var(--green);text-shadow:var(--glow);margin:.15rem 0 .1rem;}
.ar-spot-count.idle{color:var(--text3);text-shadow:none;}
.ar-spot-sub{font-size:.63rem;color:var(--text3);letter-spacing:.05em;line-height:1.5;}
/* Uploaded-count badge next to each mode in the bands/modes header */
.ar-hdr-badge{display:inline-block;margin-left:.35rem;padding:0 .35rem;border-radius:2px;
  font-family:'Share Tech Mono',monospace;font-size:.62rem;letter-spacing:0;
  background:rgba(0,255,65,0.12);color:var(--green);border:1px solid #00ff4144;}
.ar-hdr-badge:empty{display:none;}
/* All-time spot count printed beside each band/mode checkbox */
/* Sits tight against its own checkbox: the count belongs to that one slot, and
   a wide gap lets the eye pair it with the neighbouring column instead. The
   checkbox loses its default margin for the same reason. */
/* table.markers input sets width:100% for the text inputs on the Markers page.
   Inherited by these checkboxes it stretched each one across its whole cell,
   which shoved the count to the far right of the column — and off the edge
   entirely in the last one, so WSPR's numbers sat in the horizontal overflow. */
#ar-matrix input[type=checkbox]{width:auto;margin:0;vertical-align:middle;}
.ar-slot-tot{margin-left:.5rem;vertical-align:middle;
  font-family:'Share Tech Mono',monospace;font-size:.74rem;
  color:var(--green);text-shadow:0 0 6px #00ff4188;}
/* Decodes with nothing uploaded yet — amber rather than a dim grey: it is a
   normal waiting state (PSK Reporter only flushes every 5 min), so it should be
   as readable as the uploaded count, just distinguishable from it. */
.ar-slot-tot.none{color:var(--amber);text-shadow:0 0 6px #ffb00077;}
.ar-slot-tot:empty{display:none;}

/* Server control card */
.sdr-control{display:flex;gap:1rem;flex-wrap:wrap;align-items:flex-start;}
.sdr-info{flex:1;min-width:200px;}
.sdr-info p{margin:.3rem 0;font-size:.75rem;color:var(--text2);}
.sdr-info .val{color:var(--green);}
.sdr-btns{display:flex;flex-direction:column;gap:.5rem;}
.script-select{background:#071207;border:1px solid var(--border);color:var(--text);
  font-family:'Share Tech Mono',monospace;font-size:.75rem;padding:.4rem .6rem;
  border-radius:2px;width:100%;margin-bottom:.5rem;}
.script-select:focus{border-color:var(--green);outline:none;}

/* Editor */
.editor-toolbar{display:flex;gap:.5rem;align-items:center;flex-wrap:wrap;margin-bottom:.7rem;}
.file-select{background:#071207;border:1px solid var(--border);color:var(--text);
  font-family:'Share Tech Mono',monospace;font-size:.75rem;padding:.4rem .7rem;
  border-radius:2px;flex:1;}
.file-select:focus{outline:none;border-color:var(--green);}
textarea.code{width:100%;background:#030803;border:1px solid var(--border);color:#c8ffc8;
  font-family:'Share Tech Mono',monospace;font-size:.75rem;line-height:1.6;
  padding:.8rem;border-radius:3px;resize:vertical;outline:none;
  min-height:400px;transition:.2s;}
textarea.code:focus{border-color:var(--green);box-shadow:var(--glow);}

/* Toast */
#toast{position:fixed;bottom:1.5rem;right:1.5rem;z-index:9999;display:flex;
  flex-direction:column;gap:.4rem;}
.toast{padding:.6rem 1rem;border-radius:3px;font-size:.75rem;
  animation:toastIn .3s ease;border:1px solid;}
.toast.ok{background:rgba(0,255,65,0.12);border-color:#00ff4155;color:var(--green);}
.toast.err{background:rgba(255,64,64,0.12);border-color:#ff404055;color:var(--red);}
@keyframes toastIn{from{opacity:0;transform:translateX(20px)}to{opacity:1;transform:none}}

/* Log viewer */
.log-box{background:#030803;border:1px solid var(--border);border-radius:3px;
  padding:.8rem;font-size:.7rem;line-height:1.8;height:400px;overflow-y:auto;
  color:var(--text2);word-break:break-all;}
.log-box::-webkit-scrollbar{width:4px;}
.log-box::-webkit-scrollbar-track{background:var(--bg);}
.log-box::-webkit-scrollbar-thumb{background:var(--dim);}
.log-line-err{color:var(--red);}
.log-line-warn{color:var(--amber);}
.log-line-ok{color:var(--green);}

/* Tabs inside sections */
.tab-bar{display:flex;flex-wrap:wrap;border-bottom:1px solid var(--border);margin-bottom:1rem;}
.tab{padding:.5rem 1rem;font-size:.7rem;cursor:pointer;color:var(--text3);
  border-bottom:2px solid transparent;transition:.15s;letter-spacing:.1em;}
.tab.active{color:var(--green);border-bottom-color:var(--green);}
.tab-pane{display:none;}
.tab-pane.active{display:block;}

/* Section heading */
.section-head{font-family:'Orbitron',sans-serif;font-size:.8rem;color:var(--green);
  letter-spacing:.15em;margin-bottom:1rem;padding-bottom:.5rem;
  border-bottom:1px solid var(--border);}

/* JSON editor helpers */
.json-path{font-size:.65rem;color:var(--text3);margin-bottom:.5rem;}

input[type=text],input[type=password],input[type=number]{
  background:#071207;border:1px solid var(--border);color:var(--text);
  font-family:'Share Tech Mono',monospace;font-size:.8rem;padding:.4rem .7rem;
  border-radius:2px;outline:none;transition:.15s;}
input:focus{border-color:var(--green);box-shadow:0 0 6px #00ff4122;}

/* Chat history */
.chat-log{background:#030803;border:1px solid var(--border);border-radius:3px;
  padding:.8rem;font-size:.75rem;line-height:2;height:500px;overflow-y:auto;}
.chat-msg{display:flex;align-items:baseline;gap:.5rem;border-bottom:1px solid #0a1a0a;padding:.3rem 0;}
.chat-msg-text{flex:1;}
.chat-nick{color:var(--amber);}
.chat-time{color:var(--text3);font-size:.65rem;}
.chat-del-btn{flex-shrink:0;background:transparent;border:1px solid #ff404044;color:#ff6060;
  font-family:'Share Tech Mono',monospace;font-size:.6rem;padding:.1rem .4rem;border-radius:2px;
  cursor:pointer;transition:.15s;line-height:1.4;}
.chat-del-btn:hover{background:rgba(255,64,64,0.15);border-color:#ff404088;}

/* Top processes table */
table.top-procs{width:100%;border-collapse:collapse;font-size:.72rem;}
table.top-procs th{color:var(--text3);font-weight:normal;letter-spacing:.1em;
  padding:.35rem .5rem;border-bottom:1px solid var(--border);text-align:left;white-space:nowrap;}
table.top-procs td{padding:.3rem .5rem;border-bottom:1px solid #0a1a0a;
  white-space:nowrap;overflow:hidden;max-width:200px;text-overflow:ellipsis;}
table.top-procs tr:hover td{background:rgba(0,255,65,0.04);}
table.top-procs .cpu-hi{color:var(--stat-bad);}
table.top-procs .cpu-med{color:var(--stat-warn);}
table.top-procs .cpu-ok{color:var(--stat-ok);}
table.top-procs .mem-col{color:var(--blue);}

/* ── Mobile Bottom Nav Bar ──────────────────────────────────── */
.bottom-nav{display:none;}
.hamburger{display:none;}
.sidebar-backdrop{display:none;position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:199;}
.sidebar-backdrop.open{display:block;}

@media(max-width:768px){
  /* Hide desktop sidebar, show bottom nav */
  .sidebar{display:none !important;}
  .hamburger{display:none !important;}

  /* Layout: vertical stack, leave room for bottom nav */
  .layout{flex-direction:column;}
  .main{height:100vh;display:flex;flex-direction:column;}
  .content{flex:1;overflow-y:auto;padding:.6rem;padding-bottom:70px;}

  /* Topbar */
  .topbar{padding:.5rem .8rem;gap:.5rem;}
  .topbar-title{font-size:.8rem;flex:1;}
  .topbar-time{display:none;}
  .status-pill{padding:.2rem .5rem;font-size:.65rem;}

  /* Bottom navigation bar */
  .bottom-nav{
    display:flex;position:fixed;bottom:0;left:0;right:0;z-index:100;
    background:var(--panel);border-top:1px solid var(--border);
    height:58px;align-items:stretch;
    box-shadow:0 -4px 20px rgba(0,0,0,.5);
  }
  .bottom-nav a{
    flex:1;display:flex;flex-direction:column;align-items:center;
    justify-content:center;gap:2px;color:var(--text3);text-decoration:none;
    font-size:.5rem;letter-spacing:.05em;border-top:2px solid transparent;
    transition:.15s;padding:.3rem .1rem;min-width:0;
    -webkit-tap-highlight-color:transparent;
  }
  .bottom-nav a .bi{font-size:1.3rem;line-height:1;}
  .bottom-nav a span{font-size:.48rem;letter-spacing:.02em;white-space:nowrap;}
  .bottom-nav a.active{color:var(--green);border-top-color:var(--green);}
  .bottom-nav a:active{background:rgba(0,255,65,0.08);}

  /* Grids → single column */
  .grid-2,.grid-3,.grid-4,.grid-5{grid-template-columns:1fr !important;}

  /* Cards */
  .card{padding:.7rem;overflow-x:auto;}

  /* Stat values */
  .stat-val{font-size:1.3rem;}

  /* Buttons — full width on mobile for easy tapping */
  .btn{padding:.7rem 1rem;font-size:.85rem;min-height:44px;}
  .btn-lg{padding:.8rem 1.2rem;font-size:.9rem;}

  /* Form controls — larger for touch */
  .script-select,.file-select,
  input[type=text],input[type=password],input[type=number]{
    font-size:1rem;padding:.6rem .8rem;min-height:44px;}
  select{min-height:44px;}

  /* Log boxes */
  .log-box{height:220px !important;font-size:.7rem;}

  /* Tables: horizontal scroll */
  table.markers,table.top-procs{min-width:420px;}

  /* Textarea */
  textarea.code{min-height:200px;font-size:.8rem;}

  /* Toast position above bottom nav */
  #toast{bottom:70px;}

  /* Section heading */
  .section-head{font-size:.75rem;}
}

@media(max-width:390px){
  .bottom-nav a .bi{font-size:1.1rem;}
  .bottom-nav a span{display:none;}
  .bottom-nav{height:52px;}
  .content{padding-bottom:60px;}
}

.scanlines{pointer-events:none;position:fixed;inset:0;
  background:repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(0,0,0,0.06) 3px,rgba(0,0,0,0.06) 4px);
  z-index:9999;}

/* Pages */
.page{display:none;}
.page.active{display:block;}

/* Markers table */
table.markers{width:100%;border-collapse:collapse;font-size:.75rem;}
table.markers th{color:var(--text3);font-weight:normal;letter-spacing:.1em;
  padding:.4rem .6rem;border-bottom:1px solid var(--border);text-align:left;}
table.markers td{padding:.4rem .6rem;border-bottom:1px solid #0a1a0a;vertical-align:middle;}
table.markers tr:hover td{background:rgba(0,255,65,0.03);}
table.markers input{width:100%;background:transparent;border:none;
  color:var(--text);font-family:'Share Tech Mono',monospace;font-size:.75rem;}
table.markers input:focus{background:#071207;outline:1px solid var(--border);}
</style>
</head>
<body>
<div class="scanlines"></div>
<div class="layout">
  <!-- Sidebar -->
  <div class="sidebar">
    <div class="sidebar-logo">
      <div class="icon">📡</div>
      <div class="title">PHANTOM<span style="color:var(--amber)">SDR</span></div>
      <div class="sub">ADMIN v4.1.0</div>
    </div>
    <div class="nav-section">
      <div class="nav-label">MAIN</div>
      <a class="nav-item active" onclick="showPage('dashboard',this)" href="#">
        <span class="icon">⬡</span><span>Dashboard</span>
      </a>
    </div>
    <div class="nav-section">
      <div class="nav-label">CONFIGURATION</div>
      <a class="nav-item" onclick="showPage('config',this)" href="#">
        <span class="icon">⚙</span><span>Config Editor</span>
      </a>
      <a class="nav-item" onclick="showPage('siteinfo',this)" href="#">
        <span class="icon">◎</span><span>Site Info</span>
      </a>
      <a class="nav-item" onclick="showPage('markers',this)" href="#">
        <span class="icon">◉</span><span>Markers</span>
      </a>
      <a class="nav-item" onclick="showPage('reporting',this)" href="#">
        <span class="icon">📶</span><span>Spot Reporting</span>
      </a>
    </div>
    <div class="nav-section">
      <div class="nav-label">MONITORING</div>
      <a class="nav-item" onclick="showPage('logs',this)" href="#">
        <span class="icon">▤</span><span>Log Viewer</span>
      </a>
      <a class="nav-item" onclick="showPage('chat',this)" href="#">
        <span class="icon">◫</span><span>Chat History</span>
      </a>
      <a class="nav-item" onclick="showPage('graphs',this)" href="#">
        <span class="icon">📈</span><span>Graphs</span>
      </a>
      <a class="nav-item" onclick="showPage('users',this)" href="#">
        <span class="icon">👥</span><span>Users</span>
      </a>
      <a class="nav-item" onclick="showPage('wfmsg',this)" href="#">
        <span class="icon">📢</span><span>WF Message</span>
      </a>
    </div>
    <div class="nav-section">
      <div class="nav-label">SYSTEM</div>
      <a class="nav-item" onclick="showPage('settings',this)" href="#">
        <span class="icon">◧</span><span>Settings</span>
      </a>
    </div>
    <div class="sidebar-footer">
      PhantomSDR-Plus<br>Admin Panel
    </div>
  </div>

  <!-- Main -->
  <div class="main">
    <div class="topbar">
      <div class="topbar-title" id="page-title">DASHBOARD</div>
      <div class="topbar-right">
        <div id="sdr-status" class="status-pill offline">
          <div class="status-dot offline"></div>
          <span>OFFLINE</span>
        </div>
        <div class="topbar-time" id="clock">--:--:--</div>
        <a class="logout-btn" href="/admin/logout">⏻ LOGOUT</a>
      </div>
    </div>

    <div class="content">

      <!-- ══════ DASHBOARD PAGE ══════ -->
      <div class="page active" id="page-dashboard">
        <div class="grid grid-5" style="margin-bottom:1rem;">
          <div class="card">
            <div class="card-header"><div class="dot"></div>SDR STATUS</div>
            <div class="stat-val" id="stat-status">--</div>
            <div class="stat-label">PROCESS STATE</div>
            <div class="stat-sub" id="stat-pid">PID: --</div>
          </div>
          <div class="card">
            <div class="card-header"><div class="dot" style="background:var(--amber);box-shadow:0 0 6px var(--amber)"></div>CPU USAGE</div>
            <div class="stat-val" id="stat-cpu">--%</div>
            <div class="stat-label">SYSTEM CPU</div>
            <div class="bar-wrap"><div class="bar-fill" id="bar-cpu" style="width:0%"></div></div>
          </div>
          <div class="card">
            <div class="card-header"><div class="dot" style="background:var(--blue);box-shadow:0 0 6px var(--blue)"></div>MEMORY</div>
            <div class="stat-val" id="stat-mem">-- GB</div>
            <div class="stat-label">USED / TOTAL</div>
            <div class="bar-wrap"><div class="bar-fill" id="bar-mem" style="width:0%"></div></div>
          </div>
          <div class="card">
            <div class="card-header"><div class="dot" style="background:#ff88ff;box-shadow:0 0 6px #ff88ff"></div>DISK</div>
            <div class="stat-val" id="stat-disk">-- GB</div>
            <div class="stat-label">USED / TOTAL</div>
            <div class="bar-wrap"><div class="bar-fill" id="bar-disk" style="width:0%"></div></div>
          </div>
          <div class="card">
            <div class="card-header"><div class="dot" style="background:#ff4444;box-shadow:0 0 6px #ff4444"></div>TEMPERATURE</div>
            <div class="stat-val" id="stat-temp">--&#176;C</div>
            <div class="stat-label">CPU TEMP</div>
            <div class="bar-wrap"><div class="bar-fill" id="bar-temp" style="width:0%;background:linear-gradient(90deg,#4ade80,#fbbf24,#ef4444)"></div></div>
            <div class="stat-sub" id="stat-temp-guard" style="margin-top:.3rem;">GUARD: --</div>
          </div>
        </div>

        <!-- ══════ WEBSDR DIVERSITY RELAY ══════ -->
        <div class="card" id="relay-card" style="margin-bottom:1rem;display:none;">
          <div class="card-header">
            <div class="dot" id="rl-dot" style="background:var(--text3);box-shadow:none"></div>
            WEBSDR DIVERSITY RELAY
            <span style="margin-left:auto;font-size:.6rem;color:var(--text3);" id="rl-ua"></span>
          </div>
          <div class="grid grid-4" style="gap:.6rem;margin-bottom:.6rem;">
            <div><div style="font-size:.6rem;color:var(--text3);">STATE</div>
                 <div id="rl-state" style="font-size:.9rem;color:var(--green);">--</div></div>
            <div><div style="font-size:.6rem;color:var(--text3);">PORT</div>
                 <div id="rl-port" style="font-size:.9rem;color:var(--text);">--</div></div>
            <div><div style="font-size:.6rem;color:var(--text3);">SESSIONS</div>
                 <div id="rl-sessions" style="font-size:.9rem;color:var(--amber);">--</div></div>
            <div><div style="font-size:.6rem;color:var(--text3);">CAP PER SITE</div>
                 <div id="rl-cap" style="font-size:.9rem;color:var(--text);">--</div></div>
          </div>
          <div id="rl-hosts" style="font-size:.7rem;color:var(--text2);"></div>
          <div id="rl-reason" style="font-size:.65rem;color:var(--text3);margin-top:.3rem;"></div>
        </div>

        <!-- ══════ THERMAL GUARD ══════ -->
        <div class="card" id="thermal-card" style="margin-bottom:1rem;display:none;">
          <div class="card-header">
            <div class="dot" id="tg-dot" style="background:#ff4444;box-shadow:0 0 6px #ff4444"></div>
            THERMAL GUARD
            <span style="margin-left:auto;font-size:.6rem;color:var(--text3);" id="tg-sensor"></span>
          </div>
          <div class="grid grid-4" style="gap:.6rem;margin-bottom:.6rem;">
            <div><div style="font-size:.6rem;color:var(--text3);">STATE</div>
                 <div id="tg-state" style="font-size:.9rem;color:var(--green);">--</div></div>
            <div><div style="font-size:.6rem;color:var(--text3);">MODE</div>
                 <div id="tg-mode" style="font-size:.9rem;color:var(--text);">--</div></div>
            <div><div style="font-size:.6rem;color:var(--text3);">STOPS AT</div>
                 <div id="tg-stop" style="font-size:.9rem;color:var(--amber);">--</div></div>
            <div><div style="font-size:.6rem;color:var(--text3);">RESUMES AT</div>
                 <div id="tg-resume" style="font-size:.9rem;color:var(--blue);">--</div></div>
          </div>
          <div id="tg-reason" style="font-size:.7rem;color:var(--text2);margin-bottom:.4rem;"></div>
          <div id="tg-last" style="font-size:.68rem;color:var(--text3);font-family:'Share Tech Mono',monospace;word-break:break-word;"></div>
          <div style="margin-top:.6rem;">
            <button class="btn btn-amber" style="padding:.2rem .6rem;font-size:.65rem;"
                    onclick="thermalReset()">CLEAR LOCKOUT</button>
            <span style="font-size:.6rem;color:var(--text3);margin-left:.5rem;">
              thresholds and mode are in Settings</span>
          </div>
        </div>

        <div class="card" style="margin-bottom:1rem;">
          <div class="card-header">
            <div class="dot" style="background:var(--green);box-shadow:0 0 6px var(--green)"></div>
            TERMINAL
            <span style="margin-left:.4rem;font-size:.6rem;color:var(--text3);" id="term-cwd">~</span>
            <span style="margin-left:auto;font-size:.6rem;color:var(--text3);cursor:pointer;" onclick="termClear()">&#10005; CLEAR</span>
          </div>
          <div id="term-output"
            style="font-family:'Share Tech Mono',monospace;font-size:.75rem;line-height:1.5;
                   background:#020902;border:1px solid var(--border);border-radius:3px;
                   padding:.5rem .7rem;height:300px;overflow-y:auto;color:var(--text);
                   white-space:pre-wrap;word-break:break-all;"></div>
          <div style="display:flex;align-items:center;gap:.4rem;margin-top:.4rem;
                      background:#020902;border:1px solid var(--border);border-radius:3px;padding:.3rem .6rem;">
            <span style="color:var(--green);font-size:.75rem;flex-shrink:0;">$</span>
            <input id="term-input" type="text" autocomplete="off" spellcheck="false"
              style="flex:1;background:transparent;border:none;outline:none;
                     color:var(--green);font-family:'Share Tech Mono',monospace;font-size:.75rem;"
              placeholder="type command and press Enter"
              onkeydown="termKey(event)">
            <button class="btn btn-green" style="padding:.2rem .6rem;font-size:.65rem;" onclick="termRun()">&#9654;</button>
          </div>
        </div>
        
        <div class="grid grid-2" style="margin-bottom:1rem;">
          <div class="card">
            <div class="card-header">
              <div class="dot"></div>RECENT LOG OUTPUT
              <span style="margin-left:auto;font-size:.6rem;color:var(--text3);cursor:pointer;" onclick="loadLogs('dash-log')">↻ refresh</span>
            </div>
            <div class="log-box" id="dash-log" style="height:280px;">Loading...</div>
          </div>
          <div class="card">
            <div class="card-header">
              <div class="dot" style="background:var(--amber);box-shadow:0 0 6px var(--amber)"></div>
              TOP PROCESSES
              <span style="margin-left:auto;font-size:.6rem;color:var(--text3);cursor:pointer;" onclick="updateStatus()">↻ refresh</span>
            </div>
            <table class="top-procs">
              <thead>
                <tr>
                  <th>PID</th><th>NAME</th><th>USER</th><th>CPU%</th><th>MEM%</th>
                </tr>
              </thead>
              <tbody id="top-procs-tbody">
                <tr><td colspan="5" style="color:var(--text3);text-align:center;">Loading...</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- ══════ CONFIG EDITOR PAGE ══════ -->
      <div class="page" id="page-config">
        <div class="section-head">FILE EDITOR</div>
        <div class="editor-toolbar">
          <select class="file-select" id="config-file-sel" onchange="loadConfigFile()" style="flex:1;min-width:0;"></select>
          <button class="btn btn-blue" onclick="loadConfigList(true)">🔄 RESCAN</button>
          <button class="btn btn-blue" onclick="loadConfigFile()">↻ RELOAD</button>
          <button class="btn btn-green" onclick="saveConfigFile()">💾 SAVE</button>
        </div>
        <div class="json-path" id="config-filepath">--</div>
        <textarea class="code" id="config-editor" rows="32" spellcheck="false" placeholder="Select a file to edit..."></textarea>
        <div style="margin-top:.5rem;display:flex;gap:.5rem;align-items:center;">
          <button class="btn btn-green" onclick="saveConfigFile()">💾 SAVE FILE</button>
          <span style="font-size:.65rem;color:var(--text3);margin-left:.5rem;" id="config-save-msg"></span>
        </div>
      </div>

      <!-- ══════ SITE INFO PAGE ══════ -->
      <div class="page" id="page-siteinfo">
        <div class="section-head">SITE INFORMATION EDITOR</div>
        <div class="editor-toolbar">
          <select class="file-select" id="json-file-sel" onchange="loadJsonFile()"></select>
          <button class="btn btn-blue" onclick="loadJsonFile()">↻ RELOAD</button>
        </div>
        <div class="tab-bar">
          <div class="tab active" onclick="switchJsonTab('form',this)">FORM VIEW</div>
          <div class="tab" onclick="switchJsonTab('raw',this)">RAW JSON</div>
        </div>
        <div class="tab-pane active" id="json-form-pane">
          <div id="json-form-fields" style="display:grid;grid-template-columns:1fr 1fr;gap:.6rem;"></div>
          <div style="margin-top:.8rem;display:flex;gap:.5rem;">
            <button class="btn btn-green" onclick="saveJsonForm()">💾 SAVE CHANGES</button>
            <span id="json-save-msg" style="font-size:.65rem;color:var(--text3);margin-left:.5rem;"></span>
          </div>
        </div>
        <div class="tab-pane" id="json-raw-pane">
          <textarea class="code" id="json-raw-editor" rows="25" spellcheck="false"></textarea>
          <div style="margin-top:.5rem;">
            <button class="btn btn-green" onclick="saveJsonRaw()">💾 SAVE RAW JSON</button>
          </div>
        </div>
      </div>

      <!-- ══════ MARKERS PAGE ══════ -->
      <div class="page" id="page-markers">
        <div class="section-head">FREQUENCY MARKERS EDITOR</div>
        <div style="margin-bottom:.8rem;display:flex;gap:.5rem;flex-wrap:wrap;">
          <button class="btn btn-green" onclick="addMarker()">+ ADD MARKER</button>
          <button class="btn btn-amber" onclick="saveMarkers()">💾 SAVE MARKERS</button>
          <button class="btn btn-blue" onclick="loadMarkers()">↻ RELOAD</button>
          <span id="markers-save-msg" style="font-size:.65rem;color:var(--text3);margin:auto 0;"></span>
        </div>
        <div class="card" style="overflow-x:auto;">
          <table class="markers">
            <thead>
              <tr>
                <th>FREQUENCY (Hz)</th><th>NAME</th><th>MODE</th><th>COLOR</th><th>ACTION</th>
              </tr>
            </thead>
            <tbody id="markers-tbody"></tbody>
          </table>
        </div>
        <div style="margin-top:.8rem;">
          <div class="card-header"><div class="dot"></div>RAW JSON PREVIEW</div>
          <textarea class="code" id="markers-raw" rows="10" readonly style="opacity:.7;"></textarea>
        </div>
      </div>

      <!-- ══════ SPOT REPORTING PAGE ══════ -->
      <div class="page" id="page-reporting">
        <div class="section-head">SPOT REPORTING &#183; AUTORUN</div>

        <div class="card" style="margin-bottom:.9rem;">
          <div class="card-header"><div class="dot" id="ar-dot"></div><span id="ar-state">&#8212;</span></div>
          <div id="ar-status" style="font-size:.7rem;color:var(--text2);line-height:1.7;">&#8212;</div>
          <div style="margin-top:.8rem;display:flex;gap:.5rem;flex-wrap:wrap;">
            <button class="btn btn-green" onclick="autorunStart()">&#9654; START</button>
            <button class="btn btn-red" onclick="autorunStop()">&#9632; STOP</button>
            <button class="btn btn-amber" onclick="autorunSave()">&#128190; SAVE CONFIG</button>
            <button class="btn btn-blue" onclick="autorunLoad()">&#8635; RELOAD</button>
            <button class="btn btn-red" onclick="autorunFreeAll()">&#10005; FREE ALL SLOTS</button>
            <span id="ar-msg" style="font-size:.65rem;color:var(--text3);margin:auto 0;"></span>
          </div>
        </div>

        <!-- Per-decoder spot tally.  The aggregate PSK Reporter figure above
             cannot separate FT8, FT4 and JS8 (they share one upload queue), so
             the daemon counts them separately and reports them here. -->
        <div class="card" style="margin-bottom:.9rem;">
          <div class="card-header"><div class="dot"></div>SPOTS UPLOADED PER DECODER</div>
          <div class="grid grid-4" id="ar-spots-grid">
            <div class="ar-spot-tile">
              <div class="ar-spot-mode">FT8</div>
              <div class="ar-spot-count" id="ar-up-ft8">&#8212;</div>
              <div class="ar-spot-sub" id="ar-sub-ft8">&#8212;</div>
            </div>
            <div class="ar-spot-tile">
              <div class="ar-spot-mode">FT4</div>
              <div class="ar-spot-count" id="ar-up-ft4">&#8212;</div>
              <div class="ar-spot-sub" id="ar-sub-ft4">&#8212;</div>
            </div>
            <div class="ar-spot-tile">
              <div class="ar-spot-mode">JS8</div>
              <div class="ar-spot-count" id="ar-up-js8">&#8212;</div>
              <div class="ar-spot-sub" id="ar-sub-js8">&#8212;</div>
            </div>
            <div class="ar-spot-tile">
              <div class="ar-spot-mode">WSPR</div>
              <div class="ar-spot-count" id="ar-up-wspr">&#8212;</div>
              <div class="ar-spot-sub" id="ar-sub-wspr">&#8212;</div>
            </div>
          </div>
          <p style="color:var(--text3);font-size:.65rem;margin-top:.6rem;" id="ar-spots-note">
            Counts run from the last daemon start &#8212; Stop/Start resets them to zero.</p>
        </div>

        <div class="card" style="margin-bottom:.9rem;">
          <div class="card-header"><div class="dot"></div>REPORTER IDENTITY</div>
          <p style="color:var(--text2);font-size:.68rem;margin:.2rem 0 .7rem;">
            Spots upload under this callsign/grid. Defaults come from Site Info (siteSysop /
            siteGridSquare, first 6 chars). Editable for other sysops &#8212; set your own call before enabling reporting.</p>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:.7rem;">
            <div class="field"><label>CALLSIGN</label><input id="ar-call" type="text" placeholder="SV1BTL"></div>
            <div class="field"><label>GRID (6 CHAR)</label><input id="ar-grid" type="text" maxlength="6" placeholder="KM17VX"></div>
          </div>
        </div>

        <div class="card" style="margin-bottom:.9rem;">
          <div class="card-header"><div class="dot"></div>REPORTING DESTINATIONS</div>
          <label style="display:flex;align-items:center;gap:.5rem;font-size:.72rem;margin:.4rem 0;">
            <input type="checkbox" id="ar-psk"> PSK Reporter <span style="color:var(--text3)">&#8212; FT8 &amp; FT4 &#8594; report.pskreporter.info</span></label>
          <label style="display:flex;align-items:center;gap:.5rem;font-size:.72rem;margin:.4rem 0;">
            <input type="checkbox" id="ar-wspr"> wsprnet <span style="color:var(--text3)">&#8212; WSPR &#8594; wsprnet.org</span></label>
          <p style="color:var(--amber);font-size:.65rem;margin-top:.5rem;">Reporting is OFF by default. Nothing uploads until you enable a destination, Save, and Start.</p>
        </div>

        <div class="card">
          <div class="card-header"><div class="dot"></div>BANDS &amp; MODES
            <span style="margin-left:auto;font-size:.62rem;color:var(--text3);">MAX SLOTS
              <input id="ar-max" type="number" min="1" max="64" onchange="autorunCount()" style="width:3.4rem;margin-left:.3rem;background:#071007;border:1px solid var(--border);color:var(--green);padding:.15rem;"></span>
          </div>
          <div style="overflow-x:auto;"><table class="markers" id="ar-matrix"></table></div>
          <p style="color:var(--text3);font-size:.62rem;margin-top:.5rem;" id="ar-count">&#8212;</p>
          <p style="color:var(--text3);font-size:.62rem;margin-top:.3rem;display:none;" id="ar-slot-note">
            The number beside each box is that band+mode's <b>all-time</b> uploaded spots, kept across
            restarts. <span style="color:var(--amber)">Amber with a dot (&#183;123)</span> means decodes not
            uploaded yet &#8212; normal between flushes; a plain
            <span style="color:var(--amber)">0</span> means enabled but nothing decoded yet (WSPR can take
            minutes &#8212; it runs on a 2-minute cycle). Hover for the detail.</p>
        </div>
      </div>

      <!-- ══════ LOG VIEWER PAGE ══════ -->
      <div class="page" id="page-logs">
        <div class="section-head">LOG VIEWER</div>
        <div style="display:flex;gap:.5rem;margin-bottom:.7rem;flex-wrap:wrap;">
          <button class="btn btn-blue" onclick="loadCurrentLogTab()">↻ REFRESH LOGS</button>
          <button class="btn btn-green" id="auto-refresh-btn" onclick="toggleAutoRefresh()">⏵ AUTO REFRESH</button>
          <button class="btn btn-red" onclick="clearLogView()">✕ CLEAR LOGS</button>
        </div>
        <div class="tab-bar" style="margin-bottom:.6rem;">
          <div class="tab log-tab active" data-log-name="logwebsdr.txt" onclick="switchLogTab('logwebsdr.txt', this)">LOGWEBSDR</div>
          <div class="tab log-tab" data-log-name="spectrumserver.log" onclick="switchLogTab('spectrumserver.log', this)">SPECTRUMSERVER</div>
          <div class="tab log-tab" data-log-name="admin.log" onclick="switchLogTab('admin.log', this)">ADMIN</div>
          <div class="tab log-tab" data-log-name="rade.log" onclick="switchLogTab('rade.log', this)">RADE</div>
          <div class="tab log-tab" data-log-name="crash.log" onclick="switchLogTab('crash.log', this)">CRASH</div>
          <div class="tab log-tab" data-log-name="autorun.log" onclick="switchLogTab('autorun.log', this)">AUTORUN</div>
          <div class="tab log-tab" data-log-name="proxy.log" onclick="switchLogTab('proxy.log', this)">PROXY</div>
        </div>
        <div class="tab-pane log-tab-pane active" id="log-pane-logwebsdr">
          <div class="log-box" id="main-log-logwebsdr" style="height:550px;"></div>
        </div>
        <div class="tab-pane log-tab-pane" id="log-pane-spectrumserver">
          <div class="log-box" id="main-log-spectrumserver" style="height:550px;"></div>
        </div>
        <div class="tab-pane log-tab-pane" id="log-pane-admin">
          <div class="log-box" id="main-log-admin" style="height:550px;"></div>
        </div>
        <div class="tab-pane log-tab-pane" id="log-pane-rade">
          <div class="log-box" id="main-log-rade" style="height:550px;"></div>
        </div>
        <div class="tab-pane log-tab-pane" id="log-pane-crash">
          <div class="log-box" id="main-log-crash" style="height:550px;"></div>
        </div>
        <div class="tab-pane log-tab-pane" id="log-pane-autorun">
          <div class="log-box" id="main-log-autorun" style="height:550px;"></div>
        </div>
        <div class="tab-pane log-tab-pane" id="log-pane-proxy">
          <div class="log-box" id="main-log-proxy" style="height:550px;"></div>
        </div>
      </div>

      <!-- ══════ CHAT HISTORY PAGE ══════ -->
      <div class="page" id="page-chat">
        <div class="section-head">CHAT HISTORY</div>
        <div style="display:flex;gap:.5rem;margin-bottom:.7rem;">
          <button class="btn btn-blue" onclick="loadChat()">↻ REFRESH</button>
        </div>
        <div class="chat-log" id="chat-log">Loading...</div>
      </div>

      <!-- ══════ SETTINGS PAGE ══════ -->
      <div class="page" id="page-settings">
        <div class="section-head">ADMIN SETTINGS</div>
        <div class="grid grid-2" style="margin-bottom:1rem;">
          <div class="card">
            <div class="card-header"><div class="dot"></div>CHANGE PASSWORD</div>
            <form onsubmit="changePassword(event)">
              <div style="margin-bottom:.6rem;">
                <label style="font-size:.65rem;color:var(--text3);display:block;margin-bottom:.3rem;">CURRENT PASSWORD</label>
                <input type="password" id="old-pwd" style="width:100%;">
              </div>
              <div style="margin-bottom:.6rem;">
                <label style="font-size:.65rem;color:var(--text3);display:block;margin-bottom:.3rem;">NEW PASSWORD</label>
                <input type="password" id="new-pwd" style="width:100%;">
              </div>
              <div style="margin-bottom:.8rem;">
                <label style="font-size:.65rem;color:var(--text3);display:block;margin-bottom:.3rem;">CONFIRM NEW PASSWORD</label>
                <input type="password" id="new-pwd2" style="width:100%;">
              </div>
              <button type="submit" class="btn btn-green">🔑 UPDATE PASSWORD</button>
            </form>
          </div>
          <div class="card">
            <div class="card-header"><div class="dot"></div>SDR BASE DIRECTORY</div>
            <p style="color:var(--text2);font-size:.75rem;margin-bottom:.6rem;">Path to PhantomSDR-Plus installation:</p>
            <input type="text" id="sdr-dir" style="width:100%;margin-bottom:1rem;" placeholder="/path/to/PhantomSDR-Plus">
            <div class="card-header" style="margin:.4rem 0;">
              <div class="dot" style="background:var(--blue);box-shadow:0 0 6px var(--blue);"></div>
              PUBLIC WEBSDR PORT
            </div>
            <p style="color:var(--text2);font-size:.7rem;margin-bottom:.4rem;">Port users connect to (proxy.py / nginx / spectrumserver direct). Used for the Users page.</p>
            <input type="number" id="public-port" style="width:100%;margin-bottom:1rem;" placeholder="8900" min="1" max="65535">
            <div class="card-header" style="margin:.4rem 0;">
              <div class="dot" style="background:var(--green);box-shadow:0 0 6px var(--green);"></div>
              DEFAULT START SCRIPT
            </div>
            <select class="script-select" id="default-start-sel" style="width:100%;margin-bottom:.8rem;"></select>
            <div class="card-header" style="margin:.4rem 0;">
              <div class="dot" style="background:var(--red);box-shadow:0 0 6px var(--red);"></div>
              DEFAULT STOP SCRIPT
            </div>
            <select class="script-select" id="default-stop-sel" style="width:100%;margin-bottom:.8rem;"></select>
            <button class="btn btn-amber" onclick="saveSettings()">💾 SAVE SETTINGS</button>
            <div id="settings-msg" style="margin-top:.5rem;font-size:.7rem;color:var(--text3);"></div>
          </div>
        </div>

        <!-- ══════ THERMAL GUARD SETTINGS ══════ -->
        <div class="section-head">THERMAL GUARD</div>
        <div class="card" style="margin-bottom:1rem;">
          <p style="color:var(--text2);font-size:.75rem;margin-bottom:.6rem;">
            Protects the machine when the CPU overheats. Blank temperature fields mean
            <b>auto</b> — derived from this machine's own critical trip point
            (<span id="tg-cfg-crit">--</span>), so the numbers are right for Intel, AMD and Pi alike.
            Every stage must be held for its sustain time, so a brief spike never acts.
            <b>Start with mode = log</b> for a while and read the results in the CRASH log.
          </p>
          <div class="field-row" style="margin-bottom:.7rem;">
            <div>
              <label style="font-size:.65rem;color:var(--text3);display:block;margin-bottom:.3rem;">MODE</label>
              <select id="tg-cfg-mode" style="width:100%;">
                <option value="log">log — record only, never act (safe default)</option>
                <option value="throttle">throttle — lower CPU clock, never stop</option>
                <option value="stop">stop — throttle, then stop the server</option>
                <option value="stop+restart">stop+restart — and restart once cool</option>
              </select>
            </div>
            <div>
              <label style="font-size:.65rem;color:var(--text3);display:block;margin-bottom:.3rem;">ENABLED</label>
              <select id="tg-cfg-enabled" style="width:100%;">
                <option value="1">yes</option><option value="0">no</option>
              </select>
            </div>
          </div>
          <div class="grid grid-4" style="gap:.6rem;margin-bottom:.7rem;">
            <div><label style="font-size:.65rem;color:var(--text3);display:block;margin-bottom:.3rem;">WARN °C</label>
                 <input type="number" step="0.5" id="tg-cfg-warn" style="width:100%;" placeholder="auto"></div>
            <div><label style="font-size:.65rem;color:var(--text3);display:block;margin-bottom:.3rem;">THROTTLE °C</label>
                 <input type="number" step="0.5" id="tg-cfg-throttle" style="width:100%;" placeholder="auto"></div>
            <div><label style="font-size:.65rem;color:var(--text3);display:block;margin-bottom:.3rem;">STOP °C</label>
                 <input type="number" step="0.5" id="tg-cfg-stop" style="width:100%;" placeholder="auto"></div>
            <div><label style="font-size:.65rem;color:var(--text3);display:block;margin-bottom:.3rem;">RESUME °C</label>
                 <input type="number" step="0.5" id="tg-cfg-resume" style="width:100%;" placeholder="auto"></div>
          </div>
          <div class="grid grid-4" style="gap:.6rem;margin-bottom:.7rem;">
            <div><label style="font-size:.65rem;color:var(--text3);display:block;margin-bottom:.3rem;">STOP SUSTAIN (s)</label>
                 <input type="number" id="tg-cfg-sustain" style="width:100%;" placeholder="60"></div>
            <div><label style="font-size:.65rem;color:var(--text3);display:block;margin-bottom:.3rem;">WARN SUSTAIN (s)</label>
                 <input type="number" id="tg-cfg-warnsustain" style="width:100%;" placeholder="30"></div>
            <div><label style="font-size:.65rem;color:var(--text3);display:block;margin-bottom:.3rem;">RESUME HOLD (s)</label>
                 <input type="number" id="tg-cfg-resumes" style="width:100%;" placeholder="300"></div>
            <div><label style="font-size:.65rem;color:var(--text3);display:block;margin-bottom:.3rem;">MAX STOPS / HOUR</label>
                 <input type="number" id="tg-cfg-maxstops" style="width:100%;" placeholder="2"></div>
          </div>
          <div style="margin-bottom:.7rem;">
            <label style="font-size:.65rem;color:var(--text3);display:block;margin-bottom:.3rem;">
              TEST TEMPERATURE °C — inject a fake reading to prove the whole path works, blank = off</label>
            <input type="number" step="0.5" id="tg-cfg-test" style="width:100%;" placeholder="blank = use the real sensor">
          </div>
          <button class="btn btn-amber" onclick="saveThermal()">💾 SAVE THERMAL SETTINGS</button>
          <div id="tg-cfg-msg" style="margin-top:.5rem;font-size:.7rem;color:var(--text3);"></div>
        </div>
      </div>

      <!-- ══════ USERS PAGE ══════ -->
      <!-- ══════ GRAPHS PAGE ══════ -->
      <div class="page" id="page-graphs">
        <div class="section-head">SYSTEM GRAPHS</div>
        <div style="display:flex;gap:.5rem;margin-bottom:.8rem;flex-wrap:wrap;align-items:center;">
          <button class="btn btn-green graph-range active" data-range="900"  onclick="graphSetRange(900,this)">15 MIN</button>
          <button class="btn graph-range" data-range="3600" onclick="graphSetRange(3600,this)">1 HOUR</button>
          <button class="btn graph-range" data-range="14400" onclick="graphSetRange(14400,this)">4 HOURS</button>
          <button class="btn graph-range" data-range="43200" onclick="graphSetRange(43200,this)">12 HOURS</button>
          <button class="btn graph-range" data-range="86400" onclick="graphSetRange(86400,this)">24 HOURS</button>
          <span style="font-size:.78rem;color:var(--text3);margin-left:.4rem;" id="graph-info-label"></span>
        </div>

        <!-- Current values.  Each graph panel below is titled and scaled on its
             own, so these tiles carry the exact reading the curves only imply. -->
        <div class="grid grid-4" style="margin-bottom:1rem;">
          <div class="card">
            <div class="card-header"><div class="dot"></div>CPU FREQUENCY</div>
            <div class="stat-val" id="g-cur-freq">--</div>
            <div class="stat-label" id="g-sub-freq">GHz average</div>
          </div>
          <div class="card">
            <div class="card-header"><div class="dot"></div>CPU LOAD</div>
            <div class="stat-val" id="g-cur-load">--</div>
            <div class="stat-label">percent</div>
          </div>
          <div class="card">
            <div class="card-header"><div class="dot"></div>CPU TEMPERATURE</div>
            <div class="stat-val" id="g-cur-temp">--</div>
            <div class="stat-label" id="g-sub-temp">degrees C</div>
          </div>
          <div class="card">
            <div class="card-header"><div class="dot"></div>USERS ONLINE</div>
            <div class="stat-val" id="g-cur-users">--</div>
            <div class="stat-label">connected now</div>
          </div>
        </div>

        <div class="card" style="padding:.6rem .4rem .2rem .4rem;">
          <!-- Four stacked panels sharing one time axis.  Deliberately NOT one
               chart with several y-scales: GHz, %, °C and a head-count have no
               common scale, and overlaying them would invent relationships that
               are not in the data. -->
          <div id="graph-empty" style="display:none;color:var(--text3);font-size:.72rem;text-align:center;padding:2rem .6rem;"></div>
          <canvas id="graph-canvas" style="width:100%;display:block;cursor:crosshair;"></canvas>
          <div id="graph-tooltip" style="display:none;position:absolute;z-index:50;pointer-events:none;
               background:#071007;border:1px solid var(--border);border-radius:3px;padding:.45rem .6rem;
               font-size:.8rem;line-height:1.5;color:var(--text);white-space:nowrap;box-shadow:0 4px 14px #000a;"></div>
        </div>
      </div>

      <div class="page" id="page-users">
        <div class="section-head">CONNECTED USERS</div>
        <div style="display:flex;gap:.5rem;margin-bottom:.8rem;flex-wrap:wrap;align-items:center;">
          <button class="btn btn-blue" onclick="loadUsers()">&#8635; REFRESH</button>
          <button class="btn btn-green" id="users-auto-btn" onclick="toggleUsersAutoRefresh()">&#9654; AUTO</button>
          <span style="font-size:.65rem;color:var(--text3);margin-left:.4rem;" id="users-info-label"></span>
        </div>
        <div id="users-error" style="display:none;background:rgba(255,64,64,.08);border:1px solid rgba(255,64,64,.3);border-radius:3px;color:var(--red);padding:.5rem .9rem;font-size:.72rem;margin-bottom:.6rem;"></div>
        <div class="card" style="overflow-x:auto;padding:0;">
          <table style="width:100%;border-collapse:collapse;font-size:.75rem;">
            <thead>
              <tr>
                <th style="color:var(--text3);font-weight:normal;letter-spacing:.1em;padding:.4rem .6rem;border-bottom:1px solid var(--border);text-align:left;white-space:nowrap;">IP / LOCATION</th>
                <th style="color:var(--text3);font-weight:normal;letter-spacing:.1em;padding:.4rem .6rem;border-bottom:1px solid var(--border);text-align:left;white-space:nowrap;">FREQUENCY</th>
                <th style="color:var(--text3);font-weight:normal;letter-spacing:.1em;padding:.4rem .6rem;border-bottom:1px solid var(--border);text-align:left;white-space:nowrap;">MODE</th>
                <th style="color:var(--text3);font-weight:normal;letter-spacing:.1em;padding:.4rem .6rem;border-bottom:1px solid var(--border);text-align:left;white-space:nowrap;">DURATION</th>
                <th style="color:var(--text3);font-weight:normal;letter-spacing:.1em;padding:.4rem .6rem;border-bottom:1px solid var(--border);text-align:left;white-space:nowrap;">ACTION</th>
              </tr>
            </thead>
            <tbody id="users-tbody">
              <tr><td colspan="5" style="color:var(--text3);text-align:center;padding:.8rem;">Click REFRESH to load</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- ══════ WATERFALL MESSAGE PAGE ══════ -->
      <div class="page" id="page-wfmsg">
        <div class="section-head">📢 WATERFALL MESSAGE</div>
        <div class="grid grid-2">

          <div class="card">
            <div class="card-header">
              <div class="dot" style="background:var(--amber);box-shadow:0 0 6px var(--amber)"></div>
              COMPOSE &amp; BROADCAST
            </div>

            <div style="margin-bottom:.6rem;">
              <label style="font-size:.65rem;color:var(--text3);display:block;margin-bottom:.3rem;">MESSAGE (max 200 chars)</label>
              <textarea id="wfmsg-text"
                style="width:100%;background:#030803;border:1px solid var(--border);
                       color:var(--text);font-family:'Share Tech Mono',monospace;
                       font-size:.85rem;padding:.5rem .7rem;border-radius:3px;
                       resize:vertical;height:80px;outline:none;transition:.15s;"
                placeholder="QRT in 10 min — 73 de SV1BTL!" maxlength="200"
                onfocus="this.style.borderColor='var(--amber)'"
                onblur="this.style.borderColor='var(--border)'"></textarea>
              <div id="wfmsg-charcount" style="font-size:.6rem;color:var(--text3);text-align:right;margin-top:.2rem;">0 / 200</div>
            </div>

            <div style="margin-bottom:.8rem;">
              <label style="font-size:.65rem;color:var(--text3);display:block;margin-bottom:.3rem;">TEXT COLOUR</label>
              <select id="wfmsg-color"
                style="width:100%;background:#071207;border:1px solid var(--border);
                       color:var(--text);font-family:'Share Tech Mono',monospace;
                       font-size:.8rem;padding:.4rem .6rem;border-radius:2px;outline:none;">
                <option value="#ffffff">⬜ White</option>
                <option value="#ffff00">🟡 Yellow</option>
                <option value="#00ffff">🩵 Cyan</option>
                <option value="#00ff41">🟢 Green</option>
                <option value="#ffb000">🟠 Amber</option>
              </select>
            </div>

            <div style="display:flex;gap:.5rem;">
              <button class="btn btn-amber" onclick="sendWfMsg()" style="flex:1;">📢 BROADCAST</button>
              <button class="btn btn-red" onclick="clearWfMsg()">✕ CLEAR</button>
            </div>
            <div id="wfmsg-status" style="margin-top:.6rem;font-size:.7rem;color:var(--text3);min-height:1.4em;padding:.2rem 0;"></div>
          </div>

          <div class="card">
            <div class="card-header"><div class="dot"></div>STATUS &amp; NOTES</div>
            <div style="font-size:.75rem;color:var(--text2);line-height:2;">
              <p>The message appears as a <span style="color:var(--green)">fixed dark banner at the top of the waterfall</span> for all connected users.</p>
              <br>
              <p>&#9679; Stays visible until you click <strong style="color:var(--red)">CLEAR</strong>.</p>
              <p>&#9679; Browsers poll every 10 s — message appears within 10 s of BROADCAST.</p>
              <p>&#9679; Disappears within 10 s of CLEAR.</p>
              <p>&#9679; Users who connect after CLEAR never see it.</p>
              <p>&#9679; No page refresh required on either side.</p>
            </div>

            <div style="margin-top:1rem;padding:.6rem .8rem;border-radius:3px;border:1px solid var(--border);background:#030803;">
              <div style="font-size:.6rem;color:var(--text3);letter-spacing:.15em;margin-bottom:.4rem;">CURRENT ACTIVE MESSAGE</div>
              <div id="wfmsg-active" style="font-size:.85rem;color:var(--text3);word-break:break-word;min-height:1.4em;">—</div>
            </div>

            <div style="margin-top:.8rem;display:flex;gap:.5rem;">
              <button class="btn btn-blue" onclick="loadWfMsgStatus()" style="flex:1;">↻ REFRESH STATUS</button>
            </div>
          </div>

        </div>
      </div>
      <!-- /WATERFALL MESSAGE PAGE -->

    </div><!-- /content -->
  </div><!-- /main -->
</div><!-- /layout -->

<!-- Mobile bottom navigation bar -->
<nav class="bottom-nav" id="bottom-nav">
  <a href="#" onclick="showPage('dashboard',this);return false;" class="active" data-page="dashboard">
    <span class="bi">⬡</span><span>DASH</span>
  </a>
  <a href="#" onclick="showPage('config',this);return false;" data-page="config">
    <span class="bi">⚙</span><span>CONFIG</span>
  </a>
  <a href="#" onclick="showPage('markers',this);return false;" data-page="markers">
    <span class="bi">◉</span><span>MARKERS</span>
  </a>
  <a href="#" onclick="showPage('logs',this);return false;" data-page="logs">
    <span class="bi">▤</span><span>LOGS</span>
  </a>
  <a href="#" onclick="showPage('graphs',this);return false;" data-page="graphs">
    <span class="bi">📈</span><span>Graphs</span>
  </a>
  <a href="#" onclick="showPage('users',this);return false;" data-page="users">
    <span class="bi">👥</span><span>USERS</span>
  </a>
  <a href="#" onclick="showPage('wfmsg',this);return false;" data-page="wfmsg">
    <span class="bi">📢</span><span>MSG</span>
  </a>
  <a href="#" onclick="showPage('settings',this);return false;" data-page="settings">
    <span class="bi">◧</span><span>MORE</span>
  </a>
</nav>

<div id="toast"></div>

<script>
// ─── State ──────────────────────────────────────────────────────────────────
let currentPage = 'dashboard';
let autoRefresh = false;
let autoRefreshTimer = null;
let statusTimer = null;
let currentLogTab = 'logwebsdr.txt';

const LOG_TAB_TARGETS = {
  'logwebsdr.txt': 'main-log-logwebsdr',
  'spectrumserver.log': 'main-log-spectrumserver',
  'admin.log': 'main-log-admin',
  'rade.log': 'main-log-rade',
  'crash.log': 'main-log-crash',
  'autorun.log': 'main-log-autorun',
  'proxy.log': 'main-log-proxy',
};

const LOG_TAB_PANES = {
  'logwebsdr.txt': 'log-pane-logwebsdr',
  'spectrumserver.log': 'log-pane-spectrumserver',
  'admin.log': 'log-pane-admin',
  'rade.log': 'log-pane-rade',
  'crash.log': 'log-pane-crash',
  'autorun.log': 'log-pane-autorun',
  'proxy.log': 'log-pane-proxy',
};

// ─── Page navigation ────────────────────────────────────────────────────────
function showPage(name, el) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('page-' + name).classList.add('active');
  el.classList.add('active');
  // Get label from either sidebar nav-item or bottom-nav link
  const labelEl = el.querySelector('span:last-child') || el.querySelector('span.bi + span') || el;
  document.getElementById('page-title').textContent = (labelEl.textContent || name).toUpperCase();
  currentPage = name;
  // Sync bottom nav active state
  document.querySelectorAll('.bottom-nav a').forEach(a => {
    a.classList.toggle('active', a.dataset.page === name);
  });
  if (name === 'dashboard') { loadDashboard(); }
  if (name === 'config') { loadConfigList(); }
  if (name === 'siteinfo') { loadJsonList(); }
  if (name === 'markers') { loadMarkers(); }
  if (name === 'reporting') { autorunLoad(); }
  if (name === 'logs') { loadCurrentLogTab(); }
  if (name === 'chat') { loadChat(); }
  if (name === 'settings') { loadSettingsPage(); }
  if (name === 'graphs')   { initGraphs(); }
  if (name === 'users')    { loadUsers(); }
  if (name === 'wfmsg')    { loadWfMsgStatus(); }
  return false;
}

// ─── Toast ───────────────────────────────────────────────────────────────────
function toast(msg, type='ok') {
  const t = document.getElementById('toast');
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.textContent = (type==='ok'?'✓ ':'✗ ') + msg;
  t.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

// ─── Clock ───────────────────────────────────────────────────────────────────
function updateClock() {
  document.getElementById('clock').textContent = new Date().toLocaleTimeString('en-GB');
}
setInterval(updateClock, 1000); updateClock();

// ─── Status polling ──────────────────────────────────────────────────────────
async function updateStatus() {
  try {
    const r = await fetch('/admin/api/status');
    const d = await r.json();
    const pill = document.getElementById('sdr-status');
    const dot  = pill ? pill.querySelector('.status-dot') : null;
    if (pill && dot) {
      if (d.process && d.process.running) {
        pill.className = 'status-pill online'; dot.className = 'status-dot online';
        pill.querySelector('span').textContent = 'ONLINE';
        document.getElementById('stat-status').textContent = 'RUNNING';
        document.getElementById('stat-status').style.color = 'var(--green)';
      } else {
        pill.className = 'status-pill offline'; dot.className = 'status-dot offline';
        pill.querySelector('span').textContent = 'OFFLINE';
        document.getElementById('stat-status').textContent = 'STOPPED';
        document.getElementById('stat-status').style.color = 'var(--red)';
      }
    }
    const pidEl = document.getElementById('stat-pid');
    if (pidEl && d.process) pidEl.textContent = 'PID: ' + (d.process.pid || '--');
    const s = d.system;
    if (s && s.cpu !== undefined && s.cpu !== 'N/A') {
      document.getElementById('stat-cpu').textContent  = s.cpu + '%';
      setBar('bar-cpu', s.cpu);
      const memEl = document.getElementById('stat-mem');
      memEl.textContent = s.mem_used + ' / ' + s.mem_total + ' GB';
      memEl.style.color = s.mem_pct > 80 ? 'var(--stat-bad)' : '';
      setBar('bar-mem', s.mem_pct);
      document.getElementById('stat-disk').textContent = s.disk_used + ' / ' + s.disk_total + ' GB';
      setBar('bar-disk', s.disk_pct);
      const tempEl = document.getElementById('stat-temp');
      if (tempEl) {
        if (s.temp !== null && s.temp !== undefined) {
          tempEl.textContent = s.temp + '\u00b0C';
          tempEl.style.color = s.temp >= 80 ? 'var(--stat-bad)'
                             : s.temp >= 70 ? 'var(--stat-warn)' : '';
          setBar('bar-temp', Math.min(100, Math.max(0, (s.temp - 20) / 80 * 100)));
        } else { tempEl.textContent = 'N/A'; tempEl.style.color = ''; }
      }
    }
    const tbody = document.getElementById('top-procs-tbody');
    if (tbody) {
      if (d.top_procs && d.top_procs.length > 0) {
        tbody.innerHTML = '';
        d.top_procs.forEach(proc => {
          const cc = proc.cpu > 80 ? 'cpu-hi' : proc.cpu > 50 ? 'cpu-med' : 'cpu-ok';
          const tr = document.createElement('tr');
          tr.innerHTML =
            `<td style="color:var(--text3)">${proc.pid}</td>` +
            `<td style="color:var(--text)">${proc.name}</td>` +
            `<td style="color:var(--text3)">${proc.user||''}</td>` +
            `<td class="${cc}">${proc.cpu}%</td>` +
            `<td class="mem-col">${proc.mem}%</td>`;
          tbody.appendChild(tr);
        });
      } else {
        tbody.innerHTML = '<tr><td colspan="5" style="color:var(--text3);text-align:center;">No data</td></tr>';
      }
    }
  } catch(e) { console.error('updateStatus:', e); }
}

// ─── Thermal guard ───────────────────────────────────────────────────────────
async function updateThermal() {
  try {
    const t = await fetch('/admin/api/thermal').then(r => r.json());
    const card = document.getElementById('thermal-card');
    const sub  = document.getElementById('stat-temp-guard');
    if (!t.available) {
      if (card) card.style.display = 'none';
      if (sub) sub.textContent = 'GUARD: unavailable';
      return;
    }
    if (card) card.style.display = '';
    const th = t.thresholds || {};
    let state, color;
    if (!t.enabled)      { state = 'DISABLED'; color = 'var(--text3)'; }
    else if (t.locked)   { state = 'LOCKED OUT'; color = 'var(--red)'; }
    else if (!t.armed)   { state = 'NOT ARMED'; color = 'var(--amber)'; }
    else if (t.stage === 'stopped')  { state = 'STOP LEVEL'; color = 'var(--red)'; }
    else if (t.stage === 'throttle') { state = 'THROTTLING'; color = 'var(--amber)'; }
    else if (t.stage === 'warn')     { state = 'WARM'; color = 'var(--amber)'; }
    else                 { state = 'ARMED'; color = 'var(--green)'; }
    const set = (id, txt) => { const e = document.getElementById(id); if (e) e.textContent = txt; };
    set('tg-state', state);
    const st = document.getElementById('tg-state'); if (st) st.style.color = color;
    const dot = document.getElementById('tg-dot');
    if (dot) { dot.style.background = color; dot.style.boxShadow = '0 0 6px ' + color; }
    set('tg-mode', t.mode + (t.mode === 'log' ? ' (no action)' : ''));
    set('tg-stop',   th.stop   !== undefined ? th.stop + '°C' : '--');
    set('tg-resume', th.resume !== undefined ? th.resume + '°C' : '--');
    set('tg-sensor', (t.sensor || 'no sensor') +
        (t.crit ? '  crit ' + t.crit + '°C' : '') +
        (t.throttle_supported ? '' : '  cpufreq: n/a'));
    let reason = t.reason || '';
    if (t.test_temp !== null && t.test_temp !== undefined)
      reason += '   [TEST MODE: reading forced to ' + t.test_temp + '°C]';
    if (t.giveup) reason += '   [rate limit hit: auto-restart disabled]';
    set('tg-reason', reason);
    set('tg-last', t.last_event || '');
    if (sub) sub.textContent = 'GUARD: ' + state +
      (th.stop !== undefined && t.enabled ? ' · stop ' + th.stop + '°C' : '');
  } catch(e) { console.error('updateThermal:', e); }
}

async function thermalReset() {
  if (!confirm('Clear the thermal lockout and rate limit?' +
               String.fromCharCode(10) +
               'If the CPU is still too hot the guard will simply stop the server again.')) return;
  const d = await fetch('/admin/api/thermal', {
    method: 'POST', headers: {'Content-Type':'application/json'},
    body: JSON.stringify({action: 'reset'})
  }).then(r => r.json());
  toast(d.msg || (d.ok ? 'Cleared' : 'Failed'), d.ok ? '' : 'err');
  updateThermal();
}

// ─── WebSDR diversity relay ──────────────────────────────────────────────────
async function updateRelay() {
  try {
    const d = await fetch('/admin/api/websdr-relay').then(r => r.json());
    const card = document.getElementById('relay-card');
    if (!card) return;
    // Not set up at all: say nothing rather than show a permanently red card
    // on the many receivers that will never use this.
    if (!d.configured) { card.style.display = 'none'; return; }
    card.style.display = '';

    const set = (id, txt) => { const e = document.getElementById(id); if (e) e.textContent = txt; };
    const state = d.running ? 'RUNNING' : 'STOPPED';
    const color = d.running ? 'var(--green)' : 'var(--red)';
    set('rl-state', state);
    const st = document.getElementById('rl-state'); if (st) st.style.color = color;
    const dot = document.getElementById('rl-dot');
    if (dot) { dot.style.background = color; dot.style.boxShadow = '0 0 6px ' + color; }

    set('rl-port', d.port !== undefined ? String(d.port) : '--');
    set('rl-cap', (d.max_per_host !== undefined && d.max_per_host !== null)
                  ? d.max_per_host + ' / site' : '--');

    const sess = (d.sessions && d.sessions.hosts) ? d.sessions.hosts : {};
    const total = (d.sessions && d.sessions.total !== undefined) ? d.sessions.total : 0;
    set('rl-sessions', d.running ? (total + (d.max_total ? ' / ' + d.max_total : '')) : '--');

    // Which WebSDRs this station is currently relaying to, and how many
    // listeners on each. Empty is the normal resting state.
    const names = Object.keys(sess);
    const hosts = document.getElementById('rl-hosts');
    if (hosts) {
      if (!d.running) hosts.textContent = '';
      else if (!names.length) hosts.textContent = 'No active sessions.';
      else hosts.textContent = names.map(h => h + '  \u00d7' + sess[h]).join('     ');
    }

    // The User-Agent is what WebSDR operators see. Showing it here is the
    // quickest way to notice it still says "your-receiver.example".
    set('rl-ua', d.user_agent || d.site || '');
    set('rl-reason', d.running ? '' : (d.reason || ''));
  } catch(e) { console.error('updateRelay:', e); }
}

function setBar(id, pct) {
  const el = document.getElementById(id);
  if (!el) return;
  el.style.width = pct + '%';
  el.className = 'bar-fill' + (pct>80?' danger':pct>50?' warn':'');
}

statusTimer = setInterval(updateStatus, 3000);
updateStatus();
setInterval(updateThermal, 5000);
updateThermal();
setInterval(updateRelay, 10000);
updateRelay();

// ─── Dashboard & Terminal ────────────────────────────────────────────────────
let _dashLogTimer = null;
let _termCwd  = '';
let _termHist = [];
let _termIdx  = -1;

async function loadDashboard() {
  updateStatus();
  updateThermal();
  loadLogs('dash-log', 'logwebsdr.txt');
  if (_dashLogTimer) clearInterval(_dashLogTimer);
  _dashLogTimer = setInterval(() => {
    if (currentPage === 'dashboard') loadLogs('dash-log', 'logwebsdr.txt');
    else { clearInterval(_dashLogTimer); _dashLogTimer = null; }
  }, 5000);
  // Set terminal cwd to sdr base dir
  if (!_termCwd) {
    try {
      const cfg = await fetch('/admin/api/settings').then(r => r.json());
      _termCwd = cfg.sdr_base_dir || '.';
    } catch(e) { _termCwd = '.'; }
    termUpdatePrompt();
  }
}

function termUpdatePrompt() {
  const el = document.getElementById('term-cwd');
  if (el && _termCwd) {
    const parts = _termCwd.replace(/\\/+$/, '').split('/');
    el.textContent = parts.slice(-2).join('/') || _termCwd;
  }
}

function termPrint(text, cls) {
  const out = document.getElementById('term-output');
  if (!out) return;
  if (text === '__CLEAR__') { out.innerHTML = ''; return; }
  const div = document.createElement('div');
  if (cls === 'cmd') {
    div.style.cssText = 'color:var(--amber);margin-top:.3rem;font-weight:bold;';
  } else if (cls === 'err') {
    div.style.cssText = 'color:#ff6666;';
  } else {
    div.style.cssText = 'color:var(--text);';
  }
  div.textContent = text;
  out.appendChild(div);
  out.scrollTop = out.scrollHeight;
}

function termClear() {
  const out = document.getElementById('term-output');
  if (out) out.innerHTML = '';
}

async function termRun() {
  const inp = document.getElementById('term-input');
  if (!inp) return;
  const cmd = inp.value.trim();
  if (!cmd) return;
  inp.value = '';
  _termHist.unshift(cmd);
  if (_termHist.length > 100) _termHist.pop();
  _termIdx = -1;
  termPrint('$ ' + cmd, 'cmd');
  try {
    const r = await fetch('/admin/api/terminal/exec', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({cmd: cmd, cwd: _termCwd})
    });
    if (!r.ok) { termPrint('HTTP error: ' + r.status, 'err'); return; }
    const d = await r.json();
    if (d.cwd && d.cwd !== _termCwd) {
      _termCwd = d.cwd;
      termUpdatePrompt();
    }
    if (d.output) termPrint(d.output, d.ok ? '' : 'err');
  } catch(ex) {
    termPrint('Network error: ' + ex.message, 'err');
  }
}

function termKey(e) {
  const inp = document.getElementById('term-input');
  if (!inp) return;
  if (e.key === 'Enter') {
    e.preventDefault(); termRun();
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    if (_termIdx < _termHist.length - 1) { _termIdx++; inp.value = _termHist[_termIdx]; }
  } else if (e.key === 'ArrowDown') {
    e.preventDefault();
    if (_termIdx > 0) { _termIdx--; inp.value = _termHist[_termIdx]; }
    else { _termIdx = -1; inp.value = ''; }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const out = document.getElementById('term-output');
  if (out) out.addEventListener('click', () => {
    const inp = document.getElementById('term-input');
    if (inp) inp.focus();
  });
});


// ─── File Editor ─────────────────────────────────────────────────────────────
let configFiles = {};

async function loadConfigList(notify) {
  const sel = document.getElementById('config-file-sel');
  const prev = sel.value;                       // preserve current selection across a rescan
  const r = await fetch('/admin/api/editable-files');
  const nextFiles = await r.json();
  if (notify) {
    const before = Object.keys(configFiles);
    const after  = Object.keys(nextFiles);
    const added   = after.filter(f => !before.includes(f)).length;
    const removed = before.filter(f => !after.includes(f)).length;
    toast('Rescanned: ' + after.length + ' files (+' + added + ' / -' + removed + ')');
  }
  configFiles = nextFiles;
  sel.innerHTML = '<option value="">-- Select file --</option>';
  // Group by extension
  const groups = {};
  Object.keys(configFiles).forEach(rel => {
    const ext = rel.split('.').pop().toLowerCase();
    if (!groups[ext]) groups[ext] = [];
    groups[ext].push(rel);
  });
  const order = ['toml','sh','json','html','cpp','h','txt'];
  [...order, ...Object.keys(groups).filter(e => !order.includes(e))].forEach(ext => {
    if (!groups[ext]) return;
    const og = document.createElement('optgroup');
    og.label = '.' + ext.toUpperCase();
    groups[ext].forEach(rel => {
      const o = document.createElement('option');
      o.value = rel; o.textContent = rel;
      og.appendChild(o);  // ← append to optgroup, not directly to select
    });
    sel.appendChild(og);
  });
  if (prev && configFiles[prev]) sel.value = prev;   // keep selection if the file still exists
}

async function loadConfigFile() {
  const sel = document.getElementById('config-file-sel');
  const name = sel.value;
  if (!name) return;
  document.getElementById('config-filepath').textContent = configFiles[name] || name;
  const r = await fetch('/admin/api/read-file?path=' + encodeURIComponent(configFiles[name]));
  const d = await r.json();
  document.getElementById('config-editor').value = d.content || '';
}

async function saveConfigFile() {
  const sel = document.getElementById('config-file-sel');
  const name = sel.value;
  const content = document.getElementById('config-editor').value;
  const r = await fetch('/admin/api/write-file', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({path: configFiles[name], content})
  });
  const d = await r.json();
  const msg = document.getElementById('config-save-msg');
  if (d.ok) { toast('Config saved'); msg.textContent = '✓ Saved at ' + new Date().toLocaleTimeString(); msg.style.color = 'var(--green)'; }
  else { toast(d.msg, 'err'); msg.textContent = '✗ ' + d.msg; msg.style.color = 'var(--red)'; }
}

// ─── JSON / Site Info Editor ─────────────────────────────────────────────────
let jsonFiles = {};
let currentJsonData = {};
let currentJsonPath = '';

async function loadJsonList() {
  const r = await fetch('/admin/api/json-files');
  jsonFiles = await r.json();
  const sel = document.getElementById('json-file-sel');
  sel.innerHTML = '';
  Object.keys(jsonFiles).forEach(name => {
    const o = document.createElement('option');
    o.value = name; o.textContent = name;
    sel.appendChild(o);
  });
  if (Object.keys(jsonFiles).length > 0) loadJsonFile();
}

async function loadJsonFile() {
  const sel = document.getElementById('json-file-sel');
  const name = sel.value;
  if (!name) return;
  currentJsonPath = jsonFiles[name];
  const r = await fetch('/admin/api/read-file?path=' + encodeURIComponent(currentJsonPath));
  const d = await r.json();
  const raw = d.content || '{}';
  document.getElementById('json-raw-editor').value = raw;
  try {
    currentJsonData = JSON.parse(raw);
    renderJsonForm(currentJsonData);
  } catch(e) {
    document.getElementById('json-form-fields').innerHTML = '<p style="color:var(--red)">Invalid JSON: ' + e.message + '</p>';
  }
}

function renderJsonForm(data) {
  const container = document.getElementById('json-form-fields');
  container.innerHTML = '';
  Object.entries(data).forEach(([key, val]) => {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;flex-direction:column;gap:.2rem;';
    const label = document.createElement('label');
    label.style.cssText = 'font-size:.6rem;color:var(--text3);letter-spacing:.1em;';
    label.textContent = key.toUpperCase();

    let input;
    if (typeof val === 'boolean') {
      input = document.createElement('select');
      input.className = 'script-select';
      input.style.marginBottom = '0';
      input.innerHTML = `<option value="true" ${val?'selected':''}>true</option><option value="false" ${!val?'selected':''}>false</option>`;
    } else if (typeof val === 'number') {
      input = document.createElement('input');
      input.type = 'number'; input.value = val;
      input.style.width = '100%';
    } else if (typeof val === 'object') {
      input = document.createElement('textarea');
      input.className = 'code';
      input.style.minHeight = '60px';
      input.style.width = '100%';
      input.value = JSON.stringify(val, null, 2);
    } else {
      input = document.createElement('input');
      input.type = 'text'; input.value = val;
      input.style.width = '100%';
    }
    input.dataset.key = key;
    wrap.appendChild(label);
    wrap.appendChild(input);
    container.appendChild(wrap);
  });
}

function getJsonFormData() {
  const container = document.getElementById('json-form-fields');
  const result = {};
  container.querySelectorAll('[data-key]').forEach(el => {
    const key = el.dataset.key;
    const orig = currentJsonData[key];
    if (typeof orig === 'boolean') result[key] = el.value === 'true';
    else if (typeof orig === 'number') result[key] = Number(el.value);
    else if (typeof orig === 'object') { try { result[key] = JSON.parse(el.value); } catch { result[key] = el.value; } }
    else result[key] = el.value;
  });
  return result;
}

function switchJsonTab(tab, el) {
  document.querySelectorAll('#page-siteinfo .tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('#page-siteinfo .tab-pane').forEach(p => p.classList.remove('active'));
  el.classList.add('active');
  document.getElementById('json-' + tab + '-pane').classList.add('active');
  if (tab === 'raw') {
    // Sync form → raw
    try {
      const d = getJsonFormData();
      document.getElementById('json-raw-editor').value = JSON.stringify(d, null, 2);
    } catch(e) {}
  }
}

async function saveJsonForm() {
  const data = getJsonFormData();
  const content = JSON.stringify(data, null, 2);
  const r = await fetch('/admin/api/write-file', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({path: currentJsonPath, content})
  });
  const d = await r.json();
  const msg = document.getElementById('json-save-msg');
  if (d.ok) { toast('JSON saved'); msg.textContent = '✓ Saved'; msg.style.color = 'var(--green)'; }
  else { toast(d.msg, 'err'); msg.textContent = '✗ ' + d.msg; msg.style.color = 'var(--red)'; }
}

async function saveJsonRaw() {
  const content = document.getElementById('json-raw-editor').value;
  try { JSON.parse(content); } catch(e) { toast('Invalid JSON: ' + e.message, 'err'); return; }
  const r = await fetch('/admin/api/write-file', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({path: currentJsonPath, content})
  });
  const d = await r.json();
  if (d.ok) toast('JSON saved'); else toast(d.msg, 'err');
}

// ─── Markers Editor ──────────────────────────────────────────────────────────
let markersData = [];
let markersPath = '';

async function loadMarkers() {
  const r = await fetch('/admin/api/markers');
  const d = await r.json();
  markersData = d.data || [];
  markersPath = d.path || '';
  renderMarkersTable();
}

function renderMarkersTable() {
  const tbody = document.getElementById('markers-tbody');
  tbody.innerHTML = '';
  markersData.forEach((m, i) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><input type="text" value="${m.frequency||m.freq||''}" data-i="${i}" data-f="frequency"></td>
      <td><input type="text" value="${m.name||m.label||''}" data-i="${i}" data-f="name"></td>
      <td><input type="text" value="${m.mode||m.modulation||''}" data-i="${i}" data-f="mode"></td>
      <td><input type="text" value="${m.color||''}" data-i="${i}" data-f="color" style="width:80px"></td>
      <td><button class="btn btn-red" style="padding:.2rem .5rem;font-size:.7rem;" onclick="deleteMarker(${i})">✕</button></td>
    `;
    tbody.appendChild(tr);
  });
  tbody.querySelectorAll('input').forEach(inp => {
    inp.addEventListener('input', () => {
      const i = parseInt(inp.dataset.i);
      const f = inp.dataset.f;
      if (!markersData[i]) return;
      markersData[i][f] = f === 'frequency' ? (isNaN(Number(inp.value)) ? inp.value : Number(inp.value)) : inp.value;
      document.getElementById('markers-raw').value = JSON.stringify(markersData, null, 2);
    });
  });
  document.getElementById('markers-raw').value = JSON.stringify(markersData, null, 2);
}

function addMarker() {
  markersData.push({frequency: 0, name: "New Marker", mode: "AM", color: "#00ff41"});
  renderMarkersTable();
}

function deleteMarker(i) {
  markersData.splice(i, 1);
  renderMarkersTable();
}

async function saveMarkers() {
  const r = await fetch('/admin/api/markers', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({data: markersData})
  });
  const d = await r.json();
  const msg = document.getElementById('markers-save-msg');
  if (d.ok) { toast('Markers saved'); msg.textContent = '✓ Saved'; msg.style.color = 'var(--green)'; }
  else { toast(d.msg, 'err'); msg.textContent = '✗ ' + d.msg; msg.style.color = 'var(--red)'; }
}

// ─── Spot Reporting (autorun) ─────────────────────────────────────────────────
let AR_BANDS = [], AR_MODES = {}, AR_POLL = null;

async function autorunLoad() {
  try {
    const d = await fetch('/admin/api/autorun/config').then(r => r.json());
    AR_BANDS = d.bands; AR_MODES = d.modes;
    const c = d.config;
    document.getElementById('ar-call').value = c.identity.callsign || '';
    document.getElementById('ar-grid').value = c.identity.grid || '';
    document.getElementById('ar-psk').checked = !!c.reporting.pskreporter;
    document.getElementById('ar-wspr').checked = !!c.reporting.wsprnet;
    document.getElementById('ar-max').value = c.maxSlots || 12;
    const enabled = new Set((c.slots || []).filter(s => s.enabled).map(s => s.mode + ':' + s.band));
    autorunBuildMatrix(enabled);
    autorunPoll();
    if (!AR_POLL) AR_POLL = setInterval(autorunPoll, 5000);
  } catch (e) { toast('load failed: ' + e.message, 'err'); }
}

function autorunBuildMatrix(enabledSet) {
  const modes = Object.keys(AR_MODES);
  // The badge is filled by autorunPoll; it is empty (and hidden) until the
  // daemon reports a count, so a rebuild never shows a stale number.
  let h = '<thead><tr><th>BAND</th>' + modes.map(m =>
    '<th>' + m.toUpperCase() + '<span class="ar-hdr-badge" id="ar-hdr-' + m + '"></span></th>').join('') +
    '</tr></thead><tbody>';
  for (const band of AR_BANDS) {
    h += '<tr><td style="color:var(--amber)">' + band + '</td>';
    for (const m of modes) {
      const key = m + ':' + band;
      if (AR_MODES[m].includes(band)) {
        h += '<td style="white-space:nowrap;"><input type="checkbox" data-key="' + key +
             '" onchange="autorunCount()"' + (enabledSet.has(key) ? ' checked' : '') + '>' +
             '<span class="ar-slot-tot" data-slot="' + key + '"></span></td>';
      } else {
        h += '<td><span style="color:var(--text3)">&#8211;</span></td>';
      }
    }
    h += '</tr>';
  }
  document.getElementById('ar-matrix').innerHTML = h + '</tbody>';
  autorunCount();
}

function autorunGatherSlots() {
  const slots = [];
  document.querySelectorAll('#ar-matrix input[type=checkbox]').forEach(cb => {
    const [mode, band] = cb.dataset.key.split(':');
    slots.push({ band, mode, enabled: cb.checked });
  });
  return slots;
}

function autorunCount() {
  const n = document.querySelectorAll('#ar-matrix input:checked').length;
  const max = parseInt(document.getElementById('ar-max').value || '12', 10);
  const el = document.getElementById('ar-count');
  el.textContent = n + ' slot(s) enabled (cap ' + max + ')';
  el.style.color = n > max ? 'var(--red)' : 'var(--text3)';
}

async function autorunSave() {
  const body = {
    identity: { callsign: document.getElementById('ar-call').value.trim(), grid: document.getElementById('ar-grid').value.trim() },
    reporting: { pskreporter: document.getElementById('ar-psk').checked, wsprnet: document.getElementById('ar-wspr').checked },
    maxSlots: parseInt(document.getElementById('ar-max').value || '12', 10),
    slots: autorunGatherSlots(),
  };
  const d = await fetch('/admin/api/autorun/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json());
  toast(d.ok ? 'Config saved' : d.msg, d.ok ? 'ok' : 'err');
  document.getElementById('ar-msg').textContent = d.ok ? '✓ saved' : '✗ ' + d.msg;
  return d.ok;
}

async function autorunStart() {
  if (!(await autorunSave())) return;
  const d = await fetch('/admin/api/autorun/start', { method: 'POST' }).then(r => r.json());
  toast(d.msg, d.ok ? 'ok' : 'err'); setTimeout(autorunPoll, 800);
}
async function autorunStop() {
  const d = await fetch('/admin/api/autorun/stop', { method: 'POST' }).then(r => r.json());
  toast(d.msg, d.ok ? 'ok' : 'err'); setTimeout(autorunPoll, 500);
}
async function autorunFreeAll() {
  // Spell out the counter loss: the all-time totals are the one thing here
  // that a restart cannot bring back.
  if (!confirm('Clear all enabled bands/modes, stop the daemon, and erase the ' +
               'all-time spot counters next to every band?\\n\\n' +
               'The counters cannot be recovered.')) return;
  document.querySelectorAll('#ar-matrix input:checked').forEach(cb => cb.checked = false);
  document.getElementById('ar-psk').checked = false;
  document.getElementById('ar-wspr').checked = false;
  autorunCount();
  await autorunSave();
  // The endpoint stops the daemon itself and waits for it to exit before
  // deleting, because the daemon rewrites its totals on the way out.
  const d = await fetch('/admin/api/autorun/totals/reset', { method: 'POST' })
                    .then(r => r.json()).catch(e => ({ok: false, msg: e.message}));
  toast(d.ok ? 'Slots freed, counters cleared' : d.msg, d.ok ? 'ok' : 'err');
  autorunRenderSlotTotals({});          // clear the numbers without waiting for a poll
  setTimeout(autorunPoll, 600);
}

async function autorunPoll() {
  try {
    const d = await fetch('/admin/api/autorun/status').then(r => r.json());
    const dot = document.getElementById('ar-dot');
    if (!dot) return;
    dot.style.background = d.running ? 'var(--green)' : 'var(--text3)';
    document.getElementById('ar-state').textContent = d.running ? ('RUNNING (PID ' + (d.pids || []).join(',') + ')') : 'STOPPED';
    const s = d.status || {}, cn = s.counts || {}, rep = s.reporting || {};
    const fmt = t => t ? new Date(t * 1000).toLocaleTimeString('en-GB') : '—';
    const pending = (q, sent) => Math.max(0, (q || 0) - (sent || 0));
    document.getElementById('ar-status').innerHTML =
      'Reporting: PSK Reporter <b>' + (rep.pskreporter ? 'ON' : 'off') + '</b> &#183; wsprnet <b>' + (rep.wsprnet ? 'ON' : 'off') + '</b>' + (s.dryRun ? ' &#183; <span style="color:var(--amber)">DRY RUN</span>' : '') + '<br>' +
      'Decodes: ' + (cn.decodes || 0) + '<br>' +
      'PSK Reporter: <b>' + (cn.pskSent || 0) + '</b> sent, ' + pending(cn.pskQueued, cn.pskSent) + ' pending <span style="color:var(--text3)">(uploads every 5 min)</span><br>' +
      'wsprnet: <b>' + (cn.wsprSent || 0) + '</b> sent, ' + pending(cn.wsprQueued, cn.wsprSent) + ' pending <span style="color:var(--text3)">(every 2 min)</span><br>' +
      'Last decode: ' + fmt(s.lastDecodeAt) + ' &#183; Last upload: ' + fmt(s.lastUploadAt) + ' ' + (s.lastUploadMsg || '');
    autorunRenderSpots(s, d.running, rep);
    autorunRenderSlotTotals(d.totals || {});
  } catch (e) { /* ignore */ }
}

// All-time spots per band+mode, written next to that slot's checkbox.
// These come from autorun-totals.json, which the daemon keeps across restarts,
// so unlike the tiles above they are NOT reset by Stop/Start.
function autorunRenderSlotTotals(totals) {
  var any = false;
  document.querySelectorAll('.ar-slot-tot').forEach(function(el) {
    var t = totals[el.dataset.slot];
    var up = t ? (t.uploaded || 0) : 0;
    var dec = t ? (t.decodes || 0) : 0;
    // No entry at all = the daemon has never run this slot, so nothing to say.
    // An entry that is still all zeros DOES get a 0: the daemon seeds every
    // enabled slot at startup, and a blank cell there reads as a broken
    // counter rather than as "nothing heard yet". WSPR sits at zero for
    // minutes after a start — its cycle is 2 minutes — while FT8 is already
    // in the hundreds.
    if (!t) { el.textContent = ''; el.title = ''; return; }
    any = true;
    if (!up && !dec) {
      el.textContent = '0';
      el.classList.add('none');
      el.title = 'Enabled, nothing decoded yet — WSPR in particular can take ' +
                 'several minutes, since it transmits on a 2-minute cycle.';
      return;
    }
    // Uploaded is the headline; decodes explain a slot that hears plenty but
    // uploads nothing because its destination is off.
    el.textContent = up ? String(up) : '·' + dec;
    el.classList.toggle('none', !up);
    el.title = up + ' spots uploaded, ' + dec + ' decodes — all time for this band and mode' +
               (t.lastSpotAt ? '\\nlast upload ' + new Date(t.lastSpotAt * 1000).toLocaleString('en-GB') : '');
  });
  var note = document.getElementById('ar-slot-note');
  if (note) note.style.display = any ? 'block' : 'none';
}

// Fill the per-decoder tiles and the badges in the bands/modes header.
function autorunRenderSpots(s, running, rep) {
  const bm = (s && s.byMode) || {};
  // Which destination carries each decoder — a mode whose destination is off
  // decodes but never uploads, and saying "0" without that context reads as a
  // fault rather than a setting.
  const dest = {ft8: 'pskreporter', ft4: 'pskreporter', js8: 'pskreporter', wspr: 'wsprnet'};
  ['ft8', 'ft4', 'js8', 'wspr'].forEach(function(m) {
    const t   = bm[m] || null;
    const el  = document.getElementById('ar-up-' + m);
    const sub = document.getElementById('ar-sub-' + m);
    const hdr = document.getElementById('ar-hdr-' + m);
    if (!el) return;
    const up      = t ? (t.uploaded || 0) : 0;
    const dec     = t ? (t.decodes  || 0) : 0;
    const pending = t ? Math.max(0, (t.queued || 0) - up) : 0;
    const on      = !!(rep || {})[dest[m]];

    el.textContent = t ? up : '—';
    el.classList.toggle('idle', !t || up === 0);
    if (sub) {
      if (!t)              sub.textContent = running ? 'no slot enabled' : 'daemon stopped';
      else if (!on)        sub.innerHTML = dec + ' decodes · <span style="color:var(--amber)">reporting off</span>';
      else                 sub.textContent = dec + ' decodes · ' + pending + ' pending';
    }
    // Badge shows uploads only, and only once there are some — an empty badge
    // is hidden by CSS, keeping the header clean before the first upload.
    if (hdr) {
      hdr.textContent = (t && up) ? String(up) : '';
      hdr.title = (t && up) ? (up + ' spots uploaded since the daemon started') : '';
    }
  });
}

// ─── Logs ────────────────────────────────────────────────────────────────────
function getLogTargetId(logName) {
  return LOG_TAB_TARGETS[logName] || 'main-log-logwebsdr';
}

async function loadLogs(targetId, logName) {
  const id = targetId || 'dash-log';
  const name = logName || 'logwebsdr.txt';
  const r = await fetch('/admin/api/logs?name=' + encodeURIComponent(name));
  const d = await r.json();
  const el = document.getElementById(id);
  if (!el) return;
  el.innerHTML = '';
  (d.lines || []).forEach(line => {
    const div = document.createElement('div');
    div.className = line.match(/error|fail|crash/i) ? 'log-line-err' :
                    line.match(/warn/i) ? 'log-line-warn' :
                    line.match(/ok|success|started/i) ? 'log-line-ok' : '';
    div.textContent = line;
    el.appendChild(div);
  });
  if (!(d.lines || []).length) {
    const div = document.createElement('div');
    div.textContent = 'No log output found.';
    el.appendChild(div);
  }
  el.scrollTop = el.scrollHeight;
}

function switchLogTab(logName, el) {
  currentLogTab = logName;
  document.querySelectorAll('.log-tab').forEach(tab => tab.classList.remove('active'));
  document.querySelectorAll('.log-tab-pane').forEach(pane => pane.classList.remove('active'));
  if (el) el.classList.add('active');
  const paneId = LOG_TAB_PANES[logName];
  const pane = document.getElementById(paneId);
  if (pane) pane.classList.add('active');
  loadLogs(getLogTargetId(logName), logName);
}

function loadCurrentLogTab() {
  loadLogs(getLogTargetId(currentLogTab), currentLogTab);
}

async function clearLogView() {
  if (autoRefresh) toggleAutoRefresh();
  let d = {};
  try {
    const r = await fetch('/admin/api/logs/clear', {method: 'POST'});
    d = await r.json();
  } catch (e) {
    toast('Clear failed: ' + e, 'err');
    return;
  }
  const failed  = d.failed  || [];
  const skipped = d.skipped || [];
  const cleared = d.cleared || [];
  // Blank only the panes whose file was actually emptied. A pane blanked over a
  // file that is still on disk fills again at the next refresh, which reads as
  // the button being broken — so a log the server kept or could not write keeps
  // its lines on screen. CLEAR_EXCLUDE is empty now, so in practice this only
  // covers failures, but it stays correct if a log is ever excluded again.
  const keptPanes = new Set(skipped.concat(failed.map(f => f.name))
                                   .map(n => LOG_TAB_TARGETS[n]));
  ['dash-log', ...Object.values(LOG_TAB_TARGETS)].forEach(id => {
    if (keptPanes.has(id)) return;
    const el = document.getElementById(id);
    if (el) el.innerHTML = '';
  });
  // Say which files were actually emptied: a silent "Logs cleared" over a pane
  // that still has lines in it is what made this look broken.
  if (failed.length) {
    toast('Could not clear ' + failed.map(f => f.name + ' (' + f.error + ')').join(', '), 'err');
  } else {
    let msg = 'Cleared ' + (cleared.length ? cleared.join(', ') : 'nothing');
    if (skipped.length) msg += ' — kept ' + skipped.join(', ') + ' (excluded)';
    toast(msg);
  }
}

function toggleAutoRefresh() {
  autoRefresh = !autoRefresh;
  const btn = document.getElementById('auto-refresh-btn');
  if (autoRefresh) {
    btn.textContent = '⏸ STOP AUTO';
    btn.className = 'btn btn-red';
    autoRefreshTimer = setInterval(() => loadCurrentLogTab(), 3000);
  } else {
    btn.textContent = '⏵ AUTO REFRESH';
    btn.className = 'btn btn-green';
    clearInterval(autoRefreshTimer);
  }
}

// ─── Chat ────────────────────────────────────────────────────────────────────
async function loadChat() {
  const r = await fetch('/admin/api/chat');
  const d = await r.json();
  const el = document.getElementById('chat-log');
  el.innerHTML = '';
  (d.messages || []).forEach(m => {
    const div = document.createElement('div');
    div.className = 'chat-msg';

    const txt = document.createElement('span');
    txt.className = 'chat-msg-text';
    txt.innerHTML = `<span class="chat-time">[${m.time||'?'}]</span> <span class="chat-nick">&lt;${m.nick||'?'}&gt;</span> ${escHtml(m.msg||'')}`;

    const delBtn = document.createElement('button');
    delBtn.className = 'chat-del-btn';
    delBtn.title = 'Delete this message';
    delBtn.textContent = '✕ DEL';
    delBtn.onclick = async function() {
      if (!confirm('Delete this message?\\n\\n' + (m.time ? '[' + m.time + '] ' : '') + '<' + m.nick + '> ' + m.msg)) return;
      try {
        const res = await fetch('/admin/api/chat/delete', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({line: m.raw})
        });
        const rd = await res.json();
        if (rd.ok) { div.remove(); toast('Message deleted'); }
        else toast(rd.msg || 'Delete failed', 'err');
      } catch(e) { toast('Network error: ' + e.message, 'err'); }
    };

    div.appendChild(txt);
    div.appendChild(delBtn);
    el.appendChild(div);
  });
  if (!d.messages?.length) el.textContent = 'No chat history found.';
  el.scrollTop = el.scrollHeight;
}

async function clearChat() {
  if (!confirm('Clear chat history?')) return;
  const r = await fetch('/admin/api/chat/clear', {method:'POST'});
  const d = await r.json();
  if (d.ok) { toast('Chat cleared'); loadChat(); } else toast(d.msg, 'err');
}

// ─── Settings ────────────────────────────────────────────────────────────────
async function loadSettingsPage() {
  const r = await fetch('/admin/api/settings');
  const d = await r.json();
  document.getElementById('sdr-dir').value = d.sdr_base_dir || '';
  const ppEl = document.getElementById('public-port');
  if (ppEl) ppEl.value = d.public_port || 8900;
  // Populate start/stop script selectors
  const sh = await fetch('/admin/api/scripts').then(r => r.json());
  const all = sh.all || [];
  ['default-start-sel','default-stop-sel'].forEach(id => {
    const sel = document.getElementById(id);
    if (!sel) return;
    sel.innerHTML = '<option value="">-- None --</option>';
    all.forEach(s => {
      const o = document.createElement('option');
      o.value = s; o.textContent = s;
      sel.appendChild(o);
    });
  });
  if (document.getElementById('default-start-sel'))
    document.getElementById('default-start-sel').value = d.start_script || '';
  if (document.getElementById('default-stop-sel'))
    document.getElementById('default-stop-sel').value = d.stop_script || '';
  loadThermalSettings(d);
}

// ─── Thermal guard settings ──────────────────────────────────────────────────
const TG_FIELDS = {
  'tg-cfg-warn':        'thermal_warn',
  'tg-cfg-throttle':    'thermal_throttle',
  'tg-cfg-stop':        'thermal_stop',
  'tg-cfg-resume':      'thermal_resume',
  'tg-cfg-sustain':     'thermal_sustain_s',
  'tg-cfg-warnsustain': 'thermal_warn_sustain_s',
  'tg-cfg-resumes':     'thermal_resume_s',
  'tg-cfg-maxstops':    'thermal_max_stops_hour',
  'tg-cfg-test':        'thermal_test_temp',
};

function loadThermalSettings(d) {
  const mode = document.getElementById('tg-cfg-mode');
  if (!mode) return;
  if (d.thermal_mode === undefined) return;   // guard not loaded server-side
  mode.value = d.thermal_mode || 'log';
  const en = document.getElementById('tg-cfg-enabled');
  if (en) en.value = (d.thermal_enabled === false) ? '0' : '1';
  for (const [id, key] of Object.entries(TG_FIELDS)) {
    const el = document.getElementById(id);
    if (el) el.value = (d[key] === null || d[key] === undefined) ? '' : d[key];
  }
  fetch('/admin/api/thermal').then(r => r.json()).then(t => {
    const c = document.getElementById('tg-cfg-crit');
    if (!c) return;
    if (!t.available)   { c.textContent = 'guard not loaded'; return; }
    if (!t.sensor)      { c.textContent = 'no trusted CPU sensor found'; return; }
    c.textContent = t.crit ? (t.sensor + ', crit ' + t.crit + '°C')
                           : (t.sensor + ', no crit published — set STOP manually');
  }).catch(() => {});
}

async function saveThermal() {
  const body = {
    thermal_mode: document.getElementById('tg-cfg-mode').value,
    thermal_enabled: document.getElementById('tg-cfg-enabled').value === '1',
  };
  for (const [id, key] of Object.entries(TG_FIELDS)) {
    const el = document.getElementById(id);
    if (!el) continue;
    const v = el.value.trim();
    body[key] = (v === '') ? null : parseFloat(v);
  }
  const d = await fetch('/admin/api/settings', {
    method: 'POST', headers: {'Content-Type':'application/json'},
    body: JSON.stringify(body)
  }).then(r => r.json());
  if (d.ok) {
    toast('Thermal settings saved');
    document.getElementById('tg-cfg-msg').textContent =
      'Saved — applied on the next sample (within a few seconds), no restart needed';
    loadSettingsPage();
    updateThermal();
  } else toast(d.msg || 'Failed', 'err');
}

async function saveSettings() {
  const dir   = document.getElementById('sdr-dir').value.trim();
  const start = document.getElementById('default-start-sel')?.value || '';
  const stop  = document.getElementById('default-stop-sel')?.value || '';
  const pp    = parseInt(document.getElementById('public-port')?.value || '8900', 10);
  const r = await fetch('/admin/api/settings', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({sdr_base_dir: dir, start_script: start, stop_script: stop, public_port: pp})
  });
  const d = await r.json();
  if (d.ok) {
    toast('Settings saved');
    document.getElementById('settings-msg').textContent = 'Saved';
  } else toast(d.msg, 'err');
}

async function changePassword(e) {
  e.preventDefault();
  const old = document.getElementById('old-pwd').value;
  const n = document.getElementById('new-pwd').value;
  const n2 = document.getElementById('new-pwd2').value;
  if (n !== n2) { toast('Passwords do not match', 'err'); return; }
  if (n.length < 4) { toast('Password too short (min 4)', 'err'); return; }
  const r = await fetch('/admin/api/change-password', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({old, new_pwd: n})
  });
  const d = await r.json();
  if (d.ok) { toast('Password changed'); document.getElementById('old-pwd').value=''; document.getElementById('new-pwd').value=''; document.getElementById('new-pwd2').value=''; }
  else toast(d.msg, 'err');
}
function escHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
function isLocalIp(ip) {
  if (!ip) return false;
  var raw = ip.startsWith('::ffff:') ? ip.slice(7) : ip;
  if (raw === '::1' || raw === 'localhost') return true;
  return /^127\\./.test(raw) || /^10\\./.test(raw) || /^192\\.168\\./.test(raw) ||
         /^172\\.(1[6-9]|2\\d|3[01])\\./.test(raw) || /^fc/i.test(raw) || /^fd/i.test(raw);
}

// ─── Users / Kick ────────────────────────────────────────────────────────────
let _usersAutoTimer = null;

var _uConnTimes = {};

function _uFmtFreq(khz) {
  if (khz == null || isNaN(khz)) return '--';
  if (khz >= 50) return (khz / 1000).toFixed(3) + ' MHz';
  return khz.toFixed(3) + ' kHz';
}

function _uFmtDur(ms) {
  var s  = Math.floor(ms / 1000);
  var h  = Math.floor(s / 3600);
  var m  = Math.floor((s % 3600) / 60);
  var ss = s % 60;
  if (h > 0) return h + ':' + String(m).padStart(2,'0') + ':' + String(ss).padStart(2,'0');
  return m + ':' + String(ss).padStart(2,'0');
}

function _uTickDurations() {
  var now = Date.now();
  document.querySelectorAll('td.u-dur-cell[data-uid]').forEach(function(td) {
    var t = _uConnTimes[td.dataset.uid];
    if (t) td.textContent = _uFmtDur(now - t);
  });
}

setInterval(function(){ if (currentPage === 'users') _uTickDurations(); }, 1000);

// ─── Graphs page ─────────────────────────────────────────────────────────────
// Four measures with four different units (GHz, %, degC, a head-count).  They
// are drawn as four stacked panels sharing one time axis rather than as one
// chart with several y-scales: a shared scale would imply the curves are
// comparable, and the crossings it produced would be an artefact of the scaling.
var _gPoints   = [];      // full history, oldest first
var _gRange    = 900;     // visible window, seconds
var _gLast     = 0;       // newest sample timestamp we hold
var _gMeta     = {interval: 2, freq_limit: null, cores: null, coarse: false};
var _gTimer    = null;
var _gHover    = null;    // index under the pointer, or null

var GRAPH_PANELS = [
  {key:'f', title:'CPU FREQUENCY', unit:'GHz', dec:2},
  {key:'l', title:'CPU LOAD',      unit:'%',   dec:0},
  {key:'c', title:'CPU TEMPERATURE', unit:'°C', dec:1},
  {key:'u', title:'USERS ONLINE',  unit:'',    dec:0, step:true}
];

// One hue for every panel: each panel holds a single series that its own title
// names, so colour is not carrying identity here and four competing hues would
// only add noise.  Colour is kept in reserve for temperature, where it means
// something specific.
var G_LINE = '#00ff41', G_FILL = 'rgba(0,255,65,0.10)';
var G_WARN = '#ffb000', G_CRIT = '#ff4040';
var TEMP_WARN = 70, TEMP_CRIT = 80;

function graphTempColor(v) {
  if (v === null || v === undefined) return G_LINE;
  if (v >= TEMP_CRIT) return G_CRIT;
  if (v >= TEMP_WARN) return G_WARN;
  return G_LINE;
}

function graphSetRange(sec, el) {
  _gRange = sec;
  document.querySelectorAll('.graph-range').forEach(function(b) {
    b.classList.toggle('active', b === el);
  });
  // Ranges are served from different tiers (2s live, 30s averages beyond an
  // hour), so the held points are not interchangeable — refetch rather than
  // splice two resolutions into one series.
  _gPoints = []; _gLast = 0;
  loadGraphs(false);
}

async function loadGraphs(incremental) {
  var want = _gRange;
  try {
    var url = '/admin/api/graph-stats?range=' + want +
              (incremental && _gLast ? '&since=' + _gLast : '');
    var r = await fetch(url, {cache: 'no-store'});
    var d = await r.json();
    if (!d.ok) return;
    // A slow reply that lands after the range changed again would mix
    // resolutions; drop it and let the newer request stand.
    if (want !== _gRange) return;
    var restart = _gMeta.interval && d.interval !== _gMeta.interval;
    _gMeta = {interval: d.interval, freq_limit: d.freq_limit, cores: d.cores, coarse: d.coarse};
    var pts = d.points || [];
    if (incremental && _gLast) {
      if (pts.length) _gPoints = _gPoints.concat(pts);
    } else {
      _gPoints = pts;
    }
    if (_gPoints.length) _gLast = _gPoints[_gPoints.length - 1].t;
    // Drop anything older than the window so the buffer here cannot grow
    // without bound over a long-lived session.
    var cutoff = _gLast - want;
    _gPoints = _gPoints.filter(function(p) { return p.t >= cutoff; });
    // Poll on the tier's cadence: 2s on the live view, no faster than new
    // points appear on the aggregated ones.
    if (restart) graphSchedulePoll();
    drawGraphs();
  } catch (e) { /* transient fetch error: keep what we have and retry next tick */ }
}

function graphSchedulePoll() {
  if (_gTimer) clearInterval(_gTimer);
  _gTimer = setInterval(function() {
    if (currentPage === 'graphs' && !document.hidden) loadGraphs(true);
  }, (_gMeta.interval || 2) * 1000);
}

function graphVisible() {
  var cut = (_gPoints.length ? _gPoints[_gPoints.length - 1].t : 0) - _gRange;
  return _gPoints.filter(function(p) { return p.t >= cut; });
}

function graphFmt(v, p) {
  if (v === null || v === undefined) return '--';
  return v.toFixed(p.dec) + (p.unit ? ' ' + p.unit : '');
}

// Top of a panel's y-scale.  Single source of truth: the plot and the hover
// markers must agree, and computing it twice is how they stop agreeing.
// Every scale starts at zero, so curve height stays proportional to the value.
function graphTop(p, pts) {
  var vals = pts.map(function(q) { return q[p.key]; })
                .filter(function(v) { return v !== null && v !== undefined; });
  if (p.key === 'l') return 100;
  if (p.key === 'f') return _gMeta.freq_limit ||
                            (vals.length ? Math.max.apply(null, vals) * 1.15 : 1);
  if (p.key === 'c') return Math.max(80, vals.length
                            ? Math.ceil(Math.max.apply(null, vals) / 10) * 10 : 80);
  return Math.ceil(Math.max(4, vals.length ? Math.max.apply(null, vals) : 1));
}

function drawGraphs() {
  var cv = document.getElementById('graph-canvas');
  var empty = document.getElementById('graph-empty');
  if (!cv) return;
  var pts = graphVisible();

  var info = document.getElementById('graph-info-label');
  if (info) {
    // Say plainly when a view is averaged: a 30s mean and a 2s reading are not
    // the same measurement, and the peaks differ between them.
    info.textContent = (_gMeta.coarse ? _gMeta.interval + 's averages' : 'sampling every ' + _gMeta.interval + 's') +
      ' · ' + pts.length + ' points shown' + (_gMeta.cores ? ' · ' + _gMeta.cores + ' cores' : '');
  }

  // Current-value tiles always reflect the newest sample, not the hover.
  var last = _gPoints.length ? _gPoints[_gPoints.length - 1] : null;
  var setTile = function(id, val, p) {
    var el = document.getElementById(id);
    if (el) el.textContent = (val === null || val === undefined) ? '--' : val.toFixed(p);
  };
  setTile('g-cur-freq', last ? last.f : null, 2);
  setTile('g-cur-load', last ? last.l : null, 0);
  setTile('g-cur-temp', last ? last.c : null, 1);
  setTile('g-cur-users', last ? last.u : null, 0);
  var tempEl = document.getElementById('g-cur-temp');
  if (tempEl && last) tempEl.style.color = graphTempColor(last.c);
  var fsub = document.getElementById('g-sub-freq');
  if (fsub) fsub.textContent = 'GHz average' + (last && last.fm ? ' · peak core ' + last.fm.toFixed(2) : '');
  var tsub = document.getElementById('g-sub-temp');
  if (tsub && last && last.c !== null && last.c !== undefined) {
    tsub.textContent = last.c >= TEMP_CRIT ? 'degrees C · CRITICAL'
                     : last.c >= TEMP_WARN ? 'degrees C · WARM' : 'degrees C';
  }

  if (pts.length < 2) {
    cv.style.display = 'none';
    if (empty) {
      empty.style.display = 'block';
      empty.textContent = _gMeta.coarse
        ? 'Collecting data — this view plots ' + _gMeta.interval + 's averages, so it fills in as the panel keeps running.'
        : 'Collecting data — a sample is taken every ' + _gMeta.interval + 's, so the first curve appears within a few seconds.';
    }
    return;
  }
  cv.style.display = 'block';
  if (empty) empty.style.display = 'none';

  // ── geometry ──
  var dpr = window.devicePixelRatio || 1;
  var cssW = cv.clientWidth || 800;
  // Type sizes are named once here: the panel geometry is sized around them,
  // so bumping a size and leaving the padding behind is not possible.
  var F_TITLE = '600 13px Orbitron, monospace';          // panel heading
  var F_AXIS  = '12px "Share Tech Mono", monospace';     // tick + min/max labels
  var F_NOTE  = '11px "Share Tech Mono", monospace';     // threshold legend
  var PANEL_H = 100, GAP = 36, PAD_L = 64, PAD_R = 14, PAD_T = 22, AXIS_H = 28;
  var cssH = PAD_T + GRAPH_PANELS.length * (PANEL_H + GAP) + AXIS_H;
  cv.style.height = cssH + 'px';
  cv.width = Math.round(cssW * dpr);
  cv.height = Math.round(cssH * dpr);
  var ctx = cv.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssW, cssH);

  var narrow = cssW < 680;
  var t0 = pts[0].t, t1 = pts[pts.length - 1].t;
  if (t1 === t0) t1 = t0 + 1;
  var plotW = cssW - PAD_L - PAD_R;
  var xOf = function(t) { return PAD_L + (t - t0) / (t1 - t0) * plotW; };

  GRAPH_PANELS.forEach(function(p, pi) {
    var top = PAD_T + pi * (PANEL_H + GAP);
    var bot = top + PANEL_H;
    var vals = pts.map(function(q) { return q[p.key]; })
                  .filter(function(v) { return v !== null && v !== undefined; });

    var hi = graphTop(p, pts);
    var yOf = function(v) { return bot - (v / hi) * PANEL_H; };

    // ── panel title + range label ──
    ctx.font = F_TITLE;
    ctx.fillStyle = '#7ab87a';
    ctx.textAlign = 'left';
    ctx.fillText(p.title, PAD_L, top - 8);
    if (p.key === 'c' && !narrow) {
      // The threshold legend lives in the title row.  In the plot the two
      // guides can end up ~9px apart, where their labels would collide with
      // each other and with this title.  On a phone the row is only wide
      // enough for the title and the min/max, so the legend is dropped there
      // and the dashed guides speak for themselves.
      var tw = ctx.measureText(p.title).width;
      ctx.font = F_NOTE;
      ctx.fillStyle = G_WARN; ctx.fillText('– – ' + TEMP_WARN + '° warm', PAD_L + tw + 12, top - 8);
      var ww = ctx.measureText('– – ' + TEMP_WARN + '° warm').width;
      ctx.fillStyle = G_CRIT; ctx.fillText('– – ' + TEMP_CRIT + '° critical', PAD_L + tw + ww + 24, top - 8);
    }
    if (vals.length) {
      ctx.font = F_AXIS;
      ctx.fillStyle = '#4a8a4a';
      ctx.textAlign = 'right';
      var lo = Math.min.apply(null, vals), up = Math.max.apply(null, vals);
      // On a narrow canvas the spelled-out form runs into the panel title, so
      // it collapses to a range: same two numbers, roughly half the width.
      ctx.fillText(narrow ? (lo.toFixed(p.dec) + ' – ' + graphFmt(up, p))
                          : ('min ' + graphFmt(lo, p) + '   max ' + graphFmt(up, p)),
                   cssW - PAD_R, top - 8);
    }

    // ── recessive grid: baseline plus mid and top gridlines only ──
    ctx.strokeStyle = 'rgba(26,58,26,0.9)';
    ctx.lineWidth = 1;
    ctx.font = F_AXIS;
    ctx.textAlign = 'right';
    [0, hi / 2, hi].forEach(function(gv) {
      var y = Math.round(yOf(gv)) + 0.5;
      ctx.beginPath(); ctx.moveTo(PAD_L, y); ctx.lineTo(cssW - PAD_R, y); ctx.stroke();
      ctx.fillStyle = '#4a8a4a';
      var lbl = (p.key === 'u') ? String(Math.round(gv)) : gv.toFixed(p.dec === 2 ? 1 : 0);
      ctx.fillText(lbl, PAD_L - 8, y + 4);
    });

    if (!vals.length) {
      ctx.font = F_AXIS;
      ctx.fillStyle = '#4a8a4a';
      ctx.textAlign = 'center';
      ctx.fillText('not available on this system', PAD_L + plotW / 2, top + PANEL_H / 2);
      return;
    }

    // ── segments: a null reading breaks the line instead of being bridged,
    // so a gap in the data never looks like a measured value. ──
    var segs = [], cur = [];
    pts.forEach(function(q) {
      var v = q[p.key];
      if (v === null || v === undefined) { if (cur.length) { segs.push(cur); cur = []; } }
      else cur.push(q);
    });
    if (cur.length) segs.push(cur);

    segs.forEach(function(seg) {
      // continueFrom: append to the current subpath instead of starting a new
      // one.  The fill has already moved to the baseline, and a moveTo there
      // would break the polygon into two subpaths and fill the space between.
      var trace = function(continueFrom) {
        seg.forEach(function(q, i) {
          var x = xOf(q.t), y = yOf(q[p.key]);
          if (i === 0) {
            if (continueFrom) ctx.lineTo(x, y); else ctx.moveTo(x, y);
            return;
          }
          if (p.step) ctx.lineTo(x, yOf(seg[i - 1][p.key]));   // hold, then move
          ctx.lineTo(x, y);
        });
      };
      if (seg.length > 1) {
        ctx.beginPath();
        ctx.moveTo(xOf(seg[0].t), bot);
        trace(true);
        ctx.lineTo(xOf(seg[seg.length - 1].t), bot);
        ctx.closePath();
        ctx.fillStyle = G_FILL;
        ctx.fill();
      }
      ctx.lineWidth = 2;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      if (p.key === 'c') {
        // Colour tracks each reading, so the line changes hue exactly where it
        // crosses a threshold.  Colouring the whole run by one value would
        // paint cool history as if it had been hot.
        for (var i = 1; i < seg.length; i++) {
          ctx.beginPath();
          ctx.moveTo(xOf(seg[i - 1].t), yOf(seg[i - 1].c));
          ctx.lineTo(xOf(seg[i].t), yOf(seg[i].c));
          ctx.strokeStyle = graphTempColor(Math.max(seg[i].c, seg[i - 1].c));
          ctx.stroke();
        }
      } else {
        ctx.beginPath();
        trace(false);
        ctx.strokeStyle = G_LINE;
        ctx.stroke();
      }
      if (seg.length === 1) {   // a lone sample still deserves to be visible
        ctx.beginPath();
        ctx.arc(xOf(seg[0].t), yOf(seg[0][p.key]), 2.5, 0, Math.PI * 2);
        ctx.fillStyle = (p.key === 'c') ? graphTempColor(seg[0].c) : G_LINE;
        ctx.fill();
      }
    });

    // Temperature thresholds are the one place colour means something, so the
    // line it refers to is drawn and labelled rather than left implicit.
    if (p.key === 'c') {
      [[TEMP_WARN, 'rgba(255,176,0,', 'warm'], [TEMP_CRIT, 'rgba(255,64,64,', 'critical']]
        .forEach(function(th) {
          if (hi < th[0]) return;
          var ty = Math.round(yOf(th[0])) + 0.5;
          ctx.save();
          ctx.setLineDash([3, 3]);
          ctx.strokeStyle = th[1] + '0.45)';
          ctx.beginPath(); ctx.moveTo(PAD_L, ty); ctx.lineTo(cssW - PAD_R, ty); ctx.stroke();
          ctx.restore();
        });
    }
  });

  // ── shared time axis ──
  var axisY = PAD_T + GRAPH_PANELS.length * (PANEL_H + GAP) - GAP + 14;
  ctx.font = F_AXIS;
  ctx.fillStyle = '#4a8a4a';
  ctx.textAlign = 'center';
  var TICKS = Math.max(2, Math.min(6, Math.floor(plotW / 130)));
  for (var i = 0; i <= TICKS; i++) {
    var tt = t0 + (t1 - t0) * i / TICKS;
    var lbl = new Date(tt * 1000).toLocaleTimeString('en-GB', {hour: '2-digit', minute: '2-digit'});
    var x = xOf(tt);
    ctx.textAlign = (i === 0) ? 'left' : (i === TICKS ? 'right' : 'center');
    ctx.fillText(lbl, x, axisY);
  }

  // ── crosshair + tooltip ──
  if (_gHover !== null && _gHover >= 0 && _gHover < pts.length) {
    var hp = pts[_gHover];
    var hx = xOf(hp.t);
    ctx.save();
    ctx.setLineDash([2, 3]);
    ctx.strokeStyle = 'rgba(200,255,200,0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(hx + 0.5, PAD_T - 8);
    ctx.lineTo(hx + 0.5, PAD_T + GRAPH_PANELS.length * (PANEL_H + GAP) - GAP);
    ctx.stroke();
    ctx.restore();
    GRAPH_PANELS.forEach(function(p, pi) {
      var v = hp[p.key];
      if (v === null || v === undefined) return;
      var top = PAD_T + pi * (PANEL_H + GAP), bot = top + PANEL_H;
      var y = bot - (v / graphTop(p, pts)) * PANEL_H;
      ctx.beginPath();
      ctx.arc(hx, y, 4, 0, Math.PI * 2);
      ctx.fillStyle = (p.key === 'c') ? graphTempColor(v) : G_LINE;
      ctx.fill();
      ctx.lineWidth = 2;                       // surface ring keeps the marker
      ctx.strokeStyle = '#0a150a';             // readable on top of the line
      ctx.stroke();
    });
  }
}

function graphHover(ev) {
  var cv = document.getElementById('graph-canvas');
  var tip = document.getElementById('graph-tooltip');
  if (!cv || !tip) return;
  var pts = graphVisible();
  if (pts.length < 2) return;
  var rect = cv.getBoundingClientRect();
  var x = ev.clientX - rect.left;
  var PAD_L = 52, PAD_R = 12;
  var plotW = rect.width - PAD_L - PAD_R;
  var t0 = pts[0].t, t1 = pts[pts.length - 1].t;
  var frac = Math.max(0, Math.min(1, (x - PAD_L) / plotW));
  var want = t0 + frac * (t1 - t0);
  var best = 0, bestD = Infinity;
  pts.forEach(function(p, i) {
    var d = Math.abs(p.t - want);
    if (d < bestD) { bestD = d; best = i; }
  });
  _gHover = best;
  var p = pts[best];
  var rows = GRAPH_PANELS.map(function(pl) {
    var v = p[pl.key];
    return '<div style="display:flex;gap:.8rem;justify-content:space-between;">' +
           '<span style="color:var(--text3);">' + pl.title + '</span>' +
           '<span style="color:' + ((pl.key === 'c') ? graphTempColor(v) : 'var(--text)') + ';">' +
           graphFmt(v === undefined ? null : v, pl) + '</span></div>';
  }).join('');
  tip.innerHTML = '<div style="color:var(--green);margin-bottom:.25rem;">' +
    new Date(p.t * 1000).toLocaleTimeString('en-GB') + '</div>' + rows;
  tip.style.display = 'block';
  // Flip the tooltip to the other side near the right edge so it never
  // overflows the card it lives in.
  var card = cv.parentElement;
  var cardRect = card.getBoundingClientRect();
  var tw = tip.offsetWidth || 150;
  var left = ev.clientX - cardRect.left + 14;
  if (left + tw > cardRect.width) left = ev.clientX - cardRect.left - tw - 14;
  tip.style.left = Math.max(4, left) + 'px';
  tip.style.top  = (ev.clientY - cardRect.top + 12) + 'px';
  drawGraphs();
}

function graphLeave() {
  _gHover = null;
  var tip = document.getElementById('graph-tooltip');
  if (tip) tip.style.display = 'none';
  drawGraphs();
}

function initGraphs() {
  var cv = document.getElementById('graph-canvas');
  if (cv && !cv._wired) {
    cv._wired = true;
    cv.parentElement.style.position = 'relative';
    cv.addEventListener('mousemove', graphHover);
    cv.addEventListener('mouseleave', graphLeave);
    window.addEventListener('resize', function() { if (currentPage === 'graphs') drawGraphs(); });
  }
  loadGraphs(false);
  graphSchedulePoll();
}

async function loadUsers() {
  var tbody = document.getElementById('users-tbody');
  var info  = document.getElementById('users-info-label');
  var errEl = document.getElementById('users-error');
  var CL = 'padding:.38rem .6rem;border-bottom:1px solid var(--border);vertical-align:middle;';
  function msgRow(msg, color) {
    tbody.innerHTML = '';
    var tr = document.createElement('tr'); var td = document.createElement('td');
    td.colSpan = 5;
    td.style.cssText = 'color:' + (color||'var(--text3)') + ';text-align:center;padding:.8rem;';
    td.textContent = msg; tr.appendChild(td); tbody.appendChild(tr);
  }
  if (tbody) msgRow('Loading...', 'var(--text3)');
  try {
    var r = await fetch('/users', {cache: 'no-store'});
    if (!r.ok) throw new Error('HTTP ' + r.status);
    var data = await r.json();
    var users = data.users || [];
    if (errEl) errEl.style.display = 'none';
    if (info)  info.textContent = users.length + ' connected';
    if (!tbody) return;
    if (!users.length) { msgRow('No users currently connected', ''); return; }
    var now = Date.now();
    tbody.innerHTML = '';
    users.forEach(function(u) {
      if (!_uConnTimes[u.id])
        _uConnTimes[u.id] = now - (u.duration_s || 0) * 1000;
      var tr = document.createElement('tr');
      // IP / location
      var tdGeo = document.createElement('td');
      tdGeo.style.cssText = CL + 'color:var(--green);';
      if (isLocalIp(u.ip) || u.geo === 'Local') {
        tdGeo.textContent = 'Local';
      } else if (u.geo && u.geo !== u.ip) {
        tdGeo.textContent = u.geo;
        tdGeo.title = u.ip;
      } else {
        tdGeo.textContent = u.ip || '--';
      }
      tr.appendChild(tdGeo);
      // Frequency
      var tdF = document.createElement('td');
      tdF.style.cssText = CL + 'color:var(--amber);';
      tdF.textContent = _uFmtFreq(u.freq_khz);
      tr.appendChild(tdF);
      // Mode
      var tdM = document.createElement('td');
      tdM.style.cssText = CL + 'color:var(--text2);font-size:.7rem;';
      tdM.textContent = (u.mode || '--').toUpperCase();
      tr.appendChild(tdM);
      // Duration (live ticking)
      var tdDur = document.createElement('td');
      tdDur.className = 'u-dur-cell';
      tdDur.dataset.uid = u.id;
      tdDur.style.cssText = CL + 'color:var(--blue);font-variant-numeric:tabular-nums;';
      tdDur.textContent = _uFmtDur(now - _uConnTimes[u.id]);
      tr.appendChild(tdDur);
      // Kick button
      var tdK = document.createElement('td');
      tdK.style.cssText = CL;
      var rawIp = (u.ip||'').replace(/^::ffff:/,'');
      if (rawIp && rawIp !== '127.0.0.1' && rawIp !== '::1') {
        var btn = document.createElement('button');
        btn.className = 'btn btn-red';
        btn.style.cssText = 'padding:.25rem .6rem;font-size:.65rem;';
        btn.textContent = '⚡ KICK';
        btn.onclick = (function(ip){ return function(){ kickUser(ip); }; })(rawIp);
        tdK.appendChild(btn);
      }
      tr.appendChild(tdK);
      tbody.appendChild(tr);
    });
    var liveIds = new Set(users.map(function(u){ return u.id; }));
    Object.keys(_uConnTimes).forEach(function(id){
      if (!liveIds.has(id)) delete _uConnTimes[id];
    });
  } catch(e) {
    if (errEl) { errEl.textContent = 'Cannot reach /users: ' + e.message; errEl.style.display = 'block'; }
    if (tbody)  msgRow('Error: ' + e.message, 'var(--red)');
  }
}

async function kickUser(ip) {
  if (!confirm('Kick ' + ip + '? This will disconnect all their connections.')) return;
  try {
    var r = await fetch('/admin/api/kick', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ip: ip})
    });
    var d = await r.json();
    if (d.ok) { toast('Kicked ' + ip); setTimeout(loadUsers, 1800); }
    else toast(d.msg || 'Kick failed', 'err');
  } catch(e) {
    toast('Kick sent — refreshing...', 'ok');
    setTimeout(loadUsers, 2000);
  }
}

function toggleUsersAutoRefresh() {
  var btn = document.getElementById('users-auto-btn');
  if (_usersAutoTimer) {
    clearInterval(_usersAutoTimer); _usersAutoTimer = null;
    if (btn) { btn.textContent = '▶ AUTO'; btn.classList.replace('btn-amber','btn-green'); }
  } else {
    loadUsers();
    _usersAutoTimer = setInterval(function(){
      if (currentPage === 'users') loadUsers();
      else { clearInterval(_usersAutoTimer); _usersAutoTimer = null; }
    }, 5000);
    if (btn) { btn.textContent = '⏸ AUTO ON'; btn.classList.replace('btn-green','btn-amber'); }
  }
}

// ── Waterfall Message ─────────────────────────────────────────────────────────
document.getElementById('wfmsg-text')?.addEventListener('input', function() {
  var n = this.value.length;
  var el = document.getElementById('wfmsg-charcount');
  if (el) { el.textContent = n + ' / 200'; el.style.color = n > 180 ? 'var(--amber)' : 'var(--text3)'; }
});

async function sendWfMsg() {
  var text  = (document.getElementById('wfmsg-text')?.value || '').trim();
  var color = document.getElementById('wfmsg-color')?.value || '#ffffff';
  var el    = document.getElementById('wfmsg-status');
  if (!text) { el.textContent = '⚠ Message cannot be empty.'; el.style.color = 'var(--red)'; return; }
  el.textContent = 'Broadcasting…'; el.style.color = 'var(--text3)';
  try {
    var r = await fetch('/admin/api/wf-message', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({text: text, color: color})
    });
    var d = await r.json();
    if (d.ok) {
      el.textContent = '✓ Live! All users will see it within 10 s.';
      el.style.color = 'var(--green)';
      var a = document.getElementById('wfmsg-active');
      if (a) { a.textContent = text; a.style.color = 'var(--green)'; }
      toast('WF message broadcast');
    } else {
      el.textContent = '✗ ' + (d.msg || 'Error'); el.style.color = 'var(--red)';
    }
  } catch(e) { el.textContent = '✗ Network error: ' + e.message; el.style.color = 'var(--red)'; }
}

async function clearWfMsg() {
  var el = document.getElementById('wfmsg-status');
  el.textContent = 'Clearing…'; el.style.color = 'var(--text3)';
  try {
    await fetch('/admin/api/wf-message', {method: 'DELETE'});
    el.textContent = '✓ Cleared. Banner disappears within 10 s.';
    el.style.color = 'var(--text3)';
    var a = document.getElementById('wfmsg-active');
    if (a) { a.textContent = '—'; a.style.color = 'var(--text3)'; }
    toast('WF message cleared');
  } catch(e) { el.textContent = '✗ Network error'; el.style.color = 'var(--red)'; }
}

async function loadWfMsgStatus() {
  try {
    var r = await fetch('/admin/api/wf-message');
    var d = await r.json();
    var a = document.getElementById('wfmsg-active');
    if (!a) return;
    a.textContent = d.text || '—';
    a.style.color  = d.text ? 'var(--green)' : 'var(--text3)';
  } catch(_) {}
}

// ─── Init ────────────────────────────────────────────────────────────────────
loadDashboard();
</script>
</body>
</html>"""

# ─── Routes ────────────────────────────────────────────────────────────────────

@app.route("/admin")
@app.route("/admin/")
def login():
    if session.get("authenticated"):
        return redirect(url_for("dashboard"))
    return render_template_string(LOGIN_HTML, error=None)

@app.route("/admin", methods=["POST"])
@app.route("/admin/", methods=["POST"])
def login_post():
    pwd = request.form.get("password", "")
    if check_password(pwd):
        session["authenticated"] = True
        session.permanent = True
        if is_first_run():
            return redirect(url_for("setup"))
        return redirect(url_for("dashboard"))
    return render_template_string(LOGIN_HTML, error="Invalid access code. Try again.")

@app.route("/admin/dashboard")
@login_required
def dashboard():
    from flask import make_response
    resp = make_response(render_template_string(MAIN_HTML))
    resp.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
    resp.headers['Pragma'] = 'no-cache'
    return resp

@app.route("/admin/logout")
def logout():
    session.clear()
    return redirect(url_for("login"))

@app.route("/admin/setup")
def setup():
    if not session.get("authenticated"):
        return redirect(url_for("login"))
    if not is_first_run():
        return redirect(url_for("dashboard"))
    from flask import make_response
    resp = make_response(render_template_string(SETUP_HTML))
    resp.headers["Cache-Control"] = "no-store"
    return resp

@app.route("/admin/api/autodetect")
def api_autodetect():
    if not session.get("authenticated"):
        return jsonify({"ok": False}), 403
    return jsonify({"ok": True, "candidates": auto_detect_sdr_candidates()})

@app.route("/admin/api/setup", methods=["POST"])
def api_setup():
    if not session.get("authenticated"):
        return jsonify({"ok": False, "msg": "Not authenticated"}), 403
    if not is_first_run():
        return jsonify({"ok": False, "msg": "Setup already complete"})
    data = request.get_json(silent=True) or {}
    sdr_dir   = data.get("sdr_base_dir", "").strip()
    proc_name = (data.get("sdr_process_name", "spectrumserver") or "spectrumserver").strip()
    try:
        public_port = int(data.get("public_port", 8900))
    except (ValueError, TypeError):
        public_port = 8900
    new_password = data.get("new_password", "")
    if not sdr_dir:
        return jsonify({"ok": False, "msg": "SDR base directory is required"})
    if len(new_password) < 4:
        return jsonify({"ok": False, "msg": "Password must be at least 4 characters"})
    cfg = load_admin_config()
    cfg["sdr_base_dir"]     = sdr_dir
    cfg["sdr_process_name"] = proc_name
    cfg["public_port"]      = public_port
    cfg["password_hash"]    = hash_password(new_password)
    cfg["setup_complete"]   = True
    save_admin_config(cfg)
    return jsonify({"ok": True})


# ── API: Status ──────────────────────────────────────────────────────────────
@app.route("/admin/api/status")
@login_required
def api_status():
    try:
        return jsonify({"process": get_process_status(),
                        "system": get_system_stats(),
                        "top_procs": get_top_processes()})
    except Exception as e:
        return jsonify({"process": {"running": False, "pid": None, "name": None,
                                    "cpu": 0, "mem": 0, "uptime": None, "error": str(e)},
                        "system": {}, "top_procs": []})

# ── API: Scripts ─────────────────────────────────────────────────────────────
@app.route("/admin/api/scripts")
@login_required
def api_scripts():
    sh = get_allowed_scripts()
    return jsonify({"start": [k for k in sh if "start" in k.lower()],
                    "stop":  [k for k in sh if "stop"  in k.lower()],
                    "all":   sorted(sh.keys()), "paths": sh})

@app.route("/admin/api/scripts/all-discovered")
@login_required
def api_scripts_all():
    sh     = find_sh_files()
    result = [{"label": k, "path": v, "enabled": True} for k, v in sh.items()]
    return jsonify({"scripts": result})

@app.route("/admin/api/scripts/debug")
@login_required
def api_scripts_debug():
    """Shows exactly which scripts were found and where it looked."""
    base = get_sdr_dir()
    sh = find_sh_files()
    freq_dir = base / "frequencylist"
    return jsonify({
        "base_dir": str(base),
        "frequencylist_exists": freq_dir.exists(),
        "frequencylist_contents": [str(f.name) for f in sorted(freq_dir.glob("*"))] if freq_dir.exists() else [],
        "found_scripts": sh,
    })

# ── API: Server control ───────────────────────────────────────────────────────
@app.route("/admin/api/terminal/exec", methods=["POST"])
@login_required
def api_terminal_exec():
    data = request.get_json(silent=True) or {}
    cmd  = (data.get("cmd") or "").strip()
    # Use sdr_base_dir as default cwd, fallback to /tmp
    default_cwd = str(get_sdr_dir())
    cwd = (data.get("cwd") or "").strip() or default_cwd
    if not os.path.isdir(cwd):
        cwd = default_cwd
    if not cmd:
        return jsonify({"ok": True, "output": "", "cwd": cwd})
    if cmd == "cd" or cmd.startswith("cd ") or cmd == "cd~":
        target = cmd[2:].strip() or "~"
        # Expand ~ and env vars
        target = os.path.expanduser(target)
        target = os.path.expandvars(target)
        if target == "-":
            target = os.environ.get("OLDPWD", cwd)
        new_dir = os.path.realpath(os.path.join(cwd, target) if not os.path.isabs(target) else target)
        if os.path.isdir(new_dir):
            return jsonify({"ok": True, "output": "", "cwd": new_dir})
        return jsonify({"ok": False, "output": "cd: no such directory: " + target, "cwd": cwd})
    if cmd.strip() in ("clear", "cls"):
        return jsonify({"ok": True, "output": "__CLEAR__", "cwd": cwd})
    try:
        result = subprocess.run(
            cmd, shell=True, cwd=cwd,
            stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
            text=True, timeout=300, env={**os.environ, "TERM": "xterm"}
        )
        return jsonify({"ok": result.returncode == 0, "output": result.stdout or "(no output)", "cwd": cwd})
    except subprocess.TimeoutExpired:
        return jsonify({"ok": False, "output": "(command timed out after 300s)", "cwd": cwd})
    except Exception as ex:
        return jsonify({"ok": False, "output": str(ex), "cwd": cwd})
# ── API: Config files ─────────────────────────────────────────────────────────
@app.route("/admin/api/config-files")
@login_required
def api_config_files():
    return jsonify(get_allowed_configs())

@app.route("/admin/api/editable-files")
@login_required
def api_editable_files():
    return jsonify(find_editable_files())

@app.route("/admin/api/config-files/all-discovered")
@login_required
def api_config_files_all():
    cf     = find_config_files_all()
    result = [{"label": k, "path": v, "enabled": True} for k, v in cf.items()]
    return jsonify({"configs": result})

@app.route("/admin/api/json-files")
@login_required
def api_json_files():
    return jsonify(find_json_files())

@app.route("/admin/api/read-file")
@login_required
def api_read_file():
    path = request.args.get("path", "")
    if not path:
        return jsonify({"content": ""})
    # Security: must be within base dir
    base = get_sdr_dir()
    try:
        p = Path(path).resolve()
        p.relative_to(base)  # raises if outside
    except (ValueError, Exception):
        return jsonify({"error": "Access denied"}), 403
    content = read_file_safe(path)
    return jsonify({"content": content})

@app.route("/admin/api/write-file", methods=["POST"])
@login_required
def api_write_file():
    data = request.get_json(silent=True) or {}
    path = data.get("path", "")
    content = data.get("content", "")
    base = get_sdr_dir()
    try:
        p = Path(path).resolve()
        p.relative_to(base)
    except (ValueError, Exception):
        return jsonify({"ok": False, "msg": "Access denied"}), 403
    ok, msg = write_file_safe(path, content)
    return jsonify({"ok": ok, "msg": msg})

# ── API: Markers ──────────────────────────────────────────────────────────────
@app.route("/admin/api/markers", methods=["GET", "POST"])
@login_required
def api_markers():
    base = get_sdr_dir()
    markers_file = base / "markers.json"
    if request.method == "GET":
        try:
            raw = json.loads(read_file_safe(markers_file))
            # Support both {"markers": [...]} and plain [...] formats
            if isinstance(raw, dict) and "markers" in raw:
                data = raw["markers"]
            elif isinstance(raw, list):
                data = raw
            else:
                data = []
        except Exception:
            data = []
        return jsonify({"data": data, "path": str(markers_file)})
    else:
        req = request.get_json(silent=True) or {}
        data = req.get("data", [])
        # Preserve the {"markers": [...]} wrapper format
        output = json.dumps({"markers": data}, indent=2)
        ok, msg = write_file_safe(markers_file, output)
        return jsonify({"ok": ok, "msg": msg})

# ── API: Autorun spot reporting ───────────────────────────────────────────────
# Band/mode matrix mirrors autorun/bandplan.js (kept here so the UI can render
# without importing the JS). 6m is absent: RX888 at 60 MHz → 30 MHz Nyquist.
AUTORUN_BANDS = ["2200m", "630m", "160m", "80m", "80mEU", "60m", "40m", "30m", "20m", "17m", "15m", "12m", "10m"]
AUTORUN_MODES = {
    "ft8":  ["160m", "80m", "60m", "40m", "30m", "20m", "17m", "15m", "12m", "10m"],
    "ft4":  ["80m", "40m", "30m", "20m", "17m", "15m", "12m", "10m"],
    # JS8 Normal (15 s) only -- the calling speed, where heartbeats and CQs are.
    "js8":  ["160m", "80m", "40m", "30m", "20m", "17m", "15m", "12m", "10m"],
    "wspr": ["2200m", "630m", "160m", "80m", "80mEU", "60m", "40m", "30m", "20m", "17m", "15m", "12m", "10m"],
}

def _autorun_paths():
    base = get_sdr_dir()
    return base, base / "autorun.json", base / "autorun-status.json", base / "autorun.log"


def _autorun_totals():
    """All-time per-slot spot totals, or {} if the daemon has never run.

    Written by the daemon and deliberately NOT deleted on shutdown, unlike the
    status file — these totals are cumulative across restarts.
    """
    path = get_sdr_dir() / "autorun-totals.json"
    try:
        if path.exists():
            d = json.loads(read_file_safe(path))
            return d if isinstance(d, dict) else {}
    except Exception:
        pass
    return {}

def _resolve_node():
    import shutil as _sh
    n = _sh.which("node")
    if n:
        return n
    for p in sorted(glob.glob(str(Path.home() / ".nvm/versions/node/*/bin/node")), reverse=True):
        return p
    return "node"

def _autorun_default_identity():
    base = get_sdr_dir()
    call, grid = "", ""
    try:
        si = json.loads(read_file_safe(base / "frontend" / "site_information.json"))
        call = (si.get("siteSysop") or "")
        grid = (si.get("siteGridSquare") or "")[:6]
    except Exception:
        pass
    return call, grid

def _autorun_running():
    try:
        r = subprocess.run(["pgrep", "-f", r"node .*autorun/index\.js"],
                           capture_output=True, text=True, timeout=3)
        pids = [p for p in r.stdout.split() if p.strip()]
        return (len(pids) > 0), pids
    except Exception:
        return False, []

@app.route("/admin/api/autorun/config", methods=["GET", "POST"])
@login_required
def api_autorun_config():
    base, cfg_path, _, _ = _autorun_paths()
    if request.method == "GET":
        cfg = {}
        if cfg_path.exists():
            try:
                cfg = json.loads(read_file_safe(cfg_path))
            except Exception:
                cfg = {}
        def_call, def_grid = _autorun_default_identity()
        ident = cfg.get("identity") or {}
        rep = cfg.get("reporting") or {}
        return jsonify({
            "config": {
                "identity": {
                    "callsign": ident.get("callsign") or def_call,
                    "grid": ident.get("grid") or def_grid,
                },
                "reporting": {"pskreporter": bool(rep.get("pskreporter", False)),
                              "wsprnet": bool(rep.get("wsprnet", False))},
                "maxSlots": int(cfg.get("maxSlots", 12)),
                "slots": cfg.get("slots", []),
            },
            "defaults": {"callsign": def_call, "grid": def_grid},
            "bands": AUTORUN_BANDS,
            "modes": AUTORUN_MODES,
        })
    req = request.get_json(silent=True) or {}
    slots = []
    for s in (req.get("slots") or []):
        band, mode = s.get("band"), s.get("mode")
        if mode in AUTORUN_MODES and band in AUTORUN_MODES[mode]:
            slots.append({"band": band, "mode": mode, "enabled": bool(s.get("enabled"))})
    try:
        max_slots = max(1, min(64, int(req.get("maxSlots", 12))))
    except Exception:
        max_slots = 12
    enabled_count = sum(1 for s in slots if s["enabled"])
    if enabled_count > max_slots:
        return jsonify({"ok": False, "msg": f"{enabled_count} slots enabled exceeds cap of {max_slots}"})
    ident = req.get("identity") or {}
    call = (ident.get("callsign") or "").strip().upper()
    grid = (ident.get("grid") or "").strip()[:6]
    if not re.match(r'^[A-Z0-9/]{3,12}$', call):
        return jsonify({"ok": False, "msg": "invalid callsign format"})
    rep = req.get("reporting") or {}
    out = {
        "identity": {"callsign": call, "grid": grid},
        "reporting": {"pskreporter": bool(rep.get("pskreporter", False)),
                      "wsprnet": bool(rep.get("wsprnet", False))},
        "maxSlots": max_slots,
        "slots": slots,
    }
    # Optional manual CPU-pin override (advanced; usually absent). Accept a
    # taskset core list or none/off/unpinned, else drop it. Preserve any value
    # already in autorun.json when the request doesn't carry one, so hand-edits
    # and the env/auto paths keep working across a Save.
    cores = req.get("cores")
    if cores is None and cfg_path.exists():
        try:
            cores = (json.loads(read_file_safe(cfg_path)) or {}).get("cores")
        except Exception:
            cores = None
    if cores is not None:
        cores = str(cores).strip()
        if cores.lower() in ("none", "off", "unpinned"):
            out["cores"] = "none"
        elif _CORELIST_RE.match(cores):
            out["cores"] = cores
        # anything else: silently omit (invalid)
    ok, msg = write_file_safe(cfg_path, json.dumps(out, indent=2))
    return jsonify({"ok": ok, "msg": msg if not ok else "saved"})

@app.route("/admin/api/autorun/status")
@login_required
def api_autorun_status():
    _, _, status_path, _ = _autorun_paths()
    running, pids = _autorun_running()
    status = {}
    if status_path.exists():
        try:
            status = json.loads(read_file_safe(status_path))
        except Exception:
            status = {}
    return jsonify({"running": running, "pids": pids, "status": status,
                    "totals": _autorun_totals()})

_CORELIST_RE = re.compile(r'^\d+([-,]\d+)*$')  # e.g. "2-3", "0,2,4", "0-2,5"

def _autorun_cores_override():
    """Manual core override for the autorun pin, or None if not set.

    Precedence: AUTORUN_CORES env var, else the "cores" field in autorun.json.
    Useful on CPUs where the auto-derived range isn't ideal (AMD CCX/CCD, ARM
    big.LITTLE, interleaved SMT). Accepts a taskset -c list ("2-3", "0,2,4") or
    one of none/off/unpinned to force no pinning. Malformed values are ignored
    (falls back to auto) so a typo can't stop the daemon from launching.
    """
    val = os.environ.get("AUTORUN_CORES")
    if val is None:
        try:
            _, cfg_path, _, _ = _autorun_paths()
            if cfg_path.exists():
                val = (json.loads(read_file_safe(cfg_path)) or {}).get("cores")
        except Exception:
            val = None
    if val is None:
        return None
    val = str(val).strip()
    if val.lower() in ("none", "off", "unpinned", ""):
        return ""  # explicit "do not pin"
    return val if _CORELIST_RE.match(val) else None

def _autorun_taskset_prefix():
    """taskset prefix (list) pinning the autorun daemon to the top CPU cores.

    A manual override (see _autorun_cores_override) wins if set: a core list
    pins there, an empty override forces unpinned. Otherwise auto-derive:
    returns [] (unpinned) when taskset is unavailable or the machine is too
    small to segregate — a 4-core i5 shares all cores with spectrumserver, and
    naming cores that don't exist would make taskset fail to launch. Otherwise
    reserves the top few cores for the daemon: 4 on a >=12-thread CPU (the E-cores
    on a 4P+HT/4E part -> 8-11, matching the original hardcode), fewer on smaller
    CPUs. spectrumserver is pinned to 0-7 by xgo.sh, so the top cores stay clear.
    """
    import shutil as _sh
    if not _sh.which("taskset"):
        return []
    override = _autorun_cores_override()
    if override is not None:
        return ["taskset", "-c", override] if override else []
    n = os.cpu_count() or 0
    if n <= 4:
        return []  # can't segregate — let the scheduler balance across cores
    count = 4 if n >= 12 else max(1, n // 4)
    lo, hi = n - count, n - 1
    spec = f"{lo}-{hi}" if count > 1 else str(lo)
    return ["taskset", "-c", spec]

@app.route("/admin/api/autorun/start", methods=["POST"])
@login_required
def api_autorun_start():
    base, cfg_path, _, log_path = _autorun_paths()
    running, _ = _autorun_running()
    if running:
        return jsonify({"ok": False, "msg": "already running"})
    if not cfg_path.exists():
        return jsonify({"ok": False, "msg": "save config first"})
    try:
        cfg = json.loads(read_file_safe(cfg_path))
        if not any(s.get("enabled") for s in cfg.get("slots", [])):
            return jsonify({"ok": False, "msg": "no bands/modes enabled"})
    except Exception as e:
        return jsonify({"ok": False, "msg": f"bad config: {e}"})
    index_js = base / "autorun" / "index.js"
    if not index_js.exists():
        return jsonify({"ok": False, "msg": "autorun/index.js missing"})
    node = _resolve_node()
    # Pin the daemon to the top CPU cores so decode bursts stay off the lower
    # cores spectrumserver prefers (xgo.sh pins it to 0-7). Config-aware: on a
    # 4P+HT/4E box this yields the E-cores (8-11), on smaller CPUs it shrinks the
    # range, and on a 4-core (or fewer) machine it launches unpinned rather than
    # naming cores that don't exist (which would make taskset fail to start).
    cmd = _autorun_taskset_prefix() + [node, str(index_js)]
    try:
        logf = open(log_path, "a")
        proc = subprocess.Popen(cmd, cwd=str(base), stdout=logf,
                                stderr=subprocess.STDOUT, start_new_session=True)
        return jsonify({"ok": True, "msg": f"started (PID {proc.pid})", "pid": proc.pid})
    except Exception as e:
        return jsonify({"ok": False, "msg": str(e)})

@app.route("/admin/api/autorun/totals/reset", methods=["POST"])
@login_required
def api_autorun_totals_reset():
    """Clear the all-time per-slot spot totals.

    The daemon holds these in memory and rewrites the file every 15s and again
    on shutdown, so deleting it under a live daemon just brings the numbers
    straight back. Stop first, wait for the process to actually exit — its
    shutdown handler writes the totals one last time — and only then delete.
    """
    running, pids = _autorun_running()
    if running:
        for pid in pids:
            try:
                os.kill(int(pid), signal.SIGTERM)
            except Exception:
                pass
        deadline = time.time() + 15
        while time.time() < deadline:
            time.sleep(0.5)
            if not _autorun_running()[0]:
                break
        else:
            return jsonify({"ok": False, "msg": "daemon did not stop; totals kept"})

    path = get_sdr_dir() / "autorun-totals.json"
    try:
        if path.exists():
            path.unlink()
        return jsonify({"ok": True, "msg": "counters cleared", "was_running": running})
    except Exception as e:
        return jsonify({"ok": False, "msg": f"could not clear totals: {e}"})


@app.route("/admin/api/autorun/stop", methods=["POST"])
@login_required
def api_autorun_stop():
    running, pids = _autorun_running()
    if not running:
        return jsonify({"ok": False, "msg": "not running"})
    killed = []
    for pid in pids:
        try:
            os.kill(int(pid), signal.SIGTERM)
            killed.append(pid)
        except Exception:
            pass
    return jsonify({"ok": True, "msg": f"stopped PID(s) {','.join(killed)}"})

# ── API: Logs ─────────────────────────────────────────────────────────────────
@app.route("/admin/api/logs")
@login_required
def api_logs():
    log_name = request.args.get("name", "logwebsdr.txt")
    if log_name not in LOG_FILES:
        return jsonify({"ok": False, "msg": "Unknown log", "available": list(LOG_FILES.keys()), "lines": []}), 400
    lines = tail_log(150, log_name)
    return jsonify({"ok": True, "name": log_name, "available": list(LOG_FILES.keys()), "lines": lines})

@app.route("/admin/api/logs/clear", methods=["POST"])
@login_required
def api_logs_clear():
    global log_buffer
    # Clear in-memory buffer
    with log_lock:
        log_buffer.clear()
    # Truncate the log files defined in LOG_FILES, except CLEAR_EXCLUDE
    base = get_sdr_dir()
    cleared = []
    skipped = []
    failed = []
    for log_name, log_path in LOG_FILES.items():
        if log_name in CLEAR_EXCLUDE:
            skipped.append(log_name)
            continue
        lf = base / log_path
        if not lf.exists():
            continue
        try:
            # Truncate in place rather than unlink: systemd holds these open
            # with StandardOutput=append: (O_APPEND), so a deleted file would
            # keep filling an unlinked inode until the service restarts.
            with open(lf, "r+") as f:
                f.truncate(0)
            cleared.append(log_name)
        except Exception as e:
            failed.append({"name": log_name, "error": str(e)})
    return jsonify({"ok": not failed, "cleared": cleared,
                    "skipped": skipped, "failed": failed})

# ── API: Chat ─────────────────────────────────────────────────────────────────
@app.route("/admin/api/chat")
@login_required
def api_chat():
    base = get_sdr_dir()
    chat_file = base / "chat_history.txt"
    messages = []
    if chat_file.exists():
        try:
            with open(chat_file, encoding="utf-8", errors="replace") as f:
                for line in f.readlines()[-200:]:
                    line = line.strip()
                    if not line:
                        continue
                    # Try parse: [time] <nick> msg  or  nick: msg
                    m = re.match(r'\[([^\]]+)\]\s+<([^>]+)>\s+(.*)', line)
                    if m:
                        messages.append({"time": m.group(1), "nick": m.group(2), "msg": m.group(3), "raw": line})
                    else:
                        m2 = re.match(r'(\S+):\s+(.*)', line)
                        if m2:
                            messages.append({"time": "", "nick": m2.group(1), "msg": m2.group(2), "raw": line})
                        else:
                            messages.append({"time": "", "nick": "system", "msg": line, "raw": line})
        except Exception as e:
            messages = [{"time": "", "nick": "error", "msg": str(e)}]
    return jsonify({"messages": messages})

@app.route("/admin/api/chat/clear", methods=["POST"])
@login_required
def api_chat_clear():
    base = get_sdr_dir()
    chat_file = base / "chat_history.txt"
    try:
        with open(chat_file, "w") as f:
            f.write("")
        return jsonify({"ok": True, "msg": "Chat history cleared"})
    except Exception as e:
        return jsonify({"ok": False, "msg": str(e)})

# ── Chat admin IPC ────────────────────────────────────────────────────────────
# Communicates with the Unix domain socket started by ChatClient::start_admin_listener()
# inside spectrumserver.  This lets the admin panel send real-time commands
# (currently: DELETE) to the running C++ process without restarting it.

import socket as _socket

CHAT_ADMIN_SOCK = "/tmp/phantomsdr_chat.sock"

def _send_chat_admin_cmd(cmd: str):
    """Send a single newline-terminated command to spectrumserver's chat socket.

    Returns (True, "ok") on success, or (False, error_message) on failure.
    """
    try:
        with _socket.socket(_socket.AF_UNIX, _socket.SOCK_STREAM) as s:
            s.settimeout(2.0)
            s.connect(CHAT_ADMIN_SOCK)
            s.sendall((cmd + "\n").encode())
        return True, "ok"
    except FileNotFoundError:
        return False, "Chat admin socket not found — is spectrumserver running?"
    except _socket.timeout:
        return False, "Timed out connecting to chat admin socket"
    except Exception as e:
        return False, str(e)


@app.route("/admin/api/chat/delete", methods=["POST"])
@login_required
def api_chat_delete():
    """Delete a single chat message in real time.

    Expects JSON body: {"line": "<full formatted message string>"}
    The 'line' value must match exactly what is stored in chat_history.txt
    (i.e. the 'raw' field returned by /admin/api/chat).

    Sends a DELETE command to spectrumserver via the admin Unix socket.
    spectrumserver removes the message from its in-memory deque, rewrites
    chat_history.txt, and broadcasts a __CHAT_DELETE__ frame to all connected
    chat clients so their UI updates instantly.
    """
    data = request.get_json(silent=True) or {}
    line = data.get("line", "").strip()
    if not line:
        return jsonify({"ok": False, "msg": "No line specified"})
    ok, msg = _send_chat_admin_cmd("DELETE:" + line)
    return jsonify({"ok": ok, "msg": msg})

# ── Waterfall Message — static file helper ─────────────────────────────────────
# The message is written as wf-message.json into the frontend/dist directory
# (the same folder spectrumserver already serves statically).
# The browser fetches /wf-message.json directly from spectrumserver — no proxy,
# no auth, no routing issues whatsoever.

def _wf_write_file(text: str, color: str) -> str:
    """Write wf-message.json to every likely web-root location.
    Returns a summary string of files written (for logging).
    """
    import json as _json
    payload = _json.dumps({"text": text, "color": color})
    candidates = [
        BASE_DIR / "frontend" / "dist",
        BASE_DIR / "frontend" / "public",
        BASE_DIR / "public",
        BASE_DIR / "dist",
        get_sdr_dir() / "frontend" / "dist",
        get_sdr_dir() / "frontend" / "public",
        get_sdr_dir() / "public",
    ]
    written = []
    seen = set()
    for d in candidates:
        d = d.resolve()
        if d in seen or not d.is_dir():
            continue
        seen.add(d)
        try:
            target = d / "wf-message.json"
            target.write_text(payload, encoding="utf-8")
            written.append(str(target))
        except Exception as e:
            print(f"[wf-msg] Could not write {d}/wf-message.json: {e}")
    return ", ".join(written) if written else "nowhere (no candidate dir found)"


# ── API: Waterfall Message ─────────────────────────────────────────────────────
@app.route("/admin/api/wf-message", methods=["GET"])
def api_wf_message_get():
    """Public fallback — no @login_required.  The frontend normally reads the
    static /wf-message.json; this endpoint is kept for diagnostics.
    """
    with _wf_message_lock:
        m = dict(_wf_message)
    return jsonify({"text": m.get("text", ""), "color": m.get("color", "#ffffff")})


@app.route("/admin/api/wf-message", methods=["POST"])
@login_required
def api_wf_message_post():
    """Set the waterfall message (admin only).
    Body JSON: {"text": "...", "color": "#ffffff"}
    """
    data  = request.get_json(silent=True) or {}
    text  = (data.get("text") or "").strip()[:200]
    color = data.get("color", "#ffffff")
    if not text:
        return jsonify({"ok": False, "msg": "Empty message"})
    with _wf_message_lock:
        _wf_message.update({"text": text, "color": color})
    written = _wf_write_file(text, color)
    print(f"[wf-msg] SET '{text}' → {written}")
    return jsonify({"ok": True, "written": written})


@app.route("/admin/api/wf-message", methods=["DELETE"])
@login_required
def api_wf_message_delete():
    """Clear the waterfall message (admin only)."""
    with _wf_message_lock:
        _wf_message.update({"text": "", "color": "#ffffff"})
    written = _wf_write_file("", "#ffffff")
    print(f"[wf-msg] CLEARED → {written}")
    return jsonify({"ok": True})


# ── API: Settings ─────────────────────────────────────────────────────────────
@app.route("/admin/api/settings", methods=["GET", "POST"])
@login_required
def api_settings():
    cfg = load_admin_config()
    if request.method == "GET":
        out = {
            "sdr_base_dir":  cfg.get("sdr_base_dir", str(BASE_DIR)),
            "start_script":  cfg.get("start_script", ""),
            "stop_script":   cfg.get("stop_script", ""),
            "public_port":   cfg.get("public_port", 8900),
        }
        if HAS_THERMAL:
            for k, v in thermal_guard.DEFAULTS.items():
                out[k] = cfg.get(k, v)
        return jsonify(out)
    data = request.get_json(silent=True) or {}
    if HAS_THERMAL:
        # Temperatures are floats and may be left blank ("auto" = derive from the
        # machine's own critical trip point); the rest are whole seconds/counts.
        temp_keys = {"thermal_warn", "thermal_throttle", "thermal_stop",
                     "thermal_resume", "thermal_test_temp"}
        for k in thermal_guard.DEFAULTS:
            if k not in data:
                continue
            v = data[k]
            if k == "thermal_enabled":
                cfg[k] = bool(v)
            elif k == "thermal_mode":
                if str(v) in thermal_guard.MODE_RANK:
                    cfg[k] = str(v)
            elif v in (None, "", "auto"):
                cfg[k] = None
            else:
                try:
                    cfg[k] = float(v) if k in temp_keys else int(v)
                except (TypeError, ValueError):
                    pass
    if "sdr_base_dir" in data:
        cfg["sdr_base_dir"] = data["sdr_base_dir"]
    if "start_script" in data:
        cfg["start_script"] = data["start_script"]
    if "stop_script" in data:
        cfg["stop_script"] = data["stop_script"]
    if "public_port" in data:
        try:
            cfg["public_port"] = int(data["public_port"])
        except (ValueError, TypeError):
            pass
    save_admin_config(cfg)
    return jsonify({"ok": True})

# ── API: WebSDR diversity relay ──────────────────────────────────────────────
# The relay is a separate process (websdr_relay.py) that lets receive diversity
# use a WebSDR as the second receiver. It is optional and often not installed,
# so every failure here is reported as a state to show, never as an error: a
# missing config file means "not set up", a refused connection means "not
# running", and both are normal.
@app.route("/admin/api/websdr-relay")
@login_required
def api_websdr_relay():
    import urllib.request
    import urllib.error

    cfg_path = BASE_DIR / "websdr_relay.json"
    if not cfg_path.exists():
        return jsonify({"configured": False,
                        "reason": "websdr_relay.json not found — "
                                  "run ./setup_websdr_relay.sh"})
    try:
        with open(cfg_path) as f:
            cfg = json.load(f)
    except (json.JSONDecodeError, OSError) as e:
        return jsonify({"configured": False, "reason": f"websdr_relay.json: {e}"})

    port = int(cfg.get("port", 8898))
    out = {"configured": True, "port": port, "running": False,
           "site": cfg.get("site", ""), "operator": cfg.get("operator", ""),
           "max_per_host": cfg.get("max_per_host"), "max_total": cfg.get("max_total")}

    # Always loopback: the relay binds every interface, but asking it through
    # the public address would depend on the router's hairpin NAT and could
    # report "down" for a relay that is perfectly healthy.
    try:
        with urllib.request.urlopen(f"http://127.0.0.1:{port}/status", timeout=2) as r:
            live = json.loads(r.read().decode("utf-8"))
        out["running"] = True
        out["user_agent"] = live.get("user_agent", "")
        out["sessions"] = live.get("sessions", {})
        # The live values win: someone may have edited the config without
        # restarting, and what the relay is actually enforcing is what matters.
        for k in ("max_per_host", "max_total"):
            if live.get(k) is not None:
                out[k] = live[k]
    except (urllib.error.URLError, OSError, ValueError, json.JSONDecodeError) as e:
        out["reason"] = str(getattr(e, "reason", e))

    return jsonify(out)


@app.route("/admin/api/thermal", methods=["GET", "POST"])
@login_required
def api_thermal():
    if not HAS_THERMAL:
        return jsonify({"available": False, "reason": "thermal_guard.py not loaded"})
    if request.method == "POST":
        act = (request.get_json(silent=True) or {}).get("action")
        if act == "reset":
            thermal_guard.reset()
            return jsonify({"ok": True, "msg": "Thermal lockout cleared"})
        return jsonify({"ok": False, "msg": "Unknown action"})
    st = thermal_guard.status()
    st["available"] = True
    return jsonify(st)


@app.route("/admin/api/change-password", methods=["POST"])
@login_required
def api_change_password():
    data = request.get_json(silent=True) or {}
    old = data.get("old", "")
    new_pwd = data.get("new_pwd", "")
    if not check_password(old):
        return jsonify({"ok": False, "msg": "Current password incorrect"})
    if len(new_pwd) < 4:
        return jsonify({"ok": False, "msg": "Password too short"})
    cfg = load_admin_config()
    cfg["password_hash"] = hash_password(new_pwd)
    save_admin_config(cfg)
    return jsonify({"ok": True})

# ── API: Stats history (Graphs page) ──────────────────────────────────────────
@app.route("/admin/api/graph-stats")
@login_required
def api_graph_stats():
    """Sampled CPU/user history for the Graphs page.

    ?since=<epoch> returns only newer points so the page polls incrementally
    instead of re-downloading the whole buffer every tick.
    """
    def _arg(name, default):
        try:
            return int(request.args.get(name, default))
        except (TypeError, ValueError):
            return default

    since = _arg("since", 0)
    rng   = max(60, min(GRAPH_HISTORY_S, _arg("range", GRAPH_FINE_S)))

    # A range the fine tier cannot cover in full has to come from the coarse
    # tier, otherwise the plot would silently stop at the fine tier's horizon
    # and look like the server had been down.
    coarse = rng > GRAPH_FINE_S
    interval = GRAPH_COARSE_INTERVAL_S if coarse else GRAPH_INTERVAL_S
    cutoff = int(time.time()) - rng

    with _graph_lock:
        src = _graph_coarse if coarse else _graph_history
        pts = [p for p in src if p["t"] >= cutoff and p["t"] > since]

    _, _, limit = get_cpu_frequency()
    return jsonify({
        "ok": True,
        "interval": interval,
        "retention": rng,
        "coarse": coarse,
        "freq_limit": limit,
        "cores": (psutil.cpu_count() if HAS_PSUTIL else os.cpu_count()),
        "points": pts,
    })


# ── API: Connected users / Kick ───────────────────────────────────────────────
def _get_public_port():
    """Return the PUBLIC port users connect to for 'ss' connection counting.

    When running behind proxy.py this must be proxy_port (e.g. 8902), because
    all connections to spectrumserver's internal port (public_port, e.g. 8900)
    come from 127.0.0.1 (the proxy itself) — real client IPs are invisible there.
    Falls back to public_port for standalone (no-proxy) deployments.
    """
    cfg = load_admin_config()
    return int(cfg.get("proxy_port") or cfg.get("public_port", 8900))

@app.route("/admin/api/users")
@login_required
def api_users():
    """Return IPs with active connections to the WebSDR.

    Scans BOTH the proxy port (proxy.py) AND the public spectrumserver port,
    because in practice most clients connect straight to spectrumserver and
    bypass the proxy — their real IPs appear as the peer on the SDR port.
    Uses 'ss -tn sport = :PORT' (no -p flag; no privilege needed).

    Loopback and the proxy's own relay IP (sdr_host) are filtered out so the
    proxy's upstream connections to spectrumserver aren't listed as a "user".
    """
    cfg = load_admin_config()
    proxy_port  = int(cfg.get("proxy_port") or 0)
    public_port = int(cfg.get("public_port", 8900))
    ports = [p for p in {proxy_port, public_port} if p]
    # Connections the proxy itself opens to spectrumserver originate from
    # sdr_host — never a real client, so drop them.
    relay_ip = (cfg.get("sdr_host") or "").strip()
    exclude = {"127.0.0.1", "::1", "*", "", relay_ip}
    try:
        ips = {}
        for port in ports:
            # sport and = and :PORT must be SEPARATE argv tokens — a single
            # string like "sport = :8900" is silently ignored by ss execvp.
            r = subprocess.run(
                ["ss", "-tn", "sport", "=", ":%d" % port],
                capture_output=True, text=True, timeout=5
            )
            for line in r.stdout.splitlines()[1:]:   # skip header row
                parts = line.split()
                if len(parts) < 5:
                    continue
                # Column layout: State  Recv-Q  Send-Q  Local:Port  Peer:Port
                peer = parts[4]
                # Handle IPv6-mapped IPv4 like [::ffff:1.2.3.4]:PORT
                ip = peer.rsplit(":", 1)[0].strip("[]")
                if ip.startswith("::ffff:"):
                    ip = ip[7:]
                if ip not in exclude:
                    ips[ip] = ips.get(ip, 0) + 1
        users = [{"ip": ip, "connections": cnt} for ip, cnt in sorted(ips.items())]
        return jsonify({"ok": True, "users": users, "ports": ports})
    except Exception as e:
        return jsonify({"ok": False, "users": [], "error": str(e)})

def _proxy_kick(ip):
    """Ask proxy.py to close all WebSockets from `ip`.

    proxy.py owns every client WebSocket, so it disconnects the user by closing
    the socket from inside its own process — no CAP_NET_ADMIN / 'ss -K' needed.
    Returns (ok: bool, count: int|None, err: str|None). count is None when the
    proxy is unreachable (standalone deployment → caller falls back to ss -K).
    """
    import urllib.request
    cfg = load_admin_config()
    proxy_port = cfg.get("proxy_port")
    if not proxy_port:
        return (False, None, "no proxy_port configured")
    url = "http://127.0.0.1:%d/__proxy_control/kick" % int(proxy_port)
    body = json.dumps({"ip": ip}).encode()
    req = urllib.request.Request(url, data=body,
                                 headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            d = json.loads(resp.read().decode())
        return (bool(d.get("ok")), int(d.get("count", 0)), None)
    except Exception as e:
        # Connection refused / timeout ⇒ no proxy running ⇒ signal fallback.
        return (False, None, str(e))


def _server_kick(ip, ban_s=0):
    """Ask spectrumserver itself to disconnect and ban `ip`.

    This is the one that actually works on a normal station. Listeners reach
    spectrumserver directly on public_port, so proxy.py never sees their
    sockets, and 'ss -K' only destroys the TCP connection — which every page
    treats as a network drop and reconnects from. spectrumserver closes with
    code 4001, which the browser knows not to retry.

    ban_s is 0: a kick disconnects, it does not lock anyone out. Someone who
    wants back in reloads the page and is a normal listener again.

    Returns (ok: bool, count: int|None, err: str|None); count is None when the
    endpoint is unreachable (an older spectrumserver has no /~~kick).
    """
    import urllib.request, urllib.parse
    cfg = load_admin_config()
    port = cfg.get("public_port")
    if not port:
        return (False, None, "no public_port configured")
    url = "http://127.0.0.1:%d/~~kick?%s" % (
        int(port), urllib.parse.urlencode({"ip": ip, "secs": int(ban_s)}))
    try:
        with urllib.request.urlopen(url, timeout=5) as resp:
            d = json.loads(resp.read().decode())
        return (bool(d.get("ok")), int(d.get("count", 0)), None)
    except Exception as e:
        return (False, None, str(e))


@app.route("/admin/api/kick", methods=["POST"])
@login_required
def api_kick():
    """Disconnect all connections from a given IP.

    Most clients connect straight to spectrumserver (a separate C++ process),
    so the only way to drop those sockets from here is 'ss -K', which requires
    CAP_NET_ADMIN on the ss binary ('setcap cap_net_admin+ep <ss>'). We also
    ask proxy.py to close any WebSockets it owns (privilege-free) so users who
    DO go through the proxy are covered even when ss lacks the capability.
    """
    data = request.get_json(silent=True) or {}
    ip = data.get("ip", "").strip()
    if not re.match(r'^[\d.a-fA-F:]+$', ip) or ip in ("127.0.0.1", "::1", ""):
        return jsonify({"ok": False, "msg": "Invalid or disallowed IP"})
    if ip.startswith("::ffff:"):
        ip = ip[7:]  # normalize IPv4-mapped IPv6 so it matches ss / proxy keys

    # ── Privilege-free part: close WebSockets proxy.py owns (proxy users) ─────
    _pok, proxy_count, _perr = _proxy_kick(ip)
    proxy_count = proxy_count or 0

    # ── The real kick: spectrumserver closes its own sockets, with a close
    # code the browser does not reconnect from. No ban — a kick is a
    # disconnect, and coming back is the listener's own move. ────────────────
    _sok, server_count, _serr = _server_kick(ip)
    server_count = server_count or 0
    if server_count or proxy_count:
        total = server_count + proxy_count
        return jsonify({
            "ok": True,
            "msg": "Kicked %s — %d connection%s closed" % (
                ip, total, "s" if total != 1 else ""),
        })

    import shutil as _shutil
    ss_bin = _shutil.which("ss") or "/usr/bin/ss"
    try:
        # Count ALL of this IP's connections (direct 8900 + proxied 8899).
        before = subprocess.run([ss_bin, "-tn", "dst", ip],
                                capture_output=True, text=True, timeout=3)
        count_before = max(0, len(before.stdout.strip().splitlines()) - 1)

        if count_before == 0 and proxy_count == 0:
            return jsonify({"ok": False,
                            "msg": "No active connections from %s" % ip})

        # 'ss -K' (SOCK_DESTROY) needs CAP_NET_ADMIN. Without it the kernel
        # replies "Operation not permitted" but ss still exits 0, so the kick
        # silently no-ops. Verify the capability directly (never by killing the
        # target socket — that could drop the admin's own connection).
        has_perm = (os.geteuid() == 0)
        if not has_perm:
            real_ss = os.path.realpath(ss_bin)
            getcap_bin = (_shutil.which("getcap") or "/usr/sbin/getcap")
            try:
                cap = subprocess.run([getcap_bin, real_ss],
                                     capture_output=True, text=True, timeout=3)
                has_perm = "cap_net_admin" in (cap.stdout or "").lower()
            except FileNotFoundError:
                has_perm = True  # can't verify; let ss attempt it

        if not has_perm:
            # Direct spectrumserver connections cannot be closed without the
            # capability. Report the proxy streams we DID close (if any) and
            # tell the operator exactly how to enable full kicks.
            if proxy_count:
                return jsonify({
                    "ok": True,
                    "msg": ("Closed %d proxy stream%s from %s. Direct "
                            "connections still need: sudo setcap "
                            "cap_net_admin+ep %s" % (
                                proxy_count, "s" if proxy_count != 1 else "",
                                ip, os.path.realpath(ss_bin))),
                })
            return jsonify({
                "ok": False,
                "msg": ("Kick has no effect — these users connect directly to "
                        "spectrumserver and closing those sockets needs "
                        "CAP_NET_ADMIN. Run once: sudo setcap cap_net_admin+ep "
                        "%s  (then restart nothing — takes effect immediately)"
                        % os.path.realpath(ss_bin)),
            })

        # Deferred so the admin browser receives the response before ss -K can
        # terminate the admin's own connection (if it shares the kicked IP/NAT).
        def _kick_later():
            import time
            time.sleep(0.3)
            try:
                subprocess.run([ss_bin, "-K", "dst", ip],
                               capture_output=True, timeout=5)
            except Exception:
                pass

        threading.Thread(target=_kick_later, daemon=True).start()
        total = max(count_before, proxy_count)
        return jsonify({
            "ok":  True,
            "msg": "Kicked %s — %d connection%s terminated" % (
                ip, total, "s" if total != 1 else ""),
        })
    except Exception as e:
        return jsonify({"ok": False, "msg": str(e)})

# ── Access-log noise filter ───────────────────────────────────────────────────
# The dashboard polls these paths every 3-5s for as long as a browser tab is
# open, so werkzeug's access log fills admin.log with hundreds of identical
# successful GETs an hour and buries the entries worth reading (logins, POSTed
# actions, errors). Successful polls are dropped; anything that is not a plain
# 200 still gets logged, so failures on these paths remain visible. proxy.py
# filters the same traffic on its own side (see QuietPollFilter there) — this
# is the second half of that, for requests reaching Flask directly.
# /admin/api/logs/clear is here for a different reason than the pollers: its own
# access line is written to admin.log *after* the truncate, so a successful clear
# always left one fresh line behind and the pane looked like it had not cleared.
_QUIET_PATHS = ("/admin/api/status", "/admin/api/thermal", "/admin/api/logs",
                "/admin/api/logs/clear",
                "/admin/api/autorun/status", "/admin/api/users",
                "/admin/api/graph-stats", "/admin/api/chat")
_ACCESS_RE = re.compile(r'"[A-Z]+ (?P<path>[^ ?"]+)[^"]*" (?P<status>\d{3})')


class QuietPollFilter(logging.Filter):
    def filter(self, record):
        m = _ACCESS_RE.search(record.getMessage())
        if not m or m.group("status") != "200":
            return True
        return m.group("path") not in _QUIET_PATHS


# ─── Startup ───────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    if not ADMIN_CONFIG_FILE.exists():
        save_admin_config(DEFAULT_CONFIG)
        print("[PhantomSDR Admin] Created admin_config.json with default password 'admin'")

    cfg = load_admin_config()
    port = cfg.get("port", ADMIN_PORT)
    bind = ADMIN_BIND
    proxy_port = cfg.get("proxy_port", PUBLIC_PORT)
    sdr_port = cfg.get("public_port", PUBLIC_PORT)

    print("=" * 60)
    print("  PhantomSDR-Plus Admin Panel  [INTERNAL SERVICE]")
    print(f"  Listening : http://{bind}:{port}/admin")
    print(f"  Public URL: via proxy.py -> http://SERVER_IP:{proxy_port}/admin")
    print(f"  Password  : admin  (CHANGE THIS IMMEDIATELY)")
    print(f"  Dir       : {BASE_DIR}")
    print("=" * 60)
    print("  NOTE: Run proxy.py separately to share the main SDR port.")
    print(f"        spectrumserver must use port {sdr_port} in your .toml")
    print("=" * 60)

    # Arm the thermal guard before the sampler that ticks it.
    if start_thermal_guard():
        _tg = thermal_guard.status()
        _tt = thermal_guard.read_cpu_temp()
        print("  Thermal   : %s, mode=%s, sensor=%s" % (
            "enabled" if _tg.get("enabled") else "disabled",
            _tg.get("mode"), (_tt[2] if _tt else "NONE — guard cannot act")))
        if _tt and _tt[1]:
            print("              crit=%.0fC -> stop at %.0fC (override in Settings)"
                  % (_tt[1], _tt[1] - thermal_guard.OFF_STOP))
    else:
        print("  Thermal   : guard unavailable (thermal_guard.py missing)")

    # Start sampling immediately, not on first visit to the Graphs page, so the
    # page opens onto existing history rather than an empty plot.
    start_graph_sampler()
    print(f"  Graphs    : sampling every {GRAPH_INTERVAL_S}s, "
          f"{GRAPH_HISTORY_S // 3600}h history (in memory)")

    if not HAS_PSUTIL:
        print("[WARN] psutil not installed - system stats limited. pip3 install psutil")
    if tomllib is None:
        print("[WARN] tomllib unavailable - TOML editing is text-only")

    logging.getLogger("werkzeug").addFilter(QuietPollFilter())

    app.run(host=bind, port=port, debug=False, threaded=True)
