# Installationsanleitung für System Stats

Eine umfassende Anleitung, um Ihrer PhantomSDR-Anwendung mithilfe des automatisierten Installationsskripts eine Serverüberwachung in Echtzeit hinzuzufügen.

## Übersicht

Diese Funktion fügt Ihrer PhantomSDR-Oberfläche eine **📊 Stats**-Schaltfläche hinzu, die Systeminformationen in Echtzeit anzeigt:
- CPU-Auslastung, Kerne, Frequenz, Temperatur und Top-Prozesse
- Speichernutzung (belegt/gesamt/Prozent)

Die Statistiken werden automatisch alle 5 Sekunden aktualisiert, solange das Modalfenster geöffnet ist.

> **Nicht zu verwechseln mit der Seite „Graphen“ des Admin-Panels.** Dieses Fenster zeigt eine Momentaufnahme, die sich beim Öffnen aktualisiert und keinen Verlauf speichert. Das Admin-Panel hat eine eigene Seite **Graphen**, die CPU-Takt, Last, Temperatur und Nutzer online alle 2 Sekunden erfasst und über die letzten 15 Minuten bis 24 Stunden darstellt — siehe das [Admin-Panel-Handbuch](../de/ADMIN_PANEL_SETUP.md).

---

## Voraussetzungen

- **Linux-Server** (Ubuntu/Debian empfohlen)
- **Internetverbindung** (zum Herunterladen von Node.js und Paketen)
- **Sudo-Zugriff** (für die Einrichtung des systemd-Dienstes)
- **PhantomSDR-Plus** bereits installiert und in Betrieb
- **lm-sensors** (empfohlen für Intel/AMD-CPU-Temperatur – wird vom Skript automatisch installiert)

---

## Installationsmethoden

> [!NOTE]
> **Das Hauptinstallationsskript bietet dies bereits an.** `./install.sh` — und die vier Distributionsskripte — führen `install-stats-server.sh` standardmäßig im Rahmen der normalen PhantomSDR-Plus-Installation aus, auf einer frischen Maschine ist der Statistikserver also meist schon eingerichtet. Nutzen Sie diese Seite, um ihn separat zu installieren oder um Port, Adresse oder Dienst später zu ändern.

### Option 1: Automatisierte Installation (Empfohlen) ⭐

Das automatisierte Skript erledigt alles für Sie.

#### Schritt 1: Das Skript ausführen

```bash
cd ~/PhantomSDR-Plus
chmod +x install-stats-server.sh   # only if it is not already executable
./install-stats-server.sh
```

**WICHTIG:** Führen Sie es NICHT als root oder mit sudo aus. Führen Sie es als Ihr regulärer Benutzer aus.

#### Schritt 2: Den interaktiven Aufforderungen folgen

Das Skript führt Sie durch:

##### 1. **Node.js-Installation** (falls erforderlich)
```
⚠ Node.js / npm is not installed
Would you like to install Node.js 22 via nvm now? (y/n): y
```
Das Skript installiert Node.js 22 über nvm, auf jeder Linux-Distribution — ohne root und ohne apt-Quelle. Dieselbe Frage erscheint, wenn Node.js zwar vorhanden, aber älter als 22 ist.

##### 2. **Installationsverzeichnis**
```
Installation directory [/home/user/sdr-stats-server]: 
```
Drücken Sie die Eingabetaste für die Standardeinstellung oder geben Sie einen benutzerdefinierten Pfad an.

##### 3. **Port-Konfiguration** (Verbessert!)
```
Port Configuration:
  Default port: 3001
  Common alternatives: 8080, 5000, 8888
Enter port number [3001]: 
```

Das Skript validiert Ihren Port:
- ✅ Prüft, ob es sich um eine gültige Zahl handelt
- ✅ Warnt, wenn Port < 1024 (erfordert Root-Rechte)
- ✅ Validiert den Bereich (1-65535)
- ✅ Prüft, ob der Port bereits verwendet wird
- ✅ Zeigt an, welcher Prozess ihn belegt
- ✅ Ermöglicht die Wahl eines anderen Ports

**Beispielszenarien:**

**Standardport verwenden:**
```
Enter port number [3001]: ↵
✓ Port 3001 selected
```

