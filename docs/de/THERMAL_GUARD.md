# Thermal Guard — Handbuch für Sysops

**Schutz vor CPU-Überhitzung für PhantomSDR-Plus.**

Ein WebSDR ist eine der wenigen Anwendungen, die jeden Kern dauerhaft auslasten — den ganzen Tag, für immer. Wenn ein Lüfter verstopft, eine Pumpe ausfällt oder der Raum im August heiß wird, sagt Ihnen das niemand: Der Server dekodiert einfach weiter, bis sich die CPU selbst gart. Der Thermal Guard ist der Teil, der das bemerkt und für Sie den Stecker zieht.

Er wird **inaktiv ausgeliefert**: Ab Werk schreibt er nur in ein Protokoll. Nichts ist geschützt, bis Sie einen Modus wählen. In diesem Handbuch geht es darum, diese Wahl zu treffen und damit zu leben.

> **Eilig?** Führen Sie `python3 thermal_guard.py --once` aus, lesen Sie die ausgegebenen Schwellen und setzen Sie `thermal_mode` im Admin-Panel auf `stop+restart`. Das ist die ganze Arbeit. Alles Weitere unten ist das *Warum*.

---

## Inhalt

1. [Was er tut](#1-was-er-tut)
2. [Schnellstart](#2-schnellstart)
3. [Wie er entscheidet](#3-wie-er-entscheidet)
4. [Die vier Modi — was jeder tut und was Sie tun müssen](#4-die-vier-modi)
5. [Den Modus wählen](#5-den-modus-wählen)
6. [Konfigurationsreferenz](#6-konfigurationsreferenz)
7. [Betrieb ohne Admin-Panel](#7-betrieb-ohne-admin-panel)
8. [Die Throttle-Stufe ohne root aktivieren](#8-die-throttle-stufe-ohne-root-aktivieren)
9. [Unbeaufsichtigter Betrieb — wenn niemand zusieht](#9-unbeaufsichtigter-betrieb)
10. [Testen, bevor Sie ihm vertrauen](#10-testen-bevor-sie-ihm-vertrauen)
11. [Das Protokoll lesen](#11-das-protokoll-lesen)
12. [Lockout und Ratenbegrenzung](#12-lockout-und-ratenbegrenzung)
13. [Fehlersuche](#13-fehlersuche)
14. [Abschalten oder entfernen](#14-abschalten-oder-entfernen)

---

## 1. Was er tut

Alle 2 Sekunden liest der Guard die Die-Temperatur Ihrer CPU und vergleicht sie mit vier Schwellen. Bleibt die Temperatur lange genug über einer davon, steigt er eine Leiter hinauf:

```
   normal  ──►  warn  ──►  throttle  ──►  stop  ──►  (abkühlen)  ──►  restart
              Zeile ins    CPU-Takt      Stopp-        Server         Start-
              Protokoll    absenken      Skript        bleibt aus     Skript
```

Zwei Entwurfsentscheidungen sorgen dafür, dass er auf *jeder* Maschine funktioniert — es lohnt sich, sie zu verstehen, bevor Sie sich auf ihn verlassen:

**Er fragt nie, wie Sie Ihren Server betreiben.** systemd, eine Watchdog-Schleife, cron, tmux, eine nackte Shell — der Guard weiß es nicht und es interessiert ihn nicht. Stattdessen hält er, solange die Maschine zu heiß ist, einen **Lockout**: Er wiederholt den Stopp bei *jedem* Takt. Startet Ihr Watchdog den Server neu, stoppt der Guard ihn innerhalb von zwei Sekunden wieder. Was auch immer den Server am Leben halten will, verliert — bis die CPU abgekühlt ist. Genau das macht ihn universell, und es ist gegen einen echten Watchdog getestet.

**Er verdrahtet nie eine feste Temperatur.** „Stopp bei 95 °C“ ist eine schlechte Regel: Auf einem Intel mit Tjmax 100 ist das eher normale Last, auf einem Ryzen liegt es *unter* dem Wert, auf dem Tctl unter Boost von Haus aus sitzt, und auf einem Raspberry Pi ist es unerreichbar, weil der SoC sich bei 80 selbst drosselt. Also liest der Guard den kritischen Grenzwert, den Ihr eigener Kernel veröffentlicht (`tempN_crit`), und rechnet davon zurück. Gleicher Code, überall sinnvolle Zahlen.

---

## 2. Schnellstart

**1. Sehen Sie, wie Ihre Maschine für den Guard aussieht.** Immer zuerst:

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

Steht bei `sensor` ein `NONE`, hören Sie hier auf und lesen Sie die [Fehlersuche](#13-fehlersuche) — der Guard kann keine Maschine schützen, die er nicht messen kann, und er sagt Ihnen das, statt so zu tun als ob.

**2. Lassen Sie ihn ein paar Tage im Modus `log`.** Er läuft bereits im Admin-Panel. Lassen Sie ihn eine normale Woche beobachten — Sommernachmittage, einen großen Build, einen betriebsamen Contest-Samstag — und sehen Sie nach, ob er je ausgelöst hätte.

**3. Scharfschalten.** Admin-Panel → **Settings** → **THERMAL GUARD** → **MODE** → `stop+restart` → 💾 **SAVE THERMAL SETTINGS**. Wirkt nach etwa 2 Sekunden; kein Neustart nötig.

---

## 3. Wie er entscheidet

### Der Sensor

Der Guard vertraut nur echten CPU-Die-Sensoren:

| Quelle | Typische Hardware |
|---|---|
| `coretemp` | Intel |
| `k10temp`, `zenpower`, `zenpower3` | AMD |
| `cpu_thermal`, `soc_thermal` | Raspberry Pi, ARM-SBCs |
| Thermal Zone `x86_pkg_temp` | Rückfallebene auf x86 |

`acpitz` und unbeschriftete Thermal Zones sind **absichtlich ausgeschlossen**. Auf einem typischen Desktop meldet `acpitz` rund 28 °C, während das CPU-Package bei 59 °C liegt — ein Guard, der dem vertraut, würde schlicht nie auslösen. „Deaktiviert, kein vertrauenswürdiger Sensor“ zu melden ist ehrlicher, als Schutz vorzutäuschen.

`psutil` wird genutzt, falls es zufällig installiert ist, ist aber nie erforderlich. Der Guard kommt mit der reinen Standardbibliothek aus.

### Die Schwellen

Jede ist ein Abstand unterhalb des kritischen Grenzwerts, den die Maschine selbst veröffentlicht:

| Schwelle | Abstand unter crit | Bedeutung |
|---|---|---|
| warn | −12 °C | Etwas stimmt nicht, protokollieren |
| throttle | −8 °C | Durch Absenken des Takts abkühlen |
| stop | −5 °C | Zu nah am Limit — Server stoppen |
| resume | −25 °C | Wirklich wieder kühl, Rückkehr sicher |

In der Praxis ergibt das:

| Ihre CPU meldet | warn | throttle | **stop** | resume |
|---|---|---|---|---|
| Intel, crit 100 °C | 88 | 92 | **95** | 75 |
| AMD Ryzen, crit 95 °C | 83 | 87 | **90** | 70 |
| Raspberry Pi, crit 85 °C | 73 | 77 | **80** | 60 |

Veröffentlicht die Maschine gar keinen kritischen Punkt, fällt der Guard auf einen konservativen festen Satz zurück und sagt das auch. Sie können jede Schwelle mit einem absoluten Wert überschreiben (siehe [Konfigurationsreferenz](#6-konfigurationsreferenz)), sollten es aber nicht müssen.

### Haltezeiten — warum eine Spitze nie auslöst

Bei einem einzelnen heißen Messwert passiert nichts. Eine Schwelle muss **durchgehend** gehalten werden:

- **warn** und **throttle**: 30 s (`thermal_warn_sustain_s`)
- **stop**: 60 s (`thermal_sustain_s`)
- **resume**: 300 s unterhalb der Resume-Schwelle vor einem Neustart (`thermal_resume_s`)

Eine Compile-Spitze, ein Schub Dekodierarbeit, ein hochdrehender Lüfter — alles viel zu kurz. Ein einziger Wert unterhalb der Schwelle setzt die Uhr zurück. Zusätzlich verlangt der Guard nach dem Start 3 aufeinanderfolgende gültige Messwerte, bevor er überhaupt handelt, und verwirft jeden Wert außerhalb von 20–125 °C als Sensorfehler statt als Temperatur.

---

## 4. Die vier Modi

`thermal_mode` ist der eine Schalter, der bestimmt, wie weit der Guard die Leiter hinaufsteigen darf. Jeder Modus **umfasst alles, was die vorherigen tun**.

| Modus | Warnt | Drosselt | Stoppt | Startet neu | Server kann ausfallen? |
|---|:--:|:--:|:--:|:--:|---|
| `log` | ✓ | — | — | — | Nein — rührt nichts an |
| `throttle` | ✓ | ✓ | — | — | Nein |
| `stop` | ✓ | ✓ | ✓ | — | Ja, bleibt aus bis Sie handeln |
| `stop+restart` | ✓ | ✓ | ✓ | ✓ | Ja, kommt selbst zurück |

---

### `log` — beobachten und melden (Auslieferungszustand)

**Was er tut:** alles, was die anderen Modi tun, nur ohne zu handeln. Er durchläuft die ganze Leiter und schreibt in `crash.log`, was er *getan hätte*. Er führt nie Ihr Stopp-Skript aus, rührt die CPU-Frequenz nicht an und unterbricht keinen Zuhörer.

**Was Sie tun müssen:** nichts — er läuft bereits. Öffnen Sie nach einer Woche den Reiter **CRASH** im Admin-Panel oder führen Sie aus:

```
grep THERMAL crash.log
```

- **Nichts da?** Ihre Kühlung ist in Ordnung und Sie können den Guard beruhigt scharfschalten.
- **`STOP level reached ... NOT stopping`?** Der Guard hätte Ihren Server heruntergefahren. Das ist ein echtes thermisches Problem, mit dem Sie bisher gefahren sind — beheben Sie die Kühlung *und* schalten Sie den Guard scharf.

**Nutzen Sie ihn, wenn:** Sie den Guard gerade installiert haben und noch nicht wissen, wie sich Ihre Maschine verhält. Das ist ein Erprobungsmodus, kein Ziel — ein Guard im Modus `log` schützt nichts.

---

### `throttle` — CPU verlangsamen, Betrieb nie unterbrechen

**Was er tut:** An der Throttle-Schwelle senkt er die maximale CPU-Frequenz um 20 % und stellt sie wieder her, sobald die Temperatur unter die Warn-Linie zurückgekehrt ist. Ihr WebSDR bleibt durchgehend online. Zuhörer bemerken unter hoher Last vielleicht etwas schlechtere Leistung; die meisten bemerken gar nichts.

Steigt die Temperatur trotzdem über die Stopp-Schwelle, **protokolliert dieser Modus das nur und tut nichts** — er stoppt den Server nicht.

**Was Sie tun müssen:**

1. Dem Guard Schreibzugriff auf das CPU-Frequenzlimit geben — er braucht ihn, und standardmäßig hat ihn nur root. Führen Sie einmalig `./setup-cpufreq-perms.sh` aus; siehe [Abschnitt 8](#8-die-throttle-stufe-ohne-root-aktivieren).
2. Mit `python3 thermal_guard.py --once` prüfen, dass dort `cpufreq : writable, throttle stage available` steht. Steht dort *not writable*, tut dieser Modus nichts, was `log` nicht auch täte — und sagt das jedes Mal im Protokoll.

**Nutzen Sie ihn, wenn:** Sie einem grenzwertigen Kühlproblem nachgehen und die Maschine verteidigen wollen, ohne je Zuhörer zu verlieren. **Beachten Sie: Das ist kein vollständiger Schutz** — reicht das Drosseln nicht, passiert nichts weiter. Als erster Schritt gut, als endgültige Antwort schlecht.

---

### `stop` — Server herunterfahren und aus lassen

**Was er tut:** An der Stopp-Schwelle führt er Ihr Stopp-Skript aus und hält dann den **Lockout** — er stoppt den Server alle 2 Sekunden erneut, solange die Maschine zu heiß ist, damit ihn nichts hinter Ihrem Rücken wiederbelebt. War die CPU 5 Minuten lang unterhalb der Resume-Schwelle, endet der Lockout. **Der Server kommt nicht von selbst zurück.** Sie starten ihn neu, wenn Sie überzeugt sind, dass die Ursache behoben ist.

**Was Sie tun müssen:**

1. Sicherstellen, dass der Guard weiß, wie er Ihren Server stoppt. Im Admin-Panel ist das das konfigurierte Stopp-Skript (`./stop-websdr.sh` bei den mitgelieferten Startskripten). Ist keines gesetzt, greift der Guard auf `SIGTERM` an den Prozessnamen zurück und nach 10 Sekunden Gnadenfrist auf `SIGKILL` — das funktioniert, aber ein richtiges Stopp-Skript ist sauberer.
2. Akzeptieren, dass **Ihr WebSDR offline bleibt, bis Sie es bemerken**. Sorgen Sie dafür, dass Sie es erfahren: eine Uptime-Überwachung, der CRASH-Reiter oder schlicht tägliches Nachsehen.

**Nutzen Sie ihn, wenn:** die Maschine wichtiger ist als der Dienst, Sie meist vor Ort sind, oder ein thermisches Ereignis ernst genug ist, dass Sie die Kiste ansehen wollen, bevor sie weiterläuft. Auch die richtige Wahl, wenn Sie einem automatischen Neustart auf Ihrer Hardware nicht trauen.

---

### `stop+restart` — herunterfahren, abkühlen, selbst zurückkommen

**Was er tut:** alles wie `stop`, und zusätzlich: Hat die CPU 5 Minuten lang unter der Resume-Schwelle gelegen, führt er Ihr Start-Skript aus und das WebSDR kommt von selbst zurück.

Gegen Flattern schützt `thermal_max_stops_hour` (Standard 2). Nach zwei thermischen Stopps innerhalb einer Stunde **deaktiviert** der Guard den automatischen Neustart und lässt den Server aus, damit Sie nachsehen. Beachten Sie das wichtige Detail: Die Ratenbegrenzung schaltet den *Neustart* ab, nie den *Schutz* — der Lockout stoppt den Server weiterhin, solange er zu heiß ist, ganz gleich wie oft er schon ausgelöst hat.

**Was Sie tun müssen:**

1. Sicherstellen, dass **beide** Skripte konfiguriert sind und eigenständig funktionieren — das Start- ebenso wie das Stopp-Skript. Testen Sie sie von Hand: `./stop-websdr.sh`, dann `./start-rx888mk2.sh`.
2. Sonst nichts. Das ist der Modus zum Vergessen.

**Nutzen Sie ihn, wenn:** das WebSDR öffentlich, unbeaufsichtigt oder entfernt ist — also bei den meisten. Das ist der empfohlene Modus für eine normale Installation.

---

## 5. Den Modus wählen

| Ihre Lage | Modus |
|---|---|
| Guard gerade installiert, Maschine noch unbekannt | eine Woche `log` |
| Öffentliches WebSDR, unbeaufsichtigt, soll sich selbst versorgen | **`stop+restart`** |
| Entfernter Standort, schwer erreichbar | **`stop+restart`** |
| Sie wollen die Maschine nach jedem thermischen Ereignis ansehen | `stop` |
| Hardware, der Sie einen automatischen Neustart nicht zutrauen | `stop` |
| Grenzwertige Kühlung, dürfen keine Zuhörer verlieren | `throttle`, danach weiter zu `stop+restart` |
| Maschine ohne vertrauenswürdigen CPU-Sensor | keiner davon funktioniert — erst den Sensor klären |

Für die meisten Sysops lautet die Antwort `stop+restart`, und die ehrliche Zusammenfassung der anderen ist: `log` schützt nichts und `throttle` schützt ein wenig.

---

## 6. Konfigurationsreferenz

Alle Schlüssel liegen in `admin_config.json` neben `thermal_guard.py`, und jeder davon ist auch unter **Settings → THERMAL GUARD** editierbar. Der Guard **liest die Datei bei jedem Takt neu**, Änderungen wirken also innerhalb von ~2 Sekunden — ohne Neustart.

| Schlüssel | Standard | Bedeutung |
|---|---|---|
| `thermal_enabled` | `true` | Hauptschalter. `false` deaktiviert den Guard vollständig. |
| `thermal_mode` | `"log"` | `log` \| `throttle` \| `stop` \| `stop+restart` — siehe [Abschnitt 4](#4-die-vier-modi). |
| `thermal_warn` | `null` | Absolute Warn-Schwelle in °C. `null` = aus dem crit-Wert ableiten. |
| `thermal_throttle` | `null` | Absolute Throttle-Schwelle. `null` = abgeleitet. |
| `thermal_stop` | `null` | Absolute Stopp-Schwelle. `null` = abgeleitet. |
| `thermal_resume` | `null` | Absolute Resume-Schwelle. `null` = abgeleitet. |
| `thermal_sustain_s` | `60` | Sekunden, die die Stopp-Schwelle vor dem Stoppen gehalten werden muss. Minimum 5. |
| `thermal_warn_sustain_s` | `30` | Sekunden für die Warn- und die Throttle-Stufe. Minimum 5. |
| `thermal_resume_s` | `300` | Sekunden unterhalb der Resume-Schwelle, bis der Lockout endet. Minimum 30. |
| `thermal_max_stops_hour` | `2` | Thermische Stopps pro Stunde, nach denen der automatische Neustart abgeschaltet wird. Der Schutz läuft weiter. |
| `thermal_test_temp` | `null` | Tut so, als hätte die CPU diese Temperatur. Nur zum Testen — siehe [Abschnitt 10](#10-testen-bevor-sie-ihm-vertrauen). |

Der eigenständige Guard nutzt zusätzlich `start_script`, `stop_script`, `sdr_process_name` und `sdr_base_dir` aus derselben Datei.

**Eine Schwelle überschreiben.** Tun Sie das nur mit gutem Grund. Ein häufiger: Ihre Maschine läuft bei Builds legitim heiß und Sie möchten nicht, dass das zählt. `thermal_stop` anzuheben kauft Ihnen Luft auf Kosten des Abstands zum kritischen Punkt — setzen Sie ihn nie über Ihren crit-Wert, sonst erreicht die CPU zuerst ihre eigene Notabschaltung und der Guard ist reine Dekoration.

---

## 7. Betrieb ohne Admin-Panel

Viele Sysops installieren das Panel nie. Der Guard läuft problemlos für sich allein — dieselbe Datei, dasselbe Verhalten.

**Zuerst im Vordergrund ausprobieren:**

```
cd ~/PhantomSDR-Plus
python3 thermal_guard.py --once            # was passierte hier?
python3 thermal_guard.py --mode log        # live zusehen, Strg-C beendet
```

`--mode` überschreibt `thermal_mode` von der Kommandozeile, Sie müssen also nie JSON von Hand schreiben:

```
python3 thermal_guard.py --mode stop+restart
python3 thermal_guard.py --config /etc/phantomsdr/thermal.json
```

**Dann dauerhaft einrichten** mit der im Projekt mitgelieferten Beispiel-Unit:

```
sudo cp thermal-guard.service /etc/systemd/system/
sudo nano /etc/systemd/system/thermal-guard.service   # User= und Pfade setzen
sudo systemctl daemon-reload
sudo systemctl enable --now thermal-guard
systemctl status thermal-guard
```

Lesen Sie die Kommentare am Anfang von `thermal-guard.service`, bevor Sie sie aktivieren. Zwei Punkte sind am wichtigsten:

- **`User=` muss ein Konto sein, das Ihre Start- und Stopp-Skripte wirklich ausführen kann.** Den Guard als root laufen zu lassen ist meist die falsche Antwort: Er würde diese Skripte dann ebenfalls als root ausführen.
- Verweisen Sie ihn entweder auf eine `admin_config.json` mit `start_script` und `stop_script`, oder geben Sie `--mode` in der `ExecStart`-Zeile mit. Eine minimale Konfiguration genügt:

```json
{
  "sdr_base_dir": "/home/ihrbenutzer/PhantomSDR-Plus",
  "sdr_process_name": "spectrumserver",
  "start_script": "start-rx888mk2.sh",
  "stop_script": "stop-websdr.sh",
  "thermal_mode": "stop+restart"
}
```

Alles, was der Guard tut, landet weiterhin in `crash.log` neben dieser Konfigurationsdatei sowie im systemd-Journal (`journalctl -u thermal-guard`).

---

## 8. Die Throttle-Stufe ohne root aktivieren

Standardmäßig meldet `python3 thermal_guard.py --once`:

```
cpufreq    : not writable — throttle stage disabled
```

Das ist normal und kein Fehler. Der Kernel legt

```
/sys/devices/system/cpu/cpuN/cpufreq/scaling_max_freq
```

als `root:root` mit Modus `0644` an. Ein Admin-Panel, das als gewöhnlicher Benutzer läuft, kann dort nicht schreiben — der Guard überspringt die Throttle-Stufe und sagt das im Protokoll, statt stillschweigend zu versagen.

**Die falsche Lösung** ist, den Guard als root laufen zu lassen. Er führt auch Ihre Start- und Stopp-Skripte aus, und die sollen unprivilegiert bleiben.

**Die richtige Lösung** ist, den Schreibzugriff auf genau diese Dateien einer eigenen Gruppe zu geben. Ein Skript erledigt das:

```
cd ~/PhantomSDR-Plus
./setup-cpufreq-perms.sh
```

Es fragt einmal nach Ihrem Passwort — und nur einmal, bei der Einrichtung — und dann:

1. legt es eine Systemgruppe `cpufreq` an und nimmt Sie hinein;
2. installiert `/etc/tmpfiles.d/99-phantomsdr-cpufreq.conf`, damit Gruppenzugehörigkeit und Modus `0664` **bei jedem Systemstart** neu gesetzt werden — sysfs-Rechte überstehen einen Neustart nicht von selbst;
3. wendet die Änderung sofort an, damit Sie ohne Neustart testen können.

Danach, in dieser Reihenfolge:

```
# 1. ab- und wieder anmelden (oder neu starten) — eine neue Gruppe
#    erreicht Ihre Prozesse nur über eine frische Anmeldung
id | grep cpufreq

# 2. Panel neu starten; der Guard prüft den Schreibzugriff einmal beim Start
sudo systemctl restart phantomsdr-admin
#    (so ist kein Abmelden nötig — systemd baut die Gruppenliste bei jedem
#     Start neu auf. Nur wenn die Units NICHT installiert sind:
#     ./manage_admin.sh stop && ./manage_admin.sh start — niemals beides, sie streiten um Port 3000)

# 3. bestätigen
python3 thermal_guard.py --once
#    cpufreq    : writable, throttle stage available
```

Vollständig rückgängig machen: `sudo ./setup-cpufreq-perms.sh --revoke`.

**Hinweise**

- Die Throttle-Stufe *handelt* weiterhin nur, wenn `thermal_mode` auf `throttle` oder höher steht. Die Berechtigung allein ändert nichts.
- Der Guard senkt das *aktuell* geltende Limit um 20 % und stellt genau diesen Wert wieder her. Wenn Sie Ihre CPU bereits begrenzen (etwa über `MAX_SPEED` in `/etc/init.d/cpufrequtils`), wird Ihre Begrenzung wiederhergestellt — der Guard gibt Ihnen nicht klammheimlich einen höheren Takt zurück, als Sie eingestellt haben.
- Manche Maschinen legen überhaupt keinen cpufreq-Treiber offen — viele VPS, die meisten Container. Das Skript erkennt das und ändert nichts. Verwenden Sie dort `stop` oder `stop+restart`; die hängen nicht von cpufreq ab.

---

## 9. Unbeaufsichtigter Betrieb

Die häufigste Frage zum Guard: *Was passiert, wenn niemand zusieht?* Die kurze Antwort: Genau dafür wurde er gebaut.

**Er braucht kein offenes Browserfenster.** Der Guard ist ein Hintergrund-Thread in `admin_server.py`, getaktet vom Graphen-Sampler alle 2 Sekunden. Er läuft, ob jemand im Panel angemeldet ist oder nicht, ob ein Browser offen ist oder nicht, ob Sie wach sind oder nicht. Im eigenständigen Betrieb ist er ein systemd-Dienst und damit noch unabhängiger. Die Dashboard-Kachel ist ein *Fenster* auf den Guard, nicht der Guard selbst.

**Er handelt ohne zu fragen.** Es gibt keinen Bestätigungsdialog und keine Benachrichtigung, auf die gewartet wird. An der Stopp-Schwelle stoppt er den Server, Punkt. Genau darum geht es.

**Aber nur, wenn Sie es erlaubt haben.** Im Modus `log` protokolliert er getreulich, wie sich eine Maschine gart, und tut nichts dagegen. Wenn Sie diesen Abschnitt lesen, weil *„ich bin nicht da, um zuzusehen“*, ist `stop+restart` der Modus, den Sie wollen — nur er schützt die Maschine und bringt den Dienst ohne Sie zurück.

**Er hilft nur, solange das Panel lebt.** Der Wächter ist Teil von `admin_server.py`: Ein Panel, das um 02:00 Uhr gestorben ist, nimmt den Schutz mit, und nach einem Neustart bleibt die Maschine ungeschützt, bis Sie sich anmelden und es erneut starten. Wenn niemand zusieht, lassen Sie systemd zusehen: Das Repository liefert `phantomsdr-admin.service` und `phantomsdr-proxy.service` mit, die beim Booten starten und das Panel innerhalb von fünf Sekunden nach einem Absturz neu starten. Siehe [ADMIN_PANEL_SETUP.md](ADMIN_PANEL_SETUP.md). Für einen unbeaufsichtigten Empfänger wird das **dringend empfohlen** — `stop+restart` scharfzuschalten schützt Sie sonst nur bis zum nächsten Neustart.

**Wie Sie es hinterher erfahren.** Grob nach Nützlichkeit:

| Wo | Was Sie bekommen |
|---|---|
| `crash.log` / Reiter **CRASH** | Jede Aktion mit Zeitstempel. Die dauerhafte Aufzeichnung. |
| Dashboard-Kachel **THERMAL GUARD** | Live-Zustand: Temperatur, Stufe, Lockout, Stopps der letzten Stunde. |
| Seite **Graphs** (CPU-Temperatur, 24 h) | Der Verlauf — wie schnell es stieg, wie lange das Abkühlen dauerte. |
| `journalctl -u thermal-guard` | Nur im eigenständigen Betrieb. |

Eine sinnvolle Routine für einen unbeaufsichtigten Standort: `stop+restart` scharf, und `grep THERMAL crash.log`, wann immer Sie sich ohnehin anmelden. Ist es leer, gibt es nichts zu wissen.

**Ein durchgespieltes Beispiel.** Lüfterausfall um 03:00 auf einer Maschine im Modus `stop+restart`:

```
03:14  Temperatur überschreitet 88 °C, hält 30 s     →  warn protokolliert
03:16  überschreitet 92 °C, hält 30 s                →  throttle angewandt (falls erlaubt)
03:19  überschreitet 95 °C, hält 60 s                →  STOP — Stopp-Skript, Lockout an
03:19  Watchdog startet den Server neu               →  Guard stoppt erneut, protokolliert
03:26  CPU seit 5 Minuten unter 75 °C                →  Lockout endet, Start-Skript läuft
03:41  überhitzt ein zweites Mal und stoppt          →  Ratengrenze erreicht, kein Neustart mehr
                                                        Server bleibt aus, Schutz bleibt an
```

Sie wachen auf mit einem WebSDR, das aus ist, einer `crash.log`, die genau sagt warum, und — vor allem — einer CPU, die ihrem kritischen Punkt nie nahe gekommen ist.

---

## 10. Testen, bevor Sie ihm vertrauen

Warten Sie nicht auf eine echte Hitzewelle, um herauszufinden, ob Ihr Stopp-Skript funktioniert.

**`thermal_test_temp`** lässt den Guard glauben, die CPU habe eine von Ihnen gewählte Temperatur. Alles andere verhält sich völlig normal — die Haltezeiten, die Leiter, der Lockout, Ihre echten Skripte.

1. Admin-Panel → **Settings** → **THERMAL GUARD** → **TEST TEMPERATURE**.
2. Einen Wert über Ihrer Stopp-Schwelle eintragen (etwa `97` auf einem Intel).
3. Speichern und die Dashboard-Kachel sowie den CRASH-Reiter beobachten.
4. **Feld danach leeren.** Eine stehengebliebene Testtemperatur bedeutet, dass der Guard nicht mehr den echten Sensor liest.

Im Modus `log` zeigt Ihnen das die ganze Leiter, ohne dass etwas auf dem Spiel steht — der sichere erste Test und der, den man vor jedem Scharfschalten macht.

Im Modus `stop+restart` ist das ein **Live-Test**: Ihr Server wird wirklich stoppen und etwa fünf Minuten nach dem Leeren des Feldes wirklich zurückkommen. Machen Sie das, wenn niemand zuhört. Es lohnt sich einmal, denn nur so wissen Sie, dass Ihre Stopp- und Start-Skripte auch funktionieren, wenn etwas anderes als Sie sie aufruft.

Entsprechungen im eigenständigen Betrieb:

```
python3 thermal_guard.py --once                 # nur Schwellen, keine Aktion
python3 thermal_guard.py --mode log             # die Leiter live beobachten
```

---

## 11. Das Protokoll lesen

Alles wird an `crash.log` neben der Konfigurationsdatei angehängt, ein Ereignis pro Zeile, jeweils mit `[THERMAL]` davor:

```
grep THERMAL crash.log
```

Die Zeilen sind bewusst einzeilig und grep-freundlich. Was Sie sehen werden:

| Zeile | Bedeutung |
|---|---|
| `warn: 88.4C (warn=88.0 crit=100) sustained 30s` | Erste Sprosse. Es wurde nichts getan. |
| `throttle: 92.1C sustained 30s — cpufreq max lowered 20%` | CPU-Takt abgesenkt. |
| `throttle level reached: ... (no cpufreq write access — stage skipped)` | Siehe [Abschnitt 8](#8-die-throttle-stufe-ohne-root-aktivieren). |
| `STOP level reached: ... mode is 'log', NOT stopping` | Er hätte den Server gestoppt. Schalten Sie ihn scharf. |
| `STOPPED server: 95.2C sustained 60s (stop=95.0 crit=100) — ran stop-websdr.sh` | Der Ernstfall. |
| `lockout: process reappeared at 96.0C — re-stopped (...) [12 time(s) so far]` | Etwas startet Ihren Server neu; der Guard gewinnt. Auf eine Zeile pro Minute begrenzt. |
| `rate limit: 2 thermal stops within the hour — automatic restart is now DISABLED` | Bleibt aus, damit Sie nachsehen. Der Schutz läuft weiter. |
| `recovered: 54.0C held below 75.0 — lockout cleared` | Wieder kühl. |
| `auto-restart: ran start-rx888mk2.sh` | Wieder online. |
| `back to normal: 59.0C (warn=88.0)` | Von der Leiter gestiegen, ohne je zu stoppen. |

---

## 12. Lockout und Ratenbegrenzung

Diese beiden Verhaltensweisen überraschen am ehesten, deshalb hier deutlich:

**Der Lockout** ist das, was den Guard gerade gegen *Ihre* Einrichtung wirksam macht. Wenn er den Server stoppt, setzt er nicht einfach einen Stopp ab und hofft. Er markiert sich als gesperrt und prüft bei jedem 2-Sekunden-Takt, solange die Temperatur über der Resume-Schwelle liegt, ob der Serverprozess wieder da ist — und stoppt ihn dann erneut. Ihr Watchdog, `Restart=always` in systemd, ein cron-Job, ein ungeduldiger Sysop: Sie alle verlieren diesen Streit, bis die CPU abkühlt. Er endet automatisch, sobald die Temperatur `thermal_resume_s` lang (Standard 5 Minuten) unter der Resume-Schwelle geblieben ist.

**Die Schaltfläche CLEAR LOCKOUT** auf der Dashboard-Kachel beendet den Lockout *und* setzt den Stopps-pro-Stunde-Zähler zurück — für den Fall, dass Sie die Kühlung repariert haben und nicht warten wollen. Sie **entschärft den Guard nicht**: Ist die Maschine noch heiß, stoppt die nächste Prüfung den Server sofort wieder. Das ist so beabsichtigt.

**Die Ratenbegrenzung** (`thermal_max_stops_hour`, Standard 2) verhindert, dass eine defekte Maschine die ganze Nacht auf und ab fährt. Ist die Grenze erreicht, **deaktiviert** der Guard den automatischen Neustart und lässt den Server aus. Lesen Sie das genau: Er deaktiviert den Neustart, nicht den Schutz. Der Lockout stoppt den Server weiterhin, solange er zu heiß ist, ganz gleich wie oft er schon ausgelöst hat. Ein Guard, der ausgerechnet dann verstummt, wenn es der Maschine am schlechtesten geht, wäre schlimmer als gar kein Guard.

---

## 13. Fehlersuche

**`sensor : NONE — no trusted CPU sensor on this machine`**
Der Guard fand keinen zugelassenen Sensor und weigert sich zu raten. Probieren Sie `sensors` (aus `lm-sensors`; `sudo apt install lm-sensors && sudo sensors-detect`). In einer VM oder einem Container gibt es oft tatsächlich keinen Die-Sensor — der Guard kann diese Maschine nicht schützen und meldet sich korrekt als deaktiviert, statt so zu tun als ob.

**`cpufreq : not writable — throttle stage disabled`**
Zu erwarten, solange Sie `./setup-cpufreq-perms.sh` nicht ausgeführt haben — siehe [Abschnitt 8](#8-die-throttle-stufe-ohne-root-aktivieren). Betrifft nur die Throttle-Stufe; `stop` und `stop+restart` sind davon unberührt.

**`setup-cpufreq-perms.sh` ausgeführt, meldet trotzdem „not writable“**
Zwei wahrscheinliche Ursachen: Sie haben sich seitdem nicht ab- und wieder angemeldet (eine neue Gruppe erreicht Prozesse nur über eine frische Anmeldung — mit `id` prüfen), oder das Panel wurde seitdem nicht neu gestartet (der Guard prüft den Schreibzugriff einmal beim Start). Beides nachholen, in dieser Reihenfolge.

**Die Schwellen wirken falsch für meine CPU**
Prüfen Sie, was die Maschine veröffentlicht: `cat /sys/class/hwmon/hwmon*/temp*_crit`. Ist Ihr crit-Wert ungewöhnlich oder fehlt er, setzen Sie `thermal_stop` und Verwandte auf absolute Werte.

**Er hat meinen Server gestoppt, obwohl es meiner Meinung nach nicht heiß war**
Prüfen Sie, ob `thermal_test_temp` noch von einem Test gesetzt ist. Das ist mit Abstand die häufigste Ursache.

**Er löst nie aus, obwohl die Maschine heiß wird**
Prüfen Sie, dass der Modus nicht `log` ist, dass `thermal_enabled` auf `true` steht, und vergleichen Sie die gesehene Temperatur mit den Schwellen aus `--once`. Denken Sie daran, dass die Schwelle die Haltezeit über *durchgehend* überschritten sein muss.

**Der Server startet während eines thermischen Ereignisses ständig neu**
Das ist der Lockout bei der Arbeit, und die `lockout:`-Zeilen sind seine Erfolgsmeldung — Ihr Supervisor versucht es weiter, der Guard macht es weiter rückgängig. Nichts zu reparieren.

**Das Panel läuft nicht — läuft dann der Guard?**
Nein — im Panel-Betrieb lebt der Guard in `admin_server.py`. Wollen Sie Schutz unabhängig vom Panel, nutzen Sie den eigenständigen Dienst aus [Abschnitt 7](#7-betrieb-ohne-admin-panel).

---

## 14. Abschalten oder entfernen

- **Pausieren:** `thermal_mode` auf `log` setzen. Er beobachtet und meldet weiter, handelt aber nie.
- **Vollständig deaktivieren:** `thermal_enabled` auf `false` setzen.
- **Eigenständig:** `sudo systemctl disable --now thermal-guard`.
- **cpufreq-Rechte zurücknehmen:** `sudo ./setup-cpufreq-perms.sh --revoke`.

`thermal_guard.py` zu löschen ist ebenfalls unbedenklich — `admin_server.py` importiert die Datei in einem `try` und meldet den Guard einfach als nicht verfügbar, wenn sie fehlt.

---

## Siehe auch

- [Admin-Panel-Einrichtung](ADMIN_PANEL_SETUP.md#thermal-guard) — der Reiter Thermal Guard im Zusammenhang
- [Installation](INSTALLATION.md#cpu-überhitzungsschutz) — thermischer Schutz bei einer Neuinstallation
- [Projektstruktur](PROJECT_STRUCTURE.md) — wo `thermal_guard.py` liegt
