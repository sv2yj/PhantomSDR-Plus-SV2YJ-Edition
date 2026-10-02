# Οδηγός εγκατάστασης του System Stats

Ένας ολοκληρωμένος οδηγός για την προσθήκη παρακολούθησης διακομιστή σε πραγματικό χρόνο στην εφαρμογή σας PhantomSDR χρησιμοποιώντας το αυτοματοποιημένο σενάριο εγκατάστασης.

## Επισκόπηση

Αυτή η λειτουργία προσθέτει ένα κουμπί **📊 Stats** στη διεπαφή σας PhantomSDR που εμφανίζει πληροφορίες συστήματος σε πραγματικό χρόνο:
- Χρήση CPU, πυρήνες, συχνότητα, θερμοκρασία και κορυφαίες διεργασίες
- Χρήση μνήμης (χρησιμοποιούμενη/συνολική/ποσοστό)

Τα στατιστικά ενημερώνονται αυτόματα κάθε 5 δευτερόλεπτα όσο το παράθυρο διαλόγου είναι ανοιχτό.

> **Δεν είναι το ίδιο με τη σελίδα «Γραφήματα» του πίνακα διαχείρισης.** Αυτό το παράθυρο δείχνει στιγμιότυπο που ανανεώνεται όσο είναι ανοιχτό και δεν κρατά ιστορικό. Ο πίνακας διαχείρισης έχει ξεχωριστή σελίδα **Γραφήματα** που δειγματοληπτεί συχνότητα CPU, φόρτο, θερμοκρασία και συνδεδεμένους χρήστες κάθε 2 δευτερόλεπτα και τα σχεδιάζει για τα τελευταία 15 λεπτά έως 24 ώρες — δείτε τον [οδηγό του πίνακα διαχείρισης](../el/ADMIN_PANEL_SETUP.md).

---

## Προαπαιτούμενα

- **Διακομιστής Linux** (συνιστάται Ubuntu/Debian)
- **Σύνδεση στο διαδίκτυο** (για τη λήψη του Node.js και των πακέτων)
- **Πρόσβαση Sudo** (για τη ρύθμιση της υπηρεσίας systemd)
- **PhantomSDR-Plus** ήδη εγκατεστημένο και σε λειτουργία
- **lm-sensors** (συνιστάται για τη θερμοκρασία CPU Intel/AMD - εγκαθίσταται αυτόματα από το σενάριο)

---

## Μέθοδοι εγκατάστασης

> [!NOTE]
> **Το κύριο πρόγραμμα εγκατάστασης το προσφέρει ήδη.** Το `./install.sh` — και τα τέσσερα scripts των διανομών — τρέχουν το `install-stats-server.sh` από προεπιλογή στο πλαίσιο της κανονικής εγκατάστασης, οπότε σε ένα φρέσκο μηχάνημα ο stats server είναι συνήθως ήδη στη θέση του. Χρησιμοποιήστε αυτή τη σελίδα για να τον εγκαταστήσετε ξεχωριστά, ή για να αλλάξετε αργότερα θύρα, διεύθυνση ή υπηρεσία.

### Επιλογή 1: Αυτοματοποιημένη εγκατάσταση (Συνιστάται) ⭐

Το αυτοματοποιημένο σενάριο τα φροντίζει όλα για εσάς.

#### Βήμα 1: Εκτελέστε το σενάριο

```bash
cd ~/PhantomSDR-Plus
chmod +x install-stats-server.sh   # only if it is not already executable
./install-stats-server.sh
```

**ΣΗΜΑΝΤΙΚΟ:** ΜΗΝ το εκτελέσετε ως root ή με sudo. Εκτελέστε το ως ο κανονικός σας χρήστης.

#### Βήμα 2: Ακολουθήστε τις διαδραστικές προτροπές

Το σενάριο θα σας καθοδηγήσει μέσα από:

##### 1. **Εγκατάσταση Node.js** (αν χρειάζεται)
```
⚠ Node.js / npm is not installed
Would you like to install Node.js 22 via nvm now? (y/n): y
```
Το σενάριο εγκαθιστά το Node.js 22 μέσω nvm, σε οποιαδήποτε διανομή Linux — χωρίς root και χωρίς πηγή apt. Κάνει την ίδια ερώτηση όταν το Node.js υπάρχει αλλά είναι παλαιότερο από 22.

