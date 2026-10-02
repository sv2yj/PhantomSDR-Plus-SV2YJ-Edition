# System Stats Installation Guide

A comprehensive guide to add real-time server monitoring to your PhantomSDR application using the automated installation script.

## Overview

This feature adds a **📊 Stats** button to your PhantomSDR interface that displays real-time system information:
- CPU usage, cores, frequency, temperature, and top processes
- Memory usage (used/total/percentage)

Stats automatically update every 5 seconds while the modal is open.

> **Not the same as the admin panel's Graphs page.** This modal is a live snapshot that refreshes while it is open and keeps no history. The admin panel has a separate **Graphs** page that samples CPU frequency, load, temperature and users online every 2 seconds and plots them over the last 15 minutes to 24 hours — see the [Admin Panel guide](../ADMIN_PANEL_SETUP.md).

---

## Prerequisites

- **Linux server** (Ubuntu/Debian recommended)
- **Internet connection** (for downloading Node.js and packages)
- **Sudo access** (for systemd service setup)
- **PhantomSDR-Plus** already installed and running
- **lm-sensors** (recommended for Intel/AMD CPU temperature - automatically installed by script)

---

## Installation Methods

> [!NOTE]
> **The main installer already offers this.** `./install.sh` — and the four distro installers — run `install-stats-server.sh` by default as part of the normal PhantomSDR-Plus installation, so on a fresh machine the stats server is usually already in place. Use this page to install it separately, or to change its port, address or service afterwards.

### Option 1: Automated Installation (Recommended) ⭐

The automated script handles everything for you.

#### Step 1: Run the script

```bash
cd ~/PhantomSDR-Plus
chmod +x install-stats-server.sh   # only if it is not already executable
./install-stats-server.sh
```

**IMPORTANT:** Do NOT run as root or with sudo. Run as your regular user.

#### Step 2: Follow the interactive prompts

The script will guide you through:

##### 1. **Node.js Installation** (if needed)
```
⚠ Node.js / npm is not installed
Would you like to install Node.js 22 via nvm now? (y/n): y
```
The script installs Node.js 22 through nvm, on any Linux distribution — no root and no apt source needed. It asks the same question when Node.js is present but older than 22.

##### 2. **Installation Directory**
```
Installation directory [/home/user/sdr-stats-server]: 
```
Press Enter for default, or specify a custom path.

##### 3. **Port Configuration** (Enhanced!)
```
Port Configuration:
  Default port: 3001
  Common alternatives: 8080, 5000, 8888
Enter port number [3001]: 
```

The script validates your port:
- ✅ Checks if it's a valid number
- ✅ Warns if port < 1024 (requires root privileges)
- ✅ Validates range (1-65535)
- ✅ Checks if port is already in use
- ✅ Shows which process is using it if occupied
- ✅ Allows you to choose a different port

**Example scenarios:**

**Using default port:**
```
Enter port number [3001]: ↵
✓ Port 3001 selected
```

**Choosing custom port:**
```
Enter port number [3001]: 8080
✓ Port 8080 selected
```

**Port already in use:**
```
Enter port number [3001]: 3001
⚠ Port 3001 is currently in use
Process using port 3001:
node    12345 user   20u  IPv6 123456  TCP *:3001 (LISTEN)
Choose a different port? (y/n): y
Enter port number [3001]: 3002
✓ Port 3002 selected
```

**Invalid port:**
```
Enter port number [3001]: abc
✗ Port must be a number
Enter port number [3001]: 99999
✗ Port must be between 1 and 65535
Enter port number [3001]: 3001
✓ Port 3001 selected
```

##### 4. **Server Address**
```
What is your server's public address?
Examples: Your_site_IP, 192.168.1.100, localhost
Server address: Your_site_IP
```
Enter your server's public domain or IP address.

##### 5. **Confirmation**
```
Please confirm your settings:
  Installation directory: /home/user/sdr-stats-server
  Port: 3001
  Server address: Your_site_IP
  Stats URL will be: http://Your_site_IP:3001
Continue with these settings? (y/n): y
```

##### 6. **Systemd Service Setup** (Optional)
```
Would you like to set up the server as a system service (auto-start on boot)? (y/n): y
```

Recommended: Choose **y** to have the server start automatically on boot.

#### Step 3: Installation Complete! ✓

The script will display a summary:
```
╔════════════════════════════════════════════════╗
║          Installation Complete! ✓              ║
║          Open the port in the router!          ║
╚════════════════════════════════════════════════╝

Configuration Summary:
  Installation: /home/user/sdr-stats-server
  Port: 3001
  Server: Your_site_IP
  API URL: http://Your_site_IP:3001/api/system-stats
```

