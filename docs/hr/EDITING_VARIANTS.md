# PhantomSDR-Plus — Kako uređivati varijante frontenda

*(nakon što su četiri datoteke `App__*_smeter_.svelte` spojene u jednu `App.svelte`)*

---

## 1. Što su varijante

Dva neovisna izbora koji daju četiri kombinacije:

```
smeter = "analog"     instrument s pomičnom kazaljkom
       = "digital"    segmentirani stupčasti instrument

layout = "v1"         izbornik načina rada gore, izbornik pojasa dolje
       = "v2"         izbornik pojasa gore, izbornik načina rada dolje
                      (pomiče i red gumba za fino ugađanje na mobitelu)
```

Sve četiri žive u **jednoj** izgradnji, koja se poslužuje na `/`. Birač ⚙️ u gornjem desnom kutu prebacuje između njih unutar stranice koja radi: postavlja propove `smeter`/`layout` u `App.svelte`, pa se ništa ne učitava ponovno, a zvuk, slap i dekoderi nastavljaju raditi. Odabir se sprema po pregledniku u `localStorage` pod ključem `phantom.variant` i pri sljedećem posjetu ima prednost pred zadanom vrijednošću izgradnje.

Varijanta koju sysop odabere u `recompile.sh` stoga je **početna** varijanta — ono što posjetitelj vidi prvi put, prije nego dotakne izbornik.

| URL | što je to |
|-----|-----------|
| `/` | stranica za računalo; sve četiri varijante, zamjenjive u radu |
| `/mobile/` | *zasebna stranica, gradi je `build-mobile.sh` — nije varijanta* |

> Do 10. 8. 2026. svaka je varijanta bila zasebna izgradnja pod `/analog/`, `/digital/`, `/v2-analog/` i `/v2-digital/`, a birač je navigirao među njima — zato je prebacivanje ponovno učitavalo stranicu i prekidalo zvuk. Tih izgradnji više nema; na svakoj od četiri putanje ostaje samo mali `index.html` koji preusmjerava na `/`, a piše ga `frontend/make-redirect-stubs.sh` pri svakoj izgradnji kako bi stare oznake i dalje radile.

Varijanta se **ne** upisuje ni u jednu izvornu datoteku. `src/main.js` je nepromjenjiva ulazna točka koja komponenti predaje dvije vrijednosti definirane u vrijeme izgradnje:

```js
const app = new App({
  target: document.getElementById('app'),
  props: { smeter: __PHANTOM_SMETER__, layout: __PHANTOM_LAYOUT__ }
})
```

`vite.config.js` ih popunjava pri izgradnji, uzimajući prvo od navedenog što je postavljeno:

1. **`PHANTOM_SMETER` / `PHANTOM_LAYOUT`** — varijable okoline. Otkad nema izgradnji po varijanti, ništa ih više ne postavlja; i dalje rade za jednokratnu izgradnju s drugom početnom varijantom.
2. **`frontend/variant.json`** — zadana vrijednost stranice, koju upisuje `recompile.sh`. Izgradnja korijena (`/`) ne prosljeđuje varijantu pa završava ovdje.
3. **`analog` / `v1`** — pričuvna vrijednost.

Te su dvije vrijednosti samo početna vrijednost. `App.svelte` ih pri inicijalizaciji prepisuje iz `localStorage` ako je posjetitelj već odabrao varijantu, a birač ⚙️ ih ponovno postavlja pri svakom prebacivanju.

Unutar `App.svelte` propovi se pretvaraju u dvije zastavice u retcima 20-21:

```js
$: isAnalog = smeter !== "digital";
$: isV2     = layout === "v2";
```

Koristite te dvije zastavice — nikada `smeter`/`layout` izravno — kako bi se cijela datoteka čitala na isti način.

---

## 2. Koja datoteka što radi

### `frontend/src/main.js` — 12 redaka

