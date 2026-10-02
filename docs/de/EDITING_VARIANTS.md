# PhantomSDR-Plus — Bearbeiten der Frontend-Varianten

*(nachdem die vier Dateien `App__*_smeter_.svelte` zu einer einzigen `App.svelte` zusammengeführt wurden)*

---

## 1. Was die Varianten sind

Zwei unabhängige Entscheidungen, die vier Kombinationen ergeben:

```
smeter = "analog"     das Instrument mit beweglichem Zeiger
       = "digital"    das segmentierte Balkeninstrument

layout = "v1"         Betriebsartenwahl oben, Bandwahl unten
       = "v2"         Bandwahl oben, Betriebsartenwahl unten
                      (verschiebt auch die Feinabstimmungs-Tastenreihe auf dem Handy)
```

Alle vier stecken in **einem** Build, ausgeliefert unter `/`. Der Wähler ⚙️ oben rechts schaltet zwischen ihnen um, während die Seite läuft: Er setzt die Props `smeter`/`layout` von `App.svelte`, es wird also nichts neu geladen, und Audio, Wasserfall und Decoder laufen weiter. Die Wahl wird pro Browser in `localStorage` unter `phantom.variant` gespeichert und hat beim nächsten Besuch Vorrang vor dem Build-Standard.

Die in `recompile.sh` gewählte Variante ist damit die **Start**variante — das, was ein Erstbesucher sieht, bevor er das Menü anfasst.

| URL | was es ist |
|-----|-----------|
| `/` | die Desktop-Seite, alle vier Varianten, zur Laufzeit umschaltbar |
| `/mobile/` | *eigene Seite, gebaut von `build-mobile.sh` — keine Variante* |

> Bis zum 10.08.2026 war jede Variante ein eigener Build unter `/analog/`, `/digital/`, `/v2-analog/` und `/v2-digital/`, und der Wähler navigierte zwischen ihnen — deshalb lud das Umschalten früher die Seite neu und riss den Ton ab. Diese Builds gibt es nicht mehr; unter jedem der vier Pfade liegt nur noch eine kleine `index.html`, die auf `/` weiterleitet — geschrieben von `frontend/make-redirect-stubs.sh` bei jedem Build, damit alte Lesezeichen weiter funktionieren.

Die Variante wird in **keine** Quelldatei geschrieben. `src/main.js` ist ein fester Einstiegspunkt, der der Komponente zwei Build-Zeit-Defines übergibt:

```js
const app = new App({
  target: document.getElementById('app'),
  props: { smeter: __PHANTOM_SMETER__, layout: __PHANTOM_LAYOUT__ }
})
```

`vite.config.js` füllt diese beim Bauen aus und nimmt dabei das erste der folgenden, das gesetzt ist:

1. **`PHANTOM_SMETER` / `PHANTOM_LAYOUT`** — Umgebungsvariablen. Seit dem Wegfall der Varianten-Builds setzt sie niemand mehr; für einen einmaligen Build mit einer anderen Startvariante funktionieren sie weiterhin.
2. **`frontend/variant.json`** — der Standard der Website, geschrieben von `recompile.sh`. Der Build für die Wurzel (`/`) übergibt keine Variante und landet daher hier.
3. **`analog` / `v1`** — der Rückfallwert.

Diese beiden Werte sind nur der **Startwert**. `App.svelte` überschreibt sie beim Initialisieren aus `localStorage`, wenn der Besucher bereits eine Variante gewählt hat, und der ⚙️-Wähler setzt sie bei jedem Umschalten erneut.

In `App.svelte` werden die Props in den Zeilen 20-21 in zwei Flags umgewandelt:

```js
$: isAnalog = smeter !== "digital";
$: isV2     = layout === "v2";
```

Verwenden Sie diese beiden Flags — niemals `smeter`/`layout` direkt — damit sich die ganze Datei einheitlich liest.

---

## 2. Welche Datei was macht

### `frontend/src/main.js` — 12 Zeilen

Der Einstiegspunkt. Nichts außer der Instanziierung von App und den zwei `__PHANTOM_*__`-Defines, die sie als Props weiterreicht. Sie ist **konstant** — weder `recompile.sh` noch die Build-Skripte schreiben sie noch um, und genau das erlaubt es, die Varianten gleichzeitig zu bauen.

