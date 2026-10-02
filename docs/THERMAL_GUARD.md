# Thermal Guard — Sysop Manual

**CPU over-temperature protection for PhantomSDR-Plus.**

A WebSDR is one of the few things a computer does that keeps every core busy, all day, forever. If a fan clogs, a pump stalls or the room gets hot in August, nothing tells you — the server just keeps decoding until the CPU is cooking itself. The thermal guard is the piece that notices and pulls the plug for you.

It ships **inert**: out of the box it only writes to a log. Nothing is protected until you choose a mode. This manual is about making that choice and living with it.

> **In a hurry?** Run `python3 thermal_guard.py --once`, read the thresholds it prints, then set `thermal_mode` to `stop+restart` in the admin panel. That is the whole job. Everything below is the *why*.

---

## Contents

1. [What it does](#1-what-it-does)
2. [Quick start](#2-quick-start)
3. [How it decides](#3-how-it-decides)
4. [The four modes — what each one does and what you must do](#4-the-four-modes)
5. [Choosing a mode](#5-choosing-a-mode)
6. [Configuration reference](#6-configuration-reference)
7. [Running it without the admin panel](#7-running-it-without-the-admin-panel)
8. [Enabling the throttle stage without root](#8-enabling-the-throttle-stage-without-root)
9. [Unattended operation — when nobody is watching](#9-unattended-operation)
10. [Testing it before you trust it](#10-testing-it-before-you-trust-it)
11. [Reading the log](#11-reading-the-log)
12. [Lockout and the rate limit](#12-lockout-and-the-rate-limit)
13. [Troubleshooting](#13-troubleshooting)
14. [Turning it off or removing it](#14-turning-it-off-or-removing-it)

---

## 1. What it does

Every 2 seconds the guard reads your CPU's die temperature and compares it against four thresholds. When the temperature stays above one of them for long enough, it moves up a ladder:

```
   normal  ──►  warn  ──►  throttle  ──►  stop  ──►  (cool down)  ──►  restart
             log a line   lower the      run your       hold the        run your
                          CPU clock      stop script    server down     start script
```

Two design decisions make it work on *any* sysop's machine, which is worth understanding before you rely on it:

**It never asks how you run your server.** systemd, a watchdog loop, cron, tmux, a bare shell — the guard does not know and does not care. Instead, while the machine is over-temperature it holds a **lockout**: it re-issues the stop on *every* tick. If your watchdog restarts the server, the guard stops it again within two seconds. Whatever is trying to keep the server alive loses, until the CPU has cooled. This is the part that makes it universal, and it is tested against a real watchdog.

**It never hard-codes a temperature.** "Stop at 95 °C" is a bad rule: on an Intel with Tjmax 100 that is normal-ish load, on a Ryzen it is *below* where Tctl sits under boost by design, and on a Raspberry Pi it is unreachable because the SoC throttles itself at 80. So the guard reads the critical trip point your own kernel publishes (`tempN_crit`) and works backwards from it. Same code, sensible numbers everywhere.

---

## 2. Quick start

**1. See what your machine looks like to the guard.** Do this first, always:

```
cd ~/PhantomSDR-Plus
python3 thermal_guard.py --once
```

```
sensor     : hwmon:coretemp
temperature: 65.0 C
crit       : 100.0 C
mode       : log
thresholds : warn 88.0  throttle 92.0  stop 95.0  resume 75.0 (C)
cpufreq    : not writable — throttle stage disabled
```

If `sensor` says `NONE`, stop here and read [Troubleshooting](#13-troubleshooting) — the guard cannot protect a machine it cannot measure, and it will tell you so rather than pretend.

**2. Leave it in `log` mode for a few days.** It is already running inside the admin panel. Let it watch a normal week — summer afternoons, a big build, a busy Saturday contest — and see whether it would ever have fired.

**3. Arm it.** Admin panel → **Settings** → **THERMAL GUARD** → **MODE** → `stop+restart` → 💾 **SAVE THERMAL SETTINGS**. It takes effect within about 2 seconds; no restart needed.

---

## 3. How it decides

### The sensor

The guard only trusts real CPU-die sensors:

| Source | Typical hardware |
|---|---|
| `coretemp` | Intel |
| `k10temp`, `zenpower`, `zenpower3` | AMD |
| `cpu_thermal`, `soc_thermal` | Raspberry Pi, ARM SBCs |
| `x86_pkg_temp` thermal zone | fallback on x86 |

`acpitz` and unlabelled thermal zones are **deliberately excluded**. On a typical desktop `acpitz` reads about 28 °C while the CPU package is at 59 °C — a guard trusting it would simply never fire. Reporting "disabled, no trusted sensor" is more honest than pretending to protect.

`psutil` is used if it happens to be installed, but is never required. The guard is pure standard library.

### The thresholds

Each one is an offset below the critical trip point the machine itself publishes:

| Threshold | Offset below crit | What it means |
|---|---|---|
| warn | −12 °C | Something is wrong, log it |
| throttle | −8 °C | Try to cool it down by slowing the CPU |
| stop | −5 °C | Too close to the edge — stop the server |
| resume | −25 °C | Genuinely cool again, safe to come back |

Which lands like this in practice:

| Your CPU reports | warn | throttle | **stop** | resume |
|---|---|---|---|---|
| Intel, crit 100 °C | 88 | 92 | **95** | 75 |
| AMD Ryzen, crit 95 °C | 83 | 87 | **90** | 70 |
| Raspberry Pi, crit 85 °C | 73 | 77 | **80** | 60 |

If the machine publishes no critical point at all, the guard falls back to a conservative fixed set and says so. You can override any threshold with an absolute number (see [Configuration reference](#6-configuration-reference)), but you should not need to.

### Sustain times — why a spike never acts

Nothing happens on a single hot reading. A threshold must be held **continuously**:

- **warn** and **throttle**: 30 s (`thermal_warn_sustain_s`)
- **stop**: 60 s (`thermal_sustain_s`)
- **resume**: 300 s below the resume threshold before a restart (`thermal_resume_s`)

A compile spike, a burst of decoding, a fan ramping up — all far too short to matter. One dip below the threshold resets the clock. On top of that the guard requires 3 consecutive valid readings before it will act at all after starting, and it discards any reading outside 20–125 °C as a sensor glitch rather than a temperature.

---

## 4. The four modes

`thermal_mode` is the single switch that decides how far up the ladder the guard is allowed to go. Each mode **includes everything the modes before it do**.

| Mode | Warns | Throttles | Stops | Restarts | Server can go down? |
|---|:--:|:--:|:--:|:--:|---|
| `log` | ✓ | — | — | — | No — touches nothing |
| `throttle` | ✓ | ✓ | — | — | No |
| `stop` | ✓ | ✓ | ✓ | — | Yes, stays down until you act |
| `stop+restart` | ✓ | ✓ | ✓ | ✓ | Yes, comes back on its own |

---

### `log` — watch and report (the shipping default)

**What it does:** everything the other modes do, except acting. It follows the whole ladder and writes what it *would* have done to `crash.log`. It never runs your stop script, never touches the CPU frequency, never interrupts a listener.

**What you must do:** nothing — it is already running. After a week, open the **CRASH** tab in the admin panel, or run:

```
grep THERMAL crash.log
```

- **Nothing there?** Your cooling is fine and you can arm the guard with confidence.
- **`STOP level reached ... NOT stopping`?** The guard would have shut your server down. That is a real thermal problem you have been running with — fix the cooling *and* arm the guard.

**Use it when:** you have just installed the guard and do not yet know how your machine behaves. This is a shakedown mode, not a destination — a guard in `log` mode protects nothing.

---

### `throttle` — slow the CPU down, never interrupt service

**What it does:** at the throttle threshold it lowers the maximum CPU frequency by 20 %, then restores it once the temperature is back below the warn line. Your WebSDR stays up throughout. Listeners may notice slightly worse performance under heavy load; most will notice nothing.

If the temperature keeps climbing past the stop threshold anyway, this mode **logs it and does nothing** — it will not stop the server.

**What you must do:**

1. Give the guard write access to the CPU frequency limit — it needs it, and by default only root has it. Run `./setup-cpufreq-perms.sh` once; see [section 8](#8-enabling-the-throttle-stage-without-root).
2. Confirm with `python3 thermal_guard.py --once` that it prints `cpufreq : writable, throttle stage available`. If it says *not writable*, this mode does nothing at all beyond what `log` does, and will say so in the log every time.

**Use it when:** you are chasing a marginal cooling problem and want the machine defended without ever dropping listeners. **Be aware this is not full protection** — if throttling is not enough, nothing else happens. Good as a first step; poor as a final answer.

---

### `stop` — shut the server down and leave it down

**What it does:** at the stop threshold it runs your stop script, then holds the **lockout** — re-stopping the server every 2 seconds for as long as the machine is over-temperature, so nothing can revive it behind your back. When the CPU has been below the resume threshold for 5 minutes the lockout clears. **The server does not come back on its own.** You restart it when you are satisfied the cause is fixed.

**What you must do:**

1. Make sure the guard knows how to stop your server. In the admin panel that is the configured stop script (`./stop-websdr.sh` for the shipped launchers). If no stop script is set, the guard falls back to `SIGTERM` on the process name, then `SIGKILL` after a 10-second grace — which works, but a proper stop script is cleaner.
2. Accept that **your WebSDR will be offline until you notice**. Have some way of finding out: an uptime monitor, the CRASH tab, or simply checking daily.

**Use it when:** the machine matters more than the service, you are usually around, or a thermal event is serious enough that you want to inspect the box before it carries on. Also the right choice if you do not trust an automated restart on your hardware.

---

### `stop+restart` — shut down, cool off, come back by itself

**What it does:** everything `stop` does, plus: once the CPU has held below the resume threshold for 5 minutes, it runs your start script and the WebSDR comes back on its own.

Flapping is prevented by `thermal_max_stops_hour` (default 2). After two thermal stops within an hour the guard **disables the automatic restart** and leaves the server down for you to look at. Note the important detail: the rate limit turns off the *restart*, never the *protection* — the lockout keeps stopping the server while it is hot, no matter how many times it has already tripped.

**What you must do:**

1. Make sure **both** scripts are configured and actually work standalone — the start script as well as the stop script. Test them by hand first: `./stop-websdr.sh` then `./start-rx888mk2.sh`.
2. Nothing else. This is the fire-and-forget mode.

**Use it when:** the WebSDR is public, unattended, or remote — which is most of them. This is the recommended mode for a normal installation.

---

## 5. Choosing a mode

| Your situation | Mode |
|---|---|
| Just installed the guard, do not know the machine yet | `log` for a week |
| Public WebSDR, unattended, you want it to look after itself | **`stop+restart`** |
| Remote site you cannot easily reach | **`stop+restart`** |
| You want to inspect the machine after any thermal event | `stop` |
| Hardware you do not trust to survive an automatic restart | `stop` |
| Chasing marginal cooling, must not drop listeners | `throttle`, then move on to `stop+restart` |
| Machine has no trusted CPU sensor | none of them will work — fix the sensor first |

For most sysops the answer is `stop+restart`, and the honest summary of the others is: `log` protects nothing, and `throttle` protects a little.

---

## 6. Configuration reference

All keys live in `admin_config.json` next to `thermal_guard.py`, and every one of them is also editable in **Settings → THERMAL GUARD**. The guard **re-reads the file on every tick**, so changes take effect within ~2 seconds — no restart.

| Key | Default | Meaning |
|---|---|---|
| `thermal_enabled` | `true` | Master switch. `false` disables the guard entirely. |
| `thermal_mode` | `"log"` | `log` \| `throttle` \| `stop` \| `stop+restart` — see [section 4](#4-the-four-modes). |
| `thermal_warn` | `null` | Absolute warn threshold in °C. `null` = derive from the CPU's crit point. |
| `thermal_throttle` | `null` | Absolute throttle threshold. `null` = derived. |
| `thermal_stop` | `null` | Absolute stop threshold. `null` = derived. |
| `thermal_resume` | `null` | Absolute resume threshold. `null` = derived. |
| `thermal_sustain_s` | `60` | Seconds the stop threshold must be held before stopping. Minimum 5. |
| `thermal_warn_sustain_s` | `30` | Seconds for the warn and throttle stages. Minimum 5. |
| `thermal_resume_s` | `300` | Seconds below the resume threshold before the lockout clears. Minimum 30. |
| `thermal_max_stops_hour` | `2` | Thermal stops per hour after which the automatic restart is disabled. Protection continues. |
| `thermal_test_temp` | `null` | Pretend the CPU is this temperature. For testing only — see [section 10](#10-testing-it-before-you-trust-it). |

The standalone guard additionally uses `start_script`, `stop_script`, `sdr_process_name` and `sdr_base_dir` from the same file.

**Overriding a threshold.** Only do this if you have a reason. A common one: your machine legitimately runs hot during builds and you would rather not have that count. Raising `thermal_stop` buys you headroom at the cost of margin against the critical point — never set it above your crit value, or the CPU will hit its own emergency shutdown first and the guard becomes decoration.

---

## 7. Running it without the admin panel

Plenty of sysops never install the panel. The guard runs perfectly well on its own — same file, same behaviour.

**Try it in the foreground first:**

```
cd ~/PhantomSDR-Plus
python3 thermal_guard.py --once            # what would happen here?
python3 thermal_guard.py --mode log        # watch it live, Ctrl-C to quit
```

`--mode` overrides `thermal_mode` from the command line, so you never have to write JSON by hand:

```
python3 thermal_guard.py --mode stop+restart
python3 thermal_guard.py --config /etc/phantomsdr/thermal.json
```

**Then make it permanent** with the sample unit shipped in the repository:

```
sudo cp thermal-guard.service /etc/systemd/system/
sudo nano /etc/systemd/system/thermal-guard.service   # set User= and paths
sudo systemctl daemon-reload
sudo systemctl enable --now thermal-guard
systemctl status thermal-guard
```

Read the comments at the top of `thermal-guard.service` before enabling it. Two things matter most:

- **`User=` must be an account that can actually run your start and stop scripts.** Running the guard as root is usually the wrong answer: it would run those scripts as root too.
- Either point it at an `admin_config.json` containing `start_script` and `stop_script`, or pass `--mode` on the `ExecStart` line. A minimal config is enough:

```json
{
  "sdr_base_dir": "/home/youruser/PhantomSDR-Plus",
  "sdr_process_name": "spectrumserver",
  "start_script": "start-rx888mk2.sh",
  "stop_script": "stop-websdr.sh",
  "thermal_mode": "stop+restart"
}
```

Everything the guard does still goes to `crash.log` next to that config file, plus the systemd journal (`journalctl -u thermal-guard`).

---

## 8. Enabling the throttle stage without root

By default `python3 thermal_guard.py --once` reports:

```
cpufreq    : not writable — throttle stage disabled
```

This is normal and it is not a bug. The kernel creates

```
/sys/devices/system/cpu/cpuN/cpufreq/scaling_max_freq
```

owned by `root:root`, mode `0644`. An admin panel running as an ordinary user cannot write it, so the guard skips the throttle stage and says so in the log rather than failing silently.

**The wrong fix** is running the guard as root. It also runs your start and stop scripts, and those should stay unprivileged.

**The right fix** is to hand write access on those specific files to a dedicated group. One script does it:

```
cd ~/PhantomSDR-Plus
./setup-cpufreq-perms.sh
```

It asks for your password once — and only once, at setup — then:

1. creates a system group `cpufreq` and adds you to it;
2. installs `/etc/tmpfiles.d/99-phantomsdr-cpufreq.conf` so the group ownership and `0664` mode are re-applied **on every boot** — sysfs permissions do not survive a reboot on their own;
3. applies the change immediately so you can test without rebooting.

Then, in order:

```
# 1. log out and back in (or reboot) — a new group only reaches your
#    processes through a fresh login
id | grep cpufreq

# 2. restart the panel; the guard tests for write access once, at startup
sudo systemctl restart phantomsdr-admin
#    (no logout needed this way — systemd rebuilds the group list at every
#     start. Only if the units are NOT installed: ./manage_admin.sh stop && ./manage_admin.sh start
#     — never both, they fight over port 3000)

# 3. confirm
python3 thermal_guard.py --once
#    cpufreq    : writable, throttle stage available
```

To undo it completely: `sudo ./setup-cpufreq-perms.sh --revoke`.

**Notes**

- The throttle stage still only *acts* if `thermal_mode` is `throttle` or higher. Granting permission changes nothing on its own.
- The guard lowers whatever limit is currently in force by 20 % and restores exactly that value afterwards. If you already cap your CPU (for example `MAX_SPEED` in `/etc/init.d/cpufrequtils`), your cap is what gets restored — the guard will not quietly hand you back a higher clock than you asked for.
- Some machines have no cpufreq driver exposed at all — many VPS, most containers. The script detects this and refuses to change anything. Use `stop` or `stop+restart` there; they do not depend on cpufreq.

---

## 9. Unattended operation

The most common question about the guard: *what happens when nobody is watching?* The short answer is that nobody watching is the case it was built for.

**It does not need a browser open.** The guard is a background thread inside `admin_server.py`, ticked from the graph sampler every 2 seconds. It runs whether or not anyone is logged into the panel, whether or not a browser is open, whether or not you are awake. In standalone mode it is a systemd service, which is even more independent. The dashboard card is a *window* onto the guard, not the guard itself.

**It acts without asking.** There is no confirmation dialog and no notification to wait for. At the stop threshold it stops the server, full stop. That is the entire point.

**But only if you gave it permission.** In `log` mode it will faithfully record a machine cooking itself and do nothing about it. If the reason you are reading this section is *"I am not around to watch it"*, the mode you want is `stop+restart` — it is the only one that both protects the machine and brings the service back without you.

**It only helps while the panel is alive.** The guard is part of `admin_server.py`, so a panel that died at 02:00 takes the protection with it, and a reboot leaves the machine unguarded until you log in and start it again. If nobody is watching, let systemd watch: the repository ships `phantomsdr-admin.service` and `phantomsdr-proxy.service`, which start at boot and restart the panel within five seconds of a crash. For an unattended receiver this is **strongly recommended** — arming `stop+restart` without it protects you only until the next reboot. See [ADMIN_PANEL_SETUP.md](ADMIN_PANEL_SETUP.md).

**How you find out afterwards.** In rough order of usefulness:

| Where | What you get |
|---|---|
| `crash.log` / the **CRASH** tab | Every action, timestamped. The permanent record. |
| Dashboard **THERMAL GUARD** card | Live state: current temperature, stage, lockout, stops in the last hour. |
| **Graphs** page (CPU temperature, 24 h) | The shape of the event — how fast it climbed, how long it took to cool. |
| `journalctl -u thermal-guard` | Standalone mode only. |

A sensible routine for an unattended site: `stop+restart` armed, and `grep THERMAL crash.log` whenever you happen to log in. If it is empty, there is nothing to know.

**A worked example.** Fan fails at 03:00 on a machine in `stop+restart`:

```
03:14  temperature crosses 88 °C, holds 30 s   →  warn logged
03:16  crosses 92 °C, holds 30 s               →  throttle applied (if permitted)
03:19  crosses 95 °C, holds 60 s               →  STOP — stop script runs, lockout on
03:19  watchdog restarts the server            →  guard re-stops it, logs the lockout
03:26  CPU has been under 75 °C for 5 minutes  →  lockout clears, start script runs
03:41  it overheats and stops a second time    →  rate limit reached, no more restarts
                                                  server stays down, protection stays on
```

You wake up to a WebSDR that is down, a `crash.log` that says exactly why, and — most importantly — a CPU that never got near its critical point.

---

## 10. Testing it before you trust it

Do not wait for a real heatwave to find out whether your stop script works.

**`thermal_test_temp`** makes the guard believe the CPU is at a temperature you choose. Everything else behaves completely normally — the sustain timers, the ladder, the lockout, your actual scripts.

1. Admin panel → **Settings** → **THERMAL GUARD** → **TEST TEMPERATURE**.
2. Enter a value above your stop threshold (for example `97` on an Intel).
3. Save, and watch the dashboard card and the CRASH tab.
4. **Clear the field when you are done.** A test temperature left in place means the guard is no longer reading the real sensor.

In `log` mode this shows you the whole ladder with nothing at risk — the safe first test, and the one to run before arming anything.

In `stop+restart` mode this is a **live test**: your server really will stop, and really will come back about five minutes after you clear the field. Do it when nobody is listening. It is worth doing once, because it is the only way to know that your stop and start scripts work when called by something other than you.

Standalone equivalents:

```
python3 thermal_guard.py --once                 # thresholds only, no action
python3 thermal_guard.py --mode log             # watch the ladder live
```

---

## 11. Reading the log

Everything is appended to `crash.log` next to the config file, one event per line, each prefixed `[THERMAL]`:

```
grep THERMAL crash.log
```

Lines are deliberately single-line and grep-friendly. What you will see:

| Line | Meaning |
|---|---|
| `warn: 88.4C (warn=88.0 crit=100) sustained 30s` | First rung. Nothing has been done. |
| `throttle: 92.1C sustained 30s — cpufreq max lowered 20%` | CPU clock reduced. |
| `throttle level reached: ... (no cpufreq write access — stage skipped)` | See [section 8](#8-enabling-the-throttle-stage-without-root). |
| `STOP level reached: ... mode is 'log', NOT stopping` | It would have stopped the server. Arm it. |
| `STOPPED server: 95.2C sustained 60s (stop=95.0 crit=100) — ran stop-websdr.sh` | The real thing. |
| `lockout: process reappeared at 96.0C — re-stopped (...) [12 time(s) so far]` | Something is restarting your server; the guard is winning. Rate-limited to one line per minute. |
| `rate limit: 2 thermal stops within the hour — automatic restart is now DISABLED` | Stays down for you to investigate. Protection continues. |
| `recovered: 54.0C held below 75.0 — lockout cleared` | Cool again. |
| `auto-restart: ran start-rx888mk2.sh` | Back online. |
| `back to normal: 59.0C (warn=88.0)` | Dropped off the ladder without ever stopping. |

---

## 12. Lockout and the rate limit

These are the two behaviours that surprise people, so they are worth stating plainly.

**The lockout** is what makes the guard work against *your* setup specifically. When it stops the server it does not simply issue one stop and hope. It marks itself locked, and on every 2-second tick, while the temperature is still above the resume threshold, it checks whether the server process is back — and if it is, stops it again. Your watchdog, systemd's `Restart=always`, a cron job, an impatient sysop: all of them lose that argument until the CPU cools. It clears itself automatically once the temperature has held below the resume threshold for `thermal_resume_s` (default 5 minutes).

**The CLEAR LOCKOUT button** on the dashboard card clears the lockout *and* the stops-per-hour counter, for when you have fixed the cooling and do not want to wait. It does **not** disarm the guard: if the machine is still hot, the very next check stops the server again. That is intended.

**The rate limit** (`thermal_max_stops_hour`, default 2) stops a broken machine from cycling up and down all night. After the limit is reached the guard **disables the automatic restart** and leaves the server down. Read that carefully: it disables the restart, not the protection. The lockout keeps re-stopping the server while it is over-temperature no matter how many times it has already tripped. A guard that went quiet exactly when the machine was at its worst would be worse than no guard at all.

---

## 13. Troubleshooting

**`sensor : NONE — no trusted CPU sensor on this machine`**
The guard found no allow-listed sensor and refuses to guess. Try `sensors` (from `lm-sensors`; `sudo apt install lm-sensors && sudo sensors-detect`). Inside a VM or container there is often genuinely no CPU die sensor exposed — the guard cannot protect that machine and correctly reports itself disabled rather than pretending.

**`cpufreq : not writable — throttle stage disabled`**
Expected unless you have run `./setup-cpufreq-perms.sh` — see [section 8](#8-enabling-the-throttle-stage-without-root). It only affects the throttle stage; `stop` and `stop+restart` are unaffected.

**Ran `setup-cpufreq-perms.sh`, still says not writable**
Two likely causes: you have not logged out and back in since (a new group only reaches processes through a fresh login — check with `id`), or the panel has not been restarted since (the guard tests for write access once, at startup). Do both, in that order.

**Thresholds look wrong for my CPU**
Check what the machine publishes: `cat /sys/class/hwmon/hwmon*/temp*_crit`. If your crit is unusual, or absent, set `thermal_stop` and friends to absolute values.

**It stopped my server and I do not think it was hot**
Check whether `thermal_test_temp` is still set from a test. That is by far the most common cause.

**It never fires even though the machine gets hot**
Confirm the mode is not `log`, confirm `thermal_enabled` is `true`, and compare the temperature you are seeing against the thresholds from `--once`. Remember the threshold must be held *continuously* for the sustain time.

**The server keeps restarting during a thermal event**
That is the lockout working, and the `lockout:` lines are it reporting success — your supervisor keeps trying, the guard keeps undoing it. Nothing to fix.

**The panel is not running, so is the guard running?**
No — in panel mode the guard lives inside `admin_server.py`. If you want protection independent of the panel, use the standalone service in [section 7](#7-running-it-without-the-admin-panel).

---

## 14. Turning it off or removing it

- **Pause it:** set `thermal_mode` to `log`. It keeps watching and reporting but never acts.
- **Disable it completely:** set `thermal_enabled` to `false`.
- **Standalone:** `sudo systemctl disable --now thermal-guard`.
- **Undo the cpufreq permissions:** `sudo ./setup-cpufreq-perms.sh --revoke`.

Deleting `thermal_guard.py` is also safe — `admin_server.py` imports it inside a `try`, and simply reports the guard as unavailable if it is missing.

---

## See also

- [Admin Panel Setup](ADMIN_PANEL_SETUP.md#thermal-guard) — the Thermal Guard tab in context
- [Installation](INSTALLATION.md#cpu-thermal-protection) — thermal protection during a fresh install
- [Project Structure](PROJECT_STRUCTURE.md) — where `thermal_guard.py` sits
