# Ograničenja veza — Priručnik za sysopa

**Zaštita javnog prijemnika od poplave veza.**

WebSDR je javna usluga koja svakome tko zatraži predaje neprekidan tok zvuka i spektra. To mu je i svrha, i upravo je u tome problem: poslužitelju ništa kod običnog slušatelja ne izgleda drukčije od nekoga tko otvara sesije u petlji. Dana 16. rujna 2026. ovaj je prijemnik doživio točno to — jedna je adresa otvorila 134 slušateljske sesije unutar jedne minute i držala ih 181 istodobno, dok je stvarna publika stanice bila oko desetak ljudi.

Ovaj priručnik govori o tri sloja koja to zaustavljaju, o tome što svaki od njih može a što ne može, i kako provjeriti jesu li vaši razumno postavljeni.

> **U žurbi?** Primjerni `config.toml` već dolazi s razumnim vrijednostima, pa je svježa instalacija zaštićena bez da išta učinite. Ako je vaš vlastiti `.toml` stariji i nema ključeva `[limits]` osim `audio`/`waterfall`/`events`, ograničenja po adresi jednostavno su **isključena** — prekopirajte blok iz primjera da ih uključite. Jedina naredba koju poslije vrijedi znati jest `grep Refused spectrumserver.log`, koja vam kaže odbija li se koga.

---

## Sadržaj

