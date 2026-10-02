# Guía de instalación de System Stats

Una guía completa para añadir monitorización de servidor en tiempo real a tu aplicación PhantomSDR mediante el script de instalación automatizado.

## Descripción general

Esta función añade un botón **📊 Stats** a tu interfaz de PhantomSDR que muestra información del sistema en tiempo real:
- Uso de CPU, núcleos, frecuencia, temperatura y procesos principales
- Uso de memoria (usada/total/porcentaje)

Las estadísticas se actualizan automáticamente cada 5 segundos mientras la ventana modal está abierta.

> **No es lo mismo que la página «Gráficos» del panel de administración.** Esta ventana es una instantánea en vivo que se refresca mientras está abierta y no guarda histórico. El panel de administración tiene una página **Gráficos** aparte que muestrea la frecuencia de CPU, la carga, la temperatura y los usuarios conectados cada 2 segundos y los representa en los últimos 15 minutos a 24 horas: véase la [guía del panel de administración](../es/ADMIN_PANEL_SETUP.md).

---

## Requisitos previos

- **Servidor Linux** (se recomienda Ubuntu/Debian)
- **Conexión a Internet** (para descargar Node.js y los paquetes)
- **Acceso Sudo** (para la configuración del servicio systemd)
- **PhantomSDR-Plus** ya instalado y en ejecución
- **lm-sensors** (recomendado para la temperatura de CPU Intel/AMD, instalado automáticamente por el script)

---

## Métodos de instalación

> [!NOTE]
> **El instalador principal ya lo ofrece.** `./install.sh` — y los cuatro instaladores por distribución — ejecutan `install-stats-server.sh` por defecto dentro de la instalación normal de PhantomSDR-Plus, así que en una máquina nueva el servidor de estadísticas suele estar ya en su sitio. Use esta página para instalarlo por separado o para cambiar después su puerto, su dirección o su servicio.

### Opción 1: Instalación automatizada (Recomendada) ⭐

El script automatizado se encarga de todo por ti.

#### Paso 1: Ejecutar el script

```bash
cd ~/PhantomSDR-Plus
chmod +x install-stats-server.sh   # only if it is not already executable
./install-stats-server.sh
```

**IMPORTANTE:** NO lo ejecutes como root ni con sudo. Ejecútalo como tu usuario normal.

#### Paso 2: Seguir las indicaciones interactivas

El script te guiará a través de:

##### 1. **Instalación de Node.js** (si es necesario)
```
⚠ Node.js / npm is not installed
Would you like to install Node.js 22 via nvm now? (y/n): y
```
El script instala Node.js 22 mediante nvm, en cualquier distribución de Linux: sin root y sin fuente apt. Hace la misma pregunta cuando Node.js está presente pero es anterior a la 22.

##### 2. **Directorio de instalación**
```
Installation directory [/home/user/sdr-stats-server]: 
```
Presiona Enter para el valor predeterminado, o especifica una ruta personalizada.

##### 3. **Configuración del puerto** (¡Mejorada!)
```
Port Configuration:
  Default port: 3001
  Common alternatives: 8080, 5000, 8888
Enter port number [3001]: 
```

El script valida tu puerto:
- ✅ Comprueba que sea un número válido
- ✅ Advierte si el puerto < 1024 (requiere privilegios de root)
- ✅ Valida el rango (1-65535)
- ✅ Comprueba si el puerto ya está en uso
- ✅ Muestra qué proceso lo está usando si está ocupado
- ✅ Te permite elegir un puerto diferente

**Escenarios de ejemplo:**

**Usando el puerto predeterminado:**
```
Enter port number [3001]: ↵
✓ Port 3001 selected
```

**Eligiendo un puerto personalizado:**
```
Enter port number [3001]: 8080
✓ Port 8080 selected
```

**Puerto ya en uso:**
```
Enter port number [3001]: 3001
⚠ Port 3001 is currently in use
Process using port 3001:
node    12345 user   20u  IPv6 123456  TCP *:3001 (LISTEN)
Choose a different port? (y/n): y
Enter port number [3001]: 3002
✓ Port 3002 selected
```

