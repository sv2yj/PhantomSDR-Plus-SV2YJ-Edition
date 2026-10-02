# PhantomSDR-Plus — Empfangsdiversität (Receive Diversity)

Kombinieren Sie Ihren Empfänger mit einem **zweiten Empfänger an einem anderen Ort** und hören Sie jeweils denjenigen, der gerade das bessere Signal hat. Fällt der eine Standort in einen Schwund, hat der andere ihn meist nicht — und die Verbindung bleibt lesbar.

Der zweite Empfänger kann ein weiterer PhantomSDR-Plus, ein KiwiSDR, ein UberSDR oder ein WebSDR sein. Bei den ersten drei läuft alles im Browser: keine Serveränderungen, keine Konfigurationsdateien, nichts zu installieren und kein besonderer Zugang zum anderen Empfänger. Ein WebSDR ist die Ausnahme und braucht ein kleines Programm auf Ihrem eigenen Server — siehe [Einen WebSDR verwenden](#einen-websdr-verwenden) weiter unten.

---

## Was es tut und was nicht

Diversität bedeutet hier **Auswahl**: Sie hören zu jedem Zeitpunkt den einen oder den anderen Standort, mit einer kurzen Überblendung beim Wechsel. Es ist keine Phasengruppe und addiert die beiden Signale nicht.

Das ist bewusst so, und der Grund ist Physik, nicht Software. Zwei Empfänger in Hunderten von Kilometern Entfernung hören dieselbe Aussendung über unterschiedliche ionosphärische Wege. Die beiden Audio-Signalverläufe treffen mit unabhängiger Phase und leicht unterschiedlichem Doppler ein; addiert man sie, klingt das hohl und kammgefiltert — der klassische „phasige" Effekt. Echtes kohärentes Zusammenführen braucht zwei Empfänger an einem **gemeinsamen Takt**, abtastgenau ausgerichtet; zwei unabhängige Empfänger über das Internet können das nie leisten.

Der Gewinn ist deshalb **Kontinuität, nicht Signalstärke**:

- Auf einem stabilen Weg, auf dem ein Empfänger schlicht besser ist, hören Sie diesen und gewinnen nichts. Das ist normal.
- Auf einem flatternden Weg mit tiefem QSB sind Schwunderscheinungen an zwei entfernten Standorten weitgehend unkorreliert. Standort A fällt drei Sekunden aus, Standort B nicht, und das Audio läuft weiter. Erwarten Sie *„ich verliere keine Wörter mehr"*, nicht *„aus S3 wurde S7"*.
- Der zweite Gewinn ist oft **lokales Rauschen und QRM**. Zwei Standorte haben unterschiedliche Nachbarn, unterschiedliche Stromnetze und unterschiedliches Splatter. Auf einem verrauschten Band kann das mehr ausmachen als der Schwund.

Es hat einen Preis: Sie hören **ein bis drei Sekunden hinter der Echtzeit**, weil der frühere Datenstrom verzögert werden muss, um zum späteren zu passen. Für Hören und Dekodieren unerheblich, störend beim Versuch, eine Station zu arbeiten.

> [!NOTE]
> Die digitalen Decoder (FT8, JS8, WSPR, RADE und die übrigen) verwenden bewusst weiterhin Ihren **lokalen** Empfänger, nicht das kombinierte Audio. Diese Betriebsarten integrieren kohärent über einen ganzen Zeitschlitz, und ein Standortwechsel mitten im Schlitz ist eine Phasenunstetigkeit, die genau die Dekodierung kosten kann, die die Diversität retten sollte. Diversität bedient den Lautsprecher; die Decoder behalten den durchgehenden lokalen Datenstrom.

---

## Schnelleinstieg

1. Öffnen Sie das Feld **Receive Diversity** — es sitzt direkt unter den Decoder-Fenstern, zugeklappt, mit der Anzeige `Receive Diversity — off`. Klicken Sie darauf, um es aufzuklappen.
2. Wählen Sie, was der zweite Empfänger ist: **PhantomSDR+**, **KiwiSDR**, **UberSDR** oder **WebSDR**.
3. Tragen Sie seine Adresse ein — oder wählen Sie eine gespeicherte — und drücken Sie **Start**.
4. Stimmen Sie Ihren eigenen Empfänger normal ab. Der zweite **folgt automatisch** — Frequenz, Betriebsart und Durchlassbereich — bei jeder Abstimmung.

Das ist die gesamte Einrichtung. Am anderen Empfänger ist nichts zu konfigurieren, und es gibt keine getrennte Abstimmung: er folgt Ihnen immer.

### Adressen

| Zweiter Empfänger | Was Sie eintragen | Hinweise |
|---|---|---|
| PhantomSDR+ | `host:8900` | Der normale Port des Empfängers |
| KiwiSDR | `host:8073` | Der eigene Port des KiwiSDR |
| UberSDR | `host` | Sein **normaler Web-Port**, nicht 8073 |
| WebSDR | `host:8901` | Der eigene Port der Station. Braucht das Relay — siehe unten |

Ein reiner Hostname, eine `http://`-Adresse oder eine vollständige `ws://`-Adresse werden alle akzeptiert. Wird der andere Empfänger über HTTPS ausgeliefert, geben Sie den Hostnamen ein; die Verbindung wird dann verschlüsselt aufgebaut.

### Gespeicherte Empfänger

Jede verwendete Adresse wird gemerkt, in einer eigenen Liste je Empfängertyp — eine KiwiSDR-Adresse ist nie ein brauchbarer Vorschlag, wenn die Auswahl auf WebSDR steht. Die Listen liegen in Ihrem eigenen Browser: sie werden nirgendwohin gesendet, und jeder Hörer hat seine eigene.

Die Schaltfläche **☰** neben dem Adressfeld öffnet die Liste.

- **Namen.** Jeder Eintrag kann einen Namen bekommen — `Twente` liest sich besser als `websdr.ewi.utwente.nl:8901`. Benannte Einträge erscheinen grün über ihrer Adresse, und beim Tippen steht der Name neben der Adresse in der Vorschlagsliste. Ein Eintrag wird über seine Adresse identifiziert, ein Name bringt dieselbe Station also nie zweimal in die Liste. Solange die Diversität läuft, zeigt der gerade verwendete Empfänger seinen Namen **fett und langsam blinkend**, sodass die Liste auch sagt, welchen Sie tatsächlich hören.
- **add** trägt einen Empfänger von Hand ein, ohne ihn vorher zu verbinden. **✎** korrigiert Name und Adresse an Ort und Stelle, **✕** entfernt einen Eintrag, und **clear all** leert die Liste des gerade gewählten Typs. Enter speichert, Escape bricht ab.
- **🌍** öffnet die eigene Webseite dieses Empfängers in einem neuen Tab. Gespeichert ist die Adresse, die die Software anwählt, sie wird also zuerst in eine zum Browsen taugliche verwandelt — aus `ws://` wird `http://`, und der Pfad `/audio`, `/ws` oder beim KiwiSDR `/kiwi/…/SND`, den die jeweilige Empfängerart braucht, fällt weg, denn die Seite der Station liegt an der Wurzel. Es ist ein echter Link, mittlere Maustaste und langes Drücken verhalten sich wie gewohnt.
- **Die Reihenfolge gehört Ihnen.** Verschieben Sie eine Zeile mit **▲▼**, oder ziehen Sie sie an die Stelle, an die sie gehört. In dieser Reihenfolge bietet die Vorschlagsliste die Adressen an.
- **⭳ export und ⭱ import.** Die Listen liegen im Speicher des Browsers, der beim Löschen der Websitedaten verschwindet — genau davor schützt dies. Export schreibt alle vier Listen samt Namen in eine JSON-Datei, die Sie aufheben oder auf einen anderen Browser oder Rechner mitnehmen können. Import liest sie zurück und fragt, ob sie mit dem Gespeicherten **zusammengeführt** (merge) oder ob alles **ersetzt** (replace) werden soll.
- **▦ QR.** Zeichnet alle Listen als QR-Code auf den Bildschirm, um sie auf ein Telefon zu bringen — siehe „Auf dem Telefon“ weiter unten. Eine zum Scannen zu große Liste weicht auf den Text daneben aus, der sich überall einfügen lässt.

Wie viele Empfänger Sie behalten, ist nicht begrenzt.

### Auf dem Telefon

Die Seite `/mobile` bietet dieselbe Funktion in einem Reiter **Div**, neben Audio, Bands, Marks, Users und Chat: Empfängertyp, Adresse, Start und Stop, die gespeicherten Empfänger als Liste zum Antippen, die Live-Werte und der SNR-Trim. Jede Zeile trägt außerdem den Link **🌍** zur eigenen Seite des Empfängers. Der zweite Empfänger folgt der Abstimmung des Telefons von selbst, genau wie auf der Desktop-Seite. Was fehlt, ist das Bearbeiten — Umbenennen, Umsortieren, Löschen —, das auf der Desktop-Seite bleibt, wo dafür Platz ist.

Die gespeicherte Liste gehört zu einem Browser, ein Telefon beginnt also mit einer leeren, wie viele Empfänger auch immer auf dem Rechner gespeichert sind. Dafür ist der QR-Code da: am Rechner **☰** und dann **▦ QR** drücken, den Code mit der Kamera des Telefons scannen und den Text in **Import** im Reiter Div einfügen. Es fragt nach merge oder replace, und Export auf dem Telefon schickt eine Liste in die Gegenrichtung.

---

## Einen WebSDR verwenden

Ein WebSDR — die Software von Pieter-Tjerk de Boer, PA3FWM, die in Twente und an mehreren hundert weiteren Standorten läuft — lässt sich als zweiter Empfänger nutzen, aber nicht direkt aus dem Browser.

Der Grund ist eine bewusste Prüfung auf deren Seite. Ein WebSDR verweigert die Audioverbindung, wenn der `Origin`-Header nicht seine eigene Seite nennt, und `Origin` ist ein *verbotener Headername*: der Browser setzt ihn aus der Seite, auf der Sie sind, und kein Skript darf ihn ändern. Auf der Clientseite gibt es keinen Weg daran vorbei — und es sollte auch keinen geben.

Die Verbindung stellt deshalb ein kleines Programm auf Ihrem eigenen Server her, `websdr_relay.py`. Ihr Browser spricht mit dem Relay, und das Relay spricht mit dem WebSDR.

### Das Relay installieren

Die vier Distributions-Installer bieten es als optionalen Schritt an. Für eine bestehende Installation:

```
cd ~/PhantomSDR-Plus
./setup_websdr_relay.sh
```

Es fragt nach einem Port, übernimmt Rufzeichen und Adresse Ihrer Station aus `frontend/site_information.json` und bietet an, einen systemd-Dienst einzurichten, damit das Relay beim Booten startet. Die Einstellungen stehen in `websdr_relay.json` und lassen sich jederzeit ändern.

**Eines kann der Installer nicht für Sie tun: den Port des Relays in Ihrem Router freigeben.** Die Browser der Zuhörer verbinden sich direkt mit dem Relay — es läuft nicht über den Empfänger — ohne diese Freigabe funktioniert WebSDR-Diversity also nur aus Ihrem eigenen Netz. Die anderen drei Empfängertypen sind davon nicht betroffen.

Ist das Admin-Panel installiert, zeigt sein Dashboard eine Karte **WebSDR Diversity Relay** mit Zustand, Port und der Zahl der laufenden Sitzungen samt Gegenstellen.

### Ein guter Gast sein

Das Relay verbindet sich mit fremden Empfängern von Ihrem Server aus statt von der Adresse jedes einzelnen Zuhörers, deshalb ist es auf gutes Benehmen ausgelegt:

- **Höchstens zehn gleichzeitige Sitzungen zu einem WebSDR**, sechzig insgesamt. Das verhindert, dass ein betriebsamer Tag bei Ihnen wie ein Angriff auf die Station eines anderen aussieht.
- **Ein `User-Agent`, der Ihre Station und deren Betreiber nennt**, damit ein Betreiber, der das nicht möchte, genau weiß, an wen er sich wenden kann. Bitte tragen Sie ihn ehrlich ein.
- **Nur Abstimmbefehle werden weitergereicht.** Über die Verbindung lässt sich nichts anderes senden.
- **Private, Loopback- und Carrier-NAT-Adressen werden abgelehnt**, damit niemand das Relay auf etwas in Ihrem Rechner oder Ihrem LAN richten kann.

> [!IMPORTANT]
> Die `Origin`-Prüfung gibt es, weil die WebSDR-Autoren ihre Empfänger nicht von fremden Seiten aus steuern lassen wollten. Das Relay zu benutzen ist eine bewusste Entscheidung, kein Versehen ihrerseits. Lassen Sie das Limit, wo es ist, halten Sie den User-Agent ehrlich, und hören Sie auf, wenn ein Betreiber Sie darum bittet.

### Was bei einem WebSDR anders ist

- **Viele Stationen decken einige schmale Ausschnitte ab**, keinen durchgehenden Bereich — etwa ein 256-kHz-Fenster auf 40 m. Diversity greift nur innerhalb davon, und das Feld liest die Bandliste der Station, um zu wissen, wo diese liegen.
- **Die Audio-Abtastrate wechselt** mit der Filterbreite und liegt weiter von der Nennrate entfernt als bei den anderen Typen, das Ausrichten kann daher etwas länger dauern.
- **CW wird nicht angepasst** an die Konvention von WebSDR, die den Durchlassbereich vollständig unter den Träger legt. SSB und AM stimmen.

---

## Das Feld lesen

Im Betrieb zeigt das Feld eine kleine Tabelle:

| Zeile | Bedeutung |
|---|---|
| **link** | Die Verbindung zum zweiten Empfänger. `ready` ist das Ziel. Bei einem Fehler erscheinen der Fehlertext der Gegenstelle und der WebSocket-Schließcode |
| **aligned** | Die gemessene Verzögerung zwischen beiden Datenströmen nach dem Einrasten, sonst `searching` |
| **corr** | Wie stark die beiden Ströme korrelieren. Nur nach dem Ausrichten aussagekräftig |
| **remote audio** | Dekodiertes Audio vom zweiten Empfänger. `none` in Bernstein heißt: es wird nichts dekodiert |
| **SNR local / remote** | Die beiden verglichenen Signal-Rausch-Schätzungen |
| **switches** | Wie oft der Standort gewechselt wurde |

Neben dem Titel sagt Ihnen ein Wort, woran Sie sind:

| | |
|---|---|
| `off` (grau) | nicht aktiv |
| **`Please wait…`** (bernstein) | verbindet sich, oder verbunden und noch beim Ausrichten |
| **`Ready`** (grün) | verbunden, eingerastet und dem besseren Standort folgend |
| die Fehlermeldung der Gegenstelle (rot) | fehlgeschlagen, und es behebt sich nicht von selbst |

Der Unterschied zwischen bernstein und rot ist der, der Zeit spart: bernstein heißt weiter warten, rot heißt aufhören zu warten und die Meldung lesen.

Der farbige Punkt sagt zusätzlich, welchen Standort Sie gerade hören — grün den eigenen Empfänger, cyan den entfernten.

### Das Ausrichten dauert etwa 15 Sekunden

Das ist normal. Die beiden Ströme werden über die Korrelation ihrer **Audio-Hüllkurven** ausgerichtet, und dafür braucht es ein Zeitfenster. Die Suche läuft in zwei Stufen: eine schmale Suche über ±1,5 Sekunden kann beginnen, sobald etwa 9 Sekunden Ton gesammelt sind, und eine zweite, unabhängige Messung fünf Sekunden später muss mit der ersten **übereinstimmen**, bevor die Ausrichtung akzeptiert wird. Liegen die beiden Stationen zeitlich weiter auseinander — ein bis zwei Sekunden zusätzliche Pufferung irgendwo auf dem Weg —, übernimmt bei etwa 14 Sekunden die volle Suche über ±4 Sekunden, und die Bestätigung folgt bei 19.

Dieser Bestätigungsschritt ist wichtig. Schwinden zwei Standorte gegenphasig — tragen also nie beide gleichzeitig das Signal —, rastet eine einzelne Korrelation bereitwillig auf eine überzeugte, völlig falsche Verzögerung ein, die wie ein Echo klingt. Zwei unabhängige, übereinstimmende Messungen zu verlangen, weist das zurück.

Eine zweite Sache muss stimmen, bevor eine Ausrichtung hält: die Abtastraten der beiden Empfänger. Zwei Empfänger sind zwei Takte und zwei Dezimierungsketten, ihre Audioströme treffen also **nicht** ganz mit derselben Rate ein, selbst wenn beide 12 kHz melden — 2% Unterschied sind normal, also 240 Abtastwerte pro Sekunde Drift, weit mehr als die Ausrichtungstoleranz. Der entfernte Strom wird deshalb laufend auf die Rate Ihres eigenen Empfängers resampelt. Dieses Verhältnis wird durch **Zählen von Abtastwerten** ermittelt, nicht durch Korrelation; es braucht also keine eigene Einrastung und steht schon in den ersten Sekunden fest — noch bevor die erste Ausrichtungssuche läuft. Ein schwaches oder unterbrochenes Signal kann zwei bis drei Anläufe brauchen, 30 Sekunden sind also kein Grund zur Sorge; eine Minute ohne Ergebnis schon.

Während `searching` zeigen beide SNR-Werte `0.0`. Das ist Absicht: Beide Schätzungen werden an **inhaltlich ausgerichteten** Abtastwerten gemessen, also wird vor einer Ausrichtung nichts gemessen. `0.0 / 0.0` heißt „noch nicht eingerastet", nicht „kein Signal".

---

## Remote SNR trim

Dieser Regler gewichtet die Wahl zwischen den beiden Standorten. Er wird vor dem Vergleich zum gemessenen SNR des entfernten Empfängers addiert — positiv bevorzugt den entfernten, negativ den eigenen. Er ändert **sonst nichts**: weder den Pegel noch die Zusammenführung, nur wer gewinnt.

Er ist nötig, weil die beiden SNR-Werte nicht immer vergleichbar sind. Beide werden gleich gemessen — als Perzentilspanne des Audios —, aber ein Empfänger, dessen Codec sein eigenes Rauschen anhebt, liest niedriger als er verdient. Ein KiwiSDR arbeitet mit kräftiger Verstärkung und einem Limiter, was die Spanne staucht; ein verlustbehafteter Codec setzt einen Rauschteppich, unter den das Signal nie kommt.

**So stellen Sie ihn ein:**

1. Stimmen Sie beide Empfänger auf ein zuverlässig vorhandenes Signal ab und warten Sie auf `aligned`.
2. Beobachten Sie die beiden SNR-Werte eine halbe Minute lang. Merken Sie sich den üblichen Abstand.
3. Nutzen Sie die Endanschläge als Hörtest: **+15** erzwingt den entfernten Standort, **−15** den eigenen. Hören Sie jeden ein paar Sekunden. Nur so hören Sie einen Standort isoliert.
4. Liest der entfernte etwa 5 dB niedriger, klingt aber genauso gut, stellen Sie **+5** ein. Sie bringen die beiden Anzeigen zur Deckung, wenn beide Standorte gleich klingen.
5. Beobachten Sie den Zähler **switches** über zehn Minuten Hören. Ständiges Umschalten heißt, der Wert liegt zu nah am Gleichstand; nie umzuschalten, obwohl der eigene Empfänger hörbar schwindet, heißt, er ist zu weit in die andere Richtung verschoben.

Ausgangswerte: **0** für einen weiteren PhantomSDR-Plus, der denselben Audioweg nutzt und schon von der Konstruktion her vergleichbar ist; ein kleiner **positiver** Wert für einen KiwiSDR oder UberSDR.

> [!TIP]
> Brauchen Sie mehr als etwa ±8 dB, hören Sie mit dem Nachstellen auf. Dann ist die ehrliche Erklärung meist, dass ein Empfänger für diesen Weg wirklich schlechter ist — und über einen echten Unterschied hinaus zu gewichten heißt nur, den schwächeren Standort zu hören.

Die Einstellung wirkt sofort und wird im Browser gespeichert.

---

## Die Wahl des zweiten Empfängers

**Entfernung zählt.** Schwunderscheinungen entkorrelieren mit der Entfernung — einige hundert Kilometer auf Kurzwelle sind ein guter Zielwert. Zwei Empfänger in derselben Stadt schwinden gemeinsam und bringen nichts. Zu weit auseinander, und der zweite Empfänger hört Ihr Signal womöglich gar nicht.

**Beide müssen das Signal tatsächlich hören.** Diese Bedingung umgeht keine Software. Hört der zweite Empfänger nicht, was Sie hören, bleibt die Korrelation niedrig und er rastet nicht ein — mit Absicht, denn eine falsche Ausrichtung klingt schlechter als gar keine Diversität.

**Abdeckung.** Ein zweiter PhantomSDR-Plus oder ein KiwiSDR meldet den abgedeckten Frequenzbereich, und das Feld warnt Sie, wenn Sie außerhalb abstimmen. Ein WebSDR meldet seine Bänder, die oft schmale Ausschnitte statt eines durchgehenden Bereichs sind. UberSDR meldet keine Abdeckung; dort ist das ausbleibende Einrasten Ihr einziger Hinweis.

> [!IMPORTANT]
> Öffentliche Empfänger werden von Freiwilligen betrieben und haben eine begrenzte Zahl an Hörerplätzen. Eine Diversitätssitzung belegt einen davon, solange sie läuft, genau wie ein menschlicher Zuhörer. Bitte lassen Sie eine Verbindung nicht unbegrenzt offen und fragen Sie den Betreiber, wenn Sie seinen Empfänger intensiv nutzen möchten.

---

## Fehlersuche

**`link` verlässt `connecting` nie oder wechselt ständig zwischen Verbinden und Schließen** Wahrscheinlich stimmen Adresse oder Port nicht. Siehe Tabelle oben — vor allem nutzt UberSDR seinen normalen Web-Port, nicht 8073. Das Feld zeigt den WebSocket-Schließcode, die Browser-Konsole (F12) den zugrunde liegenden Fehler.

**`link` zeigt einen Fehler mit Text** Dieser Text stammt vom anderen Empfänger und ist meist konkret: abgewiesene Sitzung, voller Server oder ein Empfänger, der keine fremden Clients annimmt.

**Der KiwiSDR verweigert die Verbindung** Manche KiwiSDRs verlangen ein Passwort, und auf einem UberSDR ist der KiwiSDR-kompatible Zugang standardmäßig abgeschaltet. Nutzen Sie für einen UberSDR die Quelle **UberSDR** — dieser Weg steht immer zur Verfügung.

**WebSDR: `the WebSDR relay is not reachable`** Das Relay läuft nicht, oder Ihr Browser erreicht seinen Port nicht. Es muss unter **demselben Hostnamen erreichbar sein, unter dem die Empfängerseite ausgeliefert wird**, denn der Browser verbindet sich direkt damit und nicht über den Empfänger. Öffnen Sie `http://<dieser Hostname>:<Relay-Port>/status` im selben Browser, um zu sehen, woran es liegt. Antwortet es im LAN, aber nicht von außen, ist der Port im Router nicht freigegeben.

**WebSDR: ein Fehler über eine abgelehnte Verbindung** Diese Station ist strenger eingestellt als die übliche `Origin`-Prüfung, oder ihr Betreiber hat diese Station gesperrt.

**`link` ist `ready`, aber `remote audio` zeigt `none`** Es wird kein Audio dekodiert. Laden Sie die Seite neu; bleibt es dabei, zeigt die Browser-Konsole, welcher Decoder gescheitert ist.

**Audio kommt an, richtet sich aber nie aus** Die beiden Empfänger hören nicht dasselbe. Versuchen Sie einen starken Rundfunksender oder ein Band, auf dem beide Standorte gute Ausbreitung haben. Ein ruhiges Band mit beiderseits nur Rauschen korreliert nie — und soll es auch nicht.

**Es schaltet ständig hin und her** Die beiden Standorte liegen im SNR zu dicht beieinander. Verschieben Sie den Trimmwert leicht, sodass einer durchgehend bevorzugt wird.

**Der zweite Empfänger wird nie verwendet** Prüfen Sie, ob `remote audio` steigt und die SNR-Werte plausibel aussehen. Liest der entfernte deutlich niedriger, als er klingt, ist genau dafür der Trimmregler da.

---

## Grenzen

- **Nicht kohärent.** Kein Phasing, kein Nullen, keine Peilung. Eine Störquelle auszulöschen braucht zwei Antennen an einem Takt an einem Standort; das ist ein anderes Verfahren für ein anderes Problem.
- **Ein bis drei Sekunden Verzögerung**, unvermeidlich.
- **Nur zwei Empfänger.**
- **Mono.** Läuft Ihr Empfänger in einer Stereo-Betriebsart wie C-QUAM, wird das Audio unverändert durchgereicht und die Diversität greift nicht.
- **Ausrichten braucht Signal.** Unter etwa 10 dB SNR an einem der beiden Standorte bleibt es erwartungsgemäß bei `searching`.
- **Ein WebSDR braucht das Relay** auf Ihrem eigenen Server und dessen freigegebenen Port. Die anderen drei Empfängertypen brauchen beides nicht.
