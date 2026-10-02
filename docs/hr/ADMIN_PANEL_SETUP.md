# Administratorska ploča PhantomSDR-Plusa — Vodič za postavljanje

> ⚠️ **Sigurnosna napomena:** držite ovu administratorsku ploču na kućnoj mreži ili iza VPN-a. Javno izlaganje administratorskog porta ne preporučuje se bez odgovarajućeg pojačanja autentifikacije.

---

## Pregled

Administratorska ploča sastoji se od dvije Python usluge:

| Usluga | Datoteka | Uloga |
|---|---|---|
| Administratorska ploča | `admin_server.py` | Flask web-aplikacija, veže se na `127.0.0.1` (samo interno) |
| Obratni proxy | `proxy.py` | Izlaže i SDR i administratorsku ploču na jednom javnom portu |

Obje usluge čitaju konfiguraciju iz `admin_config.json`, koju zapisuje `setup_admin.sh`. **Nemojte izravno mijenjati konstante portova u Python datotekama** — svi portovi i IP adresa SDR poslužitelja pohranjeni su u `admin_config.json`.

---

## Što vam administratorska ploča donosi

- **Nadzorna ploča** — stanje poslužitelja uživo, CPU/RAM, najzahtjevniji procesi, nedavni ispis zapisnika, terminal
- **Uređivač konfiguracije** — pregled, uređivanje i spremanje bilo koje `.toml`, `.sh`, `.json`, `.h` ili `.cpp` datoteke u vašoj instalaciji
- **Preglednik zapisnika** — praćenje bilo koje datoteke zapisnika u stvarnom vremenu (SDR poslužitelj, administratorska ploča, RADE, rušenja, autorun, proxy)
- **Oznake** — pregled i uređivanje frekvencijskih oznaka
- **Povijest razgovora** — pregled zapisnika WebSDR razgovora, potpuno brisanje ili uklanjanje pojedinačnih poruka bez ponovnog pokretanja poslužitelja
- **Poruka na slapu** — emitiranje trajne poruke svim spojenim korisnicima, vidljive u stvarnom vremenu na prikazu slapa
- **Korisnici** — popis spojenih slušatelja uživo s njihovom frekvencijom, načinom rada, trajanjem veze i gumbom ⚡ Kick
- **Brisanje poruka razgovora** — gumb 🗑 Delete koji odmah uklanja tu jednu poruku iz zapisnika
- **Emitirane poruke na slapu** — omogućuje slanje trajnog tekstualnog natpisa na slap svakog spojenog korisnika
- **Spot Reporting** — pokretanje/zaustavljanje autorun dekodera FT8/FT4/JS8/WSPR, odabir pojaseva/načina rada i prijava spotova na PSK Reporter / wsprnet (prema zadanom isključeno), s dva brojača: pločice po dekoderu za tekući rad i ukupan zbroj od početka uz svaki potvrdni okvir pojasa/načina rada
- **Grafikoni** — frekvencija procesora, opterećenje procesora, temperatura procesora i povezani korisnici, prikazani kroz zadnjih 15 minuta / 1 sat / 4 sata / 12 sati / 24 sata
- **Toplinska zaštita (Thermal Guard)** — zaustavlja poslužitelj ako se procesor pregrije i ponovno ga pokreće kad se ohladi, s pragovima izvedenima iz vašeg vlastitog procesora; radi s bilo kojim načinom pokretanja/zaustavljanja i isporučuje se u načinu samo zapisivanja, pa ne čini ništa dok ga ne uključite
- **Postavke** — promjena administratorske lozinke, osnovnog direktorija SDR-a, naziva procesa i javnog porta

---

## Preduvjeti

- PhantomSDR-Plus već instaliran i pokrenut
- Python 3.8+

> [!NOTE]
> **Uobičajeno to za vas obavlja instalacijska skripta.** `./install.sh` — kao i svaka od četiri distribucijske skripte, obje RADE skripte i skripta poslužitelja statistike — postavlja ploču prema zadanome, uz prethodnu instalaciju `pipa` upraviteljem paketa sustava ako nedostaje. Ova stranica opisuje što se u tom koraku događa i što učiniti ako ste ga preskočili ili želite nešto naknadno promijeniti.

Python biblioteke ploče (`flask`, `psutil`, `aiohttp`, `tomli-w`) instalira `setup_admin.sh`; ako to zakaže, ispisuje točnu naredbu koju treba pokrenuti.

---

## Korak 1 — Datoteke

Postavite ove četiri datoteke u svoj PhantomSDR-Plus direktorij:

```
admin_server.py
manage_admin.sh
setup_admin.sh
proxy.py
```

Postavite skripte ljuske kao izvršne:

```bash
chmod +x setup_admin.sh manage_admin.sh
```

---

## Korak 2 — Pokrenite skriptu za postavljanje

```bash
./setup_admin.sh
```

Skripta će:

