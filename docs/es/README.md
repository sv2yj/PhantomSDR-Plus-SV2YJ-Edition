# PhantomSDR-Plus

**Un servidor WebSDR de código abierto mejorado, con funciones avanzadas y diseño futurista**

PhantomSDR-Plus es un fork de PhantomSDR que ofrece un servidor web de radio definida por software (SDR) de alto rendimiento, capaz de atender a cientos de usuarios simultáneos. Incorpora una interfaz de usuario mejorada, compatibilidad con múltiples decodificadores, visualización del plan de bandas y compatibilidad con diversas plataformas de hardware SDR.

---

## 🌟 Funciones principales

### Rendimiento y escalabilidad
- **Compatibilidad multiusuario**: cientos de usuarios simultáneos según el hardware
- **Alta tasa de muestreo**: admite SDR de hasta 70 MSPS (real) / 35 MSPS (IQ)
- **Aceleración por hardware**: compatibilidad con OpenCL y CUDA para procesamiento acelerado por GPU
- **Transmisión optimizada**: compresión de audio FLAC y Opus de baja latencia

### Interfaz de usuario
- **Diseño futurista**: interfaz web moderna y adaptable
- **Optimizada para móviles**: interfaz móvil mejorada para escuchar en movimiento
- **Visualización del plan de bandas**: cascada interactiva con superposición de bandas de frecuencia
- **Mapas de color personalizables**: varios esquemas de color para la cascada
- **S-metro doble**: a elegir entre indicación de señal analógica o digital
- **Botones de decodificador de una pulsación**: una fila de decodificadores en el panel principal, justo debajo del selector de modos (FT8, FT4, FT2, JS8, CW, WSPR, FAX, SSTV, NAVTX, RTTY), con RADEL y RADEU junto al propio selector de modos y repetidos en las ventanas emergentes de modos y bandas. Una pulsación inicia el decodificador y abre su ventana; una segunda lo detiene. La antigua fila de ancho de banda se ha eliminado.
- **Escáner de canales**: recorre la banda, o exactamente lo que muestra la cascada, y se detiene en el primer canal que supere en los dB elegidos el propio suelo de ruido de la banda; continúa solo en cuanto ese canal queda en silencio. El paso sigue al modo y las paradas caen en la rejilla de canales (1 kHz SSB, 100 Hz CW, 5 kHz AM de onda corta, 9/10 kHz onda media, 9 kHz onda larga). Un modo *Saltar vacíos* lee el espectro de la cascada y salta directamente a las señales, y un botón de bloqueo saca del barrido un canal siempre ocupado. Todo es local al navegador del oyente, de modo que explorar no mueve el receptor para nadie más (véase la [Guía del usuario](USER_GUIDE.md))
- **Diversidad de recepción**: combina el receptor con un segundo receptor situado en otro lugar y reproduce el que en cada momento tiene mejor señal, de modo que un desvanecimiento en uno lo cubre el otro. El segundo puede ser otro PhantomSDR-Plus, un KiwiSDR, un UberSDR o un WebSDR; los tres primeros no necesitan nada más que el navegador del oyente, y solo un WebSDR requiere un pequeño relé en su propio servidor. La alineación tarda unos quince segundos, y un ajuste remoto de SNR equilibra ambas estaciones entre sí. Cada oyente guarda en su propio navegador una lista de segundos receptores con nombre, en el orden que prefiera, y puede exportarla a un archivo e importarla de nuevo (véase [Diversidad de recepción](RECEIVE_DIVERSITY.md))

### Procesamiento de señal
- **Múltiples modos de demodulación**: AM, FM, USB, LSB, CW y más. También se ha implementado un decodificador RADE versión 1.
- **Detección de AM síncrona**: mejor calidad de recepción en AM
- **Reducción de ruido**: NR (espectral), NB (supresor de impulsos), NS (supresión del ruido de fondo) y AN (notch automático), todos en la escucha y nunca en los decodificadores
- **Opciones de AGC**: varios modos de control automático de ganancia
- **Squelch automático**: umbral de squelch automático basado en el ruido
- **Reducción de ruido por IA**: red neuronal RNNoise en el navegador del oyente, elimina el ruido de banda de la voz (solo modos de voz; véase la [Guía del usuario](USER_GUIDE.md))

