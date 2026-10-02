# RADE v1 — Vodič za ručnu instalaciju
### Raspberry Pi / Debian Bookworm (ARM64) · PhantomSDR-Plus

> **Preduvjet:** zakrpane datoteke (`rade_helper.py`, `rade.sh`, `audio.js`, `App.svelte`) već se nalaze u stablu direktorija PhantomSDR-Plusa. Ovaj vodič gradi sve ostalo oko njih.

> [!IMPORTANT]
> **Prvo probajte skriptu.** `./install_rade.sh` u mapi PhantomSDR-Plus obavlja svaki korak u nastavku umjesto vas, a `./install.sh` nudi da je pokrene tijekom normalne instalacije. Ovaj je vodič tu za ručni postupak i za posebnosti Pija (PEP 668 i torch kotačić samo za CPU) ako skripta na vašoj pločici naiđe na problem.

---

## Korak 1 — Sistemski paketi

```bash
sudo apt update
sudo apt install -y \
    build-essential cmake git \
    python3 python3-pip \
    nodejs npm \
    alsa-utils
```

---

## Korak 2 — Python paketi

> **Važno — dva pravila Debiana Bookworm:**
>
> 1. Svaka naredba `pip3 install` traži `--break-system-packages` (provedba
> PEP-a 668). Bez toga je instalacija potpuno blokirana.
> 2. Obična naredba `pip3 install torch` preuzima CUDA izdanje (~3 GB).
> Na Piju nema CUDA-e — koristite indeks samo za CPU kako biste dobili lagano ARM64 izdanje (~150 MB).

```bash
# All packages except torch
pip3 install --break-system-packages websockets matplotlib numpy scipy

# torch — CPU-only build (~150 MB, no CUDA)
pip3 install --break-system-packages torch \
    --index-url https://download.pytorch.org/whl/cpu
```

### Provjera

```bash
python3 -c "import websockets, matplotlib, torch, numpy, scipy; print('All OK')"
```

Očekivani ispis:
```
All OK
```

---

## Korak 3 — Kloniranje i izgradnja repozitorija radae

RADE dekoder nalazi se u repozitoriju odvojenom od codec2. `freedv_rx` iz codec2 **ne** podržava RADE v1.

```bash
# Remove any previous incomplete clone
rm -rf ~/radae

# Clone
git clone https://github.com/drowe67/radae.git ~/radae
cd ~/radae

# Build
mkdir build && cd build
cmake ..
make -j$(nproc)
```

### Provjerite je li lpcnet_demo izgrađen

```bash
ls -la ~/radae/build/src/lpcnet_demo
```

Očekivano: binarna datoteka postoji i izvršna je.

### Provjerite postoje li težine modela

```bash
ls ~/radae/model19_check3/checkpoints/checkpoint_epoch_100.pth
```

Očekivano: `.pth` datoteka je navedena. Težine dolaze uz repozitorij — nije potrebno zasebno preuzimanje.

---

## Korak 4 — Provjera lanca dekodiranja

Ovaj korak potvrđuje da cijeli izvanmrežni lanac radi prije nego što ga povežete s preglednikom. Pokrenite iz `~/radae`:

```bash
cd ~/radae
```

### 4a — Stvorite ispitni signal kodiran RADE-om

```bash
./inference.sh model19_check3/checkpoints/checkpoint_epoch_100.pth \
    wav/brian_g8sez.wav /dev/null \
    --rate_Fs --pilots --pilot_eq --eq_ls --cp 0.004 \
    --write_rx rx.f32 --auxdata
```

Pričekajte da završi. Posljednji ispisani redci trebali bi biti:
```
loss: 0.741 Auxdata BER: 0.012
```

### 4b — Dekodirajte i reproducirajte

```bash
cat rx.f32 \
    | python3 radae_rxe.py \
        --model_name model19_check3/checkpoints/checkpoint_epoch_100.pth \
    | ./build/src/lpcnet_demo -fargan-synthesis - - \
    | aplay -f S16_LE -r 16000
```

