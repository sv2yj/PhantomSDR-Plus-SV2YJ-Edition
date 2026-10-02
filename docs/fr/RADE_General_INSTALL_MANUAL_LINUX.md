# RADE v1 — Guide d'installation manuelle
### Tout Linux — Ubuntu / Debian / Fedora / Arch / Raspberry Pi OS · PhantomSDR-Plus

> **Prérequis :** les fichiers corrigés (`rade_helper.py`, `rade.sh`, `audio.js`, `App.svelte`) sont déjà en place dans l'arborescence de PhantomSDR-Plus. Ce guide construit tout le reste autour d'eux.

> [!IMPORTANT]
> **Vous n'avez pas besoin de ce guide pour une installation normale.** `./install_rade.sh`, dans le dossier PhantomSDR-Plus, effectue pour vous chacune des étapes ci-dessous — paquets système, modules Python, compilation de radae, vérification des poids du modèle et démarrage du sidecar — et fonctionne aussi bien sur les systèmes apt, pacman, dnf que zypper. `./install.sh` et les quatre installateurs par distribution proposent de le lancer pendant l'installation normale. Ne suivez ce guide que pour une installation manuelle, pour un système que le script ne couvre pas, ou pour réparer une étape à la main.

> **Utilisateurs de Raspberry Pi :** ce guide est aussi le vôtre. Raspberry Pi OS est un Debian : suivez donc partout les blocs Debian et lisez les notes **Raspberry Pi / Bookworm** là où elles apparaissent — elles couvrent les deux points qui diffèrent sur un Pi : la PEP 668 et la roue torch CPU seule.

---

## Étape 1 — Paquets système

Choisissez le bloc correspondant à votre distribution.

### Ubuntu / Debian / Raspberry Pi OS

```bash
sudo apt update
sudo apt install -y \
    build-essential cmake git \
    python3 python3-pip \
    nodejs npm \
    alsa-utils
```

### Fedora / RHEL / Rocky

```bash
sudo dnf install -y \
    gcc gcc-c++ cmake git \
    python3 python3-pip \
    nodejs npm \
    alsa-utils
```

### Arch / Manjaro

```bash
sudo pacman -Sy --needed \
    base-devel cmake git \
    python python-pip \
    nodejs npm \
    alsa-utils
```

### Vérification de la version de Node.js (toutes distributions)

La compilation du frontend de RADE nécessite Node.js 22 ou plus récent :

```bash
node --version
```

Si la version est inférieure à 22.x, installez-le avec `nvm` (toutes distributions, sans root) :

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.4/install.sh | bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm install 22 && nvm use 22 && nvm alias default 22
```

> **Pas via NodeSource.** `deb.nodesource.com` et `rpm.nodesource.com` renvoient désormais HTTP 403 sur tous les chemins du dépôt : l'ancienne ligne `curl -fsSL https://deb.nodesource.com/setup_NN.x | sudo -E bash -` ne fonctionne donc plus, et sous Debian/Ubuntu elle laisse une source apt qui casse tous les `apt update` suivants. C'est pour cette raison que les scripts d'installation utilisent `nvm`.

---

## Étape 2 — Paquets Python

### Ubuntu 24.04 et antérieurs / Fedora / Arch

Un `pip3 install` simple fonctionne sur ces systèmes :

```bash
pip3 install websockets matplotlib numpy scipy

# torch — CPU-only build (~150–250 MB, avoids the ~3 GB CUDA wheel)
# Use this if the server has no GPU, which is the typical case for a WebSDR
pip3 install torch --index-url https://download.pytorch.org/whl/cpu
```

> Si votre serveur **dispose** bien d'un GPU NVIDIA avec CUDA installé, vous pouvez omettre `--index-url` pour obtenir la version CUDA complète. Cela n'apporte aucun gain de performance pour RADE — `radae_rxe.py` n'utilise PyTorch que pour des opérations matricielles sur CPU.

### Ubuntu 23.04+ / Debian Bookworm+ / Raspberry Pi OS (systèmes PEP 668)

Ces distributions bloquent un `pip3 install` nu. Ajoutez l'option :

