# Límites de conexión — Manual del sysop

**Proteger un receptor público frente a avalanchas de conexiones.**

Un WebSDR es un servicio público que entrega a quien lo pida un flujo continuo de audio y espectro. Ese es su propósito, y ahí está también el problema: para el servidor, nada distingue a un oyente normal de alguien que abre sesiones en bucle. El 16 de septiembre de 2026 este receptor sufrió exactamente eso — una sola dirección abrió 134 sesiones de escucha en un minuto y mantuvo 181 a la vez, mientras el público real de la estación rondaba la docena.

Este manual trata de las tres capas que lo detienen, de lo que cada una puede y no puede hacer, y de cómo saber si las suyas están bien ajustadas.

> **¿Con prisa?** El `config.toml` de ejemplo ya viene con valores sensatos, así que una instalación nueva está protegida sin que haga usted nada. Si su propio `.toml` es anterior y no tiene claves `[limits]` más allá de `audio`/`waterfall`/`events`, los límites por dirección están simplemente **desactivados** — copie el bloque del ejemplo para activarlos. El único comando que conviene conocer después es `grep Refused spectrumserver.log`, que le dice si se está rechazando a alguien.

---

## Contenido

1. [De qué se está defendiendo realmente](#1-de-qué-se-está-defendiendo-realmente)
2. [Las tres capas](#2-las-tres-capas)
3. [Límites por dirección — la política de oyentes](#3-límites-por-dirección)
4. [Conexiones inactivas — el ataque silencioso](#4-conexiones-inactivas)
5. [La protección en el núcleo — `setup-firewall.sh`](#5-la-protección-en-el-núcleo)
6. [Referencia de configuración](#6-referencia-de-configuración)
7. [Qué ve un oyente rechazado](#7-qué-ve-un-oyente-rechazado)
8. [Leer los registros y los contadores](#8-leer-los-registros-y-los-contadores)
9. [Elegir sus números](#9-elegir-sus-números)
10. [Trampas que conviene conocer](#10-trampas-que-conviene-conocer)
11. [Desactivarlo todo](#11-desactivarlo-todo)

---

## 1. De qué se está defendiendo realmente

Conviene ser preciso, porque la palabra «DDoS» cubre dos cosas muy distintas y solo una de ellas puede resolverse en su propia máquina.

**Avalancha desde una sola fuente.** Un equipo, o unos pocos, abriendo conexiones tan rápido como pueden. Es lo que ocurrió aquí, y tiene arreglo completo: las conexiones llegan de una dirección que se puede contar, y contar basta.

**Un ataque distribuido de verdad.** Miles de equipos, a menudo con direcciones de origen falsificadas, llenando su enlace. Cuando esos paquetes llegan a su tarjeta de red, el ancho de banda ya se ha gastado. **Nada de lo descrito en este manual ayuda**, ni puede ayudar nada que instale en el servidor — la única respuesta es un servicio por delante de usted, lo que es otra conversación que implica un dominio real y un proveedor como Cloudflare delante del receptor.

Todo lo que sigue aborda el primer caso. No es una limitación de la que haya que disculparse: el primer caso es lo que realmente les ocurre a las estaciones de aficionado.

---

## 2. Las tres capas

```
   internet
        │
        ▼
   ┌─────────────────────────────────────────────────────────┐
   │  1. nftables          setup-firewall.sh                 │
   │     tosco, barato, quita volumen antes de que nada      │
   │     lo lea                                              │
   └─────────────────────────────────────────────────────────┘
        │
        ▼
   ┌─────────────────────────────────────────────────────────┐
   │  2. spectrumserver    [limits] en config.toml           │
   │     exacto, por oyente, sabe quién es quién             │
   └─────────────────────────────────────────────────────────┘
        │
        ▼
   ┌─────────────────────────────────────────────────────────┐
   │  3. el navegador      dice por qué, y nunca reintenta    │
   └─────────────────────────────────────────────────────────┘
```

No son redundantes entre sí, y es deliberado. La capa del núcleo es rápida pero tonta: cuenta paquetes de una dirección y no sabe nada de oyentes. La capa del servidor es precisa, pero solo ve una conexión una vez aceptada y analizada, lo cual cuesta algo. La capa del navegador existe para que un oyente rechazado sepa qué ha pasado, en lugar de mirar una página que nunca carga.

---

## 3. Límites por dirección

### Qué cuenta como un oyente

Un oyente es **una conexión `/audio`** — o, donde `[kiwi_emulation]` está activado, **una conexión de sonido Kiwi**, que cuenta exactamente igual. Es la misma unidad que ya usan el contador de usuarios, `users.json` y las etiquetas sobre la cascada, así que un cliente Kiwi consume una plaza y aparece en la lista de usuarios igual que un navegador.

Esto importa porque una sola pestaña de navegador de escritorio abre **cuatro** conexiones a su servidor:

| Conexión | Función |
|---|---|
| `/audio` | el flujo de audio demodulado — **este es el oyente** |
| `/waterfall` | la representación del espectro |
| `/events` | lista de usuarios, frecuencias de los demás oyentes |
| `/chat` | el panel de chat |

Un teléfono en `/mobile` abre dos (`/audio` y `/chat`), porque no tiene cascada. Así que un límite que contara conexiones en bruto rechazaría a todo el mundo: tres pestañas son doce conexiones.

### Las tres claves

```toml
[limits]
per_ip=3            # oyentes simultáneos desde una dirección
per_ip_sockets=0    # conexiones simultáneas de cualquier tipo; 0 da per_ip * 4 + 4
per_ip_rate=40      # conexiones nuevas por minuto desde una dirección
per_ip_ban_s=600    # cuánto se rechaza a una dirección que rompe el ritmo
```

**`per_ip`** es la cifra principal y en la que pensará. Tres es un buen punto de partida.

**`per_ip_sockets`** existe porque `/audio` no es lo único que merece la pena inundar. `/waterfall` es el flujo más pesado que produce su servidor, y un límite que contara solo oyentes se esquivaría sin más abriendo conexiones de cascada. Dejado en `0` se convierte en `per_ip * 4 + 4`, que da cabida a `per_ip` pestañas de escritorio completas con algo de margen para conexiones que el núcleo aún no ha liberado tras recargar la página.

**`per_ip_rate`** es lo que de verdad termina con una avalancha. El tope por sí solo no lo hace: rechazar una conexión es barato pero no gratis, y un atacante puede seguir reconectando tan rápido como vuelven los rechazos, quemando su CPU en montar y desmontar. El límite de ritmo le da un bloqueo en lugar de una respuesta. Recuerde que una pestaña cuesta cuatro, así que 40/minuto son unas diez cargas de página por minuto desde una dirección.

> **Un orden deliberado.** El ritmo se cobra *antes* de comprobar el tope de simultáneas. Parece al revés hasta que se piensa en una dirección que ya está en su tope y reconecta en bucle: si el rechazo barato de «estás en el tope» le respondiera siempre, las infracciones de ritmo nunca se acumularían y el bloqueo que termina el bucle no llegaría nunca.

### Quién queda exento

**El loopback nunca se limita.** El tap de autorun para el reporte de spots, el panel de administración y un navegador abierto en la propia máquina del servidor llegan todos desde `127.0.0.1`, y dejar que consuman plazas significaría que su propia estación deja fuera a sus oyentes.

Esto cubre también `proxy.py`: las conexiones a través del proxy llegan a `spectrumserver` desde loopback, y la dirección real del cliente llega en la cabecera `X-Forwarded-For`, que es sobre la que se aplican los límites.

---

## 4. Conexiones inactivas

Hay un ataque que nada de lo anterior puede ver.

Abrir una conexión TCP. No enviar nada. Mantenerla.

Ese interlocutor nunca completa una petición, así que nunca alcanza el código donde viven los límites por dirección — no hay oyente, no hay objeto de cliente, no hay nada con nombre que contar. Mientras tanto, a él le cuesta unos pocos bytes y a usted un descriptor de fichero y una plaza mientras la mantenga.

```toml
[limits]
idle_per_ip=8       # conexiones inactivas (previas a la petición) por dirección
idle_total=512      # tope para todas las direcciones juntas
```

El límite está en **cuántas**, no en **cuánto tiempo**, y esa distinción es todo el diseño. **No hay plazo alguno para una conexión inactiva, y es deliberado.** Un plazo parece la respuesta obvia y es una trampa (vea [§10](#10-trampas-que-conviene-conocer)): hay interlocutores legítimos que se conectan y luego permanecen callados mucho tiempo antes de hablar. Lo que los separa de un ataque es la cantidad — un interlocutor legítimo mantiene una de esas conexiones, un atacante miles.

Una conexión inactiva vive por tanto hasta que hace una petición o muere, y su plaza se libera en ambos casos.

`idle_total` acota una avalancha repartida entre muchas direcciones de origen. Al alcanzar el tope, se rechazan las **nuevas** conexiones inactivas en vez de expulsar las existentes, de modo que una conexión legítima y de larga vida nunca es lo que se sacrifica para hacer sitio.

Ambos se aplican en el momento en que se acepta el socket, usando la dirección del interlocutor — todavía no hay petición, así que no hay `X-Forwarded-For` que consultar. No pasa nada: el loopback no se cuenta, lo que cubre todo lo que llega por `proxy.py`, y una avalancha directa trae su propia dirección.

---

## 5. La protección en el núcleo

`setup-firewall.sh` instala una tabla de nftables que quita volumen antes de que `spectrumserver` lea un solo byte. Es deliberadamente tosca, y sus números quedan muy por encima de los de `config.toml`, de modo que un oyente normal nunca puede quedar atrapado por ambos.

```bash
./setup-firewall.sh --show        # imprime las reglas, no cambia nada
sudo ./setup-firewall.sh --check  # valida contra su núcleo
sudo ./setup-firewall.sh --apply  # carga, con reversión automática a los 60 s
sudo ./setup-firewall.sh --persist # recarga al arrancar
sudo ./setup-firewall.sh --status  # los contadores de paquetes por regla
sudo ./setup-firewall.sh --remove  # deshacer todo
```

Cubre cuatro cosas: un tope de conexiones simultáneas por dirección de origen en sus puertos de proxy y receptor, un ritmo de conexiones nuevas por origen, un freno contra la fuerza bruta en SSH, y la compartición de archivos de Windows cerrada a todo lo que esté fuera de los rangos privados — `smbd` escucha en `0.0.0.0` en muchas máquinas, y que eso sea alcanzable depende de un router que el script no puede ver.

Los puertos se leen de `admin_config.json`, el mismo fichero que usa `proxy.py`, así que sigue su instalación.

### Por qué no puede dejarle fuera

Dos propiedades, ambas deliberadas:

- La política de la tabla es **accept**, y solo descarta patrones concretos y nombrados. Una regla que no casa deja pasar el paquete a lo que sea que tenga configurado. No puede dejar la máquina incomunicada.
- **Las conexiones establecidas se aceptan en la primerísima regla.** La sesión SSH en la que está escribiendo nunca se ve afectada por nada de lo que sigue.

Además, `--apply` arma una reversión automática: carga las reglas y luego espera confirmación en 60 segundos, o las quita. No diga nada, cierre el terminal, pierda la conexión — el conjunto de reglas desaparece solo.

Aproveche bien esa ventana. Compruebe **desde otro dispositivo, fuera de su propia red**, que el receptor sigue cargando y que se abre una sesión SSH *nueva*. Probar con la sesión que ya tiene no demuestra nada, porque la aceptó la regla uno.

---

## 6. Referencia de configuración

Todas las claves de abajo viven bajo `[limits]` en su fichero `.toml`. **Todas vienen desactivadas o con valores generosos**, así que una configuración que no las mencione se comporta exactamente como siempre.

| Clave | Por defecto | Significado |
|---|---|---|
| `per_ip` | `0` (desactivado) | Oyentes simultáneos por dirección |
| `per_ip_sockets` | `0` → `per_ip * 4 + 4` | Conexiones simultáneas de cualquier tipo por dirección |
| `per_ip_rate` | `0` (desactivado) | Conexiones nuevas por minuto y dirección |
| `per_ip_ban_s` | `600` | Segundos de rechazo tras romper el ritmo |
| `idle_per_ip` | `8` | Conexiones inactivas, previas a la petición, por dirección |
| `idle_total` | `512` | Conexiones inactivas en todas las direcciones |

Poner cualquier clave a `0` desactiva esa comprobación concreta.

### Las tres que no son límites

`[limits]` contiene además `audio`, `waterfall` y `events`, heredadas del PhantomSDR original, y **ninguna de las tres se aplica.** `waterfall` y `events` no las lee ningún código. `audio` se lee en un único sitio: se envía como `max_users` en el JSON de registro a los directorios de `[websdr] register_urls`, así que es la cifra que muestran sdr-list.xyz y los demás, y no hace absolutamente nada cuando `register_online=false`. Si quiere un tope de oyentes, `per_ip` de más arriba es el que actúa.

### Una más, bajo `[server]`

```toml
[server]
min_client_version=0
```

No es un límite sino un rechazo, y como comparte el mismo código de cierre, su sitio está aquí. Las páginas anuncian la versión desde la que se cargaron como `/audio?v=N`, y todo lo que esté por debajo de `min_client_version` se rechaza con *«esta página está desactualizada — recárguela»*.

Existe porque el servidor no puede alcanzar el JavaScript que ya se está ejecutando en el navegador de alguien. Una pestaña conserva el código que cargó hasta que alguien la recarga, así que un cambio en la página solo llega a los oyentes que por casualidad recargan — y una estación que acaba de cambiar el comportamiento de las sesiones puede necesitar que las páginas antiguas desaparezcan ya, no algún día.

Solo se comprueba `/audio`, porque es donde vive una sesión, y el loopback y las rutas Kiwi quedan exentos para que el tap de autorun y los clientes Kiwi no se vean afectados. `0` lo desactiva y es el valor por defecto. Dejarlo activo una vez agotadas las páginas antiguas no supone problema: un cliente de diversidad actual al que se rechaza en un `/audio` sin más vuelve a intentarlo con el marcador, de modo que solo se sigue rechazando a clientes de diversidad con una versión anterior de PhantomSDR-Plus y a herramientas de terceros que abren `/audio` sin `?v=`. Vuelva a ponerlo en `0` si otra estación le informa de que ya no puede usarle como pareja de diversidad.

---

## 7. Qué ve un oyente rechazado

### Nada se reconecta nunca

Empiece por aquí, porque gobierna todo lo demás: **una conexión `/audio` caída termina la sesión.** No hay reconexión automática, y es deliberado.

Reconectar es el instinto correcto para una aplicación de chat y el equivocado para un receptor. `/waterfall` y `/events` nunca volvían con ella, así que una sesión reintentada era una conexión de audio viva atornillada a una cascada congelada; y detener el servidor ya no lo vaciaba, porque todos los oyentes estaban de vuelta unos segundos después, llenando la lista de usuarios con sesiones en las que en realidad no había nadie. La página se queda en silencio y el oyente la vuelve a cargar — que es justo lo que hacía este receptor antes de que se añadiera reconexión alguna.

Para los límites de este manual eso elimina además una trampa: frente a un límite de ritmo, un reintento automático alargaría precisamente el bloqueo que intentaba sortear.

### Los dos códigos de cierre

| Código | Significado | Quién lo envía |
|---|---|---|
| **4003** | rechazado — por encima de un límite por dirección, o página obsoleta | `spectrumserver` |
| **4001** | expulsado por el sysop | `spectrumserver`, cuando el panel llama a `/~~kick` |

Ambos están en el rango privado 4000–4999, así que ninguno puede confundirse con un estado de protocolo, y ambos se tratan como definitivos en todas las páginas. El texto del motivo viaja en la trama de cierre y no como mensaje, porque la primera trama de `/audio` está reservada a los ajustes del receptor y cualquier cosa enviada antes rompería toda conexión normal.

### En la página

**Rechazado al cargar la página** — el oyente ni siquiera arranca, así que ambas páginas se explican. El escritorio muestra un panel: *«Este receptor ha rechazado la conexión»*, el motivo, y la nota de que todos los que comparten una conexión a internet cuentan como una dirección. `/mobile` muestra lo mismo en su zona de avisos.

**Rechazado o expulsado a mitad de sesión** — la página de escritorio simplemente se detiene, deliberadamente sin mensaje: el bucle de dibujo de la cascada se para y nada más. `/mobile` muestra una línea diciendo al oyente que recargue, salvo tras una expulsión, donde también guarda silencio.

Ese silencio tras una expulsión es intencionado. **Expulsar es el sysop terminando una sesión, no un castigo** — no se anuncia nada, y quien quiera volver carga la página otra vez y es un oyente corriente un segundo después. Lo único que aporta el código 4001 es que el navegador sepa que aquello no fue una conexión caída, de modo que la expulsión surta efecto en lugar de deshacerse sola.

De la expulsión se encarga `spectrumserver` mismo, no `proxy.py`: los oyentes se conectan directamente al puerto del receptor, así que el proxy no posee ninguna de sus conexiones y su expulsión no alcanza a nadie. El panel llama a `/~~kick?ip=&secs=`, accesible solo por loopback y comprobado contra el interlocutor TCP real, no contra `X-Forwarded-For`, que lo envía el cliente. `secs` vale cero por defecto — sin bloqueo — pero acepta una duración si quiere dejar la dirección fuera un rato, y eso reutiliza el mismo mecanismo de bloqueo que `per_ip_rate`, de modo que la reconexión se rechaza en la puerta.

## 8. Leer los registros y los contadores

### El servidor

```bash
grep Refused spectrumserver.log
```

```
Refused /audio from 203.0.113.5: too many simultaneous connections
Refused /audio from 198.51.100.7: too many connection attempts
```

Si ahí no hay nada, no se está rechazando a nadie. El registro está limitado a como mucho una línea por dirección cada cinco segundos — sin eso, un ataque se convertiría en escrituras a disco sin límite, que no es más que una forma más lenta de tumbar la estación.

### El núcleo

```bash
sudo ./setup-firewall.sh --status
```

Lea el **`counter packets N`** de cada regla; ese es el número realmente descartado. Todo a cero significa que no se ha bloqueado nada y que sus umbrales están cómodamente holgados.

No se alarme por las listas `elements = { ... }` de los conjuntos que hay sobre las reglas. Esos son sus oyentes normales siendo *seguidos* respecto a los límites — una entrada aparece en la primera conexión de una dirección y caduca un par de minutos después. Seguir no es bloquear.

---

## 9. Elegir sus números

No hace falta adivinar; sus propios registros se lo dirán. Esta es la medición que fijó aquí `per_ip=3`, sobre una semana de `logs/users_*.jsonl`:

| Sesiones simultáneas desde una dirección | Número de direcciones |
|---|---|
| 1 | 682 |
| 2 | 54 |
| 3 | 13 |
| más de 3 | **8** |

758 direcciones distintas en siete días, y un límite de tres habría afectado a ocho de ellas. La avalancha estaba en 181.

Para repetirlo en su propia estación, empareje los identificadores de sesión por dirección en `logs/users_*.jsonl` y tome el solapamiento máximo. Tenga en cuenta que el registro anota eventos `tune` y `disconnect` pero no tiene evento `connect`, así que el inicio de una sesión debe deducirse de su primer `tune`.

**Recuerde el NAT.** Un club, un colegio, una oficina o un operador móvil aparecen como una sola dirección, y todos los que están detrás comparten un cupo. Esto es inherente a cualquier límite basado en la dirección; la única mitigación es elegir un número con el que se sienta cómodo. Si alguna vez un oyente informa de que no puede conectar, esto es lo primero que hay que sospechar — mire `grep Refused` antes que nada.

---

## 10. Trampas que conviene conocer

### Nunca un plazo para una conexión inactiva

Ya no existe la clave `handshake_s`, y este es el motivo. Un plazo de 30 segundos para conexiones inactivas parece la defensa obvia frente a un slowloris. Se construyó, se activó y en un minuto produjo esto:

```
Idle deadline: closed 1 connection(s) idle past 30s: 192.87.173.88
```

`192.87.173.88` es `etgd-websdr.ewi.utwente.nl` — **el propio equipo de retorno de websdr.org**. Se conecta de vuelta a su servidor y luego permanece inactivo, bastante más de 30 segundos, antes de enviar su `GET /~~orgstatus`. El plazo lo cortaba cada vez y el registro dejó de funcionar. La opción se eliminó en lugar de dejarla disponible: un disparo en el pie que rompe su ficha en el directorio no merece las sesenta líneas que lo implementan.

**El mismo razonamiento vale para `open_handshake_timeout` de websocketpp, que sigue ahí.** El valor de diez minutos en `spectrumserver.cpp` parece absurdo y es estructural: es lo que permite que el retorno de websdr.org pueda estar inactivo. Hay una segunda razón — el manejador de `/~~orgstatus` responde desde un hilo que mantiene un `dup()` del socket, y websocketpp termina una conexión caducada con `shutdown()`, una llamada a nivel de socket que atraviesa el duplicado y rompería el retorno aunque el tiempo de inactividad no fuera un problema.

Si necesita acotar las conexiones silenciosas, acote su número, no su edad. Eso es lo que son `idle_per_ip` e `idle_total`.

### Un fichero de nftables debe ser idempotente

`nft -f` **añade** a una tabla que ya existe en lugar de reemplazarla. Un fichero de reglas sin un preámbulo `delete table` duplica por tanto toda la cadena en cada recarga — que es justo lo que hace una unidad de systemd ingenua en cada reinicio del servicio. `setup-firewall.sh` genera el preámbulo por usted; si escribe sus propias reglas, haga lo mismo.

```bash
sudo ./setup-firewall.sh --status | grep -c dport   # debe dar 8, no 16
```

---

## 11. Desactivarlo todo

Los límites del servidor: ponga las claves a `0`, o bórrelas de su `.toml`, y reinicie el receptor. No hay más estado; nada sobrevive a un reinicio.

El cortafuegos:

```bash
sudo ./setup-firewall.sh --remove
```

Eso borra la tabla, elimina el conjunto de reglas guardado y desactiva el servicio de arranque. Su máquina vuelve exactamente al estado en que estaba antes — lo que, en la mayoría de instalaciones, significa sin cortafuegos alguno. Merece la pena pensarlo antes de quitarlo.
