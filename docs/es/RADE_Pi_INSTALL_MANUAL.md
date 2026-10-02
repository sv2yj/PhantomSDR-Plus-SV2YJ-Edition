# RADE v1 — Guía de instalación manual
### Raspberry Pi / Debian Bookworm (ARM64) · PhantomSDR-Plus

> **Requisito previo:** los archivos parcheados (`rade_helper.py`, `rade.sh`, `audio.js`, `App.svelte`) ya están colocados en el árbol de directorios de PhantomSDR-Plus. Esta guía construye todo lo demás a su alrededor.

> [!IMPORTANT]
> **Pruebe primero el script.** `./install_rade.sh`, en la carpeta de PhantomSDR-Plus, hace por usted todos los pasos siguientes y el propio `./install.sh` ofrece ejecutarlo durante la instalación normal. Esta guía está aquí para hacerlo a mano y para los detalles propios de la Pi (PEP 668 y la rueda de torch solo para CPU) si el script se atasca en su placa.

---

## Paso 1 — Paquetes del sistema

```bash
sudo apt update
sudo apt install -y \
    build-essential cmake git \
    python3 python3-pip \
    nodejs npm \
    alsa-utils
```

---

## Paso 2 — Paquetes de Python

> **Importante: dos reglas propias de Debian Bookworm:**
>
> 1. Cada `pip3 install` requiere `--break-system-packages` (aplicación de la
> PEP 668). Sin él, la instalación se bloquea por completo.
> 2. Un simple `pip3 install torch` descarga la rueda de CUDA (~3 GB).
> En una Pi no hay CUDA: use el índice solo para CPU y obtendrá la rueda ARM64 ligera (~150 MB).

```bash
# All packages except torch
pip3 install --break-system-packages websockets matplotlib numpy scipy

# torch — CPU-only build (~150 MB, no CUDA)
pip3 install --break-system-packages torch \
    --index-url https://download.pytorch.org/whl/cpu
```

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

> **Los mensajes `underrun!!!` durante esta prueba son esperables e inocuos.** `radae_rxe.py` procesa más despacio que la E/S de archivos. No aparecen en recepción en directo porque el navegador suministra el audio a tasa de tiempo real.

### 4c — Comprobar que el sidecar arranca correctamente

```bash
python3 ~/PhantomSDR-Plus/rade_helper.py
```

Salida esperada (sin líneas WARNING):
```
[RADE] helper starting on ws://0.0.0.0:8074
[RADE] radae_rx.py    : /home/pi/radae/radae_rxe.py
[RADE] model          : /home/pi/radae/model19_check3/checkpoints/checkpoint_epoch_100.pth
[RADE] lpcnet_demo    : /home/pi/radae/build/src/lpcnet_demo
[RADE] auxdata        : ON (default)
[RADE] torch threads  : 1 per instance (RADE_TORCH_THREADS to override)
[RADE] architecture   : per-connection (each user tunes independently)
[RADE] listening — waiting for PhantomSDR-Plus clients
```

Pulse **Ctrl+C** para detenerlo.

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

## Paso 6 — Script de control rade.sh

```bash
chmod +x ~/PhantomSDR-Plus/rade.sh
```

Órdenes disponibles:

```bash
cd ~/PhantomSDR-Plus
./rade.sh start      # start sidecar with self-restarting watchdog
./rade.sh stop       # stop sidecar + watchdog + all lpcnet_demo children
./rade.sh restart    # stop then start cleanly
./rade.sh status     # show running / stopped + process info
```

> **Use siempre `./rade.sh stop`**: un simple `pkill -f rade_helper.py` no podrá con el watchdog, que vuelve a lanzar el proceso en 3 segundos.

---

## Paso 7 — Abrir el puerto 8074

El sidecar escucha en el puerto TCP **8074**. El navegador se conecta directamente a ese puerto. Debe abrirlo manualmente:

### Cortafuegos — ufw

```bash
sudo ufw allow 8074/tcp && sudo ufw reload
```

### Cortafuegos — iptables

```bash
sudo iptables -I INPUT -p tcp --dport 8074 -j ACCEPT

# Make permanent across reboots:
sudo apt install iptables-persistent
sudo netfilter-persistent save
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

Vuelva a compilar el frontend tras este cambio.

---

## Paso 8 — Arrancar el servidor

Inicie PhantomSDR-Plus como de costumbre. RADE **no** se inicia automáticamente:

```bash
cd ~/PhantomSDR-Plus
./start-rx888mk2.sh      # or start-airspyhf.sh,
                         # start-rtl.sh, start-rsp1a.sh
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
[RADE] radae_rx.py    : /home/pi/radae/radae_rxe.py
[RADE] model          : /home/pi/radae/model19_check3/checkpoints/checkpoint_epoch_100.pth
[RADE] lpcnet_demo    : /home/pi/radae/build/src/lpcnet_demo
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

*Probado en Raspberry Pi 4 / ARM64, Debian Bookworm, Python 3.11.* *Fork de PhantomSDR-Plus: sv1btl/PhantomSDR-Plus.* *RADE desarrollado por David Rowe VK5DGR y el equipo de FreeDV — https://freedv.org*
