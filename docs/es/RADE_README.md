# Voz digital RADE v1 para PhantomSDR-Plus

**RADE** (Radio AutoencoDEr) es el modo estrella de voz digital en HF de FreeDV. Utiliza un híbrido de aprendizaje automático y DSP (el vocoder neuronal FARGAN) para ofrecer voz de alta calidad por HF con relaciones señal/ruido de hasta −2 dB, en apenas 1500 Hz de ancho de banda de RF: más estrecho que una señal de BLU.

Este documento cubre la integración completa de la recepción de RADE v1 en PhantomSDR-Plus, implementada como un proceso sidecar de Python (`rade_helper.py`) que conecta el navegador con la cadena de decodificación `radae_rxe.py` + `lpcnet_demo`.

## La instalación — la vía rápida

```bash
cd ~/PhantomSDR-Plus
./install_rade.sh
```

Esa es toda la instalación. El script instala los paquetes del sistema con el gestor de paquetes que tenga la máquina (apt, pacman, dnf o zypper), recurre a pip para lo que una distribución no incluya, actualiza `websockets` si la versión de la distribución es anterior a la 11.0 que necesita el sidecar, clona y compila radae, comprueba los pesos del modelo, recompila el frontend y arranca el sidecar. En Ubuntu 22.04 pasa el testigo a `install_rade_ubuntu22.sh`. `./install.sh` ofrece ejecutarlo como parte de la instalación normal de PhantomSDR-Plus, así que en una máquina nueva RADE ya está.

**Este documento explica cómo funciona RADE y cómo hacerlo funcionar; no es el procedimiento de instalación.** Si necesita instalarlo a mano, en un sistema que el script no cubre o para reparar un paso, siga la guía enlazada más abajo: los pasos están escritos allí y solo allí. Todo lo que hay aquí — la arquitectura, los archivos parcheados, el puerto, el uso de RADE en el navegador, las variables de entorno, la resolución de problemas y la medición de concurrencia — se aplica a cualquier instalación, sea como fuere que se hizo.

- **[Instalación manual en Linux](RADE_General_INSTALL_MANUAL_LINUX.md)** - la vía manual, paso a paso, para Ubuntu, Debian, Fedora, Arch y Raspberry Pi OS

---

## Índice

