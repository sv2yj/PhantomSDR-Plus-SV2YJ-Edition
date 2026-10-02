# PhantomSDR-Plus — Cómo editar las variantes del frontend

*(tras fusionar los cuatro archivos `App__*_smeter_.svelte` en un único `App.svelte`)*

---

## 1. Qué son las variantes

Dos elecciones independientes, que dan cuatro combinaciones:

```
smeter = "analog"     el instrumento de aguja móvil
       = "digital"    el instrumento de barra segmentada

layout = "v1"         selector de modos arriba, selector de banda abajo
       = "v2"         selector de banda arriba, selector de modos abajo
                      (mueve también la fila de botones de sintonía fina en el móvil)
```

Las cuatro viven en **una sola** construcción, servida en `/`. El selector ⚙️ de la esquina superior derecha cambia entre ellas dentro de la página en marcha: asigna las props `smeter`/`layout` de `App.svelte`, así que no se recarga nada y el audio, la cascada y los decodificadores siguen funcionando. La elección se guarda por navegador en `localStorage` bajo `phantom.variant`, y en la siguiente visita prevalece sobre el valor predeterminado de la construcción.

Por tanto, la variante que el sysop elige en `recompile.sh` es la variante **inicial**: lo que ve quien visita el sitio por primera vez, antes de tocar el menú.

| URL | qué es |
|-----|--------|
| `/` | la página de escritorio; las cuatro variantes, conmutables en tiempo de ejecución |
| `/mobile/` | *página aparte, construida por `build-mobile.sh` — no es una variante* |

> Hasta el 10-08-2026 cada variante era su propia construcción bajo `/analog/`, `/digital/`, `/v2-analog/` y `/v2-digital/`, y el selector navegaba entre ellas: por eso cambiar de variante recargaba la página y cortaba el audio. Esas construcciones ya no existen; en cada una de las cuatro rutas queda solo un pequeño `index.html` que redirige a `/`, escrito por `frontend/make-redirect-stubs.sh` en cada construcción para que los marcadores antiguos sigan funcionando.

La variante **no** se escribe en ningún archivo fuente. `src/main.js` es un punto de entrada fijo que pasa al componente dos valores definidos en tiempo de construcción:

```js
const app = new App({
  target: document.getElementById('app'),
  props: { smeter: __PHANTOM_SMETER__, layout: __PHANTOM_LAYOUT__ }
})
```

`vite.config.js` los rellena al construir, tomando el primero de estos que esté definido:

1. **`PHANTOM_SMETER` / `PHANTOM_LAYOUT`**: variables de entorno. Ya no las establece nada, ahora que no hay construcciones por variante; siguen funcionando para una construcción puntual con otra variante inicial.
2. **`frontend/variant.json`**: el valor predeterminado del sitio, escrito por `recompile.sh`. La construcción de la raíz (`/`) no pasa ninguna variante, así que acaba aquí.
3. **`analog` / `v1`**: el valor de reserva.

Esos dos valores son solo la semilla. `App.svelte` los sobrescribe al inicializarse a partir de `localStorage` si el visitante ya eligió una variante, y el selector ⚙️ vuelve a asignarlos en cada cambio.

Dentro de `App.svelte` las props se convierten en dos banderas en las líneas 20-21:

```js
$: isAnalog = smeter !== "digital";
$: isV2     = layout === "v2";
```

Use esas dos banderas — nunca `smeter`/`layout` directamente — para que todo el archivo se lea de la misma manera.

---

## 2. Qué hace cada archivo

### `frontend/src/main.js` — 12 líneas

El punto de entrada. Nada más que la instanciación de App y los dos valores `__PHANTOM_*__` que pasa como props. Es **constante**: ni `recompile.sh` ni los scripts de construcción lo reescriben ya, y eso es lo que permite construir las variantes al mismo tiempo.

> **No ponga código de la aplicación aquí.** Es el archivo de entrada, no un sitio para lógica.

### `frontend/src/App.svelte` — ~17130 líneas

Toda la aplicación: cascada, sintonía, decodificadores, marcadores, paneles, disposición de escritorio Y la disposición adaptable para teléfono. Casi todas las modificaciones que haga van aquí.

### `frontend/src/lib/SMeterAnalog.svelte` — 824 líneas

El instrumento de aguja móvil, completo: dibujo de la esfera, aguja, el conmutador de esfera clara/oscura con su clave de localStorage, y el suavizado de la aguja.

