# RADE v1 Digitalsprache für PhantomSDR-Plus

**RADE** (Radio AutoencoDEr) ist FreeDVs führende Betriebsart für digitale Sprache auf Kurzwelle. Sie nutzt einen Hybrid aus maschinellem Lernen und DSP (den neuronalen FARGAN-Vocoder) und liefert hochwertige Sprache über Kurzwelle bei Signal-Rausch-Abständen bis hinunter zu −2 dB, in nur 1500 Hz HF-Bandbreite — schmaler als ein SSB-Signal.

Dieses Dokument beschreibt die vollständige Integration des RADE-v1-Empfangs in PhantomSDR-Plus, umgesetzt als Python-Sidecar (`rade_helper.py`), der den Browser mit der Dekodierkette `radae_rxe.py` + `lpcnet_demo` verbindet.

## Installation — der kurze Weg

```bash
cd ~/PhantomSDR-Plus
./install_rade.sh
```

Das ist die gesamte Installation. Das Skript installiert die Systempakete über den Paketmanager der Maschine (apt, pacman, dnf oder zypper), weicht für Module, die eine Distribution nicht mitbringt, auf pip aus, aktualisiert `websockets`, wenn die Distributionsversion älter als die vom Sidecar benötigte 11.0 ist, klont und baut radae, prüft die Modellgewichte, baut das Frontend neu und startet den Sidecar. Unter Ubuntu 22.04 übergibt es für Sie an `install_rade_ubuntu22.sh`. `./install.sh` bietet an, es im Rahmen der normalen PhantomSDR-Plus-Installation auszuführen — auf einer frischen Maschine ist RADE also bereits vorhanden.

**Dieses Dokument erklärt, wie RADE funktioniert und wie man es betreibt — es ist nicht die Installationsanleitung.** Wenn Sie die Installation von Hand durchführen müssen, auf einem System, das das Skript nicht abdeckt, oder um einen einzelnen Schritt zu reparieren, folgen Sie der unten verlinkten Anleitung; nur dort sind die Schritte niedergeschrieben. Alles hier — die Architektur, die gepatchten Dateien, der Port, die Nutzung von RADE im Browser, die Umgebungsvariablen, die Fehlerbehebung und die Messung der Gleichzeitigkeit — gilt für jede Installation, gleich wie sie zustande kam.

- **[Manuelle Installation unter Linux](RADE_General_INSTALL_MANUAL_LINUX.md)** - der Weg von Hand, Schritt für Schritt, für Ubuntu, Debian, Fedora, Arch und Raspberry Pi OS

---

## Inhaltsverzeichnis

