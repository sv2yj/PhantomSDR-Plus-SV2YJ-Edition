# Vodič za instalaciju System Stats

Sveobuhvatan vodič za dodavanje nadzora poslužitelja u stvarnom vremenu u vašu PhantomSDR aplikaciju pomoću automatizirane instalacijske skripte.

## Pregled

Ova značajka dodaje gumb **📊 Stats** u vaše PhantomSDR sučelje koje prikazuje informacije o sustavu u stvarnom vremenu:
- Korištenje procesora, jezgre, frekvencija, temperatura i vodeći procesi
- Korištenje memorije (iskorišteno/ukupno/postotak)

Statistika se automatski ažurira svakih 5 sekundi dok je modalni prozor otvoren.

> **Nije isto što i stranica „Grafikoni“ na administratorskoj ploči.** Ovaj je prozor trenutačni snimak koji se osvježava dok je otvoren i ne čuva povijest. Administratorska ploča ima zasebnu stranicu **Grafikoni** koja svake 2 sekunde uzorkuje frekvenciju procesora, opterećenje, temperaturu i broj korisnika te ih crta kroz zadnjih 15 minuta do 24 sata — vidi [vodič za administratorsku ploču](../hr/ADMIN_PANEL_SETUP.md).

---

## Preduvjeti

- **Linux poslužitelj** (preporučuje se Ubuntu/Debian)
- **Internetska veza** (za preuzimanje Node.js-a i paketa)
- **Sudo pristup** (za postavljanje systemd usluge)
- **PhantomSDR-Plus** već instaliran i pokrenut
- **lm-sensors** (preporučeno za temperaturu Intel/AMD procesora - skripta ga automatski instalira)

---

## Metode instalacije

> [!NOTE]
> **Glavna instalacijska skripta to već nudi.** `./install.sh` — i četiri distribucijske skripte — pokreću `install-stats-server.sh` prema zadanome u sklopu normalne instalacije PhantomSDR-Plusa, pa je na svježem stroju poslužitelj statistike obično već postavljen. Ovu stranicu koristite da ga instalirate zasebno ili da mu naknadno promijenite port, adresu ili uslugu.

### Opcija 1: Automatizirana instalacija (Preporučeno) ⭐

Automatizirana skripta obavlja sve umjesto vas.

#### Korak 1: Pokrenite skriptu

```bash
cd ~/PhantomSDR-Plus
chmod +x install-stats-server.sh   # only if it is not already executable
./install-stats-server.sh
```

**VAŽNO:** NEMOJTE pokretati kao root ili s sudo. Pokrenite kao vaš uobičajeni korisnik.

#### Korak 2: Slijedite interaktivne upite

Skripta će vas voditi kroz:

##### 1. **Instalacija Node.js-a** (ako je potrebno)
```
⚠ Node.js / npm is not installed
Would you like to install Node.js 22 via nvm now? (y/n): y
```
Skripta instalira Node.js 22 putem nvm-a, na bilo kojoj Linux distribuciji — bez root ovlasti i bez apt izvora. Isto pitanje postavlja i kada je Node.js prisutan, ali stariji od 22.

##### 2. **Direktorij instalacije**
```
Installation directory [/home/user/sdr-stats-server]: 
```
Pritisnite Enter za zadanu vrijednost ili navedite prilagođenu putanju.

##### 3. **Konfiguracija porta** (Poboljšano!)
```
Port Configuration:
  Default port: 3001
  Common alternatives: 8080, 5000, 8888
Enter port number [3001]: 
```

Skripta provjerava vaš port:
- ✅ Provjerava je li valjan broj
- ✅ Upozorava ako je port < 1024 (zahtijeva root ovlasti)
- ✅ Provjerava raspon (1-65535)
- ✅ Provjerava je li port već u upotrebi
- ✅ Prikazuje koji ga proces koristi ako je zauzet
- ✅ Omogućuje vam odabir drugog porta

**Primjeri scenarija:**

