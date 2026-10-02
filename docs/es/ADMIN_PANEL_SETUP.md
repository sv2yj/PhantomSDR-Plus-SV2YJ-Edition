# Panel de administración de PhantomSDR-Plus — Guía de configuración

> ⚠️ **Aviso de seguridad:** mantenga este panel de administración en su red doméstica o detrás de una VPN. No se recomienda exponer públicamente el puerto de administración sin un refuerzo adecuado de la autenticación.

---

## Descripción general

El panel de administración consta de dos servicios de Python:

| Servicio | Archivo | Función |
|---|---|---|
| Panel de administración | `admin_server.py` | Aplicación web Flask, se enlaza a `127.0.0.1` (solo interna) |
| Proxy inverso | `proxy.py` | Expone tanto el SDR como el panel de administración en un único puerto público |

Ambos servicios leen su configuración de `admin_config.json`, que escribe `setup_admin.sh`. **No edite las constantes de puerto directamente en los archivos de Python**: todos los puertos y la IP del host SDR se guardan en `admin_config.json`.

---

## Qué le ofrece el panel de administración

- **Panel de control** — estado del servidor en directo, CPU/RAM, procesos principales, salida reciente de los registros, terminal
- **Editor de configuración** — ver, editar y guardar cualquier archivo `.toml`, `.sh`, `.json`, `.h` o `.cpp` de su instalación
- **Visor de registros** — seguir cualquier archivo de registro en tiempo real (servidor SDR, panel de administración, RADE, fallos, autorun, proxy)
- **Marcadores** — ver y editar los marcadores de frecuencia
- **Historial del chat** — ver el registro del chat del WebSDR, borrarlo por completo o eliminar mensajes concretos sin reiniciar el servidor
- **Mensaje en la cascada** — difundir un cartel persistente a todos los usuarios conectados, visible en tiempo real en la cascada
- **Usuarios** — lista en directo de oyentes conectados con su frecuencia, modo, duración y un botón ⚡ Kick
- **Eliminación de mensajes del chat** — botón 🗑 Delete que quita de inmediato ese único mensaje del registro
- **Mensajes difundidos en la cascada** — permite enviar un cartel de texto persistente a la cascada de cada usuario conectado
- **Spot Reporting** — iniciar/detener el decodificador autorun de FT8/FT4/JS8/WSPR, elegir bandas y modos e informar de spots a PSK Reporter / wsprnet (desactivado por defecto), con dos contadores: paneles por decodificador para la ejecución actual y un total histórico junto a cada casilla de banda/modo
- **Gráficas** — frecuencia de CPU, carga de CPU, temperatura de CPU y usuarios conectados, representados en los últimos 15 minutos / 1 hora / 4 horas / 12 horas / 24 horas
- **Protección térmica (Thermal Guard)** — detiene el servidor si la CPU se sobrecalienta y lo reinicia cuando se enfría, con umbrales derivados de su propia CPU; funciona con cualquier método de arranque/parada y se entrega en modo de solo registro, por lo que no hace nada hasta que usted lo active
- **Ajustes** — cambiar la contraseña de administrador, el directorio base del SDR, el nombre del proceso y el puerto público

---

## Requisitos

- PhantomSDR-Plus ya instalado y en funcionamiento
- Python 3.8+

> [!NOTE]
> **Normalmente el instalador ya hace esto por usted.** `./install.sh` — igual que cada uno de los cuatro instaladores por distribución, los dos instaladores de RADE y el del servidor de estadísticas — configura el panel por defecto, instalando antes `pip` con el gestor de paquetes del sistema si falta. Esta página describe lo que ocurre en ese paso y qué hacer si lo omitió o quiere cambiar algo después.

Las bibliotecas de Python del panel (`flask`, `psutil`, `aiohttp`, `tomli-w`) las instala `setup_admin.sh`; si eso falla, imprime el comando exacto que debe ejecutar.

---

## Paso 1 — Archivos

Coloque estos cuatro archivos dentro de su directorio PhantomSDR-Plus:

```
admin_server.py
manage_admin.sh
setup_admin.sh
proxy.py
```

Haga ejecutables los scripts de shell:

```bash
chmod +x setup_admin.sh manage_admin.sh
```

---

## Paso 2 — Ejecutar el script de configuración

```bash
./setup_admin.sh
```

El script hará lo siguiente:

1. Comprobar que Python 3 está instalado
2. Verificar que existen `admin_server.py` y `manage_admin.sh`
3. Registrar `127.0.0.1` como `sdr_host` en la configuración (véase [El ajuste `sdr_host`](#el-ajuste-sdr_host))
4. Pedir tres números de puerto. Cada pregunta ofrece un valor predeterminado entre corchetes
que se acepta con un simple Enter, de modo que una instalación normal son tres pulsaciones:
   - **Puerto de spectrumserver** — el puerto en el que escucha su servidor SDR (predeterminado `8900`,
     que es justo el que trae cada `config-*.toml` del repositorio)
   - **Puerto interno del panel de administración** — donde `admin_server.py` se enlaza localmente (predeterminado `3000`)
   - **Puerto público del proxy** — el único puerto externo que combina SDR y administración (predeterminado `8902`)

Las respuestas no válidas se rechazan y se vuelven a pedir, pero solo cinco veces; después se usa el valor predeterminado. Una ejecución cuya entrada no es un terminal (por tubería, cron, desatendida) toma los valores predeterminados de inmediato en lugar de esperar una entrada que nunca llegará.
5. Instalar `flask`, `psutil`, `aiohttp` y `tomli-w` mediante pip
6. Conceder a `ss` la capacidad `cap_net_admin` (ruta alternativa de la función de expulsar usuarios, solo necesaria si el panel funciona sin el proxy)
7. Preguntar qué script arranca y cuál detiene el receptor — el panel maneja el servidor a través de ellos, y la protección térmica también
8. Preguntar hasta dónde puede llegar por sí sola la protección térmica de la CPU — `log`, `throttle`, `stop` o `stop+restart` — y ofrecer ejecutar `setup-cpufreq-perms.sh` para que la fase throttle funcione sin root (véase [THERMAL_GUARD.md](THERMAL_GUARD.md))
9. Escribir `admin_config.json` con todos los ajustes
10. Ofrecer la instalación de dos unidades systemd (panel + proxy) — arranque automático y reinicio tras un fallo. **Recomendado, y es la opción por defecto** (basta con pulsar Enter): la protección contra sobrecalentamiento solo funciona mientras el panel está en marcha, así que sin las unidades un reinicio deja la máquina desprotegida. El paso se omite automáticamente donde systemd no es PID 1 (contenedores, WSL1, OpenRC) o donde no tenga sudo.

Tras la configuración, abra el navegador a través del proxy:
```
http://YOUR_SERVER_IP:<proxy_port>/admin
```
Contraseña por defecto: **`admin`**

> ⚠️ **Cambie la contraseña de inmediato**: vaya a Settings en el primer inicio de sesión. Un asistente de primera ejecución le guiará para establecer el directorio del SDR, el nombre del proceso, el puerto público y una contraseña nueva.

---

## Paso 3 — Iniciar / detener / reiniciar

Hay dos formas de ejecutar el panel y el proxy. **Elija una y manténgala** — la advertencia al final de esta sección explica qué ocurre si las mezcla.

> **El Método B (systemd) se recomienda encarecidamente** siempre que haya systemd. La protección contra sobrecalentamiento se ejecuta dentro del panel, así que un panel que muere a las 03:00 o una máquina que se reinicia dejan la CPU desprotegida hasta que alguien la arranque a mano. `setup_admin.sh` ya ofrece las unidades por defecto. Use el Método A cuando no haya systemd — contenedores, WSL1, OpenRC/sysvinit — o cuando quiera supervisarlo usted deliberadamente.

### Método A — `manage_admin.sh` (sin root, sin instalar nada)

```bash
./manage_admin.sh start      # start admin panel and proxy
./manage_admin.sh stop       # stop both
./manage_admin.sh status     # show running status and PIDs
```

Deliberadamente **no hay `restart`**. Antes mataba el panel y arrancaba de inmediato su propia copia, lo que choca con systemd en cualquier máquina que use el Método B. Para reiniciar con el Método A, ejecute `stop` y luego `start` — véase [Reiniciar el panel](#reiniciar-el-panel) más abajo.

Un único script controla **ambos** procesos. Comprueba que `aiohttp` esté instalado antes de arrancar el proxy y muestra un error claro con el comando de solución si falta.

Nada se inicia solo: tras un reinicio, o si el panel se cae, lo arranca usted a mano. Es aceptable para un receptor que vigila, pero tenga en cuenta que la protección térmica de la CPU se ejecuta dentro del panel: mientras el panel esté caído, nada protege la máquina (véase [THERMAL_GUARD.md](THERMAL_GUARD.md)).

### Método B — unidades systemd (arranca al inicio, se reinicia tras un fallo)

El repositorio incluye dos unidades listas, `phantomsdr-admin.service` y `phantomsdr-proxy.service`. Ajuste `User=` y las rutas en ambas, y después:

```bash
sudo cp phantomsdr-admin.service phantomsdr-proxy.service /etc/systemd/system/
sudo systemctl daemon-reload
./manage_admin.sh stop        # free the ports first
sudo systemctl enable --now phantomsdr-admin
sudo systemctl enable --now phantomsdr-proxy
```

Los comandos del día a día pasan a ser:

```bash
sudo systemctl start   phantomsdr-admin
sudo systemctl stop    phantomsdr-admin
sudo systemctl restart phantomsdr-admin
systemctl status       phantomsdr-admin
sudo journalctl -u phantomsdr-admin -f
```

Los mismos cuatro con `phantomsdr-proxy`, o ambos a la vez: `sudo systemctl restart phantomsdr-admin phantomsdr-proxy`.

`admin.log` y `proxy.log` siguen funcionando igual que antes — las unidades escriben en esos mismos archivos.

Algo que conviene hacer una vez: instalar la regla tmpfiles de `tmpfiles/phantomsdr-logs.conf` (cambie antes sus rutas y el usuario). systemd crea esos dos registros como `root` antes de bajar a `User=`, y entonces el botón **Clear Logs** del panel falla con `Permission denied` — véase más abajo «Clear Logs dice Permission denied». `setup_admin.sh` instala la regla por usted.

La unidad del panel lleva `SupplementaryGroups=cpufreq`, que es lo que permite a la fase throttle de la protección térmica bajar el reloj de la CPU sin que el panel se ejecute como root. Cree ese grupo primero con `./setup-cpufreq-perms.sh`, o systemd se negará a arrancar la unidad; elimine la línea si no usa la fase throttle.

Para volver al Método A:

```bash
sudo systemctl disable --now phantomsdr-admin
sudo systemctl disable --now phantomsdr-proxy
```

> ⚠️ **No mezcle ambos.** Con las unidades activadas, `./manage_admin.sh stop` lo deshace systemd cinco segundos después, y `./manage_admin.sh start` le deja una segunda copia sin gestionar peleando con la de systemd por el mismo puerto. (`restart` se eliminó del script justo por esto; ahora imprime un error remitiéndole a `systemctl`.) `./manage_admin.sh status` solo lee, así que sigue siendo útil en ambos casos.

### Reiniciar el panel

El resto de este documento dice «reinicie el panel» en varios sitios. Significa el que corresponda a su método:

```bash
# Método B — unidades systemd (la configuración normal)
sudo systemctl restart phantomsdr-admin phantomsdr-proxy

# Método A — sin unidades instaladas
./manage_admin.sh stop && ./manage_admin.sh start
```

La unidad incluye `KillMode=process`, y esa línea es esencial. Si arranca el SDR desde el panel, el receptor es hijo de la unidad de administración y hereda su cgroup. Con el valor por omisión de systemd, `KillMode=control-group`, reiniciar el panel se llevaría por delante spectrumserver, su watchdog y el demonio de autorun, tras bloquearse los 90 segundos completos del tiempo de espera de parada. Con `KillMode=process` systemd solo señaliza al panel, de modo que `sudo systemctl restart phantomsdr-admin` deja al aire un receptor con oyentes.

**Actualizar una unidad instalada antes de la v4.1.0.** Los ficheros de unidad antiguos no tienen esa línea, y reiniciar el panel no la añade: `systemctl restart` vuelve a ejecutar el programa, no cambia su configuración. Edite la copia *instalada* — la del repositorio es solo una plantilla que systemd nunca lee:

```bash
sudo nano /etc/systemd/system/phantomsdr-admin.service
```

Añada `KillMode=process` en la sección `[Service]`, junto a `Restart=always`. Después haga que systemd relea el fichero y compruébelo:

```bash
sudo systemctl daemon-reload
systemctl show phantomsdr-admin -p KillMode
```

El segundo comando debe imprimir `KillMode=process`. Si sigue imprimiendo `control-group`, systemd está usando su copia en caché — `systemctl show phantomsdr-admin -p NeedDaemonReload` indica `yes` mientras quede una recarga pendiente. Los espacios iniciales se ignoran en los ficheros de unidad, así que la indentación no importa.

---

## Paso 4 — Abrir el puerto en el cortafuegos

Abra en el cortafuegos únicamente el **puerto público del proxy**. No es necesario exponer al exterior el puerto interno del panel de administración:

```bash
sudo ufw allow <proxy_port>
```

---

## Paso 5 — Función de expulsar usuarios

La página Users muestra a todos los oyentes conectados en ese momento. Cada fila indica la IP del usuario, la frecuencia sintonizada, el modo y cuánto tiempo lleva conectado. Para desconectar a un usuario, pulse el botón **⚡ Kick** de su fila: solo se corta esa conexión TCP. Los demás oyentes siguen conectados y no notan nada.

La expulsión es instantánea y quirúrgica: el servidor no se reinicia, no se interrumpe el audio de nadie más y el usuario expulsado puede volver a conectarse de inmediato (la función sirve para eliminar conexiones problemáticas o bloqueadas, no para vetar).

Internamente, la expulsión usa `ss -K dst <IP> dport <port>` para cerrar ese socket TCP concreto. Esto requiere una capacidad de Linux que el script de configuración concede automáticamente. Si se saltó la configuración o el botón informa de un error, aplíquela manualmente:

```bash
sudo setcap cap_net_admin+ep $(which ss)
# Verify:
getcap $(which ss)    # should show: cap_net_admin=ep
```

---

## Configuración — admin_config.json

Toda la configuración de ejecución reside en `admin_config.json`, dentro de su directorio PhantomSDR-Plus. `setup_admin.sh` escribe el archivo inicial; los cambios posteriores pueden hacerse desde la página Settings o editando el archivo directamente.

Campos clave escritos por `setup_admin.sh`:

| Clave | Descripción |
|---|---|
| `port` | Puerto interno del panel de administración (donde se enlaza `admin_server.py`) |
| `public_port` | Puerto de spectrumserver (usado por la página Users para consultar `/users`) |
| `proxy_port` | Puerto público en el que escucha el proxy |
| `sdr_host` | Host que usa el proxy para llegar a spectrumserver — `127.0.0.1` (véase más abajo) |
| `password_hash` | Hash SHA-256 de la contraseña de administrador |
| `sdr_base_dir` | Ruta de su instalación de PhantomSDR-Plus |
| `sdr_process_name` | Nombre del proceso a vigilar (por defecto: `spectrumserver`) |
| `start_script` / `stop_script` | Scripts que el panel ejecuta para arrancar y detener el servidor SDR — también son la vía por la que actúa la protección térmica |

Claves de la protección térmica (todas opcionales: el panel las escribe al guardar los ajustes de Thermal Guard, y las que falten usan estos valores por defecto):

| Clave | Por defecto | Descripción |
|---|---|---|
| `thermal_enabled` | `true` | Interruptor general de la protección |
| `thermal_mode` | `"log"` | `log` (solo registrar, nunca actuar) · `throttle` · `stop` · `stop+restart` |
| `thermal_warn` | `null` | Temperatura de aviso °C; `null` = derivar del límite crítico de su CPU |
| `thermal_throttle` | `null` | Temperatura a la que se baja el techo de frecuencia de la CPU; `null` = automático |
| `thermal_stop` | `null` | Temperatura a la que se detiene el servidor; `null` = automático |
| `thermal_resume` | `null` | Temperatura por debajo de la cual debe bajar la CPU para recuperarse; `null` = automático |
| `thermal_sustain_s` | `60` | Segundos que debe mantenerse la temperatura de parada antes de actuar |
| `thermal_warn_sustain_s` | `30` | Segundos que deben mantenerse las temperaturas de aviso/throttle |
| `thermal_resume_s` | `300` | Segundos por debajo de la temperatura de recuperación antes de liberar el bloqueo |
| `thermal_max_stops_hour` | `2` | Paradas térmicas por hora antes de desactivar el reinicio automático |
| `thermal_test_temp` | `null` | Temperatura ficticia para probar la protección; `null` = usar el sensor real |

Los cambios surten efecto en la siguiente muestra — en un par de segundos, sin reiniciar.

Para cambiar los puertos tras la configuración inicial, edite `admin_config.json` y reinicie:

```bash
sudo systemctl restart phantomsdr-admin phantomsdr-proxy   # B
./manage_admin.sh stop && ./manage_admin.sh start        # A
```

---

## El ajuste `sdr_host`

`proxy.py` se conecta a `spectrumserver` por bucle local — `sdr_host` es `127.0.0.1` en `admin_config.json`, escrito ahí por `setup_admin.sh`. No debería necesitar cambiarlo.

Póngale una dirección real solo si `spectrumserver` se ejecuta en una **máquina distinta** a la del proxy. Después [Reiniciar el panel](#reiniciar-el-panel).

> **Cambio:** las versiones anteriores exigían que `sdr_host` fuera la IP local de la máquina, porque `spectrumserver` cerraba los WebSocket que llegaban desde la dirección de bucle local. Ese filtro se ha eliminado, así que las conexiones locales funcionan con normalidad. Dos consecuencias: abrir `http://localhost:<port>` en la propia máquina del servidor ahora muestra la interfaz completa (antes cargaba la página pero se quedaba en blanco), y el proxy ya no se rompe cuando DHCP reasigna la IP de la máquina. Si está actualizando y su `admin_config.json` todavía contiene una IP local, cámbiela a `127.0.0.1` o vuelva a ejecutar `setup_admin.sh`.

---

## proxy.py — qué es y cuándo lo necesita

`proxy.py` coloca tanto el servidor SDR como el panel de administración en un **único puerto público**, enrutando según el prefijo de la ruta:

| Ruta | Se dirige a |
|---|---|
| `/admin*` | Panel de administración (`localhost:<port>`) |
| Todo lo demás | Spectrumserver (`<sdr_host>:<public_port>`) |

Sin el proxy tendría que exponer dos puertos por separado. Con él solo expone uno.

El proxy también elimina el límite de 4 MB en el tamaño de los mensajes WebSocket (importante para las tramas FFT grandes del RX-888 a 60 MSPS), reenvía las IP reales de los clientes mediante cabeceras `X-Forwarded-*` y mantiene vivas las conexiones de larga duración a través de NAT con un latido cada 30 segundos.

---

## Cambiar los puertos tras la configuración

Edite `admin_config.json` directamente:

```json
{
  "port":        3000,
  "public_port": 9001,
  "proxy_port":  9002,
  "sdr_host":    "127.0.0.1"
}
```

Después reinicie ambos servicios:

```bash
sudo systemctl restart phantomsdr-admin phantomsdr-proxy   # B
./manage_admin.sh stop && ./manage_admin.sh start        # A
```

Si además necesita que `admin_server.py` se enlace a otro puerto al arrancar (p. ej., en el servicio systemd), puede sobrescribirlo con la variable de entorno:

```bash
ADMIN_PORT=3000 python3 admin_server.py
```

Por defecto, `admin_server.py` solo se enlaza a `127.0.0.1`. Para ejecutarlo por separado sin el proxy (desarrollo/pruebas), enlácelo a todas las interfaces:

```bash
ADMIN_BIND=0.0.0.0 python3 admin_server.py
```

---

## Comandos manuales útiles

```bash
# Start admin panel manually (foreground)
python3 ~/PhantomSDR-Plus/admin_server.py

# Kill the admin panel
pkill -f admin_server.py

# Kill the proxy
pkill -f proxy.py

# Free a port that is stuck in use
sudo fuser -k 3000/tcp

# Check what is listening on a port
ss -tlnp | grep 3000
```

---

## Archivos de registro

| Archivo | Contenido |
|---|---|
| `admin.log` | Salida del panel de administración |
| `proxy.log` | Cartel de arranque del proxy + una línea de registro de acceso por cada petición reenviada |
| `logwebsdr.txt` | Registro del lanzador y el watchdog: arranque/parada, driver del receptor, registro en websdr.org |
| `spectrumserver.log` | La salida del propio proceso receptor: configuración de FFT y OpenCL, conexiones de cada cliente, errores. El mayor de estos ficheros; se rota, así que puede haber un `spectrumserver.log.1` a su lado |
| `rade.log` | Registro del sidecar RADE/FreeDV |
| `autorun.log` | Registro del demonio decodificador — spots, SNR, deriva |
| `crash.log` | Informes de fallos y eventos térmicos: trazas `[CRASH]` / `[TERMINATE]`, notas `[EXIT]` y líneas `[THERMAL]` de la protección. **Normalmente vacío**: cualquier cosa que contenga merece leerse |

Todos ellos pueden leerse desde las pestañas del **Log Viewer** del panel (LOGWEBSDR, SPECTRUMSERVER, ADMIN, RADE, CRASH, AUTORUN, PROXY). El visor muestra las últimas 150 líneas de la pestaña seleccionada y se actualiza cada 3 segundos con la actualización automática activada; solo lee el final del fichero, así que su tamaño da igual.

### Rotación de proxy.log y admin.log

`proxy.log` registra cada petición reenviada y `admin.log` cada petición que llega al propio panel. Ninguno de los dos se rota por defecto. Antes las consultas del panel dominaban ambos archivos —`/admin/api/status` se lanza cada ~3 segundos mientras haya una pestaña abierta—, pero ahora se filtran de los dos registros (véase más abajo), así que la rotación sirve para acotar un crecimiento lento, no una avalancha.

El repositorio incluye una configuración de logrotate en `logrotate/phantomsdr` (diaria, o antes si un registro supera los 10 MB; conserva 7 archivos comprimidos en `logproxy/`, para que no llenen la raíz del proyecto). **Es específica de cada instalación: ábrala y cambie las tres rutas de registro, la ruta `olddir` y el usuario `su` para que coincidan con su máquina antes de instalarla**, y después:

```bash
sudo cp logrotate/phantomsdr /etc/logrotate.d/phantomsdr
sudo logrotate -d /etc/logrotate.d/phantomsdr     # dry run, should list all three logs
```

`logrotate/phantomsdr` en el repositorio y `/etc/logrotate.d/phantomsdr` son dos copias **independientes**: `cp` no las enlaza. Editar el archivo del repositorio no cambia nada en un sistema en marcha hasta que vuelva a ejecutar el `sudo cp` anterior. Logrotate solo lee la copia de `/etc`.

La configuración usa `copytruncate`, algo imprescindible: `manage_admin.sh` arranca ambos procesos con `>> <log>` y ninguno reabre su salida estándar, de modo que una rotación basada en renombrado los dejaría escribiendo en el archivo rotado mientras el nuevo registro quedaría vacío para siempre.

Los archivos comprimidos van a `logproxy/` (creado automáticamente por `createolddir`) y se llaman `proxy.log.1.gz` … `proxy.log.7.gz`, el más reciente primero. Lea uno con `zcat logproxy/proxy.log.1.gz | less`, o búsquelos todos a la vez con `zgrep "pattern" logproxy/*.gz`.

El botón **Clear Logs** del panel vacía **todos** los archivos de la tabla anterior, incluidos `autorun.log` y `proxy.log` (`CLEAR_EXCLUDE` en `admin_server.py` está vacío). Tenga en cuenta lo que eso cuesta en `autorun.log`: su historial de decodificación es el único registro de qué se escuchó y cuándo, y no puede reconstruirse; de un vaciado solo sobrevive lo que logrotate ya haya rotado a `logproxy/`, así que se descarta todo lo decodificado desde la última rotación. Vaciarlo con el decodificador en marcha es seguro: el demonio lo mantiene abierto con `O_APPEND` y sigue escribiendo en el mismo inodo. El aviso indica qué se vació, y si algún archivo no se pudo escribir —por ejemplo un `proxy.log` que pertenece a otro usuario en una instalación con cuentas separadas— nombra ese archivo y el error en lugar de informar de un éxito, y deja en pantalla el panel de ese registro en vez de vaciarlo. Los archivos se truncan en el sitio, nunca se borran: tanto `manage_admin.sh` como las unidades de systemd los abren con `O_APPEND`, de modo que un archivo borrado seguiría llenando un inodo invisible hasta reiniciar el servicio.

Las consultas correctas se filtran de **ambos** registros de acceso, mediante el `QuietPollFilter` de `proxy.py` y el de `admin_server.py`. El panel llama a `/admin/api/status` cada 3 segundos y a `/admin/api/logs`, `/admin/api/autorun/status`, `/admin/api/users`, `/admin/api/graph-stats` y `/admin/api/chat` cada 5 segundos; sin filtrar serían el ~95 % de los dos archivos. Solo se descartan los `200` simples en esas rutas: cualquier otro estado, ruta o método se registra como antes, de modo que una consulta fallida sigue siendo visible y las acciones que cambian el estado (`kick`, `autorun/start`, …) usan rutas distintas y quedan siempre registradas. La única excepción deliberada es `/admin/api/logs/clear`, filtrada en ambos archivos: su propia línea de acceso se escribe *después* del vaciado, así que sin el filtro cada limpieza correcta dejaba una línea recién escrita en el registro que acababa de vaciar, y el botón parecía averiado.

Como `proxy.log` es un registro de acceso, contiene direcciones IP de visitantes y cadenas de user-agent; téngalo en cuenta antes de compartirlo al pedir ayuda.

### «Clear Logs» dice Permission denied

En una máquina donde las unidades systemd se instalaron sobre un árbol limpio, el botón puede responder:

```
✗ Could not clear admin.log ([Errno 13] Permission denied: /home/you/PhantomSDR-Plus/admin.log),
  proxy.log ([Errno 13] Permission denied: /home/you/PhantomSDR-Plus/proxy.log)
```

Siempre son esos dos archivos y nunca los otros cinco, porque son los únicos que crea el propio systemd. `StandardOutput=append:` lo abre PID 1 **antes** de bajar a `User=`, así que un registro que aún no existe se crea como `root:root 0644`. El panel se ejecuta como su usuario y no puede vaciarlo. Los otros cinco registros los crean los scripts de arranque, que ya se ejecutan como su usuario, por eso se limpian con normalidad. Donde los dos archivos son anteriores a las unidades —`manage_admin.sh` los creó con `>>`— ya tienen el propietario correcto y el botón funciona; por eso el problema solo aparece en una instalación nueva que empezó directamente con systemd.

Compruébelo con `ls -l admin.log proxy.log`: los que fallan dicen `root root`. Repárelos:

```bash
sudo chown "$(id -un):$(id -gn)" admin.log proxy.log
sudo chmod 664 admin.log proxy.log
```

No hace falta reiniciar: systemd sigue escribiendo por el descriptor de archivo que ya tiene abierto, y añadir datos no cambia la propiedad. Pulse **Clear Logs** de nuevo y ambos se vacían.

**No borre los archivos en su lugar.** Ambos están abiertos con `O_APPEND`; si elimina uno, systemd seguirá llenando un inodo invisible hasta que el servicio se reinicie, y el archivo que reaparece vuelve a ser de root.

Para que no vuelva a ocurrir, instale la regla tmpfiles que incluye el repositorio en `tmpfiles/phantomsdr-logs.conf`. Recrea ambos registros con el propietario correcto en cada arranque, antes de que se inicien las unidades, de modo que un registro eliminado —limpieza manual, reinstalación, directorio de instalación movido— nunca vuelva siendo de root. **Es específica de cada máquina: ábrala y cambie primero las dos rutas y el user:group para que coincidan con su equipo**, y luego:

```bash
sudo cp tmpfiles/phantomsdr-logs.conf /etc/tmpfiles.d/99-phantomsdr-logs.conf
sudo systemd-tmpfiles --create /etc/tmpfiles.d/99-phantomsdr-logs.conf
```

Igual que con `logrotate/phantomsdr`, el archivo del repositorio y la copia en `/etc` son independientes: editar el del repositorio no cambia nada hasta que vuelva a ejecutar el `cp`. En systemd 254 y posteriores la regla también repara la propiedad y el modo de un registro que ya existe, así que soluciona tanto el fallo actual como los futuros; en versiones anteriores es el `chown` de arriba lo que desbloquea el botón.

`setup_admin.sh` hace todo esto por usted cuando instala las unidades, así que una configuración hecha con el script nunca se topa con esto. Los pasos anteriores son para un par instalado a mano, o para una instalación anterior al paso de propiedad de los registros del script.

Logrotate no reintroduce el problema: la configuración incluida usa `copytruncate`, que conserva el mismo inodo y, por tanto, el mismo propietario.

---

## Resumen de acceso

| Configuración | SDR | Panel de administración |
|---|---|---|
| Sin proxy | `http://YOUR_IP:<public_port>` | `http://YOUR_IP:<port>/admin` |
| Con proxy | `http://YOUR_IP:<proxy_port>` | `http://YOUR_IP:<proxy_port>/admin` |

---

## Eliminación de mensajes del chat

La página Chat History enumera todos los mensajes del registro de chat actual. Cada entrada tiene un botón **🗑 Delete** que quita de inmediato ese único mensaje del registro, sin reiniciar el servidor.

Cómo funciona:

- El panel de administración reescribe el archivo de registro del chat sobre la marcha, eliminando solo la línea del mensaje seleccionado.
- El cambio surte efecto para cualquier usuario que recargue el chat; el historial ya cargado en pestañas abiertas no se actualiza retroactivamente.
- Vaciar todo el registro (botón **Clear All**) trunca el archivo, lo que también surte efecto sin reiniciar.

El botón de eliminar se muestra de forma coherente en las cinco variantes de la aplicación Svelte. Si una eliminación no parece surtir efecto, confirme que el panel de administración tiene permiso de escritura sobre el archivo de registro del chat:

```bash
ls -l ~/PhantomSDR-Plus/chat.jsonl   # path depends on your config
```

---

## Mensajes difundidos en la cascada

El panel **Waterfall Message** permite enviar un cartel de texto persistente a la cascada de cada usuario conectado sin tocar el proceso del servidor.

### Enviar un mensaje

1. Abra el panel de administración y vaya a **Waterfall Message**.
2. Escriba el texto del mensaje y elija un color (hexadecimal, p. ej., `#ffdd00`).
3. Pulse **Send**: el mensaje aparece de inmediato en todas las vistas de cascada activas.

### Borrar el mensaje

Pulse **Clear** para quitar el cartel de todas las cascadas. El estado del mensaje se mantiene en memoria en el panel de administración; se borra automáticamente si el proceso del panel se reinicia.

### Cómo funciona

El panel de administración expone dos puntos finales internos que el proxy reenvía:

| Punto final | Método | Finalidad |
|---|---|---|
| `/admin/api/waterfall-message` | `POST` | Fijar o borrar el texto y el color del cartel actual |
| `/admin/api/waterfall-message` | `GET` | Devolver el estado actual del mensaje en JSON |

El frontend consulta el estado del mensaje y lo dibuja superpuesto sobre el lienzo de la cascada. En el cliente no hace falta ni reconectar el WebSocket ni recargar la página.

### Usos habituales

- Anunciar un mantenimiento programado: `"Server restart in 10 minutes"`
- Señalar las condiciones de banda: `"Solar flux 180 — 10m wide open"`
- Mensaje de bienvenida: `"Welcome to SV1BTL WebSDR — Athens, KM17"`

---

## Gráficas del sistema

La página **Gráficas** representa cuatro magnitudes sobre un eje de tiempo común:

- **Frecuencia de CPU** — frecuencia media de todos los núcleos, en GHz
- **Carga de CPU** — utilización total, en porcentaje
- **Temperatura de CPU** — en °C, con guías discontinuas a 70 °C (caliente) y 80 °C (crítica)
- **Usuarios conectados** — oyentes conectados al WebSDR en ese momento

Elija el intervalo con **15 MIN / 1 HOUR / 4 HOURS / 12 HOURS / 24 HOURS**. Al pasar el ratón por la gráfica aparece una cruz con los cuatro valores de ese instante. Las cuatro tarjetas superiores muestran siempre la muestra más reciente.

### Cómo se muestrea

Un hilo en segundo plano de `admin_server.py` toma una muestra cada **2 segundos**. Las muestras se guardan en dos niveles: la última **hora** a resolución completa de 2 segundos (1800 puntos) y **24 horas** de promedios de 30 segundos (2880 puntos) para los intervalos largos. La página elige el nivel que cubre el intervalo elegido e indica `30s averages` en la cabecera cuando está mostrando el nivel promediado.

Guardar un día entero a 2 segundos serían ~43000 puntos: decenas de MB de memoria, una primera descarga de varios megabytes y unos 40 puntos por píxel de lienzo, que ninguna pantalla puede representar. Promediar a 30 segundos mantiene un día en 2880 puntos.

El muestreo arranca junto con el panel de administración, no al abrir la página por primera vez, de modo que la página se abre sobre un historial que ya existe.

El búfer está **solo en memoria**: no se escribe nada en disco y el historial se pierde al reiniciar el panel. Es deliberado: mantiene la función fuera de la rotación de registros y del disco.

2 segundos ofrecen una vista casi en vivo y es un intervalo lo bastante corto para no falsear la frecuencia de CPU, que en un procesador moderno salta entre el reloj de reposo y el turbo de una muestra a la siguiente. Una muestra cuesta alrededor de un milisegundo, así que el muestreo es insignificante frente al servidor SDR. La página consulta al ritmo de cada nivel: cada 2 segundos en los intervalos en vivo y cada 30 segundos en los promediados, porque preguntar más a menudo de lo que se generan puntos solo devuelve respuestas vacías.

Para cambiar la cadencia o la retención, edite estas constantes al principio del bloque del muestreador en `admin_server.py` y reinicie:

```python
GRAPH_INTERVAL_S   = 2          # segundos entre muestras finas
GRAPH_FINE_S       = 3600       # alcance del nivel fino (1 h)
GRAPH_COARSE_EVERY = 15         # muestras finas por punto agregado (15 x 2 s = 30 s)
GRAPH_COARSE_S     = 24 * 3600  # alcance del nivel agregado (24 h)
```

### De dónde salen los números

| Magnitud | Origen |
|---|---|
| Frecuencia de CPU | `psutil.cpu_freq()`, con respaldo en `/sys/devices/system/cpu/cpu*/cpufreq/`. Son los mismos datos del kernel que formatea `cpufreq-info`, por lo que **cpufrequtils no es necesario**. |
| Carga de CPU | `psutil.cpu_percent()` |
| Temperatura de CPU | `psutil.sensors_temperatures()`, con respaldo en `/sys/class/thermal` y después la orden `sensors` |
| Usuarios conectados | El propio endpoint `/users` de spectrumserver — la lista de sesiones autorizada. Contar sockets con `ss` no ve las IP reales de los clientes detrás de proxy.py. |

Si una magnitud no está disponible en su máquina, ese panel lo indica en lugar de dibujar una línea plana a cero. Una lectura fallida interrumpe la línea, de modo que un hueco nunca parezca un valor medido.

### Por qué cuatro paneles y no una sola gráfica

GHz, porcentaje, grados y un recuento de personas no comparten escala. Dibujarlos en una sola gráfica exige varios ejes y, los cruces que se producen son artefactos del escalado, no hechos sobre el servidor. Cuatro paneles apilados sobre un eje de tiempo mantienen la comparación honesta. Cada panel arranca en cero, así la altura de la curva sigue siendo proporcional al valor.

El color queda reservado para la temperatura, donde el ámbar y el rojo marcan los umbrales indicados. Los demás paneles comparten un color porque cada uno contiene una sola serie que su propio título ya nombra.

### Endpoint

`GET /admin/api/graph-stats?since=<epoch>` (requiere inicio de sesión) devuelve las muestras posteriores a `since`, de modo que la página consulta de forma incremental en lugar de descargar todo el búfer en cada ciclo.

---

## Thermal Guard

> 📖 **Manual completo: [THERMAL_GUARD.md](THERMAL_GUARD.md)** — los cuatro modos y qué debe hacer el sysop en cada uno, funcionamiento sin el panel, la fase throttle sin root, pruebas y resolución de problemas.

Detiene el servidor SDR cuando la CPU alcanza una temperatura peligrosa y vuelve a arrancarlo una vez fría. Forma parte del panel —no hay nada más que instalar— y aparece como tarjeta **THERMAL GUARD** en el Panel de control, con sus ajustes en **Ajustes**.

Se entrega **inerte**: el modo empieza en `log`, así que de fábrica solo registra lo que *habría* hecho. Nada toca su servidor hasta que usted cambie el modo.

### Funciona con cualquier método de arranque/parada

La protección nunca intenta averiguar qué supervisa su servidor. Actúa mediante los scripts que haya fijado como **Default start script** y **Default stop script** en Ajustes, y mientras la CPU esté demasiado caliente repite la parada en **cada comprobación** (cada 2 s). Cualquier cosa que devuelva el servidor a la vida —el watchdog dentro de `start-*.sh`, una unidad de systemd, una tarea cron, una sesión de `tmux`— queda deshecha en un par de segundos, hasta que la máquina se enfríe. Eso es el *bloqueo* (lockout).

Si no hay script de parada configurado, envía `SIGTERM` al proceso indicado en `sdr_process_name` y `SIGKILL` tras 10 segundos de gracia.

### Los umbrales salen de su propia CPU

En lugar de una cifra fija que sería errónea en la mayoría del hardware, la protección lee el límite crítico que el núcleo publica para su CPU y trabaja hacia atrás desde él:

| Su CPU declara | aviso | throttle | parada | recuperación |
|---|---|---|---|---|
| Intel, límite 100 °C | 88 | 92 | **95** | 75 |
| AMD Ryzen, límite 95 °C | 83 | 87 | **90** | 70 |
| Raspberry Pi, límite 85 °C | 73 | 77 | **80** | 60 |

Esto importa: unos 95 °C fijos son casi normales en un Intel, pero en un Ryzen —cuya Tctl se sitúa en 95 °C por diseño bajo boost— detendrían el servidor en una máquina sana, y en una Pi, que reduce a 80 °C, no se activarían nunca. Cualquier umbral puede fijarse a mano en Ajustes; deje el campo en blanco para *automático*.

Para ver cómo percibe la protección su máquina:

```bash
python3 thermal_guard.py --once
```

```
sensor     : hwmon:coretemp
temperature: 58.0 C
crit       : 100.0 C
mode       : log
thresholds : warn 88.0  throttle 92.0  stop 95.0  resume 75.0 (C)
cpufreq    : not writable — throttle stage disabled
```

### Las cuatro etapas

Detener el servidor es el último recurso, no la única herramienta:

1. **warn** — se registra, nada más.
2. **throttle** — baja un 20 % el techo de frecuencia de la CPU. Necesita un controlador cpufreq *y* permiso de escritura en `scaling_max_freq`, es decir, normalmente root; donde no lo hay (lo habitual en un panel sin privilegios y en la mayoría de VPS) la etapa **se desactiva sola** y la protección pasa de warn directamente a stop. `./setup-cpufreq-perms.sh` concede ese permiso de escritura a un grupo `cpufreq`, de modo que la etapa funciona sin root — véase [THERMAL_GUARD.md](THERMAL_GUARD.md#8-activar-la-fase-throttle-sin-root).
3. **stop** — ejecuta su script de parada y mantiene el servidor abajo (véase el bloqueo).
4. **resume** — cuando la CPU lleva `thermal_resume_s` (5 minutos por defecto) por debajo de la temperatura de recuperación, se restaura el techo de frecuencia y, en modo `stop+restart`, se ejecuta de nuevo su script de arranque.

Cada etapa debe **mantenerse** durante su tiempo — 30 s para warn y throttle, 60 s para stop —, de modo que un pico breve durante una compilación nunca la dispare.

Las activaciones repetidas están limitadas por `thermal_max_stops_hour` (2 por defecto). Alcanzado ese límite se desactiva el *reinicio automático* mientras la protección sigue funcionando, para que una máquina que se sobrecalienta no oscile entre funcionar y estar parada.

### Qué sensores se usan

Solo sensores reales del die de la CPU: `coretemp` (Intel), `k10temp` / `zenpower` (AMD), `cpu_thermal` / `soc_thermal` (ARM, Raspberry Pi). Se toma la lectura más alta del chip, no la media.

`acpitz` y las zonas térmicas sin etiquetar se **ignoran a propósito**: a menudo informan de la temperatura de la caja o de la placa, decenas de grados por debajo de la CPU real, así que una protección que se fiara de ellas nunca actuaría cuando hiciera falta. Si su máquina no tiene un sensor utilizable (habitual en un VPS o dentro de un contenedor), la tarjeta lo dice claramente (`no trusted CPU sensor`) y la protección queda inactiva en lugar de fingir que le protege.

### Qué escribe

Todo va a `crash.log`, es decir, a la pestaña **CRASH** del Visor de registros, un evento por línea:

```
[THERMAL] warn: 89.0C (warn=88.0 crit=100.0) sustained 31s
[THERMAL] throttle: 93.0C sustained 30s — cpufreq max lowered 20%
[THERMAL] STOPPED server: 96.0C sustained 62s (stop=95.0 crit=100.0) — Started stop-websdr.sh
[THERMAL] lockout: process reappeared at 94.0C — re-stopped [3 time(s) so far]
[THERMAL] recovered: 74.0C held below 75.0 — lockout cleared
[THERMAL] auto-restart: Started start-rx888mk2.sh
```

La línea de bloqueo se limita a una por minuto, para que un supervisor que se resista continuamente no inunde el registro.

### Pruébelo antes de confiar en él

Ponga **TEST TEMPERATURE** en Ajustes por encima de su umbral de parada. La protección lo trata como una lectura real, así que todo el recorrido —warn, throttle, stop, bloqueo, recuperación, reinicio— se ejecuta cuando usted quiera. Vacíe el campo para volver al sensor real.

> Si hace esta prueba con el modo en `stop`, el servidor se detiene de verdad y sus oyentes se desconectan. Hágala cuando no haya nadie, o deje el modo en `log`, donde la prueba muestra lo que *habría* pasado sin tocar nada.

### Forma recomendada de adoptarlo

1. Deje el modo en **`log`** durante una semana y siga con su rutina.
2. Lea la pestaña CRASH después de los momentos duros: una recompilación completa, una tarde calurosa. Si no aparece nada, su máquina nunca se acercó.
3. Si las temperaturas registradas tienen buen aspecto, ponga el modo en **`stop`** (o **`stop+restart`** para que vuelva solo).
4. Compruébelo una vez con el campo de temperatura de prueba y después déjelo estar.

### Salir de un bloqueo

**CLEAR LOCKOUT** en la tarjeta del Panel de control borra el bloqueo y el límite de repeticiones. No desarma la protección: si la CPU sigue demasiado caliente, la siguiente comprobación simplemente volverá a detener el servidor. Úselo después de haber arreglado la refrigeración.

### Endpoint

`GET /admin/api/thermal` (requiere sesión) devuelve todo el estado de la protección: sensor, umbrales, etapa, bloqueo y último evento. Un `POST` con `{"action":"reset"}` hace lo mismo que el botón CLEAR LOCKOUT.

### Sin el panel de administración

`thermal_guard.py` solo usa la biblioteca estándar y funciona por su cuenta, leyendo el mismo `admin_config.json`:

```bash
python3 thermal_guard.py --once              # mostrar sensor, límite crítico y umbrales
python3 thermal_guard.py                     # ejecutarlo como servicio (solo registro hasta armarlo)
python3 thermal_guard.py --mode stop+restart # armarlo sin escribir ningún archivo de configuración
python3 thermal_guard.py --config /path/to/other.json
python3 thermal_guard.py --help
```

`--mode` prevalece sobre `thermal_mode` del archivo de configuración, así que una máquina sin panel puede armarse desde su propia unidad de systemd, sin JSON alguno.

---

## Spot Reporting (autorun FT8/FT4/JS8/WSPR)

La pestaña **Spot Reporting** controla el demonio autorun (`autorun/index.js`), un proceso Node.js que decodifica FT8/FT4/JS8/WSPR en el servidor, directamente del receptor, y sube los spots a las redes de reporte:

- **FT8 / FT4 / JS8 → PSK Reporter** (IPFIX/UDP)
- **WSPR → wsprnet.org** (HTTP)

> **JS8 se reporta solo a velocidad Normal** — el ciclo de llamada de 15 s, donde están los heartbeats y las CQ. Los spots proceden de heartbeats, tramas compound y mensajes dirigidos; los destinos de grupo como `@ALLCALL` y los indicativos que el decodificador no pudo resolver (`<....>`) nunca se reportan. JS8 comparte la cola de PSK Reporter con FT8 y FT4 y se contabiliza por separado, igual que ellos.


**El reporte está DESACTIVADO por defecto.** No se sube nada hasta que active un destino y pulse **Start**. Decodificar y subir son procesos independientes: el demonio puede decodificar y registrar con el reporte desactivado, de modo que pueda comprobar la actividad antes de que nada se haga público.

> ⚠️ Los spots se suben a redes públicas con **su indicativo**. Active únicamente las bandas y modos que su receptor oiga de verdad, e indique el localizador correcto.

### Requisitos previos

El demonio autorun necesita Node.js 22+, los paquetes npm `ws` + `cbor-x` (resueltos mediante el enlace simbólico `autorun/node_modules` → `frontend/node_modules`) y `util-linux` (`taskset`). Los instaladores lo preparan todo automáticamente; véase la [sección Autorun Spot Reporter de INSTALLATION.md](INSTALLATION.md#autorun-spot-reporter-ft8ft4wspr). Si **Start** falla, la causa habitual es ese enlace simbólico o `taskset` (véase la resolución de problemas más abajo).

### Uso de la pestaña

1. **Identidad** — indicativo y localizador. Se rellenan previamente desde `frontend/site_information.json` (`siteSysop` / `siteGridSquare`, recortado a 6 caracteres); modifíquelos aquí si es necesario.
2. **Matriz banda × modo** — marque las combinaciones que desea decodificar. Las filas son bandas y las columnas FT8 / FT4 / JS8 / WSPR; las celdas no admitidas están desactivadas. WSPR cubre además las bandas de LF/MF (2200 m, 630 m) y un canal adicional de 80 m para Europa.
3. **Destinos** — active **PSK Reporter** y/o **wsprnet** (ambos desactivados por defecto).
4. **Max slots** — límite de seguridad sobre cuántas ranuras banda/modo pueden ejecutarse a la vez.
5. **Start / Stop** — lanza o detiene el demonio (fijado a los núcleos de CPU superiores con `taskset`, elegidos automáticamente según la máquina; véase *Requisitos de recursos y limitaciones* más abajo). **Save** / **Reload** guardan y releen la configuración; **Free All** vacía todas las ranuras.

La tarjeta de estado se actualiza cada 5 s y muestra el estado de ejecución, los contadores de decodificación/subida y la hora de la última subida. Aparece un distintivo **📶 REPORTING** en la cascada principal mientras el reporte está activo.

> **Ver «0 sent» durante los primeros minutos es normal.** PSK Reporter sube por lotes cada **5 minutos** y wsprnet cada **2 minutos**: los spots esperan en cola hasta el siguiente envío. La tarjeta de estado muestra el número pendiente y la cadencia.

### Cambiar bandas o modos mientras está en marcha

**Los cambios no surten efecto hasta que se reinicia el demonio.**
`autorun/index.js` lee `autorun.json` una sola vez, al arrancar. No hay vigilancia del archivo ni señal de recarga: las únicas señales que atiende son SIGINT y SIGTERM, que significan apagar. Un demonio en marcha sigue por tanto decodificando las ranuras con las que se lanzó, guarde usted lo que guarde después.

Para aplicar un cambio:

1. Marque / desmarque las bandas y modos
2. **SAVE CONFIG**
3. **STOP**
4. **START**

O simplemente **STOP** → cambiar las casillas → **START**, ya que START guarda la configuración antes de lanzar.

> ⚠️ **Pulsar START sin parar antes no aplica el cambio.** START guarda la configuración y después la petición de arranque responde `already running` y no se relanza nada. Verá un aviso de «guardado» junto a un error «already running» mientras el demonio continúa con las bandas **antiguas**: es fácil tomarlo por un éxito. Pare siempre primero.

Qué hace un reinicio con los contadores:

- **Los totales junto a cada casilla se conservan**: están en `autorun-totals.json`, que no se borra al apagar.
- **Las tarjetas por decodificador vuelven a cero**, son por ejecución.
- **No se pierde nada de la cola**: el apagado envía los spots pendientes.
- Una banda **recién activada** empieza en `0`; una banda ya **usada antes** retoma su total anterior.
- Una banda que **desmarque conserva su número** junto a la casilla ahora vacía; el historial no se borra.

La decodificación solo se detiene los pocos segundos entre STOP y START.

### Contadores de spots

Se muestran dos recuentos distintos, que responden a preguntas distintas.

**SPOTS UPLOADED PER DECODER** — una tarjeta por decodificador (FT8 / FT4 / JS8 / WSPR) con los spots subidos **desde el último arranque del demonio** y, debajo, el número de decodificaciones y cuántos siguen en cola. Stop/Start los pone a cero. Un decodificador cuyo destino está desactivado muestra sus decodificaciones y `reporting off` en lugar de un `0` a secas, porque ahí cero subidas es un ajuste, no un fallo.

**El número junto a cada casilla** en BANDS & MODES son los spots subidos **de todo el tiempo** para esa banda y modo. Se guardan en `autorun-totals.json` y sobreviven a los reinicios. **En ámbar y con un punto delante** (`·123`) significa que esa ranura ha decodificado pero aún no ha subido nada. Es normal entre envíos —PSK Reporter sube cada 5 minutos y wsprnet cada 2—, así que los contadores de FT8/FT4 quedan en ámbar los primeros minutos tras un arranque. También sigue en ámbar si el destino de ese decodificador está apagado. Un `0` a secas, sin punto, significa que esa ranura está activada pero aún no ha decodificado nada: WSPR se queda en cero varios minutos tras un arranque, porque funciona en un ciclo de 2 minutos mientras FT8 ya cuenta por centenares. Una ranura que el demonio nunca ha ejecutado no muestra nada. Al pasar el ratón se ven las subidas, las decodificaciones y la hora de la última subida.

FT8 y FT4 comparten una única cola de subida a PSK Reporter, así que el demonio imputa cada spot a su propio modo y banda en el momento del envío; el reparto no se estima después a partir de los totales.

**Poner a cero los contadores.** **FREE ALL SLOTS** desmarca todas las bandas y modos, apaga ambos destinos, detiene el demonio y **borra los contadores históricos**: después no se muestra ningún número junto a ninguna casilla. Es la única forma de reiniciarlos y no se puede deshacer. El botón detiene el demonio y espera a que termine antes de borrar `autorun-totals.json`, porque el demonio reescribe ese archivo al apagarse; borrarlo con el demonio en marcha simplemente devolvería los números.

### Requisitos de recursos y limitaciones

El demonio es deliberadamente ligero y funciona en hardware modesto (un i5 de cuatro núcleos basta), pero conviene conocer sus límites reales.

**La fijación de CPU de autorun tiene en cuenta la configuración y es automática.** El **demonio autorun** siempre lo lanza el panel de administración (`admin_server.py`), así que su fijación se establece en cada instalación sin configuración alguna: deriva un rango de núcleos para `taskset` a partir del número de CPU, reservando algunos de los núcleos superiores para la decodificación, o se ejecuta sin fijación con ≤ 4 núcleos.

**La fijación de spectrumserver depende de su propio método de arranque.** La forma de lanzar spectrumserver varía entre instalaciones (tipo de SDR, herramientas, scripts personales), así que este documento no presupone ningún lanzador concreto. El panel de administración no arranca ni fija spectrumserver: eso depende por completo del comando o servicio que use para ejecutarlo. Si quiere mantener spectrumserver fuera de los núcleos que usa el demonio autorun, fíjelo usted mismo con `taskset` en su propio comando de arranque (véase la sección de sustitución más abajo). Si no lo hace, simplemente se ejecuta sin fijación y el planificador del sistema lo equilibra: es correcto y seguro, solo pierde la separación deliberada de núcleos.

Como referencia, el demonio autorun reserva estos núcleos superiores (así que, si fija spectrumserver, manténgalo en los inferiores para evitar solapamientos):

| CPU lógicas | Usa el demonio autorun | Dejar para spectrumserver |
|---|---|---|
| ≤ 4 | *sin fijar* | *sin fijar* |
| 6 | `5` | `0-4` |
| 8 | `6-7` | `0-5` |
| 12 (p. ej., híbrido 8P+4E) | `8-11` | `0-7` |
| 16 | `12-15` | `0-11` |

En una máquina de **4 núcleos (o menos)** no hay nada que separar, así que el demonio autorun también se ejecuta *sin fijar* y comparte todos los núcleos: es correcto y seguro, pero la FFT del SDR y las ráfagas de decodificación compiten por los mismos núcleos.

**Limitaciones conocidas:**

1. **El verdadero cuello de botella es spectrumserver y el ancho de banda del SDR, no el demonio.** Un RX888 a 30 MHz necesita OpenCL/GPU; una CPU con pocos núcleos y sin una GPU capaz no puede sostener esa FFT. Combine el hardware modesto con un SDR más estrecho (RSP1A ≈ 10 MHz, RTL-SDR ≈ 2.4 MHz).
2. **WSPR es lo que más CPU consume.** Su decodificador de Fano es un port a JS (~30 s por banda, de un solo hilo). El grupo de 4 workers ejecuta 4 decodificaciones en paralelo; activar **más de ~4 bandas de WSPR** a la vez puede hacer que la cola supere la ranura de 120 s, sobre todo mientras el SDR compite por los núcleos. Las decodificaciones de FT8/FT4 son baratas en comparación.
3. **Escalado del número de ranuras.** La cifra de ~2-2,5 núcleos / 600-700 MB corresponde a las ~28 ranuras completas en una máquina de 8 núcleos. Con 4 núcleos compartidos, limítese a unas pocas bandas (orientación: ≤ 6 FT8/FT4 + ≤ 3 WSPR) y vigile la estadística `queued` del grupo.
4. **La fijación presupone una topología híbrida de Intel** (núcleos bajos = P-cores más rápidos). En AMD o en CPU con numeración SMT intercalada, el reparto automático sigue siendo válido (sin solapamientos ni fallos), pero «los núcleos bajos son más rápidos» puede no cumplirse literalmente; en un chip 4C/8T con hyperthreading, los núcleos superiores son hermanos SMT: quedan acotados, no del todo aislados. Cuando el rango automático no sea el idóneo, use la **sustitución manual** que se describe abajo.
5. **La cobertura de bandas la limita el receptor.** La configuración del RX888 (`sps=60000000` → Nyquist de 30 MHz) no llega a 6 m ni por encima; la tabla de bandas va de 160 m a 10 m. Otros SDR cubren lo que permita su ventana sintonizada.
6. **Cadencia de reporte.** PSK Reporter envía cada 5 min y wsprnet cada 2 min: ver «0 sent» los primeros minutos es normal, no un fallo.

### Sustitución manual de la fijación de CPU (avanzado)

El reparto automático de núcleos es adecuado para la mayoría de las máquinas, pero puede forzar una fijación concreta donde no lo sea (CCX/CCD de AMD, ARM big.LITTLE, SMT intercalado). Hay dos sustituciones independientes, cada una acepta una lista de núcleos al estilo `taskset -c` (`2-3`, `0,2,4`, `0-2,5`) o `none`/`off`/`unpinned` para desactivar la fijación. Un valor no válido se ignora y se aplica la derivación automática: una errata nunca podrá impedir un arranque.

**Demonio autorun** — variable de entorno `AUTORUN_CORES`, o un campo `"cores"` en `autorun.json` (el entorno tiene prioridad). El campo `"cores"` se conserva al pulsar **Save** en el panel, de modo que una edición manual permanece. Dos formas de establecerlo:

*Opción A — `autorun.json` (persistente, recomendada).* Añada una línea `"cores"` a la configuración en la raíz del repositorio y luego haga **Stop → Start** en la pestaña Spot Reporting:

```jsonc
// autorun.json
{ "identity": { "callsign": "SV1BTL", "grid": "KM17VX" },
  "reporting": { "pskreporter": true, "wsprnet": false },
  "slots": [ /* … */ ],
  "cores": "2-3" }          // or "none" to run unpinned
```

*Opción B — variable de entorno (puntual).* El demonio lo lanza el panel de administración, así que la variable debe estar en el entorno **del panel**: defínala y reinicie el panel (el entorno gana sobre el valor de `autorun.json`):

```bash
# Método A — la variable debe estar en el proceso que arranca:
./manage_admin.sh stop && AUTORUN_CORES=2-3 ./manage_admin.sh start

# Método B — systemd ignora una variable puesta en la línea de órdenes
# de systemctl, así que colóquela en la unidad:
sudo systemctl set-environment AUTORUN_CORES=2-3
sudo systemctl restart phantomsdr-admin
```

**spectrumserver** — fíjelo usted mismo anteponiendo `taskset -c <núcleos>` al comando con el que arranque el servidor. Funciona con cualquier método de arranque (lanzamiento directo, canalización de SDR, unidad de servicio, etc.):

```bash
# pin the server to cores 0-3, direct launch:
taskset -c 0-3 ./build/spectrumserver --config <your-config>.toml < <your-input>
# or in an SDR pipeline:
<your-sdr-source> | taskset -c 0-3 ./build/spectrumserver --config <your-config>.toml
```

> ⚠️ **Haga que sobreviva a los reinicios.** Un `taskset` en línea solo se aplica a ese arranque concreto. Si algo reinicia el servidor automáticamente (un watchdog, un servicio systemd, una entrada de cron/`@reboot`, …), añada el prefijo `taskset` dentro del script o la unidad que realmente lo arranca; de lo contrario, el reinicio pierde la fijación.

**Compruebe que la fijación surtió efecto** — muestre la afinidad de CPU real de los procesos en ejecución:

```bash
taskset -cp "$(pgrep -f 'autorun/index.js')"   # autorun daemon
taskset -cp "$(pgrep -x spectrumserver)"       # spectrumserver
```

**Valores admitidos (en ambas sustituciones):** una lista `taskset -c` (`2-3`, `0,2,4`, `0-2,5`), o `none`/`off`/`unpinned` para no fijar. Cualquier valor mal formado se ignora y se aplica la derivación automática, así que una errata nunca podrá bloquear el arranque.

> En una Raspberry Pi o cualquier equipo de ≤ 4 núcleos no suele hacer falta ninguna de las dos: la vía automática ya ejecuta ambos procesos sin fijar, que es lo correcto en una CPU pequeña y homogénea. La sustitución está pensada para máquinas mayores que no sean híbridos de Intel.

### Archivos y puntos finales

| Elemento | Finalidad |
|---|---|
| `autorun.json` | Configuración guardada (identidad, ranuras, destinos, máximo de ranuras, sustitución opcional `cores`). La escribe la pestaña; git la ignora. |
| `autorun-status.json` | Estado en directo que lee la tarjeta de estado (pid, contadores, última subida). Se escribe cada 15 s; se elimina al parar. |
| `frontend/dist/autorun-active.json` | Datos públicos del distintivo, servidos en `/autorun-active.json`. Vacío cuando el reporte está desactivado. |
| `autorun.log` | Salida estándar y de error del demonio. |
| `GET/POST /admin/api/autorun/config` | Leer / escribir `autorun.json` (valida indicativo, localizador, combinaciones banda/modo y límite de ranuras). |
| `GET /admin/api/autorun/status` | Estado de ejecución (`pgrep`) + `autorun-status.json`. |
| `POST /admin/api/autorun/start` / `stop` | Lanza (`taskset -c <auto> node autorun/index.js`) / envía `SIGTERM`. El rango de núcleos se deriva de la CPU (véase más arriba). |

> **Nota:** tras actualizar `admin_server.py` debe [Reiniciar el panel](#reiniciar-el-panel) para cargar las nuevas rutas de autorun o una matriz banda/modo actualizada. El demonio se ejecuta como un proceso aparte, así que sobrevive a los reinicios del panel de administración.

---

## Resolución de problemas

| Problema | Solución |
|---|---|
| El panel de administración no arranca | Consulte `admin.log`: suele faltar un paquete de Python |
| El proxy no arranca | Ejecute `python3 -c "import aiohttp"`; si falla: `pip3 install aiohttp --break-system-packages` |
| `proxy.log` está vacío | Compruebe primero que el proxy realmente se está ejecutando (`./manage_admin.sh status`). Si es así, tiene una versión antigua: el lanzador debe usar `python3 -u` (sin búfer; de lo contrario el cartel de arranque nunca sale del búfer de 8 KB) y el `main()` de `proxy.py` debe llamar a `logging.basicConfig()` (si no, el registrador de accesos de aiohttp no tiene manejador y se descarta cada línea de petición, porque `web.AppRunner` —a diferencia de `web.run_app`— no configura el registro). |
| El proxy arranca pero la cascada aparece en blanco | Compruebe `sdr_host` en `admin_config.json`: normalmente `127.0.0.1`. Si todavía contiene una IP local antigua de una versión anterior, cámbiela y [Reiniciar el panel](#reiniciar-el-panel) |
| El botón Kick dice «no connections» | Ejecute `getcap $(which ss)`; si no aparece `cap_net_admin`, ejecute `sudo setcap cap_net_admin+ep $(which ss)` |
| El estado siempre muestra OFFLINE | Vaya a Settings → SDR Process Name y ponga el nombre exacto que muestra `ps -eo comm,args \| grep -v grep` |
| La página Users no muestra datos | Verifique que el punto final funciona: `curl http://127.0.0.1:<public_port>/users` |
| Un navegador externo da NetworkError | Compruebe que el proxy está en marcha: `./manage_admin.sh status` |
| El proxy dejó de funcionar tras un cambio de red | Solo aplica si `sdr_host` todavía contiene una IP local: póngalo en `127.0.0.1` y [Reiniciar el panel](#reiniciar-el-panel) |
| El botón de borrar del chat no hace nada | Compruebe el permiso de escritura del archivo de registro del chat: `ls -l ~/PhantomSDR-Plus/chat.jsonl` |
| El mensaje de la cascada no aparece | Confirme que el proxy está en marcha (`./manage_admin.sh status`) y que el frontend es de una compilación reciente que incluye el renderizador de la superposición |
| El mensaje de la cascada se pierde tras reiniciar | Es lo previsto: el estado del mensaje solo está en memoria; vuelva a enviarlo tras reiniciar el panel |
| El «Start» de Spot Reporting falla / el demonio se cierra al instante | Consulte `autorun.log`. Suele faltar el enlace simbólico `autorun/node_modules` (`ln -sfn ../frontend/node_modules autorun/node_modules`) o `taskset` no está instalado (`sudo apt install -y util-linux`). |
| Spot Reporting: el demonio funciona pero `decodes` sigue en 0 y `autorun.log` muestra `504` / `tap closed 1006` | La toma de audio no llega a spectrumserver. El demonio detecta el puerto automáticamente a partir de la configuración del servidor **en ejecución**; la línea de registro `[autorun] tap backend: HOST:PORT` debe coincidir con su `[server] port`. Si es incorrecta (o el servidor no estaba en marcha al arrancar), fíjelo en `autorun.json`: `"server": { "host": "127.0.0.1", "port": 9002 }`, y después Stop→Start. |
| Spot Reporting muestra «0 sent» | Normal durante los primeros minutos: PSK Reporter envía cada 5 min y wsprnet cada 2 min. Confirme que hay un destino activado y que el demonio está en marcha. |
| Las bandas o modos nuevos no aparecen en la matriz | [Reiniciar el panel](#reiniciar-el-panel) — la matriz se carga al arrancar el panel. |
| `autorun.log` muestra `MODULE_TYPELESS_PACKAGE_JSON` / «Reparsing as ES module … performance overhead» | Aviso cosmético (la decodificación sigue funcionando). A `frontend/src/modules/package.json` le falta `"type": "module"`; añada esa línea cerca del principio y haga Stop→Start. No hace falta recompilar el frontend: el demonio importa el archivo fuente directamente. |
| El «Start» de Spot Reporting falla con `taskset: … Invalid argument` en un PC antiguo o modesto | No debería ocurrir con el lanzador que tiene en cuenta la configuración: el rango de núcleos se deriva del número de CPU y no se fija con ≤ 4 núcleos. Si sucede, su `admin_server.py` es anterior a ese cambio; actualícelo (`_autorun_taskset_prefix`) y [Reiniciar el panel](#reiniciar-el-panel). |
| El distintivo REPORTING no aparece en la cascada | El reporte debe estar activado con al menos una ranura; el distintivo lee `/autorun-active.json`. Recompile el frontend si `dist/index.html` es anterior al distintivo. |
