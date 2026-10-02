# RADE v1 — Οδηγός χειροκίνητης εγκατάστασης
### Raspberry Pi / Debian Bookworm (ARM64) · PhantomSDR-Plus

> **Προϋπόθεση:** τα διορθωμένα αρχεία (`rade_helper.py`, `rade.sh`, `audio.js`, το `App.svelte`) βρίσκονται ήδη στο δέντρο καταλόγων του PhantomSDR-Plus. Ο οδηγός αυτός χτίζει τα υπόλοιπα γύρω από αυτά.

> [!IMPORTANT]
> **Δοκιμάστε πρώτα το script.** Το `./install_rade.sh` στον φάκελο PhantomSDR-Plus κάνει για εσάς κάθε βήμα που ακολουθεί και προσφέρεται από το `./install.sh` κατά την κανονική εγκατάσταση. Αυτός ο οδηγός υπάρχει για την εγκατάσταση με το χέρι, και για τις ιδιαιτερότητες του Pi (PEP 668 και το torch wheel μόνο για CPU) αν το script συναντήσει πρόβλημα στη δική σας πλακέτα.

---

## Βήμα 1 — Πακέτα συστήματος

```bash
sudo apt update
sudo apt install -y \
    build-essential cmake git \
    python3 python3-pip \
    nodejs npm \
    alsa-utils
```

---

## Βήμα 2 — Πακέτα Python

> **Σημαντικό — δύο κανόνες του Debian Bookworm:**
>
> 1. Κάθε `pip3 install` απαιτεί `--break-system-packages` (εφαρμογή του
> PEP 668). Χωρίς αυτό η εγκατάσταση μπλοκάρεται εντελώς.
> 2. Ένα σκέτο `pip3 install torch` κατεβάζει την έκδοση CUDA (~3 GB).
> Σε ένα Pi δεν υπάρχει CUDA — χρησιμοποιήστε το ευρετήριο μόνο για CPU ώστε να λάβετε την ελαφριά έκδοση ARM64 (~150 MB).

```bash
# All packages except torch
pip3 install --break-system-packages websockets matplotlib numpy scipy

# torch — CPU-only build (~150 MB, no CUDA)
pip3 install --break-system-packages torch \
    --index-url https://download.pytorch.org/whl/cpu
```

### Επαλήθευση

```bash
python3 -c "import websockets, matplotlib, torch, numpy, scipy; print('All OK')"
```

Αναμενόμενη έξοδος:
```
All OK
```

---

## Βήμα 3 — Κλωνοποιήστε και μεταγλωττίστε το αποθετήριο radae

Ο αποκωδικοποιητής RADE βρίσκεται σε ξεχωριστό αποθετήριο από το codec2. Το `freedv_rx` του codec2 **δεν** υποστηρίζει RADE v1.

```bash
# Remove any previous incomplete clone
rm -rf ~/radae

# Clone
git clone https://github.com/drowe67/radae.git ~/radae
cd ~/radae

# Build
mkdir build && cd build
cmake ..
make -j$(nproc)
```

### Επαληθεύστε ότι μεταγλωττίστηκε το lpcnet_demo

```bash
ls -la ~/radae/build/src/lpcnet_demo
```

Αναμενόμενο: το εκτελέσιμο υπάρχει και είναι εκτελέσιμο.

### Επαληθεύστε ότι υπάρχουν τα βάρη του μοντέλου

```bash
ls ~/radae/model19_check3/checkpoints/checkpoint_epoch_100.pth
```

Αναμενόμενο: εμφανίζεται το αρχείο `.pth`. Τα βάρη συνοδεύουν το αποθετήριο — δεν απαιτείται ξεχωριστή λήψη.

---

## Βήμα 4 — Επαληθεύστε την αλυσίδα αποκωδικοποίησης

Το βήμα αυτό επιβεβαιώνει ότι η πλήρης αλυσίδα εκτός σύνδεσης λειτουργεί πριν τη συνδέσετε με τον περιηγητή. Εκτελέστε από το `~/radae`:

```bash
cd ~/radae
```

### 4α — Δημιουργήστε δοκιμαστικό σήμα κωδικοποιημένο σε RADE

```bash
./inference.sh model19_check3/checkpoints/checkpoint_epoch_100.pth \
    wav/brian_g8sez.wav /dev/null \
    --rate_Fs --pilots --pilot_eq --eq_ls --cp 0.004 \
    --write_rx rx.f32 --auxdata
```

Περιμένετε να ολοκληρωθεί. Οι τελευταίες γραμμές που εμφανίζονται πρέπει να είναι:
```
loss: 0.741 Auxdata BER: 0.012
```

### 4β — Αποκωδικοποιήστε και αναπαράγετε

```bash
cat rx.f32 \
    | python3 radae_rxe.py \
        --model_name model19_check3/checkpoints/checkpoint_epoch_100.pth \
    | ./build/src/lpcnet_demo -fargan-synthesis - - \
    | aplay -f S16_LE -r 16000
```

