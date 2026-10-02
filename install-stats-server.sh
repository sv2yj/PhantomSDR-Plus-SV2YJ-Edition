#!/bin/bash

#####################################################
# SDR System Stats Server - Automated Installer
# For PhantomSDR-Plus
# Author: SV1BTL
# Version: 1.1
#####################################################

# Colors for output

# Running as root: sudo is unnecessary, and minimal images (containers, some
# VPS base images) do not ship it at all — every "sudo apt-get" below then dies
# with "sudo: command not found" halfway through the install. Make it a
# transparent no-op in that one case. A non-root user without sudo still gets
# the original error, which is the right thing to tell them.
if [ "$(id -u)" -eq 0 ] && ! command -v sudo >/dev/null 2>&1; then
    sudo() { "$@"; }
fi

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;36m'
NC='\033[0m' # No Color

# Default values
DEFAULT_PORT=3001
DEFAULT_INSTALL_DIR="$HOME/sdr-stats-server"

# ── Prompt helpers ────────────────────────────────────────────────────────────
# Every question below used to be a bare `read`, which meant a run whose stdin
# is not a terminal either hung or died. EOF returned an empty answer, and an
# empty answer was often invalid, so the port loop asked again forever — the
# same bug setup_admin.sh had. These helpers give each question a default,
# take that default the moment stdin is exhausted, and never loop.
ASK_TRIES=5

# ask_yn <prompt> <default: y|n> <varname>
#
# The default is never shown in lower case. Whatever the caller wrote at the end
# of its prompt — "(y/n)", "[Y/n]", a trailing colon — is stripped off and
# replaced by one house style: the default letter capitalised and coloured
# inside the brackets, and the same answer spelled out in full after them, so
# that pressing ENTER on its own is unambiguous.
ask_yn() {
    local prompt="$1" default="$2" varname="$3" ans hint word

    prompt="${prompt%"${prompt##*[![:space:]]}"}"          # trailing whitespace
    prompt="${prompt%:}"                                    # trailing colon
    # A bracketed y/n hint at the very end, in either bracket style. Kept in a
    # variable: written inline, the brackets would have to be escaped, and an
    # escaped bracket inside a bracket expression matches a backslash, not a
    # bracket — the regex then silently never fires.
    local yn_re='[[:space:]]*[([](y/n|yes/no)[])]$'
    shopt -s nocasematch
    while [[ "$prompt" =~ $yn_re ]]; do
        prompt="${prompt%"${BASH_REMATCH[0]}"}"
        prompt="${prompt%:}"
    done
    shopt -u nocasematch

    if [ "$default" = "y" ]; then
        hint="\033[1;32mY\033[0m/n"; word="Yes"
    else
        hint="y/\033[1;31mN\033[0m"; word="No"
    fi

    printf '%s [%b]  \033[90m(ENTER = %s)\033[0m: ' "$prompt" "$hint" "$word"
    if ! read -r ans; then
        echo ""
        echo "  (no input — using the default: $word)"
        ans=""
    fi
    ans="${ans:-$default}"
    case "$ans" in
        [Yy]*) eval "$varname=y" ;;
        *)     eval "$varname=n" ;;
    esac
}

# ask_text <prompt> <default> <varname>
ask_text() {
    local prompt="$1" default="$2" varname="$3" ans
    if ! read -rp "$prompt [$default]: " ans; then
        echo ""
        echo "  (no input — using the default: $default)"
        ans=""
    fi
    eval "$varname=\"\${ans:-$default}\""
}