1. [Installation — der kurze Weg](#installation--der-kurze-weg)
2. [Funktionsweise](#funktionsweise)
3. [Architekturüberblick](#architekturüberblick)
4. [RADEL gegenüber RADEU](#radel-gegenüber-radeu)
5. [Voraussetzungen](#voraussetzungen)
6. [Installation von Hand](#installation-von-hand)
7. [Die gepatchten Dateien ausbringen](#die-gepatchten-dateien-ausbringen)
8. [Steuerung des Sidecars](#steuerung-des-sidecars)
9. [Port 8074](#port-8074)
10. [RADE im Browser nutzen](#rade-im-browser-nutzen)
11. [Überprüfung und Fehlersuche](#überprüfung-und-fehlersuche)
12. [Umgebungsvariablen](#umgebungsvariablen)
13. [Geänderte Dateien](#geänderte-dateien)
14. [Zusammenfassung des Signalflusses](#zusammenfassung-des-signalflusses)
15. [Fehlerbehebung](#fehlerbehebung)
16. [Gleichzeitigkeit auf eigener Hardware messen](#gleichzeitigkeit-auf-eigener-hardware-messen)
17. [RADE v1 aktualisieren](#rade-v1-aktualisieren)

---

## Funktionsweise

RADE v1 kann nicht im Browser laufen — es benötigt PyTorch und den neuronalen FARGAN-Vocoder, die für WASM zu groß sind. Die Lösung ist ein Python-Sidecar-Prozess (`rade_helper.py`), der auf demselben Server wie PhantomSDR-Plus läuft.

> **Wichtig:** `freedv_rx` aus dem codec2-Repository unterstützt RADEV1 **nicht**. Die RADE-Dekodierkette liegt vollständig im separaten Repository `radae` von David Rowe (VK5DGR). Versuchen Sie nicht, codec2s `freedv_rx` für RADE zu verwenden.

Wenn Sie RADE im Browser auswählen:

1. Das Frontend stellt die zugrunde liegende Demodulation auf USB oder LSB — der C++-Server demoduliert das SSB-Signal wie gewohnt.
2. Das rohe demodulierte PCM wird in `audio.js` **vor** jeder Stummschaltung oder Rauschsperre abgegriffen — `radae_rxe.py` braucht einen kontinuierlichen Eingang, um die Rahmensynchronisation zu halten.
3. Jeder PCM-Block wird von reellem f32 auf komplexes f32 mit Nullen aufgefüllt (Realteil + 0.0 Imaginärteil) — genau das erwartet `radae_rxe.py` auf der Standardeingabe.
4. Der Sidecar leitet diese Abtastwerte an `radae_rxe.py` weiter, das Vocoder-Merkmale ausgibt.
5. `lpcnet_demo -fargan-synthesis` wandelt die Merkmale in s16-Sprache mit 16000 Hz um.
6. Der Sidecar wandelt s16 → f32 und sendet das Ergebnis als binäre WebSocket-Rahmen zurück an den Browser.
7. Der Browser spielt die dekodierte Sprache über die Web-Audio-API mit 16000 Hz ab.

Der C++-Server (`spectrumserver.cpp`) wird überhaupt nicht verändert.

---

## Architekturüberblick

```
┌────────────────────────────────────────────────────────────────────┐
│  Browser                                                           │
│                                                                    │
│  Decoder → "RADE v1 — RADEL (LSB)" / "RADEU (USB)"               │
│       │                                                            │
│  audio.js ── demod cmd (LSB/USB) ──────────► C++ spectrumserver   │
│       │                                              │             │
│       │  raw SSB PCM @ audioOutputSps ◄─────────────┘             │
│       │  (tapped before mute gate, zero-padded to complex f32)     │
│       │                                                            │
│       │  binary WebSocket ──► ws://host:8074                       │
│       ▼                                                            │
├────────────────────────────────────────────────────────────────────┤
│  rade_helper.py  (port 8074)                                       │
│                                                                    │
│  resample to 8000 Hz if needed                                     │
│  zero-pad real f32 → complex f32 pairs                             │
│       │ stdin pipe                                                  │
│       ▼                                                            │
│  radae_rxe.py  --model_name model19_check3/.../checkpoint_100.pth  │
│       │ stdout pipe (vocoder features f32)                         │
│       ▼                                                            │
│  lpcnet_demo  -fargan-synthesis  -  -                              │
│       │ stdout (s16 PCM @ 16000 Hz)                                │
│       │ converted → f32 by sidecar                                 │
│       │ binary WebSocket frames ──► browser                        │
│       ▼                                                            │
├────────────────────────────────────────────────────────────────────┤
│  Browser                                                           │
│                                                                    │
│  _radePlayPCM() → AudioContext.createBuffer(16000 Hz) → speaker   │
└────────────────────────────────────────────────────────────────────┘
```

---

## RADEL gegenüber RADEU

RADE v1 wird stets über SSB übertragen. Konventionell gilt:

| Betriebsart | Seitenband | Zu verwenden auf den Bändern             |
|-------------|------------|------------------------------------------|
| RADEL       | LSB        | 160 m, 80 m, 40 m  (≤ 10 MHz)           |
| RADEU       | USB        | 20 m, 17 m, 15 m, 12 m, 10 m (> 10 MHz) |

---

## Voraussetzungen

| Anforderung | Version | Anmerkungen |
|---|---|---|
| PhantomSDR-Plus | beliebig | mit Vite-/Svelte-Frontend |
| Linux | Ubuntu 24.04+ / Debian Bookworm+ | getestet |
| Python | 3.8+ | für `rade_helper.py` und `radae_rxe.py` |
| radae-Repository | aktueller master | liefert `radae_rxe.py` und `lpcnet_demo` |
| cmake | 3.10+ | um `lpcnet_demo` aus radae zu bauen |
| PyTorch | 2.0+ | von `radae_rxe.py` benötigt |
| Node.js | 16+ | für `npm run build` |
| websockets (Python) | 10–16+ | `pip3 install websockets` — alle Versionen unterstützt |
| matplotlib | beliebig | von `radae_rxe.py` beim Import benötigt |
| numpy | 1.23+ | erforderlich; ermöglicht auch Resampling |
| scipy | beliebig | optional, ermöglicht genaues Resampling |

---

## Installation von Hand

`./install_rade.sh` erledigt die gesamte Installation. Wenn Sie es selbst tun wollen — auf einem System, das das Skript nicht abdeckt, oder um einen Schritt zu reparieren — steht das Verfahren in der **[RADE v1 — Anleitung zur manuellen Installation](RADE_General_INSTALL_MANUAL_LINUX.md)**, und nur dort. Sie deckt Ubuntu, Debian, Fedora, Arch und Raspberry Pi OS in einem Durchgang ab:

| | |
|---|---|
| Schritt 1 | Systempakete und die Prüfung auf Node.js 22+ |
| Schritt 2 | Python-Pakete, einschließlich der PEP-668-Option und des CPU-only-torch-Wheels |
| Schritt 3 | Das radae-Repository klonen und bauen, `lpcnet_demo` und die Modellgewichte prüfen |
| Schritt 4 | Die Dekodierkette offline überprüfen, bevor sie an den Browser angeschlossen wird |
| Schritt 5 | Das PhantomSDR-Plus-Frontend bauen |
| Schritt 6 | Steuerung des Sidecars |
| Schritt 7 | Port 8074 öffnen |
| Schritte 8–10 | Server starten, RADE überprüfen, im Browser nutzen |

Der Rest dieses Dokuments setzt das als erledigt voraus.

---

## Die gepatchten Dateien ausbringen

Kopieren Sie die folgenden Dateien aus dem Patch-Satz in Ihr PhantomSDR-Plus-Repository.

### Neue Datei — in das Wurzelverzeichnis des Repositories legen, neben das von Ihnen genutzte Startskript:

```
rade_helper.py
```

### Gepatchte Frontend-Dateien — nach `frontend/src/` legen:

```
audio.js
App.svelte
```

### Was die Patches bewirken

**`audio.js`** — 5 Änderungen:
- Konstruktor: 5 neue RADE-Zustandsfelder (`decodeRADE`, `_radeSideband`, `_radeSocket`, `_radeCallback`, `_radeReady`, `_radeNextTime`)
- Speichern des PCM vor der Anhebung: `pcmArrayPreBoost` wird vor der 300-fachen FLAC-Anhebung gesichert, damit RADE die ursprüngliche Amplitude erhält (die Anhebung würde `radae_rxe.py` übersteuern)
- `playAudio()`: RADE-PCM-Abgriff mit dem Audio vor der Anhebung, vor Stumm-/Rauschsperre
- `playAudio()`: Wächter `if (this.decodeRADE) return` — unterdrückt die rohe SSB-Wiedergabe, während die von RADE dekodierte Sprache läuft
- Neue Methoden: `setRADEDecoding()`, `setRADECallback()`, `_radePlayPCM()` mit lückenloser, geplanter Wiedergabe über die Uhr `_radeNextTime` (spielt mit **16000 Hz** — der Ausgaberate von `lpcnet_demo`)

**Jede Svelte-Variante** — 6 Änderungen:
- `demodulationDefaults`: RADEL `{type:'LSB', offsets:[2200,-700]}`, RADEU `{type:'USB', offsets:[-700,2200]}` — der Durchlassbereich beginnt 700 Hz vom Träger und ist 1500 Hz breit
- Zustandsvariablen: `radeEnabled`, `radeConnected`, `radeSynced`, `radeSnr`, `_radeDeactivate()`
- `_radeDeactivate()`: stoppt den Decoder und **stellt die Standardbetriebsart des Bandes** aus `bands-config.js` wieder her — identisches Verhalten zum Abschalten von FAX, NAVTEX, FSK
- `_deactivateAll()`: RADE-Aufräumzeile
- `activateSelectedDecoder()`: Zweige `radel` und `radeu`
- Decoder-Auswahlmenü: zwei neue `<option>`-Einträge
- Statusfeld: Verbindungspunkt, Sync-/SNR-Status, Fehlerbanner

### Startskripte

Die Startskripte des Empfängers (`start-rx888mk2.sh`, `start-airspyhf.sh`, `start-rtl.sh`, `start-rsp1a.sh`, `start-fobos-hf.sh`, `start-fobos.sh`, `start-hackrf.sh`) starten das Sidecar selbst, sobald der Server läuft, und `stop-websdr.sh` stoppt es zusammen mit dem Server. `rade.sh` bleibt für den eigenständigen Betrieb des Sidecars — siehe [Steuerung des Sidecars](#steuerung-des-sidecars).

---

## Steuerung des Sidecars

**Normalerweise brauchen Sie kein eigenes Steuerskript für RADE.** Die Startskripte des Empfängers (`start-rx888mk2.sh`, `start-airspyhf.sh`, `start-rtl.sh`, `start-rsp1a.sh`, `start-fobos-hf.sh`, `start-fobos.sh`, `start-hackrf.sh`) starten das Sidecar selbst, sobald der Server bestätigt läuft, starten es neu, wenn es sich beendet, und melden seinen Zustand in ihrer Abschlusszusammenfassung — `✔ RADE sidecar running`, oder ein `·`-Hinweis, warum es nicht aktiviert wurde (nicht installiert, `RADE_ENABLED=0`, oder kein `python3`). `./stop-websdr.sh` stoppt es zusammen mit dem Server. Um den Server ohne RADE zu betreiben, starten Sie ihn mit `RADE_ENABLED=0`.

`rade.sh` bleibt für den eigenständigen Betrieb erhalten — das Sidecar ohne den PhantomSDR-Plus-Launcher zu betreiben oder es allein zu testen:

```bash
chmod +x ~/PhantomSDR-Plus/rade.sh
cd ~/PhantomSDR-Plus
./rade.sh start      # start sidecar with self-restarting watchdog
./rade.sh stop       # stop sidecar + watchdog + all lpcnet_demo children
./rade.sh restart    # stop then start cleanly
./rade.sh status     # show running / stopped + process info
```

Die Sidecar-Aktivität wird nach `~/PhantomSDR-Plus/rade.log` protokolliert:

```bash
tail -f ~/PhantomSDR-Plus/rade.log
```

> **Mischen Sie beides nicht, während der Server läuft.** Ist der Watchdog eines Startskripts aktiv, holt er das Sidecar innerhalb von etwa fünf Sekunden zurück, sodass `./rade.sh stop` wie ein Fehlschlag aussieht. Um RADE bei laufendem Server zu stoppen, starten Sie den Server entweder mit `RADE_ENABLED=0` oder halten Sie mit `./stop-websdr.sh` alles an.

> Wenn Sie `rade.sh` eigenständig betreiben, **verwenden Sie immer `./rade.sh stop`** — ein bloßes `pkill -f rade_helper.py` schlägt seinen eigenen Watchdog nicht, der den Prozess binnen 3 Sekunden neu startet.

---

## Port 8074

Das Sidecar lauscht auf TCP-Port **8074**, und der Browser verbindet sich direkt damit; der Port muss also von außen erreichbar sein. Wie man ihn öffnet — ufw, firewalld, iptables, die NAT-Regel im Router und der Nginx-Proxy für den Fall, dass ein Provider den Port ganz sperrt — steht in [Schritt 7 der manuellen Anleitung](RADE_General_INSTALL_MANUAL_LINUX.md).

Zwei Dinge sind es wert, hier wiederholt zu werden, weil sie die meiste Zeit kosten:

```bash
# Is the sidecar listening?
ss -tlnp | grep 8074
```

> **Warnung vor NAT-Hairpin:** Ein Test mit `curl` vom Server auf seinen eigenen öffentlichen Hostnamen liefert häufig `Connection refused`, auch wenn der Port offen ist — viele Router leiten den Verkehr nicht zurück. Testen Sie immer von einer Maschine außerhalb, oder nutzen Sie **https://portchecker.co**.

---

## RADE im Browser nutzen

1. Öffnen Sie Ihre PhantomSDR-Plus-Weboberfläche
2. Aktive Stationen finden Sie unter **[qso.freedv.org](https://qso.freedv.org)**
3. Stimmen Sie auf die Anzeigefrequenz der Station ab
4. Wählen Sie unter **Decoder Options**:
   - **RADE v1 — RADEL (LSB)** für 40 m / 80 m / 160 m
   - **RADE v1 — RADEU (USB)** für 20 m / 17 m / 15 m / 12 m / 10 m
5. Klicken Sie auf **Decoder: ON**

### Die Tasten RADEL / RADEU (ein Druck)

Die Schritte 4 und 5 lassen sich durch einen einzigen Druck ersetzen. Ein Tastenpaar **RADEL** / **RADEU** steht an drei Stellen zur Verfügung:

- neben der Überschrift **Modes selector** im Hauptpanel;
- im Popup-Fenster **Modes**;
- im Popup-Fenster **Bands**.

Ein Druck wählt den Decoder aus, schaltet den Decoder ON, schließt das Popup, in dem Sie gedrückt haben, und holt das RADE-Panel in den sichtbaren Bereich. Die Taste leuchtet blau, solange RADE läuft. **Ein erneuter Druck auf dieselbe Taste schaltet RADE ab** — das Panel schließt sich, und Betriebsart und Durchlassbereich werden wie unten beschrieben zurückgesetzt. Die Tasten, das Dropdown-Menü **Decoder Options** und die ON/OFF-Taste teilen sich denselben Zustand.

### Zustände der Anzeige im Bedienfeld

| Anzeige | Bedeutung |
|---|---|
| 🔴 Rot — „Connecting to sidecar…" | Port 8074 nicht erreichbar oder Sidecar läuft nicht |
| 🟡 Gelb — „Searching for signal…" | Sidecar verbunden, noch kein RADE-Rahmen erkannt |
| 🟢 Grün — „Synced · SNR x.x dB" | Dekodierung läuft — Sprache ist zu hören |

### Wenn Sie den Decoder abschalten

Betriebsart und Durchlassbereich kehren automatisch zum korrekten Standard für die aktuelle Frequenz zurück, wie in `bands-config.js` festgelegt — genau wie bei FAX, NAVTEX, FSK.

---

## Überprüfung und Fehlersuche

### Läuft der Sidecar?

```bash
ps aux | grep rade_helper | grep -v grep
ss -tlnp | grep 8074
```

### Aktivität live beobachten

```bash
tail -f ~/PhantomSDR-Plus/rade.log
```

Wenn sich ein Browser verbindet:
```
[RADE] client connected: x.x.x.x:XXXXX
[RADE] x.x.x.x:XXXXX  sps=12000 sideband=LSB
[RADE] x.x.x.x:XXXXX spawning pipeline (torch_threads=1)
```

### Schneller WebSocket-Rauchtest

```bash
python3 - << 'EOF'
import asyncio, websockets, json

async def test():
    async with websockets.connect('ws://localhost:8074') as ws:
        await ws.send(json.dumps({'type': 'init', 'sps': 8000, 'sideband': 'LSB'}))
        print(await ws.recv())   # expect: {"type": "status", "connected": true}

asyncio.run(test())
EOF
```

### Browserkonsole (F12)

```
[RADE] ▶ ENABLED LSB @ 12000 Hz → helper ws://localhost:8074
```
Gut — der WebSocket ist offen. Der Hz-Wert entspricht dem `audioOutputSps` Ihres Servers (typischerweise 8000–12000 Hz).

```
[RADE] sidecar socket error
```
Port 8074 ist nicht erreichbar — prüfen Sie Firewall und NAT-Regel des Routers.

---

## Umgebungsvariablen

| Variable | Standard | Beschreibung |
|---|---|---|
| `RADE_HELPER_PORT` | `8074` | TCP-Port, auf dem der Sidecar lauscht |
| `RADE_HELPER_HOST` | `0.0.0.0` | Bindeadresse (`127.0.0.1` hinter einem Proxy) |
| `RADAE_DIR` | `~/radae` | Wurzel des radae-Repositories |
| `RADE_MODEL` | `RADAE_DIR/model19_check3/checkpoints/checkpoint_epoch_100.pth` | Modellgewichte |
| `LPCNET_DEMO` | `RADAE_DIR/build/src/lpcnet_demo` | Binärdatei lpcnet_demo |
| `RADE_AUXDATA` | `1` | Auf `0` setzen, um `--noauxdata` an `radae_rxe.py` zu übergeben |
| `RADE_TORCH_THREADS` | `1` | PyTorch-/OpenBLAS-Threads je `radae_rxe.py`-Instanz — begrenzt die CPU-Last |
| `RADE_PIN_CORES` | `1` | Bindet jede Dekodierkette an einen eigenen Kernsatz; `0` deaktiviert das Pinning |
| `RADE_CORES_PER_CLIENT` | `2` | Zugewiesene Kerne pro Client, wenn Pinning aktiv ist |

---

## Geänderte Dateien

| Datei | Art | Anmerkungen |
|---|---|---|
| `rade_helper.py` | **Neu** | Python-Sidecar: WebSocket-Server + Dekodierkette aus zwei Prozessen |
| `frontend/src/audio.js` | Geändert | 4 Patches |
| `frontend/src/App.svelte` | Geändert | 6 Patches |
| `rade.sh` | **Neu** | Steuerskript für das RADE-Sidecar im eigenständigen Betrieb (start/stop/restart/status) |
| `start-rx888mk2.sh` | Geändert | startet, überwacht und meldet das Sidecar; ebenso `start-airspyhf.sh`, `start-rtl.sh`, `start-rsp1a.sh`, `start-fobos-hf.sh`, `start-fobos.sh`, `start-hackrf.sh` |
| `stop-websdr.sh` | Geändert | stoppt das Sidecar zusammen mit dem Server |
| `spectrumserver.cpp` | **Unverändert** | Keine C++-Änderungen erforderlich |

---

## Zusammenfassung des Signalflusses

```
Antenna → RX-888 MK2 → PhantomSDR-Plus C++ server
                              │
                    FFT + DDC + SSB demodulation
                    (USB or LSB — set by RADEL/RADEU)
                              │
                    Opus/FLAC encode → WebSocket → Browser
                              │
                         audio.js decode()
                              │
                         playAudio(pcmArray)
                              │
               ┌──────────────┴────────────────────────────┐
               │  rawPcm tap (before mute gate)             │
               │  real f32 → zero-padded complex f32 pairs  │
               └──────────────┬────────────────────────────┘
                              │ WebSocket binary → ws://host:8074
                              ▼
                       rade_helper.py
                              │ resample to 8000 Hz if needed
                              │ stdin pipe
                              ▼
          radae_rxe.py  --model_name model19_check3/.../checkpoint_epoch_100.pth
          (PyTorch FARGAN neural vocoder, auxdata ON by default)
                              │ stdout pipe (vocoder features f32)
                              ▼
          lpcnet_demo  -fargan-synthesis  -  -
                              │ stdout: s16 PCM @ 16000 Hz
                              │ sidecar converts s16 → f32
                              │ WebSocket binary frames → browser
                              ▼
                  audio.js  _radePlayPCM()
                  AudioContext.createBuffer(16000 Hz)
                              │
                           Speaker 🔊
```

---

## Fehlerbehebung

### Rotes Banner — „Sidecar not reachable"

```bash
# Is sidecar running?
ps aux | grep rade_helper | grep -v grep

# Start it manually for testing
python3 ~/PhantomSDR-Plus/rade_helper.py &

# Check port is open externally — use portchecker.co NOT curl from the server
# (curl from the server uses NAT loopback and gives false "Connection refused")
```

---

### Port 8074 auf portchecker.co trotz iptables-Regel geschlossen

Möglicherweise filtert der Provider den Port, oder die NAT-Regel des Routers fehlt. Möglichkeiten:

1. Einen anderen Port versuchen: `RADE_HELPER_PORT=8080 python3 rade_helper.py`
2. Über Ihren bestehenden öffentlichen Port per Nginx proxen (siehe [Schritt 7 der manuellen Anleitung](RADE_General_INSTALL_MANUAL_LINUX.md))

---

### `radae_rxe.py: error: unrecognized arguments: model_path`

Der Modellpfad muss mit `--model_name` übergeben werden, nicht als Positionsargument:

```bash
# WRONG — positional argument
python3 radae_rxe.py model19_check3/checkpoints/checkpoint_epoch_100.pth

# CORRECT — named argument
python3 radae_rxe.py --model_name model19_check3/checkpoints/checkpoint_epoch_100.pth
```

---

### `ModuleNotFoundError: No module named 'matplotlib'`

```bash
pip3 install matplotlib
```

`radae_rxe.py` importiert matplotlib bedingungslos am Dateianfang.

---

### `ModuleNotFoundError: No module named 'torch'`

```bash
pip3 install torch
```

---

### `lpcnet_demo: No such file or directory`

Der radae-Build wurde nicht abgeschlossen. Neu bauen:

```bash
cd ~/radae/build
cmake .. && make -j$(nproc)
ls src/lpcnet_demo     # should exist now
```

---

### Fehler `size mismatch` in `inference.sh`

`model19_check3` benötigt `--auxdata`, wenn mit `inference.sh` kodiert wird:

```bash
./inference.sh model19_check3/checkpoints/checkpoint_epoch_100.pth \
    wav/brian_g8sez.wav /dev/null \
    --rate_Fs --pilots --pilot_eq --eq_ls --cp 0.004 \
    --write_rx rx.f32 --auxdata    # ← required for model19_check3
```

Hinweis: Beim **Dekodieren** mit `radae_rxe.py` ist `--auxdata` der Standard — übergeben Sie es dort nicht.

---

### Gelbe Anzeige — „Searching for signal" — rastet nie ein

- Bestätigen Sie das richtige Seitenband: RADEL für ≤ 10 MHz, RADEU für > 10 MHz
- Prüfen Sie auf [qso.freedv.org](https://qso.freedv.org), ob gerade eine Station sendet
- RADE v1 nutzt 30 Träger in 1500 Hz Bandbreite — es erscheint als kompakte Gruppe im Wasserfall
- Rechnen Sie mit bis zu 1,5 Sekunden für das Einrasten

---

### `underrun!!!` von aplay beim Kettentest (Schritt 3)

Nur beim Offline-Test mit Dateien zu erwarten. `radae_rxe.py` verarbeitet langsamer als die Datei-Ein-/Ausgabe, wodurch der Audiopuffer leerläuft. Beim Live-Empfang tritt das nicht auf, weil der Browser den Ton in Echtzeit liefert.

---

### `ConnectionClosedError: received 1011 (internal error)`

Der Sidecar hat die WebSocket-Verbindung angenommen, ist aber intern abgestürzt, bevor er antworten konnte. Ursache ist eine inkompatible Version von `rade_helper.py` — eine ältere Version versuchte, einen asyncio-`StreamReader` als Standardeingabe eines Unterprozesses zu übergeben, was still fehlschlägt und mit Fehler 1011 schließt.

**Abhilfe:** Ersetzen Sie `rade_helper.py` durch die aktuelle Version aus dem Patch-Satz. Die aktuelle Version nutzt `os.pipe()` für die Interprozess-Pipe und ist mit websockets 10.x bis 16.x+ kompatibel.

---

### Mehrere gleichzeitige Nutzer

Jede Browserverbindung startet ihr eigenes, unabhängiges Paar aus `radae_rxe.py` + `lpcnet_demo`, sodass jeder Nutzer frei auf eine andere Frequenz abstimmen kann.

Standardmäßig nutzt `radae_rxe.py` **alle verfügbaren CPU-Kerne** für PyTorch-Matrixoperationen und verursacht damit rund 900 % CPU-Last pro Instanz. `rade_helper.py` begrenzt das mit zwei Optimierungen:

1. `OMP_NUM_THREADS=1` (sowie die MKL-/OpenBLAS-Entsprechungen) — begrenzt PyTorch auf 1 Thread
2. Mit numpy vektorisierte Audio-Konvertierungsfunktionen — beseitigen den Aufwand von Python-Schleifen

Ergebnis: Jede Instanz belegt grob **8–10 %** eines Kerns, genug für eine RADE-Dekodierung in Echtzeit. Falls Sie Tonaussetzer hören, erhöhen Sie auf 2 Threads:

```bash
RADE_TORCH_THREADS=2 ./start-rx888mk2.sh     # or your receiver's launcher
# standalone: RADE_TORCH_THREADS=2 ./rade.sh restart
```

| Gleichzeitige RADE-Nutzer | Ungefähre CPU-Last |
|---|---|
| 1 | ~9 % |
| 5 | ~45 % |
| 10 | ~90 % |
| 20 | ~180 % |

Auf einem i5-12450H (12 Threads), auf dem spectrumserver ~42 % und rx888_stream ~11 % belegen, haben Sie rund **1000 % Reserve** — genug für **20 und mehr gleichzeitige** RADE-Nutzer, bevor die CPU zum Problem wird.

> **Die obige Tabelle unterstellt, dass die CPU-Kosten linear mit der Nutzerzahl wachsen. Die Messung sagt etwas anderes.** Ein Lauf von `rade_loadtest.py` auf demselben i5-12450H zeigte bis etwa 24 Zuhörern eine CPU-Last je Zuhörer deutlich unter dieser Tabelle, darüber einen steilen Anstieg, wobei die Maschine bei **32 Zuhörern durch die Package-Temperatur** gestoppt wurde — nicht durch die CPU und nicht durch die Bandbreite. Behandeln Sie diese Zahlen nur als groben Anhaltspunkt für kleine Nutzerzahlen und messen Sie Ihre eigene Maschine: siehe [Gleichzeitigkeit auf eigener Hardware messen](#gleichzeitigkeit-auf-eigener-hardware-messen). Beachten Sie, dass der Lasttest die Kette mit Rauschen statt einem echten RADE-Signal speist; die absolute CPU-Last bei echtem Verkehr kann daher abweichen — verlässlich ist die *Form* der Kurve.

---

## Gleichzeitigkeit auf eigener Hardware messen

Die obigen Zahlen stammen von einer bestimmten Maschine. `rade_loadtest.py` (im Repository-Wurzelverzeichnis) misst dasselbe auf **Ihrer** — es fährt synthetische RADE-Zuhörer in Stufen gegen den Sidecar hoch und meldet die letzte Zuhörerzahl, die Ihre Maschine gehalten hat, bevor etwas nachgab.

Nach jeder Stufe lässt es die Maschine zur Ruhe kommen und erfasst dann Package-Temperatur, Gesamt-CPU, verfügbaren Arbeitsspeicher, Swap und die summierte RSS aller `radae_rxe.py`- und `lpcnet_demo`-Prozesse. Es stoppt beim ersten **Knick** — je nachdem, welche Grenze zuerst überschritten wird — und gibt die letzte stabile Zahl aus.

### Voraussetzungen

```bash
sudo apt install python3-websockets python3-psutil
```

Führen Sie es **auf dem SDR-Host** aus (es liest lokale Sensoren und den Prozessspeicher), während spectrumserver und der RADE-Sidecar bereits laufen:

```bash
cd ~/PhantomSDR-Plus
python3 rade_loadtest.py
```

Strg-C baut jederzeit alle Verbindungen sauber ab.

### Vor dem ersten Lauf

Öffnen Sie die Datei und prüfen Sie die beiden Blöcke am Anfang:

- **`CONFIG`** — `WS_URL` steht standardmäßig auf `ws://127.0.0.1:8074`; ändern Sie es, wenn Sie den Sidecar von seinem Standardport weggelegt haben. `RADE_SPS` (12000) und `RADE_SIDEBAND` (`USB`) sollten dem entsprechen, was Ihr Frontend meldet.
- **`handshake_messages()`** — der einzelne gesendete `init`-Rahmen muss zur RADE-Initialisierung in `frontend/src/audio.js` passen. Ist dieser Handshake auseinandergelaufen, scheitert jede Zuhörerverbindung und der Test endet sofort mit Verbindungsfehlern.

### Knickschwellen

Stellen Sie diese in `CONFIG` nach Bedarf ein — sie sind bewusst konservativ:

| Schwelle | Standard | Stoppt, wenn |
|---|---|---|
| `TEMP_KNEE_C` | `85.0` | Die Package-Temperatur diese Obergrenze erreicht |
| `MIN_AVAIL_MB` | `800` | Der verfügbare Arbeitsspeicher darunter fällt |
| `SWAP_GROWTH_MB` | `50` | Der Swap über den beim Start genommenen Ausgangswert wächst |
| `FAIL_LIMIT` | `3` | So viele Zuhörer in einer Stufe keine Verbindung aufbauen |
| `MAX_LISTENERS` | `60` | Harter Stopp, auch wenn nie ein Knick erreicht wird |

Die Form des Hochfahrens steuern `STEP` (je Stufe hinzugefügte Zuhörer, Standard 2), `SETTLE_S` (25 s Beruhigung vor der Messung — dadurch kann sich Wärme aufbauen) und `SAMPLE_S` (5 s CPU-Mittelungsfenster). Ein vollständiger Lauf bis zur Standardgrenze von 60 Zuhörern dauert daher rund 15 Minuten.

### Die Ergebnisse lesen

Jede Stufe gibt eine Zeile aus und hängt eine Zeile an `rade_loadtest.csv` an:

| Spalte | Bedeutung |
|---|---|
| `listeners` | In dieser Stufe verbundene synthetische Zuhörer |
| `connect_fails` | Zuhörer, die keine Verbindung aufbauen oder halten konnten |
| `pkg_c` | Package-Temperatur, Median aus 5 Messungen (spitzenresistent) |
| `cpu_pct` | CPU-Prozent des **Gesamtsystems**, nicht pro Zuhörer |
| `avail_mb` | Verfügbarer Arbeitsspeicher |
| `swap_mb` | Genutzter Swap |
| `dec_rss_mb` | Summierte RSS aller Decoder-Prozesse |
| `dec_procs` | Anzahl der Decoder-Prozesse — erwarten Sie **2 je Zuhörer** (`radae_rxe.py` + `lpcnet_demo`) |

#### Ein gemessener Lauf

Auf dem oben genannten i5-12450H endete ein vollständiger Lauf so:

```
KNEE at n=32: temp 91.0°C ≥ 85.0
Last stable concurrency: 30 RADE listeners
```

**Die Wärme war die bindende Einschränkung**, und zwar deutlich. Am Knick standen noch 7004 MB Arbeitsspeicher zur Verfügung — 6,2 GB oberhalb der `MIN_AVAIL_MB`-Grenze — und in jeder Stufe gab es null Verbindungsfehler.

Zwei Spalten lohnen genaues Lesen:

**`dec_rss_mb` überschätzt die tatsächlichen Speicherkosten.** Sie wächst sehr gleichmäßig um 295 MB je Zuhörer (292, 294, 294 … 295 über alle 16 Stufen), doch der *verfügbare* Arbeitsspeicher sinkt nur um etwa **202 MB je Zuhörer**. Die beiden Prozesse hinter jedem Zuhörer teilen sich Bibliotheksseiten, und die RSS zählt diese Seiten je Prozess einmal. Extrapoliert man die Steigung von `avail_mb`, käme der Speicherknick bei etwa **63 Zuhörern** — jenseits des harten Stopps bei 60 Zuhörern, auf dieser Maschine kann er also nie auslösen. Dimensionieren Sie den Speicher nach `avail_mb`, nicht nach `dec_rss_mb`.

**`cpu_pct` ist flach — und dann nicht mehr.** Sie liegt bis 24 Zuhörer bei ~5,3 % der gesamten Maschine und wird dann überlinear:

| Zuhörer | 24 | 26 | 28 | 30 | 32 |
|---|---|---|---|---|---|
| `cpu_pct` | 6,7 % | 18,4 % | 30,1 % | 49,6 % | 65,2 % |

Das ist ein 10-facher Anstieg der CPU-Last, während die Zuhörerzahl um ein Drittel wächst. Der Wendepunkt reproduziert sich über Läufe hinweg an derselben Stelle, betrachten Sie ihn also als Eigenschaft der Maschine und nicht als Rauschen — die CPU-Kosten je Zuhörer liegen unter dem Wendepunkt bei rund 3,4 % eines Kerns und darüber bei etwa 20 %. Extrapolieren Sie keine CPU-Zahl je Nutzer, die bei geringer Zuhörerzahl gemessen wurde.

> **Der Test hat keinen CPU-Knick.** Die vier Grenzwerte sind Temperatur, verfügbarer Arbeitsspeicher, Swap-Wachstum und Verbindungsfehler — die CPU wird erfasst, beendet den Lauf aber nie. Im obigen Lauf erreichte die CPU 65 % und wäre weiter gestiegen, hätte nicht zuerst die Temperatur ausgelöst. Wenn Ihnen eine CPU-Obergrenze wichtig ist, beobachten Sie die Spalte selbst oder ergänzen Sie eine Schwelle.

> **Was das belegt und was nicht.** Jeder synthetische Zuhörer streamt zufälliges Rauschen geringer Amplitude, kein echtes RADE-Signal. Das genügt, damit die gesamte Dekodierkette läuft und Ressourcen verbraucht — die Ressourcenzahlen sind also aussagekräftig. Über die Dekodier*qualität* oder die Tonkontinuität unter Last sagt der Test jedoch nichts. Bestätigen Sie das mit echten Zuhörern an einem echten Signal.

### Wenn Kerne vor dem Knick sättigen

RADE bindet je Instanz einen Thread fest, sodass einzelne Kerne ~90 °C erreichen können, während die Gesamt-CPU noch untätig wirkt. `rade_helper.py` verteilt die Ketten reihum über die Kerne, um dem entgegenzuwirken. Zeigt ein Lauf frühe thermische Knicke, erweitern Sie die Kernzuteilung je Client:

```bash
RADE_CORES_PER_CLIENT=3 ./rade.sh restart
```

Keine Dateiänderung nötig — das ist eine Umgebungsvariable (siehe [Umgebungsvariablen](#umgebungsvariablen)); `RADE_PIN_CORES=0` deaktiviert das Pinning vollständig.

---

## RADE v1 aktualisieren

Die Integration in PhantomSDR-Plus (`rade_helper.py`, Frontend-Patches) ist nur eine Brücke — die gesamte RADE-Dekodierlogik liegt im Repository `radae`. Aktualisierungen sind daher fast immer ein einfaches `git pull` plus Neubau, ohne Änderungen an PhantomSDR-Plus selbst.

### Standardaktualisierung (neuer Code, gleiches Modell)

```bash
# 1. Pull latest radae code
cd ~/radae
git pull

# 2. Rebuild lpcnet_demo (in case C code changed)
cd build
cmake ..
make -j$(nproc)

# 3. Restart the sidecar — no server restart needed
cd ~/PhantomSDR-Plus
./rade.sh restart
```

Das ist alles. Kein Frontend-Neubau, kein Serverneustart, keine Dateiänderungen.

### Nur neue Modellgewichte

Wird ein neuer Checkpoint veröffentlicht (z. B. `model20`) ohne Codeänderungen, richten Sie den Sidecar über die Umgebungsvariable auf die neuen Gewichte aus — ohne Datei zu bearbeiten:

```bash
# One-off: start with new model
RADE_MODEL=~/radae/model20/checkpoints/checkpoint_epoch_100.pth ./rade.sh start

# Or permanently — add to your shell profile (~/.bashrc):
export RADE_MODEL=~/radae/model20/checkpoints/checkpoint_epoch_100.pth
```

### Was welche Änderung erfordert

| Was sich in radae geändert hat | Erforderliche Maßnahme |
|---|---|
| Neue Modellgewichte (neue `.pth`-Datei) | `RADE_MODEL` setzen, `./rade.sh restart` |
| Codeänderung in `radae_rxe.py` | `git pull`, `./rade.sh restart` |
| C-Code von `lpcnet_demo` geändert | `git pull`, neu bauen, `./rade.sh restart` |
| `radae_rxe.py` umbenannt oder verschoben | Pfad `RADAE_RX` in `rade_helper.py` anpassen (eine Zeile) |
| Argument `--model_name` umbenannt | `radae_cmd` in `rade_helper.py` anpassen (eine Zeile) |
| Neue Ausgabeabtastrate (≠ 16000 Hz) | `SPS_OUT` in `rade_helper.py` + `createBuffer()` in `audio.js` anpassen |
| RADE v2 nutzt eine andere Binärdatei | `RADAE_RX` in `rade_helper.py` anpassen (eine Zeile) |

### Prüfen, ob die Aktualisierung gegriffen hat

Bestätigen Sie nach dem Neustart, dass der neue Code läuft:

```bash
# Check sidecar picked up new radae_rxe.py
./rade.sh status

# Tail log to see startup lines
tail -20 ~/PhantomSDR-Plus/rade.log
```

Das Protokoll sollte den erwarteten Modellpfad zeigen:
```
[RADE] model : /home/sv1btl/radae/model19_check3/checkpoints/checkpoint_epoch_100.pth
```

### Auf dem Laufenden bleiben

Abonnieren Sie die Releases-Seite des radae-Repositories, um über neue Modelle und Codeaktualisierungen benachrichtigt zu werden:

```
https://github.com/drowe67/radae/releases
```

Im FreeDV-Blog finden Sie Ankündigungen zu neuen RADE-Wellenformen und -Modellen:

```
https://freedv.org/blog/
```

---

*Entwickelt und getestet auf PhantomSDR-Plus (Fork sv1btl/PhantomSDR-Plus) mit RX-888 MK2 unter Ubuntu 24.04. Der C++-Server wird nicht verändert.*

*RADE wird von David Rowe VK5DGR und dem FreeDV-Team entwickelt.* *Siehe [freedv.org/radio-autoencoder](https://freedv.org/radio-autoencoder).*

---

### Vollständige Deinstallation und Neuinstallation

Hier der komplette Rückbau, bevor install_rade.sh erneut ausgeführt wird:
1. Den Sidecar stoppen cd ~/PhantomSDR-Plus && ./rade.sh stop
2. Das radae-Repository und den Build entfernen rm -rf ~/radae
3. torch entfernen (im Benutzerverzeichnis installiert) pip3 uninstall -y torch rm -rf ~/.local/lib/python3.11/site-packages/torch*
4. Python-Pakete aus apt entfernen (optional — überspringen, wenn andere sie nutzen) sudo apt-get remove -y python3-numpy python3-scipy python3-matplotlib python3-websockets sudo apt-get autoremove -y
5. Prüfen, dass alles weg ist python3 -c "import torch" 2>&1        # should say ModuleNotFoundError ls ~/radae 2>&1                        # should say No such file or directory
6. Neuinstallation chmod +x ~/PhantomSDR-Plus/install_rade.sh ~/PhantomSDR-Plus/install_rade.sh