Θα πρέπει να ακούσετε φωνή. Η έξοδος δείχνει την απόκτηση συγχρονισμού:
```
  1 state: search     ...
  5 state: sync       ... SNRdB:  4.03 uw_err: 0
Playing raw data 'stdin' : Signed 16 bit Little Endian, Rate 16000 Hz, Mono
```

> **Τα μηνύματα `underrun!!!` σε αυτή τη δοκιμή είναι αναμενόμενα και ακίνδυνα.** Το `radae_rxe.py` επεξεργάζεται πιο αργά από την είσοδο/έξοδο του αρχείου. Δεν εμφανίζονται σε ζωντανή λήψη, γιατί ο περιηγητής τροφοδοτεί τον ήχο σε πραγματικό χρόνο.

### 4γ — Επαληθεύστε ότι ξεκινά σωστά ο sidecar

```bash
python3 ~/PhantomSDR-Plus/rade_helper.py
```

Αναμενόμενη έξοδος (χωρίς γραμμές WARNING):
```
[RADE] helper starting on ws://0.0.0.0:8074
[RADE] radae_rx.py    : /home/pi/radae/radae_rxe.py
[RADE] model          : /home/pi/radae/model19_check3/checkpoints/checkpoint_epoch_100.pth
[RADE] lpcnet_demo    : /home/pi/radae/build/src/lpcnet_demo
[RADE] auxdata        : ON (default)
[RADE] torch threads  : 1 per instance (RADE_TORCH_THREADS to override)
[RADE] architecture   : per-connection (each user tunes independently)
[RADE] listening — waiting for PhantomSDR-Plus clients
```

Πατήστε **Ctrl+C** για διακοπή.

---

## Βήμα 5 — Μεταγλωττίστε το frontend του PhantomSDR-Plus

```bash
cd ~/PhantomSDR-Plus/frontend

# Only if node_modules is missing:
npm install

cd ~/PhantomSDR-Plus
./recompile.sh
```

Προσέξτε για σφάλματα του αναλυτή Vite/acorn. Τα διορθωμένα αρχεία αποφεύγουν σκόπιμα τα `?.`, `??` και τα σκέτα `catch {}`, ώστε να συμμορφώνονται με τον περιορισμό του acorn.

---

## Βήμα 6 — Σενάριο ελέγχου rade.sh

```bash
chmod +x ~/PhantomSDR-Plus/rade.sh
```

Διαθέσιμες εντολές:

```bash
cd ~/PhantomSDR-Plus
./rade.sh start      # start sidecar with self-restarting watchdog
./rade.sh stop       # stop sidecar + watchdog + all lpcnet_demo children
./rade.sh restart    # stop then start cleanly
./rade.sh status     # show running / stopped + process info
```

> **Χρησιμοποιείτε πάντα `./rade.sh stop`** — ένα σκέτο `pkill -f rade_helper.py` δεν νικά τον watchdog, ο οποίος επανεκκινεί τη διεργασία μέσα σε 3 δευτερόλεπτα.

---

## Βήμα 7 — Ανοίξτε τη θύρα 8074

Ο sidecar ακούει στη θύρα TCP **8074**. Ο περιηγητής συνδέεται απευθείας σε αυτή τη θύρα. Πρέπει να την ανοίξετε χειροκίνητα:

### Τείχος προστασίας — ufw

```bash
sudo ufw allow 8074/tcp && sudo ufw reload
```

### Τείχος προστασίας — iptables

```bash
sudo iptables -I INPUT -p tcp --dport 8074 -j ACCEPT

# Make permanent across reboots:
sudo apt install iptables-persistent
sudo netfilter-persistent save
```

### Δρομολογητής

Προσθέστε κανόνα NAT/προώθησης θύρας: **TCP 8074 → τοπική IP διακομιστή : 8074**

### Δοκιμή από έξω

Χρησιμοποιήστε το **https://portchecker.co** και ελέγξτε τη θύρα 8074 στο δημόσιο όνομα κεντρικού υπολογιστή σας. **Μη** δοκιμάζετε με `curl` από τον ίδιο τον διακομιστή — το NAT hairpin δίνει ψευδή αποτελέσματα «Connection refused» ακόμη και όταν η θύρα είναι ανοιχτή.

### Εναλλακτικά — διαμεσολαβητής Nginx (αν η θύρα 8074 φράσσεται από τον πάροχο)

Προσθέστε μέσα στο υπάρχον μπλοκ `server {}`:

```nginx
location /rade {
    proxy_pass         http://127.0.0.1:8074;
    proxy_http_version 1.1;
    proxy_set_header   Upgrade    $http_upgrade;
    proxy_set_header   Connection "upgrade";
    proxy_set_header   Host       $host;
    proxy_read_timeout 3600s;
}
```