# Running as root
#
# This script used to refuse root outright. That was wrong in both directions:
# it contradicted the sudo shim above, and it made "sudo ./install.sh" fail at
# step 15 every single time — install.sh itself supports root (it sets SUDO=""
# when it is already uid 0), so the parent installer ran happily as root and
# then handed over to a child that would not. On a root-only box (a VPS image,
# a container) there was no way past it at all.
#
# Everything below assumes one consistent identity: $HOME for the install
# directory and the nvm tree, and that same user in the systemd unit. So there
# are exactly two sane answers, not one.
#
#   sudo ./install-stats-server.sh  — SUDO_USER names a real invoking user.
#       Drop back to them and re-exec. Every assumption downstream then holds
#       unchanged, and the stats server does not end up running as root for no
#       reason. sudo is obviously available: we got here through it.
#
#   a genuine root session (root login, container, cloud image with no
#   unprivileged user) — SUDO_USER is unset or is root itself. Proceed as root.
#       $HOME is /root, nvm goes to /root/.nvm and the unit says User=root:
#       inconsistent with nothing, and it is the only identity that exists.
#
# PHANTOM_STATS_REEXEC guards the hand-back so a sudo that somehow lands us
# back at uid 0 cannot loop.
if [ "$(id -u)" -eq 0 ] && [ "${PHANTOM_STATS_REEXEC:-0}" != "1" ] \
   && [ -n "${SUDO_USER:-}" ] && [ "$SUDO_USER" != "root" ]; then
    echo -e "${BLUE}ℹ Running under sudo — continuing as $SUDO_USER, not root.${NC}"
    echo "  The stats server is a user service: it needs no privileges of its"
    echo "  own, and installing it as root would put it in /root and run it"
    echo "  as root. Only the few steps that truly need it re-acquire sudo."
    echo ""
    # sudo scrubs the environment, so carry the installer's own answers across
    # by hand — without them the re-exec would stop and ask questions that the
    # parent install.sh already answered.
    reexec_env=()
    while IFS= read -r kv; do
        reexec_env+=("$kv")
    done < <(env | grep -E '^(PHANTOM_|DEBIAN_FRONTEND=|TZ=|NO_COLOR=)' || true)
    reexec_env+=("PHANTOM_STATS_REEXEC=1")
    exec sudo -u "$SUDO_USER" -H env "${reexec_env[@]}" \
         bash "$0" "$@"
fi

if [ "$(id -u)" -eq 0 ]; then
    echo -e "${YELLOW}⚠ Running as root — the stats server will be installed under${NC}"
    echo "  $HOME and its systemd unit will run as root. That is expected on a"
    echo "  root-only machine. On a normal desktop, prefer running this script"
    echo "  as your own user."
    echo ""
fi

# The identity the service will run as. $USER is not reliable here: sudo, su
# and most container images leave it unset or pointing at the wrong account,
# and an empty "User=" makes systemd reject the unit outright. id -un is the
# user that is actually running this script, which after the block above is
# always the user we want in the unit.
SVC_USER="$(id -un)"

echo -e "${BLUE}╔════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   SDR System Stats Server - Installation       ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════╝${NC}"
echo ""

# Function to print colored messages
print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

echo -e "${BLUE}Step 1:${NC} Checking prerequisites..."
echo ""

# Node.js / npm via nvm
#
# Installed via nvm rather than deb/rpm.nodesource.com: that host now answers
# 403 on every repo path, so the old setup_18.x bootstrap can no longer work.
# nvm is also OS-agnostic, so no distro branching and no sudo is needed.
NVM_VERSION="v0.40.4"
NODE_NEED=22

install_node_via_nvm() {
    if [ ! -s "$HOME/.nvm/nvm.sh" ]; then
        curl -o- "https://raw.githubusercontent.com/nvm-sh/nvm/${NVM_VERSION}/install.sh" | bash \
            || { print_error "nvm installation script failed"; exit 1; }
    fi
    export NVM_DIR="$HOME/.nvm"
    # shellcheck source=/dev/null
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

    nvm install "$NODE_NEED"
    nvm use "$NODE_NEED"
    nvm alias default "$NODE_NEED"
}

# Load an existing nvm BEFORE probing, so node stays visible in a non-login
# shell. Without this, a machine where nvm already provides Node 22 looks
# node-less and gets offered a pointless reinstall.
export NVM_DIR="$HOME/.nvm"
# shellcheck source=/dev/null
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

NODE_OK=false
if command -v node &> /dev/null && command -v npm &> /dev/null; then
    NODE_MAJOR=$(node --version | cut -d'.' -f1 | tr -d 'v')
    if [ "$NODE_MAJOR" -ge "$NODE_NEED" ]; then
        print_success "Node.js $(node --version) and npm $(npm --version) — OK"
        NODE_OK=true
    else
        print_warning "Node.js $(node --version) is too old (need ${NODE_NEED}+)"
    fi
else
    print_warning "Node.js / npm is not installed"
fi