**Korištenje zadanog porta:**
```
Enter port number [3001]: ↵
✓ Port 3001 selected
```

**Odabir prilagođenog porta:**
```
Enter port number [3001]: 8080
✓ Port 8080 selected
```

**Port već u upotrebi:**
```
Enter port number [3001]: 3001
⚠ Port 3001 is currently in use
Process using port 3001:
node    12345 user   20u  IPv6 123456  TCP *:3001 (LISTEN)
Choose a different port? (y/n): y
Enter port number [3001]: 3002
✓ Port 3002 selected
```

**Nevaljan port:**
```
Enter port number [3001]: abc
✗ Port must be a number
Enter port number [3001]: 99999
✗ Port must be between 1 and 65535
Enter port number [3001]: 3001
✓ Port 3001 selected
```

##### 4. **Adresa poslužitelja**
```
What is your server's public address?
Examples: Your_site_IP, 192.168.1.100, localhost
Server address: Your_site_IP
```
Unesite javnu domenu ili IP adresu vašeg poslužitelja.

##### 5. **Potvrda**
```
Please confirm your settings:
  Installation directory: /home/user/sdr-stats-server
  Port: 3001
  Server address: Your_site_IP
  Stats URL will be: http://Your_site_IP:3001
Continue with these settings? (y/n): y
```

##### 6. **Postavljanje Systemd usluge** (Opcionalno)
```
Would you like to set up the server as a system service (auto-start on boot)? (y/n): y
```

Preporučeno: Odaberite **y** kako bi se poslužitelj automatski pokretao pri podizanju sustava.

#### Korak 3: Instalacija dovršena! ✓

Skripta će prikazati sažetak:
```
╔════════════════════════════════════════════════╗
║          Installation Complete! ✓              ║
║          Open the port in the router!          ║
╚════════════════════════════════════════════════╝

Configuration Summary:
  Installation: /home/user/sdr-stats-server
  Port: 3001
  Server: Your_site_IP
  API URL: http://Your_site_IP:3001/api/system-stats
```

---

## Konfigurirajte svoju PhantomSDR aplikaciju

Nakon što skripta završi, morate ažurirati svoju Svelte aplikaciju.

### Korak 1: Ažurirajte `site_information.json`

Budući da je `site_information.json` već uređen tijekom početnog postavljanja, trebate samo dodati novi redak `siteStats` s vašim portom:

```json
{
	"siteSysop": "your name or callsign",
	"siteSysopEmailAddress": "mail@mail.net",
	"siteGridSquare": "QTH locator",
	"siteCity": "City Country",
	"siteInformation": "https://github.com/sv1btl/PhantomSDR-Plus",
	"siteHardware": "Hardware you are using, ",
	"siteSoftware": "Software you are using",
	"siteReceiver": "Receiver model",
	"siteAntenna": "Receiving Antenna.",
	"siteNote": "This is a bright new open-source WebSDR project, under active development.",
	"siteIP": "http://Your_site_IP:port",
  "siteStats": "http://Your_site_IP:3001",  ← DODAJTE OVAJ REDAK (koristite svoj port)
  "siteSDRBaseFrequency": 0,
  "siteSDRBandwidth": 30000000,
  "siteRegion": 1,
  "siteChatEnabled": true
}
```

**Napomena:** Koristite port koji ste odabrali tijekom instalacije!

### Korak 2: Ažurirajte `App.svelte` (najnovija GitHub verzija već uključuje ažuriranu datoteku)

Napravite ove **4 promjene** u svojoj App.svelte datoteci:

#### Promjena 1: Osigurajte da je `siteStats` deklariran (oko retka 50)

```javascript
import {
  siteSysop,
  siteSysopEmailAddress,
  siteInformation,
  siteGridSquare,
  siteCity,
  siteHardware,
  siteSoftware,
  siteReceiver,
  siteAntenna,
  siteNote,
  siteIP,
  siteStats,  // ← DODAJTE OVAJ REDAK
  siteSDRBaseFrequency,
  siteSDRBandwidth,
  siteRegion,
  siteChatEnabled,
} from "../site_information.json";
```