1. Provjeriti je li instaliran Python 3
2. Provjeriti postoje li `admin_server.py` i `manage_admin.sh`
3. Zabilježiti `127.0.0.1` kao `sdr_host` u konfiguraciji (vidi [Postavka `sdr_host`](#postavka-sdr_host))
4. Zatražiti tri broja porta. Svaki upit nudi zadanu vrijednost u uglatim zagradama koju
prihvaća običan Enter, pa je uobičajeno postavljanje pitanje triju pritisaka tipke:
   - **Port spectrumservera** — port na kojem sluša vaš SDR poslužitelj (zadano `8900`,
     upravo ono što donosi svaki `config-*.toml` u repozitoriju)
   - **Interni port administratorske ploče** — gdje se `admin_server.py` lokalno veže (zadano `3000`)
   - **Javni port proxyja** — jedini vanjski port koji objedinjuje SDR + administraciju (zadano `8902`)

Neispravni odgovori odbijaju se i pitanje se ponavlja, ali samo pet puta — nakon toga uzima se zadana vrijednost. Izvođenje čiji ulaz nije terminal (kroz cijev, cron, bez nadzora) odmah uzima zadane vrijednosti umjesto da čeka unos koji nikad neće stići.
5. Instalirati `flask`, `psutil`, `aiohttp` i `tomli-w` putem pipa
6. Dodijeliti naredbi `ss` mogućnost `cap_net_admin` (pomoćni put značajke Kick Users, potreban samo ako ploča radi bez proxyja)
7. Pitati koja skripta pokreće, a koja zaustavlja prijamnik — preko njih ploča upravlja poslužiteljem, a jednako tako i toplinska zaštita
8. Pitati koliko daleko toplinska zaštita procesora smije ići sama — `log`, `throttle`, `stop` ili `stop+restart` — i ponuditi pokretanje `setup-cpufreq-perms.sh` kako bi throttle faza radila bez roota (vidi [THERMAL_GUARD.md](THERMAL_GUARD.md))
9. Zapisati `admin_config.json` sa svim postavkama
10. Ponuditi instalaciju dviju systemd jedinica (ploča + proxy) — pokretanje pri dizanju sustava i ponovno pokretanje nakon pada. **Preporučeno i zadano** (dovoljan je Enter): zaštita od pregrijavanja procesora radi samo dok radi ploča, pa bez jedinica ponovno dizanje sustava ostavlja računalo nezaštićenim. Korak se automatski preskače ondje gdje systemd nije PID 1 (kontejneri, WSL1, OpenRC) ili gdje nemate sudo.

Nakon postavljanja otvorite preglednik putem proxyja:
```
http://YOUR_SERVER_IP:<proxy_port>/admin
```
Zadana lozinka: **`admin`**

> ⚠️ **Odmah promijenite lozinku** — pri prvoj prijavi idite na Settings. Čarobnjak prvog pokretanja vodit će vas kroz postavljanje SDR direktorija, naziva procesa, javnog porta i nove lozinke.

---

## Korak 3 — Pokretanje / zaustavljanje / ponovno pokretanje

Postoje dva načina za pokretanje ploče i proxyja. **Odaberite jedan i držite ga se** — upozorenje na kraju ovog odjeljka objašnjava što se događa ako ih miješate.

> **Način B (systemd) snažno se preporučuje** svugdje gdje je systemd dostupan. Zaštita od pregrijavanja procesora radi unutar ploče, pa ploča koja umre u 03:00 ili računalo koje se ponovno digne ostavljaju procesor nezaštićenim dok ga netko ručno ne pokrene. `setup_admin.sh` sada nudi jedinice po zadanome. Način A koristite kad systemda nema — kontejneri, WSL1, OpenRC/sysvinit — ili kad namjerno želite sami nadzirati stvari.

### Način A — `manage_admin.sh` (bez roota, ništa se ne instalira)

```bash
./manage_admin.sh start      # start admin panel and proxy
./manage_admin.sh stop       # stop both
./manage_admin.sh status     # show running status and PIDs
```

Namjerno **nema `restart`**. Prije je ubijao ploču i odmah pokretao vlastitu kopiju, što se sudara sa systemd-om na svakom računalu koje koristi Način B. Za ponovno pokretanje po Načinu A izvršite `stop` pa `start` — vidi [Ponovno pokretanje ploče](#ponovno-pokretanje-ploče) niže.

Jedna skripta upravlja **objema** procesima. Prije pokretanja proxyja provjerava je li instaliran `aiohttp` i ispisuje jasnu pogrešku s naredbom za ispravak ako ga nema.

Ništa se ne pokreće samo od sebe: nakon ponovnog pokretanja sustava, ili ako se ploča sruši, pokrećete je ručno. To je u redu za prijamnik koji nadzirete, ali imajte na umu da toplinska zaštita procesora radi unutar ploče: dok je ploča ugašena, ništa ne štiti stroj (vidi [THERMAL_GUARD.md](THERMAL_GUARD.md)).

### Način B — systemd jedinice (pokreću se pri dizanju sustava, ponovno se pokreću nakon pada)

Repozitorij donosi dvije gotove jedinice, `phantomsdr-admin.service` i `phantomsdr-proxy.service`. U obje prilagodite `User=` i putanje, zatim:

```bash
sudo cp phantomsdr-admin.service phantomsdr-proxy.service /etc/systemd/system/
sudo systemctl daemon-reload
./manage_admin.sh stop        # free the ports first
sudo systemctl enable --now phantomsdr-admin
sudo systemctl enable --now phantomsdr-proxy
```

Svakodnevne naredbe tada postaju:

```bash
sudo systemctl start   phantomsdr-admin
sudo systemctl stop    phantomsdr-admin
sudo systemctl restart phantomsdr-admin
systemctl status       phantomsdr-admin
sudo journalctl -u phantomsdr-admin -f
```

Iste četiri s `phantomsdr-proxy`, ili obje odjednom: `sudo systemctl restart phantomsdr-admin phantomsdr-proxy`.

`admin.log` i `proxy.log` rade točno kao i prije — jedinice pišu u iste datoteke.

Jedno napravite jednom: instalirajte tmpfiles pravilo iz `tmpfiles/phantomsdr-logs.conf` (prvo u njemu izmijenite putanje i korisnika). systemd te dvije datoteke stvara kao `root` prije nego se spusti na `User=`, pa gumb **Clear Logs** na ploči na njima pada uz `Permission denied` — vidi niže „Clear Logs javlja Permission denied“. `setup_admin.sh` pravilo instalira umjesto vas.

Jedinica ploče nosi `SupplementaryGroups=cpufreq`, što throttle fazi toplinske zaštite omogućuje snižavanje takta procesora bez da ploča radi kao root. Tu grupu prvo stvorite s `./setup-cpufreq-perms.sh`, inače systemd neće pokrenuti jedinicu; obrišite taj redak ako ne koristite throttle fazu.

Povratak na način A:

```bash
sudo systemctl disable --now phantomsdr-admin
sudo systemctl disable --now phantomsdr-proxy
```

> ⚠️ **Nemojte ih miješati.** Uz uključene jedinice, `./manage_admin.sh stop` systemd poništi pet sekundi kasnije, a `./manage_admin.sh start` daje vam drugu, neupravljanu kopiju koja se sa systemd-ovom otima za isti port. (`restart` je upravo zbog toga uklonjen iz skripte; sada ispisuje pogrešku i upućuje vas na `systemctl`.) `./manage_admin.sh status` samo čita pa ostaje koristan u oba slučaja.

### Ponovno pokretanje ploče

Ostatak ovog dokumenta na više mjesta kaže „ponovno pokrenite ploču“. To znači ono što odgovara vašem načinu:

```bash
# Način B — systemd jedinice (uobičajena postava)
sudo systemctl restart phantomsdr-admin phantomsdr-proxy

# Način A — jedinice nisu instalirane
./manage_admin.sh stop && ./manage_admin.sh start
```

Jedinica dolazi s `KillMode=process` i ta je linija ključna. Ako SDR pokrećete iz ploče, prijamnik je dijete administratorske jedinice i nasljeđuje njezinu cgroup. Uz systemdovu zadanu vrijednost `KillMode=control-group`, ponovno pokretanje ploče povuklo bi sa sobom spectrumserver, njegov watchdog i autorun demon — nakon što bi prethodno stalo punih 90 sekundi vremena čekanja na zaustavljanje. Uz `KillMode=process` systemd signalizira samo ploči, pa `sudo systemctl restart phantomsdr-admin` ostavlja zauzet prijamnik na eteru.

**Nadogradnja jedinice instalirane prije v4.1.0.** Starije datoteke jedinice nemaju tu liniju, a ponovno pokretanje ploče je neće dodati: `systemctl restart` ponovno pokreće program, ali ne mijenja njegovu konfiguraciju. Uredite *instaliranu* kopiju — ona u repozitoriju samo je predložak koji systemd nikada ne čita:

```bash
sudo nano /etc/systemd/system/phantomsdr-admin.service
```

Dodajte `KillMode=process` u odjeljak `[Service]`, uz `Restart=always`. Zatim neka systemd ponovno pročita datoteku i provjerite:

```bash
sudo systemctl daemon-reload
systemctl show phantomsdr-admin -p KillMode
```

Druga naredba mora ispisati `KillMode=process`. Ako i dalje ispisuje `control-group`, systemd radi sa spremljenom kopijom — `systemctl show phantomsdr-admin -p NeedDaemonReload` javlja `yes` dok je ponovno učitavanje na čekanju. Vodeći razmaci u datotekama jedinica se zanemaruju, pa uvlaka nije važna.

---

## Korak 4 — Otvorite port na vatrozidu

Na vatrozidu otvorite samo **javni port proxyja**. Interni port administratorske ploče nije potrebno izlagati prema van:

```bash
sudo ufw allow <proxy_port>
```

---

## Korak 5 — Značajka Kick Users

Stranica Users prikazuje svakog trenutačno spojenog slušatelja. Svaki redak prikazuje korisnikovu IP adresu, ugođenu frekvenciju, način rada i trajanje veze. Da biste odspojili jednog korisnika, kliknite gumb **⚡ Kick** u njegovu retku — prekida se samo ta TCP veza. Svi ostali slušatelji ostaju spojeni i ništa ne primjećuju.

Prekid je trenutačan i precizan: poslužitelj se ne pokreće ponovno, nikome drugom se zvuk ne prekida, a odspojeni korisnik može se odmah ponovno spojiti (značajka služi uklanjanju problematičnih ili zaglavljenih veza, a ne zabrani pristupa).

U pozadini prekid koristi `ss -K dst <IP> dport <port>` za rušenje te konkretne TCP utičnice. To zahtijeva Linux mogućnost koju skripta za postavljanje dodjeljuje automatski. Ako ste preskočili postavljanje ili gumb javlja pogrešku, primijenite je ručno:

```bash
sudo setcap cap_net_admin+ep $(which ss)
# Verify:
getcap $(which ss)    # should show: cap_net_admin=ep
```

---

## Konfiguracija — admin_config.json

Sva konfiguracija izvođenja nalazi se u `admin_config.json` u vašem PhantomSDR-Plus direktoriju. `setup_admin.sh` zapisuje početnu datoteku; kasnije promjene mogu se raditi putem stranice Settings ili izravnim uređivanjem datoteke.

Ključna polja koja zapisuje `setup_admin.sh`:

| Ključ | Opis |
|---|---|
| `port` | Interni port administratorske ploče (ondje se veže `admin_server.py`) |
| `public_port` | Port spectrumservera (koristi ga stranica Users za upit na `/users`) |
| `proxy_port` | Javni port na kojem sluša proxy |
| `sdr_host` | Računalo preko kojeg proxy doseže spectrumserver — `127.0.0.1` (vidi dolje) |
| `password_hash` | SHA-256 sažetak administratorske lozinke |
| `sdr_base_dir` | Putanja do vaše PhantomSDR-Plus instalacije |
| `sdr_process_name` | Naziv procesa za nadzor (zadano: `spectrumserver`) |
| `start_script` / `stop_script` | Skripte kojima ploča pokreće i zaustavlja SDR poslužitelj — preko njih djeluje i toplinska zaštita |

Ključevi toplinske zaštite (svi neobavezni — ploča ih zapisuje kad spremite postavke Thermal Guarda, a oni koji nedostaju koriste ove zadane vrijednosti):

| Ključ | Zadano | Opis |
|---|---|---|
| `thermal_enabled` | `true` | Glavni prekidač zaštite |
| `thermal_mode` | `"log"` | `log` (samo zapisuje, nikad ne djeluje) · `throttle` · `stop` · `stop+restart` |
| `thermal_warn` | `null` | Temperatura upozorenja °C; `null` = izvesti iz kritičnog praga vašeg procesora |
| `thermal_throttle` | `null` | Temperatura na kojoj se snižava gornja granica takta; `null` = automatski |
| `thermal_stop` | `null` | Temperatura na kojoj se poslužitelj zaustavlja; `null` = automatski |
| `thermal_resume` | `null` | Temperatura ispod koje procesor mora pasti za oporavak; `null` = automatski |
| `thermal_sustain_s` | `60` | Sekunde koliko se temperatura zaustavljanja mora zadržati prije djelovanja |
| `thermal_warn_sustain_s` | `30` | Sekunde koliko se moraju zadržati temperature upozorenja/throttlea |
| `thermal_resume_s` | `300` | Sekunde ispod temperature oporavka prije otpuštanja zaključavanja |
| `thermal_max_stops_hour` | `2` | Toplinskih zaustavljanja na sat prije isključivanja automatskog ponovnog pokretanja |
| `thermal_test_temp` | `null` | Lažna temperatura za testiranje; `null` = koristi stvarni senzor |

Promjene stupaju na snagu pri sljedećem uzorku — u nekoliko sekundi, bez ponovnog pokretanja.

Za promjenu portova nakon početnog postavljanja uredite `admin_config.json` i ponovno pokrenite:

```bash
sudo systemctl restart phantomsdr-admin phantomsdr-proxy   # B
./manage_admin.sh stop && ./manage_admin.sh start        # A
```

---

## Postavka `sdr_host`

`proxy.py` se na `spectrumserver` spaja preko povratne (loopback) adrese — `sdr_host` je `127.0.0.1` u `admin_config.json`, gdje ga upisuje `setup_admin.sh`. Ne biste to trebali morati mijenjati.

Postavite stvarnu adresu samo ako `spectrumserver` radi na **drugom računalu** od proxyja. Zatim [Ponovno pokretanje ploče](#ponovno-pokretanje-ploče).

> **Promjena:** starije verzije zahtijevale su da `sdr_host` bude LAN IP računala, jer je `spectrumserver` zatvarao WebSocket veze koje dolaze s povratne adrese. Taj je filtar uklonjen, pa lokalne veze rade normalno. Dvije posljedice: otvaranje `http://localhost:<port>` na samom poslužiteljskom računalu sada prikazuje cijelo sučelje (prije bi se stranica učitala, ali ostala prazna), a proxy se više ne kvari kad DHCP dodijeli računalu novu IP adresu. Ako nadograđujete, a vaš `admin_config.json` još sadrži LAN IP, promijenite ga u `127.0.0.1` ili ponovno pokrenite `setup_admin.sh`.

---

## proxy.py — što je i kada vam treba

`proxy.py` smješta i SDR poslužitelj i administratorsku ploču na **jedan javni port**, usmjeravajući prema prefiksu putanje:

| Putanja | Usmjerava se na |
|---|---|
| `/admin*` | Administratorsku ploču (`localhost:<port>`) |
| Sve ostalo | Spectrumserver (`<sdr_host>:<public_port>`) |

Bez proxyja morate izložiti dva porta zasebno. S proxyjem izlažete samo jedan.

Proxy također uklanja ograničenje veličine WebSocket poruke od 4 MB (važno za velike FFT okvire s RX-888 pri 60 MSPS), prosljeđuje stvarne IP adrese klijenata putem `X-Forwarded-*` zaglavlja i održava dugotrajne veze kroz NAT pomoću otkucaja svakih 30 sekundi.

---

## Promjena portova nakon postavljanja

Uredite `admin_config.json` izravno:

```json
{
  "port":        3000,
  "public_port": 9001,
  "proxy_port":  9002,
  "sdr_host":    "127.0.0.1"
}
```

Zatim ponovno pokrenite obje usluge:

```bash
sudo systemctl restart phantomsdr-admin phantomsdr-proxy   # B
./manage_admin.sh stop && ./manage_admin.sh start        # A
```

Ako uz to trebate da se `admin_server.py` pri pokretanju veže na drugi port (npr. u systemd usluzi), to možete nadjačati varijablom okruženja:

```bash
ADMIN_PORT=3000 python3 admin_server.py
```

Prema zadanom, `admin_server.py` veže se samo na `127.0.0.1`. Za samostalno pokretanje bez proxyja (razvoj/testiranje) vežite ga na sva sučelja:

```bash
ADMIN_BIND=0.0.0.0 python3 admin_server.py
```

---

## Korisne ručne naredbe

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

## Datoteke zapisnika

| Datoteka | Sadržaj |
|---|---|
| `admin.log` | Ispis administratorske ploče |
| `proxy.log` | Natpis pri pokretanju proxyja + jedan redak pristupa po proslijeđenom zahtjevu |
| `logwebsdr.txt` | Zapisnik pokretača i nadzornika — pokretanje/zaustavljanje, upravljački program prijamnika, registracija na websdr.org |
| `spectrumserver.log` | Izlaz samog procesa prijamnika — postavljanje FFT-a i OpenCL-a, veze pojedinih klijenata, pogreške. Najveća od ovih datoteka; rotira se, pa uz nju može stajati `spectrumserver.log.1` |
| `rade.log` | Zapisnik RADE/FreeDV sidecara |
| `autorun.log` | Zapisnik dekoderskog daemona — spotovi, SNR, drift |
| `crash.log` | Izvještaji o rušenju i toplinski događaji: `[CRASH]` / `[TERMINATE]` backtraceovi, `[EXIT]` bilješke i `[THERMAL]` retci zaštite. **Uobičajeno prazan** — sve što se u njemu nađe vrijedi pročitati |

Sve se to može čitati iz kartica **Log Viewer** na ploči (LOGWEBSDR, SPECTRUMSERVER, ADMIN, RADE, CRASH, AUTORUN, PROXY). Preglednik prikazuje zadnjih 150 redaka odabrane kartice i osvježava se svake 3 sekunde kad je uključeno automatsko osvježavanje; čita samo kraj datoteke, pa njezina veličina nije važna.

### Rotiranje proxy.log i admin.log

`proxy.log` bilježi svaki proslijeđeni zahtjev, a `admin.log` svaki zahtjev koji stigne do same ploče. Nijedan se ne rotira prema zadanom. Ispitivanja nadzorne ploče nekoć su dominirala objema datotekama — `/admin/api/status` okida svakih ~3 sekunde dok je kartica otvorena — ali sada se filtriraju iz oba zapisnika (vidi niže), pa rotacija ograničava spor rast, a ne poplavu.

Repozitorij donosi logrotate konfiguraciju u `logrotate/phantomsdr` (dnevno, ili ranije ako zapisnik prijeđe 10 MB; čuva 7 gzip arhiva u `logproxy/` kako ne bi zatrpavale korijen projekta). **Ovisi o instalaciji — otvorite je i prije instalacije promijenite tri putanje zapisnika, putanju `olddir` i korisnika `su` da odgovaraju vašem računalu**, zatim:

```bash
sudo cp logrotate/phantomsdr /etc/logrotate.d/phantomsdr
sudo logrotate -d /etc/logrotate.d/phantomsdr     # dry run, should list all three logs
```

`logrotate/phantomsdr` u repozitoriju i `/etc/logrotate.d/phantomsdr` dvije su **neovisne kopije** — `cp` ih ne povezuje. Uređivanje datoteke u repozitoriju ne mijenja ništa na pokrenutom sustavu dok ponovno ne izvršite gornji `sudo cp`. Logrotate zapravo čita samo kopiju u `/etc`.

Konfiguracija koristi `copytruncate`, što je nužno: `manage_admin.sh` pokreće oba procesa s `>> <log>` i nijedan ponovno ne otvara svoj standardni izlaz, pa bi ih rotacija temeljena na preimenovanju ostavila da pišu u rotiranu datoteku dok bi novi zapisnik zauvijek ostao prazan.

Arhive završavaju u `logproxy/` (stvara se automatski zahvaljujući `createolddir`) i nose nazive `proxy.log.1.gz` … `proxy.log.7.gz`, najnovija prva. Jednu pročitajte naredbom `zcat logproxy/proxy.log.1.gz | less`, ili pretražite sve odjednom pomoću `zgrep "pattern" logproxy/*.gz`.

Gumb **Clear Logs** na ploči prazni **svaku** datoteku iz gornje tablice, uključujući `autorun.log` i `proxy.log` (`CLEAR_EXCLUDE` u `admin_server.py` je prazan). Imajte na umu što to stoji kod `autorun.log`: njegova povijest dekodiranja jedini je zapis o tome što je i kada primljeno i nije je moguće rekonstruirati — pražnjenje preživi samo ono što je logrotate već premjestio u `logproxy/`, pa se gubi sve dekodirano od zadnje rotacije. Pražnjenje uz dekoder u radu je sigurno: daemon datoteku drži otvorenu s `O_APPEND` i nastavlja pisati u isti inode. Obavijest navodi što je ispražnjeno, a ako se u neku datoteku nije moglo pisati — recimo `proxy.log` koji na instalaciji s odvojenim korisnicima pripada drugom korisniku — navodi tu datoteku i pogrešku umjesto da javi uspjeh te ostavlja prikaz tog zapisnika na zaslonu umjesto da ga isprazni. Datoteke se prazne na mjestu, nikada se ne brišu: i `manage_admin.sh` i systemd jedinice otvaraju ih s `O_APPEND`, pa bi obrisana datoteka nastavila puniti nevidljiv inode sve do ponovnog pokretanja usluge.

Uspješna ispitivanja filtriraju se iz **oba** zapisnika pristupa, `QuietPollFilterom` u `proxy.py` i onim u `admin_server.py`. Nadzorna ploča poziva `/admin/api/status` svake 3 sekunde, a `/admin/api/logs`, `/admin/api/autorun/status`, `/admin/api/users`, `/admin/api/graph-stats` i `/admin/api/chat` svakih 5 sekundi; nefiltrirani bi činili ~95 % obiju datoteka. Izbacuju se samo obični `200` na tim putanjama — svaki drugi status, putanja ili metoda bilježi se kao i prije, pa neuspjelo ispitivanje ostaje vidljivo, a radnje koje mijenjaju stanje (`kick`, `autorun/start`, …) idu zasebnim putanjama i uvijek se zapisuju. Jedina namjerna iznimka je `/admin/api/logs/clear`, filtrirana u obje datoteke: njezin vlastiti redak pristupa piše se *nakon* pražnjenja, pa je bez filtra svako uspješno pražnjenje ostavljalo jedan svjež redak u zapisniku koji je upravo ispraznilo, a gumb je izgledao neispravno.

Budući da je `proxy.log` zapisnik pristupa, sadrži IP adrese posjetitelja i nizove user-agenta — imajte to na umu prije nego što ga podijelite tražeći pomoć.

### „Clear Logs“ javlja Permission denied

Na stroju gdje su systemd jedinice instalirane na čistom stablu, gumb može vratiti:

```
✗ Could not clear admin.log ([Errno 13] Permission denied: /home/you/PhantomSDR-Plus/admin.log),
  proxy.log ([Errno 13] Permission denied: /home/you/PhantomSDR-Plus/proxy.log)
```

Uvijek su to te dvije datoteke i nikada ostalih pet, jer ih jedine stvara sam systemd. `StandardOutput=append:` otvara PID 1 **prije** nego se spusti na `User=`, pa se zapisnik koji još ne postoji stvara kao `root:root 0644`. Ploča radi kao vaš korisnik i ne može ga isprazniti. Ostalih pet zapisnika stvaraju skripte za pokretanje, koje ionako rade kao vaš korisnik, pa se brišu normalno. Ondje gdje su te dvije datoteke starije od jedinica — stvorio ih je `manage_admin.sh` s `>>` — vlasnik je već ispravan i gumb radi; zato se problem pojavljuje samo na svježoj instalaciji koja je odmah krenula sa systemd jedinicama.

Provjerite s `ls -l admin.log proxy.log`: one koje ne uspijevaju pokazuju `root root`. Popravite ih:

```bash
sudo chown "$(id -un):$(id -gn)" admin.log proxy.log
sudo chmod 664 admin.log proxy.log
```

Ponovno pokretanje nije potrebno — systemd i dalje piše kroz već otvoreni opisnik datoteke, a dopisivanje ne mijenja vlasništvo. Pritisnite **Clear Logs** ponovno i obje se prazne.

**Nemojte umjesto toga obrisati datoteke.** Obje su otvorene s `O_APPEND`; brisanjem jedne systemd nastavlja puniti nevidljivi inode sve do ponovnog pokretanja usluge, a datoteka koja se ponovno pojavi opet pripada rootu.

Da se ne bi vraćalo, instalirajte tmpfiles pravilo koje repozitorij isporučuje u `tmpfiles/phantomsdr-logs.conf`. Ono pri svakom dizanju sustava, prije pokretanja jedinica, ponovno stvara oba zapisnika s ispravnim vlasnikom, pa se uklonjeni zapisnik — ručno čišćenje, ponovna instalacija, premješten instalacijski direktorij — nikada ne vrati u vlasništvu roota. **Pravilo ovisi o stroju: otvorite ga i najprije promijenite dvije putanje i user:group da odgovaraju vašem sustavu**, a zatim:

```bash
sudo cp tmpfiles/phantomsdr-logs.conf /etc/tmpfiles.d/99-phantomsdr-logs.conf
sudo systemd-tmpfiles --create /etc/tmpfiles.d/99-phantomsdr-logs.conf
```

Kao i kod `logrotate/phantomsdr`, datoteka u repozitoriju i kopija u `/etc` neovisne su — uređivanje one u repozitoriju ne mijenja ništa dok ponovno ne pokrenete `cp`. Na systemd 254 i novijem pravilo popravlja i vlasništvo i prava već postojećeg zapisnika, pa rješava i trenutni kvar i buduće; na starijim verzijama gumb odblokira upravo `chown` iznad.

`setup_admin.sh` sve ovo obavlja umjesto vas pri instalaciji jedinica, pa postava napravljena skriptom nikada ne naiđe na ovo. Gornji koraci su za ručno instalirani par ili za instalaciju stariju od koraka sa vlasništvom zapisnika u skripti.

Logrotate ne vraća problem: isporučena konfiguracija koristi `copytruncate`, koji zadržava isti inode, a time i istog vlasnika.

---

## Sažetak pristupa

| Postava | SDR | Administratorska ploča |
|---|---|---|
| Bez proxyja | `http://YOUR_IP:<public_port>` | `http://YOUR_IP:<port>/admin` |
| S proxyjem | `http://YOUR_IP:<proxy_port>` | `http://YOUR_IP:<proxy_port>/admin` |

---

## Brisanje poruka razgovora

Stranica Chat History navodi svaku poruku u trenutačnom zapisniku razgovora. Svaki unos ima gumb **🗑 Delete** koji odmah uklanja tu jednu poruku iz zapisnika — bez ponovnog pokretanja poslužitelja.

Kako to radi:

- Administratorska ploča prepisuje datoteku zapisnika razgovora na mjestu, uklanjajući samo redak odabrane poruke.
- Promjena vrijedi za svakog korisnika koji ponovno učita razgovor; već učitana povijest u otvorenim karticama preglednika ne ažurira se retroaktivno.
- Brisanje cijelog zapisnika (gumb **Clear All**) prazni datoteku, što također djeluje bez ponovnog pokretanja.

Gumb za brisanje dosljedno se prikazuje u svih pet Svelte inačica aplikacije. Ako se čini da brisanje nema učinka, provjerite ima li administratorska ploča pravo pisanja u datoteku zapisnika razgovora:

```bash
ls -l ~/PhantomSDR-Plus/chat.jsonl   # path depends on your config
```

---

## Emitirane poruke na slapu

Ploča **Waterfall Message** omogućuje slanje trajnog tekstualnog natpisa na prikaz slapa svakog spojenog korisnika bez diranja procesa poslužitelja.

### Slanje poruke

1. Otvorite administratorsku ploču i idite na **Waterfall Message**.
2. Upišite tekst poruke i odaberite boju (heksadecimalno, npr. `#ffdd00`).
3. Kliknite **Send** — poruka se odmah pojavljuje u svim aktivnim prikazima slapa.

### Uklanjanje poruke

Kliknite **Clear** da uklonite natpis sa svih slapova. Stanje poruke administratorska ploča drži u memoriji; briše se automatski ako se proces ploče ponovno pokrene.

### Kako to radi

Administratorska ploča izlaže dvije interne krajnje točke koje proxy prosljeđuje:

| Krajnja točka | Metoda | Svrha |
|---|---|---|
| `/admin/api/waterfall-message` | `POST` | Postavljanje ili brisanje trenutačnog teksta i boje natpisa |
| `/admin/api/waterfall-message` | `GET` | Vraćanje trenutačnog stanja poruke kao JSON |

Sučelje ispituje stanje poruke i iscrtava je kao preklop na platnu slapa. Na strani klijenta nije potrebno ni ponovno spajanje WebSocketa ni ponovno učitavanje stranice.

### Uobičajene primjene

- Najava planiranog održavanja: `"Server restart in 10 minutes"`
- Naznaka uvjeta na pojasu: `"Solar flux 180 — 10m wide open"`
- Poruka dobrodošlice: `"Welcome to SV1BTL WebSDR — Athens, KM17"`

---

## Grafikoni sustava

Stranica **Grafikoni** crta četiri veličine na zajedničkoj vremenskoj osi:

- **Frekvencija procesora** — prosječni takt svih jezgri, u GHz
- **Opterećenje procesora** — ukupna iskorištenost, u postotcima
- **Temperatura procesora** — u °C, s crtkanim oznakama na 70 °C (toplo) i 80 °C (kritično)
- **Korisnici na vezi** — slušatelji spojeni na WebSDR u tom trenutku

Raspon birate s **15 MIN / 1 HOUR / 4 HOURS / 12 HOURS / 24 HOURS**. Prelaskom miša preko grafikona pojavljuje se nitni križ s sve četiri vrijednosti tog trenutka. Četiri kartice iznad grafikona uvijek prikazuju najnoviji uzorak.

### Kako se uzorkuje

Pozadinska dretva u `admin_server.py` uzima jedan uzorak svake **2 sekunde**. Uzorci se čuvaju u dvije razine: zadnji **1 sat** u punoj razlučivosti od 2 sekunde (1800 točaka) i **24 sata** tridesetsekundnih prosjeka (2880 točaka) za duge raspone. Stranica bira razinu koja pokriva odabrani raspon i u zaglavlju piše `30s averages` kada gledate prosječenu razinu.

Cijeli dan u razlučivosti od 2 sekunde bio bi ~43000 točaka — deseci MB memorije, prvi prijenos od nekoliko megabajta i oko 40 točaka po pikselu, što nijedan zaslon ne može prikazati. Prosjek na 30 sekundi drži dan u 2880 točaka.

Uzorkovanje kreće zajedno s administracijskom pločom, a ne pri prvom otvaranju stranice, pa se stranica otvara na povijesti koja već postoji.

Međuspremnik je **samo u memoriji**: ništa se ne zapisuje na disk, a povijest se gubi pri ponovnom pokretanju ploče. To je namjerno — funkciju drži izvan rotacije zapisnika i s diska.

2 sekunde daju gotovo živu sliku i dovoljno su kratke da ne izobliče frekvenciju procesora, koja na suvremenom procesoru od uzorka do uzorka skače između takta mirovanja i turba. Jedan uzorak košta otprilike jednu milisekundu, pa je uzorkivač zanemariv uz SDR poslužitelj. Stranica pita u ritmu svoje razine — svake 2 sekunde na živim rasponima, svakih 30 sekundi na prosječenima, jer češće pitanje vraća samo prazne odgovore.

Za promjenu ritma ili trajanja pohrane uredite ove konstante na početku bloka uzorkivača u `admin_server.py` i ponovno pokrenite:

```python
GRAPH_INTERVAL_S   = 2          # sekundi između finih uzoraka
GRAPH_FINE_S       = 3600       # dokle seže fina razina (1 h)
GRAPH_COARSE_EVERY = 15         # finih uzoraka po skupnoj točki (15 x 2 s = 30 s)
GRAPH_COARSE_S     = 24 * 3600  # dokle seže skupna razina (24 h)
```

### Odakle dolaze brojke

| Veličina | Izvor |
|---|---|
| Frekvencija procesora | `psutil.cpu_freq()`, uz zamjenu `/sys/devices/system/cpu/cpu*/cpufreq/`. To su isti podaci jezgre koje oblikuje `cpufreq-info`, pa **cpufrequtils nije potreban**. |
| Opterećenje procesora | `psutil.cpu_percent()` |
| Temperatura procesora | `psutil.sensors_temperatures()`, uz zamjenu `/sys/class/thermal`, zatim naredba `sensors` |
| Korisnici na vezi | Vlastita krajnja točka `/users` poslužitelja spectrumserver — mjerodavan popis sesija. Brojanje priključaka s `ss` ne vidi stvarne IP adrese klijenata iza proxy.py. |

Ako neka veličina na vašem računalu nije dostupna, taj to okvir kaže umjesto da crta ravnu nulu. Neuspjelo očitanje prekida liniju, da praznina nikada ne izgleda kao izmjerena vrijednost.

### Zašto četiri okvira, a ne jedan grafikon

GHz, postotak, stupnjevi i broj ljudi nemaju zajedničku skalu. Crtanje u jednom grafikonu tražilo bi više y-osi, a sjecišta koja pritom nastaju artefakt su skaliranja, a ne činjenica o poslužitelju. Četiri složena okvira na jednoj vremenskoj osi drže usporedbu poštenom. Svaki okvir počinje od nule, pa visina krivulje ostaje razmjerna vrijednosti.

Boja je pridržana za temperaturu, gdje jantarna i crvena označavaju gornje pragove. Ostali okviri dijele jednu boju jer svaki sadrži jednu jedinu seriju koju njegov naslov već imenuje.

### Krajnja točka

`GET /admin/api/graph-stats?since=<epoch>` (potrebna prijava) vraća uzorke novije od `since`, pa stranica pita postupno umjesto da svaki ciklus ponovno preuzima cijeli međuspremnik.

---

## Thermal Guard

> 📖 **Cjeloviti priručnik: [THERMAL_GUARD.md](THERMAL_GUARD.md)** — četiri načina rada i što sysop mora učiniti u svakome, rad bez ploče, throttle faza bez roota, testiranje i rješavanje problema.

Zaustavlja SDR poslužitelj kada procesor postane opasno vruć i ponovno ga pokreće kad se ohladi. Dio je ploče — nema ničega dodatnog za instalirati — i pojavljuje se kao kartica **THERMAL GUARD** na Nadzornoj ploči, a postavke su pod **Postavke**.

Isporučuje se **neaktivna**: način rada počinje na `log`, pa u početku samo bilježi što bi *učinila*. Ništa ne dira vaš poslužitelj dok ne promijenite način rada.

### Radi s bilo kojim načinom pokretanja/zaustavljanja

Zaštita nikada ne pokušava utvrditi što nadzire vaš poslužitelj. Djeluje preko skripti koje ste postavili kao **Default start script** i **Default stop script** u Postavkama, a dok je procesor pregrijan ponavlja zaustavljanje pri **svakoj provjeri** (svake 2 s). Sve što vrati poslužitelj — watchdog unutar `start-*.sh`, systemd jedinica, cron zadatak, `tmux` sesija — poništeno je u nekoliko sekundi, sve dok se stroj ne ohladi. To je *zaključavanje* (lockout).

Ako skripta za zaustavljanje nije postavljena, šalje `SIGTERM` procesu navedenom u `sdr_process_name`, a nakon 10 sekundi počeka `SIGKILL`.

### Pragovi dolaze iz vašeg vlastitog procesora

Umjesto fiksnog broja koji bi na većini strojeva bio pogrešan, zaštita čita kritični prag koji jezgra objavljuje za vaš procesor i računa unatrag od njega:

| Vaš procesor prijavljuje | upozorenje | throttle | zaustavljanje | oporavak |
|---|---|---|---|---|
| Intel, granica 100 °C | 88 | 92 | **95** | 75 |
| AMD Ryzen, granica 95 °C | 83 | 87 | **90** | 70 |
| Raspberry Pi, granica 85 °C | 73 | 77 | **80** | 60 |

To je važno: fiksnih 95 °C gotovo je normalno na Intelu, ali na Ryzenu — čiji Tctl po dizajnu stoji na 95 °C pod boostom — zaustavilo bi poslužitelj na posve zdravom stroju, a na Piju, koji smanjuje takt već na 80 °C, ne bi se nikada aktiviralo. Svaki se prag može postaviti i ručno u Postavkama; ostavite polje prazno za *automatski*.

Da vidite kako zaštita vidi vaš stroj:

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

### Četiri stupnja

Zaustavljanje poslužitelja posljednje je sredstvo, a ne jedini alat:

1. **warn** — samo se zapisuje, ništa više.
2. **throttle** — snižava gornju granicu takta procesora za 20 %. Zahtijeva cpufreq upravljački program *i* pravo pisanja u `scaling_max_freq`, dakle obično root; gdje toga nema (uobičajeno za ploču bez povlastica i na većini VPS-ova) stupanj se **sam isključuje** i zaštita ide s warn izravno na stop. `./setup-cpufreq-perms.sh` daje to pravo pisanja grupi `cpufreq`, pa stupanj radi bez roota — vidi [THERMAL_GUARD.md](THERMAL_GUARD.md#8-uključivanje-throttle-faze-bez-roota).
3. **stop** — pokreće vašu skriptu za zaustavljanje i drži poslužitelj dolje (vidi zaključavanje).
4. **resume** — nakon što procesor ostane ispod temperature oporavka `thermal_resume_s` (zadano 5 minuta), granica takta se vraća i, u načinu `stop+restart`, ponovno se pokreće vaša skripta za pokretanje.

Svaki stupanj mora se **zadržati** svoje vrijeme — 30 s za warn i throttle, 60 s za stop — pa kratkotrajni skok tijekom prevođenja nikada ne okine zaštitu.

Ponovljena okidanja ograničena su s `thermal_max_stops_hour` (zadano 2). Kad se to dosegne, isključuje se *automatsko ponovno pokretanje* dok zaštita i dalje radi, tako da stroj koji se pregrijava ne titra između rada i zaustavljenosti.

### Koji se senzori koriste

Samo pravi senzori na samom procesoru: `coretemp` (Intel), `k10temp` / `zenpower` (AMD), `cpu_thermal` / `soc_thermal` (ARM, Raspberry Pi). Uzima se najviše očitanje na čipu, a ne prosjek.

`acpitz` i neoznačene toplinske zone **namjerno se zanemaruju** — često prijavljuju temperaturu kućišta ili ploče desetke stupnjeva nižu od stvarnog procesora, pa se zaštita koja bi im vjerovala nikada ne bi aktivirala kad je važno. Ako vaš stroj nema upotrebljiv senzor (često na VPS-u ili unutar kontejnera), kartica to jasno kaže (`no trusted CPU sensor`) i zaštita ostaje neaktivna umjesto da se pretvara da vas štiti.

### Što zapisuje

Sve ide u `crash.log`, odnosno u karticu **CRASH** preglednika zapisa, jedan događaj po retku:

```
[THERMAL] warn: 89.0C (warn=88.0 crit=100.0) sustained 31s
[THERMAL] throttle: 93.0C sustained 30s — cpufreq max lowered 20%
[THERMAL] STOPPED server: 96.0C sustained 62s (stop=95.0 crit=100.0) — Started stop-websdr.sh
[THERMAL] lockout: process reappeared at 94.0C — re-stopped [3 time(s) so far]
[THERMAL] recovered: 74.0C held below 75.0 — lockout cleared
[THERMAL] auto-restart: Started start-rx888mk2.sh
```

Redak zaključavanja ograničen je na jedan u minuti, kako nadzornik koji se stalno opire ne bi preplavio zapis.

### Testirajte prije nego joj povjerite

Postavite **TEST TEMPERATURE** u Postavkama na vrijednost iznad svojeg praga zaustavljanja. Zaštita to tretira kao stvarno očitanje, pa se cijeli put — warn, throttle, stop, zaključavanje, oporavak, ponovno pokretanje — odvija na zahtjev. Ispraznite polje za povratak na stvarni senzor.

> Napravite li taj test s načinom rada `stop`, poslužitelj se doista zaustavlja i vaši se slušatelji odspajaju. Učinite to kad nikoga nema ili ostavite način na `log`, gdje test pokazuje što bi se *dogodilo*, bez diranja ičega.

### Preporučeni način uvođenja

1. Ostavite način na **`log`** tjedan dana i nastavite normalno.
2. Pročitajte karticu CRASH nakon teških trenutaka — potpunog prevođenja, vrućeg poslijepodneva. Ako se ništa ne pojavi, vaš stroj nikada nije ni prišao.
3. Ako zabilježene temperature izgledaju točno, postavite način na **`stop`** (ili **`stop+restart`** da se sam vrati).
4. Potvrdite to jednom poljem testne temperature pa ga pustite na miru.

### Izlazak iz zaključavanja

**CLEAR LOCKOUT** na kartici Nadzorne ploče briše zaključavanje i ograničenje učestalosti. Ne razoružava zaštitu: ako je procesor još prevruć, sljedeća provjera jednostavno će ponovno zaustaviti poslužitelj. Koristite ga nakon što ste popravili hlađenje.

### Endpoint

`GET /admin/api/thermal` (potrebna prijava) vraća cijelo stanje zaštite — senzor, pragove, stupanj, zaključavanje, posljednji događaj. `POST` s `{"action":"reset"}` čini isto što i gumb CLEAR LOCKOUT.

### Bez administratorske ploče

`thermal_guard.py` koristi samo standardnu biblioteku i radi samostalno, čitajući isti `admin_config.json`:

```bash
python3 thermal_guard.py --once              # ispis senzora, kritičnog praga i pragova
python3 thermal_guard.py                     # pokretanje kao usluga (samo zapisuje dok se ne naoruža)
python3 thermal_guard.py --mode stop+restart # naoružavanje bez ijedne konfiguracijske datoteke
python3 thermal_guard.py --config /path/to/other.json
python3 thermal_guard.py --help
```

`--mode` nadjačava `thermal_mode` iz konfiguracijske datoteke, pa se stroj bez ploče može naoružati izravno iz svoje systemd jedinice, bez ikakvog JSON-a.

---

## Spot Reporting (autorun FT8/FT4/JS8/WSPR)

Kartica **Spot Reporting** upravlja autorun daemonom (`autorun/index.js`) — Node.js procesom koji dekodira FT8/FT4/JS8/WSPR na poslužiteljskoj strani izravno s prijamnika i šalje spotove u mreže za prijavu:

- **FT8 / FT4 / JS8 → PSK Reporter** (IPFIX/UDP)
- **WSPR → wsprnet.org** (HTTP)

> **JS8 se spotta samo pri brzini Normal** — pozivnom ciklusu od 15 s, na kojem su heartbeatovi i CQ pozivi. Spotovi dolaze iz heartbeatova, compound okvira i usmjerenih poruka; grupna odredišta poput `@ALLCALL` i pozivni znakovi koje dekoder nije uspio razriješiti (`<....>`) nikada se ne prijavljuju. JS8 dijeli PSK Reporter red s FT8 i FT4 te se broji zasebno, jednako kao i oni.


**Prijavljivanje je prema zadanom ISKLJUČENO.** Ništa se ne šalje dok ne uključite odredište i pritisnete **Start**. Dekodiranje i slanje neovisni su: daemon može dekodirati i zapisivati s isključenim prijavljivanjem, pa možete provjeriti aktivnost prije nego išta postane javno.

> ⚠️ Spotovi se šalju u javne mreže pod **vašim pozivnim znakom**. Uključite samo pojaseve i načine rada koje vaš prijamnik doista čuje i postavite ispravan lokator.

### Preduvjeti

Autorun daemon treba Node.js 22+, npm pakete `ws` + `cbor-x` (razrješavaju se preko simboličke poveznice `autorun/node_modules` → `frontend/node_modules`) i `util-linux` (`taskset`). Instalacijske skripte sve to postavljaju automatski — vidi [odjeljak Autorun Spot Reporter u INSTALLATION.md](INSTALLATION.md#autorun-spot-reporter-ft8ft4wspr). Ako **Start** ne uspije, uobičajeni je uzrok ta poveznica ili `taskset` (vidi Rješavanje problema niže).

### Korištenje kartice

1. **Identitet** — pozivni znak i lokator. Unaprijed popunjeni iz `frontend/site_information.json` (`siteSysop` / `siteGridSquare`, skraćeno na 6 znakova); ovdje ih po potrebi zamijenite.
2. **Matrica pojas × način rada** — označite kombinacije za dekodiranje. Retci su pojasevi, stupci FT8 / FT4 / JS8 / WSPR; nepodržane ćelije su onemogućene. WSPR dodatno pokriva LF/MF pojaseve (2200 m, 630 m) i dodatni europski kanal na 80 m.
3. **Odredišta** — uključite **PSK Reporter** i/ili **wsprnet** (oboje prema zadanom isključeno).
4. **Max slots** — sigurnosno ograničenje broja mjesta pojas/način rada koja mogu raditi istodobno.
5. **Start / Stop** — pokreće/gasi daemon (vezan uz gornje CPU jezgre pomoću `taskset`, koje se biraju automatski prema računalu — vidi *Zahtjevi za resursima i ograničenja* niže). **Save** / **Reload** spremaju i ponovno čitaju konfiguraciju; **Free All** prazni sva mjesta.

Kartica stanja osvježava se svakih 5 s i prikazuje stanje rada, brojače dekodiranja/slanja i vrijeme posljednjeg slanja. Oznaka **📶 REPORTING** pojavljuje se na glavnom slapu dok je prijavljivanje aktivno.

> **„0 sent" prvih nekoliko minuta je normalno.** PSK Reporter šalje skupno svakih **5 minuta**, a wsprnet svake **2 minute** — spotovi čekaju u redu do sljedećeg slanja. Kartica stanja prikazuje broj u čekanju i ritam slanja.

### Promjena pojaseva ili načina rada dok radi

**Promjene ne vrijede dok se daemon ponovno ne pokrene.** `autorun/index.js` čita `autorun.json` samo jednom, pri pokretanju. Nema nadzora datoteke ni signala za ponovno učitavanje — jedini signali koje obrađuje su SIGINT i SIGTERM, a oba znače gašenje. Daemon koji radi zato i dalje dekodira slotove s kojima je pokrenut, što god poslije spremili.

Za primjenu promjene:

1. Označite / odznačite pojaseve i načine rada
2. **SAVE CONFIG**
3. **STOP**
4. **START**

Ili jednostavno **STOP** → promijenite kućice → **START**, jer START sprema konfiguraciju prije pokretanja.

> ⚠️ **Pritisak na START bez prethodnog STOP-a ne primjenjuje promjenu.** START sprema konfiguraciju, a zatim zahtjev za pokretanje odgovara `already running` i ništa se ne pokreće ponovno. Vidjet ćete poruku „spremljeno" uz pogrešku „already running" dok daemon nastavlja sa **starim** pojasevima — lako se čita kao uspjeh. Uvijek prvo STOP.

Što ponovno pokretanje čini brojačima:

- **Ukupni brojevi uz svaku kućicu ostaju** — nalaze se u `autorun-totals.json`, koji se pri gašenju ne briše.
- **Pločice po dekoderu vraćaju se na nulu**, vrijede po pokretanju.
- **Ništa iz reda se ne gubi**: gašenje prvo pošalje spotove na čekanju.
- **Novouključeni** pojas kreće od `0`; pojas koji ste **već koristili** nastavlja svoj prijašnji zbroj.
- Pojas koji **odznačite zadržava svoj broj** uz sada praznu kućicu; povijest se ne briše.

Dekodiranje staje samo na nekoliko sekundi između STOP-a i START-a.

### Brojači spotova

Prikazana su dva različita brojanja koja odgovaraju na različita pitanja.

**SPOTS UPLOADED PER DECODER** — pločica po dekoderu (FT8 / FT4 / JS8 / WSPR) sa spotovima poslanima **od zadnjeg pokretanja daemona**, a ispod broj dekodiranja i koliko ih još čeka u redu. Stop/Start ih vraća na nulu. Dekoder čije je odredište isključeno prikazuje svoja dekodiranja i `reporting off` umjesto golog `0`, jer je ondje nula slanja postavka, a ne kvar.

**Broj uz svaku kućicu** u BANDS & MODES je broj **ukupno** poslanih spotova za tu kombinaciju pojasa i načina rada. Čuva se u `autorun-totals.json` i preživljava ponovna pokretanja. **Jantarno s točkom ispred** (`·123`) znači da je taj slot dekodirao, ali još ništa nije poslao. To je normalno između slanja — PSK Reporter šalje svakih 5 minuta, a wsprnet svake 2 — pa FT8/FT4 brojači prvih nekoliko minuta nakon pokretanja stoje jantarno. Jantarno ostaje i ako je odredište tog dekodera isključeno. Obična `0` bez točke znači da je slot uključen, ali još ništa nije dekodirao — WSPR stoji na nuli nekoliko minuta nakon pokretanja jer radi u ciklusu od 2 minute, dok FT8 već broji u stotinama. Slot koji daemon nikada nije pokrenuo ne prikazuje ništa. Prelaskom miša vide se slanja, dekodiranja i vrijeme zadnjeg slanja.

FT8 i FT4 dijele jedan red za slanje prema PSK Reporteru, pa daemon svaki spot pripisuje vlastitom načinu rada i pojasu u trenutku slanja; podjela se ne procjenjuje naknadno iz ukupnih brojeva.

**Poništavanje brojača.** **FREE ALL SLOTS** odznačuje sve pojaseve i načine rada, isključuje oba odredišta, zaustavlja daemon i **briše ukupne brojače** — nakon toga uz nijednu kućicu nema broja. To je jedini način da ih poništite i ne može se poništiti. Gumb zaustavlja daemon i čeka da izađe prije brisanja `autorun-totals.json`, jer daemon tu datoteku ponovno zapisuje pri gašenju; brisanje dok daemon radi samo bi vratilo brojeve.

### Zahtjevi za resursima i ograničenja

Daemon je namjerno lagan i radi na hardveru skromnih resursa (četverojezgreni i5 je dovoljan), ali postoje stvarna ograničenja kojih treba biti svjestan.

**Vezanje autoruna uz jezgre svjesno je konfiguracije i automatsko.** **Autorun daemon** uvijek pokreće administratorska ploča (`admin_server.py`), pa se njegovo vezanje postavlja pri svakoj instalaciji bez ikakve konfiguracije: iz broja procesora izvodi raspon jezgri za `taskset`, rezervirajući nekoliko gornjih jezgri za dekodiranje, ili radi bez vezanja na ≤ 4 jezgre.

**Vezanje spectrumservera ovisi o vašem načinu pokretanja.** Način na koji pokrećete spectrumserver razlikuje se među instalacijama (vrsta SDR-a, alati, osobne skripte), pa ovaj dokument ne pretpostavlja nikakav određeni pokretač. Administratorska ploča ne pokreće niti veže spectrumserver — to u potpunosti ovisi o naredbi ili usluzi kojom ga izvodite. Ako želite spectrumserver držati podalje od jezgri koje koristi autorun daemon, vežite ga sami pomoću `taskset` u vlastitoj naredbi za pokretanje (vidi odjeljak o zamjeni niže). Ako to ne učinite, jednostavno radi bez vezanja, a raspoređivač operacijskog sustava ga uravnotežuje — ispravno i sigurno, samo gubite namjerno razdvajanje jezgri.

Za orijentaciju, autorun daemon rezervira ove gornje jezgre (pa ako vežete spectrumserver, zadržite ga na nižima kako biste izbjegli preklapanje):

| Logičkih CPU-a | Koristi autorun daemon | Ostaviti za spectrumserver |
|---|---|---|
| ≤ 4 | *bez vezanja* | *bez vezanja* |
| 6 | `5` | `0-4` |
| 8 | `6-7` | `0-5` |
| 12 (npr. hibrid 8P+4E) | `8-11` | `0-7` |
| 16 | `12-15` | `0-11` |

Na računalu s **4 jezgre (ili manje)** nema se što razdvajati, pa i autorun daemon radi *bez vezanja* i dijeli sve jezgre — ispravno i sigurno, ali FFT SDR-a i naleti dekodiranja natječu se za iste jezgre.

**Poznata ograničenja:**

1. **Pravo usko grlo su spectrumserver i širina pojasa SDR-a, a ne daemon.** RX888 na 30 MHz traži OpenCL/GPU; procesor s malo jezgri bez sposobnog GPU-a ne može održati taj FFT. Uparite skromni hardver s užim SDR-om (RSP1A ≈ 10 MHz, RTL-SDR ≈ 2.4 MHz).
2. **WSPR je najzahtjevniji za CPU.** Njegov Fano dekoder je JS port (~30 s po pojasu, jednodretveni). Skup od 4 workera izvodi 4 dekodiranja paralelno; uključivanje **više od ~4 WSPR pojasa** odjednom može produljiti red preko intervala od 120 s, osobito dok se SDR natječe za jezgre. Dekodiranja FT8/FT4 u usporedbi su jeftina.
3. **Skaliranje broja mjesta.** Podatak od ~2–2,5 jezgre / 600–700 MB odnosi se na punih ~28 mjesta na osmojezgrenom računalu. Na 4 dijeljene jezgre ograničite se na nekoliko pojaseva (smjernica: ≤ 6 FT8/FT4 + ≤ 3 WSPR) i pratite statistiku `queued` skupa.
4. **Vezanje pretpostavlja hibridnu Intel topologiju** (niže jezgre = brže P-jezgre). Na AMD-u ili procesorima s isprepletenim SMT numeriranjem automatska podjela i dalje vrijedi (bez preklapanja, bez rušenja), ali „niže jezgre su brže" možda ne vrijedi doslovno; na čipu 4C/8T s hyperthreadingom gornje su jezgre SMT blizanci — ograničene, ali ne i potpuno izolirane. Ondje gdje automatski raspon nije idealan, upotrijebite **ručnu zamjenu** niže.
5. **Pokrivenost pojaseva ograničava prijamnik.** Konfiguracija RX888 (`sps=60000000` → Nyquist na 30 MHz) ne doseže 6 m i više; tablica pojaseva ide od 160 m do 10 m. Drugi SDR-ovi pokrivaju ono što dopušta njihov ugođeni prozor.
6. **Ritam prijavljivanja.** PSK Reporter šalje svakih 5 min, wsprnet svake 2 min — „0 sent" prvih nekoliko minuta normalno je, a ne kvar.

### Ručna zamjena vezanja uz jezgre (napredno)

Automatski izvedena podjela jezgri prikladna je za većinu računala, no možete nametnuti određeno vezanje ondje gdje nije (AMD CCX/CCD, ARM big.LITTLE, isprepleteni SMT). Dvije su neovisne zamjene, a svaka prihvaća popis jezgri u obliku `taskset -c` (`2-3`, `0,2,4`, `0-2,5`) ili `none`/`off`/`unpinned` za isključivanje vezanja. Neispravna vrijednost se zanemaruje i primjenjuje se automatsko izvođenje — tipfeler nikada ne može spriječiti pokretanje.

**Autorun daemon** — varijabla okruženja `AUTORUN_CORES` ili polje `"cores"` u `autorun.json` (okruženje ima prednost). Polje `"cores"` čuva se pri **Save** u administratorskoj ploči, pa ručna izmjena ostaje. Dva načina da ga postavite:

*Mogućnost A — `autorun.json` (trajno, preporučeno).* Dodajte redak `"cores"` u konfiguraciju u korijenu repozitorija, zatim na kartici Spot Reporting učinite **Stop → Start**:

```jsonc
// autorun.json
{ "identity": { "callsign": "SV1BTL", "grid": "KM17VX" },
  "reporting": { "pskreporter": true, "wsprnet": false },
  "slots": [ /* … */ ],
  "cores": "2-3" }          // or "none" to run unpinned
```

*Mogućnost B — varijabla okruženja (jednokratno).* Daemon pokreće administratorska ploča, pa varijabla mora biti u okruženju **ploče** — postavite je i ponovno pokrenite ploču (okruženje ima prednost pred vrijednošću u `autorun.json`):

```bash
# Način A — varijabla mora biti na procesu koji se pokreće:
./manage_admin.sh stop && AUTORUN_CORES=2-3 ./manage_admin.sh start

# Način B — systemd ignorira varijablu zadanu u naredbenom retku
# systemctl, pa je stavite u jedinicu:
sudo systemctl set-environment AUTORUN_CORES=2-3
sudo systemctl restart phantomsdr-admin
```

**spectrumserver** — vežite ga sami tako da naredbi kojom pokrećete poslužitelj dodate prefiks `taskset -c <jezgre>`. To radi sa svakim načinom pokretanja (izravno pokretanje, SDR cjevovod, jedinica usluge itd.):

```bash
# pin the server to cores 0-3, direct launch:
taskset -c 0-3 ./build/spectrumserver --config <your-config>.toml < <your-input>
# or in an SDR pipeline:
<your-sdr-source> | taskset -c 0-3 ./build/spectrumserver --config <your-config>.toml
```

> ⚠️ **Pobrinite se da preživi ponovna pokretanja.** Ugrađeni `taskset` vrijedi samo za to jedno pokretanje. Ako nešto automatski ponovno pokreće poslužitelj (watchdog, systemd usluga, cron/`@reboot` unos …), dodajte prefiks `taskset` unutar skripte ili jedinice koja ga zapravo pokreće — inače ponovno pokretanje gubi vezanje.

**Provjerite je li vezanje primijenjeno** — ispišite stvarni afinitet CPU-a pokrenutih procesa:

```bash
taskset -cp "$(pgrep -f 'autorun/index.js')"   # autorun daemon
taskset -cp "$(pgrep -x spectrumserver)"       # spectrumserver
```

**Prihvaćene vrijednosti (za obje zamjene):** popis u obliku `taskset -c` (`2-3`, `0,2,4`, `0-2,5`) ili `none`/`off`/`unpinned` za rad bez vezanja. Sve neispravno zanemaruje se i primjenjuje se automatsko izvođenje, pa tipfeler nikada ne može blokirati pokretanje.

> Na Raspberry Piju / bilo kojem računalu s ≤ 4 jezgre obično ne trebate nijednu — automatski put već pokreće oba procesa bez vezanja, što je ispravan izbor na malom, homogenom procesoru. Zamjena je namijenjena većim računalima koja nisu Intel hibridi.

### Datoteke i krajnje točke

| Stavka | Svrha |
|---|---|
| `autorun.json` | Spremljena konfiguracija (identitet, mjesta, odredišta, najveći broj mjesta, neobavezna zamjena `cores`). Zapisuje je kartica; git je zanemaruje. |
| `autorun-status.json` | Trenutačno stanje koje čita kartica stanja (pid, brojači, posljednje slanje). Zapisuje se svakih 15 s; uklanja se pri zaustavljanju. |
| `frontend/dist/autorun-active.json` | Javni podaci oznake, posluženi na `/autorun-active.json`. Prazno kada je prijavljivanje isključeno. |
| `autorun.log` | Standardni izlaz i pogreške daemona. |
| `GET/POST /admin/api/autorun/config` | Čitanje/pisanje `autorun.json` (provjerava pozivni znak, lokator, kombinacije pojas/način rada, ograničenje mjesta). |
| `GET /admin/api/autorun/status` | Stanje rada (`pgrep`) + `autorun-status.json`. |
| `POST /admin/api/autorun/start` / `stop` | Pokretanje (`taskset -c <auto> node autorun/index.js`) / `SIGTERM`. Raspon jezgri izvodi se iz procesora (vidi gore). |

> **Napomena:** nakon nadogradnje `admin_server.py` morate [Ponovno pokretanje ploče](#ponovno-pokretanje-ploče) kako bi se učitale nove autorun rute ili ažurirana matrica pojas/način rada. Daemon radi kao zaseban proces, pa preživljava ponovna pokretanja administratorske ploče.

---

## Rješavanje problema

| Problem | Rješenje |
|---|---|
| Administratorska ploča se ne pokreće | Provjerite `admin.log` — obično nedostaje Python paket |
| Proxy se ne pokreće | Izvršite `python3 -c "import aiohttp"` — ako ne uspije: `pip3 install aiohttp --break-system-packages` |
| `proxy.log` je prazan | Prvo provjerite radi li proxy uopće (`./manage_admin.sh status`). Ako radi, imate staru verziju: pokretač mora koristiti `python3 -u` (bez međuspremnika — inače natpis pri pokretanju nikad ne napusti međuspremnik od 8 KB), a `main()` u `proxy.py` mora pozvati `logging.basicConfig()` (inače aiohttpov zapisivač pristupa nema rukovatelja i svaki se redak zahtjeva odbacuje, jer `web.AppRunner` — za razliku od `web.run_app` — ne konfigurira zapisivanje). |
| Proxy se pokreće, ali je slap prazan | Provjerite `sdr_host` u `admin_config.json` — uobičajeno `127.0.0.1`. Ako još sadrži stari LAN IP iz prethodne verzije, promijenite ga i [Ponovno pokretanje ploče](#ponovno-pokretanje-ploče) |
| Gumb Kick javlja „no connections" | Izvršite `getcap $(which ss)` — ako nema `cap_net_admin`, izvršite `sudo setcap cap_net_admin+ep $(which ss)` |
| Stanje uvijek prikazuje OFFLINE | Idite na Settings → SDR Process Name i unesite točan naziv koji prikazuje `ps -eo comm,args \| grep -v grep` |
| Stranica Users ne prikazuje podatke | Provjerite radi li krajnja točka: `curl http://127.0.0.1:<public_port>/users` |
| Vanjski preglednik javlja NetworkError | Provjerite radi li proxy: `./manage_admin.sh status` |
| Proxy se pokvario nakon promjene mreže | Odnosi se samo na slučaj kad `sdr_host` još sadrži LAN IP — postavite ga na `127.0.0.1` i [Ponovno pokretanje ploče](#ponovno-pokretanje-ploče) |
| Gumb za brisanje razgovora nema učinka | Provjerite pravo pisanja u datoteku zapisnika razgovora: `ls -l ~/PhantomSDR-Plus/chat.jsonl` |
| Poruka na slapu se ne pojavljuje | Potvrdite da proxy radi (`./manage_admin.sh status`) i da je sučelje iz novije verzije koja uključuje iscrtavanje preklopa |
| Poruka na slapu izgubljena nakon ponovnog pokretanja | Očekivano — stanje poruke je samo u memoriji; pošaljite je ponovno nakon ponovnog pokretanja ploče |
| „Start" u Spot Reportingu ne uspijeva / daemon se odmah gasi | Provjerite `autorun.log`. Obično nedostaje simbolička poveznica `autorun/node_modules` (`ln -sfn ../frontend/node_modules autorun/node_modules`) ili nije instaliran `taskset` (`sudo apt install -y util-linux`). |
| Spot Reporting: daemon radi, ali `decodes` ostaje 0, a `autorun.log` pokazuje `504` / `tap closed 1006` | Audio odvod ne može doseći spectrumserver. Daemon automatski otkriva port iz konfiguracije **pokrenutog** poslužitelja; redak zapisnika `[autorun] tap backend: HOST:PORT` mora odgovarati vašem `[server] port`. Ako nije točan (ili poslužitelj nije radio pri pokretanju), zadajte ga u `autorun.json`: `"server": { "host": "127.0.0.1", "port": 9002 }`, zatim Stop→Start. |
| Spot Reporting prikazuje „0 sent" | Normalno prvih nekoliko minuta — PSK Reporter šalje svakih 5 min, wsprnet svake 2 min. Provjerite je li uključeno odredište i radi li daemon. |
| Novi pojasevi/načini rada ne prikazuju se u matrici | [Ponovno pokretanje ploče](#ponovno-pokretanje-ploče) — matrica se učitava pri pokretanju ploče. |
| `autorun.log` prikazuje `MODULE_TYPELESS_PACKAGE_JSON` / „Reparsing as ES module … performance overhead" | Kozmetičko upozorenje (dekodiranje i dalje radi). U `frontend/src/modules/package.json` nedostaje `"type": "module"`; dodajte taj redak pri vrhu, zatim Stop→Start. Ponovna izgradnja sučelja nije potrebna — daemon izravno uvozi izvornu datoteku. |
| „Start" u Spot Reportingu ne uspijeva uz `taskset: … Invalid argument` na starom/malom računalu | Ne bi se trebalo događati s pokretačem svjesnim konfiguracije — raspon jezgri izvodi se iz broja procesora i na ≤ 4 jezgre radi bez vezanja. Ako se dogodi, vaš `admin_server.py` stariji je od te promjene; ažurirajte ga (`_autorun_taskset_prefix`) i [Ponovno pokretanje ploče](#ponovno-pokretanje-ploče). |
| Oznaka REPORTING ne pojavljuje se na slapu | Prijavljivanje mora biti uključeno s barem jednim mjestom; oznaka čita `/autorun-active.json`. Ponovno izgradite sučelje ako je `dist/index.html` stariji od oznake. |