if [ "$NODE_OK" = false ]; then
    echo ""
    ask_yn "Would you like to install Node.js ${NODE_NEED} via nvm now? (y/n)" y install_node

    if [ "$install_node" = "y" ] || [ "$install_node" = "Y" ]; then
        print_info "Installing Node.js ${NODE_NEED}..."
        install_node_via_nvm
    else
        print_error "Node.js ${NODE_NEED}+ is required. Please install it manually and run this script again."
        exit 1
    fi

    command -v node &> /dev/null && command -v npm &> /dev/null \
        || { print_error "Failed to install Node.js / npm"; exit 1; }
    print_success "Node.js $(node --version) and npm $(npm --version) installed"
fi

# Check if lm-sensors is installed (needed for accurate CPU temperature)
echo ""
if ! command -v sensors &> /dev/null; then
    print_warning "lm-sensors is not installed"
    echo "lm-sensors is recommended for accurate CPU temperature readings on Intel/AMD systems"
    ask_yn "Would you like to install lm-sensors now? (y/n)" y install_sensors
    
    if [ "$install_sensors" = "y" ] || [ "$install_sensors" = "Y" ]; then
        print_info "Installing lm-sensors..."
        
        if [ -f /etc/debian_version ]; then
            # Debian/Ubuntu
            sudo apt-get update
            sudo apt-get install -y lm-sensors
        elif [ -f /etc/redhat-release ]; then
            # RedHat/CentOS
            sudo yum install -y lm_sensors
        else
            print_warning "Could not auto-install lm-sensors on this OS"
            echo "Please install it manually: sudo apt-get install lm-sensors"
        fi
        
        if command -v sensors &> /dev/null; then
            print_success "lm-sensors installed successfully"
            
            # Run sensors-detect
            print_info "Running sensors-detect to configure sensors..."
            echo "Press ENTER for all prompts to accept defaults"
            sleep 2
            sudo sensors-detect --auto
            print_success "Sensors configured"
        else
            print_warning "lm-sensors installation may have failed"
        fi
    else
        print_warning "Skipping lm-sensors installation"
        echo "Temperature readings may not be accurate on Intel/AMD systems"
    fi
else
    print_success "lm-sensors is installed"
fi

echo ""
echo -e "${BLUE}Step 2:${NC} Configuration"
echo ""

# Ask for installation directory
echo -e "Please include the full path!"
ask_text "Installation directory" "$DEFAULT_INSTALL_DIR" INSTALL_DIR

# Ask for port with validation. port_tries bounds the retries: a caller feeding
# answers that are never valid (or a pipe of "y") would otherwise spin here for
# as long as the disk lasts.
port_tries=0
while true; do
    echo ""
    echo -e "${YELLOW}Port Configuration:${NC}"
    echo "  Default port: $DEFAULT_PORT"
    echo "  Common alternatives: 8080, 5000, 8888"
    ask_text "Enter port number" "$DEFAULT_PORT" PORT

    # Validate port number
    if ! [[ "$PORT" =~ ^[0-9]+$ ]] || [ "$PORT" -lt 1 ] || [ "$PORT" -gt 65535 ]; then
        print_error "Port must be a number between 1 and 65535"
        port_tries=$((port_tries + 1))
        if [ "$port_tries" -ge "$ASK_TRIES" ]; then
            PORT=$DEFAULT_PORT
            print_warning "$port_tries invalid answers — using the default port $PORT"
            break
        fi
        continue
    fi

    if [ "$PORT" -lt 1024 ]; then
        print_warning "Ports below 1024 require root privileges"
        ask_yn "Continue with port $PORT? (y/n)" n confirm_port
        if [ "$confirm_port" != "y" ]; then
            port_tries=$((port_tries + 1))
            if [ "$port_tries" -ge "$ASK_TRIES" ]; then
                PORT=$DEFAULT_PORT
                print_warning "using the default port $PORT"
                break
            fi
            continue
        fi
    fi

    # Check if port is already in use
    if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null 2>&1 ; then
        print_warning "Port $PORT is currently in use"
        echo "Process using port $PORT:"
        sudo lsof -i :$PORT | grep LISTEN
        ask_yn "Choose a different port? (y/n)" n change_port
        if [ "$change_port" = "y" ]; then
            port_tries=$((port_tries + 1))
            if [ "$port_tries" -ge "$ASK_TRIES" ]; then
                print_warning "keeping port $PORT"
                break
            fi
            continue
        fi
    fi

    print_success "Port $PORT selected"
    break
