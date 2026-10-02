#!/bin/bash

#####################################################
# SDR System Stats Server - Automated Installer
# For PhantomSDR-Plus
# Author: SV1BTL
# Version: 1.1
#####################################################

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;36m'
NC='\033[0m' # No Color

# Default values
DEFAULT_PORT=3001
DEFAULT_INSTALL_DIR="$HOME/sdr-stats-server"

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

# Check if running as root
if [ "$EUID" -eq 0 ]; then 
    print_error "Please do not run this script as root or with sudo"
    echo "Run it as a regular user: ./install-stats-server.sh"
    exit 1
fi

echo -e "${BLUE}Step 1:${NC} Checking prerequisites..."
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    print_warning "Node.js is not installed"
    echo ""
    read -p "Would you like to install Node.js now? (y/n): " install_node
    
    if [ "$install_node" = "y" ] || [ "$install_node" = "Y" ]; then
        print_info "Installing Node.js..."
        
        # Detect OS
        if [ -f /etc/debian_version ]; then
            # Debian/Ubuntu
            curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
            sudo apt-get install -y nodejs
        elif [ -f /etc/redhat-release ]; then
            # RedHat/CentOS
            curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
            sudo yum install -y nodejs
        else
            print_error "Unsupported OS. Please install Node.js manually from https://nodejs.org/"
            exit 1
        fi
        
        if command -v node &> /dev/null; then
            print_success "Node.js installed successfully"
        else
            print_error "Failed to install Node.js"
            exit 1
        fi
    else
        print_error "Node.js is required. Please install it manually and run this script again."
        exit 1
    fi
else
    NODE_VERSION=$(node --version)
    print_success "Node.js is installed (version: $NODE_VERSION)"
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    print_error "npm is not installed"
    exit 1
else
    NPM_VERSION=$(npm --version)
    print_success "npm is installed (version: $NPM_VERSION)"
fi

# Check if lm-sensors is installed (needed for accurate CPU temperature)
echo ""
if ! command -v sensors &> /dev/null; then
    print_warning "lm-sensors is not installed"
    echo "lm-sensors is recommended for accurate CPU temperature readings on Intel/AMD systems"
    read -p "Would you like to install lm-sensors now? (y/n): " install_sensors
    
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
read -p "Installation directory [$DEFAULT_INSTALL_DIR]: " INSTALL_DIR
INSTALL_DIR=${INSTALL_DIR:-$DEFAULT_INSTALL_DIR}

# Ask for port with validation
while true; do
    echo ""
    echo -e "${YELLOW}Port Configuration:${NC}"
    echo "  Default port: $DEFAULT_PORT"
    echo "  Common alternatives: 8080, 5000, 8888"
    read -p "Enter port number [$DEFAULT_PORT]: " PORT
    PORT=${PORT:-$DEFAULT_PORT}
    
    # Validate port number
    if ! [[ "$PORT" =~ ^[0-9]+$ ]]; then
        print_error "Port must be a number"
        continue
    fi
    
    if [ "$PORT" -lt 1024 ]; then
        print_warning "Ports below 1024 require root privileges"
        read -p "Continue with port $PORT? (y/n): " confirm_port
        if [ "$confirm_port" != "y" ] && [ "$confirm_port" != "Y" ]; then
            continue
        fi
    fi
    
    if [ "$PORT" -gt 65535 ]; then
        print_error "Port must be between 1 and 65535"
        continue
    fi
    
    # Check if port is already in use
    if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null 2>&1 ; then
        print_warning "Port $PORT is currently in use"
        echo "Process using port $PORT:"
        sudo lsof -i :$PORT | grep LISTEN
        read -p "Choose a different port? (y/n): " change_port
        if [ "$change_port" = "y" ] || [ "$change_port" = "Y" ]; then
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
read -p "Server address: " SERVER_ADDRESS

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
read -p "Continue with these settings? (y/n): " confirm

if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
    print_info "Installation cancelled"
    exit 0
fi

echo ""
echo -e "${BLUE}Step 3:${NC} Creating installation directory..."
echo ""

