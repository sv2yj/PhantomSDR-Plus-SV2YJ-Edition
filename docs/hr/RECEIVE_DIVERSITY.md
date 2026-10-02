# PhantomSDR-Plus — Diverziti prijam (Receive Diversity)

Povežite svoj prijamnik s **drugim prijamnikom na drugoj lokaciji** i slušajte onaj koji u tom trenutku ima bolji signal. Kad jedna lokacija upadne u fading, druga obično nije, pa prijam teče dalje.

Drugi prijamnik može biti još jedan PhantomSDR-Plus, KiwiSDR, UberSDR ili WebSDR. Za prva tri sve se izvodi u pregledniku: bez izmjena na poslužitelju, bez konfiguracijskih datoteka, bez ičega za instalirati i bez posebnog pristupa drugom prijamniku. WebSDR je iznimka i traži mali program na vašem vlastitom poslužitelju — vidi [Korištenje WebSDR-a](#korištenje-websdr-a) niže.

---

## Što radi, a što ne

Diverziti ovdje znači **odabir**: u svakom trenutku slušate jednu ili drugu lokaciju, uz kratko preklapanje pri promjeni. Nije riječ o faznom nizu i dva se signala ne zbrajaju.

To je namjeran izbor, a razlog je fizika, ne softver. Dva prijamnika udaljena stotinama kilometara čuju isti prijenos preko različitih ionosferskih putova. Dva zvučna vala stižu s nepovezanom fazom i malo drugačijim Dopplerom, pa njihovo zbrajanje zvuči šuplje i češljasto filtrirano — poznati „phasey" učinak. Pravo koherentno spajanje traži dva prijamnika na **zajedničkom taktu**, poravnata do uzorka; dva neovisna prijamnika preko interneta to nikada ne mogu pružiti.

Dobitak je stoga **kontinuitet, a ne jačina signala**:

- Na stabilnom putu gdje je jedan prijamnik jednostavno bolji, čut ćete njega i nećete dobiti ništa. To je normalno.
- Na putu s dubokim QSB-om, fadinzi na dvije udaljene lokacije uglavnom su nekorelirani. Lokacija A nestane na tri sekunde, lokacija B ne, i zvuk se nastavlja. Očekujte *„prestao sam gubiti riječi"*, a ne *„iz S3 je postalo S7"*.
- Druga korist često je **lokalni šum i QRM**. Dvije lokacije imaju različite susjede, različite električne mreže i različiti splatter. Na bučnom opsegu to može značiti više od fadinga.

Ima svoju cijenu: slušate **jednu do tri sekunde iza stvarnog vremena**, jer raniji tok treba odgoditi da se poklopi s kasnijim. Nevažno za slušanje i dekodiranje, nezgodno ako pokušavate raditi sa stanicom.

> [!NOTE]
> Digitalni dekoderi (FT8, JS8, WSPR, RADE i ostali) namjerno i dalje koriste vaš **lokalni** prijamnik, a ne kombinirani zvuk. Ti načini rada integriraju koherentno kroz cijeli vremenski odsječak, a promjena lokacije usred odsječka prekid je faze koji vas može stajati upravo onog dekodiranja koje je diverziti trebao spasiti. Diverziti služi zvučniku; dekoderi zadržavaju neprekinuti lokalni tok.

---

## Brzi početak

1. Otvorite ploču **Receive Diversity** — nalazi se odmah ispod prozora dekodera, sklopljena, s natpisom `Receive Diversity — off`. Kliknite da se raširi.
2. Odaberite što je drugi prijamnik: **PhantomSDR+**, **KiwiSDR**, **UberSDR** ili **WebSDR**.
3. Upišite njegovu adresu — ili odaberite jednu od spremljenih — i pritisnite **Start**.
4. Ugađajte svoj prijamnik normalno. Drugi ga **automatski slijedi** — frekvenciju, način rada i propusni pojas — pri svakom ugađanju.

To je cijela postava. Na drugom prijamniku nema se što podesiti niti postoji zasebno ugađanje: uvijek vas prati.

### Adrese

| Drugi prijamnik | Što upisati | Napomene |
|---|---|---|
| PhantomSDR+ | `host:8900` | Uobičajeni port prijamnika |
| KiwiSDR | `host:8073` | Vlastiti port KiwiSDR-a |
| UberSDR | `host` | Njegov **uobičajeni web port**, ne 8073 |
| WebSDR | `host:8901` | Vlastiti port stanice. Traži relej — vidi niže |

Prihvaća se samo naziv poslužitelja, `http://` adresa ili puna `ws://` adresa. Ako se drugi prijamnik poslužuje preko HTTPS-a, upišite naziv poslužitelja i veza će biti sigurna.

### Spremljeni prijamnici

Svaka adresa koju upotrijebite pamti se, u vlastitom popisu za svaki tip prijamnika — adresa KiwiSDR-a nikad nije koristan prijedlog kad birač pokazuje WebSDR. Popisi ostaju u vašem pregledniku: ne šalju se nikamo i svaki slušatelj ima svoj.

Gumb **☰** pokraj polja s adresom otvara popis.

- **Imena.** Svaki unos može dobiti ime — `Twente` se čita bolje od `websdr.ewi.utwente.nl:8901`. Imenovani unosi prikazuju se zeleno iznad svoje adrese, a dok tipkate ime stoji uz adresu u padajućem popisu. Unos se prepoznaje po svojoj adresi, pa imenovanje nikad ne stavi istu stanicu dvaput na popis. Dok diverziti radi, prijamnik na koji je spojen prikazuje svoje ime **podebljano i polako trepćuće**, pa popis govori i kojega zapravo slušate.
- **add** dodaje prijamnik ručno, bez prethodnog spajanja na njega. **✎** ispravlja ime i adresu na mjestu, **✕** uklanja jedan unos, a **clear all** prazni popis tipa koji je na zaslonu. Enter sprema, Escape odustaje.
- **🌍** otvara vlastitu web stranicu tog prijamnika u novoj kartici. Spremljena je adresa koju poziva softver, pa se najprije pretvara u adresu za pregledavanje — `ws://` postaje `http://`, a putanja `/audio`, `/ws` ili, kod KiwiSDR-a, `/kiwi/…/SND` koja svakoj vrsti prijamnika treba, odbacuje se jer je stranica stanice u korijenu. To je pravi link, pa srednji klik i dugi pritisak rade kao i inače.
- **Redoslijed je vaš.** Pomaknite redak s **▲▼**, ili ga povucite i pustite ondje gdje mu je mjesto. Tim redoslijedom padajući popis nudi adrese.
- **⭳ export i ⭱ import.** Popisi su u spremištu samog preglednika, koje nestaje kad obrišete podatke stranice — upravo od toga ovo štiti. Export zapisuje sva četiri popisa, zajedno s imenima, u JSON datoteku koju možete sačuvati ili prenijeti u drugi preglednik ili na drugo računalo. Import je čita natrag i pita hoće li se **spojiti** (merge) sa spremljenim ili će se sve **zamijeniti** (replace).
- **▦ QR.** Crta sve popise kao QR kod na zaslonu, da ih prenesete na mobitel — vidi „Na mobitelu” niže. Popis prevelik za skeniranje vraća se na tekst pokraj njega, koji se može kopirati i zalijepiti bilo gdje.

Broj prijamnika koje čuvate nije ograničen.

### Na mobitelu

Stranica `/mobile` ima istu funkciju u kartici **Div**, uz Audio, Bands, Marks, Users i Chat: vrsta prijamnika, adresa, Start i Stop, spremljeni prijamnici kao popis koji se bira dodirom, žive brojke i SNR trim. Svaki redak nosi i link **🌍** na vlastitu stranicu tog prijamnika. Drugi prijamnik sam slijedi ugađanje mobitela, jednako kao na stolnoj stranici. Nema uređivanja — preimenovanja, presloživanja, brisanja — ono ostaje na stolnoj stranici, gdje za to ima mjesta.

Spremljeni popis pripada jednom pregledniku, pa mobitel počinje s praznim koliko god prijamnika bilo spremljeno na računalu. Zato postoji QR kod: na računalu pritisnite **☰** pa **▦ QR**, skenirajte kod kamerom mobitela i zalijepite tekst u **Import** u kartici Div. Pita hoće li spojiti ili zamijeniti, a Export na mobitelu šalje popis u suprotnom smjeru.

---

## Korištenje WebSDR-a

WebSDR — softver Pieter-Tjerka de Boera, PA3FWM, koji radi u Twenteu i na više stotina drugih lokacija — može poslužiti kao drugi prijamnik, ali ne izravno iz preglednika.

Razlog je namjerna provjera na njihovoj strani. WebSDR odbija audio vezu ako zaglavlje `Origin` ne imenuje njegovu vlastitu stranicu, a `Origin` je *zabranjeno ime zaglavlja*: preglednik ga postavlja prema stranici na kojoj jeste i nijedna skripta ga ne smije mijenjati. Zaobilaznice na strani klijenta nema, niti bi je smjelo biti.

Zato vezu uspostavlja mali program na vašem poslužitelju, `websdr_relay.py`. Vaš preglednik razgovara s relejem, a relej s WebSDR-om.

### Instalacija releja

Sva četiri distribucijska instalatera nude ga kao neobavezan korak. Za već postojeću instalaciju:

```
cd ~/PhantomSDR-Plus
./setup_websdr_relay.sh
```

Traži port, preuzima vaš pozivni znak i adresu stanice iz `frontend/site_information.json` te nudi instalaciju systemd usluge kako bi se relej pokretao pri podizanju sustava. Postavke su u `websdr_relay.json` i mogu se promijeniti bilo kada.

**Jedno instalater ne može učiniti umjesto vas: proslijediti port releja na vašem ruteru.** Preglednici slušatelja spajaju se izravno na relej — ne ide kroz prijamnik — pa bez tog prosljeđivanja WebSDR diverziti radi samo iz vaše vlastite mreže. Ostala tri tipa prijamnika to ne pogađa.

Ako je administracijska ploča instalirana, njezina nadzorna ploča prikazuje karticu **WebSDR Diversity Relay** sa stanjem, portom te brojem sesija i stanicama prema kojima idu.

### Budite dobar gost

Relej se na tuđe prijamnike spaja s vašeg poslužitelja, a ne s adrese svakog slušatelja, pa je građen da se pristojno ponaša:

- **Ograničenje od deset istodobnih sesija prema jednom WebSDR-u**, i šezdeset ukupno. To sprječava da užurban dan kod vas izgleda kao napad na tuđu stanicu.
- **`User-Agent` koji imenuje vašu stanicu i njezina operatora**, kako bi operator koji to ne želi znao točno kome pisati. Ispunite ga pošteno.
- **Prosljeđuju se samo naredbe ugađanja.** Veza se ne može koristiti za slanje bilo čega drugog.
- **Privatne, loopback i carrier-NAT adrese se odbijaju**, tako da posjetitelj ne može usmjeriti relej na nešto unutar vašeg računala ili lokalne mreže.

> [!IMPORTANT]
> Provjera `Origin` postoji jer autori WebSDR-a nisu htjeli da se njihovim prijamnicima upravlja s tuđih stranica. Korištenje releja promišljena je odluka, a ne njihov propust. Ostavite ograničenje gdje jest, držite User-Agent poštenim i prestanite ako vas operator zamoli.

### Što je kod WebSDR-a drugačije

- **Mnoge stanice pokrivaju tek nekoliko uskih isječaka spektra**, a ne neprekinut raspon — primjerice prozor od 256 kHz na 40 m. Diverziti se uključuje samo unutar njih, a ploča čita popis opsega stanice da bi znala gdje su.
- **Frekvencija uzorkovanja zvuka mijenja se** sa širinom filtra i više odstupa od nazivne nego kod ostalih tipova, pa poravnanje može potrajati nešto dulje.
- **CW nije prilagođen** konvenciji WebSDR-a, koja propusni pojas stavlja u cijelosti ispod nosioca. SSB i AM su ispravni.

---

## Čitanje ploče

Tijekom rada ploča prikazuje malu tablicu:

| Redak | Značenje |
|---|---|
| **link** | Veza s drugim prijamnikom. `ready` je ono što želite. Pri neuspjehu prikazuje se tekst pogreške drugog poslužitelja i WebSocket kod zatvaranja |
| **aligned** | Izmjereno kašnjenje između dvaju tokova nakon zaključavanja, inače `searching` |
| **corr** | Koliko su tokovi korelirani. Ima smisla tek nakon poravnanja |
| **remote audio** | Dekodirani zvuk koji stiže s drugog prijamnika. `none` u jantarnoj boji znači da se ništa ne dekodira |
| **SNR local / remote** | Dvije procjene odnosa signal/šum koje se uspoređuju |
| **switches** | Koliko je puta promijenio lokaciju |

Uz naslov, jedna riječ govori gdje ste:

| | |
|---|---|
| `off` (sivo) | ne radi |
| **`Please wait…`** (jantarno) | spaja se, ili je spojen i još se poravnava |
| **`Ready`** (zeleno) | povezan, zaključan i prati bolju lokaciju |
| poruka pogreške samog prijamnika (crveno) | nije uspjelo i neće se samo oporaviti |

Razlika između jantarne i crvene je ona koja štedi vrijeme: jantarna znači nastavite čekati, crvena znači prestanite čekati i pročitajte poruku.

Obojena točka dodaje koju lokaciju zapravo slušate — zelena vaš prijamnik, cijan udaljeni.

### Poravnanje traje oko 15 sekundi

To je normalno. Dva se toka poravnavaju koreliranjem njihovih **zvučnih ovojnica**, a za to treba prozor zvuka. Traženje ide u dva koraka: usko traženje od ±1,5 sekunde može krenuti čim se prikupi oko 9 sekundi zvuka, a druga, neovisna mjera pet sekundi kasnije mora se **složiti** s prvom prije nego se poravnanje prihvati. Kad su dvije postaje vremenski razmaknutije od toga — sekunda ili dvije dodatnog međuspremanja negdje na putu — na oko 14 sekundi preuzima puno traženje od ±4 sekunde, a potvrda stiže na 19.

Taj korak potvrde je važan. Kad dvije lokacije blijede u protufazi — nikad istodobno ne nose signal — jedna jedina korelacija spremno se zaključa na uvjerljivo, ali posve pogrešno kašnjenje, što zvuči kao jeka. Zahtjev za dvjema neovisnim mjerama koje se slažu to odbacuje.

Još nešto mora biti točno prije nego zaključavanje izdrži: brzine uzorkovanja dvaju prijamnika. Dva prijamnika znače dva takta i dva lanca decimacije, pa im zvučni tokovi **ne** stižu posve istom brzinom čak ni kad oba prijavljuju 12 kHz — razlika od 2% je uobičajena, dakle 240 uzoraka klizanja u sekundi, daleko više od tolerancije poravnanja. Zato se udaljeni tok neprekidno preuzorkuje na brzinu vašeg prijamnika. Taj se omjer mjeri **brojanjem uzoraka**, a ne koreliranjem, pa mu ne treba vlastito zaključavanje i utvrđen je u prvih nekoliko sekundi — prije nego uopće krene prvo traženje poravnanja. Slab ili isprekidan signal može tražiti dva ili tri pokušaja, pa 30 sekundi nije razlog za brigu; minuta bez ičega jest.

Dok piše `searching`, obje vrijednosti SNR-a pokazuju `0.0`. To je namjerno: obje se procjene mjere na **sadržajno poravnatim** uzorcima, pa se ništa ne mjeri prije nego postoji poravnanje. `0.0 / 0.0` znači „još nije zaključano", a ne „nema signala".

---

## Remote SNR trim

Ovaj klizač pristrano usmjerava izbor između dviju lokacija. Dodaje se izmjerenom SNR-u udaljenog prijamnika prije usporedbe — pozitivno pogoduje udaljenom, negativno vašem. Ne mijenja **ništa drugo**: ni razinu zvuka ni spajanje, samo koja lokacija pobjeđuje.

Postoji jer dvije vrijednosti SNR-a nisu uvijek usporedive. Obje se mjere jednako — kao raspon percentila zvuka — ali prijamnik čiji kodek podiže vlastiti prag šuma pokazuje manje nego što zaslužuje. KiwiSDR primjenjuje snažno pojačanje i limiter, što sažima raspon; kodek s gubicima postavlja prag šuma ispod kojeg signal nikad ne siđe.

**Kako ga podesiti:**

1. Ugodite oba prijamnika na signal koji je pouzdano prisutan i pričekajte `aligned`.
2. Promatrajte obje vrijednosti SNR-a pola minute. Zapamtite uobičajenu razliku.
3. Krajnje položaje iskoristite kao slušni test: **+15** prisilno uključuje udaljenu lokaciju, **−15** vašu. Poslušajte svaku nekoliko sekundi. To je jedini način da čujete jednu lokaciju zasebno.
4. Ako udaljeni pokazuje, recimo, 5 dB manje ali zvuči jednako dobro, postavite **+5**. Time postižete da se dva očitanja slažu kad obje lokacije zvuče jednako.
5. Pratite brojač **switches** kroz deset minuta slušanja. Neprestano prebacivanje znači da je vrijednost preblizu izjednačenju; nikakvo prebacivanje iako vaš prijamnik čujno blijedi znači da je otišla predaleko u drugom smjeru.

Polazne vrijednosti: **0** za drugi PhantomSDR-Plus, koji ima istovjetan zvučni put i usporediv je po samoj izvedbi; mala **pozitivna** vrijednost za KiwiSDR ili UberSDR.

> [!TIP]
> Ako vam treba više od otprilike ±8 dB, prestanite podešavati. U tom je trenutku pošteno objašnjenje obično da je jedan prijamnik stvarno lošiji za taj put, a pristranost preko stvarne razlike znači samo slušanje slabije lokacije.

Postavka djeluje odmah i pamti se u vašem pregledniku.

---

## Odabir drugog prijamnika

**Udaljenost je važna.** Fadinzi se dekoreliraju s udaljenošću — nekoliko stotina kilometara na KV dobar je cilj. Dva prijamnika u istom gradu blijede zajedno i ne donose ništa. Predaleko, pa drugi prijamnik možda uopće ne čuje vaš signal.

**Oba moraju stvarno čuti signal.** Taj zahtjev nijedan softver ne zaobilazi. Ako drugi prijamnik ne čuje ono što vi slušate, korelacija ostaje niska i neće se zaključati — namjerno, jer pogrešno poravnanje zvuči gore nego nikakav diverziti.

**Pokrivenost.** Drugi PhantomSDR-Plus ili KiwiSDR objavljuju frekvencijski raspon koji pokrivaju, pa vas ploča upozorava ako ugodite izvan njega. WebSDR objavljuje svoje opsege, koji su često uski isječci umjesto neprekinutog raspona. UberSDR ne objavljuje pokrivenost, pa je ondje izostanak zaključavanja vaš jedini znak.

> [!IMPORTANT]
> Javne prijamnike održavaju volonteri i imaju ograničen broj slušateljskih mjesta. Sesija diverzitija zauzima jedno dok traje, jednako kao i ljudski slušatelj. Budite obzirni prije nego ostavite vezu otvorenu neograničeno i pitajte operatora ako namjeravate njegov prijamnik koristiti intenzivno.

---

## Rješavanje problema

**`link` nikad ne napusti `connecting` ili se stalno spaja i zatvara** Vjerojatno su adresa ili port pogrešni. Pogledajte tablicu gore — posebno, UberSDR koristi svoj uobičajeni web port, ne 8073. Ploča prikazuje WebSocket kod zatvaranja, a konzola preglednika (F12) osnovnu pogrešku.

**`link` prikazuje pogrešku s tekstom** Taj tekst dolazi od drugog prijamnika i obično je konkretan: odbijena sesija, pun poslužitelj ili prijamnik koji ne prihvaća vanjske klijente.

**KiwiSDR odbija vezu** Neki KiwiSDR-ovi traže lozinku, a na UberSDR-u je pristupna točka kompatibilna s KiwiSDR-om prema zadanim postavkama isključena. Za UberSDR upotrijebite vrstu **UberSDR** — taj je put uvijek dostupan.

**WebSDR: `the WebSDR relay is not reachable`** Relej ne radi ili vaš preglednik ne doseže njegov port. Mora biti dostupan na **istom imenu poslužitelja s kojeg se poslužuje stranica prijamnika**, jer se preglednik spaja izravno na njega, a ne kroz prijamnik. Otvorite `http://<to ime poslužitelja>:<port releja>/status` u istom pregledniku da vidite o čemu se radi. Ako odgovara na lokalnoj mreži, ali ne izvana, port nije proslijeđen na ruteru.

**WebSDR: pogreška koja spominje odbijenu vezu** Ta je stanica zaključana strože od uobičajene provjere `Origin`, ili je njezin operator blokirao ovu stanicu.

**`link` je `ready`, ali `remote audio` pokazuje `none`** Zvuk se ne dekodira. Osvježite stranicu; ako se nastavi, konzola preglednika pokazat će koji je dekoder zakazao.

**Zvuk stiže, ali se nikad ne poravna** Dva prijamnika ne čuju istu stvar. Pokušajte s jakom radiodifuzijskom postajom ili opsegom na kojem obje lokacije imaju dobru propagaciju. Miran opseg sa samo šumom na obje strane nikad se neće korelirati — i ne bi ni trebao.

**Stalno se prebacuje amo-tamo** Dvije su lokacije preblizu po SNR-u. Malo pomaknite trim tako da jedna bude dosljedno povlaštena.

**Nikad ne koristi drugi prijamnik** Provjerite raste li `remote audio` i djeluju li vrijednosti SNR-a razumno. Ako udaljeni pokazuje mnogo manje nego što zvuči, upravo za to služi trim.

---

## Ograničenja

- **Nije koherentno.** Bez fazriranja, bez poništavanja, bez radiogoniometrije. Poništavanje izvora šuma traži dvije antene na istom taktu na istoj lokaciji; to je druga tehnika za drugi problem.
- **Jedna do tri sekunde kašnjenja**, neizbježno.
- **Samo dva prijamnika.**
- **Mono.** Ako je vaš prijamnik u stereo načinu poput C-QUAM-a, zvuk prolazi nepromijenjen i diverziti se ne uključuje.
- **Poravnanje treba signal.** Ispod otprilike 10 dB SNR-a na jednoj od dviju lokacija očekujte da ostane na `searching`.
- **WebSDR traži relej** na vašem vlastitom poslužitelju i proslijeđen port. Ostala tri tipa prijamnika ne trebaju ni jedno ni drugo.