**Benutzerdefinierten Port wählen:**
```
Enter port number [3001]: 8080
✓ Port 8080 selected
```

**Port bereits belegt:**
```
Enter port number [3001]: 3001
⚠ Port 3001 is currently in use
Process using port 3001:
node    12345 user   20u  IPv6 123456  TCP *:3001 (LISTEN)
Choose a different port? (y/n): y
Enter port number [3001]: 3002
✓ Port 3002 selected
```

**Ungültiger Port:**
```
Enter port number [3001]: abc
✗ Port must be a number
Enter port number [3001]: 99999
✗ Port must be between 1 and 65535
Enter port number [3001]: 3001
✓ Port 3001 selected
```

##### 4. **Serveradresse**
```
What is your server's public address?
Examples: Your_site_IP, 192.168.1.100, localhost
Server address: Your_site_IP
```
Geben Sie die öffentliche Domain oder IP-Adresse Ihres Servers ein.

##### 5. **Bestätigung**
```
Please confirm your settings:
  Installation directory: /home/user/sdr-stats-server
  Port: 3001
  Server address: Your_site_IP
  Stats URL will be: http://Your_site_IP:3001
Continue with these settings? (y/n): y
```

##### 6. **Einrichtung des Systemd-Dienstes** (Optional)
```
Would you like to set up the server as a system service (auto-start on boot)? (y/n): y
```

Empfohlen: Wählen Sie **y**, damit der Server beim Booten automatisch startet.

#### Schritt 3: Installation abgeschlossen! ✓

Das Skript zeigt eine Zusammenfassung an:
```
╔════════════════════════════════════════════════╗
║          Installation Complete! ✓              ║
║          Open the port in the router!          ║
╚════════════════════════════════════════════════╝

Configuration Summary:
  Installation: /home/user/sdr-stats-server
  Port: 3001
  Server: Your_site_IP
  API URL: http://Your_site_IP:3001/api/system-stats
```

---

## Konfigurieren Sie Ihre PhantomSDR-Anwendung

Nachdem das Skript abgeschlossen ist, müssen Sie Ihre Svelte-Anwendung aktualisieren.

### Schritt 1: `site_information.json` aktualisieren

Da `site_information.json` bereits während der ersten Einrichtung bearbeitet wurde, müssen Sie nur die neue `siteStats`-Zeile mit Ihrem Port hinzufügen:

```json
{
	"siteSysop": "your name or callsign",
	"siteSysopEmailAddress": "mail@mail.net",
	"siteGridSquare": "QTH locator",
	"siteCity": "City Country",
	"siteInformation": "https://github.com/sv1btl/PhantomSDR-Plus",
	"siteHardware": "Hardware you are using, ",
	"siteSoftware": "Software you are using",
	"siteReceiver": "Receiver model",
	"siteAntenna": "Receiving Antenna.",
	"siteNote": "This is a bright new open-source WebSDR project, under active development.",
	"siteIP": "http://Your_site_IP:port",
  "siteStats": "http://Your_site_IP:3001",  ← DIESE ZEILE HINZUFÜGEN (Ihren Port verwenden)
  "siteSDRBaseFrequency": 0,
  "siteSDRBandwidth": 30000000,
  "siteRegion": 1,
  "siteChatEnabled": true
}
```

**Hinweis:** Verwenden Sie den Port, den Sie während der Installation ausgewählt haben!

### Schritt 2: `App.svelte` aktualisieren (die neueste GitHub-Version enthält die aktualisierte Datei bereits)

Nehmen Sie diese **4 Änderungen** an Ihrer App.svelte-Datei vor:

#### Änderung 1: Sicherstellen, dass `siteStats` deklariert ist (etwa Zeile 50)

```javascript
import {
  siteSysop,
  siteSysopEmailAddress,
  siteInformation,
  siteGridSquare,
  siteCity,
  siteHardware,
  siteSoftware,
  siteReceiver,
  siteAntenna,
  siteNote,
  siteIP,
  siteStats,  // ← DIESE ZEILE HINZUFÜGEN
  siteSDRBaseFrequency,
  siteSDRBandwidth,
  siteRegion,
  siteChatEnabled,
} from "../site_information.json";
```

