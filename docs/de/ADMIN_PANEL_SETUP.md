# PhantomSDR-Plus Admin-Panel — Einrichtungsanleitung

> ⚠️ **Sicherheitshinweis:** Halten Sie dieses Admin-Panel in Ihrem Heimnetz oder hinter einem VPN. Eine öffentliche Freigabe des Admin-Ports ist ohne geeignete Absicherung der Authentifizierung nicht zu empfehlen.

---

## Überblick

Das Admin-Panel besteht aus zwei Python-Diensten:

| Dienst | Datei | Rolle |
|---|---|---|
| Admin-Panel | `admin_server.py` | Flask-Webanwendung, bindet an `127.0.0.1` (nur intern) |
| Reverse-Proxy | `proxy.py` | Stellt sowohl das SDR als auch das Admin-Panel auf einem einzigen öffentlichen Port bereit |

Beide Dienste lesen ihre Konfiguration aus `admin_config.json`, das von `setup_admin.sh` geschrieben wird. **Ändern Sie Portkonstanten nicht direkt in den Python-Dateien** — alle Ports und die IP des SDR-Hosts liegen in `admin_config.json`.

---

## Was das Admin-Panel bietet

- **Dashboard** — Serverstatus in Echtzeit, CPU/RAM, Top-Prozesse, aktuelle Protokollausgabe, Terminal
- **Konfigurationseditor** — beliebige `.toml`-, `.sh`-, `.json`-, `.h`- und `.cpp`-Dateien Ihrer Installation ansehen, bearbeiten und speichern
- **Protokollanzeige** — jede Protokolldatei in Echtzeit verfolgen (SDR-Server, Admin-Panel, RADE, Absturz, Autorun, Proxy)
- **Marker** — Frequenzmarker ansehen und bearbeiten
- **Chatverlauf** — das WebSDR-Chatprotokoll ansehen, vollständig leeren oder einzelne Nachrichten löschen, ohne den Server neu zu starten
- **Wasserfallnachricht** — ein dauerhaftes Banner an alle verbundenen Nutzer senden, in Echtzeit auf der Wasserfallanzeige sichtbar
- **Nutzer** — Live-Liste der verbundenen Hörer mit ihrer Frequenz, Betriebsart, Dauer und einer ⚡-Kick-Schaltfläche
- **Löschen von Chatnachrichten** — 🗑-Delete-Schaltfläche, die genau diese eine Nachricht sofort aus dem Protokoll entfernt
- **Wasserfall-Rundnachrichten** — erlaubt es, ein dauerhaftes Textbanner in den Wasserfall jedes verbundenen Nutzers zu schieben
- **Spot Reporting** — den Autorun-Decoder für FT8/FT4/JS8/WSPR starten/stoppen, Bänder/Betriebsarten wählen und Spots an PSK Reporter / wsprnet melden (standardmäßig AUS), mit zwei Zählern: Kacheln je Decoder für den aktuellen Lauf und ein Gesamtwert seit Beginn neben jedem Band-/Betriebsart-Kontrollkästchen
- **Graphen** — CPU-Frequenz, CPU-Last, CPU-Temperatur und verbundene Nutzer, aufgezeichnet über die letzten 15 Minuten / 1 Stunde / 4 Stunden / 12 Stunden / 24 Stunden
- **Thermischer Schutz (Thermal Guard)** — stoppt den Server, wenn die CPU überhitzt, und startet ihn wieder, sobald sie abgekühlt ist; die Schwellen leiten sich aus Ihrer eigenen CPU ab. Funktioniert mit jeder Start-/Stopp-Methode und läuft ausgeliefert nur im Protokollmodus, tut also nichts, bis Sie ihn aktivieren
- **Einstellungen** — Admin-Passwort, SDR-Basisverzeichnis, Prozessname und öffentlichen Port ändern

---

## Voraussetzungen

- PhantomSDR-Plus bereits installiert und in Betrieb
- Python 3.8+

> [!NOTE]
> **Normalerweise erledigt das Installationsskript dies für Sie.** `./install.sh` — ebenso jedes der vier Distributionsskripte, beide RADE-Skripte und das Statistikserver-Skript — richtet das Admin-Panel standardmäßig ein und installiert zuvor `pip` mit dem Paketmanager des Systems, falls es fehlt. Diese Seite beschreibt, was in diesem Schritt geschieht und was zu tun ist, wenn Sie ihn übersprungen haben oder später etwas ändern wollen.

Die Python-Bibliotheken des Panels (`flask`, `psutil`, `aiohttp`, `tomli-w`) werden von `setup_admin.sh` installiert; sollte das fehlschlagen, gibt es den genauen Befehl aus.

---

## Schritt 1 — Dateien

Legen Sie diese vier Dateien in Ihr PhantomSDR-Plus-Verzeichnis:

```
admin_server.py
manage_admin.sh
setup_admin.sh
proxy.py
```

Machen Sie die Shell-Skripte ausführbar:

```bash
chmod +x setup_admin.sh manage_admin.sh
```

---

## Schritt 2 — Das Einrichtungsskript ausführen

```bash
./setup_admin.sh
```

Das Skript wird:

