# Οδηγός εγκατάστασης PhantomSDR-Plus για διαχειριστές συστήματος

Αυτός ο πλήρης οδηγός θα σας καθοδηγήσει στην εγκατάσταση και ρύθμιση του PhantomSDR-Plus στον διακομιστή σας.

---

## Πίνακας περιεχομένων

1. [Απαιτήσεις συστήματος](#απαιτήσεις-συστήματος)
2. [Προετοιμασία πριν την εγκατάσταση](#προετοιμασία-πριν-την-εγκατάσταση)
3. [Εγκατάσταση του PhantomSDR-Plus](#εγκατάσταση-του-phantomsdr-plus) — το script και [τι κάνει](#τι-κάνει-το-πρόγραμμα-εγκατάστασης)
4. [Autorun Spot Reporter (FT8/FT4/WSPR)](#autorun-spot-reporter-ft8ft4wspr)
5. [Εξομοίωση πελατών KiwiSDR (προαιρετικό)](#εξομοίωση-πελατών-kiwisdr-προαιρετικό)
6. [Ρυθμίσεις](#ρυθμίσεις)
7. [Ρύθμιση ανά συσκευή SDR](#ρύθμιση-ανά-συσκευή-sdr)
8. [Δοκιμή και επαλήθευση](#δοκιμή-και-επαλήθευση)
9. [Ρύθμιση αυτόματης εκκίνησης](#ρύθμιση-αυτόματης-εκκίνησης)
10. [Θερμική προστασία CPU](#θερμική-προστασία-cpu)
11. [Αντιμετώπιση προβλημάτων](#αντιμετώπιση-προβλημάτων)

**Μόνο για αναφορά — το πρόγραμμα εγκατάστασης τα κάνει ήδη όλα αυτά για εσάς.**
Διαβάστε αυτές τις ενότητες αν βρίσκεστε σε διανομή που δεν καλύπτει κανένα από τα scripts, ή αν χρειάζεται να επισκευάσετε ένα βήμα με το χέρι:

- [Εγκατάσταση εξαρτήσεων](#εγκατάσταση-εξαρτήσεων)
- [Εγκατάσταση Node.js και npm](#εγκατάσταση-nodejs-και-npm)
- [Εγκατάσταση OpenCL](#εγκατάσταση-opencl-προαιρετικό-αλλά-συνιστώμενο)
- [Χειροκίνητο build](#χειροκίνητο-build-αναφορά)
- [Εγκατάσταση του κωδικοποιητή ήχου Opus](#εγκατάσταση-του-κωδικοποιητή-ήχου-opus)
---

## Απαιτήσεις συστήματος

### Υποστηριζόμενα λειτουργικά συστήματα

**Κύριο (συνιστώμενο):**
- Ubuntu 22.04 LTS (Jammy), 24.04 LTS (Noble) και 26.04 LTS (Resolute) — συνιστάται η 24.04
- Debian 12 (Bookworm) και Debian 13 (Trixie)

**Εναλλακτικό:**
- Fedora (τελευταία σταθερή έκδοση)
- Arch Linux (κυλιόμενη έκδοση)
- openSUSE Tumbleweed (όχι Leap — δείτε τη σημείωση παρακάτω)

### Απαιτήσεις υλικού

**Ελάχιστη διαμόρφωση:**
- CPU: επεξεργαστής διπλού πυρήνα (2+ GHz)
- RAM: 4 GB
- Αποθηκευτικός χώρος: 10 GB ελεύθερα
- Δίκτυο: σύνδεση 100 Mbps

**Συνιστώμενη διαμόρφωση:**
- CPU: τετραπύρηνος ή καλύτερος (Ryzen 5 2600, Intel i5-6500T ή καλύτερος)
- RAM: 8 GB ή περισσότερα
- Αποθηκευτικός χώρος: SSD 20 GB και άνω
- GPU: AMD/NVIDIA με υποστήριξη OpenCL (ιδιαίτερα συνιστώμενο)
- Δίκτυο: σύνδεση 1 Gbps

**Διαμόρφωση υψηλών επιδόσεων:**
- CPU: 6+ πυρήνες (Ryzen 7, Intel i7 ή καλύτερος)
- RAM: 16 GB ή περισσότερα
- Αποθηκευτικός χώρος: NVMe SSD
- GPU: αποκλειστική GPU με υποστήριξη OpenCL/CUDA
- Δίκτυο: 1 Gbps ή καλύτερο

---

## Προετοιμασία πριν την εγκατάσταση

### 1. Ενημερώστε το σύστημά σας

```bash
# Ubuntu/Debian
sudo apt update
sudo apt upgrade -y
sudo reboot

# Fedora
sudo dnf update -y
sudo reboot
```

### 2. Επαληθεύστε την έκδοση του Ubuntu

```bash
lsb_release -a
```

**Η αναμενόμενη έξοδος πρέπει να δείχνει:** Ubuntu 24.04 LTS

### 3. Ελέγξτε τον διαθέσιμο χώρο στον δίσκο

```bash
df -h
```

Βεβαιωθείτε ότι έχετε τουλάχιστον 10 GB ελεύθερα στον προσωπικό σας κατάλογο.

### 4. Ελέγξτε τις πληροφορίες της CPU

```bash
lscpu
```

Σημειώστε τον αριθμό των πυρήνων/νημάτων για τη βελτιστοποίηση των ρυθμίσεων.

---

## Εγκατάσταση εξαρτήσεων

> [!IMPORTANT]
> **Δεν χρειάζεστε αυτή την ενότητα για μια κανονική εγκατάσταση.** Το `./install.sh` — ή το script της διανομής σας — τα κάνει όλα αυτά για εσάς· δείτε [Τι κάνει το πρόγραμμα εγκατάστασης](#τι-κάνει-το-πρόγραμμα-εγκατάστασης). Όσα ακολουθούν είναι αναφορά για χειροκίνητη εγκατάσταση, για διανομή που δεν καλύπτει κανένα script, ή για την επισκευή ενός βήματος με το χέρι.


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

### Επαληθεύστε την εγκατάσταση

```bash
# Check if key dependencies are installed
pkg-config --modversion fftw3
cmake --version
meson --version
```

---

## Εγκατάσταση Node.js και npm

> [!IMPORTANT]
> **Δεν χρειάζεστε αυτή την ενότητα για μια κανονική εγκατάσταση.** Το `./install.sh` — ή το script της διανομής σας — τα κάνει όλα αυτά για εσάς· δείτε [Τι κάνει το πρόγραμμα εγκατάστασης](#τι-κάνει-το-πρόγραμμα-εγκατάστασης). Όσα ακολουθούν είναι αναφορά για χειροκίνητη εγκατάσταση, για διανομή που δεν καλύπτει κανένα script, ή για την επισκευή ενός βήματος με το χέρι.


Το PhantomSDR-Plus απαιτεί Node.js για τη μεταγλώττιση του frontend. Θα χρησιμοποιήσουμε το NVM (Node Version Manager) για την εγκατάσταση.

### 1. Εγκαταστήστε το NVM

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.4/install.sh | bash
```

### 2. Φορτώστε το NVM

**ΣΗΜΑΝΤΙΚΟ:** κλείστε και ανοίξτε ξανά το τερματικό σας ή εκτελέστε:

```bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
```

### 3. Επαληθεύστε την εγκατάσταση του NVM

```bash
nvm --version
```

Αναμενόμενη έξοδος: `0.40.4` ή παρόμοια

### 4. Εγκαταστήστε το Node.js

```bash
# Install Node.js 22 - the version every install script requires
nvm install 22

# Make it the default, so systemd units and cron see it too
nvm alias default 22

# Verify installation
node --version
npm --version
```

### 5. Προαιρετικά: εγκαταστήστε επιπλέον εκδόσεις του Node

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

## Εγκατάσταση OpenCL (προαιρετικό αλλά συνιστώμενο)

> [!IMPORTANT]
> **Δεν χρειάζεστε αυτή την ενότητα για μια κανονική εγκατάσταση.** Το `./install.sh` — ή το script της διανομής σας — τα κάνει όλα αυτά για εσάς· δείτε [Τι κάνει το πρόγραμμα εγκατάστασης](#τι-κάνει-το-πρόγραμμα-εγκατάστασης). Όσα ακολουθούν είναι αναφορά για χειροκίνητη εγκατάσταση, για διανομή που δεν καλύπτει κανένα script, ή για την επισκευή ενός βήματος με το χέρι.


Το OpenCL βελτιώνει δραματικά τις επιδόσεις μεταφέροντας τους υπολογισμούς FFT στην GPU. Η ενότητα αυτή καλύπτει τα ενσωματωμένα γραφικά Intel. Για GPU AMD/NVIDIA ανατρέξτε στην τεκμηρίωση του κατασκευαστή.

### CPU Intel με ενσωματωμένα γραφικά

#### 1. Εγκαταστήστε τα βασικά στοιχεία OpenCL

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

#### 2. Κατεβάστε το Intel Compute Runtime

```bash
mkdir -p ~/neo
cd ~/neo

wget https://github.com/intel/compute-runtime/releases/download/19.07.12410/intel-gmmlib_18.4.1_amd64.deb
wget https://github.com/intel/compute-runtime/releases/download/19.07.12410/intel-igc-core_18.50.1270_amd64.deb
wget https://github.com/intel/compute-runtime/releases/download/19.07.12410/intel-igc-opencl_18.50.1270_amd64.deb
wget https://github.com/intel/compute-runtime/releases/download/19.07.12410/intel-opencl_19.07.12410_amd64.deb
wget https://github.com/intel/compute-runtime/releases/download/19.07.12410/intel-ocloc_19.07.12410_amd64.deb
```

#### 3. Εγκαταστήστε το Intel OpenCL Runtime

```bash
sudo dpkg -i *.deb
```

Αν προκύψουν σφάλματα εξαρτήσεων:

```bash
sudo apt --fix-broken install
```

#### 4. Εγκαταστήστε τον φορτωτή OpenCL ICD

```bash
sudo apt update
sudo apt install intel-opencl-icd
```

Αν προκύψουν σφάλματα:

```bash
sudo apt --fix-broken install
sudo apt install intel-opencl-icd
```

#### 5. Επαληθεύστε την εγκατάσταση του OpenCL

```bash
sudo clinfo
```

Θα πρέπει να δείτε πληροφορίες για την πλατφόρμα και τις συσκευές OpenCL. Αναζητήστε:
- Αριθμό πλατφορμών: 1 (ή περισσότερες)
- Όνομα πλατφόρμας: Intel(R) OpenCL (ή παρόμοιο)
- Τύπο συσκευής: GPU ή CPU

#### 6. Επανεκκινήστε

```bash
sudo reboot
```

### OpenCL σε GPU AMD

Για GPU AMD, εγκαταστήστε το ROCm:

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

### OpenCL σε GPU NVIDIA

Για GPU NVIDIA, εγκαταστήστε το CUDA:

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

## Εγκατάσταση του PhantomSDR-Plus

### Κλωνοποίηση, εκτελέσιμα scripts, εκτέλεση του προγράμματος εγκατάστασης

```bash
cd ~
git clone --recursive https://github.com/sv1btl/PhantomSDR-Plus
cd PhantomSDR-Plus
chmod +x *.sh
./install.sh
```

**⚠️ ΣΗΜΑΝΤΙΚΟ:** Μόλις τελειώσει η εγκατάσταση, **επανεκκινήστε το terminal** — τα νεοεγκατεστημένα Node.js και Rust δεν βρίσκονται στο `PATH` σας πριν από αυτό.

> **Τρέχετε ήδη PhantomSDR-Plus;** Μην το εγκαταστήσετε ξανά — ενημερώστε το. Κατεβάστε μία φορά το εργαλείο ενημέρωσης και τρέξτε το· η διαμόρφωσή σας, οι σημάνσεις, ο κωδικός διαχειριστή, η λίστα συχνοτήτων και το ιστορικό συνομιλίας δεν θίγονται ποτέ, και ό,τι έχετε αλλάξει μόνοι σας τίθεται υπόψη σας αντί να αντικατασταθεί:
>
> ```bash
> cd ~/PhantomSDR-Plus
> curl -fLO https://raw.githubusercontent.com/sv1btl/PhantomSDR-Plus/main/update.sh
> chmod +x update.sh
> ./update.sh
> ```
>
> Η τελευταία γραμμή απλώς *αναφέρει* τι θα άλλαζε και δεν γράφει τίποτα· το `./update.sh --apply` το εκτελεί. Λεπτομέρειες στο κεφάλαιο *Ενημέρωση του PhantomSDR-Plus*. Η επανάληψη του εγκαταστάτη σε μια στάση που λειτουργεί χρειάζεται μόνο όταν η ανακατασκευή αποτύχει από πακέτα του συστήματος που λείπουν.

Χρησιμοποιήστε το script που ταιριάζει στο σύστημά σας. Κάνουν την ίδια δουλειά και κάνουν τις ίδιες ερωτήσεις· αλλάζει μόνο ο διαχειριστής πακέτων:

| Σύστημα | Script |
|---|---|
| Ubuntu 22.04 / 24.04 / 26.04, Debian 12 / 13 | `./install.sh` |
| Fedora | `./install_fedora.sh` |
| Arch | `./install_arch.sh` |
| openSUSE Tumbleweed | `./install_opensuse.sh` |

> **Ένα πρόγραμμα εγκατάστασης για κάθε έκδοση Debian και Ubuntu.** Το `install.sh` διαβάζει το `/etc/os-release` και την εγκατεστημένη έκδοση του Boost και προσαρμόζεται μόνο του· τα παλιά `install_ubuntu22.sh`, `install-Deb12.sh` και `install_ubuntu26.sh` καταργήθηκαν. Θέτει `DEBIAN_FRONTEND=noninteractive`, ώστε το `tzdata` που έρχεται μαζί με το `python3-matplotlib` να μην μπορεί να σταματήσει την εκτέλεση ζητώντας τη ζώνη ώρας σας και στη συνέχεια να καταπιεί την απάντηση που προοριζόταν για την επόμενη ερώτηση. Στο Jammy καλεί απευθείας το `install_rade_ubuntu22.sh`, επειδή το `python3-websockets` του Jammy είναι 10.1 ενώ το RADE χρειάζεται 11.0 ή νεότερο. Γνωρίζει πού βρίσκεται το `intel-opencl-icd` σε κάθε έκδοση: στα αποθετήρια σε 22.04 και 26.04, στο `non-free` στο Debian 12, και στο αποθετήριο γραφικών της Intel σε 24.04 και Debian 13. Και όπου το Boost είναι 1.87 ή νεότερο, το patch των κεφαλίδων websocketpp παύει να είναι προαιρετικό — το πρόγραμμα εγκατάστασης επαληθεύει ότι εφαρμόστηκε και αρνείται να χτίσει χωρίς αυτό. Δεν χρειάζεται ποτέ νεότερος μεταγλωττιστής: ο προεπιλεγμένος GCC δέχεται `-std=c++23` και στις πέντε εκδόσεις, οπότε μην εγκαταστήσετε `gcc-12` γι' αυτό.

Η εγκατάσταση εκτελείται σε 17 σαφώς αριθμημένα βήματα, και κάθε σημείο όπου περιμένει εσάς περιβάλλεται από ένα πλαίσιο **⌨️  ΧΡΕΙΑΖΕΤΑΙ Η ΕΙΣΟΔΟΣ ΣΑΣ**, ώστε μια ερώτηση να μην μπορεί να περάσει απαρατήρητη μέσα στην κύλιση. Οι επτά ερωτήσεις παρατίθενται από την αρχή, πριν εγκατασταθεί οτιδήποτε. Το `PHANTOM_NONINTERACTIVE=1` τις απαντά όλες με τις προεπιλογές τους· δείτε την κεφαλίδα του `install.sh` για τις μεταβλητές `PHANTOM_*`.

**Κάθε εκτέλεση γράφει το `install.txt`.** Όταν το πρόγραμμα εγκατάστασης τελειώσει — ή διακοπεί στη μέση — γράφει μια αναφορά στο `install.txt` μέσα στον φάκελο PhantomSDR-Plus: το αποτέλεσμα, καθένα από τα 17 βήματα ως OK / SKIPPED / PARTIAL / FAILED, ό,τι εντόπισε (διανομή, Boost, μεταγλωττιστή, Node.js), ποια στοιχεία εγκαταστάθηκαν, και κάθε προειδοποίηση που εμφανίστηκε. Μια εκτέλεση που αποτυγχάνει αφήνει αναφορά που σταματά στο βήμα που απέτυχε, με την αιτία και τη σημείωση ότι το πρόγραμμα εγκατάστασης μπορεί να ξανατρέξει με ασφάλεια. Είναι το πρώτο αρχείο που διαβάζετε όταν κάτι δεν δούλεψε, και το πρώτο που επισυνάπτετε σε αναφορά σφάλματος. Κάθε εκτέλεση το αντικαθιστά, οπότε κρατήστε αντίγραφο αν θέλετε να συγκρίνετε δύο εγκαταστάσεις.

> **Τα Ubuntu 26.04, Arch και openSUSE Tumbleweed μεταγλωττίζονται, αλλά δεν έχουν δοκιμαστεί στον αέρα.** Και τα τρία διαθέτουν Boost νεότερο από 1.87, που κατάργησε το API `io_service` για το οποίο γράφτηκε το ενσωματωμένο websocketpp 0.8.2. Οι διορθωμένες κεφαλίδες που αντιγράφει το πρόγραμμα εγκατάστασης γεφυρώνουν αυτό το κενό (`io_context`, `executor_work_guard`, `boost::asio::post`, ο σύγχρονος resolver), και όπου το Boost είναι 1.87 ή νεότερο το πρόγραμμα θεωρεί το patch υποχρεωτικό και όχι προαιρετικό — επαληθεύει ότι εφαρμόστηκε και αρνείται να χτίσει χωρίς αυτό. Μια πλήρης εγκατάσταση, μαζί με τον οδηγό του δέκτη και όλα τα προαιρετικά στοιχεία, έχει επαληθευτεί από άκρη σε άκρη σε containers με Boost 1.90 (Ubuntu 26.04), 1.91 (openSUSE Tumbleweed) και 1.92 (Arch). Αυτό αποδεικνύει ότι ο διακομιστής μεταγλωττίζεται και ξεκινά — όχι ότι εξυπηρετεί δέκτη για ώρες. Θεωρήστε και τα τρία μη δοκιμασμένα σε παραγωγή μέχρι να αναφέρει κάποιος.

> **openSUSE εδώ σημαίνει Tumbleweed.** Εκεί έχει επαληθευτεί το `install_opensuse.sh`. Το Leap 15.6 δεν δουλεύει: τα αποθετήριά του δεν έχουν καθόλου `liquid-dsp-devel`, που το χρειάζεται το backend, ενώ το Boost υπάρχει μόνο με ονόματα πακέτων που φέρουν έκδοση. Η υποστήριξη του Leap θα απαιτούσε προσθήκη εξωτερικών αποθετηρίων OBS, οπότε προς το παρόν μένει εκτός.

### Τι κάνει το πρόγραμμα εγκατάστασης

Τίποτα δεν χρειάζεται να ετοιμαστεί με το χέρι από πριν — καμία λίστα πακέτων για αντιγραφή, κανένα Node.js για κατέβασμα, κανένα κυνήγι πακέτων OpenCL. Εκτελείται σε 19 αριθμημένα βήματα και σταματά για έως δέκα ερωτήσεις, καθεμία μέσα σε πλαίσιο «ΧΡΕΙΑΖΕΤΑΙ Η ΕΙΣΟΔΟΣ ΣΑΣ» — οπότε είτε μείνετε στο πληκτρολόγιο, είτε θέστε `PHANTOM_NONINTERACTIVE=1` και αφήστε το να απαντήσει σε όλα με τις προεπιλογές (δείτε παρακάτω), και υπολογίστε από περίπου είκοσι λεπτά έως αρκετά πάνω από μία ώρα, ανάλογα με το μηχάνημα και το πόσα extras θα κρατήσετε.

| # | Βήμα | Τι σας ρωτά |
|---|---|---|
| 1 | Απαριθμεί τις υπηρεσίες PhantomSDR-Plus που τρέχουν αυτή τη στιγμή — admin panel, reverse proxy, stats server, δέκτης — και προσφέρεται να τις σταματήσει πριν αγγίξει οτιδήποτε. Μόνο ένα script εκκίνησης που τρέχει μετράει ως δέκτης· ένα που είναι απλώς ανοιχτό σε επεξεργαστή κειμένου δεν αγγίζεται. | επιβεβαίωση, **προεπιλογή ναι** |
| 2–6 | Εντοπίζει τη διανομή και εγκαθιστά όλες τις εξαρτήσεις build (compiler, meson/ninja, FFTW, Boost, FLAC, Opus, liquid-dsp, zlib/zstd, libcurl …), εγκαθιστώντας και Node.js 22 μέσω nvm αν το σύστημα δεν έχει ή έχει παλαιότερο | τίποτα |
| 7 | Χτίζει το backend με meson | τίποτα |
| 8 | Χτίζει τον driver του δέκτη σας — RX888 MkII / RX888, RTL-SDR (το Blog V4 ρωτιέται χωριστά), SDRplay RSP1A, RigExpert Fobos SDR, Airspy HF+, HackRF One ή κανέναν. Με τον RX888 **εγκαθιστά και τους κανόνες udev**, ώστε ο server να μη χρειάζεται ποτέ `sudo` για τη συσκευή. Οι RSP1A, Fobos και Airspy HF+ δουλεύουν μέσω SoapySDR: η επιλογή τους τρέχει το `setup-rsp1a.sh`, το `setup-fobos.sh` ή το `setup-airspyhf.sh`, που χτίζει τον driver και το `rx_sdr` και εγκαθιστά επίσης κανόνα udev (δείτε [Δέκτες μέσω SoapySDR (RSP1A, Fobos, Airspy HF+)](#δέκτες-μέσω-soapysdr-rsp1a-fobos-airspy-hf)) Ο HackRF One δεν χρειάζεται SoapySDR: η επιλογή του τρέχει το `setup-hackrf.sh`, που εγκαθιστά το πακέτο `hackrf` της διανομής και έναν κανόνα udev. | ποιον SDR έχετε |
| 9 | Ανοίγει το `frontend/site_information.json` στον editor σας | διακριτικό, locator, εξοπλισμός, κεραία — **μην το προσπεράσετε** |
| 10–11 | Εγκαθιστά τις εξαρτήσεις του frontend και χτίζει τις σελίδες desktop και `/mobile` | τίποτα |
| 12 | Εγκαθιστά OpenCL, επιλέγοντας τον provider από το υλικό που βρίσκει (GPU Intel / AMD / NVIDIA, ή το x86 CPU runtime). Αν δεν υπάρχει συσκευή με OpenCL, σας το λέει και προχωράει | επιβεβαίωση, προεπιλογή ναι |
| 13–15 | Εγκαθιστά το **admin panel**, τον **αποκωδικοποιητή FreeDV RADE V1** και τον **stats server** — και τα τρία από προεπιλογή | επιβεβαίωση για καθένα, προεπιλογή ναι· το καθένα έχει δικές του ερωτήσεις |
| 16 | Ξαναεφαρμόζει τα πέντε διορθωμένα headers του websocketpp πάνω στο subproject του meson και επαληθεύει ότι εφαρμόστηκαν. Τα τρία από αυτά είναι η δουλειά συμβατότητας με Boost ≥ 1.87, χωρίς την οποία το backend δεν μεταγλωττίζεται σε Boost 1.90· τα άλλα δύο είναι αλλαγές του ίδιου του έργου, η μία εκ των οποίων είναι η διόρθωση που χρειάζεται η εγγραφή στο websdr.org | τίποτα |
| 17 | Εγκαθιστά την **εξομοίωση πελατών KiwiSDR** εκτελώντας το `kiwi_install.sh`, ώστε πελάτες Kiwi όπως το AetherSDR να μπορούν να συνδεθούν σε αυτόν τον δέκτη. Διορθώνει τις πηγές και προσθέτει `[kiwi_emulation]` στα αρχεία ρυθμίσεων στη ρίζα του αποθετηρίου — δείτε [Εξομοίωση πελατών KiwiSDR](Aether_config.md) | επιβεβαίωση, προεπιλογή ναι |
| 18 | Εκτελεί το `recompile.sh`, ώστε όλα να χτιστούν από τις διορθωμένες πηγές | `[3] Both backend and frontend` → αρχική παραλλαγή → `[1] build-all.sh` |
| 19 | Τυπώνει τη σύνοψη: κάθε βήμα με το αποτέλεσμά του και κάθε στοιχείο με το τι εγκαταστάθηκε | τίποτα |

#### Εγκατάσταση χωρίς επίβλεψη

Κάθε ερώτηση έχει μια μεταβλητή περιβάλλοντος που την παρακάμπτει, και το πρόγραμμα εγκατάστασης περνά μόνο του στις προεπιλογές όταν η είσοδος δεν είναι τερματικό (σωλήνας, container, εργασία CI). Ισχύει το ίδιο και στα τέσσερα: `install.sh`, `install_arch.sh`, `install_fedora.sh` και `install_opensuse.sh`. Θέστε `PHANTOM_NONINTERACTIVE=1` και η εκτέλεση ολοκληρώνεται χωρίς καμία ερώτηση:

| Μεταβλητή | Τι κάνει |
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
| `PHANTOM_CURLPP=y\|n` | συνέχεια χωρίς curlpp — μόνο Arch και openSUSE (προεπιλογή y) |
| `PHANTOM_FIX_CLOCK_SKEW=y\|n` | επαναφορά των χρονοσημάνσεων των πηγαίων αρχείων που είναι στο μέλλον, ώστε να μπορέσει να χτίσει το meson (προεπιλογή y) |

Τα τρία υπο-προγράμματα με σήμανση *n χωρίς επίβλεψη* είναι διαδραστικά από μόνα τους, οπότε μια εκτέλεση χωρίς επίβλεψη τα παραλείπει αντί να κολλήσει στις ερωτήσεις τους. Ονομάστε τα ρητά για να συμπεριληφθούν:

```bash
# a complete unattended install for an RX888 MkII
PHANTOM_NONINTERACTIVE=1 PHANTOM_SDR=1 ./install.sh

# ... and with the admin panel, RADE and the statistics server too
PHANTOM_NONINTERACTIVE=1 PHANTOM_SDR=1 \
  PHANTOM_ADMIN=y PHANTOM_RADE=y PHANTOM_STATS=y ./install.sh
```

Μετά από μια επανεκκίνηση οι κανόνες udev του RX888 και ο όποιος driver OpenCL είναι πλήρως ενεργοί· το script σας λέει πότε χρειάζεται επανεκκίνηση ή νέα σύνδεση χρήστη.

Όταν στήνει τον πίνακα διαχείρισης, ο installer προσφέρει και τις δύο μονάδες systemd και **συνιστά έντονα** να τις δεχτείτε: η προστασία υπερθέρμανσης της CPU τρέχει μέσα στον πίνακα, οπότε χωρίς αυτές μια επανεκκίνηση ή μια κατάρρευση αφήνει το μηχάνημα απροστάτευτο. Το βήμα παραλείπεται αυτόματα όπου δεν τρέχει systemd (containers, WSL1, OpenRC) — δείτε τον [οδηγό του πίνακα](ADMIN_PANEL_SETUP.md).

Κάθε extra είναι ένα κανονικό script που μπορείτε να τρέξετε και μόνο του, οποτεδήποτε — `./setup_admin.sh` ([οδηγός](ADMIN_PANEL_SETUP.md)), `./install_rade.sh` ([οδηγός](RADE_README.md)), `./install-stats-server.sh` ([οδηγός](sdr-stats/README.md)), `./setup-rx888-udev.sh` και τα scripts των δεκτών `./setup-rsp1a.sh`, `./setup-fobos.sh`, `./setup-airspyhf.sh` και `./setup-hackrf.sh` — αυτά ακριβώς καλεί το πρόγραμμα εγκατάστασης.

### Χειροκίνητο build (αναφορά)

> [!IMPORTANT]
> **Δεν χρειάζεστε αυτή την ενότητα για μια κανονική εγκατάσταση.** Το `./install.sh` — ή το script της διανομής σας — τα κάνει όλα αυτά για εσάς· δείτε [Τι κάνει το πρόγραμμα εγκατάστασης](#τι-κάνει-το-πρόγραμμα-εγκατάστασης). Όσα ακολουθούν είναι αναφορά για χειροκίνητη εγκατάσταση, για διανομή που δεν καλύπτει κανένα script, ή για την επισκευή ενός βήματος με το χέρι.

Αν ποτέ χρειαστεί να χτίσετε χωρίς το script εγκατάστασης — σε διανομή που δεν καλύπτεται, ή για να επισκευάσετε ένα μισοτελειωμένο build:

#### Μεταγλώττιση του backend

```bash
# Clean any previous builds, Configure build with optimization, Compile
rm -rf build
meson setup build --buildtype=release --optimization=3
meson compile -C build

# Verify binary was created
ls -lh build/spectrumserver
```

#### Μεταγλώττιση του frontend

```bash
cd frontend

# Install dependencies, Fix any vulnerabilities, Build the frontend
npm install
npm audit fix
npm run build

# Return to project root
cd ..
```

### Επαληθεύστε την εγκατάσταση

```bash
# Check if binary exists
ls -lh build/spectrumserver

# Check if frontend was built
ls -lh frontend/dist/

# List important files
ls -lh *.sh *.toml
```

---

## Εγκατάσταση του κωδικοποιητή ήχου Opus

> [!IMPORTANT]
> **Δεν χρειάζεστε αυτή την ενότητα για μια κανονική εγκατάσταση.** Το `./install.sh` — ή το script της διανομής σας — τα κάνει όλα αυτά για εσάς· δείτε [Τι κάνει το πρόγραμμα εγκατάστασης](#τι-κάνει-το-πρόγραμμα-εγκατάστασης). Όσα ακολουθούν είναι αναφορά για χειροκίνητη εγκατάσταση, για διανομή που δεν καλύπτει κανένα script, ή για την επισκευή ενός βήματος με το χέρι.


Ο Opus προσφέρει καλύτερη ποιότητα ήχου και μικρότερη καθυστέρηση σε σχέση με το FLAC.

### 1. Εγκαταστήστε τη βιβλιοθήκη συστήματος libopus

```bash
sudo apt-get update
sudo apt-get install -y libopus0 libopus-dev
```

### 2. Εγκαταστήστε τον αποκωδικοποιητή Opus για το frontend

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

### 3. Επαληθεύστε την εγκατάσταση του Opus

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

Το PhantomSDR-Plus περιλαμβάνει έναν προαιρετικό **autorun spot reporter** (στον κατάλογο `autorun/`). Αποκωδικοποιεί FT8/FT4/WSPR από την πλευρά του διακομιστή, απευθείας από τον δέκτη, και ανεβάζει τα spot στα δίκτυα αναφορών:

- **FT8 / FT4 → PSK Reporter** (IPFIX/UDP)
- **WSPR → wsprnet.org** (HTTP)

Ελέγχεται εξ ολοκλήρου από την καρτέλα **πίνακας διαχείρισης → «Spot Reporting»** και **οι αναφορές είναι ΑΠΕΝΕΡΓΟΠΟΙΗΜΕΝΕΣ εξ ορισμού** — τίποτα δεν μεταδίδεται ή ανεβαίνει μέχρι να το ενεργοποιήσετε εκεί. Ο αποκωδικοποιητής εκτελείται ως ξεχωριστός δαίμονας Node.js και λαμβάνει τον ήχο του δέκτη τοπικά, οπότε δεν προσθέτει επιπλέον υλικό RF.

### Προϋποθέσεις

| Προϋπόθεση | Σημειώσεις |
|------------|------------|
| **Node.js 22+** | Το ίδιο περιβάλλον εκτέλεσης που ήδη χρειάζεται η μεταγλώττιση του frontend — εγκαθίσταται στο [βήμα του Node.js](#εγκατάσταση-nodejs-και-npm). |
| **Πακέτα npm `ws` + `cbor-x`** | Επιλύονται μέσω του `autorun/node_modules`, ενός συμβολικού συνδέσμου προς το `node_modules` του frontend (και τα δύο πακέτα δηλώνονται στο `frontend/package.json`). |
| **`util-linux`** (`taskset`) | Το κουμπί «Start» της διαχείρισης καρφιτσώνει τον δαίμονα στους E-cores με `taskset`. Υπάρχει σχεδόν σε κάθε διανομή· τα προγράμματα εγκατάστασης το προσθέτουν ρητά. |
| **Διακριτικό + locator** | Διαβάζονται από το `frontend/site_information.json` (`siteSysop` / `siteGridSquare`), εκτός αν αντικατασταθούν στην καρτέλα διαχείρισης. Τα spot ανεβαίνουν με αυτό το διακριτικό. |

> ⚠️ **Αναφέρετε μόνο ό,τι πράγματι λαμβάνετε.** Τα spot ανεβαίνουν σε δημόσια δίκτυα με το διακριτικό σας — ενεργοποιήστε μόνο μπάντες/τρόπους που ο δέκτης σας ακούει πραγματικά και χρησιμοποιήστε το σωστό locator.

### Αυτόματη εγκατάσταση

Το `install.sh` (και οι παραλλαγές ανά διανομή: `install_arch.sh`, `install_fedora.sh`, `install_opensuse.sh`) κάνουν τα πάντα για εσάς: εγκαθιστούν Node.js 22 και `util-linux`, εκτελούν το `npm install` του frontend και έπειτα δημιουργούν αυτόματα τον συμβολικό σύνδεσμο `autorun/node_modules`. Δεν απαιτούνται επιπλέον βήματα — η δυνατότητα είναι έτοιμη μόλις ολοκληρωθεί το `install.sh`.

### Χειροκίνητη εγκατάσταση

> [!NOTE]
> Το πρόγραμμα εγκατάστασης το κάνει ήδη αυτό για εσάς: δημιουργεί το symlink και εγκαθιστά το `util-linux`. Χρησιμοποιήστε τα παρακάτω βήματα μόνο για επισκευή με το χέρι.

Αν κάνατε χειροκίνητη εγκατάσταση (επιλογή Β), δημιουργήστε μόνοι σας τον συμβολικό σύνδεσμο μετά το `npm install` του frontend, ώστε ο δαίμονας να μπορεί να επιλύσει τις εξαρτήσεις του:

```bash
cd ~/PhantomSDR-Plus

# 1. Frontend deps must be installed first (ws + cbor-x live there)
cd frontend && npm install && cd ..

# 2. Link the autorun daemon to the frontend's node_modules
ln -sfn ../frontend/node_modules autorun/node_modules

# 3. Ensure taskset is available (Debian/Ubuntu shown; use your package manager)
sudo apt install -y util-linux
```

> **Σημείωση:** το `autorun/node_modules` αγνοείται από το git, οπότε ένα καθαρό `git clone` δεν το περιέχει ποτέ — ο σύνδεσμος πρέπει να (ξανα)δημιουργείται μετά από κάθε καθαρή λήψη. Τα προγράμματα εγκατάστασης το κάνουν για εσάς· η παραπάνω εντολή αφορά μόνο τις χειροκίνητες εγκαταστάσεις.

### Επαλήθευση

```bash
# The symlink should point at ../frontend/node_modules
ls -l autorun/node_modules

# ws + cbor-x must resolve
ls -d frontend/node_modules/ws frontend/node_modules/cbor-x

# taskset must be on PATH
command -v taskset
```

Έπειτα ανοίξτε τον πίνακα διαχείρισης, πηγαίνετε στην καρτέλα **Spot Reporting**, ορίστε τα στοιχεία σας, επιλέξτε τις μπάντες/τρόπους προς αποκωδικοποίηση, ενεργοποιήστε τους προορισμούς και πατήστε **Start**. Ένα σήμα «📶 REPORTING» εμφανίζεται στον κύριο καταρράκτη όσο οι αναφορές είναι ενεργές. (Το PSK Reporter ανεβάζει ομαδικά κάθε 5 λεπτά και το wsprnet κάθε 2 λεπτά, οπότε ένας δαίμονας που μόλις ξεκίνησε δείχνει «0 sent» για τα πρώτα λεπτά — είναι φυσιολογικό.)

Στη συνέχεια εμφανίζονται δύο διαφορετικοί μετρητές, που εύκολα μπερδεύονται μεταξύ τους. Τα πλακίδια **SPOTS UPLOADED PER DECODER** μετρούν μόνο την τρέχουσα εκτέλεση, οπότε το Stop/Start τα μηδενίζει· ο αριθμός δίπλα σε κάθε πλαίσιο ελέγχου μπάντας/τρόπου είναι το **συνολικό** άθροισμα από την αρχή, αποθηκευμένο στο `autorun-totals.json` ώστε να επιβιώνει των επανεκκινήσεων. Δείτε τον [οδηγό του πίνακα διαχείρισης](ADMIN_PANEL_SETUP.md) και για τα δύο, καθώς και για τη σελίδα **Γραφήματα**, που σχεδιάζει συχνότητα CPU, φόρτο, θερμοκρασία και συνδεδεμένους χρήστες από 15 λεπτά έως 24 ώρες.

> **Αν το μηχάνημά σας ζεσταίνεται**, ο πίνακας διαθέτει και [θερμική προστασία](ADMIN_PANEL_SETUP.md#thermal-guard) που σταματά τον διακομιστή όταν η CPU φτάσει σε επικίνδυνη θερμοκρασία και τον επανεκκινεί μόλις κρυώσει. Τα όριά της προκύπτουν από το κρίσιμο όριο της ίδιας σας της CPU, οπότε δεν έχετε τίποτα να υπολογίσετε, και λειτουργεί με όποιον τρόπο εκκίνησης/διακοπής κι αν χρησιμοποιείτε. Εγκαθίσταται μαζί με τον πίνακα αλλά ξεκινά σε λειτουργία μόνο καταγραφής: καταγράφει τι *θα* έκανε και δεν αλλάζει τίποτα μέχρι να την ενεργοποιήσετε στις Ρυθμίσεις. Η συνεχής αποκωδικοποίηση κρατά τη CPU απασχολημένη όλο το εικοσιτετράωρο, οπότε αξίζει να διαβάσετε την καρτέλα CRASH μετά από μια εβδομάδα autorun για να δείτε πόσο κοντά φτάνει πραγματικά το μηχάνημά σας.

> **Η θύρα του διακομιστή εντοπίζεται αυτόματα.** Ο δαίμονας συνδέεται απευθείας στη `[server] port` του ίδιου του spectrumserver (loopback + διακριτικό, παρακάμπτοντας τον διαμεσολαβητή). Διαβάζει τη θύρα αυτή από το αρχείο ρυθμίσεων με το οποίο ξεκίνησε ο τρέχων spectrumserver, οπότε λειτουργεί σε οποιαδήποτε θύρα χωρίς ρύθμιση — η γραμμή `[autorun] tap backend: …` στο `autorun.log` δείχνει τι εντόπισε. Αν ο διακομιστής σας δεν εκτελούνταν όταν ξεκίνησε ο δαίμονας ή αν έχετε ασυνήθιστη διάταξη, καθορίστε την στο `autorun.json`:
> ```json
> "server": { "host": "127.0.0.1", "port": 9002 }
> ```
> Λανθασμένη θύρα εμφανίζεται ως `504` / `tap closed 1006` στο `autorun.log` με τα `decodes` κολλημένα στο 0.

---

## Εξομοίωση πελατών KiwiSDR (προαιρετικό)

Από την έκδοση v4.1.0 το PhantomSDR-Plus μπορεί να απαντά και στο **πρωτόκολλο KiwiSDR**, ώστε λογισμικό γραμμένο για KiwiSDR — το **AetherSDR**, το `kiwiclient` και τα υπόλοιπα — να συνδέεται απευθείας στον δέκτη σας, στον ίδιο υπολογιστή και θύρα που ήδη δημοσιεύετε. Είναι απενεργοποιημένη μέχρι να προστεθεί `[kiwi_emulation] enabled = true` στη ρύθμιση με την οποία τρέχει ο δέκτης σας.

Το πρόγραμμα εγκατάστασης την προσφέρει ως βήμα 17· το `./kiwi_install.sh` την εφαρμόζει σε δέντρο που είναι ήδη εγκατεστημένο.

> **Πλήρης τεκμηρίωση: [Εξομοίωση πελατών KiwiSDR](Aether_config.md)** — τι κάνει η γέφυρα, πώς εγκαθίσταται, κάθε κλειδί `[kiwi_emulation]`, η σύνδεση πελάτη, η στάθμη ήχου, το S-meter, ο ρυθμός του καταρράκτη και πίνακας συμπτωμάτων.

---

## Ρυθμίσεις

### 1. Επιλέξτε το αρχείο ρυθμίσεων

Επιλέξτε το κατάλληλο αρχείο ρυθμίσεων για το SDR σας:

- `config-rtl.toml` – κλειδιά RTL-SDR
- `config-rsp1a.toml` – SDRplay RSP1A
- `config-airspyhf.toml` – Airspy HF+ Discovery
- `config-fobos-hf.toml` – RigExpert Fobos SDR, HF1/HF2 με άμεση δειγματοληψία (0-25 MHz)
- `config-fobos.toml` – RigExpert Fobos SDR, κλάδος RF (25-6000 MHz)
- `config-rx888mk2.toml` – RX888 MK2
- `config-hackrf.toml` – HackRF One
- `config.example.hackrf.toml` – HackRF One

Σε αυτό το παράδειγμα θα χρησιμοποιήσουμε RTL-SDR.

### 2. Επεξεργαστείτε το αρχείο ρυθμίσεων

```bash
nano config-rtl.toml
```

#### Βασικές ρυθμίσεις

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

#### Οδηγίες για τον ρυθμό δειγματοληψίας

| Κάλυψη | Ρυθμός δειγματοληψίας | Μέγεθος FFT |
|--------|------------------------|-------------|
| 2 MHz | 2048000 | 131072 |
| 3.2 MHz | 3200000 | 131072 |
| 10 MHz | 10000000 | 1048576 |
| 30 MHz | 30000000 | 2097152 |
| 60 MHz | 60000000 | 4194304 |

### 3. Ρυθμίστε τις πληροφορίες του σταθμού

```bash
nano frontend/site_information.json
```

Επεξεργαστείτε τα ακόλουθα πεδία:

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

**Περιοχές IARU:**
- **1**: Ευρώπη, Αφρική, Μέση Ανατολή, Βόρεια Ασία
- **2**: Αμερική (Βόρεια, Κεντρική, Νότια), Καραϊβική
- **3**: Ασία-Ειρηνικός, Ωκεανία

### 4. Προσαρμόστε τους δείκτες συχνοτήτων (προαιρετικό)

```bash
nano markers.json
```

Προσθέστε τις αγαπημένες σας συχνότητες, αναμεταδότες και ραδιοφωνικούς σταθμούς.

### 5. Επεξεργαστείτε το σενάριο εκκίνησης

```bash
nano start-rtl.sh
```

Το σενάριο εκκίνησης είναι αυτόνομος εκκινητής με ενσωματωμένο watchdog. Επεξεργαστείτε μόνο το τμήμα **RECEIVER CONFIGURATION** κοντά στην αρχή, ώστε τα ορίσματα του δέκτη να ταιριάζουν με την εγκατάστασή σας:

```bash
# ═══ RECEIVER CONFIGURATION (the only receiver-specific part) ═══
RX_LABEL="RTL-SDR"
RX_COMM="rtl_sdr"                       # process name to monitor/kill
CONFIG="$PHANTOMDIR/config-rtl.toml"    # your .toml
FIFO="$PHANTOMDIR/rtl.fifo"
RX_ARGS="${RX_ARGS:--f 145000000 -s 2048000 -}"   # receiver args (edit these)
```

Παράμετροι μέσα στο `RX_ARGS`:
- `-f 145000000`: κεντρική συχνότητα (145 MHz)
- `-s 2048000`: ρυθμός δειγματοληψίας (2,048 MSPS)

Το `CONFIG` δείχνει στο δικό σας `.toml`. **Δεν** χρειάζεται να αλλάξετε τίποτε άλλο στο σενάριο — η λογική εκκίνησης/επανεκκίνησης/watchdog/καταγραφής είναι γενική. Μπορείτε επίσης να αντικαταστήσετε τα ορίσματα του δέκτη κατά την εκκίνηση χωρίς να επεξεργαστείτε το αρχείο: `RX_ARGS="-f 145000000 -s 2048000 -" ./start-rtl.sh` (`RX888_ARGS` για το `start-rx888mk2.sh`).

---

## Ρύθμιση ανά συσκευή SDR

### RTL-SDR

#### Εγκαταστήστε τα εργαλεία RTL-SDR

```bash
sudo apt install -y rtl-sdr
```

#### Δοκιμάστε το RTL-SDR

```bash
rtl_test
```

Πατήστε Ctrl+C για διακοπή. Θα πρέπει να δείτε πληροφορίες για τον ρυθμό δειγματοληψίας.

#### Επεξεργαστείτε τις ρυθμίσεις

```bash
nano config-rtl.toml
```

Συνήθεις ρυθμίσεις για RTL-SDR:
```toml
sps = 2048000
frequency = 145000000
signal = "iq"
format = "u8"
```

### Δέκτες μέσω SoapySDR (RSP1A, Fobos, Airspy HF+)

Ο SDRplay RSP1A, ο RigExpert Fobos SDR και ο Airspy HF+ φτάνουν στον server με τον ίδιο τρόπο: ένας driver SoapySDR για τη συσκευή, και το `rx_sdr` (από το rx_tools) που στέλνει τα δείγματα στο `spectrumserver`. Ένα script ανά δέκτη εγκαθιστά όλη την αλυσίδα:

| Δέκτης | Script | Επιλογή εγκατάστασης | Script εκκίνησης | Ρυθμίσεις |
|---|---|---|---|---|
| SDRplay RSP1A | `./setup-rsp1a.sh` | 3 | `start-rsp1a.sh` | `config-rsp1a.toml` |
| RigExpert Fobos SDR | `./setup-fobos.sh` | 5 | `start-fobos-hf.sh` (HF) / `start-fobos.sh` (RF) | `config-fobos-hf.toml` / `config-fobos.toml` |
| Airspy HF+ | `./setup-airspyhf.sh` | 6 | `start-airspyhf.sh` | `config-airspyhf.toml` |

Κάθε script:

- εγκαθιστά git, cmake, compiler, libusb και **SoapySDR** από τα πακέτα της διανομής σας — αναγνωρίζει apt, dnf, pacman και zypper, άρα δουλεύει το ίδιο σε Debian/Ubuntu, Fedora, Arch και openSUSE·
- χτίζει τον driver του δέκτη από τον πηγαίο κώδικα στο `sdr_drivers/` (εκτός git)·
- χτίζει το **rx_tools** για το `rx_sdr`, εκτός αν το `rx_sdr` είναι ήδη εγκατεστημένο — ένα αντίγραφο εξυπηρετεί όλους τους δέκτες·
- εγκαθιστά έναν **κανόνα udev** και σας προσθέτει στην ομάδα `plugdev`, ώστε το script εκκίνησης να μη χρειάζεται ποτέ `sudo` για τη συσκευή. **Αποσυνδεθείτε και συνδεθείτε ξανά μία φορά** για να ισχύσει η ομάδα·
- στο τέλος ελέγχει ότι το SoapySDR πράγματι εμφανίζει τον driver, αλλιώς σταματά με σφάλμα.

Τρέξτε τα ως κανονικός χρήστης — καλούν μόνα τους το `sudo`. Είναι idempotent: αν ξανατρέξει ένα, ενημερώνει τον κώδικα του driver με `git pull` και ξαναχτίζει. Το πρόγραμμα εγκατάστασης καλεί ακριβώς αυτά τα scripts· σε σταθμό που είναι ήδη εγκατεστημένος, τρέξτε σκέτο αυτό του δέκτη σας. Το κοινό μέρος βρίσκεται στο `setup-sdr-common.sh`, που δεν τρέχει μόνο του. Δύο προαιρετικές μεταβλητές ισχύουν και για τα τρία: το `SDR_USER=<όνομα>` βάζει άλλον λογαριασμό στο `plugdev`, και το `SDR_SKIP_DEPS=1` παραλείπει την εγκατάσταση πακέτων.

Με τη συσκευή συνδεδεμένη, ελέγξτε ότι ο δέκτης εντοπίζεται:

```bash
SoapySDRUtil --find="driver=soapyMiri"   # RSP1A
SoapySDRUtil --find="driver=fobos"       # Fobos
SoapySDRUtil --find="driver=airspyhf"    # Airspy HF+
```

#### SDRplay RSP1A

Το `setup-rsp1a.sh` εγκαθιστά τον **driver ανοιχτού κώδικα**: το libmirisdr-5, τον driver που προέκυψε από reverse engineering για τα chips Mirics MSi2500/MSi001 μέσα στους RSP1 και RSP1A, με το module SoapySDR του, το SoapyMiri (`driver=soapyMiri`). Δεν χρειάζεται υπηρεσία στο παρασκήνιο ούτε root. Το script βάζει επίσης σε blacklist τους drivers πυρήνα `msi2500` και `msi001` στο `/etc/modprobe.d/blacklist-msi2500.conf`, επειδή δεσμεύουν τον RSP1A ως ραδιόφωνο V4L2 πριν προλάβει το `rx_sdr` να τον ανοίξει. Αν η συσκευή ήταν συνδεδεμένη ενώ ήταν φορτωμένοι, αποσυνδέστε και ξανασυνδέστε την μία φορά (ή κάντε επανεκκίνηση).

Το κλειστό API της SDRplay (`driver=sdrplay`, με το SoapySDRPlay και την υπηρεσία `sdrplay`) εξακολουθεί να δουλεύει — το συνοδευτικό αρχείο `instructions-for-rsp1a` περιγράφει εκείνη την εγκατάσταση. Το `start-rsp1a.sh` διαλέγει μόνο του ανάμεσα στα δύο: αν το SoapySDR έχει τον driver `sdrplay` χρησιμοποιεί το API και πρώτα επανεκκινεί την υπηρεσία `sdrplay`, αλλιώς χρησιμοποιεί το libmirisdr-5. Ένας σταθμός στημένος στο API συνεχίζει λοιπόν να δουλεύει όπως πριν. Για να επιβάλετε έναν, ξεκινήστε με `RX_DRIVER=miri` ή `RX_DRIVER=sdrplay`. Ο driver που επιλέχθηκε γράφεται στο `logwebsdr.txt` ως `RSP1A driver: miri` ή `RSP1A driver: sdrplay`.

#### RigExpert Fobos SDR

Ο Fobos στέλνει **έναν κλάδο κάθε φορά**, γι' αυτό έχει δύο scripts εκκίνησης που μοιράζονται το κλείδωμα του watchdog όπως κάθε `start-*.sh` — η εκκίνηση του ενός σταματά το άλλο:

- **`start-fobos-hf.sh`** — οι είσοδοι HF1/HF2 με άμεση δειγματοληψία, 0-25 MHz, στη θύρα 9003. Σε αυτή τη λειτουργία δεν υπάρχει τοπικός ταλαντωτής: ο ADC ψηφιοποιεί συνεχώς 0-25 MHz (το `-f 0` είναι σκόπιμο, και η προειδοποίηση *Failed to set center freq* του rx_sdr είναι αναμενόμενη). Το `rx_sdr` δίνει CF32 στα 50 Msps· ο μικρός μετατροπέας `cf32_to_real` (τον χτίζει το `setup-fobos.sh` από το `cf32_to_real.c`) κρατά το κανάλι I και το κλιμακώνει σε s16, γι' αυτό το `config-fobos-hf.toml` έχει `signal="real"` και `format="s16"`.
- **`start-fobos.sh`** — ο κλάδος RF, 25-6000 MHz, IQ, στη θύρα 9002. Διαλέξτε το παράθυρο πριν την πρώτη εκκίνηση: τα `-f` (κέντρο) και `-s` (ρυθμός δειγματοληψίας) στη γραμμή `RX_ARGS` πρέπει να ταιριάζουν με τα `frequency=` και `sps=` του `config-fobos.toml`. Οι τιμές που έρχονται (97 MHz, 20 Msps) είναι μόνο αφετηρία για να δείτε ότι τρέχει.

> [!IMPORTANT]
> Το `config-fobos-hf.toml` έρχεται με `accelerator="opencl"`: μια ροή 50 Msps μέσα από FFT 1M bins είναι τόσο βαριά όσο τα 60 Msps του RX888, και στη CPU χάνονται δείγματα και το μηχάνημα ζεσταίνεται. Σε μηχάνημα χωρίς συσκευή OpenCL το `spectrumserver` δεν ξεκινά με αυτή τη ρύθμιση — βάλτε εκεί `accelerator="none"`.

Το SoapyFobosSDR χρειάζεται για να χτιστεί τα headers και του libfobos και του libfobos-sdr-agile, γι' αυτό το `setup-fobos.sh` χτίζει και τα δύο, ακόμη και για το στάνταρ firmware. Η υποστήριξη του Fobos προέρχεται από ένα script που έγραψε άλλος σταθμός αφού έστησε έναν Fobos στο PhantomSDR-Plus· οι τιμές HF στο `config-fobos-hf.toml` είναι αυτές που δούλεψαν εκεί.

#### Airspy HF+

Το `setup-airspyhf.sh` εγκαθιστά το libairspyhf από τη διανομή όπου υπάρχει πακέτο (Debian και Ubuntu, Fedora, openSUSE) και το χτίζει από τον πηγαίο κώδικα όπου δεν υπάρχει (το Arch το έχει μόνο στο AUR), και μετά χτίζει το SoapyAirspyHF (`driver=airspyhf`). Το `start-airspyhf.sh` δίνει 912 ksps IQ σε CS16, που το `config-airspyhf.toml` διαβάζει ως `format="s16"`. Το συνοδευτικό αρχείο `instructions-for-airspy` περιγράφει τον χειροκίνητο δρόμο.

### RX888 MK2

#### Εγκαταστήστε τα εργαλεία RX888

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

#### Εκτέλεση του rx888_stream χωρίς sudo (κανόνες udev)

Εξ ορισμού η συσκευή USB Cypress FX3 του RX-888 είναι προσβάσιμη μόνο από τον root, οπότε το `rx888_stream` θα χρειαζόταν `sudo`. Εκτελέστε μία φορά το συνοδευτικό βοηθητικό σενάριο για να εγκατασταθούν κανόνες udev και να προστεθείτε στην ομάδα `plugdev`:

```bash
./setup-rx888-udev.sh          # re-runs itself with sudo automatically
```

Γράφει το `/etc/udev/rules.d/99-rx888.rules` και για τα τρία αναγνωριστικά προϊόντος Cypress FX3 (`04b4:00f1`/`00f3` bootloader και `04b4:8613` με φορτωμένο firmware), επαναφορτώνει το udev και δημιουργεί σταθερό σύνδεσμο `/dev/rx888`. **Αποσυνδεθείτε και συνδεθείτε ξανά** (για την αλλαγή ομάδας) και **επανασυνδέστε τη συσκευή** μία φορά· έπειτα το `rx888_stream` — και ο εκκινητής `start-rx888mk2.sh` — τρέχουν χωρίς `sudo`. Είναι ταυτοδύναμο, οπότε μπορείτε να το εκτελέσετε ξανά με ασφάλεια. Για άλλο λογαριασμό: `RX888_USER=<όνομα> ./setup-rx888-udev.sh`.

#### Επεξεργαστείτε τις ρυθμίσεις

```bash
nano config-rx888mk2.toml
```

Συνήθεις ρυθμίσεις για RX888:
```toml
sps = 60000000
frequency = 0
signal = "real"
format = "s16"
fft_size = 4194304
```

### HackRF One

Για τον HackRF δεν χτίζεται τίποτα: το `hackrf_transfer`, από το πακέτο `hackrf` της διανομής σας, στέλνει τα δείγματα κατευθείαν στο `spectrumserver`. Το `./setup-hackrf.sh` (επιλογή 7 του προγράμματος εγκατάστασης) εγκαθιστά αυτό το πακέτο με apt, dnf, pacman ή zypper και προσθέτει κανόνα udev και την ομάδα `plugdev`, ώστε το `start-hackrf.sh` να τρέχει χωρίς `sudo` — αποσυνδεθείτε και συνδεθείτε ξανά μία φορά μετά.

```bash
./setup-hackrf.sh    # installs the hackrf package and the udev rule
hackrf_info          # with the HackRF plugged in: must list the board
```

Το `start-hackrf.sh` στέλνει ένα παράθυρο κάθε φορά. Διαλέξτε το πριν την πρώτη εκκίνηση: τα `-f` (κέντρο) και `-s` (ρυθμός δειγματοληψίας) στη γραμμή `RX_ARGS` πρέπει να ταιριάζουν με τα `frequency=` και `sps=` του `config-hackrf.toml`. Τα `-l` και `-g` είναι τα κέρδη του LNA (0-40 dB, βήματα 8 dB) και του VGA (0-62 dB, βήματα 2 dB), και το `-a 1` ανάβει τον ενισχυτή RF. Οι τιμές που έρχονται (98 MHz, 20 Msps) είναι μόνο αφετηρία για να δείτε ότι τρέχει.

Το `hackrf_transfer` γράφει IQ 8 bit **με πρόσημο**, γι' αυτό οι ρυθμίσεις θέλουν `format="s8"`. Το `config.example.hackrf.toml` είχε `u8` μέχρι τον Σεπτέμβριο του 2026· με `u8` κάθε δείγμα είναι μετατοπισμένο κατά 128 και ο καταρράκτης δείχνει μόνο θόρυβο — ελέγξτε τυχόν παλαιότερο αντίγραφό του.

---

## Δοκιμή και επαλήθευση

### 1. Δοκιμαστική εκτέλεση

```bash
# For RTL-SDR
./start-rtl.sh
```

Αυτό εκκινεί τον διακομιστή **στο παρασκήνιο** (αποσυνδέεται και επιστρέφει αμέσως) και αρχίζει να καταγράφει στο `logwebsdr.txt`.

### 2. Ελέγξτε για σφάλματα

Το σενάριο καταγράφει την πρόοδό του στο `logwebsdr.txt` — παρακολουθήστε το ζωντανά:

```bash
tail -f logwebsdr.txt
```

Αναζητήστε:
- ✅ `Starting the initialization script of the PhantomSDR Server`
- ✅ `<receiver> running (PID …)`
- ✅ `Server started normally`
- ❌ `Server … FAILED …` ή `ERROR: receiver binary '…' not found` (διορθώστε τα ορίσματα του δέκτη ή το `.toml`, ή εγκαταστήστε το εργαλείο του δέκτη, και ξαναεκτελέστε το σενάριο εκκίνησης)

### 3. Πρόσβαση στη διεπαφή web

Ανοίξτε τον περιηγητή σας στο:
```
http://localhost:9002
```

(Αντικαταστήστε τον αριθμό θύρας με τη δική σας ρυθμισμένη θύρα)

### 4. Επαληθεύστε τη λειτουργία

- Ο καταρράκτης πρέπει να εμφανίζεται
- Ο ήχος πρέπει να παίζει όταν κάνετε κλικ σε σήματα
- Το S-meter πρέπει να αντιδρά στα σήματα
- Ο μετρητής χρηστών πρέπει να δείχνει «1»

### 5. Δοκιμάστε από άλλη συσκευή

Από άλλον υπολογιστή στο δίκτυό σας:
```
http://YOUR_SERVER_IP:9002
```

### 6. Ελέγξτε τη χρήση πόρων

```bash
# Monitor CPU usage
htop

# Monitor GPU usage (if OpenCL/CUDA enabled)
nvidia-smi  # For NVIDIA
radeontop   # For AMD

# Monitor network usage
iftop
```

### 7. Σταματήστε τον διακομιστή

Ο διακομιστής εκτελείται στο παρασκήνιο υπό watchdog, οπότε **το Ctrl+C δεν θα τον σταματήσει** (και ο watchdog θα τον επανεκκινούσε). Χρησιμοποιήστε το κοινό σενάριο τερματισμού, που λειτουργεί για κάθε δέκτη — σταματά πρώτα τον watchdog και έπειτα τον δέκτη και τον `spectrumserver`:

```bash
./stop-websdr.sh
```

---

## Ρύθμιση αυτόματης εκκίνησης

### Με systemd (συνιστάται)

#### 1. Δημιουργήστε το αρχείο υπηρεσίας

```bash
sudo nano /etc/systemd/system/phantomsdr.service
```

Προσθέστε το ακόλουθο περιεχόμενο (προσαρμόστε διαδρομές και χρήστη):

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

> Η διεργασία `--watchdog` ήδη επανεκκινεί μόνη της τον δέκτη και τον `spectrumserver`· το `Restart=always` είναι απλώς δίχτυ ασφαλείας για τη σπάνια περίπτωση που τερματιστεί ο ίδιος ο watchdog. Επειδή εδώ ο διακομιστής εποπτεύεται από το systemd, μπορείτε να χρησιμοποιείτε `systemctl start/stop/restart` και `journalctl -u phantomsdr -f` αντί να εκτελείτε τα σενάρια με το χέρι.

#### 2. Ενεργοποιήστε και εκκινήστε την υπηρεσία

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

#### 3. Διαχειριστείτε την υπηρεσία

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

### Με Screen (εναλλακτικά)

> Συνήθως περιττό: το `./start-rtl.sh` ήδη αποσυνδέεται στο παρασκήνιο (μέσω `setsid`) και συνεχίζει να εκτελείται μετά την αποσύνδεσή σας, με δικό του watchdog. Το Screen είναι χρήσιμο μόνο αν θέλετε συγκεκριμένα διαδραστική συνεδρία για την εκτέλεση της μορφής προσκηνίου `./start-rtl.sh --watchdog`.

#### 1. Εγκαταστήστε το Screen

```bash
sudo apt install -y screen
```

#### 2. Εκκινήστε σε συνεδρία Screen

```bash
screen -S phantomsdr
./start-rtl.sh
```

Πατήστε Ctrl+A και έπειτα D για αποσύνδεση.

#### 3. Επανασυνδεθείτε στη συνεδρία

```bash
screen -r phantomsdr
```

---

## Θερμική προστασία CPU

> 📖 **Πλήρες εγχειρίδιο: [THERMAL_GUARD.md](THERMAL_GUARD.md)** — οι τέσσερις λειτουργίες και τι πρέπει να κάνει ο διαχειριστής σε καθεμία, λειτουργία χωρίς τον πίνακα, το στάδιο throttle χωρίς root, δοκιμές και επίλυση προβλημάτων.

Το PhantomSDR-Plus περιλαμβάνει μια προστασία που σταματά τον διακομιστή αν η CPU φτάσει σε επικίνδυνη θερμοκρασία και τον ξεκινά ξανά μόλις κρυώσει. Τα όριά της προκύπτουν από το κρίσιμο όριο που δημοσιεύει η ίδια σας η CPU, οπότε δεν έχετε τίποτα να υπολογίσετε, και λειτουργεί με όποιον τρόπο εκκίνησης/διακοπής κι αν χρησιμοποιείτε.

**Αν χρησιμοποιείτε τον πίνακα διαχείρισης, την έχετε ήδη** — τρέχει μέσα στον πίνακα και ρυθμίζεται από τη σελίδα «Ρυθμίσεις». Δείτε τον [οδηγό του πίνακα διαχείρισης](ADMIN_PANEL_SETUP.md#thermal-guard). Η υπόλοιπη ενότητα αφορά εγκαταστάσεις **χωρίς** τον πίνακα.

### 1. Δείτε τι βλέπει η προστασία στο μηχάνημά σας

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

Χρησιμοποιούνται μόνο πραγματικοί αισθητήρες της CPU (`coretemp`, `k10temp`, `zenpower`, `cpu_thermal`)· οι `acpitz` και οι μη επισημασμένες θερμικές ζώνες αγνοούνται σκόπιμα, γιατί συχνά αναφέρουν θερμοκρασία κουτιού ή πλακέτας δεκάδες βαθμούς κάτω από τη CPU. Αν εμφανιστεί `sensor : NONE`, το μηχάνημα δεν μπορεί να προστατευθεί — συνηθισμένο σε VPS ή μέσα σε container — και η προστασία μένει ανενεργή αντί να προσποιείται.

Δεν χρειάζεται να εγκαταστήσετε τίποτα: το `thermal_guard.py` χρησιμοποιεί μόνο τη standard library της Python.

### 2. Ρυθμίστε την

Η προστασία διαβάζει το `admin_config.json` δίπλα στο `thermal_guard.py`. Δημιουργήστε το αν δεν έχετε — χωρίς τον πίνακα δεν θα έχετε. Το ελάχιστο χρήσιμο αρχείο:

```json
{
  "sdr_process_name": "spectrumserver",
  "stop_script":  "stop-websdr.sh",
  "start_script": "start-rx888mk2.sh",
  "thermal_mode": "stop+restart"
}
```

- `thermal_mode` — `log` (μόνο καταγραφή, η προεπιλογή), `throttle`, `stop` ή `stop+restart`. **Αυτό είναι που πρέπει οπωσδήποτε να ορίσετε**, γιατί η προστασία έρχεται αδρανής: αν την αφήσετε ως έχει, μόνο γράφει τι *θα* έκανε. Μπορείτε επίσης να το δώσετε στη γραμμή εντολών ως `--mode stop+restart`, που υπερισχύει του αρχείου — αν σας βολεύουν όλες οι υπόλοιπες προεπιλογές, δεν χρειάζεστε καθόλου αρχείο ρυθμίσεων.
- `stop_script` / `start_script` — πώς σταματά και ξεκινά τον διακομιστή σας. Χωρίς σενάριο διακοπής καταφεύγει σε `SIGTERM` και μετά από 10 δευτερόλεπτα σε `SIGKILL` προς το `sdr_process_name`. Χωρίς σενάριο εκκίνησης σταματά αλλά δεν επανεκκινεί ποτέ.
- Τα όρια και οι χρόνοι μπορούν επίσης να μπουν εδώ, με τα ίδια ονόματα κλειδιών που χρησιμοποιεί ο πίνακας — ο πλήρης πίνακας βρίσκεται στον [οδηγό του πίνακα διαχείρισης](ADMIN_PANEL_SETUP.md#thermal-guard).

> **Αν τον διακομιστή SDR τον επιβλέπει το systemd**, βάλτε το `stop_script` να δείχνει σε ένα μικρό σενάριο που εκτελεί `systemctl stop τη-μονάδα-σας`, αντί να αφήσετε την προστασία να στείλει σήμα απευθείας στη διεργασία. Η προστασία θα κερδίσει έτσι κι αλλιώς — όσο η CPU είναι πολύ ζεστή επαναλαμβάνει τη διακοπή κάθε 2 δευτερόλεπτα, οπότε ό,τι επαναφέρει τον διακομιστή αναιρείται — αλλά μια καθαρή διακοπή είναι προτιμότερη από μια διαμάχη κάθε δύο δευτερόλεπτα.

### 3. Τρέξτε την ως υπηρεσία

Το αποθετήριο περιλαμβάνει έτοιμη μονάδα, το `thermal-guard.service`. Αλλάξτε μέσα το `User=` και τις δύο διαδρομές και μετά:

```bash
sudo cp thermal-guard.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now thermal-guard
systemctl status thermal-guard
```

Το `User=` πρέπει να είναι λογαριασμός που επιτρέπεται να εκτελεί τα σενάρια εκκίνησης/διακοπής σας — κανονικά ο ίδιος χρήστης που τρέχει τον διακομιστή SDR. **Μια προστασία που τρέχει ως χρήστης που δεν μπορεί να σταματήσει τον διακομιστή σας αφήνει απροστάτευτους, ενώ δείχνει ότι σας προστατεύει.**

Για να οπλίσετε την προστασία από τη μονάδα αντί για το αρχείο ρυθμίσεων, προσθέστε το `--mode` στο `ExecStart`:

```ini
ExecStart=/usr/bin/python3 -u /home/sysop/PhantomSDR-Plus/thermal_guard.py --mode stop+restart
```

Χωρίς systemd:

```bash
cd ~/PhantomSDR-Plus
nohup python3 -u thermal_guard.py --mode stop+restart >> thermal.log 2>&1 &
```

Το `python3 thermal_guard.py --help` δείχνει όλες τις επιλογές, μαζί με το `--config` για αρχείο ρυθμίσεων αλλού και όχι δίπλα στο σενάριο.

### 4. Παρακολουθήστε την και μετά εμπιστευτείτε την

Ό,τι κάνει η προστασία γράφεται στο `crash.log` μέσα στον φάκελο PhantomSDR-Plus, ένα συμβάν ανά γραμμή:

```
[THERMAL] warn: 89.0C (warn=88.0 crit=100.0) sustained 31s
[THERMAL] STOPPED server: 96.0C sustained 62s (stop=95.0 crit=100.0) — Started stop-websdr.sh
[THERMAL] lockout: process reappeared at 94.0C — re-stopped [3 time(s) so far]
[THERMAL] recovered: 74.0C held below 75.0 — lockout cleared
```

```bash
grep THERMAL crash.log
```

Αφήστε πρώτα το `thermal_mode` στο `"log"` για μια εβδομάδα και διαβάστε το αρχείο μετά τις βαριές σας στιγμές — μια πλήρη μεταγλώττιση, ένα ζεστό απόγευμα. Αν δεν εμφανιστεί τίποτα, το μηχάνημά σας δεν πλησίασε ποτέ. Μετά βάλτε τη λειτουργία σε `stop`.

Πριν βασιστείτε σε αυτήν, επιβεβαιώστε όλη τη διαδρομή μία φορά με μια πλασματική ένδειξη πάνω από το όριο διακοπής σας:

```json
"thermal_test_temp": 97
```

Η προστασία τη θεωρεί πραγματική, οπότε τρέχουν κατά παραγγελία τα warn → stop → κλείδωμα → επάνοδος → επανεκκίνηση. Αφαιρέστε τη γραμμή (ή βάλτε την σε `null`) για να επιστρέψετε στον πραγματικό αισθητήρα. Με τη λειτουργία στο `stop` ο διακομιστής όντως σταματά και οι ακροατές σας αποσυνδέονται, οπότε κάντε το όταν δεν υπάρχει κόσμος — ή δοκιμάστε στο `log`, όπου φαίνεται τι *θα* γινόταν χωρίς να αγγίξετε τίποτα.

---

## Αντιμετώπιση προβλημάτων

### Σφάλματα μεταγλώττισης

#### Ζητήματα εξαρτήσεων

```bash
# Ubuntu: Install missing dependencies
sudo apt install --fix-broken

# Fedora: Install missing dependencies
sudo dnf install <package-name>
```

#### Αποτυχία ρύθμισης του Meson

```bash
# Clean and reconfigure
rm -rf build
meson setup build --buildtype=release
```

#### Το `meson setup` τερματίζει με `ModuleNotFoundError: No module named 'mesonbuild'`

```
Traceback (most recent call last):
  File "/home/<user>/.local/bin/meson", line 3, in <module>
    from mesonbuild.mesonmain import main
ModuleNotFoundError: No module named 'mesonbuild'
```

Δεν φταίει ο πηγαίος κώδικας. Μια παλιά εγκατάσταση με `pip install --user meson` άφησε ένα σενάριο εκκίνησης στο `~/.local/bin`, το οποίο στο `PATH` προηγείται του
`/usr/bin` και έτσι κρύβει το αντίγραφο που εγκατέστησε ο διαχειριστής πακέτων.
Μια αναβάθμιση διανομής (π.χ. Ubuntu 24.04 → 26.04) μεταφέρει την Python σε νέα έκδοση, το παλιό `site-packages` που είχε το `mesonbuild` δεν βρίσκεται πλέον στη διαδρομή εισαγωγής, και το σενάριο τερματίζει πριν κάνει οτιδήποτε. Το ίδιο μπορεί να συμβεί και στο `ninja`.

Ο εγκαταστάτης το εντοπίζει και το παρακάμπτει για όσο διαρκεί η εκτέλεση, εμφανίζοντας προειδοποίηση, αλλά επιδιορθώστε το σύστημα:

```bash
rm -f ~/.local/bin/meson
hash -r
meson --version        # πρέπει να τυπώσει έκδοση
```

Αν προτιμάτε να κρατήσετε το meson εγκατεστημένο μέσω pip, εγκαταστήστε το ξανά για την Python που έχει τώρα το σύστημα:

```bash
python3 -m pip install --user --force-reinstall --break-system-packages meson
```

#### Το `meson setup` σταματά με `Clock skew detected`

```
ERROR: Clock skew detected. File /home/pi/PhantomSDR-Plus/build/../meson.build has a time stamp 10392.2144s in the future.
```

Δεν υπάρχει κανένα πρόβλημα στον κώδικα: το ρολόι του συστήματος πάει πίσω σε σχέση με τα αρχεία. Το meson και το ninja αρνούνται να χτίσουν όταν ένα αρχείο εισόδου είναι νεότερο από την τρέχουσα ώρα, γιατί δεν μπορούν να ξέρουν τι είναι παλιό. Συμβαίνει σε Raspberry Pi χωρίς μπαταρία στην υποδοχή RTC — κάθε εκκίνηση ξεκινά από την τελευταία γνωστή ώρα, και ένα χτίσιμο πριν συγχρονιστεί το NTP βλέπει όλο το δέντρο με ημερομηνία στο μέλλον — καθώς και σε δέντρο που αποσυμπιέστηκε ή αντιγράφηκε από μηχάνημα που πάει μπροστά.

Διορθώστε πρώτα το ρολόι:

```bash
timedatectl                       # είναι σωστή η ώρα; είναι συγχρονισμένο το NTP;
sudo timedatectl set-ntp true
```

Περιμένετε λίγα δευτερόλεπτα και τρέξτε ξανά τον installer. Το ελέγχει πριν καλέσει το meson και προσφέρεται να επαναφέρει τις χρονοσημάνσεις (`PHANTOM_FIX_CLOCK_SKEW=y|n`). Με το χέρι, μέσα από τον φάκελο του κώδικα:

```bash
find . -path ./build -prune -o -path ./.git -prune -o -newermt now -print0 | xargs -0r touch
```

#### Το backend χτίστηκε αλλά δεν υπάρχει ιστοσελίδα

Το σύμπτωμα είναι μια εγκατάσταση που μοιάζει να πέτυχε σχεδόν ολόκληρη: το `build/spectrumserver` υπάρχει, ο διακομιστής ξεκινά, και ο φυλλομετρητής δεν παίρνει τίποτα — επειδή ο κατάλογος `frontend/dist/` δεν παρήχθη ποτέ. Ψάξτε στην έξοδο του προγράμματος εγκατάστασης για:

```
[vite-plugin-top-level-await] missing field `type`
    at Compiler.printSync (node_modules/@swc/core/index.js:257:29)
error during build:
   ❌ Failed: Default
```

Το `vite-plugin-top-level-await` ζητά `@swc/core` `^1.12.14`, οπότε μια καθαρή `npm install` καταλήγει στην 1.16.0, της οποίας η `printSync()` απορρίπτει το συντακτικό δέντρο που της δίνει το πρόσθετο. Δεν έχει καμία σχέση με τη διανομή σας — κάθε πρόγραμμα εγκατάστασης πλέον καρφώνει την έκδοση που δουλεύει, όπως και το `frontend/package.json`. Ένα μηχάνημα που εγκαταστάθηκε πριν προστεθεί αυτό το κάρφωμα συνεχίζει να δουλεύει μέχρι να διαγραφεί ο κατάλογος `node_modules` του — γι' αυτό εμφανίζεται από το πουθενά σε μια επανεγκατάσταση.

Αν επιδιορθώνετε παλαιότερο αντίγραφο με το χέρι:

```bash
cd frontend
npm pkg set 'overrides.@swc/core=1.15.33'
npm install
./build-all.sh
```

### Σφάλματα εκτέλεσης

#### Η θύρα χρησιμοποιείται ήδη

```bash
# Find process using port
sudo lsof -i :9002

# Kill process
sudo kill -9 <PID>
```

#### Άρνηση πρόσβασης στο SDR

```bash
# Add user to plugdev group
sudo usermod -a -G plugdev $USER

# Reload groups (or log out and back in)
newgrp plugdev
```

Για ένα **RX-888 MkII** αυτό από μόνο του δεν αρκεί — η συσκευή Cypress FX3 χρειάζεται επίσης κανόνες udev. Εκτελέστε το συνοδευτικό βοηθητικό σενάριο (εγκαθιστά τους κανόνες *και* σας προσθέτει στην `plugdev`), έπειτα αποσυνδεθείτε/συνδεθείτε και επανασυνδέστε τη συσκευή:

```bash
./setup-rx888-udev.sh
```

#### Προβλήματα ήχου

```bash
# Try different codec
# Edit config file and change:
audio_compression = "flac"  # or "opus"

# Rebuild
cd frontend && npm run build && cd ..
```

### Προβλήματα OpenCL

#### Το clinfo δεν δείχνει συσκευές

```bash
# Verify drivers are loaded
sudo clinfo

# Check OpenCL ICD files
ls /etc/OpenCL/vendors/

# Reinstall drivers (Intel example)
sudo apt remove --purge intel-opencl-icd
sudo apt install intel-opencl-icd
```

#### Δεν βελτιώθηκαν οι επιδόσεις

```bash
# Verify OpenCL is enabled in config
accelerator = "opencl"

# Try different device
# Add to config file:
[input.opencl]
device_id = 0  # Try 0, 1, 2, etc.
```

### Προβλήματα δικτύου

#### Δεν υπάρχει πρόσβαση από άλλες συσκευές

```bash
# Check firewall
sudo ufw status
sudo ufw allow 9002/tcp

# Or disable firewall temporarily for testing
sudo ufw disable
```

#### Υψηλή καθυστέρηση

```bash
# Reduce waterfall size in config
waterfall_size = 512

# Increase buffer size
buffer_size = 16384

# Use Opus instead of FLAC
audio_compression = "opus"
```

### Προβλήματα συσκευής SDR

#### Δεν βρέθηκε το RTL-SDR

```bash
# Check if device is recognized
lsusb | grep Realtek

# Test with rtl_test
rtl_test

# Try blacklisting DVB-T drivers
echo "blacklist dvb_usb_rtl28xxu" | sudo tee /etc/modprobe.d/blacklist-rtl.conf
sudo rmmod dvb_usb_rtl28xxu
```

#### Δεν βρέθηκε το SDRplay

Το `grep "RSP1A driver" logwebsdr.txt` δείχνει ποιον driver διάλεξε το `start-rsp1a.sh`.

Με τον ανοιχτό driver (libmirisdr-5, `RSP1A driver: miri`):

```bash
# The kernel's msi2500 driver must not hold the device
lsmod | grep msi2500 && sudo modprobe -r msi2500 msi001

# Test with SoapySDR
SoapySDRUtil --find="driver=soapyMiri"
```

Με το API της SDRplay (`RSP1A driver: sdrplay`):

```bash
# Check API installation
systemctl status sdrplay

# Restart API
sudo systemctl restart sdrplay

# Test with SoapySDR
SoapySDRUtil --find="driver=sdrplay"
```

#### Δεν βρέθηκε ο Fobos ή ο Airspy HF+

```bash
SoapySDRUtil --info | grep -i factories   # must list fobos / airspyhf
SoapySDRUtil --find="driver=fobos"         # or driver=airspyhf
id | grep plugdev                          # log out and back in if missing
```

Αν ο driver λείπει από τη λίστα, ξανατρέξτε το `./setup-fobos.sh` ή το `./setup-airspyhf.sh`: σταματά με την αιτία αν αποτύχει το χτίσιμο ή ο έλεγχος του SoapySDR.

---

## Βελτιστοποίηση επιδόσεων

### Βελτιστοποίηση CPU

```toml
# Adjust thread counts based on CPU cores
[server]
threads = 4  # Set to number of cores

[input]
fft_threads = 4  # Set to number of cores
```

### Βελτιστοποίηση μνήμης

```toml
# Reduce memory usage
[input]
waterfall_size = 512  # Lower value = less memory
fft_size = 65536      # Lower value = less memory
```

### Βελτιστοποίηση δικτύου

```toml
# Optimize for limited bandwidth
[input]
audio_compression = "opus"  # More efficient than FLAC
waterfall_compression = "zstd"  # Efficient compression
```

---

## Ενημέρωση του PhantomSDR-Plus

Από την έκδοση 4.1.0 το αποθετήριο περιλαμβάνει το **`update.sh`**, ένα εργαλείο που ενημερώνει μια εγκατεστημένη στάση με το δημοσιευμένο δέντρο αρχείων **χωρίς να αγγίζει τα αρχεία που την κάνουν δική σας στάση**. Αντικαθιστά το χειρόγραφο σενάριο με `git pull` που ζητούσαν οι προηγούμενες εκδόσεις αυτού του οδηγού, και δεν χρειάζεται καθόλου git: το δημοσιευμένο δέντρο κατεβαίνει ως tarball και συγκρίνεται με το δικό σας αρχείο προς αρχείο. Λειτουργεί λοιπόν το ίδιο είτε κλωνοποιήσατε το αποθετήριο, είτε αποσυμπιέσατε ένα
`update.zip`, είτε αντιγράψατε το δέντρο από ένα στικάκι USB.

### Αν η εγκατάστασή σας δεν έχει ακόμη το update.sh

Ένα παλαιότερο δέντρο δεν περιέχει το σενάριο. Κατεβάστε το μία φορά — είναι το μόνο βήμα όλης της διαδικασίας που κάνετε ποτέ με το χέρι:

```bash
cd ~/PhantomSDR-Plus
curl -fLO https://raw.githubusercontent.com/sv1btl/PhantomSDR-Plus/main/update.sh
chmod +x update.sh
```

Από εκεί και πέρα τα πάντα — πηγαίος κώδικας, frontend, τεκμηρίωση, εγκαταστάτες και το ίδιο το `update.sh` — έρχονται μέσω του εργαλείου.

### Βήμα 1 — δείτε τι θα άλλαζε (δεν γράφει τίποτα)

```bash
cd ~/PhantomSDR-Plus
./update.sh
```

Κατεβάζει το δημοσιευμένο δέντρο, το συγκρίνει με το δικό σας και τυπώνει αναφορά. Δεν γράφει απολύτως τίποτα, οπότε μπορείτε να το τρέξετε οποιαδήποτε στιγμή — ακόμη και με τον δέκτη στον αέρα. Ο κωδικός εξόδου είναι `0` όταν είστε ενημερωμένοι και `10` όταν υπάρχει ενημέρωση που περιμένει, ώστε μια εργασία cron να σας ειδοποιεί όταν υπάρχει κάτι να γίνει.

### Βήμα 2 — εφαρμόστε την

```bash
./update.sh --apply
```

Τρία είδη αρχείων αντιμετωπίζονται διαφορετικά, και ακριβώς σε αυτό έγκειται η αξία του:

| Αρχεία | Τι γίνεται |
|---|---|
| `config*.toml`, `markers.json`, `admin_config.json`, `autorun.json`, `frequencylist/`, `chat_history.txt`, `frontend/variant.json`, `frontend/site_information.json`, τα αρχεία καταγραφής, `build/`, `frontend/dist/` | **Δεν αγγίζονται ποτέ**, ούτε καν εμφανίζονται σε ερώτηση. Αυτά είναι που κάνουν το μηχάνημα *δικό σας* δέκτη. |
| `start-*.sh`, `stop-websdr.sh`, οι μονάδες `*.service`, `install*.sh`, `recompile.sh`, `setup_admin.sh`, `smeter_theme.sh`, `proxy.py`, `admin_server.py`, `thermal_guard.py`, `frontend/src/bands-config.js` | **Ρωτάει πάντα**, γιατί αυτά είναι τα αρχεία που ένας διαχειριστής έχει λόγο να έχει τροποποιήσει. |
| Όλα τα υπόλοιπα | Ενημερώνονται, αφού πρώτα σωθεί αντίγραφο του παλιού αρχείου στο `.update-backups/`. |

Για κάθε αρχείο της μεσαίας ομάδας βλέπετε τις διαφορές και έχετε τρεις επιλογές:

```
  ❓ start-rx888mk2.sh  [K]eep mine / [u]pstream / [b]oth  (ENTER = Keep mine)
```

* **Keep mine** — το δικό σας αρχείο μένει ακριβώς όπως είναι.
* **upstream** — εγκαθίσταται η νέα έκδοση, αφού πρώτα κρατηθεί αντίγραφο της δικής σας.
* **both** — η νέα έκδοση γράφεται δίπλα στη δική σας ως `start-rx888mk2.sh.new`, για να
ενσωματώσετε τις δικές σας αλλαγές με την ησυχία σας.

**Πώς είναι η πρώτη εκτέλεση.** Την πρώτη φορά δεν υπάρχει καταγραφή για το από ποια έκδοση
προήλθαν τα αρχεία σας, οπότε κάθε αρχείο της μεσαίας ομάδας τίθεται υπόψη σας — περίπου δέκα ερωτήσεις. Απαντήστε ως εξής:

| Η περίπτωσή σας | Απάντηση |
|---|---|
| Δεν πειράξατε ποτέ αυτό το αρχείο | `u` — πάρτε τη νέα έκδοση. Η συνηθισμένη περίπτωση. |
| Το πειράξατε (δικά σας `RX888_ARGS`, καρφίτσωμα CPU, τροποποιημένη μονάδα) | `b` — μένει το δικό σας και η νέα έκδοση μπαίνει δίπλα ως `<αρχείο>.new`. |
| Δεν είστε βέβαιοι | ENTER — μένει το δικό σας, δεν χάνεται τίποτα, συγκρίνετε αργότερα. |

Η διαμόρφωσή σας δεν εμπλέκεται ποτέ σε αυτό: οι ερωτήσεις αφορούν μόνο σενάρια και μονάδες υπηρεσιών.

Το `update.sh` καταγράφει στο `.update-state/` την έκδοση κάθε αρχείου που εγκαθιστά. Έτσι, από τη δεύτερη εκτέλεση και μετά ξεχωρίζει ένα αρχείο που **εσείς** αλλάξατε από ένα αρχείο που είναι απλώς παλιό, και σταματά να ρωτήσει μόνο για όσα πράγματι πειράξατε.

Πριν γράψει οτιδήποτε σταματά τον δέκτη, τον πίνακα διαχείρισης και τον αντίστροφο proxy **της εγκατάστασης που ενημερώνει** — ό,τι εξυπηρετεί άλλον κατάλογο αναφέρεται και αφήνεται να τρέχει, ώστε ένα δεύτερο αντίγραφο να ενημερώνεται όσο το πρώτο μένει στον αέρα — και στο τέλος ξεκινά ξανά ακριβώς ό,τι σταμάτησε. Αν άλλαξαν αρχεία πηγαίου κώδικα ή του frontend, προσφέρεται να τρέξει το `recompile.sh` για εσάς. Δεν διαγράφει ποτέ τίποτα: αρχεία που έχουν φύγει από το αποθετήριο απλώς αναφέρονται, και αφαιρούνται μόνο αν το ζητήσετε με `--prune`.

### Αναίρεση μιας ενημέρωσης

```bash
./update.sh --restore LAST
```

Κάθε αρχείο που αντικαταστάθηκε φυλάσσεται στο `.update-backups/<χρονοσήμανση>/` με δικό του
`restore.sh`· διατηρούνται οι τρεις τελευταίες εκτελέσεις.

### Άλλες επιλογές

```bash
./update.sh --apply --yes     # δεν ρωτά ποτέ· ό,τι έχετε αλλάξει ΔΙΑΤΗΡΕΙΤΑΙ
./update.sh --ref v4.1.0      # ετικέτα, κλάδος ή commit αντί για το τρέχον δέντρο
./update.sh --list-excludes   # τυπώνει τους κανόνες "μην αγγίζεις" όπως ισχύουν εδώ
./update.sh --verbose         # εμφανίζει όλα τα αρχεία, όχι μόνο τα πρώτα 40
```

Μπορείτε να προσθέσετε δικούς σας κανόνες "μην αγγίζεις" γράφοντας ένα μοτίβο ανά γραμμή στο
`update-exclude.txt`, στον ριζικό φάκελο της εγκατάστασης.

### Αν η ανακατασκευή αποτύχει σε πολύ παλιά εγκατάσταση

Το `update.sh` ενημερώνει αρχεία, όχι πακέτα του συστήματος. Αν το δέντρο σας είναι τόσο παλιό ώστε η μεταγλώττιση να χρειάζεται πλέον βιβλιοθήκες που δεν έχετε, το `recompile.sh` θα σταματήσει με σφάλμα μεταγλωττιστή ή meson. Δεν είναι χαλασμένη ενημέρωση — λείπουν οι εξαρτήσεις:

```bash
./install.sh
```

Ο εγκαταστάτης ενημερώνεται από την ίδια εκτέλεση, και η διαμόρφωσή σας επιβιώνει και από αυτόν.

### Ενημέρωση με το χέρι

Αν προτιμάτε να εφαρμόσετε μόνοι σας ένα πακέτο αρχείων:

```bash
cd ~
unzip -o update.zip
cd PhantomSDR-Plus
./stop-websdr.sh
cp -a ~/update/. .
chmod +x *.sh
./recompile.sh
./start-rx888mk2.sh          # ή το σενάριο εκκίνησης του δικού σας δέκτη
```

Κρατήστε πρώτα αντίγραφο της διαμόρφωσής σας — `config-*.toml`,
`frontend/site_information.json`, `admin_config.json` και `markers.json` — γιατί ένα πακέτο
αρχείων δεν μπορεί να ξεχωρίσει τις δικές σας αλλαγές από εκείνες της έκδοσης. Ακριβώς αυτό το πρόβλημα λύνει το `update.sh`.

---

## Αντίγραφα ασφαλείας και επαναφορά

### Αρχεία προς αντιγραφή

- Αρχεία ρυθμίσεων: `*.toml`
- Πληροφορίες σταθμού: `frontend/site_information.json`
- Δείκτες: `markers.json`
- Προσαρμοσμένα σενάρια: `start-*.sh`, `stop-*.sh`
- Ιστορικό συνομιλίας: `chat_history.txt`
- Εικόνα φόντου: `frontend/src/assets/background.jpg`

### Εντολή αντιγραφής

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

### Εντολή επαναφοράς

```bash
tar -xzf phantomsdr-backup-YYYYMMDD.tar.gz
```

---

## Θέματα ασφάλειας

### Ρύθμιση τείχους προστασίας

```bash
# Allow only necessary ports
sudo ufw allow 9002/tcp
sudo ufw enable
```

### Αντίστροφος διαμεσολαβητής (προαιρετικά)

Εξετάστε τη χρήση nginx ή Apache ως αντίστροφου διαμεσολαβητή για:
- κρυπτογράφηση SSL/TLS
- αντιστοίχιση ονόματος τομέα
- εξισορρόπηση φορτίου
- έλεγχο πρόσβασης

### Όρια χρηστών

Επεξεργαστείτε το `config.toml`:
```toml
[server]
max_users = 100  # Limit concurrent users
```

---

## Λήψη βοήθειας

### Πόροι

- **Τεκμηρίωση**: αυτός ο οδηγός, README.md, USER_GUIDE.md
- **GitHub Issues**: https://github.com/sv1btl/PhantomSDR-Plus/issues
- **Ζωντανή επίδειξη**: http://phantomsdr.no-ip.org:8900/

### Αναφορά προβλημάτων

Όταν αναφέρετε προβλήματα, περιλάβετε:
1. Λειτουργικό σύστημα και έκδοση
2. Μοντέλο συσκευής SDR
3. Περιεχόμενο του αρχείου ρυθμίσεων
4. Μηνύματα σφάλματος
5. Χρήση πόρων συστήματος (CPU, RAM, GPU)

### Υποστήριξη από την κοινότητα

- Ελέγξτε τα υπάρχοντα GitHub issues πριν δημιουργήσετε νέα
- Δώστε αναλυτικές πληροφορίες για την εγκατάστασή σας
- Συμπεριλάβετε αρχεία καταγραφής και μηνύματα σφάλματος
- Δείξτε υπομονή και σεβασμό

---

## Παράρτημα Α: πλήρης κατάλογος εξαρτήσεων

### Κατάλογος πακέτων Ubuntu 24.04

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

## Παράρτημα Β: παραδείγματα ρυθμίσεων

### Παράδειγμα 1: RTL-SDR για VHF/UHF

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

### Παράδειγμα 2: RX-888 mk2 για HF (0-30 MHz)

Ο δέκτης που χρησιμοποιούν οι περισσότεροι sysop. Εδώ δίνεται ολόκληρη η ενότητα `[input]`, όχι απόσπασμα, με τις τιμές του `config-rx888mk2.toml` που συνοδεύει το αποθετήριο.

```toml
[input]
sps = 60000000            # 0-30 MHz με απευθείας δειγματοληψία
fft_size = 4194304        # δείτε τη σημείωση παρακάτω
fft_threads = 8
brightness_offset = -9    # πιο αρνητικό αν ο καταρράκτης δείχνει μαύρες περιοχές
frequency = 0             # βασική ζώνη: ο RX-888 δειγματοληπτεί από DC
signal = "real"           # όχι "iq" - η απευθείας δειγματοληψία δίνει πραγματικό σήμα
accelerator = "opencl"    # "none" αν δεν υπάρχει περιβάλλον OpenCL
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

Τροφοδοτείται από το `rx888_stream`, κάτι που κάνει για εσάς το `start-rx888mk2.sh`:

```bash
rx888_stream -f /path/to/SDDC_FX3.img -s 60000000 -g 50 -a 0 -m low --pga -d -r -o - \
  | build/spectrumserver --config config-rx888mk2.toml
```

**Για το `fft_size`:** στα 60 MSPS το σωστό μέγεθος είναι 4194304. Το 8388608 διπλασιάζει την ανάλυση του καταρράκτη και μαζί της τη μνήμη και το κόστος CPU κάθε μετασχηματισμού· στα περισσότερα μηχανήματα αγοράζει οξύτερα bin με τίμημα χαμένα καρέ. Ξεκινήστε από 4194304 και ανεβείτε μόνο αν ο διακομιστής έχει άνετο περιθώριο.

### Παράδειγμα 3: HackRF για ευρυζωνικό FM

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

**Η εγκατάσταση ολοκληρώθηκε! Θα πρέπει τώρα να έχετε πλήρως λειτουργικό διακομιστή PhantomSDR-Plus.**

**73 de SV1BTL & SV2AMK**