- Prop de entrada: `dbm` — la potencia CALIBRADA en dBm.
- También acepta: `mobile` — atributos de canvas más pequeños para la disposición de teléfono.
- Ajuste: `SMOOTH_TIME_MS` en la línea 55. Menor = aguja más rápida, mayor = más suave. Actualmente 16 (un fotograma a 60 fps, en la práctica el mínimo).

#### Las tres esferas — y `smeter_theme.sh`

El instrumento analógico tiene tres fondos, todos dibujados por el mismo código:

```
dark      el metal cepillado oscuro original
amber     una esfera clara, gris pálido
vintage   una esfera cálida de ámbar envejecido
```

**No lo confunda con la variante `smeter = analog / digital` de arriba.** La variante elige *qué componente de instrumento* se muestra; la esfera elige *cómo se pinta* el analógico. Se guardan bajo claves distintas de localStorage (`phantom.variant` y `smeterTheme`) y se fijan en lugares distintos.

**El lado del visitante.** El lienzo del instrumento es un botón (`role="button"`, también Enter/Espacio desde el teclado, con la indicación «click to switch style» debajo). Cada clic recorre dark → amber → vintage y guarda la elección en `localStorage.smeterTheme`. Se vuelve a leer en cada carga de página, así que la elección del visitante sobrevive a recargas y reinicios del navegador de forma indefinida. Deliberadamente **no** es una cookie: una cookie se enviaría al servidor en cada petición de cascada y de audio, para un valor que el servidor nunca lee.

**El lado del sysop.** Dos cosas en `SMeterAnalog.svelte` controlan lo que reciben todos los demás:

| Línea | Qué hace |
|-------|----------|
| `let smeterTheme = 'dark';` | La esfera que recibe un navegador **sin elección guardada**. |
| `const SMETER_PREF_VERSION = 2;` | Un contador. Cuando la versión guardada de un navegador está por detrás, olvida su esfera guardada **una vez** y adopta el valor por defecto anterior. Increméntelo para mover a los visitantes que ya han elegido. |

Cambiar solo el valor por defecto llega, por tanto, únicamente a los visitantes totalmente nuevos. Ambos cambios juntos mueven a todos: para eso está `smeter_theme.sh` en la raíz del repositorio:

```bash
./smeter_theme.sh                 # informar del valor actual y elegir en un menú
./smeter_theme.sh vintage         # fijarlo directamente y ofrecer la reconstrucción
./smeter_theme.sh dark --build    # ejecutar frontend/build-all.sh sin preguntar
./smeter_theme.sh amber --no-reset  # solo visitantes nuevos — no tocar a los existentes
```

Informa del valor actual, fija el nuevo, incrementa el contador de reinicio (siempre hacia arriba — **nunca lo baje**, un número menor simplemente impide que el reinicio se dispare) y después ofrece la misma elección de construcción del frontend que `recompile.sh`. **No** toca el backend y **no** reescribe `variant.json`.

> Un cambio llega a un oyente conectado solo cuando recarga su página: el valor por defecto está compilado en el paquete JS y el reinicio se ejecuta al cargar. No hay envío en vivo. Basta con una recarga normal, ya que vite aplica hash a los nombres de archivo del paquete.

El borrado único del contador se impone a todos, incluidos los visitantes que eligieron deliberadamente su propia esfera. Es intencionado: es la única forma de devolver todo el sitio a un mismo aspecto. Use `--no-reset` si prefiere dejarlos en paz.


### `frontend/src/lib/SMeterDigital.svelte` — 184 líneas

El instrumento de barra segmentada, completo.

- Props de entrada: `rawDb` — el valor EN BRUTO de `audio.getPowerDb()`
- `smeterOffset` — `audio.smeter_offset`
- `mobile` — atributos de canvas más pequeños

> **NOTA:** este instrumento se alimenta deliberadamente de la potencia EN BRUTO más el offset, NO del dBm calibrado que usa la esfera analógica. Siempre ha hecho su propia correspondencia. Darle el valor calibrado desplazaría todas las lecturas en cada estación digital. No «unifique» estas dos entradas.

### `frontend/src/lib/BandSelector.svelte` — 69 líneas

La rejilla de botones de banda. Se renderiza dos veces en `App.svelte` (una por disposición).

### `frontend/src/lib/ModesSelector.svelte` — 75 líneas

La rejilla de botones de modo. Se renderiza dos veces en `App.svelte`.

### `frontend/src/lib/StatusIndicators.svelte` — 122 líneas