> **Legen Sie hier keinen Anwendungscode ab.** Es ist die Einstiegsdatei, kein Ort für Logik.

### `frontend/src/App.svelte` — ca. 17130 Zeilen

Die gesamte Anwendung: Wasserfall, Abstimmung, Dekoder, Lesezeichen, Bedienfelder, Desktop-Layout UND das responsive Handy-Layout. Nahezu jede Änderung, die Sie je vornehmen werden, gehört hierher.

### `frontend/src/lib/SMeterAnalog.svelte` — 824 Zeilen

Das Zeigerinstrument, vollständig: Zeichnen des Zifferblatts, Zeiger, die Umschaltung hell/dunkel samt zugehörigem localStorage-Schlüssel und die Zeigerglättung.

- Eingangs-Prop: `dbm` — die KALIBRIERTE Leistung in dBm.
- Nimmt außerdem: `mobile` — kleinere Canvas-Attribute für das Handy-Layout.
- Stellschraube: `SMOOTH_TIME_MS` in Zeile 55. Kleiner = schnellerer Zeiger, größer = ruhiger. Derzeit 16 (ein Frame bei 60 fps, praktisch die Untergrenze).

#### Die drei Skalenbilder — und `smeter_theme.sh`

Das analoge Instrument hat drei Hintergründe, alle von demselben Code gezeichnet:

```
dark      das ursprüngliche dunkle, gebürstete Metall
amber     ein helles, blassgraues Zifferblatt
vintage   ein warmes, gealtertes Bernstein-Zifferblatt
```

**Nicht mit der Variante `smeter = analog / digital` oben verwechseln.** Die Variante wählt, *welche Instrumentenkomponente* angezeigt wird; das Skalenbild wählt, *wie das analoge gezeichnet* wird. Sie liegen unter verschiedenen localStorage-Schlüsseln (`phantom.variant` bzw. `smeterTheme`) und werden an verschiedenen Stellen gesetzt.

**Die Besucherseite.** Das Canvas des Instruments ist eine Schaltfläche (`role="button"`, auch Enter/Leertaste über die Tastatur, mit dem Hinweis „click to switch style“ darunter). Jeder Klick schaltet dark → amber → vintage weiter und speichert die Wahl in `localStorage.smeterTheme`. Sie wird bei jedem Seitenaufbau zurückgelesen, überlebt also Neuladen und Browser-Neustarts unbegrenzt. Bewusst **kein** Cookie: ein Cookie würde bei jeder Wasserfall- und Audio-Anfrage an den Server geschickt, für einen Wert, den der Server nie liest.

**Die Sysop-Seite.** Zwei Dinge in `SMeterAnalog.svelte` bestimmen, was alle anderen bekommen:

| Zeile | Wirkung |
|-------|---------|
| `let smeterTheme = 'dark';` | Das Skalenbild, das ein Browser **ohne gespeicherte Wahl** bekommt. |
| `const SMETER_PREF_VERSION = 2;` | Ein Zähler. Liegt die gespeicherte Version eines Browsers darunter, vergisst er sein gespeichertes Skalenbild **einmalig** und übernimmt die obige Vorgabe. Erhöhen Sie ihn, um Besucher umzustellen, die bereits gewählt haben. |

Nur die Vorgabe zu ändern erreicht also ausschließlich ganz neue Besucher. Beide Änderungen zusammen erreichen alle — genau dafür gibt es `smeter_theme.sh` im Wurzelverzeichnis:

```bash
./smeter_theme.sh                 # aktuelle Vorgabe anzeigen, dann aus einem Menü wählen
./smeter_theme.sh vintage         # direkt setzen, danach den Neubau anbieten
./smeter_theme.sh dark --build    # frontend/build-all.sh ohne Rückfrage ausführen
./smeter_theme.sh amber --no-reset  # nur neue Besucher — bestehende in Ruhe lassen
```

Es meldet die aktuelle Vorgabe, setzt die neue, erhöht den Reset-Zähler (immer aufwärts — **niemals verringern**, eine kleinere Zahl verhindert das Zurücksetzen einfach) und bietet dann dieselbe Frontend-Bauauswahl wie `recompile.sh`. Es fasst weder das Backend an noch schreibt es `variant.json` neu.

