# Thermal Guard — Manual del sysop

**Protección contra sobrecalentamiento de la CPU para PhantomSDR-Plus.**

Un WebSDR es una de las pocas cosas que mantienen ocupados todos los núcleos, todo el día, para siempre. Si un ventilador se atasca, una bomba se para o la sala se calienta en agosto, nadie se lo dice: el servidor sigue decodificando hasta que la CPU se está cociendo. El thermal guard es la pieza que se da cuenta y desenchufa por usted.

Se entrega **inerte**: de fábrica solo escribe en un registro. Nada está protegido hasta que usted elija un modo. Este manual trata de tomar esa decisión y convivir con ella.

> **¿Con prisa?** Ejecute `python3 thermal_guard.py --once`, lea los umbrales que imprime y ponga `thermal_mode` en `stop+restart` desde el panel de administración. Ese es todo el trabajo. Todo lo demás es el *porqué*.

---

## Contenido

1. [Qué hace](#1-qué-hace)
2. [Inicio rápido](#2-inicio-rápido)
3. [Cómo decide](#3-cómo-decide)
4. [Los cuatro modos — qué hace cada uno y qué debe hacer usted](#4-los-cuatro-modos)
5. [Elegir el modo](#5-elegir-el-modo)
6. [Referencia de configuración](#6-referencia-de-configuración)
7. [Funcionamiento sin el panel de administración](#7-funcionamiento-sin-el-panel-de-administración)
8. [Activar la fase throttle sin root](#8-activar-la-fase-throttle-sin-root)
9. [Funcionamiento desatendido — cuando nadie mira](#9-funcionamiento-desatendido)
10. [Probarlo antes de confiar en él](#10-probarlo-antes-de-confiar-en-él)
11. [Leer el registro](#11-leer-el-registro)
12. [Lockout y límite de frecuencia](#12-lockout-y-límite-de-frecuencia)
13. [Resolución de problemas](#13-resolución-de-problemas)
14. [Desactivarlo o eliminarlo](#14-desactivarlo-o-eliminarlo)

---

## 1. Qué hace

Cada 2 segundos el guard lee la temperatura del die de su CPU y la compara con cuatro umbrales. Cuando la temperatura se mantiene por encima de uno de ellos el tiempo suficiente, sube un escalón:

```
   normal  ──►  warn  ──►  throttle  ──►  stop  ──►  (enfriar)  ──►  restart
              línea en    bajar la      ejecutar el     el servidor    ejecutar el
              el registro frecuencia    script de       sigue caído    script de
                                        parada                         arranque
```

Dos decisiones de diseño hacen que funcione en la máquina de *cualquier* sysop, y conviene entenderlas antes de confiar en él:

**Nunca pregunta cómo ejecuta usted su servidor.** systemd, un bucle watchdog, cron, tmux, un simple shell: el guard no lo sabe ni le importa. En su lugar, mientras la máquina está por encima de temperatura mantiene un **lockout**: repite la parada en *cada* ciclo. Si su watchdog reinicia el servidor, el guard lo vuelve a parar en dos segundos. Lo que sea que intente mantenerlo vivo pierde, hasta que la CPU se haya enfriado. Esta es la parte que lo hace universal, y está probada contra un watchdog real.

**Nunca fija una temperatura por código.** «Parar a 95 °C» es una mala regla: en un Intel con Tjmax 100 eso es casi carga normal, en un Ryzen queda *por debajo* de donde se sitúa Tctl con boost por diseño, y en una Raspberry Pi es inalcanzable porque el SoC se limita solo a 80. Así que el guard lee el punto crítico que publica su propio kernel (`tempN_crit`) y calcula hacia atrás. El mismo código, cifras razonables en todas partes.

---

## 2. Inicio rápido

**1. Vea cómo percibe el guard su máquina.** Siempre lo primero:

```
cd ~/PhantomSDR-Plus
python3 thermal_guard.py --once
```

```
sensor     : hwmon:coretemp
temperature: 65.0 C
crit       : 100.0 C
mode       : log
thresholds : warn 88.0  throttle 92.0  stop 95.0  resume 75.0 (C)
cpufreq    : not writable — throttle stage disabled
```

Si `sensor` dice `NONE`, deténgase aquí y lea la [Resolución de problemas](#13-resolución-de-problemas): el guard no puede proteger una máquina que no puede medir, y se lo dice en lugar de fingir.

**2. Déjelo unos días en modo `log`.** Ya se está ejecutando dentro del panel de administración. Déjelo observar una semana normal — tardes de verano, una compilación grande, un sábado de concurso movido — y compruebe si habría actuado alguna vez.

**3. Actívelo.** Panel de administración → **Settings** → **THERMAL GUARD** → **MODE** → `stop+restart` → 💾 **SAVE THERMAL SETTINGS**. Surte efecto en unos 2 segundos; no hace falta reiniciar.

---

## 3. Cómo decide

### El sensor

El guard solo confía en sensores reales del die de la CPU:

| Fuente | Hardware típico |
|---|---|
| `coretemp` | Intel |
| `k10temp`, `zenpower`, `zenpower3` | AMD |
| `cpu_thermal`, `soc_thermal` | Raspberry Pi, placas ARM |
| Zona térmica `x86_pkg_temp` | alternativa en x86 |

`acpitz` y las zonas térmicas sin etiqueta se excluyen **a propósito**. En un equipo de sobremesa típico `acpitz` marca unos 28 °C mientras el paquete de la CPU está a 59 °C: un guard que confiara en eso sencillamente nunca actuaría. Informar de «desactivado, sin sensor fiable» es más honesto que fingir protección.

`psutil` se utiliza si resulta estar instalado, pero nunca es necesario. El guard usa solo la biblioteca estándar.

### Los umbrales

Cada uno es un margen por debajo del punto crítico que publica la propia máquina:

| Umbral | Margen bajo crit | Qué significa |
|---|---|---|
| warn | −12 °C | Algo va mal, regístrelo |
| throttle | −8 °C | Intentar enfriar bajando la frecuencia |
| stop | −5 °C | Demasiado cerca del límite: parar el servidor |
| resume | −25 °C | Realmente frío otra vez, se puede volver |

Que en la práctica queda así:

| Su CPU informa | warn | throttle | **stop** | resume |
|---|---|---|---|---|
| Intel, crit 100 °C | 88 | 92 | **95** | 75 |
| AMD Ryzen, crit 95 °C | 83 | 87 | **90** | 70 |
| Raspberry Pi, crit 85 °C | 73 | 77 | **80** | 60 |

Si la máquina no publica ningún punto crítico, el guard recurre a un conjunto fijo conservador y lo indica. Puede sobrescribir cualquier umbral con un valor absoluto (véase la [Referencia de configuración](#6-referencia-de-configuración)), pero no debería hacer falta.

### Tiempos de sostenimiento — por qué un pico nunca actúa

No pasa nada con una sola lectura caliente. Un umbral debe mantenerse **de forma continua**:

- **warn** y **throttle**: 30 s (`thermal_warn_sustain_s`)
- **stop**: 60 s (`thermal_sustain_s`)
- **resume**: 300 s por debajo del umbral de resume antes de un rearranque (`thermal_resume_s`)

Un pico de compilación, una ráfaga de decodificación, un ventilador acelerando: todo demasiado breve para contar. Una sola lectura por debajo del umbral reinicia el reloj. Además, tras arrancar el guard exige 3 lecturas válidas consecutivas antes de actuar, y descarta cualquier valor fuera de 20–125 °C como fallo del sensor y no como temperatura.

---

## 4. Los cuatro modos

`thermal_mode` es el único interruptor que decide hasta dónde puede subir el guard por la escalera. Cada modo **incluye todo lo que hacen los anteriores**.

| Modo | Avisa | Limita | Para | Rearranca | ¿Puede caerse el servidor? |
|---|:--:|:--:|:--:|:--:|---|
| `log` | ✓ | — | — | — | No — no toca nada |
| `throttle` | ✓ | ✓ | — | — | No |
| `stop` | ✓ | ✓ | ✓ | — | Sí, sigue caído hasta que actúe |
| `stop+restart` | ✓ | ✓ | ✓ | ✓ | Sí, vuelve por sí solo |

---

### `log` — observar e informar (el valor de fábrica)

**Qué hace:** todo lo que hacen los demás modos, salvo actuar. Recorre toda la escalera y escribe en `crash.log` lo que *habría* hecho. Nunca ejecuta su script de parada, nunca toca la frecuencia de la CPU, nunca interrumpe a un oyente.

**Qué debe hacer usted:** nada — ya está funcionando. Al cabo de una semana, abra la pestaña **CRASH** del panel o ejecute:

```
grep THERMAL crash.log
```

- **¿No hay nada?** Su refrigeración está bien y puede activar el guard con confianza.
- **¿`STOP level reached ... NOT stopping`?** El guard habría apagado su servidor. Eso es un problema térmico real con el que ha estado funcionando: arregle la refrigeración *y* active el guard.

**Úselo cuando:** acaba de instalar el guard y aún no sabe cómo se comporta su máquina. Es un modo de rodaje, no un destino — un guard en `log` no protege nada.

---

### `throttle` — bajar la CPU, sin interrumpir nunca el servicio

**Qué hace:** en el umbral de throttle reduce un 20 % la frecuencia máxima de la CPU y la restaura cuando la temperatura vuelve por debajo de la línea de aviso. Su WebSDR sigue en pie todo el tiempo. Los oyentes pueden notar algo menos de rendimiento con carga alta; la mayoría no notará nada.

Si aun así la temperatura sigue subiendo y supera el umbral de parada, este modo **lo registra y no hace nada**: no parará el servidor.

**Qué debe hacer usted:**

1. Dar al guard permiso de escritura sobre el límite de frecuencia de la CPU — lo necesita, y de fábrica solo lo tiene root. Ejecute `./setup-cpufreq-perms.sh` una vez; véase la [sección 8](#8-activar-la-fase-throttle-sin-root).
2. Confirmar con `python3 thermal_guard.py --once` que imprime `cpufreq : writable, throttle stage available`. Si dice *not writable*, este modo no hace nada más allá de lo que hace `log`, y lo indicará cada vez en el registro.

**Úselo cuando:** persiga un problema de refrigeración al límite y quiera defender la máquina sin perder nunca oyentes. **Tenga en cuenta que no es protección completa**: si limitar la frecuencia no basta, no ocurre nada más. Buen primer paso, mala respuesta final.

---

### `stop` — apagar el servidor y dejarlo apagado

**Qué hace:** en el umbral de parada ejecuta su script de parada y mantiene el **lockout**: vuelve a parar el servidor cada 2 segundos mientras la máquina esté por encima de temperatura, de modo que nada lo reviva a sus espaldas. Cuando la CPU lleve 5 minutos por debajo del umbral de resume, el lockout se libera. **El servidor no vuelve solo.** Lo rearranca usted cuando esté convencido de que la causa está resuelta.

**Qué debe hacer usted:**

1. Asegurarse de que el guard sabe cómo parar su servidor. En el panel es el script de parada configurado (`./stop-websdr.sh` con los lanzadores incluidos). Si no hay ninguno, el guard recurre a `SIGTERM` sobre el nombre del proceso y luego a `SIGKILL` tras 10 segundos de gracia — funciona, pero un script de parada propio es más limpio.
2. Aceptar que **su WebSDR estará fuera de línea hasta que se dé cuenta**. Tenga alguna forma de enterarse: una monitorización de disponibilidad, la pestaña CRASH, o simplemente mirar a diario.

**Úselo cuando:** la máquina importa más que el servicio, suele estar usted cerca, o un episodio térmico es lo bastante serio como para querer inspeccionar el equipo antes de que siga. También es la elección correcta si no se fía de un rearranque automático en su hardware.

---

### `stop+restart` — apagar, enfriarse y volver solo

**Qué hace:** todo lo de `stop`, y además: una vez que la CPU lleva 5 minutos por debajo del umbral de resume, ejecuta su script de arranque y el WebSDR vuelve por sí mismo.

El vaivén se evita con `thermal_max_stops_hour` (2 por defecto). Tras dos paradas térmicas en una hora, el guard **desactiva el rearranque automático** y deja el servidor caído para que usted lo revise. Fíjese en el detalle importante: el límite desactiva el *rearranque*, nunca la *protección* — el lockout sigue parando el servidor mientras esté caliente, por muchas veces que ya haya saltado.

**Qué debe hacer usted:**

1. Asegurarse de que **ambos** scripts están configurados y funcionan por sí solos, tanto el de arranque como el de parada. Pruébelos a mano: `./stop-websdr.sh` y luego `./start-rx888mk2.sh`.
2. Nada más. Este es el modo de ponerlo y olvidarse.

**Úselo cuando:** el WebSDR sea público, desatendido o remoto, que es la mayoría de los casos. Es el modo recomendado para una instalación normal.

---

## 5. Elegir el modo

| Su situación | Modo |
|---|---|
| Acaba de instalar el guard, aún no conoce la máquina | `log` durante una semana |
| WebSDR público, desatendido, que se cuide solo | **`stop+restart`** |
| Emplazamiento remoto de difícil acceso | **`stop+restart`** |
| Quiere inspeccionar la máquina tras cada episodio térmico | `stop` |
| Hardware al que no confía un rearranque automático | `stop` |
| Refrigeración al límite, no puede perder oyentes | `throttle`, y después `stop+restart` |
| Máquina sin sensor de CPU fiable | ninguno funcionará — arregle antes el sensor |

Para la mayoría de los sysops la respuesta es `stop+restart`, y el resumen honesto de los demás es: `log` no protege nada y `throttle` protege un poco.

---

## 6. Referencia de configuración

Todas las claves están en `admin_config.json`, junto a `thermal_guard.py`, y todas ellas se pueden editar también en **Settings → THERMAL GUARD**. El guard **relee el archivo en cada ciclo**, así que los cambios surten efecto en ~2 segundos, sin reiniciar.

| Clave | Por defecto | Significado |
|---|---|---|
| `thermal_enabled` | `true` | Interruptor principal. `false` desactiva el guard por completo. |
| `thermal_mode` | `"log"` | `log` \| `throttle` \| `stop` \| `stop+restart` — véase la [sección 4](#4-los-cuatro-modos). |
| `thermal_warn` | `null` | Umbral de aviso absoluto en °C. `null` = derivar del punto crítico de la CPU. |
| `thermal_throttle` | `null` | Umbral de throttle absoluto. `null` = derivado. |
| `thermal_stop` | `null` | Umbral de parada absoluto. `null` = derivado. |
| `thermal_resume` | `null` | Umbral de resume absoluto. `null` = derivado. |
| `thermal_sustain_s` | `60` | Segundos que debe mantenerse el umbral de parada antes de parar. Mínimo 5. |
| `thermal_warn_sustain_s` | `30` | Segundos para las fases de aviso y throttle. Mínimo 5. |
| `thermal_resume_s` | `300` | Segundos por debajo del umbral de resume antes de liberar el lockout. Mínimo 30. |
| `thermal_max_stops_hour` | `2` | Paradas térmicas por hora tras las cuales se desactiva el rearranque automático. La protección continúa. |
| `thermal_test_temp` | `null` | Finge que la CPU está a esta temperatura. Solo para pruebas — véase la [sección 10](#10-probarlo-antes-de-confiar-en-él). |

El guard autónomo usa además `start_script`, `stop_script`, `sdr_process_name` y `sdr_base_dir` del mismo archivo.

**Sobrescribir un umbral.** Hágalo solo con motivo. Uno frecuente: su máquina se calienta legítimamente durante las compilaciones y prefiere que eso no cuente. Subir `thermal_stop` le da margen a costa de la distancia al punto crítico: nunca lo ponga por encima de su valor crit, o la CPU alcanzará antes su propio apagado de emergencia y el guard quedará como adorno.

---

## 7. Funcionamiento sin el panel de administración

Muchos sysops no instalan nunca el panel. El guard funciona perfectamente por su cuenta: el mismo archivo, el mismo comportamiento.

**Pruébelo primero en primer plano:**

```
cd ~/PhantomSDR-Plus
python3 thermal_guard.py --once            # ¿qué pasaría aquí?
python3 thermal_guard.py --mode log        # verlo en vivo, Ctrl-C para salir
```

`--mode` sobrescribe `thermal_mode` desde la línea de órdenes, así que nunca tiene que escribir JSON a mano:

```
python3 thermal_guard.py --mode stop+restart
python3 thermal_guard.py --config /etc/phantomsdr/thermal.json
```

**Después hágalo permanente** con la unidad de ejemplo incluida en el repositorio:

```
sudo cp thermal-guard.service /etc/systemd/system/
sudo nano /etc/systemd/system/thermal-guard.service   # ajuste User= y las rutas
sudo systemctl daemon-reload
sudo systemctl enable --now thermal-guard
systemctl status thermal-guard
```

Lea los comentarios del principio de `thermal-guard.service` antes de activarla. Dos cosas son lo más importante:

- **`User=` debe ser una cuenta capaz de ejecutar realmente sus scripts de arranque y parada.** Ejecutar el guard como root suele ser la respuesta equivocada: también ejecutaría esos scripts como root.
- Apúntelo a un `admin_config.json` que contenga `start_script` y `stop_script`, o pase `--mode` en la línea `ExecStart`. Basta con una configuración mínima:

```json
{
  "sdr_base_dir": "/home/suusuario/PhantomSDR-Plus",
  "sdr_process_name": "spectrumserver",
  "start_script": "start-rx888mk2.sh",
  "stop_script": "stop-websdr.sh",
  "thermal_mode": "stop+restart"
}
```

Todo lo que hace el guard sigue yendo a `crash.log` junto a ese archivo de configuración, además del journal de systemd (`journalctl -u thermal-guard`).

---

## 8. Activar la fase throttle sin root

Por defecto, `python3 thermal_guard.py --once` informa:

```
cpufreq    : not writable — throttle stage disabled
```

Es normal y no es un fallo. El kernel crea

```
/sys/devices/system/cpu/cpuN/cpufreq/scaling_max_freq
```

propiedad de `root:root`, con modo `0644`. Un panel de administración que corre como usuario normal no puede escribir ahí, así que el guard se salta la fase de throttle y lo dice en el registro en lugar de fallar en silencio.

**La solución equivocada** es ejecutar el guard como root. También ejecuta sus scripts de arranque y parada, y esos deben seguir sin privilegios.

**La solución correcta** es dar permiso de escritura sobre esos archivos concretos a un grupo dedicado. Un script lo hace:

```
cd ~/PhantomSDR-Plus
./setup-cpufreq-perms.sh
```

Pide su contraseña una vez — y solo una, durante la instalación — y a continuación:

1. crea un grupo de sistema `cpufreq` y le añade a él;
2. instala `/etc/tmpfiles.d/99-phantomsdr-cpufreq.conf` para que el grupo y el modo `0664` se vuelvan a aplicar **en cada arranque**: los permisos de sysfs no sobreviven a un reinicio por sí solos;
3. aplica el cambio de inmediato, para que pueda probar sin reiniciar.

Después, en este orden:

```
# 1. cierre la sesión y vuelva a entrar (o reinicie): un grupo nuevo solo
#    llega a sus procesos a través de un inicio de sesión nuevo
id | grep cpufreq

# 2. reinicie el panel; el guard comprueba el permiso una vez, al arrancar
sudo systemctl restart phantomsdr-admin
#    (así no hace falta cerrar sesión — systemd reconstruye la lista de
#     grupos en cada arranque. Solo si las unidades NO están instaladas:
#     ./manage_admin.sh stop && ./manage_admin.sh start — nunca ambos, pelean por el puerto 3000)

# 3. confirme
python3 thermal_guard.py --once
#    cpufreq    : writable, throttle stage available
```

Para deshacerlo por completo: `sudo ./setup-cpufreq-perms.sh --revoke`.

**Notas**

- La fase de throttle solo *actúa* si `thermal_mode` es `throttle` o superior. Conceder el permiso no cambia nada por sí solo.
- El guard baja un 20 % el límite vigente en ese momento y restaura exactamente ese valor. Si ya limita su CPU (por ejemplo con `MAX_SPEED` en `/etc/init.d/cpufrequtils`), lo que se restaura es su límite: el guard no le devolverá a escondidas una frecuencia más alta de la que pidió.
- Algunas máquinas no exponen ningún controlador cpufreq: muchos VPS y casi todos los contenedores. El script lo detecta y no cambia nada. Allí use `stop` o `stop+restart`, que no dependen de cpufreq.

---

## 9. Funcionamiento desatendido

La pregunta más frecuente sobre el guard: *¿qué pasa cuando nadie mira?* La respuesta corta es que se construyó precisamente para ese caso.

**No necesita un navegador abierto.** El guard es un hilo en segundo plano dentro de `admin_server.py`, cadenciado por el muestreador de gráficas cada 2 segundos. Funciona haya o no alguien conectado al panel, haya o no un navegador abierto, esté usted despierto o no. En modo autónomo es un servicio de systemd, aún más independiente. La tarjeta del panel es una *ventana* al guard, no el guard.

**Actúa sin preguntar.** No hay diálogo de confirmación ni notificación que esperar. En el umbral de parada detiene el servidor, y punto. De eso se trata exactamente.

**Pero solo si usted le dio permiso.** En modo `log` registrará fielmente cómo una máquina se cuece y no hará nada al respecto. Si lee esta sección porque *«no estoy para vigilarlo»*, el modo que quiere es `stop+restart`: es el único que protege la máquina y además devuelve el servicio sin usted.

**Solo ayuda mientras el panel siga vivo.** El guardián forma parte de `admin_server.py`: un panel que murió a las 02:00 se lleva la protección con él, y tras un reinicio la máquina queda desprotegida hasta que usted entre y lo arranque de nuevo. Si no hay nadie vigilando, deje que vigile systemd: el repositorio incluye `phantomsdr-admin.service` y `phantomsdr-proxy.service`, que arrancan al inicio y reinician el panel a los cinco segundos de un fallo. Véase [ADMIN_PANEL_SETUP.md](ADMIN_PANEL_SETUP.md). En un receptor desatendido esto se **recomienda encarecidamente**: armar `stop+restart` sin ello solo le protege hasta el siguiente reinicio.

**Cómo se entera después.** Por orden aproximado de utilidad:

| Dónde | Qué obtiene |
|---|---|
| `crash.log` / pestaña **CRASH** | Cada acción, con marca de tiempo. El registro permanente. |
| Tarjeta **THERMAL GUARD** del panel | Estado en vivo: temperatura, fase, lockout, paradas de la última hora. |
| Página **Graphs** (temperatura de CPU, 24 h) | La forma del episodio: cuán rápido subió, cuánto tardó en enfriarse. |
| `journalctl -u thermal-guard` | Solo en modo autónomo. |

Una rutina sensata para un emplazamiento desatendido: `stop+restart` activo y `grep THERMAL crash.log` cada vez que entre por cualquier motivo. Si está vacío, no hay nada que saber.

**Un ejemplo real.** Fallo de ventilador a las 03:00 en una máquina en `stop+restart`:

```
03:14  la temperatura pasa de 88 °C, se mantiene 30 s  →  aviso registrado
03:16  pasa de 92 °C, se mantiene 30 s                 →  throttle aplicado (si está permitido)
03:19  pasa de 95 °C, se mantiene 60 s                 →  STOP — script de parada, lockout activo
03:19  el watchdog rearranca el servidor               →  el guard lo vuelve a parar y lo registra
03:26  la CPU lleva 5 minutos por debajo de 75 °C      →  lockout liberado, script de arranque
03:41  se sobrecalienta y para por segunda vez         →  límite alcanzado, no más rearranques
                                                          el servidor queda caído, la protección sigue
```

Se despierta con un WebSDR caído, un `crash.log` que dice exactamente por qué y, sobre todo, una CPU que nunca se acercó a su punto crítico.

---

## 10. Probarlo antes de confiar en él

No espere a una ola de calor real para descubrir si su script de parada funciona.

**`thermal_test_temp`** hace que el guard crea que la CPU está a la temperatura que usted elija. Todo lo demás se comporta con total normalidad: los tiempos de sostenimiento, la escalera, el lockout, sus scripts reales.

1. Panel → **Settings** → **THERMAL GUARD** → **TEST TEMPERATURE**.
2. Introduzca un valor por encima de su umbral de parada (por ejemplo `97` en un Intel).
3. Guarde y observe la tarjeta del panel y la pestaña CRASH.
4. **Vacíe el campo al terminar.** Una temperatura de prueba olvidada significa que el guard ya no lee el sensor real.

En modo `log` esto le muestra toda la escalera sin arriesgar nada: la primera prueba segura, y la que conviene hacer antes de activar nada.

En modo `stop+restart` esto es una **prueba en vivo**: su servidor se parará de verdad y volverá de verdad unos cinco minutos después de vaciar el campo. Hágalo cuando no haya nadie escuchando. Merece la pena hacerlo una vez, porque es la única manera de saber que sus scripts de parada y arranque funcionan cuando los invoca algo que no es usted.

Equivalentes en modo autónomo:

```
python3 thermal_guard.py --once                 # solo umbrales, sin actuar
python3 thermal_guard.py --mode log             # ver la escalera en vivo
```

---

## 11. Leer el registro

Todo se añade a `crash.log`, junto al archivo de configuración, un evento por línea y con el prefijo `[THERMAL]`:

```
grep THERMAL crash.log
```

Las líneas son deliberadamente de una sola línea y aptas para grep. Lo que verá:

| Línea | Significado |
|---|---|
| `warn: 88.4C (warn=88.0 crit=100) sustained 30s` | Primer escalón. No se ha hecho nada. |
| `throttle: 92.1C sustained 30s — cpufreq max lowered 20%` | Frecuencia de CPU reducida. |
| `throttle level reached: ... (no cpufreq write access — stage skipped)` | Véase la [sección 8](#8-activar-la-fase-throttle-sin-root). |
| `STOP level reached: ... mode is 'log', NOT stopping` | Habría parado el servidor. Actívelo. |
| `STOPPED server: 95.2C sustained 60s (stop=95.0 crit=100) — ran stop-websdr.sh` | El caso real. |
| `lockout: process reappeared at 96.0C — re-stopped (...) [12 time(s) so far]` | Algo está rearrancando su servidor; el guard gana. Limitado a una línea por minuto. |
| `rate limit: 2 thermal stops within the hour — automatic restart is now DISABLED` | Queda caído para que investigue. La protección continúa. |
| `recovered: 54.0C held below 75.0 — lockout cleared` | Frío de nuevo. |
| `auto-restart: ran start-rx888mk2.sh` | De vuelta en línea. |
| `back to normal: 59.0C (warn=88.0)` | Bajó de la escalera sin llegar a parar. |

---

## 12. Lockout y límite de frecuencia

Estos dos comportamientos son los que más sorprenden, así que conviene decirlos claramente.

**El lockout** es lo que hace que el guard funcione precisamente contra *su* instalación. Cuando para el servidor no se limita a enviar una parada y confiar. Se marca como bloqueado y, en cada ciclo de 2 segundos mientras la temperatura siga por encima del umbral de resume, comprueba si el proceso ha vuelto — y si es así, lo vuelve a parar. Su watchdog, el `Restart=always` de systemd, una tarea de cron, un sysop impaciente: todos pierden esa discusión hasta que la CPU se enfría. Se libera solo cuando la temperatura se ha mantenido por debajo del umbral de resume durante `thermal_resume_s` (5 minutos por defecto).

**El botón CLEAR LOCKOUT** de la tarjeta del panel libera el lockout *y* el contador de paradas por hora, para cuando ha arreglado la refrigeración y no quiere esperar. **No** desarma el guard: si la máquina sigue caliente, la comprobación siguiente parará el servidor otra vez. Eso es intencionado.

**El límite de frecuencia** (`thermal_max_stops_hour`, 2 por defecto) evita que una máquina averiada esté subiendo y bajando toda la noche. Alcanzado el límite, el guard **desactiva el rearranque automático** y deja el servidor caído. Léalo con atención: desactiva el rearranque, no la protección. El lockout sigue parando el servidor mientras esté por encima de temperatura, por muchas veces que ya haya saltado. Un guard que se callara justo cuando la máquina está peor sería peor que no tener guard.

---

## 13. Resolución de problemas

**`sensor : NONE — no trusted CPU sensor on this machine`**
El guard no encontró ningún sensor de la lista permitida y se niega a adivinar. Pruebe `sensors` (de `lm-sensors`; `sudo apt install lm-sensors && sudo sensors-detect`). Dentro de una máquina virtual o un contenedor a menudo no hay realmente un sensor de die expuesto: el guard no puede proteger esa máquina y se declara desactivado en lugar de fingir.

**`cpufreq : not writable — throttle stage disabled`**
Es lo esperado si no ha ejecutado `./setup-cpufreq-perms.sh` — véase la [sección 8](#8-activar-la-fase-throttle-sin-root). Solo afecta a la fase de throttle; `stop` y `stop+restart` no se ven afectados.

**Ejecuté `setup-cpufreq-perms.sh` y sigue diciendo not writable**
Dos causas probables: no ha cerrado la sesión y vuelto a entrar desde entonces (un grupo nuevo solo llega a los procesos mediante un inicio de sesión nuevo; compruébelo con `id`), o el panel no se ha reiniciado desde entonces (el guard comprueba el permiso una vez, al arrancar). Haga ambas cosas, en ese orden.

**Los umbrales parecen incorrectos para mi CPU**
Compruebe lo que publica la máquina: `cat /sys/class/hwmon/hwmon*/temp*_crit`. Si su crit es inusual, o no existe, ponga valores absolutos en `thermal_stop` y compañía.

**Paró mi servidor y no creo que estuviera caliente**
Compruebe si `thermal_test_temp` sigue puesto de alguna prueba. Es, con mucho, la causa más común.

**Nunca actúa aunque la máquina se calienta**
Confirme que el modo no es `log`, que `thermal_enabled` es `true`, y compare la temperatura que ve con los umbrales de `--once`. Recuerde que el umbral debe mantenerse *de forma continua* durante el tiempo de sostenimiento.

**El servidor no para de rearrancar durante un episodio térmico**
Eso es el lockout funcionando, y las líneas `lockout:` son su parte de éxito: su supervisor sigue intentándolo y el guard sigue deshaciéndolo. No hay nada que arreglar.

**El panel no está en marcha, ¿está funcionando el guard?**
No: en modo panel el guard vive dentro de `admin_server.py`. Si quiere protección independiente del panel, use el servicio autónomo de la [sección 7](#7-funcionamiento-sin-el-panel-de-administración).

---

## 14. Desactivarlo o eliminarlo

- **Pausarlo:** ponga `thermal_mode` en `log`. Sigue observando e informando, pero nunca actúa.
- **Desactivarlo del todo:** ponga `thermal_enabled` en `false`.
- **Autónomo:** `sudo systemctl disable --now thermal-guard`.
- **Deshacer los permisos de cpufreq:** `sudo ./setup-cpufreq-perms.sh --revoke`.

Borrar `thermal_guard.py` también es seguro: `admin_server.py` lo importa dentro de un `try` y simplemente informa de que el guard no está disponible si falta.

---

## Véase también

- [Instalación del panel de administración](ADMIN_PANEL_SETUP.md#thermal-guard) — la pestaña Thermal Guard en su contexto
- [Instalación](INSTALLATION.md#protección-térmica-de-la-cpu) — protección térmica durante una instalación nueva
- [Estructura del proyecto](PROJECT_STRUCTURE.md) — dónde está `thermal_guard.py`
