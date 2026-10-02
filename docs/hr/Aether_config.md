# Emulacija KiwiSDR klijenata

**Povezivanje AetherSDR-a, kiwiclienta i drugog KiwiSDR softvera na PhantomSDR-Plus**

Od v4.1.0 PhantomSDR-Plus može odgovarati i na **KiwiSDR protokol**, pa se softver pisan za KiwiSDR — **AetherSDR**, `kiwiclient` i ostali — spaja izravno na vaš prijamnik. Riječ je o mostu unutar istog poslužiteljskog procesa, na istom računalu i istom portu koji već objavljujete: bez drugog servisa, bez drugog porta, bez posrednika.

**Isključen je dok ga ne uključite.** Ništa od mosta ne radi — ni utičnica, ni provjera — dok `[kiwi_emulation]` nedostaje ili je `false`, a to je stanje svježe instaliranog stabla.

---

## Sadržaj

1. [Što dobiva Kiwi klijent](#1-što-dobiva-kiwi-klijent)
2. [Instalacija mosta](#2-instalacija-mosta)
3. [Uključivanje](#3-uključivanje)
4. [Pregled postavki](#4-pregled-postavki)
5. [Spajanje klijenta](#5-spajanje-klijenta)
6. [Razina zvuka](#6-razina-zvuka)
7. [S-metar](#7-s-metar)
8. [Slap i spektar](#8-slap-i-spektar)
9. [Ako nešto ne izgleda dobro](#9-ako-nešto-ne-izgleda-dobro)
10. [Dokle je provjereno](#10-dokle-je-provjereno)

---

## 1. Što dobiva Kiwi klijent

| | |
|---|---|
| **Zvuk** | `ws://<host>:<port>/kiwi/<id>/SND` — demodulirani zvuk u Kiwijevom SND okviru |
| **Slap** | `ws://<host>:<port>/kiwi/<id>/W/F` — spektar, u Kiwijevim W/F okvirima |
| **Ugađanje** | stvarno, ne kozmetičko: `SET mod=…` s klijenta mijenja frekvenciju, bočni pojas i propusni pojas na PhantomSDR strani, jednako kao što bi to učinio slušatelj u pregledniku |
| **S-metar** | pogonjen snagom po bloku samog demodulatora, na istoj skali kao i web S-metar |

Ugađanje je podržano za **realni** ulaz (`signal = "real"` u vašem `.toml`). Za IQ ulaz odnos između binova i frekvencije je drukčiji i nije implementiran, pa će IQ prijamnik davati zvuk i slap, ali neće pratiti ugađanje Kiwi klijenta.

---

## 2. Instalacija mosta

Most je skup zakrpa na izvorni kod pozadinskog dijela plus jedno novo zaglavlje, `src/kiwi_bridge.h`. Postoje dva načina da ih ugradite.

**Instalacijskim programom.** `install.sh` (te `install_arch.sh`, `install_fedora.sh`, `install_opensuse.sh`) imaju vlastiti korak za to — korak 17, *Kiwi client emulation*. Nudi se, ne nameće: odgovorite `n` i ništa se ne zakrpa. Za nenadzirano izvođenje odlučuje `PHANTOM_KIWI=y|n`, a zadano je da.

**Na stablu koje je već instalirano** pokrenite skriptu koja dolazi u korijenu repozitorija:

```bash
cd ~/PhantomSDR-Plus
./kiwi_install.sh
./recompile.sh          # odaberite [1] Samo pozadinski dio
```

`kiwi_install.sh` najprije spremi svaku datoteku koje se dotakne u `backup_kiwi_bridge_<vremenska-oznaka>/` i primjenjuje svaku zakrpu točnim podudaranjem teksta — ako sidro nije ondje gdje ga očekuje (lokalno izmijenjeno stablo, druga inačica), tu se zaustavi, imenuje datoteku i ostavi je netaknutom. Idempotentan je: na stablu koje već ima most prijavljuje svaku zakrpu kao već primijenjenu i ništa ne mijenja.

> **Ako ste upravo primijenili arhivu ažuriranja koja već sadrži most, ne morate ga pokretati.** Zakrpani izvorni kod je u paketu; `kiwi_install.sh` bi vam samo rekao da je svaka zakrpa već na mjestu.

Datoteke koje zakrpava su `src/client.h`, `src/signal.cpp`, `src/waterfall.cpp`, `src/spectrumserver.h`, `src/spectrumserver.cpp`, `src/websocket.cpp` i `src/http.cpp`, a `kiwi_bridge.h` kopira u `src/`.

> **Instalira most, ne nadograđuje ga.** Ako zakrpa ikada *padne* na stablu na kojem most već radi, izvorni kod je otišao ispred skripte — i skriptu treba osvježiti, ne vaše stablo.

---

## 3. Uključivanje

Dodajte ovo u `.toml` s kojim vaš prijamnik zaista radi — istu datoteku koju predajete `spectrumserveru`, onu koju imenuje vaš `start-<radio>.sh`. Ne `config.example.*`:

```toml
[kiwi_emulation]
enabled = true
```

Zatim ponovno pokrenite prijamnik:

```bash
./stop-websdr.sh
./start-<vaš-radio>.sh
```

`kiwi_install.sh` dodaje blok umjesto vas, s `enabled = true`, u one od `config.toml`, `config-rx888mk2.toml`, `config-airspyhf.toml`, `config-rtl.toml`, `config-rsp1a.toml`, `config-fobos.toml`, `config-fobos-hf.toml` i `config-hackrf.toml` koje postoje u korijenu repozitorija. Ne može znati za konfiguraciju koju držite drugdje ili pod drugim imenom, a **arhive ažuriranja nikada ne isporučuju `.toml`**, pa je nakon ažuriranja blok na vama da ga dodate ručno. Isporučene `config.example.*.toml` nose ga dokumentiranog i postavljenog na `false`.

---

## 4. Pregled postavki

Sve što most čita nalazi se u jednom odjeljku `[kiwi_emulation]`. Obavezan je samo `enabled`; sve četiri fine postavke imaju kalibriranu vrijednost kao zadanu, pa je blok koji sadrži samo `enabled = true` već ispravan.

| Ključ | Zadano | Što radi |
|---|---|---|
| `enabled` | `false` | Uopće odgovarati na KiwiSDR protokol. Isključeno = potpuno neaktivno. |
| `audio_gain` | `0` | dB. Izlazno pojačanje, samo za Kiwi klijente. Vidi [Razina zvuka](#6-razina-zvuka). |
| `smeter_offset` | `input.analog_smeter_offset` | dB. Nadjačava pomak S-metra, samo za Kiwi klijente. Vidi [S-metar](#7-s-metar). |
| `wf_cal` | `0` | dB. Prikazna korekcija za slap i spektar. Vidi [Slap i spektar](#8-slap-i-spektar). |
| `wf_fps_max` | `23` | Sličica slapa u sekundi. Vidi [Slap i spektar](#8-slap-i-spektar). |

Potpuno ispunjen blok, s vrijednostima s kojima radi prijamnik ovog projekta:

```toml
[kiwi_emulation]
enabled       = true
audio_gain    = 60.0    # dB, samo Kiwi klijenti. 0 = netaknuto.
wf_cal        = -10.0   # dB, stvar ukusa. 0 = slaže se sa S-metrom.
wf_fps_max    = 28      # sličica/s. 23 je maksimum protokola.
# smeter_offset = 5.0   # dB. Zadano je input.analog_smeter_offset.
```

> **Svaki se ovdje navedeni ključ čita pri pokretanju.** Promjena bilo kojeg od njih je **ponovno pokretanje**, a ne ponovno prevođenje — `./stop-websdr.sh`, pa vaša skripta za pokretanje. Za njihovo podešavanje nikada ne morate ponovno prevoditi.

Prihvaćaju se i cjelobrojni i decimalni oblik: `28` i `28.0` čitaju se jednako. Samo ključ koji zaista nedostaje pada na svoju zadanu vrijednost.

---

## 5. Spajanje klijenta

Usmjerite klijent na istu adresu i port koje koriste vaši slušatelji — bez staze, bez prefiksa. AetherSDR traži računalo i port; `kiwiclient` uzima `-s` i `-p`:

```bash
# kiwiclient, snimanje 30 sekundi na 7100 kHz LSB
python3 kiwirecorder.py -s vas.prijamnik.example -p 8073 -f 7100 -m lsb --tlimit=30
```

Klijent se ugađa, slap se puni, S-metar pokazuje. Ako se baš ništa ne događa, most je gotovo sigurno još uvijek isključen — vidi [odjeljak 3](#3-uključivanje).

---

## 6. Razina zvuka

Prvo što većina primijeti jest da Kiwi klijent zvuči tanje od PhantomSDR web stranice. Nije da most nešto gubi: jedan međuspremnik hrani svaki koder, a ista frekvencija s istim propusnim pojasom, izmjerena kroz preglednikov vlastiti audio put i kroz `/SND`, daje istovjetne uzorke. Web stranica je glasna jer `audio.js` iznova gradi zvuk u pregledniku — naglašavanje basova, pojasni filtar, podizanje prisutnosti, kompresor s nadoknadnim pojačanjem i klizač glasnoće. Kiwi klijent nema ništa od toga i ne može to dobiti.

`audio_gain` zatvara tu razliku, samo za Kiwi klijente:

```toml
[kiwi_emulation]
enabled    = true
audio_gain = 55.0       # dB, samo Kiwi klijenti. 0 = netaknuto.
```

**Počnite oko 55–60 dB.** 55 dB nije račun: to je vrijednost pri kojoj su Kiwi klijent i PhantomSDR web stranica izmjereni na istoj razini, na jakom lokalnom signalu na 729 kHz. U praksi se često voli malo više — ovaj se prijamnik zaustavio na 60 — pa birajte po sluhu.

Time ne možete pokvariti zvuk. **Graničnik vrhova s uvidom unaprijed** stoji između pojačanja i 16-bitnog odsijecanja: svaki se uzorak kasni 4 ms dok se pojačanje računa iz zvuka koji još nije poslan, pa glasan odsječak dočeka pojačanje koje je već sišlo zbog njega, a vrhovi se preklapaju umjesto da budu spljošteni. Potjeran na 60 pa i 70 dB — daleko iznad rezerve koju samo pojačanje ima — nije odsječen ni jedan uzorak od četvrt milijuna. Ispod praga graničnika pojačanje je točno 1,0, pa prijamnik koji ne tjera zvuk dobiva uzorke netaknute.

Previsoka vrijednost stoji glasnoće, ne kvalitete. Iznad otprilike 60 dB dodatno se pojačanje jednostavno ograniči: izmjereno ovdje, razina je porasla oko 1 dB od 55 do 60 i jedva se pomaknula od 60 do 70. Nakon toga kupujete kompresiju, a ne glasnoću.

Ništa od toga ne dira web stranicu i ništa ne pomiče S-metar — on dolazi iz snage demodulatora, a ne iz audio uzoraka, pa pojačavanjem glasnoće ne možete natjerati instrument da laže.

---

## 7. S-metar

Kiwijev S-metar nije zasebno kalibriran: on ponavlja ono što prikazuje vaša web stranica, stupanj po stupanj. Snaga po bloku iz demodulatora polazište je za oboje, a stranica zatim primijeni `input.analog_smeter_offset`, raširi rezultat oko −130 dBm i doda vlastiti prikazni pomak. Most radi isto, pa Kiwi klijent i stranica pokazuju isti signal jednake jakosti — provjereno na jakoj lokalnoj postaji, gdje su oba pokazala −37 dBm.

Ako — i samo ako — želite da Kiwi klijenti pokazuju drukčije od vaše stranice, dajte mostu vlastiti pomak:

```toml
[kiwi_emulation]
enabled       = true
smeter_offset = 5.0     # zamjenjuje input.analog_smeter_offset samo za Kiwi klijente
```

> **Uspoređujte dva instrumenta na istom filtru, ili nikako.** Očitanje dolazi iz snage u propusnom pojasu, pa širi filtar skuplja više šuma i pokazuje više — na mirnom pojasu ista je frekvencija izmjerena 5,6 dB jače pri 9 kHz nego pri 2,4 kHz. Kiwi klijent sa 6 kHz filtrom naspram web stranice na 2,4 kHz razlikovat će se za nekoliko dB koliko god oba bila kalibrirana. Najprije uskladite način rada i širinu pojasa.

> **Ovo je skala stranice, a ne fizička.** Web instrument širi svoj raspon radi čitljivosti, pa se 10 dB stvarne promjene signala prikazuje kao otprilike 11. Uskladiti se s njom znači da se Kiwi klijenti slažu s vašim prijamnikom i razlikuju od pravog KiwiSDR-a za iznos koji raste s jakošću signala. To je ispravan kompromis kada je vaša stranica mjerilo s kojim svi uspoređuju; ako biste radije da most ostane fizički pošten, ovo je odjeljak koji treba promijeniti.

---

## 8. Slap i spektar

### dB skala — `wf_cal`

Svaki se bin slapa prije slanja pretvara u stvarne dBm, na istu skalu na koju je kalibriran S-metar. Nosilac stoga pokazuje **istu razinu pri svakom zumu**, što daje i pravi KiwiSDR, a spektar se slaže s vlastitim S-metrom web stranice preko istog propusnog pojasa.

```toml
[kiwi_emulation]
enabled = true
wf_cal  = 0.0           # dB, samo Kiwi klijenti
```

> **`wf_cal` nije kalibracija.** `0` je vrijednost pri kojoj se spektar slaže s vašim S-metrom, i ondje ga ostavite ako želite da brojke nešto znače. Postoji zato što je pitanje ukusa — i onoga što vaš klijent radi s rasponom — koliko *jako* spektar treba izgledati: prijamnik ovog projekta radi na `-10` jednostavno zato što tako izgleda dobro u AetherSDR-u. Jedna vrijednost pomiče spektar i slap zajedno: to su isti bajtovi na vodu, a Kiwi protokol ih ne može skalirati odvojeno. Želite li da se razlikuju, to mora doći iz klijentovih vlastitih prikaznih kontrola.

Za provjeru skale usporedite slap zbrojen preko propusnog pojasa sa S-metrom na **mirnoj** frekvenciji. Na nosiocu SSB propusni pojas isključuje sam nosilac i to dvoje nije usporedivo.

### Brzina sličica — `wf_fps_max`

Kiwi klijent traži najbrži slap koji može dobiti (`SET wf_speed=4`) i ravna svoje klizanje — te usrednjavanje spektra — prema brzini koju poslužitelj obeća isporučiti. Ako se to dvoje ne poklapa, prikaz izgleda tromo iako zapravo ništa ne kasni.

Prijamnik proizvodi `2 × sps / fft_size` spektara u sekundi. Kiwi klijenti se poslužuju iz svakog od njih i prorjeđuju na brzinu koju su tražili; web stranica zadržava vlastiti, sporiji ritam i nije zahvaćena.

```toml
[kiwi_emulation]
enabled    = true
wf_fps_max = 23         # sličica u sekundi
```

`23` je maksimum koji objavljuje sam KiwiSDR protokol i sigurna zadana vrijednost. **Uvijek pobjeđuje manja od `wf_fps_max` i vlastite brzine prijamnika**, pa povećanje čini nešto samo ako je vaš FFT dovoljno brz da sličica pretekne. Primjer, za prijamnik na 60 Muzoraka/s s FFT-om od 4194304 točke — `2 × 60000000 / 4194304 = 28,6` sličica u sekundi:

| `wf_fps_max` | isporučeno |
|---|---|
| nema (zadano 23) | 23,0 fps |
| `28` | 28,0 fps |
| `40` | 28,6 fps — pobjeđuje vlastita granica prijamnika |

Poštuje se i `SET wf_speed` s klijenta: `0` isključeno, `1` = 1 fps, `2` četvrtina maksimuma, `3` polovica, `4` maksimum. Klijent na slaboj vezi tako može tražiti manje.

> **Hoće li povećanje pomoći odlučuje klijent, ne poslužitelj.** Klijent koji crta svaku sličicu čim stigne dat će vam glatkije klizanje; klijent koji se ravna prema 23 koje očekuje jednostavno će višak sličica staviti u red, a kašnjenje će rasti. Isprobajte, i ako slap djeluje tromije umjesto glatkije, vratite na `23`.

### Što određuje ostatak kašnjenja

Ako lovite kašnjenje, većina ga nije u mostu. Prozor analize širok je `fft_size / sps` — 70 ms uz FFT od 4194304 točke na 60 Muzoraka/s — a uzorak uz to čeka do polovice toga da se korak napuni. Prepoloviti `fft_size` prepolovljuje oboje i udvostručuje brzinu sličica, ali i prepolovljuje vašu frekvencijsku razlučivost, od koje žive uskopojasni dekoderi (WSPR, FT8, CW). Na većini prijamnika to je loša zamjena za nekoliko desetaka milisekundi. To je odluka u `[input]`, a ne nešto što most može promijeniti.

---

## 9. Ako nešto ne izgleda dobro

Svaka naredba koju Kiwi klijent pošalje zapisuje se u **`/tmp/kiwi_retune.log`** — zahtjevi za ugađanjem, promjene načina rada, prijava i sve što most nije prepoznao. Ne košta ništa mjerljivo i namijenjeno je da ostane na mjestu. Kada se klijent ponaša čudno, ta datoteka pokazuje što je zapravo tražio, a to je obično cijeli odgovor.

| Simptom | Pogledajte |
|---|---|
| Klijent se spoji i odmah ispadne | u konfiguraciji s kojom je poslužitelj **pokrenut** nedostaje `[kiwi_emulation] enabled = true` |
| Nema zvuka, nema slapa, nema redaka u zapisniku | pozadinski dio nije ponovno preveden nakon `kiwi_install.sh` — pokrenite `./recompile.sh`, opcija `[1]` |
| `kiwi_install.sh` stane na zakrpi | poruka imenuje datoteku i sidro; stablo je odstupilo od onoga što zakrpa očekuje, a ta je datoteka ostala netaknuta |
| Zvuk postoji, ali je tanak i tih | očekivano — postavite `audio_gain`, vidi [odjeljak 6](#6-razina-zvuka) |
| Slap klizi tromo | `wf_fps_max`, vidi [odjeljak 8](#8-slap-i-spektar) |
| Ugađanje u klijentu ne radi ništa | IQ ulaz (`signal = "iq"`); ugađanje je izvedeno samo za realne ulaze |
| Promijenjena postavka nije imala učinka | ti se ključevi čitaju pri pokretanju — ponovno pokrenite prijamnik |

> **AGC je na strani klijenta.** `SET agc=` s Kiwi klijenta prihvaća se i zanemaruje — zvuk stiže s primijenjenim PhantomSDR-ovim vlastitim AGC-om, a klijentove AGC kontrole djeluju na ono što primi.

---

## 10. Dokle je provjereno

Format na vodu provjeren je naspram živog prijamnika i pročitan redak po redak naspram izvornog koda obaju klijenata kojima je namijenjen — AetherSDR-ovog `KiwiSdrProtocol.cpp` i kiwiclientovog `kiwi/client.py`. Raspored i veličina okvira, redni brojevi, redoslijed bajtova, skala S-metra, ugađanje i slap — sve se slaže. Za most je također **potvrđeno da radi sa samom AetherSDR desktop aplikacijom**, od strane održavatelja, naspram ovog prijamnika.

Izmjereno na tom prijamniku, s testnim klijentom na živim utičnicama: ugađanje se izvrši u 35–50 ms, zvuk teče u stvarnom vremenu bez zanošenja, a slap isporučuje postavljenu brzinu bez zastoja i bez izgubljenih sličica.

Ako ipak nešto izgleda pogrešno na vašoj instalaciji, `/tmp/kiwi_retune.log` je prvo mjesto za pogledati, a povratna je informacija dobrodošla u svakom slučaju.

---

**Vidi i:** [Vodič za instalaciju](INSTALLATION.md) · [Struktura projekta](PROJECT_STRUCTURE.md) · [Korisnički vodič](USER_GUIDE.md)