#### Änderung 2: systemStats-Objekt aktualisieren (etwa Zeile 530)

```javascript
let systemStats = {
  cpu: { usage: 0, cores: 0, temperature: null, frequency: null, topProcesses: [] },  // ← topProcesses: [] HINZUFÜGEN
  memory: { used: 0, total: 0, percent: 0 }
};
```

#### Änderung 3: Fetch-URL aktualisieren (etwa Zeile 541)

```javascript
async function fetchSystemStats() {
  try {
    const response = await fetch(`${siteStats}/api/system-stats`);  // ← DIESE ZEILE ÄNDERN
    if (response.ok) {
      systemStats = await response.json();
    } else {
      console.error('Failed to fetch system stats:', response.statusText);
    }
  } catch (error) {
    console.error('Error fetching system stats:', error);
  }
}
```

#### Änderung 4: Anzeige der Top-Prozesse hinzufügen (im CPU-Abschnitt, etwa Zeile 3838)

Fügen Sie diesen Code nach dem Temperaturabschnitt hinzu:

```svelte
{#if systemStats.cpu.frequency}
<div style="display: flex; justify-content: space-between; margin-bottom: 0.25rem;">
  <span>Frequency:</span>
  <span style="color: #4ade80;">{systemStats.cpu.frequency.current} GHz{#if systemStats.cpu.frequency.max} <span style="opacity: 0.7;">(max {systemStats.cpu.frequency.max})</span>{/if}</span>
</div>
{/if}

{#if systemStats.cpu.temperature !== null}
<div style="display: flex; justify-content: space-between; margin-bottom: 0.25rem;">
  <span>Temperature:</span>
  <span style="color: {systemStats.cpu.temperature > 70 ? '#fbbf24' : '#4ade80'};">{systemStats.cpu.temperature}°C</span>
</div>
{/if}

<!-- DIESEN GESAMTEN ABSCHNITT HINZUFÜGEN: -->
{#if systemStats.cpu.topProcesses && systemStats.cpu.topProcesses.length > 0}
<div style="margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px solid rgba(255,255,255,0.1);">
  <h4 style="margin: 0 0 0.5rem 0; font-size: 0.85rem; color: rgba(0, 225, 255, 0.8);">Top Processes:</h4>
  {#each systemStats.cpu.topProcesses as process}
  <div style="display: flex; justify-content: space-between; margin-bottom: 0.25rem; font-size: 0.85rem;">
    <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 70%;">{process.name}</span>
    <span style="color: {process.cpu > 50 ? '#ef4444' : process.cpu > 25 ? '#fbbf24' : '#4ade80'};">{process.cpu}%</span>
  </div>
  {/each}
</div>
{/if}
```

### Schritt 3: Anwendung neu kompilieren

```bash
cd /path/to/your/phantomsdr-app
npm ./recompile.sh
```

---

## Die Installation testen

### Test 1: API-Endpunkt prüfen

```bash
curl http://localhost:3001/api/system-stats
```

Erwartete Ausgabe (JSON):
```json
{
  "cpu": {
    "usage": 45.2,
    "cores": 8,
    "coresUsed": 1.3,
    "temperature": 62.5,
    "frequency": {
      "current": 3.0,
      "max": 3.9,
      "limit": 4.4
    },
    "topProcesses": [
      {"name": "node", "cpu": 12.5},
      {"name": "phantomsdr", "cpu": 8.3}
    ]
  },
  "memory": {
    "used": 8.5,
    "total": 16,
    "percent": 53
  }
}
```

### Test 2: Dienststatus prüfen

Wenn Sie es als Dienst installiert haben:

```bash
sudo systemctl status sdr-stats.service
```

Sollte anzeigen: `Active: active (running)`

### Test 3: Im Browser testen

1. Öffnen Sie Ihre PhantomSDR-Weboberfläche
2. Scrollen Sie zum Abschnitt **Additional Info**
3. Klicken Sie auf die Schaltfläche **Open Additional Info**
4. Suchen Sie die Schaltfläche **📊 Stats** neben den PC-Infos
5. Klicken Sie darauf, um das Statistik-Modalfenster zu öffnen
6. Überprüfen Sie, ob die Statistiken angezeigt und aktualisiert werden