Los pilotos de estado (mute, squelch, NR, NB, NS, AN, CTCSS). Acepta una prop `wide`: la disposición digital usa pilotos más anchos que la analógica. Ambas clases de Tailwind (`w-8` y `w-10`) están escritas por completo dentro del componente — el escáner de Tailwind solo ve nombres de clase literales, así que nunca los construya por concatenación de cadenas.

Todos los demás archivos de `frontend/src/lib/` (Spectrogram, PassbandTuner, FrequencyInput, VersionSelector, ...) son anteriores a este trabajo y no han cambiado.

---

## 3. Hacer un cambio que afecte solo a algunas variantes

Envuélvalo en la bandera. En el marcado:

```svelte
{#if isAnalog}
  ...solo las estaciones analógicas ven esto...
{:else}
  ...solo las estaciones digitales ven esto...
{/if}

{#if isV2} ... {/if}          {#if !isV2} ... {/if}
```

En un atributo class:

```svelte
class="p-4 {isAnalog ? 'text-xs' : 'text-sm'} rounded-md"
```

Escriba ambas alternativas como literales completos, como arriba. Tailwind rastrea el código fuente buscando nombres de clase completos; `text-{size}` o un nombre concatenado se purga del CSS y el estilo desaparece en silencio.

En el bloque `<script>`: intente NO ramificar en absoluto. El script calcula deliberadamente las entradas de AMBOS instrumentos en cada ciclo —

```js
smeterDbm    = powerDb;                    // esfera analógica
smeterRawDb  = audio.getPowerDb();         // esfera digital
smeterOffset = audio.smeter_offset;        // esfera digital
```

— de modo que solo el marcado tiene que elegir. Por eso hay apenas 15 conmutadores de variante en un archivo de 17000 líneas. Manténgalo así; la ramificación a nivel de script fue lo que hizo que los cuatro archivos antiguos divergieran.

---

## 4. Dónde están los conmutadores de variante

Quince lugares en `App.svelte`. Los números de línea se desplazan al editar — la forma fiable de encontrarlos todos es:

```bash
cd frontend/src && grep -n 'isAnalog\|isV2' App.svelte
```

En el momento de escribir esto:

| Línea | Bandera | Qué conmuta |
|-------|---------|-------------|
| 20 | | `isAnalog` declarada |
| 21 | | `isV2` declarada |
| 8062 | `isV2` | escritorio: selector de banda primero (orden v2) |
| 8090 | `isV2` | escritorio: tamaño del encabezado del panel |
| 8686 | `isV2` | escritorio: selector de modos primero (orden v1) |
| 8717 | `isAnalog` | ancho mínimo del panel del instrumento (la aguja es más estrecha) |
| 8730 | `isAnalog` | solo analógico: línea de fecha/hora sobre el instrumento |
| 8819 | `isAnalog` | solo analógico: pilotos de estado + separador |
| 8834 | `isAnalog` | solo digital: línea de hora, pilotos anchos y la propia elección `<SMeterDigital>` / `<SMeterAnalog>` |
| 8861 | `isAnalog` | espaciado vertical del bloque de frecuencia |
| 8864 | `isAnalog` | margen superior del bloque de sintonía fina |
| 12288 | `isV2` | teléfono: fila de sintonía fina arriba (orden v2) |
| 12347 | `isAnalog` | teléfono: qué instrumento se renderiza |
| 12433 | `isV2` | teléfono: fila de sintonía fina abajo (orden v1) |
| 13204 | `isAnalog` | tamaño de texto del botón de noise gate |

Todo lo demás en el archivo es común a las cuatro variantes.

---

## 5. Otros ajustes que conviene conocer

| Ubicación | Constante | Propósito |
|-----------|-----------|-----------|
| `App.svelte` línea 5034 | `const visualGain = 1.1;` | Calibración del instrumento analógico. Cada 0,10 equivale aproximadamente a 5 dBm en la lectura. |
| `SMeterAnalog.svelte` línea 55 | `const SMOOTH_TIME_MS = 16;` | Constante de tiempo del suavizado de la aguja, en milisegundos. |
| `SMeterAnalog.svelte` línea 64 | `let smeterTheme = 'dark';` | Esfera por defecto del instrumento analógico para un navegador sin elección guardada. Fíjela con `./smeter_theme.sh`, no a mano. |
| `SMeterAnalog.svelte` línea 69 | `const SMETER_PREF_VERSION = 2;` | Contador de reinicio único de la esfera guardada. Increméntelo para llevar a los visitantes existentes al valor por defecto; solo sube. |
| `SMeterDigital.svelte` línea 149 | `const DIGITAL_BAR_TRIM = 0;` | Desplaza la barra en segmentos enteros. |
| `SMeterDigital.svelte` línea 31 | `const numberOfDots = 35;` | Número de segmentos de la barra. |