#### Promjena 2: Ažurirajte objekt systemStats (oko retka 530)

```javascript
let systemStats = {
  cpu: { usage: 0, cores: 0, temperature: null, frequency: null, topProcesses: [] },  // ← DODAJTE topProcesses: []
  memory: { used: 0, total: 0, percent: 0 }
};
```

#### Promjena 3: Ažurirajte fetch URL (oko retka 541)

```javascript
async function fetchSystemStats() {
  try {
    const response = await fetch(`${siteStats}/api/system-stats`);  // ← PROMIJENITE OVAJ REDAK
    if (response.ok) {
      systemStats = await response.json();
    } else {
      console.error('Failed to fetch system stats:', response.statusText);
    }
  } catch (error) {
    console.error('Error fetching system stats:', error);
  }
}
```

#### Promjena 4: Dodajte prikaz vodećih procesa (u odjeljku CPU, oko retka 3838)

Dodajte ovaj kod nakon odjeljka o temperaturi:

```svelte
{#if systemStats.cpu.frequency}
<div style="display: flex; justify-content: space-between; margin-bottom: 0.25rem;">
  <span>Frequency:</span>
  <span style="color: #4ade80;">{systemStats.cpu.frequency.current} GHz{#if systemStats.cpu.frequency.max} <span style="opacity: 0.7;">(max {systemStats.cpu.frequency.max})</span>{/if}</span>
</div>
{/if}

{#if systemStats.cpu.temperature !== null}
<div style="display: flex; justify-content: space-between; margin-bottom: 0.25rem;">
  <span>Temperature:</span>
  <span style="color: {systemStats.cpu.temperature > 70 ? '#fbbf24' : '#4ade80'};">{systemStats.cpu.temperature}°C</span>
</div>
{/if}

<!-- DODAJTE CIJELI OVAJ ODJELJAK: -->
{#if systemStats.cpu.topProcesses && systemStats.cpu.topProcesses.length > 0}
<div style="margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px solid rgba(255,255,255,0.1);">
  <h4 style="margin: 0 0 0.5rem 0; font-size: 0.85rem; color: rgba(0, 225, 255, 0.8);">Top Processes:</h4>
  {#each systemStats.cpu.topProcesses as process}
  <div style="display: flex; justify-content: space-between; margin-bottom: 0.25rem; font-size: 0.85rem;">
    <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 70%;">{process.name}</span>
    <span style="color: {process.cpu > 50 ? '#ef4444' : process.cpu > 25 ? '#fbbf24' : '#4ade80'};">{process.cpu}%</span>
  </div>
  {/each}
</div>
{/if}
```

### Korak 3: Ponovno kompilirajte svoju aplikaciju

```bash
cd /path/to/your/phantomsdr-app
npm ./recompile.sh
```

---

## Testiranje instalacije

### Test 1: Provjerite API krajnju točku

```bash
curl http://localhost:3001/api/system-stats
```

Očekivani izlaz (JSON):
```json
{
  "cpu": {
    "usage": 45.2,
    "cores": 8,
    "coresUsed": 1.3,
    "temperature": 62.5,
    "frequency": {
      "current": 3.0,
      "max": 3.9,
      "limit": 4.4
    },
    "topProcesses": [
      {"name": "node", "cpu": 12.5},
      {"name": "phantomsdr", "cpu": 8.3}
    ]
  },
  "memory": {
    "used": 8.5,
    "total": 16,
    "percent": 53
  }
}
```

### Test 2: Provjerite status usluge

Ako ste je instalirali kao uslugu:

```bash
sudo systemctl status sdr-stats.service
```

Trebalo bi prikazati: `Active: active (running)`

### Test 3: Testirajte u pregledniku

