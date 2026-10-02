# RADE v1 — Guía de instalación manual
### Todo Linux — Ubuntu / Debian / Fedora / Arch / Raspberry Pi OS · PhantomSDR-Plus

> **Requisito previo:** los archivos parcheados (`rade_helper.py`, `rade.sh`, `audio.js`, `App.svelte`) ya están colocados en el árbol de directorios de PhantomSDR-Plus. Esta guía construye todo lo demás a su alrededor.

> [!IMPORTANT]
> **No necesita esta guía para una instalación normal.** `./install_rade.sh`, en la carpeta de PhantomSDR-Plus, hace por usted todos los pasos siguientes — paquetes del sistema, módulos de Python, la compilación de radae, la comprobación de los pesos del modelo y el arranque del sidecar — y funciona igual en sistemas apt, pacman, dnf y zypper. `./install.sh` y los cuatro instaladores por distribución ofrecen ejecutarlo como parte de la instalación normal. Siga esta guía solo para una instalación manual, para un sistema que el script no cubre, o para reparar un paso a mano.

> **Usuarios de Raspberry Pi:** esta también es su guía. Raspberry Pi OS es Debian, así que siga los bloques de Debian en todo el documento y lea las notas **Raspberry Pi / Bookworm** allí donde aparezcan: cubren las dos cosas que cambian en una Pi, la PEP 668 y la rueda de torch solo para CPU.

---

## Paso 1 — Paquetes del sistema

Elija el bloque que corresponda a su distribución.

### Ubuntu / Debian / Raspberry Pi OS

```bash
sudo apt update
sudo apt install -y \
    build-essential cmake git \
    python3 python3-pip \
    nodejs npm \
    alsa-utils
```

### Fedora / RHEL / Rocky

```bash
sudo dnf install -y \
    gcc gcc-c++ cmake git \
    python3 python3-pip \
    nodejs npm \
    alsa-utils
```

### Arch / Manjaro

```bash
sudo pacman -Sy --needed \
    base-devel cmake git \
    python python-pip \
    nodejs npm \
    alsa-utils
```

### Comprobación de la versión de Node.js (todas las distribuciones)

La compilación del frontend de RADE requiere Node.js 22 o posterior:

```bash
node --version
```

Si es inferior a 22.x, instálelo con `nvm` (cualquier distribución, sin root):

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.4/install.sh | bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm install 22 && nvm use 22 && nvm alias default 22
```

> **No use NodeSource.** `deb.nodesource.com` y `rpm.nodesource.com` responden ahora con HTTP 403 en todas las rutas del repositorio, por lo que la antigua línea `curl -fsSL https://deb.nodesource.com/setup_NN.x | sudo -E bash -` ya no funciona; además, en Debian/Ubuntu deja una fuente apt que rompe todos los `apt update` posteriores. Por eso los scripts de instalación usan `nvm`.

---

## Paso 2 — Paquetes de Python

### Ubuntu 24.04 y anteriores / Fedora / Arch

En estos sistemas funciona un `pip3 install` normal:

```bash
pip3 install websockets matplotlib numpy scipy

# torch — CPU-only build (~150–250 MB, avoids the ~3 GB CUDA wheel)
# Use this if the server has no GPU, which is the typical case for a WebSDR
pip3 install torch --index-url https://download.pytorch.org/whl/cpu
```

> Si su servidor **sí** tiene una GPU NVIDIA con CUDA instalado, puede omitir `--index-url` para obtener la compilación completa con CUDA. Para RADE no supone ninguna ventaja de rendimiento: `radae_rxe.py` usa PyTorch solo para operaciones matriciales en CPU.

### Ubuntu 23.04+ / Debian Bookworm+ / Raspberry Pi OS (sistemas con PEP 668)

Estas distribuciones bloquean el `pip3 install` sin más. Añada la opción:

```bash
# All packages except torch
pip3 install --break-system-packages websockets matplotlib numpy scipy

# torch — CPU-only build
pip3 install --break-system-packages torch \
    --index-url https://download.pytorch.org/whl/cpu
```