> Eine Änderung erreicht einen verbundenen Hörer erst beim Neuladen seiner Seite — die Vorgabe ist ins JS-Bundle kompiliert und das Zurücksetzen läuft beim Laden. Es gibt keine Live-Übertragung. Ein normales Neuladen genügt, da vite die Bundle-Dateinamen hasht.

Das einmalige Zurücksetzen des Zählers überschreibt alle, auch Besucher, die bewusst ihr eigenes Skalenbild angeklickt haben. Das ist beabsichtigt: nur so lässt sich die ganze Seite wieder auf ein Aussehen bringen. Mit `--no-reset` lassen Sie sie in Ruhe.


### `frontend/src/lib/SMeterDigital.svelte` — 184 Zeilen

Das Balkeninstrument, vollständig.

- Eingangs-Props: `rawDb` — der ROHE Wert von `audio.getPowerDb()`
- `smeterOffset` — `audio.smeter_offset`
- `mobile` — kleinere Canvas-Attribute

> **HINWEIS:** Dieses Instrument wird bewusst aus der ROHEN Leistung plus Offset gespeist, NICHT aus dem kalibrierten dBm-Wert des analogen Zifferblatts. Es hat schon immer seine eigene Abbildung gehabt. Ihm den kalibrierten Wert zu geben, würde auf jeder digitalen Station jede Anzeige verschieben. Diese beiden Eingänge nicht „vereinheitlichen“.

### `frontend/src/lib/BandSelector.svelte` — 69 Zeilen

Das Raster der Bandtasten. Wird in `App.svelte` zweimal gerendert (einmal je Layout).

### `frontend/src/lib/ModesSelector.svelte` — 75 Zeilen

Das Raster der Betriebsartentasten. Wird in `App.svelte` zweimal gerendert.

### `frontend/src/lib/StatusIndicators.svelte` — 122 Zeilen

Die Statuslampen (Mute, Squelch, NR, NB, NS, AN, CTCSS). Nimmt ein `wide`-Prop: Das digitale Layout verwendet breitere Lampen als das analoge. Beide Tailwind-Klassen (`w-8` und `w-10`) stehen ausgeschrieben in der Komponente — Tailwinds Scanner sieht nur wörtliche Klassennamen, bauen Sie sie also niemals durch Zeichenkettenverkettung zusammen.

Alle übrigen Dateien in `frontend/src/lib/` (Spectrogram, PassbandTuner, FrequencyInput, VersionSelector, ...) stammen aus der Zeit vor dieser Arbeit und sind unverändert.

---

## 3. Eine Änderung, die nur einige Varianten betrifft

Packen Sie sie in das Flag. Im Markup:

```svelte
{#if isAnalog}
  ...nur die analogen Stationen sehen das...
{:else}
  ...nur die digitalen Stationen sehen das...
{/if}

{#if isV2} ... {/if}          {#if !isV2} ... {/if}
```

In einem class-Attribut:

```svelte
class="p-4 {isAnalog ? 'text-xs' : 'text-sm'} rounded-md"
```

Schreiben Sie beide Alternativen wie oben als vollständige Literale aus. Tailwind durchsucht den Quelltext nach vollständigen Klassennamen; `text-{size}` oder ein zusammengesetzter Name wird aus dem CSS entfernt, und die Formatierung verschwindet stillschweigend.

Im `<script>`-Block: Versuchen Sie, gar nicht zu verzweigen. Das Skript berechnet bewusst bei jedem Tick die Eingaben BEIDER Instrumente —

```js
smeterDbm    = powerDb;                    // analoges Zifferblatt
smeterRawDb  = audio.getPowerDb();         // digitales Instrument
smeterOffset = audio.smeter_offset;        // digitales Instrument
```

— sodass nur das Markup auswählen muss. Deshalb gibt es in einer Datei mit 17000 Zeilen nur 15 Variantenweichen. Halten Sie das so; Verzweigungen auf Skriptebene haben die vier alten Dateien auseinanderdriften lassen.

---

## 4. Wo die Variantenweichen sitzen

