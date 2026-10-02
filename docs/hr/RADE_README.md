# Digitalni glas RADE v1 za PhantomSDR-Plus

**RADE** (Radio AutoencoDEr) vodeći je FreeDV-ov način rada digitalnog glasa na kratkim valovima. Koristi hibrid strojnog učenja i DSP-a (neuronski vokoder FARGAN) i pruža govor visoke kvalitete na KV-u pri omjerima signal/šum do −2 dB, u tek 1500 Hz RF širine pojasa — uže od SSB signala.

Ovaj dokument obrađuje potpunu integraciju prijama RADE v1 u PhantomSDR-Plus, izvedenu kao sidecar proces u Pythonu (`rade_helper.py`) koji povezuje preglednik s lancem dekodiranja `radae_rxe.py` + `lpcnet_demo`.

## Instalacija — kraći put

```bash
cd ~/PhantomSDR-Plus
./install_rade.sh
```

To je cijela instalacija. Skripta instalira sistemske pakete preko upravitelja paketa koji stroj ima (apt, pacman, dnf ili zypper), za ono što distribucija ne isporučuje poseže za pipom, nadograđuje `websockets` ako je verzija iz distribucije starija od 11.0 koju sidecar treba, klonira i gradi radae, provjerava težine modela, ponovno gradi frontend i pokreće sidecar. Na Ubuntuu 22.04 predaje posao skripti `install_rade_ubuntu22.sh`. `./install.sh` nudi da je pokrene u sklopu normalne instalacije, pa je na svježem stroju RADE već tu.

**Ovaj dokument objašnjava kako RADE radi i kako ga pokrenuti — nije postupak instalacije.** Ako instalaciju morate obaviti ručno, na sustavu koji skripta ne pokriva ili da biste popravili jedan korak, slijedite vodič povezan niže; koraci su zapisani ondje i nigdje drugdje. Sve ovdje — arhitektura, zakrpane datoteke, vrata, upotreba RADE-a u pregledniku, varijable okoline, rješavanje problema i mjerenje istodobnosti — vrijedi za svaku instalaciju, kako god je napravljena.

- **[Ručna instalacija na Linuxu](RADE_General_INSTALL_MANUAL_LINUX.md)** - ručni put, korak po korak, za Ubuntu, Debian, Fedoru, Arch i Raspberry Pi OS

---

## Sadržaj

