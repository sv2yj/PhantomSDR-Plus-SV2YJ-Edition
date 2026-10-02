# PhantomSDR-Plus

**Un serveur WebSDR open-source amélioré, doté de fonctions avancées et d'un design futuriste**

PhantomSDR-Plus est un fork de PhantomSDR qui fournit un serveur web de radio logicielle (SDR) haute performance, capable de gérer des centaines d'utilisateurs simultanés. Il propose une interface utilisateur améliorée, la prise en charge de plusieurs décodeurs, la visualisation du plan de bandes et la compatibilité avec diverses plateformes matérielles SDR.

---

## 🌟 Fonctions principales

### Performances et évolutivité
- **Multi-utilisateurs** : gère des centaines d'utilisateurs simultanés selon le matériel
- **Taux d'échantillonnage élevé** : prise en charge des SDR jusqu'à 70 MSPS (réel) / 35 MSPS (IQ)
- **Accélération matérielle** : prise en charge d'OpenCL et de CUDA pour un traitement accéléré par GPU
- **Diffusion optimisée** : compression audio FLAC et Opus à faible latence

### Interface utilisateur
- **Design futuriste** : interface web moderne et responsive
- **Optimisée pour mobile** : interface mobile améliorée pour l'écoute en déplacement
- **Visualisation du plan de bandes** : cascade interactive avec superposition des bandes de fréquences
- **Palettes personnalisables** : plusieurs jeux de couleurs pour la cascade
- **Double S-mètre** : au choix, affichage analogique ou numérique du niveau de signal
- **Boutons de décodeur en une pression** : une rangée Decoders sur le panneau principal, juste sous le sélecteur de modes (FT8, FT4, FT2, JS8, CW, WSPR, FAX, SSTV, NAVTX, RTTY), avec RADEL et RADEU à côté du sélecteur de modes lui-même et repris dans les fenêtres surgissantes des modes et des bandes. Une pression démarre le décodeur et ouvre sa fenêtre, une seconde l'arrête. L'ancienne rangée de largeur de bande a été supprimée.
- **Scanner de canaux** : balaie la bande, ou exactement ce que montre la cascade, et s'arrête sur le premier canal dépassant d'un nombre de dB choisi le plancher de bruit de la bande elle-même, puis repart tout seul dès que ce canal redevient silencieux. Le pas suit le mode et les arrêts tombent sur la grille de canaux (1 kHz SSB, 100 Hz CW, 5 kHz AM ondes courtes, 9/10 kHz ondes moyennes, 9 kHz ondes longues). Un mode *Sauter les vides* lit le spectre de la cascade et saute directement aux signaux, et un bouton de verrouillage retire du balayage un canal toujours occupé. Tout se passe localement dans le navigateur de l'auditeur : le balayage ne déplace le récepteur pour personne d'autre (voir le [Guide de l'utilisateur](USER_GUIDE.md))
- **Diversité de réception** : associe le récepteur à un second situé ailleurs et restitue celui des deux qui a le meilleur signal à cet instant, de sorte qu'un évanouissement d'un côté est couvert par l'autre. Le second peut être un autre PhantomSDR-Plus, un KiwiSDR, un UberSDR ou un WebSDR ; les trois premiers ne demandent rien de plus que le navigateur de l'auditeur, et seul un WebSDR nécessite un petit relais sur votre propre serveur. L'alignement prend une quinzaine de secondes, et un réglage de SNR distant équilibre les deux stations l'une par rapport à l'autre. Chaque auditeur conserve dans son propre navigateur une liste nommée de seconds récepteurs, dans l'ordre qu'il veut, et peut l'exporter dans un fichier puis la réimporter (voir [Diversité de réception](RECEIVE_DIVERSITY.md))

### Traitement du signal
- **Modes de démodulation multiples** : AM, FM, USB, LSB, CW et davantage. Un décodeur RADE version 1 a également été implémenté.
- **Détection AM synchrone** : meilleure qualité de réception en AM
- **Réduction de bruit** : NR (spectrale), NB (silencieux d'impulsions), NS (suppression du bruit de fond) et AN (notch automatique), tous sur l'écoute et jamais sur les décodeurs
- **Options AGC** : plusieurs modes de contrôle automatique de gain
- **Squelch automatique** : seuil de squelch calculé automatiquement d'après le bruit
- **Réduction de bruit par IA** : réseau de neurones RNNoise dans le navigateur de l'auditeur, retire le bruit de bande de la parole (modes phonie seulement ; voir le [Guide de l'utilisateur](USER_GUIDE.md))

### Fonctions avancées
- **Décodeurs numériques** : FT8, FT4, FT2, JS8, CW, QRSS Grabber, WSPR, FAX HF, SSTV, NAVTEX, FSK/RTTY, PSK31, Olivia et FreeDV RADE, chacun s'exécutant sur son propre thread d'arrière-plan afin que le décodage n'interrompe jamais l'audio (voir [Décodeurs](DECODERS.md))
- **Decoder ID** : nomme le mode numérique présent dans la bande passante et propose le décodeur correspondant en un clic, à partir de la largeur de bande, de l'écart entre tons, de la rapidité de modulation et du rythme des salves mesurés, la fréquence étant prise en compte comme indice supplémentaire — ce qui distingue aussi **FT8 de JS8**, deux modes au signal identique. Il ne fait que suggérer, ne bascule jamais de lui-même, et préfère se taire plutôt que deviner quand le signal est trop faible. Le fading ne le réduit pas au silence : quand le QSB découpe en fragments une émission WSPR de deux minutes, il nomme toujours le mode, lisant la cadence sur tout l'historique d'écoute, et abaisse la confiance affichée pour signaler une preuve plus faible. Entre 400 Hz et 2700 Hz environ, la position dans la bande passante est sans importance ; au-delà, un bouton ambre **Recentre & retry** apparaît, qui déplace l'accord une fois et relance la mesure. Lorsque vous acceptez une suggestion, le récepteur est réglé pour ce mode : la fréquence accordée passe au milieu de la cascade, la vue s'établit sur environ 100 kHz autour d'elle, et la bande latérale ainsi que la bande passante deviennent celles avec lesquelles ce mode se travaille — la sous-bande de 3 kHz pour la famille FT8, 1350–1650 Hz pour WSPR, ±250 Hz et CW pour la télégraphie, et ainsi de suite. Désactivé par défaut, et environ 0,5 % d'un cœur en fonctionnement (voir [Décodeurs](DECODERS.md))
- **Préréglages des modes numériques** : FT8, FT4, FT2, JS8 ou WSPR règlent à la fois la bande latérale et la bande passante
- **Panneau de conversation JS8** : les messages en plusieurs trames sont réassemblés en phrases complètes
- **Tableau de bord de statistiques** : statistiques du serveur et des utilisateurs en temps réel
- **Liste des utilisateurs connectés** : toutes les personnes à l'écoute, avec un bouton d'accord sur chaque ligne. Votre propre session est marquée **you**, aussi bien dans la fenêtre de l'interface que lorsque `users.html` est ouvert comme page autonome
- **Report automatique des spots** : un démon autorun décode FT8, FT4 et WSPR sur le serveur et téléverse les spots vers PSK Reporter et WSPRnet, avec deux compteurs dans le panneau d'administration — des tuiles par décodeur pour l'exécution en cours et un total depuis toujours à côté de chaque case bande/mode
- **Graphiques du serveur** : une page **Graphiques** du panneau d'administration traçant la fréquence du processeur, la charge, la température et les utilisateurs connectés sur les 15 dernières minutes à 24 heures (voir [Panneau d'administration](ADMIN_PANEL_SETUP.md))
- **Protection thermique** : un garde intégré au panneau d'administration arrête le serveur si le processeur surchauffe et le relance une fois refroidi, avec des seuils déduits du seuil critique de votre propre processeur et sans aucune hypothèse sur votre façon de démarrer ou d'arrêter le serveur ; livrée en mode journalisation seule, elle ne fait rien tant que vous ne l'activez pas (voir [Thermal Guard](THERMAL_GUARD.md)) Pour un récepteur non surveillé, il est **fortement recommandé** de faire tourner le panneau en unité systemd : le garde vit à l'intérieur, sinon un redémarrage emporte la protection avec lui (voir [Panneau d'administration](ADMIN_PANEL_SETUP.md#redémarrer-le-panneau)).
- **Émulation des clients KiwiSDR** : une passerelle facultative qui répond aussi au protocole KiwiSDR, sur le même hôte et le même port, si bien que les logiciels Kiwi comme **AetherSDR** et `kiwiclient` se connectent directement au récepteur — avec un accord réel, la cascade et un S-mètre à la même échelle que celui de la page web. Inactive tant que `[kiwi_emulation] enabled = true` n'est pas dans votre configuration (voir [Installation](Aether_config.md))
- **Pilotage du transceiver (CAT)** : garde votre propre poste et la fenêtre du récepteur sur la même fréquence, le même mode et la même largeur de filtre, dans un sens ou dans les deux — par le menu Rig de [Desktop PhantomSDR+](https://www.dropbox.com/scl/fo/kjwj96zg3kj7dgq4fjef9/APnA3c9hhv4hk3YMGIGjH7s?rlkey=jfiwklly63kv73poalx631pk3&st=m37uvaym&dl=0) (Icom, Yaesu, Kenwood, Elecraft, FlexRadio et QRP Labs en direct, tout autre poste via Hamlib, ou flrig) ou avec le CATsync Tool for WebSDRs dans un navigateur. Les pages proposent des fonctions `catsync_*` pour la fréquence, le mode, la largeur de filtre et la coupure du son. Cela fonctionne avec les récepteurs PhantomSDR-Plus, KiwiSDR, PA3FWM WebSDR et UberSDR (voir [Pilotage du transceiver](RIG_CONTROL.md))
- **Système de favoris** : import/export de fréquences favorites
- **Raccourcis clavier** : navigation et commande efficaces
- **Prise en charge de la molette** : accord en fréquence intuitif
- **Annuaire WebSDR** : intégration avec https://sdr-list.xyz

---

## 📋 Matériel pris en charge

PhantomSDR-Plus prend en charge une large gamme de récepteurs SDR :

| Appareil | Taux d'échantillonnage | Format | Interface |
|----------|------------------------|--------|-----------|
| **RX888 MK2** | Jusqu'à 64 MHz | 16 bits | Native |
| **RTL-SDR** | Jusqu'à 3.2 MHz | 8 bits | rtl_sdr |
| **HackRF One** | Jusqu'à 20 MHz | 8 bits | hackrf_transfer |
| **Airspy HF+ / Discovery** | Jusqu'à 912 kHz | 16 bits | SoapySDR (SoapyAirspyHF) + rx_sdr |
| **SDRplay RSP1A** | Jusqu'à 10 MHz | 16 bits | SoapySDR (libmirisdr-5 + SoapyMiri, ou l'API SDRplay) + rx_sdr |
| **RigExpert Fobos SDR** | 50 MHz (HF, échantillonnage direct) / jusqu'à 20 MHz (RF) | 16 bits / flottant 32 bits | SoapySDR (SoapyFobosSDR) + rx_sdr |
| **Autres appareils** | Variable | Divers | SoapySDR/rx_tools |

---

## 🚀 Démarrage rapide

### Configuration système requise

**Minimum :**
- Ubuntu 22.04 LTS (recommandé) ou Fedora
- Processeur 2 cœurs
- 4 Go de RAM
- 10 Go d'espace disque

**Recommandé :**
- Ubuntu 24.04 LTS
- Processeur 4 cœurs ou plus (Ryzen 5 2600 ou Intel i5-6500T, ou mieux)
- 8 Go de RAM
- GPU compatible OpenCL (facultatif mais vivement recommandé)
- Stockage SSD

### Installation

```bash
# Cloner le dépôt
git clone --recursive https://github.com/sv1btl/PhantomSDR-Plus
cd PhantomSDR-Plus

# Rendre les scripts exécutables
chmod +x *.sh

# Lancer l'installation automatique
./install.sh
```

**Remarque :** après avoir exécuté `install.sh`, redémarrez votre terminal avant de continuer.

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

Utilisez `install_fedora.sh` sur Fedora, `install_arch.sh` sur Arch ou `install_opensuse.sh` sur openSUSE Tumbleweed : ils font le même travail avec un autre gestionnaire de paquets. Toutes les versions de Debian et d'Ubuntu sont couvertes par `install.sh` lui-même.

Rien n'est à installer à la main au préalable. Le script installe les dépendances de compilation et Node.js, compile le backend, compile le pilote du récepteur que vous choisissez (et, pour le RX888, les règles udev avec), ouvre `site_information.json` pour que vous le remplissiez, construit le frontend, installe OpenCL quand le matériel le permet, puis met en place le **panneau d'administration**, le **décodeur FreeDV RADE** et le **serveur de statistiques** — les trois par défaut, répondez `n` pour en sauter un — et se termine par un `recompile.sh` complet. Il est interactif d'un bout à l'autre et peut durer de vingt minutes à plus d'une heure.

Pour le détail étape par étape, voir [INSTALLATION.md → Ce que fait l'installateur](INSTALLATION.md#ce-que-fait-linstallateur). Pour des instructions d'installation détaillées, voir [INSTALLATION.md](INSTALLATION.md).

---

## 📊 Mesures de performance

| Matériel | Taux d'échantillonnage | Charge CPU | Capacité utilisateurs |
|----------|------------------------|------------|------------------------|
| Ryzen 5 2600 (tous cœurs) | 64 MHz (32 MHz IQ) | 38-40 % | 100+ utilisateurs |
| AMD RX 580 (GPU) | 64 MHz (32 MHz IQ) | 28-35 % | 100+ utilisateurs |
| Intel i5-6500T (avec OpenCL) | 60 MHz (30 MHz IQ) | 10-12 % | 100+ utilisateurs |

*Remarque : la charge CPU supplémentaire par utilisateur est minime (< 1 % par utilisateur) lorsque l'accélération matérielle est activée.*

---

## 🎯 Utilisation

### Fonctionnement de base

1. **Configurez votre SDR** : modifiez le fichier de configuration approprié (par ex. `config-rtl.toml`)
2. **Mettez à jour les informations du site** : modifiez `frontend/site_information.json`
3. **Démarrez le serveur** : lancez le script de démarrage approprié :
   ```bash
   ./start-rtl.sh      # Pour RTL-SDR
   ./start-rsp1a.sh    # Pour SDRplay RSP1A
   ./start-airspyhf.sh # Pour Airspy HF+
   ./start-fobos-hf.sh # Pour RigExpert Fobos SDR, HF1/HF2 (0-25 MHz)
   ./start-fobos.sh    # Pour RigExpert Fobos SDR, RF (25-6000 MHz)
   ./start-hackrf.sh   # Pour HackRF One
   ./start-rx888mk2.sh # Pour RX888 MK2
   ```
   Le RSP1A, l'Airspy HF+ et le Fobos passent par SoapySDR et `rx_sdr` ; l'installateur prépare leur pilote quand vous les choisissez (options 3, 6 et 5), ou lancez `./setup-rsp1a.sh`, `./setup-airspyhf.sh` ou `./setup-fobos.sh` sur une station déjà installée. Voir [INSTALLATION.md](INSTALLATION.md#récepteurs-sur-soapysdr-rsp1a-fobos-airspy-hf). Le HackRF One (option 7) n'a besoin que du paquet `hackrf` de la distribution : `./setup-hackrf.sh`.
   Chaque script de démarrage est **autonome** : il arrête toute instance en cours, lance le récepteur + `spectrumserver`, **passe en arrière-plan** (il survit à la fermeture du terminal) et exécute un **chien de garde** qui relance automatiquement la chaîne si elle s'arrête. La progression est journalisée dans `logwebsdr.txt` — suivez-la avec `tail -f logwebsdr.txt`. Relancer un script de démarrage équivaut à un redémarrage propre, et un verrou `flock` garantit qu'un seul récepteur fonctionne à la fois. Facultatif : `SPECTRUM_CORES=0-3` pour épingler des cœurs CPU, `RX_ARGS="…"` pour remplacer les arguments du récepteur sans modifier le fichier (`RX888_ARGS` pour le RX888), `RX_DRIVER=miri|sdrplay` pour choisir le pilote du RSP1A.
4. **Accédez à l'interface** : ouvrez votre navigateur sur `http://localhost:PORT` (le port par défaut dépend de la configuration)

### Arrêt du serveur

Un seul script d'arrêt partagé fonctionne pour **tous** les récepteurs — il arrête d'abord le chien de garde (pour qu'il ne puisse pas relancer le service), puis le récepteur et `spectrumserver` :

```bash
./stop-websdr.sh
```

---

## 🔧 Configuration

### Fichiers de configuration essentiels

1. **`config-[appareil].toml`** – configuration du serveur et du SDR
   - Paramètres du serveur (port, threads, racine HTML)
   - Paramètres d'entrée (taux d'échantillonnage, taille FFT, fréquence)
   - Options d'enregistrement WebSDR
   - Paramètres de compression audio
   - Après modification, redémarrez le serveur.

2. **`frontend/site_information.json`** – informations publiques du site
   - Détails de l'opérateur (indicatif, e-mail, localisation)
   - Informations sur le matériel et l'antenne
   - Paramètres de région et de largeur de bande
   - Activation/désactivation du chat
   - Après modification, exécutez recompile.sh dans un terminal.

3. **`markers.json`** – marqueurs de fréquence et plan de bandes

4. **`frontend/src/bands-config.js`** – configuration du plan de bandes Ce fichier se trouve dans frontend/src/bands-config.js et définit les bandes créées par le SysOp. <br />
- Vous verrez quelque chose comme ce qui suit, et vous êtes libre de le modifier à votre guise :
   ```
   - const bands = 
   .....
   - { ITU: 1,
            name: '40m', min: -30, max: 110, initFreq: '7120000', publishBand: '1', startFreq: 7000000, endFreq: 7200000,  stepi: 1000, color: 'rgba(50, 168, 72, 0.6)', 
	    modes: [
              { mode: MODES.CW, startFreq: 7000000, endFreq: 7040000 },
              { mode: MODES.LSB, startFreq: 7040000, endFreq: 7200000 }]
	},
	{ ITU: 2,
            name: '40m', min: -30, max: 110, initFreq: '', publishBand: '1', startFreq: 7000000, endFreq: 7300000,  stepi: 1000, color: 'rgba(50, 168, 72, 0.6)', 
	    modes: [
              { mode: MODES.CW, startFreq: 7000000, endFreq: 7050000 },
              { mode: MODES.LSB, startFreq: 7050000, endFreq: 7300000 }]
	},
	{ ITU: 3,
            name: '40m', min: -30, max: 110, initFreq: '', publishBand: '1', startFreq: 7000000, endFreq: 7200000,  stepi: 1000, color: 'rgba(50, 168, 72, 0.6)',
            modes: [
              { mode: MODES.CW, startFreq: 7000000, endFreq: 7040000 },
              { mode: MODES.LSB, startFreq: 7040000, endFreq: 7200000 }]
   .....
   etc
   ```
   **Où :** <br />
   - **ITU** est la région dans laquelle se trouve le serveur,
   - **min et max** sont les limites de luminosité de la cascade pour la bande donnée,
   - **initFreq** est la fréquence initiale sur laquelle s'accorder lorsque la bande est sélectionnée,
   - **publishBand** définit si la bande est affichée : 1 pour les bandes amateurs, 2 pour les bandes de radiodiffusion,
   - **startFreq et endFreq** définissent les limites de la bande,
   - **stepi** est le pas par défaut de la molette pour la bande, et **modes** est le mode par défaut préféré pour la bande.

- Après avoir effectué des modifications, **exécutez recompile.sh dans un terminal** depuis le dossier PhantomSDR-Plus.

Pour des exemples de configuration, voir les fichiers d'exemple inclus :
- `config-rtl.toml` – configuration RTL-SDR
- `config-rsp1a.toml` – configuration SDRplay RSP1A
- `config-airspyhf.toml` – configuration Airspy HF+
- `config-fobos-hf.toml` / `config-fobos.toml` – configuration RigExpert Fobos SDR (HF / RF)
- `config-hackrf.toml` – HackRF One
- `config-rx888mk2.toml` – configuration RX888 MK2

---

## 🌊 Plancher de la cascade — `waterfall.sh`

`waterfall.sh` (à la racine du dépôt) modifie le **niveau minimal de cascade par défaut**, en dB — c'est-à-dire la valeur à partir de laquelle la cascade démarre lors d'une nouvelle visite.

Cette valeur figure dans deux fichiers source, à cinq endroits différents (`frontend/src/waterfall.js` → `this.minWaterfall`, et `frontend/src/App.svelte` → le `let min_waterfall` initial, les deux cas de réinitialisation « min » et la valeur par défaut des favoris). Les éditer à la main se rate facilement : le script s'en charge pour vous. Il n'utilise jamais de numéros de ligne figés — chaque emplacement est repéré par motif, si bien qu'il continue de fonctionner après une mise à jour des sources.

- Une valeur **plus élevée** (par ex. `-15`) donne une cascade **plus sombre**.
- Une valeur **plus basse** (par ex. `-45`) donne une cascade **plus lumineuse**.

```bash
./waterfall.sh              # interactif — affiche les valeurs actuelles et demande la nouvelle
./waterfall.sh -v -15       # fixe la valeur sans poser de question
./waterfall.sh -v -15 -y    # ... et saute toutes les confirmations
./waterfall.sh -s           # affiche seulement les valeurs actuelles, sans rien changer
```

Avant de modifier, il crée une sauvegarde horodatée des deux fichiers (`*.bak-AAAAmmjj-HHMMSS`) et affiche la commande de restauration. Seuls les littéraux égaux à la valeur en cours d'utilisation sont touchés : les autres nombres de ces fichiers ne peuvent donc jamais être réécrits par accident. Si la nouvelle valeur n'apparaît pas ensuite, le script restaure lui-même les sauvegardes et sort en erreur. Il avertit également lorsque les deux fichiers sont désynchronisés et règle les deux.

- Après la modification, le frontend doit être reconstruit — le script propose d'exécuter `recompile.sh` pour vous (avec `-y` il saute la reconstruction : lancez alors `./recompile.sh` vous-même le moment venu).

---

## 🎨 Personnalisation

### Changer l'image de fond

Remplacez `frontend/src/assets/background.jpg` par l'image de votre choix (en conservant le même nom de fichier).

- Après modification, exécutez recompile.sh dans un terminal.


### Choix du codec audio

Choisissez entre FLAC et Opus dans votre configuration `.toml` :
```toml
[input]
audio_compression="opus"  # or "flac"
```
- Après modification, redémarrez le serveur.


### Étalonnage du S-mètre

Les deux instruments sont volontairement sur des **chaînes séparées** ; ils se règlent donc avec deux réglages différents.

#### Les deux réglages

Tous deux se trouvent dans la section `[input]` du fichier de configuration avec lequel le serveur démarre (`config.toml`, `config-rx888mk2.toml`, etc.) :

```toml
[input]
smeter_offset=5         # barre numérique uniquement
analog_smeter_offset=5  # aiguille analogique uniquement
```

Ils sont lus dans `src/websocket.cpp` et envoyés au navigateur dans la première trame `basic_info` : **un redémarrage du serveur suffit** — aucune recompilation du frontend n'est nécessaire.

#### Chaîne analogique

```
dBm affichés = -130 + (rawDb + analog_smeter_offset + 130) x 1,1
```

- Le gain visuel de 1,1 s'applique *après* l'offset, avec pivot à -130 dBm. Une unité d'`analog_smeter_offset` déplace donc la lecture de 1,1 dB. Pour décaler l'affichage de X dB : `analog_smeter_offset ~= 0,91 x X`. La valeur TOML est lue comme un entier : seuls des pas entiers sont possibles.
- La loi de l'aiguille (`powerFromDbm` dans `frontend/src/lib/SMeterAnalog.svelte`) place **S9 à -73 dBm**, à 60 unités d'aiguille sur 100, avec une courbe `pow(...,0,6)` de -130 à -73 sous S9 et une courbe `pow(...,0,8)` de -73 à -13 (S9+60) au-dessus.
- Ce n'est **pas** une échelle linéaire de 6 dB par point S ; le point d'étalonnage pertinent est donc S9 — les graduations sous S9 ne suivront pas un générateur par pas de 6 dB.

#### Chaîne numérique

```
value    = (rawDb / 150) x 100 + smeter_offset   -> borné à [-100, 0]
segments = round((value + 100) x 35 / 100) + DIGITAL_BAR_TRIM
```

- Noter le `/150 x 100` : l'échelle numérique est **comprimée aux 2/3** et ne voit jamais ni `analog_smeter_offset` ni le gain visuel de 1,1. C'est pourquoi la barre et l'aiguille ne coïncident jamais exactement — c'est voulu.
- 35 segments sur 100 unités : un segment vaut 2,86 unités d'offset, soit environ 4,3 dB bruts. `smeter_offset=3` correspond donc à peu près à un segment.
- `DIGITAL_BAR_TRIM` dans `frontend/src/lib/SMeterDigital.svelte` (actuellement 0) décale la barre par segments entiers. Le modifier touche au code source et **exige** une recompilation du frontend.

#### Les fenêtres LED sont pilotées par l'analogique dans les deux instruments

Les fenêtres dBm / dBµV / SNR / NF des **deux** instruments lisent la valeur calibrée analogique et ajoutent un `VISUAL_DBM_OFFSET` fixe de 5, codé en dur dans `SMeterAnalog.svelte` et `SMeterDigital.svelte`. Par conséquent :

- `smeter_offset` ne change **aucun** nombre dans les fenêtres, seulement la longueur de la barre.
- dBµV = dBm + 107 (50 ohms), et NF = dBm - SNR par construction, donc NF suit automatiquement.
- Si l'on veut de bons **nombres** sans toucher à la position de l'aiguille, le réglage est `VISUAL_DBM_OFFSET` — mais c'est une constante du code source, il faut recompiler et la modifier dans **les deux** fichiers pour rester cohérent.

#### Procédure

1. Injecter un niveau connu à l'entrée d'antenne (générateur à -73 dBm = S9), en SSB/CW avec une bande passante stable. Les lectures dépendent de la bande passante et de l'AGC : fixer d'abord le mode et la largeur.
2. Relever ce qu'affiche la fenêtre dBm analogique, puis poser `analog_smeter_offset ~= 0,91 x (-73 - valeur affichée)`. Redémarrer le serveur et vérifier à nouveau. Une itération suffit ; l'aiguille doit se poser sur S9.
3. Passer à l'instrument numérique et régler `smeter_offset` pour que la longueur de barre place S9 où vous le souhaitez — environ 3 unités par segment. Cette étape est purement cosmétique et n'affecte pas les valeurs affichées.
4. Sans générateur, une bande calme avec une balise de niveau connu constitue un bon substitut, ou bien on ancre simplement le plancher de bruit à une valeur plausible (par ex. -120 dBm sur 20 m avec une antenne correcte) — en acceptant que cela étalonne toute la chaîne, gain d'antenne compris, et pas seulement le récepteur.


### Variantes de l'interface graphique

Les quatre variantes de l'interface (S-mètre analogique/numérique x disposition v1/v2) tiennent dans une seule construction. Les visiteurs passent de l'une à l'autre avec le menu ⚙️ en haut à droite — rien n'est rechargé, l'audio, la cascade et tout décodeur en cours continuent — et le choix est conservé dans chaque navigateur.
- Exécutez recompile.sh dans un terminal pour définir la variante de *départ*, celle que voit un visiteur qui arrive pour la première fois.
- **[EDITING_VARIANTS.md](EDITING_VARIANTS.md)** – comment modifier les variantes du frontend (S-mètre et disposition) et les reconstruire

---

## 📚 Documentation

- **[INSTALLATION.md](INSTALLATION.md)** – guide d'installation complet pour les opérateurs système
- **[ADMIN_PANEL_SETUP.md](ADMIN_PANEL_SETUP.md)** – guide d'installation pour les administrateurs système
- **[USER_GUIDE.md](USER_GUIDE.md)** – guide de l'utilisateur final pour l'exploitation du WebSDR
- **[THERMAL_GUARD.md](THERMAL_GUARD.md)** - Manuel du sysop pour la protection contre la surchauffe du processeur : les quatre modes et ce qu'il faut faire pour chacun
- **[CONNECTION_LIMITS.md](CONNECTION_LIMITS.md)** - Manuel du sysop pour les limites de connexion : protéger un récepteur public contre les afflux de connexions
- **[PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md)** – structure des répertoires et organisation du code
- **[EDITING_VARIANTS.md](EDITING_VARIANTS.md)** – comment modifier les variantes du frontend (S-mètre et disposition) et les reconstruire

---

## 🌐 Liste WebSDR en ligne

Enregistrez votre WebSDR sur l'annuaire officiel : https://sdr-list.xyz

Définissez `register_online=true` dans votre fichier de configuration `.toml` pour un enregistrement automatique.

---

## 🐛 Dépannage

### Problèmes courants

**OpenCL ne fonctionne pas**
- Vérifiez que les pilotes sont correctement installés
- Contrôlez avec la commande `clinfo`
- Voir INSTALLATION.md pour la configuration détaillée d'OpenCL

**Problèmes de latence audio**
- Essayez de basculer entre les codecs FLAC et Opus
- Ajustez les réglages de tampon dans la configuration
- Assurez-vous de disposer de ressources CPU/GPU suffisantes

**Échecs de compilation**
- Vérifiez que toutes les dépendances sont installées
- Essayez de nettoyer le répertoire de build : `rm -rf build && meson setup build`
- Recherchez d'éventuels conflits de versions de bibliothèques

---

## 🤝 Contribuer

Les contributions sont les bienvenues ! Il s'agit d'un fork indépendant proposant des fonctions supplémentaires. Merci de :

1. Forker le dépôt
2. Créer une branche de fonctionnalité
3. Valider vos modifications
4. Pousser la branche
5. Créer une Pull Request

---

## 📄 Licence

Ce projet est distribué sous licence GNU General Public License v3.0 – voir le fichier [LICENSE](../../LICENSE) pour les détails.

---

## 👥 Auteurs et remerciements

- **SV1BTL et SV2AMK** – développement et améliorations de PhantomSDR-Plus
- Basé sur le projet PhantomSDR d'origine

---

## 🔗 Liens

- **Démo en direct** : http://phantomsdr.no-ip.org:8900/
- **Annuaire WebSDR** : https://sdr-list.xyz
- **Dépôt GitHub** : https://github.com/sv1btl/PhantomSDR-Plus

---

## 📞 Assistance

- **Problèmes** : signalez les bogues via [GitHub Issues](https://github.com/sv1btl/PhantomSDR-Plus/issues)
- **E-mail** : contactez sv1btl@otenet.gr

---

## ⚡ Conseils de performance

1. **Activez OpenCL/CUDA** pour l'accélération GPU – réduit considérablement la charge CPU
2. **Utilisez un stockage SSD** pour de meilleures performances d'E/S
3. **Allouez suffisamment de RAM** – au moins 8 Go recommandés
4. **Optimisez la taille de la FFT** – une FFT plus grande = meilleure résolution mais plus de CPU
5. **Envisagez un GPU dédié** – AMD ou NVIDIA compatible OpenCL

---

**73 de SV1BTL & SV2AMK**

*Pour des instructions de configuration détaillées, voir INSTALLATION.md* *Pour le guide d'utilisation destiné à l'utilisateur final, voir USER_GUIDE.md*