Fünfzehn Stellen in `App.svelte`. Zeilennummern verschieben sich beim Bearbeiten — der zuverlässige Weg, sie alle zu finden, ist:

```bash
cd frontend/src && grep -n 'isAnalog\|isV2' App.svelte
```

Zum Zeitpunkt der Erstellung:

| Zeile | Flag | Was umgeschaltet wird |
|-------|------|-----------------------|
| 20 | | `isAnalog` deklariert |
| 21 | | `isV2` deklariert |
| 8062 | `isV2` | Desktop: Bandwahl zuerst (v2-Reihenfolge) |
| 8090 | `isV2` | Desktop: Schriftgröße der Bedienfeldüberschrift |
| 8686 | `isV2` | Desktop: Betriebsartenwahl zuerst (v1-Reihenfolge) |
| 8717 | `isAnalog` | Mindestbreite des Instrumentenfelds (der Zeiger ist schmaler) |
| 8730 | `isAnalog` | nur analog: Datums-/Zeitzeile über dem Instrument |
| 8819 | `isAnalog` | nur analog: Statuslampen + Trennlinie |
| 8834 | `isAnalog` | nur digital: Zeitzeile, breite Lampen und die Wahl zwischen `<SMeterDigital>` / `<SMeterAnalog>` selbst |
| 8861 | `isAnalog` | vertikale Abstände des Frequenzblocks |
| 8864 | `isAnalog` | oberer Rand des Feinabstimmungsblocks |
| 12288 | `isV2` | Handy: Feinabstimmungsreihe oben (v2-Reihenfolge) |
| 12347 | `isAnalog` | Handy: welches Instrument gerendert wird |
| 12433 | `isV2` | Handy: Feinabstimmungsreihe unten (v1-Reihenfolge) |
| 13204 | `isAnalog` | Schriftgröße der Noise-Gate-Taste |

Alles Übrige in der Datei ist allen vier Varianten gemeinsam.

---

## 5. Weitere wissenswerte Stellschrauben

| Ort | Konstante | Zweck |
|-----|-----------|-------|
| `App.svelte` Zeile 5034 | `const visualGain = 1.1;` | Kalibrierung des analogen Instruments. Je 0,10 entspricht etwa 5 dBm in der Anzeige. |
| `SMeterAnalog.svelte` Zeile 55 | `const SMOOTH_TIME_MS = 16;` | Zeitkonstante der Zeigerglättung in Millisekunden. |
| `SMeterAnalog.svelte` Zeile 64 | `let smeterTheme = 'dark';` | Standard-Skalenbild des analogen Instruments für einen Browser ohne gespeicherte Wahl. Mit `./smeter_theme.sh` setzen, nicht von Hand. |
| `SMeterAnalog.svelte` Zeile 69 | `const SMETER_PREF_VERSION = 2;` | Einmaliger Reset-Zähler für das gespeicherte Skalenbild. Erhöhen, um bestehende Besucher auf die Vorgabe zu holen; wird nur größer. |
| `SMeterDigital.svelte` Zeile 149 | `const DIGITAL_BAR_TRIM = 0;` | Verschiebt den Balken um ganze Segmente. |
| `SMeterDigital.svelte` Zeile 31 | `const numberOfDots = 35;` | Anzahl der Segmente des Balkens. |

---

## 6. Nach dem Bearbeiten — neu bauen

Am einfachsten aus dem Wurzelverzeichnis des Projekts:

```bash
./recompile.sh
```

Menüpunkt **[2]** baut das Frontend neu und fragt, welche Variante ein Erstbesucher sehen soll. Diese Wahl wird in `frontend/variant.json` festgehalten — es wird keine Quelldatei kopiert oder umgeschrieben. (Früher wurde zusätzlich `VersionSelector.svelte` aus einem Heredoc neu erzeugt; das wurde entfernt, als der Wähler aufhörte zu navigieren, denn es hätte das Umschalten zur Laufzeit bei jedem Lauf zurückgesetzt.) Menüpunkt **[1]** ist nur das Backend, **[3]** beides.

Oder direkt, aus `frontend/`:

```
./build-all.sh          baut die Desktop-Seite UND /mobile/  <-- normalerweise dieses
./build-default.sh      nur die Desktop-Seite
./build-mobile.sh       nur /mobile/
```