---

## Configure Your PhantomSDR Application

After the script completes, you need to update your Svelte application.

### Step 1: Update `site_information.json`

Since `site_information.json` was already edited during the initial setup, you only need to add the new `siteStats` line with your port:

```json
{
	"siteSysop": "your name or callsign",
	"siteSysopEmailAddress": "mail@mail.net",
	"siteGridSquare": "QTH locator",
	"siteCity": "City Country",
	"siteInformation": "https://github.com/sv1btl/PhantomSDR-Plus",
	"siteHardware": "Hardware you are using, ",
	"siteSoftware": "Software you are using",
	"siteReceiver": "Receiver model",
	"siteAntenna": "Receiving Antenna.",
	"siteNote": "This is a bright new open-source WebSDR project, under active development.",
	"siteIP": "http://Your_site_IP:port",
  "siteStats": "http://Your_site_IP:3001",  ← ADD THIS LINE (use your port)
  "siteSDRBaseFrequency": 0,
  "siteSDRBandwidth": 30000000,
  "siteRegion": 1,
  "siteChatEnabled": true
}
```

**Note:** Use the port you selected during installation!

### Step 2: Update `App.svelte` (the latest GitHub version already includes the updated file)

Make these **4 changes** to your App.svelte file:

#### Change 1: Ensure that `siteStats` is declared (around line 50)

```javascript
import {
  siteSysop,
  siteSysopEmailAddress,
  siteInformation,
  siteGridSquare,
  siteCity,
  siteHardware,
  siteSoftware,
  siteReceiver,
  siteAntenna,
  siteNote,
  siteIP,
  siteStats,  // ← ADD THIS LINE
  siteSDRBaseFrequency,
  siteSDRBandwidth,
  siteRegion,
  siteChatEnabled,
} from "../site_information.json";
```

#### Change 2: Update systemStats object (around line 530)

```javascript
let systemStats = {
  cpu: { usage: 0, cores: 0, temperature: null, frequency: null, topProcesses: [] },  // ← ADD topProcesses: []
  memory: { used: 0, total: 0, percent: 0 }
};
```

#### Change 3: Update fetch URL (around line 541)

```javascript
async function fetchSystemStats() {
  try {
    const response = await fetch(`${siteStats}/api/system-stats`);  // ← CHANGE THIS LINE
    if (response.ok) {
      systemStats = await response.json();
    } else {
      console.error('Failed to fetch system stats:', response.statusText);
    }
  } catch (error) {
    console.error('Error fetching system stats:', error);
  }
}
```

#### Change 4: Add top processes display (in CPU section, around line 3838)

Add this code after the temperature section:

```svelte
{#if systemStats.cpu.frequency}
<div style="display: flex; justify-content: space-between; margin-bottom: 0.25rem;">
  <span>Frequency:</span>
  <span style="color: #4ade80;">{systemStats.cpu.frequency.current} GHz{#if systemStats.cpu.frequency.max} <span style="opacity: 0.7;">(max {systemStats.cpu.frequency.max})</span>{/if}</span>
</div>
{/if}

{#if systemStats.cpu.temperature !== null}
<div style="display: flex; justify-content: space-between; margin-bottom: 0.25rem;">
  <span>Temperature:</span>
  <span style="color: {systemStats.cpu.temperature > 70 ? '#fbbf24' : '#4ade80'};">{systemStats.cpu.temperature}°C</span>
</div>
{/if}

<!-- ADD THIS ENTIRE SECTION: -->
{#if systemStats.cpu.topProcesses && systemStats.cpu.topProcesses.length > 0}
<div style="margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px solid rgba(255,255,255,0.1);">
  <h4 style="margin: 0 0 0.5rem 0; font-size: 0.85rem; color: rgba(0, 225, 255, 0.8);">Top Processes:</h4>
  {#each systemStats.cpu.topProcesses as process}
  <div style="display: flex; justify-content: space-between; margin-bottom: 0.25rem; font-size: 0.85rem;">
    <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 70%;">{process.name}</span>
    <span style="color: {process.cpu > 50 ? '#ef4444' : process.cpu > 25 ? '#fbbf24' : '#4ade80'};">{process.cpu}%</span>
  </div>
  {/each}
</div>
{/if}
```

### Step 3: Rebuild Your Application

```bash
cd /path/to/your/phantomsdr-app
npm ./recompile.sh
```

