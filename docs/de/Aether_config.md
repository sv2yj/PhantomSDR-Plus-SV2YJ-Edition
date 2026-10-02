# Emulation von KiwiSDR-Clients

**AetherSDR, kiwiclient und andere KiwiSDR-Software mit PhantomSDR-Plus verbinden**

Seit v4.1.0 kann PhantomSDR-Plus auch das **KiwiSDR-Protokoll** beantworten, sodass Software, die für einen KiwiSDR geschrieben wurde — **AetherSDR**, `kiwiclient` und die übrigen — sich direkt mit Ihrem Empfänger verbindet. Es ist eine Brücke innerhalb desselben Serverprozesses, auf demselben Host und demselben Port, den Sie ohnehin veröffentlichen: kein zweiter Dienst, kein zweiter Port, kein Proxy.

**Sie ist aus, bis Sie sie einschalten.** Nichts an der Brücke läuft — kein Socket, keine Prüfung — solange `[kiwi_emulation]` fehlt oder `false` ist, und das ist der Zustand eines frisch installierten Baums.

---

## Inhaltsverzeichnis

1. [Was ein Kiwi-Client bekommt](#1-was-ein-kiwi-client-bekommt)
2. [Die Brücke installieren](#2-die-brücke-installieren)
3. [Einschalten](#3-einschalten)
4. [Konfigurationsreferenz](#4-konfigurationsreferenz)
5. [Einen Client verbinden](#5-einen-client-verbinden)
6. [Lautstärke](#6-lautstärke)
7. [Das S-Meter](#7-das-s-meter)
8. [Wasserfall und Spektrum](#8-wasserfall-und-spektrum)
9. [Wenn etwas nicht stimmt](#9-wenn-etwas-nicht-stimmt)
10. [Wie weit das geprüft wurde](#10-wie-weit-das-geprüft-wurde)

---

## 1. Was ein Kiwi-Client bekommt

| | |
|---|---|
| **Audio** | `ws://<host>:<port>/kiwi/<id>/SND` — demoduliertes Audio in der SND-Rahmung des Kiwi |
| **Wasserfall** | `ws://<host>:<port>/kiwi/<id>/W/F` — das Spektrum in Kiwi-W/F-Rahmen |
| **Abstimmen** | echt, nicht kosmetisch: `SET mod=…` vom Client ändert Frequenz, Seitenband und Durchlassbereich auf der PhantomSDR-Seite, genau wie es ein Browser-Hörer täte |
| **S-Meter** | gespeist aus der blockweisen Leistung des Demodulators, auf derselben Skala wie das Web-S-Meter |

Das Abstimmen wird für einen **reellen** Eingang unterstützt (`signal = "real"` in Ihrer `.toml`). Bei einem IQ-Eingang ist die Beziehung zwischen Bin und Frequenz eine andere und nicht implementiert; ein IQ-Empfänger liefert also Audio und Wasserfall, folgt aber der Abstimmung eines Kiwi-Clients nicht.

---

## 2. Die Brücke installieren

Die Brücke besteht aus Patches für die Backend-Quellen plus einer neuen Header-Datei, `src/kiwi_bridge.h`. Es gibt zwei Wege, sie einzuspielen.

**Mit dem Installationsprogramm.** `install.sh` (sowie `install_arch.sh`, `install_fedora.sh`, `install_opensuse.sh`) haben einen eigenen Schritt dafür — Schritt 17, *Kiwi client emulation*. Er wird angeboten, nicht erzwungen: Antworten Sie `n`, und es wird nichts gepatcht. Für einen unbeaufsichtigten Lauf entscheidet `PHANTOM_KIWI=y|n`; die Vorgabe ist ja.

**Auf einem bereits installierten Baum** führen Sie das Skript aus, das im Wurzelverzeichnis mitgeliefert wird:

```bash
cd ~/PhantomSDR-Plus
./kiwi_install.sh
./recompile.sh          # [1] Nur Backend wählen
```

`kiwi_install.sh` sichert jede Datei, die es anfasst, zuerst nach `backup_kiwi_bridge_<zeitstempel>/` und wendet jeden Patch über einen exakten Textvergleich an — findet es einen Anker nicht dort, wo es ihn erwartet (lokal veränderter Baum, andere Version), hält es sofort an, nennt die Datei und lässt sie unangetastet. Es ist idempotent: Auf einem Baum, der die Brücke bereits hat, meldet es jeden Patch als bereits angewendet und ändert nichts.

> **Wenn Sie gerade ein Update-Archiv eingespielt haben, das die Brücke bereits enthält, brauchen Sie es nicht auszuführen.** Die gepatchten Quellen liegen im Archiv; `kiwi_install.sh` würde Ihnen nur sagen, dass jeder Patch schon vorhanden ist.

Gepatcht werden `src/client.h`, `src/signal.cpp`, `src/waterfall.cpp`, `src/spectrumserver.h`, `src/spectrumserver.cpp`, `src/websocket.cpp` und `src/http.cpp`; `kiwi_bridge.h` wird nach `src/` kopiert.

> **Es installiert die Brücke, es aktualisiert sie nicht.** Schlägt ein Patch auf einem Baum *fehl*, auf dem die Brücke bereits funktioniert, ist die Quelle dem Skript vorausgeeilt — dann muss das Skript nachgezogen werden, nicht Ihr Baum.

---

## 3. Einschalten

Fügen Sie dies der `.toml` hinzu, mit der Ihr Empfänger tatsächlich läuft — derselben Datei, die Sie an `spectrumserver` übergeben, der in Ihrem `start-<radio>.sh` genannten. Nicht `config.example.*`:

```toml
[kiwi_emulation]
enabled = true
```

Dann den Empfänger neu starten:

```bash
./stop-websdr.sh
./start-<ihr-radio>.sh
```

`kiwi_install.sh` fügt den Block mit `enabled = true` für Sie in diejenigen von `config.toml`, `config-rx888mk2.toml`, `config-airspyhf.toml`, `config-rtl.toml`, `config-rsp1a.toml`, `config-fobos.toml`, `config-fobos-hf.toml` und `config-hackrf.toml` ein, die im Wurzelverzeichnis vorhanden sind. Von einer Konfiguration, die Sie anderswo oder unter anderem Namen führen, kann es nichts wissen, und **Update-Archive liefern niemals eine `.toml` mit**, sodass der Block nach einem Update von Hand zu setzen ist. Die mitgelieferten `config.example.*.toml` enthalten ihn dokumentiert und auf `false`.

---

## 4. Konfigurationsreferenz

Alles, was die Brücke liest, steht in einem einzigen Abschnitt `[kiwi_emulation]`. Nur `enabled` ist erforderlich; die vier Feineinstellungen haben alle den kalibrierten Wert als Vorgabe, ein Block mit nichts als `enabled = true` ist also bereits richtig.

| Schlüssel | Vorgabe | Wirkung |
|---|---|---|
| `enabled` | `false` | Das KiwiSDR-Protokoll überhaupt beantworten. Aus = vollständig untätig. |
| `audio_gain` | `0` | dB. Ausgangsverstärkung, nur für Kiwi-Clients. Siehe [Lautstärke](#6-lautstärke). |
| `smeter_offset` | `input.analog_smeter_offset` | dB. Überschreibt den S-Meter-Offset, nur für Kiwi-Clients. Siehe [Das S-Meter](#7-das-s-meter). |
| `wf_cal` | `0` | dB. Anzeigekorrektur für Wasserfall und Spektrum. Siehe [Wasserfall und Spektrum](#8-wasserfall-und-spektrum). |
| `wf_fps_max` | `23` | Wasserfallbilder pro Sekunde. Siehe [Wasserfall und Spektrum](#8-wasserfall-und-spektrum). |

Ein vollständig ausgefüllter Block mit den Werten, mit denen der Empfänger dieses Projekts läuft:

```toml
[kiwi_emulation]
enabled       = true
audio_gain    = 60.0    # dB, nur Kiwi-Clients. 0 = unverändert.
wf_cal        = -10.0   # dB, Geschmackssache. 0 = stimmt mit dem S-Meter überein.
wf_fps_max    = 28      # Bilder/s. 23 ist das Protokollmaximum.
# smeter_offset = 5.0   # dB. Vorgabe ist input.analog_smeter_offset.
```

> **Jeder dieser Schlüssel wird beim Start gelesen.** Eine Änderung ist ein **Neustart**, keine Neuübersetzung — `./stop-websdr.sh`, dann Ihr Startskript. Zum Nachstellen dieser Werte müssen Sie nie neu kompilieren.

Ganzzahlige und dezimale Schreibweise werden gleichermaßen akzeptiert: `28` und `28.0` werden identisch gelesen. Nur ein wirklich fehlender Schlüssel fällt auf seine Vorgabe zurück.

---

## 5. Einen Client verbinden

Richten Sie den Client auf dieselbe Adresse und denselben Port, die Ihre Hörer benutzen — kein Pfad, kein Präfix. AetherSDR fragt nach Host und Port; `kiwiclient` nimmt `-s` und `-p`:

```bash
# kiwiclient, 30 Sekunden 7100 kHz LSB aufzeichnen
python3 kiwirecorder.py -s ihr.empfaenger.example -p 8073 -f 7100 -m lsb --tlimit=30
```

Der Client stimmt ab, der Wasserfall füllt sich, das S-Meter zeigt an. Passiert überhaupt nichts, ist die Brücke mit ziemlicher Sicherheit noch abgeschaltet — siehe [Abschnitt 3](#3-einschalten).

---

## 6. Lautstärke

Das Erste, was den meisten auffällt: Ein Kiwi-Client klingt dünner als die PhantomSDR-Webseite. Das liegt nicht daran, dass die Brücke etwas verlöre: Ein Puffer speist jeden Encoder, und dieselbe Frequenz mit demselben Durchlassbereich, gemessen über den Audiopfad des Browsers und über `/SND`, liefert identische Samples. Die Webseite ist laut, weil `audio.js` den Klang im Browser neu aufbaut — Bassanhebung, Bandpass, Präsenzanhebung, ein Kompressor mit Makeup-Gain und der Lautstärkeregler. Ein Kiwi-Client hat davon nichts und kann es auch nicht bekommen.

`audio_gain` schließt die Lücke, nur für Kiwi-Clients:

```toml
[kiwi_emulation]
enabled    = true
audio_gain = 55.0       # dB, nur Kiwi-Clients. 0 = unverändert.
```

**Beginnen Sie bei etwa 55–60 dB.** 55 dB ist kein Rechenergebnis: Dort wurden ein Kiwi-Client und die PhantomSDR-Webseite auf gleichem Pegel gemessen, an einem starken Ortssender auf 729 kHz. In der Praxis wird oft etwas mehr bevorzugt — dieser Empfänger blieb bei 60 — wählen Sie es also nach Gehör.

Kaputtmachen können Sie das Audio damit nicht. Ein **vorausschauender Spitzenbegrenzer** sitzt zwischen der Verstärkung und der 16-Bit-Begrenzung: Jedes Sample wird um 4 ms verzögert, während die Verstärkung aus Audio berechnet wird, das noch nicht gesendet wurde. Eine laute Passage trifft also auf eine Verstärkung, die bereits für sie heruntergegangen ist, und Spitzen falten sich, statt abgeflacht zu werden. Bei 60 und selbst 70 dB — weit jenseits des Spielraums der reinen Verstärkung — wurde nicht ein Sample von einer Viertelmillion beschnitten. Unterhalb der Schwelle des Begrenzers ist die Verstärkung exakt 1,0; ein Empfänger, der das Audio nicht hart fährt, bekommt die Samples also unangetastet.

Ein zu hoher Wert kostet Lautstärke, nicht Qualität. Oberhalb von etwa 60 dB wird die zusätzliche Verstärkung schlicht weggeregelt: Gemessen stieg der Pegel von 55 auf 60 um etwa 1 dB und bewegte sich von 60 auf 70 kaum noch. Darüber hinaus kaufen Sie Kompression statt Lautstärke.

Nichts davon berührt die Webseite, und nichts davon bewegt das S-Meter — das kommt aus der Leistung des Demodulators, nicht aus den Audiosamples. Lauter drehen kann das Meter also nicht zum Lügen bringen.

---

## 7. Das S-Meter

Das Kiwi-S-Meter wird nicht separat kalibriert: Es bildet nach, was Ihre Webseite anzeigt, Stufe für Stufe. Die blockweise Leistung des Demodulators ist für beide der Ausgangspunkt; die Seite wendet dann `input.analog_smeter_offset` an, spreizt das Ergebnis um etwa −130 dBm und addiert ihren eigenen Anzeige-Offset. Die Brücke tut dasselbe, sodass ein Kiwi-Client und die Seite dasselbe Signal mit derselben Stärke zeigen — an einem starken Ortssender überprüft, wo beide −37 dBm lasen.

Wenn — und nur wenn — Kiwi-Clients anders anzeigen sollen als Ihre Seite, geben Sie der Brücke einen eigenen Offset:

```toml
[kiwi_emulation]
enabled       = true
smeter_offset = 5.0     # ersetzt input.analog_smeter_offset, nur für Kiwi-Clients
```

> **Vergleichen Sie die beiden Anzeigen mit demselben Filter — oder gar nicht.** Der Wert kommt aus der Leistung im Durchlassbereich, ein breiteres Filter sammelt also mehr Rauschen und zeigt mehr an: Auf einem ruhigen Band maß dieselbe Frequenz bei 9 kHz Bandbreite 5,6 dB stärker als bei 2,4 kHz. Ein Kiwi-Client mit 6-kHz-Filter gegen eine Webseite mit 2,4 kHz weicht um mehrere dB ab, wie auch immer beide kalibriert sind. Gleichen Sie zuerst Betriebsart und Bandbreite an.

> **Das ist die Skala der Seite, keine physikalische.** Das Web-Meter spreizt seinen Bereich der Lesbarkeit halber, sodass 10 dB tatsächlicher Signaländerung als etwa 11 angezeigt werden. Sie nachzubilden heißt, dass Kiwi-Clients mit Ihrem Empfänger übereinstimmen und von einem echten KiwiSDR um einen mit der Signalstärke wachsenden Betrag abweichen. Das ist der richtige Kompromiss, wenn Ihre eigene Seite die Referenz ist, an der alle messen; soll die Brücke lieber physikalisch ehrlich bleiben, ist dies der Abschnitt, den Sie ändern.

---

## 8. Wasserfall und Spektrum

### Die dB-Skala — `wf_cal`

Jeder Wasserfall-Bin wird vor dem Senden in echte dBm umgerechnet, auf dieselbe Skala, auf die das S-Meter kalibriert ist. Ein Träger zeigt daher **bei jedem Zoom denselben Pegel**, so wie es ein echter KiwiSDR liefert, und das Spektrum stimmt über denselben Durchlassbereich mit dem S-Meter der Webseite überein.

```toml
[kiwi_emulation]
enabled = true
wf_cal  = 0.0           # dB, nur Kiwi-Clients
```

> **`wf_cal` ist keine Kalibrierung.** `0` ist der Wert, bei dem das Spektrum mit Ihrem S-Meter übereinstimmt, und dabei sollten Sie es belassen, wenn die Zahlen etwas bedeuten sollen. Es existiert, weil es Geschmackssache ist — und eine Frage dessen, was Ihr Client mit dem Bereich anstellt —, wie *stark* ein Spektrum aussehen soll: Der Empfänger dieses Projekts läuft mit `-10`, schlicht weil das in AetherSDR richtig aussieht. Ein Wert bewegt Spektrum und Wasserfall gemeinsam: Es sind dieselben Bytes auf der Leitung, und das Kiwi-Protokoll kann sie nicht getrennt skalieren. Sollen sie sich unterscheiden, muss das aus den Anzeigereglern des Clients kommen.

Zur Prüfung der Skala vergleichen Sie den über den Durchlassbereich summierten Wasserfall mit dem S-Meter auf einer **ruhigen** Frequenz. Auf einem Träger schließt ein SSB-Durchlassbereich den Träger selbst aus, und die beiden sind nicht vergleichbar.

### Die Bildrate — `wf_fps_max`

Ein Kiwi-Client fordert den schnellsten Wasserfall an, den er haben kann (`SET wf_speed=4`), und richtet sein Scrollen — und seine Spektrumsmittelung — nach der Rate, die der Server zu liefern verspricht. Weichen die beiden voneinander ab, wirkt die Anzeige träge, obwohl nichts tatsächlich zu spät kommt.

Der Empfänger erzeugt `2 × sps / fft_size` Spektren pro Sekunde. Kiwi-Clients werden aus jedem einzelnen davon bedient und auf die angeforderte Rate ausgedünnt; die Webseite behält ihren eigenen, langsameren Takt und bleibt unberührt.

```toml
[kiwi_emulation]
enabled    = true
wf_fps_max = 23         # Bilder pro Sekunde
```

`23` ist das vom KiwiSDR-Protokoll selbst genannte Maximum und die sichere Vorgabe. **Es gewinnt immer der kleinere Wert von `wf_fps_max` und der Eigenrate des Empfängers**, ein Heraufsetzen bewirkt also nur dann etwas, wenn Ihre FFT schnell genug ist, um Bilder übrig zu haben. Beispiel für einen Empfänger mit 60 MS/s und 4194304-Punkt-FFT — `2 × 60000000 / 4194304 = 28,6` Bilder pro Sekunde:

| `wf_fps_max` | geliefert |
|---|---|
| fehlt (Vorgabe 23) | 23,0 fps |
| `28` | 28,0 fps |
| `40` | 28,6 fps — die Eigengrenze des Empfängers gewinnt |

Auch `SET wf_speed` vom Client wird beachtet: `0` aus, `1` = 1 fps, `2` ein Viertel des Maximums, `3` die Hälfte, `4` das Maximum. Ein Client an einer dünnen Leitung kann also weniger anfordern.

> **Ob ein Heraufsetzen hilft, entscheidet der Client, nicht der Server.** Ein Client, der jedes Bild beim Eintreffen zeichnet, gibt Ihnen ein flüssigeres Scrollen; ein Client, der sich auf die erwarteten 23 taktet, stellt die zusätzlichen Bilder schlicht in die Warteschlange, und die Verzögerung wächst. Probieren Sie es aus, und wenn der Wasserfall träger statt flüssiger wirkt, stellen Sie wieder auf `23`.

### Was die übrige Verzögerung bestimmt

Wer der Latenz nachgeht: Das meiste davon steckt nicht in der Brücke. Das Analysefenster ist `fft_size / sps` breit — 70 ms bei einer 4194304-Punkt-FFT und 60 MS/s — und ein Sample wartet zusätzlich bis zur Hälfte davon, bis der Vorschub voll ist. `fft_size` zu halbieren halbiert beides und verdoppelt die Bildrate, halbiert aber auch Ihre Frequenzauflösung, von der die Schmalband-Decoder (WSPR, FT8, CW) leben. Auf den meisten Empfängern ist das ein schlechter Tausch für einige zehn Millisekunden. Es ist eine Entscheidung in `[input]` und nichts, woran die Brücke etwas ändern könnte.

---

## 9. Wenn etwas nicht stimmt

Jeder Befehl, den ein Kiwi-Client sendet, wird nach **`/tmp/kiwi_retune.log`** geschrieben — die Abstimmwünsche, die Betriebsartwechsel, die Anmeldung und alles, was die Brücke nicht erkannt hat. Das kostet nichts Messbares und ist dafür gedacht, dauerhaft dort zu bleiben. Verhält sich ein Client sonderbar, zeigt diese Datei, was er tatsächlich verlangt hat — was meist die ganze Antwort ist.

| Symptom | Nachsehen bei |
|---|---|
| Client verbindet sich und fliegt sofort raus | `[kiwi_emulation] enabled = true` fehlt in der Konfiguration, mit der der Server **gestartet wurde** |
| Kein Audio, kein Wasserfall, keine Logzeilen | das Backend wurde nach `kiwi_install.sh` nicht neu übersetzt — `./recompile.sh`, Option `[1]` |
| `kiwi_install.sh` bricht bei einem Patch ab | die Meldung nennt Datei und Anker; der Baum weicht von dem ab, was der Patch erwartet, und diese Datei blieb unangetastet |
| Audio vorhanden, aber dünn und leise | erwartet — `audio_gain` setzen, siehe [Abschnitt 6](#6-lautstärke) |
| Wasserfall scrollt träge | `wf_fps_max`, siehe [Abschnitt 8](#8-wasserfall-und-spektrum) |
| Abstimmen im Client bewirkt nichts | ein IQ-Eingang (`signal = "iq"`); das Abstimmen ist nur für reelle Eingänge umgesetzt |
| Eine geänderte Einstellung wirkt nicht | diese Schlüssel werden beim Start gelesen — Empfänger neu starten |

> **Die AGC liegt beim Client.** `SET agc=` von einem Kiwi-Client wird angenommen und ignoriert — das Audio kommt mit der AGC von PhantomSDR an, und die AGC-Regler des Clients wirken auf das, was er empfängt.

---

## 10. Wie weit das geprüft wurde

Das Leitungsformat wurde gegen einen laufenden Empfänger geprüft und Zeile für Zeile gegen den Quelltext der beiden Clients gelesen, auf die es zielt — AetherSDRs `KiwiSdrProtocol.cpp` und kiwiclients `kiwi/client.py`. Rahmenaufbau und -größe, Sequenznummern, Bytereihenfolge, die S-Meter-Skala, das Abstimmen und der Wasserfall stimmen überein. Die Brücke wurde außerdem **mit der AetherSDR-Desktop-Anwendung selbst als funktionierend bestätigt**, durch den Betreuer, gegen diesen Empfänger.

An diesem Empfänger gemessen, mit einem Testclient an den laufenden Sockets: Das Abstimmen greift in 35–50 ms, das Audio läuft in Echtzeit ohne Drift, und der Wasserfall liefert die eingestellte Rate ohne Stocken und ohne verlorene Bilder.

Sollte auf Ihrer eigenen Installation doch etwas falsch aussehen, ist `/tmp/kiwi_retune.log` die erste Anlaufstelle — und eine Rückmeldung ist in jedem Fall willkommen.

---

**Siehe auch:** [Installationsanleitung](INSTALLATION.md) · [Projektstruktur](PROJECT_STRUCTURE.md) · [Benutzerhandbuch](USER_GUIDE.md)