**Puerto no válido:**
```
Enter port number [3001]: abc
✗ Port must be a number
Enter port number [3001]: 99999
✗ Port must be between 1 and 65535
Enter port number [3001]: 3001
✓ Port 3001 selected
```

##### 4. **Dirección del servidor**
```
What is your server's public address?
Examples: Your_site_IP, 192.168.1.100, localhost
Server address: Your_site_IP
```
Introduce el dominio público o la dirección IP de tu servidor.

##### 5. **Confirmación**
```
Please confirm your settings:
  Installation directory: /home/user/sdr-stats-server
  Port: 3001
  Server address: Your_site_IP
  Stats URL will be: http://Your_site_IP:3001
Continue with these settings? (y/n): y
```

##### 6. **Configuración del servicio Systemd** (Opcional)
```
Would you like to set up the server as a system service (auto-start on boot)? (y/n): y
```

Recomendado: Elige **y** para que el servidor se inicie automáticamente al arrancar.

#### Paso 3: ¡Instalación completa! ✓

El script mostrará un resumen:
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

## Configura tu aplicación PhantomSDR

Después de que el script se complete, debes actualizar tu aplicación Svelte.

### Paso 1: Actualizar `site_information.json`

Dado que `site_information.json` ya se editó durante la configuración inicial, solo necesitas añadir la nueva línea `siteStats` con tu puerto:

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
  "siteStats": "http://Your_site_IP:3001",  ← AÑADE ESTA LÍNEA (usa tu puerto)
  "siteSDRBaseFrequency": 0,
  "siteSDRBandwidth": 30000000,
  "siteRegion": 1,
  "siteChatEnabled": true
}
```

**Nota:** ¡Usa el puerto que seleccionaste durante la instalación!

### Paso 2: Actualizar `App.svelte` (la última versión de GitHub ya incluye el archivo actualizado)

Realiza estos **4 cambios** en tu archivo App.svelte:

#### Cambio 1: Asegurarte de que `siteStats` esté declarado (alrededor de la línea 50)

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
  siteStats,  // ← AÑADE ESTA LÍNEA
  siteSDRBaseFrequency,
  siteSDRBandwidth,
  siteRegion,
  siteChatEnabled,
} from "../site_information.json";
```

#### Cambio 2: Actualizar el objeto systemStats (alrededor de la línea 530)

```javascript
let systemStats = {
  cpu: { usage: 0, cores: 0, temperature: null, frequency: null, topProcesses: [] },  // ← AÑADE topProcesses: []
  memory: { used: 0, total: 0, percent: 0 }
};
```

#### Cambio 3: Actualizar la URL de fetch (alrededor de la línea 541)