1. Otvorite svoje PhantomSDR web sučelje
2. Pomaknite se do odjeljka **Additional Info**
3. Kliknite na gumb **Open Additional Info**
4. Potražite gumb **📊 Stats** pored informacija o računalu
5. Kliknite na njega da biste otvorili modalni prozor statistike
6. Provjerite prikazuje li se i ažurira li se statistika

---

## Upravljanje uslugom

Ako ste je instalirali kao systemd uslugu, koristite ove naredbe:

```bash
# Start the service
sudo systemctl start sdr-stats.service

# Stop the service
sudo systemctl stop sdr-stats.service

# Restart the service (after updating files)
sudo systemctl restart sdr-stats.service

# Check status
sudo systemctl status sdr-stats.service

# View real-time logs
sudo journalctl -u sdr-stats.service -f

# View last 50 log entries
sudo journalctl -u sdr-stats.service -n 50

# Enable auto-start on boot
sudo systemctl enable sdr-stats.service

# Disable auto-start
sudo systemctl disable sdr-stats.service

# Edit service
sudo nano /etc/systemd/system/sdr-stats.service

# Delete service
sudo rm /etc/systemd/system/sdr-stats.service
```

---

## Ručna instalacija (Opcija 2)


> [!IMPORTANT]
> **Za normalnu instalaciju ovaj odjeljak vam ne treba.** `install-stats-server.sh` sve to obavlja umjesto vas i glavna ga instalacijska skripta pokreće prema zadanome. Slijedite ga samo za ručno postavljanje ili za ručni popravak pojedinog dijela.

**⚠️ Upozorenje:** Ručna instalacija može koristiti zastarjele datoteke. **Automatizirana skripta je izričito preporučena** jer:
- Instalira najnoviju verziju s poboljšanim otkrivanjem temperature
- Automatski instalira i konfigurira lm-sensors
- Automatski upravlja svim ovisnostima

Ako ipak preferirate ručnu instalaciju:

### 1. Instalirajte Node.js
```bash
# Any distribution - nvm needs no root and no apt source.
# NOT NodeSource: deb.nodesource.com now answers HTTP 403 on every path.
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.4/install.sh | bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm install 22 && nvm use 22 && nvm alias default 22
```

### 2. Instalirajte lm-sensors (Potrebno za Intel/AMD temperaturu)
```bash
sudo apt-get update
sudo apt-get install -y lm-sensors
sudo sensors-detect --auto
```

### 3. Stvorite direktorij
```bash
mkdir ~/sdr-stats-server
cd ~/sdr-stats-server
```

### 4. Preuzmite najnovije datoteke

**Važno:** datoteke poslužitelja više se ne čuvaju kao kopije u repozitoriju - stvara ih instalacijska skripta.

Umjesto toga, jednom pokrenite automatiziranu skriptu za generiranje najnovijih datoteka, a zatim ih kopirajte:
```bash
# Run the automated script from the repository root
cd ~/PhantomSDR-Plus
./install-stats-server.sh
# When prompted, use a temporary port like 9999
# After installation completes, copy the generated files
cp ~/sdr-stats-server/system-stats-server.js ~/your-manual-install-dir/
cp ~/sdr-stats-server/package.json ~/your-manual-install-dir/
```

**ILI** ručno stvorite datoteke koristeći najnoviji kod iz instalacijske skripte.

### 5. Uredite port (ako je potrebno)
```bash
nano ~/sdr-stats-server/system-stats-server.js
```

Promijenite redak 6:
```javascript
const PORT = process.env.PORT || 3001;  // Change this number
```

### 6. Instalirajte ovisnosti
```bash
npm install
```

### 7. Probno pokretanje
```bash
npm start
```

### 8. Postavite uslugu (Opcionalno)

Slijedite postavljanje systemd usluge iz odjeljka o automatiziranoj instalaciji.

## Promjena porta nakon instalacije

Ako trebate promijeniti port nakon instalacije:

### Korak 1: Uredite datoteku poslužitelja

```bash
nano ~/sdr-stats-server/system-stats-server.js
```

Promijenite redak 6:
```javascript
const PORT = process.env.PORT || 3001;  // Change this number
```