> **Raspberry Pi / Bookworm: dos reglas que muerden:**
>
> 1. Cada `pip3 install` requiere `--break-system-packages` (aplicación de la
> PEP 668). Sin él, la instalación se bloquea por completo.
> 2. Un simple `pip3 install torch` descarga la rueda de CUDA (~3 GB).
> En una Pi no hay CUDA: use el índice solo para CPU y obtendrá la rueda ARM64 ligera (~150 MB).

Como alternativa, use un entorno virtual y evite por completo esa opción:

```bash
python3 -m venv ~/rade-venv
source ~/rade-venv/bin/activate
pip install websockets matplotlib numpy scipy torch \
    --index-url https://download.pytorch.org/whl/cpu
```

> Si usa un venv, anteponga `source ~/rade-venv/bin/activate` a todas las llamadas `python3` posteriores de esta guía, o use la ruta completa `~/rade-venv/bin/python3`.

### Verificación

```bash
python3 -c "import websockets, matplotlib, torch, numpy, scipy; print('All OK')"
```

Salida esperada:
```
All OK
```

---

## Paso 3 — Clonar y compilar el repositorio radae

El decodificador RADE vive en un repositorio distinto al de codec2. `freedv_rx` de codec2 **no** admite RADE v1.

```bash
# Remove any previous incomplete clone
rm -rf ~/radae

# Clone
git clone https://github.com/drowe67/radae.git ~/radae
cd ~/radae

# Build
mkdir build && cd build
cmake ..
make -j$(nproc)
```

### Compruebe que se compiló lpcnet_demo

```bash
ls -la ~/radae/build/src/lpcnet_demo
```

Esperado: el binario está presente y es ejecutable.

### Compruebe que están los pesos del modelo

```bash
ls ~/radae/model19_check3/checkpoints/checkpoint_epoch_100.pth
```

Esperado: aparece el archivo `.pth`. Los pesos vienen incluidos en el repositorio; no hace falta descargarlos aparte.

---

## Paso 4 — Verificar la cadena de decodificación

Este paso confirma que toda la cadena sin conexión funciona antes de conectarla al navegador. Ejecútelo desde `~/radae`:

```bash
cd ~/radae
```

### 4a — Generar una señal de prueba codificada en RADE

```bash
./inference.sh model19_check3/checkpoints/checkpoint_epoch_100.pth \
    wav/brian_g8sez.wav /dev/null \
    --rate_Fs --pilots --pilot_eq --eq_ls --cp 0.004 \
    --write_rx rx.f32 --auxdata
```

Espere a que termine. Las últimas líneas impresas deberían ser:
```
loss: 0.741 Auxdata BER: 0.012
```

### 4b — Decodificar y reproducir

```bash
cat rx.f32 \
    | python3 radae_rxe.py \
        --model_name model19_check3/checkpoints/checkpoint_epoch_100.pth \
    | ./build/src/lpcnet_demo -fargan-synthesis - - \
    | aplay -f S16_LE -r 16000
```

Debería oír una voz. La salida muestra la adquisición del sincronismo:
```
  1 state: search     ...
  5 state: sync       ... SNRdB:  4.03 uw_err: 0
Playing raw data 'stdin' : Signed 16 bit Little Endian, Rate 16000 Hz, Mono
```

> **Los mensajes `underrun!!!` durante esta prueba son esperables e inocuos.** Se deben a que `radae_rxe.py` procesa más despacio que la E/S de archivos. No aparecen en recepción en directo: el navegador suministra el audio a tasa de tiempo real.

### 4c — Comprobar que el sidecar arranca correctamente

```bash
python3 ~/PhantomSDR-Plus/rade_helper.py
```

Salida esperada (sin líneas WARNING):
```
[RADE] helper starting on ws://0.0.0.0:8074
[RADE] radae_rx.py    : /home/<user>/radae/radae_rxe.py
[RADE] model          : /home/<user>/radae/model19_check3/checkpoints/checkpoint_epoch_100.pth
[RADE] lpcnet_demo    : /home/<user>/radae/build/src/lpcnet_demo
[RADE] auxdata        : ON (default)
[RADE] torch threads  : 1 per instance (RADE_TORCH_THREADS to override)
[RADE] architecture   : per-connection (each user tunes independently)
[RADE] listening — waiting for PhantomSDR-Plus clients
```