1. [Instalacija — kraći put](#instalacija--kraći-put)
2. [Kako to radi](#kako-to-radi)
3. [Pregled arhitekture](#pregled-arhitekture)
4. [RADEL naspram RADEU](#radel-naspram-radeu)
5. [Preduvjeti](#preduvjeti)
6. [Ručna instalacija](#ručna-instalacija)
7. [Postavljanje zakrpanih datoteka](#postavljanje-zakrpanih-datoteka)
8. [Upravljanje sidecarom](#upravljanje-sidecarom)
9. [Vrata 8074](#vrata-8074)
10. [Korištenje RADE-a u pregledniku](#korištenje-rade-a-u-pregledniku)
11. [Provjera i otklanjanje pogrešaka](#provjera-i-otklanjanje-pogrešaka)
12. [Varijable okruženja](#varijable-okruženja)
13. [Promijenjene datoteke](#promijenjene-datoteke)
14. [Sažetak toka signala](#sažetak-toka-signala)
15. [Rješavanje problema](#rješavanje-problema)
16. [Mjerenje istodobnosti na vlastitom hardveru](#mjerenje-istodobnosti-na-vlastitom-hardveru)
17. [Ažuriranje RADE v1](#ažuriranje-rade-v1)

---

## Kako to radi

RADE v1 ne može raditi u pregledniku — traži PyTorch i neuronski vokoder FARGAN, koji su preveliki za WASM. Rješenje je sidecar proces u Pythonu (`rade_helper.py`) koji radi na istom poslužitelju kao PhantomSDR-Plus.

> **Važno:** `freedv_rx` iz repozitorija codec2 **ne** podržava RADEV1. Lanac dekodiranja RADE u cijelosti se nalazi u zasebnom repozitoriju `radae` Davida Rowea (VK5DGR). Nemojte pokušavati koristiti codec2-ov `freedv_rx` za RADE.

Kada u pregledniku odaberete RADE:

1. Sučelje postavlja osnovnu demodulaciju na USB ili LSB — poslužitelj u C++-u demodulira SSB signal na uobičajen način.
2. Sirovi demodulirani PCM preuzima se u `audio.js` **prije** bilo kakvog utišavanja ili squelch vrata — `radae_rxe.py` treba neprekidan ulaz da bi održao sinkronizaciju okvira.
3. Svaki blok PCM-a dopunjava se nulama iz realnog f32 u kompleksni f32 (realni + 0.0 imaginarni) — upravo to `radae_rxe.py` očekuje na standardnom ulazu.
4. Sidecar te uzorke prosljeđuje u `radae_rxe.py`, koji ispisuje značajke vokodera.
5. `lpcnet_demo -fargan-synthesis` pretvara značajke u govor s16 pri 16000 Hz.
6. Sidecar pretvara s16 → f32 i vraća to pregledniku kao binarne WebSocket okvire.
7. Preglednik reproducira dekodirani govor putem Web Audio API-ja pri 16000 Hz.

Poslužitelj u C++-u (`spectrumserver.cpp`) uopće se ne mijenja.

---

## Pregled arhitekture

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

## RADEL naspram RADEU

RADE v1 uvijek se prenosi putem SSB-a. Prema konvenciji:

| Način rada | Bočni pojas | Koristiti na pojasevima                  |
|------------|-------------|------------------------------------------|
| RADEL      | LSB         | 160 m, 80 m, 40 m  (≤ 10 MHz)           |
| RADEU      | USB         | 20 m, 17 m, 15 m, 12 m, 10 m (> 10 MHz) |

---

## Preduvjeti

| Zahtjev | Verzija | Napomene |
|---|---|---|
| PhantomSDR-Plus | bilo koja | s Vite/Svelte sučeljem |
| Linux | Ubuntu 24.04+ / Debian Bookworm+ | testirano |
| Python | 3.8+ | za `rade_helper.py` i `radae_rxe.py` |
| repozitorij radae | najnoviji master | daje `radae_rxe.py` i `lpcnet_demo` |
| cmake | 3.10+ | za izgradnju `lpcnet_demo` iz radae |
| PyTorch | 2.0+ | traži ga `radae_rxe.py` |
| Node.js | 16+ | za `npm run build` |
| websockets (Python) | 10–16+ | `pip3 install websockets` — podržane sve verzije |
| matplotlib | bilo koja | traži ga `radae_rxe.py` pri uvozu |
| numpy | 1.23+ | obavezan; omogućuje i ponovno uzorkovanje |
| scipy | bilo koja | neobavezno, omogućuje precizno ponovno uzorkovanje |

---

## Ručna instalacija

`./install_rade.sh` obavlja cijelu instalaciju. Kada je želite obaviti sami — na sustavu koji skripta ne pokriva ili da biste popravili jedan korak — postupak se nalazi u **[Vodiču za ručnu instalaciju RADE v1](RADE_General_INSTALL_MANUAL_LINUX.md)**, i samo ondje. Pokriva Ubuntu, Debian, Fedoru, Arch i Raspberry Pi OS u jednom prolazu:

| | |
|---|---|
| Korak 1 | Paketi sustava i provjera Node.js 22+ |
| Korak 2 | Python paketi, uključujući zastavicu PEP 668 i torch kotačić samo za CPU |
| Korak 3 | Kloniranje i izgradnja repozitorija radae, provjera `lpcnet_demo` i težina modela |
| Korak 4 | Provjera lanca dekodiranja izvan mreže, prije spajanja na preglednik |
| Korak 5 | Izgradnja PhantomSDR-Plus frontenda |
| Korak 6 | Upravljanje sidecarom |
| Korak 7 | Otvaranje vrata 8074 |
| Koraci 8–10 | Pokretanje poslužitelja, provjera RADE-a, upotreba u pregledniku |

Ostatak ovog dokumenta pretpostavlja da je to obavljeno.

---

## Postavljanje zakrpanih datoteka

Kopirajte sljedeće datoteke iz skupa zakrpa u svoj repozitorij PhantomSDR-Plus.

### Nova datoteka — stavite je u korijen repozitorija, uz početnu skriptu koju koristite:

```
rade_helper.py
```

### Zakrpane datoteke sučelja — stavite ih u `frontend/src/`:

```
audio.js
App.svelte
```

### Što zakrpe rade

**`audio.js`** — 5 izmjena:
- Konstruktor: 5 novih polja stanja za RADE (`decodeRADE`, `_radeSideband`, `_radeSocket`, `_radeCallback`, `_radeReady`, `_radeNextTime`)
- Spremanje PCM-a prije pojačanja: `pcmArrayPreBoost` sprema se prije 300× FLAC pojačanja kako bi RADE dobio izvornu amplitudu (pojačanje bi zasitilo `radae_rxe.py`)
- `playAudio()`: preuzimanje PCM-a za RADE pomoću zvuka prije pojačanja, prije vrata utišavanja/squelcha
- `playAudio()`: zaštita `if (this.decodeRADE) return` — potiskuje reprodukciju sirovog SSB-a dok svira govor koji je dekodirao RADE
- Nove metode: `setRADEDecoding()`, `setRADECallback()`, `_radePlayPCM()` s planiranom reprodukcijom bez praznina pomoću sata `_radeNextTime` (reproducira na **16000 Hz** — izlaznoj frekvenciji `lpcnet_demo`)

**Svaka Svelte inačica** — 6 izmjena:
- `demodulationDefaults`: RADEL `{type:'LSB', offsets:[2200,-700]}`, RADEU `{type:'USB', offsets:[-700,2200]}` — propusni pojas počinje 700 Hz od nosioca i širok je 1500 Hz
- Varijable stanja: `radeEnabled`, `radeConnected`, `radeSynced`, `radeSnr`, `_radeDeactivate()`
- `_radeDeactivate()`: zaustavlja dekoder i **vraća zadani način rada za pojas** iz `bands-config.js` — ponašanje identično isključivanju FAX-a, NAVTEX-a i FSK-a
- `_deactivateAll()`: redak za čišćenje RADE-a
- `activateSelectedDecoder()`: grane `radel` i `radeu`
- Padajući izbornik dekodera: dvije nove stavke `<option>`
- Ploča stanja: točka povezanosti, stanje sinkronizacije/SNR-a, traka pogreške

### Početne skripte

Pokretači prijamnika (`start-rx888mk2.sh`, `start-airspyhf.sh`, `start-rtl.sh`, `start-rsp1a.sh`, `start-fobos-hf.sh`, `start-fobos.sh`, `start-hackrf.sh`) sami pokreću sidecar čim poslužitelj proradi, a `stop-websdr.sh` zaustavlja ga zajedno s poslužiteljem. `rade.sh` ostaje za samostalno pokretanje sidecara — vidi [Upravljanje sidecarom](#upravljanje-sidecarom).

---

## Upravljanje sidecarom

**Obično vam ne treba zasebna upravljačka skripta za RADE.** Pokretači prijamnika (`start-rx888mk2.sh`, `start-airspyhf.sh`, `start-rtl.sh`, `start-rsp1a.sh`, `start-fobos-hf.sh`, `start-fobos.sh`, `start-hackrf.sh`) sami pokreću sidecar čim se potvrdi da poslužitelj radi, ponovno ga pokreću ako se ugasi i javljaju njegovo stanje u završnom sažetku — `✔ RADE sidecar running`, ili napomena `·` koja objašnjava zašto nije aktiviran (nije instaliran, `RADE_ENABLED=0` ili nema `python3`). `./stop-websdr.sh` zaustavlja ga zajedno s poslužiteljem. Za rad poslužitelja bez RADE-a pokrenite ga s `RADE_ENABLED=0`.

`rade.sh` i dalje postoji za samostalnu upotrebu — pokretanje sidecara bez PhantomSDR-Plus pokretača ili njegovo zasebno testiranje:

```bash
chmod +x ~/PhantomSDR-Plus/rade.sh
cd ~/PhantomSDR-Plus
./rade.sh start      # start sidecar with self-restarting watchdog
./rade.sh stop       # stop sidecar + watchdog + all lpcnet_demo children
./rade.sh restart    # stop then start cleanly
./rade.sh status     # show running / stopped + process info
```

Aktivnost sidecara bilježi se u `~/PhantomSDR-Plus/rade.log`:

```bash
tail -f ~/PhantomSDR-Plus/rade.log
```

> **Nemojte miješati to dvoje dok poslužitelj radi.** Ako je čuvar nekog pokretača aktivan, vratit će sidecar u roku od otprilike pet sekundi, pa će izgledati kao da `./rade.sh stop` nije uspio. Da biste zaustavili RADE dok poslužitelj radi, pokrenite poslužitelj s `RADE_ENABLED=0` ili zaustavite sve s `./stop-websdr.sh`.

> Ako `rade.sh` pokrećete samostalno, **uvijek koristite `./rade.sh stop`** — sam `pkill -f rade_helper.py` ne pobjeđuje njegova čuvara, koji proces ponovno pokreće u roku od 3 sekunde.

---

## Vrata 8074

Sidecar sluša na TCP vratima **8074**, a preglednik se spaja izravno na njih, pa vrata moraju biti dostupna izvana. Njihovo otvaranje — ufw, firewalld, iptables, NAT pravilo na usmjerivaču i Nginx proxy za slučaj da davatelj usluge posve blokira vrata — [7. je korak ručnog vodiča](RADE_General_INSTALL_MANUAL_LINUX.md).

Dvije stvari vrijedi ovdje ponoviti jer oduzimaju najviše vremena:

```bash
# Is the sidecar listening?
ss -tlnp | grep 8074
```

> **Upozorenje o NAT hairpinu:** provjera naredbom `curl` s poslužitelja prema njegovu javnom imenu često vraća `Connection refused` i onda kada su vrata otvorena — mnogi usmjerivači ne vraćaju promet natrag. Uvijek testirajte s vanjskog računala ili upotrijebite **https://portchecker.co**.

---

## Korištenje RADE-a u pregledniku

1. Otvorite svoje web-sučelje PhantomSDR-Plusa
2. Aktivne postaje potražite na **[qso.freedv.org](https://qso.freedv.org)**
3. Ugodite se na prikazanu frekvenciju postaje
4. U **Decoder Options** odaberite:
   - **RADE v1 — RADEL (LSB)** za 40 m / 80 m / 160 m
   - **RADE v1 — RADEU (USB)** za 20 m / 17 m / 15 m / 12 m / 10 m
5. Kliknite **Decoder: ON**

### Gumbi RADEL / RADEU (jedan pritisak)

Korake 4 i 5 može zamijeniti jedan pritisak. Par gumba **RADEL** / **RADEU** dostupan je na tri mjesta:

- uz naslov **Modes selector** na glavnoj ploči;
- u skočnom prozoru **Modes**;
- u skočnom prozoru **Bands**.

Pritisak odabire dekoder, uključuje dekoder (ON), zatvara skočni prozor u kojem ste ga pritisnuli i dovodi RADE ploču na zaslon. Gumb je plav dok RADE radi. **Ponovni pritisak na isti gumb isključuje RADE** — ploča se zatvara, a način rada i propusni pojas vraćaju se kako je opisano niže. Gumbi, padajući izbornik **Decoder Options** i gumb ON/OFF dijele isto stanje.

### Stanja pokazatelja na ploči

| Pokazatelj | Značenje |
|---|---|
| 🔴 Crveno — „Connecting to sidecar…" | Port 8074 nedostupan ili sidecar ne radi |
| 🟡 Žuto — „Searching for signal…" | Sidecar spojen, RADE okvir još nije otkriven |
| 🟢 Zeleno — „Synced · SNR x.x dB" | Dekodiranje — govor se reproducira |

### Kada isključite dekoder

Način rada i propusni pojas automatski se vraćaju na ispravnu zadanu vrijednost za trenutačnu frekvenciju, kako je određeno u `bands-config.js` — jednako kao kod FAX-a, NAVTEX-a i FSK-a.

---

## Provjera i otklanjanje pogrešaka

### Radi li sidecar?

```bash
ps aux | grep rade_helper | grep -v grep
ss -tlnp | grep 8074
```

### Praćenje aktivnosti uživo

```bash
tail -f ~/PhantomSDR-Plus/rade.log
```

Kada se preglednik spoji:
```
[RADE] client connected: x.x.x.x:XXXXX
[RADE] x.x.x.x:XXXXX  sps=12000 sideband=LSB
[RADE] x.x.x.x:XXXXX spawning pipeline (torch_threads=1)
```

### Brza provjera WebSocketa

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

### Konzola preglednika (F12)

```
[RADE] ▶ ENABLED LSB @ 12000 Hz → helper ws://localhost:8074
```
Dobro — WebSocket je otvoren. Vrijednost u Hz odgovara `audioOutputSps` vašeg poslužitelja (obično 8000–12000 Hz).

```
[RADE] sidecar socket error
```
Port 8074 nije dostupan — provjerite vatrozid i NAT pravilo usmjerivača.

---

## Varijable okruženja

| Varijabla | Zadano | Opis |
|---|---|---|
| `RADE_HELPER_PORT` | `8074` | TCP port na kojem sluša sidecar |
| `RADE_HELPER_HOST` | `0.0.0.0` | Adresa vezanja (`127.0.0.1` iza proxyja) |
| `RADAE_DIR` | `~/radae` | Korijen repozitorija radae |
| `RADE_MODEL` | `RADAE_DIR/model19_check3/checkpoints/checkpoint_epoch_100.pth` | Težine modela |
| `LPCNET_DEMO` | `RADAE_DIR/build/src/lpcnet_demo` | Binarna datoteka lpcnet_demo |
| `RADE_AUXDATA` | `1` | Postavite na `0` da se `radae_rxe.py` proslijedi `--noauxdata` |
| `RADE_TORCH_THREADS` | `1` | PyTorch/OpenBLAS dretve po instanci `radae_rxe.py` — ograničava potrošnju CPU-a |
| `RADE_PIN_CORES` | `1` | Veže svaki lanac dekodiranja uz vlastiti skup jezgri; `0` isključuje vezanje |
| `RADE_CORES_PER_CLIENT` | `2` | Jezgri dodijeljenih po klijentu kada je vezanje uključeno |

---

## Promijenjene datoteke

| Datoteka | Vrsta | Napomene |
|---|---|---|
| `rade_helper.py` | **Nova** | Python sidecar: WebSocket poslužitelj + dvoprocesni lanac dekodiranja |
| `frontend/src/audio.js` | Izmijenjena | 4 zakrpe |
| `frontend/src/App.svelte` | Izmijenjena | 6 zakrpa |
| `rade.sh` | **Novo** | Upravljačka skripta RADE sidecara za samostalnu upotrebu (start/stop/restart/status) |
| `start-rx888mk2.sh` | Izmijenjeno | pokreće, nadzire i javlja stanje sidecara; isto vrijedi za `start-airspyhf.sh`, `start-rtl.sh`, `start-rsp1a.sh`, `start-fobos-hf.sh`, `start-fobos.sh`, `start-hackrf.sh` |
| `stop-websdr.sh` | Izmijenjeno | zaustavlja sidecar zajedno s poslužiteljem |
| `spectrumserver.cpp` | **Nepromijenjena** | Nisu potrebne izmjene u C++-u |

---

## Sažetak toka signala

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

## Rješavanje problema

### Crvena traka — „Sidecar not reachable"

```bash
# Is sidecar running?
ps aux | grep rade_helper | grep -v grep

# Start it manually for testing
python3 ~/PhantomSDR-Plus/rade_helper.py &

# Check port is open externally — use portchecker.co NOT curl from the server
# (curl from the server uses NAT loopback and gives false "Connection refused")
```

---

### Port 8074 prikazuje se zatvorenim na portchecker.co unatoč iptables pravilu

Možda pružatelj filtrira port ili nedostaje NAT pravilo na usmjerivaču. Mogućnosti:

1. Isprobajte drugi port: `RADE_HELPER_PORT=8080 python3 rade_helper.py`
2. Proslijedite promet kroz postojeća javna vrata pomoću Nginxa (vidi [7. korak ručnog vodiča](RADE_General_INSTALL_MANUAL_LINUX.md))

---

### `radae_rxe.py: error: unrecognized arguments: model_path`

Putanja modela mora se predati kroz `--model_name`, a ne kao pozicijski argument:

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

`radae_rxe.py` bezuvjetno uvozi matplotlib na vrhu datoteke.

---

### `ModuleNotFoundError: No module named 'torch'`

```bash
pip3 install torch
```

---

### `lpcnet_demo: No such file or directory`

Izgradnja radae nije dovršena. Izgradite ponovno:

```bash
cd ~/radae/build
cmake .. && make -j$(nproc)
ls src/lpcnet_demo     # should exist now
```

---

### Pogreška `size mismatch` u `inference.sh`

`model19_check3` traži `--auxdata` pri kodiranju pomoću `inference.sh`:

```bash
./inference.sh model19_check3/checkpoints/checkpoint_epoch_100.pth \
    wav/brian_g8sez.wav /dev/null \
    --rate_Fs --pilots --pilot_eq --eq_ls --cp 0.004 \
    --write_rx rx.f32 --auxdata    # ← required for model19_check3
```

Napomena: pri **dekodiranju** pomoću `radae_rxe.py` `--auxdata` je zadan — nemojte ga predavati.

---

### Žuti pokazatelj — „Searching for signal" — nikad se ne sinkronizira

- Potvrdite ispravan bočni pojas: RADEL za ≤ 10 MHz, RADEU za > 10 MHz
- Provjerite na [qso.freedv.org](https://qso.freedv.org) odašilje li neka postaja u tom trenutku
- RADE v1 koristi 30 nosilaca u 1500 Hz širine — u slapu se pojavljuje kao zbijena skupina
- Predvidite do 1,5 sekunde za uspostavu

---

### `underrun!!!` iz aplaya tijekom testa lanca (Korak 3)

Očekivano samo pri izvanmrežnom testiranju s datotekama. `radae_rxe.py` obrađuje sporije od datotečnog U/I-ja, pa audio međuspremnik ostaje prazan. Pri prijamu uživo to se ne događa jer preglednik dovodi zvuk u stvarnom vremenu.

---

### `ConnectionClosedError: received 1011 (internal error)`

Sidecar je prihvatio WebSocket vezu, ali se interno srušio prije nego što je odgovorio. Uzrok je nekompatibilna verzija `rade_helper.py` — starija je verzija pokušavala predati asyncio `StreamReader` kao standardni ulaz podprocesa, što tiho ne uspijeva i zatvara vezu s pogreškom 1011.

**Rješenje:** zamijenite `rade_helper.py` aktualnom verzijom iz skupa zakrpa. Aktualna verzija koristi `os.pipe()` za međuprocesnu cijev i kompatibilna je s websocketsom od 10.x do 16.x+.

---

### Više istodobnih korisnika

Svaka veza preglednika pokreće vlastiti neovisni par `radae_rxe.py` + `lpcnet_demo`, pa se svaki korisnik može slobodno ugoditi na drugu frekvenciju.

Prema zadanom, `radae_rxe.py` koristi **sve dostupne CPU jezgre** za matrične operacije PyTorcha, uzrokujući potrošnju CPU-a od ~900 % po instanci. `rade_helper.py` to ograničava s dvije optimizacije:

1. `OMP_NUM_THREADS=1` (i odgovarajuće MKL/OpenBLAS varijable) — ograničava PyTorch na 1 dretvu
2. Funkcije pretvorbe zvuka vektorizirane numpyjem — uklanjaju trošak Python petlji

Rezultat: svaka instanca troši otprilike **8–10 %** jedne jezgre, dovoljno za dekodiranje RADE-a u stvarnom vremenu. Ako čujete ispade zvuka, povećajte na 2 dretve:

```bash
RADE_TORCH_THREADS=2 ./start-rx888mk2.sh     # or your receiver's launcher
# standalone: RADE_TORCH_THREADS=2 ./rade.sh restart
```

| Istodobnih korisnika RADE-a | Približno opterećenje CPU-a |
|---|---|
| 1 | ~9 % |
| 5 | ~45 % |
| 10 | ~90 % |
| 20 | ~180 % |

Na i5-12450H (12 dretvi), gdje spectrumserver troši ~42 %, a rx888_stream ~11 %, imate otprilike **1000 % rezerve** — dovoljno za **20 i više istodobnih** korisnika RADE-a prije nego što CPU postane problem.

> **Gornja tablica pretpostavlja da trošak CPU-a raste linearno s brojem korisnika. Mjerenje govori da nije tako.** Pokretanje `rade_loadtest.py` na tom istom i5-12450H pokazalo je trošak CPU-a po slušatelju znatno ispod ove tablice do ~24 slušatelja, a zatim oštar rast, pri čemu je računalo zaustavljeno **temperaturom kućišta procesora pri 32 slušatelja** — ne CPU-om ni propusnošću. Te brojke uzmite tek kao grubu smjernicu za male brojeve i izmjerite vlastito računalo: vidi [Mjerenje istodobnosti na vlastitom hardveru](#mjerenje-istodobnosti-na-vlastitom-hardveru). Imajte na umu da test opterećenja lanac hrani šumom, a ne stvarnim RADE signalom, pa apsolutna potrošnja CPU-a uz stvaran promet može biti drukčija; pouzdan je *oblik* krivulje.

---

## Mjerenje istodobnosti na vlastitom hardveru

Gornje brojke potječu s jednog određenog računala. `rade_loadtest.py` (u korijenu repozitorija) mjeri isto na **vašem** — u koracima povećava broj sintetičkih RADE slušatelja prema sidecaru i javlja posljednji broj slušatelja koji je vaše računalo izdržalo prije nego što je nešto popustilo.

Nakon svakog koraka pusti računalo da se smiri, zatim uzorkuje temperaturu kućišta procesora, ukupni CPU, dostupni RAM, swap i zbrojeni RSS svih procesa `radae_rxe.py` i `lpcnet_demo`. Zaustavlja se na prvom **koljenu** — koje god ograničenje prvo bude prekoračeno — i ispisuje posljednji stabilan broj.

### Preduvjeti

```bash
sudo apt install python3-websockets python3-psutil
```

Pokrenite ga **na računalu sa SDR-om** (čita lokalne senzore i memoriju procesa), uz već pokrenute spectrumserver i RADE sidecar:

```bash
cd ~/PhantomSDR-Plus
python3 rade_loadtest.py
```

Ctrl-C u svakom trenutku uredno zatvara sve veze.

### Prije prvog pokretanja

Otvorite datoteku i provjerite dva bloka na vrhu:

- **`CONFIG`** — `WS_URL` je prema zadanom `ws://127.0.0.1:8074`; promijenite ga ako ste sidecar premjestili sa zadanog porta. `RADE_SPS` (12000) i `RADE_SIDEBAND` (`USB`) trebaju odgovarati onome što javlja vaše sučelje.
- **`handshake_messages()`** — jedini `init` okvir koji šalje mora odgovarati inicijalizaciji RADE-a u `frontend/src/audio.js`. Ako se to rukovanje razišlo, svaki se slušatelj ne uspije spojiti i test odmah završava neuspjelim vezama.

### Pragovi koljena

Podesite ih u `CONFIG` po želji — namjerno su konzervativni:

| Prag | Zadano | Zaustavlja kada |
|---|---|---|
| `TEMP_KNEE_C` | `85.0` | Temperatura kućišta procesora dosegne tu granicu |
| `MIN_AVAIL_MB` | `800` | Dostupni RAM padne ispod te vrijednosti |
| `SWAP_GROWTH_MB` | `50` | Swap naraste iznad polazne vrijednosti uzete pri pokretanju |
| `FAIL_LIMIT` | `3` | Toliko se slušatelja ne uspije spojiti u jednom koraku |
| `MAX_LISTENERS` | `60` | Tvrdo zaustavljanje čak i ako koljeno nikad ne nastupi |

Oblik porasta određuju `STEP` (slušatelja dodanih po koraku, zadano 2), `SETTLE_S` (25 s smirivanja prije uzorkovanja — to omogućuje nakupljanje topline) i `SAMPLE_S` (petosekundni prozor usrednjavanja CPU-a). Potpuni prolaz do zadane granice od 60 slušatelja traje stoga otprilike 15 minuta.

### Čitanje rezultata

Svaki korak ispisuje redak i dodaje zapis u `rade_loadtest.csv`:

| Stupac | Značenje |
|---|---|
| `listeners` | Sintetički slušatelji spojeni u ovom koraku |
| `connect_fails` | Slušatelji koji nisu uspjeli uspostaviti ili zadržati vezu |
| `pkg_c` | Temperatura kućišta procesora, medijan 5 uzoraka (otporan na skokove) |
| `cpu_pct` | Postotak CPU-a **cijelog sustava**, ne po slušatelju |
| `avail_mb` | Dostupni RAM |
| `swap_mb` | Zauzeti swap |
| `dec_rss_mb` | Zbrojeni RSS svih procesa dekodiranja |
| `dec_procs` | Broj procesa dekodiranja — očekujte **2 po slušatelju** (`radae_rxe.py` + `lpcnet_demo`) |

#### Izmjereni prolaz

Na gore spomenutom i5-12450H potpuni je prolaz završio ovako:

```
KNEE at n=32: temp 91.0°C ≥ 85.0
Last stable concurrency: 30 RADE listeners
```

**Toplina je bila ograničavajući čimbenik**, i to uvjerljivo. Na koljenu je još bilo 7004 MB dostupnog RAM-a — 6,2 GB iznad granice `MIN_AVAIL_MB` — i nula neuspjelih veza u svakom koraku.

Dva stupca vrijedi pažljivo pročitati:

**`dec_rss_mb` precjenjuje stvarni trošak memorije.** Raste vrlo ravnomjerno, 295 MB po slušatelju (292, 294, 294 … 295 kroz svih 16 koraka), ali *dostupni* RAM pada samo oko **202 MB po slušatelju**. Dva procesa iza svakog slušatelja dijele stranice biblioteka, a RSS te stranice broji jednom po procesu. Ekstrapolacijom nagiba `avail_mb`, memorijsko bi koljeno nastupilo blizu **63 slušatelja** — iza tvrdog zaustavljanja na 60, pa se na ovom računalu nikad ne može aktivirati. Memoriju dimenzionirajte prema `avail_mb`, a ne prema `dec_rss_mb`.

**`cpu_pct` je ravan — dok odjednom nije.** Do 24 slušatelja stoji na ~5,3 % cijelog računala, a zatim postaje nadlinearan:

| Slušatelja | 24 | 26 | 28 | 30 | 32 |
|---|---|---|---|---|---|
| `cpu_pct` | 6,7 % | 18,4 % | 30,1 % | 49,6 % | 65,2 % |

To je deseterostruki porast CPU-a dok broj slušatelja raste za trećinu. Točka pregiba reproducira se na istom mjestu kroz više prolaza, pa je tretirajte kao svojstvo računala, a ne kao šum — trošak CPU-a po slušatelju iznosi otprilike 3,4 % jedne jezgre ispod pregiba i oko 20 % iznad njega. Nemojte ekstrapolirati vrijednost CPU-a po korisniku izmjerenu pri malom broju slušatelja.

> **Test nema koljeno po CPU-u.** Četiri su granice temperatura, dostupni RAM, rast swapa i neuspjele veze — CPU se bilježi, ali nikad ne prekida prolaz. U gornjem je prolazu CPU dosegao 65 % i nastavio bi rasti da nije prva okinula temperatura. Ako vam je važna gornja granica CPU-a, sami pratite taj stupac ili dodajte prag.

> **Što ovo dokazuje, a što ne.** Svaki sintetički slušatelj šalje slučajan šum male amplitude, a ne stvaran RADE signal. To je dovoljno da cijeli lanac dekodiranja radi i troši resurse, pa su brojke o resursima smislene — ali test ništa ne govori o *kvaliteti* dekodiranja ni o neprekidnosti zvuka pod opterećenjem. To potvrdite sa stvarnim slušateljima na stvarnom signalu.

### Ako se jezgre zasite prije koljena

RADE čvrsto veže jednu dretvu po instanci, pa pojedinačne jezgre mogu doseći ~90 °C dok ukupni CPU još izgleda neopterećeno. `rade_helper.py` lance raspoređuje po jezgrama kružno kako bi to ublažio. Ako prolaz pokazuje rana toplinska koljena, proširite dodjelu jezgri po klijentu:

```bash
RADE_CORES_PER_CLIENT=3 ./rade.sh restart
```

Nije potrebno uređivati datoteke — riječ je o varijabli okruženja (vidi [Varijable okruženja](#varijable-okruženja)); `RADE_PIN_CORES=0` posve isključuje vezanje.

---

## Ažuriranje RADE v1

Integracija s PhantomSDR-Plusom (`rade_helper.py`, zakrpe sučelja) samo je most — sva logika dekodiranja RADE-a nalazi se u repozitoriju `radae`. Ažuriranja su stoga gotovo uvijek jednostavan `git pull` uz ponovnu izgradnju, bez ikakvih izmjena u samom PhantomSDR-Plusu.

### Uobičajeno ažuriranje (novi kod, isti model)

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

To je sve. Bez ponovne izgradnje sučelja, bez ponovnog pokretanja poslužitelja i bez uređivanja datoteka.

### Samo nove težine modela

Ako izađe nova kontrolna točka (npr. `model20`) bez izmjena koda, usmjerite sidecar na nove težine putem varijable okruženja — uređivanje datoteka nije potrebno:

```bash
# One-off: start with new model
RADE_MODEL=~/radae/model20/checkpoints/checkpoint_epoch_100.pth ./rade.sh start

# Or permanently — add to your shell profile (~/.bashrc):
export RADE_MODEL=~/radae/model20/checkpoints/checkpoint_epoch_100.pth
```

### Što koja vrsta promjene zahtijeva

| Što se promijenilo u radae | Potrebna radnja |
|---|---|
| Nove težine modela (nova `.pth` datoteka) | Postaviti varijablu `RADE_MODEL`, `./rade.sh restart` |
| Izmjena koda u `radae_rxe.py` | `git pull`, `./rade.sh restart` |
| Promijenjen C kod `lpcnet_demo` | `git pull`, ponovna izgradnja, `./rade.sh restart` |
| `radae_rxe.py` preimenovan ili premješten | Ažurirati putanju `RADAE_RX` u `rade_helper.py` (jedan redak) |
| Argument `--model_name` preimenovan | Ažurirati `radae_cmd` u `rade_helper.py` (jedan redak) |
| Nova izlazna frekvencija uzorkovanja (≠ 16000 Hz) | Ažurirati `SPS_OUT` u `rade_helper.py` i `createBuffer()` u `audio.js` |
| RADE v2 koristi drugu binarnu datoteku | Ažurirati `RADAE_RX` u `rade_helper.py` (jedan redak) |

### Provjera je li ažuriranje uspjelo

Nakon ponovnog pokretanja provjerite radi li novi kod:

```bash
# Check sidecar picked up new radae_rxe.py
./rade.sh status

# Tail log to see startup lines
tail -20 ~/PhantomSDR-Plus/rade.log
```

Zapisnik bi trebao prikazivati očekivanu putanju modela:
```
[RADE] model : /home/sv1btl/radae/model19_check3/checkpoints/checkpoint_epoch_100.pth
```

### Kako pratiti novosti

Pretplatite se na stranicu izdanja repozitorija radae kako biste primali obavijesti o novim modelima i ažuriranjima koda:

```
https://github.com/drowe67/radae/releases
```

Pratite FreeDV blog za najave novih RADE valnih oblika i modela:

```
https://freedv.org/blog/
```

---

*Razvijeno i testirano na PhantomSDR-Plusu (fork sv1btl/PhantomSDR-Plus) s RX-888 MK2 na Ubuntuu 24.04. Poslužitelj u C++-u nije mijenjan.*

*RADE razvijaju David Rowe VK5DGR i FreeDV tim.* *Vidi [freedv.org/radio-autoencoder](https://freedv.org/radio-autoencoder).*

---

### Potpuna deinstalacija i čista ponovna instalacija

Evo potpunog uklanjanja prije ponovnog pokretanja install_rade.sh:
1. Zaustavite sidecar cd ~/PhantomSDR-Plus && ./rade.sh stop
2. Uklonite repozitorij radae i izgradnju rm -rf ~/radae
3. Uklonite torch (instaliran u korisničkom direktoriju) pip3 uninstall -y torch rm -rf ~/.local/lib/python3.11/site-packages/torch*
4. Uklonite Python pakete iz apta (neobavezno — preskočite ako ih koristi nešto drugo) sudo apt-get remove -y python3-numpy python3-scipy python3-matplotlib python3-websockets sudo apt-get autoremove -y
5. Provjerite je li sve uklonjeno python3 -c "import torch" 2>&1        # should say ModuleNotFoundError ls ~/radae 2>&1                        # should say No such file or directory
6. Čista instalacija chmod +x ~/PhantomSDR-Plus/install_rade.sh ~/PhantomSDR-Plus/install_rade.sh