---

## Dienstverwaltung

Wenn Sie es als systemd-Dienst installiert haben, verwenden Sie diese Befehle:

```bash
# Start the service
sudo systemctl start sdr-stats.service

# Stop the service
sudo systemctl stop sdr-stats.service

# Restart the service (after updating files)
sudo systemctl restart sdr-stats.service

# Check status
sudo systemctl status sdr-stats.service

# View real-time logs
sudo journalctl -u sdr-stats.service -f

# View last 50 log entries
sudo journalctl -u sdr-stats.service -n 50

# Enable auto-start on boot
sudo systemctl enable sdr-stats.service

# Disable auto-start
sudo systemctl disable sdr-stats.service

# Edit service
sudo nano /etc/systemd/system/sdr-stats.service

# Delete service
sudo rm /etc/systemd/system/sdr-stats.service
```

---

## Manuelle Installation (Option 2)


> [!IMPORTANT]
> **Für eine normale Installation brauchen Sie diesen Abschnitt nicht.** `install-stats-server.sh` erledigt all das für Sie und wird vom Hauptinstallationsskript standardmäßig ausgeführt. Folgen Sie ihm nur für eine manuelle Einrichtung oder um einen Teil von Hand zu reparieren.

**⚠️ Warnung:** Bei der manuellen Installation werden möglicherweise veraltete Dateien verwendet. Das **automatisierte Skript wird dringend empfohlen**, da es:
- Die neueste Version mit verbesserter Temperaturerkennung installiert
- lm-sensors automatisch installiert und konfiguriert
- Alle Abhängigkeiten automatisch verwaltet

Wenn Sie dennoch die manuelle Installation bevorzugen:

### 1. Node.js installieren
```bash
# Any distribution - nvm needs no root and no apt source.
# NOT NodeSource: deb.nodesource.com now answers HTTP 403 on every path.
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.4/install.sh | bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm install 22 && nvm use 22 && nvm alias default 22
```

### 2. lm-sensors installieren (Erforderlich für Intel/AMD-Temperatur)
```bash
sudo apt-get update
sudo apt-get install -y lm-sensors
sudo sensors-detect --auto
```

### 3. Verzeichnis erstellen
```bash
mkdir ~/sdr-stats-server
cd ~/sdr-stats-server
```

### 4. Neueste Dateien herunterladen

**Wichtig:** Die Server-Dateien liegen nicht mehr als Kopien im Repository - das Installationsskript erzeugt sie.

Führen Sie stattdessen das automatisierte Skript einmal aus, um die neuesten Dateien zu generieren, und kopieren Sie sie dann:
```bash
# Run the automated script from the repository root
cd ~/PhantomSDR-Plus
./install-stats-server.sh
# When prompted, use a temporary port like 9999
# After installation completes, copy the generated files
cp ~/sdr-stats-server/system-stats-server.js ~/your-manual-install-dir/
cp ~/sdr-stats-server/package.json ~/your-manual-install-dir/
```

**ODER** erstellen Sie die Dateien manuell mit dem neuesten Code aus dem Installationsskript.

### 5. Port bearbeiten (falls erforderlich)
```bash
nano ~/sdr-stats-server/system-stats-server.js
```

Ändern Sie Zeile 6:
```javascript
const PORT = process.env.PORT || 3001;  // Change this number
```

### 6. Abhängigkeiten installieren
```bash
npm install
```

### 7. Testlauf
```bash
npm start
```

### 8. Dienst einrichten (Optional)

Folgen Sie der systemd-Dienst-Einrichtung aus dem Abschnitt zur automatisierten Installation.

## Den Port nach der Installation ändern

Wenn Sie den Port nach der Installation ändern müssen:

### Schritt 1: Die Serverdatei bearbeiten

```bash
nano ~/sdr-stats-server/system-stats-server.js
```

Ändern Sie Zeile 6:
```javascript
const PORT = process.env.PORT || 3001;  // Change this number
```

### Schritt 2: site_information.json aktualisieren

```json
"siteStats": "http://Your_site_IP:NEW_PORT"
```