Ulazna točka. Ništa osim instanciranja App-a i dviju `__PHANTOM_*__` vrijednosti koje prosljeđuje kao propove. **Nepromjenjiva** je — ni `recompile.sh` ni skripte za izgradnju je više ne prepisuju, a upravo to omogućuje istovremenu izgradnju varijanti.

> **Ne stavljajte ovdje kod aplikacije.** To je ulazna datoteka, a ne mjesto za logiku.

### `frontend/src/App.svelte` — ~17130 redaka

Cijela aplikacija: slap, ugađanje, dekoderi, oznake, ploče, raspored za računalo I prilagodljivi raspored za mobitel. Gotovo svaka izmjena koju ćete ikada raditi ide ovdje.

### `frontend/src/lib/SMeterAnalog.svelte` — 824 retka

Instrument s pomičnom kazaljkom, u cijelosti: crtanje brojčanika, kazaljka, prebacivanje svijetlog/tamnog brojčanika i njegov ključ u localStorage, te zaglađivanje kazaljke.

- Ulazni prop: `dbm` — KALIBRIRANA snaga u dBm.
- Prima i: `mobile` — manji atributi canvasa za raspored na mobitelu.
- Podešavanje: `SMOOTH_TIME_MS` u retku 55. Manje = brža kazaljka, više = glađa. Trenutno 16 (jedan okvir pri 60 fps, praktički donja granica).

#### Tri izgleda skale — i `smeter_theme.sh`

Analogni instrument ima tri pozadine, sve iscrtane istim kodom:

```
dark      izvorni tamni brušeni metal
amber     svijetla, blijedosiva skala
vintage   topla skala u boji ostarjelog jantara
```

**Nemojte to brkati s varijantom `smeter = analog / digital` iznad.** Varijanta bira *koja se komponenta instrumenta* prikazuje; izgled bira *kako se analogni iscrtava*. Pohranjeni su pod različitim localStorage ključevima (`phantom.variant` i `smeterTheme`) i postavljaju se na različitim mjestima.

**Strana posjetitelja.** Platno instrumenta je gumb (`role="button"`, također Enter/Razmaknica s tipkovnice, uz napomenu „click to switch style“ ispod). Svaki klik prolazi dark → amber → vintage i sprema izbor u `localStorage.smeterTheme`. Čita se natrag pri svakom učitavanju stranice, pa izbor posjetitelja preživljava osvježavanja i ponovna pokretanja preglednika neograničeno. Namjerno **nije** kolačić: kolačić bi se slao poslužitelju uz svaki zahtjev za slapom i zvukom, za vrijednost koju poslužitelj nikada ne čita.

**Strana sysopa.** Dvije stvari u `SMeterAnalog.svelte` određuju što dobivaju svi ostali:

| Redak | Što radi |
|-------|----------|
| `let smeterTheme = 'dark';` | Izgled koji dobiva preglednik **bez spremljenog izbora**. |
| `const SMETER_PREF_VERSION = 2;` | Brojač. Kada je spremljena verzija preglednika iza njega, preglednik **jednom** zaboravi spremljeni izgled i preuzme gornju zadanu vrijednost. Povećajte ga da pomaknete posjetitelje koji su već birali. |

Promjena samo zadane vrijednosti stoga doseže isključivo posve nove posjetitelje. Obje promjene zajedno pomiču sve — upravo zato postoji `smeter_theme.sh` u korijenu repozitorija:

```bash
./smeter_theme.sh                 # prikaži trenutnu zadanu vrijednost, zatim odaberi iz izbornika
./smeter_theme.sh vintage         # postavi odmah, pa ponudi ponovnu izgradnju
./smeter_theme.sh dark --build    # pokreni frontend/build-all.sh bez pitanja
./smeter_theme.sh amber --no-reset  # samo novi posjetitelji — postojeće ostavi na miru
```

