# PhantomSDR-Plus

**Unaprijeđeni WebSDR poslužitelj otvorenog koda s naprednim mogućnostima i futurističkim dizajnom**

PhantomSDR-Plus je fork projekta PhantomSDR koji pruža web-poslužitelj softverski definiranog radija (SDR) visokih performansi, sposoban posluživati stotine istodobnih korisnika. Nudi poboljšano korisničko sučelje, podršku za više dekodera, prikaz plana pojaseva i kompatibilnost s raznim SDR hardverskim platformama.

---

## 🌟 Ključne značajke

### Performanse i skalabilnost
- **Podrška za više korisnika**: stotine istodobnih korisnika, ovisno o hardveru
- **Visoka frekvencija uzorkovanja**: podrška za SDR uređaje do 70 MSPS (realno) / 35 MSPS (IQ)
- **Hardversko ubrzanje**: podrška za OpenCL i CUDA za obradu ubrzanu GPU-om
- **Optimizirano emitiranje**: FLAC i Opus audiokompresija niske latencije

### Korisničko sučelje
- **Futuristički dizajn**: moderno, prilagodljivo web-sučelje
- **Optimizirano za mobilne uređaje**: poboljšano mobilno sučelje za slušanje u pokretu
- **Prikaz plana pojaseva**: interaktivni slap (waterfall) s preklopima frekvencijskih pojaseva
- **Prilagodljive palete boja**: više shema boja za slap
- **Dvostruki S-metar**: izbor između analognog i digitalnog prikaza signala
- **Tipke dekodera na jedan pritisak**: red Decoders na glavnoj ploči, odmah ispod izbornika načina rada (FT8, FT4, FT2, JS8, CW, WSPR, FAX, SSTV, NAVTX, RTTY), uz RADEL i RADEU pokraj samog izbornika načina rada te ponovljene u skočnim prozorima načina rada i pojaseva. Jedan pritisak pokreće dekoder i otvara njegov prozor, drugi ga zaustavlja. Dosadašnji red za širinu pojasa je uklonjen.
- **Skener kanala**: pretražuje pojas, ili točno ono što prikazuje slap, i zaustavlja se na prvom kanalu koji se izabranim brojem dB uzdigne iznad šuma samoga pojasa, a zatim nastavlja sam čim taj kanal utihne. Korak prati način rada, a zaustavljanja padaju na mrežu kanala (1 kHz SSB, 100 Hz CW, 5 kHz kratkovalni AM, 9/10 kHz srednji val, 9 kHz dugi val). Način *Preskoči prazne* čita spektar slapa i skoči ravno na signale, a tipka za zaključavanje izbacuje stalno zauzet kanal iz pretraživanja. Sve se odvija lokalno u pregledniku slušatelja, pa pretraživanje nikome drugom ne pomiče prijamnik (vidi [Korisnički priručnik](USER_GUIDE.md))
- **Diverziti prijam**: povezuje prijamnik s drugim na nekoj drugoj lokaciji i reproducira onaj koji trenutačno ima bolji signal, pa propadanje na jednoj lokaciji pokriva druga. Drugi prijamnik može biti još jedan PhantomSDR-Plus, KiwiSDR, UberSDR ili WebSDR; prva tri ne traže ništa osim preglednika slušatelja, a samo WebSDR treba mali relej na vašem vlastitom poslužitelju. Poravnanje traje otprilike petnaest sekundi, a udaljeni SNR ugađanje uravnotežuje dvije postaje jednu prema drugoj. Svaki slušatelj u vlastitom pregledniku drži imenovani popis drugih prijamnika, redoslijedom kakav želi, i može ga izvesti u datoteku te ponovno uvesti (vidi [Diverziti prijam](RECEIVE_DIVERSITY.md))

### Obrada signala
- **Više načina demodulacije**: AM, FM, USB, LSB, CW i drugi. Također je implementiran RADE dekoder verzije 1.
- **Sinkrona AM detekcija**: bolja kvaliteta AM prijema
- **Smanjenje šuma**: NR (spektralno), NB (prigušivač impulsnog šuma), NS (potiskivanje pozadinskog šuma) i AN (automatski notch) — svi na putu slušanja, nikada na dekoderima
- **AGC mogućnosti**: više načina automatske regulacije pojačanja
- **Automatski squelch**: automatski prag squelcha na temelju šuma
- **Smanjenje šuma umjetnom inteligencijom**: neuronska mreža RNNoise u pregledniku slušatelja, uklanja šum pojasa iz govora (samo govorni načini; vidi [Korisnički priručnik](USER_GUIDE.md))