---

## Testing the Installation

### Test 1: Check API Endpoint

```bash
curl http://localhost:3001/api/system-stats
```

Expected output (JSON):
```json
{
  "cpu": {
    "usage": 45.2,
    "cores": 8,
    "coresUsed": 1.3,
    "temperature": 62.5,
    "frequency": {
      "current": 3.0,
      "max": 3.9,
      "limit": 4.4
    },
    "topProcesses": [
      {"name": "node", "cpu": 12.5},
      {"name": "phantomsdr", "cpu": 8.3}
    ]
  },
  "memory": {
    "used": 8.5,
    "total": 16,
    "percent": 53
  }
}
```

### Test 2: Check Service Status

If you installed as a service:

```bash
sudo systemctl status sdr-stats.service
```

Should show: `Active: active (running)`

### Test 3: Test in Browser

1. Open your PhantomSDR web interface
2. Scroll to **Additional Info** section
3. Click **Open Additional Info** button
4. Look for the **📊 Stats** button next to PC info
5. Click it to open the stats modal
6. Verify stats are displaying and updating

---

## Service Management

If you installed as a systemd service, use these commands:

```bash
# Start the service
sudo systemctl start sdr-stats.service

# Stop the service
sudo systemctl stop sdr-stats.service

# Restart the service (after updating files)
sudo systemctl restart sdr-stats.service

# Check status
sudo systemctl status sdr-stats.service

# View real-time logs
sudo journalctl -u sdr-stats.service -f

# View last 50 log entries
sudo journalctl -u sdr-stats.service -n 50

# Enable auto-start on boot
sudo systemctl enable sdr-stats.service

# Disable auto-start
sudo systemctl disable sdr-stats.service

# Edit service
sudo nano /etc/systemd/system/sdr-stats.service

# Delete service
sudo rm /etc/systemd/system/sdr-stats.service
```

---

## Manual Installation (Option 2)

> [!IMPORTANT]
> **You do not need this section for a normal installation.** `install-stats-server.sh` does all of it for you and is run by the main installer by default. Follow it only for a manual setup or to repair one piece by hand.

**⚠️ Warning:** Manual installation may use outdated files. The **automated script is strongly recommended** as it:
- Installs the latest version with improved temperature detection
- Auto-installs and configures lm-sensors
- Handles all dependencies automatically

If you still prefer manual installation:

### 1. Install Node.js
```bash
# Any distribution - nvm needs no root and no apt source.
# NOT NodeSource: deb.nodesource.com now answers HTTP 403 on every path.
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.4/install.sh | bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm install 22 && nvm use 22 && nvm alias default 22
```

### 2. Install lm-sensors (Required for Intel/AMD temperature)
```bash
sudo apt-get update
sudo apt-get install -y lm-sensors
sudo sensors-detect --auto
```

### 3. Create Directory
```bash
mkdir ~/sdr-stats-server
cd ~/sdr-stats-server
```

### 4. Download Latest Files

**Important:** the server files are no longer kept as copies in the repository - the installer generates them.

Instead, run the automated script once to generate the latest files, then copy them:
```bash
# Run the automated script from the repository root
cd ~/PhantomSDR-Plus
./install-stats-server.sh
# When prompted, use a temporary port like 9999
# After installation completes, copy the generated files
cp ~/sdr-stats-server/system-stats-server.js ~/your-manual-install-dir/
cp ~/sdr-stats-server/package.json ~/your-manual-install-dir/
```

**OR** manually create the files using the latest code from the installation script.

### 5. Edit Port (if needed)
```bash
nano ~/sdr-stats-server/system-stats-server.js
```

Change line 6:
```javascript
const PORT = process.env.PORT || 3001;  // Change this number
```

### 6. Install Dependencies
```bash
npm install
```

### 7. Test Run
```bash
npm start
```

### 8. Set Up Service (Optional)

Follow the systemd service setup from the automated installation section.

## Changing the Port After Installation

If you need to change the port after installation:

### Step 1: Edit the server file

```bash
nano ~/sdr-stats-server/system-stats-server.js
```

Change line 6:
```javascript
const PORT = process.env.PORT || 3001;  // Change this number
```

### Step 2: Update site_information.json

```json
"siteStats": "http://Your_site_IP:NEW_PORT"
```

### Step 3: Restart the service

```bash
sudo systemctl restart sdr-stats.service
```

### Step 4: Rebuild your Svelte app

```bash
cd /path/to/phantomsdr-app
npm run build
```

---

## Troubleshooting