1. [La instalación — la vía rápida](#la-instalación--la-vía-rápida)
2. [Cómo funciona](#cómo-funciona)
3. [Descripción de la arquitectura](#descripción-de-la-arquitectura)
4. [RADEL frente a RADEU](#radel-frente-a-radeu)
5. [Requisitos previos](#requisitos-previos)
6. [Instalación a mano](#instalación-a-mano)
7. [Desplegar los archivos parcheados](#desplegar-los-archivos-parcheados)
8. [Control del sidecar](#control-del-sidecar)
9. [El puerto 8074](#el-puerto-8074)
10. [Usar RADE en el navegador](#usar-rade-en-el-navegador)
11. [Verificación y depuración](#verificación-y-depuración)
12. [Variables de entorno](#variables-de-entorno)
13. [Archivos modificados](#archivos-modificados)
14. [Resumen del flujo de señal](#resumen-del-flujo-de-señal)
15. [Resolución de problemas](#resolución-de-problemas)
16. [Medir la concurrencia en su propio hardware](#medir-la-concurrencia-en-su-propio-hardware)
17. [Actualizar RADE v1](#actualizar-rade-v1)

---

## Cómo funciona

RADE v1 no puede ejecutarse en el navegador: necesita PyTorch y el vocoder neuronal FARGAN, demasiado grandes para WASM. La solución es un proceso sidecar de Python (`rade_helper.py`) que se ejecuta en el mismo servidor que PhantomSDR-Plus.

> **Importante:** `freedv_rx` del repositorio codec2 **no** admite RADEV1. La cadena de decodificación de RADE reside por completo en el repositorio independiente `radae` de David Rowe (VK5DGR). No intente usar `freedv_rx` de codec2 para RADE.

Cuando selecciona RADE en el navegador:

1. El frontend fija la demodulación subyacente en USB o LSB: el servidor en C++ demodula la señal BLU con normalidad.
2. El PCM demodulado sin procesar se toma en `audio.js` **antes** de cualquier silenciado o puerta de squelch: `radae_rxe.py` necesita una entrada continua para mantener el sincronismo de trama.
3. Cada bloque de PCM se rellena con ceros para pasar de f32 real a f32 complejo (real + 0.0 imaginario): eso es lo que `radae_rxe.py` espera en su entrada estándar.
4. El sidecar canaliza esas muestras hacia `radae_rxe.py`, que produce características de vocoder.
5. `lpcnet_demo -fargan-synthesis` convierte las características en voz s16 a 16000 Hz.
6. El sidecar convierte s16 → f32 y lo devuelve al navegador en tramas binarias de WebSocket.
7. El navegador reproduce la voz decodificada mediante la Web Audio API a 16000 Hz.

El servidor en C++ (`spectrumserver.cpp`) no se modifica en absoluto.

---

## Descripción de la arquitectura

```
┌────────────────────────────────────────────────────────────────────┐
│  Browser                                                           │
│                                                                    │
│  Decoder → "RADE v1 — RADEL (LSB)" / "RADEU (USB)"               │
│       │                                                            │
│  audio.js ── demod cmd (LSB/USB) ──────────► C++ spectrumserver   │
│       │                                              │             │
│       │  raw SSB PCM @ audioOutputSps ◄─────────────┘             │
│       │  (tapped before mute gate, zero-padded to complex f32)     │
│       │                                                            │
│       │  binary WebSocket ──► ws://host:8074                       │
│       ▼                                                            │
├────────────────────────────────────────────────────────────────────┤
│  rade_helper.py  (port 8074)                                       │
│                                                                    │
│  resample to 8000 Hz if needed                                     │
│  zero-pad real f32 → complex f32 pairs                             │
│       │ stdin pipe                                                  │
│       ▼                                                            │
│  radae_rxe.py  --model_name model19_check3/.../checkpoint_100.pth  │
│       │ stdout pipe (vocoder features f32)                         │
│       ▼                                                            │
│  lpcnet_demo  -fargan-synthesis  -  -                              │
│       │ stdout (s16 PCM @ 16000 Hz)                                │
│       │ converted → f32 by sidecar                                 │
│       │ binary WebSocket frames ──► browser                        │
│       ▼                                                            │
├────────────────────────────────────────────────────────────────────┤
│  Browser                                                           │
│                                                                    │
│  _radePlayPCM() → AudioContext.createBuffer(16000 Hz) → speaker   │
└────────────────────────────────────────────────────────────────────┘
```

---

## RADEL frente a RADEU

RADE v1 siempre se transmite por BLU. Por convención:

| Modo  | Banda lateral | Usar en las bandas                       |
|-------|---------------|------------------------------------------|
| RADEL | LSB           | 160 m, 80 m, 40 m  (≤ 10 MHz)           |
| RADEU | USB           | 20 m, 17 m, 15 m, 12 m, 10 m (> 10 MHz) |

---

## Requisitos previos

| Requisito | Versión | Notas |
|---|---|---|
| PhantomSDR-Plus | cualquiera | con frontend Vite/Svelte |
| Linux | Ubuntu 24.04+ / Debian Bookworm+ | probado |
| Python | 3.8+ | para `rade_helper.py` y `radae_rxe.py` |
| repositorio radae | último master | aporta `radae_rxe.py` y `lpcnet_demo` |
| cmake | 3.10+ | para compilar `lpcnet_demo` desde radae |
| PyTorch | 2.0+ | lo requiere `radae_rxe.py` |
| Node.js | 16+ | para `npm run build` |
| websockets (Python) | 10–16+ | `pip3 install websockets` — todas las versiones admitidas |
| matplotlib | cualquiera | lo requiere `radae_rxe.py` al importarse |
| numpy | 1.23+ | obligatorio; también habilita el remuestreo |
| scipy | cualquiera | opcional, habilita un remuestreo preciso |

---

## Instalación a mano

`./install_rade.sh` hace la instalación completa. Cuando quiera hacerla usted mismo — en un sistema que el script no cubre, o para reparar un paso — el procedimiento está en la **[Guía de instalación manual de RADE v1](RADE_General_INSTALL_MANUAL_LINUX.md)**, y solo allí. Cubre Ubuntu, Debian, Fedora, Arch y Raspberry Pi OS de una sola pasada:

| | |
|---|---|
| Paso 1 | Paquetes del sistema y la comprobación de Node.js 22+ |
| Paso 2 | Paquetes de Python, con la opción de la PEP 668 y la rueda de torch solo para CPU |
| Paso 3 | Clonar y compilar el repositorio radae, verificar `lpcnet_demo` y los pesos del modelo |
| Paso 4 | Verificar la cadena de decodificación sin conexión, antes de conectarla al navegador |
| Paso 5 | Compilar el frontend de PhantomSDR-Plus |
| Paso 6 | Control del sidecar |
| Paso 7 | Abrir el puerto 8074 |
| Pasos 8–10 | Arrancar el servidor, verificar RADE y usarlo en el navegador |

El resto de este documento da eso por hecho.

---

## Desplegar los archivos parcheados

Copie los siguientes archivos del conjunto de parches a su repositorio de PhantomSDR-Plus.

### Archivo nuevo — colóquelo en la raíz del repositorio, junto al script de arranque que use:

```
rade_helper.py
```

### Archivos parcheados del frontend — colóquelos en `frontend/src/`:

```
audio.js
App.svelte
```

### Qué hacen los parches

**`audio.js`** — 5 cambios:
- Constructor: 5 campos de estado nuevos para RADE (`decodeRADE`, `_radeSideband`, `_radeSocket`, `_radeCallback`, `_radeReady`, `_radeNextTime`)
- Guardado del PCM previo al realce: `pcmArrayPreBoost` se guarda antes del realce de 300× de FLAC para que RADE reciba la amplitud original (el realce saturaría `radae_rxe.py`)
- `playAudio()`: toma del PCM para RADE usando el audio previo al realce, antes de la puerta de silencio/squelch
- `playAudio()`: guarda `if (this.decodeRADE) return`, que suprime la reproducción del BLU sin procesar mientras suena la voz decodificada por RADE
- Métodos nuevos: `setRADEDecoding()`, `setRADECallback()`, `_radePlayPCM()` con reproducción programada y sin huecos mediante el reloj `_radeNextTime` (reproduce a **16000 Hz**, la tasa de salida de `lpcnet_demo`)

**Cada variante de Svelte** — 6 cambios:
- `demodulationDefaults`: RADEL `{type:'LSB', offsets:[2200,-700]}`, RADEU `{type:'USB', offsets:[-700,2200]}`: el paso de banda empieza a 700 Hz de la portadora y mide 1500 Hz
- Variables de estado: `radeEnabled`, `radeConnected`, `radeSynced`, `radeSnr`, `_radeDeactivate()`
- `_radeDeactivate()`: detiene el decodificador y **restaura el modo por defecto de la banda** desde `bands-config.js`, con un comportamiento idéntico a la desactivación de FAX, NAVTEX y FSK
- `_deactivateAll()`: línea de limpieza de RADE
- `activateSelectedDecoder()`: ramas `radel` y `radeu`
- Desplegable de decodificadores: dos entradas `<option>` nuevas
- Panel de estado: punto de conexión, estado de sincronismo/SNR, cartel de error

### Scripts de arranque

Los lanzadores del receptor (`start-rx888mk2.sh`, `start-airspyhf.sh`, `start-rtl.sh`, `start-rsp1a.sh`, `start-fobos-hf.sh`, `start-fobos.sh`, `start-hackrf.sh`) arrancan el sidecar por sí mismos en cuanto el servidor está en marcha, y `stop-websdr.sh` lo detiene junto con el servidor. `rade.sh` se mantiene para ejecutar el sidecar de forma autónoma: consulte [Control del sidecar](#control-del-sidecar).

---

## Control del sidecar

**Normalmente no necesita un script de control aparte para RADE.** Los lanzadores del receptor (`start-rx888mk2.sh`, `start-airspyhf.sh`, `start-rtl.sh`, `start-rsp1a.sh`, `start-fobos-hf.sh`, `start-fobos.sh`, `start-hackrf.sh`) arrancan el sidecar por sí mismos en cuanto se confirma que el servidor está en marcha, lo reinician si termina e informan de su estado en el resumen final — `✔ RADE sidecar running`, o una nota `·` que explica por qué no se activó (no instalado, `RADE_ENABLED=0`, o sin `python3`). `./stop-websdr.sh` lo detiene junto con el servidor. Para ejecutar el servidor sin RADE, arránquelo con `RADE_ENABLED=0`.

`rade.sh` se mantiene para uso autónomo: ejecutar el sidecar sin el lanzador de PhantomSDR-Plus, o probarlo por separado:

```bash
chmod +x ~/PhantomSDR-Plus/rade.sh
cd ~/PhantomSDR-Plus
./rade.sh start      # start sidecar with self-restarting watchdog
./rade.sh stop       # stop sidecar + watchdog + all lpcnet_demo children
./rade.sh restart    # stop then start cleanly
./rade.sh status     # show running / stopped + process info
```

La actividad del sidecar se registra en `~/PhantomSDR-Plus/rade.log`:

```bash
tail -f ~/PhantomSDR-Plus/rade.log
```

> **No mezcle ambos con el servidor en marcha.** Si el vigilante de un lanzador está activo, devolverá el sidecar en unos cinco segundos, de modo que `./rade.sh stop` parecerá haber fallado. Para detener RADE con el servidor en marcha, arranque el servidor con `RADE_ENABLED=0` o detenga todo con `./stop-websdr.sh`.

> Si ejecuta `rade.sh` de forma autónoma, **use siempre `./rade.sh stop`**: un simple `pkill -f rade_helper.py` no vence a su propio vigilante, que reengendra el proceso en 3 segundos.

---

## El puerto 8074

El sidecar escucha en el puerto TCP **8074** y el navegador se conecta directamente a él, así que el puerto tiene que ser accesible desde fuera. Cómo abrirlo — ufw, firewalld, iptables, la regla NAT del router y el proxy de Nginx para cuando un proveedor bloquea el puerto por completo — es el [Paso 7 de la guía manual](RADE_General_INSTALL_MANUAL_LINUX.md).

Dos cosas merecen repetirse aquí, porque son las que más tiempo cuestan:

```bash
# Is the sidecar listening?
ss -tlnp | grep 8074
```

> **Aviso sobre el NAT hairpin:** probar con `curl` desde el propio servidor contra su nombre público suele devolver `Connection refused` incluso con el puerto abierto, porque muchos routers no devuelven el tráfico. Pruebe siempre desde una máquina externa, o use **https://portchecker.co**.

---

## Usar RADE en el navegador

1. Abra su interfaz web de PhantomSDR-Plus
2. Busque estaciones activas en **[qso.freedv.org](https://qso.freedv.org)**
3. Sintonice la frecuencia de dial de la estación
4. En **Decoder Options**, seleccione:
   - **RADE v1 — RADEL (LSB)** para 40 m / 80 m / 160 m
   - **RADE v1 — RADEU (USB)** para 20 m / 17 m / 15 m / 12 m / 10 m
5. Haga clic en **Decoder: ON**

### Los botones RADEL / RADEU (una pulsación)

Los pasos 4 y 5 pueden sustituirse por una sola pulsación. Hay un par de botones **RADEL** / **RADEU** en tres lugares:

- junto al encabezado **Modes selector** del panel principal;
- dentro de la ventana emergente **Modes**;
- dentro de la ventana emergente **Bands**.

Al pulsar uno de ellos se selecciona el decodificador, se pone el decodificador en ON, se cierra la ventana emergente desde la que se pulsó y el panel de RADE se desplaza hasta quedar visible. El botón se pone azul mientras RADE funciona. **Pulse el mismo botón otra vez para detener RADE**: el panel se cierra y el modo y el paso de banda vuelven a su valor tal como se describe más abajo. Los botones, el desplegable **Decoder Options** y el botón ON/OFF comparten el mismo estado.

### Estados del indicador del panel

| Indicador | Significado |
|---|---|
| 🔴 Rojo — «Connecting to sidecar…» | Puerto 8074 inalcanzable o sidecar detenido |
| 🟡 Amarillo — «Searching for signal…» | Sidecar conectado, aún sin trama RADE detectada |
| 🟢 Verde — «Synced · SNR x.x dB» | Decodificando: se está reproduciendo la voz |

### Cuando desactiva el decodificador

El modo y el paso de banda vuelven automáticamente al valor correcto por defecto para la frecuencia actual, según se define en `bands-config.js`, igual que con FAX, NAVTEX y FSK.

---

## Verificación y depuración

### ¿Está funcionando el sidecar?

```bash
ps aux | grep rade_helper | grep -v grep
ss -tlnp | grep 8074
```

### Observar la actividad en directo

```bash
tail -f ~/PhantomSDR-Plus/rade.log
```

Cuando se conecta un navegador:
```
[RADE] client connected: x.x.x.x:XXXXX
[RADE] x.x.x.x:XXXXX  sps=12000 sideband=LSB
[RADE] x.x.x.x:XXXXX spawning pipeline (torch_threads=1)
```

### Prueba rápida del WebSocket

```bash
python3 - << 'EOF'
import asyncio, websockets, json

async def test():
    async with websockets.connect('ws://localhost:8074') as ws:
        await ws.send(json.dumps({'type': 'init', 'sps': 8000, 'sideband': 'LSB'}))
        print(await ws.recv())   # expect: {"type": "status", "connected": true}

asyncio.run(test())
EOF
```

### Consola del navegador (F12)

```
[RADE] ▶ ENABLED LSB @ 12000 Hz → helper ws://localhost:8074
```
Bien: el WebSocket se ha abierto. El valor en Hz coincide con el `audioOutputSps` de su servidor (normalmente 8000-12000 Hz).

```
[RADE] sidecar socket error
```
El puerto 8074 es inalcanzable: revise el cortafuegos y la regla NAT del router.

---

## Variables de entorno

| Variable | Por defecto | Descripción |
|---|---|---|
| `RADE_HELPER_PORT` | `8074` | Puerto TCP en el que escucha el sidecar |
| `RADE_HELPER_HOST` | `0.0.0.0` | Dirección de enlace (`127.0.0.1` si está tras un proxy) |
| `RADAE_DIR` | `~/radae` | Raíz del repositorio radae |
| `RADE_MODEL` | `RADAE_DIR/model19_check3/checkpoints/checkpoint_epoch_100.pth` | Pesos del modelo |
| `LPCNET_DEMO` | `RADAE_DIR/build/src/lpcnet_demo` | Binario lpcnet_demo |
| `RADE_AUXDATA` | `1` | Póngalo a `0` para pasar `--noauxdata` a `radae_rxe.py` |
| `RADE_TORCH_THREADS` | `1` | Hilos de PyTorch/OpenBLAS por instancia de `radae_rxe.py`: limita el uso de CPU |
| `RADE_PIN_CORES` | `1` | Fija cada cadena de decodificación a su propio conjunto de núcleos; `0` desactiva la fijación |
| `RADE_CORES_PER_CLIENT` | `2` | Núcleos asignados por cliente cuando la fijación está activa |

---

## Archivos modificados

| Archivo | Tipo | Notas |
|---|---|---|
| `rade_helper.py` | **Nuevo** | Sidecar de Python: servidor WebSocket + cadena de decodificación de dos procesos |
| `frontend/src/audio.js` | Modificado | 4 parches |
| `frontend/src/App.svelte` | Modificado | 6 parches |
| `rade.sh` | **Nuevo** | Script de control del sidecar RADE para uso autónomo (start/stop/restart/status) |
| `start-rx888mk2.sh` | Modificado | arranca, vigila e informa del sidecar; igual que `start-airspyhf.sh`, `start-rtl.sh`, `start-rsp1a.sh`, `start-fobos-hf.sh`, `start-fobos.sh` y `start-hackrf.sh` |
| `stop-websdr.sh` | Modificado | detiene el sidecar junto con el servidor |
| `spectrumserver.cpp` | **Sin cambios** | No hacen falta modificaciones en C++ |

---

## Resumen del flujo de señal

```
Antenna → RX-888 MK2 → PhantomSDR-Plus C++ server
                              │
                    FFT + DDC + SSB demodulation
                    (USB or LSB — set by RADEL/RADEU)
                              │
                    Opus/FLAC encode → WebSocket → Browser
                              │
                         audio.js decode()
                              │
                         playAudio(pcmArray)
                              │
               ┌──────────────┴────────────────────────────┐
               │  rawPcm tap (before mute gate)             │
               │  real f32 → zero-padded complex f32 pairs  │
               └──────────────┬────────────────────────────┘
                              │ WebSocket binary → ws://host:8074
                              ▼
                       rade_helper.py
                              │ resample to 8000 Hz if needed
                              │ stdin pipe
                              ▼
          radae_rxe.py  --model_name model19_check3/.../checkpoint_epoch_100.pth
          (PyTorch FARGAN neural vocoder, auxdata ON by default)
                              │ stdout pipe (vocoder features f32)
                              ▼
          lpcnet_demo  -fargan-synthesis  -  -
                              │ stdout: s16 PCM @ 16000 Hz
                              │ sidecar converts s16 → f32
                              │ WebSocket binary frames → browser
                              ▼
                  audio.js  _radePlayPCM()
                  AudioContext.createBuffer(16000 Hz)
                              │
                           Speaker 🔊
```

---

## Resolución de problemas

### Cartel rojo — «Sidecar not reachable»

```bash
# Is sidecar running?
ps aux | grep rade_helper | grep -v grep

# Start it manually for testing
python3 ~/PhantomSDR-Plus/rade_helper.py &

# Check port is open externally — use portchecker.co NOT curl from the server
# (curl from the server uses NAT loopback and gives false "Connection refused")
```

---

### El puerto 8074 aparece cerrado en portchecker.co pese a la regla de iptables

Puede que el ISP esté filtrando el puerto o que falte la regla NAT del router. Opciones:

1. Pruebe otro puerto: `RADE_HELPER_PORT=8080 python3 rade_helper.py`
2. Redirigir por su puerto público existente mediante Nginx (véase el [Paso 7 de la guía manual](RADE_General_INSTALL_MANUAL_LINUX.md))

---

### `radae_rxe.py: error: unrecognized arguments: model_path`

La ruta del modelo debe indicarse con `--model_name`, no como argumento posicional:

```bash
# WRONG — positional argument
python3 radae_rxe.py model19_check3/checkpoints/checkpoint_epoch_100.pth

# CORRECT — named argument
python3 radae_rxe.py --model_name model19_check3/checkpoints/checkpoint_epoch_100.pth
```

---

### `ModuleNotFoundError: No module named 'matplotlib'`

```bash
pip3 install matplotlib
```

`radae_rxe.py` importa matplotlib incondicionalmente al principio del archivo.

---

### `ModuleNotFoundError: No module named 'torch'`

```bash
pip3 install torch
```

---

### `lpcnet_demo: No such file or directory`

La compilación de radae no llegó a completarse. Vuelva a compilar:

```bash
cd ~/radae/build
cmake .. && make -j$(nproc)
ls src/lpcnet_demo     # should exist now
```

---

### Error `size mismatch` en `inference.sh`

`model19_check3` requiere `--auxdata` al codificar con `inference.sh`:

```bash
./inference.sh model19_check3/checkpoints/checkpoint_epoch_100.pth \
    wav/brian_g8sez.wav /dev/null \
    --rate_Fs --pilots --pilot_eq --eq_ls --cp 0.004 \
    --write_rx rx.f32 --auxdata    # ← required for model19_check3
```

Nota: al **decodificar** con `radae_rxe.py`, `--auxdata` es el valor por defecto; no lo pase.

---

### Indicador amarillo — «Searching for signal» — nunca sincroniza

- Confirme la banda lateral correcta: RADEL para ≤ 10 MHz, RADEU para > 10 MHz
- Consulte [qso.freedv.org](https://qso.freedv.org) para confirmar que hay una estación transmitiendo en ese momento
- RADE v1 usa 30 portadoras en 1500 Hz de ancho de banda: aparece como un grupo compacto en la cascada
- Deje hasta 1,5 segundos para la adquisición

---

### `underrun!!!` de aplay durante la prueba de la cadena (paso 3)

Solo es esperable en las pruebas sin conexión con archivos. `radae_rxe.py` procesa más despacio que la E/S de archivos, con lo que el búfer de audio se queda sin datos. Esto no ocurre en recepción en directo porque el navegador suministra el audio a tasa de tiempo real.

---

### `ConnectionClosedError: received 1011 (internal error)`

El sidecar aceptó la conexión WebSocket pero falló internamente antes de responder. La causa es una versión incompatible de `rade_helper.py`: una versión antigua intentaba pasar un `StreamReader` de asyncio como entrada estándar de un subproceso, lo que falla en silencio y cierra con el error 1011.

**Solución:** sustituya `rade_helper.py` por la versión actual del conjunto de parches. La versión actual usa `os.pipe()` para la tubería entre procesos y es compatible con websockets de la 10.x a la 16.x+.

---

### Varios usuarios simultáneos

Cada conexión de navegador genera su propio par independiente `radae_rxe.py` + `lpcnet_demo`, de modo que cada usuario puede sintonizar libremente una frecuencia distinta.

Por defecto, `radae_rxe.py` usa **todos los núcleos de CPU disponibles** para las operaciones matriciales de PyTorch, lo que provoca un uso de CPU del ~900 % por instancia. `rade_helper.py` lo limita con dos optimizaciones:

1. `OMP_NUM_THREADS=1` (y los equivalentes de MKL/OpenBLAS): limita PyTorch a 1 hilo
2. Funciones de conversión de audio vectorizadas con numpy: eliminan la sobrecarga de los bucles de Python

Resultado: cada instancia usa aproximadamente el **8-10 %** de un núcleo, suficiente para decodificar RADE en tiempo real. Si oye cortes de audio, suba a 2 hilos:

```bash
RADE_TORCH_THREADS=2 ./start-rx888mk2.sh     # or your receiver's launcher
# standalone: RADE_TORCH_THREADS=2 ./rade.sh restart
```

| Usuarios de RADE simultáneos | CPU aproximada |
|---|---|
| 1 | ~9 % |
| 5 | ~45 % |
| 10 | ~90 % |
| 20 | ~180 % |

En un i5-12450H (12 hilos) con spectrumserver usando ~42 % y rx888_stream ~11 %, dispone de aproximadamente un **1000 % de margen**, suficiente para **más de 20 usuarios simultáneos** de RADE antes de que la CPU sea un problema.

> **La tabla anterior supone que el coste de CPU crece linealmente con los usuarios. La medición dice que no.** Una ejecución de `rade_loadtest.py` en ese mismo i5-12450H mostró un coste de CPU por oyente muy por debajo de esta tabla hasta unos 24 oyentes, y luego un aumento brusco, deteniéndose la máquina por **temperatura del encapsulado con 32 oyentes**, no por CPU ni por ancho de banda. Tome estas cifras solo como guía aproximada para números pequeños y mida su propio equipo: véase [Medir la concurrencia en su propio hardware](#medir-la-concurrencia-en-su-propio-hardware). Tenga en cuenta que la prueba de carga alimenta la cadena con ruido en lugar de una señal RADE real, así que el uso absoluto de CPU con tráfico auténtico puede diferir; lo fiable es la *forma* de la curva.

---

## Medir la concurrencia en su propio hardware

Las cifras anteriores proceden de un equipo concreto. `rade_loadtest.py` (en la raíz del repositorio) mide lo mismo en **el suyo**: va añadiendo oyentes RADE sintéticos contra el sidecar por escalones e informa del último número de oyentes que su máquina sostuvo antes de que algo cediera.

Tras cada escalón deja que el equipo se estabilice y luego muestrea la temperatura del encapsulado, la CPU total, la RAM disponible, el swap y la RSS combinada de todos los procesos `radae_rxe.py` y `lpcnet_demo`. Se detiene en el primer **codo**, sea cual sea el límite que se supere primero, e imprime el último recuento estable.

### Requisitos

```bash
sudo apt install python3-websockets python3-psutil
```

Ejecútelo **en el equipo del SDR** (lee sensores locales y la memoria de los procesos), con spectrumserver y el sidecar de RADE ya en marcha:

```bash
cd ~/PhantomSDR-Plus
python3 rade_loadtest.py
```

Ctrl-C cierra limpiamente todas las conexiones en cualquier momento.

### Antes de la primera ejecución

Abra el archivo y revise los dos bloques del principio:

- **`CONFIG`**: `WS_URL` vale por defecto `ws://127.0.0.1:8074`; cámbielo si movió el sidecar de su puerto por defecto. `RADE_SPS` (12000) y `RADE_SIDEBAND` (`USB`) deben coincidir con lo que indica su frontend.
- **`handshake_messages()`**: la única trama `init` que envía debe coincidir con la inicialización de RADE en `frontend/src/audio.js`. Si ese saludo se ha desincronizado, ningún oyente logra conectarse y la prueba termina de inmediato con fallos de conexión.

### Umbrales del codo

Ajústelos en `CONFIG` a su gusto; son deliberadamente conservadores:

| Umbral | Por defecto | Se detiene cuando |
|---|---|---|
| `TEMP_KNEE_C` | `85.0` | La temperatura del encapsulado alcanza este techo |
| `MIN_AVAIL_MB` | `800` | La RAM disponible cae por debajo de este valor |
| `SWAP_GROWTH_MB` | `50` | El swap crece por encima de la línea base tomada al inicio |
| `FAIL_LIMIT` | `3` | Este número de oyentes no logra conectarse en un escalón |
| `MAX_LISTENERS` | `60` | Parada absoluta aunque nunca se alcance un codo |

La forma de la rampa la controlan `STEP` (oyentes añadidos por escalón, 2 por defecto), `SETTLE_S` (25 s de estabilización antes de muestrear, que es lo que permite que se acumule el calor) y `SAMPLE_S` (ventana de promediado de CPU de 5 s). Una ejecución completa hasta el techo por defecto de 60 oyentes lleva por tanto unos 15 minutos.

### Cómo leer los resultados

Cada escalón imprime una línea y añade una fila a `rade_loadtest.csv`:

| Columna | Significado |
|---|---|
| `listeners` | Oyentes sintéticos conectados en este escalón |
| `connect_fails` | Oyentes que no lograron establecer o mantener la conexión |
| `pkg_c` | Temperatura del encapsulado, mediana de 5 muestras (resistente a picos) |
| `cpu_pct` | Porcentaje de CPU **de todo el sistema**, no por oyente |
| `avail_mb` | RAM disponible |
| `swap_mb` | Swap en uso |
| `dec_rss_mb` | RSS combinada de todos los procesos de decodificación |
| `dec_procs` | Número de procesos de decodificación: espere **2 por oyente** (`radae_rxe.py` + `lpcnet_demo`) |

#### Una ejecución medida

En el i5-12450H mencionado antes, una ejecución completa terminó así:

```
KNEE at n=32: temp 91.0°C ≥ 85.0
Last stable concurrency: 30 RADE listeners
```

**El calor fue la restricción determinante**, y con holgura. En el codo quedaban aún 7004 MB de RAM disponible —6,2 GB por encima del corte de `MIN_AVAIL_MB`— y cero fallos de conexión en todos los escalones.

Dos columnas merecen una lectura atenta:

**`dec_rss_mb` exagera el coste real de memoria.** Crece de forma muy constante, 295 MB por oyente (292, 294, 294 … 295 a lo largo de los 16 escalones), pero la *RAM disponible* solo baja unos **202 MB por oyente**. Los dos procesos de cada oyente comparten páginas de bibliotecas, y la RSS cuenta esas páginas una vez por proceso. Extrapolando la pendiente de `avail_mb`, el codo de memoria llegaría cerca de los **63 oyentes**, más allá del tope absoluto de 60, así que en este equipo nunca puede dispararse. Dimensione la memoria a partir de `avail_mb`, no de `dec_rss_mb`.

**`cpu_pct` es plano… hasta que deja de serlo.** Se mantiene en torno al 5,3 % de toda la máquina hasta 24 oyentes y luego se vuelve superlineal:

| Oyentes | 24 | 26 | 28 | 30 | 32 |
|---|---|---|---|---|---|
| `cpu_pct` | 6,7 % | 18,4 % | 30,1 % | 49,6 % | 65,2 % |

Es decir, la CPU se multiplica por 10 mientras el número de oyentes crece un tercio. La inflexión se reproduce en el mismo punto en distintas ejecuciones, así que trátela como una propiedad del equipo y no como ruido: el coste de CPU por oyente ronda el 3,4 % de un núcleo por debajo de la inflexión y en torno al 20 % por encima. No extrapole una cifra de CPU por usuario tomada con pocos oyentes.

> **La prueba no tiene codo de CPU.** Los cuatro cortes son temperatura, RAM disponible, crecimiento del swap y fallos de conexión; la CPU se registra pero nunca termina la ejecución. En la ejecución anterior la CPU llegó al 65 % y habría seguido subiendo si no hubiera saltado antes la temperatura. Si le preocupa un techo de CPU, vigile usted mismo la columna o añada un umbral.

> **Qué demuestra y qué no.** Cada oyente sintético transmite ruido aleatorio de baja amplitud, no una señal RADE real. Eso basta para que toda la cadena de decodificación funcione y consuma recursos, así que las cifras de recursos son significativas; pero la prueba no dice nada sobre la *calidad* de la decodificación ni sobre la continuidad del audio bajo carga. Confirme eso con oyentes reales y una señal real.

### Si los núcleos se saturan antes del codo

RADE fija con fuerza un hilo por instancia, así que algunos núcleos pueden alcanzar ~90 °C mientras la CPU total parece ociosa. `rade_helper.py` reparte las cadenas entre los núcleos de forma cíclica para contrarrestarlo. Si una ejecución muestra codos térmicos tempranos, amplíe la asignación de núcleos por cliente:

```bash
RADE_CORES_PER_CLIENT=3 ./rade.sh restart
```

No hace falta editar ningún archivo: es una variable de entorno (véase [Variables de entorno](#variables-de-entorno)); `RADE_PIN_CORES=0` desactiva la fijación por completo.

---

## Actualizar RADE v1

La integración con PhantomSDR-Plus (`rade_helper.py`, parches del frontend) es solo un puente: toda la lógica de decodificación de RADE vive en el repositorio `radae`. Por eso las actualizaciones son casi siempre un simple `git pull` más recompilación, sin cambios en el propio PhantomSDR-Plus.

### Actualización estándar (código nuevo, mismo modelo)

```bash
# 1. Pull latest radae code
cd ~/radae
git pull

# 2. Rebuild lpcnet_demo (in case C code changed)
cd build
cmake ..
make -j$(nproc)

# 3. Restart the sidecar — no server restart needed
cd ~/PhantomSDR-Plus
./rade.sh restart
```

Eso es todo. Sin recompilar el frontend, sin reiniciar el servidor y sin editar archivos.

### Solo pesos de modelo nuevos

Si se publica un checkpoint nuevo (p. ej., `model20`) sin cambios de código, apunte el sidecar a los nuevos pesos mediante la variable de entorno; no hace falta editar ningún archivo:

```bash
# One-off: start with new model
RADE_MODEL=~/radae/model20/checkpoints/checkpoint_epoch_100.pth ./rade.sh start

# Or permanently — add to your shell profile (~/.bashrc):
export RADE_MODEL=~/radae/model20/checkpoints/checkpoint_epoch_100.pth
```

### Qué requiere cada tipo de cambio

| Qué cambió en radae | Acción necesaria |
|---|---|
| Pesos de modelo nuevos (archivo `.pth` nuevo) | Definir la variable `RADE_MODEL`, `./rade.sh restart` |
| Cambio de código en `radae_rxe.py` | `git pull`, `./rade.sh restart` |
| Cambió el código C de `lpcnet_demo` | `git pull`, recompilar, `./rade.sh restart` |
| `radae_rxe.py` renombrado o movido | Actualizar la ruta `RADAE_RX` en `rade_helper.py` (una línea) |
| Argumento `--model_name` renombrado | Actualizar `radae_cmd` en `rade_helper.py` (una línea) |
| Nueva tasa de muestreo de salida (≠ 16000 Hz) | Actualizar `SPS_OUT` en `rade_helper.py` y `createBuffer()` en `audio.js` |
| RADE v2 usa un binario distinto | Actualizar `RADAE_RX` en `rade_helper.py` (una línea) |

### Comprobar que la actualización funcionó

Tras reiniciar, confirme que se está ejecutando el código nuevo:

```bash
# Check sidecar picked up new radae_rxe.py
./rade.sh status

# Tail log to see startup lines
tail -20 ~/PhantomSDR-Plus/rade.log
```

El registro debería mostrar la ruta del modelo que espera:
```
[RADE] model : /home/sv1btl/radae/model19_check3/checkpoints/checkpoint_epoch_100.pth
```

### Mantenerse al día

Suscríbase a la página de versiones del repositorio radae para recibir avisos de nuevos modelos y actualizaciones de código:

```
https://github.com/drowe67/radae/releases
```

Consulte el blog de FreeDV para ver anuncios sobre nuevas formas de onda y modelos de RADE:

```
https://freedv.org/blog/
```

---

*Desarrollado y probado en PhantomSDR-Plus (fork sv1btl/PhantomSDR-Plus) con un RX-888 MK2 en Ubuntu 24.04. El servidor en C++ no se modifica.*

*RADE lo desarrollan David Rowe VK5DGR y el equipo de FreeDV.* *Véase [freedv.org/radio-autoencoder](https://freedv.org/radio-autoencoder).*

---

### Desinstalación completa y reinstalación limpia

Este es el desmontaje completo antes de volver a ejecutar install_rade.sh:
1. Detener el sidecar cd ~/PhantomSDR-Plus && ./rade.sh stop
2. Eliminar el repositorio radae y la compilación rm -rf ~/radae
3. Eliminar torch (instalado en el directorio local del usuario) pip3 uninstall -y torch rm -rf ~/.local/lib/python3.11/site-packages/torch*
4. Eliminar los paquetes de Python de apt (opcional: omítalo si los usan otros programas) sudo apt-get remove -y python3-numpy python3-scipy python3-matplotlib python3-websockets sudo apt-get autoremove -y
5. Comprobar que no queda nada python3 -c "import torch" 2>&1        # should say ModuleNotFoundError ls ~/radae 2>&1                        # should say No such file or directory
6. Instalación limpia chmod +x ~/PhantomSDR-Plus/install_rade.sh ~/PhantomSDR-Plus/install_rade.sh