> `build-default.sh` lässt vite `dist/` leeren, wodurch `dist/mobile/` bis zum nächsten `build-all.sh` oder `build-mobile.sh` verschwindet. Deshalb ist `build-all.sh` die normale Wahl.

`build-all.sh` besitzt eine eigene Kopie der Build-Logik (`build_version SMETER LAYOUT NAME OUTDIR BASE LOG`), statt `build-default.sh` aufzurufen. Wenn Sie ändern, wie die Seite gebaut wird, ändern Sie es an BEIDEN Stellen, sonst laufen die beiden Wege auseinander.

Ein paar wissenswerte Details:

- Es setzt `PHANTOM_KEEP_OUTDIR=1`, damit Vite das Ausgabeverzeichnis nicht leert, und räumt `dist/` stattdessen selbst auf — es löscht den Inhalt, behält aber `users.json`, das der laufende `spectrumserver` bei jedem Verbinden und Trennen eines Hörers neu schreibt.
- Es baut `/mobile` zuletzt, wenn die Desktop-Ausgabe vollständig ist.
- Seine Parallel-Build-Mechanik (`PHANTOM_BUILD_JOBS`, Standard 3) stammt aus der Zeit mit fünf Desktop-Builds. Bei einem einzigen steht nichts mehr in der Warteschlange.

**Ausführbar-Bits:** `recompile.sh` führt vor dem Start `chmod +x` auf ein Skript aus, und `build-all.sh` ruft bewusst `bash build-mobile.sh` statt `./build-mobile.sh` auf — ein fehlendes Bit bricht den Build also nicht mehr. Das Hochladen eines Skripts über die GitHub-Weboberfläche setzt es allerdings weiterhin auf 644 zurück; wenn Sie eines direkt starten:

```bash
chmod +x frontend/build-*.sh
```

---

## 7. Wie Sie Ihre Änderung prüfen, bevor Sie ihr vertrauen

Ein grüner `vite build` genügt **NICHT**. Der Build kann einen Bezeichner nicht sehen, der beim Verschieben von Code zwischen Dateien verlorenging — das ist ein `ReferenceError` zur Laufzeit, und die Seite lädt schlicht nicht. Das ist bereits zweimal passiert.

### 1) Prüfung auf undefinierte Bezeichner (fängt genau diesen Fehler ab)

```bash
cd frontend
npx eslint --no-eslintrc \
    --parser svelte-eslint-parser \
    --rule '{"no-undef":"error"}' \
    --env browser,es2022 \
    src/App.svelte src/lib/SMeter*.svelte
```

Ein bekannter, harmloser Treffer ist zu erwarten:

```
'dBmCalOffset' is not defined
```

`typeof x === 'number'` auf einem nicht deklarierten Namen wirft nie einen Fehler, dieser Ausdruck ergibt also bereits 0. Alles andere ist ein echtes Problem.

### 2) Bauen, dann die SEITE LADEN UND ALLE VIER VARIANTEN DURCHSCHALTEN

Nicht nur die, die Sie geändert haben — eine Änderung unter `isAnalog`/`isV2` kann die anderen drei zerstören, während Ihre funktioniert. Öffnen Sie `/`, gehen Sie alle vier Einträge im ⚙️-Menü durch und öffnen Sie dann `/mobile/`.

Öffnen Sie auf jeder die Browserkonsole. Eine leere oder halb gezeichnete Seite mit einem `ReferenceError` in der Konsole ist die Signatur des oben beschriebenen Fehlers.

### 3) Lassen Sie `frontend/dist/` niemals in einem Teilzustand

Ein blankes `npx vite build` leert das Ausgabeverzeichnis und nimmt `dist/mobile/` sowie das laufende `dist/users.json` des Servers mit — die Mobilseite antwortet mit 404, bis der nächste Build erfolgreich ist. Bauen Sie immer über die Skripte: `build-all.sh` setzt `PHANTOM_KEEP_OUTDIR=1` und räumt selbst auf, wobei `dist/users.json` erhalten bleibt. Führen Sie im Zweifel einfach erneut `./build-all.sh` aus.