Trebali biste čuti glas. Ispis prikazuje uspostavu sinkronizacije:
```
  1 state: search     ...
  5 state: sync       ... SNRdB:  4.03 uw_err: 0
Playing raw data 'stdin' : Signed 16 bit Little Endian, Rate 16000 Hz, Mono
```

> **Poruke `underrun!!!` tijekom ovog testa očekivane su i bezopasne.** `radae_rxe.py` obrađuje sporije od datotečnog U/I-ja. Pri prijamu uživo ne pojavljuju se jer preglednik dovodi zvuk u stvarnom vremenu.

### 4c — Provjerite pokreće li se sidecar ispravno

```bash
python3 ~/PhantomSDR-Plus/rade_helper.py
```

Očekivani ispis (bez WARNING redaka):
```
[RADE] helper starting on ws://0.0.0.0:8074
[RADE] radae_rx.py    : /home/pi/radae/radae_rxe.py
[RADE] model          : /home/pi/radae/model19_check3/checkpoints/checkpoint_epoch_100.pth
[RADE] lpcnet_demo    : /home/pi/radae/build/src/lpcnet_demo
[RADE] auxdata        : ON (default)
[RADE] torch threads  : 1 per instance (RADE_TORCH_THREADS to override)
[RADE] architecture   : per-connection (each user tunes independently)
[RADE] listening — waiting for PhantomSDR-Plus clients
```

Pritisnite **Ctrl+C** za prekid.

---

## Korak 5 — Izgradnja sučelja PhantomSDR-Plusa

```bash
cd ~/PhantomSDR-Plus/frontend

# Only if node_modules is missing:
npm install

cd ~/PhantomSDR-Plus
./recompile.sh
```

Pripazite na pogreške Vite/acorn raščlanjivača. Zakrpane datoteke namjerno izbjegavaju `?.`, `??` i prazne `catch {}` kako bi zadovoljile ograničenje acorna.

---

## Korak 6 — Upravljačka skripta rade.sh

```bash
chmod +x ~/PhantomSDR-Plus/rade.sh
```

Dostupne naredbe:

```bash
cd ~/PhantomSDR-Plus
./rade.sh start      # start sidecar with self-restarting watchdog
./rade.sh stop       # stop sidecar + watchdog + all lpcnet_demo children
./rade.sh restart    # stop then start cleanly
./rade.sh status     # show running / stopped + process info
```

> **Uvijek koristite `./rade.sh stop`** — sam `pkill -f rade_helper.py` neće nadjačati watchdog, koji proces ponovno pokreće unutar 3 sekunde.

---

## Korak 7 — Otvorite port 8074

Sidecar sluša na TCP portu **8074**. Preglednik se spaja izravno na taj port. Morate ga otvoriti ručno:

### Vatrozid — ufw

```bash
sudo ufw allow 8074/tcp && sudo ufw reload
```

### Vatrozid — iptables

```bash
sudo iptables -I INPUT -p tcp --dport 8074 -j ACCEPT

# Make permanent across reboots:
sudo apt install iptables-persistent
sudo netfilter-persistent save
```

### Usmjerivač

Dodajte pravilo NAT-a / prosljeđivanja porta: **TCP 8074 → LAN IP poslužitelja : 8074**

### Testiranje izvana

Upotrijebite **https://portchecker.co** i provjerite port 8074 prema svojem javnom nazivu poslužitelja. **Nemojte** testirati naredbom `curl` sa samog poslužitelja — NAT hairpin daje lažne rezultate „Connection refused" čak i kad je port otvoren.

### Alternativa — Nginx proxy (ako pružatelj blokira port 8074)

Dodajte unutar postojećeg bloka `server {}`:

```nginx
location /rade {
    proxy_pass         http://127.0.0.1:8074;
    proxy_http_version 1.1;
    proxy_set_header   Upgrade    $http_upgrade;
    proxy_set_header   Connection "upgrade";
    proxy_set_header   Host       $host;
    proxy_read_timeout 3600s;
}
```

```bash
sudo nginx -t && sudo nginx -s reload
```

