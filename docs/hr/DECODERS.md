# PhantomSDR-Plus — Korisnički priručnik za dekodere

Ovaj vodič obuhvaća sve ugrađene dekodere dostupne u PhantomSDR-Plusu. Svi se dekoderi uključuju na isti način, opisan u nastavku, nakon čega slijede upute za postavljanje svakog pojedinog dekodera.

---

## Sadržaj

1. [Kako pokrenuti dekoder](#1-kako-pokrenuti-dekoder)
2. [FT8](#2-ft8)
3. [FT4-FT2](#3-ft4-ft2)
4. [JS8](#4-js8)
5. [CW — Morseov kod](#5-cw--morseov-kod)
6. [QRSS Grabber](#6-qrss-grabber)
7. [WSPR](#7-wspr)
8. [HF FAX / WEFAX](#8-hf-fax--wefax)
9. [NAVTEX](#9-navtex)
10. [FSK / RTTY — uključujući PSK31 i Oliviju](#10-fsk--rtty--uključujući-psk31-i-oliviju)
11. [SSTV](#11-sstv)
12. [Opći savjeti](#12-opći-savjeti)

---

## 1. Kako pokrenuti dekoder

Svim se dekoderima pristupa iz odjeljka **Decoder Options**, smještenog ispod kontrola audiospektrograma na glavnoj ploči.

**Koraci:**

1. Kliknite gumb **Decoder: OFF** da biste ga prebacili u **Decoder: ON** (kad je aktivan, postaje plav).
2. Otvorite padajući izbornik koji se pojavljuje desno od gumba i odaberite željeni dekoder.
3. Ploča odabranog dekodera pojavit će se ispod kontrola — slijedite upute za taj dekoder u odgovarajućem odjeljku ovog vodiča.
4. Da biste zaustavili dekodiranje, odaberite **— Select decoder —** iz padajućeg izbornika ili kliknite gumb **Decoder: ON** da ga vratite na OFF.

### Gumbi dekodera na jedan pritisak

Padajući izbornik nije jedini put. Glavna ploča ima red gumba **Decoders** — odmah ispod **Wheel Tuning Steps** — s po jednim gumbom za svaki dekoder:

| Gumb | Dekoder | Gumb | Dekoder |
|---|---|---|---|
| **FT8** | FT8 | **SSTV** | SSTV |
| **FT4** | FT4 | **NAVTEX** | NAVTEX |
| **FT2** | FT2 | **RTTY** | FSK / RTTY |
| **CW** | CW | | |
| **WSPR** | WSPR | **FAX** | HF FAX / WEFAX |

Pritisak na gumb odrađuje cijeli slijed odjednom: odabire dekoder, uključuje dekoder (ON) i dovodi njegov prozor na zaslon. Gumb je plav dok njegov dekoder radi. **Ponovni pritisak na isti gumb isključuje dekoder** — njegov se prozor zatvara s njim.

**RADEL** i **RADEU** namjerno nisu u ovom redu. To su načini digitalnog glasa, a ne tekstualni dekoderi, pa imaju vlastiti par gumba uz naslov **Modes selector** te u skočnim prozorima **Modes** i **Bands**. Ponašaju se posve jednako — pritisak za pokretanje, ponovni pritisak za zaustavljanje. Pogledajte [priručnik za RADE](RADE_README.md).

Gumbi, padajući izbornik i gumb ON/OFF upravljaju istim stanjem, pa što god upotrijebili, ostalo ga slijedi.

> Istodobno može biti aktivan samo jedan dekoder. Prelazak na drugi dekoder automatski zaustavlja prethodni.
>
> **QRSS grabber** nije dio ovog izbornika — ima vlastiti odjeljak **QRSS** i može raditi istodobno s nekim dekoderom.

**Dekodiranje se odvija u pozadini.** SSTV, HF FAX, NAVTEX, FSK/RTTY i CW rade svaki u zasebnoj dretvi Web Workera, pa se dekodiranje nikada ne natječe s reprodukcijom zvuka ni sa slapom. Pokretanje ili zaustavljanje dekodera ne prekida zvuk, a sučelje ostaje odzivno dok se prima slika ili stranica. Svi dekoderi dobivaju sirovi zvuk uzet *prije* AGC-a, smanjenja šuma i utišavanja — utišavanje prijamnika ili prilagodba tih postavki vlastitom uhu stoga ne utječe na dekodiranje.

**Dekoder koji radi drži način rada i propusni pojas.** Uobičajeno način rada slijedi plan opsega iz `bands-config.js`: pomaknite ugađanje u odsječak označen kao LSB ili AM i prijamnik se prebaci na njega. Dok dekoder radi, toga više nema. Dekoder zadržava način rada koji mu treba (USB kod većine, vlastiti kod RADE-a) i propusni pojas koji mu treba — PSK31 oko ±100 Hz, Olivia svoju punu širinu, RTTY svoj shift — i oboje preživljava preugađanje, uključujući skok na drugi opseg. Bez toga bi FT8 na 40 m prebacio prijamnik na LSB čim se ugađanje pomakne, a uski propusni pojasi dekodera opet bi se raširili na puni SSB filtar.

Vlastiti način rada opsega vraća se čim isključite dekoder. Način rada uvijek možete nametnuti ručno: gumbi načina rada svjestan su izbor i uvijek pobjeđuju. CW dekoder je iznimka od svega ovoga — dekodira u načinu rada u kojem slušate i nikada ne preuzima prijamnik.


### Decoder ID — automatsko prepoznavanje načina rada

Iznad gumba dekodera nalazi se okvir **Decoder ID**. Odgovara na pitanje *„što ovo slušam?"* kada naiđete na digitalni signal koji ne možete prepoznati, a zatim vam jednim klikom nudi odgovarajući dekoder.

Prema zadanim postavkama je **isključen** i dok je isključen ne troši ništa. Pritisnite **On** i ostavite signal ugođenim. Otprilike pola minute prikazuje *Listening…* s trakom napretka — mjerenja vremena moraju vidjeti dva potpuna FT8 ciklusa da bi imala smisla — a zatim imenuje način rada:

```
Decoder ID [On]   NAVTEX / SITOR-B  99% 📻   170 Hz shift · 100.00 Bd · 43 dB S/N   [ Use NAVTEX ]
```

* **Način rada** i vrijednost **pouzdanosti**. Zeleno iznad 75 %, žuto iznad 50 %, narančasto ispod — narančasti odgovor shvatite kao naznaku, ne kao presudu.
* **Što je zapravo izmjereno**: zauzeta širina pojasa, razmak tonova, brzina simbola, trajanje rafala, UTC mreža kojoj odgovara, odnos signal/šum. To je dokaz iza presude, kako biste mogli i sami prosuditi.
* **Use <način>** pokreće ispravan dekoder, točno kao da ste pritisnuli njegov gumb — i namješta prijamnik za rad tim načinom. Za načine koji žive u FSK ploči dodatno odabire ispravnu varijantu — RTTY, Weather RTTY, PSK31 ili Olivia.
* Sljedeći kandidati navedeni su iza **or**. Klikom isprobajte njega, pa vas pogrešan prvi odgovor ništa ne stoji.
* **📻** znači da je frekvencija na koju ste ugođeni poznata pozivna frekvencija za taj način rada i da je to utjecalo na poredak.

Nikada sam ne mijenja vaš dekoder. Uvijek samo predlaže. A čim pokrenete dekoder — s reda gumba, s padajućeg izbornika ili s vlastitog gumba **Use** unutar Decoder ID-a — Decoder ID se sam isključuje: njegov je posao bio odabrati jedan, a dekoder sada traži isti zvuk.

**Namješta prijamnik za taj način rada.** Odabir načina rada odluka je da se njime i radi, pa prijamnik slijedi: ugođena frekvencija dolazi na sredinu slapa, a pogled se postavlja na oko 100 kHz oko nje, bočni pojas postaje onaj na kojem se taj način radi, a propusni pojas se sužava na prozor u kojem taj način živi — cijeli podpojas od 3 kHz za FT8, FT4, FT2 i JS8, 1350–1650 Hz za WSPR, 250–750 Hz za NAVTEX, 800–2700 Hz za HF FAX, 900–2600 Hz za SSTV te ±250 Hz s obje strane ugođene frekvencije za CW, pri čemu prijamnik dodatno prelazi na CW. Uski propusni pojas drži susjedne signale izvan dekodera — upravo ono što biste učinili rukom. Dvije iznimke: SSTV zadržava bočni pojas koji je sam odabrao — po dogovoru LSB na 80 i 40 m, gdje bi nametnuti USB izokrenuo raspored tonova — a FSK načini zadržavaju prozor koji njihova vlastita ploča izvodi iz razmaka ili širine pojasa varijante, uži od bilo koje stalne vrijednosti. Pritisak na **Use** za dekoder koji već radi i dalje ga isključuje, a prijamnik tada ostaje točno onakav kakav je bio.

**Spori načini trebaju više vremena.** WSPR leži na dvominutnoj mreži, a SSTV slike traju minutu ili dvije, pa se ta dva imenuju kasnije od ostalih — dajte im tri do četiri minute na frekvenciji. HF FAX i SSTV usto se prepoznaju samo ako su ugođeni na uobičajen način — slikovni pojas leži na otprilike 1500 do 2300 Hz u audiju, ondje gdje ga očekuju i njihovi dekoderi. Promjena frekvencije pokreće mjerenje ispočetka, jer sve prikupljeno do tada opisuje frekvenciju koju ste upravo napustili.

**Što prepoznaje:** FT8, FT4, JS8, WSPR, CW, NAVTEX/SITOR-B, RTTY na 45,45 Bd, Weather RTTY (DWD), PSK31, Olivia, HF FAX, SSTV i DSC. U ovoj inačici nema DSC dekodera, pa se DSC imenuje i označava s *no decoder*.

**Recentre & retry.** Gdje se signal nalazi unutar audio propusnog pojasa nije važno između otprilike 400 Hz i 2700 Hz. Izvan tog raspona mjerenje se pogoršava i pojavljuje se žuti gumb **Recentre & retry**. Pritiskom se ugađanje pomiče tako da signal padne u sredinu propusnog pojasa i započinje novo mjerenje. To je jedan izračunati pomak, a ne pretraživanje.

**Tri poštena ograničenja:**

* **FT8, JS8 i FT2 su isti signal.** Ista 8-FSK modulacija, isti razmak tonova, a JS8 pri brzini Normal koristi FT8-ov ciklus od 15 sekundi. Ništa u samom signalu ih ne razdvaja. Frekvencija ih razdvaja: na FT8 pozivnoj frekvenciji javlja FT8, na JS8 frekvenciji javlja JS8, a bilo gdje drugdje pošteno javlja obitelj — *FT8 / JS8 / FT2*. Pokrenite bilo koji od ta dva dekodera i vidite koji daje tekst.
* **Radije šuti nego da nagađa.** Ispod otprilike 10 dB odnosa signal/šum javlja *Nothing above the noise* ili *Not recognised* umjesto da imenuje način rada koji zapravo ne vidi. To je namjerno: samouvjeren pogrešan odgovor gori je od nikakvog.
* **Signal koji slabi čita se drukčije.** WSPR odašilje 110 sekundi bez prekida, dulje nego što traje uobičajeni QSB propad, pa duboko slabljenje razreže emisiju na komade i njezin dvominutni ritam iz njih se više ne može očitati. Tada se dolazi do njega drugim putem: cijela se povijest slušanja uspoređuje s dvominutnom mrežom umjesto s pojedinačnim emisijama, a redak s mjerenjima piše *120 s grid (through fading)*. To je slabiji dokaz od emisije čute u cijelosti, pa je prikazana pouzdanost namjerno niža. Slabljenje dovoljno duboko da signal zakopa u šum ne da se vratiti uopće. Olivia je stroža od ostalih: neće biti imenovana dok joj se ne izmjeri simbolska brzina, pa zašuti ranije.

---

## 2. FT8

**Što je to:** FT8 je popularan digitalni način rada za slabe signale koji radioamateri koriste diljem svijeta. Emisije traju točno 15 sekundi, a protokol može primiti signale do 20–25 dB ispod razine šuma. To je najčešće korišten način rada za veze na velike udaljenosti (DX).

### Preporučene frekvencije (USB)

| Pojas | Frekvencija |
|-------|-------------|
| 160 m | 1.840 MHz |
| 80 m  | 3.573 MHz |
| 40 m  | 7.074 MHz |
| 30 m  | 10.136 MHz |
| 20 m  | 14.074 MHz |
| 17 m  | 18.100 MHz |
| 15 m  | 21.074 MHz |
| 12 m  | 24.915 MHz |
| 10 m  | 28.074 MHz |

### Postavljanje

1. Ugodite se na jednu od gore navedenih FT8 frekvencija i postavite način rada na **USB**.
2. Uključite dekoder i iz padajućeg izbornika odaberite **FT8**. Ili jednostavno pritisnite gumb **FT8**.
3. Ploča **FT8 Messages** automatski se pojavljuje ispod.

### Čitanje ispisa

Popis poruka prikazuje dekodirane emisije kako pristižu. Svaki ciklus od 15 sekundi donosi novu skupinu poruka. Polje **Farthest** (gore desno na ploči) pokazuje najveću udaljenost dekodiranu u trenutačnoj sesiji, u kilometrima.

Tipičan oblik poruke: `CQ DX AA1BB FN31` — CQ poziv pozivnog znaka AA1BB smještenog u polju FN31.

> **Savjet:** FT8 je usko vremenski sinkroniziran. Vaš preglednik koristi sat vašeg računala; ako sat sustava odstupa više od nekoliko sekundi, dekodiranje neće uspjeti. Držite vrijeme sustava usklađeno putem NTP-a.

---

## 3. FT4-FT2

**Što je to:** FT4 je brža inačica FT8-a namijenjena radu u natjecanjima. Svaki ciklus emitiranja traje 7,5 sekundi (polovica FT8-a), zbog čega je dvostruko brži, ali traži nešto jači signal. FT2 je još brža inačica FT8-a. Riječ je o iznimno brzom 77-bitnom načinu rada s TR razdobljima od 3,75 sekundi (= polovica FT4) — još je eksperimentalan.

### Preporučene frekvencije (USB)

| Pojas | Frekvencija FT4|
|-------|-----------|
| 80 m  | 3.575 MHz |
| 40 m  | 7.047 MHz |
| 30 m  | 10.140 MHz |
| 20 m  | 14.080 MHz |
| 15 m  | 21.140 MHz |
| 10 m  | 28.180 MHz |

| Pojas | Frekvencija FT2|
|-------|-----------|
|160 m | 1.843 do 1.846 |
|80 m   | 3.578 do 3.581 |
|60 m   | 5.360 (provjerite lokalne regionalne propise) |
|40 m   | 7.052 do 7.062 |
|30 m   | 10.144 |
|20 m   | 14.084 |
|17 m   | 18.108 |
|15 m   | 21.144 |
|12 m   | 24.923 |
|10 m   | 28.184 |

### Postavljanje

1. Ugodite se na FT4 frekvenciju i postavite način rada na **USB**.
2. Uključite dekoder i iz padajućeg izbornika odaberite **FT4** ili **FT2**. Ili jednostavno pritisnite gumb **FT4** / **FT2**.
3. Ploča **FT4 Messages** ili **FT2 Messages** pojavljuje se ispod, istog rasporeda kao FT8 ploča.

> **Napomena:** FT4 i FT8 koriste različite spektralne formate i nisu zamjenjivi. Pri korištenju ovog dekodera pobrinite se da ste na FT4 frekvenciji.

---

## 4. JS8

**Što je to:** JS8 (način rada koji koristi JS8Call) uzima FT8-ov mehanizam za slabe signale i pretvara ga u način razgovora s tipkovnice na tipkovnicu. Dok FT8 šalje fiksne poruke od 13 znakova, JS8 šalje slobodan tekst u malim dijelovima i spaja uzastopne emisije natrag u cijele rečenice — sve dulje od otprilike dvanaest znakova stiže kroz nekoliko ciklusa od 15 sekundi. Dekodira otprilike jednako duboko kao FT8, pa radi ondje gdje govor i CW više ne prolaze.

### Preporučene frekvencije (USB)

| Pojas | Frekvencija |
|-------|-------------|
| 160m | 1.842 MHz |
| 80m  | 3.578 MHz |
| 40m  | 7.078 MHz |
| 30m  | 10.130 MHz |
| 20m  | 14.078 MHz |
| 17m  | 18.104 MHz |
| 15m  | 21.078 MHz |
| 12m  | 24.922 MHz |
| 10m  | 28.078 MHz |

### Brzine

JS8 ima pet brzina. Sve stanice u razgovoru moraju koristiti istu. **Normal** je pozivna brzina i na njoj se odvija gotovo sav promet — počnite od nje.

| Brzina | Ciklus | Širina | Kada se koristi |
|--------|--------|--------|-----------------|
| Slow   | 30 s | 25 Hz  | Vrlo slabe putanje; najosjetljivija |
| Normal | 15 s | 50 Hz  | Uobičajena pozivna brzina |
| Fast   | 10 s | 80 Hz  | Brža razmjena, traži jači signal |
| Turbo  | 6 s  | 160 Hz | Jaki lokalni signali |
| Ultra  | 4 s  | 250 Hz | Eksperimentalna, rijetko se viđa |

### Postavljanje

1. Ugodite se na JS8 frekvenciju i postavite način rada na **USB**.
2. Uključite dekoder i odaberite **JS8** s popisa, ili jednostavno pritisnite tipku **JS8**.
3. Pojavljuje se ploča **JS8 Decoder**. Ostavite **Speed** na *Normal*, osim ako znate da stanica koju tražite koristi drugu.

### Kako čitati ispis

Ploča ima dva popisa.

**Poruke koje još pristižu** prikazuju se na vrhu u zelenoj boji, s trepćućim pokazivačem. JS8 poruka može trajati četiri ciklusa — punu minutu na Normal — pa se ovdje vidi kako se rečenica gradi. Nije greška ako ondje ostane neko vrijeme.

**Dovršene poruke** popunjavaju glavni popis, svaka u svom retku:

| Stupac | Značenje |
|--------|----------|
| Mode | Uvijek `JS8` |
| Hz | Audio frekvencija signala unutar propusnog pojasa |
| dB | Odnos signal-šum u referentnoj širini od 2500 Hz |
| Message | Dekodirani tekst; **pozivni znakovi prikazani su zeleno** |

Tipične poruke:

* `SV1BTL KM17: HB` — heartbeat: stanica javlja da je u eteru, sa svojim lokatorom.
* `KN4CRD: K0OG SNR -05` — usmjerena poruka: KN4CRD javlja K0OG-u da ga prima na −5 dB.
* `MP 100W 8M/BALUN JN58KH AUGSBURG, MARTIN` — slobodan tekst, ovdje opis stanice pristigao kroz četiri ciklusa.

Redak prikazan **blijedo i kurzivom** istekao je prije nego što je stigao njegov posljednji okvir. Tekst je stvaran, ali može biti skraćen.

### Sync offset

Klizač **Sync offset** određuje koliko nakon granice UTC ciklusa počinje snimanje, čime se nadoknađuje kašnjenje audio lanca. Ostavite **Auto** uključen: dekoder mjeri vremenski razmak signala koje čuje i sam se prilagođava.

### Oznake na spektru

Mala traka spektra na ploči crta žutu okomitu crtu na frekvenciji svakog signala dekodiranog u prethodnom ciklusu, pa se stupac Hz može očitati izravno sa zaslona.

### Vidjeti vlastite spotove

Ako prijamnik šalje JS8 spotove na PSK Reporter (vidi karticu Spot Reporting u administracijskoj ploči), gumb **📡 JS8 map** u okviru **Note:** otvara kartu PSK Reportera filtriranu na pozivni znak ovog prijamnika i način JS8 — isto ono što **📡 FT8 map** i **📡 FT4 map** rade za te načine.

> **Savjet:** JS8 je mnogo tiši od FT8. Poslijepodne možete vidjeti jednu emisiju svakih nekoliko minuta, a duga razdoblja bez ičega sasvim su normalna. Dajte mu pet do deset minuta prije nego što zaključite da nešto ne valja. 20m (14.078) i 40m (7.078) uobičajena su mjesta.

> **Savjet:** Kao i FT8, JS8 je strogo vremenski sinkroniziran i koristi sat vašeg računala. Ako sistemsko vrijeme odstupi više od sekundu ili dvije, ništa se neće dekodirati. Držite ga sinkroniziranim putem NTP-a.

---

## 5. CW — Morseov kod

**Što je to:** CW dekoder osluškuje signale Morseova koda (neprekinuti val) i pretvara ih u tekst u stvarnom vremenu. Automatski prati frekvenciju signala i prilagođava se brzini odašiljanja operatera.

### Preporučene frekvencije

CW je aktivan na svim amaterskim pojasevima, obično u njihovu donjem dijelu. Uobičajena mjesta:

| Pojas | Segment |
|-------|---------|
| 40 m  | 7.000–7.040 MHz |
| 20 m  | 14.000–14.070 MHz |
| 15 m  | 21.000–21.080 MHz |

### Postavljanje

1. Ugodite se na CW signal koristeći način demodulacije **CW** ili **CW-L**, ovisno o situaciji.
2. Uključite dekoder i iz padajućeg izbornika odaberite **CW**. Ili jednostavno pritisnite gumb **CW**.
3. Ploča **CW Decoder** pojavljuje se ispod.

### Čitanje ispisa

- Zaglavlje ploče prikazuje otkrivenu frekvenciju signala u Hz (npr. `≈ 700 Hz`) i procijenjenu brzinu odašiljanja u riječima u minuti (npr. `· 22 WPM`).
- Ako signal nije otkriven, zaglavlje prikazuje **scanning…**
- Dekodirani tekst kliže u jantarnom fontu jednolike širine. Trepćući pokazivač (▋) označava mjesto na kojem se tekst trenutačno ispisuje.
- Kliknite **Clear** da izbrišete međuspremnik ispisa.

> **Savjeti:**
> - Centrirajte propusni pojas na CW ton. Dekoder radi najbolje kada CW signal leži otprilike između 400 i 900 Hz u audiospektru.
> - Vrlo brzo ili vrlo sporo odašiljanje te izrazito ručno tipkani (nepravilan) Morse mogu smanjiti točnost.
> - Dekoder daje najbolje rezultate na jednom čistom signalu. Jak QRM od obližnjih signala na istom pojasu može ga zbuniti.

---

## 6. QRSS Grabber

**Što je to:** QRSS je CW odašiljan toliko sporo da jedna točka traje sekundama umjesto milisekundama. Pri toj brzini signal zauzima tek djelić herca, pa dovoljno uska analiza može izvući trag i 20–30 dB *ispod* razine šuma. Uhom se tu nema što pročitati — QRSS se **gleda**, ne sluša. Grabber računa vlastiti vrlo dugi FFT nad zvukom prijamnika i crta klasični grabber prikaz: frekvencija na okomitoj osi, vrijeme klizi slijeva nadesno, a najnoviji stupac je uvijek uz desni rub.

Većina onoga što ćete vidjeti dolazi od MEPT svjetionika (Manned Experimental Propagation Transmitter) — odašiljača vrlo male snage, često nekoliko stotina milivata u žicu, koji se neprekidno identificiraju vrlo sporim Morseom ili FSK uzorcima.

### Gdje gledati

QRSS svjetionici žive u uskim prozorima od 100–200 Hz pri donjem kraju svakog opsega. Ne morate ih pamtiti: grabber ima popis **Band** s prozorima iz tablice, a odabir jednog ugađa na njega i priprema prijamnik za taj način rada (vidi *Otvaranje grabbera*).

| Opseg | Središte prozora | Napomena |
|------|---------------|------|
| 30m | 10.140,00 kHz | Glavni QRSS prozor — daleko najprometniji, danju i noću |
| 40m | 7.039,90 kHz |  |
| 40m | 7.000,85 kHz | Knights prozor, 7.000,8–7.000,9 kHz |
| 20m | 14.096,90 kHz |  |
| 80m | 3.569,90 kHz |  |
| 80m | 3.568,60 kHz | Stariji prozor |
| 80m | 3.500,85 kHz | Knights prozor, 3.500,8–3.500,9 kHz |
| 160m | 1.837,90 kHz |  |
| 160m | 1.843,30 kHz | Stariji prozor |
| 630m | 476,10 kHz |  |
| 2200m | 137,70 kHz | LF QRSS / DFCW |
| 60m | 5.288,55 kHz |  |
| 17m | 18.105,90 kHz |  |
| 15m | 21.095,90 kHz |  |
| 12m | 24.925,90 kHz |  |
| 10m | 28.125,70 kHz |  |
| 10m | 28.000,85 kHz | Stariji prozor |
| 10m | 28.322,00 kHz | Alternativa |
| 6m | 50.294,30 kHz |  |

Nekoliko se opsega pojavljuje dvaput jer su doista u uporabi dvije konvencije. Moderni prozori leže 200 Hz ispod WSPR frekvencije toga opsega; stariji *Knights* prozori posve su drugdje, a na 40 i 80 m znatno niže. Ako je opseg tih na jednome, probajte drugi.

Riječ je o konvencijama, ne o propisima, a neke su regionalne — osobito se brojke za 10 m razlikuju. Uzmite popis kao polazište i slijedite lokalnu praksu.

### Otvaranje grabbera

QRSS grabber **nije** u izborniku dekodera. Ima vlastiti odjeljak **QRSS**, uz kontrole spektrograma i dekodera.

1. Kliknite **🐌 Show**. Pojavljuje se platno grabbera, a kontrole se razotvore pokraj gumba.
2. Odaberite prozor s popisa **Band** i pritisnite **Tune**. To u jednom koraku napravi sve što način rada traži: ugodi na prozor, prebaci prijamnik na **CW** i postavi propusni pojas taman dovoljno širok za odsječak koji gledate. Skala tada pokazuje pravu QRSS frekvenciju, a tragovi padaju na središnju crtu prikaza.
3. Postavite **Speed** prema duljini točke svjetionika.
4. **Centre** i **Span** rade kao i prije; promjena bilo kojega preoblikuje propusni pojas, pa prikaz i prijamnik ostaju usklađeni.
5. Kliknite **🐌 Hide** za zaustavljanje. Vraća se uobičajeni način rada opsega.

I dalje možete i ručno — ugodite u **USB** oko 1 kHz ispod prozora tako da tragovi padnu blizu 800 Hz zvuka. Popis **Band** samo vam štedi računanje.

Dok je ugođen prozor s popisa, grabber drži prijamnik jednako kao dekoder: CW i njegov propusni pojas preživljavaju preugađanje, a prozor slijedi skalu, pa trag ostaje na središnjoj crti dok pretražujete opseg. Prijamnik vraća kad sakrijete grabber, kliknete gumb načina rada ili pokrenete dekoder.

### Brzine

| Postavka | Duljina točke | Razlučivost | Prozor analize | Novi stupac svakih |
|----------|---------------|-------------|----------------|--------------------|
| QRSS 3  | 3 s  | 0,73 Hz | 1,4 s  | 0,7 s  |
| QRSS 6  | 6 s  | 0,37 Hz | 2,7 s  | 1,4 s  |
| QRSS 10 | 10 s | 0,18 Hz | 5,5 s  | 2,7 s  |
| QRSS 30 | 30 s | 0,09 Hz | 10,9 s | 5,5 s  |
| QRSS 60 | 60 s | 0,05 Hz | 21,8 s | 10,9 s |

Postavka brža od svjetionika troši osjetljivost — trag ispadne tanak i šumljiv. Postavka sporija od svjetionika razmazuje uzastopne točke i crte u jednu prugu. Ploča se otvara na **QRSS 6**, razumnoj polazišnoj točki za nepoznat signal: osjetljivija je od QRSS 3, a osvježava se brže i tolerantnija je na drift od QRSS 10. Čim uočite oblik manipulacije, prijeđite na brzinu koju svjetionik doista šalje — svaki korak prema bržoj postavci stoji 3 dB osjetljivosti.

### Kontrole

| Kontrola | Što radi |
|----------|----------|
| **Band** | QRSS prozori iz gornje tablice. **Tune** ugađa na odabrani, u CW-u s prikladnim propusnim pojasom. |
| **Speed** | Postavlja duljinu transformacije — kompromis između frekvencijske i vremenske razlučivosti (tablica gore). |
| **Centre** | Audio frekvencija u sredini prikaza, 100–3000 Hz. |
| **Span** | Visina prikazanog isječka: 20, 50, 100 ili 200 Hz, pri pokretanju 100 Hz — širina jednog QRSS podpojasa. Uži isječak razvlači svaki trag na više piksela. Kod širih isječaka u ploču stane više binova nego što ima redaka piksela; svaki redak tada prikazuje najjači bin koji pokriva, pa se ništa ne može sakriti između redaka. |
| **Gain** | −10 do +40 dB. Pomiče paletu boja u odnosu na izmjerenu razinu šuma; povisite da posvijetlite slabe tragove. |
| **Color** | Rainbow, Green ili Grayscale. |
| **Clear** | Briše platno i poništava referencu šuma. |

### Čitanje prikaza

Frekvencijske oznake teku uz lijevi rub, najviša frekvencija je na vrhu. Ispod platna statusni redak pokazuje odabranu brzinu, stvarno korištenu razlučivost (npr. `0.183 Hz/bin · 5.5 s window`) i brzinu stupaca (npr. `2.7 s/column`).

Paleta boja referencirana je na **trenutačni** šum, koji se neprekidno mjeri iz praznih dijelova svakog stupca, a ne na apsolutnu razinu. Promjene glasnoće, AGC-a, antene ili opsega zato ne traže ponovno namještanje Gaina — prikaz zadržava stalan kontrast prema šumu opsega kakav god bio. Kao i kod dekodera, zvuk se uzima prije AGC-a, smanjenja šuma i utišavanja, pa prijamnik možete utišati i i dalje gledati.

Što znače oblici:

- **Stabilan nosilac** crta ravnu vodoravnu crtu.
- **Spori Morse** crta tu liniju kao niz kratkih i dugih odsječaka — točke i crte čitaju se slijeva nadesno.
- **Zakrivljeni tragovi ili tragovi koji bježe** dolaze od nestabiliziranog oscilatora svjetionika koji se grije ili hladi. To je normalno i često upravo taj potpis pomaka omogućuje redovitom promatraču da prepozna stanicu.
- **Okomite pruge** preko cijelog isječka su atmosferski praznici ili lokalni impulsi šuma, a ne signal.

> **Savjeti:**
> - Budite strpljivi. Pri QRSS 30 jedan stupac traje 5,5 sekundi, pa cijeli pozivni znak može trebati deset minuta ili više da prijeđe zaslon. Pustite da radi.
> - Ugađanje s popisa **Band** već sužava propusni pojas oko prozora. Ako ste ugodili ručno, učinite to sami: ne mijenja ono što transformacija razlučuje, ali sprječava jake susjede da upravljaju AGC-om prijamnika.
> - Grabber je neovisan o dekoderima — možete ga ostaviti uključenim dok dekoder radi na nečem drugom.
> - Širok span pri sporoj brzini je najzahtjevnija kombinacija; cijela transformacija radi u pregledniku, pa na skromnijem računalu radije odaberite span od 50 Hz.

---

## 7. WSPR

**Što je to:** WSPR (Weak Signal Propagation Reporter, izgovara se „whisper") način je rada svjetionika s iznimno slabim signalima koji kartira putove KV prostiranja diljem svijeta. Svaka emisija traje otprilike 110 sekundi i stane u kanal širine 200 Hz. Dekoder čeka potpuni dvominutni interval usklađen s UTC-om prije dekodiranja.

### Preporučene frekvencije (USB, prikazane)

| Pojas | Prikazana frekvencija |
|-------|------------------------|
| 160 m | 1.836.600 MHz |
| 80 m  | 3.568.600 MHz |
| 40 m  | 7.038.600 MHz |
| 30 m  | 10.138.700 MHz |
| 20 m  | 14.095.600 MHz |
| 17 m  | 18.104.600 MHz |
| 15 m  | 21.094.600 MHz |

### Postavljanje

1. Ugodite se na jednu od gore navedenih prikazanih WSPR frekvencija i postavite način rada na **USB**.
2. WSPR signal zauzima audiopodručje 1400–1600 Hz. Odabir **WSPR**-a obavlja ostalo umjesto vas: prijamnik prelazi na USB, a propusni pojas se sužava na 1350–1650 Hz, što pokriva cijelo područje koje dekoder pretražuje. Dodatno podešavanje nije potrebno.
3. Uključite dekoder i iz padajućeg izbornika odaberite **WSPR**. Ili jednostavno pritisnite gumb **WSPR**.
4. Ploča **WSPR-2 Decoder** pojavljuje se ispod.

### Čitanje ispisa

Ploča prikazuje traku napretka za trenutačni dvominutni interval:

- **Cijan traka se puni** — prikupljaju se podaci signala (0–116 s unutar intervala).
- **Jantarna traka pulsira** — dekodiranje je u tijeku (posljednjih ~4 s intervala).
- **Prazna traka** — čeka se sljedeća parna UTC minuta.

Svaki uspješno dekodirani spot prikazuje se u tablici sa sljedećim stupcima:

| Stupac | Značenje |
|--------|----------|
| UTC | Vrijeme spota (parna minuta) |
| Callsign | Postaja koja je odašiljala |
| Grid | Maidenhead lokator odašiljača |
| Power | Snaga odašiljanja u dBm |
| Freq | Točna audiofrekvencija (Hz) unutar WSPR propusnog pojasa |
| SNR | Omjer signala i šuma u dB |

Kliknite **Clear** da izbrišete popis spotova.

> **Savjet:** WSPR dekodiranje zahtijeva vrlo točno vrijeme sustava (unutar ±1 sekunde od UTC-a). Prvi interval nakon uključivanja dekodera počet će u sljedećoj parnoj UTC minuti — kratko je čekanje uobičajeno.

---

## 8. HF FAX / WEFAX

**Što je to:** HF radiofaks (poznat i kao WEFAX) koriste obalne straže i meteorološke službe diljem svijeta za emitiranje vremenskih karata, karata stanja mora i prizemnih analiza na kratkim valovima. Dekoder rekonstruira sliku redak po redak kako je prima.

### Postavljanje

1. Uključite dekoder i iz padajućeg izbornika odaberite **HF FAX / WEFAX**. Ili jednostavno pritisnite gumb **FAX**.
2. Ploča **HF FAX / WEFAX Receiver** pojavljuje se ispod.
3. **Odaberite postaju** iz padajućeg izbornika Station. Dostupno je više od 20 postaja koje pokrivaju Europu, Aziju, Oceaniju i Ameriku (npr. DDH3/DDK3 Njemačka, SVJ4/GR Grčka, JMH Japan, NMG SAD New Orleans).
4. Ako postaja emitira na više frekvencija, odaberite željenu iz podizbornika **Frequency**.
5. Kliknite **▶ Tune** da automatski ugodite slap na tu postaju.
6. Način rada automatski se postavlja na **USB**.

### Raspored emitiranja

Kada je postaja odabrana, pojavljuje se tablica odbrojavanja **Next Transmissions** koja prikazuje sljedeće 4 zakazane emisije u UTC-u, uz odbrojavanje u stvarnom vremenu:

- Uobičajeno (sivo/zeleno) — emisija predstoji.
- **Jantarno ⚡** — emisija počinje za manje od 3 minute; odmah pripremite dekoder.
- **Crveno ●** — emisija počinje za manje od 30 sekundi; prijam samo što nije počeo.

### Parametri

Većina postaja koristi standardne zadane vrijednosti (označene s ★). Mijenjajte ih samo ako znate da postaja koristi nestandardne postavke.

| Parametar | Zadano | Opis |
|-----------|--------|------|
| LPM | 120 ★ | Redaka u minuti — brzina vrtnje bubnja |
| IOC | 576 ★ | Indeks suradnje — određuje broj piksela po retku |
| Shift | 800 Hz ★ | Frekvencijski pomak između tonova crnog i bijelog |

### Kontrole

- **⇔ Auto-align** — uključeno prema zadanom. Automatski se sinkronizira s faznim signalom na početku svake slike. Isključite ga samo ako imate problema s poravnanjem na signalu za koji znate da je dobar.
- **⇅ Invert** — zamjenjuje crno i bijelo. Koristite ako slika izgleda kao negativ (bijela područja ondje gdje bi trebalo biti crno).
- **↺ Refresh** — čisti platno i vraća dekoder na početak. Koristite ga između emisija ili ako se slika trga ili pomiče.
- **⤓ Save PNG** — sprema trenutačno platno kao PNG datoteku na vaše računalo.

### Pokazatelji stanja

Na dnu slike dva pokazatelja tona prikazuju:

- **300 Hz phasing** — svijetli cijan kada je otkriven fazni ton početka slike.
- **450 Hz stop** — svijetli crveno kada je otkriven ton završetka slike.

> **Napomena:** slika klizi prema gore — najnoviji primljeni redak uvijek je na dnu platna. Ako u zaglavlju vidite **[PHASING]**, dekoder se uhvatio za početak nove slike.

---

## 9. NAVTEX

**Što je to:** NAVTEX je međunarodni pomorski sustav emitiranja obavijesti o sigurnosti u priobalju — navigacijskih upozorenja, vremenskih prognoza te obavijesti o traganju i spašavanju. Koristi FSK od 100 bauda (SITOR-B s FEC-om) i prima se na namjenskim kanalima diljem svijeta.

### Dostupni kanali

| Kanal | Frekvencija | Namjena |
|-------|-------------|---------|
| Međunarodni | 518 kHz | Na engleskom, međunarodni |
| Nacionalni | 490 kHz | Emisije na nacionalnom jeziku |
| KV (×5) | 4209.5 / 6314 / 8416.5 / 12579 / 16806.5 kHz | KV NAVTEX velikog dometa |

### Postavljanje

1. Uključite dekoder i iz padajućeg izbornika odaberite **NAVTEX**. Ili jednostavno pritisnite gumb **NAVTEX**. Prijamnik automatski prelazi na **USB**.
2. Pojavljuje se ploča **NAVTEX Receiver**.
3. Odaberite željeni kanal iz izbornika **Station** (npr. `International — 518 kHz`).
4. Kliknite **⇒ Tune & Set IF** da automatski ugodite slap i suzite propusni pojas na ispravan audioprozor. Način rada automatski se postavlja na **USB**. Prikazana frekvencija postavlja se 500 Hz ispod središta kanala, pa se NAVTEX signal pojavljuje na 500 Hz u zvuku.

### Raspored emitiranja

Tablica rasporeda navodi sve poznate postaje na odabranom kanalu s:

- njihovim ITU identifikacijskim slovom i zastavom države
- vremenom sljedeće emisije u UTC-u
- odbrojavanjem u stvarnom vremenu do sljedeće emisije
- **Jantarno ⚡** unutar 2 minute / **Crveno ●** unutar 30 sekundi — odmah pripremite dekoder

### Čitanje ispisa

Dekodirani tekst pojavljuje se u tirkiznom fontu jednolike širine. Granice poruka jasno su označene:

```
━━ ZCZC MA12 ━━
... message content ...
━━ NNNN ━━
```

`ZCZC` označava početak poruke. Tri znaka iza njega označavaju postaju (`M`), temu (`A` = navigacijska upozorenja) i redni broj (`12`). `NNNN` označava kraj.

Kliknite **Clear** da izbrišete međuspremnik poruka.

> **Napomena:** NAVTEX radi na srednjim i dugim valovima (518/490 kHz). Domet prijama obično iznosi 200–400 nautičkih milja od odašiljača. KV kanali (4–17 MHz) pružaju znatno veći domet.

---

## 10. FSK / RTTY — uključujući PSK31 i Oliviju

**Što je to:** univerzalni dekoder za uskopojasne tekstualne načine rada, s pet radnih inačica koje se biraju iz jednog izbornika. Tri su pravi FSK (frekvencijsko pomično ključanje): pomorski FSK (SITOR), meteorološki RTTY i amaterski RTTY. Druge dvije uopće nisu FSK, ali dijele isti prozor: **PSK31**, koji je fazno ključanje, i **Olivia**, koja je viševalni FSK s korekcijom pogrešaka. Svaka inačica dolazi s postavkom prilagođenom svojim standardnim parametrima.

### Inačice i postavke

| Inačica | Središte | Shift | Baud | Okvir | Kodiranje |
|---------|----------|-------|------|-------|-----------|
| Pomorski FSK / SITOR | 500 Hz | 170 Hz | 100 | 7N1 | CCIR-476 |
| Meteorološki RTTY | 1000 Hz | 450 Hz | 50 | 5N1.5 | ITA2 |
| Amaterski RTTY | 1000 Hz | 170 Hz | 45.45 | 5N1.5 | ITA2 |
| PSK31 (BPSK) | 1000 Hz | — | 31.25 | — | Varicode |
| Olivia (MFSK) | 1000 Hz | — | vidi Mode | — | 7 bita + FEC |

Ploča se prilagođava odabranoj inačici. **Shift**, **Baud**, **Framing**, **Encoding**, **Invert mark / space** i **Auto shift detect** skriveni su za PSK31 i Oliviju jer nijedan od ta dva načina nema par tonova mark/space niti okvir tipa UART. Umjesto toga **Center audio** postaje polje za slobodan unos broja (nosilac može biti bilo gdje u propusnom pojasu), a Olivia dobiva birač **Mode** i klizač **Squelch**.

### Postavljanje

1. Uključite dekoder i odaberite **FSK / RTTY** iz izbornika. Ili jednostavno pritisnite gumb **RTTY**.
2. Pojavljuje se ploča dekodera. Naslov prati inačicu — *FSK / RTTY Decoder*, *PSK31 Decoder* ili *Olivia Decoder*.
3. Odaberite **Variant**. Parametri se ažuriraju automatski.
4. Za Oliviju postavite **Mode** (tonovi / širina pojasa) tako da odgovara emisiji — vidi napomene o Oliviji niže.
5. Iz izbornika **Known frequency** odaberite uobičajenu frekvenciju za odabranu inačicu i kliknite **Tune** da skočite na nju.
6. Fino ugađajte dok dekodirani tekst ne postane stabilan i čitljiv.

### Poznate frekvencije po inačici

**Pomorski FSK / SITOR**
- 518,0 kHz — međunarodni NAVTEX
- 490,0 kHz — nacionalni NAVTEX
- 4209,5 / 6314,0 / 8416,5 / 12579,0 / 16806,5 / 22376,0 kHz — HF SITOR

**Meteorološki RTTY**
- 4583,0 / 7646,0 / 10100,8 / 11039,0 / 14467,3 kHz — DWD (njemačka meteorološka služba)

**Amaterski RTTY**
- 3590 kHz (80 m), 7043 kHz (40 m), 10143 kHz (30 m), 14083 kHz (20 m), 21083 kHz (15 m), 28083 kHz (10 m)

**PSK31**
- 3580,15 kHz (80 m), 7040,15 kHz (40 m), 10142,15 kHz (30 m), 14070,15 kHz (20 m), 18100,15 kHz (17 m), 21080,15 kHz (15 m), 24920,15 kHz (12 m), 28120,15 kHz (10 m)

**Olivia**
- 3577,75 kHz (80 m), 7073,75 kHz (40 m), 10142,25 kHz (30 m), 14075,5 kHz (20 m), 18103,75 kHz (17 m), 21075,75 kHz (15 m), 24921,75 kHz (12 m), 28123,75 kHz (10 m)

### Parametri

| Parametar | Odnosi se na | Opis |
|-----------|--------------|------|
| Center audio (Hz) | sve | Audio frekvencija sredine između mark i space; za PSK31 nosilac, za Oliviju središte bloka tonova. Padajući izbornik za FSK inačice, polje za slobodan unos za PSK31 i Oliviju |
| Shift (Hz) | samo FSK | Frekvencijska razlika između tonova mark i space |
| Baud | samo FSK | Brzina simbola |
| Framing | samo FSK | Podatkovni bitovi, paritet, stop bitovi (npr. 7N1 = 7 podataka, bez pariteta, 1 stop) |
| Encoding | samo FSK | Skup znakova (CCIR-476, ITA2/Baudot ili ASCII) |
| Invert mark / space | samo FSK | Zamjenjuje tonove mark i space |
| Auto shift detect | samo FSK | Pokušava automatski izmjeriti shift iz dolaznog signala |
| Mode (tonovi / Hz) | samo Olivia | Broj tonova i širina pojasa — mora točno odgovarati emisiji |
| Squelch (FEC S/N) | samo Olivia | Koliko jako podudaranje korekcije pogrešaka mora biti prije ispisa teksta |

### Mjerenja signala

Statusna traka prikazuje mjerenja uživo, a polja se mijenjaju s inačicom:

| Inačica | Prikazana polja |
|---------|-----------------|
| FSK inačice | **Mark / Space** (izmjerene frekvencije tonova), **SNR**, **Lock**, **Timing** |
| PSK31 | **Carrier** (Hz, nakon automatske korekcije frekvencije), **IMD** (dB), **S/N**, **Lock**, **Timing** |
| Olivia | **Centre** (Hz), **Mode**, **S/N**, **FEC** (%), **Sync** |

`Timing`/`Sync` pokazuje `LOCKED`/`SYNCED` kada dekoder prati signal, a `SEARCH` dok ga još traži.

### Dodatne kontrole

- **⇒ Set IF Band-Pass** — sužava propusni pojas prijamnika tako da tijesno obuhvati signal. Širina prati inačicu: mark/space plus rezerva za FSK, oko ±100 Hz za PSK31 i puna širina bloka tonova plus rezerva za Oliviju.
- **⟳ Auto-tune Center** — automatsko traženje signala. Za FSK inačice traži uravnotežen par tonova, za PSK31 pronalazi nosilac, a za Oliviju najjači blok odabrane širine pojasa.

### Napomene o PSK31

PSK31 je najrašireniji način rada tipkovnica-na-tipkovnicu na KV. Širok je samo 62 Hz, pa nekoliko veza stoji jedna uz drugu unutar nekoliko stotina herca oko okupljališne frekvencije, a ugađanje se svodi na odabir jednog traga iz skupine na slapu.

- Dekoder sam ispravlja svoju pogrešku ugađanja u rasponu od otprilike **±25 Hz**, pa je dovoljno da se približite. **Carrier** u retku mjerenja pokazuje gdje se zaista smjestio.
- **IMD** mjeri kvalitetu odašiljača, a ne prijam: čist signal pokazuje oko −20 dB ili bolje. Loša vrijednost znači da suprotna stanica prepobuđuje svoj odašiljač, a ne da ste vi loše ugođeni.
- Tekst se pojavljuje znak po znak bez korekcije pogrešaka, pa se slab signal degradira u povremena kriva slova umjesto da stane.

### Napomene o Oliviji

Olivia žrtvuje brzinu za otpornost. Znatno je sporija od PSK31, ali dekodira signale koji se uhom uopće ne čuju, zbog čega je omiljena za slabe signale i veze na velike udaljenosti.

- **Postavka Mode mora točno odgovarati emisiji.** Pogrešna kombinacija tonova i širine pojasa ne dekodira baš ništa — ne iskrivljen tekst, nego tišinu. Ploča se otvara na **8 / 250**, uskoj konfiguraciji koja se ostavlja uključena na pozivnim frekvencijama; **16 / 500** i **32 / 1000** druga su dva u čestoj uporabi, a nudi se i **16 / 1000**.
- Olivia ne šalje preambulu, pa dekoder mora tražiti sinkronizaciju. **Pričekajte nekoliko sekundi** nakon ugađanja prije nego što se pojavi tekst. Polje **Sync** pokazuje `SEARCH` dok se ne zaključa.
- Korekcija pogrešaka radi po blokovima, pa tekst stiže **u naletima, a ne u ravnomjernom toku**, uz kašnjenje od nekoliko blokova između emitiranja i prikaza.
- **Squelch (FEC S/N)** određuje koliko sigurna korekcija pogrešaka mora biti prije ispisa. Zadana vrijednost 4,0 drži šum vani; 3,0 je donja granica ispod koje slučajni šum počinje ispisivati pokoji znak. Dobar signal pokazuje 8–9 na mjeraču **FEC**, pa ima dosta prostora za podizanje squelcha na prometnom opsegu.

> **Napomena o načinu rada:** dekoder preuzima upravljanje načinom demodulacije i propusnim pojasom MF dok je aktivan. Oboje se automatski vraća kada ga isključite. Svih pet inačica koristi **USB**.
>
> **Napomena o polaritetu (samo FSK inačice):** za meteorološki RTTY obično treba označiti **Invert mark / space**. Za pomorski FSK (tipa SITOR/NAVTEX) i amaterski RTTY ostavite neoznačeno — amaterski RTTY šalje mark kao višu radiofrekvenciju, a USB je zadržava kao viši audio ton, što je upravo neoznačeni slučaj. Ako je dekodirani tekst iskrivljen, prvo što treba probati jest prebaciti ovaj okvir. Okvir je skriven za PSK31 i Oliviju, koje nemaju par mark/space.
>
> **Napomena o slovima/brojkama (samo FSK inačice):** Baudot drži slova i brojke u dva odvojena stanja, a šum može prebaciti dekoder u pogrešno — što izobličuje svaki sljedeći znak, ne samo oštećeni. Zato se dekoder na svakom razmaku vraća na slova; to je uobičajena praksa i popravlja pokvareno prebacivanje unutar jedne do dvije riječi umjesto cijelog retka. Cijena je da skupine brojki odvojene razmacima traže da pošiljatelj ponovi prebacivanje na brojke nakon svakog razmaka, kako odašiljači inače i rade.

---

## 11. SSTV

**Što je to:** televizija sporog raščlanjivanja prenosi nepomične slike običnim govornim SSB kanalom, redak po redak, kao frekvencijski moduliran ton između 1500 Hz (crno) i 2300 Hz (bijelo). Puna slika traje između 36 sekundi i 4 i pol minute, ovisno o načinu rada.

### Preporučene frekvencije (USB)

| Pojas | Frekvencija | Način rada | Napomene |
|-------|-------------|------------|----------|
| 20 m | 14.230 MHz | USB | Glavna međunarodna pozivna frekvencija za SSTV — daleko najaktivnija |
| 20 m | 14.233 MHz | USB | Pričuvna, kada je 14.230 zauzeta |
| 15 m | 21.340 MHz | USB | |
| 10 m | 28.680 MHz | USB | Aktivna tijekom otvaranja pojasa |
| 40 m | 7.171 MHz | LSB | |
| 80 m | 3.845 MHz | LSB | Regionalna, navečer |

**Bočni pojas bira se umjesto vas.** Pokretanjem dekodera odabire se **LSB ispod 10 MHz** i **USB iznad**, prema uobičajenoj amaterskoj praksi. Na pogrešnom bočnom pojasu preslikavanje tonova je obrnuto i slika se neće dekodirati. Ako naiđete na postaju koja zanemaruje konvenciju, jednostavno ručno promijenite bočni pojas — dekoder nastavlja raditi, briše okvir i kreće iznova s novom postavkom.

### Postavljanje

1. Uključite dekoder i iz padajućeg izbornika odaberite **SSTV**. Ili jednostavno pritisnite gumb **SSTV**. Prijamnik automatski mijenja bočni pojas — USB iznad 10 MHz, LSB ispod.
2. Ugodite se tako da tonovi slike padnu u sredinu propusnog pojasa. Ispravno ugođen signal ima sinkroimpulse na 1200 Hz, a sadržaj slike između 1500 i 2300 Hz.
3. Ostavite **Mode** na **Auto** osim ako već znate što se šalje. Slika se gradi redak po redak kako pristiže.

### Načini rada

| Postavka | Slika | Trajanje |
|----------|-------|----------|
| **Auto** | Otkriva se automatski | — |
| Martin M1 / M2 | 320×256 u boji | 114 s / 58 s |
| Scottie S1 / S2 | 320×256 u boji | 110 s / 71 s |
| Scottie DX | 320×256 u boji | 269 s |
| Robot 36 / 72 | 320×240 u boji | 36 s / 72 s |

**Auto** radi na dva načina: čita **VIS zaglavlje** — digitalni kod načina rada poslan u prvih 300 ms emisije — a ako je zaglavlje propušteno (ugodili ste se prekasno ili se izgubilo u QSB-u), način rada prepoznaje prema vremenskim odnosima sinkroimpulsa. Odabir određenog načina rada nameće taj način, ali dekoder i dalje provjerava sinkronizaciju prije nego što išta nacrta, pa pogrešan odabir daje izostanak slike umjesto šuma.

### Čitanje ispisa

Statusni redak ispod kontrola pokazuje što dekoder radi:

| Stanje | Značenje |
|--------|----------|
| `Waiting for VIS / AUTO lock` | Osluškuje; još ništa nije prepoznato |
| `Martin M1? verifying sync…` | Pronađen je kandidat i potvrđuje se prema sljedećim recima |
| `Martin M1 lock (VIS)` | Zaključano prema VIS zaglavlju |
| `Martin M1 lock (AUTO)` | Zaključano prema vremenskim odnosima sinkroimpulsa |
| `Martin M1 lock (MANUAL)` | Pokrenuto gumbom **⏺ Force** |
| `Candidate rejected (no sync)` | Kandidat nije potvrđen — uobičajeno na šumu |
| `— sync lost, resetting` | Signal je nestao usred slike |
| `Frame complete` | Primljena je cijela slika |

Prepoznati način rada pojavljuje se i zelenom bojom uz naslov **SSTV**, a brojač redaka pokazuje napredak.

### Kontrole

| Gumb | Radnja |
|------|--------|
| **▶ Start** | Priprema dekoder. Sam po sebi ne crta sliku — zaključavanje i dalje mora doći iz VIS zaglavlja ili iz otkrivanja sinkronizacije. |
| **■ Stop** | Zaustavlja dekodiranje. |
| **↺ Reset** | Čisti platno i ponovno priprema dekoder na mjestu. Koristite ga između slika ili nakon ponovnog ugađanja. |
| **⏺ Force** | Počinje crtati **odmah** u načinu odabranom u izborniku, potpuno preskačući VIS i otkrivanje sinkronizacije. Dostupno samo kada Mode nije **Auto**. |
| **💾 Save** | Sprema trenutačnu sliku kao PNG. |

**Kada koristiti Force.** Ako u slapu vidite sliku, ali se dekoder ne može zaključati na nju — neuobičajen način rada, signal preslab ili previše izobličen za detektore, ili propušteno zaglavlje — odaberite način rada ručno i pritisnite **⏺ Force**. Okvir se usidruje u trenutku klika, a oznaka načina rada prikazuje `MANUAL` kako biste ga razlikovali od VIS ili AUTO zaključavanja. Dekoder se i dalje poravnava prema stvarnom sinkroimpulsu ako ga pronađe, pa se klik koji je malo preran ili prekasan ispravlja.

Budući da Force preskače svaku sigurnosnu provjeru, rado će nacrtati šum ako ga pritisnete na praznom kanalu i neće se sam zaustaviti — pritisnite **■ Stop** ili **↺ Reset**.

### Napomene

- **Šum ne pokreće dekoder.** Nekoć su atmosferski praskovi, iskre i mrežne smetnje bili dovoljni da pokrenu dekodiranje. Svaki stupanj otkrivanja sada provjerava je li ton doista ton i potvrđuje kandidata prema sljedećim recima prije nego što se nacrta i jedan piksel. Očekujte da će dekoder mirovati na praznom pojasu.
- **Slika se kosi dijagonalno ako niste na frekvenciji.** SSTV ne oprašta pogreške u ugađanju. Ako se reci naginju, podesite frekvenciju u malim koracima i pustite da počne sljedeća slika.
- Ravnoteža boja i oštrina su fiksne; nema se što podešavati.

---

## 12. Opći savjeti

**Prvo se mora uključiti Decoder: ON.** Padajući je izbornik onemogućen (zasivljen) dok ne kliknete gumb Decoder.

**Jedan dekoder istodobno.** Odabir novog dekodera iz izbornika automatski zaustavlja prethodno aktivni i poništava sve promjene načina rada ili propusnog pojasa koje je napravio.

**Načinom rada upravlja se umjesto vas.** HF FAX i NAVTEX prebacuju prijamnik na USB čim ih odaberete, SSTV bira bočni pojas prema pojasu (LSB ispod 10 MHz, USB iznad), a FAX, NAVTEX i FSK usto podešavaju propusni pojas kada kliknete njihov gumb Tune. FT8, FT4, FT2, JS8 i WSPR čine isto čim ih odaberete — iz reda gumba ili s padajućeg izbornika: prijamnik prelazi na USB i dobiva svoj propusni pojas — cijeli podpojas od 3 kHz za obitelj FT8, 1350–1650 Hz za WSPR. Kada zaustavite dekoder, vraća se zadani način rada za taj pojas.

**Uključivanje dekodera više ne prekida zvuk.** Dekoderi rade u vlastitim dretvama, pa nema praznine, klika ni ispada kada se koji pokrene, zaustavi ili zamijeni drugim.

**Točnost sata sustava je važna.** FT8, FT4 i WSPR vremenski su kritični. Dekodiraju u fiksnim prozorima usklađenima s UTC-om. Ako sat vašeg računala odstupa više od 1–2 sekunde, stopa dekodiranja znatno će pasti. Koristite NTP klijent kako bi sat bio točan.

**Filtri šuma ne dopiru do dekodera.** NR, NB, NS i AN pomagala su za slušanje,
namijenjena samo vašim ušima. Svaki dekoder — FT8, FT4/FT2, CW, WSPR, FAX, NAVTEX, FSK/RTTY/PSK31/Olivia, SSTV i QRSS grabber — uzima zvuk *prije* tih filtara, pa ih slobodno namjestite kako najbolje zvuči, bez brige za kvalitetu dekodiranja. Iz istog razloga dekoderi rade i dok je prijamnik utišan ili pod squelchom: možete ugasiti zvučnik i pustiti da dekoder, ili noćno QRSS snimanje, nastavi prikupljati. Jedino što doista prati ono što čujete jest audio spektrogram, koji namjerno prikazuje filtrirani zvuk.

**Kvaliteta signala važnija je od njegove jakosti.** Većina je ovih dekodera namijenjena slabim signalima. Mirniji pojas s manje šuma često je plodonosniji od glasnog signala punog smetnji. Prije uključivanja dekodera koristite slap i kontrole propusnog pojasa kako biste prepoznali i izbjegli QRM.

**Slobodno koristite gumbe Refresh i Clear.** Slike FAX-a se pomiču ako je prikazana frekvencija malo pomaknuta, a tekstualni dekoderi nakupljaju šumne znakove. Novi početak nakon podešavanja ugađanja često daje mnogo čišći ispis.

### Automatska prijava spotova i grafikoni poslužitelja

Dekodiranja FT8, FT4 i WSPR može slati i sam poslužitelj — FT8/FT4 na PSK Reporter, WSPR na WSPRnet — pomoću autorun daemona koji sysop pokreće s administratorske ploče. Neovisan je o dekoderima u vašem pregledniku: radi bez obzira sluša li tko ili ne, a ništa što dekodirate u pregledniku ne prijavljuje se.

Sysop ga prati preko dva brojača koja je lako zamijeniti: pločice po dekoderu broje spotove poslane od zadnjeg pokretanja daemona, dok je broj uz svaki potvrdni okvir pojasa/načina rada ukupan zbroj tog mjesta od početka i preživljava ponovna pokretanja. Ista ploča ima stranicu **Grafikoni** koja crta frekvenciju procesora, opterećenje, temperaturu i broj korisnika kroz zadnjih 15 minuta do 24 sata. Oboje je opisano u [vodiču za administratorsku ploču](ADMIN_PANEL_SETUP.md).

---

*PhantomSDR-Plus — sv1btl fork — [phantomsdr.no-ip.org](http://phantomsdr.no-ip.org:8900)*