### Korak 2: Ažurirajte site_information.json

```json
"siteStats": "http://Your_site_IP:NEW_PORT"
```

### Korak 3: Ponovno pokrenite uslugu

```bash
sudo systemctl restart sdr-stats.service
```

### Korak 4: Ponovno izgradite svoju Svelte aplikaciju

```bash
cd /path/to/phantomsdr-app
npm run build
```

---

## Rješavanje problema

### Problem: Port je već u upotrebi

**Pogreška:**
```
Error: listen EADDRINUSE: address already in use :::3001
```

**Rješenje:**

1. Pronađite što koristi port:
```bash
sudo lsof -i :3001
```

2. Zaustavite taj proces:
```bash
kill <PID>
# or
sudo systemctl stop sdr-stats.service
```

3. Ponovno pokrenite uslugu:
```bash
sudo systemctl start sdr-stats.service
```

**Alternativa:** Ponovno pokrenite instalacijsku skriptu i odaberite drugi port kada se od vas zatraži.

### Problem: Usluga se ne pokreće

**Pogreška:**
```
status=217/USER
```

**Rješenje:**

1. Provjerite datoteku usluge:
```bash
cat /etc/systemd/system/sdr-stats.service
```

2. Provjerite podudara li se redak `User=` s vašim korisničkim imenom:
```bash
whoami
```

3. Uredite ako je potrebno:
```bash
sudo nano /etc/systemd/system/sdr-stats.service
```

4. Ponovno učitajte i ponovno pokrenite:
```bash
sudo systemctl daemon-reload
sudo systemctl restart sdr-stats.service
```

### Problem: Statistika se ne prikazuje u pregledniku

**Simptomi:** Modalni prozor se otvara, ali nema podataka ili prikazuje vrijednosti 0

**Rješenja:**

1. Provjerite konzolu preglednika (F12) za pogreške
2. Provjerite je li API dostupan:
```bash
curl http://localhost:3001/api/system-stats
```
3. Provjerite je li usluga pokrenuta:
```bash
sudo systemctl status sdr-stats.service
```
4. Provjerite podudara li se `siteStats` u `site_information.json` s adresom i portom vašeg poslužitelja
5. Provjerite CORS pogreške - osigurajte da poslužitelj dopušta vašu domenu

### Problem: Temperatura prikazuje null

**Uzrok:** Očitavanje temperature nije dostupno na vašem sustavu

**Rješenja:**

1. **Za većinu Linux sustava:** Provjerite postoji li toplinska zona:
```bash
cat /sys/class/thermal/thermal_zone0/temp
```

2. **Instalirajte lm-sensors:**
```bash
sudo apt-get install lm-sensors
sudo sensors-detect
sensors
```

3. **Napomena:** Temperatura možda neće biti dostupna na:
- Virtualnim strojevima
- Nekim VPS pružateljima usluga
- Windows Subsystem for Linux (WSL)
- Ne-Linux sustavima

To je normalno - ostatak statistike i dalje će raditi!

### Problem: Vrijednosti statistike ne podudaraju se s `top`

**Uzrok:** Razdoblje uzorkovanja procesora bilo je prekratko u starijim verzijama

**Rješenje:** Trenutna verzija koristi uzorkovanje od 1 sekunde za točna očitanja. Ako imate staru instalaciju:

1. Ažurirajte datoteku poslužitelja:
```bash
nano ~/sdr-stats-server/system-stats-server.js
```

2. Pronađite redak 18 i promijenite:
```javascript
}, 100);  // Old value
```
u:
```javascript
}, 1000);  // New value (1 second)
```

3. Ponovno pokrenite:
```bash
sudo systemctl restart sdr-stats.service
```

Ili jednostavno ponovno pokrenite instalacijsku skriptu da biste dobili najnoviju verziju.

### Problem: Node.js nije pronađen

**Pogreška:**
```
node: command not found
```

**Rješenje:**