done

# Ask for server URL/IP
echo ""
print_info "What is your server's public address?"
echo "Examples: mydomain.no-ip.org, 192.168.1.100, localhost"
# Default to this machine's first LAN address, then its hostname, then
# localhost — so an unattended run has something usable rather than aborting.
DEFAULT_SERVER_ADDRESS="$(hostname -I 2>/dev/null | awk '{print $1}')"
[ -n "$DEFAULT_SERVER_ADDRESS" ] || DEFAULT_SERVER_ADDRESS="$(hostname -f 2>/dev/null)"
[ -n "$DEFAULT_SERVER_ADDRESS" ] || DEFAULT_SERVER_ADDRESS="localhost"
ask_text "Server address" "$DEFAULT_SERVER_ADDRESS" SERVER_ADDRESS

if [ -z "$SERVER_ADDRESS" ]; then
    print_error "Server address is required"
    exit 1
fi

# Confirm settings
echo ""
echo -e "${YELLOW}Please confirm your settings:${NC}"
echo "  Installation directory: $INSTALL_DIR"
echo "  Port: $PORT"
echo "  Server address: $SERVER_ADDRESS"
echo "  Stats URL will be: http://$SERVER_ADDRESS:$PORT"
echo ""
ask_yn "Continue with these settings? (y/n)" y confirm

if [ "$confirm" != "y" ]; then
    print_info "Installation cancelled"
    exit 0
fi

echo ""
echo -e "${BLUE}Step 3:${NC} Creating installation directory..."
echo ""

# Create installation directory
if [ -d "$INSTALL_DIR" ]; then
    print_warning "Directory $INSTALL_DIR already exists"
    # Default n on purpose: this branch runs rm -rf on the directory, and no
    # unattended run should delete a tree because nobody was there to say no.
    ask_yn "Do you want to overwrite it? (y/n)" n overwrite
    if [ "$overwrite" = "y" ]; then
        rm -rf "$INSTALL_DIR"
        mkdir -p "$INSTALL_DIR"
        print_success "Directory recreated"
    else
        print_error "Installation cancelled"
        exit 1
    fi
else
    mkdir -p "$INSTALL_DIR"
    print_success "Directory created: $INSTALL_DIR"
fi

cd "$INSTALL_DIR" || exit 1

echo ""
echo -e "${BLUE}Step 4:${NC} Creating server files..."
echo ""

# Create package.json
cat > package.json <<EOF
{
  "name": "sdr-system-stats-server",
  "version": "1.1.0",
  "description": "System stats API server for SDR monitoring",
  "main": "system-stats-server.js",
  "scripts": {
    "start": "node system-stats-server.js"
  },
  "keywords": ["system", "stats", "monitoring", "sdr"],
  "author": "",
  "license": "MIT",
  "dependencies": {
    "express": "^4.18.2"
  }
}
EOF
print_success "Created package.json"

# Create system-stats-server.js with the selected port
cat > system-stats-server.js <<EOF
const express = require('express');
const os = require('os');
const { exec } = require('child_process');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || $PORT;

// Enable CORS so your Svelte app can access this API
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

// Helper function to get CPU usage
function getCPUUsage() {
  return new Promise((resolve) => {
    const start = cpuSnapshot();

    setTimeout(() => {
      const end = cpuSnapshot();
      const perCore = end.map((c, i) => {
        const idleDelta  = c.idle  - start[i].idle;
        const totalDelta = c.total - start[i].total;
        // A core with no ticks at all in the window (offline, or the counters
        // did not move) is reported as idle rather than as a division by zero.
        return totalDelta > 0 ? 100 - (100 * idleDelta / totalDelta) : 0;
      });

      const totalPct = perCore.reduce((a, b) => a + b, 0);
      const usage = totalPct / (perCore.length || 1);
      // Cores' worth of work: the total utilisation expressed as whole cores,
      // so 12 cores averaging 11% is 1.3 cores in use. An exact figure with no
      // threshold to argue about — the scheduler smears one core's work across
      // many, so counting "busy" cores can only ever be an approximation of
      // this number.
      const used = Math.round(totalPct / 10) / 10;

      resolve({ usage: Math.round(usage), used, perCore });
    }, 1000); // 1 second sampling for accurate readings
  });
}