```bash
sudo nginx -t && sudo nginx -s reload
```

Έπειτα επεξεργαστείτε το `audio.js` μέσα στη `setRADEDecoding()`:

```js
// Change:
var helperUri = uri || ('ws://' + window.location.hostname + ':8074');
// To:
var helperUri = uri || ('ws://' + window.location.host + '/rade');
```

Μεταγλωττίστε ξανά το frontend μετά από αυτή την αλλαγή.

---

## Βήμα 8 — Εκκινήστε τον διακομιστή

Εκκινήστε το PhantomSDR-Plus ως συνήθως. Το RADE **δεν** ξεκινά αυτόματα:

```bash
cd ~/PhantomSDR-Plus
./start-rx888mk2.sh      # or start-airspyhf.sh,
                         # start-rtl.sh, start-rsp1a.sh
```

Χρησιμοποιήστε τον εκκινητή που αντιστοιχεί στον δέκτη σας. Καθένας περιλαμβάνει δικό του watchdog και αρχείο καταγραφής· το `./stop-websdr.sh` σταματά όποιον εκτελείται.

---

## Βήμα 9 — Εκκινήστε το RADE

```bash
cd ~/PhantomSDR-Plus
./rade.sh start
./rade.sh status
tail -f rade.log
```

Αναμενόμενη καταγραφή:
```
[RADE] sidecar starting at ...
[RADE] helper starting on ws://0.0.0.0:8074
[RADE] radae_rx.py    : /home/pi/radae/radae_rxe.py
[RADE] model          : /home/pi/radae/model19_check3/checkpoints/checkpoint_epoch_100.pth
[RADE] lpcnet_demo    : /home/pi/radae/build/src/lpcnet_demo
[RADE] auxdata        : ON (default)
[RADE] torch threads  : 1 per instance
[RADE] architecture   : per-connection (each user tunes independently)
[RADE] listening — waiting for PhantomSDR-Plus clients
```

---

## Βήμα 10 — Χρήση του RADE στον περιηγητή

1. Ανοίξτε τη διεπαφή web του PhantomSDR-Plus
2. Βρείτε ενεργούς σταθμούς στο **https://qso.freedv.org**
3. Συντονιστείτε στη συχνότητα ένδειξης του σταθμού
4. Στις **Decoder Options** επιλέξτε:
   - **RADE v1 — RADEL (LSB)** για 40 m / 80 m / 160 m (≤ 10 MHz)
   - **RADE v1 — RADEU (USB)** για 20 m / 17 m / 15 m / 12 m / 10 m (> 10 MHz)
5. Κάντε κλικ στο **Decoder: ON**

Τα βήματα 4 και 5 μπορούν να αντικατασταθούν από ένα μόνο πάτημα: τα κουμπιά **RADEL** / **RADEU** βρίσκονται δίπλα στην επικεφαλίδα **Modes selector** και μέσα στα αναδυόμενα παράθυρα **Modes** και **Bands**. Ένα πάτημα επιλέγει τον αποκωδικοποιητή, τον ανάβει και φέρνει το παράθυρο RADE στην οθόνη· δεύτερο πάτημα σταματά το RADE. Δείτε το [εγχειρίδιο RADE](RADE_README.md).

| Ένδειξη | Σημασία |
|---|---|
| 🔴 Κόκκινο — «Connecting to sidecar…» | Η θύρα 8074 δεν είναι προσβάσιμη ή ο sidecar δεν εκτελείται |
| 🟡 Κίτρινο — «Searching for signal…» | Ο sidecar συνδέθηκε, δεν εντοπίστηκε ακόμη πλαίσιο RADE (αφήστε ~1,5 s) |
| 🟢 Πράσινο — «Synced · SNR x.x dB» | Αποκωδικοποίηση — ακούγεται ομιλία |

---

## Σημείωση για τη CPU

Κάθε χρήστης RADE καταναλώνει ~8–10 % ενός πυρήνα (τα νήματα PyTorch περιορίζονται σε 1 από τον sidecar). Αν ακούτε διακοπές ήχου, αυξήστε σε 2 νήματα:

```bash
RADE_TORCH_THREADS=2 ./rade.sh restart
```

---

## Μελλοντική ενημέρωση του RADE

```bash
cd ~/radae
git pull
cmake -S . -B build && make -C build -j$(nproc)

cd ~/PhantomSDR-Plus
./rade.sh restart
```

Δεν χρειάζεται νέα μεταγλώττιση του frontend ούτε επανεκκίνηση του διακομιστή, εκτός αν άλλαξε το ίδιο το `rade_helper.py`.

---

*Δοκιμασμένο σε Raspberry Pi 4 / ARM64, Debian Bookworm, Python 3.11.* *Fork PhantomSDR-Plus: sv1btl/PhantomSDR-Plus.* *Το RADE αναπτύχθηκε από τον David Rowe VK5DGR και την ομάδα FreeDV — https://freedv.org*