1. Instalirajte Node.js:
```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.4/install.sh | bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm install 22 && nvm use 22 && nvm alias default 22
```

2. Provjerite:
```bash
node --version
npm --version
```

---

## Što ćete vidjeti

Nakon instalacije i konfiguracije, modalni prozor statistike prikazuje:

### 🖥️ Odjeljak CPU
- **Korištenje**: Ukupni postotak iskorištenosti procesora
- **Jezgre**: Koliko se procesora doista koristi, izraženo u cijelim jezgrama — npr. `1.3 / 12 in use` znači da stroj obavlja posao 1,3 jezgre. Podatak je točan i ne treba mu nikakav prag. Namjerno nije broj zauzetih jezgri: raspoređivač posao jedne jezgre razmazuje po više njih, pa bi takav broj ovu vrijednost mogao samo približno pogoditi.
- **Frekvencija**: Prosječna trenutna frekvencija procesora na svim jezgrama u GHz, s najbržom jezgrom u zagradi (ako je dostupna)
- **Temperatura**: Temperatura procesora u Celzijevim stupnjevima (ako je dostupna), označena bojom: 🟢 zelena do 69 °C, 🟠 narančasta 70-79 °C, 🔴 crvena od 80 °C naviše
- **Vodeći procesi**: 5 procesa koji najviše troše procesor s postotcima označenim bojama:
  - 🟢 Zelena: do 50 % procesora
  - 🟠 Narančasta: 51-80 % procesora
  - 🔴 Crvena: iznad 80 % procesora

### 💾 Odjeljak memorije
- **Iskorišteno**: Memorija u upotrebi (GB)
- **Ukupno**: Ukupna memorija sustava (GB)
- **Korištenje**: Postotak korištenja memorije (označen bojama)

### ♻️ Automatsko ažuriranje
- Statistika se osvježava svakih **5 sekundi** dok je modalni prozor otvoren
- Prestaje se ažurirati kada zatvorite modalni prozor (štedi resurse)

---


## Otkrivanje temperature

Poslužitelj statistike koristi napredno otkrivanje temperature s više metoda:

### ✅ **Podržani sustavi:**
- **Intel procesori**: Čita s coretemp senzora putem lm-sensors
- **AMD procesori**: Čita s k10temp senzora (Tdie/Tctl)
- **ARM procesori**: Čita iz toplinskih zona (Raspberry Pi, itd.)

### 📋 **Zahtjevi:**
- **Intel/AMD**: Zahtijeva paket `lm-sensors` (skripta ga automatski instalira)
- **ARM/Raspberry Pi**: Radi odmah, nisu potrebni dodatni paketi

### 🔧 **Prioritet instalacije:**
1. Pokušava naredbu `sensors` za temperaturu Package/Core (Intel/AMD)
2. Vraća se na izravno čitanje coretemp (Intel)
3. Vraća se na thermal_zone0 (ARM/Raspberry Pi)

Ako temperatura prikazuje `null`, instalirajte lm-sensors:
```bash
sudo apt-get install lm-sensors
sudo sensors-detect --auto
sudo systemctl restart sdr-stats.service
```

---

## Sažetak značajki

✅ **Nadzor u stvarnom vremenu** - Statistika sustava uživo s vašeg poslužitelja
✅ **Metrike procesora** - Korištenje, jezgre, temperatura, vodeći procesi
✅ **Praćenje memorije** - Iskorišteno, ukupno i postotak
✅ **Automatska ažuriranja** - Osvježava se svakih 5 sekundi
✅ **Označeno bojama** - Vizualni pokazatelji za upozorenja
✅ **Lagano** - Minimalno korištenje resursa
✅ **Jednostavna instalacija** - Automatizirana skripta obavlja sve
✅ **Provjera porta** - Pametan odabir porta s otkrivanjem sukoba
✅ **Upravljanje uslugom** - Automatsko pokretanje pri podizanju sustava

---

## Sigurnosne napomene

