# Vodič za instalaciju PhantomSDR-Plusa za sistemske operatere

Ovaj sveobuhvatni vodič vodi vas kroz instalaciju i konfiguraciju PhantomSDR-Plusa na vašem poslužitelju.

---

## Sadržaj

1. [Sistemski zahtjevi](#sistemski-zahtjevi)
2. [Priprema prije instalacije](#priprema-prije-instalacije)
3. [Instalacija PhantomSDR-Plusa](#instalacija-phantomsdr-plusa) — skripta i [što radi](#što-instalacijska-skripta-radi)
4. [Autorun Spot Reporter (FT8/FT4/WSPR)](#autorun-spot-reporter-ft8ft4wspr)
5. [Emulacija KiwiSDR klijenata (neobavezno)](#emulacija-kiwisdr-klijenata-neobavezno)
6. [Konfiguracija](#konfiguracija)
7. [Postavljanje ovisno o SDR uređaju](#postavljanje-ovisno-o-sdr-uređaju)
8. [Testiranje i provjera](#testiranje-i-provjera)
9. [Postavljanje automatskog pokretanja](#postavljanje-automatskog-pokretanja)
10. [Toplinska zaštita procesora](#toplinska-zaštita-procesora)
11. [Rješavanje problema](#rješavanje-problema)

**Samo kao referenca — instalacijska skripta sve ovo već obavlja umjesto vas.**
Pročitajte ove odjeljke ako ste na distribuciji koju nijedna skripta ne pokriva ili ako trebate ručno popraviti pojedini korak:

- [Instalacija ovisnosti](#instalacija-ovisnosti)
- [Instalacija Node.js-a i npm-a](#instalacija-nodejs-a-i-npm-a)
- [Instalacija OpenCL-a](#instalacija-opencl-a-neobavezno-ali-preporučeno)
- [Ručno građenje](#ručno-građenje-referenca)
- [Instalacija audiokodeka Opus](#instalacija-audiokodeka-opus)
---

## Sistemski zahtjevi

### Podržani operacijski sustavi

**Primarni (preporučeno):**
- Ubuntu 22.04 LTS (Jammy), 24.04 LTS (Noble) i 26.04 LTS (Resolute) — preporučuje se 24.04
- Debian 12 (Bookworm) i Debian 13 (Trixie)

**Alternativa:**
- Fedora (najnovije stabilno izdanje)
- Arch Linux (kotrljajuće izdanje)
- openSUSE Tumbleweed (ne Leap — vidjeti napomenu niže)

### Hardverski zahtjevi

**Minimalna konfiguracija:**
- Procesor: dvojezgreni (2+ GHz)
- RAM: 4 GB
- Pohrana: 10 GB slobodnog prostora
- Mreža: veza od 100 Mbit/s

**Preporučena konfiguracija:**
- Procesor: četverojezgreni ili bolji (Ryzen 5 2600, Intel i5-6500T ili bolji)
- RAM: 8 GB ili više
- Pohrana: SSD od 20 GB ili više
- GPU: AMD/NVIDIA s podrškom za OpenCL (vrlo preporučljivo)
- Mreža: veza od 1 Gbit/s

**Konfiguracija visokih performansi:**
- Procesor: 6+ jezgri (Ryzen 7, Intel i7 ili bolji)
- RAM: 16 GB ili više
- Pohrana: NVMe SSD
- GPU: namjenski GPU s podrškom za OpenCL/CUDA
- Mreža: 1 Gbit/s ili bolja

---

## Priprema prije instalacije

### 1. Ažurirajte sustav

```bash
# Ubuntu/Debian
sudo apt update
sudo apt upgrade -y
sudo reboot

# Fedora
sudo dnf update -y
sudo reboot
```

### 2. Provjerite verziju Ubuntua

```bash
lsb_release -a
```

**Očekivani ispis trebao bi pokazati:** Ubuntu 24.04 LTS

### 3. Provjerite slobodan prostor na disku

```bash
df -h
```

Pobrinite se da u svom osobnom direktoriju imate najmanje 10 GB slobodno.

### 4. Provjerite podatke o procesoru

```bash
lscpu
```

Zabilježite broj jezgri/dretvi radi optimizacije konfiguracije.

---

## Instalacija ovisnosti

> [!IMPORTANT]
> **Za normalnu instalaciju ovaj odjeljak vam ne treba.** `./install.sh` — ili instalacijska skripta vaše distribucije — sve to obavlja umjesto vas; vidi [Što instalacijska skripta radi](#što-instalacijska-skripta-radi). Ovo je referenca za ručno postavljanje, za distribuciju koju nijedna skripta ne pokriva ili za ručni popravak pojedinog dijela.


### Ubuntu 24.04 LTS

```bash
sudo apt install -y \
  build-essential \
  cmake \
  pkg-config \
  meson \
  libfftw3-dev \
  libwebsocketpp-dev \
  libflac++-dev \
  zlib1g-dev \
  libzstd-dev \
  libboost-all-dev \
  libopus-dev \
  libliquid-dev \
  git \
  psmisc \
  wget \
  curl
```

### Fedora

```bash
sudo dnf install -y \
  g++ \
  meson \
  cmake \
  fftw3-devel \
  websocketpp-devel \
  flac-devel \
  zlib-devel \
  boost-devel \
  libzstd-devel \
  opus-devel \
  liquid-dsp-devel \
  git \
  psmisc \
  wget \
  curl
```

### Provjerite instalaciju

```bash
# Check if key dependencies are installed
pkg-config --modversion fftw3
cmake --version
meson --version
```

---

## Instalacija Node.js-a i npm-a

> [!IMPORTANT]
> **Za normalnu instalaciju ovaj odjeljak vam ne treba.** `./install.sh` — ili instalacijska skripta vaše distribucije — sve to obavlja umjesto vas; vidi [Što instalacijska skripta radi](#što-instalacijska-skripta-radi). Ovo je referenca za ručno postavljanje, za distribuciju koju nijedna skripta ne pokriva ili za ručni popravak pojedinog dijela.


PhantomSDR-Plus zahtijeva Node.js za izgradnju sučelja. Za instalaciju ćemo koristiti NVM (Node Version Manager).

### 1. Instalirajte NVM

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.4/install.sh | bash
```

### 2. Učitajte NVM

**VAŽNO:** zatvorite i ponovno otvorite terminal ili pokrenite:

```bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
```

### 3. Provjerite instalaciju NVM-a

```bash
nvm --version
```

Očekivani ispis: `0.40.4` ili slično

### 4. Instalirajte Node.js

```bash
# Install Node.js 22 - the version every install script requires
nvm install 22

# Make it the default, so systemd units and cron see it too
nvm alias default 22

# Verify installation
node --version
npm --version
```

### 5. Neobavezno: instalirajte dodatne verzije Nodea

```bash
# Install latest version
nvm install node

# Install specific version (if needed)
nvm install 22.22.3

# List installed versions
nvm list

# Use specific version
nvm use 22
```

---

## Instalacija OpenCL-a (neobavezno, ali preporučeno)

> [!IMPORTANT]
> **Za normalnu instalaciju ovaj odjeljak vam ne treba.** `./install.sh` — ili instalacijska skripta vaše distribucije — sve to obavlja umjesto vas; vidi [Što instalacijska skripta radi](#što-instalacijska-skripta-radi). Ovo je referenca za ručno postavljanje, za distribuciju koju nijedna skripta ne pokriva ili za ručni popravak pojedinog dijela.


OpenCL dramatično poboljšava performanse prebacivanjem FFT izračuna na GPU. Ovaj odjeljak pokriva integriranu Intel grafiku. Za AMD/NVIDIA GPU pogledajte dokumentaciju proizvođača.

### Intel procesor s integriranom grafikom

#### 1. Instalirajte osnovne OpenCL komponente

```bash
sudo apt install -y \
  build-essential \
  cmake \
  pkg-config \
  meson \
  libfftw3-dev \
  libwebsocketpp-dev \
  libflac++-dev \
  zlib1g-dev \
  libzstd-dev \
  libboost-all-dev \
  libopus-dev \
  libliquid-dev \
  libclfft-dev \
  ocl-icd-opencl-dev \
  clinfo
```

#### 2. Preuzmite Intel Compute Runtime

```bash
mkdir -p ~/neo
cd ~/neo

wget https://github.com/intel/compute-runtime/releases/download/19.07.12410/intel-gmmlib_18.4.1_amd64.deb
wget https://github.com/intel/compute-runtime/releases/download/19.07.12410/intel-igc-core_18.50.1270_amd64.deb
wget https://github.com/intel/compute-runtime/releases/download/19.07.12410/intel-igc-opencl_18.50.1270_amd64.deb
wget https://github.com/intel/compute-runtime/releases/download/19.07.12410/intel-opencl_19.07.12410_amd64.deb
wget https://github.com/intel/compute-runtime/releases/download/19.07.12410/intel-ocloc_19.07.12410_amd64.deb
```

#### 3. Instalirajte Intel OpenCL Runtime

```bash
sudo dpkg -i *.deb
```

Ako se pojave pogreške ovisnosti:

```bash
sudo apt --fix-broken install
```

#### 4. Instalirajte OpenCL ICD učitavač

```bash
sudo apt update
sudo apt install intel-opencl-icd
```

Ako se pojave pogreške:

```bash
sudo apt --fix-broken install
sudo apt install intel-opencl-icd
```

#### 5. Provjerite instalaciju OpenCL-a

```bash
sudo clinfo
```

Trebali biste vidjeti podatke o svojoj OpenCL platformi i uređajima. Potražite:
- Broj platformi: 1 (ili više)
- Naziv platforme: Intel(R) OpenCL (ili slično)
- Vrstu uređaja: GPU ili CPU

#### 6. Ponovno pokrenite računalo

```bash
sudo reboot
```

### OpenCL na AMD GPU-u

Za AMD GPU instalirajte ROCm:

```bash
# Add ROCm repository
wget -q -O - https://repo.radeon.com/rocm/rocm.gpg.key | sudo apt-key add -
echo 'deb [arch=amd64] https://repo.radeon.com/rocm/apt/debian/ ubuntu main' | sudo tee /etc/apt/sources.list.d/rocm.list

# Install ROCm
sudo apt update
sudo apt install rocm-opencl rocm-clinfo

# Add user to video group
sudo usermod -a -G video $USER

# Reboot
sudo reboot

# Verify
clinfo
```

### OpenCL na NVIDIA GPU-u

Za NVIDIA GPU instalirajte CUDA-u:

```bash
# Install NVIDIA drivers
sudo apt install nvidia-driver-525

# Install CUDA toolkit
wget https://developer.download.nvidia.com/compute/cuda/repos/ubuntu2204/x86_64/cuda-keyring_1.0-1_all.deb
sudo dpkg -i cuda-keyring_1.0-1_all.deb
sudo apt update
sudo apt install cuda

# Reboot
sudo reboot

# Verify
nvidia-smi
clinfo
```

---

## Instalacija PhantomSDR-Plusa

### Kloniranje repozitorija, izvršne skripte, pokretanje instalacije

```bash
cd ~
git clone --recursive https://github.com/sv1btl/PhantomSDR-Plus
cd PhantomSDR-Plus
chmod +x *.sh
./install.sh
```

**⚠️ VAŽNO:** kada instalacija završi, **ponovno pokrenite terminal** — tek tada su novoinstalirani Node.js i Rust u vašem `PATH`-u.

> **Već vam radi PhantomSDR-Plus?** Nemojte ga instalirati ponovno — ažurirajte ga. Dohvatite alat za ažuriranje jednom i pokrenite ga; vaša konfiguracija, oznake, administratorska lozinka, popis frekvencija i povijest razgovora nikada se ne diraju, a ono što ste sami mijenjali predočava vam se umjesto da bude prepisano:
>
> ```bash
> cd ~/PhantomSDR-Plus
> curl -fLO https://raw.githubusercontent.com/sv1btl/PhantomSDR-Plus/main/update.sh
> chmod +x update.sh
> ./update.sh
> ```
>
> Posljednji redak samo *prijavljuje* što bi se promijenilo i ništa ne zapisuje; `./update.sh --apply` to i obavi. Pojedinosti su u poglavlju *Ažuriranje PhantomSDR-Plusa*. Ponovno pokretanje instalacijske skripte na postaji koja radi potrebno je jedino ako izgradnja padne zbog nedostajućih sistemskih paketa.

Uzmite skriptu koja odgovara vašem sustavu. Sve rade isti posao i postavljaju ista pitanja; razlikuje se samo upravitelj paketa:

| Sustav | Skripta |
|---|---|
| Ubuntu 22.04 / 24.04 / 26.04, Debian 12 / 13 | `./install.sh` |
| Fedora | `./install_fedora.sh` |
| Arch | `./install_arch.sh` |
| openSUSE Tumbleweed | `./install_opensuse.sh` |

> **Jedan instalacijski program za svako izdanje Debiana i Ubuntua.** `install.sh` čita `/etc/os-release` i instaliranu inačicu Boosta te se sam prilagođava; stari `install_ubuntu22.sh`, `install-Deb12.sh` i `install_ubuntu26.sh` više ne postoje. Postavlja `DEBIAN_FRONTEND=noninteractive`, kako `tzdata` koji stiže uz `python3-matplotlib` ne bi mogao zaustaviti izvođenje pitanjem o vašoj vremenskoj zoni, a zatim progutati odgovor namijenjen sljedećem pitanju. Na Jammyju izravno poziva `install_rade_ubuntu22.sh`, jer je Jammyjev `python3-websockets` 10.1, a RADE traži 11.0 ili noviji. Zna gdje se `intel-opencl-icd` nalazi na svakom izdanju: u repozitorijima na 22.04 i 26.04, u `non-free` na Debianu 12 te u Intelovu vlastitom grafičkom repozitoriju na 24.04 i Debianu 13. A ondje gdje je Boost 1.87 ili noviji, zakrpa websocketpp zaglavlja prestaje biti neobavezna — instalacijski program provjerava da je primijenjena i bez nje odbija graditi. Noviji prevoditelj nikada nije potreban: tvornički GCC prihvaća `-std=c++23` na svih pet izdanja, pa zbog toga nemojte instalirati `gcc-12`.

Instalacija teče u 17 jasno numeriranih koraka, a svaka točka na kojoj se čeka na vas uokvirena je natpisom **⌨️  POTREBAN JE VAŠ UNOS**, tako da se pitanje ne može zamijeniti s ispisom koji promiče. Sedam pitanja navedeno je odmah na početku, prije nego što se išta instalira. `PHANTOM_NONINTERACTIVE=1` odgovara na sva njihovim zadanim vrijednostima; pogledajte zaglavlje `install.sh` za varijable `PHANTOM_*`.

**Svako pokretanje zapisuje `install.txt`.** Kada instalacijski program završi — ili prekine na pola puta — zapisuje izvještaj u `install.txt` u mapi PhantomSDR-Plus: rezultat, svaki od 17 koraka kao OK / SKIPPED / PARTIAL / FAILED, što je otkrio (distribuciju, Boost, prevoditelj, Node.js), koje su komponente instalirane i svako upozorenje koje se pojavilo. Neuspjelo pokretanje ostavlja izvještaj koji završava na koraku koji je pao, s razlogom i napomenom da se instalacijski program smije sigurno ponovno pokrenuti. To je prva datoteka koju treba pročitati kada nešto nije uspjelo i prva koju treba priložiti prijavi greške. Svako pokretanje je prepisuje, pa sačuvajte kopiju ako želite usporediti dvije instalacije.

> **Ubuntu 26.04, Arch i openSUSE Tumbleweed se prevode, ali nisu isprobani u stvarnom radu.** Sva tri donose Boost noviji od 1.87, koji je uklonio `io_service` API za koji je pisan ugrađeni websocketpp 0.8.2. Zakrpana zaglavlja koja instalacijski program kopira premošćuju taj jaz (`io_context`, `executor_work_guard`, `boost::asio::post`, moderni resolver), a ondje gdje je Boost 1.87 ili noviji program tu zakrpu smatra obveznom, a ne neobaveznom — provjerava da su kopije stigle i bez njih odbija graditi. Potpuna instalacija, uključujući upravljački program prijamnika i sve neobavezne komponente, provjerena je od početka do kraja u kontejnerima na Boostu 1.90 (Ubuntu 26.04), 1.91 (openSUSE Tumbleweed) i 1.92 (Arch). To dokazuje da se poslužitelj prevodi i pokreće — ne i da satima poslužuje prijamnik. Smatrajte sva tri neprovjerenima u produkciji dok netko ne javi.

> **openSUSE ovdje znači Tumbleweed.** Ondje je `install_opensuse.sh` provjeren. Leap 15.6 ne radi: u njegovim repozitorijima uopće nema `liquid-dsp-devel` koji poslužitelj treba, a Boost postoji samo pod verzioniranim nazivima paketa. Podrška za Leap značila bi dodavanje vanjskih OBS repozitorija, pa je zasad izvan opsega.

### Što instalacijska skripta radi

Ništa se ne mora pripremati ručno unaprijed — nema popisa paketa za kopiranje, nema Node.js-a za dohvaćanje, nema traženja OpenCL paketa. Teče u 19 numeriranih koraka i zaustavlja se uz najviše deset pitanja, svako uokvireno natpisom „POTREBAN JE VAŠ UNOS" — pa ili ostanite za tipkovnicom ili postavite `PHANTOM_NONINTERACTIVE=1` i pustite ga da na sve odgovori zadanim vrijednostima (vidi niže), a računajte na dvadesetak minuta do znatno više od sat vremena, ovisno o stroju i o tome koliko dodataka zadržite.

| # | Korak | Što vas pita |
|---|---|---|
| 1 | Popisuje PhantomSDR-Plus servise koji su trenutačno pokrenuti — administratorska ploča, obrnuti proxy, poslužitelj statistike, prijamnik — i nudi da ih zaustavi prije nego što išta dirne. Kao prijamnik računa se samo pokrenuta skripta za pokretanje; ona koja je samo otvorena u uređivaču ostaje netaknuta. | potvrda, **zadano da** |
| 2–6 | Prepoznaje distribuciju i instalira sve ovisnosti za građenje (prevoditelj, meson/ninja, FFTW, Boost, FLAC, Opus, liquid-dsp, zlib/zstd, libcurl …), uz Node.js 22 preko nvm-a ako ga sustav nema ili je prestar | ništa |
| 7 | Gradi backend pomoću mesona | ništa |
| 8 | Gradi upravljački program za vaš prijamnik — RX888 MkII / RX888, RTL-SDR (Blog V4 se pita zasebno), SDRplay RSP1A, RigExpert Fobos SDR, Airspy HF+, HackRF One ili nijedan. Uz RX888 **instalira i udev pravila**, pa poslužitelju nikad ne treba `sudo` za uređaj. RSP1A, Fobos i Airspy HF+ rade preko SoapySDR-a: njihov izbor pokreće `setup-rsp1a.sh`, `setup-fobos.sh` ili `setup-airspyhf.sh`, koji grade upravljački program i `rx_sdr` te također instaliraju udev pravilo (vidi [Prijamnici preko SoapySDR-a (RSP1A, Fobos, Airspy HF+)](#prijamnici-preko-soapysdr-a-rsp1a-fobos-airspy-hf)) HackRF One ne treba SoapySDR: njegov izbor pokreće `setup-hackrf.sh`, koji instalira paket `hackrf` iz distribucije i udev pravilo. | koji SDR imate |
| 9 | Otvara `frontend/site_information.json` u vašem uređivaču | pozivni znak, lokator, oprema, antena — **nemojte preskočiti** |
| 10–11 | Instalira ovisnosti frontenda i gradi stranice za računalo i `/mobile` | ništa |
| 12 | Instalira OpenCL i bira pružatelja prema pronađenom hardveru (Intel / AMD / NVIDIA GPU ili x86 CPU runtime). Ako nema uređaja s podrškom, to kaže i nastavlja dalje | potvrda, zadano da |
| 13–15 | Instalira **administratorsku ploču**, **FreeDV RADE V1 dekoder** i **poslužitelj statistike** — sva tri prema zadanome | potvrda za svaki, zadano da; svaki ima svoja pitanja |
| 16 | Ponovno primjenjuje pet zakrpanih websocketpp zaglavlja preko meson podprojekta i provjerava da su stigla. Tri od njih su rad na kompatibilnosti s Boostom ≥ 1.87, bez kojega se backend ne prevodi na Boostu 1.90; druga dva su vlastite izmjene projekta, od kojih je jedna ispravak koji treba registracija na websdr.org | ništa |
| 17 | Instalira **emulaciju KiwiSDR klijenata** pokretanjem `kiwi_install.sh`, kako bi se Kiwi klijenti poput AetherSDR-a mogli spojiti na ovaj prijamnik. Zakrpava izvore i dodaje `[kiwi_emulation]` u konfiguracijske datoteke u korijenu repozitorija — vidi [Emulacija KiwiSDR klijenata](Aether_config.md) | potvrda, zadano da |
| 18 | Pokreće `recompile.sh`, da se sve izgradi iz zakrpanih izvora | `[3] Both backend and frontend` → početna varijanta → `[1] build-all.sh` |
| 19 | Ispisuje sažetak: svaki korak s ishodom i svaku komponentu s time što je instalirano | ništa |

#### Instalacija bez nadzora

Svako pitanje ima varijablu okoline koja ga nadjačava, a instalacijski program i sam prelazi na zadane vrijednosti kada stdin nije terminal (cijev, kontejner, CI posao). Jednako vrijedi za sva četiri: `install.sh`, `install_arch.sh`, `install_fedora.sh` i `install_opensuse.sh`. Postavite `PHANTOM_NONINTERACTIVE=1` i cijelo se izvođenje dovrši bez ijednog pitanja:

| Varijabla | Učinak |
|---|---|
| `PHANTOM_NONINTERACTIVE=1` | answer every question with its default |
| `PHANTOM_SDR=1…7` | RX888 · RTL-SDR · SDRplay RSP1A · skip · Fobos · Airspy HF+ · HackRF (default 4) |
| `PHANTOM_RTLSDR_V4=y\|n` | RTL-SDR Blog V4 driver (default n) |
| `PHANTOM_SITE_EDIT=y\|n` | open `site_information.json` in an editor |
| `PHANTOM_OPENCL=y\|n` | install OpenCL (default y) |
| `PHANTOM_OPENCL_PROVIDER=1\|2\|3` | Intel · Mesa/Rusticl · POCL (default: from the detected hardware) |
| `PHANTOM_ADMIN=y\|n` | admin panel (y interactive, n unattended) |
| `PHANTOM_RADE=y\|n` | RADE / FreeDV (y interactive, n unattended) |
| `PHANTOM_STATS=y\|n` | statistics server (y interactive, n unattended) |
| `PHANTOM_KIWI=y\|n` | KiwiSDR client emulation (default y) |
| `PHANTOM_RECOMPILE=y\|n` | final rebuild (default y) |
| `PHANTOM_CURLPP=y\|n` | nastavi bez curlpp-a — samo Arch i openSUSE (zadano y) |
| `PHANTOM_FIX_CLOCK_SKEW=y\|n` | poništi vremenske oznake izvornih datoteka datirane u budućnost, kako bi meson mogao graditi (zadano y) |

Tri pod-instalacijska programa označena s *n bez nadzora* i sami su interaktivni, pa ih izvođenje bez nadzora preskače umjesto da zapne na njihovim pitanjima. Navedite ih izrijekom da bi bili uključeni:

```bash
# a complete unattended install for an RX888 MkII
PHANTOM_NONINTERACTIVE=1 PHANTOM_SDR=1 ./install.sh

# ... and with the admin panel, RADE and the statistics server too
PHANTOM_NONINTERACTIVE=1 PHANTOM_SDR=1 \
  PHANTOM_ADMIN=y PHANTOM_RADE=y PHANTOM_STATS=y ./install.sh
```

Nakon ponovnog pokretanja udev pravila za RX888 i eventualni OpenCL upravljački program potpuno su na snazi; skripta vam kaže kada je potrebno ponovno pokretanje ili ponovna prijava.

Pri postavljanju administratorske ploče instalater nudi i dvije systemd jedinice te **snažno preporučuje** da ih prihvatite: zaštita od pregrijavanja procesora radi unutar ploče, pa bez njih ponovno dizanje sustava ili pad ostavljaju računalo nezaštićenim. Korak se automatski preskače ondje gdje systemd ne radi (kontejneri, WSL1, OpenRC) — vidi [vodič za ploču](ADMIN_PANEL_SETUP.md).

Svaki je dodatak obična skripta koju možete pokrenuti i zasebno, kad god želite — `./setup_admin.sh` ([priručnik](ADMIN_PANEL_SETUP.md)), `./install_rade.sh` ([priručnik](RADE_README.md)), `./install-stats-server.sh` ([priručnik](sdr-stats/README.md)), `./setup-rx888-udev.sh` i skripte prijamnika `./setup-rsp1a.sh`, `./setup-fobos.sh`, `./setup-airspyhf.sh` i `./setup-hackrf.sh` — upravo njih poziva instalacijska skripta.

### Ručno građenje (referenca)

> [!IMPORTANT]
> **Za normalnu instalaciju ovaj odjeljak vam ne treba.** `./install.sh` — ili instalacijska skripta vaše distribucije — sve to obavlja umjesto vas; vidi [Što instalacijska skripta radi](#što-instalacijska-skripta-radi). Ovo je referenca za ručno postavljanje, za distribuciju koju nijedna skripta ne pokriva ili za ručni popravak pojedinog dijela.

Ako ikad budete morali graditi bez instalacijske skripte — distribucija koju skripte ne pokrivaju ili popravak nedovršenog builda:

#### Izgradnja backenda

```bash
# Clean any previous builds, Configure build with optimization, Compile
rm -rf build
meson setup build --buildtype=release --optimization=3
meson compile -C build

# Verify binary was created
ls -lh build/spectrumserver
```

#### Izgradnja frontenda

```bash
cd frontend

# Install dependencies, Fix any vulnerabilities, Build the frontend
npm install
npm audit fix
npm run build

# Return to project root
cd ..
```

### Provjerite instalaciju

```bash
# Check if binary exists
ls -lh build/spectrumserver

# Check if frontend was built
ls -lh frontend/dist/

# List important files
ls -lh *.sh *.toml
```

---

## Instalacija audiokodeka Opus

> [!IMPORTANT]
> **Za normalnu instalaciju ovaj odjeljak vam ne treba.** `./install.sh` — ili instalacijska skripta vaše distribucije — sve to obavlja umjesto vas; vidi [Što instalacijska skripta radi](#što-instalacijska-skripta-radi). Ovo je referenca za ručno postavljanje, za distribuciju koju nijedna skripta ne pokriva ili za ručni popravak pojedinog dijela.


Opus daje bolju kvalitetu zvuka i manju latenciju od FLAC-a.

### 1. Instalirajte sistemsku biblioteku libopus

```bash
sudo apt-get update
sudo apt-get install -y libopus0 libopus-dev
```

### 2. Instalirajte Opus dekoder za sučelje

```bash
cd PhantomSDR-Plus/frontend

# Install npm dependencies if not already done, Install Opus WASM decoder, Fix any vulnerabilities, Rebuild frontend
npm install
npm install @wasm-audio-decoders/opus-ml
npm audit fix
npm run build

# Return to project root
cd ..
```

### 3. Provjerite instalaciju Opusa

```bash
# Check if Opus system library is installed
pkg-config --modversion opus

# Check if Opus npm package is installed
cd frontend
npm list @wasm-audio-decoders/opus-ml
cd ..
```

---

## Autorun Spot Reporter (FT8/FT4/WSPR)

PhantomSDR-Plus dolazi s neobaveznim **autorun spot reporterom** (u direktoriju `autorun/`). Dekodira FT8/FT4/WSPR na poslužiteljskoj strani izravno s prijamnika i šalje spotove u mreže za prijavu:

- **FT8 / FT4 → PSK Reporter** (IPFIX/UDP)
- **WSPR → wsprnet.org** (HTTP)

Upravlja se u cijelosti s kartice **administratorska ploča → „Spot Reporting"**, a **prijavljivanje je prema zadanom ISKLJUČENO** — ništa se ne odašilje ni ne šalje dok to ondje ne uključite. Dekoder radi kao zaseban Node.js daemon i lokalno preuzima zvuk prijamnika, pa ne dodaje nikakav dodatni RF hardver.

### Preduvjeti

| Preduvjet | Napomene |
|-----------|----------|
| **Node.js 22+** | Isto radno okruženje koje već treba izgradnja sučelja — instalira se u [koraku Node.js](#instalacija-nodejs-a-i-npm-a). |
| **npm paketi `ws` + `cbor-x`** | Razrješavaju se preko `autorun/node_modules`, simboličke poveznice na `node_modules` sučelja (oba su paketa navedena u `frontend/package.json`). |
| **`util-linux`** (`taskset`) | Gumb „Start" u administraciji veže daemon uz E-jezgre pomoću naredbe `taskset`. Prisutan je u gotovo svakoj distribuciji; instalacijske skripte dodaju ga izričito. |
| **Pozivni znak + lokator** | Čitaju se iz `frontend/site_information.json` (`siteSysop` / `siteGridSquare`), osim ako se ne promijene na administratorskoj kartici. Spotovi se šalju pod tim pozivnim znakom. |

> ⚠️ **Prijavljujte samo ono što doista primate.** Spotovi se šalju u javne mreže pod vašim pozivnim znakom — uključite samo pojaseve/načine rada koje vaš prijamnik stvarno čuje i koristite ispravan lokator.

### Automatska instalacija

`install.sh` (i inačice po distribucijama: `install_arch.sh`, `install_fedora.sh`, `install_opensuse.sh`) obavljaju sve umjesto vas: instaliraju Node.js 22 i `util-linux`, pokreću `npm install` za sučelje i zatim automatski stvaraju simboličku poveznicu `autorun/node_modules`. Nisu potrebni dodatni koraci — značajka je spremna čim `install.sh` završi.

### Ručna instalacija

> [!NOTE]
> Instalacijska skripta to već radi umjesto vas: stvara simbolički link i instalira `util-linux`. Korake u nastavku koristite samo za ručni popravak.

Ako ste instalirali ručno (opcija B), sami stvorite simboličku poveznicu nakon `npm install` za sučelje kako bi daemon mogao razriješiti svoje ovisnosti:

```bash
cd ~/PhantomSDR-Plus

# 1. Frontend deps must be installed first (ws + cbor-x live there)
cd frontend && npm install && cd ..

# 2. Link the autorun daemon to the frontend's node_modules
ln -sfn ../frontend/node_modules autorun/node_modules

# 3. Ensure taskset is available (Debian/Ubuntu shown; use your package manager)
sudo apt install -y util-linux
```

> **Napomena:** `autorun/node_modules` git zanemaruje, pa ga svježi `git clone` nikad ne sadrži — poveznicu treba (ponovno) stvoriti nakon svakog čistog preuzimanja. Instalacijske skripte to rade umjesto vas; gornja naredba odnosi se samo na ručna postavljanja.

### Provjera

```bash
# The symlink should point at ../frontend/node_modules
ls -l autorun/node_modules

# ws + cbor-x must resolve
ls -d frontend/node_modules/ws frontend/node_modules/cbor-x

# taskset must be on PATH
command -v taskset
```

Zatim otvorite administratorsku ploču, idite na karticu **Spot Reporting**, postavite svoj identitet, označite pojaseve/načine rada za dekodiranje, uključite odredišta i pritisnite **Start**. Oznaka „📶 REPORTING" pojavljuje se na glavnom slapu dok je prijavljivanje aktivno. (PSK Reporter šalje skupno svakih 5 minuta, a wsprnet svake 2 minute, pa svježe pokrenut daemon prvih nekoliko minuta pokazuje „0 sent" — to je normalno.)

Zatim se prikazuju dva različita brojača koja je lako zamijeniti. Pločice **SPOTS UPLOADED PER DECODER** broje samo trenutačni rad, pa ih Stop/Start vraća na nulu; broj uz svaki potvrdni okvir pojasa/načina rada je **ukupan** zbroj tog mjesta od početka, spremljen u `autorun-totals.json` pa preživljava ponovna pokretanja. Oboje opisuje [vodič za administratorsku ploču](ADMIN_PANEL_SETUP.md), kao i stranicu **Grafikoni**, koja crta frekvenciju procesora, opterećenje, temperaturu i broj korisnika u rasponu od 15 minuta do 24 sata.

> **Ako vam se stroj grije**, ploča nosi i [toplinsku zaštitu](ADMIN_PANEL_SETUP.md#thermal-guard) koja zaustavlja poslužitelj kada procesor dosegne opasnu temperaturu i pokreće ga ponovno kad se ohladi. Pragove izvodi iz kritičnog praga vašeg vlastitog procesora, pa nema ničega za računati, i radi s bilo kojim načinom pokretanja/zaustavljanja. Instalira se s pločom, ali kreće u načinu samo zapisivanja: bilježi što bi *učinila* i ne mijenja ništa dok je ne uključite u Postavkama. Neprekidno dekodiranje drži procesor zaposlenim danonoćno, pa se isplati pročitati karticu CRASH nakon tjedan dana autoruna i vidjeti koliko vam se stroj zaista približi.

> **Port poslužitelja otkriva se automatski.** Daemon se spaja izravno na `[server] port` samog spectrumservera (petlja + token, zaobilazeći proxy). Taj port čita iz konfiguracijske datoteke s kojom je pokrenut spectrumserver koji radi, pa funkcionira na bilo kojem portu bez konfiguracije — redak `[autorun] tap backend: …` u `autorun.log` pokazuje što je razriješio. Ako vaš poslužitelj nije radio kada je daemon pokrenut ili imate neobičnu postavu, zadajte ga u `autorun.json`:
> ```json
> "server": { "host": "127.0.0.1", "port": 9002 }
> ```
> Pogrešan port očituje se kao `504` / `tap closed 1006` u `autorun.log`, uz `decodes` zaglavljen na 0.

---

## Emulacija KiwiSDR klijenata (neobavezno)

Od v4.1.0 PhantomSDR-Plus može odgovarati i na **KiwiSDR protokol**, pa se softver pisan za KiwiSDR — **AetherSDR**, `kiwiclient` i ostali — spaja izravno na vaš prijamnik, na istom računalu i portu koje već objavljujete. Isključeno je dok se u konfiguraciju s kojom radi vaš prijamnik ne doda `[kiwi_emulation] enabled = true`.

Instalacijski program to nudi kao korak 17; `./kiwi_install.sh` primjenjuje most na već instalirano stablo.

> **Potpuna dokumentacija: [Emulacija KiwiSDR klijenata](Aether_config.md)** — što most radi, kako ga instalirati, svaki ključ iz `[kiwi_emulation]`, spajanje klijenta, razina zvuka, S-metar, brzina slapa i tablica simptoma.

---

## Konfiguracija

### 1. Odaberite konfiguracijsku datoteku

Odaberite odgovarajuću konfiguracijsku datoteku za svoj SDR:

- `config-rtl.toml` – RTL-SDR uređaji
- `config-rsp1a.toml` – SDRplay RSP1A
- `config-airspyhf.toml` – Airspy HF+ Discovery
- `config-fobos-hf.toml` – RigExpert Fobos SDR, HF1/HF2 izravno uzorkovanje (0-25 MHz)
- `config-fobos.toml` – RigExpert Fobos SDR, RF grana (25-6000 MHz)
- `config-rx888mk2.toml` – RX888 MK2
- `config-hackrf.toml` – HackRF One
- `config.example.hackrf.toml` – HackRF One

U ovom primjeru koristit ćemo RTL-SDR.

### 2. Uredite konfiguracijsku datoteku

```bash
nano config-rtl.toml
```

#### Ključne postavke

```toml
[server]
port = 9002                      # Web interface port (or everything else)
html_root = "frontend/dist/"     # Frontend location
otherusers = 1                   # Show other users (1=yes, 0=no)
threads = 2                      # Number of server threads

[websdr]
register_online = true           # Register on sdr-list.xyz (true/false)
name = "Your WebSDR Name"        # Display name
antenna = "Your Antenna Type"    # e.g., "Vertical", "Loop", "Dipole"
grid_locator = "AB12cd"          # Your Maidenhead grid square
hostname = "your.domain.com"     # Your domain or IP address

[input]
sps = 2048000                    # Sample rate (adjust for your coverage)
fft_size = 131072                # FFT size (higher = better resolution)
brightness_offset = -10          # Waterfall brightness adjustment
frequency = 145000000            # Base frequency in Hz (145 MHz for 2m)
signal = "iq"                    # "iq" for complex, "real" for real sampling
fft_threads = 2                  # FFT processing threads
accelerator = "opencl"           # "none", "cuda", or "opencl"
audio_sps = 12000                # Audio sample rate (keep at 12000)
audio_compression = "opus"       # "flac" or "opus"
smeter_offset = -2               # S-meter calibration
waterfall_size = 1024            # Waterfall FFT size
waterfall_compression = "zstd"   # Waterfall compression

[input.driver]
name = "stdin"                   # Input driver
format = "u8"                    # Sample format for RTL-SDR

[input.defaults]
frequency = 145500000            # Default tuning frequency
modulation = "FM"                # Default modulation mode
```

#### Smjernice za frekvenciju uzorkovanja

| Pokrivenost | Frekvencija uzorkovanja | Veličina FFT-a |
|-------------|--------------------------|-----------------|
| 2 MHz | 2048000 | 131072 |
| 3.2 MHz | 3200000 | 131072 |
| 10 MHz | 10000000 | 1048576 |
| 30 MHz | 30000000 | 2097152 |
| 60 MHz | 60000000 | 4194304 |

### 3. Postavite podatke o lokaciji

```bash
nano frontend/site_information.json
```

Uredite sljedeća polja:

```json
{
  "siteSysop": "YourCallsign",
  "siteSysopEmailAddress": "your@email.com",
  "siteGridSquare": "AB12cd",
  "siteCity": "Your City, Country",
  "siteInformation": "https://github.com/sv1btl/PhantomSDR-Plus",
  "siteHardware": "Computer specifications",
  "siteSoftware": "PhantomSDR-Plus v4.2.0",
  "siteReceiver": "Your SDR model",
  "siteAntenna": "Antenna description",
  "siteNote": "Additional information",
  "siteIP": "http://your.domain.com:9002",
  "siteSDRBaseFrequency": 0,
  "siteSDRBandwidth": 2048000,
  "siteRegion": 1,
  "siteChatEnabled": true
}
```

**IARU regije:**
- **1**: Europa, Afrika, Bliski istok, sjeverna Azija
- **2**: Amerike (Sjeverna, Srednja, Južna), Karibi
- **3**: Azija i Pacifik, Oceanija

### 4. Prilagodite frekvencijske oznake (neobavezno)

```bash
nano markers.json
```

Dodajte svoje omiljene frekvencije, repetitore i radiodifuzijske postaje.

### 5. Uredite početnu skriptu

```bash
nano start-rtl.sh
```

Početna skripta samostalan je pokretač s watchdogom. Uredite samo blok **RECEIVER CONFIGURATION** pri vrhu kako bi argumenti prijamnika odgovarali vašoj postavi:

```bash
# ═══ RECEIVER CONFIGURATION (the only receiver-specific part) ═══
RX_LABEL="RTL-SDR"
RX_COMM="rtl_sdr"                       # process name to monitor/kill
CONFIG="$PHANTOMDIR/config-rtl.toml"    # your .toml
FIFO="$PHANTOMDIR/rtl.fifo"
RX_ARGS="${RX_ARGS:--f 145000000 -s 2048000 -}"   # receiver args (edit these)
```

Parametri unutar `RX_ARGS`:
- `-f 145000000`: središnja frekvencija (145 MHz)
- `-s 2048000`: frekvencija uzorkovanja (2,048 MSPS)

`CONFIG` pokazuje na vašu `.toml` datoteku. Ništa drugo u skripti **ne** morate mijenjati — logika pokretanja/ponovnog pokretanja/watchdoga/zapisivanja je općenita. Argumente prijamnika možete zamijeniti i pri pokretanju, bez uređivanja datoteke: `RX_ARGS="-f 145000000 -s 2048000 -" ./start-rtl.sh` (`RX888_ARGS` za `start-rx888mk2.sh`).

---

## Postavljanje ovisno o SDR uređaju

### RTL-SDR

#### Instalirajte RTL-SDR alate

```bash
sudo apt install -y rtl-sdr
```

#### Testirajte RTL-SDR

```bash
rtl_test
```

Pritisnite Ctrl+C za prekid. Trebali biste vidjeti podatke o frekvenciji uzorkovanja.

#### Uredite konfiguraciju

```bash
nano config-rtl.toml
```

Uobičajene postavke za RTL-SDR:
```toml
sps = 2048000
frequency = 145000000
signal = "iq"
format = "u8"
```

### Prijamnici preko SoapySDR-a (RSP1A, Fobos, Airspy HF+)

SDRplay RSP1A, RigExpert Fobos SDR i Airspy HF+ do poslužitelja stižu na isti način: SoapySDR upravljački program za uređaj i `rx_sdr` (iz rx_tools) koji njegove uzorke prosljeđuje `spectrumserver`-u. Jedna skripta po prijamniku instalira cijeli lanac:

| Prijamnik | Skripta | Opcija instalacije | Skripta za pokretanje | Konfiguracija |
|---|---|---|---|---|
| SDRplay RSP1A | `./setup-rsp1a.sh` | 3 | `start-rsp1a.sh` | `config-rsp1a.toml` |
| RigExpert Fobos SDR | `./setup-fobos.sh` | 5 | `start-fobos-hf.sh` (HF) / `start-fobos.sh` (RF) | `config-fobos-hf.toml` / `config-fobos.toml` |
| Airspy HF+ | `./setup-airspyhf.sh` | 6 | `start-airspyhf.sh` | `config-airspyhf.toml` |

Svaka skripta:

- instalira git, cmake, prevoditelj, libusb i **SoapySDR** iz paketa vaše distribucije — prepoznaje apt, dnf, pacman i zypper, pa jednako radi na Debianu/Ubuntuu, Fedori, Archu i openSUSE-u;
- gradi upravljački program prijamnika iz izvornog koda u `sdr_drivers/` (git ga ne prati);
- gradi **rx_tools** za `rx_sdr`, osim ako je `rx_sdr` već instaliran — jedna kopija služi svim prijamnicima;
- instalira **udev pravilo** i dodaje vas u grupu `plugdev`, pa skripti za pokretanje nikad ne treba `sudo` za uređaj. **Jednom se odjavite i ponovno prijavite** da grupa počne vrijediti;
- na kraju provjerava da SoapySDR stvarno navodi upravljački program, a ako ne, zaustavlja se s greškom.

Pokrenite ih kao običan korisnik — same pozivaju `sudo`. Idempotentne su: ponovno pokretanje ažurira izvorni kod upravljačkog programa s `git pull` i ponovno gradi. Instalacijska skripta poziva upravo te skripte; na već instaliranoj stanici pokrenite zasebno onu za svoj prijamnik. Zajednički dio nalazi se u `setup-sdr-common.sh`, koja se ne pokreće sama. Dvije neobavezne varijable vrijede za sve tri: `SDR_USER=<ime>` stavlja drugi račun u `plugdev`, a `SDR_SKIP_DEPS=1` preskače instalaciju paketa.

S priključenim uređajem provjerite da je prijamnik pronađen:

```bash
SoapySDRUtil --find="driver=soapyMiri"   # RSP1A
SoapySDRUtil --find="driver=fobos"       # Fobos
SoapySDRUtil --find="driver=airspyhf"    # Airspy HF+
```

#### SDRplay RSP1A

`setup-rsp1a.sh` instalira **upravljački program otvorenog koda**: libmirisdr-5, upravljački program nastao obrnutim inženjeringom za Mirics čipove MSi2500/MSi001 u RSP1 i RSP1A, s njegovim SoapySDR modulom SoapyMiri (`driver=soapyMiri`). Ne treba mu pozadinska usluga ni root. Skripta također stavlja na crnu listu upravljačke programe jezgre `msi2500` i `msi001` u `/etc/modprobe.d/blacklist-msi2500.conf`, jer oni zauzmu RSP1A kao V4L2 radio prije nego što ga `rx_sdr` može otvoriti. Ako je uređaj bio priključen dok su bili učitani, jednom ga iskopčajte i ponovno ukopčajte (ili ponovno pokrenite računalo).

Zatvoreni SDRplay API (`driver=sdrplay`, sa SoapySDRPlay i uslugom `sdrplay`) i dalje radi — priložena datoteka `instructions-for-rsp1a` opisuje tu instalaciju. `start-rsp1a.sh` sam bira između njih: ako SoapySDR ima upravljački program `sdrplay`, koristi API i prije toga ponovno pokreće uslugu `sdrplay`, a inače koristi libmirisdr-5. Stanica postavljena na API tako nastavlja raditi bez promjena. Da nametnete jedan, pokrenite s `RX_DRIVER=miri` ili `RX_DRIVER=sdrplay`. Odabrani upravljački program upisuje se u `logwebsdr.txt` kao `RSP1A driver: miri` ili `RSP1A driver: sdrplay`.

#### RigExpert Fobos SDR

Fobos šalje **samo jednu granu odjednom**, pa ima dvije skripte za pokretanje koje dijele zaključavanje watchdoga kao svaka `start-*.sh` — pokretanje jedne zaustavlja drugu:

- **`start-fobos-hf.sh`** — ulazi HF1/HF2 u izravnom uzorkovanju, 0-25 MHz, na portu 9003. U tom načinu rada nema lokalnog oscilatora: ADC neprestano digitalizira 0-25 MHz (`-f 0` je namjerno, a upozorenje *Failed to set center freq* iz rx_sdr je očekivano). `rx_sdr` daje CF32 na 50 Msps; mali pretvarač `cf32_to_real` (gradi ga `setup-fobos.sh` iz `cf32_to_real.c`) zadržava kanal I i skalira ga na s16, pa `config-fobos-hf.toml` koristi `signal="real"` i `format="s16"`.
- **`start-fobos.sh`** — RF grana, 25-6000 MHz, IQ, na portu 9002. Odaberite prozor prije prvog pokretanja: `-f` (središte) i `-s` (brzina uzorkovanja) u retku `RX_ARGS` moraju odgovarati `frequency=` i `sps=` u `config-fobos.toml`. Isporučene vrijednosti (97 MHz, 20 Msps) samo su polazište za provjeru da radi.

> [!IMPORTANT]
> `config-fobos-hf.toml` dolazi s `accelerator="opencl"`: tok od 50 Msps kroz FFT od 1M binova težak je kao 60 Msps RX888, a na CPU-u gubi uzorke i grije računalo. Na računalu bez OpenCL uređaja `spectrumserver` se s tom postavkom ne pokreće — ondje postavite `accelerator="none"`.

SoapyFobosSDR za izgradnju treba zaglavlja i od libfobos i od libfobos-sdr-agile, pa `setup-fobos.sh` gradi oboje, čak i za standardni firmware. Podrška za Fobos potječe iz skripte koju je napisala druga stanica nakon što je pokrenula Fobos na PhantomSDR-Plus; HF vrijednosti u `config-fobos-hf.toml` su one koje su ondje radile.

#### Airspy HF+

`setup-airspyhf.sh` instalira libairspyhf iz distribucije gdje je zapakirana (Debian i Ubuntu, Fedora, openSUSE), a gradi je iz izvornog koda gdje nije (Arch je ima samo u AUR-u), zatim gradi SoapyAirspyHF (`driver=airspyhf`). `start-airspyhf.sh` daje 912 ksps IQ u CS16, što `config-airspyhf.toml` čita kao `format="s16"`. Priložena datoteka `instructions-for-airspy` opisuje ručni put.

### RX888 MK2

#### Instalirajte RX888 alate

```bash
# Install rx_tools
git clone https://github.com/rxseger/rx_tools.git
cd rx_tools
mkdir build && cd build
cmake ..
make -j4
sudo make install
sudo ldconfig

# Install RX888 firmware and support
# Follow manufacturer instructions
```

#### Pokretanje rx888_stream bez sudo (udev pravila)

Prema zadanom, USB uređaj Cypress FX3 na RX-888 dostupan je samo rootu, pa bi `rx888_stream` trebao `sudo`. Pokrenite jednom priloženi pomoćni skript kako biste instalirali udev pravila i dodali se u grupu `plugdev`:

```bash
./setup-rx888-udev.sh          # re-runs itself with sudo automatically
```

Skripta zapisuje `/etc/udev/rules.d/99-rx888.rules` za sva tri identifikatora proizvoda Cypress FX3 (`04b4:00f1`/`00f3` bootloader i `04b4:8613` s učitanim firmverom), ponovno učitava udev i stvara stabilnu poveznicu `/dev/rx888`. **Odjavite se i ponovno prijavite** (zbog promjene grupe) i jednom **ponovno priključite uređaj**; nakon toga `rx888_stream` — i pokretač `start-rx888mk2.sh` — rade bez `sudo`. Skripta je idempotentna pa ju je sigurno ponovno pokrenuti. Za drugi korisnički račun: `RX888_USER=<ime> ./setup-rx888-udev.sh`.

#### Uredite konfiguraciju

```bash
nano config-rx888mk2.toml
```

Uobičajene postavke za RX888:
```toml
sps = 60000000
frequency = 0
signal = "real"
format = "s16"
fft_size = 4194304
```

### HackRF One

Za HackRF ništa se ne gradi: `hackrf_transfer` iz paketa `hackrf` vaše distribucije prosljeđuje uzorke izravno `spectrumserver`-u. `./setup-hackrf.sh` (opcija 7 instalacije) instalira taj paket s apt, dnf, pacman ili zypper te dodaje udev pravilo i grupu `plugdev`, pa `start-hackrf.sh` radi bez `sudo` — nakon toga se jednom odjavite i ponovno prijavite.

```bash
./setup-hackrf.sh    # installs the hackrf package and the udev rule
hackrf_info          # with the HackRF plugged in: must list the board
```

`start-hackrf.sh` šalje jedan prozor odjednom. Odaberite ga prije prvog pokretanja: `-f` (središte) i `-s` (brzina uzorkovanja) u njegovu retku `RX_ARGS` moraju odgovarati `frequency=` i `sps=` u `config-hackrf.toml`. `-l` i `-g` su pojačanja LNA (0-40 dB, koraci od 8 dB) i VGA (0-62 dB, koraci od 2 dB), a `-a 1` uključuje RF pojačalo. Isporučene vrijednosti (98 MHz, 20 Msps) samo su polazište za provjeru da radi.

`hackrf_transfer` piše 8-bitni IQ **s predznakom**, pa konfiguracija treba `format="s8"`. `config.example.hackrf.toml` je do rujna 2026. imao `u8`; s `u8` svaki je uzorak pomaknut za 128 i vodopad pokazuje samo šum — provjerite svaku stariju kopiju.

---

## Testiranje i provjera

### 1. Probno pokretanje

```bash
# For RTL-SDR
./start-rtl.sh
```

Time se poslužitelj pokreće **u pozadini** (odvaja se i odmah vraća upravljanje) i počinje zapisivati u `logwebsdr.txt`.

### 2. Provjerite ima li pogrešaka

Skripta bilježi napredak u `logwebsdr.txt` — pratite ga uživo:

```bash
tail -f logwebsdr.txt
```

Potražite:
- ✅ `Starting the initialization script of the PhantomSDR Server`
- ✅ `<receiver> running (PID …)`
- ✅ `Server started normally`
- ❌ `Server … FAILED …` ili `ERROR: receiver binary '…' not found` (ispravite argumente prijamnika ili `.toml`, ili instalirajte alat prijamnika, pa ponovno pokrenite skriptu)

### 3. Pristupite web-sučelju

Otvorite preglednik na:
```
http://localhost:9002
```

(Zamijenite broj porta svojim konfiguriranim portom)

### 4. Provjerite funkcionalnost

- Slap se mora prikazivati
- Zvuk se mora reproducirati pri kliku na signale
- S-metar mora reagirati na signale
- Brojač korisnika mora pokazivati „1"

### 5. Testirajte s drugog uređaja

S drugog računala u svojoj mreži:
```
http://YOUR_SERVER_IP:9002
```

### 6. Provjerite potrošnju resursa

```bash
# Monitor CPU usage
htop

# Monitor GPU usage (if OpenCL/CUDA enabled)
nvidia-smi  # For NVIDIA
radeontop   # For AMD

# Monitor network usage
iftop
```

### 7. Zaustavite poslužitelj

Poslužitelj radi u pozadini pod watchdogom, pa ga **Ctrl+C neće zaustaviti** (a watchdog bi ga ionako ponovno pokrenuo). Koristite zajedničku skriptu za zaustavljanje, koja radi za svaki prijamnik — prvo zaustavlja watchdog, zatim prijamnik i `spectrumserver`:

```bash
./stop-websdr.sh
```

---

## Postavljanje automatskog pokretanja

### Pomoću systemd (preporučeno)

#### 1. Stvorite datoteku usluge

```bash
sudo nano /etc/systemd/system/phantomsdr.service
```

Dodajte sljedeći sadržaj (prilagodite putanje i korisnika):

```ini
[Unit]
Description=PhantomSDR-Plus WebSDR Server
After=network.target

[Service]
Type=simple
User=youruser
WorkingDirectory=/home/youruser/PhantomSDR-Plus
# Run the watchdog in the FOREGROUND (note the --watchdog flag) so systemd can
# track it. Do NOT use the plain "./start-rtl.sh" here — that form detaches into
# the background and exits, which systemd would treat as the service stopping.
ExecStart=/home/youruser/PhantomSDR-Plus/start-rtl.sh --watchdog
ExecStop=/home/youruser/PhantomSDR-Plus/stop-websdr.sh
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

> Proces `--watchdog` već sam ponovno pokreće prijamnik i `spectrumserver`; `Restart=always` tek je sigurnosna mreža za rijedak slučaj da sam watchdog završi. Budući da ovdje systemd nadzire poslužitelj, umjesto ručnog pokretanja skripti možete koristiti `systemctl start/stop/restart` i `journalctl -u phantomsdr -f`.

#### 2. Omogućite i pokrenite uslugu

```bash
# Reload systemd
sudo systemctl daemon-reload

# Enable service to start on boot
sudo systemctl enable phantomsdr.service

# Start service now
sudo systemctl start phantomsdr.service

# Check status
sudo systemctl status phantomsdr.service
```

#### 3. Upravljanje uslugom

```bash
# Start
sudo systemctl start phantomsdr

# Stop
sudo systemctl stop phantomsdr

# Restart
sudo systemctl restart phantomsdr

# View logs
sudo journalctl -u phantomsdr -f
```

### Pomoću Screena (alternativa)

> Obično nepotrebno: `./start-rtl.sh` već se odvaja u pozadinu (putem `setsid`) i nastavlja raditi nakon odjave, s vlastitim watchdogom. Screen je koristan samo ako izričito želite interaktivnu sesiju za pokretanje inačice u prednjem planu `./start-rtl.sh --watchdog`.

#### 1. Instalirajte Screen

```bash
sudo apt install -y screen
```

#### 2. Pokrenite u Screen sesiji

```bash
screen -S phantomsdr
./start-rtl.sh
```

Pritisnite Ctrl+A, zatim D za odvajanje.

#### 3. Vratite se u sesiju

```bash
screen -r phantomsdr
```

---

## Toplinska zaštita procesora

> 📖 **Cjeloviti priručnik: [THERMAL_GUARD.md](THERMAL_GUARD.md)** — četiri načina rada i što sysop mora učiniti u svakome, rad bez ploče, throttle faza bez roota, testiranje i rješavanje problema.

PhantomSDR-Plus donosi čuvara koji zaustavlja poslužitelj ako procesor dosegne opasnu temperaturu i pokreće ga ponovno kad se ohladi. Pragove izvodi iz kritičnog praga koji objavljuje vaš vlastiti procesor, pa nema ničega za računati, i radi s bilo kojim načinom pokretanja/zaustavljanja.

**Ako koristite administratorsku ploču, već ga imate** — radi unutar ploče i podešava se na njezinoj stranici Postavke. Vidi [vodič za administratorsku ploču](ADMIN_PANEL_SETUP.md#thermal-guard). Ostatak ovog odjeljka odnosi se na instalacije **bez** ploče.

### 1. Provjerite što čuvar vidi na vašem stroju

```bash
cd ~/PhantomSDR-Plus
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

Koriste se samo pravi senzori na procesoru (`coretemp`, `k10temp`, `zenpower`, `cpu_thermal`); `acpitz` i neoznačene toplinske zone namjerno se zanemaruju jer često prijavljuju temperaturu kućišta ili ploče desetke stupnjeva nižu od procesora. Ako ispiše `sensor : NONE`, taj se stroj ne može zaštititi — često na VPS-u ili unutar kontejnera — i čuvar će ostati neaktivan umjesto da se pretvara.

Ništa se ne mora instalirati: `thermal_guard.py` koristi samo Pythonovu standardnu biblioteku.

### 2. Podesite ga

Čuvar čita `admin_config.json` uz `thermal_guard.py`. Napravite ga ako ga nemate — bez ploče ga nećete imati. Najmanja korisna datoteka:

```json
{
  "sdr_process_name": "spectrumserver",
  "stop_script":  "stop-websdr.sh",
  "start_script": "start-rx888mk2.sh",
  "thermal_mode": "stop+restart"
}
```

- `thermal_mode` — `log` (samo zapisuje, zadano), `throttle`, `stop` ili `stop+restart`. **To je ono što morate postaviti**, jer se čuvar isporučuje neaktivan: ostavljen takav, samo zapisuje što bi *učinio*. Možete ga zadati i u naredbenom retku kao `--mode stop+restart`, što nadjačava datoteku — ako vam odgovaraju sve ostale zadane vrijednosti, konfiguracijska datoteka uopće vam ne treba.
- `stop_script` / `start_script` — kako zaustavlja i pokreće vaš poslužitelj. Bez skripte za zaustavljanje pribjegava `SIGTERM`-u, pa nakon 10 sekundi `SIGKILL`-u nad `sdr_process_name`. Bez skripte za pokretanje zaustavlja, ali nikad ne pokreće ponovno.
- Pragovi i vremena mogu se postaviti i ovdje, s istim nazivima ključeva koje koristi ploča — cijela je tablica u [vodiču za administratorsku ploču](ADMIN_PANEL_SETUP.md#thermal-guard).

> **Ako vaš SDR poslužitelj nadzire systemd**, neka `stop_script` pokazuje na malu skriptu koja izvodi `systemctl stop vasa-jedinica`, umjesto da čuvar signalizira proces izravno. Čuvar će pobijediti u svakom slučaju — dok je procesor prevruć, ponavlja zaustavljanje svake 2 sekunde, pa je sve što oživi poslužitelj poništeno — ali čisto zaustavljanje bolje je od borbe svake dvije sekunde.

### 3. Pokrenite ga kao uslugu

Repozitorij sadrži gotovu jedinicu, `thermal-guard.service`. U njoj uredite `User=` i dvije putanje, a zatim:

```bash
sudo cp thermal-guard.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now thermal-guard
systemctl status thermal-guard
```

`User=` mora biti račun kojem je dopušteno pokretati vaše skripte za pokretanje/zaustavljanje — obično isti korisnik koji pokreće SDR poslužitelj. **Čuvar koji radi kao korisnik koji ne može zaustaviti poslužitelj ostavlja vas nezaštićenima, a izgleda kao da vas štiti.**

Da čuvara naoružate iz jedinice umjesto iz konfiguracijske datoteke, dodajte `--mode` u `ExecStart`:

```ini
ExecStart=/usr/bin/python3 -u /home/sysop/PhantomSDR-Plus/thermal_guard.py --mode stop+restart
```

Bez systemd-a:

```bash
cd ~/PhantomSDR-Plus
nohup python3 -u thermal_guard.py --mode stop+restart >> thermal.log 2>&1 &
```

`python3 thermal_guard.py --help` navodi sve opcije, uključujući `--config` za konfiguracijsku datoteku koja nije uz skriptu.

### 4. Promatrajte pa vjerujte

Sve što čuvar učini zapisuje se u `crash.log` u direktoriju PhantomSDR-Plus, jedan događaj po retku:

```
[THERMAL] warn: 89.0C (warn=88.0 crit=100.0) sustained 31s
[THERMAL] STOPPED server: 96.0C sustained 62s (stop=95.0 crit=100.0) — Started stop-websdr.sh
[THERMAL] lockout: process reappeared at 94.0C — re-stopped [3 time(s) so far]
[THERMAL] recovered: 74.0C held below 75.0 — lockout cleared
```

```bash
grep THERMAL crash.log
```

Ostavite `thermal_mode` na `"log"` tjedan dana i pročitajte tu datoteku nakon teških trenutaka — potpune ponovne izgradnje, vrućeg poslijepodneva. Ako se ništa ne pojavi, vaš stroj nikada nije ni prišao. Zatim postavite način na `stop`.

Prije nego se pouzdate u njega, dokažite cijeli put jednom lažnim očitanjem iznad svojeg praga zaustavljanja:

```json
"thermal_test_temp": 97
```

Čuvar ga tretira kao stvarnog, pa se warn → stop → zaključavanje → oporavak → ponovno pokretanje odvijaju na zahtjev. Uklonite redak (ili ga postavite na `null`) za povratak na stvarni senzor. S načinom `stop` ovo doista zaustavlja poslužitelj i odspaja vaše slušatelje, pa to učinite kad nikoga nema — ili testirajte u načinu `log`, gdje se vidi što bi se *dogodilo*, bez diranja ičega.

---

## Rješavanje problema

### Pogreške pri izgradnji

#### Problemi s ovisnostima

```bash
# Ubuntu: Install missing dependencies
sudo apt install --fix-broken

# Fedora: Install missing dependencies
sudo dnf install <package-name>
```

#### Neuspjela konfiguracija Mesona

```bash
# Clean and reconfigure
rm -rf build
meson setup build --buildtype=release
```

#### `meson setup` puca uz `ModuleNotFoundError: No module named 'mesonbuild'`

```
Traceback (most recent call last):
  File "/home/<user>/.local/bin/meson", line 3, in <module>
    from mesonbuild.mesonmain import main
ModuleNotFoundError: No module named 'mesonbuild'
```

Izvorni kod nije kriv. Zaostala instalacija preko `pip install --user meson` ostavila je skriptu u `~/.local/bin`, koja na `PATH`-u dolazi prije `/usr/bin` i zato zaklanja ispravnu kopiju koju je instalirao upravitelj paketa. Nadogradnja distribucije (primjerice Ubuntu 24.04 → 26.04) prebacuje Python na novu verziju, stari `site-packages` u kojem je bio `mesonbuild` više nije na putanji uvoza, pa skripta pada prije nego išta napravi. Isto se može dogoditi i `ninji`.

Instalacijska skripta to prepoznaje i zaobilazi za vrijeme trajanja instalacije, uz upozorenje, ali sustav ipak popravite:

```bash
rm -f ~/.local/bin/meson
hash -r
meson --version        # mora ispisati verziju
```

Ako radije želite zadržati meson instaliran preko pipa, ponovno ga instalirajte za Python koji sustav sada ima:

```bash
python3 -m pip install --user --force-reinstall --break-system-packages meson
```

#### `meson setup` staje uz `Clock skew detected`

```
ERROR: Clock skew detected. File /home/pi/PhantomSDR-Plus/build/../meson.build has a time stamp 10392.2144s in the future.
```

S izvornim stablom nije ništa u redu: sistemski sat kasni za datotekama. meson i ninja odbijaju graditi kada je ulazna datoteka novija od trenutnog vremena jer ne mogu znati što je zastarjelo. Događa se na Raspberry Piju bez baterije u RTC ležištu — svako pokretanje kreće od zadnjeg poznatog vremena, pa gradnja pokrenuta prije nego se NTP uskladi vidi cijelo stablo datirano u budućnost — kao i na stablu raspakiranom ili kopiranom sa stroja koji žuri.

Najprije ispravite sat:

```bash
timedatectl                       # je li vrijeme točno? je li NTP usklađen?
sudo timedatectl set-ntp true
```

Pričekajte nekoliko sekundi pa ponovno pokrenite instalater. On to provjerava prije poziva mesona i nudi poništavanje spornih vremenskih oznaka (`PHANTOM_FIX_CLOCK_SKEW=y|n`). Ručno, iz izvornog stabla:

```bash
find . -path ./build -prune -o -path ./.git -prune -o -newermt now -print0 | xargs -0r touch
```

#### Pozadinski dio je izgrađen, ali web-stranice nema

Simptom je instalacija koja izgleda kao da je uglavnom uspjela: `build/spectrumserver` postoji, poslužitelj se pokreće, a preglednik ne dobiva ništa — jer `frontend/dist/` nikada nije proizveden. Potražite u ispisu instalacijskog programa:

```
[vite-plugin-top-level-await] missing field `type`
    at Compiler.printSync (node_modules/@swc/core/index.js:257:29)
error during build:
   ❌ Failed: Default
```

`vite-plugin-top-level-await` traži `@swc/core` `^1.12.14`, pa čisti `npm install` razriješi na 1.16.0, čiji `printSync()` odbija sintaksno stablo koje mu dodatak predaje. To nema veze s vašom distribucijom — svaki instalacijski program sada pribada verziju koja radi, kao i `frontend/package.json`. Stroj postavljen prije tog pribadanja nastavlja raditi dok se njegov `node_modules` ne obriše, zbog čega se ovo pri ponovnoj instalaciji pojavi niotkuda.

Ako starije preuzimanje popravljate ručno:

```bash
cd frontend
npm pkg set 'overrides.@swc/core=1.15.33'
npm install
./build-all.sh
```

### Pogreške pri izvođenju

#### Port je već zauzet

```bash
# Find process using port
sudo lsof -i :9002

# Kill process
sudo kill -9 <PID>
```

#### Pristup SDR-u odbijen

```bash
# Add user to plugdev group
sudo usermod -a -G plugdev $USER

# Reload groups (or log out and back in)
newgrp plugdev
```

Za **RX-888 MkII** to samo po sebi nije dovoljno — uređaj Cypress FX3 traži i udev pravila. Pokrenite priloženi pomoćni skript (instalira pravila *i* dodaje vas u `plugdev`), zatim se odjavite i prijavite te ponovno priključite uređaj:

```bash
./setup-rx888-udev.sh
```

#### Problemi sa zvukom

```bash
# Try different codec
# Edit config file and change:
audio_compression = "flac"  # or "opus"

# Rebuild
cd frontend && npm run build && cd ..
```

### Problemi s OpenCL-om

#### clinfo ne prikazuje uređaje

```bash
# Verify drivers are loaded
sudo clinfo

# Check OpenCL ICD files
ls /etc/OpenCL/vendors/

# Reinstall drivers (Intel example)
sudo apt remove --purge intel-opencl-icd
sudo apt install intel-opencl-icd
```

#### Performanse se nisu poboljšale

```bash
# Verify OpenCL is enabled in config
accelerator = "opencl"

# Try different device
# Add to config file:
[input.opencl]
device_id = 0  # Try 0, 1, 2, etc.
```

### Mrežni problemi

#### Nema pristupa s drugih uređaja

```bash
# Check firewall
sudo ufw status
sudo ufw allow 9002/tcp

# Or disable firewall temporarily for testing
sudo ufw disable
```

#### Velika latencija

```bash
# Reduce waterfall size in config
waterfall_size = 512

# Increase buffer size
buffer_size = 16384

# Use Opus instead of FLAC
audio_compression = "opus"
```

### Problemi sa SDR uređajem

#### RTL-SDR nije pronađen

```bash
# Check if device is recognized
lsusb | grep Realtek

# Test with rtl_test
rtl_test

# Try blacklisting DVB-T drivers
echo "blacklist dvb_usb_rtl28xxu" | sudo tee /etc/modprobe.d/blacklist-rtl.conf
sudo rmmod dvb_usb_rtl28xxu
```

#### SDRplay nije pronađen

`grep "RSP1A driver" logwebsdr.txt` pokazuje koji je upravljački program odabrao `start-rsp1a.sh`.

S otvorenim upravljačkim programom (libmirisdr-5, `RSP1A driver: miri`):

```bash
# The kernel's msi2500 driver must not hold the device
lsmod | grep msi2500 && sudo modprobe -r msi2500 msi001

# Test with SoapySDR
SoapySDRUtil --find="driver=soapyMiri"
```

Sa SDRplay API-jem (`RSP1A driver: sdrplay`):

```bash
# Check API installation
systemctl status sdrplay

# Restart API
sudo systemctl restart sdrplay

# Test with SoapySDR
SoapySDRUtil --find="driver=sdrplay"
```

#### Fobos ili Airspy HF+ nije pronađen

```bash
SoapySDRUtil --info | grep -i factories   # must list fobos / airspyhf
SoapySDRUtil --find="driver=fobos"         # or driver=airspyhf
id | grep plugdev                          # log out and back in if missing
```

Ako upravljačkog programa nema na popisu, ponovno pokrenite `./setup-fobos.sh` ili `./setup-airspyhf.sh`: zaustavlja se i navodi razlog ako izgradnja ili provjera SoapySDR-a ne uspije.

---

## Optimizacija performansi

### Optimizacija procesora

```toml
# Adjust thread counts based on CPU cores
[server]
threads = 4  # Set to number of cores

[input]
fft_threads = 4  # Set to number of cores
```

### Optimizacija memorije

```toml
# Reduce memory usage
[input]
waterfall_size = 512  # Lower value = less memory
fft_size = 65536      # Lower value = less memory
```

### Optimizacija mreže

```toml
# Optimize for limited bandwidth
[input]
audio_compression = "opus"  # More efficient than FLAC
waterfall_compression = "zstd"  # Efficient compression
```

---

## Ažuriranje PhantomSDR-Plusa

Od verzije 4.1.0 repozitorij donosi **`update.sh`**, alat koji instalirani prijamnik dovodi u skladu s objavljenim stablom **bez diranja datoteka koje ga čine vašom postajom**. Zamjenjuje ručno pisanu `git pull` skriptu koju su ranija izdanja ovog priručnika tražila da napišete i git mu uopće nije potreban: objavljeno stablo preuzima se kao tarball i uspoređuje s vašim datoteku po datoteku, pa radi jednako bilo da ste repozitorij klonirali, raspakirali
`update.zip` ili stablo prekopirali s USB stika.

### Ako vaša instalacija još nema update.sh

Starije stablo ne sadrži skriptu. Dohvatite je jednom — to je jedini korak cijelog ovog postupka koji ćete ikada obaviti ručno:

```bash
cd ~/PhantomSDR-Plus
curl -fLO https://raw.githubusercontent.com/sv1btl/PhantomSDR-Plus/main/update.sh
chmod +x update.sh
```

Od tada sve — izvorni kod, frontend, dokumentacija, instalacijske skripte i sam `update.sh` — dolazi preko alata.

### Korak 1 — pogledajte što bi se promijenilo (ništa se ne zapisuje)

```bash
cd ~/PhantomSDR-Plus
./update.sh
```

Preuzima objavljeno stablo, uspoređuje ga s vašim i ispisuje izvještaj. Ne zapisuje baš ništa, pa ga je sigurno pokrenuti u bilo kojem trenutku, i dok je prijamnik u eteru. Izlazni je kod
`0` kada ste ažurni i `10` kada ažuriranje čeka, pa vas cron posao može obavijestiti kada ima
posla.

### Korak 2 — primijenite ga

```bash
./update.sh --apply
```

Tri se vrste datoteka tretiraju različito, i upravo je u toj razlici cijela poanta:

| Datoteke | Što se događa |
|---|---|
| `config*.toml`, `markers.json`, `admin_config.json`, `autorun.json`, `frequencylist/`, `chat_history.txt`, `frontend/variant.json`, `frontend/site_information.json`, zapisnici, `build/`, `frontend/dist/` | **Nikada se ne diraju** niti se ikada pojavljuju u pitanju. Upravo one od stroja čine *vaš* prijamnik. |
| `start-*.sh`, `stop-websdr.sh`, `*.service` jedinice, `install*.sh`, `recompile.sh`, `setup_admin.sh`, `smeter_theme.sh`, `proxy.py`, `admin_server.py`, `thermal_guard.py`, `frontend/src/bands-config.js` | **Uvijek se pita**, jer su to datoteke koje operator s razlogom može biti izmijenio. |
| Sve ostalo | Ažurira se, nakon što se kopija stare datoteke spremi u `.update-backups/`. |

Za svaku datoteku iz srednje skupine prikazuju se razlike i nude tri izbora:

```
  ❓ start-rx888mk2.sh  [K]eep mine / [u]pstream / [b]oth  (ENTER = Keep mine)
```

* **Keep mine** — vaša datoteka ostaje točno onakva kakva jest.
* **upstream** — instalira se nova inačica, a vaša se prethodno sigurnosno pohranjuje.
* **both** — nova se inačica zapisuje uz vašu kao `start-rx888mk2.sh.new`, da svoje izmjene
prenesete kada vam odgovara.

**Kako izgleda prvo pokretanje.** Prvi put ne postoji zapis o tome iz koje inačice potječu
vaše datoteke, pa vam se predočava svaka datoteka iz srednje skupine — desetak pitanja. Odgovarajte ovako:

| Vaša situacija | Odgovor |
|---|---|
| Tu datoteku nikada niste mijenjali | `u` — uzmite novu inačicu. Uobičajen slučaj. |
| Mijenjali ste je (vlastiti `RX888_ARGS`, prikvačivanje na jezgre, prilagođena jedinica) | `b` — vaša ostaje, a nova dolazi uz nju kao `<datoteka>.new`. |
| Niste sigurni | ENTER — vaša ostaje, ništa se ne gubi, usporedit ćete poslije. |

Vaša konfiguracija u tome nikada ne sudjeluje: pitanja se uvijek tiču samo skripti i uslužnih jedinica.

`update.sh` u `.update-state/` bilježi inačicu svake datoteke koju instalira. Već od drugog
pokretanja zato razlikuje datoteku koju ste **vi** mijenjali od one koja je naprosto stara, i zaustavlja se samo kod onih kojih ste se doista dotakli.

Prije nego išta zapiše zaustavlja prijamnik, administratorsku ploču i obrnuti proxy **instalacije koju ažurira** — ono što poslužuje drugi direktorij navodi se i ostavlja raditi, pa se drugi klon može ažurirati dok prvi ostaje u eteru — a na kraju pokreće natrag točno ono što je zaustavio. Ako su se promijenile izvorne ili frontend datoteke, ponudit će da za vas pokrene `recompile.sh`. Ništa se nikada ne briše: datoteke kojih više nema u repozitoriju samo se prijavljuju, a uklanjaju se jedino ako to zatražite s `--prune`.

### Poništavanje ažuriranja

```bash
./update.sh --restore LAST
```

Svaka prepisana datoteka čuva se u `.update-backups/<vremenska oznaka>/` s vlastitim
`restore.sh`; zadržavaju se posljednja tri pokretanja.

### Ostale mogućnosti

```bash
./update.sh --apply --yes     # nikada ne pita; svaka vaša izmijenjena datoteka OSTAJE
./update.sh --ref v4.1.0      # oznaka, grana ili commit umjesto trenutnog stabla
./update.sh --list-excludes   # ispisuje pravila "ne diraj" kako vrijede ovdje
./update.sh --verbose         # nabraja sve datoteke, ne samo prvih 40
```

Vlastita pravila "ne diraj" dodajete tako da u `update-exclude.txt` u korijenskoj mapi instalacije upišete jedan uzorak po retku.

### Ako izgradnja padne na vrlo staroj instalaciji

`update.sh` ažurira datoteke, a ne sistemske pakete. Ako je vaše stablo toliko staro da
izgradnja sada traži biblioteke kojih nemate, `recompile.sh` će stati s greškom prevoditelja ili mesona. To nije pokvareno ažuriranje — nedostaju ovisnosti:

```bash
./install.sh
```

Instalacijska skripta i sama se ažurira istim pokretanjem, a vaša konfiguracija preživljava i nju.

### Ručno ažuriranje

Ako paket datoteka radije primjenjujete sami:

```bash
cd ~
unzip -o update.zip
cd PhantomSDR-Plus
./stop-websdr.sh
cp -a ~/update/. .
chmod +x *.sh
./recompile.sh
./start-rx888mk2.sh          # ili skripta za pokretanje vašeg prijamnika
```

Prvo sigurnosno pohranite svoju konfiguraciju — `config-*.toml`,
`frontend/site_information.json`, `admin_config.json` i `markers.json` — jer paket datoteka ne
može razlikovati vaše izmjene od onih iz izdanja. Upravo taj problem `update.sh` rješava.

---

## Sigurnosna kopija i vraćanje

### Datoteke koje treba sigurnosno kopirati

- Konfiguracijske datoteke: `*.toml`
- Podaci o lokaciji: `frontend/site_information.json`
- Oznake: `markers.json`
- Vlastite skripte: `start-*.sh`, `stop-*.sh`
- Povijest razgovora: `chat_history.txt`
- Pozadinska slika: `frontend/src/assets/background.jpg`

### Naredba za sigurnosnu kopiju

```bash
cd ~/PhantomSDR-Plus
tar -czf phantomsdr-backup-$(date +%Y%m%d).tar.gz \
  *.toml \
  *.sh \
  markers.json \
  chat_history.txt \
  frontend/site_information.json \
  frontend/src/assets/background.jpg
```

### Naredba za vraćanje

```bash
tar -xzf phantomsdr-backup-YYYYMMDD.tar.gz
```

---

## Sigurnosna razmatranja

### Konfiguracija vatrozida

```bash
# Allow only necessary ports
sudo ufw allow 9002/tcp
sudo ufw enable
```

### Obratni proxy (neobavezno)

Razmislite o korištenju nginxa ili Apachea kao obratnog proxyja za:
- SSL/TLS enkripciju
- pridruživanje naziva domene
- raspodjelu opterećenja
- kontrolu pristupa

### Ograničenja korisnika

Uredite `config.toml`:
```toml
[server]
max_users = 100  # Limit concurrent users
```

---

## Kako doći do pomoći

### Izvori

- **Dokumentacija**: ovaj vodič, README.md, USER_GUIDE.md
- **GitHub Issues**: https://github.com/sv1btl/PhantomSDR-Plus/issues
- **Demonstracija uživo**: http://phantomsdr.no-ip.org:8900/

### Prijava problema

Kada prijavljujete problem, navedite:
1. operacijski sustav i verziju
2. model SDR uređaja
3. sadržaj konfiguracijske datoteke
4. poruke o pogreškama
5. potrošnju sistemskih resursa (CPU, RAM, GPU)

### Podrška zajednice

- Prije otvaranja novih, provjerite postojeće GitHub issue prijave
- Navedite detaljne podatke o svojoj postavi
- Priložite zapise i poruke o pogreškama
- Budite strpljivi i pristojni

---

## Dodatak A: potpuni popis ovisnosti

### Popis paketa za Ubuntu 24.04

```
build-essential
cmake
pkg-config
meson
libfftw3-dev
libwebsocketpp-dev
libflac++-dev
zlib1g-dev
libzstd-dev
libboost-all-dev
libopus-dev
libliquid-dev
git
util-linux (taskset — for the autorun spot reporter)
psmisc
wget
curl
rtl-sdr (for RTL-SDR)
airspy (for Airspy)
hackrf (for HackRF)
libclfft-dev (for OpenCL)
ocl-icd-opencl-dev (for OpenCL)
clinfo (for OpenCL)
```

---

## Dodatak B: primjeri konfiguracije

### Primjer 1: RTL-SDR za VHF/UHF

```toml
[input]
sps = 2048000
frequency = 145000000
signal = "iq"

[input.driver]
format = "u8"

[input.defaults]
frequency = 145500000
modulation = "FM"
```

### Primjer 2: RX-888 mk2 za KV (0-30 MHz)

Prijamnik koji koristi većina sysopa. Ovo je cijeli `[input]` odjeljak, a ne isječak, s vrijednostima iz `config-rx888mk2.toml` koji dolazi uz repozitorij.

```toml
[input]
sps = 60000000            # 0-30 MHz izravnim uzorkovanjem
fft_size = 4194304        # vidjeti napomenu ispod
fft_threads = 8
brightness_offset = -9    # negativnije ako slap pokazuje crne mrlje
frequency = 0             # osnovni pojas: RX-888 uzorkuje od DC-a
signal = "real"           # ne "iq" - izravno uzorkovanje daje realni tok
accelerator = "opencl"    # "none" ako nema OpenCL okruženja
audio_sps = 12000
audio_compression = "flac"
waterfall_size = 1024
waterfall_compression = "zstd"
smeter_offset = 5
analog_smeter_offset = 5

[input.driver]
name = "stdin"
format = "s16"

[input.defaults]
frequency = 7120000
modulation = "LSB"
```

Napaja ga `rx888_stream`, što za vas obavlja `start-rx888mk2.sh`:

```bash
rx888_stream -f /path/to/SDDC_FX3.img -s 60000000 -g 50 -a 0 -m low --pga -d -r -o - \
  | build/spectrumserver --config config-rx888mk2.toml
```

**O `fft_size`:** pri 60 MSPS ispravna je veličina 4194304. 8388608 udvostručuje razlučivost slapa, a s njom i memoriju te procesorsku cijenu svake transformacije; na većini strojeva oštrije binove plaćate izgubljenim okvirima. Počnite s 4194304 i povećavajte samo ako poslužitelj ima obilje rezerve.

### Primjer 3: HackRF za širokopojasni FM

```toml
[input]
sps = 10000000
frequency = 100900000
signal = "iq"

[input.driver]
format = "s8"

[input.defaults]
frequency = 100900000
modulation = "WBFM"
```

---

**Instalacija je gotova! Sada biste trebali imati potpuno funkcionalan PhantomSDR-Plus poslužitelj.**

**73 de SV1BTL & SV2AMK**
