# Verbindungslimits — Sysop-Handbuch

**Einen öffentlichen Empfänger vor Verbindungsfluten schützen.**

Ein WebSDR ist ein öffentlicher Dienst, der jedem, der danach fragt, einen fortlaufenden Strom aus Audio und Spektrum liefert. Genau das ist sein Zweck — und genau darin liegt das Problem: für den Server sieht ein normaler Hörer nicht anders aus als jemand, der Sitzungen in einer Schleife öffnet. Am 16. September 2026 traf es diesen Empfänger genau so — eine einzige Adresse öffnete 134 Hörsitzungen innerhalb einer Minute und hielt 181 davon gleichzeitig offen, während das echte Publikum der Station bei etwa einem Dutzend lag.

Dieses Handbuch beschreibt die drei Schichten, die das verhindern, was jede von ihnen leisten kann und was nicht, und woran Sie erkennen, ob Ihre vernünftig eingestellt sind.

> **Wenig Zeit?** Die Beispiel-`config.toml` bringt bereits sinnvolle Werte mit, eine frische Installation ist also ohne Ihr Zutun geschützt. Wenn Ihre eigene `.toml` älter ist und außer `audio`/`waterfall`/`events` keine `[limits]`-Schlüssel enthält, sind die Limits pro Adresse schlicht **aus** — kopieren Sie den Block aus dem Beispiel, um sie einzuschalten. Der eine Befehl, den Sie danach kennen sollten, ist `grep Refused spectrumserver.log`: er sagt Ihnen, ob jemand abgewiesen wird.

---

## Inhalt