### Schritt 3: Den Dienst neu starten

```bash
sudo systemctl restart sdr-stats.service
```

### Schritt 4: Ihre Svelte-App neu erstellen

```bash
cd /path/to/phantomsdr-app
npm run build
```

---

## Fehlerbehebung

### Problem: Port bereits belegt

**Fehler:**
```
Error: listen EADDRINUSE: address already in use :::3001
```

**Lösung:**

1. Finden Sie heraus, was den Port verwendet:
```bash
sudo lsof -i :3001
```

2. Stoppen Sie diesen Prozess:
```bash
kill <PID>
# or
sudo systemctl stop sdr-stats.service
```

3. Starten Sie den Dienst erneut:
```bash
sudo systemctl start sdr-stats.service
```

**Alternative:** Führen Sie das Installationsskript erneut aus und wählen Sie bei der Aufforderung einen anderen Port.

### Problem: Der Dienst startet nicht

**Fehler:**
```
status=217/USER
```

**Lösung:**

1. Überprüfen Sie die Dienstdatei:
```bash
cat /etc/systemd/system/sdr-stats.service
```

2. Überprüfen Sie, ob die Zeile `User=` mit Ihrem Benutzernamen übereinstimmt:
```bash
whoami
```

3. Bearbeiten Sie sie bei Bedarf:
```bash
sudo nano /etc/systemd/system/sdr-stats.service
```

4. Neu laden und neu starten:
```bash
sudo systemctl daemon-reload
sudo systemctl restart sdr-stats.service
```

### Problem: Statistiken werden im Browser nicht angezeigt

**Symptome:** Das Modalfenster öffnet sich, aber es gibt keine Daten oder es werden 0-Werte angezeigt

**Lösungen:**

1. Überprüfen Sie die Browser-Konsole (F12) auf Fehler
2. Überprüfen Sie, ob die API erreichbar ist:
```bash
curl http://localhost:3001/api/system-stats
```
3. Überprüfen Sie, ob der Dienst läuft:
```bash
sudo systemctl status sdr-stats.service
```
4. Überprüfen Sie, ob `siteStats` in `site_information.json` mit Ihrer Serveradresse und Ihrem Port übereinstimmt
5. Überprüfen Sie auf CORS-Fehler – stellen Sie sicher, dass der Server Ihre Domain zulässt

### Problem: Temperatur zeigt null an

**Ursache:** Temperaturmessung auf Ihrem System nicht verfügbar

**Lösungen:**

1. **Für die meisten Linux-Systeme:** Überprüfen Sie, ob die thermische Zone existiert:
```bash
cat /sys/class/thermal/thermal_zone0/temp
```

2. **lm-sensors installieren:**
```bash
sudo apt-get install lm-sensors
sudo sensors-detect
sensors
```

3. **Hinweis:** Die Temperatur ist möglicherweise nicht verfügbar auf:
- Virtuellen Maschinen
- Einigen VPS-Anbietern
- Windows Subsystem for Linux (WSL)
- Nicht-Linux-Systemen

Das ist normal – der Rest der Statistiken funktioniert trotzdem!

### Problem: Statistikwerte stimmen nicht mit `top` überein

**Ursache:** Der CPU-Abtastzeitraum war in älteren Versionen zu kurz

**Lösung:** Die aktuelle Version verwendet eine 1-Sekunden-Abtastung für genaue Messwerte. Wenn Sie eine alte Installation haben:

1. Aktualisieren Sie die Serverdatei:
```bash
nano ~/sdr-stats-server/system-stats-server.js
```

2. Suchen Sie Zeile 18 und ändern Sie:
```javascript
}, 100);  // Old value
```
in:
```javascript
}, 1000);  // New value (1 second)
```

3. Neu starten:
```bash
sudo systemctl restart sdr-stats.service
```

Oder führen Sie einfach das Installationsskript erneut aus, um die neueste Version zu erhalten.

### Problem: Node.js nicht gefunden

**Fehler:**
```
node: command not found
```

**Lösung:**

1. Node.js installieren:
```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.4/install.sh | bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm install 22 && nvm use 22 && nvm alias default 22
```