1. prüfen, ob Python 3 installiert ist
2. das Vorhandensein von `admin_server.py` und `manage_admin.sh` überprüfen
3. `127.0.0.1` als `sdr_host` in der Konfiguration eintragen (siehe [Die Einstellung `sdr_host`](#die-einstellung-sdr_host))
4. nach drei Portnummern fragen. Jede Abfrage bietet einen Vorgabewert in Klammern,
den ein einfaches Enter übernimmt, sodass eine normale Einrichtung drei Tastendrücke braucht:
   - **Spectrumserver-Port** — der Port, auf dem Ihr SDR-Server lauscht (Vorgabe `8900`,
     genau das, was jede `config-*.toml` im Repository mitbringt)
   - **Interner Port des Admin-Panels** — wo `admin_server.py` lokal bindet (Vorgabe `3000`)
   - **Öffentlicher Proxy-Port** — der einzige externe Port, der SDR + Admin vereint (Vorgabe `8902`)

Ungültige Antworten werden abgelehnt und erneut abgefragt, aber nur fünfmal — danach wird der Vorgabewert verwendet. Ein Lauf, dessen Eingabe kein Terminal ist (Pipe, Cron, unbeaufsichtigt), übernimmt die Vorgaben sofort, statt auf eine Eingabe zu warten, die nie kommt.
5. `flask`, `psutil`, `aiohttp` und `tomli-w` per pip installieren
6. `ss` die Fähigkeit `cap_net_admin` gewähren (Rückfallweg der Kick-Funktion, nur nötig, wenn das Panel ohne den Proxy läuft)
7. fragen, welches Skript den Empfänger startet und welches ihn stoppt — darüber steuert das Panel den Server, und der Thermal Guard ebenso
8. fragen, wie weit der CPU-Überhitzungsschutz selbstständig gehen darf — `log`, `throttle`, `stop` oder `stop+restart` — und anbieten, `setup-cpufreq-perms.sh` auszuführen, damit die Throttle-Stufe ohne root funktioniert (siehe [THERMAL_GUARD.md](THERMAL_GUARD.md))
9. `admin_config.json` mit allen Einstellungen schreiben
10. anbieten, zwei systemd-Units zu installieren (Panel + Proxy) — Start beim Booten und Neustart nach einem Absturz. **Empfohlen und voreingestellt** (bloßes Enter genügt): Der CPU-Überhitzungsschutz läuft nur, solange das Panel läuft — ohne die Units ist die Maschine nach einem Neustart ungeschützt. Der Schritt wird automatisch übersprungen, wenn systemd nicht PID 1 ist (Container, WSL1, OpenRC) oder kein sudo vorhanden ist.

Öffnen Sie nach der Einrichtung Ihren Browser über den Proxy:
```
http://YOUR_SERVER_IP:<proxy_port>/admin
```
Standardpasswort: **`admin`**

> ⚠️ **Ändern Sie das Passwort sofort** — gehen Sie bei der ersten Anmeldung zu Settings. Ein Assistent beim ersten Start führt Sie durch das Festlegen von SDR-Verzeichnis, Prozessname, öffentlichem Port und neuem Passwort.

---

## Schritt 3 — Starten / Stoppen / Neu starten

Es gibt zwei Wege, Panel und Proxy zu betreiben. **Wählen Sie einen und bleiben Sie dabei** — die Warnung am Ende dieses Abschnitts erklärt, was beim Mischen passiert.

> **Methode B (systemd) wird dringend empfohlen**, wo immer systemd verfügbar ist. Der CPU-Überhitzungsschutz läuft im Panel: Ein Panel, das um 03:00 stirbt, oder eine Maschine, die neu startet, lässt die CPU ungeschützt, bis jemand sie von Hand wieder startet. `setup_admin.sh` bietet die Units jetzt standardmäßig an. Nutzen Sie Methode A, wenn es kein systemd gibt — Container, WSL1, OpenRC/sysvinit — oder wenn Sie die Überwachung bewusst selbst übernehmen wollen.

### Methode A — `manage_admin.sh` (kein root, nichts zu installieren)

```bash
./manage_admin.sh start      # start admin panel and proxy
./manage_admin.sh stop       # stop both
./manage_admin.sh status     # show running status and PIDs
```

Es gibt bewusst **kein `restart`**. Früher beendete es das Panel und startete sofort seine eigene Kopie, was auf jeder Maschine mit Methode B mit systemd kollidiert. Für einen Neustart unter Methode A führen Sie `stop` und dann `start` aus — siehe [Panel neu starten](#panel-neu-starten) weiter unten.

Ein Skript steuert **beide** Prozesse. Es prüft vor dem Start des Proxys, ob `aiohttp` installiert ist, und gibt andernfalls eine klare Fehlermeldung mit dem Befehl zur Behebung aus.

Nichts startet von selbst: Nach einem Neustart oder nach einem Absturz des Panels starten Sie es wieder von Hand. Für einen Empfänger, den Sie beobachten, ist das in Ordnung — beachten Sie aber, dass der CPU-Überhitzungsschutz im Panel läuft: Solange das Panel unten ist, schützt nichts die Maschine (siehe [THERMAL_GUARD.md](THERMAL_GUARD.md)).

### Methode B — systemd-Units (Start beim Booten, Neustart nach Absturz)

Das Repository liefert zwei fertige Units mit, `phantomsdr-admin.service` und `phantomsdr-proxy.service`. Passen Sie in beiden `User=` und die Pfade an, dann:

```bash
sudo cp phantomsdr-admin.service phantomsdr-proxy.service /etc/systemd/system/
sudo systemctl daemon-reload
./manage_admin.sh stop        # free the ports first
sudo systemctl enable --now phantomsdr-admin
sudo systemctl enable --now phantomsdr-proxy
```

Die täglichen Befehle lauten dann:

```bash
sudo systemctl start   phantomsdr-admin
sudo systemctl stop    phantomsdr-admin
sudo systemctl restart phantomsdr-admin
systemctl status       phantomsdr-admin
sudo journalctl -u phantomsdr-admin -f
```

Dieselben vier mit `phantomsdr-proxy`, oder beides zugleich: `sudo systemctl restart phantomsdr-admin phantomsdr-proxy`.

`admin.log` und `proxy.log` funktionieren genau wie bisher — die Units hängen an dieselben Dateien an.

Eines sollten Sie einmalig tun: die tmpfiles-Regel aus `tmpfiles/phantomsdr-logs.conf` installieren (zuvor Pfade und Benutzer anpassen). systemd legt diese beiden Logs als `root` an, bevor es auf `User=` wechselt, und der Knopf **Clear Logs** des Panels scheitert dann mit `Permission denied` — siehe unten „Clear Logs meldet Permission denied“. `setup_admin.sh` installiert die Regel für Sie.

Die Admin-Unit enthält `SupplementaryGroups=cpufreq`. Das erlaubt der Throttle-Stufe des Thermal Guard, den CPU-Takt zu senken, ohne dass das Panel als root läuft. Legen Sie diese Gruppe zuerst mit `./setup-cpufreq-perms.sh` an, sonst weigert sich systemd, die Unit zu starten; löschen Sie die Zeile, wenn Sie die Throttle-Stufe nicht nutzen.

Zurück zu Methode A:

```bash
sudo systemctl disable --now phantomsdr-admin
sudo systemctl disable --now phantomsdr-proxy
```

> ⚠️ **Mischen Sie die beiden nicht.** Bei aktivierten Units wird `./manage_admin.sh stop` fünf Sekunden später von systemd rückgängig gemacht, und `./manage_admin.sh start` liefert Ihnen eine zweite, unverwaltete Kopie, die mit der von systemd um denselben Port streitet. (`restart` wurde genau deshalb aus dem Skript entfernt; es gibt jetzt einen Fehler aus und verweist auf `systemctl`.) `./manage_admin.sh status` liest nur und bleibt in beiden Fällen nützlich.

### Panel neu starten

Im weiteren Verlauf dieses Dokuments steht an mehreren Stellen „Panel neu starten“. Gemeint ist je nach Methode:

```bash
# Methode B — systemd-Units (die normale Einrichtung)
sudo systemctl restart phantomsdr-admin phantomsdr-proxy

# Methode A — keine Units installiert
./manage_admin.sh stop && ./manage_admin.sh start
```

Die Unit bringt `KillMode=process` mit, und diese Zeile trägt Gewicht. Wenn Sie den SDR aus dem Panel starten, ist der Empfänger ein Kindprozess der Admin-Unit und erbt deren cgroup. Mit systemds Standard `KillMode=control-group` würde ein Neustart des Panels spectrumserver, seinen Watchdog und den Autorun-Dienst mitnehmen — und vorher die vollen 90 Sekunden Stop-Timeout blockieren. Mit `KillMode=process` signalisiert systemd nur dem Panel selbst, sodass `sudo systemctl restart phantomsdr-admin` einen belegten Empfänger auf Sendung lässt.

**Eine vor v4.1.0 installierte Unit nachrüsten.** Ältere Unit-Dateien haben diese Zeile nicht, und ein Neustart des Panels fügt sie nicht hinzu: `systemctl restart` startet das Programm neu, ändert aber nicht dessen Konfiguration. Bearbeiten Sie die *installierte* Kopie — die Datei im Repository ist nur eine Vorlage, die systemd nie liest:

```bash
sudo nano /etc/systemd/system/phantomsdr-admin.service
```

Ergänzen Sie `KillMode=process` im Abschnitt `[Service]`, neben `Restart=always`. Danach systemd die Datei neu einlesen lassen und prüfen:

```bash
sudo systemctl daemon-reload
systemctl show phantomsdr-admin -p KillMode
```

Der zweite Befehl muss `KillMode=process` ausgeben. Steht dort weiterhin `control-group`, arbeitet systemd noch mit seiner zwischengespeicherten Kopie — `systemctl show phantomsdr-admin -p NeedDaemonReload` meldet `yes`, solange ein Reload aussteht. Führende Leerzeichen werden in Unit-Dateien ignoriert, die Einrückung spielt also keine Rolle.

---

## Schritt 4 — Firewall-Port öffnen

Öffnen Sie in Ihrer Firewall nur den **öffentlichen Proxy-Port**. Der interne Port des Admin-Panels muss nicht nach außen freigegeben werden:

```bash
sudo ufw allow <proxy_port>
```

---

## Schritt 5 — Kick-Funktion

Die Seite Users zeigt jeden aktuell verbundenen Hörer. Jede Zeile nennt die IP des Nutzers, die eingestellte Frequenz, die Betriebsart und die Verbindungsdauer. Um einen Nutzer zu trennen, klicken Sie in seiner Zeile auf **⚡ Kick** — nur diese eine TCP-Verbindung wird beendet. Alle anderen Hörer bleiben verbunden und bemerken nichts.

Der Kick ist sofort und punktgenau: Der Server startet nicht neu, für niemanden sonst wird der Ton unterbrochen, und der getrennte Nutzer kann sich sofort wieder verbinden (die Funktion dient dem Entfernen störender oder hängender Verbindungen, nicht dem Sperren).

Intern nutzt der Kick `ss -K dst <IP> dport <port>`, um den betreffenden TCP-Socket abzubauen. Das erfordert eine Linux-Fähigkeit, die das Einrichtungsskript automatisch gewährt. Falls Sie die Einrichtung übersprungen haben oder die Schaltfläche einen Fehler meldet, setzen Sie sie manuell:

```bash
sudo setcap cap_net_admin+ep $(which ss)
# Verify:
getcap $(which ss)    # should show: cap_net_admin=ep
```

---

## Konfiguration — admin_config.json

Die gesamte Laufzeitkonfiguration liegt in `admin_config.json` in Ihrem PhantomSDR-Plus-Verzeichnis. `setup_admin.sh` schreibt die Erstfassung; spätere Änderungen sind über die Seite Settings oder durch direktes Bearbeiten der Datei möglich.

Wichtige von `setup_admin.sh` geschriebene Felder:

| Schlüssel | Beschreibung |
|---|---|
| `port` | Interner Port des Admin-Panels (`admin_server.py` bindet hier) |
| `public_port` | Spectrumserver-Port (von der Seite Users genutzt, um `/users` abzufragen) |
| `proxy_port` | Öffentlicher Port, auf dem der Proxy lauscht |
| `sdr_host` | Host, über den der Proxy spectrumserver erreicht — `127.0.0.1` (siehe unten) |
| `password_hash` | SHA-256-Hash des Admin-Passworts |
| `sdr_base_dir` | Pfad zu Ihrer PhantomSDR-Plus-Installation |
| `sdr_process_name` | Zu überwachender Prozessname (Standard: `spectrumserver`) |
| `start_script` / `stop_script` | Skripte, mit denen das Panel den SDR-Server startet und stoppt — über sie handelt auch der thermische Schutz |

Schlüssel des thermischen Schutzes (alle optional — das Panel schreibt sie beim Speichern der Thermal-Guard-Einstellungen; fehlende Schlüssel verwenden diese Standardwerte):

| Schlüssel | Standard | Beschreibung |
|---|---|---|
| `thermal_enabled` | `true` | Hauptschalter des Schutzes |
| `thermal_mode` | `"log"` | `log` (nur aufzeichnen, nie handeln) · `throttle` · `stop` · `stop+restart` |
| `thermal_warn` | `null` | Warntemperatur °C; `null` = aus dem kritischen Grenzwert Ihrer CPU ableiten |
| `thermal_throttle` | `null` | Temperatur, ab der der CPU-Takt gesenkt wird; `null` = automatisch |
| `thermal_stop` | `null` | Temperatur, ab der der Server gestoppt wird; `null` = automatisch |
| `thermal_resume` | `null` | Temperatur, die zur Erholung unterschritten werden muss; `null` = automatisch |
| `thermal_sustain_s` | `60` | Sekunden, die die Stopp-Temperatur gehalten werden muss |
| `thermal_warn_sustain_s` | `30` | Sekunden, die die Warn-/Throttle-Temperatur gehalten werden muss |
| `thermal_resume_s` | `300` | Sekunden unterhalb der Erholungstemperatur, bevor die Sperre aufgehoben wird |
| `thermal_max_stops_hour` | `2` | Thermische Stopps pro Stunde, bevor der automatische Neustart deaktiviert wird |
| `thermal_test_temp` | `null` | Fiktive Temperatur zum Testen; `null` = echten Sensor verwenden |

Änderungen daran greifen bei der nächsten Messung — innerhalb weniger Sekunden, ohne Neustart.

Um Ports nach der Ersteinrichtung zu ändern, bearbeiten Sie `admin_config.json` und starten neu:

```bash
sudo systemctl restart phantomsdr-admin phantomsdr-proxy   # B
./manage_admin.sh stop && ./manage_admin.sh start        # A
```

---

## Die Einstellung `sdr_host`

`proxy.py` verbindet sich mit `spectrumserver` über Loopback — `sdr_host` ist `127.0.0.1` in `admin_config.json`, dort von `setup_admin.sh` eingetragen. Sie sollten daran nichts ändern müssen.

Setzen Sie den Wert nur dann auf eine echte Adresse, wenn `spectrumserver` auf einer **anderen Maschine** läuft als der Proxy. Starten Sie danach das [Panel neu starten](#panel-neu-starten) neu.

> **Geändert:** Frühere Versionen verlangten für `sdr_host` die LAN-IP der Maschine, weil `spectrumserver` WebSockets von der Loopback-Adresse schloss. Dieser Filter wurde entfernt, lokale Verbindungen funktionieren jetzt normal. Zwei Folgen: Der Aufruf von `http://localhost:<port>` auf der Server-Maschine selbst zeigt nun die vollständige Oberfläche (früher lud die Seite, blieb aber leer), und der Proxy fällt nicht mehr aus, wenn DHCP der Maschine eine neue IP zuweist. Wenn Sie aktualisieren und in Ihrer `admin_config.json` noch eine LAN-IP steht, ändern Sie sie auf `127.0.0.1` oder führen Sie `setup_admin.sh` erneut aus.

---

## proxy.py — was es ist und wann Sie es brauchen

`proxy.py` legt sowohl den SDR-Server als auch das Admin-Panel auf einen **einzigen öffentlichen Port** und leitet nach Pfadpräfix weiter:

| Pfad | Weitergeleitet an |
|---|---|
| `/admin*` | Admin-Panel (`localhost:<port>`) |
| Alles andere | Spectrumserver (`<sdr_host>:<public_port>`) |

Ohne den Proxy müssen Sie zwei Ports getrennt freigeben. Mit ihm geben Sie nur einen frei.

Der Proxy hebt außerdem die 4-MB-Grenze für WebSocket-Nachrichten auf (wichtig für große FFT-Rahmen des RX-888 bei 60 MSPS), leitet die echten Client-IPs über `X-Forwarded-*`-Header weiter und hält langlebige Verbindungen mit einem 30-Sekunden-Heartbeat durch NAT hindurch am Leben.

---

## Ports nach der Einrichtung ändern

Bearbeiten Sie `admin_config.json` direkt:

```json
{
  "port":        3000,
  "public_port": 9001,
  "proxy_port":  9002,
  "sdr_host":    "127.0.0.1"
}
```

Starten Sie dann beide Dienste neu:

```bash
sudo systemctl restart phantomsdr-admin phantomsdr-proxy   # B
./manage_admin.sh stop && ./manage_admin.sh start        # A
```

Wenn `admin_server.py` beim Start zusätzlich an einen anderen Port binden soll (z. B. beim systemd-Dienst), können Sie das per Umgebungsvariable überschreiben:

```bash
ADMIN_PORT=3000 python3 admin_server.py
```

Standardmäßig bindet `admin_server.py` nur an `127.0.0.1`. Um es eigenständig ohne Proxy zu betreiben (Entwicklung/Test), binden Sie an alle Schnittstellen:

```bash
ADMIN_BIND=0.0.0.0 python3 admin_server.py
```

---

## Nützliche manuelle Befehle

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

## Protokolldateien

| Datei | Inhalt |
|---|---|
| `admin.log` | Ausgabe des Admin-Panels |
| `proxy.log` | Startbanner des Proxys + eine Zugriffszeile je weitergeleiteter Anfrage |
| `logwebsdr.txt` | Log von Startskript und Watchdog — Start/Stopp, Empfängertreiber, Registrierung bei websdr.org |
| `spectrumserver.log` | Die Ausgabe des Empfängerprozesses selbst — FFT- und OpenCL-Einrichtung, Verbindungen einzelner Clients, Fehler. Die größte dieser Dateien; sie wird rotiert, daher kann `spectrumserver.log.1` daneben liegen |
| `rade.log` | Protokoll des RADE-/FreeDV-Sidecars |
| `autorun.log` | Protokoll des Decoder-Daemons — Spots, SNR, Drift |
| `crash.log` | Absturzberichte und thermische Ereignisse: `[CRASH]`-/`[TERMINATE]`-Backtraces, `[EXIT]`-Notizen und `[THERMAL]`-Zeilen des Schutzes. **Normalerweise leer** — was darin steht, lohnt sich zu lesen |

Alle sind über die Reiter der **Log Viewer** im Panel lesbar (LOGWEBSDR, SPECTRUMSERVER, ADMIN, RADE, CRASH, AUTORUN, PROXY). Der Viewer zeigt die letzten 150 Zeilen des gewählten Reiters und aktualisiert bei eingeschalteter Auto-Aktualisierung alle 3 Sekunden; er liest nur das Ende der Datei, deren Größe spielt also keine Rolle.

### proxy.log und admin.log rotieren

`proxy.log` verzeichnet jede weitergeleitete Anfrage und `admin.log` jede Anfrage, die das Panel selbst erreicht. Keine von beiden wird standardmäßig rotiert. Früher dominierten die Abfragen des Dashboards beide Dateien — `/admin/api/status` läuft alle ~3 Sekunden, solange ein Tab offen ist —, doch diese Abfragen werden inzwischen aus beiden Protokollen herausgefiltert (siehe unten); die Rotation begrenzt daher langsames Wachstum statt einer Flut.

Das Repository liefert eine logrotate-Konfiguration unter `logrotate/phantomsdr` (täglich, oder früher, wenn ein Protokoll 10 MB überschreitet; behält 7 gzip-Archive in `logproxy/`, damit sie das Projektwurzelverzeichnis nicht zumüllen). **Sie ist standortspezifisch — öffnen Sie sie und passen Sie die drei Protokollpfade, den `olddir`-Pfad und den `su`-Benutzer an Ihre Maschine an, bevor Sie sie installieren**, dann:

```bash
sudo cp logrotate/phantomsdr /etc/logrotate.d/phantomsdr
sudo logrotate -d /etc/logrotate.d/phantomsdr     # dry run, should list all three logs
```

`logrotate/phantomsdr` im Repository und `/etc/logrotate.d/phantomsdr` sind zwei **unabhängige Kopien** — `cp` verknüpft sie nicht. Änderungen an der Repository-Datei wirken sich auf einem laufenden System erst aus, wenn Sie das obige `sudo cp` erneut ausführen. Nur die Kopie in `/etc` liest logrotate tatsächlich.

Die Konfiguration verwendet `copytruncate`, was zwingend nötig ist: `manage_admin.sh` startet beide Prozesse mit `>> <log>`, und keiner öffnet seine Standardausgabe erneut; eine Rotation per Umbenennung ließe sie also weiter in die rotierte Datei schreiben, während das neue Protokoll für immer leer bliebe.

Archive landen in `logproxy/` (von `createolddir` automatisch angelegt) und heißen `proxy.log.1.gz` … `proxy.log.7.gz`, das neueste zuerst. Lesen Sie eines mit `zcat logproxy/proxy.log.1.gz | less` oder durchsuchen Sie alle auf einmal mit `zgrep "pattern" logproxy/*.gz`.

Die Schaltfläche **Clear Logs** des Panels leert **jede** Datei der obigen Tabelle, `autorun.log` und `proxy.log` eingeschlossen (`CLEAR_EXCLUDE` in `admin_server.py` ist leer). Beachten Sie, was das bei `autorun.log` kostet: Seine Dekodier-Historie ist der einzige Nachweis, was wann gehört wurde, und sie lässt sich nicht rekonstruieren — erhalten bleibt nur, was logrotate bereits nach `logproxy/` rotiert hat, ein Leeren verwirft also alles seit der letzten Rotation Dekodierte. Das Leeren bei laufendem Dekoder ist unbedenklich: Der Daemon hält die Datei mit `O_APPEND` offen und schreibt weiter in denselben Inode. Die Meldung nennt, was geleert wurde, und falls eine Datei nicht beschreibbar war — etwa ein `proxy.log`, das bei getrennten Benutzern einem anderen Benutzer gehört — nennt sie diese Datei und den Fehler, statt Erfolg zu melden, und lässt die Anzeige dieses Protokolls stehen, statt sie zu leeren. Die Dateien werden an Ort und Stelle geleert, nie gelöscht: Sowohl `manage_admin.sh` als auch die systemd-Units öffnen sie mit `O_APPEND`, sodass eine gelöschte Datei bis zum Neustart des Dienstes weiter einen unsichtbaren Inode füllen würde.

Erfolgreiche Abfragen werden aus **beiden** Zugriffsprotokollen herausgefiltert, vom `QuietPollFilter` in `proxy.py` und dem in `admin_server.py`. Das Dashboard ruft `/admin/api/status` alle 3 Sekunden auf sowie `/admin/api/logs`, `/admin/api/autorun/status`, `/admin/api/users`, `/admin/api/graph-stats` und `/admin/api/chat` alle 5 Sekunden; ungefiltert wären das ~95 % beider Dateien. Nur einfache `200`er auf diesen Pfaden entfallen — jeder andere Status, Pfad oder jede andere Methode wird wie bisher protokolliert, sodass eine fehlschlagende Abfrage sichtbar bleibt und zustandsändernde Aktionen (`kick`, `autorun/start`, …) über eigene Pfade laufen und stets aufgezeichnet werden. Die eine bewusste Ausnahme ist `/admin/api/logs/clear`, gefiltert in beiden Dateien: Seine eigene Zugriffszeile wird *nach* dem Leeren geschrieben, sodass ohne den Filter jedes erfolgreiche Leeren eine frische Zeile in genau der Datei hinterließ, die es gerade geleert hatte — und die Schaltfläche wirkte defekt.

Da `proxy.log` ein Zugriffsprotokoll ist, enthält es Besucher-IP-Adressen und User-Agent- Zeichenketten — denken Sie daran, bevor Sie es bei einer Hilfeanfrage weitergeben.

### „Clear Logs“ meldet Permission denied

Auf einer Maschine, auf der die systemd-Units in einem frischen Verzeichnisbaum installiert wurden, kann der Knopf Folgendes zurückgeben:

```
✗ Could not clear admin.log ([Errno 13] Permission denied: /home/you/PhantomSDR-Plus/admin.log),
  proxy.log ([Errno 13] Permission denied: /home/you/PhantomSDR-Plus/proxy.log)
```

Es sind immer diese beiden Dateien und nie die anderen fünf, denn nur sie werden von systemd selbst angelegt. `StandardOutput=append:` wird von PID 1 geöffnet, **bevor** auf `User=` gewechselt wird; eine noch nicht vorhandene Logdatei entsteht daher als `root:root 0644`. Das Panel läuft als Ihr Benutzer und kann sie nicht leeren. Die anderen fünf Logs legen die Startskripte an, die ohnehin als Ihr Benutzer laufen, also lassen sie sich normal leeren. Wo die beiden Dateien älter sind als die Units — `manage_admin.sh` hat sie mit `>>` erzeugt —, gehören sie bereits dem richtigen Benutzer und der Knopf funktioniert; deshalb tritt das Problem nur bei einer Neuinstallation auf, die direkt mit systemd begonnen hat.

Prüfen Sie es mit `ls -l admin.log proxy.log`: die fehlschlagenden zeigen `root root`. Reparieren Sie sie:

```bash
sudo chown "$(id -un):$(id -gn)" admin.log proxy.log
sudo chmod 664 admin.log proxy.log
```

Ein Neustart ist nicht nötig — systemd schreibt weiter über den bereits geöffneten Dateideskriptor, und Anhängen ändert die Eigentümerschaft nicht. Drücken Sie **Clear Logs** erneut, und beide werden geleert.

**Löschen Sie die Dateien nicht stattdessen.** Beide sind mit `O_APPEND` geöffnet; wird eine entfernt, füllt systemd bis zum nächsten Dienstneustart einen unsichtbaren Inode, und die neu entstehende Datei gehört wieder root.

Damit es nicht wiederkommt, installieren Sie die tmpfiles-Regel aus dem Repository: `tmpfiles/phantomsdr-logs.conf`. Sie legt beide Logs bei jedem Bootvorgang mit dem richtigen Eigentümer an, bevor die Units starten, sodass eine entfernte Datei — manuelles Aufräumen, Neuinstallation, verschobenes Installationsverzeichnis — nie wieder root-eigen zurückkehrt. **Sie ist maschinenspezifisch: Öffnen Sie sie und passen Sie zuerst die beiden Pfade und user:group an**, dann:

```bash
sudo cp tmpfiles/phantomsdr-logs.conf /etc/tmpfiles.d/99-phantomsdr-logs.conf
sudo systemd-tmpfiles --create /etc/tmpfiles.d/99-phantomsdr-logs.conf
```

Wie bei `logrotate/phantomsdr` sind die Repo-Datei und die Kopie unter `/etc` unabhängig voneinander — das Bearbeiten der Repo-Kopie ändert nichts, bis Sie das `cp` erneut ausführen. Ab systemd 254 repariert die Regel auch Eigentümer und Modus einer bereits vorhandenen Datei, behebt also den aktuellen Fehler mit; bei älteren Versionen ist das `chown` oben das, was den Knopf freischaltet.

`setup_admin.sh` erledigt all das beim Installieren der Units, eine mit dem Skript erstellte Einrichtung trifft dieses Problem also nie. Die Schritte oben gelten für ein von Hand installiertes Paar oder für eine Installation, die älter ist als der Log-Eigentümerschritt des Skripts.

Logrotate bringt das Problem nicht zurück: die mitgelieferte Konfiguration nutzt `copytruncate`, was denselben Inode und damit denselben Eigentümer beibehält.

---

## Zugriffsübersicht

| Aufbau | SDR | Admin-Panel |
|---|---|---|
| Ohne Proxy | `http://YOUR_IP:<public_port>` | `http://YOUR_IP:<port>/admin` |
| Mit Proxy | `http://YOUR_IP:<proxy_port>` | `http://YOUR_IP:<proxy_port>/admin` |

---

## Löschen von Chatnachrichten

Die Seite Chat History listet jede Nachricht des aktuellen Chatprotokolls auf. Jeder Eintrag hat eine Schaltfläche **🗑 Delete**, die genau diese eine Nachricht sofort aus dem Protokoll entfernt — ohne Serverneustart.

So funktioniert es:

- Das Admin-Panel schreibt die Chatprotokolldatei an Ort und Stelle neu und entfernt dabei nur die Zeile der gewählten Nachricht.
- Die Änderung wirkt für jeden Nutzer, der den Chat neu lädt; bereits geladener Chatverlauf in offenen Browser-Tabs wird nicht rückwirkend aktualisiert.
- Das Leeren des gesamten Protokolls (Schaltfläche **Clear All**) kürzt die Datei, was ebenfalls ohne Neustart wirkt.

Die Löschschaltfläche wird in allen fünf Svelte-App-Varianten einheitlich dargestellt. Scheint eine Löschung nicht zu wirken, prüfen Sie, ob das Admin-Panel Schreibrechte auf die Chatprotokolldatei hat:

```bash
ls -l ~/PhantomSDR-Plus/chat.jsonl   # path depends on your config
```

---

## Wasserfall-Rundnachrichten

Das Panel **Waterfall Message** erlaubt es, ein dauerhaftes Textbanner in die Wasserfallanzeige jedes verbundenen Nutzers zu schieben, ohne den Serverprozess anzufassen.

### Eine Nachricht senden

1. Öffnen Sie das Admin-Panel und gehen Sie zu **Waterfall Message**.
2. Geben Sie Ihren Nachrichtentext ein und wählen Sie eine Farbe (hexadezimal, z. B. `#ffdd00`).
3. Klicken Sie auf **Send** — die Nachricht erscheint sofort in allen aktiven Wasserfallansichten.

### Die Nachricht löschen

Klicken Sie auf **Clear**, um das Banner aus allen Wasserfällen zu entfernen. Der Nachrichtenzustand wird vom Admin-Panel im Speicher gehalten; er wird automatisch gelöscht, wenn der Panel-Prozess neu startet.

### Funktionsweise

Das Admin-Panel stellt zwei interne Endpunkte bereit, die der Proxy weiterleitet:

| Endpunkt | Methode | Zweck |
|---|---|---|
| `/admin/api/waterfall-message` | `POST` | Aktuellen Bannertext und -farbe setzen oder löschen |
| `/admin/api/waterfall-message` | `GET` | Aktuellen Nachrichtenzustand als JSON zurückgeben |

Das Frontend fragt den Nachrichtenzustand ab und rendert ihn als Overlay auf der Wasserfall-Zeichenfläche. Auf Clientseite ist weder eine WebSocket-Neuverbindung noch ein Neuladen der Seite nötig.

### Typische Anwendungen

- Geplante Wartung ankündigen: `"Server restart in 10 minutes"`
- Bandbedingungen melden: `"Solar flux 180 — 10m wide open"`
- Begrüßung: `"Welcome to SV1BTL WebSDR — Athens, KM17"`

---

## Systemgraphen

Die Seite **Graphen** zeichnet vier Messgrößen auf einer gemeinsamen Zeitachse:

- **CPU-Frequenz** — mittlerer Takt über alle Kerne, in GHz
- **CPU-Last** — Gesamtauslastung in Prozent
- **CPU-Temperatur** — in °C, mit gestrichelten Marken bei 70 °C (warm) und 80 °C (kritisch)
- **Nutzer online** — zu diesem Zeitpunkt mit dem WebSDR verbundene Hörer

Der Zeitraum wird mit **15 MIN / 1 HOUR / 4 HOURS / 12 HOURS / 24 HOURS** gewählt. Beim Überfahren mit der Maus erscheint ein Fadenkreuz mit allen vier Werten dieses Moments. Die vier Karten über dem Diagramm zeigen immer den neuesten Messwert.

### Wie abgetastet wird

Ein Hintergrund-Thread in `admin_server.py` nimmt alle **2 Sekunden** einen Messwert. Die Werte liegen in zwei Stufen: die letzte **Stunde** in voller 2-Sekunden-Auflösung (1800 Punkte) und **24 Stunden** als 30-Sekunden-Mittelwerte (2880 Punkte) für die langen Zeiträume. Die Seite wählt die Stufe, die den gewählten Zeitraum abdeckt, und schreibt `30s averages` in die Kopfzeile, wenn die gemittelte Stufe angezeigt wird.

Ein ganzer Tag in 2-Sekunden-Auflösung wären ~43000 Punkte — zig MB Speicher, eine mehrere Megabyte große erste Übertragung und rund 40 Punkte je Bildpunkt, was kein Bildschirm darstellen kann. Die Mittelung auf 30 Sekunden hält einen Tag in 2880 Punkten.

Die Abtastung startet zusammen mit dem Admin-Panel, nicht erst beim Öffnen der Seite — die Seite zeigt also sofort bereits vorhandene Historie.

Der Puffer liegt **nur im Speicher**: nichts wird auf die Festplatte geschrieben, und die Historie geht beim Neustart des Admin-Panels verloren. Das ist Absicht — so bleibt die Funktion aus der Logrotation und von der Platte.

2 Sekunden ergeben eine nahezu Echtzeit-Ansicht und sind kurz genug, um die CPU-Frequenz nicht zu verfälschen: sie springt bei modernen CPUs von einem Messwert zum nächsten zwischen Leerlauf- und Turbotakt. Ein Messwert kostet etwa eine Millisekunde, der Sampler fällt neben dem SDR-Server also nicht ins Gewicht. Die Seite fragt im Takt der jeweiligen Stufe ab — alle 2 Sekunden bei den Live-Zeiträumen, alle 30 Sekunden bei den gemittelten, denn häufigeres Abfragen liefert nur leere Antworten.

Um Takt oder Vorhaltezeit zu ändern, passen Sie diese Konstanten am Anfang des Sampler-Blocks in `admin_server.py` an und starten Sie neu:

```python
GRAPH_INTERVAL_S   = 2          # Sekunden zwischen den feinen Messwerten
GRAPH_FINE_S       = 3600       # Reichweite der feinen Stufe (1 h)
GRAPH_COARSE_EVERY = 15         # feine Messwerte je grobem Punkt (15 x 2 s = 30 s)
GRAPH_COARSE_S     = 24 * 3600  # Reichweite der groben Stufe (24 h)
```

### Woher die Werte stammen

| Messgröße | Quelle |
|---|---|
| CPU-Frequenz | `psutil.cpu_freq()`, ersatzweise `/sys/devices/system/cpu/cpu*/cpufreq/`. Das sind dieselben Kerneldaten, die `cpufreq-info` aufbereitet — **cpufrequtils wird nicht benötigt**. |
| CPU-Last | `psutil.cpu_percent()` |
| CPU-Temperatur | `psutil.sensors_temperatures()`, ersatzweise `/sys/class/thermal`, dann der Befehl `sensors` |
| Nutzer online | Der `/users`-Endpunkt von spectrumserver selbst — die maßgebliche Sitzungsliste. Ein Zählen der Sockets mit `ss` sieht hinter proxy.py keine echten Client-IPs. |

Ist eine Messgröße auf Ihrem Rechner nicht verfügbar, sagt das betreffende Feld das, statt eine Nulllinie zu zeichnen. Ein fehlgeschlagener Messwert unterbricht die Linie, damit eine Lücke nie wie ein gemessener Wert aussieht.

### Warum vier Felder und nicht ein Diagramm

GHz, Prozent, Grad und eine Personenzahl haben keine gemeinsame Skala. In einem Diagramm bräuchte man mehrere y-Achsen, und die dabei entstehenden Schnittpunkte sind Artefakte der Skalierung, keine Aussagen über den Server. Vier gestapelte Felder auf einer Zeitachse halten den Vergleich ehrlich. Jedes Feld beginnt bei null, damit die Kurvenhöhe proportional zum Wert bleibt.

Farbe ist der Temperatur vorbehalten, wo Bernstein und Rot die oben genannten Schwellen markieren. Die übrigen Felder teilen sich eine Farbe, weil jedes nur eine Messreihe enthält, die sein Titel bereits benennt.

### Endpunkt

`GET /admin/api/graph-stats?since=<epoch>` (Anmeldung erforderlich) liefert die Messwerte neuer als `since`, sodass die Seite inkrementell abfragt, statt bei jedem Takt den gesamten Puffer neu zu laden.

---

## Thermal Guard

> 📖 **Vollständiges Handbuch: [THERMAL_GUARD.md](THERMAL_GUARD.md)** — die vier Modi und was ein Sysop bei jedem tun muss, Betrieb ohne Panel, die Throttle-Stufe ohne root, Testen und Fehlersuche.

Stoppt den SDR-Server, wenn die CPU gefährlich heiß wird, und startet ihn wieder, sobald sie abgekühlt ist. Er gehört zum Panel — nichts zusätzlich zu installieren — und erscheint als Karte **THERMAL GUARD** im Dashboard, mit seinen Einstellungen unter **Einstellungen**.

Ausgeliefert wird er **untätig**: Der Modus beginnt bei `log`, er zeichnet also zunächst nur auf, was er *getan hätte*. Nichts rührt Ihren Server an, bis Sie den Modus ändern.

### Er funktioniert mit jeder Start-/Stopp-Methode

Der Schutz versucht nie herauszufinden, was Ihren Server überwacht. Er handelt über die Skripte, die Sie unter **Default start script** und **Default stop script** eingestellt haben, und solange die CPU überhitzt ist, wiederholt er den Stopp bei **jeder Prüfung** (alle 2 Sekunden). Alles, was den Server zurückbringt — der Watchdog in `start-*.sh`, eine systemd-Unit, ein Cron-Job, eine `tmux`-Sitzung — wird binnen weniger Sekunden rückgängig gemacht, bis die Maschine abgekühlt ist. Das ist die *Sperre* (Lockout).

Ist kein Stopp-Skript konfiguriert, sendet er `SIGTERM` an den in `sdr_process_name` genannten Prozess und nach 10 Sekunden Karenz `SIGKILL`.

### Die Schwellen stammen aus Ihrer eigenen CPU

Statt einer festen Zahl, die auf den meisten Rechnern falsch wäre, liest der Schutz den kritischen Grenzwert, den der Kernel für Ihre CPU veröffentlicht, und rechnet von dort zurück:

| Ihre CPU meldet | Warnung | Throttle | Stopp | Erholung |
|---|---|---|---|---|
| Intel, Grenze 100 °C | 88 | 92 | **95** | 75 |
| AMD Ryzen, Grenze 95 °C | 83 | 87 | **90** | 70 |
| Raspberry Pi, Grenze 85 °C | 73 | 77 | **80** | 60 |

Das ist wichtig: Feste 95 °C sind auf einer Intel-CPU beinahe normal, auf einem Ryzen — dessen Tctl unter Boost konstruktionsbedingt bei 95 °C liegt — würden sie den Server auf einer gesunden Maschine stoppen, und auf einem Pi, der bei 80 °C drosselt, würden sie nie auslösen. Jede Schwelle lässt sich in den Einstellungen von Hand setzen; ein leeres Feld bedeutet *automatisch*.

So sehen Sie, wie Ihre Maschine dem Schutz erscheint:

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

### Die vier Stufen

Den Server zu stoppen ist das letzte Mittel, nicht das einzige:

1. **warn** — wird protokolliert, sonst nichts.
2. **throttle** — senkt die CPU-Taktobergrenze um 20 %. Erfordert einen cpufreq-Treiber *und* Schreibrechte auf `scaling_max_freq`, also in der Regel root; wo das fehlt (der Normalfall für ein Panel ohne Privilegien und auf den meisten VPS), **deaktiviert sich die Stufe selbst** und der Schutz geht von warn direkt zu stop. `./setup-cpufreq-perms.sh` erteilt diese Schreibrechte einer Gruppe `cpufreq`, sodass die Stufe ohne root funktioniert — siehe [THERMAL_GUARD.md](THERMAL_GUARD.md#8-die-throttle-stufe-ohne-root-aktivieren).
3. **stop** — führt Ihr Stopp-Skript aus und hält den Server unten (siehe Sperre).
4. **resume** — nachdem die CPU `thermal_resume_s` lang (standardmäßig 5 Minuten) unter der Erholungstemperatur geblieben ist, wird die Taktgrenze wiederhergestellt und im Modus `stop+restart` Ihr Start-Skript erneut ausgeführt.

Jede Stufe muss ihre Haltezeit **durchhalten** — 30 s für warn und throttle, 60 s für stop —, damit eine kurze Spitze beim Kompilieren nie auslöst.

Wiederholte Auslösungen begrenzt `thermal_max_stops_hour` (Standard 2). Danach wird der *automatische Neustart* deaktiviert, während der Schutz weiterarbeitet, damit eine überhitzende Maschine nicht zwischen Laufen und Gestopptsein pendelt.

### Welche Sensoren verwendet werden

Nur echte CPU-Die-Sensoren: `coretemp` (Intel), `k10temp` / `zenpower` (AMD), `cpu_thermal` / `soc_thermal` (ARM, Raspberry Pi). Verwendet wird der höchste Wert des Chips, nicht der Durchschnitt.

`acpitz` und unbeschriftete Thermal Zones werden **bewusst ignoriert** — sie melden oft eine Gehäuse- oder Platinentemperatur, die zig Grad unter der tatsächlichen CPU liegt; ein Schutz, der ihnen vertraut, würde nie auslösen, wenn es darauf ankommt. Hat Ihre Maschine keinen brauchbaren Sensor (häufig auf einem VPS oder in einem Container), sagt die Karte das offen (`no trusted CPU sensor`), statt Schutz vorzutäuschen.

### Was er schreibt

Alles landet in `crash.log`, also im Reiter **CRASH** des Log Viewers, ein Ereignis pro Zeile:

```
[THERMAL] warn: 89.0C (warn=88.0 crit=100.0) sustained 31s
[THERMAL] throttle: 93.0C sustained 30s — cpufreq max lowered 20%
[THERMAL] STOPPED server: 96.0C sustained 62s (stop=95.0 crit=100.0) — Started stop-websdr.sh
[THERMAL] lockout: process reappeared at 94.0C — re-stopped [3 time(s) so far]
[THERMAL] recovered: 74.0C held below 75.0 — lockout cleared
[THERMAL] auto-restart: Started start-rx888mk2.sh
```

Die Sperr-Zeile wird auf eine pro Minute begrenzt, damit ein Supervisor, der sich dauernd wehrt, das Log nicht überschwemmt.

### Testen, bevor Sie ihm vertrauen

Setzen Sie **TEST TEMPERATURE** in den Einstellungen auf einen Wert oberhalb Ihrer Stopp-Schwelle. Der Schutz behandelt ihn wie eine echte Messung, sodass der ganze Weg — warn, throttle, stop, Sperre, Erholung, Neustart — auf Wunsch abläuft. Feld leeren, um zum echten Sensor zurückzukehren.

> Führen Sie diesen Test im Modus `stop` durch, wird der Server tatsächlich gestoppt und Ihre Hörer werden getrennt. Machen Sie das, wenn niemand zuhört, oder lassen Sie den Modus auf `log`, wo der Test zeigt, was passiert *wäre*, ohne etwas anzufassen.

### Empfohlene Einführung

1. Lassen Sie den Modus eine Woche auf **`log`** und arbeiten Sie normal weiter.
2. Lesen Sie danach den CRASH-Reiter nach den harten Momenten — einem vollen Rebuild, einem heißen Nachmittag. Steht dort nichts, kam Ihre Maschine nie in die Nähe.
3. Sehen die protokollierten Temperaturen stimmig aus, stellen Sie den Modus auf **`stop`** (oder **`stop+restart`**, damit er von selbst zurückkommt).
4. Bestätigen Sie es einmal mit dem Testtemperatur-Feld und lassen Sie es dann in Ruhe.

### Eine Sperre aufheben

**CLEAR LOCKOUT** auf der Dashboard-Karte hebt Sperre und Ratenbegrenzung auf. Es entschärft den Schutz nicht: Ist die CPU weiterhin zu heiß, stoppt die nächste Prüfung den Server einfach wieder. Verwenden Sie es, nachdem Sie die Kühlung in Ordnung gebracht haben.

### Endpoint

`GET /admin/api/thermal` (Anmeldung erforderlich) liefert den vollständigen Zustand — Sensor, Schwellen, Stufe, Sperre, letztes Ereignis. Ein `POST` mit `{"action":"reset"}` entspricht der Schaltfläche CLEAR LOCKOUT.

### Ohne das Admin-Panel

`thermal_guard.py` kommt mit der Standardbibliothek aus und läuft auch allein, mit derselben `admin_config.json`:

```bash
python3 thermal_guard.py --once              # Sensor, Grenzwert und Schwellen anzeigen
python3 thermal_guard.py                     # als Dienst betreiben (nur Protokoll, bis scharfgeschaltet)
python3 thermal_guard.py --mode stop+restart # scharfschalten, ganz ohne Konfigurationsdatei
python3 thermal_guard.py --config /path/to/other.json
python3 thermal_guard.py --help
```

`--mode` überschreibt `thermal_mode` aus der Konfigurationsdatei — eine Maschine ohne Panel lässt sich also direkt aus ihrer systemd-Unit scharfschalten, ohne jedes JSON.

---

## Spot Reporting (Autorun FT8/FT4/JS8/WSPR)

Der Reiter **Spot Reporting** steuert den Autorun-Daemon (`autorun/index.js`) — einen Node.js-Prozess, der FT8/FT4/JS8/WSPR serverseitig direkt vom Empfänger dekodiert und die Spots zu den Reporting-Netzwerken hochlädt:

- **FT8 / FT4 / JS8 → PSK Reporter** (IPFIX/UDP)
- **WSPR → wsprnet.org** (HTTP)

> **JS8 wird nur mit Normal-Geschwindigkeit gespottet** — dem 15-s-Anrufzyklus, auf dem Heartbeats und CQs laufen. Die Spots stammen aus Heartbeats, Compound-Frames und gerichteten Nachrichten; Gruppenziele wie `@ALLCALL` und vom Decoder nicht aufgelöste Rufzeichen (`<....>`) werden nie gemeldet. JS8 teilt sich die PSK-Reporter-Warteschlange mit FT8 und FT4 und wird genauso getrennt gezählt.


**Das Reporting ist standardmäßig AUS.** Es wird nichts hochgeladen, bis Sie ein Ziel aktivieren und **Start** drücken. Dekodieren und Hochladen sind unabhängig voneinander: Der Daemon kann bei ausgeschaltetem Reporting dekodieren und protokollieren, sodass Sie die Aktivität prüfen können, bevor etwas öffentlich wird.

> ⚠️ Spots werden unter **Ihrem Rufzeichen** in öffentliche Netze hochgeladen. Aktivieren Sie nur Bänder/Betriebsarten, die Ihr Empfänger wirklich hört, und tragen Sie den korrekten Locator ein.

### Voraussetzungen

Der Autorun-Daemon benötigt Node.js 22+, die npm-Pakete `ws` + `cbor-x` (aufgelöst über den Symlink `autorun/node_modules` → `frontend/node_modules`) sowie `util-linux` (`taskset`). Die Installer richten all das automatisch ein — siehe den [Abschnitt Autorun-Spot-Reporter in INSTALLATION.md](INSTALLATION.md#autorun-spot-reporter-ft8ft4wspr). Schlägt **Start** fehl, ist meist dieser Symlink oder `taskset` die Ursache (siehe Fehlerbehebung unten).

### Den Reiter verwenden

1. **Identität** — Rufzeichen und Locator. Vorausgefüllt aus `frontend/site_information.json` (`siteSysop` / `siteGridSquare`, auf 6 Zeichen gekürzt); hier bei Bedarf überschreiben.
2. **Band-×-Betriebsart-Matrix** — kreuzen Sie die zu dekodierenden Kombinationen an. Zeilen sind Bänder, Spalten FT8 / FT4 / JS8 / WSPR; nicht unterstützte Felder sind deaktiviert. WSPR deckt zusätzlich die LF-/MF-Bänder (2200 m, 630 m) und einen zusätzlichen 80-m-EU-Kanal ab.
3. **Ziele** — aktivieren Sie **PSK Reporter** und/oder **wsprnet** (beide standardmäßig aus).
4. **Max slots** — eine Sicherheitsgrenze dafür, wie viele Band-/Betriebsart-Slots gleichzeitig laufen dürfen.
5. **Start / Stop** — startet/beendet den Daemon (per `taskset` an die obersten CPU-Kerne gebunden, automatisch für die Maschine gewählt — siehe *Ressourcenbedarf und Grenzen* unten). **Save** / **Reload** speichern und lesen die Konfiguration neu; **Free All** leert alle Slots.

Die Statuskarte aktualisiert sich alle 5 s und zeigt Laufzustand, Dekodier-/Uploadzähler und den letzten Uploadzeitpunkt. Ein Abzeichen **📶 REPORTING** erscheint im Hauptwasserfall, solange das Reporting aktiv ist.

> **„0 sent" in den ersten Minuten ist normal.** PSK Reporter lädt gebündelt alle **5 Minuten** hoch, wsprnet alle **2 Minuten** — Spots warten bis zum nächsten Absenden. Die Statuskarte zeigt die Anzahl der wartenden Spots und die Taktung.

### Bänder oder Modi im laufenden Betrieb ändern

**Änderungen wirken erst nach einem Neustart des Daemons.** `autorun/index.js` liest `autorun.json` genau einmal, beim Start. Es gibt keine Dateiüberwachung und kein Reload-Signal — behandelt werden nur SIGINT und SIGTERM, die beide „beenden" bedeuten. Ein laufender Daemon decodiert deshalb weiter die Slots, mit denen er gestartet wurde, ganz gleich was Sie danach speichern.

So übernehmen Sie eine Änderung:

1. Bänder und Modi an- bzw. abwählen
2. **SAVE CONFIG**
3. **STOP**
4. **START**

Oder einfach **STOP** → Auswahl ändern → **START**, denn START speichert die Konfiguration vor dem Start.

> ⚠️ **START ohne vorheriges STOP übernimmt die Änderung nicht.** START speichert die Konfiguration, dann antwortet die Start-Anfrage mit `already running` und es wird nichts neu gestartet. Sie sehen eine „gespeichert"-Meldung neben einem „already running"-Fehler, während der Daemon mit den **alten** Bändern weiterläuft — das sieht leicht nach Erfolg aus. Immer zuerst STOP.

Was ein Neustart mit den Zählern macht:

- **Die Gesamtzahlen neben den Kontrollkästchen bleiben erhalten** — sie stehen in `autorun-totals.json`, die beim Beenden nicht gelöscht wird.
- **Die Decoder-Kacheln werden auf null zurückgesetzt**, sie gelten je Lauf.
- **Nichts aus der Warteschlange geht verloren**: beim Beenden werden offene Spots noch gesendet.
- Ein **neu aktiviertes** Band beginnt bei `0`; ein **zuvor genutztes** Band setzt seine Summe fort.
- Ein **abgewähltes** Band behält seine Zahl neben dem nun leeren Kästchen; die Historie wird nicht gelöscht.

Die Decodierung pausiert nur für die wenigen Sekunden zwischen STOP und START.

### Spot-Zähler

Es werden zwei verschiedene Zählungen angezeigt, die unterschiedliche Fragen beantworten.

**SPOTS UPLOADED PER DECODER** — eine Kachel je Decoder (FT8 / FT4 / JS8 / WSPR) mit den Spots, die **seit dem letzten Start des Daemons** hochgeladen wurden, darunter die Zahl der Decodierungen und wie viele noch in der Warteschlange stehen. Stop/Start setzt diese Werte auf null zurück. Ein Decoder, dessen Ziel abgeschaltet ist, zeigt seine Decodierungen und `reporting off` statt einer nackten `0` — dort sind null Uploads eine Einstellung, kein Fehler.

**Die Zahl neben jedem Kontrollkästchen** unter BANDS & MODES ist die Zahl der **insgesamt** hochgeladenen Spots dieser Band-/Modus-Kombination. Sie steht in `autorun-totals.json` und übersteht Neustarts. Ein vorangestellter Punkt (`·123`) in Bernstein bedeutet, dass dieser Slot decodiert, aber noch nichts hochgeladen hat. Zwischen zwei Uploads ist das normal — PSK Reporter sendet alle 5 Minuten, wsprnet alle 2 —, daher stehen FT8/FT4-Zähler nach einem Start die ersten Minuten in Bernstein. Bernstein bleibt es auch, wenn das Ziel dieses Decoders abgeschaltet ist. Eine schlichte `0` ohne Punkt bedeutet, dass der Slot aktiviert ist, aber noch nichts decodiert hat — WSPR steht nach einem Start mehrere Minuten auf null, weil es im 2-Minuten-Takt läuft, während FT8 schon in die Hunderte zählt. Ein Slot, den der Daemon nie ausgeführt hat, zeigt gar nichts. Der Tooltip zeigt Uploads, Decodierungen und den Zeitpunkt des letzten Uploads.

FT8 und FT4 teilen sich eine PSK-Reporter-Warteschlange, deshalb zählt der Daemon jeden Spot beim Versand seinem eigenen Modus und Band zu; die Aufteilung wird nicht nachträglich aus den Summen geschätzt.

**Zähler zurücksetzen.** **FREE ALL SLOTS** wählt alle Bänder/Modi ab, schaltet beide Ziele aus, stoppt den Daemon und **löscht die Gesamtzähler** — danach steht neben keinem Kontrollkästchen mehr eine Zahl. Das ist die einzige Möglichkeit, sie zurückzusetzen, und sie lässt sich nicht rückgängig machen. Die Schaltfläche stoppt den Daemon und wartet auf dessen Ende, bevor sie `autorun-totals.json` löscht, denn der Daemon schreibt diese Datei beim Beenden neu; ein Löschen bei laufendem Daemon würde die Zahlen einfach zurückholen.

### Ressourcenbedarf und Grenzen

Der Daemon ist bewusst schlank und läuft auf ressourcenarmer Hardware (ein 4-Kern-i5 genügt), es gibt aber reale Grenzen, die man kennen sollte.

**Das CPU-Pinning von Autorun ist konfigurationsbewusst und automatisch.** Der **Autorun-Daemon** wird stets vom Admin-Panel (`admin_server.py`) gestartet, sein Pinning wird daher bei jeder Installation ohne Konfiguration gesetzt: Aus der Anzahl der CPUs wird ein `taskset`-Kernbereich abgeleitet, der einige der obersten Kerne für das Dekodieren reserviert; bei ≤ 4 Kernen läuft er ungebunden.

**Das Pinning von spectrumserver liegt bei Ihrer eigenen Startmethode.** Wie Sie spectrumserver starten, unterscheidet sich je nach Installation (SDR-Typ, Werkzeuge, eigene Skripte), daher setzt dieses Dokument keinen bestimmten Starter voraus. Das Admin-Panel startet und bindet spectrumserver nicht — das hängt ganz vom Befehl oder Dienst ab, mit dem Sie ihn ausführen. Wollen Sie spectrumserver von den Kernen fernhalten, die der Autorun-Daemon nutzt, binden Sie ihn selbst mit `taskset` in Ihrem Startbefehl (siehe Abschnitt zum Überschreiben unten). Tun Sie das nicht, läuft er einfach ungebunden und der Scheduler des Betriebssystems verteilt ihn — korrekt und sicher, nur ohne die bewusste Kerntrennung.

Zur Orientierung reserviert der Autorun-Daemon diese oberen Kerne (wenn Sie spectrumserver binden, bleiben Sie also bei den unteren Kernen, um Überschneidungen zu vermeiden):

| Logische CPUs | Vom Autorun-Daemon genutzt | Für spectrumserver frei lassen |
|---|---|---|
| ≤ 4 | *ungebunden* | *ungebunden* |
| 6 | `5` | `0-4` |
| 8 | `6-7` | `0-5` |
| 12 (z. B. Hybrid 8P+4E) | `8-11` | `0-7` |
| 16 | `12-15` | `0-11` |

Auf einer Maschine mit **4 Kernen (oder weniger)** gibt es nichts zu trennen, daher läuft auch der Autorun-Daemon *ungebunden* und teilt sich alle Kerne — korrekt und sicher, aber die SDR-FFT und die Dekodierschübe konkurrieren um dieselben Kerne.

**Bekannte Grenzen:**

1. **Der eigentliche Engpass ist spectrumserver + die SDR-Bandbreite, nicht der Daemon.** Ein RX888 bei 30 MHz braucht OpenCL/GPU; eine CPU mit wenigen Kernen ohne leistungsfähige GPU kann diese FFT nicht tragen. Kombinieren Sie schwache Hardware mit einem schmaleren SDR (RSP1A ≈ 10 MHz, RTL-SDR ≈ 2.4 MHz).
2. **WSPR ist der CPU-Flaschenhals.** Sein Fano-Decoder ist eine JS-Portierung (~30 s pro Band, einfädig). Der 4-Worker-Pool führt 4 Dekodierungen parallel aus; mehr als **etwa 4 WSPR-Bänder** gleichzeitig können die Warteschlange über den 120-s-Zeitschlitz hinaus verlängern, besonders während das SDR um Kerne konkurriert. FT8-/FT4-Dekodierungen sind im Vergleich günstig.
3. **Skalierung der Slot-Anzahl.** Die Angabe von ~2–2,5 Kernen / 600–700 MB gilt für die vollen ~28 Slots auf einer 8-Kern-Maschine. Auf 4 gemeinsam genutzten Kernen bleiben Sie bei wenigen Bändern (Richtwert: ≤ 6 FT8/FT4 + ≤ 3 WSPR) und beobachten die `queued`-Statistik des Pools.
4. **Das Pinning setzt eine hybride Intel-Topologie voraus** (untere Kerne = schnellere P-Cores). Auf AMD oder CPUs mit verschränkter SMT-Nummerierung bleibt die automatische Aufteilung gültig (keine Überschneidung, kein Absturz), aber „untere Kerne sind schneller" trifft womöglich nicht wörtlich zu; bei einem 4C/8T-Modell mit Hyperthreading sind die oberen Kerne SMT-Geschwister — eingegrenzt, nicht vollständig isoliert. Wo der automatische Bereich nicht ideal ist, nutzen Sie das **manuelle Überschreiben** unten.
5. **Die Bandabdeckung wird vom Empfänger begrenzt.** Die RX888-Konfiguration (`sps=60000000` → Nyquist bei 30 MHz) erreicht das 6-m-Band und darüber nicht; die Bandtabelle reicht von 160 m bis 10 m. Andere SDRs decken ab, was ihr Abstimmfenster erlaubt.
6. **Reporting-Taktung.** PSK Reporter sendet alle 5 min, wsprnet alle 2 min — „0 sent" in den ersten Minuten ist normal, kein Fehler.

### Manuelles Überschreiben des CPU-Pinnings (fortgeschritten)

Die automatisch abgeleitete Kernaufteilung passt für die meisten Maschinen, aber Sie können dort ein bestimmtes Pinning erzwingen, wo sie es nicht tut (AMD CCX/CCD, ARM big.LITTLE, verschränktes SMT). Zwei unabhängige Überschreibungen, jede akzeptiert eine Kernliste im `taskset -c`-Format (`2-3`, `0,2,4`, `0-2,5`) oder `none`/`off`/`unpinned`, um das Pinning abzuschalten. Ein ungültiger Wert wird ignoriert und die automatische Ableitung greift — ein Tippfehler kann einen Start also nie verhindern.

**Autorun-Daemon** — Umgebungsvariable `AUTORUN_CORES` oder ein Feld `"cores"` in `autorun.json` (die Umgebung gewinnt). Das Feld `"cores"` bleibt beim **Save** im Admin-Panel erhalten, eine Handänderung bleibt also bestehen. Zwei Wege, es zu setzen:

*Variante A — `autorun.json` (dauerhaft, empfohlen).* Fügen Sie der Konfiguration im Repository-Wurzelverzeichnis eine Zeile `"cores"` hinzu und führen Sie dann im Reiter Spot Reporting **Stop → Start** aus:

```jsonc
// autorun.json
{ "identity": { "callsign": "SV1BTL", "grid": "KM17VX" },
  "reporting": { "pskreporter": true, "wsprnet": false },
  "slots": [ /* … */ ],
  "cores": "2-3" }          // or "none" to run unpinned
```

*Variante B — Umgebungsvariable (einmalig).* Der Daemon wird vom Admin-Panel gestartet, die Variable muss also in der Umgebung **des Panels** stehen — setzen Sie sie und starten Sie das Panel neu (die Umgebung gewinnt gegenüber dem Wert in `autorun.json`):

```bash
# Methode A — die Variable muss auf dem startenden Prozess gesetzt sein:
./manage_admin.sh stop && AUTORUN_CORES=2-3 ./manage_admin.sh start

# Methode B — systemd ignoriert eine auf der systemctl-Kommandozeile
# gesetzte Variable, legen Sie sie daher in der Unit ab:
sudo systemctl set-environment AUTORUN_CORES=2-3
sudo systemctl restart phantomsdr-admin
```

**spectrumserver** — binden Sie ihn selbst, indem Sie `taskset -c <Kerne>` dem Befehl voranstellen, mit dem Sie den Server starten. Das funktioniert mit jeder Startmethode (direkter Aufruf, SDR-Pipeline, Service-Unit usw.):

```bash
# pin the server to cores 0-3, direct launch:
taskset -c 0-3 ./build/spectrumserver --config <your-config>.toml < <your-input>
# or in an SDR pipeline:
<your-sdr-source> | taskset -c 0-3 ./build/spectrumserver --config <your-config>.toml
```

> ⚠️ **Sorgen Sie dafür, dass es Neustarts übersteht.** Ein `taskset` in der Befehlszeile gilt nur für diesen einen Start. Startet etwas den Server automatisch neu (ein Watchdog, ein systemd-Dienst, ein cron-/`@reboot`-Eintrag …), fügen Sie das `taskset`-Präfix in das Skript oder die Unit ein, die ihn tatsächlich startet — sonst geht das Pinning beim Neustart verloren.

**Prüfen, ob das Pinning gegriffen hat** — die tatsächliche CPU-Affinität der laufenden Prozesse ausgeben:

```bash
taskset -cp "$(pgrep -f 'autorun/index.js')"   # autorun daemon
taskset -cp "$(pgrep -x spectrumserver)"       # spectrumserver
```

**Zulässige Werte (beide Überschreibungen):** eine `taskset -c`-Liste (`2-3`, `0,2,4`, `0-2,5`) oder `none`/`off`/`unpinned` für kein Pinning. Alles Fehlerhafte wird ignoriert und die automatische Ableitung greift, ein Tippfehler kann den Start also nie blockieren.

> Auf einem Raspberry Pi / jeder Maschine mit ≤ 4 Kernen brauchen Sie in der Regel keines von beidem — der automatische Weg lässt beide Prozesse bereits ungebunden laufen, was auf einer kleinen, homogenen CPU die richtige Wahl ist. Das Überschreiben ist für größere Maschinen gedacht, die keine Intel-Hybriden sind.

### Dateien und Endpunkte

| Element | Zweck |
|---|---|
| `autorun.json` | Gespeicherte Konfiguration (Identität, Slots, Ziele, max. Slots, optionales `cores`-Pinning). Vom Reiter geschrieben; von git ignoriert. |
| `autorun-status.json` | Live-Status, den die Statuskarte liest (PID, Zähler, letzter Upload). Alle 15 s geschrieben; beim Stoppen entfernt. |
| `frontend/dist/autorun-active.json` | Öffentliche Abzeichendaten, ausgeliefert unter `/autorun-active.json`. Leer, wenn das Reporting aus ist. |
| `autorun.log` | Standard- und Fehlerausgabe des Daemons. |
| `GET/POST /admin/api/autorun/config` | `autorun.json` lesen/schreiben (prüft Rufzeichen, Locator, Band-/Betriebsart-Kombinationen, Slot-Grenze). |
| `GET /admin/api/autorun/status` | Laufzustand (`pgrep`) + `autorun-status.json`. |
| `POST /admin/api/autorun/start` / `stop` | Startet (`taskset -c <auto> node autorun/index.js`) / sendet `SIGTERM`. Der Kernbereich wird von der CPU abgeleitet (siehe oben). |

> **Hinweis:** Nach einem Upgrade von `admin_server.py` müssen Sie das [Panel neu starten](#panel-neu-starten) neu starten, um neue Autorun-Routen oder eine aktualisierte Band-/Betriebsart-Matrix zu laden. Der Daemon läuft als eigener Prozess und übersteht daher Neustarts des Admin-Panels.

---

## Fehlerbehebung

| Problem | Abhilfe |
|---|---|
| Admin-Panel startet nicht | Prüfen Sie `admin.log` — meist ein fehlendes Python-Paket |
| Proxy startet nicht | Führen Sie `python3 -c "import aiohttp"` aus — schlägt es fehl: `pip3 install aiohttp --break-system-packages` |
| `proxy.log` ist leer | Prüfen Sie zuerst, ob der Proxy wirklich läuft (`./manage_admin.sh status`). Wenn ja, nutzen Sie eine alte Version: Der Starter muss `python3 -u` verwenden (ungepuffert — sonst verlässt das Startbanner nie den 8-KB-Puffer), und `main()` in `proxy.py` muss `logging.basicConfig()` aufrufen (sonst hat aiohttps Zugriffslogger keinen Handler und jede Anfragezeile geht verloren, weil `web.AppRunner` — anders als `web.run_app` — die Protokollierung nicht konfiguriert). |
| Proxy startet, aber der Wasserfall bleibt leer | Prüfen Sie `sdr_host` in `admin_config.json` — normalerweise `127.0.0.1`. Steht dort noch eine alte LAN-IP aus einer früheren Version, ändern Sie sie und starten Sie das [Panel neu starten](#panel-neu-starten) neu |
| Kick-Schaltfläche meldet „no connections" | Führen Sie `getcap $(which ss)` aus — fehlt `cap_net_admin`, setzen Sie `sudo setcap cap_net_admin+ep $(which ss)` |
| Status zeigt immer OFFLINE | Gehen Sie zu Settings → SDR Process Name — tragen Sie den exakten Namen ein, den `ps -eo comm,args \| grep -v grep` anzeigt |
| Seite Users zeigt keine Daten | Prüfen Sie den Endpunkt: `curl http://127.0.0.1:<public_port>/users` |
| Externer Browser meldet NetworkError | Prüfen Sie, ob der Proxy läuft: `./manage_admin.sh status` |
| Proxy nach einer Netzwerkänderung defekt | Nur relevant, wenn `sdr_host` noch eine LAN-IP enthält — setzen Sie ihn auf `127.0.0.1` und starten Sie das [Panel neu starten](#panel-neu-starten) neu |
| Chat-Löschschaltfläche wirkt nicht | Prüfen Sie die Schreibrechte auf die Chatprotokolldatei: `ls -l ~/PhantomSDR-Plus/chat.jsonl` |
| Wasserfallnachricht erscheint nicht | Prüfen Sie, ob der Proxy läuft (`./manage_admin.sh status`) und das Frontend auf einem aktuellen Build mit Overlay-Renderer ist |
| Wasserfallnachricht nach Neustart verschwunden | Erwartet — der Nachrichtenzustand liegt nur im Speicher; senden Sie sie nach dem Neustart des Admin-Panels erneut |
| „Start" bei Spot Reporting schlägt fehl / Daemon beendet sich sofort | Prüfen Sie `autorun.log`. Meist fehlt der Symlink `autorun/node_modules` (`ln -sfn ../frontend/node_modules autorun/node_modules`) oder `taskset` ist nicht installiert (`sudo apt install -y util-linux`). |
| Spot Reporting: Daemon läuft, aber `decodes` bleibt 0 und `autorun.log` zeigt `504` / `tap closed 1006` | Der Audioabgriff erreicht spectrumserver nicht. Der Daemon erkennt den Port automatisch aus der Konfiguration des **laufenden** Servers; die Protokollzeile `[autorun] tap backend: HOST:PORT` muss zu Ihrem `[server] port` passen. Stimmt sie nicht (oder lief der Server beim Start nicht), fixieren Sie ihn in `autorun.json`: `"server": { "host": "127.0.0.1", "port": 9002 }`, dann Stop→Start. |
| Spot Reporting zeigt „0 sent" | In den ersten Minuten normal — PSK Reporter sendet alle 5 min, wsprnet alle 2 min. Prüfen Sie, ob ein Ziel aktiviert ist und der Daemon läuft. |
| Neue Bänder/Betriebsarten erscheinen nicht in der Matrix | [Panel neu starten](#panel-neu-starten) — die Matrix wird beim Start geladen. |
| `autorun.log` zeigt `MODULE_TYPELESS_PACKAGE_JSON` / „Reparsing as ES module … performance overhead" | Kosmetische Warnung (die Dekodierung funktioniert weiterhin). In `frontend/src/modules/package.json` fehlt `"type": "module"`; fügen Sie die Zeile nahe dem Anfang ein und führen Sie Stop→Start aus. Kein Frontend-Neubau nötig — der Daemon importiert die Quelldatei direkt. |
| „Start" bei Spot Reporting scheitert mit `taskset: … Invalid argument` auf einem alten/kleinen PC | Sollte mit dem konfigurationsbewussten Starter nicht vorkommen — der Kernbereich wird aus der CPU-Anzahl abgeleitet und läuft bei ≤ 4 Kernen ungebunden. Tritt es auf, ist Ihr `admin_server.py` älter als diese Änderung; aktualisieren Sie es (`_autorun_taskset_prefix`) und starten Sie das [Panel neu starten](#panel-neu-starten) neu. |
| REPORTING-Abzeichen fehlt im Wasserfall | Das Reporting muss mit mindestens einem Slot eingeschaltet sein; das Abzeichen liest `/autorun-active.json`. Bauen Sie das Frontend neu, wenn `dist/index.html` älter als das Abzeichen ist. |
