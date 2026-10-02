# PhantomSDR-Plus — Manual del usuario de los decodificadores

Esta guía cubre todos los decodificadores integrados disponibles en PhantomSDR-Plus. Todos los decodificadores comparten el mismo procedimiento de activación, descrito a continuación, seguido de las instrucciones de configuración de cada uno.

---

## Índice

1. [Cómo iniciar un decodificador](#1-cómo-iniciar-un-decodificador)
2. [FT8](#2-ft8)
3. [FT4-FT2](#3-ft4-ft2)
4. [JS8](#4-js8)
5. [CW — código Morse](#5-cw--código-morse)
6. [QRSS Grabber](#6-qrss-grabber)
7. [WSPR](#7-wspr)
8. [FAX de HF / WEFAX](#8-fax-de-hf--wefax)
9. [NAVTEX](#9-navtex)
10. [FSK / RTTY — incluidos PSK31 y Olivia](#10-fsk--rtty--incluidos-psk31-y-olivia)
11. [SSTV](#11-sstv)
12. [Consejos generales](#12-consejos-generales)

---

## 1. Cómo iniciar un decodificador

Se accede a todos los decodificadores desde la sección **Decoder Options**, situada bajo los controles del espectrograma de audio en el panel principal.

**Pasos:**

1. Haga clic en el botón **Decoder: OFF** para cambiarlo a **Decoder: ON** (se vuelve azul cuando está activo).
2. Abra el menú desplegable que aparece a la derecha del botón y seleccione el decodificador que desee.
3. El panel del decodificador elegido aparecerá bajo los controles; siga las instrucciones específicas de ese decodificador en la sección correspondiente de esta guía.
4. Para detener la decodificación, seleccione **— Select decoder —** en el desplegable, o haga clic en el botón **Decoder: ON** para volver a ponerlo en OFF.

### Botones de decodificador de una pulsación

El desplegable no es la única vía. El panel principal incluye una fila de botones **Decoders** — justo debajo de **Wheel Tuning Steps** — con un botón por decodificador:

| Botón | Decodificador | Botón | Decodificador |
|---|---|---|---|
| **FT8** | FT8 | **SSTV** | SSTV |
| **FT4** | FT4 | **NAVTEX** | NAVTEX |
| **FT2** | FT2 | **RTTY** | FSK / RTTY |
| **CW** | CW | | |
| **WSPR** | WSPR | **FAX** | HF FAX / WEFAX |

Pulsar un botón hace toda la secuencia de una vez: selecciona el decodificador, pone el decodificador en ON y desplaza su ventana hasta hacerla visible. El botón se pone azul mientras su decodificador funciona. **Pulse el mismo botón otra vez para detener el decodificador**: su ventana se cierra con él.

**RADEL** y **RADEU** no están en esta fila deliberadamente. Son modos de voz digital y no decodificadores de texto, por lo que tienen su propio par de botones junto al encabezado **Modes selector** y dentro de las ventanas emergentes **Modes** y **Bands**. Se comportan exactamente igual: pulsar para iniciar, volver a pulsar para detener. Consulte el [manual de RADE](RADE_README.md).

Los botones, el desplegable y el botón ON/OFF gobiernan el mismo estado, así que use el que use, los demás lo siguen.

> Solo puede haber un decodificador activo a la vez. Cambiar a otro decodificador detiene automáticamente el anterior.
>
> El **grabber QRSS** no forma parte de este menú desplegable: tiene su propia sección **QRSS** y puede funcionar al mismo tiempo que un decodificador.

**La decodificación se ejecuta en segundo plano.** SSTV, FAX de HF, NAVTEX, FSK/RTTY y CW se ejecutan cada uno en un hilo Web Worker independiente, de modo que el trabajo de decodificación nunca compite con la reproducción de audio ni con la cascada. Iniciar o detener un decodificador no interrumpe el audio, y la interfaz sigue respondiendo mientras se recibe una imagen o una página. Todos los decodificadores reciben audio en bruto tomado *antes* del AGC, la reducción de ruido y el silenciado, así que silenciar el receptor o ajustar esos parámetros a su gusto no afecta a la decodificación.

**Un decodificador en marcha manda sobre el modo y el paso de banda.** Normalmente el modo sigue el plan de bandas de `bands-config.js`: lleve el dial a un segmento marcado LSB o AM y el receptor cambia a él. Mientras un decodificador está en marcha eso ya no ocurre. El decodificador mantiene el modo que necesita (USB en casi todos, el suyo propio en RADE) y el paso de banda que necesita —PSK31 unos ±100 Hz, Olivia todo su ancho, RTTY su shift— y ambos sobreviven a la resintonía, incluso a un salto a otra banda. Sin esto, sintonizar FT8 en 40 m pasaría el receptor a LSB en cuanto se moviera el dial, y los pasos de banda estrechos de los decodificadores se abrirían de nuevo al filtro SSB completo.

El modo propio de la banda vuelve en cuanto apaga el decodificador. Siempre puede imponer el modo a mano: los botones de modo son una elección deliberada y siempre ganan. El decodificador de CW es la excepción a todo esto: decodifica en el modo en que usted esté escuchando y nunca toma el control del receptor.


### Decoder ID — reconocer el modo automáticamente

Sobre los botones de decodificador se encuentra el marco **Decoder ID**. Responde a la pregunta *«¿qué estoy escuchando?»* cuando encuentre una señal digital que no sepa identificar, y a continuación le ofrece el decodificador adecuado con un solo clic.

Está **desactivado de forma predeterminada** y no consume nada mientras está apagado. Pulse **On** y deje la señal sintonizada. Durante aproximadamente medio minuto muestra *Listening…* con una barra de progreso — las medidas de temporización necesitan ver dos ciclos completos de FT8 antes de tener sentido — y después nombra el modo:

```
Decoder ID [On]   NAVTEX / SITOR-B  99% 📻   170 Hz shift · 100.00 Bd · 43 dB S/N   [ Use NAVTEX ]
```

* El **modo** y una cifra de **confianza**. Verde por encima del 75 %, ámbar por encima del 50 %, naranja por debajo — trate una respuesta naranja como una pista, no como un veredicto.
* **Lo que realmente se midió**: ancho de banda ocupado, separación de tonos, velocidad de símbolo, duración de la ráfaga, la rejilla UTC a la que se ajusta, relación señal/ruido. Ésta es la evidencia detrás del veredicto, para que pueda juzgar usted mismo.
* **Use <modo>** arranca el decodificador correcto, exactamente como si hubiera pulsado su botón — y prepara el receptor para trabajar ese modo. Para los modos que viven en el panel FSK además selecciona la variante correcta — RTTY, Weather RTTY, PSK31 u Olivia.
* Los candidatos siguientes aparecen tras **or**. Pulse uno para probarlo, de modo que una primera respuesta equivocada no le cuesta nada.
* **📻** significa que la frecuencia en la que está sintonizado es una frecuencia de llamada conocida para ese modo, y que eso contó en la clasificación.

Nunca cambia su decodificador por sí solo. Únicamente sugiere. Y en cuanto arranca un decodificador — desde la fila de botones, desde la lista desplegable o desde el propio botón **Use** de Decoder ID — Decoder ID se apaga solo: su tarea era elegir uno, y ahora el decodificador quiere ese mismo audio.

**Prepara el receptor para el modo.** Elegir un modo es decidir trabajarlo, así que el receptor le sigue: la frecuencia sintonizada pasa al centro de la cascada y la vista queda en unos 100 kHz a su alrededor, la banda lateral pasa a ser aquella en la que se trabaja ese modo y el paso de banda se estrecha hasta la ventana en la que vive ese modo — la subbanda completa de 3 kHz para FT8, FT4, FT2 y JS8, 1350–1650 Hz para WSPR, 250–750 Hz para NAVTEX, 800–2700 Hz para HF FAX, 900–2600 Hz para SSTV y ±250 Hz a cada lado del dial para CW, que además conmuta el receptor a CW. Un paso de banda estrecho mantiene las señales vecinas fuera del decodificador, que es lo que habría hecho usted a mano. Dos excepciones: SSTV conserva la banda lateral que eligió por sí mismo — LSB en 80 y 40 m por convención, donde forzar USB invertiría su correspondencia de tonos — y los modos FSK conservan la ventana que su propio panel deduce del shift o del ancho de banda de la variante, más estrecha que cualquier cifra fija. Pulsar **Use** en el decodificador que ya está funcionando sigue apagándolo, y entonces el receptor se queda exactamente como estaba.

**Los modos lentos tardan más.** WSPR va en una rejilla de dos minutos y las imágenes SSTV duran uno o dos minutos, así que esos dos se nombran más tarde que el resto — déles tres o cuatro minutos en la frecuencia. HF FAX y SSTV solo se reconocen, además, si están sintonizados de la forma habitual — con la banda de imagen entre unos 1500 y 2300 Hz de audio, que es donde también la esperan sus decodificadores. Cambiar de frecuencia reinicia la medición desde cero, porque todo lo reunido hasta entonces describe la frecuencia que acaba de abandonar.

**Qué reconoce:** FT8, FT4, JS8, WSPR, CW, NAVTEX/SITOR-B, RTTY a 45,45 Bd, Weather RTTY (DWD), PSK31, Olivia, HF FAX, SSTV y DSC. En esta versión no hay decodificador de DSC, así que DSC se nombra y se marca como *no decoder*.

**Recentre & retry.** El lugar que ocupa la señal dentro del paso de banda de audio no importa entre unos 400 Hz y 2700 Hz. Fuera de ese margen la medida se degrada y aparece un botón ámbar **Recentre & retry**. Al pulsarlo, el dial se desplaza para que la señal quede en el centro del paso de banda y comienza una medida nueva. Es un único movimiento calculado, no una búsqueda.

**Tres límites honestos:**

* **FT8, JS8 y FT2 son la misma señal.** La misma modulación 8-FSK, la misma separación de tonos, y JS8 a velocidad Normal usa la cadencia de 15 segundos de FT8. Nada en la señal misma los separa. La frecuencia sí: en una frecuencia de llamada de FT8 informa FT8, en una de JS8 informa JS8, y en cualquier otro sitio informa honestamente la familia — *FT8 / JS8 / FT2*. Arranque cualquiera de los dos decodificadores y vea cuál produce texto.
* **Calla en lugar de adivinar.** Por debajo de unos 10 dB de relación señal/ruido informa *Nothing above the noise* o *Not recognised* en vez de nombrar un modo que no puede ver realmente. Es deliberado: una respuesta equivocada y segura de sí misma es peor que ninguna respuesta.
* **Una señal con desvanecimiento se lee de otra manera.** WSPR transmite 110 segundos seguidos, más de lo que dura un desvanecimiento QSB corriente, de modo que un desvanecimiento profundo parte la transmisión en trozos y su ritmo de dos minutos ya no puede leerse en ellos. Entonces se recupera por otra vía: se compara todo el historial de escucha con la rejilla de dos minutos en lugar de con transmisiones sueltas, y la línea de medidas indica *120 s grid (through fading)*. Es una prueba más débil que una transmisión oída entera, así que la confianza mostrada es deliberadamente menor. Un desvanecimiento lo bastante profundo como para hundir la señal en el ruido no se recupera en absoluto. Olivia es más estricta que las demás: no se nombra hasta haber medido su velocidad de símbolo, por lo que enmudece antes.

---

## 2. FT8

**Qué es:** FT8 es un modo digital de señal débil muy popular entre los radioaficionados de todo el mundo. Las transmisiones duran exactamente 15 segundos y el protocolo puede copiar señales hasta 20-25 dB por debajo del nivel de ruido. Es el modo más utilizado para contactos a larga distancia (DX).

### Frecuencias recomendadas (USB)

| Banda | Frecuencia |
|-------|------------|
| 160 m | 1.840 MHz |
| 80 m  | 3.573 MHz |
| 40 m  | 7.074 MHz |
| 30 m  | 10.136 MHz |
| 20 m  | 14.074 MHz |
| 17 m  | 18.100 MHz |
| 15 m  | 21.074 MHz |
| 12 m  | 24.915 MHz |
| 10 m  | 28.074 MHz |

### Configuración

1. Sintonice una de las frecuencias de FT8 indicadas arriba y ponga el modo en **USB**.
2. Active el decodificador y seleccione **FT8** en el desplegable. O basta con pulsar el botón **FT8**.
3. El panel **FT8 Messages** aparece automáticamente debajo.

### Lectura de la salida

La lista de mensajes muestra las transmisiones decodificadas a medida que llegan. Cada ciclo de 15 segundos produce un nuevo lote de mensajes. El campo **Farthest** (arriba a la derecha del panel) indica la mayor distancia decodificada en la sesión actual, en kilómetros.

Formato de mensaje típico: `CQ DX AA1BB FN31` — una llamada CQ del indicativo AA1BB situado en el cuadrante FN31.

> **Consejo:** FT8 está estrechamente sincronizado en el tiempo. Su navegador usa el reloj del ordenador; si el reloj del sistema se desvía más de un par de segundos, la decodificación fallará. Mantenga la hora del sistema sincronizada por NTP.

---

## 3. FT4-FT2

**Qué es:** FT4 es una variante más rápida de FT8 diseñada para operar en concursos. Cada ciclo de transmisión dura 7,5 segundos (la mitad que FT8), lo que lo hace el doble de rápido pero exige una señal algo más fuerte. FT2 es una variante aún más rápida de FT8. Es un modo ultrarrápido de 77 bits con periodos TR de 3,75 segundos (= la mitad que FT4); todavía experimental.

### Frecuencias recomendadas (USB)

| Banda | Frecuencia FT4|
|-------|-----------|
| 80 m  | 3.575 MHz |
| 40 m  | 7.047 MHz |
| 30 m  | 10.140 MHz |
| 20 m  | 14.080 MHz |
| 15 m  | 21.140 MHz |
| 10 m  | 28.180 MHz |

| Banda | Frecuencia FT2|
|-------|-----------|
|160 m | 1.843 a 1.846 |
|80 m   | 3.578 a 3.581 |
|60 m   | 5.360 (consulte la normativa regional local) |
|40 m   | 7.052 a 7.062 |
|30 m   | 10.144 |
|20 m   | 14.084 |
|17 m   | 18.108 |
|15 m   | 21.144 |
|12 m   | 24.923 |
|10 m   | 28.184 |

### Configuración

1. Sintonice una frecuencia de FT4 y ponga el modo en **USB**.
2. Active el decodificador y seleccione **FT4** o **FT2** en el desplegable. O basta con pulsar el botón **FT4** / **FT2**.
3. El panel **FT4 Messages** o **FT2 Messages** aparece debajo, con la misma disposición que el panel de FT8.

> **Nota:** FT4 y FT8 usan formatos espectrales distintos y no son intercambiables. Asegúrese de estar en una frecuencia de FT4 al usar este decodificador.

---

## 4. JS8

**Qué es:** JS8 (el modo que usa JS8Call) toma el motor de señal débil de FT8 y lo convierte en un modo de conversación de teclado a teclado. Mientras FT8 envía intercambios fijos de 13 caracteres, JS8 envía texto libre en pequeños fragmentos y vuelve a unir las transmisiones consecutivas en frases completas, de modo que todo lo que supere unos doce caracteres llega a lo largo de varios ciclos de 15 segundos. Decodifica aproximadamente tan profundo como FT8, por lo que sirve cuando la voz y la CW ya no pasan.

### Frecuencias recomendadas (USB)

| Banda | Frecuencia |
|-------|------------|
| 160m | 1.842 MHz |
| 80m  | 3.578 MHz |
| 40m  | 7.078 MHz |
| 30m  | 10.130 MHz |
| 20m  | 14.078 MHz |
| 17m  | 18.104 MHz |
| 15m  | 21.078 MHz |
| 12m  | 24.922 MHz |
| 10m  | 28.078 MHz |

### Velocidades

JS8 tiene cinco velocidades. Todas las estaciones de una conversación deben usar la misma. **Normal** es la velocidad de llamada y concentra casi todo el tráfico: empiece ahí.

| Velocidad | Ciclo | Ancho de banda | Cuándo se usa |
|-----------|-------|----------------|---------------|
| Slow   | 30 s | 25 Hz  | Trayectos muy débiles; la más sensible |
| Normal | 15 s | 50 Hz  | La velocidad de llamada habitual |
| Fast   | 10 s | 80 Hz  | Intercambios más rápidos, exige más señal |
| Turbo  | 6 s  | 160 Hz | Señales locales fuertes |
| Ultra  | 4 s  | 250 Hz | Experimental, rara vez se ve |

### Configuración

1. Sintonice una frecuencia de JS8 y ponga el modo en **USB**.
2. Active el decodificador y seleccione **JS8** en la lista, o pulse el botón **JS8**.
3. Aparece el panel **JS8 Decoder**. Deje **Speed** en *Normal* salvo que sepa que la estación que busca usa otra.

### Cómo leer la salida

El panel tiene dos listas.

**Mensajes que aún están llegando** aparecen arriba en verde, con un cursor parpadeante. Un mensaje JS8 puede tardar cuatro ciclos —un minuto entero en Normal—, así que aquí se ve la frase construirse. No pasa nada si permanece así un rato.

**Mensajes completos** llenan la lista principal, una fila cada uno:

| Columna | Significado |
|---------|-------------|
| Mode | Siempre `JS8` |
| Hz | Frecuencia de audio de la señal dentro del paso de banda |
| dB | Relación señal/ruido en un ancho de referencia de 2500 Hz |
| Message | El texto decodificado; **los indicativos se muestran en verde** |

Mensajes típicos:

* `SV1BTL KM17: HB` — un heartbeat: la estación anuncia que está en el aire, con su localizador.
* `KN4CRD: K0OG SNR -05` — un mensaje dirigido: KN4CRD indica a K0OG que lo recibe a −5 dB.
* `MP 100W 8M/BALUN JN58KH AUGSBURG, MARTIN` — texto libre, aquí una descripción de estación llegada en cuatro ciclos.

Una fila **atenuada y en cursiva** expiró antes de que llegara su última trama. El texto es real, pero puede estar cortado.

### Sync offset

El deslizador **Sync offset** fija cuánto después del límite del ciclo UTC empieza la captura, compensando el retardo de la cadena de audio. Deje **Auto** marcado: el decodificador mide la temporización de las señales que oye y se ajusta solo.

### Marcas de espectro

La pequeña tira de espectro del panel dibuja una línea vertical amarilla en la frecuencia de cada señal decodificada en el ciclo anterior, de modo que la columna Hz se lee directamente en la pantalla.

### Ver sus propios spots

Si el receptor sube spots JS8 a PSK Reporter (véase la pestaña Spot Reporting del panel de administración), el botón **📡 JS8 map** del recuadro **Note:** abre el mapa de PSK Reporter filtrado por el indicativo de este receptor y el modo JS8 — lo mismo que hacen **📡 FT8 map** y **📡 FT4 map** para esos modos.

> **Consejo:** JS8 es mucho más tranquilo que FT8. Una tarde puede ver una transmisión cada pocos minutos, y los silencios largos son normales. Déle cinco o diez minutos antes de pensar que algo falla. 20m (14.078) y 40m (7.078) son los sitios habituales.

> **Consejo:** Como FT8, JS8 depende de una sincronización estricta y usa el reloj de su ordenador. Si la hora del sistema se desvía más de uno o dos segundos, no decodificará nada. Manténgala sincronizada por NTP.

---

## 5. CW — código Morse

**Qué es:** el decodificador de CW escucha señales en código Morse (onda continua) y las convierte en texto en tiempo real. Sigue automáticamente la frecuencia de la señal y se adapta a la velocidad de manipulación del operador.

### Frecuencias recomendadas

La CW está activa en todas las bandas de aficionado, normalmente en la parte baja de cada banda. Puntos habituales:

| Banda | Segmento |
|-------|----------|
| 40 m  | 7.000–7.040 MHz |
| 20 m  | 14.000–14.070 MHz |
| 15 m  | 21.000–21.080 MHz |

### Configuración

1. Sintonice una señal de CW usando el modo de demodulación **CW** o **CW-L** según proceda.
2. Active el decodificador y seleccione **CW** en el desplegable. O basta con pulsar el botón **CW**.
3. El panel **CW Decoder** aparece debajo.

### Lectura de la salida

- La cabecera del panel muestra la frecuencia detectada de la señal en Hz (p. ej., `≈ 700 Hz`) y la velocidad de manipulación estimada en palabras por minuto (p. ej., `· 22 WPM`).
- Si no se detecta señal, la cabecera muestra **scanning…**
- El texto decodificado se desplaza en caracteres ámbar de paso fijo. El cursor parpadeante (▋) marca dónde se está escribiendo.
- Haga clic en **Clear** para borrar el búfer de salida.

> **Consejos:**
> - Centre el paso de banda en el tono de CW. El decodificador funciona mejor cuando la señal de CW se sitúa aproximadamente entre 400 y 900 Hz en el espectro de audio.
> - Una manipulación muy rápida o muy lenta, así como un Morse muy manual (irregular), pueden reducir la precisión.
> - El decodificador rinde mejor con una única señal limpia. Un QRM fuerte de señales cercanas en la misma banda puede confundirlo.

---

## 6. QRSS Grabber

**Qué es:** QRSS es CW enviado tan despacio que un solo punto dura segundos en lugar de milisegundos. A esa velocidad la señal ocupa solo una fracción de hercio, de modo que un análisis lo bastante estrecho puede sacar la traza desde 20–30 dB *por debajo* del nivel de ruido. No hay nada que leer de oído: el QRSS **se mira**, no se escucha. El grabber calcula su propia FFT muy larga sobre el audio del receptor y dibuja la presentación clásica de grabber: frecuencia en el eje vertical, tiempo desplazándose de izquierda a derecha, con la columna más reciente siempre en el borde derecho.

Casi todo lo que verá procede de balizas MEPT (Manned Experimental Propagation Transmitter): transmisores de muy baja potencia, a menudo unos cientos de milivatios sobre un hilo, que se identifican continuamente en Morse muy lento o con patrones FSK.

### Dónde buscar

Las balizas QRSS viven en ventanas estrechas de 100–200 Hz cerca del extremo inferior de cada banda. No hace falta recordarlas: el grabber tiene una lista **Band** con las ventanas de abajo, y elegir una sintoniza allí y prepara el receptor para ello (véase *Abrir el grabber*).

| Banda | Centro de la ventana | Nota |
|------|---------------|------|
| 30m | 10.140,00 kHz | La ventana QRSS principal: con diferencia la más concurrida, de día y de noche |
| 40m | 7.039,90 kHz |  |
| 40m | 7.000,85 kHz | Ventana Knights, 7.000,8–7.000,9 kHz |
| 20m | 14.096,90 kHz |  |
| 80m | 3.569,90 kHz |  |
| 80m | 3.568,60 kHz | Ventana antigua |
| 80m | 3.500,85 kHz | Ventana Knights, 3.500,8–3.500,9 kHz |
| 160m | 1.837,90 kHz |  |
| 160m | 1.843,30 kHz | Ventana antigua |
| 630m | 476,10 kHz |  |
| 2200m | 137,70 kHz | QRSS / DFCW en LF |
| 60m | 5.288,55 kHz |  |
| 17m | 18.105,90 kHz |  |
| 15m | 21.095,90 kHz |  |
| 12m | 24.925,90 kHz |  |
| 10m | 28.125,70 kHz |  |
| 10m | 28.000,85 kHz | Ventana antigua |
| 10m | 28.322,00 kHz | Alternativa |
| 6m | 50.294,30 kHz |  |

Varias bandas aparecen dos veces porque hay realmente dos convenciones en uso. Las ventanas modernas se sitúan 200 Hz por debajo de la frecuencia WSPR de esa banda; las antiguas ventanas *Knights* están en otro sitio por completo, y en 40 y 80 m mucho más abajo. Si una banda está tranquila en una, pruebe la otra.

Son convenciones, no reglamentos, y algunas son regionales: las cifras de 10 m en particular varían. Tome la lista como punto de partida y siga la práctica local.

### Abrir el grabber

El grabber QRSS **no** está en el desplegable de decodificadores. Tiene su propia sección **QRSS**, junto a los controles del espectrograma y de los decodificadores.

1. Pulse **🐌 Show**. Aparece el lienzo del grabber y sus controles se despliegan junto al botón.
2. Elija una ventana en la lista **Band** y pulse **Tune**. Eso hace de una vez todo lo que el modo necesita: sintoniza la ventana, pasa el receptor a **CW** y fija un paso de banda justo lo bastante ancho para la porción que está mirando. El dial marca entonces la frecuencia QRSS real, y las trazas caen sobre la línea central de la presentación.
3. Ajuste **Speed** a la duración del punto de la baliza.
4. **Centre** y **Span** funcionan como antes; cambiar cualquiera de los dos reajusta el paso de banda, de modo que la presentación y el receptor siguen acompasados.
5. Pulse **🐌 Hide** para detenerlo. Vuelve el modo normal de la banda.

También puede seguir haciéndolo a mano: sintonice en **USB** alrededor de 1 kHz por debajo de la ventana para que las trazas caigan cerca de 800 Hz de audio. La lista **Band** solo le ahorra la aritmética.

Mientras hay sintonizada una ventana de la lista, el grabber retiene el receptor igual que un decodificador: CW y su paso de banda sobreviven a la resintonía, y la ventana sigue al dial, así que la traza se mantiene en la línea central mientras recorre la banda. Devuelve el receptor cuando oculta el grabber, pulsa un botón de modo o arranca un decodificador.

### Velocidades

| Ajuste | Duración del punto | Resolución | Ventana de análisis | Nueva columna cada |
|--------|--------------------|------------|---------------------|--------------------|
| QRSS 3  | 3 s  | 0,73 Hz | 1,4 s  | 0,7 s  |
| QRSS 6  | 6 s  | 0,37 Hz | 2,7 s  | 1,4 s  |
| QRSS 10 | 10 s | 0,18 Hz | 5,5 s  | 2,7 s  |
| QRSS 30 | 30 s | 0,09 Hz | 10,9 s | 5,5 s  |
| QRSS 60 | 60 s | 0,05 Hz | 21,8 s | 10,9 s |

Un ajuste más rápido que la baliza desperdicia sensibilidad: la traza sale fina y ruidosa. Un ajuste más lento emborrona puntos y rayas consecutivos en una sola barra. El panel arranca en **QRSS 6**, un punto de partida razonable ante una señal desconocida: más sensible que QRSS 3, y más rápido de actualizar y más tolerante a la deriva que QRSS 10. En cuanto distinga la forma del manipulado, pase a la velocidad que la baliza envía realmente: cada paso hacia un ajuste más rápido cuesta 3 dB de sensibilidad.

### Controles

| Control | Qué hace |
|---------|----------|
| **Band** | Las ventanas QRSS de la tabla anterior. **Tune** va a la seleccionada, en CW y con un paso de banda a medida. |
| **Speed** | Fija la longitud de la transformada, es decir el compromiso entre resolución en frecuencia y en tiempo (tabla anterior). |
| **Centre** | Frecuencia de audio en el centro de la presentación, 100–3000 Hz. |
| **Span** | Altura de la franja mostrada: 20, 50, 100 o 200 Hz, con 100 Hz al arrancar: el ancho de una subbanda QRSS. Una franja más estrecha reparte cada traza en más píxeles. En las franjas anchas caben en el panel más bins que filas de píxeles tiene; cada fila muestra entonces el bin más fuerte que abarca, de modo que nada puede esconderse entre filas. |
| **Gain** | De −10 a +40 dB. Desplaza el mapa de color respecto al nivel de ruido medido; súbalo para aclarar trazas débiles. |
| **Color** | Rainbow, Green o Grayscale. |
| **Clear** | Borra el lienzo y reinicia la referencia de ruido. |

### Cómo leer la presentación

Las marcas de frecuencia recorren el borde izquierdo, con la frecuencia más alta arriba. Bajo el lienzo, una línea de estado muestra la velocidad seleccionada, la resolución realmente en uso (p. ej. `0.183 Hz/bin · 5.5 s window`) y el ritmo de columnas (p. ej. `2.7 s/column`).

El mapa de color se refiere al ruido **actual**, medido de forma continua a partir de las zonas vacías de cada columna, y no a un nivel absoluto. Por eso los cambios de volumen, AGC, antena o banda no obligan a reajustar Gain: la presentación mantiene un contraste constante frente al ruido de banda que haya en cada momento. Como en los decodificadores, el audio se toma antes del AGC, la reducción de ruido y el silenciamiento, así que puede silenciar el receptor y seguir mirando.

Qué significan las formas:

- Una **portadora estable** dibuja una línea horizontal recta.
- El **Morse lento** dibuja esa línea como una cadena de segmentos cortos y largos: puntos y rayas que se leen de izquierda a derecha.
- Las **trazas curvadas o a la deriva** corresponden a un oscilador de baliza sin estabilizar que se calienta o se enfría. Es normal, y a menudo es precisamente esa firma de deriva la que permite a un observador habitual reconocer la estación.
- Las **rayas verticales** que cruzan toda la franja son estáticos o ráfagas de ruido local, no señal.

> **Consejos:**
> - Tenga paciencia. En QRSS 30 una sola columna tarda 5,5 segundos, de modo que un indicativo completo puede necesitar diez minutos o más para cruzar la pantalla. Déjelo funcionando.
> - Sintonizar desde la lista **Band** ya estrecha el paso de banda alrededor de la ventana. Si sintonizó a mano, hágalo usted: no cambia lo que resuelve la transformada, pero evita que vecinos fuertes accionen el AGC del receptor.
> - El grabber es independiente de los decodificadores: puede dejarlo funcionando mientras un decodificador trabaja en otra cosa.
> - Un span ancho a velocidad lenta es la combinación más pesada; toda la transformada se ejecuta en el navegador, así que en una máquina modesta es preferible un span de 50 Hz.

---

## 7. WSPR

**Qué es:** WSPR (Weak Signal Propagation Reporter, pronunciado «whisper») es un modo baliza de señales ultradébiles que cartografía las trayectorias de propagación en HF por todo el mundo. Cada transmisión dura unos 110 segundos y cabe en una ranura de 200 Hz de ancho. El decodificador espera a una ranura completa de 2 minutos alineada con UTC antes de decodificar.

### Frecuencias recomendadas (USB, dial)

| Banda | Frecuencia de dial |
|-------|--------------------|
| 160 m | 1.836.600 MHz |
| 80 m  | 3.568.600 MHz |
| 40 m  | 7.038.600 MHz |
| 30 m  | 10.138.700 MHz |
| 20 m  | 14.095.600 MHz |
| 17 m  | 18.104.600 MHz |
| 15 m  | 21.094.600 MHz |

### Configuración

1. Sintonice una de las frecuencias de dial de WSPR anteriores y ponga el modo en **USB**.
2. La señal WSPR ocupa el margen de audio 1400-1600 Hz. Seleccionar **WSPR** hace el resto por usted: el receptor pasa a USB y el paso de banda se estrecha a 1350-1650 Hz, que cubre todo el margen en el que busca el decodificador. No hace falta ajustarlo más.
3. Active el decodificador y seleccione **WSPR** en el desplegable. O basta con pulsar el botón **WSPR**.
4. El panel **WSPR-2 Decoder** aparece debajo.

### Lectura de la salida

El panel muestra una barra de progreso para la ranura de 2 minutos en curso:

- **Barra cian llenándose**: recogida de datos de señal (de 0 a 116 s dentro de la ranura).
- **Barra ámbar parpadeando**: decodificación en curso (los últimos ~4 s de la ranura).
- **Barra vacía**: esperando al siguiente minuto UTC par.

Cada punto (spot) decodificado con éxito se muestra en una tabla con las siguientes columnas:

| Columna | Significado |
|---------|-------------|
| UTC | Hora del spot (minuto par) |
| Callsign | La estación que transmitió |
| Grid | Localizador Maidenhead del transmisor |
| Power | Potencia transmitida en dBm |
| Freq | Frecuencia de audio exacta (Hz) dentro del paso de banda de WSPR |
| SNR | Relación señal/ruido en dB |

Haga clic en **Clear** para borrar la lista de spots.

> **Consejo:** la decodificación de WSPR requiere una hora del sistema muy precisa (±1 segundo respecto a UTC). La primera ranura tras activar el decodificador comenzará en el siguiente minuto UTC par; una breve espera es normal.

---

## 8. FAX de HF / WEFAX

**Qué es:** el radiofax de HF (también conocido como WEFAX) lo utilizan los servicios de guardacostas y meteorológicos de todo el mundo para difundir mapas del tiempo, cartas del estado del mar y análisis de superficie por onda corta. El decodificador reconstruye la imagen línea a línea a medida que se recibe.

### Configuración

1. Active el decodificador y seleccione **HF FAX / WEFAX** en el desplegable. O basta con pulsar el botón **FAX**.
2. El panel **HF FAX / WEFAX Receiver** aparece debajo.
3. **Seleccione una estación** en el desplegable Station. Hay más de 20 estaciones disponibles que cubren Europa, Asia, Oceanía y América (p. ej., DDH3/DDK3 Alemania, SVJ4/GR Grecia, JMH Japón, NMG EE. UU. Nueva Orleans).
4. Si la estación emite en más de una frecuencia, seleccione la deseada en el subdesplegable **Frequency**.
5. Haga clic en **▶ Tune** para sintonizar automáticamente la cascada en esa estación.
6. El modo se fuerza automáticamente a **USB**.

### Horario de emisiones

Al seleccionar una estación aparece una tabla de cuenta atrás **Next Transmissions** con las 4 próximas emisiones programadas en UTC y una cuenta atrás en directo:

- Normal (gris/verde): la transmisión está próxima.
- **Ámbar ⚡**: la transmisión empieza en menos de 3 minutos; prepare ya el decodificador.
- **Rojo ●**: la transmisión empieza en menos de 30 segundos; la recepción es inminente.

### Parámetros

La mayoría de las estaciones usan los valores estándar por defecto (marcados con ★). Cámbielos solo si sabe que la estación emplea ajustes no estándar.

| Parámetro | Por defecto | Descripción |
|-----------|-------------|-------------|
| LPM | 120 ★ | Líneas por minuto: la velocidad de giro del tambor |
| IOC | 576 ★ | Índice de cooperación: determina los píxeles por línea |
| Shift | 800 Hz ★ | Desplazamiento de frecuencia entre los tonos de negro y blanco |

### Controles

- **⇔ Auto-align**: activado por defecto. Se sincroniza automáticamente con la señal de fase al principio de cada imagen. Desactívelo solo si tiene problemas de alineación con una señal que sabe que es buena.
- **⇅ Invert**: intercambia blanco y negro. Úselo si la imagen aparece en negativo (zonas blancas donde debería haber negro).
- **↺ Refresh**: borra el lienzo y reinicia el decodificador. Úselo entre transmisiones o si la imagen se rompe o se desplaza.
- **⤓ Save PNG**: guarda el lienzo actual como archivo PNG en su ordenador.

### Indicadores de estado

Bajo la imagen, dos indicadores de tono muestran:

- **300 Hz phasing**: se ilumina en cian cuando se detecta el tono de fase de inicio de imagen.
- **450 Hz stop**: se ilumina en rojo cuando se detecta el tono de parada de fin de imagen.

> **Nota:** la imagen se desplaza hacia arriba; la línea recibida más reciente siempre aparece en la parte inferior del lienzo. Si ve **[PHASING]** en la cabecera, el decodificador se ha enganchado al inicio de una nueva imagen.

---

## 9. NAVTEX

**Qué es:** NAVTEX es el sistema internacional de radiodifusión marítima de información de seguridad costera: avisos a la navegación, previsiones meteorológicas y avisos de búsqueda y rescate. Utiliza FSK a 100 baudios (SITOR-B con FEC) y se recibe en canales dedicados en todo el mundo.

### Canales disponibles

| Canal | Frecuencia | Uso |
|-------|------------|-----|
| Internacional | 518 kHz | En inglés, internacional |
| Nacional | 490 kHz | Emisiones en el idioma nacional |
| HF (×5) | 4209.5 / 6314 / 8416.5 / 12579 / 16806.5 kHz | NAVTEX de HF de largo alcance |

### Configuración

1. Active el decodificador y seleccione **NAVTEX** en el desplegable. O basta con pulsar el botón **NAVTEX**. El receptor pasa automáticamente a **USB**.
2. Aparece el panel **NAVTEX Receiver**.
3. Seleccione el canal deseado en el desplegable **Station** (p. ej., `International — 518 kHz`).
4. Haga clic en **⇒ Tune & Set IF** para sintonizar automáticamente la cascada y estrechar el paso de banda hasta la ventana de audio correcta. El modo se pone automáticamente en **USB**. El dial se sitúa 500 Hz por debajo del centro del canal, de modo que la señal NAVTEX aparece a 500 Hz en audio.

### Horario de emisiones

La tabla de horarios enumera todas las estaciones conocidas del canal seleccionado con:

- su letra identificadora de la UIT y la bandera del país
- la hora de la próxima emisión en UTC
- una cuenta atrás en directo hasta la próxima transmisión
- **Ámbar ⚡** a menos de 2 minutos / **Rojo ●** a menos de 30 segundos: prepare ya el decodificador

### Lectura de la salida

El texto decodificado aparece en color verde azulado y paso fijo. Los límites de los mensajes están claramente marcados:

```
━━ ZCZC MA12 ━━
... message content ...
━━ NNNN ━━
```

`ZCZC` marca el inicio de un mensaje. Los tres caracteres siguientes identifican la estación (`M`), el tema (`A` = avisos a la navegación) y el número de orden (`12`). `NNNN` marca el final.

Haga clic en **Clear** para borrar el búfer de mensajes.

> **Nota:** NAVTEX funciona en frecuencias de MF y LF (518/490 kHz). El alcance de recepción suele ser de 200 a 400 millas náuticas desde el transmisor. Los canales de HF (4-17 MHz) ofrecen un alcance mucho mayor.

---

## 10. FSK / RTTY — incluidos PSK31 y Olivia

**Qué es:** un decodificador de uso general para modos de texto de banda estrecha, con cinco variantes de funcionamiento seleccionables desde un único menú. Tres son FSK auténtico (modulación por desplazamiento de frecuencia): FSK marítimo (SITOR), RTTY meteorológico y RTTY de aficionado. Las otras dos no son FSK en absoluto, pero comparten la misma ventana: **PSK31**, que es modulación por desplazamiento de fase, y **Olivia**, que es FSK multitono con corrección de errores. Cada variante incluye un preajuste adaptado a sus parámetros estándar.

### Variantes y preajustes

| Variante | Centro | Shift | Baudios | Trama | Codificación |
|----------|--------|-------|---------|-------|--------------|
| FSK marítimo / SITOR | 500 Hz | 170 Hz | 100 | 7N1 | CCIR-476 |
| RTTY meteorológico | 1000 Hz | 450 Hz | 50 | 5N1.5 | ITA2 |
| RTTY de aficionado | 1000 Hz | 170 Hz | 45.45 | 5N1.5 | ITA2 |
| PSK31 (BPSK) | 1000 Hz | — | 31.25 | — | Varicode |
| Olivia (MFSK) | 1000 Hz | — | según Mode | — | 7 bits + FEC |

El panel se adapta a la variante elegida. **Shift**, **Baud**, **Framing**, **Encoding**, **Invert mark / space** y **Auto shift detect** se ocultan para PSK31 y Olivia, porque ninguno de los dos modos tiene un par de tonos mark/space ni trama de tipo UART. En su lugar, **Center audio** pasa a ser un campo numérico de entrada libre (la portadora puede situarse en cualquier punto del paso de banda), y Olivia añade un selector **Mode** y un deslizador **Squelch**.

### Configuración

1. Active el decodificador y seleccione **FSK / RTTY** en el menú. O simplemente pulse el botón **RTTY**.
2. Aparece el panel del decodificador. Su título sigue a la variante — *FSK / RTTY Decoder*, *PSK31 Decoder* u *Olivia Decoder*.
3. Seleccione la **Variant**. Los parámetros se actualizan automáticamente.
4. Para Olivia, ajuste **Mode** (tonos / ancho de banda) para que coincida con la transmisión — véanse las notas sobre Olivia más abajo.
5. Utilice el menú **Known frequency** para elegir una frecuencia habitual de la variante seleccionada y pulse **Tune** para saltar a ella.
6. Afine la sintonía hasta que el texto decodificado sea estable y legible.

### Frecuencias conocidas por variante

**FSK marítimo / SITOR**
- 518,0 kHz — NAVTEX internacional
- 490,0 kHz — NAVTEX nacional
- 4209,5 / 6314,0 / 8416,5 / 12579,0 / 16806,5 / 22376,0 kHz — SITOR en HF

**RTTY meteorológico**
- 4583,0 / 7646,0 / 10100,8 / 11039,0 / 14467,3 kHz — DWD (Servicio Meteorológico Alemán)

**RTTY de aficionado**
- 3590 kHz (80 m), 7043 kHz (40 m), 10143 kHz (30 m), 14083 kHz (20 m), 21083 kHz (15 m), 28083 kHz (10 m)

**PSK31**
- 3580,15 kHz (80 m), 7040,15 kHz (40 m), 10142,15 kHz (30 m), 14070,15 kHz (20 m), 18100,15 kHz (17 m), 21080,15 kHz (15 m), 24920,15 kHz (12 m), 28120,15 kHz (10 m)

**Olivia**
- 3577,75 kHz (80 m), 7073,75 kHz (40 m), 10142,25 kHz (30 m), 14075,5 kHz (20 m), 18103,75 kHz (17 m), 21075,75 kHz (15 m), 24921,75 kHz (12 m), 28123,75 kHz (10 m)

### Parámetros

| Parámetro | Se aplica a | Descripción |
|-----------|-------------|-------------|
| Center audio (Hz) | todas | La frecuencia de audio del punto medio entre mark y space; en PSK31 la portadora, en Olivia el centro del bloque de tonos. Un menú desplegable en las variantes FSK, un campo de entrada libre en PSK31 y Olivia |
| Shift (Hz) | solo FSK | Diferencia de frecuencia entre los tonos mark y space |
| Baud | solo FSK | Velocidad de símbolo |
| Framing | solo FSK | Bits de datos, paridad, bits de parada (p. ej. 7N1 = 7 datos, sin paridad, 1 parada) |
| Encoding | solo FSK | Juego de caracteres (CCIR-476, ITA2/Baudot o ASCII) |
| Invert mark / space | solo FSK | Intercambia los tonos mark y space |
| Auto shift detect | solo FSK | Intenta medir el shift automáticamente a partir de la señal recibida |
| Mode (tonos / Hz) | solo Olivia | Número de tonos y ancho de banda — debe coincidir exactamente con la transmisión |
| Squelch (FEC S/N) | solo Olivia | Cuán fuerte debe ser la coincidencia de la corrección de errores antes de imprimir texto |

### Métricas de señal

La barra de estado muestra medidas en tiempo real, y los campos cambian según la variante:

| Variante | Campos mostrados |
|----------|------------------|
| Variantes FSK | **Mark / Space** (frecuencias de tono medidas), **SNR**, **Lock**, **Timing** |
| PSK31 | **Carrier** (Hz, tras la corrección automática de frecuencia), **IMD** (dB), **S/N**, **Lock**, **Timing** |
| Olivia | **Centre** (Hz), **Mode**, **S/N**, **FEC** (%), **Sync** |

`Timing`/`Sync` indica `LOCKED`/`SYNCED` cuando el decodificador sigue la señal, y `SEARCH` mientras aún la busca.

### Controles adicionales

- **⇒ Set IF Band-Pass** — estrecha el paso de banda del receptor para ceñirlo a la señal. La anchura depende de la variante: mark/space más margen en FSK, unos ±100 Hz en PSK31, y todo el ancho del bloque de tonos más margen en Olivia.
- **⟳ Auto-tune Center** — búsqueda automática de la señal. En las variantes FSK busca un par equilibrado de tonos, en PSK31 localiza la portadora, y en Olivia encuentra el bloque más fuerte del ancho de banda seleccionado.

### Notas sobre PSK31

PSK31 es el modo de teclado a teclado más común en HF. Ocupa solo 62 Hz, de modo que varios QSO conviven uno junto a otro dentro de unos pocos cientos de hercios alrededor de la frecuencia de reunión, y sintonizar consiste en elegir una traza del grupo en la cascada.

- El decodificador corrige por sí mismo su error de sintonía en unos **±25 Hz**, así que basta con acercarse. **Carrier**, en la fila de métricas, indica dónde se ha estabilizado realmente.
- **IMD** mide la calidad del transmisor, no la recepción: una señal limpia da unos −20 dB o mejor. Una lectura pobre significa que la otra estación está sobreexcitando su equipo, no que usted esté mal sintonizado.
- El texto aparece carácter a carácter sin corrección de errores, por lo que una señal débil se degrada en letras erróneas ocasionales en lugar de detenerse.

### Notas sobre Olivia

Olivia sacrifica velocidad a cambio de robustez. Es mucho más lento que PSK31, pero decodifica señales inaudibles al oído, lo que lo hace popular para señales débiles y contactos a larga distancia.

- **El ajuste Mode debe coincidir exactamente con la transmisión.** Una combinación errónea de tonos y ancho de banda no decodifica absolutamente nada — no texto ilegible, sino silencio. El panel se abre en **8 / 250**, la configuración estrecha que se deja funcionando en las frecuencias de llamada; **16 / 500** y **32 / 1000** son las otras dos de uso común, y también se ofrece **16 / 1000**.
- Olivia no envía preámbulo, por lo que el decodificador debe buscar la sincronización. **Deje pasar unos segundos** tras sintonizar antes de que aparezca texto. El campo **Sync** muestra `SEARCH` hasta que engancha.
- La corrección de errores trabaja por bloques, así que el texto llega **a ráfagas en lugar de en flujo continuo**, con un retardo de varios bloques entre la transmisión y su presentación.
- **Squelch (FEC S/N)** fija la confianza que debe alcanzar la corrección de errores antes de imprimir. El valor por defecto de 4,0 mantiene fuera el ruido; 3,0 es el mínimo, por debajo del cual el ruido aleatorio empieza a imprimir caracteres sueltos. Una buena señal marca 8–9 en el indicador **FEC**, de modo que hay margen de sobra para subir el squelch en una banda concurrida.

> **Nota sobre el modo:** el decodificador toma el control del modo de demodulación y del paso de banda de FI mientras está activo. Ambos se restauran automáticamente al desactivarlo. Las cinco variantes usan **USB**.
>
> **Nota sobre la polaridad (solo variantes FSK):** en RTTY meteorológico normalmente hay que marcar **Invert mark / space**. En FSK marítimo (tipo SITOR/NAVTEX) y RTTY de aficionado, déjelo sin marcar — el RTTY de aficionado envía mark como la radiofrecuencia más alta, y USB la mantiene como el tono de audio más alto, que es justamente el caso sin marcar. Si el texto decodificado sale ilegible, lo primero que conviene probar es cambiar esta casilla. La casilla se oculta en PSK31 y Olivia, que no tienen par mark/space.
>
> **Nota sobre letras/cifras (solo variantes FSK):** el código Baudot mantiene letras y cifras en dos estados separados, y el ruido puede llevar al decodificador al estado equivocado, lo que corrompe todos los caracteres siguientes y no solo el dañado. Por eso el decodificador vuelve a letras en cada espacio; es la práctica habitual y repara un cambio corrompido en una o dos palabras en lugar de una línea entera. El coste es que los grupos de cifras separados por espacios exigen que el transmisor repita el cambio a cifras después de cada espacio, como suelen hacer los equipos.

---

## 11. SSTV

**Qué es:** la televisión de barrido lento transmite imágenes fijas por un canal de voz SSB normal, línea a línea, como un tono modulado en frecuencia entre 1500 Hz (negro) y 2300 Hz (blanco). Una imagen completa tarda entre 36 segundos y 4 minutos y medio según el modo.

### Frecuencias recomendadas (USB)

| Banda | Frecuencia | Modo | Notas |
|-------|------------|------|-------|
| 20 m | 14.230 MHz | USB | La principal frecuencia internacional de llamada SSTV, con diferencia la más activa |
| 20 m | 14.233 MHz | USB | Secundaria, se usa cuando 14.230 está ocupada |
| 15 m | 21.340 MHz | USB | |
| 10 m | 28.680 MHz | USB | Activa durante las aperturas de banda |
| 40 m | 7.171 MHz | LSB | |
| 80 m | 3.845 MHz | LSB | Regional, por las tardes |

**La banda lateral se elige por usted.** Al iniciar el decodificador se selecciona **LSB por debajo de 10 MHz** y **USB por encima**, siguiendo la práctica habitual de radioafición. En la banda lateral equivocada la correspondencia de tonos queda invertida y la imagen no se decodificará. Si se encuentra con una estación que ignora la convención, cambie la banda lateral a mano: el decodificador sigue funcionando, borra el cuadro y empieza de nuevo con el nuevo ajuste.

### Configuración

1. Active el decodificador y seleccione **SSTV** en el desplegable. O basta con pulsar el botón **SSTV**. El receptor cambia de banda lateral automáticamente: USB por encima de 10 MHz, LSB por debajo.
2. Sintonice de modo que los tonos de la imagen caigan en el centro del paso de banda. Una señal bien sintonizada tiene sus impulsos de sincronismo a 1200 Hz y el contenido de imagen entre 1500 y 2300 Hz.
3. Deje **Mode** en **Auto** salvo que ya sepa qué se está enviando. La imagen se va formando línea a línea según se recibe.

### Modos

| Ajuste | Imagen | Duración |
|--------|--------|----------|
| **Auto** | Detectado automáticamente | — |
| Martin M1 / M2 | 320×256 color | 114 s / 58 s |
| Scottie S1 / S2 | 320×256 color | 110 s / 71 s |
| Scottie DX | 320×256 color | 269 s |
| Robot 36 / 72 | 320×240 color | 36 s / 72 s |

**Auto** funciona de dos maneras: lee la **cabecera VIS** —el código digital del modo enviado en los primeros 300 ms de una transmisión— y, si se perdió la cabecera (sintonizó tarde o se perdió por QSB), identifica el modo a partir de la temporización de los impulsos de sincronismo. Seleccionar un modo concreto lo fuerza, pero el decodificador sigue verificando el sincronismo antes de dibujar nada, de modo que una elección equivocada no produce imagen en lugar de ruido.

### Lectura de la salida

La línea de estado bajo los controles informa de lo que está haciendo el decodificador:

| Estado | Significado |
|--------|-------------|
| `Waiting for VIS / AUTO lock` | Escuchando; aún no se ha identificado nada |
| `Martin M1? verifying sync…` | Se ha encontrado un candidato y se está confirmando con las líneas siguientes |
| `Martin M1 lock (VIS)` | Enganchado a partir de la cabecera VIS |
| `Martin M1 lock (AUTO)` | Enganchado a partir de la temporización de sincronismo |
| `Martin M1 lock (MANUAL)` | Iniciado con el botón **⏺ Force** |
| `Candidate rejected (no sync)` | El candidato no se confirmó; normal con ruido |
| `— sync lost, resetting` | La señal desapareció a mitad de imagen |
| `Frame complete` | Se recibió la imagen completa |

El modo detectado también aparece en verde junto al título **SSTV**, y el contador de líneas muestra el avance.

### Controles

| Botón | Acción |
|-------|--------|
| **▶ Start** | Arma el decodificador. No dibuja una imagen por sí solo: el enganche debe venir de la cabecera VIS o de la detección de sincronismo. |
| **■ Stop** | Detiene la decodificación. |
| **↺ Reset** | Borra el lienzo y vuelve a armar en el sitio. Úselo entre imágenes o después de resintonizar. |
| **⏺ Force** | Empieza a dibujar **de inmediato** en el modo seleccionado en el desplegable, omitiendo por completo el VIS y la detección de sincronismo. Solo está disponible cuando Mode no está en **Auto**. |
| **💾 Save** | Guarda la imagen actual como PNG. |

**Cuándo usar Force.** Si ve una imagen en la cascada pero el decodificador no consigue engancharse —un modo poco común, una señal demasiado débil o distorsionada para los detectores, o una cabecera que se perdió—, seleccione el modo a mano y pulse **⏺ Force**. El cuadro se ancla en el momento del clic, y la etiqueta de modo muestra `MANUAL` para que lo distinga de un enganche por VIS o AUTO. El decodificador sigue ajustándose a un impulso de sincronismo real si lo encuentra, así que un clic algo adelantado o retrasado se corrige.

Como Force omite todas las comprobaciones de seguridad, pintará ruido sin más si lo pulsa en un canal vacío, y no se detendrá solo: pulse **■ Stop** o **↺ Reset**.

### Notas

- **El ruido no arranca el decodificador.** Antes bastaban los chasquidos atmosféricos, las chispas y el zumbido de la red para disparar una decodificación. Ahora cada etapa de detección comprueba que el tono sea un tono real y confirma el candidato con las líneas siguientes antes de dibujar un solo píxel. Es normal que el decodificador permanezca en silencio en una banda vacía.
- **La imagen se inclina en diagonal si está fuera de frecuencia.** SSTV no perdona los errores de sintonía. Si las líneas se tuercen, ajuste el dial en pequeños pasos y deje que empiece la siguiente imagen.
- El equilibrio de color y la nitidez son fijos; no hay nada que ajustar.

---

## 12. Consejos generales

**Primero hay que activar Decoder: ON.** El desplegable está desactivado (en gris) hasta que hace clic en el botón Decoder.

**Un decodificador cada vez.** Seleccionar un nuevo decodificador en el desplegable detiene automáticamente el que estuviera activo y deshace los cambios de modo o paso de banda que hubiera hecho.

**El modo se gestiona por usted.** El FAX de HF y NAVTEX ponen el receptor en USB en cuanto los selecciona, SSTV elige la banda lateral según la banda (LSB por debajo de 10 MHz, USB por encima) y FAX, NAVTEX y FSK también ajustan el paso de banda al pulsar su botón Tune. FT8, FT4, FT2, JS8 y WSPR hacen lo mismo en cuanto los selecciona — desde la fila de botones o desde el desplegable: el receptor pasa a USB y toma su propio paso de banda — la subbanda completa de 3 kHz para la familia FT8, 1350-1650 Hz para WSPR. Al detener el decodificador se restaura el modo por defecto de la banda.

**Activar un decodificador ya no interrumpe el audio.** Los decodificadores se ejecutan en sus propios hilos, así que no hay huecos, chasquidos ni cortes al iniciar, detener o cambiar de decodificador.

**La precisión del reloj del sistema importa.** FT8, FT4 y WSPR son críticos en el tiempo. Decodifican en ventanas fijas alineadas con UTC. Si el reloj del ordenador se desvía más de 1 o 2 segundos, la tasa de decodificación caerá notablemente. Use un cliente NTP para mantenerlo preciso.

**Los filtros de ruido no llegan a los decodificadores.** NR, NB, NS y AN son
ayudas de escucha, solo para sus oídos. Todos los decodificadores — FT8, FT4/FT2, CW, WSPR, FAX, NAVTEX, FSK/RTTY/PSK31/Olivia, SSTV y el grabber QRSS — toman el audio *antes* de esos filtros, así que ajústelos como mejor suene, sin preocuparse por la calidad de la decodificación. Por la misma razón los decodificadores siguen funcionando con el receptor silenciado o con el squelch cerrado: puede apagar el altavoz y dejar un decodificador, o una captura QRSS nocturna, recogiendo datos. Lo único que sí sigue lo que usted oye es el Espectrograma de Audio, pensado para mostrar el audio filtrado.

**La calidad de la señal importa más que su fuerza.** La mayoría de estos decodificadores están pensados para señales débiles. Una banda más tranquila y con menos ruido suele ser más productiva que una señal fuerte llena de interferencias. Use la cascada y los controles de paso de banda para identificar y evitar el QRM antes de activar un decodificador.

**Use los botones Refresh o Clear sin reparos.** Las imágenes de FAX se desplazan si la frecuencia de dial está algo desviada, y los decodificadores de texto acumulan caracteres espurios. Empezar de cero tras ajustar la sintonía suele producir una salida mucho más limpia.

### Reporte automático de spots y gráficas del servidor

Las decodificaciones de FT8, FT4 y WSPR también puede subirlas el propio servidor — FT8/FT4 a PSK Reporter y WSPR a WSPRnet — mediante un demonio autorun que el sysop inicia desde el panel de administración. Es independiente de los decodificadores de su navegador: sigue funcionando haya o no oyentes, y nada de lo que usted decodifique en el navegador se reporta.

El sysop lo sigue con dos contadores, fáciles de confundir entre sí: los paneles por decodificador cuentan los spots subidos desde el último arranque del demonio, mientras que el número junto a cada casilla de banda/modo es el total histórico de esa ranura y sobrevive a los reinicios. El mismo panel tiene una página **Gráficos** que representa la frecuencia de CPU, la carga, la temperatura y los usuarios conectados en los últimos 15 minutos a 24 horas. Ambos se describen en la [guía del panel de administración](ADMIN_PANEL_SETUP.md).

---

*PhantomSDR-Plus — fork de sv1btl — [phantomsdr.no-ip.org](http://phantomsdr.no-ip.org:8900)*
