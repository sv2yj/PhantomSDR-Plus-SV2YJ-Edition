# Guía de instalación de PhantomSDR-Plus para operadores de sistema

Esta guía completa le acompañará en la instalación y configuración de PhantomSDR-Plus en su servidor.

---

## Índice

1. [Requisitos del sistema](#requisitos-del-sistema)
2. [Preparación previa a la instalación](#preparación-previa-a-la-instalación)
3. [Instalación de PhantomSDR-Plus](#instalación-de-phantomsdr-plus) — el script y [qué hace](#qué-hace-el-instalador)
4. [Autorun Spot Reporter (FT8/FT4/WSPR)](#autorun-spot-reporter-ft8ft4wspr)
5. [Emulación de clientes KiwiSDR (opcional)](#emulación-de-clientes-kiwisdr-opcional)
6. [Configuración](#configuración)
7. [Configuración específica por dispositivo SDR](#configuración-específica-por-dispositivo-sdr)
8. [Pruebas y verificación](#pruebas-y-verificación)
9. [Configuración del arranque automático](#configuración-del-arranque-automático)
10. [Protección térmica de la CPU](#protección-térmica-de-la-cpu)
11. [Resolución de problemas](#resolución-de-problemas)

**Solo como referencia: el instalador ya hace todo esto por usted.** Lea estas secciones si usa una distribución que ninguno de los scripts cubre, o si necesita reparar un paso a mano:

- [Instalación de dependencias](#instalación-de-dependencias)
- [Instalación de Node.js y npm](#instalación-de-nodejs-y-npm)
- [Instalación de OpenCL](#instalación-de-opencl-opcional-pero-recomendable)
- [Compilar a mano](#compilar-a-mano-referencia)
- [Instalación del códec de audio Opus](#instalación-del-códec-de-audio-opus)
---

## Requisitos del sistema

### Sistemas operativos compatibles

**Principal (recomendado):**
- Ubuntu 22.04 LTS (Jammy), 24.04 LTS (Noble) y 26.04 LTS (Resolute) — se recomienda 24.04
- Debian 12 (Bookworm) y Debian 13 (Trixie)

**Alternativa:**
- Fedora (última versión estable)
- Arch Linux (rolling)
- openSUSE Tumbleweed (no Leap — vea la nota más abajo)

### Requisitos de hardware

**Configuración mínima:**
- CPU: procesador de doble núcleo (2 GHz o más)
- RAM: 4 GB
- Almacenamiento: 10 GB libres
- Red: conexión de 100 Mbps

**Configuración recomendada:**
- CPU: cuatro núcleos o mejor (Ryzen 5 2600, Intel i5-6500T o superior)
- RAM: 8 GB o más
- Almacenamiento: SSD de 20 GB o más
- GPU: AMD/NVIDIA compatible con OpenCL (muy recomendable)
- Red: conexión de 1 Gbps

**Configuración de alto rendimiento:**
- CPU: 6 núcleos o más (Ryzen 7, Intel i7 o mejor)
- RAM: 16 GB o más
- Almacenamiento: SSD NVMe
- GPU: GPU dedicada compatible con OpenCL/CUDA
- Red: 1 Gbps o superior

---

## Preparación previa a la instalación

### 1. Actualice el sistema

```bash
# Ubuntu/Debian
sudo apt update
sudo apt upgrade -y
sudo reboot

# Fedora
sudo dnf update -y
sudo reboot
```

### 2. Compruebe la versión de Ubuntu

```bash
lsb_release -a
```

**La salida esperada debería mostrar:** Ubuntu 24.04 LTS

### 3. Compruebe el espacio libre en disco

```bash
df -h
```

Asegúrese de tener al menos 10 GB libres en su directorio personal.

### 4. Consulte la información de la CPU

```bash
lscpu
```

Anote el número de núcleos/hilos para optimizar la configuración.

---

## Instalación de dependencias

> [!IMPORTANT]
> **No necesita esta sección para una instalación normal.** `./install.sh` — o el instalador de su distribución — lo hace todo por usted; véase [Qué hace el instalador](#qué-hace-el-instalador). Lo que sigue es una referencia para una instalación manual, para una distribución que ningún script cubre, o para reparar una pieza a mano.


### Ubuntu 24.04 LTS

```bash
sudo apt install -y \
  build-essential \
  cmake \
  pkg-config \
  meson \
  libfftw3-dev \
  libwebsocketpp-dev \
  libflac++-dev \
  zlib1g-dev \
  libzstd-dev \
  libboost-all-dev \
  libopus-dev \
  libliquid-dev \
  git \
  psmisc \
  wget \
  curl
```

### Fedora

```bash
sudo dnf install -y \
  g++ \
  meson \
  cmake \
  fftw3-devel \
  websocketpp-devel \
  flac-devel \
  zlib-devel \
  boost-devel \
  libzstd-devel \
  opus-devel \
  liquid-dsp-devel \
  git \
  psmisc \
  wget \
  curl
```

### Verifique la instalación

```bash
# Check if key dependencies are installed
pkg-config --modversion fftw3
cmake --version
meson --version
```

---

## Instalación de Node.js y npm

> [!IMPORTANT]
> **No necesita esta sección para una instalación normal.** `./install.sh` — o el instalador de su distribución — lo hace todo por usted; véase [Qué hace el instalador](#qué-hace-el-instalador). Lo que sigue es una referencia para una instalación manual, para una distribución que ningún script cubre, o para reparar una pieza a mano.


PhantomSDR-Plus necesita Node.js para compilar la interfaz web. Usaremos NVM (Node Version Manager) para instalarlo.

### 1. Instale NVM

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.4/install.sh | bash
```

### 2. Cargue NVM

**IMPORTANTE:** cierre y vuelva a abrir el terminal, o ejecute:

```bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
```

### 3. Compruebe la instalación de NVM

```bash
nvm --version
```

Salida esperada: `0.40.4` o similar

### 4. Instale Node.js

```bash
# Install Node.js 22 - the version every install script requires
nvm install 22

# Make it the default, so systemd units and cron see it too
nvm alias default 22

# Verify installation
node --version
npm --version
```

### 5. Opcional: instale otras versiones de Node

```bash
# Install latest version
nvm install node

# Install specific version (if needed)
nvm install 22.22.3

# List installed versions
nvm list

# Use specific version
nvm use 22
```

---

## Instalación de OpenCL (opcional pero recomendable)

> [!IMPORTANT]
> **No necesita esta sección para una instalación normal.** `./install.sh` — o el instalador de su distribución — lo hace todo por usted; véase [Qué hace el instalador](#qué-hace-el-instalador). Lo que sigue es una referencia para una instalación manual, para una distribución que ningún script cubre, o para reparar una pieza a mano.


OpenCL mejora enormemente el rendimiento al trasladar los cálculos de FFT a la GPU. Esta sección cubre la gráfica integrada de Intel. Para GPU de AMD/NVIDIA, consulte la documentación del fabricante.

### CPU Intel con gráficos integrados

#### 1. Instale los componentes básicos de OpenCL

```bash
sudo apt install -y \
  build-essential \
  cmake \
  pkg-config \
  meson \
  libfftw3-dev \
  libwebsocketpp-dev \
  libflac++-dev \
  zlib1g-dev \
  libzstd-dev \
  libboost-all-dev \
  libopus-dev \
  libliquid-dev \
  libclfft-dev \
  ocl-icd-opencl-dev \
  clinfo
```

#### 2. Descargue Intel Compute Runtime

```bash
mkdir -p ~/neo
cd ~/neo

wget https://github.com/intel/compute-runtime/releases/download/19.07.12410/intel-gmmlib_18.4.1_amd64.deb
wget https://github.com/intel/compute-runtime/releases/download/19.07.12410/intel-igc-core_18.50.1270_amd64.deb
wget https://github.com/intel/compute-runtime/releases/download/19.07.12410/intel-igc-opencl_18.50.1270_amd64.deb
wget https://github.com/intel/compute-runtime/releases/download/19.07.12410/intel-opencl_19.07.12410_amd64.deb
wget https://github.com/intel/compute-runtime/releases/download/19.07.12410/intel-ocloc_19.07.12410_amd64.deb
```

#### 3. Instale el entorno de ejecución OpenCL de Intel

```bash
sudo dpkg -i *.deb
```

Si aparecen errores de dependencias:

```bash
sudo apt --fix-broken install
```

#### 4. Instale el cargador ICD de OpenCL

```bash
sudo apt update
sudo apt install intel-opencl-icd
```

Si aparecen errores:

```bash
sudo apt --fix-broken install
sudo apt install intel-opencl-icd
```

#### 5. Verifique la instalación de OpenCL

```bash
sudo clinfo
```

Debería ver información sobre su plataforma y dispositivos OpenCL. Busque:
- Número de plataformas: 1 (o más)
- Nombre de la plataforma: Intel(R) OpenCL (o similar)
- Tipo de dispositivo: GPU o CPU

#### 6. Reinicie

```bash
sudo reboot
```

### OpenCL en GPU AMD

Para GPU de AMD, instale ROCm:

```bash
# Add ROCm repository
wget -q -O - https://repo.radeon.com/rocm/rocm.gpg.key | sudo apt-key add -
echo 'deb [arch=amd64] https://repo.radeon.com/rocm/apt/debian/ ubuntu main' | sudo tee /etc/apt/sources.list.d/rocm.list

# Install ROCm
sudo apt update
sudo apt install rocm-opencl rocm-clinfo

# Add user to video group
sudo usermod -a -G video $USER

# Reboot
sudo reboot

# Verify
clinfo
```

### OpenCL en GPU NVIDIA

Para GPU de NVIDIA, instale CUDA:

```bash
# Install NVIDIA drivers
sudo apt install nvidia-driver-525

# Install CUDA toolkit
wget https://developer.download.nvidia.com/compute/cuda/repos/ubuntu2204/x86_64/cuda-keyring_1.0-1_all.deb
sudo dpkg -i cuda-keyring_1.0-1_all.deb
sudo apt update
sudo apt install cuda

# Reboot
sudo reboot

# Verify
nvidia-smi
clinfo
```

---

## Instalación de PhantomSDR-Plus

### Clonar el repositorio, dar permisos a los scripts y ejecutar el instalador

```bash
cd ~
git clone --recursive https://github.com/sv1btl/PhantomSDR-Plus
cd PhantomSDR-Plus
chmod +x *.sh
./install.sh
```

**⚠️ IMPORTANTE:** Cuando termine el instalador, **reinicie el terminal**: hasta entonces Node.js y Rust recién instalados no están en su `PATH`.

> **¿Ya tiene PhantomSDR-Plus en marcha?** No lo instale otra vez: actualícelo. Descargue la herramienta de actualización una vez y ejecútela; su configuración, marcadores, contraseña de administración, lista de frecuencias e historial de chat nunca se tocan, y lo que usted haya modificado se le pregunta en lugar de sobrescribirse:
>
> ```bash
> cd ~/PhantomSDR-Plus
> curl -fLO https://raw.githubusercontent.com/sv1btl/PhantomSDR-Plus/main/update.sh
> chmod +x update.sh
> ./update.sh
> ```
>
> Esa última línea sólo *informa* de lo que cambiaría y no escribe nada; `./update.sh --apply` lo hace. Los detalles están en el capítulo *Actualización de PhantomSDR-Plus*. Volver a pasar el instalador sobre una estación en marcha sólo hace falta si la reconstrucción falla por paquetes del sistema que faltan.

Use el script que corresponda a su sistema. Todos hacen el mismo trabajo y hacen las mismas preguntas; solo cambia el gestor de paquetes:

| Sistema | Script |
|---|---|
| Ubuntu 22.04 / 24.04 / 26.04, Debian 12 / 13 | `./install.sh` |
| Fedora | `./install_fedora.sh` |
| Arch | `./install_arch.sh` |
| openSUSE Tumbleweed | `./install_opensuse.sh` |

> **Un único instalador para todas las versiones de Debian y Ubuntu.** `install.sh` lee `/etc/os-release` y la versión de Boost instalada y se adapta solo; los antiguos `install_ubuntu22.sh`, `install-Deb12.sh` e `install_ubuntu26.sh` han desaparecido. Establece `DEBIAN_FRONTEND=noninteractive`, para que el `tzdata` que llega con `python3-matplotlib` no pueda detener la ejecución preguntando por su zona horaria y tragarse después la respuesta destinada a la siguiente pregunta. En Jammy llama directamente a `install_rade_ubuntu22.sh`, porque el `python3-websockets` de Jammy es 10.1 y RADE necesita 11.0 o posterior. Sabe dónde vive `intel-opencl-icd` en cada versión: en los repositorios en 22.04 y 26.04, en `non-free` en Debian 12, y en el propio repositorio gráfico de Intel en 24.04 y Debian 13. Y donde Boost es 1.87 o posterior, el parche de cabeceras de websocketpp deja de ser opcional: el instalador verifica que se aplicó y se niega a compilar sin él. Nunca hace falta un compilador más nuevo: el GCC de serie acepta `-std=c++23` en las cinco versiones, así que no instale `gcc-12` para esto.

La instalación transcurre en 17 pasos claramente numerados, y cada punto en el que se le espera va enmarcado por un recuadro **⌨️  SE NECESITA SU RESPUESTA**, de modo que una pregunta no pueda confundirse con la salida que va pasando. Las siete preguntas se enumeran al principio, antes de instalar nada. `PHANTOM_NONINTERACTIVE=1` las responde todas con sus valores por defecto; consulte la cabecera de `install.sh` para las variables `PHANTOM_*`.

**Cada ejecución escribe `install.txt`.** Cuando el instalador termina —o muere a medio camino— escribe un informe en `install.txt` dentro del directorio PhantomSDR-Plus: el resultado, cada uno de los 17 pasos como OK / SKIPPED / PARTIAL / FAILED, lo que detectó (distribución, Boost, compilador, Node.js), qué componentes se instalaron, y cada aviso que apareció. Una ejecución fallida deja un informe que termina en el paso que falló, con el motivo y la nota de que el instalador puede volver a ejecutarse sin riesgo. Es el primer archivo que hay que leer cuando algo no funcionó, y el primero que adjuntar a un informe de error. Cada ejecución lo sobrescribe, así que guarde una copia si quiere comparar dos instalaciones.

> **Ubuntu 26.04, Arch y openSUSE Tumbleweed compilan, pero no se han puesto en el aire.** Los tres traen un Boost más nuevo que 1.87, que eliminó la API `io_service` para la que se escribió el websocketpp 0.8.2 incluido. Las cabeceras parcheadas que copia el instalador salvan esa distancia (`io_context`, `executor_work_guard`, `boost::asio::post`, el resolver moderno), y donde Boost es 1.87 o posterior el instalador trata ese parche como obligatorio y no opcional: verifica que las copias se aplicaron y se niega a compilar sin ellas. Una instalación completa, con el driver del receptor y todos los componentes opcionales, se ha verificado de principio a fin en contenedores con Boost 1.90 (Ubuntu 26.04), 1.91 (openSUSE Tumbleweed) y 1.92 (Arch). Eso demuestra que el servidor compila y arranca, no que sirva un receptor durante horas. Considere los tres sin probar en producción hasta que alguien informe.

> **openSUSE aquí significa Tumbleweed.** Ahí es donde está verificado `install_opensuse.sh`. Leap 15.6 no funciona: sus repositorios no incluyen `liquid-dsp-devel`, que el backend necesita, y Boost solo está disponible con nombres de paquete versionados. Dar soporte a Leap exigiría añadir repositorios OBS de terceros, así que queda fuera del alcance por ahora.

### Qué hace el instalador

No hay que preparar nada a mano de antemano: ninguna lista de paquetes que pegar, ningún Node.js que descargar, ningún paquete de OpenCL que buscar. Transcurre en 19 pasos numerados y se detiene a hacerle hasta diez preguntas, cada una enmarcada por un recuadro «SE NECESITA SU RESPUESTA»: quédese al teclado, o bien ponga `PHANTOM_NONINTERACTIVE=1` y deje que responda todo con sus valores por defecto (véase más abajo), y cuente entre unos veinte minutos y bastante más de una hora según la máquina y según cuántos extras conserve.

| # | Paso | Qué se le pregunta |
|---|---|---|
| 1 | Enumera los servicios de PhantomSDR-Plus que están en marcha en ese momento — panel de administración, proxy inverso, servidor de estadísticas, receptor — y ofrece detenerlos antes de tocar nada. Solo cuenta como receptor un script de arranque en ejecución; uno que solo está abierto en un editor no se toca. | confirmar, **sí por defecto** |
| 2–6 | Detecta la distribución e instala todas las dependencias de compilación (compilador, meson/ninja, FFTW, Boost, FLAC, Opus, liquid-dsp, zlib/zstd, libcurl …), instalando Node.js 22 mediante nvm si el sistema no lo tiene o lo tiene demasiado antiguo | nada |
| 7 | Compila el backend con meson | nada |
| 8 | Compila el driver de su receptor — RX888 MkII / RX888, RTL-SDR (el Blog V4 se pregunta aparte), SDRplay RSP1A, RigExpert Fobos SDR, Airspy HF+, HackRF One o ninguno. Al elegir el RX888 **también instala las reglas udev**, para que el servidor nunca necesite `sudo` para el dispositivo. El RSP1A, el Fobos y el Airspy HF+ funcionan a través de SoapySDR: su opción ejecuta `setup-rsp1a.sh`, `setup-fobos.sh` o `setup-airspyhf.sh`, que compilan el driver y `rx_sdr` e instalan también una regla udev (vea [Receptores sobre SoapySDR (RSP1A, Fobos, Airspy HF+)](#receptores-sobre-soapysdr-rsp1a-fobos-airspy-hf)) El HackRF One no necesita SoapySDR: su opción ejecuta `setup-hackrf.sh`, que instala el paquete `hackrf` de la distribución y una regla udev. | qué SDR tiene |
| 9 | Abre `frontend/site_information.json` en su editor | indicativo, locator, hardware, antena — **no se lo salte** |
| 10–11 | Instala las dependencias del frontend y compila las páginas de escritorio y `/mobile` | nada |
| 12 | Instala OpenCL eligiendo el proveedor según el hardware que encuentra (GPU Intel / AMD / NVIDIA, o el runtime de CPU x86). Si no hay ningún dispositivo compatible, lo dice y continúa | confirmar, sí por defecto |
| 13–15 | Instala el **panel de administración**, el **decodificador FreeDV RADE V1** y el **servidor de estadísticas** — los tres por defecto | confirmar cada uno, sí por defecto; cada uno tiene sus preguntas |
| 16 | Vuelve a aplicar las cinco cabeceras parcheadas de websocketpp sobre el subproyecto de meson y verifica que se copiaron. Tres de ellas son el trabajo de compatibilidad con Boost ≥ 1.87, sin el cual el backend no compila con Boost 1.90; las otras dos son cambios propios del proyecto, uno de ellos la corrección que necesita el registro en websdr.org | nada |
| 17 | Instala la **emulación de clientes KiwiSDR** ejecutando `kiwi_install.sh`, para que clientes Kiwi como AetherSDR puedan conectarse a este receptor. Parchea las fuentes y añade `[kiwi_emulation]` a los ficheros de configuración de la raíz del repositorio — véase [Emulación de clientes KiwiSDR](Aether_config.md) | confirmar, sí por defecto |
| 18 | Ejecuta `recompile.sh`, para que todo se compile a partir de las fuentes parcheadas | `[3] Both backend and frontend` → variante inicial → `[1] build-all.sh` |
| 19 | Imprime el resumen: cada paso con su veredicto y cada componente con lo que se instaló | nada |

#### Instalación desatendida

Cada pregunta tiene una variable de entorno que la sustituye, y el instalador pasa por sí solo a los valores por defecto cuando la entrada estándar no es un terminal (una tubería, un contenedor, un trabajo de CI). Funciona igual en los cuatro: `install.sh`, `install_arch.sh`, `install_fedora.sh` e `install_opensuse.sh`. Ponga `PHANTOM_NONINTERACTIVE=1` y la ejecución termina sin preguntar nada:

| Variable | Efecto |
|---|---|
| `PHANTOM_NONINTERACTIVE=1` | answer every question with its default |
| `PHANTOM_SDR=1…7` | RX888 · RTL-SDR · SDRplay RSP1A · skip · Fobos · Airspy HF+ · HackRF (default 4) |
| `PHANTOM_RTLSDR_V4=y\|n` | RTL-SDR Blog V4 driver (default n) |
| `PHANTOM_SITE_EDIT=y\|n` | open `site_information.json` in an editor |
| `PHANTOM_OPENCL=y\|n` | install OpenCL (default y) |
| `PHANTOM_OPENCL_PROVIDER=1\|2\|3` | Intel · Mesa/Rusticl · POCL (default: from the detected hardware) |
| `PHANTOM_ADMIN=y\|n` | admin panel (y interactive, n unattended) |
| `PHANTOM_RADE=y\|n` | RADE / FreeDV (y interactive, n unattended) |
| `PHANTOM_STATS=y\|n` | statistics server (y interactive, n unattended) |
| `PHANTOM_KIWI=y\|n` | KiwiSDR client emulation (default y) |
| `PHANTOM_RECOMPILE=y\|n` | final rebuild (default y) |
| `PHANTOM_CURLPP=y\|n` | continuar sin curlpp — solo Arch y openSUSE (por defecto y) |
| `PHANTOM_FIX_CLOCK_SKEW=y\|n` | restablecer las marcas de tiempo de los fuentes fechadas en el futuro, para que meson pueda compilar (por defecto y) |

Los tres sub-instaladores marcados *n desatendido* son guiones interactivos por su cuenta, así que una ejecución desatendida los omite en lugar de quedarse esperando. Nómbrelos explícitamente para incluirlos:

```bash
# a complete unattended install for an RX888 MkII
PHANTOM_NONINTERACTIVE=1 PHANTOM_SDR=1 ./install.sh

# ... and with the admin panel, RADE and the statistics server too
PHANTOM_NONINTERACTIVE=1 PHANTOM_SDR=1 \
  PHANTOM_ADMIN=y PHANTOM_RADE=y PHANTOM_STATS=y ./install.sh
```

Tras reiniciar, las reglas udev del RX888 y cualquier driver de OpenCL quedan plenamente activos; el instalador le avisa cuando hace falta reiniciar o volver a iniciar sesión.

Al configurar el panel de administración, el instalador ofrece también las dos unidades systemd y **recomienda encarecidamente** aceptarlas: la protección contra sobrecalentamiento se ejecuta dentro del panel, así que sin ellas un reinicio o un fallo deja la máquina desprotegida. El paso se omite automáticamente donde systemd no está en marcha (contenedores, WSL1, OpenRC) — véase la [guía del panel](ADMIN_PANEL_SETUP.md).

Cada extra es un script normal que también puede ejecutar por separado en cualquier momento — `./setup_admin.sh` ([manual](ADMIN_PANEL_SETUP.md)), `./install_rade.sh` ([manual](RADE_README.md)), `./install-stats-server.sh` ([manual](sdr-stats/README.md)), `./setup-rx888-udev.sh` y los scripts de los receptores `./setup-rsp1a.sh`, `./setup-fobos.sh`, `./setup-airspyhf.sh` y `./setup-hackrf.sh` — son exactamente los que llama el instalador.

### Compilar a mano (referencia)

> [!IMPORTANT]
> **No necesita esta sección para una instalación normal.** `./install.sh` — o el instalador de su distribución — lo hace todo por usted; véase [Qué hace el instalador](#qué-hace-el-instalador). Lo que sigue es una referencia para una instalación manual, para una distribución que ningún script cubre, o para reparar una pieza a mano.

Por si alguna vez tiene que compilar sin el instalador — una distribución que ningún script cubre, o reparar una compilación a medias:

#### Compilar el backend

```bash
# Clean any previous builds, Configure build with optimization, Compile
rm -rf build
meson setup build --buildtype=release --optimization=3
meson compile -C build

# Verify binary was created
ls -lh build/spectrumserver
```

#### Compilar el frontend

```bash
cd frontend

# Install dependencies, Fix any vulnerabilities, Build the frontend
npm install
npm audit fix
npm run build

# Return to project root
cd ..
```

### Verifique la instalación

```bash
# Check if binary exists
ls -lh build/spectrumserver

# Check if frontend was built
ls -lh frontend/dist/

# List important files
ls -lh *.sh *.toml
```

---

## Instalación del códec de audio Opus

> [!IMPORTANT]
> **No necesita esta sección para una instalación normal.** `./install.sh` — o el instalador de su distribución — lo hace todo por usted; véase [Qué hace el instalador](#qué-hace-el-instalador). Lo que sigue es una referencia para una instalación manual, para una distribución que ningún script cubre, o para reparar una pieza a mano.


Opus ofrece mejor calidad de audio y menor latencia que FLAC.

### 1. Instale la biblioteca de sistema libopus

```bash
sudo apt-get update
sudo apt-get install -y libopus0 libopus-dev
```

### 2. Instale el decodificador Opus para el frontend

```bash
cd PhantomSDR-Plus/frontend

# Install npm dependencies if not already done, Install Opus WASM decoder, Fix any vulnerabilities, Rebuild frontend
npm install
npm install @wasm-audio-decoders/opus-ml
npm audit fix
npm run build

# Return to project root
cd ..
```

### 3. Verifique la instalación de Opus

```bash
# Check if Opus system library is installed
pkg-config --modversion opus

# Check if Opus npm package is installed
cd frontend
npm list @wasm-audio-decoders/opus-ml
cd ..
```

---

## Autorun Spot Reporter (FT8/FT4/WSPR)

PhantomSDR-Plus incluye un **autorun spot reporter** opcional (en el directorio `autorun/`). Decodifica FT8/FT4/WSPR en el servidor, directamente del receptor, y sube los spots a las redes de reporte:

- **FT8 / FT4 → PSK Reporter** (IPFIX/UDP)
- **WSPR → wsprnet.org** (HTTP)

Se controla íntegramente desde la pestaña **panel de administración → «Spot Reporting»**, y **el reporte está DESACTIVADO por defecto**: no se transmite ni se sube nada hasta que lo active ahí. El decodificador se ejecuta como un demonio Node.js aparte y toma el audio del receptor localmente, por lo que no añade hardware de RF adicional.

### Requisitos

| Requisito | Notas |
|-----------|-------|
| **Node.js 22+** | El mismo entorno de ejecución que ya necesita la compilación del frontend; se instala en el [paso de Node.js](#instalación-de-nodejs-y-npm). |
| **Paquetes npm `ws` + `cbor-x`** | Se resuelven a través de `autorun/node_modules`, un enlace simbólico al `node_modules` del frontend (ambos paquetes están declarados en `frontend/package.json`). |
| **`util-linux`** (`taskset`) | El botón «Start» del panel fija el demonio a los E-cores con `taskset`. Está presente en prácticamente todas las distribuciones; los instaladores lo añaden de forma explícita. |
| **Indicativo + localizador** | Se leen de `frontend/site_information.json` (`siteSysop` / `siteGridSquare`) salvo que se sustituyan en la pestaña de administración. Los spots se suben con ese indicativo. |

> ⚠️ **Reporte solo lo que realmente recibe.** Los spots se suben a redes públicas con su indicativo: active únicamente las bandas y modos que su receptor oye de verdad, y use su localizador correcto.

### Instalación automática

`install.sh` (y las variantes por distribución: `install_arch.sh`, `install_fedora.sh`, `install_opensuse.sh`) se encargan de todo: instalan Node.js 22 y `util-linux`, ejecutan el `npm install` del frontend y después crean automáticamente el enlace simbólico `autorun/node_modules`. No hacen falta pasos adicionales: la función está lista en cuanto termina `install.sh`.

### Instalación manual

> [!NOTE]
> El instalador ya hace esto por usted: crea el enlace simbólico e instala `util-linux`. Use los pasos siguientes solo para reparar una instalación a mano.

Si instaló manualmente (opción B), cree usted mismo el enlace simbólico tras el `npm install` del frontend para que el demonio pueda resolver sus dependencias:

```bash
cd ~/PhantomSDR-Plus

# 1. Frontend deps must be installed first (ws + cbor-x live there)
cd frontend && npm install && cd ..

# 2. Link the autorun daemon to the frontend's node_modules
ln -sfn ../frontend/node_modules autorun/node_modules

# 3. Ensure taskset is available (Debian/Ubuntu shown; use your package manager)
sudo apt install -y util-linux
```

> **Nota:** `autorun/node_modules` está excluido por git, así que un `git clone` nuevo nunca lo contiene: el enlace debe (re)crearse después de cada descarga limpia. Los instaladores lo hacen por usted; el comando anterior es solo para instalaciones manuales.

### Comprobación

```bash
# The symlink should point at ../frontend/node_modules
ls -l autorun/node_modules

# ws + cbor-x must resolve
ls -d frontend/node_modules/ws frontend/node_modules/cbor-x

# taskset must be on PATH
command -v taskset
```

Después abra el panel de administración, vaya a la pestaña **Spot Reporting**, indique su identidad, marque las bandas y modos que desea decodificar, active los destinos y pulse **Start**. Aparecerá un distintivo «📶 REPORTING» en la cascada principal mientras el reporte esté activo. (PSK Reporter sube por lotes cada 5 minutos y wsprnet cada 2 minutos, así que un demonio recién iniciado muestra «0 sent» durante los primeros minutos: es normal.)

A partir de ahí se muestran dos contadores distintos, fáciles de confundir. Los paneles **SPOTS UPLOADED PER DECODER** cuentan solo la ejecución actual, de modo que Stop/Start los pone a cero; el número junto a cada casilla de banda/modo es el total **histórico** de esa ranura, guardado en `autorun-totals.json` para que sobreviva a los reinicios. Consulte la [guía del panel de administración](ADMIN_PANEL_SETUP.md) para ambos, y para la página **Gráficos**, que representa la frecuencia de CPU, la carga, la temperatura y los usuarios conectados desde 15 minutos hasta 24 horas.

> **Si su máquina se calienta**, el panel incluye además una [protección térmica](ADMIN_PANEL_SETUP.md#thermal-guard) que detiene el servidor cuando la CPU alcanza una temperatura peligrosa y lo reinicia una vez fría. Deriva sus umbrales del límite crítico de su propia CPU, así que no hay nada que calcular, y funciona con cualquier método de arranque/parada. Se instala con el panel pero arranca en modo de solo registro: anota lo que *habría* hecho y no cambia nada hasta que usted la active en Ajustes. La decodificación continua mantiene la CPU ocupada las 24 horas, así que conviene leer la pestaña CRASH tras una semana de autorun para ver hasta dónde llega realmente su máquina.

> **El puerto del servidor se detecta automáticamente.** El demonio se conecta directamente al `[server] port` del propio spectrumserver (bucle local + token, sin pasar por el proxy). Lee ese puerto del archivo de configuración con el que se lanzó el spectrumserver en ejecución, de modo que funciona en cualquier puerto sin configuración; la línea `[autorun] tap backend: …` de `autorun.log` muestra lo que ha resuelto. Si su servidor no estaba en marcha cuando arrancó el demonio, o si tiene una instalación poco habitual, fíjelo en `autorun.json`:
> ```json
> "server": { "host": "127.0.0.1", "port": 9002 }
> ```
> Un puerto incorrecto se manifiesta como `504` / `tap closed 1006` en `autorun.log`, con `decodes` atascado en 0.

---

## Emulación de clientes KiwiSDR (opcional)

Desde la v4.1.0 PhantomSDR-Plus también puede responder al **protocolo KiwiSDR**, de modo que el software escrito para un KiwiSDR — **AetherSDR**, `kiwiclient` y los demás — se conecta directamente a su receptor, en el mismo host y puerto que ya publica. Está apagado hasta que se añade `[kiwi_emulation] enabled = true` a la configuración con la que arranca su receptor.

El instalador lo ofrece como paso 17; `./kiwi_install.sh` lo aplica a un árbol ya instalado.

> **Documentación completa: [Emulación de clientes KiwiSDR](Aether_config.md)** — qué hace el puente, cómo instalarlo, cada clave de `[kiwi_emulation]`, conectar un cliente, el nivel de audio, el S-meter, la tasa de la cascada y una tabla de síntomas.

---

## Configuración

### 1. Elija su archivo de configuración

Seleccione el archivo de configuración adecuado para su SDR:

- `config-rtl.toml`: llaves RTL-SDR
- `config-rsp1a.toml`: SDRplay RSP1A
- `config-airspyhf.toml`: Airspy HF+ Discovery
- `config-fobos-hf.toml` : RigExpert Fobos SDR, HF1/HF2 en muestreo directo (0-25 MHz)
- `config-fobos.toml` : RigExpert Fobos SDR, rama RF (25-6000 MHz)
- `config-rx888mk2.toml`: RX888 MK2
- `config-hackrf.toml`: HackRF One
- `config.example.hackrf.toml`: HackRF One

En este ejemplo usaremos el RTL-SDR.

### 2. Edite el archivo de configuración

```bash
nano config-rtl.toml
```

#### Ajustes clave

```toml
[server]
port = 9002                      # Web interface port (or everything else)
html_root = "frontend/dist/"     # Frontend location
otherusers = 1                   # Show other users (1=yes, 0=no)
threads = 2                      # Number of server threads

[websdr]
register_online = true           # Register on sdr-list.xyz (true/false)
name = "Your WebSDR Name"        # Display name
antenna = "Your Antenna Type"    # e.g., "Vertical", "Loop", "Dipole"
grid_locator = "AB12cd"          # Your Maidenhead grid square
hostname = "your.domain.com"     # Your domain or IP address

[input]
sps = 2048000                    # Sample rate (adjust for your coverage)
fft_size = 131072                # FFT size (higher = better resolution)
brightness_offset = -10          # Waterfall brightness adjustment
frequency = 145000000            # Base frequency in Hz (145 MHz for 2m)
signal = "iq"                    # "iq" for complex, "real" for real sampling
fft_threads = 2                  # FFT processing threads
accelerator = "opencl"           # "none", "cuda", or "opencl"
audio_sps = 12000                # Audio sample rate (keep at 12000)
audio_compression = "opus"       # "flac" or "opus"
smeter_offset = -2               # S-meter calibration
waterfall_size = 1024            # Waterfall FFT size
waterfall_compression = "zstd"   # Waterfall compression

[input.driver]
name = "stdin"                   # Input driver
format = "u8"                    # Sample format for RTL-SDR

[input.defaults]
frequency = 145500000            # Default tuning frequency
modulation = "FM"                # Default modulation mode
```

#### Orientación sobre la tasa de muestreo

| Cobertura | Tasa de muestreo | Tamaño de FFT |
|-----------|------------------|---------------|
| 2 MHz | 2048000 | 131072 |
| 3.2 MHz | 3200000 | 131072 |
| 10 MHz | 10000000 | 1048576 |
| 30 MHz | 30000000 | 2097152 |
| 60 MHz | 60000000 | 4194304 |

### 3. Configure la información del sitio

```bash
nano frontend/site_information.json
```

Edite los siguientes campos:

```json
{
  "siteSysop": "YourCallsign",
  "siteSysopEmailAddress": "your@email.com",
  "siteGridSquare": "AB12cd",
  "siteCity": "Your City, Country",
  "siteInformation": "https://github.com/sv1btl/PhantomSDR-Plus",
  "siteHardware": "Computer specifications",
  "siteSoftware": "PhantomSDR-Plus v4.2.0",
  "siteReceiver": "Your SDR model",
  "siteAntenna": "Antenna description",
  "siteNote": "Additional information",
  "siteIP": "http://your.domain.com:9002",
  "siteSDRBaseFrequency": 0,
  "siteSDRBandwidth": 2048000,
  "siteRegion": 1,
  "siteChatEnabled": true
}
```

**Regiones de la IARU:**
- **1**: Europa, África, Oriente Medio, norte de Asia
- **2**: América (Norte, Centro y Sur), Caribe
- **3**: Asia-Pacífico, Oceanía

### 4. Personalice los marcadores de frecuencia (opcional)

```bash
nano markers.json
```

Añada sus frecuencias favoritas, repetidores y emisoras de radiodifusión.

### 5. Edite el script de arranque

```bash
nano start-rtl.sh
```

El script de arranque es un lanzador autónomo con watchdog integrado. Edite únicamente el bloque **RECEIVER CONFIGURATION** cerca del principio, para que los argumentos del receptor coincidan con su instalación:

```bash
# ═══ RECEIVER CONFIGURATION (the only receiver-specific part) ═══
RX_LABEL="RTL-SDR"
RX_COMM="rtl_sdr"                       # process name to monitor/kill
CONFIG="$PHANTOMDIR/config-rtl.toml"    # your .toml
FIFO="$PHANTOMDIR/rtl.fifo"
RX_ARGS="${RX_ARGS:--f 145000000 -s 2048000 -}"   # receiver args (edit these)
```

Parámetros dentro de `RX_ARGS`:
- `-f 145000000`: frecuencia central (145 MHz)
- `-s 2048000`: tasa de muestreo (2,048 MSPS)

`CONFIG` apunta a su `.toml`. **No** necesita editar nada más en el script: la lógica de arranque/reinicio/watchdog/registro es genérica. También puede sustituir los argumentos del receptor al lanzarlo sin editar el archivo: `RX_ARGS="-f 145000000 -s 2048000 -" ./start-rtl.sh` (`RX888_ARGS` para `start-rx888mk2.sh`).

---

## Configuración específica por dispositivo SDR

### RTL-SDR

#### Instale las herramientas RTL-SDR

```bash
sudo apt install -y rtl-sdr
```

#### Pruebe el RTL-SDR

```bash
rtl_test
```

Pulse Ctrl+C para detenerlo. Debería ver información sobre la tasa de muestreo.

#### Edite la configuración

```bash
nano config-rtl.toml
```

Ajustes habituales para RTL-SDR:
```toml
sps = 2048000
frequency = 145000000
signal = "iq"
format = "u8"
```

### Receptores sobre SoapySDR (RSP1A, Fobos, Airspy HF+)

El SDRplay RSP1A, el RigExpert Fobos SDR y el Airspy HF+ llegan al servidor de la misma forma: un driver SoapySDR para el dispositivo, y `rx_sdr` (de rx_tools) que pasa sus muestras a `spectrumserver`. Un script por receptor instala la cadena completa:

| Receptor | Script | Opción del instalador | Script de arranque | Configuración |
|---|---|---|---|---|
| SDRplay RSP1A | `./setup-rsp1a.sh` | 3 | `start-rsp1a.sh` | `config-rsp1a.toml` |
| RigExpert Fobos SDR | `./setup-fobos.sh` | 5 | `start-fobos-hf.sh` (HF) / `start-fobos.sh` (RF) | `config-fobos-hf.toml` / `config-fobos.toml` |
| Airspy HF+ | `./setup-airspyhf.sh` | 6 | `start-airspyhf.sh` | `config-airspyhf.toml` |

Cada script:

- instala git, cmake, un compilador, libusb y **SoapySDR** desde los paquetes de su distribución — reconoce apt, dnf, pacman y zypper, así que funciona igual en Debian/Ubuntu, Fedora, Arch y openSUSE;
- compila el driver del receptor desde el código fuente en `sdr_drivers/` (fuera de git);
- compila **rx_tools** para `rx_sdr`, salvo que `rx_sdr` ya esté instalado — una copia sirve a todos los receptores;
- instala una **regla udev** y le añade al grupo `plugdev`, para que el script de arranque nunca necesite `sudo` para el dispositivo. **Cierre la sesión y vuelva a entrar una vez** para que el grupo surta efecto;
- termina comprobando que SoapySDR lista de verdad el driver, y se detiene con un error si no lo hace.

Ejecútelos como su usuario normal — llaman a `sudo` por sí mismos. Son idempotentes: volver a ejecutar uno actualiza las fuentes del driver con `git pull` y recompila. El instalador llama exactamente a estos scripts; en una estación ya instalada, ejecute por separado el de su receptor. La parte común está en `setup-sdr-common.sh`, que no se ejecuta por sí solo. Dos variables opcionales valen para los tres: `SDR_USER=<nombre>` pone otra cuenta en `plugdev`, y `SDR_SKIP_DEPS=1` omite la instalación de paquetes.

Con el dispositivo conectado, compruebe que el receptor se detecta:

```bash
SoapySDRUtil --find="driver=soapyMiri"   # RSP1A
SoapySDRUtil --find="driver=fobos"       # Fobos
SoapySDRUtil --find="driver=airspyhf"    # Airspy HF+
```

#### SDRplay RSP1A

`setup-rsp1a.sh` instala el **driver de código abierto**: libmirisdr-5, el driver obtenido por ingeniería inversa para los chips Mirics MSi2500/MSi001 del RSP1 y el RSP1A, con su módulo SoapySDR SoapyMiri (`driver=soapyMiri`). No necesita ningún servicio en segundo plano ni root. El script además pone en la lista negra los drivers del kernel `msi2500` y `msi001` en `/etc/modprobe.d/blacklist-msi2500.conf`, porque reclaman el RSP1A como radio V4L2 antes de que `rx_sdr` pueda abrirlo. Si el dispositivo estaba conectado mientras estaban cargados, desconéctelo y vuelva a conectarlo una vez (o reinicie).

La API cerrada de SDRplay (`driver=sdrplay`, con SoapySDRPlay y el servicio `sdrplay`) sigue funcionando — el archivo incluido `instructions-for-rsp1a` describe esa instalación. `start-rsp1a.sh` elige entre ambos por sí mismo: si SoapySDR tiene el driver `sdrplay` usa la API y antes reinicia el servicio `sdrplay`; si no, usa libmirisdr-5. Una estación montada sobre la API sigue funcionando sin cambios. Para forzar uno, arranque con `RX_DRIVER=miri` o `RX_DRIVER=sdrplay`. El driver elegido queda escrito en `logwebsdr.txt` como `RSP1A driver: miri` o `RSP1A driver: sdrplay`.

#### RigExpert Fobos SDR

El Fobos entrega **una sola rama a la vez**, así que tiene dos scripts de arranque que comparten el bloqueo del watchdog como cualquier `start-*.sh` — arrancar uno detiene el otro:

- **`start-fobos-hf.sh`** — las entradas HF1/HF2 en muestreo directo, 0-25 MHz, en el puerto 9003. En este modo no hay oscilador local: el ADC digitaliza 0-25 MHz en todo momento (`-f 0` es intencionado, y el aviso *Failed to set center freq* de rx_sdr es de esperar). `rx_sdr` entrega CF32 a 50 Msps; el pequeño conversor `cf32_to_real` (compilado por `setup-fobos.sh` a partir de `cf32_to_real.c`) conserva el canal I y lo escala a s16, por eso `config-fobos-hf.toml` usa `signal="real"` y `format="s16"`.
- **`start-fobos.sh`** — la rama RF, 25-6000 MHz, IQ, en el puerto 9002. Elija la ventana antes del primer arranque: `-f` (centro) y `-s` (frecuencia de muestreo) en la línea `RX_ARGS` deben coincidir con `frequency=` y `sps=` de `config-fobos.toml`. Los valores incluidos (97 MHz, 20 Msps) son solo un punto de partida para comprobar que funciona.

> [!IMPORTANT]
> `config-fobos-hf.toml` viene con `accelerator="opencl"`: un flujo de 50 Msps a través de una FFT de 1M bins pesa tanto como los 60 Msps del RX888, y en la CPU se pierden muestras y la máquina se calienta. En una máquina sin dispositivo OpenCL, `spectrumserver` no arranca con ese ajuste — ponga allí `accelerator="none"`.

SoapyFobosSDR necesita para compilarse las cabeceras de libfobos y de libfobos-sdr-agile, así que `setup-fobos.sh` compila ambas, incluso para el firmware estándar. El soporte del Fobos procede de un script que escribió otra estación tras poner en marcha un Fobos con PhantomSDR-Plus; los valores HF de `config-fobos-hf.toml` son los que funcionaron allí.

#### Airspy HF+

`setup-airspyhf.sh` instala libairspyhf desde la distribución donde está empaquetada (Debian y Ubuntu, Fedora, openSUSE) y la compila desde el código fuente donde no lo está (Arch la tiene solo en el AUR); después compila SoapyAirspyHF (`driver=airspyhf`). `start-airspyhf.sh` entrega 912 ksps IQ en CS16, que `config-airspyhf.toml` lee como `format="s16"`. El archivo incluido `instructions-for-airspy` describe el camino manual.

### RX888 MK2

#### Instale las herramientas RX888

```bash
# Install rx_tools
git clone https://github.com/rxseger/rx_tools.git
cd rx_tools
mkdir build && cd build
cmake ..
make -j4
sudo make install
sudo ldconfig

# Install RX888 firmware and support
# Follow manufacturer instructions
```

#### Ejecutar rx888_stream sin sudo (reglas udev)

Por defecto, el dispositivo USB Cypress FX3 del RX-888 solo es accesible para root, de modo que `rx888_stream` necesitaría `sudo`. Ejecute una vez el asistente incluido para instalar las reglas udev y añadirse al grupo `plugdev`:

```bash
./setup-rx888-udev.sh          # re-runs itself with sudo automatically
```

Escribe `/etc/udev/rules.d/99-rx888.rules` para los tres identificadores de producto Cypress FX3 (`04b4:00f1`/`00f3` gestor de arranque y `04b4:8613` con el firmware cargado), recarga udev y crea un enlace estable `/dev/rx888`. **Cierre la sesión y vuelva a entrar** (por el cambio de grupo) y **reconecte el dispositivo** una vez; después, `rx888_stream` —y el lanzador `start-rx888mk2.sh`— funcionan sin `sudo`. Es idempotente, así que puede volver a ejecutarlo sin problema. Para configurar otra cuenta: `RX888_USER=<nombre> ./setup-rx888-udev.sh`.

#### Edite la configuración

```bash
nano config-rx888mk2.toml
```

Ajustes habituales para el RX888:
```toml
sps = 60000000
frequency = 0
signal = "real"
format = "s16"
fft_size = 4194304
```

### HackRF One

Para el HackRF no se compila nada: `hackrf_transfer`, del paquete `hackrf` de su distribución, pasa las muestras directamente a `spectrumserver`. `./setup-hackrf.sh` (opción 7 del instalador) instala ese paquete con apt, dnf, pacman o zypper y añade una regla udev y el grupo `plugdev`, para que `start-hackrf.sh` funcione sin `sudo` — cierre la sesión y vuelva a entrar una vez después.

```bash
./setup-hackrf.sh    # installs the hackrf package and the udev rule
hackrf_info          # with the HackRF plugged in: must list the board
```

`start-hackrf.sh` entrega una ventana cada vez. Elíjala antes del primer arranque: `-f` (centro) y `-s` (frecuencia de muestreo) en su línea `RX_ARGS` deben coincidir con `frequency=` y `sps=` de `config-hackrf.toml`. `-l` y `-g` son las ganancias del LNA (0-40 dB, pasos de 8 dB) y del VGA (0-62 dB, pasos de 2 dB), y `-a 1` enciende el amplificador de RF. Los valores incluidos (98 MHz, 20 Msps) son solo un punto de partida para comprobar que funciona.

`hackrf_transfer` escribe IQ de 8 bits **con signo**, así que la configuración necesita `format="s8"`. `config.example.hackrf.toml` decía `u8` hasta septiembre de 2026; con `u8` cada muestra está desplazada en 128 y la cascada solo muestra ruido — revise cualquier copia antigua.

---

## Pruebas y verificación

### 1. Prueba de arranque

```bash
# For RTL-SDR
./start-rtl.sh
```

Esto inicia el servidor **en segundo plano** (se desvincula y devuelve el control de inmediato) y empieza a registrar en `logwebsdr.txt`.

### 2. Compruebe si hay errores

El script registra su progreso en `logwebsdr.txt`; obsérvelo en directo:

```bash
tail -f logwebsdr.txt
```

Busque:
- ✅ `Starting the initialization script of the PhantomSDR Server`
- ✅ `<receiver> running (PID …)`
- ✅ `Server started normally`
- ❌ `Server … FAILED …` o `ERROR: receiver binary '…' not found` (corrija los argumentos del receptor o el `.toml`, o instale la herramienta del receptor, y vuelva a ejecutar el script)

### 3. Acceda a la interfaz web

Abra el navegador en:
```
http://localhost:9002
```

(Sustituya el número de puerto por el que haya configurado)

### 4. Verifique el funcionamiento

- La cascada debe mostrarse
- El audio debe sonar al hacer clic en las señales
- El S-metro debe responder a las señales
- El contador de usuarios debe mostrar «1»

### 5. Pruebe desde otro dispositivo

Desde otro ordenador de su red:
```
http://YOUR_SERVER_IP:9002
```

### 6. Compruebe el uso de recursos

```bash
# Monitor CPU usage
htop

# Monitor GPU usage (if OpenCL/CUDA enabled)
nvidia-smi  # For NVIDIA
radeontop   # For AMD

# Monitor network usage
iftop
```

### 7. Detenga el servidor

El servidor se ejecuta en segundo plano bajo un watchdog, así que **Ctrl+C no lo detendrá** (y el watchdog volvería a arrancarlo). Use el script de parada compartido, que sirve para cualquier receptor: primero detiene el watchdog y después el receptor y `spectrumserver`:

```bash
./stop-websdr.sh
```

---

## Configuración del arranque automático

### Con systemd (recomendado)

#### 1. Cree el archivo de servicio

```bash
sudo nano /etc/systemd/system/phantomsdr.service
```

Añada el siguiente contenido (ajuste rutas y usuario):

```ini
[Unit]
Description=PhantomSDR-Plus WebSDR Server
After=network.target

[Service]
Type=simple
User=youruser
WorkingDirectory=/home/youruser/PhantomSDR-Plus
# Run the watchdog in the FOREGROUND (note the --watchdog flag) so systemd can
# track it. Do NOT use the plain "./start-rtl.sh" here — that form detaches into
# the background and exits, which systemd would treat as the service stopping.
ExecStart=/home/youruser/PhantomSDR-Plus/start-rtl.sh --watchdog
ExecStop=/home/youruser/PhantomSDR-Plus/stop-websdr.sh
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

> El proceso `--watchdog` ya reinicia por su cuenta el receptor y `spectrumserver`; `Restart=always` es solo una red de seguridad para el caso raro de que el propio watchdog termine. Como aquí systemd supervisa el servidor, puede usar `systemctl start/stop/restart` y `journalctl -u phantomsdr -f` en lugar de ejecutar los scripts a mano.

#### 2. Active e inicie el servicio

```bash
# Reload systemd
sudo systemctl daemon-reload

# Enable service to start on boot
sudo systemctl enable phantomsdr.service

# Start service now
sudo systemctl start phantomsdr.service

# Check status
sudo systemctl status phantomsdr.service
```

#### 3. Gestione el servicio

```bash
# Start
sudo systemctl start phantomsdr

# Stop
sudo systemctl stop phantomsdr

# Restart
sudo systemctl restart phantomsdr

# View logs
sudo journalctl -u phantomsdr -f
```

### Con Screen (alternativa)

> Normalmente innecesario: `./start-rtl.sh` ya se desvincula al segundo plano (mediante `setsid`) y sigue funcionando después de cerrar la sesión, con su propio watchdog. Screen solo resulta útil si quiere específicamente una sesión interactiva para ejecutar la forma en primer plano `./start-rtl.sh --watchdog`.

#### 1. Instale Screen

```bash
sudo apt install -y screen
```

#### 2. Arranque en una sesión de Screen

```bash
screen -S phantomsdr
./start-rtl.sh
```

Pulse Ctrl+A y después D para desvincularse.

#### 3. Vuelva a la sesión

```bash
screen -r phantomsdr
```

---

## Protección térmica de la CPU

> 📖 **Manual completo: [THERMAL_GUARD.md](THERMAL_GUARD.md)** — los cuatro modos y qué debe hacer el sysop en cada uno, funcionamiento sin el panel, la fase throttle sin root, pruebas y resolución de problemas.

PhantomSDR-Plus incluye un guardián que detiene el servidor si la CPU alcanza una temperatura peligrosa y lo vuelve a arrancar una vez fría. Deriva sus umbrales del límite crítico que publica su propia CPU, así que no hay nada que calcular, y funciona con cualquier método de arranque/parada.

**Si usa el panel de administración, ya lo tiene**: se ejecuta dentro del panel y se configura en su página de Ajustes. Véase la [guía del panel de administración](ADMIN_PANEL_SETUP.md#thermal-guard). El resto de esta sección es para instalaciones **sin** panel.

### 1. Compruebe qué ve el guardián en su máquina

```bash
cd ~/PhantomSDR-Plus
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

Solo se usan sensores reales del die de la CPU (`coretemp`, `k10temp`, `zenpower`, `cpu_thermal`); `acpitz` y las zonas térmicas sin etiquetar se ignoran a propósito, porque a menudo informan de una temperatura de caja o placa decenas de grados por debajo de la CPU. Si aparece `sensor : NONE`, esa máquina no puede protegerse —habitual en un VPS o dentro de un contenedor— y el guardián permanecerá inactivo en lugar de fingir.

No hay nada que instalar: `thermal_guard.py` solo usa la biblioteca estándar de Python.

### 2. Configúrelo

El guardián lee `admin_config.json` junto a `thermal_guard.py`. Créelo si no lo tiene: sin el panel no lo tendrá. El archivo mínimo útil:

```json
{
  "sdr_process_name": "spectrumserver",
  "stop_script":  "stop-websdr.sh",
  "start_script": "start-rx888mk2.sh",
  "thermal_mode": "stop+restart"
}
```

- `thermal_mode` — `log` (solo registrar, el valor por defecto), `throttle`, `stop` o `stop+restart`. **Este es el que debe fijar**, porque el guardián se entrega inerte: tal cual, solo anota lo que *habría* hecho. También puede pasarlo en la línea de órdenes como `--mode stop+restart`, que prevalece sobre el archivo: si le valen todos los demás valores por defecto, no necesita archivo de configuración alguno.
- `stop_script` / `start_script` — cómo detiene y arranca su servidor. Sin script de parada recurre a `SIGTERM` y, tras 10 segundos, a `SIGKILL` sobre `sdr_process_name`. Sin script de arranque detiene pero nunca reinicia.
- Los umbrales y tiempos también pueden ponerse aquí, con los mismos nombres de clave que usa el panel; la tabla completa está en la [guía del panel de administración](ADMIN_PANEL_SETUP.md#thermal-guard).

> **Si systemd supervisa su servidor SDR**, haga que `stop_script` apunte a un pequeño script que ejecute `systemctl stop su-unidad`, en lugar de dejar que el guardián señale el proceso directamente. El guardián ganará de todos modos —mientras la CPU esté demasiado caliente repite la parada cada 2 segundos, de modo que cualquier cosa que reviva el servidor queda deshecha—, pero una parada limpia es mejor que una pelea cada dos segundos.

### 3. Ejecútelo como servicio

El repositorio incluye una unidad lista, `thermal-guard.service`. Edite en ella `User=` y las dos rutas, y después:

```bash
sudo cp thermal-guard.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now thermal-guard
systemctl status thermal-guard
```

`User=` debe ser una cuenta autorizada a ejecutar sus scripts de arranque/parada, normalmente el mismo usuario que ejecuta el servidor SDR. **Un guardián que se ejecuta como un usuario que no puede detener el servidor le deja desprotegido mientras aparenta protegerle.**

Para armar el guardián desde la unidad en lugar del archivo de configuración, añada `--mode` a `ExecStart`:

```ini
ExecStart=/usr/bin/python3 -u /home/sysop/PhantomSDR-Plus/thermal_guard.py --mode stop+restart
```

Sin systemd:

```bash
cd ~/PhantomSDR-Plus
nohup python3 -u thermal_guard.py --mode stop+restart >> thermal.log 2>&1 &
```

`python3 thermal_guard.py --help` enumera todas las opciones, incluida `--config` para un archivo de configuración que no esté junto al script.

### 4. Obsérvelo y después confíe en él

Todo lo que hace el guardián se escribe en `crash.log`, en el directorio de PhantomSDR-Plus, un evento por línea:

```
[THERMAL] warn: 89.0C (warn=88.0 crit=100.0) sustained 31s
[THERMAL] STOPPED server: 96.0C sustained 62s (stop=95.0 crit=100.0) — Started stop-websdr.sh
[THERMAL] lockout: process reappeared at 94.0C — re-stopped [3 time(s) so far]
[THERMAL] recovered: 74.0C held below 75.0 — lockout cleared
```

```bash
grep THERMAL crash.log
```

Deje `thermal_mode` en `"log"` durante una semana y lea ese archivo después de sus momentos duros: una recompilación completa, una tarde calurosa. Si no aparece nada, su máquina nunca se acercó. Después ponga el modo en `stop`.

Antes de confiar en él, compruebe todo el recorrido una vez añadiendo una lectura falsa por encima de su umbral de parada:

```json
"thermal_test_temp": 97
```

El guardián la trata como real, así que warn → stop → bloqueo → recuperación → reinicio se ejecutan cuando usted quiera. Quite la línea (o póngala en `null`) para volver al sensor real. Con el modo en `stop` esto detiene de verdad el servidor y desconecta a sus oyentes, así que hágalo cuando no haya nadie, o pruebe en `log`, donde se ve lo que *habría* pasado sin tocar nada.

---

## Resolución de problemas

### Errores de compilación

#### Problemas de dependencias

```bash
# Ubuntu: Install missing dependencies
sudo apt install --fix-broken

# Fedora: Install missing dependencies
sudo dnf install <package-name>
```

#### Falla la configuración de Meson

```bash
# Clean and reconfigure
rm -rf build
meson setup build --buildtype=release
```

#### `meson setup` termina con `ModuleNotFoundError: No module named 'mesonbuild'`

```
Traceback (most recent call last):
  File "/home/<user>/.local/bin/meson", line 3, in <module>
    from mesonbuild.mesonmain import main
ModuleNotFoundError: No module named 'mesonbuild'
```

El árbol de fuentes no tiene ningún problema. Una instalación antigua con
`pip install --user meson` dejó un script de arranque en `~/.local/bin`, que en el
`PATH` va antes que `/usr/bin` y oculta la copia que instaló el gestor de paquetes.
Una actualización de la distribución (por ejemplo Ubuntu 24.04 → 26.04) cambia Python a una versión nueva, el antiguo `site-packages` que contenía `mesonbuild` ya no está en la ruta de importación, y el script muere antes de hacer nada. Lo mismo le puede ocurrir a `ninja`.

El instalador lo detecta y lo esquiva durante la ejecución, avisándole, pero repare el sistema:

```bash
rm -f ~/.local/bin/meson
hash -r
meson --version        # debe imprimir una versión
```

Si prefiere conservar meson instalado con pip, reinstálelo para el Python que tiene ahora este sistema:

```bash
python3 -m pip install --user --force-reinstall --break-system-packages meson
```

#### `meson setup` se detiene con `Clock skew detected`

```
ERROR: Clock skew detected. File /home/pi/PhantomSDR-Plus/build/../meson.build has a time stamp 10392.2144s in the future.
```

El árbol de fuentes no tiene ningún problema: es el reloj del sistema el que va por detrás de los archivos. meson y ninja se niegan a compilar cuando una entrada es más reciente que la hora actual, porque no pueden saber qué está obsoleto. Ocurre en una Raspberry Pi sin pila en su soporte RTC — cada arranque parte de la última hora conocida, y una compilación lanzada antes de que NTP se sincronice ve todo el árbol fechado en el futuro — y en cualquier árbol descomprimido o copiado desde una máquina adelantada.

Corrija primero el reloj:

```bash
timedatectl                       # ¿la hora es correcta? ¿NTP está sincronizado?
sudo timedatectl set-ntp true
```

Espere unos segundos y vuelva a ejecutar el instalador. Comprueba esto antes de llamar a meson y ofrece restablecer las marcas de tiempo afectadas (`PHANTOM_FIX_CLOCK_SKEW=y|n`). A mano, desde el árbol de fuentes:

```bash
find . -path ./build -prune -o -path ./.git -prune -o -newermt now -print0 | xargs -0r touch
```

#### El backend se compiló pero no hay página web

El síntoma es una instalación que parece casi lograda: `build/spectrumserver` existe, el servidor arranca y el navegador no recibe nada — porque `frontend/dist/` nunca se generó. Busque en la salida del instalador:

```
[vite-plugin-top-level-await] missing field `type`
    at Compiler.printSync (node_modules/@swc/core/index.js:257:29)
error during build:
   ❌ Failed: Default
```

`vite-plugin-top-level-await` pide `@swc/core` `^1.12.14`, así que un `npm install` limpio resuelve a 1.16.0, cuyo `printSync()` rechaza el árbol sintáctico que le entrega el complemento. No tiene nada que ver con su distribución: todos los instaladores fijan ahora la versión que funciona, y `frontend/package.json` también. Una máquina instalada antes de esa fijación sigue funcionando hasta que se borre su `node_modules`, y por eso esto aparece de la nada en una reinstalación.

Si está reparando a mano una copia más antigua:

```bash
cd frontend
npm pkg set 'overrides.@swc/core=1.15.33'
npm install
./build-all.sh
```

### Errores en ejecución

#### El puerto ya está en uso

```bash
# Find process using port
sudo lsof -i :9002

# Kill process
sudo kill -9 <PID>
```

#### Permiso denegado para el SDR

```bash
# Add user to plugdev group
sudo usermod -a -G plugdev $USER

# Reload groups (or log out and back in)
newgrp plugdev
```

Para un **RX-888 MkII** esto no basta por sí solo: el dispositivo Cypress FX3 necesita además reglas udev. Ejecute el asistente incluido (instala las reglas *y* le añade a `plugdev`), después cierre la sesión, vuelva a entrar y reconecte el dispositivo:

```bash
./setup-rx888-udev.sh
```

#### Problemas de audio

```bash
# Try different codec
# Edit config file and change:
audio_compression = "flac"  # or "opus"

# Rebuild
cd frontend && npm run build && cd ..
```

### Problemas con OpenCL

#### clinfo no muestra dispositivos

```bash
# Verify drivers are loaded
sudo clinfo

# Check OpenCL ICD files
ls /etc/OpenCL/vendors/

# Reinstall drivers (Intel example)
sudo apt remove --purge intel-opencl-icd
sudo apt install intel-opencl-icd
```

#### El rendimiento no mejora

```bash
# Verify OpenCL is enabled in config
accelerator = "opencl"

# Try different device
# Add to config file:
[input.opencl]
device_id = 0  # Try 0, 1, 2, etc.
```

### Problemas de red

#### No se puede acceder desde otros dispositivos

```bash
# Check firewall
sudo ufw status
sudo ufw allow 9002/tcp

# Or disable firewall temporarily for testing
sudo ufw disable
```

#### Latencia alta

```bash
# Reduce waterfall size in config
waterfall_size = 512

# Increase buffer size
buffer_size = 16384

# Use Opus instead of FLAC
audio_compression = "opus"
```

### Problemas con el dispositivo SDR

#### No se encuentra el RTL-SDR

```bash
# Check if device is recognized
lsusb | grep Realtek

# Test with rtl_test
rtl_test

# Try blacklisting DVB-T drivers
echo "blacklist dvb_usb_rtl28xxu" | sudo tee /etc/modprobe.d/blacklist-rtl.conf
sudo rmmod dvb_usb_rtl28xxu
```

#### No se encuentra el SDRplay

`grep "RSP1A driver" logwebsdr.txt` muestra qué driver eligió `start-rsp1a.sh`.

Con el driver abierto (libmirisdr-5, `RSP1A driver: miri`):

```bash
# The kernel's msi2500 driver must not hold the device
lsmod | grep msi2500 && sudo modprobe -r msi2500 msi001

# Test with SoapySDR
SoapySDRUtil --find="driver=soapyMiri"
```

Con la API de SDRplay (`RSP1A driver: sdrplay`):

```bash
# Check API installation
systemctl status sdrplay

# Restart API
sudo systemctl restart sdrplay

# Test with SoapySDR
SoapySDRUtil --find="driver=sdrplay"
```

#### No se encuentra el Fobos o el Airspy HF+

```bash
SoapySDRUtil --info | grep -i factories   # must list fobos / airspyhf
SoapySDRUtil --find="driver=fobos"         # or driver=airspyhf
id | grep plugdev                          # log out and back in if missing
```

Si el driver falta en la lista, vuelva a ejecutar `./setup-fobos.sh` o `./setup-airspyhf.sh`: se detiene indicando el motivo si falla la compilación o la comprobación de SoapySDR.

---

## Optimización del rendimiento

### Optimización de la CPU

```toml
# Adjust thread counts based on CPU cores
[server]
threads = 4  # Set to number of cores

[input]
fft_threads = 4  # Set to number of cores
```

### Optimización de la memoria

```toml
# Reduce memory usage
[input]
waterfall_size = 512  # Lower value = less memory
fft_size = 65536      # Lower value = less memory
```

### Optimización de la red

```toml
# Optimize for limited bandwidth
[input]
audio_compression = "opus"  # More efficient than FLAC
waterfall_compression = "zstd"  # Efficient compression
```

---

## Actualización de PhantomSDR-Plus

Desde la versión 4.1.0 el repositorio incluye **`update.sh`**, una herramienta que pone al día una instalación con el árbol publicado **sin tocar los archivos que la hacen ser su estación**. Sustituye al script `git pull` que las ediciones anteriores de esta guía le pedían escribir, y no necesita git en absoluto: el árbol publicado se descarga como tarball y se compara con el suyo archivo por archivo, de modo que funciona igual tanto si clonó el repositorio como si descomprimió un `update.zip` o copió el árbol desde una memoria USB.

### Si su instalación aún no tiene update.sh

Un árbol antiguo no contiene el script. Descárguelo una vez: es el único paso de todo este procedimiento que hará a mano:

```bash
cd ~/PhantomSDR-Plus
curl -fLO https://raw.githubusercontent.com/sv1btl/PhantomSDR-Plus/main/update.sh
chmod +x update.sh
```

A partir de ahí todo — código, frontend, documentación, instaladores y el propio
`update.sh` — llega a través de la herramienta.

### Paso 1 — ver qué cambiaría (no escribe nada)

```bash
cd ~/PhantomSDR-Plus
./update.sh
```

Descarga el árbol publicado, lo compara con el suyo e imprime un informe. No escribe absolutamente nada, así que puede ejecutarlo en cualquier momento, incluso con el receptor en el aire. El código de salida es `0` si ya está al día y `10` si hay una actualización esperando, de forma que una tarea de cron puede avisarle cuando haya algo que hacer.

### Paso 2 — aplicarla

```bash
./update.sh --apply
```

Hay tres clases de archivo y se tratan de forma distinta; esa diferencia es lo esencial:

| Archivos | Qué ocurre |
|---|---|
| `config*.toml`, `markers.json`, `admin_config.json`, `autorun.json`, `frequencylist/`, `chat_history.txt`, `frontend/variant.json`, `frontend/site_information.json`, los registros, `build/`, `frontend/dist/` | **Nunca se tocan** ni aparecen en ninguna pregunta. Son los que hacen que la máquina sea *su* receptor. |
| `start-*.sh`, `stop-websdr.sh`, las unidades `*.service`, `install*.sh`, `recompile.sh`, `setup_admin.sh`, `smeter_theme.sh`, `proxy.py`, `admin_server.py`, `thermal_guard.py`, `frontend/src/bands-config.js` | **Siempre se pregunta**, porque son los archivos que un sysop tiene motivos para haber modificado. |
| Todo lo demás | Se actualiza, tras guardar una copia del archivo antiguo en `.update-backups/`. |

Para cada archivo del grupo intermedio se muestran las diferencias y se ofrecen tres opciones:

```
  ❓ start-rx888mk2.sh  [K]eep mine / [u]pstream / [b]oth  (ENTER = Keep mine)
```

* **Keep mine** — su archivo se deja exactamente como está.
* **upstream** — se instala la versión nueva, después de respaldar la suya.
* **both** — la versión nueva se escribe junto a la suya como `start-rx888mk2.sh.new`, para que
incorpore sus propios cambios cuando quiera.

**Cómo es la primera ejecución.** La primera vez no hay registro de qué versión tenían sus
archivos, así que se le presenta cada archivo del grupo intermedio: unas diez preguntas. Respóndalas así:

| Su situación | Respuesta |
|---|---|
| Nunca tocó ese archivo | `u` — tome la versión nueva. El caso habitual. |
| Lo modificó (sus `RX888_ARGS`, fijación de CPU, una unidad ajustada) | `b` — se conserva el suyo y el nuevo queda al lado como `<archivo>.new`. |
| No está seguro | ENTER — se conserva el suyo, no se pierde nada y podrá comparar después. |

Su configuración nunca entra en esto: las preguntas son siempre sobre scripts y unidades de servicio.

`update.sh` anota en `.update-state/` la versión de cada archivo que instala. Por eso, a partir
de la segunda ejecución distingue un archivo que **usted** editó de otro que simplemente es antiguo, y sólo se detiene a preguntar por los que realmente tocó.

Antes de escribir nada detiene el receptor, el panel de administración y el proxy inverso **de la instalación que está actualizando**: lo que sirve a otro directorio se enumera y se deja en marcha, de modo que un segundo clon puede actualizarse mientras el primero sigue en el aire. Al terminar vuelve a arrancar exactamente lo que detuvo. Si han cambiado archivos de código o del frontend, le ofrece ejecutar `recompile.sh`. Nunca borra nada: los archivos que han desaparecido del repositorio se comunican y sólo se eliminan si lo pide con `--prune`.

### Deshacer una actualización

```bash
./update.sh --restore LAST
```

Cada archivo sobrescrito queda en `.update-backups/<marca de tiempo>/` con su propio
`restore.sh`; se conservan las tres últimas ejecuciones.

### Otras opciones

```bash
./update.sh --apply --yes     # no pregunta nunca; TODO lo que usted editó se CONSERVA
./update.sh --ref v4.1.0      # una etiqueta, rama o commit en lugar del árbol actual
./update.sh --list-excludes   # imprime las reglas de "no tocar" tal como se aplican aquí
./update.sh --verbose         # lista todos los archivos, no sólo los 40 primeros
```

Puede añadir sus propias reglas de "no tocar" escribiendo un patrón por línea en
`update-exclude.txt`, en la carpeta raíz de la instalación.

### Si la reconstrucción falla en una instalación muy antigua

`update.sh` actualiza archivos, no paquetes del sistema. Si su árbol es tan antiguo que la
compilación necesita bibliotecas que no tiene, `recompile.sh` se detendrá con un error del compilador o de meson. No es una actualización rota: faltan las dependencias:

```bash
./install.sh
```

El instalador se actualiza en la misma ejecución, y su configuración también sobrevive a él.

### Actualizar a mano

Si prefiere aplicar usted mismo un paquete de archivos:

```bash
cd ~
unzip -o update.zip
cd PhantomSDR-Plus
./stop-websdr.sh
cp -a ~/update/. .
chmod +x *.sh
./recompile.sh
./start-rx888mk2.sh          # o el script de arranque de su receptor
```

Haga antes una copia de su configuración — `config-*.toml`, `frontend/site_information.json`,
`admin_config.json` y `markers.json` —, porque un paquete de archivos no puede distinguir sus
cambios de los de la versión publicada. Ese es justamente el problema que `update.sh` resuelve.

---

## Copia de seguridad y restauración

### Archivos que conviene respaldar

- Archivos de configuración: `*.toml`
- Información del sitio: `frontend/site_information.json`
- Marcadores: `markers.json`
- Scripts personalizados: `start-*.sh`, `stop-*.sh`
- Historial del chat: `chat_history.txt`
- Imagen de fondo: `frontend/src/assets/background.jpg`

### Comando de copia de seguridad

```bash
cd ~/PhantomSDR-Plus
tar -czf phantomsdr-backup-$(date +%Y%m%d).tar.gz \
  *.toml \
  *.sh \
  markers.json \
  chat_history.txt \
  frontend/site_information.json \
  frontend/src/assets/background.jpg
```

### Comando de restauración

```bash
tar -xzf phantomsdr-backup-YYYYMMDD.tar.gz
```

---

## Consideraciones de seguridad

### Configuración del cortafuegos

```bash
# Allow only necessary ports
sudo ufw allow 9002/tcp
sudo ufw enable
```

### Proxy inverso (opcional)

Considere usar nginx o Apache como proxy inverso para:
- cifrado SSL/TLS
- asignación de nombre de dominio
- equilibrio de carga
- control de acceso

### Límite de usuarios

Edite `config.toml`:
```toml
[server]
max_users = 100  # Limit concurrent users
```

---

## Cómo obtener ayuda

### Recursos

- **Documentación**: esta guía, README.md, USER_GUIDE.md
- **GitHub Issues**: https://github.com/sv1btl/PhantomSDR-Plus/issues
- **Demostración en directo**: http://phantomsdr.no-ip.org:8900/

### Cómo informar de problemas

Al informar de un problema, incluya:
1. sistema operativo y versión
2. modelo del dispositivo SDR
3. contenido del archivo de configuración
4. mensajes de error
5. uso de recursos del sistema (CPU, RAM, GPU)

### Soporte de la comunidad

- Consulte las incidencias existentes en GitHub antes de crear otras nuevas
- Aporte información detallada sobre su instalación
- Incluya registros y mensajes de error
- Sea paciente y respetuoso

---

## Apéndice A: lista completa de dependencias

### Lista de paquetes de Ubuntu 24.04

```
build-essential
cmake
pkg-config
meson
libfftw3-dev
libwebsocketpp-dev
libflac++-dev
zlib1g-dev
libzstd-dev
libboost-all-dev
libopus-dev
libliquid-dev
git
util-linux (taskset — for the autorun spot reporter)
psmisc
wget
curl
rtl-sdr (for RTL-SDR)
airspy (for Airspy)
hackrf (for HackRF)
libclfft-dev (for OpenCL)
ocl-icd-opencl-dev (for OpenCL)
clinfo (for OpenCL)
```

---

## Apéndice B: ejemplos de configuración

### Ejemplo 1: RTL-SDR para VHF/UHF

```toml
[input]
sps = 2048000
frequency = 145000000
signal = "iq"

[input.driver]
format = "u8"

[input.defaults]
frequency = 145500000
modulation = "FM"
```

### Ejemplo 2: RX-888 mk2 para HF (0-30 MHz)

El receptor que usa la mayoría de los sysops. Esta es una sección `[input]` completa, no un fragmento, con los valores del `config-rx888mk2.toml` que acompaña al repositorio.

```toml
[input]
sps = 60000000            # 0-30 MHz por muestreo directo
fft_size = 4194304        # vea la nota de abajo
fft_threads = 8
brightness_offset = -9    # más negativo si la cascada muestra zonas negras
frequency = 0             # banda base: el RX-888 muestrea desde DC
signal = "real"           # no "iq": el muestreo directo da una señal real
accelerator = "opencl"    # "none" si no hay entorno OpenCL
audio_sps = 12000
audio_compression = "flac"
waterfall_size = 1024
waterfall_compression = "zstd"
smeter_offset = 5
analog_smeter_offset = 5

[input.driver]
name = "stdin"
format = "s16"

[input.defaults]
frequency = 7120000
modulation = "LSB"
```

Se alimenta desde `rx888_stream`, cosa que `start-rx888mk2.sh` hace por usted:

```bash
rx888_stream -f /path/to/SDDC_FX3.img -s 60000000 -g 50 -a 0 -m low --pga -d -r -o - \
  | build/spectrumserver --config config-rx888mk2.toml
```

**Sobre `fft_size`:** a 60 MSPS el tamaño adecuado es 4194304. 8388608 duplica la resolución de la cascada y con ella la memoria y el coste de CPU de cada transformada, lo que en la mayoría de las máquinas compra bins más finos a cambio de fotogramas perdidos. Empiece en 4194304 y suba solo si el servidor va sobrado.

### Ejemplo 3: HackRF para FM de banda ancha

```toml
[input]
sps = 10000000
frequency = 100900000
signal = "iq"

[input.driver]
format = "s8"

[input.defaults]
frequency = 100900000
modulation = "WBFM"
```

---

**¡Instalación completada! Ya debería tener un servidor PhantomSDR-Plus plenamente funcional.**

**73 de SV1BTL & SV2AMK**