# Create installation directory
if [ -d "$INSTALL_DIR" ]; then
    print_warning "Directory $INSTALL_DIR already exists"
    read -p "Do you want to overwrite it? (y/n): " overwrite
    if [ "$overwrite" = "y" ] || [ "$overwrite" = "Y" ]; then
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
    const startMeasure = cpuAverage();
    
    setTimeout(() => {
      const endMeasure = cpuAverage();
      const idleDifference = endMeasure.idle - startMeasure.idle;
      const totalDifference = endMeasure.total - startMeasure.total;
      const percentageCPU = 100 - ~~(100 * idleDifference / totalDifference);
      resolve(percentageCPU);
    }, 1000); // 1 second sampling for accurate readings
  });
}

function cpuAverage() {
  const cpus = os.cpus();
  let totalIdle = 0;
  let totalTick = 0;

  cpus.forEach(cpu => {
    for (let type in cpu.times) {
      totalTick += cpu.times[type];
    }
    totalIdle += cpu.times.idle;
  });

  return {
    idle: totalIdle / cpus.length,
    total: totalTick / cpus.length
  };
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

// Helper function to get disk usage
function getDiskUsage() {
  return new Promise((resolve) => {
    exec("df -k / | tail -1 | awk '{print \$2,\$3,\$5}'", (error, stdout) => {
      if (error) {
        resolve({ used: 0, total: 0, percent: 0 });
        return;
      }
      
      const parts = stdout.trim().split(' ');
      const total = Math.round(parseInt(parts[0]) / 1024 / 1024); // Convert KB to GB
      const used = Math.round(parseInt(parts[1]) / 1024 / 1024);
      const percent = parseInt(parts[2]);
      
      resolve({ used, total, percent });
    });
  });
}

// Helper function to get top CPU-consuming processes
function getTopProcesses() {
  return new Promise((resolve) => {
    exec("ps aux --sort=-%cpu | head -6 | tail -5 | awk '{print \$11, \$3}'", (error, stdout) => {
      if (error) {
        resolve([]);
        return;
      }
      
      const lines = stdout.trim().split('\n');
      const processes = lines.map(line => {
        const parts = line.trim().split(/\s+/);
        const cpu = parseFloat(parts[parts.length - 1]);
        const name = parts.slice(0, -1).join(' ').split('/').pop(); // Get process name without path
        return { name, cpu: Math.round(cpu * 10) / 10 };
      }).filter(p => p.cpu > 0); // Only include processes using CPU
      
      resolve(processes);
    });
  });
}

// API endpoint to get system stats
app.get('/api/system-stats', async (req, res) => {
  try {
    // CPU
    const cpuUsage = await getCPUUsage();
    const cpuCores = os.cpus().length;
    const cpuTemp = await getCPUTemperature();

    // Memory
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const memPercent = Math.round((usedMem / totalMem) * 100);

    // Disk
    const disk = await getDiskUsage();

    // Top processes
    const topProcesses = await getTopProcesses();

    const stats = {
      cpu: {
        usage: Math.round(cpuUsage * 10) / 10,
        cores: cpuCores,
        temperature: cpuTemp,
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

read -p "Would you like to set up the server as a system service (auto-start on boot)? (y/n): " setup_service

if [ "$setup_service" = "y" ] || [ "$setup_service" = "Y" ]; then
    
    SERVICE_FILE="/etc/systemd/system/sdr-stats.service"
    
    print_info "Creating systemd service file (requires sudo)..."
    
    sudo tee $SERVICE_FILE > /dev/null <<EOF
[Unit]
Description=SDR System Stats Server
After=network.target

[Service]
Type=simple
User=$USER
Group=$USER
WorkingDirectory=$INSTALL_DIR
ExecStart=$(which node) $INSTALL_DIR/system-stats-server.js
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


echo -e "${YELLOW}Configuration Summary:${NC}"
echo "  Installation: $INSTALL_DIR"
echo "  Port: ${BLUE}$PORT${NC}"
echo "  Server: $SERVER_ADDRESS"
echo "  API URL: ${BLUE}http://$SERVER_ADDRESS:$PORT/api/system-stats${NC}"
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
