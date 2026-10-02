# PhantomSDR-Plus Admin Panel — Setup Guide

> ⚠️ **Security notice:** Keep this admin panel on your home network or behind a VPN. Public exposure of the admin port is not recommended without proper authentication hardening.

---

## Overview

The admin panel consists of two Python services:

| Service | File | Role |
|---|---|---|
| Admin panel | `admin_server.py` | Flask web app, binds to `127.0.0.1` (internal only) |
| Reverse proxy | `proxy.py` | Exposes both the SDR and the admin panel on a single public port |

Both services read their configuration from `admin_config.json`, which is written by `setup_admin.sh`. **Do not edit port constants directly in the Python files** — all ports and the SDR host IP are stored in `admin_config.json`.

---

## What the admin panel gives you

- **Dashboard** — live server status, CPU/RAM, top processes, recent log output, terminal
- **Config Editor** — view, edit and save any `.toml`, `.sh`, `.json`, `.h`, `.cpp` file in your installation
- **Log Viewer** — tail any log file in real time (SDR server, admin panel, RADE, crash, autorun, proxy)
- **Markers** — view and edit frequency markers
- **Chat History** — view the WebSDR chat log, clear it entirely, or delete individual messages without restarting the server
- **Waterfall Message** — broadcast a persistent banner message to all connected users, visible on the waterfall display in real time
- **Users** — live list of connected listeners with their tuned frequency, mode, duration and a ⚡ Kick button
- **Chat message deletion** — 🗑 Delete button that removes that single message from the log immediately
- **Waterfall broadcast messages** —  lets you push a persistent text banner to every connected user's waterfall
- **Spot Reporting** — start/stop the autorun FT8/FT4/JS8/WSPR decoder, pick bands/modes, and report spots to PSK Reporter / wsprnet (OFF by default), with two counters: per-decoder tiles for the current run and an all-time total beside each band/mode checkbox
- **Graphs** — CPU frequency, CPU load, CPU temperature and connected users plotted over the last 15 minutes / 1 hour / 4 hours / 12 hours / 24 hours
- **Thermal Guard** — stops the server if the CPU overheats and restarts it once cool, with thresholds derived from your own CPU; works with any start/stop method, and ships in log-only mode so it does nothing until you enable it
- **Settings** — change admin password, SDR base directory, process name, public port

---

## Requirements

- PhantomSDR-Plus already installed and running
- Python 3.8+

> [!NOTE]
> **The installer normally does this for you.** `./install.sh` — and each of the four distro installers, both RADE installers and the stats-server installer — sets the admin panel up by default, installing `pip` first with the system's own package manager if it is missing. This page is what happens during that step, and what to do if you skipped it or want to change something afterwards.

The panel's Python libraries (`flask`, `psutil`, `aiohttp`, `tomli-w`) are installed by `setup_admin.sh`; it prints the exact command to run by hand if that ever fails.

---

## Step 1 — Files

All four files ship with the repository, so there is nothing to copy:

```
admin_server.py
manage_admin.sh
setup_admin.sh
proxy.py
```

`chmod +x *.sh` after cloning (which the installation instructions already tell you to do) makes the scripts executable.

---

## Step 2 — Run the setup script

```bash
./setup_admin.sh
```

The script will:

1. Check that Python 3 is installed
2. Verify `admin_server.py` and `manage_admin.sh` are present
3. Record `127.0.0.1` as `sdr_host` in config (see [The `sdr_host` setting](#the-sdr_host-setting))
4. Ask for three port numbers. Each offers a default in brackets that a bare Enter
accepts, so a normal setup is three keystrokes:
   - **Spectrumserver port** — the port your SDR server listens on (default `8900`,
     which is what every `config-*.toml` in the repository ships with)
   - **Admin panel internal port** — where `admin_server.py` binds locally (default `3000`)
   - **Proxy public port** — the single external port that combines SDR + admin (default `8902`)

Invalid answers are rejected and re-asked, but only five times — after that the default is used. A run whose input is not a terminal (piped, cron, unattended) takes the defaults straight away instead of waiting for input that never comes.
5. Install `flask`, `psutil`, `aiohttp` and `tomli-w` via pip
6. Grant `ss` the `cap_net_admin` capability (fallback path of Kick Users, used only when the panel runs without the proxy)
7. Ask which script starts and which stops the receiver — the panel drives the server through these, and so does the thermal guard
8. Ask how far the CPU over-temperature guard may act on its own — `log`, `throttle`, `stop` or `stop+restart` — and offer to run `setup-cpufreq-perms.sh` so the throttle stage works without root (see [THERMAL_GUARD.md](THERMAL_GUARD.md))
9. Write `admin_config.json` with all settings
10. Offer to install two systemd units (panel + proxy) — auto-start on boot and restart after a crash. **Recommended, and the default** (a bare Enter accepts it): the CPU over-temperature guard only runs while the panel runs, so without the units a reboot leaves the machine unprotected. The step is skipped automatically where systemd is not PID 1 (containers, WSL1, OpenRC), or where you have no sudo.

After setup, open your browser via the proxy:
```
http://YOUR_SERVER_IP:<proxy_port>/admin
```
Default password: **`admin`**

> ⚠️ **Change the password immediately** — go to Settings on first login. A first-run wizard will guide you through setting the SDR directory, process name, public port and a new password.

---

## Step 3 — Start / Stop / Restart

There are two ways to run the panel and the proxy. **Pick one and stay with it** — the warning at the end of this section explains what happens if you mix them.

> **Method B (systemd) is strongly recommended** wherever systemd is available. The CPU over-temperature guard runs inside the panel, so a panel that dies at 03:00 or a machine that reboots leaves the CPU unprotected until someone starts it again by hand. `setup_admin.sh` now offers the units by default. Use Method A when there is no systemd — containers, WSL1, OpenRC/sysvinit — or when you deliberately want to supervise things yourself.

### Method A — `manage_admin.sh` (no root, nothing installed)

```bash
./manage_admin.sh start      # start admin panel and proxy
./manage_admin.sh stop       # stop both
./manage_admin.sh status     # show running status and PIDs
```

There is deliberately **no `restart`**. It used to kill the panel and immediately start its own copy, which collides with systemd on any machine using Method B. To restart under Method A, run `stop` then `start` — see [Restarting the panel](#restarting-the-panel) below.

One script controls **both** processes. It checks that `aiohttp` is installed before starting the proxy and prints a clear error with the fix command if it is missing.

Nothing starts by itself: after a reboot, or if the panel crashes, you start it again by hand. That is fine for a receiver you watch, but note that the CPU over-temperature guard runs inside the panel — while the panel is down, nothing is protecting the machine (see [THERMAL_GUARD.md](THERMAL_GUARD.md)).

### Method B — systemd units (starts at boot, restarts after a crash)

The repository ships two ready units, `phantomsdr-admin.service` and `phantomsdr-proxy.service`. Edit `User=` and the paths in both, then:

```bash
sudo cp phantomsdr-admin.service phantomsdr-proxy.service /etc/systemd/system/
sudo systemctl daemon-reload
./manage_admin.sh stop        # free the ports first
sudo systemctl enable --now phantomsdr-admin
sudo systemctl enable --now phantomsdr-proxy
```

Day-to-day commands then become:

```bash
sudo systemctl start   phantomsdr-admin
sudo systemctl stop    phantomsdr-admin
sudo systemctl restart phantomsdr-admin
systemctl status       phantomsdr-admin   # no sudo needed
sudo journalctl -u phantomsdr-admin -f    # live logs
```

The same four with `phantomsdr-proxy`, or both at once: `sudo systemctl restart phantomsdr-admin phantomsdr-proxy`.

`admin.log` and `proxy.log` keep working exactly as before — the units append to those same files.

One thing to do once: install the tmpfiles rule at `tmpfiles/phantomsdr-logs.conf` (edit its paths and user first). systemd creates those two logs as `root` before it drops to `User=`, and the panel's **Clear Logs** button then fails on them with `Permission denied` — see [“Clear Logs” says Permission denied](#clear-logs-says-permission-denied) below. `setup_admin.sh` installs the rule for you.

The admin unit carries `SupplementaryGroups=cpufreq`, which is what lets the thermal guard's throttle stage lower the CPU clock without the panel running as root. Create that group first with `./setup-cpufreq-perms.sh`, or systemd will refuse to start the unit; delete the line if you do not use the throttle stage.

To go back to Method A:

```bash
sudo systemctl disable --now phantomsdr-admin
sudo systemctl disable --now phantomsdr-proxy
```

> ⚠️ **Do not mix the two.** With the units enabled, `./manage_admin.sh stop` is undone by systemd five seconds later, and `./manage_admin.sh start` gives you a second, unmanaged copy fighting the systemd one over the same port. (`restart` was removed from the script for exactly this reason; it now prints an error telling you to use `systemctl`.) `./manage_admin.sh status` only reads, so it stays useful either way.

### Restarting the panel

The rest of this document says "restart the panel" in a number of places. It means whichever of these matches your method:

```bash
# Method B — systemd units (the normal setup)
sudo systemctl restart phantomsdr-admin phantomsdr-proxy

# Method A — no units installed
./manage_admin.sh stop && ./manage_admin.sh start
```

The unit ships with `KillMode=process`, and that line is load-bearing. If you start the SDR from the panel, the receiver is a child of the admin unit and inherits its cgroup. Under systemd's default `KillMode=control-group`, restarting the panel would take spectrumserver, its watchdog and the autorun daemon down with it, and stall for the full 90-second stop timeout first. With `KillMode=process` systemd signals only the panel, so `sudo systemctl restart phantomsdr-admin` leaves a busy receiver on air.

**Upgrading a unit installed before v4.1.0.** Older unit files have no such line, and restarting the panel will not add one: `systemctl restart` re-runs the program, it does not change the program's configuration. Edit the *installed* copy — the one in the repository is only a template systemd never reads:

```bash
sudo nano /etc/systemd/system/phantomsdr-admin.service
```

Add `KillMode=process` in the `[Service]` section, next to `Restart=always`. Then make systemd re-read the file and confirm:

```bash
sudo systemctl daemon-reload
systemctl show phantomsdr-admin -p KillMode
```

The second command must print `KillMode=process`. If it still prints `control-group`, systemd is running its cached copy — `systemctl show phantomsdr-admin -p NeedDaemonReload` prints `yes` while a reload is pending. Leading whitespace in unit files is ignored, so indentation does not matter.

---

## Step 4 — Open firewall port

Open only the **proxy public port** in your firewall. There is no need to expose the admin panel internal port externally:

```bash
sudo ufw allow <proxy_port>
```

---

## Step 5 — Kick Users feature

The Users page shows every currently connected listener. Each row displays the user's IP, tuned frequency, mode and how long they have been connected. To disconnect one user, click the **⚡ Kick** button on their row — only that TCP connection is dropped. All other listeners stay connected and hear nothing.

The kick is instant and surgical: the server does not restart, no audio is interrupted for anyone else, and the kicked user can reconnect immediately (the feature is for removing misbehaving or stuck connections, not for banning).

Under the hood the kick uses `ss -K dst <IP> dport <port>` to tear down the specific TCP socket. This requires a Linux capability that the setup script grants automatically. If you skipped setup or the button reports an error, apply it manually:

```bash
sudo setcap cap_net_admin+ep $(which ss)
# Verify:
getcap $(which ss)    # should show: cap_net_admin=ep
```

---

## Configuration — admin_config.json

All runtime configuration lives in `admin_config.json` in your PhantomSDR-Plus directory. `setup_admin.sh` writes the initial file; subsequent changes can be made via the Settings page or by editing the file directly.

Key fields written by `setup_admin.sh`:

| Key | Description |
|---|---|
| `port` | Admin panel internal port (`admin_server.py` binds here) |
| `public_port` | Spectrumserver port (used by the Users page to query `/users`) |
| `proxy_port` | Public port the proxy listens on |
| `sdr_host` | Host the proxy uses to reach spectrumserver — `127.0.0.1` (see below) |
| `password_hash` | SHA-256 hash of the admin password |
| `sdr_base_dir` | Path to your PhantomSDR-Plus installation |
| `sdr_process_name` | Process name to monitor (default: `spectrumserver`) |
| `start_script` / `stop_script` | Scripts the panel runs to start and stop the SDR server — also what the thermal guard acts through |

Thermal guard keys (all optional — the panel writes them when you save the Thermal Guard settings, and any that are missing fall back to these defaults):

| Key | Default | Description |
|---|---|---|
| `thermal_enabled` | `true` | Master switch for the guard |
| `thermal_mode` | `"log"` | `log` (record only, never act) · `throttle` · `stop` · `stop+restart` |
| `thermal_warn` | `null` | Warn temperature °C; `null` = derive from your CPU's critical trip point |
| `thermal_throttle` | `null` | Temperature at which the CPU clock ceiling is lowered; `null` = auto |
| `thermal_stop` | `null` | Temperature at which the server is stopped; `null` = auto |
| `thermal_resume` | `null` | Temperature the CPU must fall below to recover; `null` = auto |
| `thermal_sustain_s` | `60` | Seconds the stop temperature must be held before acting |
| `thermal_warn_sustain_s` | `30` | Seconds the warn/throttle temperatures must be held |
| `thermal_resume_s` | `300` | Seconds below the resume temperature before the lockout is released |
| `thermal_max_stops_hour` | `2` | Thermal stops per hour before the automatic restart is disabled |
| `thermal_test_temp` | `null` | Inject a fake temperature to test the guard; `null` = use the real sensor |

Changes to these take effect on the next sample — within a couple of seconds, with no restart.

To change ports after initial setup, edit `admin_config.json` and restart:

```bash
sudo systemctl restart phantomsdr-admin phantomsdr-proxy   # Method B
./manage_admin.sh stop && ./manage_admin.sh start        # Method A
```

---

## The `sdr_host` setting

`proxy.py` connects to `spectrumserver` over loopback — `sdr_host` is `127.0.0.1` in `admin_config.json`, written there by `setup_admin.sh`. You should not need to change it.

Set it to a real address only if `spectrumserver` runs on a **different machine** than the proxy. Then [restart the panel](#restarting-the-panel).

> **Changed:** earlier versions required `sdr_host` to be the machine's LAN IP, because `spectrumserver` closed WebSockets arriving from the loopback address. That filter has been removed, so local connections work normally. Two consequences: browsing `http://localhost:<port>` on the server machine itself now shows the full GUI (it used to load the page but stay blank), and the proxy no longer breaks when DHCP reassigns the machine's IP. If you are upgrading and your `admin_config.json` still holds a LAN IP, change it to `127.0.0.1` or re-run `setup_admin.sh`.

---

## proxy.py — what it is and when you need it

`proxy.py` puts both the SDR server and the admin panel on a **single public port**, routing by path prefix:

| Path | Routed to |
|---|---|
| `/admin*` | Admin panel (`localhost:<port>`) |
| Everything else | Spectrumserver (`<sdr_host>:<public_port>`) |

Without the proxy you must expose two ports separately. With the proxy you expose only one.

The proxy also removes the 4 MB WebSocket message-size cap (important for large FFT frames from the RX-888 at 60 MSPS), forwards real client IPs via `X-Forwarded-*` headers, and keeps long-lived connections alive through NAT with a 30-second heartbeat.

---

## Changing ports after setup

Edit `admin_config.json` directly:

```json
{
  "port":        3000,
  "public_port": 9001,
  "proxy_port":  9002,
  "sdr_host":    "127.0.0.1"
}
```

Then restart both services:

```bash
sudo systemctl restart phantomsdr-admin phantomsdr-proxy   # Method B
./manage_admin.sh stop && ./manage_admin.sh start        # Method A
```

If you also need `admin_server.py` to bind on a different port at launch (e.g. the systemd service), you can override with the environment variable:

```bash
ADMIN_PORT=3000 python3 admin_server.py
```

By default `admin_server.py` binds to `127.0.0.1` only. To run it standalone without the proxy (development/testing), bind to all interfaces:

```bash
ADMIN_BIND=0.0.0.0 python3 admin_server.py
```

---

## Useful manual commands

```bash
# Start admin panel manually (foreground)
python3 ~/PhantomSDR-Plus/admin_server.py

# Kill the admin panel
pkill -f admin_server.py

# Kill the proxy
pkill -f proxy.py

# Free a port that is stuck in use
sudo fuser -k 3000/tcp

# Check what is listening on a port
ss -tlnp | grep 3000
```

---

## Log files

| File | Contents |
|---|---|
| `admin.log` | Admin panel output |
| `proxy.log` | Proxy startup banner + one access-log line per proxied request |
| `logwebsdr.txt` | Launcher and watchdog log — start/stop, receiver driver, websdr.org registration |
| `spectrumserver.log` | The receiver process's own output — FFT and OpenCL setup, per-client connections, errors. The biggest of these files; it is rotated, so `spectrumserver.log.1` may sit beside it |
| `rade.log` | RADE/FreeDV sidecar log |
| `autorun.log` | Decoder daemon log — spots, SNR, drift |
| `crash.log` | Crash reports and thermal events: `[CRASH]` / `[TERMINATE]` backtraces, `[EXIT]` notes and `[THERMAL]` lines from the guard. **Normally empty** — anything in it is worth reading |

All of these are readable from the panel's **Log Viewer** tabs (LOGWEBSDR, SPECTRUMSERVER, ADMIN, RADE, CRASH, AUTORUN, PROXY). The viewer shows the last 150 lines of whichever tab is selected and refreshes every 3 seconds when auto-refresh is on; it reads only the tail, so the size of the file does not matter.

### Rotating proxy.log and admin.log

`proxy.log` records every proxied request and `admin.log` every request that reaches the panel itself. Neither is rotated by default. The dashboard's polling used to dominate both — `/admin/api/status` fires every ~3 seconds for as long as a tab is open — but those polls are now filtered out of both files (see below), so rotation is there to bound slow growth rather than a flood.

The repo ships a logrotate config at `logrotate/phantomsdr` (daily, or sooner if a log passes 10 MB; keeps 7 gzipped archives in `logproxy/`, so they do not clutter the project root). **It is site-specific — open it and change the three log paths, the `olddir` path and the `su` user to match your machine before installing**, then:

```bash
sudo cp logrotate/phantomsdr /etc/logrotate.d/phantomsdr
sudo logrotate -d /etc/logrotate.d/phantomsdr     # dry run, should list all three logs
```

`logrotate/phantomsdr` in the repo and `/etc/logrotate.d/phantomsdr` are two **independent copies** — `cp` does not link them. Editing the repo file changes nothing on a running system until you re-run the `sudo cp` above. Only the `/etc` copy is what logrotate actually reads.

The config uses `copytruncate`, which is required: `manage_admin.sh` starts both processes with `>> <log>` and neither reopens its stdout, so a rename-based rotation would leave them writing into the rotated file while the new log stays empty forever.

Archives land in `logproxy/` (created automatically by `createolddir`) and are named `proxy.log.1.gz` … `proxy.log.7.gz`, newest first. Read one with `zcat logproxy/proxy.log.1.gz | less`, or search all of them at once with `zgrep "pattern" logproxy/*.gz`.

The panel's **Clear Logs** button truncates **every** file in the table above, `autorun.log` and `proxy.log` included (`CLEAR_EXCLUDE` in `admin_server.py` is empty). Note what that costs on `autorun.log`: its decode history is the only record of what was heard and when, and nothing can reconstruct it — what survives a clear is whatever logrotate has already rotated into `logproxy/`, so a clear discards everything decoded since the last rotation. Clearing it under a running decoder is safe: the daemon holds it open `O_APPEND` and goes on appending to the same inode. The toast names what was cleared, and if a file could not be written — a `proxy.log` owned by a different user, say, on a split-user install — it names that file and the error instead of reporting success, and leaves that log's pane on screen rather than blanking it. The files are truncated in place, never deleted: both `manage_admin.sh` and the systemd units open them `O_APPEND`, so an unlinked file would go on filling an invisible inode until the service restarts.

Successful polls are filtered out of **both** access logs, by the `QuietPollFilter` in `proxy.py` and the one in `admin_server.py`. The dashboard hits `/admin/api/status` every 3 seconds, and `/admin/api/logs`, `/admin/api/autorun/status`, `/admin/api/users`, `/admin/api/graph-stats` and `/admin/api/chat` every 5 seconds; unfiltered they are ~95% of both files. Only plain `200`s on those paths are dropped — any other status, path or method is logged as before, so a failing poll stays visible and state-changing actions (`kick`, `autorun/start`, …) are separate paths and always recorded. The one deliberate exception is `/admin/api/logs/clear`, filtered in both files: its own access line is written *after* the truncate, so without the filter every successful clear left one fresh line behind in the log it had just emptied, and the button looked broken.

Because `proxy.log` is an access log, it contains visitor IP addresses and user-agent strings — keep that in mind before sharing it when asking for help.

### "Clear Logs" says Permission denied

On a machine where the systemd units were installed on a clean tree, the button can come back with:

```
✗ Could not clear admin.log ([Errno 13] Permission denied: /home/you/PhantomSDR-Plus/admin.log),
  proxy.log ([Errno 13] Permission denied: /home/you/PhantomSDR-Plus/proxy.log)
```

It is always those two files and never the other five, because they are the only ones systemd creates itself. `StandardOutput=append:` is opened by PID 1 **before** it drops to `User=`, so a log that does not exist yet is created `root:root 0644`. The panel runs as your user and cannot truncate it. The other five logs are created by the launcher scripts, which already run as your user, so they clear normally. Where the two logs predate the units — `manage_admin.sh` created them with `>>` — they are already owned correctly and the button works, which is why the problem only shows up on a fresh systemd-first install.

Confirm with `ls -l admin.log proxy.log`: the failing ones say `root root`. Repair them:

```bash
sudo chown "$(id -un):$(id -gn)" admin.log proxy.log
sudo chmod 664 admin.log proxy.log
```

No restart is needed — systemd keeps writing through the file descriptor it already holds, and appending does not change ownership. Press **Clear Logs** again and both are emptied.

**Do not delete the files instead.** Both are held open `O_APPEND`; unlinking one leaves systemd filling an invisible inode until the service restarts, and the file that reappears is root-owned again.

To stop it coming back, install the tmpfiles rule the repo ships at `tmpfiles/phantomsdr-logs.conf`. It re-creates both logs with the right owner at every boot, before the units start, so a removed log — manual cleanup, a reinstall, a moved installation directory — never returns root-owned. **It is site-specific: open it and change the two paths and the user:group to match your machine first**, then:

```bash
sudo cp tmpfiles/phantomsdr-logs.conf /etc/tmpfiles.d/99-phantomsdr-logs.conf
sudo systemd-tmpfiles --create /etc/tmpfiles.d/99-phantomsdr-logs.conf
```

As with `logrotate/phantomsdr`, the repo file and the `/etc` copy are independent — editing the repo copy changes nothing until you re-run the `cp`. On systemd 254 and newer the rule also repairs the ownership and mode of a log that already exists, so it fixes the current failure as well as future ones; on older versions the `chown` above is what unblocks the button.

`setup_admin.sh` does all of this for you when it installs the units, so a setup made with the script never hits this. The steps above are for a hand-installed pair, or for an installation that predates the script's log-ownership step.

Logrotate does not reintroduce the problem: the shipped config uses `copytruncate`, which keeps the same inode and therefore the same owner.

---

## Access summary

| Setup | SDR | Admin panel |
|---|---|---|
| Without proxy | `http://YOUR_IP:<public_port>` | `http://YOUR_IP:<port>/admin` |
| With proxy | `http://YOUR_IP:<proxy_port>` | `http://YOUR_IP:<proxy_port>/admin` |

---

## Chat message deletion

The Chat History page lists every message in the current chat log. Each entry has a **🗑 Delete** button that removes that single message from the log immediately — no server restart required.

How it works:

- The admin panel rewrites the chat log file in place, stripping only the selected message line.
- The change takes effect for any user who reloads the chat; already-loaded chat history in open browser tabs is not retroactively updated.
- Clearing the entire log (the **Clear All** button) truncates the file, which also takes effect without a restart.

The delete button is rendered consistently across all five Svelte App variants. If a deletion appears not to take effect, confirm the admin panel has write permission to the chat log file:

```bash
ls -l ~/PhantomSDR-Plus/chat.jsonl   # path depends on your config
```

---

## Waterfall broadcast messages

The **Waterfall Message** panel lets you push a persistent text banner to every connected user's waterfall display without touching the server process.

### Sending a message

1. Open the admin panel and go to **Waterfall Message**.
2. Type your message text and choose a colour (hex, e.g. `#ffdd00`).
3. Click **Send** — the message appears on all active waterfall views immediately.

### Clearing the message

Click **Clear** to remove the banner from all waterfalls. The message state is held in memory by the admin panel; it is cleared automatically if the admin panel process is restarted.

### How it works

The admin panel exposes two internal endpoints that the proxy forwards:

| Endpoint | Method | Purpose |
|---|---|---|
| `/admin/api/waterfall-message` | `POST` | Set or clear the current banner text and colour |
| `/admin/api/waterfall-message` | `GET` | Return the current message state as JSON |

The frontend polls the message state and renders it as an overlay on the waterfall canvas. No WebSocket reconnection or page reload is needed on the client side.

### Typical uses

- Announce scheduled maintenance: `"Server restart in 10 minutes"`
- Flag band conditions: `"Solar flux 180 — 10m wide open"`
- Welcome message: `"Welcome to SV1BTL WebSDR — Athens, KM17"`

---

## System Graphs

The **Graphs** page plots four measures against one shared time axis:

- **CPU frequency** — average clock across all cores, in GHz
- **CPU load** — total utilisation, in percent
- **CPU temperature** — in °C, with dashed guides at 70 °C (warm) and 80 °C (critical)
- **Users online** — listeners connected to the WebSDR at that moment

Pick a range with **15 MIN / 1 HOUR / 4 HOURS / 12 HOURS / 24 HOURS**. Hovering the plot draws a crosshair and reads out all four values at that instant. The four cards above the plot always show the newest sample.

### How sampling works

A background thread in `admin_server.py` takes one sample every **2 seconds**. Samples are held in two tiers: the last **1 hour** at full 2-second resolution (1800 points), and **24 hours** of 30-second averages (2880 points) for the longer ranges. The page picks the tier that covers the range you chose, and says `30s averages` in the header when you are looking at the aggregated one.

Storing a full day at 2-second resolution would mean ~43000 points — tens of MB of memory, a multi-megabyte first load, and about 40 points per pixel of canvas, which no screen can render. Averaging to 30 seconds keeps a day in 2880 points.

Sampling starts together with the admin panel, not when you first open the page, so the page opens onto history that already exists.

The buffer is **memory-only**: nothing is written to disk, and the history is lost when the admin panel restarts. That is deliberate — it keeps the feature out of log rotation and off your disk.

2 seconds gives a near-live view and is short enough not to alias CPU frequency, which on a modern CPU swings between its idle and turbo clock from one sample to the next. A sample costs about a millisecond, so the sampler is negligible next to the SDR server. The page polls at the tier's own cadence — every 2 seconds on the live ranges, every 30 seconds on the aggregated ones, because asking more often than points are produced only returns empty replies.

To change the cadence or the retention, edit these constants near the top of the sampler block in `admin_server.py` and restart:

```python
GRAPH_INTERVAL_S   = 2          # seconds between fine samples
GRAPH_FINE_S       = 3600       # how far back the fine tier reaches (1h)
GRAPH_COARSE_EVERY = 15         # fine samples per coarse point (15 x 2s = 30s)
GRAPH_COARSE_S     = 24 * 3600  # how far back the coarse tier reaches (24h)
```

### Where the numbers come from

| Measure | Source |
|---|---|
| CPU frequency | `psutil.cpu_freq()`, falling back to `/sys/devices/system/cpu/cpu*/cpufreq/`. This is the same kernel data `cpufreq-info` formats, so **cpufrequtils is not required**. |
| CPU load | `psutil.cpu_percent()` |
| CPU temperature | `psutil.sensors_temperatures()`, falling back to `/sys/class/thermal`, then the `sensors` command |
| Users online | spectrumserver's own `/users` endpoint — the authoritative session list. Counting sockets with `ss` cannot see real client IPs behind proxy.py. |

If a measure is unavailable on your machine, that panel says so rather than drawing a flat zero line. A reading that fails mid-run breaks the line, so a gap in the data never looks like a measured value.

### Why four panels and not one graph

GHz, percent, degrees and a head-count share no common scale. Drawing them on one plot needs several y-axes, and the crossings that produces are artefacts of the scaling rather than facts about the server. Four stacked panels on one time axis keep the comparison honest. Every panel is anchored at zero, so curve height stays proportional to the value.

Colour is reserved for temperature, where amber and red mark the thresholds above. The other panels share one colour because each holds a single series that its own title already names.

### Endpoint

`GET /admin/api/graph-stats?since=<epoch>` (login required) returns the samples newer than `since`, so the page polls incrementally instead of re-downloading the whole buffer every tick.

---

## Thermal Guard

> 📖 **Full manual: [THERMAL_GUARD.md](THERMAL_GUARD.md)** — the four modes and what a sysop must do for each, running it without the panel, enabling the throttle stage without root, testing and troubleshooting. This section covers the panel side.

Stops the SDR server when the CPU gets dangerously hot, and starts it again once it has cooled. It is part of the panel — nothing extra to install — and appears as a **THERMAL GUARD** card on the Dashboard with its settings under **Settings**.

It ships **inert**: the mode starts at `log`, so out of the box it only records what it *would* have done. Nothing touches your server until you change the mode.

### It works with any start/stop method

The guard never tries to work out what supervises your server. It acts through whatever scripts you set as **Default start script** and **Default stop script** in Settings, and while the CPU is over-temp it re-issues the stop on **every check** (every 2 s). Anything that brings the server back — the watchdog inside `start-*.sh`, a systemd unit, a cron job, a `tmux` session — is undone within a couple of seconds until the machine has cooled. That is the *lockout*.

If no stop script is configured, it falls back to `SIGTERM` to the process named in `sdr_process_name`, then `SIGKILL` after a 10-second grace period.

### Thresholds come from your own CPU

Rather than a fixed number that is wrong on most hardware, the guard reads the critical trip point the kernel publishes for your CPU and works backwards from it:

| Your CPU reports | warn | throttle | stop | resume |
|---|---|---|---|---|
| Intel, limit 100 °C | 88 | 92 | **95** | 75 |
| AMD Ryzen, limit 95 °C | 83 | 87 | **90** | 70 |
| Raspberry Pi, limit 85 °C | 73 | 77 | **80** | 60 |

This matters: a fixed 95 °C would be near-normal on an Intel, but on a Ryzen — whose Tctl sits at 95 °C by design under boost — it would stop the server on a healthy machine, and on a Pi, which throttles at 80 °C, it would never fire at all. Any threshold can still be set by hand in Settings; leave a field blank for *auto*.

To see what your machine looks like to the guard:

```bash
python3 thermal_guard.py --once
```

```
sensor     : hwmon:coretemp
temperature: 58.0 C
crit       : 100.0 C
mode       : log
thresholds : warn 88.0  throttle 92.0  stop 95.0  resume 75.0 (C)
cpufreq    : not writable — throttle stage disabled
```

### The four stages

Stopping the server is the last resort, not the only tool:

1. **warn** — logged, nothing else.
2. **throttle** — lowers the CPU clock ceiling by 20 %. Needs a cpufreq driver *and* write access to `scaling_max_freq`, which normally means running as root; where that is unavailable (the usual case for an unprivileged panel, and on most VPS) the stage **disables itself** and the guard falls back to warn → stop. `./setup-cpufreq-perms.sh` grants that write access to a `cpufreq` group, so the stage works without running the panel as root — see [THERMAL_GUARD.md](THERMAL_GUARD.md#8-enabling-the-throttle-stage-without-root).
3. **stop** — runs your stop script and holds the server down (see lockout above).
4. **resume** — after the CPU has stayed below the resume temperature for `thermal_resume_s` (5 minutes by default), the clock ceiling is restored and, in `stop+restart` mode, your start script runs again.

Each stage must be **held** for its sustain time — 30 s for warn and throttle, 60 s for stop — so a brief spike during a compile never trips it.

Repeated trips are capped by `thermal_max_stops_hour` (2 by default). Once that is reached the *automatic restart* is disabled while the protection keeps working, so an overheating machine cannot flap between running and stopped.

### Which sensors are used

Only real CPU-die sensors: `coretemp` (Intel), `k10temp` / `zenpower` (AMD), `cpu_thermal` / `soc_thermal` (ARM, Raspberry Pi). The hottest reading on the chip is used, not the average.

`acpitz` and unlabelled thermal zones are **deliberately ignored** — they often report a case or board temperature tens of degrees below the actual CPU, so a guard trusting them would never fire when it mattered. If your machine has no usable sensor (common on a VPS or inside a container) the card says `no trusted CPU sensor` and the guard stays inactive rather than pretending to protect you.

### What it writes

Everything goes to `crash.log`, i.e. the **CRASH** tab of the Log Viewer, one event per line:

```
[THERMAL] warn: 89.0C (warn=88.0 crit=100.0) sustained 31s
[THERMAL] throttle: 93.0C sustained 30s — cpufreq max lowered 20%
[THERMAL] STOPPED server: 96.0C sustained 62s (stop=95.0 crit=100.0) — Started stop-websdr.sh
[THERMAL] lockout: process reappeared at 94.0C — re-stopped [3 time(s) so far]
[THERMAL] recovered: 74.0C held below 75.0 — lockout cleared
[THERMAL] auto-restart: Started start-rx888mk2.sh
```

The lockout line is rate-limited to one per minute, so a supervisor that keeps fighting the guard cannot flood the log.

### Testing it before you trust it

Set **TEST TEMPERATURE** in Settings to a value above your stop threshold. The guard treats it as a real reading, so the whole path — warn, throttle, stop, lockout, recover, restart — runs on demand. Clear the field to return to the real sensor.

> Running this test with the mode set to `stop` really does stop the server and disconnect your listeners. Do it when nobody is on, or leave the mode at `log`, where the test shows what *would* have happened without touching anything.

### Suggested way to adopt it

1. Leave the mode at **`log`** for a week and carry on as normal.
2. Read the CRASH tab after your heavy moments — a full rebuild, a hot afternoon. If nothing appears, your machine never came close.
3. If the logged temperatures look right, set the mode to **`stop`** (or **`stop+restart`** to have it come back by itself).
4. Prove it once with the test-temperature field, then leave it alone.

### Recovering from a lockout

**CLEAR LOCKOUT** on the Dashboard card clears the lockout and the rate limit. It does not disarm the guard: if the CPU is still too hot, the next check simply stops the server again. Use it after you have fixed the cooling.

### Endpoint

`GET /admin/api/thermal` (login required) returns the guard's full state — sensor, thresholds, stage, lockout, last event. `POST` with `{"action":"reset"}` does the same as the CLEAR LOCKOUT button.

### Without the admin panel

`thermal_guard.py` is stdlib-only and runs on its own, reading the same `admin_config.json`:

```bash
python3 thermal_guard.py --once              # print sensor, trip point and thresholds
python3 thermal_guard.py                     # run as a service (log-only until armed)
python3 thermal_guard.py --mode stop+restart # arm it without writing any config file
python3 thermal_guard.py --config /path/to/other.json
python3 thermal_guard.py --help
```

`--mode` overrides `thermal_mode` from the config file, so a machine with no panel can be armed straight from its systemd unit with no JSON at all.

---

## Spot Reporting (Autorun FT8/FT4/JS8/WSPR)

The **Spot Reporting** tab controls the autorun daemon (`autorun/index.js`) — a Node.js process that decodes FT8/FT4/JS8/WSPR server-side straight off the receiver and uploads spots to the reporting networks:

- **FT8 / FT4 / JS8 → PSK Reporter** (IPFIX/UDP)
- **WSPR → wsprnet.org** (HTTP)

> **JS8 is spotted at Normal speed only** — the 15 s calling cycle, where heartbeats and CQs are. Spots come from heartbeats, compound frames and directed messages; group destinations such as `@ALLCALL` and callsigns the decoder could not resolve (`<....>`) are never reported. JS8 shares the PSK Reporter queue with FT8 and FT4 and is counted separately, exactly as they are.


**Reporting is OFF by default.** Nothing is uploaded until you enable a destination and press **Start**. Decoding and uploading are independent: the daemon can decode and log with reporting off, so you can verify activity before anything goes public.

> ⚠️ Spots are uploaded to public networks under **your callsign**. Only enable bands/modes your receiver genuinely hears, and set the correct grid square.

### Prerequisites

The autorun daemon needs Node.js 22+, the `ws` + `cbor-x` npm packages (resolved via the `autorun/node_modules` symlink → `frontend/node_modules`), and `util-linux` (`taskset`). The installers set all of this up automatically — see the [Autorun Spot Reporter section of INSTALLATION.md](INSTALLATION.md#autorun-spot-reporter-ft8ft4wspr). If **Start** fails, that symlink or `taskset` is the usual cause (see Troubleshooting below).

### Using the tab

1. **Identity** — callsign and grid. Pre-filled from `frontend/site_information.json` (`siteSysop` / `siteGridSquare`, truncated to 6 chars); override here if needed.
2. **Band × mode matrix** — tick the combinations to decode. Rows are bands, columns are FT8 / FT4 / JS8 / WSPR; unsupported cells are disabled. WSPR additionally covers the LF/MF bands (2200m, 630m) and an extra 80m EU channel.
3. **Destinations** — enable **PSK Reporter** and/or **wsprnet** (both off by default).
4. **Max slots** — a safety cap on how many band/mode slots can run at once.
5. **Start / Stop** — spawns/kills the daemon (pinned to the top CPU cores with `taskset`, chosen automatically for the machine — see *Resource requirements & limitations* below). **Save** / **Reload** persist and re-read the config; **Free All** clears every slot.

The status card polls every 5 s and shows running state, decode/upload counts and the last upload time. A **📶 REPORTING** badge appears on the main waterfall while reporting is active.

> **"0 sent" for the first few minutes is normal.** PSK Reporter uploads batch every **5 minutes** and wsprnet every **2 minutes** — spots queue until the next flush. The status card shows the pending count and cadence.

### Changing bands or modes while it is running

**Changes do not take effect until the daemon is restarted.** `autorun/index.js` reads `autorun.json` once, at startup. There is no file watcher and no reload signal — the only signals it handles are SIGINT and SIGTERM, both meaning shut down. A running daemon therefore keeps decoding the slots it was launched with, whatever you save afterwards.

To apply a change:

1. Tick / untick the bands and modes you want
2. **SAVE CONFIG**
3. **STOP**
4. **START**

Or simply **STOP** → change the boxes → **START**, since START saves the config before launching.

> ⚠️ **Pressing START without stopping first does not apply the change.** START saves the config, then the start request answers `already running` and nothing relaunches. You get a "saved" toast beside an "already running" error while the daemon carries on with the **old** bands — easy to read as success. Always STOP first.

What a restart does to the counters:

- **The all-time counts beside each checkbox survive** — they live in `autorun-totals.json`, which is not deleted on shutdown.
- **The per-decoder tiles reset to zero**, being per-run by design.
- **Nothing queued is lost**: shutdown flushes pending spots before exiting.
- A **newly enabled** band starts at `0`; a band you had used **before** resumes its previous total.
- A band you **deselect keeps its number** next to the now-unchecked box; the history is not deleted.

Decoding stops only for the few seconds between STOP and START.

### Spot counters

Two different counts are shown, and they answer different questions.

**SPOTS UPLOADED PER DECODER** — a tile per decoder (FT8 / FT4 / JS8 / WSPR) with the spots uploaded **since the daemon last started**, under it the decode count and how many are still queued. Stop/Start resets these to zero. A decoder whose destination is switched off shows its decodes and `reporting off` rather than a bare `0`, because zero uploads is a setting there, not a fault.

**The number beside each checkbox** in BANDS & MODES is that band+mode's **all-time** uploaded spots. These are kept in `autorun-totals.json` and survive restarts. **Amber with a dot in front** (`·123`) means that slot has decoded but not uploaded yet. That is normal between flushes — PSK Reporter uploads every 5 minutes and wsprnet every 2 — so FT8/FT4 counts sit amber for the first few minutes after a start. It also stays amber if that decoder's destination is switched off. A plain `0` with no dot means that slot is enabled but has decoded nothing yet — WSPR sits at zero for several minutes after a start, because it runs on a 2-minute cycle while FT8 is already counting in the hundreds. A slot the daemon has never run shows nothing at all. Hover any number for the uploads, the decodes and the time of the last upload.

FT8 and FT4 share one PSK Reporter upload queue, so the daemon counts each spot against its own mode and band as it goes out; the split is not estimated from the totals afterwards.

**Clearing the counters.** **FREE ALL SLOTS** unticks every band/mode, turns both destinations off, stops the daemon and **erases the all-time counters** — after it, no number is shown beside any checkbox. This is the only way to reset them, and it cannot be undone. The button stops the daemon and waits for it to exit before deleting `autorun-totals.json`, because the daemon rewrites that file on shutdown; deleting it under a live daemon would simply bring the numbers back.

### Resource requirements & limitations

The daemon is deliberately lightweight and runs on low-resource hardware (a 4-core i5 is fine), but there are real limits to be aware of.

**Autorun CPU pinning is config-aware and automatic.** The **autorun daemon** is always launched by the admin panel (`admin_server.py`), so its pin is set on every install without any configuration: it derives a `taskset` core range from the CPU count, reserving a few of the top cores for decoding, or runs unpinned on ≤ 4 cores.

**spectrumserver pinning is up to your own start method.** How you launch spectrumserver varies between installs (SDR type, tooling, personal scripts), so this document does not assume any particular launcher. The admin panel does not start or pin spectrumserver — that is entirely down to whatever command or service you use to run it. If you want spectrumserver kept off the cores the autorun daemon uses, pin it yourself with `taskset` in your own launch command (see the override section below). If you don't, it simply runs unpinned and the OS scheduler balances it — correct and safe, you just lose the deliberate core separation.

For reference, the autorun daemon reserves these top cores (so if you pin spectrumserver, keep it to the lower cores to avoid overlap):

| Logical CPUs | autorun daemon uses | leave for spectrumserver |
|---|---|---|
| ≤ 4 | *unpinned* | *unpinned* |
| 6 | `5` | `0-4` |
| 8 | `6-7` | `0-5` |
| 12 (e.g. 8P+4E hybrid) | `8-11` | `0-7` |
| 16 | `12-15` | `0-11` |

On a **4-core (or fewer)** machine there is nothing to segregate, so the autorun daemon also runs *unpinned* and shares all cores — correct and safe, but the SDR FFT and the decode bursts compete for the same cores.

**Known limitations:**

1. **The real bottleneck is spectrumserver + SDR bandwidth, not the daemon.** An RX888 @ 30 MHz needs OpenCL/GPU; a low-core CPU without a capable GPU cannot sustain that FFT. Pair low-resource hardware with a narrower SDR (RSP1A ≈ 10 MHz, RTL-SDR ≈ 2.4 MHz).
2. **WSPR is the CPU long pole.** Its Fano decoder is a JS port (~30 s per band, single-threaded). The 4-worker pool runs 4 decodes in parallel; enabling **more than ~4 WSPR bands** at once can queue past the 120 s slot, especially while the SDR is competing for cores. FT8/FT4 decodes are cheap by comparison.
3. **Slot-count scaling.** The ~2–2.5 cores / 600–700 MB figure is for the full ~28 slots on an 8-core box. On 4 shared cores, keep it to a handful of bands (guideline: ≤ 6 FT8/FT4 + ≤ 3 WSPR) and watch the pool's `queued` stat.
4. **Pinning assumes Intel hybrid topology** (lower cores = faster P-cores). On AMD or CPUs with interleaved SMT numbering the auto split is still valid (no overlap, no crash) but "lower cores are faster" may not literally hold, and on a hyperthreaded 4C/8T part the top cores are SMT siblings — confined, not fully isolated. Where the auto range isn't ideal, use the **manual override** below.
5. **Band coverage is limited by the receiver.** The RX888 config (`sps=60000000` → 30 MHz Nyquist) cannot reach 6 m and above; the band table is 160 m–10 m. Other SDRs cover whatever their tuned window allows.
6. **Reporting cadence.** PSK Reporter flushes every 5 min, wsprnet every 2 min — "0 sent" in the first few minutes is normal, not a fault.

### Manual CPU-pin override (advanced)

The auto-derived core split is right for most machines, but you can force a specific pinning where it isn't (AMD CCX/CCD, ARM big.LITTLE, interleaved SMT). Two independent overrides, each accepting a `taskset -c` core list (`2-3`, `0,2,4`, `0-2,5`) or `none`/`off`/`unpinned` to disable pinning. An invalid value is ignored and the auto-derive runs — a typo can never stop a launch.

**Autorun daemon** — `AUTORUN_CORES` env var, or a `"cores"` field in `autorun.json` (env wins). The `"cores"` field is preserved across admin-panel **Save**, so a hand-edit sticks. Two ways to set it:

*Option A — `autorun.json` (persistent, recommended).* Add a `"cores"` line to the config at the repo root, then **Stop → Start** the daemon on the Spot Reporting tab:

```jsonc
// autorun.json
{ "identity": { "callsign": "SV1BTL", "grid": "KM17VX" },
  "reporting": { "pskreporter": true, "wsprnet": false },
  "slots": [ /* … */ ],
  "cores": "2-3" }          // or "none" to run unpinned
```

*Option B — environment variable (one-off).* The daemon is spawned by the admin panel, so the var must be in the **admin panel's** environment — set it and restart the panel (env wins over the `autorun.json` value):

```bash
# Method A — the var must be set on the process that starts:
./manage_admin.sh stop && AUTORUN_CORES=2-3 ./manage_admin.sh start

# Method B — systemd ignores a var set on the systemctl command line,
# so put it in the unit instead:
sudo systemctl set-environment AUTORUN_CORES=2-3
sudo systemctl restart phantomsdr-admin
```

**spectrumserver** — pin it yourself by prepending `taskset -c <cores>` to whatever command you use to start the server. This works with any start method (a direct launch, an SDR pipeline, a service unit, etc.):

```bash
# pin the server to cores 0-3, direct launch:
taskset -c 0-3 ./build/spectrumserver --config <your-config>.toml < <your-input>
# or in an SDR pipeline:
<your-sdr-source> | taskset -c 0-3 ./build/spectrumserver --config <your-config>.toml
```

> ⚠️ **Make it survive restarts.** An inline `taskset` only applies to that one launch. If something auto-restarts the server (a watchdog, a systemd service, a cron/`@reboot` entry, …), add the `taskset` prefix inside the script or unit that actually starts it — otherwise the restart drops the pin.

**Verify the pin took** — print the running processes' actual CPU affinity:

```bash
taskset -cp "$(pgrep -f 'autorun/index.js')"   # autorun daemon
taskset -cp "$(pgrep -x spectrumserver)"       # spectrumserver
```

**Accepted values (both overrides):** a `taskset -c` list (`2-3`, `0,2,4`, `0-2,5`), or `none`/`off`/`unpinned` for no pinning. Anything malformed is ignored and the auto-derive runs, so a typo can never block startup.

> On a Raspberry Pi / any ≤4-core box you normally need neither — the auto path already runs both processes unpinned, which is the correct choice on a small, homogeneous CPU. The override is for larger non-Intel-hybrid machines.

### Files and endpoints

| Item | Purpose |
|---|---|
| `autorun.json` | Saved config (identity, slots, destinations, max slots, optional `cores` pin override). Written by the tab; git-ignored. |
| `autorun-status.json` | Live status the status card reads (pid, counts, last upload). Written every 15 s; removed on stop. |
| `frontend/dist/autorun-active.json` | Public badge data served at `/autorun-active.json`. Empty when reporting is off. |
| `autorun.log` | Daemon stdout/stderr. |
| `GET/POST /admin/api/autorun/config` | Read / write `autorun.json` (validates callsign, grid, band/mode combos, slot cap). |
| `GET /admin/api/autorun/status` | Running state (`pgrep`) + `autorun-status.json`. |
| `POST /admin/api/autorun/start` / `stop` | Spawn (`taskset -c <auto> node autorun/index.js`) / `SIGTERM`. The core range is derived from the CPU (see below). |

> **Note:** after upgrading `admin_server.py` you must [restart the panel](#restarting-the-panel) to load new autorun routes or an updated band/mode matrix. The daemon runs as a separate process, so it survives admin-panel restarts.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| Admin panel not starting | Check `admin.log` — usually a missing Python package |
| Proxy not starting | Run `python3 -c "import aiohttp"` — if it fails: `pip3 install aiohttp --break-system-packages` |
| `proxy.log` is empty | First check the proxy is actually running (`./manage_admin.sh status`). If it is, you are on an old version: the launcher must use `python3 -u` (unbuffered — otherwise the startup banner never leaves the 8 KB buffer), and `proxy.py`'s `main()` must call `logging.basicConfig()` (otherwise aiohttp's access logger has no handler and every request line is discarded, because `web.AppRunner` — unlike `web.run_app` — does not configure logging). |
| Proxy starts but waterfall is blank | Check `sdr_host` in `admin_config.json` — normally `127.0.0.1`. If it holds an old LAN IP from a previous version, change it and [restart the panel](#restarting-the-panel) |
| Kick button says "no connections" | Run `getcap $(which ss)` — if no `cap_net_admin`, run `sudo setcap cap_net_admin+ep $(which ss)` |
| Status always shows OFFLINE | Go to Settings → SDR Process Name — set it to the exact name shown by `ps -eo comm,args \| grep -v grep` |
| Users page shows no data | Verify the endpoint works: `curl http://127.0.0.1:<public_port>/users` |
| External browser gets NetworkError | Check proxy is running: `./manage_admin.sh status` |
| Proxy broke after a network change | Only relevant if `sdr_host` still holds a LAN IP — set it to `127.0.0.1` and [restart the panel](#restarting-the-panel) |
| Chat delete button has no effect | Check write permission on the chat log file: `ls -l ~/PhantomSDR-Plus/chat.jsonl` |
| Waterfall message not appearing | Confirm the proxy is running (`./manage_admin.sh status`) and the frontend is on a recent build that includes the overlay renderer |
| Waterfall message lost after restart | Expected — message state is in-memory only; re-send it after restarting the admin panel |
| Spot Reporting "Start" fails / daemon exits immediately | Check `autorun.log`. Usually the missing `autorun/node_modules` symlink (`ln -sfn ../frontend/node_modules autorun/node_modules`) or `taskset` not installed (`sudo apt install -y util-linux`). |
| Spot Reporting: daemon runs but `decodes` stays 0 and `autorun.log` shows `504` / `tap closed 1006` | The audio tap can't reach spectrumserver. The daemon auto-detects the port from the **running** server's config; the `[autorun] tap backend: HOST:PORT` log line must match your `[server] port`. If it's wrong (or the server wasn't running at start), pin it in `autorun.json`: `"server": { "host": "127.0.0.1", "port": 9002 }`, then Stop→Start. |
| Spot Reporting shows "0 sent" | Normal for the first few minutes — PSK Reporter flushes every 5 min, wsprnet every 2 min. Confirm a destination is enabled and the daemon is running. |
| New bands/modes not showing in the matrix | [Restart the panel](#restarting-the-panel) — the matrix is loaded at admin start. |
| `autorun.log` shows `MODULE_TYPELESS_PACKAGE_JSON` / "Reparsing as ES module … performance overhead" | Cosmetic warning (decoding still works). `frontend/src/modules/package.json` is missing `"type": "module"`; add that line near the top, then Stop→Start. No frontend rebuild needed — the daemon imports the source file directly. |
| Spot Reporting "Start" fails with `taskset: … Invalid argument` on an old/small PC | Should not happen with the config-aware launcher — the core range is derived from the CPU count and goes unpinned on ≤ 4 cores. If seen, `admin_server.py` predates that change; update it (`_autorun_taskset_prefix`) and [restart the panel](#restarting-the-panel). |
| REPORTING badge not on the waterfall | Reporting must be ON with at least one slot; the badge reads `/autorun-active.json`. Rebuild the frontend if `dist/index.html` predates the badge. |
