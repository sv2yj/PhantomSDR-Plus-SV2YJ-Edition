const express = require('express');
const os = require('os');
const { exec } = require('child_process');
const fs = require('fs');

const app = express();
const PORT = 3001; // Change this if needed

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
    }, 1000); // Changed from 100ms to 1000ms (1 second) for more accurate readings
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

// Helper function to get CPU temperature (Intel coretemp optimized)
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
    exec("df -k / | tail -1 | awk '{print $2,$3,$5}'", (error, stdout) => {
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
    exec("ps aux --sort=-%cpu | head -6 | tail -5 | awk '{print $11, $3}'", (error, stdout) => {
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
  console.log(`System stats server running on http://localhost:${PORT}`);
  console.log(`API endpoint: http://localhost:${PORT}/api/system-stats`);
});