### Issue: Port already in use

**Error:**
```
Error: listen EADDRINUSE: address already in use :::3001
```

**Solution:**

1. Find what's using the port:
```bash
sudo lsof -i :3001
```

2. Stop that process:
```bash
kill <PID>
# or
sudo systemctl stop sdr-stats.service
```

3. Start the service again:
```bash
sudo systemctl start sdr-stats.service
```

**Alternative:** Run the installation script again and choose a different port when prompted.

### Issue: Service won't start

**Error:**
```
status=217/USER
```

**Solution:**

1. Check the service file:
```bash
cat /etc/systemd/system/sdr-stats.service
```

2. Verify the `User=` line matches your username:
```bash
whoami
```

3. Edit if needed:
```bash
sudo nano /etc/systemd/system/sdr-stats.service
```

4. Reload and restart:
```bash
sudo systemctl daemon-reload
sudo systemctl restart sdr-stats.service
```

### Issue: Stats not showing in browser

**Symptoms:** Modal opens but no data, or shows 0 values

**Solutions:**

1. Check browser console (F12) for errors
2. Verify API is accessible:
```bash
curl http://localhost:3001/api/system-stats
```
3. Check service is running:
```bash
sudo systemctl status sdr-stats.service
```
4. Verify `siteStats` in `site_information.json` matches your server address and port
5. Check CORS errors - ensure server allows your domain

### Issue: Temperature shows null

**Cause:** Temperature reading not available on your system

**Solutions:**

1. **For most Linux systems:** Check if thermal zone exists:
```bash
cat /sys/class/thermal/thermal_zone0/temp
```

2. **Install lm-sensors:**
```bash
sudo apt-get install lm-sensors
sudo sensors-detect
sensors
```

3. **Note:** Temperature may not be available on:
- Virtual machines
- Some VPS providers
- Windows Subsystem for Linux (WSL)
- Non-Linux systems

This is normal - the rest of the stats will still work!

### Issue: Stats values don't match `top`

**Cause:** CPU sampling period was too short in older versions

**Solution:** The current version uses 1-second sampling for accurate readings. If you have an old installation:

1. Update the server file:
```bash
nano ~/sdr-stats-server/system-stats-server.js
```

2. Find line 18 and change:
```javascript
}, 100);  // Old value
```
to:
```javascript
}, 1000);  // New value (1 second)
```

3. Restart:
```bash
sudo systemctl restart sdr-stats.service
```

Or simply re-run the installation script to get the latest version.

### Issue: Node.js not found

**Error:**
```
node: command not found
```

**Solution:**

1. Install Node.js:
```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.4/install.sh | bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm install 22 && nvm use 22 && nvm alias default 22
```

2. Verify:
```bash
node --version
npm --version
```

---

## What You'll See

Once installed and configured, the stats modal displays:

### 🖥️ CPU Section
- **Usage**: Overall CPU utilization percentage
- **Cores**: How much of the CPU is actually in use, expressed as whole cores — e.g. `1.3 / 12 in use` means the machine is doing 1.3 cores' worth of work. This is exact and needs no threshold. It is deliberately not a count of busy cores: the scheduler spreads one core's work across many, so any such count would only ever approximate this figure.
- **Frequency**: Average current CPU clock across all cores in GHz, with the fastest core in parentheses (if available)
- **Temperature**: CPU temperature in Celsius (if available), colour-coded: 🟢 green up to 69 °C, 🟠 orange 70-79 °C, 🔴 red at 80 °C and above
- **Top Processes**: Top 5 CPU-consuming processes with color-coded percentages:
  - 🟢 Green: up to 50% CPU
  - 🟠 Orange: 51-80% CPU
  - 🔴 Red: above 80% CPU

### 💾 Memory Section
- **Used**: Memory in use (GB)
- **Total**: Total system memory (GB)
- **Usage**: Memory usage percentage (color-coded)

### ♻️ Auto-Update
- Stats refresh every **5 seconds** while modal is open
- Stops updating when you close the modal (saves resources)

---


## Temperature Detection

The stats server uses advanced multi-method temperature detection:

### ✅ **Supported Systems:**
- **Intel Processors**: Reads from coretemp sensors via lm-sensors
- **AMD Processors**: Reads from k10temp sensors (Tdie/Tctl)
- **ARM Processors**: Reads from thermal zones (Raspberry Pi, etc.)

### 📋 **Requirements:**
- **Intel/AMD**: Requires `lm-sensors` package (auto-installed by script)
- **ARM/Raspberry Pi**: Works out of the box, no additional packages needed

