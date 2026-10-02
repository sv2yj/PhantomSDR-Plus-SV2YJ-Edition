# Guía del usuario de PhantomSDR-Plus

¡Bienvenido a PhantomSDR-Plus! Esta guía le ayudará a sacar el máximo partido a su experiencia de escucha con WebSDR.

---

## Índice

1. [Introducción](#introducción)
2. [Primeros pasos](#primeros-pasos)
3. [Descripción de la interfaz](#descripción-de-la-interfaz)
4. [Operaciones básicas](#operaciones-básicas)
5. [Funciones avanzadas](#funciones-avanzadas)
6. [Modos de demodulación](#modos-de-demodulación)
7. [Decodificadores digitales](#decodificadores-digitales)
8. [Atajos de teclado](#atajos-de-teclado)
9. [Marcadores](#marcadores)
10. [Uso en móviles](#uso-en-móviles)
11. [Consejos y buenas prácticas](#consejos-y-buenas-prácticas)
12. [Resolución de problemas](#resolución-de-problemas)
13. [Preguntas frecuentes](#preguntas-frecuentes)

---

## Introducción

### ¿Qué es PhantomSDR-Plus?

PhantomSDR-Plus es una radio definida por software (SDR) basada en web que le permite escuchar señales de radio a través de Internet. No necesita software ni hardware especial por su parte: ¡basta con un navegador web moderno!

### ¿Qué puede escuchar?

Según la configuración del WebSDR, podrá sintonizar:

- **Radioafición**: radioaficionados de todo el mundo
- **Emisoras de radiodifusión**: radio AM/FM, emisiones en onda corta
- **Aviación**: control del tráfico aéreo, comunicaciones aeronáuticas
- **Marítimo**: comunicaciones barco-costa, meteorología marítima
- **Satélites meteorológicos**: NOAA, METEOR-M
- **Modos digitales**: FT8, RTTY, PSK31 y más
- **Estaciones de servicio**: señales horarias, militares, gubernamentales

### Requisitos del sistema

- **Navegador**: Chrome/Edge (recomendado), Firefox, Safari
- **Conexión**: Internet de banda ancha (se recomienda 1 Mbps o más)
- **Audio**: altavoces o auriculares en funcionamiento
- **Opcional**: ratón con rueda para sintonizar con mayor comodidad

---

## Primeros pasos

### 1. Acceda al WebSDR

Abra su navegador y vaya a la dirección del WebSDR que le haya facilitado el operador.

Ejemplo: `http://websdr.example.com:9002`

### 2. Carga inicial de la página

Al cargarse la página verá:
- una cascada de colores que muestra la actividad radioeléctrica
- un panel de control con el indicador de frecuencia y los botones
- un S-metro que indica la intensidad de la señal
- un indicador del número de usuarios

### 3. Empiece a escuchar

1. **Haga clic sobre una señal** en la cascada
2. **El audio comenzará automáticamente**
3. **Ajuste el volumen** con el control del navegador o el deslizador en pantalla
4. **Afine la frecuencia** haciendo clic con precisión sobre la señal

---

## Descripción de la interfaz

### Componentes principales

```
┌──────────────────────────────────────────────────────────────────────────┐
│  WebSDR <callsign>, located in <QTH>              ⚙ [ Analog S-Meter ▾ ] │
│  email · Keyboard Shortcuts · Users · Stats · Other servers 1 2 3        │
│  Frequency Search: MW SW HamDash PSK Reporter WSPRnet · Callsign Search  │
│                        [ Open Additional Info ]                          │
├──────────────────────────────────────────────────────────────────────────┤
│                     Spectrum  +  Waterfall                               │
│                     band-plan strip along the bottom                     │
├───────────────────────┬────────────────────────────┬─────────────────────┤
│ Audio & Buffer        │   Frequency  │  S-Meter    │ Waterfall Controls  │
│   volume · SQ · zoom  │   7,120.00   │  dBm dBμV   │   Min · Max · zoom  │
│ AGC Auto Fast Med Slow│   band · VFO │  SNR · NF   │   colour-map strip  │
│   Compressor Equalizer├────────────────────────────┤ Zoom In Out Max Min │
│ Filters               │  Fine Tuning (kHz)         │ Waterfall Spectrum  │
│   NR NB NS AN CTCSS   │  VFO A · Modes · Bands     │ Auto Adj. Height    │
│ Modes selector        │           · IF Filters     │ [ profile ▾ ]       │
│   ...  RADEL  RADEU   │  Wheel Tuning Steps        │ [ Bookmarks ]       │
│   USB LSB CW AM QUAM  │  Decoders                  │                     │
│   FM                  │   FT8 FT4 FT2 JS8 CW WSPR  │                     │
│ Band selector         │   FAX SSTV NAVTEX RTTY ... │                     │
└───────────────────────┴────────────────────────────┴─────────────────────┘
```

Los tres paneles bajo la cascada se desplazan como una sola página; en una ventana estrecha se apilan en lugar de ponerse uno al lado del otro. **RADEL** y **RADEU** están en la propia línea del encabezado *Modes selector*, a su derecha.

### 1. Cascada (waterfall)

La cascada es una representación visual de las señales de radio:

- **Eje horizontal**: la frecuencia
- **Eje vertical**: el tiempo (se desplaza hacia abajo)
- **Colores**: la intensidad de la señal
  - **Azul oscuro/negro**: sin señal (nivel de ruido)
  - **Verde/amarillo**: señales débiles o moderadas
  - **Naranja/rojo**: señales fuertes
  - **Blanco**: señales muy fuertes

### 2. Indicador de frecuencia

Muestra la frecuencia sintonizada en distintos formatos:
- **MHz**: 7.100.000 MHz (bandas de HF)
- **kHz**: 14200 kHz
- **Hz**: 145500000 Hz (VHF/UHF)

### 3. S-metro (analógico o digital)

Muestra la intensidad de la señal:
- **S1-S9**: escala estándar de intensidad de señal
- **+dB**: señales por encima de S9 (p. ej., S9+20dB)
- **Analógico o digital**: según la configuración

### 4. Botones de modo

Seleccione el modo de demodulación:
- **AM**: modulación de amplitud
- **FM**: modulación de frecuencia
- **USB**: banda lateral superior
- **LSB**: banda lateral inferior
- **CW**: código Morse (onda continua)
- **WBFM**: FM de banda ancha (radiodifusión)
- **QUAM**: AM estéreo C-QUAM — la etiqueta se pone verde cuando se detecta un piloto estéreo

Junto al encabezado **Modes selector** están los botones **RADEL** y **RADEU**, que inician la voz digital RADE v1 con una sola pulsación — consulte [Decodificadores digitales](#decodificadores-digitales).

### 5. Panel de control

Controles adicionales:
- **AGC**: control automático de ganancia
- **NR**: reducción de ruido (espectral)
- **NB**: supresor de impulsos
- **NS**: supresión del ruido de fondo
- **AN**: notch automático
- **CTCSS**: silenciador por subtono (FM)
- **SQL**: silenciador (squelch)
- **AI**: reducción de ruido por IA (solo voz)
- **Zoom**: nivel de ampliación de la cascada
- **Wheel Tuning Steps**: paso de sintonía de la rueda del ratón
- **Decoders**: botones que inician y detienen cada decodificador con una pulsación

### 6. Superposición del plan de bandas

Barras de color que muestran las atribuciones de frecuencia:
- colores distintos para servicios distintos
- ayuda a identificar qué está permitido en cada frecuencia

---

## Operaciones básicas

### Sintonizar una frecuencia

#### Método 1: hacer clic en la cascada

1. Haga clic directamente sobre una señal de la cascada
2. El receptor sintonizará esa frecuencia
3. Comenzará a reproducirse el audio

#### Método 2: escribir la frecuencia

1. Haga clic en el indicador de frecuencia
2. Escriba la frecuencia deseada
3. Pulse Intro

Ejemplos:
- `7100` → 7.100 MHz
- `14200.0` → 14.200 MHz
- `145.500` → 145.500 MHz

#### Método 3: usar la rueda del ratón

1. Sitúe el puntero sobre el indicador de frecuencia
2. Rueda hacia arriba para aumentar la frecuencia
3. Rueda hacia abajo para reducirla

#### Método 4: botones de paso

1. Utilice los botones **▲** y **▼** junto a la frecuencia
2. El paso varía según el modo:
   - **AM/FM**: pasos de 1 kHz
   - **SSB**: pasos de 100 Hz
   - **CW**: pasos de 10 Hz

### Escáner

El escáner recorre el receptor por un margen de canales y se detiene en el primero que lleva señal. Está en la fila **Fine Tuning (kHz)**, a la derecha del todo:

```
7 152.0   ◀  ■  ▶  ⊘   30 dB · 4 ▾
```

| Control | Qué hace |
|---------|----------|
| **◀ ▶** | Explorar hacia abajo / arriba. Detenido sobre una señal, una flecha reanuda la exploración. |
| **■** | Detener. |
| **⊘** | Excluir este canal de la exploración — para una portadora fija o un espurio. |
| **30 dB · 4 ▾** | El umbral, y a su lado el nivel que se mide en este momento. Abre los ajustes. |

El texto de la izquierda indica qué hace el escáner: `Scanner` en reposo, la frecuencia alcanzada mientras explora, `◉ 3s` mientras cuenta para reanudar,
`◉ 30·22s` mientras el canal sigue ocupado, `◉ hold` cuando se quedará ahí.

**Ajustes**

- **Range** — *Scan Band* recorre la banda donde empieza la exploración;
  *Scan Visible* recorre exactamente lo que muestra la cascada y la sigue si
hace zoom o la arrastra.
- **Scan** — *Every channel* sintoniza y escucha cada canal por turno;
  *Skip empty* lee el espectro y salta directamente a las señales.
- **Stop at** — cuánto por encima del ruido de fondo de la banda debe estar un
canal para detener la exploración, en dB. El ruido se sigue de forma continua, así que el mismo ajuste vale de día y de noche. Un canal vacío no marca 0 dB — observe un momento la cifra en el botón y ponga el umbral por encima.
- **Resume after** — cuánto tiempo debe permanecer en silencio un canal antes de
seguir. Las pausas del habla no lo reinician. *Hold* se queda hasta que pulse un botón.
- **Max stay** — sigue adelante pasado este tiempo aunque la señal continúe, para
que una portadora permanente no retenga la exploración indefinidamente.

El paso sigue al modo — 1 kHz en SSB, 0,1 kHz en CW, 5 kHz en AM, 9 o 10 kHz en onda media y 9 kHz en onda larga — y las paradas caen en la retícula de canales. La exploración se mantiene dentro de su margen y de lo que el receptor puede sintonizar; en un extremo continúa por el otro.

Los ajustes y los canales excluidos se recuerdan en su navegador.


### Seleccionar el modo de demodulación

Elija el modo adecuado para la señal:

**Para comunicaciones de voz:**
- **AM**: aviación, radiodifusión en AM, algo de radioafición
- **FM**: repetidores de VHF/UHF, radiodifusión en FM
- **USB**: radioafición en HF (20 m, 17 m, 15 m, 12 m, 10 m)
- **LSB**: radioafición en HF (160 m, 80 m, 40 m, 30 m)

**Para datos/digital:**
- **USB**: la mayoría de los modos digitales (FT8, PSK31, RTTY)
- **LSB**: algunos modos digitales en las bandas bajas de HF

**Para código Morse:**
- **CW**: señales de telegrafía/Morse

### Ajustar el volumen

- **Deslizador en pantalla**: arrastre el control de volumen
- **Volumen del navegador**: use los controles multimedia del navegador
- **Volumen del sistema**: ajuste el volumen del ordenador
- **Teclado**: use las teclas + y - (si están admitidas)

### Uso del S-metro

El S-metro indica la intensidad de la señal:

- **S0-S3**: señal muy débil, difícil de copiar
- **S4-S6**: señal débil o aceptable
- **S7-S9**: señal buena o fuerte
- **S9+**: señal extremadamente fuerte

**Consejo**: para obtener el mejor audio, sintonice señales que marquen S7 o más.

**Cambiar la esfera del instrumento**: en el S-meter analógico (de aguja), haga clic sobre el propio instrumento —o enfóquelo y pulse Enter o Espacio— para recorrer tres fondos: metal cepillado oscuro, una esfera clara gris pálido y una cálida esfera ámbar de estilo vintage. Su navegador recuerda la elección, así que sigue ahí tras una recarga o un reinicio. Es por navegador y por dirección: abrir el receptor por nombre de host y por IP da dos ajustes separados, y una ventana privada siempre parte del valor por defecto del sitio.

---

## Funciones avanzadas

### Control automático de ganancia (AGC)

El AGC ajusta automáticamente los niveles de audio:

- **Off**: sin ajuste automático de ganancia
- **Slow**: cambios de nivel graduales (ideal para SSB)
- **Medium**: respuesta equilibrada
- **Fast**: ajuste rápido (ideal para AM)

**Recomendación**: empiece con «Fast» para AM y «Slow» para SSB.

### Los cuatro controles de ruido

NR, NB, NS y AN son botones de encendido/apagado independientes, cada uno contra un tipo distinto de ruido. Son independientes entre sí — encender uno no enciende otro — y se pueden combinar libremente.

Ninguno llega a los decodificadores: FT8, CW, WSPR, SSTV, FAX, NAVTEX, RTTY/PSK31/Olivia y el grabber QRSS leen el audio *antes* de estos filtros, así que puede ajustarlos puramente de oído sin afectar a lo que se decodifica. Véase el [manual de decodificadores](DECODERS.md#12-consejos-generales).

### Reducción de ruido (NR)

Reducción de ruido espectral. Estima el nivel de ruido en cada parte del espectro de audio y baja esas partes, dejando en paz lo que sobresale del ruido.

**Úselo cuando**: oiga un siseo constante o ruido blanco detrás de la señal.

Los tonos constantes — una nota de CW, una portadora — se reconocen como señal y quedan protegidos, de modo que NR no se come una señal de CW como haría un filtro ingenuo. Efecto típico: 10 dB menos de ruido entre las palabras, a cambio de unas décimas de dB de la voz misma.

### Supresor de impulsos (NB)

Elimina el ruido impulsivo: clics, chasquidos, descargas atmosféricas, encendido de motores y ruido de la red eléctrica. Vigila la envolvente del audio y silencia solo las muestras que se disparan muy por encima de ella — alrededor de un milisegundo por descarga, con entrada y salida suavizadas para que el propio recorte no produzca un clic.

**Úselo cuando**: oiga clics o chasquidos de líneas eléctricas, motores,
tormentas o encendido de vehículos.

Los notch de zumbido de red de 50 Hz y 60 Hz siguen a este botón.

### Supresión del ruido de fondo (NS)

Mide durante varios segundos el propio suelo de ruido de la banda y aplica un corte fijo a lo que se sitúa en él, más profundo en las frecuencias de audio altas que en las bajas. Donde NR reacciona instante a instante, NS es la mano lenta y firme: baja el siseo de la banda sin cambiar cómo suena la señal.

**Úselo cuando**: la banda esté tranquila pero siseante y quiera bajar el ruido
sin la calidad "submarina" de una NR agresiva.

Activo solo en USB, LSB y AM: CW, FM y los modos digitales quedan intactos. Vuelve a medir el suelo cada vez que cambia de frecuencia o de modo, y se asienta en pocos segundos.

### Notch automático (AN)

Encuentra y elimina automáticamente tonos interferentes constantes — heterodinos, portadoras, silbidos — sin que usted tenga que colocar un notch a mano. Se adapta de forma continua, así que puede quitar varios tonos a la vez y mantener notchado uno que derive.

**Úselo cuando**: oiga un silbido o tono encima de la señal que quiere.

Se desactiva en CW, donde la señal deseada *es* un tono constante.

**Nota sobre el retardo**: NR y NS añaden cada uno unos 40 ms de retardo de audio
mientras están activos (los dos juntos, unos 80 ms). NB y AN no añaden ninguno. Esto afecta solo a la escucha, nunca a los decodificadores.

### Silenciador automático (SQL)

Silencia el audio cuando no hay señal:

- **Off**: siempre suena (se oye la estática)
- **Auto**: fija el umbral automáticamente
- **Manual**: ajuste manual del umbral

**Úselo cuando**: vigile una frecuencia a la espera de actividad.

### Reducción de ruido por IA (AI)

El botón **AI**, con un deslizador de intensidad al lado, está en el panel Audio & Buffer, justo debajo de SQ. En la página /mobile está en la pestaña Audio, debajo de Squelch. Elimina el ruido de banda de la voz mediante RNNoise, una pequeña red neuronal entrenada con voz.

Todo ocurre en su propio navegador: no se envía nada a ningún servidor externo, no hace falta cuenta y el receptor no tiene trabajo adicional.

- **Encendido/apagado**: pulse **AI**; el botón se vuelve azul. La primera pulsación descarga el módulo (unos 1,3 MB) y el botón parpadea mientras carga.
- **Intensidad**: el deslizador mezcla el sonido limpio con el original — al 100 % todo se procesa, los valores más bajos devuelven parte de la banda. El valor predeterminado es 50 %. Puede ajustarlo aunque AI esté apagado.
- **Indicador de estado**: el indicador AI bajo la frecuencia se enciende en cian mientras AI trabaja, y aparece medio atenuado cuando AI está activo pero el modo actual no es de voz.

**Úselo cuando**: escuche voz en SSB o AM en una banda ruidosa. El soplido entre palabras suele bajar de 10 a 20 dB mientras la voz conserva su nivel.

Solo modos de voz — USB, LSB, AM y SAM. En CW, FM, modos digitales y C-QUAM el audio pasa sin cambios, porque la red trata un tono de CW o la música como ruido. Como los cuatro controles de ruido, nunca llega a los decodificadores. En estaciones muy débiles (alrededor de 0 dB de SNR) la voz puede sonar procesada; si una señal suena «acuosa», baje el deslizador. Añade unos 30 ms de retardo de audio.

### Función de zoom

Amplía la cascada:

- **1x**: vista normal (cobertura amplia)
- **2x**: ampliación ×2
- **4x**: ampliación ×4
- **8x**: ampliación ×8

**Úsela cuando**: necesite ver las señales con más claridad o sintonizar con precisión.

### Control del transceptor (CAT)

Su propio transceptor y la página del receptor pueden mantenerse en la misma frecuencia: gire el dial del equipo y la cascada lo sigue, o haga clic en una señal de la cascada y el equipo se sintoniza en ella. Solo afecta a *su* sesión de escucha; nadie más en el receptor lo nota.

**Con Desktop PhantomSDR+ (4.0 o posterior).** La aplicación de escritorio tiene un menú **Rig**. *Rig → Rig control...* abre una ventana donde elige su equipo y la forma de conectarlo, y el propio menú activa y desactiva la sincronización. Sincroniza frecuencia, modo y ancho de filtro, en un sentido o en ambos, y puede silenciar el receptor mientras transmite. Además de PhantomSDR-Plus maneja del mismo modo receptores **KiwiSDR, PA3FWM WebSDR y UberSDR**. Llega al equipo de una de estas cuatro formas:

- **Integrado** — sin otro software: Icom (CI-V), Yaesu (CAT nuevo y FT-817/857/897), Kenwood, Elecraft, FlexRadio SmartSDR CAT, QRP Labs y otros equipos compatibles con Kenwood.
- **Hamlib** — cualquier equipo que conozca Hamlib, más de 300, elegido de una lista con búsqueda. Los instaladores de Windows incluyen Hamlib; en Linux instale `libhamlib-utils`.
- **rigctld en la red** — un `rigctld` que ya está en marcha.
- **flrig** — para un equipo que flrig ya comparte con fldigi, WSJT-X o un programa de registro.

La aplicación, sus instaladores y su manual completo están en [Desktop PhantomSDR+ (Dropbox)](https://www.dropbox.com/scl/fo/kjwj96zg3kj7dgq4fjef9/APnA3c9hhv4hk3YMGIGjH7s?rlkey=jfiwklly63kv73poalx631pk3&st=m37uvaym&dl=0).

**Con un navegador web.** La [CATsync Tool for WebSDRs](https://catsyncsdr.wordpress.com/) (Windows) acopla un equipo a la página del receptor abierta en su navegador. Sincroniza frecuencia y modo.

**El ancho de filtro y el silencio al transmitir** funcionan en receptores KiwiSDR, WebSDR y UberSDR, y en un receptor PhantomSDR-Plus con la 4.1.0 o posterior. En un PhantomSDR-Plus más antiguo la frecuencia y el modo siguen sincronizándose; el filtro no.

El manual completo — cada ajuste, los equipos admitidos, cómo se evita que los dos lados se peleen y la solución de problemas — es **[Control del transceptor](RIG_CONTROL.md)**.

**Para desarrolladores.** Cada página de receptor ofrece estas funciones en `window`, que son las que usan ambas herramientas:

| Función | Qué hace |
|---|---|
| `catsync_getFrequency()` / `catsync_setFrequency(hz)` | Frecuencia sintonizada, en Hz |
| `catsync_getMode()` / `catsync_setMode(mode)` | `USB`, `LSB`, `CW`, `CW-L`, `AM`, `FM`, `WBFM` … |
| `catsync_getBandwidth()` / `catsync_setBandwidth(hz)` | Ancho total de la banda de paso, en Hz. Fíjelo después del modo: cambiar de modo restablece la banda de paso |
| `catsync_getMute()` / `catsync_setMute(on)` | Silencio, mediante el propio botón de silencio de la página |
| `catsync_ready` | `true` en cuanto las funciones están instaladas |

Las tres últimas filas son nuevas en la 4.1.0; compruebe que una función existe antes de llamarla.

---

## Modos de demodulación

### AM (modulación de amplitud)

**Se usa para:**
- comunicaciones aeronáuticas
- radiodifusión en AM
- parte de la radioafición
- comunicaciones marítimas

**Características:**
- ancho de banda amplio (normalmente 10 kHz)
- sensible al ruido
- fácil de sintonizar (basta con hacer clic en la señal)

**Buenas prácticas:**
- use AGC rápido
- active el supresor de impulsos si oye chasquidos
- sintonice el pico de la señal en la cascada

### QUAM (AM estéreo C-QUAM)

**Se usa para:**
- Emisoras de onda media que transmiten AM estéreo

**Características:**
- 10 kHz de ancho, se decodifica como par estéreo en lugar de AM mono
- La etiqueta del botón se pone **verde** por sí sola cuando está presente el piloto estéreo de 25 Hz, así se ve qué emisoras están realmente en estéreo antes de seleccionarlo
- Desde AM, pulsar de nuevo el botón pasa a detección síncrona sobre la portadora; la etiqueta se pone **amarilla** y muestra `SAM`. Una tercera pulsación vuelve al AM normal
- El audio C-QUAM viaja con Opus; el resto de modos usa FLAC

**Buenas prácticas:**
- Busque la etiqueta verde en señales fuertes de onda media por la noche
- Si el estéreo suena inestable, `SAM` es más firme con portadora débil

### FM (modulación de frecuencia)

**Se usa para:**
- repetidores de radioafición de VHF/UHF
- servicios públicos (policía, bomberos, emergencias)
- radio comercial bidireccional
- algunas comunicaciones por satélite

**Características:**
- ancho de banda estrecho (normalmente 12,5 o 25 kHz)
- excelente inmunidad al ruido
- «efecto captura» (gana la señal más fuerte)

**Buenas prácticas:**
- sintonice con precisión el centro de la señal
- use el silenciador para enmudecer en reposo
- desactive la reducción de ruido (no hace falta)

### USB (banda lateral superior)

**Se usa para:**
- radioafición en HF (por encima de 10 MHz)
- la mayoría de los modos digitales de HF
- comunicaciones marítimas (por encima de 8 MHz)

**Características:**
- ancho de banda estrecho (normalmente 2.4 kHz)
- uso eficiente del espectro
- exige sintonía precisa

**Buenas prácticas:**
- use AGC lento
- sintonice el borde inferior de la señal en la cascada
- active la reducción de ruido si hace falta

### LSB (banda lateral inferior)

**Se usa para:**
- radioafición en HF (por debajo de 10 MHz)
- algunos modos digitales de HF
- comunicaciones marítimas (por debajo de 8 MHz)

**Características:**
- igual que USB pero en imagen especular
- convención: LSB en las bandas bajas de HF

**Buenas prácticas:**
- use AGC lento
- sintonice el borde superior de la señal en la cascada
- active la reducción de ruido si hace falta

### CW (onda continua / código Morse)

**Se usa para:**
- telegrafía de radioaficionados
- radiobalizas de navegación
- estaciones de señales horarias

**Características:**
- ancho de banda muy estrecho (100-500 Hz)
- gran eficiencia
- requiere conocer el código Morse para entenderlo

**Buenas prácticas:**
- use un filtro estrecho (400-500 Hz)
- sintonice con precisión el centro del tono
- active el filtro de audio para obtener mejor tono

### CW-L (CW, banda lateral inferior)

El mismo filtro Morse de ±250 Hz que **CW**, pero el tono se toma por debajo de la portadora en lugar de por encima. Úselo cuando una señal se copie mejor por el lado bajo, o cuando una portadora interferente quede justo por encima de la deseada.

**No hay botón CW-L en la página de escritorio.** Su fila de modos es `USB · LSB · CW · AM · QUAM · FM`. CW-L se ofrece en la página simplificada `/mobile`, y en escritorio todavía puede fijarse mediante un enlace o un marcador que lo nombre.

### WBFM (FM de banda ancha)

**Se usa para:**
- radiodifusión en FM (88-108 MHz)
- algunos enlaces descendentes de satélite

**Características:**
- ancho de banda muy amplio (200 kHz)
- excelente calidad de audio
- alta fidelidad

**Buenas prácticas:**
- sintonice exactamente la frecuencia central
- no hace falta silenciador para la radiodifusión
- ¡disfrute de un audio de gran calidad!

---

## Decodificadores digitales

PhantomSDR-Plus incluye decodificadores integrados para modos digitales. Para una guía completa, consulte [Decodificadores](DECODERS.md).

La vía más rápida es la fila de botones **Decoders** del panel principal, justo debajo de **Wheel Tuning Steps**: diez botones — **FT8, FT4, FT2, JS8, CW, WSPR, FAX, SSTV, NAVTX, RTTY** — que, con una sola pulsación, activan su decodificador, ponen en ON el interruptor principal Decoder y desplazan la ventana del decodificador hasta hacerla visible. El botón permanece azul mientras el decodificador funciona; púlselo de nuevo para detenerlo y cerrar su ventana. El desplegable **Decoder Options** sigue funcionando igual que antes y se mantiene sincronizado con los botones.

**RADEL** y **RADEU** (voz digital RADE v1) tienen sus propios botones junto al encabezado **Modes selector** y dentro de las ventanas emergentes **Modes** y **Bands**, y funcionan del mismo modo: pulsar para iniciar, volver a pulsar para detener.

Los decodificadores de SSTV, FAX de HF, NAVTEX, FSK/RTTY y CW se ejecutan cada uno en su propio hilo en segundo plano, de modo que activar o desactivar un decodificador nunca interrumpe el audio y la cascada sigue fluida mientras se decodifica. Reciben audio tomado antes del AGC, la reducción de ruido y el silenciado: puede silenciar el receptor y la decodificación continúa sin verse afectada.

**Mientras un decodificador está en marcha, retiene el modo y el paso de banda.** Normalmente el modo sigue el plan de bandas: sintonice un segmento marcado LSB o AM y el receptor cambia. Un decodificador en marcha manda por encima de eso y conserva el modo y el paso de banda estrecho que necesita, aunque se vaya a otra banda. El modo propio de la banda vuelve en cuanto apaga el decodificador, y los botones de modo funcionan en todo momento si quiere tomar el mando. El decodificador de CW es la excepción: decodifica en el modo en que usted esté escuchando.

### Decodificador FT8, FT4

**¿Qué son FT8 y FT4?**
- modos digitales muy populares en radioafición
- comunicación con señales débiles
- transmisiones de 15 segundos en FT8 y de 7,5 segundos en FT4

**Cómo se usa:**
1. Sintonice frecuencias de FT8 o FT4
2. Seleccione el modo USB
3. Active el decodificador FT8: pulse el botón **FT8** o selecciónelo desde el menú
4. Observe cómo aparecen los mensajes decodificados

**Frecuencias habituales de FT8 (USB):**
- 160 metros: 1.840 MHz
- 80 metros: 3.573 MHz
- 60 metros: 5.357 MHz
- 40 metros: 7.074 MHz
- 30 metros: 10.136 MHz
- 20 metros: 14.074 MHz
- 17 metros: 18.100 MHz
- 15 metros: 21.074 MHz
- 12 metros: 24.915 MHz
- 10 metros: 28.074 MHz
- 6 metros: 50.313 MHz (50.323 MHz para DX)

**Frecuencias habituales de FT4 (USB):**

- 80 m: 3.575 MHz
- 40 m: 7.0475 MHz
- 30 m: 10.140 MHz
- 20 m: 14.080 MHz
- 17 m: 18.104 MHz
- 15 m: 21.140 MHz
- 12 m: 24.919 MHz
- 10 m: 28.180 MHz
- 6 m: 50.318 MHz

---

### Decodificador JS8

**¿Qué es JS8?**
- El motor de señal débil de FT8 usado para conversación de teclado a teclado
- Texto libre en vez de intercambios fijos: los mensajes largos llegan en varios ciclos
- Cinco velocidades; **Normal** (15 s) es la de llamada y concentra casi todo el tráfico

**Cómo usarlo:**
1. Sintonice una frecuencia de JS8
2. Seleccione modo **USB**
3. Active el decodificador JS8 — botón **JS8** o desde el menú
4. Deje **Speed** en *Normal* y el sync offset en **Auto**

**Cómo leer el panel:**
- Los mensajes que aún llegan se muestran arriba en verde con un cursor parpadeante — en Normal un mensaje puede tardar un minuto entero
- Los completos se listan debajo como `Mode | Hz | dB | Message`, con **los indicativos en verde**
- Una fila atenuada y en cursiva expiró antes de su última trama: el texto es real pero puede estar cortado

**Frecuencias JS8 habituales (USB):**

- 160m: 1.842 MHz
- 80m: 3.578 MHz
- 40m: 7.078 MHz
- 30m: 10.130 MHz
- 20m: 14.078 MHz
- 17m: 18.104 MHz
- 15m: 21.078 MHz
- 12m: 24.922 MHz
- 10m: 28.078 MHz

JS8 es mucho más tranquilo que FT8: una transmisión cada pocos minutos es normal y los silencios no son un fallo. Guía completa: [Decodificadores](DECODERS.md).

---

### Decodificador de CW
Basta con pulsar el botón CW y aparecerá el texto decodificado. Pulse el botón CW una vez más para limpiar la ventana y reiniciar el decodificador.

---

### WSPR

WSPR (Weak Signal Propagation Reporter, pronunciado «whisper») es un modo baliza de señales ultradébiles que cartografía las trayectorias de propagación en HF por todo el mundo. Cada transmisión dura unos 110 segundos y cabe en una ranura de 200 Hz de ancho. El decodificador espera a una ranura completa de 2 minutos alineada con UTC antes de decodificar. Active el decodificador y seleccione **WSPR** en la lista desplegable. O basta con pulsar el botón **WSPR**.

---

### FAX de HF / WEFAX

El radiofax de HF (también conocido como WEFAX) lo utilizan los servicios de guardacostas y meteorológicos de todo el mundo para difundir mapas del tiempo, cartas del estado del mar y análisis de superficie por onda corta. El decodificador reconstruye la imagen línea a línea a medida que se recibe.

---

### NAVTEX

NAVTEX es el sistema internacional de radiodifusión marítima de información de seguridad costera: avisos a la navegación, previsiones meteorológicas y avisos de búsqueda y rescate.

---

### FSK / RTTY, PSK31 y Olivia

Un decodificador de uso general para modos de texto de banda estrecha, con cinco variantes en una sola ventana: FSK marítimo (SITOR), RTTY meteorológico, RTTY de aficionado, **PSK31** (modulación por desplazamiento de fase, 31,25 baudios) y **Olivia** (FSK multitono con corrección de errores). El panel se adapta a la variante — los controles de shift, baudios y trama desaparecen en PSK31 y Olivia, y Olivia añade un selector de Mode y un deslizador de squelch.

Dos cosas que conviene saber: PSK31 corrige por sí mismo su error de sintonía en unos ±25 Hz, así que basta con acercarse; Olivia necesita que **Mode** (tonos / ancho de banda) coincida exactamente con la transmisión, no envía preámbulo y por tanto tarda unos segundos en sincronizarse antes de que aparezca texto. El panel se abre en Olivia **8 / 250**.

---

### Grabber QRSS

QRSS es CW enviado tan despacio que un solo punto dura segundos, y se mira en lugar de escucharse: el grabber dibuja la traza en su propia presentación. No está en el desplegable de decodificadores; tiene su propia sección **QRSS** y puede funcionar a la vez que un decodificador.

Pulse **🐌 Show**, elija después una ventana en la lista **Band** y pulse **Tune**: el receptor va a esa frecuencia en **CW** con un paso de banda a la medida del modo, y la traza cae sobre la línea central de la presentación. La ventana más concurrida es la de 30 m (10.140,00 kHz). Ajuste **Speed** a la baliza —**QRSS 10** si no lo sabe— y tenga paciencia: un indicativo puede tardar diez minutos en cruzar la pantalla. Todos los detalles en [Decodificadores](DECODERS.md).

---

### SSTV

La televisión de barrido lento envía imágenes fijas por un canal SSB normal, línea a línea. Active el decodificador, seleccione **SSTV** y sintonice una frecuencia de SSTV: 14.230 MHz es la principal frecuencia internacional de llamada. Deje **Mode** en **Auto**: el decodificador lee la cabecera VIS de la transmisión y, si sintonizó después de la cabecera, identifica el modo a partir de la temporización de sincronismo. Se admiten los modos Martin, Scottie y Robot, y la imagen se va formando línea a línea según llega. O basta con pulsar el botón **SSTV**.

### Reporte automático de spots y gráficas del servidor

Las decodificaciones de FT8, FT4 y WSPR también puede subirlas el propio servidor — FT8/FT4 a PSK Reporter y WSPR a WSPRnet — mediante un demonio autorun que el sysop inicia desde el panel de administración. Es independiente de los decodificadores de su navegador: sigue funcionando haya o no oyentes, y nada de lo que usted decodifique en el navegador se reporta.

El sysop lo sigue con dos contadores, fáciles de confundir entre sí: los paneles por decodificador cuentan los spots subidos desde el último arranque del demonio, mientras que el número junto a cada casilla de banda/modo es el total histórico de esa ranura y sobrevive a los reinicios. El mismo panel tiene una página **Gráficos** que representa la frecuencia de CPU, la carga, la temperatura y los usuarios conectados en los últimos 15 minutos a 24 horas. Ambos se describen en la [guía del panel de administración](ADMIN_PANEL_SETUP.md).


---

## Atajos de teclado

Atajos de teclado para trabajar más rápido.

---

### Control de frecuencia

El indicador de frecuencia es una fila de dígitos que se maneja directamente. **Haga clic primero en un dígito**: eso lo selecciona, y todo lo de abajo actúa sobre la selección.

- **Flecha izquierda / derecha**: mueve la selección al dígito contiguo (ocho dígitos, de 100 MHz a 10 Hz)
- **Flecha arriba / abajo**: sube o baja el dígito *seleccionado* según su valor posicional: 1 MHz en el dígito de los MHz, 10 Hz en el último
- **0 – 9**: escribe ese dígito directamente en la posición seleccionada

**Rueda del ratón sobre el indicador de frecuencia**: avanza con el paso de sintonía de la banda (1 kHz salvo que el plan de bandas indique otro). Mantenga **Shift** para 1 kHz y **Alt** para 10 kHz.

**Rueda del ratón sobre la cascada**: hace zoom. Mantenga **Ctrl** (o **Cmd**) o **Shift** para sintonizar en lugar de ampliar, y **Shift + Ctrl** juntos para ajustar al kHz entero más cercano.

> No hay atajos de Página arriba / Página abajo.

---

## Marcadores

Guarde sus frecuencias favoritas para acceder a ellas rápidamente. También puede exportar la lista de marcadores y guardarla localmente, y después importarla en cualquier otro PhantomSDR.

Cuando los marcadores propios y los del plan de bandas se solapan:

🔵 Los marcadores azules aparecen encima <br /> 🟡 Los marcadores amarillos, debajo <br />
✅ Los clics en los marcadores azules tienen prioridad <br />


### Añadir un marcador

1. Sintonice la frecuencia deseada
2. Haga clic en el botón «Bookmarks»
3. Haga clic en «Add Bookmark»
4. Escriba una descripción
5. Haga clic en «Save»

┌──────────────┬────────────────┬────────┐ │ Bookmark name│Label (optional)│ [Add]  │ └──────────────┴────────────────┴────────┘

### Cómo se usa:

**Añadir un marcador:**
- Nombre: «Local News Station»
- Etiqueta: «NEWS»
- Haga clic en Add

**Verlo en la cascada:**
- amplíe hasta que aparezcan los marcadores
- verá un recuadro azul marino con «NEWS» en amarillo y negrita

**Hacer clic en el marcador:**
- sintoniza la frecuencia
- fija el modo de demodulación
- funciona igual que hacer clic en un marcador del plan de bandas

### Gestionar los marcadores
- **Editar**: haga clic en el icono del lápiz junto al marcador
- **Eliminar**: haga clic en el icono de la papelera junto al marcador
- **Exportar**: descargue los marcadores como archivo JSON
- **Importar**: cargue marcadores desde un archivo JSON

### Compartir marcadores

1. Haga clic en «Export Bookmarks»
2. Comparta el archivo JSON con otras personas
3. Los destinatarios hacen clic en «Import Bookmarks»
4. Seleccionan su archivo
---

## Uso en móviles

¡PhantomSDR-Plus funciona de maravilla en dispositivos móviles!

### Dos vistas móviles

Hay dos formas de usar el receptor desde el teléfono:

- **`http://su_servidor:PUERTO/mobile`**: la página simplificada. Sin cascada, por lo que consume aproximadamente la mitad de datos. Entrada de frecuencia, pasos de sintonía, modos, S-meter, bandas, marcadores, usuarios y chat.
- **La vista ampliada**: la disposición para teléfono de la interfaz principal, con la cascada y todos los controles.

Se cambia con los botones de la parte inferior de `/mobile` (**Mobile extended view**, **Full desktop view**) y con **Simplified mobile** en la vista ampliada.

**Su frecuencia le acompaña.** Cambiar de vista le mantiene en la misma señal: la frecuencia y el modo viajan en el enlace, así que ya no acaba en la frecuencia predeterminada del receptor. La barra de direcciones también sigue su sintonía, de modo que recargar la página, guardarla como marcador o enviar el enlace a alguien devuelven exactamente a esa frecuencia.

**El modo sigue el plan de bandas en ambas páginas.** Sintonice un segmento marcado como AM, LSB, USB o CW —escribiendo una frecuencia, avanzando a pasos o pulsando un botón de banda— y el receptor cambia a ese modo, tanto en la página simplificada como en la interfaz completa. Un modo elegido a mano se mantiene mientras se mueve dentro del mismo segmento, y fuera de las bandas definidas su modo no se toca. Mientras **RADE** (RADEL/RADEU) está en marcha conserva el receptor, de modo que sintonizar no lo interrumpe.

Al cambiar entre las dos vistas su modo actual viaja con usted, pero si la vista a la que pasa no tiene un equivalente, el plan de bandas decide para esa frecuencia: una frecuencia de radiodifusión llega en AM, 40 m en LSB, un segmento de CW en CW. `SAM` en la página simplificada se convierte en AM con el detector síncrono en la vista ampliada, y a la inversa. `RADEL` y `RADEU` solo existen en la página simplificada: al salir de uno de ellos se conserva la frecuencia y el plan de bandas elige el modo.

Una frecuencia fuera de la cobertura del receptor se ajusta al extremo más cercano, de manera que un enlace antiguo nunca puede dejarle fuera de banda.

### Funciones específicas para móviles

- **Controles táctiles**: botones y deslizadores grandes
- **Deslizar para sintonizar**: deslice a izquierda/derecha sobre la cascada
- **Pellizcar para ampliar**: pellizque la cascada para acercar o alejar
- **Modo horizontal**: gire el dispositivo para ver mejor

### Consejos para móviles

1. **Use wifi**: la transmisión de audio consume datos
2. **Orientación horizontal**: mejor vista de la cascada
3. **Auriculares**: mejor calidad de audio
4. **Guarde sus favoritas como marcadores**: es más fácil volver a las emisoras
5. **Cierre otras aplicaciones**: garantiza un funcionamiento fluido

### Navegadores móviles recomendados

- **Android**: Chrome o Samsung Internet
- **iOS**: Mozilla
- **Ambos**: asegúrese de que el navegador esté actualizado

---

## Consejos y buenas prácticas

### Para la mejor recepción

1. **Elija señales fuertes**: busque el naranja/rojo en la cascada
2. **Sintonice con precisión**: haga clic justo en el centro de la señal
3. **Seleccione el modo correcto**: adecuado al tipo de señal
4. **Ajuste el AGC**: rápido para AM, lento para SSB
5. **Use NR/NB**: ayudan en condiciones ruidosas

### Encontrar actividad

1. **Observe la cascada**: los colores indican la intensidad de la señal
2. **Escuche en frecuencias populares**:
   - 40 m: 7.100-7.300 MHz (LSB)
   - 20 m: 14.200-14.350 MHz (USB)
   - 2 m: 145.200-145.600 MHz (FM)
3. **Consulte la superposición del plan de bandas**: muestra las atribuciones de frecuencia
4. **Use los marcadores**: acceso rápido a frecuencias activas

### Entender las condiciones de propagación

**HF de día:**
- las bandas altas funcionan mejor (20 m, 15 m, 10 m)
- es posible la comunicación a larga distancia (DX)
- se oyen emisoras de radiodifusión

**HF de noche:**
- las bandas bajas funcionan mejor (80 m, 40 m)
- pautas de propagación distintas
- se oyen emisoras distintas

**VHF/UHF:**
- principalmente con visibilidad directa
- comunicaciones locales
- condiciones más constantes

### Etiqueta

1. **No monopolice el receptor**: otras personas también quieren escuchar
2. **Use el chat con respeto**: sea cortés con los demás usuarios
3. **Informe de los problemas**: ayude al operador a mantener la estación
4. **No pida soporte técnico**: esta es una plataforma de escucha. Envíe un mensaje al SysOp si necesita ayuda.

---

## Resolución de problemas

### No hay audio

**Posibles causas:**
1. Navegador silenciado → compruebe los controles de volumen del navegador
2. Sistema silenciado → compruebe el volumen del ordenador
3. Señal débil → sintonice una señal más fuerte (S7+)
4. Modo incorrecto → pruebe otros modos de demodulación

**Soluciones:**
1. Haga clic en una señal fuerte (naranja/roja en la cascada)
2. Compruebe que el navegador no esté silenciado (icono de silencio en la pestaña)
3. Pruebe otra frecuencia
4. Recargue la página (F5)

### Audio distorsionado

**Posibles causas:**
1. Señal saturada → señal demasiado fuerte
2. Modo incorrecto → señal de AM escuchada en SSB, etc.
3. Interferencias → señales adyacentes que se cuelan

**Soluciones:**
1. Baje el volumen
2. Pruebe otro modo de demodulación
3. Use un filtro más estrecho
4. Aléjese de las señales interferentes

### La cascada no se actualiza

**Posibles causas:**
1. Problema de red → conexión lenta o interrumpida
2. Rendimiento del navegador → demasiadas pestañas abiertas
3. Sobrecarga del servidor → demasiados usuarios

**Soluciones:**
1. Compruebe la conexión a Internet
2. Cierre las pestañas innecesarias
3. Recargue la página (F5)
4. Inténtelo más tarde, cuando haya menos usuarios conectados

### No se puede sintonizar una frecuencia

**Posibles causas:**
1. Frecuencia fuera de rango → el SDR no cubre esa frecuencia
2. Formato de escritura incorrecto → use el formato correcto (p. ej., «14200» y no «14.200.000»)

**Soluciones:**
1. Compruebe la cobertura de frecuencias del SDR (indicada en la página)
2. Use los ejemplos de formato de frecuencia facilitados
3. Haga clic en la cascada en su lugar

### Audio entrecortado

**Posibles causas:**
1. conexión a Internet lenta
2. carga elevada del servidor
3. problemas de rendimiento del navegador

**Soluciones:**
1. Cierre otras aplicaciones que consuman ancho de banda
2. Inténtelo fuera de las horas punta
3. Cierre las pestañas innecesarias
4. Use conexión por cable en lugar de wifi

---

## Preguntas frecuentes

### Preguntas generales

**P: ¿Necesito equipo especial para usar WebSDR?**
R: ¡No! Solo un ordenador o dispositivo móvil con acceso a Internet.

**P: ¿Es gratuito usar WebSDR?**
R: Sí, la mayoría de los WebSDR son gratuitos. Los mantienen voluntarios.

**P: ¿Puedo transmitir con WebSDR?**
R: No, WebSDR es solo de recepción. No se puede transmitir.

**P: ¿Qué frecuencias puedo escuchar?**
R: Depende de la configuración del WebSDR. Consulte la información de la estación.

**P: ¿Puedo grabar el audio?**
R: Algunos navegadores permiten grabar. Compruebe las funciones de su navegador.

### Preguntas técnicas

**P: ¿Qué tasa de muestreo usa el SDR?**
R: Varía según la estación. Consulte la página de información de la estación.

**P: ¿Cuál es la latencia?**
R: Normalmente de 2 a 5 segundos entre la señal de radio y sus altavoces.

**P: ¿Puedo abrir varias instancias?**
R: Normalmente sí, pero puede sobrecargar el servidor. Sea considerado.

**P: ¿Funciona sin conexión?**
R: No, WebSDR requiere conexión a Internet.

**P: ¿Qué navegadores son compatibles?**
R: Chrome, Firefox, Edge y Safari (versiones recientes)

### Preguntas sobre el uso

**P: ¿Cuántas personas pueden escuchar a la vez?**
R: Depende de la capacidad del servidor. A menudo entre 50 y más de 200 usuarios.

**P: ¿Puedo ver qué escuchan los demás?**
R: Si está habilitado, sí. Busque los indicadores de «otros usuarios».

**P: ¿Puedo chatear con otros oyentes?**
R: Si el operador lo ha habilitado. Busque el cuadro de chat.

**P: ¿Por qué algunas frecuencias no muestran nada?**
R: En ese momento no hay señales en esa frecuencia. ¡Pruebe otras!

**P: ¿Qué son las bandas de color de la cascada?**
R: La superposición del plan de bandas, que muestra las atribuciones de frecuencia.

---

## Recursos

### Aprender más sobre radio

- **Planes de bandas**: busque «amateur radio band plan» + su región
- **Propagación**: infórmese sobre la propagación de las ondas de HF
- **Modos digitales**: investigue sobre FT8, PSK31 y RTTY
- **Radioafición**: ¡plantéese obtener una licencia de radioaficionado!

### Encontrar más WebSDR

- **Directorio WebSDR**: http://sdr-list.xyz
- **WebSDR.org**: http://websdr.org
- **KiwiSDR**: http://kiwisdr.com/public/

### Obtener ayuda

1. **Operador de la estación**: consulte los datos de contacto en la página
2. **Chat de usuarios**: pregunte a otros oyentes (si está disponible)
3. **Foros en línea**: busque comunidades de WebSDR
4. **Documentación**: ¡consulte esta guía!

---

## Apéndice: frecuencias habituales

### Bandas de radioafición de HF

| Banda | Margen de frecuencias | Modo | Actividad |
|-------|-----------------------|------|-----------|
| 160 m | 1.800-2.000 MHz | LSB | Noche/local |
| 80 m | 3.500-4.000 MHz | LSB | Noche/regional |
| 40 m | 7.000-7.300 MHz | LSB | Día/noche/DX |
| 30 m | 10.100-10.150 MHz | USB | Solo datos/CW |
| 20 m | 14.000-14.350 MHz | USB | Día/DX |
| 17 m | 18.068-18.168 MHz | USB | Día/DX |
| 15 m | 21.000-21.450 MHz | USB | Día/DX |
| 12 m | 24.890-24.990 MHz | USB | Día/DX |
| 10 m | 28.000-29.700 MHz | USB | Esporádica/DX |

### Bandas de radioafición de VHF/UHF

| Banda | Margen de frecuencias | Modo | Actividad |
|-------|-----------------------|------|-----------|
| 6 m | 50.000-54.000 MHz | USB/FM | Esporádica |
| 2 m | 144.000-148.000 MHz | FM | Muy activa |
| 70 cm | 420.000-450.000 MHz | FM | Activa |

### Bandas de radiodifusión

| Servicio | Margen de frecuencias | Modo |
|----------|-----------------------|------|
| Radio AM | 530-1710 kHz | AM |
| Onda corta | 2.3-26.1 MHz | AM |
| Radio FM | 88-108 MHz | WBFM |

### Aviación

| Servicio | Margen de frecuencias | Modo |
|----------|-----------------------|------|
| Control del tráfico aéreo | 118-137 MHz | AM |
| ACARS (datos) | 130-136 MHz | Datos |

### Marítimo

| Servicio | Margen de frecuencias | Modo |
|----------|-----------------------|------|
| VHF marina | 156-162 MHz | FM |
| HF marina | 2-22 MHz | USB |

---

## Glosario

**AGC**: control automático de ganancia — ajusta los niveles de audio automáticamente

**AM**: modulación de amplitud — modo de voz usado en aviación y radiodifusión

**Ancho de banda**: el margen de frecuencias de una señal

**CW**: onda continua — señales en código Morse

**DX**: comunicación a larga distancia

**FFT**: transformada rápida de Fourier — convierte el dominio del tiempo en el de la frecuencia

**FM**: modulación de frecuencia — modo de voz para VHF/UHF

**HF**: alta frecuencia (3-30 MHz) — bandas de larga distancia

**kHz**: kilohercio (1.000 Hz)

**LSB**: banda lateral inferior — modo de voz para las bandas bajas de HF

**MHz**: megahercio (1.000.000 Hz)

**NB**: supresor de impulsos — elimina el ruido impulsivo

**NR**: reducción de ruido — reduce el ruido de fondo

**PSK**: modulación por desplazamiento de fase — modo digital

**RTTY**: radioteletipo — modo digital de texto

**S-metro**: medidor de intensidad de señal

**SDR**: radio definida por software

**SQL**: silenciador — enmudece el audio cuando no hay señal

**SSB**: banda lateral única (USB o LSB)

**USB**: banda lateral superior — modo de voz para las bandas altas de HF

**VHF**: muy alta frecuencia (30-300 MHz) — visibilidad directa

**UHF**: ultra alta frecuencia (300-3000 MHz) — visibilidad directa

**Cascada**: representación visual del espectro radioeléctrico a lo largo del tiempo

---

**¡Disfrute explorando el espectro radioeléctrico con PhantomSDR-Plus!**

**73 (saludos cordiales) de SV1BTL & SV2AMK**

Para las instrucciones de instalación, consulte [INSTALLATION.md](INSTALLATION.md). Para los detalles técnicos, consulte [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md).