Prijavljuje trenutnu zadanu vrijednost, postavlja novu, povećava brojač poništavanja (uvijek prema gore — **nikada ga ne smanjujte**, manji broj samo spriječi da se poništavanje dogodi) i zatim nudi isti izbor izgradnje frontenda kao `recompile.sh`. **Ne** dira backend i **ne** prepisuje `variant.json`.

> Promjena doseže spojenog slušatelja tek kad ponovno učita svoju stranicu — zadana vrijednost je ugrađena u JS paket, a poništavanje se izvodi pri učitavanju. Nema slanja uživo. Obično ponovno učitavanje je dovoljno jer vite dodaje hash u imena datoteka paketa.

Jednokratno brisanje putem brojača nadjačava sve, uključujući posjetitelje koji su namjerno kliknuli vlastiti izgled. To je namjerno: to je jedini način da se cijela stranica vrati na jedan izgled. Upotrijebite `--no-reset` ako ih radije želite ostaviti na miru.


### `frontend/src/lib/SMeterDigital.svelte` — 184 retka

Segmentirani stupčasti instrument, u cijelosti.

- Ulazni propovi: `rawDb` — SIROVA vrijednost `audio.getPowerDb()`
- `smeterOffset` — `audio.smeter_offset`
- `mobile` — manji atributi canvasa

> **NAPOMENA:** ovaj instrument namjerno se napaja SIROVOM snagom plus pomakom, a NE kalibriranom dBm vrijednošću koju koristi analogni brojčanik. Oduvijek je imao vlastito preslikavanje. Davanje kalibrirane vrijednosti pomaknulo bi svako očitanje na svakoj digitalnoj postaji. Nemojte „ujednačavati“ ova dva ulaza.

### `frontend/src/lib/BandSelector.svelte` — 69 redaka

Mreža gumba pojaseva. Prikazuje se dvaput u `App.svelte` (jednom po rasporedu).

### `frontend/src/lib/ModesSelector.svelte` — 75 redaka

Mreža gumba načina rada. Prikazuje se dvaput u `App.svelte`.

### `frontend/src/lib/StatusIndicators.svelte` — 122 retka

Statusne žaruljice (mute, squelch, NR, NB, NS, AN, CTCSS). Prima prop `wide`: digitalni raspored koristi šire žaruljice od analognog. Obje Tailwind klase (`w-8` i `w-10`) napisane su u cijelosti unutar komponente — Tailwindov skener vidi samo doslovna imena klasa, pa ih nikada ne gradite spajanjem znakovnih nizova.

Sve ostale datoteke u `frontend/src/lib/` (Spectrogram, PassbandTuner, FrequencyInput, VersionSelector, ...) starije su od ovog posla i nisu mijenjane.

---

## 3. Izmjena koja utječe samo na neke varijante

Umotajte je u zastavicu. U oznakama:

```svelte
{#if isAnalog}
  ...ovo vide samo analogne postaje...
{:else}
  ...ovo vide samo digitalne postaje...
{/if}

{#if isV2} ... {/if}          {#if !isV2} ... {/if}
```

U atributu class:

```svelte
class="p-4 {isAnalog ? 'text-xs' : 'text-sm'} rounded-md"
```

Napišite obje mogućnosti kao cjelovite doslovne nizove, kao gore. Tailwind pretražuje izvorni kod za potpunim imenima klasa; `text-{size}` ili spojeno ime uklanja se iz CSS-a i stil tiho nestaje.

U bloku `<script>`: pokušajte uopće ne granati. Skripta namjerno računa ulaze OBAJU instrumenata u svakom ciklusu —

```js
smeterDbm    = powerDb;                    // analogni brojčanik
smeterRawDb  = audio.getPowerDb();         // digitalni brojčanik
smeterOffset = audio.smeter_offset;        // digitalni brojčanik
```

— pa samo oznake moraju birati. Zato u datoteci od 17000 redaka postoji samo 15 prekidača varijanti. Neka tako i ostane; grananje na razini skripte je ono što je razdvojilo četiri stare datoteke.