2. Überprüfen:
```bash
node --version
npm --version
```

---

## Was Sie sehen werden

Nach Installation und Konfiguration zeigt das Statistik-Modalfenster Folgendes an:

### 🖥️ CPU-Abschnitt
- **Auslastung**: Gesamt-CPU-Auslastung in Prozent
- **Kerne**: Wie viel CPU tatsächlich genutzt wird, ausgedrückt in ganzen Kernen — z. B. `1.3 / 12 in use` heißt, die Maschine leistet die Arbeit von 1,3 Kernen. Der Wert ist exakt und braucht keine Schwelle. Es ist bewusst keine Zählung belegter Kerne: der Scheduler verteilt die Arbeit eines Kerns auf viele, sodass eine solche Zählung diese Zahl immer nur annähern könnte.
- **Frequenz**: Durchschnittlicher aktueller CPU-Takt über alle Kerne in GHz, mit dem schnellsten Kern in Klammern (falls verfügbar)
- **Temperatur**: CPU-Temperatur in Celsius (falls verfügbar), farblich codiert: 🟢 grün bis 69 °C, 🟠 orange 70-79 °C, 🔴 rot ab 80 °C
- **Top-Prozesse**: Die 5 CPU-intensivsten Prozesse mit farbcodierten Prozentwerten:
  - 🟢 Grün: bis 50 % CPU
  - 🟠 Orange: 51-80 % CPU
  - 🔴 Rot: über 80 % CPU

### 💾 Speicherabschnitt
- **Belegt**: Belegter Speicher (GB)
- **Gesamt**: Gesamter Systemspeicher (GB)
- **Auslastung**: Speicherauslastung in Prozent (farbcodiert)

### ♻️ Automatische Aktualisierung
- Die Statistiken werden alle **5 Sekunden** aktualisiert, solange das Modalfenster geöffnet ist
- Die Aktualisierung stoppt, wenn Sie das Modalfenster schließen (spart Ressourcen)

---


## Temperaturerkennung

Der Statistikserver verwendet eine fortschrittliche Temperaturerkennung mit mehreren Methoden:

### ✅ **Unterstützte Systeme:**
- **Intel-Prozessoren**: Liest von coretemp-Sensoren über lm-sensors
- **AMD-Prozessoren**: Liest von k10temp-Sensoren (Tdie/Tctl)
- **ARM-Prozessoren**: Liest von thermischen Zonen (Raspberry Pi usw.)

### 📋 **Anforderungen:**
- **Intel/AMD**: Erfordert das Paket `lm-sensors` (wird vom Skript automatisch installiert)
- **ARM/Raspberry Pi**: Funktioniert sofort, keine zusätzlichen Pakete erforderlich

### 🔧 **Installationspriorität:**
1. Versucht den Befehl `sensors` für die Package-/Core-Temperatur (Intel/AMD)
2. Greift auf das direkte Lesen von coretemp zurück (Intel)
3. Greift auf thermal_zone0 zurück (ARM/Raspberry Pi)

Wenn die Temperatur `null` anzeigt, installieren Sie lm-sensors:
```bash
sudo apt-get install lm-sensors
sudo sensors-detect --auto
sudo systemctl restart sdr-stats.service
```

---

## Funktionsübersicht

✅ **Echtzeitüberwachung** - Live-Systemstatistiken von Ihrem Server
✅ **CPU-Metriken** - Auslastung, Kerne, Temperatur, Top-Prozesse
✅ **Speicherverfolgung** - Belegt, gesamt und Prozent
✅ **Automatische Aktualisierungen** - Aktualisiert alle 5 Sekunden
✅ **Farbcodiert** - Visuelle Indikatoren für Warnungen
✅ **Ressourcenschonend** - Minimaler Ressourcenverbrauch
✅ **Einfache Installation** - Das automatisierte Skript erledigt alles
✅ **Port-Validierung** - Intelligente Portauswahl mit Konflikterkennung
✅ **Dienstverwaltung** - Automatischer Start beim Booten

---

## Sicherheitshinweise