---

## 6. Después de editar — reconstruir

Lo más sencillo, desde la raíz del repositorio:

```bash
./recompile.sh
```

La opción de menú **[2]** reconstruye el frontend y pregunta qué variante debe ver quien visita el sitio por primera vez. Esa elección se registra en `frontend/variant.json`: no se copia ni se reescribe ningún archivo fuente. (Antes también regeneraba `VersionSelector.svelte` a partir de un heredoc; eso se eliminó cuando el selector dejó de navegar, porque habría revertido la conmutación en tiempo de ejecución en cada ejecución.) La opción **[1]** es solo el backend, la **[3]** ambos.

O directamente, desde `frontend/`:

```
./build-all.sh          construye la página de escritorio Y /mobile/  <-- normalmente use este
./build-default.sh      solo la página de escritorio
./build-mobile.sh       solo /mobile/
```

> `build-default.sh` deja que vite vacíe `dist/`, lo que elimina `dist/mobile/` hasta el siguiente `build-all.sh` o `build-mobile.sh`. Por eso `build-all.sh` es la elección normal.

`build-all.sh` tiene su propia copia de la lógica de construcción (`build_version SMETER LAYOUT NAME OUTDIR BASE LOG`) en lugar de llamar a `build-default.sh`. Si cambia cómo se construye la página, cámbielo en AMBOS sitios o las dos rutas discreparán.

Algunos detalles que conviene conocer:

- Establece `PHANTOM_KEEP_OUTDIR=1` para que Vite no vacíe el directorio de salida, y limpia `dist/` él mismo: borra el contenido pero conserva `users.json`, que el `spectrumserver` en marcha reescribe cada vez que un oyente se conecta o se desconecta.
- Construye `/mobile` en último lugar, cuando la salida de escritorio ya está completa.
- Su maquinaria de construcción en paralelo (`PHANTOM_BUILD_JOBS`, 3 por defecto) es un resto de cuando había cinco construcciones de escritorio. Con una sola, nada hace cola.

**Bits de ejecución:** `recompile.sh` ejecuta `chmod +x` sobre un script antes de lanzarlo, y `build-all.sh` invoca deliberadamente `bash build-mobile.sh` en lugar de `./build-mobile.sh`, así que un bit ausente ya no rompe la construcción. Aun así, subir un script por la interfaz web de GitHub lo devuelve a 644, de modo que si ejecuta alguno directamente:

```bash
chmod +x frontend/build-*.sh
```

---

## 7. Cómo comprobar su cambio antes de fiarse de él

Un `vite build` en verde **NO** basta. La construcción no puede ver un identificador que se perdió al mover código entre archivos: eso es un `ReferenceError` en tiempo de ejecución, y la página sencillamente no carga. Ha ocurrido dos veces.

### 1) Comprobación de identificadores no definidos (detecta exactamente ese fallo)

```bash
cd frontend
npx eslint --no-eslintrc \
    --parser svelte-eslint-parser \
    --rule '{"no-undef":"error"}' \
    --env browser,es2022 \
    src/App.svelte src/lib/SMeter*.svelte
```

Se espera un hallazgo conocido e inofensivo:

```
'dBmCalOffset' is not defined
```

`typeof x === 'number'` sobre un nombre no declarado nunca lanza error, así que esa expresión ya vale 0. Cualquier otra cosa es un problema real.

### 2) Construya y luego CARGUE LA PÁGINA Y RECORRA LAS CUATRO VARIANTES

No solo la que cambió: una edición bajo `isAnalog`/`isV2` puede romper las otras tres mientras la suya funciona. Abra `/`, recorra las cuatro entradas del menú ⚙️ y luego abra `/mobile/`.

Abra la consola del navegador en cada una. Una página en blanco o dibujada a medias con un `ReferenceError` en la consola es la firma del error anterior.

### 3) Nunca deje `frontend/dist/` a medias

Un `npx vite build` a secas vacía el directorio de salida y se lleva con él `dist/mobile/` y el `dist/users.json` vivo del servidor: la página móvil responde 404 hasta la siguiente construcción correcta. Construya siempre mediante los scripts: `build-all.sh` establece `PHANTOM_KEEP_OUTDIR=1` y hace la limpieza él mismo, conservando `dist/users.json`. En caso de duda, vuelva a ejecutar `./build-all.sh`.