##### 2. **Κατάλογος εγκατάστασης**
```
Installation directory [/home/user/sdr-stats-server]: 
```
Πατήστε Enter για την προεπιλογή ή καθορίστε μια προσαρμοσμένη διαδρομή.

##### 3. **Διαμόρφωση θύρας** (Βελτιωμένη!)
```
Port Configuration:
  Default port: 3001
  Common alternatives: 8080, 5000, 8888
Enter port number [3001]: 
```

Το σενάριο επικυρώνει τη θύρα σας:
- ✅ Ελέγχει αν είναι έγκυρος αριθμός
- ✅ Προειδοποιεί αν η θύρα < 1024 (απαιτεί δικαιώματα root)
- ✅ Επικυρώνει το εύρος (1-65535)
- ✅ Ελέγχει αν η θύρα χρησιμοποιείται ήδη
- ✅ Δείχνει ποια διεργασία τη χρησιμοποιεί αν είναι κατειλημμένη
- ✅ Σας επιτρέπει να επιλέξετε διαφορετική θύρα

**Παραδείγματα σεναρίων:**

**Χρήση προεπιλεγμένης θύρας:**
```
Enter port number [3001]: ↵
✓ Port 3001 selected
```

**Επιλογή προσαρμοσμένης θύρας:**
```
Enter port number [3001]: 8080
✓ Port 8080 selected
```

**Θύρα ήδη σε χρήση:**
```
Enter port number [3001]: 3001
⚠ Port 3001 is currently in use
Process using port 3001:
node    12345 user   20u  IPv6 123456  TCP *:3001 (LISTEN)
Choose a different port? (y/n): y
Enter port number [3001]: 3002
✓ Port 3002 selected
```

**Μη έγκυρη θύρα:**
```
Enter port number [3001]: abc
✗ Port must be a number
Enter port number [3001]: 99999
✗ Port must be between 1 and 65535
Enter port number [3001]: 3001
✓ Port 3001 selected
```

##### 4. **Διεύθυνση διακομιστή**
```
What is your server's public address?
Examples: Your_site_IP, 192.168.1.100, localhost
Server address: Your_site_IP
```
Εισαγάγετε τον δημόσιο τομέα ή τη διεύθυνση IP του διακομιστή σας.

##### 5. **Επιβεβαίωση**
```
Please confirm your settings:
  Installation directory: /home/user/sdr-stats-server
  Port: 3001
  Server address: Your_site_IP
  Stats URL will be: http://Your_site_IP:3001
Continue with these settings? (y/n): y
```

##### 6. **Ρύθμιση υπηρεσίας Systemd** (Προαιρετικό)
```
Would you like to set up the server as a system service (auto-start on boot)? (y/n): y
```

Συνιστάται: Επιλέξτε **y** για να ξεκινά ο διακομιστής αυτόματα κατά την εκκίνηση.

#### Βήμα 3: Η εγκατάσταση ολοκληρώθηκε! ✓

Το σενάριο θα εμφανίσει μια σύνοψη:
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

## Διαμορφώστε την εφαρμογή σας PhantomSDR

Αφού ολοκληρωθεί το σενάριο, πρέπει να ενημερώσετε την εφαρμογή σας Svelte.

### Βήμα 1: Ενημερώστε το `site_information.json`

Δεδομένου ότι το `site_information.json` έχει ήδη επεξεργαστεί κατά την αρχική ρύθμιση, χρειάζεται μόνο να προσθέσετε τη νέα γραμμή `siteStats` με τη θύρα σας:

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
  "siteStats": "http://Your_site_IP:3001",  ← ΠΡΟΣΘΕΣΤΕ ΑΥΤΗ ΤΗ ΓΡΑΜΜΗ (χρησιμοποιήστε τη θύρα σας)
  "siteSDRBaseFrequency": 0,
  "siteSDRBandwidth": 30000000,
  "siteRegion": 1,
  "siteChatEnabled": true
}
```

**Σημείωση:** Χρησιμοποιήστε τη θύρα που επιλέξατε κατά την εγκατάσταση!

### Βήμα 2: Ενημερώστε το `App.svelte` (η τελευταία έκδοση του GitHub περιλαμβάνει ήδη το ενημερωμένο αρχείο)

Κάντε αυτές τις **4 αλλαγές** στο αρχείο σας App.svelte:

#### Αλλαγή 1: Βεβαιωθείτε ότι το `siteStats` δηλώνεται (γύρω από τη γραμμή 50)

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
  siteStats,  // ← ΠΡΟΣΘΕΣΤΕ ΑΥΤΗ ΤΗ ΓΡΑΜΜΗ
  siteSDRBaseFrequency,
  siteSDRBandwidth,
  siteRegion,
  siteChatEnabled,
} from "../site_information.json";
```

