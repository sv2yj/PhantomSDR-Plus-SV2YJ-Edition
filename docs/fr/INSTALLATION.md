# Guide d'installation de PhantomSDR-Plus pour les opérateurs système

Ce guide complet vous accompagne dans l'installation et la configuration de PhantomSDR-Plus sur votre serveur.

---

## Table des matières

1. [Configuration système requise](#configuration-système-requise)
2. [Préparation avant installation](#préparation-avant-installation)
3. [Installation de PhantomSDR-Plus](#installation-de-phantomsdr-plus) — le script et [ce qu'il fait](#ce-que-fait-linstallateur)
4. [Rapporteur de spots autorun (FT8/FT4/WSPR)](#rapporteur-de-spots-autorun-ft8ft4wspr)
5. [Émulation des clients KiwiSDR (facultatif)](#émulation-des-clients-kiwisdr-facultatif)
6. [Configuration](#configuration)
7. [Configuration propre à chaque appareil SDR](#configuration-propre-à-chaque-appareil-sdr)
8. [Tests et vérification](#tests-et-vérification)
9. [Mise en place du démarrage automatique](#mise-en-place-du-démarrage-automatique)
10. [Protection thermique du processeur](#protection-thermique-du-processeur)
11. [Dépannage](#dépannage)

**Pour référence seulement — l'installateur fait déjà tout cela pour vous.** Lisez ces sections si vous êtes sur une distribution qu'aucun des scripts ne couvre, ou pour réparer une étape à la main :

- [Installation des dépendances](#installation-des-dépendances)
- [Installation de Node.js et npm](#installation-de-nodejs-et-npm)
- [Installation d'OpenCL](#installation-dopencl-facultatif-mais-recommandé)
- [Compiler à la main](#compiler-à-la-main-référence)
- [Installation du codec audio Opus](#installation-du-codec-audio-opus)
---

## Configuration système requise

### Systèmes d'exploitation pris en charge

**Principal (recommandé) :**
- Ubuntu 22.04 LTS (Jammy), 24.04 LTS (Noble) et 26.04 LTS (Resolute) — 24.04 recommandée
- Debian 12 (Bookworm) et Debian 13 (Trixie)

**Alternative :**
- Fedora (dernière version stable)
- Arch Linux (rolling release)
- openSUSE Tumbleweed (pas Leap — voir la note plus bas)

### Configuration matérielle requise

**Configuration minimale :**
- Processeur : double cœur (2 GHz ou plus)
- RAM : 4 Go
- Stockage : 10 Go d'espace libre
- Réseau : connexion 100 Mbit/s

**Configuration recommandée :**
- Processeur : quadricœur ou mieux (Ryzen 5 2600, Intel i5-6500T ou supérieur)
- RAM : 8 Go ou plus
- Stockage : SSD de 20 Go ou plus
- GPU : AMD/NVIDIA compatible OpenCL (vivement recommandé)
- Réseau : connexion 1 Gbit/s

**Configuration hautes performances :**
- Processeur : 6 cœurs ou plus (Ryzen 7, Intel i7 ou mieux)
- RAM : 16 Go ou plus
- Stockage : SSD NVMe
- GPU : GPU dédié compatible OpenCL/CUDA
- Réseau : 1 Gbit/s ou mieux

---

## Préparation avant installation

### 1. Mettez votre système à jour

```bash
# Ubuntu/Debian
sudo apt update
sudo apt upgrade -y
sudo reboot

# Fedora
sudo dnf update -y
sudo reboot
```

### 2. Vérifiez la version d'Ubuntu

```bash
lsb_release -a
```

**La sortie attendue doit indiquer :** Ubuntu 24.04 LTS

### 3. Vérifiez l'espace disque disponible

```bash
df -h
```

Assurez-vous d'avoir au moins 10 Go libres dans votre répertoire personnel.

### 4. Vérifiez les informations du processeur

```bash
lscpu
```

Notez le nombre de cœurs/threads pour optimiser la configuration.

---

## Installation des dépendances

> [!IMPORTANT]
> **Vous n'avez pas besoin de cette section pour une installation normale.** `./install.sh` — ou l'installateur de votre distribution — fait tout cela pour vous ; voir [Ce que fait l'installateur](#ce-que-fait-linstallateur). Ce qui suit est une référence pour une installation manuelle, pour une distribution qu'aucun script ne couvre, ou pour réparer un élément à la main.


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

### Vérifiez l'installation

```bash
# Check if key dependencies are installed
pkg-config --modversion fftw3
cmake --version
meson --version
```

---

## Installation de Node.js et npm

> [!IMPORTANT]
> **Vous n'avez pas besoin de cette section pour une installation normale.** `./install.sh` — ou l'installateur de votre distribution — fait tout cela pour vous ; voir [Ce que fait l'installateur](#ce-que-fait-linstallateur). Ce qui suit est une référence pour une installation manuelle, pour une distribution qu'aucun script ne couvre, ou pour réparer un élément à la main.


PhantomSDR-Plus a besoin de Node.js pour compiler l'interface. Nous utiliserons NVM (Node Version Manager) pour l'installation.

### 1. Installez NVM

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.4/install.sh | bash
```

### 2. Chargez NVM

**IMPORTANT :** fermez et rouvrez votre terminal, ou exécutez :

```bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
```

### 3. Vérifiez l'installation de NVM

```bash
nvm --version
```

Sortie attendue : `0.40.4` ou similaire

### 4. Installez Node.js

```bash
# Install Node.js 22 - the version every install script requires
nvm install 22

# Make it the default, so systemd units and cron see it too
nvm alias default 22

# Verify installation
node --version
npm --version
```

### 5. Facultatif : installez d'autres versions de Node

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

## Installation d'OpenCL (facultatif mais recommandé)

> [!IMPORTANT]
> **Vous n'avez pas besoin de cette section pour une installation normale.** `./install.sh` — ou l'installateur de votre distribution — fait tout cela pour vous ; voir [Ce que fait l'installateur](#ce-que-fait-linstallateur). Ce qui suit est une référence pour une installation manuelle, pour une distribution qu'aucun script ne couvre, ou pour réparer un élément à la main.


OpenCL améliore considérablement les performances en déportant les calculs de FFT sur le GPU. Cette section traite des graphiques intégrés Intel. Pour les GPU AMD/NVIDIA, reportez-vous à la documentation du fabricant.

### Processeur Intel avec graphiques intégrés

#### 1. Installez les composants OpenCL de base

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

#### 2. Téléchargez Intel Compute Runtime

```bash
mkdir -p ~/neo
cd ~/neo

wget https://github.com/intel/compute-runtime/releases/download/19.07.12410/intel-gmmlib_18.4.1_amd64.deb
wget https://github.com/intel/compute-runtime/releases/download/19.07.12410/intel-igc-core_18.50.1270_amd64.deb
wget https://github.com/intel/compute-runtime/releases/download/19.07.12410/intel-igc-opencl_18.50.1270_amd64.deb
wget https://github.com/intel/compute-runtime/releases/download/19.07.12410/intel-opencl_19.07.12410_amd64.deb
wget https://github.com/intel/compute-runtime/releases/download/19.07.12410/intel-ocloc_19.07.12410_amd64.deb
```

#### 3. Installez le runtime OpenCL d'Intel

```bash
sudo dpkg -i *.deb
```

En cas d'erreurs de dépendances :

```bash
sudo apt --fix-broken install
```

#### 4. Installez le chargeur ICD OpenCL

```bash
sudo apt update
sudo apt install intel-opencl-icd
```

En cas d'erreurs :

```bash
sudo apt --fix-broken install
sudo apt install intel-opencl-icd
```

#### 5. Vérifiez l'installation d'OpenCL

```bash
sudo clinfo
```

Vous devriez voir des informations sur votre plateforme et vos appareils OpenCL. Cherchez :
- Nombre de plateformes : 1 (ou plus)
- Nom de la plateforme : Intel(R) OpenCL (ou similaire)
- Type d'appareil : GPU ou CPU

#### 6. Redémarrez

```bash
sudo reboot
```

### OpenCL sur GPU AMD

Pour les GPU AMD, installez ROCm :

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

### OpenCL sur GPU NVIDIA

Pour les GPU NVIDIA, installez CUDA :

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

## Installation de PhantomSDR-Plus

### Cloner le dépôt, rendre les scripts exécutables, lancer l'installateur

```bash
cd ~
git clone --recursive https://github.com/sv1btl/PhantomSDR-Plus
cd PhantomSDR-Plus
chmod +x *.sh
./install.sh
```

**⚠️ IMPORTANT :** une fois l'installateur terminé, **redémarrez votre terminal** — Node.js et Rust fraîchement installés ne sont dans votre `PATH` qu'après cela.

> **PhantomSDR-Plus tourne déjà chez vous ?** Ne le réinstallez pas : mettez-le à jour. Récupérez l'outil une fois et lancez-le ; votre configuration, vos marqueurs, le mot de passe d'administration, la liste des fréquences et l'historique du chat ne sont jamais touchés, et ce que vous avez modifié vous est soumis au lieu d'être écrasé :
>
> ```bash
> cd ~/PhantomSDR-Plus
> curl -fLO https://raw.githubusercontent.com/sv1btl/PhantomSDR-Plus/main/update.sh
> chmod +x update.sh
> ./update.sh
> ```
>
> Cette dernière ligne ne fait que *signaler* ce qui changerait, sans rien écrire ; `./update.sh --apply` l'exécute. Les détails sont dans le chapitre *Mise à jour de PhantomSDR-Plus*. Repasser l'installateur sur une station en service n'est nécessaire que si la recompilation échoue faute de paquets système.

Prenez le script qui correspond à votre système. Ils font le même travail et posent les mêmes questions ; seul le gestionnaire de paquets diffère :

| Système | Script |
|---|---|
| Ubuntu 22.04 / 24.04 / 26.04, Debian 12 / 13 | `./install.sh` |
| Fedora | `./install_fedora.sh` |
| Arch | `./install_arch.sh` |
| openSUSE Tumbleweed | `./install_opensuse.sh` |

> **Un seul installateur pour toutes les versions de Debian et d'Ubuntu.** `install.sh` lit `/etc/os-release` et la version de Boost installée puis s'adapte de lui-même ; les anciens `install_ubuntu22.sh`, `install-Deb12.sh` et `install_ubuntu26.sh` ont disparu. Il définit `DEBIAN_FRONTEND=noninteractive`, afin que le `tzdata` qui arrive avec `python3-matplotlib` ne puisse pas interrompre l'exécution pour demander votre fuseau horaire, puis avaler la réponse destinée à la question suivante. Sur Jammy il appelle directement `install_rade_ubuntu22.sh`, car le `python3-websockets` de Jammy est en 10.1 alors que RADE exige 11.0 ou plus récent. Il sait où se trouve `intel-opencl-icd` sur chaque version : dans les dépôts sur 22.04 et 26.04, dans `non-free` sur Debian 12, et dans le dépôt graphique d'Intel sur 24.04 et Debian 13. Et là où Boost est en 1.87 ou plus récent, le correctif des en-têtes websocketpp cesse d'être facultatif : l'installateur vérifie qu'il a bien été appliqué et refuse de compiler sans lui. Aucun compilateur plus récent n'est jamais nécessaire : le GCC d'origine accepte `-std=c++23` sur les cinq versions, n'installez donc pas `gcc-12` pour cela.

L'installation se déroule en 17 étapes clairement numérotées, et chaque point où elle vous attend est encadré par un bandeau **⌨️  VOTRE SAISIE EST REQUISE**, pour qu'une question ne se confonde pas avec l'affichage qui défile. Les sept questions sont listées dès le départ, avant toute installation. `PHANTOM_NONINTERACTIVE=1` y répond toutes par leurs valeurs par défaut ; voyez l'en-tête de `install.sh` pour les variables `PHANTOM_*`.

**Chaque exécution écrit `install.txt`.** Quand l'installateur se termine — ou s'arrête en cours de route — il écrit un rapport dans `install.txt`, à la racine du dossier PhantomSDR-Plus : le résultat, chacune des 17 étapes en OK / SKIPPED / PARTIAL / FAILED, ce qu'il a détecté (distribution, Boost, compilateur, Node.js), quels composants ont été installés, et chaque avertissement rencontré. Une exécution qui échoue laisse un rapport qui s'arrête à l'étape fautive, avec la raison et la mention que l'installateur peut être relancé sans risque. C'est le premier fichier à lire quand quelque chose n'a pas marché, et le premier à joindre à un rapport de bogue. Chaque exécution l'écrase : gardez-en une copie si vous voulez comparer deux installations.

> **Ubuntu 26.04, Arch et openSUSE Tumbleweed se compilent, mais n'ont pas été éprouvés en exploitation.** Tous trois embarquent un Boost plus récent que 1.87, qui a supprimé l'API `io_service` pour laquelle le websocketpp 0.8.2 embarqué a été écrit. Les en-têtes corrigés que l'installateur copie comblent cet écart (`io_context`, `executor_work_guard`, `boost::asio::post`, le resolver moderne), et là où Boost est en 1.87 ou plus récent l'installateur traite ce correctif comme obligatoire et non facultatif : il vérifie que les copies sont en place et refuse de compiler sans elles. Une installation complète, pilote du récepteur et tous les composants optionnels compris, a été vérifiée de bout en bout en conteneurs sur Boost 1.90 (Ubuntu 26.04), 1.91 (openSUSE Tumbleweed) et 1.92 (Arch). Cela prouve que le serveur compile et démarre — pas qu'il sert un récepteur pendant des heures. Considérez les trois comme non testés en production tant que personne n'a fait de retour.

> **openSUSE signifie ici Tumbleweed.** C'est là que `install_opensuse.sh` est vérifié. Leap 15.6 ne fonctionne pas : ses dépôts ne contiennent aucun `liquid-dsp-devel`, dont le backend a besoin, et Boost n'existe que sous des noms de paquets versionnés. Prendre en charge Leap imposerait d'ajouter des dépôts OBS tiers ; c'est donc hors périmètre pour l'instant.

### Ce que fait l'installateur

Rien n'est à préparer à la main au préalable : aucune liste de paquets à coller, aucun Node.js à récupérer, aucun paquet OpenCL à chercher. Il se déroule en 19 étapes numérotées et s'arrête pour vous poser jusqu'à dix questions, chacune encadrée par un bandeau « VOTRE SAISIE EST REQUISE » : restez au clavier, ou bien définissez `PHANTOM_NONINTERACTIVE=1` et laissez-le répondre à tout avec ses valeurs par défaut (voir plus bas) — ne le laissez donc pas sans surveillance — et comptez d'une vingtaine de minutes à bien plus d'une heure selon la machine et le nombre d'extras conservés.

| # | Étape | Ce qui vous est demandé |
|---|---|---|
| 1 | Énumère les services PhantomSDR-Plus en cours d'exécution — panneau d'administration, proxy inverse, serveur de statistiques, récepteur — et propose de les arrêter avant de toucher à quoi que ce soit. Seul un script de lancement en cours d'exécution compte comme récepteur ; un script simplement ouvert dans un éditeur n'est pas touché. | confirmation, **oui par défaut** |
| 2–6 | Détecte la distribution et installe toutes les dépendances de compilation (compilateur, meson/ninja, FFTW, Boost, FLAC, Opus, liquid-dsp, zlib/zstd, libcurl …), en installant Node.js 22 via nvm si le système n'en a pas ou en a un trop ancien | rien |
| 7 | Compile le backend avec meson | rien |
| 8 | Compile le pilote de votre récepteur — RX888 MkII / RX888, RTL-SDR (le Blog V4 est demandé à part), SDRplay RSP1A, RigExpert Fobos SDR, Airspy HF+, HackRF One ou aucun. Avec le RX888, **les règles udev sont installées aussi**, pour que le serveur n'ait jamais besoin de `sudo` pour l'appareil. Le RSP1A, le Fobos et l'Airspy HF+ passent par SoapySDR : leur choix lance `setup-rsp1a.sh`, `setup-fobos.sh` ou `setup-airspyhf.sh`, qui compile le pilote et `rx_sdr` et installe aussi une règle udev (voir [Récepteurs sur SoapySDR (RSP1A, Fobos, Airspy HF+)](#récepteurs-sur-soapysdr-rsp1a-fobos-airspy-hf)) Le HackRF One n'a pas besoin de SoapySDR : son choix lance `setup-hackrf.sh`, qui installe le paquet `hackrf` de la distribution et une règle udev. | quel SDR vous avez |
| 9 | Ouvre `frontend/site_information.json` dans votre éditeur | indicatif, locator, matériel, antenne — **ne sautez pas cette étape** |
| 10–11 | Installe les dépendances du frontend et construit les pages bureau et `/mobile` | rien |
| 12 | Installe OpenCL en choisissant le fournisseur d'après le matériel trouvé (GPU Intel / AMD / NVIDIA, ou le runtime CPU x86). S'il n'y a aucun appareil compatible, il le dit et continue | confirmation, oui par défaut |
| 13–15 | Installe le **panneau d'administration**, le **décodeur FreeDV RADE V1** et le **serveur de statistiques** — les trois par défaut | confirmation pour chacun, oui par défaut ; chacun pose ses propres questions |
| 16 | Réapplique les cinq en-têtes websocketpp corrigés par-dessus le sous-projet meson et vérifie qu'ils sont bien en place. Trois d'entre eux constituent le travail de compatibilité Boost ≥ 1.87, sans lequel le backend ne compile pas avec Boost 1.90 ; les deux autres sont des modifications propres au projet, dont le correctif nécessaire à l'enregistrement sur websdr.org | rien |
| 17 | Installe l'**émulation des clients KiwiSDR** en lançant `kiwi_install.sh`, pour que des clients Kiwi comme AetherSDR puissent se connecter à ce récepteur. Corrige les sources et ajoute `[kiwi_emulation]` aux fichiers de configuration de la racine du dépôt — voir [Émulation des clients KiwiSDR](Aether_config.md) | confirmation, oui par défaut |
| 18 | Lance `recompile.sh`, pour que tout soit construit à partir des sources corrigées | `[3] Both backend and frontend` → variante de départ → `[1] build-all.sh` |
| 19 | Affiche le récapitulatif : chaque étape avec son verdict, et chaque composant avec ce qui a été installé | rien |

#### Installation sans surveillance

Chaque question dispose d'une variable d'environnement qui la remplace, et l'installateur bascule de lui-même sur les valeurs par défaut lorsque l'entrée standard n'est pas un terminal (un tube, un conteneur, un travail de CI). Cela vaut de la même façon pour les quatre : `install.sh`, `install_arch.sh`, `install_fedora.sh` et `install_opensuse.sh`. Définissez `PHANTOM_NONINTERACTIVE=1` et le déroulement se termine sans rien demander :

| Variable | Effet |
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
| `PHANTOM_CURLPP=y\|n` | continuer sans curlpp — Arch et openSUSE seulement (défaut y) |
| `PHANTOM_FIX_CLOCK_SKEW=y\|n` | réinitialiser les horodatages des sources datés dans le futur, pour que meson puisse compiler (défaut y) |

Les trois sous-installateurs marqués *n sans surveillance* sont eux-mêmes interactifs ; une exécution sans surveillance les ignore donc plutôt que de bloquer sur leurs questions. Nommez-les explicitement pour les inclure :

```bash
# a complete unattended install for an RX888 MkII
PHANTOM_NONINTERACTIVE=1 PHANTOM_SDR=1 ./install.sh

# ... and with the admin panel, RADE and the statistics server too
PHANTOM_NONINTERACTIVE=1 PHANTOM_SDR=1 \
  PHANTOM_ADMIN=y PHANTOM_RADE=y PHANTOM_STATS=y ./install.sh
```

Après un redémarrage, les règles udev du RX888 et un éventuel pilote OpenCL sont pleinement actifs ; l'installateur vous indique quand un redémarrage ou une reconnexion est nécessaire.

Lorsqu'il installe le panneau d'administration, l'installeur propose aussi les deux unités systemd et **recommande fortement** de les accepter : la protection thermique tourne dans le panneau, donc sans elles un redémarrage ou un plantage laisse la machine sans protection. L'étape est ignorée automatiquement là où systemd ne tourne pas (conteneurs, WSL1, OpenRC) — voir le [guide du panneau](ADMIN_PANEL_SETUP.md).

Chaque extra est un script normal que vous pouvez aussi lancer seul à tout moment — `./setup_admin.sh` ([manuel](ADMIN_PANEL_SETUP.md)), `./install_rade.sh` ([manuel](RADE_README.md)), `./install-stats-server.sh` ([manuel](sdr-stats/README.md)), `./setup-rx888-udev.sh` et les scripts des récepteurs `./setup-rsp1a.sh`, `./setup-fobos.sh`, `./setup-airspyhf.sh` et `./setup-hackrf.sh` — ce sont exactement ceux que l'installateur appelle.

### Compiler à la main (référence)

> [!IMPORTANT]
> **Vous n'avez pas besoin de cette section pour une installation normale.** `./install.sh` — ou l'installateur de votre distribution — fait tout cela pour vous ; voir [Ce que fait l'installateur](#ce-que-fait-linstallateur). Ce qui suit est une référence pour une installation manuelle, pour une distribution qu'aucun script ne couvre, ou pour réparer un élément à la main.

Si vous devez un jour compiler sans l'installateur — une distribution non couverte, ou une compilation à moitié faite à réparer :

#### Compiler le backend

```bash
# Clean any previous builds, Configure build with optimization, Compile
rm -rf build
meson setup build --buildtype=release --optimization=3
meson compile -C build

# Verify binary was created
ls -lh build/spectrumserver
```

#### Compiler le frontend

```bash
cd frontend

# Install dependencies, Fix any vulnerabilities, Build the frontend
npm install
npm audit fix
npm run build

# Return to project root
cd ..
```

### Vérifiez l'installation

```bash
# Check if binary exists
ls -lh build/spectrumserver

# Check if frontend was built
ls -lh frontend/dist/

# List important files
ls -lh *.sh *.toml
```

---

## Installation du codec audio Opus

> [!IMPORTANT]
> **Vous n'avez pas besoin de cette section pour une installation normale.** `./install.sh` — ou l'installateur de votre distribution — fait tout cela pour vous ; voir [Ce que fait l'installateur](#ce-que-fait-linstallateur). Ce qui suit est une référence pour une installation manuelle, pour une distribution qu'aucun script ne couvre, ou pour réparer un élément à la main.


Opus offre une meilleure qualité audio et une latence plus faible que FLAC.

### 1. Installez la bibliothèque système libopus

```bash
sudo apt-get update
sudo apt-get install -y libopus0 libopus-dev
```

### 2. Installez le décodeur Opus pour le frontend

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

### 3. Vérifiez l'installation d'Opus

```bash
# Check if Opus system library is installed
pkg-config --modversion opus

# Check if Opus npm package is installed
cd frontend
npm list @wasm-audio-decoders/opus-ml
cd ..
```

---

## Rapporteur de spots autorun (FT8/FT4/WSPR)

PhantomSDR-Plus est livré avec un **rapporteur de spots autorun** facultatif (dans le répertoire `autorun/`). Il décode FT8/FT4/WSPR côté serveur, directement à partir du récepteur, et téléverse les spots vers les réseaux de report :

- **FT8 / FT4 → PSK Reporter** (IPFIX/UDP)
- **WSPR → wsprnet.org** (HTTP)

Il se pilote entièrement depuis l'onglet **panneau d'administration → « Spot Reporting »**, et **le report est DÉSACTIVÉ par défaut** — rien n'est transmis ni téléversé tant que vous ne l'activez pas là. Le décodeur s'exécute comme un démon Node.js distinct et prélève l'audio du récepteur localement : il n'ajoute donc aucun matériel RF supplémentaire.

### Prérequis

| Prérequis | Remarques |
|-----------|-----------|
| **Node.js 22+** | Le même environnement d'exécution que la compilation du frontend — installé à l'[étape Node.js](#installation-de-nodejs-et-npm). |
| **Paquets npm `ws` + `cbor-x`** | Résolus via `autorun/node_modules`, un lien symbolique vers le `node_modules` du frontend (les deux paquets sont déclarés dans `frontend/package.json`). |
| **`util-linux`** (`taskset`) | Le bouton « Start » de l'admin épingle le démon sur les E-cores avec `taskset`. Présent sur pratiquement toutes les distributions ; les installateurs l'ajoutent explicitement. |
| **Indicatif + locator** | Lus dans `frontend/site_information.json` (`siteSysop` / `siteGridSquare`) sauf s'ils sont remplacés dans l'onglet d'administration. Les spots sont téléversés sous cet indicatif. |

> ⚠️ **Ne rapportez que ce que vous recevez réellement.** Les spots sont téléversés vers des réseaux publics sous votre indicatif — n'activez que les bandes/modes que votre récepteur entend véritablement, et utilisez le bon locator.

### Installation automatique

`install.sh` (et les variantes par distribution : `install_arch.sh`, `install_fedora.sh`, `install_opensuse.sh`) s'occupent de tout : ils installent Node.js 22 et `util-linux`, exécutent le `npm install` du frontend, puis créent automatiquement le lien symbolique `autorun/node_modules`. Aucune étape supplémentaire n'est nécessaire — la fonction est prête dès que `install.sh` se termine.

### Installation manuelle

> [!NOTE]
> L'installateur le fait déjà pour vous : il crée le lien symbolique et installe `util-linux`. N'utilisez les étapes ci-dessous que pour réparer une installation à la main.

Si vous avez installé manuellement (option B), créez vous-même le lien symbolique après le `npm install` du frontend, afin que le démon puisse résoudre ses dépendances :

```bash
cd ~/PhantomSDR-Plus

# 1. Frontend deps must be installed first (ws + cbor-x live there)
cd frontend && npm install && cd ..

# 2. Link the autorun daemon to the frontend's node_modules
ln -sfn ../frontend/node_modules autorun/node_modules

# 3. Ensure taskset is available (Debian/Ubuntu shown; use your package manager)
sudo apt install -y util-linux
```

> **Remarque :** `autorun/node_modules` est ignoré par git : un `git clone` frais ne le contient donc jamais — le lien symbolique doit être (re)créé après chaque récupération propre. Les installateurs le font pour vous ; la commande ci-dessus ne concerne que les installations manuelles.

### Vérification

```bash
# The symlink should point at ../frontend/node_modules
ls -l autorun/node_modules

# ws + cbor-x must resolve
ls -d frontend/node_modules/ws frontend/node_modules/cbor-x

# taskset must be on PATH
command -v taskset
```

Ouvrez ensuite le panneau d'administration, allez dans l'onglet **Spot Reporting**, renseignez votre identité, cochez les bandes/modes à décoder, activez la ou les destinations, puis appuyez sur **Start**. Un badge « 📶 REPORTING » apparaît sur la cascade principale chaque fois que le report est actif. (PSK Reporter téléverse par lots toutes les 5 minutes et wsprnet toutes les 2 minutes : un démon fraîchement démarré affiche donc « 0 sent » pendant les premières minutes — c'est normal.)

Deux compteurs différents sont ensuite affichés, et il est facile de les confondre. Les tuiles **SPOTS UPLOADED PER DECODER** ne comptent que l'exécution en cours : Stop/Start les remet à zéro. Le nombre à côté de chaque case bande/mode est le total **depuis toujours** de cet emplacement, conservé dans `autorun-totals.json` et donc préservé au redémarrage. Voir le [guide du panneau d'administration](ADMIN_PANEL_SETUP.md) pour les deux, ainsi que pour la page **Graphiques**, qui trace la fréquence du processeur, la charge, la température et les utilisateurs connectés sur 15 minutes à 24 heures.

> **Si votre machine chauffe**, le panneau embarque aussi une [protection thermique](ADMIN_PANEL_SETUP.md#thermal-guard) qui arrête le serveur lorsque le processeur atteint une température dangereuse et le relance une fois refroidi. Elle déduit ses seuils du seuil critique de votre propre processeur, il n'y a donc rien à calculer, et elle fonctionne quelle que soit votre méthode de démarrage/arrêt. Installée avec le panneau, elle démarre en mode journalisation seule : elle note ce qu'elle *aurait* fait et ne change rien tant que vous ne l'activez pas dans Paramètres. Le décodage continu occupe un processeur 24 h sur 24, il vaut donc la peine de lire l'onglet CRASH après une semaine d'autorun pour voir jusqu'où votre machine monte réellement.

> **Le port du serveur est détecté automatiquement.** Le démon se branche directement sur le `[server] port` de spectrumserver (boucle locale + jeton, en contournant le proxy). Il lit ce port dans le fichier de configuration avec lequel le spectrumserver en cours a été lancé, ce qui lui permet de fonctionner sur n'importe quel port sans configuration — la ligne `[autorun] tap backend: …` dans `autorun.log` indique ce qu'il a résolu. Si votre serveur ne tournait pas au démarrage du démon, ou si votre installation est atypique, fixez-le dans `autorun.json` :
> ```json
> "server": { "host": "127.0.0.1", "port": 9002 }
> ```
> Un mauvais port se traduit par `504` / `tap closed 1006` dans `autorun.log`, avec `decodes` bloqué à 0.

---

## Émulation des clients KiwiSDR (facultatif)

Depuis la v4.1.0, PhantomSDR-Plus sait aussi répondre au **protocole KiwiSDR**, si bien qu'un logiciel écrit pour un KiwiSDR — **AetherSDR**, `kiwiclient` et les autres — se connecte directement à votre récepteur, sur le même hôte et le même port que vous publiez déjà. C'est désactivé tant que `[kiwi_emulation] enabled = true` n'est pas ajouté à la configuration avec laquelle tourne votre récepteur.

L'installateur le propose à l'étape 17 ; `./kiwi_install.sh` l'applique à une arborescence déjà installée.

> **Documentation complète : [Émulation des clients KiwiSDR](Aether_config.md)** — ce que fait la passerelle, comment l'installer, chaque clé `[kiwi_emulation]`, connecter un client, le niveau audio, le S-mètre, la cadence de la cascade et un tableau des symptômes.

---

## Configuration

### 1. Choisissez votre fichier de configuration

Sélectionnez le fichier de configuration adapté à votre SDR :

- `config-rtl.toml` – clés RTL-SDR
- `config-rsp1a.toml` – SDRplay RSP1A
- `config-airspyhf.toml` – Airspy HF+ Discovery
- `config-fobos-hf.toml` – RigExpert Fobos SDR, HF1/HF2 en échantillonnage direct (0-25 MHz)
- `config-fobos.toml` – RigExpert Fobos SDR, voie RF (25-6000 MHz)
- `config-rx888mk2.toml` – RX888 MK2
- `config-hackrf.toml` – HackRF One
- `config.example.hackrf.toml` – HackRF One

Pour cet exemple, nous utiliserons le RTL-SDR.

### 2. Modifiez le fichier de configuration

```bash
nano config-rtl.toml
```

#### Réglages clés à configurer

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

#### Repères pour le taux d'échantillonnage

| Couverture | Taux d'échantillonnage | Taille de FFT |
|------------|------------------------|---------------|
| 2 MHz | 2048000 | 131072 |
| 3.2 MHz | 3200000 | 131072 |
| 10 MHz | 10000000 | 1048576 |
| 30 MHz | 30000000 | 2097152 |
| 60 MHz | 60000000 | 4194304 |

### 3. Configurez les informations du site

```bash
nano frontend/site_information.json
```

Modifiez les champs suivants :

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

**Régions IARU :**
- **1** : Europe, Afrique, Moyen-Orient, Asie du Nord
- **2** : Amériques (Nord, Centre, Sud), Caraïbes
- **3** : Asie-Pacifique, Océanie

### 4. Personnalisez les marqueurs de fréquence (facultatif)

```bash
nano markers.json
```

Ajoutez vos fréquences préférées, relais et stations de radiodiffusion.

### 5. Modifiez le script de démarrage

```bash
nano start-rtl.sh
```

Le script de démarrage est un lanceur autonome doublé d'un chien de garde. Ne modifiez que le bloc **RECEIVER CONFIGURATION** près du début, afin que les arguments du récepteur correspondent à votre installation :

```bash
# ═══ RECEIVER CONFIGURATION (the only receiver-specific part) ═══
RX_LABEL="RTL-SDR"
RX_COMM="rtl_sdr"                       # process name to monitor/kill
CONFIG="$PHANTOMDIR/config-rtl.toml"    # your .toml
FIFO="$PHANTOMDIR/rtl.fifo"
RX_ARGS="${RX_ARGS:--f 145000000 -s 2048000 -}"   # receiver args (edit these)
```

Paramètres à l'intérieur de `RX_ARGS` :
- `-f 145000000` : fréquence centrale (145 MHz)
- `-s 2048000` : taux d'échantillonnage (2,048 MSPS)

`CONFIG` pointe vers votre `.toml`. Vous n'avez **pas** besoin de modifier autre chose dans le script — la logique de démarrage/redémarrage/chien de garde/journalisation est générique. Vous pouvez aussi remplacer les arguments du récepteur au lancement sans modifier le fichier : `RX_ARGS="-f 145000000 -s 2048000 -" ./start-rtl.sh` (`RX888_ARGS` pour `start-rx888mk2.sh`).

---

## Configuration propre à chaque appareil SDR

### RTL-SDR

#### Installez les outils RTL-SDR

```bash
sudo apt install -y rtl-sdr
```

#### Testez le RTL-SDR

```bash
rtl_test
```

Appuyez sur Ctrl+C pour arrêter. Vous devriez voir des informations sur le taux d'échantillonnage.

#### Modifiez la configuration

```bash
nano config-rtl.toml
```

Réglages courants pour le RTL-SDR :
```toml
sps = 2048000
frequency = 145000000
signal = "iq"
format = "u8"
```

### Récepteurs sur SoapySDR (RSP1A, Fobos, Airspy HF+)

Le SDRplay RSP1A, le RigExpert Fobos SDR et l'Airspy HF+ rejoignent le serveur de la même façon : un pilote SoapySDR pour l'appareil, et `rx_sdr` (de rx_tools) qui transmet ses échantillons à `spectrumserver`. Un script par récepteur installe toute la chaîne :

| Récepteur | Script | Option de l'installateur | Script de lancement | Configuration |
|---|---|---|---|---|
| SDRplay RSP1A | `./setup-rsp1a.sh` | 3 | `start-rsp1a.sh` | `config-rsp1a.toml` |
| RigExpert Fobos SDR | `./setup-fobos.sh` | 5 | `start-fobos-hf.sh` (HF) / `start-fobos.sh` (RF) | `config-fobos-hf.toml` / `config-fobos.toml` |
| Airspy HF+ | `./setup-airspyhf.sh` | 6 | `start-airspyhf.sh` | `config-airspyhf.toml` |

Chaque script :

- installe git, cmake, un compilateur, libusb et **SoapySDR** depuis les paquets de votre distribution — il reconnaît apt, dnf, pacman et zypper, et fonctionne donc aussi bien sur Debian/Ubuntu, Fedora, Arch et openSUSE ;
- compile le pilote du récepteur depuis les sources dans `sdr_drivers/` (non suivi par git) ;
- compile **rx_tools** pour `rx_sdr`, sauf si `rx_sdr` est déjà installé — une seule copie sert à tous les récepteurs ;
- installe une **règle udev** et vous ajoute au groupe `plugdev`, pour que le script de lancement n'ait jamais besoin de `sudo` pour l'appareil. **Déconnectez-vous et reconnectez-vous une fois** pour que le groupe prenne effet ;
- vérifie pour finir que SoapySDR liste bien le pilote, et s'arrête sur une erreur sinon.

Lancez-les avec votre utilisateur normal — ils appellent `sudo` eux-mêmes. Ils sont idempotents : relancer l'un d'eux met à jour les sources du pilote avec `git pull` et recompile. L'installateur appelle exactement ces scripts ; sur une station déjà installée, lancez seul celui de votre récepteur. La partie commune se trouve dans `setup-sdr-common.sh`, qui ne se lance pas seul. Deux variables facultatives valent pour les trois : `SDR_USER=<nom>` met un autre compte dans `plugdev`, et `SDR_SKIP_DEPS=1` saute l'installation des paquets.

Appareil branché, vérifiez que le récepteur est détecté :

```bash
SoapySDRUtil --find="driver=soapyMiri"   # RSP1A
SoapySDRUtil --find="driver=fobos"       # Fobos
SoapySDRUtil --find="driver=airspyhf"    # Airspy HF+
```

#### SDRplay RSP1A

`setup-rsp1a.sh` installe le **pilote open source** : libmirisdr-5, le pilote issu de la rétro-ingénierie des puces Mirics MSi2500/MSi001 des RSP1 et RSP1A, avec son module SoapySDR SoapyMiri (`driver=soapyMiri`). Il ne demande aucun service en arrière-plan ni root. Le script met aussi sur liste noire les pilotes noyau `msi2500` et `msi001` dans `/etc/modprobe.d/blacklist-msi2500.conf`, car ils prennent le RSP1A comme radio V4L2 avant que `rx_sdr` puisse l'ouvrir. Si l'appareil était branché pendant qu'ils étaient chargés, débranchez-le et rebranchez-le une fois (ou redémarrez).

L'API fermée de SDRplay (`driver=sdrplay`, avec SoapySDRPlay et le service `sdrplay`) fonctionne toujours — le fichier inclus `instructions-for-rsp1a` décrit cette installation. `start-rsp1a.sh` choisit seul entre les deux : si SoapySDR a le pilote `sdrplay`, il utilise l'API et redémarre d'abord le service `sdrplay`, sinon il utilise libmirisdr-5. Une station installée sur l'API continue donc de fonctionner sans changement. Pour en imposer un, lancez avec `RX_DRIVER=miri` ou `RX_DRIVER=sdrplay`. Le pilote choisi est écrit dans `logwebsdr.txt` sous la forme `RSP1A driver: miri` ou `RSP1A driver: sdrplay`.

#### RigExpert Fobos SDR

Le Fobos ne diffuse **qu'une voie à la fois** ; il a donc deux scripts de lancement qui partagent le verrou du chien de garde comme tout `start-*.sh` — lancer l'un arrête l'autre :

- **`start-fobos-hf.sh`** — les entrées HF1/HF2 en échantillonnage direct, 0-25 MHz, sur le port 9003. Dans ce mode il n'y a pas d'oscillateur local : l'ADC numérise 0-25 MHz en permanence (`-f 0` est voulu, et l'avertissement *Failed to set center freq* de rx_sdr est attendu). `rx_sdr` fournit du CF32 à 50 Msps ; le petit convertisseur `cf32_to_real` (compilé par `setup-fobos.sh` à partir de `cf32_to_real.c`) garde la voie I et la met à l'échelle en s16, d'où `signal="real"` et `format="s16"` dans `config-fobos-hf.toml`.
- **`start-fobos.sh`** — la voie RF, 25-6000 MHz, IQ, sur le port 9002. Choisissez la fenêtre avant le premier lancement : `-f` (centre) et `-s` (fréquence d'échantillonnage) sur la ligne `RX_ARGS` doivent correspondre à `frequency=` et `sps=` dans `config-fobos.toml`. Les valeurs livrées (97 MHz, 20 Msps) ne sont qu'un point de départ pour vérifier que cela tourne.

> [!IMPORTANT]
> `config-fobos-hf.toml` est livré avec `accelerator="opencl"` : un flux de 50 Msps à travers une FFT de 1M bins est aussi lourd que les 60 Msps du RX888, et sur le CPU il perd des échantillons et fait chauffer la machine. Sur une machine sans périphérique OpenCL, `spectrumserver` ne démarre pas avec ce réglage — mettez-y `accelerator="none"`.

SoapyFobosSDR a besoin des en-têtes de libfobos et de libfobos-sdr-agile pour se compiler, donc `setup-fobos.sh` compile les deux, même pour le firmware standard. La prise en charge du Fobos vient d'un script écrit par une autre station après avoir mis un Fobos en service sous PhantomSDR-Plus ; les valeurs HF de `config-fobos-hf.toml` sont celles qui ont fonctionné chez elle.

#### Airspy HF+

`setup-airspyhf.sh` installe libairspyhf depuis la distribution là où elle est empaquetée (Debian et Ubuntu, Fedora, openSUSE) et la compile depuis les sources ailleurs (Arch ne l'a que dans l'AUR), puis compile SoapyAirspyHF (`driver=airspyhf`). `start-airspyhf.sh` fournit 912 ksps IQ en CS16, que `config-airspyhf.toml` lit en `format="s16"`. Le fichier inclus `instructions-for-airspy` décrit la voie manuelle.

### RX888 MK2

#### Installez les outils RX888

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

#### Exécuter rx888_stream sans sudo (règles udev)

Par défaut, le périphérique USB Cypress FX3 du RX-888 n'est accessible qu'à root, donc `rx888_stream` nécessiterait `sudo`. Exécutez une fois l'assistant fourni pour installer les règles udev et vous ajouter au groupe `plugdev` :

```bash
./setup-rx888-udev.sh          # re-runs itself with sudo automatically
```

Il écrit `/etc/udev/rules.d/99-rx888.rules` pour les trois identifiants de produit Cypress FX3 (`04b4:00f1`/`00f3` bootloader et `04b4:8613` firmware chargé), recharge udev et crée un lien symbolique stable `/dev/rx888`. **Déconnectez-vous puis reconnectez-vous** (pour le changement de groupe) et **rebranchez l'appareil** une fois ; ensuite `rx888_stream` — et le lanceur `start-rx888mk2.sh` — s'exécutent sans `sudo`. Le script est idempotent : vous pouvez le relancer sans risque. Pour configurer un autre compte : `RX888_USER=<nom> ./setup-rx888-udev.sh`.

#### Modifiez la configuration

```bash
nano config-rx888mk2.toml
```

Réglages courants pour le RX888 :
```toml
sps = 60000000
frequency = 0
signal = "real"
format = "s16"
fft_size = 4194304
```

### HackRF One

Pour le HackRF, rien n'est compilé : `hackrf_transfer`, du paquet `hackrf` de votre distribution, transmet les échantillons directement à `spectrumserver`. `./setup-hackrf.sh` (option 7 de l'installateur) installe ce paquet avec apt, dnf, pacman ou zypper et ajoute une règle udev et le groupe `plugdev`, pour que `start-hackrf.sh` tourne sans `sudo` — déconnectez-vous et reconnectez-vous une fois ensuite.

```bash
./setup-hackrf.sh    # installs the hackrf package and the udev rule
hackrf_info          # with the HackRF plugged in: must list the board
```

`start-hackrf.sh` diffuse une fenêtre à la fois. Choisissez-la avant le premier lancement : `-f` (centre) et `-s` (fréquence d'échantillonnage) sur sa ligne `RX_ARGS` doivent correspondre à `frequency=` et `sps=` dans `config-hackrf.toml`. `-l` et `-g` sont les gains du LNA (0-40 dB, pas de 8 dB) et du VGA (0-62 dB, pas de 2 dB), et `-a 1` allume l'amplificateur RF. Les valeurs livrées (98 MHz, 20 Msps) ne sont qu'un point de départ pour vérifier que cela tourne.

`hackrf_transfer` écrit de l'IQ 8 bits **signé**, la configuration a donc besoin de `format="s8"`. `config.example.hackrf.toml` indiquait `u8` jusqu'en septembre 2026 ; avec `u8` chaque échantillon est décalé de 128 et la chute d'eau ne montre que du bruit — vérifiez toute copie plus ancienne.

---

## Tests et vérification

### 1. Essai

```bash
# For RTL-SDR
./start-rtl.sh
```

Cela démarre le serveur **en arrière-plan** (il se détache et rend la main immédiatement) et commence à journaliser dans `logwebsdr.txt`.

### 2. Recherchez d'éventuelles erreurs

Le script journalise sa progression dans `logwebsdr.txt` — suivez-la en direct :

```bash
tail -f logwebsdr.txt
```

Cherchez :
- ✅ `Starting the initialization script of the PhantomSDR Server`
- ✅ `<receiver> running (PID …)`
- ✅ `Server started normally`
- ❌ `Server … FAILED …` ou `ERROR: receiver binary '…' not found` (corrigez les arguments du récepteur ou le `.toml`, ou installez l'outil du récepteur, puis relancez le script de démarrage)

### 3. Accédez à l'interface web

Ouvrez votre navigateur sur :
```
http://localhost:9002
```

(Remplacez le numéro de port par celui que vous avez configuré)

### 4. Vérifiez le fonctionnement

- La cascade doit s'afficher
- L'audio doit jouer lorsque vous cliquez sur des signaux
- Le S-mètre doit réagir aux signaux
- Le nombre d'utilisateurs doit indiquer « 1 »

### 5. Testez depuis un autre appareil

Depuis un autre ordinateur de votre réseau :
```
http://YOUR_SERVER_IP:9002
```

### 6. Vérifiez l'utilisation des ressources

```bash
# Monitor CPU usage
htop

# Monitor GPU usage (if OpenCL/CUDA enabled)
nvidia-smi  # For NVIDIA
radeontop   # For AMD

# Monitor network usage
iftop
```

### 7. Arrêtez le serveur

Le serveur s'exécute en arrière-plan sous la surveillance d'un chien de garde : **Ctrl+C ne l'arrêtera donc pas** (et le chien de garde le relancerait). Utilisez le script d'arrêt partagé, valable pour tous les récepteurs — il arrête d'abord le chien de garde, puis le récepteur et `spectrumserver` :

```bash
./stop-websdr.sh
```

---

## Mise en place du démarrage automatique

### Avec systemd (recommandé)

#### 1. Créez le fichier de service

```bash
sudo nano /etc/systemd/system/phantomsdr.service
```

Ajoutez le contenu suivant (ajustez les chemins et l'utilisateur) :

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

> Le processus `--watchdog` relance déjà de lui-même le récepteur et `spectrumserver` ; `Restart=always` n'est qu'un filet de sécurité pour le cas rare où le chien de garde s'arrêterait lui-même. Comme systemd supervise ici le serveur, vous pouvez utiliser `systemctl start/stop/restart` et `journalctl -u phantomsdr -f` au lieu de lancer les scripts à la main.

#### 2. Activez et démarrez le service

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

#### 3. Gérez le service

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

### Avec Screen (alternative)

> Généralement inutile : `./start-rtl.sh` se détache déjà en arrière-plan (via `setsid`) et continue de tourner après votre déconnexion, avec son propre chien de garde. Screen n'est utile que si vous voulez expressément une session interactive pour exécuter la forme au premier plan `./start-rtl.sh --watchdog`.

#### 1. Installez Screen

```bash
sudo apt install -y screen
```

#### 2. Démarrez dans une session Screen

```bash
screen -S phantomsdr
./start-rtl.sh
```

Appuyez sur Ctrl+A, puis D pour détacher.

#### 3. Rattachez-vous à la session

```bash
screen -r phantomsdr
```

---

## Protection thermique du processeur

> 📖 **Manuel complet : [THERMAL_GUARD.md](THERMAL_GUARD.md)** — les quatre modes et ce que le sysop doit faire pour chacun, le fonctionnement sans le panneau, l'étage throttle sans root, les tests et le dépannage.

PhantomSDR-Plus embarque un garde qui arrête le serveur si le processeur atteint une température dangereuse et le relance une fois refroidi. Il déduit ses seuils du seuil critique que publie votre propre processeur, il n'y a donc rien à calculer, et il fonctionne quelle que soit votre méthode de démarrage/arrêt.

**Si vous utilisez le panneau d'administration, vous l'avez déjà** : il tourne dans le panneau et se configure depuis sa page Paramètres. Voir le [guide du panneau d'administration](ADMIN_PANEL_SETUP.md#thermal-guard). Le reste de cette section concerne les installations **sans** panneau.

### 1. Vérifier ce que le garde voit sur votre machine

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

Seuls de vrais capteurs sur la puce sont utilisés (`coretemp`, `k10temp`, `zenpower`, `cpu_thermal`) ; `acpitz` et les zones thermiques non étiquetées sont ignorés à dessein, car ils rapportent souvent une température de boîtier ou de carte inférieure de plusieurs dizaines de degrés au processeur. Si cela affiche `sensor : NONE`, cette machine ne peut pas être protégée — fréquent sur un VPS ou dans un conteneur — et le garde restera inactif plutôt que de faire semblant.

Rien à installer : `thermal_guard.py` n'utilise que la bibliothèque standard de Python.

### 2. Le configurer

Le garde lit `admin_config.json` à côté de `thermal_guard.py`. Créez-le si vous n'en avez pas — sans panneau, vous n'en aurez pas. Le fichier minimal utile :

```json
{
  "sdr_process_name": "spectrumserver",
  "stop_script":  "stop-websdr.sh",
  "start_script": "start-rx888mk2.sh",
  "thermal_mode": "stop+restart"
}
```

- `thermal_mode` — `log` (journaliser seulement, la valeur par défaut), `throttle`, `stop` ou `stop+restart`. **C'est celui que vous devez définir**, car le garde est livré inerte : tel quel, il note seulement ce qu'il *aurait* fait. Vous pouvez aussi le passer en ligne de commande avec `--mode stop+restart`, ce qui l'emporte sur le fichier — si tous les autres réglages par défaut vous conviennent, vous n'avez donc besoin d'aucun fichier de configuration.
- `stop_script` / `start_script` — comment il arrête et démarre votre serveur. Sans script d'arrêt, il se rabat sur `SIGTERM` puis, après 10 secondes, sur `SIGKILL` visant `sdr_process_name`. Sans script de démarrage, il arrête mais ne relance jamais.
- Les seuils et durées peuvent aussi être définis ici, avec les mêmes noms de clés que dans le panneau — le tableau complet figure dans le [guide du panneau d'administration](ADMIN_PANEL_SETUP.md#thermal-guard).

> **Si systemd supervise votre serveur SDR**, faites pointer `stop_script` vers un petit script exécutant `systemctl stop votre-unité`, plutôt que de laisser le garde signaler le processus directement. Le garde l'emportera de toute façon — tant que le processeur est trop chaud, il réémet l'arrêt toutes les 2 secondes, si bien que tout ce qui relance le serveur est défait — mais un arrêt propre vaut mieux qu'un bras de fer toutes les deux secondes.

### 3. L'exécuter comme service

Le dépôt contient une unité prête à l'emploi, `thermal-guard.service`. Modifiez-y `User=` et les deux chemins, puis :

```bash
sudo cp thermal-guard.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now thermal-guard
systemctl status thermal-guard
```

`User=` doit être un compte autorisé à exécuter vos scripts de démarrage/arrêt — normalement le même utilisateur que celui qui fait tourner le serveur SDR. **Un garde tournant sous un utilisateur incapable d'arrêter le serveur vous laisse sans protection tout en ayant l'air de vous protéger.**

Pour armer le garde depuis l'unité plutôt que depuis le fichier de configuration, ajoutez `--mode` à `ExecStart` :

```ini
ExecStart=/usr/bin/python3 -u /home/sysop/PhantomSDR-Plus/thermal_guard.py --mode stop+restart
```

Sans systemd :

```bash
cd ~/PhantomSDR-Plus
nohup python3 -u thermal_guard.py --mode stop+restart >> thermal.log 2>&1 &
```

`python3 thermal_guard.py --help` liste toutes les options, dont `--config` pour un fichier de configuration ailleurs qu'à côté du script.

### 4. L'observer, puis lui faire confiance

Tout ce que fait le garde est écrit dans `crash.log`, dans le répertoire PhantomSDR-Plus, un événement par ligne :

```
[THERMAL] warn: 89.0C (warn=88.0 crit=100.0) sustained 31s
[THERMAL] STOPPED server: 96.0C sustained 62s (stop=95.0 crit=100.0) — Started stop-websdr.sh
[THERMAL] lockout: process reappeared at 94.0C — re-stopped [3 time(s) so far]
[THERMAL] recovered: 74.0C held below 75.0 — lockout cleared
```

```bash
grep THERMAL crash.log
```

Laissez d'abord `thermal_mode` sur `"log"` pendant une semaine et lisez ce fichier après vos moments chargés — une recompilation complète, un après-midi de canicule. Si rien n'y figure, votre machine n'a jamais approché. Passez ensuite le mode à `stop`.

Avant de vous y fier, éprouvez tout le parcours une fois avec une mesure fictive au-dessus de votre seuil d'arrêt :

```json
"thermal_test_temp": 97
```

Le garde la traite comme réelle, si bien que warn → stop → verrouillage → récupération → redémarrage se déroulent à la demande. Retirez la ligne (ou mettez-la à `null`) pour revenir au capteur réel. En mode `stop`, cela arrête réellement le serveur et déconnecte vos auditeurs : faites-le quand personne n'écoute, ou testez en `log`, où l'on voit ce qui *serait* arrivé sans rien toucher.

---

## Dépannage

### Erreurs de compilation

#### Problèmes de dépendances

```bash
# Ubuntu: Install missing dependencies
sudo apt install --fix-broken

# Fedora: Install missing dependencies
sudo dnf install <package-name>
```

#### La configuration Meson échoue

```bash
# Clean and reconfigure
rm -rf build
meson setup build --buildtype=release
```

#### `meson setup` s'arrête sur `ModuleNotFoundError: No module named 'mesonbuild'`

```
Traceback (most recent call last):
  File "/home/<user>/.local/bin/meson", line 3, in <module>
    from mesonbuild.mesonmain import main
ModuleNotFoundError: No module named 'mesonbuild'
```

L'arborescence des sources n'est pas en cause. Une ancienne installation par
`pip install --user meson` a laissé un script de lancement dans `~/.local/bin`,
qui passe avant `/usr/bin` dans le `PATH` et masque donc la copie installée par le gestionnaire de paquets. Une montée de version de la distribution (Ubuntu 24.04 → 26.04, par exemple) fait passer Python à une nouvelle version, l'ancien
`site-packages` qui contenait `mesonbuild` n'est plus dans le chemin d'import, et
le script meurt sans avoir rien fait. La même chose peut arriver à `ninja`.

L'installateur détecte ce cas et le contourne le temps de l'exécution, en vous avertissant, mais réparez tout de même le système :

```bash
rm -f ~/.local/bin/meson
hash -r
meson --version        # doit afficher une version
```

Si vous préférez garder meson installé via pip, réinstallez-le pour le Python dont dispose maintenant ce système :

```bash
python3 -m pip install --user --force-reinstall --break-system-packages meson
```

#### `meson setup` s'arrête sur `Clock skew detected`

```
ERROR: Clock skew detected. File /home/pi/PhantomSDR-Plus/build/../meson.build has a time stamp 10392.2144s in the future.
```

L'arborescence des sources n'a rien d'anormal : c'est l'horloge du système qui est en retard sur les fichiers. meson et ninja refusent de compiler quand une entrée est plus récente que l'heure courante, car ils ne peuvent pas savoir ce qui est périmé. Cela arrive sur un Raspberry Pi dont le support de pile RTC est vide — chaque démarrage repart de la dernière heure connue, et une compilation lancée avant que NTP ne se synchronise voit toute l'arborescence datée dans le futur — ainsi que sur une arborescence décompressée ou copiée depuis une machine en avance.

Corrigez d'abord l'horloge :

```bash
timedatectl                       # l'heure est-elle juste ? NTP est-il synchronisé ?
sudo timedatectl set-ntp true
```

Attendez quelques secondes, puis relancez l'installateur. Il vérifie ce point avant d'appeler meson et propose de réinitialiser les horodatages fautifs (`PHANTOM_FIX_CLOCK_SKEW=y|n`). À la main, depuis l'arborescence des sources :

```bash
find . -path ./build -prune -o -path ./.git -prune -o -newermt now -print0 | xargs -0r touch
```

#### Le backend est compilé mais il n'y a pas de page web

Le symptôme est une installation qui semble avoir largement réussi : `build/spectrumserver` est là, le serveur démarre, et le navigateur ne reçoit rien — parce que `frontend/dist/` n'a jamais été produit. Cherchez dans la sortie de l'installateur :

```
[vite-plugin-top-level-await] missing field `type`
    at Compiler.printSync (node_modules/@swc/core/index.js:257:29)
error during build:
   ❌ Failed: Default
```

`vite-plugin-top-level-await` demande `@swc/core` `^1.12.14`, si bien qu'un `npm install` neuf résout vers 1.16.0, dont `printSync()` rejette l'arbre syntaxique que le greffon lui transmet. Cela n'a rien à voir avec votre distribution : chaque installateur épingle désormais la version qui fonctionne, et `frontend/package.json` aussi. Une machine installée avant cet épinglage continue de fonctionner jusqu'à la suppression de son `node_modules` — d'où l'apparition soudaine du problème lors d'une réinstallation.

Si vous réparez à la main une copie plus ancienne :

```bash
cd frontend
npm pkg set 'overrides.@swc/core=1.15.33'
npm install
./build-all.sh
```

### Erreurs d'exécution

#### Port déjà utilisé

```bash
# Find process using port
sudo lsof -i :9002

# Kill process
sudo kill -9 <PID>
```

#### Permission refusée pour le SDR

```bash
# Add user to plugdev group
sudo usermod -a -G plugdev $USER

# Reload groups (or log out and back in)
newgrp plugdev
```

Pour un **RX-888 MkII**, cela ne suffit pas à soi seul — le périphérique Cypress FX3 a aussi besoin de règles udev. Exécutez l'assistant fourni (il installe les règles *et* vous ajoute à `plugdev`), puis déconnectez-vous/reconnectez-vous et rebranchez l'appareil :

```bash
./setup-rx888-udev.sh
```

#### Problèmes audio

```bash
# Try different codec
# Edit config file and change:
audio_compression = "flac"  # or "opus"

# Rebuild
cd frontend && npm run build && cd ..
```

### Problèmes OpenCL

#### clinfo n'affiche aucun appareil

```bash
# Verify drivers are loaded
sudo clinfo

# Check OpenCL ICD files
ls /etc/OpenCL/vendors/

# Reinstall drivers (Intel example)
sudo apt remove --purge intel-opencl-icd
sudo apt install intel-opencl-icd
```

#### Aucune amélioration des performances

```bash
# Verify OpenCL is enabled in config
accelerator = "opencl"

# Try different device
# Add to config file:
[input.opencl]
device_id = 0  # Try 0, 1, 2, etc.
```

### Problèmes réseau

#### Impossible d'accéder depuis d'autres appareils

```bash
# Check firewall
sudo ufw status
sudo ufw allow 9002/tcp

# Or disable firewall temporarily for testing
sudo ufw disable
```

#### Latence élevée

```bash
# Reduce waterfall size in config
waterfall_size = 512

# Increase buffer size
buffer_size = 16384

# Use Opus instead of FLAC
audio_compression = "opus"
```

### Problèmes d'appareil SDR

#### RTL-SDR introuvable

```bash
# Check if device is recognized
lsusb | grep Realtek

# Test with rtl_test
rtl_test

# Try blacklisting DVB-T drivers
echo "blacklist dvb_usb_rtl28xxu" | sudo tee /etc/modprobe.d/blacklist-rtl.conf
sudo rmmod dvb_usb_rtl28xxu
```

#### SDRplay introuvable

`grep "RSP1A driver" logwebsdr.txt` indique le pilote choisi par `start-rsp1a.sh`.

Avec le pilote ouvert (libmirisdr-5, `RSP1A driver: miri`) :

```bash
# The kernel's msi2500 driver must not hold the device
lsmod | grep msi2500 && sudo modprobe -r msi2500 msi001

# Test with SoapySDR
SoapySDRUtil --find="driver=soapyMiri"
```

Avec l'API de SDRplay (`RSP1A driver: sdrplay`) :

```bash
# Check API installation
systemctl status sdrplay

# Restart API
sudo systemctl restart sdrplay

# Test with SoapySDR
SoapySDRUtil --find="driver=sdrplay"
```

#### Fobos ou Airspy HF+ introuvable

```bash
SoapySDRUtil --info | grep -i factories   # must list fobos / airspyhf
SoapySDRUtil --find="driver=fobos"         # or driver=airspyhf
id | grep plugdev                          # log out and back in if missing
```

Si le pilote manque dans la liste, relancez `./setup-fobos.sh` ou `./setup-airspyhf.sh` : il s'arrête en donnant la raison si la compilation ou la vérification SoapySDR échoue.

---

## Optimisation des performances

### Optimisation du processeur

```toml
# Adjust thread counts based on CPU cores
[server]
threads = 4  # Set to number of cores

[input]
fft_threads = 4  # Set to number of cores
```

### Optimisation de la mémoire

```toml
# Reduce memory usage
[input]
waterfall_size = 512  # Lower value = less memory
fft_size = 65536      # Lower value = less memory
```

### Optimisation du réseau

```toml
# Optimize for limited bandwidth
[input]
audio_compression = "opus"  # More efficient than FLAC
waterfall_compression = "zstd"  # Efficient compression
```

---

## Mise à jour de PhantomSDR-Plus

Depuis la version 4.1.0, le dépôt fournit **`update.sh`**, un outil qui met une installation à jour à partir de l'arborescence publiée **sans toucher aux fichiers qui font qu'elle est votre station**. Il remplace le script `git pull` que les éditions précédentes de ce guide vous demandaient d'écrire, et il n'a pas besoin de git du tout : l'arborescence publiée est téléchargée sous forme d'archive tar et comparée à la vôtre fichier par fichier. Il fonctionne donc de la même façon que vous ayez cloné le dépôt, décompressé un `update.zip` ou copié l'arborescence depuis une clé USB.

### Si votre installation n'a pas encore update.sh

Une arborescence ancienne ne contient pas le script. Récupérez-le une fois : c'est la seule étape de toute cette procédure que vous ferez à la main :

```bash
cd ~/PhantomSDR-Plus
curl -fLO https://raw.githubusercontent.com/sv1btl/PhantomSDR-Plus/main/update.sh
chmod +x update.sh
```

Ensuite tout — sources, frontend, documentation, installateurs et `update.sh` lui-même — arrive par l'outil.

### Étape 1 — voir ce qui changerait (rien n'est écrit)

```bash
cd ~/PhantomSDR-Plus
./update.sh
```

L'arborescence publiée est téléchargée, comparée à la vôtre, et un rapport est affiché. Rien n'est écrit, l'appel est donc sans danger à tout moment, y compris sur un récepteur en service. Le code de retour vaut `0` si vous êtes à jour et `10` si une mise à jour attend : une tâche cron peut ainsi vous prévenir lorsqu'il y a quelque chose à faire.

### Étape 2 — l'appliquer

```bash
./update.sh --apply
```

Trois catégories de fichiers sont traitées différemment, et c'est tout l'intérêt :

| Fichiers | Ce qui se passe |
|---|---|
| `config*.toml`, `markers.json`, `admin_config.json`, `autorun.json`, `frequencylist/`, `chat_history.txt`, `frontend/variant.json`, `frontend/site_information.json`, les journaux, `build/`, `frontend/dist/` | **Jamais touchés**, et jamais mentionnés dans une question. Ce sont eux qui font de la machine *votre* récepteur. |
| `start-*.sh`, `stop-websdr.sh`, les unités `*.service`, `install*.sh`, `recompile.sh`, `setup_admin.sh`, `smeter_theme.sh`, `proxy.py`, `admin_server.py`, `thermal_guard.py`, `frontend/src/bands-config.js` | **Toujours soumis à une question**, car ce sont les fichiers qu'un sysop a de bonnes raisons d'avoir modifiés. |
| Tout le reste | Mis à jour, après copie de l'ancien fichier dans `.update-backups/`. |

Pour chaque fichier du groupe du milieu, les différences sont affichées et trois choix sont proposés :

```
  ❓ start-rx888mk2.sh  [K]eep mine / [u]pstream / [b]oth  (ENTER = Keep mine)
```

* **Keep mine** — votre fichier est laissé exactement tel quel.
* **upstream** — la nouvelle version est installée, la vôtre étant sauvegardée au préalable.
* **both** — la nouvelle version est écrite à côté de la vôtre sous le nom
  `start-rx888mk2.sh.new`, pour que vous y reportiez vos modifications à votre rythme.

**À quoi ressemble une première exécution.** La première fois, rien n'indique de quelle
version viennent vos fichiers : chaque fichier du groupe du milieu vous est donc soumis, soit une dizaine de questions. Répondez ainsi :

| Votre situation | Réponse |
|---|---|
| Vous n'avez jamais modifié ce fichier | `u` — prendre la nouvelle version. Le cas habituel. |
| Vous l'avez modifié (vos `RX888_ARGS`, l'épinglage CPU, une unité ajustée) | `b` — le vôtre est conservé et le nouveau arrive à côté sous `<fichier>.new`. |
| Vous n'êtes pas sûr | ENTRÉE — le vôtre est conservé, rien n'est perdu, vous comparerez plus tard. |

Votre configuration n'entre jamais là-dedans : les questions ne portent que sur des scripts et des unités de service.

`update.sh` note dans `.update-state/` la version de chaque fichier qu'il installe. Dès la
deuxième exécution, il distingue donc un fichier que **vous** avez modifié d'un fichier simplement ancien, et ne s'arrête que sur ceux auxquels vous avez réellement touché.

Avant d'écrire quoi que ce soit, il arrête le récepteur, le panneau d'administration et le proxy inverse **de l'installation qu'il met à jour** — ce qui dessert un autre répertoire est signalé et laissé en marche, de sorte qu'un second clone peut être mis à jour pendant que le premier reste en service — puis redémarre à la fin exactement ce qu'il a arrêté. Si des fichiers source ou du frontend ont changé, il propose de lancer `recompile.sh` pour vous. Rien n'est jamais supprimé : les fichiers disparus du dépôt sont signalés et ne sont retirés que si vous le demandez avec `--prune`.

### Annuler une mise à jour

```bash
./update.sh --restore LAST
```

Chaque fichier écrasé est conservé dans `.update-backups/<horodatage>/` avec son propre
`restore.sh` ; les trois dernières exécutions sont gardées.

### Autres options

```bash
./update.sh --apply --yes     # ne demande jamais rien ; tout fichier modifié est CONSERVÉ
./update.sh --ref v4.1.0      # une étiquette, une branche ou un commit précis
./update.sh --list-excludes   # affiche les règles « ne pas toucher » telles qu'appliquées ici
./update.sh --verbose         # liste tous les fichiers, pas seulement les 40 premiers
```

Vous pouvez ajouter vos propres règles « ne pas toucher » en écrivant un motif par ligne dans
`update-exclude.txt`, à la racine de l'installation.

### Si la recompilation échoue sur une installation très ancienne

`update.sh` met à jour des fichiers, pas des paquets système. Si votre arborescence est
assez ancienne pour que la compilation réclame des bibliothèques que vous n'avez pas,
`recompile.sh` s'arrêtera sur une erreur du compilateur ou de meson. Ce n'est pas une mise à
jour cassée : il manque les dépendances :

```bash
./install.sh
```

L'installateur est lui-même mis à jour par la même exécution, et votre configuration y survit également.

### Mettre à jour à la main

Si vous préférez appliquer vous-même un lot de fichiers :

```bash
cd ~
unzip -o update.zip
cd PhantomSDR-Plus
./stop-websdr.sh
cp -a ~/update/. .
chmod +x *.sh
./recompile.sh
./start-rx888mk2.sh          # ou le script de démarrage de votre récepteur
```

Sauvegardez d'abord votre configuration — `config-*.toml`, `frontend/site_information.json`,
`admin_config.json` et `markers.json` — car un lot de fichiers ne peut pas distinguer vos
modifications de celles de la version publiée. C'est exactement le problème que `update.sh` résout.

---

## Sauvegarde et restauration

### Fichiers à sauvegarder

- Fichiers de configuration : `*.toml`
- Informations du site : `frontend/site_information.json`
- Marqueurs : `markers.json`
- Scripts personnalisés : `start-*.sh`, `stop-*.sh`
- Historique du chat : `chat_history.txt`
- Image de fond : `frontend/src/assets/background.jpg`

### Commande de sauvegarde

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

### Commande de restauration

```bash
tar -xzf phantomsdr-backup-YYYYMMDD.tar.gz
```

---

## Considérations de sécurité

### Configuration du pare-feu

```bash
# Allow only necessary ports
sudo ufw allow 9002/tcp
sudo ufw enable
```

### Proxy inverse (facultatif)

Envisagez d'utiliser nginx ou Apache comme proxy inverse pour :
- le chiffrement SSL/TLS
- l'association d'un nom de domaine
- la répartition de charge
- le contrôle d'accès

### Limites d'utilisateurs

Modifiez `config.toml` :
```toml
[server]
max_users = 100  # Limit concurrent users
```

---

## Obtenir de l'aide

### Ressources

- **Documentation** : ce guide, README.md, USER_GUIDE.md
- **GitHub Issues** : https://github.com/sv1btl/PhantomSDR-Plus/issues
- **Démo en direct** : http://phantomsdr.no-ip.org:8900/

### Signaler un problème

Lorsque vous signalez un problème, indiquez :
1. le système d'exploitation et sa version
2. le modèle d'appareil SDR
3. le contenu du fichier de configuration
4. les messages d'erreur
5. l'utilisation des ressources système (CPU, RAM, GPU)

### Soutien de la communauté

- Consultez les issues GitHub existantes avant d'en créer de nouvelles
- Fournissez des informations détaillées sur votre installation
- Joignez les journaux et les messages d'erreur
- Soyez patient et respectueux

---

## Annexe A : liste complète des dépendances

### Liste des paquets Ubuntu 24.04

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

## Annexe B : exemples de configuration

### Exemple 1 : RTL-SDR pour VHF/UHF

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

### Exemple 2 : RX-888 mk2 pour HF (0-30 MHz)

Le récepteur qu'utilisent la plupart des sysops. Voici une section `[input]` complète, et non un extrait, avec les valeurs du `config-rx888mk2.toml` fourni avec le dépôt.

```toml
[input]
sps = 60000000            # 0-30 MHz par échantillonnage direct
fft_size = 4194304        # voir la note ci-dessous
fft_threads = 8
brightness_offset = -9    # plus négatif si la cascade montre des zones noires
frequency = 0             # bande de base : le RX-888 échantillonne depuis le continu
signal = "real"           # pas "iq" : l'échantillonnage direct donne un flux réel
accelerator = "opencl"    # "none" s'il n'y a pas d'environnement OpenCL
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

Il est alimenté par `rx888_stream`, ce dont `start-rx888mk2.sh` se charge pour vous :

```bash
rx888_stream -f /path/to/SDDC_FX3.img -s 60000000 -g 50 -a 0 -m low --pga -d -r -o - \
  | build/spectrumserver --config config-rx888mk2.toml
```

**À propos de `fft_size` :** à 60 MSPS, la bonne taille est 4194304. 8388608 double la résolution de la cascade et, avec elle, la mémoire et le coût CPU de chaque transformée : sur la plupart des machines, on paie des bins plus fins par des trames perdues. Commencez à 4194304 et ne montez que si le serveur est largement au repos.

### Exemple 3 : HackRF pour la FM à large bande

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

**Installation terminée ! Vous devriez maintenant disposer d'un serveur PhantomSDR-Plus pleinement fonctionnel.**

**73 de SV1BTL & SV2AMK**