Pulse **Ctrl+C** para detenerlo.

> `<user>` en las rutas anteriores es la cuenta con la que ha iniciado sesión; en una imagen estándar de Raspberry Pi OS quedan como `/home/pi/radae/...`.

---

## Paso 5 — Compilar el frontend de PhantomSDR-Plus

```bash
cd ~/PhantomSDR-Plus/frontend

# Only if node_modules is missing:
npm install

cd ~/PhantomSDR-Plus
./recompile.sh
```

Esté atento a errores del analizador Vite/acorn. Los archivos parcheados evitan deliberadamente `?.`, `??` y los `catch {}` vacíos, para cumplir la restricción de acorn.

---

## Paso 6 — Control del sidecar

**Normalmente no necesita un script de control aparte para RADE.** Los scripts de arranque (`start-rx888mk2.sh`, `start-airspyhf.sh`, `start-rtl.sh`, `start-rsp1a.sh`, `start-fobos-hf.sh`, `start-fobos.sh`, `start-hackrf.sh`) arrancan el sidecar por sí mismos en cuanto el servidor está en marcha, lo reinician si termina e informan de su estado; `stop-websdr.sh` lo detiene junto con el servidor. Pase directamente al Paso 7.

`rade.sh` sigue incluyéndose para uso autónomo: ejecutar el sidecar sin el lanzador de PhantomSDR-Plus, o probarlo por separado. Sus órdenes, su registro y las advertencias sobre el vigilante están en [Control del sidecar](RADE_README.md#control-del-sidecar).
---

## Paso 7 — Abrir el puerto 8074

El sidecar escucha en el puerto TCP **8074**. El navegador se conecta directamente a ese puerto. Debe abrirlo manualmente.

### ufw (Ubuntu / Debian / Raspberry Pi OS)

```bash
sudo ufw allow 8074/tcp && sudo ufw reload
```

### firewalld (Fedora / RHEL / Rocky)

```bash
sudo firewall-cmd --add-port=8074/tcp --permanent
sudo firewall-cmd --reload
```

### iptables (cualquier distribución, permanente)

```bash
sudo iptables -I INPUT -p tcp --dport 8074 -j ACCEPT

# Ubuntu / Debian / Raspberry Pi OS — persist across reboots:
sudo apt install iptables-persistent
sudo netfilter-persistent save

# Fedora / RHEL — persist:
sudo service iptables save
```

### Router

Añada una regla de NAT/redirección de puertos: **TCP 8074 → IP LAN del servidor : 8074**

### Prueba desde el exterior

Use **https://portchecker.co** y compruebe el puerto 8074 contra su nombre de host público. **No** lo pruebe con `curl` desde el propio servidor: el NAT hairpin da falsos «Connection refused» aunque el puerto esté abierto.

### Alternativa — proxy Nginx (si el ISP bloquea el puerto 8074)

Añada dentro de su bloque `server {}` existente:

```nginx
location /rade {
    proxy_pass         http://127.0.0.1:8074;
    proxy_http_version 1.1;
    proxy_set_header   Upgrade    $http_upgrade;
    proxy_set_header   Connection "upgrade";
    proxy_set_header   Host       $host;
    proxy_read_timeout 3600s;
}
```

```bash
sudo nginx -t && sudo nginx -s reload
```

Después edite `audio.js` dentro de `setRADEDecoding()`:

```js
// Change:
var helperUri = uri || ('ws://' + window.location.hostname + ':8074');
// To:
var helperUri = uri || ('ws://' + window.location.host + '/rade');
```

Vuelva a compilar el frontend tras este cambio (`./recompile.sh`).

---

## Paso 8 — Arrancar el servidor

Inicie PhantomSDR-Plus como de costumbre. RADE **no** se inicia automáticamente:

```bash
cd ~/PhantomSDR-Plus
./start-rx888mk2.sh      # or start-airspyhf.sh,
                         # start-rtl.sh, start-rsp1a.sh,
                         # start-fobos-hf.sh, start-fobos.sh,
                         # start-hackrf.sh
```

Use el lanzador que corresponda a su receptor. Cada uno incluye su propio watchdog y registro; `./stop-websdr.sh` detiene el que esté en marcha.

---

## Paso 9 — Arrancar RADE

```bash
cd ~/PhantomSDR-Plus
./rade.sh start
./rade.sh status
tail -f rade.log
```

Registro esperado:
```
[RADE] sidecar starting at ...
[RADE] helper starting on ws://0.0.0.0:8074
[RADE] radae_rx.py    : /home/<user>/radae/radae_rxe.py
[RADE] model          : /home/<user>/radae/model19_check3/checkpoints/checkpoint_epoch_100.pth
[RADE] lpcnet_demo    : /home/<user>/radae/build/src/lpcnet_demo
[RADE] auxdata        : ON (default)
[RADE] torch threads  : 1 per instance
[RADE] architecture   : per-connection (each user tunes independently)
[RADE] listening — waiting for PhantomSDR-Plus clients
```

---

## Paso 10 — Usar RADE en el navegador

1. Abra su interfaz web de PhantomSDR-Plus
2. Busque estaciones activas en **https://qso.freedv.org**
3. Sintonice la frecuencia de dial de la estación
4. En **Decoder Options**, seleccione:
   - **RADE v1 — RADEL (LSB)** para 40 m / 80 m / 160 m (≤ 10 MHz)
   - **RADE v1 — RADEU (USB)** para 20 m / 17 m / 15 m / 12 m / 10 m (> 10 MHz)
5. Haga clic en **Decoder: ON**

Los pasos 4 y 5 pueden sustituirse por una sola pulsación: los botones **RADEL** / **RADEU** están junto al encabezado **Modes selector** y dentro de las ventanas emergentes **Modes** y **Bands**. Una pulsación selecciona el decodificador, lo pone en ON y desplaza el panel de RADE hasta hacerlo visible; púlselo de nuevo para detener RADE. Consulte el [manual de RADE](RADE_README.md).

| Indicador | Significado |
|---|---|
| 🔴 Rojo — «Connecting to sidecar…» | Puerto 8074 inalcanzable o sidecar detenido |
| 🟡 Amarillo — «Searching for signal…» | Sidecar conectado, aún sin trama RADE detectada (deje ~1,5 s) |
| 🟢 Verde — «Synced · SNR x.x dB» | Decodificando: se está reproduciendo la voz |

---

## Nota sobre la CPU

Cada usuario de RADE consume alrededor del 8-10 % de un núcleo (el sidecar limita el número de hilos de PyTorch a 1). Si oye cortes de audio, suba a 2 hilos:

```bash
RADE_TORCH_THREADS=2 ./rade.sh restart
```

| Usuarios simultáneos | CPU aproximada |
|---|---|
| 1 | ~9 % |
| 5 | ~45 % |
| 10 | ~90 % |
| 20 | ~180 % |

> Estas cifras se midieron en x86_64. Una Raspberry Pi decodifica RADE sin problemas, pero el coste por usuario es mayor y la tabla anterior no es trasladable: mida su propia placa con `top` mientras un usuario está sincronizado antes de anunciar un límite de usuarios.

---

## Actualizar RADE en el futuro

```bash
cd ~/radae
git pull
cmake -S . -B build && make -C build -j$(nproc)

cd ~/PhantomSDR-Plus
./rade.sh restart
```

No hace falta recompilar el frontend ni reiniciar el servidor salvo que haya cambiado el propio `rade_helper.py`.

---

*Probado en Ubuntu 24.04 (x86_64) y Raspberry Pi 4 / Raspberry Pi OS Bookworm (ARM64, Python 3.11).* *Fork de PhantomSDR-Plus: sv1btl/PhantomSDR-Plus.* *RADE desarrollado por David Rowe VK5DGR y el equipo de FreeDV — https://freedv.org*