// Per-core cumulative tick counters, for deltas across the sample window.
function cpuSnapshot() {
  return os.cpus().map(cpu => {
    let total = 0;
    for (const type in cpu.times) total += cpu.times[type];
    return { idle: cpu.times.idle, total };
  });
}

// Helper function to get CPU temperature (Intel/AMD/ARM compatible)
function getCPUTemperature() {
  return new Promise((resolve) => {
    // Method 1: Try sensors command looking for Package id (Intel) or Tdie/Tctl (AMD)
    exec("sensors 2>/dev/null", (err1, stdout1) => {
      if (!err1 && stdout1) {
        // Try to find Intel Package temperature
        const packageMatch = stdout1.match(/Package id 0:\s+\+([0-9.]+)°C/);
        if (packageMatch) {
          const temp = parseFloat(packageMatch[1]);
          resolve(Math.round(temp * 10) / 10);
          return;
        }
        
        // Try to find AMD Tdie temperature
        const tdieMatch = stdout1.match(/Tdie:\s+\+([0-9.]+)°C/);
        if (tdieMatch) {
          const temp = parseFloat(tdieMatch[1]);
          resolve(Math.round(temp * 10) / 10);
          return;
        }
        
        // Try to find AMD Tctl temperature
        const tctlMatch = stdout1.match(/Tctl:\s+\+([0-9.]+)°C/);
        if (tctlMatch) {
          const temp = parseFloat(tctlMatch[1]);
          resolve(Math.round(temp * 10) / 10);
          return;
        }
        
        // Try to find any Core temperature
        const coreMatch = stdout1.match(/Core 0:\s+\+([0-9.]+)°C/);
        if (coreMatch) {
          const temp = parseFloat(coreMatch[1]);
          resolve(Math.round(temp * 10) / 10);
          return;
        }
      }
      
      // Method 2: Try reading directly from coretemp (Intel)
      exec("cat /sys/devices/platform/coretemp.0/hwmon/hwmon*/temp1_input 2>/dev/null", (err2, stdout2) => {
        if (!err2 && stdout2.trim()) {
          const temp = parseInt(stdout2.trim()) / 1000;
          if (temp > 0 && temp < 150) {
            resolve(Math.round(temp * 10) / 10);
            return;
          }
        }
        
        // Method 3: Try thermal zone (fallback for ARM/Raspberry Pi)
        fs.readFile('/sys/class/thermal/thermal_zone0/temp', 'utf8', (err3, data) => {
          if (!err3 && data.trim()) {
            const temp = parseInt(data) / 1000;
            if (temp > 0 && temp < 150) {
              resolve(Math.round(temp * 10) / 10);
              return;
            }
          }
          
          // No temperature available
          resolve(null);
        });
      });
    });
  });
}

// Helper function to get current CPU frequency (in GHz)
//
// Reads the kernel's cpufreq sysfs tree directly - the same source cpufreq-info
// formats - so cpufrequtils is not a dependency. A machine with no cpufreq
// driver (many VMs and containers) has no such tree at all, and cpufreq-info
// fails there too, so the fallback is /proc/cpuinfo, which the kernel fills in
// from a different path. Returns null when neither is available.
function getCPUFrequency() {
  const toGHz = (kHz) => Math.round(kHz / 1000 / 100) / 10;

  try {
    const cpus = fs.readdirSync('/sys/devices/system/cpu')
      .filter(name => /^cpu[0-9]+\$/.test(name));

    const freqs = [];
    let hwMax = 0;

    for (const cpu of cpus) {
      const dir = '/sys/devices/system/cpu/' + cpu + '/cpufreq/';
      try {
        freqs.push(parseInt(fs.readFileSync(dir + 'scaling_cur_freq', 'utf8').trim(), 10));
      } catch (e) { /* CPU is offline, or has no cpufreq policy of its own */ }
      try {
        const m = parseInt(fs.readFileSync(dir + 'cpuinfo_max_freq', 'utf8').trim(), 10);
        if (m > hwMax) hwMax = m;
      } catch (e) { /* no hardware limit exposed */ }
    }

    const valid = freqs.filter(f => f > 0);
    if (valid.length > 0) {
      const sum = valid.reduce((a, b) => a + b, 0);
      return {
        current: toGHz(sum / valid.length),
        max: toGHz(Math.max.apply(null, valid)),
        limit: hwMax > 0 ? toGHz(hwMax) : null
      };
    }
  } catch (e) { /* no cpufreq sysfs tree on this kernel */ }

  // Fallback: /proc/cpuinfo reports MHz even with no cpufreq driver present
  try {
    const mhz = fs.readFileSync('/proc/cpuinfo', 'utf8')
      .split('\n')
      .filter(line => /^cpu MHz/.test(line))
      .map(line => parseFloat(line.split(':')[1]))
      .filter(v => v > 0);

    if (mhz.length > 0) {
      const sum = mhz.reduce((a, b) => a + b, 0);
      return {
        current: Math.round((sum / mhz.length) / 100) / 10,
        max: Math.round(Math.max.apply(null, mhz) / 100) / 10,
        limit: null
      };
    }
  } catch (e) { /* unreadable, or an arch that omits the MHz line (ARM) */ }

  return null;
}