### 🔧 **Installation Priority:**
1. Tries `sensors` command for Package/Core temperature (Intel/AMD)
2. Falls back to direct coretemp reading (Intel)
3. Falls back to thermal_zone0 (ARM/Raspberry Pi)

If temperature shows `null`, install lm-sensors:
```bash
sudo apt-get install lm-sensors
sudo sensors-detect --auto
sudo systemctl restart sdr-stats.service
```

---

## Features Summary

✅ **Real-time Monitoring** - Live system stats from your server
✅ **CPU Metrics** - Usage, cores, temperature, top processes
✅ **Memory Tracking** - Used, total, and percentage
✅ **Auto-Updates** - Refreshes every 5 seconds
✅ **Color-Coded** - Visual indicators for warnings
✅ **Lightweight** - Minimal resource usage
✅ **Easy Installation** - Automated script handles everything
✅ **Port Validation** - Smart port selection with conflict detection
✅ **Service Management** - Auto-start on boot

---

## Security Notes

- The stats server accepts connections from any origin (CORS: *)
- For production, consider restricting CORS to your domain only
- Port selection validates input and checks for conflicts
- CPU temperature reading is read-only and safe
- No sensitive system information is exposed

---

## Support & Resources

### Files Included:
In this folder (the installer itself lives in the repository root, as `PhantomSDR-Plus/install-stats-server.sh` - there is only ever one copy):
- `package.json` - Dependencies, identical to what the installer writes
- This document, also available in de, el, es, fr, hr and ru

Created by the installer in `~/sdr-stats-server/`:
- `system-stats-server.js` - Backend server, generated with the port you chose
- `package.json` - Dependencies
- `node_modules/` - Installed by `npm install`

### Getting Help:
- Check the troubleshooting section above
- Review service logs: `sudo journalctl -u sdr-stats.service -n 50`
- Test API manually: `curl http://localhost:3001/api/system-stats`
- Verify configuration files

### Unistall stats-server:
- Delete the folder /sdr-stats-server
- If you've created a service, just delete it using:
```bash
sudo rm /etc/systemd/system/sdr-stats.service"`
```
- Modify `App.svelte`: Find the part of the code:
```
                   <!-- In case you don't want the Stats Button to appear, please comment this button section (12 lines)-->                     
                    <!-- System Stats Button -->
                    <button
                      type="button"
                      class="glass-button text-white py-1 px-2 ml-2 rounded text-xs"
                      on:click={openSystemStats}
                      title="System Resources"
                      aria-haspopup="dialog"
                      aria-expanded={showSystemStats}
                      aria-controls="system-stats-dialog"
                      style="color:rgba(0, 225, 255, 0.993); font-size: 0.75rem;"
                    >
                      📊 Stats
                    </button>
  ```
  and replace with:
```
                   <!-- In case you don't want the Stats Button to appear, please comment this button section (12 lines)-->                     
                    <!-- System Stats Button -->
                    <!--
                    <button
                      type="button"
                      class="glass-button text-white py-1 px-2 ml-2 rounded text-xs"
                      on:click={openSystemStats}
                      title="System Resources"
                      aria-haspopup="dialog"
                      aria-expanded={showSystemStats}
                      aria-controls="system-stats-dialog"
                      style="color:rgba(0, 225, 255, 0.993); font-size: 0.75rem;"
                    >
                      📊 Stats
                    </button>
                    -->
  ```                    
- Recompile using the command:
```bash
  cd PhantomSDR-Plus
 ./recompile.sh
 ```
- Restart the PC and start the server

---

**Author:** Created for PhantomSDR-Plus
**Version:** 1.1 (Improved CPU temperature detection for Intel/AMD) **Updated:** January 2026
**License:** MIT

---

## Quick Command Reference

```bash
# Installation
cd ~/PhantomSDR-Plus
chmod +x install-stats-server.sh
./install-stats-server.sh

# Service Management
sudo systemctl start sdr-stats.service      # Start
sudo systemctl stop sdr-stats.service       # Stop
sudo systemctl restart sdr-stats.service    # Restart
sudo systemctl status sdr-stats.service     # Status
sudo journalctl -u sdr-stats.service -f     # Logs

# Testing
curl http://localhost:3001/api/system-stats # Test API
curl http://localhost:3001/api/health       # Health check

# Troubleshooting
sudo lsof -i :3001                          # Check port
whoami                                      # Check username
node --version                              # Check Node.js
```

Happy monitoring! 📊🚀
