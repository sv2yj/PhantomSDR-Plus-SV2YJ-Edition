# PhantomSDR-Plus — Upravljanje primopredajnikom (CAT)

Držite **vlastiti primopredajnik** i **PhantomSDR-Plus prijemnik** na istoj frekvenciji, načinu rada i filtru. Okrenite gumb za ugađanje na uređaju i slap ga slijedi; kliknite signal na slapu i uređaj se ugodi na njega. Kad odašiljete, prijemnik može utihnuti kako vam ne bi vraćao vlastiti signal.

Radi s prijemnicima **PhantomSDR-Plus, KiwiSDR, PA3FWM WebSDR i UberSDR**, vašima ili tuđima, i uvijek pomiče samo *vašu* sesiju slušanja — nitko drugi na prijemniku ništa ne čuje ni ne vidi. Operater prijemnika ne mora ništa instalirati ni podešavati.

---

## Što vam treba

Dva načina povezivanja uređaja i jedan uvjet na strani prijemnika:

| Dio | Što je | Sinkronizira |
|---|---|---|
| **[Desktop PhantomSDR+](https://www.dropbox.com/scl/fo/kjwj96zg3kj7dgq4fjef9/APnA3c9hhv4hk3YMGIGjH7s?rlkey=jfiwklly63kv73poalx631pk3&st=m37uvaym&dl=0) 4.0 ili noviji** | Desktop aplikacija s izbornikom **Rig**. Linux (PC i Raspberry Pi) i Windows. | Frekvenciju, način rada, širinu filtra, utišavanje pri odašiljanju — u jednom ili oba smjera |
| **[CATsync Tool for WebSDRs](https://catsyncsdr.wordpress.com/)** | Zaseban Windows program koji povezuje uređaj sa stranicom prijemnika u vašem pregledniku. | Frekvenciju i način rada |
| **TCI-CAT na stranici prijemnika** | Gumb na samoj PhantomSDR-Plus stranici, u bilo kojem pregledniku. Govori TCI s ExpertSDR-om, AetherSDR-om ili Thetisom, ili s bilo kojim uređajem koji podržava Hamlib preko malog mosta. Samo na PhantomSDR-Plus prijemnicima s inačicom 4.1.0 ili novijom. | Frekvenciju, način rada i širinu filtra u oba smjera; utišavanje pri odašiljanju |
| **Prijemnik** | PhantomSDR-Plus, KiwiSDR, PA3FWM WebSDR ili UberSDR. PhantomSDR-Plus prijemnik treba **4.1.0** ili noviju za širinu filtra i utišavanje. | Stariji PhantomSDR-Plus i dalje sinkronizira frekvenciju i način rada |

Veći dio ovog priručnika opisuje Desktop PhantomSDR+. Gumb TCI-CAT ima vlastiti odjeljak, [TCI-CAT na stranici prijemnika](#tci-cat-na-stranici-prijemnika). CATsync Tool ima vlastitu dokumentaciju na svojoj web stranici.

---

## Podržani prijemnici

Aplikacija prepoznaje vrstu prijemnika u prozoru stanice i upravlja njime preko vlastitih kontrola te stranice. Prozor Rig control prikazuje pronađenu vrstu pokraj naziva stanice.

| Prijemnik | Frekvencija i način rada | Širina filtra | Utišavanje pri odašiljanju |
|---|---|---|---|
| PhantomSDR-Plus | Da | S 4.1.0 ili novijom | S 4.1.0 ili novijom |
| KiwiSDR (uključujući Web-888) | Da | Da | Da |
| PA3FWM WebSDR | Da, uz promjenu opsega na stranicama s više opsega | Da | Da |
| UberSDR | Da | Da | Da |

Web prijemnik ima manje načina rada od većine uređaja, pa neki načini uređaja dijele jedan način prijemnika: KiwiSDR i WebSDR imaju jedan CW za CW i CW-R. Načini prijemnika navedeni u ovom priručniku su PhantomSDR-Plusovi; ostali prijemnici koriste najbliži ekvivalent. WebSDR drži CW filtar ispod 1 kHz, a ostale filtre na 1 kHz ili šire, jer tako sama stranica prepoznaje CW, a frekvencija izvan svih opsega WebSDR stranice ostavlja se na miru. UberSDR podešava filtar u koracima klizača, pa širina može odstupati do oko 50 Hz od širine na uređaju. Svaka druga vrsta stranice — primjerice OpenWebRX — prikazuje *not a receiver this app can drive* i ništa se ne sinkronizira.

---

## Što radi, a što ne

- Sinkronizira **jedan uređaj s jednim prozorom prijemnika** istodobno.
- Čita obje strane nekoliko puta u sekundi i, kad se razlikuju, jednu podesi prema drugoj. **Ne** odašilje, ne uključuje PTT i nikamo ne šalje zvuk.
- Pomicanje prijemnika mijenja samo vašu sesiju. Ostali slušatelji istog prijemnika to ne osjete, a operater to ne mora dopustiti.
- Serijski port može otvoriti samo **jedan program istodobno**. Ako WSJT-X, dnevnik veza ili alat proizvođača već drži port, upotrijebite izbor **flrig** ili **rigctld on network** kako biste dijelili uređaj umjesto da se programi otimaju za port.

---

## Brzi početak

1. Otvorite stanicu u Desktop PhantomSDR+ kao i obično.
2. **Rig → Rig control...**
3. Pod **Connection** odaberite **Built-in** ako je vaš uređaj na popisu, inače **Hamlib (all rigs)**.
4. Odaberite uređaj, serijski port i brzinu na koju je podešen CAT ili CI-V izbornik uređaja.
5. Pod **Sync** ostavite odabrano **Both directions**.
6. Pritisnite **Connect**. Dva prikaza na vrhu — primopredajnik i prijemnik — trebali bi unutar sekunde pokazati istu frekvenciju.

Svaka se postavka sprema čim je promijenite. Sljedeći put dovoljno je **Rig → Connect**, ili označite **Connect when the app starts**.

---

## Odabir načina povezivanja

| Izbor | Koristite kada | Treba |
|---|---|---|
| **Built-in** | Vaš je uređaj na popisu ispod. | Ništa drugo |
| **Hamlib (all rigs)** | Vaš je uređaj bilo što drugo — Hamlib poznaje više od 300. Aplikacija sama pokreće Hamlibov `rigctld` na privatnom lokalnom portu i zaustavlja ga pri odspajanju. | Windows: ništa, Hamlib je uključen. Linux: `sudo apt install libhamlib-utils` |
| **rigctld on network** | Već radi `rigctld`, na ovom ili drugom računalu u vašoj mreži. | Host i port (zadano 4532) |
| **flrig** | flrig već upravlja uređajem za fldigi, WSJT-X ili dnevnik veza. | Pokrenut flrig s njegovim XML-RPC portom (zadano 12345) |

### Uređaji s ugrađenim upravljačem

Prikazane brzine i CI-V adrese tvorničke su vrijednosti koje aplikacija upisuje. **To je samo polazište — postavite ih prema izborniku svog uređaja.**

| Obitelj | Uređaji | Zadana brzina | Napomene |
|---|---|---|---|
| **Icom CI-V** | IC-7300, IC-7610, IC-705, IC-9700, IC-905, IC-7760, IC-7851, IC-7100, IC-7410, IC-9100, IC-7600, IC-7200, IC-7700, IC-7000, IC-7800, IC-756PROIII, IC-756PROII, IC-R8600 i svaki drugi CI-V uređaj | 19200 | CI-V adresa upisana po modelu (IC-7300 `94`, IC-705 `A4`, IC-9700 `A2`, IC-7610 `98` …) |
| | IC-746PRO, IC-718, IC-R75 | 9600 | |
| **Xiegu** (CI-V) | G90, X6100 | 19200 | Adresa `70`; provjerite izbornik |
| **Yaesu novi CAT** | FTDX101D/MP, FTDX10, FT-710, FT-991/A, FT-891, FTDX5000, FTDX3000, FTDX1200, FT-950, FT-2000, FT-450/450D | 38400 | |
| **Yaesu klasični CAT** | FT-817/818, FT-857/857D, FT-897/897D | 38400 | 2 stop bita; ugađa u koracima od 10 Hz |
| **Kenwood** | TS-990S, TS-890S, TS-590S/SG | 115200 | |
| | TS-480, TS-2000, TS-870S | 57600 | |
| **Elecraft** | K4, K3/K3S, KX3, KX2 | 38400 | Sinkronizira se i širina filtra |
| **Kompatibilni s Kenwoodom** | FlexRadio SmartSDR CAT (virtualni port), QRP Labs QMX/QMX+/QDX, (tr)uSDX, Lab599 Discovery TX-500, ostali Kenwood-kompatibilni uređaji | 9600–38400 | |

Uređaj koji bi trebao biti kompatibilan, a ne razgovara s ugrađenim upravljačem, obično radi s **Hamlibom**, koji podnosi mnogo više inačica.

---

## Postavke serijskog porta

| Postavka | Što upisati |
|---|---|
| **Serial port** | Port uređaja. USB adapteri i uređaji s USB portom navedeni su prvi. **Other / network address...** prima port kojeg nema na popisu — `COM7`, `/dev/ttyUSB1` — ili `tcp://host:port` za serijski port koji preko mreže poslužuje ser2net ili slično. |
| **Speed (baud)** | Točno ono što piše u CAT / CI-V izborniku brzine uređaja. Pogrešna brzina izgleda kao uređaj koji nikad ne odgovara. |
| **Stop bits** | 1 za gotovo sve; 2 za obitelj FT-817/857/897. |
| **CI-V address** | Samo Icom, heksadecimalno (`94`, ne `148`). Mora odgovarati izborniku CI-V adrese. |
| **DTR / RTS** | Ostavite **isključeno** osim ako ih vaše sučelje treba. Mnogi CAT kabeli na jednoj od tih linija uključuju odašiljač ili resetiraju uređaj. |
| **Hardware flow control** | Isključeno, osim ako priručnik traži RTS/CTS. |

Za **Hamlib** iste se postavke prosljeđuju `rigctld`-u. Stop bitovi tamo imaju i izbor *Rig default*, a **Extra rigctld options** prima sve ostalo što `rigctld` razumije, npr. `--set-conf=post_write_delay=10`. **rigctld program** pokazuje na određeni `rigctld` ako ih je instalirano više.

---

## Sinkronizacija

### Smjer

| Izbor | Što se događa |
|---|---|
| **Rig → receiver** | Prozor prijemnika slijedi uređaj. Promjena na slapu vraća se na frekvenciju uređaja. |
| **Receiver → rig** | Uređaj slijedi prozor prijemnika. Okretanje gumba na uređaju poništava se. |
| **Both directions** | Pobjeđuje strana koju ste **zadnju** dotaknuli. U trenutku spajanja, prije nego što je ijedna dotaknuta, pobjeđuje uređaj. |

Smjer se može promijeniti i iz izbornika **Rig** tijekom veze.

### Kako se sprječava da se strane „svađaju”

Svaka vrijednost koju aplikacija upiše pojavi se trenutak kasnije kao promjena na drugoj strani. Kad bi se to shvatilo doslovno, uređaj i prijemnik beskonačno bi se ganjali. Aplikacija to izbjegava na tri načina:

- Stranica prijemnika primjenjuje promjenu odmah, pa se čita odmah nakon upisa i to očitanje postaje novo polazište.
- Uređaj primjenjuje promjenu nešto kasnije, pa se svaka poslana vrijednost pamti. Kad uređaj javi tu vrijednost, prepoznaje se kao upis aplikacije, a ne kao ruka na gumbu.
- Vrijednost koju uređaj odbije — npr. široki FM na KV uređaju — šalje se **dvaput**, a zatim se ostavlja na miru dok se izvorna strana ne promijeni, umjesto da se ponavlja nekoliko puta u sekundi.

Ponovno ugađanje stranice prijemnika može je navesti da odabere zadani način rada za opseg (npr. LSB ispod 10 MHz). Kad vodi uređaj, aplikacija odmah vraća njegov način rada, pa uređaj u USB-u na 40 m drži i prijemnik u USB-u.

### Koji prozor prijemnika

**Receiver window** bira koja stanica slijedi uređaj:

- **The station window last in front** (zadano) — s dvije otvorene stanice kliknite u jednu i uređaj slijedi nju.
- **Određena stanica** — uređaj ostaje vezan uz nju, bila ona u prvom planu ili ne. Ako ta stanica nije otvorena, ništa se ne sinkronizira dok se ne otvori.

### Brzina osvježavanja

**Update every** određuje koliko se često čitaju obje strane: 150 ms, 300 ms (zadano), 500 ms ili 1 s. Brže se na gumbu osjeća neposrednije; sporije je blaže prema starom uređaju na 4800 ili 9600 bauda, gdje svako čitanje traje stvarno vrijeme na liniji.

---

## Načini rada

| Način na uređaju | Prijemnik sluša u |
|---|---|
| USB, LSB | USB, LSB |
| CW | CW |
| CW-R (obrnuto) | CW-L |
| AM, sinkroni AM, DSB | AM |
| FM, uski FM | FM |
| Široki FM | WBFM |
| RTTY / FSK | LSB |
| RTTY-R / FSK-R | USB |
| Podatkovni načini (USB-D, DATA-U, PKTUSB, DIG) | USB |
| Podatkovni LSB, podatkovni FM | LSB, FM |

| Način na prijemniku | Uređaj se postavlja na |
|---|---|
| USB, LSB | USB, LSB |
| CW | CW |
| CW-L | CW-R |
| AM, QUAM | AM |
| FM | FM |
| WBFM | WFM — većina KV uređaja to odbija i ostavljaju se na miru nakon dva pokušaja |
| RADE (gornji / donji) | USB / LSB |

Uređaj u **podatkovnom načinu** u njemu i ostaje: USB prijemnika smatra se usklađenim s USB-D uređaja, pa prijemnik nikad ne izbacuje uređaj iz podatkovnog načina.

---

## Širina filtra

Označite **Sync filter width** da se propusni pojasevi poklapaju. Razlike manje od 60 Hz smatraju se jednakima jer nikoja dva filtra nemaju iste korake.

| Veza s uređajem | Širina filtra |
|---|---|
| Hamlib | Da, gdje ga Hamlib podržava za taj uređaj |
| flrig | Da |
| Ugrađeni Icom CI-V | Da — koraci od 50 Hz do 500 Hz, zatim od 100 Hz do 3,6 kHz; AM u koracima od 200 Hz do 10 kHz; ne u FM-u |
| Ugrađeni Elecraft | Da, u koracima od 10 Hz |
| Ugrađeni Kenwood, Yaesu, obitelj FT-817 | Ne — ti uređaji biraju filtre iz tablica za pojedini model. Za filtar koristite Hamlib |

Prijemnici KiwiSDR, WebSDR i UberSDR uvijek imaju tu kontrolu. PhantomSDR-Plus prijemnik mora imati **4.1.0** ili noviju; na starijem se frekvencija i način rada i dalje sinkroniziraju, a prozor Rig control objašnjava zašto filtar ne slijedi.

---

## Utišavanje pri odašiljanju

Označite **Mute receiver while transmitting**. Dok uređaj odašilje, prozor prijemnika je utišan, a kad prestane, zvuk se vraća. Gumb za utišavanje prijemnika to pokazuje i zvuk uvijek možete vratiti ručno.

Ako ste prijemnik već sami utišali, ostaje utišan i nakon toga.

Treba vezu koja javlja stanje odašiljanja — svi ugrađeni upravljači, flrig i Hamlib za većinu uređaja — i, na PhantomSDR-Plus prijemniku, inačicu 4.1.0 ili noviju.

---

## Pomak frekvencije

**Frequency offset** dodaje se frekvenciji uređaja da bi se dobila frekvencija prijemnika:

> frekvencija prijemnika = frekvencija uređaja + pomak

| Postava | Pomak |
|---|---|
| Transverter za 2 m na uređaju za 10 m (144,100 MHz prikazuje se kao 28,100 MHz) | `116000000` |
| Transverter za 70 cm na uređaju za 2 m (432 → 144) | `288000000` |
| Bez transvertera | `0` |

---

## Izbornik Rig

| Stavka | Što radi |
|---|---|
| **Rig control...** | Otvara prozor Rig control |
| **Connect / Disconnect** *naziv uređaja* | Pokreće ili zaustavlja sinkronizaciju; za Hamlib pokreće ili zaustavlja i `rigctld` |
| **Rig to receiver / Receiver to rig / Both directions** | Smjer sinkronizacije |
| **Sync filter width** | Da / ne |
| **Mute receiver while transmitting** | Da / ne |
| Statusni redak | *Not connected*, *Connecting...*, *Connected: naziv*, ili posljednja pogreška |

Živi prikaz frekvencije nalazi se u prozoru Rig control, a ne u izborniku, koji bi se inače sam zatvarao pri svakoj promjeni.

---

## Linux

**Dozvola za serijski port.** Serijski portovi pripadaju grupi `dialout`. Korisnik izvan nje dobiva *Could not open ttyUSB0*. Dodajte se jednom, zatim se odjavite i ponovno prijavite:

```bash
sudo usermod -aG dialout $USER
```

**Hamlib.** Instalirajte ga iz svoje distribucije:

```bash
sudo apt install libhamlib-utils
```

Paket `.deb` za Desktop PhantomSDR+ ga preporučuje, pa ga `sudo apt install ./phantomsdr-plus-desktop_4.0.0_amd64.deb` donosi sa sobom; `dpkg -i` ne instalira preporučene pakete. Ugrađeni upravljači i flrig ne trebaju Hamlib.

## Windows

Hamlibov vlastiti `rigctld.exe` uključen je i u 64-bitni i u 32-bitni instalacijski program. COM portovi pojavljuju se na popisu pod svojim nazivom (`COM3`). Ako uređaj treba USB upravljački program, najprije instalirajte onaj proizvođača — do tada port ne postoji.

---

## TCI-CAT na stranici prijemnika

Stranica PhantomSDR-Plus prijemnika može pratiti primopredajnik i **sama**, bez desktop aplikacije: preglednik izravno razgovara s **TCI** poslužiteljem na vašem vlastitom računalu. TCI je WebSocket protokol za upravljanje programa ExpertSDR2/ExpertSDR3 (SunSDR), AetherSDR (FlexRadio) i Thetis (Apache Labs ANAN, Hermes). Za uređaj bez TCI-ja, mali most koji dolazi s PhantomSDR-Plus čini da bilo koji Hamlib uređaj izgleda kao TCI poslužitelj.

Potreban je PhantomSDR-Plus prijemnik s inačicom **4.1.0 ili novijom**. Stranice KiwiSDR, WebSDR i UberSDR to nemaju.

### Gumb TCI-CAT

Gumb je u redu s **VFO**, **Modes**, **Bands** i **IF Filters** — **TCI-CAT** u širokom rasporedu, **CAT** u sažetom. Njegova točka je **zelena** dok je TCI poslužitelj spojen, a inače **siva**. Otvara prozor s: Do verzije 4.2.0 gumb se zvao **QRG Sync**.

| Kontrola | Što radi |
|---|---|
| Stanje | *Active — TCI (port 50001)* kad je spojeno; *Inactive* s ⏳ *Wait* dok traži |
| **CAT Sync** | Uključuje ili isključuje sinkronizaciju frekvencije, načina rada i filtra. Utišavanje pri odašiljanju radi u oba slučaja |
| **Host** | Računalo na kojem radi TCI poslužitelj: `localhost` za ovo računalo, inače njegova adresa u lokalnoj mreži, npr. `192.168.1.42`. Pritisnite Enter ili kliknite izvan polja za ponovno spajanje |

Ništa drugo ne treba birati: portovi **50001** (ExpertSDR3, AetherSDR) i **40001** (ExpertSDR2, Thetis) pokušavaju se istodobno i ponovno svakih nekoliko sekundi, pa se stranica spoji čim se program pokrene. **CAT Sync** i **Host** preglednik pamti.

Preglednici koji traže dopuštenje prije nego što web stranica pristupi lokalnoj mreži — to rade novije inačice Chromea i Edgea — pitaju jednom, pri prvom spajanju. Dopustite, inače točka ostaje siva.

### Što se drži usklađenim

| | Ponašanje |
|---|---|
| **Uređaj → prijemnik: frekvencija** | Pomiče se samo skala. Zoom, svjetlina i kontrast ostaju kako ste ih ostavili; vodopad se pomiče samo kad frekvencija izađe iz prikaza, a plan opsega ne mijenja način rada |
| **Uređaj → prijemnik: način rada** | Prati kad se promijeni način rada uređaja — USB, LSB, CW, AM, FM; digitalni načini kao USB ili LSB. Način koji prijemnik nema ostavlja ga nepromijenjenim. Dekoder koji radi zadržava svoj način |
| **Uređaj → prijemnik: širina filtra** | Propusni opseg prijemnika preuzima širinu filtra uređaja: promjena filtra ili tipka **FIL** na uređaju mijenja propusni opseg. Dekoder koji radi zadržava svoj propusni opseg |
| **Prijemnik → uređaj: frekvencija** | Upisana frekvencija, oznaka ili knjižna oznaka, klik na vodopad i povlačenje propusnog opsega pomiču VFO uređaja. Pri povlačenju šalju se samo promijenjene frekvencije |
| **Prijemnik → uređaj: način rada** | Svaka promjena načina rada na stranici — tipka načina, plan opsega, dekoder, knjižna oznaka — postavlja način rada uređaja (USB, LSB, CW, AM, FM; RADE kao USB ili LSB). Uređaj u digitalnom načinu (USB-D) ostaje u njemu |
| **Prijemnik → uređaj: širina filtra** | Tipke **IF Filters**, IF klizač, povlačenje propusnog opsega i promjena načina rada postavljaju filtar uređaja; pri povlačenju šalje se samo konačna širina. Na Icom uređajima most umjesto toga odabire FIL1, FIL2 ili FIL3 — vidi [Icom filtri](#icom-filtri-fil1-fil2-fil3) |
| **Bez jeke** | Promjena koja je došla s uređaja nikad mu se ne vraća, a javljanje prethodnog načina ili filtra uređaja koje stigne odmah nakon promjene na stranici zanemaruje se |
| **Utišavanje pri odašiljanju** | Uvijek uključeno, čak i s isključenim CAT Sync: stranica utihne dok uređaj odašilje. Pomicanje klizača glasnoće tijekom odašiljanja ne vraća zvuk; pri prijemu zvuk se vraća na trenutni položaj klizača |
| **Nije podržano** | Split, VFO B, RIT/XIT i pomaci transvertera. Prati se samo VFO A prvog prijemnika |

Način rada i širina filtra šalju se vlastitim TCI naredbama (`modulation`, `rx_filter_band`), pa bi ih i ExpertSDR, AetherSDR i Thetis trebali pratiti; isproban je samo Hamlib most. Za pomak transvertera koristite Desktop PhantomSDR+. Ne koristite oboje istodobno na istom uređaju — dva upravljača bore se oko skale.

### S kojim primopredajnicima radi

| Primopredajnik | Radi | Kako |
|---|---|---|
| SunSDR (ExpertSDR2/3), FlexRadio (AetherSDR), ANAN/Hermes (Thetis) | Da | Izravno — uključite TCI poslužitelj u programu. Još nije isprobano s tim programima; testirano sa simuliranim TCI poslužiteljem |
| Uređaj s CAT portom koji Hamlib podržava — većina Icom, Yaesu, Kenwood, Elecraft, Xiegu, QRP Labs | Da | Preko Hamlib mosta opisanog dolje. Isprobano s **Icom IC-7300** na Linuxu i Windowsima; drugi upravljački programi mogu se razlikovati u nazivima načina rada ili javljanju PTT-a |
| Uređaj bez CAT porta, ili koji Hamlib ne podržava | Ne | Nema odakle pročitati frekvenciju |

### Hamlib most (IC-7300 i drugi uređaji bez TCI-ja)

`tci-bridge/tci-rigctld.mjs` u PhantomSDR-Plus stablu pretvara svaki uređaj kojim Hamlib može upravljati u TCI poslužitelj za stranicu. Radi na **vašem** računalu — onom spojenom na uređaj, uz preglednik — ne na prijemniku. Četiri puta u sekundi pita Hamlib za frekvenciju, način rada, širinu filtra i stanje odašiljanja, šalje stranici samo promjene i prosljeđuje uređaju promjene frekvencije, načina rada i filtra sa stranice.

Do Hamliba dolazi na jedan od dva načina:

| Način | Lanac | Kada |
|---|---|---|
| **`--rigctl`** (preporučeno) | primopredajnik → `rigctl` → `tci-rigctld.mjs` → stranica | Uobičajeno. Most sam pokreće Hamlibov `rigctl`: jedan prozor, bez mrežnog porta. **Koristite ga na Windowsima**, gdje se `rigctld.exe` često odbija porukom *Access is denied* |
| **`rigctld`** | primopredajnik → `rigctld` → `tci-rigctld.mjs` → stranica | Drugi program, poput WSJT-X-a, mora istodobno koristiti uređaj — vidi [Dijeljenje uređaja](#dijeljenje-uređaja-put-preko-rigctld) |

**Što mu treba**

| | Linux | Windows |
|---|---|---|
| Hamlib | `sudo apt install libhamlib-utils`, ili hamlib paket vaše distribucije | `hamlib-w64-….zip` s [github.com/Hamlib/Hamlib/releases](https://github.com/Hamlib/Hamlib/releases), raspakiran u `C:\hamlib` — `rigctl.exe` je u `C:\hamlib\bin` |
| Node.js | 18 ili noviji | LTS *Windows Installer (.msi)* s [nodejs.org](https://nodejs.org), sa zadanim opcijama |
| Paket `ws` | Unutar PhantomSDR-Plus stabla pronalazi se automatski | Kopirajte `tci-rigctld.mjs` u mapu poput `C:\tci-bridge` i ondje jednom pokrenite `npm install ws` |
| Port uređaja | `ls /dev/serial/by-id/`. Jednom se pridružite grupi `dialout`: `sudo usermod -aG dialout $USER`, zatim se odjavite i ponovno prijavite | Instalirajte USB upravljački program proizvođača; COM broj je u **Upravitelj uređaja → Priključci (COM i LPT)** |

Samo jedan program može držati CAT port uređaja. Prije pokretanja mosta zatvorite WSJT-X, flrig, JS8Call, RS-BA1 ili vezu s uređajem u Desktop PhantomSDR+.

#### Primjer: Icom IC-7300

Na uređaju: **MENU → SET → Connectors → CI-V** — **CI-V USB Baud Rate** `115200`, **CI-V Transceive** `ON`. Hamlibov broj modela za IC-7300 je `3073`.

**Linux.** Uređaj je redak koji sadrži `IC-7300` u `ls /dev/serial/by-id/`, obično i `/dev/ttyUSB0`.

1. Provjerite da Hamlib dolazi do uređaja — mora ispisati frekvenciju, npr. `14280000`:
   ```bash
   rigctl -m 3073 -r /dev/ttyUSB0 -s 115200 f
   ```
2. Pokrenite most i ostavite ga da radi:
   ```bash
   cd ~/PhantomSDR-Plus/tci-bridge
   node tci-rigctld.mjs --rigctl rigctl -m 3073 -r /dev/ttyUSB0 -s 115200
   ```

**Windows.** Uređaj se u Upravitelju uređaja prikazuje kao *Silicon Labs CP210x USB to UART Bridge (COM4)* — koristite svoj COM broj. U naredbenom retku:

1. Provjerite da Hamlib dolazi do uređaja — mora ispisati frekvenciju:
   ```bat
   C:\hamlib\bin\rigctl.exe -m 3073 -r COM4 -s 115200 f
   ```
2. Pokrenite most i ostavite prozor otvoren:
   ```bat
   cd C:\tci-bridge
   node tci-rigctld.mjs --rigctl C:\hamlib\bin\rigctl.exe -m 3073 -r COM4 -s 115200
   ```
   Redak je dugačak: provjerite da stvarno završava s `-s 115200`, inače se `rigctl` zaustavlja porukom *Type: rigctl --help*.

Na oba sustava most unutar sekunde ispiše:

```
rig answered through rigctl
rig -> page 14280000 Hz
rig -> page mode USB
rig -> page RX
```

Zatim otvorite stranicu prijemnika u pregledniku na istom računalu, otvorite **TCI-CAT** i uključite **CAT Sync**. Točka postaje zelena, a most ispiše `page connected`. Okrenite VFO i prijemnik prati; kliknite na vodopad i uređaj prati (`page -> rig ... Hz`); prijeđite na odašiljanje i stranica utihne. **Ctrl+C** zaustavlja most, a s njim i `rigctl`.

Sve iza `--rigctl` je program `rigctl` s vlastitim opcijama — upravo onima koje su radile pri provjeri. To je pravilo za svaki uređaj: **kad `rigctl … f` ispiše frekvenciju, most radi s istim opcijama.**

#### Icom filtri (FIL1, FIL2, FIL3)

Icom uređaji poput IC-7300 ne prihvaćaju bilo koju širinu filtra: imaju tri filtra, **FIL1**, **FIL2** i **FIL3**, svaki sa širinom postavljenom u izborniku uređaja. S nekom širinom Hamlib bi odabrao jedan od njih i ujedno prepisao njegovu širinu — a na IC-7300 ta širina može završiti na prethodno odabranom filtru i pomiješati postavke. Zato na Icom uređajima most nikad ne šalje širinu: uzima filtar čija je referentna širina najbliža propusnom opsegu stranice i samo ga **odabire**, vlastitom CI-V naredbom uređaja. Širine postavljene na uređaju nikad se ne mijenjaju.

| Način rada | FIL1 | FIL2 | FIL3 |
|---|---|---|---|
| USB, LSB (i njihovi digitalni načini) | 2700 Hz | 2400 Hz | 1800 Hz |
| CW | 1200 Hz | 500 Hz | 250 Hz |
| AM | 9000 Hz | 6000 Hz | 3000 Hz |
| FM | 15000 Hz | 10000 Hz | 7000 Hz |

Na IC-7300 (`-m 3073`) to je automatski. Postavite SSB filtre uređaja odgovarajuće — FIL1 2,7 kHz, FIL2 2,4 kHz, FIL3 1,8 kHz (držite **FIL** na uređaju) — pa odabir 2,7 / 2,4 / 1,8 kHz u **IF Filters** odabire FIL1 / FIL2 / FIL3, a pritisak na **FIL** na uređaju postavlja propusni opseg stranice na širinu tog filtra. Most ispisuje, na primjer, `page -> rig filter 2398 Hz  LSB  → FIL2  sent`.

| Opcija | Namjena |
|---|---|
| `--filters 3000,2400,1800` | Druge SSB referentne širine, redom FIL1,FIL2,FIL3; uključuje odabir filtra i za drugi Icom uređaj |
| `--civ A4` | CI-V adresa uređaja heksadecimalno, kad nije `94` (IC-705 `A4`, IC-9700 `A2`, IC-7610 `98`) |
| `--filters off` | Slati širine preko Hamliba, kao za druge proizvođače |

Obje opcije idu prije `--rigctl`, npr. `node tci-rigctld.mjs --filters 3000,2400,1800 --civ A4 --rigctl rigctl -m 3085 -r /dev/ttyACM0 -s 19200`. Isprobano samo s IC-7300. Drugi proizvođači — Yaesu, Kenwood, Elecraft i ostali — dobivaju širinu stranice preko Hamliba, koji je postavlja koliko god točno uređaj dopušta.

#### Drugi uređaji

Isti koraci vrijede za svaki uređaj koji Hamlib podržava; mijenjaju se samo opcije.

1. **Pripremite uređaj.** U izborniku zabilježite CAT (ili CI-V) brzinu i uključite postavku poput *CAT preko USB-a* ili *CI-V transceive*, ako postoji. Na Windowsima instalirajte USB upravljački program proizvođača.
2. **Pronađite Hamlibov broj modela** na popisu koji ispisuje `rigctl -l`:
   - Linux: `rigctl -l | grep -i 991`
   - Windows: `C:\hamlib\bin\rigctl.exe -l | findstr /i 991`
3. **Pronađite port.** Linux: `ls /dev/serial/by-id/`. Windows: Upravitelj uređaja. Neki uređaji stvaraju **dva** porta — Yaesuovi FT-991A, FTDX10 i FT-710 zovu ih *Enhanced* i *Standard*; CAT je na **Enhanced** portu.
4. **Provjerite, zatim pokrenite most** s `-m <model> -r <port> -s <brzina>`, kao u primjeru za IC-7300: najprije `rigctl -m … -r … -s … f`, zatim iste opcije iza `--rigctl`.

Neki brojevi modela, iz Hamliba 4.5 — potvrdite ih s `rigctl -l`, jer druga inačica Hamliba može drukčije numerirati uređaj:

| Uređaj | `-m` | Uređaj | `-m` |
|---|---|---|---|
| Icom IC-7300 | 3073 | Yaesu FT-991 / FT-991A | 1035 |
| Icom IC-705 | 3085 | Yaesu FTDX10 | 1042 |
| Icom IC-7610 | 3078 | Yaesu FT-710 | 1049 |
| Icom IC-9700 | 3081 | Yaesu FT-891 | 1036 |
| Xiegu G90 | 3088 | Yaesu FT-817 | 1020 |
| Xiegu X6100 | 3087 | Kenwood TS-590SG | 2037 |
| Elecraft K3 / K3S | 2029 | Kenwood TS-890S | 2041 |
| Elecraft KX3 | 2045 | Kenwood TS-2000 | 2014 |
| Elecraft K4 | 2047 | QRP Labs QCX / QDX | 2052 |

Dodatne opcije, samo kad zatrebaju:

- **Icom uređaj s promijenjenom CI-V adresom:** dodajte `-c` s adresom u *decimalnom* obliku — `94h` je `-c 148`.
- **Postavka koju Hamlib nudi za taj uređaj:** `rigctl -m <model> -L` ih ispisuje; postavite jednu s `-C ime=vrijednost`, npr. `-C post_write_delay=10` za sporo sučelje.
- **Uređaj koji pri otvaranju porta prelazi na odašiljanje ili se ponovno pokreće:** neki CAT kabeli koriste DTR ili RTS za PTT; dodajte `-C dtr_state=OFF -C rts_state=OFF`.

#### Primjer: Yaesu FT-991A

Nije isprobano sa stvarnim FT-991A — slijedi Hamlibove postavke za taj uređaj; provjera `rigctl … f` odmah pokazuje radi li.

Na uređaju postavite **CAT RATE** (izbornik 031) na `38400`. Hamlibov broj modela za FT-991 i FT-991A je `1035`.

USB kabel FT-991A stvara **dva** serijska porta. CAT je na **Enhanced** portu:

- **Linux:** `ls /dev/serial/by-id/` prikazuje dva retka za uređaj; onaj koji završava s `-if00-port0` je Enhanced, obično `/dev/ttyUSB0`.
- **Windows:** Upravitelj uređaja prikazuje *Silicon Labs Dual CP2105 USB to UART Bridge: Enhanced COM Port (COM5)* i *Standard COM Port*; koristite broj Enhanced porta.

**Linux:**
```bash
rigctl -m 1035 -r /dev/ttyUSB0 -s 38400 f
cd ~/PhantomSDR-Plus/tci-bridge
node tci-rigctld.mjs --rigctl rigctl -m 1035 -r /dev/ttyUSB0 -s 38400
```

**Windows:**
```bat
C:\hamlib\bin\rigctl.exe -m 1035 -r COM5 -s 38400 f
cd C:\tci-bridge
node tci-rigctld.mjs --rigctl C:\hamlib\bin\rigctl.exe -m 1035 -r COM5 -s 38400
```

Ako provjera ne ispiše ništa korisno, uobičajeni uzrok je Standard port umjesto Enhanced, ili CAT RATE različit od `-s`.

#### Primjer: Kenwood TS-590SG

Nije isprobano sa stvarnim TS-590SG — slijedi Hamlibove postavke za taj uređaj; provjera `rigctl … f` odmah pokazuje radi li.

U izborniku uređaja postavite brzinu **USB** porta na `115200` (broj izbornika je u priručniku za TS-590SG). Hamlibov broj modela je `2037`; stariji TS-590S je `2031`. Na Windowsima najprije instalirajte Kenwoodov upravljački program virtualnog COM porta za USB priključak.

USB kabel stvara **jedan** serijski port:

- **Linux:** redak uređaja u `ls /dev/serial/by-id/`, obično `/dev/ttyUSB0`.
- **Windows:** Upravitelj uređaja → Priključci (COM i LPT), na primjer `COM6`.

**Linux:**
```bash
rigctl -m 2037 -r /dev/ttyUSB0 -s 115200 f
cd ~/PhantomSDR-Plus/tci-bridge
node tci-rigctld.mjs --rigctl rigctl -m 2037 -r /dev/ttyUSB0 -s 115200
```

**Windows:**
```bat
C:\hamlib\bin\rigctl.exe -m 2037 -r COM6 -s 115200 f
cd C:\tci-bridge
node tci-rigctld.mjs --rigctl C:\hamlib\bin\rigctl.exe -m 2037 -r COM6 -s 115200
```

Ako provjera ne uspije, uobičajeni uzrok je USB brzina različita od `-s`, ili kabel u RS-232 (COM) utičnici uređaja dok `-r` navodi USB port.

#### Još primjera

Nijedan nije isproban na stvarnom uređaju. Svaki redak daje opcije koje idu iza `rigctl` pri provjeri i iza `--rigctl rigctl` za most; u izborniku uređaja postavite istu brzinu. Linux port je uobičajeni — potvrdite ga s `ls /dev/serial/by-id/`. Na Windowsima zamijenite port COM brojem iz Upravitelja uređaja, a `rigctl` s `C:\hamlib\bin\rigctl.exe`.

| Uređaj | Izbornik uređaja | Opcije (Linux) | Napomene |
|---|---|---|---|
| Icom IC-705 (USB) | CI-V USB Baud Rate `19200` | `-m 3085 -r /dev/ttyACM0 -s 19200` | Pojavljuju se dva porta; CI-V je prvi (`ttyACM0`) |
| Icom IC-7100 (USB) | CI-V USB Baud Rate `19200` | `-m 3070 -r /dev/ttyUSB0 -s 19200` | Hamlibova najveća brzina za ovaj uređaj je 19200 |
| Icom IC-7610 | CI-V USB Baud Rate `115200` | `-m 3078 -r /dev/ttyUSB0 -s 115200` | |
| Icom IC-9700 | CI-V USB Baud Rate `38400` | `-m 3081 -r /dev/ttyUSB0 -s 38400` | |
| Yaesu FTDX101D / FTDX101MP | CAT RATE `38400` | `-m 1040 -r /dev/ttyUSB0 -s 38400` | `-m 1044` za FTDX101MP. Dva porta; koristite Enhanced |
| Yaesu FTDX10 | CAT RATE `38400` | `-m 1042 -r /dev/ttyUSB0 -s 38400` | Dva porta; koristite Enhanced, kao kod FT-991A |
| Yaesu FT-710 | CAT RATE `38400` | `-m 1049 -r /dev/ttyUSB0 -s 38400` | Dva porta; koristite Enhanced, kao kod FT-991A |
| Yaesu FT-891 | CAT RATE `38400` | `-m 1036 -r /dev/ttyUSB0 -s 38400` | Dva porta; koristite Enhanced, kao kod FT-991A |
| Yaesu FT-450D | CAT RATE `38400` | `-m 1046 -r /dev/ttyUSB0 -s 38400` | RS-232 utičnica: koristite USB-serijski adapter |
| Yaesu FT-817 / FT-818 | CAT RATE `38400` | `-m 1020 -r /dev/ttyUSB0 -s 38400` | `-m 1041` za FT-818. Treba CAT kabel na ACC utičnici |
| Yaesu FT-857 / FT-897 | CAT RATE `38400` | `-m 1022 -r /dev/ttyUSB0 -s 38400` | `-m 1023` za FT-897. Treba CAT kabel |
| Kenwood TS-890S (USB) | USB brzina `115200` | `-m 2041 -r /dev/ttyUSB0 -s 115200` | |
| Kenwood TS-990S (USB) | USB brzina `115200` | `-m 2039 -r /dev/ttyUSB0 -s 115200` | |
| Kenwood TS-590SG / TS-590S (USB) | USB brzina `115200` | `-m 2037 -r /dev/ttyUSB0 -s 115200` | Detaljan primjer gore |
| Kenwood TS-480 | Brzina COM porta `57600` | `-m 2028 -r /dev/ttyUSB0 -s 57600` | RS-232 utičnica: koristite USB-serijski adapter |
| Kenwood TS-2000 | Brzina COM porta `57600` | `-m 2014 -r /dev/ttyUSB0 -s 57600` | RS-232 utičnica; Hamlibova najveća brzina za ovaj uređaj je 57600 |
| Elecraft K4 (USB) | RS232 brzina `115200` | `-m 2047 -r /dev/ttyUSB0 -s 115200` | |
| Elecraft K3 / K3S | RS232 brzina `38400` | `-m 2029 -r /dev/ttyUSB0 -s 38400` | K3S: USB; K3: serijski port ili KUSB kabel |
| Elecraft KX3 | RS232 brzina `38400` | `-m 2045 -r /dev/ttyUSB0 -s 38400` | KXUSB kabel |
| Elecraft KX2 | RS232 brzina `38400` | `-m 2044 -r /dev/ttyUSB0 -s 38400` | KXUSB kabel |
| Xiegu G90 | CI-V brzina `19200` | `-m 3088 -r /dev/ttyUSB0 -s 19200` | Hamlib koristi zadanu CI-V adresu G90 |
| Xiegu X6100 | CI-V brzina `19200` | `-m 3087 -r /dev/ttyUSB0 -s 19200` | Hamlibova najveća brzina za ovaj uređaj je 19200 |
| Lab599 TX-500 | — | `-m 2050 -r /dev/ttyUSB0 -s 9600` | Hamlib koristi samo 9600 |
| ELAD FDM-DUO | — | `-m 33001 -r /dev/ttyUSB0 -s 115200` | |
| QRP Labs QDX | — | `-m 2052 -r /dev/ttyACM0 -s 9600` | USB serijski port; brzina nije bitna, ali se mora navesti |

Potpuna Linux naredba za IC-705, kao primjer čitanja retka:

```bash
rigctl -m 3085 -r /dev/ttyACM0 -s 19200 f
node tci-rigctld.mjs --rigctl rigctl -m 3085 -r /dev/ttyACM0 -s 19200
```

#### Uređaji kojima upravlja drugi program

Nekim uređajima već upravlja program koji može obaviti posao — ponekad bez ikakvog mosta. Nijedan od ovih načina nije isproban.

| Uređaj i program | Što učiniti |
|---|---|
| **SunSDR** s ExpertSDR2/3, **FlexRadio** s AetherSDR, **Apache Labs ANAN / Hermes** s Thetisom | Bez mosta. Uključite **TCI poslužitelj** programa i koristite **TCI-CAT** izravno — portovi 50001 i 40001 pronalaze se automatski |
| **FlexRadio** sa SmartSDR (Windows) | Dodajte port u **SmartSDR CAT**. Govori Kenwood CAT, pa serijski port ondje radi kao TS-2000: `-m 2014 -r COM8 -s 57600`. TCP port radi s Hamlibovim FlexRadio modelom: `-m 2036 -r 127.0.0.1:<port>` |
| **Bilo koji uređaj kojim upravlja flrig** | Ostavite flrig da radi i koristite Hamlibov flrig model; uređaj ostaje dijeljen s fldigi, WSJT-X-om i programima za dnevnik: `-m 4 -r 127.0.0.1:12345` |
| **Pokrenuti rigctld**, ili program s *Hamlib NET rigctl* poslužiteljem | Pokrenite most bez `--rigctl`, s tom adresom: `node tci-rigctld.mjs 50001 127.0.0.1:4532` |

Kao i svugdje, opcije idu iza `rigctl` pri provjeri i iza `--rigctl rigctl` za most. Mrežna adresa poput `127.0.0.1:12345` ne treba `-s`.

#### Dijeljenje uređaja: put preko rigctld

Kad WSJT-X ili program za dnevnik mora koristiti uređaj dok most radi, pokrenite Hamlibov poslužitelj `rigctld` s istim opcijama, ostavite ga da radi i spojite oba programa na njega:

```bash
rigctld -m 3073 -r /dev/ttyUSB0 -s 115200
node tci-rigctld.mjs
```

Bez `--rigctl` most traži `rigctld` na `127.0.0.1:4532` i ispiše `rigctld connected`; `node tci-rigctld.mjs 50001 192.168.1.50:4532` koristi `rigctld` na drugom računalu. U WSJT-X-u odaberite uređaj *Hamlib NET rigctl* na istoj adresi. Na Windowsima je poslužitelj `C:\hamlib\bin\rigctld.exe` s istim opcijama; ako Windows odgovori *Access is denied*, koristite `--rigctl` i zatvorite drugi program dok most radi.

**Portovi.** Most nudi TCI na portu 50001; drugi port stavlja se prvi u naredbeni redak, npr. `node tci-rigctld.mjs 40001 --rigctl …`. Ako su most i preglednik na različitim računalima, u **Host** upišite adresu računala s mostom.

### Rješavanje problema s TCI-CAT

| Simptom | Vjerojatni uzrok | Što učiniti |
|---|---|---|
| Točka ostaje siva | TCI poslužitelj ili most ne radi; pogrešan **Host**; odbijeno je dopuštenje preglednika za lokalnu mrežu | Uključite TCI u ExpertSDR/Thetis/AetherSDR ili pokrenite most; provjerite **Host**; dopustite pristup lokalnoj mreži u postavkama stranice |
| `rigctl … f` javlja pogrešku ili čeka | Pogrešan port ili brzina; nema dopuštenja `dialout` (Linux) ili USB upravljačkog programa (Windows); drugi program drži port | Uskladite `-s` s izbornikom uređaja; provjerite port (`ls /dev/serial/by-id/`, Upravitelj uređaja); zatvorite druge programe za uređaj |
| Most ispisuje *rigctl stopped … Type: rigctl --help* | Naredba je nepotpuna — obično nedostaje brzina iza `-s` | Ponovno upišite cijeli redak |
| Most ispisuje *The value after -s is missing* | Naredbeni redak skraćen je pri lijepljenju | Ponovno upišite kraj retka, npr. `-s 115200` |
| Filtar ne prati u jednom ili drugom smjeru | **CAT Sync** je isključen, na stranici radi dekoder, ili (IC-7300) FIL širine uređaja razlikuju se od 2700 / 2400 / 1800 Hz | Uključite CAT Sync; zaustavite dekoder; postavite FIL širine na uređaju ili navedite `--filters` sa širinama uređaja |
| Most ispisuje *rigctl stopped … rig_open: error* | `rigctl` ne može otvoriti port | Kao za `rigctl … f` gore |
| Most ispisuje *the rig is not answering* | Port se otvara, ali uređaj ne odgovara: pogrešna brzina ili model, CAT isključen u izborniku, ili promijenjena Icom CI-V adresa | Ponovite provjeru `rigctl … f`; za promijenjenu CI-V adresu dodajte `-c` |
| Most ispisuje *rigctld not reachable* | Pokrenut bez `--rigctl`, a `rigctld` ne radi | Dodajte `--rigctl …`, ili najprije pokrenite `rigctld` |
| `rigctld.exe` javlja *Access is denied* (Windows) | Windows ga odbija pokrenuti | Koristite `--rigctl` — treba mu samo `rigctl.exe` |
| Spojeno, ali se prijemnik ne pomiče | **CAT Sync** je isključen | Uključite ga — utišavanje pri odašiljanju radi i bez njega |
| Način rada uređaja ne prati | Način bez odgovarajućeg na prijemniku, ili Hamlib upravljački program javlja neobičan naziv | Frekvencija se svejedno sinkronizira; način rada postavite na stranici |
| Nema utišavanja pri odašiljanju | Uređaj ili njegov Hamlib upravljački program ne javlja stanje odašiljanja | Na stranici nema što podesiti |
| Skala skače naprijed-natrag | Desktop PhantomSDR+ ili drugi program također sinkronizira uređaj | Koristite samo jedan upravljač odjednom |

---

## Za operatere prijemnika

Nema se što podešavati. Upravljanje primopredajnikom koristi malo JavaScript sučelje koje svaka PhantomSDR-Plus stranica već ima; ne treba postavka poslužitelja, otvoreni port ni administratorska ovlast. Funkcije filtra i utišavanja stigle su s inačicom 4.1.0 — nakon primjene ponovno izgradite frontend (`./recompile.sh`, opcija 2); prijemnik ne treba zaustavljati. Ni prijemnici KiwiSDR, WebSDR i UberSDR ne trebaju ništa: aplikacija koristi kontrole koje njihove stranice već imaju.

Gumb **TCI-CAT** stigao je također s inačicom 4.1.0, opet samo uz ponovnu izgradnju frontenda. Ne otvara nijedan port na prijemniku: veza ide iz preglednika svakog slušatelja prema njegovom vlastitom računalu. Hamlib most, `tci-bridge/tci-rigctld.mjs`, slušatelji pokreću kod kuće; prijemnik ga ne koristi.

---

## Za programere: sučelje stranice

I Desktop PhantomSDR+ i CATsync Tool koriste ove funkcije, koje svaka PhantomSDR-Plus stranica postavlja na `window` nakon učitavanja (stranicama KiwiSDR, WebSDR i UberSDR upravlja se preko njihovih vlastitih, drugačijih kontrola):

| Funkcija | Vraća / radi |
|---|---|
| `catsync_ready` | `true` čim su funkcije ispod postavljene |
| `catsync_getFrequency()` | Ugođena frekvencija, Hz |
| `catsync_setFrequency(hz)` | Ugađa na `hz` |
| `catsync_getMode()` | `USB`, `LSB`, `CW`, `CW-L`, `AM`, `QUAM`, `FM`, `WBFM`, `RADEU`, `RADEL` |
| `catsync_setMode(mode)` | Postavlja način rada; vraća propusni pojas na zadano za taj način |
| `catsync_getBandwidth()` | Ukupna širina propusnog pojasa, Hz |
| `catsync_setBandwidth(hz)` | Postavlja širinu — raste prema gore u USB-u, prema dolje u LSB-u, inače jednako na obje strane. Pozovite je **nakon** `catsync_setMode` |
| `catsync_getMute()` | `true` kad je utišano |
| `catsync_setMute(on)` | Utišava ili vraća zvuk, preko gumba za utišavanje na stranici |

Posljednje četiri stigle su s inačicom 4.1.0, pa ih provjerite prije poziva:

```js
if (window.catsync_ready) {
  window.catsync_setFrequency(7074000)
  window.catsync_setMode('USB')
  if (typeof window.catsync_setBandwidth === 'function') window.catsync_setBandwidth(2400)
}
```

Postavljanje frekvencije ponovno ugađa zvuk, pa setter pozovite samo kad se vrijednost stvarno promijenila — setter koji se stalno poziva s istom vrijednošću čuje se. Stariji ulazi u stilu KiwiSDR/WebSDR (`setfreq`, `set_mode`, `freqset_complete`) i dalje postoje za alate koji ih očekuju.

---

## Rješavanje problema

| Simptom | Vjerojatan uzrok | Što učiniti |
|---|---|---|
| *Could not open ttyUSB0* (Linux) | Niste u grupi `dialout`, ili drugi program drži port | `sudo usermod -aG dialout $USER`, odjava i prijava; zatvorite WSJT-X, dnevnike veza, alate uređaja |
| Prikaz prijemnika kaže *not a receiver this app can drive* | Druga vrsta web prijemnika, ili se stranica još učitava | Podržani su PhantomSDR-Plus, KiwiSDR, PA3FWM WebSDR i UberSDR; sporoj stranici dajte nekoliko sekundi |
| *The rig did not answer* | Pogrešna brzina, pogrešan tip uređaja, pogrešna CI-V adresa, uređaj isključen | Uskladite brzinu s izbornikom uređaja; provjerite CI-V adresu; pokušajte Hamlib |
| *Hamlib is not installed* | `rigctld` nije pronađen | Linux: `sudo apt install libhamlib-utils`. Ili upišite putanju u **rigctld program** |
| *rigctld stopped: ...* | Hamlib nije mogao otvoriti uređaj — slijedi njegova poruka | Obično port ili brzina; tekst nakon dvotočke Hamlibov je razlog |
| *flrig is not running at ...* | flrig je zatvoren, ili je njegov XML-RPC port drugačiji | Pokrenite flrig; provjerite port u njegovim postavkama |
| Spojeno, ali se prijemnik ne pomiče | Nije otvoren prozor stanice, ili je **Receiver window** vezan uz zatvorenu stanicu | Otvorite stanicu ili odaberite *The station window last in front* |
| Uređaj odašilje pri spajanju | DTR ili RTS preko sučelja uključuje odašiljač | Uklonite oznake **DTR on** i **RTS on** |
| Filtar ne slijedi | Prijemnik stariji od 4.1.0, ili ugrađeni Kenwood/Yaesu upravljač | Frekvencija i način rada i dalje se sinkroniziraju; za filtar na Kenwoodu/Yaesuu koristite Hamlib |
| Utišavanje pri odašiljanju ne radi ništa | Prijemnik bez ažuriranja, ili uređaj ne javlja stanje odašiljanja | Kao gore |
| *Lost the rig ... reconnecting* | Izvučen kabel, isključen uređaj ili je rigctld prestao raditi | Ništa — pokušava ponovno svake 3 sekunde i nastavlja kad se uređaj vrati |
| Obje strane stalno skaču | Dva programa istodobno upravljaju uređajem | Neka samo jedan program podešava uređaj, ili ga dijelite preko flriga |

---

## Poznata ograničenja

- Jedan uređaj, jedan prozor prijemnika istodobno.
- Prijemnici osim PhantomSDR-Plus, KiwiSDR, PA3FWM WebSDR i UberSDR — primjerice OpenWebRX — nisu podržani.
- Ugrađeni upravljači prate objavljene protokole proizvođača i testirani su na simuliranim uređajima i stvarnom Hamlibu; za uređaj koji se ponaša drugačije, rezervno rješenje je Hamlib.
- Split, VFO B, RIT/XIT i memorijski kanali ne sinkroniziraju se — samo frekvencija aktivnog VFO-a.
- TCI-CAT na stranici prijemnika ne sinkronizira split, VFO B, RIT/XIT ni pomake transvertera, a isproban je samo s IC-7300 preko Hamlib mosta.
- Na Linuxu paketi koriste Hamlib iz distribucije; vlastiti nije uključen.