// Helper function to get top CPU-consuming processes
function getTopProcesses() {
  return new Promise((resolve) => {
    // Ask for more rows than are needed: the pipeline reliably ranks its own
    // members near the top - ps in particular measures itself over its whole
    // (very short) lifetime and so reports absurd figures like 200% - and they
    // are dropped below, leaving fewer than five real ones otherwise.
    exec("ps aux --sort=-%cpu | head -12 | tail -11 | awk '{print \$11, \$3}'", (error, stdout) => {
      if (error) {
        resolve([]);
        return;
      }

      const SELF = ['ps', 'awk', 'head', 'tail', 'sh', 'bash'];

      const lines = stdout.trim().split('\n');
      const processes = lines.map(line => {
        const parts = line.trim().split(/\s+/);
        const cpu = parseFloat(parts[parts.length - 1]);
        const name = parts.slice(0, -1).join(' ').split('/').pop(); // Get process name without path
        return { name, cpu: Math.round(cpu * 10) / 10 };
      }).filter(p => p.cpu > 0)          // Only include processes using CPU
        .filter(p => !SELF.includes(p.name)) // Drop this measurement's own pipeline
        .slice(0, 5);

      resolve(processes);
    });
  });
}

// Helper function to get disk usage
//
// The modal stopped displaying disk usage, but the field stays in the response
// as a compatibility shim. A frontend built before that change still evaluates
// systemStats.disk.used; with no disk key that expression throws during the
// Svelte update, the whole flush aborts, and every other value in the dialog -
// CPU, cores, temperature, memory - is left frozen at its initial 0. Sysops
// upgrade the server on its own, so old bundles are still out there.
function getDiskUsage() {
  return new Promise((resolve) => {
    exec("df -k / | tail -1 | awk '{print \$2,\$3,\$5}'", (error, stdout) => {
      if (error) {
        resolve({ used: 0, total: 0, percent: 0 });
        return;
      }

      const parts = stdout.trim().split(/\s+/);
      const total = Math.round(parseInt(parts[0]) / 1024 / 1024); // KB to GB
      const used = Math.round(parseInt(parts[1]) / 1024 / 1024);
      const percent = parseInt(parts[2]);

      resolve({ used, total, percent });
    });
  });
}

