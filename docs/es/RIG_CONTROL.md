# PhantomSDR-Plus — Control del transceptor (CAT)

Mantenga **su propio transceptor** y un **receptor PhantomSDR-Plus** en la misma frecuencia, modo y filtro. Gire el dial del equipo y la cascada lo sigue; haga clic en una señal de la cascada y el equipo se sintoniza en ella. Al transmitir, el receptor puede quedar en silencio para no devolverle su propia señal.

Funciona con receptores **PhantomSDR-Plus, KiwiSDR, PA3FWM WebSDR y UberSDR**, suyos o ajenos, y solo mueve *su* sesión de escucha: nadie más en el receptor oye ni ve nada. El operador del receptor no tiene que instalar ni configurar nada.

---

## Qué necesita

Dos formas de conectar un equipo y un requisito en el receptor:

| Pieza | Qué es | Sincroniza |
|---|---|---|
| **[Desktop PhantomSDR+](https://www.dropbox.com/scl/fo/kjwj96zg3kj7dgq4fjef9/APnA3c9hhv4hk3YMGIGjH7s?rlkey=jfiwklly63kv73poalx631pk3&st=m37uvaym&dl=0) 4.0 o posterior** | La aplicación de escritorio, con un menú **Rig**. Linux (PC y Raspberry Pi) y Windows. | Frecuencia, modo, ancho de filtro, silencio al transmitir — en un sentido o en ambos |
| **[CATsync Tool for WebSDRs](https://catsyncsdr.wordpress.com/)** | Un programa aparte para Windows que acopla un equipo a la página del receptor en su navegador. | Frecuencia y modo |
| **TCI-CAT en la página del receptor** | Un botón en la propia página de PhantomSDR-Plus, en cualquier navegador. Habla TCI con ExpertSDR, AetherSDR o Thetis, o con cualquier equipo compatible con Hamlib a través de un pequeño puente. Solo en receptores PhantomSDR-Plus con la versión 4.1.0 o posterior. | Frecuencia, modo y ancho de filtro en ambos sentidos; silencio al transmitir |
| **El receptor** | PhantomSDR-Plus, KiwiSDR, PA3FWM WebSDR o UberSDR. Un receptor PhantomSDR-Plus necesita la **4.1.0** o posterior para ancho de filtro y silencio. | Un PhantomSDR-Plus más antiguo sigue sincronizando frecuencia y modo |

La mayor parte de este manual describe Desktop PhantomSDR+. El botón TCI-CAT tiene su propia sección, [TCI-CAT en la página del receptor](#tci-cat-en-la-página-del-receptor). La CATsync Tool tiene su propia documentación en su sitio web.

---

## Receptores compatibles

La aplicación reconoce el tipo de receptor de una ventana de estación y lo maneja mediante los propios controles de esa página. La ventana Rig control muestra el tipo encontrado junto al nombre de la estación.

| Receptor | Frecuencia y modo | Ancho de filtro | Silencio al transmitir |
|---|---|---|---|
| PhantomSDR-Plus | Sí | Con la 4.1.0 o posterior | Con la 4.1.0 o posterior |
| KiwiSDR (incluido Web-888) | Sí | Sí | Sí |
| PA3FWM WebSDR | Sí, con cambio de banda en sitios multibanda | Sí | Sí |
| UberSDR | Sí | Sí | Sí |

Un receptor web tiene menos modos que la mayoría de equipos, así que algunos modos del equipo comparten un modo del receptor: KiwiSDR y WebSDR tienen un único CW para CW y CW-R. Los modos de receptor que nombra este manual son los de PhantomSDR-Plus; los demás receptores usan el equivalente más cercano. Un WebSDR mantiene un filtro CW por debajo de 1 kHz y los demás filtros en 1 kHz o más, porque así distingue la propia página el CW, y una frecuencia fuera de todas las bandas de un sitio WebSDR se deja en paz. UberSDR ajusta su filtro en pasos del deslizador, así que un ancho puede quedar hasta unos 50 Hz del del equipo. Cualquier otro tipo de página — OpenWebRX, por ejemplo — muestra *not a receiver this app can drive* y no se sincroniza nada.

---

## Qué hace y qué no hace

- Sincroniza **un equipo con una ventana de receptor** a la vez.
- Lee ambos lados varias veces por segundo y, cuando no coinciden, ajusta uno para que coincida con el otro. **No** transmite, no activa el PTT ni envía audio a ninguna parte.
- Mover el receptor solo cambia su propia sesión. Los demás oyentes del mismo receptor no se ven afectados y el operador no tiene que permitirlo.
- Un puerto serie solo puede abrirlo **un programa a la vez**. Si WSJT-X, un programa de registro o una utilidad del fabricante ya tiene el puerto, use la opción **flrig** o **rigctld on network** para compartir el equipo en lugar de pelear por el puerto.

---

## Inicio rápido

1. Abra una estación en Desktop PhantomSDR+ como de costumbre.
2. **Rig → Rig control...**
3. En **Connection**, elija **Built-in** si su equipo está en la lista; si no, **Hamlib (all rigs)**.
4. Elija su equipo, el puerto serie y la velocidad a la que está configurado el menú CAT o CI-V del equipo.
5. En **Sync**, deje seleccionado **Both directions**.
6. Pulse **Connect**. Las dos lecturas de arriba — transceptor y receptor — deberían mostrar la misma frecuencia en un segundo.

Cada ajuste se guarda al cambiarlo. La próxima vez basta con **Rig → Connect**, o marque **Connect when the app starts**.

---

## Cómo llegar al equipo

| Opción | Úsela cuando | Necesita |
|---|---|---|
| **Built-in** | Su equipo está en la lista de abajo. | Nada más |
| **Hamlib (all rigs)** | Su equipo es cualquier otro — Hamlib conoce más de 300. La aplicación inicia el `rigctld` de Hamlib por usted, en un puerto local privado, y lo detiene al desconectar. | Windows: nada, Hamlib va incluido. Linux: `sudo apt install libhamlib-utils` |
| **rigctld on network** | Ya hay un `rigctld` en marcha, en este ordenador u otro de su red. | Host y puerto (4532 por defecto) |
| **flrig** | flrig ya controla el equipo para fldigi, WSJT-X o un programa de registro. | flrig en marcha, con su puerto XML-RPC (12345 por defecto) |

### Equipos con controlador integrado

La velocidad y la dirección CI-V que aparecen son los valores de fábrica que rellena la aplicación. **Son solo un punto de partida: póngalos como indique el menú de su equipo.**

| Familia | Equipos | Velocidad por defecto | Notas |
|---|---|---|---|
| **Icom CI-V** | IC-7300, IC-7610, IC-705, IC-9700, IC-905, IC-7760, IC-7851, IC-7100, IC-7410, IC-9100, IC-7600, IC-7200, IC-7700, IC-7000, IC-7800, IC-756PROIII, IC-756PROII, IC-R8600 y cualquier otro equipo CI-V | 19200 | Dirección CI-V por modelo (IC-7300 `94`, IC-705 `A4`, IC-9700 `A2`, IC-7610 `98` …) |
| | IC-746PRO, IC-718, IC-R75 | 9600 | |
| **Xiegu** (CI-V) | G90, X6100 | 19200 | Dirección `70`; compruébela en el menú |
| **Yaesu CAT nuevo** | FTDX101D/MP, FTDX10, FT-710, FT-991/A, FT-891, FTDX5000, FTDX3000, FTDX1200, FT-950, FT-2000, FT-450/450D | 38400 | |
| **Yaesu CAT clásico** | FT-817/818, FT-857/857D, FT-897/897D | 38400 | 2 bits de parada; sintoniza en pasos de 10 Hz |
| **Kenwood** | TS-990S, TS-890S, TS-590S/SG | 115200 | |
| | TS-480, TS-2000, TS-870S | 57600 | |
| **Elecraft** | K4, K3/K3S, KX3, KX2 | 38400 | Sincroniza el ancho de filtro |
| **Compatibles Kenwood** | FlexRadio SmartSDR CAT (puerto virtual), QRP Labs QMX/QMX+/QDX, (tr)uSDX, Lab599 Discovery TX-500, otros compatibles Kenwood | 9600–38400 | |

Un equipo que debería ser compatible pero no se entiende con un controlador integrado suele funcionar con **Hamlib**, que tolera muchas más variantes.

---

## Ajustes del puerto serie

| Ajuste | Qué poner |
|---|---|
| **Serial port** | El puerto del equipo. Los adaptadores USB y los equipos con puerto USB aparecen primero. **Other / network address...** acepta un puerto que no esté en la lista — `COM7`, `/dev/ttyUSB1` — o `tcp://host:port` para un puerto serie servido por la red con ser2net o similar. |
| **Speed (baud)** | Exactamente lo que diga el menú de velocidad CAT / CI-V del equipo. Una velocidad errónea parece un equipo que nunca responde. |
| **Stop bits** | 1 para casi todo; 2 para la familia FT-817/857/897. |
| **CI-V address** | Solo Icom, en hexadecimal (`94`, no `148`). Debe coincidir con el menú de dirección CI-V. |
| **DTR / RTS** | Déjelos **desactivados** salvo que su interfaz los necesite. Muchos cables CAT activan el transmisor, o reinician el equipo, con una de esas líneas. |
| **Hardware flow control** | Desactivado, salvo que el manual pida RTS/CTS. |

Con **Hamlib** los mismos ajustes pasan a `rigctld`. Allí los bits de parada tienen además *Rig default*, y **Extra rigctld options** acepta cualquier otra opción de `rigctld`, por ejemplo `--set-conf=post_write_delay=10`. **rigctld program** permite apuntar a un `rigctld` concreto si tiene más de uno instalado.

---

## Sincronización

### Sentido

| Opción | Qué ocurre |
|---|---|
| **Rig → receiver** | La ventana del receptor sigue al equipo. Un cambio hecho en la cascada vuelve a la frecuencia del equipo. |
| **Receiver → rig** | El equipo sigue a la ventana del receptor. Girar el dial del equipo se deshace. |
| **Both directions** | Gana el lado que haya tocado **en último lugar**. Al conectar, antes de tocar ninguno, gana el equipo. |

El sentido también se cambia desde el menú **Rig** con la conexión activa.

### Cómo se evita que los dos lados se peleen

Cada valor que escribe la aplicación aparece un momento después como un cambio en el otro lado. Si se tomara al pie de la letra, el equipo y el receptor se perseguirían sin fin. La aplicación lo evita de tres formas:

- La página del receptor aplica un cambio al instante, así que se vuelve a leer justo después de escribir y esa lectura pasa a ser el nuevo punto de partida.
- Un equipo aplica un cambio un poco después, así que se recuerda cada valor enviado. Cuando el equipo informa de ese valor, se reconoce como escritura de la aplicación y no como una mano en el dial.
- Un valor que el equipo rechaza — FM ancha en un equipo de HF, por ejemplo — se envía **dos veces** y después se deja en paz hasta que cambie el lado de origen, en lugar de repetirse varias veces por segundo.

Resintonizar la página del receptor puede hacer que elija el modo por defecto de la banda (LSB por debajo de 10 MHz, por ejemplo). Cuando manda el equipo, la aplicación repone enseguida el modo del equipo, así que un equipo en USB en 40 m mantiene el receptor en USB.

### Qué ventana de receptor

**Receiver window** elige qué estación sigue al equipo:

- **The station window last in front** (por defecto) — con dos estaciones abiertas, haga clic en una y el equipo la sigue.
- **Una estación concreta** — el equipo queda fijado a ella, esté delante o no. Si esa estación no está abierta, no se sincroniza nada hasta que lo esté.

### Frecuencia de actualización

**Update every** fija cada cuánto se leen ambos lados: 150 ms, 300 ms (por defecto), 500 ms o 1 s. Más rápido se nota más inmediato en el dial; más lento es más amable con un equipo antiguo a 4800 o 9600 baudios, donde cada lectura tarda tiempo real en la línea.

---

## Modos

| Modo del equipo | El receptor escucha en |
|---|---|
| USB, LSB | USB, LSB |
| CW | CW |
| CW-R (invertido) | CW-L |
| AM, AM síncrona, DSB | AM |
| FM, FM estrecha | FM |
| FM ancha | WBFM |
| RTTY / FSK | LSB |
| RTTY-R / FSK-R | USB |
| Modos de datos (USB-D, DATA-U, PKTUSB, DIG) | USB |
| Datos LSB, datos FM | LSB, FM |

| Modo del receptor | El equipo se pone en |
|---|---|
| USB, LSB | USB, LSB |
| CW | CW |
| CW-L | CW-R |
| AM, QUAM | AM |
| FM | FM |
| WBFM | WFM — la mayoría de equipos de HF lo rechazan y se les deja en paz tras dos intentos |
| RADE (superior / inferior) | USB / LSB |

Un equipo en **modo de datos** se queda en él: el USB del receptor se considera coincidente con el USB-D del equipo, así que el receptor nunca saca al equipo del modo de datos.

---

## Ancho de filtro

Marque **Sync filter width** para que coincidan las bandas de paso. Diferencias de menos de 60 Hz se consideran iguales, porque no hay dos filtros con los mismos pasos.

| Conexión del equipo | Ancho de filtro |
|---|---|
| Hamlib | Sí, donde Hamlib lo admita para ese equipo |
| flrig | Sí |
| Icom CI-V integrado | Sí — pasos de 50 Hz hasta 500 Hz, luego de 100 Hz hasta 3,6 kHz; AM en pasos de 200 Hz hasta 10 kHz; no en FM |
| Elecraft integrado | Sí, en pasos de 10 Hz |
| Kenwood, Yaesu y familia FT-817 integrados | No — estos equipos eligen filtros de tablas propias de cada modelo. Use Hamlib si necesita el filtro |

Los receptores KiwiSDR, WebSDR y UberSDR tienen siempre el control. Un receptor PhantomSDR-Plus debe tener la **4.1.0** o posterior; en uno más antiguo la frecuencia y el modo siguen sincronizándose, y la ventana Rig control explica por qué el filtro no.

---

## Silencio al transmitir

Marque **Mute receiver while transmitting**. Mientras el equipo transmite, la ventana del receptor queda en silencio, y al dejar de transmitir vuelve el sonido. El botón de silencio del receptor lo muestra y puede quitar el silencio a mano.

Si ya había silenciado el receptor usted mismo, sigue silenciado después.

Necesita una conexión que informe del estado de transmisión — todos los controladores integrados, flrig y Hamlib en la mayoría de equipos — y, en un receptor PhantomSDR-Plus, la 4.1.0 o posterior.

---

## Desplazamiento de frecuencia

**Frequency offset** se suma a la frecuencia del equipo para obtener la del receptor:

> frecuencia del receptor = frecuencia del equipo + desplazamiento

| Instalación | Desplazamiento |
|---|---|
| Transverter de 2 m con equipo de 10 m (144,100 MHz aparece como 28,100 MHz) | `116000000` |
| Transverter de 70 cm con equipo de 2 m (432 → 144) | `288000000` |
| Sin transverter | `0` |

---

## El menú Rig

| Elemento | Qué hace |
|---|---|
| **Rig control...** | Abre la ventana Rig control |
| **Connect / Disconnect** *nombre del equipo* | Inicia o detiene la sincronización; con Hamlib también inicia o detiene `rigctld` |
| **Rig to receiver / Receiver to rig / Both directions** | Sentido de la sincronización |
| **Sync filter width** | Sí / no |
| **Mute receiver while transmitting** | Sí / no |
| Línea de estado | *Not connected*, *Connecting...*, *Connected: nombre*, o el último error |

La lectura de frecuencia en directo está en la ventana Rig control y no en el menú, que de lo contrario se cerraría solo con cada cambio.

---

## Linux

**Permiso del puerto serie.** Los puertos serie pertenecen al grupo `dialout`. Un usuario fuera de él obtiene *Could not open ttyUSB0*. Añádase una vez y luego cierre sesión y vuelva a entrar:

```bash
sudo usermod -aG dialout $USER
```

**Hamlib.** Instálelo desde su distribución:

```bash
sudo apt install libhamlib-utils
```

El paquete `.deb` de Desktop PhantomSDR+ lo recomienda, así que `sudo apt install ./phantomsdr-plus-desktop_4.0.0_amd64.deb` lo trae consigo; `dpkg -i` no instala paquetes recomendados. Los controladores integrados y flrig no necesitan Hamlib.

## Windows

El propio `rigctld.exe` de Hamlib va incluido en el instalador de 64 bits y en el de 32 bits. Los puertos COM aparecen en la lista por su nombre (`COM3`). Si el equipo necesita un controlador USB, instale primero el del fabricante: hasta entonces el puerto no existe.

---

## TCI-CAT en la página del receptor

Una página de receptor PhantomSDR-Plus también puede seguir a un transceptor **por sí misma**, sin la aplicación de escritorio: el navegador habla directamente con un servidor **TCI** en su propio ordenador. TCI es el protocolo de control por WebSocket de ExpertSDR2/ExpertSDR3 (SunSDR), AetherSDR (FlexRadio) y Thetis (Apache Labs ANAN, Hermes). Para un equipo sin TCI, un pequeño puente incluido en PhantomSDR-Plus hace que cualquier equipo de Hamlib parezca un servidor TCI.

Necesita un receptor PhantomSDR-Plus con la versión **4.1.0 o posterior**. Las páginas KiwiSDR, WebSDR y UberSDR no lo tienen.

### El botón TCI-CAT

El botón está en la fila de **VFO**, **Modes**, **Bands** e **IF Filters** — **TCI-CAT** en el diseño ancho, **CAT** en el compacto. Su punto está **verde** mientras hay un servidor TCI conectado y **gris** en otro caso. Abre una ventana con: Hasta la 4.2.0 el botón se llamaba **QRG Sync**.

| Control | Qué hace |
|---|---|
| Estado | *Active — TCI (port 50001)* cuando está conectado; *Inactive* con ⏳ *Wait* mientras busca |
| **CAT Sync** | Activa o desactiva la sincronización de frecuencia, modo y filtro. El silencio al transmitir funciona en ambos casos |
| **Host** | El ordenador con el servidor TCI: `localhost` para este ordenador, o su dirección en la red local, p. ej. `192.168.1.42`. Pulse Intro o haga clic fuera para reconectar |

No hay nada más que elegir: los puertos **50001** (ExpertSDR3, AetherSDR) y **40001** (ExpertSDR2, Thetis) se prueban a la vez y se reintentan cada pocos segundos, así que la página se conecta en cuanto arranca el programa. El navegador recuerda **CAT Sync** y **Host**.

Los navegadores que piden permiso antes de que una página web acceda a su red local — las versiones recientes de Chrome y Edge lo hacen — preguntan una vez, la primera vez que la página se conecta. Permítalo, o el punto seguirá gris.

### Qué se mantiene sincronizado

| | Comportamiento |
|---|---|
| **Equipo → receptor: frecuencia** | Solo se mueve el dial. Zoom, brillo y contraste quedan como los dejó; la cascada solo se desplaza cuando la frecuencia sale de la pantalla, y el plan de bandas no cambia el modo |
| **Equipo → receptor: modo** | Sigue cuando cambia el modo del equipo — USB, LSB, CW, AM, FM; los modos de datos como USB o LSB. Un modo que el receptor no tiene lo deja como está. Un decodificador en marcha conserva su propio modo |
| **Equipo → receptor: ancho de filtro** | La banda de paso del receptor toma el ancho de filtro del equipo: cambiar el filtro del equipo, o pulsar su botón **FIL**, cambia la banda de paso. Un decodificador en marcha conserva su propia banda de paso |
| **Receptor → equipo: frecuencia** | Escribir una frecuencia, una etiqueta o marcador, un clic en la cascada y arrastrar la banda de paso mueven el VFO del equipo. Al arrastrar solo se envían las frecuencias que cambian |
| **Receptor → equipo: modo** | Cada cambio de modo en la página — un botón de modo, el plan de bandas, un decodificador, un marcador — fija el modo del equipo (USB, LSB, CW, AM, FM; RADE como USB o LSB). Un equipo en modo de datos (USB-D) sigue en él |
| **Receptor → equipo: ancho de filtro** | Los botones de **IF Filters**, el deslizador IF, arrastrar la banda de paso y un cambio de modo fijan el filtro del equipo; al arrastrar solo se envía el ancho final. En los equipos Icom el puente selecciona en su lugar FIL1, FIL2 o FIL3 — ver [Filtros Icom](#filtros-icom-fil1-fil2-fil3) |
| **Sin eco** | Un cambio que vino del equipo nunca se le devuelve, y se ignora un aviso del modo o filtro anterior del equipo que llegue justo después de un cambio en la página |
| **Silencio al transmitir** | Siempre activo, incluso con CAT Sync apagado: la página se silencia mientras el equipo transmite. Mover el deslizador de volumen durante la transmisión la mantiene en silencio; al recibir, el sonido vuelve con la posición actual del deslizador |
| **No se gestiona** | Split, VFO B, RIT/XIT y desplazamientos de transverter. Solo se sigue el VFO A del primer receptor |

El modo y el ancho de filtro viajan con las órdenes propias de TCI (`modulation`, `rx_filter_band`), así que ExpertSDR, AetherSDR y Thetis también deberían seguirlos; solo se ha probado el puente Hamlib. Para un desplazamiento de transverter, use Desktop PhantomSDR+. No use ambos a la vez con el mismo equipo — dos controladores se pelean por el dial.

### Con qué transceptores funciona

| Transceptor | Funciona | Cómo |
|---|---|---|
| SunSDR (ExpertSDR2/3), FlexRadio (AetherSDR), ANAN/Hermes (Thetis) | Sí | Directamente — active el servidor TCI en el programa. Aún no probado con estos programas; probado con un servidor TCI simulado |
| Un equipo con puerto CAT compatible con Hamlib — la mayoría de Icom, Yaesu, Kenwood, Elecraft, Xiegu, QRP Labs | Sí | Mediante el puente Hamlib descrito abajo. Probado con un **Icom IC-7300** en Linux y Windows; otros controladores pueden diferir en los nombres de modo o en informar del PTT |
| Un equipo sin puerto CAT, o no compatible con Hamlib | No | No hay de dónde leer la frecuencia |

### El puente Hamlib (IC-7300 y otros equipos sin TCI)

`tci-bridge/tci-rigctld.mjs`, en el árbol de PhantomSDR-Plus, convierte cualquier equipo que Hamlib pueda controlar en un servidor TCI para la página. Se ejecuta en **su** ordenador — el conectado al equipo, junto al navegador — no en el receptor. Cuatro veces por segundo pregunta a Hamlib la frecuencia, el modo, el ancho de filtro y el estado de transmisión, envía a la página solo lo que cambió y pasa al equipo los cambios de frecuencia, modo y filtro de la página.

Llega a Hamlib por una de dos vías:

| Vía | Cadena | Cuándo |
|---|---|---|
| **`--rigctl`** (recomendada) | transceptor → `rigctl` → `tci-rigctld.mjs` → página | Normalmente. El puente arranca por sí mismo el `rigctl` de Hamlib: una ventana, ningún puerto de red. **Úsela en Windows**, donde `rigctld.exe` suele rechazarse con *Access is denied* |
| **`rigctld`** | transceptor → `rigctld` → `tci-rigctld.mjs` → página | Otro programa, como WSJT-X, debe usar el equipo al mismo tiempo — ver [Compartir el equipo](#compartir-el-equipo-la-vía-rigctld) |

**Qué necesita**

| | Linux | Windows |
|---|---|---|
| Hamlib | `sudo apt install libhamlib-utils`, o el paquete hamlib de su distribución | `hamlib-w64-….zip` de [github.com/Hamlib/Hamlib/releases](https://github.com/Hamlib/Hamlib/releases), extraído en `C:\hamlib` — `rigctl.exe` está en `C:\hamlib\bin` |
| Node.js | 18 o posterior | El *Windows Installer (.msi)* LTS de [nodejs.org](https://nodejs.org), con las opciones por defecto |
| El paquete `ws` | Se encuentra automáticamente dentro del árbol PhantomSDR-Plus | Copie `tci-rigctld.mjs` a una carpeta como `C:\tci-bridge` y ejecute allí una vez `npm install ws` |
| El puerto del equipo | `ls /dev/serial/by-id/`. Únase una vez al grupo `dialout`: `sudo usermod -aG dialout $USER`, luego cierre la sesión y vuelva a entrar | Instale el controlador USB del fabricante; el número COM está en **Administrador de dispositivos → Puertos (COM y LPT)** |

Solo un programa puede tener el puerto CAT del equipo. Cierre WSJT-X, flrig, JS8Call, RS-BA1 o la conexión de equipo de Desktop PhantomSDR+ antes de arrancar el puente.

#### Ejemplo: Icom IC-7300

En el equipo: **MENU → SET → Connectors → CI-V** — **CI-V USB Baud Rate** `115200`, **CI-V Transceive** `ON`. El número de modelo de Hamlib para el IC-7300 es `3073`.

**Linux.** El equipo es la línea que contiene `IC-7300` en `ls /dev/serial/by-id/`, normalmente también `/dev/ttyUSB0`.

1. Compruebe que Hamlib llega al equipo — debe mostrar la frecuencia, p. ej. `14280000`:
   ```bash
   rigctl -m 3073 -r /dev/ttyUSB0 -s 115200 f
   ```
2. Arranque el puente y déjelo en marcha:
   ```bash
   cd ~/PhantomSDR-Plus/tci-bridge
   node tci-rigctld.mjs --rigctl rigctl -m 3073 -r /dev/ttyUSB0 -s 115200
   ```

**Windows.** El equipo aparece en el Administrador de dispositivos como *Silicon Labs CP210x USB to UART Bridge (COM4)* — use su propio número COM. En un Símbolo del sistema:

1. Compruebe que Hamlib llega al equipo — debe mostrar la frecuencia:
   ```bat
   C:\hamlib\bin\rigctl.exe -m 3073 -r COM4 -s 115200 f
   ```
2. Arranque el puente y deje la ventana abierta:
   ```bat
   cd C:\tci-bridge
   node tci-rigctld.mjs --rigctl C:\hamlib\bin\rigctl.exe -m 3073 -r COM4 -s 115200
   ```
   La línea es larga: asegúrese de que termina de verdad en `-s 115200`, o `rigctl` se detiene con *Type: rigctl --help*.

En ambos sistemas el puente muestra, en un segundo:

```
rig answered through rigctl
rig -> page 14280000 Hz
rig -> page mode USB
rig -> page RX
```

Después abra la página del receptor en un navegador del mismo ordenador, abra **TCI-CAT** y active **CAT Sync**. El punto se pone verde y el puente muestra `page connected`. Gire el VFO y el receptor lo sigue; haga clic en la cascada y el equipo lo sigue (`page -> rig ... Hz`); transmita y la página se silencia. **Ctrl+C** detiene el puente, y con él `rigctl`.

Todo lo que va tras `--rigctl` es el programa `rigctl` y sus propias opciones — exactamente las que funcionaron en la comprobación. Es la regla para cualquier equipo: **si `rigctl … f` muestra la frecuencia, el puente funciona con las mismas opciones.**

#### Filtros Icom (FIL1, FIL2, FIL3)

Los equipos Icom como el IC-7300 no aceptan cualquier ancho de filtro: tienen tres filtros, **FIL1**, **FIL2** y **FIL3**, cada uno con un ancho fijado en el menú del equipo. Con un ancho, Hamlib seleccionaría uno de ellos y además sobrescribiría su ancho — y en el IC-7300 ese ancho puede ir a parar al filtro que estaba seleccionado antes, desordenando los ajustes. Por eso, en los equipos Icom el puente nunca envía un ancho: toma el filtro cuyo ancho de referencia está más cerca de la banda de paso de la página y solo lo **selecciona**, con la orden CI-V del propio equipo. Los anchos fijados en el equipo nunca cambian.

| Modo | FIL1 | FIL2 | FIL3 |
|---|---|---|---|
| USB, LSB (y sus modos de datos) | 2700 Hz | 2400 Hz | 1800 Hz |
| CW | 1200 Hz | 500 Hz | 250 Hz |
| AM | 9000 Hz | 6000 Hz | 3000 Hz |
| FM | 15000 Hz | 10000 Hz | 7000 Hz |

En el IC-7300 (`-m 3073`) es automático. Ajuste los filtros SSB del equipo en consonancia — FIL1 2,7 kHz, FIL2 2,4 kHz, FIL3 1,8 kHz (mantenga pulsado **FIL** en el equipo) — y elegir 2,7 / 2,4 / 1,8 kHz en **IF Filters** selecciona FIL1 / FIL2 / FIL3, mientras que pulsar **FIL** en el equipo pone la banda de paso de la página al ancho de ese filtro. El puente muestra, por ejemplo, `page -> rig filter 2398 Hz  LSB  → FIL2  sent`.

| Opción | Uso |
|---|---|
| `--filters 3000,2400,1800` | Otros anchos de referencia SSB, en el orden FIL1,FIL2,FIL3; también activa la selección de filtro para otro equipo Icom |
| `--civ A4` | La dirección CI-V del equipo en hexadecimal, cuando no es `94` (IC-705 `A4`, IC-9700 `A2`, IC-7610 `98`) |
| `--filters off` | Enviar anchos mediante Hamlib, como para otras marcas |

Ambas opciones van antes de `--rigctl`, p. ej. `node tci-rigctld.mjs --filters 3000,2400,1800 --civ A4 --rigctl rigctl -m 3085 -r /dev/ttyACM0 -s 19200`. Probado solo con un IC-7300. Las demás marcas — Yaesu, Kenwood, Elecraft y el resto — reciben el ancho de la página mediante Hamlib, que lo fija tan cerca como el equipo permite.

#### Otros equipos

Los mismos pasos sirven para cualquier equipo compatible con Hamlib; solo cambian las opciones.

1. **Prepare el equipo.** En su menú, anote la velocidad CAT (o CI-V) y active un ajuste como *CAT por USB* o *CI-V transceive* si lo tiene. En Windows, instale el controlador USB del fabricante.
2. **Busque el número de modelo de Hamlib** en la lista que muestra `rigctl -l`:
   - Linux: `rigctl -l | grep -i 991`
   - Windows: `C:\hamlib\bin\rigctl.exe -l | findstr /i 991`
3. **Busque el puerto.** Linux: `ls /dev/serial/by-id/`. Windows: Administrador de dispositivos. Algunos equipos crean **dos** puertos — los FT-991A, FTDX10 y FT-710 de Yaesu los llaman *Enhanced* y *Standard*; el CAT está en el **Enhanced**.
4. **Compruebe y arranque el puente** con `-m <modelo> -r <puerto> -s <velocidad>`, como en el ejemplo del IC-7300: primero `rigctl -m … -r … -s … f`, luego las mismas opciones tras `--rigctl`.

Algunos números de modelo, de Hamlib 4.5 — confírmelos con `rigctl -l`, ya que otra versión de Hamlib puede numerar un equipo de otra forma:

| Equipo | `-m` | Equipo | `-m` |
|---|---|---|---|
| Icom IC-7300 | 3073 | Yaesu FT-991 / FT-991A | 1035 |
| Icom IC-705 | 3085 | Yaesu FTDX10 | 1042 |
| Icom IC-7610 | 3078 | Yaesu FT-710 | 1049 |
| Icom IC-9700 | 3081 | Yaesu FT-891 | 1036 |
| Xiegu G90 | 3088 | Yaesu FT-817 | 1020 |
| Xiegu X6100 | 3087 | Kenwood TS-590SG | 2037 |
| Elecraft K3 / K3S | 2029 | Kenwood TS-890S | 2041 |
| Elecraft KX3 | 2045 | Kenwood TS-2000 | 2014 |
| Elecraft K4 | 2047 | QRP Labs QCX / QDX | 2052 |

Opciones adicionales, solo si hacen falta:

- **Un equipo Icom con la dirección CI-V cambiada:** añada `-c` con la dirección en *decimal* — `94h` es `-c 148`.
- **Un ajuste que Hamlib ofrece para ese equipo:** `rigctl -m <modelo> -L` los lista; fije uno con `-C nombre=valor`, p. ej. `-C post_write_delay=10` para una interfaz lenta.
- **Un equipo que transmite o se reinicia al abrir el puerto:** algunos cables CAT usan DTR o RTS para el PTT; añada `-C dtr_state=OFF -C rts_state=OFF`.

#### Ejemplo: Yaesu FT-991A

No probado con un FT-991A real — sigue los ajustes de Hamlib para ese equipo; la comprobación `rigctl … f` indica al instante si funciona.

En el equipo, ponga **CAT RATE** (menú 031) en `38400`. El número de modelo de Hamlib para el FT-991 y el FT-991A es `1035`.

El cable USB del FT-991A crea **dos** puertos serie. El CAT está en el **Enhanced**:

- **Linux:** `ls /dev/serial/by-id/` muestra dos líneas para el equipo; la que termina en `-if00-port0` es la Enhanced, normalmente `/dev/ttyUSB0`.
- **Windows:** el Administrador de dispositivos muestra *Silicon Labs Dual CP2105 USB to UART Bridge: Enhanced COM Port (COM5)* y un *Standard COM Port*; use el número del Enhanced.

**Linux:**
```bash
rigctl -m 1035 -r /dev/ttyUSB0 -s 38400 f
cd ~/PhantomSDR-Plus/tci-bridge
node tci-rigctld.mjs --rigctl rigctl -m 1035 -r /dev/ttyUSB0 -s 38400
```

**Windows:**
```bat
C:\hamlib\bin\rigctl.exe -m 1035 -r COM5 -s 38400 f
cd C:\tci-bridge
node tci-rigctld.mjs --rigctl C:\hamlib\bin\rigctl.exe -m 1035 -r COM5 -s 38400
```

Si la comprobación no muestra nada útil, la causa habitual es el puerto Standard en lugar del Enhanced, o un CAT RATE distinto de `-s`.

#### Ejemplo: Kenwood TS-590SG

No probado con un TS-590SG real — sigue los ajustes de Hamlib para ese equipo; la comprobación `rigctl … f` indica al instante si funciona.

En el menú del equipo, ponga la velocidad del puerto **USB** en `115200` (el número de menú está en el manual del TS-590SG). El número de modelo de Hamlib es `2037`; el TS-590S anterior es `2031`. En Windows, instale antes el controlador de puerto COM virtual de Kenwood para el puerto USB.

El cable USB crea **un** puerto serie:

- **Linux:** la línea del equipo en `ls /dev/serial/by-id/`, normalmente `/dev/ttyUSB0`.
- **Windows:** Administrador de dispositivos → Puertos (COM y LPT), por ejemplo `COM6`.

**Linux:**
```bash
rigctl -m 2037 -r /dev/ttyUSB0 -s 115200 f
cd ~/PhantomSDR-Plus/tci-bridge
node tci-rigctld.mjs --rigctl rigctl -m 2037 -r /dev/ttyUSB0 -s 115200
```

**Windows:**
```bat
C:\hamlib\bin\rigctl.exe -m 2037 -r COM6 -s 115200 f
cd C:\tci-bridge
node tci-rigctld.mjs --rigctl C:\hamlib\bin\rigctl.exe -m 2037 -r COM6 -s 115200
```

Si la comprobación falla, la causa habitual es una velocidad USB distinta de `-s`, o un cable en la toma RS-232 (COM) del equipo mientras `-r` indica el puerto USB.

#### Más ejemplos

Ninguno se ha probado con equipos reales. Cada fila da las opciones que van tras `rigctl` en la comprobación y tras `--rigctl rigctl` en el puente; ponga la misma velocidad en el menú del equipo. El puerto Linux es el habitual — confírmelo con `ls /dev/serial/by-id/`. En Windows, cambie el puerto por el número COM del Administrador de dispositivos y `rigctl` por `C:\hamlib\bin\rigctl.exe`.

| Equipo | Menú del equipo | Opciones (Linux) | Notas |
|---|---|---|---|
| Icom IC-705 (USB) | CI-V USB Baud Rate `19200` | `-m 3085 -r /dev/ttyACM0 -s 19200` | Aparecen dos puertos; el CI-V es el primero (`ttyACM0`) |
| Icom IC-7100 (USB) | CI-V USB Baud Rate `19200` | `-m 3070 -r /dev/ttyUSB0 -s 19200` | La velocidad máxima de Hamlib para este equipo es 19200 |
| Icom IC-7610 | CI-V USB Baud Rate `115200` | `-m 3078 -r /dev/ttyUSB0 -s 115200` | |
| Icom IC-9700 | CI-V USB Baud Rate `38400` | `-m 3081 -r /dev/ttyUSB0 -s 38400` | |
| Yaesu FTDX101D / FTDX101MP | CAT RATE `38400` | `-m 1040 -r /dev/ttyUSB0 -s 38400` | `-m 1044` para el FTDX101MP. Dos puertos; use el Enhanced |
| Yaesu FTDX10 | CAT RATE `38400` | `-m 1042 -r /dev/ttyUSB0 -s 38400` | Dos puertos; use el Enhanced, como en el FT-991A |
| Yaesu FT-710 | CAT RATE `38400` | `-m 1049 -r /dev/ttyUSB0 -s 38400` | Dos puertos; use el Enhanced, como en el FT-991A |
| Yaesu FT-891 | CAT RATE `38400` | `-m 1036 -r /dev/ttyUSB0 -s 38400` | Dos puertos; use el Enhanced, como en el FT-991A |
| Yaesu FT-450D | CAT RATE `38400` | `-m 1046 -r /dev/ttyUSB0 -s 38400` | Toma RS-232: use un adaptador USB-serie |
| Yaesu FT-817 / FT-818 | CAT RATE `38400` | `-m 1020 -r /dev/ttyUSB0 -s 38400` | `-m 1041` para el FT-818. Necesita un cable CAT en la toma ACC |
| Yaesu FT-857 / FT-897 | CAT RATE `38400` | `-m 1022 -r /dev/ttyUSB0 -s 38400` | `-m 1023` para el FT-897. Necesita un cable CAT |
| Kenwood TS-890S (USB) | Velocidad USB `115200` | `-m 2041 -r /dev/ttyUSB0 -s 115200` | |
| Kenwood TS-990S (USB) | Velocidad USB `115200` | `-m 2039 -r /dev/ttyUSB0 -s 115200` | |
| Kenwood TS-590SG / TS-590S (USB) | Velocidad USB `115200` | `-m 2037 -r /dev/ttyUSB0 -s 115200` | Ejemplo detallado arriba |
| Kenwood TS-480 | Velocidad del puerto COM `57600` | `-m 2028 -r /dev/ttyUSB0 -s 57600` | Toma RS-232: use un adaptador USB-serie |
| Kenwood TS-2000 | Velocidad del puerto COM `57600` | `-m 2014 -r /dev/ttyUSB0 -s 57600` | Toma RS-232; la velocidad máxima de Hamlib para este equipo es 57600 |
| Elecraft K4 (USB) | Velocidad RS232 `115200` | `-m 2047 -r /dev/ttyUSB0 -s 115200` | |
| Elecraft K3 / K3S | Velocidad RS232 `38400` | `-m 2029 -r /dev/ttyUSB0 -s 38400` | K3S: USB; K3: puerto serie o cable KUSB |
| Elecraft KX3 | Velocidad RS232 `38400` | `-m 2045 -r /dev/ttyUSB0 -s 38400` | Cable KXUSB |
| Elecraft KX2 | Velocidad RS232 `38400` | `-m 2044 -r /dev/ttyUSB0 -s 38400` | Cable KXUSB |
| Xiegu G90 | Velocidad CI-V `19200` | `-m 3088 -r /dev/ttyUSB0 -s 19200` | Hamlib usa la dirección CI-V por defecto del G90 |
| Xiegu X6100 | Velocidad CI-V `19200` | `-m 3087 -r /dev/ttyUSB0 -s 19200` | La velocidad máxima de Hamlib para este equipo es 19200 |
| Lab599 TX-500 | — | `-m 2050 -r /dev/ttyUSB0 -s 9600` | Hamlib usa solo 9600 |
| ELAD FDM-DUO | — | `-m 33001 -r /dev/ttyUSB0 -s 115200` | |
| QRP Labs QDX | — | `-m 2052 -r /dev/ttyACM0 -s 9600` | Un puerto serie USB; la velocidad no importa, pero hay que indicarla |

Orden completa de Linux para el IC-705, como ejemplo de cómo leer una fila:

```bash
rigctl -m 3085 -r /dev/ttyACM0 -s 19200 f
node tci-rigctld.mjs --rigctl rigctl -m 3085 -r /dev/ttyACM0 -s 19200
```

#### Equipos controlados por otro programa

Algunos equipos ya los controla un programa que puede hacer el trabajo — a veces sin ningún puente. Ninguna de estas vías se ha probado.

| Equipo y programa | Qué hacer |
|---|---|
| **SunSDR** con ExpertSDR2/3, **FlexRadio** con AetherSDR, **Apache Labs ANAN / Hermes** con Thetis | Sin puente. Active el **servidor TCI** del programa y use **TCI-CAT** directamente — los puertos 50001 y 40001 se encuentran solos |
| **FlexRadio** con SmartSDR (Windows) | Añada un puerto en **SmartSDR CAT**. Habla CAT de Kenwood, así que un puerto serie allí funciona como un TS-2000: `-m 2014 -r COM8 -s 57600`. Un puerto TCP funciona con el modelo FlexRadio de Hamlib: `-m 2036 -r 127.0.0.1:<puerto>` |
| **Cualquier equipo controlado por flrig** | Deje flrig en marcha y use el modelo flrig de Hamlib; el equipo sigue compartido con fldigi, WSJT-X y programas de registro: `-m 4 -r 127.0.0.1:12345` |
| **Un rigctld en marcha**, o un programa con servidor *Hamlib NET rigctl* | Arranque el puente sin `--rigctl`, con esa dirección: `node tci-rigctld.mjs 50001 127.0.0.1:4532` |

Como siempre, las opciones van tras `rigctl` en la comprobación y tras `--rigctl rigctl` en el puente. Una dirección de red como `127.0.0.1:12345` no necesita `-s`.

#### Compartir el equipo: la vía rigctld

Cuando WSJT-X o un programa de registro deba usar el equipo mientras funciona el puente, arranque el servidor de Hamlib `rigctld` con las mismas opciones, déjelo en marcha y conecte ambos programas a él:

```bash
rigctld -m 3073 -r /dev/ttyUSB0 -s 115200
node tci-rigctld.mjs
```

Sin `--rigctl` el puente busca `rigctld` en `127.0.0.1:4532` y muestra `rigctld connected`; `node tci-rigctld.mjs 50001 192.168.1.50:4532` usa un `rigctld` de otro ordenador. En WSJT-X elija el equipo *Hamlib NET rigctl* en la misma dirección. En Windows el servidor es `C:\hamlib\bin\rigctld.exe` con las mismas opciones; si Windows responde *Access is denied*, use `--rigctl` y cierre el otro programa mientras funciona el puente.

**Puertos.** El puente ofrece TCI en el puerto 50001; otro puerto va primero en la línea de órdenes, p. ej. `node tci-rigctld.mjs 40001 --rigctl …`. Si el puente y el navegador están en ordenadores distintos, ponga en **Host** la dirección del ordenador del puente.

### Solución de problemas de TCI-CAT

| Síntoma | Causa probable | Qué hacer |
|---|---|---|
| El punto sigue gris | El servidor TCI o el puente no está en marcha; **Host** incorrecto; se denegó el permiso de red local del navegador | Active TCI en ExpertSDR/Thetis/AetherSDR o arranque el puente; revise **Host**; permita el acceso a la red local en los ajustes del sitio |
| `rigctl … f` da un error o se queda esperando | Puerto o velocidad incorrectos; sin permiso `dialout` (Linux) o sin controlador USB (Windows); otro programa tiene el puerto | Ajuste `-s` al menú del equipo; revise el puerto (`ls /dev/serial/by-id/`, Administrador de dispositivos); cierre otros programas del equipo |
| El puente muestra *rigctl stopped … Type: rigctl --help* | La orden está incompleta — normalmente falta la velocidad tras `-s` | Escriba de nuevo la línea completa |
| El puente muestra *The value after -s is missing* | La línea de órdenes se cortó al pegarla | Escriba de nuevo el final de la línea, p. ej. `-s 115200` |
| El filtro no sigue en uno u otro sentido | **CAT Sync** está apagado, hay un decodificador en marcha en la página o (IC-7300) los anchos FIL del equipo difieren de 2700 / 2400 / 1800 Hz | Active CAT Sync; detenga el decodificador; ajuste los anchos FIL en el equipo, o indique `--filters` con los anchos del equipo |
| El puente muestra *rigctl stopped … rig_open: error* | `rigctl` no puede abrir el puerto | Como para `rigctl … f` arriba |
| El puente muestra *the rig is not answering* | El puerto se abre pero el equipo no responde: velocidad o modelo incorrectos, CAT desactivado en el menú, o dirección CI-V de Icom cambiada | Repita la comprobación `rigctl … f`; añada `-c` si la dirección CI-V está cambiada |
| El puente muestra *rigctld not reachable* | Arrancado sin `--rigctl`, y no hay `rigctld` en marcha | Añada `--rigctl …`, o arranque primero `rigctld` |
| `rigctld.exe` dice *Access is denied* (Windows) | Windows se niega a ejecutarlo | Use `--rigctl` — solo necesita `rigctl.exe` |
| Conectado, pero el receptor no se mueve | **CAT Sync** está apagado | Actívelo — el silencio al transmitir funciona sin él |
| El modo del equipo no sigue | Un modo sin equivalente en el receptor, o el controlador Hamlib informa de un nombre poco habitual | La frecuencia se sincroniza igualmente; ajuste el modo en la página |
| No hay silencio al transmitir | El equipo o su controlador Hamlib no informa del estado de transmisión | No hay nada que ajustar en la página |
| El dial salta de un lado a otro | Desktop PhantomSDR+ u otro programa también sincroniza el equipo | Use un solo controlador a la vez |

---

## Para operadores de receptores

Nada que configurar. El control del transceptor usa una pequeña interfaz JavaScript que ya lleva cada página de PhantomSDR-Plus; no requiere ajustes en el servidor, puertos abiertos ni permisos de administrador. Las funciones de filtro y silencio llegaron con la versión 4.1.0 — tras aplicarla, recompile el frontend (`./recompile.sh`, opción 2); no hace falta detener el receptor. Los receptores KiwiSDR, WebSDR y UberSDR tampoco necesitan nada: la aplicación usa los controles que sus páginas ya tienen.

El botón **TCI-CAT** llegó también con la 4.1.0, de nuevo solo con recompilar el frontend. No abre ningún puerto en el receptor: la conexión va del navegador de cada oyente a su propio ordenador. El puente Hamlib, `tci-bridge/tci-rigctld.mjs`, es para que los oyentes lo ejecuten en casa; el receptor no lo usa.

---

## Para desarrolladores: la interfaz de la página

Tanto Desktop PhantomSDR+ como la CATsync Tool usan estas funciones, que cada página de PhantomSDR-Plus pone en `window` al cargarse (las páginas de KiwiSDR, WebSDR y UberSDR se manejan con sus propios controles, distintos):

| Función | Devuelve / hace |
|---|---|
| `catsync_ready` | `true` en cuanto las funciones de abajo están instaladas |
| `catsync_getFrequency()` | Frecuencia sintonizada, Hz |
| `catsync_setFrequency(hz)` | Sintoniza `hz` |
| `catsync_getMode()` | `USB`, `LSB`, `CW`, `CW-L`, `AM`, `QUAM`, `FM`, `WBFM`, `RADEU`, `RADEL` |
| `catsync_setMode(mode)` | Fija el modo; restablece la banda de paso al valor por defecto del modo |
| `catsync_getBandwidth()` | Ancho total de la banda de paso, Hz |
| `catsync_setBandwidth(hz)` | Fija el ancho — crece hacia arriba en USB, hacia abajo en LSB y por igual en los demás. Llámela **después** de `catsync_setMode` |
| `catsync_getMute()` | `true` cuando está en silencio |
| `catsync_setMute(on)` | Silencia o quita el silencio, mediante el botón de silencio de la página |

Las cuatro últimas llegaron con la 4.1.0, así que compruébelas antes de llamarlas:

```js
if (window.catsync_ready) {
  window.catsync_setFrequency(7074000)
  window.catsync_setMode('USB')
  if (typeof window.catsync_setBandwidth === 'function') window.catsync_setBandwidth(2400)
}
```

Fijar la frecuencia resintoniza el audio, así que llame a un setter solo cuando el valor haya cambiado de verdad: llamar continuamente a un setter con el mismo valor se oye. Los antiguos puntos de entrada al estilo KiwiSDR/WebSDR (`setfreq`, `set_mode`, `freqset_complete`) siguen disponibles para las herramientas que los esperan.

---

## Solución de problemas

| Síntoma | Causa probable | Qué hacer |
|---|---|---|
| *Could not open ttyUSB0* (Linux) | No está en el grupo `dialout`, u otro programa tiene el puerto | `sudo usermod -aG dialout $USER`, cerrar y abrir sesión; cierre WSJT-X, programas de registro, utilidades del equipo |
| La lectura del receptor dice *not a receiver this app can drive* | Otro tipo de receptor web, o la página aún está cargando | Son compatibles PhantomSDR-Plus, KiwiSDR, PA3FWM WebSDR y UberSDR; dele unos segundos a una página lenta |
| *The rig did not answer* | Velocidad errónea, tipo de equipo erróneo, dirección CI-V errónea, equipo apagado | Ajuste la velocidad al menú del equipo; revise la dirección CI-V; pruebe Hamlib |
| *Hamlib is not installed* | No se encontró `rigctld` | Linux: `sudo apt install libhamlib-utils`. O indique su ruta en **rigctld program** |
| *rigctld stopped: ...* | Hamlib no pudo abrir el equipo — sigue su propio mensaje | Suele ser el puerto o la velocidad; el texto tras los dos puntos es el motivo según Hamlib |
| *flrig is not running at ...* | flrig cerrado, o su puerto XML-RPC es otro | Inicie flrig; revise el puerto en su configuración |
| Conectado, pero el receptor no se mueve | No hay ventana de estación abierta, o **Receiver window** fijado a una estación cerrada | Abra la estación o elija *The station window last in front* |
| El equipo transmite al conectar | DTR o RTS activan el equipo a través de su interfaz | Desmarque **DTR on** y **RTS on** |
| El filtro no sigue | Receptor anterior a la 4.1.0, o controlador integrado Kenwood/Yaesu | Frecuencia y modo siguen sincronizando; use Hamlib para el filtro en Kenwood/Yaesu |
| El silencio al transmitir no hace nada | Receptor sin la actualización, o el equipo no informa del estado de transmisión | Igual que arriba |
| *Lost the rig ... reconnecting* | Se desconectó el cable, se apagó el equipo o se detuvo rigctld | Nada — reintenta cada 3 segundos y continúa cuando vuelve |
| Los dos lados saltan sin parar | Dos programas controlan el equipo a la vez | Deje que solo un programa ajuste el equipo, o compártalo mediante flrig |

---

## Limitaciones conocidas

- Un equipo y una ventana de receptor a la vez.
- Receptores distintos de PhantomSDR-Plus, KiwiSDR, PA3FWM WebSDR y UberSDR — OpenWebRX, por ejemplo — no son compatibles.
- Los controladores integrados siguen los protocolos publicados por los fabricantes y se probaron con equipos simulados y con Hamlib real; para un equipo que se comporte de otra forma, la alternativa es Hamlib.
- No se sincronizan split, VFO B, RIT/XIT ni canales de memoria — solo la frecuencia del VFO activo.
- TCI-CAT en la página del receptor no sincroniza split, VFO B, RIT/XIT ni desplazamientos de transverter, y solo se ha probado con un IC-7300 a través del puente Hamlib.
- En Linux los paquetes usan el Hamlib de la distribución; no incluyen uno propio.