```javascript
async function fetchSystemStats() {
  try {
    const response = await fetch(`${siteStats}/api/system-stats`);  // ← CAMBIA ESTA LÍNEA
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

#### Cambio 4: Añadir la visualización de procesos principales (en la sección CPU, alrededor de la línea 3838)

Añade este código después de la sección de temperatura:

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

<!-- AÑADE TODA ESTA SECCIÓN: -->
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

### Paso 3: Recompilar tu aplicación

```bash
cd /path/to/your/phantomsdr-app
npm ./recompile.sh
```

---

## Probar la instalación

### Prueba 1: Verificar el endpoint de la API

```bash
curl http://localhost:3001/api/system-stats
```

Salida esperada (JSON):
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

### Prueba 2: Verificar el estado del servicio

Si lo instalaste como servicio:

```bash
sudo systemctl status sdr-stats.service
```

Debería mostrar: `Active: active (running)`

### Prueba 3: Probar en el navegador

1. Abre tu interfaz web de PhantomSDR
2. Desplázate hasta la sección **Additional Info**
3. Haz clic en el botón **Open Additional Info**
4. Busca el botón **📊 Stats** junto a la información del PC
5. Haz clic en él para abrir la ventana modal de estadísticas
6. Verifica que las estadísticas se muestren y se actualicen

---

## Gestión del servicio

Si lo instalaste como servicio systemd, usa estos comandos:

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

## Instalación manual (Opción 2)


> [!IMPORTANT]
> **No necesita esta sección para una instalación normal.** `install-stats-server.sh` lo hace todo por usted y el instalador principal lo ejecuta por defecto. Sígala solo para una instalación manual o para reparar una pieza a mano.

**⚠️ Advertencia:** La instalación manual puede usar archivos desactualizados. Se **recomienda encarecidamente el script automatizado** ya que:
- Instala la última versión con detección de temperatura mejorada
- Instala y configura lm-sensors automáticamente
- Gestiona todas las dependencias automáticamente

Si aun así prefieres la instalación manual:

### 1. Instalar Node.js
```bash
# Any distribution - nvm needs no root and no apt source.
# NOT NodeSource: deb.nodesource.com now answers HTTP 403 on every path.
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.4/install.sh | bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm install 22 && nvm use 22 && nvm alias default 22
```

### 2. Instalar lm-sensors (Requerido para la temperatura Intel/AMD)
```bash
sudo apt-get update
sudo apt-get install -y lm-sensors
sudo sensors-detect --auto
```

### 3. Crear el directorio
```bash
mkdir ~/sdr-stats-server
cd ~/sdr-stats-server
```

### 4. Descargar los archivos más recientes

**Importante:** los archivos del servidor ya no se guardan como copias en el repositorio: los genera el script de instalación.

En su lugar, ejecuta el script automatizado una vez para generar los archivos más recientes y luego cópialos:
```bash
# Run the automated script from the repository root
cd ~/PhantomSDR-Plus
./install-stats-server.sh
# When prompted, use a temporary port like 9999
# After installation completes, copy the generated files
cp ~/sdr-stats-server/system-stats-server.js ~/your-manual-install-dir/
cp ~/sdr-stats-server/package.json ~/your-manual-install-dir/
```

**O** crea manualmente los archivos usando el código más reciente del script de instalación.

### 5. Editar el puerto (si es necesario)
```bash
nano ~/sdr-stats-server/system-stats-server.js
```

Cambia la línea 6:
```javascript
const PORT = process.env.PORT || 3001;  // Change this number
```

### 6. Instalar dependencias
```bash
npm install
```

### 7. Ejecución de prueba
```bash
npm start
```

### 8. Configurar el servicio (Opcional)

Sigue la configuración del servicio systemd de la sección de instalación automatizada.

## Cambiar el puerto después de la instalación

Si necesitas cambiar el puerto después de la instalación:

### Paso 1: Editar el archivo del servidor

```bash
nano ~/sdr-stats-server/system-stats-server.js
```

Cambia la línea 6:
```javascript
const PORT = process.env.PORT || 3001;  // Change this number
```

### Paso 2: Actualizar site_information.json

```json
"siteStats": "http://Your_site_IP:NEW_PORT"
```

### Paso 3: Reiniciar el servicio

```bash
sudo systemctl restart sdr-stats.service
```

### Paso 4: Reconstruir tu aplicación Svelte

```bash
cd /path/to/phantomsdr-app
npm run build
```

---

## Solución de problemas

### Problema: Puerto ya en uso

**Error:**
```
Error: listen EADDRINUSE: address already in use :::3001
```

**Solución:**

1. Encuentra qué está usando el puerto:
```bash
sudo lsof -i :3001
```

2. Detén ese proceso:
```bash
kill <PID>
# or
sudo systemctl stop sdr-stats.service
```

3. Inicia el servicio de nuevo:
```bash
sudo systemctl start sdr-stats.service
```

**Alternativa:** Ejecuta el script de instalación de nuevo y elige un puerto diferente cuando se te solicite.

### Problema: El servicio no arranca

**Error:**
```
status=217/USER
```

**Solución:**

1. Comprueba el archivo del servicio:
```bash
cat /etc/systemd/system/sdr-stats.service
```

2. Verifica que la línea `User=` coincida con tu nombre de usuario:
```bash
whoami
```

3. Edítalo si es necesario:
```bash
sudo nano /etc/systemd/system/sdr-stats.service
```

4. Recarga y reinicia:
```bash
sudo systemctl daemon-reload
sudo systemctl restart sdr-stats.service
```

### Problema: Las estadísticas no se muestran en el navegador

**Síntomas:** La ventana modal se abre pero no hay datos, o muestra valores en 0

**Soluciones:**

1. Comprueba la consola del navegador (F12) en busca de errores
2. Verifica que la API sea accesible:
```bash
curl http://localhost:3001/api/system-stats
```
3. Comprueba que el servicio esté en ejecución:
```bash
sudo systemctl status sdr-stats.service
```
4. Verifica que `siteStats` en `site_information.json` coincida con la dirección y el puerto de tu servidor
5. Comprueba los errores de CORS: asegúrate de que el servidor permita tu dominio

### Problema: La temperatura muestra null

**Causa:** La lectura de temperatura no está disponible en tu sistema

**Soluciones:**

1. **Para la mayoría de los sistemas Linux:** Comprueba si existe la zona térmica:
```bash
cat /sys/class/thermal/thermal_zone0/temp
```

2. **Instala lm-sensors:**
```bash
sudo apt-get install lm-sensors
sudo sensors-detect
sensors
```

3. **Nota:** Es posible que la temperatura no esté disponible en:
- Máquinas virtuales
- Algunos proveedores de VPS
- Windows Subsystem for Linux (WSL)
- Sistemas no Linux

¡Esto es normal! El resto de las estadísticas seguirá funcionando.

### Problema: Los valores de las estadísticas no coinciden con `top`

**Causa:** El período de muestreo de la CPU era demasiado corto en versiones anteriores

**Solución:** La versión actual usa un muestreo de 1 segundo para lecturas precisas. Si tienes una instalación antigua:

1. Actualiza el archivo del servidor:
```bash
nano ~/sdr-stats-server/system-stats-server.js
```

2. Encuentra la línea 18 y cambia:
```javascript
}, 100);  // Old value
```
a:
```javascript
}, 1000);  // New value (1 second)
```

3. Reinicia:
```bash
sudo systemctl restart sdr-stats.service
```

O simplemente vuelve a ejecutar el script de instalación para obtener la última versión.

### Problema: Node.js no encontrado

**Error:**
```
node: command not found
```

**Solución:**

1. Instala Node.js:
```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.4/install.sh | bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm install 22 && nvm use 22 && nvm alias default 22
```

2. Verifica:
```bash
node --version
npm --version
```

---

## Lo que verás

Una vez instalado y configurado, la ventana modal de estadísticas muestra:

### 🖥️ Sección CPU
- **Uso**: Porcentaje de utilización general de la CPU
- **Núcleos**: Cuánta CPU se usa realmente, expresada en núcleos completos —por ejemplo `1.3 / 12 in use` significa que la máquina hace el trabajo de 1,3 núcleos—. Es exacto y no necesita ningún umbral. Deliberadamente no es un recuento de núcleos ocupados: el planificador reparte el trabajo de un núcleo entre muchos, así que ese recuento solo podría aproximar esta cifra.
- **Frecuencia**: Frecuencia actual media de la CPU en todos los núcleos en GHz, con el núcleo más rápido entre paréntesis (si está disponible)
- **Temperatura**: Temperatura de la CPU en grados Celsius (si está disponible), con código de color: 🟢 verde hasta 69 °C, 🟠 naranja 70-79 °C, 🔴 rojo a partir de 80 °C
- **Procesos principales**: Los 5 procesos que más consumen CPU con porcentajes codificados por colores:
  - 🟢 Verde: hasta 50 % de CPU
  - 🟠 Naranja: 51-80 % de CPU
  - 🔴 Rojo: más del 80 % de CPU

### 💾 Sección de memoria
- **Usada**: Memoria en uso (GB)
- **Total**: Memoria total del sistema (GB)
- **Uso**: Porcentaje de uso de memoria (codificado por colores)

### ♻️ Actualización automática
- Las estadísticas se actualizan cada **5 segundos** mientras la ventana modal está abierta
- Deja de actualizarse cuando cierras la ventana modal (ahorra recursos)

---


## Detección de temperatura

El servidor de estadísticas utiliza una detección de temperatura avanzada con múltiples métodos:

### ✅ **Sistemas compatibles:**
- **Procesadores Intel**: Lee de los sensores coretemp mediante lm-sensors
- **Procesadores AMD**: Lee de los sensores k10temp (Tdie/Tctl)
- **Procesadores ARM**: Lee de las zonas térmicas (Raspberry Pi, etc.)

### 📋 **Requisitos:**
- **Intel/AMD**: Requiere el paquete `lm-sensors` (instalado automáticamente por el script)
- **ARM/Raspberry Pi**: Funciona de inmediato, no se necesitan paquetes adicionales

### 🔧 **Prioridad de instalación:**
1. Intenta el comando `sensors` para la temperatura Package/Core (Intel/AMD)
2. Recurre a la lectura directa de coretemp (Intel)
3. Recurre a thermal_zone0 (ARM/Raspberry Pi)

Si la temperatura muestra `null`, instala lm-sensors:
```bash
sudo apt-get install lm-sensors
sudo sensors-detect --auto
sudo systemctl restart sdr-stats.service
```

---

## Resumen de funciones

✅ **Monitorización en tiempo real** - Estadísticas del sistema en vivo desde tu servidor
✅ **Métricas de CPU** - Uso, núcleos, temperatura, procesos principales
✅ **Seguimiento de memoria** - Usada, total y porcentaje
✅ **Actualizaciones automáticas** - Se actualiza cada 5 segundos
✅ **Codificado por colores** - Indicadores visuales para las advertencias
✅ **Ligero** - Uso mínimo de recursos
✅ **Instalación fácil** - El script automatizado se encarga de todo
✅ **Validación de puerto** - Selección inteligente de puerto con detección de conflictos
✅ **Gestión del servicio** - Inicio automático al arrancar

---

## Notas de seguridad

- El servidor de estadísticas acepta conexiones de cualquier origen (CORS: *)
- Para producción, considera restringir CORS solo a tu dominio
- La selección de puerto valida la entrada y comprueba conflictos
- La lectura de la temperatura de la CPU es de solo lectura y segura
- No se expone información sensible del sistema

---

## Soporte y recursos

### Archivos incluidos:
En esta carpeta (el script de instalación está en la raíz, como `PhantomSDR-Plus/install-stats-server.sh`: solo existe una copia):
- `package.json` - Dependencias, idénticas a las que escribe el script
- Este documento, disponible también en de, el, es, fr, hr y ru

Creados por el script en `~/sdr-stats-server/`:
- `system-stats-server.js` - Servidor backend, generado con el puerto elegido
- `package.json` - Dependencias
- `node_modules/` - instalado por `npm install`

### Obtener ayuda:
- Consulta la sección de solución de problemas anterior
- Revisa los registros del servicio: `sudo journalctl -u sdr-stats.service -n 50`
- Prueba la API manualmente: `curl http://localhost:3001/api/system-stats`
- Verifica los archivos de configuración

### Desinstalar el servidor de estadísticas:
- Elimina la carpeta /sdr-stats-server
- Si has creado un servicio, simplemente elimínalo usando:
```bash
sudo rm /etc/systemd/system/sdr-stats.service"`
```
- Modifica `App.svelte`: Encuentra la parte del código:
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
  y reemplázala con:
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
- Recompila usando el comando:
```bash
  cd PhantomSDR-Plus
 ./recompile.sh
 ```
- Reinicia el PC e inicia el servidor

---

**Autor:** Creado para PhantomSDR-Plus
**Versión:** 1.1 (Detección mejorada de la temperatura de la CPU para Intel/AMD) **Actualizado:** Enero de 2026
**Licencia:** MIT

---

## Referencia rápida de comandos

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

¡Feliz monitorización! 📊🚀