// API endpoint to get system stats
app.get('/api/system-stats', async (req, res) => {
  try {
    // CPU
    const cpu = await getCPUUsage();
    const cpuCores = os.cpus().length;
    const cpuTemp = await getCPUTemperature();
    const cpuFreq = getCPUFrequency();

    // Memory
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const memPercent = Math.round((usedMem / totalMem) * 100);

    // Top processes
    const topProcesses = await getTopProcesses();

    // Disk - not displayed any more, kept for older frontends (see above)
    const disk = await getDiskUsage();

    const stats = {
      cpu: {
        usage: Math.round(cpu.usage * 10) / 10,
        cores: cpuCores,
        coresUsed: cpu.used,
        temperature: cpuTemp,
        frequency: cpuFreq,
        topProcesses: topProcesses
      },
      memory: {
        used: Math.round((usedMem / 1024 / 1024 / 1024) * 10) / 10, // GB
        total: Math.round((totalMem / 1024 / 1024 / 1024) * 10) / 10, // GB
        percent: memPercent
      },
      disk: {
        used: disk.used,
        total: disk.total,
        percent: disk.percent
      }
    };

    res.json(stats);
  } catch (error) {
    console.error('Error fetching system stats:', error);
    res.status(500).json({ error: 'Failed to fetch system stats' });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(\`System stats server running on http://localhost:\${PORT}\`);
  console.log(\`API endpoint: http://localhost:\${PORT}/api/system-stats\`);
});
EOF

print_success "Created system-stats-server.js (configured for port $PORT)"

echo ""
echo -e "${BLUE}Step 5:${NC} Installing dependencies..."
echo ""

npm install
if [ $? -eq 0 ]; then
    print_success "Dependencies installed successfully"
else
    print_error "Failed to install dependencies"
    exit 1
fi

echo ""
echo -e "${BLUE}Step 6:${NC} Testing the server..."
echo ""

# Start server in background for testing
print_info "Starting test server on port $PORT..."
npm start &
SERVER_PID=$!
sleep 3

# Test health endpoint
HEALTH_CHECK=$(curl -s http://localhost:$PORT/api/health 2>/dev/null)
if [[ $HEALTH_CHECK == *"ok"* ]]; then
    print_success "Server is responding correctly on port $PORT"
else
    print_error "Server is not responding on port $PORT"
    kill $SERVER_PID 2>/dev/null
    exit 1
fi

# Stop test server
kill $SERVER_PID 2>/dev/null
sleep 1
print_success "Test completed successfully"

echo ""
echo -e "${RED}Step 7:${NC} Setting up systemd service..."
echo ""

ask_yn "Would you like to set up the server as a system service (auto-start on boot)? (y/n)" y setup_service

if [ "$setup_service" = "y" ]; then
    
    SERVICE_FILE="/etc/systemd/system/sdr-stats.service"
    
    print_info "Creating systemd service file (requires sudo)..."
    
    # ExecStart must not bake in a version-specific nvm path such as
    # ~/.nvm/versions/node/v22.22.3/bin/node — that directory disappears on the
    # next `nvm install` and the service then fails at boot with status=203.
    # A plain symlink would have the same problem, so point ExecStart at a small
    # launcher that resolves node at run time instead.
    NODE_LAUNCHER="$HOME/.local/bin/sdr-stats-node"
    mkdir -p "$(dirname "$NODE_LAUNCHER")"
    cat > "$NODE_LAUNCHER" <<'LAUNCHER'
#!/bin/bash
# Resolve node at run time: nvm's default version if present, else system node.
# systemd sets HOME for User= units, but fall back to the passwd entry in case
# it is ever invoked from an environment that does not.
HOME="${HOME:-$(getent passwd "$(id -u)" | cut -d: -f6)}"
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
# shellcheck source=/dev/null
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
exec node "$@"
LAUNCHER
    chmod +x "$NODE_LAUNCHER"
    print_success "Node launcher created: $NODE_LAUNCHER (now → $(command -v node))"

    sudo tee $SERVICE_FILE > /dev/null <<EOF
[Unit]
Description=SDR System Stats Server
After=network.target

[Service]
Type=simple
User=$SVC_USER
Group=$SVC_USER
WorkingDirectory=$INSTALL_DIR
ExecStart=$NODE_LAUNCHER $INSTALL_DIR/system-stats-server.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

    if [ $? -eq 0 ]; then
        print_success "Service file created"
        
        # Reload systemd
        sudo systemctl daemon-reload
        print_success "Systemd configuration reloaded"
        
        # Enable service
        sudo systemctl enable sdr-stats.service
        print_success "Service enabled (will start on boot)"
        
        # Start service
        sudo systemctl start sdr-stats.service
        sleep 2
        
        # Check status
        if sudo systemctl is-active --quiet sdr-stats.service; then
            print_success "Service is running"
        else
            print_error "Service failed to start"
            echo "Check logs with: sudo journalctl -u sdr-stats.service -n 50"
        fi
    else
        print_error "Failed to create service file"
    fi
else
    print_info "Skipping service setup"
    print_warning "You will need to start the server manually with: cd $INSTALL_DIR && npm start"
fi


#####################################################
# Admin panel (optional)
#####################################################
# The stats server is usually installed after PhantomSDR-Plus itself, so this
# is a good moment to offer the panel. It stays quiet if the panel is already
# configured, and it is skipped entirely when this script is run from outside
# a PhantomSDR-Plus directory.

PHANTOM_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ADMIN_INSTALLED=false

if [ "${PHANTOM_SKIP_ADMIN_OFFER:-0}" = "1" ]; then
    print_info "Admin panel handled by the main installer — not asking again"
elif [ -f "$PHANTOM_DIR/admin_config.json" ]; then
    print_info "Admin panel already configured — leaving it alone"
elif [ -f "$PHANTOM_DIR/setup_admin.sh" ]; then
    echo ""
    echo -e "${BLUE}╔════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║   Admin Panel (optional)                       ║${NC}"
    echo -e "${BLUE}╚════════════════════════════════════════════════╝${NC}"
    echo ""
    echo "A web dashboard for your receiver: server status, CPU/RAM and user"
    echo "graphs, log viewer, config editor, connected users with a kick"
    echo "button, chat moderation, spot reporting — and a CPU over-temperature"
    echo "guard that stops the server before the heat can do damage."
    echo ""
    echo -e "Reached at  ${BLUE}http://YOUR_IP:<proxy_port>/admin${NC}"
    echo ""
    print_warning "Setup asks for three port numbers and for the start/stop scripts."
    print_warning "Nothing here depends on it — run ./setup_admin.sh any time instead."
    echo ""
    ask_yn "Install the admin panel now? (y/N)" n install_admin

    if [[ ${install_admin:-n} =~ ^[Yy]$ ]]; then
        if ! command -v pip3 >/dev/null 2>&1; then
            print_info "Installing pip..."
            sudo apt-get install -y python3-pip \
                || print_warning "Could not install pip — setup will tell you what to run"
        fi
        chmod +x "$PHANTOM_DIR/setup_admin.sh" "$PHANTOM_DIR/manage_admin.sh" 2>/dev/null
        echo ""
        if ( cd "$PHANTOM_DIR" && ./setup_admin.sh ); then
            ADMIN_INSTALLED=true
        else
            print_warning "Admin panel setup did not finish — run ./setup_admin.sh again later"
        fi
    else
        print_info "Skipping the admin panel — run ./setup_admin.sh later if you change your mind"
    fi
    echo ""
fi

echo -e "${YELLOW}Configuration Summary:${NC}"
echo "  Installation: $INSTALL_DIR"
echo "  Port: ${BLUE}$PORT${NC}"
echo "  Server: $SERVER_ADDRESS"
echo "  API URL: ${BLUE}http://$SERVER_ADDRESS:$PORT/api/system-stats${NC}"
if [ "$ADMIN_INSTALLED" = true ]; then
    echo "  Admin panel: configured — password 'admin', change it on first login"
fi
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo ""
echo "1. Add this line to your site_information.json:"
echo -e "   ${BLUE}\"siteStats\": \"http://$SERVER_ADDRESS:$PORT\"${NC}"
echo ""
echo "2. Update your App.svelte file with the 4 changes from the guide"
echo ""
echo "3. Rebuild your Svelte application"
echo ""
echo "4. Test the API:"
echo -e "   ${BLUE}curl http://localhost:$PORT/api/system-stats${NC}"
echo ""
echo -e "${YELLOW}Service management commands:${NC}"
echo "  Start:   sudo systemctl start sdr-stats.service"
echo "  Stop:    sudo systemctl stop sdr-stats.service"
echo "  Restart: sudo systemctl restart sdr-stats.service"
echo "  Status:  sudo systemctl status sdr-stats.service"
echo "  Edit:    sudo nano /etc/systemd/system/sdr-stats.service"
echo "  Delete:  sudo rm /etc/systemd/system/sdr-stats.service"
echo "  Logs:    sudo journalctl -u sdr-stats.service -f"
echo ""
echo ""
echo -e "${BLUE}╔════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║          Installation Complete! ✓              ║${NC}"
echo -e "${BLUE}║          Open the route's port! ✓              ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}Thank you for using SDR System Stats Server!${NC}"
echo ""