#### Αλλαγή 2: Ενημερώστε το αντικείμενο systemStats (γύρω από τη γραμμή 530)

```javascript
let systemStats = {
  cpu: { usage: 0, cores: 0, temperature: null, frequency: null, topProcesses: [] },  // ← ΠΡΟΣΘΕΣΤΕ topProcesses: []
  memory: { used: 0, total: 0, percent: 0 }
};
```

#### Αλλαγή 3: Ενημερώστε το URL fetch (γύρω από τη γραμμή 541)

```javascript
async function fetchSystemStats() {
  try {
    const response = await fetch(`${siteStats}/api/system-stats`);  // ← ΑΛΛΑΞΤΕ ΑΥΤΗ ΤΗ ΓΡΑΜΜΗ
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

#### Αλλαγή 4: Προσθέστε την εμφάνιση κορυφαίων διεργασιών (στην ενότητα CPU, γύρω από τη γραμμή 3838)

Προσθέστε αυτόν τον κώδικα μετά την ενότητα θερμοκρασίας:

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

<!-- ΠΡΟΣΘΕΣΤΕ ΟΛΟΚΛΗΡΗ ΑΥΤΗ ΤΗΝ ΕΝΟΤΗΤΑ: -->
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

### Βήμα 3: Επαναμεταγλωττίστε την εφαρμογή σας

```bash
cd /path/to/your/phantomsdr-app
npm ./recompile.sh
```

---

## Δοκιμή της εγκατάστασης

### Δοκιμή 1: Έλεγχος του σημείου πρόσβασης API

```bash
curl http://localhost:3001/api/system-stats
```

Αναμενόμενη έξοδος (JSON):
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

### Δοκιμή 2: Έλεγχος κατάστασης υπηρεσίας

Αν το εγκαταστήσατε ως υπηρεσία:

```bash
sudo systemctl status sdr-stats.service
```

Θα πρέπει να εμφανίσει: `Active: active (running)`

### Δοκιμή 3: Δοκιμή στο πρόγραμμα περιήγησης

1. Ανοίξτε τη διαδικτυακή διεπαφή σας PhantomSDR
2. Μετακινηθείτε στην ενότητα **Additional Info**
3. Κάντε κλικ στο κουμπί **Open Additional Info**
4. Αναζητήστε το κουμπί **📊 Stats** δίπλα στις πληροφορίες PC
5. Κάντε κλικ πάνω του για να ανοίξετε το παράθυρο διαλόγου στατιστικών
6. Επαληθεύστε ότι τα στατιστικά εμφανίζονται και ενημερώνονται

---

## Διαχείριση υπηρεσίας

Αν το εγκαταστήσατε ως υπηρεσία systemd, χρησιμοποιήστε αυτές τις εντολές:

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

## Χειροκίνητη εγκατάσταση (Επιλογή 2)


> [!IMPORTANT]
> **Δεν χρειάζεστε αυτή την ενότητα για μια κανονική εγκατάσταση.** Το `install-stats-server.sh` τα κάνει όλα αυτά για εσάς και το τρέχει το κύριο πρόγραμμα εγκατάστασης από προεπιλογή. Ακολουθήστε την μόνο για χειροκίνητη εγκατάσταση ή για να επισκευάσετε κάτι με το χέρι.

**⚠️ Προειδοποίηση:** Η χειροκίνητη εγκατάσταση μπορεί να χρησιμοποιήσει παρωχημένα αρχεία. Το **αυτοματοποιημένο σενάριο συνιστάται ανεπιφύλακτα** καθώς:
- Εγκαθιστά την τελευταία έκδοση με βελτιωμένη ανίχνευση θερμοκρασίας
- Εγκαθιστά και διαμορφώνει αυτόματα το lm-sensors
- Διαχειρίζεται αυτόματα όλες τις εξαρτήσεις

Αν εξακολουθείτε να προτιμάτε τη χειροκίνητη εγκατάσταση:

### 1. Εγκαταστήστε το Node.js
```bash
# Any distribution - nvm needs no root and no apt source.
# NOT NodeSource: deb.nodesource.com now answers HTTP 403 on every path.
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.4/install.sh | bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm install 22 && nvm use 22 && nvm alias default 22
```

### 2. Εγκαταστήστε το lm-sensors (Απαιτείται για τη θερμοκρασία Intel/AMD)
```bash
sudo apt-get update
sudo apt-get install -y lm-sensors
sudo sensors-detect --auto
```

### 3. Δημιουργήστε τον κατάλογο
```bash
mkdir ~/sdr-stats-server
cd ~/sdr-stats-server
```

### 4. Λήψη των τελευταίων αρχείων

**Σημαντικό:** τα αρχεία του διακομιστή δεν φυλάσσονται πλέον ως αντίγραφα στο αποθετήριο - τα δημιουργεί το σενάριο εγκατάστασης.

Αντ' αυτού, εκτελέστε το αυτοματοποιημένο σενάριο μία φορά για να δημιουργήσετε τα τελευταία αρχεία και, στη συνέχεια, αντιγράψτε τα:
```bash
# Run the automated script from the repository root
cd ~/PhantomSDR-Plus
./install-stats-server.sh
# When prompted, use a temporary port like 9999
# After installation completes, copy the generated files
cp ~/sdr-stats-server/system-stats-server.js ~/your-manual-install-dir/
cp ~/sdr-stats-server/package.json ~/your-manual-install-dir/
```

**Ή** δημιουργήστε χειροκίνητα τα αρχεία χρησιμοποιώντας τον πιο πρόσφατο κώδικα από το σενάριο εγκατάστασης.

### 5. Επεξεργαστείτε τη θύρα (αν χρειάζεται)
```bash
nano ~/sdr-stats-server/system-stats-server.js
```

Αλλάξτε τη γραμμή 6:
```javascript
const PORT = process.env.PORT || 3001;  // Change this number
```

### 6. Εγκαταστήστε τις εξαρτήσεις
```bash
npm install
```

### 7. Δοκιμαστική εκτέλεση
```bash
npm start
```

### 8. Ρύθμιση υπηρεσίας (Προαιρετικό)

Ακολουθήστε τη ρύθμιση υπηρεσίας systemd από την ενότητα αυτοματοποιημένης εγκατάστασης.

## Αλλαγή της θύρας μετά την εγκατάσταση

Αν χρειαστεί να αλλάξετε τη θύρα μετά την εγκατάσταση:

### Βήμα 1: Επεξεργαστείτε το αρχείο του διακομιστή

```bash
nano ~/sdr-stats-server/system-stats-server.js
```

Αλλάξτε τη γραμμή 6:
```javascript
const PORT = process.env.PORT || 3001;  // Change this number
```

### Βήμα 2: Ενημερώστε το site_information.json

```json
"siteStats": "http://Your_site_IP:NEW_PORT"
```

### Βήμα 3: Επανεκκινήστε την υπηρεσία

```bash
sudo systemctl restart sdr-stats.service
```

### Βήμα 4: Επαναδημιουργήστε την εφαρμογή σας Svelte

```bash
cd /path/to/phantomsdr-app
npm run build
```

---

## Αντιμετώπιση προβλημάτων

### Πρόβλημα: Η θύρα χρησιμοποιείται ήδη

**Σφάλμα:**
```
Error: listen EADDRINUSE: address already in use :::3001
```

**Λύση:**

1. Βρείτε τι χρησιμοποιεί τη θύρα:
```bash
sudo lsof -i :3001
```

2. Σταματήστε αυτήν τη διεργασία:
```bash
kill <PID>
# or
sudo systemctl stop sdr-stats.service
```

3. Ξεκινήστε ξανά την υπηρεσία:
```bash
sudo systemctl start sdr-stats.service
```

**Εναλλακτική:** Εκτελέστε ξανά το σενάριο εγκατάστασης και επιλέξτε διαφορετική θύρα όταν σας ζητηθεί.

### Πρόβλημα: Η υπηρεσία δεν ξεκινά

**Σφάλμα:**
```
status=217/USER
```

**Λύση:**

1. Ελέγξτε το αρχείο υπηρεσίας:
```bash
cat /etc/systemd/system/sdr-stats.service
```

2. Επαληθεύστε ότι η γραμμή `User=` ταιριάζει με το όνομα χρήστη σας:
```bash
whoami
```

3. Επεξεργαστείτε αν χρειάζεται:
```bash
sudo nano /etc/systemd/system/sdr-stats.service
```

4. Επαναφορτώστε και επανεκκινήστε:
```bash
sudo systemctl daemon-reload
sudo systemctl restart sdr-stats.service
```

### Πρόβλημα: Τα στατιστικά δεν εμφανίζονται στο πρόγραμμα περιήγησης

**Συμπτώματα:** Το παράθυρο διαλόγου ανοίγει αλλά χωρίς δεδομένα, ή εμφανίζει τιμές 0

**Λύσεις:**

1. Ελέγξτε την κονσόλα του προγράμματος περιήγησης (F12) για σφάλματα
2. Επαληθεύστε ότι το API είναι προσβάσιμο:
```bash
curl http://localhost:3001/api/system-stats
```
3. Ελέγξτε ότι η υπηρεσία εκτελείται:
```bash
sudo systemctl status sdr-stats.service
```
4. Επαληθεύστε ότι το `siteStats` στο `site_information.json` ταιριάζει με τη διεύθυνση και τη θύρα του διακομιστή σας
5. Ελέγξτε για σφάλματα CORS - βεβαιωθείτε ότι ο διακομιστής επιτρέπει τον τομέα σας

### Πρόβλημα: Η θερμοκρασία εμφανίζει null

**Αιτία:** Η ανάγνωση θερμοκρασίας δεν είναι διαθέσιμη στο σύστημά σας

**Λύσεις:**

1. **Για τα περισσότερα συστήματα Linux:** Ελέγξτε αν υπάρχει η θερμική ζώνη:
```bash
cat /sys/class/thermal/thermal_zone0/temp
```

2. **Εγκαταστήστε το lm-sensors:**
```bash
sudo apt-get install lm-sensors
sudo sensors-detect
sensors
```

3. **Σημείωση:** Η θερμοκρασία μπορεί να μην είναι διαθέσιμη σε:
- Εικονικές μηχανές
- Ορισμένους παρόχους VPS
- Windows Subsystem for Linux (WSL)
- Μη Linux συστήματα

Αυτό είναι φυσιολογικό - τα υπόλοιπα στατιστικά θα εξακολουθούν να λειτουργούν!

### Πρόβλημα: Οι τιμές των στατιστικών δεν ταιριάζουν με το `top`

**Αιτία:** Η περίοδος δειγματοληψίας CPU ήταν πολύ σύντομη σε παλαιότερες εκδόσεις

**Λύση:** Η τρέχουσα έκδοση χρησιμοποιεί δειγματοληψία 1 δευτερολέπτου για ακριβείς μετρήσεις. Αν έχετε μια παλιά εγκατάσταση:

1. Ενημερώστε το αρχείο του διακομιστή:
```bash
nano ~/sdr-stats-server/system-stats-server.js
```

2. Βρείτε τη γραμμή 18 και αλλάξτε:
```javascript
}, 100);  // Old value
```
σε:
```javascript
}, 1000);  // New value (1 second)
```

3. Επανεκκινήστε:
```bash
sudo systemctl restart sdr-stats.service
```

Ή απλώς εκτελέστε ξανά το σενάριο εγκατάστασης για να λάβετε την τελευταία έκδοση.

### Πρόβλημα: Το Node.js δεν βρέθηκε

**Σφάλμα:**
```
node: command not found
```

**Λύση:**

1. Εγκαταστήστε το Node.js:
```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.4/install.sh | bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm install 22 && nvm use 22 && nvm alias default 22
```

2. Επαληθεύστε:
```bash
node --version
npm --version
```

---

## Τι θα δείτε

Μόλις εγκατασταθεί και διαμορφωθεί, το παράθυρο διαλόγου στατιστικών εμφανίζει:

### 🖥️ Ενότητα CPU
- **Χρήση**: Συνολικό ποσοστό αξιοποίησης CPU
- **Πυρήνες**: Πόση CPU χρησιμοποιείται πραγματικά, εκφρασμένη σε ολόκληρους πυρήνες — π.χ. `1.3 / 12 in use` σημαίνει ότι το μηχάνημα κάνει δουλειά 1,3 πυρήνων. Είναι ακριβές μέγεθος και δεν χρειάζεται κατώφλι. Σκόπιμα δεν είναι καταμέτρηση απασχολημένων πυρήνων: ο χρονοπρογραμματιστής απλώνει τη δουλειά ενός πυρήνα σε πολλούς, οπότε μια τέτοια καταμέτρηση θα προσέγγιζε απλώς αυτόν τον αριθμό.
- **Συχνότητα**: Μέση τρέχουσα συχνότητα CPU σε όλους τους πυρήνες σε GHz, με τον ταχύτερο πυρήνα σε παρένθεση (αν είναι διαθέσιμη)
- **Θερμοκρασία**: Θερμοκρασία CPU σε Κελσίου (αν είναι διαθέσιμη), με χρωματική κωδικοποίηση: 🟢 πράσινο έως 69 °C, 🟠 πορτοκαλί 70-79 °C, 🔴 κόκκινο από 80 °C και πάνω
- **Κορυφαίες διεργασίες**: Οι 5 διεργασίες με τη μεγαλύτερη κατανάλωση CPU με ποσοστά κωδικοποιημένα με χρώματα:
  - 🟢 Πράσινο: έως 50 % CPU
  - 🟠 Πορτοκαλί: 51-80 % CPU
  - 🔴 Κόκκινο: πάνω από 80 % CPU

### 💾 Ενότητα μνήμης
- **Χρησιμοποιούμενη**: Μνήμη σε χρήση (GB)
- **Συνολική**: Συνολική μνήμη συστήματος (GB)
- **Χρήση**: Ποσοστό χρήσης μνήμης (κωδικοποιημένο με χρώματα)

### ♻️ Αυτόματη ενημέρωση
- Τα στατιστικά ανανεώνονται κάθε **5 δευτερόλεπτα** όσο το παράθυρο διαλόγου είναι ανοιχτό
- Σταματούν να ενημερώνονται όταν κλείνετε το παράθυρο διαλόγου (εξοικονομεί πόρους)

---


## Ανίχνευση θερμοκρασίας

Ο διακομιστής στατιστικών χρησιμοποιεί προηγμένη ανίχνευση θερμοκρασίας πολλαπλών μεθόδων:

### ✅ **Υποστηριζόμενα συστήματα:**
- **Επεξεργαστές Intel**: Διαβάζει από αισθητήρες coretemp μέσω lm-sensors
- **Επεξεργαστές AMD**: Διαβάζει από αισθητήρες k10temp (Tdie/Tctl)
- **Επεξεργαστές ARM**: Διαβάζει από θερμικές ζώνες (Raspberry Pi, κ.λπ.)

### 📋 **Απαιτήσεις:**
- **Intel/AMD**: Απαιτεί το πακέτο `lm-sensors` (εγκαθίσταται αυτόματα από το σενάριο)
- **ARM/Raspberry Pi**: Λειτουργεί άμεσα, δεν χρειάζονται επιπλέον πακέτα

### 🔧 **Προτεραιότητα εγκατάστασης:**
1. Δοκιμάζει την εντολή `sensors` για τη θερμοκρασία Package/Core (Intel/AMD)
2. Επιστρέφει στην άμεση ανάγνωση coretemp (Intel)
3. Επιστρέφει στο thermal_zone0 (ARM/Raspberry Pi)

Αν η θερμοκρασία εμφανίζει `null`, εγκαταστήστε το lm-sensors:
```bash
sudo apt-get install lm-sensors
sudo sensors-detect --auto
sudo systemctl restart sdr-stats.service
```

---

## Σύνοψη χαρακτηριστικών

✅ **Παρακολούθηση σε πραγματικό χρόνο** - Ζωντανά στατιστικά συστήματος από τον διακομιστή σας
✅ **Μετρήσεις CPU** - Χρήση, πυρήνες, θερμοκρασία, κορυφαίες διεργασίες
✅ **Παρακολούθηση μνήμης** - Χρησιμοποιούμενη, συνολική και ποσοστό
✅ **Αυτόματες ενημερώσεις** - Ανανεώνεται κάθε 5 δευτερόλεπτα
✅ **Κωδικοποιημένο με χρώματα** - Οπτικές ενδείξεις για προειδοποιήσεις
✅ **Ελαφρύ** - Ελάχιστη χρήση πόρων
✅ **Εύκολη εγκατάσταση** - Το αυτοματοποιημένο σενάριο τα φροντίζει όλα
✅ **Επικύρωση θύρας** - Έξυπνη επιλογή θύρας με ανίχνευση διενέξεων
✅ **Διαχείριση υπηρεσίας** - Αυτόματη εκκίνηση κατά την εκκίνηση

---

## Σημειώσεις ασφαλείας

- Ο διακομιστής στατιστικών δέχεται συνδέσεις από οποιαδήποτε προέλευση (CORS: *)
- Για παραγωγικό περιβάλλον, εξετάστε τον περιορισμό του CORS μόνο στον τομέα σας
- Η επιλογή θύρας επικυρώνει την είσοδο και ελέγχει για διενέξεις
- Η ανάγνωση της θερμοκρασίας CPU είναι μόνο για ανάγνωση και ασφαλής
- Δεν εκτίθενται ευαίσθητες πληροφορίες συστήματος

---

## Υποστήριξη και πόροι

### Περιλαμβανόμενα αρχεία:
Σε αυτόν τον φάκελο (το ίδιο το σενάριο εγκατάστασης βρίσκεται στη ρίζα, ως `PhantomSDR-Plus/install-stats-server.sh` - υπάρχει πάντα ένα μόνο αντίγραφο):
- `package.json` - Εξαρτήσεις, ίδιες με αυτές που γράφει το σενάριο
- Αυτό το έγγραφο, διαθέσιμο επίσης σε de, el, es, fr, hr και ru

Δημιουργούνται από το σενάριο στο `~/sdr-stats-server/`:
- `system-stats-server.js` - Διακομιστής backend, με τη θύρα που επιλέξατε
- `package.json` - Εξαρτήσεις
- `node_modules/` - εγκαθίστανται από το `npm install`

### Λήψη βοήθειας:
- Ελέγξτε την ενότητα αντιμετώπισης προβλημάτων παραπάνω
- Εξετάστε τα αρχεία καταγραφής της υπηρεσίας: `sudo journalctl -u sdr-stats.service -n 50`
- Δοκιμάστε το API χειροκίνητα: `curl http://localhost:3001/api/system-stats`
- Επαληθεύστε τα αρχεία διαμόρφωσης

### Απεγκατάσταση του διακομιστή στατιστικών:
- Διαγράψτε τον φάκελο /sdr-stats-server
- Αν έχετε δημιουργήσει μια υπηρεσία, απλώς διαγράψτε την χρησιμοποιώντας:
```bash
sudo rm /etc/systemd/system/sdr-stats.service"`
```
- Τροποποιήστε το `App.svelte`: Βρείτε το τμήμα του κώδικα:
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
  και αντικαταστήστε με:
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
- Επαναμεταγλωττίστε χρησιμοποιώντας την εντολή:
```bash
  cd PhantomSDR-Plus
 ./recompile.sh
 ```
- Επανεκκινήστε τον υπολογιστή και ξεκινήστε τον διακομιστή

---

**Συγγραφέας:** Δημιουργήθηκε για το PhantomSDR-Plus
**Έκδοση:** 1.1 (Βελτιωμένη ανίχνευση θερμοκρασίας CPU για Intel/AMD) **Ενημερώθηκε:** Ιανουάριος 2026
**Άδεια:** MIT

---

## Γρήγορη αναφορά εντολών

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

Καλή παρακολούθηση! 📊🚀