1. [Od čega se zapravo branite](#1-od-čega-se-zapravo-branite)
2. [Tri sloja](#2-tri-sloja)
3. [Ograničenja po adresi — politika slušatelja](#3-ograničenja-po-adresi)
4. [Neaktivne veze — tihi napad](#4-neaktivne-veze)
5. [Zaštita u jezgri — `setup-firewall.sh`](#5-zaštita-u-jezgri)
6. [Referenca postavki](#6-referenca-postavki)
7. [Što vidi odbijeni slušatelj](#7-što-vidi-odbijeni-slušatelj)
8. [Čitanje zapisa i brojača](#8-čitanje-zapisa-i-brojača)
9. [Odabir vaših brojeva](#9-odabir-vaših-brojeva)
10. [Zamke koje vrijedi poznavati](#10-zamke-koje-vrijedi-poznavati)
11. [Isključivanje svega](#11-isključivanje-svega)

---

## 1. Od čega se zapravo branite

Vrijedi biti precizan, jer riječ „DDoS“ pokriva dvije vrlo različite stvari, a samo se jedna od njih može riješiti na vašem stroju.

**Poplava iz jednog izvora.** Jedno računalo, ili njih nekoliko, otvara veze najbrže što može. To se ovdje dogodilo i u potpunosti se da popraviti: veze dolaze s adrese koju možete prebrojati, a brojanje je dovoljno.

**Pravi raspodijeljeni napad.** Tisuće računala, često s lažiranim izvorišnim adresama, pune vašu vezu. Dok ti paketi stignu do vaše mrežne kartice, propusnost je već potrošena. **Ništa opisano u ovom priručniku ne pomaže**, niti to može išta što instalirate na poslužitelj — jedini je odgovor usluga ispred vas, što je drugi razgovor koji uključuje pravu domenu i pružatelja poput Cloudflarea ispred prijemnika.

Sve što slijedi bavi se prvim slučajem. To nije ograničenje zbog kojeg se treba ispričavati: prvi je slučaj ono što se amaterskim stanicama doista događa.

---

## 2. Tri sloja

```
   internet
        │
        ▼
   ┌─────────────────────────────────────────────────────────┐
   │  1. nftables          setup-firewall.sh                 │
   │     grubo, jeftino, skida količinu prije nego je išta   │
   │     pročita                                             │
   └─────────────────────────────────────────────────────────┘
        │
        ▼
   ┌─────────────────────────────────────────────────────────┐
   │  2. spectrumserver    [limits] u config.toml            │
   │     točno, po slušatelju, zna tko je tko                │
   └─────────────────────────────────────────────────────────┘
        │
        ▼
   ┌─────────────────────────────────────────────────────────┐
   │  3. preglednik        kaže zašto, i nikad ne pokušava   │
   └─────────────────────────────────────────────────────────┘
```

Namjerno nisu suvišni jedan drugome. Sloj jezgre je brz, ali glup — broji pakete s adrese i ne zna ništa o slušateljima. Sloj poslužitelja je precizan, ali vezu vidi tek kad je prihvaćena i raščlanjena, što nešto košta. Sloj preglednika postoji da odbijeni slušatelj sazna što se dogodilo, umjesto da gleda u stranicu koja se nikad ne učita.

---

## 3. Ograničenja po adresi

### Što se broji kao jedan slušatelj

Slušatelj je **jedna `/audio` veza** — ili, gdje je `[kiwi_emulation]` uključen, **jedna Kiwi zvučna veza**, koja se broji potpuno isto. To je ista jedinica kojom se već služe brojač korisnika, `users.json` i oznake na slapu, pa Kiwi klijent zauzima mjesto i pojavljuje se na popisu korisnika jednako kao preglednik.

To je važno jer jedna jedina kartica preglednika na računalu otvara **četiri** veze prema vašem poslužitelju:

| Veza | Svrha |
|---|---|
| `/audio` | tok demoduliranog zvuka — **to je slušatelj** |
| `/waterfall` | prikaz spektra |
| `/events` | popis korisnika, frekvencije ostalih slušatelja |
| `/chat` | ploča za razgovor |

Telefon na `/mobile` otvara dvije (`/audio` i `/chat`), jer nema slapa. Ograničenje koje bi brojalo sirove veze odbilo bi dakle sve: tri kartice su dvanaest veza.

### Tri ključa

```toml
[limits]
per_ip=3            # istodobni slušatelji s jedne adrese
per_ip_sockets=0    # istodobne veze bilo koje vrste; 0 daje per_ip * 4 + 4
per_ip_rate=40      # nove veze u minuti s jedne adrese
per_ip_ban_s=600    # koliko se dugo odbija adresa koja probije brzinu
```

**`per_ip`** je glavni broj i onaj o kojem ćete razmišljati. Tri je dobra polazna točka.

**`per_ip_sockets`** postoji jer `/audio` nije jedino što se isplati preplaviti. `/waterfall` je najteži tok koji vaš poslužitelj proizvodi, a ograničenje koje bi brojalo samo slušatelje zaobišlo bi se jednostavno otvaranjem veza slapa. Ostavljeno na `0` postaje `per_ip * 4 + 4`, što stane `per_ip` punih kartica s malo prostora za veze koje jezgra nije stigla pospremiti nakon osvježavanja stranice.

**`per_ip_rate`** je ono što poplavu doista prekida. Sama gornja granica to ne čini: odbijanje veze jeftino je, ali ne besplatno, a napadač se može ponovno spajati jednako brzo koliko se odbijanja vraćaju, trošeći vaš procesor na postavljanje i rastavljanje. Ograničenje brzine daje mu zabranu umjesto odgovora. Zapamtite da jedna kartica košta četiri, pa je 40 u minuti otprilike deset učitavanja stranice u minuti s jedne adrese.

> **Namjeran redoslijed.** Brzina se naplaćuje *prije* nego se provjeri granica istodobnosti. To izgleda naopako dok ne pomislite na adresu koja je već na svojoj granici i ponovno se spaja u petlji: kad bi joj svaki put odgovaralo jeftino odbijanje „na granici si“, prekršaji brzine nikad se ne bi nakupili i zabrana koja petlju prekida nikad se ne bi okinula.

### Tko je izuzet

**Povratna petlja nikad se ne ograničava.** Autorun tap za dojavu spotova, upravljačka ploča i preglednik otvoren na samom poslužiteljskom stroju svi dolaze s `127.0.0.1`, a pustiti ih da troše mjesta značilo bi da vaša vlastita stanica zaključava vaše slušatelje vani.

To pokriva i `proxy.py`: veze kroz proxy dolaze do `spectrumservera` s povratne petlje, a stvarna adresa klijenta stiže u zaglavlju `X-Forwarded-For`, na koje su ograničenja i vezana.

---

## 4. Neaktivne veze

Postoji napad koji ništa od navedenog ne može vidjeti.

Otvoriti TCP vezu. Ne poslati ništa. Držati je.

Takav sugovornik nikad ne dovrši zahtjev, pa nikad ne dođe do koda u kojem žive ograničenja po adresi — nema slušatelja, nema objekta klijenta, nema ničega s imenom što bi se brojalo. U međuvremenu njega to košta nekoliko bajtova, a vas opisnik datoteke i jedno mjesto dokle god je drži.

```toml
[limits]
idle_per_ip=8       # neaktivne veze (prije zahtjeva) po adresi
idle_total=512      # gornja granica preko svih adresa
```

Ograničenje je na **koliko njih**, a ne na **koliko dugo**, i ta je razlika cijela zamisao. **Roka za neaktivnu vezu nema, i to namjerno.** Rok djeluje kao očit odgovor, a zamka je (vidi [§10](#10-zamke-koje-vrijedi-poznavati)): postoje legitimni sugovornici koji se spoje pa dugo šute prije nego progovore. Od napada ih razdvaja količina — legitiman sugovornik drži jednu takvu vezu, napadač tisuće.

Neaktivna veza tako živi dok ne pošalje zahtjev ili ne umre, a mjesto se otpušta u oba slučaja.

`idle_total` omeđuje poplavu razasutu po mnogo izvorišnih adresa. Kad se granica dosegne, odbijaju se **nove** neaktivne veze umjesto da se izbacuju postojeće, pa legitimna dugovječna veza nikad nije ono što se žrtvuje da bi se napravilo mjesta.

Oboje se primjenjuje u trenutku prihvaćanja utičnice, na temelju adrese sugovornika — zahtjeva još nema, pa nema ni `X-Forwarded-For` za pogledati. To ne smeta: povratna petlja se ne broji, čime je pokriveno sve što dolazi kroz `proxy.py`, a izravna poplava nosi vlastitu adresu.

---

## 5. Zaštita u jezgri

`setup-firewall.sh` postavlja nftables tablicu koja skida količinu prije nego `spectrumserver` pročita i jedan bajt. Namjerno je gruba, a brojevi su joj znatno iznad onih u `config.toml`, tako da običan slušatelj nikad ne može biti uhvaćen objema.

```bash
./setup-firewall.sh --show        # ispiši pravila, ne mijenjaj ništa
sudo ./setup-firewall.sh --check  # provjeri valjanost na vašoj jezgri
sudo ./setup-firewall.sh --apply  # učitaj, uz automatski povrat za 60 s
sudo ./setup-firewall.sh --persist # ponovno učitaj pri pokretanju
sudo ./setup-firewall.sh --status  # brojači paketa po pravilu
sudo ./setup-firewall.sh --remove  # poništi sve
```

Pokriva četiri stvari: gornju granicu istodobnih veza po izvorišnoj adresi na vašim proxy i prijemničkim vratima, brzinu novih veza po izvoru, kočnicu za grubo pogađanje SSH lozinki, te Windows dijeljenje datoteka zatvoreno za sve izvan privatnih adresnih raspona — `smbd` na mnogim strojevima sluša na `0.0.0.0`, a je li to izvana dohvatljivo ovisi o usmjerivaču koji skripta ne može vidjeti.

Vrata se čitaju iz `admin_config.json`, iste datoteke kojom se služi `proxy.py`, pa prati vašu instalaciju.

### Zašto vas ne može zaključati vani

Dva svojstva, oba namjerna:

- Politika tablice je **accept**, i odbacuje samo izrijekom imenovane obrasce. Pravilo koje ne odgovara pušta paket dalje prema svemu ostalom što ste postavili. Ne može stroj učiniti nedostupnim.
- **Uspostavljene veze prihvaćaju se u prvom pravilu.** SSH sesija u kojoj tipkate nikad nije pogođena onim što slijedi.

Povrh toga, `--apply` naoruža automatski povrat: učitaj pravila, pa potvrdi unutar 60 sekundi ili se uklanjaju. Ne recite ništa, zatvorite terminal, izgubite vezu — skup pravila nestaje sam od sebe.

Iskoristite taj prozor kako treba. Provjerite **s drugog uređaja, izvan vlastite mreže**, da se prijemnik i dalje učitava i da se otvara *nova* SSH sesija. Provjera sesijom koju već imate ne dokazuje ništa, jer ju je prihvatilo prvo pravilo.

---

## 6. Referenca postavki

Svaki ključ ispod živi pod `[limits]` u vašoj `.toml` datoteci. **Svi su podrazumijevano isključeni ili velikodušni**, pa se postava koja ih ne spominje ponaša točno kao i prije.

| Ključ | Zadano | Značenje |
|---|---|---|
| `per_ip` | `0` (isključeno) | Istodobni slušatelji po adresi |
| `per_ip_sockets` | `0` → `per_ip * 4 + 4` | Istodobne veze bilo koje vrste po adresi |
| `per_ip_rate` | `0` (isključeno) | Nove veze u minuti po adresi |
| `per_ip_ban_s` | `600` | Sekundi odbijanja nakon probijanja brzine |
| `idle_per_ip` | `8` | Neaktivne veze, prije zahtjeva, po adresi |
| `idle_total` | `512` | Neaktivne veze preko svih adresa |

Postavljanje bilo kojeg ključa na `0` isključuje tu pojedinu provjeru.

### Tri koja nisu ograničenja

`[limits]` sadrži i `audio`, `waterfall` te `events`, naslijeđene iz izvornog PhantomSDR-a, i **nijedno od tri se ne provodi.** `waterfall` i `events` ne čita nikakav kôd. `audio` se čita na samo jednom mjestu: šalje se kao `max_users` u JSON-u prijave direktorijima iz `[websdr] register_urls`, pa je to broj koji prikazuju sdr-list.xyz i ostali, a ne čini baš ništa kad je `register_online=false`. Želite li gornju granicu slušatelja, `per_ip` gore je ono što djeluje.

### Još jedan, pod `[server]`

```toml
[server]
min_client_version=0
```

Nije ograničenje nego odbijanje, a kako dijeli isti kôd zatvaranja, mjesto mu je ovdje. Stranice najavljuju inačicu iz koje su učitane kao `/audio?v=N`, a sve ispod `min_client_version` odbija se porukom *„ova je stranica zastarjela — ponovno je učitajte“*.

Postoji zato što poslužitelj ne može doprijeti do JavaScripta koji već radi u nečijem pregledniku. Kartica zadržava kôd koji je učitala dok je netko ne osvježi, pa promjena stranice stiže samo do slušatelja koji je slučajno osvježe — a stanica koja je upravo promijenila ponašanje sesija možda treba da stare stranice nestanu sada, a ne jednom.

Provjerava se samo `/audio`, jer ondje sesija živi, dok su povratna petlja i Kiwi putanje izuzete kako autorun tap i Kiwi klijenti ostanu netaknuti. `0` ga isključuje i zadana je vrijednost. Ostaviti ga uključenim nakon što se stare stranice isprazne nije problem: trenutni klijent diversityja koji bude odbijen na golom `/audio` pokušava ponovno s oznakom, pa se i dalje odbijaju samo klijenti diversityja sa starijom verzijom PhantomSDR-Plusa i alati trećih strana koji otvaraju `/audio` bez `?v=`. Vratite ga na `0` ako vam druga stanica javi da vas više ne može koristiti kao partnera za diversity.

---

## 7. Što vidi odbijeni slušatelj

### Ništa se nikad ponovno ne spaja

Počnite odavde, jer to upravlja svime ostalim: **pala `/audio` veza završava sesiju.** Automatskog ponovnog spajanja nema, i to namjerno.

Ponovno spajanje pravi je nagon za aplikaciju za razgovor, a krivi za prijemnik. `/waterfall` i `/events` s njim se nikad nisu vraćali, pa je ponovljena sesija bila živa zvučna veza pričvršćena na zamrznuti slap; a zaustavljanje poslužitelja više ga nije praznilo, jer je svaki slušatelj bio natrag nekoliko sekundi poslije, puneći popis korisnika sesijama u kojima zapravo nikoga nije bilo. Stranica utihne i slušatelj je ponovno učita — što je upravo ono što je ovaj prijemnik radio prije nego što je ponovno spajanje uopće dodano.

Za ograničenja iz ovog priručnika to uklanja i zamku: pred ograničenjem brzine automatski bi pokušaj produljio upravo onu zabranu koju je htio zaobići.

### Dva koda zatvaranja

| Kôd | Značenje | Tko ga šalje |
|---|---|---|
| **4003** | odbijeno — iznad ograničenja po adresi, ili zastarjela stranica | `spectrumserver` |
| **4001** | izbačen od strane sysopa | `spectrumserver`, kad ploča pozove `/~~kick` |

Oba su u privatnom rasponu 4000–4999, pa se nijedan ne može zamijeniti sa stanjem protokola, i oba svaka stranica smatra konačnima. Tekst razloga putuje u okviru zatvaranja, a ne kao poruka, jer je prvi okvir na `/audio` rezerviran za postavke prijemnika i bilo što poslano prije njega pokvarilo bi svaku normalnu vezu.

### Na stranici

**Odbijeno pri učitavanju stranice** — slušatelj uopće ne krene, pa se obje stranice objasne. Stolno računalo prikazuje ploču: *„Ovaj je prijemnik odbio vezu“*, razlog, i napomenu da se svi koji dijele jednu internetsku vezu broje kao jedna adresa. `/mobile` prikazuje isto u svom prostoru za obavijesti.

**Odbijeno ili izbačeno usred sesije** — stolna stranica jednostavno stane, namjerno bez poruke: petlja crtanja slapa prestaje i to je sve. `/mobile` prikazuje jedan redak koji slušatelju kaže da osvježi stranicu, osim nakon izbacivanja, gdje i ono šuti.

Ta je šutnja nakon izbacivanja namjerna. **Izbacivanje je sysop koji završava sesiju, a ne kazna** — ništa se ne objavljuje, a tko se želi vratiti ponovno učita stranicu i sekundu poslije je običan slušatelj. Jedino što kôd 4001 donosi jest da preglednik zna kako ovo nije bila pala veza, pa izbacivanje doista uhvati umjesto da samo sebe poništi.

Izbacivanje obavlja `spectrumserver` sam, a ne `proxy.py`: slušatelji se spajaju izravno na priključak prijemnika, pa proxy ne posjeduje nijednu njihovu vezu i njegovo izbacivanje ne doseže nikoga. Ploča poziva `/~~kick?ip=&secs=`, dostupan samo s povratne petlje i provjeren na stvarnom TCP sugovorniku, a ne na `X-Forwarded-For`, koji šalje klijent. `secs` je zadano nula — bez zabrane — ali prima trajanje ako adresu želite zadržati izvan neko vrijeme, a to koristi isti mehanizam zabrane kao `per_ip_rate`, pa se ponovno spajanje odbija na vratima.

## 8. Čitanje zapisa i brojača

### Poslužitelj

```bash
grep Refused spectrumserver.log
```

```
Refused /audio from 203.0.113.5: too many simultaneous connections
Refused /audio from 198.51.100.7: too many connection attempts
```

Ako tamo nema ničega, nikoga se ne odbija. Zapisivanje je ograničeno na najviše jedan redak po adresi svakih pet sekundi — bez toga bi se napad pretvorio u neograničeno pisanje na disk, što je samo sporiji način da se stanica obori.

### Jezgra

```bash
sudo ./setup-firewall.sh --status
```

Čitajte **`counter packets N`** na svakom pravilu; to je broj doista odbačenih. Sve nule znače da ništa nije blokirano i da su vaši pragovi udobno labavi.

Nemojte se uznemiriti popisima `elements = { ... }` u skupovima iznad pravila. To su vaši obični slušatelji koje se *prati* u odnosu na ograničenja — unos se pojavi pri prvoj vezi neke adrese i istekne koju minutu poslije. Praćenje nije blokiranje.

---

## 9. Odabir vaših brojeva

Nagađanje nije potrebno; vaši će vam vlastiti zapisi reći. Ovo je mjerenje koje je ovdje odredilo `per_ip=3`, nad tjedan dana `logs/users_*.jsonl`:

| Istodobne sesije s jedne adrese | Broj adresa |
|---|---|
| 1 | 682 |
| 2 | 54 |
| 3 | 13 |
| više od 3 | **8** |

758 različitih adresa u sedam dana, a ograničenje od tri dotaklo bi osam njih. Poplava je sjedila na 181.

Da to ponovite na vlastitoj stanici, uparite identifikatore sesija po adresi u `logs/users_*.jsonl` i uzmite najveće preklapanje. Imajte na umu da zapis bilježi događaje `tune` i `disconnect`, ali nema događaja `connect`, pa se početak sesije mora izvesti iz njezina prvog `tune`.

**Ne zaboravite NAT.** Klub, škola, ured ili mobilni operater pojavljuju se kao jedna adresa, a svi iza nje dijele jedno dopuštenje. To je svojstveno svakom ograničenju vezanom uz adresu; jedino je ublažavanje odabrati broj s kojim vam je ugodno. Ako slušatelj ikad javi da se ne može spojiti, to je prvo na što treba posumnjati — pogledajte `grep Refused` prije svega ostalog.

---

## 10. Zamke koje vrijedi poznavati

### Nikad rok za neaktivnu vezu

Ključa `handshake_s` više nema, i evo zašto. Rok od 30 sekundi za neaktivne veze izgleda kao očita obrana od slowlorisa. Napisan je, uključen i u jednoj je minuti dao ovo:

```
Idle deadline: closed 1 connection(s) idle past 30s: 192.87.173.88
```

`192.87.173.88` je `etgd-websdr.ewi.utwente.nl` — **vlastito računalo za povratni poziv websdr.orga**. Ono se spaja natrag na vaš poslužitelj i zatim miruje, znatno dulje od 30 sekundi, prije nego pošalje svoj `GET /~~orgstatus`. Rok ga je svaki put presjekao i prijava je prestala raditi. Postavka je uklonjena, a ne ostavljena kao opcija: samoranjavanje koje kvari vaš unos u direktoriju ne vrijedi šezdeset redaka koji ga izvode.

**Isto vrijedi za `open_handshake_timeout` u websocketppu, koji je još tu.** Vrijednost od deset minuta u `spectrumserver.cpp` izgleda besmisleno i nosiva je: upravo ona dopušta povratnom pozivu websdr.orga da miruje. Postoji i drugi razlog — rukovatelj `/~~orgstatus` odgovara iz dretve koja drži `dup()` utičnice, a websocketpp isteklu vezu završava s `shutdown()`, pozivom na razini utičnice koji seže kroz duplikat i pokvario bi povratni poziv čak i da vrijeme mirovanja nije problem.

Trebate li omeđiti tihe veze, omeđite njihov broj, a ne starost. Za to postoje `idle_per_ip` i `idle_total`.

### nftables datoteka mora biti idempotentna

`nft -f` **dodaje** u tablicu koja već postoji, umjesto da je zamijeni. Datoteka pravila bez uvoda `delete table` stoga udvostručuje cijeli lanac pri svakom ponovnom učitavanju — što je točno ono što naivna systemd jedinica čini pri svakom ponovnom pokretanju usluge. `setup-firewall.sh` uvod stvara umjesto vas; pišete li vlastita pravila, učinite isto.

```bash
sudo ./setup-firewall.sh --status | grep -c dport   # treba dati 8, ne 16
```

---

## 11. Isključivanje svega

Ograničenja poslužitelja: postavite ključeve na `0` ili ih izbrišite iz svog `.toml`-a i ponovno pokrenite prijemnik. Drugog stanja nema; ništa ne preživljava ponovno pokretanje.

Vatrozid:

```bash
sudo ./setup-firewall.sh --remove
```

To briše tablicu, uklanja spremljeni skup pravila i onemogućuje uslugu pri pokretanju. Vaš se stroj vraća točno u stanje u kojem je bio prije — što na većini instalacija znači bez ikakvog vatrozida. O tome vrijedi razmisliti prije uklanjanja.