- Poslužitelj statistike prihvaća veze s bilo kojeg izvora (CORS: *)
- Za produkciju razmislite o ograničavanju CORS-a samo na vašu domenu
- Odabir porta provjerava unos i provjerava sukobe
- Očitavanje temperature procesora je samo za čitanje i sigurno je
- Nikakve osjetljive informacije o sustavu nisu izložene

---

## Podrška i resursi

### Uključene datoteke:
U ovoj mapi (sama instalacijska skripta nalazi se u korijenu, kao `PhantomSDR-Plus/install-stats-server.sh` - postoji samo jedna kopija):
- `package.json` - Ovisnosti, identične onima koje skripta zapisuje
- Ovaj dokument, dostupan i na de, el, es, fr, hr i ru

Skripta ih stvara u `~/sdr-stats-server/`:
- `system-stats-server.js` - Backend poslužitelj, generiran s odabranim portom
- `package.json` - Ovisnosti
- `node_modules/` - instalira `npm install`

### Dobivanje pomoći:
- Provjerite odjeljak za rješavanje problema iznad
- Pregledajte zapisnike usluge: `sudo journalctl -u sdr-stats.service -n 50`
- Ručno testirajte API: `curl http://localhost:3001/api/system-stats`
- Provjerite konfiguracijske datoteke

### Deinstalacija poslužitelja statistike:
- Izbrišite mapu /sdr-stats-server
- Ako ste stvorili uslugu, samo je izbrišite koristeći:
```bash
sudo rm /etc/systemd/system/sdr-stats.service"`
```
- Izmijenite `App.svelte`: Pronađite dio koda:
```
                   <!-- In case you don't want the Stats Button to appear, please comment this button section (12 lines)-->                     
                    <!-- System Stats Button -->
                    <button
                      type="button"
                      class="glass-button text-white py-1 px-2 ml-2 rounded text-xs"
                      on:click={openSystemStats}
                      title="System Resources"
                      aria-haspopup="dialog"
                      aria-expanded={showSystemStats}
                      aria-controls="system-stats-dialog"
                      style="color:rgba(0, 225, 255, 0.993); font-size: 0.75rem;"
                    >
                      📊 Stats
                    </button>
  ```
  i zamijenite s:
```
                   <!-- In case you don't want the Stats Button to appear, please comment this button section (12 lines)-->                     
                    <!-- System Stats Button -->
                    <!--
                    <button
                      type="button"
                      class="glass-button text-white py-1 px-2 ml-2 rounded text-xs"
                      on:click={openSystemStats}
                      title="System Resources"
                      aria-haspopup="dialog"
                      aria-expanded={showSystemStats}
                      aria-controls="system-stats-dialog"
                      style="color:rgba(0, 225, 255, 0.993); font-size: 0.75rem;"
                    >
                      📊 Stats
                    </button>
                    -->
  ```                    
- Ponovno kompilirajte pomoću naredbe:
```bash
  cd PhantomSDR-Plus
 ./recompile.sh
 ```
- Ponovno pokrenite računalo i pokrenite poslužitelj

---

**Autor:** Kreirano za PhantomSDR-Plus
**Verzija:** 1.1 (Poboljšano otkrivanje temperature procesora za Intel/AMD) **Ažurirano:** Siječanj 2026.
**Licenca:** MIT

---

## Brza referenca naredbi

```bash
# Installation
cd ~/PhantomSDR-Plus
chmod +x install-stats-server.sh
./install-stats-server.sh

# Service Management
sudo systemctl start sdr-stats.service      # Start
sudo systemctl stop sdr-stats.service       # Stop
sudo systemctl restart sdr-stats.service    # Restart
sudo systemctl status sdr-stats.service     # Status
sudo journalctl -u sdr-stats.service -f     # Logs

# Testing
curl http://localhost:3001/api/system-stats # Test API
curl http://localhost:3001/api/health       # Health check

# Troubleshooting
sudo lsof -i :3001                          # Check port
whoami                                      # Check username
node --version                              # Check Node.js
```

Sretno praćenje! 📊🚀
