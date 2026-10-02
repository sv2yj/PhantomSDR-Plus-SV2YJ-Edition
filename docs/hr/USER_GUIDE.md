# Korisnički vodič za PhantomSDR-Plus

Dobrodošli u PhantomSDR-Plus! Ovaj će vam vodič pomoći da izvučete najviše iz slušanja putem WebSDR-a.

---

## Sadržaj

1. [Uvod](#uvod)
2. [Početak rada](#početak-rada)
3. [Pregled sučelja](#pregled-sučelja)
4. [Osnovne radnje](#osnovne-radnje)
5. [Napredne značajke](#napredne-značajke)
6. [Načini demodulacije](#načini-demodulacije)
7. [Digitalni dekoderi](#digitalni-dekoderi)
8. [Tipkovni prečaci](#tipkovni-prečaci)
9. [Oznake](#oznake)
10. [Upotreba na mobilnim uređajima](#upotreba-na-mobilnim-uređajima)
11. [Savjeti i dobre prakse](#savjeti-i-dobre-prakse)
12. [Rješavanje problema](#rješavanje-problema)
13. [Često postavljana pitanja](#često-postavljana-pitanja)

---

## Uvod

### Što je PhantomSDR-Plus?

PhantomSDR-Plus je softverski definirani radio (SDR) koji radi u web-pregledniku i omogućuje vam slušanje radijskih signala preko interneta. S vaše strane nisu potrebni ni poseban softver ni hardver — dovoljan je moderan web-preglednik!

### Što možete slušati?

Ovisno o konfiguraciji WebSDR-a, možete se ugoditi na:

- **Amaterski radio**: radioamatere diljem svijeta
- **Radiodifuzijske postaje**: AM/FM radio, kratkovalne emisije
- **Zrakoplovstvo**: kontrolu zračnog prometa, komunikacije zrakoplova
- **Pomorstvo**: veze brod-obala, pomorsku meteorologiju
- **Meteorološke satelite**: NOAA, METEOR-M
- **Digitalne načine rada**: FT8, RTTY, PSK31 i druge
- **Uslužne postaje**: signale točnog vremena, vojne, državne

### Sistemski zahtjevi

- **Preglednik**: Chrome/Edge (preporučeno), Firefox, Safari
- **Veza**: širokopojasni internet (preporučuje se 1 Mbit/s ili više)
- **Zvuk**: ispravni zvučnici ili slušalice
- **Neobavezno**: miš s kotačićem za lakše ugađanje

---

## Početak rada

### 1. Pristupite WebSDR-u

Otvorite preglednik i idite na adresu WebSDR-a koju vam je dao operater.

Primjer: `http://websdr.example.com:9002`

### 2. Prvo učitavanje stranice

Kada se stranica učita, vidjet ćete:
- šareni prikaz slapa koji pokazuje radijsku aktivnost
- upravljačku ploču s prikazom frekvencije i gumbima
- S-metar koji pokazuje jakost signala
- brojač korisnika

### 3. Počnite slušati

1. **Kliknite na signal** u prikazu slapa
2. **Zvuk će se automatski pokrenuti**
3. **Podesite glasnoću** pomoću regulatora glasnoće preglednika ili klizača na zaslonu
4. **Fino ugodite frekvenciju** klikom točno na signal

---

## Pregled sučelja

### Glavni dijelovi

```
┌──────────────────────────────────────────────────────────────────────────┐
│  WebSDR <callsign>, located in <QTH>              ⚙ [ Analog S-Meter ▾ ] │
│  email · Keyboard Shortcuts · Users · Stats · Other servers 1 2 3        │
│  Frequency Search: MW SW HamDash PSK Reporter WSPRnet · Callsign Search  │
│                        [ Open Additional Info ]                          │
├──────────────────────────────────────────────────────────────────────────┤
│                     Spectrum  +  Waterfall                               │
│                     band-plan strip along the bottom                     │
├───────────────────────┬────────────────────────────┬─────────────────────┤
│ Audio & Buffer        │   Frequency  │  S-Meter    │ Waterfall Controls  │
│   volume · SQ · zoom  │   7,120.00   │  dBm dBμV   │   Min · Max · zoom  │
│ AGC Auto Fast Med Slow│   band · VFO │  SNR · NF   │   colour-map strip  │
│   Compressor Equalizer├────────────────────────────┤ Zoom In Out Max Min │
│ Filters               │  Fine Tuning (kHz)         │ Waterfall Spectrum  │
│   NR NB NS AN CTCSS   │  VFO A · Modes · Bands     │ Auto Adj. Height    │
│ Modes selector        │           · IF Filters     │ [ profile ▾ ]       │
│   ...  RADEL  RADEU   │  Wheel Tuning Steps        │ [ Bookmarks ]       │
│   USB LSB CW AM QUAM  │  Decoders                  │                     │
│   FM                  │   FT8 FT4 FT2 JS8 CW WSPR  │                     │
│ Band selector         │   FAX SSTV NAVTEX RTTY ... │                     │
└───────────────────────┴────────────────────────────┴─────────────────────┘
```

Tri ploče ispod slapa pomiču se kao jedna stranica; u uskom se prozoru slažu jedna ispod druge umjesto jedna uz drugu. **RADEL** i **RADEU** stoje na samom retku naslova *Modes selector*, njemu zdesna.

### 1. Prikaz slapa

Slap je vizualni prikaz radijskih signala:

- **Vodoravna os**: frekvencija
- **Okomita os**: vrijeme (pomiče se prema dolje)
- **Boje**: jakost signala
  - **Tamnoplava/crna**: nema signala (razina šuma)
  - **Zelena/žuta**: slabi do umjereni signali
  - **Narančasta/crvena**: jaki signali
  - **Bijela**: vrlo jaki signali

### 2. Prikaz frekvencije

Prikazuje trenutačno ugođenu frekvenciju u raznim formatima:
- **MHz**: 7.100.000 MHz (KV pojasevi)
- **kHz**: 14200 kHz
- **Hz**: 145500000 Hz (VHF/UHF)

### 3. S-metar (analogni ili digitalni)

Prikazuje jakost signala:
- **S1-S9**: standardna ljestvica jakosti signala
- **+dB**: signali iznad S9 (npr. S9+20dB)
- **Analogni ili digitalni**: ovisno o konfiguraciji

### 4. Gumbi načina rada

Odaberite način demodulacije:
- **AM**: amplitudna modulacija
- **FM**: frekvencijska modulacija
- **USB**: gornji bočni pojas
- **LSB**: donji bočni pojas
- **CW**: Morseov kod (neprekinuti val)
- **WBFM**: širokopojasni FM (radiodifuzija)
- **QUAM**: C-QUAM AM stereo — natpis postaje zelen kada se otkrije stereo pilot

Uz naslov **Modes selector** nalaze se gumbi **RADEL** i **RADEU**, koji jednim pritiskom pokreću RADE v1 digitalni glas — pogledajte [Digitalni dekoderi](#digitalni-dekoderi).

### 5. Upravljačka ploča

Dodatne kontrole:
- **AGC**: automatska regulacija pojačanja
- **NR**: smanjenje šuma (spektralno)
- **NB**: prigušivač impulsnog šuma
- **NS**: potiskivanje pozadinskog šuma
- **AN**: automatski notch
- **CTCSS**: squelch podtonom (FM)
- **SQL**: squelch
- **AI**: smanjenje šuma umjetnom inteligencijom (samo govor)
- **Zoom**: razina uvećanja slapa
- **Wheel Tuning Steps**: korak ugađanja kotačićem miša
- **Decoders**: gumbi koji jednim pritiskom pokreću i zaustavljaju svaki dekoder

### 6. Preklop plana pojaseva

Obojene trake koje prikazuju dodjelu frekvencija:
- različite boje za različite službe
- pomažu prepoznati što je dopušteno na kojoj frekvenciji

---

## Osnovne radnje

### Ugađanje na frekvenciju

#### Način 1: klik na slap

1. Kliknite izravno na signal u slapu
2. Prijamnik će se ugoditi na tu frekvenciju
3. Zvuk će se početi reproducirati

#### Način 2: upis frekvencije

1. Kliknite na prikaz frekvencije
2. Upišite željenu frekvenciju
3. Pritisnite Enter

Primjeri:
- `7100` → 7.100 MHz
- `14200.0` → 14.200 MHz
- `145.500` → 145.500 MHz

#### Način 3: kotačić miša

1. Postavite pokazivač iznad prikaza frekvencije
2. Kotačić prema gore povećava frekvenciju
3. Kotačić prema dolje smanjuje frekvenciju

#### Način 4: gumbi koraka

1. Koristite gumbe **▲** i **▼** pokraj frekvencije
2. Veličina koraka ovisi o načinu rada:
   - **AM/FM**: koraci od 1 kHz
   - **SSB**: koraci od 100 Hz
   - **CW**: koraci od 10 Hz

### Skener

Skener vodi prijemnik preko raspona kanala i zaustavlja se na prvom na kojem ima signala. Nalazi se u retku **Fine Tuning (kHz)**, skroz desno:

```
7 152.0   ◀  ■  ▶  ⊘   30 dB · 4 ▾
```

| Kontrola | Što radi |
|----------|-----------|
| **◀ ▶** | Pretraga dolje / gore. Dok stoji na signalu, strelica nastavlja pretragu. |
| **■** | Zaustavljanje. |
| **⊘** | Isključi ovaj kanal iz pretrage — za trajni nosilac ili smetnju. |
| **30 dB · 4 ▾** | Prag, a pokraj njega razina koja se upravo mjeri. Otvara postavke. |

Tekst lijevo pokazuje što skener radi: `Scanner` u mirovanju, frekvenciju do koje je došao tijekom pretrage, `◉ 3s` dok odbrojava do nastavka, `◉ 30·22s` dok je kanal još zauzet, `◉ hold` kad ostaje na mjestu.

**Postavke**

- **Range** — *Scan Band* pretražuje pojas u kojem pretraga počinje;
  *Scan Visible* pretražuje točno ono što slap prikazuje i prati ga ako
zumirate ili ga pomaknete.
- **Scan** — *Every channel* ugađa i sluša svaki kanal redom;
  *Skip empty* čita spektar i skoči ravno na signale.
- **Stop at** — koliko iznad šuma pojasa kanal mora biti da bi zaustavio
pretragu, u dB. Šum se prati neprekidno pa ista postavka vrijedi danju i noću. Prazan kanal ne pokazuje 0 dB — pogledajte na trenutak vrijednost na gumbu i postavite prag iznad nje.
- **Resume after** — koliko dugo kanal mora biti tih prije nego što pretraga
krene dalje. Stanke u govoru je ne pokreću ponovno. *Hold* ostaje dok ne pritisnete gumb.
- **Max stay** — kreće dalje nakon ovog vremena i ako je signal još tu, da
trajni nosilac ne bi zadržao pretragu zauvijek.

Korak prati način rada — 1 kHz u SSB, 0,1 kHz u CW, 5 kHz u AM, 9 ili 10 kHz na srednjim valovima i 9 kHz na dugim — a zaustavljanja padaju na mrežu kanala. Pretraga ostaje unutar svojeg raspona i unutar onoga što prijemnik može ugoditi; na rubu se vraća na drugi kraj i nastavlja.

Postavke i isključeni kanali pamte se u vašem pregledniku.


### Odabir načina demodulacije

Odaberite način prikladan signalu:

**Za govorne komunikacije:**
- **AM**: zrakoplovstvo, AM radiodifuzija, dio amaterskog prometa
- **FM**: VHF/UHF repetitori, FM radiodifuzija
- **USB**: KV amaterski radio (20 m, 17 m, 15 m, 12 m, 10 m)
- **LSB**: KV amaterski radio (160 m, 80 m, 40 m, 30 m)

**Za podatke/digitalne načine:**
- **USB**: većina digitalnih načina (FT8, PSK31, RTTY)
- **LSB**: neki digitalni načini na nižim KV pojasevima

**Za Morseov kod:**
- **CW**: telegrafski/Morseovi signali

### Podešavanje glasnoće

- **Klizač na zaslonu**: povucite klizač glasnoće
- **Glasnoća preglednika**: koristite medijske kontrole preglednika
- **Glasnoća sustava**: podesite glasnoću računala
- **Tipkovnica**: koristite tipke + i - (ako su podržane)

### Upotreba S-metra

S-metar prikazuje jakost signala:

- **S0-S3**: vrlo slab signal, teško ga je pratiti
- **S4-S6**: slab do osrednji signal
- **S7-S9**: dobar do jak signal
- **S9+**: iznimno jak signal

**Savjet**: za najbolji zvuk ugodite se na signale koji pokazuju S7 ili više.

**Promjena izgleda instrumenta**: na analognom (kazaljčnom) S-metru kliknite na sam instrument — ili ga fokusirajte i pritisnite Enter ili Razmaknicu — da biste prošli kroz tri pozadine: tamni brušeni metal, svijetlu blijedosivu skalu i toplu jantarnu skalu u vintage stilu. Vaš preglednik pamti izbor, pa ostaje i nakon osvježavanja ili ponovnog pokretanja. Vrijedi po pregledniku i po adresi: otvaranje prijamnika preko imena računala i preko IP-a daje dvije odvojene postavke, a privatni prozor uvijek kreće od zadane vrijednosti stranice.

---

## Napredne značajke

### Automatska regulacija pojačanja (AGC)

AGC automatski podešava razine zvuka:

- **Off**: bez automatske regulacije pojačanja
- **Slow**: postupne promjene razine (najbolje za SSB)
- **Medium**: uravnotežen odziv
- **Fast**: brzo podešavanje (najbolje za AM)

**Preporuka**: počnite s „Fast" za AM i „Slow" za SSB.

### Četiri regulatora šuma

NR, NB, NS i AN zasebni su prekidači, svaki protiv druge vrste šuma. Neovisni su — uključivanje jednoga ne uključuje drugi — i mogu se slobodno kombinirati.

Nijedan ne doseže dekodere: FT8, CW, WSPR, SSTV, FAX, NAVTEX, RTTY/PSK31/Olivia i QRSS grabber čitaju zvuk *prije* ovih filtara, pa ih možete namještati isključivo po sluhu bez utjecaja na dekodiranje. Vidjeti
[priručnik za dekodere](DECODERS.md#12-opći-savjeti).

### Smanjenje šuma (NR)

Spektralno smanjenje šuma. Procjenjuje razinu šuma u svakom dijelu zvučnog spektra i te dijelove stišava, a ono što se izdiže iznad šuma ostavlja na miru.

**Koristite kada**: čujete ravnomjerno siktanje ili bijeli šum iza signala.

Postojani tonovi — CW nota, nosilac — prepoznaju se kao signal i štite, pa NR ne pojede CW signal kako bi to učinio naivan filtar. Tipičan učinak: 10 dB manje šuma između riječi, uz gubitak od nekoliko desetinki dB na samom govoru.

### Prigušivač impulsnog šuma (NB)

Uklanja impulsni šum: klikove, praskove, atmosferske izboje, paljenje motora i smetnje s dalekovoda. Prati ovojnicu zvuka i utišava samo uzorke koji daleko iskaču iznad nje — oko jedne milisekunde po prasku, s mekim ulazom i izlazom kako samo prigušivanje ne bi kliknulo.

**Koristite kada**: čujete klikove ili praskove s dalekovoda, motora, grmljavine
ili paljenja vozila.

Notch filtri mrežnog bruma na 50 Hz i 60 Hz slijede ovu tipku.

### Potiskivanje pozadinskog šuma (NS)

Kroz nekoliko sekundi mjeri vlastiti prag šuma pojasa i stalnim iznosom stišava sve što leži na njemu, dublje na visokim nego na niskim zvučnim frekvencijama. Dok NR reagira iz trenutka u trenutak, NS je spora, mirna ruka: spušta šum pojasa ne mijenjajući kako signal zvuči.

**Koristite kada**: pojas je miran ali šuman, a želite spustiti šum bez
„podvodnog" prizvuka agresivnog NR-a.

Djeluje samo u USB, LSB i AM — CW, FM i digitalni načini ostaju netaknuti. Prag mjeri iznova pri svakoj promjeni frekvencije ili načina rada i smiri se unutar nekoliko sekundi.

### Automatski notch (AN)

Sam pronalazi i uklanja postojane ometajuće tonove — heterodine, nosioce, zvižduke — bez ručnog postavljanja notcha. Neprekidno se prilagođava, pa istodobno uklanja više tonova i drži prigušenim ton koji klizi.

**Koristite kada**: čujete zvižduk ili ton preko željenog signala.

Zaobiđen u CW-u, gdje je željeni signal *upravo* postojan ton.

**Napomena o kašnjenju**: NR i NS dok su uključeni dodaju svaki oko 40 ms
kašnjenja zvuka (oba zajedno oko 80 ms). NB i AN ne dodaju ništa. To se tiče samo slušanja, nikada dekodera.

### Automatski squelch (SQL)

Utišava zvuk kada nema signala:

- **Off**: uvijek se čuje (uz šum)
- **Auto**: automatski postavlja prag
- **Manual**: prag se podešava ručno

**Koristite kada**: nadzirete frekvenciju u očekivanju prometa.

### Smanjenje šuma umjetnom inteligencijom (AI)

Tipka **AI**, s klizačem jačine pokraj nje, nalazi se na ploči Audio & Buffer odmah ispod SQ. Na stranici /mobile nalazi se na kartici Audio, ispod Squelch. Uklanja šum pojasa iz govora pomoću RNNoise, male neuronske mreže naučene na govoru.

Sve se odvija u vašem pregledniku: ništa se ne šalje na vanjski poslužitelj, nije potreban račun, a prijamnik nema nikakav dodatni posao.

- **Uključivanje**: kliknite **AI**; tipka postaje plava. Prvi klik preuzima modul (oko 1,3 MB), a tipka pulsira dok se učitava.
- **Jačina**: klizač miješa pročišćeni zvuk s izvornim — na 100 % sve je obrađeno, niže vrijednosti vraćaju dio pojasa. Zadano je 50 %. Možete ga namjestiti i dok je AI isključen.
- **Oznaka stanja**: oznaka AI ispod prikaza frekvencije svijetli cijan dok AI radi, a prikazuje se napola prigušena kad je AI uključen, ali trenutni način nije govorni.

**Koristite kad**: slušate SSB ili AM govor na pojasu s puno šuma. Šum između riječi obično padne za 10–20 dB, a govor zadržava svoju razinu.

Samo govorni načini — USB, LSB, AM i SAM. U CW, FM, digitalnim načinima i C-QUAM zvuk prolazi nepromijenjen, jer mreža CW ton ili glazbu smatra šumom. Kao ni četiri kontrole šuma, nikad ne dopire do dekodera. Kod vrlo slabih postaja (oko 0 dB SNR) govor može zvučati obrađeno; ako signal zvuči „vodenasto“, smanjite klizač. Dodaje oko 30 ms kašnjenja zvuka.

### Funkcija uvećanja

Uvećava prikaz slapa:

- **1x**: uobičajen prikaz (široka pokrivenost)
- **2x**: uvećanje ×2
- **4x**: uvećanje ×4
- **8x**: uvećanje ×8

**Koristite kada**: trebate jasnije vidjeti signale ili se precizno ugoditi.

### Upravljanje primopredajnikom (CAT)

Vaš primopredajnik i stranica prijemnika mogu ostati na istoj frekvenciji: okrenite gumb za ugađanje na uređaju i slap ga slijedi, ili kliknite signal na slapu i uređaj se ugodi na njega. To se odnosi samo na *vašu* sesiju slušanja; nitko drugi na prijemniku to ne primjećuje.

**S aplikacijom Desktop PhantomSDR+ (4.0 ili novija).** Desktop aplikacija ima izbornik **Rig**. *Rig → Rig control...* otvara prozor u kojem birate svoj uređaj i način povezivanja, a sam izbornik uključuje i isključuje sinkronizaciju. Sinkronizira frekvenciju, način rada i širinu filtra, u jednom ili oba smjera, i može utišati prijemnik dok odašiljete. Osim PhantomSDR-Plusa na isti način upravlja i prijemnicima **KiwiSDR, PA3FWM WebSDR i UberSDR**. Do uređaja dolazi na jedan od četiri načina:

- **Ugrađeni upravljači** — bez drugog softvera: Icom (CI-V), Yaesu (novi CAT i FT-817/857/897), Kenwood, Elecraft, FlexRadio SmartSDR CAT, QRP Labs i ostali uređaji kompatibilni s Kenwoodom.
- **Hamlib** — svaki uređaj koji Hamlib poznaje, više od 300, odabran s popisa s pretraživanjem. Instalacijski programi za Windows sadrže Hamlib; na Linuxu instalirajte `libhamlib-utils`.
- **rigctld na mreži** — `rigctld` koji je već pokrenut.
- **flrig** — za uređaj koji flrig već dijeli s fldigijem, WSJT-X-om ili dnevnikom veza.

Aplikacija, njezini instalacijski programi i cijeli priručnik nalaze se na [Desktop PhantomSDR+ (Dropbox)](https://www.dropbox.com/scl/fo/kjwj96zg3kj7dgq4fjef9/APnA3c9hhv4hk3YMGIGjH7s?rlkey=jfiwklly63kv73poalx631pk3&st=m37uvaym&dl=0).

**S web preglednikom.** [CATsync Tool for WebSDRs](https://catsyncsdr.wordpress.com/) (Windows) povezuje uređaj sa stranicom prijemnika otvorenom u vašem pregledniku. Sinkronizira frekvenciju i način rada.

**Širina filtra i utišavanje pri odašiljanju** rade na prijemnicima KiwiSDR, WebSDR i UberSDR te na PhantomSDR-Plus prijemniku s inačicom 4.1.0 ili novijom. Na starijem PhantomSDR-Plusu frekvencija i način rada i dalje se sinkroniziraju; filtar ne.

Cijeli priručnik — svaka postavka, podržani uređaji, kako se sprječava da se strane „svađaju” i rješavanje problema — nalazi se u **[Upravljanje primopredajnikom](RIG_CONTROL.md)**.

**Za programere.** Svaka stranica prijemnika nudi ove funkcije na `window`, a njih koriste oba alata:

| Funkcija | Što radi |
|---|---|
| `catsync_getFrequency()` / `catsync_setFrequency(hz)` | Ugođena frekvencija, u Hz |
| `catsync_getMode()` / `catsync_setMode(mode)` | `USB`, `LSB`, `CW`, `CW-L`, `AM`, `FM`, `WBFM` … |
| `catsync_getBandwidth()` / `catsync_setBandwidth(hz)` | Ukupna širina propusnog pojasa, u Hz. Postavite je nakon načina rada: promjena načina vraća propusni pojas na zadano |
| `catsync_getMute()` / `catsync_setMute(on)` | Utišavanje, preko gumba za utišavanje na stranici |
| `catsync_ready` | `true` čim su funkcije postavljene |

Posljednja tri retka nova su u inačici 4.1.0; prije poziva provjerite postoji li funkcija.

---

## Načini demodulacije

### AM (amplitudna modulacija)

**Koristi se za:**
- zrakoplovne komunikacije
- AM radiodifuziju
- dio amaterskog radija
- pomorske komunikacije

**Značajke:**
- široki pojas (obično 10 kHz)
- osjetljiva na šum
- lako se ugađa (dovoljno je kliknuti na signal)

**Dobre prakse:**
- koristite brzi AGC
- uključite prigušivač impulsnog šuma ako čujete klikove
- ugodite se na vrh signala u slapu

### QUAM (C-QUAM AM stereo)

**Koristi se za:**
- Srednjovalne postaje koje emitiraju AM stereo

**Značajke:**
- Širina 10 kHz, dekodira se kao stereo par umjesto mono AM-a
- Natpis na gumbu sam postaje **zelen** kada je prisutan stereo pilot od 25 Hz, pa vidite koje postaje doista emitiraju u stereu prije nego što ga odaberete
- Iz AM-a novi pritisak prebacuje na sinkronu detekciju na nosiocu; natpis postaje **žut** i prikazuje `SAM`. Treći pritisak vraća na obični AM
- C-QUAM zvuk prenosi se Opusom; svi ostali načini koriste FLAC

**Preporuke:**
- Noću tražite zeleni natpis na jakim srednjovalnim signalima
- Ako stereo zvuči nestabilno, `SAM` je mirniji izbor uz slab nosilac

### FM (frekvencijska modulacija)

**Koristi se za:**
- VHF/UHF amaterske repetitore
- javne službe (policija, vatrogasci, hitna pomoć)
- komercijalni dvosmjerni radio
- neke satelitske komunikacije

**Značajke:**
- uski pojas (obično 12,5 ili 25 kHz)
- izvrsna otpornost na šum
- „efekt zahvata" (pobjeđuje najjači signal)

**Dobre prakse:**
- ugodite se precizno na sredinu signala
- koristite squelch za utišavanje u mirovanju
- isključite smanjenje šuma (nije potrebno)

### USB (gornji bočni pojas)

**Koristi se za:**
- KV amaterski radio (iznad 10 MHz)
- većinu digitalnih KV načina rada
- pomorske komunikacije (iznad 8 MHz)

**Značajke:**
- uski pojas (obično 2.4 kHz)
- učinkovito iskorištenje spektra
- zahtijeva precizno ugađanje

**Dobre prakse:**
- koristite spori AGC
- ugodite se na donji rub signala u slapu
- po potrebi uključite smanjenje šuma

### LSB (donji bočni pojas)

**Koristi se za:**
- KV amaterski radio (ispod 10 MHz)
- neke digitalne KV načine rada
- pomorske komunikacije (ispod 8 MHz)

**Značajke:**
- isto kao USB, ali zrcalno
- konvencija: LSB na nižim KV pojasevima

**Dobre prakse:**
- koristite spori AGC
- ugodite se na gornji rub signala u slapu
- po potrebi uključite smanjenje šuma

### CW (neprekinuti val / Morseov kod)

**Koristi se za:**
- amatersku telegrafiju
- navigacijske svjetionike
- postaje signala točnog vremena

**Značajke:**
- vrlo uski pojas (100-500 Hz)
- velika učinkovitost
- za razumijevanje je potrebno poznavanje Morseova koda

**Dobre prakse:**
- koristite uski filtar (400-500 Hz)
- ugodite se precizno na sredinu tona
- uključite audiofiltar za bolji ton

### CW-L (CW, donji bočni pojas)

Isti Morseov filtar od ±250 Hz kao **CW**, ali se ton uzima ispod nosioca umjesto iznad njega. Korisno kada se signal bolje prima s donje strane ili kada smetajući nosilac leži tik iznad željenoga.

**Na stolnoj stranici nema gumba CW-L.** Njezin red načina rada je `USB · LSB · CW · AM · QUAM · FM`. CW-L se nudi na pojednostavljenoj stranici `/mobile`, a na stolnoj se i dalje može postaviti poveznicom ili knjižnom oznakom koja ga imenuje.

### WBFM (širokopojasni FM)

**Koristi se za:**
- FM radiodifuziju (88-108 MHz)
- neke satelitske silazne veze

**Značajke:**
- vrlo široki pojas (200 kHz)
- izvrsna kvaliteta zvuka
- visoka vjernost

**Dobre prakse:**
- ugodite se točno na središnju frekvenciju
- za radiodifuziju squelch nije potreban
- uživajte u zvuku visoke kvalitete!

---

## Digitalni dekoderi

PhantomSDR-Plus uključuje ugrađene dekodere za digitalne načine rada. Za potpuni vodič pogledajte [Dekoderi](DECODERS.md).

Najbrži je put red gumba **Decoders** na glavnoj ploči, odmah ispod **Wheel Tuning Steps**: deset gumba — **FT8, FT4, FT2, JS8, CW, WSPR, FAX, SSTV, NAVTX, RTTY** — od kojih svaki jednim pritiskom pokreće svoj dekoder, uključuje glavni prekidač Decoder i dovodi prozor dekodera na zaslon. Gumb ostaje plav dok dekoder radi; pritisnite ga ponovno da zaustavite dekoder i zatvorite njegov prozor. Padajući izbornik **Decoder Options** radi točno kao i prije te ostaje usklađen s gumbima.

**RADEL** i **RADEU** (RADE v1 digitalni glas) imaju vlastite gumbe uz naslov **Modes selector** te u skočnim prozorima **Modes** i **Bands**, i rade na isti način: pritisak za pokretanje, ponovni pritisak za zaustavljanje.

Dekoderi za SSTV, HF FAX, NAVTEX, FSK/RTTY i CW rade svaki u vlastitoj pozadinskoj dretvi, pa uključivanje ili isključivanje dekodera nikada ne prekida zvuk, a slap ostaje gladak tijekom dekodiranja. Dobivaju zvuk uzet prije AGC-a, smanjenja šuma i utišavanja — možete utišati prijamnik, a dekodiranje se nastavlja bez smetnji.

**Dok dekoder radi, drži način rada i propusni pojas.** Uobičajeno način rada slijedi plan opsega — ugodite u odsječak označen kao LSB ili AM i prijamnik se prebaci. Dekoder koji radi nadjačava to i zadržava način rada i uski propusni pojas koji mu treba, čak i ako odete na drugi opseg. Vlastiti način rada opsega vraća se čim isključite dekoder, a gumbi načina rada rade u svakom trenutku ako želite preuzeti upravljanje. CW dekoder je iznimka: dekodira u načinu rada u kojem slušate.

### FT8 i FT4 dekoder

**Što su FT8 i FT4?**
- popularni digitalni načini rada u amaterskom radiju
- komunikacija slabim signalima
- emisije od 15 sekundi za FT8 i 7,5 sekundi za FT4

**Kako se koristi:**
1. Ugodite se na FT8 ili FT4 frekvencije
2. Odaberite način USB
3. Uključite FT8 dekoder — pritisnite gumb **FT8** ili ga odaberite iz izbornika
4. Promatrajte kako se pojavljuju dekodirane poruke

**Uobičajene FT8 frekvencije (USB):**
- 160 metara: 1.840 MHz
- 80 metara: 3.573 MHz
- 60 metara: 5.357 MHz
- 40 metara: 7.074 MHz
- 30 metara: 10.136 MHz
- 20 metara: 14.074 MHz
- 17 metara: 18.100 MHz
- 15 metara: 21.074 MHz
- 12 metara: 24.915 MHz
- 10 metara: 28.074 MHz
- 6 metara: 50.313 MHz (50.323 MHz za DX)

**Uobičajene FT4 frekvencije (USB):**

- 80 m: 3.575 MHz
- 40 m: 7.0475 MHz
- 30 m: 10.140 MHz
- 20 m: 14.080 MHz
- 17 m: 18.104 MHz
- 15 m: 21.140 MHz
- 12 m: 24.919 MHz
- 10 m: 28.180 MHz
- 6 m: 50.318 MHz

---

### JS8 dekoder

**Što je JS8?**
- FT8-ov mehanizam za slabe signale, korišten za razgovor s tipkovnice na tipkovnicu
- Slobodan tekst umjesto fiksnih poruka: duge poruke stižu kroz nekoliko ciklusa
- Pet brzina; **Normal** (15 s) je pozivna brzina i nosi gotovo sav promet

**Kako se koristi:**
1. Ugodite se na JS8 frekvenciju
2. Odaberite način **USB**
3. Uključite JS8 dekoder — tipka **JS8** ili iz izbornika
4. Ostavite **Speed** na *Normal*, a sync offset na **Auto**

**Kako čitati ploču:**
- Poruke koje još pristižu prikazuju se na vrhu zeleno, s trepćućim pokazivačem — na Normal poruka može trajati punu minutu
- Dovršene se navode ispod kao `Mode | Hz | dB | Message`, s **pozivnim znakovima u zelenom**
- Blijed, kurzivni redak istekao je prije posljednjeg okvira: tekst je stvaran, ali može biti skraćen

**Uobičajene JS8 frekvencije (USB):**

- 160m: 1.842 MHz
- 80m: 3.578 MHz
- 40m: 7.078 MHz
- 30m: 10.130 MHz
- 20m: 14.078 MHz
- 17m: 18.104 MHz
- 15m: 21.078 MHz
- 12m: 24.922 MHz
- 10m: 28.078 MHz

JS8 je mnogo tiši od FT8 — jedna emisija svakih nekoliko minuta je normalna, a tišina nije kvar. Potpuni vodič: [Dekoderi](DECODERS.md).

---

### CW dekoder
Samo pritisnite gumb CW i pojavit će se dekodirani tekst. Pritisnite gumb CW još jednom da očistite prozor i ponovno pokrenete dekoder.

---

### WSPR

WSPR (Weak Signal Propagation Reporter, izgovara se „whisper") način je rada svjetionika s iznimno slabim signalima koji kartira putove KV prostiranja diljem svijeta. Svaka emisija traje otprilike 110 sekundi i stane u kanal širine 200 Hz. Dekoder čeka potpuni dvominutni interval usklađen s UTC-om prije dekodiranja. Uključite dekoder i s padajućeg popisa odaberite **WSPR**. Ili jednostavno pritisnite gumb **WSPR**.

---

### HF FAX / WEFAX

HF radiofaks (poznat i kao WEFAX) koriste obalne straže i meteorološke službe diljem svijeta za emitiranje vremenskih karata, karata stanja mora i prizemnih analiza na kratkim valovima. Dekoder rekonstruira sliku redak po redak kako je prima.

---

### NAVTEX

NAVTEX je međunarodni pomorski sustav emitiranja obavijesti o sigurnosti u priobalju — navigacijskih upozorenja, vremenskih prognoza te obavijesti o traganju i spašavanju.

---

### FSK / RTTY, PSK31 i Olivia

Univerzalni dekoder za uskopojasne tekstualne načine rada, s pet inačica u jednom prozoru: pomorski FSK (SITOR), meteorološki RTTY, amaterski RTTY, **PSK31** (fazno ključanje, 31,25 bauda) i **Olivia** (viševalni FSK s korekcijom pogrešaka). Ploča se prilagođava inačici — kontrole za shift, baud i okvir nestaju za PSK31 i Oliviju, a Olivia dodaje birač Mode i klizač squelcha.

Dvije stvari treba znati: PSK31 sam ispravlja pogrešku ugađanja u rasponu od otprilike ±25 Hz, pa se dovoljno samo približiti; Olivia traži da **Mode** (tonovi / širina pojasa) točno odgovara emisiji, ne šalje preambulu i stoga joj treba nekoliko sekundi za sinkronizaciju prije nego što se pojavi tekst. Ploča se otvara na Olivia **8 / 250**.

---

### QRSS grabber

QRSS je CW poslan tako sporo da jedna točka traje sekundama, i gleda se umjesto da se sluša — grabber crta trag na vlastitom prikazu. Nije u izborniku dekodera; ima vlastiti odjeljak **QRSS** i može raditi istodobno s dekoderom.

Pritisnite **🐌 Show**, zatim odaberite prozor s popisa **Band** i pritisnite **Tune**: prijamnik odlazi na tu frekvenciju u **CW**-u s propusnim pojasom skrojenim za taj način rada, a trag pada na središnju crtu prikaza. Najprometniji je prozor na 30 m (10.140,00 kHz). Postavite **Speed** prema svjetioniku — **QRSS 10** ako ne znate — i budite strpljivi: pozivnom znaku može trebati deset minuta da prijeđe zaslon. Sve pojedinosti u [Dekoderi](DECODERS.md).

---

### SSTV

Televizija sporog raščlanjivanja šalje nepomične slike običnim SSB kanalom, redak po redak. Uključite dekoder, odaberite **SSTV** i ugodite se na SSTV frekvenciju — 14.230 MHz glavna je međunarodna pozivna frekvencija. Ostavite **Mode** na **Auto**: dekoder čita VIS zaglavlje emisije, a ako ste se ugodili nakon zaglavlja, način rada prepoznaje prema vremenskim odnosima sinkronizacije. Podržani su načini Martin, Scottie i Robot, a slika se gradi redak po redak kako pristiže. Ili jednostavno pritisnite gumb **SSTV**.

### Automatska prijava spotova i grafikoni poslužitelja

Dekodiranja FT8, FT4 i WSPR može slati i sam poslužitelj — FT8/FT4 na PSK Reporter, WSPR na WSPRnet — pomoću autorun daemona koji sysop pokreće s administratorske ploče. Neovisan je o dekoderima u vašem pregledniku: radi bez obzira sluša li tko ili ne, a ništa što dekodirate u pregledniku ne prijavljuje se.

Sysop ga prati preko dva brojača koja je lako zamijeniti: pločice po dekoderu broje spotove poslane od zadnjeg pokretanja daemona, dok je broj uz svaki potvrdni okvir pojasa/načina rada ukupan zbroj tog mjesta od početka i preživljava ponovna pokretanja. Ista ploča ima stranicu **Grafikoni** koja crta frekvenciju procesora, opterećenje, temperaturu i broj korisnika kroz zadnjih 15 minuta do 24 sata. Oboje je opisano u [vodiču za administratorsku ploču](ADMIN_PANEL_SETUP.md).


---

## Tipkovni prečaci

Tipkovni prečaci za brži rad.

---

### Upravljanje frekvencijom

Prikaz frekvencije je niz znamenki kojima upravljate izravno. **Najprije kliknite znamenku** — time je odabirete, a sve niže djeluje na odabir.

- **Strelica lijevo / desno**: pomiče odabir na susjednu znamenku (osam znamenki, od 100 MHz do 10 Hz)
- **Strelica gore / dolje**: povećava ili smanjuje *odabranu* znamenku za njezinu mjesnu vrijednost — 1 MHz na znamenki MHz, 10 Hz na zadnjoj
- **0 – 9**: upisuje tu znamenku izravno na odabrano mjesto

**Kotačić miša iznad prikaza frekvencije**: pomiče se korakom ugađanja pojasa (1 kHz osim ako plan pojasa kaže drukčije). Držite **Shift** za 1 kHz, **Alt** za 10 kHz.

**Kotačić miša iznad slapa**: zumira. Držite **Ctrl** (ili **Cmd**) odnosno **Shift** za ugađanje umjesto zumiranja, a **Shift + Ctrl** zajedno za poravnanje na najbliži cijeli kHz.

> Prečaca Page Up / Page Down nema.

---

## Oznake

Spremite omiljene frekvencije za brzi pristup. Popis oznaka možete i izvesti te spremiti lokalno, a zatim ga uvesti u bilo koji drugi PhantomSDR.

Kada se oznake i markeri preklapaju:

🔵 Plave se oznake prikazuju iznad <br /> 🟡 Žuti se markeri prikazuju ispod <br />
✅ Klikovi na oznake imaju prednost <br />


### Dodavanje oznake

1. Ugodite se na željenu frekvenciju
2. Kliknite gumb „Bookmarks"
3. Kliknite „Add Bookmark"
4. Unesite opis
5. Kliknite „Save"

┌──────────────┬────────────────┬────────┐ │ Bookmark name│Label (optional)│ [Add]  │ └──────────────┴────────────────┴────────┘

### Kako se koristi:

**Dodavanje oznake:**
- Naziv: „Local News Station"
- Oznaka: „NEWS"
- Kliknite Add

**Prikaz u slapu:**
- uvećavajte dok se markeri ne pojave
- vidjet ćete tamnoplavi okvir s natpisom „NEWS" podebljano žutim

**Klik na oznaku:**
- ugađa na frekvenciju
- postavlja način demodulacije
- radi jednako kao klik na marker

### Upravljanje oznakama
- **Uređivanje**: kliknite ikonu olovke pokraj oznake
- **Brisanje**: kliknite ikonu koša pokraj oznake
- **Izvoz**: preuzmite oznake kao JSON datoteku
- **Uvoz**: učitajte oznake iz JSON datoteke

### Dijeljenje oznaka

1. Kliknite „Export Bookmarks"
2. Podijelite JSON datoteku s drugima
3. Primatelji kliknu „Import Bookmarks"
4. Odaberu vašu datoteku
---

## Upotreba na mobilnim uređajima

PhantomSDR-Plus izvrsno radi na mobilnim uređajima!

### Dva mobilna prikaza

Prijamnik se na telefonu može koristiti na dva načina:

- **`http://vaš_poslužitelj:PORT/mobile`** — pojednostavljena stranica. Bez slapa, pa troši otprilike upola manje podataka. Unos frekvencije, koraci ugađanja, načini rada, S-metar, pojasevi, oznake, korisnici i čavrljanje.
- **Prošireni prikaz** — telefonski raspored glavnog sučelja, sa slapom i svim kontrolama.

Prebacuje se gumbima na dnu `/mobile` (**Mobile extended view**, **Full desktop view**) i gumbom **Simplified mobile** u proširenom prikazu.

**Vaša frekvencija ide s vama.** Promjena prikaza ostavlja vas na istom signalu — frekvencija i način rada putuju u poveznici, pa više ne završavate na zadanoj frekvenciji prijamnika. I adresna traka prati vaše ugađanje, pa ponovno učitavanje stranice, oznaka ili poveznica poslana nekome vraćaju točno na tu frekvenciju.

**Način rada slijedi plan pojaseva na obje stranice.** Ugodite se na segment označen kao AM, LSB, USB ili CW — upisivanjem frekvencije, koracima ili gumbom pojasa — i prijamnik prelazi na taj način rada, na pojednostavljenoj stranici jednako kao i u punom sučelju. Način koji odaberete ručno ostaje dok se krećete unutar istog segmenta, a izvan definiranih pojaseva vaš se način ne dira. Dok **RADE** (RADEL/RADEU) radi, on zadržava prijamnik, pa ga ugađanje ne prekida.

Pri prebacivanju između dva prikaza trenutačni način rada ide s vama; ako prikaz u koji prelazite nema odgovarajući, o njemu odlučuje plan pojaseva za tu frekvenciju — radiodifuzijska frekvencija stiže u AM, 40 m u LSB, CW segment u CW. `SAM` s pojednostavljene stranice postaje AM sa sinkronim detektorom u proširenom prikazu, i obratno. `RADEL` i `RADEU` postoje samo na pojednostavljenoj stranici: napuštanjem jednog od njih frekvencija se čuva, a način rada bira plan pojaseva.

Frekvencija izvan pokrivenosti prijamnika povlači se na najbliži rub, pa vas stara poveznica nikada ne može ostaviti izvan pojasa.

### Značajke posebno za mobilne uređaje

- **Kontrole prilagođene dodiru**: veliki gumbi i klizači
- **Povlačenje za ugađanje**: povucite lijevo/desno po slapu
- **Stiskanje za uvećanje**: stisnite slap za približavanje/udaljavanje
- **Vodoravni način**: okrenite uređaj za bolji pregled

### Savjeti za mobilne uređaje

1. **Koristite Wi-Fi**: prijenos zvuka troši podatkovni promet
2. **Vodoravna orijentacija**: bolji pogled na slap
3. **Slušalice**: bolja kvaliteta zvuka
4. **Spremite omiljene postaje kao oznake**: lakše im se vraćate
5. **Zatvorite druge aplikacije**: osigurava gladak rad

### Preporučeni mobilni preglednici

- **Android**: Chrome ili Samsung Internet
- **iOS**: Mozilla
- **Oba**: pobrinite se da je preglednik ažuriran

---

## Savjeti i dobre prakse

### Za najbolji prijam

1. **Birajte jake signale**: tražite narančastu/crvenu boju u slapu
2. **Ugodite se precizno**: kliknite točno na sredinu signala
3. **Odaberite ispravan način rada**: uskladite ga s vrstom signala
4. **Podesite AGC**: brzi za AM, spori za SSB
5. **Koristite NR/NB**: pomažu u uvjetima s puno šuma

### Pronalaženje aktivnosti

1. **Promatrajte slap**: boje pokazuju jakost signala
2. **Slušajte popularne frekvencije**:
   - 40 m: 7.100-7.300 MHz (LSB)
   - 20 m: 14.200-14.350 MHz (USB)
   - 2 m: 145.200-145.600 MHz (FM)
3. **Provjerite preklop plana pojaseva**: prikazuje dodjelu frekvencija
4. **Koristite oznake**: brz pristup aktivnim frekvencijama

### Razumijevanje uvjeta prostiranja

**KV danju:**
- viši pojasevi rade bolje (20 m, 15 m, 10 m)
- moguća je veza na velike udaljenosti (DX)
- čuju se radiodifuzijske postaje

**KV noću:**
- niži pojasevi rade bolje (80 m, 40 m)
- drukčiji obrasci prostiranja
- čuju se druge postaje

**VHF/UHF:**
- uglavnom optička vidljivost
- lokalne komunikacije
- ujednačeniji uvjeti

### Bonton

1. **Nemojte dugo zauzimati prijamnik**: i drugi žele slušati
2. **Koristite razgovor s poštovanjem**: budite pristojni prema drugim korisnicima
3. **Prijavite probleme**: pomozite operateru u održavanju postaje
4. **Nemojte tražiti tehničku podršku**: ovo je platforma za slušanje. Za pomoć pošaljite poruku SysOpu.

---

## Rješavanje problema

### Nema zvuka

**Mogući uzroci:**
1. Preglednik je utišan → provjerite regulaciju glasnoće u pregledniku
2. Sustav je utišan → provjerite glasnoću računala
3. Slab signal → ugodite se na jači signal (S7+)
4. Pogrešan način rada → isprobajte druge načine demodulacije

**Rješenja:**
1. Kliknite na jak signal (narančast/crven u slapu)
2. Provjerite da preglednik nije utišan (ikona utišavanja na kartici)
3. Isprobajte drugu frekvenciju
4. Ponovno učitajte stranicu (F5)

### Izobličen zvuk

**Mogući uzroci:**
1. Preupravljan signal → signal je prejak
2. Pogrešan način rada → AM signal slušan u SSB načinu itd.
3. Smetnje → prelijevanje susjednih signala

**Rješenja:**
1. Smanjite glasnoću
2. Isprobajte drugi način demodulacije
3. Upotrijebite uži pojas filtra
4. Odmaknite se od ometajućih signala

### Slap se ne osvježava

**Mogući uzroci:**
1. Problem s mrežom → spora ili prekinuta veza
2. Performanse preglednika → previše otvorenih kartica
3. Preopterećenje poslužitelja → previše korisnika

**Rješenja:**
1. Provjerite internetsku vezu
2. Zatvorite nepotrebne kartice preglednika
3. Ponovno učitajte stranicu (F5)
4. Pokušajte kasnije, kada je manje korisnika na vezi

### Nije moguće ugoditi se na frekvenciju

**Mogući uzroci:**
1. Frekvencija izvan raspona → SDR ne pokriva tu frekvenciju
2. Pogrešan format upisa → koristite ispravan format (npr. „14200", a ne „14.200.000")

**Rješenja:**
1. Provjerite frekvencijsku pokrivenost SDR-a (prikazana na stranici)
2. Koristite navedene primjere formata frekvencije
3. Umjesto toga kliknite na slap

### Isprekidan zvuk

**Mogući uzroci:**
1. spora internetska veza
2. veliko opterećenje poslužitelja
3. problemi s performansama preglednika

**Rješenja:**
1. Zatvorite druge aplikacije koje troše propusnost
2. Pokušajte izvan vršnih sati
3. Zatvorite nepotrebne kartice preglednika
4. Koristite žičanu vezu umjesto Wi-Fija

---

## Često postavljana pitanja

### Opća pitanja

**P: Trebam li posebnu opremu za korištenje WebSDR-a?**
O: Ne! Samo računalo ili mobilni uređaj s pristupom internetu.

**P: Je li korištenje WebSDR-a besplatno?**
O: Da, većina WebSDR-ova je besplatna. Vode ih volonteri.

**P: Mogu li odašiljati putem WebSDR-a?**
O: Ne, WebSDR služi samo za prijam. Odašiljanje nije moguće.

**P: Koje frekvencije mogu slušati?**
O: Ovisi o konfiguraciji WebSDR-a. Pogledajte podatke o postaji.

**P: Mogu li snimati zvuk?**
O: Neki preglednici omogućuju snimanje. Provjerite mogućnosti svojeg preglednika.

### Tehnička pitanja

**P: Koju frekvenciju uzorkovanja koristi SDR?**
O: Razlikuje se od postaje do postaje. Pogledajte stranicu s podacima o postaji.

**P: Kolika je latencija?**
O: Obično 2-5 sekundi između radijskog signala i vaših zvučnika.

**P: Mogu li koristiti više instanci?**
O: Obično da, ali to može opteretiti poslužitelj. Budite obzirni.

**P: Radi li izvan mreže?**
O: Ne, WebSDR zahtijeva internetsku vezu.

**P: Koji su preglednici podržani?**
O: Chrome, Firefox, Edge, Safari (sve novije verzije)

### Pitanja o korištenju

**P: Koliko ljudi može slušati istodobno?**
O: Ovisi o kapacitetu poslužitelja. Često 50-200+ korisnika.

**P: Mogu li vidjeti što drugi slušaju?**
O: Ako je omogućeno, da. Potražite oznake „drugi korisnici".

**P: Mogu li razgovarati s drugim slušateljima?**
O: Ako je operater omogućio razgovor. Potražite okvir za razgovor.

**P: Zašto se na nekim frekvencijama ništa ne vidi?**
O: Na toj frekvenciji trenutačno nema signala. Isprobajte druge!

**P: Što su obojene trake u slapu?**
O: Preklop plana pojaseva koji prikazuje dodjelu frekvencija.

---

## Izvori

### Saznajte više o radiju

- **Planovi pojaseva**: potražite „amateur radio band plan" + svoju regiju
- **Prostiranje**: naučite o prostiranju KV radiovalova
- **Digitalni načini rada**: istražite FT8, PSK31, RTTY
- **Amaterski radio**: razmislite o polaganju za amatersku dozvolu!

### Pronalaženje drugih WebSDR-ova

- **WebSDR imenik**: http://sdr-list.xyz
- **WebSDR.org**: http://websdr.org
- **KiwiSDR**: http://kiwisdr.com/public/

### Kako doći do pomoći

1. **Operater postaje**: pogledajte kontaktne podatke na stranici
2. **Razgovor korisnika**: pitajte druge slušatelje (ako je dostupan)
3. **Mrežni forumi**: potražite zajednice WebSDR-a
4. **Dokumentacija**: pogledajte ovaj vodič!

---

## Dodatak: uobičajene frekvencije

### KV amaterski pojasevi

| Pojas | Frekvencijski raspon | Način rada | Aktivnost |
|-------|----------------------|------------|-----------|
| 160 m | 1.800-2.000 MHz | LSB | Noć/lokalno |
| 80 m | 3.500-4.000 MHz | LSB | Noć/regionalno |
| 40 m | 7.000-7.300 MHz | LSB | Dan/noć/DX |
| 30 m | 10.100-10.150 MHz | USB | Samo podaci/CW |
| 20 m | 14.000-14.350 MHz | USB | Danju/DX |
| 17 m | 18.068-18.168 MHz | USB | Danju/DX |
| 15 m | 21.000-21.450 MHz | USB | Danju/DX |
| 12 m | 24.890-24.990 MHz | USB | Danju/DX |
| 10 m | 28.000-29.700 MHz | USB | Sporadično/DX |

### VHF/UHF amaterski pojasevi

| Pojas | Frekvencijski raspon | Način rada | Aktivnost |
|-------|----------------------|------------|-----------|
| 6 m | 50.000-54.000 MHz | USB/FM | Sporadično |
| 2 m | 144.000-148.000 MHz | FM | Vrlo aktivno |
| 70 cm | 420.000-450.000 MHz | FM | Aktivno |

### Radiodifuzijski pojasevi

| Služba | Frekvencijski raspon | Način rada |
|--------|----------------------|------------|
| AM radio | 530-1710 kHz | AM |
| Kratki valovi | 2.3-26.1 MHz | AM |
| FM radio | 88-108 MHz | WBFM |

### Zrakoplovstvo

| Služba | Frekvencijski raspon | Način rada |
|--------|----------------------|------------|
| Kontrola zračnog prometa | 118-137 MHz | AM |
| ACARS (podaci) | 130-136 MHz | Podaci |

### Pomorstvo

| Služba | Frekvencijski raspon | Način rada |
|--------|----------------------|------------|
| Pomorski VHF | 156-162 MHz | FM |
| Pomorski KV | 2-22 MHz | USB |

---

## Pojmovnik

**AGC**: automatska regulacija pojačanja – automatski podešava razine zvuka

**AM**: amplitudna modulacija – govorni način rada u zrakoplovstvu i radiodifuziji

**Širina pojasa**: frekvencijski raspon signala

**CW**: neprekinuti val – signali Morseova koda

**DX**: veza na veliku udaljenost

**FFT**: brza Fourierova transformacija – pretvara vremensku domenu u frekvencijsku

**FM**: frekvencijska modulacija – govorni način rada za VHF/UHF

**HF**: kratki valovi (3-30 MHz) – pojasevi za velike udaljenosti

**kHz**: kilohertz (1.000 Hz)

**LSB**: donji bočni pojas – govorni način rada za niže KV pojaseve

**MHz**: megahertz (1.000.000 Hz)

**NB**: prigušivač impulsnog šuma – uklanja impulsni šum

**NR**: smanjenje šuma – smanjuje pozadinski šum

**PSK**: fazno pomično ključanje – digitalni način rada

**RTTY**: radioteleprinter – digitalni tekstualni način rada

**S-metar**: mjerač jakosti signala

**SDR**: softverski definirani radio

**SQL**: squelch – utišava zvuk kada nema signala

**SSB**: jednobočni pojas (USB ili LSB)

**USB**: gornji bočni pojas – govorni način rada za više KV pojaseve

**VHF**: vrlo visoke frekvencije (30-300 MHz) – optička vidljivost

**UHF**: ultravisoke frekvencije (300-3000 MHz) – optička vidljivost

**Slap (waterfall)**: vizualni prikaz radijskog spektra kroz vrijeme

---

**Uživajte u istraživanju radijskog spektra uz PhantomSDR-Plus!**

**73 (srdačni pozdravi) de SV1BTL & SV2AMK**

Za upute o instalaciji pogledajte [INSTALLATION.md](INSTALLATION.md). Za tehničke pojedinosti pogledajte [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md).