```bash
# All packages except torch
pip3 install --break-system-packages websockets matplotlib numpy scipy

# torch — CPU-only build
pip3 install --break-system-packages torch \
    --index-url https://download.pytorch.org/whl/cpu
```

> **Raspberry Pi / Bookworm — deux règles qui mordent :**
>
> 1. Chaque `pip3 install` exige `--break-system-packages` (application de la
> PEP 668). Sans cela, l'installation est totalement bloquée.
> 2. Un simple `pip3 install torch` télécharge la version CUDA (~3 Go).
> Sur un Pi il n'y a pas de CUDA — utilisez l'index CPU seul pour obtenir la version ARM64 allégée (~150 Mo).

Vous pouvez également utiliser un environnement virtuel pour éviter complètement cette option :

```bash
python3 -m venv ~/rade-venv
source ~/rade-venv/bin/activate
pip install websockets matplotlib numpy scipy torch \
    --index-url https://download.pytorch.org/whl/cpu
```

> Si vous utilisez un venv, faites précéder tous les appels `python3` de ce guide de `source ~/rade-venv/bin/activate`, ou utilisez le chemin complet `~/rade-venv/bin/python3`.

### Vérification

```bash
python3 -c "import websockets, matplotlib, torch, numpy, scipy; print('All OK')"
```

Sortie attendue :
```
All OK
```

---

## Étape 3 — Cloner et compiler le dépôt radae

Le décodeur RADE se trouve dans un dépôt distinct de codec2. `freedv_rx` de codec2 ne prend **pas** en charge RADE v1.

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

### Vérifiez que lpcnet_demo a été compilé

```bash
ls -la ~/radae/build/src/lpcnet_demo
```

Attendu : le binaire est présent et exécutable.

### Vérifiez la présence des poids du modèle

```bash
ls ~/radae/model19_check3/checkpoints/checkpoint_epoch_100.pth
```

Attendu : le fichier `.pth` est listé. Les poids sont fournis dans le dépôt — aucun téléchargement séparé n'est nécessaire.

---

## Étape 4 — Vérifier la chaîne de décodage

Cette étape confirme que la chaîne hors ligne complète fonctionne avant de la relier au navigateur. À exécuter depuis `~/radae` :

```bash
cd ~/radae
```

### 4a — Générer un signal de test encodé en RADE

```bash
./inference.sh model19_check3/checkpoints/checkpoint_epoch_100.pth \
    wav/brian_g8sez.wav /dev/null \
    --rate_Fs --pilots --pilot_eq --eq_ls --cp 0.004 \
    --write_rx rx.f32 --auxdata
```

Attendez la fin du traitement. Les dernières lignes affichées doivent être :
```
loss: 0.741 Auxdata BER: 0.012
```

### 4b — Décoder et écouter

```bash
cat rx.f32 \
    | python3 radae_rxe.py \
        --model_name model19_check3/checkpoints/checkpoint_epoch_100.pth \
    | ./build/src/lpcnet_demo -fargan-synthesis - - \
    | aplay -f S16_LE -r 16000
```

Vous devriez entendre une voix. La sortie montre l'acquisition de la synchronisation :
```
  1 state: search     ...
  5 state: sync       ... SNRdB:  4.03 uw_err: 0
Playing raw data 'stdin' : Signed 16 bit Little Endian, Rate 16000 Hz, Mono
```

> **Les messages `underrun!!!` pendant ce test sont normaux et sans conséquence.** Ils surviennent parce que `radae_rxe.py` traite plus lentement que les entrées/sorties du fichier. Ils n'apparaissent pas en réception en direct — le navigateur fournit l'audio au rythme temps réel.

### 4c — Vérifier que le sidecar démarre correctement

```bash
python3 ~/PhantomSDR-Plus/rade_helper.py
```