---

## 4. Gdje su prekidači varijanti

Petnaest mjesta u `App.svelte`. Brojevi redaka pomiču se pri uređivanju — pouzdan način da ih sve pronađete je:

```bash
cd frontend/src && grep -n 'isAnalog\|isV2' App.svelte
```

U trenutku pisanja:

| Redak | Zastavica | Što prebacuje |
|-------|-----------|---------------|
| 20 | | deklaracija `isAnalog` |
| 21 | | deklaracija `isV2` |
| 8062 | `isV2` | računalo: izbornik pojasa prvi (poredak v2) |
| 8090 | `isV2` | računalo: veličina naslova ploče |
| 8686 | `isV2` | računalo: izbornik načina rada prvi (poredak v1) |
| 8717 | `isAnalog` | najmanja širina ploče instrumenta (kazaljka je uža) |
| 8730 | `isAnalog` | samo analogno: redak datuma/vremena iznad instrumenta |
| 8819 | `isAnalog` | samo analogno: statusne žaruljice + razdjelnik |
| 8834 | `isAnalog` | samo digitalno: redak vremena, široke žaruljice i sam izbor `<SMeterDigital>` / `<SMeterAnalog>` |
| 8861 | `isAnalog` | okomiti razmaci bloka frekvencije |
| 8864 | `isAnalog` | gornja margina bloka finog ugađanja |
| 12288 | `isV2` | mobitel: red finog ugađanja iznad (poredak v2) |
| 12347 | `isAnalog` | mobitel: koji se instrument prikazuje |
| 12433 | `isV2` | mobitel: red finog ugađanja ispod (poredak v1) |
| 13204 | `isAnalog` | veličina teksta gumba noise gate |

Sve ostalo u datoteci zajedničko je svim četirima varijantama.

---

## 5. Ostale postavke koje vrijedi znati

| Mjesto | Konstanta | Svrha |
|--------|-----------|-------|
| `App.svelte` redak 5034 | `const visualGain = 1.1;` | Kalibracija analognog instrumenta. Svakih 0,10 otprilike je 5 dBm na očitanju. |
| `SMeterAnalog.svelte` redak 55 | `const SMOOTH_TIME_MS = 16;` | Vremenska konstanta zaglađivanja kazaljke, u milisekundama. |
| `SMeterAnalog.svelte` redak 64 | `let smeterTheme = 'dark';` | Zadani izgled analognog instrumenta za preglednik bez spremljenog izbora. Postavite ga s `./smeter_theme.sh`, ne ručno. |
| `SMeterAnalog.svelte` redak 69 | `const SMETER_PREF_VERSION = 2;` | Brojač jednokratnog poništavanja spremljenog izgleda. Povećajte ga da postojeće posjetitelje prebacite na zadanu vrijednost; ide samo prema gore. |
| `SMeterDigital.svelte` redak 149 | `const DIGITAL_BAR_TRIM = 0;` | Pomiče traku za cijele segmente. |
| `SMeterDigital.svelte` redak 31 | `const numberOfDots = 35;` | Broj segmenata trake. |

---

## 6. Nakon uređivanja — ponovna izgradnja

Najjednostavnije, iz korijena repozitorija:

```bash
./recompile.sh
```

Stavka izbornika **[2]** ponovno gradi frontend i pita koju varijantu treba vidjeti posjetitelj koji dolazi prvi put. Taj se odabir bilježi u `frontend/variant.json` — nijedna izvorna datoteka ne kopira se niti prepisuje. (Prije je iz heredoca ponovno stvarala i `VersionSelector.svelte`; to je uklonjeno kad je birač prestao navigirati, jer bi pri svakom pokretanju poništilo prebacivanje u radu.) Stavka **[1]** je samo backend, **[3]** je oboje.

Ili izravno, iz `frontend/`:

```
./build-all.sh          gradi stranicu za računalo I /mobile/  <-- obično koristite ovo
./build-default.sh      samo stranicu za računalo
./build-mobile.sh       samo /mobile/
```

> `build-default.sh` dopušta viteu da isprazni `dist/`, čime nestaje `dist/mobile/` do sljedećeg `build-all.sh` ili `build-mobile.sh`. Zato je `build-all.sh` uobičajen izbor.

`build-all.sh` ima vlastitu kopiju logike izgradnje (`build_version SMETER LAYOUT NAME OUTDIR BASE LOG`) umjesto da poziva `build-default.sh`. Ako mijenjate način na koji se stranica gradi, promijenite to na OBA mjesta ili će se dva puta razići.

Nekoliko pojedinosti koje vrijedi znati:

- Postavlja `PHANTOM_KEEP_OUTDIR=1` kako Vite ne bi praznio izlazni direktorij, nego sam čisti `dist/` — briše sadržaj, ali zadržava `users.json`, koji `spectrumserver` u pogonu prepisuje pri svakom spajanju i odspajanju slušatelja.
- `/mobile` gradi zadnje, kada je izlaz za računalo gotov.
- Njegov mehanizam paralelne izgradnje (`PHANTOM_BUILD_JOBS`, zadano 3) ostatak je iz vremena pet izgradnji za računalo. S jednom, ništa ne čeka u redu.

**Bitovi izvršavanja:** `recompile.sh` pokreće `chmod +x` na skripti prije nego što je izvrši, a `build-all.sh` namjerno poziva `bash build-mobile.sh` umjesto `./build-mobile.sh`, pa nedostajući bit više ne ruši izgradnju. Prijenos skripte kroz GitHubovo web sučelje ipak je vraća na 644, pa ako neku pokrećete izravno:

```bash
chmod +x frontend/build-*.sh
```

---

## 7. Kako provjeriti izmjenu prije nego joj povjerujete

Zeleni `vite build` **NIJE** dovoljan. Izgradnja ne može vidjeti identifikator koji je nestao pri premještanju koda između datoteka — to je `ReferenceError` tijekom izvođenja i stranica se jednostavno ne učita. Dogodilo se dvaput.

### 1) Provjera nedefiniranih identifikatora (hvata upravo taj kvar)

```bash
cd frontend
npx eslint --no-eslintrc \
    --parser svelte-eslint-parser \
    --rule '{"no-undef":"error"}' \
    --env browser,es2022 \
    src/App.svelte src/lib/SMeter*.svelte
```

Očekuje se jedan poznati, bezopasni pogodak:

```
'dBmCalOffset' is not defined
```

`typeof x === 'number'` nad nedeklariranim imenom nikada ne baca iznimku, pa taj izraz već daje 0. Sve ostalo je pravi problem.

### 2) Izgradite, pa UČITAJTE STRANICU I PROĐITE KROZ SVE ČETIRI VARIJANTE

Ne samo onu koju ste mijenjali — izmjena pod `isAnalog`/`isV2` može slomiti ostale tri dok vaša radi. Otvorite `/`, prođite kroz sve četiri stavke u izborniku ⚙️, pa otvorite `/mobile/`.

Otvorite konzolu preglednika na svakoj. Prazna ili napola iscrtana stranica s `ReferenceError` u konzoli potpis je gornje greške.

### 3) Nikada ne ostavljajte `frontend/dist/` u djelomičnom stanju

Goli `npx vite build` prazni izlazni direktorij i sa sobom odnosi `dist/mobile/` te živi `dist/users.json` poslužitelja — mobilna stranica vraća 404 do sljedeće uspješne izgradnje. Uvijek gradite kroz skripte: `build-all.sh` postavlja `PHANTOM_KEEP_OUTDIR=1` i sam obavlja čišćenje, čuvajući `dist/users.json`. Ako ste u dvojbi, jednostavno ponovno pokrenite `./build-all.sh`.