### Napredne značajke
- **Digitalni dekoderi**: FT8, FT4, FT2, JS8, CW, QRSS Grabber, WSPR, HF FAX, SSTV, NAVTEX, FSK/RTTY, PSK31, Olivia i FreeDV RADE, svaki radi u vlastitoj pozadinskoj dretvi pa dekodiranje nikada ne prekida zvuk (vidi [Dekoderi](DECODERS.md))
- **Decoder ID**: imenuje digitalni način rada u propusnom pojasu i jednim klikom nudi odgovarajući dekoder, na temelju izmjerene širine pojasa, razmaka tonova, simbolske brzine i vremenskog rasporeda emisija, uzimajući frekvenciju u obzir kao dodatni pokazatelj — što ujedno razdvaja **FT8 od JS8**, dva načina rada s istovjetnim signalom. Samo predlaže, nikada ne prebacuje sam od sebe, i radije šuti nego nagađa kada je signal preslab. Slabljenje ga ne ušutkava: kada QSB razlomi dvominutnu WSPR emisiju na komade, i dalje imenuje način rada, čitajući ritam iz cijele povijesti slušanja, i snižava prikazanu pouzdanost kako bi naznačio da je dokaz slabiji. Između otprilike 400 Hz i 2700 Hz položaj u propusnom pojasu nije važan; izvan toga pojavljuje se jantarni gumb **Recentre & retry**, koji jednom pomakne ugađanje i pokreće novo mjerenje. Kada prihvatite prijedlog, prijamnik se namjesti za taj način rada: ugođena frekvencija dolazi na sredinu slapa, pogled se postavlja na oko 100 kHz oko nje, a bočni pojas i propusni pojas postaju oni s kojima se taj način radi — podpojas od 3 kHz za obitelj FT8, 1350–1650 Hz za WSPR, ±250 Hz i CW za telegrafiju, i tako dalje. Isključeno po zadanome, a u radu oko 0,5 % jedne jezgre (vidi [Dekoderi](DECODERS.md))
- **Predlošci digitalnih modova**: pritisak na FT8, FT4, FT2, JS8 ili WSPR postavlja i bočni pojas i propusni pojas
- **JS8 prozor razgovora**: poruke iz više okvira sastavljaju se u cijele rečenice
- **Nadzorna ploča statistike**: statistika poslužitelja i korisnika u stvarnom vremenu
- **Popis povezanih korisnika**: svi koji slušaju, s gumbom za ugađanje u svakom retku. Vaša vlastita sesija označena je s **you** — i u prozoru sučelja i kad se `users.html` otvori kao zasebna stranica
- **Automatska prijava spotova**: autorun daemon dekodira FT8, FT4 i WSPR na poslužitelju i šalje spotove na PSK Reporter i WSPRnet, s dva brojača na administratorskoj ploči — pločice po dekoderu za tekući rad i ukupan zbroj od početka uz svaki potvrdni okvir pojasa/načina rada
- **Grafikoni poslužitelja**: stranica **Grafikoni** na administratorskoj ploči s frekvencijom procesora, opterećenjem, temperaturom i brojem korisnika kroz zadnjih 15 minuta do 24 sata (vidi [Administratorska ploča](ADMIN_PANEL_SETUP.md))
- **Toplinska zaštita**: čuvar u administratorskoj ploči zaustavlja poslužitelj ako se procesor pregrije i pokreće ga ponovno kad se ohladi, s pragovima izvedenima iz kritičnog praga vašeg vlastitog procesora i bez ikakvih pretpostavki o tome kako pokrećete ili zaustavljate poslužitelj; isporučuje se u načinu samo zapisivanja, pa ne čini ništa dok ga ne uključite (vidi [Thermal Guard](THERMAL_GUARD.md)) Za prijamnik bez nadzora **snažno se preporučuje** ploču pokretati kao systemd jedinicu — čuvar živi u njoj, pa inače ponovno dizanje sustava odnese i zaštitu (vidi [Administratorska ploča](ADMIN_PANEL_SETUP.md#ponovno-pokretanje-ploče)).
- **Emulacija KiwiSDR klijenata**: neobavezan most koji na istom računalu i istim vratima odgovara i na KiwiSDR protokol, pa se Kiwi softver poput **AetherSDR-a** i `kiwiclienta` spaja izravno na prijamnik — uz stvarno ugađanje, vodopad i S-metar na istoj ljestvici kao onaj na web stranici. Isključen dok u konfiguraciju ne dodate `[kiwi_emulation] enabled = true` (vidi [Instalacija](Aether_config.md))
- **Upravljanje primopredajnikom (CAT)**: drži vaš uređaj i prozor prijemnika na istoj frekvenciji, načinu rada i širini filtra, u jednom ili oba smjera — putem izbornika Rig u aplikaciji [Desktop PhantomSDR+](https://www.dropbox.com/scl/fo/kjwj96zg3kj7dgq4fjef9/APnA3c9hhv4hk3YMGIGjH7s?rlkey=jfiwklly63kv73poalx631pk3&st=m37uvaym&dl=0) (Icom, Yaesu, Kenwood, Elecraft, FlexRadio i QRP Labs izravno, svaki drugi uređaj preko Hamliba, ili flrig) ili alatom CATsync Tool for WebSDRs u pregledniku. Stranice nude funkcije `catsync_*` za frekvenciju, način rada, širinu filtra i utišavanje. Radi s prijemnicima PhantomSDR-Plus, KiwiSDR, PA3FWM WebSDR i UberSDR (vidi [Upravljanje primopredajnikom](RIG_CONTROL.md))
- **Sustav oznaka**: uvoz/izvoz frekvencijskih oznaka
- **Tipkovni prečaci**: učinkovita navigacija i upravljanje
- **Podrška za kotačić miša**: intuitivno ugađanje frekvencije
- **WebSDR imenik**: integracija s https://sdr-list.xyz

---

## 📋 Podržani hardver

PhantomSDR-Plus podržava širok raspon SDR prijamnika:

| Uređaj | Frekvencija uzorkovanja | Format | Sučelje |
|--------|--------------------------|--------|---------|
| **RX888 MK2** | Do 64 MHz | 16-bitni | Izvorno |
| **RTL-SDR** | Do 3.2 MHz | 8-bitni | rtl_sdr |
| **HackRF One** | Do 20 MHz | 8-bitni | hackrf_transfer |
| **Airspy HF+ / Discovery** | Do 912 kHz | 16-bitni | SoapySDR (SoapyAirspyHF) + rx_sdr |
| **SDRplay RSP1A** | Do 10 MHz | 16-bitni | SoapySDR (libmirisdr-5 + SoapyMiri, ili SDRplay API) + rx_sdr |
| **RigExpert Fobos SDR** | 50 MHz (HF izravno uzorkovanje) / do 20 MHz (RF) | 16-bitni / 32-bitni float | SoapySDR (SoapyFobosSDR) + rx_sdr |
| **Ostali uređaji** | Promjenjivo | Razno | SoapySDR/rx_tools |

---

## 🚀 Brzi početak

### Sistemski zahtjevi

**Minimalni:**
- Ubuntu 22.04 LTS (preporučeno) ili Fedora
- Dvojezgreni procesor
- 4 GB RAM-a
- 10 GB prostora na disku

**Preporučeni:**
- Ubuntu 24.04 LTS
- Procesor s 4+ jezgre (Ryzen 5 2600 ili Intel i5-6500T ili bolji)
- 8 GB RAM-a
- GPU s podrškom za OpenCL (nije obavezno, ali je vrlo preporučljivo)
- SSD pohrana

### Instalacija

```bash
# Kloniranje repozitorija
git clone --recursive https://github.com/sv1btl/PhantomSDR-Plus
cd PhantomSDR-Plus

# Postavljanje skripti kao izvršnih
chmod +x *.sh

# Pokretanje automatske instalacije
./install.sh
```

**Napomena:** nakon pokretanja `install.sh` ponovno pokrenite terminal prije nastavka.

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

Na Fedori koristite `install_fedora.sh`, na Archu `install_arch.sh`, a na openSUSE Tumbleweedu `install_opensuse.sh` — rade isti posao s drugim upraviteljem paketa. Svako izdanje Debiana i Ubuntua pokriva sam `install.sh`.

Ništa se ne mora instalirati ručno unaprijed. Skripta instalira ovisnosti za građenje i Node.js, gradi backend, gradi upravljački program za prijamnik koji odaberete (uz RX888 i udev pravila), otvara `site_information.json` da ga ispunite, gradi frontend, instalira OpenCL kada ga hardver podržava, zatim postavlja **administratorsku ploču**, **FreeDV RADE dekoder** i **poslužitelj statistike** — sva tri prema zadanome, s `n` preskačete pojedini — i završava potpunim `recompile.sh`. Interaktivna je od početka do kraja i traje od dvadesetak minuta do više od sat vremena.

Opis korak po korak nalazi se u [INSTALLATION.md → Što instalacijska skripta radi](INSTALLATION.md#što-instalacijska-skripta-radi). Za detaljne upute o instalaciji pogledajte [INSTALLATION.md](INSTALLATION.md).

---

## 📊 Mjerenja performansi

| Hardver | Frekvencija uzorkovanja | Opterećenje CPU-a | Kapacitet korisnika |
|---------|--------------------------|-------------------|----------------------|
| Ryzen 5 2600 (sve jezgre) | 64 MHz (32 MHz IQ) | 38-40 % | 100+ korisnika |
| AMD RX 580 (GPU) | 64 MHz (32 MHz IQ) | 28-35 % | 100+ korisnika |
| Intel i5-6500T (s OpenCL) | 60 MHz (30 MHz IQ) | 10-12 % | 100+ korisnika |

*Napomena: dodatno opterećenje CPU-a po korisniku minimalno je (<1 % po korisniku) kada je omogućeno hardversko ubrzanje.*

---

## 🎯 Upotreba

### Osnovni rad

1. **Konfigurirajte svoj SDR**: uredite odgovarajuću konfiguracijsku datoteku (npr. `config-rtl.toml`)
2. **Ažurirajte podatke o lokaciji**: uredite `frontend/site_information.json`
3. **Pokrenite poslužitelj**: pokrenite odgovarajuću početnu skriptu:
   ```bash
   ./start-rtl.sh      # Za RTL-SDR
   ./start-rsp1a.sh    # Za SDRplay RSP1A
   ./start-airspyhf.sh # Za Airspy HF+
   ./start-fobos-hf.sh # Za RigExpert Fobos SDR, HF1/HF2 (0-25 MHz)
   ./start-fobos.sh    # Za RigExpert Fobos SDR, RF (25-6000 MHz)
   ./start-hackrf.sh   # Za HackRF One
   ./start-rx888mk2.sh # Za RX888 MK2
   ```
   RSP1A, Airspy HF+ i Fobos rade preko SoapySDR-a i `rx_sdr`; instalacijska skripta postavlja njihov upravljački program kad ih odaberete (opcije 3, 6 i 5), a na već instaliranoj stanici pokrenite `./setup-rsp1a.sh`, `./setup-airspyhf.sh` ili `./setup-fobos.sh`. Vidi [INSTALLATION.md](INSTALLATION.md#prijamnici-preko-soapysdr-a-rsp1a-fobos-airspy-hf). HackRF One (opcija 7) treba samo paket `hackrf` iz distribucije: `./setup-hackrf.sh`.
   Svaka početna skripta je **samostalna**: zaustavlja svaku pokrenutu instancu, pokreće prijamnik + `spectrumserver`, **odvaja se u pozadinu** (preživljava zatvaranje terminala) i pokreće **watchdog** koji automatski ponovno pokreće lanac ako se on ugasi. Napredak se bilježi u `logwebsdr.txt` — pratite ga naredbom `tail -f logwebsdr.txt`. Ponovno pokretanje početne skripte znači čisto ponovno pokretanje, a `flock` zaključavanje osigurava da istodobno radi samo jedan prijamnik. Neobavezno: `SPECTRUM_CORES=0-3` za vezanje uz određene CPU jezgre, `RX_ARGS="…"` za zamjenu argumenata prijamnika bez uređivanja datoteke (`RX888_ARGS` za RX888), `RX_DRIVER=miri|sdrplay` za odabir upravljačkog programa za RSP1A.
4. **Pristupite sučelju**: otvorite preglednik na `http://localhost:PORT` (zadani port ovisi o konfiguraciji)

### Zaustavljanje poslužitelja

Jedna zajednička skripta za zaustavljanje radi za **svaki** prijamnik — prvo zaustavlja watchdog (kako se ne bi automatski ponovno pokrenuo), zatim prijamnik i `spectrumserver`:

```bash
./stop-websdr.sh
```

---

## 🔧 Konfiguracija

### Osnovne konfiguracijske datoteke

1. **`config-[uređaj].toml`** – konfiguracija poslužitelja i SDR-a
   - Postavke poslužitelja (port, dretve, HTML korijen)
   - Ulazne postavke (frekvencija uzorkovanja, veličina FFT-a, frekvencija)
   - Mogućnosti registracije u WebSDR imenik
   - Postavke audiokompresije
   - Nakon izmjene ponovno pokrenite poslužitelj.

2. **`frontend/site_information.json`** – javni podaci o lokaciji
   - Podaci o operateru (pozivni znak, e-pošta, lokacija)
   - Podaci o hardveru i anteni
   - Postavke regije i širine pojasa
   - Uključivanje/isključivanje razgovora (chat)
   - Nakon izmjene pokrenite recompile.sh u terminalu.

3. **`markers.json`** – frekvencijske oznake i plan pojaseva

4. **`frontend/src/bands-config.js`** – konfiguracija plana pojaseva Ta se datoteka nalazi u frontend/src/bands-config.js i definira pojaseve koje stvara SysOp. <br />
- Vidjet ćete nešto poput sljedećeg i slobodno to uredite po želji:
   ```
   - const bands = 
   .....
   - { ITU: 1,
            name: '40m', min: -30, max: 110, initFreq: '7120000', publishBand: '1', startFreq: 7000000, endFreq: 7200000,  stepi: 1000, color: 'rgba(50, 168, 72, 0.6)', 
	    modes: [
              { mode: MODES.CW, startFreq: 7000000, endFreq: 7040000 },
              { mode: MODES.LSB, startFreq: 7040000, endFreq: 7200000 }]
	},
	{ ITU: 2,
            name: '40m', min: -30, max: 110, initFreq: '', publishBand: '1', startFreq: 7000000, endFreq: 7300000,  stepi: 1000, color: 'rgba(50, 168, 72, 0.6)', 
	    modes: [
              { mode: MODES.CW, startFreq: 7000000, endFreq: 7050000 },
              { mode: MODES.LSB, startFreq: 7050000, endFreq: 7300000 }]
	},
	{ ITU: 3,
            name: '40m', min: -30, max: 110, initFreq: '', publishBand: '1', startFreq: 7000000, endFreq: 7200000,  stepi: 1000, color: 'rgba(50, 168, 72, 0.6)',
            modes: [
              { mode: MODES.CW, startFreq: 7000000, endFreq: 7040000 },
              { mode: MODES.LSB, startFreq: 7040000, endFreq: 7200000 }]
   .....
   etc
   ```
   **Pri čemu:** <br />
   - **ITU** je regija u kojoj se poslužitelj nalazi,
   - **min i max** su granice svjetline slapa za zadani pojas,
   - **initFreq** je početna frekvencija na koju se ugađa kada se odabere pojas,
   - **publishBand** određuje prikazuje li se pojas: 1 za amaterske pojaseve, 2 za radiodifuzijske,
   - **startFreq i endFreq** određuju granice pojasa,
   - **stepi** je zadani korak kotačića miša za pojas, a **modes** je preferirani zadani način rada za pojas.

- Nakon izmjena **pokrenite recompile.sh u terminalu** iz mape PhantomSDR-Plus.

Za primjere konfiguracije pogledajte priložene ogledne datoteke:
- `config-rtl.toml` – konfiguracija za RTL-SDR
- `config-rsp1a.toml` – konfiguracija za SDRplay RSP1A
- `config-airspyhf.toml` – konfiguracija za Airspy HF+
- `config-fobos-hf.toml` / `config-fobos.toml` – konfiguracija za RigExpert Fobos SDR (HF / RF)
- `config-hackrf.toml` – HackRF One
- `config-rx888mk2.toml` – konfiguracija za RX888 MK2

---

## 🌊 Donji prag slapa — `waterfall.sh`

`waterfall.sh` (u korijenu repozitorija) mijenja **zadanu minimalnu razinu slapa** u dB — vrijednost od koje slap kreće pri novom posjetu.

Ta vrijednost nalazi se u dvije izvorne datoteke na pet različitih mjesta (`frontend/src/waterfall.js` → `this.minWaterfall`, te `frontend/src/App.svelte` → početni `let min_waterfall`, dva slučaja „min“ resetiranja i zadana vrijednost oznaka). Ručno uređivanje lako se pogriješi, pa to skripta radi umjesto vas. Nikada ne koristi tvrdo upisane brojeve redaka — svako mjesto pronalazi po uzorku, pa nastavlja raditi i nakon ažuriranja izvornog koda.

- **Viša** vrijednost (npr. `-15`) daje **tamniji** slap.
- **Niža** vrijednost (npr. `-45`) daje **svjetliji** slap.

```bash
./waterfall.sh              # interaktivno — prikazuje trenutne vrijednosti i traži novu
./waterfall.sh -v -15       # postavi vrijednost bez pitanja
./waterfall.sh -v -15 -y    # ... i preskoči sve potvrde
./waterfall.sh -s           # samo prikaži trenutne vrijednosti, bez izmjena
```

Prije izmjene izrađuje sigurnosnu kopiju obiju datoteka s vremenskom oznakom (`*.bak-GGGGmmdd-HHMMSS`) i ispisuje naredbu za vraćanje. Dira se samo literale jednake vrijednosti koja je trenutno u upotrebi, pa se nepovezani brojevi u tim datotekama nikada ne mogu slučajno prepisati. Ako se nova vrijednost nakon toga ne pojavi, skripta sama vraća sigurnosne kopije i izlazi s greškom. Također upozorava kada dvije datoteke nisu usklađene i postavlja obje.

- Nakon izmjene frontend se mora ponovno izgraditi — skripta nudi da za vas pokrene `recompile.sh` (uz `-y` preskače izgradnju, pa sami pokrenite `./recompile.sh` kada budete spremni).

---

## 🎨 Prilagodba

### Promjena pozadinske slike

Zamijenite `frontend/src/assets/background.jpg` slikom po želji (zadržite isti naziv datoteke).

- Nakon izmjene pokrenite recompile.sh u terminalu.


### Odabir audiokodeka

Odaberite između FLAC-a i Opusa u svojoj `.toml` konfiguraciji:
```toml
[input]
audio_compression="opus"  # or "flac"
```
- Nakon izmjene ponovno pokrenite poslužitelj.


### Kalibracija S-metra

Dva su instrumenta namjerno na **odvojenim lancima**, pa se ugađaju s dvije različite postavke.

#### Dvije postavke

Obje se nalaze u odjeljku `[input]` konfiguracije s kojom se pokreće poslužitelj (`config.toml`, `config-rx888mk2.toml` itd.):

```toml
[input]
smeter_offset=5         # samo digitalna traka
analog_smeter_offset=5  # samo analogna kazaljka
```

Čitaju se u `src/websocket.cpp` i šalju pregledniku u prvom `basic_info` okviru, pa je **dovoljno ponovno pokrenuti poslužitelj** — nije potrebna ponovna izgradnja frontenda.

#### Analogni lanac

```
prikazani dBm = -130 + (rawDb + analog_smeter_offset + 130) x 1,1
```

- Vizualno pojačanje 1,1 djeluje *nakon* pomaka, s uporištem na -130 dBm. Jedna jedinica `analog_smeter_offset` pomiče očitanje za 1,1 dB. Za pomak prikaza za X dB vrijedi `analog_smeter_offset ~= 0,91 x X`. TOML vrijednost čita se kao cijeli broj, pa su mogući samo cijeli koraci.
- Zakon kazaljke (`powerFromDbm` u `frontend/src/lib/SMeterAnalog.svelte`) stavlja **S9 na -73 dBm**, na 60 od 100 jedinica kazaljke, uz krivulju `pow(...,0,6)` od -130 do -73 ispod S9 i krivulju `pow(...,0,8)` od -73 do -13 (S9+60) iznad.
- To **nije** linearna ljestvica od 6 dB po S-jedinici, pa je smislena točka umjeravanja S9 — oznake ispod S9 neće pratiti generator u koracima od 6 dB.

#### Digitalni lanac

```
value    = (rawDb / 150) x 100 + smeter_offset   -> ograničeno na [-100, 0]
segments = round((value + 100) x 35 / 100) + DIGITAL_BAR_TRIM
```

- Primijetite `/150 x 100`: digitalna je ljestvica **sažeta na 2/3** i nikada ne vidi ni `analog_smeter_offset` ni vizualno pojačanje 1,1. Zato se traka i kazaljka nikada ne poklapaju točno — to je namjerno.
- 35 segmenata na 100 jedinica znači da je jedan segment 2,86 jedinica pomaka, otprilike 4,3 dB sirovo. Dakle `smeter_offset=3` približno je jedan segment.
- `DIGITAL_BAR_TRIM` u `frontend/src/lib/SMeterDigital.svelte` (trenutno 0) pomiče traku za cijele segmente. Njegova je promjena zahvat u izvorni kod i **zahtijeva** ponovnu izgradnju frontenda.

#### LED prozori su u oba instrumenta vođeni analognim lancem

Prozori dBm / dBµV / SNR / NF u **oba** instrumenta čitaju analogno umjerenu vrijednost i dodaju fiksni `VISUAL_DBM_OFFSET` od 5, čvrsto upisan u `SMeterAnalog.svelte` i `SMeterDigital.svelte`. Stoga:

- `smeter_offset` **ne** mijenja nijedan broj u prozorima, samo duljinu trake.
- dBµV = dBm + 107 (50 oma), a NF = dBm - SNR po konstrukciji, pa NF slijedi automatski.
- Želite li ispravne **brojeve** bez diranja položaja kazaljke, postavka je `VISUAL_DBM_OFFSET` — ali to je konstanta u izvornom kodu, traži ponovnu izgradnju i mora se promijeniti u **obje** datoteke da ostane dosljedno.

#### Postupak

1. Dovedite poznatu razinu na antenski ulaz (generator na -73 dBm = S9), u SSB/CW sa stabilnom propusnom širinom. Očitanja ovise o propusnoj širini i AGC-u, pa prvo fiksirajte način rada i širinu.
2. Zabilježite što pokazuje analogni dBm prozor, pa postavite `analog_smeter_offset ~= 0,91 x (-73 - prikazano)`. Ponovno pokrenite poslužitelj i provjerite. Jedna iteracija je dovoljna; kazaljka bi trebala sjesti na S9.
3. Prijeđite na digitalni instrument i namjestite `smeter_offset` tako da duljina trake postavi S9 gdje želite — otprilike 3 jedinice po segmentu. Taj je korak samo estetski i ne utječe na očitanja.
4. Bez generatora, dobra je zamjena mirni opseg s radiofarom poznate razine, ili jednostavno usidrite šumni prag na uvjerljivu vrijednost (npr. -120 dBm na 20 m s pristojnom antenom) — uz svijest da se time umjerava cijeli lanac uključujući dobitak antene, a ne samo prijamnik.


### Varijante grafičkog sučelja

Sve četiri varijante sučelja (analogni/digitalni S-metar x raspored v1/v2) nalaze se u jednoj izgradnji. Posjetitelji ih prebacuju izbornikom ⚙️ u gornjem desnom kutu — ništa se ne učitava ponovno, pa zvuk, slap i svaki dekoder koji radi nastavljaju — a odabir se pamti u svakom pregledniku.
- Pokrenite recompile.sh u terminalu da postavite *početnu* varijantu, onu koju posjetitelj vidi prvi put.
- **[EDITING_VARIANTS.md](EDITING_VARIANTS.md)** – kako uređivati varijante frontenda (S-metar i raspored) i ponovno ih izgraditi

---

## 📚 Dokumentacija

- **[INSTALLATION.md](INSTALLATION.md)** – potpuni vodič za instalaciju za sistemske operatere
- **[ADMIN_PANEL_SETUP.md](ADMIN_PANEL_SETUP.md)** – vodič za instalaciju administratorske ploče
- **[USER_GUIDE.md](USER_GUIDE.md)** – vodič za krajnje korisnike o radu s WebSDR-om
- **[THERMAL_GUARD.md](THERMAL_GUARD.md)** - Priručnik za sysopa o zaštiti od pregrijavanja procesora: četiri načina rada i što učiniti u svakome
- **[CONNECTION_LIMITS.md](CONNECTION_LIMITS.md)** - Priručnik za sysopa o ograničenjima veza: zaštita javnog prijemnika od poplave veza
- **[PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md)** – struktura direktorija i organizacija koda
- **[EDITING_VARIANTS.md](EDITING_VARIANTS.md)** – kako uređivati varijante frontenda (S-metar i raspored) i ponovno ih izgraditi

---

## 🌐 Mrežni popis WebSDR-ova

Registrirajte svoj WebSDR u službenom imeniku: https://sdr-list.xyz

Postavite `register_online=true` u svojoj `.toml` konfiguracijskoj datoteci za automatsku registraciju.

---

## 🐛 Rješavanje problema

### Česti problemi

**OpenCL ne radi**
- Provjerite jesu li upravljački programi ispravno instalirani
- Provjerite naredbom `clinfo`
- Za detaljno postavljanje OpenCL-a vidi INSTALLATION.md

**Problemi s latencijom zvuka**
- Pokušajte prebaciti između kodeka FLAC i Opus
- Prilagodite postavke međuspremnika u konfiguraciji
- Osigurajte dostatne CPU/GPU resurse

**Neuspjeli build**
- Provjerite jesu li instalirane sve ovisnosti
- Pokušajte očistiti direktorij za izgradnju: `rm -rf build && meson setup build`
- Provjerite ima li sukobljenih verzija biblioteka

---

## 🤝 Doprinosi

Doprinosi su dobrodošli! Ovo je nezavisni fork s dodatnim mogućnostima. Molimo:

1. Napravite fork repozitorija
2. Stvorite granu za novu značajku
3. Predajte (commit) svoje izmjene
4. Pošaljite granu na udaljeni repozitorij
5. Otvorite Pull Request

---

## 📄 Licenca

Ovaj projekt licenciran je pod GNU General Public License v3.0 – pojedinosti potražite u datoteci [LICENSE](../../LICENSE).

---

## 👥 Autori i zasluge

- **SV1BTL i SV2AMK** – razvoj i poboljšanja projekta PhantomSDR-Plus
- Temeljeno na izvornom projektu PhantomSDR

---

## 🔗 Poveznice

- **Demonstracija uživo**: http://phantomsdr.no-ip.org:8900/
- **WebSDR imenik**: https://sdr-list.xyz
- **GitHub repozitorij**: https://github.com/sv1btl/PhantomSDR-Plus

---

## 📞 Podrška

- **Problemi**: prijavite pogreške putem [GitHub Issues](https://github.com/sv1btl/PhantomSDR-Plus/issues)
- **E-pošta**: kontakt sv1btl@otenet.gr

---

## ⚡ Savjeti za performanse

1. **Omogućite OpenCL/CUDA** za GPU ubrzanje – dramatično smanjuje opterećenje CPU-a
2. **Koristite SSD pohranu** za bolje U/I performanse
3. **Dodijelite dovoljno RAM-a** – preporučuje se najmanje 8 GB
4. **Optimizirajte veličinu FFT-a** – veći FFT = bolja razlučivost, ali veće opterećenje CPU-a
5. **Razmislite o namjenskom GPU-u** – AMD ili NVIDIA s podrškom za OpenCL

---

**73 de SV1BTL & SV2AMK**

*Za detaljne upute o postavljanju vidi INSTALLATION.md* *Za vodič za rad namijenjen krajnjem korisniku vidi USER_GUIDE.md*