1. [Wogegen Sie sich tatsächlich verteidigen](#1-wogegen-sie-sich-tatsächlich-verteidigen)
2. [Die drei Schichten](#2-die-drei-schichten)
3. [Limits pro Adresse — die Hörer-Politik](#3-limits-pro-adresse)
4. [Untätige Verbindungen — der stille Angriff](#4-untätige-verbindungen)
5. [Der Kernel-Schutz — `setup-firewall.sh`](#5-der-kernel-schutz)
6. [Konfigurationsreferenz](#6-konfigurationsreferenz)
7. [Was ein abgewiesener Hörer sieht](#7-was-ein-abgewiesener-hörer-sieht)
8. [Logs und Zähler lesen](#8-logs-und-zähler-lesen)
9. [Ihre Zahlen wählen](#9-ihre-zahlen-wählen)
10. [Fallen, die man kennen sollte](#10-fallen-die-man-kennen-sollte)
11. [Alles wieder abschalten](#11-alles-wieder-abschalten)

---

## 1. Wogegen Sie sich tatsächlich verteidigen

Genauigkeit lohnt sich hier, denn das Wort „DDoS“ deckt zwei sehr verschiedene Dinge ab, und nur eines davon lässt sich auf der eigenen Maschine lösen.

**Flut aus einer Quelle.** Ein Rechner, oder eine Handvoll, die so schnell Verbindungen öffnen wie sie können. Das ist hier passiert, und es ist vollständig behebbar: die Verbindungen kommen von einer Adresse, die man zählen kann, und Zählen genügt.

**Ein echter verteilter Angriff.** Tausende Rechner, oft mit gefälschten Absenderadressen, die Ihre Anbindung füllen. Wenn diese Pakete Ihre Netzwerkkarte erreichen, ist die Bandbreite bereits verbraucht. **Nichts aus diesem Handbuch hilft dagegen**, und nichts, was Sie auf dem Server installieren, kann es — die einzige Antwort ist ein Dienst oberhalb von Ihnen, was ein anderes Thema ist und eine echte Domain sowie einen Anbieter wie Cloudflare vor dem Empfänger voraussetzt.

Alles Folgende betrifft den ersten Fall. Das ist keine Einschränkung, für die man sich entschuldigen müsste: der erste Fall ist das, was Amateurstationen tatsächlich trifft.

---

## 2. Die drei Schichten

```
   das Internet
        │
        ▼
   ┌─────────────────────────────────────────────────────────┐
   │  1. nftables          setup-firewall.sh                 │
   │     grob, billig, nimmt Last weg bevor irgendetwas      │
   │     sie liest                                           │
   └─────────────────────────────────────────────────────────┘
        │
        ▼
   ┌─────────────────────────────────────────────────────────┐
   │  2. spectrumserver    [limits] in config.toml           │
   │     exakt, pro Hörer, weiß wer wer ist                  │
   └─────────────────────────────────────────────────────────┘
        │
        ▼
   ┌─────────────────────────────────────────────────────────┐
   │  3. der Browser       sagt warum, und versucht es nie   │
   │                       erneut                            │
   └─────────────────────────────────────────────────────────┘
```

Sie sind bewusst nicht redundant. Die Kernel-Schicht ist schnell, aber dumm — sie zählt Pakete von einer Adresse und weiß nichts über Hörer. Die Server-Schicht ist präzise, sieht eine Verbindung aber erst, wenn sie angenommen und ausgewertet wurde, was etwas kostet. Die Browser-Schicht existiert, damit ein abgewiesener Hörer erfährt, was passiert ist, statt auf eine Seite zu starren, die nie lädt.

---

## 3. Limits pro Adresse

### Was als ein Hörer zählt

Ein Hörer ist **eine `/audio`-Verbindung** — oder, wo `[kiwi_emulation]` eingeschaltet ist, **eine Kiwi-Sound-Verbindung**, die genau gleich zählt. Das ist dieselbe Einheit, die die Benutzerzahl, `users.json` und die Beschriftungen auf dem Wasserfall bereits verwenden, ein Kiwi-Client verbraucht also einen Platz und erscheint in der Benutzerliste wie ein Browser.

Das ist wichtig, weil ein einziger Browser-Tab auf dem Desktop **vier** Verbindungen zu Ihrem Server öffnet:

| Verbindung | Zweck |
|---|---|
| `/audio` | der demodulierte Audiostrom — **das ist der Hörer** |
| `/waterfall` | die Spektrumanzeige |
| `/events` | Benutzerliste, Frequenzen der anderen Hörer |
| `/chat` | das Chat-Fenster |

Ein Telefon auf `/mobile` öffnet zwei (`/audio` und `/chat`), weil es keinen Wasserfall hat. Ein Limit, das rohe Verbindungen zählte, würde also alle abweisen: drei Tabs sind zwölf Verbindungen.

### Die drei Schlüssel

```toml
[limits]
per_ip=3            # gleichzeitige Hörer von einer Adresse
per_ip_sockets=0    # gleichzeitige Verbindungen jeder Art; 0 ergibt per_ip * 4 + 4
per_ip_rate=40      # neue Verbindungen pro Minute von einer Adresse
per_ip_ban_s=600    # wie lange eine Adresse abgewiesen wird, die die Rate reißt
```

**`per_ip`** ist die Kennzahl, über die Sie nachdenken werden. Drei ist ein guter Anfang.

**`per_ip_sockets`** gibt es, weil `/audio` nicht das Einzige ist, was sich zu fluten lohnt. `/waterfall` ist der schwerste Strom, den Ihr Server erzeugt, und ein Limit, das nur Hörer zählt, ließe sich schlicht umgehen, indem man stattdessen Wasserfall-Verbindungen öffnet. Auf `0` belassen wird daraus `per_ip * 4 + 4`, was `per_ip` vollen Desktop-Tabs entspricht, mit etwas Luft für Verbindungen, die der Kernel nach einem Neuladen noch nicht abgeräumt hat.

**`per_ip_rate`** ist das, was eine Flut tatsächlich beendet. Ein Limit allein tut das nicht: eine Verbindung abzuweisen ist billig, aber nicht umsonst, und ein Angreifer kann so schnell neu verbinden, wie die Absagen zurückkommen, und dabei Ihre CPU mit Auf- und Abbau verheizen. Das Ratenlimit gibt ihm eine Sperre statt einer Antwort. Denken Sie daran, dass ein Tab vier kostet: 40/Minute sind also etwa zehn Seitenaufrufe pro Minute von einer Adresse.

> **Eine bewusste Reihenfolge.** Die Rate wird belastet, *bevor* das Gleichzeitigkeitslimit geprüft wird. Das wirkt verkehrt herum, bis man an eine Adresse denkt, die bereits an ihrem Limit sitzt und in einer Schleife neu verbindet: würde ihr jedes Mal die billige Absage „du bist am Limit“ antworten, sammelten sich nie Ratenverstöße an, und die Sperre, die die Schleife beendet, käme nie zustande.

### Wer ausgenommen ist

**Loopback wird nie limitiert.** Der Autorun-Tap für die Spot-Meldungen, das Admin-Panel und ein auf dem Serverrechner selbst geöffneter Browser kommen alle von `127.0.0.1`, und ließe man sie Plätze verbrauchen, würde Ihre eigene Station Ihre Hörer aussperren.

Das deckt auch `proxy.py` ab: Verbindungen über den Proxy erreichen `spectrumserver` von Loopback aus, und die echte Client-Adresse kommt im Header `X-Forwarded-For` an — und genau darauf sind die Limits geschlüsselt.

---

## 4. Untätige Verbindungen

Es gibt einen Angriff, den nichts von alledem sehen kann.

Eine TCP-Verbindung öffnen. Nichts senden. Sie offen halten.

So ein Gegenüber schließt nie eine Anfrage ab, erreicht also nie den Code, in dem die Limits pro Adresse leben — es gibt keinen Hörer, kein Client-Objekt, nichts, was einen Namen zum Zählen hätte. Ihn kostet es ein paar Bytes, Sie einen Dateideskriptor und einen Platz, solange sie gehalten wird.

```toml
[limits]
idle_per_ip=8       # untätige Verbindungen (vor der Anfrage) pro Adresse
idle_total=512      # Obergrenze über alle Adressen hinweg
```

Das Limit liegt auf dem **Wie viele**, nicht auf dem **Wie lange**, und diese Unterscheidung ist der ganze Entwurf. **Es gibt keine Frist für eine untätige Verbindung, und das mit Absicht.** Eine Frist scheint die naheliegende Antwort und ist eine Falle (siehe [§10](#10-fallen-die-man-kennen-sollte)): es gibt legitime Gegenstellen, die sich verbinden und dann lange schweigen, bevor sie sprechen. Was sie von einem Angriff unterscheidet, ist die Menge — eine legitime Gegenstelle hält eine solche Verbindung, ein Angreifer Tausende.

Eine untätige Verbindung lebt also, bis sie eine Anfrage stellt oder stirbt, und ihr Platz wird in beiden Fällen freigegeben.

`idle_total` begrenzt eine Flut, die über viele Quelladressen verteilt ist. Ist die Obergrenze erreicht, werden **neue** untätige Verbindungen abgewiesen, statt bestehende zu verdrängen — eine legitime, langlebige Verbindung ist also nie das, was Platz machen muss.

Beides greift in dem Moment, in dem der Socket angenommen wird, anhand der Adresse der Gegenstelle — es gibt noch keine Anfrage, also auch kein `X-Forwarded-For`. Das ist in Ordnung: Loopback wird nicht gezählt, was alles über `proxy.py` abdeckt, und eine direkte Flut bringt ihre eigene Adresse mit.

---

## 5. Der Kernel-Schutz

`setup-firewall.sh` installiert eine nftables-Tabelle, die Last abfängt, bevor `spectrumserver` auch nur ein Byte liest. Sie ist bewusst grob, und ihre Zahlen liegen deutlich über denen in `config.toml`, damit ein normaler Hörer nie von beiden erwischt werden kann.

```bash
./setup-firewall.sh --show        # Regeln ausgeben, nichts ändern
sudo ./setup-firewall.sh --check  # gegen Ihren Kernel prüfen
sudo ./setup-firewall.sh --apply  # laden, mit 60-Sekunden-Rückfall
sudo ./setup-firewall.sh --persist # beim Booten neu laden
sudo ./setup-firewall.sh --status  # die Paketzähler je Regel
sudo ./setup-firewall.sh --remove  # alles rückgängig machen
```

Vier Dinge sind abgedeckt: eine Obergrenze gleichzeitiger Verbindungen je Quelladresse auf Ihren Proxy- und Empfängerports, eine Rate neuer Verbindungen je Quelle, eine Bremse gegen SSH-Bruteforce und Windows-Dateifreigabe, die für alles außerhalb privater Adressbereiche geschlossen wird — `smbd` lauscht auf vielen Maschinen auf `0.0.0.0`, und ob das von außen erreichbar ist, hängt an einem Router, den das Skript nicht sehen kann.

Die Ports werden aus `admin_config.json` gelesen, derselben Datei, die `proxy.py` verwendet, es folgt also Ihrer Installation.

### Warum es Sie nicht aussperren kann

Zwei Eigenschaften, beide beabsichtigt:

- Die Policy der Tabelle ist **accept**, und sie verwirft nur ausdrücklich benannte Muster. Eine Regel, die nicht greift, lässt das Paket zu allem durch, was Sie sonst konfiguriert haben. Sie kann die Maschine nicht unerreichbar machen.
- **Bestehende Verbindungen werden in der allerersten Regel angenommen.** Die SSH-Sitzung, in der Sie tippen, ist von allem Folgenden nie betroffen.

Darüber hinaus bewaffnet `--apply` einen automatischen Rückfall: Regeln laden, dann innerhalb von 60 Sekunden bestätigen, sonst werden sie wieder entfernt. Sagen Sie nichts, schließen Sie das Terminal, verlieren Sie die Verbindung — das Regelwerk verschwindet von selbst.

Nutzen Sie dieses Fenster richtig. Prüfen Sie **von einem anderen Gerät, außerhalb Ihres eigenen Netzes**, dass der Empfänger noch lädt und dass sich eine *neue* SSH-Sitzung öffnen lässt. Der Test mit der Sitzung, die Sie schon haben, beweist nichts, denn sie wurde von Regel eins angenommen.

---

## 6. Konfigurationsreferenz

Jeder Schlüssel unten steht unter `[limits]` in Ihrer `.toml`-Datei. **Alle sind standardmäßig aus oder großzügig**, eine Konfiguration, die sie nicht erwähnt, verhält sich also genau wie bisher.

| Schlüssel | Vorgabe | Bedeutung |
|---|---|---|
| `per_ip` | `0` (aus) | Gleichzeitige Hörer pro Adresse |
| `per_ip_sockets` | `0` → `per_ip * 4 + 4` | Gleichzeitige Verbindungen jeder Art pro Adresse |
| `per_ip_rate` | `0` (aus) | Neue Verbindungen pro Minute pro Adresse |
| `per_ip_ban_s` | `600` | Sekunden Abweisung nach Reißen der Rate |
| `idle_per_ip` | `8` | Untätige Verbindungen vor der Anfrage, pro Adresse |
| `idle_total` | `512` | Untätige Verbindungen über alle Adressen |

Ein Schlüssel auf `0` schaltet die jeweilige Prüfung ab.

### Die drei, die keine Limits sind

In `[limits]` stehen außerdem `audio`, `waterfall` und `events`, von upstream PhantomSDR übernommen, und **keines der drei wird durchgesetzt.** `waterfall` und `events` werden von keinem Code gelesen. `audio` wird an genau einer Stelle gelesen: es geht als `max_users` in die Registrierungs-JSON an die Verzeichnisse aus `[websdr] register_urls`, ist also die Zahl, die sdr-list.xyz und die anderen anzeigen, und tut überhaupt nichts, wenn `register_online=false` gilt. Wenn Sie eine Obergrenze für Hörer wollen, ist `per_ip` weiter oben das, was wirkt.

### Noch einer, unter `[server]`

```toml
[server]
min_client_version=0
```

Kein Limit, sondern eine Abweisung — und weil sie denselben Schließcode verwendet, gehört sie hierher. Seiten melden den Stand, aus dem sie geladen wurden, als `/audio?v=N`, und alles unterhalb von `min_client_version` wird mit *„diese Seite ist veraltet — bitte neu laden“* abgewiesen.

Es gibt das, weil der Server JavaScript, das bereits im Browser eines Nutzers läuft, nicht mehr erreichen kann. Ein Tab behält den Code, den er geladen hat, bis jemand neu lädt; eine Änderung an der Seite erreicht also nur die Hörer, die zufällig neu laden — und eine Station, die gerade das Sitzungsverhalten geändert hat, braucht die alten Seiten unter Umständen jetzt weg und nicht irgendwann.

Geprüft wird nur `/audio`, denn dort lebt eine Sitzung, und Loopback sowie die Kiwi-Pfade sind ausgenommen, damit der Autorun-Tap und Kiwi-Clients unberührt bleiben. `0` schaltet es ab und ist die Vorgabe. Es eingeschaltet zu lassen, nachdem die alten Seiten abgeflossen sind, ist unbedenklich: Ein aktueller Diversity-Client, der auf einem blanken `/audio` abgewiesen wird, versucht es erneut mit der Kennung. Abgewiesen werden also nur noch Diversity-Clients mit einem älteren PhantomSDR-Plus-Stand und Fremdwerkzeuge, die `/audio` ohne `?v=` öffnen. Setzen Sie es zurück auf `0`, wenn eine andere Station meldet, dass sie Sie nicht mehr als Diversity-Partner nutzen kann.

---

## 7. Was ein abgewiesener Hörer sieht

### Nichts verbindet sich je neu

Fangen Sie hier an, denn davon hängt alles Weitere ab: **eine abgebrochene `/audio`-Verbindung beendet die Sitzung.** Es gibt kein automatisches Wiederverbinden, und das mit Absicht.

Wiederverbinden ist der richtige Reflex für eine Chat-Anwendung und der falsche für einen Empfänger. `/waterfall` und `/events` kamen damit nie zurück, eine erneut aufgebaute Sitzung war also eine lebende Audioverbindung an einem eingefrorenen Wasserfall; und das Anhalten des Servers räumte ihn nicht mehr, weil jeder Hörer Sekunden später wieder da war und die Benutzerliste mit Sitzungen füllte, in denen in Wahrheit niemand saß. Die Seite verstummt und der Hörer lädt sie neu — genau das tat dieser Empfänger, bevor überhaupt ein Wiederverbinden eingebaut wurde.

Für die Limits dieses Handbuchs fällt damit auch eine Falle weg: gegen ein Ratenlimit würde ein automatischer Versuch genau die Sperre verlängern, die er zu umgehen sucht.

### Die zwei Schließcodes

| Code | Bedeutung | Wer ihn sendet |
|---|---|---|
| **4003** | abgewiesen — über einem Limit pro Adresse, oder Seite veraltet | `spectrumserver` |
| **4001** | vom Sysop hinausgeworfen | `spectrumserver`, wenn das Panel `/~~kick` aufruft |

Beide liegen im privaten Bereich 4000–4999, können also nicht mit einem Protokollstatus verwechselt werden, und beide gelten auf jeder Seite als endgültig. Der Begründungstext reist im Schließ-Frame statt als Nachricht, weil das erste Frame auf `/audio` den Einstellungen des Empfängers vorbehalten ist und alles davor jede normale Verbindung zerstören würde.

### Auf der Seite

**Abgewiesen beim Laden der Seite** — der Hörer kommt gar nicht erst in Gang, also erklären sich beide Seiten. Der Desktop zeigt ein Feld: *„Dieser Empfänger hat die Verbindung abgewiesen“*, den Grund und den Hinweis, dass alle, die sich einen Internetanschluss teilen, als eine Adresse zählen. `/mobile` zeigt dasselbe in seinem Hinweisbereich.

**Abgewiesen oder hinausgeworfen mitten in der Sitzung** — die Desktop-Seite hört einfach auf, bewusst ohne Meldung: die Zeichenschleife des Wasserfalls hält an, mehr nicht. `/mobile` zeigt eine Zeile, die zum Neuladen auffordert — außer nach einem Rauswurf, dann schweigt auch sie.

Dieses Schweigen nach einem Rauswurf ist Absicht. **Hinauswerfen heißt, dass der Sysop eine Sitzung beendet, es ist keine Strafe** — es wird nichts verkündet, und wer zurück will, lädt die Seite neu und ist eine Sekunde später ein ganz gewöhnlicher Hörer. Das Einzige, was der Code 4001 bringt, ist, dass der Browser weiß: das war keine abgebrochene Verbindung — der Rauswurf greift also, statt sich selbst aufzuheben.

Den Rauswurf erledigt `spectrumserver` selbst, nicht `proxy.py`: Hörer verbinden sich direkt mit dem Port des Empfängers, der Proxy besitzt also keine ihrer Verbindungen und sein Rauswurf erreicht niemanden. Das Panel ruft `/~~kick?ip=&secs=` auf — nur über Loopback erreichbar und anhand des echten TCP-Gegenübers geprüft, nicht anhand von `X-Forwarded-For`, das vom Client kommt. `secs` ist standardmäßig null, also keine Sperre, nimmt aber eine Dauer an, wenn die Adresse doch eine Weile draußen bleiben soll; das nutzt dieselbe Sperrmechanik wie `per_ip_rate`, sodass der Wiederverbindungsversuch schon an der Tür abgewiesen wird.

## 8. Logs und Zähler lesen

### Der Server

```bash
grep Refused spectrumserver.log
```

```
Refused /audio from 203.0.113.5: too many simultaneous connections
Refused /audio from 198.51.100.7: too many connection attempts
```

Steht dort nichts, wird niemand abgewiesen. Die Protokollierung ist auf höchstens eine Zeile je Adresse alle fünf Sekunden gedrosselt — ohne das würde ein Angriff zu unbegrenzten Schreibzugriffen werden, und das ist nur ein langsamerer Weg, die Station lahmzulegen.

### Der Kernel

```bash
sudo ./setup-firewall.sh --status
```

Lesen Sie den **`counter packets N`** jeder Regel; das ist die Zahl der tatsächlich verworfenen Pakete. Lauter Nullen heißt, dass nichts blockiert wurde und Ihre Schwellen bequem locker sitzen.

Lassen Sie sich von den `elements = { ... }`-Listen in den Sets oberhalb der Regeln nicht beunruhigen. Das sind Ihre ganz normalen Hörer, die gegen die Limits *verfolgt* werden — ein Eintrag entsteht bei der ersten Verbindung einer Adresse und verfällt ein paar Minuten später. Verfolgen ist nicht Blockieren.

---

## 9. Ihre Zahlen wählen

Raten ist unnötig; Ihre eigenen Logs sagen es Ihnen. Das ist die Messung, die hier `per_ip=3` festgelegt hat, über eine Woche `logs/users_*.jsonl`:

| Gleichzeitige Sitzungen von einer Adresse | Anzahl Adressen |
|---|---|
| 1 | 682 |
| 2 | 54 |
| 3 | 13 |
| mehr als 3 | **8** |

758 verschiedene Adressen in sieben Tagen, und ein Limit von drei hätte acht davon berührt. Die Flut saß bei 181.

Um das auf Ihrer eigenen Station zu wiederholen, ordnen Sie die Sitzungs-IDs je Adresse in `logs/users_*.jsonl` einander zu und nehmen die größte Überlappung. Beachten Sie: das Log führt `tune`- und `disconnect`-Ereignisse, aber kein `connect`-Ereignis, der Beginn einer Sitzung muss also aus ihrem ersten `tune` erschlossen werden.

**Denken Sie an NAT.** Ein Verein, eine Schule, ein Büro oder ein Mobilfunkanbieter erscheinen als eine einzige Adresse, und alle dahinter teilen sich ein Kontingent. Das steckt in jedem Limit, das auf eine Adresse geschlüsselt ist; die einzige Abmilderung ist, eine Zahl zu wählen, mit der Sie leben können. Meldet ein Hörer je, dass er nicht verbinden kann, ist das der erste Verdacht — prüfen Sie `grep Refused` vor allem anderen.

---

## 10. Fallen, die man kennen sollte

### Niemals eine Frist für eine untätige Verbindung

Es gibt keinen `handshake_s`-Schalter mehr, und das ist der Grund. Eine Frist von 30 Sekunden für untätige Verbindungen sieht nach der naheliegenden Abwehr gegen einen Slowloris aus. Sie wurde gebaut, eingeschaltet und lieferte innerhalb einer Minute das hier:

```
Idle deadline: closed 1 connection(s) idle past 30s: 192.87.173.88
```

`192.87.173.88` ist `etgd-websdr.ewi.utwente.nl` — **der Rückruf-Host von websdr.org selbst**. Er verbindet sich zu Ihrem Server zurück und bleibt dann untätig, deutlich länger als 30 Sekunden, bevor er sein `GET /~~orgstatus` schickt. Die Frist schnitt ihn jedes Mal ab und die Registrierung hörte auf. Die Einstellung wurde entfernt statt als Option belassen: ein Selbstschuss, der Ihren Verzeichniseintrag zerstört, ist die sechzig Zeilen nicht wert, die ihn umsetzen.

**Dieselbe Überlegung gilt für `open_handshake_timeout` von websocketpp, das es weiterhin gibt.** Der Zehn-Minuten-Wert in `spectrumserver.cpp` sieht absurd aus und ist tragend: er ist es, der dem Rückruf von websdr.org das Untätigsein überhaupt erlaubt. Es gibt noch einen zweiten Grund — der `/~~orgstatus`-Handler antwortet aus einem Thread, der ein `dup()` des Sockets hält, und websocketpp beendet eine abgelaufene Verbindung mit `shutdown()`, einem Aufruf auf Socket-Ebene, der durch das Duplikat hindurchgreift und den Rückruf auch dann zerstören würde, wenn die Untätigkeit kein Thema wäre.

Wenn Sie stille Verbindungen begrenzen müssen, begrenzen Sie ihre Anzahl, nicht ihr Alter. Genau das sind `idle_per_ip` und `idle_total`.

### Eine nftables-Datei muss idempotent sein

`nft -f` **hängt an** eine bereits vorhandene Tabelle an, statt sie zu ersetzen. Eine Regeldatei ohne `delete table`-Präambel verdoppelt daher die gesamte Kette bei jedem Neuladen — und genau das tut eine naive systemd-Unit bei jedem Dienstneustart. `setup-firewall.sh` erzeugt die Präambel für Sie; schreiben Sie eigene Regeln, machen Sie es genauso.

```bash
sudo ./setup-firewall.sh --status | grep -c dport   # sollte 8 ergeben, nicht 16
```

---

## 11. Alles wieder abschalten

Die Server-Limits: Schlüssel auf `0` setzen oder aus der `.toml` löschen und den Empfänger neu starten. Es gibt keinen weiteren Zustand; nichts überdauert einen Neustart.

Die Firewall:

```bash
sudo ./setup-firewall.sh --remove
```

Das löscht die Tabelle, entfernt das gespeicherte Regelwerk und deaktiviert den Boot-Dienst. Ihre Maschine kehrt genau in den Zustand zurück, in dem sie vorher war — was auf den meisten Installationen bedeutet: gar keine Firewall. Das ist es wert, vorher bedacht zu werden.