Zatim uredite `audio.js` unutar funkcije `setRADEDecoding()`:

```js
// Change:
var helperUri = uri || ('ws://' + window.location.hostname + ':8074');
// To:
var helperUri = uri || ('ws://' + window.location.host + '/rade');
```

Nakon te izmjene ponovno izgradite sučelje.

---

## Korak 8 — Pokrenite poslužitelj

Pokrenite PhantomSDR-Plus kao i inače. RADE se **ne** pokreće automatski:

```bash
cd ~/PhantomSDR-Plus
./start-rx888mk2.sh      # or start-airspyhf.sh,
                         # start-rtl.sh, start-rsp1a.sh
```

Upotrijebite pokretač koji odgovara vašem prijamniku. Svaki ima vlastiti watchdog i zapisnik; `./stop-websdr.sh` zaustavlja onaj koji radi.

---

## Korak 9 — Pokrenite RADE

```bash
cd ~/PhantomSDR-Plus
./rade.sh start
./rade.sh status
tail -f rade.log
```

Očekivani zapisnik:
```
[RADE] sidecar starting at ...
[RADE] helper starting on ws://0.0.0.0:8074
[RADE] radae_rx.py    : /home/pi/radae/radae_rxe.py
[RADE] model          : /home/pi/radae/model19_check3/checkpoints/checkpoint_epoch_100.pth
[RADE] lpcnet_demo    : /home/pi/radae/build/src/lpcnet_demo
[RADE] auxdata        : ON (default)
[RADE] torch threads  : 1 per instance
[RADE] architecture   : per-connection (each user tunes independently)
[RADE] listening — waiting for PhantomSDR-Plus clients
```

---

## Korak 10 — Korištenje RADE-a u pregledniku

1. Otvorite svoje web-sučelje PhantomSDR-Plusa
2. Aktivne postaje potražite na **https://qso.freedv.org**
3. Ugodite se na prikazanu frekvenciju postaje
4. U **Decoder Options** odaberite:
   - **RADE v1 — RADEL (LSB)** za 40 m / 80 m / 160 m (≤ 10 MHz)
   - **RADE v1 — RADEU (USB)** za 20 m / 17 m / 15 m / 12 m / 10 m (> 10 MHz)
5. Kliknite **Decoder: ON**

Korake 4 i 5 može zamijeniti jedan pritisak: gumbi **RADEL** / **RADEU** nalaze se uz naslov **Modes selector** te u skočnim prozorima **Modes** i **Bands**. Jedan pritisak odabire dekoder, uključuje ga i dovodi RADE ploču na zaslon; ponovni pritisak isključuje RADE. Pogledajte [priručnik za RADE](RADE_README.md).

| Pokazatelj | Značenje |
|---|---|
| 🔴 Crveno — „Connecting to sidecar…" | Port 8074 nedostupan ili sidecar ne radi |
| 🟡 Žuto — „Searching for signal…" | Sidecar spojen, RADE okvir još nije otkriven (predvidite ~1,5 s) |
| 🟢 Zeleno — „Synced · SNR x.x dB" | Dekodiranje — govor se reproducira |

---

## Napomena o procesoru

Svaki korisnik RADE-a troši oko 8–10 % jedne jezgre (sidecar ograničava broj PyTorch dretvi na 1). Ako čujete ispade zvuka, povećajte na 2 dretve:

```bash
RADE_TORCH_THREADS=2 ./rade.sh restart
```

---

## Buduće ažuriranje RADE-a

```bash
cd ~/radae
git pull
cmake -S . -B build && make -C build -j$(nproc)

cd ~/PhantomSDR-Plus
./rade.sh restart
```

Ponovna izgradnja sučelja ili ponovno pokretanje poslužitelja nisu potrebni osim ako se promijenio sam `rade_helper.py`.

---

*Testirano na Raspberry Pi 4 / ARM64, Debian Bookworm, Python 3.11.* *PhantomSDR-Plus fork: sv1btl/PhantomSDR-Plus.* *RADE su razvili David Rowe VK5DGR i FreeDV tim — https://freedv.org*
