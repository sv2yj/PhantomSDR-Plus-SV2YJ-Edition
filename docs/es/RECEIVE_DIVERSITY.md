# PhantomSDR-Plus — Diversidad de recepción

Combine su receptor con un **segundo receptor situado en otro lugar** y escuche al que en cada momento tenga la mejor señal. Cuando uno de los dos cae en un desvanecimiento, el otro normalmente no, y usted sigue copiando.

El segundo receptor puede ser otro PhantomSDR-Plus, un KiwiSDR, un UberSDR o un WebSDR. Con los tres primeros todo se ejecuta en el navegador: sin cambios en el servidor, sin ficheros de configuración, sin nada que instalar y sin acceso especial al otro receptor. El WebSDR es la excepción y necesita un pequeño programa en su propio servidor — véase [Usar un WebSDR](#usar-un-websdr) más abajo.

---

## Qué hace y qué no

Aquí diversidad significa **selección**: en cada instante está escuchando a uno u otro emplazamiento, con un breve fundido al cambiar. No es una agrupación en fase y no suma las dos señales.

Es una decisión deliberada, y la razón es física, no de software. Dos receptores separados cientos de kilómetros oyen la misma emisión por caminos ionosféricos distintos. Las dos formas de onda llegan con fase no relacionada y un Doppler ligeramente distinto, así que sumarlas suena hueco y con filtrado de peine — el clásico efecto «phasey». La combinación coherente real exige dos receptores con un **reloj común**, alineados muestra a muestra; dos receptores independientes a través de internet nunca pueden ofrecer eso.

Lo que se gana, por tanto, es **continuidad, no intensidad de señal**:

- En un camino estable donde un receptor es simplemente mejor, oirá ese receptor y no ganará nada. Es lo normal.
- En un camino con QSB profundo, los desvanecimientos en dos emplazamientos lejanos están en buena medida incorrelados. El emplazamiento A desaparece tres segundos, el B no, y el audio continúa. Espere *«dejé de perder palabras»*, no *«pasó de S3 a S7»*.
- La segunda ventaja suele ser el **ruido local y el QRM**. Dos emplazamientos tienen vecinos distintos, redes eléctricas distintas y salpicaduras distintas. En una banda ruidosa esto puede pesar más que el desvanecimiento.

Tiene un coste: escucha **entre uno y tres segundos por detrás del tiempo real**, porque el flujo que va por delante debe retrasarse para casar con el otro. Irrelevante para escuchar y decodificar, molesto si intenta trabajar una estación.

> [!NOTE]
> Los decodificadores digitales (FT8, JS8, WSPR, RADE y los demás) siguen usando deliberadamente su receptor **local**, no el audio combinado. Esos modos integran de forma coherente durante toda una ranura temporal, y cambiar de emplazamiento en mitad de la ranura es una discontinuidad de fase que puede costarle justo la decodificación que la diversidad pretendía salvar. La diversidad sirve al altavoz; los decodificadores conservan el flujo local continuo.

---

## Puesta en marcha rápida

1. Abra el panel **Receive Diversity** — está justo debajo de las ventanas de decodificadores, plegado, mostrando `Receive Diversity — off`. Haga clic para desplegarlo.
2. Elija qué es el segundo receptor: **PhantomSDR+**, **KiwiSDR**, **UberSDR** o **WebSDR**.
3. Escriba su dirección — o elija una de las guardadas — y pulse **Start**.
4. Sintonice su propio receptor con normalidad. El segundo **le sigue automáticamente** — frecuencia, modo y ancho de paso — cada vez que resintoniza.

Esa es toda la configuración. No hay nada que ajustar en el otro receptor ni un mando de sintonía aparte: siempre le sigue.

### Direcciones

| Segundo receptor | Qué escribir | Notas |
|---|---|---|
| PhantomSDR+ | `host:8900` | El puerto normal del receptor |
| KiwiSDR | `host:8073` | El puerto propio del KiwiSDR |
| UberSDR | `host` | Su **puerto web normal**, no el 8073 |
| WebSDR | `host:8901` | El puerto propio de la estación. Necesita el relé — véase abajo |

Se aceptan un nombre de host a secas, una dirección `http://` o una `ws://` completa. Si el otro receptor se sirve por HTTPS, escriba el nombre de host y se usará una conexión segura.

### Receptores guardados

Cada dirección que utiliza queda memorizada, en una lista propia para cada tipo de receptor — una dirección de KiwiSDR nunca es una sugerencia útil cuando el selector dice WebSDR. Las listas viven en su propio navegador: no se envían a ninguna parte y cada oyente tiene la suya.

El botón **☰** junto al cuadro de dirección abre la lista.

- **Nombres.** Cualquier entrada puede recibir un nombre — `Twente` se lee mejor que `websdr.ewi.utwente.nl:8901`. Las entradas con nombre aparecen en verde sobre su dirección, y el nombre se muestra junto a la dirección en la lista desplegable mientras escribe. Una entrada se identifica por su dirección, así que ponerle nombre nunca hace que la misma estación figure dos veces. Mientras la diversidad está en marcha, el receptor con el que está enlazada muestra su nombre **en negrita y parpadeando lentamente**, de modo que la lista dice además cuál está escuchando realmente.
- **add** añade un receptor a mano, sin conectarse antes a él. **✎** corrige nombre y dirección en el sitio, **✕** elimina una entrada y **clear all** vacía la lista del tipo que está en pantalla. Enter guarda, Escape cancela.
- **🌍** abre la página web propia de ese receptor en una pestaña nueva. Lo guardado es la dirección que marca el software, así que primero se convierte en una dirección navegable — `ws://` pasa a `http://` y se recorta la ruta `/audio`, `/ws` o, en un KiwiSDR, `/kiwi/…/SND` que necesita cada tipo de receptor, ya que la página de la estación está en la raíz. Es un enlace de verdad, así que el clic central o la pulsación larga funcionan como siempre.
- **El orden es suyo.** Mueva una fila con **▲▼**, o arrástrela y suéltela donde corresponda. Ese es el orden en que la lista desplegable ofrece las direcciones.
- **⭳ export e ⭱ import.** Las listas están en el almacenamiento del propio navegador, que desaparece al borrar los datos del sitio — de eso protege esto. Export escribe las cuatro listas, con sus nombres, en un archivo JSON que puede conservar o llevar a otro navegador u otra máquina. Import lo lee de vuelta y pregunta si **fusionarlo** (merge) con lo guardado o **reemplazarlo** (replace) todo.
- **▦ QR.** Dibuja todas las listas como un código QR en la pantalla, para llevarlas a un teléfono — véase «En el teléfono» más abajo. Una lista demasiado grande para escanear recurre al texto que hay al lado, que puede copiarse y pegarse en cualquier parte.

No hay límite en cuántos receptores guarda.

### En el teléfono

La página `/mobile` ofrece la misma función en una pestaña **Div**, junto a Audio, Bands, Marks, Users y Chat: tipo de receptor, dirección, Start y Stop, los receptores guardados como lista que se elige con un toque, las cifras en vivo y el ajuste de SNR. Cada fila lleva además el enlace **🌍** a la página propia de ese receptor. El segundo receptor sigue por sí solo la sintonía del teléfono, igual que en la página de escritorio. Lo que no está es la edición — renombrar, reordenar, borrar —, que se queda en la página de escritorio, donde hay sitio para ella.

La lista guardada pertenece a un navegador, así que un teléfono empieza con una vacía por muchos receptores que haya guardados en el escritorio. Para eso está el código QR: pulse **☰** y luego **▦ QR** en el escritorio, escanee el código con la cámara del teléfono y pegue el texto en **Import** de la pestaña Div. Pregunta si fusionar o reemplazar, y Export en el teléfono envía una lista en sentido contrario.

---

## Usar un WebSDR

Un WebSDR — el software de Pieter-Tjerk de Boer, PA3FWM, que funciona en Twente y en varios cientos de estaciones más — puede usarse como segundo receptor, pero no directamente desde el navegador.

El motivo es una comprobación deliberada por su parte. Un WebSDR rechaza la conexión de audio si la cabecera `Origin` no nombra su propio sitio, y `Origin` es un *nombre de cabecera prohibido*: el navegador la fija a partir de la página en la que está y ningún script puede cambiarla. No hay forma de sortearlo desde el cliente, ni debería haberla.

Por eso la conexión la realiza un pequeño programa en su propio servidor, `websdr_relay.py`. Su navegador habla con el relé, y el relé habla con el WebSDR.

### Instalar el relé

Los cuatro instaladores de distribución lo ofrecen como paso opcional. Para una instalación ya existente:

```
cd ~/PhantomSDR-Plus
./setup_websdr_relay.sh
```

Pide un puerto, toma su indicativo y la dirección de su estación de `frontend/site_information.json` y ofrece instalar un servicio systemd para que el relé arranque con el sistema. Los ajustes están en `websdr_relay.json` y pueden cambiarse en cualquier momento.

**Hay algo que el instalador no puede hacer por usted: abrir el puerto del relé en su router.** Los navegadores de los oyentes se conectan directamente al relé — no pasa por el receptor — así que sin esa redirección la diversidad con WebSDR solo funciona dentro de su propia red. Los otros tres tipos de receptor no se ven afectados.

Si el panel de administración está instalado, su dashboard muestra una tarjeta **WebSDR Diversity Relay** con el estado, el puerto y cuántas sesiones hay en curso y hacia qué estaciones.

### Ser un buen invitado

El relé se conecta a receptores ajenos desde su servidor y no desde la dirección de cada oyente, por eso está hecho para comportarse:

- **Un límite de diez sesiones simultáneas a un mismo WebSDR**, y sesenta en total. Es lo que evita que un día movido en su estación parezca un ataque a la de otro.
- **Un `User-Agent` que nombra su estación y a su operador**, para que quien prefiera no ser usado así sepa exactamente a quién escribir. Rellénelo con honestidad.
- **Solo se reenvían órdenes de sintonía.** La conexión no puede usarse para enviar nada más.
- **Se rechazan las direcciones privadas, de loopback y de NAT de operador**, de modo que ningún visitante pueda apuntar el relé a algo dentro de su máquina o de su LAN.

> [!IMPORTANT]
> La comprobación de `Origin` existe porque los autores de WebSDR no querían que sus receptores se manejaran desde páginas ajenas. Usar el relé es una decisión meditada, no un descuido suyo. Deje el límite donde está, mantenga el User-Agent honesto y deténgase si un operador se lo pide.

### Qué cambia con un WebSDR

- **Muchas estaciones cubren unas pocas franjas estrechas del espectro**, no un rango continuo — por ejemplo una ventana de 256 kHz en 40 m. La diversidad solo actúa dentro de ellas, y el panel lee la lista de bandas de la estación para saber dónde están.
- **La frecuencia de muestreo del audio varía** con el ancho del filtro y se aleja más del valor nominal que en los otros tipos, así que la alineación puede tardar algo más.
- **CW no se adapta** al convenio de WebSDR, que sitúa el paso de banda entero por debajo de la portadora. SSB y AM son correctos.

---

## Cómo leer el panel

En funcionamiento, el panel muestra una pequeña tabla:

| Fila | Significado |
|---|---|
| **link** | La conexión con el segundo receptor. `ready` es lo deseable. Ante un fallo aparece el texto de error del otro servidor y el código de cierre del WebSocket |
| **aligned** | El retardo medido entre los dos flujos una vez enganchados, o `searching` |
| **corr** | Con qué fuerza se correlan los dos flujos. Solo significativo tras la alineación |
| **remote audio** | Audio decodificado que llega del segundo receptor. `none` en ámbar significa que no se está decodificando nada |
| **SNR local / remote** | Las dos estimaciones de relación señal/ruido que se comparan |
| **switches** | Cuántas veces ha cambiado de emplazamiento |

Junto al título, una palabra le dice en qué punto está:

| | |
|---|---|
| `off` (gris) | no está en marcha |
| **`Please wait…`** (ámbar) | conectando, o conectado y todavía alineando |
| **`Ready`** (verde) | enlazado, enganchado y siguiendo al mejor emplazamiento |
| el error del propio receptor (rojo) | ha fallado y no se recuperará solo |

La distinción entre ámbar y rojo es la que ahorra tiempo: ámbar significa siga esperando, rojo significa deje de esperar y lea el mensaje.

El punto de color añade a qué emplazamiento está escuchando realmente — verde su receptor, cian el remoto.

### La alineación tarda unos 15 segundos

Es normal. Los dos flujos se alinean correlando sus **envolventes de audio**, y eso necesita una ventana de audio. La búsqueda se hace en dos etapas: una búsqueda estrecha de ±1,5 segundos puede empezar en cuanto se han reunido unos 9 segundos de sonido, y una segunda medición independiente, cinco segundos más tarde, debe **coincidir** con la primera antes de dar la alineación por buena. Cuando las dos estaciones están más separadas en el tiempo que eso — uno o dos segundos de almacenamiento adicional en algún punto del camino — toma el relevo la búsqueda completa de ±4 segundos, a los 14 segundos, y la confirmación llega a los 19.

Ese paso de confirmación importa. Cuando dos emplazamientos se desvanecen en antifase — sin llevar nunca la señal a la vez —, una sola correlación engancha tan campante un retardo rotundamente equivocado, que suena a eco. Exigir dos mediciones independientes que coincidan lo descarta.

Una segunda cosa debe ser correcta antes de que un enganche se sostenga: las velocidades de muestreo de los dos receptores. Dos receptores son dos relojes y dos cadenas de diezmado, así que sus flujos de audio **no** llegan exactamente a la misma velocidad aunque ambos declaren 12 kHz — un 2% de diferencia es normal, es decir 240 muestras por segundo de deriva, muy por encima de la tolerancia de alineación. Por eso el flujo remoto se remuestrea continuamente para igualar la velocidad de su propio receptor. Esa relación se mide **contando muestras**, no correlando, así que no necesita enganche propio y queda establecida en los primeros segundos — antes incluso de que se ejecute la primera búsqueda de alineación. Una señal débil o intermitente puede necesitar dos o tres intentos, así que 30 segundos no son motivo de preocupación; un minuto sin nada sí lo es.

Mientras dice `searching`, ambas cifras de SNR marcan `0.0`. Es intencionado: las dos estimaciones se miden sobre muestras **alineadas en contenido**, así que no se mide nada hasta que hay alineación. `0.0 / 0.0` significa «aún no enganchado», no «sin señal».

---

## Remote SNR trim

Este deslizador sesga la elección entre los dos emplazamientos. Se suma al SNR medido del receptor remoto antes de la comparación — positivo favorece al remoto, negativo al suyo. No cambia **nada más**: ni el nivel de audio ni la combinación, solo qué emplazamiento gana.

Existe porque las dos cifras de SNR no siempre son comparables. Ambas se miden igual — como recorrido entre percentiles del audio —, pero un receptor cuyo códec eleva su propio suelo de ruido marca menos de lo que merece. Un KiwiSDR aplica mucha ganancia y un limitador, lo que comprime el recorrido; un códec con pérdidas fija un suelo de ruido por debajo del cual la señal nunca baja.

**Cómo ajustarlo:**

1. Sintonice ambos receptores a una señal presente de forma fiable y espere a `aligned`.
2. Observe las dos cifras de SNR durante medio minuto. Anote la diferencia habitual.
3. Use los extremos como prueba de escucha: **+15** fuerza el emplazamiento remoto, **−15** el suyo. Escuche unos segundos cada uno. Es la única forma de oír un emplazamiento por separado.
4. Si el remoto marca, digamos, 5 dB menos pero suena igual de bien, ponga **+5**. Está haciendo que las dos lecturas coincidan cuando los dos emplazamientos suenan igual.
5. Vigile el contador **switches** durante diez minutos de escucha. Un conmutar constante indica que el valor está demasiado cerca del empate; no conmutar nunca aunque su receptor se desvanezca de forma audible indica que se ha pasado en el otro sentido.

Puntos de partida: **0** para otro PhantomSDR-Plus, que usa una cadena de audio idéntica y es comparable por construcción; un valor **positivo** pequeño para un KiwiSDR o un UberSDR.

> [!TIP]
> Si necesita más de ±8 dB aproximadamente, deje de ajustar. A esas alturas la explicación honesta suele ser que un receptor realmente es peor para ese camino, y sesgar más allá de una diferencia real solo significa escuchar al emplazamiento más flojo.

El ajuste se aplica al momento y se recuerda en su navegador.

---

## Elegir un segundo receptor

**La distancia importa.** Los desvanecimientos se descorrelan con la distancia — unos cientos de kilómetros en HF es un buen objetivo. Dos receptores en la misma ciudad se desvanecen a la vez y no aportan nada. Demasiado lejos, y el segundo receptor puede no oír su señal en absoluto.

**Ambos deben oír realmente la señal.** Este requisito no lo sortea ningún software. Si el segundo receptor no oye lo que usted escucha, la correlación se queda baja y no enganchará — a propósito, porque una alineación equivocada suena peor que no tener diversidad.

**Cobertura.** Un segundo PhantomSDR-Plus o un KiwiSDR anuncian el rango de frecuencias que cubren, y el panel le avisa si sintoniza fuera de él. Un WebSDR anuncia sus bandas, que a menudo son franjas estrechas en lugar de un rango continuo. UberSDR no anuncia cobertura, así que allí el no enganchar es su única señal.

> [!IMPORTANT]
> Los receptores públicos los mantienen voluntarios y tienen un número limitado de plazas de oyente. Una sesión de diversidad ocupa una mientras dure, exactamente igual que un oyente humano. Sea considerado antes de dejar una conexión indefinidamente, y pregunte al operador si piensa usar su receptor de forma intensiva.

---

## Resolución de problemas

**`link` no sale de `connecting`, o alterna conectar/cerrar** Probablemente la dirección o el puerto son incorrectos. Consulte la tabla de arriba — en particular, UberSDR usa su puerto web normal, no el 8073. El panel muestra el código de cierre del WebSocket y la consola del navegador (F12) el error subyacente.

**`link` muestra un error con texto detrás** Ese texto viene del otro receptor y suele ser concreto: sesión rechazada, servidor lleno o un receptor que no admite clientes externos.

**El KiwiSDR rechaza la conexión** Algunos KiwiSDR piden contraseña, y en un UberSDR el punto de acceso compatible con KiwiSDR está desactivado de fábrica. Para un UberSDR use el tipo **UberSDR** — esa vía está siempre disponible.

**WebSDR: `the WebSDR relay is not reachable`** El relé no está en marcha, o su navegador no alcanza su puerto. Debe ser accesible en el **mismo nombre de host desde el que se sirve la página del receptor**, porque el navegador se conecta directamente a él y no a través del receptor. Abra `http://<ese nombre de host>:<puerto del relé>/status` en el mismo navegador para ver cuál de los dos casos es. Si responde en su LAN pero no desde fuera, el puerto no está redirigido en el router.

**WebSDR: un error que menciona una conexión rechazada** Esa estación está más restringida que la comprobación habitual de `Origin`, o su operador ha bloqueado esta estación.

**`link` está en `ready` pero `remote audio` marca `none`** No se está decodificando audio. Recargue la página; si persiste, la consola del navegador mostrará qué decodificador falló.

**Llega audio pero nunca se alinea** Los dos receptores no están oyendo lo mismo. Pruebe una emisora de radiodifusión potente, o una banda donde ambos emplazamientos tengan buena propagación. Una banda tranquila con solo ruido en ambos extremos nunca correlará — y no debe hacerlo.

**Conmuta sin parar** Los dos emplazamientos están demasiado igualados en SNR. Ajuste ligeramente el trim para que uno quede preferido de forma estable.

**Nunca usa el segundo receptor** Compruebe que `remote audio` va subiendo y que las cifras de SNR tienen sentido. Si el remoto marca mucho menos de lo que suena, para eso está el trim.

---

## Limitaciones

- **No es coherente.** Sin phasing, sin cancelación, sin radiogoniometría. Cancelar una fuente de ruido exige dos antenas con un reloj común en un mismo emplazamiento; esa es otra técnica para otro problema.
- **De uno a tres segundos de retardo**, inevitablemente.
- **Solo dos receptores.**
- **Mono.** Si su receptor está en un modo estéreo como C-QUAM, el audio pasa intacto y la diversidad no entra en juego.
- **La alineación necesita señal.** Por debajo de unos 10 dB de SNR en uno de los dos emplazamientos, espere que se quede en `searching`.
- **Un WebSDR necesita el relé** en su propio servidor, con su puerto redirigido. Los otros tres tipos de receptor no necesitan ninguna de las dos cosas.