- Der Statistikserver akzeptiert Verbindungen von jeder Herkunft (CORS: *)
- Erwägen Sie für die Produktion, CORS auf Ihre Domain zu beschränken
- Die Portauswahl validiert die Eingabe und prüft auf Konflikte
- Das Lesen der CPU-Temperatur erfolgt schreibgeschützt und sicher
- Es werden keine sensiblen Systeminformationen offengelegt

---

## Support & Ressourcen

### Enthaltene Dateien:
In diesem Verzeichnis (das Installationsskript selbst liegt im Wurzelverzeichnis als `PhantomSDR-Plus/install-stats-server.sh` - es gibt immer nur eine Kopie):
- `package.json` - Abhängigkeiten, identisch mit dem, was das Skript schreibt
- Dieses Dokument, auch auf de, el, es, fr, hr und ru verfügbar

Vom Installationsskript in `~/sdr-stats-server/` erzeugt:
- `system-stats-server.js` - Backend-Server, mit dem gewählten Port erzeugt
- `package.json` - Abhängigkeiten
- `node_modules/` - von `npm install` installiert

### Hilfe erhalten:
- Sehen Sie sich den obigen Abschnitt zur Fehlerbehebung an
- Überprüfen Sie die Dienstprotokolle: `sudo journalctl -u sdr-stats.service -n 50`
- Testen Sie die API manuell: `curl http://localhost:3001/api/system-stats`
- Überprüfen Sie die Konfigurationsdateien

### Statistikserver deinstallieren:
- Löschen Sie den Ordner /sdr-stats-server
- Wenn Sie einen Dienst erstellt haben, löschen Sie ihn einfach mit:
```bash
sudo rm /etc/systemd/system/sdr-stats.service"`
```
- Bearbeiten Sie `App.svelte`: Finden Sie den Codeabschnitt:
```
                   <!-- In case you don't want the Stats Button to appear, please comment this button section (12 lines)-->                     
                    <!-- System Stats Button -->
                    <button
                      type="button"
                      class="glass-button text-white py-1 px-2 ml-2 rounded text-xs"
                      on:click={openSystemStats}
                      title="System Resources"
                      aria-haspopup="dialog"
                      aria-expanded={showSystemStats}
                      aria-controls="system-stats-dialog"
                      style="color:rgba(0, 225, 255, 0.993); font-size: 0.75rem;"
                    >
                      📊 Stats
                    </button>
  ```
  und ersetzen Sie ihn durch:
```
                   <!-- In case you don't want the Stats Button to appear, please comment this button section (12 lines)-->                     
                    <!-- System Stats Button -->
                    <!--
                    <button
                      type="button"
                      class="glass-button text-white py-1 px-2 ml-2 rounded text-xs"
                      on:click={openSystemStats}
                      title="System Resources"
                      aria-haspopup="dialog"
                      aria-expanded={showSystemStats}
                      aria-controls="system-stats-dialog"
                      style="color:rgba(0, 225, 255, 0.993); font-size: 0.75rem;"
                    >
                      📊 Stats
                    </button>
                    -->
  ```                    
- Kompilieren Sie mit dem Befehl neu:
```bash
  cd PhantomSDR-Plus
 ./recompile.sh
 ```
- Starten Sie den PC neu und starten Sie den Server

---

**Autor:** Erstellt für PhantomSDR-Plus
**Version:** 1.1 (Verbesserte CPU-Temperaturerkennung für Intel/AMD) **Aktualisiert:** Januar 2026
**Lizenz:** MIT

---

## Kurzreferenz der Befehle

```bash
# Installation
cd ~/PhantomSDR-Plus
chmod +x install-stats-server.sh
./install-stats-server.sh

# Service Management
sudo systemctl start sdr-stats.service      # Start
sudo systemctl stop sdr-stats.service       # Stop
sudo systemctl restart sdr-stats.service    # Restart
sudo systemctl status sdr-stats.service     # Status
sudo journalctl -u sdr-stats.service -f     # Logs

# Testing
curl http://localhost:3001/api/system-stats # Test API
curl http://localhost:3001/api/health       # Health check

# Troubleshooting
sudo lsof -i :3001                          # Check port
whoami                                      # Check username
node --version                              # Check Node.js
```

Viel Erfolg beim Überwachen! 📊🚀