### Funciones avanzadas
- **Decodificadores digitales**: FT8, FT4, FT2, JS8, CW, QRSS Grabber, WSPR, FAX de HF, SSTV, NAVTEX, FSK/RTTY, PSK31, Olivia y FreeDV RADE, cada uno ejecutándose en su propio hilo en segundo plano para que la decodificación nunca interrumpa el audio (véase [Decodificadores](DECODERS.md))
- **Decoder ID**: nombra el modo digital presente en el paso de banda y ofrece el decodificador adecuado con un clic, a partir del ancho de banda, la separación de tonos, la velocidad de símbolo y la temporización de las ráfagas medidos, teniendo en cuenta además la frecuencia como indicio adicional, que es también lo que distingue **FT8 de JS8**, dos modos de señal idéntica. Solo sugiere, nunca cambia por su cuenta, y prefiere callar a adivinar cuando la señal es demasiado débil. El desvanecimiento no lo silencia: cuando el QSB parte en trozos una transmisión WSPR de dos minutos, sigue nombrando el modo, leyendo la cadencia de todo el historial de escucha, y baja la confianza mostrada para indicar que la prueba es más débil. Entre unos 400 Hz y 2700 Hz la posición en el paso de banda es indiferente; fuera de ese margen aparece un botón ámbar **Recentre & retry**, que mueve el dial una vez e inicia una medición nueva. Cuando acepta una sugerencia, el receptor queda preparado para trabajar ese modo: la frecuencia sintonizada pasa al centro de la cascada, la vista queda en unos 100 kHz a su alrededor, y la banda lateral y el paso de banda pasan a ser los propios del modo — la subbanda de 3 kHz para la familia FT8, 1350–1650 Hz para WSPR, ±250 Hz y CW para la telegrafía, etcétera. Desactivado por defecto, y en torno al 0,5 % de un núcleo mientras funciona (véase [Decodificadores](DECODERS.md))
- **Preajustes de modos digitales**: pulsar FT8, FT4, FT2, JS8 o WSPR ajusta a la vez la banda lateral y el paso de banda
- **Panel de conversación JS8**: los mensajes de varias tramas se reensamblan en frases completas
- **Panel de estadísticas**: estadísticas del servidor y de los usuarios en tiempo real
- **Lista de usuarios conectados**: todos los que están escuchando, con un botón de sintonía en cada fila. Su propia sesión aparece marcada **you**, tanto en la ventana de la interfaz como al abrir `users.html` como página independiente
- **Reporte automático de spots**: un demonio autorun decodifica FT8, FT4 y WSPR en el servidor y sube spots a PSK Reporter y WSPRnet, con dos contadores en el panel de administración: paneles por decodificador para la ejecución actual y un total histórico junto a cada casilla de banda/modo
- **Gráficas del servidor**: página **Gráficos** del panel de administración con la frecuencia de CPU, la carga, la temperatura y los usuarios conectados en los últimos 15 minutos a 24 horas (véase [Panel de administración](ADMIN_PANEL_SETUP.md))
- **Protección térmica**: un guardián en el panel de administración detiene el servidor si la CPU se sobrecalienta y lo reinicia cuando se enfría, con umbrales derivados del límite crítico de su propia CPU y sin suposiciones sobre cómo arranca o detiene usted el servidor; se entrega en modo de solo registro, así que no hace nada hasta que lo active (véase [Thermal Guard](THERMAL_GUARD.md)) En un receptor desatendido se **recomienda encarecidamente** ejecutar el panel como unidad systemd: el guardián vive dentro de él, así que de lo contrario un reinicio se lleva la protección (véase [Panel de administración](ADMIN_PANEL_SETUP.md#reiniciar-el-panel)).
- **Emulación de clientes KiwiSDR**: un puente opcional que responde también al protocolo KiwiSDR en el mismo host y puerto, de modo que software Kiwi como **AetherSDR** y `kiwiclient` se conecta directamente al receptor — con sintonía real, cascada y un S-metro en la misma escala que el de la página web. Apagado hasta que añada `[kiwi_emulation] enabled = true` a su configuración (véase [Instalación](Aether_config.md))
- **Control del transceptor (CAT)**: mantiene su propio equipo y la ventana del receptor en la misma frecuencia, modo y ancho de filtro, en un sentido o en ambos — mediante el menú Rig de [Desktop PhantomSDR+](https://www.dropbox.com/scl/fo/kjwj96zg3kj7dgq4fjef9/APnA3c9hhv4hk3YMGIGjH7s?rlkey=jfiwklly63kv73poalx631pk3&st=m37uvaym&dl=0) (Icom, Yaesu, Kenwood, Elecraft, FlexRadio y QRP Labs directamente, cualquier otro equipo mediante Hamlib, o flrig) o con la CATsync Tool for WebSDRs en un navegador. Las páginas ofrecen funciones `catsync_*` para frecuencia, modo, ancho de filtro y silencio. Funciona con receptores PhantomSDR-Plus, KiwiSDR, PA3FWM WebSDR y UberSDR (vea [Control del transceptor](RIG_CONTROL.md))
- **Sistema de marcadores**: importación/exportación de marcadores de frecuencia
- **Atajos de teclado**: navegación y control eficientes
- **Compatibilidad con la rueda del ratón**: sintonía de frecuencia intuitiva
- **Directorio WebSDR**: integración con https://sdr-list.xyz

---

## 📋 Hardware compatible

PhantomSDR-Plus es compatible con una amplia gama de receptores SDR:

| Dispositivo | Tasa de muestreo | Formato | Interfaz |
|-------------|------------------|---------|----------|
| **RX888 MK2** | Hasta 64 MHz | 16 bits | Nativa |
| **RTL-SDR** | Hasta 3.2 MHz | 8 bits | rtl_sdr |
| **HackRF One** | Hasta 20 MHz | 8 bits | hackrf_transfer |
| **Airspy HF+ / Discovery** | Hasta 912 kHz | 16 bits | SoapySDR (SoapyAirspyHF) + rx_sdr |
| **SDRplay RSP1A** | Hasta 10 MHz | 16 bits | SoapySDR (libmirisdr-5 + SoapyMiri, o la API de SDRplay) + rx_sdr |
| **RigExpert Fobos SDR** | 50 MHz (HF, muestreo directo) / hasta 20 MHz (RF) | 16 bits / float de 32 bits | SoapySDR (SoapyFobosSDR) + rx_sdr |
| **Otros dispositivos** | Variable | Varios | SoapySDR/rx_tools |

---

## 🚀 Inicio rápido

### Requisitos del sistema

**Mínimos:**
- Ubuntu 22.04 LTS (recomendado) o Fedora
- CPU de 2 núcleos
- 4 GB de RAM
- 10 GB de espacio en disco

**Recomendados:**
- Ubuntu 24.04 LTS
- CPU de 4 o más núcleos (Ryzen 5 2600 o Intel i5-6500T o superior)
- 8 GB de RAM
- GPU compatible con OpenCL (opcional, pero muy recomendable)
- Almacenamiento SSD

### Instalación

```bash
# Clonar el repositorio
git clone --recursive https://github.com/sv1btl/PhantomSDR-Plus
cd PhantomSDR-Plus

# Hacer ejecutables los scripts
chmod +x *.sh

# Ejecutar la instalación automática
./install.sh
```

**Nota:** después de ejecutar `install.sh`, reinicie el terminal antes de continuar.

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

Use `install_fedora.sh` en Fedora, `install_arch.sh` en Arch o `install_opensuse.sh` en openSUSE Tumbleweed: hacen el mismo trabajo con otro gestor de paquetes. Todas las versiones de Debian y Ubuntu las cubre el propio `install.sh`.

No hay que instalar nada a mano de antemano. El script instala las dependencias de compilación y Node.js, compila el backend, compila el driver del receptor que elija (y con el RX888 también las reglas udev), abre `site_information.json` para que lo rellene, compila el frontend, instala OpenCL cuando el hardware lo admite, y después configura el **panel de administración**, el **decodificador FreeDV RADE** y el **servidor de estadísticas** — los tres por defecto, responda `n` para omitir alguno — y termina con un `recompile.sh` completo. Transcurre en 17 pasos numerados y se detiene en siete preguntas, cada una enmarcada por un recuadro «SE NECESITA SU RESPUESTA»; `PHANTOM_NONINTERACTIVE=1` las responde todas con sus valores por defecto. Cuente de veinte minutos a más de una hora.

Para la descripción paso a paso, véase [INSTALLATION.md → Qué hace el instalador](INSTALLATION.md#qué-hace-el-instalador). Para instrucciones de instalación detalladas, consulte [INSTALLATION.md](INSTALLATION.md).

---

## 📊 Pruebas de rendimiento

| Hardware | Tasa de muestreo | Uso de CPU | Capacidad de usuarios |
|----------|------------------|------------|------------------------|
| Ryzen 5 2600 (todos los núcleos) | 64 MHz (32 MHz IQ) | 38-40 % | Más de 100 usuarios |
| AMD RX 580 (GPU) | 64 MHz (32 MHz IQ) | 28-35 % | Más de 100 usuarios |
| Intel i5-6500T (con OpenCL) | 60 MHz (30 MHz IQ) | 10-12 % | Más de 100 usuarios |

*Nota: la carga adicional de CPU por usuario es mínima (<1 % por usuario) cuando la aceleración por hardware está activada.*

---

## 🎯 Uso

### Funcionamiento básico

1. **Configure su SDR**: edite el archivo de configuración correspondiente (p. ej., `config-rtl.toml`)
2. **Actualice la información del sitio**: edite `frontend/site_information.json`
3. **Inicie el servidor**: ejecute el script de arranque adecuado:
   ```bash
   ./start-rtl.sh      # Para RTL-SDR
   ./start-rsp1a.sh    # Para SDRplay RSP1A
   ./start-airspyhf.sh # Para Airspy HF+
   ./start-fobos-hf.sh # Para RigExpert Fobos SDR, HF1/HF2 (0-25 MHz)
   ./start-fobos.sh    # Para RigExpert Fobos SDR, RF (25-6000 MHz)
   ./start-hackrf.sh   # Para HackRF One
   ./start-rx888mk2.sh # Para RX888 MK2
   ```
   El RSP1A, el Airspy HF+ y el Fobos funcionan a través de SoapySDR y `rx_sdr`; el instalador prepara su driver cuando los elige (opciones 3, 6 y 5), o ejecute `./setup-rsp1a.sh`, `./setup-airspyhf.sh` o `./setup-fobos.sh` en una estación ya instalada. Vea [INSTALLATION.md](INSTALLATION.md#receptores-sobre-soapysdr-rsp1a-fobos-airspy-hf). El HackRF One (opción 7) solo necesita el paquete `hackrf` de la distribución: `./setup-hackrf.sh`.
   Cada script de arranque es **autónomo**: detiene cualquier instancia en ejecución, lanza el receptor + `spectrumserver`, **pasa a segundo plano** (sobrevive al cierre del terminal) y ejecuta un **watchdog** que reinicia automáticamente la cadena si esta se cae. El progreso se registra en `logwebsdr.txt`: obsérvelo con `tail -f logwebsdr.txt`. Volver a ejecutar un script de arranque equivale a un reinicio limpio, y un bloqueo `flock` garantiza que solo funcione un receptor a la vez. Opcional: `SPECTRUM_CORES=0-3` para fijar CPU, `RX_ARGS="…"` para sustituir los argumentos del receptor sin editar el archivo (`RX888_ARGS` para el RX888), `RX_DRIVER=miri|sdrplay` para elegir el driver del RSP1A.
4. **Acceda a la interfaz**: abra el navegador en `http://localhost:PORT` (el puerto predeterminado varía según la configuración)

### Detener el servidor

Un único script de parada compartido sirve para **todos** los receptores: primero detiene el watchdog (para que no pueda reiniciar el sistema) y después el receptor y `spectrumserver`:

```bash
./stop-websdr.sh
```

---

## 🔧 Configuración

### Archivos de configuración esenciales

1. **`config-[dispositivo].toml`**: configuración del servidor y del SDR
   - Ajustes del servidor (puerto, hilos, raíz HTML)
   - Ajustes de entrada (tasa de muestreo, tamaño de FFT, frecuencia)
   - Opciones de registro en el directorio WebSDR
   - Ajustes de compresión de audio
   - Tras modificarlo, reinicie el servidor.

2. **`frontend/site_information.json`**: información pública del sitio
   - Datos del operador (indicativo, correo electrónico, ubicación)
   - Información sobre hardware y antena
   - Ajustes de región y ancho de banda
   - Activación/desactivación del chat
   - Tras modificarlo, ejecute recompile.sh en un terminal.

3. **`markers.json`**: marcadores de frecuencia y plan de bandas

4. **`frontend/src/bands-config.js`**: configuración del plan de bandas Este archivo se encuentra en frontend/src/bands-config.js y define las bandas que crea el SysOp. <br />
- Verá algo parecido a lo siguiente y puede editarlo a su gusto:
   ```
   - const bands = 
   .....
   - { ITU: 1,
            name: '40m', min: -30, max: 110, initFreq: '7120000', publishBand: '1', startFreq: 7000000, endFreq: 7200000,  stepi: 1000, color: 'rgba(50, 168, 72, 0.6)', 
	    modes: [
              { mode: MODES.CW, startFreq: 7000000, endFreq: 7040000 },
              { mode: MODES.LSB, startFreq: 7040000, endFreq: 7200000 }]
	},
	{ ITU: 2,
            name: '40m', min: -30, max: 110, initFreq: '', publishBand: '1', startFreq: 7000000, endFreq: 7300000,  stepi: 1000, color: 'rgba(50, 168, 72, 0.6)', 
	    modes: [
              { mode: MODES.CW, startFreq: 7000000, endFreq: 7050000 },
              { mode: MODES.LSB, startFreq: 7050000, endFreq: 7300000 }]
	},
	{ ITU: 3,
            name: '40m', min: -30, max: 110, initFreq: '', publishBand: '1', startFreq: 7000000, endFreq: 7200000,  stepi: 1000, color: 'rgba(50, 168, 72, 0.6)',
            modes: [
              { mode: MODES.CW, startFreq: 7000000, endFreq: 7040000 },
              { mode: MODES.LSB, startFreq: 7040000, endFreq: 7200000 }]
   .....
   etc
   ```
   **Donde:** <br />
   - **ITU** es la región en la que se encuentra el servidor,
   - **min y max** son los límites de brillo de la cascada para la banda indicada,
   - **initFreq** es la frecuencia inicial a la que sintonizar cuando se selecciona la banda,
   - **publishBand** determina si la banda se muestra: 1 para bandas de radioaficionado, 2 para bandas de radiodifusión,
   - **startFreq y endFreq** definen los límites de la banda,
   - **stepi** es el paso predeterminado de la rueda del ratón para la banda, y **modes** es el modo predeterminado preferido para la banda.

- Después de realizar cambios, **ejecute recompile.sh en un terminal** desde la carpeta PhantomSDR-Plus.

Para ver ejemplos de configuración, consulte los archivos de muestra incluidos:
- `config-rtl.toml`: configuración de RTL-SDR
- `config-rsp1a.toml`: configuración de SDRplay RSP1A
- `config-airspyhf.toml`: configuración de Airspy HF+
- `config-fobos-hf.toml` / `config-fobos.toml`: configuración de RigExpert Fobos SDR (HF / RF)
- `config-hackrf.toml`: HackRF One
- `config-rx888mk2.toml`: configuración de RX888 MK2

---

## 🌊 Suelo de la cascada — `waterfall.sh`

`waterfall.sh` (en la raíz del repositorio) cambia el **nivel mínimo de cascada predeterminado** en dB, es decir, el valor desde el que arranca la cascada en una visita nueva.

Ese valor está en dos archivos fuente, en cinco lugares distintos (`frontend/src/waterfall.js` → `this.minWaterfall`, y `frontend/src/App.svelte` → el `let min_waterfall` inicial, los dos casos de reinicio «min» y el valor predeterminado de los marcadores). Editarlos a mano es fácil de equivocar, así que el script lo hace por usted. Nunca usa números de línea fijos: localiza cada punto por patrón, de modo que sigue funcionando después de actualizar las fuentes.

- Un valor **más alto** (p. ej. `-15`) da una cascada **más oscura**.
- Un valor **más bajo** (p. ej. `-45`) da una cascada **más brillante**.

```bash
./waterfall.sh              # interactivo: muestra los valores actuales y pide el nuevo
./waterfall.sh -v -15       # fija el valor sin preguntar
./waterfall.sh -v -15 -y    # ... y omite todas las confirmaciones
./waterfall.sh -s           # solo muestra los valores actuales, sin cambiar nada
```

Antes de editar guarda una copia de seguridad de ambos archivos con marca de tiempo (`*.bak-AAAAmmdd-HHMMSS`) e imprime la orden para restaurarlos. Solo se tocan los literales iguales al valor en uso, de modo que otros números de esos archivos nunca pueden reescribirse por accidente. Si después el nuevo valor no aparece, el script restaura las copias por sí mismo y sale con error. También avisa cuando los dos archivos están desincronizados y ajusta ambos.

- Tras el cambio hay que reconstruir el frontend: el script se ofrece a ejecutar `recompile.sh` por usted (con `-y` omite la reconstrucción, así que ejecute `./recompile.sh` usted mismo cuando esté listo).

---

## 🎨 Personalización

### Cambiar la imagen de fondo

Sustituya `frontend/src/assets/background.jpg` por la imagen que prefiera (conservando el mismo nombre de archivo).

- Tras modificarla, ejecute recompile.sh en un terminal.


### Selección del códec de audio

Elija entre FLAC y Opus en su configuración `.toml`:
```toml
[input]
audio_compression="opus"  # or "flac"
```
- Tras modificarlo, reinicie el servidor.


### Calibración del S-metro

Los dos instrumentos están deliberadamente en **cadenas separadas**, por lo que se ajustan con dos mandos distintos.

#### Los dos mandos

Ambos están en la sección `[input]` del fichero de configuración con el que se arranca el servidor (`config.toml`, `config-rx888mk2.toml`, etc.):

```toml
[input]
smeter_offset=5         # solo la barra digital
analog_smeter_offset=5  # solo la aguja analógica
```

Se leen en `src/websocket.cpp` y se envían al navegador en la primera trama `basic_info`, así que **basta con reiniciar el servidor** — no hace falta recompilar el frontend.

#### Cadena analógica

```
dBm mostrados = -130 + (rawDb + analog_smeter_offset + 130) x 1,1
```

- La ganancia visual de 1,1 se aplica *después* del offset, con pivote en -130 dBm. Así que 1 unidad de `analog_smeter_offset` desplaza la lectura 1,1 dB. Para desplazar la indicación X dB: `analog_smeter_offset ~= 0,91 x X`. El valor TOML se lee como entero, así que solo hay pasos enteros.
- La ley de la aguja (`powerFromDbm` en `frontend/src/lib/SMeterAnalog.svelte`) sitúa **S9 en -73 dBm**, en 60 de 100 unidades de aguja, con una curva `pow(...,0,6)` de -130 a -73 por debajo de S9 y una curva `pow(...,0,8)` de -73 a -13 (S9+60) por encima.
- **No** es una escala lineal de 6 dB por punto S, de modo que el punto de calibración con sentido es S9 — las marcas por debajo de S9 no seguirán a un generador en pasos de 6 dB.

#### Cadena digital

```
value    = (rawDb / 150) x 100 + smeter_offset   -> limitado a [-100, 0]
segments = round((value + 100) x 35 / 100) + DIGITAL_BAR_TRIM
```

- Obsérvese el `/150 x 100`: la escala digital está **comprimida a 2/3** y nunca ve ni `analog_smeter_offset` ni la ganancia visual de 1,1. Por eso la barra y la aguja nunca coinciden exactamente — es intencionado.
- 35 segmentos sobre 100 unidades significa que un segmento son 2,86 unidades de offset, unos 4,3 dB brutos. Es decir, `smeter_offset=3` equivale aproximadamente a un segmento.
- `DIGITAL_BAR_TRIM` en `frontend/src/lib/SMeterDigital.svelte` (ahora 0) desplaza la barra por segmentos enteros. Cambiarlo es tocar el código fuente y **sí** exige recompilar el frontend.

#### Las ventanas LED se alimentan de la cadena analógica en ambos instrumentos

Las ventanas dBm / dBµV / SNR / NF de **ambos** instrumentos leen el valor calibrado analógico y suman un `VISUAL_DBM_OFFSET` fijo de 5, escrito en el código de `SMeterAnalog.svelte` y `SMeterDigital.svelte`. Por tanto:

- `smeter_offset` **no** cambia ningún número de las ventanas, solo la longitud de la barra.
- dBµV = dBm + 107 (50 ohmios), y NF = dBm - SNR por construcción, así que NF sigue automáticamente.
- Si se quieren los **números** correctos sin tocar la posición de la aguja, el mando es `VISUAL_DBM_OFFSET` — pero es una constante del código fuente, requiere recompilar y hay que cambiarla en **los dos** ficheros para mantener la coherencia.

#### Procedimiento

1. Inyectar un nivel conocido en la entrada de antena (generador a -73 dBm = S9), en SSB/CW con un ancho de banda estable. Las lecturas dependen del ancho de banda y del AGC, así que fija primero modo y ancho.
2. Anotar lo que muestra la ventana dBm analógica y poner `analog_smeter_offset ~= 0,91 x (-73 - valor mostrado)`. Reiniciar el servidor y volver a comprobar. Con una iteración basta; la aguja debe quedar en S9.
3. Pasar al instrumento digital y ajustar `smeter_offset` para que la longitud de la barra sitúe S9 donde se desee — unas 3 unidades por segmento. Este paso es puramente estético y no afecta a las lecturas.
4. Sin generador, una buena alternativa es una banda tranquila con una baliza de nivel conocido, o simplemente anclar el suelo de ruido a un valor plausible (p. ej. -120 dBm en 20 m con una antena decente) — asumiendo que así se calibra toda la cadena, incluida la ganancia de antena, y no solo el receptor.


### Variantes de la interfaz gráfica

Las cuatro variantes de la interfaz (S-meter analógico/digital x disposición v1/v2) viven en una sola construcción. Los visitantes cambian entre ellas con el menú ⚙️ de la esquina superior derecha — no se recarga nada, así que el audio, la cascada y cualquier decodificador en marcha continúan — y la elección se recuerda en cada navegador.
- Ejecute recompile.sh en un terminal para fijar la variante *inicial*, la que ve quien visita el sitio por primera vez.
- **[EDITING_VARIANTS.md](EDITING_VARIANTS.md)**: cómo editar las variantes del frontend (S-meter y disposición) y reconstruirlas

---

## 📚 Documentación

- **[INSTALLATION.md](INSTALLATION.md)**: guía de instalación completa para operadores de sistema
- **[ADMIN_PANEL_SETUP.md](ADMIN_PANEL_SETUP.md)**: guía de instalación para administradores del sistema
- **[USER_GUIDE.md](USER_GUIDE.md)**: guía para el usuario final sobre el manejo del WebSDR
- **[THERMAL_GUARD.md](THERMAL_GUARD.md)** - Manual del sysop para la protección contra sobrecalentamiento de la CPU: los cuatro modos y qué hacer con cada uno
- **[CONNECTION_LIMITS.md](CONNECTION_LIMITS.md)** - Manual del sysop para los límites de conexión: proteger un receptor público frente a avalanchas de conexiones
- **[PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md)**: estructura de directorios y organización del código
- **[EDITING_VARIANTS.md](EDITING_VARIANTS.md)**: cómo editar las variantes del frontend (S-meter y disposición) y reconstruirlas

---

## 🌐 Lista de WebSDR en línea

Registre su WebSDR en el directorio oficial: https://sdr-list.xyz

Establezca `register_online=true` en su archivo de configuración `.toml` para registrarlo automáticamente.

---

## 🐛 Resolución de problemas

### Problemas frecuentes

**OpenCL no funciona**
- Asegúrese de que los controladores estén correctamente instalados
- Compruébelo con el comando `clinfo`
- Consulte INSTALLATION.md para la configuración detallada de OpenCL

**Problemas de latencia de audio**
- Pruebe a alternar entre los códecs FLAC y Opus
- Ajuste la configuración del búfer
- Asegúrese de disponer de recursos de CPU/GPU suficientes

**Fallos de compilación**
- Compruebe que todas las dependencias estén instaladas
- Pruebe a limpiar el directorio de compilación: `rm -rf build && meson setup build`
- Busque versiones de bibliotecas en conflicto

---

## 🤝 Contribuir

¡Las contribuciones son bienvenidas! Este es un fork independiente con funciones adicionales. Por favor:

1. Haga un fork del repositorio
2. Cree una rama para la nueva función
3. Confirme sus cambios
4. Envíe la rama al repositorio remoto
5. Cree un Pull Request

---

## 📄 Licencia

Este proyecto se distribuye bajo la Licencia Pública General de GNU v3.0; consulte el archivo [LICENSE](../../LICENSE) para más detalles.

---

## 👥 Autores y créditos

- **SV1BTL y SV2AMK**: desarrollo y mejoras de PhantomSDR-Plus
- Basado en el proyecto original PhantomSDR

---

## 🔗 Enlaces

- **Demostración en directo**: http://phantomsdr.no-ip.org:8900/
- **Directorio WebSDR**: https://sdr-list.xyz
- **Repositorio de GitHub**: https://github.com/sv1btl/PhantomSDR-Plus

---

## 📞 Soporte

- **Incidencias**: informe de errores a través de [GitHub Issues](https://github.com/sv1btl/PhantomSDR-Plus/issues)
- **Correo electrónico**: contacto sv1btl@otenet.gr

---

## ⚡ Consejos de rendimiento

1. **Active OpenCL/CUDA** para la aceleración por GPU: reduce drásticamente el uso de CPU
2. **Use almacenamiento SSD** para un mejor rendimiento de E/S
3. **Asigne suficiente RAM**: se recomiendan al menos 8 GB
4. **Optimice el tamaño de la FFT**: una FFT mayor = mejor resolución, pero más uso de CPU
5. **Considere una GPU dedicada**: AMD o NVIDIA con compatibilidad OpenCL

---

**73 de SV1BTL & SV2AMK**

*Para instrucciones de configuración detalladas, consulte INSTALLATION.md* *Para la guía de manejo del usuario final, consulte USER_GUIDE.md*