Sortie attendue (aucune ligne WARNING) :
```
[RADE] helper starting on ws://0.0.0.0:8074
[RADE] radae_rx.py    : /home/<user>/radae/radae_rxe.py
[RADE] model          : /home/<user>/radae/model19_check3/checkpoints/checkpoint_epoch_100.pth
[RADE] lpcnet_demo    : /home/<user>/radae/build/src/lpcnet_demo
[RADE] auxdata        : ON (default)
[RADE] torch threads  : 1 per instance (RADE_TORCH_THREADS to override)
[RADE] architecture   : per-connection (each user tunes independently)
[RADE] listening — waiting for PhantomSDR-Plus clients
```

Appuyez sur **Ctrl+C** pour arrêter.

> `<user>` dans les chemins ci-dessus désigne le compte avec lequel vous êtes connecté — sur une image standard de Raspberry Pi OS, ils deviennent `/home/pi/radae/...`.

---

## Étape 5 — Compiler le frontend de PhantomSDR-Plus

```bash
cd ~/PhantomSDR-Plus/frontend

# Only if node_modules is missing:
npm install

cd ~/PhantomSDR-Plus
./recompile.sh
```

Surveillez les erreurs de l'analyseur Vite/acorn. Les fichiers corrigés évitent délibérément `?.`, `??` et les `catch {}` nus, afin de respecter la contrainte d'acorn.

---

## Étape 6 — Contrôle du sidecar

**Vous n'avez normalement pas besoin d'un script de contrôle distinct pour RADE.** Les scripts de démarrage (`start-rx888mk2.sh`, `start-airspyhf.sh`, `start-rtl.sh`, `start-rsp1a.sh`, `start-fobos-hf.sh`, `start-fobos.sh`, `start-hackrf.sh`) démarrent eux-mêmes le sidecar dès que le serveur tourne, le relancent s'il s'arrête et signalent son état ; `stop-websdr.sh` l'arrête en même temps que le serveur. Passez directement à l'étape 7.

`rade.sh` reste fourni pour un usage autonome — faire tourner le sidecar sans le lanceur PhantomSDR-Plus, ou le tester seul. Ses commandes, son journal et les pièges du chien de garde qui vont avec figurent dans [Contrôle du sidecar](RADE_README.md#contrôle-du-sidecar).
---

## Étape 7 — Ouvrir le port 8074

Le sidecar écoute sur le port TCP **8074**. Le navigateur se connecte directement à ce port. Vous devez l'ouvrir manuellement.

### ufw (Ubuntu / Debian / Raspberry Pi OS)

```bash
sudo ufw allow 8074/tcp && sudo ufw reload
```

### firewalld (Fedora / RHEL / Rocky)

```bash
sudo firewall-cmd --add-port=8074/tcp --permanent
sudo firewall-cmd --reload
```

### iptables (toutes distributions, permanent)

```bash
sudo iptables -I INPUT -p tcp --dport 8074 -j ACCEPT

# Ubuntu / Debian / Raspberry Pi OS — persist across reboots:
sudo apt install iptables-persistent
sudo netfilter-persistent save

# Fedora / RHEL — persist:
sudo service iptables save
```

### Routeur

Ajoutez une règle NAT / redirection de port : **TCP 8074 → IP LAN du serveur : 8074**

### Test depuis l'extérieur

Utilisez **https://portchecker.co** et vérifiez le port 8074 sur votre nom d'hôte public. Ne testez **pas** avec `curl` depuis le serveur lui-même — le NAT hairpin donne de faux résultats « Connection refused » même lorsque le port est ouvert.

### Alternative — proxy Nginx (si le port 8074 est bloqué par le FAI)

Ajoutez à l'intérieur de votre bloc `server {}` existant :

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

Modifiez ensuite `audio.js` dans `setRADEDecoding()` :

```js
// Change:
var helperUri = uri || ('ws://' + window.location.hostname + ':8074');
// To:
var helperUri = uri || ('ws://' + window.location.host + '/rade');
```

Recompilez le frontend après cette modification (`./recompile.sh`).

---

## Étape 8 — Démarrer le serveur

Démarrez PhantomSDR-Plus comme d'habitude. RADE n'est **pas** lancé automatiquement :

```bash
cd ~/PhantomSDR-Plus
./start-rx888mk2.sh      # or start-airspyhf.sh,
                         # start-rtl.sh, start-rsp1a.sh,
                         # start-fobos-hf.sh, start-fobos.sh,
                         # start-hackrf.sh
```

Utilisez le lanceur correspondant à votre récepteur. Chacun comporte son propre chien de garde et son journal ; `./stop-websdr.sh` arrête celui qui est en cours.

---

## Étape 9 — Démarrer RADE

```bash
cd ~/PhantomSDR-Plus
./rade.sh start
./rade.sh status
tail -f rade.log
```

Journal attendu :
```
[RADE] sidecar starting at ...
[RADE] helper starting on ws://0.0.0.0:8074
[RADE] radae_rx.py    : /home/<user>/radae/radae_rxe.py
[RADE] model          : /home/<user>/radae/model19_check3/checkpoints/checkpoint_epoch_100.pth
[RADE] lpcnet_demo    : /home/<user>/radae/build/src/lpcnet_demo
[RADE] auxdata        : ON (default)
[RADE] torch threads  : 1 per instance
[RADE] architecture   : per-connection (each user tunes independently)
[RADE] listening — waiting for PhantomSDR-Plus clients
```

---

## Étape 10 — Utiliser RADE dans le navigateur

1. Ouvrez votre interface web PhantomSDR-Plus
2. Trouvez les stations actives sur **https://qso.freedv.org**
3. Accordez-vous sur la fréquence affichée de la station
4. Dans **Decoder Options**, sélectionnez :
   - **RADE v1 — RADEL (LSB)** pour 40 m / 80 m / 160 m (≤ 10 MHz)
   - **RADE v1 — RADEU (USB)** pour 20 m / 17 m / 15 m / 12 m / 10 m (> 10 MHz)
5. Cliquez sur **Decoder: ON**

Les étapes 4 et 5 peuvent être remplacées par une seule pression : les boutons **RADEL** / **RADEU** se trouvent à côté du titre **Modes selector** ainsi que dans les fenêtres **Modes** et **Bands**. Une pression sélectionne le décodeur, le met sur ON et amène le panneau RADE à l'écran ; appuyez de nouveau pour arrêter RADE. Voir le [manuel RADE](RADE_README.md).

| Indicateur | Signification |
|---|---|
| 🔴 Rouge — « Connecting to sidecar… » | Port 8074 injoignable ou sidecar arrêté |
| 🟡 Jaune — « Searching for signal… » | Sidecar connecté, aucune trame RADE encore détectée (comptez ~1,5 s) |
| 🟢 Vert — « Synced · SNR x.x dB » | Décodage en cours — la parole est audible |

---

## Remarque sur le CPU

Chaque utilisateur RADE consomme environ 8 à 10 % d'un cœur (le nombre de threads PyTorch est limité à 1 par le sidecar). Si vous entendez des coupures audio, passez à 2 threads :

```bash
RADE_TORCH_THREADS=2 ./rade.sh restart
```

| Utilisateurs simultanés | CPU approximatif |
|---|---|
| 1 | ~9 % |
| 5 | ~45 % |
| 10 | ~90 % |
| 20 | ~180 % |

> Ces chiffres ont été mesurés sur x86_64. Un Raspberry Pi décode RADE sans problème, mais le coût par utilisateur y est plus élevé et le tableau ci-dessus ne se transpose pas — mesurez votre propre carte avec `top` pendant qu'un utilisateur est synchronisé avant d'annoncer une limite d'utilisateurs.

---

## Mettre RADE à jour par la suite

```bash
cd ~/radae
git pull
cmake -S . -B build && make -C build -j$(nproc)

cd ~/PhantomSDR-Plus
./rade.sh restart
```

Aucune recompilation du frontend ni redémarrage du serveur n'est nécessaire, sauf si `rade_helper.py` lui-même a changé.

---

*Testé sur Ubuntu 24.04 (x86_64) et Raspberry Pi 4 / Raspberry Pi OS Bookworm (ARM64, Python 3.11).* *Fork PhantomSDR-Plus : sv1btl/PhantomSDR-Plus.* *RADE développé par David Rowe VK5DGR et l'équipe FreeDV — https://freedv.org*
